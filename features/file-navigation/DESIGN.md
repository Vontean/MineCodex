# 文件路径导航

通用视觉遵循根 DESIGN.md。独立功能 `file-navigation` 默认开启，保留已有显式关闭设置，可在 Markdown 阅读关闭时运行；控制台使用独立卡片，紧跟 Markdown 阅读增强，两个配置和生命周期互不依赖。

## 交互

- 原生文件路径胶囊作为整体入口，无新增下拉箭头；最多显示三级，较深路径显示省略号、父目录、文件名。窄面板优先保留文件名。
- 点击打开单个分列浮层。点击文件夹在右侧浏览下一层，切换兄弟目录删除旧分支。点击文件立即调用原生选择动作并关闭；点击外部、Escape、切换文件或禁用时关闭。
- 没有标题栏、列标题、确认栏、关闭按钮或 Preview / Source 控件。原生编辑、预览和文档内容不属于本功能。
- 浮层从原生胶囊外边缘定位，间距采用 `--mcx-spacing × 2`（当前 8px），上下方向一致；这是本功能选用值，原生通用 Popover 默认 sideOffset=4、原生 breadcrumb 特例=1，不存在专用间距 token。
- 浮层跟随文件面板可用区域，宽度最多 744px、高度最多 320px，每列 248px；深层横向浏览，各列由原生文件树管理纵向滚动与长文件名。
- 列分隔线采用 1px `--mcx-color-border`，比 subtle 一级更清晰。文件夹固定使用原生 folder 图标，不随选择切换为展开箭头。
- 鼠标点击仅保留原生选中背景；行描边只在 `:focus-visible` 时显示，保留键盘操作的位置提示。
- Enter 打开文件，右方向键进入文件夹，左方向键回到前列，Escape 返回入口；原生文件树管理上下选择与焦点表现。

## 原生适配与恢复

Codex 26.930.21537：依据安装包 breadcrumb、workspace-directory-entries-query、base-file-tree 的源码与隔离窗口实测。文件行直接使用原生 Tree 的 dropdown 分支（图标、hover、选中、字体、截断与主题），浮层使用共享 UI 的 opaque Popover；入口保留原生 capsule / controlSurface。路径内部的分隔图标从原生节点复制，不增加展开提示图标。

领域仅拥有路径压缩与分支选择规则。Adapter 负责原生路径上下文、宿主目录请求、文件选择回调、模块依赖与 Provider 接入，输出内部条目及命名动作。前端不解析 React、原生事件路径或响应对象。sourceFactory 显式序列化所有函数，不依赖 Renderer imports。

Codex 26.1021.31345 的目录 query 将读取委托给 `workspace-directory` 导出的 `workspaceFiles.listDirectory` 包装函数；Adapter 沿用其 host/workspace/directory 参数与 AbortSignal，兼容旧请求绑定，不向业务层暴露新宿主协议。当前 macOS 隔离 Renderer 已验证组件加载与仓库目录读取；完整鼠标级联仍需原生窗口验收。

原生导航节点原位保留，禁用恢复显示。关闭或分支变化后丢弃过期异步结果；列 React 根在关闭与卸载时释放。原生模块失效时恢复原生入口，目录加载失败只在所属列提供重试。

Codex `26.1027.30824` 将 breadcrumb、目录查询包装和文件树相关独立模块合入 initial。
Adapter 保留旧独立模块分支；缺少旧模块时，从当前入口按 Tree 的原生 props 与导出识别
文件树，沿该函数所属的 React 绑定和初始化器连接，只初始化该角色。目录读取按原生
workspaceFiles.listDirectory 与取消包装的调用关系取得，原样传入参数和 AbortSignal。
folder 图标也仅初始化对应角色，不执行入口中不相关的初始化器。共享模块定位规则见
[Codex Adapter](../../packages/codex-adapter/DEVELOPMENT.md)。独立 Renderer 已验证这些
接口加载；目录点击、键盘与可见浮层仍需单独验收。
