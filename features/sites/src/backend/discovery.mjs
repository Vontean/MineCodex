import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export function parseListeners(output) {
  let pid, command;
  const entries = new Map();
  for (const line of output.split("\n")) {
    if (line[0] === "p") pid = Number(line.slice(1));
    if (line[0] === "c") command = line.slice(1);
    if (line[0] !== "n" || !pid) continue;
    const port = Number(line.match(/:(\d+)$/)?.[1]);
    if (!port) continue;
    const address = line.slice(1, line.lastIndexOf(":"));
    // 只访问归属于项目的本机监听地址，不探测局域网。
    if (!["*", "0.0.0.0", "127.0.0.1", "[::]", "[::1]"].includes(address)) continue;
    const host = address === "[::1]" ? "[::1]" : "127.0.0.1";
    entries.set(`${pid}:${port}`, { pid, command, port, url: `http://${host}:${port}/` });
  }
  return [...entries.values()];
}

export async function probePage(url, { fetchImpl = fetch, timeoutMs = 1400 } = {}) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "manual", headers: { Accept: "text/html" } });
  // 自动发现不跟随跳转，以免一次本机检查变成任意网络访问。
  if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(response.headers.get("content-type") ?? "")) { await response.body?.cancel(); return null; }
  const reader = response.body?.getReader();
  if (!reader) return null;
  let text = "", bytes = 0;
  const decoder = new TextDecoder();
  try {
    while (bytes < 65536) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      text += decoder.decode(value.slice(0, Math.max(0, 65536 - (bytes - value.byteLength))), { stream: true });
    }
  } finally { await reader.cancel(); }
  if (!/<(?:!doctype\s+html|html|head|body|title|div|main)\b/i.test(text)) return null;
  const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")?.trim().slice(0, 160);
  return { title: title || new URL(url).host };
}

export async function localListeners({ platform = process.platform, runImpl = run } = {}) {
  if (platform === "win32") {
    // Windows 不公开进程 cwd；仅采用命令行中可确认的项目绝对路径。
    const script = '$p=@{}; Get-CimInstance Win32_Process | ForEach-Object {$p[[int]$_.ProcessId]=$_.CommandLine}; @(Get-NetTCPConnection -State Listen | ForEach-Object { [pscustomobject]@{pid=$_.OwningProcess;address=$_.LocalAddress;port=$_.LocalPort;command=$p[[int]$_.OwningProcess]} }) | ConvertTo-Json -Compress';
    const { stdout } = await runImpl("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { timeout: 4000, maxBuffer: 2 * 1024 * 1024 });
    return [].concat(JSON.parse(stdout || "[]")).filter(e => ["::", "::1", "0.0.0.0", "127.0.0.1"].includes(e.address)).map(e => ({ ...e, url: `http://${e.address === "::1" ? "[::1]" : "127.0.0.1"}:${e.port}/` }));
  }
  let stdout;
  try { ({ stdout } = await runImpl("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpcn"], { timeout: 4000, maxBuffer: 2 * 1024 * 1024 })); }
  catch (error) { if (error.code === 1 && !error.stdout) return []; throw error; }
  const entries = parseListeners(stdout);
  if (!entries.length) return [];
  const pids = [...new Set(entries.map(e => e.pid))].join(",");
  const [result, processInfo] = await Promise.all([
    runImpl("lsof", ["-a", "-p", pids, "-d", "cwd", "-Fn"], { timeout: 4000, maxBuffer: 2 * 1024 * 1024 }),
    runImpl("ps", ["-ww", "-p", pids, "-o", "pid=,args="], { timeout: 2000, maxBuffer: 2 * 1024 * 1024 }),
  ].map(task => task.catch(error => {
    // 服务可在两次枚举之间退出，保留仍存活进程的输出。
    if (error.code === 1) return { stdout: error.stdout || "" };
    throw error;
  })));
  const commands = new Map(processInfo.stdout.split("\n").flatMap(line => {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    return match ? [[Number(match[1]), match[2]]] : [];
  }));
  let pid; const cwd = new Map();
  for (const line of result.stdout.split("\n")) { if (line[0] === "p") pid = Number(line.slice(1)); if (line[0] === "n") cwd.set(pid, line.slice(1)); }
  return entries.map(e => ({ ...e, command: commands.get(e.pid) || "", cwd: cwd.get(e.pid) }));
}
