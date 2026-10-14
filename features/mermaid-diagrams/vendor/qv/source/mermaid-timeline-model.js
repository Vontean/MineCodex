// Timeline DB 的 getTasks 会追加到共享数组；只读取一次并立即复制。
async function readMermaidTimelineModel(db,descriptions={}) {
 if(!db.getTasks||!db.getSections)return {reason:'Timeline 数据接口不兼容'};
 const tasks=db.getTasks().map(t=>({id:String(t.id),name:t.task.trim(),section:t.section.trim(),events:[...t.events].map(v=>v.trim()),description:descriptions[String(t.id)]||''}));
 if(tasks.some(t=>[t.name,t.section,...t.events].some(hasRichMermaidLabel)))return {reason:'此时间轴包含富文本，保留原生语义'};
 const unknown=Object.keys(descriptions).filter(id=>!tasks.some(t=>t.id===id));if(unknown.length)throw new Error('说明引用了未知时间节点：'+unknown.join('、'));
 return {data:{kind:'timeline',tasks,title:db.getCommonDb?.().getDiagramTitle?.()||''}};
}
