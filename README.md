# MineCodex

MineCodex 给 Codex Desktop 增加三个轻量、本地优先的插件：

- **Model Slider**：更清楚、更顺滑的模型选择窗口。
- **Notes**：跨会话管理 Todo、Prompts 和 Files。
- **Images**：集中浏览生成图片、Prompt 和来源任务。

## 安装

MineCodex v1 仅支持 macOS，需要 Node.js 22.5 或更高版本。安装时会从
`/Applications/ChatGPT.app` 或 `~/Applications/ChatGPT.app` 查找 Codex Desktop；
如果两处都找不到，安装会停止并给出提示。

```bash
npm install -g minecodex
mcx install
```

`mcx install` 不会关闭或启动 Codex，也不会改变当前窗口。安装完成后，终端会提示
MineCodex 将在下次重启 Codex 时启用，并询问是否现在重启；默认答案是 **No**。
安装过程只有在用户明确确认，或之后主动运行 `mcx restart` 时，才会关闭并重新打开
Codex。安装后，macOS 的“登录项与扩展”中会显示名为 **MineCodex** 的后台项目。
这个后台项目负责插件与本地控制台：用户退出 Codex 后，它会保持停止；用户后来从
Dock 主动打开 Codex 时，这次新启动会被视为明确的启动意图，并切换为可注入的托管
实例。由于普通 Dock 启动本身没有 CDP，首次切换时 Codex 可能会短暂重开一次。

安装后三个插件默认开启。打开本地控制台：

```bash
mcx open
```

常用命令：

```text
mcx install
mcx uninstall [--purge]
mcx update
mcx open
mcx status [--json]
mcx restart
```

关闭插件只会停用对应功能，不会删除数据；保存开关后运行 `mcx restart` 应用变更。
`mcx uninstall` 会移除名为 MineCodex 的后台项目，并默认保留 MineCodex 设置、
Notes 数据和 Images 索引；只有显式传入 `--purge` 才会删除 MineCodex 自有数据。
MineCodex 永远不会删除 `~/.codex/generated_images` 中的原图或 Notes 引用的源文件。

## 开发

```bash
npm install
npm test
npm run check
npm run pack:check
npm run pack:audit
```

MineCodex 是唯一发布仓库。三个插件继续拥有各自的数据和页面；RuntimeHost 只负责
Codex 中的入口、主题与交互适配。

MineCodex 是非官方独立项目，与 OpenAI 无关联。项目自有代码以 MIT License 授权；
第三方图标、品牌和兼容资产遵循各自的权利说明，见
[`features/model-slider/THIRD_PARTY_NOTICES.md`](features/model-slider/THIRD_PARTY_NOTICES.md)。
