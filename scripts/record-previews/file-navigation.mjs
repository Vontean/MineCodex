// 前置状态：同 markdown-reading（full view，顶部路径胶囊可见）。
import { shoot } from "./lib.mjs";
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 120000);
const crumb = `[...document.querySelectorAll('button[aria-label="Browse and switch files"]')].find(b => b.offsetWidth)`;
// 原生文件树在 Shadow DOM 中：穿透 shadowRoot，按 data-item-path 结尾匹配条目。
const DEEP = `const deep = function* (root) { for (const el of root.querySelectorAll('*')) { yield el; if (el.shadowRoot) yield* deep(el.shadowRoot); } };`;
const leaf = t => `(() => { ${DEEP} const pop = document.querySelector('[role=dialog][data-mcx-ui-layer]'); if (!pop) return null; return [...deep(pop)].find(e => e.getAttribute?.('role') === 'treeitem' && e.getAttribute('aria-label') === ${JSON.stringify(t)} && e.getBoundingClientRect().width > 0) ?? null; })()`;
const colRects = names => `[${names.map(n => leaf(n)).join(",")}].filter(Boolean)`;

await shoot("file-navigation", {
  posterAt: 0.55,
  async prepare({ d, rect }) { const b = await rect(crumb); await d.moveTo(b.x + b.width + 160, b.y + 80, 200); },
  async act({ d, rect, rects, center, sleep }) {
    const b = await rect(crumb);
    await d.frame([b], 10); await sleep(350);
    await d.moveTo(...center(b), 450); await d.click(); await sleep(900);
    const pop = await rect(`document.querySelector('[role=dialog][data-mcx-ui-layer]')`);
    await d.frame([b, pop], 12);
    const g = await rect(leaf("guides"));
    await d.moveTo(g.x + 30, g.y + g.height / 2, 400); await d.click(); await sleep(900);
    await d.frame([b, await rect(`document.querySelector('[role=dialog][data-mcx-ui-layer]')`)], 12);
    await sleep(600);
    const s = await rect(leaf("shortcuts.md"));
    await d.moveTo(s.x + 30, s.y + s.height / 2, 400); await sleep(250); await d.click(); await sleep(1100);
    await d.frame([await rect(crumb)], 40); await sleep(900);
  },
});
process.exit(0);
