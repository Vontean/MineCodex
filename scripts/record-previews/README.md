# 功能预览录制

为控制台功能演示区录制视频。录制规格（画幅、速度、主题、镜头、打码）由 [Dashboard DESIGN](../../apps/dashboard/DESIGN.md) 维护，隔离窗口的启动方式由 [Runtime Host 隔离验收](../../packages/runtime-host/DEVELOPMENT.md#隔离验收) 维护，这里只说明本目录的用法。

## 组成

- `lib.mjs`：CDP 连接、模拟光标、截屏录制，以及镜头跟随编码（4:3、2×、H.264）。剧本用 `d.frame(rects)` 声明每一步要框住的区域，编码时镜头在关键帧之间平滑平移。
- `<feature-id>.mjs`：每个功能一个剧本，首行注释写明录制前窗口需要处于的状态。
- `fixtures/examples/`：英文示例文档（目录、宽表格、代码块、Mermaid 图），供文件类功能使用。
- `sheet.sh`：把一段视频抽成 6 帧拼图，快速检查画面。

## 流程

1. 按隔离验收启动独立 Codex（浅色主题、英文界面）和加载全部功能的宿主。业务数据指向临时目录，Notes 用 `CODEX_NOTES_PORT` 避开日常实例的端口。
2. 文件类功能需要示例文档出现在 Files 树中，而被 Git 忽略的目录不会显示。录制前把示例复制到仓库根目录，录完删除，不要提交：

   ```bash
   cp -R scripts/record-previews/fixtures/examples examples
   ```

3. 把窗口调到剧本要求的前置状态，从仓库根目录运行：

   ```bash
   MCX_DEMO_PORT=<隔离 CDP 端口> node scripts/record-previews/session-status.mjs
   ```

   输出 `<id>.mp4` 与封面 `<id>.jpg`，默认写入被忽略的 `docs/verification/previews/`，可用 `MCX_DEMO_OUT` 改目录。

4. 用 `scripts/record-previews/sheet.sh <id>` 检查画面，确认后复制到 `apps/dashboard/assets/previews/`，并在 `manifest.json` 登记 `video`、`poster` 与录制所用的 Codex 构建 `version`。

## 注意

- 剧本依赖原生 DOM 与 MCX 标记，Codex 改版后选择器可能失效；失败时先截图确认页面状态，再修剧本。
- 剧本不发送消息。会改动状态的步骤（输入框草稿、思考强度、临时站点）都会在录完后还原。
- Model Slider 会修改全局模型配置。录前仍需备份；成功、异常与超时后都会尝试通过 UI 恢复，并核对模型与档位。恢复失败会输出错误并返回非零退出码；宿主退出或进程被强制终止时仍需人工核对备份。
- 窗口被遮挡时渲染和输入会暂停；`lib.mjs` 会把目标窗口置前并开启焦点模拟，录制期间不要切换窗口。
