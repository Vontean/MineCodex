export function createImageSourcesAdapter(codex) {
  const isImageNavigation = props => props?.variant === "browse"
    && props.tabs?.some(item => item.key === "generated")
    && props.tabs?.some(item => item.key === "uploaded");

  function applicability() {
    const props=codex.props(codex.rail(),value=>Boolean((value.router ?? value.value?.router)?.state?.location));
    const location=(props?.router ?? props?.value?.router)?.state?.location;
    if (!location) return "unknown";
    return location.pathname === "/space/files" && new URLSearchParams(location.search).get("tab") === "images"
      ? "applicable" : "not-applicable";
  }
  return {applicability,read() {
    const tabs = [...document.querySelectorAll('[role="tablist"]')].find(node =>
      !node.closest("[data-minecodex-image-navigation]")
      && codex.props(node, isImageNavigation));
    if (!tabs) return null;
    // 26.1007 把来源工具栏包进独立 inset；图库仍是同级的 flex 内容区。
    let navigation = tabs.parentElement?.parentElement;
    while (navigation && !navigation.nextElementSibling) navigation = navigation.parentElement;
    const content = navigation?.nextElementSibling;
    const shell = navigation?.parentElement;
    if (!content || !shell) return null;
    const props = codex.props(tabs, isImageNavigation);
    const search = shell.querySelector('input[type="search"],input[placeholder="Search"]');
    return {tabs, navigation, content, shell, search, selectedKey:props.selectedKey};
  }};
}
