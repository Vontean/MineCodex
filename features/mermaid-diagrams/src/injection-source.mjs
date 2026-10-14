import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createMarkdownPreviewAdapter } from '../../../packages/codex-adapter/src/markdown/preview.mjs';
import { loadMarkdownListAPI } from '../../../packages/codex-adapter/src/markdown/editor-api.mjs';
import { captureMarkdownProviders } from '../../../packages/codex-adapter/src/markdown/providers.mjs';
import { loadNativeMarkdownToc } from '../../../packages/codex-adapter/src/markdown/toc-native.mjs';
import { loadNativeMarkdownRenderer } from '../../../packages/codex-adapter/src/markdown/markdown-native.mjs';
import { markdownExportAlias, loadNativeMarkdownTableActions } from '../../../packages/codex-adapter/src/markdown/block-actions.mjs';
import { createQvResources, createQvFrame, readQvTheme } from './mermaid/frame.mjs';
import { exportQvDiagram, saveQvDiagram } from './mermaid/export.mjs';
import { createQvLoading } from './mermaid/loading.mjs';
import { createMarkdownMermaidControls } from './adapters/codex/mermaid-viewer.mjs';
import { installMarkdownMermaid } from './adapters/codex/mermaid.mjs';
import { loadNativeMermaidActions } from './adapters/codex/native.mjs';
import { createMermaidRuntime } from './adapters/codex/runtime.mjs';

export async function createPageScriptSource() {
  const bindings = [createMarkdownPreviewAdapter, loadMarkdownListAPI, captureMarkdownProviders,
    loadNativeMarkdownToc, loadNativeMarkdownRenderer, markdownExportAlias, loadNativeMarkdownTableActions,
    createQvResources, createQvFrame, readQvTheme, exportQvDiagram, saveQvDiagram, createQvLoading,
    createMarkdownMermaidControls, installMarkdownMermaid, loadNativeMermaidActions, createMermaidRuntime];
  const declarations = bindings.map(binding => `const ${binding.name} = ${binding.toString()};`).join('\n');
  const entry = await readFile(new URL('./mermaid-diagrams.mjs',import.meta.url),'utf8');
  return `const markdownDownloadsDirectory=${JSON.stringify(join(homedir(),'Downloads'))};\n${declarations}\n${entry}`;
}
