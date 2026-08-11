# Codex Runtime Host

本机个人 Codex 功能的统一运行宿主。它是唯一的 Injector / Adapter，负责：

- 连接或启动支持 loopback CDP 的隔离 Codex 桌面实例；
- 从同级项目的 `codex-feature.json` 注册 Sidebar 或 Conversation toolbar 入口；
- 挂载 full-page、Pinned Summary，并把 Detail iframe Surface 优先注册为 Codex 原生右侧 Task Tab；
- 把 Codex 当前 resolved Theme Tokens 同步给每个 Surface；
- 执行经过 manifest allowlist、Surface 身份和 renderer token 校验的 Host actions；
- 把所有易变的 Codex DOM / CDP 细节留在一个 Adapter 中。

各功能项目继续拥有自己的数据、HTTP API 与页面。宿主不读取业务数据库；单个
功能服务失效不会阻止 Codex 或其他功能运行。

## 启动与验证

```bash
npm start
npm test
npm run check:runtime
```

宿主默认扫描上层目录中的同级项目。只有当 manifest 的 `healthUrl` 返回的 JSON 同时满足
`ok === true`、`service === feature.id`、`protocolVersion === 1`，且 `instanceId` 等于本次 RuntimeHost
生成并传给功能进程的 `MINECODEX_FEATURE_INSTANCE_ID` 时，宿主才会复用现有服务。仅仅可达或
返回 2xx 的 foreign / stale 服务不会被信任；身份不匹配时，宿主会在项目目录执行其
`command`。可用以下环境变量启动隔离实例：

```bash
CODEX_FEATURES_ROOT=/path/to/features \
CODEX_RUNTIME_PROFILE_DIR=/tmp/codex-profile \
CODEX_RUNTIME_CDP_PORT=9232 \
MINECODEX_CODEX_EXECUTABLE=/path/to/Codex \
npm start
```

## Sidebar / page manifest

旧 manifest 保持兼容；没有 `entry` 时默认仍是 Sidebar：

```json
{
  "schemaVersion": 1,
  "id": "images",
  "label": "Images",
  "surfaceUrl": "http://127.0.0.1:47831/",
  "placement": { "after": "sites", "order": 10 },
  "command": ["node", "src/main.mjs"],
  "icon": {
    "viewBox": "0 0 24 24",
    "markup": "<rect ...></rect>"
  }
}
```

## Conversation toolbar / responsive summary manifest

```json
{
  "schemaVersion": 1,
  "id": "notes",
  "label": { "en": "Notes", "zh-CN": "笔记" },
  "surfaceUrl": "http://127.0.0.1:47832/?surface=summary",
  "healthUrl": "http://127.0.0.1:47832/api/health",
  "entry": {
    "kind": "conversation-toolbar",
    "ariaLabel": { "en": "Toggle pinned notes", "zh-CN": "切换固定笔记" }
  },
  "pinnedSummary": {
    "label": { "en": "Pinned Notes", "zh-CN": "固定笔记" },
    "surfaceUrl": "http://127.0.0.1:47832/?surface=summary",
    "presentation": "responsive-summary",
    "overlayLabel": { "en": "Toggle notes", "zh-CN": "切换笔记" },
    "pinnedLabel": { "en": "Toggle pinned notes", "zh-CN": "切换固定笔记" }
  },
  "detailTabs": [
    { "id": "todo", "label": { "en": "Todo", "zh-CN": "待办" }, "surfaceUrl": "http://127.0.0.1:47832/?surface=todo" },
    { "id": "prompts", "label": { "en": "Prompts", "zh-CN": "提示词" }, "surfaceUrl": "http://127.0.0.1:47832/?surface=prompts" }
  ],
  "hostActions": ["insert-text", "attach-file", "open-detail-tab", "open-editor-modal", "resolve-file-paths"],
  "command": ["node", "src/main.mjs"],
  "icon": { "resource": "node_modules/lucide-static/icons/notebook-tabs.svg" }
}
```

`icon.resource` 必须留在功能项目目录内。宿主读取真实 SVG 的 `viewBox` 与内部
markup；功能不需要把第三方 SVG 复制进 manifest。

`label`、`entry.ariaLabel`、Pinned Summary 的三个 label 与 Detail Tab label 均可使用
单个字符串或 `{ "en": "…", "zh-CN": "…" }` locale map。字符串 manifest 保持
向后兼容；locale map 以 English 为 fallback，并按 Codex 文档语言选择显示文本。
Host action、feature id 与 detail id 是协议标识，必须保持语言无关。

Conversation toolbar 入口复制原生按钮结构后会规范化交互类：关闭态保持透明并使用
tertiary icon color，只有真实 hover 或 `data-state=open` 时才使用 Codex 原生
`list-hover-background`，避免把创建瞬间的原生激活样式固化到功能按钮上。
Conversation toolbar 的结构遵循原生分组，而不只追求图标顺序：有原生 Summary 时，
Feature 入口直接加入 Summary 所在的中间功能组并紧跟在 Summary 后；New Chat 尚无
Summary 时，宿主在中间 toolbar 的右端建立同构的 Summary feature group。可见的
`Toggle bottom panel` 仅作为 New Chat 状态下定位中间 toolbar 的稳定锚点，Feature 不会
进入也不会扩宽最右侧的 Bottom Panel / Side Panel 原生组。

## Surface 协议

Surface 发给 Host：

- `codex-personal:ready`
- `codex-personal:close`
- `codex-personal:open-thread`
- `codex-personal:host-action`
- `codex-personal:surface-metrics`

Host 发给 Surface：

- `codex-personal:theme`
- `codex-personal:host-result`
- `codex-personal:surface-active`（`active: true | false`）

`codex-personal:theme` 同时携带标准化后的 `locale`（当前为 `en` 或 `zh-CN`），
Surface 可用它同步自身可见文案与辅助功能标签。
Page Surface 每次显示或隐藏时都会收到 `codex-personal:surface-active`；iframe 重新加载后，
Host 会再次发送当前状态。功能页面可据此暂停隐藏状态下的轮询或其他后台工作。

每个 iframe 消息同时校验 `event.origin` 与准确的 `contentWindow`。Host action
还必须在对应 feature 的 allowlist 中；需要 Node/CDP 的原生动作使用每个 Renderer
独立的随机 binding token，并按 target 串行执行。功能页面只有收到明确成功结果后
才能更新“最近调用”等产品状态。

当前 Host actions：

- `insert-text`：替换已保存的 Composer selection/caret；无法恢复时另起一行追加。
- `attach-file`：用 CDP 填充临时 file input，再把真实 `File` drop 给 Composer；只有
  观察到原生附件 chip/preview 才报告 `attach`，否则明确返回 `insert-path`。
- `open-detail-tab`：动态发现当前 Codex React right-panel controller 与当前 Task scope，
  用稳定的 `featureId-detailId` 聚焦或创建唯一原生 Tab；capability 不可用时才回退到
  RuntimeHost 自建的兼容 Tab host。
- `resolve-file-paths`：通过 Codex preload 暴露的 Electron file bridge 解析 Finder
  drop 的真实 `File` 对象。

## Adapter 生命周期与故障边界

- 只在 top frame 安装 Runtime，绝不向业务 iframe 注入 binding token。
- Watch / refresh 串行；已连接 Renderer 不重复连接，关闭 target 会清理状态。
- 当前 Codex document 始终直接注入或替换 Runtime，绝不通过 CDP reload Codex 页面。
  本地 Surface 不直接导航到 loopback URL：Host 先创建 `about:blank` iframe，再校验
  manifest URL、health service/protocol/instance，抓取 HTML 并用 `Page.setDocumentContent`
  写入目标 frame。Images/Notes 只向精确的 `app://-` Origin 开放 CORS。
- 入口由 Renderer 内的 MutationObserver 幂等挂载，React 重绘不会产生重复入口。
- Summary 根据对话主区域宽度连续派生 `overlay / shift / gutter`：小于 1096px
  使用临时 Popover；1096–1535px 预留 316px 并把对话内容左移 158px；更宽时
  放入右侧 gutter 而不移动对话。
- Popover 与 inline Summary 只占可见矩形，不使用透明全屏 overlay；原生 Portal
  可以保持更高层级。Surface 上报自然高度，Host 再按窗口可用高度截断，内容组件
  自己拥有唯一的纵向 scroller。
- Host 把当前 Codex Summary 的 section title、row type、icon color/size、radius、
  border、dropdown background 和 elevation tokens 发送给 Surface。
- 新客户端会话默认关闭；Thread 切换关闭 Pinned Summary 并清除旧 Composer Range。
- Detail Tab 使用 Codex 当前 `local-thread` scope，因此标签状态跟随 Task；React panel
  中的 iframe 继续注册同一套可信 Host origin、`contentWindow`、Theme 与 Host-action bridge。
- Surface 以 `ready` handshake 标记可用。若第一次加载发生在服务离线期间，下一次
  打开只重新请求 Host 加载这个未 ready 的 frame；已经 ready 的 Surface 不重载、不打断草稿。

## 当前接口分类

| 路径 | 分类 | 说明 |
| --- | --- | --- |
| loopback HTTP、manifest、Surface message schema | 项目自有稳定接口 | 可由测试直接覆盖 |
| `window.electronBridge.getPathForFile` | 当前稳定 internal/preload | 仅用于 Finder `File` 路径解析 |
| React right-panel `openTab`、Task scope、JSX runtime | private internal capability | 动态发现 bundle 并做能力检测；失败时回退自建 Tab host |
| toolbar、summary、tabs、Composer selectors | DOM inference | 统一留在本 Adapter |
| `Runtime.addBinding`、`DOM.setFileInputFiles`、注入脚本 | high-risk CDP | 必须使用隔离 profile 验收 |
| `togglePinnedSummary`、`composer.addFiles` 字符串 | 探索证据 | 当前实现不把它们当契约 |

这是非官方 CDP / DOM Adapter，不是公开的 Codex Contribution API。Codex 更新后应只
在这个宿主中修复；各功能的数据和 Web UI不需要跟随重写。
