// 前置状态：打开某个项目下的会话，侧栏有多个展开的分组。
import { shoot } from "./lib.mjs";
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 110000);
const tooltip = `[...document.querySelectorAll('[role=tooltip],[data-minecodex-tooltip-content],[data-state=delayed-open],[data-state=instant-open]')].find(e => e.offsetWidth && /limit|reset/i.test(e.textContent))`;

await shoot("sidebar-focus", {
  posterAt: 0.55,
  async prepare({ d, rect }) {
    const b = await rect(`document.querySelector('[data-minecodex-focus]')`);
    await d.moveTo(b.x + 200, b.y + 300, 200);
  },
  async act({ d, rect, center, sleep, vh }) {
    const b = await rect(`document.querySelector('[data-minecodex-focus]')`);
    const side = await rect(`document.querySelector('[data-minecodex-focus]').closest('aside, nav, [class*=sidebar]') || document.querySelector('[data-minecodex-focus]').parentElement.parentElement`);
    const view = { x: side.x, y: b.y - 12, width: side.width, height: Math.min(vh - b.y, 380) };
    await d.frame([view], 0);
    await sleep(500);
    await d.click(...center(b));           // 收起其他分组
    await sleep(1600);
    await d.click(...center(b));           // 恢复布局
    await sleep(1600);
  },
});
process.exit(0);
