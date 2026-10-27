# Quick Chat 增强

沿用根 DESIGN.md 的视觉与原生控件规则。功能开关为 `quick-chat`，控制台名称为「快捷聊天增强」。

- 仅增强经典 ChatGPT 的 Quick Chat 浮层；全窗口页面中的 Work / 代码输入横条保留原状。
- Codex 和 ChatGPT 模式下，原生命令缺失时，Windows 使用 Ctrl+Alt+N，macOS 使用 ⌘⌥N，读取原生打开状态；完全退出后调用原生 New chat，最小化时恢复已有会话，已显示时再次按键最小化；官方恢复 `quickChat` 命令后让原生处理。⌘⇧N 的 Temporary Chat 不受影响。此补偿随「快捷聊天增强」开关启停，仅在应用窗口内生效。页面上下文已有浮层时（含 Work）优先调用原生恢复按钮，还原最小化前的 compact / expanded 形态并聚焦；已显示时调用原生 onMinimizedChange 最小化，保留当前会话，不另开聊天。
- 打开、聚焦和输入不改变原生初始形态。用户提交进入当前会话后自动展开正文；空提交或被阻止的提交不展开。
- History 只出现在 compact 输入横条的原生 standalone 悬浮控制区，紧邻 Minimize 左侧，边缘间距 8px。正文展开或历史展开时，History 替换为 Close，位于 header 右侧原生拖动手柄的左侧，这组操作按钮最多两个；紧凑态不显示 Close。standalone Minimize 保持圆形，标题栏保留原生标题历史入口。复制 Minimize 热区、材质与反馈；History 使用 16×16px Lucide 官方资源，匹配原生项目选择器的小图标层级（Minimize 的 20px 画布内图形另有留白）。
- 经典 Chat 隐藏无效的项目选择 rail，不删除 React 节点。外层 rail 没有其他内容时也收起，避免原生圆角留白和负 margin 在聚焦时引入 -4px 净偏移；有其他内容时保留外层。控制区继续锚定原生浮层顶部，聚焦不改变与输入横条的位置关系。Work、页面 annotation composer 与 widget 不接入。关闭功能或切换分支时恢复 rail。
- 点击 History 仅调用原生历史动作，以 forceExpanded 临时显示完整历史列表，不改变基础 presentation。未发送、未选择会话时最小化会关闭历史；恢复只显示原来的输入横条。从历史选择已有聊天后保持正文展开；选择 New chat 或仅浏览后最小化不触发正文展开。列表、分页、新聊天与选择行为由原生拥有，不复制数据。
- 未发送时展开历史，原生 composer-only 背景没有填充；通过共享 UI 的 floating-panel 分支补全原背景平面，保留原生圆角和几何。
- 保留原生最小化、拖动、手动展开、焦点、主题、语言与 zoom。关闭功能时移除按钮和监听，不改原生偏好。
- Close 结束本次 Quick Chat，直接丢弃本浮层的未发送文字及附件草稿，不弹确认，不删除已发送历史，不影响主页面草稿。生成中的回答继续后台执行，之后从历史查看；不主动重新打开已关闭浮层。点击主页面继续常驻，Esc 沿用原生返回或收回正文，Minimize 保留会话及草稿。关闭后从侧栏或快捷键进入新聊天。

适配依据：2026-10-08 本机官方 Renderer 的 `quick-chat-window`、`quick-chat-floating-surface` 源码及 profile 隔离窗口。原生菜单 `history.onSelect`、呈现控制器 `onPresentationChange` 属于私有能力；失效时停止增强，诊断不暴露用户内容。

快捷键不依赖 Thread 侧栏可见性：侧栏隐藏或卸载时，从当前窗口内容取得实时 AppScope，并读取原生产品模式；新建继续由原生动作读取来源对话与 host，不猜测 thread ID，不改绑恢复中的旧会话。

快捷键适配依据：2026-10-10，官方 26.1007.21159（build 20052）命令目录缺少 `quickChat`，但原生打开动作仍可用；独立 profile 验证补偿前后与卸载行为。


- 完全退出由原生 Quick Chat 打开 atom 的 false 判断，不由 DOM 是否仍在退出动画中判断；再次按本平台快捷键创建全新会话，待新会话输入框挂载后聚焦。最小化保留打开状态，恢复同一会话。
- 对外统一名称 Enhance Quick Chat（快捷聊天增强），沿用 quick-chat id 和开关；旧 quick-chat-repair 配置移除。侧栏入口、快捷键、自动展开与 History 一起启停。

发送确认适配：26.1007.21159 的原生按会话 presentation atom 经 `[value, store, atom]` 状态订阅读取，value 由 owner / presentation 标识；Adapter 解包后保留记录身份，首轮和续轮确认触发展开，最小化中的确认不抢回窗口。


## Codex 侧栏入口与原生浮层

Codex 模式下，New chat 行右侧在 hover / focus-within 时显示 Quick Chat 入口；触屏持续可见。入口为原生 New chat 按钮的同级控件，不嵌套 button；点击只打开或恢复 Quick Chat，不触发 New chat 的主页面动作。切换 ChatGPT 模式、节点重建和关闭增强时撤销旧入口。

图标复用原生 Restore 默认图标 `chat-bubble-light-20`，从浮层组件的调用关系发现其公开图标工厂，不写死导出名或复制路径。尺寸包装层、SVG class、width/height 复制 New chat 的 Edit 图标，颜色使用相同 `text-default`。本机 26.1013.40934 实测二者为 20×20 viewBox、16×16px 显示，路径以 currentColor 填充；原生轮廓宽度由填充路径定义，不施加 stroke-width。热区为 28px，右边距沿用行的原生 padding token。

2026-10-17，macOS Codex 26.1013.40934 的原生 Quick Chat 展开时，全屏层已为 pointer-events-none；未加载 MCX Pin 或退出补丁时，主侧栏仍可命中，调用原生关闭动作后浮层及遮罩自行移除。因此移除 MCX Pin 控件、固定状态及 Motion 退出登记补丁，展开、停靠、关闭和命中行为交还原生。此结论针对该 Mac 构建的经典 Quick Chat，不声称所有旧版或 Windows 构建均已验收。

2026-10-18 Windows 26.1013.4894.0 适配：命令目录采用懒初始化导出，读取模块源码中的原生命令定义判断 quickChat 是否恢复，不依赖导出数组已初始化。只读核对原生动作与状态导出，回归测试覆盖两种模式的快捷键；未进行本轮真实按键验收。

关闭与隐藏侧栏适配依据：Codex 26.1021.31345（build 21828）安装源码及 MCX 2.0.45 的契约样例。原生丢弃动作包含关闭、草稿清理与会话销毁；仅复用关闭和草稿清理，不执行会话销毁。此轮为源码、序列化和针对性测试证据，真实 Mac / Windows 窗口的关闭动画、后台完成及上下文归属仍待验收。

展开态 Close 放在 header 右侧 Drag 手柄左侧，Minimize 留在原位。紧凑输入条仅在经典浮层作用域内对单行编辑区清除底部间距并对齐控件中线，不改全局 composer、字体或 Work 输入框。该微调来自用户截图与安装源码，最终光学效果由隔离窗口手工验收。
