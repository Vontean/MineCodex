const nativeSites=createSitesAdapter(signal,config.codex,schedule);
// 复用 Prompts 已验证的原生图标与 Lucide 图标，保持交互一致。
const ICONS = config.resources.icons;
const MENU_CLASSES = {"menu": "no-drag z-50 m-px flex select-none flex-col overflow-y-auto bg-surface-elevated-secondary/90 text-default ring-border ring-[0.5px] shadow-xl-spread backdrop-blur-sm rounded-2xl p-[var(--app-menu-gutter,var(--mcx-spacing))] min-w-[var(--app-menu-min-width,220px)]", "item": "no-drag outline-hidden flex min-h-[var(--app-menu-item-height,0px)] shrink-0 items-center justify-center p-[var(--app-menu-item-padding,var(--padding-row-y)_var(--padding-row-x))] text-(length:--app-menu-item-font-size,var(--mcx-text-sm)) leading-(--app-menu-item-line-height,var(--mcx-text-sm--line-height)) rounded-xl text-default group hover:bg-primary-ghost-hover focus:bg-primary-ghost-hover cursor-interaction flex flex-col", "row": "flex w-full min-w-0 items-center gap-[var(--spacing-menu-item-content,calc(var(--mcx-spacing)*1.5))]", "leading": "_leadingIcon_ml6jk_2"};
const text = (en, zh) => (document.documentElement.lang || navigator.language).startsWith("zh") ? zh : en;
const host = payload => config.requestHostAction("sites", payload);
const owned = "data-mcx-sites";
let disposed = false, state = { sites: [], projects: [], threads: [] }, addButton, rowsRoot, fallback, dialog, menu;
let rowSignature = "", nativeButton, nativeInner, nativePlus, nativeSiteIcon, nativeMore, timer, revision = 0, opening = false;
let nativeExternal, nativeGlobe, nativeActionsClass;
let currentPage, currentAccount, refreshAt = 0, pendingLayout = null;
let ownership;
const nativeHidden=new Map();
function restoreNativeContent() { for (const [node,hidden] of nativeHidden) node.hidden=hidden; nativeHidden.clear(); }
function restoreOwnership() { restoreNativeContent();ownership?.dispose();ownership=null; }
const style = document.createElement("style");
style.setAttribute(owned, "style");
style.textContent = config.resources.styles;
document.head.append(style);
function element(tag, className, content) { const e = document.createElement(tag); if (className) e.className = className; if (content != null) e.textContent = content; return e; }
function icon(name) { return new DOMParser().parseFromString(ICONS[name], "image/svg+xml").documentElement.cloneNode(true); }
function iconButton(label, name, action) { const b = element("button", "mcx-site-icon"); b.type = "button"; b.setAttribute("aria-label", label); b.setAttribute("data-minecodex-tooltip", label); b.append(icon(name)); b.onclick = action; return b; }


function visible(e) { return !!e?.isConnected && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0; }
function button(label, action, primary = false) {
  const b = element("button", nativeButton || ""); b.type = "button";
  b.dataset.color = primary ? "primary" : "secondary"; b.dataset.variant = primary ? "solid" : "outline"; b.dataset.size = "lg"; b.dataset.pill = "";
  b.append(element("span", nativeInner || "", label)); b.addEventListener("click", action); return b;
}
function dialogButton(label, action, primary = false, tone = "secondary") {
  const b = config.ui.action(element("button", "", label), primary ? "primary" : tone);
  b.type = "button"; b.addEventListener("click", action); return b;
}
function setButtonDisabled(button, disabled) {
  button.disabled = disabled; button.setAttribute("aria-disabled", String(disabled)); button.toggleAttribute("data-disabled", disabled);
}
function notice(message) {
  document.querySelector(`[${owned}=notice]`)?.remove();
  const n = element("div", "", message); n.setAttribute(owned, "notice"); n.setAttribute("role", "status"); document.body.append(n);
  setTimeout(() => n.remove(), 7000);
}
async function refresh() {
  const data = await host({ operation: "list" });
  if (disposed) return; state = data; revision++; rowSignature = ""; refreshAt = Date.now(); schedule();
}

function cacheNative(page) {
  ({nativeButton,nativeInner,nativePlus,nativeSiteIcon,nativeMore,nativeExternal,nativeGlobe,nativeActionsClass}=nativeSites.templates(page));
}
function closeMenu() { const previous = menu?.trigger; previous?.setAttribute("aria-expanded", "false"); previous?.setAttribute("data-state", "closed"); menu?.node.remove(); menu = null; previous?.focus({ preventScroll: true }); }
function showMenu(trigger, site) {
  closeMenu();
  const m = element("div", MENU_CLASSES.menu); config.ui.surface(m, "dropdown"); m.setAttribute(owned, "menu"); m.setAttribute("role", "menu"); m.tabIndex = -1;
  function menuItem(label, glyph) {
    const item = element("button", MENU_CLASSES.item); item.type = "button"; item.setAttribute("role", "menuitem"); item.tabIndex = -1;
    const row = element("div", MENU_CLASSES.row), leading = element("span", MENU_CLASSES.leading), svg = icon(glyph); svg.setAttribute("aria-hidden", "true");
    leading.append(svg); row.append(leading, element("span", "flex-1 min-w-0 truncate", label)); item.append(row); return item;
  }
  const edit = menuItem(text("Edit", "编辑"), "edit"); edit.onclick = () => { closeMenu(); showEditor(site); };
  const remove = menuItem(text("Remove", "移除"), "remove");
  remove.onclick = async () => { closeMenu(); try { await host({ operation: "remove", id: site.id }); await refresh(); } catch (e) { notice(e.message); } };
  if (site.origin.kind === "external") m.append(edit); m.append(remove); document.body.append(m); const r = trigger.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + "px";
  m.style.top = Math.max(8, Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8)) + "px";
  menu = { node: m, trigger }; trigger.setAttribute("aria-expanded", "true"); trigger.setAttribute("data-state", "open"); m.focus();
  m.addEventListener("keydown", e => { if (["ArrowUp", "ArrowDown"].includes(e.key)) { e.preventDefault(); const items = [...m.children]; const current = items.indexOf(document.activeElement); items[current < 0 ? (e.key === "ArrowUp" ? items.length - 1 : 0) : (current + (e.key === "ArrowUp" ? -1 : 1) + items.length) % items.length].focus(); } });
}
function siteSecondary(site) {
  const projectId = site.projectId || site.origin?.projectId;
  const project = site.projectName || state.projects.find(p => p.id === projectId)?.name;
  if (project) {
    const port = site.status === "running" && site.url ? new URL(site.url).port : "";
    return port ? `${project}（${port}）` : project;
  }
  return site.url ? new URL(site.url).host : text("Not started", "未启动");
}
async function startProjectSite(id) {
  notice(text("Starting website…", "正在启动网站…"));
  for (let attempt = 0; attempt < 40 && !disposed; attempt++) {
    const result = await host({ operation: "start", id }); if (!result.pending) return result.url;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(text("Website startup timed out.", "网站启动超时。"));
}
const previewRequests = new Map();
function loadPreview(container, url, cachedOnly = false) {
  container.classList.remove("mcx-site-placeholder"); container.setAttribute("aria-busy", "true");
  const skeleton = element("div", "mcx-site-skeleton"); skeleton.setAttribute("aria-hidden", "true"); container.replaceChildren(skeleton);
  const placeholder = () => { container.classList.add("mcx-site-placeholder"); container.removeAttribute("aria-busy"); container.replaceChildren(); if (nativeSiteIcon) container.append(nativeSiteIcon.cloneNode(true)); };
  const key = cachedOnly ? `cached:${url}` : url;
  let request = previewRequests.get(key);
  if (!request) {
    request = (async () => {
      for (let attempt = 0; attempt < 60 && !disposed; attempt++) {
        const result = await host({ operation: "preview", url, cachedOnly });
        if (!result.pending) return result;
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      return { image: null };
    })().catch(() => ({ image: null })); previewRequests.set(key, request);
    request.then(result => { if (!result.image) previewRequests.delete(key); });
  }
  request.then(({ image }) => {
    if (disposed || !container.isConnected) return;
    if (!image) { placeholder(); return; }
    const img = element("img"); img.alt = ""; img.className = "mcx-site-thumbnail";
    img.onload = () => { if (!disposed && container.isConnected) { container.removeAttribute("aria-busy"); container.replaceChildren(img); } };
    img.onerror = placeholder; img.src = image;
  });
}
function row(site, grid) {
  const r = element("div", grid ? "group/site-card relative grid h-[210px] min-w-0 grid-rows-[148px_62px] overflow-hidden rounded-2xl border border-subtle bg-surface-card shadow-sm" : "group/site-row relative col-span-full grid min-h-[82px] grid-cols-subgrid items-center overflow-hidden rounded-xl px-4 py-4 select-none hover:bg-primary-ghost-hover");
  r.setAttribute(owned, "entry"); r.dataset.siteId = site.id;
  const open = element("button", "absolute inset-0 cursor-interaction rounded-xl bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset");
  open.type = "button"; open.setAttribute("aria-label", text("Open ", "打开 ") + site.title); open.onclick = () => openSite(site); r.append(open);
  const preview = element("div", "mcx-site-preview " + (grid ? "pointer-events-none" : "relative h-[50px] w-20 shrink-0 overflow-hidden rounded-[6px]"));
  if (nativeSiteIcon) preview.append(nativeSiteIcon.cloneNode(true));
  if (site.url) loadPreview(preview, site.url, site.status === "stopped"); else preview.classList.add("mcx-site-placeholder");
  const info = element("div", grid ? "pointer-events-none relative z-10 flex min-w-0 items-center gap-3 px-4" : "pointer-events-none relative z-10 flex min-w-0 items-center gap-4");
  const names = element("div", "min-w-0 flex-1"); names.append(element("div", "mcx-site-name", site.title), element("div", "mcx-site-meta", siteSecondary(site)));
  if (!grid) info.append(preview); info.append(names);
  const more = button(text("Site options", "站点选项"), () => showMenu(more, site));
  more.classList.add("mcx-site-menu", "justify-self-end"); more.dataset.variant = "ghost"; more.dataset.uniform = ""; more.style.pointerEvents = "auto"; more.setAttribute("aria-label", text("Options for ", "站点选项：") + site.title); more.setAttribute("aria-haspopup", "menu");
  more.firstElementChild.replaceChildren(); if (nativeMore) more.firstElementChild.append(nativeMore.cloneNode(true)); else more.firstElementChild.textContent = "⋯";
  const actions = element("div", nativeActionsClass || "relative z-10 flex items-center gap-2 justify-end ps-4");
  if (grid) actions.className = "pointer-events-auto relative z-10 flex items-center gap-2";
  {
    const external = nativeExternal ? nativeExternal.cloneNode(true) : button("", () => {});
    if (!nativeExternal) { external.dataset.variant = "ghost"; external.dataset.uniform = ""; external.dataset.iconSize = "sm"; external.firstElementChild.replaceChildren(icon("external")); } external.setAttribute("aria-label", text("Open in default browser: ", "在默认浏览器打开：") + site.title);
    external.onclick = async e => {
      e.stopPropagation();
      try {
        if (!window.electronBridge?.sendMessageFromView) throw new Error(text("Native browser opening is unavailable.", "原生浏览器打开通道暂不可用。"));
        const resolved = await host({ operation: "resolve", id: site.id });
        if (resolved.missing) throw new Error(text("The original project is unavailable.", "原项目已不可用。"));
        const url = resolved.site.entryId && resolved.site.status !== "running" ? await startProjectSite(site.id) : resolved.site.url;
        await window.electronBridge.sendMessageFromView({ type: "open-in-browser", url, initiator: "sites_library", openTarget: "external-browser", disposition: "new-tab", source: "manual" });
      } catch (error) { notice(error.message); }
    };
    actions.append(external);
  }
  actions.append(more);
  if (grid) { info.append(actions); r.append(preview, info); }
  else {
    const sharing = element("div", "mcx-site-sharing pointer-events-none relative z-10 flex min-w-0 items-center gap-1.5 ps-4 text-sm leading-5 text-default [@container_(max-width:520px)]:sr-only");
    const glyph = site.hosting === "local" ? icon("monitor") : (nativeGlobe?.cloneNode(true) || icon("globe"));
    if (glyph) { glyph.setAttribute("aria-hidden", "true"); sharing.append(glyph); }
    sharing.append(element("span", "truncate", site.hosting === "local" ? text("Local address", "本机地址") : text("External site", "外部站点")));
    r.append(info, sharing, actions);
  }
  return r;
}
function updateBrowserMenu() {
  const context = nativeSites.browserMenu();
  if (!context || context.menu.querySelector(`[${owned}=browser-add]`)) return;
  const item = context.downloads.cloneNode(true);
  item.setAttribute(owned, "browser-add"); item.removeAttribute("id"); item.removeAttribute("data-radix-collection-item");
  item.removeAttribute("data-highlighted"); item.tabIndex = -1;
  item.querySelector('[data-menu-row-content]')?.replaceChildren(document.createTextNode(text("Add to Sites", "添加到站点")));
  item.onclick = async event => {
    event.preventDefault(); event.stopPropagation();
    // 点击时重新读取菜单所属标签，避免使用菜单打开前的网址。
    const current = nativeSites.browserMenu();
    if (!current || current.menu !== context.menu) return;
    current.close();
    try {
      const prepared = await host({ operation: "prepare-browser-site", ...current.page });
      if (!disposed) showBrowserAdd(prepared);
    } catch (error) { notice(error.message); }
  };
  item.onpointermove = () => item.focus({ preventScroll: true });
  context.downloads.after(item);
}
function browserMenuKey(event) {
  const root = event.target.closest?.('[role="menu"]');
  const item = root?.querySelector(`[${owned}=browser-add]`);
  if (!item) return;
  const previous = item.previousElementSibling, next = item.nextElementSibling;
  let target;
  // 注入项不属于 Radix collection，只接管与它相邻的键盘移动。
  if (event.key === "ArrowDown" && event.target === previous || event.key === "ArrowUp" && event.target === next) target = item;
  else if (event.target === item) {
    if (event.key === "ArrowUp") target = previous;
    else if (event.key === "ArrowDown") target = next;
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopImmediatePropagation(); item.click(); return; }
  }
  if (target) { event.preventDefault(); event.stopImmediatePropagation(); target.focus(); }
}
function showBrowserAdd({ site, project, preferProject }) {
  const d = newDialog(text("Add to Sites", "添加到站点"));
  let useProject = preferProject;
  const modes = element("div", "mcx-site-modes"); modes.setAttribute("role", "tablist");
  modes.setAttribute("aria-label", text("Site type", "站点类型"));
  const caption = element("p");
  const tabs = [text("Project", "项目"), text("Custom", "自定义")].map((label, index) => {
    const tab = element("button", "mcx-site-mode", label); tab.type = "button"; tab.setAttribute("role", "tab");
    tab.disabled = index === 0 && !project;
    tab.onclick = () => { useProject = index === 0; update(); };
    modes.append(tab); return tab;
  });
  function update() {
    tabs.forEach((tab, index) => tab.setAttribute("aria-selected", String(useProject === (index === 0))));
    caption.textContent = useProject ? project.name : text("Saved as a custom URL", "保存为自定义网址");
  }
  modes.onkeydown = event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === "Home" ? (project ? 0 : 1) : event.key === "End" ? 1 : useProject || !project ? 1 : 0;
    tabs[index].click(); tabs[index].focus();
  };
  d.append(modes, caption); update();
  mountEditor(d, d, site, null, { getOrigin: () => useProject ? { kind: "project", projectId: project.id } : { kind: "external" } });
}
function reconcile() {
  if (disposed) return;
  if (currentAccount && nativeSites.accountKey() !== currentAccount) { closeMenu();dialog?.close(); }
  updateBrowserMenu();
  const page = nativeSites.pageInfo();
  if (!page) { restoreOwnership();addButton?.remove(); addButton = null; rowsRoot?.remove(); rowsRoot = null; fallback?.remove(); fallback = null; rowSignature = ""; currentPage = null; closeMenu(); document.querySelectorAll("[data-mcx-sites-empty-suppressed]").forEach(e => e.removeAttribute("data-mcx-sites-empty-suppressed")); return; }
  cacheNative(page);
  if (currentPage !== page.page || currentAccount !== page.accountKey) {
    restoreOwnership();
    if (currentAccount && currentAccount !== page.accountKey) { closeMenu(); dialog?.close(); }
    addButton?.remove(); addButton=null; rowsRoot?.remove(); rowsRoot=null; fallback?.remove(); fallback=null;
    currentPage = page.page; currentAccount=page.accountKey; rowSignature = "";
    if (Date.now() - refreshAt > 1500) refresh().catch(e => notice(e.message));
  }
  if (page.plus && (!ownership || ownership.tabs !== page.ownershipTabs || !ownership.node.isConnected)) {
    const added=ownership?.selection()==="added";
    restoreOwnership();ownership=nativeSites.mountOwnership(page,()=>{restoreNativeContent();rowSignature="";schedule();});
    if (added) ownership.selectAdded();
  }
  ownership?.sync();
  const added=ownership?.selection()==="added";
  if (added) {
    for (const child of page.content.children) if (!child.hasAttribute(owned)) {
      if (!nativeHidden.has(child)) nativeHidden.set(child,child.hidden);
      child.hidden=true;
    }
  } else restoreNativeContent();
  if (!addButton?.isConnected && page.create) {
    addButton = button(text("Add site", "添加站点"), () => showDiscovery()); addButton.setAttribute(owned, "add");
    if (nativePlus) addButton.firstElementChild.prepend(nativePlus.cloneNode(true));
    page.create.before(addButton);
  }
  const query = page.input.value.trim().toLowerCase();
  const sites = ownership && !added || !ownership && page.shared ? [] : state.sites.filter(s => [s.title, s.url || "", state.projects.find(p => p.id === s.origin.projectId)?.name || ""].some(v => v.toLowerCase().includes(query)));
  const list=added?null:page.list;
  const signature = JSON.stringify([revision, query, page.shared, page.grid,added]);
  if (signature === rowSignature && rowsRoot?.isConnected && (list ? rowsRoot.parentElement === list : fallback?.isConnected)) return;
  rowsRoot?.remove(); fallback?.remove(); fallback = null;
  document.querySelectorAll("[data-mcx-sites-empty-suppressed]").forEach(e => e.removeAttribute("data-mcx-sites-empty-suppressed"));
  rowsRoot = element("div"); rowsRoot.setAttribute(owned, "rows"); rowSignature = signature;
  if (!sites.length && !added) { rowsRoot = null; return; }
  if (page.empty && !added) page.empty.setAttribute("data-mcx-sites-empty-suppressed", "");
  if (list) list.append(rowsRoot);
  else {
    fallback = element("div", "@container pb-3"); fallback.setAttribute(owned, "fallback");
    const layout = element("div"); layout.setAttribute(owned, page.grid ? "grid" : "table"); fallback.append(layout); layout.append(rowsRoot);
    page.content.append(fallback);
  }
  rowsRoot.append(...sites.map(s => row(s, page.grid)));
  if (!sites.length) rowsRoot.append(element("p","text-sm text-secondary",text("No added sites found.","没有找到你添加的站点。")));
}
function schedule() { clearTimeout(timer); timer = setTimeout(reconcile, 60); }
function newDialog(title, back) {
  dialog?.close(); dialog?.remove(); closeMenu();
  const previous = document.activeElement; const d = element("dialog"); d.setAttribute(owned, "dialog"); d.setAttribute("aria-labelledby", "mcx-sites-dialog-title");
  const heading = config.ui.heading(d, { title, closeLabel:text("Close", "关闭"), onClose:()=>d.close(),
    back:back ? iconButton(text("Back", "返回"), "back", back) : null });
  heading.querySelector("h2").id = "mcx-sites-dialog-title";
  document.body.append(d); dialog = d;
  d.addEventListener("close", () => { d.remove(); if (dialog === d) dialog = null; previous?.focus({ preventScroll: true }); });
  d.addEventListener("click", e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } });
  d.showModal(); return d;
}
async function showDiscovery() {
  const d = newDialog(text("Add site", "添加站点"));
  const tabs = element("div", "mcx-site-modes"); tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", text("Add site method", "添加方式"));
  const modes = [
    { id: "projects", label: text("Project", "项目") },
    { id: "url", label: text("Custom", "自定义") }
  ].map(mode => {
    const tab = element("button", "mcx-site-mode", mode.label), panel = element("div"); tab.type = "button";
    tab.id = `mcx-site-tab-${mode.id}`; panel.id = `mcx-site-panel-${mode.id}`;
    tab.setAttribute("role", "tab"); tab.setAttribute("aria-controls", panel.id);
    panel.setAttribute("role", "tabpanel"); panel.setAttribute("aria-labelledby", tab.id);
    tabs.append(tab); return { tab, panel };
  });
  d.append(tabs, ...modes.map(mode => mode.panel));
  function select(index) {
    d.dispatchEvent(new Event("mcx-sites-mode-change"));
    modes.forEach(({ tab, panel }, i) => { const active = i === index; tab.setAttribute("aria-selected", String(active)); tab.tabIndex = active ? 0 : -1; panel.hidden = !active; });
  }
  modes.forEach(({ tab }, index) => {
    tab.onclick = () => select(index);
    tab.onkeydown = e => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? modes.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + modes.length) % modes.length;
      select(next); modes[next].tab.focus();
    };
  });
  select(0); mountEditor(d, modes[1].panel);
  await mountDiscovery(d, modes[0].panel);
}
async function mountDiscovery(d, panel) {
  const content = element("div", "mcx-site-content"); panel.append(content);
  const results = element("div", "mcx-site-results"); results.setAttribute("aria-live", "polite"); content.append(results);
  const error = element("div"); error.setAttribute("role", "alert"); content.append(error);
  let candidates = [], loaded = false, saving = false;
  const selected = new Set(), completed = new Set();
  const footer = config.ui.footer(element("div", "mcx-site-footer"));
  const cancel = dialogButton(text("Cancel", "取消"), () => d.close(), false, "ghost");
  const add = dialogButton(text("Add", "添加"), async () => {
    if (saving || !selected.size) return;
    saving = true; error.textContent = ""; render();
    try {
      // 逐项保存，失败时保留尚未完成的选择，避免重复提交成功项。
      for (const candidate of [...selected]) {
        await host({ operation: "save", site: { ...candidate, origin: { kind: "project", projectId: candidate.projectId } } });
        completed.add(candidate); selected.delete(candidate);
      }
      await refresh(); d.close();
    } catch (e) { error.textContent = e.message; }
    finally { saving = false; if (d.isConnected) render(); }
  }, true);
  footer.append(cancel, add); panel.append(footer);
  function updateActions() { setButtonDisabled(add, saving || !selected.size); setButtonDisabled(cancel, saving); }
  function render() {
    updateActions(); results.replaceChildren();
    results.setAttribute("aria-busy", String(!loaded));
    if (!loaded) {
      results.append(element("span", "sr-only", text("Looking for websites…", "正在查找网页…")));
      ["64%", "48%", "58%"].forEach(width => {
        const row = element("div", "mcx-site-scan-row"); row.setAttribute("aria-hidden", "true");
        const art = element("div", "mcx-site-candidate-art"); art.append(element("div", "mcx-site-skeleton"));
        const copy = element("div", "mcx-site-scan-copy"), title = element("div", "mcx-site-skeleton"); title.style.width = width;
        copy.append(title, element("div", "mcx-site-skeleton")); row.append(art, copy); results.append(row);
      });
      return;
    }
    const available = candidates.filter(candidate => !completed.has(candidate) && !state.sites.some(s =>
      (candidate.entryId && s.entryId === candidate.entryId || candidate.url && s.url === candidate.url)));
    if (!available.length) results.append(element("div", "mcx-site-empty", text("No new project websites found", "暂无可添加的项目网页")));
    for (const candidate of available) {
      const item = element("label", "mcx-site-candidate");
      const art = element("span", "mcx-site-candidate-art"); if (nativeSiteIcon) art.append(nativeSiteIcon.cloneNode(true));
      const info = element("div", "mcx-site-candidate-info"); info.append(element("div", "", candidate.title), element("div", "mcx-site-url", siteSecondary(candidate)));
      const checkbox = element("input", "mcx-site-checkbox"); checkbox.type = "checkbox";
      checkbox.checked = selected.has(candidate); checkbox.disabled = saving;
      checkbox.setAttribute("aria-label", candidate.title);
      checkbox.onchange = () => { if (checkbox.checked) selected.add(candidate); else selected.delete(candidate); updateActions(); };
      item.append(art, info, checkbox); if (candidate.url) loadPreview(art, candidate.url, candidate.status !== "running"); else art.classList.add("mcx-site-placeholder");
      results.append(item);
    }
  }
  async function load() {
    loaded = false; render(); error.textContent = "";
    try { await refresh(); const data = await host({ operation: "discover" }); if (!d.isConnected) return; candidates = data.candidates; }
    catch { error.textContent = text("Couldn't find services. Reopen this dialog to try again.", "暂时无法发现服务，请重新打开弹窗重试。"); }
    finally { loaded = true; if (d.isConnected) render(); }
  }
  await load();
}
function showEditor(site, problem) {
  const d = newDialog(text("Edit site", "编辑站点"));
  mountEditor(d, d, site, problem).focus();
}
function mountEditor(d, container, site, problem, options = {}) {
  const form = element("form"), content = element("div", "mcx-site-content"); form.append(content); container.append(form);
  function field(label, key, value, type) { const l = element("label", "", label), i = element("input"); i.id = `mcx-site-${key}`; l.htmlFor = i.id; i.name = key; i.value = value || ""; i.type = type || "text"; content.append(l, i); return i; }
  const url = field(text("URL", "网址"), "url", site?.url, "url"); url.required = true; url.placeholder = "http://localhost:3000";
  const title = field(text("Name", "名称"), "title", site?.title); title.maxLength = 160; title.required = true;
  let origin = site?.origin || { kind: "external" };
  const error = element("div", "", problem); error.setAttribute("role", "alert"); content.append(error);
  const footer = config.ui.footer(element("div", "mcx-site-footer")); const cancel = dialogButton(text("Cancel", "取消"), () => d.close(), false, "ghost"); const save = dialogButton(site?.id ? text("Save", "保存") : text("Add", "添加"), () => {}, true); save.type = "submit"; footer.append(cancel, save); form.append(footer);
  let submitting = false;
  function validFields() {
    if (!title.value.trim() || title.value.trim().length > 160 || !url.value.trim() || !url.validity.valid) return false;
    try { const parsed = new URL(url.value.trim()); return ["http:", "https:"].includes(parsed.protocol) && !!parsed.hostname && !parsed.username && !parsed.password; }
    catch { return false; }
  }
  function updateSave() { setButtonDisabled(save, submitting || !validFields()); }
  form.addEventListener("input", updateSave); form.addEventListener("change", updateSave); updateSave();
  form.onsubmit = async e => {
    e.preventDefault(); if (submitting || !validFields()) { updateSave(); return; }
    submitting = true; updateSave(); error.textContent = "";
    try { await host({ operation: "save", id: site?.id, site: { title: title.value.trim(), url: url.value.trim(), origin: options.getOrigin?.() || origin } }); await refresh(); d.close(); }
    catch (e) { error.textContent = e.message; }
    finally { submitting = false; updateSave(); }
  };
  return url;
}
async function until(check, milliseconds = 7000) {
  const end = Date.now() + milliseconds;
  while (!disposed && Date.now() < end) { const value = check(); if (value) return value; await new Promise(r => setTimeout(r, 80)); }
  throw new Error(text("The native view did not become ready. Please try again.", "原生视图未就绪，请重试。"));
}


async function applyWebLayout(token) {
  try {
    await until(() => pendingLayout !== token || (!nativeSites.isSitesPath() && (nativeSites.fullViewControl(true) || nativeSites.fullViewControl(false))));
    if (pendingLayout !== token) return;
    const hide = [...document.querySelectorAll("button")].find(e => visible(e) && /^(Hide sidebar|隐藏侧栏|隐藏侧边栏|隱藏側邊欄|收起侧栏)$/.test(e.getAttribute("aria-label") || "")); hide?.click();
    // 使用原生完整视图入口，保留原生网页标签和底部聊天输入框。
    nativeSites.fullViewControl(true)?.click();
  } catch (e) { if (pendingLayout === token && !disposed) notice(e.message); }
  finally { if (pendingLayout === token) pendingLayout = null; }
}
async function openSite(site) {
  if (opening) return; opening = true;
  try {
    const resolved = await host({ operation: "resolve", id: site.id });
    if (!resolved.missing && resolved.site.entryId && resolved.site.status !== "running") {
      resolved.site.url = await startProjectSite(site.id); resolved.site.status = "running"; await refresh();
    }
    if (resolved.missing) { await refresh(); notice(text("The original project or chat is unavailable. Remove this entry and add it again from an available project.", "原项目或聊天已不可用，请移除此条目后从可用项目重新添加。")); return; }
    await nativeSites.open(resolved.site.origin, resolved.site.url, resolved.cwd);
    const token = {}; pendingLayout = token; await applyWebLayout(token);
  } catch (e) { notice(e.message); }
  finally { opening = false; }
}
function onClick(e) {
  if (menu && !menu.node.contains(e.target) && !menu.trigger.contains(e.target)) closeMenu();
  if (e.target.closest(`[${owned}]`)) return;
  const row = e.target.closest("[data-appgen-row], [data-testid=sites-grid] > article");
  if (!row || !nativeSites.pageInfo()) return;
  const b = e.target.closest("button");
  // 只跟随官方打开动作；分享、菜单和 Create 不触发布局变化。
  if (b && !b.hasAttribute("aria-haspopup") && /^(Edit |Open |编辑|打开)/.test(b.getAttribute("aria-label") || "")) {
    const token = {}; pendingLayout = token; void applyWebLayout(token);
  }
}
function onKey(e) { browserMenuKey(e); if (e.defaultPrevented) return; if (e.key === "Escape" && menu) { e.preventDefault(); closeMenu(); } else if (e.key === "Tab" && menu) closeMenu(); }
function onPointer(e) { if (e.target.closest('[role="separator"]')) pendingLayout = null; }
const observer = new MutationObserver(records => { if (records.some(r => !r.target.closest?.(`[${owned}]`))) schedule(); });
observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
document.addEventListener("input", schedule); document.addEventListener("click", onClick, true); document.addEventListener("keydown", onKey, true); document.addEventListener("pointerdown", onPointer, true);
refresh().catch(e => notice(e.message)); schedule();
config.registerSelfCheck?.(() => {
  const scope=nativeSites.applicability();
  if (scope !== "applicable") return {state:scope,reason:scope === "unknown" ? "account-or-navigation-unavailable" : "outside-sites-page"};
  const page=nativeSites.pageInfo(),available=Boolean(page?.create && addButton?.isConnected);
  return {state:available ? "available" : "unavailable",reason:available ? null : "sites-anchor-unavailable",
    checks:[{name:"sites-page",available:Boolean(page)},{name:"sites-create-anchor",available}],scopes:[{name:"sites-page",element:page?.page},{name:"sites-dialog",element:dialog},{name:"sites-menu",element:menu}]};
});
return () => {
  disposed = true; pendingLayout = null; clearTimeout(timer); observer.disconnect();
  document.removeEventListener("input", schedule); document.removeEventListener("click", onClick, true); document.removeEventListener("keydown", onKey, true); document.removeEventListener("pointerdown", onPointer, true);
  closeMenu(); dialog?.close(); document.querySelectorAll(`[${owned}]`).forEach(e => e.remove());
  restoreOwnership();
  document.querySelectorAll("[data-mcx-sites-empty-suppressed]").forEach(e => e.removeAttribute("data-mcx-sites-empty-suppressed"));
};
