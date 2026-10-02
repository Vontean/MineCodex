const auxiliary = /^(?:__tests__|__fixtures__|tests?|fixtures?|test-results|playwright-report|coverage|agent[-_]?(?:tests?|checks?|notes|reports)|self[-_]?tests?|(?:.*[-_])?(?:smoke|self)[-_]tests?)$/i;
export function isAuxiliarySite(relativePath, title = "") {
  const parts = relativePath.split(/[\\/]/);
  return parts.some(part => auxiliary.test(part))
    || /(?:^|\/)(?:docs\/research|internal-notes|implementation-notes)(?:\/|$)/i.test(parts.join("/"))
    || /(?:^|\b)(?:(?:agent|自动化|代理)\s*[-:：]?\s*)?(?:self[- ]?test|smoke test|test report|implementation notes|自测报告|测试报告|实现说明)(?:\b|\s|[-:：]|$)/i.test(title);
}

export function candidateFamily(candidate) {
  const directory = candidate.directory;
  if (!directory) return { key: `${candidate.projectId}\0${candidate.entryId || candidate.url}`, version: [] };
  const parts = directory.split(/[\\/]/), version = [];
  const normalized = parts.map(part => {
    const match = part.match(/^(?:(.*?)[-_ .])?(?:v|ver|version|rev|revision)[-_ .]?(\d+(?:[._]\d+)*)$/i);
    const release = part.match(/^(.*?)[-_ ](\d+\.\d+(?:\.\d+)*)$/);
    if (release) { version.push(...release[2].split(".").map(Number)); return release[1]; }
    if (match) { version.push(...match[2].split(/[._]/).map(Number)); return (match[1] || "").replace(/[-_ .]+$/, ""); }
    if (/^(?:final|latest|copy|backup|old)$/i.test(part)) return "";
    return part.replace(/[-_ ](?:final|latest|copy|backup|old)$/i, "");
  }).filter(Boolean).join("/");
  return { key: `${candidate.projectId}\0${normalized}`, version };
}

function newer(a, b) {
  const av = candidateFamily(a).version, bv = candidateFamily(b).version;
  // 明确版本号不受复制文件或格式化导致的时间变化影响。
  if (av.length || bv.length) {
    for (let i = 0; i < Math.max(av.length, bv.length); i++) {
      const difference = (av[i] || 0) - (bv[i] || 0);
      if (difference) return difference;
    }
  }
  return (a.modifiedAt || 0) - (b.modifiedAt || 0)
    || Number(a.status === "running") - Number(b.status === "running")
    || (a.directory || a.url || "").localeCompare(b.directory || b.url || "", "en", { numeric: true });
}

export function selectDiscoveryCandidates(candidates, saved) {
  const families = new Map();
  for (const candidate of candidates) {
    const key = candidateFamily(candidate).key;
    const previous = families.get(key);
    if (!previous || newer(candidate, previous) > 0) families.set(key, candidate);
  }
  const savedFamilies = new Set(saved.filter(s => s.origin?.kind === "project" && s.directory)
    .map(s => candidateFamily({ ...s, projectId: s.origin.projectId }).key));
  return [...families].filter(([key, candidate]) => !savedFamilies.has(key) && !saved.some(s =>
    s.entryId === candidate.entryId || candidate.url && s.url === candidate.url
  )).map(([, candidate]) => candidate).sort((a, b) =>
    a.title.localeCompare(b.title, "en", { sensitivity: "base", numeric: true })
    || a.projectName.localeCompare(b.projectName, "en", { sensitivity: "base", numeric: true })
    || (a.directory || a.url).localeCompare(b.directory || b.url));
}
