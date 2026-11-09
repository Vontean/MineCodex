// 前置状态：打开某个项目下的会话（当前任务位于侧栏上部），侧栏多个分组展开，未处于聚焦状态。
// 剧本：先看到展开的完整侧栏，再点击 Focus，其他分支收拢，只留当前任务路径。录完恢复布局。
import { shoot, connect, sleep } from "./lib.mjs";
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 110000);
const focus = `document.querySelector('[data-minecodex-focus]')`;
// 侧栏标题本身是演示内容，不打码。

await shoot("sidebar-focus", {
  posterAt: 0.8,
  async prepare({ cdp, d, rect, center, sleep }) {
    if (await cdp.evaluate(`${focus}.getAttribute('aria-pressed') === 'true'`)) { await d.click(...center(await rect(focus))); await sleep(1200); }
    const b = await rect(focus); await d.moveTo(b.x + 260, b.y + 360, 200);
  },
  async act({ cdp, d, rect, center, sleep }) {
    const b = await rect(focus);
    // 取侧栏上部：聚焦前看到多个展开分组，聚焦后当前任务路径收拢到画面内。
    await d.frame([{ x: 0, y: b.y - 40, width: 10, height: 600 }], 0);
    await sleep(1800);                                     // 先看完整展开的侧栏
    await d.moveTo(...center(b), 700); await sleep(900);    // 悬停显示 Focus current task
    await d.click(); await sleep(2800);                     // 收拢到当前任务
  },
});
const cdp = await connect();
if (await cdp.evaluate(`${focus}.getAttribute('aria-pressed') === 'true'`)) {
  const r = await cdp.evaluate(`(() => { const r = ${focus}.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await cdp.send("Input.dispatchMouseEvent", { type, x: r[0], y: r[1], button: "left", clickCount: 1 });
  await sleep(1000);
}
console.log("restored, pressed =", await cdp.evaluate(`${focus}.getAttribute('aria-pressed')`));
process.exit(0);
