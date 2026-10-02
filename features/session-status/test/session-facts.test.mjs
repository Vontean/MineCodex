import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionFacts} from '../src/adapters/codex/session-log.mjs';
import {createSessionState,applySessionStatusEvent,sessionStatusSnapshot} from '../src/domain/session-stats.mjs';

test('native usage becomes internal facts and unknown events cannot fabricate usage',()=>{
  const usage={input_tokens:100,cached_input_tokens:60,output_tokens:20,total_tokens:120};
  const facts=sessionFacts({type:'event_msg',timestamp:'2026-10-01T00:00:00Z',payload:{type:'token_count',info:{total_token_usage:usage,last_token_usage:usage}}});
  assert.equal(facts[0].kind,'usage-observed');assert.deepEqual(facts[0].total,{input:100,cached:60,output:20,total:120,cacheWrite:null});
  assert.deepEqual(sessionFacts({type:'unknown',payload:usage}),[]);
  assert.equal(sessionFacts({type:'event_msg',payload:{type:'token_count',info:{total_token_usage:{input_tokens:-1}}}})[0].total,null);
  assert.doesNotThrow(()=>sessionFacts({type:'compacted',payload:{replacement_history:{invalid:true}}}));
});
test('domain computes cache from internal usage and does not accept raw records',()=>{
  const state=createSessionState();
  applySessionStatusEvent(state,{kind:'usage-observed',total:{input:100,cached:60,output:20,total:120},last:null,at:'2026-10-01T00:00:00Z'});
  const snapshot=sessionStatusSnapshot(state,'thread');assert.equal(snapshot.cacheHitPercent,60);assert.equal(snapshot.outputTokens,20);
  applySessionStatusEvent(state,{type:'event_msg',payload:{type:'token_count'}});assert.equal(sessionStatusSnapshot(state,'thread').outputTokens,20);
});

test('tool history includes string results as well as content arrays, including after compaction',()=>{
  const item={type:'function_call_output',output:'中文工具结果'};
  const expected=Math.ceil(Buffer.byteLength(item.output,'utf8')/4);
  const state=createSessionState();
  for(const payload of [item,{type:'custom_tool_call_output',output:[{type:'input_text',text:item.output}]}])
    for(const fact of sessionFacts({type:'response_item',payload})) applySessionStatusEvent(state,fact);
  assert.equal(sessionStatusSnapshot(state,'thread').contextSections.toolHistory,expected*2);
  for(const fact of sessionFacts({type:'compacted',payload:{replacement_history:[item],window_number:1}})) applySessionStatusEvent(state,fact);
  assert.equal(sessionStatusSnapshot(state,'thread').contextSections.toolHistory,expected);
});
