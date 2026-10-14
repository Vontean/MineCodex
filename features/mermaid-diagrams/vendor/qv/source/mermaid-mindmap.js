// 复用已审视的双侧树布局；全部层级来自 Mermaid DB。
function renderMermaidMindmap(root,data){
 root.dataset.state='enhanced';root.dataset.renderer='qv-mindmap';root.querySelector('.edge-key').hidden=true;
 const scene=root.querySelector('.scene'),svg=root.querySelector('.wires'),viewport=root.querySelector('.diagram-scroll'),tip=root.querySelector('.node-tip');
 viewport.setAttribute('aria-label','思维导图，可横向滚动');
 const style=document.createElement('style');style.textContent=`
#${root.id}{position:relative;padding-top:32px;color:var(--foreground);width:100%}
#${root.id} h3{font-weight:500;margin:0 90px 32px 0}
#${root.id} .diagram-scroll{overflow-x:auto;width:100%;padding-bottom:8px}
#${root.id} .scene{position:relative;margin:auto;height:364px}
#${root.id} .wires{position:absolute;inset:0;overflow:visible;pointer-events:none}
#${root.id} .wire{fill:none;stroke:color-mix(in srgb,var(--muted-foreground) 26%,var(--background));stroke-width:1;transition:opacity 140ms}
#${root.id} button.node{position:absolute;display:flex;align-items:center;justify-content:center;font:inherit;font-size:12px;color:var(--foreground);background:var(--background);border:1px solid var(--border);border-radius:10px;padding:12px 14px;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;line-height:1.6;transition:opacity 140ms,border-color 140ms;cursor:var(--cursor-interaction,pointer)}
#${root.id} button.node.root{font-size:14px;font-weight:500;background:color-mix(in srgb,var(--muted) 30%,var(--background))}
#${root.id} button.node.leaf,#${root.id} button.node.twig{border:0;background:transparent;justify-content:flex-start;text-align:left;padding:6px 12px} #${root.id} button.node.twig{font-weight:500}
#${root.id} button.node.leaf.left,#${root.id} button.node.twig.left{justify-content:flex-end;text-align:right}
#${root.id} button.node:hover{border-color:var(--muted-foreground)}
#${root.id} button.node.dim{opacity:.22}
#${root.id} .wire.dim{opacity:.055}
#${root.id} .wire.active{stroke:var(--muted-foreground)}
#${root.id} .error{color:var(--muted-foreground)}
@media(prefers-reduced-motion:reduce){#${root.id} button.node,#${root.id} .wire{transition:none}}

#${root.id} button.node{min-width:0;transform:none;text-align:center} #${root.id} .scene{min-width:0;margin:0} #${root.id} button.node-tip{max-width:260px}
`;root.append(style);
 const NS='http://www.w3.org/2000/svg',reduce=matchMedia('(prefers-reduced-motion:reduce)'),view=createMermaidViewport(root),isExpanded=()=>view.expanded;
 const model=data.nodes;let animations=[],visible=false,replayArmed=true,viewGeometry=null,inlineOffset=0;
function highlight(id){const target=model.find(n=>n.id===id);if(target.description){tip.textContent=target.description;tip.hidden=false;tip.style.left='8px';tip.style.top='48px';}else tip.hidden=true;const active=new Set();let n=target;while(n){active.add(n.id);n=model.find(t=>t.id===n.parent);}const descendants=p=>{for(const c of model.filter(t=>t.parent===p)){active.add(c.id);descendants(c.id);}};descendants(id);scene.querySelectorAll('.node').forEach(b=>b.classList.toggle('dim',!active.has(b.dataset.id)));svg.querySelectorAll('.wire').forEach(p=>{const a=active.has(p.dataset.from)&&active.has(p.dataset.to);p.classList.toggle('dim',!a);p.classList.toggle('active',a);});}
function clear(){tip.hidden=true;scene.querySelectorAll('.dim,.active').forEach(n=>n.classList.remove('dim','active'));}
function replay(){if(reduce.matches||isExpanded())return;animations.forEach(a=>a.cancel());animations=[];scene.querySelectorAll('.node').forEach(b=>{animations.push(b.animate([{transform:'scale(.08)',opacity:0},{transform:'scale(1)',opacity:1}],{duration:240,delay:+b.dataset.depth*220,easing:'cubic-bezier(.2,.7,.3,1)',fill:'backwards'}));});svg.querySelectorAll('.wire').forEach(p=>{const length=p.getTotalLength();animations.push(p.animate([{strokeDasharray:`${length} ${length}`,strokeDashoffset:length},{strokeDasharray:`${length} ${length}`,strokeDashoffset:0}],{duration:650,delay:+p.dataset.depth*220,easing:'cubic-bezier(.2,.7,.3,1)',fill:'backwards'}));});root.dataset.replays=String(+(root.dataset.replays||0)+1);}
function draw(){
 const viewOffset=viewGeometry?.mode==='inline'?viewport.scrollLeft+viewGeometry.viewportWidth/2-viewGeometry.rootCenter:inlineOffset;
 if(viewGeometry?.mode==='inline')inlineOffset=viewOffset;
 scene.style.transform='';scene.style.marginLeft='';viewport.style.height='';
 animations.forEach(a=>a.cancel());svg.replaceChildren();scene.querySelectorAll('.node').forEach(n=>n.remove());
 const byId=new Map(model.map(n=>[n.id,n])),buttons=new Map(),sizes=new Map(),spans=new Map(),positions=new Map();
 const canvas=document.createElement('canvas'),context=canvas.getContext('2d');context.font='12px '+getComputedStyle(root).fontFamily;
 for(const n of model){
  const leaf=n.children.length===0,b=document.createElement('button');b.type='button';b.className='node '+(n.depth===0?'root':n.depth===1?'branch':leaf?'leaf':'twig');b.textContent=n.label;b.dataset.id=n.id;b.dataset.depth=n.depth;b.setAttribute('aria-label',n.label+(n.description?' · '+n.description:''));
  const w=n.depth===0?116:n.depth===1?100:Math.min(140,Math.max(76,Math.ceil(context.measureText(n.label).width)+32));
  Object.assign(b.style,{width:w+'px',minHeight:'44px',height:'auto',visibility:'hidden'});scene.append(b);
  const h=Math.max(44,Math.ceil(b.offsetHeight));sizes.set(n.id,{w,h});buttons.set(n.id,b);
  b.addEventListener('mouseenter',()=>highlight(n.id));b.addEventListener('mouseleave',clear);b.addEventListener('focus',()=>highlight(n.id));b.addEventListener('blur',clear);
 }
 function span(id){const n=byId.get(id),h=n.children.length?n.children.reduce((s,c)=>s+span(String(c.id)),0)+(n.children.length-1)*6:sizes.get(id).h;spans.set(id,Math.max(sizes.get(id).h,h));return spans.get(id);}
 const top=model[0],branches=model.filter(n=>n.depth===1),sides={left:[],right:[]},totals={left:0,right:0};
 for(const n of branches){span(n.id);const side=totals.left<=totals.right?'left':'right';sides[side].push(n);totals[side]+=spans.get(n.id)+(sides[side].length>1?30:0);}
 const columns={left:[],right:[]};
 function measure(id,side){const n=byId.get(id);columns[side][n.depth]=Math.max(columns[side][n.depth]||0,sizes.get(id).w);for(const c of n.children)measure(String(c.id),side);}
 for(const side of ['left','right'])for(const n of sides[side])measure(n.id,side);
 const gap=28,margin=20,extent=side=>columns[side].slice(1).reduce((s,w)=>s+w+gap,0),leftExtent=extent('left'),rightExtent=extent('right'),rw=sizes.get(top.id).w;
 // 两侧预留相同画布空间，让根节点可停在可见窗口中心。
 const width=Math.max(viewport.clientWidth,2*Math.max(leftExtent,rightExtent)+rw+margin*2),height=Math.max(300,totals.left,totals.right)+32,cx=(width-rw)/2,cy=height/2;
 scene.style.width=scene.style.minWidth=width+'px';scene.style.height=height+'px';svg.setAttribute('width',width);svg.setAttribute('height',height);positions.set(top.id,{x:cx,y:cy-sizes.get(top.id).h/2,...sizes.get(top.id)});
 function place(id,side,start){const n=byId.get(id),s=sizes.get(id),center=start+spans.get(id)/2;
  const offset=gap+columns[side].slice(1,n.depth).reduce((sum,w)=>sum+w+gap,0);
  const x=side==='left'?cx-offset-s.w:cx+rw+offset;positions.set(id,{x,y:center-s.h/2,...s,side});
  if(n.children.length){const kidsHeight=n.children.reduce((sum,c)=>sum+spans.get(String(c.id)),0)+(n.children.length-1)*6;let cursor=center-kidsHeight/2;for(const c of n.children){place(String(c.id),side,cursor);cursor+=spans.get(String(c.id))+6;}}
 }
 for(const side of ['left','right']){let cursor=(height-totals[side])/2;for(const n of sides[side]){place(n.id,side,cursor);cursor+=spans.get(n.id)+30;}}
 for(const n of model){const p=positions.get(n.id),b=buttons.get(n.id);b.classList.toggle('left',p.side==='left');Object.assign(b.style,{left:p.x+'px',top:p.y+'px',height:p.h+'px',visibility:''});
  if(n.parent){const a=positions.get(n.parent),left=p.side==='left',sx=left?a.x:a.x+a.w,ex=left?p.x+p.w:p.x,sy=a.y+a.h/2,ey=p.y+p.h/2,mid=(sx+ex)/2;
   const path=document.createElementNS(NS,'path');path.setAttribute('d',`M${sx},${sy} C${mid},${sy} ${mid},${ey} ${ex},${ey}`);path.setAttribute('class','wire');Object.assign(path.dataset,{from:n.parent,to:n.id,depth:n.depth-1});svg.append(path);}
 }
 view.refresh();
 if(!view.expanded){viewport.scrollLeft=cx+rw/2+viewOffset-viewport.clientWidth/2;}
 viewGeometry={viewportWidth:viewport.clientWidth,rootCenter:cx+rw/2,mode:view.expanded?'fullscreen':'inline'};
 root.dataset.nodes=String(model.length);root.dataset.depth=String(Math.max(...model.map(n=>n.depth))+1);root.dataset.sides=JSON.stringify({left:sides.left.map(n=>n.label),right:sides.right.map(n=>n.label)});
}


 draw();let lastWidth=root.clientWidth;
 new ResizeObserver(()=>{if(lastWidth===root.clientWidth)return;lastWidth=root.clientWidth;draw();}).observe(root);
 root.addEventListener('qv:display-mode',()=>{clear();draw();if(!view.expanded&&view.savedInlinePosition)viewport.scrollLeft=view.savedInlinePosition.left;});
 new IntersectionObserver(entries=>{const e=entries[0];if(!e.isIntersecting){visible=false;replayArmed=true;}else if(e.intersectionRatio>=.2){visible=true;if(replayArmed){replay();replayArmed=false;}}},{threshold:[0,.2]}).observe(root);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&visible)replay();});
 viewport.addEventListener('scroll',()=>{clear();const focused=document.activeElement;if(scene.contains(focused)&&focused.dataset.id)highlight(focused.dataset.id);},{passive:true});
 root.addEventListener('keydown',e=>{if(e.key==='Escape')clear();});
 reduce.addEventListener('change',()=>{if(reduce.matches)animations.forEach(a=>a.cancel());});view.refresh();
}
