import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuickChatExitAdapter} from '../src/adapters/codex/presence.mjs';
import {installQuickChatExitRepair} from '../src/frontend/exit.mjs';
function fixture() {
  let calls = 0;
  const map = new Map([['empty',false],['animation',false]]);
  const context = {isPresent:false, register:() => {}, onExitComplete:id => {map.set(id,true); calls++;}};
  const finish = () => context.onExitComplete('empty');
  const owner = {memoizedState:{memoizedState:{current:map}}, memoizedProps:{name:'QuickChatWindow',isPresent:false,onExitComplete:() => {}}, return:null};
  const provider = {memoizedProps:{value:context},return:owner};
  // 最小契约样例保留原生函数签名，不依赖构建符号或资源哈希。
  const type = ({presenceAffectsLayout:a,propagate:b}) => (0,React.useState)([]);
  const empty = {type, memoizedProps:{propagate:true}, child:null, dependencies:{firstContext:{memoizedValue:context}},
    memoizedState:{memoizedState:[finish,['empty',context.onExitComplete,true]]},return:provider};
  provider.child = empty;owner.child = provider;
  const layer = {isConnected:true};
  const codex = {currentFiber:() => ({return:owner})};
  return {adapter:createQuickChatExitAdapter(codex),layer,owner,empty,context,map,calls:() => calls};
}
test('completes only the missing empty-container registration and deduplicates', () => {
  const f=fixture();assert.equal(f.adapter.repair(f.layer),1);
  assert.equal(f.map.get('empty'),true);assert.equal(f.map.get('animation'),false);
  assert.equal(f.adapter.repair(f.layer),0);assert.equal(f.calls(),1);
});
test('nonempty containers and active parents keep native lifecycle', () => {
  for(const mutate of [f => f.empty.child={},f => f.owner.memoizedProps.isPresent=true,f => f.context.isPresent=true,f => f.empty.memoizedProps.propagate=false]) {
    const f=fixture();mutate(f);assert.equal(f.adapter.repair(f.layer),0);assert.equal(f.calls(),0);
  }
});
test('changed callback contract, completed registration and disconnected layer are skipped', () => {
  for(const mutate of [f => f.empty.memoizedState.memoizedState[1][1]=() => {},f => f.map.set('empty',true),f => f.layer.isConnected=false,f => f.empty.type=() => null,f => delete f.owner.memoizedProps.name]) {
    const f=fixture();mutate(f);assert.equal(f.adapter.repair(f.layer),0);assert.equal(f.calls(),0);
  }
});
test('current React tree wins over a stale DOM-attached Fiber after reopen', () => {
  const f=fixture(),host={stateNode:{}};
  f.owner.return=host;
  const current={stateNode:f.layer,return:{memoizedProps:{isPresent:true,onExitComplete:() => {}},return:host}};
  host.stateNode.current={child:current};
  assert.equal(f.adapter.repair(f.layer),0);assert.equal(f.calls(),0);
});
test('unloading cancels queued observation and disconnects without editing the page', async () => {
  const previousDocument=globalThis.document, previousObserver=globalThis.MutationObserver;
  let callback, disconnected=false, reads=0, probe;
  globalThis.document={documentElement:{},querySelectorAll:() => {reads++;return [];}};
  globalThis.MutationObserver=class {constructor(fn){callback=fn} observe(){} disconnect(){disconnected=true}};
  try {
    const repair=installQuickChatExitRepair(new AbortController().signal,createQuickChatExitAdapter({}));
    const dispose=repair.dispose;
    await Promise.resolve();assert.equal(reads,1);assert.equal(repair.status(),true);
    callback();dispose();await Promise.resolve();
    assert.equal(reads,1);assert.equal(disconnected,true);
  } finally {globalThis.document=previousDocument;globalThis.MutationObserver=previousObserver;}
});
