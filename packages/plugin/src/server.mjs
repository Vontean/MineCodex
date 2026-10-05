import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAppResource, registerAppTool as registerSdkAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { readFileSync } from "node:fs";
import path from "node:path";
import { resolvePaths } from "../../cli/src/paths.mjs";
import { createControlClient } from "./control-client.mjs";
import { createPromptsClient } from "./prompts-client.mjs";
import { createAppHtml, createPromptsHtml } from "./ui-resource.mjs";
import { RELEASE_VERSION, CONTROL_RESOURCE_URI, PROMPT_RESOURCE_URI } from "./version.mjs";

export const APP_URI = CONTROL_RESOURCE_URI;
export const PROMPTS_URI = PROMPT_RESOURCE_URI;
export function createPluginServer({ promptsClient, paths = resolvePaths(), client = createControlClient({ paths, port: Number(process.env.MINECODEX_CONTROL_PORT ?? 47830) }) } = {}) {
  const icons = [{ src: `data:image/svg+xml;base64,${readFileSync(path.join(paths.packageRoot, "assets/brand/minecodex-icon.svg")).toString("base64")}`, mimeType: "image/svg+xml" }];
  const server = new McpServer({ name: "minecodex", version: RELEASE_VERSION, icons });
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
  const promptsResource = async uri => ({contents:[{
    uri,mimeType:RESOURCE_MIME_TYPE,text:promptsHtml ??= await createPromptsHtml(paths.packageRoot),
    _meta:{ui:{csp:{connectDomains:[],resourceDomains:["data:","blob:"]}}},
  }]});
  registerAppResource(server,"prompts",PROMPTS_URI,{},()=>promptsResource(PROMPTS_URI));
  const previousPromptsUri = "ui://minecodex/prompts.html";
  registerAppResource(server,"prompts-upgrade",previousPromptsUri,{},async()=>{
    server.sendToolListChanged();
    return promptsResource(previousPromptsUri);
  });
  let html;
  const controlResource = async uri => ({ contents: [{
    uri, mimeType: RESOURCE_MIME_TYPE, text: html ??= await createAppHtml(paths.packageRoot),
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: ["data:", "blob:"] } } },
  }] });
  registerAppResource(server, "control-panel", APP_URI, {}, () => controlResource(APP_URI));
  // 已打开的 Codex 入口仍可能保存旧 URI；通知重新发现，期间共用当前资源。
  const previousUri = "ui://minecodex/control-panel.html";
  registerAppResource(server, "control-panel-upgrade", previousUri, {}, async () => {
    server.sendToolListChanged();
    return controlResource(previousUri);
  });
  // 升级中宿主可能仍请求上版 URI；只提供当前页面并要求重新发现入口。
  for (const [name, read] of [["control-panel", controlResource], ["prompts", promptsResource]]) {
    server.registerResource(`${name}-version-upgrade`, new ResourceTemplate(`ui://minecodex/{release}/${name}.html`, {list:undefined}),
      {mimeType:RESOURCE_MIME_TYPE}, async (uri, {release}) => {
        if (typeof release !== "string" || !/^\d+\.\d+\.\d+$/.test(release)) throw new Error("Invalid release resource");
        server.sendToolListChanged();
        return read(uri.href);
      });
  }
  server.server.setRequestHandler(ListToolsRequestSchema, async () => ({tools}));
  server.server.oninitialized = () => server.sendToolListChanged();
  return server;
}
export async function servePlugin(options) {
  // 只提供界面与通信。退出插件进程不会停止增强服务或 Codex。
  await createPluginServer(options).connect(new StdioServerTransport());
}
