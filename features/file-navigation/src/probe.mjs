// 只在原生 Files 树实际挂载且可见时报告适用；首页没有树不代表协议失效。
export function hasNativeFilesAnchor(root) {
  const tree = root?.querySelector?.('file-tree-container');
  return Boolean(tree && (typeof tree.checkVisibility !== 'function' || tree.checkVisibility()));
}
