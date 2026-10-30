import { findCodexModule } from '../../../packages/codex-adapter/src/renderer/modules.mjs';
export async function loadComposerExpandControls(signal) {
  signal.throwIfAborted();
  const initialUrl=await findCodexModule('app-initial',{signal,waitForEntry:true});
  const mainUrl=await findCodexModule('app-main',{signal,waitForEntry:true});
  if (!initialUrl || !mainUrl) throw new Error('composer-expand-modules-unavailable');
  const read = async url => { const response=await fetch(url,{signal}); if(!response.ok) throw new Error('composer-expand-source-unavailable'); return response.text(); };
  const [initialSource,mainSource] = await Promise.all([read(initialUrl),read(mainUrl)]);
  const file = initialSource.match(/["'`]\.\/(app-primary-[\w-]+\.js)["'`]/)?.[1];
  const primaryUrl = file ? new URL(file,initialUrl).href : await findCodexModule('app-primary',{read,signal});
  if (!primaryUrl) throw new Error('composer-expand-primary-unavailable');
  const source = await read(primaryUrl);
  async function binding(source,url,local) {
    if (!local) throw new Error('composer-expand-binding-unavailable');
    const escaped = local.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const alias = source.slice(source.lastIndexOf('export{')).match(new RegExp(`(?:\\{|,)${escaped} as ([\\w$]+)(?:,|\\})`))?.[1];
    if (alias) {
      const module=await import(url);
      if (module[alias]===undefined) {
        // 图标导出可能仍在原生 once 初始化器中，先初始化再读取实时导出。
        const assignment=source.search(new RegExp(`(?:[,;{])${escaped}=`));
        const initializer=assignment<0?null:source.slice(source.lastIndexOf('function ',assignment),assignment+1)
          .match(/^function ([\w$]+)\(\)\{return\(\1=[\w$]+\(\(\(\)=>\{/);
        if (!initializer) throw new Error('composer-expand-binding-unavailable');
        const initialize=await binding(source,url,initializer[1]);
        if (typeof initialize!=='function') throw new Error('composer-expand-binding-unavailable');
        initialize();
      }
      if (module[alias]===undefined) throw new Error('composer-expand-binding-unavailable');
      return module[alias];
    }
    for (const match of source.matchAll(/import\{([^}]+)\}from["'`]([^"'`]+)["'`]/g)) {
      for (const entry of match[1].split(',')) {
        const parts=entry.trim().split(/\s+as\s+/);
        if (parts.at(-1)===local) {
          const dependencyUrl=new URL(match[2],url).href,module=await import(dependencyUrl);
          if (module[parts[0]]!==undefined) return module[parts[0]];
          const dependency=await read(dependencyUrl);
          const exported=parts[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
          const name=dependency.slice(dependency.lastIndexOf('export{')).match(new RegExp(`(?:\\{|,)([\\w$]+) as ${exported}(?:,|\\})`))?.[1];
          return binding(dependency,dependencyUrl,name);
        }
      }
    }
    throw new Error('composer-expand-binding-unavailable');
  }
  // 语义定位原生展开按钮，导入它实际使用的控件和成对图标。
  // 只匹配控件属性，避免先命中布局 className 中的同名 CSS 选择器。
  const marker=source.search(/["'`]data-composer-expand-toggle["'`]:/);
  const start=marker<0?-1:source.lastIndexOf('function ',marker);
  const control=source.slice(start,source.indexOf('var ',start));
  const button=control.match(/jsx\)\(([\w$]+),\{"aria-label"/ )?.[1];
  const icons=control.match(/children:[\w$]+\?\(0,[\w$]+\.jsx\)\(([\w$]+),\{\}\):\(0,[\w$]+\.jsx\)\(([\w$]+),\{\}\)/);
  const reactOwner=initialSource.match(/([\w$]+)\.useRef\b/)?.[1];
  const reactInit=reactOwner&&initialSource.match(new RegExp(`${reactOwner}=([\\w$]+)\\(\\)`))?.[1];
  const rootOwner=mainSource.match(/\(0,([\w$]+)\.createRoot\)/)?.[1];
  const rootInit=rootOwner&&mainSource.match(new RegExp(`${rootOwner}=([\\w$]+)\\(\\)`))?.[1];
  const transactionObserver=initialSource.match(/function ([\w$]+)\([^)]*\)\{let\{eventTarget:/)?.[1];
  const [reactFactory,rootFactory,Button,Collapse,Expand,subscribe]=await Promise.all([
    binding(initialSource,initialUrl,reactInit),binding(mainSource,mainUrl,rootInit),
    binding(source,primaryUrl,button),binding(source,primaryUrl,icons?.[1]),binding(source,primaryUrl,icons?.[2]),
    binding(initialSource,initialUrl,transactionObserver),
  ]);
  const React=reactFactory(),ReactDOM=rootFactory();
  return {subscribe:(view,listener)=>subscribe(view,changed=>{if(changed)listener();}),mount(container,onToggle) {
    const root=ReactDOM.createRoot(container);
    let previous;
    return {render(expanded,label) {
      const key=JSON.stringify([expanded,label]);if(key===previous)return;previous=key;
      root.render(React.createElement(Button,{'aria-label':label,'aria-pressed':expanded,
        color:'ghostSecondary',size:'iconCircle','data-composer-expand-toggle':'',
        'data-expanded-composer':expanded?'':undefined,'data-minecodex-tooltip':label,
        onPointerDown:event=>event.preventDefault(),onClick:onToggle,
        children:React.createElement(expanded?Collapse:Expand,{})}));
    },dispose:()=>root.unmount()};
  }};
}

export function createComposerExpandAdapter(codex) {
  function read(editable) {
    const root=editable.closest('[data-codex-composer-root],[data-chatgpt-composer]');
    const body=editable.closest('[data-composer-body]');
    if (!root||!body||!editable.isConnected||!editable.checkVisibility({visibilityProperty:true})
      ||editable.closest('[hidden],[inert],[aria-hidden="true"],[data-floating-chat-surface],[data-right-panel-composer-overlay-content]')) return null;
    const work=codex.props(editable,p=>typeof p.isWorkConversation==='boolean');
    if (!root.hasAttribute('data-codex-composer-root')&&!work?.isWorkConversation) return null;
    const controller=codex.props(editable,p=>p.composerController?.view?.dom===editable)?.composerController;
    if (!controller?.getEnterBehavior||!controller.setEnterBehavior) return null;
    const layout=root.getAttribute('data-composer-placement')==='home'
      ?root.closest('[class~="group/home-composer-layout"]'):null;
    const hero=layout?.querySelector('.home-composer-anchor');
    const titleSpacer=hero?.querySelector('[class~="min-h-28"]');
    const slot=hero&&[...hero.parentElement.children].find(node=>node!==hero&&node.contains(root));
    let bottomSlot=null;
    for(let node=root.parentElement;layout&&node&&node!==layout;node=node.parentElement){
      if(node.classList.contains('flex-col')&&node.classList.contains('justify-end')){bottomSlot=node;break;}
    }
    return {root,body,editable,controller,
      home:layout&&hero&&slot?{layout,hero,slot,titleSpacer}:null,
      bottomHome:layout&&bottomSlot?layout:null};
  }
  return {read,all:()=>[...document.querySelectorAll('[contenteditable="true"][data-composer-markdown]')].map(read).filter(Boolean)};
}
