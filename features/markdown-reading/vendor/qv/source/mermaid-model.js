function declaredMermaidIcon(value){
 if(!value)return null;
 const name=value.startsWith('lucide:')?value.slice(7):'',key=name.replace(/(^|-)([a-z0-9])/g,(_,dash,c)=>c.toUpperCase());
 if(!name||!window.lucide?.icons?.[key])throw new Error('图标不可用：'+value+'；请使用宿主已有的 lucide 图标');
 return name;
}
const hasRichMermaidLabel=value=>/<[^>]+>/.test(String(value||''));
// 只在这一层访问固定版本的 Mermaid 数据接口，不解析源码字符串。
async function readSimpleMermaidModel(mermaid, source, descriptions) {
  const parsed = await mermaid.parse(source);
  if (!['flowchart-v2', 'flowchart', 'flowchart-elk'].includes(parsed.diagramType)) {
    return {reason: `${parsed.diagramType} 尚未适配 qv 绘制`,diagramType:parsed.diagramType};
  }
  // Mermaid 11.12.0 没有公开通用 AST；将版本相关接口隔离在此处。
  const diagram = await mermaid.mermaidAPI.getDiagramFromText(source);
  const db = diagram.db;
  if (!db.getVertices || !db.getEdges || !db.getSubGraphs || !db.getDirection) {
    return {reason: 'Mermaid 数据接口不兼容'};
  }
  const vertices = [...db.getVertices().values()];
  const groups = db.getSubGraphs();
  const links = db.getEdges();
  const ids = new Set(vertices.map(v => v.id));
  const supportedShapes = new Set(['square', 'round']);
  if (!vertices.length || vertices.some(v => (!supportedShapes.has(v.type || 'square') || v.icon&&v.form==='circle') || v.labelType === 'markdown' || hasRichMermaidLabel(v.text))) {
    return {reason: '此图包含尚未适配的节点形状或富文本'};
  }
  if (groups.some(g=>hasRichMermaidLabel(g.title)) || links.some(e=>hasRichMermaidLabel(e.text))) return {reason:'富文本标签尚未适配 qv 绘制'};
  if (vertices.some(v => v.styles?.length || v.classes?.length) || links.some(e => e.style?.length || e.classes?.length)) {
    return {reason: '此图包含自定义样式，保留原始语义'};
  }
  if (links.some(e => !ids.has(e.start) || !ids.has(e.end) || !['arrow_point', 'arrow_open'].includes(e.type))) {
    return {reason: '此图包含分组端点或尚未适配的箭头类型'};
  }
  if (groups.some(g => g.nodes.some(id => !ids.has(id)))) {
    return {reason: '嵌套分组尚未适配 qv 绘制'};
  }
  const direction = db.getDirection() || 'TB';
  if (groups.length && (!['TB','BT'].includes(direction) || groups.some(g => g.dir))) return {reason: '此分组方向尚未适配 qv 布局'};
  if (links.some(e => e.start === e.end)) return {reason: '自环尚未适配 qv 连线'};
  const iconFor = label => {
    const rules = [
      [/网关|gateway/i, 'network'], [/web|网页|浏览器/i, 'monitor'],
      [/移动|手机|app\b/i, 'smartphone'], [/认证|登录|auth/i, 'key-round'],
      [/内容|文档|content/i, 'file-text'], [/搜索索引|index/i, 'scan-search'],
      [/搜索|search/i, 'search'], [/后台|任务|worker/i, 'workflow'],
      [/postgres|mysql|数据库|database|\bdb\b/i, 'database'], [/redis|缓存|cache/i, 'zap'],
      [/对象|文件存储|storage|object/i, 'archive'], [/队列|queue/i, 'list-tree'],
      [/api|服务|server/i, 'server']
    ];
    return rules.find(([pattern]) => pattern.test(label))?.[1] || null;
  };
  const nodes = vertices.map(v => ({id: v.id, name: v.text || v.id, icon: declaredMermaidIcon(v.icon)||iconFor(v.text || v.id), explicitIcon:!!v.icon,
    description: descriptions[v.id] || '', layer: 0}));
  const byId = new Map(nodes.map(n => [n.id, n]));
  let layers;
  if (groups.length) {
    const memberships = new Map();
    for (const g of groups) for (const id of g.nodes) {
      if (memberships.has(id)) return {reason: '重叠分组尚未适配 qv 绘制'};
      memberships.set(id, g.id);
    }
    if (nodes.some(n => !memberships.has(n.id))) return {reason: '部分分组尚未适配 qv 绘制'};
    layers = groups.map(g => g.title || g.id);
    groups.forEach((g, i) => g.nodes.forEach(id => {byId.get(id).layer = i;}));
  } else {
    const degree = new Map(nodes.map(n => [n.id, 0]));
    links.forEach(e => degree.set(e.end, degree.get(e.end) + 1));
    const queue = nodes.filter(n => degree.get(n.id) === 0);
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i];
      for (const e of links.filter(e => e.start === n.id)) {
        const next = byId.get(e.end);
        next.layer = Math.max(next.layer, n.layer + 1);
        degree.set(e.end, degree.get(e.end) - 1);
        if (degree.get(e.end) === 0) queue.push(next);
      }
    }
    if (queue.length !== nodes.length) return {reason: '无分组回路尚未适配 qv 布局'};
    layers = Array.from({length: Math.max(...nodes.map(n => n.layer)) + 1}, () => '');
  }
  if (links.some(e => Math.abs(byId.get(e.start).layer - byId.get(e.end).layer) !== 1)) return {reason: '同层或跨多层连线尚未适配 qv 路由'};
  for(const g of groups)for(const id of g.nodes)byId.get(id).parent=g.id;
  return {data: {nodes, groups:groups.map(g=>({id:g.id,name:g.title||g.id,description:descriptions[g.id]||''})), layers, direction, grouped: !!groups.length,
    edges: links.map(e => ({from: e.start, to: e.end, async: e.stroke === 'dotted',
      thick: e.stroke === 'thick', arrow: e.type !== 'arrow_open', label: e.text || ''}))}};
}

async function readMermaidModel(mermaid,source,descriptions) {
  const simple=await readSimpleMermaidModel(mermaid,source,descriptions);
  if(simple.diagramType==='block')return readMermaidBlockModel(mermaid,source,descriptions);
  if(simple.diagramType==='c4')return readMermaidC4Model(mermaid,source,descriptions);
  if(simple.diagramType==='quadrantChart')return readMermaidQuadrantModel(mermaid,source,descriptions);
  if(simple.data){simple.data.kind='flowchart';simple.data.generic=true;return simple;}
  const parsed=await mermaid.parse(source),diagram=await mermaid.mermaidAPI.getDiagramFromText(source),db=diagram.db;
  if(parsed.diagramType==='sequence')return readMermaidSequenceModel(mermaid,source,descriptions);
  if(parsed.diagramType==='sankey')return readMermaidSankeyModel(db,descriptions);
  if(parsed.diagramType==='radar')return readMermaidRadarModel(db,descriptions);
  if(parsed.diagramType==='xychart')return readMermaidXYModel(db,descriptions);
  if(parsed.diagramType==='pie')return readMermaidPieModel(db,descriptions);
  if(parsed.diagramType==='kanban')return readMermaidKanbanModel(db,descriptions);
  if(parsed.diagramType==='gantt')return readMermaidGanttModel(db,descriptions);
  if(parsed.diagramType==='mindmap')return readMermaidMindmapModel(db,descriptions);
  if(parsed.diagramType==='journey')return readMermaidJourneyModel(db,descriptions);
  if(parsed.diagramType==='timeline')return readMermaidTimelineModel(db,descriptions);
  if(parsed.diagramType==='class')return readMermaidClassModel(db,descriptions);
  if(parsed.diagramType==='er')return readMermaidErModel(db,descriptions);
  if(parsed.diagramType==='stateDiagram')return readMermaidStateModel(db,descriptions);
  const iconFor=name=>{const rules=[[/web|客户端|client/i,'monitor'],[/app|移动/i,'smartphone'],[/网关|gateway/i,'network'],[/数据库|存储|database|disk|postgres|mysql/i,'database'],[/缓存|redis/i,'zap'],[/队列|queue/i,'list-tree'],[/cloud|云/i,'cloud'],[/server|服务|api/i,'server'],[/internet|网络/i,'globe'],[/auth|认证/i,'key-round']];return rules.find(([re])=>re.test(name))?.[1]||null;};
  if(parsed.diagramType==='architecture'){
    const groups=db.getGroups().map(g=>({id:g.id,name:g.title||g.id,description:descriptions[g.id]||'',parent:g.in,icon:({cloud:'cloud',database:'database',disk:'hard-drive',internet:'globe',server:'server'}[g.icon]||'layers')})),all=db.getNodes();
    if(all.some(n=>n.iconText||(n.icon&&!['cloud','database','disk','internet','server'].includes(n.icon))))return {reason:'自定义图标或图标内文字尚未适配 qv 绘制'};
    const nodes=all.map(n=>({id:n.id,name:n.title||n.id,resource:n.icon||'',parent:n.in,icon:({cloud:'cloud',database:'database',disk:'hard-drive',internet:'globe',server:'server'}[n.icon]||iconFor(n.title||n.id)),explicitIcon:!!n.icon,junction:n.type==='junction',description:descriptions[n.id]||'',layer:0}));
    const dirs={T:'NORTH',B:'SOUTH',L:'WEST',R:'EAST'};
    const edges=db.getEdges().map(e=>({from:e.lhsGroup?(all.find(n=>n.id===e.lhsId).in||e.lhsId):e.lhsId,to:e.rhsGroup?(all.find(n=>n.id===e.rhsId).in||e.rhsId):e.rhsId,sourceFrom:e.lhsId,sourceTo:e.rhsId,fromGroup:!!e.lhsGroup,toGroup:!!e.rhsGroup,fromSide:dirs[e.lhsDir],toSide:dirs[e.rhsDir],arrow:!!e.rhsInto,startArrow:!!e.lhsInto,label:e.title||''}));
    return {data:{nodes,groups,edges,generic:true,nativeGeometry:true,architecture:true,db,layers:[],direction:'LR',grouped:true}};
  }
  if(!['flowchart','flowchart-v2','flowchart-elk'].includes(parsed.diagramType))return simple;
  const vertices=[...db.getVertices().values()],rawGroups=db.getSubGraphs(),links=db.getEdges();
  if(vertices.some(n=>n.styles?.length||n.classes?.length)||links.some(e=>e.style?.length||e.classes?.length))return {reason:'此图包含自定义样式，保留 Mermaid 原始外观'};
  const shapes={square:'rect',rect:'rect',round:'round',rounded:'round',diamond:'diamond',question:'diamond',hexagon:'hexagon',hex:'hexagon',circle:'circle',doublecircle:'doublecircle',stadium:'stadium',cylinder:'cylinder',cyl:'cylinder',subroutine:'subroutine','fr-rect':'subroutine',lean_left:'lean-left',lean_right:'lean-right',trapezoid:'trapezoid',inv_trapezoid:'inv-trapezoid',odd:'odd'};
  if(vertices.some(n=>!shapes[n.type||'square']||n.labelType==='markdown'||hasRichMermaidLabel(n.text)))return simple;
  if(rawGroups.some(g=>hasRichMermaidLabel(g.title))||links.some(e=>hasRichMermaidLabel(e.text)))return {reason:'富文本标签尚未适配 qv 绘制'};
  const parents=new Map();for(const g of rawGroups)for(const id of g.nodes)parents.set(id,g.id);
  const groupIds=new Set(rawGroups.map(g=>g.id));
  const groups=rawGroups.map(g=>({id:g.id,name:g.title||g.id,description:descriptions[g.id]||'',parent:parents.get(g.id),direction:g.dir}));
  const nodes=vertices.filter(n=>!groupIds.has(n.id)).map(n=>({id:n.id,name:n.text||n.id,shape:n.icon?(n.form==='circle'?'circle':'round'):shapes[n.type||'square'],parent:parents.get(n.id),icon:declaredMermaidIcon(n.icon)||iconFor(n.text||n.id),explicitIcon:!!n.icon,description:descriptions[n.id]||'',layer:0}));
  const edges=links.map(e=>({from:e.start,to:e.end,label:e.text||'',arrow:e.type!=='arrow_open',startArrow:e.type?.startsWith('double_'),marker:e.type?.includes('circle')?'circle':e.type?.includes('cross')?'cross':'point',async:e.stroke==='dotted',invisible:e.stroke==='invisible',thick:e.stroke==='thick'}));
  return {data:{nodes,groups,edges,kind:'flowchart',generic:true,nativeGeometry:groups.some(g=>g.direction),db,layers:[],direction:db.getDirection()||'TB',grouped:!!groups.length}};
}
