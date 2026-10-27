import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDirectoryRefreshAdapter } from '../src/adapters/codex/directories.mjs';

test('only visible, active directory queries for the exact host, root and hidden policy are refreshed', async () => {
  const original = globalThis.document;
  let directory = { root: '/work', hostId: 'local', environmentId: undefined, includeHidden: true, renderTree() {} };
  let shown = true, fetching = false;
  const anchor = { isConnected: true, closest: () => null, checkVisibility: () => shown, getClientRects: () => [{}] };
  const key = (hostId, workspaceRoot, directoryPath = null, includeHidden = true) => ['vscode', 'workspace-directory-entries', hostId, workspaceRoot,
    JSON.stringify({ hostId, workspaceRoot, directoryPath, includeHidden })];
  const query = (queryKey, active = true) => ({ queryKey, isActive: () => active,
    options: { queryFn: async () => ({ entries: [] }) },
    state: { get fetchStatus() { return fetching ? 'fetching' : 'idle'; } } });
  const queries = [query(key('local', '/work')), query(key('local', '/work', 'docs')), query(key('remote', '/work')),
    query(key('local', '/other')), query(key('local', '/work', 'collapsed'), false), query(key('local', '/work', null, false)),
    query(['workspace-text', 'local', '/work/README.md']), query(['vscode', 'workspace-directory-entries', 'invalid']),
    query(key('local', '/work', 'hidden-panel-directory'))];
  const calls = [];
  const client = { getQueryCache: () => ({ getAll: () => queries }), setQueryData: (...args) => calls.push(args) };
  const codex = { props: (_anchor, predicate) => { for (const props of [{ initialExpandedPaths: ['docs'], files: [], renderTree() {} }, directory, { value: client }]) if (predicate(props)) return props; } };
  globalThis.document = { querySelectorAll: () => [anchor, anchor] };
  try {
    const adapter = createDirectoryRefreshAdapter(codex);
    const views = adapter.scan(); assert.equal(views.length, 1); assert.equal(views[0].queries.length, 2);
    await Promise.all(views[0].queries.map(query => query.refresh()));
    assert.deepEqual(calls.map(call => call[0]), queries.slice(0, 2).map(query => query.queryKey));
    fetching = true; await views[0].queries[0].refresh(); assert.equal(calls.length, 2);
    fetching = false; directory = { ...directory, root: '/new' }; await views[0].queries[0].refresh();
    assert.equal(calls.length, 2);
    shown = false; assert.equal(adapter.scan().length, 0);
  } finally { globalThis.document = original; }
});

test('hosted environments report unavailable instead of guessing a local directory query', () => {
  const original = globalThis.document;
  const directory = { root: '/work', hostId: 'durable', environmentId: 'cloud', includeHidden: true, renderTree() {} };
  const anchor = { isConnected: true, closest: () => null, checkVisibility: () => true, getClientRects: () => [{}] };
  globalThis.document = { querySelectorAll: () => [anchor] };
  try {
    const adapter = createDirectoryRefreshAdapter({ props: (_anchor, predicate) => predicate(directory) });
    const [view] = adapter.scan(); assert.equal(view.available, false); assert.deepEqual(view.queries, []);
  } finally { globalThis.document = original; }
});

test('failed reads retain the list; aborted or superseded reads never overwrite newer native data', async () => {
  const original = globalThis.document;
  try {
    for (const scenario of ['failure', 'abort', 'newer-data', 'hidden']) {
      let release, writes = 0;
      const gate = new Promise(resolve => { release = resolve; }), controller = new AbortController();
      const query = { queryKey: ['vscode', 'workspace-directory-entries', 'local', '/work', JSON.stringify({ hostId: 'local', workspaceRoot: '/work', directoryPath: null, includeHidden: true })],
        isActive: () => true, state: { fetchStatus: 'idle', data: { entries: ['old.md'] }, dataUpdatedAt: 1 },
        options: { async queryFn() { await gate; if (scenario === 'failure') throw Error('offline'); return { entries: ['new.md'] }; } } };
      const anchor = { isConnected: true, closest: () => null, checkVisibility: () => true, getClientRects: () => [{}] };
      const directory = { root: '/work', hostId: 'local', includeHidden: true, renderTree() {} };
      const client = { getQueryCache: () => ({ getAll: () => [query] }), setQueryData() { writes++; } };
      globalThis.document = { visibilityState: 'visible', querySelectorAll: () => [anchor] };
      const adapter = createDirectoryRefreshAdapter({ props(_anchor, predicate) {
        for (const props of [directory, { value: client }]) if (predicate(props)) return props;
      } }, controller.signal);
      const pending = adapter.scan()[0].queries[0].refresh();
      if (scenario === 'abort') controller.abort();
      if (scenario === 'newer-data') query.state.dataUpdatedAt++;
      if (scenario === 'hidden') globalThis.document.visibilityState = 'hidden';
      release();
      if (scenario === 'failure') await assert.rejects(pending, /offline/); else await pending;
      assert.equal(writes, 0, scenario); assert.deepEqual(query.state.data.entries, ['old.md']);
    }
  } finally { globalThis.document = original; }
});

test('directory refresh reflects real file creation, rename and deletion without reading collapsed folders', async () => {
  const original = globalThis.document, root = await mkdtemp(path.join(os.tmpdir(), 'mcx-directory-refresh-'));
  try {
    await mkdir(path.join(root, 'expanded')); await mkdir(path.join(root, 'collapsed'));
    const directory = { root, hostId: 'local', includeHidden: true, renderTree() {} };
    const anchor = { isConnected: true, closest: () => null, checkVisibility: () => true, getClientRects: () => [{}] };
    const queries = [null, 'expanded', 'collapsed'].map(directoryPath => ({
      queryKey: ['vscode', 'workspace-directory-entries', 'local', root, JSON.stringify({ hostId: 'local', workspaceRoot: root, directoryPath, includeHidden: true })],
      isActive: () => true, state: { fetchStatus: 'idle' }, entries: null,
      options: { async queryFn() { return { entries: await readdir(path.join(root, directoryPath ?? '')) }; } },
    }));
    const client = { getQueryCache: () => ({ getAll: () => queries }), setQueryData(queryKey, data) {
      queries.find(query => query.queryKey === queryKey).entries = data.entries;
    } };
    const codex = { props(_anchor, predicate) {
      for (const props of [{ files: [], initialExpandedPaths: ['expanded'], renderTree() {} }, directory, { value: client }])
        if (predicate(props)) return props;
    } };
    globalThis.document = { querySelectorAll: () => [anchor] };
    const adapter = createDirectoryRefreshAdapter(codex);
    const refresh = () => Promise.all(adapter.scan()[0].queries.map(query => query.refresh()));
    await writeFile(path.join(root, 'expanded', 'draft.md'), '# Draft'); await refresh();
    assert.deepEqual(queries[1].entries, ['draft.md']); assert.equal(queries[2].entries, null);
    await rename(path.join(root, 'expanded', 'draft.md'), path.join(root, 'expanded', 'final.md')); await refresh();
    assert.deepEqual(queries[1].entries, ['final.md']);
    await rm(path.join(root, 'expanded', 'final.md')); await refresh(); assert.deepEqual(queries[1].entries, []);
  } finally { globalThis.document = original; await rm(root, { recursive: true, force: true }); }
});
