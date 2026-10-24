import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {composerCanExpand,installComposerExpand} from '../src/install.mjs';
import {createComposerExpandAdapter,loadComposerExpandControls} from '../src/native.mjs';

function node(){return {attrs:{},children:[],isConnected:true,setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k]??null;},removeAttribute(k){delete this.attrs[k];},hasAttribute(k){return k in this.attrs;},append(n){n.parent=this;this.children.push(n);},remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}};}

test('native long-draft criteria include multiline and wrapped text, but exclude short single paragraphs',()=>{
  const context={getComputedStyle:()=>({lineHeight:'20px'})};
  const can=vm.runInNewContext(`(${composerCanExpand})`,context);
  let text='short',childCount=1,height=80;
  const c={view:{state:{get doc(){return {childCount};}}},getText:()=>text},editor={getBoundingClientRect:()=>({height})};
  assert.equal(can(c,editor),false);height=100;assert.equal(can(c,editor),true);
  height=40;text='a\nb';assert.equal(can(c,editor),true);text='';childCount=2;assert.equal(can(c,editor),true);
});

test('Chat is left native; task composers are excluded in floating, hidden and panel surfaces',t=>{
  const previous=globalThis.document;t.after(()=>{globalThis.document=previous;});
  let task=true,work=false,excluded=false,visible=true;
  const root={hasAttribute:()=>task,getAttribute:()=>'thread'},body={},controller={view:{},getEnterBehavior(){},setEnterBehavior(){}};
  const editable={isConnected:true,checkVisibility:()=>visible,closest:selector=>selector.startsWith('[data-codex')?root:selector==='[data-composer-body]'?body:excluded?{}:null};controller.view.dom=editable;
  globalThis.document={querySelectorAll:()=>[editable]};
  const adapter=createComposerExpandAdapter({props:(_,predicate)=>[{isWorkConversation:work},{composerController:controller}].find(predicate)});
  assert.equal(adapter.all().length,1);task=false;assert.equal(adapter.all().length,0);
  work=true;assert.equal(adapter.all().length,1);excluded=true;assert.equal(adapter.all().length,0);
  excluded=false;visible=false;assert.equal(adapter.all().length,0);
});

test('toggle preserves editor identity and restores Enter on short draft, navigation and double cleanup',async()=>{
  const body=node(),head=node(),editable={getBoundingClientRect:()=>({height:60})};body.attrs['data-composer-layout']='multiline';
  let text='long\ndraft',enter='cmdIfMultiline',documentListener,toggle,unsubscribed=0,unmounted=0,resized=0,changed;
  const doc={childCount:2},selection={},state={doc,selection,tr:{scrollIntoView(){return this;}}};
  const controller={view:{state,dispatch(){}},getText:()=>text,getEnterBehavior:()=>enter,setEnterBehavior:v=>{enter=v;},focus(){}};
  const home={layout:node(),hero:node(),slot:node(),titleSpacer:node()};
  const bottomHome=node();
  const scope={body,editable,controller,root:body,home,bottomHome};let scopes=[scope];
  const context={document:{head,body:node(),documentElement:{lang:'zh-CN'},createElement:node},getComputedStyle:()=>({lineHeight:'20px'}),ResizeObserver:class{observe(){}disconnect(){resized++;}},MutationObserver:class{constructor(fn){changed=fn;}observe(){}disconnect(){}},queueMicrotask:fn=>fn(),createComposerExpandAdapter:()=>({all:()=>scopes,read:()=>scopes[0]}),composerCanExpand};
  context.composerCanExpand=vm.runInNewContext(`(${composerCanExpand})`,context);
  const install=vm.runInNewContext(`(${installComposerExpand})`,context),abort=new AbortController();
  const controls={mount:(_,fn)=>{toggle=fn;return {render(){},dispose(){unmounted++;}};},subscribe:(_,fn)=>{documentListener=fn;return()=>{unsubscribed++;};}};
  const dispose=await install(abort.signal,{codex:{}},async()=>controls);
  assert.equal(body.children.length,1);assert.equal(home.layout.hasAttribute('data-mcx-composer-home-balanced'),true);assert.equal(bottomHome.hasAttribute('data-mcx-composer-home-bottom'),true);assert.equal(home.titleSpacer.hasAttribute('data-mcx-composer-home-title-spacer'),true);toggle();assert.equal(enter,'cmdAlways');
  assert.equal(controller.view.state.doc,doc);assert.equal(controller.view.state.selection,selection);
  text='short';doc.childCount=1;documentListener();assert.equal(body.children.length,0);assert.equal(home.layout.hasAttribute('data-mcx-composer-home-balanced'),false);assert.equal(bottomHome.hasAttribute('data-mcx-composer-home-bottom'),false);assert.equal(enter,'cmdIfMultiline');
  text='long\ndraft';documentListener();toggle();scopes=[];changed([{target:{closest:selector=>selector.startsWith('[data-codex')?body:null},type:'childList'}]);assert.equal(enter,'cmdIfMultiline');assert.equal(unmounted,1);assert.equal(home.titleSpacer.hasAttribute('data-mcx-composer-home-title-spacer'),false);assert.equal(unsubscribed,1);assert.equal(resized,1);
  abort.abort();dispose();assert.equal(head.children.length,0);assert.equal(unmounted,1);
});

test('loader follows native expand Button, paired icons and transaction observer exports',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'mcx-expand-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const url=name=>pathToFileURL(path.join(dir,name)).href;
  const files={
    'runtime.mjs':`export function react(){return {createElement:(type,props)=>({type,props})}};export function dom(){return {createRoot:n=>({render:v=>{n.rendered=v},unmount:()=>{n.unmounted=true}})}};export const Button='native-button';let Collapse,Expand;const once=fn=>fn;function init(){return(init=once((()=>{Collapse='native-collapse',Expand='native-expand'})))()}export{Collapse as C,Expand as E,init as boot};`,
    'app-initial-fixture.js':`import{react as factory}from'./runtime.mjs';const R=factory();/*R.useRef*/const file='./app-primary-fixture.js';function watcher(e,t){let{eventTarget:n}=e;return n(t)};export{watcher as observed};`,
    'app-main-fixture.js':`import{dom as factory}from'./runtime.mjs';const D=factory();/*(0,D.createRoot)*/`,
    'app-primary-fixture.js':`import{Button as B,C as C,E as E}from'./runtime.mjs';function Layout(){return {className:"has-[[data-composer-expand-toggle]]:flex"}}var layoutEnd;function Control(){return (0,R.jsx)(Tooltip,{children:(0,R.jsx)(B,{"aria-label":label,"data-composer-expand-toggle":"",children:expanded?(0,R.jsx)(C,{}):(0,R.jsx)(E,{})})})}var end;`,
  };
  for(const [name,value]of Object.entries(files))await writeFile(path.join(dir,name),value);
  const previous=globalThis.document;t.after(()=>{globalThis.document=previous;});
  const nodes=[{src:url('app-initial-fixture.js')}];
  let onModules,disconnected=0;
  const previousObserver=globalThis.MutationObserver;
  t.after(()=>{globalThis.MutationObserver=previousObserver;});
  globalThis.MutationObserver=class{constructor(callback){onModules=callback;}observe(){}disconnect(){disconnected++;}};
  globalThis.document={documentElement:{},querySelectorAll:()=>nodes};
  t.mock.method(globalThis,'fetch',async resource=>({ok:true,text:()=>readFile(fileURLToPath(resource),'utf8')}));
  const pending=loadComposerExpandControls(new AbortController().signal);
  nodes.push({src:url('app-main-fixture.js')});
  onModules?.();
  const native=await pending,container={};
  assert.equal(disconnected,1);
  const control=native.mount(container,()=>{});control.render(false,'Expand');
  assert.equal(container.rendered.type,'native-button');assert.equal(container.rendered.props.children.type,'native-expand');assert.equal(container.rendered.props.color,'ghostSecondary');
  control.render(true,'Collapse');assert.equal(container.rendered.props.children.type,'native-collapse');assert.equal(container.rendered.props['data-expanded-composer'],'');
  let notified=0;native.subscribe({eventTarget:fn=>{fn(false);fn(true);return()=>{};}},()=>notified++);assert.equal(notified,1);
  control.dispose();assert.equal(container.unmounted,true);
  await writeFile(path.join(dir,'app-primary-fixture.js'),'export const changed=true;');
  await assert.rejects(loadComposerExpandControls(new AbortController().signal),/binding-unavailable/);
});

test('aborting module readiness releases the observer without loading controls',async t=>{
  const previousDocument=globalThis.document,previousObserver=globalThis.MutationObserver;
  t.after(()=>{globalThis.document=previousDocument;globalThis.MutationObserver=previousObserver;});
  let disconnected=0;
  globalThis.document={documentElement:{},querySelectorAll:()=>[]};
  globalThis.MutationObserver=class{observe(){}disconnect(){disconnected++;}};
  const abort=new AbortController();
  const pending=loadComposerExpandControls(abort.signal);
  abort.abort();
  await assert.rejects(pending,{name:'AbortError'});
  assert.equal(disconnected,1);
});

test('Work and Codex home select different anchors despite sharing the same composer root',()=>{
  let work=false;
  const layout={querySelector:()=>work?hero:null};
  const slot={parentElement:layout,classList:{contains:name=>name==='flex-col'||(!work&&name==='justify-end')},contains:()=>true};
  const hero={querySelector:()=>null,parentElement:{children:[]}};hero.parentElement.children=[hero,slot];
  const root={parentElement:slot,hasAttribute:()=>true,getAttribute:()=> 'home',closest:()=>layout};
  const editable={isConnected:true,checkVisibility:()=>true,closest:selector=>selector.startsWith('[data-codex')?root:selector==='[data-composer-body]'?{}:null};
  const controller={view:{dom:editable},getEnterBehavior(){},setEnterBehavior(){}};
  const adapter=createComposerExpandAdapter({props:(_,predicate)=>[{composerController:controller}].find(predicate)});
  const codex=adapter.read(editable);assert.equal(codex.bottomHome,layout);assert.equal(codex.home,null);
  work=true;const chatgptWork=adapter.read(editable);assert.equal(chatgptWork.bottomHome,null);assert.equal(chatgptWork.home.layout,layout);
});
