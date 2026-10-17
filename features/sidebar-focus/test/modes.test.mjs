import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFocusAdapter} from '../src/adapters/codex/renderer.mjs';

const source=readFileSync(new URL('../src/sidebar-focus.mjs',import.meta.url),'utf8');

test('focus and restore are shared across modes while the entry follows the visible header',()=>{
  let mode='codex';
  const connected=new Set();
  function node(){return {isConnected:false,attrs:new Map(),firstElementChild:{cloneNode:()=>({}),innerHTML:''},getAttribute(k){return this.attrs.get(k)??null;},setAttribute(k,v){this.attrs.set(k,v);},removeAttribute(k){this.attrs.delete(k);},replaceChildren(c){this.firstElementChild=c;},addEventListener(name,callback){if(name==="click")this.click=callback;},remove(){this.isConnected=false;connected.delete(this);}};}
  const sidebar={};
  const bells=['codex','chatgpt'].map(name=>Object.assign(node(),{parentElement:sidebar,checkVisibility:()=>mode===name,cloneNode:()=>node(),after(b){b.isConnected=true;connected.add(b);}}));
  for(const bell of bells){bell.setAttribute('aria-label','View activity');bell.setAttribute('aria-pressed','false');}
  const document={querySelector:s=>s==="#app-shell-sidebar"?sidebar:null,querySelectorAll:s=>s.includes("button")?bells:[]};
  const adapter=new Function('document',`return (${createFocusAdapter.toString()})({props:()=>null,currentThreadId:()=>null});`)(document);
  const reconcile=source.slice(source.indexOf('function reconcile()'),source.indexOf('function schedule()'));
  const run=new Function('document','nativeFocus','signal','getComputedStyle',`const COLLAPSE_GLYPH='',EXPAND_GLYPH='';const text=en=>en;const states=new Map();let active=false,restoring=false,button,disposed=false,currentBell;const schedule=()=>{};const remember=()=>{};${reconcile};return {run:reconcile,button:()=>button,arm(){active=true;states.set("section:recent",true);},state:()=>({active,states:[...states]})};`)(document,adapter,{},()=>({display:'flex',columnGap:'4px'}));
  run.run();assert.equal(connected.size,1);const old=run.button();
  run.arm();mode='chatgpt';run.run();assert.equal(connected.size,1);assert.equal(run.state().active,true);assert.deepEqual(run.state().states,[["section:recent",true]]);assert.equal(run.button().getAttribute("aria-pressed"),"true");
  assert.notEqual(run.button(),old);assert.equal(old.isConnected,false);
  run.button().click();run.run();assert.equal(run.state().active,false);assert.equal(run.state().states.length,0);
  mode='codex';run.run();assert.equal(connected.size,1);assert.equal(run.state().active,false);
  assert.equal(run.button().getAttribute("aria-pressed"),"false");run.arm();
  // 同模式 React 重建入口不能丢失恢复快照。
  bells[0]=Object.assign({},bells[0]);run.run();assert.equal(run.state().active,true);
  assert.deepEqual(run.state().states,[["section:recent",true]]);assert.equal(connected.size,1);
});

test('ChatGPT selected conversation resolves its own section instead of hidden Codex selection',()=>{
  const selected={dataset:{sidebarChatgptConversationKey:'chatgpt:conversation'}};
  const chat={key:'section:recent',element:{contains:e=>e===selected,querySelector:()=>selected}};
  const document={querySelector:()=>({dataset:{appActionSidebarThreadId:'local:stale'}})};
  const adapter=new Function('document',`return (${createFocusAdapter.toString()})({props:()=>null,currentThreadId:()=>null});`)(document);
  assert.equal(adapter.target([chat])?.section,chat);
});

test('branch enumeration excludes the hidden mode before reading native callbacks',()=>{
  const section=visible=>({dataset:{appActionSidebarSectionCollapsed:'false'},checkVisibility:()=>visible});
  const current=section(true),hidden=section(false);let hiddenReads=0;
  const document={querySelectorAll:s=>s.includes('sidebar-section')?[hidden,current]:[]};
  const adapter=new Function('document','props',`return (${createFocusAdapter.toString()})({props,currentThreadId:()=>null});`)(document,(e,p)=>{if(e===hidden)hiddenReads++;const props={sectionKey:'chats',section:{threadKeys:[]}};return p(props)?props:null;});
  assert.deepEqual(adapter.branches().map(b=>b.element),[current]);assert.equal(hiddenReads,0);
});
