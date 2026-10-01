# Navbar 状态与 Tooltip 适配

依据：本机 Codex 26.928.21956 的 app.asar 源码。本轮未进行窗口实测。

## 原生事实

- app-initial-135a4ef2552c.js 的导航入口按 isCurrentDestination 选择 railIcons.default / selected，Tooltip side=right。
- app-shared-eececb2d2eb0.js 的自定义 Tooltip 默认 delay=200ms、skip=300ms、sideOffset=2px、collision padding=8px。不是另一套 Radix 默认700ms。
- app-shared-342447930c78.css 提供 Tooltip 颜色、描边、阴影、文字 token；rounded-2xl 使用 radius-2xl。
- app-initial-e55cd978d577.css 给 rounded-2xl 添加 corner-shape:var(--codex-corner-shape)。只复制半径会丢失新版轮廓。
- 原生图标工厂暴露 createElement(document,className)，可在不调用 React Hooks 的情况下生成 default 图标；IconAsset 包含 canvas、paint 与 body。

## 修改归属

- UI native 适配器读取真实图标资源与导航项状态；UI NavigationRail 管理展示、原生取消选中与恢复。Prompts 提供自己的成对图标与页面内容。
- 原生 SVG 保留，临时隐藏并插入组件拥有的 default SVG；退出或卸载移除替身并恢复属性。原生重渲染替换 SVG 后重新应用。
- Tooltip 统一原生轮廓、token、时序与定位；Navbar 向右，普通控件跟随 side-tooltip。MineCodex 提示之间独立维护 skip 时序，不接管原生 provider。
- 选中书本采用官方 Phosphor book-open-fill，MIT 许可随包发布。

## 验证

322 项测试通过；120 个 JavaScript 文件语法检查通过；146 个发布文件的包审计通过。新增测试覆盖选中／恢复、原生重渲染、卸载清理、真实 DOM 图标工厂契约、未选中资源缓存、Tooltip 200ms 延迟／300ms skip、提前离开、focus、aria 与 zoom 定位。安装器序列化及架构边界检查通过。

窗口实测边界：Computer Use 工具拒绝访问 com.openai.codex，本轮未绕过限制进行 CDP 或其他 GUI 操作。因此没有新截图、窗口预览注入或真实鼠标验收证明；当前交付为源码、测试、文档与本地 Git 提交。
