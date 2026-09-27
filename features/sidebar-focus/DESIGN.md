# Sidebar Focus

保留当前任务所在分类与 Project，收起其他分支。再次点击恢复进入聚焦前的展开状态；聚焦期间切换任务跟随路径。用户手动调整分支时退出聚焦并保留手动布局，无撤销浮层。

- 入口：展开侧栏的 Activity 与 Search 之间，随原生侧栏一起隐藏。
- 图标：Lucide list-chevrons-down-up（聚焦）/ list-chevrons-up-down（还原），16px，24px viewBox 内 2px 描边。
- 控件：继承原生 Activity 的 Button 类、28px 热区、secondary 颜色，始终使用 ghost。灰色背景仅在 hover 时出现，聚焦状态由图标切换表达，不保留选中底色。
- 字体、颜色、圆角、动效全部使用原生控件，不新增主题覆盖。
- 中英文标题：Focus current task / 聚焦当前任务；Exit focus / 退出聚焦。
- 折叠通过原生回调执行；React 元数据仅用于读取稳定分类、项目和会话身份。
- 无可识别当前路径时禁用；Activity 列表展示期间暂停整理。
- 状态仅作用于当前窗口；卸载不额外改变用户布局。

始终显式使用 secondary 色，避免从激活的 Activity 按钮继承 info 蓝色。Activity 开启时按钮原生 disabled，暂停聚焦操作，关闭后恢复可用性。
