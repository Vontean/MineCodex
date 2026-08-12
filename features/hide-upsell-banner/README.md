# Hide Upsell Banner

隐藏 Codex 桌面应用在输入区上方渲染的
“You're out of Codex and Work usage”用量耗尽横幅（upsell banner）。

这是一个 `page-script` 类型的轻量功能：不启动 HTTP 服务、没有 Sidebar 或
Toolbar 入口，由 `CodexRuntimeHost` 在渲染进程内注入一段脚本。

功能范围：

- 仅隐藏横幅的 GUI 显示（`aside` 卡片，`display: none`）；
- 不拦截、不篡改额度查询接口（`account/rateLimits/read` 与 app-server
  JSON-RPC 流量保持原样）；
- 横幅重新渲染时由 `MutationObserver` 持续处理，不会闪烁后残留；
- 注入运行时随 RuntimeHost 卸载自动清理（恢复元素样式、断开 observer）。

## 验证

```bash
npm test
```

## 适配说明

这是非官方 CDP / DOM Adapter 的功能声明。Codex 私有 DOM 的适配实现统一留在
`CodexRuntimeHost`；本功能只声明横幅的识别规则（卡片类名 + 文案特征）与
隐藏动作。
