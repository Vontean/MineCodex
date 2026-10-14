function renderMermaidState(root,data) {
 const scene=root.querySelector('.scene'),viewport=root.querySelector('.diagram-scroll'),svg=scene.querySelector('svg'),NS='http://www.w3.org/2000/svg';
 root.classList.add('qv-state');root.dataset.renderer='qv-state';root.dataset.state='enhanced';root.querySelector('.edge-key').hidden=true;viewport.setAttribute('aria-label','状态转移图，可横向滚动');
 const style=document.createElement('style');style.textContent=`
 #${root.id} .state-node{position:absolute;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 14px;border:1px solid var(--border);border-radius:10px;background:var(--background);color:var(--foreground);font-family:inherit;font-size:16px;line-height:24px;font-weight:500;white-space:pre-line;text-align:center;cursor:var(--cursor-interaction,pointer)}
 #${root.id} .state-node small{font-weight:400;font-size:12px;line-height:18px;color:var(--muted-foreground)}
 #${root.id} .state-symbol{position:absolute;display:flex;align-items:center;justify-content:center;border:0;background:none;padding:0;cursor:var(--cursor-interaction,pointer)}
 #${root.id} .state-symbol svg{width:100%;height:100%;overflow:visible}
 #${root.id} .state-symbol .state-mark{fill:var(--background);stroke:var(--muted-foreground);stroke-width:1}
 #${root.id} .state-symbol .state-solid{fill:var(--muted-foreground);stroke:none}
 #${root.id} .state-group{position:absolute;border:1px solid var(--border);border-radius:12px;background:var(--background)}
 #${root.id} .state-group>button{position:absolute;left:14px;top:8px;border:0;background:inherit;color:var(--muted-foreground);font:inherit;font-size:12px;display:flex;max-width:calc(100% - 28px);padding:0 4px;white-space:pre-line;text-align:left;cursor:var(--cursor-interaction,pointer)}
 #${root.id} .state-wire{fill:none;stroke:light-dark(color-mix(in srgb,var(--muted-foreground) 55%,var(--background)),color-mix(in srgb,var(--muted-foreground) 68%,var(--background)));stroke-width:1}
 #${root.id} .state-arrow{fill:light-dark(color-mix(in srgb,var(--muted-foreground) 55%,var(--background)),color-mix(in srgb,var(--muted-foreground) 68%,var(--background)))}
 #${root.id} .state-label{position:absolute;transform:translate(-50%,-50%);padding:2px 6px;border:0;border-radius:4px;background:transparent;color:var(--muted-foreground);font:inherit;font-size:12px;line-height:18px;min-height:0;white-space:pre-line;cursor:var(--cursor-interaction,pointer)}
 #${root.id} .state-tip,#${root.id} .state-peers{position:absolute;z-index:10;border-radius:12px;padding:12px 14px;background:var(--popover);color:var(--popover-foreground);font-size:12px;line-height:1.6;box-shadow:0 3px 12px #0002;pointer-events:none;white-space:pre-line}
 #${root.id} .state-node svg,#${root.id} .state-group>button svg{width:14px;height:14px;flex:none}
 #${root.id} .state-tip-relation{display:grid;grid-template-columns:minmax(0,1fr) 14px minmax(0,1fr);align-items:center;gap:12px}
 #${root.id} .state-tip-relation svg{width:14px;height:14px;color:var(--muted-foreground)}
 #${root.id} .state-tip-endpoint{min-width:0}
 #${root.id} .state-tip-caption{display:block;font-size:11px;line-height:16px;color:var(--muted-foreground);font-weight:400;margin-bottom:4px}
 #${root.id} .state-tip-name{display:block;font-size:14px;line-height:20px;font-weight:600;white-space:normal;overflow-wrap:anywhere}
 #${root.id} .state-tip-body{margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:12px;line-height:20px;overflow-wrap:anywhere}
 #${root.id} .state-title{display:inline-flex;align-items:center;justify-content:center;gap:8px;max-width:100%;min-width:0}
 #${root.id} .state-title-name{min-width:0;white-space:pre-line}
 #${root.id} .state-node small:first-of-type{margin-top:8px}
 `;root.append(style);
 const tip=document.createElement('div');tip.className='state-tip';tip.id=root.id+'-state-tip';tip.setAttribute('role','tooltip');tip.hidden=true;root.append(tip);
 const element=(tag,attrs,parent=svg)=>{const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;};
 const source=structuredClone(data),sourceGroups=new Map(source.groups.map(g=>[g.id,g])),all=new Map([...source.groups,...source.nodes].map(n=>[n.id,n]));
 const level=id=>sourceGroups.has(id)?1+Math.max(0,...[...all.values()].filter(n=>n.parent===id).map(n=>level(n.id))):0;
 const surface=(el,id)=>{el.style.background=level(id)%2?'color-mix(in srgb,var(--muted) 18%,var(--background))':'var(--background)';};
 const icon=(el,name)=>{const i=document.createElement('i');i.dataset.lucide=name;i.setAttribute('aria-hidden','true');el.append(i);};
 function drawTip(value){
  tip.replaceChildren();const text=(parent,tag,cls,value)=>{const el=document.createElement(tag);el.className=cls;el.textContent=value;parent.append(el);return el;};
  if(value.from!==undefined){const relation=document.createElement('div');relation.className='state-tip-relation';tip.append(relation);for(const [caption,name]of [['起始状态',value.from],['目标状态',value.to]]){if(caption==='目标状态')icon(relation,'arrow-right');const endpoint=document.createElement('div');endpoint.className='state-tip-endpoint';text(endpoint,'span','state-tip-caption',caption);text(endpoint,'span','state-tip-name',name);relation.append(endpoint);}}
  else text(tip,'span','state-tip-name',value.title);
  const body=document.createElement('div');body.className='state-tip-body';tip.append(body);if(value.label)text(body,'span','state-tip-caption','转移说明'+(value.count>1?' · '+value.count+' 条转移':''));text(body,'div','state-tip-content',wrapMermaidStateText(value.label||value.description));if(window.lucide)window.lucide.createIcons({attrs:{width:14,height:14}});
 }
 const title=(el,name,arrow)=>{const row=document.createElement('span');row.className='state-title';const label=document.createElement('span');label.className='state-title-name';label.textContent=wrapMermaidStateText(name);row.append(label);if(arrow)icon(row,arrow);el.append(row);};
 const nav=root.querySelector('.scope-nav'),positions=new Map();let grouped=false,scope=null,busy=false,dispose=()=>{};
 const view=createMermaidViewport(root);
 async function navigate(target){
  const enabled=target!==null;
  if(busy)return;busy=true;positions.set(root.dataset.scope||'complete',viewport.scrollLeft);viewport.setAttribute('aria-busy','true');
  try{const next=enabled?mermaidScopeView(source,target):structuredClone(source);await prepareMermaidStateLayout(next);dispose();grouped=enabled;scope=target;root.dataset.scope=enabled?(target||'overview'):'complete';draw(next);navigation();view.refresh();viewport.scrollLeft=positions.get(root.dataset.scope)||0;}
  finally{busy=false;viewport.setAttribute('aria-busy','false');}
 }
 function navigation(){
  nav.hidden=!sourceGroups.size||scope===null;nav.setAttribute('aria-label','状态层级');nav.replaceChildren();if(nav.hidden)return;
  const path=[];for(let g=sourceGroups.get(scope);g;g=sourceGroups.get(g.parent))path.unshift(g);
  for(const [index,g]of [{id:null,name:'总览'},...(grouped?path:[])].entries()){
   if(index){const sep=document.createElement('span');sep.textContent='/';nav.append(sep);}
   const b=document.createElement('button');b.type='button';b.textContent=g.name;b.dataset.scope=g.id||'';b.onclick=()=>navigate(g.id);if(g.id===scope)b.setAttribute('aria-current','location');nav.append(b);
   if(g.id!==null){const peers=[...sourceGroups.values()].filter(p=>p.parent===g.parent&&p.id!==g.id);if(peers.length){
    const panel=document.createElement('div');panel.className='state-peers';panel.style.pointerEvents='auto';panel.hidden=true;b.setAttribute('aria-haspopup','true');b.setAttribute('aria-expanded','false');let close;
    const hide=()=>{panel.hidden=true;b.setAttribute('aria-expanded','false');};const open=()=>{clearTimeout(close);const r=b.getBoundingClientRect(),rr=root.getBoundingClientRect();panel.style.left=Math.max(0,r.left-rr.left)+'px';panel.style.top=(r.bottom-rr.top)+'px';panel.hidden=false;b.setAttribute('aria-expanded','true');};
    b.onpointerenter=open;b.onpointerleave=()=>close=setTimeout(hide,180);b.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();open();panel.querySelector('button').focus();}};panel.onpointerenter=()=>clearTimeout(close);panel.onpointerleave=()=>close=setTimeout(hide,180);panel.onkeydown=e=>{if(e.key==='Escape'){hide();b.focus();}};
    for(const peer of peers){const item=document.createElement('button');item.type='button';item.textContent=peer.name;item.style.cssText='display:block;border:0;background:transparent;color:inherit;font:inherit;padding:6px 0';item.onclick=()=>navigate(peer.id);panel.append(item);}nav.append(panel);
   }}
  }

 }
 function draw(data){
 const abort=new AbortController(),signal=abort.signal;scene.querySelectorAll(':scope > :not(svg)').forEach(e=>e.remove());svg.replaceChildren();tip.hidden=true;
 const width=Math.max(root.clientWidth,data.layout.width),height=data.layout.height,offset=(width-data.layout.width)/2;
 scene.style.cssText=`width:${width}px;min-width:${width}px;height:${height}px`;svg.style.height=height+'px';svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
 const nodes=data.nodes.map(n=>({...n,x:n.x+offset})),groups=data.layout.groups.map(n=>({...n,x:n.x+offset})),map=new Map([...nodes,...groups].map(n=>[n.id,n])),objects=[],edges=[];
 for(const g of groups.sort((a,b)=>level(b.id)-level(a.id))){const box=document.createElement('div');box.className='state-group';box.style.cssText=`left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px`;const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',g.name+'，进入此层级');title(b,g.name,'chevron-right');surface(box,g.id);b.dataset.stateNode=g.id;box.append(b);scene.insertBefore(box,svg);objects.push({n:g,b,box});}
 for(const n of nodes){const b=document.createElement('button');b.type='button';b.className=['rect','rectWithTitle','roundedWithTitle','round'].includes(n.shape)?'state-node':'state-symbol';b.dataset.stateNode=n.id;b.style.cssText=`left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px`;b.setAttribute('aria-label',n.name);
  if(b.className==='state-node'){surface(b,n.targetGroup!==undefined?n.targetGroup:n.id);title(b,n.name,n.groupCard||n.targetGroup!==undefined?(n.external?'arrow-up-right':'chevron-right'):null);if(n.groupCard||n.targetGroup!==undefined){if(n.groupCard){const count=document.createElement('small');count.textContent=n.count+' 个状态';b.append(count);}}for(const line of n.lines){const small=document.createElement('small');small.textContent=wrapMermaidStateText(line);b.append(small);}}
  else {const s=element('svg',{viewBox:`0 0 ${n.w} ${n.h}`,'aria-hidden':'true'},b);if(n.shape==='stateStart')element('circle',{cx:10,cy:10,r:5,class:'state-solid'},s);else if(n.shape==='stateEnd'){element('circle',{cx:10,cy:10,r:9,class:'state-mark'},s);element('circle',{cx:10,cy:10,r:5,class:'state-solid'},s);}else if(n.shape==='choice')element('path',{d:'M16 1L31 16L16 31L1 16Z',class:'state-mark'},s);else element('rect',{width:n.w,height:n.h,rx:2,class:'state-solid'},s);}
  scene.append(b);objects.push({n,b,box:b});
 }
 const rounded=points=>{let d=`M${points[0][0]} ${points[0][1]}`;for(let i=1;i<points.length-1;i++){const a=points[i-1],b=points[i],c=points[i+1],l1=Math.hypot(b[0]-a[0],b[1]-a[1]),l2=Math.hypot(c[0]-b[0],c[1]-b[1]),r=Math.min(8,l1/2,l2/2);if(!l1||!l2)continue;d+=`L${b[0]-(b[0]-a[0])*r/l1} ${b[1]-(b[1]-a[1])*r/l1}Q${b[0]} ${b[1]} ${b[0]+(c[0]-b[0])*r/l2} ${b[1]+(c[1]-b[1])*r/l2}`;}return d+`L${points.at(-1)[0]} ${points.at(-1)[1]}`};
 for(const e of data.edges){const pts=e.points.map(([x,y])=>[x+offset,y]),last=pts.at(-1),prev=pts.at(-2),a=Math.atan2(last[1]-prev[1],last[0]-prev[0]),ux=Math.cos(a),uy=Math.sin(a),line=pts.slice(0,-1).concat([[last[0]-5*ux,last[1]-5*uy]]),path=element('path',{d:rounded(line),class:'state-wire','data-state-edge':e.id,'data-from':e.from,'data-to':e.to}),head=element('path',{d:`M${last[0]} ${last[1]}L${last[0]-5*ux+2.2*uy} ${last[1]-5*uy-2.2*ux}L${last[0]-5*ux-2.2*uy} ${last[1]-5*uy+2.2*ux}Z`,class:'state-arrow'});let label;
  if(e.label){const p=e.labelPosition||path.getPointAtLength(path.getTotalLength()/2);label=document.createElement('button');label.type='button';label.className='state-label';label.textContent=wrapMermaidStateText(e.label);label.style.left=(e.labelPosition?p.x+offset:p.x)+'px';label.style.top=p.y+'px';label.setAttribute('aria-label',map.get(e.from).name+' → '+map.get(e.to).name+'：'+e.label);scene.append(label);}
  edges.push({...e,labelText:e.label,path,head,label});
 }
 // 在所属路径附近寻找空白位置；折行后仍避开节点、其他条件和场景边界。
 const placed=[];
 for(const e of edges)if(e.label){
  const label=e.label,w=label.offsetWidth,h=label.offsetHeight,length=e.path.getTotalLength(),px=parseFloat(label.style.left),py=parseFloat(label.style.top),candidates=[];
  const obstacles=[...nodes.map(n=>({x:n.x,y:n.y,w:n.w,h:n.h})),...placed];
  for(let d=0;d<=length;d+=12){const p=e.path.getPointAtLength(d),a=e.path.getPointAtLength(Math.max(0,d-1)),b=e.path.getPointAtLength(Math.min(length,d+1)),horizontal=Math.abs(b.x-a.x)>=Math.abs(b.y-a.y);
   for(const clearance of [8,24,48,80])for(const side of [-1,1]){const x=horizontal?p.x:p.x+side*(w/2+clearance),y=horizontal?p.y+side*(h/2+clearance):p.y;
    if(x-w/2<4||x+w/2>width-4||y-h/2<4||y+h/2>height-4)continue;
    const overlap=obstacles.reduce((sum,o)=>sum+Math.max(0,Math.min(x+w/2,o.x+o.w)-Math.max(x-w/2,o.x))*Math.max(0,Math.min(y+h/2,o.y+o.h)-Math.max(y-h/2,o.y)),0);
    candidates.push({x,y,overlap,distance:Math.hypot(x-px,y-py)});
   }
  }
  candidates.sort((a,b)=>a.overlap-b.overlap||a.distance-b.distance);const p=candidates[0]||{x:Math.max(w/2+4,Math.min(width-w/2-4,px)),y:Math.max(h/2+4,Math.min(height-h/2-4,py))};label.style.left=p.x+'px';label.style.top=p.y+'px';placed.push({x:p.x-w/2,y:p.y-h/2,w,h});
 }
 function clear(){tip.hidden=true;objects.forEach(({b,box})=>{b.style.opacity='';box.style.borderColor='';b.removeAttribute('aria-describedby')});edges.forEach(e=>{e.path.style.opacity='';e.path.style.stroke='';e.head.style.opacity='';e.head.style.fill='';if(e.label){e.label.style.opacity='';e.label.removeAttribute('aria-describedby')}});}
 function show(trigger,value,ids,selected){clear();const relation=e=>selected?e.id===selected:e.from===ids||e.to===ids,related=edges.filter(relation),neighbors=new Set([ids,...related.flatMap(e=>[e.from,e.to])]);objects.forEach(({n,b})=>b.style.opacity=neighbors.has(n.id)?'1':'.3');edges.forEach(e=>{const hit=related.includes(e);e.path.style.opacity=e.head.style.opacity=hit?'1':'.18';e.path.style.stroke=e.head.style.fill=hit?'var(--viz-series-1)':'';if(e.label)e.label.style.opacity=hit?'1':'.3'});
  if(!value)return;tip.style.position='absolute';tip.style.marginTop='';drawTip(value);tip.style.maxWidth=Math.min(280,root.clientWidth-8)+'px';tip.hidden=false;trigger.setAttribute('aria-describedby',tip.id);const rr=root.getBoundingClientRect(),r=trigger.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight,x=r.left-rr.left,y=r.top-rr.top;
  const candidates=[[x+r.width+12,y],[x-w-12,y],[x+(r.width-w)/2,y-h-12],[x+(r.width-w)/2,y+r.height+12]].map(([x,y])=>({x:Math.max(4,Math.min(root.clientWidth-w-4,x)),y:Math.max(4,Math.min(root.clientHeight-h-4,y))}));
  for(let cy=Math.max(4,y-320);cy<=Math.min(root.clientHeight-h-4,y+320);cy+=32)for(let cx=4;cx<=root.clientWidth-w-4;cx+=32)candidates.push({x:cx,y:cy});
  const obstacles=[...objects.map(n=>n.b),...edges.flatMap(e=>[e.head,e.label].filter(Boolean))].map(n=>{const r=n.getBoundingClientRect();return {x:r.left-rr.left,y:r.top-rr.top,w:Math.max(6,r.width),h:Math.max(6,r.height),priority:n===trigger?10000:20}});
  for(const e of edges){const matrix=e.path.getScreenCTM(),len=e.path.getTotalLength();for(let d=0;d<len;d+=8){const a=new DOMPoint(e.path.getPointAtLength(d).x,e.path.getPointAtLength(d).y).matrixTransform(matrix),p=e.path.getPointAtLength(Math.min(len,d+8)),b=new DOMPoint(p.x,p.y).matrixTransform(matrix);obstacles.push({x:Math.min(a.x,b.x)-rr.left-3,y:Math.min(a.y,b.y)-rr.top-3,w:Math.abs(a.x-b.x)+6,h:Math.abs(a.y-b.y)+6,priority:1});}}
  for(const c of candidates)c.score=obstacles.reduce((s,o)=>s+(o.priority||1)*Math.max(0,Math.min(c.x+w,o.x+o.w)-Math.max(c.x,o.x))*Math.max(0,Math.min(c.y+h,o.y+o.h)-Math.max(c.y,o.y)),0);candidates.sort((a,b)=>a.score-b.score||Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));if(candidates[0].score>0){tip.style.position='relative';tip.style.left='0';tip.style.top='0';tip.style.marginTop='12px';}else{tip.style.left=candidates[0].x+'px';tip.style.top=candidates[0].y+'px';}
 }
 if(window.lucide)window.lucide.createIcons({attrs:{width:14,height:14}});
 const bind=(b,show)=>{b.onpointerenter=show;b.onpointerleave=clear;b.onfocus=show;b.onblur=clear;b.onclick=show};objects.forEach(({n,b})=>bind(b,()=>show(b,n.description?{title:n.name,description:n.description}:null,n.id)));objects.forEach(({n,b})=>{if(sourceGroups.has(n.id)||n.targetGroup!==undefined)b.onclick=()=>navigate(n.targetGroup!==undefined?n.targetGroup:n.id);});edges.forEach(e=>{if(e.label)bind(e.label,()=>show(e.label,{from:map.get(e.from).name,to:map.get(e.to).name,label:e.labelText,count:e.bundleCount||1},null,e.id))});
 viewport.addEventListener('scroll',clear,{passive:true,signal});root.addEventListener('qv:display-mode',clear,{signal});document.addEventListener('keydown',e=>{if(e.key==='Escape')clear()},{signal});
 const reduced=matchMedia('(prefers-reduced-motion:reduce)'),defs=element('defs',{});let running=[],armed=true;
 edges.forEach((e,i)=>{const length=e.path.getTotalLength(),id=root.id+'-state-mask-'+i,mask=element('mask',{id,maskUnits:'userSpaceOnUse',x:0,y:0,width,height},defs);e.reveal=element('path',{d:e.path.getAttribute('d'),fill:'none',stroke:'white','stroke-width':8,'stroke-dasharray':`${length} ${length}`},mask);e.path.setAttribute('mask',`url(#${id})`)});
 function replay(){running.forEach(a=>a.cancel());running=[];if(reduced.matches||view.expanded)return;objects.forEach(({n,b})=>running.push(b.animate([{opacity:0,transform:'scale(.08)'},{opacity:1,transform:'scale(1)'}],{duration:240,delay:(n.layer||0)*180,fill:'backwards',easing:'cubic-bezier(.2,.65,.3,1)'})));edges.forEach(e=>{const delay=(map.get(e.from).layer||0)*180+110;running.push(e.reveal.animate([{strokeDashoffset:e.path.getTotalLength()},{strokeDashoffset:0}],{duration:650,delay,fill:'backwards'}));running.push(e.head.animate([{opacity:0},{opacity:1}],{duration:50,delay:delay+650,fill:'backwards'}));if(e.label)running.push(e.label.animate([{opacity:0},{opacity:1}],{duration:180,delay:delay+120,fill:'backwards'}))});root.dataset.replays=String(+(root.dataset.replays||0)+1)}
 const observer=new IntersectionObserver(es=>{if(!es[0].isIntersecting)armed=true;else if(es[0].intersectionRatio>=.2&&armed){armed=false;replay()}},{threshold:[0,.2]});observer.observe(root);document.addEventListener('visibilitychange',()=>{if(document.hidden)armed=true;else if(armed){armed=false;replay()}},{signal});root.addEventListener('qv:display-mode',()=>running.forEach(a=>a.cancel()),{signal});reduced.addEventListener('change',()=>running.forEach(a=>a.cancel()),{signal});dispose=()=>{abort.abort();observer.disconnect();running.forEach(a=>a.cancel());};view.refresh();
 }
 root.dataset.scope='complete';draw(data);navigation();
}
