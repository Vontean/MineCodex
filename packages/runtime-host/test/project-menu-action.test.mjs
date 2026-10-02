import assert from 'node:assert/strict';
import test from 'node:test';
import { CodexRuntime } from '../src/codex-runtime.mjs';
import { HOST_BINDING_NAME } from '../src/codex-injection.mjs';
test('project menu opens the CLI panel only through the authenticated builtin action',async()=>{
  let opened=0;const replies=[];
  const runtime=new CodexRuntime({features:[],profileDir:'/tmp/mcx-account-action',openControlPanel:async()=>{opened++;}});
  runtime.bindingTokens.set('target','valid');runtime.resolveHostAction=async(c,id,value)=>replies.push(value);
  const request={token:'wrong',requestId:'1',featureId:'minecodex',action:'open-control-panel'};
  const send=()=>runtime.handleBindingCalled('target',{}, {name:HOST_BINDING_NAME,payload:JSON.stringify(request)});
  await send();assert.equal(opened,0);request.token='valid';await send();assert.equal(opened,1);assert.equal(replies[0].ok,true);
  request.featureId='other';await send();assert.equal(opened,1);assert.equal(replies[1].error.code,'ACTION_NOT_ALLOWED');
  runtime.openControlPanel=async()=>{throw new Error('browser unavailable');};request.featureId='minecodex';await send();assert.equal(replies[2].ok,false);assert.equal(replies[2].error.code,'CONTROL_PANEL_FAILED');
});
