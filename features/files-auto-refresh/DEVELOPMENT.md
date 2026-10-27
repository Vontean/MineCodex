# Files 自动刷新

独立功能 `files-auto-refresh` 默认开启，与 Markdown 阅读增强、文件级联浏览分别配置、注入和卸载。MCX 控制台卡片紧跟文件级联浏览；中英文名称与说明归 manifest，三项用途说明归 Dashboard 的 `preview-content.js`。图标为 Lucide 0.468.0 的 FolderSync，使用 `icon.resource` 指向 24×24 SVG，ISC 许可随包保留。没有真实演示素材，不注册虚构视频或封面。

## 用户行为与实现选择

用户保持原生 Side Panel → Files 打开，agent 或其他进程新增、删除、移动、重命名目录条目后，列表自动同步。当前文件、展开状态、筛选输入和滚动继续由原生树管理；本功能不改文件内容、不触发文件打开、不覆盖草稿。文件被删除后的正文提示沿用原生行为。

2026-10-28 对 Codex `26.1021.31345`（build `21828`）进行安装源码和独立 profile 验证：目录查询 `workspace-directory-entries` 有 5 秒 staleTime，但过期不自动重读；原生正文监听和目录列表不是同一刷新链路。在已展开的忽略目录中新增 Markdown，2.5 秒后列表未变化；启用增强后，无需重新展开即可显示。

当前未确认可安全复用的目录变化订阅，因此选择直接复用原生目录读取函数与缓存的受限定时刷新，避免新增 Node 文件监听桥和全项目扫描。每轮完成后间隔 1 秒，仅精确重读可见 Files 当前 host/workspace、隐藏文件策略一致且 active 的目录查询；这些查询对应根目录与展开目录。并发最多 4 个，不重叠轮次；原生正在读取时跳过。读取成功且上下文和原生数据版本仍一致时，通过 QueryClient.setQueryData 更新精确缓存，由原生结构共享避免无变化重绘。失败不将原生 query 切入 error，保留现有列表并显示本功能重试入口。网络或大量展开目录时不能保证 2 秒内完成。

## 所有权与生命周期

- `adapters/codex/directories.mjs` 负责可见原生锚点、committed React props、QueryClient 与目录 key；不依赖 bundle hash、压缩变量名或本地路径。
- `refresh.mjs` 负责有界调度、轮次串行、过期结果与隐藏/卸载后的停止。
- `entry.mjs` 负责装配、自检和失败重试入口。正常同步不新增常驻 UI，失败保留原生列表并提供重试；沿用根 DESIGN 的原生控件、字体和颜色。
- `injection-source.mjs` 显式序列化依赖，函数体无 Node 闭包。

只在可见文档和可见 Files 中请求。收起分支后不再刷新 inactive 查询；隐藏整个文档、离开 Files 或禁用功能后停止后续请求并清理观察器、帧和失败控件。本功能的读取使用自己的 AbortSignal，卸载时取消；隐藏或分支收起后的在途结果丢弃。原生自身的读取继续由原生管理，不为卸载本增强而取消其他消费者的请求；精确 query key 与提交前的版本校验隔离 host/workspace 和更新竞态，旧结果不能覆盖新数据。

自检区分没有 Files 场景和目录契约不可用。当前支持 `workspaceFiles.listDirectory` 对应的本地/SSH host 查询；hosted environment 有独立协议，本功能明确标为不可用，不猜测其查询 key。SSH host 未做实机验收。原生模糊搜索是独立会话协议，保留其输入和结果行为；此次不为搜索结果增加额外扫描，清空搜索后显示已同步目录。

## 验证

```bash
node --test features/files-auto-refresh/test/*.test.mjs
npm test
npm run check
npm run pack:audit
```

行为测试覆盖精确 host/root、active 与隐藏策略、忽略正文缓存、并发上限、串行、失败恢复、切换及卸载。真实窗口用独立 profile 和独立 CDP，只加载本功能；验收新增、重命名、删除、目录展开保持、停用后不继续刷新，以及重新启用后的追平。截图和临时文件留 `docs/verification/`，不进入运行包。Dashboard 另外验证中英文卡片、图标响应格式及独立配置保存；静态测试不替代原生窗口或官方 MCP sandbox 验收。

关联需求：[GitHub issue #29](https://github.com/Vontean/MineCodex/issues/29)。
