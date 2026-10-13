function renderMermaidQuadrant(root,data) {
 const scene=root.querySelector('.scene'),viewport=root.querySelector('.diagram-scroll'),svg=scene.querySelector('svg');root.dataset.state='enhanced';root.dataset.renderer='qv-quadrant';root.querySelector('.edge-key').hidden=true;svg.removeAttribute('aria-hidden');viewport.setAttribute('aria-label','四象限图，可横向滚动');const title=root.querySelector('h3');if(!title.textContent)title.textContent=data.title;
 const style=document.createElement('style');style.textContent=`
 #${root.id} .wires{pointer-events:auto}
 #${root.id} .quadrant-text{position:absolute;font-size:12px;line-height:18px;color:var(--muted-foreground);overflow-wrap:anywhere}
 #${root.id} .quadrant-axis{font-size:14px;font-weight:500;color:var(--foreground);box-sizing:border-box;padding:8px 12px;border-radius:999px;background:color-mix(in srgb,var(--muted-foreground) 8%,var(--background))}
 #${root.id} .quadrant-label{position:absolute;border:0;background:transparent;padding:4px 6px;max-width:144px;color:var(--foreground);font:inherit;font-size:12px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;cursor:var(--cursor-interaction,pointer)}
 #${root.id} .quadrant-detail{position:absolute;z-index:10;width:252px;max-width:calc(100% - 8px);box-sizing:border-box;padding:12px 14px;border-radius:12px;background:var(--popover);color:var(--popover-foreground);font-size:12px;line-height:1.6;box-shadow:0 3px 12px #0002;pointer-events:auto;overflow-wrap:anywhere;overflow:auto;max-height:320px}
 `;root.append(style);
 const NS='http://www.w3.org/2000/svg',add=(tag,attrs,parent=svg)=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n;},fmt=v=>new Intl.NumberFormat(undefined,{maximumFractionDigits:20}).format(v);
 const tip=document.createElement('div');tip.className='quadrant-detail';tip.id=root.id+'-quadrant-detail';tip.setAttribute('role','tooltip');tip.hidden=true;root.append(tip);const hint=document.createElement('div');hint.style.cssText='font-size:12px;line-height:18px;color:var(--muted-foreground);margin-top:12px';viewport.before(hint);
 let labels=[],texts=[],marks=[],leaders=[],animations=[],pending=null,epoch=0,plot,pointPositions=[],activePoint=null,leaveTimer=0;const view=createMermaidViewport(root),reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const box=n=>({x:n.offsetLeft,y:n.offsetTop,w:n.offsetWidth,h:n.offsetHeight}),area=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 function clear(){clearTimeout(leaveTimer);pending=null;activePoint=null;epoch++;tip.hidden=true;root.style.paddingBottom='';tip.style.position='absolute';tip.style.marginTop='0';[...labels,...marks].forEach(b=>b.removeAttribute('aria-describedby'));marks.forEach(m=>m.style.opacity='1');leaders.forEach(l=>l.style.opacity='1');}
 function leave(){clearTimeout(leaveTimer);leaveTimer=setTimeout(clear,100);}
 tip.onpointerenter=()=>clearTimeout(leaveTimer);tip.onpointerleave=leave;
 function show(i,event,anchor,group=false){
  clear();activePoint=i;const p=data.points[i];
  const same=group?data.points.filter(q=>q.x===p.x&&q.y===p.y):[p];
  marks.forEach((m,j)=>m.style.opacity=same.includes(data.points[j])?'1':'.25');
  leaders.forEach((m,j)=>m.style.opacity=same.includes(data.points[j])?'1':'.25');
  const head=document.createElement('div');head.className='quadrant-detail-title';head.textContent=same.length>1?same.length+' 个方案位于同一坐标':p.name;tip.replaceChildren(head);
  if(same.length>1)same.forEach(q=>{const n=document.createElement('div');n.textContent=q.name;tip.append(n);});
  const row=document.createElement('div');row.style.color='var(--muted-foreground)';row.textContent='X '+fmt(p.x)+' · Y '+fmt(p.y);tip.append(row);
  const location=document.createElement('div');location.textContent=p.x===.5||p.y===.5?'位于象限分界线':data.quadrants[p.y>.5?(p.x>.5?0:1):(p.x>.5?3:2)];tip.append(location);
  const hasCategories=data.points.some(q=>q.group),categories=hasCategories?[...new Set(same.map(q=>q.group||''))]:[];
  categories.forEach(category=>{const n=document.createElement('div'),swatch=document.createElement('span');n.className='quadrant-detail-category';n.style.cssText='display:flex;align-items:center;gap:6px;margin-top:6px';swatch.style.cssText='width:7px;height:7px;flex-shrink:0;border-radius:50%';const member=same.find(q=>(q.group||'')===category);swatch.style.background=marks[data.points.indexOf(member)].getAttribute('fill');swatch.setAttribute('aria-hidden','true');n.append(swatch,document.createTextNode(category||'默认'));tip.append(n);});
  same.filter(q=>q.description).forEach(q=>{const d=document.createElement('div');d.style.marginTop='8px';d.textContent=(same.length>1?q.name+'：':'')+q.description;tip.append(d);});
  const trigger=anchor||marks[i];trigger.setAttribute('aria-describedby',tip.id);tip.hidden=false;
  const rr=root.getBoundingClientRect(),br=trigger.getBoundingClientRect(),w=tip.offsetWidth;
  const top=Math.max(4,-rr.top+4),bottom=Math.min(root.clientHeight,innerHeight-rr.top-4);
  tip.style.maxHeight=Math.max(64,Math.min(320,bottom-top))+'px';
  const h=tip.offsetHeight,x=br.left+br.width/2-rr.left,y=br.top+br.height/2-rr.top;
  const candidates=[{x:x+14,y:y-h/2},{x:x-w-14,y:y-h/2},{x:x-w/2,y:y+14},{x:x-w/2,y:y-h-14}];
  candidates.forEach(c=>{c.x=Math.max(4,Math.min(root.clientWidth-w-4,c.x));c.y=Math.max(top,Math.min(bottom-h,c.y));c.cover=area({...c,w,h},{x:br.left-rr.left-6,y:br.top-rr.top-6,w:br.width+12,h:br.height+12});});
  candidates.sort((a,b)=>a.cover-b.cover);tip.style.left=candidates[0].x+'px';tip.style.top=candidates[0].y+'px';tip.dataset.placement='overlay';
 }
 function focus(i,ensureVisible=true){pending=i;const b=labels[i].hidden?marks[i]:labels[i],r=b.getBoundingClientRect(),v=viewport.getBoundingClientRect();if(ensureVisible&&!view.expanded){if(r.left<v.left+8)viewport.scrollLeft-=v.left+8-r.left;else if(r.right>v.right-8)viewport.scrollLeft+=r.right-v.right+8;}const ticket=++epoch;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(epoch===ticket){pending=null;show(i,null,marks[i],true);}}));}
 function cancel(){animations.forEach(a=>a.cancel());animations=[];}
 function label(text,x,y,w,align='left'){const n=document.createElement('div');n.className='quadrant-text';n.textContent=text;n.style.left=x+'px';n.style.top=y+'px';n.style.width=w+'px';n.style.textAlign=align;scene.append(n);texts.push(n);return n;}
 function draw(){
  cancel();clear();svg.replaceChildren();[...labels,...texts].forEach(n=>n.remove());labels=[];texts=[];marks=[];leaders=[];
  const width=Math.max(640,Math.min(736,viewport.clientWidth)),size=width-256;
  plot={x:128,y:104,w:size,h:size};const height=size+208;
  hint.textContent=!view.expanded&&viewport.clientWidth<width?'可横向滚动 · 密集区域悬浮点查看完整方案':'';hint.hidden=!hint.textContent;
  scene.style.width=scene.style.minWidth=width+'px';scene.style.height=height+'px';
  svg.setAttribute('width',width);svg.setAttribute('height',height);svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.style.width=width+'px';svg.style.height=height+'px';svg.setAttribute('role','img');svg.setAttribute('aria-label',data.title+'，'+data.points.map(p=>p.name+' ['+p.x+', '+p.y+']').join('；'));
  const {x,y,w,h}=plot;
  add('line',{x1:x+w/2,y1:y,x2:x+w/2,y2:y+h,stroke:'var(--border)'});
  add('line',{x1:x,y1:y+h/2,x2:x+w,y2:y+h/2,stroke:'var(--border)'});
  const axis=(text,l,t,width)=>{const n=label(text,l,t,width,'center');n.classList.add('quadrant-axis');n.style.width='max-content';n.style.maxWidth=width+'px';n.style.left=l+(width-n.offsetWidth)/2+'px';return n;};
  const left=axis(data.xLow,0,0,112),right=axis(data.xHigh,x+w+16,0,112);[left,right].forEach(n=>n.style.top=y+h/2-n.offsetHeight/2+'px');
  const top=axis(data.yHigh,x+w/2-160,0,320);top.style.top=Math.max(0,y-20-top.offsetHeight)+'px';axis(data.yLow,x+w/2-160,y+h+20,320);
  // 轴说明按真实换行高度留白，不改变归一化坐标。
  const bottom=texts.at(-1);scene.style.height=Math.max(height,bottom.offsetTop+bottom.offsetHeight+16)+'px';
  const cx=x+w/2,cy=y+h/2,captionWidth=Math.min(176,w/2-24);
  data.quadrants.forEach((t,i)=>{const right=i===0||i===3,upper=i<2,n=label(t,right?cx+12:cx-captionWidth-12,0,captionWidth,right?'left':'right');n.classList.add('quadrant-caption');n.style.top=(upper?cy-12-n.offsetHeight:cy+12)+'px';});
  const points=data.points.map(p=>({x:x+p.x*w,y:y+(1-p.y)*h})),occupied=texts.map(box);pointPositions=points;
  const groups=[...new Set(data.points.map(p=>p.group).filter(Boolean))];
  const color=p=>p.color||('var(--viz-series-'+(p.group?groups.indexOf(p.group)%5+2:1)+')');
  const measures=data.points.map(p=>{const b=document.createElement('button');b.className='quadrant-label';b.type='button';b.textContent=p.name;b.dataset.quadrantPoint=p.id;b.setAttribute('aria-label',p.name+'，x '+fmt(p.x)+'，y '+fmt(p.y));scene.append(b);return b;});
  data.points.forEach((p,i)=>{
   const pos=points[i],b=measures[i],bw=b.offsetWidth,bh=b.offsetHeight;
   const nearby=points.map((q,j)=>({q,j})).filter(({q})=>Math.hypot(q.x-pos.x,q.y-pos.y)<96);
   const load=nearby.reduce((sum,{j})=>sum+measures[j].offsetWidth*measures[j].offsetHeight,0);
   const dense=nearby.length>=3||nearby.length>=2&&load/(Math.PI*96*96)>.14;
   const candidates=[[pos.x+12,pos.y-bh/2],[pos.x-bw-12,pos.y-bh/2],[pos.x-bw/2,pos.y-bh-14],[pos.x-bw/2,pos.y+14],[pos.x+12,pos.y-bh-14],[pos.x-bw-12,pos.y+14]].map(([a,c])=>({x:Math.max(4,Math.min(width-bw-4,a)),y:Math.max(4,Math.min(scene.offsetHeight-bh-4,c)),w:bw,h:bh}));
   candidates.forEach(c=>{c.overlap=occupied.reduce((sum,r)=>sum+area({x:c.x-4,y:c.y-4,w:c.w+8,h:c.h+8},r),0);c.dotOverlap=points.reduce((sum,q)=>sum+(q.x>=c.x-6&&q.x<=c.x+c.w+6&&q.y>=c.y-6&&q.y<=c.y+c.h+6?1:0),0);});
   candidates.sort((a,b)=>a.dotOverlap-b.dotOverlap||a.overlap-b.overlap);const chosen=candidates[0];
   b.style.left=chosen.x+'px';b.style.top=chosen.y+'px';b.hidden=dense||chosen.overlap>0||chosen.dotOverlap>0;b.dataset.dense=String(dense);labels.push(b);if(!b.hidden)occupied.push(chosen);
   const lx=Math.max(chosen.x,Math.min(chosen.x+bw,pos.x)),ly=Math.max(chosen.y,Math.min(chosen.y+bh,pos.y));const leader=add('line',{x1:pos.x,y1:pos.y,x2:lx,y2:ly,stroke:'var(--border)','stroke-width':1},svg);leader.style.display=b.hidden?'none':'';leaders.push(leader);
   const dot=add('circle',{cx:pos.x,cy:pos.y,r:5,fill:color(p),'data-quadrant-mark':p.id,'data-x':p.x,'data-y':p.y,tabindex:b.hidden?'0':'-1',role:'button','aria-label':b.getAttribute('aria-label')});marks.push(dot);
   dot.onfocus=()=>focus(i);dot.onblur=leave;dot.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();focus(i);}};
   b.onpointerenter=()=>focus(i,false);b.onclick=e=>focus(i,e.detail===0);b.onfocus=()=>focus(i);b.onpointerleave=leave;b.onblur=leave;
  });
  svg.onpointermove=svg.onclick=e=>{const r=svg.getBoundingClientRect(),sx=(e.clientX-r.left)*width/r.width,sy=(e.clientY-r.top)*height/r.height;const near=pointPositions.map((p,i)=>({i,d:Math.hypot(p.x-sx,p.y-sy)})).sort((a,b)=>a.d-b.d);if(!near.length||near[0].d>16){leave();return;}clearTimeout(leaveTimer);const i=near[0].i;if(activePoint===i)return;show(i,e,marks[i],true);};svg.onpointerleave=leave;view.refresh();
 }
 function replay(){cancel();if(reduced.matches||view.expanded)return;marks.forEach((m,i)=>animations.push(m.animate([{transform:'scale(0)'},{transform:'scale(1)'}],{duration:240,delay:i*80,fill:'backwards',easing:'cubic-bezier(.25,1,.5,1)'})));marks.forEach(m=>{m.style.transformBox='fill-box';m.style.transformOrigin='center';});labels.forEach((b,i)=>{if(!b.hidden)animations.push(b.animate([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,delay:i*80+120,fill:'backwards',easing:'cubic-bezier(.25,1,.5,1)'}));});}
 draw();root.addEventListener('qv:display-mode',()=>{draw();if(!view.expanded)viewport.scrollLeft=view.savedInlinePosition?.left||0;});let width=root.clientWidth,resizeFrame=0;new ResizeObserver(()=>{if(width!==root.clientWidth&&!resizeFrame)resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;if(width!==root.clientWidth){width=root.clientWidth;draw();}});}).observe(root);let armed=true;new IntersectionObserver(es=>{if(!es[0].isIntersecting){armed=true;cancel();clear();}else if(es[0].intersectionRatio>=.2&&armed){armed=false;replay();}},{threshold:[0,.2]}).observe(root);document.addEventListener('visibilitychange',()=>{if(document.hidden){armed=true;cancel();clear();}else if(armed){const r=root.getBoundingClientRect();if(r.bottom>0&&r.top<innerHeight){armed=false;replay();}}});reduced.addEventListener('change',cancel);viewport.addEventListener('scroll',()=>{if(pending!==null)focus(pending,false);else clear();},{passive:true});document.addEventListener('keydown',e=>{if(e.key==='Escape'){pending=null;clear();}});window.addEventListener('blur',clear);
}
