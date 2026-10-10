# Quick Chat

独立 page-script 功能，无服务、数据库或 host action。CLI 提供独立开关，Runtime Host 仅发现和组装源码。

- `src/adapters/codex/renderer.mjs` 识别经典聊天浮层，提供当前会话、原生提交许可、发送确认呈现记录身份、standalone Minimize 模板、项目 rail、展开和历史动作。入口不遍历 React。
- `src/adapters/codex/shortcut.mjs` 通过原生命令目录、Quick Chat 能力检查与导出角色发现打开动作；从模式选择器定位当前 AppScope，不硬编码压缩名称或构建哈希。⌘⌥N 未被处理时，先以统一停靠浮层与按钮回调形状识别原生 Restore（不匹配本地化标签），调用按钮以保留原生 presentation 恢复和焦点。此分支覆盖页面上下文的 Work；已显示时只聚焦。无可用浮层才在 Codex 模式调用打开动作；重复按键、输入法组合和其他组合保留原状。官方恢复命令或协议不匹配时停止补偿，卸载及 AbortSignal 清理监听。
- `src/adapters/codex/pin.mjs` 识别经典 Quick Chat 的内容会话、展开 header 与原生全屏层，过滤 Work、widget、annotation、历史预览和退出状态；保留最小化快照供固定状态清理。`src/frontend/pin.mjs` 管会话内 Pin 与按钮，不读 Fiber；Minimize / Esc / 关闭 / 会话切换 / 卸载解除固定。只对当前固定层添加可撤销的背景穿透标记，子元素继续使用原生命中；维持展开经 Adapter 的原生 presentation 动作，不截断主页面点击。
- `src/domain/submission.mjs` 只解释本次提交与同会话新增发送确认的关系，不读取 DOM 或原始 Codex 对象。
- `src/domain/history.mjs` 记录历史所在会话；选中已有会话后展开，New chat、最小化和卸载清除记录。
- `src/frontend/entry.mjs` 管理逐浮层实例与按钮；提交事件只记录基线，不接管发送。原生会话已开始且发送确认写入新呈现记录后才展开；紧凑状态没有正文 DOM，不通过消息节点判定。
- 原生 `submit` emitter 用于键盘提交；DOM submit / submit-button click 覆盖鼠标。扩展 listener 返回 false，不改变原生 handled 结果。切换会话、隐藏和卸载时撤销监听并清空等待状态。
- 私有 Adapter 以语义 props 和原生 `history` 菜单项发现能力，不匹配构建哈希、函数名或 hook 索引。历史 onSelect 已通过 forceExpanded 展开，不额外调用 onPresentationChange，避免污染 restorePresentation。呈现记录以 conversationId / owner / presentation 形状识别，只向领域提供窗口内序号。Work、annotationSubmitTarget 页面 composer、widget、其他 floating surface 不因视觉相近接入。仅 standalone=true 的 Minimize 提供按钮模板，标题栏不接入。历史列表由原生 conversations / onConversationSelect / onNewChat 与可见祖先识别；不读取或复制历史条目内容。展开面板没有新增 History；standalone Minimize 使用圆形 utility 的圆角，卸载移除标记。项目 rail 通过 composer variant + onProjectChange 识别，不依赖标签语言。隐藏项目项时通过限定 CSS 收起无其他内容的 rail 容器，避免 attached rail 的 padding-bottom / negative margin 残留；附件或其他 rail 内容保留。

验证使用独立 profile / CDP。覆盖首轮与续轮发送、空提交、输入不展开、未发送时历史、选择旧聊天、最小化与恢复、开关清理及 Work 隔离；单元测试不能替代真实 Renderer 验收。

Pin 图标来自本机 26.1007.21159 的 `lucide-pin` 模块，路径与 Lucide Pin 一致；许可见 `vendor/lucide-LICENSE`。固定填充只作用于图钉主体。Pin 与 `quick-chat-repair` 分别拥有存活浮层的背景点击规则和退出后的 Motion 登记清理；穿透标记不改变 repair 的原生 class selector，退出时释放，repair 继续处理原有空 AnimatePresence 问题。
