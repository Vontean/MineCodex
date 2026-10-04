import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarkdownReadingRuntime } from '../src/adapters/codex/reading-runtime.mjs';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture(overrides = {}) {
  const installed = [],
    removed = [],
    reports = [],
    loads = [];
  const capabilities = {};
  for (const name of ['MetadataScroll', 'Lists', 'Links', 'Tables', 'Toc', 'TableActions', 'RichText']) {
    capabilities[`installMarkdown${name}`] = () => {
      installed.push(name);
      const cleanup = () => removed.push(name);
      if (name === 'Tables') cleanup.controller = {};
      return cleanup;
    };
  }
  for (const name of [
    'loadMarkdownListAPI',
    'loadNativeMarkdownLinks',
    'loadNativeMarkdownToc',
    'loadNativeMarkdownTableActions',
    'loadNativeMarkdownRichText',
  ]) {
    capabilities[name] = async () => {
      loads.push(name);
      return {};
    };
  }
  Object.assign(capabilities, overrides);
  const runtime = createMarkdownReadingRuntime({ report: (...args) => reports.push(args) }, capabilities);
  function attach() {
    const editor = {},
      view = { dom: editor, state: { tree: {} } };
    return { view, session: runtime.attach({ editor, content: { cmTile: { view } }, scroller: {} }) };
  }
  return { attach, installed, removed, reports, loads };
}

test('each preview owns its cleanup; native modules are shared but editor APIs are not', async () => {
  const f = fixture(),
    first = f.attach(),
    second = f.attach();
  await Promise.all([first.session.ready, second.session.ready]);
  assert.ok(first.session.checks().every((check) => check.available));
  assert.equal(f.loads.filter((name) => name === 'loadNativeMarkdownToc').length, 1);
  assert.equal(f.loads.filter((name) => name === 'loadMarkdownListAPI').length, 2);
  first.session.dispose();
  assert.equal(f.removed.length, 7);
  assert.ok(f.removed.indexOf('TableActions') < f.removed.indexOf('Tables'));
  first.session.dispose();
  assert.equal(f.removed.length, 7);
  second.session.dispose();
  assert.equal(f.removed.length, 14);
});

test('closing a preview before loading finishes never installs or reports into the next preview', async () => {
  const pending = deferred();
  const f = fixture({ loadMarkdownListAPI: () => pending.promise });
  const first = f.attach();
  first.session.dispose();
  pending.resolve({});
  await first.session.ready;
  assert.deepEqual(f.installed, ['MetadataScroll']);
  assert.deepEqual(f.removed, ['MetadataScroll']);
  assert.deepEqual(f.reports, []);
});

test('late link resolution and rich-text rejection are silent after disposal', async () => {
  const links = deferred(),
    rich = deferred(),
    started = deferred();
  const f = fixture({
    loadNativeMarkdownLinks: () => links.promise,
    loadNativeMarkdownRichText: () => {
      started.resolve();
      return rich.promise;
    },
  });
  const { session } = f.attach();
  await started.promise;
  session.dispose();
  const reports = f.reports.length;
  links.resolve(() => {});
  rich.reject(new Error('late failure'));
  await session.ready;
  assert.equal(f.reports.length, reports);
  assert.ok(!f.installed.includes('Links'));
  assert.ok(!f.installed.includes('RichText'));
});

test('failed native module can retry in a new preview without blocking base layout or links', async () => {
  let attempts = 0;
  const f = fixture({
    loadNativeMarkdownToc: async () => {
      if (++attempts === 1) throw new Error('missing module');
      return {};
    },
  });
  const first = f.attach();
  await first.session.ready;
  const checks = Object.fromEntries(first.session.checks().map((check) => [check.name, check.available]));
  assert.equal(checks['markdown-reading-toc'], false);
  assert.equal(checks['markdown-reading-layout'], true);
  assert.equal(checks['markdown-reading-links'], true);
  first.session.dispose();
  const second = f.attach();
  await second.session.ready;
  assert.ok(second.session.checks().every((check) => check.available));
  second.session.dispose();
});

test('destroyed CodeMirror view cannot receive extensions when loading completes', async () => {
  const pending = deferred();
  const f = fixture({ loadMarkdownListAPI: () => pending.promise });
  const { view, session } = f.attach();
  view.destroyed = true;
  pending.resolve({});
  await session.ready;
  assert.deepEqual(f.installed, ['MetadataScroll']);
  assert.deepEqual(f.reports, []);
  session.dispose();
});
