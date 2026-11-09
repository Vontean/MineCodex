// 先限定与触发对象的距离，再在局部候选中避让；避免宽画布的空角吸走气泡。
export function nearbyRadarDetails(candidates) {
  const unobscured = candidates.filter(candidate => !(candidate.pointer ?? candidate.coversPointer));
  const available = unobscured.length ? unobscured : candidates;
  const nearest = Math.min(...available.map(candidate => candidate.distance));
  return available.filter(candidate => candidate.distance <= Math.max(32, nearest + 16));
}
