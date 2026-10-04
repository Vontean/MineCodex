import { readFile } from 'node:fs/promises';
import { fileNavigationPath, selectFileNavigationDirectory } from './domain/navigation.mjs';
import { loadFileNavigationModules } from './adapters/codex/modules.mjs';
import { createFileNavigationAdapter } from './adapters/codex/navigation.mjs';
import { installFileNavigation } from './frontend/navigation.mjs';
export async function createPageScriptSource() {
  const bindings = [fileNavigationPath, selectFileNavigationDirectory, loadFileNavigationModules, createFileNavigationAdapter, installFileNavigation];
  return bindings.map(fn => `const ${fn.name} = ${fn.toString()};`).join('\n') + '\n' + await readFile(new URL('./entry.mjs', import.meta.url), 'utf8');
}
