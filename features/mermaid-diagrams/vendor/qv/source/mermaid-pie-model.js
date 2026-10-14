// 固定版本返回 Map；保留标签顺序，不重排或合并小项。
async function readMermaidPieModel(db,descriptions={}) {
 if(!db.getSections||!db.getShowData)return {reason:'Pie 数据接口不兼容'};
 const items=[...db.getSections()].map(([name,value],i)=>({id:'slice-'+(i+1),name,value,description:descriptions[name]||''}));
 const total=items.reduce((s,d)=>s+d.value,0);
 if(!items.length||!Number.isFinite(total)||total<=0||items.some(d=>!Number.isFinite(d.value)||d.value<0))return {reason:'饼图需要有效的非负数与正总量'};
 if(items.some(d=>hasRichMermaidLabel(d.name)))return {reason:'富文本饼图保留原生语义'};
 const unknown=Object.keys(descriptions).filter(name=>!items.some(d=>d.name===name));if(unknown.length)throw Error('说明引用了未知分类：'+unknown.join('、'));
 return {data:{kind:'pie',items,total,showData:db.getShowData(),title:db.getDiagramTitle?.()||''}};
}
