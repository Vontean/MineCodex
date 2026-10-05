# Prompt

官方 MCX 插件的 **Prompt** 页面管理提示词，使用 Prompt 自己的 book-open 图标；旧 navbar 注入入口已移除。输入框 Add 与权限按钮之间的 **Quick Prompts** 只浏览和调用。

Quick Prompts 以当前可见 Codex 输入框定位；打开原生 Add、权限或模型菜单时关闭，Session Status 的展开状态不会关闭提示词列表。没有可用输入框时移除快捷入口与 Popover；home、普通聊天、侧面板与浮动输入框均属于 insertion 能力范围。

## 管理页面
- All 与分类 Tabs，搜索、新增、编辑、删除。
- 默认分类：生图、编程、文案、研究、翻译、效率、思考、学习；支持新增、改名、删除与排序。
- 分类图标和颜色复用 Codex 原生 SymbolBrowser 的资源。单条提示词可设置一个 Emoji，否则继承分类图标。
- 使用右侧三横手柄拖拽调整组内顺序，也可按调用次数、最近调用排序。
- 删除分类会将提示词移至其他，保留正文、Emoji 和统计。

## 快速调用
- Tooltip 为 Quick Prompts；面板不显示重复标题或管理操作。
- 最近实际调用的 3 条排在最上面，然后按分类和手动顺序显示全部提示词。最近项目仍保留在所属分类；空分类隐藏。
- 点击只插入当前输入框，保留草稿，不发送消息。
- Escape、点击外部、切换会话或打开原生 Add 面板会关闭；方向键移动焦点。

## 统计与存储
只有成功插入输入框后才增加一次调用计数，并更新最近调用时间。浏览、编辑、创建、复制和排序不增加计数。SQLite 持久保存 `use_count` 与 `called_at`；历史次数未知，从 0 开始，不从旧的更新时间推算。切换页面和重启不会清零。

功能 ID 仍为 `notes`，沿用已有配置开关、CodexNotes 数据库和提示词。新增分类、Emoji、排序和统计字段；保留历史 Todo / Files 数据，不删除用户文件。原有收藏标记保留，但不参与新界面排序。

运行入口为 `src/main.mjs` → `quick-prompts-server.mjs`，仅开放提示词、分类、排序、调用记录及健康检查。页面经已认证 Runtime Host binding 访问固定允许的接口。旧 HTTP 服务、网页、Todo / Files 操作及文件清理代码已删除。`prompt-schema.mjs` 只负责向前迁移；`product.mjs` 负责提示词、分类和统计的事务读写。历史 Todo / Files 表保持原样。

服务仅监听 loopback，默认端口 47832。沿用 CODEX_NOTES_PORT、CODEX_NOTES_DATA_DIR、CODEX_NOTES_DATABASE。设计依据见 [DESIGN.md](./DESIGN.md)。官方入口与快捷入口采用现有 Lucide book-open，拖拽手柄采用 Lucide menu。分类 SVG 来自当前 Codex 原生图标目录，未手绘替代路径。

内置 24 条已分类、带 Emoji 的快捷提示词，来自 MIT 授权的 dsh-prompt 0.1.13。首次启动或升级仅导入一次，后续编辑与删除不会被覆盖。个人提示词不随包发布。来源和完整许可见 [dsh-prompt-LICENSE.txt](./assets/dsh-prompt-LICENSE.txt)。

弹窗与浮层统一调用 UI 组件库提供的 `config.ui`（由 Runtime Host 注入），共享主题材质、标题、Close 和表单操作区；插件只维护内容及交互。

Quick Prompts 与原生 Add 一样定位到 `data-composer-body` 上沿；`data-codex-composer-root` 仅用于会话识别和控件检测。diff、request stack 等上方组件不抬高浮窗，层级沿用原生 z-index 50。

## 官方 MCP App

管理页与输入框共享 frontend 源码，构建时由 `packages/plugin/src/prompts-app.mjs` 包装为管理模式。官方页面的 CRUD 经 MCP 工具调用由 MCX 管理的 notes 服务；功能关闭时拒绝请求，MCP 进程不创建额外数据库或启动 notes。

管理页使用动作通过 MessagePort 发送到发起 App 所在原生窗口，Codex Adapter 核对 iframe（包含 sandbox proxy 子 iframe）的资源 URI 与 MCX 所有权。`adapters/codex/insertion.mjs` 拥有插入生命周期：记住本窗口最后操作的输入框与路由；官方全页面卸载输入框时恢复原聊天路由，等待同身份输入框挂载。填入前复核焦点、路由、节点与 4 秒请求截止时间；用户失焦、导航或替换现有输入框时取消，不跨窗口转交。成功后才计数，计数失败不重试正文。直接 Quick Prompts 保持同步填入自己的 editable；所有路径均不发送消息。

`src/injection-source.mjs` 显式序列化 notes Adapter 与 frontend。没有共享插入队列或持续轮询；HTTP/MCP 白名单只开放已有数据操作，不开放全局插入请求。卸载清理监听，已在等待的操作在填入前检测 abort。
