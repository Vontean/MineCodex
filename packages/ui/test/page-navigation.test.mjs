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
