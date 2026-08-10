---
status: implemented
publication: local
created: 2026-08-08
revised: 2026-08-08
product: CodexNotes
reference_build: openai-codex-electron 26.803.41515
---

# CodexNotes PRD — Toggle Notes / Toggle Pinned Notes

## Problem Statement

用户长期在 Codex 的多个 Project、Thread 和窗口中工作，会反复遇到三类轻量但高频的信息管理问题：

- 还有哪些事情想继续处理或之后交给 Codex，容易在切换会话或间隔数天后遗忘。
- 常用 Prompt、事实摘录和短文本散落在不同会话或剪贴板中，复用时需要重新寻找、复制和粘贴。
- 常用 Handoff、图片、Markdown、PDF 等本机文件需要反复通过 Finder、绝对路径或 Codex 的 Add files 选择器重新定位。

这些操作的共同问题不是缺少一个完整知识库，而是缺少一个始终靠近当前对话、跨 Project 与 Thread 可用的全局个人调用层。用户不希望离开正在进行的对话，也不希望为了轻量 Todo、文本复用和文件调用，引入团队协作、云同步、AI 自动整理、全文检索或复杂资产管理系统。

当前 Codex 没有公开的任意 Conversation toolbar、Pinned Summary 或右侧 Tab contribution API。要获得接近原生的入口与面板，需要通过统一的 CodexRuntimeHost 使用非官方 CDP / DOM Adapter。因此产品必须把本地数据与业务 UI 保持在 Codex 客户端之外；宿主适配失败只能影响入口和 Composer 调用，不能损坏用户数据、原文件或其他 Codex 功能。

## Solution

CodexNotes 提供一个嵌入 Codex 对话区右上角的 Icon Button，并复用当前生产版 Codex Summary 的响应式 presentation contract。它不是一个始终覆盖消息的自定义浮窗，也不在面板内部提供第二个 Pin 控件：同一个 Toolbar Button 根据对话主区域的可用宽度，直接在 `overlay`、`shift` 与 `gutter` 三种模式间切换。

- 在 `overlay` 模式下，Tooltip 与可访问名称为 `Toggle notes`；按钮打开一个锚定在按钮下方的临时 Popover，不预留对话布局空间。
- 在 `shift` 与 `gutter` 模式下，Tooltip 与可访问名称为 `Toggle pinned notes`；按钮直接打开或关闭右侧 Pinned Notes。`shift` 为面板预留空间并把对话向左移动，`gutter` 把面板放入已有右侧余量而不移动对话。

两种 presentation 使用同一个 300px Notes 内容组件，在同一容器中纵向展示 Todo、Notes 和 Files。面板的几何尺寸、Section anatomy、字体、颜色、圆角、阴影、Focus、Hover、Scrollbar 与 Motion 均通过 Codex 当前 resolved semantic tokens 或由原生布局测得的 contract 驱动；不得依靠另一套“看起来相似”的硬编码样式。

Quick Notes 是快速摘要与调用入口。每个 Section 按内容自然高度排列，面板达到可用高度后由一个连续的内部 scroller 承担滚动，不再把三个 Section 强制切成等高区域，也不再用固定 `520px` 或 `29px` 行高推算容量。完整管理通过各区的 `View all` 打开 Codex 右侧工作区中的独立 Todo、Notes 或 Files Tab。

Notes 与原生 Summary 是同层互斥的 quick-summary surface；右侧 Environment、Sources 与自定义 detail Tabs 不是简单的互斥浮层，而是参与可用宽度计算的 workspace surface。它们打开或关闭时，Notes 必须重新计算 presentation mode。切换 Thread 后 Notes 自动关闭，客户端启动时默认关闭。

Todo 是用户手动维护的无日期持续清单；Notes 是支持复制和插入当前 Composer 的可复用纯文本层；Files 是用户主动固定的本机文件引用架，首选像原生 Add files 一样把文件真正附加到当前 Composer。所有数据在本机跨 Project、Thread 和 Codex 窗口共享，不做云同步、自动历史收集或 AI 分类。

## User Stories

### Global entry and pinned summary

1. 作为一名长期使用 Codex 的本机用户，我希望在当前对话右上角看到一个 Notes 图标，从而不离开当前工作上下文就能打开个人工作资料。
2. 作为一名用户，我希望 Notes 入口只占用一个原生尺寸的 Icon Button，从而不挤压 Codex 现有工具栏。
3. 作为一名使用键盘或辅助技术的用户，我希望入口在 `overlay` 模式使用 `Toggle notes`，在 `shift` / `gutter` 模式使用 `Toggle pinned notes`，从而准确表达当前点击会产生的 presentation。
4. 作为一名用户，我希望窄窗口中点击 Notes 图标后打开临时 Popover，从而在空间不足时仍能调用 Todo、Notes 和 Files。
5. 作为一名用户，我希望宽窗口中点击同一个 Notes 图标后直接打开 Pinned Notes，从而不用先打开浮窗、再寻找额外 Pin 控件。
6. 作为一名用户，我希望 Pinned Notes 打开后点击对话正文或按 Escape 仍保持打开，从而可以边查看资料边操作当前会话。
7. 作为一名用户，我希望 overlay Popover 支持再次点击按钮、点击普通外部区域或按 Escape 关闭，从而符合 Codex 原生 Popover 的临时交互语义。
8. 作为一名用户，我希望打开 Notes 时关闭同层的原生 Summary，打开原生 Summary 时也关闭 Notes，从而避免两个 quick-summary surface 重叠。
9. 作为一名用户，我希望 Environment、Sources 或右侧 detail Tab 改变可用宽度时 Notes 自动切换 presentation，而不是用固定坐标继续盖住消息。
10. 作为一名用户，我希望切换 Project 或 Thread 后 Notes 自动关闭，从而与当前 Codex 的 Toggle Pinned Summary 行为保持一致。
11. 作为一名用户，我希望重新启动 Codex 时 Notes 默认关闭，从而不会在启动后意外遮挡当前对话。
12. 作为一名用户，我希望 Codex React 重绘或路由变化后工具栏中仍只有一个 Notes 入口，从而不会看到重复按钮。

### Quick summary layout and full views

13. 作为一名用户，我希望 Todo、Notes 和 Files 在 overlay 与 pinned presentation 中复用同一个内容组件，从而两种模式拥有一致的信息架构和操作能力。
14. 作为一名用户，我希望三个区域使用原生 Section title、细分割线和扁平列表，从而让 Notes 看起来属于 Codex，而不是嵌入的外部后台。
15. 作为一名用户，我希望 Todo、Notes 与 Files Section 始终以固定顺序存在，Section Header 在滚动到面板顶部时使用原生 sticky 行为，从而在长列表中仍能识别当前区域。
16. 作为一名用户，我希望每个 Section 默认最多展示五条高优先级内容，并只在超过五条时通过 `View all` 进入完整视图，从而保持 quick summary 的摘要密度。
17. 作为一名用户，我希望面板按内容自然增高，达到当前 presentation 的最大可用高度后只滚动内部内容，从而适应窗口高度而不裁切或制造三个独立滚动区。
18. 作为一名用户，我希望条目过长时单行截断，从而保持 quick surface 整齐紧凑。
19. 作为一名用户，我希望条目 Hover 时出现浅色整行背景和局部操作，从而平时保持安静，需要时再显示动作。
20. 作为一名用户，我希望点击某一区域的 View all 时打开对应的 Codex 右侧工作区 Tab，从而在更宽空间中管理完整列表。
21. 作为一名用户，我希望 Todo、Notes 和 Files 分别拥有独立 Tab，从而可以在三种完整视图间直接切换。
22. 作为一名用户，我希望某个完整 Tab 已存在时 View all 只聚焦它而不重复创建，从而避免标签栏堆积重复页面。
23. 作为一名用户，我希望关闭完整 Tab 时不删除任何数据，从而把关闭视图与删除内容明确分开。
24. 作为一名用户，我希望完整 Tab 第一版不显示搜索框，从而保持产品轻量并依赖清晰排序浏览内容。
25. 作为一名用户，我希望完整 Tab 不引入任意多选状态，仅在 Todo Completed Section 提供明确的整组删除动作，从而保持管理模型简单。

### Todo

26. 作为一名用户，我希望 Todo 是一份跨 Project、Thread 和窗口共享的持续清单，从而隔几天回来仍能回忆未完成工作。
27. 作为一名用户，我希望通过 Todo Section 右侧的加号快速新增事项，从而随手记下之后想做的事。
28. 作为一名用户，我希望 Todo 不要求日期、截止时间或提醒，从而保持记录动作足够轻。
29. 作为一名用户，我希望新建 Todo 默认出现在未完成列表最前面，从而立即看到刚记录的事项。
30. 作为一名用户，我希望可以拖拽 Todo 改变顺序，并通过原生样式的插入线明确看到将落在目标事项之前还是之后，从而用自己的判断表达当前优先级且不会误判落点。
31. 作为一名用户，我希望手动排序在重启和跨窗口后保持，从而列表不会自动恢复成创建顺序。
32. 作为一名用户，我希望直接编辑 Todo 文本，从而可以修正或细化下一步。
33. 作为一名用户，我希望勾选 Todo 后将它移入 Completed，从而从主要未完成清单中移除。
34. 作为一名用户，我希望 quick surface 优先显示未完成事项，并在未满五条时用 Completed 补足剩余位置，从而既保留当前工作的优先级，也能看到刚完成的上下文。
35. 作为一名用户，我希望 quick surface 中的 Completed 使用填充圆形 Checkbox、居中删除线与降低的文字颜色，从而一眼区分完成状态而不与 Active 抢夺视觉优先级。
36. 作为一名用户，我希望可以把 Completed 事项恢复为未完成，从而修正误勾选或重新开启工作。
37. 作为一名用户，我希望可以通过 Completed Section 的 Delete all 动作批量删除全部已完成事项，从而在不逐条处理的情况下移除完成记录。
38. 作为一名用户，我希望删除 Todo 时立即生效且不弹确认或 Undo，从而保持操作直接。
39. 作为一名用户，我希望 Codex 不自动创建、修改、完成或执行 Todo，从而清单始终由我本人维护。
40. 作为一名用户，我希望 Todo 不提供复制、Composer 插入或自动发送动作，从而它只承担提醒职责而不是 Agent 队列。

### Notes

41. 作为一名用户，我希望 Notes 保存 Prompt、事实摘录和可复用短文本，从而能够跨会话调用它们。
42. 作为一名用户，我希望一条 Note 包含可选标题和多行纯文本正文，从而既能快速识别又能完整保存内容。
43. 作为一名用户，我希望无标题 Note 使用正文首行作为列表摘要，从而不必为每条临时摘录额外命名。
44. 作为一名用户，我希望通过 Notes Section 右侧的加号在 quick surface 内创建 Note，从而无需改造对话消息菜单。
45. 作为一名用户，我希望单击 Note 主体打开编辑，从而直接修改标题和正文。
46. 作为一名用户，我希望 Hover Note 时看到复制按钮，从而一键把完整正文放入剪贴板。
47. 作为一名用户，我希望 Hover Note 时看到插入按钮，从而把完整正文带入当前 Composer。
48. 作为一名用户，我希望 Note 插入到 Composer 当前选区或光标位置，从而能够自然组合正在编辑的 Prompt。
49. 作为一名用户，我希望无法可靠取得光标时 Note 在现有草稿末尾另起一行，从而不覆盖任何已有文字。
50. 作为一名用户，我希望插入 Note 后仍由我确认和发送，从而产品不会自动提交消息。
51. 作为一名用户，我希望可以置顶或取消置顶 Note，从而固定长期常用 Prompt。
52. 作为一名用户，我希望置顶 Note 始终排在未置顶 Note 前面，从而常用内容稳定可达。
53. 作为一名用户，我希望未置顶 Note 按最近成功复制、插入或编辑的时间排序，从而最近调用的内容更靠前。
54. 作为一名用户，我希望仅 Hover 不改变 Note 排序，从而浏览列表不会导致条目跳动。
55. 作为一名用户，我希望置顶和删除位于低频的更多菜单中，从而 Hover 行不会堆叠太多图标。
56. 作为一名用户，我希望删除 Note 时立即永久删除且没有确认或 Undo，从而遵循直接管理的交互决定。

### Files

57. 作为一名用户，我希望 Files 只包含我主动固定的文件，从而产品不会扫描任意目录或自动收集全部会话附件。
58. 作为一名用户，我希望点击 Files Section 右侧加号打开系统文件选择器，从而可以从本机选择一个或多个文件。
59. 作为一名用户，我希望可以把 Finder 中的文件拖入 Notes quick surface，从而快速固定常用文件。
60. 作为一名用户，我希望 Files 接受系统可访问的任意普通文件，从而可以固定图片、Markdown、PDF、文档或其他工作资料。
61. 作为一名用户，我希望 Files 不接受目录，从而每个条目都保持明确的文件附加语义。
62. 作为一名用户，我希望固定文件只记录原文件的绝对路径而不复制字节，从而避免静默副本和额外存储管理。
63. 作为一名用户，我希望同一个规范化绝对路径只产生一个 Files 条目，从而避免重复固定同一文件。
64. 作为一名用户，我希望新固定的文件先出现在摘要前面，从而立即确认添加成功。
65. 作为一名用户，我希望 Files 随后按最近成功调用排序，从而常用文件保持靠前。
66. 作为一名用户，我希望 Hover 文件条目时看到 Add 动作，从而能够把文件带入当前会话。
67. 作为一名用户，我希望 Add 首选复用 Codex 原生 Add files 的结果，从而图片显示原生预览，其他文件显示原生附件条目。
68. 作为一名用户，我希望原生式附加不可行时 Add 改为在 Composer 光标处插入文件绝对路径，从而仍减少手动查找和粘贴步骤。
69. 作为一名用户，我希望路径降级明确提示“插入路径”而不是“已附加”，从而不会误判 Composer 中的资源状态。
70. 作为一名用户，我希望文件附加或路径插入后仍由我确认和发送，从而产品不会自动提交消息。
71. 作为一名用户，我希望单纯 Hover 或在系统文件管理器中查看文件不更新最近调用时间，从而排序反映真实复用动作。
72. 作为一名用户，我希望单击 Files 中的文件名就在 macOS Finder 或 Windows Explorer 中显示并选中磁盘原文件，从而可以直接回到它所在的真实路径。
73. 作为一名用户，我希望文件名、Add 和 Delete 各自只触发自己的动作，从而点击附件或删除按钮不会意外打开系统文件管理器。
74. 作为一名用户，我希望系统文件管理器无法显示文件时 CodexNotes 给出错误且不修改元数据、排序或源文件，从而查看动作始终是只读的。
75. 作为一名用户，我希望 CodexNotes 不提供文件重命名入口，从而文件名整理仍由系统文件管理器和文件所属工具负责。
76. 作为一名用户，我希望固定文件被移动或删除后，CodexNotes 在刷新或调用时确认路径不存在并自动移除引用，从而列表只保留可用文件。
77. 作为一名用户，我希望 CodexNotes 不扫描磁盘猜测文件的新位置，从而避免误匹配和隐私范围扩大。
78. 作为一名用户，我希望删除 Files 条目只取消固定而不删除磁盘原文件，从而不会因为整理快捷架而丢失真实资料。
79. 作为一名用户，我希望删除 Files 条目立即生效且没有确认或 Undo，从而与其他列表的直接删除行为一致。
80. 作为一名用户，我希望图片只在我把它作为普通文件固定后出现在 Files，从而产品不再自动聚合 Today’s images。

### Local persistence, multi-window behavior, and resilience

81. 作为一名用户，我希望 Todo、Notes 和 Files 元数据保存在本机，从而关闭 quick surface 或切换会话不会丢失内容。
82. 作为一名用户，我希望所有 Project 和 Thread 读取同一份 CodexNotes 数据，从而个人资料不会被会话边界割裂。
83. 作为一名用户，我希望多个 Codex 窗口共享同一份数据并同步增删改，从而不同窗口不会出现互相矛盾的 Todo 或 Notes。
84. 作为一名用户，我希望跨窗口同步包括排序、置顶、Completed 和最近调用状态，从而所有视图保持一致。
85. 作为一名用户，我希望 Notes 服务暂时不可用时 Codex 本身和其他个人功能仍可正常使用，从而单一功能故障不会扩大。
86. 作为一名用户，我希望宿主注入失效时本地 Todo、Notes 和 Files 数据仍然完好，从而客户端升级不会损坏核心资料。
87. 作为一名用户，我希望 light、dark、自定义 accent 和运行时主题切换都使用 Codex 当前 resolved tokens，从而 quick surface 与完整 Tab 保持原生视觉一致。
88. 作为一名用户，我希望 Notes surface 不会遮挡或截获原生菜单与其他 Portal，从而现有 Codex 工具仍可正常操作。
89. 作为一名用户，我希望刷新资源或同步其他窗口变化时不关闭当前 surface、不重置当前编辑内容，从而后台更新不会打断输入。
90. 作为一名用户，我希望第一版不要求账号、云服务或外部网络，从而 CodexNotes 可以作为完全本地的个人工具运行。

## Implementation Decisions

### Product and ownership boundaries

- CodexNotes owns Todo、Notes、Files domain data、local HTTP API、local persistence and both the quick-summary UI and full-tab UI.
- CodexRuntimeHost remains the only process that launches a CDP-enabled Codex instance, injects DOM adapters, mounts surfaces, synchronizes Theme Tokens and performs narrowly scoped host actions.
- CodexNotes must not create a second Injector, modify the installed ChatGPT application, directly import private Codex React modules, or read another feature project's database or API. Private client integration is isolated inside CodexRuntimeHost.
- The Toolbar、Pinned Notes summary and right-side Tabs are an unsupported CDP / private React / DOM Adapter integration, not an official Codex Contribution API. Core data and Web UI must remain independently runnable.
- Today’s images is removed from this product. Images are ordinary Files only when manually fixed by the user.

### Host contribution model

- Extend the shared feature manifest backward-compatibly so existing sidebar/page features keep their current behavior while CodexNotes can declare a Conversation toolbar entry、`responsive-summary` presentation and Todo/Notes/Files detail-tab surfaces.
- The entry is an icon-only button using a real project or official icon resource, never a hand-drawn replacement. Its accessible label and Tooltip come from presentation state: `Toggle notes` for `overlay`; `Toggle pinned notes` for `shift` and `gutter`.
- The entry exposes open/closed state through native-equivalent pressed and expanded semantics and uses a unique marker so repeated ensure operations are idempotent. A host selector must recognize both native Summary labels or use a more stable structural anchor; it must not depend only on `button[aria-label="Toggle summary"]`.
- Opening Notes closes the currently open native Summary surface. Opening native Summary closes Notes. The adapter must observe or invoke the real current control rather than depending on localized visible text alone.
- In `overlay`, the button、outside pointer dismissal and Escape can close Notes. In `shift` / `gutter`, only the button、a mutually exclusive native Summary、Thread change or Host teardown closes Notes; ordinary outside clicks and Escape do not.
- Opening or closing Environment、Sources or right-side detail Tabs does not use a blanket “close Notes” rule. Their geometry updates `mainContentTargetWidth`, after which the responsive-summary state machine decides whether Notes remains inline、moves presentation or becomes hidden under the state rules below.
- View all asks CodexRuntimeHost to open Todo、Notes or Files through the native right-panel `openTab` controller in the current Task scope. A stable contribution identity prevents duplicates and focuses an existing Tab; capability detection failure falls back to the replaceable compatibility Tab host.
- The summary surface occupies only its visible rectangle. It must not use a transparent full-content overlay, capture clicks outside the panel or outrank native Portal menus.
- All iframe-to-host messages validate both `event.origin` and `event.source`. Host actions return explicit success, unavailable or failure results; the UI never assumes success after dispatch.
- Current internal commands such as `togglePinnedSummary` and `composer.addFiles` are Phase 0 candidates, not guaranteed interfaces. Each used path must be recorded as official interface, stable internal interface, DOM inference or high-risk CDP.

### Native Summary parity contract

The reference below was measured from `openai-codex-electron 26.803.41515`. It is the initial compatibility profile, not a claim that hashed bundle names or raw thresholds are a permanent public API. RuntimeHost should prefer live host geometry and resolved tokens, and version any measured fallback values by Codex build.

#### Responsive presentation modes

The state machine takes `mainContentTargetWidth`, meaning the width available to the conversation layout after app chrome and right-side workspace surfaces are accounted for. It must not use `window.innerWidth` as a substitute.

For the current reference build:

```text
panelClearance = (mainContentTargetWidth - 736px) / 2

panelClearance < 180px  -> overlay
panelClearance < 400px  -> shift
otherwise               -> gutter
```

Equivalent current thresholds:

| `mainContentTargetWidth` | Mode | Toolbar label | Surface | Conversation layout |
| ---: | --- | --- | --- | --- |
| `< 1096px` | `overlay` | `Toggle notes` | Popover anchored below/end of button | No reserved space; content shift `0` |
| `1096–1535px` | `shift` | `Toggle pinned notes` | Inline pinned panel | Reserve `316px`; conversation `translateX(-158px)` |
| `>= 1536px` | `gutter` | `Toggle pinned notes` | Inline pinned panel in right gutter | Reserve `316px` for the surface contract; conversation shift `0` |

The `316px` layout slot is the 300px panel plus 16px trailing inset. `shift` moves the centered conversation by half that slot so the visual center adjusts without a full-width jump.

#### Open-state model and transitions

RuntimeHost maintains presentation separately from visibility:

- `displayMode`: `overlay | shift | gutter`, derived continuously from live layout width.
- `isPinned`: whether the inline surface is requested in `shift` / `gutter`.
- `isPopoverOpen`: ephemeral Popover state used only in `overlay`.
- `visibleSurface`: `inline` when `isPinned && displayMode !== overlay`; `popover` when `displayMode === overlay && isPopoverOpen`; otherwise `null`.

The Toolbar Button never opens a floating surface merely to reveal a Pin action:

- In `overlay`, activating the button toggles `isPopoverOpen`.
- In `shift` / `gutter`, activating the button toggles `isPinned`.
- Leaving `overlay` closes the ephemeral Popover state. The inline surface appears only when `isPinned` is true.
- Entering `overlay` hides the inline surface immediately before a Popover is presented, preventing two Notes surfaces during the transition.
- A Thread or Project change clears both visibility states. Returning to the previous Thread does not restore the open surface. A fresh client session starts closed.
- Reduced-motion mode preserves the same final states without spatial animation.

#### Surface geometry and height

| Part | Contract |
| --- | --- |
| Shared content width | `300px` |
| Pinned trailing inset | `16px` |
| Pinned top / bottom inset | `12px / 12px`, sourced from `--thread-floating-content-*-inset` |
| Overlay placement | `side: bottom`, `align: end`, `sideOffset: 8px` |
| Overlay max height | `min(radix available height, 100vh - 16px)` |
| Pinned max height | Available space between the 12px top and bottom insets |
| Height behavior | Intrinsic content height until max height; one inner vertical scroller after overflow |
| Panel stacking | Below native Portal menus; no invisible full-page hit target |

The Popover positioning wrapper remains transparent and has no independent radius、background、ring or shadow. The shared Notes content card owns the visible surface styling, ensuring overlay and pinned presentations render the same component.

#### Content anatomy and spacing

All spacing derives from the host spacing scale, whose current resolved base is `--spacing: 0.25rem` (`4px`). Tailwind utilities should carry layout and states; CSS variables bridge live host tokens and the few exact measured values.

| Element | Native-parity rule |
| --- | --- |
| Content card | `rounded-3xl`, dropdown background, overflow hidden, outer top padding `6px` |
| Inner scroller | Top padding `4px`, bottom padding `6px`, vertical gap `12px`, `overflow-y: auto` |
| Section | Horizontal content inset `14px`, internal gap `2px`, bottom padding `12px` |
| Section divider | `0.5px`, inset `14px` from both sides, hidden after the last Section |
| Section header | Height `28px`; left `14px`, right `10px`, bottom `2px`; action gap `8px`; list wrapper starts `2px` after the Header |
| Item group | Vertical gap `2px` |
| Item row | Minimum height from native composer-button token, current `28px`; vertical padding `4px`; single-line label |
| Item hover | Background extends `8px` beyond the row content on both horizontal sides using the list-hover token |
| Item actions | Hidden visually and non-interactive until row hover or focus-within; remain keyboard reachable |
| Section actions | Trailing aligned with `2px` gap; use the existing project/official icon source |

The card has no extra top-level “Notes” title bar and no nested card frames; the Toolbar Button already supplies surface identity. Todo、Notes and Files appear directly in that order. Each Section defaults to its five highest-priority rows. An empty Section keeps its Header and exposes its Add action, but does not reserve fake list height. `View all` appears only when that domain contains more than five items. Capacity is no longer calculated from a fixed iframe height or hardcoded row arithmetic.

#### Semantic token contract

Embedded surfaces consume host-resolved semantic values. Standalone development may provide matching fallbacks, but fallbacks must never override live host values.

| Role | Required host token / semantic source | Current light reference |
| --- | --- | --- |
| Card surface | `--color-token-dropdown-background` | `rgb(255, 255, 255)` |
| Primary text | `--color-token-foreground` | `#0d0d0d` |
| Secondary text | `--color-token-text-secondary` | Host resolved |
| Section / muted text | `--color-token-text-tertiary` | `rgba(13, 13, 13, .484)` |
| Divider | `--color-token-border` / border-default semantic | `rgba(13, 13, 13, .074)` |
| Row hover | `--color-token-list-hover-background` semantic | Host resolved |
| Summary control hover | `--color-token-list-hover-background` semantic | `rgba(13, 13, 13, .05)` |
| Focus ring | `--color-token-focus-border` semantic | Host resolved |
| Trailing metadata | conversation-summary trailing semantic | Host resolved |
| Radius | `--radius-3xl-base` × `--codex-corner-radius-scale` | `1.25rem × 1.25 = 25px` |
| Card elevation | `--elevation-prominent` | `0 0 0 .5px rgba(13,13,13,.11)`, `0 3px 7.5px rgba(0,0,0,.04)`, `0 0 20px rgba(0,0,0,.05)` |
| Scrollbar | Current host scrollbar semantic tokens | Host resolved |

Do not map the content card to `main-surface-primary`, hand-author a visually similar box shadow, or freeze resolved light values into product CSS. The Host Theme Bridge should send semantic values and update visible surfaces when theme、accent、contrast or appearance changes.

#### Motion and focus

- Inline entrance animates from `opacity: 0`, `translateX(100%)`, `scale(.8)` to `opacity: 1`, `translateX(0)`, `scale(1)`.
- The current reference uses a `0.3s` spring with `bounce: .01`; layout reserve and conversation shift animate in coordination with the panel.
- Immediate mode changes and `prefers-reduced-motion` use duration `0`.
- Overlay uses the native Popover collision and dismissal behavior rather than a separately authored floating-card animation.
- Toolbar and row controls use the host focus-border token with a visible 2px outline and offset. Hover-only actions must also become visible on `focus-within`.

### Local service and source of truth

- CodexNotes runs as one local service discovered and started by CodexRuntimeHost. All windows use that service as the sole writer to a local SQLite database.
- The service exposes a small loopback HTTP API for Todo、Notes、Files and a server-to-client change stream so multiple open windows refresh from one authoritative revision.
- The database stores metadata only. File bytes remain at their original absolute paths and are never copied into a managed Asset Store.
- Todo stores body、manual order、creation/update timestamps and optional completion timestamp. It does not store due dates, reminders, assignees or Agent execution state.
- Notes stores optional title、body、pin state、creation/update timestamps and last successful use time.
- Files stores a canonical absolute path、derived display name and type metadata when available、added time and last successful call time. One canonical path maps to at most one active entry.
- All mutations are immediately persistent. Product delete operations are permanent and do not create soft-delete records, confirmation dialogs or Undo state.
- First version has no import/export format, automatic backup, cloud synchronization or account identity.

### Todo behavior

- The default Todo list contains only incomplete items. New items receive the first position before any existing incomplete items.
- Manual drag-and-drop writes a durable total order. During drag, the quick surface and full Todo Tab show the native Codex insertion indicator at the exact before / after destination selected by the pointer half; the persisted order uses that same destination. A later new item is added at the front without destroying the relative order of existing items.
- Completing an item moves it below Active priority and records it in Completed. Completion and restoration are triggered only from the leading circular checkbox in both the quick surface and full Todo Tab; clicking the row label or its remaining hover area has no action. The quick summary takes up to five Todo rows: Active first, then Completed fills any remaining capacity. Completed rows use a filled circular check, centered strike-through and tertiary text; the full Todo Tab continues to expose the complete Active and Completed collections.
- Completed items can be restored individually. A dedicated Delete all action in the Completed Section is the only section-level batch operation; its accessible name identifies that it deletes every completed Todo, while arbitrary multi-select remains out of scope.
- Todo has no Composer action and no automated writes from Codex.

### Notes behavior

- A Note has an optional title and required non-empty multiline plain-text body. When title is empty, the UI derives its one-line display summary from the first non-empty body line without modifying stored content.
- Creation and editing happen inside the CodexNotes surfaces. Conversation selection capture, rich text and Markdown rendering are not included.
- Clicking a Note row opens editing. Hover actions contain Insert only; Pin/Unpin and Delete live in a low-frequency overflow menu.
- Pinned Notes sort before unpinned Notes. Unpinned Notes sort by last successful Insert or Edit, with newly created Notes treated as most recently used.
- Insert sends the full body to the Host Adapter. The adapter inserts at the active Composer selection or caret; if it cannot preserve a selection, it appends a newline plus the body. It never replaces the draft or submits the message.

### Files behavior

- Files are added through a system file picker supporting one or multiple regular files and through Finder drag-and-drop. Directories are rejected with a local explanation.
- Adding a file canonicalizes its absolute path and reuses an existing entry rather than creating duplicates.
- New files are treated as most recently called. Later ordering is based on the last successful native attachment or absolute-path insertion.
- The primary Add action asks the Host Adapter to attach the source file to the active Composer using the same user-visible outcome as native Add files. The UI only reports success after an actual attachment chip or preview is observed.
- Phase 0 must determine whether the internal `composer.addFiles` command or another current native bridge can accept a known absolute path. Opening the native picker without being able to bind the selected pinned file does not satisfy this requirement.
- If native attachment is unavailable, the declared fallback inserts the canonical absolute path at the Composer selection or caret. The action label and response state must identify this as path insertion, not attachment.
- Composer actions never auto-submit. Clipboard-only path fallback is not part of the MVP because direct Composer insertion was selected.
- Clicking the file name calls the native file-manager reveal operation for the stored canonical path: Finder on macOS and Explorer on Windows open its containing folder and select the source file. Add and Delete remain separate sibling actions.
- File-manager reveal is read-only: it does not update recency、revision、metadata or source bytes. CodexNotes exposes no inline or API rename surface. Unsupported platforms return an explicit error rather than claiming selection succeeded.
- Path availability is checked on refresh and immediately before call. A confirmed missing path removes the reference automatically. CodexNotes does not search the disk for a replacement.
- Removing a Files entry deletes only database metadata and never deletes or moves the source file.

### UI and visual behavior

- The quick summary is one shared native-parity content card with Todo、Notes and Files Sections separated by thin rules. It is not three cards、three equal-height panes、three independent scrollers、three Tabs or a dashboard page.
- Overlay and pinned presentations render the same content anatomy. Only the host wrapper、available height、dismissal behavior and conversation-layout participation differ.
- Each Section Header and Add action remains present. Sections use intrinsic content height and the card owns one continuous vertical scroller; there is no fixed `520px` iframe contract or JavaScript row-capacity formula.
- Rows are flat、single-line and truncated. Hover and focus-within reveal the native list-hover background and only the actions chosen for that domain.
- The full Todo、Notes and Files Tabs are scrollable management views. First version has no search UI, filters or arbitrary multi-select; Todo Completed exposes one explicit section-level batch Delete all action.
- RuntimeHost sends resolved semantic Theme Tokens and live layout metrics to every CodexNotes surface. Embedded surfaces use host values for colors、type、radius、focus、shadow and scrollbars; standalone development may provide matching fallbacks.
- Layout and state styling should be expressed with Tailwind CSS where practical. CSS variables are reserved for host tokens、runtime geometry and exact values that cannot be represented reliably through the existing scale.
- Spacing、popover geometry、row height、hover/focus styles、Tab chrome and layer order are calibrated from computed styles of the current native reference. Hashed bundle names are evidence pointers, not product selectors or imported dependencies.
- Multi-window updates change list data without closing surfaces, changing the selected Section/Tab or overwriting an in-progress edit.

## Testing Decisions

### Test philosophy

- Tests assert user-observable behavior at the highest stable boundary. They must not treat SQLite table shape、private helper functions、minified React symbols or exact DOM class strings as product contracts.
- Two primary seams are used: the CodexNotes Product seam and the Codex Host Adapter seam. Lower-level unit tests may support hard edge cases, but they do not replace these acceptance boundaries.
- File behavior tests use temporary files and directories only. File-manager reveal is dependency-injected so tests never open a real Finder / Explorer window or mutate a real user file.
- Any live Codex result records the current app build and classifies the integration path as official、stable internal、DOM inference or high-risk CDP.

### Seam 1: CodexNotes Product

- Start the real local service with a temporary database and temporary files, then drive the public Web UI and HTTP boundary as a black box.
- Verify Todo creation appears first, manual order persists, completion moves items out of the main list, restoration works, Completed has lower summary priority and direct deletion has no confirmation or Undo.
- Verify Note title fallback、multiline body fidelity、editing、pin ordering、recent-use ordering and permanent deletion.
- Verify Insert requests are sent only from the explicit row action and update recency only after a successful adapter response.
- Verify file picker ingestion and drag-and-drop produce canonical path references without copying bytes, reject directories and deduplicate an existing path.
- Verify Files ordering changes only after a successful attachment or path insertion.
- Verify clicking a file name sends its exact canonical path to the injected file-manager adapter, macOS and Windows use native argument arrays, reveal does not alter ordering or revision, and unknown metadata never reaches the adapter.
- Verify deleting a Files entry leaves the source file intact.
- Verify moving or deleting a temporary source causes the reference to disappear on refresh or attempted call without scanning for a replacement.
- Verify Todo、Notes and Files render in fixed order, each defaults to at most five high-priority rows, empty Sections keep their Header/Add affordance, and the card uses one inner scroller after reaching its max height. Todo allocation must consume Active first and then Completed, with completed-state visuals preserved.
- Verify no fixed iframe height、hardcoded row-capacity arithmetic、equal-flex Section allocation or nested Section scroller participates in quick-summary layout.
- Verify View all requests the correct Todo、Notes or Files contribution identity and does not create a duplicate when the host reports an existing Tab.
- Verify no search, arbitrary multi-select or hidden auto-indexing behavior appears in the first-version UI.
- Open two clients against the same service and verify create、edit、delete、order、pin、Completed and last-used updates converge without a reload.
- Restart the service against the same temporary database and verify local state persists while ephemeral UI state such as an open panel does not.
- Run the standalone UI under light、dark and custom-token fixtures and verify semantic contrast、focus visibility、scrollbars and in-progress edit preservation.

### Seam 2: Codex Host Adapter

- Launch an isolated Codex profile through CodexRuntimeHost and connect through loopback CDP; never attach acceptance tests to the user's normal Codex profile.
- Verify one icon-only Toolbar entry is mounted and repeated MutationObserver passes never create duplicates. At `<1096px` main-content width its Tooltip/label is `Toggle notes`; at wider modes it is `Toggle pinned notes`.
- Verify `overlay` toggles a Popover and supports outside-click/Escape dismissal; `shift` / `gutter` toggle an inline panel and remain open across ordinary outside clicks/Escape.
- Verify the responsive mode is derived from `mainContentTargetWidth`, not raw viewport width. Cover `1095/1096px` and `1535/1536px` boundary cases for the current compatibility profile.
- Verify `shift` reserves `316px` and moves conversation content `-158px`; `gutter` uses zero content shift; `overlay` reserves no layout space.
- Verify changing Environment、Sources or right-side Tab geometry recomputes mode without leaving duplicate inline/Popover surfaces.
- Verify Notes and native Toggle Pinned Summary are mutually exclusive in both directions without obscuring other native menus.
- Switch Threads while Notes is open and verify Notes closes; return to the original Thread and verify it remains closed.
- Reload or restart the isolated client and verify Notes starts closed.
- Open Todo、Notes and Files View-all contributions and verify each creates or focuses one independent right-side Tab with working close behavior and no data deletion.
- Verify Theme Bridge updates every visible surface across light、dark、custom accent and live theme changes.
- Compare the rendered card against the captured native reference at wide pinned、overlay and 520px-high overlay states. Assert 300px width、16px pinned inset、12px vertical insets、8px Popover offset、25px current resolved radius and internal-scroll height behavior within a small rendering tolerance.
- Verify reduced-motion mode reaches the same final layout without spring or spatial movement.
- Verify inserting Note text respects the current Composer selection/caret, falls back to newline append when necessary, preserves existing draft content and never submits.
- Verify native file attachment using a temporary image and a temporary non-image file. Success requires observing the same attachment preview/chip outcome as native Add files, not merely path text.
- If native attachment is classified unavailable, verify the fallback inserts the canonical absolute path, labels the action truthfully and never reports attachment success.
- Verify Thread switching updates the active Composer target so no insertion or attachment reaches a stale Thread.
- Verify malformed or foreign-origin iframe messages cannot call insert、attach or open-tab host actions.
- Verify native Portal menus remain above Pinned Notes and clicks outside the visible surface reach Codex.
- Verify stopping or failing CodexNotes removes or disables only its surfaces and does not break other RuntimeHost features or trap Codex on the startup screen.
- Exercise more than one Codex window and verify each receives one entry while all surfaces read the same Product seam data.

### Prior art

- Preserve the existing CodexRuntimeHost feature-discovery and serialized-refresh tests as regression coverage for backward compatibility.
- Reuse the existing isolated-profile CDP probe and runtime-stability-check approach for real Renderer evidence.
- Prefer a small host mock for Product seam Composer responses and the real isolated Renderer only for Host Adapter acceptance, so ordinary business tests do not depend on a particular Codex build.

## Out of Scope

- Automatic Today’s images aggregation or a separate image gallery.
- Automatic indexing of historical Codex attachments, Session JSONL resources or arbitrary local folders.
- File-byte copies, managed Asset Store, thumbnails, file content preview or permanent backup guarantees.
- Directories, folder trees or recursive folder attachment.
- Due dates、reminders、recurring Todo、calendar views、daily history、assignees or Agent execution queues.
- Automatic Todo extraction from conversations or automatic completion by Codex.
- Rich text、Markdown rendering、attachments inside Notes or conversation-selection capture.
- Tags、folders、collections、AI summary、AI classification、embeddings、semantic search、full-text search or knowledge graph.
- Search UI、filters、arbitrary multi-select or general batch operations in the quick summary or full Tabs.
- Clipboard-only file-path fallback as a primary action.
- Automatic disk search or relinking for moved files.
- Undo、soft delete、trash or version history for Todo and Notes.
- Import/export、automatic local backup、cloud sync、cross-device sync、accounts、teams、permissions or sharing.
- Modifying the ChatGPT application bundle、spreading private Codex React integration outside the single RuntimeHost Adapter or presenting CDP/private React/DOM integration as official Plugin support.
- A permanent left-sidebar Notes entry、a full-page knowledge-management dashboard、a manually resizable panel or a user-selectable permanent dock mode. The responsive `shift` / `gutter` panel that participates in conversation layout is explicitly in scope.
- Commit、push、remote repository creation、release packaging、launch-at-login service or production deployment.

## Further Notes

- This PRD supersedes the earlier product shape in the Handoff where Today’s images was a first-class Section. The current agreed MVP Sections are Todo、Notes and Files.
- This revision supersedes the earlier “always-floating Pinned Notes” geometry. The current implementation now supports the native-parity `overlay / shift / gutter` contract、responsive labels、layout reservation、content shift and one shared token-driven card.
- The right-side Detail Tab decision now prefers Codex's internal React `openTab` lifecycle in the current `local-thread` scope and retains the previous custom host only as capability fallback. The data and iframe Surface contracts are unchanged.
- Source evidence for the current reference build lives in the installed Codex `app.asar`: `local-conversation-page-CAJMZDtJ.js` registers the Header Action; `open-sources-side-panel-tab-CNSfySRb.js` owns display-mode and layout-shift calculations; `toggle-thread-summary-panel-BoYGZKoF.js` owns toggling and Popover behavior; `app-initial-Biw83Aiz.js` owns the Summary component anatomy; `thread-scroll-layout-T6DCT1IT.js` applies the conversation shift.
- The current local Codex build exposes internal command names including `togglePinnedSummary` and `composer.addFiles`. These names are evidence for Phase 0 exploration only; they are not documented public contracts.
- Current-client CDP observation showed that Toggle Pinned Summary closes on Thread switch and does not restore when returning to the original Thread. CodexNotes intentionally follows that behavior instead of creating per-Thread open-state persistence.
- Official OpenAI documentation did not establish a public Toolbar、Pinned Summary or right-side Tab contribution point. Implementation must be ready for Codex DOM changes and keep the Host Adapter replaceable.
- Native Summary source/DOM evidence and the corresponding Host realignment are complete for the current reference build. RuntimeHost owns the responsive presentation state machine、Toolbar anchor、layout reservation/shift、geometry and token bridge; CodexNotes owns the intrinsic-height Summary content and single continuous scroller.
- The agreed MVP is complete only when Todo、Notes and Files all meet their acceptance behavior. Development previews may arrive in phases, but a partial pair of Sections is not the final MVP.
- This document remains local because the project has no Git remote or Issue Tracker. Its status is `implemented`; local commits are used as the delivery boundary and no push、remote creation、release or deployment is part of this revision.
