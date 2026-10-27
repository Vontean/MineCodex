import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {installLocalImageSource} from '../src/frontend/local-image-source.mjs';

function fixture(fail, plan='plus') {
  let observer, queued=false, entry, mounts=0, renders=0, disposed=0;
  const mutate=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;observer?.callback();});};
  const node=()=>({dataset:{},style:{},hidden:false,className:'',isConnected:true,append:mutate,after:mutate,remove:mutate,setAttribute(){},addEventListener(){},removeEventListener(){}});
  entry={tabs:node(),content:node(),accountKey:'account',mode:plan==='plus'?'library':'space',selectedKey:'images'};
  entry.tabs.parentElement=node();
  class Observer {constructor(callback){this.callback=callback;observer=this;}observe(){}disconnect(){observer=null;}}
  const controller=new AbortController();
  const context=vm.createContext({document:{body:node(),documentElement:{lang:'en'},createElement:node},navigator:{language:'en'},MutationObserver:Observer,IntersectionObserver:class{observe(){}disconnect(){}},queueMicrotask,console});
  const install=vm.runInContext(`(${installLocalImageSource})`,context);
  const source=install({codex:{report(){}},requestHostAction:async()=>({images:[],total:0})},controller.signal,{read:()=>entry,applicability:()=>entry?'applicable':'not-applicable'},{
    mountNavigation:async()=>({render(){renders++;mutate();},dispose(){disposed++;mutate();}}),
    mount:async()=>{mounts++;if(fail)throw Error('native contract changed');return {dispose(){disposed++;},clearSelection(){}};},
  });
  return {source,controller,mutate,get mounts(){return mounts;},get renders(){return renders;},get disposed(){return disposed;},leave(){entry=null;mutate();},enter(){entry={tabs:node(),content:node(),accountKey:'account',mode:plan==='plus'?'library':'space',selectedKey:'images'};entry.tabs.parentElement=node();mutate();}};
}
const settle=async()=>{for(let i=0;i<60;i++)await Promise.resolve();};
for(const plan of ['plus','pro'])test(`${plan}: failed native mount does not retry its own cleanup mutations`,async()=>{
  const f=fixture(true,plan);await settle();
  assert.equal(f.mounts,1);assert.equal(f.disposed,1);
  f.mutate();await settle();assert.equal(f.mounts,1);
  f.leave();await settle();f.enter();await settle();assert.equal(f.mounts,2);
  f.controller.abort();
});
test('unrelated mutations do not render the unchanged native navigation again',async()=>{
  const f=fixture(false);await settle();assert.equal(f.renders,1);
  f.mutate();await settle();assert.equal(f.renders,1);assert.equal(f.mounts,1);
  f.controller.abort();assert.equal(f.disposed,2);
});
