import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createMarkdownPreviewAdapter } from '../../../packages/codex-adapter/src/markdown/preview.mjs';
import { createPageScriptSource } from '../src/injection-source.mjs';

function fixture({ kind = 'markdown', filePanel = true, mode = true, connected = true } = {}) {
  const content = {},
    scroller = {};
  const editor = {
    isConnected: connected,
    closest: () => (filePanel ? {} : null),
    querySelector: (selector) => (selector.includes('cm-content') ? content : scroller),
  };
  const contracts = [
    { fileKind: kind, filePath: '/test.md', onSaveChange() {} },
    ...(mode ? [{ filePath: '/test.md', initialMode: 'markdown', onSourceDraftChange() {} }] : []),
  ];
  const codex = { props: (_, predicate) => contracts.find(predicate) ?? null };
  return { editor, content, scroller, adapter: createMarkdownPreviewAdapter(codex) };
}

test('only the original file-panel Markdown preview satisfies the adapter contract', () => {
  const f = fixture();
  assert.deepEqual(f.adapter.preview(f.editor), {
    editor: f.editor,
    content: f.content,
    scroller: f.scroller,
  });
  for (const options of [{ kind: 'plain' }, { filePanel: false }, { mode: false }, { connected: false }]) {
    const other = fixture(options);
    assert.equal(other.adapter.preview(other.editor), null);
  }
});

test('serialized installer executes without module scope and releases its resources', async () => {
  const source = await createPageScriptSource();
  const manifest = JSON.parse(await readFile(new URL('../codex-feature.json', import.meta.url), 'utf8'));
  const styles = await readFile(new URL(`../${manifest.entry.resources.styles}`, import.meta.url), 'utf8');
  const ownedStyles = new Set();
  let probe, observer, scheduled, cancelled;
  const document = {
    createElement: () => ({
      isConnected: false,
      setAttribute() {},
      remove() {
        this.isConnected = false;
        ownedStyles.delete(this);
      },
    }),
    head: {
      append(element) {
        element.isConnected = true;
        ownedStyles.add(element);
      },
    },
    body: {},
    querySelectorAll: () => [],
  };
  const dispose = runInNewContext(`(function(signal, config) {${source}\n})(null, config)`, {
    document,
    window: {
      requestAnimationFrame(callback) {
        scheduled = callback;
        return 7;
      },
      cancelAnimationFrame(id) {
        cancelled = id;
      },
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        observer = this;
      }
      observe() {
        this.connected = true;
      }
      disconnect() {
        this.connected = false;
      }
    },
    config: {
      codex: { report() {} },
      resources: { styles },
      registerSelfCheck(check) {
        probe = check;
      },
    },
  });
  assert.equal(ownedStyles.size, 1);
  assert.equal(probe().state, 'not-applicable');
  observer.callback([{ target: {} }]);
  assert.equal(typeof scheduled, 'function');
  dispose();
  assert.equal(cancelled, 7);
  assert.equal(observer.connected, false);
  assert.equal(ownedStyles.size, 0);
});


test('native code discovery uses the content renderer above the source-only shell', async () => {
  const { loadNativeMarkdownRichText } = await import('../src/adapters/codex/rich-text.mjs');
  const run = async (source, expected) => {
    const Shell = () => {}, Renderer = () => {};
    let initialized = 0;
    const load = runInNewContext(
      `(${loadNativeMarkdownRichText.toString().replaceAll('import(', 'importModule(')})`,
      {
        document: { querySelectorAll: () => [{ href: 'https://fixture/katex-test.js' }] },
        fetch: async () => ({ text: async () => source }),
        importModule: async (url) => url.includes('katex-')
          ? { default: { renderToString() {} } }
          : { Shell, Renderer, init: () => initialized++ },
      },
    );
    const native = await load({ sharedUrl: 'https://fixture/app-shared-test.js' });
    assert.equal(native.CodeSnippet, expected === 'renderer' ? Renderer : Shell);
    assert.equal(initialized, 1);
  };
  const shell = 'function Shell(e){let t=(0,Cache.c)(1);id:`codeSnippet.wrap.disable`;return e.source}';
  const renderer = 'function Renderer(e){let t=(0,Cache.c)(1);let {renderSvgAsImage:a,codeContainerClassName:b}=e;return jsx)(Shell,{source:code,content:e.content})}';
  const init = 'function Init(){Cache={c(){}}}';
  const exports = 'export{Shell as Shell,Renderer as Renderer,Init as init}';
  await run(shell + renderer + init + exports, 'renderer');
  // 旧版由同一个组件接收并显示 content，仍保留原有发现路径。
  await run(shell.replace('e.source', 'e.content') + init + exports, 'shell');
});
