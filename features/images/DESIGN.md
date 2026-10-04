# Images: native Library prompt contract

通用视觉、材质、按钮、Tooltip 与原生 sidebar 层级遵循根 [DESIGN.md](../../DESIGN.md)。本文件只记录功能特有组件、布局、数据语义与通用组件选型。

## Scope

Images enhances Codex's native Library image viewer, reached through Space → Images.
It also appends **Image Gen** after Your creations and Uploads in the native Image sources tablist.
This tab contains images generated locally by Codex or local Work. Browsing does not upload them; explicit Favorites/folder actions persist the selected image in native cloud Library.
The native tabs, content nodes and routes are retained. Leaving Image Gen restores native selection and content;
hover sidebars and the native full-page shell remain owned by Codex.

## Image Gen

全屏图片查看器使用原生 Canvas 的 `presentation:"overlay"`，由外层 CanvasLayout 的 `bg-surface` 提供背景。Codex 26.930.21537（2026-10-03 源码与 live DOM）：`dialog` / `panel` 分支会在内部画布叠加 `bg-surface-secondary`（当前浅色 #f7f7f7），不能用于这里的全屏画布。保留 standalone、原生 viewer header、底部编辑工具栏和 Composer 接入。

Codex 26.930.21537（2026-10-02 隔离实测）：通过原生 `variant="browse"` 的 Image sources 契约接入。保留原生标签节点及路由，在插件拥有的 React root 中复用同一个原生 Tabs 组件，追加 Image Gen；退出时恢复原节点。原生上下文由 Adapter 从当前已提交的组件祖先读取，业务层不遍历 Fiber。

本地来源复用 ImageLibrary、ThreadMetadataIndex 及文件监听，索引存放在当前 runtime profile；按生成时间倒序，每页 36 张，滚动增量加载，搜索复用原生输入框。稳定身份为 threadId + imageGenerationItemId，不猜测云端 ID 与本地文件的关系。

加载使用原生 Library Skeleton，排布使用原生 Masonry，悬浮效果使用原生 Library Card，菜单使用原生 Dropdown、Button 与 Menu。图库本地文件通过原生生成图片 resolver 读取；浏览时 Backend 提供索引中的来源路径，图片由原生 resolver 读取；显式云端登记才读取该索引 ID 对应的完整字节并校验内容指纹，不接受 Renderer 任意路径读取，不维护第二套图库加载协议。

点击图片进入原生 Library 主内容 viewport 内的图片画布，保留 navbar、Space 二级侧栏和窗口栏；不打开 side panel，也不使用覆盖整窗的 Dialog。画布、缩放、下载、打开、Markup、Comment、Remove BG、Erase、Resize 和底部 “Ask about this file” 输入框复用原生组件。底部直接使用画布的原生 `renderComposer` / overlay 承载，沿用底部留白、居中、避让和工具状态显隐；不得另建 absolute 底部输入框。进入 Comment 时隐藏大输入框，退出时恢复；原生拖拽工具栏保留位置记忆及 Home 居中重置。初始缩放与每张图的 Zoom to fit 使用原生 `zoom` 契约，`manualZoomPercent` 初始为 `null`，不自算比例，也不继承上一张图的手动缩放。关闭回到原列表并恢复交互，标注中的关闭交由原生编辑器处理。

2026-10-03 跟进原生文件预览：底部复用当前 File Composer 的本地任务分支，宽度 `min(48rem, calc(100vw - 2rem))`、`auto-single-line`、`surfaceVariant:"inline"`、隐藏 utility bar 和运行位置控件，输入布局、模型控件、权限、语音及发送按钮均由原生组件决定，不再固定旧 Chat 的单行组件。画布在主内容 viewport 内，因此只在此画布范围内去掉原生 overlay header 容器的窗口交通灯左右避让，保留原生 header 自身 8px inset。背景、缩放、Open、下载、关闭、菜单及编辑状态使用原生 Canvas；按当前产品要求保留黑色编辑行动条。底部预留区通过 ResizeObserver 读取实际 File Composer 高度，加原生 `spacing × 4` 底部 inset；不沿用原生旧输入框的 118px 最小预留。行动条默认位置与拖拽下边界共用此画布尺寸，输入框展开、收起或隐藏时同步更新；默认紧凑输入框 44px 时预留为 60px，行动条与输入框间距为 16px。

本地来源以真实路径、来源 thread 和生成项 ID 接入；底部输入框首次发送时通过原生文件服务准备本地临时附件，不上传云端、不伪造 Library 身份。关闭或切换账号后晚到的附件会释放；提交接受后沿用原生本地会话导航。黑色行动条的生成编辑仍在明确提交编辑时通过原生上传准备临时附件，同一画布复用编辑附件，查看不上传到 Library。附件使用原生返回的 `id`；不得把本地 ID 伪装为 cloud file ID。生成编辑调用原生提交能力，接受后沿用原生会话导航。View prompts 通过原生菜单扩展进入已有的 File info 风格面板。以上组件契约已按 Codex 26.930.21537 的产物与隔离窗口检查；实际云端生成结果须单独验证。

发送准备只在用户点击发送后进行，不在开始输入时预准备；本地字节转换直接填充 typed array，避免大图片经字符串迭代器生成中间数组。该优化只减少本地准备成本，不代表上传或原生提交网络等待已经缩短。

图库菜单复用原生 mediaOverlay More Button、Dropdown、Menu.Item 与原生图标，按 Chat about this、View prompts、Add to Favorites／Remove from Favorites、Download、Add to folder、Delete 排列。View prompts 的图标约束为菜单使用的 16px，不继承导航栏尺寸。项目现有 Lucide book-open 的合并路径图形随 Images 注入，资源位于 `src/assets/prompts-menu.svg`；图库 More、大图菜单和云端菜单共用此资源，不从 Prompts 导航节点临时取图，也不依赖 Notes 功能启用。

只有用户点击收藏或文件夹操作时，通过原生 Library upload（required persistence）上传所选 PNG；取得真实 Library ID 后保存账号、用户、本地图片 ID、SHA-256 内容指纹对应关系。收藏调用原生 setLibraryFavorite 并以服务器状态切换，文件夹使用原生 MoveLibraryItemsDialog；不在本地保存收藏或文件夹关系。云端节点读取采用原生 `/files/library/files/{library_file_id}/node` 契约，不能把上传返回的 Library ID 当普通内容 file ID。

取消选择通过原生 toast 服务反馈。该操作首次上传后取消显示“Image saved to Library, but not added to a folder.”；已有云端身份则显示“No folder selected.”。取消不删除云端图片、不移动文件；移动成功后的关闭不误报取消。浏览与打开菜单不上传，收藏状态查询不创建记录。

登记工作流位于 `src/frontend/cloud-image-actions.mjs`。同时操作同一图片复用在途任务，Backend 原子预留避免不同窗口重复上传。已确认的身份跨 Runtime 重启保留；内容变化或账号变化不复用。上传结果不确定时保留预留状态并用原生错误 toast 提醒检查 Library，禁止盲目重新上传；自动恢复不确定记录尚未实现。云端条目删除或访问失效时报告操作失败，不自动重新上传。

原生构建产物和组件导出契约集中在 `src/adapters/codex/native-image-source.mjs`。按实际模块引用发现构建文件，不固定哈希；契约不匹配时保留原生页面并报告能力缺失。`src/frontend/local-image-source.mjs` 仅负责来源选择、分页、搜索与清理，Runtime Host 只鉴权和转发 `local-image-source` 的 list / prompt 与身份登记操作。

## Entry and identity

The native `data-testid="viewer-header"` is the entry anchor. The current React
ancestor's Library image record supplies the Library ID, file ID, version and
originating conversation/message IDs. Non-Library viewers and non-image files
are excluded. No title, filename, image position or minified component name is
used as identity. Missing native anchors fail closed.

Codex 26.930.21537（2026-10-02 隔离实测）：Space 图片详情使用嵌入式视口，Adapter 从其原生 `relative flex h-full min-w-0 flex-1` 容器取得面板承载；浮层分支沿用 presentation 容器。缩放按钮包含隐藏的测量百分比，识别时读取 `innerText`，不读取包含这些测量文字的 `textContent`。

Prepare the Prompt panel as soon as the native image has both originating conversation
and message IDs and its viewer controls are ready; start source-conversation extraction in
parallel. This is eligibility to look up a prompt, not proof that prompt text exists.
Images without these source IDs have no View prompts entry. Exact generated-asset
validation remains part of extraction, so uploaded references never supply prompt text.

Opening while extraction is pending shows the complete File info-style header,
a disabled Copy button, and four static rounded skeleton lines in the body.
`aria-busy` marks the body; decorative lines are hidden from assistive technology.
Closing does not cancel prefetch. Success replaces skeletons with selectable text
and enables Copy. Missing generation text falls back to a traceable original request when available:
first disclose that the generation prompt is unavailable, label the body “Original
request”, and enable Copy with the accessible label “Copy original request”. If
neither kind exists, show the unavailable message and leave Copy disabled. Failure ends with
a localized message and Retry action. There is no perpetual loading placeholder.
Changing images or disabling the feature aborts the old request; late results
cannot change the new panel. Skeletons are static and respect reduced-motion.

The entry is a native-style “View prompts” / “查看提示词” menu item in the image
header's File actions dropdown, immediately before View original chat. There is
no dedicated right-toolbar button. Adapter validates the menu's current Library
file and the original-chat link's conversation/message IDs before inserting.
The item uses the native row classes and existing Prompts glyph; native React
nodes remain intact. It is recreated when the native menu remounts, without
refetching prompt content. Arrow navigation includes the injected item; Enter /
Space activate it. Opening dismisses the native menu, then focuses panel Close.
Panel Close / Escape return focus to the Image dropdown trigger.

## Prompt panel

The panel adopts the native File info accessory-panel branch, inspected in Codex
26.930.21537 on 2026-10-02. General material rules are maintained in the root
DESIGN.md; this feature uses the following native layout:

- Right and bottom gutters: two spacing units (8px). Top: `pt-13` plus the
  native wrapper's `pt-px` (53px from the viewer viewport top).
- Width: 74 spacing units (296px), constrained to the viewport minus both gutters.
- Header: `flex h-11 shrink-0 items-center justify-between gap-2 py-1 ps-4 pe-2`
  (44px); `h2` contains a `text-base font-semibold` title.
- Body: `min-h-0 flex-1 overflow-y-auto px-3 py-4` (12px horizontal,
  16px vertical padding). Prompt paragraph retains `px-1 text-sm leading-5
  text-default whitespace-pre-wrap break-words select-text` for long text.
- Header controls use the native File info circular `button-toolbar` filled
  ghost branch, with a 28px hit area. The close SVG is cloned from the native viewer.

Long text scrolls inside the panel, remains selectable, and is rendered with
textContent. The header Copy icon button reuses the existing Images Lucide copy/check glyphs
at 16px, with a 28px hit area and an accessible label/tooltip. It writes only the
generation prompt or original-request body to the clipboard and briefly confirms success. A generation prompt needs no source label; an original-request fallback must
include the missing-generation disclosure and its distinct label. Close and Escape return focus to
the Image dropdown trigger; Escape does not close the underlying viewer on the same press.

## Data and lifecycle

Read the source conversation through the running renderer's native authenticated
API; discover the API export through Library metadata's actual module imports,
without fixed build hashes. Prompt extraction does not copy credentials or signed download URLs. Explicit Favorites/folder actions upload the selected indexed image bytes through native Library; no third-party service receives them.

Match both the originating message and exact image asset pointer, and require
assistant/tool generation metadata. The Prompt viewer prefers a recorded
generator prompt: the exact asset's `dalle.prompt`, the exact result message's
`async_task_prompt`, or structured `prompt`/single `prompts` arguments from the
nearest image-generation tool call in its ancestor chain. Tool text is parsed as
JSON and never executed. Multi-image tool results do not infer per-image argument
ownership; unrelated tools, older generation calls and other branches are excluded. A traceable original user request is a different fact and is
shown only after an explicit missing-generation disclosure and “Original request” label. Unrelated branches are never used.

Changing images or leaving the viewer aborts the pending lookup and removes the
old UI. 等缩放工具栏和视口就绪后再开始解析，避免先到的提示词结果把稍后出现的原生锚点短路；同图的缩放节点或承载改变时重新挂载。 Late results cannot mount against a different image. Disabling the feature
removes the observer, keyboard handler, button and panel. Prompt data is retained
only for the current viewer; there is no persistent conversation cache.

The viewer and retained cloud import utility share `src/domain/library-prompt.mjs`. The source factory serializes that pure rule into the viewer script; the cloud adapter serializes the same function into its evaluator call. The shared resolver distinguishes generation from request provenance; the viewer
preserves that distinction in fallback disclosure and labels. The historical import utility can retain a
traceable request with its distinct provenance. A valid generated image without prompt text can still be imported by the historical utility, while the viewer shows no prompt control.

### 本地提示词

Image Gen 按已索引的精确图片 ID 提取对应 thread 的生成记录。已完成 `image_gen.generation` 的 revisedPrompt 优先于可静态解析的工具请求参数。没有真实生成提示词则明确显示不可用。云端图片保留 generation → 已标明来源的 Original request 回退；已移除没有实测命中的云端 gen_id → 本地文件猜测补充链路。

2026-10-02 菜单核对：网格 More 使用原生 Library 的 mediaOverlay 分支，操作通过 leftIcon 传入真实原生图标。菜单按 Chat about this、View prompts、Add to Favorites／Remove from Favorites、Download、Add to folder、Delete 排列。收藏和文件夹使用真实云端 Library 身份；Delete 仅持久隐藏 Image Gen 条目。Chat about this 组合原生模式切换、新 Chat 草稿导航与图片面板链路，不发送消息；图片随消息提交的实际链路未进行发送验收。生成图片通用菜单中的重复查看、新标签、复制和 Finder 不混入图库菜单。Image Gen 不提供 Rename 与 Share。


## Image Gen 多选与隐藏

Codex 26.930.21537（2026-10-02）：卡片通过原生 Card 的 selection、selected、selectionActive 与 onSelect 契约接入；圆形 Checkbox 使用原生 overlay 分支。选中后显示原生边框，支持 Checkbox、选择状态下点击卡片、Shift 区间选择、动作条 Clear selection 与 Escape。查询变化、切换来源、离开页面释放选中状态；分页加载保留已选条目，不污染原生 Your creations／Uploads 的 selection atoms。

缩略卡片沿用已核对的 Library 比例边界，宽高比限制在 1/2 至 20/13。卡片与图片比例分开处理：比例范围内按原比例展示；超出范围使用 object-contain 完整缩放并居中，极宽图上下留白，极窄图左右留白，不裁切图片内容。此显示策略按用户截图与验收要求实现，不将 Library 通用 object-cover 分支视为完整的 Images 展示规范。原图详情不改变比例。不能直接用原始极宽／极窄比例承载 Card，避免 More 与右下 Checkbox 重叠或单张卡片过高。

动作条复用原生 Button、Dropdown、Menu、图标与 Library 布局分支，固定在底部，dark 材质，包含数量、Start chat、Download、Delete、More→Move 和 Clear selection。Start chat 调用原生 Chat 附件上传和草稿导航，不发送消息；Download 使用原生保存流程逐项处理；Move 在明确点击后登记所选图片并使用原生文件夹选择器，选择本身不上传。权限／忙状态属于当前操作，不伪造云端图片身份。

Delete 在单张 More 与批量动作条共用一条隐藏流程，复用原生 Dialog、LibraryItemConfirmationContent 和实色警戒确认按钮。确认标题明确限定 Image Gen，正文明确“仅隐藏，本地原图和云端副本保留”。取消不改变任何条目；确认成功后立即移除当前条目、更新选中数、列表总数和分页偏移，并显示原生 toast。隐藏 ID 存于当前 Runtime profile 的 `hidden-image-ids.json`，本地源文件、原始生成提示词及已登记云端身份不修改；刷新和重启后继续隐藏。


## 维护接口（2026-10-02）

`adapters/codex/native-image-modules.mjs` 拥有构建产物读取、import 引用与组件发现。导航、图库、画布分别连接，画布与 Composer 在用户打开图片时加载；画布契约失效通过操作反馈报告，不移除仍可用的图库。Composer 角色按文件预览实际调用关系解析，不固定压缩变量名。

`adapters/codex/native-image-source.mjs` 拥有 React 呈现、上下文、原生动作与 UI 生命周期。异步结果进入对话框、收藏状态或原生修改动作前核对挂载实例及账号；成功上传的云端身份仍须登记，不能因页面关闭丢失已完成上传。普通 workflow 只接收／返回 `libraryFileId` 与 `created`，原生文件节点和 MoveDialog entries 由 Adapter 构建。

`library-prompt-source.mjs` 只序列化显式依赖；`library-prompt-page.mjs` 直接安装本地来源并组合清理，不通过普通语句的文本替换接线。清理为幂等操作，手动卸载与 signal abort 不重复释放。

## 自检适用场景

2026-10-03 在 Codex 26.930.21537 的独立 profile 通过原生 Images 按钮确认：当前路由为 `/space/files?tab=images`，来源标签的 `variant:"browse"` 与 `generated/uploaded` 契约保持有效。适用场景由 Images Adapter 解释，不按功能名称猜 `/space/images`。未在图库但存在可识别图片 viewer 时，单独检查提示词入口；无图库或图片 viewer 时不判定版本不兼容。

2026-10-05，Codex 26.930.51102：图库切换模式和图片附件调用的局部变量已变化。按调用结构识别导入角色，不固定压缩变量名。原生 navigation、gallery、canvas 模块发现已在当前构建验证；显示与实际操作验收单独记录。
