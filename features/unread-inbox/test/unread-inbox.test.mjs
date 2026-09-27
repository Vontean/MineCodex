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
  const read = new Function(`${source.slice(source.indexOf('function isUnread('), source.indexOf('function projectForRow('))};return {isUnread,isWorking};`)();
  const row=(type,unread)=>({__reactFiberFixture:{memoizedProps:{statusState:{type},isUnread:unread}}});
  assert.equal(read.isUnread(row('idle',true)),true);
  assert.equal(read.isWorking(row('loading',false)),true);
  assert.equal(read.isWorking(row('loading',true)),true);
  assert.equal(read.isUnread(row('idle',false)),false);
});


test('union of working, unread and recently opened sorts only by message time', () => {
  const sort = new Function(source.slice(source.indexOf('function selectThreads('), source.indexOf('function captureCurrentRow(')) + ';return selectThreads;')();
  const rows = [{key:'current', timestamp:100}, {key:'unread', unread:true, timestamp:300},
    {key:'working',working:true,timestamp:400},{key:'expired',timestamp:500}];
  const recent = new Map([['current',5000],['expired',0]]);
  assert.deepEqual(sort(rows,recent,3600001).map(r=>r.key),['working','unread','current']);
});

test('recent records keep native navigation after React unmounts the source row', () => {
  let calls = 0;
  const record = new Function('threadDetails','isUnread',source.slice(source.indexOf('function threadRecord('),source.indexOf('function selectThreads('))+';return threadRecord;')(
    () => ({title:'Recent task',timestamp:100}), () => false);
  const row = {dataset:{appActionSidebarThreadId:'local:one'},__reactFiberFixture:{memoizedProps:{statusState:{type:'idle'},onClick:()=>calls++}}};
  const item = record(row);
  delete row.__reactFiberFixture;
  item.activate();
  assert.equal(calls,1);
  assert.equal(item.title,'Recent task');
  assert.equal(Object.values(item).includes(row),false);
});

test('missing current identity clears selection and lets recent entries expire', () => {
  let selected = {dataset:{appActionSidebarThreadId:'local:one'}}, id = 'one', now = 100;
  const doc = {querySelector:s=>s.includes('thread-selected') ? selected : id ? {getAttribute:()=>id} : null};
  const run = new Function('document','Date','threadRecord',`let selectedKey=null;const recentRows=new Map(),openedAt=new Map(),messageUpdates=new Map();
    ${source.slice(source.indexOf('function captureCurrentRow('),source.indexOf('function projectForRow('))}
    return {captureCurrentRow,openedAt,recentRows,key:()=>selectedKey};`)(doc,{now:()=>now},row=>({key:row.dataset.appActionSidebarThreadId}));
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
    const selectedKey='one';let signature='';const close=()=>{};
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
