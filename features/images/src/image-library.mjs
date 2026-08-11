import { watch } from "node:fs";
import {
  mkdir,
  open,
  readdir,
  stat,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ThreadPromptIndex } from "./prompt-index.mjs";

const PNG_EXTENSION = ".png";
const FALLBACK_RESCAN_INITIAL_DELAY_MS = 30_000;
const FALLBACK_RESCAN_MAX_DELAY_MS = 5 * 60_000;

function isPng(filePath) {
  return path.extname(filePath).toLowerCase() === PNG_EXTENSION;
}

function imageIdFor(sourcePath) {
  return createHash("sha256").update(sourcePath).digest("hex").slice(0, 24);
}

function buildWhere({ query = "", source = "all", threadId = null } = {}) {
  const clauses = [];
  const parameters = [];

  if (threadId) {
    clauses.push("images.thread_id = ?");
    parameters.push(threadId);
  }

  if (source === "chat") {
    clauses.push("thread_sources.source_kind = 'chat'");
  } else if (source.startsWith("project:")) {
    clauses.push("thread_sources.source_kind = 'project' AND thread_sources.project_id = ?");
    parameters.push(source.slice("project:".length));
  } else if (source.startsWith("project-name:")) {
    clauses.push("thread_sources.source_kind = 'project' AND thread_sources.project_name = ?");
    parameters.push(source.slice("project-name:".length));
  } else if (source !== "all") {
    throw new Error(`Unsupported image source: ${source}`);
  }

  const trimmed = query.trim();
  if (trimmed) {
    clauses.push(`(
      images.thread_id LIKE ?
      OR images.image_generation_item_id LIKE ?
      OR COALESCE(images.prompt, '') LIKE ?
      OR COALESCE(thread_sources.project_name, '') LIKE ?
      OR COALESCE(thread_sources.thread_title, '') LIKE ?
    )`);
    parameters.push(...Array(5).fill(`%${trimmed}%`));
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    parameters,
  };
}

async function readPngSize(filePath) {
  const handle = await open(filePath, "r");
  try {
    const header = Buffer.alloc(24);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const pngSignature = "89504e470d0a1a0a";
    if (bytesRead < 24 || header.subarray(0, 8).toString("hex") !== pngSignature) {
      return { width: null, height: null };
    }
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  } finally {
    await handle.close();
  }
}

async function collectPngFiles(directory, output = []) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return output;
    throw error;
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectPngFiles(entryPath, output);
    else if (entry.isFile() && isPng(entryPath)) output.push(entryPath);
  }
  return output;
}

function rowToImage(row) {
  return {
    id: row.id,
    threadId: row.thread_id,
    imageGenerationItemId: row.image_generation_item_id,
    sourcePath: row.source_path,
    prompt: row.prompt,
    width: row.width,
    height: row.height,
    byteLength: row.byte_length,
    createdAt: row.created_at,
    importedAt: row.imported_at,
    sourceKind: row.source_kind ?? null,
    projectId: row.project_id ?? null,
    projectName: row.project_name ?? null,
    threadTitle: row.thread_title ?? null,
    archived: Boolean(row.archived),
  };
}

export class ImageLibrary {
  constructor({
    sourceRoot,
    dataDir,
    sessionRoots = [],
    threadMetadata = null,
    logger = console,
    watchSource = true,
    promptIndexOptions = {},
    watchFactory = watch,
  }) {
    this.sourceRoot = path.resolve(sourceRoot);
    this.dataDir = path.resolve(dataDir);
    this.sessionRoots = sessionRoots.map((sessionRoot) => path.resolve(sessionRoot));
    this.threadMetadata = threadMetadata;
    this.databasePath = path.join(this.dataDir, "library.sqlite");
    this.logger = logger;
    this.watchSource = watchSource;
    this.watchFactory = watchFactory;
    this.promptIndex = new ThreadPromptIndex({ sessionRoots: this.sessionRoots, ...promptIndexOptions });
    this.database = null;
    this.watcher = null;
    this.pendingImports = new Map();
    this.pendingRescan = null;
    this.fallbackRescanTimer = null;
    this.fallbackRescanDelayMs = FALLBACK_RESCAN_INITIAL_DELAY_MS;
    this.rescanPromise = null;
  }

  async start() {
    await mkdir(this.dataDir, { recursive: true });
    await mkdir(this.sourceRoot, { recursive: true });

    this.database = new DatabaseSync(this.databasePath);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        image_generation_item_id TEXT NOT NULL,
        source_path TEXT NOT NULL UNIQUE,
        prompt TEXT,
        width INTEGER,
        height INTEGER,
        byte_length INTEGER NOT NULL,
        source_mtime_ms REAL NOT NULL,
        created_at TEXT NOT NULL,
        imported_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS images_created_at_idx ON images(created_at DESC);
      CREATE INDEX IF NOT EXISTS images_thread_id_idx ON images(thread_id);
      CREATE TABLE IF NOT EXISTS thread_sources (
        thread_id TEXT PRIMARY KEY,
        source_kind TEXT NOT NULL,
        project_id TEXT,
        project_name TEXT,
        thread_title TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
    `);
    const threadSourceColumns = new Set(
      this.database.prepare("PRAGMA table_info(thread_sources)").all().map((column) => column.name),
    );
    if (!threadSourceColumns.has("project_id")) {
      this.database.exec("ALTER TABLE thread_sources ADD COLUMN project_id TEXT");
    }
    if (!threadSourceColumns.has("archived")) {
      this.database.exec("ALTER TABLE thread_sources ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
    }
    this.database.exec(`
      CREATE INDEX IF NOT EXISTS thread_sources_kind_idx ON thread_sources(source_kind);
      CREATE INDEX IF NOT EXISTS thread_sources_project_id_idx ON thread_sources(project_id);
    `);

    const imported = await this.rescan();
    if (this.watchSource) {
      this.watcher = this.watchFactory(this.sourceRoot, { recursive: true }, (_eventType, filename) => {
        if (!filename) return;
        const sourcePath = path.resolve(this.sourceRoot, filename);
        if (isPng(filename)) this.scheduleImport(sourcePath);
        else if (!path.extname(sourcePath)) this.scheduleRescan();
      });
      this.watcher.on("error", (error) => {
        this.logger.error("Image watcher failed", error);
        this.startFallbackRescan();
      });
    }
    return { imported, total: this.count() };
  }

  count(options = {}) {
    const { sql, parameters } = buildWhere(options);
    return this.database.prepare(`
      SELECT COUNT(*) AS count
      FROM images
      LEFT JOIN thread_sources ON thread_sources.thread_id = images.thread_id
      ${sql}
    `).get(...parameters).count;
  }

  list({ query = "", source = "all", threadId = null, sort = "desc", limit = null, offset = 0 } = {}) {
    const { sql, parameters } = buildWhere({ query, source, threadId });
    const pagination = Number.isInteger(limit) ? "LIMIT ? OFFSET ?" : "";
    if (pagination) parameters.push(limit, offset);
    const direction = sort === "asc" ? "ASC" : "DESC";
    const rows = this.database
      .prepare(`
        SELECT images.*, thread_sources.source_kind, thread_sources.project_id,
          thread_sources.project_name, thread_sources.thread_title, thread_sources.archived
        FROM images
        LEFT JOIN thread_sources ON thread_sources.thread_id = images.thread_id
        ${sql}
        ORDER BY images.created_at ${direction}, images.id ${direction}
        ${pagination}
      `)
      .all(...parameters);
    return rows.map(rowToImage);
  }

  facets() {
    const chats = this.database.prepare(`
      SELECT COUNT(*) AS count
      FROM images
      JOIN thread_sources ON thread_sources.thread_id = images.thread_id
      WHERE thread_sources.source_kind = 'chat'
    `).get().count;
    const projects = this.database.prepare(`
      SELECT thread_sources.project_name,
        COUNT(*) AS count, MAX(images.created_at) AS latest_created_at
      FROM images
      JOIN thread_sources ON thread_sources.thread_id = images.thread_id
      WHERE thread_sources.source_kind = 'project'
      GROUP BY thread_sources.project_name
      ORDER BY latest_created_at DESC, thread_sources.project_name COLLATE NOCASE ASC
    `).all().map((row) => ({
      scope: `project-name:${row.project_name}`,
      name: row.project_name || "Project",
      count: row.count,
      latestCreatedAt: row.latest_created_at,
    }));
    return { total: this.count(), chats, projects };
  }

  countGroups({ source = "all" } = {}) {
    const { sql, parameters } = buildWhere({ source });
    return this.database.prepare(`
      SELECT COUNT(DISTINCT images.thread_id) AS count
      FROM images
      LEFT JOIN thread_sources ON thread_sources.thread_id = images.thread_id
      ${sql}
    `).get(...parameters).count;
  }

  groups({ source = "all", limit = null, offset = 0, previewLimit = 4 } = {}) {
    const { sql, parameters } = buildWhere({ source });
    const pagination = Number.isInteger(limit) ? "LIMIT ? OFFSET ?" : "";
    if (pagination) parameters.push(limit, offset);
    const rows = this.database.prepare(`
      SELECT images.thread_id, thread_sources.source_kind, thread_sources.project_id,
        thread_sources.project_name, thread_sources.thread_title, thread_sources.archived,
        COUNT(*) AS image_count, MIN(images.created_at) AS created_at,
        MAX(images.created_at) AS updated_at
      FROM images
      LEFT JOIN thread_sources ON thread_sources.thread_id = images.thread_id
      ${sql}
      GROUP BY images.thread_id
      ORDER BY updated_at DESC, images.thread_id DESC
      ${pagination}
    `).all(...parameters);

    const previewsByThread = new Map();
    if (rows.length && previewLimit > 0) {
      const threadIds = rows.map((row) => row.thread_id);
      const placeholders = threadIds.map(() => "?").join(", ");
      const previewRows = this.database.prepare(`
        SELECT * FROM (
          SELECT images.*, thread_sources.source_kind, thread_sources.project_id,
            thread_sources.project_name, thread_sources.thread_title, thread_sources.archived,
            ROW_NUMBER() OVER (
              PARTITION BY images.thread_id
              ORDER BY images.created_at ASC, images.id ASC
            ) AS preview_rank
          FROM images
          LEFT JOIN thread_sources ON thread_sources.thread_id = images.thread_id
          WHERE images.thread_id IN (${placeholders})
        )
        WHERE preview_rank <= ?
        ORDER BY thread_id ASC, created_at ASC, id ASC
      `).all(...threadIds, previewLimit);
      for (const previewRow of previewRows) {
        const previews = previewsByThread.get(previewRow.thread_id) ?? [];
        previews.push(rowToImage(previewRow));
        previewsByThread.set(previewRow.thread_id, previews);
      }
    }

    return rows.map((row) => ({
      threadId: row.thread_id,
      sourceKind: row.source_kind ?? null,
      projectId: row.project_id ?? null,
      projectName: row.project_name ?? null,
      threadTitle: row.thread_title ?? null,
      archived: Boolean(row.archived),
      imageCount: row.image_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      previews: previewsByThread.get(row.thread_id) ?? [],
    }));
  }

  get(id) {
    const row = this.database.prepare(`
      SELECT images.*, thread_sources.source_kind, thread_sources.project_id,
        thread_sources.project_name, thread_sources.thread_title, thread_sources.archived
      FROM images
      LEFT JOIN thread_sources ON thread_sources.thread_id = images.thread_id
      WHERE images.id = ?
    `).get(id);
    return row ? rowToImage(row) : null;
  }

  async syncThreadMetadata(threadIds = null) {
    if (!this.threadMetadata) return;
    const ids = threadIds ?? this.database
      .prepare("SELECT DISTINCT thread_id FROM images")
      .all()
      .map((row) => row.thread_id);
    const upsert = this.database.prepare(`
      INSERT INTO thread_sources (
        thread_id, source_kind, project_id, project_name, thread_title, archived, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(thread_id) DO UPDATE SET
        source_kind = excluded.source_kind,
        project_id = excluded.project_id,
        project_name = excluded.project_name,
        thread_title = excluded.thread_title,
        archived = excluded.archived,
        updated_at = excluded.updated_at
    `);
    const now = new Date().toISOString();
    for (const threadId of ids) {
      const metadata = await this.threadMetadata.get(threadId);
      if (!metadata) continue;
      upsert.run(
        threadId,
        metadata.sourceKind,
        metadata.projectId ?? null,
        metadata.projectName,
        metadata.threadTitle,
        metadata.archived ? 1 : 0,
        now,
      );
    }
  }

  async hydratePrompt(id) {
    const image = this.get(id);
    if (!image || image.prompt || this.sessionRoots.length === 0) return image;
    const prompt = await this.promptIndex.find(image.threadId, image.imageGenerationItemId);
    if (!prompt) return image;
    this.database.prepare("UPDATE images SET prompt = ? WHERE id = ?").run(prompt, id);
    return this.get(id);
  }

  rescan() {
    if (this.rescanPromise) return this.rescanPromise;
    const scan = this.performRescan();
    const shared = scan.finally(() => {
      if (this.rescanPromise === shared) this.rescanPromise = null;
    });
    this.rescanPromise = shared;
    return shared;
  }

  rescanStatus() {
    return { inProgress: Boolean(this.rescanPromise) };
  }

  async performRescan() {
    await this.threadMetadata?.refresh();
    const files = await collectPngFiles(this.sourceRoot);
    let imported = 0;
    for (const filePath of files) {
      if (await this.importImage(filePath)) imported += 1;
    }
    await this.syncThreadMetadata();
    return imported;
  }

  scheduleImport(sourcePath) {
    clearTimeout(this.pendingImports.get(sourcePath));
    const timer = setTimeout(() => {
      this.pendingImports.delete(sourcePath);
      Promise.resolve(this.threadMetadata?.refresh())
        .then(() => this.importImage(sourcePath))
        .catch((error) => {
          this.logger.warn(`Could not import ${sourcePath}`, error.message);
        });
    }, 400);
    this.pendingImports.set(sourcePath, timer);
  }

  scheduleRescan() {
    clearTimeout(this.pendingRescan);
    this.pendingRescan = setTimeout(() => {
      this.pendingRescan = null;
      this.rescan().catch((error) => this.logger.warn("Could not rescan Images", error.message));
    }, 400);
  }

  startFallbackRescan() {
    if (this.fallbackRescanTimer !== null) return;
    const tick = () => {
      this.fallbackRescanTimer = null;
      if (!this.database) return;
      const delay = this.fallbackRescanDelayMs;
      this.rescan()
        .catch((error) => this.logger.warn("Could not rescan Images", error.message))
        .finally(() => {
          if (!this.database) return;
          this.fallbackRescanDelayMs = Math.min(delay * 2, FALLBACK_RESCAN_MAX_DELAY_MS);
          this.fallbackRescanTimer = setTimeout(tick, this.fallbackRescanDelayMs);
        });
    };
    this.fallbackRescanTimer = setTimeout(tick, this.fallbackRescanDelayMs);
  }

  async importImage(sourcePath) {
    if (!isPng(sourcePath)) return false;

    let sourceStat;
    try {
      sourceStat = await stat(sourcePath);
    } catch (error) {
      if (error.code === "ENOENT") {
        this.database.prepare("DELETE FROM images WHERE source_path = ?").run(sourcePath);
        return false;
      }
      throw error;
    }
    if (!sourceStat.isFile()) return false;

    const relativePath = path.relative(this.sourceRoot, sourcePath);
    if (relativePath.startsWith("..")) return false;
    const segments = relativePath.split(path.sep);
    if (segments.length < 2) return false;

    const threadId = segments.at(-2);
    const imageGenerationItemId = path.basename(sourcePath, PNG_EXTENSION);
    const id = imageIdFor(sourcePath);
    const existing = this.database
      .prepare("SELECT source_mtime_ms, byte_length FROM images WHERE id = ?")
      .get(id);

    if (
      existing &&
      existing.source_mtime_ms === sourceStat.mtimeMs &&
      existing.byte_length === sourceStat.size
    ) return false;

    const { width, height } = await readPngSize(sourcePath);
    const now = new Date().toISOString();
    const createdAt = new Date(sourceStat.birthtimeMs || sourceStat.mtimeMs).toISOString();

    this.database
      .prepare(`
        INSERT INTO images (
          id, thread_id, image_generation_item_id, source_path,
          prompt, width, height, byte_length, source_mtime_ms,
          created_at, imported_at
        ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          width = excluded.width,
          height = excluded.height,
          byte_length = excluded.byte_length,
          source_mtime_ms = excluded.source_mtime_ms,
          imported_at = excluded.imported_at
      `)
      .run(
        id,
        threadId,
        imageGenerationItemId,
        sourcePath,
        width,
        height,
        sourceStat.size,
        sourceStat.mtimeMs,
        createdAt,
        now,
      );
    this.promptIndex.invalidate(threadId);
    await this.syncThreadMetadata([threadId]);
    return true;
  }

  close() {
    this.watcher?.close();
    for (const timer of this.pendingImports.values()) clearTimeout(timer);
    this.pendingImports.clear();
    clearTimeout(this.pendingRescan);
    this.pendingRescan = null;
    clearTimeout(this.fallbackRescanTimer);
    this.fallbackRescanTimer = null;
    this.fallbackRescanDelayMs = FALLBACK_RESCAN_INITIAL_DELAY_MS;
    this.promptIndex.close();
    this.threadMetadata?.close();
    this.database?.close();
    this.database = null;
  }
}
