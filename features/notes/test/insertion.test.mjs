import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {installPromptInsertion} from '../src/adapters/codex/insertion.mjs';
import {assertPromptsRequest} from '../src/adapters/codex/requests.mjs';

function fixture() {
  const listeners = new Map(), calls = [], owner = {}, otherWindow = {};
  let focused = true, location = {path:'/thread/one',key:'one'}, subscribed;
  const makeComposer = (id='one') => ({editable:{isConnected:true},threadId:id,root:{getAttribute:()=> 'thread'}});
  let composer = makeComposer(), extra = null, duplicateOnRestore = false;
  const document = {hasFocus:()=>focused,documentElement:{},querySelectorAll:()=>[composer,extra].filter(Boolean).map(item=>item.editable),addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener(){}};
  const window = {addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener(){}};
  const navigation = {location:()=>location,subscribe:fn=>{subscribed=fn;return ()=>{};},navigate:async path=>{
    calls.push(['navigate',path]);location={path,key:'restored'};composer=makeComposer();extra=duplicateOnRestore ? makeComposer() : null;subscribed?.(location);
  }};
  const codex = {navigation:()=>navigation,composer:editable=>[composer,extra].find(item=>item && (!editable || editable===item.editable)) ?? null,
    mcpAppSource:source=>source === owner ? {connected:()=>true} : null};
  let beforeRead = async()=>{}, lastResults;
  const api = async (route) => {await beforeRead(route);calls.push(['api',route]);return {prompts:[{id:'saved',body:'Body'}]};};
  const install = vm.runInNewContext(`(${installPromptInsertion.toString()})`,{window,document,setTimeout,clearTimeout,queueMicrotask,console,
    MutationObserver:class {observe(){}disconnect(){}}});
  const controller = new AbortController();
  const bridge = install(controller.signal,{codex,api,insertText:(body,editable)=>calls.push(['insert',body,editable])});
  bridge.remember(composer);
  const send = async (source=owner, expiresAt) => {
    const results=[];lastResults=results;await listeners.get('message')({source,data:{type:'minecodex:insert-prompt',promptId:'saved',expiresAt},ports:[{postMessage:data=>results.push(data),close(){}}]});return results;
  };
  return {calls,send,owner,otherWindow,controller,bridge,results:()=>lastResults,
    focus:value=>{focused=value;listeners.get('blur')?.();},read:fn=>{beforeRead=fn;},
    global:()=>{composer.editable.isConnected=false;composer=null;location={path:'/mcp-app/plugins/minecodex/Prompt',key:'app'};},
    route:path=>{location={path,key:'changed'};subscribed?.(location);},
    replace:()=>{composer=makeComposer('different');},duplicate:()=>{duplicateOnRestore=true;}};
}
test('only the owned source window can insert, and usage follows synchronous insertion',async()=>{
  const f=fixture();assert.deepEqual(await f.send(f.otherWindow),[]);assert.equal(f.calls.length,0);
  assert.equal((await f.send())[0].ok,true);
  assert.deepEqual(f.calls.map(call=>call.slice(0,2)),[['api','/api/state'],['insert','Body'],['api','/api/prompts/saved/use']]);
});
test('global Prompt restores its own remembered chat after composer unmount',async()=>{
  const f=fixture();f.global();assert.equal((await f.send())[0].ok,true);
  assert.equal(f.calls.find(call=>call[0]==='navigate')[1],'/thread/one');
  assert.equal(f.calls.filter(call=>call[0]==='insert').length,1);
});
test('window blur, user navigation and replaced composer cancel while the prompt is loading',async()=>{
  for (const change of [f=>f.focus(false),f=>f.route('/thread/other'),f=>f.replace()]) {
    const f=fixture();f.read(async route=>{if(route==='/api/state')change(f);});
    assert.equal((await f.send())[0].error,'Input changed before insertion');
    assert.equal(f.calls.some(call=>call[0]==='insert'),false);
    assert.equal(f.calls.some(call=>call[1]?.endsWith('/use')),false);
  }
});
test('removed global insertion endpoints cannot enqueue or claim cross-window work',()=>{
  for (const route of ['/api/insertions','/api/insertions/claim','/api/insertions/result']) assert.throws(()=>assertPromptsRequest(route,'POST'));
});

test('unmounted selected composer never falls back to a different visible input',async()=>{
  const f=fixture();f.global();f.replace();assert.equal((await f.send())[0].ok,true);
  assert.equal(f.calls.find(call=>call[0]==='navigate')[1],'/thread/one');
});
test('ambiguous restored composers and expired requests cannot insert',async()=>{
  const f=fixture();f.global();f.duplicate();assert.equal((await f.send())[0].error,'Input changed before insertion');
  assert.equal(f.calls.some(call=>call[0]==='insert'),false);
  const expired=fixture();assert.equal((await expired.send(expired.owner,0))[0].error,'Input changed before insertion');
  assert.equal(expired.calls.some(call=>call[0]==='insert'),false);
});

test('successful insertion is acknowledged before a slow usage write',async()=>{
  const f=fixture();let release;
  f.read(route=>route.endsWith('/use') ? new Promise(resolve=>{release=resolve;}) : Promise.resolve());
  const pending=f.send();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.results()[0].ok,true);assert.equal(f.calls.some(call=>call[0]==='insert'),true);
  release();await pending;
});
