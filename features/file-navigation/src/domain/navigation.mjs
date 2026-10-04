export function fileNavigationPath(rootName, path) {
  const parts = path.split('/').filter(Boolean);
  const names = [rootName, ...parts];
  return {
    labels: names.length > 3 ? ['…', ...names.slice(-2)] : names,
    directories: ['', ...parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'))],
  };
}

export function selectFileNavigationDirectory(directories, index, path) {
  return [...directories.slice(0, index + 1), path];
}
