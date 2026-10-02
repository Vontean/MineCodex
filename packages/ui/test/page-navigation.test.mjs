import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativePageAdapter} from '../src/native/page.mjs';
import {installPage} from '../src/components/page.mjs';

test('standalone page uses native rail-only routing and restores the complete origin without toggling sidebar',()=>{
  const origin={pathname:'/scheduled',search:'?filter=active',hash:'',state:{mode:'work'}};
  const calls=[];
  const router={state:{location:origin},navigate:(target,options)=>{calls.push({target,options});router.state.location=typeof target==='string'?{pathname:target}:target;}};
  const native=createNativePageAdapter({rail:()=>({}),props:()=>({router})});
  const lease=native.standalone();
  assert.deepEqual(calls[0],{target:'/projects',options:{replace:true,state:origin.state}});
  lease.release();lease.release();
  assert.equal(calls.length,2);assert.equal(calls[1].target,origin);
  const second=native.standalone();router.state.location={pathname:'/space'};second.release();
  assert.equal(calls.length,3);
  const third=native.standalone();third.release({restoreNavigation:false});
  assert.equal(calls.length,4);
});

test('page navigation lease is released on removal or runtime disposal',()=>{
  const controller=new AbortController(),releases=[];
  const api=installPage(controller.signal,{surface:()=>{},layer:n=>n},{standalone:()=>({release:o=>releases.push(o)})});
  const first={},second={};
  assert.equal(api.page(first,{sidebar:'none'}),first);
  api.page(first,{sidebar:'none'});api.releasePage(first,{restoreNavigation:false});
  assert.deepEqual(releases,[{restoreNavigation:false}]);
  api.page(second,{sidebar:'none'});controller.abort();assert.equal(releases.length,2);
});

function navigationFixture(pathname='/scheduled', asyncEntry=false) {
  const listeners=new Set(),calls=[];
  const origin={pathname,search:'',hash:'',key:'origin'};
  const router={state:{location:origin,navigation:{state:'idle'}},
    subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
    navigate(target,options){calls.push({target,options});if(!asyncEntry)commit(typeof target==='string'?{pathname:target,key:`key-${calls.length}`} : target);},
  };
  function commit(location){router.state={location,navigation:{state:'idle'}};for(const fn of [...listeners])fn(router.state);}
  const native=createNativePageAdapter({rail:()=>({}),props:()=>({router})});
  return {native,router,commit,listeners,calls,origin};
}

test('secondary native navigation dismisses the injected page without restoring its origin',()=>{
  for(const pathname of ['/images','/scheduled','/space','/projects']) {
    const f=navigationFixture();let exits=0;
    const lease=f.native.standalone({onNavigate:()=>exits++});
    f.commit({pathname,key:'destination'});
    assert.equal(exits,1);assert.equal(f.listeners.size,0);
    lease.release();assert.equal(f.calls.length,1);
    assert.equal(f.router.state.location.pathname,pathname);
  }
});

test('hover and loading notifications preserve the page until a location commits',()=>{
  const f=navigationFixture();let exits=0;
  f.native.standalone({onNavigate:()=>exits++});
  for(const fn of f.listeners){fn(f.router.state);fn({...f.router.state,navigation:{state:'loading',location:{pathname:'/images'}}});}
  assert.equal(exits,0);
  f.commit({pathname:'/images',key:'images'});assert.equal(exits,1);
});

test('async shell entry is not mistaken for leaving, and explicit close unsubscribes before restoration',()=>{
  const f=navigationFixture('/scheduled',true);let exits=0;
  const lease=f.native.standalone({onNavigate:()=>exits++});
  f.commit(f.origin);f.commit({pathname:'/projects',key:'shell'});
  assert.equal(exits,0);
  lease.release();assert.equal(f.listeners.size,0);assert.equal(exits,0);
  assert.equal(f.calls.at(-1).target,f.origin);
});

test('opening on the shell route still observes secondary navigation',()=>{
  const f=navigationFixture('/projects');let exits=0;
  f.native.standalone({onNavigate:()=>exits++});
  f.commit({pathname:'/images',key:'images'});
  assert.equal(exits,1);assert.equal(f.calls.length,0);
});

test('page forwards native navigation to the feature and releases the lease',()=>{
  const f=navigationFixture();const controller=new AbortController();let exits=0;
  const api=installPage(controller.signal,{surface:()=>{},layer:n=>n},f.native);
  const node={};api.page(node,{sidebar:'none',onNavigate:()=>{exits++;api.releasePage(node);}});
  f.commit({pathname:'/images',key:'images'});
  assert.equal(exits,1);controller.abort();assert.equal(f.calls.length,1);
});
