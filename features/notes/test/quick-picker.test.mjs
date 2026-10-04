import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../src/frontend/entry.mjs', import.meta.url), 'utf8');
function fixture() {
  const tasks = new Map(); let id = 0;
  class Node {
    constructor(tag, cls) { this.tag=tag; this.className=cls; this.children=[]; this.dataset={}; this.attrs={}; this.events={}; this.style={setProperty(k,v){this[k]=v}}; this.offsetWidth=60; this.clientWidth=240; this.scrollLeft=0; this.isConnected=true; }
    append(...nodes){ this.children.push(...nodes); }
    setAttribute(k,v){this.attrs[k]=v;}
    removeAttribute(k){delete this.attrs[k]; if(k==='data-preview')delete this.dataset.preview;}
    addEventListener(k,fn){this.events[k]=fn;}
    remove(){this.isConnected=false;}
    querySelector(){return null;}
    get scrollWidth(){return this.children.reduce((w,n)=>w+n.offsetWidth+2,-2)+parseFloat(this.style['--qp-arrow-space']||0);}
    scrollBy({left}){this.scrollLeft=Math.max(0,Math.min(this.scrollWidth-this.clientWidth,this.scrollLeft+left));this.events.scroll?.();}
    getBoundingClientRect(){return this.rect;}
    animate(frames){this.animation=frames;}
  }
  const mounted=[], observers=[], frames=[];
  const panel=new Node('div'); panel.rect={left:300,right:700};
  const context={panel,categories:Array.from({length:6},(_,i)=>({id:String(i),name:'Category '+i})), orderedItems:()=>[{}],text:en=>en, element:(tag,cls)=>new Node(tag,cls),control:(label,fn,cls)=>{const n=new Node('button',cls); n.click=fn; return n}, renderList(){}, ResizeObserver:class{constructor(fn){this.fn=fn;observers.push(this)}observe(){}}, requestAnimationFrame:fn=>frames.push(fn),previewReducedMotion:()=>false,cardPreview:()=>({data:'local'}),innerWidth:1100,innerHeight:800,config:{ui:{surface(){},mount(n){mounted.push(n)}}},setTimeout(fn){tasks.set(++id,fn);return id},clearTimeout(i){tasks.delete(i)},tweenPreview(n,target){n.target=target}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('let quickCategory ='),source.indexOf('// 输入框 Popover：只浏览与插入')),context);
  return {context,Node,panel,mounted,observers,frames,flush(){const current=[...tasks.values()];tasks.clear();current.forEach(fn=>fn());}};
}
test('category arrows expose hidden tabs and disappear when resized to fit',()=>{
  const f=fixture(); const bar=vm.runInContext('quickCategoryTabs()',f.context),[tabs,arrows]=bar.children;
  f.frames.forEach(fn=>fn());
  assert.equal(arrows.children[0].hidden,true);assert.equal(arrows.children[1].hidden,false);
  for(let i=0;i<6;i++)arrows.children[1].click();
  assert.equal(arrows.children[0].hidden,false);assert.equal(arrows.children[1].hidden,true);
  tabs.clientWidth=1000;f.observers[0].fn();
  assert.equal(arrows.hidden,true);assert.equal(tabs.style['--qp-arrow-space'],'0px');
});
test('full image anchors to row center, fits viewport and clears after scrolling',()=>{
  const f=fixture();const anchor=new f.Node('button');anchor.rect={top:450,height:30};f.context.anchor=anchor;
  vm.runInContext('showQuickPreview({summary:"Preview"},anchor)',f.context);f.flush();
  const node=f.mounted[0],image=node.children[0];image.naturalWidth=720;image.naturalHeight=400;image.onload();
  assert.equal(node.style.left,'712px');
  assert.equal(parseFloat(node.style.top)+parseFloat(node.style.height)/2,465);
  assert.equal(node.children.length,1);assert.equal(anchor.dataset.preview,'true');
  vm.runInContext('clearQuickPreview(false,-80)',f.context);
  assert.equal(node.target.transform,'translateY(-10px) scale(.98)');assert.equal(node.isConnected,true);
  f.flush();assert.equal(node.isConnected,false);assert.equal(anchor.dataset.preview,undefined);
});
test('preview flips left and pending hover cannot survive immediate close',()=>{
  const f=fixture();f.panel.rect={left:400,right:1080};const anchor=new f.Node('button');anchor.rect={top:780,height:30};f.context.anchor=anchor;
  vm.runInContext('showQuickPreview({summary:"Preview"},anchor)',f.context);f.flush();
  const node=f.mounted[0],image=node.children[0];image.naturalWidth=400;image.naturalHeight=600;image.onload();
  assert.equal(node.style.left,'148px');assert.equal(node.style.top,'428px');
  vm.runInContext('showQuickPreview({summary:"Next"},anchor); clearQuickPreview(true)',f.context);f.flush();
  assert.equal(f.mounted.length,1);assert.equal(node.isConnected,false);
});
