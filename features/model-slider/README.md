# CodexModelSlider

Codex Composer 原生模型选择器的轻量增强功能。它通过同级
`CodexRuntimeHost` 注册，不启动 HTTP 服务，也不修改 Codex 模型目录。

功能范围：

- Codex 普通任务与 Work 沿用原生面板布局：上方思考强度、下方模型名，点击进入模型菜单；
- 为第三方模型显示厂商图标、格式化模型名和 Provider 副文本；
- 收藏常用 `provider/model`，保持原目录顺序；
- 较长的模型列表保持紧凑、可滚动；
- 所有模型共用 Slider，动态读取模型支持的思考档位；
- 沿用原生面板的间距、重置入口；仅实际支持 Fast 时显示闪电按钮；
- Chat／Temporary Chat 完全使用原生模型选择器，不注入增强面板或拦截模型菜单。

## 验证

```bash
npm test
```

真实 UI 仅在隔离 profile 中验证：

```bash
CODEX_FEATURES_ROOT="$PWD/features" \
MINECODEX_ENABLED_FEATURES=model-slider \
CODEX_RUNTIME_PROFILE_DIR="$HOME/.codex-model-slider/codex-profile" \
CODEX_RUNTIME_CDP_PORT=9233 \
node packages/runtime-host/src/main.mjs
```

这是非官方 CDP / DOM Adapter 的功能声明。Codex 私有 DOM 的适配实现统一留在
`CodexRuntimeHost`。
