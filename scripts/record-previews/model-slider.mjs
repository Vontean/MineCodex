// 前置状态：Composer 当前为 GPT 6.1 Sol / Medium，菜单关闭。
// 选择模型会立即写入全局 ~/.codex/config.toml：录前备份，录完由剧本切回原模型与档位，再与备份比对。
// 剧本：打开 Slider → 进入模型列表 → 滚动浏览 → 选中第三方模型 → 拖动推理强度。
import { shoot, connect, sleep } from "./lib.mjs";
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 120000);
const ORIGINAL = { search: "gpt 6.1 sol", effortIndex: 1, efforts: 5 };   // Medium 为五档中的第二档
const TARGET = /Kimi K3\.1 Pro/;
const modelBtn = `[...document.querySelectorAll('[data-codex-composer-root] button')].find(b => /effort|model|GPT|Sol|Kimi|Low|Medium|High/i.test(b.textContent))`;
const menu = `[...document.querySelectorAll('[role=menu]')].find(e => e.offsetWidth)`;
// 模型列表与 Slider 面板同时挂载，取包含模型条目的滚动列表。
const listBox = `[...document.querySelectorAll('[role=menu]')].filter(e => e.offsetWidth && e.getBoundingClientRect().height > 150).at(-1)`;
const header = `[...document.querySelectorAll('[role=menu] [role=menuitem]')].find(e => e.offsetWidth > 80)`;
const track = `[...document.querySelectorAll('span[role=slider]')].filter(e => e.offsetWidth).sort((a,b) => b.offsetWidth - a.offsetWidth)[0]`;
const thumb = `[...document.querySelectorAll('span[role=slider]')].filter(e => e.offsetWidth).sort((a,b) => a.offsetWidth - b.offsetWidth)[0]`;
const rowOf = re => `[...document.querySelectorAll('[role=menu] [role=menuitemradio], [role=menu] [role=menuitem], [role=menu] [role=option]')].find(e => e.offsetWidth && ${re}.test(e.textContent.trim()))`;
const escape = cdp => cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });

await shoot("model-slider", {
  posterAt: 0.88,
  async prepare({ cdp, d, rect, sleep }) {
    for (let i = 0; i < 4 && (await rect(menu)); i++) { await escape(cdp); await sleep(400); }
    await sleep(300);
    const b = await rect(modelBtn); await d.moveTo(b.x - 120, b.y - 60, 200);
  },
  async act({ cdp, d, rect, center, sleep }) {
    const b = await rect(modelBtn);
    await d.frame([b], 10); await sleep(300);
    await d.click(...center(b));                                  // 1. 打开 Slider
    for (let i = 0; i < 20 && !(await rect(header)); i++) await sleep(100);
    await sleep(400);
    await d.frame([await rect(menu), b], 8); await sleep(500);
    const h = await rect(header);
    await d.moveTo(...center(h), 400); await d.click();          // 2. 进入模型列表
    // 列表高度有 320ms 展开动画：等尺寸稳定后再取景。
    let list = null;
    for (let i = 0, prev = 0; i < 30; i++) { await sleep(80); list = await rect(listBox); if (list && Math.abs(list.height - prev) < 1 && list.height > 200) break; prev = list?.height ?? 0; }
    await d.frame([list, b], 8);
    await d.moveTo(list.x + list.width * 0.45, list.y + list.height * 0.55, 400); await sleep(300);
    // 3. 逐步滚动浏览，目标行进入列表可视区中部即停。
    const visible = `(() => { const row = ${rowOf(TARGET)}; const box = row?.closest('.overflow-y-auto'); if (!row || !box) return false; const r = row.getBoundingClientRect(), b = box.getBoundingClientRect(); return r.top > b.top + b.height * 0.3 && r.bottom < b.bottom - 8; })()`;
    const wx = list.x + list.width * 0.45, wy = list.y + list.height * 0.55;
    for (let i = 0; i < 80 && !(await cdp.evaluate(visible)); i++) {
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: wx, y: wy, deltaX: 0, deltaY: 30 });
      await sleep(i % 6 === 5 ? 260 : 40);
    }
    await sleep(400);
    const row = await rect(rowOf(TARGET));
    await d.moveTo(row.x + row.width * 0.4, row.y + row.height / 2, 450); await sleep(450);
    await d.click(); await sleep(900);                            // 4. 选中第三方模型，回到 Slider
    await d.frame([await rect(menu), b], 8);
    const t = await rect(track), k = await rect(thumb);
    const y = t.y + t.height / 2, start = k.x + k.width / 2;
    await d.moveTo(start, y, 400); await sleep(200);              // 5. 拖动推理强度
    await d.press(); await d.moveTo(t.x + t.width - 14, y, 550); await d.release(); await sleep(900);
    await d.press(); await d.moveTo(t.x + 14, y, 650); await d.release(); await sleep(900);
  },
});

// 还原：切回原模型与档位（不录制）。
const cdp = await connect();
const click = async (x, y) => { for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await cdp.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 }); };
const at = async e => cdp.evaluate(`(() => { const el = ${e}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
if (!(await at(track))) { const b = await at(modelBtn); await click(b.x + b.width / 2, b.y + b.height / 2); await sleep(700); }
const h = await at(header); await click(h.x + h.width / 2, h.y + h.height / 2); await sleep(800);
await cdp.send("Input.insertText", { text: ORIGINAL.search }); await sleep(600);
for (const type of ["keyDown", "keyUp"]) await cdp.send("Input.dispatchKeyEvent", { type, key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
await sleep(900);
const t = await at(track);
await click(t.x + 14 + (t.width - 28) * ORIGINAL.effortIndex / (ORIGINAL.efforts - 1), t.y + t.height / 2); await sleep(700);
console.log("restored:", await cdp.evaluate(`(${menu})?.textContent.slice(0, 30)`));
await escape(cdp); await sleep(300);
process.exit(0);
