import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function defaultFavoritesPath() {
  const support = process.platform === 'win32' ? path.join(process.env.APPDATA || os.homedir(), 'MineCodex') : path.join(os.homedir(), 'Library', 'Application Support', 'MineCodex');
  return process.env.MINECODEX_MODEL_DATA_FILE || path.join(support, 'model-slider', 'favorites.sqlite');
}
export function validateFavorites(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.favorites) || data.favorites.length > 10000 || data.favorites.some(id => typeof id !== 'string' || !id || id.length > 512 || /[\x00-\x1f]/.test(id))) throw new Error('Invalid model favorites');
  return { version: 1, favorites: [...new Set(data.favorites)] };
}
export class ModelFavorites {
  constructor(file = defaultFavoritesPath()) { this.file = file; }
  read() {
    if (!existsSync(this.file)) return { version: 1, favorites: [], initialized: false };
    const db = new DatabaseSync(this.file, { readOnly: true });
    try { return { version: 1, favorites: db.prepare('SELECT id FROM favorites ORDER BY id').all().map(row => row.id), initialized: Boolean(db.prepare("SELECT 1 FROM metadata WHERE key='initialized'").get()) }; }
    finally { db.close(); }
  }
  action(payload) {
    if (!payload || !['initialize','change','read','merge'].includes(payload.operation)) throw new Error('Unknown favorites operation');
    if (payload.operation === 'read') return this.read();
    const additions = validateFavorites({ version: 1, favorites: payload.add ?? [] }).favorites;
    const removals = validateFavorites({ version: 1, favorites: payload.remove ?? [] }).favorites;
    mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(this.file);
    chmodSync(this.file, 0o600);
    try {
      db.exec('PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS favorites(id TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY); BEGIN IMMEDIATE');
      const before = new Set(db.prepare('SELECT id FROM favorites').all().map(row => row.id));
      const initialized = db.prepare("SELECT 1 FROM metadata WHERE key='initialized'").get();
      let added = 0;
      if (payload.operation !== 'initialize' || !initialized) {
        for (const id of additions) { if (!before.has(id)) added++; db.prepare('INSERT OR IGNORE INTO favorites VALUES (?)').run(id); }
        if (payload.operation === 'change') for (const id of removals) db.prepare('DELETE FROM favorites WHERE id=?').run(id);
      }
      if (payload.operation === 'initialize') db.prepare("INSERT OR IGNORE INTO metadata VALUES ('initialized')").run();
      const favorites = db.prepare('SELECT id FROM favorites ORDER BY id').all().map(row => row.id);
      db.exec('COMMIT'); return { version: 1, favorites, added, duplicate: additions.length - added, conflict: 0 };
    } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
    finally { db.close(); }
  }
}
export function favoritesTransfer(file) {
  const store = new ModelFavorites(file);
  return {
    id: 'model-slider', validate: validateFavorites,
    async snapshot() { const data = store.read(); return { data: { version: 1, favorites: data.favorites }, count: data.favorites.length, excluded: 0, initialized: data.initialized }; },
    async preview(data) { const current = new Set(store.read().favorites); const added = data.favorites.filter(id => !current.has(id)).length; return { added, duplicate: data.favorites.length - added, conflict: 0 }; },
    async apply(data) { const { added, duplicate, conflict } = store.action({ operation:'merge',add:data.favorites }); return { added, duplicate, conflict }; },
  };
}
