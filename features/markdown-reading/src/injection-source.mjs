import { loadMarkdownListAPI } from '../../../packages/codex-adapter/src/markdown/editor-api.mjs';
import { markdownExportAlias, loadNativeMarkdownTableActions } from '../../../packages/codex-adapter/src/markdown/block-actions.mjs';
import { loadNativeMarkdownRenderer } from '../../../packages/codex-adapter/src/markdown/markdown-native.mjs';
import { collectMarkdownFootnotes } from './domain/footnotes.mjs';
import { captureMarkdownProviders } from '../../../packages/codex-adapter/src/markdown/providers.mjs';
import {
  createMarkdownReadingRuntime,
  createMarkdownWrapState,
  installMarkdownMetadataScroll,
} from './adapters/codex/reading-runtime.mjs';
import { loadNativeMarkdownRichText, installMarkdownRichText } from './adapters/codex/rich-text.mjs';
import { installMarkdownTableActions } from './adapters/codex/table-actions.mjs';
import { loadNativeMarkdownLinks, installMarkdownLinks } from './adapters/codex/links.mjs';
import { loadNativeMarkdownToc } from '../../../packages/codex-adapter/src/markdown/toc-native.mjs';
import { installMarkdownToc } from './adapters/codex/toc.mjs';
import { readFile } from 'node:fs/promises';
import { installMarkdownTables } from './adapters/codex/tables.mjs';
import { installMarkdownLists } from './adapters/codex/lists.mjs';
import { createMarkdownPreviewAdapter } from '../../../packages/codex-adapter/src/markdown/preview.mjs';
export async function createPageScriptSource() {
  const bindings = [
    collectMarkdownFootnotes,
    captureMarkdownProviders,
    createMarkdownReadingRuntime,
    createMarkdownWrapState,
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
