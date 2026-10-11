# MineCodex 通用设计规范

本文件是全项目通用设计规范的权威入口，由 MineCodex 组件库维护。按原生组件类型和明确分支适配；不要把一个页面中的视觉样式推断成所有组件的统一样式。组件库及插件的 DESIGN.md 只记录本级特殊组件、选型和功能差异，不复制此处的通用规则。

依据：2026-10-01，Codex **26.928.21956** 安装包源码，以及隔离窗口的原生 DOM、React 参数和计算样式。浅色 Dialog、菜单、页面与 sidebar 已实测；深色相关遮罩来自源码定义，未据此宣称深色视觉验收完成。

## 原生规则与 MineCodex 选择

原生组件分类是事实，插件采用哪个分支是产品选择，两者分别记录。例如 Prompts 和 MineCodex Sites 的管理弹窗采用用户指定的 Sites Share 分支；这不意味着原生默认透明 Dialog 被淘汰。按钮外形也不决定容器材质。

Token 名称是实现依据；括号内数值是本版本观测值。读取实际生效作用域，不仅仅读 documentElement；原生窗口、主题、局部组件均可能覆盖 token。iframe 需要宿主传递 token，不能假设自动继承 Renderer CSS。

Codex 26.930.51102 安装源码：Library / Images 的 browse Tabs 选中底使用
`--color-background-primary-ghost-hover`；desktop 浅色为前景 5% 透明混合，深色为白色 8%。
官方 MCP iframe 的 `--color-background-tertiary` 是独立层级底色，不等于该交互 token。

## 基础视觉与交互

- 字体与字号引用原生 `--font-sans-default`、`--text-base`、`--text-sm`、`--text-xs`；标题按实际角色使用 `--text-heading-lg`、`--text-heading-md`。字重使用 `--font-weight-normal`、`--font-weight-medium`、`--font-weight-semibold`。功能特殊的信息密度与尺寸在本级文档记录。
- 标题和主要内容使用 `--color-text-primary`，说明使用 `--color-text-secondary`，辅助信息使用 `--color-text-tertiary`。旧前景名称仅由公共token适配器处理必要别名，插件不维护自己的兼容表。
- 交互反馈引用 `--color-background-primary-ghost-hover` 与 `--color-ring`；输入边缘使用 `--color-border-primary-outline`，普通边缘使用 `--color-border` / `--color-border-subtle`。保留所选原生控件实际的focus规则，不把所有输入强制改成同一种外圈。
- 图标优先复用项目已有库或原生真实SVG，随所在控件继承颜色与状态；不按视觉猜测重画，不匹配构建哈希。特殊数据图、品牌图与功能比例在插件文档说明。
- 保留原生主题、locale、zoom、reduced-motion与键盘反馈。用户内容不被翻译；通用控件文字、无障碍标签与功能文案随宿主语言显示。
- 声明功能时优先复用共享容器和控件；功能只填内容、状态与业务回调。项目本地Web界面遵循同一语义视觉契约，但通过主题桥或自身入口获取token，不假设可访问Codex原生DOM。

## Dialog 与遮罩

| 原生分支 | 容器 | 遮罩与使用依据 |
| --- | --- | --- |
| `default` | `--color-surface-elevated-secondary` 90%，`--blur-xl`（24px），0.5px `--color-border` 边缘、`--shadow-lg`，通常 `--radius-3xl`（25px） | `--color-dialog-overlay`；当前普通 Electron 浅色为 `#0002`，无模糊。Images Rename 实测 `variant=default` |
| `opaque` | 不透明 `--color-surface-elevated-secondary`，无容器模糊，0.5px 边缘、`--shadow-lg`，通常 `--radius-3xl` | 原生 `dimmedOverlay`：浅色 `#e3e3e380`、深色 `#00000080`，`--dialog-backdrop-fade-filter`（1px模糊）。Sites Share 实测 `variant=opaque` |
| `form` | 不透明 elevated-secondary，`--radius-form-dialog`，原生 `shadow-form-dialog` utility class | `dimmedOverlay`。不是默认 Dialog 的透明配方；`shadow-form-dialog` 是 class，不能虚构同名 CSS token |
| `confirmation` / `catalog` / `centeredText` | 不透明 elevated-secondary，专用 catalog surface、尺寸与阴影 | `dimmedOverlay`；不将默认 Dialog 的所有尺寸、阴影套入 |
| `beaconModal` / `expressiveBeacon` | 另有容器和主题分支 | `--dialog-backdrop-fade-background`、`--dialog-backdrop-fade-filter`；浅色 fade 当前为 `#f2f2f280`，与 dimmedOverlay 不同 |

默认容器与遮罩按原生分支成对选择。dimmedOverlay 的浅灰/黑色配方是原生 CSS 的主题分支，不是某个已命名的遮罩颜色 token；不要把 `--modal-backdrop-background` 当成它的同义名。

共有文字与结构 token：`--font-sans-default`、`--text-heading-md`（20px）、`--font-weight-semibold`、`--text-base`、`--color-text-primary`、`--color-text-secondary`、`--color-text-tertiary`、`--modal-container-inner-padding`。当前共享外壳内容 padding 为20px，标题行高28px；Close 采用原生 Sites SVG及24px热区、top/right 16px。具体内容尺寸由功能决定。

`--shadow-lg` 当前浅色为 `0 4px 8px -2px / 10%黑色`。边缘和投影是两部分；按所选原生组件保留ring与shadow组合，不再额外加一层CSS border。表单、确认等专用分支应按所选原生组件保留差异。

## 操作按钮

当前 MineCodex 管理弹窗采用 Sites Share 的 `data-size=xl`、`data-pill` 设计，语义与材质分开维护。

| 操作角色 | 填充／边缘 | 原生 token |
| --- | --- | --- |
| Cancel 等取消操作（`ghost`） | 透明、无描边；hover 才出现底色 | `--color-text-secondary`、`--color-background-primary-ghost-hover` |
| 有实际功能的次级操作（outline，现有API tone为`secondary`） | 透明底、内描边 | `--color-text-primary`、`--color-border-primary-outline`、`--color-background-primary-outline-hover` |
| 主操作（solid，现有API tone为`primary`） | 实色底与配对文字色 | `--color-background-primary-solid`、`--color-text-primary-solid`、`--color-background-primary-solid-hover` |
| 轻量警戒操作（现有`danger`） | 警戒色，独立于主操作；插件负责确认业务 | `--color-background-danger-soft-alpha`、`--color-background-danger-soft-alpha-hover`、`--color-text-danger` |
| 实色警戒操作（`danger-solid`；原生 React 为 `dangerSolid`） | 用于明确的删除／移除动作，实色警戒底与配对文字；操作范围和二次确认由业务决定 | `--color-background-danger-solid`、`--color-text-danger-solid`；Library 动作条 hover 为 solid 90% alpha |

尺寸：`--control-size-lg`（36px）、`--control-font-size-md`（13px）、`--font-weight-normal`（原生按钮400）、`--radius-full`。水平 gutter 为 `--control-gutter-md × --control-gutter-pill-scaling`（15.96px），图文 gap 为 `--button-gap-lg`。焦点使用 `--color-ring`；禁用保留语义并阻止 hover 反馈。

不要将所有原生按钮改为同一尺寸：Share xl 胶囊是这里选定的弹窗操作规范，页面入口、Composer 控件及其他原生组件仍按各自类型处理。

## Dropdown、Popover 与 Composer 建议列表

| 类型 | 默认材质与 token | 约束 |
| --- | --- | --- |
| Dropdown `surface=menu` | elevated-secondary 90%，`--blur-sm`（8px）、`--color-border-overlay`、`--dropdown-overlay-ring-width`、`--shadow-dropdown-overlay` | Images动作菜单实测。通常rounded-2xl；不要用Popover参数代替 |
| Dropdown `surface=opaque` | 不透明 elevated-secondary、dropdown专用阴影 | 保留明确的不透明分支 |
| Dropdown `surface=panel` | 菜单材质基础上增大padding与阴影，使用blur-lg | 只在存在对应panel需求时采用 |
| Popover | 原生 `opaque` 省略时为true，不透明；false改为90%填充，源码不统一添加模糊 | `--color-border-overlay`、`--popover-overlay-ring-width`、`--shadow-popover-overlay`；`variant=menu`复用opaque菜单，comment有独立样式 |
| Composer SuggestionMenu | 当前Add列表不透明 elevated-secondary、无模糊；边框与阴影受建议列表token控制，当前无投影 | `--radius-suggestion-menu`、`--suggestion-menu-border-width`、`--suggestion-menu-shadow`，不存在时沿用原生fallback；列表文字`--text-sm` |
| Composer expanded top tray | 专用背景与边缘，无blur；embedded分支透明无边框 | `--composer-top-tray-background`、`--composer-top-tray-border`；背景fallback为surface-secondary 94%。不要与独立悬浮菜单混用 |

Dropdown 的 `--shadow-dropdown-overlay` 当前指向 `--shadow-xl-spread`，该 token 自身含0.5px边缘。普通Popover的 `--shadow-popover-overlay` 当前指向 `--shadow-lg`。不要给所有浮层固定附加4px blur或同一个shadow。

Composer菜单的锚点是实际输入框主体（当前语义标记 `data-composer-body`），不是包含diff和请求队列的外层Root。Chat／Work 空白新会话的 ComposerMenu 跟随原生 Add 向下展开，Codex 模式新会话与已有会话向上展开；home 场景读取原生 `data-dropdown-overlay-side`，仅值为 bottom 时向下，缺失时保留向上。间隔4px，按该方向计算可用高度。挂载位置、zoom与碰撞行为沿用对应原生组件，不为修复坐标问题盲目提高z-index。

## Viewer 附属信息面板

Codex 26.930.21537（2026-10-02 原生 File info DOM 与计算样式实测）：viewer 右侧附属信息面板使用不透明 `bg-surface-elevated-secondary`、`rounded-2xl`（20px）和 Electron `elevation-prominent`；没有容器模糊，也不额外叠加 CSS border 或 `shadow-lg`。该 elevation 自带 0.5px 边缘及两层柔和投影，应直接沿用原生 utility。此分支不同于 Dialog、Dropdown 和页面内容面。

标题栏使用固定高度、原生 text-base/semibold 标题及圆形 `button-toolbar` 的 `bg-text/5` 按钮分支，hover 为 `bg-text/10`。面板宽度、viewer 工具栏避让及正文间距由所选原生信息面板的业务布局确定，在功能 DESIGN.md 记录。Images Prompt 采用当前 File info 分支。

## Page 与 sidebar

页面内容面使用 `--color-surface`，当前不透明、无模糊，`--radius-xl-base`（12px）；外部PageSurface使用 `--app-shell-page-surface-shadow`，当前由 `--elevation-stroke-subtle` 与 `--shadow-card` 组成。区分内容面和窗口外壳，不重复施加阴影。

sidebar规则分状态：

| 状态 | 原生规则／token |
| --- | --- |
| 非peeking sidebar-navigation | `--color-surface` 65%（oklab混合），无CSS模糊、无浮窗阴影；可见桌面程度还取决于窗口材质 |
| `data-slate-sidebar-peeking=true` | `--app-shell-sidebar-popover-background`强制alpha=1；`--app-shell-sidebar-popover-radius`当前为radius-xl-base减spacing（8px）；`--hairline`、`--app-shell-sidebar-popover-border`内边缘与`--shadow-card` |

### 全页面功能的页面壳选择

后续功能开发独立全页面时，先按页面自身的导航需求选择页面壳。没有专属二级导航的页面默认使用无二级侧栏的 Page 分支，以原生 Projects 为行为参照；只有任务确实需要常驻二级导航时才选择带侧栏的布局。不能因入口来自 Home、Space、Scheduled 就继承它们的常驻二级侧栏。

页面是否带常驻二级侧栏，与用户的侧栏展开／收起偏好是两个独立语义。无二级侧栏页面只保留 Navbar，内容从 Navbar 右侧开始，不调用侧栏收起动作，也不修改用户的展开偏好。悬浮 Home、Space、Scheduled 等入口时，原生二级侧栏仍叠加在页面上，页面内容不移位；鼠标可进入操作，离开后沿用原生退出行为。

页面壳、原生导航适配与恢复由共享 UI 维护，功能只声明所需分支并负责自己的内容。新功能不得复制侧栏状态机、直接切换原生侧栏按钮，或另写隐藏侧栏的 CSS。退出页面时区分返回原页面与用户主动选择原生导航；卸载／禁用时释放页面壳并恢复所属状态。

验收至少覆盖：从 Home、Space、Scheduled 进入时无常驻二级侧栏；原有展开偏好不变；三个入口的悬浮侧栏覆盖页面且可操作，内容不移位；退出、原生导航与卸载恢复正确。

原生依据与当前实现：Codex 26.930.21537 的源码与隔离窗口确认该布局由路由决定。当前注入 Page 借用 `/projects` 作为原生页面壳，关闭时恢复原位置，用户主动选择原生导航时交还路由；这是版本相关的适配实现，不是功能的业务路由规范。后续原生接口变化只更新共享 Adapter，不改变上述页面语义。

保留原生的固定展开、收起与hover状态。hover sidebar应能覆盖注入页面，鼠标能进入操作，移回页面后可正常收起；不要通过页面层级、pointer-events或额外遮罩挡住它。原生overflow和contain切换负责浮出与裁切，插件不复制一套侧栏状态机。

## 左侧 Navbar

导航入口复用原生按钮容器，三种状态分别维护：

| 状态 | 图标 | 容器 |
| --- | --- | --- |
| 未选中 | outline/default 资源 | 原生未选中色与透明底 |
| 悬浮 | 保持 default 图标 | 原生 hover 底色；保留 sidebar peeking 行为 |
| 当前页面选中 | 独立 filled/selected 资源 | `data-selected` 与 `aria-current="page"`，原生选中色与底色 |

原生 `railIcons.default/selected` 根据 `isCurrentDestination` 选择资源。不能给 outline SVG 简单设置 fill 代替 selected 资源，也不能仅移除 DOM 选中属性就认为图标已还原。注入页面打开时取消原生视觉选中，关闭、导航或卸载时恢复；不更改原生路由，不破坏 Home hover sidebar。

通用入口为 `ui.navigationRail(button, { defaultIcon, selectedIcon })`，返回 `select(boolean)` 与 `restore()`。组件负责展示状态与清理，`packages/ui/src/native/navigation-rail.mjs` 负责原生资源读取。原生图标优先调用资源显式提供的 `createElement(document, className)` DOM API（包含 optical 与主题处理）；单色 IconAsset 读取 default 的真实 SVG；其他组件形式使用已记录的未选中 SVG。default/selected 本就相同的自定义资源保持原图。不要调用带 Hooks 的函数或替换 React 所有的 SVG 子节点；未知资源契约需核对原生来源，不能伪造轮廓。原生重渲染更换 SVG 后重新应用展示状态。

## 层级、Portal 与生命周期

层级数字是本版本实现值，不是原生CSS设计token；共同约束应集中维护语义角色与挂载点。

- 内容页面位于原生sidebar悬浮层下方；MineCodex当前Page使用20，原生左侧栏40。
- 通知使用共享 `notification` 挂载角色（当前45），位于内容页面与常驻二级sidebar（40）之上、原生菜单和模态浮层（通常50）之下，避免 Space 等页面的侧栏遮挡通知；通知业务负责在原生侧栏 peeking 时暂停呈现，不抢占原生导航。
- 原生Dialog、Dropdown、Popover和Composer Floating父容器通常为50；同数值不保证相同层级，仍受挂载顺序与stacking context影响。
- 模态层挂在窗口根容器/原生Portal，遮罩覆盖整个窗口；不要嵌在Page的低层级容器内。原生`dialog.showModal()`使用top layer，不能仅用z-index推断。
- Tooltip使用专用角色与层级；现有MineCodex实现值不是原生标准，不传播为通用token。
- 组件维护通用焦点、Escape、关闭与清理契约；插件传业务回调和恢复焦点目标。原生已提供的生命周期优先复用，迁移时避免重复处理。

## Tooltip

共享Tooltip处理MineCodex标记，不接管原生Tooltip。当前声明入口为 `data-minecodex-tooltip`，删除克隆节点上过时的 `title` / `aria-describedby`，避免双重气泡。

Token：`--color-background-tooltip`、`--color-text-tooltip`、`--color-border-tooltip`、`--shadow-tooltip`、`--radius-2xl`、`--font-sans-default`、`--text-sm`、`--tooltip-compact-font-weight`、`--tracking-tooltip`。原生默认 Tooltip 使用 `rounded-2xl`，同时应用 `corner-shape: var(--codex-corner-shape)`；支持该属性的桌面版本通过 `--codex-corner-radius-scale` 放大半径并采用 superellipse，不能只复制半径而漏掉轮廓。共享实现保持此规则，padding 为 `--spacing × 1.25 / × 3`、行高18px，Portal 从触发器继承相关主题 token。

Navbar 在入口右侧居中，使用 `data-minecodex-tooltip-side="right"`；普通控件读取原生 `--side-tooltip`（默认top），也可显式声明top/bottom/left/right。默认间距2px，碰撞时翻转并保留8px窗口边距，计算考虑window zoom。共享hover延迟200ms，已打开提示之间300ms内切换免等待；键盘focus立即显示，离开／点击／Escape／窗口失焦关闭。时序依据新版自定义 Tooltip provider，不套用包内另一套 Radix 的700ms默认值。共享提示之间维护自己的handoff，不接管原生provider。支持aria关联及卸载清理。额度、上下文等特有内容通过 `tooltipSurface` 复用材质，功能维护自身内容与定位。

## 主题、窗口材质与系统玻璃

以下机制独立，不能以“玻璃效果”混称后套到所有组件：

1. CSS半透明填充与backdrop-filter：用于部分Dialog、Dropdown等组件，模糊其后的网页内容。
2. 窗口vibrancy：macOS部分窗口在允许透明时使用menu材质；不透明设置、焦点、窗口尺寸、屏幕scale及支持状态会影响窗口底层。Windows另有mica路径。`electron-opaque`窗口状态与Dialog的`variant=opaque`不是同一个概念。
3. Owl native glass：仅匹配明确选择glass的原生组件，并遵循宿主能力状态。CSS声明`-owl-native-material:glass`、`--owl-native-glass-adaptive-appearance:off`、`--owl-native-glass-variant:regular`；root `data-owl-native-glass=active`时去掉CSS模糊/阴影并使用round corner；`data-owl-native-source-underlay`分支使用16% surface填充。

本次普通隔离窗口没有Owl glass active属性。安装包中显式`surface:glass`菜单调用位于avatar-overlay-native-page；主进程显式`hasNativeGlass`条件为darwin且appearance为avatarOverlay。不得因为存在glass CSS就为所有插件浮层申请系统玻璃。

主题读取 `data-theme` 与实际token；尺寸和圆角跟随原生scale，位置考虑 `--codex-window-zoom`。沿用原生reduced-motion与焦点状态；不为适配擅自改变应用主题、窗口透明设置或系统辅助设置。

## 当前实现与规范的差异

共享组件已迁入 `packages/ui`：Dialog 支持 default/opaque，Dropdown 支持 menu/opaque，Popover 支持 opaque/translucent，ComposerMenu 使用原生浮动列表材质，Page 使用原生内容面。现有插件显式选择相应类型，不再统一套90%/4px浮层配方。未提供通用系统glass开关；没有明确原生分支与能力证据时，使用所选组件的CSS材质。form/catalog等尚无实际调用需求的分支仅记录原生事实。

现有token注册表供宿主主题桥使用，不代表本文所有组件token已注册。新增iframe消费时核对并补齐所用token；直接注入组件读取原生CSS作用域。按实际需求维护必要别名，删除已失效的兼容代码。

## 维护依据

- `app-shared-eececb2d2eb0.js`：Dialog variant、遮罩配对、Dropdown surface、Popover opaque默认值。
- `app-shared-342447930c78.css`：材质、glassSurface、遮罩、token及按钮规则。
- `app-initial-e55cd978d577.css`：Page、sidebar peeking、Composer top tray及rounded类的corner-shape规则。
- `app-initial-135a4ef2552c.js`：Navbar railIcons状态切换、Tooltip右侧位置；shared JS 自定义Tooltip默认200ms、skip 300ms、offset 2px。
- `main-BbeJ4AAR.js`：窗口opaque/vibrancy及native glass创建条件。
- `avatar-overlay-native-page-caa507f161db.js`：明确的glass菜单使用位置。

这些文件名仅标识本次原生证据，含构建哈希，不能成为运行时选择器。更新Codex后，优先重查语义组件和实际状态；将新的事实回写本规范及相应实现，不凭截图推断所有组件已换代。


## 项目 token 与原生名称的边界

上文表格记录 Codex 原生 token 名称与取证规则。实现由 `packages/ui/src/native/tokens.mjs` 的规范名称、已知别名和 `MINECODEX_THEME_BINDINGS` 映射至项目 `--mcx-*` 命名空间，插件样式消费项目变量。例如原生 `--color-text-primary` → 项目 `--mcx-color-text-primary`，`--shadow-lg` → `--mcx-shadow-lg`，`--radius-3xl` → `--mcx-radius-3xl`。

这里的规范名称是稳定的项目映射键。Codex 更新名称时补充原生别名，不能跟着重命名插件消费的项目 token。新增实际使用的语义才增加映射；不预建完整的第三方 token 系统。`native/theme.mjs` 为直接注入容器写入同一快照，Runtime Host 将它传给 iframe；卸载恢复原值。主题变化丢失某个 token 时清除旧项目值，继续使用该组件既有的明确默认值或不可用状态，不复用上一主题颜色。

这些映射不改变原生组件分类、材质分支和 hover sidebar 层级，也不重写原生 Tailwind utility class。插件复用 native Adapter 返回的原生模板；特殊样式使用项目 token，Dialog、Button、Tooltip 等通用表现继续由组件库维护。


### Library 多选动作条的实色警戒按钮

Codex 26.930.21537（2026-10-02 原生源码与隔离窗口）：Library 选中动作条的 Delete 使用 `dangerSolid`、full radius、toolbar size，图标 16px，警戒底与白色配对文字；hover 使用 danger solid 90% alpha，禁用保留原生 40% opacity 与禁止交互。确认弹窗也使用实色警戒提交按钮。共享 DOM 入口为 `ui.action(button, "danger-solid")`，和既有 soft `danger` 分支并存，不迁移原有功能的语义。通用组件只提供视觉和交互状态，删除确认、隐藏／回收站／永久删除的范围由所属功能明确告知。

## MineCodex 项目品牌图标

项目标识采用实心镐子与 Codex 原生六瓣外圈，唯一可编辑源为 `assets/brand/minecodex-icon.svg`。内部镐子使用 `translate(6.24 6.24) scale(.48)`，纯填充、无描边；保留已确认的留白比例。此标识代表 MineCodex，不替换插件功能图标、模型厂商图标或 Codex 原生应用图标。

内联使用 `currentColor` 跟随所在表面的语义文字色；外链明暗版本分别使用 `#0d0d0d` / `#fafafa`，透明背景。favicon 在 SVG 内通过 `prefers-color-scheme` 适配系统主题，Dashboard 标题通过 CSS mask 跟随页面 `--ink`。明暗版本、favicon 和 README 标识由 `npm run build:icons` 从同一源文件生成，修改几何后运行该命令。

macOS 后台服务 App 在明确的原生资源修订 1.0.1 中接入实心图标，采用浅色圆角底板，保证在明暗系统表面均可辨认。ICNS 来自同一项目几何。安装器先注销旧后台项，再验证并替换 bundle，最后重新注册；不能直接修改已安装的签名资源。后续普通 JavaScript 发布保留此原生 bundle 的签名身份，升级流程与验收边界见 `packages/cli/native/DEVELOPMENT.md`。

### 官方插件中的 MineCodex 入口

项目入口使用官方 MCP Apps global entrypoint，交由原生导航管理固定、收纳、
焦点和页面壳，不再克隆账号菜单行。品牌图标来自唯一 SVG 源；控制台内容沿用
apps/dashboard/DESIGN.md，使用独立本地视觉快照，只经 MCP bridge 跟随宿主明暗选择信号，保留当前会话手动外观选择。
此接口已在 Codex 26.930.51102 源码确认；真实原生面板交互仍须独立验收。

### 原生文档块悬浮操作

Codex 26.930.21537 的 Chat Markdown 表格、代码块与可视化块共用公开 `data-block-actions` React 操作栏：surface 背景、full 圆角、2px padding、4px gap，hover / focus-within / data-visible / open-popover 状态可达，粗指针显示。控件使用原生 Button 的 `blockAction`、`full`、`inputIcon` 分支，Tooltip 和 CopyButton 反馈由原生组件管理。功能负责块的内容、状态与回调，Adapter 负责公开角色发现与 context 接入；不要复制这一分支的按钮或 Tooltip 材质。

### 文件路径导航中的原生文件行

Codex 26.930.21537（2026-10-05 源码与隔离窗口）：文件 breadcrumb 使用原生 capsule / controlSurface；入口 hover 采用原生文字角色变化，不额外叠加按钮底色。菜单中的 BaseFileTree `surface=dropdown` 提供文件类型图标、行 hover、选中、focus、长名称截断与虚拟滚动，直接复用该 React 组件，不在功能 CSS 中重建行材质。外层使用共享 opaque Popover。字体中等字重通过共享 `--font-weight-medium` → `--mcx-font-weight-medium` 映射；分列布局与路径压缩规则见 File Navigation DESIGN.md。

### Token 诊断范围

2026-10-05，Codex 26.930.51102：根作用域缺失不等于官方删除。全局诊断只展示根已定义的值；插件实际作用域继续检查必要 token 与映射。清除无消费的旧 summary / button 登记项；summary 字重直接读取原生计算样式。SuggestionMenu 的可选变量及 fallback 保留。

## 官方 MCP App 主题桥

Prompt 官方页面使用 `packages/ui/src/native/mcp-theme.mjs` 将 MCP Apps 宿主 `styles.variables` 映射为共享 `--mcx-*` token；宿主更新 theme / locale 时同步。iframe 初始 fallback 与结构尺寸在同目录 `mcp-theme.css`，复用根规范中的控件、圆角和间距；共享材质仍由原有 surfaces / dialog / button 安装器负责。Prompt 使用自己的 book-open 图标，MCX 控制台使用品牌图标。

Codex 26.930 官方侧栏 MCP icon 的 leading 容器为 `icon-base`（20×20px），菜单 compact 为 `icon-xs`（16px）。Prompt 资源按20px、27单位viewBox留白与1.8单位笔画提供，不改原生容器或热区。`packages/ui/src/native/mcp-app.mjs` 通过原生 GlobalView 的 source.server 识别 MCX 页，保留 header 节点，仅隐藏重复的宿主标题；切换到其他插件或卸载时恢复。

Codex 26.930.51102 源码：MCP 导航的默认与选中资源相同，图标经 SVG mask 使用原生 `currentColor`。MCX 的选中资源由共享 `mcp-navigation.mjs` 按原生 `aria-current`／`data-selected` 切换，仅修改 mask image 的 href，不替换 React 节点。Prompt 复用原有 Phosphor 填充书本；MineCodex 由品牌源生成填充六瓣外圈与透明镐子。颜色、尺寸、热区与选中底色全部由原生组件决定，不反转主题色。其他插件、取消选中、节点复用与卸载均恢复原生资源。

### Quick Chat 原生浮动面

2026-10-08 本机 Renderer 源码与隔离窗口：FloatingPanelSurface 的 default / single-line 使用不透明 `--color-surface-elevated-secondary`、0.5px border ring 与原生 `shadow-2xl` utility。圆角随原生 floatingPanel / composer single-line token，不覆盖窗口几何或强制统一圆角。新聊天的 composer-only 分支原生背景为 unstyled；主动展开 History 时共享 UI 的 `floating-panel` 分支补全其原有背景平面，关闭历史或功能时撤销。

### Dashboard 本地视觉快照

MCX 控制台（浏览器与官方 MCP App）使用 `apps/dashboard/styles.css` 中独立的
确定值主题；宿主只提供 light／dark 选择，不注入渲染必需的 token 值。共享 Tooltip
的视觉输入也来自这份本地定义。2026-10-11 的 Codex 26.1007.21159 页面与 Prompt
观测、明暗来源表、卡片预览及媒体接口见 `apps/dashboard/DESIGN.md`。这是控制台的
明确可靠性边界；Prompt 与其他注入功能继续使用本规范既有的原生映射策略。
