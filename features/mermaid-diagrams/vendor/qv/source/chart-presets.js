async function renderMermaidDonutPreset(presetRoot,config,summary){
 const d3=await import('https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm');
 class PresetResizeObserver{constructor(callback){let frame=0;this.observer=new ResizeObserver(()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;callback();});});}observe(target){this.observer.observe(target);}}
 const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 presetRoot.innerHTML="\n\u003cstyle\u003e\n#@@ID@@{position:relative;padding-top:32px;width:100%;color:var(--foreground);--ring-enter:650}\n#@@ID@@ h3{margin:0 90px 32px 0;font-weight:500}\n#@@ID@@ .plot{position:relative}\n#@@ID@@ .direct-label{position:absolute;transform:translate(-50%,-50%);background:transparent;border:0;padding:5px;color:var(--foreground);font:inherit;font-size:14px;text-align:center;white-space:nowrap;cursor:var(--cursor-interaction,pointer)}\n#@@ID@@ .direct-label span{display:block;margin-top:4px;color:var(--muted-foreground);font-size:13px;font-variant-numeric:tabular-nums}\n#@@ID@@ .legend[hidden]{display:none}\n#@@ID@@ .chart{width:100%;display:block}\n#@@ID@@ .center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;width:140px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}\n#@@ID@@ .center-value{line-height:1;white-space:nowrap;font-size:calc(var(--font-size-base,14px)*2.3);font-weight:500;letter-spacing:-.04em;font-variant-numeric:tabular-nums}\n#@@ID@@ .center-label{line-height:1.4;font-size:12px;color:var(--muted-foreground)}\n#@@ID@@ .legend{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 22px;margin-top:20px}\n#@@ID@@ .legend button{font:inherit;font-size:12px;color:var(--foreground);background:transparent;border:0;border-radius:0;display:inline-flex;align-items:center;gap:7px;padding:4px 0;cursor:var(--cursor-interaction,pointer)}\n#@@ID@@ .swatch{width:9px;height:9px;border-radius:2px;display:inline-block;flex-shrink:0}\n#@@ID@@ .percent{color:var(--muted-foreground);font-variant-numeric:tabular-nums}\n#@@ID@@ .slice{transition:opacity 160ms ease;cursor:var(--cursor-interaction,pointer)}\n#@@ID@@ .bubble{position:absolute;z-index:2;width:176px;max-width:calc(100% - 16px);padding:12px 14px;box-sizing:border-box;background:var(--popover);color:var(--popover-foreground);border:1px solid var(--border);border-radius:12px;box-shadow:0 4px 16px color-mix(in srgb,var(--foreground) 10%,transparent);pointer-events:none;font-size:12px}\n#@@ID@@ .bubble[hidden]{display:none}\n#@@ID@@ .bubble-title{font-weight:500;margin-bottom:10px}\n#@@ID@@ .bubble-row{display:flex;align-items:center;gap:8px;font-variant-numeric:tabular-nums}\n#@@ID@@ .bubble-percent{margin-left:auto;color:var(--muted-foreground)}\n@media(prefers-reduced-motion:reduce){#@@ID@@ .slice{transition:none}}\n@media(pointer:coarse){#@@ID@@ .legend button{min-height:44px}}\n\u003c/style\u003e\n\u003ch3 id=\"@@ID@@-title\"\u003e@@TITLE@@\u003c/h3\u003e\n\u003cdiv class=\"plot\"\u003e\u003csvg class=\"chart\" role=\"img\" aria-label=\"@@SUMMARY@@\"\u003e\u003c/svg\u003e\u003cdiv class=\"center\" aria-hidden=\"true\"\u003e\u003cspan class=\"center-value\"\u003e\u003c/span\u003e\u003cspan class=\"center-label\"\u003e\u003c/span\u003e\u003c/div\u003e\u003c/div\u003e\n\u003cdiv class=\"legend\" aria-label=\"来源及占比\"\u003e\u003c/div\u003e\n\u003cdiv class=\"bubble\" role=\"tooltip\" hidden\u003e\u003cdiv class=\"bubble-title\"\u003e\u003c/div\u003e\u003cdiv class=\"bubble-row\"\u003e\u003cspan class=\"swatch\"\u003e\u003c/span\u003e\u003cspan class=\"bubble-value\"\u003e\u003c/span\u003e\u003cspan class=\"bubble-percent\"\u003e\u003c/span\u003e\u003c/div\u003e\u003cdiv class=\"description text-small\" style=\"margin-top:8px\" hidden\u003e\u003c/div\u003e\u003c/div\u003e\n\n\n".replaceAll('@@ID@@',presetRoot.id).replaceAll('@@TITLE@@',escape(config.title)).replaceAll('@@SUMMARY@@',escape(summary));
 
(()=>{
const root=presetRoot,plot=root.querySelector('.plot'),svg=d3.select(root.querySelector('.chart')),legend=root.querySelector('.legend'),bubble=root.querySelector('.bubble');

const numberFormat=new Intl.NumberFormat(undefined,{minimumFractionDigits:config.decimals,maximumFractionDigits:config.decimals});const formatValue=v=>config.valuePrefix+(config.exactValues?String(v):numberFormat.format(v))+config.valueSuffix;
const data=config.items;
const total=d3.sum(data,d=>d.value),color=i=>`var(--viz-series-${i%6+1})`,pct=i=>`${Number((data[i].value/total*100).toFixed(1))}%`;
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');let layout=null,entered=false,lastWidth=0;
let direct=false;const eligibleDirect=data.length<=4&&d3.min(data,d=>d.value/total)>=.08&&data.every(d=>d.label.length<=12);
function clear(){svg.selectAll('.slice').attr('opacity',1);root.querySelectorAll('.legend button,.direct-label').forEach(b=>b.style.opacity=1);root.querySelector('.center-value').textContent=config.valuePrefix+numberFormat.format(total);root.querySelector('.center-label').textContent='总计'+(config.valueSuffix.trim()?' · '+config.valueSuffix.trim():'');bubble.hidden=true;}
function show(i){if(!layout)return;svg.selectAll('.slice').attr('opacity',d=>d.index===i?1:.25);root.querySelectorAll('.legend button,.direct-label').forEach((b,j)=>b.style.opacity=j===i?1:.55);root.querySelector('.center-value').textContent=pct(i);root.querySelector('.center-label').textContent=data[i].label;
if(config.showTooltip===false)return;
root.querySelector('.bubble-title').textContent=data[i].label;const description=root.querySelector('.description');description.textContent=data[i].description||'';description.hidden=!data[i].description;root.querySelector('.bubble-value').textContent=formatValue(data[i].value);root.querySelector('.bubble-percent').textContent=pct(i);root.querySelector('.bubble .swatch').style.background=color(i);bubble.hidden=false;
const d=layout.arcs[i],angle=(d.startAngle+d.endAngle)/2,px=layout.cx+Math.sin(angle)*layout.radius,py=layout.cy-Math.cos(angle)*layout.radius;
const rb=root.getBoundingClientRect(),pb=plot.getBoundingClientRect(),bw=bubble.offsetWidth,bh=bubble.offsetHeight;
bubble.style.left=Math.max(8,Math.min(rb.width-bw-8,px>=layout.cx?px+14:px-bw-14))+'px';bubble.style.top=Math.max(pb.top-rb.top+8,Math.min(pb.top-rb.top+py-bh/2,pb.bottom-rb.top-bh-8))+'px';}
data.forEach((d,i)=>{const b=document.createElement('button');b.type='button';b.innerHTML=`<span class="swatch" style="background:${color(i)}" aria-hidden="true"></span><span class="name"></span><span class="percent"></span>`;b.querySelector('.name').textContent=d.label;b.querySelector('.percent').textContent=pct(i);b.addEventListener('pointerenter',()=>show(i));b.addEventListener('pointerleave',clear);b.addEventListener('focus',()=>show(i));b.addEventListener('blur',clear);legend.append(b);});
function draw(animate=false){const width=Math.round(plot.getBoundingClientRect().width);if(width<1)return;lastWidth=width;direct=eligibleDirect&&width>=420;const height=direct?340:280,cx=width/2,cy=height/2,radius=direct?Math.min(104,width/2-50):Math.min(118,width/2-16),inner=radius*.75;
// 间隔不参与角度分配；随最小正值缩小，避免零值和极小值撑大缺口。
const arcs=d3.pie().sort(null).value(d=>d.value)(data),positiveArcs=arcs.filter(d=>d.data.value>0),smallestAngle=d3.min(positiveArcs,d=>d.endAngle-d.startAngle),gap=positiveArcs.length>1?Math.min(.025,smallestAngle*.2):0;
// 保留接近整圆时的微小端点差，避免三位小数将两端舍入为同一点。
const arc=d3.arc().digits(9).innerRadius(inner).outerRadius(radius).padAngle(gap).cornerRadius(Math.min(3,radius*smallestAngle*.2)),enter=parseFloat(getComputedStyle(root).getPropertyValue('--ring-enter'));layout={width,cx,cy,radius,arcs};
svg.selectAll('*').interrupt();svg.selectAll('*').remove();svg.attr('viewBox',`0 0 ${width} ${height}`);const g=svg.append('g').attr('transform',`translate(${cx},${cy})`);
const slices=g.selectAll('.slice').data(positiveArcs).join('path').attr('class','slice').attr('fill',d=>color(d.index)).attr('d',arc).on('pointerenter pointermove',(_,d)=>show(d.index)).on('pointerleave pointercancel',clear).on('pointerup',e=>{if(e.pointerType==='touch')clear();});
plot.querySelectorAll('.direct-label').forEach(e=>{e.getAnimations().forEach(a=>a.cancel());e.remove();});legend.hidden=direct;
if(direct){arcs.forEach((d,i)=>{const a=(d.startAngle+d.endAngle)/2,side=Math.sin(a)>0?1:-1,narrow=width<460;
const peers=arcs.filter(q=>(Math.sin((q.startAngle+q.endAngle)/2)>0?1:-1)===side).sort((p,q)=>Math.cos((q.startAngle+q.endAngle)/2)-Math.cos((p.startAngle+p.endAngle)/2));const rank=peers.indexOf(d);
const x=narrow?cx+(i<2?1:-1)*width*.28:cx+Math.sin(a)*(radius+64),y=narrow?(i===0||i===3?32:height-32):cy-Math.cos(a)*(radius+48);
const b=document.createElement('button');b.type='button';b.className='direct-label';b.style.left=x+'px';b.style.top=y+'px';b.append(document.createTextNode(data[i].label));const percent=document.createElement('span');percent.textContent=(config.showData?data[i].value+' · ':'')+pct(i);b.append(percent);b.onpointerenter=()=>show(i);b.onpointerleave=clear;b.onfocus=()=>show(i);b.onblur=clear;plot.append(b);
if(animate&&!reduced.matches){
const delay=enter*(.2+i*.05);
b.animate([{opacity:0},{opacity:1}],{delay,duration:enter*.4,easing:'ease',fill:'backwards'});
}
const px=cx+Math.sin(a)*(radius+7),py=cy-Math.cos(a)*(radius+7);
});}
if(animate&&!reduced.matches){
// 细分遮罩只控制显现节奏，不改变实际数据分段。
const id=root.id+'-reveal',mask=svg.append('defs').append('mask').attr('id',id).attr('maskUnits','userSpaceOnUse').attr('x',-radius-2).attr('y',-radius-2).attr('width',radius*2+4).attr('height',radius*2+4);
const segments=d3.range(120),unit=Math.PI*2/120;
const reveal=d3.arc().innerRadius(inner-2);
const cells=mask.selectAll('path').data(segments).join('path').attr('fill','white').attr('d',i=>reveal.outerRadius(inner-2)({startAngle:i*unit-.002,endAngle:(i+1)*unit+.002}));
g.attr('mask',`url(#${id})`);
cells.transition().delay(i=>i/(segments.length-1)*enter*.55).duration(enter*.45).ease(d3.easeCubicOut).attrTween('d',i=>t=>reveal.outerRadius(inner-2+(radius-inner+4)*t)({startAngle:i*unit-.002,endAngle:(i+1)*unit+.002}));
g.transition().delay(enter).on('end',()=>{g.attr('mask',null);mask.remove();});
}clear();}
root.addEventListener('pointerleave',clear);root.addEventListener('keydown',e=>{if(e.key==='Escape')clear();});window.addEventListener('blur',clear);
draw();if(!reduced.matches)svg.attr('visibility','hidden');let inView=false,armed=true;
function replayIfReady(){if(inView&&armed&&!document.hidden){armed=false;entered=true;svg.attr('visibility','visible');draw(true);}}
const observer=new IntersectionObserver(es=>{const e=es[0];if(!e.isIntersecting){inView=false;armed=true;}else if(e.intersectionRatio>=.2){inView=true;replayIfReady();}},{threshold:[0,.2]});
document.addEventListener('visibilitychange',()=>{if(document.hidden)armed=true;else replayIfReady();});
window.addEventListener('pageshow',e=>{if(e.persisted){armed=true;replayIfReady();}});observer.observe(root);
new PresetResizeObserver(()=>{if(Math.round(plot.getBoundingClientRect().width)!==lastWidth)draw();}).observe(plot);
root.dispatchEvent(new Event('qv:ready',{bubbles:true}));
})();

}
async function renderMermaidRadarPreset(presetRoot,config,summary){
 
 class PresetResizeObserver{constructor(callback){let frame=0;this.observer=new ResizeObserver(()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;callback();});});}observe(target){this.observer.observe(target);}}
 const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 presetRoot.innerHTML="\n  \u003cstyle\u003e\n    #@@ID@@ {\n      position: relative;\n      display: grid;\n      gap: 0;\n      padding-top:32px;\n      width: 100%;\n      color: var(--foreground);\n    }\n\n    #@@ID@@ .quick-radar-title {\n      margin: 0 90px 32px 0;\n      color: var(--foreground);\n      font-weight: 500;\n    }\n\n    #@@ID@@ .quick-radar-legend {\n      display: flex;\n      flex-wrap: wrap;\n      gap: 8px 22px;\n      justify-content:center;\n      margin-top:20px;\n    }\n\n    #@@ID@@ .quick-radar-legend[hidden] {\n      display: none;\n    }\n\n    #@@ID@@ .quick-radar-legend-button {\n      display: inline-flex;\n      align-items: center;\n      gap: 6px;\n      margin: 0;\n      padding: 2px 0;\n      color: var(--foreground);\n      font: inherit;\n      background: transparent;\n      border: 0;\n      cursor: var(--cursor-interaction, pointer);\n    }\n\n    #@@ID@@ .quick-radar-legend-button.is-dimmed {\n      color: var(--muted-foreground);\n      opacity: 0.32;\n    }\n\n    #@@ID@@ .quick-radar-swatch {\n      width: 9px;\n      height: 9px;\n      flex: 0 0 auto;\n      background: currentColor;\n    }\n\n    #@@ID@@ .quick-radar-swatch[data-shape=\"circle\"] {\n      border-radius: 50%;\n    }\n\n    #@@ID@@ .quick-radar-swatch[data-shape=\"diamond\"] {\n      transform: rotate(45deg) scale(0.78);\n    }\n\n    #@@ID@@ .quick-radar-swatch[data-shape=\"triangle\"] {\n      clip-path: polygon(50% 0, 100% 100%, 0 100%);\n    }\n\n    #@@ID@@ .quick-radar-plot {\n      position: relative;\n      min-width: 0;\n    }\n\n    #@@ID@@ .quick-radar-svg {\n      display: block;\n      width: 100%;\n      height: auto;\n      overflow: visible;\n    }\n\n    #@@ID@@ .quick-radar-grid,\n    #@@ID@@ .quick-radar-axis {\n      fill: transparent;\n      stroke: var(--border);\n      vector-effect: non-scaling-stroke;\n    }\n\n    #@@ID@@ .quick-radar-grid {\n      stroke-opacity: 0.72;\n    }\n\n    #@@ID@@ .quick-radar-axis {\n      stroke-opacity: 0.58;\n    }\n\n    #@@ID@@ .quick-radar-axis-label,\n    #@@ID@@ .quick-radar-scale-label {\n      fill: var(--foreground);\n      font-size: 12px;\n      font-weight: 400;\n    }\n\n    #@@ID@@ .quick-radar-scale-label {\n      fill: var(--muted-foreground);\n    }\n\n    #@@ID@@ .quick-radar-series-polygon,\n    #@@ID@@ .quick-radar-marker {\n      transition: fill-opacity 160ms ease, stroke-opacity 160ms ease, opacity 160ms ease, stroke-width 160ms ease;\n      vector-effect: non-scaling-stroke;\n    }\n\n    #@@ID@@ .quick-radar-series-polygon {\n      fill: currentColor;\n      stroke: currentColor;\n      stroke-linejoin: round;\n    }\n\n    #@@ID@@ .quick-radar-marker {\n      fill: currentColor;\n      stroke: var(--background);\n      stroke-width: 1.5;\n    }\n\n    #@@ID@@ .quick-radar-hit {\n      fill: transparent;\n      cursor: crosshair;\n    }\n\n    #@@ID@@ .quick-radar-tooltip {\n      position: absolute;\n      z-index: 2;\n      display: grid;\n      gap: 12px;\n      width:188px;\n      box-sizing:border-box;\n      max-width: min(260px, calc(100% - 16px));\n      padding: 12px 14px;\n      color: var(--popover-foreground);\n      background: var(--popover);\n      border: 1px solid var(--border);\n      border-radius: 12px;\n      box-shadow: 0 6px 18px color-mix(in srgb, var(--foreground) 10%, transparent);\n      pointer-events: none;\n    }\n\n    #@@ID@@ .quick-radar-tooltip[hidden] {\n      display: none;\n    }\n\n    #@@ID@@ .quick-radar-tooltip[data-mode=\"object\"] .quick-radar-tooltip-row {grid-template-columns:minmax(0,1fr) auto;}\n\n    #@@ID@@ .quick-radar-tooltip-dimension {\n      display:flex;\n      align-items:center;\n      gap:8px;\n      color: var(--popover-foreground);\n      font-size:14px;\n      line-height:20px;\n      font-weight:600;\n    }\n\n    #@@ID@@ .quick-radar-tooltip-rows {\n      display: grid;\n      gap: 4px;\n    }\n\n    #@@ID@@ .quick-radar-tooltip-row {\n      display: grid;\n      grid-template-columns: auto minmax(0, 1fr) auto;\n      align-items: center;\n      gap: 6px;\n      font-size: 12px;\n    }\n\n    #@@ID@@ .quick-radar-tooltip-row.is-active .quick-radar-tooltip-name {\n      color: var(--popover-foreground);\n      font-weight: 500;\n    }\n\n    #@@ID@@ .quick-radar-tooltip-name {\n      color: var(--popover-foreground);\n    }\n\n    #@@ID@@ .quick-radar-tooltip-value {\n      color: light-dark(color-mix(in srgb,var(--popover-foreground) 64%,var(--popover)),color-mix(in srgb,var(--popover-foreground) 68%,var(--popover)));\n      font-variant-numeric: tabular-nums;\n    }\n\n    @media (prefers-reduced-motion: reduce) {\n      #@@ID@@ .quick-radar-series-polygon,\n      #@@ID@@ .quick-radar-marker {\n        transition: none;\n      }\n    }\n  \u003c/style\u003e\n\n  \u003ch3 class=\"quick-radar-title\" id=\"@@ID@@-title\"\u003e@@TITLE@@\u003c/h3\u003e\n  \u003cp class=\"sr-only\" id=\"@@ID@@-summary\"\u003e@@SUMMARY@@\u003c/p\u003e\n\n  \u003cdiv class=\"quick-radar-plot\" id=\"@@ID@@-plot\"\u003e\n    \u003csvg class=\"quick-radar-svg\" id=\"@@ID@@-svg\" role=\"img\" aria-label=\"@@SUMMARY@@\"\u003e\n      \u003cdesc id=\"@@ID@@-svg-desc\"\u003e@@SUMMARY@@\u003c/desc\u003e\n    \u003c/svg\u003e\n  \u003c/div\u003e\n\n  \u003cdiv class=\"quick-radar-legend\" id=\"@@ID@@-legend\" aria-label=\"数据系列\"\u003e\u003c/div\u003e\n\n  \u003cdiv class=\"quick-radar-tooltip\" id=\"@@ID@@-tooltip\" role=\"tooltip\" hidden\u003e\n    \u003cspan class=\"quick-radar-tooltip-dimension\"\u003e\u003c/span\u003e\n    \u003cdiv class=\"quick-radar-tooltip-rows\"\u003e\u003c/div\u003e\n  \u003c/div\u003e\n\n  \n".replaceAll('@@ID@@',presetRoot.id).replaceAll('@@TITLE@@',escape(config.title)).replaceAll('@@SUMMARY@@',escape(summary));
 
    (() => {
      const SVG_NS = 'http://www.w3.org/2000/svg';
      const root = presetRoot;
      const plot = root.querySelector(`#${presetRoot.id}-plot`);
      const svg = root.querySelector(`#${presetRoot.id}-svg`);
      const legend = root.querySelector(`#${presetRoot.id}-legend`);
      const tooltip = root.querySelector(`#${presetRoot.id}-tooltip`);
      const tooltipDimension = tooltip.querySelector('.quick-radar-tooltip-dimension');
      const tooltipRows = tooltip.querySelector('.quick-radar-tooltip-rows');
      
      const shapes = ['circle', 'square', 'diamond', 'triangle'];
      const numberFormat = new Intl.NumberFormat(undefined, {
        minimumFractionDigits: config.decimals,
        maximumFractionDigits: config.decimals,
      });
      const valueText = (value) => `${config.valuePrefix}${numberFormat.format(value)}${config.valueSuffix}`;
      const colorFor = (index) => `var(--viz-series-${index + 1})`;
      let focusedIndex = null;
      let hoveredIndex = null;
      let pointLocations = [];
      let seriesGroups = [];
      let geometry=null,motionFrame=0;

      const createSvg = (name, attributes = {}) => {
        const element = document.createElementNS(SVG_NS, name);
        Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
        return element;
      };

      const activeIndex = () => hoveredIndex ?? focusedIndex;

      const updateLegend = () => {
        const active = activeIndex();
        legend.querySelectorAll('button').forEach((button) => {
          const index = Number(button.dataset.seriesIndex);

          button.classList.toggle('is-dimmed', active !== null && active !== index);
        });
      };

      const updateSeries = () => {
        const active = activeIndex();
        seriesGroups.forEach((entry, index) => {
          const isActive = active === index;
          const isDimmed = active !== null && !isActive;
          entry.polygon.setAttribute('fill-opacity', isActive ? '0.09' : isDimmed ? '0.003' : '0.035');
          entry.polygon.setAttribute('stroke-opacity', isDimmed ? '0.1' : '1');
          entry.polygon.setAttribute('stroke-width', isActive ? '2.2' : '1.7');
          entry.markers.forEach((marker) => {
            marker.setAttribute('opacity', isDimmed ? '0.1' : isActive ? '1' : '0.78');
            marker.setAttribute('stroke-width', isActive ? '2' : '1.5');
          });
        });
        if (active !== null && seriesGroups[active]) {
          seriesGroups[active].layer.append(seriesGroups[active].group);
        }
        updateLegend();
      };

      const setHover = (index) => {
        if (hoveredIndex === index) return;
        hoveredIndex = index;
        updateSeries();
      };

      const clearHover = () => {
        if (hoveredIndex === null) return;
        hoveredIndex = null;
        updateSeries();
      };

      if (config.series.length <= 1) {
        legend.hidden = true;
      } else {
        config.series.forEach((series, index) => {
          const button = document.createElement('button');
          button.className = 'quick-radar-legend-button';
          button.type = 'button';
          button.dataset.seriesIndex = String(index);



          const swatch = document.createElement('span');
          swatch.className = 'quick-radar-swatch';
          swatch.dataset.shape = shapes[index];
          swatch.style.color = colorFor(index);
          swatch.setAttribute('aria-hidden', 'true');
          const label = document.createElement('span');
          label.textContent = series.name;
          button.append(swatch, label);

          button.addEventListener('mouseenter', () => setHover(index));
          button.addEventListener('mouseleave', clearHover);
          button.addEventListener('focus', () => setHover(index));
          button.addEventListener('blur', clearHover);

          legend.append(button);
        });
      }

      const markerPath = (shape, radius) => {
        if (shape === 'circle') {
          return `M ${-radius},0 A ${radius},${radius} 0 1,0 ${radius},0 A ${radius},${radius} 0 1,0 ${-radius},0`;
        }
        if (shape === 'diamond') {
          return `M 0,${-radius * 1.25} L ${radius},0 L 0,${radius * 1.25} L ${-radius},0 Z`;
        }
        if (shape === 'triangle') {
          return `M 0,${-radius * 1.2} L ${radius * 1.05},${radius} L ${-radius * 1.05},${radius} Z`;
        }
        return `M ${-radius},${-radius} L ${radius},${-radius} L ${radius},${radius} L ${-radius},${radius} Z`;
      };

      const splitLabel = (label, narrow) => {
        const characters = Array.from(label);
        const chunkSize = narrow ? 4 : 9;
        const lines = [];
        for (let index = 0; index < characters.length; index += chunkSize) {
          lines.push(characters.slice(index, index + chunkSize).join(''));
        }
        return lines;
      };

      const polygonPoints = (cx, cy, radius, ratio = 1) => config.dimensions.map((_, index) => {
        const angle = -Math.PI / 2 + index * Math.PI * 2 / config.dimensions.length;
        return [cx + Math.cos(angle) * radius * ratio, cy + Math.sin(angle) * radius * ratio];
      });

      const pointsAttribute = (points) => points.map(([x, y]) => `${x},${y}`).join(' ');

      const showTooltip = (event, dimensionIndex, nearestSeriesIndex) => {
        const objectMode=dimensionIndex===null;
        tooltip.dataset.mode=objectMode?'object':'dimension';
        tooltipDimension.textContent = objectMode?config.series[nearestSeriesIndex].name:config.dimensions[dimensionIndex];
        if(objectMode){const swatch=document.createElement('span');swatch.className='quick-radar-swatch';swatch.dataset.shape=shapes[nearestSeriesIndex];swatch.style.color=colorFor(nearestSeriesIndex);swatch.setAttribute('aria-hidden','true');tooltipDimension.prepend(swatch);}
        tooltipRows.replaceChildren();
        const rows=objectMode?config.dimensions.map((name,i)=>({name,score:config.series[nearestSeriesIndex].values[i],color:nearestSeriesIndex})):config.series.map((series,i)=>({name:series.name,score:series.values[dimensionIndex],color:i}));
        rows.forEach((series, index) => {
          const row = document.createElement('div');
          row.className = 'quick-radar-tooltip-row';
          row.classList.toggle('is-active', objectMode);
          const swatch = document.createElement('span');
          swatch.className = 'quick-radar-swatch';
          swatch.dataset.shape = shapes[series.color];
          swatch.style.color = colorFor(series.color);
          swatch.setAttribute('aria-hidden', 'true');
          const name = document.createElement('span');
          name.className = 'quick-radar-tooltip-name';
          name.textContent = series.name;
          const value = document.createElement('span');
          value.className = 'quick-radar-tooltip-value';
          value.textContent = valueText(series.score);
          if(objectMode)row.append(name,value);else row.append(swatch,name,value);
          tooltipRows.append(row);
        });
        tooltip.hidden = false;

        const rootBounds = root.getBoundingClientRect();
        const plotBounds = plot.getBoundingClientRect();
        const tooltipBounds = tooltip.getBoundingClientRect();
        const bw=tooltipBounds.width,bh=tooltipBounds.height,pad=8,gap=16;
        const ox=plotBounds.left-rootBounds.left,oy=plotBounds.top-rootBounds.top;
        const sx=plotBounds.width/svg.viewBox.baseVal.width,sy=plotBounds.height/svg.viewBox.baseVal.height;
        const polygons=seriesGroups.map(e=>e.points.map(p=>({x:ox+p.x*sx,y:oy+p.y*sy})));
        const minY=root.querySelector('h3').getBoundingClientRect().bottom-rootBounds.top+pad,maxY=Math.max(minY,rootBounds.height-bh-pad),maxX=Math.max(pad,rootBounds.width-bw-pad);
        const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
        const px=event.clientX-rootBounds.left,py=event.clientY-rootBounds.top;
        // 所有候选都紧邻光标，边界约束后再比较附近的遮挡。
        const positions=[];
        for(const offset of [16,28,40]){
          for(const fraction of [0,.25,.5,.75,1])positions.push([px+offset,py-bh*fraction],[px-offset-bw,py-bh*fraction],[px-bw*fraction,py-offset-bh],[px-bw*fraction,py+offset]);
          positions.push([px+offset,py+offset],[px+offset,py-offset-bh],[px-offset-bw,py+offset],[px-offset-bw,py-offset-bh]);
        }
        const candidates=positions.map(([x,y],i)=>({x:clamp(x,pad,maxX),y:clamp(y,minY,maxY),order:i}));
        const overlap=(poly,box)=>{
          let pts=poly;
          for(const [axis,edge,sign] of [['x',box.x,1],['x',box.x+bw,-1],['y',box.y,1],['y',box.y+bh,-1]]){
            const out=[];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],ai=sign*(a[axis]-edge)>=0,bi=sign*(b[axis]-edge)>=0;if(ai)out.push(a);if(ai!==bi){const t=(edge-a[axis])/(b[axis]-a[axis]);out.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}}pts=out;if(!pts.length)return 0;
          }
          return Math.abs(pts.reduce((sum,p,i)=>{const q=pts[(i+1)%pts.length];return sum+p.x*q.y-q.x*p.y;},0))/2;
        };
        const labels=Array.from(svg.querySelectorAll('.quick-radar-axis-label')).map(e=>{const r=e.getBoundingClientRect();return {x:r.left-rootBounds.left,y:r.top-rootBounds.top,w:r.width,h:r.height};});
        candidates.forEach(c=>{
          c.distance=Math.hypot(Math.max(c.x-px,0,px-c.x-bw),Math.max(c.y-py,0,py-c.y-bh));
          c.coversPointer=c.distance<gap/2?1:0;
          c.area=polygons.reduce((sum,p)=>sum+overlap(p,c),0);
          c.labels=labels.reduce((sum,r)=>sum+Math.max(0,Math.min(c.x+bw,r.x+r.w)-Math.max(c.x,r.x))*Math.max(0,Math.min(c.y+bh,r.y+r.h)-Math.max(c.y,r.y)),0);
        });
        candidates.sort((a,b)=>a.coversPointer-b.coversPointer||Math.max(0,a.distance-40)-Math.max(0,b.distance-40)||a.area-b.area||a.labels-b.labels||Math.abs(a.distance-gap)-Math.abs(b.distance-gap)||a.order-b.order);
        tooltip.style.left=candidates[0].x+'px';tooltip.style.top=candidates[0].y+'px';
      };

      const hideTooltip = () => {
        tooltip.hidden = true;
        clearHover();updateSeries();
        svg.querySelectorAll('.quick-radar-axis').forEach(e=>{e.style.stroke='var(--border)';e.style.strokeOpacity='';e.setAttribute('stroke-opacity','.58');});
      };

      const draw = (animate=false) => {
        cancelAnimationFrame(motionFrame);motionFrame=0;hideTooltip();
        const width = Math.max(1, Math.round(plot.getBoundingClientRect().width));
        if (width <= 1) return;
        const narrow = width < 480;
        const denseNarrow = narrow && (
          config.dimensions.length > 6
          || config.dimensions.some((dimension) => Array.from(dimension).length > 4)
        );
        const height = narrow ? 330 : 380;
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(140, (width-132)/2, height * 0.36);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        geometry={cx,cy,radius,axes:polygonPoints(cx,cy,radius)};
        seriesGroups.forEach(e=>e.group.getAnimations().forEach(a=>a.cancel()));
        plot.querySelectorAll('.dimension-key').forEach(e=>e.remove());
        svg.replaceChildren();

        const description = createSvg('desc', { id: `${presetRoot.id}-svg-desc` });
        description.textContent = config.summary;
        svg.append(description);

        const gridLayer = createSvg('g');
        [0.25, 0.5, 0.75, 1].forEach((ratio) => {
          gridLayer.append(createSvg('polygon', {
            class: 'quick-radar-grid',
            points: pointsAttribute(polygonPoints(cx, cy, radius, ratio)),
          }));
          const scaleLabel = createSvg('text', {
            class: 'quick-radar-scale-label',
            x: String(cx + 5),
            y: String(cy - radius * ratio + 13),
          });
          scaleLabel.textContent = numberFormat.format(config.maxValue * ratio);

        });

        polygonPoints(cx, cy, radius).forEach(([x, y]) => {
          gridLayer.append(createSvg('line', {
            class: 'quick-radar-axis',
            x1: String(cx),
            y1: String(cy),
            x2: String(x),
            y2: String(y),
          }));
        });
        svg.append(gridLayer);

        const seriesLayer = createSvg('g');
        seriesGroups = [];
        pointLocations = [];
        config.series.forEach((series, seriesIndex) => {
          const group = createSvg('g', { style: `color:${colorFor(seriesIndex)}` });
          const points = series.values.map((value, dimensionIndex) => {
            const angle = -Math.PI / 2 + dimensionIndex * Math.PI * 2 / config.dimensions.length;
            const distance = radius * value / config.maxValue;
            return {
              x: cx + Math.cos(angle) * distance,
              y: cy + Math.sin(angle) * distance,
              seriesIndex,
              dimensionIndex,
            };
          });
          const polygon = createSvg('polygon', {
            class: 'quick-radar-series-polygon',
            points: pointsAttribute(points.map(({ x, y }) => [x, y])),
          });
          group.append(polygon);
          const markers = points.map((point) => {
            const marker = createSvg('path', {
              class: 'quick-radar-marker',
              d: markerPath(shapes[seriesIndex], 2.8),
              transform: `translate(${point.x} ${point.y})`,
            });
            group.append(marker);
            pointLocations.push(point);
            return marker;
          });
          seriesLayer.append(group);
          seriesGroups.push({ group, polygon, markers, points, layer: seriesLayer });
        });
        svg.append(seriesLayer);

        const labelLayer = createSvg('g');
        config.dimensions.forEach((dimension, index) => {
          const angle = -Math.PI / 2 + index * Math.PI * 2 / config.dimensions.length;
          const directionX = Math.cos(angle);
          const directionY = Math.sin(angle);
          const labelDistance = radius + (denseNarrow ? 12 : narrow ? 18 : 24);
          const x = Math.min(width - 4, Math.max(4, cx + directionX * labelDistance));
          const y = cy + directionY * labelDistance;
          const text = createSvg('text', {
            class: 'quick-radar-axis-label',
            x: String(x),
            y: String(y),
            'text-anchor': directionX > 0.28 ? 'start' : directionX < -0.28 ? 'end' : 'middle',
          });
          const lines = splitLabel(dimension, narrow);
          const firstLineOffset = directionY > 0.45
            ? 12
            : directionY < -0.45
              ? -5 - (lines.length - 1) * 14
              : 4 - (lines.length - 1) * 7;
          lines.forEach((line, lineIndex) => {
            const tspan = createSvg('tspan', {
              x: String(x),
              dy: lineIndex === 0 ? String(firstLineOffset) : '14',
            });
            tspan.textContent = line;
            text.append(tspan);
          });
          labelLayer.append(text);
          const key=document.createElement('button');key.type='button';key.className='dimension-key';key.setAttribute('aria-label',`查看${dimension}，比较全部方案`);key.style.cssText=`position:absolute;left:${x}px;top:${y+firstLineOffset-6}px;transform:translate(${directionX>.28?'0':directionX<-.28?'-100%':'-50%'},-50%);width:${Math.max(48,Math.min(108,dimension.length*12))}px;height:32px;background:transparent;border:0;padding:0;`;key.onfocus=()=>{const r=root.getBoundingClientRect(),p=plot.getBoundingClientRect();showTooltip({clientX:r.left+x,clientY:p.top+y},index,null);};key.onpointerenter=e=>showDimension(e,index);key.onpointerleave=hideTooltip;key.onblur=hideTooltip;plot.append(key);
        });
        svg.append(labelLayer);

        const hit = createSvg('rect', {
          class: 'quick-radar-hit',
          x: '0',
          y: '0',
          width: String(width),
          height: String(height),
          'data-chart-hit': '',
        });
        svg.append(hit);
        updateSeries();
        if(animate){
          // 顶点按数值向外展开，线宽与标记尺寸保持不变，避免整组缩放。
          const paint=t=>{const k=1-Math.pow(1-t,4);seriesGroups.forEach(entry=>{const points=entry.points.map(p=>({x:cx+(p.x-cx)*k,y:cy+(p.y-cy)*k}));entry.polygon.setAttribute('points',pointsAttribute(points.map(p=>[p.x,p.y])));entry.markers.forEach((m,i)=>{m.setAttribute('transform',`translate(${points[i].x} ${points[i].y})`);m.style.opacity=String(Math.min(1,t*5));});});};
          paint(0);const start=performance.now();const tick=now=>{const t=Math.min(1,(now-start)/900);paint(t);if(t<1)motionFrame=requestAnimationFrame(tick);else{motionFrame=0;seriesGroups.forEach(e=>e.markers.forEach(m=>m.style.opacity=''));}};motionFrame=requestAnimationFrame(tick);
        }
      };

      const segmentDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
      const contains=(p,points)=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;};
      function showDimension(event,index){hideTooltip();svg.querySelectorAll('.quick-radar-axis').forEach((e,i)=>{if(i===index){e.style.stroke='var(--foreground)';e.style.strokeOpacity='.4';}});seriesGroups.forEach(e=>e.markers.forEach((m,i)=>m.setAttribute('opacity',i===index?'1':'.2')));showTooltip(event,index,null);}
      function showObject(event,index){hideTooltip();setHover(index);showTooltip(event,null,index);}
      svg.addEventListener('pointermove',event=>{
        if(!geometry||motionFrame){hideTooltip();return;}
        const r=svg.getBoundingClientRect(),scale=svg.viewBox.baseVal.width/r.width,p={x:(event.clientX-r.left)*scale,y:(event.clientY-r.top)*scale};
        const nearest=pointLocations.reduce((best,q)=>{const distance=Math.hypot(p.x-q.x,p.y-q.y);return !best||distance<best.distance?{...q,distance}:best;},null);
        if(nearest&&nearest.distance<=9*scale){showObject(event,nearest.seriesIndex);return;}
        const center={x:geometry.cx,y:geometry.cy};if(Math.hypot(p.x-center.x,p.y-center.y)<12){hideTooltip();return;}
        const axes=geometry.axes.map(([x,y],i)=>({i,distance:segmentDistance(p,center,{x,y})})).sort((a,b)=>a.distance-b.distance);
        if(axes[0].distance<=6*scale){showDimension(event,axes[0].i);return;}
        const edges=seriesGroups.map((e,i)=>({i,inside:contains(p,e.points),distance:Math.min(...e.points.map((q,j)=>segmentDistance(p,q,e.points[(j+1)%e.points.length])))})).sort((a,b)=>a.distance-b.distance||a.i-b.i);
        const target=edges.find(e=>e.distance<=8*scale)||edges.find(e=>e.inside);
        if(target)showObject(event,target.i);else hideTooltip();
      });
      svg.addEventListener('pointerleave', hideTooltip);

      const reduced=matchMedia('(prefers-reduced-motion: reduce)');let visible=false,armed=true,lastWidth=0;
      function replay(){if(visible&&armed&&!document.hidden){armed=false;draw(!reduced.matches);}}
      const observer=new IntersectionObserver(es=>{const e=es[0];if(!e.isIntersecting){visible=false;armed=true;}else if(e.intersectionRatio>=.2){visible=true;replay();}},{threshold:[0,.2]});
      document.addEventListener('visibilitychange',()=>{if(document.hidden)armed=true;else replay();});
      root.addEventListener('pointerleave',hideTooltip);window.addEventListener('blur',hideTooltip);
      const resizeObserver = new PresetResizeObserver(()=>{const w=Math.round(plot.getBoundingClientRect().width);if(w!==lastWidth){lastWidth=w;draw();}});
      resizeObserver.observe(plot);draw();observer.observe(root);
    root.dispatchEvent(new Event('qv:ready',{bubbles:true}));
})();
  
}