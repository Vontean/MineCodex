# Codex 公共环境适配

该私有 workspace 隔离多个插件共同依赖的 Codex Renderer 机制。专有业务协议放在插件的 `src/adapters/codex/`；视觉适配放在 UI 的 `src/native/`。完整层次与文件导航见根 ARCHITECTURE.md 和 AGENTS.md。

`createCodexEnvironment()` 是可显式序列化的工厂，无 Node 闭包和 IO imports。宿主按 Renderer 生命周期创建一个实例，通过 `config.codex` 提供给插件，卸载/重注入时重新创建。

| 接口 | 结果与约束 |
| --- | --- |
| `composer(element?, {threadOnly, purpose}?)` | 默认仅可见的 Codex thread 输入框；Prompts 使用 `purpose:"insertion"` 支持 Chat、Work、Codex、Temporary Chat 与面板 chat bar。优先当前焦点所在输入框，并可显式绑定插入目标。返回 editable/root/body/add/threadId；非thread不提供身份，隐藏祖先返回 null |
| `currentThreadId(element?)` | 从合格输入框取得 UUID；不从残留 sidebar 选中项猜当前线程 |
| `composerSurface(element?)` | 返回可见正式会话外壳 root/threadId，独立于编辑区是否存在或暂时 inert；供会话状态呈现与宿主统计订阅使用。真正隐藏、移入浮层、切换 home 或卸载时返回 null；不能作为文字插入许可 |
| `route()` | 当前原生路由 pathname；只返回路径类型信息，不返回路由 state；缺失上下文返回 null，供功能判定适用场景 |
| `navigation()` | 当前路由 path/key、提交订阅与原生导航动作；不暴露 router 或 React props，供同窗口恢复路由 |
| `account(signal?, invalidate?)` | 返回 `read()`，输出 status/planType/source/key。优先从原生 `accounts/check` 读取当前 accountId 的套餐，清单未加载时使用 auth.planAtLogin；身份加载中、缺失、非 ChatGPT 或清单不包含当前账号时返回 unknown。传入 invalidate 时订阅 accounts 缓存变化，signal abort 释放订阅；不请求接口、不暴露凭据。Images／Sites 用该结果选择 Plus 或 Space 分支 |
| `mcpAppSource(sourceWindow, identity)` | 验证直接或 sandbox 内层 iframe 所属 MCX server/plugin 与准确资源 URI，返回连接状态句柄 |
| `rail()` / `railSlot(ownGroup)` | 可见原生 rail 与模板/滚动区/固定组句柄；不包含插件菜单策略 |
| `currentFiber(element)` / `props(element,predicate,limit?)` | 仅供 native Adapter 使用；优先匹配当前 committed props，支持最近祖先的 scope |
| `report(name,available,reason?)` / `diagnostics()` | 最新能力状态的副本；不持有凭据、原始账户数据或用户内容 |

不要增加一个包含所有插件的 CodexGateway。新契约只有在被多个模块实际共用时进入这里。选择器、React 机制改动在本模块验证；插件专有协议改动在所属 Adapter 验证。正常界面不暴露内部诊断。

## Markdown Preview 共用契约

`src/markdown/` 由 Markdown Reader 和 Mermaid Diagrams 实际共用。`preview.mjs` 仅识别原生 File Panel 的 Markdown Preview，并调用功能传入的 attach；不持有任何功能 Runtime。`editor-api.mjs` 发现当前编辑器所属 CodeMirror API；`providers.mjs` 获取 committed Provider；`toc-native.mjs`、`markdown-native.mjs` 与 `block-actions.mjs` 发现原生 React、Markdown renderer 与块控件。排版、表格与图表安装继续归各自功能；图表下载协议不进入共享层。

迁移时两个注入工厂都显式序列化这些能力。开启图表不要求阅读增强开启；默认关闭图表时阅读能力不依赖 QV、保存协议或图表自检。

Codex `26.1013.4894.0` 的 TOC 将 `floating-navigation-rail-layout` 资源更名为 `floating-navigation-rail`，列表容器新增 `variant:viewer`，导航定位使用含评论区 inset 的计算值。发现规则支持两种资源名称，导航 class 从带 `page-table-of-contents` Tooltip 的函数中按 nav 角色取得，不依赖某个 top utility 的字面值。Markdown 自己仍按 File Panel 中心定位；不沿用 Pages 评论区的坐标计算。回归运行 `node --test packages/codex-adapter/test/toc-native.test.mjs`，覆盖新旧资源、容器属性、原生模块导入和样式加载。
