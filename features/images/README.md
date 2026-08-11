# CodexImageHost

CodexImageHost 给 Codex 增加一个轻量的 `Images` 入口。它自动汇集不同 Thread 中的 ImageGen PNG，但不复制图片。

## 当前功能

- 服务先初始化路径索引并开放 HTTP health，再在后台扫描 `~/.codex/generated_images` 中已有的图片；扫描完成后开始文件监听。
- 运行时监听新图片，自动加入 Images。
- 通过 All images、Chats 或有图片的 Project 筛选来源；数量直接显示在筛选菜单中。
- 工具栏内直接提供 2–6 列 Grid 滑条，使用无描边的 4px 轨道；首次打开按可用宽度给一个初始列数，之后只记住用户自己的选择。每张卡片显示来源 Project 或独立 Chat，以及生成时间。
- 可按 Thread 聚合成图板；进入图板后，左侧图片选择带只保留该 Thread 的图片，关闭详情即返回原图板位置。
- 标题栏固定在独立滚动区上方；图片按 36 张一批渐进加载，滚动条保持至少 48px 的可抓取高度。
- 点击图片后，以左侧图片选择带 + 右侧详情区的 20/80 布局查看原图。
- 按需读取该次 ImageGen 实际使用的 Prompt，并显示 Project、Thread、尺寸、时间与文件大小。
- 通过 `Save as` 打开 macOS 系统保存面板并保存原始 PNG。
- 从详情区通过 `Open Thread` 打开真实来源 Thread。
- 已归档 Thread 的图片仍可查看和 Save as，但 `Open Thread` 会禁用并在悬浮时说明原因。
- 通过上层同级项目 `CodexRuntimeHost` 启动一个统一宿主，在 Codex 左侧栏注册 Images。

不包含收藏按钮、图片副本、Asset Store、标签、Collection 或删除功能。Codex 的 PNG 是原图，SQLite 只是路径索引。

## 运行

需要 Node.js 22.5 或更高版本，不需要安装第三方 npm 依赖。

启动统一宿主；它会读取 `codex-feature.json`、启动 Images 服务并注册侧边入口：

```bash
npm start
```

只启动独立 Web UI：

```bash
npm run service
```

然后打开 <http://127.0.0.1:47831>。

运行测试：

```bash
npm test
```

服务运行时，路径索引默认保存在 `~/.codex-image-host/library.sqlite`。统一宿主暂时沿用 `~/.codex-image-host/codex-profile`，避免迁移后丢失现有专用 Codex 实例状态。项目不会写入或删除 `~/.codex/generated_images` 中的文件。

## 精简结构

```text
~/.codex/generated_images
        │ scan + watch
        ▼
ImageLibrary ── SQLite path index
        │                  Codex state + session index
        │                  ├─ Project / Chat / Thread 名称与 Archive 状态
        │                  └─ revised_prompt（按需读取 Session JSONL）
        ▼
HTTP + Images UI
        │
        └── codex-feature.json
                    │ sibling discovery
                    ▼
          ../CodexRuntimeHost
                    └── Codex sidebar + Theme Bridge + open Thread
```

- `src/image-library.mjs`：扫描、监听和路径索引，是产品核心。
- `src/thread-metadata.mjs`：读取 Codex 当前 Project、projectless Chat、Thread 名称与 Archive 状态。
- `src/prompt-index.mjs`：按 Thread 与 ImageGen item 定位真实 `revised_prompt`。
- `src/http-server.mjs`：图片列表、来源 facets、Thread 图板、原图读取、系统 Save as 和静态页面。
- `codex-feature.json`：Images 对统一宿主的最小声明，不包含图片业务逻辑。
- `../CodexRuntimeHost`：可复用的 CDP 集成，统一负责多个个人功能的入口、Surface、主题与导航。
- `web/`：零框架 Images 页面。

## Codex 设计语言与主题

- Images 不维护独立品牌皮肤，而是通过 Theme Bridge 读取当前 Codex Renderer 已解析的 semantic tokens。
- 支持 Codex 的明亮 / 暗黑主题，并监听根节点 theme class 与 style 变化。
- 用户修改 accent、ink 或 surface 后，新的 resolved tokens 会同步到 iframe，不需要重新读取或猜测内部配置文件位置。
- 侧边栏 Images 入口克隆原生 Plugins 控件的布局与状态，再替换为 Codex 图标体系中的独立 Image 图标；iframe 内不导入 Codex 私有 React 模块或 hashed CSS bundle，以免 Codex 更新后直接失效。

取证、token Interface 和代码复用边界见 [`docs/CODEX_DESIGN_LANGUAGE.md`](docs/CODEX_DESIGN_LANGUAGE.md)。

## 当前边界

- Images 服务需要保持运行，才会持续监听新图片；侧边栏注册由 `CodexRuntimeHost` 统一维持。
- 每次服务启动都会先开放 health，再在后台补扫停机期间新增的图片并刷新来源名称；初始补扫完成后，运行期间的新图片由文件监听自动加入。手动 Refresh 会再次补扫来源和 Archive 状态，但不会重置筛选、图板模式、详情、滚动位置或列数。刷新 ring 至少显示 1 秒。
- 侧边栏使用 Codex 当前未公开的 CDP / DOM 能力，Codex UI 更新后只需调整统一宿主；独立 Web UI 和路径索引不受影响。
- 当前 Codex 的 CSP 会屏蔽普通本地 iframe。统一宿主会先启用 CSP bypass 并注册 document-start 脚本；尚未完成该初始化的首次或旧版 document 会受控 reload 一次。完成初始化后会留下 document 标记，后续 RuntimeHost 重启只替换旧的 MineCodex runtime，不再刷新 Codex 页面（Issue #1）。
- 详情打开时会从本机 Session JSONL 按需读取该 ImageGen item 的真实 `revised_prompt` 并缓存到索引；历史记录缺少该事件时明确显示 Prompt 不可用，不从附近文本猜测。
- 当前没有发现 Codex 会因运行时间增长而自动清理 `generated_images` 的证据。如果未来观察到真实清理，再决定是否增加可选备份。

Phase 0 的原图、来源元数据与 Thread 导航证据见 [`spikes/phase0/README.md`](spikes/phase0/README.md)。

需要验证 Codex 内的 iframe 是否真正加载时，可在 `npm start` 运行期间执行：

```bash
node spikes/phase0/cdp-probe.mjs frame-check --port 9231 \
  --url http://127.0.0.1:47831/

node spikes/phase0/cdp-probe.mjs overlay-check --port 9231 \
  --url http://127.0.0.1:47831/
```

`overlay-check` 会打开 Codex 原生帮助菜单，验证菜单能覆盖 Images，同时确认 iframe 本身仍可交互。
