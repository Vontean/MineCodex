import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionFacts } from '../src/adapters/codex/session-log.mjs';
import { createSessionState, applySessionStatusEvent, sessionStatusSnapshot } from '../src/domain/session-stats.mjs';

const item = (type, start, end) => ({ type:'event_msg', timestamp:new Date(end).toISOString(),
  payload:{ type:'item_completed', item:{type}, started_at_ms:start, completed_at_ms:end } });
const response = (end, output, id='response') => ({ type:'token_usage_record', timestamp:new Date(end).toISOString(),
  payload:{response_id:id, usage:{input_tokens:1000,cached_input_tokens:0,output_tokens:output,total_tokens:1000+output}} });
function apply(state, ...records) {
  for (const record of records) for (const fact of sessionFacts(record)) applySessionStatusEvent(state, fact);
  return sessionStatusSnapshot(state, 'thread');
}

test('background completion cannot retroactively erase a response or produce 88444 TPS', () => {
  for (const end of [18956, 20000]) {
    const state=createSessionState();
    const before=apply(state,item('Reasoning',1000,11000),response(18965,796));
    const after=apply(state,item('CommandExecution',0,end));
    assert.equal(after.observedTps,44);
    assert.equal(after.observedModelMs,before.observedModelMs);
    assert.equal(after.speedSamples,1);
  }
});

test('background completion already present before usage must not shorten the response', () => {
  const state=createSessionState();
  const snapshot=apply(state,item('Reasoning',1000,11000),item('CommandExecution',0,18956),response(18965,796));
  assert.equal(snapshot.observedTps,44);
});

test('tool launched during model output is concurrent even when contained within the response', () => {
  const state=createSessionState();
  const snapshot=apply(state,item('Reasoning',1000,2000),item('AgentMessage',2500,5000),
    item('CommandExecution',1500,4500),response(6000,200));
  assert.equal(snapshot.observedModelMs,5000);
  assert.equal(snapshot.observedTps,40);
});

test('tool that continues beyond the response is background, including in later responses', () => {
  const state=createSessionState();
  apply(state,item('Reasoning',1000,1100),response(3000,100,'one'),
    item('AgentMessage',4000,4500),response(6000,100,'two'));
  const snapshot=apply(state,item('CommandExecution',1200,10000));
  assert.equal(snapshot.observedModelMs,4000);
  assert.equal(snapshot.speedSamples,2);
  assert.equal(snapshot.observedTps,50);
});

test('bounded tool waits are still deducted once, including late completion records', () => {
  for (const late of [false,true]) {
    const state=createSessionState();
    const tools=[item('CommandExecution',1200,2200),item('McpToolCall',1800,2800)];
    apply(state,item('Reasoning',1000,1100));
    if (!late) apply(state,...tools);
    apply(state,response(4000,140));
    const snapshot=apply(state,...(late?tools:[]));
    assert.equal(snapshot.observedModelMs,1400);
    assert.equal(snapshot.observedTps,100);
  }
});

test('missing output end cannot establish that a tool did not overlap generation', () => {
  const state=createSessionState();
  const output=item('Reasoning',1000,1100);
  delete output.payload.completed_at_ms;
  const snapshot=apply(state,output,item('CommandExecution',1200,2800),response(4000,150));
  assert.equal(snapshot.observedModelMs,3000);
  assert.equal(snapshot.observedTps,50);
});
