import { seedDefaultPrompts } from "./default-prompts.mjs";
import { migratePromptSchema } from "./prompt-schema.mjs";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, open as openFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import nativePromptIcons from "../../assets/native-prompt-icons.json" with { type: "json" };
const PROMPT_CATEGORY_ICONS = new Set(Object.keys(nativePromptIcons));

const PROMPT_CHANGE_FIELDS = new Set([
  "title",
  "body",
  "categoryId",
  "emoji",
  "sortOrder",
]);

export class ProductError extends Error {
  constructor(
    message,
    { code = "INVALID_REQUEST", status = 400, details = null } = {},
  ) {
    super(message);
    this.name = "ProductError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function requiredBody(value, field = "body") {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProductError(`${field} must contain text`, {
      code: "EMPTY_BODY",
    });
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
    throw new ProductError(`${field} must be a JSON object`, {
      code: "INVALID_BODY",
    });
  }
  return value;
}

function requiredChanges(value, allowedFields) {
  const changes = requiredObject(value, "changes");
  const fields = Object.keys(changes);
  if (
    fields.length === 0 ||
    fields.some((field) => !allowedFields.has(field))
  ) {
    throw new ProductError("changes must contain only supported fields", {
      code: "INVALID_CHANGES",
      details: { allowedFields: [...allowedFields] },
    });
  }
  return changes;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    categoryId: row.category_id,
    emoji: row.emoji,
    sortOrder: row.sort_order,
    useCount: row.use_count,
    calledAt: row.called_at,
  };
}

export class CodexNotesProduct {
  constructor({ databasePath, clock = () => Date.now() }) {
    if (!databasePath) throw new Error("databasePath is required");
    this.databasePath = databasePath;
    this.clock = clock;
    this.db = null;
  }

  async open() {
    await mkdir(path.dirname(this.databasePath), {
      recursive: true,
      mode: 0o700,
    });
    const databaseFile = await openFile(this.databasePath, "a", 0o600);
    await databaseFile.close();
    await chmod(this.databasePath, 0o600);
    this.db = new DatabaseSync(this.databasePath);
    this.db.exec(
      "PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000; PRAGMA foreign_keys = ON;",
    );
    try {
      migratePromptSchema(this.db);
      seedDefaultPrompts(this.db, this.clock());
    } catch (error) {
      this.close();
      throw error;
    }
    return this;
  }

  listPromptCategories() {
    return this.db
      .prepare(
        "SELECT id, name, icon, color, sort_order AS sortOrder FROM prompt_categories ORDER BY sort_order, id",
      )
      .all();
  }

  promptMetadata(input, current = {}) {
    const categoryId = Object.hasOwn(input, "categoryId")
      ? input.categoryId
      : (current.category_id ?? null);
    if (
      categoryId !== null &&
      (typeof categoryId !== "string" ||
        !this.db
          .prepare("SELECT 1 FROM prompt_categories WHERE id = ?")
          .get(categoryId))
    ) {
      throw new ProductError("Category was not found");
    }
    const emoji = Object.hasOwn(input, "emoji")
      ? input.emoji
      : (current.emoji ?? "");
    if (
      typeof emoji !== "string" ||
      (emoji !== "" &&
        ([
          ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
            emoji,
          ),
        ].length !== 1 ||
          !/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(
            emoji,
          )))
    ) {
      throw new ProductError("Choose one emoji or leave it empty");
    }
    const sortOrder = Object.hasOwn(input, "sortOrder")
      ? input.sortOrder
      : (current.sort_order ??
        this.db
          .prepare(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM prompts",
          )
          .get().next);
    if (!Number.isSafeInteger(sortOrder) || sortOrder < 0)
      throw new ProductError("Invalid sort order");
    return { categoryId, emoji, sortOrder };
  }

  savePromptCategory(id, input) {
    requiredObject(input);
    const current = id
      ? this.db.prepare("SELECT * FROM prompt_categories WHERE id = ?").get(id)
      : null;
    if (id && !current)
      throw new ProductError("Category was not found", { status: 404 });
    const name = input.name ?? current?.name;
    const icon = input.icon ?? current?.icon ?? "book";
    const color = input.color ?? current?.color ?? "black";
    const sortOrder =
      input.sortOrder ??
      current?.sort_order ??
      this.listPromptCategories().length;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 60 ||
      !PROMPT_CATEGORY_ICONS.has(icon) ||
      ![
        "black",
        "blue",
        "green",
        "orange",
        "pink",
        "purple",
        "red",
        "yellow",
      ].includes(color) ||
      !Number.isSafeInteger(sortOrder) ||
      sortOrder < 0
    )
      throw new ProductError("Invalid category");
    const categoryId = id ?? randomUUID();
    const { revision } = this.mutate(() => {
      this.db
        .prepare(
          `INSERT INTO prompt_categories VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, icon=excluded.icon, color=excluded.color, sort_order=excluded.sort_order`,
        )
        .run(categoryId, name.trim(), icon, color, sortOrder);
    });
    return {
      revision,
      item: this.listPromptCategories().find((item) => item.id === categoryId),
    };
  }

  deletePromptCategory(id) {
    const { revision } = this.mutate(() => {
      this.db.prepare("DELETE FROM prompt_categories WHERE id = ?").run(id);
    });
    return { revision };
  }

  reorderPrompts(input) {
    const {
      ids,
      categoryId = null,
      categories = false,
    } = requiredObject(input);
    if (
      typeof categories !== "boolean" ||
      (categoryId !== null && typeof categoryId !== "string")
    )
      throw new ProductError("Invalid order");
    if (
      !Array.isArray(ids) ||
      ids.some((id) => typeof id !== "string") ||
      new Set(ids).size !== ids.length
    ) {
      throw new ProductError("Invalid order");
    }
    const expected = categories
      ? this.listPromptCategories().map((item) => item.id)
      : this.db
          .prepare("SELECT id FROM prompts WHERE category_id IS ?")
          .all(categoryId)
          .map((row) => row.id);
    if (
      expected.length !== ids.length ||
      expected.some((id) => !ids.includes(id))
    )
      throw new ProductError("Items changed; refresh and try again");
    const { revision } = this.mutate(() => {
      const statement = this.db.prepare(
        `UPDATE ${categories ? "prompt_categories" : "prompts"} SET sort_order = ? WHERE id = ?`,
      );
      ids.forEach((id, index) => statement.run(index, id));
    });
    return { revision };
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
    return this.db
      .prepare("SELECT value FROM metadata WHERE key = 'revision'")
      .get().value;
  }

  mutate(operation) {
    this.ensureOpen();
    this.db.exec("BEGIN IMMEDIATE");
    let result;
    let revision;
    try {
      result = operation();
      this.db
        .prepare("UPDATE metadata SET value = value + 1 WHERE key = 'revision'")
        .run();
      revision = this.revision;
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return { result, revision };
  }

  getState() {
    this.ensureOpen();
    return {
      revision: this.revision,
      prompts: this.db
        .prepare(
          "SELECT * FROM prompts ORDER BY sort_order, created_at DESC, id",
        )
        .all()
        .map(mapPrompt),
      categories: this.listPromptCategories(),
    };
  }

  createPrompt(input) {
    const { title = "", body } = requiredObject(input);
    const normalizedBody = requiredBody(body);
    const normalizedTitle = optionalTitle(title);
    const metadata = this.promptMetadata(input);
    const now = this.clock();
    const id = randomUUID();
    const { revision } = this.mutate(() => {
      this.db
        .prepare(
          `
        INSERT INTO prompts (id, title, body, starred, created_at, updated_at, last_used_at, category_id, emoji, sort_order)
        VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          id,
          normalizedTitle,
          normalizedBody,
          now,
          now,
          now,
          metadata.categoryId,
          metadata.emoji,
          metadata.sortOrder,
        );
    });
    return {
      item: mapPrompt(
        this.db.prepare("SELECT * FROM prompts WHERE id = ?").get(id),
      ),
      revision,
    };
  }

  updatePrompt(id, input) {
    const changes = requiredChanges(input, PROMPT_CHANGE_FIELDS);
    const current = this.db
      .prepare("SELECT * FROM prompts WHERE id = ?")
      .get(id);
    if (!current)
      throw new ProductError("Prompt was not found", {
        code: "NOT_FOUND",
        status: 404,
      });
    const metadata = this.promptMetadata(changes, current);
    const title = Object.hasOwn(changes, "title")
      ? optionalTitle(changes.title)
      : current.title;
    const body = Object.hasOwn(changes, "body")
      ? requiredBody(changes.body)
      : current.body;
    const { revision } = this.mutate(() => {
      this.db
        .prepare(
          `
        UPDATE prompts SET title = ?, body = ?, updated_at = ?, category_id = ?, emoji = ?, sort_order = ?
        WHERE id = ?
      `,
        )
        .run(
          title,
          body,
          this.clock(),
          metadata.categoryId,
          metadata.emoji,
          metadata.sortOrder,
          id,
        );
    });
    return {
      item: mapPrompt(
        this.db.prepare("SELECT * FROM prompts WHERE id = ?").get(id),
      ),
      revision,
    };
  }

  markPromptUsed(id, input) {
    const { action, success } = requiredObject(input);
    if (!new Set(["copy", "insert"]).has(action) || success !== true) {
      throw new ProductError("A successful copy or insert action is required", {
        code: "INVALID_USE",
      });
    }
    if (!this.db.prepare("SELECT 1 FROM prompts WHERE id = ?").get(id)) {
      throw new ProductError("Prompt was not found", {
        code: "NOT_FOUND",
        status: 404,
      });
    }
    const now = this.clock();
    const { revision } = this.mutate(() => {
      this.db
        .prepare(
          "UPDATE prompts SET last_used_at = ?, use_count = use_count + ?, called_at = CASE WHEN ? THEN ? ELSE called_at END WHERE id = ?",
        )
        .run(
          now,
          Number(action === "insert"),
          Number(action === "insert"),
          now,
          id,
        );
    });
    return { revision };
  }

  deletePrompt(id) {
    if (!this.db.prepare("SELECT 1 FROM prompts WHERE id = ?").get(id)) {
      throw new ProductError("Prompt was not found", {
        code: "NOT_FOUND",
        status: 404,
      });
    }
    const { result, revision } = this.mutate(
      () => this.db.prepare("DELETE FROM prompts WHERE id = ?").run(id).changes,
    );
    if (!result)
      throw new Error("Prompt disappeared during single-writer deletion");
    return { revision };
  }
}
