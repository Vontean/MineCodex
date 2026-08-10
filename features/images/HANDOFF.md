# CodexImageHost Handoff

更新日期：2026-08-07
当前阶段：Phase 0 已验证；精简版 Images 路径索引、图库和详情已实现；Codex 集成已迁移到上层同级的统一宿主 `CodexRuntimeHost`

## 0. 2026-08-07 当前产品决定（优先级最高）

当前第一版已经从“通用 Collections 素材库”收敛成一个清楚的小产品：

- Codex 左侧栏增加 `Images` 入口。
- 自动索引 `~/.codex/generated_images/<thread-id>/<image-item-id>.png`，覆盖不同 Thread 中已经存在和之后新生成的图片。
- 记录原图路径、Thread ID、ImageGen item ID、尺寸、文件大小和时间；打开详情时按需从 Session JSONL 读取真实 `revised_prompt`。不复制图片，不维护第二份 Asset Store。
- 用户不需要“收藏”或“永久保留”。详情区的动作只提供 `Open Thread` 和主操作 `Save as`。
- 原图仍由 Codex 的 generated_images 目录负责保存；SQLite 只是一个很小的路径与来源索引。
- 当前实测目录中有 207 张历史图片、约 298 MB，尚无“Codex 会按运行时长自动清除原图”的证据。因此不预先增加备份机制；如果以后观察到真实清理行为，再依据证据调整。
- Prompt 只使用与 ImageGen item ID 精确匹配的 `image_generation_end.revised_prompt`，无法取得时明确为空，不能从邻近对话猜测；Message ID 和 Model 仍允许为空。
- 独立的 Prompt 素材、摘录、便签、Collection、标签、重新附加图片等是后续可能方向，不属于当前第一版。

如果后文的早期设想与本节冲突，以本节为准。

## 1. 项目背景

这个项目最初来自一个非常具体的 Codex 使用痛点：

- 使用 Codex / ImageGen 生成图片后，图片留在某个会话中。
- 过一段时间想重新找到图片时，很难记得它来自哪个会话、哪一次回答。
- 即使找到图片，也很难同时找回原始 Prompt、上下文、参考图和生成意图。
- 用户也会遇到类似的文本管理问题：某次回答中的一句话、某段 Prompt、代码片段或方法说明很值得保留，但 Codex 当前缺少跨会话摘录和备注能力。
- 用户希望这些个人素材能够集中管理，并且能从 Codex 侧边栏快速打开、复制、插入或重新用于另一个会话。

早期因此把项目设想为一个 **local-first 的 Codex 跨会话个人素材库**。这一方向仍可作为长期假设，但不是当前第一版：当前产品就是自动汇集各 Thread ImageGen 输出的 `Images` 图库。

- Codex Collections
- Codex Shelf / 素材架
- CodexImageHost（当前项目目录名）

最终命名尚未决定。当前目录名为 CodexImageHost，第一版范围只包含图片。

## 2. 产品目标

让用户不必记住图片来自哪个 Thread：在任何 Thread 生成图片后，它都会自动出现在统一的 `Images` 入口中，并可下载或返回来源 Thread。

当前核心价值不是再保存一份文件，而是建立轻量索引：

1. 原图在本机的真实路径。
2. 它来自哪个 Thread 和 ImageGen item。
3. 如何快速查看、下载和返回来源。

以下统一信息模型仅保留为早期长期设想，不属于当前实现：

```text
Codex Collections
├── Image
│   ├── 原图与缩略图
│   ├── 原始 Prompt
│   ├── 参考图与变体关系
│   └── 来源会话 / 消息
├── Prompt
│   ├── Prompt 正文
│   ├── 使用说明
│   └── 生成过的结果
├── Excerpt
│   ├── 回答摘录
│   ├── 代码片段
│   └── 来源会话 / 消息
├── Note
│   ├── 独立便签
│   └── 对收藏项的备注
└── Collection / Board
    └── 混合编排 Image、Prompt、Excerpt 与 Note
```

## 3. 早期长期使用路径（当前不实现）

### 3.1 收藏

理想交互包括两种入口：

1. UI 入口：图片、回答或选中文本旁出现“收藏到…”操作。
2. 对话入口：用户可以直接告诉 Codex：

```text
收藏刚才生成的第二张图片。
把这段回答存到「设计方法」集锦。
把刚才的提示词保存为可复用 Prompt。
新建便签：以后生成封面时不要放文字。
```

### 3.2 找回

期望在 Codex 左侧栏出现“收藏”或“素材库”入口。打开后至少提供：

- 最近收藏。
- 图片、Prompt、摘录、便签和图板分类。
- Collection 与标签筛选。
- 全文搜索。
- 从图片查看原始 Prompt。
- 从收藏项返回来源会话。

### 3.3 复用

每个收藏项应根据类型提供：

- 复制内容。
- 插入当前 Codex Composer。
- 将图片附加到当前会话。
- 打开来源会话。
- 用相同 Prompt 再生成。
- 以收藏图片为参考继续编辑。
- 将图片、Prompt 和备注作为一个上下文包带入新会话。

“复用”是产品成立的关键。如果只能浏览，它会退化成普通素材仓库。

## 4. 当前第一版范围

### MVP 必须包含

1. 启动时扫描所有 Thread 的已有 ImageGen PNG。
2. 运行时监听新 PNG，并自动加入 Images。
3. 保存原图路径与可可靠取得的来源元数据，不复制图片。
4. 支持 All images、Chats 与有图片的 Project 来源筛选，数量来自路径索引的实时汇总。
5. 2–6 列可调的时间倒序瀑布流，首次按内容宽度选择初始列数，之后只记住用户自己的选择；卡片不显示机器 ID，也不提供机器 ID 搜索。
6. 支持按 Thread 聚合为纵向图板；图板详情的左侧选择带只包含该 Thread，关闭详情即返回原来的筛选与滚动位置。
7. 46px 标题栏不参与滚动；图片按 36 张一批加载，滚动条最小抓取高度为 48px。
8. 右侧详情占约 80%，左侧图库收成约 20% 的单列图片选择带；详情显示完整原图、真实 Prompt 与可靠元数据。
9. 通过 `Save as` 调用 macOS 系统保存面板保存原图，并可通过 `Open Thread` 打开来源 Thread。
10. 独立 Web UI 可用；CDP 侧边栏由同级 `CodexRuntimeHost` 统一提供，仍是可替换的 Codex Adapter。

### 第一版暂不包含

- 项目管理、Issue 看板或任务调度。
- 团队权限与多人协作。
- 云同步。
- 原图备份、Asset Store 和永久保留动作。
- AI 自动标签和自动摘要。
- Pinterest 式无限瀑布流推荐。
- Figma / Freeform 式无限画布。
- 复杂的图片版本树。
- 独立 Prompt 素材、Excerpt、Note、Collection、标签和 Composer 附加。

## 5. 推荐技术架构

不要让 CDP 注入层成为数据源。推荐把产品分成稳定核心和可替换的 Codex 集成层：

```text
CodexImageHost
├── SQLite
│   └── images（路径与来源索引）
├── ImageLibrary
│   ├── 初次扫描 generated_images
│   └── 监听新图片
├── HTTP API
├── 无框架 Web UI
└── codex-feature.json

../CodexRuntimeHost
├── sibling feature discovery
├── CDP sidebar injector
├── shared Surface + Theme Bridge
└── Thread navigation bridge
```

建议原则：

- `~/.codex/generated_images` 中的 PNG 是图片字节的 Source of Truth。
- SQLite 只记录路径与来源元数据；实测 207 张图片的索引约 152 KB，而原图约 298 MB。
- 统一宿主只负责功能入口、Surface、Theme Bridge 和 Thread 导航，不负责图片数据。
- 不做内容哈希、缩略图缓存、Trash、标签，统一宿主也不吸收各功能的业务逻辑。
- 文件被外部删除时，监听或重新扫描会从索引移除对应记录。

### 5.1 建议的收藏项字段

字段名只作为方向，下一步应根据真实 ImageGen / Codex 数据验证后定稿。

```text
item
  id
  type: image | prompt | excerpt | note
  title
  text_content
  asset_id
  favorite
  created_at
  updated_at
  deleted_at

source
  item_id
  codex_thread_id
  codex_message_id
  source_kind
  source_url_or_route
  captured_at

image_metadata
  item_id
  original_prompt
  model
  width
  height
  mime_type
  variant_group_id
```

## 6. 官方 Plugin 能力边界

截至当前调研，OpenAI 公开 Plugin 系统可以提供：

- Skills。
- MCP 工具和结构化结果。
- MCP UI Resource。
- Inline UI。
- Fullscreen UI。
- Picture-in-picture UI。
- Host-controlled modal。

但公开 API 没有允许第三方 Plugin 注册 Codex 左侧栏导航项的 contribution point。也没有类似 VS Code 的 `contributes.views` 或 `contributes.sidebar` manifest 字段。

因此，官方 Plugin 可以承担数据操作、搜索、收藏命令和全屏素材库 UI，但无法单独实现一个常驻 Codex 左侧栏入口。

官方参考：

- Plugin Architecture: https://developers.openai.com/plugins/concepts/plugins
- Add UI to an MCP server: https://developers.openai.com/plugins/build/chatgpt-ui
- Plugin UI Reference: https://developers.openai.com/plugins/reference
- Codex / ChatGPT Plugins: https://learn.chatgpt.com/docs/plugins

推荐策略：

- 核心能力优先做成 HTTP API + CLI/MCP/Skill。
- Web UI 独立可用。
- 如果需要官方 UI，提供 Inline / Fullscreen 版本。
- 精确的左侧栏入口作为可选 CDP 增强层，不与核心数据耦合。

## 7. CDP 侧边栏注入参考：dashi-taskboard

主要参考项目：

- Repository: https://github.com/chuspeeism/dashi-taskboard
- Inspected commit: `677b54451db707ae6132486b6593b7be11e4ee09`

dashi-taskboard 不是通过官方 Sidebar API 注册页面，而是利用 Codex 桌面端基于 Electron / Chromium Renderer 的事实，通过 Chrome DevTools Protocol（CDP）在运行时注入脚本并修改 DOM。

### 7.1 完整注入链路

```text
以 remote-debugging-port 启动 Codex
        ↓
Injector 查询 /json/list
        ↓
连接 Codex Renderer 的 CDP WebSocket
        ↓
Page.setBypassCSP + Runtime.enable
        ↓
Page.addScriptToEvaluateOnNewDocument
        ↓
注入脚本寻找 Plugins 侧边栏按钮
        ↓
克隆按钮并插入 Taskboard 入口
        ↓
点击后隐藏原生主内容，挂载本地 iframe
        ↓
postMessage + Runtime.addBinding 建立宿主桥
        ↓
MutationObserver 在 React 重渲染后重新挂载
```

### 7.2 启动 Codex 调试端口

dashi 使用类似以下参数启动单独的 Codex / ChatGPT 桌面实例：

```bash
open -n -a /Applications/ChatGPT.app --args \
  --remote-debugging-port=9231 \
  --remote-allow-origins=http://127.0.0.1:9231
```

参考源码：

- Launcher parameters: https://github.com/chuspeeism/dashi-taskboard/blob/677b54451db707ae6132486b6593b7be11e4ee09/scripts/codex-injector.mjs#L191-L204
- Codex target discovery: https://github.com/chuspeeism/dashi-taskboard/blob/677b54451db707ae6132486b6593b7be11e4ee09/scripts/codex-injector.mjs#L302-L310

Injector 从 `http://127.0.0.1:<port>/json/list` 获取 Target，筛选 `app://` 页面或标题为 Codex 的页面，再连接 `webSocketDebuggerUrl`。

### 7.3 注入与 CSP

核心 CDP 调用包括：

- `Page.enable`
- `Page.setBypassCSP({ enabled: true })`
- `Runtime.enable`
- `Runtime.addBinding`
- `Page.addScriptToEvaluateOnNewDocument`
- `Runtime.evaluate`
- `Page.reload`

参考：

- Injection registration and lifecycle: https://github.com/chuspeeism/dashi-taskboard/blob/677b54451db707ae6132486b6593b7be11e4ee09/scripts/codex-injector.mjs#L1032-L1120

Codex Renderer 的 CSP 会阻止任意 HTTP iframe。dashi 使用 `Page.setBypassCSP` 后再加载本地 Taskboard iframe。这是高权限操作，也是主要安全风险之一。

### 7.4 注入侧边栏按钮

注入脚本：

1. 查找 `[data-app-action-sidebar-scroll]`。
2. 查找文本为 `插件` 或 `Plugins` 的按钮。
3. 使用 `cloneNode(true)` 克隆原生按钮。
4. 清理按钮上的原生状态属性。
5. 改写 label 和图标。
6. 使用 `reference.after(entry)` 插到 Plugins 后面。

参考：

- Find and clone reference button: https://github.com/chuspeeism/dashi-taskboard/blob/677b54451db707ae6132486b6593b7be11e4ee09/inject/codex-taskboard.user.js#L213-L277
- Insert sidebar entry: https://github.com/chuspeeism/dashi-taskboard/blob/677b54451db707ae6132486b6593b7be11e4ee09/inject/codex-taskboard.user.js#L289-L299

这种做法能继承 Codex 侧边栏已有布局和视觉样式，但依赖非公开 DOM 结构和文案，Codex 更新后可能失效。

### 7.5 挂载主内容 iframe

dashi 定位以下宿主区域：

- `.app-shell-main-content-frame`
- `[data-app-shell-main-content-layout]`

然后保留原生侧边栏，隐藏当前主内容与 Header，在主 Surface 下挂载一个绝对定位 Section，并在其中加载本地 React 应用 iframe。

参考：

- Main surface discovery: https://github.com/chuspeeism/dashi-taskboard/blob/677b54451db707ae6132486b6593b7be11e4ee09/inject/codex-taskboard.user.js#L301-L324
- iframe creation: https://github.com/chuspeeism/dashi-taskboard/blob/677b54451db707ae6132486b6593b7be11e4ee09/inject/codex-taskboard.user.js#L940-L964
- Native content replacement: https://github.com/chuspeeism/dashi-taskboard/blob/677b54451db707ae6132486b6593b7be11e4ee09/inject/codex-taskboard.user.js#L1112-L1132

### 7.6 iframe 与宿主通信

两层通信机制：

1. iframe 与注入脚本之间使用 `window.postMessage`，并校验 `event.source` 与 `event.origin`。
2. 注入脚本与外部 Node Injector 之间使用 CDP `Runtime.addBinding`。

参考：

- iframe messages: https://github.com/chuspeeism/dashi-taskboard/blob/677b54451db707ae6132486b6593b7be11e4ee09/inject/codex-taskboard.user.js#L788-L819
- CDP host binding: https://github.com/chuspeeism/dashi-taskboard/blob/677b54451db707ae6132486b6593b7be11e4ee09/scripts/codex-injector.mjs#L925-L966

CodexImageHost 可考虑暴露以下宿主桥动作：

- `ensure-service`
- `capture-host-context`
- `open-thread`
- `prefill-composer`
- `attach-image`（需要先验证可行性）
- `capture-current-selection`
- `capture-current-message`
- `capture-current-image`

最后三个动作不能直接假设可行，需要先证明 Codex 当前 Renderer 中的真实 DOM、资源 URL 和 Message 标记。

### 7.7 防止 React 重渲染清除入口

dashi 对文档安装 `MutationObserver`，监控 DOM、主题和侧边栏状态变化，必要时重新挂载按钮、页面和宿主上下文。

- Reattach observer: https://github.com/chuspeeism/dashi-taskboard/blob/677b54451db707ae6132486b6593b7be11e4ee09/inject/codex-taskboard.user.js#L1184-L1217

CodexImageHost 可以参考这种恢复机制，但应尽可能减少选择器数量，并为每个依赖的 DOM marker 建立明确的兼容性检查。

## 8. 建议如何借鉴 dashi，而不是直接复制

可以复用的架构思想：

- 专用 Codex 实例 + 专用 CDP 端口。
- Resident Injector 常驻监控 Renderer。
- Document-start userscript。
- 克隆原生按钮以获得一致外观。
- 主区域 iframe。
- `postMessage` + CDP Binding 桥。
- MutationObserver 恢复挂载。
- Web 服务故障时由 Injector 负责健康检查和重启。

不应照搬的部分：

- dashi 的 Issue、Project、Workflow 和自动任务数据模型。
- dashi 特定的 Taskboard 文案、DOM ID 和宿主消息名。
- 未经验证的 Codex Composer 操作细节。
- 将 Renderer DOM 当作稳定公共 API。

注入层现已落实为同级的独立 `CodexRuntimeHost`：

```text
../CodexRuntimeHost/
├── feature registry
├── launcher + CDP client
├── renderer injector
└── shared Surface + Theme / Thread bridge
```

每个同级功能项目只提供 `codex-feature.json` 与本地页面。未来 Codex DOM 变化时，只需要更新统一宿主，不影响各功能核心。

## 9. 安全与可靠性边界

CDP 方案需要明确标为可选增强功能，而不是无风险的官方集成。

- CDP 对 Renderer 权限很高。
- dashi 明确警告 CDP 对本机其他进程没有认证保护。
- 应绑定 loopback，不允许从 LAN 或公网访问调试端口。
- 优先启动单独的 Codex 实例，不影响用户日常主窗口。
- 只允许可信本地 iframe origin。
- 所有 `postMessage` 必须检查 `source` 与 `origin`。
- 不要在注入脚本中存储 API Key、Token 或其他凭据。
- CSP bypass 会降低 Renderer 的原有隔离保护。
- 不修改 `ChatGPT.app`、`app.asar` 或 Codex 数据文件。
- 如果需要读取 Codex 本地数据，必须先定位官方或稳定接口；直接读取内部数据库只能作为只读、可撤销、经过用户确认的研究路径。
- 第一版不提供删除动作，也不修改 generated_images 中的原始文件。

## 10. Phase 0 已确认的技术事实

Phase 0 已通过只读 Feasibility Spike 回答主路径问题：

1. Renderer 使用 `app://fs/@fs/<absolute-path>`，可稳定反解到 `~/.codex/generated_images/...png` 的本机原图。
2. 结构化 Thread 读取可取得 Thread ID、Turn ID、ImageGen item ID 和 revised Prompt。
3. Message ID 与 Model 不能可靠取得，必须允许为空。
4. 反解后的本机文件就是原始分辨率 PNG，已做逐字节哈希对照。
5. `codex://threads/<thread-id>` 可以打开来源 Thread。
6. 当前产品不需要重新附加进 Composer，因此不继续扩张这一验证。
7. Images 的自动收集直接监听本机路径，不依赖消息 DOM。
8. 当前没有发现 Codex 按运行时间清理历史原图的证据；第一版先索引，不复制。

Spike 的交付物应是：

- 一份当前 Codex 版本的 DOM / Resource 证据记录。
- 一张真实操作链路：入口 → 用户动作 → 数据取得 → 本地保存 → 可观察结果。
- 最小只读脚本或手动证据，不要立即做长期兼容层。
- 对每个候选捕获路径标注：官方、稳定内部接口、DOM 推断或高风险 CDP。

## 11. 建议实施顺序

### Phase 0：可行性验证

- 启动隔离的 Codex 实例和 CDP 端口。
- 观察真实 ImageGen 消息 DOM 与网络资源。
- 保存一张原始图片到临时目录。
- 记录 Thread / Message / Prompt 可获取程度。
- 验证能否打开来源会话和重新附加图片。

### Phase 1：精简 Images 产品

- 单表 SQLite 路径索引。
- 初次全量扫描与运行时监听。
- HTTP API 和原图下载。
- 可筛选、2–6 列密度的瀑布流、Thread 图板和 20/80 详情布局。
- 从 Session JSONL 按 ImageGen item 按需读取真实 Prompt。
- 打开来源 Thread。

### Phase 2：Codex 入口

- 独立 Codex 实例和 loopback CDP。
- 克隆原生 Plugins 入口形成 Images。
- iframe 图库和 Thread 导航桥。
- Renderer 重绘后的重新挂载。

### Phase 3：验证与交付

- 验证 207 张现有图片都被索引，且索引目录没有图片副本。
- 验证不同 Thread 新图片会自动出现。
- 验证 `Save as` 返回原始 PNG、图片选择带和详情交互。
- 保留独立 Web UI 作为注入失效时的简单入口。

## 12. MVP 验收标准

- 用户在任何 Thread 生成一张图片后，无需点击收藏，它会自动出现在 Images。
- 已有历史 ImageGen 图片会在首次启动时进入索引。
- Images 直接展示完整画幅；列表只显示时间，不把 Thread / ImageGen ID 暴露给用户。
- 列表按时间倒序，可在 2–6 列间调整并由当前内容宽度推荐默认值；详情打开后左侧变成单列图片选择带，右侧约占 80%。
- 可以按 All images、Chats 或 Project 筛选，并按 Thread 聚合；进入图板后只浏览该 Thread 的图片，关闭详情时保持筛选、聚合状态与滚动位置。
- 标题栏固定在滚动区外，滚动条从标题栏下方开始；首批只渲染 36 张，接近底部时再追加下一批。
- 详情显示与 ImageGen item 精确匹配的真实 Prompt、时间、尺寸和文件大小；缺失 Prompt 不伪造。
- 可以通过 `Save as` 打开系统保存面板并保存原始 PNG。
- 可以通过 `Open Thread` 打开来源 Thread。
- 索引目录不保存图片副本，服务不会修改原图。
- 注入层失效时，独立 Web UI 仍可使用。
- 不修改官方应用安装包和 Codex 数据文件。

## 13. 建议后续 Agent 使用的 Skills

- `$openai-docs`：在依赖 Codex Plugin、App Server、MCP UI 或桌面端能力前核对当前官方文档。
- `$diagnosing-bugs`：用于 ImageGen 资源、CDP Target、CSP、iframe 或 Composer 集成的真实故障定位。
- `$product-design:index` / `$product-design:ideate`：在进入 UI 实现前生成并选择素材库的视觉方向。
- `$frontend-design`：实现或调整 Images 图库和详情 Inspector。
- `$playwright`：验证独立 Web UI 的图片瀑布流、详情与响应式布局。

若以后扩展 Prompt / Collection 等能力，应先取得新的明确产品决策，不要默认恢复早期大范围设想。

## 14. 建议下一会话的起始任务

```text
阅读 HANDOFF.md 顶部的当前产品决定和根目录 README.md。

先复查 `CodexImageHost` 与同级 `CodexRuntimeHost` 的工作区状态，再分别运行测试，并从 `CodexImageHost` 执行 npm start，验证统一宿主发现 manifest、自动索引、Images UI、下载、来源 Thread 导航及 Codex 侧边栏注入。不要恢复 Asset Store、收藏按钮、Collection 等早期范围。

未经用户单独授权，不要 commit、push、安装 LaunchAgent 或修改 ChatGPT.app。
```

## 15. 当前状态

- 已新增只读 Phase 0 CDP 探针、证据文档、结构化 metadata 和一份逐字节验证过的测试原图。
- `CodexImageHost` 与同级 `CodexRuntimeHost` 都已初始化独立本地 Git；尚未提交或配置远端。
- 已实现零第三方依赖的单表 SQLite 路径索引、全量扫描、运行时监听、HTTP API 和独立 Images UI。
- 已把 Codex CDP Adapter 抽离为同级 `CodexRuntimeHost`：统一发现功能 manifest、启动本地页面、注册侧边入口、管理 iframe Surface、Theme Bridge 和来源 Thread 导航；Images 项目不再持有 CDP 代码。
- 已修复首次实现中的 CSP 屏蔽页：按 dashi-taskboard 的已跑通路径启用 CSP bypass、注册 document-start 脚本、受控 reload 主 Renderer、等待加载，并保持 CDP 连接常驻。
- Images 已改为遵循 Codex 当前设计语言：运行时同步 resolved semantic tokens，支持 light / dark 与自定义 accent；不再使用早期的杂志化独立视觉。
- Images 标题栏与详情标题栏均为原生实测的 46px；详情标题栏不使用底边，Refresh 在工作时切换为旋转的 Lucide ring 并至少保持 1 秒，侧栏 Images 使用独立的 Image 图标，不再与 Plugins 重复。
- 图库按时间倒序，使用保持 DOM 顺序的 2–6 列 Grid masonry，首次按实际内容宽度选择初始列数，之后不再自动更改；横向列间距和纵向卡片间距都固定为 16px，并用 1px 行精度避免间距取整误差。卡片显示来源 Project 或独立 Chat 与时间，不显示机器 ID 或搜索框；底栏使用 Codex 的 `--color-background-panel`，当前暗色主题解析为 `#232323`。
- 主标题下新增固定工具栏：All images、Chats 与有图片的 Project 显示实时数量并进行服务端筛选；Grid density 使用无描边 4px 轨道的工具栏内联滑条，手动值保存在当前 WebView，不提供 Auto；Thread 聚合按钮把同一 Thread 的图片组成纵向图板。
- 点击 Thread 图板后，左侧约 20% 只显示该 Thread 的图片并按生成时间正序，右侧约 80% 继续使用 Image details；不再显示额外 Back，Close 会恢复图板列表、来源筛选、聚合状态与滚动位置。
- 来源索引读取 Codex 当前 `projectless-thread-ids`、`local-projects`、`thread-project-assignments`、`session_index.jsonl` 与 `state_5.sqlite`：Project 卡片显示 Project 名称，独立 Chat 卡片显示 Thread 名称；详情 Information 对 Project 图片展开 Project + Thread 两层。`threads.archived` 会同步进图片索引，归档来源禁用 `Open Thread` 并提供悬浮说明。
- 服务启动会补扫并刷新元数据，运行时继续监听新图。手动 Refresh 只补扫来源、更新数量与 Archive 状态；详情打开时不重建当前图片带，普通浏览时也保留筛选、聚合、滚动位置和列数。
- Images 固定在 `Sites` 下方、`Scheduled` 上方；打开时统一暂存并清除其他原生导航与 Task 的 active 状态，只保留一个 `aria-current="page"`，退出 Images 后恢复 Codex 原状态。
- 主标题栏位于独立滚动区之外；API 与前端按 36 张分页加载，首屏不再创建全部 207 个卡片节点，滚动条 thumb 最小高度为 48px。
- 详情不再使用中心弹窗：打开后左侧约 20% 成为单列图片选择带，右侧约 80% 展示完整原图、真实 Prompt 和可靠元数据；Prompt 标题右侧提供视觉权重明确的 Copy → Check 两秒反馈，Information 的 Project / Thread 值不重复使用来源图标。
- 已把 Images Surface 固定在 Codex 内容层 `z-index: 40`；原生 `z-index: 50` 帮助菜单可以完整覆盖 iframe，`overlay-check` 已固化这一回归验证。
- CSP 注入链路采用 `Page.setBypassCSP → document-start script → 订阅 Page.loadEventFired → reload → explicit evaluate`；Watch 循环严格串行，入口由 Renderer 内的 MutationObserver 等待原生侧栏，避免启动页上的并发等待与重复 reload。该生命周期对照了 dashi-taskboard 当前 `codex-injector.mjs`，没有引入其 daemon、heartbeat 或自动化业务。
- 已证明当前版本 ImageGen 原图可从 Renderer 的 `app://fs/@fs/<absolute-path>` 映射到本机源文件，并复制为 SHA-256 与源文件完全一致的 PNG。
- 已证明并实现从本机 Session JSONL 按 Thread / ImageGen item 精确读取 `image_generation_end.revised_prompt`，详情按需加载后缓存到 SQLite；Message ID 与 Model 仍需允许为空。
- `Open Thread` 优先点击 Codex 原生、带精确 Thread ID 的侧栏行完成宿主导航，避免隐藏 Images 时恢复到先前的 Scheduled 等选中项；不可见行才退回 `codex://threads/<threadId>` 外部协议路径。
- `Save as` 已改为由本机服务调用 macOS `choose file name` 系统面板，用户选择目录和文件名后才复制原始 PNG；取消不会写入文件。
- 当前产品不复制图片；上面的 Phase 0 复制只是一次原图一致性证明，不是产品存储策略。
- 实测可索引 207 张历史图片；原图约 298 MB，索引数据库约 152 KB。
- `frame-check` 已验证 Images iframe 作为 `http://127.0.0.1:47831/` OOPIF 真正加载，而不只是存在一个 iframe DOM 节点。
- 详细证据见 `spikes/phase0/README.md`；运行与结构说明见根目录 `README.md`。
