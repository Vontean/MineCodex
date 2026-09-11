# Notes 弹窗与原生侧栏兼容修复

验证日期：2026-09-12。客户端：`/Applications/ChatGPT.app`，版本 `26.903.71938`。
适配器：`packages/runtime-host/src/codex-injection.mjs`，Runtime version 101。

## 根因与修改

### View All：原生标签参数契约变化

隔离窗口点击入口，旧实现抛出 `TypeError: t.isAvailable is not a function`。
当前 `app-initial` 中的 `openTab(scope, tabType, options)` 会直接调用
`tabType.isAvailable(scope, props)`，并读取 `tabType.Component`。
旧实现将组件函数作为第二个参数传入，因此在挂载之前失败。

现在传入包含 `Component`、`isAvailable`、`kind`、`dropDestinations` 的描述对象。
仍然按能力发现 controller，不依赖压缩后的函数名或资源 hash。
稳定标签 ID、关闭清理与按 Task 分配的 scope 保持原有行为。

### 空白弹窗：重连后仍使用旧 binding token

原窗口实际探测到弹窗 iframe 内容为空，加载请求没有 Host 回执。
在隔离宿主调用 `clearRendererState()` 后重新 `refresh()`，可以稳定复现相同症状：
Summary 仍然正常，点击 Add Prompt 创建空 iframe，但无法加载编辑表单。

原因是重连生成新 token，而 Renderer 的幂等安装分支只检查 version/sessionId，
直接保留了闭包中的旧 token。Host 的鉴权正确地拒绝了这些旧请求。

现在同会话重新注入时先同步 binding，再执行 ensure；使用新 token 重试尚未 ready
的 Surface，保留 ready 的页面和未保存草稿。不自动重放附件等有副作用的 Host action。

## 验证证据

隔离环境：

- Profile：`/Users/mac/.codex-model-slider/codex-profile`
- CDP：`9233`
- Notes 服务：`http://127.0.0.1:47932`
- Notes 数据库：`/tmp/minecodex-notes-repair/codex-notes.sqlite`
- 当前主窗口使用的全局安装未替换；测试数据未写入正式 Notes 数据库。

验证结果：

- 旧实现模拟重连后第一次添加即出现 `BLANK`，iframe body 为空。
- 修复后模拟重连，添加弹窗连续打开 20 次通过。
- 从界面添加并保存 6 条 Prompt，再点击 View All，原生侧栏显示全部 6 条。
- 在编辑中模拟重连，未保存草稿保留；保存并重新打开，正文一致。
- 重复打开聚焦原有标签，不新增重复标签。
- New Chat 与已有本地 Task 均成功打开原生 Prompts 标签。
- `npm test`：220 项通过；`npm run check` 与 `git diff --check` 通过。

回归测试：`host-binding-reconnect.test.mjs` 覆盖同会话更新 binding、重试未就绪页面
及保留 ready 编辑器；`native-detail-tab.test.mjs` 执行真实打开函数，覆盖新标签契约、
重复聚焦和关闭清理。

截图在 `output/playwright/notes-repair/`：
`add-prompt.png`、`view-all-prompts.png`、`edit-after-reconnect.png`。

以上原生 API 为当前客户端内部实现证据，不是公开稳定接口。
