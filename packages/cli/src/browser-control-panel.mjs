// 标签页枚举留在平台适配层；只匹配控制台 origin 的根页或一次性登录页。
export const CONTROL_PANEL_BROWSER_SCRIPT = `
ObjC.import('CoreServices');
function run(argv) {
  const url = argv[0], origin = argv[1];
  const bundle = ObjC.unwrap(ObjC.castRefToObject($.LSCopyDefaultHandlerForURLScheme($('http'))));
  const chromium = ['com.google.Chrome', 'com.google.Chrome.canary', 'org.chromium.Chromium', 'com.microsoft.edgemac', 'com.brave.Browser', 'com.vivaldi.Vivaldi'];
  if (bundle !== 'com.apple.Safari' && chromium.indexOf(bundle) < 0) return JSON.stringify({mode:'open', reuseSupported:false});
  const browser = Application(bundle);
  if (!browser.running()) return JSON.stringify({mode:'open', reuseSupported:true});
  try {
    const windows = browser.windows();
    for (let w = 0; w < windows.length; w++) {
      const tabs = windows[w].tabs();
      for (let t = 0; t < tabs.length; t++) {
        const candidate = tabs[t].url();
        if (candidate !== origin + '/' && candidate.indexOf(origin + '/auth?') !== 0) continue;
        if (bundle === 'com.apple.Safari') windows[w].currentTab = tabs[t];
        else windows[w].activeTabIndex = t + 1;
        windows[w].minimized = false;
        windows[w].index = 1;
        browser.activate();
        return JSON.stringify({mode:'reused', reuseSupported:true});
      }
    }
    return JSON.stringify({mode:'open', reuseSupported:true});
  } catch (error) {
    return JSON.stringify({mode:'failed', code:error.errorNumber || 0});
  }
}`;

export async function openMacControlPanel(execFile, url, origin) {
  const target = new URL(url), base = new URL(origin);
  if (target.origin !== base.origin || base.protocol !== "http:" || base.hostname !== "127.0.0.1"
      || target.pathname !== "/auth" || !target.searchParams.get("exchange")) throw new Error("Invalid control panel URL");
  let stdout;
  try { ({ stdout } = await execFile("/usr/bin/osascript", ["-l", "JavaScript", "-e", CONTROL_PANEL_BROWSER_SCRIPT, url, base.origin], { timeout:10_000 })); }
  catch { throw new Error("无法连接默认浏览器，请重试打开 MineCodex。"); }
  const result = JSON.parse(stdout);
  if (result.mode === "failed") {
    throw new Error(result.code === -1743
      ? "无法定位 MineCodex 标签页。请在系统设置的自动化权限中允许控制默认浏览器后重试。"
      : "无法定位默认浏览器中的 MineCodex 标签页，请重试。");
  }
  if (result.mode === "reused") return result;
  await execFile("/usr/bin/open", [url]);
  return { mode:"opened", reuseSupported:result.reuseSupported };
}
