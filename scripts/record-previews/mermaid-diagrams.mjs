// 前置状态：Files 面板打开 examples/diagram-gallery.md（Preview）→ 隐藏文件树 → 进入 full view。
// 镜头保留路径与 View source，说明这里是 Markdown Preview；逐个滚到各图型并停留，展示 QV 进场。
import { shoot } from "./lib.mjs";
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 120000);
const scroller = `(document.querySelector('[data-minecodex-markdown-reading] .cm-scroller') || document.querySelector('.cm-scroller'))`;
const HEADINGS = ["Sequence", "Skills", "Weekly Output", "Roadmap", "Priorities", "Topics"];
// 缓动滚动到标题位于正文顶部；页面内 rAF 执行，避免逐帧往返 CDP。
const scrollTo = (title, ms) => `new Promise(done => {
  const s = ${scroller};
  const h = [...s.querySelectorAll('h1,h2,.cm-line')].find(e => e.textContent.trim() === ${JSON.stringify(title)});
  const from = s.scrollTop, to = Math.min(s.scrollHeight - s.clientHeight, from + h.getBoundingClientRect().top - s.getBoundingClientRect().top - 24);
  const t0 = performance.now();
  const step = now => { const t = Math.min(1, (now - t0) / ${ms}); const e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    s.scrollTop = from + (to - from) * e; t < 1 ? requestAnimationFrame(step) : done(); };
  requestAnimationFrame(step);
})`;

await shoot("mermaid-diagrams", {
  posterAt: 0.62,
  async prepare({ cdp, d, vw, sleep }) {
    await cdp.evaluate(`${scroller}.scrollTo({ top: 0 })`); await sleep(2500);
    await d.moveTo(vw - 150, 520, 200);
  },
  async act({ cdp, d, vw, vh, sleep }) {
    await d.frame([{ x: 0, y: 0, width: vw, height: vh }], 0);
    await sleep(1500);
    for (const title of HEADINGS) {
      await cdp.evaluate(scrollTo(title, 700));
      await sleep(1400);
    }
  },
});
process.exit(0);
