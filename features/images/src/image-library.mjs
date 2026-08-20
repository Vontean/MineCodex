import { watch } from "node:fs";
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ThreadPromptIndex } from "./prompt-index.mjs";

const PNG_EXTENSION = ".png";
const FALLBACK_RESCAN_INITIAL_DELAY_MS = 30_000;
const FALLBACK_RESCAN_MAX_DELAY_MS = 5 * 60_000;
export const MAX_IMPORTED_IMAGE_BYTES = 32 * 1024 * 1024;
export const MAX_IMPORTED_IMAGE_DIMENSION = 16_384;

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

  if (source === "chat" || source === "work") {
    clauses.push(`thread_sources.source_kind = '${source}'`);
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

function imageSizeFromBuffer(bytes, mimeType) {
  if (mimeType === "image/png") {
    if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (mimeType === "image/jpeg") {
    if (bytes.length < 4 || bytes.readUInt16BE(0) !== 0xffd8) return null;
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > bytes.length) return null;
      const segmentLength = bytes.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
        || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        if (segmentLength < 7) return null;
        return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
      }
      offset += segmentLength;
    }
    return null;
  }
  if (mimeType === "image/webp") {
    if (bytes.length < 30 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
      return null;
    }
    if (bytes.toString("ascii", 12, 16) !== "VP8X") return null;
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    };
  }
  return null;
}

function normalizedImportMime(mimeType) {
  const normalized = String(mimeType ?? "").split(";", 1)[0].trim().toLowerCase();
  return new Set(["image/png", "image/jpeg", "image/webp"]).has(normalized) ? normalized : null;
}

function extensionForMime(mimeType) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length);
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
    this.initialScanPromise = null;
    this.lifecycleVersion = 0;
    this.closed = true;
  }

  async start({ deferInitialScan = false } = {}) {
    const lifecycleVersion = ++this.lifecycleVersion;
    this.closed = false;
    this.initialScanPromise = null;
    await mkdir(this.dataDir, { recursive: true });
    await mkdir(this.sourceRoot, { recursive: true });
    if (!this.isLifecycleActive(lifecycleVersion, { requireDatabase: false })) {
      return { imported: 0, total: 0 };
    }

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

    const initialScan = () => this.completeInitialScan(lifecycleVersion);
    if (deferInitialScan) {
      return { imported: 0, total: this.count(), initialScan };
    }
    return initialScan();
  }

  isLifecycleActive(lifecycleVersion = this.lifecycleVersion, { requireDatabase = true } = {}) {
    return !this.closed
      && lifecycleVersion === this.lifecycleVersion
      && (!requireDatabase || this.database !== null);
  }

  completeInitialScan(lifecycleVersion) {
    if (!this.isLifecycleActive(lifecycleVersion)) {
      return Promise.resolve({ imported: 0, total: 0 });
    }
    if (this.initialScanPromise) return this.initialScanPromise;
    this.initialScanPromise = (async () => {
      const initialImported = await this.rescan();
      if (!this.isLifecycleActive(lifecycleVersion)) return { imported: 0, total: 0 };
      this.startWatching(lifecycleVersion);
      if (!this.isLifecycleActive(lifecycleVersion)) return { imported: 0, total: 0 };
      const reconciliationImported = this.watcher ? await this.rescan() : 0;
      if (!this.isLifecycleActive(lifecycleVersion)) return { imported: 0, total: 0 };
      return { imported: initialImported + reconciliationImported, total: this.count() };
    })();
    return this.initialScanPromise;
  }

  startWatching(lifecycleVersion = this.lifecycleVersion) {
    if (!this.watchSource || this.watcher || !this.isLifecycleActive(lifecycleVersion)) return;
    const watcher = this.watchFactory(this.sourceRoot, { recursive: true }, (_eventType, filename) => {
      if (!filename || !this.isLifecycleActive(lifecycleVersion)) return;
      const sourcePath = path.resolve(this.sourceRoot, filename);
      if (isPng(filename)) this.scheduleImport(sourcePath);
      else if (!path.extname(sourcePath)) this.scheduleRescan();
    });
    if (!this.isLifecycleActive(lifecycleVersion)) {
      watcher.close();
      return;
    }
    this.watcher = watcher;
    watcher.on("error", (error) => {
      if (!this.isLifecycleActive(lifecycleVersion)) return;
      this.logger.error("Image watcher failed", error);
      this.startFallbackRescan();
    });
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
    const works = this.database.prepare(`
      SELECT COUNT(*) AS count
      FROM images
      JOIN thread_sources ON thread_sources.thread_id = images.thread_id
      WHERE thread_sources.source_kind = 'work'
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
    return { total: this.count(), chats, works, projects };
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
    if (!this.threadMetadata || !this.isLifecycleActive()) return;
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
      if (!this.isLifecycleActive()) return;
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
    if (!this.isLifecycleActive()) return 0;
    const files = await collectPngFiles(this.sourceRoot);
    if (!this.isLifecycleActive()) return 0;
    let imported = 0;
    for (const filePath of files) {
      if (!this.isLifecycleActive()) return imported;
      if (await this.importImage(filePath)) imported += 1;
    }
    if (this.isLifecycleActive()) await this.syncThreadMetadata();
    return imported;
  }

  scheduleImport(sourcePath) {
    if (!this.isLifecycleActive()) return;
    clearTimeout(this.pendingImports.get(sourcePath));
    const timer = setTimeout(() => {
      this.pendingImports.delete(sourcePath);
      if (!this.isLifecycleActive()) return;
      Promise.resolve(this.threadMetadata?.refresh())
        .then(() => this.importImage(sourcePath))
        .catch((error) => {
          this.logger.warn(`Could not import ${sourcePath}`, error.message);
        });
    }, 400);
    this.pendingImports.set(sourcePath, timer);
  }

  scheduleRescan() {
    if (!this.isLifecycleActive()) return;
    clearTimeout(this.pendingRescan);
    this.pendingRescan = setTimeout(() => {
      this.pendingRescan = null;
      if (!this.isLifecycleActive()) return;
      this.rescan().catch((error) => this.logger.warn("Could not rescan Images", error.message));
    }, 400);
  }

  startFallbackRescan() {
    if (this.fallbackRescanTimer !== null) return;
    const tick = () => {
      this.fallbackRescanTimer = null;
      if (!this.isLifecycleActive()) return;
      const delay = this.fallbackRescanDelayMs;
      this.rescan()
        .catch((error) => this.logger.warn("Could not rescan Images", error.message))
        .finally(() => {
          if (!this.isLifecycleActive()) return;
          this.fallbackRescanDelayMs = Math.min(delay * 2, FALLBACK_RESCAN_MAX_DELAY_MS);
          this.fallbackRescanTimer = setTimeout(tick, this.fallbackRescanDelayMs);
        });
    };
    this.fallbackRescanTimer = setTimeout(tick, this.fallbackRescanDelayMs);
  }

  async importImage(sourcePath) {
    if (!isPng(sourcePath) || !this.isLifecycleActive()) return false;

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
    if (!this.isLifecycleActive()) return false;
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
    if (!this.isLifecycleActive()) return false;
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

  async importExternalImage({
    bytes,
    mimeType,
    itemId,
    conversationId = null,
    conversationTitle = null,
    sourceKind,
    prompt = null,
    createdAt = null,
  } = {}) {
    if (!this.isLifecycleActive() || !Buffer.isBuffer(bytes)) return { imported: false, reason: "INVALID_BYTES" };
    const normalizedMime = normalizedImportMime(mimeType);
    if (!normalizedMime) return { imported: false, reason: "UNSUPPORTED_MIME" };
    if (bytes.length === 0 || bytes.length > MAX_IMPORTED_IMAGE_BYTES) {
      return { imported: false, reason: "IMAGE_TOO_LARGE" };
    }
    const size = imageSizeFromBuffer(bytes, normalizedMime);
    if (!size || size.width < 1 || size.height < 1
      || size.width > MAX_IMPORTED_IMAGE_DIMENSION || size.height > MAX_IMPORTED_IMAGE_DIMENSION) {
      return { imported: false, reason: "INVALID_DIMENSIONS" };
    }
    if (!new Set(["chat", "work"]).has(sourceKind)) {
      return { imported: false, reason: "INVALID_SOURCE_KIND" };
    }
    const safeItemId = String(itemId ?? "").trim();
    if (!safeItemId || safeItemId.length > 256 || /[\\/\u0000]/.test(safeItemId)) {
      return { imported: false, reason: "INVALID_ITEM_ID" };
    }
    const safeConversationId = conversationId == null ? null : String(conversationId).trim().slice(0, 256) || null;
    const safeTitle = conversationTitle == null ? "" : String(conversationTitle).trim().slice(0, 512);
    const safePrompt = prompt == null ? null : String(prompt).trim().slice(0, 8_192) || null;
    const logicalThreadId = `chatgpt:${sourceKind}:${safeConversationId ?? "unknown"}`;
    const id = imageIdFor(`external:${sourceKind}:${safeConversationId ?? ""}:${safeItemId}`);
    const extension = extensionForMime(normalizedMime);
    const assetDir = path.join(this.dataDir, "external-images");
    const sourcePath = path.join(assetDir, `${id}.${extension}`);
    const existing = this.database.prepare("SELECT source_path, byte_length FROM images WHERE id = ?").get(id);
    if (existing && existing.byte_length === bytes.length) {
      try {
        const existingBytes = await readFile(existing.source_path);
        if (existingBytes.equals(bytes)) return { imported: false, id, reason: "DUPLICATE" };
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    await mkdir(assetDir, { recursive: true });
    const temporaryPath = path.join(assetDir, `.${id}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
      await rename(temporaryPath, sourcePath);
    } finally {
      await unlink(temporaryPath).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
    const importedAt = new Date().toISOString();
    const normalizedCreatedAt = createdAt && !Number.isNaN(Date.parse(createdAt))
      ? new Date(createdAt).toISOString()
      : importedAt;
    this.database
      .prepare(`
        INSERT INTO images (
          id, thread_id, image_generation_item_id, source_path,
          prompt, width, height, byte_length, source_mtime_ms,
          created_at, imported_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          source_path = excluded.source_path,
          prompt = excluded.prompt,
          width = excluded.width,
          height = excluded.height,
          byte_length = excluded.byte_length,
          source_mtime_ms = excluded.source_mtime_ms,
          created_at = excluded.created_at,
          imported_at = excluded.imported_at
      `)
      .run(
        id,
        logicalThreadId,
        safeItemId,
        sourcePath,
        safePrompt,
        size.width,
        size.height,
        bytes.length,
        0,
        normalizedCreatedAt,
        importedAt,
      );
    this.database
      .prepare(`
        INSERT INTO thread_sources (
          thread_id, source_kind, project_id, project_name, thread_title, archived, updated_at
        ) VALUES (?, ?, NULL, NULL, ?, 0, ?)
        ON CONFLICT(thread_id) DO UPDATE SET
          source_kind = excluded.source_kind,
          thread_title = CASE
            WHEN excluded.thread_title <> '' THEN excluded.thread_title
            ELSE thread_sources.thread_title
          END,
          updated_at = excluded.updated_at
      `)
      .run(logicalThreadId, sourceKind, safeTitle, importedAt);
    return { imported: true, id };
  }

  close() {
    this.closed = true;
    this.lifecycleVersion += 1;
    this.watcher?.close();
    this.watcher = null;
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
