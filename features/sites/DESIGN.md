# Sites 扩展设计约定

状态：原生 Sites 增强，沿用宿主当前主题。开发来源与托管位置分开。

## 用户路径

Sites 标题工具区增加次要操作 Add site，保留官方 Create。添加弹窗默认展示 Codex 本地项目中的网页入口候选（含未启动网站），不显示重复的项目分组标题，项目名称仅在候选次级文本呈现；候选使用 checkbox 多选，点击整行切换勾选；已收录项勾选且禁用。两个模式底部统一提供 Cancel / Add，项目模式未选择时禁用 Add，点击后才批量收录；取消不保存选择。候选不自动收录；扫描不启动服务。打开已收录的未启动站点时，使用支持的启动方式按需启动。弹窗使用「Project / Custom」分段按钮切换；切换保留已填写的网址；项目模式自动扫描并直接展示候选，不显示搜索框、说明行或刷新按钮。「自定义网址」只提供网址和名称，默认作为外部网址收录，在无项目聊天中打开；不显示开发来源及说明。网址与名称均必填；名称不能仅含空白且最多160字符，网址须为不含嵌入凭证的有效 HTTP(S) 地址。不符合时禁用 Add，输入变化后实时更新。项目关联自动来自扫描，不在编辑弹窗暴露。

通过 MineCodex 添加的条目统一展示在 Added by you 标签的列表/网格，Owned by you 和 Shared with you 保持官方条目；使用同一搜索框。标题下只显示主机地址与端口；访问列用图标 + Local address / External site，沿用原生 16px 图标、主文字色、text-sm 与 gap-1.5。Added by you 同时包含 Local 和 External，访问列继续区分地址类型。操作列复用原生外部箭头，在默认浏览器打开；Project 条目菜单只提供移除，Custom URL 可编辑网址与名称，沿用添加校验。移除只移除入口。

## 原生 token 与组件

- 字体：`--font-sans-default`；正文 `--text-base`，次要信息 `--text-sm`；标题沿用原生标题类。
- 颜色：`--color-text-primary` / `--color-text-secondary` / `--color-text-tertiary`；背景 `--color-surface` / `--color-surface-elevated` / `--color-surface-elevated-secondary`；边框 `--color-border`。不写死浅色或深色色值。
- 列表：复用原生 row 的 grid/subgrid、82px 最小高度、16px 内边距、rounded-xl 与 primary-ghost-hover。
- 网格：原生 210px 卡片，148px 预览与62px信息区；rounded-2xl、border-subtle、surface-card、shadow-sm。
- 按钮：复用原生 `_Button` 与 `_ButtonInner` 类以及 data-color / data-variant / data-size 状态接口。Add site 为 secondary outline；确认沿用 primary solid。
- 弹窗：对齐原生 Sites Share 的 modal-shell，最大宽度560px，正文16px × 20px内边距；`--radius-3xl`、浅色 `--color-surface` / 深色 `--color-surface-tertiary`，`--modal-backdrop-dim-shadow`，不加半透明磨砂。标题使用 `--text-heading-md` / semibold / 1.4 行高，与内容间距16px；关闭为原生 secondary ghost sm uniform。底部独立 `--color-border-subtle` 分隔线，16px × 20px内边距、8px按钮间距。原生 dialog 的 Escape、焦点圈定与关闭后焦点恢复。
- 分段按钮：使用原生 segmented-control 的统一底板、等宽选项及选中块，复用 gap/gutter/background/font-weight/thumb-background/thumb-shadow/option-highlight token；控件尺寸为 control-size-md，支持方向键切换与选中状态语义。
- 输入：原生正文、边框和 `--color-ring` token（仅改变边框色）；标签在上，不用 placeholder 代替标签。
- 图标：从原生 Sites、Create、行菜单节点克隆 SVG；不重画。扫描结果和添加后的条目异步获取真实网页截图，本地缓存；完成后替换占位。没有截图时保留原生 Sites 图标，不阻塞选择和添加。
- 动效：沿用原生按钮反馈，不加装饰动效；尊重 reduced-motion。

## 打开与布局

通过原生 router 的项目 state、本地执行模式（prefillLocalExecution / prefillComposerMode）新建项目草稿，或定位无项目 thread，随后打开原生浏览器。保留原生已有未发送草稿，不发送消息。源关联失效时提示从可用项目重新添加，不静默变成外部来源。

浏览器就绪后收起聊天侧栏，调用原生 Enter full view，使当前网页占据完整工作区，并保留原生 Chat/网页标签及底部聊天输入框。已在 full view 时不反向切换；官方站点沿用原生打开路径，同样进入 full view。

## 验证

隔离 profile 验证发现、添加、路由、列表/网格、搜索、明暗主题、移除、服务停止后的保留；日常安装不注入开发实现。原生内部选择器变化时显示明确错误，不写死聊天宽度。

自定义网址的添加与编辑使用相同的两项表单，不提供来源选择浮层。关闭复用原生图标与 sm uniform 按钮；项目网页直接展示扫描结果，不重复显示项目分组标题。添加网址仅在分段面板中填写，不再提供底部重复入口或二级返回跳转。

More 菜单复用原生 Sites menu/menuitem/leadingIcon 类与 token：220px 最小宽度、4px gutter、菜单项 5px × 8px 内边距、16px 图标、6px 内容间距；文案为 Edit / Remove。Edit 复用原生 SVG，Remove 使用 Lucide trash-2，随主题继承文字色，悬停/聚焦时图标由75%到100%不透明度。

预览图加载使用主题文字色与 surface 混合的6%/16%渐变、1.6s单向扫光与 reduced-motion 规则；图片解码成功后替换骨架，失败才显示图标占位。Project websites 缩略图固定96×60（8:5），各加载状态不改变布局。外部箭头通过 electronBridge.sendMessageFromView 发送 open-in-browser，不使用普通 window.postMessage。

图标占位沿用预览区域的横幅比例和尺寸，不退回方形。使用 --color-background-primary-soft 浅灰底与 --color-text-primary 图标色（浅色模式黑色，深色模式对应主题色）。

预览区域描边复用原生 Sites 的 inset 0 0 0 1px var(--color-border)，覆盖于图片/骨架/占位之上，不增加布局尺寸。项目站点副文本显示项目名；确认运行时附加全角括号中的端口号，例如 VonDoc（49706），未运行仅显示 VonDoc。不在界面展示历史时间。无项目归属的 Custom URL 继续显示地址。


### 添加弹窗按钮（原生对齐修订）

底部与原生 Share 一致，采用 `_Button` 的 xl / pill / solid：36px高度（`--control-size-lg`），字号 `--control-font-size-md`，横向间距由原生 gutter 与 pill scaling 决定。Add / Save 为 primary，Cancel 为 secondary。同步 disabled、aria-disabled 与 data-disabled，复用 `--color-background-disabled`、`--color-border-disabled`、`--color-text-disabled`，禁用态不保留可用态的黑色强调。

模式选择使用真正的 segmented button：两项等宽，统一底板，选中块使用原生 thumb 背景及阴影；不再使用 Sites ownership tabs 的独立胶囊外观。尺寸与颜色引用原生 control / segmented-control token，随明暗主题变化。

扫描等待使用三行结果骨架：96×60横幅、标题及项目名短条，复用预览图的原生 shimmer token，逐行错开动画相位。仅辅助技术读出查找状态，结果区标记 aria-busy；无虚构进度，扫描完成直接替换，沿用 reduced-motion 静态降级。

未选中分段选项与 Cancel 共用 secondary-solid 配色：底板 background-secondary-solid，文字 text-secondary-solid，悬浮和按下分别使用 secondary-solid-hover / active；不再单独混合透明色。选中块保持原生 thumb 样式。

预览加载骨架绝对铺满图片区域，以窄斜向扫光带呈现明确运动，避免宽缓渐变看起来像静态灰块；图片解码完成才替换，失败才显示图标占位。

Custom 地址分类：localhost/回环、IPv4私有网段及链路本地、IPv6私有及链路本地、.local 使用 Local address；公网IP及普通域名使用 External site，不推断访问权限。普通域名不做DNS推断，故内网自定义域名可能归为外部。已有条目读取时同步重新分类。

打开 Project 网页前等待新草稿的 ComposerScope focusComposerNonce 与本次导航一致，避免仅检查输入框存在而误用旧聊天。浏览器打开消息同时携带站点目录（无目录时取项目根目录）作为 cwd。
