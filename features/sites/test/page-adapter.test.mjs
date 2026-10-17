import test from 'node:test';
import assert from 'node:assert/strict';
import {createSitesAdapter} from '../src/adapters/codex/renderer.mjs';

class Node {
  constructor(text='') {this.textContent=text;this.attributes={};this.children=[];this.isConnected=true;this.hidden=false;this.className='';this.classList={contains:key=>this.className.split(' ').includes(key),remove:(...keys)=>{this.className=this.className.split(' ').filter(k=>!keys.includes(k)).join(' ');},add:(...keys)=>{this.className+=' '+keys.join(' ');}};}
  getBoundingClientRect(){return {width:this.hidden?0:100,height:this.hidden?0:100};}
  setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}removeAttribute(k){delete this.attributes[k];}hasAttribute(k){return k in this.attributes;}
  append(n){this.children.push(n);n.parentElement=this;}get lastElementChild(){return this.children.at(-1);}get firstElementChild(){return this.children[0];}
  cloneNode(deep){const n=new Node(this.textContent);n.attributes={...this.attributes};n.className=this.className;if(deep)this.children.forEach(c=>n.append(c.cloneNode(true)));return n;}
  after(n){const parent=this.parentElement;parent.children.splice(parent.children.indexOf(this)+1,0,n);n.parentElement=parent;}
  before(n){const parent=this.parentElement;parent.children.splice(parent.children.indexOf(this),0,n);n.parentElement=parent;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.isConnected=false;}
  click(){this.onclick?.();}focus(){globalThis.document.activeElement=this;}
  closest(){return this.hasAttribute('data-mcx-sites')?this:null;}
  querySelectorAll(selector){const nodes=this.children.flatMap(n=>[n,...n.querySelectorAll(selector)]);return nodes.filter(n=>selector==='[role="tab"]'?n.getAttribute('role')==='tab':selector==='[role="tablist"]'?n.getAttribute('role')==='tablist':selector==='button'?n.button:false);}
  querySelector(selector){return selector.includes('sites-table')?this.list??null:null;}
}
function fixture(context,plus=true){
  const previous=globalThis.document;context.after(()=>{globalThis.document=previous;});
  const state={plan:plus?'plus':'pro',path:plus?'/sites':'/space/sites'};
  const page=new Node();page.className='min-h-full';
  const header=new Node(),input=new Node();input.placeholder='Search sites';header.append(input);
  const create=new Node(plus?'Create Site':'New');create.button=true;header.append(create);
  const tabs=new Node();tabs.setAttribute('role','tablist');tabs.props={tabs:[{key:'owned'},{key:'shared'}],selectedKey:'owned'};
  const originals=['Owned by you','Shared with you'].map((text,index)=>{const n=new Node(text);n.setAttribute('role','tab');n.setAttribute('aria-selected',String(index===0));n.className=index===0?'native-active':'native-inactive';n.onclick=()=>{tabs.props.selectedKey=index?'shared':'owned';originals.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.className=i===index?'native-active':'native-inactive';});};tabs.append(n);return n;});
  const content=new Node(),list=new Node();list.props={viewMode:'grid',shared:false};content.append(list);page.list=list;
  page.append(header);if(plus){page.append(new Node());page.append(tabs);}page.append(content);
  const router={navigate(){},state:{location:{get pathname(){return state.path;}}}};
  const rail={props:{router}};
  globalThis.document={createElement:()=>new Node(),documentElement:{lang:'en'},querySelector:()=>rail,querySelectorAll:()=>[input]};
  const codex={account:()=>({read:()=>({status:state.plan?'available':'unknown',planType:state.plan,key:'account'})}),currentFiber:n=>({memoizedProps:n?.props??{}}),report(){}};
  const adapter=createSitesAdapter(new AbortController().signal,codex);
  return {state,page,tabs,content,create,input,originals,adapter};
}
test('Plus binds Create Site and the actual content after native ownership tabs',context=>{
  const f=fixture(context),p=f.adapter.pageInfo();assert.equal(p.create,f.create);assert.equal(p.content,f.content);assert.equal(p.ownershipTabs,f.tabs);
  f.tabs.props.selectedKey='shared';assert.equal(f.adapter.pageInfo().shared,true);
  f.state.path='/space/sites';assert.equal(f.adapter.pageInfo(),null);
  f.state.plan=null;assert.equal(f.adapter.applicability(),'unknown');
});
test('Plus keeps Added by you when the native shared capability removes ownership tabs',context=>{
  const f=fixture(context);f.tabs.remove();const page=f.adapter.pageInfo();assert.equal(page.ownershipTabs,null);
  const nav=f.adapter.mountOwnership(page,()=>{});assert.deepEqual(nav.node.children.map(n=>n.textContent),['Owned by you','Added by you']);
  nav.selectAdded();assert.equal(nav.selection(),'added');assert.equal(nav.node.children[1].getAttribute('aria-selected'),'true');
  nav.dispose();assert.equal(f.page.children.length,3);
});
test('Space keeps its New action and content boundary; hidden cached pages are excluded',context=>{
  const f=fixture(context,false);assert.equal(f.adapter.pageInfo().create,f.create);assert.equal(f.adapter.pageInfo().content,f.content);
  f.input.hidden=true;assert.equal(f.adapter.pageInfo(),null);
});
test('Added by you selection preserves native actions, keyboard navigation and restoration',context=>{
  const f=fixture(context);let selection;
  const nav=f.adapter.mountOwnership(f.adapter.pageInfo(),value=>selection=value);
  assert.equal(f.tabs.hidden,true);assert.equal(nav.node.children[2].textContent,'Added by you');
  nav.node.children[2].click();assert.equal(selection,'added');assert.equal(f.tabs.props.selectedKey,'owned');
  assert.deepEqual(nav.node.children.map(n=>n.getAttribute('aria-selected')),['false','false','true']);
  nav.node.children[1].click();assert.equal(selection,'native');assert.equal(f.tabs.props.selectedKey,'shared');
  globalThis.document.activeElement=nav.node.children[1];nav.node.onkeydown({key:'ArrowRight',preventDefault(){}});assert.equal(selection,'added');
  nav.dispose();assert.equal(f.tabs.hidden,false);assert.equal(nav.node.isConnected,false);
});

test('Plus recognizes the current Simplified Chinese create action without matching local or hidden controls',context=>{
  const f=fixture(context);
  const hidden=f.create.cloneNode(true);hidden.hidden=true;hidden.button=true;hidden.textContent='创建新站点';
  const owned=f.create.cloneNode(true);owned.button=true;owned.textContent='创建新站点';owned.setAttribute('data-mcx-sites','add');
  f.create.parentElement.children.unshift(hidden,owned);
  f.create.textContent='创建新站点';
  assert.equal(f.adapter.pageInfo().create,f.create);
  for(const label of ['Create Site','创建站点','建立網站']) {
    f.create.textContent=label;assert.equal(f.adapter.pageInfo().create,f.create);
  }
  f.create.textContent='创建新站点示例';
  assert.equal(f.adapter.pageInfo().create,undefined);
});
