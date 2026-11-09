// 前置状态：打开会话，输入框为空；录完自动清空，只用 Shift+Enter 换行，不会发送。
import { shoot } from "./lib.mjs";
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 140000);
const editor = `document.querySelector('[data-codex-composer-root] [contenteditable=true]')`;
const composer = `document.querySelector('[data-codex-composer-root]')`;
const clear = async ({ cdp, key, sleep }) => { await cdp.evaluate(`${editor}.focus()`); await key("KeyA", "a", 4, 65); await key("Backspace", "Backspace", 0, 8); await sleep(300); };
// 只用 Shift+Enter 换行；单独 Enter 会发送消息，禁止使用。
const typeLines = async ({ type, key, sleep }, lines) => { for (const [i, line] of lines.entries()) { if (i) await key("Enter", "Enter", 8, 13); await type(line); await sleep(140); } };

await shoot("composer-expand", {
  posterAt: 0.6,
  async prepare(ctx) { await clear(ctx); const c = await ctx.rect(composer); await ctx.d.moveTo(c.x + c.width * 0.7, c.y - 40, 200); await ctx.d.click(c.x + c.width * 0.4, c.y + 24); },
  async act(ctx) {
    const { d, rect, center, sleep } = ctx;
    await d.frame([await rect(composer)], 8);
    await typeLines(ctx, ["Refactor the settings page:", "1. Group options by task", "2. Keep the native spacing tokens", "3. Add keyboard shortcuts for every section", "4. Verify light and dark themes"]);
    await sleep(500);
    const btn = await rect(`[...document.querySelectorAll('[data-mcx-composer-expand-control]')].find(e => e.offsetWidth)`);
    console.log("expand button", btn);
    await d.frame([await rect(composer)], 8);
    await d.moveTo(...center(btn), 450); await d.click();
    await sleep(700);
    await d.frame([await rect(composer)], 8);
    await sleep(1500);
    const btn2 = await rect(`[...document.querySelectorAll('[data-mcx-composer-expand-control]')].find(e => e.offsetWidth)`);
    await d.moveTo(...center(btn2), 350); await d.click();
    await sleep(700);
    await d.frame([await rect(composer)], 8);
    await sleep(900);
  },
});
{ const { connect, sleep } = await import("./lib.mjs"); const cdp = await connect();
  const key = (code, k, m, vk) => cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, modifiers: m, windowsVirtualKeyCode: vk }).then(() => cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, modifiers: m, windowsVirtualKeyCode: vk }));
  await clear({ cdp, key, sleep }); console.log("composer cleared:", await cdp.evaluate(`${editor}.textContent.length`)); }
process.exit(0);
