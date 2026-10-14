<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="MineCodex：让 Codex 更顺手">
</p>

# MineCodex

为 Codex Desktop 添加轻量扩展，按需开启，让日常使用更顺手。

## 功能

| 插件 | 功能 |
| --- | --- |
| 模型窗口 | 切换模型和思考强度，搜索、收藏常用模型。 |
| 提示词库 | 分类管理提示词，一键填入输入框，不自动发送。 |
| 额度环 | 查看五小时与每周剩余额度，点击打开用量详情。 |
| 会话状态 | 查看回复速度、Token 用量和上下文占用。 |
| Markdown 阅读增强 | 改善文档排版，支持章节目录、表格展开和代码复制。 |
| Mermaid 图表增强（实验性） | 独立开关，默认关闭；支持图表缩放与 PNG 下载。 |
| 文件级联浏览 | 点击文件路径，分列浏览目录并切换文件。 |
| 图片集合 | 浏览本机生成图片，查看提示词，收藏到 Library。 |
| 站点收藏 | 发现本地项目网页，收藏网址并快速打开。 |
| 快捷聊天增强 | 恢复快捷键，发送后展开，支持历史与窗口固定。 |
| 侧栏聚焦 | 收起其他任务分组，再次点击恢复布局。 |
| 隐藏额度推广 | 隐藏输入框上方的套餐升级推广。 |

## 安装

支持 macOS 与 Windows。先安装 Codex Desktop 和 [Node.js](https://nodejs.org/) 22.5 或更高版本，然后在终端运行：

```bash
npm install -g minecodex
mcx install
mcx open
```

安装后重启 Codex 即可使用。在控制台按需开关功能，修改后运行 `mcx restart` 应用设置。

如需在 Codex 内打开控制台和 Prompt 页面，先安装 [Codex CLI](https://developers.openai.com/codex/cli/)，再运行 `mcx plugin install`，从 Explore／探索中打开。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `mcx open` | 打开控制台 |
| `mcx update` | 更新到最新版本 |
| `mcx restart` | 重启 Codex 并应用设置 |
| `mcx status` | 查看运行状态 |
| `mcx uninstall` | 卸载，保留个人数据 |

## 许可

[MIT](LICENSE)。MineCodex 是非官方独立扩展，与 OpenAI 无关联；第三方素材遵循各自的[权利说明](features/model-slider/THIRD_PARTY_NOTICES.md)。
