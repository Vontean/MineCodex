import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

export class SiteLauncher {
  constructor(probe) { this.probe = probe; this.running = new Map(); this.pending = new Map(); }
  async start(entry) {
    if (this.pending.has(entry.entryId)) return this.pending.get(entry.entryId);
    const task = this.launch(entry).finally(() => this.pending.delete(entry.entryId)); this.pending.set(entry.entryId, task); return task;
  }
  async launch(entry) {
    const existing = this.running.get(entry.entryId);
    if (existing) { try { if (await this.probe(existing.url)) return existing.url; } catch {} existing.stop(); this.running.delete(entry.entryId); }
    if (entry.framework === "static") {
      const root = await realpath(entry.directory);
      const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript", ".mjs":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".webp":"image/webp", ".woff2":"font/woff2" };
      const server = createServer(async (req,res) => {
        if (!["GET","HEAD"].includes(req.method)) { res.writeHead(405); res.end(); return; }
        try {
          const pathname = decodeURIComponent(new URL(req.url,"http://localhost").pathname);
          if (pathname.split("/").some(p => p.startsWith("."))) throw Error();
          const file = await realpath(path.join(root, pathname.endsWith("/") ? pathname + "index.html" : pathname));
          const relative = path.relative(root,file); if (relative.startsWith("..") || path.isAbsolute(relative)) throw Error();
          const bytes = await readFile(file); res.setHeader("Content-Type",types[path.extname(file)] || "application/octet-stream");res.end(req.method === "HEAD" ? undefined : bytes);
        } catch { res.writeHead(404);res.end(); }
      });
      await new Promise((resolve,reject) => { server.once("error",reject);server.listen(0,"127.0.0.1",resolve); });
      const url = `http://127.0.0.1:${server.address().port}/`; this.running.set(entry.entryId,{url,stop:()=>server.close()}); return url;
    }
    if (!["vite","next","astro"].includes(entry.framework)) throw Error("No supported start command was found for this site.");
    // 只使用已安装的框架，不安装依赖、不运行任意 package 脚本。
    const require = createRequire(path.join(entry.directory,"package.json"));
    let packageFile; try { packageFile = require.resolve(`${entry.framework}/package.json`); } catch { throw Error("Project dependencies are not installed. Install them in the project first."); }
    const pkg = JSON.parse(await readFile(packageFile,"utf8")); const relativeBin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.[entry.framework];
    if (!relativeBin) throw Error("Framework executable is unavailable.");
    const reserve = createServer(); await new Promise(r=>reserve.listen(0,"127.0.0.1",r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
    const args = entry.framework === "next" ? ["dev","--hostname","127.0.0.1","--port",String(port)] : [...(entry.framework === "astro" ? ["dev"] : []),"--host","127.0.0.1","--port",String(port),...(entry.framework === "vite" ? ["--strictPort"] : [])];
    // 有自定义参数的配方不能静默丢弃，交由项目维护者整理后再启动。
    if (!/^(vite|next\s+dev|astro\s+dev)(?:\s+--(?:host|hostname|port)\s+[\w.:-]+|\s+--(?:turbopack|strictPort))*\s*$/.test(entry.command || "")) throw Error("This site has a custom start command. Start it in the project first.");
    if (/--turbopack\b/.test(entry.command)) args.push("--turbopack");
    const child=spawn(process.execPath,[path.resolve(path.dirname(packageFile),relativeBin),...args],{cwd:entry.directory,stdio:["ignore","pipe","pipe"],env:process.env});
    let failure; child.on("error",e=>{failure=e;}); child.stdout.resume();child.stderr.resume();
    const url=`http://127.0.0.1:${port}/`; const record={url,stop:()=>child.kill("SIGTERM")};this.running.set(entry.entryId,record);
    child.once("exit",()=>{if(this.running.get(entry.entryId)===record)this.running.delete(entry.entryId);});
    try {
      const deadline=Date.now()+25000;
      while(Date.now()<deadline){if(failure)throw failure;if(child.exitCode!==null)throw Error("Website process exited before becoming ready.");try{if(await this.probe(url,{timeoutMs:1000}))return url;}catch{}await new Promise(r=>setTimeout(r,400));}
      throw Error("Website did not become ready within 25 seconds.");
    } catch(e){record.stop();this.running.delete(entry.entryId);throw e;}
  }
  stop(){for(const entry of this.running.values())entry.stop();this.running.clear();}
}
