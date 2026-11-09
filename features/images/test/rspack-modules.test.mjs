import test from 'node:test';
import assert from 'node:assert/strict';
import {declaresRspackExport, discoverRspackPreviewBindings} from '../src/adapters/codex/rspack-modules.mjs';

// 保留原生调用关系，省略 React memo 缓存；角色不随压缩变量和导出别名变化。
const source = `function scope(e){let {draftId:id,imageSrc:src}=e,ctrl=(0,controller.use)(),inner=provider.Scope,outer=provider.Scope,innerScope=composer.scope,outerScope=route.scope,value=(0,composer.create)(e,id),routeValue={};let content={composerController:ctrl};return (0,jsx.jsx)(inner,{scope:innerScope,value:value,children:(0,jsx.jsx)(outer,{scope:outerScope,value:routeValue,children:content})})}function home(e){let input={homeComposerController:e,homeComposerMode:"chat"};let home=(0,hook.use)(input),props=home?.composerProps}function composer(e){let content=(0,jsx.jsx)(input.Component,{...e,ref:ref,composerController:e,lockedLayout:"single-line"});return (0,jsx.jsx)(surface.Component,{placement:e,children:content})}function local(e){let navigate=(0,router.use)();let prepare=async()=>{let file=await (0,attachments.create)(scope,host).createFileAttachment({contents:bytes});(0,attachments.remove)(scope,host,file.path)};let callback=(id,state)=>{close(),navigate((0,router.path)(id),{state:state})};return (0,jsx.jsx)(local.Composer,{...e,aboveComposerContent:warning,composerModeAvailability:local.availability,prepareLocalConversationAttachments:prepare,onLocalConversationCreated:callback})}`;
const expected={useComposerController:'controller.use',useHomeComposer:'hook.use',Composer:'input.Component',ComposerSurface:'surface.Component',ScopeProvider:'provider.Scope',composerScope:'composer.scope',composerRouteScope:'route.scope',createComposerValue:'composer.create',FileComposer:'local.Composer',fileComposerAvailability:'local.availability',localAttachmentService:'attachments.create',deleteLocalAttachment:'attachments.remove',useFileNavigate:'router.use',localThreadRoute:'router.path'};

test('rspack file-preview roles follow the native provider and attachment call paths',()=>{
  assert.deepEqual(discoverRspackPreviewBindings(source),expected);
  const owners=[...new Set(Object.values(expected).map(value=>value.split('.')[0]))];
  const aliases=new Map(owners.map((owner,index)=>[owner,`alias$${index}`]));
  const renamed=source.replace(/[\w$]+/g,token=>aliases.get(token)??token);
  const renamedExpected=Object.fromEntries(Object.entries(expected).map(([role,reference])=>[role,reference.replace(/^[\w$]+/,owner=>aliases.get(owner))]));
  assert.deepEqual(discoverRspackPreviewBindings(renamed),renamedExpected);
});

test('missing navigation or incompatible provider identity cannot produce a partial canvas contract',()=>{
  assert.throws(()=>discoverRspackPreviewBindings(source.replace('navigate((0,router.path)(id),{state:state})','navigate(id)')),/navigation changed/);
  assert.throws(()=>discoverRspackPreviewBindings(source.replace('outer=provider.Scope','outer=other.Scope')),/scope providers changed/);
  assert.throws(()=>discoverRspackPreviewBindings(source.replace('prepareLocalConversationAttachments:','removed:')),/Composer contract changed/);
});

// 26.1029 用 getter 登记具名导出；26.1103 改为直接登记函数值，图片菜单与详情入口因此一度识别失败。
test('rspack export roles accept getter and direct function declarations but not consumers',()=>{
  const getter='function m(e,t,n){n.d(t,{x:()=>a,openImagePreview:()=>o});function o(){}}';
  const direct='function m(e,t,n){n.r(t);n.d(t,{},{getGeneratedImageContextMenuItems:function(e,{intl:i}){return[]}})}';
  const asyncDirect='function m(e,t,n){n.d(t,{},{uploadChatGptConversationFile:async function(e){}})}';
  assert.equal(declaresRspackExport(getter,'openImagePreview'),true);
  assert.equal(declaresRspackExport(direct,'getGeneratedImageContextMenuItems'),true);
  assert.equal(declaresRspackExport(asyncDirect,'uploadChatGptConversationFile'),true);
  // 消费方只引用或调用该导出，不能被识别为声明模块。
  const consumers=[
    'o=()=>(0,X.getGeneratedImageContextMenuItems)(h,{displaySrc:V})',
    'async()=>(await a.e(1).then(a.bind(a,"YeQK"))).getGeneratedImageContextMenuItems(f,{intl:g})',
    'n.d(t,{getImageContextMenuItems:()=>q})',
  ];
  for(const consumer of consumers) assert.equal(declaresRspackExport(consumer,'getGeneratedImageContextMenuItems'),false);
});
