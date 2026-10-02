import assert from "node:assert/strict";
import test from "node:test";
import {createNativeImageSource} from "../src/adapters/codex/native-image-source.mjs";
import {createCloudImageActions} from "../src/frontend/cloud-image-actions.mjs";

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

async function fixture(context,{fileNode=async()=>({id:"libfile_image"}),favoriteStatus=async()=>({items:[{target_ref:{library_file_id:"libfile_image"},availability:"available"}]}),hide=async()=>({hiddenIds:["image"]}),canvas=async()=>{throw Error("editor unavailable");}}={}) {
  const state={renders:[],writes:[],effects:[],toasts:[],disposed:false,account:"account"};
  globalThis.document={addEventListener(){},removeEventListener(){},querySelector(){return null;}};
  context.after(()=>delete globalThis.document);
  const h=(type,props,...children)=>({type,props:{...props,...(children.length?{children}: {})}});
  const native={
    React:{Fragment:"Fragment",createElement:h,useState:initial=>[typeof initial==="function"?initial():initial,value=>state.writes.push(value)],useRef:initial=>({current:initial}),useEffect:effect=>state.effects.push(effect())},
    ReactDOM:{createRoot:()=>({render:tree=>{assert.equal(state.disposed,false,"render after root.unmount");state.renders.push(tree);},unmount:()=>{state.disposed=true;for(const effect of state.effects)effect?.();}})},
    accountAtom:"account",userAtom:"user",toastAtom:"toast",nativeSelectedIds:"selected",
    Masonry:"Masonry",Skeleton:"Skeleton",Card:"Card",Button:"Button",Dropdown:"Dropdown",Menu:{Item:"Item"},Checkbox:"Checkbox",
    Dialog:"Dialog",DialogContent:"DialogContent",ConfirmationContent:"Confirmation",MoveDialog:"MoveDialog",
    imageMenu:()=>[],useImage:()=>({previewSrc:"preview"}),favoriteIcon:()=>null,
  };
  const scope={value:{basePath:"/space",accountId:"account",userId:"user",routeKind:"home"},query:{getOrFetch(){}},set(){},get:atom=>atom==="account"?state.account:atom==="user"?"user":{info:text=>state.toasts.push(text),danger:text=>state.toasts.push(text)}};
  const intl={formatMessage:message=>message.defaultMessage};
  const codex={currentFiber:()=>({memoizedProps:{scope},return:{tag:10,type:"IntlProvider",memoizedProps:{value:intl}}})};
  const adapter=createNativeImageSource(codex,{
    modules:{gallery:async()=>native,canvas},createCloudImageActions,
    libraryApi:{fileNode,favoriteStatus},
    requestHostAction:async(_,payload)=>payload.operation==="hide"?hide():{libraryFileId:"libfile_image"},
  });
  const view=await adapter.mount({}, {}, {onOpen:(image,open)=>open(image),onPrompt(){},onRetry:error=>{throw error;}});
  view.render({images:[{id:"image",name:"image.png",sourcePath:"/image.png",width:100,height:100}],loading:false});
  const tree=state.renders.at(-1).props.children[0];
  // 原生 provider → fragment → 业务内容 → Masonry → 未执行的 Card 组件。
  const content=tree.props.children[0].props.children;
  const cardElement=content.props.items[0].content;
  const card=cardElement.type(cardElement.props);
  const items=card.props.actions.props.children;
  return {state,view,card,menu:text=>items.find(item=>item.props.children===text)};
}

test("folder node result is ignored after the gallery unmounts",async context=>{
  const node=deferred();let requested=false;
  const f=await fixture(context,{fileNode:()=>{requested=true;return node.promise;}});
  f.menu("Add to folder").props.onSelect();await settle();assert.equal(requested,true);
  f.view.dispose();const count=f.state.renders.length;
  node.resolve({id:"libfile_image"});await settle();
  assert.equal(f.state.renders.length,count);assert.deepEqual(f.state.toasts,[]);
});

test("folder result cannot open a dialog under a different account",async context=>{
  const node=deferred();
  const f=await fixture(context,{fileNode:()=>node.promise});
  f.menu("Add to folder").props.onSelect();await settle();
  f.state.account="other";const count=f.state.renders.length;
  node.resolve({id:"libfile_image"});await settle();
  assert.equal(f.state.renders.length,count);assert.deepEqual(f.state.toasts,[]);f.view.dispose();
});

test("late hide failure does not rebuild a confirmation on a disposed root",async context=>{
  const hide=deferred();const f=await fixture(context,{hide:()=>hide.promise});
  f.menu("Delete").props.onSelect();
  const fragment=f.state.renders.at(-1).props.children[0];
  const dialog=fragment.props.children[2];
  dialog.props.children[0].props.onSubmit({preventDefault(){}});
  f.view.dispose();const count=f.state.renders.length;
  hide.reject(Error("write failed"));await settle();
  assert.equal(f.state.renders.length,count);assert.deepEqual(f.state.toasts,[]);
});

test("canvas discovery failure reports an action error while the gallery stays mounted",async context=>{
  const f=await fixture(context);f.card.props.onOpen();await settle();
  assert.equal(f.state.disposed,false);
  assert.deepEqual(f.state.toasts,["Couldn’t complete the Library action. Please try again."]);
  assert.ok(f.state.renders.length);f.view.dispose();
});

test("pending canvas cannot open after switching image sources",async context=>{
  const canvas=deferred();const f=await fixture(context,{canvas:()=>canvas.promise});
  f.card.props.onOpen();await settle();
  f.view.clearSelection();const count=f.state.renders.length;
  canvas.resolve({});await settle();
  assert.equal(f.state.renders.length,count);assert.deepEqual(f.state.toasts,[]);f.view.dispose();
});

test("favorite status arriving after menu close and unmount cannot update the old card",async context=>{
  const result=deferred();const f=await fixture(context,{favoriteStatus:()=>result.promise});
  const dropdown=f.card.props.actions;
  const task=dropdown.props.onOpenChange(true);await settle();
  await dropdown.props.onOpenChange(false);f.view.dispose();
  result.resolve({items:[{target_ref:{library_file_id:"libfile_image"},availability:"available",favorite:{favorite_id:"favorite"}}]});
  await task;assert.deepEqual(f.state.writes,[]);
});
