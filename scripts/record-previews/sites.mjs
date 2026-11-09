// 前置状态：进入 Sites 页面（导航栏 ··· → Sites）；需设置 MINECODEX_SITES_DATA_DIR 为隔离宿主使用的站点数据目录。
import { shoot } from "./lib.mjs";
import { rmSync } from "node:fs";
// 临时站点数据：每次录制前清空，保证“新增”可重复。
if (!process.env.MINECODEX_SITES_DATA_DIR) throw new Error("set MINECODEX_SITES_DATA_DIR to the isolated sites data dir");
rmSync(`${process.env.MINECODEX_SITES_DATA_DIR}/sites.json`, { force: true });
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 120000);
const btnText = (t, scope = 'document') => `[...${scope}.querySelectorAll('button,[role=tab]')].find(b => b.offsetWidth && b.textContent.trim() === ${JSON.stringify(t)})`;
const dlg = `[...document.querySelectorAll('dialog')].find(e => e.offsetWidth)`;

await shoot("sites", {
  posterAt: 0.5,
  async prepare({ d, rect, center, sleep }) {
    const cancel = await rect(`(${dlg}) && ${btnText("Cancel", `(${dlg})`)}`);
    if (cancel) { await d.click(...center(cancel)); await sleep(600); }
    const owned = await rect(btnText("Owned by you")); if (owned) { await d.click(...center(owned)); await sleep(800); }
    const add = await rect(btnText("Add site")); await d.moveTo(add.x - 220, add.y + 90, 200);
  },
  async act({ d, rect, rects, center, sleep }) {
    const add = await rect(btnText("Add site"));
    await d.frame([add], 10); await sleep(300);
    await d.moveTo(...center(add), 450); await d.click();
    for (let i = 0; i < 30; i++) { await sleep(150); if ((await rects(`[...((${dlg})?.querySelectorAll('input[type=checkbox],[role=checkbox]') ?? [])].filter(e => e.offsetWidth)`)).length > 2) break; }
    await sleep(300);
    const dialog = await rect(dlg); await d.frame([dialog], 6);
    const boxes = await rects(`[...(${dlg}).querySelectorAll('input[type=checkbox],[role=checkbox]')].filter(e => e.offsetWidth)`);
    console.log("candidates", boxes.length);
    await d.moveTo(boxes[1].x + boxes[1].width / 2, boxes[1].y + boxes[1].height / 2, 500); await sleep(150); await d.click(); await sleep(500);
    const ok = await rect(btnText("Add", `(${dlg})`));
    await d.moveTo(...center(ok), 400); await d.click(); await sleep(1200);
    const tab = await rect(btnText("Added by you"));
    await d.frame([add, tab], 12);
    await d.moveTo(...center(tab), 450); await d.click(); await sleep(1100);
    const row = await rect(`[...document.querySelectorAll('a,[role=row],li,div')].filter(e => e.offsetWidth && /landing-page/.test(e.textContent) && /Local address/.test(e.textContent)).sort((a,b) => a.offsetHeight - b.offsetHeight)[0]`);
    console.log("row", row);
    await d.frame([tab, row && { x: row.x, y: row.y, width: Math.min(row.width, 560), height: row.height }].filter(Boolean), 12);
    await sleep(1500);
  },
});
process.exit(0);
