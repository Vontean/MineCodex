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
| `account(signal?, invalidate?)` | 返回 `read()`，输出 status/planType/source/key。优先从原生 `accounts/check` 查询族的最新有数据候选读取当前 accountId 的套餐，清单未加载时使用 auth.planAtLogin；身份加载中、缺失、非 ChatGPT 或清单不包含当前账号时返回 unknown。传入 invalidate 时订阅 accounts 缓存变化，signal abort 释放订阅；不请求接口、不暴露凭据。Images／Sites 用该结果选择 Plus 或 Space 分支 |
| `mcpAppSource(sourceWindow, identity)` | 验证直接或 sandbox 内层 iframe 所属 MCX server/plugin 与准确资源 URI，返回连接状态句柄 |
| `rail()` / `railSlot(ownGroup)` | 可见原生 rail 与模板/滚动区/固定组句柄；不包含插件菜单策略 |
| `currentFiber(element)` / `props(element,predicate,limit?)` | 仅供 native Adapter 使用；优先匹配当前 committed props，支持最近祖先的 scope |
| `report(name,available,reason?)` / `diagnostics()` | 最新能力状态的副本；不持有凭据、原始账户数据或用户内容 |

不要增加一个包含所有插件的 CodexGateway。新契约只有在被多个模块实际共用时进入这里。选择器、React 机制改动在本模块验证；插件专有协议改动在所属 Adapter 验证。正常界面不暴露内部诊断。

## Markdown Preview 共用契约

`src/markdown/` 由 Markdown Reader 和 Mermaid Diagrams 实际共用。`preview.mjs` 仅识别原生 File Panel 的 Markdown Preview，并调用功能传入的 attach；不持有任何功能 Runtime。`editor-api.mjs` 发现当前编辑器所属 CodeMirror API；`providers.mjs` 获取 committed Provider；`toc-native.mjs`、`markdown-native.mjs` 与 `block-actions.mjs` 发现原生 React、Markdown renderer 与块控件。排版、表格与图表安装继续归各自功能；图表下载协议不进入共享层。

迁移时两个注入工厂都显式序列化这些能力。开启图表不要求阅读增强开启；关闭图表时阅读能力不依赖 QV、保存协议或图表自检。

Codex `26.1013.4894.0` 将 Markdown lexer 移到入口模块本地并公开导出；解析器兼容既有导入绑定与本地导出。代码组件仍位于 app-shared，因此其资源 URL 独立于 lexer 来源发现。缺少 lexer 或共享组件模块时明确报告契约不可用。回归见 `test/markdown-native.test.mjs`。

Codex `26.1013.4894.0` 的 TOC 将 `floating-navigation-rail-layout` 资源更名为 `floating-navigation-rail`，列表容器新增 `variant:viewer`，导航定位使用含评论区 inset 的计算值。发现规则支持两种资源名称，导航 class 从带 `page-table-of-contents` Tooltip 的函数中按 nav 角色取得，不依赖某个 top utility 的字面值。Markdown 自己仍按 File Panel 中心定位；不沿用 Pages 评论区的坐标计算。回归运行 `node --test packages/codex-adapter/test/toc-native.test.mjs`，覆盖新旧资源、容器属性、原生模块导入和样式加载。

## 原生模块定位

`src/renderer/modules.mjs` 统一维护 `findCodexModule`。预加载标签只作为优先提示，不能作为
模块存在与否的证明。标签未列出目标时，沿当前 index、app-main、app-initial、app-primary、
app-runtime、app-shared 的真实相对引用定位；功能可用 `via` 声明所属包装模块，例如编辑器的
`.electron` 包装。不会扫描所有业务 chunk，不猜 hash，不尝试服务器接口，不执行任意导出。
直接命中保持快速路径，visited 集合终止循环；失败不永久缓存，取消信号停止读取。
`waitForEntry` 仅等待原生应用入口标签挂载，入口已存在但目标缺失时明确失败，不无限等待
永远不会挂载的 app-initial 标签。成功、取消和卸载都必须释放观察器。

需要同一角色的多个候选（如原生 CodeMirror）时使用 `all`，随后仍核对编辑器实例身份。
功能专有的导出角色、懒初始化及参数校验继续归对应 Adapter；模块已定位不代表接口可用。
page-script 与独立 Renderer evaluate 都必须显式序列化共享函数，不能捕获 Node import。

`codexModuleStyles` 从原生目标 lazy import 对应的 `__vite__mapDeps` 读取样式依赖。
它兼容纯 hash CSS，仅加载该模块声明的 CSS，不匹配随机样式文件或执行字符串源码。
原生语义样式名仍作为旧版本直接路径。账号套餐与额度分别读取有明确语义前缀的查询族，
不能把精确的旧键当作跨版本契约；账号归属、响应结构和新鲜度由所属 Adapter 校验。

Codex `26.1027.30824` 起 app-initial / app-main 不在预加载列表，部分组件重新拆分或
合入入口，TOC 样式变为纯 hash，KaTeX 存在命名导出。运行 `node scripts/check-native-capabilities.mjs` 重做隔离接口检查；
先按 Runtime Host 约定启动独立 Codex，默认 CDP 9233，可用 MCX_PROBE_PORT 指定独立端口。
脚本拒绝日常 9231 端口，不打开菜单、不发送消息或上传文件；它会导入原生组件并加载
对应 CSS，因此仅用于独立窗口。退出码非零表示加载失败或超时，不能只看服务健康。

### rspack 的已注册模块

Codex `26.1029.61003`（macOS）改用数字 chunk，入口公开 `__webpack_require__`。
`codexModuleRegistry` 从当前已加载 script 的实际导出声明识别入口，不固定文件编号或 hash。
它按角色匹配已注册工厂的声明，读取已初始化模块的缓存导出，并沿该工厂的真实 require
引用解析依赖；不重新执行工厂、不为寻找角色调用未知导出、不枚举或下载未声明的 chunk。
原生声明的具名 lazy 组件或具名异步导出可按原调用链加载，支持单 chunk 与
`Promise.all` 依赖组；chunk ID 和模块 ID 都来自该声明。异步模块等待初始化后读取导出，
并更新本次注册表的模块清单，使后续角色发现包含刚加载的依赖；缺失、多义、
未初始化或引用结构不符时明确失败。工厂清单只属于本次接入，不持久保存跨窗口句柄。

这是与 ESM `findCodexModule` 并列的加载机制，不把专有图库角色放入共享层。消费方须在
page-script 和独立 evaluate 中显式序列化它及自己的角色解析器。Images 已用此机制验证
导航、图库与画布。Markdown Reading 在同一 macOS 构建中验证了当前编辑器所属的
CodeMirror API、Pages 目录、表格控件、Markdown renderer / lexer、CodeSnippet 与 KaTeX；
角色解析位于 Markdown Adapter，旧 ESM 路径保留。其他功能继续按各自协议处理，
不据此宣称所有 rspack 能力已恢复。

`codexModuleRegistry({signal, waitForEntry:true})` 供早于入口挂载的功能等待真实注册表。
数字 chunk 可能逐个出现，发现器在已读取的 chunk 不含 runtime 时继续观察后续脚本，
不把首个 script 当成完整清单；旧版语义入口存在时返回 null 交给 ESM 路径。
AbortSignal 取消时释放观察器；默认只检查当前脚本，不改变其他调用方的等待策略。

Pages 的 Markdown 共享组件要等待其原生 `PageEditorContent` lazy import 完成后再读取
依赖。Rspack 工厂出现在注册表时，其缓存导出和依赖可能仍未初始化；阅读增强与图表
增强并行加载时也必须使用原生 import 的完成点，不能以源码标记存在作为就绪信号。

原生能力检查 `npm run check:native` 按当前已打开的 surface 检查懒加载能力：Library
检查图库与画布，Markdown File Preview 检查链接、目录、块操作、富文本及图表保存。
缺少对应 surface 时输出 `available:null` / `state:not-applicable` 及应打开的页面，
不将其计为通过或故障；适用页面中的发现或绑定失败仍使检查退出失败。接口加载通过
仍不代替选择、导航、渲染、下载等实际操作验收。
