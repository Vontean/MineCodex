# CodexModelSlider

Codex Composer 原生模型选择器的轻量增强功能。它通过同级
`CodexRuntimeHost` 注册，不启动 HTTP 服务，也不修改 Codex 模型目录。

功能范围：

- Codex 普通任务与 Work 沿用原生面板布局：上方思考强度、下方模型名，点击进入模型菜单；
- 为第三方模型显示厂商图标、格式化模型名和 Provider 副文本；
- 收藏常用 `provider/model`；排序与呈现选择统一见 [DESIGN.md](DESIGN.md)；
- 较长的模型列表保持紧凑、可滚动；
- 模型列表顶部默认聚焦搜索框，按模型名与 Provider 筛选；滚动时搜索框固定，筛选时底边不动、高度平滑变化；
- 所有模型共用 Slider，动态读取模型支持的思考档位；
- 同时兼容旧版 reasoning 回调与新版 power selection 控制器契约；
- 沿用原生面板的间距、重置入口；仅实际支持 Fast 时显示闪电按钮；
- Fast 图标通过 `codexModuleRegistry` 读取当前已注册的原生 `FastModeToggle` 模块，按资源角色提取开/关路径；不依赖 bundle 文件名、路径前缀或构建哈希。注册表或资源契约不可用时保持原生控件，不伪造图标。
- 头部直接克隆当前原生 ViewControls，保留布局属性、HeaderShortcuts 槽、Fast 热区和思考强度／模型名层级，只替换标签与动作。Codex 26.1111.21308（build 27194）的隔离原生基线为 Fast 左、重置右、中央上方档位／下方模型；不强制选择 inline 分支或覆盖原生尺寸。
- Chat／Temporary Chat 完全使用原生模型选择器，不注入增强面板或拦截模型菜单。

## 验证

```bash
npm test
```

真实 UI 按 [Runtime Host 隔离验收](../../packages/runtime-host/DEVELOPMENT.md#隔离验收) 验证：宿主只加载 `model-slider`，收藏数据用 `MINECODEX_MODEL_DATA_FILE` 指向临时文件。

这是非官方 CDP / DOM Adapter 的功能声明。Codex 私有 DOM 的适配实现统一留在
对应功能的 `src/adapters/codex/`。

最近隔离验证：Codex 26.1111.21308（build 27194）中先停用注入取得原生基线，再比对增强面板。头部 254×96，Fast 左侧 26×32、重置右侧 32×32，以及档位／模型的纵向位置与原生一致；浅／深色均已实开。Fast 开关、模型搜索、Escape 返回和键盘调档通过；DeepSeek V4.1 Flash 不显示 Fast，切回 GPT 6.1 Sol 后恢复 Medium，停用增强后的原生控件读回 Fast=false。应用缩放按用户要求不纳入本次验收；完整键盘矩阵未覆盖。契约测试覆盖原生资源发现、缺失资源降级及序列化。
