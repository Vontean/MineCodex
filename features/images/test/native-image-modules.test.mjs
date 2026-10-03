import assert from "node:assert/strict";
import test from "node:test";
import {createNativeImageModules,discoverFilePreviewComposerBindings} from "../src/adapters/codex/native-image-modules.mjs";

// 26.930.21537 文件预览调用关系的最小样例，省略 React memo 缓存。
const preview = 'function scope(e){let{draftId:i,imageDataUrl:a}=e,g=kr(),_=ke,v=ke,S=P,C=route,b=hn,x=tn(e,r==null?i:i??r.id);return jsx)(_,{scope:b,value:x,children:jsx)(v,{scope:S,value:C,composerController:g})})}function home(e){let h={homeComposerController:n,homeComposerMode:p};let g=Qn(h),_=g?.composerProps;}function composer(e){return jsx)(rr,{placement:f,children:jsx)($n,{...r,className:`mx-auto w-full max-w-2xl px-toolbar`,composerLayoutMode:`auto-single-line`,lockedLayout:`single-line`})})}function local(e){let nav=Te();return jsx)(Yn,{...surface,aboveComposerContent:warning,composerModeAvailability:tr,prepareLocalConversationAttachments:async e=>{const file=await oe(scope,host).createFileAttachment({contents:bytes});signal.aborted&&(Vt(scope,host,file.path));nav(rt(id),{state:state});}})}';

test("file preview roles follow call semantics after every imported alias is renamed",()=>{
  const expected={useComposerController:"kr",useHomeComposer:"Qn",Composer:"$n",ComposerSurface:"rr",ScopeProvider:"ke",composerScope:"hn",createComposerValue:"tn",composerRouteScope:"P",FileComposer:"Yn",fileComposerAvailability:"tr",localAttachmentService:"oe",deleteLocalAttachment:"Vt",useFileNavigate:"Te",localThreadRoute:"rt"};
  assert.deepEqual(discoverFilePreviewComposerBindings(preview),expected);
  const aliases=new Map(Object.values(expected).map((name,index)=>[name,`renamed$${index}`]));
  const renamed=preview.replace(/[\w$]+/g,name=>aliases.get(name)??name);
  assert.deepEqual(discoverFilePreviewComposerBindings(renamed),Object.fromEntries(Object.entries(expected).map(([role,name])=>[role,aliases.get(name)])));
  assert.throws(()=>discoverFilePreviewComposerBindings(preview.replace('homeComposerController:','changedController:')),/contract changed/);
  assert.throws(()=>discoverFilePreviewComposerBindings(preview.replace('scope:S','changedScope:S')),/scopes changed/);
});

test("missing editor assets fail only canvas discovery; navigation remains available and retries are isolated",async context=>{
  const initial="file:///assets/app-initial-a.js",main="file:///assets/app-main-a.js",masonry="file:///assets/library-masonry-a.js";
  globalThis.document={querySelectorAll:()=>[{src:initial},{src:main}]};
  context.after(()=>delete globalThis.document);
  const sources=new Map([
    [initial,'"./library-masonry-a.js"'],
    [main,'import{root as init}from"./factories.js";renderer=init();(0,renderer.createRoot)'],
    [masonry,'import{react as init}from"./factories.js";owner=init();owner.useRef'],
  ]);
  const React={createElement(){}},ReactDOM={createRoot(){}};
  let reads=0;
  const modules=createNativeImageModules({read:async url=>{reads++;return sources.get(url);},load:async url=>url.endsWith('factories.js')?{react:()=>React,root:()=>ReactDOM}:{}});
  const navigation=await modules.navigation();
  assert.equal(navigation.React,React);assert.equal(navigation.ReactDOM,ReactDOM);
  await assert.rejects(modules.canvas(),/image-side-panel/);
  const previous=reads;
  assert.deepEqual(await modules.navigation(),navigation);assert.equal(reads,previous);
  await assert.rejects(modules.canvas(),/image-side-panel/);
});
