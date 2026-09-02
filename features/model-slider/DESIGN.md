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

沿用 Codex 原生字体与字号。Composer 中的模型名保持单行省略，始终为 reasoning effort 留出空间；Slider 顶部的模型名最多显示两行。

## 4. Component Stylings

- **Composer Trigger:** 单行、有界、省略，模型名与 effort 不重叠。
- **Slider Header:** 模型名最多两行，容器高度随内容自然撑开；effort 与 chevron 不收缩。
- **Model List:** 保持 264px 原生宽度、Provider 副文本、收藏与最多六项可视高度。

## 5. Layout Principles

宽度遵循原生菜单，垂直方向允许内容自然增长。长名称优先换行而不是扩大面板；Composer 的紧凑触发器优先保留 effort 可读性。
