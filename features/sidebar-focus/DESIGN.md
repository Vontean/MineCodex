# Sidebar Focus

通用视觉、材质、按钮、Tooltip 与原生 sidebar 层级遵循根 [DESIGN.md](../../DESIGN.md)。本文件只记录功能特有组件、布局、数据语义与通用组件选型。

保留当前任务所在分类与 Project，收起其他分支。再次点击恢复进入聚焦前的展开状态；聚焦期间切换任务跟随路径。用户手动调整分支时退出聚焦并保留手动布局，无撤销浮层。

- 入口：展开侧栏的 Activity 与 Search 之间，随原生侧栏一起隐藏。
- 图标：整理操作使用 Lucide list-chevrons-down-up；可恢复布局时切换为 list-chevrons-up-down。16px，24px viewBox，描边 1.575 units（实际 1.05px）。
- 控件：继承原生 Activity 的 Button 类与 28px 热区。挂载到带原生 column-gap 的按钮组，跳过零间距的通知包装层；通知、Focus、搜索之间复用原生 gap，不单独添加 margin。两种状态均使用 secondary / ghost，以图标表达下一步动作，不显示蓝色模式选中态；aria-pressed 保留可恢复状态的可访问语义。
- 中英文标题：Focus current task / 聚焦当前任务；Restore layout / 恢复布局。
- 折叠通过原生回调执行；React 元数据仅用于读取稳定分类、项目和会话身份。
- 无可识别当前路径时禁用；Activity 列表展示期间暂停整理。
- 状态仅作用于当前窗口；Codex 与 ChatGPT 分别保存聚焦和恢复快照，切换模式后跟随其原有状态，不把另一模式的布局套用过来；卸载不额外改变用户布局。

显式使用中性 data-color 与 data-variant，直接复用原生语义 token 适配明暗模式，不写死颜色或背景色。Activity 开启时按钮原生 disabled，暂停聚焦操作，关闭后恢复可用性。

Tooltip 由共享组件库通过 `data-minecodex-tooltip` 管理；插件只提供随聚焦状态变化的文案，不维护独立材质、定位或显示事件。克隆入口时移除原控件的 `title` 与 `aria-describedby`。

2026-10-04 当前窗口只读实测：通知内层包装为 flex / column-gap:normal（布局间距0），外层按钮组为 flex / gap:4px。旧挂载使通知与 Focus 的实际间距0，Focus 与搜索4px；修正为外层按钮组的独立子项。

2026-10-05：侧栏整理按下一动画帧合并，不使用等待页面静止的防抖。观察器仅响应侧栏内部变化、侧栏挂载／卸载、当前会话和语言变化；消息流输出不触发整理。仍逐次调用原生折叠动作，给 React 留出更新与重新定位分支的机会。

2026-10-17，Codex 26.1013.4894.0 Windows 隔离窗口：两种模式的侧栏内容同时挂载在同一侧栏根内，通过可见性切换。入口须选择可见 Activity；原生入口重建时重新挂载，分支枚举只读取可见模式。ChatGPT 会话通过其原生 conversation key 和 `aria-current="page"` 识别，不复用隐藏 Codex 的选中行。模式身份从原生 `sidebarMode` 读取，不能把按钮节点重建误当作模式切换。观察侧栏的 class/style 与 aria-current 变化，以跟随模式和会话切换。

验证覆盖两种内容保留挂载时的入口唯一性、隐藏分支隔离、模式快照隔离和恢复、同模式入口重建；隔离页面验证 ChatGPT 实际聚焦/恢复、来回切换、Activity 暂停/恢复和卸载。无选中任务的首页保持入口可见且禁用；没有真实任务不算聚焦交互已验收。
