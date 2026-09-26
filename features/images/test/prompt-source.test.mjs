import assert from "node:assert/strict";
import test from "node:test";
import { tracePromptSource, recordedCommandOutput } from "../src/prompt-source.mjs";

test("restores a stored command output with the recorded string transformation", () => {
  const stored = new Map();
  const source = `const r = await tools.exec_command({cmd:"never execute"}); store('hallPrompt',r.output.substring(r.output.indexOf('\\n')+1));text(r.output);`;
  const output = recordedCommandOutput([{type:"input_text",text:"Script completed\nOutput:\n"},{type:"input_text",text:"status line\nExact historical prompt\n"}]);
  tracePromptSource(source, stored, output);
  assert.equal(tracePromptSource(`await tools.image_gen__imagegen({prompt:load('hallPrompt') + "Extra requirement"});`, stored), "Exact historical prompt\nExtra requirement");
});

test("ignores fake calls inside strings, unknown expressions, and truncated output", () => {
  const stored = new Map();
  tracePromptSource(`store('p', 'original');`, stored);
  assert.equal(tracePromptSource(`text("tools.image_gen__imagegen({prompt:'fake'})");`, stored), null);
  assert.equal(tracePromptSource(`await tools.image_gen__imagegen({prompt: unknown()});`, stored), null);
  assert.equal(recordedCommandOutput([{type:"input_text",text:"Warning: truncated output"}]), undefined);
  tracePromptSource(`const r = await tools.exec_command({cmd:"never execute"}); store('p',r.output);text(r.output);`, stored);
  assert.equal(stored.has("p"), false);
  assert.equal(tracePromptSource(`await tools.image_gen__imagegen({prompt:load('p')});`, stored), null);
});

test("uses final assignments and refuses ambiguous multi-image calls", () => {
  assert.equal(tracePromptSource(`let p='before';p='after';generatedImage(await tools.image_gen__imagegen({prompt:p}));`,new Map()),"after");
  assert.equal(tracePromptSource(`await tools.image_gen__imagegen({prompt:'a'});await tools.image_gen__imagegen({prompt:'b'});`,new Map()),null);
  const stored = new Map([["p","old"]]);
  assert.equal(tracePromptSource(`if (unknown) store('p','new'); await tools.image_gen__imagegen({prompt:load('p')});`,stored),null);
  assert.equal(stored.size,0);
});
