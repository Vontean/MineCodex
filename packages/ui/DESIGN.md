# MineCodex UI 组件库的局部约定

通用视觉与原生适配规则只维护在根 [DESIGN.md](../../DESIGN.md)。内部文档与代码路由见根 [AGENTS.md](../../AGENTS.md)，架构见 [ARCHITECTURE.md](ARCHITECTURE.md)。

本级只负责共享组件自身的结构、接入与实现边界，不维护另一份颜色、字体、材质、遮罩或sidebar规则。

## 当前阶段

`packages/ui` 目前只有规范与架构文档，尚未建立独立运行包。现有组件仍位于Runtime Host的 `feature-dialogs.mjs`、`feature-tooltips.mjs`，token契约仍为 `codex-design-contract.mjs`。目标结构详见架构文档；不要将待迁移目录当成现有能力。

## 组件职责

- 原生适配层：解析实际token、主题、zoom和能力状态；共享锚点仅包含真实跨插件需求。原生事实遵循根规范，不在每个组件重新猜测。
- 材质与层级基础：按Dialog、Dropdown、Popover、ComposerMenu、Page的原生分支提供有限选项，将遮罩与Portal规则同所选组件匹配。
- Dialog：提供容器、标题、Close及操作区的结构；插件填表单、列表或确认内容。
- Button：表达操作角色和状态，保留Cancel ghost、实际次级outline与主操作solid的语义区分；业务动作由插件传入。
- Tooltip：处理声明式标记、hover/focus、aria关联、关闭与卸载，不接管原生Tooltip。
- 页面、菜单与浮层：提供对应类型的外壳、挂载和通用交互，不读取提示词、会话或站点业务数据。

## 接入约束

当前page-script通过 `config.ui` 使用公共能力；现有API包括 `heading`、`footer`、`action`、`overlay`、`surface`。现有 `surface(node, kind)` 尚未完整表达根规范中的原生分类，后续按实际使用补齐，而不是继续扩大一种通用玻璃配方。

Renderer安装函数经序列化注入，必须自包含。组件代码与Node/CDP隔离，宿主负责组装注入源码、生命周期和iframe主题桥；不为整理目录引入不必要的打包系统。

通用生命周期契约由组件库维护。原生已经提供的焦点圈定、Escape和关闭机制优先复用；插件继续拥有业务状态、内容更新和具体回调。迁移时同步触发点焦点恢复、异步卸载及原生节点归属验证。

## 验证边界

组件验证关注可注入性、结构与回调、状态清理、挂载/焦点以及所选原生类型的实际行为，不镜像每条CSS写实现测试。布局、材质和原生状态变化按风险做隔离验收；只移动文件时验证导入、序列化、发布名单与已有功能回归。
