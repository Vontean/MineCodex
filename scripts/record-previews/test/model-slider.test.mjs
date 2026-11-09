import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('../model-slider.mjs', import.meta.url), 'utf8')).replace(/^import .*\n/m, '');
const rect = {x: 10, y: 10, width: 300, height: 300};
async function run({failure, invalidRestore = false} = {}) {
  const calls = [], errors = [], process = {exitCode: 0};
  let timeout, closed = false, clicks = 0;
  const recording = {close() {closed = true; calls.push('recording closed');}, async send() {calls.push('stop recording');}};
  const d = Object.fromEntries(['moveTo', 'frame', 'press', 'release', 'hideCursor'].map(name => [name, async () => {
    if (closed && name !== 'release' && name !== 'hideCursor') throw new Error('Recording closed');
  }]));
  d.click = async () => {
    if (++clicks === 3 && failure === 'selection') throw new Error('Selection failed after mutation');
    if (clicks === 3 && failure === 'timeout') timeout();
  };
  const cdp = {async evaluate(expression) {
    if (expression.startsWith('({ model:')) return {model: 'GPT 6.1 Sol', effort: '1'};
    if (expression.includes('const row =')) return true;
    return false;
  }};
  const restore = {close() {calls.push('restore closed');}, async send(method, params) {calls.push([method, params]);}, async evaluate(expression) {
    if (expression.startsWith('Boolean(')) return false;
    if (expression.includes('getBoundingClientRect')) return rect;
    return !invalidRestore;
  }};
  const context = vm.createContext({process, console: {log() {}, error: (...args) => errors.push(args)},
    setTimeout: fn => {timeout = fn; return 1;}, clearTimeout() {}, sleep: async () => {},
    connect: async () => {calls.push('restore connected'); return restore;},
    shoot: async (_, options) => {
      await options.prepare({cdp: {...cdp, ...recording}, d, rect: async () => rect, sleep: async () => {}});
      await options.act({cdp, d, rect: async () => rect, center: r => [r.x, r.y], sleep: async () => {}});
      if (failure === 'encoding') throw new Error('Encoding failed');
    },
  });
  await vm.runInContext(`(async () => {${source}\n})()`, context);
  return {calls, errors, exitCode: process.exitCode};
}
for (const failure of [undefined, 'selection', 'encoding', 'timeout']) {
  test(`recording restores model after ${failure ?? 'success'} and closes both connections`, async () => {
    const result = await run({failure});
    assert.equal(result.exitCode, failure === 'timeout' ? 2 : failure ? 1 : 0);
    assert.ok(result.calls.indexOf('recording closed') < result.calls.indexOf('restore connected'));
    assert.equal(result.calls.at(-1), 'restore closed');
    assert.ok(result.calls.some(call => Array.isArray(call) && call[0] === 'Input.insertText' && call[1].text === 'gpt 6.1 sol'));
  });
}
test('failed restoration verification reports an error and exits unsuccessfully', async () => {
  const result = await run({invalidRestore: true});
  assert.equal(result.exitCode, 1);
  assert.ok(result.errors.some(args => String(args[0]).includes('恢复模型配置失败')));
  assert.equal(result.calls.at(-1), 'restore closed');
});
