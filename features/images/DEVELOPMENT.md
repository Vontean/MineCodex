# Images · Image Gen 与图片提示词

Images 按当前账号接入原生页面：Plus 使用 **Library**，Pro 使用 **Space → Images**，并增加 **Image Gen**，集中浏览本机 Codex 或本地 Work 生成的图片。

- Image Gen 位于 Your creations、Uploads 后，图片按生成时间倒序显示，支持搜索和滚动加载。
- 标签、加载骨架、图片排布、悬浮卡片和菜单复用原生组件。
- 点击图片进入原生详情，复用缩放、打开、下载以及可用的 Remove BG、Erase、Resize 编辑入口。
- 本地图库菜单支持 Chat about this、Add to Favorites、Download、Add to folder、Delete 和 View prompts。仅点击收藏／文件夹操作才上传所选图片到原生 Library，浏览不上传；云端收藏和文件夹关系由服务器管理。
- 图片菜单中的 **View prompts / 查看提示词** 打开与原生 File info 一致的右侧面板；加载时显示骨架并禁用复制。
- 本地图片按精确生成记录读取提示词。云端图片优先显示真实生成提示词；只有原始用户请求时，明确告知差异并标注 Original request，再提供复制。
- 切换图片会移除旧提示词；Escape 先关闭提示词面板。

索引在当前 Runtime profile 中维护，读取本机生成目录与会话日志，不迁移或删除源文件。原生组件和 API 契约不匹配时保留原生页面；Codex 更新后的可用性需要重新核验。

## 开发

统一宿主通过 `codex-feature.json` 与 `src/library-prompt-source.mjs` 组装页面脚本。

- `src/backend/local-image-source.mjs`：本地索引、提示词与云端身份映射／上传预留。
- `src/frontend/cloud-image-actions.mjs`：首次云端登记、去重与收藏工作流；只返回云端身份，不解释原生文件节点。
- `src/adapters/codex/native-image-modules.mjs`：原生构建产物发现，按导航／图库／画布能力分别连接。
- `src/adapters/codex/native-image-source.mjs`：原生呈现、上下文及异步动作归属。其余 Adapter 维护 Library API、图片来源与提示词协议。
- `src/frontend/local-image-source.mjs`：来源选择、搜索、分页和生命周期。
- Runtime Host：鉴权、功能声明校验与转发。

视觉与能力边界见 [DESIGN.md](DESIGN.md)。

2026-10-17，macOS Codex `26.1013.40934` 将 `library-masonry` 与 `library-item-layout` 合入 `app-initial`，图库动作使用的部分 atom 也改为入口本地导出。模块发现兼容旧独立资源与当前入口导出，绑定先识别本地公开导出，再按 import 关系解析；不遍历执行入口中不相关的初始化器。隔离 Renderer 已验证导航、图库和画布能力加载，Image Gen 原生 tab 的选择、切回 Images 及卸载恢复。此轮使用空列表验证来源容器，未验收真实本地图片、上传或编辑操作。

```bash
node --test features/images/test/*.test.mjs
```

独立 `web/` 与旧服务入口保留为已有历史工具，不由当前 manifest 启动；ImageLibrary 与日志索引已由当前本地来源复用。历史图库交接仅作为本机调查材料保留，当前开发以本文件、DESIGN.md 与源码为准。

2026-10-02 菜单核对：网格 More 明确使用原生 Library 的 mediaOverlay 分支，操作通过 leftIcon 传入真实原生图标。图库菜单按 Chat about this、View prompts、Add to Favorites／Remove from Favorites、Download、Add to folder、Delete 排列。Chat about this 组合原生模式切换、新 Chat 草稿导航与图片面板链路，不发送消息；导航与面板已隔离验证，图片随消息提交的实际链路未进行发送验收。生成图片通用菜单中的重复查看、新标签、复制和 Finder 不再混入图库菜单。Add to Favorites／Remove from Favorites 和 Add to folder 已接入原生云端 Library。首次操作上传所选图片，之后复用账号与内容指纹对应的云端身份；收藏与文件夹归属保存在服务器。取消文件夹选择会显示原生 toast，已上传的图片仍留在 Library。上传结果不确定时不盲目重试；Image Gen 不提供分享与重命名；Delete 的隐藏范围见下文。


Image Gen 支持原生圆形多选框、Shift 区间选择和底部动作条。Delete 会先二次确认，仅从 Image Gen 隐藏；本地原图和云端副本保留。隐藏状态由 MineCodex 当前 Runtime profile 持久维护，确认后立即生效，刷新／重启不再显示。缩略卡片沿用 Library 的 1:2 至 20:13 比例范围；极宽和极窄图片在卡片内完整缩放、居中留白，不裁切内容。

原生接入失败以当前标签节点、账号与页面分支为边界停止自动重试；清理产生的 DOM 变化不能重新挂载同一失败实例。离开页面再进入或重新注入后可重新连接。原生标签没有变化时不重复渲染替代导航。Codex 26.1021.31345 的 Plus 隔离窗口已验证连接失败时 Library 仍响应、原生标签可切换、Home → Library 可往返；新版 Library 动作从 `selectable-library-item` 移到 `library-item-menu`，选择框仍由原模块提供；资源发现优先使用当前已加载的精确模块，再使用声明的 import 关系与旧入口分支。当前隔离 Renderer 已验证导航、图库与画布全部能力加载，以及失配时的原生降级；真实图片浏览、菜单与画布交互仍需独立窗口验收，不将能力加载记为完整浏览验收。

原生模块定位复用共享 [Codex Adapter](../../packages/codex-adapter/DEVELOPMENT.md)，
图库和画布按自身的 library-page、预览与 tab 包装引用继续发现。先查实际独立模块，再走
已有的 masonry / item-layout 内联兼容分支，不能因 initial 不含引用就认定资源已合并。
画布与布局按 attachmentSrc / onImageEditSubmit / downloadSrc，以及
reserveImageComposerSpace / contentOwnsHeader 等原生角色属性识别，拒绝缺失或多义候选，
不固定压缩后的 t / r 导出。Renderer 后端 Library 请求同样显式序列化共享发现函数。
Codex `26.1027.30824` 的独立 Renderer 已验证导航、图库和画布完整接口加载；
没有据此声明图片点击、上传、下载或编辑流程通过。
