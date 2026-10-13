// 详情浮层独立于缩放场景，保留完整源身份和真实端口关系。
function createArchitectureReader(root, model, viewport, controller, highlight, keepAlive, leave) {
  const entries=[...(model.groups||[]).map(g=>({...g,isGroup:true})),...model.nodes],byId=new Map(entries.map(n=>[n.id,n]));
  const detail=document.createElement('div');detail.className='architecture-detail';detail.id=root.id+'-architecture-detail';detail.setAttribute('role','tooltip');detail.hidden=true;root.append(detail);
  let selected=null,epoch=0,scrollTimer;
  const sides={NORTH:'上',SOUTH:'下',WEST:'左',EAST:'右'};
  function path(n){const chain=[];for(let parent=byId.get(n.parent);parent;parent=byId.get(parent.parent))chain.unshift(parent.name);return chain.join(' / ');}
  const row=(cls,text)=>{const n=document.createElement('div');n.className=cls;n.textContent=text;return n;};
  function section(title){const el=document.createElement('section');el.className='architecture-detail-section';el.append(row('architecture-detail-label',title));detail.append(el);return el;}
  function endpoint(id,side){const el=document.createElement('div');el.append(row('architecture-detail-endpoint',byId.get(id)?.name||id));el.append(row('architecture-detail-label',sides[side]?'端口 · '+sides[side]:''));return el;}
  function fill(id){
    const n=byId.get(id);detail.replaceChildren();detail.append(row('architecture-detail-name',n.name),row('architecture-detail-label',(n.isGroup?'分组':n.junction?'汇接点':'资源'+(n.resource?' · '+n.resource:''))+' · '+n.id));
    if(n.description)section('说明').append(row('architecture-detail-body',n.description));
    if(n.parent)section('所属分组').append(row('architecture-detail-body',path(n)));
    if(n.isGroup){const children=entries.filter(c=>c.parent===id);if(children.length){const list=section('直接成员');for(const child of children)list.append(row('architecture-detail-body',child.name));}}
    const links=model.edges.filter(e=>e.from===id||e.to===id);
    if(links.length){const list=section('直接连接');for(const e of links){const link=document.createElement('div');link.className='architecture-detail-link';const arrow=e.startArrow&&e.arrow?'↔':e.startArrow?'←':e.arrow?'→':'—';link.append(endpoint(e.from,e.fromSide),row('architecture-detail-arrow',arrow),endpoint(e.to,e.toSide));list.append(link);if(e.fromGroup||e.toGroup)list.append(row('architecture-detail-label','源端点：'+e.sourceFrom+' '+arrow+' '+e.sourceTo));}}
  }
  function clear(){epoch++;clearTimeout(scrollTimer);selected=null;detail.hidden=true;root.querySelectorAll('[aria-describedby="'+detail.id+'"]').forEach(n=>n.removeAttribute('aria-describedby'));}
  function reveal(pending){if(pending!==epoch||!selected||!selected.anchor?.isConnected)return;fill(selected.id);detail.hidden=false;selected.anchor.setAttribute('aria-describedby',detail.id);highlight(selected.id);placeMermaidDetail(root,detail,selected.anchor);}
  function choose(id,anchor,ensure=false){
    if(!byId.has(id))return;
    clear();const pending=epoch;selected={id,anchor};
    if(ensure&&anchor&&!controller.expanded){const a=anchor.getBoundingClientRect(),v=viewport.getBoundingClientRect();if(a.width<=v.width){if(a.left<v.left+8)viewport.scrollLeft-=v.left+8-a.left;else if(a.right>v.right-8)viewport.scrollLeft+=a.right-v.right+8;}}
    requestAnimationFrame(()=>requestAnimationFrame(()=>reveal(pending)));
  }
  function onScroll(){if(!selected)return;detail.hidden=true;const pending=epoch;clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>reveal(pending),100);}
  function refresh(){if(selected)reveal(epoch);}
  detail.addEventListener('pointerenter',keepAlive);detail.addEventListener('pointerleave',leave);
  return {choose,clear,onScroll,refresh,get focused(){return !!selected&&selected.anchor===document.activeElement;}};
}
