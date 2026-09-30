import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const run = promisify(execFile);
export async function captureSitePreview(url) {
  const candidates = process.platform === "darwin" ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"] : process.platform === "win32" ? [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean).flatMap(root => [path.join(root, "Google/Chrome/Application/chrome.exe"), path.join(root, "Microsoft/Edge/Application/msedge.exe")]) : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  let browser;
  for (const candidate of candidates) { try { await access(candidate); browser = candidate; break; } catch {} }
  if (!browser) throw new Error("A Chromium browser is required for site previews.");
  const temporary = await mkdtemp(path.join(os.tmpdir(), "minecodex-site-preview-"));
  const screenshot = path.join(temporary, "preview.png");
  try {
    // 独立无界面 profile，不使用用户浏览器的登录状态或已有窗口。
    const { stdout } = await run(browser, ["--headless=new", "--dump-dom", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-extensions", "--hide-scrollbars", "--mute-audio", `--user-data-dir=${path.join(temporary, "profile")}`, "--window-size=960,600", "--timeout=8000", "--virtual-time-budget=1200", `--screenshot=${screenshot}`, url], { timeout: 12000, maxBuffer: 1024 * 1024 });
    if (/chrome-error:\/\/chromewebdata|id="main-frame-error"/.test(stdout)) throw new Error("Site could not be loaded.");
    const bytes = await readFile(screenshot);
    if (bytes.length > 2 * 1024 * 1024 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("Invalid site preview.");
    return bytes;
  } finally { await rm(temporary, { recursive: true, force: true, maxRetries: 3 }); }
}

export class SitePreviews {
  constructor(directory, capture = captureSitePreview) { this.directory = directory; this.capture = capture; this.pending = new Map(); this.results = new Map(); this.queue = Promise.resolve(); }
  async cached(url) {
    const file = path.join(this.directory, createHash("sha256").update(url).digest("hex") + ".png");
    try { return { image: `data:image/png;base64,${(await readFile(file)).toString("base64")}` }; } catch(e) { if(e.code === "ENOENT")return {image:null};throw e; }
  }
  request(url) {
    const previous = this.results.get(url);
    if (previous && (previous.image || Date.now() - previous.finishedAt < 60000)) return previous;
    if (!this.pending.has(url)) {
      this.get(url).then(result => this.results.set(url, result), () => this.results.set(url, { image: null, finishedAt: Date.now() }));
    }
    return { pending: true };
  }
  async get(url) {
    if (this.pending.has(url)) return this.pending.get(url);
    const file = path.join(this.directory, createHash("sha256").update(url).digest("hex") + ".png");
    const task = (async () => {
      try { return await readFile(file); } catch (e) { if (e.code !== "ENOENT") throw e; }
      const capture = this.queue.catch(() => {}).then(async () => {
        const bytes = await this.capture(url); await mkdir(this.directory, { recursive: true, mode: 0o700 });
        await writeFile(file, bytes, { mode: 0o600 }); await chmod(file, 0o600); return bytes;
      });
      this.queue = capture; return capture;
    })().then(bytes => ({ image: `data:image/png;base64,${bytes.toString("base64")}` })).finally(() => this.pending.delete(url));
    this.pending.set(url, task); return task;
  }
}
