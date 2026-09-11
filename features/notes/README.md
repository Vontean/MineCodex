# CodexNotes

CodexNotes 是一个完全本地的 Codex 个人调用层：在当前对话右上角通过一个
Notes Toolbar Button 快速查看 Todo、Prompts 和 Files；单个分区超过 5 条时才会
显示 `View all`，并通过 RuntimeHost 在 Codex 原生右侧工作区打开互不重复、跟随
当前 Task 的完整 Tab；内部 capability 不可用时显示明确错误。

目标交互与 Codex 原生 Summary 一致：窄空间使用 `Toggle notes` Popover，
宽空间使用 `Toggle pinned notes`，并在 `shift` / `gutter` 模式中参与对话
布局。视觉、间距、圆角、阴影和高度规则使用 Host resolved tokens 与原生
Summary contract，详见 `PRD.md`。

当前本地实现已经完成响应式 Summary realignment：`overlay / shift / gutter`
状态、Toolbar 文案、对话布局位移、Popover 定位、自然高度与单一内滚动区均由
RuntimeHost 和同一份 Summary 内容组件协作完成。

所有用户可见的页面文案、按钮标题、ARIA 标签、Toast 与错误提示均支持 English / 简体中文；
嵌入 Codex 时跟随 RuntimeHost 传入的客户端语言，独立打开时跟随 URL `locale` 参数或
浏览器语言。功能 manifest 同时提供两种语言，协议 action id 保持稳定且不参与翻译。

产品数据与 Web UI 独立于 Codex 客户端运行。Codex 中的 Toolbar、Pinned
Summary、Tabs、Composer 插入和原生附件结果由同级的
`../CodexRuntimeHost` 统一适配；这是一层可替换的非官方 CDP / private React / DOM
Adapter，不是公开的 Codex Contribution API。

## 本地运行

需要 Node.js 22.5 或更高版本。

```bash
npm install
npm start
```

默认地址是 `http://127.0.0.1:47832/`，可直接访问以下 Surface：

- `/?surface=summary`
- `/?surface=todo`
- `/?surface=prompts`
- `/?surface=files`

默认数据库位于：

```text
~/Library/Application Support/CodexNotes/codex-notes.sqlite
```

开发时可以通过环境变量隔离数据与端口：

```bash
CODEX_NOTES_DATA_DIR=/tmp/codexnotes-dev \
CODEX_NOTES_PORT=47832 \
npm start
```

`CODEX_NOTES_DATABASE` 可以直接指定数据库文件；`CODEX_NOTES_HOST` 只允许
`127.0.0.1`、`localhost` 或 `::1`，避免无认证的本地能力被暴露到局域网。
数据库文件启动时会收紧为仅当前用户可读写（`0600`）。

## 在 Codex 中运行

`codex-feature.json` 声明了 Conversation toolbar 入口、Pinned Summary、三个
Detail Tab 和允许使用的 Host actions。共享宿主会扫描同级项目并在服务离线时
执行本项目的 `command`：

```bash
cd ../CodexRuntimeHost
npm start
```

CodexNotes 不拥有 Injector，不修改 ChatGPT 应用包，也不读取其他功能项目的
数据库或 API。

## 数据语义

- Todo 是无日期、无提醒、无 Agent 自动写入的手动清单；拖拽顺序持久化。
- Todo 摘要最多显示 5 条，Active 优先；未满时由 Completed 补足，并以填充勾选、删除线和弱化文字呈现。单击主条目或圆形 Checkbox 都切换完成状态，Edit 与 Delete 是悬浮次操作。
- Prompts 保存可选标题与必填多行纯文本；单击主条目直接 Insert，Edit 与 More 是悬浮次操作；Insert 或编辑成功后更新最近使用。
- Prompts 使用 Star / Unstar 标记常用内容；所有条目都保留相同的 18px leading slot，Star 图标与 Files 类型图标共享 16px、secondary 灰色和相同 leading 间距。
- 现有 SQLite 会在启动时把 `notes` 表及其 `pinned` 字段原地迁移为 `prompts` / `starred`，保留全部历史数据。
- Files 只保存用户主动固定文件的 canonical absolute path 和元数据，不复制字节。
- Summary 中的图片缩略图通过流式响应读取，支持 ETag / `304 Not Modified`，并拒绝超过 64 MiB 的预览请求；普通状态刷新不会重复等待全量文件扫描。
- 单击文件名会 Attach：优先产生 Codex 原生附件，失败时由 Host 明确降级为 Composer 路径插入。
- 行内 External Link 次操作会在 macOS Finder 或 Windows Explorer 中显示并选中磁盘源文件；CodexNotes 不提供文件重命名。
- 取消固定永远不删除、移动或改写磁盘源文件。
- 一个 SQLite writer 和 SSE revision stream 为所有 Surface / 窗口提供同一份状态。

## 验证

```bash
npm test
npm run check
```

产品验收与 Host 验收记录见 [IMPLEMENTATION_AUDIT.md](./IMPLEMENTATION_AUDIT.md)，
当前实现证据与接手说明见 [HANDOFF.md](./HANDOFF.md)，Phase 0 的非官方接口分类见
[spikes/phase0/README.md](./spikes/phase0/README.md)。
视觉对照与阻断级问题结论见 [design-qa.md](./design-qa.md)。
后续视觉修改应先查阅 [codex-design-tokens.csv](./codex-design-tokens.csv)：该表区分
Codex 原生 token、项目派生语义和 Summary / Commit 的组件级固定值，避免把不同
surface 的圆角、阴影或交互状态混用。

## 当前边界

第一版没有搜索、标签、独立文件预览器、自动索引、云同步、账号、Undo、自动备份或
Today’s images 聚合。完整范围以 [PRD.md](./PRD.md) 为准。
