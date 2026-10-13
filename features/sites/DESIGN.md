# Sites 扩展设计约定

通用视觉、材质、按钮、Tooltip 与原生 sidebar 层级遵循根 [DESIGN.md](../../DESIGN.md)。本文件只记录功能特有组件、布局、数据语义与通用组件选型。

状态：原生 Sites 增强，沿用宿主当前主题。开发来源与托管位置分开。

## 用户路径

Sites 标题工具区增加次要操作 Add site，保留官方 New。添加弹窗默认展示 Codex 本地项目中的网页入口候选（含未启动网站），不显示重复的项目分组标题，项目名称仅在候选次级文本呈现；候选使用 checkbox 多选，点击整行切换勾选；已收录项不再出现在候选列表中。两个模式底部统一提供 Cancel / Add，项目模式未选择时禁用 Add，点击后才批量收录；取消不保存选择。候选不自动收录；扫描不启动服务。打开已收录的未启动站点时，使用支持的启动方式按需启动。弹窗使用「Project / Custom」分段按钮切换；切换保留已填写的网址；项目模式自动扫描并直接展示候选，不显示搜索框、说明行或刷新按钮。「自定义网址」只提供网址和名称，默认作为外部网址收录，在无项目聊天中打开；不显示开发来源及说明。网址与名称均必填；名称不能仅含空白且最多160字符，网址须为不含嵌入凭证的有效 HTTP(S) 地址。不符合时禁用 Add，输入变化后实时更新。项目关联自动来自扫描，不在编辑弹窗暴露。

通过 MineCodex 添加的条目直接追加在 Space → Sites 的原生列表/网格中，保留官方条目，共用原生搜索与列表/网格切换，Plus 独立 Sites 页面增加 Added by you 标签，只显示通过 MCX 添加的条目；Owned by you／Shared with you 保留官方内容，切换时恢复原生列表。Space 无 ownership tabs 时保持现有混排。标题下只显示主机地址与端口；访问列用图标 + Local address / External site，沿用原生 16px 图标、主文字色、text-sm 与 gap-1.5。Local 和 External 同时展示，访问列区分地址类型。操作列复用原生外部箭头，在默认浏览器打开；Project 条目菜单只提供移除，Custom URL 可编辑网址与名称，沿用添加校验。移除只移除入口。

## 原生 token 与组件

- 列表：复用原生 row 的 grid/subgrid、82px 最小高度、16px 内边距、rounded-xl 与 primary-ghost-hover。
- 网格：原生 210px 卡片，148px 预览与62px信息区；rounded-2xl、border-subtle、surface-card、shadow-sm。
- 按钮：复用原生 `_Button` 与 `_ButtonInner` 类以及 data-color / data-variant / data-size 状态接口。Add site 为 secondary outline；确认沿用 primary solid。
- 弹窗：选择通用 Dialog 的 opaque 分支（Sites Share），最大宽560px，不加独立操作区分隔线；当前通过 `config.ui` 接入。通用容器、遮罩、标题、Close及焦点契约遵循根规范。
- 分段按钮：使用原生 segmented-control 的统一底板、等宽选项及选中块，复用 gap/gutter/background/font-weight/thumb-background/thumb-shadow/option-highlight token；控件尺寸为 control-size-md，支持方向键切换与选中状态语义。
- 图标：从原生 Space 下的 Sites、New、行菜单节点克隆 SVG；不重画。扫描结果和添加后的条目异步获取真实网页截图，本地缓存；完成后替换占位。没有截图时保留原生 Sites 图标，不阻塞选择和添加。

## 打开与布局

通过原生 router 的项目 state、本地执行模式（prefillLocalExecution / prefillComposerMode）新建项目草稿，或定位无项目 thread，随后打开原生浏览器。保留原生已有未发送草稿，不发送消息。源关联失效时提示从可用项目重新添加，不静默变成外部来源。

浏览器就绪后收起聊天侧栏，调用原生 Enter full view，使当前网页占据完整工作区，并保留原生 Chat/网页标签及底部聊天输入框。已在 full view 时不反向切换；官方站点沿用原生打开路径，同样进入 full view。

## 验证

隔离 profile 验证发现、添加、路由、列表/网格、搜索、明暗主题、移除、服务停止后的保留；日常安装不注入开发实现。原生内部选择器变化时显示明确错误，不写死聊天宽度。

自定义网址的添加与编辑使用相同的两项表单，不提供来源选择浮层。关闭调用共享外壳的原生 Close；项目网页直接展示扫描结果，不重复显示项目分组标题。添加网址仅在分段面板中填写，不再提供底部重复入口或二级返回跳转。

More 菜单复用原生 Sites menu/menuitem/leadingIcon 类与 token：220px 最小宽度、4px gutter、菜单项 5px × 8px 内边距、16px 图标、6px 内容间距；文案为 Edit / Remove。Edit 复用原生 SVG，Remove 使用 Lucide trash-2，随主题继承文字色，悬停/聚焦时图标由75%到100%不透明度。

预览图加载使用主题文字色与 surface 混合的6%/16%渐变、1.6s单向扫光与 reduced-motion 规则；图片解码成功后替换骨架，失败才显示图标占位。Project websites 缩略图固定96×60（8:5），各加载状态不改变布局。外部箭头通过 electronBridge.sendMessageFromView 发送 open-in-browser，不使用普通 window.postMessage。

图标占位沿用预览区域的横幅比例和尺寸，不退回方形。使用 --color-background-primary-soft 浅灰底与 --color-text-primary 图标色（浅色模式黑色，深色模式对应主题色）。

预览区域描边复用原生 Sites 的 inset 0 0 0 1px var(--color-border)，覆盖于图片/骨架/占位之上，不增加布局尺寸。项目站点副文本显示项目名；确认运行时附加全角括号中的端口号，例如 VonDoc（49706），未运行仅显示 VonDoc。不在界面展示历史时间。无项目归属的 Custom URL 继续显示地址。


### 添加弹窗按钮（共享表单外壳）

Add / Save 选择通用 primary（solid），Cancel 选择 ghost；有实质功能的次级操作选择 secondary（outline）。项目模式未选择候选、自定义模式表单无效时禁用确认。页面工具区按钮继续复用原生 `_Button`。

模式选择使用真正的 segmented button：两项等宽，统一底板，选中块使用原生 thumb 背景及阴影；不再使用 Sites ownership tabs 的独立胶囊外观。尺寸与颜色引用原生 control / segmented-control token，随明暗主题变化。

扫描等待使用三行结果骨架：96×60横幅、标题及项目名短条，复用预览图的原生 shimmer token，逐行错开动画相位。仅辅助技术读出查找状态，结果区标记 aria-busy；无虚构进度，扫描完成直接替换，沿用 reduced-motion 静态降级。

未选中分段选项使用 secondary-solid 配色：底板 background-secondary-solid，文字 text-secondary-solid，悬浮和按下分别使用 secondary-solid-hover / active；不再单独混合透明色。选中块保持原生 thumb 样式。

预览加载骨架绝对铺满图片区域，以窄斜向扫光带呈现明确运动，避免宽缓渐变看起来像静态灰块；图片解码完成才替换，失败才显示图标占位。

Custom 地址分类：localhost/回环、IPv4私有网段及链路本地、IPv6私有及链路本地、.local 使用 Local address；公网IP及普通域名使用 External site，不推断访问权限。普通域名不做DNS推断，故内网自定义域名可能归为外部。已有条目读取时同步重新分类。

打开 Project 网页前等待新草稿的 ComposerScope focusComposerNonce 与本次导航一致，避免仅检查输入框存在而误用旧聊天。浏览器打开消息同时携带站点目录（无目录时取项目根目录）作为 cwd。

套餐优先读取 `accounts/check` 的当前账号记录，未加载时使用 `planAtLogin`。Plus 接入 `/sites`，其余已识别套餐保留 `/space/sites`；未知身份等待原生数据，不猜分支。两条路由都属于 Sites 页面，进入网页 full view 时须确认已离开它们。
标题区通过 New 的语义定位创建入口；按钮容器复用原生 lg secondary Button，不再假设 New 提供 data-variant。

2026-10-02 隔离原生页面验证：新版已移除 Site ownership 筛选组；注入不依赖该组，也不隐藏官方条目。仅在原生列表为空且存在匹配的本地站点时隐藏原生空状态，保留头部与工具区；搜索无匹配或卸载时恢复。空状态定位排除本插件节点。

添加候选行使用 flex 横排：96×60 预览、可收缩的标题/项目名、16px checkbox，间距12px；表单 label 的块布局不应用于候选行。New 的 SVG 带桌面隐藏类，克隆为 Add site 图标时移除该显示限制。

## 添加候选筛选

Project 模式保持单一完整列表，按标题首字母排序（忽略大小写、数字自然顺序），同名按项目名与路径稳定排序；不设推荐、数量上限、筛选 tabs 或版本展开。

同一项目、相同归一目录的迭代仅展示一个入口：识别目录段或后缀中的 v/ver/version/rev/revision 数字版本，以及 final/latest/copy/backup/old 副本标记，也识别 name-1.2.0 形式的发布目录。明确版本号最高者优先；无版本号或版本相同时按入口文件修改时间选取。修改时间只用于内部选择，不作为运行或访问时间。不同目录和项目不因标题相同而合并。此规则作用于当前已支持的站点入口，不额外枚举任意 HTML 文件。

排除明确自测/证据目录（test/tests、__tests__、fixtures、test-results、playwright-report、coverage、agent-tests/checks/notes/reports、self-test）及 docs/research、internal-notes、implementation-notes；明确自测报告/实现说明标题同样排除。带 SKILL.md 的技能目录下 demo/example/examples/preview 属于技能说明示例，同样排除；普通项目的 docs、demo、prototype 保留。历史记录仅补充当前磁盘入口或在线服务，失效历史记录从发现缓存清除；不删除用户文件或已保存站点。

已添加的 entryId、相同 URL 或同一迭代组不再呈现为候选；后端仍保留完整有效入口供已保存站点启动与解析，不自动迁移用户之前保存的版本。全部已添加时显示“暂无可添加的项目网页”。批量添加部分成功时，成功项从候选中移除，失败项保留选择。

## 浏览器快捷添加

Codex 26.930.21537 隔离窗口验证：浏览器 panel 的 More（Browser options）菜单在 Downloads 下方插入 Add to Sites，复用原生菜单行样式；保持 History 等原生动作及 Escape 行为。方向键可经过注入项，Enter/Space 可激活，卸载移除入口。

通过菜单所属浏览器的原生状态读取实时 URL、标题及本地 cwd，不读取地址栏草稿，也不使用其他选中标签的缓存。仅支持无嵌入凭证的 HTTP(S) 页面。点击后预填添加弹窗，沿用 Project / Custom 分段选择与网址、名称校验。已确认本地项目归属的本地地址默认 Project；其余默认 Custom。有本地项目上下文时可切换 Project，无归属时禁用该项。远程浏览器路径不映射为本机项目。

保存 Project 使用已确认项目身份，Custom 使用独立网址身份；复用既有重复检测。保存或取消后仍留在浏览器，不跳转 Sites，不发送聊天消息。原生 browserState、菜单动作及关闭协议仅由 Sites Adapter 解释，后端负责校验 URL 和本机项目目录归属。


## Plus 原生页面分支（2026-10-13）

Codex 26.1007.30912 的 Plus 独立 profile：Create Site 位于独立标题工具区；ownership 标签和实际内容区位于同一 min-h-full 外壳内，内容在最后一项，不是第二项。按可见搜索输入框定位，排除原生缓存的隐藏页面。Add site 紧邻 Create Site，复用其原生按钮与图标。

Added by you 沿用原生 browse 标签的选中／未选中 class 和键盘切换。原始 ownership 节点保留，通过隐藏并以镜像导航转发 Owned／Shared 动作接入；Added 只切换本地筛选，不伪造原生 selectedKey。它隐藏官方内容，MCX 条目使用独立列表／网格；原生搜索和视图切换继续生效。离开、账号切换与卸载恢复原标签及内容的原始 hidden 状态。无匹配时显示简短空状态。

原生共享能力确认可能在导航后移除整个 ownership 组。Plus 此时仍保留 Owned by you／Added by you，Shared with you 仅在原生提供时镜像；降级分支沿用本版本已测 browse class 与原生内容区 gutter。组重建或视图切换保持 Added 的选择。列表行必须包含原生 group/site-row，使末列动作的 hover／focus-within 规则生效。
