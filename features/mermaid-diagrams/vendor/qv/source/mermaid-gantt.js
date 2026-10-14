// 接入已审视的时间尺、阶段条与里程碑胶囊，不复制模拟数据。
async function renderMermaidGantt(root,data){
 const d3=await import('https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm');
 const heading=root.querySelector('h3');if(heading.hidden&&data.title){heading.textContent=data.title;heading.hidden=false;}
 root.dataset.state='enhanced';root.dataset.renderer='qv-gantt';root.querySelector('.edge-key').hidden=true;
 const viewport=root.querySelector('.diagram-scroll'),plot=root.querySelector('.scene');plot.replaceChildren();
 viewport.setAttribute('aria-label','甘特图：任务起止日期与里程碑，可横向滚动');
 const chart=document.createElementNS('http://www.w3.org/2000/svg','svg');chart.classList.add('chart');const hits=document.createElement('div');hits.className='hits';plot.append(chart,hits);const svg=d3.select(chart);
 const bubble=document.createElement('div');bubble.className='bubble';bubble.setAttribute('role','tooltip');bubble.hidden=true;bubble.innerHTML='<div class="bubble-head"><i class="swatch" aria-hidden="true"></i><span></span></div><div class="bubble-rows"></div><div class="bubble-dependency"></div>';root.append(bubble);
 const style=document.createElement('style');style.textContent=`
#${root.id}{position:relative;width:100%;padding-top:32px;color:var(--foreground);--tip-radius:12px;--title-gap:32px}
#${root.id} h3{margin:0 90px var(--title-gap) 0;font-weight:500}
#${root.id} .plot{position:relative}
#${root.id} .chart .group-label{font-size:12px;font-weight:400;fill:var(--muted-foreground)}
#${root.id} .chart .month-label{font-size:14px;font-weight:500}
#${root.id} .dependency{fill:none;stroke:color-mix(in srgb,var(--muted-foreground) 38%,transparent);stroke-width:1;transition:opacity 160ms ease}
#${root.id} .dependency-arrow{fill:color-mix(in srgb,var(--muted-foreground) 38%,transparent)}
#${root.id} .milestone-guide{stroke:color-mix(in srgb,var(--muted-foreground) 35%,transparent);stroke-width:1;stroke-dasharray:3 5}
#${root.id} .chart{display:block;width:100%;overflow:visible}
#${root.id} .chart text{font:inherit;font-size:12px;fill:var(--foreground);font-variant-numeric:tabular-nums}
#${root.id} .chart .tick-label{fill:var(--muted-foreground)}
#${root.id} .task{transition:opacity 160ms ease}
#${root.id} .swatch{display:inline-block;width:9px;height:9px;border-radius:2px;flex-shrink:0}
#${root.id} .bubble{position:absolute;z-index:3;pointer-events:none;width:206px;max-width:calc(100% - 16px);box-sizing:border-box;padding:12px 14px;background:var(--popover);color:var(--popover-foreground);border:1px solid color-mix(in srgb,var(--border) 70%,transparent);border-radius:var(--tip-radius);box-shadow:0 4px 16px color-mix(in srgb,var(--foreground) 10%,transparent)}
#${root.id} .bubble[hidden]{display:none}
#${root.id} .bubble-head{display:flex;gap:8px;align-items:center;margin-bottom:10px;font-weight:500}
#${root.id} .bubble-row{display:flex;justify-content:space-between;gap:14px;margin-top:7px;font-size:12px}
#${root.id} .bubble-row span{color:var(--muted-foreground)}
#${root.id} .bubble-row strong{font-weight:400;font-variant-numeric:tabular-nums;text-align:right}
#${root.id} .bubble-dependency{border-top:1px solid var(--border);margin-top:10px;padding-top:10px;font-size:12px}
#${root.id} .bubble-dependency[hidden]{display:none}
#${root.id} .hits{position:absolute;inset:0;pointer-events:none}
#${root.id} .task-hit{position:absolute;pointer-events:auto;opacity:0;margin:0;cursor:var(--cursor-interaction,pointer)}
#${root.id} .task-hit:focus-visible{opacity:1;background:transparent;outline:2px solid var(--ring);outline-offset:2px}
@media(prefers-reduced-motion:reduce){#${root.id} .task{transition:none}}

#${root.id} .scene{margin:0;min-width:0} #${root.id} .bubble-head span{overflow-wrap:anywhere} #${root.id} .task-hit{border:0;background:none;min-height:0;padding:0}
`;root.append(style);
 const reduced=matchMedia('(prefers-reduced-motion:reduce)'),measure=document.createElement('canvas').getContext('2d'),view=createMermaidViewport(root,{expandedSizing:'hug'});
 const day=86400000,date=d=>`${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`,tasks=data.tasks,sections=data.sections;
 let layout=null,lastWidth=0,resizeFrame=0,hover=null,inView=false,armed=true;
 const color=t=>`var(--viz-series-${sections.indexOf(t.section)%6+1})`;
function clear(){hover=null;paint();}
function linesFor(text,width){
 if(measure.measureText(text).width<=width)return [text];
 if(width<measure.measureText('…').width)return [];
 const chars=Array.from(text),lines=[];
 for(let line=0;line<2&&chars.length;line++){
  let value='';while(chars.length&&measure.measureText(value+chars[0]).width<=width)value+=chars.shift();
  if(line===1&&chars.length){while(value&&measure.measureText(value+'…').width>width)value=value.slice(0,-1);value+='…';}
  if(!value){lines.push('…');break;}lines.push(value);
 }
 return lines;
}
function paint(){if(!layout)return;svg.selectAll('.task').style('opacity',t=>hover!==null?(t.id===hover?1:.45):1);svg.selectAll('.dependency-group').style('opacity',e=>hover===null||e.from.id===hover||e.to.id===hover?1:.16);if(hover===null)bubble.hidden=true;}
function show(t,event){
 hover=t.id;paint();root.querySelector('.bubble-head span').textContent=t.task;root.querySelector('.bubble-head .swatch').style.background=color(t);
 const rows=root.querySelector('.bubble-rows');rows.replaceChildren();
 const values=t.milestone?[['日期',date(t.startTime)],['类型','里程碑']]:[['开始',date(t.startTime)],['结束',date(t.endTime)],['时长',`${Math.round((t.endTime-t.startTime)/day)} 自然日`],['状态',t.done?'已完成':t.active?'进行中':'未开始']];
 if(t.description)values.push(['说明',t.description]);
 if(t.crit)values.push(['标记','关键任务']);
 values.forEach(([label,value])=>{const row=document.createElement('div');row.className='bubble-row';const name=document.createElement('span'),valueNode=document.createElement('strong');name.textContent=label;valueNode.textContent=value;row.append(name,valueNode);rows.append(row);});
 const dependency=root.querySelector('.bubble-dependency');dependency.hidden=!t.dependencies.length;dependency.textContent=t.dependencies.length?'前置任务：'+t.dependencies.map(id=>tasks.find(q=>q.id===id).task).join('、'):'';
 bubble.hidden=false;
 const box=layout.boxes.get(t.id),rb=root.getBoundingClientRect(),pb=plot.getBoundingClientRect(),bw=bubble.offsetWidth,bh=bubble.offsetHeight,hit=[...hits.children].find(n=>n.dataset.task===t.id),hb=hit.getBoundingClientRect();
 const px=event?.clientX===undefined?(hb.left+hb.right)/2-rb.left:event.clientX-rb.left,py=hb.top-rb.top;
 const candidates=[{left:px+16,top:py-bh-14},{left:px-bw-16,top:py-bh-14},{left:px+16,top:hb.bottom-rb.top+12},{left:px-bw-16,top:hb.bottom-rb.top+12}];
 const own={left:hb.left-rb.left,right:hb.right-rb.left,top:hb.top-rb.top,bottom:hb.bottom-rb.top};
 const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
 const best=candidates.map(c=>{const left=Math.max(8,Math.min(rb.width-bw-8,c.left)),top=Math.max(0,Math.min(root.offsetHeight-bh-8,c.top));return {left,top,score:overlap({left,right:left+bw,top,bottom:top+bh},own)};}).sort((a,b)=>a.score-b.score)[0];
 bubble.style.left=best.left+'px';bubble.style.top=best.top+'px';
}
function draw(animate=false){
 const width=Math.max(320,viewport.clientWidth);plot.style.width=plot.style.minWidth=width+'px';if(!width)return;lastWidth=width;clear();
 measure.font='12px '+getComputedStyle(root).fontFamily;
 const narrow=width<500,row=narrow?60:44,left=8,right=14,top=56;
 const x=d3.scaleTime().domain([d3.min(tasks,t=>t.startTime),d3.max(tasks,t=>t.endTime)]).range([left,width-right]);
 const milestoneBoxes=new Map(),tiers=[];for(const t of tasks.filter(t=>t.milestone)){const lines=linesFor(t.task,Math.min(160,width-left-right-16)),bw=Math.min(176,Math.max(32,...lines.map(line=>measure.measureText(line).width))+16),bx=Math.max(left,Math.min(width-right-bw,x(t.startTime)-bw/2));let tier=tiers.findIndex(end=>end+8<=bx);if(tier<0)tier=tiers.length;tiers[tier]=bx+bw;milestoneBoxes.set(t.id,{lines,bw,bx,y:top+4+tier*44});}
 const placed=new Map(),groupRows=[];let cursor=top+Math.max(56,tiers.length*44+12);
 sections.forEach((section,index)=>{const entries=tasks.filter(t=>t.section===section&&!t.milestone);groupRows.push({section,y:cursor,index});cursor+=16;entries.forEach(t=>{const a=x(t.startTime),b=x(t.endTime),lines=linesFor(t.task,Math.max(0,b-a-16)),barHeight=lines.length>1?40:32;placed.set(t.id,{y:cursor,a,b,lines,barHeight,center:cursor+barHeight/2});cursor+=row;});cursor+=16;});
 const base=cursor-4,height=base+14;
 layout={width,height,base,x,boxes:new Map()};svg.selectAll('*').interrupt();svg.selectAll('*').remove();hits.replaceChildren();svg.attr('viewBox',`0 0 ${width} ${height}`).attr('height',height);
 const start=x.domain()[0],end=x.domain()[1],span=Math.round((end-start)/day),ticks=[0];for(let d=7;d<span;d+=7)ticks.push(d);ticks.push(span);
 // 刻度随容器减量，保留实际项目开始与结束日期。
 const tickDates=[...new Set(ticks)].map(n=>new Date(+start+n*day));
 svg.append('text').attr('x',left).attr('y',14).attr('class','month-label').text(`${start.getFullYear()} 年 ${start.getMonth()+1} 月`+(start.getMonth()!==end.getMonth()||start.getFullYear()!==end.getFullYear()?` — ${end.getFullYear()} 年 ${end.getMonth()+1} 月`:''));
 const visibleDates=tickDates;const today=new Date();if(data.today&&today>=start&&today<=end){svg.append('line').attr('class','today-marker').attr('x1',x(today)).attr('x2',x(today)).attr('y1',top).attr('y2',base).attr('stroke','var(--muted-foreground)').attr('stroke-dasharray','3 5');svg.append('text').attr('x',Math.max(left,Math.min(width-right-24,x(today)+4))).attr('y',top+16).text('今天');}
 const days=d3.timeDay.range(start,d3.timeDay.offset(end,1)),majorDays=new Set([...visibleDates.map(Number),...tasks.filter(t=>t.milestone).map(t=>+t.startTime)]);
 svg.append('line').attr('class','ruler-baseline').attr('x1',left).attr('x2',width-right).attr('y1',top).attr('y2',top).attr('stroke','var(--border)').attr('stroke-opacity',.85);
 svg.selectAll('.day-tick').data(days).join('line').attr('class','day-tick').attr('x1',x).attr('x2',x).attr('y1',d=>majorDays.has(+d)?top-10:top-5).attr('y2',top).attr('stroke','var(--muted-foreground)').attr('stroke-opacity',d=>majorDays.has(+d)?.55:.28);
 svg.selectAll('.grid').data(visibleDates.filter(d=>+d!==+start&&+d!==+end)).join('line').attr('class','grid').attr('x1',x).attr('x2',x).attr('y1',top).attr('y2',base).attr('stroke','var(--border)').attr('stroke-opacity',.35);
 svg.selectAll('.date-label').data(visibleDates).join('text').attr('class','date-label').attr('x',x).attr('y',41).attr('text-anchor',d=>+d===+start?'start':+d===+end?'end':'middle').text(d=>String(d.getDate()).padStart(2,'0'));
 groupRows.forEach(g=>{if(g.index)svg.append('line').attr('x1',left).attr('x2',width-right).attr('y1',g.y-16).attr('y2',g.y-16).attr('stroke','var(--border)').attr('stroke-opacity',.45);svg.append('text').attr('class','group-label').attr('x',left).attr('y',g.y-1).text(g.section);});
 const edges=tasks.flatMap(to=>to.dependencies.map(id=>({from:tasks.find(t=>t.id===id),to}))).filter(e=>!e.from.milestone&&!e.to.milestone&&+e.to.startTime>+e.from.endTime);
 const wires=svg.append('g').attr('class','wires');edges.forEach(e=>{const from=placed.get(e.from.id),to=placed.get(e.to.id),sx=from.b,sy=from.center,ex=to.a-6,ey=to.center,bend=(ex-sx)*.55,g=wires.append('g').datum(e).attr('class','dependency-group');g.append('path').attr('class','dependency').attr('d',`M${sx},${sy}C${sx+bend},${sy} ${ex-bend},${ey} ${ex},${ey}`);g.append('path').attr('class','dependency-arrow').attr('d',`M${ex},${ey-2.2}L${ex+5},${ey}L${ex},${ey+2.2}Z`);});
 const groups=svg.selectAll('.task').data(tasks).join('g').attr('class','task').attr('data-task',t=>t.id);
 groups.each(function(t,i){
  const g=d3.select(this),a=x(t.startTime),b=x(t.endTime),label=t.task,labelWidth=measure.measureText(label).width;
  let box;
  if(t.milestone){
   const m=milestoneBoxes.get(t.id),bubbleWidth=m.bw,bubbleX=m.bx,bubbleY=m.y,bubbleHeight=m.lines.length>1?40:24;
   g.append('line').attr('class','milestone-guide').attr('x1',a).attr('x2',a).attr('y1',top+2).attr('y2',base);
   g.append('rect').attr('class','milestone-label-bubble').attr('x',bubbleX).attr('y',bubbleY).attr('width',bubbleWidth).attr('height',bubbleHeight).attr('rx',12).attr('fill',color(t)).attr('fill-opacity',.13);
   const caption=g.append('text').attr('class','task-label milestone-label').attr('x',bubbleX+8).attr('y',bubbleY+16);m.lines.forEach((line,i)=>caption.append('tspan').attr('x',bubbleX+8).attr('dy',i?14:0).text(line));
   g.append('path').attr('class','milestone').attr('transform',`translate(${a},${top-5})`).attr('d','M-4,-6H4V-1L0,4L-4,-1Z').attr('fill',color(t));
   box={left:bubbleX-4,right:Math.min(width,Math.max(a+6,bubbleX+bubbleWidth+4)),top:top-12,bottom:bubbleY+bubbleHeight+4};
  }else{
   const p=placed.get(t.id),y=p.y,labelX=a+8;
   const bar=g.append('rect').attr('class','bar').attr('x',a).attr('y',y).attr('height',p.barHeight).attr('rx',3).attr('width',animate&&!reduced.matches?0:b-a).attr('fill',color(t)).attr('fill-opacity',.13);
   g.append('line').attr('class','bar-start').attr('x1',a).attr('x2',a).attr('y1',y+1).attr('y2',y+p.barHeight-1).attr('stroke',color(t)).attr('stroke-width',2);
   const labelNode=g.append('text').attr('class','task-label').attr('x',labelX).attr('y',y+(p.lines.length>1?16:20)).attr('aria-label',t.task);
   p.lines.forEach((line,index)=>labelNode.append('tspan').attr('x',labelX).attr('dy',index?14:0).text(line));
   if(animate&&!reduced.matches){const f=i/Math.max(1,tasks.length-1),weight=f*f*(3-2*f);bar.transition().duration(580+100*weight).delay(0).ease(d3.easeCubicInOut).attr('width',b-a);}
   box={left:a-4,right:Math.min(width-right,b+4),top:p.y-5,bottom:y+p.barHeight+5};
  }
  layout.boxes.set(t.id,box);
  const hit=document.createElement('button');hit.type='button';hit.className='task-hit';hit.dataset.task=t.id;hit.setAttribute('aria-label',`${t.task}，${date(t.startTime)}至${date(t.endTime)}，${t.milestone?'里程碑':Math.round((t.endTime-t.startTime)/day)+'自然日'}`);Object.assign(hit.style,{left:box.left+'px',top:box.top+'px',width:Math.max(32,box.right-box.left)+'px',height:box.bottom-box.top+'px'});hits.append(hit);
  hit.addEventListener('pointerenter',e=>show(t,e));hit.addEventListener('pointermove',e=>show(t,e));hit.addEventListener('pointerleave',clear);hit.addEventListener('pointercancel',clear);hit.addEventListener('focus',()=>show(t));hit.addEventListener('blur',clear);hit.addEventListener('pointerup',e=>{if(e.pointerType==='touch')clear();});
 });
 paint();plot.style.height=height+'px';view.refresh();
}

 function replayIfReady(){if(inView&&armed&&!document.hidden&&!view.expanded){armed=false;draw(!reduced.matches);root.dataset.replays=String((+root.dataset.replays||0)+1);}}
 draw();
 new IntersectionObserver(es=>{const e=es[0];if(!e.isIntersecting){inView=false;armed=true;clear();}else if(e.intersectionRatio>=.2){inView=true;replayIfReady();}},{threshold:[0,.2]}).observe(root);
 new ResizeObserver(()=>{if(viewport.clientWidth===lastWidth||resizeFrame)return;resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;if(Math.max(320,viewport.clientWidth)!==lastWidth)draw();});}).observe(viewport);
 root.addEventListener('qv:display-mode',()=>{svg.selectAll('*').interrupt();clear();draw();});
 reduced.addEventListener('change',()=>{svg.selectAll('*').interrupt();draw();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){armed=true;clear();}else replayIfReady();});
 root.addEventListener('pointerleave',clear);root.addEventListener('keydown',e=>{if(e.key==='Escape')clear();});viewport.addEventListener('scroll',clear,{passive:true});view.refresh();
}
