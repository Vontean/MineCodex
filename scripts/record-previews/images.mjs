// 前置状态：Plus 账号的 Library 页，原生 Images 标签选中并滚动到顶部，未打开图片详情；录完关闭详情并回到 Images。
import { shoot, connect, sleep } from "./lib.mjs";
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 120000);
const nav = `document.querySelector('[data-minecodex-image-navigation]')`;
const tab = name => `[...document.querySelectorAll('[data-minecodex-image-navigation] [role=tab]')].find(e => e.textContent.trim() === ${JSON.stringify(name)})`;
const area = `document.getElementById('minecodex-image-gen-content')`;
const cards = `[...document.querySelectorAll('#minecodex-image-gen-content button[aria-label]')].filter(e => /\\.png$/.test(e.getAttribute('aria-label')))`;
const more = `[...document.querySelectorAll('#minecodex-image-gen-content button[aria-label="More actions"]')]`;
const menu = `document.querySelector('[role=menu]')`;
const viewPrompts = `[...document.querySelectorAll('[role=menuitem]')].find(e => e.textContent.includes('View prompts'))`;
const panel = `document.getElementById('minecodex-library-prompt')`;
// 生成提示词与原生 Images 里的云端上传属于个人内容，加轻度模糊；原生内容区是 Image Gen 区的前一个兄弟节点。
const BLUR = `(() => { const s = document.createElement("style"); s.id = "demo-blur"; s.textContent = "#minecodex-library-prompt p{filter:blur(3px)} [data-demo-blur]{filter:blur(6px)}"; document.head.append(s); document.getElementById("minecodex-image-gen-content").previousElementSibling.dataset.demoBlur = ""; })()`;
// 第 7 张卡片带有本机生成提示词；剧本按位置取，录前确认它在首屏。
const TARGET = Number(process.env.MCX_DEMO_IMAGE_INDEX ?? 6);

await shoot("images", {
  posterAt: 0.45,
  async prepare({ cdp, d, rect }) {
    await cdp.evaluate(BLUR);
    const t = await rect(tab("Images")); await d.moveTo(t.x + t.width / 2, t.y + 120, 200);
  },
  async act(ctx) {
    const { cdp, d, rect, rects, center, sleep, vh } = ctx;
    const tabs = await rect(nav);
    await d.frame([tabs], 8); await sleep(500);
    await d.click(...center(await rect(tab("Image Gen")))); await sleep(1600);
    const view = await rect(area);
    await d.frame([tabs, { ...view, height: Math.min(view.height, vh - view.y - 8) }], 8); await sleep(400);
    const all = await rects(cards); const card = all[TARGET];
    await d.moveTo(...center(card), 700); await sleep(500);
    const btn = (await rects(more))[TARGET];
    await d.click(...center(btn)); await sleep(700);
    await d.frame([card, await rect(menu)], 8);
    const item = await rect(viewPrompts);
    await d.moveTo(item.x + 60, item.y + item.height / 2, 400); await sleep(250);
    await d.click(); await sleep(1800);
    await d.frame([await rect(panel), { x: 60, y: 60, width: 900, height: 800 }], 8);
    await d.moveTo(...center(await rect(panel)), 600);
    await sleep(1600);
  },
});
// 还原：关闭提示词与详情，回到原生 Images 标签，移除模糊样式。
const cdp = await connect();
await cdp.evaluate(`document.getElementById('demo-blur')?.remove(); document.querySelector('[data-demo-blur]')?.removeAttribute('data-demo-blur')`);
const key = code => cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: code, code, windowsVirtualKeyCode: 27 }).then(() => cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: code, code, windowsVirtualKeyCode: 27 }));
await key("Escape"); await sleep(400);
await cdp.evaluate(`[...document.querySelectorAll('button[aria-label]')].find(e => e.getAttribute('aria-label') === 'Close viewer')?.click()`); await sleep(800);
await cdp.evaluate(`${tab("Images")}?.click()`); await sleep(500);
console.log("restored:", await cdp.evaluate(`${tab("Images")}?.getAttribute('aria-selected')`));
process.exit(0);
