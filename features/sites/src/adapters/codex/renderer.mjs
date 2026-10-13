// 专有路由、页面锚点和原生网页打开协议不跨出此适配器。
export function createSitesAdapter(signal,codex,invalidate) {
  let nativeButton,nativeInner,nativePlus,nativeSiteIcon,nativeMore,nativeExternal,nativeGlobe,nativeActionsClass;
  const owned="data-mcx-sites";
  const account=codex.account(signal,invalidate);
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
  if (applicability() !== "applicable") return null;
  const plus=account.read().planType === "plus";
  const input = [...document.querySelectorAll("input")].find(e => visible(e) && /Search sites|搜索站点|搜尋網站/.test(e.placeholder));
  if (!input) return null;
  let page = input.parentElement;
  while (page && !page.classList.contains("min-h-full")) page = page.parentElement;
  if (!page || page.children.length < 2) return null;
  const content = plus ? page.lastElementChild : page.children[1], list = page.querySelector('[data-testid="sites-table"], [data-testid="sites-grid"]');
  if (!visible(content)) return null;
  const native = nativeProps(list || content.querySelector("button") || content.querySelector("p") || content.lastElementChild?.lastElementChild, p => "viewMode" in p && "shared" in p);
  const grid = native ? native.viewMode === "grid" : !!page.querySelector('button[aria-label="Grid view"][aria-pressed="true"],button[aria-label="网格视图"][aria-pressed="true"]');
  const ownershipTabs=[...page.querySelectorAll('[role="tablist"]')].find(node=>!node.closest(`[${owned}]`)&&nativeProps(node,p=>p.tabs?.some(tab=>tab.key==="owned")&&p.tabs?.some(tab=>tab.key==="shared")));
  const ownership=ownershipTabs&&nativeProps(ownershipTabs,p=>p.tabs?.some(tab=>tab.key==="owned")&&p.tabs?.some(tab=>tab.key==="shared"));
  const shared = ownership ? ownership.selectedKey === "shared" : native ? !!native.shared : [...page.querySelectorAll("button[aria-pressed=true]")].some(b => /Shared with you|与你共享|與你共用/.test(b.textContent));
  const create = [...(plus ? page : page.firstElementChild).querySelectorAll("button")].find(b => visible(b) && (plus ? /^(Create Site|创建站点|建立網站)$/ : /^(New|新建|新增)$/).test(b.textContent.trim()) && !b.hasAttribute(owned));
  codex.report("sites-page",true);
  return { page, input, content, list, grid, shared, create, plus, ownershipTabs:plus?(ownershipTabs??null):null, accountKey:account.read().key, empty: list ? null : [...content.children].findLast(e => !e.hasAttribute(owned)) };
}
function mountOwnership(page,onSelect) {
  const tabs=page.ownershipTabs,original=tabs?[...tabs.querySelectorAll('[role="tab"]')]:[];
  let wrapper;
  const hidden=tabs?.hidden,node=tabs?tabs.cloneNode(false):document.createElement("div");
  if (!tabs) {
    // 26.1007：共享能力确认后可能移除原标签组；保留已测 browse 分支。
    node.className="flex min-w-0 items-center gap-1 hide-scrollbar overflow-x-auto overflow-y-hidden";
    node.setAttribute("role","tablist");node.setAttribute("aria-label",text("Site views","站点视图"));
    const native=document.createElement("button");native.type="button";native.setAttribute("role","tab");native.setAttribute("aria-selected","true");
    native.textContent=text("Owned by you","你拥有的");
    native.className="cursor-interaction items-center text-sm select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 flex h-9 min-w-0 rounded-full border border-transparent px-4 py-0 font-medium ring-inset bg-primary-ghost-hover text-default";
    native.onclick=()=>{const r=router(),location=r.state.location,search=new URLSearchParams(location.search);search.delete("view");search.delete("search");r.navigate({pathname:location.pathname,search:search.size?`?${search}`:""},{state:location.state});};
    original.push(native);
    wrapper=page.content.cloneNode(false);
    wrapper.classList.remove("min-h-0","flex-1","flex-col","pb-4","bg-surface");wrapper.classList.add("min-h-15","items-center");
    wrapper.setAttribute(owned,"ownership-wrapper");wrapper.append(node);page.content.before(wrapper);
  }
  const buttons=original.map(button=>button.cloneNode(true));
  let selected="native";
  node.removeAttribute("id");node.setAttribute(owned,"ownership");
  const added=original[0].cloneNode(false);added.textContent=text("Added by you","由你添加");buttons.push(added);
  buttons.forEach((button,index)=>{
    button.removeAttribute("id");button.removeAttribute("aria-controls");
    button.onclick=()=>{selected=index===original.length?"added":"native";if(selected==="native")original[index].click();sync();onSelect(selected);};
    node.append(button);
  });
  function sync() {
    const active=original.find(button=>button.getAttribute("aria-selected")==="true"),inactive=original.find(button=>button.getAttribute("aria-selected")!=="true");
    buttons.forEach((button,index)=>{
      const chosen=selected==="added"?index===original.length:original[index]?.getAttribute("aria-selected")==="true";
      button.className=(chosen?active:inactive)?.className || original[0].className.replace("bg-primary-ghost-hover text-default","text-secondary hover:bg-background-primary-ghost-hover/50 hover:text-default");
      button.setAttribute("aria-selected",String(chosen));button.tabIndex=chosen?0:-1;
    });
  }
  node.onkeydown=event=>{
    if (!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
    event.preventDefault();const index=buttons.indexOf(document.activeElement),last=buttons.length-1;
    const next=event.key==="Home"?0:event.key==="End"?last:(index+(event.key==="ArrowRight"?1:last))%buttons.length;
    buttons[next].click();buttons[next].focus();
  };
  if (tabs) {tabs.after(node);tabs.hidden=true;}sync();
  return {node,tabs,sync,selection:()=>selected,selectAdded:()=>added.click(),dispose(){wrapper?.remove();node.remove();if(tabs)tabs.hidden=hidden;}};
}
function applicability() {
  const current=account.read(),path=router()?.state?.location?.pathname;
  if (!path || current.status !== "available") return "unknown";
  return path === (current.planType === "plus" ? "/sites" : "/space/sites") ? "applicable" : "not-applicable";
}
function isSitesPath() { return ["/sites","/space/sites"].includes(router()?.state?.location?.pathname); }
function browserMenu() {
  for (const menu of document.querySelectorAll('[role="menu"]')) {
    if (!visible(menu)) continue;
    const actions = nativeProps(menu, p => typeof p.onOpenDownloads === "function" && typeof p.onOpenChange === "function");
    const page = nativeProps(menu, p => p.browserState && p.browserTabId);
    if (!actions || !page || page.isVisible === false) continue;
    const downloads = [...menu.querySelectorAll('[role="menuitem"]')].find(e => /^(Downloads|下载|下載)$/.test(e.textContent.trim()));
    if (!downloads) continue;
    const host = nativeProps(menu, p => p.browserTabId === page.browserTabId && "browserHostDisplayName" in p);
    let url;
    try { url = new URL(page.browserState.url); } catch { continue; }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) continue;
    return { menu, downloads, tabId: page.browserTabId,
      page: { url: url.href, title: page.browserState.title || url.hostname,
        cwd: host?.browserHostDisplayName === "Local" ? page.cwd : null },
      close: () => actions.onOpenChange(false) };
  }
  return null;
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
    const template = page.page.querySelector('button[data-size="lg"][data-color="secondary"]') || create;
    if (template) { nativeButton = template.className; nativeInner = template.firstElementChild?.className || ""; }
    nativePlus = create.querySelector("svg")?.cloneNode(true);
    // New 的图标在桌面端隐藏，克隆后只保留图标自身样式。
    nativePlus?.classList.remove("hidden", "browser:max-md:block");
  }
  nativeSiteIcon ||= [...document.querySelectorAll('button, a')].find(e => /^(Sites|站点|網站)$/.test(e.textContent.trim()) && !e.closest(`[${owned}]`))?.querySelector("svg")?.cloneNode(true);
  const row = page.list?.querySelector("[data-appgen-row], article");
  nativeExternal ||= row?.querySelector('button[aria-label*="new tab"]')?.cloneNode(true);
  nativeActionsClass ||= row?.lastElementChild?.className;
  nativeGlobe ||= [...(page.list?.querySelectorAll("[data-appgen-row]") || [])].find(r => r.children[2]?.textContent.includes("Everyone"))?.children[2]?.querySelector("svg")?.cloneNode(true);
  nativeMore ||= row?.querySelector('button[aria-haspopup="menu"] svg')?.cloneNode(true);
  return {nativeButton,nativeInner,nativePlus,nativeSiteIcon,nativeMore,nativeExternal,nativeGlobe,nativeActionsClass};
}

return {templates,pageInfo,mountOwnership,browserMenu,fullViewControl,open,applicability,isSitesPath,accountKey:()=>account.read().key,path:()=>router()?.state?.location?.pathname};
}
