// 前置状态：打开会话；剧本会把思考强度拖回原位，录完核对 ~/.codex/config.toml 未变化。
import { shoot, connect, sleep } from "./lib.mjs";
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 120000);
const modelBtn = `[...document.querySelectorAll('[data-codex-composer-root] button')].find(b => /GPT|Sol|Medium|High|Low/.test(b.textContent))`;
const menu = `[...document.querySelectorAll('[role=menu]')].find(e => e.offsetWidth)`;
const track = `[...document.querySelectorAll('span[role=slider]')].filter(e => e.offsetWidth).sort((a,b)=>b.offsetWidth-a.offsetWidth)[0]`;
let restoreX = null, trackY = null;

await shoot("model-slider", {
  posterAt: 0.8,
  async prepare({ d, rect, key, sleep }) { await key('Escape', 'Escape', 0, 27); await sleep(300); await key('Escape', 'Escape', 0, 27); await sleep(500); const b = await rect(modelBtn); await d.moveTo(b.x - 120, b.y - 40, 200); },
  async act(ctx) {
    const { d, rect, center, sleep, type } = ctx;
    const b = await rect(modelBtn);
    await d.frame([b], 10); await sleep(250);
    await d.click(...center(b)); await sleep(600);
    let m = await rect(menu); await d.frame([m, b], 8);
    const t = await rect(track); trackY = t.y + t.height / 2;
    const step = i => t.x + 14 + (t.width - 28) * i / 4;
    const thumb = await rect(`[...document.querySelectorAll('span[role=slider]')].filter(e => e.offsetWidth).sort((a,b)=>a.offsetWidth-b.offsetWidth)[0]`);
    restoreX = thumb.x + thumb.width / 2;
    await d.moveTo(restoreX, trackY, 350);                // 拖动思考强度到最高
    await d.press(); await d.moveTo(step(4), trackY, 500); await d.release(); await sleep(700);
    await d.press(); await d.moveTo(restoreX, trackY, 450); await d.release(); await sleep(400);
    const model = await rect(`[...(${menu}).querySelectorAll('button,[role=menuitem],div')].filter(e => e.offsetWidth && /^GPT.*›?$/.test(e.textContent.trim()) ).sort((a,b)=>a.offsetWidth-b.offsetWidth)[0]`);
    await d.click(...center(model));                        // 进入模型列表，等列表渲染出条目
    for (let i = 0; i < 20 && !(await d.rect(`[...(${menu})?.querySelectorAll('[role=menuitem],[role=menuitemradio],[role=option]') ?? []].filter(e => e.offsetWidth)[3]`)); i++) await sleep(150);
    await sleep(300);
    const listRows = await ctx.rects(`[...document.querySelectorAll('[data-radix-popper-content-wrapper]')].filter(e => e.offsetWidth)`); console.log('list', JSON.stringify(listRows));
    const listView = { x: b.x - 120, y: b.y - 430, width: b.width + 160, height: 460 };
    await d.frame([listView], 0);
    const rows = await d.rect(`[...(${menu}).querySelectorAll('[role=menuitem],[role=menuitemradio],[role=option]')].filter(e => e.offsetWidth)[2]`);
    if (rows) { await d.moveTo(rows.x + rows.width * 0.4, rows.y + rows.height / 2, 400); await sleep(700); }
    await type("son"); await sleep(900);                     // 搜索框默认聚焦
    const found = await ctx.rects(`[...document.querySelectorAll('[data-radix-popper-content-wrapper]')].filter(e => e.offsetWidth)`);
    await d.frame([listView], 0);
    await sleep(900);
  },
});
const cdp = await connect();
await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await sleep(400);
await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await sleep(400);
console.log("model button now:", await cdp.evaluate(`[...document.querySelectorAll("[data-codex-composer-root] button")].map(b => b.textContent.trim()).filter(Boolean).join(" | ")`));
process.exit(0);
