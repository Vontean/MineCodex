// 前置状态：侧栏可见；历史会话标题在录制时自动加轻度模糊。
import { shoot, connect } from "./lib.mjs";
// 录制用薄码：只模糊历史会话标题，日期与面板保持清晰。
const BLUR = `(() => { const s = document.createElement("style"); s.id = "demo-blur"; s.textContent = "[data-mcx-quick-chat] ul li:not(:first-child) button > span.truncate{filter:blur(4px)}"; document.head.append(s); })()`;
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 120000);
const vis = s => `[...document.querySelectorAll('${s}')].find(e => e.offsetWidth)`;

await shoot("quick-chat", {
  posterAt: 0.7,
  async prepare({ d, rect, center, sleep, key, cdp }) {
    await cdp.evaluate(BLUR);
    for (let i = 0; i < 2; i++) { await key("Escape", "Escape", 0, 27); await sleep(250); }
    const m = await rect(vis("[data-mcx-quick-chat-minimize]"));
    if (m) { await d.moveTo(...center(m), 200); await d.click(); await sleep(800); }
    await d.moveTo(560, 180, 200);
  },
  async act({ d, rect, center, sleep }) {
    const row = await rect(`[...document.querySelectorAll('a,button')].find(e => e.offsetWidth && e.textContent.trim() === 'New chat')`);
    await d.frame([row], 10); await sleep(150);
    await d.moveTo(row.x + row.width * 0.55, row.y + row.height / 2, 450); await sleep(350);
    const entry = await rect(vis("[data-mcx-quick-chat-entry]"));
    await d.frame([row, entry], 10);
    await d.moveTo(...center(entry), 250); await d.click(); await sleep(900);     // 侧栏打开
    const bar = await rect(vis("[data-mcx-quick-chat]"));
    await d.frame([bar], 12);
    await d.moveTo(bar.x + bar.width * 0.35, bar.y + bar.height / 2, 600); await sleep(450);
    const hist = await rect(vis("[data-mcx-quick-chat-history]"));
    await d.frame([bar, hist], 12);
    await d.moveTo(...center(hist), 300); await d.click(); await sleep(1300);      // 展开历史
    const panel = await rect(vis("[data-mcx-quick-chat]"));
    await d.frame([{ x: panel.x, y: panel.y, width: panel.width, height: Math.min(panel.height, 400) }], 8);
    await sleep(1500);
    const min = await rect(vis("[data-mcx-quick-chat-minimize]"));
    await d.moveTo(...center(min), 350); await d.click(); await sleep(900);         // 最小化
  },
});
{ const c = await connect(); await c.evaluate(`document.getElementById('demo-blur')?.remove()`); }
process.exit(0);
