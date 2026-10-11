import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "MineCodex", version: __MCX_RELEASE_VERSION__ });
app.ontoolresult = () => {};
await app.connect();
window.minecodexMcpApp = app;
function syncHost(context) {
  // 宿主事件是增量更新；尺寸变化不能覆盖已同步的主题。
  if (!Object.hasOwn(context ?? {}, "theme")) return;
  window.minecodexHostTheme = context?.theme;
  window.dispatchEvent(new Event("minecodex-host-theme"));
}
app.addEventListener("hostcontextchanged", syncHost);
syncHost(app.getHostContext());
await import("../../../apps/dashboard/app.js");
await import("../../../apps/dashboard/assets/data-transfer.js");
