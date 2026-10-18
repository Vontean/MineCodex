# Quick Chat

独立 page-script 功能，无服务、数据库或 host action。CLI 提供独立开关，Runtime Host 仅发现和组装源码。

- `src/adapters/codex/renderer.mjs` 识别经典聊天浮层，提供当前会话、原生提交许可、发送确认呈现记录身份、standalone Minimize 模板、项目 rail、展开和历史动作。入口不遍历 React。
- `src/adapters/codex/shortcut.mjs` 通过原生命令目录、Quick Chat 能力检查与导出角色发现打开动作；从模式选择器定位当前 AppScope，不硬编码压缩名称或构建哈希。平台快捷键（Windows Ctrl+Alt+N，macOS ⌘⌥N）未被处理时，先以统一停靠浮层与按钮回调形状识别原生 Restore（不匹配本地化标签），调用按钮以保留原生 presentation 恢复和焦点。此分支覆盖页面上下文的 Work；已显示时只聚焦。Codex 模式先读取原生打开 atom；false 调用原生 New chat，待新会话 DOM 挂载后聚焦，不复用退出动画中的旧输入框。true 才恢复或聚焦已有浮层；重复按键、输入法组合和其他组合保留原状。官方恢复命令或协议不匹配时停止补偿，卸载及 AbortSignal 清理监听。
- `src/adapters/codex/history.mjs` 统一识别原生历史列表，只向控制区输出可见事实；注入工厂显式序列化此依赖。
- `src/domain/submission.mjs` 只解释本次提交与同会话新增发送确认的关系，不读取 DOM 或原始 Codex 对象。
- `src/domain/history.mjs` 记录历史所在会话；选中已有会话后展开，New chat、最小化和卸载清除记录。
- `src/frontend/entry.mjs` 管理逐浮层实例与按钮；提交事件只记录基线，不接管发送。原生会话已开始且发送确认写入新呈现记录后才展开；紧凑状态没有正文 DOM，不通过消息节点判定。
- 原生 `submit` emitter 仅由 Adapter 持有并用于键盘提交；快照只输出窗口内 subscriptionId，原生来源更换时前端据此重建订阅。DOM submit / submit-button click 覆盖鼠标。扩展 listener 返回 false，不改变原生 handled 结果。切换会话、隐藏和卸载时撤销监听并清空等待状态。
- 私有 Adapter 以语义 props 和原生 `history` 菜单项发现能力，不匹配构建哈希、函数名或 hook 索引。历史 onSelect 已通过 forceExpanded 展开，不额外调用 onPresentationChange，避免污染 restorePresentation。呈现记录在当前 session 的订阅状态中解包 `[value, store, atom]`，以 owner / presentation 形状识别；若记录含 conversationId，须与当前会话一致，只向领域提供窗口内序号。Work、annotationSubmitTarget 页面 composer、widget、其他 floating surface 不因视觉相近接入。仅 standalone=true 的 Minimize 提供按钮模板，标题栏不接入。历史列表由原生 conversations / onConversationSelect / onNewChat 与可见祖先识别；不读取或复制历史条目内容。展开面板没有新增 History；standalone Minimize 使用圆形 utility 的圆角，卸载移除标记。项目 rail 通过 composer variant + onProjectChange 识别，不依赖标签语言。隐藏项目项时通过限定 CSS 收起无其他内容的 rail 容器，避免 attached rail 的 padding-bottom / negative margin 残留；附件或其他 rail 内容保留。

验证使用独立 profile / CDP。覆盖首轮与续轮发送、空提交、输入不展开、未发送时历史、选择旧聊天、最小化与恢复、开关清理及 Work 隔离；单元测试不能替代真实 Renderer 验收。

## 侧栏入口

`src/adapters/codex/sidebar.mjs` 从可见侧栏行的 `animatedIcon:sidebar-new-chat`、excludeFromNavigation 和 sidebarMode 识别 Codex New chat，不匹配标题文字；图标从原生浮层 Restore 的默认 minimizedIcon 调用关系发现，再使用该图标的 createElement 工厂。资源变化时不以第三方图标猜测替代。

`src/frontend/sidebar.mjs` 管同级按钮、hover / focus-within、模式切换与卸载；复用 `installQuickChatShortcut` 提供的 activate 动作，避免构造键盘事件或重复一份新建／恢复／聚焦逻辑。新原生会话挂载后的聚焦仍由原适配器维护。

旧 Pin 与 Motion 退出登记补丁已移除；原生事实、图标规格和当前验证边界见本级 DESIGN。更新后检查原生完整关闭与主页面命中、悬浮入口实际点击、最小化恢复、重复点击不新建、模式切换和卸载，不能仅以入口存在作为打开行为验收。
