# 2026-10-01 架构迁移验证

## 回退与范围

- `1087c03`：迁移前的弹窗按钮、遮罩及 sidebar 层级修正。
- `ffd32c5`：迁移前的通用规范与架构文档；完整可回退基线。
- 本次迁移在本地完成，未推送、发布或更新日常安装。版本仍为2.0.2。

共享 UI 迁入 `packages/ui`；Prompt/Sites 的前端入口、CSS、图标与后端分离；会话指标归约与日志读取、云 Library 业务回归功能领域。旧迁移位置文件删除。项目领域与架构原则见根 ARCHITECTURE，视觉规则见根 DESIGN，内部导航见 AGENTS。

## 代码与安装包

- 306项测试通过：包含现有业务回归、实际自包含UI安装源码、模态焦点、组件角色、Composer主体锚点与zoom、资源目录约束、云图片evaluator、UI与领域层依赖方向。
- 110个JavaScript文件语法检查通过；函数体脚本按照manifest识别，不当作普通模块解析。
- npm包审计通过，137个文件；组件库、迁移后代码与前端资源均在发布名单内。
- 实际生成npm包并解压验证：宿主模块imports成功、9个功能声明可加载、两个前端资源完整、注入及前端函数体可编译。仅构建验证包，未发布。
- 本次相关文档26个相对链接有效，git diff --check通过。

## 隔离 Runtime 与 DOM 验证

隔离 Codex 26.928.21956，Runtime版本104，9个功能启用；原日常runtime不修改。

| 检查 | 实测结果 |
| --- | --- |
| Prompts 页面 | 24条内置条目，Page角色，层级20，12px圆角；正文预览max-width为65% |
| Prompts 管理弹窗 | opaque，白色不透明填充，容器无blur，25px圆角；0.5px边缘与shadow-lg；遮罩50%浅灰和1px blur |
| 操作按钮 | Cancel为ghost，透明无描边；Save/Add为primary；36px高、胶囊圆角 |
| Sites Add site | 资源加载成功，Project/Custom两面板、opaque外壳和共享按钮正常；焦点位于原生dialog内 |
| Escape | Prompts自定义模态与Sites原生dialog均可关闭；共享焦点规则另由真实接口测试覆盖 |
| Quick Prompts | ComposerMenu角色，不透明、无blur/投影、1px边框；浮层底缘距输入框主体4px |
| 排序菜单 | Dropdown menu角色，90%填充与8px blur，独立dropdown阴影 |
| Session Status | 回合/步骤/TPS、token累计及Cache仍更新；详情为opaque Popover，无blur，层级50；info图标12px |
| Tooltip | 声明式Tooltip与额度/上下文特有Tooltip共用材质，业务内容与定位仍由功能维护 |
| Sidebar层级 | 原生aside仍为40，注入Page为20；不修改原生peeking状态机 |

这些是Runtime、DOM与计算样式证据，不宣称深色全场景或全部原生窗口的人工视觉验收。原生GUI自动化工具拒绝访问Codex App，完整物理鼠标hover验收未完成；隔离预览窗口保留给用户检查。
