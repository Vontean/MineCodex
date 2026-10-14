// 11.12 的 DB 保留网格树，但连线词法信息会丢失；从原解析器回调记录已解析的 token。
async function readMermaidBlockModel(mermaid,source,descriptions={}) {
 const seed=await mermaid.mermaidAPI.getDiagramFromText('block-beta\n__qv_seed__'),db=seed.db;
 if(!db.getBlock||!db.getEdges||!db.edgeStrToEdgeData)return {reason:'Block 数据接口不兼容'};
 const original=db.edgeStrToEdgeData,tokens=[];
 try{db.edgeStrToEdgeData=token=>{tokens.push(String(token).trim());return original(token);};await mermaid.mermaidAPI.getDiagramFromText(source);}finally{db.edgeStrToEdgeData=original;}
 const rawRoot=db.getBlock('root'),rawEdges=db.getEdges(),classes=db.getClasses();
 if(classes?.size||[...db.getBlocksFlat()].some(n=>n.classes?.length||n.styles?.length))return {reason:'Block 自定义样式保留原生语义'};
 const shapes=new Set(['square','na','round','stadium','cylinder','diamond','circle','doublecircle','hexagon','subroutine','lean_left','lean_right','trapezoid','inv_trapezoid','rect_left_inv_arrow','block_arrow']);
 let reason='',nodes=[],groups=[];
 function copy(raw,parent=null,path='root'){
  const type=raw.type==='composite'?'group':raw.type==='space'?'space':raw.type||'na',span=type==='space'?1:raw.widthInColumns??1;
  if(!Number.isInteger(span)||span<1)reason='Block 跨列宽度保留原生语义';
  if(hasRichMermaidLabel(raw.label))reason='Block 富文本保留原生语义';
  const n={id:type==='space'?'space-'+path:raw.id,name:type==='space'?'':raw.label||'',type,span,parent,description:descriptions[raw.id]||'',directions:[...raw.directions||[]]};
  if(type==='group'){
   n.columns=raw.columns??-1;n.children=(raw.children||[]).map((child,i)=>copy(child,raw.id,path+'-'+i));
   if(n.columns===0||!Number.isInteger(n.columns))reason='Block 列数保留原生语义';
   let pos=0;for(const child of n.children){if(n.columns>0&&child.span>n.columns-pos%n.columns)reason='Block 跨行溢出保留原生布局';pos+=child.span;}
   if(raw.id!=='root')groups.push(n);
  }else if(type!=='space'){
   if(!shapes.has(type)||n.directions.some(d=>!['up','down','left','right','x','y'].includes(d)))reason='Block 形状保留原生语义';
   nodes.push(n);
  }
  return n;
 }
 const tree=copy(rawRoot);if(reason)return {reason};
 if(tokens.length!==rawEdges.length)return {reason:'Block 连线接口不兼容'};
 const ids=new Set([...nodes,...groups].map(n=>n.id)),marker=c=>c==='>'||c==='<'?'point':c==='o'?'circle':c==='x'?'cross':null;
 const edges=rawEdges.map((e,i)=>({id:e.id,from:e.start,to:e.end,label:e.label||'',startMarker:marker(tokens[i][0]),endMarker:marker(tokens[i].at(-1)),dotted:tokens[i].includes('.'),thick:tokens[i].includes('='),invisible:tokens[i].includes('~')}));
 if(edges.some(e=>!ids.has(e.from)||!ids.has(e.to)||hasRichMermaidLabel(e.label)))return {reason:'Block 特殊端点或富文本保留原生语义'};
 const unknown=Object.keys(descriptions).filter(id=>!ids.has(id));if(unknown.length)throw Error('未知说明 ID：'+unknown.join('、'));
 return {data:{kind:'block',tree,nodes,groups,edges}};
}
