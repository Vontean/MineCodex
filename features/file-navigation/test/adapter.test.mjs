import assert from 'node:assert/strict';
import test from 'node:test';
import { createFileNavigationAdapter } from '../src/adapters/codex/navigation.mjs';

function fixture(request) {
  const opened = [];
  const props = { root: '/workspace', activePath: 'docs/readme.md', hostId: 'remote-test', onSelectFile: (...args) => opened.push(args) };
  const button = { textContent: 'Workspace' };
  const capsule = { getBoundingClientRect: () => ({ height: 500 }) };
  const nav = { parentElement: capsule, querySelectorAll: () => [button], querySelector: selector => selector === 'button' ? button : null };
  globalThis.document = { querySelectorAll: () => [nav] };
  const adapter = createFileNavigationAdapter({ props: (_, predicate) => predicate(props) ? props : null }, async () => ({ request }));
  return { view: adapter.scan()[0], opened };
}

test('directory requests and file actions retain the current host and workspace identity', async () => {
  const requests = [];
  const { view, opened } = fixture(async (...args) => { requests.push(args); return { entries: [{ path: 'docs/other.md', type: 'file' }, { path: 'docs/examples', type: 'directory' }] }; });
  const signal = new AbortController().signal;
  const entries = await view.list('docs', signal);
  assert.deepEqual(entries, [{ path: 'docs/other.md', name: 'other.md', directory: false }, { path: 'docs/examples', name: 'examples', directory: true }]);
  assert.deepEqual(requests[0], ['workspace-directory-entries', { params: { hostId: 'remote-test', workspaceRoot: '/workspace', directoryPath: 'docs', includeHidden: true }, signal }]);
  view.open(entries[1]); assert.equal(opened.length, 0);
  view.open(entries[0]); assert.deepEqual(opened, [['/workspace/docs/other.md', { isPreview: true }]]);
});

test('closed navigation does not issue a delayed directory request; invalid responses fail explicitly', async () => {
  let calls = 0;
  const { view } = fixture(async () => { calls++; return {}; });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(view.list('', controller.signal), { name: 'AbortError' });
  assert.equal(calls, 0);
  await assert.rejects(view.list('', new AbortController().signal), /directory-contract-changed/);
});
