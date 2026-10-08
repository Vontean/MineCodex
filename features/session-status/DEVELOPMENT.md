# Session Status / 会话状态

在 Codex 输入框下方显示当前任务的回合、模型响应步骤、观测 TPS、累计 token 和缓存命中。点击状态行可查看统计、用量及上下文详情。

Context 直接订阅 Codex 原生会话状态。其他统计由 Runtime Host 只读解析本机 `~/.codex/sessions` 中的 Codex 会话事件；TPS 可另从 `~/.opencodex/usage.jsonl`（或 `OPENCODEX_HOME` 指定目录）读取数值记录，再通过已有 CDP 连接向注入脚本发送数值快照；页面只向 Host 请求刷新，不发送对话内容，也不修改 Codex 会话日志。远程任务或缺少本机日志时，无法取得的指标显示 `—`。

同一会话可能有多个 rollout 文件，包括续聊产生的 `<thread-id>_<session-id>.jsonl` 分段。读取器每 2 秒检查分段列表；新增分段时按事件时间重建会话统计，随后按各文件独立的读取位置增量更新。回合及模型响应按 ID 去重，累计 Token 采用日志给出的会话总量，不将不同分段的累计值相加。

新聊天没有会话 ID 时隐藏；发送首条消息、原生输入框出现会话 ID 后立即显示占位并请求数据，无需等待日志落盘、回答完成或 Token 用量返回。切换聊天时立即清除旧数值，拒绝 ID 不匹配的迟到快照；折叠侧栏不影响当前会话识别。输入框会话标记的属性变化也会触发更新。

生成中依据日志的 `task_started` 与完成／中断事件，每 500ms 请求统计；空闲时由 Runtime 每 2 秒刷新兜底，页面不重复轮询。首次找不到日志按 500ms、1s、2s、随后 10s 重试；持续缺失时不会高频扫描目录。并发请求按页面合并，统计刷新不占用图片等用户操作的串行队列。页面卸载或功能关闭会取消定时器、观察器与原生状态订阅。

统计读取当前会话 ID、推送快照的 CDP 请求分别有 3 秒超时；超时会清理待处理请求、忽略迟到响应，并关闭失效连接，由 Runtime 重新连接。共享 CDP 请求默认上限为 30 秒、连接握手为 10 秒，页面发现 HTTP 请求为 3 秒；超时本身不会自动重放发送消息、附件等操作。

## 口径

- 回合：唯一 `task_started` / `turn_context` 的 `turn_id`。
- 步骤：有 `token_usage_record` 的唯一 `response_id`，即已记录的模型响应次数。外部模型未提供 `response_id` 时，使用记录的 `session_id` 与 `ordinal` 组合识别响应，避免增量读取及分段重建重复计数；两种身份都缺失时不猜测步骤或 TPS。
- Token：优先采用逐响应记录的 `thread_token_usage`，旧日志缺少该记录时回退到 `token_count.total_token_usage`；缓存命中为 `cached_input_tokens / input_tokens`。未缓存输入为总输入减缓存读与缓存写。
- TPS：界面保持 `N tok/s` 与详情中的 `TPS`，统一表示估算生成速度，包含推理输出，不展示另一种端到端 TPS。最近 5 个有有效计时且可确定归属的回合按 `Σ output_tokens / Σ 有效生成时长` 加权，同轮所有有效响应合并；不足 5 轮使用已有数据，无效回合不占名额。每个响应的有效窗口至少 1000ms，缺少有效样本显示 `—`；不限制完整长思考响应的最大时长。
- TPS 数据源：OCX Adapter 只读增量索引 `usage.jsonl`，不读取配置、凭据或对话正文。按 OCX 的 `sha256(threadId)[:32]` 会话标识、输入/缓存/输出用量相等及完成时间相差不超过 2 秒唯一关联；同一 OCX 请求不得归属多个响应，无法唯一匹配时保留 Codex 日志估算。安装 OCX 本身不决定来源；父会话或其他身份归档导致不能匹配的记录不猜测归属。
- OCX TPS：沿用 OCX 口径，优先 `outputTokens / (lastOutputMs - genStartMs)`，旧记录缺少完整生成窗口时采用 `outputTokens / (durationMs - firstOutputMs)`。单位换算为秒；窗口非正数、不足 1 秒或用量不支持时，该响应不可用，不回退到 Codex 重算。`outputTokens` 已包含推理，不再加 `reasoningOutputTokens`，也不再次扣工具时间。
- Codex 日志 TPS：没有可关联 OCX 记录的响应使用原有观测时长，扣其中完整且不与模型输出重叠的工具等待；重叠等待只扣一次，迟到的完成事件回补已有样本。中断或结束回合清空未配对计时，并同样拒绝不足 1 秒的有效窗口。OCX 日志迟到时，下次刷新重新关联并替换该响应口径，不重复计数；日志轮转/截断时重建 OCX 数值索引。
- Token 构成：Total 下的比例条按输出（紫）、其他输入（蓝）、缓存输入（绿）显示三项在会话总用量中的占比；缓存命中率独立放在末尾，仍以总输入为分母。其他输入为总输入减缓存输入，包含缓存写入。
- 上下文：与当前 Codex 桌面版原生百分环相同，采用原生状态的 `last.totalTokens / modelContextWindow`，裁切至 0–100%。即使关闭原生百分环，本功能仍订阅其用量数据。二级浮窗在进度条下显示日志可见历史的指令、消息、工具交互本地估算，随后显示原生占用合计、窗口容量和压缩次数；`~` 表示估算，合计并非估算分段之和。进度条采用 Codex 原生配色，以紫、蓝、绿分别表示三类，未分类的占用为浅灰；彩色段按需缩放，整条终点对应原生总占用。工具定义因未写入日志而不显示。
- 压缩次数：读取会话日志中的 `compacted` 记录及其 `window_number`，兼容旧版 `context_compacted` 和 `ContextCompaction` 完成事件；同一次压缩的多种记录只计一次。若 `compacted` 含 `replacement_history`，分段估算以它替换压缩前历史，再累计后续记录。

统计图标使用 Lucide Static v1.31.0 的 Gauge；用量图标使用 Phosphor Icons 的 Database，单路径填充避免半透明色在路径交叠处加深。许可见 [`vendor/lucide-LICENSE`](vendor/lucide-LICENSE) 和 [`vendor/phosphor-LICENSE`](vendor/phosphor-LICENSE)。

会话统计浮窗的 TPS 标签带有同色 Lucide info 图标（Lucide 0.577.0 官方资源）；悬浮或键盘聚焦可查看说明：仅在这个 info tooltip 区分 OCX、会话日志或混合来源，说明包含推理输出、取最近 5 个有效回合且仅供参考；无有效值时说明计时不足。状态行与其他位置不新增来源或口径标签。

2026-10-08 本机 `opencode-go/deepseek-v4.1-flash` 日志实测：用量记录的 `response_id` 为空，但有 `session_id` 与 `ordinal`；输出条目的 `started_at_ms` 接近完成时间。该类计时可能只覆盖集中交付的输出；实测 51ms、65ms 的 OCX 窗口及不足 1 秒的日志观测窗口均不参与 TPS，不能据此推断模型解码性能。

## 上下文分类的可行性

当前桌面版原生百分环只需要 `last.totalTokens` 和 `modelContextWindow`。Codex 的会话用量事件还提供输入、缓存、输出和推理输出，但没有系统提示词、工具定义、对话消息各自的 token 数。日志中的 `session_meta.base_instructions`、`response_item` 角色与类型、`compacted.replacement_history` 可以形成有边界的活跃历史分段：基础与开发者指令、消息（包含压缩摘要）、工具调用与结果。参考 Codex 自身的粗估口径，将 UTF-8 可见文本按约 4 字节/token 计，图片按固定大小估算；全程本地运算，不调用模型。加密摘要参考 Codex 对编码长度的换算。

这些分段与准确的最近请求用量是两套口径：日志缺少完整工具定义和实际请求封装，且最新追加的条目可能尚未进入下一次请求，因此分段值不强求与总占用相加相等。旧日志没有 `replacement_history` 时只估算压缩后的可见后缀，不把压缩前历史继续累加。弹层保持简短，通过分组标题和 `~` 标记区分估算。二级浮窗所有 token 数按十进制（1K = 1,000，1M = 1,000,000）显示数量级，不附加 `tok`；速度继续使用 `tok/s`。

若将来 Codex 的事件或 App Server 增加分类用量，可用原生数据替换本地估算。

相关实现调研：[`picoSols/codex-usage-statusline`](https://github.com/picoSols/codex-usage-statusline) 也用 Codex `token_count` 计算总占用；[`auditt98/context-viewer`](https://github.com/auditt98/context-viewer) 用 `tiktoken` 给可见日志文本估算分类，但其 Codex 解析不能还原每次实际请求中的完整提示词和工具定义。[`HarnessDesk` 的 DSH 接入](https://github.com/HarnessDesk/HarnessDesk/blob/main/docs/context-usage.md) 从 DSH 自己的 token meter 接收分类投影，其 Codex 接入没有这项投影。[Codex App Server 用量协议](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/json/v2/ThreadTokenUsageUpdatedNotification.json) 只提供输入、缓存、输出、推理等用量种类和上下文窗口，没有按提示词、工具和消息拆分的字段。

会话 JSONL 和 Codex DOM 均属版本相关接口，升级 Codex 后需用隔离窗口重新验证。关闭本功能会移除注入节点和观察器。

Context 直接订阅原生会话的 `latestTokenUsageInfo`，与原生指示器共用 `thread/tokenUsage/updated` 数据源；压缩完成后随原生状态刷新，不等待日志轮询。切换会话时取消旧订阅，原生接口或用量不可用时显示 `—`，日志快照不覆盖原生占用。日志仍提供累计统计、压缩次数和历史分段估算；日志读取器也接受压缩后的最新重新计数。

2026-10-08，Codex 26.1002.52244 安装包与当前会话实测：`app-shared` 改为先创建 `tokenUsageInfo` selector，再派生按 thread ID 读取、内部携带 host ID 的 atom family。Adapter 从该声明定位导出，不固定 bundle 哈希或压缩后的导出名；旧版直接解构 `latestTokenUsageInfo` 的声明仍可识别。AppScope 与 store 的读取、订阅接口保持相同，发现失败时保留不可用诊断，不以日志用量覆盖原生状态。

首次安装默认展开输入框下方的会话统计，之后记住用户的展开或收起选择。详情最右侧箭头可收起，收起后点击模型选择左侧的 context 环重新展开；展开时隐藏输入框内的环，展开状态跨会话及 side chat 共享并记住；收起后不保留布局占位。悬浮显示原生同口径的上下文用量。Cache 超过99%时显示一位小数。
