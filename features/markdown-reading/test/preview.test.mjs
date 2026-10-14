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
