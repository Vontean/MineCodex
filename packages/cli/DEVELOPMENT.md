# CLI 与 Windows 生命周期

CLI 拥有安装、后台服务和 Codex 启动规则，平台差异留在 `WindowsPlatformAdapter`。

## 隐藏服务

Windows 计划任务在用户登录时运行，保持原有重试、电池和不限时设置。任务通过系统 `wscript.exe` 执行安装器生成的 VBS，隐藏启动 CMD 服务并等待结束，将服务退出码返回计划任务；不能使用启动后立即退出的包装器替代。脚本用带 BOM 的 UTF-16LE 保存，支持中文路径。

安装与恢复均生成启动器，卸载随服务目录清理。窗口隐藏不改变服务权限，也不将触发器改成系统开机。Windows Script Host 是该启动链的依赖，禁用它的环境尚未验收。

验证运行 `node --test packages/cli/test/platform.windows.test.mjs`；其中 Windows 原生探针验证带空格和中文的路径及退出码传递，不注册真实计划任务。真实任务停止、登录自启和长期运行须另行验收，单元测试通过不代表这些行为已验证。

## Codex 应用身份

通过已验证包族的 `!App` 注册入口调用 `IApplicationActivationManager.ActivateApplication`，使普通启动与携带 loopback CDP 参数的增强启动保留相同的 Windows 应用身份。直接运行包内 EXE 会导致固定图标与运行窗口出现不同的任务栏分组。

增强启动仍排除原有 PID、等待新官方进程并验证 CDP 端口归属；激活失败直接返回错误，不降级到另一种应用身份。普通启动不枚举进程、不等待 CDP。

该入口曾在 Codex `26.1013.4894.0` 上验证扩展连接，并由用户验收任务栏显示；这是既有本机验证记录，本轮源码合入只做回归测试和编译检查。升级 Codex 后仍需复核注册入口及参数传递。

## 跨平台测试边界

macOS 适配器的注入测试显式选择 `darwin`，临时文件系统路径使用当前宿主的 `path` 语义，以便 Windows 也能验证状态迁移和拒绝越界行为。包内 plist、图标结构检查在各平台运行；真实 `codesign`、`lipo` 检查仅在 macOS 运行。

令牌创建与稳定性在各平台运行；`0600` 权限位仅在非 Windows 平台断言。Windows 的 Node `stat().mode` 不表示 NTFS ACL，这项跳过不构成 Windows ACL 验收，也不改变生产文件写入规则。
