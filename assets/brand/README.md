# MineCodex 图标

`minecodex-icon.svg` 是透明底、单色的可编辑矢量图标，使用 `viewBox="0 0 24 24"` 和 `currentColor`。外圈与镐子分别位于 `codex-outline`、`pickaxe`，可单独编辑。`minecodex-icon.png` 是 512×512 透明底预览；`minecodex-icon-preview.png` 展示已选实心版的明暗主题及 16/24/32/48px 尺寸。当前主文件为实心版；`minecodex-icon-filled.svg` 是实心版副本，`minecodex-icon-outline.svg` 保留上一版空心设计。

## 设计与来源

- 外圈完整保留 Codex 原生六瓣 SVG 路径，移除原来的终端符号。
- 空心版镐子复用原生资源中的 Lucide pickaxe；实心版依据同一轮廓合并为单一闭合填充路径，无内部描边。Minecraft 灵感由镐子语义表达。
- 内部镐子以 `translate(6.24 6.24) scale(.48)` 居中。空心版描边宽度为 `2.65`，变换后为 `1.272`；实心版只使用 `fill`。原生外圈路径保持不变。
- 来源为本机 `/Applications/ChatGPT.app/Contents/Resources/app.asar`，版本 **26.930.21537**；原始文件为 `webview/assets/codex_new-f14177b03534.svg` 与 `webview/assets/pickaxe-b4cdf185b279.svg`。
- 原始 SVG 保留在 `references/`，Lucide 许可保留在 `references/lucide-LICENSE.txt`。Codex 外圈属于 OpenAI 原生品牌素材，Lucide 许可仅覆盖镐子。

推荐展示尺寸为 24px 及以上；16px 可保持整体轮廓，但镐子的内部细节会减少。颜色继承使用环境的 `color`；独立打开时默认黑色，白色版本可设置根 SVG 的 `color="#fff"`。

## 应用与维护

`minecodex-icon.svg` 是唯一可编辑的生产源；运行 `npm run build:icons` 生成明暗 SVG、Dashboard favicon 和 README 顶部标识。`minecodex-icon-light.svg` 用于浅色背景，`minecodex-icon-dark.svg` 用于深色背景。Dashboard 标题通过 favicon 的 CSS mask 消费同一几何，颜色继承页面文字色。主题 SVG 与生产源、Lucide 许可、README 展示图均进入 npm 发布名单。

历史空心版和 PNG 对比图仅用于设计参考，不进入 npm 发布包。macOS 后台服务 1.0.1 已接入 ICNS 图标；`minecodex-service-icon.svg` 为同一几何配浅色圆角底板的原生图标源，更新遵循原生服务文档的注销、替换和重新注册流程。
