// 迁移只涉及提示词；不读取、清理或删除历史 Todo / Files 数据。
export function migratePromptSchema(db) {
  db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      ) STRICT;
      INSERT OR IGNORE INTO metadata (key, value) VALUES ('revision', 0);

    `);

  const hasLegacyNotes = Boolean(
    db
      .prepare(
        `
      SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'notes'
    `,
      )
      .get(),
  );
  const hasPrompts = Boolean(
    db
      .prepare(
        `
      SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'prompts'
    `,
      )
      .get(),
  );
  if (hasLegacyNotes && hasPrompts) {
    throw new Error(
      "Both legacy notes and prompts tables exist; refusing an ambiguous Prompt migration",
    );
  }
  if (hasLegacyNotes) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`
          ALTER TABLE notes RENAME TO prompts;
          ALTER TABLE prompts RENAME COLUMN pinned TO starred;
          DROP INDEX IF EXISTS notes_display_order;
        `);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  db.exec(`
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        starred INTEGER NOT NULL DEFAULT 0 CHECK (starred IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_used_at INTEGER NOT NULL
      ) STRICT;


    `);
  db.exec(`
      CREATE TABLE IF NOT EXISTS prompt_categories (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL,
        color TEXT NOT NULL, sort_order INTEGER NOT NULL
      ) STRICT;
    `);
  // 只增加字段，旧提示词与历史 Todo / Files 保留；不推断过去的调用次数。
  const columns = new Set(
    db
      .prepare("PRAGMA table_info(prompts)")
      .all()
      .map((row) => row.name),
  );
  for (const [name, type] of Object.entries({
    category_id: "TEXT REFERENCES prompt_categories(id) ON DELETE SET NULL",
    emoji: "TEXT NOT NULL DEFAULT ''",
    sort_order: "INTEGER NOT NULL DEFAULT 0",
    use_count: "INTEGER NOT NULL DEFAULT 0",
    called_at: "INTEGER",
  })) {
    if (!columns.has(name))
      db.exec(`ALTER TABLE prompts ADD COLUMN ${name} ${type}`);
  }
  if (
    !db
      .prepare("SELECT 1 FROM metadata WHERE key = 'prompt_categories_seeded'")
      .get()
  ) {
    const defaults = [
      ["image", "生图", "palette", "purple"],
      ["code", "编程", "terminal", "blue"],
      ["writing", "文案", "writing", "orange"],
      ["research", "研究", "flask", "green"],
      ["translation", "翻译", "globe", "pink"],
      ["productivity", "效率", "logs", "black"],
    ];
    db.exec("BEGIN IMMEDIATE");
    try {
      defaults.forEach(([id, name, icon, color], index) =>
        db
          .prepare(
            "INSERT OR IGNORE INTO prompt_categories VALUES (?, ?, ?, ?, ?)",
          )
          .run(id, name, icon, color, index),
      );
      db.prepare(
        "INSERT INTO metadata VALUES ('prompt_categories_seeded', 1)",
      ).run();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
