# MineCodex 架构约定

本文件负责领域归属、架构层与模块接口；通用视觉由 [DESIGN.md](DESIGN.md) 负责，内部文件导航由 [AGENTS.md](AGENTS.md) 负责。UI 结构与接入细节见 [组件库架构](packages/ui/ARCHITECTURE.md)。

## 领域与架构层

```mermaid
flowchart TB
  CLI["CLI / Dashboard<br/>配置、启动、用户操作"]
  Host["Runtime Host · 组合与接入<br/>插件发现、CDP、可信消息、生命周期"]
  UI["UI 组件库<br/>原生 token、材质、层级、通用控件"]
  subgraph Feature["功能领域 · features/*"]
    Frontend["frontend / web<br/>特殊组件、内容、状态与交互"]
    Application["backend<br/>业务流程、存储与外部读取适配"]
    Domain["domain · 有实际规则时拆出<br/>实体含义、校验、事件归约、指标口径"]
  end
  Native["外部环境<br/>Codex、日志、文件、网页与操作系统"]
  CLI --> Host
  Host -->|"安装与通信"| Frontend
  Host -->|"组合业务能力"| Application
  Frontend -->|"使用组件，提供内容"| UI
  Frontend -->|"业务请求"| Host
  Application --> Domain
  Host -->|"接入"| Native
  Application -->|"读取与存储适配"| Native
```

图描述能力流向，实际导入必须遵守下面的接口约束。Runtime Host 是组合入口，可以导入插件后端来接线；UI 与领域规则不反向导入宿主。前端通过已声明的 host action 请求业务，不直接使用 CDP 或本地数据库。

| 领域 | 拥有的概念与规则 | 当前代码 |
| --- | --- | --- |
| Prompts（功能 ID 保留 notes） | 提示词、分类、顺序、插入成功后的调用计数；不替用户发送消息 | `features/notes/src/backend/`、`src/frontend/` |
| Session Status | 回合、步骤、token 用量、缓存比例、体感 TPS 与上下文口径 | `features/session-status/src/domain/session-stats.mjs`、`src/backend/session-status-reader.mjs` |
| Images | 图片身份、Library 来源、提示词溯源、导入与查看 | `features/images/src/`，云 Library 适配在 `src/backend/cloud-library.mjs` |
| Sites | 站点来源、地址分类、项目归属、收录、发现与启动 | `features/sites/src/domain/site.mjs`、`src/backend/`、`src/frontend/` |
| Model Slider | 模型身份、品牌、目录别名、真实档位、收藏与原生选择器增强 | `features/model-slider/src/domain/`、`src/frontend/`、`src/injection-source.mjs` |
| 其他紧凑增强 | 各自的原生插入点与交互 | 保持本功能简单结构，不为统一外观创建空目录 |

同为“会话”或“图片”的数据，不代表不同领域共享同一业务模型。业务结果通过明确的数据对象与动作传递；共享 UI 不解释 token 用量、提示词使用次数或站点启动状态。

## 柔性设计与接口原则

- **在变化实际发生的位置留接口。** 已有多个插件使用的 Dialog、Button、Tooltip、页面层级归组件库；平台差异留在外部适配，不进入业务规则。只有一个实现且没有实际变化需求时，不预建策略类或抽象工厂。
- **模块接口小，内部职责完整。** 模块隐藏材质、挂载、序列化或业务口径的复杂性；调用方只学习必要的内容、状态、参数、结果和失败条件。不是把大文件机械拆成大量转发文件。
- **通过组合提供柔性。** Dialog 标题、内容和动作组合；原生材质按有限分支选择。插件提供回调，组件不寻找插件数据库；不采用继承树，也不接受任意 CSS 覆盖作为通用设计入口。
- **外部依赖可替换，业务事实只有一处。** 会话日志读取接受目录与时钟，事件归约不读取文件；云图片适配接受 evaluator，由宿主连接 CDP；站点服务接受 listeners/probe，由发现适配执行进程与网页探测。
- **单向知识依赖。** `domain` 不知道 Renderer、HTTP 服务、数据库连接或 CDP；UI 不知道任何功能领域；宿主负责组合，不拥有提示词、图片或会话指标规则。
- **显式失败和生命周期。** 缺失原生能力返回已有错误/占位，不猜身份或展示旧会话数据。异步结果归属、卸载和用户草稿由真实所有者维护；不以过度防御掩盖失效契约。
- **按领域规模分层。** 简单插件保留一个入口；有独立规则和副作用时再分 `domain` / `backend` / `frontend`。领域规则不强求零依赖，例如项目目录匹配可以使用 `node:path`，但不得执行 IO。

## 注入与资源契约

当前 page-script 仍是函数体源码，由 Runtime Host 执行并接收 `signal` 与 `config`；不是可以在 Renderer 直接 imports 的 Node 模块。`packages/ui/src/install.mjs` 将组件安装函数显式组装成自包含源码，宿主不复制组件实现。

较大的前端入口可在 manifest 的 `entry.resources` 中声明 CSS、图标 JSON 等资源文件：键映射到本功能内相对路径；JSON 解析为数据，其他文件读取为文本，经 `config.resources` 一次传入。资源不可越出功能目录，不新增 HTTP 请求或前端打包步骤。Prompts 与 Sites 使用这一接口把样式、图标和交互源码分开。

需要将纯规则组装进注入源码时，插件可声明 `entry.sourceFactory`，指向本功能内导出 `createPageScriptSource()` 的 Node 模块。宿主只调用工厂取得函数体源码；工厂负责把纯规则序列化进去，Renderer 不依赖 Node imports。Images 的 Library 面板与历史云导入共用 `src/domain/library-prompt.mjs`。

Images 的 iframe 仍使用主题/消息桥；原生 Library 增强仍使用 Renderer 入口。两种接入不强行合并。

## 修改与验证

修改领域规则时验证结果口径；修改 IO 适配时验证路径、增量读取和错误；修改共享 UI 时验证安装源码、角色选择、焦点和卸载。原生布局、材质与交互按风险在隔离窗口验收。静态依赖检查只用于防止已确定的架构层反向导入，不取代行为验证。

文件迁移同时更新 imports、manifest、命令、验证及 npm files。删除原位置文件，不保留转发兼容壳。公开 README 维护产品与使用说明；内部路由回写 AGENTS，通用视觉回写根 DESIGN，本级规则回写本级文档。

Model Slider 的领域规则与原生控制器适配归插件，`src/injection-source.mjs` 显式组装两者；宿主只提供 feature 配置、共享 UI、图标工厂、locale 与刷新调度，调用 `ensure` / `dispose`。原生 React 操作仍由插件适配层维护，领域规则不读取 DOM 或 localStorage。旧 Summary 布局属于宿主 surface 接入，仍保留在 `codex-injection.mjs`。

架构验证自动发现所有插件的 domain 目录，检查静态导入、再导出、动态模块依赖和外部环境引用；同时检查已注册 Renderer 入口及 frontend 的反向依赖，以及启用插件的 Tooltip 材质归属。纯规则的模块导入和自包含序列化行为由所属插件测试覆盖，不以测试数量替代领域归属审查。
