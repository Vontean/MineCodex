# ChatGPT macOS 生成图片、`sediment://` 协议与缓存研究

> 研究日期：2026-08-21
>
> 范围：公开的一手资料 + MineCodex 隔离 ChatGPT 实例的本机实测。内部行为仅作为当前版本的兼容性证据，不视为公开稳定 API。

## 结论摘要

最终采用的最经济方案不是监听缓存目录，而是复用页面已经成功加载的生成图：

```text
稳定 data-testid 定位 generated-image-gallery
  -> React Fiber 读取 conversationId 与 sediment 图片元数据
  -> 已加载的 blob: <img> 绘制到 canvas 并导出 PNG
  -> token-scoped RuntimeHost binding 传给宿主
  -> Images 服务按现有契约落盘并建立路径索引
```

隔离实例实测表明：

- 当前生成图的 DOM 是 `img[src^="blob:"]`，外层有稳定的 `data-testid="generated-image-preview"` 和 `data-testid="generated-image-gallery"`。
- gallery 对应的 React props 含 `conversationId`，图片项含 `id`、`src: sediment://file_*`、尺寸和状态。实现只匹配固定的 `__reactFiber$` 前缀，不硬编码构建时随机后缀。
- renderer 中直接 `fetch(blobUrl)` 失败，但把已经加载完成的 `<img>` 绘制到 canvas 后，`canvas.toBlob("image/png")` 能取得完整图片。
- renderer 直接 POST 本机 Images 服务会被当前 App 网络边界中止；经 RuntimeHost 的受限 binding 转发则成功。
- Chromium cache 中确有 `/backend-api/estuary/content` 的 PNG body，但它是 Chromium Simple Cache v5 entry，不是适合监听和复制的普通图片目录。

因此 MineCodex 仍只保存 Images 所需的本地副本和路径索引，不读取 ChatGPT 原始缓存格式，也不导入任意附件或网页图片。

## 1. `sediment://file_*` 能说明什么

`sediment` 是一个 URI scheme 名称。仅凭 `sediment://file_*`，公开标准只能说明资源使用了自定义 scheme；不能推出它是 Electron `protocol.handle` 注册的协议，也不能推出它对应磁盘上的文件。

Electron 的官方协议 API 允许主进程为某个 session 注册自定义协议处理器。较新的 API 是 `ses.protocol.handle(scheme, handler)`；协议注册绑定到具体 `Session`。如果 BrowserWindow 使用了自定义 partition/session，而处理器注册在默认 session，两者不会自动共享该协议处理器。见 [Electron protocol API](https://www.electronjs.org/docs/latest/api/protocol/)。

Electron 还可以在 app ready 前为 scheme 声明 `standard`、`secure`、`supportFetchAPI`、`bypassCSP` 等权限；这些权限影响该 Electron 应用自己的 scheme 行为，并不赋予外部 renderer 或 CDP 客户端读取另一个应用内部 scheme 的能力。见 [Electron CustomScheme](https://www.electronjs.org/docs/latest/api/structures/custom-scheme)。

截至本研究，没有查到 OpenAI 一手资料公开 ChatGPT macOS 的 renderer、Electron session、`sediment` handler 或生成图片缓存目录。因此“ChatGPT 是 Electron 应用”只能作为待验证假设，不能写进实现契约。

## 2. Chromium/Electron 缓存是否适合作为图片索引源

Chromium 官方设计文档明确说明：磁盘 HTTP cache 是一个 cache 目录，内部至少包含 index 和 data/block files；大于阈值的内容还可能存储为独立文件。缓存文件由 Chromium 管理，缓存中的任何文件都可能被 Chromium 删除。见 [Chromium disk cache design](https://chromium.googlesource.com/website/+/HEAD/site/developers/design-documents/network-stack/disk-cache/index.md) 和 [Chromium disk_cache README](https://chromium.googlesource.com/chromium/src/+/main/net/disk_cache/README.md)。

这带来两个直接结论：

- 不能把 cache 目录中的每个新文件当作 PNG/JPEG；文件名、block 内容和元数据不构成稳定的图片文件索引协议。
- 即使某一张图片碰巧以独立文件形式出现，也不能仅凭文件变化把它可靠关联到 `conversationId`、`imageId` 或 Chat/Work 来源。

Electron 暴露的是 session 级 cache 管理能力，例如 `getCacheSize()`、`clearCache()` 和 `getStoragePath()`，而不是“列出 HTTP cache entry 并按 URL 读取图片文件”的稳定公共 API。见 [Electron session API](https://www.electronjs.org/docs/latest/api/session)。

因此，直接扫描 Chromium cache 目录属于脆弱的逆向适配：可以用于实验性探测，但不适合作为 Images 的正式数据源。

## 3. 各种 hook 的边界

| 机制 | 能做什么 | 关键边界 | 对 `sediment://` 的判断 |
|---|---|---|---|
| Electron `protocol.handle` | 在宿主主进程为指定 session 注册或处理 scheme；可以返回 `Response`、文件路径、URL 或 stream | 必须控制注册该 protocol 的宿主和正确 session；插件注入脚本本身不能注册别的 App 的 handler | 只有 MineCodex 自己拥有目标 session/宿主时才适用 |
| Electron `webRequest` | 在指定 session 的请求生命周期中观察/修改请求；可用 URL filter | API 位于 main process；只覆盖对应 session；官方 WebRequest 不是通用 response-body reader | 可观察请求元数据，但不能单凭 `webRequest` 取得任意响应 bytes |
| CDP `Network` | 对已连接 target 的网络事件提供 request/response 信息；`Network.getResponseBody` 可取该 request 的响应 body | 必须连接到产生该请求的 target，并在请求生命周期内保存 requestId；缓存、协议内部加载或其他 target 不会自动出现在当前 target | 仅当图片请求真正经过当前 renderer target 才可用 |
| CDP `Fetch` | 在 Request 或 Response stage 暂停请求；Response stage 可 `getResponseBody` 或取 stream | 必须在响应阶段暂停；暂停后必须继续、失败或提供响应；只拦截 CDP target 能看到的网络请求 | 对可见 HTTP(S) 图片有用；不能突破 native/其他 session/内部 scheme 边界 |
| service worker / Cache Storage | 页面自己的 service worker 和 Cache Storage 可以被页面/宿主按 origin 访问 | 只覆盖拥有该 origin 的页面与 storage；不是 Chromium HTTP disk cache 的通用浏览器 | 只有 ChatGPT 页面明确把图片放入可访问 Cache Storage 才适用 |
| 文件夹 watcher | 观察一个真实目录的 create/rename/write 事件，在文件完成后 copy/index | 需要知道稳定目录；事件可能重复或只报告 rename；缓存文件可能不是图片并会被删除 | 如果实测存在稳定临时图片目录，这是最经济的实现候选 |
| net log | Electron session 可记录网络日志用于诊断 | 日志记录请求/网络事件，不等于提供长期图片文件；仍受 session/宿主边界影响 | 适合确认请求路径，不是 Images 的最终数据源 |

CDP 的官方定义很明确：`Fetch.getResponseBody` 只适用于已经在 Response stage 被暂停的请求；`Fetch.takeResponseBodyAsStream` 也要求在 HeadersReceived stage 暂停。见 [CDP Fetch domain](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/)。`Network.getResponseBody` 返回的是指定 request ID 对应的 response body，不能通过一个 `imageId` 或自定义 scheme 字符串反查另一个 target 的内容。见 [CDP Network domain](https://chromedevtools.github.io/devtools-protocol/1-3/Network/)。

Electron 的 `webContents.debugger` 可以让 Electron 主进程向该 WebContents 发送 CDP command；这进一步说明 CDP 的权限边界是具体 WebContents/target，而不是“整个 App 的所有网络”。见 [Electron webContents debugger](https://www.electronjs.org/docs/latest/api/web-contents)。

## 4. “缓存目录更新时 copy 一份”的可行性

### 可行的情况

如果 ChatGPT 的图片管线满足以下形态，watcher 方案可以成立：

```text
生成图片
  -> 写入普通 .png/.jpeg 临时文件
  -> close/fsync
  -> rename 到稳定缓存目录
  -> renderer 使用该文件或 custom-scheme URL
```

此时宿主可以监听稳定目录，按扩展名和 magic bytes 过滤，等待文件大小稳定或只处理 rename 完成的目标文件，再调用现有 Images 的本地路径索引/复制逻辑。关联信息应来自同一时刻已观察到的 conversation/output 元数据，而不是从随机文件名推测。

### 不可依赖的情况

以下情况会使 watcher 方案失效或产生错图：

- 图片只存在于内存、GPU/renderer resource 或 native 下载器内部。
- 只写入 Chromium block cache，文件本身没有 PNG/JPEG header。
- 缓存由多个 ChatGPT 页面、账号或资源类型共享，无法稳定关联会话。
- 文件在 watcher 处理前已经被清理，或只产生临时文件 rename/delete 事件。
- `sediment://` handler 每次请求实时解码/解密，而不是映射到一个可见文件。

所以“有临时缓存”是一个值得验证的假设，但不是公开资料已经证明的事实。必须先找到实际可读的普通图片文件，再决定是否采用 watcher；不应先把 Chromium cache 的内部文件当作产品接口。

## 5. #12 最终实现方案

### 页面侧识别

1. 只扫描 `[data-testid="generated-image-gallery"]`，不扫描普通 `img`。
2. 只接受同时具备 `conversationId` 与 `sediment://file_*` 元数据的 gallery。
3. 从当前选中的稳定会话入口 `[role="button"][aria-current="page"]` 判定尾部的 `Chat` / `Work`，并从标题中移除该来源标签。
4. 用 `conversationId + imageId` 去重；不根据图片 URL、随机 class 或 React Fiber 随机后缀建立身份。

### 图片提取与宿主转发

1. 优先尝试读取图片 URL；当前 `blob:` 不能 fetch 时，使用已加载 `<img>` + canvas 导出 PNG。
2. 页面只调用 Images feature 声明的 `import-generated-image` Host action。
3. RuntimeHost 验证 feature token 后，将精确 payload 转发给 Images 服务；不转发 cookie、Authorization 或任意 URL。
4. Images 服务复用既有 `/api/import-generated-image`，把 PNG 写入自己的数据目录并更新元数据索引。

### 稳定性边界

- 使用 `data-testid`、ARIA 当前会话状态和固定 React Fiber 属性前缀；不依赖构建产物中的随机 CSS class 或随机属性后缀。
- React Fiber 只承担补足当前 DOM 未公开的会话/图片 ID。若 ChatGPT 后续正式暴露等价 DOM 属性，应优先改用公开属性。
- 不增加 cache watcher、Chromium cache parser 或定时目录扫描；这些机制会引入来源误判、缓存格式耦合和重复导入。

### 验收结果

- 隔离 ChatGPT 实例生成一张纯红色方形图片后，生产链路成功导入 Images。
- 导入结果为 PNG，尺寸 `1254 × 1254`，大小 `1,613,895` bytes，来源标记为 `chat`，会话标题正确去掉尾部 `Chat`。
- `chatgpt:` 命名空间会话 ID 不再重复添加前缀。
- Chat 路径完成真实窗口验收；Work 与 Chat 使用同一 gallery/import 链路，来源识别另有聚焦测试覆盖，本轮未额外生成 Work 图片。

## 参考资料

- [Electron protocol](https://www.electronjs.org/docs/latest/api/protocol/)
- [Electron CustomScheme](https://www.electronjs.org/docs/latest/api/structures/custom-scheme)
- [Electron WebRequest](https://www.electronjs.org/docs/latest/api/web-request/)
- [Electron session](https://www.electronjs.org/docs/latest/api/session)
- [Electron webContents](https://www.electronjs.org/docs/latest/api/web-contents)
- [Electron ProtocolResponse](https://www.electronjs.org/docs/latest/api/structures/protocol-response/)
- [Chrome DevTools Protocol overview](https://chromedevtools.github.io/devtools-protocol/)
- [CDP Fetch domain](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/)
- [CDP Network domain](https://chromedevtools.github.io/devtools-protocol/1-3/Network/)
- [Chromium disk cache design](https://chromium.googlesource.com/website/+/HEAD/site/developers/design-documents/network-stack/disk-cache/index.md)
- [Chromium disk_cache README](https://chromium.googlesource.com/chromium/src/+/main/net/disk_cache/README.md)
