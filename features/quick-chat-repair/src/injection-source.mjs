import {readFile} from 'node:fs/promises';
import {createQuickChatExitAdapter} from './adapters/codex/presence.mjs';
export async function createPageScriptSource() {
  return `const createQuickChatExitAdapter=${createQuickChatExitAdapter.toString()};\n${await readFile(new URL('./frontend/entry.mjs', import.meta.url), 'utf8')}`;
}
