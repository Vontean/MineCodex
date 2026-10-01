# 全插件架构验收

> 修复状态：本次列出的五项已修复，当前注册的九个插件通过源码架构复验。下面“标准与结论”至“已验证和未验证”保留 `2de4305` 的原始验收事实；当前结果见文末“修复复验”。

> 范围补充：上述通过是本报告列出的领域归属、导入方向和通用组件复用验收，不等于外部防腐层完整。2026-10-01 的[Codex 防腐层审查](2026-10-01-codex-anticorruption-audit.md)另发现原始协议进入 domain、重复原生能力探测及主题消费路径未统一等缺口，尚未迁移修复。

验收日期：2026-10-01。源码基线：`2de4305`。范围是当前注册的九个插件、共享 UI、Runtime Host 中相关接线，以及仍随仓库维护的 Images 历史工具。本次只审查并记录结果，未修改功能代码。

## 标准与结论

依据根 `ARCHITECTURE.md`、`DESIGN.md`、`AGENTS.md` 和 `packages/ui/ARCHITECTURE.md`，检查领域所有权、架构层依赖、实际变化点接口、共用 UI 的单一维护与文档新鲜度。简单原生增强不要求机械建立 domain/backend/frontend 三层目录；纯呈现规则可以留在前端。宿主对原生 DOM、CDP、身份与动作权限的接入不等同于业务越界。

结论：**部分通过，尚不能宣称全部插件完成新架构验收。** 六个插件符合当前按规模分层的约定；三个插件仍有缺口或明确暂留项。共享组件自身的依赖方向正确，但全插件采用率尚未完整。

| 插件 | 结果 | 依据与限制 |
| --- | --- | --- |
| Hide Upsell Banner | 通过 | 单一原生呈现增强，不干预额度查询；识别、隐藏、观察与卸载职责紧凑，无需独立领域层。 |
| Prompts（notes） | 通过 | 服务与数据库归 backend，页面与资源归 frontend；通过声明的 host action 通信；Dialog/Button/Page/Dropdown/ComposerMenu 使用共享 UI。Product 封装业务和 SQLite，不以多一层 repository 作为通过条件。 |
| Session Status | 通过 | 事件归约与统计口径归 domain；日志发现、偏移、重试与时钟归 backend；前端只呈现快照及管理交互；详情材质与 Tooltip 材质使用共享 UI。 |
| Sites | 通过 | 地址分类、来源校验、项目匹配归 domain；发现、启动、预览和持久化归 backend；listeners/probe 是实际可替换接口；前端共用弹窗与按钮，native dialog 管理模态生命周期。 |
| Usage Meter | 通过 | 只读取原生账号对应缓存，不另建查询服务；短小额度转换属于本功能；特殊 Tooltip 保留内容和定位，共用 tooltipSurface 材质。 |
| Task Switcher（unread-inbox） | 通过 | 会话列表规则与原生读取均属于当前功能，没有反向导入宿主或其他业务；共用 Popover 材质，保留特殊列表、导航与 hover 逻辑。后续增长时再分离原生读取和纯列表策略。 |
| Sidebar Focus | 未通过通用组件归属 | 聚焦和展开恢复规则归属正确，但自行创建 Tooltip、CSS 和交互，未消费共享 Tooltip。 |
| Images | 部分通过 | 当前 manifest 仅启用 Library 提示词增强；原生 Version history 式侧面板是本级特殊组件，可以直接复用原生类。云 Library 接口已接受 evaluator，但溯源规则在当前前端和历史云适配中重复；历史工具文档仍与当前产品定义冲突。 |
| Model Slider | 部分通过，已声明暂留 | manifest 拥有品牌、别名与资源，但模型身份、显示、收藏及大量专有 UI 仍在宿主。文档明确允许暂留原生控制器耦合，故不是本次迁移意外回归；仍不代表领域归属完成。 |

## 待处理项

### 1. Sidebar Focus 仍重复维护通用 Tooltip（P2）

`features/sidebar-focus/src/sidebar-focus.mjs:5–20` 自建 tip 和完整材质 CSS；`62–65` 自行绑定显示与隐藏。与 `packages/ui/src/components/tooltip.mjs:2–17` 重复维护同一组 token、padding、border、radius、font 和 shadow。其本级 DESIGN 已宣称遵循根通用 Tooltip 契约，实际未接入。

后果：组件库修改 Tooltip 时，聚焦按钮不会同步；它自己的定位也没有共享组件的 zoom 换算与持续锚点更新。最小修复是保留动态提示文案，在按钮上使用 `data-minecodex-tooltip`，删除私有 tip/CSS/事件；若确需特殊位置，则只保留位置和内容，消费共享 tooltipSurface。

### 2. Images 同一溯源规则有两处实现（P2）

`features/images/src/library-prompt-page.mjs:53–72` 和 `features/images/src/backend/cloud-library.mjs:65–86` 都匹配原始消息、图片指针、生成元数据，并沿最近用户祖先寻找原始请求。两者已经存在差异：当前 Library 面板校验字符串和 trim 后非空；云适配只按 truthy 判断，空白生成提示词不会按同样规则回退。

当前九插件入口不会自动启动历史图库服务，不能把历史云导入差异当成当前面板故障。但它仍属于被维护和打包的规则副本，下一次元数据适配需要两处修改，违背业务事实只有一处的约定。应先决定历史云路径是否继续支持：保留则提取一个自包含纯规则供两条序列化执行路径复用；退役则删除不再需要的规则及接线。不能用 Renderer 中直接 import Node 模块的方式机械合并。

### 3. Images 历史文档仍宣称当前最高优先级（P2）

`features/images/README.md:11–25` 与 manifest 明确说明当前不启用独立图库，旧代码是历史工具。`features/images/HANDOFF.md:4–17` 仍以“当前产品决定（优先级最高）”要求侧栏 Images 入口和本地图库；`features/images/docs/CODEX_DESIGN_LANGUAGE.md` 仍将 26.803 的共用设计取证作为插件设计文档呈现，没有明确的历史资料/非规范标识。

后果：后续 Agent 可能依据旧文档恢复已退出的产品路径，或复制旧共用 token 规则。应将历史证据移入 research/archive 并明确根规范优先，或删除已无用途的规范性段落。历史工具有显式 service 命令，不能只因 manifest 不加载就认定所有文件可以直接删除；需检查实际维护用途后决定保留范围。

### 4. Model Slider 的领域归属尚未完成（声明的暂留项）

`packages/runtime-host/src/codex-injection.mjs:890` 开始维护 modelIdentity；随后维护 providerLabel、brandForModel、模型去重/推理档位、收藏存储和专有交互。宿主应继续拥有 native controller/React 接入，但这些可独立解释的模型规则属于 Model Slider。

根架构末段和 UI 架构已承认此暂留，故不作为违反现有例外的硬错误。若下一轮目标是“所有插件完整归属”，应先抽取纯模型规则和专有安装模块，保留自包含源码与原生控制器生命周期接口；不必重写全部宿主或创建通用模型框架。

### 5. 架构自动检查覆盖仍较窄（P3）

`packages/ui/test/module-boundaries.test.mjs:15–42` 只检查 UI 的顶层静态 imports，以及硬编码的 Sites/Session Status domain imports。它不会验证插件是否重复实现共享组件，也不会覆盖 Images 当前页面中的领域规则或宿主中的模型规则。

这些测试已经有效保护明确的层边界，但 306 项全部通过不等于九插件架构全部通过。后续以真实边界补充检查：自动发现 domain 目录；在领域提取后验证同一纯规则的行为；对声明使用共享 UI 的入口验证实际接入。不要用代码行数或目录数量替代架构验收。

## 已验证和未验证

- 重新运行 `npm test`：306 项通过，0 失败。
- 重新运行 `npm run check`：110 个 JavaScript 文件通过语法检查。
- 当前九个 manifest、实现依赖、共用 UI 接入、卸载路径和相关文档已逐项审查。
- 本次是源码架构验收，未开展新一轮原生 GUI 验收，也未改变日常安装、运行窗口、版本或发布状态。

前一次重构交付可以认定完成了共享组件迁移和主要业务模块归属调整；不能据此扩大成所有插件已经完全遵循新架构。以上缺口关闭前，应保持“部分通过”的结论。


## 修复复验

本节记录随后执行的修复，不追改原始审查事实。

| 原问题 | 当前状态 | 修复证据 |
| --- | --- | --- |
| Sidebar Focus 私有 Tooltip | 已关闭 | `2966521`：删除私有 Tooltip 节点、CSS、定位与事件，提供共享声明式文案。 |
| Images 重复溯源规则 | 已关闭 | `fd0783e`：统一到 `src/domain/library-prompt.mjs`；当前面板通过 sourceFactory 组装，历史云路径序列化同一函数；空白提示词统一回退。有效生成图片无提示词仍可导入，当前面板保持无入口。 |
| Images 旧规范冲突 | 已关闭 | `c0da309`：旧交接与取证移到 `docs/research/images/`，明确为历史记录；当前 README/DESIGN 为有效功能说明。 |
| Model Slider 领域和呈现留在宿主 | 已关闭 | `6a8eb0d`：纯规则归插件 domain；原生控制器、收藏、菜单和滑条归插件 frontend；宿主只组装、刷新、卸载。安装函数和领域函数显式序列化，无 Node imports 泄漏到 Renderer。 |
| 自动架构检查覆盖窄 | 已关闭 | 自动发现所有 domain 目录；检查导入、再导出、动态模块依赖及外部环境引用；检查已注册页面及 frontend 的反向依赖；检查启用插件脚本和 CSS 的 Tooltip 材质重复。 |

**当前结论：九个已注册插件通过本次源码架构复验。** 简单增强仍按规模保持紧凑，不要求空 domain/backend 目录；历史 Images 工具保留显式手动 service 入口，不由当前 manifest 加载，也不恢复独立页面。Summary 仍属于宿主 surface 接入，不是某个插件领域规则暂留。

- 完整测试：317 项通过，0 失败。
- 语法检查：116 个 JavaScript 文件通过。
- 发布包审计：142 个文件，无测试、私有路径或本地数据。
- 实际 `npm pack --ignore-scripts` 后解包验证：Runtime 导入、全部九个 manifest、页面源码工厂、Model Slider 安装源码与领域函数均可加载/编译。
- 本次未重新操作 Codex GUI；工具此前拒绝访问该应用，因此源码/模拟 Renderer 回归及打包证据不算最新原生 GUI 验收。
- 未推送、发布或更新日常安装。
