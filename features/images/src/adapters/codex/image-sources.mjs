export function createImageSourcesAdapter(codex, signal, invalidate) {
  const account = codex.account(signal, invalidate);
  const visible = node => node?.isConnected && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0;
  const isImageNavigation = (props, plus) => props?.variant === "browse"
    && (plus ? ["images", "all", "folders"] : ["generated", "uploaded"]).every(key => props.tabs?.some(item => item.key === key));

  function applicability() {
    const props=codex.props(codex.rail(),value=>Boolean((value.router ?? value.value?.router)?.state?.location));
    const location=(props?.router ?? props?.value?.router)?.state?.location;
    const current = account.read();
    if (!location || current.status !== "available") return "unknown";
    return (current.planType === "plus" ? location.pathname === "/library"
      : location.pathname === "/space/files" && new URLSearchParams(location.search).get("tab") === "images")
      ? "applicable" : "not-applicable";
  }
  return {applicability,read() {
    if (applicability() !== "applicable") return null;
    const current = account.read(), plus = current.planType === "plus";
    const tabs = [...document.querySelectorAll('[role="tablist"]')].find(node =>
      (visible(node) || node.hidden && visible(node.parentElement?.querySelector('[data-minecodex-image-navigation]')))
      && !node.closest("[data-minecodex-image-navigation]")
      && codex.props(node, props => isImageNavigation(props, plus)));
    if (!tabs) return null;
    // 26.1007 把来源工具栏包进独立 inset；图库仍是同级的 flex 内容区。
    let navigation = plus ? tabs.parentElement : tabs.parentElement?.parentElement;
    while (navigation && !navigation.nextElementSibling) navigation = navigation.parentElement;
    const content = navigation?.nextElementSibling;
    const shell = navigation?.parentElement;
    if (!content || !shell || !(visible(content) || content.hidden
      && content.nextElementSibling?.id === "minecodex-image-gen-content" && visible(content.nextElementSibling))) return null;
    const props = codex.props(tabs, props => isImageNavigation(props, plus));
    const search = shell.querySelector('input[type="search"],input[placeholder="Search"],input[placeholder="Search library"],input[placeholder="搜索资料库"],input[placeholder="搜索库"],input[placeholder="搜尋資料庫"]');
    return {tabs, navigation, content, shell, search, selectedKey:props.selectedKey, accountKey:current.key, mode:plus ? "library" : "space"};
  }};
}
