# Codex Runtime Host

本机个人 Codex 功能的统一运行宿主。它是统一 Injector 与生命周期宿主，负责：

- 连接或启动支持 loopback CDP 的隔离 Codex 桌面实例；
- 从同级项目的 `codex-feature.json` 注册 Sidebar 或 Conversation toolbar 入口；
- 挂载 full-page、Pinned Summary，并把 Detail iframe Surface 优先注册为 Codex 原生右侧 Task Tab；
- 把 Codex 当前 resolved Theme Tokens 同步给每个 Surface；
- 执行经过 manifest allowlist、Surface 身份和 renderer token 校验的 Host actions；
- 维护共享 CDP、注入与可信通信；插件专有的 Codex 协议由各功能 Adapter 维护。

各功能项目继续拥有自己的数据、HTTP API 与页面。宿主不读取业务数据库；单个
功能服务失效不会阻止 Codex 或其他功能运行。

## 启动与验证

```bash
npm start
npm test
npm run check
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
  传入包含 `Component`、`isAvailable`、`kind` 和 `dropDestinations` 的标签描述对象，
  用稳定的 `featureId-detailId` 聚焦或创建唯一原生 Tab；capability 不可用时返回明确错误。
- `resolve-file-paths`：通过 Codex preload 暴露的 Electron file bridge 解析 Finder
  drop 的真实 `File` 对象。

## Adapter 生命周期与故障边界

- 只在 top frame 安装 Runtime，绝不向业务 iframe 注入 binding token。
- Watch / refresh 串行；已连接 Renderer 不重复连接，关闭 target 会清理状态。
- 当前 Codex document 始终直接注入或替换 Runtime，绝不通过 CDP reload Codex 页面。
  本地 Surface 不直接导航到 loopback URL：Host 先创建 `about:blank` iframe，再校验
  manifest URL、health service/protocol/instance，抓取 HTML 并用 `Page.setDocumentContent`
  写入目标 frame。Images/Notes 只向精确的 `app://-` Origin 开放 CORS。
- CDP 重连时同步轮换后的 binding token；保留已就绪的 Surface 和编辑草稿，
  使用新 token 重试未就绪页面，避免弹窗停留在空白 iframe。
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
| React right-panel `openTab`、Task scope、JSX runtime | private internal capability | 动态发现 bundle 并做能力检测；失败时返回明确的不可用错误 |
| toolbar、summary、tabs、Composer selectors | DOM inference | 统一留在本 Adapter |
| `Runtime.addBinding`、`DOM.setFileInputFiles`、注入脚本 | high-risk CDP | 必须使用隔离 profile 验收 |
| `togglePinnedSummary`、`composer.addFiles` 字符串 | 探索证据 | 当前实现不把它们当契约 |

这是非官方 CDP / DOM Adapter，不是公开的 Codex Contribution API。Codex 更新后按协议所有者修复：共享注入和生命周期归宿主，专有原生组件与 API 归对应插件 Adapter；领域规则与 Web UI不应直接跟随外部协议重写。


## 共享弹窗与浮层

通用视觉、原生材质分支、遮罩及层级的权威来源为根 [DESIGN.md](../../DESIGN.md)，内部文件导航见 [AGENTS.md](../../AGENTS.md)。组件库目标与现有实现归属见 [UI 架构](../ui/ARCHITECTURE.md)。本节只说明当前接入契约。

`packages/ui/src/install.mjs` 组装共享组件源码，在 Renderer 中只安装一次，由 page-script 的 `config.ui` 调用：

```js
config.ui.heading(dialog, { title, closeLabel, onClose, back });
const actions = config.ui.footer(document.createElement("div"));
actions.append(config.ui.action(saveButton, "primary"));
config.ui.overlay(backdrop);
config.ui.surface(popover); // 只统一材质，保留功能的定位与内容
```

`heading` 标记 dialog 并创建标题及 Close；`back` 是可选的已有按钮节点。容器宽高、内容、原生 dialog 或自定义焦点管理、关闭后的焦点恢复继续由功能负责。`footer` 只装饰直接子按钮，`action` 的 tone 为 ghost / secondary / primary / danger。不要再在插件中复制背景、阴影、标题和底部按钮规则。

共享组件已迁入 UI workspace。Prompts 与 Sites 管理弹窗选用 opaque / Sites Share；Quick Prompts 使用 ComposerMenu；管理菜单和模型列表选择 Dropdown，Session Status 与任务切换选择 Popover。组件库负责各分支视觉，宿主不复制实现。

page-script 可以用 manifest 的 `entry.resources` 声明本功能内的 CSS/图标资源，宿主读取后通过 `config.resources` 一次传入。JSON 作为数据、其他文件作为文本；越出功能目录的路径会被拒绝。它不改变 host action、服务启动或消息协议。

Images 提示词面板沿用原生 File info 的附属信息面板结构；iframe 页面继续通过宿主接收主题。会话统计与云 Library 业务归所属插件，Runtime Host 只组合业务能力和外部连接。领域规则与架构层参见根 [ARCHITECTURE.md](../../ARCHITECTURE.md)。

`entry.sourceFactory` 可声明本插件内的源码工厂，导出 `createPageScriptSource()` 并返回 Renderer 函数体字符串。工厂路径不能越出插件；纯领域函数由插件工厂序列化，宿主不维护规则副本。Images 使用这一接口共享图片提示词溯源规则。

Model Slider 的模型规则、原生控制器适配和专有呈现位于插件 `src/domain` / `src/frontend`，安装源码由插件工厂组装。宿主仅提供配置、locale、共享 UI、图标与刷新调度，维护 ensure/dispose 接线；原生菜单开合和节点恢复由插件负责。

## 项目控制台入口

Runtime Host 在账号菜单 Settings 下挂载 MineCodex 项目入口，不属于可开关的插件。`minecodex/open-control-panel` 是独立 builtin action，必须通过对应 renderer 的 binding token 验证；它不接受任意 URL 或 shell 参数，固定调用包内 CLI 的 `gui` 命令。组件的项目图标、外链箭头与菜单模板由共享 UI 提供。

CLI 继续通过一次性 browser exchange 打开控制台。macOS 默认 Safari 与 Chrome/Chromium、Edge、Brave、Vivaldi 支持查找现有控制台标签页并激活；没有匹配页才调用系统默认浏览器打开登录地址。自动化权限被拒绝时返回错误，不用重复开页掩盖失败。其他浏览器和 Windows 保留系统 URL 打开行为，目前不保证标签页复用。

### 暂停功能的接入

`codex-feature.json` 的 `disabled:true` 表示保留源码但暂停运行时接入。发现阶段在加载 Adapter、资源和注入源码之前跳过该功能，显式启用 ID 也不能恢复它。Task Toast（`unread-inbox`）于 2026-10-03 暂停；CLI／控制台已移除其注册入口，配置归一化清除旧启用项。恢复时须同时重新评估注入场景并恢复 manifest 与用户入口。

## 更新后的注入自检

Renderer 的 `selfCheck()` 按功能返回安装结果、必要原生锚点与设计 token 证据。插件通过 `config.registerSelfCheck(probe)` 注册同步只读检查；Model Slider 由所属控制器 Adapter 提供检查。没有检查或未取得当前证据时保持 unknown，不按全局接入标记所有功能成功。

Runtime Host 在每个窗口完成注入后读取一次 snapshot，保存本次启动检查结果，不按2秒周期重复读取锚点和 token。新窗口、页面重载、重新连接或 session 变化后重新检查一次；窗口退出时撤销证据，检查读取失败保持未确认。现有窗口发现与连接维护周期保留，但不重复执行自检。结果只代表检查时所在页面，后续页面切换或外观变化不会自动更新该记录；页面缺少适用场景与能力失效分别报告。就绪文件保留窗口范围，CLI 与 Dashboard 显示 checking / partial / degraded / unavailable / not-applicable 等汇总状态。后台服务管理只报告后台状态。

Design token 从实际控件作用域读取原生名称、已知别名、计算值与项目映射值，记录是否一致。功能源码与资源中实际消费的 `var(--mcx-*)` 决定检查清单；有明确 CSS fallback 的缺失项保留诊断，不单独判定功能失效。注册表全量 token 在 document 根的诊断只提供观察，不要求未使用的 token 全部存在。

自检不会打开菜单、选择模型、保存内容、上传图片或证明全功能兼容；原生操作结果与指定构建的人工验收必须单独记录。诊断记录不含账号、会话内容、绑定令牌、源码对象或原始异常文本。
