import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,appendFile,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {ThreadPromptIndex} from "../src/prompt-index.mjs";

test("completed generation events with historical generating status retain revised prompts and refresh",async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"mcx-prompt-index-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const localThread="019f6090-89c8-71b2-8aa5-2577e9343c93",sessions=path.join(root,"sessions"),itemId="exec-image";
  await mkdir(sessions);
  const records=[
    {type:"custom_tool_call",name:"exec",call_id:"call",input:'generatedImage(await tools.image_gen__imagegen({prompt:"submitted"}));'},
    {type:"custom_tool_call_output",call_id:"call",output:`generated_images/${localThread}/${itemId}.png`},
    {type:"item_completed",thread_id:localThread,item:{type:"Extension",kind:"image_gen.generation",status:"generating",id:itemId,revisedPrompt:"actual revised prompt"}},
    {type:"item_completed",item:{type:"Extension",kind:"other",status:"completed",id:"unrelated",revisedPrompt:"wrong"}},
  ];
  await writeFile(path.join(sessions,`rollout-${localThread}.jsonl`),records.map(payload=>JSON.stringify({payload})).join("\n"));

  const index=new ThreadPromptIndex({sessionRoots:[sessions]});t.after(()=>index.close());
  assert.equal(await index.find(localThread,itemId),"actual revised prompt");
  await appendFile(path.join(sessions,`rollout-${localThread}.jsonl`),"\n"+JSON.stringify({payload:{type:"item_completed",item:{type:"Extension",kind:"image_gen.generation",status:"completed",id:itemId,revisedPrompt:"updated revised prompt"}}}));
  assert.equal(await index.find(localThread,itemId),"updated revised prompt");
  assert.equal(await index.find(localThread,"missing"),null);
});
