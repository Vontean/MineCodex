# MineCodex 的 GitHub Actions 发布

工作流：`.github/workflows/publish.yml`，仅手动触发。账号为 `Vontean`，GitHub 固定用户 ID 为 `65079079`；仓库固定 ID 为 `1330065529`。

## 使用

先完成版本升级、检查、提交并推送 `main` 与对应标签，再运行：

```bash
# 只验证，不发布；可检查已发布的版本。
gh workflow run publish.yml --repo Vontean/MineCodex --ref main -f release_tag=vX.Y.Z -F publish=false

# 发布新的版本；替换标签为本次待发布版本。
gh workflow run publish.yml --repo Vontean/MineCodex --ref main -f release_tag=vX.Y.Z -F publish=true
```

将示例中的 `vX.Y.Z` 替换为本次版本。默认只验证，必须显式开启 publish。标签须为稳定版本 `vX.Y.Z`，位于 `main` 历史中，并匹配 package 与 lockfile 的版本。已存在的 npm 版本不能重复发布。

## 完整交付流程

本地包边界审计使用 `npm run pack:audit`。脚本通过 npm 提供的 CLI 路径调用当前 Node，使用宿主临时目录作默认缓存，并直接扫描原生二进制中的 ASCII 字符串，因此 Windows 不依赖 `/usr/bin/strings` 或 shell 执行 `.cmd`。该检查不验证 macOS 签名；签名检查仍须在 macOS 上运行。

发布完成标准包含 GitHub Release，只有 main／标签和 npm 更新不算完整交付：

1. 按逻辑边界提交功能与发布流程改动，单独提交 package／lockfile 版本升级；运行 `npm run prepublishOnly`。
2. 推送 `main` 和对应版本标签，触发上述发布工作流并确认成功。
3. 独立查询公共 npm registry，确认该版本存在且 `latest` 指向它。
4. 创建对应 GitHub Release，标题为 `MineCodex X.Y.Z`，说明本版本的用户可见变化、默认行为和重要限制；设为 Latest。标签已存在时使用 `--verify-tag`，不让 Release 创建隐式标签。已有同版本 Release 时更新正文和 Latest 状态，不创建重复项。
5. 用户要求更新本机时运行 `mcx update`，再用 `mcx --version` 和 `mcx status` 核验安装版本、后台服务与 RuntimeHost；原生 GUI 验收单独报告。

Release 正文先写到 UTF-8 文件，保留实际换行，再执行（替换版本与文件路径）：

```bash
gh release create vX.Y.Z --repo Vontean/MineCodex --verify-tag --title "MineCodex X.Y.Z" --notes-file /absolute/path/release-notes.md --latest
# 同版本 Release 已存在时：
gh release edit vX.Y.Z --repo Vontean/MineCodex --title "MineCodex X.Y.Z" --notes-file /absolute/path/release-notes.md --latest
```

通过 `gh release view` 和 GitHub `/releases/latest` API 核对版本、正文、非草稿和 Latest 状态；最终报告同时给出发布工作流与 Release 链接。npm 已发布而后续步骤失败时只补齐缺少的步骤，不重复发布已有 npm 版本。

## 授权边界

- 首次发起人的固定账号 ID、重跑人的账号名、仓库 ID 和 workflow 的 main 分支全部匹配才会继续。其他账号发起或重跑会失败，且不会进入持有 OIDC 权限的发布任务。
- `npm-release` environment 仅允许 main 分支部署；npm Trusted Publisher 绑定 `Vontean/MineCodex`、`publish.yml` 和此 environment。
- 验证任务只读仓库，无 OIDC 发布权限。发布任务只下载本次验证的构建产物、核对 SHA-256，再用短期 OIDC 凭证发布；不执行 package lifecycle，不保存长期 npm Token。
- 验证和打包使用 GitHub 托管 macOS runner，符合 package 的 darwin/win32 平台约束；发布任务使用托管 Ubuntu runner，仅发布已验证的压缩包，不安装 MineCodex。
- 原生 GitHub 的 Run workflow 按钮可见性由仓库权限决定，工作流不能按人隐藏该按钮；这里限制的是实际执行和取得发布权限。仓库管理员仍可改工作流或环境规则。新增协作者、账号改名或修改发布策略时，重新审查这些边界。
- 源码仓库与 npm 包均公开，发布通过 OIDC 生成 provenance，关联包产物、构建和源码。provenance 不替代测试或运行验收；改变仓库可见性或发布环境时重新核对生成条件。

## 首次 npm 绑定

使用 npm 11.15.0 或更新版本，运行以下命令并完成一次本人 2FA 验证：

```bash
npm trust github minecodex --repository Vontean/MineCodex --file publish.yml --environment npm-release --allow-publish --yes
```

绑定成功后，后续 GitHub 工作流发布无需每次 npm 指纹验证。不配置人工审核者或仅暂存模式，以免每次发布仍需本人批准。账号设置、可信发布关系变更等管理动作仍受 npm 本人验证保护。
