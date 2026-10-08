# Quick Chat 增强

沿用根 DESIGN.md 的视觉与原生控件规则。功能开关为 `quick-chat`，控制台名称为「快捷聊天增强」。

- 仅增强经典 ChatGPT 的 Quick Chat 浮层；全窗口页面中的 Work / 代码输入横条保留原状。
- 打开、聚焦和输入不改变原生初始形态。用户提交进入当前会话后自动展开正文；空提交或被阻止的提交不展开。
- History 只出现在原生 standalone 悬浮控制区，紧邻 Minimize 左侧，边缘间距 8px。展开后的标题栏保留原生标题历史入口，不增加按钮。复制 Minimize 热区、材质与反馈；History 使用 16×16px Lucide 官方资源，匹配原生项目选择器的小图标层级（Minimize 的 20px 画布内图形另有留白）。
- 经典 Chat 隐藏无效的项目选择 rail，不删除 React 节点；控制区继续锚定原生浮层顶部，随输入框高度调整。Work、页面 annotation composer 与 widget 不接入。关闭功能或切换分支时恢复 rail。
- 点击 History 通过原生历史动作展开窗口并显示完整历史列表，未发送消息时也可用。列表、分页、新聊天与选择行为由原生拥有，不复制数据。
- 未发送时展开历史，原生 composer-only 背景没有填充；通过共享 UI 的 floating-panel 分支补全原背景平面，保留原生圆角和几何。
- 保留原生最小化、拖动、手动展开、焦点、主题、语言与 zoom。关闭功能时移除按钮和监听，不改原生偏好。

适配依据：2026-10-08 本机官方 Renderer 的 `quick-chat-window`、`quick-chat-floating-surface` 源码及 profile 隔离窗口。原生菜单 `history.onSelect`、呈现控制器 `onPresentationChange` 属于私有能力；失效时停止增强，诊断不暴露用户内容。
