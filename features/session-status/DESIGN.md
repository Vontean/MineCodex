# Session Status 设计约定

## 意图

状态行紧随 Codex 原生输入框，帮助用户在长任务中快速判断回合、模型步骤、输出速度和 token 用量。视觉上作为输入框的附属信息，不争夺发送按钮与模型选择器的层级。

## Token 与布局

| 角色 | Codex token | 用途 |
| --- | --- | --- |
| 次要文字 | `--color-text-tertiary` | 状态行文字与分隔符 |
| 主要文字 | `--color-text-primary` | 弹层标题和数值 |
| 弹层表面 | `--color-token-dropdown-background` | 点击后的明细 |
| 边框 | `--color-border-subtle` | 弹层与分割线 |
| 悬停 | `--color-token-list-hover-background` | 状态按钮反馈 |
| 焦点描边 | `--input-outline-border-color-focus` | 键盘焦点反馈 |
| 分类进度 | Codex `--app-block-accent-purple`、`--app-block-accent-blue`、`--app-block-accent-green`，以及 `--color-token-border-default` | 各弹层的分类比例与未分类段 |
| 字体 | `--font-sans-default`、`--text-xs` | 与原生辅助信息一致 |
| 圆角与阴影 | `--radius-xl`、`--shadow-lg` | 明细弹层 |

状态行和输入框共用内容宽度，单行高度为 24px，顶部留 2px 内边距；每个状态按钮高 22px，内边距为上下 3px、左右 7px。宽度不足时自然换行，不覆盖输入框或悬浮控件。统计图标采用 Lucide Gauge，用量图标采用 Phosphor Database 单路径版本，两者以 14px 绘制；上下文使用与 Codex 原生相同参数的 12px 百分环。弹层由按钮锚定，键盘可聚焦，Escape 和点击外部关闭。遵守系统减少动态效果设置，不添加持续动画。

## 数据呈现

TPS 根据 Codex 会话事件计算，分母扣除工具执行区间；缺少有效计时样本时显示 `—`。累计 token 与缓存比例来自 Codex 用量记录。上下文使用原生 Codex 桌面版的口径：最近请求 `last.totalTokens / modelContextWindow`，状态栏显示百分环和数字，弹层显示用量、窗口容量和压缩次数。二级浮窗的 token 数按十进制换算为 K/M，省略 `tok` 后缀；TPS 仍保留 `tok/s`。日志可见历史只列有数据的指令、消息、工具交互三个短标签，估算值以 `~` 开头。6px 进度条使用 Codex 图标选择器的紫、蓝、绿配色，标签圆点保持同色；当前页面未暴露对应变量时使用 Codex 亮／暗主题原值。剩余的原生占用以浅灰表示；若估算合计超过原生占用，按比例缩放彩色段，让进度条终点始终对应原生总占用。不显示无法取得的工具定义，也不放解释性长文案。

上下文弹层按视觉归属排列：进度条下紧接三个可见历史分段，不加分段副标题；分隔线之后列原生占用合计、窗口容量和压缩次数。合计取原生最近请求用量，不是三个估算分段的求和。

会话统计浮窗只显示回合、步骤、首字延迟和 TPS。Token 用量浮窗的「Token 构成」比例条按缓存输入（绿）、其他输入（蓝）、输出（紫）拆分会话总用量；其他输入为总输入减缓存输入，包含缓存写入。三项使用同一分母，缓存命中率仍独立显示。
