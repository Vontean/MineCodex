# Images · Library 提示词

Images 在 Codex 原生 **Library → 图片详情**中补充提示词查看能力。

- 有可追溯的提示词时，在缩放胶囊左侧显示 **Prompt / 提示词**。
- 点击后，使用原生 Version history 相同布局和 design token 的右侧面板展示内容。
- 面板只展示提示词正文，支持一键复制；优先使用生成提示词，否则追溯该图片的用户输入。
- 未找到提示词、普通上传图片或来源对话不可用时，不显示按钮。
- 切换图片或关闭详情会移除旧内容；Escape 先关闭提示词面板。

新版不再在 Sites 下方注入独立 Images 入口，也不启动第二套图库服务。
图片浏览、编辑与下载使用 Codex 原生能力。读取仅在本机原生 Renderer 内完成，
沿用当前登录态，不复制图片或持久化来源对话。

## 开发

统一宿主通过 `codex-feature.json` 注册 `src/library-prompt-page.mjs` 页面脚本。
原生 DOM 或 API 契约缺失时不注入。视觉契约见 [DESIGN.md](DESIGN.md)。

```bash
node --test features/images/test/library-prompt-page.test.mjs
```

旧 `src/image-library.mjs`、索引、独立 `web/` 与服务脚本暂保留为历史工具，
不属于当前插件入口；已有本地图片和缓存不会被迁移或删除。
