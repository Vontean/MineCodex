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
| 上下文进度 | `--color-text-info`、`--color-token-border-default` | 明细内的占用条 |
| 字体 | `--font-sans-default`、`--text-xs` | 与原生辅助信息一致 |
| 圆角与阴影 | `--radius-xl`、`--shadow-lg` | 明细弹层 |

状态行和输入框共用内容宽度，单行高度为 24px，顶部留 2px 内边距；每个状态按钮高 22px，内边距为上下 3px、左右 7px。宽度不足时自然换行，不覆盖输入框或悬浮控件。统计图标采用 Lucide Gauge，用量图标采用 Phosphor Database 单路径版本，两者以 14px 绘制；上下文使用与 Codex 原生相同参数的 12px 百分环。弹层由按钮锚定，键盘可聚焦，Escape 和点击外部关闭。遵守系统减少动态效果设置，不添加持续动画。

## 数据呈现

TPS 根据 Codex 会话事件计算，分母扣除工具执行区间；缺少有效计时样本时显示 `—`。累计 token 与缓存比例来自 Codex 用量记录。上下文使用原生 Codex 桌面版的口径：最近请求 `last.totalTokens / modelContextWindow`，状态栏显示百分环和数字，弹层显示用量、窗口容量和压缩次数。弹层不显示未能可靠取得的类别拆分，也不放解释性文案。
