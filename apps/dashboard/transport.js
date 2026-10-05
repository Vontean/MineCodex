// 浏览器继续走同源 HTTP；官方插件面板通过 MCP 调用同一套本地服务。
export async function dashboardFetch(url, options = {}) {
  const app = window.minecodexMcpApp;
  if (!app) return fetch(url, options);
  const method = options.method ?? "GET";
  const result = await app.callServerTool({
    name: method === "GET" ? "minecodex_read" : "minecodex_write",
    arguments: {
      route: url,
      method,
      locale: new Headers(options.headers).get("Accept-Language") ?? document.documentElement.lang,
      ...(options.body ? { body: JSON.parse(options.body) } : {}),
    },
  });
  if (result.isError) throw new Error(result.content?.find(item => item.type === "text")?.text ?? "MineCodex request failed");
  const { status, body } = result.structuredContent;
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
