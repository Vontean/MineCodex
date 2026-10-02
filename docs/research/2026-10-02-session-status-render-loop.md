# Session Status 打开会话时卡死调查

环境：2026-10-02，Codex 26.930.21537、MineCodex 2.0.3。日常安装的 Session Status 已由用户关闭，本次保留该设置；未重启日常应用。

## 根因

`createContextUsageAdapter.connect()` 仅在已有订阅时跳过重复连接。bundle 异步发现尚未完成、AppScope 暂时缺失或 atom 契约不可用时，每次 `ensurePosition()` 都会调用 `onChange(empty())`。该回调进入 `render()`，重新设置状态文字的 `textContent`，产生 childList mutation。实例的 MutationObserver 再通过 queueMicrotask 执行 `ensurePosition()`，形成连续微任务循环，阻止浏览器绘制和处理输入。

打开已有会话后有 thread ID，状态文字开始绘制，故能触发此链路；没有 thread ID 的首页不能据此证明安全。此触发条件不限于旧会话，也不依赖日志文件大小。日常 Runtime 日志存在 Session Status `Runtime.evaluate` 超时，但超时本身不证明具体哪次用户操作触发了此循环。

## 修复

Adapter 只在上下文快照字段实际变化时通知呈现层，重复的空数据不触发重绘。原生能力异步就绪后仍重新连接并发布数据，不以延时或禁用功能掩盖失效。输入框替换时重新订阅，并拒绝旧输入框的迟到回调。

## 验证与边界

- 隔离 Codex profile：`/tmp/mcx-old-thread-20261002`，CDP 9233；日常 profile/CDP 9231 未修改。
- 在实际 Renderer 中使用原生 MutationObserver 的有界最小复现：原 Adapter 连续通知 100 次达到保护上限；修复后只通知 1 次，计时器正常执行。
- 在同一 Renderer 执行完整 Session Status 序列化脚本与共享 Codex Environment，使用具有 thread ID 的测试 composer、不可用的 AppScope，以及无副作用的 UI 材质桩。原实现触发 500 次观察回调达到保护上限；修复后 8 次即稳定，计时器正常执行。
- 当前原生 shared bundle 中能发现上下文 atom 导出；这不消除异步加载期间或输入框切换时的未就绪窗口。
- 新增回归覆盖 pending/rejected discovery、atom 契约失败、异步恢复、相同 atom 数据、输入框替换与旧回调；全量 334 项测试及 144 个 JavaScript 文件语法检查通过。

以上确认了实际 Chromium 中的注入循环及修复效果，测试 composer 不等同于真实旧 Thread 的手动验收。Computer Use 拒绝访问 `com.openai.codex`，所以未通过 UI 打开用户的真实旧 Thread；未发布 npm、更新日常安装或重新开启 Session Status。
