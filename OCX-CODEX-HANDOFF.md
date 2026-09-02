# ocx / Codex handoff

更新时间：2026-09-03（Asia/Taipei）

## 2026-09-03 真实隔离窗口复验

在独立 profile + CDP 9233 的 Codex 0.152.1 窗口中逐项点击和截图，确认上一版只真正修好了菜单 6px padding 与收藏分割线；另外三项仍有实际布局问题。本轮按实测几何修复：

- Composer 收起态解除 `_ModelPickerTriggerModelLabel_` 的 110px 外层上限，第三方长模型名完整 HUG；开盒后的 `Select model / Select effort` 恢复原生 160px Content 宽度。
- 无 Fast 模式时移除原生 `ViewControls::before` 的 12px 占位，模型按钮与 Slider 面板中心完全重合，长名称在头部最多两行。
- Slider 面板跟随占位 chip 宽度重新计算水平中心；二级模型菜单用强制 `translateX(-50%)` 保持同一中心线，不再向右偏移 132px。

9233 实测：占位 chip、Slider 面板、无 Fast 头部和二级模型菜单中心误差均不超过 1px；菜单 padding 为 6px，收藏分割线为 1px。

## 2026-09-02 家中电脑 QA：Codex 0.152.1 两处补充修复

家中电脑按 issue #18 完成隔离实例 QA（profile 副本 + CDP 9232 注入，Codex 0.152.1 / app 26.831.21537），发现并修复两处回归，已提交本 commit：

1. Slider 头部缺少原生可点击 chevron：0.152.1 起原生头行 aria-label 为 "Select model" 且带 `data-model-picker-view-toggle`，`nativeModelPickerRow` 不再命中，chevron 克隆被静默跳过。现优先从 view-toggle 行克隆 svg，旧结构走原路径兜底。
2. Composer 收起态改为 hug 契约（QA 反馈：固定 110px 截断不符预期）：原生按自身 label（路由模型为 "Select effort"）给 `_ModelPickerTriggerContent_` 钉了 inline min-width（约 139-160px），类样式又钉 max-width: 160px，长名称被截断、effort 被挤出盖在麦克风下。现收起态（data-state="closed"）解除两个方向的钉定，模型名完整显示、热区 hug；宽度不足时名称先省略（ellipsis 回退），effort `flex-shrink: 0` 永远完整可见；展开态触发器 max-width: 264px 对齐 slider 面板，此时名称才截断。

追加（同日）：家中电脑 QA 发现 0.152.1 还有两处回归（头部 chevron 消失、收起态宽度被钉死），并要求触发器宽度规则完全跟随原生。从 app.asar 提取 0.152.1 渲染层源码后确认原生契约并重写：

- 原生名称 span（`_ModelPickerTriggerModelText_`/`_ModelPickerTriggerModelLabel_`）本就带 `max-width: 110px` + ellipsis + `flex-shrink: 1`；Content 为 `flex + justify-content: center + max-width: 160px`，其 inline min-width 由 JS 按 Measurement 探针测量动态设置；弹层（`_ModelPickerDropdownContent_`）宽 224px 且原生自带相对芯片的水平居中补偿。此前多版 CSS/JS 覆盖（hug、264px 固定宽、自研开合动画）全部回退。
- chevron：0.152.1 原生头行 aria-label 为 "Select model"，旧 `nativeModelPickerRow` 不再命中；改为优先从 `data-model-picker-view-toggle` 行克隆 svg，旧结构保留兜底。
- MCX 唯一新增职责：enhance 时把显示标签同步进 Measurement 探针文本，原生测量、临时钉定、弹层居中即可自动得到真实显示宽度。原生 ModelText 重建空窗期保留立即回插逻辑，并复用孤儿标签避免双名称。
- 重要教训：`_ModelPickerTriggerModelLabel_` 是包住名称行的容器 span，不是名称本身；对容器做隐藏或标签匹配会让名称连 MCX 标签一起消失，测试已加反向断言锁死。

验证：`npm run check` 通过，runtime 56/56，全量 215/215；隔离实例目检确认收起/展开/居中/chevron 均与原生一致。QA 期间全局安装的 mcx 1.0.4 与 9231 主实例未受影响；9232 隔离实例与 QA runtime host 仍在本机运行供人工复验。

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
