// Markdown 共用原生角色；只沿已注册模块与原生 lazy 声明绑定依赖。
export async function loadRspackMarkdownToc(registry) {
  if (!registry.entries.some(entry=>entry.source.includes('data-heading-preview'))) {
    const page=registry.module(source=>source.includes(').PageEditorContent'),'Pages content loader');
    await registry.lazy(page,'PageEditorContent');
  }
  const owner=registry.module(source=>source.includes('data-heading-preview')&&source.includes('page-table-of-contents'),'Pages table of contents');
  const body=marker=>{
    const at=owner.source.indexOf(marker),start=owner.source.lastIndexOf('function ',at);
    const end=owner.source.indexOf('}function ',at);
    if(at<0||start<0)throw new Error('native-page-toc-component-unavailable');
    return owner.source.slice(start,end<0?owner.source.length:end+1);
  };
  const requireMatch=(source,pattern)=>{
    const match=source.match(pattern);
    if(!match)throw new Error('native-page-toc-contract-changed');
    return match[1];
  };
  const rail=body('"data-floating-navigation-rail-list"'),list=body('"data-heading-preview"');
  const React=registry.binding(owner,requireMatch(rail,/\(0,([\w$]+)\.useState\)/));
  const roots=[...new Set(registry.entries.filter(entry=>/\.createRoot=/.test(entry.source)).map(entry=>registry.exports(entry)).filter(value=>typeof value.createRoot==='function'))];
  if(roots.length!==1)throw new Error('native-markdown-react-root-unavailable');
  const marker=requireMatch(rail,/\.jsx\)\(([\w$]+\.[\w$]+),\{hierarchyLevel:/);
  const layout=registry.binding(owner,marker.split('.')[0]);
  const panels=Object.values(layout).filter(value=>typeof value==='function'&&registry.sourceOf(value).includes('shadow-xl-spread'));
  if(panels.length!==1)throw new Error('native-page-toc-panel-unavailable');
  const tooltip=requireMatch(owner.source,/\.jsx\)\(([\w$]+\.[\w$]+),\{align:"center",delayOpen:!0,interactive:!0,side:"right",sideOffset:0,skipDelayKey:"page-table-of-contents"/);
  const indent=requireMatch(list,/"block",([\w$]+)\[e\.level\]/);
  const array=requireMatch(owner.source,new RegExp(`(?:^|[^\\w$])${indent}=(\\[[^\\]]+\\])`));
  if(!/^\[(?:void 0|"ms-\d+"|,)+\]$/.test(array))throw new Error('native-page-toc-indent-unavailable');
  return {React,ReactDOM:roots[0],Marker:registry.binding(owner,marker),Panel:panels[0],Tooltip:registry.binding(owner,tooltip),
    classes:{
      rail:requireMatch(rail,/ref:[\w$]+,className:"([^"]+)","data-floating-navigation-rail-list"/),
      railButton:requireMatch(rail,/className:"([^"]+)","aria-current"/),
      menu:requireMatch(list,/ref:[\w$]+,className:"([^"]+)",variant:"viewer"/),
      menuButton:requireMatch(list,/className:\(0,[\w$]+\.[\w$]+\)\("([^"]+)"/),
      nav:requireMatch(body('skipDelayKey:"page-table-of-contents"'),/\.jsx\)\("nav",\{"aria-label":[\w$]+,className:"([^"]+)"/),
    },indentation:array.slice(1,-1).split(',').map(value=>value==='void 0'?'':value.slice(1,-1))};
}

export function loadRspackMarkdownRenderer(registry) {
  const owner=registry.module((source,entry)=>/\{getDefaultComponents:[\w$]+,\.\.\./.test(source)&&Object.values(registry.exports(entry)).some(value=>typeof value==='function'&&/\{getDefaultComponents:[\w$]+,\.\.\./.test(registry.sourceOf(value))),'Markdown component');
  const Markdown=registry.value(owner,(value,source)=>typeof value==='function'&&source.includes('getDefaultComponents:'),'Markdown renderer');
  const parser=registry.module(source=>/tokens:\(0,[\w$]+\.[\w$]+\)\([\w$]+,void 0\)/.test(source),'Markdown token parser');
  const ref=parser.source.match(/tokens:\(0,([\w$]+\.[\w$]+)\)\([\w$]+,void 0\)/)[1];
  const lexer=registry.binding(parser,ref);
  if(typeof lexer!=='function')throw new Error('native-markdown-lexer-unavailable');
  return {Markdown,lexer};
}

export function loadRspackMarkdownTableActions(registry,native) {
  const owner=registry.module(source=>source.includes('id:"markdown.expandTable"'),'Markdown table controls');
  const bind=pattern=>{
    const ref=owner.source.match(pattern)?.[1];
    if(!ref)throw new Error('native-table-actions-contract-changed');
    return registry.binding(owner,ref);
  };
  const actions=registry.module(source=>source.includes('"data-block-actions":!0'),'block action bar');
  const Actions=registry.value(actions,(value,source)=>typeof value==='function'&&source.includes('data-block-actions'),'block action bar');
  const code=registry.module((source,entry)=>source.includes('id:"codeSnippet.wrap.disable"')&&Object.values(registry.exports(entry)).some(value=>typeof value==='function'&&registry.sourceOf(value).includes('id:"codeSnippet.wrap.disable"')),'code wrap controls');
  const pair=code.source.match(/\?\(0,[\w$]+\.jsx\)\(([\w$]+\.[\w$]+),\{\}\):\(0,[\w$]+\.jsx\)\(([\w$]+\.[\w$]+),\{\}\)/);
  if(!pair)throw new Error('native-code-wrap-icons-unavailable');
  const icon=owner.source.match(/children:\(0,[\w$]+\.jsx\)\(([\w$]+\.[\w$]+),\{icon:\{16:([\w$]+\.[\w$]+),20:([\w$]+\.[\w$]+)\}\}\)/);
  if(!icon)throw new Error('native-table-expand-icon-unavailable');
  const [Icon,small,medium]=icon.slice(1).map(ref=>registry.binding(owner,ref));
  return {...native,...loadRspackMarkdownRenderer(registry),rspack:registry,Actions,
    Button:bind(/\.jsx\)\(([\w$]+\.[\w$]+),\{"aria-label":[\w$]+,"aria-expanded"/),
    CopyButton:bind(/\.jsx\)\(([\w$]+\.[\w$]+),\{ariaLabel:[\w$]+,buttonText:/),
    TablePreview:bind(/\.jsx\)\(([\w$]+\.[\w$]+),\{src:"",alt:/),
    Table:bind(/\.jsx\)\(([\w$]+\.[\w$]+),\{className:[\w$]+,children:[\w$]+\}/),
    tableClasses:bind(/([\w$]+\.[\w$]+)\.MarkdownTablePreview/),
    ExpandIcon:()=>native.React.createElement(Icon,{icon:{16:small,20:medium}}),
    wrapIcons:{disable:registry.binding(code,pair[1]),enable:registry.binding(code,pair[2])},
  };
}
