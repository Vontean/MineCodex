// QV 风格的 Git 分支图：模型读取与绘制。由构建器组装进 QV 模板，不修改 vendor 快照。
// 视觉沿用 QV：分支色取 --viz-series-*（与背景混合降饱和）、12px 文字、按钮承载交互、共享视口与入场动效。
function readMermaidGitModel(db,descriptions={}){
 if(!db.getCommits||!db.getBranchesAsObjArray)return {reason:'gitGraph 数据接口不兼容'};
 const branches=db.getBranchesAsObjArray().map(b=>b.name);
 // 未写 id 的提交由 Mermaid 生成「序号-7 位哈希」，只展示哈希。
 const commits=[...db.getCommits().values()].sort((a,b)=>a.seq-b.seq).map(c=>({id:String(c.id),message:String(c.message||''),type:c.type,tags:[...(c.tags||[])].map(String),parents:[...(c.parents||[])].map(String),branch:c.branch,auto:/^\d+-[0-9a-f]{7}$/.test(String(c.id)),description:descriptions[c.id]||''}));
 if(!commits.length)return {reason:'gitGraph 没有提交'};
 if(commits.some(c=>[c.id,c.message,...c.tags].some(hasRichMermaidLabel)))return {reason:'gitGraph 包含富文本，保留原生语义'};
 const unknown=Object.keys(descriptions).filter(id=>!commits.some(c=>c.id===id));if(unknown.length)throw new Error('说明引用了未知提交：'+unknown.join('、'));
 return {data:{kind:'git',branches,commits,direction:db.getDirection?.()||'LR',title:db.getDiagramTitle?.()||''}};
}

function renderMermaidGit(root,data){
 const scene=root.querySelector('.scene'),viewport=root.querySelector('.diagram-scroll'),svg=scene.querySelector('svg'),NS='http://www.w3.org/2000/svg';
 root.classList.add('qv-git');root.dataset.state='enhanced';root.dataset.renderer='qv-git';root.querySelector('.edge-key').hidden=true;
 if(data.title&&root.querySelector('h3').hidden){root.querySelector('h3').textContent=data.title;root.querySelector('h3').hidden=false;}
 const style=document.createElement('style');style.textContent=`
 #${root.id} .git-branch{position:absolute;display:block;box-sizing:border-box;height:24px;padding:0 10px;border:0;border-radius:999px;font:inherit;font-size:12px;line-height:24px;color:color-mix(in srgb,var(--git-tone) 60%,var(--foreground));background:color-mix(in srgb,var(--git-tone) 14%,var(--background));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:var(--cursor-interaction,pointer)}
 #${root.id} .git-commit{position:absolute;display:flex;align-items:center;gap:8px;box-sizing:border-box;height:24px;padding:0;border:0;background:transparent;font:inherit;font-size:12px;line-height:18px;color:var(--foreground);white-space:nowrap;overflow:hidden;cursor:var(--cursor-interaction,pointer)}
 #${root.id} .git-commit.lr{justify-content:center}
 #${root.id} .git-commit>span{overflow:hidden;text-overflow:ellipsis;min-width:0}
 #${root.id} .git-commit .git-text{flex:0 1 auto}
 #${root.id} .git-commit .git-hash{color:var(--muted-foreground);font-variant-numeric:tabular-nums}
 #${root.id} .git-commit .git-ref{flex:none;max-width:160px;height:20px;padding:0 8px;border-radius:999px;line-height:20px;color:color-mix(in srgb,var(--git-tone) 60%,var(--foreground));background:color-mix(in srgb,var(--git-tone) 14%,var(--background))}
 #${root.id} .git-tag{flex:none;max-width:200px;height:20px;padding:0 8px;box-sizing:border-box;border:1px solid var(--border);border-radius:6px;line-height:18px;color:var(--muted-foreground);background:var(--background);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 #${root.id} .git-tag.lr{position:absolute}
 #${root.id} .git-edge{fill:none;stroke:color-mix(in srgb,var(--git-tone) 70%,var(--background));stroke-width:2;stroke-linecap:round}
 #${root.id} .git-dot{fill:var(--git-tone);stroke:var(--background);stroke-width:2}
 #${root.id} .git-dot.merge{fill:var(--background);stroke:var(--git-tone);stroke-width:2.5}
 #${root.id} .git-dot.cherry{fill:var(--background);stroke:var(--git-tone);stroke-width:2;stroke-dasharray:3 2}
 #${root.id} .git-mark{fill:none;stroke:var(--git-tone);stroke-width:2;stroke-linecap:round}
 #${root.id} [data-branch]{transition:opacity 140ms}
 #${root.id} [data-dim]{opacity:.22}
 #${root.id} .git-commit:focus-visible,#${root.id} .git-branch:focus-visible{outline:1px solid var(--viz-series-1);outline-offset:2px}
 @media(prefers-reduced-motion:reduce){#${root.id} [data-branch]{transition:none}}
 `;root.append(style);
 const el=(tag,attrs)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);return n;};
 const html=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const lane=new Map(data.branches.map((b,i)=>[b,i])),tone=b=>`var(--viz-series-${(lane.get(b)??0)%6+1})`;
 const index=new Map(data.commits.map((c,i)=>[c.id,i])),firstOf=new Map();data.commits.forEach(c=>{if(!firstOf.has(c.branch))firstOf.set(c.branch,c.id);});
 const context=document.createElement('canvas').getContext('2d');context.font='12px '+getComputedStyle(root).fontFamily;const measure=t=>Math.ceil(context.measureText(t).width);
 const label=c=>c.auto?c.id.split('-')[1]:c.id;
 // 横排放得下正文宽度就沿用 Mermaid 默认方向；放不下改为 git log 式纵排（与流程图主轴规则一致）。
 const limit=cfg.readingWidth||root.clientWidth,n=data.commits.length,lanes=data.branches.length;
 const branchCol=Math.min(160,Math.max(...data.branches.map(measure))+20),step=Math.min(140,Math.max(56,...data.commits.map(c=>measure(label(c))+16)));
 const lrStart=24+branchCol+24,lrWidth=lrStart+(n-1)*step+step/2+24;
 const vertical=data.direction!=='LR'||lrWidth>limit;root.dataset.gitLayout=vertical?'rows':'lanes';root.dataset.mcxLayout=vertical?'git-rows':'git-lanes';
 const commits=[],edges=[],refs=[];let width,height,point;
 if(!vertical){
  const tagged=new Set(data.commits.filter(c=>c.tags.length).map(c=>lane.get(c.branch)));let y=36;const laneY=data.branches.map((b,i)=>{if(tagged.has(i))y+=26;const v=y;y+=56;return v;});
  width=lrWidth;height=laneY.at(-1)+48;point=c=>({x:lrStart+index.get(c.id)*step,y:laneY[lane.get(c.branch)]});
  data.branches.forEach((b,i)=>{const r=html('button','git-branch',b);r.type='button';r.title=b;r.dataset.branch=b;r.style.setProperty('--git-tone',tone(b));r.style.left='24px';r.style.top=(laneY[i]-12)+'px';r.style.maxWidth=branchCol+'px';scene.append(r);refs.push(r);});
 }else{
  const rowH=32,top=12,textX=24+lanes*24+12,order=data.direction==='BT'?[...data.commits].reverse():data.commits,row=new Map(order.map((c,i)=>[c.id,i]));
  width=Math.max(textX+240,limit);height=top+n*rowH+12;point=c=>({x:24+12+lane.get(c.branch)*24,y:top+row.get(c.id)*rowH+rowH/2});
 }
 scene.style.width=scene.style.minWidth=width+'px';scene.style.height=height+'px';svg.setAttribute('width',width);svg.setAttribute('height',height);svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.style.width=width+'px';svg.style.height=height+'px';
 // 分支分出时在父提交附近转入新泳道；合并时沿来源泳道前进，在合并提交前转入。
 const toXY=(m,c)=>vertical?[c,m]:[m,c],unit=vertical?32:step;
 for(const c of data.commits){const b=point(c),bm=vertical?b.y:b.x,bc=vertical?b.x:b.y;
  for(const [k,pid] of c.parents.entries()){const parent=data.commits[index.get(pid)];if(!parent)continue;const a=point(parent),am=vertical?a.y:a.x,ac=vertical?a.x:a.y,s=Math.sign(bm-am)||1,r=Math.min(Math.abs(bm-am),unit);
   let d,owner;const curve=(m0,c0,m1,c1)=>{const mid=(m0+m1)/2;return `C${toXY(mid,c0)} ${toXY(mid,c1)} ${toXY(m1,c1)}`;};
   if(ac===bc){d=`M${toXY(am,ac)} L${toXY(bm,bc)}`;owner=c.branch;}
   else if(firstOf.get(c.branch)===c.id&&k===0){d=`M${toXY(am,ac)} ${curve(am,ac,am+s*r,bc)} L${toXY(bm,bc)}`;owner=c.branch;}
   else{d=`M${toXY(am,ac)} L${toXY(bm-s*r,ac)} ${curve(bm-s*r,ac,bm,bc)}`;owner=parent.branch;}
   const path=el('path',{d,class:'git-edge','data-branch':owner});path.style.setProperty('--git-tone',tone(owner));edges.push({path,index:index.get(c.id)});}}
 for(const c of data.commits){const p=point(c),i=index.get(c.id),t=tone(c.branch),kind=['normal','reverse','highlight','merge','cherry'][c.type]||'normal';let mark;
  if(kind==='highlight')mark=el('rect',{x:p.x-6,y:p.y-6,width:12,height:12,rx:2,class:'git-dot','data-branch':c.branch});
  else{mark=el('circle',{cx:p.x,cy:p.y,r:kind==='merge'?6:kind==='cherry'?6:5.5,class:'git-dot '+kind,'data-branch':c.branch});}
  mark.style.setProperty('--git-tone',t);const marks=[mark];
  if(kind==='reverse'){const x=el('path',{d:`M${p.x-3} ${p.y-3}l6 6m0 -6l-6 6`,class:'git-mark','data-branch':c.branch});x.style.setProperty('--git-tone','var(--background)');marks.push(x);}
  const b=html('button','git-commit'+(vertical?'':' lr'));b.type='button';b.dataset.branch=c.branch;b.style.setProperty('--git-tone',t);
  b.title=[c.branch,c.auto?c.id.split('-')[1]:c.id,c.message,...c.tags,c.description].filter(Boolean).join(' · ');b.setAttribute('aria-label',b.title);
  const text=html('span','git-text'+(c.auto?' git-hash':''),label(c));const tags=[];
  if(vertical){const textX=24+lanes*24+12;if(firstOf.get(c.branch)===c.id){const ref=html('span','git-ref',c.branch);b.append(ref);}b.append(text);if(c.message&&!c.auto)b.append(html('span','git-hash',c.message));c.tags.forEach(v=>{const g=html('span','git-tag',v);b.append(g);});b.style.left=textX+'px';b.style.top=(p.y-12)+'px';b.style.maxWidth=(width-textX-16)+'px';}
  else{b.append(text);b.style.left=(p.x-(step-8)/2)+'px';b.style.width=(step-8)+'px';b.style.top=(p.y+10)+'px';c.tags.forEach((v,j)=>{const g=html('span','git-tag lr',v);g.title=v;g.dataset.branch=c.branch;g.style.maxWidth=Math.max(step-8,96)+'px';scene.append(g);g.style.left=(p.x-g.offsetWidth/2)+'px';g.style.top=(p.y-34-j*24)+'px';tags.push(g);});}
  scene.append(b);commits.push({c,i,b,marks,tags});}
 const view=createMermaidViewport(root);
 // 悬停或聚焦某提交时只保留其所在分支，其余分支降为背景。
 const all=()=>root.querySelectorAll('[data-branch]');function clear(){all().forEach(n=>n.removeAttribute('data-dim'));}
 function focus(branch){all().forEach(n=>n.toggleAttribute('data-dim',n.dataset.branch!==branch));}
 for(const o of commits){o.b.addEventListener('pointerenter',()=>focus(o.c.branch));o.b.addEventListener('pointerleave',clear);o.b.addEventListener('focus',()=>{focus(o.c.branch);const r=o.b.getBoundingClientRect(),v=viewport.getBoundingClientRect();if(r.left<v.left+12)viewport.scrollLeft-=v.left+12-r.left;else if(r.right>v.right-12)viewport.scrollLeft+=r.right-v.right+12;});o.b.addEventListener('blur',clear);}
 for(const r of refs){r.addEventListener('pointerenter',()=>focus(r.dataset.branch));r.addEventListener('pointerleave',clear);r.addEventListener('focus',()=>focus(r.dataset.branch));r.addEventListener('blur',clear);}
 viewport.addEventListener('scroll',clear,{passive:true});root.addEventListener('keydown',e=>{if(e.key==='Escape')clear();});
 // 入场：按提交顺序画出连线并点亮提交，总时长约 1.2 秒；减少动态效果时不播放。
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');let running=[],armed=true;const gap=Math.min(120,1200/Math.max(1,n-1));
 function replay(){running.forEach(a=>a.cancel());running=[];if(reduced.matches||view.expanded)return;
  for(const {path,index:i} of edges){const length=path.getTotalLength();path.style.strokeDasharray=`${length} ${length}`;const a=path.animate([{strokeDashoffset:length},{strokeDashoffset:0}],{duration:360,delay:Math.max(0,i-1)*gap,easing:'cubic-bezier(.2,.7,.3,1)',fill:'backwards'});a.onfinish=()=>{path.style.strokeDasharray='';};running.push(a);}
  for(const o of commits){const delay=o.i*gap;o.marks.forEach(m=>running.push(m.animate([{opacity:0},{opacity:1}],{duration:200,delay,fill:'backwards'})));[o.b,...o.tags].forEach(n=>running.push(n.animate([{opacity:0},{opacity:1}],{duration:200,delay:delay+60,fill:'backwards'})));}
  root.dataset.replays=String(+(root.dataset.replays||0)+1);}
 new IntersectionObserver(es=>{if(!es[0].isIntersecting)armed=true;else if(es[0].intersectionRatio>=.2&&armed){armed=false;replay();}},{threshold:[0,.2]}).observe(root);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)armed=true;else if(armed){armed=false;replay();}});
 root.addEventListener('qv:display-mode',()=>{running.forEach(a=>a.cancel());clear();if(!view.expanded)viewport.scrollLeft=view.savedInlinePosition?.left||0;});reduced.addEventListener('change',()=>running.forEach(a=>a.cancel()));view.refresh();
}
