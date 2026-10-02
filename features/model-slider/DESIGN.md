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

- **Composer Trigger:** 占位态恢复原生 160px Content 宽度；真实模型态 HUG 完整名称，头部保留原生可点击 chevron。
- **Slider Header:** 模型名最多两行，容器高度随内容自然撑开；effort 与 chevron 不收缩。无 Fast 时移除原生 12px 预留占位，让按钮与面板严格居中。
- **Model List:** 保持 264px 原生宽度、Provider 副文本、收藏与最多六项可视高度；收藏与未收藏之间保留分隔线，弹窗内容四周保留约 6px 内边距；模型弹窗与原生 Slider 一致地水平居中于触发器。列表打开期间，Composer 占位文案从 `Select effort` 切为原生语义 `Select model`，关闭后恢复。
- 模型列表使用共享 Dropdown 的 `opaque` 分支：不透明主题填充、无背景模糊，保留 Dropdown 圆角、边缘和阴影，避免后方聊天文字透入列表。此选择仅适用于模型列表。
- Slider 与模型列表切换沿用 Codex 26.930.21537 的动效节奏：底边锚定，高度 320ms（`cubic-bezier(.19,1,.22,1)`）；列表内容 200ms 淡变与 10px 位移（`cubic-bezier(.23,1,.32,1)`），进入延迟 40ms。返回时收缩并淡出，Escape 先返回 Slider；减少动态效果时立即切换。切换与卸载会取消旧动画和清理定时器，不改原生 React 节点。
- OCX 自动发现的 GPT 路由若与原生模型同名且没有独立推理档位，列表只显示原生项；当前已选中的路由仍显示，避免失去切换入口。有独立档位的 Provider 路由继续显示并标注 Provider。
- Slider 预览档位时同步 effort 标签与 Fast 控件的 Ultra 状态；离开 Ultra 后立即恢复普通档位颜色。

## 5. Layout Principles

宽度遵循原生菜单，垂直方向允许内容自然增长。长名称优先换行而不是扩大面板；Composer 的紧凑触发器优先保留 effort 可读性。

## 代码归属

模型身份、品牌与别名、目录匹配、路由去重及档位交集由 `src/domain/model-rules.mjs` 维护，不读取 DOM 或收藏存储。`src/frontend/install.mjs` 维护原生控制器适配、收藏存储、菜单、滑条与节点恢复，使用共享 Dropdown 材质。`src/injection-source.mjs` 将两者组装为自包含 Renderer 安装函数；宿主只提供配置、locale、共享 UI、图标工厂与刷新调度，调用 ensure/dispose。
