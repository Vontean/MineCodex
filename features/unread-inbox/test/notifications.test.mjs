import assert from 'node:assert/strict';
import test from 'node:test';
import {createNotificationQueue} from '../src/domain/notifications.mjs';
import {createPageScriptSource} from '../src/injection-source.mjs';
import {discoverThreadBindings} from '../src/adapters/codex/modules.mjs';
const keys = items => items.map(item=>item.key);
test('new status pushes previous notifications down; content and repaint do not reorder',()=>{
  const queue=createNotificationQueue();
  const a={key:'a',unread:true,working:false,timestamp:10},b={key:'b',attention:'approval',timestamp:20};
  assert.deepEqual(keys(queue.update([a,b])),['b','a']);
  assert.deepEqual(keys(queue.update([{...b,summary:'Updated summary',timestamp:99},a])),['b','a']);
  assert.deepEqual(keys(queue.update([{...a,attention:'input'},b])),['a','b']);
  assert.deepEqual(keys(queue.update([{...a,timestamp:100},b])),['a','b']);
});
test('current, resolved and removed chats disappear; duplicates never produce extra cards',()=>{
  const queue=createNotificationQueue();const a={key:'a',unread:true,working:false},b={key:'b',attention:'approval'};
  assert.deepEqual(keys(queue.update([a,a,b],'b')),['a']);
  assert.deepEqual(queue.update([{...a,unread:false}],null),[]);
  queue.update([b]);assert.deepEqual(queue.update([]),[]);
});
test('dismiss is local and survives repaint, but a new event can notify again',()=>{
  const queue=createNotificationQueue();const item={key:'a',attention:'input',working:false,unread:false,timestamp:1};
  queue.update([item]);queue.dismiss('a');
  assert.deepEqual(queue.update([{...item,summary:'Next token',timestamp:2}]),[]);
  assert.equal(item.unread,false);
  assert.equal(queue.update([{...item,attention:'approval'}]).length,1);
  queue.dismiss('a');queue.clear();assert.equal(queue.update([item]).length,1);
});
test('unread timestamp change is a new event; idle recents are not notifications',()=>{
  const queue=createNotificationQueue();const a={key:'a',unread:true,working:false,timestamp:1};
  queue.update([a]);queue.dismiss('a');assert.deepEqual(queue.update([a,{key:'idle',timestamp:100}]),[]);
  assert.deepEqual(keys(queue.update([{...a,timestamp:2}])),['a']);
});
test('serialized entry contains its dependencies and removes legacy native mutations',async()=>{
  const source=await createPageScriptSource();assert.doesNotThrow(()=>new Function('signal','config',source));
  assert.doesNotMatch(source,/data-minecodex-task-title|data-minecodex-sidebar-original|syncSidebarIcons|activityButton|restoreActivity/);
});
// 最小原生契约样例，变量与导出名刻意不同于当前安装包。
const fixture=`
import{navExport as go,turnExport as turnsAtom,previewExport as cleanText}from"./shared-new.js";
function preview(text){let value=cleanText(text);return value.length===0?null:value}
let activity=family(root,(id,{get:g})=>{if(id==null)return null;let turns=g(turnsAtom,id);if(turns==null)return null;for(let i=turns.length-1;i>=0;i--){let items=turns[i].items;for(let j=items.length-1;j>=0;j--){let item=items[j];if(item.type===\`agentMessage\`){let value=preview(item.text);if(value!=null)return value}}}return null});
let projectAtom=family(root,(mode,{get:g,scope:s})=>{let allowed=mode!==\`chatgpt\`;let{allSidebarThreadKeys:a,pinnedThreadKeys:b}=g(catalogAtom);});
function records(g,keys){return keys.flatMap(k=>{let n=g(threadAtom,k);return n==null?[]:[{task:n,isPinned:false}]})}
let duration=6e4;
function row(p){let pending=use(pendingAtom,threadArgs),request=pending?.pendingRequest,resolution=use(resolutionAtom,args),matches=resolution?.requestId===request.userInputRequestId,progress={durationMs:duration};let title=use(titleAtom,{hostId:host,threadId:id})??summary?.title;let att=use(attentionAtom,args),loading=use(statusAtom,args);let read=use(unreadAtom,args),room=read.roomId,shown=loading;(att===\`response\`);let chip=att===\`approval\`||child?{id:\`awaiting-approval\`}:null;let label={id:\`codex.localTaskRow.needsInput\`};let nav=isCloud?scope.get(router).navigate(path(id)):go(scope,id,host)}var end;
export{titleAtom as ttl,resolutionAtom as r,pendingAtom as pnd,catalogAtom as c,threadAtom as t,projectAtom as p,attentionAtom as a,statusAtom as s,unreadAtom as u};`;
test('native roles follow semantic call paths, including an imported navigation action',()=>{
  assert.deepEqual(discoverThreadBindings(fixture),{countdownDuration:{value:60000},activityTurns:{name:'turnExport',file:'./shared-new.js'},previewText:{name:'previewExport',file:'./shared-new.js'},title:{name:'ttl'},resolution:{name:'r'},pending:{name:'pnd'},catalog:{name:'c'},thread:{name:'t'},projects:{name:'p'},attention:{name:'a'},status:{name:'s'},unread:{name:'u'},navigate:{name:'navExport',file:'./shared-new.js'}});
  assert.throws(()=>discoverThreadBindings(fixture.replace('allSidebarThreadKeys','unknown')),/contract changed/);
});

test('loading and unknown working states do not notify; completed unread and attention do',()=>{
  const queue=createNotificationQueue();
  assert.deepEqual(queue.update([{key:'running',working:true,unread:true},{key:'unknown',unread:true}]),[]);
  assert.deepEqual(keys(queue.update([{key:'running',working:false,unread:true}])),['running']);
  assert.deepEqual(queue.update([{key:'running',working:true,unread:true}]),[]);
  assert.deepEqual(keys(queue.update([{key:'waiting',working:true,attention:'approval'}])),['waiting']);
});

test('countdown updates neither reorder nor resurrect dismissal; working removes a resolved request',()=>{
 const queue=createNotificationQueue(),a={key:'a',attention:'input',working:true,countdown:{deadlineMs:100}},b={key:'b',attention:'approval'};
 assert.deepEqual(keys(queue.update([a,b])),['b','a']);
 assert.deepEqual(keys(queue.update([{...a,countdown:{deadlineMs:0}},b])),['b','a']);
 queue.dismiss('a');assert.deepEqual(keys(queue.update([{...a,countdown:{deadlineMs:200}},b])),['b']);
 assert.deepEqual(queue.update([{...a,attention:null,unread:true}]),[]);
});
