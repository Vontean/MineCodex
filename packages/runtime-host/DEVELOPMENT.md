# Codex Runtime Host

MineCodex 增强功能在 Codex 桌面端的注入与生命周期宿主，负责：

- 连接支持 loopback CDP 的 Codex 桌面实例，向每个 Renderer 注入同一份 Runtime；
- 从功能 manifest 发现 `page-script` 与 `composer-model-selector` 入口，并启动声明了服务的功能进程；
- 把 Codex 当前主题 token 同步到根节点的 `--mcx-*` 变量，供页面脚本与共享 UI 使用；
- 执行经过 manifest allowlist 与 Renderer binding token 校验的 host action；
- 汇总每个窗口的注入自检结果；插件专有的 Codex 协议由各功能 Adapter 维护。

各功能继续拥有自己的数据与服务。宿主不读取业务数据库；单个功能服务失效不会阻止
Codex 或其他功能运行。

## 隔离验收

注入依赖 high-risk CDP 与私有 DOM，单元测试不能证明真实 Renderer 中的行为。凡是改动注入、原生协议、布局或交互，都在隔离的 Codex 窗口中经 CDP 验收；不在日常窗口验收，也不复用日常 MineCodex 后台的 CDP 连接，避免影响用户正在进行的会话、草稿和数据。

隔离包含三部分，缺一不算隔离：

- **独立 profile**：用单独的 `--user-data-dir` 启动 Codex，与日常窗口不共享登录态、会话与缓存。
- **独立 CDP 端口**：任选一个空闲端口，只要不与日常 MineCodex 后台（`CODEX_RUNTIME_CDP_PORT`）及其他正在运行的 Codex 实例冲突。
- **独立业务数据**：验收带数据的功能时，把数据指向临时目录，例如 Notes 的 `CODEX_NOTES_DATA_DIR`、Sites 的 `MINECODEX_SITES_DATA_DIR`、Model Slider 的 `MINECODEX_MODEL_DATA_FILE`。仅隔离 profile 不代表功能数据已隔离。

以下命令从仓库根执行，`PORT` 与 `PROFILE` 替换为本次选择的端口和目录。

1. 启动独立 Codex（macOS）：

   ```bash
   open -na /Applications/ChatGPT.app --args \
     --user-data-dir="$PROFILE" \
     --remote-debugging-address=127.0.0.1 \
     --remote-debugging-port=$PORT \
     --remote-allow-origins=http://127.0.0.1:$PORT \
     --no-first-run
   ```

   Windows 版 Codex 为 MSIX 应用，需经包注册入口传入同样的参数（见 [CLI 开发约定](../cli/DEVELOPMENT.md) 的应用身份一节）；手动隔离启动尚未整理为固定命令。

2. 启动只加载待验收功能的宿主，接入同一 profile 与端口：

   ```bash
   CODEX_FEATURES_ROOT="$PWD/features" \
   MINECODEX_ENABLED_FEATURES=<feature-id,...> \
   CODEX_RUNTIME_PROFILE_DIR="$PROFILE" \
   CODEX_RUNTIME_CDP_PORT=$PORT \
   node packages/runtime-host/src/main.mjs
   ```

3. 经 CDP 验证：读取注入自检结果，调用待验收的 host action，并在隔离窗口完成真实操作（点击、键盘、切换页面与卸载）。需要检查懒加载的原生模块时运行 `MCX_PROBE_PORT=$PORT npm run check:native`，并先打开对应页面。
4. 结束后关闭隔离窗口与宿主进程，还原测试草稿，删除临时数据。截图与一次性记录放 `docs/verification/`。

结果写进所属功能文档的“最近隔离验证”：注明 Codex 构建、已覆盖与未覆盖的范围。接口加载通过不等于用户操作通过，两者分别记录。

本地回归：

```bash
npm run test:runtime
npm run check
```

## 发现、资源与服务身份

当前 manifest 字段、入口类型和可用 host action 以 `src/feature-registry.mjs` 及实际功能 manifest 为准。入口只有 `page-script` 与 `composer-model-selector` 两类，缺少或使用其他 `entry.kind` 的 manifest 直接报错。`HOST_ACTIONS` 只登记有功能声明且 `CodexRuntime` 已实现的动作；功能停用某个动作时同时删除登记与处理器。

资源、图标与源码工厂限制在所属功能目录。源码工厂显式组装序列化依赖，资源由宿主读取后传入；业务规则不在宿主复制。协议 ID 保持语言无关，可见标签使用 locale map 或现有字符串分支。

带本机服务的功能（当前为 Notes）在 manifest 声明 `surfaceUrl`、`healthUrl` 与 `command`：`surfaceUrl` 只作为服务基址，决定是否启动进程，并经 `pageScriptServiceOrigin` 得出页面脚本可经宿主访问的 loopback 源。HTTP 服务健康必须同时匹配功能身份、协议版本和本次宿主传入的 instanceId。仅可达或返回 2xx 不能证明是所属进程，避免复用其他实例或过期服务。检查失败按已声明 command 启动并验证所属服务；page-script 不虚构 HTTP 健康状态。

## Host action 通道

page-script 通过 `config.requestHostAction(action, payload)`、Model Selector 通过安装时传入的 `requestAction` 发起请求。Renderer 先核对该功能 manifest 的 `hostActions`，再经 CDP `Runtime.addBinding` 带上本窗口随机 binding token 交给宿主；宿主再次核对 token 与 allowlist，按 target 串行执行，并用 `resolveHostAction` 回送结果。页面请求 10 秒超时，Runtime 卸载时拒绝所有未完成请求。

当前动作与实现位置：

| 动作 | 功能 | 宿主实现 |
| --- | --- | --- |
| `sites` | Sites | `features/sites/src/backend/sites-service.mjs` |
| `model-favorites` | Model Slider | `features/model-slider/src/backend/favorites.mjs` |
| `quick-prompts` | Notes | 仅转发到声明服务源中 `assertPromptsRequest` 允许的路由 |
| `local-image-source` | Images | `features/images/src/backend/local-image-source.mjs` |

Session Status 的 `refresh-session-status` 是宿主内建通知，不经 allowlist，只触发当前 target 的状态推送。功能页面只有收到明确成功结果后才能更新“最近调用”等产品状态。

Runtime 另向页面脚本暴露 `window.__codexPersonalRuntime.insertText(text, editable)`：恢复已保存的 Composer selection/caret，无法恢复时另起一行追加；Notes 快捷提示词通过它填入 Composer。

## Adapter 生命周期与故障边界

- 只在 top frame 安装 Runtime。
- Watch / refresh 串行；已连接 Renderer 不重复连接，关闭 target 会清理状态。
- 当前 Codex document 始终直接注入或替换 Runtime，绝不通过 CDP reload Codex 页面。
  同版本、同 session 的重复注入只更新 binding 并重新 ensure；session 变化时先卸载旧 Runtime。
- CDP 重连时同步轮换后的 binding token，页面脚本保留原有状态，后续请求使用新 token。
- Renderer 内的 MutationObserver 把 DOM 变化合并到下一帧调用 Model Selector 的 ensure；
  主题相关属性变化时重新同步根节点 `--mcx-*` 变量。
- 单个 page-script 安装失败只标记该功能自检失败，不影响其他功能。

## 当前接口分类

| 路径 | 分类 | 说明 |
| --- | --- | --- |
| loopback HTTP、manifest、host action 请求与结果 | 项目自有稳定接口 | 可由测试直接覆盖 |
| Composer selectors、主题 token 名称 | DOM inference | 共享注入与 Composer 插入归宿主；功能专有协议归所属 Adapter |
| `Runtime.addBinding`、`Page.addScriptToEvaluateOnNewDocument`、注入脚本 | high-risk CDP | 必须使用隔离 profile 验收 |

这是非官方 CDP / DOM Adapter，不是公开的 Codex Contribution API。Codex 更新后按协议所有者修复：共享注入和生命周期归宿主，专有原生组件与 API 归对应插件 Adapter；领域规则与 Web UI不应直接跟随外部协议重写。


## UI 安装与功能接线

宿主安装共享 UI 源码，并通过 `config.ui` 传给 page-script；组件接入与恢复契约见 [UI 局部约定](../ui/DESIGN.md)，视觉选型见根 [DESIGN.md](../../DESIGN.md)。宿主不持有通用组件实现或功能材质副本。

Model Slider 的原生控制器、菜单与节点恢复归功能，宿主只维护配置与共享句柄传递、ensure/dispose 调度。其他功能的专有协议遵循根 [ARCHITECTURE.md](../../ARCHITECTURE.md)。

## 项目控制台入口

项目入口由 `packages/plugin` 通过官方 MCP Apps 的 global entrypoint 注册，
不再由 Runtime Host 注入账号菜单。插件控制台经 MCP 调用既有 CLI 本地控制服务；
增强运行时独立维护生命周期，关闭面板或退出插件不停止注入。

CLI 继续通过一次性 browser exchange 打开控制台。macOS 默认 Safari 与 Chrome/Chromium、Edge、Brave、Vivaldi 支持查找现有控制台标签页并激活；没有匹配页才调用系统默认浏览器打开登录地址。自动化权限被拒绝时返回错误，不用重复开页掩盖失败。其他浏览器和 Windows 保留系统 URL 打开行为，目前不保证标签页复用。

## 更新后的注入自检

Renderer 的 `selfCheck()` 按功能返回安装结果、必要原生锚点与设计 token 证据。插件通过 `config.registerSelfCheck(probe)` 注册同步只读检查；Model Slider 由所属控制器 Adapter 提供检查。没有检查或未取得当前证据时保持 unknown，不按全局接入标记所有功能成功。

Runtime Host 在每个窗口完成注入后读取一次 snapshot，若结果未确认、锚点不可用或 token 降级，在最多 30 秒启动窗口内借用发现周期重试；恢复正常或超过期限后保存结果，不再周期读取锚点和 token。读取失败也在此窗口内重试，超时保留真实异常。新窗口、页面重载、重新连接或 session 变化后重新检查一次；窗口退出时撤销证据，检查读取失败保持未确认。现有窗口发现与连接维护周期保留，但不重复执行自检。结果只代表检查时所在页面，后续页面切换或外观变化不会自动更新该记录；页面缺少适用场景与能力失效分别报告。就绪文件保留窗口范围，CLI 与 Dashboard 显示 checking / partial / degraded / unavailable / not-applicable 等汇总状态。后台服务管理只报告后台状态。

Design token 从实际控件作用域读取原生名称、已知别名、计算值与项目映射值，记录是否一致。功能源码与资源中实际消费的 `var(--mcx-*)` 决定检查清单；有明确 CSS fallback 的缺失项保留诊断，不单独判定功能失效。document 根只列出实际已定义的 token；局部或可选变量缺失不作为全局异常，实际消费作用域仍完整检查必要值及映射。

自检不会打开菜单、选择模型、保存内容、上传图片或证明全功能兼容；原生操作结果与指定构建的人工验收必须单独记录。诊断记录不含账号、会话内容、绑定令牌、源码对象或原始异常文本。
