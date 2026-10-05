import { loadNativeMarkdownRenderer } from './adapters/codex/markdown-native.mjs';
import { collectMarkdownFootnotes } from './domain/footnotes.mjs';
import { captureMarkdownProviders } from './adapters/codex/providers.mjs';
import {
  createMarkdownReadingRuntime,
  installMarkdownMetadataScroll,
} from './adapters/codex/reading-runtime.mjs';
import { loadNativeMarkdownRichText, installMarkdownRichText } from './adapters/codex/rich-text.mjs';
import {
  markdownExportAlias,
  loadNativeMarkdownTableActions,
  installMarkdownTableActions,
} from './adapters/codex/table-actions.mjs';
import { loadNativeMarkdownLinks, installMarkdownLinks } from './adapters/codex/links.mjs';
import { loadNativeMarkdownToc } from './adapters/codex/toc-native.mjs';
import { installMarkdownToc } from './adapters/codex/toc.mjs';
import { readFile } from 'node:fs/promises';
import { installMarkdownTables } from './adapters/codex/tables.mjs';
import { loadMarkdownListAPI, installMarkdownLists } from './adapters/codex/lists.mjs';
import { createMarkdownPreviewAdapter } from './adapters/codex/preview.mjs';
export async function createPageScriptSource() {
  const bindings = [
    collectMarkdownFootnotes,
    captureMarkdownProviders,
    createMarkdownReadingRuntime,
    createMarkdownPreviewAdapter,
    installMarkdownMetadataScroll,
    loadMarkdownListAPI,
    installMarkdownLists,
    loadNativeMarkdownLinks,
    installMarkdownLinks,
    installMarkdownTables,
    loadNativeMarkdownToc,
    installMarkdownToc,
    loadNativeMarkdownRenderer,
    markdownExportAlias,
    loadNativeMarkdownTableActions,
    installMarkdownTableActions,
    loadNativeMarkdownRichText,
    installMarkdownRichText,
  ];
  const declarations = bindings.map((binding) => `const ${binding.name} = ${binding.toString()};`).join('\n');
  const entry = await readFile(new URL('./markdown-reading.mjs', import.meta.url), 'utf8');
  return `${declarations}\n${entry}`;
}
