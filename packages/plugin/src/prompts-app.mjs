import { App } from '@modelcontextprotocol/ext-apps';
import { installPrompts } from 'minecodex:prompts';
import icons from '../../../features/notes/src/frontend/icons.json';
import previews from '../../../features/notes/assets/prompt-previews.json';
import styles from '../../../features/notes/src/frontend/styles.css' with {type:'text'};
import { applyMcpTheme } from '../../ui/src/native/mcp-theme.mjs';
import { installLayers } from '../../ui/src/foundation/layers.mjs';
import { installSurfaces } from '../../ui/src/foundation/surfaces.mjs';
import { installDialog } from '../../ui/src/components/dialog.mjs';
import { installButton } from '../../ui/src/components/button.mjs';
import { installFeatureTooltips } from '../../ui/src/components/tooltip.mjs';

const app = new App({name:'Prompt',version:__MCX_RELEASE_VERSION__});
app.ontoolresult = () => {};
await app.connect();
applyMcpTheme(app.getHostContext());
app.addEventListener('hostcontextchanged', applyMcpTheme);
const controller = new AbortController();
const signal = controller.signal;
const ui = {};
for (const installer of [installLayers,installSurfaces,installDialog,installButton,installFeatureTooltips]) Object.assign(ui,installer(signal,ui));
ui.page = node => {ui.surface(node,'page'); return ui.layer(node,'page');};
ui.releasePage = () => {};
const cleanup = installPrompts(signal, {
  management:true, ui, resources:{icons,previews,styles},
  insertPrompt: promptId => new Promise((resolve,reject) => {
    const channel = new MessageChannel();
    let timer;
    const finish = error => {
      clearTimeout(timer);channel.port1.close();signal.removeEventListener('abort',abort);
      error ? reject(error) : resolve();
    };
    const abort = () => finish(new Error('Prompt page closed'));
    signal.addEventListener('abort',abort,{once:true});
    timer = setTimeout(() => finish(new Error('No available input in the focused window')),4500);
    channel.port1.onmessage = ({data}) => finish(data.ok ? null : new Error(data.error));
    window.top.postMessage({type:'minecodex:insert-prompt',promptId,expiresAt:Date.now()+4000},'*',[channel.port2]);
  }),
  requestHostAction: async (_,args) => {
    const result = await app.callServerTool({name:args.method && args.method !== 'GET' ? 'minecodex_prompts_write' : 'minecodex_prompts_read',arguments:args});
    if (result.isError) throw new Error(result.content?.find(item=>item.type === 'text')?.text ?? 'Prompts request failed');
    return result.structuredContent.result;
  },
});
app.onteardown = async () => {controller.abort();cleanup();return {};};
