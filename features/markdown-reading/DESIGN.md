# Markdown Reading

通用视觉和 token 映射遵循根 `DESIGN.md`。本功能默认开启，可在 MineCodex 控制台关闭；已有显式关闭设置保留；配置更改沿用现有 Runtime 重启应用流程。

## 用户边界

改善原生 File Panel 的 Markdown Preview 正文，并提供浮动章节目录。Source、工具栏、文字选择 action bar、聊天、Pages 与其他文件类型不进入样式作用域。不替换编辑器正文根节点，不改变文档内容；保留原生编辑、选择与纵向滚动。宽表格在表内增加同步横向浏览。

## 代码归属与接口

- `src/markdown-reading.mjs` 只管理样式作用域、预览会话与自检汇总；不读取 CodeMirror 私有字段、React Fiber 或原生模块。
- `packages/codex-adapter/src/markdown/preview.mjs` 识别文件预览并提供 `attach`。`reading-runtime.mjs` 持有原生能力加载、每个预览的清理队列与能力检查；关闭或销毁后的异步结果不安装扩展、不更新诊断。模块加载失败后允许新预览重试，编辑器 API 按所属实例解析。
- `packages/codex-adapter/src/markdown/providers.mjs` 统一读取最近的已提交 Provider，供目录、表格操作和富文本附加根使用。原始 Fiber、语法树和 CodeMirror 装饰均保留在功能防腐层；共同消费的原生机制放 Codex Adapter，不提升到共享 UI。`markdown-native.mjs` 负责表格全屏与富文本共用的原生 Markdown renderer / lexer 发现。
- `src/domain/footnotes.mjs` 接收正文与普通位置区间，维护脚注定义、首次引用编号、重复引用和返回位置，不依赖 DOM、Codex 或 CodeMirror。Adapter 将原生语法节点转换为排除区间，再把领域结果投影为装饰。
- `src/injection-source.mjs` 显式序列化领域规则与 Adapter。Node imports 不进入 Renderer；新增依赖同时更新组装名单与 npm 包校验。

测试覆盖预览识别、脚注规则、Provider 优先级、异步加载与卸载竞态、失败重试，以及序列化入口的实际执行与资源释放。原生模块与视觉交互仍在隔离窗口验证，不以源码字符串匹配代替运行结果。

## 原生依据

2026-10-04，Codex 26.930.21537 的安装包源码与隔离窗口 DOM：Markdown Preview 通过 CodeMirror 的 `.cm-content[data-language="markdown"]` 呈现；所属 React 文件视图 `fileKind=markdown`，Markdown 模式控制器拥有 `initialMode` / `onSourceDraftChange`。Source 也可能声明 Markdown 语言，不能只根据语言或扩展名判断。

Pages 正文源码使用 `--font-content`、`--text-document` 和 `--leading-relaxed`，当前局部实测 token 分别为系统正文栈、14px、1.625。Pages 的文档标题 H1 / H2 / H3 字号为正文的 1.5 / 1.25 / 1.125 倍，行高为正文的 2 / 1.75 / 1.75 倍。本功能引用这些角色，不复制 Pages 外壳或页面主标题。

Preview 原生实测正文行高 19.6px，scroller 左右 padding 16px，顶部 0；增强后正文行高 22.75px。Pages 排版比例来自源码，未宣称完成整个 Pages 页面实测。

## 面板适配

- 普通正文沿用 Pages 的 Electron 阅读宽度：`calc(var(--thread-content-max-width) - var(--padding-toolbar) * 2)`；左右最小 gutter 为 `calc(var(--spacing) * 14)`。Codex 26.1007.21159 安装包源码与隔离窗口布局确认当前分别为 736px、56px，不硬编码这两个数值。
- 同一原生 scroller 内布局，左右 padding 为 `max(var(--mcx-reading-gutter), calc((100% - var(--mcx-reading-width)) / 2))`：窄面板保持最小 gutter，宽面板正文达到上限后居中；表格阅读宽度复用同一 token 公式。沿用 Pages 常规阅读分支，不使用 compact／native-controls 的 16px 分支。顶部 24px、底部 64px。不新增纵向滚动区域。
- 保留原文空行，将普通空行行高设为 1em；标题行增加 1em 顶部间距，首行标题除外。CodeMirror 用 `.cm-gap` 保留未挂载段落的高度；不把虚拟视图中的可见首行改写成页面标题。
- 列表行上下 .125em、引用行上下 .25em；代码保留原生字体、高亮、折行与复制，内部行高 20px，首末代码行分别增加 12px 留白；表格单元格 padding 8px 12px，原生分隔行保持零高。
- 表格与代码保留原生 Preview 的逐行内容模型。表格通过 CodeMirror 装饰提供完整网格与可读列宽，各行共享同一横向位置；保留正文滚动区域，不重建为 HTML table。表格不提供 Pages 的列宽拖拽、增删行列等编辑能力。
- 普通正文不设置背景、正文色或字距；完成任务使用原生 tertiary 文字角色与删除线，勾选符号使用 inverse 角色。

## 生命周期与诊断

独立 feature 持有作用域标记、样式与清理；专有 Adapter 解释原生预览，Shared UI 的 `theme.bindScope` 建立局部原生 token 引用映射。映射随局部 token / 主题变化；禁用时恢复先前 inline 值，不覆盖其他所有者后来写入的值。

观察面板结构变更，不扫描正文文本；忽略 `.cm-content` 内部行装饰和选区重建。没有 Markdown Preview 时自检为 not-applicable；当前预览附加标记、映射与样式可观测时报告可用。保留检查时刻与真实用户视觉验收的区别。

图标复用项目现有 Lucide BookOpen 资源（`assets/book-open.svg`），许可见 `vendor/lucide-LICENSE`。启用入口继承现有控制台，无新工具栏按钮或正文内设置。

## 原生语法与布局范围

2026-10-04，以 Codex 26.930.21537 的真实隔离窗口逐屏检查完整样例；面板宽度约 960 / 600 / 360 CSS px。下列事实属于这个版本的 File Panel Preview，不代表其他 Markdown 渲染器的通用支持。

| 内容 | 当前布局与边界 |
| --- | --- |
| ATX H1–H6、Setext H1/H2 | 复用同一标题比例与段落节奏；H4–H6 保持正文大小和原生强调。Setext 分隔标记行在 Preview 中为零高，不留额外空白 |
| 中英段落、强调、删除线、转义、实体、软硬换行、分隔线 | 保留逐行编辑模型；不把源码软换行重新合成 HTML 段落。反斜杠硬换行和 Escape 标记通过装饰隐藏；单行 `\[文本\]` 保留字面方括号，不误识别为块级公式 |
| 紧凑／宽松、嵌套有序／无序列表 | 保留编号，按列表层级建立标记列与正文列；折行和列表内后续段落对齐正文。引用内列表同样使用标记列与正文列 |
| 引用、嵌套引用、引用内列表 | 隐藏各层 `>`；按引用深度提供边线与递进留白，引用内列表使用相同列表装饰 |
| 任务列表 | 原生 AST 识别 `[ ] / [x] / [X]`；本功能通过原生 CodeMirror 装饰呈现只读勾选框，完成项使用淡色与删除线，不增加切换完成状态的行为 |
| 行内／带标题／引用式／自动／本地链接 | 普通及本地链接沿用原生；Adapter 修补带标题、引用式和 URL 标签链接，并拆分中文标点分隔的自动链接。脚注标签不参与引用式链接映射；复杂链接标签保留粗体、斜体、删除线和行内代码；真正的折叠引用 `[label][]` 已在隔离窗口检查 |
| GFM 表格 | 列宽使用浏览器 auto 内容测量；可切换适配宽度换行，窄面板在本表内横向浏览，空格保留列位。单元格顶对齐；按用户确认统一 start（左）对齐，不应用 Markdown center/right 列标记 |
| 行内代码、反引号／波浪线 fenced code、缩进式代码 | 普通 fenced code 与缩进式代码通过 CodeMirror block widget 接入原生消息流 CodeSnippet；高亮、主题、圆角、边框与 padding 继承组件，复制与换行操作复用原生控件 |
| 本地／引用式图片 | 保留原图比例，宽图随正文宽度缩小；缺失图片沿用原生失败与替代文本 |
| LaTeX 公式 | 实测 `\(…\)`、`\[…\]`、`$$…$$` 和 fenced `math` 渲染为原生 KaTeX；单美元行内公式通过同一原生 KaTeX 渲染。保留公式原生横向滚动能力 |
| Mermaid | 闭合围栏使用 QV 渲染与原生放大外壳；QV 不支持或显式自定义样式的图由 QV 自身回退为 Mermaid 原生图 |
| YAML frontmatter | 保留原生 Metadata 节点，随正文滚动；原生工具栏保持现有布局 |
| HTML、注释、脚注、定义列表、GitHub 提示块 | HTML 使用受限语义元素的 DOM 投影，注释隐藏；脚注显示连续编号、正文及往返跳转；定义列表有术语／正文层级，GitHub 提示块显示标题和提示容器 |

宽表格采用下文的列宽、文档换行与全表横向浏览契约；窄屏图表的可读性仍未通过验收。后续改变宽块布局时，验证 CodeMirror 的逐行虚拟视图、选区坐标和原生操作，保留原生内容模型。

## 列表视觉与 Pages 的映射

Pages 原生 `editor-e25afcab6aa6.css` 使用 `ul` 的 disc / circle / square 三层标记，`li+li` 和嵌套列表顶部间距 .25em；正文由 `li>p` 承担，因此续行自然与正文对齐。`writing-block-editor-styles-4dc32da811e5.css` 中，任务项是独立标记列与 `task-list-item-content` 正文列，完成项第一段使用 tertiary 色和删除线。勾选框 1rem、边框 .9px、圆角 .125rem，勾选符号由 .25rem × .5rem 的两条边组成。上述为 Codex 26.930.21537 安装包源码事实，尚未单独打开 Pages 进行本轮 live computed 核对。

Preview 使用其所属原生 CodeMirror 的 ViewPlugin / Decoration / Compartment；从当前已预加载、且导出同一 EditorView 构造器的原生模块解析 API，不绑定文件 hash 或压缩 export 名称。专有 Adapter 读取原生 `cmTile.view` 和语法树，功能读取原生 AST，并为未支持的扩展语法建立局部展示投影；不重建 React / CodeMirror 所有的正文节点。

- 无序前三层使用实心圆、空心圆、方块；正文每级递进 1.75em，标记列宽 1.75em。数字编号沿用文档编号，较长编号扩展标记列。
- 首行原有 Markdown 标记只由 CodeMirror replacement decoration 隐藏；换行通过原生行 padding 对齐，后续段落移除用于源码缩进的空白装饰，不修改源文件。代码、表格、公式与 HTML 块继续使用原生装饰。
- Todo 按 AST 的 TaskMarker 识别；16px 框、.9px 边框、2px 圆角及 4px × 8px 勾选符号映射 Pages 比例，文字和颜色继承宿主主题。状态图形提供“已完成／未完成”可访问名称，保持只读。
- 光标进入列表标记或选区覆盖标记时展示原始源码；选区、复制及编辑位置仍由 CodeMirror 管理。禁用／切换 Source／重注入通过 Compartment 移除插件。
- 自检分别报告正文样式与列表装饰能力；原生模块或 view 契约不满足时报告能力缺失，不能把只有普通正文样式的状态报告成列表可用。

列表标记垂直对齐：行容器使用 relative；标记定位在首行 `.125em` 顶部 padding 之后，标记容器统一为 `1lh`，内部 flex 居中。圆点、数字、空框和完成框共享这一规则，多行内容不会将标记移到整项中央。2026-10-04 隔离窗口在 360 / 960px 面板实测，标记中心与首行正文 Range 中心的最大差值为 0.125 CSS px。

## 表格视觉与 Pages 的映射

2026-10-04 在 Codex 26.930.21537 的真实 Pages “Your guide to pages” 核对源码、computed 样式与不同窗口宽度。原生 `table` 使用 auto / max-content 列宽、min-inline-size:100%、separate 边框、零 border-spacing、顶部／左侧 hairline（当前 .5px）、tabular-nums；`th/td` 底边 1px、右侧 hairline，颜色为 `--color-border`，padding 为 `--spacing * 2 / * 3`（当前 8px / 12px），文字顶对齐与 start 对齐。正文使用 400 字重与 `font-feature-settings:"liga" 0`，表头 600。普通单行 39.75px；行内代码为 .92em、1px / 6px padding、6px 圆角，含代码行约 39.93px。

表格列宽由整张表的内容共同决定。Adapter 将原生 Markdown AST 的单元格内容放入不可访问、不可选择的隐藏 HTML table，由浏览器执行原生 auto 布局；列宽接入现有 CodeMirror 单元格，不移动、删除或替换正文节点。测量层不参与文档滚动、复制与辅助技术导航。取消每列 120px 下限及等宽分列，空单元格仍按源码列位补齐。

默认开启文档换行。换行模式下表格整体宽度与普通正文一致，使用 scroller 扣除左右正文 padding 后的可用宽度，不向 gutter 扩展。关闭换行后，表格才可超过正文宽度；full-width 边距复用 Pages 的公式：reading width 为 `--thread-content-max-width - --padding-toolbar * 2`，wide margin 为 `min(--spacing * 16, max(0, (容器宽度 - reading width) / 2))`。窄面板保留内容列宽，在本表内横向浏览，正文没有横向溢出。文字使用 break-spaces / normal word-break / break-word overflow-wrap；不以面板宽度强行等分或压窄列。未提供 Pages 的手动调整列宽与行列编辑能力。

每张溢出的表格底部只有一条滚动条，拖拽、点轨道、方向键、PageUp/Down、Home/End、横向滚轮与 Shift 滚轮控制整张表，表头和所有行同步。滚动条在悬浮整张表、操作区或滚动条时显示；键盘聚焦时显示，粗指针设备常显。离开且无焦点时隐藏，仍保留布局空间，避免正文跳动。滚动条使用浏览器原生 overflow-x:scroll 与 Pages 的 scrollbar-width:thin，不自绘滑块、不自行处理拖动或轨道点击；颜色引用原生 token。CodeMirror 的逐行结构通过共享 offset 接入同一个滚动控制容器，并非改写为 Pages 的整表 DOM。竖向滚轮继续滚动原正文。表格行不各自显示滚动条。虚拟行重挂载恢复共享 offset；键盘光标进入不可见列时同步跟随。

截断直接复用原生 `horizontal-scroll-fade-mask`、`horizontal-scroll-fade-mask-eased` 和 `edge-fade-horizontal` scroll timeline，animation range 为 `1px calc(100% - 1px)`。真实 Pages 表格当前默认分支是 1rem / 16px；按用户要求增强边界可辨识度，Preview 选择原生 eased 分支，其 `--edge-fade-distance:1.5rem` / 24px，透明度使用原生多停点缓动。起点仅右侧、中间两侧、终点仅左侧；无溢出移除 mask。滚动条位于 mask 之外。

隔离窗口按真实 Pages 表格生成同内容 Markdown，在 1200 / 960 / 600 / 360px 面板检查列宽、行高、空列、全表同步、真实滚动条拖拽与渐消起中终状态；保留原生文字选择浮条、Source 切换与源码。禁用或卸载移除观察器、监听、测量层、滚动条、样式和 Compartment。源码实现和自动 GUI 检查已完成，用户视觉验收待确认。

## Preview 浮动章节目录

2026-10-04 在隔离 Codex 26.930.21537 打开真实 “Your guide to pages”，核对默认和悬浮的 live computed、组件源码与实际 DOM。直接导入原生 Marker、Panel、交互式 Tooltip 和原生 CSS module；不维护手写 TOC 视觉 CSS。按当前 bundle 的语义调用关系发现公开组件，原生 class 与缩进规则从 Pages 调用契约取得，不固定资源 hash、短变量名或音频输入。原生私有 Pages TOC 的 ProseMirror 投影未导出；Markdown Adapter 持有标题、当前章与滚动数据，按照该原生调用契约组装公开组件。

原生视觉角色见根 DESIGN.md。组件在同一 React runtime 下渲染，显式继承原生文件视图的 Provider；只挂载新目录根，不改写原生 React 或 CodeMirror 节点。通过原生 Tooltip 处理 portal、hover handoff、延迟、窗口边界与 Escape；通过原生 Marker 的选择器处理标题层级、邻近短线增长、精确 linear 过渡、拖动及减少动态效果。

目录距本面板左缘 8px、垂直居中，随分栏宽度重新判断可用空间。正文左侧实际留白至少 112px 且至少两个文内标题才显示；按当前正文宽度与居中布局判断，不把旧固定宽度推导的面板阈值当契约。不扩宽正文 gutter、不覆盖文字。最多显示 min(70vh, 640px)，长目录自身滚动及边缘渐隐沿用原生。

从原生 AST 获取 ATX H1–H6 与 Setext H1/H2；排除 YAML frontmatter、引用／列表内标题与代码中的标题文本，去掉标题格式标记，不添加虚构文件标题。H4–H6 归入原生第三级的视觉分支，不发明额外线长或缩进。语法树更新、文档变化和虚拟视口变化时重算。

悬浮／聚焦展开，点击或 Enter/Space 跳转；按住短线上下拖动即时导航。当前章随正文滚动更新，文末标记最后章。原生 scrollIntoView effect 定位虚拟标题，保留文档内容、选择和编辑状态；平滑滚动遵循减少动态效果偏好。Source、功能禁用或面板卸载时移除 React 根及其 portal、事件、计时器、ResizeObserver 和 Compartment。目录模块不可用单独报告，不阻断已可用的正文／列表／表格排版。

真实 Pages 和同标题 MD 样例：默认／悬浮的每条线长、色值、opacity、160ms 过渡曲线一致，目录行 font、padding、radius、色值、高亮与行高一致；验证 Marker 的 React 组件身份确为原生导出。1199 / 1059px 面板距左缘 8px、垂直中心偏差 0，959 / 599 / 359px 隐藏；悬浮进入目录、点击、拖动、Source 切换、禁用清理及源文件不变检查通过。用户视觉验收仍待确认。


## 表格悬浮快捷操作

复用 Codex 26.930.21537 Chat Markdown 的公开 `data-block-actions` React 组件、CopyButton、Button (`color=blockAction` / `radius=full` / `size=inputIcon`)、Tooltip 和消息流 CodeSnippet 原生换行／取消换行图标。Adapter 通过源码语义角色与公开 export 接入，不绑定构建 hash；继承当前 React context。操作栏在表格 hover / focus 内可达，窄面板不越过本面板边缘；操作栏放在表头上方，表头预留 16px 间距，避免遮住适配后的最后一列标题；透明指针桥仅覆盖操作栏及表头顶部留白，让鼠标可连续移入按钮，不拦截正文选区。操作栏和滚动条挂载在原生 cm-scroller 内、cm-content 外，按文档坐标定位，随正文由浏览器同步滚动；不逐帧追随视口坐标，不吸附到视口顶部。纯滚动复用已有列宽与滚动范围，节点、内容或布局变化时才重新测量。操作控件用于本功能表格与代码块，保留 Chat 的原生动作；支持的 flowchart 使用本功能的图表操作栏。

“复制表格”复制本表 Markdown 源码，由原生 CopyButton 显示反馈。“开启／关闭文档换行”是当前 Preview 文档中所有表格与普通代码块共用的状态：默认开启、表格跟随普通正文宽度；隐藏测量 table 使用 100% 宽度的原生 auto 布局，单元格 overflow-wrap:anywhere，按内容分配列宽并增长行高；关闭恢复自然宽度。能够适配时移除横向滚动条和渐消；列数过多导致最小单元格尺寸仍超宽时继续提供横向浏览。状态不写入 Markdown，不影响其他文档；Source 切换或关闭 Preview 后恢复默认状态。

表格按钮顺序固定为“换行（适用时）→ 复制 → 扩展”。扩展始终提供，不依赖宽度溢出或换行状态。点击复用消息流表格的原生全屏预览 Dialog、Table 组件、Markdown lexer / renderer、滚动容器与扩展图标，不重建正文编辑器。全屏内容来自当前表格 Markdown 源码；保留原生预览的遮罩、关闭按钮、Escape 与主题样式，关闭后焦点返回触发按钮。功能卸载同时释放 Dialog portal 及其页面锁定。

自检独立报告 `markdown-table-actions`；卸载移除自己的 React root 和 DOM，不修改原生 React / CodeMirror 正文节点。2026-10-04 隔离 GUI 验证 hover 隐藏／显示、操作栏 pointer 可达、原生 Tooltip、适配后的列位与行高、恢复、复制反馈、滚动条拖拽及文件不变。

### 文档 Metadata 滚动

Markdown Preview 的原生 Metadata 与正文跟随同一滚动位置，不固定占用阅读视口。保留 React 原有兄弟节点结构，由 Metadata 实际高度预留正文顶部空间，并同步原生正文滚动偏移；切换 Source 或关闭增强时恢复原生布局。文件 Toolbar 保留原生行为。

TOC 的纵向中心以整个 File Panel（包含文件 Toolbar）的边界计算，通过原生 `data-app-shell-tab-panel-controller` 定位面板，再换算成编辑器局部坐标。面板尺寸变化时重新计算，不以正文滚动视口或 Metadata 高度作为中心锚点。

表格操作区与横向滚动条的纵向留白使用行内 padding，禁止在 CodeMirror 行上增加纵向 margin：原生行高模型不计入行外 margin，会累计造成点击坐标与光标落点错行。操作区和滚动条分别扣除对应 padding 来维持原来的视觉位置。

横向滚轮输入在捕获阶段阻止单行的浏览器默认滚动，同一次事件内提交全表各行与原生滚动条的共享偏移，避免命中行先由 compositor 滚动、其他行等 scroll 事件才跟上的视觉错位。纵向滚动与 Ctrl 缩放保持原生行为。

各表格行使用 overflow-x:hidden 禁止浏览器对单行独立横向滚动或弹性回弹；横向输入由表级共享偏移处理。无真实溢出（含不超过 1px 的取整误差）时统一偏移为零，面板变宽或切换适配模式时同时清除旧偏移。原生底部滚动条仍是唯一可直接操作的横向滚动容器。

表格换行按钮复用消息流 CodeSnippet 的 Enable/Disable word wrap 原生图标组件：点击同步切换当前文档全部表格与普通代码块的换行状态，同时切换所有已显示按钮为相反操作的图标；不显示持续选中底色。自然列宽无溢出时只显示复制按钮；已开启适配换行时保留取消操作，避免无法切回。

### 链接渲染补全

2026-10-04，Codex 26.930.21537 原生 text-file-editor-extensions 的 Preview 隐藏规则保留带 LinkTitle 和缺少 URL 子节点的引用式链接源码，并错误隐藏链接显示文字里的 URL。通过同一 CodeMirror 的高优先级装饰补全这些情况；正确的普通链接和本地链接继续使用原生节点。引用目标从原生 LinkReference 语法树解析、按 Markdown 标签空白／大小写规则归一化；引用定义不占正文高度。裸 URL 遇中文分隔符时分别生成目标，www 地址补 https，保留正文标点。链接颜色引用原生 text-accent token，长地址允许换行。外部链接使用原生 markdown_link_click 打开函数，标题保留 tooltip 文本；非空选区内保留原生源码与编辑器选区行为。源码和 Source 模式不改写，卸载恢复原生装饰。


## 富文本展示投影

2026-10-04，以 Codex 26.930.21537 的完整样例和富文本边界样例验证。语法装饰留在功能 Adapter；共享 Runtime 只负责注入。局部 replace / block widget 由原生 CodeMirror StateField 持有，切换 Source、禁用和卸载时通过 Compartment 移除，不修改文件内容。

- 普通代码块直接使用原生消息流 CodeSnippet；保留原生高亮加载、字体、主题、边框与圆角。复制与换行使用同一原生 Actions / CopyButton / Button / Tooltip 和图标；整块悬浮或键盘聚焦时显示，无横向溢出的未换行块只显示复制。顺序为换行、复制；代码块的原生 Actions 通过 `className=bg-transparent` 使用透明底，避免灰色代码区上出现白色胶囊；按钮保留原生 tertiary 与 hover 颜色。链接色仅作用于链接和脚注按钮，不覆盖代码操作控件。切换换行更换图标，不使用锚定按钮态。代码内容独立水平滚动，操作区随块一起竖向滚动。math 围栏保留已有原生组件；QV 渲染与放大见下方 Mermaid 章节。
- 引用内代码移除用于源码引用的前缀，保留代码本身的缩进。转义、公式、HTML 和脚注处理跳过代码范围，不把代码示例误解释成富文本。
- 脚注编号按首次引用顺序；重复引用共享编号，未定义／被转义的引用保留字面文本。正文使用原生 Markdown lexer 与展示组件，支持强调、链接、代码和连续行；点击编号跳到正文，返回按钮恢复点击前的滚动位置。
- HTML 通过 DOMParser 投影受限的语义元素，保留常用行内、块、列表、表格与 details 标签；不复制任意 style 或事件属性，不执行脚本。HTML 块内部的普通 Markdown 字符保持 HTML 文本语义。注释不占正文行高。
- 单美元公式接入宿主同一 KaTeX。定义列表提供术语与缩进正文；提示块采用宿主背景、文本 token 与明确标题。图片失败状态继续沿用用户确认的原生表现。

原生模块按语义调用关系与公开 exports 发现，缺失契约单独报告 rich-text unavailable。组件和控件沿用 Provider；根、监听和观察器随 widget / 功能生命周期释放。验收关注源码保持、代码区内容隔离、控件真实切换、脚注往返及宽／窄面板，而不是只检查 CSS 是否存在。

2026-10-05，Codex 26.930.51102：表格预览的导出局部名称包含 `$`。组件别名按 export 列表完整名称匹配，不把名称当正则表达式；同一规则用于表格与换行图标。隔离窗口中已加载当前源码并检查真实代码高亮、复制与换行、表格复制／适配／扩展、脚注往返与 Source/Preview 切换；用户视觉与交互确认仍待完成。

脚注引用按钮显式使用 `line-height:1`，避免继承上标的零行高而失去点击区域。同名脚注沿用最后一条定义，所有定义区间都排除引用扫描，早期定义在 Preview 隐藏。返回位置保存原生 CodeMirror `scrollSnapshot()`，恢复文档锚点及视口偏移，不保存会受虚拟段落重新测量影响的裸 `scrollTop`。

代码与 HTML 块 widget 的纵向留白使用 padding，分别保持 16px 与 1em；不使用原生高度模型无法计入的外部 margin。原生 Source 在本版本采用带 Shadow DOM 的 `diffs-container`，不再以 `.cm-content` 作为 Source 验收入口；Source 内容与磁盘源码、Preview 文档分别核对。隔离交互验收保持窗口可见，隐藏窗口中的 requestAnimationFrame 暂停不能作为导航失效证据。

## 文档换行状态

每个 Preview 会话拥有一个默认开启的换行状态，由 `reading-runtime.mjs` 创建并传给表格与富文本 Adapter。点击任意表格或普通代码块的按钮，统一切换当前文档所有支持此逻辑的块；按钮提示为“开启／关闭文档换行”。虚拟滚动、块重挂载及异步加载沿用当前状态，不按块位置或内容分别保存。其他文档独立；关闭 Preview 后释放订阅，不写入文件或全局偏好。math 保留原生能力；Mermaid 不参与文档换行切换。


## Mermaid 图表

Mermaid 增强已拆为独立、默认关闭的 [Mermaid Diagrams](../mermaid-diagrams/DESIGN.md) 功能。阅读增强不加载 QV 资源、不替换原生图表，也不将图表状态计入阅读自检。

原生 Preview 识别、所属 CodeMirror API、Provider 和块操作组件由 `packages/codex-adapter/src/markdown/` 维护，供阅读与图表两个功能共用；阅读排版、表格和目录的安装仍归本功能。


## 代码组件兼容

Codex 当前 macOS 构建的代码块分为接收 `content` 的高亮渲染组件与接收 `source` React 内容的展示外壳。Markdown Reader 必须发现上层内容组件，保留原生高亮、复制与换行；只发现外壳会出现有背景但无文字的空块。旧版单组件结构继续使用原入口。组件选择与初始化回归见 `test/preview.test.mjs`；不得用修改 Markdown 原文规避适配问题。
