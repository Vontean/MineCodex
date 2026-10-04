import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { migratePromptSchema } from './prompt-schema.mjs';
import nativePromptIcons from '../../assets/native-prompt-icons.json' with { type: 'json' };

const categoryFields = ['id', 'name', 'icon', 'color', 'sort_order'];
const promptFields = ['id', 'title', 'body', 'starred', 'created_at', 'updated_at', 'last_used_at', 'category_id', 'emoji', 'sort_order', 'use_count', 'called_at'];
const pick = (row, fields) => Object.fromEntries(fields.map(key => [key, row[key]]));
const equal = (a, b, fields) => fields.every(key => a[key] === b[key]);
function validateRows(rows, fields, strings, nullable = []) {
  if (!Array.isArray(rows) || rows.length > 50000) throw new Error('Invalid Prompts collection');
  const ids = new Set();
  return rows.map(row => {
    if (!row || typeof row !== 'object' || fields.some(key => {
      const value = row[key];
      return nullable.includes(key) && value === null ? false : strings.includes(key)
        ? typeof value !== 'string' || value.length > 1000000
        : !Number.isSafeInteger(value) || value < 0;
    }) || !row.id || row.id.length > 256 || ids.has(row.id)) throw new Error('Invalid or duplicate Prompt record');
    ids.add(row.id);
    return pick(row, fields);
  });
}
export function validatePrompts(data) {
  if (!data || data.version !== 1) throw new Error('Unsupported Prompts version');
  const categories = validateRows(data.categories, categoryFields, ['id','name','icon','color']);
  const prompts = validateRows(data.prompts, promptFields, ['id','title','body','category_id','emoji'], ['category_id','called_at']);
  if (categories.some(row => !row.name.trim() || row.name.length > 60 || !Object.hasOwn(nativePromptIcons,row.icon) || !['black','blue','green','orange','pink','purple','red','yellow'].includes(row.color))) throw new Error('Invalid Prompt category');
  const ids = new Set(categories.map(row => row.id));
  if (prompts.some(row => !row.body.trim() || (row.emoji !== '' && ([...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(row.emoji)].length !== 1 || !/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(row.emoji))) || ![0,1].includes(row.starred) || row.category_id !== null && !ids.has(row.category_id))) throw new Error('Invalid Prompt category reference or content');
  return { version: 1, categories, prompts };
}
function merge(current, incoming) {
  const result = { added: 0, duplicate: 0, conflict: 0, categoriesAdded: 0 };
  const categories = [...current.categories], prompts = [...current.prompts], mapping = new Map();
  const categoryKey = row => JSON.stringify([row.name,row.icon,row.color]);
  const promptKey = row => JSON.stringify([row.title,row.body,row.category_id,row.emoji]);
  const categoryIds = new Map(categories.map(row => [row.id,row]));
  const categoryContents = new Map(categories.map(row => [categoryKey(row),row]));
  const promptIds = new Map(prompts.map(row => [row.id,row]));
  const promptContents = new Set(prompts.map(promptKey));
  for (const row of incoming.categories) {
    const match = categoryIds.get(row.id) || categoryContents.get(categoryKey(row));
    mapping.set(row.id, match?.id || row.id);
    if (!match) { categories.push(row); categoryIds.set(row.id,row); categoryContents.set(categoryKey(row),row); result.categoriesAdded++; }
    else if (match.id === row.id && !equal(match, row, categoryFields.filter(key => key !== 'sort_order'))) result.conflict++;
  }
  for (const source of incoming.prompts) {
    const row = { ...source, category_id: mapping.get(source.category_id) ?? null };
    const sameId = promptIds.get(row.id);
    if (sameId) {
      result[equal(sameId, row, ['title','body','category_id','emoji']) ? 'duplicate' : 'conflict']++;
    } else if (promptContents.has(promptKey(row))) result.duplicate++;
    else { prompts.push(row); promptIds.set(row.id,row); promptContents.add(promptKey(row)); result.added++; }
  }
  return { result, data: { version: 1, categories, prompts } };
}
export function promptsTransfer(databasePath) {
  function open(write = false) {
    if (!write && !existsSync(databasePath)) return null;
    if (write) mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(databasePath, { readOnly: !write });
    db.exec('PRAGMA busy_timeout=3000');
    if (write) { chmodSync(databasePath, 0o600); migratePromptSchema(db); }
    return db;
  }
  function read(db) {
    if (!db) return { version: 1, categories: [], prompts: [] };
    const ownTransaction = !db.isTransaction;
    if (ownTransaction) db.exec('BEGIN');
    try {
      const data = { version: 1, categories: db.prepare('SELECT * FROM prompt_categories ORDER BY sort_order,id').all().map(row => pick(row, categoryFields)), prompts: db.prepare('SELECT * FROM prompts ORDER BY sort_order,id').all().map(row => pick(row, promptFields)) };
      if (ownTransaction) db.exec('COMMIT');
      return data;
    } catch (error) { if (ownTransaction && db.isTransaction) db.exec('ROLLBACK'); throw error; }
  }
  return {
    id: 'notes', validate: validatePrompts,
    async snapshot() { const db = open(); try { const data = read(db); return { data, count: data.prompts.length, categories: data.categories.length, excluded: 0 }; } finally { db?.close(); } },
    async preview(data) { const db = open(); try { return merge(read(db), data).result; } finally { db?.close(); } },
    async apply(data) {
      const db = open(true);
      try {
        db.exec('BEGIN IMMEDIATE');
        const { result, data: merged } = merge(read(db), data);
        for (const [table, rows, fields] of [['prompt_categories',merged.categories,categoryFields],['prompts',merged.prompts,promptFields]]) {
          const insert = db.prepare(`INSERT OR IGNORE INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`);
          for (const row of rows) insert.run(...fields.map(key => row[key]));
        }
        db.prepare("UPDATE metadata SET value=value+1 WHERE key='revision'").run();
        db.exec('COMMIT'); return result;
      } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
      finally { db.close(); }
    },
  };
}
