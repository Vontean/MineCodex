export function composerCanExpand(controller,editor) {
  const lineHeight=Number.parseFloat(getComputedStyle(editor).lineHeight);
  return controller.view.state.doc.childCount>1||controller.getText().includes('\n')
    ||(lineHeight>0&&editor.getBoundingClientRect().height>=lineHeight*5);
}

export async function installComposerExpand(signal,config,load=loadComposerExpandControls) {
  const native=createComposerExpandAdapter(config.codex);
  const mounts=new Map();
  let disposed=false;
  const controls=await load(signal);
  if(signal.aborted)return()=>{};
  const style=document.createElement('style');
  style.textContent=`
    [data-mcx-composer-expand-control]{position:absolute;inset-inline-end:calc(var(--spacing)*2.5);top:calc(var(--spacing)*2.5);z-index:20}
    [data-mcx-composer-home-balanced]:not(:has([data-expanded-composer])){justify-content:center}
    [data-mcx-composer-home-bottom]:has([data-expanded-composer]){justify-content:flex-end}
    [data-mcx-composer-home-balanced]:not(:has([data-expanded-composer])) [data-mcx-composer-home-hero]{flex:0 0 auto;min-block-size:0}
    [data-mcx-composer-home-balanced]:not(:has([data-expanded-composer])) [data-mcx-composer-home-slot]{flex:0 0 auto;position:static}
    [data-mcx-composer-home-balanced]:not(:has([data-expanded-composer])) [data-mcx-composer-home-title-spacer]{min-height:0}
  `;
  document.head.append(style);
  function mount(scope) {
    const {body,editable,controller,home,bottomHome}=scope;
    function balanceHome(value){
      if(bottomHome){
        if(value)bottomHome.setAttribute('data-mcx-composer-home-bottom','');
        else bottomHome.removeAttribute('data-mcx-composer-home-bottom');
      }
      if(!home)return;
      for(const [element,name]of [[home.layout,'balanced'],[home.hero,'hero'],[home.slot,'slot'],[home.titleSpacer,'title-spacer']]){
        if(!element)continue;
        const attribute=`data-mcx-composer-home-${name}`;
        if(value)element.setAttribute(attribute,'');else element.removeAttribute(attribute);
      }
    }
    let expanded=false,enterBehavior=null,visible=false;
    const node=document.createElement('span');
    node.setAttribute('data-mcx-composer-expand-control','');
    const control=controls.mount(node,toggle);
    function label(){return (document.documentElement.lang||navigator.language).startsWith('zh')?(expanded?'收起':'展开'):(expanded?'Collapse':'Expand');}
    function setExpanded(value) {
      if(expanded===value)return;
      expanded=value;
      if(value){enterBehavior=controller.getEnterBehavior();controller.setEnterBehavior('cmdAlways');}
      else {if(!controller.view.isDestroyed)controller.setEnterBehavior(enterBehavior);enterBehavior=null;}
      control.render(expanded,label());
    }
    function toggle(){setExpanded(!expanded);controller.focus();controller.view.dispatch(controller.view.state.tr.scrollIntoView());}
    function update(){
      if(controller.view.isDestroyed)return;
      const available=body.getAttribute('data-composer-layout')==='multiline'&&composerCanExpand(controller,editable);
      if(!available)setExpanded(false);
      if(visible!==available){visible=available;balanceHome(available);if(available)body.append(node);else node.remove();}
      if(available)control.render(expanded,label());
    }
    const resized=new ResizeObserver(update);
    resized.observe(editable);
    const unsubscribe=controls.subscribe(controller.view,update);
    update();
    return {...scope,update,dispose(){setExpanded(false);balanceHome(false);unsubscribe();resized.disconnect();control.dispose();node.remove();}};
  }
  function sync(){
    if(signal.aborted||disposed)return;
    const scopes=native.all(),active=new Map(scopes.map(s=>[s.editable,s]));
    for(const [editable,m] of mounts){
      const current=active.get(editable);
      if(!current||current.controller!==m.controller||current.body!==m.body||current.home?.layout!==m.home?.layout||current.bottomHome!==m.bottomHome){m.dispose();mounts.delete(editable);}
    }
    for(const scope of scopes){if(!mounts.has(scope.editable))mounts.set(scope.editable,mount(scope));else mounts.get(scope.editable).update();}
  }
  let scheduled=false;
  const observer=new MutationObserver(records=>{
    const selector='[data-codex-composer-root],[data-chatgpt-composer]';
    const relevant=records.some(record=>{
      const target=record.target;
      if(target.closest?.('[data-mcx-composer-expand-control],[contenteditable="true"]'))return false;
      if(target.closest?.(selector))return true;
      if(record.type==='attributes')return Boolean(target.querySelector?.(selector));
      return [...record.addedNodes??[],...record.removedNodes??[]].some(node=>node.matches?.(selector)||node.querySelector?.(selector));
    });
    if(scheduled||!relevant)return;
    scheduled=true;queueMicrotask(()=>{scheduled=false;sync();});
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-composer-layout','hidden','inert','aria-hidden','class','style']});
  sync();
  const unregister=config.registerSelfCheck?.(()=>({state:native.all().length?(mounts.size?'available':'unavailable'):'not-applicable',scopes:native.all().map(scope=>({name:'composer',element:scope.root}))}));
  function dispose(){if(disposed)return;disposed=true;observer.disconnect();for(const mount of mounts.values())mount.dispose();mounts.clear();style.remove();unregister?.();}
  signal.addEventListener('abort',dispose,{once:true});
  return dispose;
}
