// 11.12 只公开像素坐标；在原解析器回调中保存输入值，避免反推数值。
async function readMermaidQuadrantModel(mermaid,source,descriptions={}) {
 const seed=await mermaid.mermaidAPI.getDiagramFromText('quadrantChart'),db=seed.db;
 const names=['addClass','addPoint','setXAxisLeftText','setXAxisRightText','setYAxisBottomText','setYAxisTopText','setQuadrant1Text','setQuadrant2Text','setQuadrant3Text','setQuadrant4Text'];
 if(names.some(k=>typeof db[k]!=='function'))return {reason:'四象限解析接口不兼容'};
 const original=new Map(names.map(k=>[k,db[k]])),events=[];
 try {
  for(const name of names)db[name]=(...args)=>{events.push({name,args:structuredClone(args)});return original.get(name)(...args);};
  await mermaid.mermaidAPI.getDiagramFromText(source);
 } finally {for(const [name,fn]of original)db[name]=fn;}
 const text=name=>events.filter(e=>e.name===name).at(-1)?.args[0]?.text||'';
 if(events.some(e=>e.args[0]?.type==='markdown'||hasRichMermaidLabel(e.args[0]?.text)))return {reason:'四象限富文本保留原生语义'};
 const raw=events.filter(e=>e.name==='addPoint');
 const classes=new Map(events.filter(e=>e.name==='addClass').map(e=>[e.args[0],db.parseStyles(e.args[1])]));
 const styles=raw.map(e=>db.parseStyles(e.args[4]||[]));
 if([...classes.values(),...styles].some(s=>Object.keys(s).some(k=>k!=='color')))return {reason:'四象限自定义尺寸与描边保留原生语义'};
 const points=raw.map((e,i)=>({id:'point-'+(i+1),name:e.args[0].text,group:e.args[1]||'',color:styles[i].color||classes.get(e.args[1])?.color||'',x:Number(e.args[2]),y:Number(e.args[3]),description:descriptions['point-'+(i+1)]||''}));
 if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1))return {reason:'四象限坐标保留原生语义'};
 const unknown=Object.keys(descriptions).filter(k=>!points.some(p=>p.id===k));if(unknown.length)throw Error('未知说明 ID：'+unknown.join('、'));
 return {data:{kind:'quadrant',points,xLow:text('setXAxisLeftText'),xHigh:text('setXAxisRightText'),yLow:text('setYAxisBottomText'),yHigh:text('setYAxisTopText'),quadrants:[1,2,3,4].map(i=>text('setQuadrant'+i+'Text')),title:db.getDiagramTitle?.()||''}};
}
