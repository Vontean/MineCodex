// 使用真实坐标值与解析后域，不从源码猜测点序列。
async function readMermaidXYModel(db,descriptions={}) {
 if(!db.getXYChartData||!db.getChartConfig)return {reason:'XY 数据接口不兼容'};
 const raw=structuredClone(db.getXYChartData()),config=db.getChartConfig(),counts={bar:0,line:0};
 const plots=raw.plots.map((p,i)=>({id:'series-'+(i+1),type:p.type,name:(p.type==='bar'?'柱形':'折线')+(++counts[p.type]),points:p.data.map(([x,y],index)=>({x,y,index}))}));
 if(!plots.length||plots.some(p=>!['bar','line'].includes(p.type)||p.points.some(d=>!Number.isFinite(d.y))))return {reason:'XY 系列数据保留原生语义'};
 if(hasRichMermaidLabel(raw.xAxis.title)||hasRichMermaidLabel(raw.yAxis.title)||raw.xAxis.categories?.some(hasRichMermaidLabel))return {reason:'富文本坐标轴保留原生语义'};
 if(Object.keys(descriptions).length)return {reason:'XY 额外说明保留原生语义'};
 return {data:{kind:'xy',plots,xAxis:raw.xAxis,yAxis:raw.yAxis,horizontal:config.chartOrientation==='horizontal',title:db.getDiagramTitle?.()||''}};
}
