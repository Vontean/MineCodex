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
    applySessionStatusEvent(state, {kind:"turn-started", id:"turn"});
    const before=apply(state,item('Reasoning',1000,11000),response(18965,796));
    const after=apply(state,item('CommandExecution',0,end));
    assert.equal(after.observedTps,44);
    assert.equal(after.observedModelMs,before.observedModelMs);
    assert.equal(after.speedSamples,1);
  }
});

test('background completion already present before usage must not shorten the response', () => {
  const state=createSessionState();
    applySessionStatusEvent(state, {kind:"turn-started", id:"turn"});
  const snapshot=apply(state,item('Reasoning',1000,11000),item('CommandExecution',0,18956),response(18965,796));
  assert.equal(snapshot.observedTps,44);
});

test('tool launched during model output is concurrent even when contained within the response', () => {
  const state=createSessionState();
    applySessionStatusEvent(state, {kind:"turn-started", id:"turn"});
  const snapshot=apply(state,item('Reasoning',1000,2000),item('AgentMessage',2500,5000),
    item('CommandExecution',1500,4500),response(6000,200));
  assert.equal(snapshot.observedModelMs,5000);
  assert.equal(snapshot.observedTps,40);
});

test('tool that continues beyond the response is background, including in later responses', () => {
  const state=createSessionState();
    applySessionStatusEvent(state, {kind:"turn-started", id:"turn"});
  apply(state,item('Reasoning',1000,1100),response(3000,100,'one'),
    item('AgentMessage',4000,4500),response(6000,100,'two'));
  const snapshot=apply(state,item('CommandExecution',1200,10000));
  assert.equal(snapshot.observedModelMs,2000);
  assert.equal(snapshot.speedSamples,1);
  assert.equal(snapshot.observedTps,50);
});

test('bounded tool waits are still deducted once, including late completion records', () => {
  for (const late of [false,true]) {
    const state=createSessionState();
    applySessionStatusEvent(state, {kind:"turn-started", id:"turn"});
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
    applySessionStatusEvent(state, {kind:"turn-started", id:"turn"});
  const output=item('Reasoning',1000,1100);
  delete output.payload.completed_at_ms;
  const snapshot=apply(state,output,item('CommandExecution',1200,2800),response(4000,150));
  assert.equal(snapshot.observedModelMs,3000);
  assert.equal(snapshot.observedTps,50);
});

const turnRecord = (id, at=0) => ({type:'turn_context',timestamp:new Date(at).toISOString(),payload:{turn_id:id}});
function measuredTurn(state, id, start, output, duration=1000) {
  return apply(state,turnRecord(id,start),item('AgentMessage',start,start+duration),response(start+duration,output,id));
}

test('latest response replaces earlier TPS while all turns and steps remain counted', () => {
  const state=createSessionState();
  measuredTurn(state,'old',1000,9000);
  measuredTurn(state,'one',3000,100);
  apply(state,item('AgentMessage',5000,6000),response(6000,200,'one-extra'));
  measuredTurn(state,'two',7000,300,3000);
  measuredTurn(state,'three',11000,600);
  measuredTurn(state,'four',13000,400);
  const snapshot=measuredTurn(state,'five',15000,800);
  assert.equal(snapshot.observedTps,800);
  assert.equal(snapshot.speedSamples,1);
  assert.equal(snapshot.observedModelMs,1000);
  assert.equal(snapshot.turns,6);
  assert.equal(snapshot.steps,7);
  const next=measuredTurn(state,'six',17000,1000);
  assert.equal(next.observedTps,1000);
  assert.equal(next.speedSamples,1);
  assert.equal(next.observedModelMs,1000);
});

test('latest invalid response clears old TPS and current response restores it', () => {
  const state=createSessionState();
  assert.equal(sessionStatusSnapshot(state,'thread').observedTps,null);
  assert.equal(measuredTurn(state,'one',1000,100).observedTps,100);
  assert.equal(measuredTurn(state,'two',3000,300).observedTps,300);
  measuredTurn(state,'three',5000,500);
  measuredTurn(state,'four',6500,200);
  measuredTurn(state,'five',8000,400);
  apply(state,turnRecord('empty'),response(7000,500,'no-timing'));
  measuredTurn(state,'invalid',10000,9000,0);
  applySessionStatusEvent(state,{kind:'turn-started',id:'current'});
  assert.equal(sessionStatusSnapshot(state,'thread').observedTps,null);
  const snapshot=apply(state,item('AgentMessage',612000,613000),response(613000,700,'current-response'));
  assert.equal(snapshot.observedTps,700);
  assert.equal(snapshot.speedSamples,1);
  assert.equal(snapshot.isRunning,true);
});

test('latest complete long response retains its full measured time', () => {
  const state=createSessionState();
  measuredTurn(state,'one',1000,100);
  measuredTurn(state,'two',3000,100);
  measuredTurn(state,'three',5000,100);
  measuredTurn(state,'four',7000,100);
  measuredTurn(state,'five',9000,100);
  const snapshot=measuredTurn(state,'slow',11000,9000,600_000);
  assert.equal(snapshot.speedSamples,1);
  assert.equal(snapshot.observedModelMs,600000);
  assert.equal(snapshot.observedTps,15);
});

test('unknown turn timing is excluded and turn context changes cannot carry pending output', () => {
  const state=createSessionState();
  assert.equal(apply(state,item('AgentMessage',1000,2000),response(2000,100)).observedTps,null);
  apply(state,turnRecord('one'),item('Reasoning',3000,4000),turnRecord('two'),response(5000,100,'two'));
  assert.equal(sessionStatusSnapshot(state,'thread').observedTps,null);
  measuredTurn(state,'three',6000,100);
  applySessionStatusEvent(state,{kind:'turn-ended',id:'three'});
  assert.equal(apply(state,item('AgentMessage',8000,9000),response(9000,900,'orphan')).observedTps,null);
});

test('latest OCX response replaces Codex TPS without deducting tool time', () => {
  const state=createSessionState();
  measuredTurn(state,'one',1000,100);
  measuredTurn(state,'two',3000,300,3000);
  apply(state,item('CommandExecution',3500,4500));
  const measurements=new Map([['two',{source:'ocx',output:300,elapsed:1000,reason:null}]]);
  const snapshot=sessionStatusSnapshot(state,'thread',measurements);
  assert.equal(snapshot.observedTps,300);
  assert.equal(snapshot.observedModelMs,1000);
  assert.equal(snapshot.speedSource,'ocx');
  assert.equal(snapshot.speedSamples,1);
});

test('latest Codex response rejects sub-second timing', () => {
  const state=createSessionState();
  measuredTurn(state,'one',1000,9000,999);
  apply(state,item('AgentMessage',3000,3500),response(3500,9000,'extra'));
  assert.equal(sessionStatusSnapshot(state,'thread').observedTps,null);
  measuredTurn(state,'two',5000,100,1000);
  assert.equal(sessionStatusSnapshot(state,'thread').observedTps,100);
  assert.equal(sessionStatusSnapshot(state,'thread').speedSamples,1);
});
