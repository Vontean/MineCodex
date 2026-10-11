# Design System: Codex Model Slider

通用视觉、材质、按钮、Tooltip 与原生 sidebar 层级遵循根 [DESIGN.md](../../DESIGN.md)。本文件只记录功能特有组件、布局、数据语义与通用组件选型。

## 1. Visual Theme & Atmosphere

Model Slider 延续 Codex 原生的克制、紧凑和功能优先。增强层只改善模型识别与选择效率，不创建独立视觉语言。

## 2. Color Palette & Roles

- **Reasoning Accent Blue** (`var(--color-chart-blue)`): Slider 打开时的普通推理强度，沿用 Codex 原生 active effort 语义。
- **Maximum Effort Purple** (`var(--color-chart-purple)`): 仅用于 Ultra 推理强度及其相关状态。

模型名为主要内容，Provider 为辅助信息；通用文字与交互角色遵循根规范。

## 3. Typography Rules

Composer 触发器区分两种状态：占位态（"Select model" / "Select effort"）沿用原生 160px Content 宽度；真实模型态让芯片 HUG 完整模型名，长名称不被截断，reasoning effort 始终完整可见。Slider 顶部的模型名最多显示两行。

## 4. Component Stylings

- **多输入框同步：** 主 chat 与 side chat 的可见任务输入框分别维护模型标签和宽度测量；只有对应替换标签存在时才隐藏原生名称，节点重建期间保留原生名称。菜单操作继续跟随当前打开的原生按钮。
- **Composer Trigger:** 占位态恢复原生 160px Content 宽度；真实模型态 HUG 完整名称，头部保留原生可点击 chevron。
- **Slider Header:** 模型名最多两行，容器高度随内容自然撑开；effort 与 chevron 不收缩。无 Fast 时移除原生 12px 预留占位，让按钮与面板严格居中。
- **Model List:** 保持 264px 原生宽度、Provider 副文本、收藏与最多六项可视高度；收藏与未收藏之间保留分隔线，弹窗内容四周保留约 6px 内边距；模型弹窗与原生 Slider 一致地水平居中于触发器。列表打开期间，Composer 占位文案从 `Select effort` 切为原生语义 `Select model`，关闭后恢复。
- 收藏和未收藏各自排序，保留两组分隔线。组内 OpenAI 优先；GPT 先按 Astra > Sol > Terra > Luna 排列，再按数字版本逐段降序（如 6.10 > 6.1 > 6 > 5.6 > 5.5），无命名档次的 GPT 放在四档之后。第三方按模型自身的厂商及现有品牌配置分组（不按接入 provider），同厂商内数字版本新的在上；点号及连字符版本使用同一比较规则，版本相同保留原顺序。
- **Model Search:** 列表顶部常驻轻量搜索框，打开时立即聚焦，placeholder 为 `Search model` / `搜索模型`；使用原生小字号、辅助文字色和透明输入底，不增加醒目描边。搜索框 sticky，列表滚动时仍可输入。按模型名、完整 ID 和 Provider 忽略大小写筛选，多词共同匹配；收藏分隔线只在两侧都有可见结果时显示。点击列表保留输入焦点，方向键预览、Enter 选择、Escape 返回 Slider，中文输入法组合期间不提交。结果数量变化沿用底边锚定的 320ms 高度过渡，减少动态效果时直接改变高度；无结果时显示本地化空状态。
- 列表打开时先显示顶部；展开结束后检查当前选中模型是否完整可见，sticky 搜索栏不计入可见内容区。不可见时用 400ms ease-out cubic 滚到内容区中央，靠近列表边缘时限制在实际滚动范围内；已可见则保持顶部。用户滚动、触摸、点击、按键或搜索立即中断，当前打开周期内不再自动定位；关闭与卸载取消定位。减少动态效果时直接定位，不播放滚动动画。
- 模型列表使用共享 Dropdown 的 `opaque` 分支：不透明主题填充、无背景模糊，保留 Dropdown 圆角、边缘和阴影，避免后方聊天文字透入列表。此选择仅适用于模型列表。
  搜索栏的同色填充覆盖到菜单顶部，包括 sticky 上方的 6px 内边距；滚动条目不得从顶部空隙露出。遮挡不占布局高度，不改变列表可视高度、搜索筛选或底边锚定规则。
- Slider 与模型列表切换沿用 Codex 26.930.21537 的动效节奏：底边锚定，高度 320ms（`cubic-bezier(.19,1,.22,1)`）；列表内容 200ms 淡变与 10px 位移（`cubic-bezier(.23,1,.32,1)`），进入延迟 40ms。返回时收缩并淡出，Escape 先返回 Slider；减少动态效果时立即切换。切换与卸载会取消旧动画和清理定时器，不改原生 React 节点。
- OCX 自动发现的 GPT 路由若与原生模型同名且没有独立推理档位，列表只显示原生项；当前已选中的路由仍显示，避免失去切换入口。有独立档位的 Provider 路由继续显示并标注 Provider。
- Slider 预览档位时同步 effort 标签与 Fast 控件的 Ultra 状态；离开 Ultra 后立即恢复普通档位颜色。
- Fast 粒子沿完整滑轨等速、等间距运动；档位只裁剪可见范围，不改变运动周期或将粒子压缩到填充区域。首次开启、重开面板与拖动预览遵循同一规则。

## 5. Layout Principles

宽度遵循原生菜单，垂直方向允许内容自然增长。长名称优先换行而不是扩大面板；Composer 的紧凑触发器优先保留 effort 可读性。

## 代码归属

模型身份、品牌与别名、目录匹配、路由去重及档位交集由 `src/domain/model-rules.mjs` 维护，不读取 DOM 或收藏存储。`src/frontend/install.mjs` 维护原生控制器适配、收藏缓存、菜单、滑条与节点恢复，使用共享 Dropdown 材质。`src/injection-source.mjs` 将两者组装为自包含 Renderer 安装函数；宿主只提供配置、locale、共享 UI、图标工厂与刷新调度，调用 ensure/dispose。

模型收藏由 `src/backend/favorites.mjs` 持久化；Renderer 首次接入通过 `model-favorites`
host action 收录旧 localStorage 收藏，之后以后端为准。当前窗口保留本地缓存以维持菜单响应；
修改提交为增删操作，避免覆盖其他窗口收藏。迁移导入按 ID 合并，下一次 Codex 启动载入。
Fast 图标 localStorage 仍只属于可再生成缓存，不进入迁移包。

跨机器收藏按完整模型 ID 匹配：本机缺少的模型保留收藏记录但不创建可选项；不同服务商的同名模型不自动对应，也不改变当前选中模型与思考档位。

- Codex 26.1007.21159 原生模型弹层带 CSS `zoom` 与开场 `scale`。模型列表打开、返回、搜索的高度动画使用 computed CSS height；可用屏幕高度先除以 `currentCSSZoom` 转换为布局尺寸，避免动画起点和终点重复缩放。
