# Codex 公共环境适配

该私有 workspace 隔离多个插件共同依赖的 Codex Renderer 机制。专有业务协议放在插件的 `src/adapters/codex/`；视觉适配放在 UI 的 `src/native/`。完整层次与文件导航见根 ARCHITECTURE.md 和 AGENTS.md。

`createCodexEnvironment()` 是可显式序列化的工厂，无 Node 闭包和 IO imports。宿主按 Renderer 生命周期创建一个实例，通过 `config.codex` 提供给插件，卸载/重注入时重新创建。

| 接口 | 结果与约束 |
| --- | --- |
| `composer(element?, {threadOnly, purpose}?)` | 默认仅可见的 Codex thread 输入框；Prompts 使用 `purpose:"insertion"` 支持 Chat、Work、Codex、Temporary Chat 与面板 chat bar。优先当前焦点所在输入框，并可显式绑定插入目标。返回 editable/root/body/add/threadId；非thread不提供身份，隐藏祖先返回 null |
| `currentThreadId(element?)` | 从合格输入框取得 UUID；不从残留 sidebar 选中项猜当前线程 |
| `composerSurface(element?)` | 返回可见正式会话外壳 root/threadId，独立于编辑区是否存在或暂时 inert；供会话状态呈现与宿主统计订阅使用。真正隐藏、移入浮层、切换 home 或卸载时返回 null；不能作为文字插入许可 |
| `rail()` / `railSlot(ownGroup)` | 可见原生 rail 与模板/滚动区/固定组句柄；不包含插件菜单策略 |
| `currentFiber(element)` / `props(element,predicate,limit?)` | 仅供 native Adapter 使用；优先匹配当前 committed props，支持最近祖先的 scope |
| `report(name,available,reason?)` / `diagnostics()` | 最新能力状态的副本；不持有凭据、原始账户数据或用户内容 |

不要增加一个包含所有插件的 CodexGateway。新契约只有在被多个模块实际共用时进入这里。选择器、React 机制改动在本模块验证；插件专有协议改动在所属 Adapter 验证。正常界面不暴露内部诊断。
