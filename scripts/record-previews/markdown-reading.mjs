// 前置状态：Files 面板打开 examples/feature-tour.md → View preview → 进入 full view。
import { shoot } from "./lib.mjs";
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 120000);
const leftText = t => `[...document.querySelectorAll('a,button,li,span,div')].filter(e => e.offsetWidth && e.getBoundingClientRect().x < 320 && e.textContent.trim() === ${JSON.stringify(t)}).sort((a,b)=>a.offsetWidth-b.offsetWidth)[0]`;
const scroller = `document.querySelector('[data-minecodex-markdown-reading] .cm-scroller') || document.querySelector('.cm-scroller')`;

await shoot("markdown-reading", {
  posterAt: 0.45,
  async prepare({ cdp, d, sleep, key }) {
    await cdp.evaluate(`(${scroller}).scrollTo({ top: 0 })`); await sleep(600);
    await d.moveTo(640, 300, 200);
  },
  async act({ cdp, d, rect, rects, center, sleep }) {
    const doc = { x: 160, y: 100, width: 960, height: 560 };
    await d.frame([doc], 0); await sleep(400);
    await d.moveTo(22, 495, 600); await sleep(700);                    // 悬停章节目录
    const items = await rects(`[...document.querySelectorAll('a,button,li')].filter(e => e.offsetWidth && e.getBoundingClientRect().x < 320 && /^(Goals|Timeline|Release Flow|Checklist Script|Open Questions|Next Steps)$/.test(e.textContent.trim()))`);
    console.log("toc items", items.length);
    if (items.length) await d.frame(items, 14);
    const timeline = await rect(leftText("Timeline"));
    await d.moveTo(...center(timeline), 350); await d.click(); await sleep(1100);
    const table = await rect(`[...document.querySelectorAll('[data-mcx-reading-table]')].filter(e => e.offsetWidth)[0]`);
    const tableBox = await rect(`(() => { const rows = [...document.querySelectorAll('[data-mcx-reading-table]')].filter(e => e.offsetWidth); const a = rows[0].getBoundingClientRect(), b = rows.at(-1).getBoundingClientRect(); return { getBoundingClientRect: () => ({ x: a.x, y: a.y - 40, width: a.width, height: b.bottom - a.y + 40 }) }; })()`);
    await d.frame([tableBox], 10);
    await d.moveTo(table.x + table.width * 0.6, table.y + 60, 450); await sleep(700);
    const btns = await cdp.evaluate(`JSON.stringify([...document.querySelectorAll('[data-mcx-reading-table-actions] button')].filter(b => b.offsetWidth).map(b => { const r = b.getBoundingClientRect(); return { label: b.getAttribute('aria-label'), x: r.x + r.width / 2, y: r.y + r.height / 2 }; }))`).then(JSON.parse);
    console.log("actions", btns.map(b => b.label));
    const expand = btns.at(-1);
    await d.moveTo(expand.x, expand.y, 350); await sleep(300); await d.click(); await sleep(1000);
    const dialog = await rect(`[...document.querySelectorAll('[role=dialog]')].find(e => e.offsetWidth)`);
    await d.frame([dialog], 0); await sleep(1500);
    const close = await rect(`[...document.querySelectorAll('[role=dialog] button[aria-label]')].find(b => b.offsetWidth && /close/i.test(b.getAttribute('aria-label')))`);
    if (close) { await d.moveTo(...center(close), 350); await d.click(); await sleep(600); }
  },
});
process.exit(0);
