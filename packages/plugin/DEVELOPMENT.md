# 官方 Codex 插件接入

此模块拥有官方 MCP Apps 的入口、资源与控制台通信。架构角色图见根 ARCHITECTURE.md。
后台服务和注入生命周期继续属于 CLI 与 Runtime Host，插件不得启动另一套运行时，
也不得在插件关闭时停止现有服务。

- `plugin.json`：本地插件描述，安装时写入官方兼容 manifest。
- `src/install.mjs`：生成独立 marketplace，调用 `codex plugin marketplace add` 和
  `codex plugin add`；不直接改 Codex 配置，不重启 GUI。
- `src/server.mjs`：stdio MCP server、global entrypoint 与 UI resource。
- `src/navigation-icons.mjs`：入口默认／选中资源；Runtime 将资源交给共享 UI 原生导航 Adapter，不拥有导航状态。
- `src/control-client.mjs`：固定 loopback origin、操作白名单、Node 侧鉴权与图标转换。
- `src/app.mjs`：官方 MCP Apps SDK 初始化，然后加载原有 Dashboard。
- `src/ui-resource.mjs`：将 CSS、图标、字体与构建后的 JS 内联为离线资源。
- `assets/app.js`：`npm run build:plugin` 生成的运行资源，随 npm 发布。

Dashboard 的 `transport.js` 根据运行环境使用同源 fetch 或 `app.callServerTool`。
MCP 的 read/write 工具仅对 App 可见，global 入口由用户直接打开；read 工具不能执行
写操作，操作路由不接受任意 URL，控制令牌不进入前端。原有 HTTP 认证保持不变。
更新 Dashboard 或 App 接入代码后重新构建，运行 `npm run test:plugin` 和相应回归。

安装命令将当前包的 Node 与 CLI 绝对路径写入专属本地 marketplace；开发安装因此
引用当前 checkout。发布／全局安装时再次执行 `mcx plugin install`，更新路径并刷新
插件安装。MCP 进程只依赖已安装的 MCX 服务；服务不可用时面板显示现有错误状态。

Prompt 是同一 MCX MCP 服务下的第二个 global 入口，使用 `features/notes/assets/icons/prompt-entry.svg`。工具级图标经公开 tools/list handler 返回，以补齐 SDK 高层注册未转发 icons 的限制。控制台使用 MCX 品牌图标，Prompt 不继承它。

Prompt App 在构建时包装现有 notes frontend 为管理模式，共用 CRUD、分类、卡片与编辑器；输入框模式只负责快捷填入。MCP 代理遵守 notes Adapter 的路由白名单和 MCX 功能开关，不启动独立 notes 实例。一次性填入通过 MessagePort 绑定 App 的来源窗口，由 notes Renderer Adapter 执行。原生 Adapter 核对 iframe 资源与 MCX 所有权；全页面必要时恢复本窗口原聊天路由。4 秒截止、用户导航、输入框变化或失焦不重放；没有全局队列和轮询。
