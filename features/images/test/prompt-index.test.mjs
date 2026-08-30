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
