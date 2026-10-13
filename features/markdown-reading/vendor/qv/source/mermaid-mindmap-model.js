function readMermaidMindmapModel(db,descriptions={}){
 if(!db.getMindmap)return {reason:'Mindmap 数据接口不兼容'};
 const tree=db.getMindmap(),nodes=[];if(!tree)return {reason:'Mindmap 缺少根节点'};
 function visit(n,parent=null,depth=0){const id=String(n.id);nodes.push({id,sourceId:n.nodeId,label:String(n.descr||''),parent,depth,children:n.children||[],description:descriptions[n.nodeId]||descriptions[id]||'',icon:n.icon,classes:n.cssClasses});for(const c of n.children||[])visit(c,id,depth+1);}
 visit(tree);
 if(nodes.some(n=>n.icon||n.classes||hasRichMermaidLabel(n.label)))return {reason:'Mindmap 自定义图标、样式或富文本保留原生语义'};
 const unknown=Object.keys(descriptions).filter(id=>!nodes.some(n=>n.id===id||n.sourceId===id));if(unknown.length)throw Error('说明引用了未知主题：'+unknown.join('、'));
 return {data:{kind:'mindmap',nodes}};
}
