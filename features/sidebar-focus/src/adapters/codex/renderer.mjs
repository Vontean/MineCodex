export function createFocusAdapter(codex) {
  const sectionSelector="[data-app-action-sidebar-section]", projectSelector="[data-app-action-sidebar-project-row]";
const props = (element,predicate) => codex.props(element,predicate,30) ?? {};
const visible = element => element.checkVisibility({visibilityProperty:true});
function activity() {
  return [...document.querySelectorAll('#app-shell-sidebar button[aria-pressed]')]
    .find(element => visible(element) && /activity|活动|动态/i.test(element.getAttribute("aria-label") || ""));
}
function branches() {
  return [...document.querySelectorAll("#app-shell-sidebar " + sectionSelector)].filter(visible).map(element => {
    const native = props(element, p => !!p.sectionKey);
    const data = props(element, p => Array.isArray(p.section?.threadKeys)).section;
    return { element, key:"section:" + native.sectionKey, data, expanded:element.dataset.appActionSidebarSectionCollapsed === "false",
      toggle:() => native.onCollapsedChange?.(element.dataset.appActionSidebarSectionCollapsed === "false") };
  }).concat([...document.querySelectorAll("#app-shell-sidebar " + projectSelector)].filter(visible).map(element => ({
    element, key:"project:" + element.dataset.appActionSidebarProjectId,
    data:props(element, p => !!p.group?.projectId).group,
    expanded:element.getAttribute("aria-expanded") === "true",
    toggle:() => element.click(),
  })));
}
function target(items) {
  // 两种模式的侧栏同时挂载，只在当前分支中读取原生选中身份。
  const selected = items.map(b => b.element.querySelector?.('[data-app-action-sidebar-thread-selected="true"], [data-sidebar-chatgpt-conversation-key]:has([aria-current="page"])')).find(Boolean);
  const id = codex.currentThreadId();
  const key = selected?.dataset.appActionSidebarThreadId || selected?.dataset.sidebarChatgptConversationKey || (id ? "local:" + id : null);
  const activeProject = items.map(b => props(b.element, p => p.activeProjectId != null).activeProjectId).find(Boolean);
  const project = items.find(b => b.key.startsWith("project:") && (b.data?.threadKeys?.includes(key) || b.data?.projectId === activeProject));
  const section = items.find(b => b.key.startsWith("section:") && (b.data?.threadKeys?.includes(key) || (activeProject && b.data?.itemKeys?.includes("codex:project:" + activeProject))))
    || items.find(b => b.key.startsWith("section:") && (selected && b.element.contains(selected) || project && b.element.contains(project.element)));
  return section ? { section, project } : null;
}
  return {activity,mode:element=>props(element,p=>p.sidebarMode != null).sidebarMode,branches,target,isBranchToggle:element=>!!element.closest("[data-app-action-sidebar-section-toggle], " + projectSelector)};
}
