# CLI 与 Windows 生命周期

CLI 拥有安装、后台服务和 Codex 启动规则，平台差异留在 `WindowsPlatformAdapter`。

## 隐藏服务

Windows 计划任务在用户登录时运行，保持原有重试、电池和不限时设置。任务通过系统 `wscript.exe` 执行安装器生成的 VBS，隐藏启动 CMD 服务并等待结束，将服务退出码返回计划任务；不能使用启动后立即退出的包装器替代。脚本用带 BOM 的 UTF-16LE 保存，支持中文路径。

安装与恢复均生成启动器，卸载随服务目录清理。窗口隐藏不改变服务权限，也不将触发器改成系统开机。Windows Script Host 是该启动链的依赖，禁用它的环境尚未验收。

验证运行 `node --test packages/cli/test/platform.windows.test.mjs`；其中 Windows 原生探针验证带空格和中文的路径及退出码传递，不注册真实计划任务。真实任务停止、登录自启和长期运行须另行验收，单元测试通过不代表这些行为已验证。
