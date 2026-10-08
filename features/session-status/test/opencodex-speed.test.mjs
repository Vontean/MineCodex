import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, appendFile, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SessionStatusReader } from "../src/adapters/codex/session-reader.mjs";

const thread = "11111111-2222-4333-8444-555555555555";
const conversationId = createHash("sha256").update(thread).digest("hex").slice(0,32);
const usage = { input_tokens:1000,cached_input_tokens:500,output_tokens:732,total_tokens:1732 };
const ocx = (overrides={}) => ({requestId:"request",conversationId,timestamp:1000,durationMs:10910,
  genStartMs:10843,lastOutputMs:10908,usageStatus:"reported",
  usage:{inputTokens:1000,cachedInputTokens:500,outputTokens:732},...overrides});
async function fixture(t, records=[], codexStart=11850) {
  const dir=await mkdtemp(path.join(os.tmpdir(),"mcx-ocx-speed-"));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const sessionsDir=path.join(dir,"sessions");await mkdir(sessionsDir);
  const ocxUsagePath=path.join(dir,"usage.jsonl");
  const log=(timestamp,type,payload)=>JSON.stringify({timestamp:new Date(timestamp).toISOString(),type,payload})+"\n";
  const rolloutPath=path.join(sessionsDir,`rollout-${thread}.jsonl`);
  await writeFile(rolloutPath,
    log(1000,"event_msg",{type:"task_started",turn_id:"turn"})+
    log(11900,"event_msg",{type:"item_completed",item:{type:"Reasoning"},started_at_ms:codexStart,completed_at_ms:11900})+
    log(11930,"token_usage_record",{response_id:"response",usage,thread_token_usage:usage}));
  if(records.length)await writeFile(ocxUsagePath,records.map(r=>JSON.stringify(r)+"\n").join(""));
  return {reader:new SessionStatusReader({sessionsDir,ocxUsagePath}),ocxUsagePath,rolloutPath};
}

test("OCX short window and short Codex delivery never produce thousands of TPS",async t=>{
  const {reader}=await fixture(t,[ocx()]);const result=await reader.read(thread);
  assert.equal(result.observedTps,null);assert.equal(result.speedSource,"ocx");
  assert.equal(result.speedUnavailableReason,"decode_window_too_short");
  assert.equal(result.steps,1);assert.equal(result.outputTokens,732);
});

test("OCX generation window replaces Codex delivery, including late log arrival",async t=>{
  const {reader,ocxUsagePath}=await fixture(t);
  assert.equal((await reader.read(thread)).observedTps,null);
  await writeFile(ocxUsagePath,JSON.stringify(ocx({genStartMs:2910,lastOutputMs:10910}))+"\n");
  const result=await reader.read(thread);
  assert.equal(result.observedTps,92);assert.equal(result.observedModelMs,8000);
  assert.equal(result.speedSource,"ocx");assert.equal(result.speedSamples,1);
  assert.deepEqual(await reader.read(thread),result);
});

test("other conversations, mismatched usage, and ambiguous records cannot replace Codex data",async t=>{
  for(const records of [[ocx({conversationId:"other"})],[ocx({usage:{inputTokens:1000,cachedInputTokens:500,outputTokens:731}})],
    [ocx(),ocx({requestId:"another"})]]){
    const {reader}=await fixture(t,records);const result=await reader.read(thread);
    assert.equal(result.speedSource,"codex");assert.equal(result.observedTps,null);
  }
});

test("legacy OCX timing uses post-first-output fallback; invalid authoritative timing is not retried",async t=>{
  for(const [record,expected]of [[ocx({genStartMs:undefined,lastOutputMs:undefined,firstOutputMs:2910}),92],
    [ocx({genStartMs:10910,lastOutputMs:10843}),null]]){
    const {reader}=await fixture(t,[record]);const result=await reader.read(thread);
    assert.equal(result.observedTps,expected);assert.equal(result.speedSource,"ocx");
  }
});

test("partial lines, duplicate records and truncation respect incremental OCX log ownership",async t=>{
  const record=ocx({genStartMs:2910,lastOutputMs:10910});
  const {reader,ocxUsagePath}=await fixture(t,[record]);assert.equal((await reader.read(thread)).observedTps,92);
  const serialized=JSON.stringify(record);await appendFile(ocxUsagePath,serialized.slice(0,30));
  assert.equal((await reader.read(thread)).speedSamples,1);
  await appendFile(ocxUsagePath,serialized.slice(30)+"\n");assert.equal((await reader.read(thread)).speedSamples,1);
  await writeFile(ocxUsagePath,JSON.stringify(ocx())+"\n");
  assert.equal((await reader.read(thread)).observedTps,null);
  await writeFile(ocxUsagePath+".next",JSON.stringify(record)+"\n");
  await rename(ocxUsagePath+".next",ocxUsagePath);
  assert.equal((await reader.read(thread)).observedTps,92);
});

test("without OCX a valid Codex sample remains available; matched invalid OCX never falls back",async t=>{
  for(const [records,expected,source]of [[[],84,"codex"],[ [ocx()],null,"ocx"],
    [[ocx({usageStatus:"unsupported"})],null,"ocx"],
    [[ocx({timestamp:10000,durationMs:10000})],84,"codex"]]){
    const {reader}=await fixture(t,records,3180);const result=await reader.read(thread);
    assert.equal(result.observedTps,expected);assert.equal(result.speedSource,source);
  }
});

test("one OCX request cannot be assigned to two same-usage Codex responses",async t=>{
  const {reader,rolloutPath}=await fixture(t,[ocx({genStartMs:2910,lastOutputMs:10910})]);
  assert.equal((await reader.read(thread)).observedTps,92);
  await appendFile(rolloutPath,JSON.stringify({timestamp:new Date(11940).toISOString(),type:"token_usage_record",
    payload:{response_id:"other",usage,thread_token_usage:usage}})+"\n");
  const result=await reader.read(thread);
  assert.equal(result.speedSource,"codex");assert.equal(result.observedTps,null);
});
