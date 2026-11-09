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

export function adaptQvTemplate(script) {
  script = replaceQv(script, "e.fromSide=e.toSide=['LR','RL'].includes(data.direction)?'NORTH':'WEST';}}", "{const lr=['LR','RL'].includes(data.direction),flip=['RL','BT'].includes(data.direction);e.fromSide=lr?(flip?'EAST':'WEST'):(flip?'SOUTH':'NORTH');e.toSide=lr?(flip?'WEST':'EAST'):(flip?'NORTH':'SOUTH');}}}");
  for (const [from, to] of sequencePatches) script = replaceQv(script, from, to);
  for (const [from, to] of xyPatches) script = replaceQv(script, from, to);
  return script;
}
