export function createImageSourcesAdapter(codex) {
  const isImageNavigation = props => props?.variant === "browse"
    && props.tabs?.some(item => item.key === "generated")
    && props.tabs?.some(item => item.key === "uploaded");

  return {read() {
    const tabs = [...document.querySelectorAll('[role="tablist"]')].find(node =>
      !node.closest("[data-minecodex-image-navigation]")
      && codex.props(node, isImageNavigation));
    if (!tabs) return null;
    const navigation = tabs.parentElement?.parentElement;
    const content = navigation?.nextElementSibling;
    const shell = navigation?.parentElement;
    if (!content || !shell) return null;
    const props = codex.props(tabs, isImageNavigation);
    const search = shell.querySelector('input[type="search"],input[placeholder="Search"]');
    return {tabs, navigation, content, shell, search, selectedKey:props.selectedKey};
  }};
}
