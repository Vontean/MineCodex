# 新版 Codex 的 Session Status 挂载检查

检查环境：2026-10-02，Codex 26.930.21537。读取日常窗口真实 DOM 与计算样式，在独立 profile `/tmp/mcx-session-position-20261002`、CDP 9233 中使用原生 footer DOM 的副本和完整 Session Status 注入脚本验证。日常 Session Status 开关保持关闭。

## 挂载结论

- Composer root 仍为 `[data-codex-composer-root][data-composer-placement="thread"]`，身份仍来自内部 portal 的 `data-above-composer-conversation-id`。
- 状态行继续插在 root 后面。root 的两个 `display:contents` 祖先使其与状态行一起参与外层 `flex-col gap-2` 布局，不需要迁移挂载点。
- reasoning 按钮的最近 `items-center` 控制组依旧有效；折叠入口在该组内、模型包装节点之前。
- 原生 Context 环的结构未变：`app-primary` 中仍为带 `role=img` 与 `aria-label` 的 span；其调用的 shared 百分环组件仍输出 SVG circle，因此原生重复入口的识别无需更新。当前日常窗口未开启原生 Context 环，此项来自安装包源码核对。

## 必要更新

旧 `.bottom-0.pb-4` 留白选择器失效。真实主聊天 footer 标记为 `[data-thread-scroll-footer="true"]`，默认 padding class 为 `pb-(--thread-composer-bottom-inset)`，实测 padding-bottom 为 16px。

改为仅在展开且可见的状态行所属 footer 上设置 `--thread-composer-bottom-inset:4px`。通过变量继续使用原生 padding 规则；隐藏、收起或卸载后恢复原值。`thread-scroll-layout` 源码显示 panel 使用独立 `pb-3`、compact 使用独立布局，这两者不消费该变量，不强制改成主聊天留白。

## 隔离 Renderer 验证

| 状态 | 结果 |
| --- | --- |
| 原生基线 | padding-bottom 16px；旧 `.pb-4` 选择器不匹配 |
| 旧规则 + 展开状态行 | padding-bottom 16px，确认旧规则失效 |
| 新规则 + 展开状态行 | padding-bottom 4px；Composer 与状态行各宽 736px，垂直间距 4px |
| 收起 | padding-bottom 恢复 16px；状态行退出布局，入口宽24px，在模型左侧，垂直中心偏差0px |
| 卸载 | padding-bottom 恢复16px；原模型节点仍连接 |

Session Status 定向测试7项、144个 JavaScript 文件语法检查与 diff 检查通过。前一轮卡死修复已通过全量334项测试；此次只修改样式和设计文档。

以上为真实 DOM 取证和隔离 Renderer 中的 DOM 副本验证。没有开启日常注入，没有修改原生设置；未通过 UI 进行真实旧 Thread、侧边聊天、窗口宽度切换的手动验收。panel/compact 结论限于源码分支核对。
