import assert from "node:assert/strict";
import test from "node:test";
import { CodexRuntime } from "../../../packages/runtime-host/src/codex-runtime.mjs";
import { HOST_BINDING_NAME } from "../../../packages/runtime-host/src/codex-injection.mjs";

test("Sites host bridge requires both the target token and declared action", async () => {
  const calls = [], responses = [];
  const runtime = new CodexRuntime({ features: [{ id: "sites", hostActions: ["sites"] }, { id: "other", hostActions: [] }], profileDir: "/tmp/mcx-sites-test", sitesService: { action: async payload => { calls.push(payload); return { sites: [] }; } } });
  runtime.bindingTokens.set("target", "secret"); runtime.resolveHostAction = async (_client, id, value) => responses.push({ id, value });
  const send = (token, featureId, action = "sites") => runtime.handleBindingCalled("target", {}, { name: HOST_BINDING_NAME, payload: JSON.stringify({ token, featureId, action, requestId: "request", payload: { operation: "list" } }) });
  await send("wrong", "sites"); assert.equal(calls.length, 0); assert.equal(responses.length, 0);
  await send("secret", "other"); assert.equal(calls.length, 0); assert.equal(responses.at(-1).value.error.code, "ACTION_NOT_ALLOWED");
  await send("secret", "sites"); assert.deepEqual(calls, [{ operation: "list" }]); assert.equal(responses.at(-1).value.ok, true);
  runtime.sitesService.action = async () => { throw new Error("broken storage"); };
  await send("secret", "sites"); assert.equal(responses.at(-1).value.error.code, "SITES_REQUEST_FAILED");
});
