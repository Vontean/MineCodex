> 历史资料，归档于 2026-10-01。以下内容只描述当时的产品与取证结果，不具有当前规范优先级。当前产品见 [Images README](../../../features/images/README.md)，特殊组件见 [Images DESIGN](../../../features/images/DESIGN.md)，通用设计以根 [DESIGN.md](../../../DESIGN.md) 为准。

# Codex Design Language Integration

取证环境：Codex macOS `26.803.41515`，2026-08-07。以下结论来自当前 Renderer 的 computed styles、CSS variables、原生 Plugins 控件和明暗主题规则，不是凭视觉猜测。

## 观察到的设计原则

1. **Native and quiet**：使用 macOS system font stack，界面以内容为主，装饰很少。
2. **Compact density**：原生侧栏条目高 30px、字号 13px、水平 padding 8px、gap 8px。
3. **Layered surfaces**：主 Surface、under Surface、elevated Surface 和 control Surface 通过很小的明度差区分。
4. **Subtle boundaries**：暗色默认边框只有约 8.4% 白色，强调边框约 15.6%，不使用高对比卡片描边。
5. **Token-driven themes**：根节点使用 `electron-light` / `electron-dark` 与 `color-scheme`，并把当前解析后的语义 token 写进 root style。
6. **Runtime customization**：`--codex-base-accent`、`--codex-base-ink`、`--codex-base-surface` 等会随用户主题配置改变。集成功能应读取 resolved tokens，而不是维护一份固定颜色表。
7. **Restrained motion**：交互反馈短而轻；Images 使用 120–180ms 状态变化，并遵循 `prefers-reduced-motion`。

Codex 当前没有控制 SVG 线宽的 Design Token。原生导航图标使用 `16×16` viewBox 的填充轮廓路径，视觉轮廓约为 1px；Images 的 Lucide 图标使用 `24×24` viewBox，因此统一采用 `stroke-width: 1.5`，缩放到 16px 后同样约为 1px。颜色仍由 `--color-icon-*` 与 `currentColor` 控制。

## Images 使用的 Token Interface

Theme Bridge 只同步当前页面需要的 token，避免复制 Codex 的完整内部主题系统。

| 用途 | Codex token |
| --- | --- |
| 主背景 | `--color-token-main-surface-primary` |
| 下层背景 | `--color-token-bg-primary` |
| 次级 Surface | `--color-token-bg-secondary` |
| Elevated Surface | `--color-background-elevated-primary-opaque` |
| Panel Surface | `--color-background-panel` |
| 主要文字 | `--color-text-foreground` |
| 次要文字 | `--color-text-foreground-secondary` |
| 三级文字 | `--color-text-foreground-tertiary` |
| 默认 / 强边框 | `--color-border` / `--color-border-heavy` |
| Focus ring | `--color-border-focus` |
| 输入框 | `--color-token-input-*` |
| 主 / 次按钮 | `--color-background-primary-solid`、`--color-text-primary-solid`、`--color-background-button-secondary*` |
| 字体 | `--font-sans-default`、`--default-mono-font-family` |
| 字号 | `--text-heading-*`、`--text-base`、`--text-sm`、`--text-xs` |
| 圆角 / 阴影 | `--radius-*`、`--shadow-*` |
| 用户主题基色 | `--codex-base-accent`、`--codex-base-ink`、`--codex-base-surface` |

当前暗色实测核心值：

```text
surface  #181818
under    #141414
text     #ffffff
border   rgba(255, 255, 255, 0.084)
accent   #339cff
font     -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Codex 自带明亮规则的核心值：

```text
surface  #ffffff
under    #f9f9f9
text     #1a1c1f
border   color-mix(in oklab, #1a1c1f 8%, transparent)
accent   #339cff
```

## Theme Bridge

```text
Codex root computed styles
          │ read selected resolved tokens
          ▼
CodexRuntimeHost ── postMessage(theme + tokens)
          │
          ▼
Images iframe ── apply to document root
```

- Images 打开、iframe load、主题 class 变化或 root style 变化时同步。
- 每次同步先移除上一批宿主 token，再应用当前批次，防止切换主题后残留旧值。
- 独立 Web UI 没有宿主时，使用同名 light/dark fallback tokens 和系统 `prefers-color-scheme`。
- 自定义 accent 测试已验证从宿主 `#ff2d55` 同步到 iframe，恢复后回到 `#339cff`。

## 代码复用边界

可以直接复用：

- 侧边栏入口克隆当前 Codex 的 Plugins 控件以继承布局和交互状态，再替换为 Codex 当前图标体系中的 Lucide `Image` 图标，避免与 Plugins 重复。
- iframe 使用 Codex 当前 resolved semantic tokens。
- 控件尺寸与密度以真实 computed styles 为准。

不直接导入：

- Codex 内部 React 控件、hashed CSS bundle 或私有模块。

这些内部实现没有稳定的导出 Interface，版本更新时文件名和实现会变化。Theme Bridge 把变化集中在同级的 `CodexRuntimeHost` 中，同时让 Images 和未来功能保持小而独立。

## Images 页面规格

- 主标题栏与详情标题栏都采用原生实测的 46px 高度；详情标题栏不加底边，避免在原图上方形成多余分层。主标题只保留 `Images` 与 28px Refresh，图片数量移入下方来源筛选器。
- 标题栏下方使用固定工具栏：左侧按 All images、Chats 或 Project 筛选，右侧直接显示无描边 4px 轨道的 2–6 列 Grid 滑条与按 Thread 聚合开关，不再使用额外浮层或 Auto。首次按内容宽度选择初始列数，之后只响应并记住用户操作；详情打开时左侧仍固定为一列。
- 常规图库按时间倒序；横向列间距和纵向卡片间距都固定为 16px，Masonry 使用 1px 行精度避免取整放大间距。图片保持原始画幅，卡片只显示可靠来源与时间。
- Thread 聚合模式用固定预览数量组成纵向图板，超出部分显示 `+N`；图板按最新图片倒序，组内图片按生成时间正序。进入图板后详情选择带只包含该 Thread，Close 会恢复筛选、聚合状态与滚动位置。
- 时间戳底栏使用 `--color-background-panel`；当前 Codex 暗色主题解析为 `#232323`，比主背景略亮一级。
- 卡片底栏保持两行：第一行使用 Codex 原生 Project folder 或 Lucide `message-square` 方形气泡图标和来源名称，第二行显示三级色时间；长名称只在卡片中截断，详情里保留完整文本。
- 46px 主标题栏不属于滚动容器；滚动区从标题栏下方开始，图片每批加载 36 张，滚动条 thumb 保持至少 48px 高。
- 不提供 Thread ID / ImageGen ID 搜索，也不在卡片上暴露这些机器字段。
- 打开图片后，左侧约 20% 收为单列图片选择带，右侧约 80% 成为详情区；原图优先，下面依次是实际生成 Prompt 和可靠元数据。
- 详情使用内容区内的右侧面板，不使用居中 modal，也不增加遮罩。
- Images 位于 `Sites` 与 `Scheduled` 之间；进入 Images 时只保留 Images 的 active / `aria-current`，退出后恢复 Codex 原生选择状态。

## 浮层层级

Images Surface 位于 Codex 内容层 `z-index: 40`，Codex 原生菜单位于浮层 `z-index: 50`。这样 iframe 可以覆盖原生主内容，但帮助菜单等原生浮窗仍能完整显示在 Images 上方。不要给 iframe 使用接近浏览器上限的 z-index，否则它会盖住由 Codex Portal 渲染的菜单。

## 验证命令

```bash
node spikes/phase0/cdp-probe.mjs frame-check \
  --port 9231 \
  --url http://127.0.0.1:47831/

node spikes/phase0/cdp-probe.mjs overlay-check \
  --port 9231 \
  --url http://127.0.0.1:47831/

node spikes/phase0/cdp-probe.mjs eval \
  --port 9231 \
  --target-url http://127.0.0.1:47831/ \
  --expression '({ theme: document.documentElement.dataset.theme, colorScheme: getComputedStyle(document.documentElement).colorScheme })'
```
