import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuickChatAdapter} from '../src/adapters/codex/renderer.mjs';
import {createSubmissionTracker} from '../src/domain/submission.mjs';
function fixture({work=false,hasConversation=false}={}) {
  const listeners=new Set(),calls=[];
  const emitter={addListener:(name,fn)=>listeners.add(fn),removeListener:(name,fn)=>listeners.delete(fn)};
  const editable={},session={conversationId:'chat',hasConversation};
  const floating={presentation:'compact',onPresentationChange:value=>calls.push(value),renderMenu:()=>({props:{items:[{id:'history',onSelect:()=>calls.push('history')}]}})};
  const owner={memoizedProps:{session},memoizedState:{memoizedState:null,next:null},return:null};
  const surface={isConnected:true,closest:()=>null,querySelector:()=>editable,querySelectorAll:()=>[]};
  const props = new Map([[surface,[floating,{session}]],[editable,[{isWorkConversation:work,conversationId:'chat'},{submitDisabled:false,submitLoading:false,conversationId:'chat'},{composerController:{eventEmitter:emitter}}]]]);
  const codex={props:(node,predicate)=>props.get(node)?.find(predicate),currentFiber:()=>owner};
  return {surface,owner,session,listeners,calls,adapter:createQuickChatAdapter(codex)};
}
test('native receipt drives first acceptance even with no mounted transcript',()=>{
  const f=fixture(),tracker=createSubmissionTracker();
  tracker.begin(f.adapter.read(f.surface));
  assert.equal(tracker.accepted(f.adapter.read(f.surface)),false);
  f.owner.memoizedState.memoizedState={conversationId:'chat',owner:null,presentation:'compact'};
  f.session.hasConversation=true;
  assert.equal(tracker.accepted(f.adapter.read(f.surface)),true);
  assert.equal(tracker.accepted(f.adapter.read(f.surface)),false);
});
test('continuation distinguishes new native records with the same compact value',()=>{
  const f=fixture({hasConversation:true}),tracker=createSubmissionTracker();
  f.owner.memoizedState.memoizedState={conversationId:'chat',owner:null,presentation:'compact'};
  tracker.begin(f.adapter.read(f.surface));
  assert.equal(tracker.accepted(f.adapter.read(f.surface)),false);
  f.owner.memoizedState.memoizedState={conversationId:'chat',owner:null,presentation:'compact'};
  assert.equal(tracker.accepted(f.adapter.read(f.surface)),true);
});
test('history before first message invokes original native actions',()=>{
  const f=fixture();f.adapter.read(f.surface).history();assert.deepEqual(f.calls,['expanded','history']);
});
test('Work never exposes Quick Chat controls',()=>{
  const f=fixture({work:true});assert.equal(f.adapter.read(f.surface),null);assert.deepEqual(f.calls,[]);
});
test('submit subscription preserves handled result and is removed',()=>{
  const f=fixture();let count=0;const unsubscribe=f.adapter.subscribe(f.adapter.read(f.surface),()=>count++);
  const listener=[...f.listeners][0];assert.equal(listener(),false);assert.equal(count,1);unsubscribe();assert.equal(f.listeners.size,0);
});
