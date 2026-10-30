// 仅用于独立 Codex profile 的接口加载验收，不触发业务操作。
import {findCodexModule,codexModuleStyles} from '../packages/codex-adapter/src/renderer/modules.mjs';
import {loadComposerExpandControls} from '../features/composer-expand/src/native.mjs';
import {loadQuickChatSidebarIcon} from '../features/quick-chat/src/adapters/codex/sidebar.mjs';
import {loadFileNavigationModules} from '../features/file-navigation/src/adapters/codex/modules.mjs';
import {loadInlineFileNavigationModules} from '../features/file-navigation/src/adapters/codex/inline-modules.mjs';
import {loadNativeMarkdownToc} from '../packages/codex-adapter/src/markdown/toc-native.mjs';
import {markdownExportAlias,loadNativeMarkdownTableActions} from '../packages/codex-adapter/src/markdown/block-actions.mjs';
import {loadNativeMarkdownRenderer} from '../packages/codex-adapter/src/markdown/markdown-native.mjs';
import {loadNativeMarkdownLinks} from '../features/markdown-reading/src/adapters/codex/links.mjs';
import {loadNativeMarkdownRichText} from '../features/markdown-reading/src/adapters/codex/rich-text.mjs';
import {loadNativeMermaidActions} from '../features/mermaid-diagrams/src/adapters/codex/native.mjs';
import {saveQvDiagram} from '../features/mermaid-diagrams/src/mermaid/export.mjs';
import {createNativeImageModules,discoverImageCanvasComponents,discoverImageActionBinding,discoverFilePreviewComposerBindings} from '../features/images/src/adapters/codex/native-image-modules.mjs';
const port=Number(process.env.MCX_PROBE_PORT??9233);
if(!Number.isInteger(port)||port<=0||port>65535||port===9231)throw new Error('Use an isolated Codex CDP port (default 9233), never the daily 9231 port.');
const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();const target=targets.find(t=>t.url==='app://-/index.html');
if(!target)throw new Error('No native Codex index target found on the isolated port.');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
const run=async()=>{
 const controller=new AbortController(),results={};const timer=setTimeout(()=>controller.abort(),15000);
 const probe=async(name,fn)=>{try{const value=await fn();results[name]={available:true,keys:Object.keys(value??{})};return value;}catch(e){results[name]={available:false,reason:String(e.message).slice(0,100)};}};
 await Promise.all([
  probe('composer-expand',()=>loadComposerExpandControls(controller.signal)),
  probe('quick-chat-icon',()=>loadQuickChatSidebarIcon(controller.signal)),
  probe('file-navigation',()=>loadFileNavigationModules()),
  probe('markdown-links',()=>loadNativeMarkdownLinks()),
  (async()=>{const toc=await probe('markdown-toc',()=>loadNativeMarkdownToc());if(!toc)return;const actions=await probe('markdown-actions',()=>loadNativeMarkdownTableActions(toc));if(!actions)return;await probe('markdown-rich-text',()=>loadNativeMarkdownRichText(actions));await probe('mermaid-actions',()=>loadNativeMermaidActions(actions));})(),
  (async()=>{const modules=createNativeImageModules();await probe('image-navigation',()=>modules.navigation());await probe('image-gallery',()=>modules.gallery());await probe('image-canvas',()=>modules.canvas());})(),
 ]);
 controller.abort();clearTimeout(timer);return results;
};
const functions=[findCodexModule,codexModuleStyles,loadComposerExpandControls,loadQuickChatSidebarIcon,loadFileNavigationModules,loadInlineFileNavigationModules,loadNativeMarkdownToc,markdownExportAlias,loadNativeMarkdownTableActions,loadNativeMarkdownRenderer,loadNativeMarkdownLinks,loadNativeMarkdownRichText,loadNativeMermaidActions,saveQvDiagram,createNativeImageModules,discoverImageCanvasComponents,discoverImageActionBinding,discoverFilePreviewComposerBindings];
const expression=`(async()=>{${functions.map(fn=>`const ${fn.name}=${fn};`).join('\n')}return (${run})();})()`;
const watchdog=setTimeout(()=>{console.error('Native capability probe timed out');ws.close();process.exitCode=1;},30000);
ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));
ws.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.id!==1)return;clearTimeout(watchdog);const result=v.result?.result?.value;console.log(JSON.stringify(result??v));if(!result||Object.values(result).some(value=>value.available===false))process.exitCode=1;ws.close();});
