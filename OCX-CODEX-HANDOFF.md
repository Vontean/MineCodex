# ocx / Codex handoff

更新时间：2026-09-02 16:55（Asia/Shanghai）

## MCX Model Slider / Codex 0.152.0 兼容修复

本轮针对 Codex 升级后的 3 个回归已完成代码修复，尚待家中电脑做真实 UI 验收。

已确认的根因：

- Codex 0.152.0 的原生 `powerSelections` 是跨模型 preset：当前选择 `gpt-5.6-sol` 时，轨道实际为 `Tera low + Sol low/medium/high/xhigh`，虽然模型能力仍声明 `Sol low/medium/high/xhigh/max`。MCX 之前保留新版原生 Slider，因此错误地丢失了 Sol Max。
- MCX 之前仅在原生 Slider 菜单出现后接管其中的 model toggle；新版菜单节点和视图会重建，部分模型会重新进入原生 advanced model list。
- Composer 触发器的 MCX CSS 把原生 `max-width + ellipsis` 覆盖为无界 `nowrap + overflow: visible`，长模型名会压到 reasoning effort。
- 当前 Codex 原生 Slider 的 effort 语义样式为：`data-accent=true` 使用 `--color-chart-blue`，`data-maximum=true` 使用 `--color-chart-purple`。

已实现：

- 新版 Slider 菜单统一按当前模型的 `supportedReasoningEfforts` 重建 MCX shell，不再复用跨模型原生轨道。
- 无 reasoning effort 的 Tencent Hunyuan 等模型仍保留 MCX model list 入口。
- Composer 模型名恢复 110px 单行省略；Slider 顶部模型名最多两行，容器自然撑高。
- Slider effort 复用运行时解析的原生语义类，通过稳定 `data-accent` / `data-maximum` 获得蓝色 / Ultra 紫色，未硬编码 React 随机类名。
- 新增 `features/model-slider/DESIGN.md` 与针对性回归测试。

已通过：

```bash
npm run test:runtime
```

结果：runtime 85/85、全量 215/215 通过，`npm run check` 通过。

家中电脑继续：

```bash
git pull
npm install
npm test
npm run check
npm start
```

真实 UI 验收矩阵：

1. `gpt-5.6-sol`：Slider 从 Sol Light 开始，最右侧为 Sol Max。
2. `command-code/tencent-hy4-preview`：选择后再次打开 model list，仍为 MCX provider/favorite 面板。
3. `command-code/deepseek-deepseek-v4-flash-vision-exp`：Composer 名称与 effort 不重叠；Slider 标题最多两行且高度自适应。
4. 普通 effort 在打开的 Slider 中为原生蓝色；Ultra 为原生紫色；亮色和暗色主题各检查一次。
5. 复查 Fast toggle、键盘左右键、收藏排序与菜单最多六项滚动，确认无回归。

主要文件：

- `packages/runtime-host/src/codex-runtime.mjs`
- `packages/runtime-host/test/codex-runtime.test.mjs`
- `features/model-slider/DESIGN.md`

## 2026-09-02 本地兼容补丁

issue #3245 仍未解决。本机已采用可回滚的配置补丁：

```json
{
  "websockets": true
}
```

补丁写入 `/Users/vincent.lin/.opencodex/config.json`。根因定位更新如下：

- Codex 0.152.0 的 WebSocket 请求会正常到达 ocx；`websockets=false` 时 ocx 返回预期的 HTTP 426。
- Codex 随后打印 `falling back to HTTP`，但本地传输探针确认没有任何 HTTP POST 到达探针或 ocx，之后客户端报 `stream disconnected before completion`。
- 因此当前故障发生在 Codex 0.152.0 的 426 fallback 路径，完整请求并未进入 ocx Responses bridge；此前“bridge 与完整请求形状不兼容”的判断需要以这次传输层证据为准修正。
- 启用 ocx 内置 Responses WebSocket 后，完整 Command Code 请求和第一方 OpenAI 请求均一次完成并返回 `OK` / `turn.completed`。

已排除的替代方案：`streamMode=eager-relay`、OpenAI Provider 强制 HTTP/1.1、关闭 Codex zstd 请求压缩、提前关闭 Bun request timeout，均不能修复问题，已全部撤回。

回滚补丁：

```bash
ocx config set websockets false
ocx restore
ocx service stop
```

注意：升级 ocx 或 Codex 后，应先检查 issue #3245，并重新运行本节的两条验证命令；上游修复 426 fallback 后可撤回 `websockets=true`。

## 当前状态

- 本地补丁已启用：`websockets=true`。
- Codex 已路由到 `http://127.0.0.1:10100/v1`。
- ocx launchd service 已修复、加载并运行，重启保护正常。
- `streamMode` 和 `providers.openai.upstreamHttpVersion` 均无覆盖，保持默认行为；未保留源码补丁。

## 原 handoff 目标（补丁前）

停用 ocx，恢复 Codex 原生第一方模型；同时评估是否能用 OpenAI 官方 Codex 的第三方 Provider 配置，把以下模型作为原生可用模型接入：

- Command Code：DeepSeek V4 Flash
- Command Code：DeepSeek V4 Flash Vision
- z.ai：GLM 5.3 Flash
- OpenRouter：MiniMax M3 Free

要求：不影响第一方 OpenAI 模型；任何写入前都备份当前原生模型配置。

## 原 handoff 状态（补丁前）

- ocx 已执行 `ocx stop`，随后因 launchd 自动拉起，补执行 `ocx service stop`；最终确认 Proxy 未运行。
- Codex 配置已由 ocx restore 恢复；当前默认模型仍为 `gpt-5.6-luna`，没有设置 `model_provider`，因此默认 Provider 仍是内置 `openai`。
- 最终 `ocx status`：Proxy not running；`routing=native`；launchd service 已安装但未加载，不在提供 10100 服务。
- 本轮临时写入的 `openrouter_native` Provider、profile 和模型目录已撤回；当前不应继续使用 ocx，也不应执行 `ocx service repair`。

## 备份

以下备份均位于 `/Users/vincent.lin/.codex/backups/`，不含本 handoff 文档：

- `config.toml.20260902-115457.bak`：本轮开始前的 Codex 配置备份；SHA-256 `68b343f0aade1c163c9dfc562d3f79bf60602a868e236f1ddfbc42f8e7061204`
- `opencodex-catalog.json.20260902-115457.bak`：ocx 目录备份；SHA-256 `114180d14e582f7f0ab3701bd6e9151ee5e98f1c79cc92beb15742a2eff0c8d9`
- `config.toml.native-restored.20260902-115844.bak`：ocx restore 后、任何第三方配置写入前的原生配置备份；SHA-256 `729900ec9340092b8c91e080234b2753a6d3b1646bcee84ce308ad9e7927266c`

下一 thread 写入 `/Users/vincent.lin/.codex/config.toml` 前，应重新生成一次带当前时间戳的备份。

本地补丁前新增备份：

- `/Users/vincent.lin/.codex/backups/config.toml.pre-ocx-local-patch.20260902-152816.bak`；SHA-256 `a723168bebfe0ec2dbb6f59ed302d8a1e332e5f4e705f327317397651f800455`
- `/Users/vincent.lin/.opencodex/config.pre-eager-relay.20260902-153048.json`；SHA-256 `9fe525a0b0183224088680e2c8660b1534c7d5c92193239961c7eeadcf940be5`

## 已完成的故障证据

此前已完成以下 A/B 检查：

1. ocx 2.39.0、Bun 1.4.0、上游代理 `http://127.0.0.1:1082` 均可用。
2. `ocx doctor`、`ocx ready --wait --timeout 60` 成功；openai、command-code、zai Provider 测试成功。
3. 原生 Codex 直连第一方请求成功。
4. 通过 ocx 的完整 Codex Responses 请求在 launchd 后台和前台 A/B 都出现 `stream disconnected before completion`，不是单纯 launchd 环境变量问题。
5. 直接调用本地 ocx 的 Chat Completions，以及最小化 Responses 请求，都可以流式完成；问题更接近完整 Codex 请求形状与 ocx Responses bridge 的兼容性。
6. 已向 ocx GitHub 提交 issue：[#3245](https://github.com/lidge-jun/opencodex/issues/3245)。

## 关键协议结论

OpenAI 官方 Codex 当前配置文档：
<https://learn.chatgpt.com/docs/config-file/config-advanced>

官方方式是在用户级 `~/.codex/config.toml` 中定义 `[model_providers.<id>]`，通过 `model_provider` 选择活动 Provider；当前文档声明 `wire_api` 只有 `responses`。因此多个 Provider 通常需要 profile 或显式 `model_provider` 选择，而不是仅把不同 Provider 名称写进一个模型列表就能自动路由。

已核对的上游事实：

- Command Code 的 ocx adapter 实际请求 `https://api.commandcode.ai/alpha/generate`，使用专有 NDJSON 协议，并非 `/responses` 或标准 `/chat/completions`。原生 Codex 不能仅靠 `model_providers` 直接调用它。
- z.ai 当前 coding endpoint `https://api.z.ai/api/coding/paas/v4/chat/completions` 可达；同一 base path 下的 `/responses` 返回 404。原生 Codex 当前不能把它直接声明为 Responses Provider。
- OpenRouter 的 `https://openrouter.ai/api/v1/responses` 可达；模型 ID 已通过其 `/models` 接口确认是 `minimax/minimax-m3:free`。
- OpenRouter 的原生 profile 曾实际调用成功并返回 `OK`，但添加 profile 专用模型目录时发现 Codex catalog schema 还要求更多字段（至少报缺少 `truncation_policy`、随后报缺少 `experimental_supported_tools`）；该临时 profile 和目录已撤回，未留半成品。

## 原 handoff 决策点（补丁前）

不要默默把 Command Code / z.ai 改成 OpenRouter 路由。需要先明确选择：

1. 只接入真正兼容 Responses 的 OpenRouter 模型；或
2. 编写并维护独立的本地 Responses → Chat/Command Code bridge，再用 Codex 原生 Provider 指向 bridge；或
3. 继续等待 Command Code / z.ai 提供 Responses 兼容入口。

如果选择方案 2，需要额外设计 bridge 的进程管理、凭据读取、SSE/NDJSON 转换、工具调用、图片输入、错误和流式终止语义；这已经不是单纯修改 Codex `config.toml`。

## 下一 thread 建议检查

```bash
ocx status
/Applications/ChatGPT.app/Contents/Resources/codex --strict-config exec --help
sed -n '1,80p' /Users/vincent.lin/.codex/config.toml
```

上面的“确认 ocx 仍停止”是补丁前的历史建议；当前以本节后附的补丁检查命令为准。

本地补丁启用期间改为检查：

```bash
ocx status
ocx config get websockets
/Applications/ChatGPT.app/Contents/Resources/codex exec --ephemeral --sandbox read-only --skip-git-repo-check --json -c model_reasoning_effort=low -m gpt-5.6-luna 'Reply with exactly OK and do not use any tools.'
/Applications/ChatGPT.app/Contents/Resources/codex exec --ephemeral --sandbox read-only --skip-git-repo-check --json -c model_reasoning_effort=low -m command-code/deepseek-deepseek-v4-flash 'Reply with exactly OK and do not use any tools.'
```
