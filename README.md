<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="MineCodex：给 Codex Desktop 增加轻量、本地优先的插件，包含模型滑条、笔记与图片库">
</p>

# MineCodex

MineCodex 给 Codex Desktop 增加一组轻量、本地优先的扩展功能。配置、提示词和图片索引保存在本机。Images 的本地浏览不上传图片；使用云端收藏、加入文件夹或部分生成编辑操作时，所选图片会通过 Codex 原生能力上传至 OpenAI。

## 插件列表

| 插件 | 说明 |
| --- | --- |
| **模型窗口** · Model Panel | 快速切换模型和思考强度，收藏常用模型。 |
| **提示词库** · Prompt Library | 分类保存常用提示词，需要时一键填入输入框。 |
| **额度环** · Usage Ring | 在侧栏查看五小时和每周剩余额度，点击打开用量详情。 |
| **会话状态** · Session Status | 查看回复速度、Token 用量和上下文占用，了解对话消耗。 |
| **Markdown 阅读增强** · Markdown Reader | 让 Markdown 文档更易读，支持章节目录、表格展开和代码复制。 |
| **文件级联浏览** · Cascading File Browser | 点击文件顶部路径，分列浏览文件夹并快速切换文件。 |
| **图片集合** · Image Collection | 集中浏览生成的图片，查看提示词并复用创作思路。 |
| **站点收藏** · Saved Sites | 发现项目正在运行的网页，收藏常用网址，随时打开。 |
| **侧栏聚焦** · Sidebar Focus | 一键收起侧栏中的其他分组，再次点击恢复原来的展开状态。 |
| **隐藏额度推广** · Hide Usage Promotions | 隐藏输入框上方的套餐升级推广，让对话更清爽。 |

## 安装

MineCodex 支持 macOS 与 Windows 系统，需要 Node.js 22.5 或更高版本。安装程序会自动扫描 `/Applications/ChatGPT.app` 或 `~/Applications/ChatGPT.app` 寻找 Codex Desktop；在 Windows 上则通过 MSIX 包（`OpenAI.Codex`）定位官方 ChatGPT 应用并校验 OpenAI 签名。如果均未找到，安装将暂停并给出说明。

```bash
npm install -g minecodex
mcx install
```

运行 `mcx install` 不会强制关闭或启动 Codex，也不会影响当前打开的窗口。安装完成后，终端会说明更改将在下一次重启 Codex 时生效，并询问是否立即重启；默认选项为 **No**。只有在您明确确认，或后续手动运行 `mcx restart` 时，才会重新打开 Codex。安装完成后，macOS 的“登录项与扩展”中会添加名为 **MineCodex** 的后台项目。

`mcx install`、`mcx update`、`mcx restart` 和 `mcx uninstall` 会在终端持续显示当前阶段；`mcx open` 仅在需要启动后台服务时显示进度。查询类命令保持简洁，便于直接阅读或用于脚本。

MineCodex 只以后台辅助服务运行，前台应用始终是 OpenAI 签名的官方 ChatGPT 应用，并继续使用官方默认用户数据。通过 Dock、Finder、Spotlight、登录项或会话恢复打开 ChatGPT 时，后台服务会验证官方应用与对应进程；若该进程尚未开放兼容的本机调试端口，则确认其完整退出后再重新打开官方应用并注入功能。MineCodex 不修改官方应用文件、`app.asar`、Dock 项目或默认打开方式。在 macOS 上，后台项目出现在"登录项与扩展"中；在 Windows 上，后台任务出现在任务计划程序（任务名 `MineCodex`）。

打开本地控制台：

```bash
mcx open
```

常用命令：

| 命令 | 作用 |
| --- | --- |
| `mcx install` | 安装或修复 MineCodex |
| `mcx uninstall [--purge]` | 移除扩展；默认保留个人数据，带 `--purge` 参数才会清理 |
| `mcx update` | 更新到最新的稳定版本 |
| `mcx open` | 打开 MineCodex 控制台 |
| `mcx status [--json]` | 查看安装与插件运行状态 |
| `mcx restart` | 重启 Codex 并应用插件开启/关闭状态 |

关闭某项功能仅停用对应的扩展服务，不会删除任何个人数据；修改设置后运行 `mcx restart` 即可应用更改。

运行 `mcx uninstall` 会移除名为 MineCodex 的后台项目，并默认保留配置设置、Notes 笔记和 Images 图片索引；只有显式加上 `--purge` 参数，才会清理 MineCodex 产生的本地配置。MineCodex 绝不会删除 `~/.codex/generated_images` 中的原始图片或 Notes 引用的本地文件。

## 数据与图片操作

本地 Image Gen 浏览、搜索、提示词查看和下载不会创建云端图片。首次收藏或加入文件夹时，会将所选图片上传到 OpenAI 的 Library；收藏和文件夹关系由云端保存。首次上传后取消文件夹选择，已产生的云端副本仍会保留，界面会提示“图片已保存到 Library，但未加入文件夹”。

图片生成编辑可能通过原生能力准备临时上传附件；查看图片不会触发这类操作。从 Image Gen 删除仅隐藏本地索引条目，保留原始图片和云端副本。卸载或 `--purge` 不会删除云端图片，也不会删除 Codex 的原始生成图片。

## 更新后的自检

MineCodex 在每个 Codex 窗口启动并完成注入后，后台检查一次功能安装、原生锚点与实际使用的设计变量。新窗口、页面重载或重新接入时重新检查；结果代表检查时的页面，不持续监测后续页面切换。控制台区分“正在自检”“部分窗口可用”“外观适配需要更新”“暂不可用”和“当前页面不适用”。没有输入框或未打开 Sites / Images 时，相关功能可能不适用，并不直接表示版本不兼容。

可使用控制台的“复制诊断信息”提供自检结果。诊断包含功能、窗口、锚点与设计变量证据，不包含提示词、聊天内容、账号资料或安装路径。自检可用表示当前检查项通过，实际保存、上传、模型切换等操作仍以各自的结果为准。

## 工作原理

MineCodex 统一管理 Codex 内的菜单入口、主题风格与界面适配。Model Slider、Prompts 各自管理操作界面，Images 在原生 Images 中接入本地生成图片和提示词查看；Session Status 只读汇总本机 Codex 会话事件，Hide Upsell Banner 优化界面展示。所有功能按需开启，关闭后即停止运行。

## 开发

```bash
npm install
npm test
npm run check
npm run pack:check
npm run pack:audit
```

维护者发布流程见 [GitHub Actions 发布说明](https://github.com/Vontean/MineCodex/blob/main/docs/npm-publishing.md)。发布工作流仅允许维护者本人触发，使用 npm 可信发布，无需长期访问令牌。

## 许可

MineCodex 是非官方独立扩展项目，与 OpenAI 无关联。项目自有代码以 MIT License 授权；第三方图标、品牌和兼容资产遵循各自的权利说明，见 [`features/model-slider/THIRD_PARTY_NOTICES.md`](features/model-slider/THIRD_PARTY_NOTICES.md) 与 [`features/session-status/vendor/lucide-LICENSE`](features/session-status/vendor/lucide-LICENSE)。

## 侧栏聚焦

展开侧栏时，点击铃铛与搜索之间的聚焦按钮，保留当前任务路径并收起其他分支。再次点击恢复原先布局；切换任务时跟随路径，手动调整分支时退出聚焦。

## 从账号菜单打开控制台

在 Codex Navbar 底部打开账号菜单，点击 Settings 下方的 **MineCodex ↗**，即可在外部默认浏览器打开本地控制台，等同于 `mcx gui`。macOS 默认 Safari、Chrome/Chromium、Edge、Brave 和 Vivaldi 会定位已有控制台标签页，没有时才新建；首次定位可能需要系统自动化权限。其他浏览器与 Windows 仍由系统打开 URL。

### 在电脑之间迁移数据

在 `mcx gui` 底部打开「数据迁移」，导出 `.mcx.json` 文件，再到另一台 Mac 或 Windows
电脑的同一入口导入。确认前可查看新增、重复和冲突数量。只补充缺失项，重复项跳过，
冲突保留本机版本，不删除已有数据。

支持 Prompts 与分类、公网 Sites、模型收藏。模型旧收藏在新版模型滑条首次启动后收录，
导入收藏在下次启动 Codex 后载入。图片文件、本地站点、账号信息与设备设置不包含在文件中；
可迁移功能的特殊说明可通过 info 查看。这是手动迁移，不是自动云同步。文件包含提示词正文，请妥善保管。
