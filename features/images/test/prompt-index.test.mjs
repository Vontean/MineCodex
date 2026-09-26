import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { findImagePrompt } from "../src/prompt-index.mjs";

test("findImagePrompt associates a wrapped imagegen prompt with its generated exec image", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-prompt-index-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const threadId = "01a04ea6-7346-7db1-9dba-67fdeeb2ea4d";
  const itemId = "exec-673549d1-abe4-4722-95a8-ee85b7fa765c";
  const expectedPrompt = "Recolor only the selected cube to restrained warm gold.";
  const sessionDir = path.join(root, "2026", "08", "30");
  await mkdir(sessionDir, { recursive: true });
  const logPath = path.join(sessionDir, `rollout-2026-08-30T01-52-06-${threadId}.jsonl`);
  const callId = "call-imagegen-1";
  await writeFile(logPath, [
    {
      type: "response_item",
      payload: {
        type: "custom_tool_call",
        name: "exec",
        call_id: callId,
        input: `const result = await tools.image_gen__imagegen({referenced_image_paths:["/tmp/source.png"],prompt:${JSON.stringify(expectedPrompt)}}); generatedImage(result);`,
      },
    },
    {
      type: "response_item",
      payload: {
        type: "custom_tool_call_output",
        call_id: callId,
        output: [{
          type: "input_text",
          text: `Generated images are saved as /Users/test/.codex/generated_images/${threadId}/${itemId}.png by default.`,
        }],
      },
    },
  ].map(JSON.stringify).join("\n"));

  assert.equal(await findImagePrompt({
    sessionRoots: [root],
    threadId,
    imageGenerationItemId: itemId,
  }), expectedPrompt);
});

test("static template prompts survive interleaved exec waits without cross-association", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-prompt-wait-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const threadId = "thread-wait";
  const records = [
    { type: "custom_tool_call", name: "exec", call_id: "a", input: 'const r = await tools.image_gen__imagegen({prompt: `Line one\nLine two`}); generatedImage(r);' },
    { type: "custom_tool_call_output", call_id: "a", output: "Script running with cell ID 87" },
    { type: "custom_tool_call", name: "exec", call_id: "b", input: 'const r = await tools.image_gen__imagegen({prompt: "Other image"}); generatedImage(r);' },
    { type: "custom_tool_call_output", call_id: "b", output: "Script running with cell ID 88" },
    { type: "function_call", name: "wait", call_id: "wait-b", arguments: '{"cell_id":"88"}' },
    { type: "function_call_output", call_id: "wait-b", output: "generated_images/thread-wait/image-b.png" },
    { type: "function_call", name: "wait", call_id: "wait-a", arguments: '{"cell_id":"87"}' },
    { type: "function_call_output", call_id: "wait-a", output: "Script running with cell ID 87" },
    { type: "function_call", name: "wait", call_id: "wait-a2", arguments: '{"cell_id":"87"}' },
    { type: "function_call_output", call_id: "wait-a2", output: [{ type: "input_text", text: "generated_images/thread-wait/image-a.png" }] },
    { type: "custom_tool_call", name: "exec", call_id: "dynamic", input: 'await tools.image_gen__imagegen({prompt: `Do ${unknown}`});' },
    { type: "custom_tool_call_output", call_id: "dynamic", output: "generated_images/thread-wait/image-dynamic.png" },
  ];
  await writeFile(path.join(root, `rollout-${threadId}.jsonl`), records.map(payload => JSON.stringify({payload})).join("\n"));
  const find = imageGenerationItemId => findImagePrompt({sessionRoots: [root], threadId, imageGenerationItemId});
  assert.equal(await find("image-a"), "Line one\nLine two");
  assert.equal(await find("image-b"), "Other image");
  assert.equal(await find("image-dynamic"), null);
  assert.equal(await find("unrecorded-image"), null);
});

test("resolves a stored historical output into the exact generated file", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-stored-prompt-"));
  context.after(() => rm(root, {recursive:true,force:true}));
  const threadId = "stored-prompt-thread";
  const records = [
    {type:"custom_tool_call",name:"exec",call_id:"prep",input:`const r=await tools.exec_command({cmd:"historical command"});store('p',r.output.substring(r.output.indexOf('\\n')+1));text(r.output);`},
    {type:"custom_tool_call_output",call_id:"prep",output:[{type:"input_text",text:"Script completed\nOutput:\n"},{type:"input_text",text:"status\nThe original stored prompt"}]},
    {type:"custom_tool_call",name:"exec",call_id:"gen",input:`const r=await tools.image_gen__imagegen({prompt:load('p')});generatedImage(r);`},
    {type:"custom_tool_call_output",call_id:"gen",output:[{type:"input_text",text:`Generated images are saved as generated_images/${threadId}/image-stored.png`}]},
  ];
  await writeFile(path.join(root, `rollout-${threadId}.jsonl`),records.map(payload=>JSON.stringify({payload})).join("\n"));
  assert.equal(await findImagePrompt({sessionRoots:[root],threadId,imageGenerationItemId:"image-stored"}),"The original stored prompt");
});
