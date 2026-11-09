// 功能预览录制工具：经 CDP 截屏帧（带时间戳），结束后用 ffmpeg 按真实时间合成、镜头跟随裁切并加速。
// 规格见 apps/dashboard/DESIGN.md；用法见同目录 README.md。
import { mkdir, writeFile, rm } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

export const DEMO_PORT = Number(process.env.MCX_DEMO_PORT ?? 9245);
export const OUT_DIR = path.resolve(process.env.MCX_DEMO_OUT ?? "docs/verification/previews");

export async function connect(port = DEMO_PORT) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = list.find(t => t.type === "page" && /^app:\/\/-\/index\.html(#.*)?$/.test(t.url));
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const listeners = new Map();
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) { const { r, j } = pending.get(msg.id); pending.delete(msg.id); msg.error ? j(new Error(msg.error.message)) : r(msg.result); }
    else if (msg.method) for (const fn of listeners.get(msg.method) ?? []) fn(msg.params);
  };
  const send = (method, params = {}, timeout = 10000) => new Promise((r, j) => { const i = ++id; const timer = setTimeout(() => { pending.delete(i); j(new Error(`CDP timeout: ${method}`)); }, timeout); pending.set(i, { r: v => { clearTimeout(timer); r(v); }, j: e => { clearTimeout(timer); j(e); } }); ws.send(JSON.stringify({ id: i, method, params })); });
  const on = (method, fn) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(fn); };
  const evaluate = async (expression) => {
    const res = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
    return res.result.value;
  };
  // 窗口被遮挡时渲染与输入会暂停：录制前置顶并模拟焦点。
  await send("Page.enable"); await send("Page.bringToFront"); await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  return { send, on, evaluate, close: () => ws.close() };
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

// 模拟光标：页面内叠加一个 macOS 风格箭头，跟随我们发出的鼠标坐标；点击时显示涟漪。
const CURSOR_SCRIPT = `(() => {
  if (window.__demoCursor) return;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);transition:none;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35))';
  el.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2 L3 17.5 L7 13.8 L9.6 19.6 L12.3 18.4 L9.8 12.8 L15.2 12.8 Z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  document.documentElement.appendChild(el);
  window.__demoCursor = { move(x, y) { el.style.transform = 'translate(' + x + 'px,' + y + 'px)'; },
    click(x, y) { const r = document.createElement('div'); r.style.cssText = 'position:fixed;left:' + (x - 14) + 'px;top:' + (y - 14) + 'px;width:28px;height:28px;border-radius:50%;background:rgba(58,131,247,.35);z-index:2147483646;pointer-events:none;transform:scale(.4);opacity:1;transition:transform .35s ease-out,opacity .35s ease-out'; document.documentElement.appendChild(r); requestAnimationFrame(() => { r.style.transform = 'scale(1.3)'; r.style.opacity = '0'; }); setTimeout(() => r.remove(), 450); },
    remove() { el.remove(); delete window.__demoCursor; } };
})()`;

export function createDriver(cdp) {
  let pos = { x: 0, y: 0 };
  return {
    keys: [],
    // 镜头关键帧：记录此刻要框住的矩形并集（CSS 像素），编码时镜头平移过去。
    async frame(rects, pad = 10) {
      const v = rects.filter(Boolean); if (!v.length) return null;
      const x = Math.min(...v.map(r => r.x)) - pad, y = Math.min(...v.map(r => r.y)) - pad;
      const w = Math.max(...v.map(r => r.x + r.width)) + pad - x, h = Math.max(...v.map(r => r.y + r.height)) + pad - y;
      const rect = { x, y, width: w, height: h }; this.keys.push({ t: Date.now() / 1000, rect }); return rect;
    },
    async showCursor(x, y) { await cdp.evaluate(CURSOR_SCRIPT); pos = { x, y }; await cdp.evaluate(`__demoCursor.move(${x},${y})`); },
    async hideCursor() { await cdp.evaluate(`window.__demoCursor?.remove()`); },
    // ease-in-out 平滑移动，同时派发真实 mouseMoved 以触发 hover。
    async moveTo(x, y, duration = 600) {
      const from = { ...pos }; const steps = Math.max(8, Math.round(duration / 16));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps; const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const cx = from.x + (x - from.x) * e, cy = from.y + (y - from.y) * e;
        await cdp.evaluate(`__demoCursor.move(${cx},${cy})`);
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: cx, y: cy, buttons: this.down ? 1 : 0, button: this.down ? "left" : "none" });
        await sleep(duration / steps);
      }
      pos = { x, y };
    },
    async click(x, y) {
      if (x !== undefined) await this.moveTo(x, y);
      await cdp.evaluate(`__demoCursor.click(${pos.x},${pos.y})`);
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pos.x, y: pos.y, button: "left", clickCount: 1 });
      await sleep(60);
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pos.x, y: pos.y, button: "left", clickCount: 1 });
    },
    async press() { this.down = true; await cdp.evaluate(`__demoCursor.click(${pos.x},${pos.y})`); await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pos.x, y: pos.y, button: "left", clickCount: 1 }); },
    async release() { this.down = false; await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pos.x, y: pos.y, button: "left", clickCount: 1 }); },
    async rect(selectorExpr) {
      return cdp.evaluate(`(() => { const el = ${selectorExpr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
    },
  };
}

// 录制：Page.startScreencast 收集帧（CSS 像素 × DPR），stop 后按时间戳写 concat 列表交给 ffmpeg。
export async function startRecording(cdp, dir) {
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const frames = []; let dpr = 1;
  dpr = await cdp.evaluate("window.devicePixelRatio");
  cdp.on("Page.screencastFrame", async ({ data, sessionId, metadata }) => {
    const file = path.resolve(dir, `f${String(frames.length).padStart(5, "0")}.jpg`);
    frames.push({ file, t: metadata.timestamp });
    writeFile(file, Buffer.from(data, "base64"));
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1 });
  return {
    // 截屏只在画面变化时出帧：记录停止时刻，让末尾静止画面保留真实停留时长。
    async stop() { const end = Date.now() / 1000; await cdp.send("Page.stopScreencast"); await sleep(300); return { frames, dpr, end }; },
  };
}

// 镜头跟随：固定 4:3 裁切框，中心在每个聚光关键帧之间以 smoothstep 平移（D 秒）。
export function encodeCamera({ frames, dpr, end }, { keys, vw, vh, out, ratio = 4 / 3, pad = 28, width = 720, tailHold, poster, D = 0.4, speed = 2 }) {
  const t0 = frames[0].t;
  tailHold ??= Math.max(0.3, end ? end - frames.at(-1).t : 1.2);
  const fitted = keys.map(k => ({ t: Math.max(0, k.t - t0), r: { x: k.rect.x - pad, y: k.rect.y - pad, width: k.rect.width + 2 * pad, height: k.rect.height + 2 * pad } }));
  let W = Math.max(...fitted.map(k => Math.max(k.r.width, k.r.height * ratio))); W = Math.min(W, vw, vh * ratio); const H = W / ratio;
  const centers = fitted.map(k => {
    const cx = Math.min(Math.max(k.r.x + k.r.width / 2, W / 2), vw - W / 2), cy = Math.min(Math.max(k.r.y + k.r.height / 2, H / 2), vh - H / 2);
    return { t: k.t, x: cx - W / 2, y: cy - H / 2 };
  });
  const expr = axis => {
    let e = `${(centers[0][axis] * dpr).toFixed(1)}`;
    for (let i = 1; i < centers.length; i++) {
      const dv = (centers[i][axis] - centers[i - 1][axis]) * dpr; if (Math.abs(dv) < 0.5) continue;
      const S = `clip((t-${centers[i].t.toFixed(3)})/${D},0,1)`;
      e += `+(${dv.toFixed(1)})*${S}*${S}*(3-2*${S})`;
    }
    return e;
  };
  const list = frames.map((f, i) => { const n = frames[i + 1]; return `file '${f.file}'\nduration ${(n ? Math.max(0.016, n.t - f.t) : tailHold).toFixed(3)}`; }).join("\n") + `\nfile '${frames.at(-1).file}'\n`;
  writeFileSync(out + ".txt", list);
  // 镜头表达式基于原始时间轴，所以先裁切再整体加速。
  const vf = `fps=60,crop=${Math.round(W * dpr)}:${Math.round(H * dpr)}:'${expr("x")}':'${expr("y")}',scale=${width}:-2:flags=lanczos:out_range=tv,format=yuv420p,setpts=PTS/${speed},fps=30`;
  const run = args => { const r = spawnSync("ffmpeg", args, { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-1200)); };
  run(["-y", "-f", "concat", "-safe", "0", "-i", out + ".txt", "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-profile:v", "high", "-color_range", "tv", "-movflags", "+faststart", "-an", out]);
  if (poster) run(["-y", "-ss", String(poster.at), "-i", out, "-frames:v", "1", "-q:v", "3", poster.out]);
  return { W, H, keys: centers };
}

// 一次录制的公共流程：prepare 不录，act 录制；结束后按镜头关键帧编码到 OUT_DIR/<name>.mp4 与封面 .jpg。
export async function shoot(name, { prepare, act, posterAt = 0.5, pad = 28 }) {
  const { mkdirSync } = await import("node:fs");
  mkdirSync(OUT_DIR, { recursive: true });
  const cdp = await connect(); const d = createDriver(cdp);
  const vw = await cdp.evaluate("innerWidth"), vh = await cdp.evaluate("innerHeight");
  await d.showCursor(vw * 0.6, vh * 0.6);
  const ctx = { cdp, d, vw, vh, sleep,
    rect: expr => d.rect(expr),
    rects: expr => cdp.evaluate(`(${expr}).map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })`),
    center: r => [r.x + r.width / 2, r.y + r.height / 2],
    key: (code, key, modifiers = 0, vk = 0) => cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers, windowsVirtualKeyCode: vk }).then(() => cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers, windowsVirtualKeyCode: vk })),
    type: text => cdp.send("Input.insertText", { text }),
  };
  if (prepare) await prepare(ctx);
  d.keys.length = 0;
  const rec = await startRecording(cdp, path.join(OUT_DIR, `frames-${name}`));
  await sleep(300);
  await act(ctx);
  const result = await rec.stop();
  await d.hideCursor();
  const dur = (result.end - result.frames[0].t) / 2;
  const cam = encodeCamera(result, { keys: d.keys, vw, vh, pad, out: path.join(OUT_DIR, `${name}.mp4`), poster: { at: Math.min(posterAt * dur, dur - 0.1), out: path.join(OUT_DIR, `${name}.jpg`) } });
  console.log(name, "frames", result.frames.length, "camera", Math.round(cam.W) + "x" + Math.round(cam.H), "≈", dur.toFixed(1) + "s");
  return ctx;
}
