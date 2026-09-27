# Prompts

导航栏扩展区最后的 **Prompts** 页面管理提示词；输入框 Add 与权限按钮之间的 **Quick Prompts** 只浏览和调用。

## 管理页面
- All 与分类 Tabs，搜索、新增、编辑、删除。
- 默认分类：生图、编程、文案、研究、翻译、效率；支持新增、改名、删除与排序。
- 分类图标和颜色复用 Codex 原生 SymbolBrowser 的资源。单条提示词可设置一个 Emoji，否则继承分类图标。
- 使用右侧三横手柄拖拽调整组内顺序，也可按调用次数、最近调用排序。
- 删除分类会将提示词移至其他，保留正文、Emoji 和统计。

## 快速调用
- Tooltip 为 Quick Prompts；面板不显示重复标题或管理操作。
- 最近实际调用的 3 条排在最上面，然后按分类和手动顺序显示全部提示词。最近项目仍保留在所属分类；空分类隐藏。
- 点击只插入当前输入框，保留草稿，不发送消息。
- Escape、点击外部、切换会话或打开原生 Add 面板会关闭；方向键移动焦点。

## 统计与存储
只有成功插入输入框后才增加一次调用计数，并更新最近调用时间。浏览、编辑、创建、复制和排序不增加计数。SQLite 持久保存 `use_count` 与 `called_at`；历史次数未知，从 0 开始，不从旧的更新时间推算。切换页面和重启不会清零。

功能 ID 仍为 `notes`，沿用已有配置开关、CodexNotes 数据库和提示词。新增分类、Emoji、排序和统计字段；保留历史 Todo / Files 数据，不删除用户文件。原有收藏标记保留，但不参与新界面排序。

运行入口为 `src/main.mjs` → `quick-prompts-server.mjs`，仅开放提示词、分类、排序、调用记录及健康检查。页面经已认证 Runtime Host binding 访问固定允许的接口。旧 HTTP 服务、网页、Todo / Files 操作及文件清理代码已删除。`prompt-schema.mjs` 只负责向前迁移；`product.mjs` 负责提示词、分类和统计的事务读写。历史 Todo / Files 表保持原样。

服务仅监听 loopback，默认端口 47832。沿用 CODEX_NOTES_PORT、CODEX_NOTES_DATA_DIR、CODEX_NOTES_DATABASE。设计依据见 [DESIGN.md](./DESIGN.md)。入口采用 Lucide book-open，拖拽手柄采用 Lucide menu。分类 SVG 来自当前 Codex 原生图标目录，未手绘替代路径。
