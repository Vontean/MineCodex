import { loadMarkdownListAPI, installMarkdownLists } from './lists.mjs';
import { loadNativeMarkdownLinks, installMarkdownLinks } from './links.mjs';
import { installMarkdownTables } from './tables.mjs';
import { loadNativeMarkdownToc } from './toc-native.mjs';
import { installMarkdownToc } from './toc.mjs';
import { loadNativeMarkdownTableActions, installMarkdownTableActions } from './table-actions.mjs';
import { loadNativeMarkdownRichText, installMarkdownRichText } from './rich-text.mjs';
import { installMarkdownMermaid } from './mermaid.mjs';

// 每个 Preview 共用换行状态，虚拟滚动重挂载的块也读取当前值。
export function createMarkdownWrapState() {
  let enabled = true;
  const listeners = new Set();
  return {
    get: () => enabled,
    toggle() {
      enabled = !enabled;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// 原生能力加载与会话寿命归 Adapter；入口只持有检查结果和释放动作。
export function createMarkdownReadingRuntime(
  codex,
  capabilities = {
    loadMarkdownListAPI,
    installMarkdownLists,
    loadNativeMarkdownLinks,
    installMarkdownLinks,
    installMarkdownTables,
    loadNativeMarkdownToc,
    installMarkdownToc,
    loadNativeMarkdownTableActions,
    installMarkdownTableActions,
    loadNativeMarkdownRichText,
    installMarkdownRichText,
    installMarkdownMermaid,
    installMarkdownMetadataScroll,
  },
  resources = {},
) {
  const cached = new Map();
  function load(name, ...args) {
    if (!cached.has(name)) {
      const pending = Promise.resolve().then(() => capabilities[name](...args));
      cached.set(name, pending);
      pending.catch(() => {
        if (cached.get(name) === pending) cached.delete(name);
      });
    }
    return cached.get(name);
  }
  function attach({ editor, content, scroller }) {
    const view = content.cmTile?.view;
    const wrapState = createMarkdownWrapState();
    const states = new Map([
      ['markdown-reading-layout', 'loading'],
      ['markdown-reading-links', 'loading'],
      ['markdown-reading-toc', 'loading'],
      ['markdown-table-actions', 'loading'],
      ['markdown-reading-rich-text', 'loading'],
      ['markdown-reading-mermaid', 'loading'],
    ]);
    const cleanups = [capabilities.installMarkdownMetadataScroll(editor, scroller)];
    let disposed = false;
    const current = () => !disposed && !view?.destroyed;
    function report(name, available, reason = null) {
      if (!current()) return;
      states.set(name, available ? 'available' : 'unavailable');
      codex.report(name, available, reason);
    }
    async function stage(name, reason, run) {
      try {
        await run();
      } catch {
        report(name, false, reason);
      }
    }
    async function installLinks(api) {
      await stage('markdown-reading-links', 'native-link-adapter-unavailable', async () => {
        const openHref = await load('loadNativeMarkdownLinks');
        if (!current()) return;
        cleanups.push(capabilities.installMarkdownLinks(view, api, openHref));
        report('markdown-reading-links', true);
      });
    }
    async function installRichText(api, actions) {
      await stage('markdown-reading-rich-text', 'native-rich-text-unavailable', async () => {
        const rich = await load('loadNativeMarkdownRichText', actions);
        if (!current()) return;
        cleanups.push(capabilities.installMarkdownRichText(view, api, rich, codex, wrapState));
        report('markdown-reading-rich-text', true);
      });
    }
    async function installActions(api, toc, tables) {
      await stage('markdown-table-actions', 'native-table-actions-unavailable', async () => {
        const actions = await load('loadNativeMarkdownTableActions', toc);
        if (!current()) return;
        cleanups.push(capabilities.installMarkdownTableActions(view, actions, codex, tables.controller));
        report('markdown-table-actions', true);
        await stage('markdown-reading-mermaid', 'native-mermaid-adapter-unavailable', async () => {
          const cleanup = capabilities.installMarkdownMermaid(view, api, actions, codex, resources,
            available => report('markdown-reading-mermaid', available, available ? null : 'qv-renderer-not-ready'));
          cleanups.push(cleanup);
          report('markdown-reading-mermaid', cleanup.available?.() ?? true);
        });
        await installRichText(api, actions);
      });
    }
    async function installToc(api, tables) {
      await stage('markdown-reading-toc', 'native-page-toc-unavailable', async () => {
        const toc = await load('loadNativeMarkdownToc');
        if (!current()) return;
        cleanups.push(capabilities.installMarkdownToc(view, api, toc, codex));
        report('markdown-reading-toc', true);
        await installActions(api, toc, tables);
      });
    }
    async function start() {
      if (!view || view.dom !== editor || !view.state.tree) {
        report('markdown-reading-layout', false, 'native-markdown-view-unavailable');
        return;
      }
      await stage('markdown-reading-layout', 'native-markdown-list-api-unavailable', async () => {
        const api = await capabilities.loadMarkdownListAPI(view);
        if (!current()) return;
        cleanups.push(capabilities.installMarkdownLists(view, api));
        const tables = capabilities.installMarkdownTables(view, api, wrapState);
        cleanups.push(tables);
        report('markdown-reading-layout', true);
        await Promise.all([installLinks(api), installToc(api, tables)]);
      });
    }
    const ready = start();
    return {
      ready,
      checks: () => [...states].map(([name, state]) => ({ name, available: state === 'available' })),
      dispose() {
        if (disposed) return;
        disposed = true;
        // 先释放依赖方，再移除其所依赖的装饰和滚动控制器。
        for (const cleanup of cleanups.splice(0).reverse()) cleanup();
      },
    };
  }
  return { attach };
}

// 保留 React 的兄弟节点结构，让 Metadata 与原生正文共用一个滚动位置。
export function installMarkdownMetadataScroll(editor, scroller) {
  const body = editor.parentElement?.parentElement;
  const frame = body?.parentElement;
  const metadata =
    frame && [...frame.children].find((node) => node !== body && node.matches('.max-h-80.overflow-y-auto'));
  if (!metadata) return () => {};
  frame.setAttribute('data-mcx-reading-metadata-frame', '');
  metadata.setAttribute('data-mcx-reading-metadata', '');
  function sync() {
    editor.style.setProperty('--mcx-reading-metadata-height', `${metadata.offsetHeight}px`);
    metadata.style.transform = `translateY(${-scroller.scrollTop}px)`;
  }
  const originalTransform = metadata.style.transform;
  const observer = new ResizeObserver(sync);
  observer.observe(metadata);
  scroller.addEventListener('scroll', sync, { passive: true });
  sync();
  return () => {
    observer.disconnect();
    scroller.removeEventListener('scroll', sync);
    metadata.style.transform = originalTransform;
    metadata.removeAttribute('data-mcx-reading-metadata');
    frame.removeAttribute('data-mcx-reading-metadata-frame');
    editor.style.removeProperty('--mcx-reading-metadata-height');
  };
}
