# Codex Runtime Host

本机个人 Codex 功能的统一运行宿主。它是统一 Injector 与生命周期宿主，负责：

- 连接或启动支持 loopback CDP 的隔离 Codex 桌面实例；
- 从功能 manifest 发现并组装声明的 Renderer / Surface 接入；
- 挂载 full-page、Pinned Summary，并把 Detail iframe Surface 优先注册为 Codex 原生右侧 Task Tab；
- 把 Codex 当前 resolved Theme Tokens 同步给每个 Surface；
- 执行经过 manifest allowlist、Surface 身份和 renderer token 校验的 Host actions；
- 维护共享 CDP、注入与可信通信；插件专有的 Codex 协议由各功能 Adapter 维护。

各功能项目继续拥有自己的数据、HTTP API 与页面。宿主不读取业务数据库；单个
功能服务失效不会阻止 Codex 或其他功能运行。

## 隔离启动与验证

以下命令从仓库根执行。先按 [Model Slider 隔离说明](../../features/model-slider/DEVELOPMENT.md) 显式启动独立 Codex 窗口，再让宿主接入同一 profile / CDP；示例仅加载 Model Slider，避免启动其他功能服务。

```bash
CODEX_FEATURES_ROOT="$PWD/features" \
MINECODEX_ENABLED_FEATURES=model-slider \
CODEX_RUNTIME_PROFILE_DIR="$HOME/.codex-model-slider/codex-profile" \
CODEX_RUNTIME_CDP_PORT=9233 \
node packages/runtime-host/src/main.mjs
```

改变验证范围时，服务端口和业务数据目录也应隔离；仅设置 Electron profile 不代表所有功能数据已隔离。运行参数查询启动入口与所属功能，不使用默认启动命令替代隔离接入。

```bash
npm run test:runtime
npm run check
```

## 发现、资源与服务身份

当前 manifest 字段、入口类型和可用 host action 以 `src/feature-registry.mjs` 及实际功能 manifest 为准。page-script、模型选择器与 iframe Surface 保留各自加载方式；旧 Sidebar / Conversation toolbar 能力仍有独立契约，但历史 Notes 的 Summary / Todo 示例不代表当前 Prompt 入口。

资源、图标与源码工厂限制在所属功能目录。源码工厂显式组装序列化依赖，资源由宿主读取后传入；业务规则不在宿主复制。协议 ID 保持语言无关，可见标签使用 locale map 或现有字符串分支。

HTTP 服务健康必须同时匹配功能身份、协议版本和本次宿主传入的 instanceId。仅可达或返回 2xx 不能证明是所属进程，避免复用其他实例或过期服务。检查失败按已声明 command 启动并验证所属服务；page-script 不虚构 HTTP 健康状态。

旧 Conversation toolbar Surface 的入口属于原生中间功能组，不扩宽最右侧面板按钮组；克隆按钮时根据真实关闭、hover 与打开状态更新表现，避免固化模板的激活样式。

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
| toolbar、summary、tabs、Composer selectors | DOM inference | 共享 Surface 接入归宿主；功能专有协议归所属 Adapter |
| `Runtime.addBinding`、`DOM.setFileInputFiles`、注入脚本 | high-risk CDP | 必须使用隔离 profile 验收 |
| `togglePinnedSummary`、`composer.addFiles` 字符串 | 探索证据 | 当前实现不把它们当契约 |

这是非官方 CDP / DOM Adapter，不是公开的 Codex Contribution API。Codex 更新后按协议所有者修复：共享注入和生命周期归宿主，专有原生组件与 API 归对应插件 Adapter；领域规则与 Web UI不应直接跟随外部协议重写。


## UI 安装与功能接线

宿主安装共享 UI 源码，并通过 `config.ui` 传给 page-script；组件接入与恢复契约见 [UI 局部约定](../ui/DESIGN.md)，视觉选型见根 [DESIGN.md](../../DESIGN.md)。宿主不持有通用组件实现或功能材质副本。

Model Slider 的原生控制器、菜单与节点恢复归功能，宿主只维护配置与共享句柄传递、ensure/dispose 调度。其他功能的专有协议遵循根 [ARCHITECTURE.md](../../ARCHITECTURE.md)。

## 项目控制台入口

项目入口由 `packages/plugin` 通过官方 MCP Apps 的 global entrypoint 注册，
不再由 Runtime Host 注入账号菜单。插件控制台经 MCP 调用既有 CLI 本地控制服务；
增强运行时独立维护生命周期，关闭面板或退出插件不停止注入。

CLI 继续通过一次性 browser exchange 打开控制台。macOS 默认 Safari 与 Chrome/Chromium、Edge、Brave、Vivaldi 支持查找现有控制台标签页并激活；没有匹配页才调用系统默认浏览器打开登录地址。自动化权限被拒绝时返回错误，不用重复开页掩盖失败。其他浏览器和 Windows 保留系统 URL 打开行为，目前不保证标签页复用。

### 暂停功能的接入

`codex-feature.json` 的 `disabled:true` 表示保留源码但暂停运行时接入。发现阶段在加载 Adapter、资源和注入源码之前跳过该功能，显式启用 ID 也不能恢复它。Task Toast（`unread-inbox`）于 2026-10-03 暂停；CLI／控制台已移除其注册入口，配置归一化清除旧启用项。恢复时须同时重新评估注入场景并恢复 manifest 与用户入口。

## 更新后的注入自检

Renderer 的 `selfCheck()` 按功能返回安装结果、必要原生锚点与设计 token 证据。插件通过 `config.registerSelfCheck(probe)` 注册同步只读检查；Model Slider 由所属控制器 Adapter 提供检查。没有检查或未取得当前证据时保持 unknown，不按全局接入标记所有功能成功。

Runtime Host 在每个窗口完成注入后读取一次 snapshot，若结果未确认、锚点不可用或 token 降级，在最多 30 秒启动窗口内借用发现周期重试；恢复正常或超过期限后保存结果，不再周期读取锚点和 token。读取失败也在此窗口内重试，超时保留真实异常。新窗口、页面重载、重新连接或 session 变化后重新检查一次；窗口退出时撤销证据，检查读取失败保持未确认。现有窗口发现与连接维护周期保留，但不重复执行自检。结果只代表检查时所在页面，后续页面切换或外观变化不会自动更新该记录；页面缺少适用场景与能力失效分别报告。就绪文件保留窗口范围，CLI 与 Dashboard 显示 checking / partial / degraded / unavailable / not-applicable 等汇总状态。后台服务管理只报告后台状态。

Design token 从实际控件作用域读取原生名称、已知别名、计算值与项目映射值，记录是否一致。功能源码与资源中实际消费的 `var(--mcx-*)` 决定检查清单；有明确 CSS fallback 的缺失项保留诊断，不单独判定功能失效。document 根只列出实际已定义的 token；局部或可选变量缺失不作为全局异常，实际消费作用域仍完整检查必要值及映射。

自检不会打开菜单、选择模型、保存内容、上传图片或证明全功能兼容；原生操作结果与指定构建的人工验收必须单独记录。诊断记录不含账号、会话内容、绑定令牌、源码对象或原始异常文本。
