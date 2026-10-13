// 使用固定版本的真实列与节点数据；不从源码重新编写看板。
async function readMermaidKanbanModel(db,descriptions={}) {
 if(!db.getData||!db.getSections)return {reason:'Kanban 数据接口不兼容'};
 const raw=db.getData(),nodes=raw.nodes;
 if(raw.config?.kanban?.ticketBaseUrl)return {reason:'票据外部链接保留原生行为'};
 if(nodes.some(n=>n.icon||hasRichMermaidLabel(n.label)))return {reason:'图标或富文本看板保留原生语义'};
 const columns=nodes.filter(n=>n.isGroup).map(n=>({id:n.id,name:n.label,tasks:nodes.filter(t=>t.parentId===n.id).map(t=>({id:t.id,name:t.label,assigned:t.assigned||'',ticket:t.ticket||'',priority:t.priority||'',description:descriptions[t.id]||''}))}));
 if(!columns.length||nodes.some(n=>!n.isGroup&&!columns.some(c=>c.id===n.parentId)))return {reason:'看板层级保留原生语义'};
 const tasks=columns.flatMap(c=>c.tasks),unknown=Object.keys(descriptions).filter(id=>!tasks.some(t=>t.id===id));if(unknown.length)throw Error('说明引用了未知卡片：'+unknown.join('、'));
 return {data:{kind:'kanban',columns}};
}
