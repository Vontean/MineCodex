// 由 scripts/build-qv-mermaid.mjs 从 QV chart-loading.html 生成，请勿手改。
export function createQvLoading(region) {
const field=document.createElement('div'),canvas=document.createElement('canvas');
field.className='qv-loading-field';canvas.className='qv-loading-canvas';field.setAttribute('aria-hidden','true');field.append(canvas);region.append(field);
region.setAttribute('data-mcx-qv-loading','');region.setAttribute('aria-busy','true');
const ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
let frame=0,last=0,start=0,done=false,geometry;
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>x*x*(3-2*x),cubic=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2,lerp=(a,b,t)=>a+(b-a)*t;
const random=(a,b)=>lerp(a,b,Math.random()),cycle=t=>{const p=t%1;return p<.5?p*2:2-p*2;};
// 对照本机 image-loading-state：固定点阵、双明暗场、30fps 与相同运动参数；不依赖宿主 React。
const durations=[4500,6330,5600,5750,3600,2400].map(n=>n*1.2*random(1,1.35)),phases=durations.map(()=>Math.random());
const bounds=[[random(.1,.32),random(.68,.9)],[random(.1,.32),random(.68,.9)],[random(.68,.9),random(.1,.32)],[random(.68,.9),random(.1,.32)],[random(.42,.52),random(.62,.75)],[random(.5,.62),random(.74,.9)]];
function resize(){const {width,height}=field.getBoundingClientRect(),dpr=Math.max(1,devicePixelRatio||1),spacing=Math.max(1,12/dpr);canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);geometry={width,height,dpr,spacing,cols:Math.max(1,Math.floor(width/spacing)),rows:Math.max(1,Math.floor(height/spacing))};schedule();}
function paint(now){frame=0;if(done||document.hidden||!ctx)return;if(!reduced.matches&&now-last<1000/30){schedule();return;}last=now;if(!start)start=now;const t=reduced.matches?0:now-start,g=geometry;if(!g||!g.width||!g.height)return;
const values=durations.map((d,i)=>lerp(...bounds[i],(i===0||i===2?cubic:smooth)(cycle(t/d+phases[i])))),[x1,y1,x2,y2]=values,r1=.78*values[4],r2=.78*values[5];
ctx.setTransform(g.dpr,0,0,g.dpr,0,0);ctx.clearRect(0,0,g.width,g.height);ctx.fillStyle=getComputedStyle(field).color;
const radius=Math.max(.8,g.spacing*.075),ox=(g.width-(g.cols-1)*g.spacing)/2,oy=(g.height-(g.rows-1)*g.spacing)/2;
for(let y=0;y<g.rows;y++)for(let x=0;x<g.cols;x++){const nx=g.cols===1?.5:x/(g.cols-1),ny=g.rows===1?.5:y/(g.rows-1),a=Math.pow(clamp((1-smooth(clamp(Math.hypot(nx-x1,ny-y1)/r1)))*1.2+(1-smooth(clamp(Math.hypot(nx-x2,ny-y2)/r2)))*.82),1.18);if(a<=.03)continue;ctx.globalAlpha=a;ctx.beginPath();ctx.arc(ox+x*g.spacing,oy+y*g.spacing,radius,0,Math.PI*2);ctx.fill();}
ctx.globalAlpha=1;if(!reduced.matches)schedule();}
function schedule(){if(!done&&!frame&&!document.hidden)frame=requestAnimationFrame(paint);}
const observer=new ResizeObserver(resize);observer.observe(field);
function visibility(){if(document.hidden){cancelAnimationFrame(frame);frame=0;}else schedule();}
function motion(){cancelAnimationFrame(frame);frame=0;schedule();}
document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',motion);

return function finish(){if(done)return;done=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motion);field.remove();region.removeAttribute('data-mcx-qv-loading');region.setAttribute('aria-busy','false');};
}
