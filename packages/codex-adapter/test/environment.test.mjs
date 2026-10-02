import test from 'node:test';
import assert from 'node:assert/strict';
import {createCodexEnvironment} from '../src/renderer/environment.mjs';

test('thread identity belongs to visible thread composer and clears when placement changes',()=>{
  const adapter=createCodexEnvironment(),id='12345678-1234-1234-1234-123456789abc';
  let placement='thread',visible=true,hidden=false;
  const root={getAttribute:()=>placement,querySelector:selector=>selector.includes('portal') ? {getAttribute:()=>id}:null};
  const element={isConnected:true,checkVisibility:()=>visible,closest:selector=>selector.includes('composer-root') ? root : hidden ? {} : null};
  assert.equal(adapter.currentThreadId(element),id);
  placement='home';assert.equal(adapter.currentThreadId(element),null);
  assert.equal(adapter.composer(element,{threadOnly:false}).editable,element);
  assert.equal(adapter.composer(element,{threadOnly:false}).threadId,null);
  placement='thread';visible=false;assert.equal(adapter.currentThreadId(element),null);
  visible=true;hidden=true;assert.equal(adapter.currentThreadId(element),null);
  assert.equal(adapter.diagnostics()[0].available,false);
});
test('React current props prefer committed alternate and can resolve ancestor scopes',()=>{
  const adapter=createCodexEnvironment(),current={value:'current'};
  const parent={__reactProps$x:current,__reactFiber$x:{memoizedProps:{value:'stale'},alternate:{memoizedProps:current}}};
  assert.equal(adapter.props({parentElement:parent},p=>p.value==='current'),current);
  assert.equal(adapter.props({},()=>true),null);
});
test('diagnostics preserve unavailable capability separately from empty data',()=>{
  const adapter=createCodexEnvironment();adapter.report('quota',false,'account-loading');
  assert.deepEqual(adapter.diagnostics(),[{name:'quota',available:false,reason:'account-loading'}]);
  adapter.report('quota',true);assert.equal(adapter.diagnostics()[0].reason,null);
});
test('insertion accepts native Chat and panel composers without expanding thread metrics',()=>{
  const adapter=createCodexEnvironment(),add={};
  let chat=true,overlay=false,hidden=false;
  const root={getAttribute:()=>chat?'home':'thread',querySelector:selector=>selector.includes('add-context')?add:null};
  const editable={isConnected:true,checkVisibility:()=>true,closest:selector=>{
    if (selector.includes('composer-root')) return !chat||selector.includes('chatgpt-composer')?root:null;
    if (selector.includes('hidden')) return hidden||(overlay&&selector.includes('overlay-content'))?{}:null;
    return null;
  }};
  assert.equal(adapter.composer(editable),null);
  const inserted=adapter.composer(editable,{purpose:'insertion'});
  assert.equal(inserted.editable,editable);assert.equal(inserted.add,add);assert.equal(inserted.threadId,null);
  chat=false;overlay=true;
  assert.equal(adapter.composer(editable),null);
  assert.equal(adapter.composer(editable,{purpose:'insertion'}).editable,editable);
  hidden=true;assert.equal(adapter.composer(editable,{purpose:'insertion'}),null);
  editable.isConnected=false;assert.equal(adapter.composer(editable,{purpose:'insertion'}),null);
  assert.equal(adapter.composer({isConnected:true,closest:()=>null},{purpose:'insertion'}),null);
});
test('insertion resolves the focused native composer before background and hidden composers',()=>{
  const original=globalThis.document,adapter=createCodexEnvironment();
  const focus={};
  function candidate({focused=false,hidden=false}={}) {
    const root={contains:node=>focused&&node===focus,getAttribute:()=> 'home',querySelector:()=>null};
    return {isConnected:true,checkVisibility:()=>!hidden,closest:selector=>selector.includes('composer-root')?root:null};
  }
  const background=candidate(),active=candidate({focused:true}),hidden=candidate({hidden:true});
  try {
    globalThis.document={activeElement:focus,querySelectorAll:()=>[hidden,background,active]};
    assert.equal(adapter.composer(null,{purpose:'insertion'}).editable,active);
    assert.equal(adapter.composer(background,{purpose:'insertion'}).editable,background);
    assert.equal(adapter.composer(hidden,{purpose:'insertion'}),null);
  } finally {globalThis.document=original;}
});

test('session surface survives pending input and editor replacement, but clears on navigation',()=>{
  const adapter=createCodexEnvironment(),id='12345678-1234-1234-1234-123456789abc';
  let placement='thread',hidden=false,visible=true,inert=false,editorPresent=true;
  const root={isConnected:true,getAttribute:()=>placement,checkVisibility:()=>visible,
    querySelector:selector=>selector.includes('portal')?{getAttribute:()=>id}:editorPresent?editable:null,
    closest:selector=>selector==='[data-codex-composer-root]'?root:hidden||inert&&selector.includes('inert')?{}:null};
  const editable={isConnected:true,checkVisibility:()=>true,
    closest:selector=>selector.includes('composer-root')?root:inert&&selector.includes('inert')?{}:null};
  assert.equal(adapter.composerSurface(root).threadId,id);
  inert=true;assert.equal(adapter.composer(editable),null);
  assert.equal(adapter.composerSurface(root).threadId,id);
  editorPresent=false;editable.isConnected=false;
  assert.equal(adapter.composerSurface(root).threadId,id);
  hidden=true;assert.equal(adapter.composerSurface(root),null);
  hidden=false;visible=false;assert.equal(adapter.composerSurface(root),null);
  visible=true;placement='home';assert.equal(adapter.composerSurface(root),null);
  placement='thread';root.isConnected=false;assert.equal(adapter.composerSurface(root),null);
});
