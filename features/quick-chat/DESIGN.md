# Quick Chat 增强

沿用根 DESIGN.md 的视觉与原生控件规则。功能开关为 `quick-chat`，控制台名称为「快捷聊天增强」。

- 仅增强经典 ChatGPT 的 Quick Chat 浮层；全窗口页面中的 Work / 代码输入横条保留原状。
- Codex 和 ChatGPT 模式下，原生命令缺失时，Windows 使用 Ctrl+Alt+N，macOS 使用 ⌘⌥N，读取原生打开状态；完全退出后调用原生 New chat，最小化时恢复已有会话，已显示时再次按键最小化；官方恢复 `quickChat` 命令后让原生处理。⌘⇧N 的 Temporary Chat 不受影响。此补偿随「快捷聊天增强」开关启停，仅在应用窗口内生效。页面上下文已有浮层时（含 Work）优先调用原生恢复按钮，还原最小化前的 compact / expanded 形态并聚焦；已显示时调用原生 onMinimizedChange 最小化，保留当前会话，不另开聊天。
- 打开、聚焦和输入不改变原生初始形态。用户提交进入当前会话后自动展开正文；空提交或被阻止的提交不展开。
- History 只出现在 compact 输入横条的原生 standalone 悬浮控制区，紧邻 Minimize 左侧，边缘间距 8px。历史面板打开后只保留 Minimize；standalone Minimize 在两种状态下均保持圆形。展开后的标题栏保留原生标题历史入口，不增加按钮。复制 Minimize 热区、材质与反馈；History 使用 16×16px Lucide 官方资源，匹配原生项目选择器的小图标层级（Minimize 的 20px 画布内图形另有留白）。
- 经典 Chat 隐藏无效的项目选择 rail，不删除 React 节点。外层 rail 没有其他内容时也收起，避免原生圆角留白和负 margin 在聚焦时引入 -4px 净偏移；有其他内容时保留外层。控制区继续锚定原生浮层顶部，聚焦不改变与输入横条的位置关系。Work、页面 annotation composer 与 widget 不接入。关闭功能或切换分支时恢复 rail。
- 点击 History 仅调用原生历史动作，以 forceExpanded 临时显示完整历史列表，不改变基础 presentation。未发送、未选择会话时最小化会关闭历史；恢复只显示原来的输入横条。从历史选择已有聊天后保持正文展开；选择 New chat 或仅浏览后最小化不触发正文展开。列表、分页、新聊天与选择行为由原生拥有，不复制数据。
- 未发送时展开历史，原生 composer-only 背景没有填充；通过共享 UI 的 floating-panel 分支补全原背景平面，保留原生圆角和几何。
- 有实际聊天内容的经典 Quick Chat 在 Codex 模式展开时，header 的原生 dragger 左侧显示 Pin。仅预览历史、空聊天、Work / 页面上下文和 widget 不提供 Pin。按钮复制相邻 dragger 的 class 和 SVG 尺寸，颜色与反馈继承同一原生 token；图标取官方安装包 Lucide Pin 路径（24px viewBox、2px stroke），固定时只填充图钉主体，针尖仍用 stroke。
- Pin 是当前窗口、当前会话的临时状态。固定时透明全屏层放行主页面点击，原生可交互子元素保持命中；原生外部点击请求 compact 后，经原生 presentation 动作维持展开，不抢主页面焦点。进入历史预览或 Minimize 立即解除固定；恢复后为 unpinned。浮层内 Esc 解除固定并继续交给原生键盘处理；关闭、切换会话、切换主模式或卸载清除状态与标记。
- 保留原生最小化、拖动、手动展开、焦点、主题、语言与 zoom。关闭功能时移除按钮和监听，不改原生偏好。

适配依据：2026-10-08 本机官方 Renderer 的 `quick-chat-window`、`quick-chat-floating-surface` 源码及 profile 隔离窗口。原生菜单 `history.onSelect`、呈现控制器 `onPresentationChange` 属于私有能力；失效时停止增强，诊断不暴露用户内容。

快捷键适配依据：2026-10-10，官方 26.1007.21159（build 20052）命令目录缺少 `quickChat`，但原生打开动作仍可用；独立 profile 验证补偿前后与卸载行为。

Pin 适配依据：2026-10-10，Codex 26.1007.21159 / build 20052；原生 `header button[data-quick-chat-drag-handle]`、`QuickChatWindow` boundary、经典会话 hasConversation、统一停靠 presentation 与最小化回调，以及独立 profile 的真实鼠标命中测试。透明层穿透只在固定时生效；退出修复与增强共用同一个开关。

- 完全退出由原生 Quick Chat 打开 atom 的 false 判断，不由 DOM 是否仍在退出动画中判断；再次按本平台快捷键创建全新会话，待新会话输入框挂载后聚焦。最小化保留打开状态，恢复同一会话。
- 对外统一名称 Enhance Quick Chat（快捷聊天增强），沿用 quick-chat id 和开关；旧 quick-chat-repair 配置移除。退出登记修复、快捷键、自动展开、History 与 Pin 一起启停。

发送确认适配：26.1007.21159 的原生按会话 presentation atom 经 `[value, store, atom]` 状态订阅读取，value 由 owner / presentation 标识；Adapter 解包后保留记录身份，首轮和续轮确认触发展开，最小化中的确认不抢回窗口。

2026-10-18 Windows 26.1013.4894.0 适配：命令目录采用懒初始化导出，读取模块源码中的原生命令定义判断 quickChat 是否恢复，不依赖导出数组已初始化。只读核对原生动作与状态导出，回归测试覆盖两种模式的快捷键；未进行本轮真实按键验收。
