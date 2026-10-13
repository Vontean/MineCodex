import { loadNativeMarkdownRenderer } from './adapters/codex/markdown-native.mjs';
import { collectMarkdownFootnotes } from './domain/footnotes.mjs';
import { captureMarkdownProviders } from './adapters/codex/providers.mjs';
import {
  createMarkdownReadingRuntime,
  createMarkdownWrapState,
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
import { createQvResources, createQvFrame, readQvTheme } from './mermaid/frame.mjs';
import { createMarkdownMermaidControls } from './adapters/codex/mermaid-viewer.mjs';
import { installMarkdownMermaid } from './adapters/codex/mermaid.mjs';
export async function createPageScriptSource() {
  const bindings = [
    createQvResources,
    createQvFrame,
    readQvTheme,
    createMarkdownMermaidControls,
    installMarkdownMermaid,
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
