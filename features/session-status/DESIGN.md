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

状态行和输入框共用内容宽度，单行高度为 24px，顶部留 2px 内边距；每个状态按钮高 22px，内边距为上下 3px、左右 6px。按钮之间 gap 为 4px，两组可见内容间距为 16px（6 + 4 + 6）；按钮内图标与文字 gap 为 6px。状态行展开且可见时，将包含它的原生 `.bottom-0.pb-4` 容器底部 padding 从 16px 覆盖为 4px；收起、隐藏或卸载后自动恢复原生留白，展开的状态行使用 -4px 顶部外边距，将输入框下方原生 8px gap 的实际距离收为4px，收起时恢复。宽度不足时自然换行，不覆盖输入框或悬浮控件。统计图标采用 Lucide Gauge，用量图标采用 Phosphor Database 单路径版本，两者以 14px 绘制；上下文使用与 Codex 原生相同参数的 12px 百分环。弹层由按钮锚定，键盘可聚焦，Escape 和点击外部关闭。遵守系统减少动态效果设置，不添加持续动画。

状态行以当前输入框所在的会话为准，不依赖侧栏中可能因项目折叠而卸载的 Thread 行。新聊天没有会话 ID 时隐藏旧数据；首条消息建立会话后默认展开详细状态行；若用户曾收起，则沿用其选择。尚未取得的指标用 `—` 占位，不等待日志或 Token 用量；切换会话时立即清空旧数值，详情展开状态保持不变。

## 数据呈现

界面文案跟随 Codex 的 `html[lang]`：中文语言使用简体中文，其他语言使用英文；运行中切换语言时同步更新状态行和已打开的明细浮窗。MineCodex Web 使用同样的中英文规则提供本功能开关。

TPS 根据 Codex 会话事件计算有效样本的会话平均约值，以 `N tok/s` 呈现；分母扣除工具执行区间（含迟到事件，重叠区间仅扣一次），不将其视为实时解码速度；缺少有效计时样本时显示 `—`。累计 token 与缓存比例来自 Codex 用量记录。上下文使用原生 Codex 桌面版的口径：最近请求 `last.totalTokens / modelContextWindow`，直接订阅原生会话的 `latestTokenUsageInfo`（`thread/tokenUsage/updated` 更新），压缩后与原生同步刷新，不依赖日志轮询；原生数据不可用时显示占位；状态栏显示百分环和数字，弹层显示用量、窗口容量和压缩次数。二级浮窗的 token 数按十进制换算为 K/M，省略 `tok` 后缀；TPS 仍保留 `tok/s`。日志可见历史只列有数据的指令、消息、工具交互三个短标签，估算值以 `~` 开头。6px 进度条使用 Codex 图标选择器的紫、蓝、绿配色，标签圆点保持同色；当前页面未暴露对应变量时使用 Codex 亮／暗主题原值。剩余的原生占用以浅灰表示；若估算合计超过原生占用，按比例缩放彩色段，让进度条终点始终对应原生总占用。不显示无法取得的工具定义，也不放解释性长文案。

上下文弹层按视觉归属排列：进度条下紧接三个可见历史分段，不加分段副标题；分隔线之后列原生占用合计、窗口容量和压缩次数。合计取原生最近请求用量，不是三个估算分段的求和。

会话统计浮窗只显示回合、步骤、首字延迟和 TPS。Token 用量浮窗以 Total 为主项，紧接比例条和输出（紫）、其他输入（蓝）、缓存输入（绿）三项，顺序与上下文弹层一致；分隔线后才显示缓存命中率。其他输入为总输入减缓存输入，包含缓存写入。三项使用同一分母。

### 折叠入口
- 首次安装默认展开；用户收起后在模型选择左侧显示 12px context 环，24px 热区；原生 context 环开启时隐藏原生重复入口，卸载时恢复。
- Tooltip 沿用原生 context 内容：上下文窗口、使用/剩余比例、已用/容量（k tokens）；背景、边框、文字、圆角与阴影使用原生 tooltip tokens。
- 点击环展开输入框下方详情，右侧 chevron-up 收起；200ms grid 高度与160ms透明度过渡，尊重 reduced-motion。展开状态跨会话、主聊天和 side chat 共享并持久保存。展开时隐藏输入框内的 context 环；收起动效完成后容器 display:none，不保留父级 gap，收起内容不参与键盘焦点。每个输入框订阅自己的会话上下文和统计。
- Cache 按原始 cachedInputTokens / inputTokens 计算：大于99%显示一位小数，其余取整数，状态栏和详情共用格式。

输入框实例仅绑定可见的 thread composer。全屏标签页中的隐藏聊天、浮动 Quick Chat（含 right-panel composer overlay）、inert 区域不注入；原生移动输入框或切换可见性时销毁实例并取消订阅，返回聊天后重建。
