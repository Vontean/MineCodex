// 边界内按原生节点/边界声明顺序换行；外部参与者形成独立阅读列，不新建语义分组。
function layoutMermaidC4(data,measure,{cell=200,gap=40,padding=32}={}) {
 const boxes=new Map();
 function rows(children,limit){const result=[];let row=[],width=0,shapes=0,boundaries=0;for(const child of children){const group=child.type==='group';if(row.length&&(width+gap+child.w>limit||!group&&shapes>=data.shapeInRow||group&&boundaries>=data.boundaryInRow)){result.push(row);row=[];width=0;shapes=0;boundaries=0;}width+=child.w+(row.length?gap:0);row.push(child);if(group)boundaries++;else shapes++;}if(row.length)result.push(row);return result;}
 const rowWidth=row=>row.reduce((s,c)=>s+c.w,0)+gap*Math.max(0,row.length-1),rowsHeight=rows=>rows.reduce((s,row)=>s+Math.max(...row.map(c=>c.h)),0)+gap*Math.max(0,rows.length-1);
 function pack(n){
  if(n.type!=='group')return {...n,w:cell,h:measure(n,cell),captionHeight:0};
  const children=n.children.map(pack),leaves=children.filter(c=>c.type!=='group'),groups=children.filter(c=>c.type==='group');
  const captionHeight=n.id==='global'?0:measure({...n,caption:true},cell*2+gap)+12;
  if(n.id==='global'&&leaves.length&&groups.length){const mainRows=rows(groups,1280),sideHeight=leaves.reduce((s,c)=>s+c.h,0)+gap*Math.max(0,leaves.length-1),mainWidth=Math.max(...mainRows.map(rowWidth));return {...n,children,sideNodes:leaves,rows:mainRows,w:cell+gap+mainWidth+padding*2,h:Math.max(sideHeight,rowsHeight(mainRows))+padding*2,captionHeight};}
  const limit=String(n.c4Type).toLowerCase()==='container'?cell*2+gap:1280;
  const packedRows=rows([...leaves,...groups],limit);
  return {...n,children,rows:packedRows,w:Math.max(cell,...packedRows.map(rowWidth))+padding*2,h:padding*2+captionHeight+rowsHeight(packedRows),captionHeight};
 }
 function place(n,x,y){
  boxes.set(n.id,{...n,x,y});let top=y+padding+n.captionHeight,leftInset=x+padding;
  if(n.sideNodes){let sideY=top;for(const child of n.sideNodes){place(child,leftInset,sideY);sideY+=child.h+gap;}leftInset+=cell+gap;}
  for(const row of n.rows||[]){let left=leftInset;const height=Math.max(...row.map(c=>c.h));for(const child of row){place(child,left,top);left+=child.w+gap;}top+=height+gap;}
 }
 const tree=pack(data.tree);place(tree,24,24);return {boxes,width:tree.w+48,height:tree.h+48};
}
