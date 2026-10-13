// 浮层避让只在触发对象附近进行，局部遮挡优先于失去关联。
function placeMermaidDetail(root,tip,anchor,event,preferredWidth=280){
 const rr=root.getBoundingClientRect(),r=anchor?.getBoundingClientRect();
 if(!r)return;
 tip.style.position='absolute';tip.style.marginTop='0';tip.style.width=Math.min(preferredWidth,root.clientWidth-16)+'px';tip.style.maxWidth='calc(100% - 8px)';tip.style.boxSizing='border-box';tip.style.overflowWrap='anywhere';
 const w=tip.offsetWidth,h=tip.offsetHeight,pointer=event?.type?.startsWith('pointer'),x=pointer?event.clientX-rr.left:r.left-rr.left,y=pointer?event.clientY-rr.top:r.top-rr.top,aw=pointer?0:r.width,ah=pointer?0:r.height;
 const candidates=[];
 for(const gap of [12,20,28])for(const [left,top]of [[x+aw+gap,y+(ah-h)/2],[x-w-gap,y+(ah-h)/2],[x+(aw-w)/2,y-h-gap],[x+(aw-w)/2,y+ah+gap]]){
  const c={x:Math.max(4,Math.min(root.clientWidth-w-4,left)),y:Math.max(4,Math.min(root.clientHeight-h-4,top))};
  c.distance=Math.hypot(Math.max(x-c.x-w,c.x-x-aw,0),Math.max(y-c.y-h,c.y-y-ah,0));if(c.distance<=32)candidates.push(c);
 }
 const overlap=(c,o)=>Math.max(0,Math.min(c.x+w,o.x+o.w)-Math.max(c.x,o.x))*Math.max(0,Math.min(c.y+h,o.y+o.h)-Math.max(c.y,o.y));
 const obstacles=[...root.querySelectorAll('button,h3')].filter(n=>n!==anchor&&!tip.contains(n)).map(n=>{const b=n.getBoundingClientRect();return{x:b.left-rr.left,y:b.top-rr.top,w:b.width,h:b.height};});
 for(const c of candidates){c.anchor=overlap(c,{x,y,w:aw,h:ah});c.score=obstacles.reduce((sum,o)=>sum+overlap(c,o),0)+c.distance*8;}
 candidates.sort((a,b)=>a.anchor-b.anchor||a.score-b.score);const c=candidates[0]||{x:Math.max(4,Math.min(root.clientWidth-w-4,x)),y:y+ah+12};
 tip.style.left=c.x+'px';tip.style.top=c.y+'px';tip.dataset.placement='near';
}
function createMermaidHover(root,clear){
 let enter=0,leave=0,current=null;
 const cancel=()=>{clearTimeout(enter);clearTimeout(leave);};const reset=()=>{current=null;clear();};
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){cancel();current=null;}});root.addEventListener('qv:display-mode',cancel);
 return (element,activate)=>{
  const queue=()=>{cancel();if(current!==element)enter=setTimeout(()=>{current=element;activate();},100);};element.onpointerenter=queue;element.onpointermove=queue;
  element.onpointerleave=()=>{clearTimeout(enter);leave=setTimeout(reset,160);};
  element.onfocus=()=>{cancel();current=element;activate(true);};element.onblur=()=>{cancel();reset();};element.onclick=()=>{cancel();current=element;activate(true);};
 };
}
function mermaidContainmentSurface(data,id){
 const groups=new Map(data.groups.map(n=>[n.id,n]));const height=id=>{const children=data.nodes.filter(n=>n.parent===id).concat(data.groups.filter(n=>n.parent===id));return children.length?1+Math.max(...children.map(n=>groups.has(n.id)?height(n.id):0)):1;};
 return height(id)%2?'color-mix(in srgb,var(--muted) 18%,var(--background))':'var(--background)';
}
