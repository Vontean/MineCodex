function renderMermaidSequence(root,data,cfg) {
  root.classList.add('qv-sequence');root.dataset.renderer='qv-sequence';root.dataset.state='enhanced';
  const scene=root.querySelector('.scene'),viewport=root.querySelector('.diagram-scroll'),svg=scene.querySelector('svg'),NS='http://www.w3.org/2000/svg';
  viewport.setAttribute('aria-label','时序图，消息顺序从上到下，可横向滚动');root.querySelector('.edge-key').hidden=true;
  const style=document.createElement('style');style.textContent=`
  #${root.id} .seq-header{position:absolute;display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;border:1px solid var(--border);border-radius:10px;background:var(--background);color:var(--foreground);font:inherit;font-weight:500;padding:12px;line-height:20px;white-space:normal;overflow-wrap:anywhere;cursor:var(--cursor-interaction,pointer)}
  #${root.id} .seq-life{stroke:var(--border);stroke-width:1;stroke-dasharray:3 5}
  #${root.id} .seq-message{fill:none;stroke:light-dark(#727a82,#a3aab3);stroke-width:1}
  #${root.id} .seq-arrow{fill:light-dark(#727a82,#a3aab3);stroke:none}
  #${root.id} .seq-label{position:absolute;border:0;background:var(--background);color:var(--foreground);font:inherit;font-size:12px;line-height:18px;min-height:0;padding:2px 7px;border-radius:4px;white-space:normal;overflow-wrap:anywhere;text-align:center;cursor:var(--cursor-interaction,pointer);transform:translateX(-50%)}
  #${root.id} .seq-number{font-variant-numeric:tabular-nums;color:light-dark(color-mix(in srgb,var(--foreground) 60%,var(--background)),color-mix(in srgb,var(--foreground) 68%,var(--background)));margin-right:8px}
  #${root.id} .seq-frame{fill:transparent;stroke:color-mix(in srgb,var(--muted-foreground) 48%,var(--background));stroke-width:1}
  #${root.id} .seq-branch{position:absolute;font-size:12px;color:light-dark(color-mix(in srgb,var(--foreground) 60%,var(--background)),color-mix(in srgb,var(--foreground) 68%,var(--background)));padding:0 8px;background:var(--background)}
  #${root.id} .seq-note{position:absolute;padding:10px 12px;border-left:2px solid var(--border);color:light-dark(color-mix(in srgb,var(--foreground) 60%,var(--background)),color-mix(in srgb,var(--foreground) 68%,var(--background)));font-size:12px;background:var(--background)}
  #${root.id} .seq-activation{fill:light-dark(color-mix(in srgb,var(--viz-series-1) 16%,var(--background)),color-mix(in srgb,var(--viz-series-1) 26%,var(--background)));stroke:color-mix(in srgb,var(--viz-series-1) 65%,var(--background));stroke-width:1}
  #${root.id} .seq-tip{position:absolute;z-index:10;max-width:280px;padding:12px 14px;border-radius:12px;background:var(--popover);color:var(--popover-foreground);box-shadow:0 3px 12px #0002;font-size:12px;pointer-events:none}
  #${root.id} .seq-hit{transition:opacity 140ms ease} #${root.id} .seq-hit.is-related .seq-message{stroke:var(--viz-series-1);stroke-width:1.4} #${root.id} .seq-hit.is-related .seq-arrow{fill:var(--viz-series-1)}
  #${root.id} .seq-open{fill:none;stroke:var(--muted-foreground)} #${root.id} .seq-hit.is-related .seq-open{fill:none;stroke:var(--viz-series-1)}
  @media(prefers-reduced-motion:reduce){#${root.id} .seq-hit{transition:none}}
  `;root.append(style);
  const tip=document.createElement('div');tip.className='seq-tip';tip.hidden=true;tip.setAttribute('role','tooltip');root.append(tip);
  const el=(tag,attrs,parent=svg)=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;};
  const text=(cls,value,x,y)=>{const e=document.createElement('div');e.className=cls;e.textContent=value;e.style.left=x+'px';e.style.top=y+'px';scene.append(e);return e;};
  const metrics=document.createElement('canvas').getContext('2d');metrics.font='12px '+getComputedStyle(root).fontFamily;
  const measure=value=>Math.ceil(metrics.measureText(String(value)).width);
  const spacing=Math.max(220,...data.messages.filter(m=>[0,1,3,4,5,6,24,25,33,34].includes(m.type)&&m.from!==m.to).map(m=>Math.min(288,measure(m.message))+48));
  const pad=100,notes=data.messages.filter(m=>m.type===2),selfs=data.messages.filter(m=>m.from===m.to&&[0,1,3,4,5,6,24,25,33,34].includes(m.type));
  const leftExtra=Math.max(0,...notes.filter(m=>m.placement===0&&m.from===data.actors[0].id).map(m=>Math.min(280,measure(m.message)+28)-48));
  const rightExtra=Math.max(0,...notes.filter(m=>m.placement===1&&m.from===data.actors.at(-1).id).map(m=>Math.min(280,measure(m.message)+28)-48),...selfs.filter(m=>m.from===data.actors.at(-1).id).map(m=>Math.min(288,measure(m.message))+32));
  const core=Math.max(root.clientWidth-leftExtra-rightExtra,pad*2+(data.actors.length-1)*spacing+120),width=core+leftExtra+rightExtra,step=(core-pad*2-120)/Math.max(1,data.actors.length-1),xs=new Map(data.actors.map((a,i)=>[a.id,leftExtra+pad+60+i*step]));
  // 固定几何宽度，展开时由共享视口整体缩放，HTML 和 SVG 不单独伸展。
  scene.style.width=width+'px';scene.style.minWidth=width+'px';const headers=[],marks=[],labels=[],frames=[],active=new Map();const probe=document.createElement('span');probe.style.cssText='position:absolute;left:-100000px;font:12px/18px '+getComputedStyle(root).fontFamily+';white-space:pre-wrap;overflow-wrap:anywhere';root.append(probe);const textHeight=(text,width)=>{probe.style.width=width+'px';probe.textContent=text;return probe.offsetHeight;};let y=Math.max(92,...data.actors.map(a=>textHeight(a.name,156)+60));
  const activationLayer=el('g',{class:'seq-activations'});svg.prepend(activationLayer);let lastMessageY=y;
  const activation=(actor,start,end,depth)=>{const bar=el('rect',{x:xs.get(actor)-5+depth*4,y:start,width:10,height:Math.max(12,end-start),class:'seq-activation','data-actor':actor,'data-depth':depth},activationLayer);activationLayer.prepend(bar);};
  const starts={10:'loop',12:'alt',15:'opt',19:'par',27:'critical',30:'break'},ends=new Set([11,14,16,21,29,31]),branches=new Set([13,20,28]);
  for(const [messageIndex,m] of data.messages.entries()){
    if(m.type===26)continue;
    if(starts[m.type]){frames.push({kind:starts[m.type],label:m.message,y:y-10,depth:frames.length});text('seq-branch',starts[m.type]+' · '+m.message,24+frames.length*8,y-17);y+=34;continue;}
    if(branches.has(m.type)){const f=frames.at(-1);el('line',{x1:24+f.depth*8,y1:y-10,x2:width-24-f.depth*8,y2:y-10,class:'seq-life'});text('seq-branch',(m.type===13?'else':'and')+' · '+m.message,32+f.depth*8,y-17);y+=34;continue;}
    if(ends.has(m.type)){const f=frames.pop();el('rect',{x:24+f.depth*8,y:f.y,width:width-48-f.depth*16,height:y-f.y-6,rx:6,class:'seq-frame'});y+=22;continue;}
    if(m.type===17){const list=active.get(m.from)||[];list.push(lastMessageY);active.set(m.from,list);continue;}
    if(m.type===18){const list=active.get(m.from)||[],start=list.pop();activation(m.from,start,lastMessageY,list.length);continue;}
    if(m.type===2){const from=xs.get(m.from),to=xs.get(m.to||m.from),nw=m.placement===2?Math.max(140,Math.abs(to-from)+96):Math.min(280,measure(m.message)+28),nx=m.placement===0?from-nw-12:m.placement===1?from+12:(from+to-nw)/2,note=text('seq-note',m.message,nx,y-10);note.style.width=nw+'px';note.dataset.placement=m.placement;y+=Math.max(60,note.offsetHeight+24);continue;}
    const labelWidth=Math.min(288,Math.max(48,measure(m.message)+(m.number===undefined?14:40))),labelHeight=textHeight(m.message,labelWidth-40)+4;y+=Math.max(0,labelHeight-22);
    // 激活条跟随真实消息位置；线和箭头位于柱子上层，端点接到柱子边缘。
    const sourceX=xs.get(m.from),targetX=xs.get(m.to),self=sourceX===targetX,direction=targetX>=sourceX?1:-1,next=data.messages[messageIndex+1],sourceDepth=(active.get(m.from)||[]).length,targetDepth=(active.get(m.to)||[]).length+(next?.type===17&&next.from===m.to?1:0),a=sourceX+(sourceDepth?(-5+(sourceDepth-1)*4+(direction>0||self?10:0)):0),b=targetX+(targetDepth?(-5+(targetDepth-1)*4+(direction<0||self?10:0)):0),g=el('g',{class:'seq-hit','data-message':m.id});
    const end=b-(self?0:5*direction),path=el('path',{d:self?`M${a} ${y}h46q8 0 8 8v12q0 8 -8 8H${b}`:`M${a} ${y}H${end}`,class:'seq-message',...( [1,4,6,25,34].includes(m.type)?{'stroke-dasharray':'4 4'}:{})},g);
    const ey=self?y+28:y,dx=self?-1:direction;lastMessageY=ey;
    if([3,4].includes(m.type))el('path',{d:`M${b-3} ${ey-3}l6 6m0 -6l-6 6`,class:'seq-message'},g);
    else if(![5,6].includes(m.type)){const arrow=el('path',{d:[24,25].includes(m.type)?`M${b-5*dx} ${ey-2.5}L${b} ${ey}L${b-5*dx} ${ey+2.5}`:`M${b} ${ey}l${-5*dx} -2.5v5Z`,class:[24,25].includes(m.type)?'seq-arrow seq-open':'seq-arrow'},g);if([33,34].includes(m.type))el('path',{d:`M${a} ${y}l${5*dx} -2.5v5Z`,class:'seq-arrow'},g);}
    const label=document.createElement('button');label.type='button';label.className='seq-label';label.style.width=labelWidth+'px';label.style.left=(self?a+12+labelWidth/2:(a+b)/2)+'px';label.style.top=(y-labelHeight-10)+'px';const num=document.createElement('span');num.className='seq-number';num.textContent=m.number===undefined?'':String(m.number);if(m.number!==undefined)label.append(num);label.append(document.createTextNode(m.message));scene.append(label);label.dataset.message=m.id;label.setAttribute('aria-label',`${m.number??''} ${data.actors.find(n=>n.id===m.from).name} → ${data.actors.find(n=>n.id===m.to).name}：${m.message}`);marks.push({m,g,path,label});labels.push(label);y+=Math.max(self?88:60,labelHeight+36+(self?28:0));
  }
  for(const [actor,list] of active)list.forEach((start,depth)=>activation(actor,start,lastMessageY+24,depth));
  scene.style.height=(y+12)+'px';svg.style.height=(y+12)+'px';svg.setAttribute('viewBox',`0 0 ${width} ${y+12}`);
  for(const a of data.actors){const x=xs.get(a.id),life=el('line',{x1:x,y1:48,x2:x,y2:y,class:'seq-life'});svg.prepend(life);const h=document.createElement('button');h.type='button';h.className='seq-header';if(a.type==='actor'){const icon=document.createElement('i');icon.setAttribute('data-lucide','user-round');icon.setAttribute('aria-hidden','true');h.append(icon);}h.append(document.createTextNode(a.name));const hw=Math.min(240,Math.max(156,Math.ceil(measure(a.name)*7/6)+50));h.style.cssText=`left:${x-hw/2}px;top:0;width:${hw}px`;scene.append(h);headers.push({a,h});}
  probe.remove();window.lucide?.createIcons({attrs:{width:16,height:16}});
  const view=createMermaidViewport(root);
  tip.id=root.id+'-sequence-tip';
  function clear(){tip.hidden=true;for(const mark of marks){mark.g.style.opacity='';mark.label.style.opacity='';mark.g.classList.remove('is-related');mark.label.removeAttribute('aria-describedby');}headers.forEach(({h})=>{h.style.opacity='';h.removeAttribute('aria-describedby');});}
  function placeTip(trigger,value,related=[]){tip.textContent=value;tip.style.maxWidth=Math.min(280,root.clientWidth-8)+'px';tip.hidden=false;trigger.setAttribute('aria-describedby',tip.id);const rr=root.getBoundingClientRect(),b=trigger.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight,box={x:b.left-rr.left,y:b.top-rr.top,w:b.width,h:b.height};
    placeMermaidDetail(root,tip,trigger);
  }
  function focus(m,label){for(const mark of marks){const related=mark.m.id===m.id;mark.g.classList.toggle('is-related',related);mark.g.style.opacity=related?'1':'.18';mark.label.style.opacity=related?'1':'.3';}headers.forEach(({a,h})=>h.style.opacity=a.id===m.from||a.id===m.to?'1':'.3');placeTip(label,'',[]);tip.replaceChildren();const route=document.createElement('div');route.className='seq-tip-title';route.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:12px;margin-bottom:12px';for(const text of [data.actors.find(a=>a.id===m.from).name,'→',data.actors.find(a=>a.id===m.to).name]){const n=document.createElement('span');n.textContent=text;route.append(n);}tip.append(route);const message=document.createElement('div');message.textContent=m.message;tip.append(message);placeMermaidDetail(root,tip,label);}
  let keyboardTarget=null;const bind=createMermaidHover(root,clear);marks.forEach(({m,label})=>bind(label,ensure=>{clear();keyboardTarget=ensure?label:null;focus(m,label);}));
  function focusActor(a,h){const related=marks.filter(n=>n.m.from===a.id||n.m.to===a.id);for(const mark of marks){const hit=related.includes(mark);mark.g.style.opacity=hit?'1':'.18';mark.label.style.opacity=hit?'1':'.3';mark.g.classList.toggle('is-related',hit);}headers.forEach(n=>n.h.style.opacity=n.a.id===a.id?'1':'.3');if(a.description)placeTip(h,a.description,related);}
  headers.forEach(({a,h})=>bind(h,ensure=>{clear();keyboardTarget=ensure?h:null;focusActor(a,h);}));
  let focusRestore=0;const cancelRestore=()=>{clearTimeout(focusRestore);keyboardTarget=null;clear();};
  viewport.addEventListener('scroll',()=>{clearTimeout(focusRestore);clear();const active=document.activeElement,mark=marks.find(n=>n.label===active),header=headers.find(n=>n.h===active);if(active===keyboardTarget&&(mark||header))focusRestore=setTimeout(()=>{if(document.activeElement!==active)return;if(mark)focus(mark.m,mark.label);else focusActor(header.a,header.h);},120);},{passive:true});root.addEventListener('qv:display-mode',cancelRestore);document.addEventListener('keydown',e=>{if(e.key==='Escape')cancelRestore();});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let animations=[],armed=true;
  const defs=el('defs',{});marks.forEach(({m,path})=>{const id=root.id+'-seq-mask-'+m.id,length=path.getTotalLength(),mask=el('mask',{id,maskUnits:'userSpaceOnUse',x:0,y:0,width,height:y+12},defs),reveal=el('path',{d:path.getAttribute('d'),fill:'none',stroke:'white','stroke-width':8,'stroke-dasharray':`${length} ${length}`},mask);path.setAttribute('mask',`url(#${id})`);m.reveal=reveal;});
  function replay(){animations.forEach(a=>a.cancel());animations=[];if(reduced.matches||view.expanded)return;for(const [i,{m,g,path,label}] of marks.entries()){const length=path.getTotalLength(),delay=i*Math.min(140,900/Math.max(1,marks.length-1));animations.push(m.reveal.animate([{strokeDashoffset:length},{strokeDashoffset:0}],{duration:420,delay,easing:'cubic-bezier(.2,.7,.3,1)',fill:'backwards'}));animations.push(label.animate([{opacity:0},{opacity:1}],{duration:180,delay:delay+70,fill:'backwards'}));g.querySelectorAll('.seq-arrow').forEach(arrow=>animations.push(arrow.animate([{opacity:0},{opacity:1}],{duration:60,delay:delay+400,fill:'backwards'})));}root.dataset.replays=String(+(root.dataset.replays||0)+1);}
  new IntersectionObserver(es=>{if(!es[0].isIntersecting)armed=true;else if(es[0].intersectionRatio>=.2&&armed){armed=false;replay();}},{threshold:[0,.2]}).observe(root);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)armed=true;else if(armed){armed=false;replay();}});root.addEventListener('qv:display-mode',()=>animations.forEach(a=>a.cancel()));reduced.addEventListener('change',()=>animations.forEach(a=>a.cancel()));view.refresh();
}
