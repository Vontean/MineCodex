// 固定版本 DB 是唯一数据来源；不另写 CSV 解析器。
async function readMermaidSankeyModel(db,descriptions={}) {
 if(!db.getGraph||!db.getConfig)return {reason:'桑基数据接口不兼容'};
 const graph=structuredClone(db.getGraph()),options=structuredClone(db.getConfig());
 if(!graph.links.length||graph.links.some(l=>!Number.isFinite(l.value)||l.value<=0))return {reason:'桑基非正值保留原生语义'};
 if(graph.nodes.some(n=>hasRichMermaidLabel(n.id)))return {reason:'桑基富文本保留原生语义'};
 if(options.linkColor&&!['gradient','source','target'].includes(options.linkColor))return {reason:'桑基自定义带色保留原生语义'};
 const ids=new Set(graph.nodes.map(n=>n.id)),unknown=Object.keys(descriptions).filter(k=>!ids.has(k));
 if(unknown.length)throw Error('未知说明 ID：'+unknown.join('、'));
 const children=new Map(graph.nodes.map(n=>[n.id,[]])),indegree=new Map(graph.nodes.map(n=>[n.id,0]));
 for(const l of graph.links){children.get(l.source).push(l.target);indegree.set(l.target,indegree.get(l.target)+1);}
 const queue=graph.nodes.filter(n=>!indegree.get(n.id)).map(n=>n.id);let count=0;
 while(queue.length){const id=queue.shift();count++;for(const to of children.get(id)){indegree.set(to,indegree.get(to)-1);if(!indegree.get(to))queue.push(to);}}
 if(count!==graph.nodes.length)return {reason:'桑基回路保留原生语义'};
 return {data:{kind:'sankey',nodes:graph.nodes.map(n=>({...n,name:n.id,description:descriptions[n.id]||''})),links:graph.links.map((l,i)=>({...l,id:'flow-'+(i+1)})),alignment:options.nodeAlignment||'justify',linkColor:options.linkColor||'gradient',showValues:options.showValues,prefix:options.prefix||'',suffix:options.suffix||'',title:db.getDiagramTitle?.()||''}};
}
