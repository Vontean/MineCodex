// 将外部 token 名称解析为 MineCodex 变量；主题变化与卸载由此维护。
export function createNativeThemeAdapter(themeTokenNames,themeTokenAliases,themeBindings) {
  const previousThemeBindings=new Map();
    function read() {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      const tokens = Object.fromEntries(
        themeTokenNames
          .map((name) => [name, style.getPropertyValue(name).trim()])
          .filter(([, value]) => value),
      );
      // 按语义和命名空间解析，不依赖构建哈希或猜测近似名称。
      for (const name of themeTokenNames) {
        if (tokens[name]) continue;
        const semanticNames = [name, ...(themeTokenAliases[name] ?? [])];
        const candidates = semanticNames.flatMap((candidate) => candidate.startsWith("--color-")
          ? [candidate, candidate.replace("--color-", "--app-color-")]
          : [candidate]);
        const value = candidates.map((candidate) => style.getPropertyValue(candidate).trim()).find(Boolean);
        if (value) tokens[name] = value;
      }
      for (const [nativeName,internalName] of Object.entries(themeBindings)) {
        if (!previousThemeBindings.has(internalName)) previousThemeBindings.set(internalName,root.style.getPropertyValue(internalName));
        if (tokens[nativeName]) {tokens[internalName]=tokens[nativeName];if(root.style.getPropertyValue(internalName)!==tokens[nativeName]) root.style.setProperty(internalName,tokens[nativeName]);}
        else if(root.style.getPropertyValue(internalName)) root.style.removeProperty(internalName);
      }
      const mode = root.dataset.theme === "dark" || root.classList.contains("electron-dark") || style.colorScheme === "dark"
        ? "dark"
        : "light";
      return { root, style, tokens, mode };
    }

  function dispose() {for (const [name,value] of previousThemeBindings) { if(value) document.documentElement.style.setProperty(name,value); else document.documentElement.style.removeProperty(name); } }
  function checkTokens(element, names) {
    const style = getComputedStyle(element);
    return names.map(name => {
      const candidates = [name,...(themeTokenAliases[name] ?? [])].flatMap(candidate => candidate.startsWith("--color-")
        ? [candidate,candidate.replace("--color-","--app-color-")] : [candidate]);
      const source = candidates.find(candidate => style.getPropertyValue(candidate).trim());
      const value = source ? style.getPropertyValue(source).trim() : null;
      const projectName = themeBindings[name];
      const projectValue = projectName ? style.getPropertyValue(projectName).trim() || null : null;
      return {name,source:source ?? null,value,available:Boolean(value),
        projectName:projectName ?? null,projectValue,scopeMatches:!projectName || projectValue === value,
        reason:!value ? "native-token-unavailable" : projectName && !projectValue ? "project-token-unavailable"
          : projectName && projectValue !== value ? "scope-mapping-mismatch" : null};
    });
  }
  // 局部组件的映射保留原生变量引用，随作用域和主题变化，不复制根节点的快照值。
  function bindScope(element, names) {
    const bindings = names.map(name => {
      const projectName = themeBindings[name];
      if (!projectName) throw new Error(`Unknown theme binding: ${name}`);
      const candidates = [name, ...(themeTokenAliases[name] ?? [])].flatMap(candidate => candidate.startsWith("--color-")
        ? [candidate, candidate.replace("--color-", "--app-color-")] : [candidate]);
      const reference = candidates.reduceRight((value, candidate) => value ? `var(${candidate}, ${value})` : `var(${candidate})`, "");
      const previous = element.style.getPropertyValue(projectName);
      const priority = element.style.getPropertyPriority(projectName);
      element.style.setProperty(projectName, reference);
      return {projectName, reference, previous, priority};
    });
    return () => {
      for (const {projectName, reference, previous, priority} of bindings) {
        if (element.style.getPropertyValue(projectName) !== reference) continue;
        if (previous) element.style.setProperty(projectName, previous, priority);
        else element.style.removeProperty(projectName);
      }
    };
  }
  // 根清单仅展示已定义变量；必要值缺失仍由控件作用域检查报告。
  return {read,dispose,checkTokens,bindScope,diagnostics:() => checkTokens(document.documentElement,themeTokenNames).filter(token => token.available)};
}
