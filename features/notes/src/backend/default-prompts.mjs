import prompts from "../../assets/default-prompts.json" with { type: "json" };

// 单次导入后全部归用户管理，删除和编辑不会在下次启动时被还原。
export function seedDefaultPrompts(db, now) {
  db.exec("BEGIN IMMEDIATE");
  try {
    if (!db.prepare("SELECT 1 FROM metadata WHERE key = 'default_prompts_v1'").get()) {
      const categoryOrder = db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM prompt_categories").get().n;
      const categories = [
        ["thinking", "思考", "flask", "purple"],
        ["learning", "学习", "book", "green"],
        ["code", "编程", "terminal", "blue"],
        ["productivity", "效率", "logs", "black"],
      ];
      categories.forEach((row, i) => db.prepare("INSERT OR IGNORE INTO prompt_categories VALUES (?, ?, ?, ?, ?)").run(...row, categoryOrder + i));
      const order = db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM prompts").get().n;
      const insert = db.prepare(`INSERT INTO prompts
        (id,title,body,starred,created_at,updated_at,last_used_at,category_id,emoji,sort_order)
        VALUES (?,?,?,0,?,?,?,?,?,?)`);
      prompts.forEach((p, i) => insert.run(p.id, p.title, p.body, now, now, 0, p.categoryId, p.emoji, order + i));
      db.prepare("INSERT INTO metadata VALUES ('default_prompts_v1', 1)").run();
      db.prepare("UPDATE metadata SET value = value + 1 WHERE key = 'revision'").run();
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
