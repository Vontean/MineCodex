function readMermaidGanttModel(db,descriptions={}){
 if(!db.getTasks)return {reason:'Gantt 数据接口不兼容'};
 if(db.getExcludes?.().length||db.getIncludes?.().length||db.endDatesAreInclusive?.()||Object.keys(db.getLinks?.()||{}).length)return {reason:'Gantt 排除日期、含结束日期或交互链接保留原生语义'};
 const marker=db.getTodayMarker?.();if((marker&&marker!=='off')||/[HhmsXx]/.test(db.getDateFormat?.()||''))return {reason:'Gantt 自定义今日标记或时分秒排期保留原生语义'};
 const tasks=db.getTasks().map(t=>({...t,task:t.task.trim(),startTime:new Date(t.startTime),endTime:new Date(t.endTime),description:descriptions[t.id]||'',dependencies:t.raw?.startTime?.startData?.startsWith('after ')?t.raw.startTime.startData.slice(6).trim().split(/\s+/):[]}));
 if(!tasks.length||tasks.some(t=>!Number.isFinite(+t.startTime)||!Number.isFinite(+t.endTime)||t.endTime<t.startTime))return {reason:'Gantt 任务日期无法确定'};
 if(tasks.some(t=>hasRichMermaidLabel(t.task)||hasRichMermaidLabel(t.section)||t.classes?.length||t.dependencies.some(id=>!tasks.some(n=>n.id===id))))return {reason:'Gantt 富文本、样式或未匹配依赖保留原生语义'};
 const unknown=Object.keys(descriptions).filter(id=>!tasks.some(t=>t.id===id));if(unknown.length)throw Error('说明引用了未知任务：'+unknown.join('、'));
 return {data:{kind:'gantt',tasks,title:db.getDiagramTitle?.()||'',today:marker!=='off',sections:[...new Set(tasks.map(t=>t.section))]}};
}
