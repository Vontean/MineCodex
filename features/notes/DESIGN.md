# Prompts 设计约定

通用视觉、材质、按钮、Tooltip 与原生 sidebar 层级遵循根 [DESIGN.md](../../DESIGN.md)。本文件只记录功能特有组件、布局、数据语义与通用组件选型。

## 范围与数据
Prompts 页面负责新增、编辑、分类、Emoji、排序和统计；Quick Prompts Popover 只浏览和插入。移除旧顶部 Notes 入口、固定摘要、Todo 和 Files 界面。沿用 `notes` 功能 ID 与 SQLite，保留已有提示词、历史 Todo / Files 数据和用户文件。

## 原生依据
2026-09-27 在隔离 Codex 实测导航扩展区、Library 页面及 Add files and more。
- Prompts 导航项位于固定扩展区末尾，顺序跟随扩展区而非硬编码 Projects。仅定位 `data-app-navigation-rail`，不匹配设置菜单。
- Quick Prompts 位于 Add 与 Change permissions 之间，克隆 Add 的按钮 classes 与响应式图标容器。入口采用 Lucide book-open；保留 16 / 20px 图标容器，viewBox 扩为 27，将图形缩小约 11%；non-scaling-stroke 保持 1.5px 笔画，热区仍为 28px。
- 页面沿用 Library 的大标题和胶囊 Tabs；分类图标取自当前 Codex 原生 SymbolBrowser / project appearance catalogue，记录于 `assets/native-prompt-icons.json`，不手绘路径。

| 角色 | Token / 权威来源 | 值或用途 |
| --- | --- | --- |
| 输入框入口热区 | 原生 Add 的 h-token-button-composer / aspect-square | 28×28px |
| 入口图标 | 原生 CompactSource / LeadingSource | 16 / 20px |
| 页面内容 | 原生 Library header | 最大 1440px，左右 48px / 窄屏 30px |
| Tabs | 原生 Library tablist | 36px 高，胶囊，左右 16px |
| Popover 圆角 | --radius-suggestion-menu，回退 --radius-2xl | 20px |
| Popover 内边距 | --spacing | 4px，底部保留内边距 |
| Popover 列表行 | --suggestion-menu-item-padding / --app-menu-item-padding / --padding-row-y、--padding-row-x | 5px 8px |
| 行圆角 | --suggestion-menu-item-radius / --radius-xl | 15px |
| Popover 位置 | Add 所属的 `[data-composer-body]`；Chat／Work home 下方、Codex home 与已有会话上方 | 与输入框主体等宽，间隔 4px；外层 Root 的 diff / request stack 不参与定位 |
| 页面条目正文预览宽度 | `.pm-preview` 的 `max-width:65%` | 相对于条目文字区域 `.pm-info`，单行省略；标题与点击区域保持全宽 |

分类颜色复用原生选择器的亮 / 暗模式色值：blue #0285ff / #339cff、green #04b84c / #40c977、orange #fb6a22 / #ff8549、pink #ff66ad / #ff8cc1、purple #924ff7 / #ad7bf9、red #fa423e / #ff6764、yellow #ffc300 / #ffd240；black 使用原生次级文字 token。

## 页面
Header 为 Prompts；右侧依次为排序图标、分类调节图标、常驻搜索框、New prompt。搜索框直接采用原生 Library 的透明背景、1px outline、32px 高、胶囊圆角、12px 水平 padding 和 16px 搜索 SVG。分类管理使用原生 sliders 图标，不再放在 Tabs 行。排序菜单选择通用 Dropdown 的 menu 分支，内容密度跟随原生 Library。Tabs 仅包含 All、分类和 Other。默认分类生图、编程、文案、研究、翻译、效率、思考、学习，允许新增、改名、删除、换图标和颜色。删除分类仅解除归属，保留提示词和统计。

分类管理选择通用 Dialog 的 opaque 分支（Sites Share），宽440px；提示词编辑同一分支，宽520px。当前通过 `config.ui` 接入。分类编辑在标题前保留24px箭头返回热区，不使用文字 Back 或整页替换。挂载与焦点契约遵循根规范。

单条提示词通过图标弹出框选择 Emoji，沿用原生 Thread SymbolBrowser 的搜索和八列网格，不使用文本输入框；可恢复继承分类图标。分类选择为图标加名称的自定义菜单，不使用浏览器 select。列表显示标题、正文摘要；Manual order 和 Most used 显示累计调用次数，Recently used 在相同位置显示上次调用时间，未调用显示 Never used；点击进入编辑。手动排序采用右侧三横手柄拖拽，提示词限制组内排序；分类管理同样拖拽排序。Alt + ↑ / ↓ 提供键盘操作。另支持按调用次数、最近调用排序。搜索及统计排序期间不显示手动重排控件，避免操作含义不明确。

## Popover
入口 Tooltip 为 Quick Prompts，面板不重复显示标题，不包含新增、编辑、收藏、删除或管理操作。最上方显示最近实际调用的 3 条，后面按分类与组内手动顺序展示全部提示词；最近项目仍留在所属分类，避免分类内容随调用跳动。空分类隐藏。

点击提示词只插入当前输入框，保留原草稿且不发送。Escape 关闭并回到入口；点击外部关闭；方向键移动列表焦点。原生 Add 或权限面板打开时关闭。切换输入框时关闭，异步结果不得插入另一会话。沿用原生焦点与 hover，无额外进场动画。

入口通过 Codex Adapter 的 `purpose:"insertion"` 挂载到可见的原生输入框，覆盖 Chat、Work、Codex、Temporary Chat、浮动聊天，以及 side panel 全屏非聊天页面的 chat bar。多输入框并存时优先当前焦点所在输入框；插入操作显式绑定打开面板的输入框，切换后关闭旧面板，不向隐藏输入框插入。此插入契约不扩展会话指标使用的 Codex thread 契约。

原生可见的 Add 或菜单按钮展开时关闭 Popover。Session Status 的 Context 展开状态不是弹出菜单，不作为冲突条件；隐藏输入框和隐藏控件不参与锚点定位或菜单判断。

## 统计
成功插入后原子增加 `use_count` 并更新 `called_at`，保存于现有 SQLite。创建、编辑、复制和排序不计数。历史次数未知，从 0 开始，不从旧 `last_used_at` 推断。删除分类、切换页面、重启不清零。

本地数据只以 textContent 和表单值渲染，不执行提示词里的 HTML。页面关闭恢复底层原生视图的焦点能力；功能禁用移除所有本功能入口和视图。

## 空状态与编辑细节
空分类和搜索无结果沿用 Scheduled 的48px Emoji、18px medium标题、次级说明布局；空分类提供 New prompt。All 分组副标题采用 text-sm、500字重与 text-tertiary。Cancel 选择通用 ghost，保存选择 primary，Delete 选择 danger；非空分类删除前独立确认，明确提示词移到 Other，内容与调用次数保留。

导航栏 book-open 单独采用 20px 容器、27×27 viewBox，实际轮廓约 16.15px，描边折算 1.33px，与原生导航一致。Lucide 两个描边子路径合为一个 path，一次绘制半透明 currentColor，避免书脊交叠变深。选中态使用 Phosphor 官方 book-open-fill 的20px资源；授权见 vendor/phosphor-LICENSE。输入框入口尺寸不变。

拖拽排序使用等高 Drop Placeholder，拖影跟随指针并显式按源行圆角裁切，不留下矩形外边界；同组条目以 180ms ease-out 让位，落位淡入 140ms。放到范围外或取消恢复原位，不写入排序。遵循 prefers-reduced-motion。

页面选择通用 Page 的 `sidebar:"none"` 分支，自身不带常驻二级侧栏，保留原生 Home、Space、Scheduled sidebar 的悬浮叠加与导航行为。关闭页面恢复原页面位置，不改变用户的侧栏展开偏好。原生二级入口（如 Space → Images）提交导航后，通过共享 Page 的 `onNavigate` 关闭 Prompts、编辑浮层并释放底层 inert；保留用户刚选择的目标路由。仅悬浮展开侧栏不退出 Prompts。

提示词编辑沿用原生 Project 的复合标题输入：40px 图标段位于标题前，细分隔线，共用圆角边框与 focus-within 状态。图标选择入口不再单独占一行；Title 通过 aria-label 标识。

Prompts 导航状态调用通用 `ui.navigationRail`：未选中／hover使用outline，选中使用filled，打开页面时取消原生视觉选中，关闭或卸载恢复。原生图标资源读取与选中属性恢复由通用层维护；Navbar Tooltip 使用通用右侧定位与原生延迟。

Category 下拉面板与触发栏等宽、左右对齐，宽度包含内边距；每次打开按当前触发栏尺寸计算。

## 语言
界面名称、操作、Tooltip、无障碍标签、空状态、错误提示与图标/颜色名称按 Codex 的语言显示中英文；日期按对应 locale 格式化。用户保存的提示词与分类名称原样展示，不随界面语言改写。

## 内置提示词与 Tooltip

内置 24 条来自 dsh-prompt 0.1.13 的 MIT 提示词，正文保持原样，按思考、学习、编程、效率分类并配 Emoji。来源与许可保存在 assets/dsh-prompt-LICENSE.txt。首次启动或旧库升级时单次导入；随后允许编辑和删除，重启不还原，也不重建被删除的分类。用户个人内容只保留在本机数据库，不纳入默认资源。

简短悬浮提示调用共享 Tooltip；具体文案由本功能维护。Quick Prompts 通过通用 ComposerMenu 使用原生浮动建议列表材质和输入框主体锚点。排序、分类与图标菜单显式选择 Dropdown。

Categories 管理弹窗的 New category 是有实际功能的次级操作，使用共享 Button 的 `secondary`（outline）分支；分类编辑的 Save 保留主按钮。

2026-10-04：修正 home 场景范围。Codex 26.930.21537 安装源码的 `data-dropdown-overlay-side` 来自原生 `surfacePlacement.overlayPlacement`，用于 Add 展开方向。Quick Prompts 仅在 home 且原生值为 bottom 时向下；Chat／Work 空白新会话跟随原生方向，Codex 模式新会话与已有会话保持向上。标记缺失时向上。两侧均与主体等宽、间隔4px，按展开方向计算可用高度并处理 zoom。用户截图和安装源码已核对，修复后的原生窗口视觉待验收。
