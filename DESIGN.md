# MineCodex 通用设计规范

本文件是全项目通用设计规范的权威入口，由 MineCodex 组件库维护。按原生组件类型和明确分支适配；不要把一个页面中的视觉样式推断成所有组件的统一样式。组件库及插件的 DESIGN.md 只记录本级特殊组件、选型和功能差异，不复制此处的通用规则。

依据：2026-10-01，Codex **26.928.21956** 安装包源码，以及隔离窗口的原生 DOM、React 参数和计算样式。浅色 Dialog、菜单、页面与 sidebar 已实测；深色相关遮罩来自源码定义，未据此宣称深色视觉验收完成。

## 原生规则与 MineCodex 选择

原生组件分类是事实，插件采用哪个分支是产品选择，两者分别记录。例如 Prompts 和 MineCodex Sites 的管理弹窗采用用户指定的 Sites Share 分支；这不意味着原生默认透明 Dialog 被淘汰。按钮外形也不决定容器材质。

Token 名称是实现依据；括号内数值是本版本观测值。读取实际生效作用域，不仅仅读 documentElement；原生窗口、主题、局部组件均可能覆盖 token。iframe 需要宿主传递 token，不能假设自动继承 Renderer CSS。

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
| 警戒操作（现有`danger`） | 警戒色，独立于主操作；插件负责确认业务 | `--color-background-danger-soft-alpha`、`--color-background-danger-soft-alpha-hover`、`--color-text-danger` |

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

Composer菜单的锚点是实际输入框主体（当前语义标记 `data-composer-body`），不是包含diff和请求队列的外层Root。挂载位置、可用高度、zoom与碰撞行为沿用对应原生组件，不为修复坐标问题盲目提高z-index。

## Page 与 sidebar

页面内容面使用 `--color-surface`，当前不透明、无模糊，`--radius-xl-base`（12px）；外部PageSurface使用 `--app-shell-page-surface-shadow`，当前由 `--elevation-stroke-subtle` 与 `--shadow-card` 组成。区分内容面和窗口外壳，不重复施加阴影。

sidebar规则分状态：

| 状态 | 原生规则／token |
| --- | --- |
| 非peeking sidebar-navigation | `--color-surface` 65%（oklab混合），无CSS模糊、无浮窗阴影；可见桌面程度还取决于窗口材质 |
| `data-slate-sidebar-peeking=true` | `--app-shell-sidebar-popover-background`强制alpha=1；`--app-shell-sidebar-popover-radius`当前为radius-xl-base减spacing（8px）；`--hairline`、`--app-shell-sidebar-popover-border`内边缘与`--shadow-card` |

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
