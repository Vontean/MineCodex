import {readFile} from 'node:fs/promises';
import {installPromptInsertion} from './adapters/codex/insertion.mjs';
export async function createPageScriptSource() {
  return `const installPromptInsertion = ${installPromptInsertion.toString()};\n${await readFile(new URL('./frontend/entry.mjs',import.meta.url),'utf8')}`;
}
