export async function loadComposerExpandControls(signal) {
  const urls = [...document.querySelectorAll('link[rel="modulepreload"],script[src]')].map(node => node.href || node.src);
  const initialUrl = urls.find(url => /\/app-initial-[^/]+\.js/.test(url));
  const mainUrl = urls.find(url => /\/app-main-[^/]+\.js/.test(url));
  if (!initialUrl || !mainUrl) throw new Error('composer-expand-modules-unavailable');
  const read = async url => { const response=await fetch(url,{signal}); if(!response.ok) throw new Error('composer-expand-source-unavailable'); return response.text(); };
  const [initialSource,mainSource] = await Promise.all([read(initialUrl),read(mainUrl)]);
  const file = initialSource.match(/["'`]\.\/(app-primary-[\w-]+\.js)["'`]/)?.[1];
  if (!file) throw new Error('composer-expand-primary-unavailable');
  const primaryUrl = new URL(file,initialUrl).href;
  const source = await read(primaryUrl);
  async function binding(source,url,local) {
    if (!local) throw new Error('composer-expand-binding-unavailable');
    const escaped = local.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const alias = source.slice(source.lastIndexOf('export{')).match(new RegExp(`(?:\\{|,)${escaped} as ([\\w$]+)(?:,|\\})`))?.[1];
    if (alias) return (await import(url))[alias];
    for (const match of source.matchAll(/import\{([^}]+)\}from["'`]([^"'`]+)["'`]/g)) {
      for (const entry of match[1].split(',')) {
        const parts=entry.trim().split(/\s+as\s+/);
        if (parts.at(-1)===local) return (await import(new URL(match[2],url).href))[parts[0]];
      }
    }
    throw new Error('composer-expand-binding-unavailable');
  }
  // 语义定位原生展开按钮，导入它实际使用的控件和成对图标。
  const start=source.indexOf('function ',source.lastIndexOf('function ',source.indexOf('data-composer-expand-toggle')));
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
