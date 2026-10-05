import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAppResource, registerAppTool as registerSdkAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { readFileSync } from "node:fs";
import path from "node:path";
import { resolvePaths } from "../../cli/src/paths.mjs";
import { createControlClient } from "./control-client.mjs";
import { createPromptsClient } from "./prompts-client.mjs";
import { createAppHtml, createPromptsHtml } from "./ui-resource.mjs";

export const APP_URI = "ui://minecodex/control-panel.html";
export const PROMPTS_URI = "ui://minecodex/prompts.html";
export function createPluginServer({ promptsClient, paths = resolvePaths(), client = createControlClient({ paths, port: Number(process.env.MINECODEX_CONTROL_PORT ?? 47830) }) } = {}) {
  const icons = [{ src: `data:image/svg+xml;base64,${readFileSync(path.join(paths.packageRoot, "assets/brand/minecodex-icon.svg")).toString("base64")}`, mimeType: "image/svg+xml" }];
  const server = new McpServer({ name: "minecodex", version: "0.1.0", icons });
  const promptIcons = [{src:`data:image/svg+xml;base64,${readFileSync(path.join(paths.packageRoot,"features/notes/assets/icons/prompt-entry.svg")).toString("base64")}`,mimeType:"image/svg+xml",sizes:["20x20"]}];
  const tools = [];
  // 使用公开 tools/list 协议补齐 SDK 高层注册尚未转发的工具图标。
  function registerAppTool(target, name, config, callback) {
    registerSdkAppTool(target,name,config,callback);
    tools.push({name,title:config.title,description:config.description,inputSchema:z.toJSONSchema(z.object(config.inputSchema)),
      annotations:config.annotations,_meta:config._meta,icons:name.startsWith("minecodex_prompts_") ? promptIcons : icons});
  }
  const ui = { resourceUri: APP_URI, visibility: ["app"] };
  registerAppTool(server, "minecodex_open", {
    title: "MineCodex", description: "Open the local MineCodex control panel.", inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui, "openai/ui": { entrypoints: [{ type: "global" }] } },
  }, async () => ({ content: [], structuredContent: {view:"control-panel"} }));
  const inputSchema = { route: z.string(), method: z.enum(["GET", "PATCH", "POST"]).default("GET"), locale: z.enum(["en", "zh-CN"]).default("en"), body: z.record(z.string(), z.unknown()).optional() };
  for (const write of [false, true]) {
    registerAppTool(server, write ? "minecodex_write" : "minecodex_read", {
      description: write ? "Save a user-selected setting, transfer data, or explicitly restart Codex from the control panel." : "Read local MineCodex control panel information.",
      inputSchema, _meta: { ui },
      annotations: { readOnlyHint: !write, destructiveHint: write, openWorldHint: false },
    }, async (input) => {
      if ((input.method !== "GET") !== write) throw new Error("Operation does not match the tool");
      return { content: [], structuredContent: await client.request(input.route, input.method, input.body, input.locale) };
    });
  }
  promptsClient ??= createPromptsClient({paths});
  const promptsUi = {resourceUri:PROMPTS_URI,visibility:["app"]};
  registerAppTool(server,"minecodex_prompts_open",{
    title:"Prompt",description:"Manage MineCodex prompts, categories and usage.",inputSchema:{},
    annotations:{readOnlyHint:true,openWorldHint:false},
    _meta:{ui:promptsUi,"openai/ui":{entrypoints:[{type:"global"}]}},
  },async()=>({content:[],structuredContent:{view:"prompts"}}));
  for (const write of [false,true]) registerAppTool(server,write ? "minecodex_prompts_write" : "minecodex_prompts_read",{
    description:write ? "Apply an explicit Prompts edit or record successful usage." : "Read MineCodex Prompts.",
    inputSchema:{route:z.string(),method:z.enum(["GET","POST","PATCH","DELETE"]).default("GET"),body:z.record(z.string(),z.unknown()).optional()},
    annotations:{readOnlyHint:!write,openWorldHint:false},_meta:{ui:promptsUi},
  },async({route,method,body})=>{
    if ((method !== "GET") !== write) throw new Error("Operation does not match the tool");
    return {content:[],structuredContent:{result:await promptsClient.request(route,method,body)}};
  });
  let promptsHtml;
  registerAppResource(server,"prompts",PROMPTS_URI,{},async()=>({contents:[{
    uri:PROMPTS_URI,mimeType:RESOURCE_MIME_TYPE,text:promptsHtml ??= await createPromptsHtml(paths.packageRoot),
    _meta:{ui:{csp:{connectDomains:[],resourceDomains:["data:","blob:"]}}},
  }]}));
  let html;
  registerAppResource(server, "control-panel", APP_URI, {}, async () => ({ contents: [{
    uri: APP_URI, mimeType: RESOURCE_MIME_TYPE, text: html ??= await createAppHtml(paths.packageRoot),
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: ["data:", "blob:"] } } },
  }] }));
  server.server.setRequestHandler(ListToolsRequestSchema, async () => ({tools}));
  return server;
}
export async function servePlugin(options) {
  // 只提供界面与通信。退出插件进程不会停止增强服务或 Codex。
  await createPluginServer(options).connect(new StdioServerTransport());
}
