# Session Status / 会话状态

在 Codex 输入框下方显示当前任务的回合、模型响应步骤、观测 TPS、累计 token 和缓存命中。点击状态行可查看统计、用量及上下文详情。

数据由 Runtime Host 只读解析本机 `~/.codex/sessions` 中的 Codex 会话事件，再通过已有 CDP 连接向注入脚本发送数值快照；功能不发送对话内容，也不修改 Codex 会话日志。远程任务或缺少本机日志时隐藏状态行。

## 口径

- 回合：唯一 `task_started` / `turn_context` 的 `turn_id`。
- 步骤：有 `token_usage_record` 的唯一 `response_id`，即已记录的模型响应次数。
- Token：优先采用逐响应记录的 `thread_token_usage`，旧日志缺少该记录时回退到 `token_count.total_token_usage`；缓存命中为 `cached_input_tokens / input_tokens`。未缓存输入为总输入减缓存读与缓存写。
- TPS：仅对可配对模型输出条目起点与逐次用量记录终点的响应，计算 `Σ output_tokens / Σ（观测时长 − 其中工具执行时长）`；重叠工具区间只扣一次。缺少有效计时样本时显示 `—`。
- 上下文：与当前 Codex 桌面版原生百分环相同，采用最近请求的 `last.total_tokens / model_context_window`，裁切至 0–100%。即使关闭原生百分环，本功能仍从会话事件独立读取。Codex 会话用量没有系统提示词、工具定义和消息的独立 token 计数，当前不展示推测分类。

状态图标使用 Lucide Static v1.31.0 的 Gauge、Database，许可见 [`vendor/lucide-LICENSE`](vendor/lucide-LICENSE)。

## 上下文分类的可行性

当前桌面版原生百分环只需要 `last.totalTokens` 和 `modelContextWindow`。Codex 的会话用量事件还提供输入、缓存、输出和推理输出，但没有系统提示词、工具定义、对话消息各自的 token 数。会话日志中虽有部分基础指令和消息内容，缺少完整的工具定义与模型实际请求组装结果；压缩后的历史也不能仅靠逐条消息还原。因此本功能可以与原生保持相同的总占用口径，暂时不能可靠复刻 DeepSeek Harness 弹层中的分类数字。

若将来 Codex 的事件或 App Server 增加分类用量，直接接入该结构即可；从日志内容自行分词或拦截模型请求只能提供另一套估算口径，需要单独设计与验证。

会话 JSONL 和 Codex DOM 均属版本相关接口，升级 Codex 后需用隔离窗口重新验证。关闭本功能会移除注入节点和观察器。
