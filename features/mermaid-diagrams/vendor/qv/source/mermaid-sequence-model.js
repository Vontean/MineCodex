// 只访问固定版本的时序图 DB；不从源码或 SVG 猜测消息语义。
async function readMermaidSequenceModel(mermaid,source,descriptions={}) {
  const db=(await mermaid.mermaidAPI.getDiagramFromText(source)).db;
  const rawActors=[...db.getActors()],boxes=db.getBoxes?.();
  const actors=rawActors.map(([id,a])=>({id,name:a.description||a.name,type:a.type,description:descriptions[id]||''}));
  const messages=db.getMessages().map(m=>({...m}));
  const supported=new Set([0,1,2,3,4,5,6,10,11,12,13,14,15,16,17,18,19,20,21,24,25,26,27,28,29,30,31,33,34]);
  if(!actors.length||actors.some(a=>!['participant','actor'].includes(a.type)||hasRichMermaidLabel(a.name))||messages.some(m=>!supported.has(m.type)||typeof m.message==='string'&&hasRichMermaidLabel(m.message))||(boxes?.size||boxes?.length)||rawActors.some(([,a])=>a.rectData||a.wrap||Object.keys(a.links||{}).length||Object.keys(a.properties||{}).length))return {reason:'此时序图包含未适配的参与方、富文本或自定义区域，保留原生语义'};
  const unknown=Object.keys(descriptions).filter(id=>!actors.some(a=>a.id===id));if(unknown.length)throw new Error('说明引用了未知参与方：'+unknown.join('、'));
  let number=1,step=1,numbered=false;
  for(const m of messages){if(m.type===26){numbered=m.message.visible!==false;if(Number.isFinite(m.message.start))number=m.message.start;if(Number.isFinite(m.message.step))step=m.message.step;}else if([0,1,3,4,5,6,24,25,33,34].includes(m.type)&&numbered){m.number=number;number+=step;}}
  return {data:{kind:'sequence',actors,messages}};
}
