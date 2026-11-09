// 前置状态：导航栏已显示额度环（新 profile 先打开一次 Settings → Usage 预热额度数据）。
import { shoot } from "./lib.mjs";
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 110000);
const tooltip = `[...document.querySelectorAll('[role=tooltip],[data-minecodex-tooltip-content],[data-state=delayed-open],[data-state=instant-open]')].find(e => e.offsetWidth && /limit|reset/i.test(e.textContent))`;

await shoot("usage-meter", {
  posterAt: 0.75,
  async prepare({ d, rect }) {
    const m = await rect(`document.querySelector('[data-minecodex-usage-meter]')`);
    await d.moveTo(m.x + 260, m.y - 60, 200); await d.frame([m], 10);
  },
  async act({ d, rect, center, sleep }) {
    const m = await rect(`document.querySelector('[data-minecodex-usage-meter]')`);
    await sleep(400);
    await d.moveTo(...center(m), 500);
    await sleep(700);
    const t = await rect(tooltip);
    console.log("tooltip", t);
    await d.frame([m, t], 10);
    await sleep(1800);
  },
});

process.exit(0);
