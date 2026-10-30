import { loadInlineFileNavigationModules } from './adapters/codex/inline-modules.mjs';
import { findCodexModule } from '../../../packages/codex-adapter/src/renderer/modules.mjs';
import { readFile } from 'node:fs/promises';
import { fileNavigationPath, selectFileNavigationDirectory } from './domain/navigation.mjs';
import { loadFileNavigationModules } from './adapters/codex/modules.mjs';
import { createFileNavigationAdapter } from './adapters/codex/navigation.mjs';
import { installFileNavigation } from './frontend/navigation.mjs';
export async function createPageScriptSource() {
  const bindings = [loadInlineFileNavigationModules,findCodexModule, fileNavigationPath, selectFileNavigationDirectory, loadFileNavigationModules, createFileNavigationAdapter, installFileNavigation];
  return bindings.map(fn => `const ${fn.name} = ${fn.toString()};`).join('\n') + '\n' + await readFile(new URL('./entry.mjs', import.meta.url), 'utf8');
}
