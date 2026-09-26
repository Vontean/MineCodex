# Session Status / 会话状态

在 Codex 输入框下方显示当前任务的回合、模型响应步骤、观测 TPS、累计 token 和缓存命中。点击状态行可查看统计、用量及上下文详情。

数据由 Runtime Host 只读解析本机 `~/.codex/sessions` 中的 Codex 会话事件，再通过已有 CDP 连接向注入脚本发送数值快照；功能不发送对话内容，也不修改 Codex 会话日志。远程任务或缺少本机日志时隐藏状态行。

## 口径

- 回合：唯一 `task_started` / `turn_context` 的 `turn_id`。
- 步骤：有 `token_usage_record` 的唯一 `response_id`，即已记录的模型响应次数。
- Token：优先采用逐响应记录的 `thread_token_usage`，旧日志缺少该记录时回退到 `token_count.total_token_usage`；缓存命中为 `cached_input_tokens / input_tokens`。未缓存输入为总输入减缓存读与缓存写。
- TPS：仅对可配对模型输出条目起点与逐次用量记录终点的响应，计算 `Σ output_tokens / Σ（观测时长 − 其中工具执行时长）`；重叠工具区间只扣一次。缺少有效计时样本时显示 `—`。
- Token 构成：缓存输入、其他输入、输出三项在会话总用量中的占比。其他输入为总输入减缓存输入，包含缓存写入；缓存命中率仍以总输入为分母。
- 上下文：与当前 Codex 桌面版原生百分环相同，采用最近请求的 `last.total_tokens / model_context_window`，裁切至 0–100%。即使关闭原生百分环，本功能仍从会话事件独立读取。二级浮窗另显示日志可见历史的指令、消息、工具交互的本地估算；`~` 表示估算。进度条采用 Codex 原生配色，以紫、蓝、绿分别表示三类，未分类的占用为浅灰；彩色段按需缩放，整条终点对应原生总占用。工具定义因未写入日志而不显示。
- 压缩次数：读取会话日志中的 `compacted` 记录及其 `window_number`，兼容旧版 `context_compacted` 和 `ContextCompaction` 完成事件；同一次压缩的多种记录只计一次。若 `compacted` 含 `replacement_history`，分段估算以它替换压缩前历史，再累计后续记录。

统计图标使用 Lucide Static v1.31.0 的 Gauge；用量图标使用 Phosphor Icons 的 Database，单路径填充避免半透明色在路径交叠处加深。许可见 [`vendor/lucide-LICENSE`](vendor/lucide-LICENSE) 和 [`vendor/phosphor-LICENSE`](vendor/phosphor-LICENSE)。

## 上下文分类的可行性

当前桌面版原生百分环只需要 `last.totalTokens` 和 `modelContextWindow`。Codex 的会话用量事件还提供输入、缓存、输出和推理输出，但没有系统提示词、工具定义、对话消息各自的 token 数。日志中的 `session_meta.base_instructions`、`response_item` 角色与类型、`compacted.replacement_history` 可以形成有边界的活跃历史分段：基础与开发者指令、消息（包含压缩摘要）、工具调用与结果。参考 Codex 自身的粗估口径，将 UTF-8 可见文本按约 4 字节/token 计，图片按固定大小估算；全程本地运算，不调用模型。加密摘要参考 Codex 对编码长度的换算。

这些分段与准确的最近请求用量是两套口径：日志缺少完整工具定义和实际请求封装，且最新追加的条目可能尚未进入下一次请求，因此分段值不强求与总占用相加相等。旧日志没有 `replacement_history` 时只估算压缩后的可见后缀，不把压缩前历史继续累加。弹层保持简短，通过分组标题和 `~` 标记区分估算。二级浮窗所有 token 数按十进制（1K = 1,000，1M = 1,000,000）显示数量级，不附加 `tok`；速度继续使用 `tok/s`。

若将来 Codex 的事件或 App Server 增加分类用量，可用原生数据替换本地估算。

相关实现调研：[`picoSols/codex-usage-statusline`](https://github.com/picoSols/codex-usage-statusline) 也用 Codex `token_count` 计算总占用；[`auditt98/context-viewer`](https://github.com/auditt98/context-viewer) 用 `tiktoken` 给可见日志文本估算分类，但其 Codex 解析不能还原每次实际请求中的完整提示词和工具定义。[`HarnessDesk` 的 DSH 接入](https://github.com/HarnessDesk/HarnessDesk/blob/main/docs/context-usage.md) 从 DSH 自己的 token meter 接收分类投影，其 Codex 接入没有这项投影。[Codex App Server 用量协议](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/json/v2/ThreadTokenUsageUpdatedNotification.json) 只提供输入、缓存、输出、推理等用量种类和上下文窗口，没有按提示词、工具和消息拆分的字段。

会话 JSONL 和 Codex DOM 均属版本相关接口，升级 Codex 后需用隔离窗口重新验证。关闭本功能会移除注入节点和观察器。
