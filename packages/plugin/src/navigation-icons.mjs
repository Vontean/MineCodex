import { readFileSync } from "node:fs";

// 入口与品牌资源归官方插件；UI Adapter 只消费默认／选中资源契约。
const icon = path => `data:image/svg+xml;base64,${readFileSync(new URL(path, import.meta.url)).toString("base64")}`;
export const MCP_NAVIGATION_ICONS = [
  { tool: "minecodex_open", default: icon("../../../assets/brand/minecodex-icon.svg"), selected: icon("../../../assets/brand/minecodex-icon-selected.svg") },
  { tool: "minecodex_prompts_open", default: icon("../../../features/notes/assets/icons/prompt-entry.svg"), selected: icon("../../../features/notes/assets/icons/prompt-entry-selected.svg") },
];
