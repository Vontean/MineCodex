# Prompts 设计约定

## 范围与数据
Prompts 页面负责新增、编辑、分类、Emoji、排序和统计；Quick Prompts Popover 只浏览和插入。移除旧顶部 Notes 入口、固定摘要、Todo 和 Files 界面。沿用 `notes` 功能 ID 与 SQLite，保留已有提示词、历史 Todo / Files 数据和用户文件。

## 原生依据
2026-09-27 在隔离 Codex 实测导航扩展区、Library 页面及 Add files and more。
- Prompts 导航项位于固定扩展区末尾，顺序跟随扩展区而非硬编码 Projects。仅定位 `data-app-navigation-rail`，不匹配设置菜单。
- Quick Prompts 位于 Add 与 Change permissions 之间，克隆 Add 的按钮 classes 与响应式图标容器。入口采用 Lucide book-open；20px 图标描边折算 1.75px（24 viewBox / stroke-width 2.1）。
- 页面沿用 Library 的大标题和胶囊 Tabs；分类图标取自当前 Codex 原生 SymbolBrowser / project appearance catalogue，记录于 `assets/native-prompt-icons.json`，不手绘路径。

| 角色 | Token / 权威来源 | 值或用途 |
| --- | --- | --- |
| 输入框入口热区 | 原生 Add 的 h-token-button-composer / aspect-square | 28×28px |
| 入口图标 | 原生 CompactSource / LeadingSource | 16 / 20px |
| 字体 | --font-sans-default、--text-sm | 13px，原生字重 |
| 页面标题 | --text-heading-lg | 24px / 36px，600 |
| 页面内容 | 原生 Library header | 最大 1440px，左右 48px / 窄屏 30px |
| Tabs | 原生 Library tablist | 36px 高，胶囊，左右 16px |
| 文字 | --color-text-primary / secondary / tertiary | 标题、操作、辅助信息 |
| 面板 / 页面 | --color-surface-elevated-secondary、--color-token-border-default | 原生 surface、1px 边框，无额外阴影 |
| Popover 圆角 | --radius-suggestion-menu，回退 --radius-2xl | 20px |
| Popover 内边距 | --spacing | 4px，底部保留内边距 |
| Popover 列表行 | --suggestion-menu-item-padding / --app-menu-item-padding / --padding-row-y、--padding-row-x | 5px 8px |
| 行圆角 | --suggestion-menu-item-radius / --radius-xl | 15px |
| Hover | --color-background-primary-ghost-hover | 原生中性色 |
| Popover 位置 | 输入框上方 | 与输入框等宽，间隔 4px |

分类颜色复用原生选择器的亮 / 暗模式色值：blue #0285ff / #339cff、green #04b84c / #40c977、orange #fb6a22 / #ff8549、pink #ff66ad / #ff8cc1、purple #924ff7 / #ad7bf9、red #fa423e / #ff6764、yellow #ffc300 / #ffd240；black 使用原生次级文字 token。

## 页面
Header 为 Prompts；右侧依次为排序图标、分类调节图标、常驻搜索框、New prompt。搜索框直接采用原生 Library 的透明背景、1px outline、32px 高、胶囊圆角、12px 水平 padding 和 16px 搜索 SVG。分类管理使用原生 sliders 图标，不再放在 Tabs 行。排序菜单沿用原生 Library 的 4px gutter、20px radius、5px / 8px item padding、90% elevated surface 与 shadow-xl-spread。Tabs 仅包含 All、分类和 Other。默认分类生图、编程、文案、研究、翻译、效率，允许新增、改名、删除、换图标和颜色。删除分类仅解除归属，保留提示词和统计。

分类管理在 440px 宽居中模态面板中完成，复用原生 New folder 弹窗的 20px padding、25px radius、弱描边与背景遮罩。分类编辑保留箭头返回和关闭按钮，不使用文字 Back 或整页替换。模态内限制 Tab 焦点，Escape 关闭后恢复入口焦点。提示词编辑使用同一结构，宽 520px。

单条提示词通过图标弹出框选择 Emoji，沿用原生 Thread SymbolBrowser 的搜索和八列网格，不使用文本输入框；可恢复继承分类图标。分类选择为图标加名称的自定义菜单，不使用浏览器 select。列表显示标题、正文摘要；Manual order 和 Most used 显示累计调用次数，Recently used 在相同位置显示上次调用时间，未调用显示 Never used；点击进入编辑。手动排序采用右侧三横手柄拖拽，提示词限制组内排序；分类管理同样拖拽排序。Alt + ↑ / ↓ 提供键盘操作。另支持按调用次数、最近调用排序。搜索及统计排序期间不显示手动重排控件，避免操作含义不明确。

## Popover
入口 Tooltip 为 Quick Prompts，面板不重复显示标题，不包含新增、编辑、收藏、删除或管理操作。最上方显示最近实际调用的 3 条，后面按分类与组内手动顺序展示全部提示词；最近项目仍留在所属分类，避免分类内容随调用跳动。空分类隐藏。

点击提示词只插入当前输入框，保留原草稿且不发送。Escape 关闭并回到入口；点击外部关闭；方向键移动列表焦点。原生 Add 或权限面板打开时关闭。切换输入框时关闭，异步结果不得插入另一会话。沿用原生焦点与 hover，无额外进场动画。

## 统计
成功插入后原子增加 `use_count` 并更新 `called_at`，保存于现有 SQLite。创建、编辑、复制和排序不计数。历史次数未知，从 0 开始，不从旧 `last_used_at` 推断。删除分类、切换页面、重启不清零。

本地数据只以 textContent 和表单值渲染，不执行提示词里的 HTML。页面关闭恢复底层原生视图的焦点能力；功能禁用移除所有本功能入口和视图。

## 空状态与编辑细节
空分类和搜索无结果沿用 Scheduled 的 48px Emoji、18px medium 标题、次级说明布局；空分类提供 New prompt。All 分组副标题采用 text-sm、500 字重与 text-tertiary。输入框 focus 只用原生 border-ring 1px 边框，无外圈。模态 Back / Close 图形与内容边缘光学对齐，热区向外扩展。Delete 使用警戒样式；非空分类删除前独立确认，明确提示词移到 Other，内容与调用次数保留。

导航栏 book-open 单独采用 20px 容器、27×27 viewBox，实际轮廓约 16.15px，描边折算 1.33px，与原生导航一致。Lucide 两个描边子路径合为一个 path，一次绘制半透明 currentColor，避免书脊交叠变深。输入框入口尺寸不变。

拖拽排序使用等高 Drop Placeholder，原生拖影跟随指针；同组条目以 180ms ease-out 让位，落位淡入 140ms。放到范围外或取消恢复原位，不写入排序。遵循 prefers-reduced-motion。

页面外壳圆角直接使用原生 PageSurface 的 `--radius-xl-base`（当前 12px），不使用经过角半径缩放的 `--radius-2xl`，避免覆盖层和原生底层边缘错位。

深浅主题层级：页面使用 `--color-surface`；弹窗/菜单使用 `--color-surface-elevated-secondary`。标题跟随原生 heading-lg（`--text-heading-lg`、`--font-weight-medium`、1.2 行高）。正文用 text-primary，摘要用 text-secondary，分组与辅助信息用 text-tertiary。主按钮使用 background-primary-solid / text-primary-solid 配对；警戒按钮使用 danger-soft-alpha，不使用浅色固定粉红底。边界统一使用 `--color-border` 或输入框的 `--color-border-primary-outline`。

提示词编辑沿用原生 Project 的复合标题输入：40px 图标段位于标题前，细分隔线，共用圆角边框与 focus-within 状态。图标选择入口不再单独占一行；Title 通过 aria-label 标识。

Prompts 覆盖页打开时暂存并移除原生导航项的 data-selected / aria-current，使用 data-suppress-active-style 还原未选中表现。关闭页面或禁用插件时恢复原生属性；观察原生重渲染，确保同时只有一个当前导航项。

Category 下拉面板与触发栏等宽、左右对齐，宽度包含内边距；每次打开按当前触发栏尺寸计算。

## 语言
界面名称、操作、Tooltip、无障碍标签、空状态、错误提示与图标/颜色名称按 Codex 的语言显示中英文；日期按对应 locale 格式化。用户保存的提示词与分类名称原样展示，不随界面语言改写。
