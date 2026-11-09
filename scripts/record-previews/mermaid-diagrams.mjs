// 前置状态：同 markdown-reading（full view 预览 feature-tour.md）。
import { shoot } from "./lib.mjs";
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 120000);
const scroller = `document.querySelector('[data-minecodex-markdown-reading] .cm-scroller') || document.querySelector('.cm-scroller')`;
const frame = `[...document.querySelectorAll('iframe')].find(e => e.offsetWidth && e.getBoundingClientRect().width > 300)`;
const actions = f => `JSON.stringify([...document.querySelectorAll('button[aria-label]')].filter(b => { if (!b.offsetWidth) return false; const r = b.getBoundingClientRect(); return /expand|download|copy|zoom/i.test(b.getAttribute('aria-label')) && r.y > ${f.y - 60} && r.y < ${f.y + f.height + 60}; }).map(b => { const r = b.getBoundingClientRect(); return { label: b.getAttribute('aria-label'), x: r.x + r.width / 2, y: r.y + r.height / 2 }; }))`;

await shoot("mermaid-diagrams", {
  posterAt: 0.35,
  async prepare({ cdp, rect, d, sleep }) {
    await cdp.evaluate(`(() => { const s = ${scroller}; const h = [...document.querySelectorAll('.cm-line, h2, span')].find(e => e.textContent.trim() === 'Release Flow'); s.scrollBy({ top: h.getBoundingClientRect().top - 150 }); })()`);
    await sleep(1500);
    const f = await rect(frame); console.log("frame", f);
    await d.moveTo(f.x + f.width + 80, f.y + 40, 200);
  },
  async act({ cdp, d, rect, center, sleep }) {
    const f = await rect(frame);
    await d.frame([f], 10); await sleep(500);
    await d.moveTo(f.x + f.width * 0.55, f.y + f.height * 0.4, 500); await sleep(700);
    const btns = JSON.parse(await cdp.evaluate(actions(f)));
    console.log("actions", btns.map(b => b.label));
    const dl = btns.find(b => /download/i.test(b.label)); const ex = btns.find(b => /expand|zoom/i.test(b.label)) ?? btns.at(-1);
    if (dl) { await d.moveTo(dl.x, dl.y, 400); await sleep(700); }
    await d.moveTo(ex.x, ex.y, 300); await d.click(); await sleep(1200);
    const zoomIn = await rect(`[...document.querySelectorAll('button[aria-label]')].find(b => b.offsetWidth && /zoom in|increase|放大/i.test(b.getAttribute('aria-label')))`);
    console.log("zoomIn", zoomIn);
    await sleep(500);
    if (zoomIn) { await d.moveTo(...center(zoomIn), 450); await d.click(); await sleep(450); await d.click(); await sleep(1100); }
    const close = await rect(`[...document.querySelectorAll('[role=dialog] button[aria-label]')].find(b => b.offsetWidth && /close/i.test(b.getAttribute('aria-label')))`);
    if (close) { await d.moveTo(...center(close), 350); await d.click(); await sleep(600); }
  },
});
process.exit(0);
