import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createControlServer } from '../src/control-server.mjs';
import { createNpmAdapter } from '../src/npm-adapter.mjs';

test('GUI update checks use the same configured npm registry as mcx update', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mcx-update-check-'));
  const registry = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ name: 'minecodex', 'dist-tags': { latest: '99.0.0' }, versions: { '99.0.0': { name: 'minecodex', version: '99.0.0' } } }));
  });
  await new Promise(resolve => registry.listen(0, '127.0.0.1', resolve));
  const settings = { npm_config_registry: `http://127.0.0.1:${registry.address().port}`, npm_config_cache: root, npm_config_update_notifier: 'false' };
  const previous = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  Object.assign(process.env, settings);
  let control;
  try {
    const terminalLatest = await createNpmAdapter().viewLatestVersion();
    assert.equal(terminalLatest, '99.0.0');
    control = await createControlServer({ paths: {}, token: 'test-token', runtimeManager: {}, port: 0, logger: { error() {} } });
    const response = await fetch(`${control.url}/api/update`, { headers: { Authorization: 'Bearer test-token' } });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.latest, terminalLatest);
    assert.equal(result.available, true);
  } finally {
    await control?.close();
    await new Promise(resolve => registry.close(resolve));
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});
