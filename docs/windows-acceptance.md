# Windows 隔离验收（2026-09-12）

基线为 `edb7f90`（1.0.10），验收使用 Windows 分支当前工作区源码，未发布 npm 版本。

## 修复

- Windows 自动接管只枚举主应用，排除同名 Electron renderer / GPU 子进程。
- RuntimeManager 与 RuntimeHost 建立 IPC；停止时先请求宿主清理插件子进程，超时才强制结束。IPC 断开也触发清理。
- npm 的 Windows 调用通过 PowerShell 启动 `npm.cmd`，字面量参数编码传递并返回 npm 退出码。
- Notes 接受 Ctrl+Enter，Windows 显示相应快捷键。
- 主题消息使用与其他 Surface 消息一致的同源发送目标。
- Images 的共用界面增加中英文切换，跟随宿主语言；静态文案、动态计数、无障碍标签、详情、编辑工具和另存为提示均覆盖。用户标题、生成提示词和批注内容保留原文。Mac 与 Windows 复用同一实现。

## 运行位置

- 机器：`vontean-windows`，Node.js `v24.19.0`。
- 独立代码目录：`C:\Users\vonte\mcx-review-20260912`。
- 隔离 profile：`C:\Users\vonte\AppData\Roaming\MineCodex\codex-profile`（沿用之前的测试 profile）。
- 桌面会话：Session 1；CDP 仅监听本机端口 `9241`。
- 手动计划任务：`MineCodex-Review-Window`、`MineCodex-Review-Runtime`，无登录触发器。
- 验收脚本：上述目录中的 `run-review.mjs`、`run-review.cmd`。
- 独立插件数据：`acceptance\images`、`acceptance\notes`，端口分别为 `47941`、`47942`。
- 为避免与已安装服务冲突，验收脚本复制 feature 文件到 `acceptance\features`，仅调整清单中的服务端口。部署源码清单保持原样。
- 原有 `MineCodex` 服务与正常 ChatGPT 窗口保留。本次没有覆盖正式安装目录。

## 已验证

- Mac 上 CLI 相关测试 62/62、RuntimeHost 测试 57/57、Images / Notes 测试 59/59 通过。
- Windows 上平台、npm adapter、RuntimeManager 针对性测试 34/34 通过。
- Windows 真实 npm 查询返回 `1.0.10`；主进程枚举只返回正常窗口和隔离窗口，不包含 renderer。
- 真实 RuntimeManager：首次注入 → IPC 停止 → 两个插件端口关闭 → 重新注入成功。日志包含 `IPC_CLEANUP_VERIFIED`。
- 四个插件均报告 `injected`；Images 与 Notes 服务健康，renderer 无注入错误。
- Windows Notes 在现有任务中打开面板和编辑器，Ctrl+Enter 保存隔离验收待办成功。
- Windows Images 实际 DOM 为 `lang=zh-CN`，显示“图片 / 全部图片 / 暂无图片”，接收到宿主主题 token。
- 清理之前 Session 0 的隔离主进程 PID 24096 及其 16 个关联子进程；保留 Session 1 正常主进程 PID 27448。验收隔离主进程启动时 PID 为 28844，后续应以命令行而非固定 PID 识别。

## 证据与边界

Windows 代码目录下保留 `acceptance-run.log`、`windows-tests.log`、`acceptance\ready.json`、界面截图与验收脚本。源码本地测试只证明相应逻辑与契约；未重启 Mac 正常应用。

本次没有发布或全局升级 MCX，没有运行完整正式安装 / 升级 / 卸载链，也没有发送生成图片请求。图片库为空是本机索引结果，不代表生成与编辑链路已做端到端验收。

## 1.1.0 正式发布与安装

随后完成发布前清理，将改动带到同基线的 `main`，提交功能改动 `92f037a` 和版本提交 `f90dbf2`，发布并推送标签 `v1.1.0`。

- 全量测试 232/232、语法检查和发布包审计通过；npm 包包含 124 个文件。
- TTY `npm publish` 成功；registry 确认 `1.1.0`，SHA-1 为 `1f6ffc882c80e6fc294257dcd8de3c85d4487ba8`。
- registry 处理期间，Windows 先以相同 SHA-1 的发布 tarball 完成 `npm install -g`；随后核对 registry 校验值一致。
- Windows 正式代码位于 `%APPDATA%\npm\node_modules\minecodex`，`mcx.cmd` 可从 PATH 找到。
- `mcx install` 六步成功，`mcx restart` 成功；最终 `installed=true`、后台服务运行、`runtime.healthy=true`、`pendingRestart=false`、四个插件全部 `injected`，无失败记录。
- 正式 ChatGPT 运行于 Session 1，使用默认用户数据和本机 CDP 9231。
- 隔离验收窗口和 RuntimeHost 已停止，两项 `MineCodex-Review-*` 任务已移除；仅保留正式 `MineCodex` 后台任务。
- 旧服务配置和任务定义备份位于 `C:\Users\vonte\mcx-backup-before-1.1.0`；用户 Notes 数据和应用默认 profile 保留。

以上覆盖正式安装与重启；本次未执行卸载或再次升级。此前“未发布 / 未正式安装”的说明仅描述隔离验收阶段。
