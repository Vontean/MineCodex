// 唯一的 Library 构建产物协议；调用方只消费命名操作。
export function createLibraryApi({read:readSource=async url=>(await fetch(url)).text(),load:loadModule=url=>import(url)} = {}) {
  let capability=null, downloadCapability=null;
  async function connect() {
    if (!capability) capability=(async()=>{
      const initialUrl = [...document.querySelectorAll('link[rel="modulepreload"],script[src]')]
        .map(element => element.href || element.src).find(url => /\/app-initial-[^/]+\.js/.test(url));
      if (!initialUrl) throw new Error("Cloud Library is unavailable in this Codex version");
      const initialSource = await readSource(initialUrl);
      const asset = name => {
        const file = initialSource.match(new RegExp(`${name}-[\\w-]+\\.js`))?.[0];
        if (!file) throw new Error(`Cloud Library capability ${name} is unavailable`);
        return new URL(file, initialUrl).href;
      };
      const metadataUrl = asset("library-file-metadata");
      const metadataSource = await readSource(metadataUrl);
      const apiLocal = metadataSource.match(/([\w$]+)\.safePost\(`\/files\/library`/)?.[1];
      const importBlock = [...metadataSource.matchAll(/import\{([^}]+)\}from["']([^"']+)["']/g)].find(match => match[1].split(",").some(binding=>binding.trim().split(/\s+as\s+/).at(-1)===apiLocal));
      const apiExport = importBlock?.[1].split(",").map(s => s.trim().split(/\s+as\s+/)).find(parts => parts.at(-1) === apiLocal)?.[0];
      if (!apiExport) throw new Error("Cloud Library API contract changed");
      const metadataInit = metadataSource.match(/function ([\w$]+)\(\)\{return\(\1=/)?.[1];
      const metadataExports = metadataSource.match(/export\{([^}]+)\}/)?.[1].split(",").map(s => s.trim().split(/\s+as\s+/)) ?? [];
      const initExport = metadataExports.find(parts => parts[0] === metadataInit)?.at(-1);
      const metadata = await loadModule(metadataUrl);
      if (typeof metadata[initExport] !== "function") throw new Error("Cloud Library initialization contract changed");
      metadata[initExport]();
      const api = (await loadModule(new URL(importBlock[2],metadataUrl).href))[apiExport];
      if (!api?.safeGet || !api?.safePost) throw new Error("Cloud Library API is not ready");
      return {api,asset};
    })().catch(error=>{capability=null;throw error;});
    return capability;
  }
  async function download(file,signal) {
    if (!downloadCapability) downloadCapability=(async()=>{
      const {asset}=await connect();
      const downloadUrl = asset("library-file-download");
      const downloadSource = await readSource(downloadUrl);
      const exports = downloadSource.match(/export\{([^}]+)\}/)?.[1].split(",").map(s => s.trim().split(/\s+as\s+/)) ?? [];
      const responseLocal = downloadSource.match(/async function ([\w$]+)\([^)]*\)\{return [\w$]+\(await [\w$]+\([^;]+showInline:!0/)?.[1];
      const initLocal = downloadSource.match(/function ([\w$]+)\(\)\{return\(\1=/)?.[1];
      const exported = local => exports.find(parts => parts[0] === local)?.at(-1);
      const download = await loadModule(downloadUrl);
      const initialize = download[exported(initLocal)], response = download[exported(responseLocal)];
      if (typeof initialize !== "function" || typeof response !== "function") throw new Error("Cloud image download contract changed");
      initialize();
      return response;
    })().catch(error=>{downloadCapability=null;throw error;});
    return (await downloadCapability)(file,signal);
  }
  return {
    conversation:async(id,signal)=>(await connect()).api.safeGet("/conversation/{conversation_id}",{parameters:{path:{conversation_id:id}},signal}),
    list:async(cursor,signal)=>(await connect()).api.safePost("/files/library",{requestBody:{limit:50,cursor:cursor ?? null,include_hidden_files:false,include_saved_entities:true},signal}),
    download,
  };
}
