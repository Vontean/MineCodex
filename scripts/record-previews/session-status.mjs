// 前置状态：打开一个已有会话（输入框下方有会话状态行）。
import { shoot } from "./lib.mjs";
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 90000);
const panel = `[...document.querySelectorAll('[data-minecodex-session-status-panel]')].find(p => p.offsetWidth)`;
const buttons = `[...document.querySelectorAll('[data-minecodex-session-status] button')].filter(b => b.offsetWidth)`;

await shoot("session-status", {
  posterAt: 0.42,
  async prepare({ d, rect, center, sleep }) {
    const collapse = await rect(`document.querySelector('[aria-label="Collapse session status"]')`);
    if (collapse) { await d.click(...center(collapse)); await sleep(700); }
    const ring = await rect(`document.querySelector('[data-minecodex-context-trigger]:not([hidden])')`);
    await d.moveTo(ring.x - 120, ring.y - 30, 200);
  },
  async act({ d, rect, rects, center, sleep }) {
    const ring = await rect(`document.querySelector('[data-minecodex-context-trigger]:not([hidden])')`);
    await d.frame([ring], 8); await sleep(350);
    await d.click(...center(ring)); await sleep(450);                 // 点 context 环，状态行展开
    await d.frame(await rects(buttons), 6); await sleep(500);
    for (let i = 0; i < 3; i++) {                                       // 依次打开统计 / 用量 / 上下文
      const b = await rect(`${buttons}[${i}]`);
      await d.moveTo(...center(b), 320); await d.click(); await sleep(250);
      await d.frame([await rect(panel), b], 8); await sleep(950);
    }
  },
});
process.exit(0);
