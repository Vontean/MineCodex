# Session Status / 会话状态

在 Codex 输入框下方显示当前任务的回合、模型响应步骤、观测 TPS、累计 token 和缓存命中。点击状态行可查看统计、用量及上下文详情。

数据由 Runtime Host 只读解析本机 `~/.codex/sessions` 中的 Codex 会话事件，再通过已有 CDP 连接向注入脚本发送数值快照；功能不发送对话内容，也不修改 Codex 会话日志。远程任务或缺少本机日志时隐藏状态行。

## 口径

- 回合：唯一 `task_started` / `turn_context` 的 `turn_id`。
- 步骤：有 `token_usage_record` 的唯一 `response_id`，即已记录的模型响应次数。
- Token：优先采用逐响应记录的 `thread_token_usage`，旧日志缺少该记录时回退到 `token_count.total_token_usage`；缓存命中为 `cached_input_tokens / input_tokens`。未缓存输入为总输入减缓存读与缓存写。
- TPS：仅对可配对模型输出条目起点与逐次用量记录终点的响应，计算 `Σ output_tokens / Σ 观测输出秒数`。首 token 未必等于首个可见条目，故 UI 标 `~`；缺少样本时显示 `—`。
- 上下文：最近一次请求的 `input_tokens` 与当时的 `model_context_window`，占用条显示两者的约数比例。Codex 未提供系统提示词、工具定义和消息的可信拆分，弹层不伪造这些值。

会话 JSONL 和 Codex DOM 均属版本相关接口，升级 Codex 后需用隔离窗口重新验证。关闭本功能会移除注入节点和观察器。
