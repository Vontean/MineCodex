# MineCodex UI 组件库的局部约定

通用视觉与原生适配规则只维护在根 [DESIGN.md](../../DESIGN.md)。内部文档与代码路由见根 [AGENTS.md](../../AGENTS.md)，架构见 [ARCHITECTURE.md](ARCHITECTURE.md)。

本级只负责共享组件自身的结构、接入与实现边界，不维护另一份颜色、字体、材质、遮罩或sidebar规则。

## 当前阶段

`packages/ui` 已建立独立私有 workspace，组件、token、安装源码与验证均在本级维护；实际目录见架构文档。未使用的原生组件分支不会仅因规范列出而预建空壳。

## 组件职责

- 原生适配层：解析实际token、主题、zoom和能力状态；共享锚点仅包含真实跨插件需求。原生事实遵循根规范，不在每个组件重新猜测。
- 材质与层级基础：按Dialog、Dropdown、Popover、ComposerMenu、Page的原生分支提供有限选项，将遮罩与Portal规则同所选组件匹配。
- Dialog：提供容器、标题、Close及操作区的结构；插件填表单、列表或确认内容。
- Button：通过 `action(node, "danger-solid")` 提供原生实色警戒分支，保留既有 `danger` soft 分支；通用 token 与适用规则见根 DESIGN.md。表达操作角色和状态，保留Cancel ghost、实际次级outline与主操作solid的语义区分；业务动作由插件传入。
- Navbar：使用成对 default/selected 图标管理展示状态；原生图标与选中状态适配集中在 native 层，保留原生路由与 sidebar hover。退出注入页面时按当前 committed 原生状态恢复选中属性，不回放进入时的旧状态；原生目的地变化时及时移除替身图标，原节点复用或重渲染后仍保证只显示一个图标。
- 官方 MCP Navbar：`native/mcp-navigation.mjs` 按原生 item 中的来源与工具路径选择宿主提供的 default/selected 资源，仅修改原生 SVG mask image 的 href。选中态来自原生 aria-current/data-selected；保留根 SVG、currentColor、尺寸与点击行为。React 更新资源、节点复用、非所属插件或卸载时恢复当前原生图片。
- Tooltip：处理声明式标记、hover/focus、aria关联、关闭与卸载，不接管原生Tooltip。
- Page 的 `sidebar:"none"` 分支通过 native/page Adapter 取得原生无上下文侧栏页面壳；`releasePage` 释放时区分返回原页面和用户主动导航，禁用时清理。
- 页面、菜单与浮层：提供对应类型的外壳、挂载和通用交互，不读取提示词、会话或站点业务数据。

## 接入约束

当前page-script通过 `config.ui` 使用公共能力；现有API包括 `heading`、`footer`、`action`、`overlay`、`surface`。`surface(node, kind, options)` 显式区分原生材质；`page`、`mount`、`trapFocus`、`composerMenu`、`tooltipSurface`、`navigationRail` 维护实际复用的层级、焦点与定位。`entry.resources` 通过 `config.resources` 提供插件自身 CSS 与图标，通用视觉仍由组件库维护。

独立全页面且无专属二级导航的功能使用 `config.ui.page(node, { sidebar:"none" })`。移除页面前调用 `config.ui.releasePage(node)`；若用户正在主动选择原生导航，则传 `{ restoreNavigation:false }`，避免恢复动作覆盖用户选择。`sidebar:"none"` 页面通过 `onNavigate` 接收原生路由提交后的退出通知；一级、二级和程序化导航共用该契约，悬浮展开与加载中的通知不关闭页面。Adapter 在通知前取消路由订阅并放弃恢复旧位置，功能回调负责移除内容与恢复自身状态。默认 `sidebar:"inherit"` 保留现有接入行为，不自动迁移其他功能。页面壳的产品规则与验收标准见根 DESIGN.md 的「全页面功能的页面壳选择」。

Renderer安装函数经序列化注入，必须自包含。组件代码与Node/CDP隔离，宿主负责组装注入源码、生命周期和iframe主题桥；不为整理目录引入不必要的打包系统。

通用生命周期契约由组件库维护。原生已经提供的焦点圈定、Escape和关闭机制优先复用；插件继续拥有业务状态、内容更新和具体回调。迁移时同步触发点焦点恢复、异步卸载及原生节点归属验证。

## 验证边界

组件验证关注可注入性、结构与回调、状态清理、挂载/焦点以及所选原生类型的实际行为，不镜像每条CSS写实现测试。布局、材质和原生状态变化按风险做隔离验收；只移动文件时验证导入、序列化、发布名单与已有功能回归。
