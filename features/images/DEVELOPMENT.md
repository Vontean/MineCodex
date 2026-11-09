# Images · Image Gen 与图片提示词

Images 按当前账号接入原生页面：Plus 使用 **Library**，Pro 使用 **Space → Images**，并增加 **Image Gen**，集中浏览本机 Codex 或本地 Work 生成的图片。

- Image Gen 位于 Your creations、Uploads 后，图片按生成时间倒序显示，支持搜索和滚动加载。
- 标签、加载骨架、图片排布、悬浮卡片和菜单复用原生组件。
- 点击图片进入原生详情，复用缩放、打开、下载以及可用的 Remove BG、Erase、Resize 编辑入口。
- 本地图库菜单支持 Chat about this、Add to Favorites、Download、Add to folder、Delete 和 View prompts。仅点击收藏／文件夹操作才上传所选图片到原生 Library，浏览不上传；云端收藏和文件夹关系由服务器管理。
- 图片菜单中的 **View prompts / 查看提示词** 打开与原生 File info 一致的右侧面板；加载时显示骨架并禁用复制。
- 本地图片按精确生成记录读取提示词。云端图片优先显示真实生成提示词；只有原始用户请求时，明确告知差异并标注 Original request，再提供复制。
- 多选支持原生圆形选择框、Shift 区间选择和底部动作条。Delete 二次确认后仅从 Image Gen 隐藏，本地原图和云端副本保留。

索引在当前 Runtime profile 中维护，读取本机生成目录与会话日志，不迁移或删除源文件。原生组件和 API 契约不匹配时保留原生页面。

## 开发

统一宿主通过 `codex-feature.json` 与 `src/library-prompt-source.mjs` 组装页面脚本。

- `src/backend/local-image-source.mjs`：本地索引、提示词与云端身份映射／上传预留；底层复用 `src/image-library.mjs` 与日志索引。
- `src/frontend/cloud-image-actions.mjs`：首次云端登记、去重与收藏工作流；只返回云端身份，不解释原生文件节点。
- `src/adapters/codex/native-image-modules.mjs`：ESM 构建的原生产物发现，按导航／图库／画布能力分别连接。
- `src/adapters/codex/rspack-modules.mjs`：rspack 构建经共享 `codexModuleRegistry` 按角色取得同样的能力。
- `src/adapters/codex/native-image-source.mjs`：原生呈现、上下文及异步动作归属。其余 Adapter 维护 Library API、图片来源与提示词协议。
- `src/frontend/local-image-source.mjs`：来源选择、搜索、分页和生命周期。
- Runtime Host：鉴权、功能声明校验与 `local-image-source` 转发。

视觉与能力边界见 [DESIGN.md](DESIGN.md)。

## 原生模块契约

原生模块定位复用共享 [Codex Adapter](../../packages/codex-adapter/DEVELOPMENT.md)。先查实际独立模块，再走入口内联的兼容分支；不能因某个入口不含引用就认定资源已合并。画布与布局按 attachmentSrc / onImageEditSubmit / downloadSrc、reserveImageComposerSpace / contentOwnsHeader 等原生角色属性识别，拒绝缺失或多义候选，不固定压缩导出名、chunk 编号或 hash。File Preview 的 Composer、Scope 与附件引用按原生调用关系解析。Renderer 后端 Library 请求同样显式序列化共享发现函数。

接入失败以当前标签节点、账号与页面分支为边界停止自动重试；清理产生的 DOM 变化不能重新挂载同一失败实例。离开页面再进入或重新注入后可重新连接。原生标签没有变化时不重复渲染替代导航。

## 验证

```bash
node --test features/images/test/*.test.mjs
```

最近隔离验证：macOS Codex `26.1029.61003`，独立 profile / CDP。已覆盖 Plus Library 追加唯一 Image Gen、真实本地图片首屏与缩略图、选中动作栏、清除选择、打开原生详情及 Composer 挂载。未覆盖：上传、云端收藏／文件夹写入、图片编辑提交、随消息提交图片与 Windows；模块加载不代表这些动作已验收。
