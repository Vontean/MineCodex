// Mermaid 11.12 成员已拆分属性/方法，并给出可见性和分类符，不再解析源码签名。
async function readMermaidClassModel(db,descriptions={}) {
 const classes=[...db.getClasses()],raw=db.getData(),marks=new Set(['none','extension','composition','aggregation','dependency']);
 if(db.getNotes().length||db.styleClasses?.size||classes.some(([,n])=>n.styles?.length||n.cssClasses!=='default'||n.link||n.haveCallback||hasRichMermaidLabel(n.label)||[...n.members,...n.methods].some(a=>[a.id,a.parameters,a.returnType].some(hasRichMermaidLabel)))||raw.edges.some(e=>!marks.has(e.arrowTypeStart)||!marks.has(e.arrowTypeEnd)||hasRichMermaidLabel(e.label)))return {reason:'此类图包含尚未适配的注释、棒棒糖接口、链接、回调、富文本或自定义样式，保留原生语义'};
 const members=(list,kind)=>list.map(a=>({name:a.getDisplayDetails().displayText,kind,visibility:a.visibility,classifier:a.classifier}));
 const nodes=classes.map(([id,n])=>({id,name:(n.label||id)+(n.type?'<'+n.type+'>':''),technicalName:id,parent:n.parent||undefined,annotations:[...n.annotations],members:members(n.members,'attribute'),methods:members(n.methods,'method'),description:descriptions[id]||'',shape:'class'}));
 const groups=raw.nodes.filter(n=>n.isGroup).map(n=>({id:n.id,name:n.label||n.id,parent:n.parentId||undefined}));
 const unknown=Object.keys(descriptions).filter(id=>![...nodes,...groups].some(n=>n.id===id));if(unknown.length)throw new Error('说明引用了未知类或命名空间：'+unknown.join('、'));
 return {data:{kind:'class',direction:db.getDirection()||'TB',nodes,groups,layers:[],edges:raw.edges.map(e=>({id:e.id,from:e.start,to:e.end,label:e.label||'',startMark:e.arrowTypeStart,endMark:e.arrowTypeEnd,startMultiplicity:e.startLabelRight||'',endMultiplicity:e.endLabelLeft||'',async:e.pattern==='dashed'}))}};
}
async function prepareMermaidClassLayout(data) {
 const measure=document.createElement('div');measure.style.cssText='position:absolute;left:-100000px;visibility:hidden;white-space:pre-wrap;overflow-wrap:anywhere;box-sizing:border-box';document.body.append(measure);
 const height=(text,width,font,padding)=>{measure.style.width=width+'px';measure.style.font=font;measure.style.padding=padding;measure.textContent=text;return measure.offsetHeight;};
 const mono='ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',context=document.createElement('canvas').getContext('2d');context.font='12px '+mono;
 for(const n of data.nodes){
  n.layoutWidth=Math.max(240,Math.min(320,Math.max(context.measureText(n.name).width,...[...n.members,...n.methods].map(a=>context.measureText(a.name).width))+32));n.headerHeight=Math.max(52,height(n.name,n.layoutWidth,'600 14px/22px '+getComputedStyle(document.body).fontFamily,'14px 16px'))+(n.annotations.length?24:0);
  n.descriptionHeight=n.description?height(n.description,n.layoutWidth-20,'12px/18px '+getComputedStyle(document.body).fontFamily,'8px 10px')+8:0;
  for(const a of [...n.members,...n.methods])a.rowHeight=Math.max(30,height(a.name,n.layoutWidth-20,'12px/20px '+mono,'5px 10px'));
  n.layoutHeight=n.headerHeight+n.descriptionHeight+[n.members,n.methods].reduce((h,list)=>h+(list.length?44+list.reduce((sum,a)=>sum+a.rowHeight,0):0),0)+10;
 }
 context.font='12px '+getComputedStyle(document.body).fontFamily;for(const e of data.edges){e.labelWidth=Math.max(30,Math.min(180,context.measureText(e.label||'连接').width+12));e.labelHeight=height(e.label||'连接',e.labelWidth,'12px/18px '+getComputedStyle(document.body).fontFamily,'2px 6px');}
 measure.remove();
 for(const e of data.edges)if(e.from===e.to)e.fromSide=e.toSide=['LR','RL'].includes(data.direction)?'SOUTH':'EAST';
 await prepareMermaidLayout(data);
 // 类图同样只在大量节点且明显长条时比较另一方向，不强制普通图趋近正方形。
 if(data.nodes.length>=16&&Math.max(data.layout.width,data.layout.height)>=2400&&Math.max(data.layout.width/data.layout.height,data.layout.height/data.layout.width)>=3){
  const initial=structuredClone(data),ratio=d=>Math.abs(Math.log(d.layout.width/d.layout.height));data.direction=['LR','RL'].includes(data.direction)?'TB':'LR';
  for(const e of data.edges)if(e.from===e.to)e.fromSide=e.toSide=['LR','RL'].includes(data.direction)?'SOUTH':'EAST';
  await prepareMermaidLayout(data);if(ratio(data)>=ratio(initial)||data.layout.width*data.layout.height>initial.layout.width*initial.layout.height*1.3)Object.assign(data,initial);
 }

 // 自关联单独留出阅读通道，保留源端点及 UML 方向。
 const map=new Map(data.nodes.map(n=>[n.id,n]));
 for(const e of data.edges.filter(e=>e.from===e.to)){
  const n=map.get(e.from),a=e.points[0],b=e.points.at(-1),labelWidth=e.labelWidth;
  if(e.fromSide==='EAST'){
   const x=n.x+n.w+88;e.points=[a,[x,a[1]],[x,b[1]],b];e.labelPosition={x:x+labelWidth/2+8,y:(a[1]+b[1])/2};
   const right=x+labelWidth+24;data.layout.width=Math.max(data.layout.width,right+28);
   for(let id=n.parent;id;){const g=data.layout.groups.find(g=>g.id===id);if(!g)break;g.w=Math.max(g.w,right-g.x);id=g.parent;}
  }else{
   const y=n.y+n.h+72;e.points=[a,[a[0],y],[b[0],y],b];e.labelPosition={x:(a[0]+b[0])/2,y:y+20};
   const bottom=y+42;data.layout.height=Math.max(data.layout.height,bottom+28);
   for(let id=n.parent;id;){const g=data.layout.groups.find(g=>g.id===id);if(!g)break;g.h=Math.max(g.h,bottom-g.y);id=g.parent;}
  }
 }

}
