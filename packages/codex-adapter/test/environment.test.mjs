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
