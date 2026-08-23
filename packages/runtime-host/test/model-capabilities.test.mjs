import assert from "node:assert/strict";
import test from "node:test";
import {
  applyVisibleReasoningLevels,
  loadModelCapabilities,
  mergeCapability,
} from "../src/model-capabilities.mjs";

test("mergeCapability uses OpenCodex configured efforts", () => {
  const provider = { modelReasoningEfforts: { "glm-5.2": ["high", "max"] } };
  const cap = mergeCapability(provider, "glm-5.2");
  assert.equal(cap.source, "opencodex");
  assert.deepEqual(cap.levels, ["high", "max"]);
  assert.equal(cap.rawEfforts?.includes("low"), false);
});

test("mergeCapability returns null when OpenCodex declares nothing", () => {
  assert.equal(mergeCapability({}, "hy3"), null);
});

test("mergeCapability marks noReasoningModels", () => {
  const cap = mergeCapability({ noReasoningModels: ["kimi-k2"] }, "kimi-k2");
  assert.equal(cap.source, "opencodex");
  assert.equal(cap.kind, "no-effort");
});

test("loadModelCapabilities reads only OpenCodex config and fails open when absent", async () => {
  const read = async (filePath) => {
    if (filePath.endsWith("config.json")) {
      return JSON.stringify({ providers: { "opencode-go": { modelReasoningEfforts: { hy3: ["low", "high"] } } } });
    }
    throw new Error("should not read other files");
  };
  const caps = await loadModelCapabilities({ read });
  assert.deepEqual(caps.get("opencode-go/hy3"), {
    source: "opencodex", kind: "effort", levels: ["low", "high"], map: null, rawEfforts: ["low", "high"],
  });
  const empty = await loadModelCapabilities({ read: async () => { throw new Error("missing"); } });
  assert.equal(empty.size, 0);
});

test("applyVisibleReasoningLevels filters only declared capabilities and keeps fail-open", () => {
  const model = { slug: "opencode-go/hy3", supportedReasoningLevels: [
    { effort: "low" }, { effort: "medium" }, { effort: "high" }, { effort: "max" },
  ] };
  const filtered = applyVisibleReasoningLevels(model, { levels: ["low", "high"] }, model.supportedReasoningLevels);
  assert.deepEqual(filtered.supportedReasoningLevels.map((x) => x.effort), ["low", "high"]);
  const open = applyVisibleReasoningLevels(model, null, model.supportedReasoningLevels);
  assert.deepEqual(open.supportedReasoningLevels.map((x) => x.effort), ["low", "medium", "high", "max"]);
});
