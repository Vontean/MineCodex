// 解析层保留维度顺序、曲线名称、量表与网格选项。
async function readMermaidRadarModel(db,descriptions={}) {
 if(!db.getAxes||!db.getCurves||!db.getOptions)return {reason:'Radar 数据接口不兼容'};
 const axes=structuredClone(db.getAxes()),curves=structuredClone(db.getCurves()),options=structuredClone(db.getOptions());
 if(axes.length<3||!curves.length||curves.some(c=>c.entries.length!==axes.length||c.entries.some(v=>!Number.isFinite(v))))return {reason:'雷达维度或数值保留原生语义'};
 if([...axes,...curves].some(d=>hasRichMermaidLabel(d.label))||Object.keys(descriptions).length)return {reason:'雷达富文本与额外说明保留原生语义'};
 const min=options.min??0,max=options.max??Math.max(...curves.flatMap(c=>c.entries));
 if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min||curves.some(c=>c.entries.some(v=>v<min||v>max)))return {reason:'雷达量表边界保留原生语义'};
 return {data:{kind:'radar',axes:axes.map(d=>({id:d.name,name:d.label})),series:curves.map(d=>({id:d.name,name:d.label,values:d.entries})),min,max,ticks:options.ticks,graticule:options.graticule,showLegend:options.showLegend,title:db.getDiagramTitle?.()||''}};
}
