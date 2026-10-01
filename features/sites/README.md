# Local & Self-hosted Sites

Extends the native Sites page. **Add site** discovers website entries from local Codex project files, including stopped sites, and supplements them with running HTML services. Select candidates with checkboxes and confirm with Add, or use Custom URL to enter an HTTP/HTTPS URL and name. Both modes provide Cancel / Add; Add stays disabled until the selection or required fields are valid.

- Project: opens a native new draft in that project.
- Projectless chat: reopens the original conversation.
- External: opens a native projectless draft.

Existing unsent drafts are preserved; opening a site never sends a message. Saved entries remain when the service stops. Missing projects/chats prompt removal and addition from an available project. Project entries have no Edit site action; Custom URL editing only exposes URL and name. Remove from Sites only deletes the local shortcut.

Opening a saved or official site collapses the chat sidebar and uses the native splitter's maximum browser width once. It does not save a new resize preference or continuously override manual dragging.

## Storage and discovery

Project entry identity uses project + directory rather than port. `project-history.json` stores actual MineCodex launch times (`lastStartedAt`) and observed online times (`lastSeenAt`). The UI displays the project name and adds the port in parentheses only when confirmed running. Custom URLs without a project display their address. Historical timestamps are not shown or inferred from file timestamps.

Local records: `sites/sites.json` under the MineCodex application support directory. `MINECODEX_SITES_DATA_DIR` can isolate the store for development. Native OpenAI site records and sharing permissions are not modified.

macOS discovery associates listening processes' working directories with Codex local project roots, then checks HTML responses with bounded time and size. APIs, unrelated processes and redirects are excluded. Simulator preview bridges (`serve-sim` and `swiftui-preview-browser`) are excluded by full process command before any HTTP request: their homepages may execute `simctl` and trigger Xcode installation. Processes whose full command is unavailable are also skipped; manual addition remains available. Windows uses listening-process command lines when they contain a known project path; Windows does not expose the same cwd metadata, so services with relative-only command lines require manual addition. Project file discovery is deterministic code: it recognizes simple Vite / Next dev / Astro dev scripts and package-free directories containing index.html. It traverses up to four levels with a 4,000-directory budget, skipping hidden directories, dependencies and common build outputs. It does not execute config files or use an LLM. External worktrees and remote hosts are not yet included; complex scripts and arbitrary subpath routes remain outside automatic detection. Manual URLs can include paths or self-hosted domains.

Discovery never starts services. Opening a saved stopped site can start a supported, already-installed framework or a loopback-only static server; dependencies are not installed and arbitrary npm scripts are not executed. MineCodex stops only its own launched services when its runtime stops. No external network ranges are scanned, and no pages or thumbnails are uploaded. Discovery candidates and saved custom sites request background screenshots through an isolated headless Chrome/Edge profile. Previews are cached locally by URL in `previews/`, outside the site records, and reused after restart. Capture does not block Add/Remove. Browser absence, unavailable pages, simulator bridges, or capture failure leave the native placeholder; private browser login sessions are not reused. Screenshots currently capture a 960×600 viewport after a bounded render wait, and are not live previews.

## Native UI boundary

The renderer owns `data-mcx-sites` elements; the Local address filter temporarily hides native rows and updates tab selection styling, restoring them on exit. It uses native Sites layout classes, current semantic theme tokens, and the existing Prompts dialog/menu patterns. The route-state and resize adapters depend on native renderer internals and must be verified against app updates. Icon sources: native Sites controls, existing Prompts resources, and the Lucide monitor icon; Lucide license is included in `vendor/`.

弹窗与浮层统一调用 Runtime Host 的 `config.ui`（`packages/runtime-host/src/feature-dialogs.mjs`），共享主题材质、标题、Close 和表单操作区；插件只维护内容及交互。
