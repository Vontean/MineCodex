// 前置状态：退出 full view，显示文件树，并在 All files 中展开 examples/guides。
import { shoot } from "./lib.mjs";
import { writeFileSync, rmSync } from "node:fs";
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 120000);
const FILE = new URL("../../examples/guides/release-checklist.md", import.meta.url);
const DEEP = `const deep = function* (root) { for (const el of root.querySelectorAll('*')) { yield el; if (el.shadowRoot) yield* deep(el.shadowRoot); } };`;
const item = label => `(() => { ${DEEP} return [...deep(document)].filter(e => e.getAttribute?.('role') === 'treeitem' && e.getAttribute('aria-label') === ${JSON.stringify(label)} && e.getBoundingClientRect().width > 0).sort((a,b) => b.getBoundingClientRect().y - a.getBoundingClientRect().y)[0] ?? null; })()`;
rmSync(FILE, { force: true });

await shoot("files-auto-refresh", {
  posterAt: 0.55,
  async prepare({ d, rect, sleep }) {
    const changed = await rect(`[...document.querySelectorAll('*')].filter(e => e.offsetWidth && e.childElementCount === 0 && e.textContent.trim() === 'Changed files')[0]`);
    const expanded = await d.rect(item("palette.json"));
    if (changed && expanded) { await d.click(changed.x + 20, changed.y + changed.height / 2); await sleep(800); }
    await d.rect(`(() => { const g = ${item("guides")}; g?.scrollIntoView({ block: 'center' }); return g; })()`); await sleep(600);
    const g = await rect(item("guides")); console.log("guides", g);
    await d.moveTo(g.x + 215, g.y - 30, 200);
  },
  async act({ d, rect, sleep }) {
    const g = await rect(item("guides")), n = await rect(item("notes"));
    const view = { x: g.x - 30, y: g.y - 60, width: 300, height: n.y - g.y + 160 };
    await d.frame([view], 0); await sleep(900);
    writeFileSync(FILE, "# Release checklist\n");           // 外部进程新建文件
    let r = null; for (let i = 0; i < 30 && !r; i++) { await sleep(150); r = await d.rect(item("release-checklist.md")); }
    console.log("appeared", !!r);
    await sleep(1100); r = await d.rect(item("release-checklist.md"));
    await sleep(600);
    rmSync(FILE, { force: true });                           // 外部删除
    for (let i = 0; i < 30 && r; i++) { await sleep(150); r = await d.rect(item("release-checklist.md")); }
    console.log("removed", !r);
    await sleep(900);
  },
});
rmSync(FILE, { force: true });
process.exit(0);
