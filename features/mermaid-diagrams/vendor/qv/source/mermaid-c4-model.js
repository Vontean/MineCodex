// 从原解析器记录声明顺序；不建立另一套 C4 语法或关系图。
async function readMermaidC4Model(mermaid,source,descriptions={}) {
 const seed=await mermaid.mermaidAPI.getDiagramFromText('C4Context\nPerson(__qv_seed__, "seed")'),db=seed.db;
 const methods=['addPersonOrSystem','addContainer','addComponent','addPersonOrSystemBoundary','addContainerBoundary','addDeploymentNode','updateElStyle','updateRelStyle'];
 if(methods.some(key=>typeof db[key]!=='function')||!db.getC4ShapeArray||!db.getBoundaries||!db.getRels)return {reason:'C4 数据接口不兼容'};
 const originals=new Map(),order=new Map();let customStyle=false,optionalFeatures=false,sequence=0;
 try {
  for(const key of methods){
   const original=db[key];originals.set(key,original);
   db[key]=function(...args){
    if(key==='updateElStyle'||key==='updateRelStyle')customStyle=true;
    else {const boundary=key==='addPersonOrSystemBoundary'||key==='addContainerBoundary',id=args[boundary?0:1];if(!order.has(id))order.set(id,sequence++);const optionalStart=boundary?3:key==='addPersonOrSystem'?4:5;if(args.slice(optionalStart).some(value=>value&&typeof value!=='object'||value&&typeof value==='object'&&Object.values(value).some(Boolean)))optionalFeatures=true;}
    return original.apply(this,args);
   };
  }
  await mermaid.mermaidAPI.getDiagramFromText(source);
 } finally {for(const [key,original]of originals)db[key]=original;}
 if(customStyle)return {reason:'C4 自定义节点或关系样式保留原生语义'};
 if(optionalFeatures)return {reason:'C4 图标、标签或链接保留原生语义'};
 const text=value=>String(value?.text??value??''),types=new Set(['person','external_person',...['system','container','component'].flatMap(base=>[base,base+'_db',base+'_queue','external_'+base,'external_'+base+'_db','external_'+base+'_queue'])]);
 const family=db.getC4Type(),shapeInRow=db.getC4ShapeInRow(),boundaryInRow=db.getC4BoundaryInRow();
 if(!['C4Context','C4Container','C4Component','C4Dynamic','C4Deployment'].includes(family))return {reason:'C4 图表类型保留原生语义'};
 if(!Number.isInteger(shapeInRow)||shapeInRow<1||!Number.isInteger(boundaryInRow)||boundaryInRow<1)return {reason:'C4 行布局保留原生语义'};
 const rawNodes=db.getC4ShapeArray(),rawGroups=db.getBoundaries().filter(n=>n.alias!=='global'),rawEdges=db.getRels();
 if([...rawNodes,...rawGroups,...rawEdges].some(n=>n.sprite||n.tags||n.link))return {reason:'C4 图标、标签或链接保留原生语义'};
 if([...rawNodes,...rawGroups,...rawEdges].some(n=>['label','techn','descr'].some(key=>hasRichMermaidLabel(text(n[key])))))return {reason:'C4 富文本保留原生语义'};
 const nodes=rawNodes.map(n=>({id:n.alias,name:text(n.label),c4Type:text(n.typeC4Shape),technology:text(n.techn),description:text(n.descr),note:descriptions[n.alias]||'',parent:n.parentBoundary==='global'?null:n.parentBoundary,order:order.get(n.alias)}));
 if(nodes.some(n=>!types.has(n.c4Type)))return {reason:'C4 特殊节点类型保留原生语义'};
 const groups=rawGroups.map(n=>({id:n.alias,name:text(n.label),c4Type:text(n.type),nodeType:n.nodeType||'',description:text(n.descr),note:descriptions[n.alias]||'',parent:n.parentBoundary==='global'?null:n.parentBoundary,order:order.get(n.alias)}));
 const ids=new Set([...nodes,...groups].map(n=>n.id)),groupIds=new Set(groups.map(n=>n.id));
 if(ids.size!==nodes.length+groups.length||[...nodes,...groups].some(n=>n.parent&&!groupIds.has(n.parent)))return {reason:'C4 边界结构保留原生语义'};
 const relationTypes=new Set(['rel','birel','rel_b','rel_u','rel_d','rel_l','rel_r']);
 const nodeIds=new Set(nodes.map(n=>n.id));
 if(rawEdges.some(e=>!relationTypes.has(e.type)||!nodeIds.has(e.from)||!nodeIds.has(e.to)))return {reason:'C4 特殊关系端点保留原生语义'};
 const edges=rawEdges.map((e,i)=>({id:'relation-'+(i+1),from:e.type==='rel_b'?e.to:e.from,to:e.type==='rel_b'?e.from:e.to,sourceFrom:e.from,sourceTo:e.to,label:text(e.label),technology:text(e.techn),description:text(e.descr),relationType:e.type,sequence:family==='C4Dynamic'?i+1:null,startMarker:e.type==='birel'?'point':null,endMarker:'point'}));
 const unknown=Object.keys(descriptions).filter(id=>!ids.has(id));if(unknown.length)throw Error('未知说明 ID：'+unknown.join('、'));
 const tree={id:'global',name:'',type:'group',children:[]},byId=new Map([['global',tree],...groups.map(n=>[n.id,{...n,type:'group',children:[]}])]);
 for(const n of [...groups,...nodes].sort((a,b)=>a.order-b.order))byId.get(n.parent||'global').children.push(byId.get(n.id)||{...n,type:'node'});
 const visiting=new Set(),visited=new Set();function check(n){if(visiting.has(n.id))return false;if(visited.has(n.id))return true;visiting.add(n.id);for(const child of n.children||[])if(!check(child))return false;visiting.delete(n.id);visited.add(n.id);return true;}
 if(!check(tree)||visited.size!==ids.size+1)return {reason:'C4 循环边界保留原生语义'};
 return {data:{kind:'c4',family,title:db.getTitle(),nodes,groups,edges,tree,shapeInRow,boundaryInRow,accessibility:{title:db.getAccTitle?.()||'',description:db.getAccDescription?.()||''}}};
}
