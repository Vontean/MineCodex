import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverRspackPreviewBindings} from '../src/adapters/codex/rspack-modules.mjs';

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
