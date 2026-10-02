# Images 生成提示词接口核对

范围：Codex 26.930.21537 安装包源码、隔离窗口当前云端 Library 图片及其来源会话。2026-10-02；未改动日常安装版。仅在原生 Renderer 内使用现有 API capability；不复制凭据、下载图片或保存用户会话正文。

| 接口 / 记录 | 验证层级 | 本次结果 |
| --- | --- | --- |
| GET `/conversation/{conversation_id}` | 实际调用 | 能关联精确图片结果。样本 `dalle.prompt` 为空；图片结果直接以用户消息为父节点，没有携带这次生成的工具参数 |
| GET `/files/library/files/{library_file_id}` | 实际调用 | 当前样本返回404；原生也为此情况提供 node 分支 |
| GET `/files/library/files/{library_file_id}/node` | 实际调用 | 返回 Library 文件节点与元信息，没有生成提示词字段 |
| GET `/files/library/files/{library_file_id}/versions` | 实际调用 | 返回版本、来源会话和消息关联，没有生成提示词字段 |
| GET `/images/prompt-items` 与单项接口 | 安装包调用方检查 | 推荐提示词 / catalog display 页面，非特定已生成图片的实际参数 |
| GET `/images/init`、`/images/styles` | 安装包调用方检查 | 图片 catalog/style 数据；不是按生成图片ID读取其提示词的路径 |
| POST `/image-gen/*` | 安装包调用方检查，未执行 | 选择、反馈、延迟生成确认等操作，不作为提示词读取接口 |

提取规则扩展：精确图片的 `dalle.prompt`；精确图片结果消息的 `metadata.async_task_prompt`（当前原生同样读取它）；当前图片祖先链最近一次生图工具调用的结构化 `prompt` 或单项 `prompts` 参数。不执行工具文本，不读取 reasoning/thoughts 内容，不遍历无关分支，不以用户消息或图片标题替代真实参数。多图工具结果缺少参数到单图的可靠映射时不猜测归属。

现有历史导入保留 generation/request 两种事实；原生 Prompt 面板优先 generation；缺失时先明确告知，再以“原始请求”标注可追溯的 request，并允许复制原始请求。两者均缺失时给出说明并禁用复制。保留提前注入、骨架屏、失败重试和换图中止规则。

当前样本无法恢复真实生成提示词。这是本次已检查接口的返回边界，不代表所有图片都缺失，也不代表服务端不存在其他未公开接口。工具参数与异步提示词路径已用契约样例验证；当前样本不含这些字段，不能声称它已在真实图片上成功提取。

## 同日全库检查补充

随后遍历当前账号原生 Library API 的全部分页：311个文件条目，其中299张未删除图片；162张带来源会话/消息关联，涉及66个会话。全部会话读取成功。按当前提取规则：6张得到 generation、106张得到 request、50张未取得可用文本；另137张缺来源关联。仅统计及图片标识暂存在隔离 Renderer，未持久化会话正文。

命中的图片：智能手机与路由器数据传输示意.png（1538字符）、Network status dashboard with modern UI.png（1795）、清风护航扬正气.png（920）、Network Report and Connectivity Overview.png（644）、几何凤凰雕塑.png（517）、generated-image-s_efc7227ba9388191bc23742864570ebc.png（561）。

进一步实测第一张：图片的 dalle.prompt 为空且没有 async_task_prompt，但祖先链保存了 assistant 向 t2uay3k.sj1i4kz 提交的 code/JSON 工具调用，参数包括 prompt/size/n 等；prompt为1538字符，与新面板正文长度一致。隔离窗口通过 View prompts 打开，显示生成提示词而非原始请求，复制已启用。这为新增工具调用提取路径补充了真实图片成功案例；之前的“当前样本缺失”结论仍仅适用于此前检查的那张图片。

## 成功与回退会话的结构对比

对162张带来源关联图片的66个会话再次读取，均成功。6张generation与106张request都匹配精确生成图片记录；6张成功案例全部来自祖先链的生图工具调用参数，dalle.prompt与async_task_prompt均无值。106张request中75张保留生图调用但没有非空prompt（73张工具参数包含prompt键，2张未包含）；31张图片结果直接以用户消息为父节点，没有提供对应工具调用。抽查保留调用的回退记录，其JSON prompt为null。

成功案例的消息模型标记：gpt-4o四张，gpt-5-5-thinking一张，gpt-5-6-thinking一张；两个thinking型号也有大量回退案例，因此型号不足以预测成功。记录日期包括2025-04/05、2026-07、2026-08；不能从这组样本断言一个统一时间分界或未来生图的保存行为。

“Network status dashboard with modern UI.png”的工具参数 n=4，但当前图片结果消息只含一个精确图片asset，沿祖先链可关联同次调用，因此成功。“工具一次只能生成一张”并非要求；当前实现约束的是单条工具结果消息中的图片归属，不能混淆用户请求数量与结果结构。

当前可检验条件：Library图片保留会话/结果消息/asset关联；确认为生成图片；该图片元数据、异步结果元数据或其最近生图调用中存在非空真实提示词；能明确关联到当前图片，不能串到其他消息分支或更早调用。用户写提示词、选择特定模型/模式、文生图或图生图本身均不保证这些字段可读取。当前检查不足以确认会话UI模式与字段保存的因果关系。

## 本地 Codex 日志路径验证

只读核对 `~/.codex/sessions` 与 `~/.codex/archived_sessions`，共989个日志文件，其中187个包含生成图片相关记录。项目已有 ThreadPromptIndex 使用本地 thread + 生成输出 item ID 关联工具调用，并以静态字符串解析恢复 prompt，不执行历史脚本。

本地正例：抽查一条2026-07-14线程成功还原7个提示词，其中一条2729字符。这证明本地日志路径在有完整记录时实际可用；不能据此认为每张 ChatGPT Library 云端图都存在对应本地日志。

对当前299张云端图片的Library/file/source message/thread标识做本地搜索：66个云端来源thread均无同ID的本地rollout文件。共有14个本地日志包含至少一个云端标识；使用现有提取索引检查这些日志，未得到对应云端标识的生成提示词映射。额外云端读取取得19个generation ID参与核对；52个会话的本轮读取未成功，generation ID核对覆盖不完整，不能宣称已排除所有可能关联。

接入条件应是明确的同图关联：本地原始生成输出记录含同一个图片标识（或原生记录提供可验证的ID映射），且同一call_id可连接到保留完整prompt的工具调用。Library ID、file ID、generation ID、本地generated_images文件名及thread ID是不同语义，不按名称、时间接近或用户请求相似猜测匹配。现有原生Prompt page-script尚未接入Node侧本地索引，需要通过Runtime Host的受约束操作读取，不能在Renderer直接访问日志目录。

## 本地执行链路验证与接入

2026-10-02 在本机日志中验证到真实完成事件：本地 thread
`019f6090-89c8-71b2-8aa5-2577e9343c93`，生成结果
`exec-63c6ff62-e469-4fc9-8d7a-b3f8ce9b0b35`。事件类型为
`item_completed`，item 为已完成的 `Extension/image_gen.generation`，
记录 `revisedPrompt`（2,729 字符）与同 ID 的 `savedPath`；图片文件实际存在。
因此本地执行来源的精确结果 ID → 本地 thread → 生成记录链路可用。

已接入 Images viewer 的补充查询：云端真实生成提示词 → 精确本地生成记录 →
注明来源的原始请求。完成事件 revisedPrompt 优先于工具包装层静态请求参数。
跨云端／本地 thread 仅凭同名生成资产定位，不根据模式名称或标题推断。
输入不接受任意路径；同生成 ID 对应多个本地会话时不返回结果。

边界：目前未确认已审计的 Space 云端图片存在与本地生成结果 ID 的精确匹配。
不能把本地 positive sample 当作这些云端图片已恢复的证据。隔离窗口确认真实
图片触发已鉴权的 local-image-prompt 请求，未命中时原始请求标注与复制仍正常。
现有真实本地样本通过 Backend 返回 2,729 字符生成提示词；完整的原生 Space
图片与本地记录命中预览仍待具有相同生成标识的样本。

## 本地图片覆盖率（2026-10-02 全量核对）

分母是本机 `.codex/generated_images` 中实际存在的 252 张 PNG，分布在 51 个
会话目录；这些会话均找到本地日志。247 张（98.0%）具有与图片结果 ID 一致的
`item_completed / Extension / image_gen.generation` 提示词记录，另外 5 张尚未
精确提取到。此统计独立于 Space，也不包含用户消息回退。

发现旧协议完成事件的内部 item.status 仍可能是 `generating`：149 张属于该
情况，98 张为 `completed`。原实现因内部状态过滤只读取 98 张（38.9%）；已
改为依据完成事件类型及生成 kind、结果 ID、非空 revisedPrompt 接受记录，
并以旧状态样例回归验证。不能将内部状态过滤造成的漏读解释为日志缺失。

## 用户指定样本：08-observer-vertical-9x16-upscaled.png

实测 Space 文件 `libfile_6c9c4a91a9088191a1b31a600aaf69ab`，内容文件
`file_00000000992471fda76b9a9701fe9c16`，来源会话
`6a4baa66-2650-83ea-89ce-7e2757a36911`（Agent 角色卡设计），来源消息
`bc752bf0-625e-44e8-9956-e47a7d5efc71`。

来源消息提供同名 sandbox 下载链接；直接祖先 Python execution_output 明确
输出该文件。Python code 从 `/mnt/data/a_high_detail_digital_concept_art_compilation_po.png`
读取八角色拼图，裁切第八块，调整为 1440×2560，并保存到
`/mnt/data/agent_cards_vertical_9x16_upscaled/08-observer-vertical-9x16-upscaled.png`。
aggregate_result 包含 Jupyter 执行消息及成功状态，是云端 Python 沙箱产物；
不得将此 sandbox 路径解释为 macOS 本地文件路径。

同祖先链有两次生图工具调用，recipient 为 t2uay3k.sj1i4kz。公开工具参数 prompt
为 null／空，资产 dalle.prompt 为空，async_task_prompt 不存在。最近生成结果的
gen_id 为 `3e8e36c5-fa2e-468f-ae3d-affa9e6b9b86`。Python 输入文件路径与来源输出
链已追溯，但接口未提供该 sandbox 输入路径至 sediment 资产 ID 的显式映射，
不能仅凭最近生成结果声明精确资产关联。

本机 sessions、archived_sessions 对文件名、源图文件名、来源会话 ID 和两个
生成 ID 的搜索只命中当前调查会话，无原始执行日志；项目／Documents／Downloads
文件名搜索也未找到该文件。该样本可证明 Space → 云端输出消息 → Python 派生
产物的关联，不能用来证明 Space → 本地生成记录的映射，也不能据此判断本地
映射不可实现。本次没有增加原始生成提示词命中数。

## 当前实现收敛

2026-10-02：以上 local-image-prompt 是探索阶段的历史链路，因没有命中实际云端图片已移除。当前方案在 Space → Images 接入 Image Gen 本地来源，以索引 ID 精确关联生成提示词；原生组件承担标签、骨架、Masonry、卡片、菜单、详情和编辑器，Adapter 隔离构建与上下文契约。旧独立图库预览和专有 base64 传输实现已移除。云端图片继续使用原有明确标注的 Original request 回退。

## 本地图片接入原生收藏／文件夹的可行性（2026-10-02）

依据：本机 Codex 26.930.21537 安装包中的原生源码；原协议调查已完成；以下新增隔离实测记录补充实际上传、收藏和移动验收。

原生 `library-uploads` 的 drop 入口调用 Library upload 编排，单文件上传显式设置 `uploadPurpose: "library"`、`storeInLibrary: true`、`libraryPersistenceMode: "required"`，并返回 `libraryFileId`。这一条是原生 Library 本身的上传链路，不能与普通聊天附件的临时保存混用。

编排通过原生文件上传能力执行创建文件条目、上传字节、处理文件三个阶段。原生 Page 文件 API 也采用 required 持久化并校验返回 Library ID，说明上传完成后得到真实的服务端条目，而不是 Renderer 中伪造 ID。仅登记本地绝对路径的接入接口尚未发现；已有云端 file_id 的导入分支可以通过 POST /files/library/files 创建 Library 条目，但本地 PNG 没有这个云端文件身份，不能用路径或生成 ID 替代。

取得真实 Library 条目后：

- 收藏：POST /files/library/favorites，target_ref 为 library_file + library_file_id；关系保存在服务端。
- 文件夹：原生 MoveLibraryItemsDialog 选择目标，PATCH /files/library/files/{library_file_id}/move，directory_id 为目标云端文件夹；归属保存在服务端。
- 原生编排会更新／失效 Library 查询缓存，避免服务端成功后页面仍显示旧状态。

建议接入契约：只有用户主动点击 Add to Favorites 或 Add to folder 时，才将所选本地图片上传到 Library；浏览、索引、悬浮不上传。首次操作复用原生上传状态与错误反馈，处理成功后才继续收藏／选择文件夹。用户取消文件夹选择可能留下已上传的 Library 图片，这个后果必须在实现和产品说明中明确。

本地可保存的是“账号 + 本地稳定图片身份／内容指纹 → 云端 Library ID”的映射，用于避免重复上传；收藏状态与文件夹关系仍以服务器为准。本地映射不能跨账号复用，原生条目被删除／访问失效时应重新确认身份；上传处理结果不确定时不能盲目重试而制造重复记录。

架构归属：上传、Library 条目、收藏／移动协议放在 Images 的 Codex Adapter；协调首次登记和后续操作的应用流程属于 Images，不塞入 Runtime Host。原生 Library scope 与页面 route scope 是不同契约，不能直接拿当前图片预览的 route scope 调用收藏或文件夹操作。未来正式接入应复用注册后的原生 Library 菜单及文件夹选择器，不维护第二套本地收藏／分组业务。


## 云端收藏／文件夹落地与隔离验收

Codex 26.930.21537，隔离 CDP 9233。通过 Image Gen 第一张图片的原生菜单操作上传，返回 `libfile_ce2c0a0793e481918d42144ccb358ff0`，云端 `/node` 返回 owned、image/png、ready，内容文件 `file_00000000f22881f99a27eedf16313596`。初始 `/files/library/files/{id}` 返回 404，新版原生读取有 `/node` 分支；实现收敛为真实节点接口，不用旧文件详情响应冒充节点。

真实点击 Add to Favorites 后，服务器 favorites/status 返回 available 与 favorite_id，原生 toast 显示 Added to Favorites。真实取消文件夹选择后原生 toast 显示 No folder selected，未改变归属。随后通过原生 New folder 创建 `MineCodex Image Gen validation 2026-10-02`，点击 Move here，服务器节点的 parent_directory_id 变为 `6abfa629f3948191bf4aba07e9d22132`。同一图片这些操作只登记一次；测试图片和验证文件夹保留供验收。

菜单已使用原生 More mediaOverlay、Dropdown 材质、图标和顺序。View prompts 的实际 SVG 由 20px 收敛到与原生菜单一致的 16px。首次登记后取消的 toast 文案通过工作流 created 状态判定，已上传身份取消的分支已实测；“首次上传并立即取消”的组合没有再额外上传第二张图片做实测。

身份映射只保存 Library ID，按账号、用户、本地索引 ID 与内容 SHA-256 分离；收藏／文件夹从服务器读取。原子上传预留与在途任务去重防止多窗口重复登记。失败导致结果不确定时保留预留并阻止盲目重传，当前不自动恢复此类记录。原生账号检查、取消后身份复用、内容变化、并发预留、收藏失败重试及不确定上传已加入有行为意义的回归验证。
