import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const source = await readFile(new URL('../src/unread-inbox.mjs', import.meta.url), 'utf8');
test('unread inbox renderer compiles', () => {
  assert.doesNotThrow(() => new Function('signal', 'config', source));
});
test('unread rows use native state, not title or summary text', () => {
  const read = new Function(`${source.slice(source.indexOf('function isUnread('), source.indexOf('function close('))};return isUnread;`)();
  const row = value => ({__reactFiberFixture:{memoizedProps:{},return:{memoizedProps:{isUnread:value}}}});
  assert.equal(read(row(true)), true);
  assert.equal(read(row(false)), false);
  assert.equal(read({}), false);
});

test('unread project grouping uses IDs and preserves rows within each project', () => {
  const group = new Function(`${source.slice(source.indexOf('function projectForRow('), source.indexOf('function cacheProjectIcons('))};return groupRows;`)();
  const row = (id, name) => ({__reactFiberFixture:{memoizedProps:{secondaryContent:{props:{projectGroup:id ? {projectId:id,label:name} : null}}}}});
  const a=row('a','Project'), b=row('b','Project'), a2=row('a','Project'), other=row(null);
  const result=group([a,b,a2,other]);
  assert.equal(result.length,3);
  assert.deepEqual(result[0].rows,[a,a2]);
  assert.equal(result[1].project.id,'b');
  assert.equal(result[2].project,null);
});
