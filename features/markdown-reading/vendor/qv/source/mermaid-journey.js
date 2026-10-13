function renderMermaidJourney(root,data) {
 const scene=root.querySelector('.scene'),viewport=root.querySelector('.diagram-scroll'),svg=scene.querySelector('svg'),NS='http://www.w3.org/2000/svg';
 root.classList.add('qv-journey');root.dataset.state='enhanced';root.dataset.renderer='qv-journey';root.querySelector('.edge-key').hidden=true;viewport.setAttribute('aria-label','用户旅程：步骤、体验曲线与角色参与，可横向滚动');
 if(data.title&&root.querySelector('h3').hidden){root.querySelector('h3').textContent=data.title;root.querySelector('h3').hidden=false;}
 if(!window.lucide)throw Error('用户旅程的 Lucide 图标尚未就绪');
 const frame=document.createElement('div'),reference=document.createElement('div'),axis=document.createElementNS(NS,'svg');frame.className='journey-frame';reference.className='journey-reference';axis.classList.add('journey-reference-axis');reference.append(axis);viewport.before(frame);frame.append(reference,viewport);
 const style=document.createElement('style');style.textContent=`
 #${root.id}{--journey-low:light-dark(#cf6f68,#e79b94);--journey-mid:light-dark(#b49a49,#d8c175);--journey-high:light-dark(#6b9b7a,#96c5a4);--journey-block:color-mix(in srgb,var(--muted) 18%,var(--background));--journey-role-bar:color-mix(in srgb,var(--foreground) 9%,var(--background))}
 #${root.id} .journey-frame{display:flex;align-items:flex-start}
 #${root.id} .journey-frame>.diagram-scroll{flex:1;min-width:0}
 #${root.id} .scene{margin:0}
 #${root.id} .journey-reference{position:relative;width:112px;flex:none;background:var(--background)}
 #${root.id} .journey-reference-axis{position:absolute;inset:0;width:112px;overflow:visible;pointer-events:none}
 #${root.id} .journey-column{position:absolute;top:0;z-index:2;min-width:0;min-height:0;margin:0;padding:0;border:0;border-radius:8px;background:transparent;color:var(--foreground);font:inherit;cursor:var(--cursor-interaction,pointer)}
 #${root.id} .journey-column:focus-visible{outline:1px solid var(--ring);outline-offset:-2px}
 #${root.id} .journey-step{position:absolute;left:8px;right:8px;display:flex;align-items:center;flex-direction:column;gap:10px;font-size:12px;line-height:20px;font-weight:400;text-align:center;white-space:normal;overflow-wrap:anywhere}
 #${root.id} .journey-step-name{display:block;width:100%;text-wrap:balance}
 #${root.id} .journey-step-index{display:flex;align-items:center;justify-content:center;width:20px;height:20px;border:1px solid var(--border);border-radius:50%;font-size:11px;font-variant-numeric:tabular-nums;flex:none;color:var(--muted-foreground)}
 #${root.id} .journey-section{position:absolute;top:0;box-sizing:border-box;padding:10px 12px;border-radius:8px;background:linear-gradient(var(--journey-block),var(--journey-block)),var(--background);font-size:12px;line-height:18px;color:var(--muted-foreground);overflow-wrap:anywhere}
 #${root.id} .journey-section span{position:relative;display:inline-block;overflow-wrap:anywhere}
 #${root.id} .journey-line{fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
 #${root.id} .journey-grid{stroke:var(--border);stroke-width:1;fill:none;opacity:.65}
 #${root.id} .journey-axis-label{font-size:12px;fill:var(--muted-foreground)}
 #${root.id} .journey-face{--icon-size:24px;position:absolute;left:50%;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:var(--background);transform:translate(-50%,-50%);pointer-events:none}
 #${root.id} .journey-face svg{width:24px;height:24px;stroke-width:1.6}
 #${root.id} .journey-actor{position:absolute;left:8px;width:96px;display:flex;align-items:center;gap:8px;box-sizing:border-box;min-height:30px;color:var(--muted-foreground);font-size:12px;line-height:18px;overflow-wrap:anywhere}
 #${root.id} .journey-actor svg{width:16px;height:16px;flex:none;stroke-width:1.6}
 #${root.id} .journey-participation{position:absolute;height:14px;border-radius:5px;background:var(--journey-role-bar);pointer-events:none}
 #${root.id} .journey-column-mask{position:absolute;z-index:3;background:var(--background);opacity:0;pointer-events:none;transition:opacity 140ms ease}
 #${root.id}[data-active-column] .journey-column-mask{opacity:.72}
 #${root.id}[data-active-column] .journey-column-mask[data-selected=true]{opacity:0}
 @media(prefers-reduced-motion:reduce){#${root.id} .journey-column-mask{transition:none}}
 `;root.append(style);
 const icon=name=>{const n=window.lucide.createElement(window.lucide.icons[name]||window.lucide.icons.UserRound);n.setAttribute('aria-hidden','true');n.classList.add('lucide');n.dataset.icon=name;return n;};
 const make=(tag,attrs,parent=svg)=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n;};
 const defs=make('defs',{}),tone=make('linearGradient',{id:root.id+'-tone',gradientUnits:'userSpaceOnUse',x1:0,x2:0},defs);
 for(const [offset,color]of [['0%','var(--journey-high)'],['50%','var(--journey-mid)'],['100%','var(--journey-low)']])make('stop',{offset,'stop-color':color},tone);
 const fade=make('linearGradient',{id:root.id+'-fade',x1:0,x2:0,y1:0,y2:1},defs);make('stop',{offset:'0%','stop-color':'white','stop-opacity':'.22'},fade);make('stop',{offset:'55%','stop-color':'white','stop-opacity':'.10'},fade);make('stop',{offset:'100%','stop-color':'white','stop-opacity':'0'},fade);
 const mask=make('mask',{id:root.id+'-area-mask',maskContentUnits:'userSpaceOnUse'},defs),maskRect=make('rect',{fill:`url(#${root.id}-fade)`},mask);
 const grid=Array.from({length:5},(_,i)=>({path:make('path',{class:'journey-grid'}),label:make('text',{class:'journey-axis-label','text-anchor':'end'},axis)}));grid.forEach((g,i)=>g.label.textContent=5-i);
 const quantity=make('text',{class:'journey-axis-label'},axis);quantity.textContent='体验曲线';const stepCaption=make('text',{class:'journey-axis-label'},axis);stepCaption.textContent='用户旅程';
 const area=make('path',{class:'journey-area',fill:`url(#${root.id}-tone)`,mask:`url(#${root.id}-area-mask)`}),line=make('path',{class:'journey-line',stroke:`url(#${root.id}-tone)`});
 const objects=[],roles=[],sections=[];
 let start=0,phase=data.tasks[0].section;for(let i=1;i<=data.tasks.length;i++)if(i===data.tasks.length||data.tasks[i].section!==phase){if(phase){const box=document.createElement('div'),caption=document.createElement('span');box.className='journey-section';caption.textContent=phase;box.append(caption);scene.append(box);sections.push({box,caption,start,end:i});}if(i<data.tasks.length){start=i;phase=data.tasks[i].section;}}
 data.tasks.forEach((t,i)=>{const b=document.createElement('button');b.type='button';b.className='journey-column';b.dataset.step=t.id;b.dataset.score=String(t.score);b.setAttribute('aria-label',[`${i+1}，${t.name}`,t.section,`体验评分${t.score}/5`,t.actors.length?'参与角色：'+t.actors.join('、'):'未指定角色',t.description].filter(Boolean).join(' · '));const header=document.createElement('span'),number=document.createElement('span'),name=document.createElement('span'),face=document.createElement('span'),columnMask=document.createElement('div');header.className='journey-step';number.className='journey-step-index';number.textContent=String(i+1);name.className='journey-step-name';name.textContent=t.name;header.append(number,name);face.className='journey-face';face.style.color=t.score===3?'var(--journey-mid)':t.score<3?'var(--journey-low)':'var(--journey-high)';face.append(icon(t.score===3?'Meh':t.score<3?'Frown':'Smile'));b.append(header,face);columnMask.className='journey-column-mask';columnMask.dataset.step=t.id;scene.append(b,columnMask);objects.push({t,b,header,face,mask:columnMask});});
 const iconRules=[[/编辑|作者|editor|writer/i,'PencilLine'],[/审核|review|check/i,'BadgeCheck'],[/运营|市场|market/i,'Megaphone'],[/设计|design/i,'Palette'],[/法务|legal/i,'Scale'],[/策略|strategy/i,'Compass']];
 data.actors.forEach(actor=>{const b=document.createElement('div'),name=document.createElement('span');b.className='journey-actor';b.dataset.actor=actor;name.textContent=actor;b.append(icon(iconRules.find(([re])=>re.test(actor))?.[1]||'UserRound'),name);reference.append(b);const runs=[];for(let i=0;i<objects.length;i++)if(objects[i].t.actors.includes(actor)){const last=runs.at(-1);if(last&&last.end===i)last.end=i+1;else runs.push({start:i,end:i+1});}runs.forEach(run=>{run.b=document.createElement('div');run.b.className='journey-participation';run.b.dataset.actor=actor;run.b.dataset.start=String(run.start);run.b.dataset.end=String(run.end);run.b.setAttribute('aria-hidden','true');scene.append(run.b);});roles.push({actor,b,runs});});
 const view=createMermaidViewport(root);let columnWidth=0,left=0,stepTop=0,plotTop=0,plotBottom=0,width=0,height=0,active=null;
 function clear(){active=null;delete root.dataset.activeColumn;objects.forEach(o=>o.mask.removeAttribute('data-selected'));}
 function select(id){if(active===id)return;active=id;root.dataset.activeColumn=id;objects.forEach(o=>o.mask.dataset.selected=String(o.t.id===id));}
 objects.forEach(o=>{o.b.onpointerenter=o.b.onfocus=o.b.onclick=()=>select(o.t.id);o.b.onblur=clear;});root.addEventListener('pointerleave',clear);root.addEventListener('keydown',e=>{if(e.key==='Escape')clear();});
 function placeSections(){sections.forEach(s=>s.caption.style.left=(view.expanded?0:Math.max(0,Math.min(s.box.offsetWidth-24-s.caption.offsetWidth,viewport.scrollLeft-s.left+8)))+'px');}
 function layout(){
  if(view.expanded)scene.append(reference);else frame.prepend(reference);reference.style.position=view.expanded?'absolute':'relative';reference.style.left=reference.style.top='0';
  columnWidth=view.expanded?120:Math.max(76,Math.min(144,(viewport.clientWidth-24)/objects.length));left=view.expanded?124:12;
  sections.forEach(s=>{s.left=left+s.start*columnWidth;s.box.style.left=s.left+4+'px';s.box.style.width=(s.end-s.start)*columnWidth-8+'px';s.caption.style.maxWidth=Math.max(32,Math.min(s.box.offsetWidth-24,viewport.clientWidth-32))+'px';});
  stepTop=Math.max(56,...sections.map(s=>s.box.offsetHeight+18));objects.forEach((o,i)=>{o.b.style.left=left+i*columnWidth+'px';o.b.style.width=columnWidth+'px';o.header.style.top=stepTop+'px';});
  const headerHeight=Math.max(...objects.map(o=>o.header.offsetHeight));plotTop=stepTop+headerHeight+42;plotBottom=plotTop+160;// 曲线块包含底部表情的15px半径；与人员块外缘保持24px。
  let roleBottom=plotBottom+15+24;
  roles.forEach(r=>{const rowHeight=Math.max(14,r.b.offsetHeight);r.y=roleBottom+rowHeight/2;roleBottom+=rowHeight+12;});
  width=left+objects.length*columnWidth+12;height=roles.length?roleBottom-12+16:plotBottom+31;
  scene.style.width=scene.style.minWidth=width+'px';scene.style.height=height+'px';svg.style.height=height+'px';svg.setAttribute('viewBox',`0 0 ${width} ${height}`);reference.style.height=height+'px';axis.style.height=height+'px';axis.setAttribute('viewBox',`0 0 112 ${height}`);
  const x=i=>left+(i+.5)*columnWidth,y=score=>plotBottom-(score-1)*40;objects.forEach((o,i)=>{o.x=x(i);o.y=y(o.t.score);o.face.style.top=o.y+'px';o.b.style.height=height+'px';Object.assign(o.mask.style,{left:left+i*columnWidth+'px',top:stepTop-8+'px',width:columnWidth+'px',height:height-stepTop+8+'px'});});
  // 控制点停留在相邻真实评分之间，不产生超出1–5的过冲。
  const path=objects.map((o,i)=>{if(!i)return `M${o.x} ${o.y}`;const a=objects[i-1],mid=(a.x+o.x)/2;return `C${mid} ${a.y} ${mid} ${o.y} ${o.x} ${o.y}`;}).join(' ');line.setAttribute('d',path);area.setAttribute('d',path+`L${objects.at(-1).x} ${plotBottom}L${objects[0].x} ${plotBottom}Z`);tone.setAttribute('y1',plotTop);tone.setAttribute('y2',plotBottom);for(const [k,v]of Object.entries({x:left,y:plotTop,width:width-left,height:plotBottom-plotTop}))maskRect.setAttribute(k,v);
  grid.forEach((g,i)=>{const yy=plotTop+i*40;g.path.setAttribute('d',`M${view.expanded?112:0} ${yy}H${width-12}`);g.label.setAttribute('x',100);g.label.setAttribute('y',yy+4);});quantity.setAttribute('x',8);quantity.setAttribute('y',plotTop-22);stepCaption.setAttribute('x',8);stepCaption.setAttribute('y',22);
  roles.forEach(r=>{const cy=r.y;r.b.style.top=cy-r.b.offsetHeight/2+'px';r.runs.forEach(run=>Object.assign(run.b.style,{left:left+run.start*columnWidth+6+'px',top:cy-7+'px',width:(run.end-run.start)*columnWidth-12+'px'}));});placeSections();view.refresh();
 }
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');let running=[],armed=true;
 function cancelMotion(){running.forEach(a=>a.cancel());running=[];line.style.strokeDasharray='';}
 function replay(){cancelMotion();if(reduced.matches||view.expanded)return;const length=line.getTotalLength();line.style.strokeDasharray=`${length} ${length}`;running.push(line.animate([{strokeDashoffset:length},{strokeDashoffset:0}],{duration:1000,fill:'backwards'}),area.animate([{opacity:0},{opacity:1}],{duration:500,fill:'backwards'}));objects.forEach((o,i)=>running.push(o.face.animate([{opacity:0},{opacity:1}],{duration:200,delay:i/Math.max(1,objects.length-1)*1000,fill:'backwards'})));root.dataset.replays=String(+(root.dataset.replays||0)+1);}
 layout();viewport.addEventListener('scroll',()=>{placeSections();clear();if(document.activeElement?.classList.contains('journey-column'))select(document.activeElement.dataset.step);},{passive:true});root.addEventListener('qv:display-mode',()=>{cancelMotion();clear();layout();if(!view.expanded)viewport.scrollLeft=view.savedInlinePosition?.left||0;});
 new IntersectionObserver(es=>{if(!es[0].isIntersecting)armed=true;else if(es[0].intersectionRatio>=.2&&armed){armed=false;replay();}},{threshold:[0,.2]}).observe(root);document.addEventListener('visibilitychange',()=>{if(document.hidden)armed=true;else if(armed){armed=false;replay();}});reduced.addEventListener('change',cancelMotion);
 let lastWidth=root.clientWidth,layoutFrame=0;new ResizeObserver(()=>{if(lastWidth===root.clientWidth||layoutFrame)return;layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;const nextWidth=root.clientWidth;if(!root.isConnected||lastWidth===nextWidth)return;lastWidth=nextWidth;cancelMotion();clear();layout();});}).observe(root);
}
