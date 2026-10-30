import { findCodexModule } from '../../../../../packages/codex-adapter/src/renderer/modules.mjs';
// 从原生调用关系解析角色；构建哈希和压缩变量名不作为契约。
export function discoverThreadBindings(source) {
  const requireMatch = (pattern, text = source) => {
    const value = text.match(pattern)?.[1];
    if (!value) throw new Error("Native task notification contract changed");
    return value;
  };
  const rowStart = source.lastIndexOf("function ", source.indexOf("codex.localTaskRow.needsInput"));
  const row = source.slice(rowStart, source.indexOf("var ", rowStart));
  const attentionValue = requireMatch(/([\w$]+)===`approval`\|\|[\w$]+\?\{id:`awaiting-approval`/, row);
  const statusValue = requireMatch(/[;,][\w$]+=([\w$]+);\([\w$]+===`response`/, row);
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const selectorFor = local => requireMatch(new RegExp(`${escape(local)}=[\\w$]+\\(([\\w$]+),`),row);
  const resolutionValue = requireMatch(/([\w$]+)\?\.requestId===[\w$]+\.userInputRequestId/, row);
  const pendingValue = requireMatch(/=([\w$]+)\?\.pendingRequest/, row);
  const durationName = requireMatch(/durationMs:([\w$]+)/, row);
  const durationMs = Number(requireMatch(new RegExp(`${escape(durationName)}=([0-9.eE+]+)`)));
  const previewIndex=source.search(/\.type===`agentMessage`/);
  const preview=source.slice(source.lastIndexOf("=>{",previewIndex),source.indexOf("return null})",previewIndex));
  const previewHelper=requireMatch(/let [\w$]+=([\w$]+)\([\w$]+\.text\)/,preview);
  const roles = {
    activityTurns:requireMatch(/let [\w$]+=[\w$]+\(([\w$]+),[\w$]+\);if\([\w$]+==null\)return null;for/,preview),
    previewText:requireMatch(new RegExp(`function ${escape(previewHelper)}\\([\\w$]+\\)\\{let [\\w$]+=([\\w$]+)\\(`)),
    title:requireMatch(/=[\w$]+\(([\w$]+),\{hostId:[^}]+,threadId:[\w$]+\}\)\?\?[\w$]+\?\.title/,row),
    resolution: selectorFor(resolutionValue),
    pending: selectorFor(pendingValue),
    catalog: requireMatch(/allSidebarThreadKeys:[\w$]+,pinnedThreadKeys:[\w$]+\}=[\w$]+\(([\w$]+)\)/),
    thread: requireMatch(/let [\w$]+=[\w$]+\(([\w$]+),[\w$]+\);return [\w$]+==null\?\[\]:\[\{task:/),
    projects: requireMatch(/([\w$]+)=[\w$]+\([\w$]+,\([\w$]+,\{get:[\w$]+,scope:[\w$]+\}\)=>\{let [\w$]+=[\w$]+!==`chatgpt`/),
    attention: selectorFor(attentionValue),
    status: selectorFor(statusValue),
    unread: requireMatch(/let [\w$]+=[\w$]+\(([\w$]+),[\w$]+\),[\w$]+=[\w$]+\.roomId/,row),
    navigate: requireMatch(/\.navigate\([\w$]+\([\w$]+\)\):([\w$]+)\(/,row),
  };
  const exports = source.slice(source.lastIndexOf("export{"));
  return {countdownDuration:{value:durationMs}, ...Object.fromEntries(Object.entries(roles).map(([role,local]) => {
    const name = exports.match(new RegExp(`(?:\\{|,)${escape(local)} as ([\\w$]+)(?:,|\\})`))?.[1];
    if (name) return [role,{name}];
    for (const match of source.matchAll(/import\{([^}]+)\}from["']([^"']+)["']/g)) {
      const binding=match[1].split(",").map(s=>s.trim().split(/\s+as\s+/)).find(parts=>parts.at(-1)===local);
      if (binding) return [role,{name:binding[0],file:match[2]}];
    }
    throw new Error(`Native task notification role unavailable: ${role}`);
  }))};
}

export async function loadThreadBindings() {
  const url=await findCodexModule('app-initial');
  if (!url) throw new Error("Native task notification module unavailable");
  const source=await (await fetch(url)).text();
  const bindings=discoverThreadBindings(source);
  return Object.fromEntries(await Promise.all(Object.entries(bindings).map(async ([role,binding])=>{
    if ("value" in binding) return [role,binding.value];
    const value=(await import(binding.file ? new URL(binding.file,url).href : url))[binding.name];
    if (value == null) throw new Error(`Native task notification role unavailable: ${role}`);
    return [role,value];
  })));
}
