# MineCodex 的 GitHub Actions 发布

工作流：`.github/workflows/publish.yml`，仅手动触发。账号为 `Vontean`，GitHub 固定用户 ID 为 `65079079`；仓库固定 ID 为 `1330065529`。

## 使用

先完成版本升级、检查、提交并推送 `main` 与对应标签，再运行：

```bash
# 只验证，不发布；可检查已发布的版本。
gh workflow run publish.yml --repo Vontean/MineCodex --ref main -f release_tag=v2.0.4 -F publish=false

# 发布新的版本；替换标签为本次待发布版本。
gh workflow run publish.yml --repo Vontean/MineCodex --ref main -f release_tag=v2.0.5 -F publish=true
```

默认只验证，必须显式开启 publish。标签须为稳定版本 `vX.Y.Z`，位于 `main` 历史中，并匹配 package 与 lockfile 的版本。已存在的 npm 版本不能重复发布。

## 授权边界

- 首次发起人的固定账号 ID、重跑人的账号名、仓库 ID 和 workflow 的 main 分支全部匹配才会继续。其他账号发起或重跑会失败，且不会进入持有 OIDC 权限的发布任务。
- `npm-release` environment 仅允许 main 分支部署；npm Trusted Publisher 绑定 `Vontean/MineCodex`、`publish.yml` 和此 environment。
- 验证任务只读仓库，无 OIDC 发布权限。发布任务只下载本次验证的构建产物、核对 SHA-256，再用短期 OIDC 凭证发布；不执行 package lifecycle，不保存长期 npm Token。
- 原生 GitHub 的 Run workflow 按钮可见性由仓库权限决定，工作流不能按人隐藏该按钮；这里限制的是实际执行和取得发布权限。仓库管理员仍可改工作流或环境规则。新增协作者、账号改名或修改发布策略时，重新审查这些边界。
- 仓库当前私有，关闭 npm provenance；源码公开后可重新评估开启。

## 首次 npm 绑定

使用 npm 11.15.0 或更新版本，运行以下命令并完成一次本人 2FA 验证：

```bash
npm trust github minecodex --repository Vontean/MineCodex --file publish.yml --environment npm-release --allow-publish --yes
```

绑定成功后，后续 GitHub 工作流发布无需每次 npm 指纹验证。不配置人工审核者或仅暂存模式，以免每次发布仍需本人批准。账号设置、可信发布关系变更等管理动作仍受 npm 本人验证保护。
