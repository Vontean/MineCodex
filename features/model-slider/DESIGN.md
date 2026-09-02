# Design System: Codex Model Slider

## 1. Visual Theme & Atmosphere

Model Slider 延续 Codex 原生的克制、紧凑和功能优先。增强层只改善模型识别与选择效率，不创建独立视觉语言。

## 2. Color Palette & Roles

- **Reasoning Accent Blue** (`var(--color-chart-blue)`): Slider 打开时的普通推理强度，沿用 Codex 原生 active effort 语义。
- **Maximum Effort Purple** (`var(--color-chart-purple)`): 仅用于 Ultra 推理强度及其相关状态。
- **Primary Text** (`var(--color-text-foreground)`): 模型名称。
- **Tertiary Text** (`var(--color-text-foreground-tertiary)`): Provider 与次要信息。
- **Hover Surface** (`var(--color-token-list-hover-background)`): 选中、悬停与键盘焦点反馈。

颜色必须通过 Codex design token 或运行时解析到的原生语义类获得，不依赖 React 构建生成的随机类名后缀。

## 3. Typography Rules

沿用 Codex 原生字体与字号。Composer 触发器区分两种状态：占位态（"Select model" / "Select effort"）沿用原生 160px Content 宽度；真实模型态让芯片 HUG 完整模型名，长名称不被截断，reasoning effort 始终完整可见。Slider 顶部的模型名最多显示两行。

## 4. Component Stylings

- **Composer Trigger:** 占位态恢复原生 160px Content 宽度；真实模型态 HUG 完整名称，头部保留原生可点击 chevron。
- **Slider Header:** 模型名最多两行，容器高度随内容自然撑开；effort 与 chevron 不收缩。无 Fast 时移除原生 12px 预留占位，让按钮与面板严格居中。
- **Model List:** 保持 264px 原生宽度、Provider 副文本、收藏与最多六项可视高度；收藏与未收藏之间保留分隔线，弹窗内容四周保留约 6px 内边距；模型弹窗与原生 Slider 一致地水平居中于触发器。列表打开期间，Composer 占位文案从 `Select effort` 切为原生语义 `Select model`，关闭后恢复。

## 5. Layout Principles

宽度遵循原生菜单，垂直方向允许内容自然增长。长名称优先换行而不是扩大面板；Composer 的紧凑触发器优先保留 effort 可读性。
