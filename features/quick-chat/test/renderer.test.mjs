import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuickChatAdapter} from '../src/adapters/codex/renderer.mjs';
import {createSubmissionTracker} from '../src/domain/submission.mjs';
function fixture({work=false,hasConversation=false,page=false,widget=false}={}) {
  const listeners=new Set(),calls=[];
  const emitter={addListener:(name,fn)=>listeners.add(fn),removeListener:(name,fn)=>listeners.delete(fn)};
  const editable={},session={conversationId:'chat',hasConversation};
  const floating={presentation:'compact',forceExpanded:false,onPresentationChange:value=>{floating.presentation=value;calls.push(value);},renderMenu:()=>({props:{items:[{id:'history',onSelect:()=>{floating.forceExpanded=true;calls.push('history');}}]}})};
  floating.renderTranscript=()=>({props:{'aria-hidden':!floating.forceExpanded,children:{props:{conversations:[],onConversationSelect:()=>{},onNewChat:()=>{}}}}});
  const owner={memoizedProps:{session},memoizedState:{memoizedState:null,next:null},return:null};
  const buttons=[],projectButtons=[];
  const surface={isConnected:true,closest:()=>null,querySelector:()=>editable,querySelectorAll:selector=>selector==='button'?buttons:projectButtons};
  const props = new Map([[surface,[floating,{session}]],[editable,[{isWorkConversation:work,annotationSubmitTarget:page?'page:1':undefined,isWidgetOverlay:widget,conversationId:'chat'},{submitDisabled:false,submitLoading:false,conversationId:'chat'},{composerController:{eventEmitter:emitter}}]]]);
  const codex={props:(node,predicate)=>props.get(node)?.find(predicate),currentFiber:()=>owner};
  return {surface,editable,owner,session,floating,listeners,calls,props,buttons,projectButtons,adapter:createQuickChatAdapter(codex)};
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
  const f=fixture();f.adapter.read(f.surface).history();assert.deepEqual(f.calls,['history']);
  assert.equal(f.adapter.read(f.surface).expanded,true);
  assert.equal(f.floating.presentation,'compact');
});
test('viewing history without a message preserves compact restoration after minimize',()=>{
  const f=fixture();
  for(let cycle=0;cycle<2;cycle++) {
    f.adapter.read(f.surface).history();
    assert.equal(f.floating.forceExpanded,true);
    // 原生最小化关闭历史，并将 presentation 保存为 restorePresentation。
    const restorePresentation=f.floating.presentation;
    f.floating.forceExpanded=false;f.floating.isMinimized=true;
    f.floating.presentation=restorePresentation;f.floating.isMinimized=false;
    assert.equal(f.adapter.read(f.surface).expanded,false);
    assert.equal(f.floating.presentation,'compact');
    assert.equal(f.session.hasConversation,false);
  }
  assert.deepEqual(f.calls,['history','history']);
});
test('Work never exposes Quick Chat controls',()=>{
  const f=fixture({work:true});assert.equal(f.adapter.read(f.surface),null);assert.deepEqual(f.calls,[]);
});
test('contextual full-page and widget composers never expose Quick Chat controls',()=>{
  for (const mode of [{page:true},{widget:true}]) {
    const f=fixture(mode);assert.equal(f.adapter.read(f.surface),null);assert.deepEqual(f.calls,[]);
  }
});
test('only standalone Minimize anchors History; the expanded title header stays native',()=>{
  const f=fixture(),header={checkVisibility:()=>true,hasAttribute:()=>false},standalone={...header};
  f.buttons.push(header,standalone);
  f.props.set(header,[{onMinimize:()=>{},isCompact:false}]);
  f.props.set(standalone,[{onMinimize:()=>{},isCompact:true,standalone:true}]);
  assert.equal(f.adapter.read(f.surface).minimize,standalone);
  f.buttons.pop();assert.equal(f.adapter.read(f.surface).minimize,undefined);
});
test('only the project selector composer rail is exposed for hiding',()=>{
  const f=fixture(),projectRail={},other={},project={closest:()=>projectRail};
  f.projectButtons.push(other,project);
  f.props.set(other,[{onProjectChange:()=>{},variant:'breadcrumb'}]);
  f.props.set(project,[{onProjectChange:()=>{},variant:'composer'}]);
  assert.equal(f.adapter.read(f.surface).projectRail,projectRail);
  f.projectButtons.pop();assert.equal(f.adapter.read(f.surface).projectRail,null);
});
test('submit subscription preserves handled result and is removed',()=>{
  const f=fixture();let count=0;const unsubscribe=f.adapter.subscribe(f.adapter.read(f.surface),()=>count++);
  const listener=[...f.listeners][0];assert.equal(listener(),false);assert.equal(count,1);unsubscribe();assert.equal(f.listeners.size,0);
});

test('history panel hides its redundant entry while keeping the native Minimize anchor',()=>{
  const f=fixture(),button={checkVisibility:()=>true,hasAttribute:()=>false};
  f.buttons.push(button);f.props.set(button,[{onMinimize:()=>{},isCompact:true,standalone:true}]);
  assert.equal(f.adapter.read(f.surface).showHistory,true);
  assert.equal(f.adapter.read(f.surface).historyVisible,false);
  f.adapter.read(f.surface).history();
  const opened=f.adapter.read(f.surface);
  assert.equal(opened.showHistory,false);assert.equal(opened.historyVisible,true);
  assert.equal(opened.minimize,button);
  f.floating.forceExpanded=false;
  assert.equal(f.adapter.read(f.surface).showHistory,true);
});

test('26.1007 scoped atom receipt accepts first and continued submissions without duplicating session id',()=>{
  const f=fixture(),tracker=createSubmissionTracker();
  tracker.begin(f.adapter.read(f.surface));
  f.owner.memoizedState.memoizedState=[{owner:()=>{},presentation:'compact'},{},{}];
  f.session.hasConversation=true;
  assert.equal(tracker.accepted(f.adapter.read(f.surface)),true);
  tracker.begin(f.adapter.read(f.surface));
  assert.equal(tracker.accepted(f.adapter.read(f.surface)),false);
  f.owner.memoizedState.memoizedState=[{owner:()=>{},presentation:'compact'},{},{}];
  assert.equal(tracker.accepted(f.adapter.read(f.surface)),true);
});


test('subscription identity stays internal, changes with the native source, and cleans both sources',()=>{
  const f=fixture(),first=f.adapter.read(f.surface),second=f.adapter.read(f.surface);
  assert.equal('emitter' in first,false);
  assert.equal(typeof first.subscriptionId,'number');
  assert.equal(first.subscriptionId,second.subscriptionId);
  const stopFirst=f.adapter.subscribe(first,()=>{});
  const listeners=new Set(),controller=f.props.get(f.editable).find(p=>p.composerController).composerController;
  controller.eventEmitter={addListener:(_,fn)=>listeners.add(fn),removeListener:(_,fn)=>listeners.delete(fn)};
  const changed=f.adapter.read(f.surface);
  assert.notEqual(changed.subscriptionId,first.subscriptionId);
  const stopChanged=f.adapter.subscribe(changed,()=>{});
  stopFirst();assert.equal(f.listeners.size,0);assert.equal(listeners.size,1);
  stopChanged();assert.equal(listeners.size,0);
  delete controller.eventEmitter;
  const missing=f.adapter.read(f.surface);assert.equal(missing.subscriptionId,0);
  assert.doesNotThrow(()=>f.adapter.subscribe(missing,()=>{})());
});
