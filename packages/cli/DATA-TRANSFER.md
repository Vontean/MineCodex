# 数据迁移契约

GUI 页脚打开数据迁移弹窗；导出与导入是手动文件迁移，不是云同步。文件名后缀为
`.mcx.json`，UTF-8 JSON，上限 16 MiB；含 format=`minecodex-data`、version=1、appVersion、
exportedAt 和 features。格式版本与产品版本分离。未知总版本、功能 ID 或领域版本在写入前拒绝。
文件包含用户正文，下载不包含密钥、登录态、设备路径或图片字节。

## 适配接口

组合入口 `service.mjs` 注册领域适配器，不解释业务记录。每个适配器提供：

- `id`：功能 ID，稳定且唯一。
- `snapshot()`：返回白名单字段组成的 `data`、可迁移 `count`、排除 `excluded` 及必要的领域计数；只读不创建数据。
- `validate(data)`：检查版本、类型、数量、身份和引用，返回净化后的领域数据；不能写文件。
- `preview(data)`：返回 `added/duplicate/conflict`，可增加领域计数；不能产生副作用。
- `apply(data)`：锁内重新读取并合并，返回实际计数；同一文件可重复导入。

新功能在所属 `features/<id>/src/backend/` 实现协议并注册，补充面板的字段与排除说明、
往返/冲突/错误验证，以及 npm files（已包含功能 src 的无需另列）。不把原始 SQLite 或
Renderer localStorage 整份拷贝到迁移文件。后端依据 FEATURE_IDS 提供全量盘点；面板只显示已注册的可迁移功能，
功能限制通过 info 提示说明，其余功能仅保留在本文的数据盘点中。

## 合并和事务

默认只补缺，不覆盖、不删除。本机相同身份但内容不同的记录保留并计为冲突。
Prompts 根据稳定 ID 及 title/body/category/emoji 去重；使用计数和时间不跨机器累加。
分类同 ID 保留本机值；不同 ID 但 name/icon/color 相同则映射到本机分类。
同 ID 分类内容不同计冲突，引用仍落在该本机分类。新记录保留来源排序及计数。
Sites 根据 ID 和规范化 URL 去重，导入后 origin=external，不保留项目或线程身份。
模型收藏以完整模型标识做集合并集；不同 provider 的同名模型不匹配，不能使用显示名称别名。
本机缺少的模型保留记录，不生成可选项；本机以后出现相同 ID 时恢复收藏。迁移不改变当前模型、
档位或 provider 配置。

每个领域独立事务，不承诺跨功能原子性。导入前全量验证；执行失败逐项返回 failed，
保留已完成结果，允许安全重试。SQLite 用事务；Sites 用 SQLite 协调跨进程写锁（进程退出自动释放），JSON 数据经原子替换。
导入不启动站点、不请求网址、不修改开关、不重启 Codex。预检结果与实际结果可能因并行编辑不同。

GET /api/data：全量功能清单；GET /api/data/export：附件下载；
POST /api/data/preview 和 POST /api/data/import：预检与执行。
沿用 control-server 的 token 鉴权，POST 额外校验 Host 和 Origin；请求体限制 16 MiB。

## 全功能数据盘点（2026-10-05 源码）

| 功能 | 数据所有者 | 处理 |
| --- | --- | --- |
| Prompts | CodexNotes SQLite：prompts、prompt_categories | 迁移正文、分类、emoji、顺序、计数与时间；不带历史 Todo/Files；cards/list 偏好留本机 |
| Model Slider | backend/favorites.mjs SQLite；旧 Renderer favorites key | 迁移模型收藏；首次启动由受限 host action 收录旧收藏，后端成为权威；Fast SVG 缓存不迁移 |
| Sites | sites.json、project-history.json、previews | 只迁移公网 HTTP(S) 网址与标题；本地/内网地址、项目路径、启动命令、预览与发现历史不迁移 |
| Images | image-library SQLite、图片文件、local-image-source 隐藏/上传关联；iframe 密度 | 本机文件与账号身份不可仅靠索引复原，本期不迁移；图库密度留本机 |
| Session Status | Codex JSONL、展开偏好 | 日志为原生数据，用量派生；展开偏好留本机 |
| Usage Meter | 当前账号额度读取 | 无独立持久化内容，不导出账号数据 |
| Hide Upsell Banner | 注入生命周期 | 无独立内容 |
| Quick Chat | 原生经典聊天与呈现状态 | 无独立内容，不复制或导出聊天历史 |
| Sidebar Focus | 原生侧栏状态 | 无独立内容，不改变原生偏好 |
| Markdown Reading | 原文档及渲染状态 | 不保存文档副本，无独立内容 |
| File Navigation | 本机目录与原生导航 | 无独立内容，不打包文件系统 |

公共 feature 开关、GUI 语言/外观留本机；已停用 unread-inbox 的内存状态不迁移。
模型收藏首次收录前显示未收录原因，不把空后端当成原窗口没有收藏。
导入后的模型收藏下次 Codex 启动载入；Prompts/Sites 重新打开功能读取最新值。
本次开发与验收使用隔离目录，未接入日常窗口执行初始化。
