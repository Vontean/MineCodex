import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/hide-upsell-banner.mjs',import.meta.url),'utf8');
function fixture(specs) {
  class Element {
    constructor({title,usage=false,display='',panel=false}) {
      this.isConnected=true;this.title=title;this.usage=usage;this.panel=panel;this.attrs=new Map();this.writes=0;
      let value=display,priority='';const self=this;
      this.style={get display(){return value;},set display(v){value=v;self.writes++;},
        getPropertyValue:()=>value,getPropertyPriority:()=>priority,
        setProperty:(_,v,p='')=>{value=v;priority=p;self.writes++;},removeProperty:()=>{value='';priority='';}};
    }
    get innerText(){return this.title;}
    get textContent(){return this.title;}
    hasAttribute(k){return this.attrs.has(k);}
    setAttribute(k,v){this.attrs.set(k,v);}
    removeAttribute(k){this.attrs.delete(k);}
    querySelector(selector){return selector==="[role='tabpanel']"?(this.panel?{}:null):{innerText:this.title,textContent:this.title};}
    querySelectorAll(){return this.usage?[{getAttribute:()=> 'Dismiss usage banner'}]:[];}
  }
  const nodes=specs.map(s=>new Element(s)),pending=[];let notify,disconnected=false;
  const document={documentElement:{},querySelectorAll:s=>s==='aside'?nodes:nodes.filter(n=>n.hasAttribute('data-codex-upsell-banner-hidden'))};
  class Observer {constructor(fn){notify=fn;}observe(){}disconnect(){disconnected=true;}}
  const cleanup=new Function('signal','window','document','MutationObserver','queueMicrotask','config',source)(new AbortController().signal,{HTMLElement:Element},document,Observer,fn=>pending.push(fn),{});
  const flush=()=>{while(pending.length)pending.shift()();};
  return {nodes,cleanup,flush,mutate:()=>{notify([]);flush();},queue:()=>notify([]),disconnected:()=>disconnected};
}

test('generic exhaustion needs a native usage dismiss control; old localized titles still work',()=>{
  const f=fixture([{title:'You’re out of usage',usage:true},{title:"You're out of usage",usage:true},
    {title:'You’re out of usage'},{title:'普通通知',usage:true},{title:'Codex 使用额度已用尽'},
    {title:"You're out of Codex and Work usage"}]);
  assert.deepEqual(f.nodes.map(n=>n.style.display),['none','none','','','none','none']);f.cleanup();
});
test('native style reset is hidden again without repeated style writes',()=>{
  const f=fixture([{title:'Codex usage limit reached'}]),n=f.nodes[0];
  n.style.display='block';f.mutate();assert.equal(n.style.display,'none');
  const writes=n.writes;f.mutate();assert.equal(n.writes,writes);f.cleanup();
});
test('reused notification node is restored when it no longer represents exhaustion',()=>{
  const f=fixture([{title:'Codex usage limit reached',display:'flex'}]),n=f.nodes[0];
  n.title='Connection restored';f.mutate();assert.equal(n.style.display,'flex');
  assert.equal(n.hasAttribute('data-codex-upsell-banner-hidden'),false);f.cleanup();
});
test('cleanup restores inline display and queued scans cannot hide again',()=>{
  const f=fixture([{title:'Codex usage limit reached',display:'flex'}]);
  f.queue();f.cleanup();f.flush();assert.equal(f.nodes[0].style.display,'flex');assert.ok(f.disconnected());
});
test('staged title and late usage control are picked up on mutation',()=>{
  const f=fixture([{title:''}]),n=f.nodes[0];n.title='You’re out of usage';f.mutate();assert.equal(n.style.display,'');
  n.usage=true;f.mutate();assert.equal(n.style.display,'none');f.cleanup();
});

test('file preview panels remain visible when document text matches exhaustion wording',()=>{
  const f=fixture([{title:'AI-HANDOFF.md Codex 使用额度达到上限',panel:true},
    {title:"You're out of Codex and Work usage",panel:true,usage:true},
    {title:'Codex 使用额度已用尽'}]);
  assert.deepEqual(f.nodes.map(n=>n.style.display),['','','none']);
  assert.equal(f.nodes[0].hasAttribute('data-codex-upsell-banner-hidden'),false);
  f.cleanup();
});

test('a reused aside is restored when it becomes a document panel',()=>{
  const f=fixture([{title:'Codex usage limit reached',display:'flex'}]),n=f.nodes[0];
  assert.equal(n.style.display,'none');n.panel=true;f.mutate();
  assert.equal(n.style.display,'flex');
  assert.equal(n.hasAttribute('data-codex-upsell-banner-hidden'),false);f.cleanup();
});
