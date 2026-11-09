// 规则 32–33：渲染器显式接入，不修改宿主或 iframe 的全局原型。
const mermaidEntryEase='cubic-bezier(.23,1,.32,1)',mermaidEntryBudget=1200;
let mermaidEntryBatch=null;
function animateMermaidEntry(element,frames,options){
 const timing=typeof options==='number'?{duration:options}:{...options};
 timing.easing=mermaidEntryEase;
 if(Array.isArray(frames))frames=frames.map(frame=>{
  const match=typeof frame.transform==='string'&&frame.transform.match(/^scale\((0|0?\.\d+)\)$/);
  if(!match||+match[1]>=.9)return frame;
  return {...frame,transform:`scale(${+match[1]<.5?.92:.97})`,opacity:frame.opacity??(+match[1]<.5?0:1)};
 });
 const animation=element.animate(frames,timing);
 if(!mermaidEntryBatch){mermaidEntryBatch=[];queueMicrotask(()=>{
  const batch=mermaidEntryBatch;mermaidEntryBatch=null;
  const end=Math.max(0,...batch.map(a=>{const t=a.effect.getTiming();return Number(t.delay)+Number(t.duration);}));
  if(end>mermaidEntryBudget){const ratio=mermaidEntryBudget/end;for(const a of batch){const t=a.effect.getTiming();a.effect.updateTiming({delay:Number(t.delay)*ratio,duration:Number(t.duration)*ratio});}}
 });}
 mermaidEntryBatch.push(animation);return animation;
}
// rAF 与 D3 几何动画采用同一条曲线，二分求解 Bézier 的时间参数。
function mermaidEntryProgress(time){
 const t=Math.max(0,Math.min(1,time));let low=0,high=1;
 for(let i=0;i<16;i++){const u=(low+high)/2,x=3*(1-u)*(1-u)*u*.23+3*(1-u)*u*u*.32+u*u*u;if(x<t)low=u;else high=u;}
 const u=(low+high)/2;return 1-(1-u)**3;
}
