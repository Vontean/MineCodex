// Journey getTasks 追加共享数组；只读一次，再复制源码的顺序、评分与角色。
async function readMermaidJourneyModel(db,descriptions={}) {
 if(!db.getTasks||!db.getActors)return {reason:'Journey 数据接口不兼容'};
 const tasks=db.getTasks().map((t,i)=>({id:'step-'+(i+1),name:t.task.trim(),section:t.section.trim(),score:t.score,actors:[...t.people].filter(Boolean),description:descriptions['step-'+(i+1)]||''}));
 if(!tasks.length||tasks.some(t=>!Number.isFinite(t.score)||t.score<1||t.score>5))return {reason:'体验评分超出1–5范围，保留原生语义'};
 if(tasks.some(t=>[t.name,t.section,...t.actors].some(hasRichMermaidLabel)))return {reason:'此用户旅程包含富文本，保留原生语义'};
 const unknown=Object.keys(descriptions).filter(id=>!tasks.some(t=>t.id===id));if(unknown.length)throw new Error('说明引用了未知步骤：'+unknown.join('、'));
 return {data:{kind:'journey',tasks,actors:[...db.getActors()].filter(Boolean),title:db.getDiagramTitle?.()||''}};
}
