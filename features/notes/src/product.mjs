import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { chmod, mkdir, open as openFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const ORDER_STEP = 1024;
const DEFAULT_FILE_CLEANUP_INTERVAL_MS = 5_000;
const DEFAULT_FILE_CLEANUP_CONCURRENCY = 8;
const DEFAULT_FILE_STAT_TIMEOUT_MS = 1_500;
const DEFAULT_FILE_ADD_CONCURRENCY = 8;
const SUMMARY_ITEM_LIMIT = 5;
const TODO_CHANGE_FIELDS = new Set(["body", "completed"]);
const PROMPT_CHANGE_FIELDS = new Set(["title", "body", "starred"]);

function scheduleCleanupOnNextTurn(callback) {
  setImmediate(callback);
}

const MIME_TYPES = new Map([
  [".avif", "image/avif"],
  [".css", "text/css"],
  [".csv", "text/csv"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".gif", "image/gif"],
  [".heic", "image/heic"],
  [".html", "text/html"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript"],
  [".json", "application/json"],
  [".md", "text/markdown"],
  [".mov", "video/quicktime"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".ppt", "application/vnd.ms-powerpoint"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain"],
  [".webp", "image/webp"],
  [".xls", "application/vnd.ms-excel"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [".xml", "application/xml"],
  [".zip", "application/zip"],
]);

export class ProductError extends Error {
  constructor(message, { code = "INVALID_REQUEST", status = 400, details = null } = {}) {
    super(message);
    this.name = "ProductError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function requiredBody(value, field = "body") {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProductError(`${field} must contain text`, { code: "EMPTY_BODY" });
  }
  return value;
}

function optionalTitle(value) {
  if (value == null) return "";
  if (typeof value !== "string") {
    throw new ProductError("title must be a string", { code: "INVALID_TITLE" });
  }
  return value.trim();
}

function requiredObject(value, field = "request body") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ProductError(`${field} must be a JSON object`, { code: "INVALID_BODY" });
  }
  return value;
}

function requiredChanges(value, allowedFields) {
  const changes = requiredObject(value, "changes");
  const fields = Object.keys(changes);
  if (fields.length === 0 || fields.some((field) => !allowedFields.has(field))) {
    throw new ProductError("changes must contain only supported fields", {
      code: "INVALID_CHANGES",
      details: { allowedFields: [...allowedFields] },
    });
  }
  return changes;
}

async function mapWithConcurrency(values, concurrency, operation) {
  const results = new Array(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await operation(values[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

async function statWithin(fileStatOperations, capacity, fileStat, filePath, timeoutMs) {
  if (fileStatOperations.size >= capacity) return null;
  const settled = Promise.resolve()
    .then(() => fileStat(filePath))
    .then(
      (info) => ({ status: "fulfilled", info }),
      (error) => ({ status: "rejected", error }),
    );
  fileStatOperations.add(settled);
  void settled.then(() => fileStatOperations.delete(settled));
  let timer;
  try {
    const outcome = await Promise.race([
      settled,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ status: "timed-out" }), timeoutMs);
        timer.unref?.();
      }),
    ]);
    if (outcome.status === "timed-out") return null;
    if (outcome.status === "rejected") throw outcome.error;
    return outcome.info;
  } finally {
    clearTimeout(timer);
  }
}

function mapTodo(row) {
  return {
    id: row.id,
    body: row.body,
    order: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function promptSummary(title, body) {
  if (title.trim()) return title.trim();
  let start = 0;
  while (start <= body.length) {
    const newline = body.indexOf("\n", start);
    const end = newline === -1 ? body.length : newline;
    const line = body.slice(start, end).replace(/\r$/, "").trim();
    if (line) return line;
    if (newline === -1) break;
    start = newline + 1;
  }
  return "Untitled prompt";
}

function mapPrompt(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    summary: promptSummary(row.title, row.body),
    starred: Boolean(row.starred),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
  };
}

function mapFile(row) {
  return {
    id: row.id,
    path: row.canonical_path,
    name: row.display_name,
    mimeType: row.mime_type,
    size: row.size,
    addedAt: row.added_at,
    lastCalledAt: row.last_called_at,
  };
}

function mimeTypeFor(filePath) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

function isConfirmedMissing(error) {
  return error?.code === "ENOENT" || error?.code === "ENOTDIR";
}

function surfacesForReason(reason) {
  const domain = String(reason).split(":", 1)[0];
  if (domain === "todo") return ["summary", "todo", "editor:todo"];
  if (domain === "prompt") return ["summary", "prompts", "editor:prompt"];
  if (domain === "file" || domain === "files") return ["summary", "files"];
  return ["summary", "todo", "prompts", "files"];
}

export class CodexNotesProduct extends EventEmitter {
  constructor({
    databasePath,
    clock = () => Date.now(),
    cleanupClock = () => Date.now(),
    fileCleanupIntervalMs = DEFAULT_FILE_CLEANUP_INTERVAL_MS,
    fileCleanupConcurrency = DEFAULT_FILE_CLEANUP_CONCURRENCY,
    fileStatTimeoutMs = DEFAULT_FILE_STAT_TIMEOUT_MS,
    fileStat = stat,
    cleanupScheduler = scheduleCleanupOnNextTurn,
  }) {
    super();
    if (!databasePath) throw new Error("databasePath is required");
    this.databasePath = databasePath;
    this.clock = clock;
    this.cleanupClock = cleanupClock;
    this.fileCleanupIntervalMs = fileCleanupIntervalMs;
    this.fileCleanupConcurrency = fileCleanupConcurrency;
    this.fileStatTimeoutMs = fileStatTimeoutMs;
    this.fileStat = fileStat;
    this.cleanupScheduler = cleanupScheduler;
    if (!Number.isFinite(fileCleanupIntervalMs) || fileCleanupIntervalMs < 0) {
      throw new Error("fileCleanupIntervalMs must be a non-negative number");
    }
    if (!Number.isInteger(fileCleanupConcurrency) || fileCleanupConcurrency < 1) {
      throw new Error("fileCleanupConcurrency must be a positive integer");
    }
    if (!Number.isFinite(fileStatTimeoutMs) || fileStatTimeoutMs <= 0) {
      throw new Error("fileStatTimeoutMs must be a positive number");
    }
    if (typeof fileStat !== "function") throw new Error("fileStat must be a function");
    if (typeof cleanupScheduler !== "function") throw new Error("cleanupScheduler must be a function");
    this.fileCleanupPromise = null;
    this.fileStatOperations = new Set();
    this.lastFileCleanupAt = Number.NEGATIVE_INFINITY;
    this.db = null;
  }

  async open() {
    await mkdir(path.dirname(this.databasePath), { recursive: true, mode: 0o700 });
    const databaseFile = await openFile(this.databasePath, "a", 0o600);
    await databaseFile.close();
    await chmod(this.databasePath, 0o600);
    this.db = new DatabaseSync(this.databasePath);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000; PRAGMA foreign_keys = ON;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      ) STRICT;
      INSERT OR IGNORE INTO metadata (key, value) VALUES ('revision', 0);

      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        body TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER
      ) STRICT;
      DROP INDEX IF EXISTS todos_active_order;
      CREATE INDEX IF NOT EXISTS todos_active_display_order
        ON todos (completed_at, sort_order ASC, created_at DESC);
      CREATE INDEX IF NOT EXISTS todos_completed_order
        ON todos (completed_at DESC, updated_at DESC);

    `);

    const hasLegacyNotes = Boolean(this.db.prepare(`
      SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'notes'
    `).get());
    const hasPrompts = Boolean(this.db.prepare(`
      SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'prompts'
    `).get());
    if (hasLegacyNotes && hasPrompts) {
      throw new Error("Both legacy notes and prompts tables exist; refusing an ambiguous Prompt migration");
    }
    if (hasLegacyNotes) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.exec(`
          ALTER TABLE notes RENAME TO prompts;
          ALTER TABLE prompts RENAME COLUMN pinned TO starred;
          DROP INDEX IF EXISTS notes_display_order;
        `);
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        starred INTEGER NOT NULL DEFAULT 0 CHECK (starred IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_used_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS prompts_display_order
        ON prompts (starred DESC, last_used_at DESC, created_at DESC);

      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        canonical_path TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER,
        added_at INTEGER NOT NULL,
        last_called_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS files_call_order
        ON files (last_called_at DESC, added_at DESC);
    `);
    return this;
  }

  close() {
    this.db?.close();
    this.db = null;
  }

  ensureOpen() {
    if (!this.db) throw new Error("CodexNotesProduct is not open");
  }

  get revision() {
    this.ensureOpen();
    return this.db.prepare("SELECT value FROM metadata WHERE key = 'revision'").get().value;
  }

  mutate(reason, operation) {
    this.ensureOpen();
    this.db.exec("BEGIN IMMEDIATE");
    let result;
    let revision;
    try {
      result = operation();
      this.db.prepare("UPDATE metadata SET value = value + 1 WHERE key = 'revision'").run();
      revision = this.revision;
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    queueMicrotask(() => this.emit("change", {
      revision,
      reason,
      surfaces: surfacesForReason(reason),
    }));
    return { result, revision };
  }

  async cleanupMissingFiles({ force = false } = {}) {
    this.ensureOpen();
    if (this.fileCleanupPromise) return this.fileCleanupPromise;
    const now = this.cleanupClock();
    if (!force && now - this.lastFileCleanupAt < this.fileCleanupIntervalMs) return [];
    this.lastFileCleanupAt = now;
    this.fileCleanupPromise = new Promise((resolve, reject) => {
      try {
        this.cleanupScheduler(() => {
          this.performMissingFileCleanup().then(resolve, reject);
        });
      } catch (error) {
        reject(error);
      }
    });
    try {
      return await this.fileCleanupPromise;
    } finally {
      this.fileCleanupPromise = null;
    }
  }

  async performMissingFileCleanup() {
    const rows = this.db.prepare("SELECT id, canonical_path FROM files").all();
    const checks = await mapWithConcurrency(rows, this.fileCleanupConcurrency, async (row) => {
      try {
        const info = await statWithin(
          this.fileStatOperations,
          this.fileCleanupConcurrency,
          this.fileStat,
          row.canonical_path,
          this.fileStatTimeoutMs,
        );
        if (!info) return null;
        return info.isFile() ? null : row.id;
      } catch (error) {
        return isConfirmedMissing(error) ? row.id : null;
      }
    });
    const missing = checks.filter(Boolean);
    if (missing.length === 0) return [];
    const stillPresent = this.db.prepare("SELECT 1 FROM files WHERE id = ?");
    const removable = missing.filter((id) => stillPresent.get(id));
    if (removable.length === 0) return [];
    const { result } = this.mutate("files:missing-removed", () => {
      const remove = this.db.prepare("DELETE FROM files WHERE id = ?");
      let removed = 0;
      for (const id of removable) removed += remove.run(id).changes;
      return removed;
    });
    return result > 0 ? removable : [];
  }

  removeMissingFile(id) {
    this.ensureOpen();
    const exists = this.db.prepare("SELECT 1 FROM files WHERE id = ?").get(id);
    if (!exists) return { revision: this.revision, removed: false };
    const { result, revision } = this.mutate("file:missing-removed", () => (
      this.db.prepare("DELETE FROM files WHERE id = ?").run(id).changes
    ));
    return { revision, removed: result > 0 };
  }

  async getState({ surface = "all", kind = null, id = null } = {}) {
    void this.cleanupMissingFiles().catch(() => {});
    this.ensureOpen();
    if (!new Set(["all", "summary", "todo", "prompts", "files", "editor"]).has(surface)) {
      throw new ProductError("surface is not supported", { code: "INVALID_SURFACE" });
    }

    const state = {
      revision: this.revision,
      todos: { active: [], completed: [] },
      prompts: [],
      files: [],
    };

    if (surface === "all" || surface === "summary" || surface === "todo") {
      const todoLimit = surface === "summary" ? `LIMIT ${SUMMARY_ITEM_LIMIT}` : "";
      state.todos.active = this.db.prepare(`
        SELECT * FROM todos WHERE completed_at IS NULL
        ORDER BY sort_order ASC, created_at DESC ${todoLimit}
      `).all().map(mapTodo);
      state.todos.completed = this.db.prepare(`
        SELECT * FROM todos WHERE completed_at IS NOT NULL
        ORDER BY completed_at DESC, updated_at DESC ${todoLimit}
      `).all().map(mapTodo);
    }
    if (surface === "all" || surface === "summary" || surface === "prompts") {
      const promptLimit = surface === "summary" ? `LIMIT ${SUMMARY_ITEM_LIMIT}` : "";
      state.prompts = this.db.prepare(`
        SELECT * FROM prompts ORDER BY starred DESC, last_used_at DESC, created_at DESC ${promptLimit}
      `).all().map(mapPrompt);
    }
    if (surface === "all" || surface === "summary" || surface === "files") {
      const fileLimit = surface === "summary" ? `LIMIT ${SUMMARY_ITEM_LIMIT}` : "";
      state.files = this.db.prepare(`
        SELECT * FROM files ORDER BY last_called_at DESC, added_at DESC ${fileLimit}
      `).all().map(mapFile);
    }
    if (surface === "editor" && id) {
      if (kind === "todo") {
        const todo = this.db.prepare("SELECT * FROM todos WHERE id = ?").get(id);
        if (todo) {
          if (todo.completed_at == null) state.todos.active = [mapTodo(todo)];
          else state.todos.completed = [mapTodo(todo)];
        }
      } else if (kind === "prompt") {
        const prompt = this.db.prepare("SELECT * FROM prompts WHERE id = ?").get(id);
        if (prompt) state.prompts = [mapPrompt(prompt)];
      }
    }

    if (surface !== "all") state.surface = surface;
    if (surface === "summary") {
      state.counts = {
        todos: {
          active: this.db.prepare("SELECT COUNT(*) AS count FROM todos WHERE completed_at IS NULL").get().count,
          completed: this.db.prepare("SELECT COUNT(*) AS count FROM todos WHERE completed_at IS NOT NULL").get().count,
        },
        prompts: this.db.prepare("SELECT COUNT(*) AS count FROM prompts").get().count,
        files: this.db.prepare("SELECT COUNT(*) AS count FROM files").get().count,
      };
    }
    return state;
  }

  getFile(id) {
    this.ensureOpen();
    const row = this.db.prepare("SELECT * FROM files WHERE id = ?").get(id);
    if (!row) throw new ProductError("File was not found", { code: "NOT_FOUND", status: 404 });
    return mapFile(row);
  }

  createTodo(input) {
    const { body } = requiredObject(input);
    const normalizedBody = requiredBody(body);
    const now = this.clock();
    const id = randomUUID();
    const first = this.db.prepare(`
      SELECT MIN(sort_order) AS first_order FROM todos WHERE completed_at IS NULL
    `).get().first_order;
    const order = first == null ? 0 : first - ORDER_STEP;
    const { revision } = this.mutate("todo:created", () => {
      this.db.prepare(`
        INSERT INTO todos (id, body, sort_order, created_at, updated_at, completed_at)
        VALUES (?, ?, ?, ?, ?, NULL)
      `).run(id, normalizedBody, order, now, now);
    });
    return { item: mapTodo(this.db.prepare("SELECT * FROM todos WHERE id = ?").get(id)), revision };
  }

  updateTodo(id, input) {
    const changes = requiredChanges(input, TODO_CHANGE_FIELDS);
    const current = this.db.prepare("SELECT * FROM todos WHERE id = ?").get(id);
    if (!current) throw new ProductError("Todo was not found", { code: "NOT_FOUND", status: 404 });
    const now = this.clock();
    const body = Object.hasOwn(changes, "body") ? requiredBody(changes.body) : current.body;
    let completedAt = current.completed_at;
    let order = current.sort_order;
    if (Object.hasOwn(changes, "completed")) {
      if (typeof changes.completed !== "boolean") {
        throw new ProductError("completed must be a boolean", { code: "INVALID_COMPLETED" });
      }
      if (changes.completed && completedAt == null) completedAt = now;
      if (!changes.completed && completedAt != null) {
        completedAt = null;
        const first = this.db.prepare(`
          SELECT MIN(sort_order) AS first_order FROM todos WHERE completed_at IS NULL
        `).get().first_order;
        order = first == null ? 0 : first - ORDER_STEP;
      }
    }
    const { revision } = this.mutate("todo:updated", () => {
      this.db.prepare(`
        UPDATE todos SET body = ?, sort_order = ?, updated_at = ?, completed_at = ? WHERE id = ?
      `).run(body, order, now, completedAt, id);
    });
    return { item: mapTodo(this.db.prepare("SELECT * FROM todos WHERE id = ?").get(id)), revision };
  }

  reorderTodos(ids) {
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      throw new ProductError("ids must be an array of Todo ids", { code: "INVALID_ORDER" });
    }
    const activeIds = this.db.prepare(`
      SELECT id FROM todos WHERE completed_at IS NULL ORDER BY sort_order ASC, created_at DESC
    `).all().map((row) => row.id);
    const requestedIds = new Set(ids);
    if (ids.length !== activeIds.length || requestedIds.size !== ids.length
      || activeIds.some((id) => !requestedIds.has(id))) {
      throw new ProductError("Order must contain every active Todo exactly once", {
        code: "INVALID_ORDER",
      });
    }
    const now = this.clock();
    const { revision } = this.mutate("todo:reordered", () => {
      const update = this.db.prepare("UPDATE todos SET sort_order = ?, updated_at = ? WHERE id = ?");
      ids.forEach((id, index) => update.run(index * ORDER_STEP, now, id));
    });
    return { revision };
  }

  deleteTodo(id) {
    if (!this.db.prepare("SELECT 1 FROM todos WHERE id = ?").get(id)) {
      throw new ProductError("Todo was not found", { code: "NOT_FOUND", status: 404 });
    }
    const { result, revision } = this.mutate("todo:deleted", () => (
      this.db.prepare("DELETE FROM todos WHERE id = ?").run(id).changes
    ));
    if (!result) throw new Error("Todo disappeared during single-writer deletion");
    return { revision };
  }

  clearCompletedTodos() {
    const completed = this.db.prepare("SELECT COUNT(*) AS count FROM todos WHERE completed_at IS NOT NULL").get().count;
    if (completed === 0) return { revision: this.revision, removed: 0 };
    const { result, revision } = this.mutate("todo:completed-cleared", () => (
      this.db.prepare("DELETE FROM todos WHERE completed_at IS NOT NULL").run().changes
    ));
    return { revision, removed: result };
  }

  createPrompt(input) {
    const { title = "", body } = requiredObject(input);
    const normalizedBody = requiredBody(body);
    const normalizedTitle = optionalTitle(title);
    const now = this.clock();
    const id = randomUUID();
    const { revision } = this.mutate("prompt:created", () => {
      this.db.prepare(`
        INSERT INTO prompts (id, title, body, starred, created_at, updated_at, last_used_at)
        VALUES (?, ?, ?, 0, ?, ?, ?)
      `).run(id, normalizedTitle, normalizedBody, now, now, now);
    });
    return { item: mapPrompt(this.db.prepare("SELECT * FROM prompts WHERE id = ?").get(id)), revision };
  }

  updatePrompt(id, input) {
    const changes = requiredChanges(input, PROMPT_CHANGE_FIELDS);
    const current = this.db.prepare("SELECT * FROM prompts WHERE id = ?").get(id);
    if (!current) throw new ProductError("Prompt was not found", { code: "NOT_FOUND", status: 404 });
    const editing = Object.hasOwn(changes, "title") || Object.hasOwn(changes, "body");
    const title = Object.hasOwn(changes, "title") ? optionalTitle(changes.title) : current.title;
    const body = Object.hasOwn(changes, "body") ? requiredBody(changes.body) : current.body;
    let starred = Boolean(current.starred);
    if (Object.hasOwn(changes, "starred")) {
      if (typeof changes.starred !== "boolean") {
        throw new ProductError("starred must be a boolean", { code: "INVALID_STAR" });
      }
      starred = changes.starred;
    }
    const now = this.clock();
    const lastUsedAt = editing ? now : current.last_used_at;
    const { revision } = this.mutate(editing ? "prompt:edited" : "prompt:starred", () => {
      this.db.prepare(`
        UPDATE prompts
        SET title = ?, body = ?, starred = ?, updated_at = ?, last_used_at = ?
        WHERE id = ?
      `).run(title, body, Number(starred), now, lastUsedAt, id);
    });
    return { item: mapPrompt(this.db.prepare("SELECT * FROM prompts WHERE id = ?").get(id)), revision };
  }

  markPromptUsed(id, input) {
    const { action, success } = requiredObject(input);
    if (!new Set(["copy", "insert"]).has(action) || success !== true) {
      throw new ProductError("A successful copy or insert action is required", {
        code: "INVALID_USE",
      });
    }
    if (!this.db.prepare("SELECT 1 FROM prompts WHERE id = ?").get(id)) {
      throw new ProductError("Prompt was not found", { code: "NOT_FOUND", status: 404 });
    }
    const now = this.clock();
    const { revision } = this.mutate(`prompt:${action}`, () => {
      this.db.prepare("UPDATE prompts SET last_used_at = ? WHERE id = ?").run(now, id);
    });
    return { revision };
  }

  deletePrompt(id) {
    if (!this.db.prepare("SELECT 1 FROM prompts WHERE id = ?").get(id)) {
      throw new ProductError("Prompt was not found", { code: "NOT_FOUND", status: 404 });
    }
    const { result, revision } = this.mutate("prompt:deleted", () => (
      this.db.prepare("DELETE FROM prompts WHERE id = ?").run(id).changes
    ));
    if (!result) throw new Error("Prompt disappeared during single-writer deletion");
    return { revision };
  }

  async addFiles(input) {
    const { paths } = requiredObject(input);
    if (!Array.isArray(paths) || paths.length === 0 || paths.some((entry) => typeof entry !== "string")) {
      throw new ProductError("paths must contain one or more absolute file paths", {
        code: "INVALID_PATHS",
      });
    }
    const inspected = await mapWithConcurrency(paths, DEFAULT_FILE_ADD_CONCURRENCY, async (requestedPath) => {
      try {
        if (!path.isAbsolute(requestedPath)) {
          throw new ProductError("Only absolute paths can be pinned", { code: "PATH_NOT_ABSOLUTE" });
        }
        const canonicalPath = await realpath(requestedPath);
        const info = await stat(canonicalPath);
        if (!info.isFile()) {
          throw new ProductError("Folders cannot be pinned; choose regular files", {
            code: "DIRECTORY_NOT_ALLOWED",
          });
        }
        return { accepted: { canonicalPath, size: info.size } };
      } catch (error) {
        return { rejected: {
          path: requestedPath,
          code: error instanceof ProductError ? error.code : "FILE_UNAVAILABLE",
          message: error instanceof ProductError ? error.message : "The file is unavailable",
        } };
      }
    });
    const accepted = new Map();
    const rejected = [];
    for (const result of inspected) {
      if (result.accepted) accepted.set(result.accepted.canonicalPath, result.accepted);
      else rejected.push(result.rejected);
    }

    const now = this.clock();
    const addedIds = [];
    const existingIds = [];
    let revision = this.revision;
    if (accepted.size > 0) {
      const newEntries = [];
      for (const entry of accepted.values()) {
        const existing = this.db.prepare("SELECT id FROM files WHERE canonical_path = ?").get(entry.canonicalPath);
        if (existing) existingIds.push(existing.id);
        else newEntries.push({ ...entry, id: randomUUID() });
      }
      if (newEntries.length > 0) {
        ({ revision } = this.mutate("file:added", () => {
          const insert = this.db.prepare(`
            INSERT INTO files
              (id, canonical_path, display_name, mime_type, size, added_at, last_called_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          for (const entry of newEntries) {
            insert.run(
              entry.id,
              entry.canonicalPath,
              path.basename(entry.canonicalPath),
              mimeTypeFor(entry.canonicalPath),
              entry.size,
              now,
              now,
            );
            addedIds.push(entry.id);
          }
        }));
      }
    }

    const select = this.db.prepare("SELECT * FROM files WHERE id = ?");
    return {
      added: addedIds.map((id) => mapFile(select.get(id))),
      existing: existingIds.map((id) => mapFile(select.get(id))),
      rejected,
      revision,
    };
  }

  async markFileUsed(id, input) {
    const { action, success } = requiredObject(input);
    if (!new Set(["attach", "insert-path"]).has(action) || success !== true) {
      throw new ProductError("A successful attachment or path insertion is required", {
        code: "INVALID_USE",
      });
    }
    const current = this.db.prepare("SELECT * FROM files WHERE id = ?").get(id);
    if (!current) throw new ProductError("File was not found", { code: "NOT_FOUND", status: 404 });
    try {
      const info = await stat(current.canonical_path);
      if (!info.isFile()) throw Object.assign(new Error("Not a regular file"), { code: "ENOENT" });
    } catch (error) {
      if (isConfirmedMissing(error)) {
        this.mutate("file:missing-removed", () => {
          this.db.prepare("DELETE FROM files WHERE id = ?").run(id);
        });
        throw new ProductError("The source file no longer exists and was removed", {
          code: "FILE_MISSING",
          status: 410,
        });
      }
      throw error;
    }
    const now = this.clock();
    const { revision } = this.mutate(`file:${action}`, () => {
      this.db.prepare("UPDATE files SET last_called_at = ? WHERE id = ?").run(now, id);
    });
    return { revision };
  }

  deleteFile(id) {
    if (!this.db.prepare("SELECT 1 FROM files WHERE id = ?").get(id)) {
      throw new ProductError("File was not found", { code: "NOT_FOUND", status: 404 });
    }
    const { result, revision } = this.mutate("file:deleted", () => (
      this.db.prepare("DELETE FROM files WHERE id = ?").run(id).changes
    ));
    if (!result) throw new Error("File disappeared during single-writer deletion");
    return { revision };
  }
}
