// 固定 Mermaid 11.12 DB；getData 的端点标记已处理 relSpec 左右命名反转。
async function readMermaidErModel(db,descriptions={}) {
 const entities=[...db.getEntities()],raw=db.getData(),cards=new Set(['only_one','zero_or_one','one_or_more','zero_or_more']);
 if(Object.keys(db.getClasses()).length||entities.some(([,n])=>n.cssStyles?.length||n.cssCompiledStyles?.length||n.cssClasses!=='default'||hasRichMermaidLabel(n.alias||n.label)||n.attributes.some(a=>[a.name,a.type,a.comment].some(hasRichMermaidLabel)))||raw.edges.some(e=>!cards.has(e.arrowTypeStart)||!cards.has(e.arrowTypeEnd)||hasRichMermaidLabel(e.label)))return {reason:'此实体关系图包含尚未适配的样式、富文本或关系标记，保留原生语义'};
 const nodes=entities.map(([id,n])=>({id,name:n.alias||n.label,technicalName:n.label,attributes:n.attributes.map(a=>({...a,keys:[...a.keys]})),description:descriptions[id]||'',shape:'er'})),ids=new Map(entities.map(([id,n])=>[n.id,id]));
 const unknown=Object.keys(descriptions).filter(id=>!nodes.some(n=>n.id===id));if(unknown.length)throw new Error('说明引用了未知实体：'+unknown.join('、'));
 return {data:{kind:'er',direction:db.getDirection()||'TB',nodes,groups:[],layers:[],edges:raw.edges.map(e=>({id:e.id,from:ids.get(e.start),to:ids.get(e.end),label:e.label||'',startCard:e.arrowTypeStart,endCard:e.arrowTypeEnd,async:e.pattern==='dashed'}))}};
}
async function prepareMermaidErLayout(data) {
 const context=document.createElement('canvas').getContext('2d'),font=getComputedStyle(document.body).fontFamily;context.font='12px '+font;const measure=s=>Math.ceil(context.measureText(s||'').width);
 const probe=document.createElement('span');probe.style.cssText='position:absolute;left:-100000px;white-space:pre-wrap;overflow-wrap:anywhere;box-sizing:border-box';document.body.append(probe);
 const height=(text,width,size=12,line=18,padding=0)=>{probe.style.width=width+'px';probe.style.font=size+'px/'+line+'px '+font;probe.style.padding=padding+'px 0';probe.textContent=text;return probe.offsetHeight;};
 for(const n of data.nodes){
  n.layoutWidth=Math.min(360,Math.max(240,measure(n.name)+32,...n.attributes.map(a=>measure(a.name)+measure(a.type)+112)));
  const available=n.layoutWidth-40,key=46,type=Math.min(90,Math.max(52,...n.attributes.map(a=>measure(a.type))));n.columns={key,name:available-key-type-16,type};
  n.headerHeight=Math.max(52,height(n.name,n.layoutWidth-32,14,20)+24)+(n.name!==n.technicalName?height(n.technicalName,n.layoutWidth-32,12,18)+4:0);
  n.attributes.forEach(a=>a.rowHeight=Math.max(30,Math.max(height(a.name,n.columns.name),height(a.type,n.columns.type),height(a.keys.join(', '),key))+12));
  // 字段区上下内边距8px、底部留白10px，以及卡片上下边框2px。
  n.layoutHeight=n.headerHeight+n.attributes.reduce((sum,a)=>sum+a.rowHeight,0)+20;
 }
 for(const e of data.edges){e.labelWidth=Math.min(180,Math.max(30,measure(e.label)+12));e.labelHeight=Math.max(22,height(e.label,e.labelWidth-12)+4);}probe.remove();
 // 自关联独占侧面端口，避免与主轴上的关系基数叠合。
 for(const e of data.edges)if(e.from===e.to)e.fromSide=e.toSide=['LR','RL'].includes(data.direction)?'SOUTH':'EAST';
 await prepareMermaidLayout(data);
}
