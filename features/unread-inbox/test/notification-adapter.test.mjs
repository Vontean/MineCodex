import assert from 'node:assert/strict';
import test from 'node:test';
import {createNotificationAdapter} from '../src/adapters/codex/renderer.mjs';

function setup() {
  let route='/local/a',homeOpen=false,sidebar=null,peeking=false,railMissing=false,current=null,auth={authMethod:'chatgpt',accountId:'a',userId:'u'},unread=true,status='idle',attention=null;
  const actions=[],reports=[];
  const tokens={pending:'pending',resolution:'resolution',countdownDuration:60000,catalog:'catalog',thread:'thread',projects:'projects',unread:'unread',attention:'attention',status:'status',navigate:(...args)=>actions.push(args.slice(1))};
  const scope={node:{store:{}},query:{},scope:{},get(token,arg){
    if(token==='catalog')return {allSidebarThreadKeys:['local:a']};
    if(token==='thread')return {summary:{conversationId:'a',hostId:'remote:host',title:'Chat',recencyAt:5,hasUnreadTurn:unread}};
    if(token==='projects')return {projectGroups:[{projectId:'p',label:'Project',threadKeys:['local:a']}]};
    if(token==='unread')return {hasUnread:unread};
    if(token==='attention')return attention;
    if(token==='status')return status;
  }};
  const rail={querySelector:()=>({getAttribute:()=>String(homeOpen)}),getBoundingClientRect:()=>({right:52,top:44})};
  const codex={rail:()=>railMissing?null:rail,currentFiber:()=>({updateQueue:{memoCache:{data:[[scope]]}}}),props:(el,predicate)=>predicate({routeContext:{outlet:{props:{match:{pathname:route}}}}})||predicate({auth}),currentThreadId:()=>current,report:(...args)=>reports.push(args)};
  globalThis.document={querySelector:s=>s.includes('peeking')?(peeking?{}:null):sidebar,querySelectorAll:()=>[]};
  const adapter=createNotificationAdapter(codex,async()=>tokens,()=>{});
  return {adapter,actions,reports,scope,set(value){if('route'in value)route=value.route;if('homeOpen'in value)homeOpen=value.homeOpen;if('sidebar'in value)sidebar=value.sidebar;if('peeking'in value)peeking=value.peeking;if('railMissing'in value)railMissing=value.railMissing;if('current'in value)current=value.current;if('auth'in value)auth=value.auth;if('unread'in value)unread=value.unread;if('status'in value)status=value.status;if('attention'in value)attention=value.attention;}};
}
const visibleSidebar=threads=>({closest:()=>null,checkVisibility:()=>true,getBoundingClientRect:()=>({width:288}),querySelector:()=>({closest:()=>null,checkVisibility:()=>threads,getBoundingClientRect:()=>({width:threads?288:0})})});
test('visibility uses conversation content, not the sidebar expanded preference',()=>{
  const x=setup();assert.equal(x.adapter.layout().visible,true);
  assert.equal(x.adapter.layout().pageKey,"/local/a");
  x.set({route:"/spaces"});assert.equal(x.adapter.layout().pageKey,"/spaces");
  x.set({sidebar:visibleSidebar(true)});assert.equal(x.adapter.layout().visible,false);
  x.set({sidebar:visibleSidebar(false)});assert.equal(x.adapter.layout().visible,true); // Space 有自己的侧栏。
  x.set({homeOpen:true});assert.equal(x.adapter.layout().visible,false);
  x.set({homeOpen:false,peeking:true});assert.equal(x.adapter.layout().visible,false);
  x.set({peeking:false,railMissing:true});assert.equal(x.adapter.layout().available,false);
  x.adapter.dispose();delete globalThis.document;
});
test('full native catalog works without DOM rows, refreshes status and keeps remote navigation',async()=>{
  const x=setup();assert.equal(x.adapter.snapshot(),null);
  await new Promise(resolve=>setImmediate(resolve));
  let s=x.adapter.snapshot();assert.equal(s.records.length,1);assert.equal(s.records[0].unread,true);
  assert.deepEqual(s.records[0].project,{id:'p',name:'Project'});
  s.records[0].activate();assert.deepEqual(x.actions,[['a','remote:host']]);
  x.set({attention:'response',status:'loading',current:'a'});s=x.adapter.snapshot();
  assert.equal(s.currentKey,'local:a');assert.equal(s.records[0].attention,'input');assert.equal(s.records[0].working,false);
  x.set({attention:null,status:'idle',unread:false,current:null});s=x.adapter.snapshot();
  assert.equal(s.records[0].unread,false);assert.equal(s.currentKey,null);
  x.set({auth:{authMethod:'chatgpt',accountId:'b',userId:'u'}});assert.notEqual(x.adapter.snapshot().account,s.account);
  x.set({auth:{isLoading:true,authMethod:'chatgpt',accountId:'b',userId:'u'}});assert.equal(x.adapter.snapshot(),null);
  x.adapter.dispose();assert.equal(x.adapter.snapshot(),null);delete globalThis.document;
});
test('broken native store hides data instead of returning a stale unread record',async()=>{
  const x=setup();x.adapter.snapshot();await new Promise(resolve=>setImmediate(resolve));
  assert.ok(x.adapter.snapshot());x.scope.get=()=>{throw new Error('contract changed');};
  assert.equal(x.adapter.snapshot(),null);
  assert.deepEqual(x.reports.at(-1),['task-notification-catalog',false,'native-store-contract-unavailable']);
  x.adapter.dispose();delete globalThis.document;
});

test('countdown belongs to the current native input request, never approval or a stale request',async()=>{
 const x=setup();x.adapter.snapshot();await new Promise(resolve=>setImmediate(resolve));
 const original=x.scope.get;let id='request',state='scheduled';
 x.scope.get=(token,args)=>token==='pending'?{pendingRequest:{kind:'userInput',userInputRequestId:'request'}}:token==='resolution'?{requestId:id,resolutionState:{status:state,deadlineMs:12345}}:original(token,args);
 x.set({attention:'response',status:'loading'});
 assert.deepEqual(x.adapter.snapshot().records[0].countdown,{deadlineMs:12345,durationMs:60000});
 id='old';assert.equal(x.adapter.snapshot().records[0].countdown,null);
 id='request';state='snoozed';assert.equal(x.adapter.snapshot().records[0].countdown,null);
 state='scheduled';x.set({attention:'approval'});assert.equal(x.adapter.snapshot().records[0].countdown,null);
 x.set({attention:null});const record=x.adapter.snapshot().records[0];assert.equal(record.countdown,null);assert.equal(record.working,true);
 x.adapter.dispose();delete globalThis.document;
});
