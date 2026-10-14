// 同一文件视图下的附加 React 根继承最近的 Provider；原始 Fiber 不离开适配层。
export function captureMarkdownProviders(element, codex) {
  const providers = [],
    seen = new Set();
  let fiber;
  for (let anchor = element; anchor && !fiber; anchor = anchor.parentElement)
    fiber = codex.currentFiber(anchor);
  for (; fiber; fiber = fiber.return) {
    if (fiber.tag !== 10 || seen.has(fiber.type)) continue;
    providers.push({ type: fiber.type, value: fiber.memoizedProps.value });
    seen.add(fiber.type);
  }
  return (React, tree) => {
    for (const provider of providers)
      tree = React.createElement(provider.type, { value: provider.value }, tree);
    return tree;
  };
}
