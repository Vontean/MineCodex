import { readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
// Codex 的项目目录与数据库结构在此转换为插件目录快照。
export class CodexCatalog {
  constructor(codexHome) { this.codexHome=codexHome; this.status={available:false,reason:"not-read"}; }
  diagnostics() {return {...this.status};}
  async snapshot() {
    let state;
    try { state = JSON.parse(await readFile(path.join(this.codexHome, ".codex-global-state.json"), "utf8")); }
    catch (error) { if (error.code === "ENOENT") {this.status={available:false,reason:"catalog-state-unavailable"};return { projects: [], threads: [] };} throw error; }
    this.status={available:true,reason:null};
    const projects = Object.entries(state["local-projects"] ?? {}).map(([id, p]) => ({ id, name: p.name || id, rootPaths: (p.rootPaths ?? []).filter(r => typeof r === "string") }));
    const ids = new Set(state["projectless-thread-ids"] ?? []);
    let threads = [];
    if (ids.size) {
      let db;
      try {
        db = new DatabaseSync(path.join(this.codexHome, "state_5.sqlite"), { readOnly: true });
        threads = db.prepare("SELECT id, title, name FROM threads WHERE archived = 0 ORDER BY updated_at DESC").all().filter(t => ids.has(t.id)).map(t => ({ id: t.id, title: t.name || t.title || t.id }));
      } catch (error) { if (!/unable to open database/i.test(error.message)) throw error; this.status={available:false,reason:"thread-database-unavailable"}; }
      finally { db?.close(); }
    }
    return { projects, threads };
  }
}
