// 前置状态：打开会话，输入框为空；录完自动清空。
import { shoot, connect, sleep } from "./lib.mjs";
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 120000);
const editor = `document.querySelector('[data-codex-composer-root] [contenteditable=true]')`;
const composer = `document.querySelector('[data-codex-composer-root]')`;
const btnSel = `[...document.querySelectorAll('button[data-minecodex-quick-prompts]')].find(e => e.offsetWidth)`;
const popSel = `[...document.querySelectorAll('[data-minecodex-quick-prompts]')].filter(e => e.offsetWidth && e.tagName !== 'BUTTON').sort((a,b)=>b.offsetWidth*b.offsetHeight - a.offsetWidth*a.offsetHeight)[0]`;
const itemsSel = `[...(${popSel})?.querySelectorAll('[role=option],[role=menuitem],button') ?? []].filter(e => e.offsetWidth && e.textContent.trim().length > 6)`;

await shoot("notes", {
  posterAt: 0.55,
  async prepare({ d, rect }) { const b = await rect(btnSel); await d.moveTo(b.x + 160, b.y - 50, 200); },
  async act(ctx) {
    const { d, rect, rects, center, sleep } = ctx;
    const b = await rect(btnSel); const comp = await rect(composer);
    await d.frame([b, comp], 8);
    await sleep(300);
    await d.moveTo(...center(b), 400); await d.click(); await sleep(600);
    const pop = await rect(popSel); console.log("popover", pop);
    await d.frame([pop, b], 8);
    const items = await rects(itemsSel); console.log("items", items.length);
    for (const it of items.slice(0, 3)) { await d.moveTo(it.x + 60, it.y + it.height / 2, 260); await sleep(180); }
    const target = items[2];
    await d.click(target.x + 60, target.y + target.height / 2); await sleep(700);
    await d.frame([await rect(composer)], 8);
    await sleep(1300);
  },
});
const cdp = await connect();
const key = (code, k, m, vk) => cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, modifiers: m, windowsVirtualKeyCode: vk }).then(() => cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, modifiers: m, windowsVirtualKeyCode: vk }));
await cdp.evaluate(`${editor}.focus()`); await key("KeyA", "a", 4, 65); await key("Backspace", "Backspace", 0, 8); await sleep(300);
console.log("composer cleared:", await cdp.evaluate(`${editor}.textContent.length`));
process.exit(0);
