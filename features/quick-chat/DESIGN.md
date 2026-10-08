# Quick Chat 增强

沿用根 DESIGN.md 的视觉与原生控件规则。功能开关为 `quick-chat`，控制台名称为「快捷聊天增强」。

- 仅增强经典 ChatGPT 的 Quick Chat 浮层；全窗口页面中的 Work / 代码输入横条保留原状。
- 打开、聚焦和输入不改变原生初始形态。用户提交进入当前会话后自动展开正文；空提交或被阻止的提交不展开。
- History 按钮紧邻原生 Minimize 左侧，边缘间距 8px。复制当前 Minimize 的按钮结构、尺寸、材质与反馈，采用 Lucide History 官方资源。
- 点击 History 通过原生历史动作展开窗口并显示完整历史列表，未发送消息时也可用。列表、分页、新聊天与选择行为由原生拥有，不复制数据。
- 未发送时展开历史，原生 composer-only 背景没有填充；通过共享 UI 的 floating-panel 分支补全原背景平面，保留原生圆角和几何。
- 保留原生最小化、拖动、手动展开、焦点、主题、语言与 zoom。关闭功能时移除按钮和监听，不改原生偏好。

适配依据：2026-10-08 本机官方 Renderer 的 `quick-chat-window`、`quick-chat-floating-surface` 源码及 profile 隔离窗口。原生菜单 `history.onSelect`、呈现控制器 `onPresentationChange` 属于私有能力；失效时停止增强，诊断不暴露用户内容。
