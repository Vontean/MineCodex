# MineCodex 内部开发入口

本文件供 Agent 与项目维护者定位规范和代码。对外 README 负责产品、安装、使用和公开开发命令，不承担内部文件路由。

## 文档层级

1. 先读根 [DESIGN.md](DESIGN.md)：全项目通用视觉、原生组件分类、token、层级、sidebar行为与材质规则的唯一权威来源。
2. 涉及架构或文件归属时读 [UI 架构](packages/ui/ARCHITECTURE.md)。图与目录树区分当前实现和目标结构，不将规划模块当成现有API。
3. 修改共享UI时读 [组件库 DESIGN.md](packages/ui/DESIGN.md)；修改插件时读对应 `features/<plugin>/DESIGN.md`。本级文档只负责特殊组件、业务布局与已选用的通用分支。
4. 通信、加载、生命周期和注入方式读 [Runtime Host 文档](packages/runtime-host/README.md)。设计细节回写根 DESIGN.md，不在Runtime README或插件文档另起通用规则副本。

## 文件路由

| 任务 | 当前位置 | 归属 |
| --- | --- | --- |
| 通用设计、token与原生组件选型 | 根 `DESIGN.md` | MineCodex组件库维护的项目规范 |
| 组件库结构与迁移 | `packages/ui/ARCHITECTURE.md`、`packages/ui/DESIGN.md` | UI组件库；当前只建立文档，未迁移运行代码 |
| 共享Dialog、Button、Scrim、Surface | `packages/runtime-host/src/feature-dialogs.mjs` | 现有实现；目标归入UI组件库 |
| 共享Tooltip | `packages/runtime-host/src/feature-tooltips.mjs` | 现有实现；目标归入UI组件库 |
| token名单与必要别名 | `packages/runtime-host/src/codex-design-contract.mjs` | 现有设计契约；目标归入UI组件库 |
| CDP与运行生命周期 | `packages/runtime-host/src/codex-cdp.mjs`、`codex-runtime.mjs` | Runtime Host |
| 注入组装、主题传递、host bridge | `packages/runtime-host/src/codex-injection.mjs`、`host-actions.mjs` | Runtime Host；不在这里继续堆积视觉组件 |
| 插件业务、特有组件与内容 | `features/<plugin>/src`；Images另有`web`界面 | 对应插件 |
| CLI、安装与服务管理 | `packages/cli` | CLI |
| 本地控制台 | `apps/dashboard` | 控制台应用 |
| 验证 | 对应模块的`test/`、`scripts/check-syntax.mjs` | 按改动范围验证 |
| 历史调查与交付流程 | `docs/research/`、`docs/windows-acceptance.md` | 证据与流程，不覆盖当前设计规范 |

有 `.codegraph/` 时，理解或定位代码先使用 `codegraph explore` / `codegraph node`，再做针对性搜索。不要把本文件的路径清单当成比当前源码更可靠的调用图。

## 修改边界

- UI组件不读插件数据库，也不导入插件业务服务；插件不复制通用材质、遮罩、按钮和Tooltip规则。
- 当前直接注入page-script通过`config.ui`消费共享UI；iframe通过主题/消息桥接入。保留实际运行环境差异，不能搬文件后假设模块imports仍存在于序列化脚本。
- 以原生语义组件和实际状态为依据，保留React原节点及原生布局、sidebar hover、焦点和导航行为。
- 通用规范只写在根 DESIGN.md；本级差异写在本级 DESIGN.md。新的原生事实注明版本及源码/实测范围，移除过时规则。
- 文件迁移时同步导入、相关验证、发布文件名单与本文件路由，删除已无用途的旧文件；不保留重复实现或无需求的兼容层。
- 默认简体中文，代码和路径保留英文；说明用户影响和关键约束。保留无关本地改动，按逻辑边界提交。
