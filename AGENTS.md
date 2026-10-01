# MineCodex 内部开发入口

本文件供 Agent 与项目维护者定位规范和代码。对外 README 负责产品、安装、使用和公开开发命令，不承担内部文件路由。

## 文档层级

1. 先读根 [DESIGN.md](DESIGN.md)：全项目通用视觉、原生组件分类、token、层级、sidebar行为与材质规则的唯一权威来源。
2. 涉及领域、架构层与柔性设计时读根 [ARCHITECTURE.md](ARCHITECTURE.md)；共享 UI 文件归属与接入见 [UI 架构](packages/ui/ARCHITECTURE.md)。
3. 修改共享UI时读 [组件库 DESIGN.md](packages/ui/DESIGN.md)；修改插件时读对应 `features/<plugin>/DESIGN.md`。本级文档只负责特殊组件、业务布局与已选用的通用分支。
4. 通信、加载、生命周期和注入方式读 [Runtime Host 文档](packages/runtime-host/README.md)。设计细节回写根 DESIGN.md，不在Runtime README或插件文档另起通用规则副本。

## 文件路由

| 任务 | 当前位置 | 归属 |
| --- | --- | --- |
| 通用设计、token与原生组件选型 | 根 `DESIGN.md` | MineCodex组件库维护的项目规范 |
| 领域、架构层与模块接口 | 根 `ARCHITECTURE.md` | 全项目架构约定 |
| 组件库结构与接入 | `packages/ui/ARCHITECTURE.md`、`packages/ui/DESIGN.md` | 已建立的UI组件库 |
| 共享Dialog、Button、Scrim、Surface | `packages/ui/src/components/dialog.mjs`、`button.mjs`、`foundation/surfaces.mjs` | UI组件库 |
| 共享Tooltip | `packages/ui/src/components/tooltip.mjs` | UI组件库 |
| token名单与必要别名 | `packages/ui/src/native/tokens.mjs` | UI组件库 |
| CDP与运行生命周期 | `packages/runtime-host/src/codex-cdp.mjs`、`codex-runtime.mjs` | Runtime Host |
| 注入组装、主题传递、host bridge | `packages/runtime-host/src/codex-injection.mjs`、`host-actions.mjs` | Runtime Host；不在这里继续堆积视觉组件 |
| 注入UI源码组装 | `packages/ui/src/install.mjs` | UI组件库；宿主调用并注入 |
| 模型规则与专有原生控制器适配 | `features/model-slider/src/domain/`、`src/frontend/`、`src/injection-source.mjs` | Model Slider；宿主只负责组装和调度 |
| 会话指标与日志 | `features/session-status/src/domain/`、`src/backend/` | Session Status |
| 站点规则、发现和启动 | `features/sites/src/domain/`、`src/backend/` | Sites |
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

领域归属与柔性设计遵循根 ARCHITECTURE.md：先确定规则所有者，再按实际变化选择接口；不要仅为目录对称增加抽象、空模块或转发文件。
