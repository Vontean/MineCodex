import { loadMarkdownListAPI } from '../../../../../packages/codex-adapter/src/markdown/editor-api.mjs';
import { loadNativeMarkdownToc } from '../../../../../packages/codex-adapter/src/markdown/toc-native.mjs';
import { loadNativeMarkdownTableActions } from '../../../../../packages/codex-adapter/src/markdown/block-actions.mjs';
import { loadNativeMermaidActions } from './native.mjs';
import { installMarkdownMermaid } from './mermaid.mjs';

export function createMermaidRuntime(codex, resources, capabilities = {
  loadMarkdownListAPI, loadNativeMarkdownToc, loadNativeMarkdownTableActions,
  loadNativeMermaidActions, installMarkdownMermaid,
}) {
  let native;
  function load() {
    native ??= Promise.resolve().then(() => capabilities.loadNativeMarkdownToc())
      .then(value => capabilities.loadNativeMarkdownTableActions(value))
      .then(value => capabilities.loadNativeMermaidActions(value));
    native.catch(() => { native = null; });
    return native;
  }
  return { attach({editor, content}) {
    const view = content.cmTile?.view;
    let disposed = false, available = false, cleanup;
    const current = () => !disposed && !view?.destroyed;
    const report = value => {
      if (!current()) return;
      available = value;
      codex.report('mermaid-diagrams-renderer', value, value ? null : 'mermaid-renderer-unavailable');
    };
    const ready = (async () => {
      try {
        if (!view || view.dom !== editor || !view.state.tree) throw new Error('native-markdown-view-unavailable');
        const [api, actions] = await Promise.all([capabilities.loadMarkdownListAPI(view), load()]);
        if (!current()) return;
        cleanup = capabilities.installMarkdownMermaid(view,api,actions,codex,resources,report);
        report(cleanup.available?.() ?? true);
      } catch { report(false); }
    })();
    return { ready, checks: () => [{name:'mermaid-diagrams-renderer',available}], dispose() {
      if (disposed) return;
      disposed = true; cleanup?.();
    } };
  } };
}
