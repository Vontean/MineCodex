# CodexModelSlider

Codex Composer 原生模型选择器的轻量增强功能。它通过同级
`CodexRuntimeHost` 注册，不启动 HTTP 服务，也不修改 Codex 模型目录。

功能范围：

- 把原生 Slider 左上角的 `Advanced` 改为当前模型名，并直接进入 Model 菜单；
- 为第三方模型显示厂商图标、格式化模型名和 Provider 副文本；
- 收藏常用 `provider/model`，保持原目录顺序；
- 较长的模型列表保持紧凑、可滚动；
- 保留 Codex 原生 reasoning Slider、Fast 闪电和真实选择状态。

## 验证

```bash
npm test
```

真实 UI 仅在隔离 profile 中验证：

```bash
cd ../CodexRuntimeHost
CODEX_RUNTIME_PROFILE_DIR="$HOME/.codex-model-slider/codex-profile" \
CODEX_RUNTIME_CDP_PORT=9233 \
npm start
```

这是非官方 CDP / DOM Adapter 的功能声明。Codex 私有 DOM 的适配实现统一留在
`CodexRuntimeHost`。

## 新增模型的 reasoning 档位适配

模型的可见 reasoning 上限只在
[`codex-feature.json`](./codex-feature.json) 的
`modelSelector.reasoningEffortOverrides` 中声明。新增模型时只需添加一条
完整、大小写不敏感的 `provider/model` raw identity 和允许档位数组；不要修改
RuntimeHost，也不要按 provider、前缀或模糊名称匹配。

维护约定：

- 数组顺序就是 UI 顺序；保留产品需要的顺序，并且每个 effort 只能出现一次。
- RuntimeHost 会按 native controller 提供的原生顺序取交集，不会补造 native 没有的档位。
- native controller 未提供声明档位时，该档位不会显示；不要在 manifest 中用它猜测模型能力。
- current effort 如果不在交集内，UI 保留真实 current 值，显示 unavailable 并禁用 slider；不会映射到 Low、任一 tick 或调用 controller。
- 正常 current effort 只通过原生 controller 选择；不做自动 capability 推断，也不引入远程 capability 服务。

示例：

```json
"reasoningEffortOverrides": {
  "provider/model": ["low", "medium", "high"]
}
```
