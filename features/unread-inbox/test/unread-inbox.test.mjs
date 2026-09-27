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
  const read = new Function(`${source.slice(source.indexOf('function isWorking('), source.indexOf('function cacheProjectIcons('))};const messageUpdates = new Map();return threadDetails;`)();
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


test('union of working, unread and recently opened sorts only by message time', () => {
  const sort = new Function('threadDetails', source.slice(source.indexOf('function isUnread('), source.indexOf('function projectForRow(')) + ';return priorityRows;')(row=>({timestamp:row.time}));
  const row=(id,type,unread,time)=>({time,dataset:{appActionSidebarThreadId:id},__reactFiberFixture:{memoizedProps:{statusState:{type},isUnread:unread}}});
  const current=row('current','idle',false,100);
  const rows=[current,row('unread','idle',true,300),row('working','loading',false,400),row('old-read','idle',false,500),current];
  const recent=new Map([['current',5000],['old-read',0]]);
  assert.deepEqual(sort(rows,recent,3600001).map(r=>r.dataset.appActionSidebarThreadId),['working','unread','current']);
  assert.deepEqual(sort(rows,new Map(),3600001).map(r=>r.dataset.appActionSidebarThreadId),['working','unread']);
});
