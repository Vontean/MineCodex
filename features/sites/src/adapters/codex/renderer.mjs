// 专有路由、页面锚点和原生网页打开协议不跨出此适配器。
export function createSitesAdapter(signal,codex) {
  let nativeButton,nativeInner,nativePlus,nativeSiteIcon,nativeMore,nativeExternal,nativeGlobe,nativeActionsClass;
  const owned="data-mcx-sites";
  const text=(en,zh)=>(document.documentElement.lang || navigator.language).startsWith("zh") ? zh : en;
  const visible=e=>!!e?.isConnected && e.getBoundingClientRect().width>0 && e.getBoundingClientRect().height>0;
  async function until(check) {
    const end=Date.now()+10000;
    while(!signal.aborted && Date.now()<end) {const value=check();if(value)return value;await new Promise(resolve=>setTimeout(resolve,80));}
    throw new Error(text("The native view did not become ready.","原生视图未就绪。"));
  }
function nativeProps(node, predicate) {
  let fiber = codex.currentFiber(node);
  for (let depth = 0; fiber && depth < 220; depth++, fiber = fiber.return) { const p = fiber.memoizedProps; if (p && predicate(p)) return p; }
  return null;
}
function router() {
  const p = nativeProps(document.querySelector("[data-sidebar-destination]"), p => p.router?.navigate || p.value?.router?.navigate);
  return p?.router || p?.value?.router;
}
function pageInfo() {
  if (router()?.state?.location?.pathname !== "/space/sites") return null;
  const input = [...document.querySelectorAll("input")].find(e => /Search sites|搜索站点|搜尋網站/.test(e.placeholder));
  if (!input) return null;
  let page = input.parentElement;
  while (page && !page.classList.contains("min-h-full")) page = page.parentElement;
  if (!page || page.children.length < 2) return null;
  const content = page.children[1], list = page.querySelector('[data-testid="sites-table"], [data-testid="sites-grid"]');
  const native = nativeProps(list || content.querySelector("button") || content.querySelector("p") || content.lastElementChild?.lastElementChild, p => "viewMode" in p && "shared" in p);
  const grid = native ? native.viewMode === "grid" : !!page.querySelector('button[aria-label="Grid view"][aria-pressed="true"],button[aria-label="网格视图"][aria-pressed="true"]');
  const shared = native ? !!native.shared : [...page.querySelectorAll("button[aria-pressed=true]")].some(b => /Shared with you|与你共享|與你共用/.test(b.textContent));
  const create = [...page.firstElementChild.querySelectorAll("button")].find(b => /^(New|新建|新增)$/.test(b.textContent.trim()) && !b.hasAttribute(owned));
  codex.report("sites-page",true);
  return { page, input, content, list, grid, shared, create };
}
function fullViewControl(enter) {
  const pattern = enter ? /^(Enter full view|进入完整视图|进入全屏视图|進入完整檢視|進入全螢幕檢視)$/ : /^(Exit full view|退出完整视图|退出全屏视图|退出完整檢視|退出全螢幕檢視)$/;
  return [...document.querySelectorAll("button")].find(e => visible(e) && [e.getAttribute("aria-label"), e.getAttribute("title"), e.getAttribute("data-tooltip-content")].some(value => pattern.test(value || "")));
}
async function open(origin,url,cwd) {
    const r = router(); if (!r) throw new Error(text("Native navigation is unavailable.", "原生导航暂不可用。"));
    if (origin.kind === "thread") {
      await r.navigate(`/local/${origin.threadId}`);
      await until(() => codex.currentThreadId() === origin.threadId);
    } else {
      const nonce = Date.now();
      // 项目网页必须进入本地执行草稿，普通聊天模式会丢弃项目上下文。
      await r.navigate("/", { state: {
        project: origin.kind === "project" ? { type: "local", projectId: origin.projectId } : null,
        ...(origin.kind === "project" ? { prefillLocalExecution: true, prefillComposerMode: "local" } : {}),
        focusComposerNonce: nonce
      } });
      await until(() => r.state.location.pathname === "/" && [...document.querySelectorAll('[data-codex-composer="true"]')].some(e => visible(e) && nativeProps(e, p => p.value?.kind === "new" && p.value.focusComposerNonce === nonce)));
      // 等原生草稿的 layout/effect 完成，浏览器再绑定到当前草稿。
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    // 只在同一原聊天中复用网址相同的原生 tab，项目新草稿仍走新建路径。
    const existing = origin.kind === "thread" && [...document.querySelectorAll('[role="tab"]')].find(e => {
      const p = nativeProps(e, p => p.tab?.kind === "browser");
      return p?.tab.props?.browserConversationId === origin.threadId && p.tab.durableRoute?.params?.restoreUrl === url;
    });
    if (existing) existing.click();
    else window.postMessage({ type: "open-browser-tab", ...(origin.kind === "thread" ? { conversationId: origin.threadId } : {}), initialUrl: url, ...(origin.kind === "project" ? { cwd: cwd } : {}), source: "manual", initiator: "sites_library" }, location.origin);

}
function templates(page) {
  const create = page.create;
  if (create) {
    const template = page.page.querySelector('button[data-size="lg"][data-color="secondary"]');
    nativeButton = template.className; nativeInner = template.firstElementChild.className;
    nativePlus = create.querySelector("svg")?.cloneNode(true);
  }
  nativeSiteIcon ||= document.querySelector('[data-sidebar-destination="builtin:sites"] svg')?.cloneNode(true);
  const row = page.list?.querySelector("[data-appgen-row], article");
  nativeExternal ||= row?.querySelector('button[aria-label*="new tab"]')?.cloneNode(true);
  nativeActionsClass ||= row?.lastElementChild?.className;
  nativeGlobe ||= [...(page.list?.querySelectorAll("[data-appgen-row]") || [])].find(r => r.children[2]?.textContent.includes("Everyone"))?.children[2]?.querySelector("svg")?.cloneNode(true);
  nativeMore ||= row?.querySelector('button[aria-haspopup="menu"] svg')?.cloneNode(true);
  return {nativeButton,nativeInner,nativePlus,nativeSiteIcon,nativeMore,nativeExternal,nativeGlobe,nativeActionsClass};
}

return {templates,pageInfo,fullViewControl,open,path:()=>router()?.state?.location?.pathname};
}
