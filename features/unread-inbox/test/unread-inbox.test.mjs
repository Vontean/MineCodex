import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createThreadAdapter } from "../src/adapters/codex/renderer.mjs";
import { createCodexEnvironment } from "../../../packages/codex-adapter/src/renderer/environment.mjs";
const adapter=createThreadAdapter(createCodexEnvironment());
const readRow=row=>adapter.read({dataset:{},querySelector:()=>null,...row});
const source = await readFile(new URL('../src/unread-inbox.mjs', import.meta.url), 'utf8');
test('unread inbox renderer compiles', () => {
  assert.doesNotThrow(() => new Function('signal', 'config', source));
});
test('unread rows use native state, not title or summary text', () => {
  const row = value => ({__reactFiberFixture:{memoizedProps:{},return:{memoizedProps:{isUnread:value}}}});
  assert.equal(readRow(row(true)).unread, true);
  assert.equal(readRow(row(false)).unread, false);
  assert.equal(readRow({}).unread, null);
});

test('each thread keeps its own project, device and native recency time', () => {
  const row = (id, hostId='local') => ({
    dataset:{appActionSidebarThreadTitle:'Title',appActionSidebarThreadHostId:hostId},
    querySelector:()=>({textContent:'AI summary'}),
    __reactFiberFixture:{memoizedProps:{
      threadSummary:{hostId,recencyAt:1000,updatedAt:9000},
      secondaryContent:{props:{projectGroup:id ? {projectId:id,label:'Project'} : null}}
    }}
  });
  const a=readRow(row('a')), b=readRow(row('a','remote:test')), c=readRow(row(null));
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
  const row=(type,unread)=>({__reactFiberFixture:{memoizedProps:{statusState:{type},isUnread:unread}}});
  assert.equal(readRow(row('idle',true)).unread,true);
  assert.equal(readRow(row('loading',false)).working,true);
  assert.equal(readRow(row('loading',true)).working,true);
  assert.equal(readRow(row('idle',false)).unread,false);
});


test('recent records keep native navigation after React unmounts the source row', () => {
  let calls = 0;
  const row = {dataset:{appActionSidebarThreadId:'local:one',appActionSidebarThreadTitle:'Recent task'},__reactFiberFixture:{memoizedProps:{statusState:{type:'idle'},onClick:()=>calls++}}};
  const item = readRow(row);
  delete row.__reactFiberFixture;
  item.activate();
  assert.equal(calls,1);
  assert.equal(item.title,'Recent task');
  assert.equal(Object.values(item).includes(row),false);
});

test('attention labels use native input and approval contracts, not summary words', () => {
  const row = props => ({__reactFiberFixture:{memoizedProps:props}});
  assert.equal(readRow(row({statusPill:{label:{props:{id:'codex.localTaskRow.needsInput'}}}})).attention, 'input');
  assert.equal(readRow(row({chips:[{id:'awaiting-approval'}]})).attention, 'approval');
  assert.equal(readRow(row({statusPill:{label:'Needs input'},summary:'Awaiting approval'})).attention, null);
});
