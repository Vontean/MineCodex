# Chat 模型选择适配排查

验证日期：2026-09-10。项目版本：1.0.82；排查时 Runtime version：99，修复后：100。

## 原始问题

Chat 的模型选择器使用 `models.versionOptions`、`selectedModel` 和
`onModelChange`，与 Codex 普通任务的 `models[]`、`onSelectModel` 契约不同。
Model Slider 拦截了 Chat 的原生模型菜单入口，却没有提供相应的模型切换能力，
导致点击入口无响应。不是简单缺少一条 GPT-6 Pro 静态目录配置。

## 隔离窗口证据

使用官方 `/Applications/ChatGPT.app`，独立 profile
`/Users/mac/.codex-model-slider/codex-profile`，CDP 端口 `9233`。
未发送聊天消息；未修改日常实例的扩展安装或配置。

1. ChatGPT 模式 → Chat，原生选中值为
   `{slug: "gpt-5-6-thinking", thinkingEffort: "extended", versionId: "5.6"}`。
2. 未启用 Model Slider 时，原生菜单可展开 `Latest`、`GPT-5.6 Sol`、`GPT-5.5`。
3. 启用本项目 Model Slider 后，原生入口带上
   `data-codex-model-slider-toggle`；点击 `Select model` 无法展开版本列表。
   当前窗口未生成 generic shell，实际触发的是原生菜单降级分支。
4. 在隔离窗口 dispose 扩展后，同一个入口可以正常展开。
5. 选择 `Latest`，再将原生 slider 调至最后一档，真实 React 选中值为
   `{slug: "gpt-6-pro", thinkingEffort: null, versionId: "latest"}`。

这些验证证明模型选择可用；未验证发消息后的服务端推理执行。

## 数据含义

| 版本组 | 普通／Thinking 档位 | Pro 档位 |
| --- | --- | --- |
| `latest` | GPT-5.6 Sol | `gpt-6-pro` |
| `5.6` | GPT-5.6 Sol | `gpt-5-6-pro` |
| `5.5` | GPT-5.5 | `gpt-5-5-pro` |

因此 `Latest` 是一组跨模型的档位，不是一个可以直接提交的模型 slug。
仅在 `5.6` 组内调整到 Pro 不会选中 GPT-6 Pro。

## 源码因果链

- `packages/runtime-host/src/codex-injection.mjs` 的
  `nativeComposerModelController()` 将对象形式的 Chat 数据交给
  `chatComposerModelController()`。
- `chatComposerModelController()` 只读取当前 `selected.versionId`，构造一个
  模型条目，只实现 `onSelectReasoningEffort`，没有实现 `onSelectModel`。
- `openControllerModelMenu()` 要求 `onSelectModel` 为函数，否则直接返回。
- `enhanceNativeModelPicker()` 的降级分支仍拦截点击并阻止原生事件传播，
  然后调用上述无法工作的菜单函数。这是隔离窗口实际复现的路径。
- generic shell 的模型按钮也调用同一个函数，存在同样的契约缺口。

相关隐患：Chat 适配器只比较 `thinkingEffort` 来查找当前档位，没有同时比较
`slug`。Instant 和 Pro 都可能没有 `thinkingEffort`，不能靠该字段区分。
`Latest` 的显示名称也不能直接当作当前真实模型名。

## Temporary Chat 与验证边界

本机原生 bundle 中，`temporaryChat` 命令绑定 `CmdOrCtrl+Shift+N`。
其处理函数设置 composer mode 为 `chat`，导航至 `/` 并带
`temporary-chat=true`，使用 ChatGPT Chat 路径，而非 Codex 本地任务模型契约。

Codex 模式 Temporary Chat 的系统菜单 UI 验证未完成：CDP 键盘未触发
Electron 应用命令，原生应用控制工具拒绝访问 Codex。其同源判断来自源码，
不能当作该入口已经完成端到端复现。

## 最终实现

Chat／Temporary Chat 保留原生选择器。增强范围限定为 Codex 普通任务与 Work，
继续为官方与第三方模型提供统一的 Slider 面板。

- 删除 Chat controller 转换；发现 Chat 的 `selectedModel + onModelChange`
  契约后立即退出，不向祖先误取任务 controller。
- 仅对任务输入框注入样式、标签和点击处理；切换到 Chat 时清理增强状态。
- 优先读取当前打开的可见输入框，排除隐藏预加载输入框。
- 使用原生 `ViewPanel` 与 `data-explicit-model` 布局：上方强度、下方模型名，
  保留原生内边距和重置入口。拖动或键盘选择时同步预览强度。
- 档位继续由实际 controller 与模型能力生成，不写死型号或档位数量。
- Fast 按钮取决于实际 service tier 选项与切换方法，不按模型名称前缀猜测。
- 无模型切换方法时，不拦截原生模型入口。

## 最终验证

- `npm test`：217 项通过，包括任务／Chat 契约隔离、隐藏预加载输入框和
  当前打开面板优先级，以及既有模型档位行为测试。
- `npm run check` 与 `git diff --check` 通过。
- 在隔离实例通过 CDP 捕获原生 Work、Codex、第三方模型与 Chat 面板的 DOM
  和截图，再捕获增强版对照。最终 Codex 面板尺寸为 254 × 96 CSS px。
- Codex 普通任务：GPT-6 Astra 显示两行标题、Fast 和重置；DeepSeek V4 Flash
  显示 High／Max 两档、不显示 Fast，键盘切到 Max 后标题与滑块同步更新。
- Work：第三方模型重置后恢复原生默认 GPT-5.6 Sol、Light 与 Fast 控件。
- 切换到 Chat 后，扩展样式与增强 trigger 数量均为零，原生 Pro 面板保留。
- UI 证据位于本地 `output/playwright/model-picker/`（忽略提交），主要文件为
  `native-work.png`、`native-chat.png`、`enhanced-codex.png`、
  `enhanced-third-party.png` 和 `enhanced-third-party-max.png`。

未发送消息验证服务端推理，未将修改安装到日常实例。

## 面板细节复核

- 强度与箭头独立成组，避免下方长模型名撑宽网格、拉开箭头间距。
- 当前原生 Fast 与 Reset 的 SVG 都是 16 × 16 CSS px，按钮为 32 × 32，
  内层容器为 26 × 26。旧 Fast 缓存使用 20px 图标；现在优先从当前原生控件
  克隆对应开关状态的 SVG，保留实际路径与尺寸。
- 隔离 CDP 实测 Fast 开／关与 Reset 的图标均为 16 × 16，顶部对齐；
  第三方 High 与箭头保持相邻。截图：`fixed-gpt-icons.png`、
  `fixed-gpt-fast-active.png`、`fixed-third-party-spacing.png`。
