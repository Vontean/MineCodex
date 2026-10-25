# 长指令展开编辑

为 ChatGPT Work 与 Codex 的主输入框接入 Chat 的大尺寸编辑行为。Chat 继续由原生实现负责；Quick Chat、右侧面板输入框及隐藏或 inert 输入框不接入。

## 原生契约与选择

依据 macOS Codex 26.1013.40934 的安装产物与隔离 Renderer。Chat 原生以多段、包含换行或达到五行高度作为展开入口条件，并要求 multiline 布局。展开使用 `cmdAlways` Enter 行为，收起还原进入前的设置。

两种任务模式目前都使用 `data-codex-composer-root`，不能据此把 ChatGPT Work 误认成独立 Codex 模式。Adapter 只用此契约识别任务输入框，不切换模式或路由。

运行时按 `data-composer-expand-toggle` 语义定位 Chat 原生按钮的 Button、Expand 与 Collapse 导出，实际渲染原生控件。交易订阅使用原生 ProseMirror transaction observer；不改写 dispatch 或 React props。

Windows Codex `26.1021.3705.0` 的布局 className 也含同名 CSS 标记，因此定位必须匹配对象属性键及冒号，不能使用首次字符串命中。该构建的共享图标导出可能尚未初始化；仅在绑定值缺失时，沿真实导出和赋值发现其原生 once 初始化器，调用后重新读取实时导出。无法确认初始化契约时停止安装，不能渲染含 undefined 图标的控件。

展开尺寸由原生 `data-expanded-composer` 样式驱动，高度同时考虑窗口、内容容器与原生最大尺寸。会话页沿用原生底边锚定。

Codex 首页的原生任务输入区以 `flex-col justify-end` 锚定底边；通用展开标记会把外层首页 group 改成居中，因此需对这个底部输入区保留 `justify-content:flex-end`，使展开、收起时底边不跳动。Adapter 读取实际存在的原生首页与底部输入区，经典 Chat 和居中的 Work 首页不应用此分支。

Work 首页有明确的 MCX 布局选择：仅当任务输入框出现长文本展开入口时，未展开的标题区和输入区改用内容高度，并在原生首页空间内整体居中。原生固定比例分区会让长输入框主要向下增长、整体偏低，因此不在该状态沿用比例分区。Adapter 从原生首页 group、hero 与包含该输入框的兄弟区域确定作用域；同时释放 hero 内标题容器的原生 `min-h-28` 预留高度，避免空白占位被误算为可见标题。不移动节点，不写固定 top/bottom 或 transform 补偿。展开时交回原生布局，入口消失或卸载时撤销标记并恢复原分区；经典 Chat 不应用此修正。

不创建第二个编辑器，不移动或重建现有编辑器。附件、工具栏与底部项目条仍由原生布局管理。

## 生命周期与失败

Windows Codex `26.1016.8120.0` 的冷启动中，`app-main` 标签可能晚于 DOMContentLoaded 挂载。加载器使用 MutationObserver 等待 `app-initial` 与 `app-main` 同时就绪，成功或 AbortSignal 取消后释放监听，不通过一次查找失败永久停止安装。该构建已在隔离 profile 复现旧版失败并验证修复后的冷启动安装；完整草稿编辑交互仍按下述场景验收。

每个输入框独立持有开关状态和进入前的 Enter 行为。清空内容、改为单行布局、切换页面、替换 controller 或禁用功能时收起并撤销入口与订阅。保留同一份 ProseMirror 文档、selection 与撤销记录。原生绑定不再匹配时安装失败并交由宿主显示不可用，不猜图标或模拟输入。

## 验证

自动化验证原生绑定发现、入口阈值、场景排除、展开收起的 Enter 恢复与卸载清理，以及源码工厂序列化。隔离窗口验证 Work/Codex 首页与会话的原生增长方式、草稿/光标、Enter 换行、短文本收起和页面切换。Windows `26.1021.3705.0` 已在独立 profile 通过 Renderer 交互验证 Codex 首页多段草稿的按钮显示、展开/收起、编辑器/文档/selection 身份保留、Enter 行为切换与短文本入口清理；Work、会话页及视觉布局未在该构建逐项复核。测试指令不发送。

控制台图标使用 Lucide `maximize-2`，MIT 许可随功能附带；编辑器中的图标来自安装中的原生组件。
