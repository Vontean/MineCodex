# Quick Chat

独立 page-script 功能，无服务、数据库或 host action。CLI 提供独立开关，Runtime Host 仅发现和组装源码。

模式选择器的 ChatGPT 入口使用 mode=work、workModeAccess=chatgpt；不能把界面名称当成 mode 值，也不能对所有 work 分支都启用独立聊天补偿。Codex 使用 mode=codex。其他 Work 分支只保留已有浮层的恢复与聚焦。

原生模块通过共享 [Codex Adapter](../../packages/codex-adapter/DEVELOPMENT.md) 定位。
宿主早于应用入口标签挂载时以 MutationObserver 等待入口，再沿真实引用定位 initial
与浮层图标；不等待 app-initial 本身出现在预加载列表。期间保留 pending 诊断，成功、
卸载或 AbortSignal 释放观察器，dispose 也取消未完成的发现。

快捷键冷启动时，原生打开状态 atom 可能仍为未初始化的导出。Adapter 按状态赋值与 once 包装定位所属的原生初始化器，仅在状态缺失时调用，再读取模块的实时导出；不依赖其他功能或切换页面顺带初始化。初始化器缺失或协议不匹配时停止补偿，自检保留已知协议错误码，不输出原始异常内容。测试必须覆盖冷、热两种加载顺序，不能只构造已经初始化的状态对象。

Windows Codex `26.1021.3705.0` 将命令目录从 `app-initial` 移入其引用的 `app-shared`。入口不含有效目录时，按实际资源引用读取共享模块中的命令定义；打开、新建和状态角色仍从入口导出发现。共享目录无效时停止补偿；目录恢复官方 Quick Chat 命令时让回原生快捷键。测试覆盖目录移动、官方命令恢复与无效目录，不绑定构建哈希。

- `src/adapters/codex/renderer.mjs` 识别经典聊天浮层，提供当前会话、原生提交许可、发送确认呈现记录身份、standalone Minimize 模板、项目 rail、展开和历史动作。入口不遍历 React。
- `src/adapters/codex/shortcut.mjs` 通过源码中的原生命令定义（不依赖懒初始化数组）、Quick Chat 能力检查与导出角色发现打开动作；优先从模式选择器定位当前 AppScope；侧栏隐藏时从当前窗口内容的 committed Fiber 读取实时 AppScope，并通过原生产品模式 selector 限定 Codex，不硬编码压缩名称或构建哈希。平台快捷键（Windows Ctrl+Alt+N，macOS ⌘⌥N）未被处理时，先以浮层的 isMinimized 布尔状态及 presentation / minimize 回调，加上按钮回调形状识别原生 Restore（standalone 可省略 unifiedDocking）（不匹配本地化标签），调用按钮以保留原生 presentation 恢复和焦点。此分支覆盖页面上下文的 Work；已显示时清除待聚焦任务，调用浮层的原生 onMinimizedChange(true) 最小化，不关闭会话。Codex 和 ChatGPT 模式先读取原生打开 atom；false 调用原生 New chat，待新会话 DOM 挂载后聚焦，不复用退出动画中的旧输入框。true 时恢复最小化浮层，已显示时最小化；重复按键、输入法组合和其他组合保留原状。官方恢复命令或协议不匹配时停止补偿，卸载及 AbortSignal 清理监听。
- `src/adapters/codex/history.mjs` 统一识别原生历史列表，只向控制区输出可见事实；注入工厂显式序列化此依赖。
- `src/domain/submission.mjs` 只解释本次提交与同会话新增发送确认的关系，不读取 DOM 或原始 Codex 对象。
- `src/domain/history.mjs` 记录历史所在会话；选中已有会话后展开，New chat、最小化和卸载清除记录。
- `src/frontend/entry.mjs` 管理逐浮层实例与按钮；提交事件只记录基线，不接管发送。原生会话已开始且发送确认写入新呈现记录后才展开；紧凑状态没有正文 DOM，不通过消息节点判定。
- 原生 `submit` emitter 仅由 Adapter 持有并用于键盘提交；快照只输出窗口内 subscriptionId，原生来源更换时前端据此重建订阅。DOM submit / submit-button click 覆盖鼠标。扩展 listener 返回 false，不改变原生 handled 结果。切换会话、隐藏和卸载时撤销监听并清空等待状态。
- 私有 Adapter 以语义 props 和原生 `history` 菜单项发现能力，不匹配构建哈希、函数名或 hook 索引。历史 onSelect 已通过 forceExpanded 展开，不额外调用 onPresentationChange，避免污染 restorePresentation。呈现记录在当前 session 的订阅状态中解包 `[value, store, atom]`，以 owner / presentation 形状识别；若记录含 conversationId，须与当前会话一致，只向领域提供窗口内序号。Work、annotationSubmitTarget 页面 composer、widget、其他 floating surface 不因视觉相近接入。紧凑态只使用 standalone=true 的 Minimize 作为 History 模板；展开态复制标题栏 Minimize 的样式作为 Close 模板，但插入到原生 Drag 按钮左侧。Minimize 用其专有 props 形状识别，排除菜单和注入按钮。历史列表由原生 conversations / onConversationSelect / onNewChat 与可见祖先识别；不读取或复制历史条目内容。展开面板没有新增 History；standalone Minimize 使用圆形 utility 的圆角，卸载移除标记。项目 rail 通过 composer variant + onProjectChange 识别，不依赖标签语言。隐藏项目项时通过限定 CSS 收起无其他内容的 rail 容器，避免 attached rail 的 padding-bottom / negative margin 残留；附件或其他 rail 内容保留。

验证使用独立 profile / CDP。覆盖首轮与续轮发送、空提交、输入不展开、未发送时历史、选择旧聊天、最小化与恢复、开关清理及 Work 隔离；单元测试不能替代真实 Renderer 验收。

## 侧栏入口

Windows Codex `26.1016.8120.0` 将浮层资源从 `quick-chat-floating-surface` 更名为 `floating-chat-surface`。图标发现接受这两个名称，仍通过原生 Restore 默认图标的调用关系解析导入，不绑定构建哈希。

`src/adapters/codex/sidebar.mjs` 从可见侧栏行的 `animatedIcon:sidebar-new-chat`、excludeFromNavigation 和 sidebarMode 识别 Codex New chat，不匹配标题文字；图标从原生浮层 Restore 的默认 minimizedIcon 调用关系发现，再使用该图标的 createElement 工厂。资源变化时不以第三方图标猜测替代。

`src/frontend/sidebar.mjs` 管同级按钮、hover / focus-within、模式切换与卸载；复用 `installQuickChatShortcut` 提供的 activate 动作，避免构造键盘事件或重复一份新建／恢复／聚焦逻辑。新原生会话挂载后的聚焦仍由原适配器维护。

旧 Pin 与 Motion 退出登记补丁已移除；原生事实、图标规格和当前验证边界见本级 DESIGN。更新后检查原生完整关闭与主页面命中、悬浮入口实际点击、最小化恢复、重复点击不新建、模式切换和卸载，不能仅以入口存在作为打开行为验收。

侧栏入口调用 activate() 保持恢复／聚焦；键盘调用 activate({minimize:true}) 让已显示浮层最小化。两者共享新建会话和启动就绪逻辑，侧栏重复点击不最小化。

## 关闭动作与侧栏无关的上下文

`src/adapters/codex/lifecycle.mjs` 从原生丢弃 Quick Chat 的调用关系发现当前 session、关闭动作、持久化草稿、文字和附件清理角色，另按原生 conversationDetailMode / STEPS_PROSE 分支识别产品模式 selector；不绑定压缩导出名或构建哈希。注入工厂显式序列化这两个发现函数。协议不可用时停止对应增强并记录诊断。

Close 调用前，从当前浮层取得 AppScope，并核对原生当前 session ID 等于按钮所属 session ID。只对该 ID 清除原生草稿、文字与附件，然后调用原生关闭；不调用完整 discard、不清空 session、不执行原生会话销毁或取消回答。恢复与新建仍使用原生动作，因此源对话及 host 引用由原生读取。

侧栏隐藏后的打开从仍挂载的导航 rail、composer、main 或应用根内容的 committed Fiber 向上定位现有 AppScope 句柄，不缓存上次会话或窗口 scope。原生产品模式 selector 必须指向 Codex 才启用该补充路径；其他模式保留现有行为。侧栏展开、隐藏和新窗口首次进入均使用同一新建／恢复逻辑。

针对性验证运行 Quick Chat 测试组，覆盖原生角色发现、仅清理匹配会话且不销毁后台 session、紧凑／展开／历史的控制入口、两个平台侧栏隐藏或卸载后的打开及模式隔离，并检查序列化执行、语法及运行包资源。真实 Renderer 验收依本级 DESIGN 的证据边界记录，不将契约样例视为 GUI 验收。

Codex `26.1027.30824` 的原生打开逻辑改用条件表达式。角色发现兼容已有 if 分支与
新的 page/current session 条件表达式，仍校验 quick-chat 能力、原生打开状态与新建动作。
回归覆盖两种语法及错误能力；本机隔离注入已报告 available，未补做物理快捷键和鼠标验收。
