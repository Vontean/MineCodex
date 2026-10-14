// 保留原网格顺序与跨列；字号、行高和连接路由由 qv 决定。
function layoutMermaidBlocks(data,measure,{cell=160,gap=24,padding=24}={}){
 const boxes=new Map(),rows=[];
 function minimum(n){
  if(n.type==='space')return {w:0,h:24};
  if(n.type!=='group')return {w:cell,h:measure(n,cell)};
  const cols=n.columns>0?n.columns:Math.max(1,n.children.reduce((s,c)=>s+c.span,0));let unit=cell;
  for(const c of n.children){const m=minimum(c);unit=Math.max(unit,(m.w-gap*(c.span-1))/c.span);}
  return {w:cols*unit+(cols-1)*gap+2*padding,h:0};
 }
 function place(n,x,y,width){
  if(n.type!=='group'){const h=n.type==='space'?24:measure(n,width),box={...n,x,y,w:width,h};boxes.set(n.id,box);return h;}
  const cols=n.columns>0?n.columns:Math.max(1,n.children.reduce((s,c)=>s+c.span,0)),unit=(width-2*padding-gap*(cols-1))/cols,head=n.id!=='root'&&n.name?Math.max(32,measure(n,width-2*padding)-12):0;
  let position=0;const grouped=[];
  for(const c of n.children){const col=position%cols,row=Math.floor(position/cols);(grouped[row]||=[]).push({n:c,col});position+=c.span;}
  let rowY=y+padding+head;
  for(let row=0;row<grouped.length;row++){
   let rowH=0;for(const c of grouped[row]||[]){const w=c.n.span*unit+(c.n.span-1)*gap;rowH=Math.max(rowH,place(c.n,x+padding+c.col*(unit+gap),rowY,w));}
   rows.push({parent:n.id,row,y:rowY,height:rowH});rowY+=rowH+gap;
  }
  const h=rowY-y-(grouped.length?gap:0)+padding;boxes.set(n.id,{...n,x,y,w:width,h,columns:cols});return h;
 }
 const width=minimum(data.tree).w,height=place(data.tree,24,24,width);return {boxes,rows,width:width+48,height:height+48};
}
function routeMermaidBlocks(layout,edges,{scoreRoute=()=>0,onRoute=()=>{}}={}){
 const all=[...layout.boxes.values()],leaves=all.filter(b=>!['space','group'].includes(b.type)),groups=all.filter(b=>b.type==='group'&&b.id!=='root'&&b.name);
 const obstacles=[...leaves.map(b=>({x:b.x-6,y:b.y-6,w:b.w+12,h:b.h+12})),...groups.map(b=>({x:b.x+12,y:b.y+10,w:b.w-24,h:b.captionHeight??24}))];
 const port=(b,side)=>side===0?{x:b.x+b.w/2,y:b.y,ox:b.x+b.w/2,oy:b.y-14}:side===1?{x:b.x+b.w,y:b.y+b.h/2,ox:b.x+b.w+14,oy:b.y+b.h/2}:side===2?{x:b.x+b.w/2,y:b.y+b.h,ox:b.x+b.w/2,oy:b.y+b.h+14}:{x:b.x,y:b.y+b.h/2,ox:b.x-14,oy:b.y+b.h/2};
 const ports=new Map(all.filter(b=>b.type!=='space'&&b.id!=='root').map(b=>[b.id,[0,1,2,3].map(s=>port(b,s))]));
 const xs=[8,layout.width-8],ys=[8,layout.height-8];for(const r of obstacles){xs.push(r.x-8,r.x+r.w+8);ys.push(r.y-8,r.y+r.h+8);}for(const ps of ports.values())for(const p of ps){xs.push(p.ox);ys.push(p.oy);}
 const X=[...new Set(xs)].sort((a,b)=>a-b),Y=[...new Set(ys)].sort((a,b)=>a-b),points=[],index=new Map();
 for(let iy=0;iy<Y.length;iy++)for(let ix=0;ix<X.length;ix++){const x=X[ix],y=Y[iy];if(obstacles.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h))continue;const id=points.length;points.push({x,y,ix,iy,neighbors:[]});index.set(ix+','+iy,id);}
 const clear=(a,b)=>!obstacles.some(r=>a.x===b.x?a.x>r.x&&a.x<r.x+r.w&&Math.max(a.y,b.y)>r.y&&Math.min(a.y,b.y)<r.y+r.h:a.y>r.y&&a.y<r.y+r.h&&Math.max(a.x,b.x)>r.x&&Math.min(a.x,b.x)<r.x+r.w);
 for(const a of points)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const j=index.get((a.ix+dx)+','+(a.iy+dy));if(j!==undefined&&clear(a,points[j]))a.neighbors.push({id:j,dir:dx?0:1,length:Math.abs(a.x-points[j].x)+Math.abs(a.y-points[j].y)});}
 const ids=p=>index.get(X.indexOf(p.ox)+','+Y.indexOf(p.oy));
 function shortest(start,end){
  if(start===undefined||end===undefined)return null;const costs=new Map(),prev=new Map(),heap=[];
  function push(v){let i=heap.length;heap.push(v);while(i){const p=(i-1)>>1;if(heap[p].score<=v.score)break;heap[i]=heap[p];i=p;}heap[i]=v;}
  function pop(){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(last.score<=heap[c].score)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;}
  const heuristic=i=>Math.abs(points[i].x-points[end].x)+Math.abs(points[i].y-points[end].y);costs.set(start*3+2,0);push({id:start,dir:2,cost:0,score:heuristic(start)});
  while(heap.length){const state=pop(),key=state.id*3+state.dir;if(state.cost!==costs.get(key))continue;if(state.id===end){const path=[];let k=key;while(k!==undefined){path.push(points[Math.floor(k/3)]);k=prev.get(k);}return {points:path.reverse().map(p=>[p.x,p.y]),cost:state.cost};}for(const n of points[state.id].neighbors){const nk=n.id*3+n.dir,cost=state.cost+n.length+(state.dir!==2&&state.dir!==n.dir?12:0);if(cost<(costs.get(nk)??Infinity)){costs.set(nk,cost);prev.set(nk,key);push({id:n.id,dir:n.dir,cost,score:cost+heuristic(n.id)});}}}
  return null;
 }
 const compact=raw=>{const simple=raw.filter((p,i)=>!i||p[0]!==raw[i-1][0]||p[1]!==raw[i-1][1]);return simple.filter((p,i)=>!i||i===simple.length-1||(simple[i-1][0]!==p[0]||p[0]!==simple[i+1][0])&&(simple[i-1][1]!==p[1]||p[1]!==simple[i+1][1]));};
 return edges.map(e=>{let best;const a=ports.get(e.from),b=ports.get(e.to);for(let i=0;i<4;i++)for(let j=0;j<4;j++){if(e.from===e.to&&i===j)continue;const route=shortest(ids(a[i]),ids(b[j]));if(route){const points=compact([[a[i].x,a[i].y],...route.points,[b[j].x,b[j].y]]),score=route.cost+scoreRoute({...e,points});if(Number.isFinite(score)&&(!best||score<best.score))best={...route,points,score,start:a[i],end:b[j]};}}if(!best)throw Error('无法在原网格中连接：'+e.from+' → '+e.to);const result={...e,points:best.points};onRoute(result);return result;});
}
