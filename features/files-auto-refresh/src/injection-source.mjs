import { readFile } from 'node:fs/promises';
import { createDirectoryRefreshAdapter } from './adapters/codex/directories.mjs';
import { createDirectoryRefreshLoop } from './refresh.mjs';

export async function createPageScriptSource() {
  return [createDirectoryRefreshAdapter, createDirectoryRefreshLoop].map(fn => `const ${fn.name} = ${fn.toString()};`).join('\n')
    + '\n' + await readFile(new URL('./entry.mjs', import.meta.url), 'utf8');
}
