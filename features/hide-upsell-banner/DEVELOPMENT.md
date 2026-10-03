# Hide Upsell Banner

隐藏 Codex 桌面应用在输入区上方渲染的
“You're out of Codex and Work usage”用量耗尽横幅（upsell banner）。

这是一个 `page-script` 类型的轻量功能：不启动 HTTP 服务、没有 Sidebar 或
Toolbar 入口，由 `CodexRuntimeHost` 在渲染进程内注入一段脚本。

功能范围：

- 仅隐藏横幅的 GUI 显示（`aside` 卡片，`display: none`）；
- 以 `aside` 和中英文 Codex 额度耗尽标题识别；通用标题 `You’re out of usage`（也支持直引号）还须带原生用量横幅关闭按钮，避免误隐藏普通通知；不依赖卡片 class 或购买按钮文案；
- 不拦截、不篡改额度查询接口（`account/rateLimits/read` 与 app-server
  JSON-RPC 流量保持原样）；
- 横幅样式被重新渲染覆盖后，由 `MutationObserver` 重新隐藏；只在样式变化时写入，避免观察器循环。节点改作普通通知或离开文档时释放隐藏状态；
- 注入运行时随 RuntimeHost 卸载自动清理（恢复元素样式、断开 observer）。

## 验证

```bash
npm test
```

## 适配说明

这是非官方 CDP / DOM 适配。横幅识别与隐藏逻辑由本功能的 page-script 维护，Runtime Host 负责注入和卸载。

Codex 26.930.21537（2026-10-02 原生源码核对）：默认横幅和 recovery 分支均使用 `aside` / `h3`，标题来自后端 `banner.title`。通用标题目前仅在同时具有 `Dismiss usage banner`、`不再显示用量横幅`、`關閉用量橫幅` 或 `關閉用量橫額` 关闭语义时隐藏；没有该控件或其他未知标题时保守保留。

行为测试覆盖标题边界、动态内容、重复隐藏、节点复用及卸载后的排队扫描。隔离浏览器 DOM 已验证隐藏和样式覆盖后的恢复；真实账户额度耗尽横幅尚未做端到端验收。
