// 纯装饰字符地形；不读取会话数据，也不参与界面交互。
const canvas = document.querySelector('#agent-world');
const context = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const points = [];
const agents = [];
const heightAt = (x, z) => {
  const ridge = Math.sin(x * .16 + Math.cos(z * .13)) * 2.4 + Math.cos(z * .21) * 1.8;
  const island = Math.max(0, 1 - Math.hypot(x / 31, z / 26));
  return Math.max(-1, Math.floor(island * 9 + ridge - 2));
};
for (let z = -28; z <= 28; z++) {
  for (let x = -32; x <= 32; x++) {
    const y = heightAt(x, z);
    if (x * x / 1100 + z * z / 850 > 1.15) continue;
    const path = Math.abs(z - Math.round(Math.sin(x * .12) * 9)) < 1;
    points.push({ x, y, z, glyph: y < 0 ? '~' : path ? ':' : y > 5 ? '#' : '+', kind: path ? 'path' : 'land' });
    // 用垂直字符层显示台阶断面，保留体素地形的厚度。
    const bottom = Math.min(heightAt(x + 1, z), heightAt(x, z + 1));
    for (let h = bottom + 1; h < y; h++) points.push({ x, y: h, z, glyph: '|', kind: 'side' });
  }
}
for (const [x, z, label] of [[-20, -9, '>_'], [20, 9, '{ }'], [-8, 20, 'git'], [10, -20, '</>'], [-23, 15, '[AI]'], [24, -12, '$']]) {
  const base = heightAt(x, z);
  for (let y = base + 1; y <= base + 5; y++) points.push({ x, y, z, glyph: y === base + 5 ? '[]' : '|', kind: 'node' });
  agents.push({ x, y: base + 7, z, glyph: label, kind: 'node' });
}
let width = 0, height = 0, frame = 0, angle = .65, last = 0;
let dark = false;
function resize() {
  width = innerWidth;
  height = innerHeight;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw();
}
function draw() {
  if (!context || !width) return;
  context.clearRect(0, 0, width, height);
  const scale = Math.max(width / 62, height / 42);
  const sin = Math.sin(angle), cos = Math.cos(angle);
  const project = (point) => {
    const x = point.x * cos - point.z * sin;
    const depth = point.x * sin + point.z * cos;
    return { ...point, sx: width / 2 + x * scale, sy: height * .58 + (depth * .48 - point.y * .95) * scale, depth };
  };
  const visible = [...points, ...agents].map(project).sort((a, b) => a.depth - b.depth);
  const fontSize = Math.max(10, Math.min(14, scale * .52));
  context.font = `${fontSize}px ui-monospace, SFMono-Regular, Consolas, monospace`;
  context.textAlign = 'center';
  // 同一字符格只保留前景点，避免山体投影堆叠成杂乱笔画。
  const cells = new Map();
  for (const point of visible) cells.set(`${Math.round(point.sx / (fontSize * .7))}:${Math.round(point.sy / fontSize)}`, point);
  for (const p of cells.values()) {
    if (p.sx < -30 || p.sx > width + 30 || p.sy < -20 || p.sy > height + 20) continue;
    const alpha = p.kind === 'node' ? .48 : p.kind === 'path' ? .34 : p.kind === 'side' ? .14 : .22;
    context.fillStyle = dark ? `rgba(112,166,245,${alpha})` : `rgba(52,101,174,${alpha})`;
    context.fillText(p.glyph, p.sx, p.sy);
  }
}
function tick(time) {
  if (time - last >= 50) {
    if (last) angle = (angle + Math.min(time - last, 100) * Math.PI * 2 / 240000) % (Math.PI * 2);
    last = time;
    draw();
  }
  frame = requestAnimationFrame(tick);
}
function syncMotion() {
  cancelAnimationFrame(frame);
  last = 0;
  if (!document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
  else draw();
}
function syncTheme() {
  dark = document.documentElement.dataset.theme === 'dark';
  draw();
}
new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
addEventListener('resize', resize);
document.addEventListener('visibilitychange', syncMotion);
reduced.addEventListener('change', syncMotion);
addEventListener('pagehide', () => cancelAnimationFrame(frame));
addEventListener('pageshow', syncMotion);
syncTheme();
resize();
syncMotion();
