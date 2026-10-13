function renderMermaidKanban(root,data) {
 const scene=root.querySelector('.scene'),viewport=root.querySelector('.diagram-scroll');scene.querySelector('svg').setAttribute('hidden','');root.querySelector('.edge-key').hidden=true;
 if(!window.lucide)throw Error('看板的 Lucide 图标尚未就绪');
 root.classList.add('qv-kanban');root.dataset.state='enhanced';root.dataset.renderer='qv-kanban';viewport.setAttribute('aria-label','看板：按源码阶段排列的任务，可横向滚动');
 const style=document.createElement('style');style.textContent=`
 #${root.id} .kanban-column{position:absolute;top:0;box-sizing:border-box;padding:12px;border-radius:12px;background:color-mix(in srgb,var(--kanban-tone) 6%,var(--background))}
 #${root.id} .kanban-heading{display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:13px;line-height:20px;font-weight:500}
 #${root.id} .kanban-category{display:flex;align-items:center;gap:6px;min-width:0;max-width:calc(100% - 32px);padding:3px 9px;border-radius:999px;background:color-mix(in srgb,var(--kanban-tone) 15%,var(--background));color:color-mix(in srgb,var(--kanban-tone) 55%,var(--foreground))}
 #${root.id} .kanban-category-dot{width:7px;height:7px;border-radius:50%;background:var(--kanban-tone);flex:none}
 #${root.id} .kanban-category-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 #${root.id} .kanban-heading .count{color:color-mix(in srgb,var(--kanban-tone) 55%,var(--foreground));font-size:12px;font-weight:400;flex:none;font-variant-numeric:tabular-nums}
 #${root.id} .kanban-task{display:block;width:100%;box-sizing:border-box;margin:10px 0 0;padding:14px;text-align:left;border:1px solid transparent;border-radius:9px;background:var(--background);color:var(--foreground);font:inherit;cursor:var(--cursor-interaction,pointer);box-shadow:none}
 #${root.id} .kanban-task[data-active=true],#${root.id} .kanban-task:focus-visible{border-color:var(--viz-series-1);outline:none}
 #${root.id} .kanban-name{display:block;font-size:16px;line-height:24px;font-weight:500;overflow-wrap:anywhere}
 #${root.id} .kanban-description,#${root.id} .kanban-ticket{display:block;margin-top:10px;font-size:12px;line-height:18px;color:color-mix(in srgb,var(--foreground) 64%,var(--background));overflow-wrap:anywhere}
 #${root.id} .kanban-meta{display:flex;align-items:center;gap:10px 12px;flex-wrap:wrap;font-size:12px;line-height:18px;color:color-mix(in srgb,var(--foreground) 76%,var(--background));margin-top:12px}
 #${root.id} .kanban-assignee{display:flex;align-items:center;gap:6px;min-width:0;max-width:100%;overflow-wrap:anywhere}
 #${root.id} .kanban-assignee svg{--icon-size:14px;width:14px;height:14px;flex:none;stroke-width:1.6}
 #${root.id} .kanban-assignee-name{min-width:0;overflow-wrap:anywhere}
 #${root.id} .kanban-priority{display:flex;align-items:center;gap:6px;flex:none;max-width:100%;overflow-wrap:anywhere}
 #${root.id} .kanban-priority-meter{display:flex;gap:2px;flex:none}
 #${root.id} .kanban-priority-segment{width:6px;height:10px;border-radius:2px;background:color-mix(in srgb,var(--foreground) 12%,var(--background))}
 #${root.id} .kanban-priority-segment[data-filled=true]{background:var(--viz-series-1)}
 `;root.append(style);
 const make=(tag,className,text)=>{const n=document.createElement(tag);n.className=className;if(text!==undefined)n.textContent=text;return n;};
 const tones=[3,6,2,1,4,5],levels={'Very Low':1,'Low':2,'High':3,'Very High':4},objects=[];
 const columns=data.columns.map((c,column)=>{
  const box=make('div','kanban-column');box.dataset.column=c.id;box.setAttribute('role','group');box.setAttribute('aria-label',c.name);box.style.setProperty('--kanban-tone',`var(--viz-series-${tones[column%tones.length]})`);
  const header=make('div','kanban-heading'),category=make('span','kanban-category'),letters=Array.from(c.name);
  // 展示限制不改源码类别或列归属，完整名称保留在可访问标签。
  category.setAttribute('aria-label',c.name);category.append(make('span','kanban-category-dot'),make('span','kanban-category-name',letters.length>12?letters.slice(0,11).join('')+'…':c.name));header.append(category,make('span','count',String(c.tasks.length)));box.append(header);scene.append(box);
  c.tasks.forEach((t,i)=>{
   const b=make('button','kanban-task');b.type='button';b.dataset.task=t.id;b.append(make('span','kanban-name',t.name));
   if(t.description)b.append(make('span','kanban-description',t.description));
   if(t.ticket)b.append(make('span','kanban-ticket',t.ticket));
   const meta=make('span','kanban-meta');
   if(t.assigned){const person=make('span','kanban-assignee'),icon=window.lucide.createElement(window.lucide.icons.UserRound);icon.classList.add('lucide');icon.setAttribute('aria-hidden','true');person.append(icon,make('span','kanban-assignee-name',t.assigned));meta.append(person);}
   if(t.priority){const priority=make('span','kanban-priority'),level=levels[t.priority];priority.dataset.priority=t.priority;priority.setAttribute('aria-label','优先级：'+t.priority);if(level){const meter=make('span','kanban-priority-meter');meter.setAttribute('aria-hidden','true');for(let j=0;j<4;j++){const segment=make('span','kanban-priority-segment');segment.dataset.filled=String(j<level);meter.append(segment);}priority.append(meter);}priority.append(make('span','kanban-priority-name',t.priority));meta.append(priority);}
   if(meta.childNodes.length)b.append(meta);
   b.setAttribute('aria-label',[c.name,t.name,t.description,t.ticket,t.assigned&&'负责人：'+t.assigned,t.priority&&'优先级：'+t.priority].filter(Boolean).join(' · '));box.append(b);objects.push({b,t,i,column});
  });return {box,header,c};
 });
 const view=createMermaidViewport(root);
 function layout(){const width=view.expanded?248:272,gap=16;columns.forEach((c,i)=>{c.box.style.width=width+'px';c.box.style.left=12+i*(width+gap)+'px';c.header.style.height='auto';});const headerHeight=Math.max(...columns.map(c=>c.header.offsetHeight));columns.forEach(c=>c.header.style.height=headerHeight+'px');scene.style.width=scene.style.minWidth=24+columns.length*(width+gap)-gap+'px';scene.style.height=Math.max(...columns.map(c=>c.box.offsetHeight))+12+'px';view.refresh();}
 function clear(){objects.forEach(o=>o.b.removeAttribute('data-active'));}
 function show(o){clear();o.b.dataset.active='true';}
 objects.forEach(o=>{o.b.onpointerenter=o.b.onclick=()=>show(o);o.b.onpointerleave=()=>{if(!o.b.matches(':focus-visible'))o.b.removeAttribute('data-active');};o.b.onfocus=()=>{const v=viewport.getBoundingClientRect(),r=o.b.getBoundingClientRect();if(r.left<v.left+12)viewport.scrollLeft-=v.left+12-r.left;else if(r.right>v.right-12)viewport.scrollLeft+=r.right-v.right+12;show(o);};o.b.onblur=()=>o.b.removeAttribute('data-active');});viewport.addEventListener('scroll',clear,{passive:true});root.addEventListener('keydown',e=>{if(e.key==='Escape')clear();});
 layout();root.addEventListener('qv:display-mode',()=>{clear();layout();if(!view.expanded)viewport.scrollLeft=view.savedInlinePosition?.left||0;});
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');let armed=true,running=[];
 function cancel(){running.forEach(a=>a.cancel());running=[];}
 function replay(){cancel();if(reduced.matches||view.expanded)return;columns.forEach((c,i)=>running.push(c.header.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,delay:i*120,fill:'backwards'})));objects.forEach(o=>running.push(o.b.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,delay:o.column*120+o.i*70+80,fill:'backwards'})));root.dataset.replays=String(+(root.dataset.replays||0)+1);}
 new IntersectionObserver(es=>{if(!es[0].isIntersecting)armed=true;else if(es[0].intersectionRatio>=.2&&armed){armed=false;replay();}},{threshold:[0,.2]}).observe(root);document.addEventListener('visibilitychange',()=>{if(document.hidden)armed=true;else if(armed){armed=false;replay();}});root.addEventListener('qv:display-mode',cancel);reduced.addEventListener('change',cancel);
 let lastWidth=root.clientWidth,frame=0;new ResizeObserver(()=>{if(lastWidth===root.clientWidth||frame)return;frame=requestAnimationFrame(()=>{frame=0;const width=root.clientWidth;if(!root.isConnected||lastWidth===width)return;lastWidth=width;cancel();clear();layout();});}).observe(root);
}
