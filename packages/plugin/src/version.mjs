import { readFileSync } from "node:fs";

export const RELEASE_VERSION = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")).version;

// Codex 保留 App 沙箱；发布时改变资源身份，不能只替换同一 URI 的 HTML。
export const CONTROL_RESOURCE_URI = `ui://minecodex/${RELEASE_VERSION}/control-panel.html`;
export const PROMPT_RESOURCE_URI = `ui://minecodex/${RELEASE_VERSION}/prompts.html`;
