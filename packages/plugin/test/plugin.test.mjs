import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { assertControlRequest, createControlClient } from "../src/control-client.mjs";
import { createPluginServer, APP_URI, PROMPTS_URI } from "../src/server.mjs";
import { createPromptsClient } from "../src/prompts-client.mjs";
import { installPlugin } from "../src/install.mjs";
import { resolvePaths, PACKAGE_ROOT } from "../../cli/src/paths.mjs";
import { createControlServer } from "../../cli/src/control-server.mjs";
import { RELEASE_VERSION } from "../src/version.mjs";
import { writeConfig, readConfig } from "../../cli/src/config.mjs";

test("MCP bridge saves through the real HTTP control service without weakening browser authentication", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mcx-plugin-http-"));
  const paths = { ...resolvePaths(), configPath: path.join(directory, "config.json"), tokenPath: path.join(directory, "token") };
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: false } });
  await writeFile(paths.tokenPath, "test-token");
  const service = await createControlServer({ paths, token: "test-token", port: 0, logger: { error() {} }, runtimeManager: { status: () => ({ running: true, appliedFeatures: [] }) } });
  try {
    const client = createControlClient({ paths, port: service.port });
    const saved = await client.request("/api/features/notes", "PATCH", { enabled: true }, "zh-CN");
    assert.equal(saved.status, 200); assert.equal(saved.body.saved, true);
    assert.equal((await readConfig(paths.configPath)).features.notes, true);
    const unauthenticated = await fetch(service.url + "/api/status");
    assert.equal(unauthenticated.status, 401);
    const foreignOrigin = await fetch(service.url + "/api/features/notes", { method: "PATCH", headers: { Authorization: "Bearer test-token", Origin: "https://foreign.example", "Content-Type": "application/json" }, body: '{"enabled":false}' });
    assert.equal(foreignOrigin.status, 403);
    assert.equal((await readConfig(paths.configPath)).features.notes, true);
  } finally { await service.close(); await rm(directory, { recursive: true, force: true }); }
});

test("plugin control bridge accepts only dashboard operations and never exposes the bearer token", async () => {
  for (const route of ["https://evil.example/", "/api/auth/exchange", "/api/status?token=secret", "/api/features/../restart"]) {
    assert.throws(() => assertControlRequest({ route }), /Unsupported/);
  }
  assert.throws(() => assertControlRequest({ route: "/api/features/notes", method: "PATCH", body: { enabled: "true" } }));
  assert.throws(() => assertControlRequest({ route: "/api/features/notes", method: "PATCH", body: { enabled: true, url: "evil" } }));
  assertControlRequest({ route: "/api/features/notes", method: "PATCH", body: { enabled: true } });
  const directory = await mkdtemp(path.join(os.tmpdir(), "mcx-plugin-client-"));
  try {
    const tokenPath = path.join(directory, "token");
    await writeFile(tokenPath, "private-token\n");
    let request;
    const client = createControlClient({ paths: { tokenPath }, port: 12345, fetchImpl: async (url, options) => {
      request = { url, options };
      return Response.json({ saved: true });
    } });
    const response = await client.request("/api/features/notes", "PATCH", { enabled: true }, "zh-CN");
    assert.equal(request.url, "http://127.0.0.1:12345/api/features/notes");
    assert.equal(request.options.headers.Origin, "http://127.0.0.1:12345");
    assert.equal(request.options.headers.Authorization, "Bearer private-token");
    assert.equal(request.options.headers["Accept-Language"], "zh-CN");
    assert.equal(JSON.stringify(response).includes("private-token"), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("real MCP discovery advertises a native global entry and serves an offline UI; read cannot mutate", async () => {
  const calls = [];
  const server = createPluginServer({ paths: resolvePaths(), promptsClient:{request:async()=>({prompts:[]})}, client: { request: async (...input) => {
    calls.push(input); return { status: 200, body: { saved: true } };
  } } });
  const client = new Client({ name: "test", version: "1" });
  const [front, back] = InMemoryTransport.createLinkedPair();
  await server.connect(back); await client.connect(front);
  try {
    const { tools } = await client.listTools();
    const entry = tools.find(tool => tool.name === "minecodex_open");
    assert.deepEqual(entry._meta["openai/ui"].entrypoints, [{ type: "global" }]);
    assert.equal(entry._meta.ui.resourceUri, APP_URI);
    assert.equal(APP_URI, `ui://minecodex/${RELEASE_VERSION}/control-panel.html`);
    assert.equal(client.getServerVersion().version, RELEASE_VERSION);
    assert.deepEqual(entry._meta.ui.visibility, ["app"]);
    const brand = await readFile(path.join(PACKAGE_ROOT, "assets/brand/minecodex-icon.svg"), "utf8");
    assert.equal(Buffer.from(client.getServerVersion().icons[0].src.split(",")[1], "base64").toString("utf8"), brand);
    const promptsEntry = tools.find(tool=>tool.name === "minecodex_prompts_open");
    assert.equal(promptsEntry.title,"Prompt");
    assert.deepEqual(promptsEntry.icons[0].sizes,["20x20"]);
    assert.equal(Buffer.from(promptsEntry.icons[0].src.split(",")[1],"base64").toString("utf8"),await readFile(path.join(PACKAGE_ROOT,"features/notes/assets/icons/prompt-entry.svg"),"utf8"));
    assert.equal(Buffer.from(entry.icons[0].src.split(",")[1],"base64").toString("utf8"),brand);
    assert.equal(promptsEntry._meta.ui.resourceUri,PROMPTS_URI);
    assert.deepEqual(promptsEntry._meta["openai/ui"].entrypoints,[{type:"global"}]);
    const promptOpen=await client.callTool({name:"minecodex_prompts_open",arguments:{}});
    assert.equal(promptOpen.structuredContent.view,"prompts");
    const promptsResource=await client.readResource({uri:PROMPTS_URI});
    assert.match(promptsResource.contents[0].text,/pm-heading/);
    assert.doesNotMatch(promptsResource.contents[0].text,/<script[^>]+src=/);
    const state=await client.callTool({name:"minecodex_prompts_read",arguments:{route:"/api/state"}});
    assert.deepEqual(state.structuredContent.result,{prompts:[]});
    const rejectedPrompt=await client.callTool({name:"minecodex_prompts_read",arguments:{route:"/api/insertions",method:"POST",body:{promptId:"saved"}}});
    assert.equal(rejectedPrompt.isError,true);
    const initial = await client.callTool({ name: "minecodex_open", arguments: {} });
    assert.equal(initial.isError, undefined); assert.equal(initial.structuredContent.view,"control-panel"); assert.equal(calls.length, 0);
    const resource = await client.readResource({ uri: APP_URI });
    const html = resource.contents[0].text;
    assert.match(html, /id="plugin-list"/);
    assert.doesNotMatch(html,/pm-card-footer/);
    assert.match(html, /id="data-dialog"/);
    assert.doesNotMatch(html, /<script[^>]+src=|<link/);
    assert.doesNotMatch(html, /url\("\/assets/);
    const rejected = await client.callTool({ name: "minecodex_read", arguments: { route: "/api/restart", method: "POST", body: {} } });
    assert.equal(rejected.isError, true); assert.equal(calls.length, 0);
    const saved = await client.callTool({ name: "minecodex_write", arguments: { route: "/api/features/notes", method: "PATCH", body: { enabled: true } } });
    assert.equal(saved.structuredContent.body.saved, true); assert.equal(calls.length, 1);
  } finally { await client.close(); await server.close(); }
});

test("installation uses official CLI commands and a dedicated marketplace, preserving other plugins", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mcx-plugin-install-"));
  const calls = [];
  try {
    const paths = { packageRoot: PACKAGE_ROOT, supportDir: directory };
    const installed = await installPlugin({ paths, node: "/node with spaces/node", execFileImpl: async (command, args) => {
      calls.push({ command, args }); return { stdout: "{}" };
    } });
    assert.deepEqual(calls[1].args, ["plugin", "add", "minecodex@minecodex-local", "--json"]);
    const config = JSON.parse(await readFile(path.join(installed.root, "plugins/minecodex/.mcp.json"), "utf8"));
    const manifest = JSON.parse(await readFile(path.join(installed.root, "plugins/minecodex/.codex-plugin/plugin.json"), "utf8"));
    assert.equal(manifest.version, RELEASE_VERSION);
    assert.equal(config.mcpServers.minecodex.command, "/node with spaces/node");
    assert.deepEqual(config.mcpServers.minecodex.args, [path.join(PACKAGE_ROOT, "packages/cli/bin/mcx.mjs"), "plugin", "serve"]);
    assert.equal(JSON.stringify(config).includes("control-token"), false);
    assert.equal(await readFile(path.join(installed.root, "plugins/minecodex/assets/icon.svg"), "utf8"), await readFile(path.join(PACKAGE_ROOT, "assets/brand/minecodex-icon.svg"), "utf8"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("Prompt uses the MCX feature switch and never starts a separate service", async () => {
  const directory=await mkdtemp(path.join(os.tmpdir(),"mcx-prompt-client-"));
  const configPath=path.join(directory,"config.json");let calls=0;
  const client=createPromptsClient({paths:{configPath},port:12345,fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,"http://127.0.0.1:12345/api/state");assert.equal(options.headers.Origin,"app://-");
    return Response.json({prompts:[]});
  }});
  try {
    await writeConfig(configPath,{features:{notes:false}});
    await assert.rejects(client.request("/api/state"),/Enable Prompts/);assert.equal(calls,0);
    await writeConfig(configPath,{features:{notes:true}});
    assert.deepEqual(await client.request("/api/state"),{prompts:[]});assert.equal(calls,1);
    await assert.rejects(client.request("/api/insertions/claim","POST",{}),/Unsupported/);assert.equal(calls,1);
  } finally {await rm(directory,{recursive:true,force:true});}
});
