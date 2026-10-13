# MineCodex 开发约定

## 按任务读取

- **领域归属、跨模块修改或接口选择：** 读根 [ARCHITECTURE.md](ARCHITECTURE.md)，确定规则所有者、依赖方向和所需分层。
- **视觉、组件选型或原生交互：** 读根 [DESIGN.md](DESIGN.md)；共享组件接入再读 [UI 局部约定](packages/ui/DESIGN.md)，组件组织再读 [UI 架构](packages/ui/ARCHITECTURE.md)。功能特殊选择读对应 `features/<id>/DESIGN.md`，以实际存在的文件为准。
- **功能行为、存储或专有协议：** 读对应功能已有的 DEVELOPMENT / DESIGN；涉及产品目标时读该处已有的 PRODUCT。共享 Codex 环境契约读 [Codex Adapter](packages/codex-adapter/DEVELOPMENT.md)，官方 MCP 页面与通信读 [Plugin](packages/plugin/DEVELOPMENT.md)。
- **加载、注入、通信或生命周期：** 读 [Runtime Host](packages/runtime-host/DEVELOPMENT.md)。数据导入导出读 [迁移契约](packages/cli/DATA-TRANSFER.md)；macOS 后台 App 资源或签名变更读 [原生服务约定](packages/cli/native/DEVELOPMENT.md)。
- **控制台布局或主题：** 读 [Dashboard DESIGN](apps/dashboard/DESIGN.md)；产品状态与操作目标读 [Dashboard PRODUCT](apps/dashboard/PRODUCT.md)。
- **发布：** 读 [npm 发布流程](docs/npm-publishing.md)，以本次检查为依据。

代码位置与调用关系以当前源码为准。有 `.codegraph/` 时，先用 `codegraph explore` / `codegraph node` 理解或定位代码，再做针对性搜索；没有索引时直接查询源码。

## 修改与交付

- 默认简体中文，代码、命令与路径保留英文；说明用户影响和决策依据。
- 按改动范围读取上述约定，再按所属文档的验证标准交付。保留无关本地改动，提交按逻辑边界拆分。
- 规则变化时修改其权威文档；通用视觉归根 DESIGN，架构归根 ARCHITECTURE，功能差异归本级文档。原生事实注明构建与证据范围，替换过时描述。
- 文档记录选择理由、适用条件、例外和完成标准。字段、常量、目录与命令以源码、配置或帮助为准；保留会影响决策的外部协议陷阱。每项规则只维护一处正文，其他入口用按任务触发的指针。

## Git 文件范围

Git 保留源码、运行资源、测试、构建与发布脚本、依赖清单、许可证，以及当前产品说明、设计规范和开发契约。Git 源码范围与 npm 运行包名单分别维护。

本地讨论放 `docs/discussions/`，调研放 `docs/research/`，交接放 `docs/history/`，一次性验收与截图放 `docs/verification/`；这些目录由 `.gitignore` 排除。讨论形成的有效决定提炼到所属规范，公开文档与代码不依赖本地材料。已跟踪的本地材料仅从 Git 索引移除，保留磁盘文件和历史。
