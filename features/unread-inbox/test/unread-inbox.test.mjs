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


test('activity ranks unread before working and recent idle threads', () => {
  const sort = new Function(source.slice(source.indexOf('function selectThreads('), source.indexOf('function captureCurrentRow(')) + ';return selectThreads;')();
  const rows = [{key:'current', timestamp:100}, {key:'unread', unread:true, timestamp:300},
    {key:'working',working:true,timestamp:400},{key:'expired',timestamp:500}];
  const recent = new Map([['current',5000],['expired',0]]);
  assert.deepEqual(sort(rows,recent,3600001).map(r=>r.key),['unread','working','current']);
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

test('missing current identity clears selection and lets recent entries expire', () => {
  let selected = {dataset:{appActionSidebarThreadId:'local:one'}}, id = 'one', now = 100;
  const doc = {querySelector:s=>s.includes('thread-selected') ? selected : id ? {getAttribute:()=>id} : null};
  const run = new Function('document','Date','threadRecord','config',`let selectedKey=null;const recentRows=new Map(),openedAt=new Map(),messageUpdates=new Map();
    ${source.slice(source.indexOf('function captureCurrentRow('),source.indexOf('function relativeTime('))}
    return {captureCurrentRow,openedAt,recentRows,key:()=>selectedKey};`)(doc,{now:()=>now},row=>({key:row.dataset.appActionSidebarThreadId}),{codex:{currentThreadId:()=>id}});
  run.captureCurrentRow(); selected = null;
  run.captureCurrentRow(); assert.equal(run.key(),'local:one'); // Activity 隐藏当前已读行，composer 仍提供身份。
  id = null; now += 7200000; run.captureCurrentRow();
  assert.equal(run.key(),null); assert.equal(run.recentRows.size,0); assert.equal(run.openedAt.size,0);
});

test('streaming updates retain scroll and keyboard focus while rendering loading cards', () => {
  let doc;
  class Element {
    constructor(tag) { this.tagName=tag; this.children=[]; this.dataset={}; this.scrollTop=0; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children=nodes; }
    setAttribute() {}
    addEventListener() {}
    contains(node) { return node===this || this.children.some(child=>child.contains?.(node)); }
    querySelector(selector) { return this.children.find(child=>child.className===selector.slice(1)) ?? null; }
    focus() { doc.activeElement=this; }
  }
  const panel=new Element('div');
  const records=[{key:'one',title:'Working',working:true,timestamp:1000,summary:'First',spinner:'<svg></svg>'}];
  doc={createElement:tag=>new Element(tag),querySelectorAll:()=>records,activeElement:null};
  const fragment=source.slice(source.indexOf('function renderRows('),source.indexOf('function open('));
  const render=new Function('document','panel','records',`
    const captureCurrentRow=()=>{}, threadRecord=x=>x, selectThreads=x=>x, text=x=>x, relativeTime=()=>'';
    const openedAt=new Map(),recentRows=new Map(),projectIcons=new Map(),deviceGlyphs={local:''};
    const selectedKey='one';let signature='';const close=()=>{};const syncNotification=()=>{};const activityRecords=()=>records;
    ${fragment};return renderRows;
  `)(doc,panel,records);
  render();
  const list=panel.querySelector('.mcx-thread-list');list.scrollTop=140;list.children[0].focus();
  records[0].summary='Next streamed message';render();
  const refreshed=panel.querySelector('.mcx-thread-list');
  assert.equal(refreshed.scrollTop,140);
  assert.equal(doc.activeElement,refreshed.children[0]);
  assert.equal(doc.activeElement.dataset.threadKey,'one');
});

test('attention labels use native input and approval contracts, not summary words', () => {
  const row = props => ({__reactFiberFixture:{memoizedProps:props}});
  assert.equal(readRow(row({statusPill:{label:{props:{id:'codex.localTaskRow.needsInput'}}}})).attention, 'input');
  assert.equal(readRow(row({chips:[{id:'awaiting-approval'}]})).attention, 'approval');
  assert.equal(readRow(row({statusPill:{label:'Needs input'},summary:'Awaiting approval'})).attention, null);
  const select = new Function(source.slice(source.indexOf('function selectThreads('), source.indexOf('function captureCurrentRow(')) + ';return selectThreads;')();
  assert.equal(select([{key:'waiting',attention:'input',timestamp:1}],new Map()).length,1);
});


test('needs input precedes approval, then unread, working and idle; current is excluded', () => {
  const select = new Function(source.slice(source.indexOf('function selectThreads('), source.indexOf('function captureCurrentRow(')) + ';return selectThreads;')();
  const rows = [{key:'idle',timestamp:900}, {key:'working',working:true,timestamp:800},
    {key:'unread',unread:true,timestamp:700}, {key:'approval',attention:'approval',timestamp:600},
    {key:'input',attention:'input',timestamp:500}, {key:'current',attention:'input',timestamp:1000}];
  const recent = new Map([['idle',1000]]);
  assert.deepEqual(select(rows,recent,1000,'current').map(x=>x.key), ['input','approval','unread','working','idle']);
  assert.deepEqual(select([rows[5]],recent,1000,'current'), []);
});

test('notification is red for attention, blue for unread, absent for running or idle only', () => {
  const color = new Function(source.slice(source.indexOf('function notificationColor('), source.indexOf('function selectThreads(')) + ';return notificationColor;')();
  assert.equal(color([{unread:true},{attention:'input'}]),'red');
  assert.equal(color([{attention:'approval'}]),'red');
  assert.equal(color([{unread:true}]),'blue');
  assert.equal(color([{working:true}]),null);
  assert.equal(color([]),null);
});
