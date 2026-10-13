// 下钻只改变可见投影；完整模型与关系始终保留。
function mermaidScopeView(model, scope = null) {
  const groups = new Map((model.groups || []).map(g => [g.id, g]));
  const all = new Map([...groups.values(), ...model.nodes].map(n => [n.id, n]));
  if (scope !== null && !groups.has(scope)) throw new Error('分组不存在：' + scope);
  const inside = (id, parent) => {
    if (parent === null) return true;
    for (let n = all.get(id); n; n = all.get(n.parent)) if (n.id === parent) return true;
    return false;
  };
  // 每个端点映射到当前层的直接孩子，外部端点映射到最近的外部边界。
  function representative(id) {
    if (id === scope) return {id, external:true};
    if (inside(id, scope)) {
      let n = all.get(id);
      while (n.parent && n.parent !== scope) n = all.get(n.parent);
      return {id:n.id, external:false};
    }
    let n = all.get(id);
    const ancestors = new Set();
    for (let p = all.get(scope); p; p = all.get(p.parent)) ancestors.add(p.id);
    while (n.parent && !ancestors.has(n.parent)) n = all.get(n.parent);
    return {id:n.id, external:true};
  }
  const visible = new Map();
  function add(id, external = false) {
    const key = external ? 'qv-external:' + id : id;
    if (visible.has(key)) return key;
    const raw = all.get(id), group = groups.has(id);
    const count = group ? model.nodes.filter(n => !n.junction && inside(n.id,id)).length : 0;
    let preview;
    if(group&&!external){
      const rows=[];let shown=0;
      function visit(parent,depth=0){for(const child of all.values())if(child.parent===parent){
        if(shown>=8)break;
        if(groups.has(child.id)){rows.push({id:child.id,name:child.name,heading:true,depth});visit(child.id,depth+1);}
        else if(!child.junction){rows.push({id:child.id,name:child.name,icon:child.icon,depth});shown++;}
      }}
      visit(id);let y=model.architecture?96:62;rows.forEach(row=>{row.y=y;if(model.architecture||model.kind==='flowchart'){const text=document.createElement('span');text.style.cssText='position:absolute;left:-100000px;width:248px;font:12px/18px '+getComputedStyle(root).fontFamily+';white-space:normal;overflow-wrap:anywhere';text.textContent=row.name;root.append(text);row.h=Math.max(18,text.offsetHeight);text.remove();y+=row.h+14;}else y+=row.heading?26:32;});
      const ids=new Set(rows.filter(r=>!r.heading).map(r=>r.id));
      preview={rows,edges:model.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)&&e.from!==e.to),remaining:count-shown,height:y+(count>shown?28:10)};
    }
    visible.set(key, {...raw, id:key, parent:undefined, shape:group?'round':raw.shape,
      groupCard:group&&!external, external, count, preview, icon:group?(raw.icon||'layers'):raw.icon,
      targetGroup:group ? (id===scope?raw.parent||null:id) : undefined,
      description:raw.description||'',
      layoutWidth:model.architecture||group&&!external&&model.kind==='flowchart'?320:undefined,layoutHeight:model.architecture?(preview?.height||64):undefined,
      layer:0});
    return key;
  }
  for (const n of all.values()) if ((n.parent||null)===scope) add(n.id);
  const edges = [], bundles = new Map();
  model.edges.forEach((edge,index) => {
    if (!inside(edge.from,scope)&&!inside(edge.to,scope)) return;
    const a=representative(edge.from), b=representative(edge.to);
    // 折叠组内部的边留在原模型；真实叶节点自环仍显示。
    if (a.id===b.id && !(edge.from===edge.to&&!groups.has(a.id))) return;
    const from=add(a.id,a.external),to=add(b.id,b.external);
    const key=JSON.stringify([from,to,edge.async,edge.thick,edge.arrow,edge.startArrow,edge.marker,edge.invisible,edge.label||'']);
    if(bundles.has(key)){bundles.get(key).members.push(index);return;}
    const projected={...edge,from,to,points:undefined,labelPosition:undefined,
      fromSide:from===edge.from?edge.fromSide:undefined,toSide:to===edge.to?edge.toSide:undefined,members:[index]};
    edges.push(projected);bundles.set(key,projected);
  });
  for(const edge of edges)if(edge.members.length>1)edge.bundleCount=edge.members.length;
  return {nodes:[...visible.values()],edges,groups:[],layers:[],generic:true,navigation:true,
    direction:model.direction||'LR',grouped:false,scope,kind:model.kind,architectureCards:!!model.architecture||model.kind==='flowchart'};
}


// 总览保留源码的分组顺序，反馈连接绕到外围，不让循环反转主阅读方向。
async function prepareNavigationView(data){
 if(!['LR','RL'].includes(data.direction)||data.scope!==null||!data.nodes.length||data.nodes.length>5||!data.nodes.every(n=>n.groupCard))return prepareMermaidLayout(data);
 const reversed=['RL','BT'].includes(data.direction),ordered=reversed?[...data.nodes].reverse():data.nodes;
 const width=data.architectureCards?320:184,gap=64,top=24,maxHeight=Math.max(...ordered.map(n=>n.preview.height));
 ordered.forEach((n,i)=>Object.assign(n,{x:16+i*(width+gap),y:top+(maxHeight-n.preview.height)/2,w:width,h:n.preview.height,layer:i}));
 const map=new Map(data.nodes.map(n=>[n.id,n]));let returns=0;
 data.edges.forEach(e=>{const a=map.get(e.from),b=map.get(e.to),forward=reversed?a.x>b.x:a.x<b.x;
  if(forward&&Math.abs(a.x-b.x)<(width+gap)*1.1){
   const right=b.x>a.x,sx=a.x+(right?a.w:0),tx=b.x+(right?0:b.w),sy=a.y+a.h/2+(e.async?18:-10),ty=b.y+b.h/2+(e.async?18:-10);
   e.curve=[sx,sy,(sx+tx)/2,sy,(sx+tx)/2,ty,tx,ty];e.points=undefined;e.labelPosition={x:(sx+tx)/2,y:(sy+ty)/2-10};
  }else{
   const y=top+maxHeight+90+returns++*36,side=b.x>a.x?1:-1,ax=a.x+a.w/2+side*12,bx=b.x+b.w/2-side*12;
   e.curve=[ax,a.y+a.h,ax,y,bx,y,bx,b.y+b.h+1];e.points=undefined;e.labelPosition={x:(ax+bx)/2,y:((a.y+a.h)+6*y+(b.y+b.h))/8-10};
  }
 });
 data.layout={width:ordered.length*width+(ordered.length-1)*gap+32,height:top+maxHeight+returns*36+70,groups:[]};
}

// 局部视图完整展示当前层；过宽时尝试纵向排布，不按邻域过滤节点。
async function prepareCompleteScope(data,width){
 await prepareNavigationView(data);
 if(data.scope===null||data.layout.width<=width||!['LR','RL'].includes(data.direction)||data.edges.some(e=>e.fromSide||e.toSide))return;
 const alternative={...data,direction:'TB',nodes:data.nodes.map(n=>({...n})),edges:data.edges.map(e=>({...e,curve:undefined,points:undefined})),groups:[]};
 await prepareMermaidLayout(alternative);
 if(alternative.layout.width<data.layout.width)Object.assign(data,alternative);
}
