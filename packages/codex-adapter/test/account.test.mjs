import test from 'node:test';
import assert from 'node:assert/strict';
import {createCodexEnvironment} from '../src/renderer/environment.mjs';

function fixture(context) {
  const previous=globalThis.document;context.after(()=>{globalThis.document=previous;});
  let cached,changed,unsubscribed=0;
  const auth={authMethod:'chatgpt',userId:'user',accountId:'a',planAtLogin:'plus',isLoading:false};
  const client={getQueryData:key=>{assert.deepEqual(key,['accounts','check']);return cached;},getQueryCache:()=>({subscribe:callback=>{changed=callback;return()=>unsubscribed++;}})};
  const rail={getBoundingClientRect:()=>({width:64}),__reactFiberFixture:{memoizedProps:{auth,client}}};
  globalThis.document={querySelectorAll:()=>[rail]};
  return {auth,rail,set:data=>{cached=data;},change:key=>changed({query:{queryKey:[key]}}),unsubscribed:()=>unsubscribed};
}
test('account check overrides login plan, fallback waits for a valid current identity',context=>{
  const f=fixture(context),adapter=createCodexEnvironment().account();
  assert.equal(adapter.read().source,'planAtLogin');assert.equal(adapter.read().planType,'plus');
  f.set({accounts:[{id:'a',plan_type:'pro'}]});assert.equal(adapter.read().planType,'pro');assert.equal(adapter.read().source,'accounts/check');
  f.auth.accountId='b';assert.equal(adapter.read().status,'unknown');
  f.set(undefined);f.auth.planAtLogin='plus';assert.equal(adapter.read().planType,'plus');
  f.auth.isLoading=true;assert.equal(adapter.read().status,'unknown');
  f.auth.isLoading=false;f.auth.authMethod='apikey';assert.equal(adapter.read().status,'unknown');
});
test('account changes invalidate only account consumers and abort releases the subscription',context=>{
  const f=fixture(context),controller=new AbortController();let changes=0;
  const adapter=createCodexEnvironment().account(controller.signal,()=>changes++);
  adapter.read();adapter.read();f.change('rate-limit-status');assert.equal(changes,0);
  f.change('accounts');assert.equal(changes,1);
  const replacement={...f.rail.__reactFiberFixture.memoizedProps.client};f.rail.__reactFiberFixture.memoizedProps.client=replacement;
  adapter.read();assert.equal(f.unsubscribed(),1);
  controller.abort();assert.equal(f.unsubscribed(),2);assert.equal(adapter.read().status,'unknown');
});
test('read-only account inspection does not create unused cache subscriptions',context=>{
  const f=fixture(context);f.rail.__reactFiberFixture.memoizedProps.client.getQueryCache=()=>{throw Error('unexpected subscription');};
  assert.equal(createCodexEnvironment().account().read().planType,'plus');
});
