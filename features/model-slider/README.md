# CodexModelSlider

Codex Composer 原生模型选择器的轻量增强功能。它通过同级
`CodexRuntimeHost` 注册，不启动 HTTP 服务，也不修改 Codex 模型目录。

功能范围：

- 把原生 Slider 左上角的 `Advanced` 改为当前模型名，并直接进入 Model 菜单；
- 为第三方模型显示厂商图标、格式化模型名和 Provider 副文本；
- 收藏常用 `provider/model`，保持原目录顺序；
- 模型超过 12 个时显示搜索；
- 保留 Codex 原生 reasoning Slider、Fast 闪电和真实选择状态。

## 验证

```bash
npm test
```

真实 UI 仅在隔离 profile 中验证：

```bash
cd ../CodexRuntimeHost
CODEX_RUNTIME_PROFILE_DIR=/Users/mac/.codex-model-slider/codex-profile \
CODEX_RUNTIME_CDP_PORT=9233 \
npm start
```

这是非官方 CDP / DOM Adapter 的功能声明。Codex 私有 DOM 的适配实现统一留在
`CodexRuntimeHost`。
