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

test('each thread keeps its own project, device and native recency time', () => {
  const read = new Function(`${source.slice(source.indexOf('function isWorking('), source.indexOf('function cacheProjectIcons('))};return threadDetails;`)();
  const row = (id, hostId='local') => ({
    dataset:{appActionSidebarThreadTitle:'Title',appActionSidebarThreadHostId:hostId},
    querySelector:()=>({textContent:'AI summary'}),
    __reactFiberFixture:{memoizedProps:{
      threadSummary:{hostId,recencyAt:1000,updatedAt:9000},
      secondaryContent:{props:{projectGroup:id ? {projectId:id,label:'Project'} : null}}
    }}
  });
  const a=read(row('a')), b=read(row('a','remote:test')), c=read(row(null));
  assert.deepEqual(a.project,b.project);
  assert.equal(a.timestamp,1000);
  assert.equal(b.hostId,'remote:test');
  assert.equal(c.project,null);
  assert.equal(a.summary,'AI summary');
});
test('relative time handles unknown and future times without fabricating a date',()=>{
  const get = new Function('text', `${source.slice(source.indexOf('function relativeTime('),source.indexOf('function cacheProjectIcons('))};return relativeTime;`)((en)=>en);
  assert.equal(get(null,60000),'');
  assert.equal(get(0,60000),'1m');
  assert.equal(get(0,3600000),'1h');
  assert.equal(get(0,86400000),'1d');
  assert.equal(get(70000,60000),'Just now');
});

test('priority includes working read threads and loading wins over unread time', () => {
  const read = new Function(`${source.slice(source.indexOf('function isUnread('), source.indexOf('function projectForRow('))};return {isPriority,isWorking};`)();
  const row=(type,unread)=>({__reactFiberFixture:{memoizedProps:{statusState:{type},isUnread:unread}}});
  assert.equal(read.isPriority(row('idle',true)),true);
  assert.equal(read.isPriority(row('loading',false)),true);
  assert.equal(read.isWorking(row('loading',true)),true);
  assert.equal(read.isPriority(row('idle',false)),false);
});

test('working threads sort first while preserving native order within each state', () => {
  const sort = new Function(source.slice(source.indexOf('function isUnread('), source.indexOf('function projectForRow(')) + ';return priorityRows;')();
  const row=(id,type,unread)=>({id,__reactFiberFixture:{memoizedProps:{statusState:{type},isUnread:unread}}});
  const rows=[row('done-a','idle',true),row('work-a','loading',false),row('read','idle',false),row('done-b','idle',true),row('work-b','loading',true)];
  assert.deepEqual(sort(rows).map(r=>r.id),['work-a','work-b','done-a','done-b']);
  assert.equal(rows[0].id,'done-a');
});
