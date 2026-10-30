// 新版将文件树和目录读取合入入口；仍按调用角色绑定，不执行无关初始化器。
export async function loadInlineFileNavigationModules(initialUrl, mainUrl, read, load) {
  const [source,main]=await Promise.all([read(initialUrl),read(mainUrl)]);
  const aliases=text=>new Map([...text.slice(text.lastIndexOf('export{')+7).split('}')[0].split(',')]
    .map(entry=>{const [local,alias=local]=entry.trim().split(/\s+as\s+/);return [local,alias];}));
  const imports=(text,url)=>new Map([...text.matchAll(/import\{([^}]+)\}from["']([^"']+)["']/g)]
    .flatMap(match=>match[1].split(',').map(entry=>{const parts=entry.trim().split(/\s+as\s+/);return [parts.at(-1),{name:parts[0],url:new URL(match[2],url).href}];})));
  const exported=aliases(source),dependencies=imports(source,initialUrl),module=await load(initialUrl);
  const binding=async local=>{
    if (exported.has(local)) return module[exported.get(local)];
    const value=dependencies.get(local);
    if(!value)throw new Error('file-navigation-inline-dependency-unavailable');
    return (await load(value.url))[value.name];
  };
  const functions=[...source.matchAll(/function ([\w$]+)\(/g)];
  const bodies=functions.map((match,index)=>({name:match[1],body:source.slice(match.index,functions[index+1]?.index??source.length)}));
  const trees=bodies.filter(({name,body})=>exported.has(name)&&/contextMenuEnabled:/.test(body)&&/initialExpandedPaths:/.test(body)&&/onSelectionChange:/.test(body));
  if(trees.length!==1)throw new Error('file-navigation-inline-tree-unavailable');
  const tree=trees[0],cache=tree.body.match(/\(0,([\w$]+)\.c\)/)?.[1];
  if(cache) {
    const assignment=source.indexOf(`${cache}=`),before=source.slice(source.lastIndexOf('function ',assignment),assignment);
    const initializer=before.match(/^function ([\w$]+)\(\)\{return\(\1=/)?.[1];
    if(!initializer || typeof await binding(initializer)!=='function')throw new Error('file-navigation-inline-initializer-unavailable');
    (await binding(initializer))();
  }
  const Tree=await binding(tree.name);
  const reactOwner=tree.body.match(/\(0,([\w$]+)\.useState\)/)?.[1];
  const reactFactory=reactOwner && source.match(new RegExp(`${reactOwner.replace(/\$/g,'\\$')}=([\\w$]+)\\(\\)`))?.[1];
  const rootOwner=main.match(/\(0,([\w$]+)\.createRoot\)/)?.[1];
  const rootFactory=rootOwner && main.match(new RegExp(`${rootOwner.replace(/\$/g,'\\$')}=([\\w$]+)\\(\\)`))?.[1];
  const rootImport=imports(main,mainUrl).get(rootFactory);
  if(!rootImport || !reactFactory)throw new Error('file-navigation-inline-react-unavailable');
  const React=(await binding(reactFactory))(),ReactDOM=(await load(rootImport.url))[rootImport.name]();
  const requests=bodies.filter(({body})=>body.includes('.workspaceFiles')&&body.includes('.listDirectory(')&&body.includes('.throwIfAborted('));
  if(requests.length!==1)throw new Error('file-navigation-inline-directory-unavailable');
  const requestBody=requests[0].body;
  const host=requestBody.match(/let [\w$]+=([\w$]+)\.workspaceFiles/)?.[1];
  const cancellable=requestBody.match(/return ([\w$]+)\([\w$]+\.listDirectory\(/)?.[1];
  const bridge=await binding(host),withSignal=await binding(cancellable);
  if(typeof bridge?.workspaceFiles?.listDirectory!=='function'||typeof withSignal!=='function')throw new Error('file-navigation-inline-directory-unavailable');
  const request=(_method,{params,signal})=>{signal?.throwIfAborted();return withSignal(bridge.workspaceFiles.listDirectory(params),signal);};
  const sharedUrl=[...dependencies.values()].find(value=>/\/app-shared-/.test(value.url))?.url;
  if(!sharedUrl)throw new Error('file-navigation-inline-icons-unavailable');
  const sharedSource=await read(sharedUrl),shared=await load(sharedUrl),sharedExports=aliases(sharedSource);
  const folderAt=sharedSource.indexOf('name:`folder-light-16`'),prefix=sharedSource.slice(sharedSource.lastIndexOf('function ',folderAt),folderAt);
  const folderInit=prefix.match(/^function ([\w$]+)\(\)\{return\(\1=/)?.[1];
  if(folderAt<0||typeof shared[sharedExports.get(folderInit)]!=='function')throw new Error('file-navigation-folder-icon-unavailable');
  shared[sharedExports.get(folderInit)]();
  const folder=Object.values(shared).find(value=>value?.name==='folder-light-16');
  if(typeof Tree!=='function')throw new Error('file-navigation-inline-tree-unavailable');
  if(!React?.createElement||!ReactDOM?.createRoot)throw new Error('file-navigation-inline-react-unavailable');
  if(!folder?.canvas?.viewBox||typeof folder.body!=='string')throw new Error('file-navigation-folder-icon-unavailable');
  return {Tree,React,ReactDOM,request,folder};
}
