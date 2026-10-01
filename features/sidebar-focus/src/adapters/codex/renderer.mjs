export function createFocusAdapter(codex) {
  const sectionSelector="[data-app-action-sidebar-section]", projectSelector="[data-app-action-sidebar-project-row]";
const props = (element,predicate) => codex.props(element,predicate,30) ?? {};
function branches() {
  return [...document.querySelectorAll("#app-shell-sidebar " + sectionSelector)].map(element => {
    const native = props(element, p => !!p.sectionKey);
    const data = props(element, p => Array.isArray(p.section?.threadKeys)).section;
    return { element, key:"section:" + native.sectionKey, data, expanded:element.dataset.appActionSidebarSectionCollapsed === "false",
      toggle:() => native.onCollapsedChange?.(element.dataset.appActionSidebarSectionCollapsed === "false") };
  }).concat([...document.querySelectorAll("#app-shell-sidebar " + projectSelector)].map(element => ({
    element, key:"project:" + element.dataset.appActionSidebarProjectId,
    data:props(element, p => !!p.group?.projectId).group,
    expanded:element.getAttribute("aria-expanded") === "true",
    toggle:() => element.click(),
  })));
}
function target(items) {
  const selected = document.querySelector('#app-shell-sidebar [data-app-action-sidebar-thread-selected="true"]');
  const id = codex.currentThreadId();
  const key = selected?.dataset.appActionSidebarThreadId || (id ? "local:" + id : null);
  const activeProject = items.map(b => props(b.element, p => p.activeProjectId != null).activeProjectId).find(Boolean);
  const project = items.find(b => b.key.startsWith("project:") && (b.data?.threadKeys?.includes(key) || b.data?.projectId === activeProject));
  const section = items.find(b => b.key.startsWith("section:") && (b.data?.threadKeys?.includes(key) || (activeProject && b.data?.itemKeys?.includes("codex:project:" + activeProject))))
    || items.find(b => b.key.startsWith("section:") && (selected && b.element.contains(selected) || project && b.element.contains(project.element)));
  return section ? { section, project } : null;
}
  return {branches,target};
}
