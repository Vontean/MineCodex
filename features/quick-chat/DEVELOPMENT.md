# Quick Chat

独立 page-script 功能，无服务、数据库或 host action。CLI 提供独立开关，Runtime Host 仅发现和组装源码。

模式选择器的 ChatGPT 入口使用 mode=work、workModeAccess=chatgpt；不能把界面名称当成 mode 值，也不能对所有 work 分支都启用独立聊天补偿。Codex 使用 mode=codex。其他 Work 分支只保留已有浮层的恢复与聚焦。

宿主注入可能早于 app-initial 入口标签挂载。入口缺失时用 MutationObserver 等待原生 modulepreload / script 就绪后再加载，期间自检为 quick-chat-module-pending；不使用定时轮询。加载成功、卸载或 AbortSignal 必须断开观察器，不能一次查找失败后永久停用。

快捷键冷启动时，原生打开状态 atom 可能仍为未初始化的导出。Adapter 按状态赋值与 once 包装定位所属的原生初始化器，仅在状态缺失时调用，再读取模块的实时导出；不依赖其他功能或切换页面顺带初始化。初始化器缺失或协议不匹配时停止补偿，自检保留已知协议错误码，不输出原始异常内容。测试必须覆盖冷、热两种加载顺序，不能只构造已经初始化的状态对象。

- `src/adapters/codex/renderer.mjs` 识别经典聊天浮层，提供当前会话、原生提交许可、发送确认呈现记录身份、standalone Minimize 模板、项目 rail、展开和历史动作。入口不遍历 React。
- `src/adapters/codex/shortcut.mjs` 通过源码中的原生命令定义（不依赖懒初始化数组）、Quick Chat 能力检查与导出角色发现打开、关闭动作；从模式选择器定位当前 AppScope，不硬编码压缩名称或构建哈希。平台快捷键（Windows Ctrl+Alt+N，macOS ⌘⌥N）未被处理时，先以浮层的 isMinimized 布尔状态及 presentation / minimize 回调，加上按钮回调形状识别原生 Restore（standalone 可省略 unifiedDocking）（不匹配本地化标签），调用按钮以保留原生 presentation 恢复和焦点。此分支覆盖页面上下文的 Work；Codex / ChatGPT 的独立浮层已显示时调用原生关闭，其他页面上下文只聚焦。Codex 和 ChatGPT 模式先读取原生打开 atom；false 调用原生 New chat，待新会话 DOM 挂载后聚焦，不复用退出动画中的旧输入框。true 时恢复最小化浮层，已显示时关闭；重复按键、输入法组合和其他组合保留原状。官方恢复命令或协议不匹配时停止补偿，卸载及 AbortSignal 清理监听。
- `src/adapters/codex/history.mjs` 统一识别原生历史列表，只向控制区与 Pin 适配输出可见事实；注入工厂显式序列化此依赖。
- `src/adapters/codex/pin.mjs` 识别经典 Quick Chat 的内容会话、展开 header 与原生全屏层，过滤 Work、widget、annotation、历史预览和退出状态；保留最小化快照供固定状态清理。`src/frontend/pin.mjs` 管会话内 Pin 与按钮，不读 Fiber；Minimize / Esc / 关闭 / 会话切换 / 卸载解除固定。只对当前固定层添加可撤销的背景穿透标记，子元素继续使用原生命中；维持展开经 Adapter 的原生 presentation 动作，不截断主页面点击。
- `src/domain/submission.mjs` 只解释本次提交与同会话新增发送确认的关系，不读取 DOM 或原始 Codex 对象。
- `src/domain/history.mjs` 记录历史所在会话；选中已有会话后展开，New chat、最小化和卸载清除记录。
- `src/frontend/entry.mjs` 管理逐浮层实例与按钮；提交事件只记录基线，不接管发送。原生会话已开始且发送确认写入新呈现记录后才展开；紧凑状态没有正文 DOM，不通过消息节点判定。
- 原生 `submit` emitter 仅由 Adapter 持有并用于键盘提交；快照只输出窗口内 subscriptionId，原生来源更换时前端据此重建订阅。DOM submit / submit-button click 覆盖鼠标。扩展 listener 返回 false，不改变原生 handled 结果。切换会话、隐藏和卸载时撤销监听并清空等待状态。
- 私有 Adapter 以语义 props 和原生 `history` 菜单项发现能力，不匹配构建哈希、函数名或 hook 索引。历史 onSelect 已通过 forceExpanded 展开，不额外调用 onPresentationChange，避免污染 restorePresentation。呈现记录在当前 session 的订阅状态中解包 `[value, store, atom]`，以 owner / presentation 形状识别；若记录含 conversationId，须与当前会话一致，只向领域提供窗口内序号。Work、annotationSubmitTarget 页面 composer、widget、其他 floating surface 不因视觉相近接入。仅 standalone=true 的 Minimize 提供按钮模板，标题栏不接入。历史列表由原生 conversations / onConversationSelect / onNewChat 与可见祖先识别；不读取或复制历史条目内容。展开面板没有新增 History；standalone Minimize 使用圆形 utility 的圆角，卸载移除标记。项目 rail 通过 composer variant + onProjectChange 识别，不依赖标签语言。隐藏项目项时通过限定 CSS 收起无其他内容的 rail 容器，避免 attached rail 的 padding-bottom / negative margin 残留；附件或其他 rail 内容保留。

验证使用独立 profile / CDP。覆盖首轮与续轮发送、空提交、输入不展开、未发送时历史、选择旧聊天、最小化与恢复、开关清理及 Work 隔离；单元测试不能替代真实 Renderer 验收。

Pin 图标来自本机 26.1007.21159 的 `lucide-pin` 模块，路径与 Lucide Pin 一致；许可见 `vendor/lucide-LICENSE`。固定填充只作用于图钉主体。Pin 与退出适配器分别拥有存活浮层的背景点击规则和退出后的 Motion 登记清理；穿透标记不改变 repair 的原生 class selector，退出时释放，repair 继续处理原有空 AnimatePresence 问题。

Codex 26.1002.52244 / build 13536 的 Motion AnimatePresence 在 `propagate=true`
且没有渲染子元素时，缺少向父层报告退出完成的分支。关闭 Quick Chat（Esc 即可）后，
原生透明全屏层仍拦截主页面点击；与是否截图或是否启用 MCX 无关。
Motion 上游已有对应空容器分支：
https://github.com/motiondivision/motion/blob/main/packages/framer-motion/src/components/AnimatePresence/index.tsx

所属 Adapter 在原生 Quick Chat 全屏层内查找当前 React Fiber 的空 AnimatePresence，
核对 propagate、父层退出 context、usePresence 回调依赖及仍为 false 的注册条目，
调用该容器自己的 safeToRemove。正常父层动画与非空子元素继续由原生管理。
不删除 React 节点，不改 pointer-events，不调用最外层关闭回调，不重载页面或改安装文件。

MutationObserver 在节点及 style 变化后合并为 microtask 检查，卸载时断开并取消待处理工作。
没有定时巡检；不匹配契约时跳过。官方修复正常卸载后没有残留登记，本插件不会再介入。
自检的 native-exit-observer 仅证明修复监听已安装，不代表当前构建的原生交互已验收。

测试覆盖原生登记契约、非空退出、重新打开、去重、范围边界与卸载。
使用实际打包的 React / AnimatePresence 验证时，原始应用源码与截图只留在忽略的本机证据目录。


`src/adapters/codex/presence.mjs` 拥有退出登记契约；`src/frontend/exit.mjs` 拥有观察器与清理。退出修复统一受 quick-chat 开关控制，不增加独立组件卡片。
