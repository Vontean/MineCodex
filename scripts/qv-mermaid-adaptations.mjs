import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';

// 构建适配必须精确命中；快照升级时立即暴露协议变化，避免静默漏改。
export function replaceQv(text, from, to) {
  if (text.split(from).length !== 2) throw new Error('QV 适配锚点不唯一或缺失：' + from);
  return text.replace(from, () => to);
}
const must = (text, part) => { if (text.split(part).length !== 2) throw new Error('QV 适配锚点不唯一或缺失：' + part); };

export function adaptFlowLayout(script) {
const gate = 'if(data.navigation||data.layout.width<=(cfg.readingWidth||root.clientWidth))return;';
const mark = mode => `root.dataset.mcxLayout=${JSON.stringify(mode)};`;

// 主轴规则（已确认）：
// 1. 按作者方向排版，宽度不超过正文宽度 → 保持。
// 2. 超宽 → 换到另一条主轴（LR↔TB）重排；新结果放得下正文宽度 → 采用。
// 3. 两条主轴都放不下 → 采用较窄结果，图块内横向滚动。
// 不再按源码顺序蛇形折叠，连线始终由 ELK 按拓扑布线。
must(script, gate);
const axisRule = script.replace(gate, () => `{const limit=cfg.readingWidth||root.clientWidth;
if(data.navigation||data.layout.width<=limit){${mark('fit')}return;}
if(!data.nativeGeometry){const original=data.direction,first=data.layout.width,swap=['LR','RL'].includes(original)?'TB':'LR';
data.direction=swap;await prepareMermaidLayout(data);
if(data.layout.width<=limit){${mark('axis')}return;}
if(data.layout.width<first){${mark('axis-scroll')}return;}
data.direction=original;await prepareMermaidLayout(data);}
${mark('scroll')}return;}`);

// 分支实验（叠加在主轴规则之上）：
// 4. 节点摆放：ELK 默认取四种对齐中最窄的一种，主链被拉直、分支偏向一侧；
//    改为 BALANCED，取四种对齐的平均，父节点居中于子节点。
//    保留默认连线拉直：关闭拉直（edgeStraightening=NONE）会让连线被标签位置拉出 S 形折角，已否决。
// 5. 回流连线：原规则让回流从同一侧出入，变成贴边的长通道；
//    改为从下游节点的上游面出发、进入上游节点的下游面，与正向连线并行。
const elkAnchor = "'elk.algorithm':'layered',";
const layoutDef = 'async function prepareMermaidLayout(data) {';
for (const part of [elkAnchor, layoutDef]) must(axisRule, part);
const reverseSides = `const lr=['LR','RL'].includes(data.direction),flip=['RL','BT'].includes(data.direction);
e.fromSide=lr?(flip?'EAST':'WEST'):(flip?'SOUTH':'NORTH');e.toSide=lr?(flip?'WEST':'EAST'):(flip?'NORTH':'SOUTH');`;
const after = axisRule
  // 6. 流程图回路按书写顺序断开（状态图原本就如此），先写的部分排在上游。
  .replace(elkAnchor, () => elkAnchor + "...(data.kind==='flowchart'?{'elk.layered.cycleBreaking.strategy':'MODEL_ORDER'}:{}),'elk.layered.nodePlacement.bk.fixedAlignment':'BALANCED',")
  .replace(layoutDef, () => `async function prepareMermaidLayout(data){
 // 流程图没有显式回流标记：先排一次，按主轴位置找出指向上游的连线，再改端口重排。
 for(const e of data.edges)if(e.__qvBack){delete e.fromSide;delete e.toSide;delete e.__qvBack;}
 await __qvBaseLayout(data);
 if(data.kind!=='flowchart')return;
 const map=new Map(data.nodes.map(n=>[n.id,n])),lr=['LR','RL'].includes(data.direction),flipped=['RL','BT'].includes(data.direction);
 const at=n=>lr?n.x+n.w/2:n.y+n.h/2;let changed=false;
 for(const e of data.edges){if(e.fromSide||e.toSide||e.from===e.to)continue;const a=map.get(e.from),b=map.get(e.to);if(!a||!b)continue;
  const d=at(b)-at(a);if(!(flipped?d>0:d<0))continue;
  // 同组回流与正向线并行；跨组回流走组外侧的单条通道，避免层级布线绕大圈。
  if((a.parent||null)===(b.parent||null)){${reverseSides}}else{e.fromSide=e.toSide=lr?'SOUTH':'EAST';}
  e.__qvBack=true;changed=true;}
 if(changed)await __qvBaseLayout(data);
}
async function __qvBaseLayout(data) {`);


  // 删除已被主轴选择取代的蛇形排版，避免维护不可达的旧算法。
  const ast = parse(after, { ecmaVersion: 'latest' });
  const fn = ast.body.filter(n => n.type === 'FunctionDeclaration' && n.id.name === 'prepareFlowchartLayout');
  if (fn.length !== 1) throw new Error('prepareFlowchartLayout 不唯一');
  const body = fn[0].body.body, axisGate = body[2];
  if (axisGate?.type !== 'BlockStatement') throw new Error('主轴选择结构变化');
  return after.slice(0, axisGate.end) + after.slice(fn[0].body.end - 1);
}

// 时序图（学习 Pele）：
// 7. 序号从标签文字前移到连线起点，成为线上的圆形徽标，同时表达顺序与发出方。
// 8. 箭头由 5×5 放大到 8×8，颜色比连线深一级，方向更易辨认。
const sequencePatches = [
  ['#${root.id} .seq-arrow{fill:light-dark(#727a82,#a3aab3);stroke:none}',
   '#${root.id} .seq-arrow{fill:light-dark(#4b5259,#c4cad1);stroke:none}'
   + ' #${root.id} .seq-badge circle{fill:light-dark(#4b5259,#c4cad1)}'
   + ' #${root.id} .seq-badge text{fill:var(--background);font-size:10px;font-weight:600;font-variant-numeric:tabular-nums}'
   + ' #${root.id} .seq-hit.is-related .seq-badge circle{fill:var(--viz-series-1)}'],
  // 标签不再含序号：宽度只留左右内边距，换行测量宽度同步收窄。
  ['measure(m.message)+(m.number===undefined?14:40))),labelHeight=textHeight(m.message,labelWidth-40)',
   'measure(m.message)+14)),labelHeight=textHeight(m.message,labelWidth-14)'],
  ['const end=b-(self?0:5*direction)', 'const end=b-(self?0:8*direction)'],
  ['M${b-5*dx} ${ey-2.5}L${b} ${ey}L${b-5*dx} ${ey+2.5}', 'M${b-8*dx} ${ey-4}L${b} ${ey}L${b-8*dx} ${ey+4}'],
  ['M${b} ${ey}l${-5*dx} -2.5v5Z', 'M${b} ${ey}l${-8*dx} -4v8Z'],
  ['M${a} ${y}l${5*dx} -2.5v5Z', 'M${a} ${y}l${8*dx} -4v8Z'],
  // 双向消息起点已有箭头，徽标向内让开。
  ['if(m.number!==undefined)label.append(num);',
   "if(m.number!==undefined){const bx=a+([33,34].includes(m.type)?18*dx:0),badge=el('g',{class:'seq-badge'},g);"
   + "el('circle',{cx:bx,cy:y,r:String(m.number).length>2?10:8},badge);"
   + "el('text',{x:bx,y:y+.5,'text-anchor':'middle','dominant-baseline':'central'},badge).textContent=String(m.number);}"],
  ["animations.push(label.animate([{opacity:0},{opacity:1}],{duration:180,delay:delay+70,fill:'backwards'}));",
   "animations.push(label.animate([{opacity:0},{opacity:1}],{duration:180,delay:delay+70,fill:'backwards'}));"
   + "g.querySelectorAll('.seq-badge').forEach(n=>animations.push(n.animate([{opacity:0},{opacity:1}],{duration:180,delay,fill:'backwards'})));"],
];

// XY 数据图（看趋势优先）：
// 9. 竖向图的分类宽度按绘图区平分，不再按标签长度撑宽；每个分类至少 16px，放不下才横向滚动。
// 10. 横轴标签单行省略（最宽 160px），按间隔抽稀，保证不重叠；隐藏的标签仍可键盘聚焦，悬停提示给出全名。
// 11. 纵轴标题改为图上方单行，过长省略，悬停显示全名，不再挤在 60px 列里压住刻度。
const xyPatches = [
  ["const minSlot=Math.min(120,Math.max(56,...categories.map(v=>String(v).length*12+8)))",
   "const minSlot=data.horizontal?Math.min(120,Math.max(56,...categories.map(v=>String(v).length*12+8))):16"],
  ["unit.style.cssText='position:absolute;top:0;left:4px;max-width:60px;overflow-wrap:anywhere';",
   "unit.title=data.yAxis.title;unit.style.cssText='position:absolute;top:0;left:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:'+Math.max(60,viewport.clientWidth-8)+'px';"],
  ["categories.forEach((value,i)=>{const b=document.createElement('button');b.type='button';b.className='xy-label';b.textContent=value;b.style.left=(horizontal?0:Math.max(left,Math.min(right-Math.max(24,band-4),position(value,i)-band/2)))+'px';b.style.top=(horizontal?position(value,i)-18:bottom+12)+'px';b.style.width=(horizontal?left-14:Math.max(24,band-4))+'px';",
   "const metrics=document.createElement('canvas').getContext('2d');metrics.font='12px '+getComputedStyle(root).fontFamily;"
   + "const labelWidth=Math.min(160,Math.max(24,...categories.map(v=>Math.ceil(metrics.measureText(String(v)).width))))+8,every=horizontal?1:Math.max(1,Math.ceil((labelWidth+8)/band));"
   + "categories.forEach((value,i)=>{const b=document.createElement('button');b.type='button';b.className='xy-label';b.textContent=value;b.title=String(value);"
   + "const w=horizontal?left-14:Math.min(labelWidth,every*band-4);b.style.left=(horizontal?0:Math.max(4,Math.min(width-w-4,position(value,i)-w/2)))+'px';b.style.top=(horizontal?position(value,i)-18:bottom+12)+'px';b.style.width=w+'px';"
   + "if(!horizontal){b.style.whiteSpace='nowrap';b.style.overflow='hidden';b.style.textOverflow='ellipsis';if(i%every)b.style.cssText+=';height:1px;padding:0;clip-path:inset(50%)';}"],
];

// 思维导图（学习 Pele 的层级表达，低饱和）：
// 12. 每个一级分支取 QV 系列色（--viz-series-1…6），整棵子树沿用：分支节点 10% 底色 + 45% 描边，连线 50%。
// 13. 连线按层级变细：根→分支 2px，分支→下一层 1.5px，更深 1px。
// 14. 中间层节点文字向分支色轻微偏移；叶子保持正文色。悬停高亮沿用原逻辑，改用分支色。
const mindmapPatches = [
  ['#${root.id} button.node{min-width:0;transform:none;text-align:center} #${root.id} .scene{min-width:0;margin:0} #${root.id} button.node-tip{max-width:260px}',
   '#${root.id} button.node{min-width:0;transform:none;text-align:center} #${root.id} .scene{min-width:0;margin:0} #${root.id} button.node-tip{max-width:260px}'
   + ' #${root.id} button.node.branch{border-color:color-mix(in srgb,var(--branch) 45%,var(--background));background:color-mix(in srgb,var(--branch) 10%,var(--background))}'
   + ' #${root.id} button.node.branch:hover{border-color:color-mix(in srgb,var(--branch) 75%,var(--background))}'
   + ' #${root.id} button.node.twig{color:color-mix(in srgb,var(--branch) 40%,var(--foreground))}'
   + ' #${root.id} .wire[data-branch]{stroke:color-mix(in srgb,var(--branch) 50%,var(--background))}'
   + ' #${root.id} .wire[data-depth="0"]{stroke-width:2} #${root.id} .wire[data-depth="1"]{stroke-width:1.5}'
   + ' #${root.id} .wire.active[data-branch]{stroke:color-mix(in srgb,var(--branch) 85%,var(--foreground))}'],
  ["b.setAttribute('aria-label',n.label+(n.description?' · '+n.description:''));",
   "b.setAttribute('aria-label',n.label+(n.description?' · '+n.description:''));"
   + "if(n.depth>0){let owner=n;while(owner.depth>1)owner=byId.get(owner.parent);const k=model.filter(t=>t.depth===1).indexOf(owner);b.style.setProperty('--branch',`var(--viz-series-${k%6+1})`);}"],
  ["path.setAttribute('class','wire');Object.assign(path.dataset,{from:n.parent,to:n.id,depth:n.depth-1});",
   "path.setAttribute('class','wire');Object.assign(path.dataset,{from:n.parent,to:n.id,depth:n.depth-1,branch:''});path.style.setProperty('--branch',buttons.get(n.id).style.getPropertyValue('--branch'));"],
];

// 架构图（压测绘制失败的根因修复）：
// 15. 根因：原生 Mermaid 只给出相对方位，图标中心距约 120px，放大 1.8 倍后 216px，而 QV 卡片固定 240px 宽；
//     相邻卡片重叠，连线起点落进邻居卡片，A* 布线无解，整图失败。原生布局还会把分组行拉开数万像素。
// 16. 首选：保留原生方位（谁在谁左右上下，含 B→T 这类二维方向），按原生中心聚类成列与行（容差 24px），
//     列宽、行高按实际卡片尺寸 + 分组留白重排，消除重叠与超大空白。
// 17. 回退：原生方位装不下分组时（分组框盖住其他分组的节点、两个节点落进同一格、或仍无布线路径），
//     改用与流程图相同的 ELK 分层布局，分组作为复合块；主方向取连线端口多数（左右多 → LR，否则 TB）。
//     单用 ELK 已否决：它只有一个主方向，会把「API 下方的数据库」排到右侧，常规样例变宽超出正文。
const archLayout = "async function prepareArchitectureLayout(data){"
  + "const measure=(name,width)=>{const t=document.createElement('span');t.style.cssText='position:absolute;left:-100000px;width:'+width+'px;font:500 14px/20px '+getComputedStyle(root).fontFamily+';white-space:normal;overflow-wrap:anywhere';t.textContent=name;root.append(t);const h=t.offsetHeight;t.remove();return h;};"
  + "for(const n of data.nodes){if(n.junction){n.layoutWidth=n.layoutHeight=10;}else{n.layoutWidth=240;n.layoutHeight=Math.max(48,26+measure(n.name,184));}}"
  + "const sideways=data.edges.filter(e=>['EAST','WEST'].includes(e.fromSide)).length;data.direction=sideways*2>=data.edges.length?'LR':'TB';"
  + "root.dataset.mcxLayout='arch-elk';await prepareMermaidLayout(data);}\n";
const archPatches = [
  ['async function prepareNativeGeometry(data,mermaid,source,db,architecture) {',
   archLayout + 'async function prepareNativeGeometry(data,mermaid,source,db,architecture) {let gridFailed=false;'],
  ["const groups=data.groups.map(g=>({...g,...rect(architecture?'group-'+g.id:g.id)}));",
   "if(architecture){const snap=(key,size)=>{const items=data.nodes.map(n=>({n,c:n[key]+n[size]/2})).sort((a,b)=>a.c-b.c),levels=[];for(const it of items){const last=levels.at(-1);if(last&&it.c-last.c<=24)last.items.push(it);else levels.push({c:it.c,items:[it]});}return levels;};"
   + "const cols=snap('x','w'),rows=snap('y','h'),depth=Math.max(0,...data.groups.map(g=>{let d=1,p=g.parent;while(p){d++;p=data.groups.find(x=>x.id===p)?.parent;}return d;})),colGap=48+48*depth,rowGap=48+68*depth,colOf=new Map(),rowOf=new Map(),cells=new Set();"
   + "cols.forEach((l,i)=>l.items.forEach(it=>colOf.set(it.n,i)));rows.forEach((l,i)=>l.items.forEach(it=>rowOf.set(it.n,i)));for(const n of data.nodes)cells.add(colOf.get(n)+':'+rowOf.get(n));"
   + "if(cells.size!==data.nodes.length)gridFailed=true;else{const colW=cols.map(l=>Math.max(...l.items.map(it=>it.n.w))),rowH=rows.map(l=>Math.max(...l.items.map(it=>it.n.h))),colX=[],rowY=[];colW.reduce((x,w,i)=>(colX[i]=x,x+w+colGap),24);rowH.reduce((y,h,i)=>(rowY[i]=y,y+h+rowGap),68);"
   + "for(const n of data.nodes){const c=colOf.get(n),r=rowOf.get(n);n.x=colX[c]+(colW[c]-n.w)/2;n.y=rowY[r]+(rowH[r]-n.h)/2;}}}"
   + "const groups=data.groups.map(g=>({...g,...rect(architecture?'group-'+g.id:g.id)}));"],
  ['for(const g of groups.filter(g=>!g.parent))bounds(g);',
   "for(const g of groups.filter(g=>!g.parent))bounds(g);"
   + "if(architecture){const inside=(n,g)=>{for(let p=n.parent;p;p=groups.find(x=>x.id===p)?.parent)if(p===g.id)return true;return false;};"
   + "if(gridFailed||groups.some(g=>data.nodes.some(n=>!inside(n,g)&&n.x<g.x+g.w&&g.x<n.x+n.w&&n.y<g.y+g.h&&g.y<n.y+n.h)))return prepareArchitectureLayout(data);}"],
  ['finishMermaidGeometry(data,groups,architecture);',
   "if(architecture){try{finishMermaidGeometry(data,groups,architecture);root.dataset.mcxLayout='arch-grid';}catch(error){return prepareArchitectureLayout(data);}}else finishMermaidGeometry(data,groups,architecture);"],
];

// Git 分支图（新增适配，原先回退 Mermaid 原生图）：
// 18. 读取 Mermaid gitGraph 的分支顺序与提交（序号、分支、父提交、类型、标签），绘制在 git-renderer.js。
// 19. 横排放得下正文宽度时沿用 Mermaid 默认方向（分支泳道 + 提交点，标签在点下、标签牌在点上）；
//     放不下改为 git log 式纵排：左侧窄列表示分支，每个提交一行、文字在右，分支首个提交带分支名。
// 20. 提交形状：普通实心点、合并空心环、高亮方块、回滚叉、拣选虚线环；自动 id 只显示 7 位哈希。
const gitRenderer = await readFile(new URL('../features/mermaid-diagrams/src/mermaid/qv-git.js', import.meta.url), 'utf8');
const gitPatches = [
  ["if(parsed.diagramType==='timeline')return readMermaidTimelineModel(db,descriptions);",
   "if(parsed.diagramType==='timeline')return readMermaidTimelineModel(db,descriptions);if(parsed.diagramType==='gitGraph')return readMermaidGitModel(db,descriptions);"],
  ["if(model.data?.kind==='timeline'){renderMermaidTimeline(root,model.data);finishLoading();return;}",
   "if(model.data?.kind==='timeline'){renderMermaidTimeline(root,model.data);finishLoading();return;}if(model.data?.kind==='git'){renderMermaidGit(root,model.data);finishLoading();return;}"],
  ['function renderMermaidTimeline(root,data) {', gitRenderer + '\nfunction renderMermaidTimeline(root,data) {'],
];

// 时间线（事件区分度）：
// 21. 原事件为 14px/22px 行高、间距仅 12px，多行事件之间的间距小于行高，相邻事件读成一段。
//     每个事件改为低饱和软卡片：所在区段色 7% 底色、8px 圆角、8×10px 内边距，卡片间距 8px；悬停/聚焦加深到 14%。
// 22. 事件圆点对齐卡片首行（原为多行文本的垂直中点），标出每个事件的起点。
const timelinePatches = [
  ['#${root.id} .timeline-events{margin-top:38px;padding-left:22px;display:flex;flex-direction:column;gap:12px}',
   '#${root.id} .timeline-events{margin-top:38px;padding-left:22px;display:flex;flex-direction:column;gap:8px}'],
  ['min-height:30px;padding:4px 0;white-space:normal;overflow-wrap:anywhere;cursor:var(--cursor-interaction,pointer)}',
   'min-height:30px;padding:8px 10px;border-radius:8px;background:color-mix(in srgb,var(--timeline-tone) 7%,var(--background));transition:background-color 140ms;white-space:normal;overflow-wrap:anywhere;cursor:var(--cursor-interaction,pointer)}'],
  ['#${root.id} .timeline-event[data-active=true],#${root.id} .timeline-event:focus-visible{color:var(--viz-series-1);outline:none}',
   '#${root.id} .timeline-event[data-active=true],#${root.id} .timeline-event:focus-visible{color:var(--viz-series-1);outline:none;background:color-mix(in srgb,var(--timeline-tone) 14%,var(--background))}'],
  ['const centers=o.events.map(e=>columnTop+e.offsetTop+e.offsetHeight/2);',
   'const centers=o.events.map(e=>columnTop+e.offsetTop+8+11);'],
];

// 桑基图（尺寸跟随内容与正文宽度）：
// 23. 原宽度固定为 384 + 每列 340px（仅两列时用 736），四列即 1404px，后两列需横向滚动。
//     改为两侧各留 160px 标签区、列间距至少 136px，四列 728px 可放进正文；五列及以上才滚动。
// 24. 原高度固定为「最多节点的列 × 160px」（压测 16 个来源 → 2560px），节点间距至少 72px。
//     改为按标签实际高度：节点间距 = 标签高 + 14px（中间列标签在节点上方，需要让开上一个节点；至少 24px）；流带另留至少 160px（每个节点至少 16px），避免流带过细。
// 25. 标签宽 176 → 152px，名称最多两行省略，悬停显示全名，避免长名称撑高每个间距。
const sankeyPatches = [
  ['#${root.id} .sankey-label{position:absolute;display:flex;flex-direction:column;gap:4px;width:176px;',
   '#${root.id} .sankey-label>span:first-child{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'
   + ' #${root.id} .sankey-label{position:absolute;display:flex;flex-direction:column;gap:4px;width:152px;'],
  ['width=Math.max(viewport.clientWidth,view.expanded?(columns===2?560:736+Math.max(0,columns-3)*220):(columns===2?736:384+(columns-1)*340))',
   'width=Math.max(viewport.clientWidth,view.expanded?(columns===2?560:736+Math.max(0,columns-3)*220):320+(columns-1)*136)'],
  ['height=Math.max(420,count*160),padding=Math.max(72,labelHeight+20)',
   'height=Math.max(320,Math.max(72,labelHeight+20)+labelHeight/2+20+count*Math.max(24,labelHeight+14)+Math.max(160,count*16)),padding=Math.max(24,labelHeight+14)'],
  // 测量与实际标签结构一致：名称放在首个 span 内，两行限制才会作用于测量。
  ['measure.textContent=n.name;', "measure.replaceChildren(Object.assign(document.createElement('span'),{textContent:n.name}));"],
  ['.extent([[184,top],[width-200,height-bottom]])', '.extent([[160,top],[width-160,height-bottom]])'],
  ["b.style.left=(n.x0-184)+'px'", "b.style.left=(n.x0-160)+'px'"],
  ["b.style.left=(n.x0-83)+'px'", "b.style.left=(n.x0-71)+'px'"],
  ["const name=document.createElement('span');name.textContent=n.name;",
   "const name=document.createElement('span');name.textContent=n.name;b.title=n.name;"],
];

// 雷达图（多系列区分与浮层避让）：
// 26. 原多边形填充仅 3.5%，叠加后各自面积与重叠区几乎看不出差别。改为默认 14%，选中 24%、其余降到 3%；
//     线型（实线 / 虚线 / 点线）与标记形状保持不变。通用绘制与预设模板同步。
// 27. 通用绘制原用共享的 placeMermaidDetail，只避让按钮与标题，不避让多边形；预设模板虽计算遮挡面积，
//     但先比较与指针的距离。改为雷达专用定位：候选为指针四周多个距离 + 图表四角空白，
//     先限定触发点附近的候选，再避开选中多边形、其他多边形与轴标签；不盖住指针。预设同步此距离边界。
const radarPlace = "function placeRadarDetail(index,anchor,event){"
  + "const rr=root.getBoundingClientRect(),sr=svg.getBoundingClientRect(),sc=scene.getBoundingClientRect(),scale=sr.width/svg.viewBox.baseVal.width;"
  + "tip.style.position='absolute';tip.style.marginTop='0';tip.style.boxSizing='border-box';tip.style.width=Math.min(188,root.clientWidth-16)+'px';"
  + "const w=tip.offsetWidth,h=tip.offsetHeight,map=p=>({x:sr.left-rr.left+p[0]*scale,y:sr.top-rr.top+p[1]*scale}),polys=groups.map(g=>g.points.map(map));"
  + "const ar=anchor?.getBoundingClientRect(),pointer=event?.type?.startsWith('pointer'),px=pointer?event.clientX-rr.left:ar?ar.left-rr.left+ar.width/2:rr.width/2,py=pointer?event.clientY-rr.top:ar?ar.top-rr.top+ar.height/2:rr.height/2;"
  + "const raw=[];for(const g of [16,32,56])for(const f of [0,.5,1])raw.push([px+g,py-h*f],[px-g-w,py-h*f],[px-w*f,py-g-h],[px-w*f,py+g]);"
  + "const l=sc.left-rr.left+8,t=sc.top-rr.top+8,r=sc.right-rr.left-w-8,b=sc.bottom-rr.top-h-8;raw.push([l,t],[r,t],[l,b],[r,b]);"
  + "const clip=(poly,c)=>{let pts=poly;for(const [axis,edge,sign] of [['x',c.x,1],['x',c.x+w,-1],['y',c.y,1],['y',c.y+h,-1]]){const out=[];for(let i=0;i<pts.length;i++){const a=pts[i],q=pts[(i+1)%pts.length],ai=sign*(a[axis]-edge)>=0,bi=sign*(q[axis]-edge)>=0;if(ai)out.push(a);if(ai!==bi){const k=(edge-a[axis])/(q[axis]-a[axis]);out.push({x:a.x+k*(q.x-a.x),y:a.y+k*(q.y-a.y)});}}pts=out;if(!pts.length)return 0;}return Math.abs(pts.reduce((s,p,i)=>{const q=pts[(i+1)%pts.length];return s+p.x*q.y-q.x*p.y;},0))/2;};"
  + "const boxes=[...labels,...keys].map(n=>{const o=n.getBoundingClientRect();return{x:o.left-rr.left,y:o.top-rr.top,w:o.width,h:o.height};}),cover=(c,o)=>Math.max(0,Math.min(c.x+w,o.x+o.w)-Math.max(c.x,o.x))*Math.max(0,Math.min(c.y+h,o.y+o.h)-Math.max(c.y,o.y));"
  + "const cands=raw.map(([x,y],order)=>{const c={x:Math.max(4,Math.min(root.clientWidth-w-4,x)),y:Math.max(4,Math.min(root.clientHeight-h-4,y)),order};"
  + "c.pointer=px>c.x-4&&px<c.x+w+4&&py>c.y-4&&py<c.y+h+4?1:0;c.selected=index===null?0:clip(polys[index],c);c.others=polys.reduce((s,p,i)=>s+(i===index?0:clip(p,c)),0)+boxes.reduce((s,o)=>s+cover(c,o),0);"
  + "c.distance=Math.hypot(Math.max(c.x-px,0,px-c.x-w),Math.max(c.y-py,0,py-c.y-h));return c;});"
  + "const nearby=nearbyRadarDetails(cands);nearby.sort((a,b)=>a.pointer-b.pointer||Math.round(a.selected/200)-Math.round(b.selected/200)||Math.round(a.others/400)-Math.round(b.others/400)||a.distance-b.distance||a.order-b.order);"
  + "tip.style.left=nearby[0].x+'px';tip.style.top=nearby[0].y+'px';tip.dataset.placement='radar-clear';}\n";
const radarPatches = [
  ["shape=add('polygon',{points:points.map(p=>p.join(',')).join(' '),fill:color(i),'fill-opacity':'.035',",
   "shape=add('polygon',{points:points.map(p=>p.join(',')).join(' '),fill:color(i),'fill-opacity':'.14',"],
  ["g.shape.style.fillOpacity=j===index?'.035':'.003';", "g.shape.style.fillOpacity=j===index?'.24':'.03';"],
  ['tip.hidden=false;placeMermaidDetail(root,tip,b,event,188);}', 'tip.hidden=false;placeRadarDetail(objectMode?index:null,b,event);}'],
  ['function cancel(){cancelAnimationFrame(frame);frame=0;groups.forEach(g=>', radarPlace + 'function cancel(){cancelAnimationFrame(frame);frame=0;groups.forEach(g=>'],
  ["entry.polygon.setAttribute('fill-opacity', isActive ? '0.09' : isDimmed ? '0.003' : '0.035');",
   "entry.polygon.setAttribute('fill-opacity', isActive ? '0.24' : isDimmed ? '0.03' : '0.14');"],
  ['candidates.sort((a,b)=>a.coversPointer-b.coversPointer||Math.max(0,a.distance-40)-Math.max(0,b.distance-40)||a.area-b.area||a.labels-b.labels||Math.abs(a.distance-gap)-Math.abs(b.distance-gap)||a.order-b.order);',
   'candidates.splice(0,candidates.length,...nearbyRadarDetails(candidates));candidates.sort((a,b)=>a.coversPointer-b.coversPointer||Math.round(a.area/200)-Math.round(b.area/200)||Math.round(a.labels/400)-Math.round(b.labels/400)||a.distance-b.distance||a.order-b.order);'],
  ["tooltip.style.left=candidates[0].x+'px';tooltip.style.top=candidates[0].y+'px';",
   "const origin=tooltip.offsetParent.getBoundingClientRect();tooltip.style.left=(rootBounds.left+candidates[0].x-origin.left)+'px';tooltip.style.top=(rootBounds.top+candidates[0].y-origin.top)+'px';"],
  // 29. 轴标签重叠：原每个标签是固定宽（密集时 168px）、以圆外一点为中心的盒子，名称不限行数；
  //     12 轴时相邻锚点只隔约 107px，必然左右重叠，4–5 行长名称又上下重叠（压测 8 对重叠、1 个越出图表）。
  //     改为按方位锚定：右侧标签从锚点向外展开、左侧向内收于锚点、正上 / 正下居中并置于锚点外侧，不向邻居方向延伸；
  //     侧边标签可用至图表边缘的空余宽度（最多 168px）；名称最多两行省略、悬停显示全名；
  //     最后按侧分组自上而下排开残余碰撞，越出底部时整组上移。
  ["const lp=point(i,radius+(dense?56:34));const b=document.createElement('button');b.className='radar-axis-label';b.type='button';b.textContent=a.name;const labelWidth=dense?168:128;b.style.width=labelWidth+'px';scene.append(b);b.style.left=(lp[0]-labelWidth/2)+'px';b.style.top=(lp[1]-b.offsetHeight/2)+'px';b.onpointerenter=b.onclick=e=>show('axis',i,e);b.onfocus=e=>openAxis(i,e);b.onpointerleave=clear;b.onblur=()=>{pendingFocus=null;clear();};labels.push(b);});",
   "const angle=-Math.PI/2+i*Math.PI*2/data.axes.length,cos=Math.cos(angle),sin=Math.sin(angle),lp=point(i,radius+14),side=cos>.25?'right':cos<-.25?'left':sin<0?'top':'bottom';"
   + "const b=document.createElement('button');b.className='radar-axis-label';b.type='button';b.title=a.name;b.dataset.side=side;const text=document.createElement('span');text.textContent=a.name;text.style.cssText='display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden';b.append(text);"
   + "const labelWidth=side==='right'?Math.max(72,Math.min(168,width-lp[0]-4)):side==='left'?Math.max(72,Math.min(168,lp[0]-4)):dense?140:128;b.style.width=labelWidth+'px';b.style.textAlign=side==='right'?'left':side==='left'?'right':'center';scene.append(b);"
   + "const h=b.offsetHeight;b.style.left=(side==='right'?lp[0]-8:side==='left'?lp[0]-labelWidth+8:lp[0]-labelWidth/2)+'px';b.style.top=(side==='top'?lp[1]-h+8:side==='bottom'?lp[1]-8:lp[1]-h/2)+'px';"
   + "b.onpointerenter=b.onclick=e=>show('axis',i,e);b.onfocus=e=>openAxis(i,e);b.onpointerleave=clear;b.onblur=()=>{pendingFocus=null;clear();};labels.push(b);});"
   + "for(const side of ['left','right']){const group=labels.filter(b=>b.dataset.side===side).sort((a,b)=>a.offsetTop-b.offsetTop);let bottom=-Infinity;for(const b of group){const top=Math.max(b.offsetTop,bottom+4);b.style.top=top+'px';bottom=top+b.offsetHeight;}"
   + "const overflow=bottom-(height-4);if(overflow>0)for(const b of group)b.style.top=(b.offsetTop-overflow)+'px';}"],
];

// 图例（纵向排列时左对齐，不限于雷达图）：
// 28. 雷达（通用 / 预设）、XY、饼图预设的图例都是 flex 换行 + 居中；名称较长时每项独占一行、各自居中，左缘参差，长名称越出图表。
//     共享规则：放得下一行时保持居中；一旦换行，改为单列——列整体在图下居中，列内各项左缘对齐，
//     名称单行省略、悬停显示全名；尺寸变化时重新判断。
const legendHelper = "function alignMermaidLegends(root){"
  + "if(!document.getElementById('mcx-legend-style')){const st=document.createElement('style');st.id='mcx-legend-style';"
  + "st.textContent='[data-legend-stacked]{display:grid!important;grid-template-columns:minmax(0,max-content);justify-content:center;justify-items:start;max-width:100%}'"
  + "+'[data-legend-stacked]>*{max-width:100%;min-width:0}[data-legend-stacked] .mcx-legend-text{display:block!important;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';document.head.append(st);}"
  + "const legends=[...root.querySelectorAll('.radar-legend,.xy-key,.legend,.quick-radar-legend')];"
  + "const check=el=>{if(el.hidden||!el.children.length)return;el.removeAttribute('data-legend-stacked');const items=[...el.children].filter(n=>n.offsetParent);"
  + "if(new Set(items.map(n=>n.offsetTop)).size<2)return;"
  + "for(const item of items){item.title||=item.textContent.trim();for(const t of [...item.childNodes])if(t.nodeType===3&&t.textContent.trim()){const sp=document.createElement('span');sp.className='mcx-legend-text';t.replaceWith(sp);sp.append(t);}for(const span of item.querySelectorAll('span'))if(!span.children.length&&span.textContent.trim()&&!span.classList.contains('percent'))span.classList.add('mcx-legend-text');}"
  + "el.setAttribute('data-legend-stacked','');};"
  + "legends.forEach(check);if(!root.__mcxLegendObserver){let last=root.clientWidth;root.__mcxLegendObserver=new ResizeObserver(()=>{if(root.clientWidth===last)return;last=root.clientWidth;requestAnimationFrame(()=>root.querySelectorAll('.radar-legend,.xy-key,.legend,.quick-radar-legend').forEach(check));});root.__mcxLegendObserver.observe(root);}}\n";
const legendPatches = [
  ['function placeMermaidDetail(root,tip,anchor,event,preferredWidth=280){', legendHelper + 'function placeMermaidDetail(root,tip,anchor,event,preferredWidth=280){'],
  ['(async()=>{\nconst root=', '(async()=>{document.addEventListener("qv:ready",e=>{const r=e.target.closest?.(".qv-mermaid");if(r)requestAnimationFrame(()=>alignMermaidLegends(r));});\nconst root='],
];

// 象限图（标题与象限区域）：
// 30. 象限、雷达、桑基三个绘制都把源码标题写进 h3，却没有取消隐藏（构建默认隐藏 h3，只有时间线会打开）。
//     改为：源码写了标题就显示，与时间线一致。
// 31. 原象限只有一条细十字线，四个象限名紧贴中心、灰色 12px，与常聚在中心附近的点标签争位。
//     改为：每个象限铺 6% 的系列色底色，象限名移到各自的外角（上方象限贴上沿、下方贴下沿，左侧左对齐、右侧右对齐），
//     12px 中等字重、颜色略向象限色加深；坐标轴保持原样；象限名仍是点标签的避让对象。
const titleFix = ["const title=root.querySelector('h3');if(!title.textContent)title.textContent=data.title;",
  "const title=root.querySelector('h3');if(!title.textContent)title.textContent=data.title;if(title.textContent.trim())title.hidden=false;"];
const quadrantPatches = [
  ['#${root.id} .quadrant-text{position:absolute;font-size:12px;line-height:18px;color:var(--muted-foreground);overflow-wrap:anywhere}',
   '#${root.id} .quadrant-text{position:absolute;font-size:12px;line-height:18px;color:var(--muted-foreground);overflow-wrap:anywhere}'
   + ' #${root.id} .quadrant-text.quadrant-caption{font-weight:500;color:color-mix(in srgb,var(--q-tone) 55%,var(--foreground))}'],
  ["add('line',{x1:x+w/2,y1:y,x2:x+w/2,y2:y+h,stroke:'var(--border)'});",
   "[[x+w/2,y],[x,y],[x,y+h/2],[x+w/2,y+h/2]].forEach(([qx,qy],k)=>{const r=add('rect',{x:qx,y:qy,width:w/2,height:h/2});r.style.fill='color-mix(in srgb,var(--viz-series-'+(k+1)+') 6%,var(--background))';});"
   + "add('rect',{x,y,width:w,height:h,fill:'none',stroke:'var(--border)'});"
   + "add('line',{x1:x+w/2,y1:y,x2:x+w/2,y2:y+h,stroke:'var(--border)'});"],
  ["data.quadrants.forEach((t,i)=>{const right=i===0||i===3,upper=i<2,n=label(t,right?cx+12:cx-captionWidth-12,0,captionWidth,right?'left':'right');n.classList.add('quadrant-caption');n.style.top=(upper?cy-12-n.offsetHeight:cy+12)+'px';});",
   "data.quadrants.forEach((t,i)=>{const right=i===0||i===3,upper=i<2,n=label(t,right?x+w-captionWidth-12:x+12,0,captionWidth,right?'right':'left');n.classList.add('quadrant-caption');n.style.setProperty('--q-tone','var(--viz-series-'+(i+1)+')');n.style.top=(upper?y+10:y+h-10-n.offsetHeight)+'px';});"],
];

const polishPatches = [
  // 34. 悬停时快进入场，而不是忽略悬停。
  ["function showTip(n,event){clearTimeout(leaveTimer);if(activeNode===n.id&&!architectureReader)return;if(root.dataset.motion==='running')return;",
   "function showTip(n,event){clearTimeout(leaveTimer);if(activeNode===n.id&&!architectureReader)return;if(root.dataset.motion==='running'){runningAnimations.forEach(a=>a.finish());root.dataset.motion='complete';}"],
  ["if(activeNode!==n.id&&root.dataset.motion!=='running')queueNodeHover(n,e);", "if(activeNode!==n.id)queueNodeHover(n,e);"],
  // 35. 已有气泡打开时，相邻对象立即接替。
  ['enter=setTimeout(()=>{current=element;activate();},100);', 'enter=setTimeout(()=>{current=element;activate();},current?0:100);'],
  ["tip.style.left=c.x+'px';tip.style.top=c.y+'px';tip.dataset.placement='near';",
   "tip.style.left=c.x+'px';tip.style.top=c.y+'px';tip.dataset.placement='near';tip.style.transformOrigin=`${Math.max(0,Math.min(w,x+aw/2-c.x))}px ${Math.max(0,Math.min(h,y+ah/2-c.y))}px`;"],
];

const typePatches = [
  // 37. XY 刻度数字降为次要色。
  ["text(v,{x:y(v),y:bottom+22,'text-anchor':'middle'});", "text(v,{x:y(v),y:bottom+22,'text-anchor':'middle',fill:'var(--muted-foreground)'});"],
  ["text(v,{x:left-12,y:y(v)+4,'text-anchor':'end'});", "text(v,{x:left-12,y:y(v)+4,'text-anchor':'end',fill:'var(--muted-foreground)'});"],
  // 横向滚动时固定在左侧的纵轴刻度（HTML 副本）同样降为次要色。
  ["label.style.cssText='position:absolute;right:12px;top:'+(y(v)-8)+'px';", "label.style.cssText='position:absolute;right:12px;color:var(--muted-foreground);top:'+(y(v)-8)+'px';"],
];

export function adaptQvTemplate(script) {
  script=replaceQv(script,'const parsed=await mermaid.parse(source),diagram=await mermaid.mermaidAPI.getDiagramFromText(source),db=diagram.db;', 'const parsed=await mermaid.parse(source),diagram=await mermaid.mermaidAPI.getDiagramFromText(source,{title:window.__mcxQVRuntime.readTitle(source)}),db=diagram.db;');
  script = replaceQv(script, "e.fromSide=e.toSide=['LR','RL'].includes(data.direction)?'NORTH':'WEST';}}", "{const lr=['LR','RL'].includes(data.direction),flip=['RL','BT'].includes(data.direction);e.fromSide=lr?(flip?'EAST':'WEST'):(flip?'SOUTH':'NORTH');e.toSide=lr?(flip?'WEST':'EAST'):(flip?'NORTH':'SOUTH');}}}");
  for (const [from, to] of sequencePatches) script = replaceQv(script, from, to);
  for (const [from, to] of xyPatches) script = replaceQv(script, from, to);
  for (const [from, to] of mindmapPatches) script = replaceQv(script, from, to);
  for (const [from, to] of archPatches) script = replaceQv(script, from, to);
  for (const [from, to] of gitPatches) script = replaceQv(script, from, to);
  for (const [from, to] of timelinePatches) script = replaceQv(script, from, to);
  for (const [from, to] of sankeyPatches) script = replaceQv(script, from, to);
  for (const [from, to] of radarPatches) script = replaceQv(script, from, to);
  for (const [from, to] of legendPatches) script = replaceQv(script, from, to);
  for (const [from, to] of quadrantPatches) script = replaceQv(script, from, to);
  const titles = script.split(titleFix[0]);
  if (titles.length !== 4) throw new Error('QV 标题锚点数量变化');
  script = titles.join(titleFix[1]);
  for (const [from,to] of polishPatches) script=replaceQv(script,from,to);
  for (const [from,to] of typePatches) script=replaceQv(script,from,to);
  return script;
}

// 只改当前模板中实际存在的 animate 调用；原型和外部库均不变。
export function adaptQvMotion(script) {
  const ast=parse(script,{ecmaVersion:'latest'}),edits=[];
  function visit(node){
    if(!node||typeof node!=='object')return;
    if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&node.callee.property.name==='animate'){
      const object=script.slice(node.callee.object.start,node.callee.object.end);
      edits.push([node.start,node.arguments[0].start,`animateMermaidEntry(${object},`]);
    }
    for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value?.type)visit(value);}
  }
  visit(ast);
  for(const [start,end,text] of edits.sort((a,b)=>b[0]-a[0]))script=script.slice(0,start)+text+script.slice(end);
  script=replaceQv(script,'k=1-(1-t)**4','k=mermaidEntryProgress(t)');
  script=replaceQv(script,'const k=1-Math.pow(1-t,4)','const k=mermaidEntryProgress(t)');
  script=replaceQv(script,'.ease(d3.easeCubicOut)','.ease(mermaidEntryProgress)');
  script=replaceQv(script,'.ease(d3.easeCubicInOut)','.ease(mermaidEntryProgress)');
  script=replaceQv(script,'scene.offsetWidth*(1-(1-t)**4)','scene.offsetWidth*mermaidEntryProgress(t)');
  script=replaceQv(script,"Math.max(...data.nodes.map(n=>n.layer))*220+810",'mermaidEntryBudget');
  return script;
}

// 规则 38：完整图拥有唯一模型；不再生成节点组开关和下钻投影。
export function removeQvNavigation(script){
 script=replaceQv(script,"let mermaidRuntime,data,sourceModel,drilldownActive=true,navigationEnabled=false,currentScope=null,navigationBusy=false;const scopeScroll=new Map();",'let data,sourceModel;');
 script=replaceQv(script,'mermaidRuntime=mermaid;','');
 script=replaceQv(script,"navigationEnabled=!!data.groups?.length;drilldownActive=navigationEnabled&&cfg.navigation!=='expanded';root.dataset.hasGroups=String(navigationEnabled);", "root.dataset.hasGroups=String(!!data.groups?.length);");
 script=replaceQv(script,"if(drilldownActive){data=mermaidScopeView(sourceModel);root.dataset.navigation='true';root.dataset.scope='overview';}",'');
 script=replaceQv(script,'else if(data.navigation)await prepareNavigationView(data);','');
 const ast=parse(script,{ecmaVersion:'latest'}),edits=[],removed=new Set();
 const obsolete=new Set(['closeCrumbPanel','openCrumbPanel','drawNavigation','capturePositions','transitionView','setNavigationMode','navigateScope','drawGroupPreview']);
 function visit(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='FunctionDeclaration'&&obsolete.has(node.id.name)){removed.add(node.id.name);edits.push([node.start,node.end]);return;}
  if(node.type==='IfStatement'&&node.test.type==='MemberExpression'&&node.test.object.name==='n'&&node.test.property.name==='groupCard'){edits.push([node.start,node.end]);return;}
  if(node.type==='VariableDeclaration'&&node.declarations[0]?.id.name==='crumbPanel'){edits.push([node.start,node.end]);return;}
  if(node.type==='ExpressionStatement'){
   const value=node.expression;
   if(value.type==='CallExpression'&&['closeCrumbPanel','drawNavigation'].includes(value.callee.name)
    ||value.type==='AssignmentExpression'&&value.right.type==='ArrowFunctionExpression'&&value.right.body.callee?.name==='navigateScope'){
     edits.push([node.start,node.end]);return;
   }
  }
  for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value?.type)visit(value);}
 }
 visit(ast);
 for(const name of obsolete)if(!removed.has(name))throw new Error('QV 下钻函数缺失：'+name);
 for(const [start,end] of edits.sort((a,b)=>b[0]-a[0]))script=script.slice(0,start)+script.slice(end);
 return script;
}
