// 原生组件、构建产物与 React 上下文只在此适配；不复制图库或编辑器。
export function createNativeImageSource(codex, { read = async url => (await fetch(url)).text(), load = url => import(url), requestHostAction, libraryApi, createCloudImageActions } = {}) {
  let connecting;
  const opened = new Map();

  function imported(source, local) {
    for (const match of source.matchAll(/import\{([^}]+)\}from["']([^"']+)["']/g)) {
      for (const binding of match[1].split(",")) {
        const parts = binding.trim().split(/\s+as\s+/);
        if (parts.at(-1) === local) return { name: parts[0], file: match[2] };
      }
    }
    throw new Error(`Native Images import contract changed: ${local}`);
  }

  async function connect() {
    if (!connecting) connecting = (async () => {
      const urls = [...document.querySelectorAll('link[rel="modulepreload"],script[src]')].map(node => node.href || node.src);
      const initialUrl = urls.find(url => /\/app-initial-[^/]+\.js/.test(url));
      const mainUrl = urls.find(url => /\/app-main-[^/]+\.js/.test(url));
      if (!initialUrl || !mainUrl) throw new Error("Native Images modules are unavailable");
      const [initialSource, mainSource] = await Promise.all([read(initialUrl), read(mainUrl)]);
      const asset = (name, references = initialSource) => {
        const file = references.match(new RegExp(`(?:["'./])(${name}-[\\w-]+\\.js)`))?.[1];
        if (!file) throw new Error(`Native Images capability is unavailable: ${name}`);
        return new URL(file, initialUrl).href;
      };
      const module = async (name,references) => {
        const url = asset(name,references);
        const [source, exports] = await Promise.all([read(url), load(url)]);
        // 调用产物公开的惰性初始化器，不扫描或执行任意导出函数。
        for (const value of Object.values(exports)) {
          if (typeof value === "function" && /^function ([\w$]+)\(\)\{return\(\1=/.test(String(value))) value();
        }
        return {url, source, exports};
      };
      const [masonry, layout, sourceImage, menu, selection, initial] = await Promise.all([
        module("library-masonry"), module("library-item-layout"), module("generated-image-source"),
        module("generated-image-context-menu"), module("library-selection-toolbar"), load(initialUrl),
      ]);
      const [moveDialog,dialogs] = await Promise.all([module("library-move-dialog",selection.source),module("library-item-dialogs",selection.source)]);
      const [canvas,canvasLayout,filePreview] = await Promise.all([
        module("image-side-panel"),module("preview-layout"),module("library-cloud-file-preview"),
      ]);
      const component = (exports, predicate, name) => {
        const matches = Object.values(exports).filter(value => typeof value === "function" && predicate(String(value)));
        if (matches.length !== 1) throw new Error(`Native Images contract changed: ${name}`);
        return matches[0];
      };
      const binding = async (source, url, local) => {
        if (!local) throw new Error("Native Images component contract changed");
        const importedBinding = imported(source, local);
        return (await load(new URL(importedBinding.file, url).href))[importedBinding.name];
      };
      const routerLocal = selection.source.match(/get\(([\w$]+)\)\.prepareNavigation\(/)?.[1];
      const routerAtom = await binding(selection.source, selection.url, routerLocal);
      const switchLocal = selection.source.match(/([\w$]+)\(e,i\);let _=t.length===1/)?.[1];
      const switchMode = await binding(selection.source, selection.url, switchLocal);
      const draftLocal = selection.source.match(/let u=([\w$]+)\(e,\[\]\);e.set/)?.[1];
      const createChatDraft = await binding(selection.source, selection.url, draftLocal);
      const rootOwner = mainSource.match(/\(0,([\w$]+)\.createRoot\)/)?.[1];
      const rootInit = rootOwner && mainSource.match(new RegExp(`${rootOwner}=([\\w$]+)\\(\\)`))?.[1];
      const reactOwner = masonry.source.match(/([\w$]+)\.useRef\b/)?.[1];
      const reactInit = reactOwner && masonry.source.match(new RegExp(`${reactOwner}=([\\w$]+)\\(\\)`))?.[1];
      const [reactFactory, rootFactory] = await Promise.all([
        binding(masonry.source, masonry.url, reactInit), binding(mainSource, mainUrl, rootInit),
      ]);
      const React = reactFactory(), ReactDOM = rootFactory();
      const portalOwner=canvas.source.match(/\(0,([\w$]+)\.createPortal\)/)?.[1];
      const portalInit=portalOwner&&canvas.source.match(new RegExp(`${portalOwner}=([\\w$]+)\\(\\)`))?.[1];
      const createPortal=(await binding(canvas.source,canvas.url,portalInit))().createPortal;
      const dropdownLocal = selection.source.match(/\(0,[\w$]+\.jsxs?\)\(([\w$]+),\{contentWidth:`menu`/)?.[1];
      const itemsLocal = selection.source.match(/\(0,[\w$]+\.jsxs?\)\(([\w$]+)\.Item,\{/)?.[1];
      const buttonLocal = selection.source.match(/\(0,[\w$]+\.jsx\)\(([\w$]+),\{ref:[^,]+,color:`mediaOverlay`/)?.[1];
      const iconLocal = selection.source.match(/color:`mediaOverlay`[^;]+?children:\(0,[\w$]+\.jsx\)\(([\w$]+),\{\}\)/)?.[1];
      const [Dropdown, Menu, Button, MoreIcon] = await Promise.all([dropdownLocal, itemsLocal, buttonLocal, iconLocal].map(local => binding(selection.source, selection.url, local)));
      const checkboxFunction = component(selection.exports,source=>/onCheckedChange:/.test(source)&&/viewMode:/.test(source),"selection checkbox");
      const checkboxLocal = String(checkboxFunction).match(/\(0,[\w$]+\.jsx\)\(([\w$]+),\{className:`cursor-interaction`,variant:/)?.[1];
      const Checkbox = await binding(selection.source,selection.url,checkboxLocal);
      const rangeSelection = component(selection.exports,source=>/^function [\w$]+\(\{orderedIds:/.test(source)&&/extendRange:/.test(source),"range selection");
      const selectionLocal = selection.source.match(/\.set\(([\w$]+),new Set\)/)?.[1];
      const selectionExport = selection.source.match(/export\{([^}]+)\}/)?.[1].split(",").map(value=>value.trim().split(/\s+as\s+/)).find(parts=>parts[0]===selectionLocal)?.at(-1);
      const nativeSelectedIds = selection.exports[selectionExport];
      if (!nativeSelectedIds) throw new Error("Native selection state contract changed");
      const clearPrefix = selection.source.slice(selection.source.indexOf("id:`libraryNext.selection.clear`"));
      const clearLocal = clearPrefix.match(/\(0,[\w$]+\.jsx\)\(([\w$]+),\{\}\)/)?.[1];
      const ClearIcon = await binding(selection.source,selection.url,clearLocal);
      const dialogLocal = dialogs.source.match(/\(0,[\w$]+\.jsx\)\(([\w$]+),\{open:[^,]+,showDialogClose:!1/)?.[1];
      const contentLocal = dialogs.source.match(/\(0,[\w$]+\.jsx\)\(([\w$]+),\{as:`form`,onSubmit:/)?.[1];
      const [Dialog,DialogContent] = await Promise.all([dialogLocal,contentLocal].map(local=>binding(dialogs.source,dialogs.url,local)));
      const menuCoreFile = menu.source.match(/from["']([^"']*generated-image-context-menu-[^"']+)["']/)?.[1];
      const menuCoreUrl = menuCoreFile ? new URL(menuCoreFile,menu.url).href : menu.url;
      const menuCoreSource = menuCoreFile ? await read(menuCoreUrl) : menu.source;
      const imageActions = component(menu.exports,source=>/onOpenedInNewTab:/.test(source),"image actions");
      const imageActionSource = String(imageActions);
      const imageFileLocal = imageActionSource.match(/let\{file:[\w$]+\}=([\w$]+)\(/)?.[1];
      const attachLocal = imageActionSource.match(/await ([\w$]+)\(e,i,\[n\],/)?.[1];
      const downloadLocal = imageActionSource.match(/await ([\w$]+)\(\{downloadSrc:/)?.[1];
      const [imageFile,attachChatImages,downloadImage] = await Promise.all([imageFileLocal,attachLocal,downloadLocal].map(local=>binding(menuCoreSource,menuCoreUrl,local)));
      const toolbarClass = selection.source.match(/className:`(pointer-events-auto flex h-toolbar[^`]+)`/)?.[1];
      const toolbarPositionClass = selection.source.match(/className:`(pointer-events-none fixed inset-x-4 bottom-6[^`]+)`/)?.[1];
      if (!toolbarClass || !toolbarPositionClass) throw new Error("Native selection toolbar layout changed");
      const libraryIcon = async label => {
        const marker = selection.source.indexOf(`defaultMessage:\`${label}\``);
        const prefix = selection.source.slice(Math.max(0, marker - 500), marker);
        const match = [...prefix.matchAll(/leftIcon:\(0,[\w$]+\.jsx\)\(([\w$]+),\{icon:\{(assets:\{)?16:([\w$]+),20:([\w$]+)/g)].at(-1);
        if (!match) throw new Error(`Native Library icon contract changed: ${label}`);
        const [Icon, small, medium] = await Promise.all([match[1], match[3], match[4]].map(local => binding(selection.source, selection.url, local)));
        const sizes = {16:small, 20:medium};
        return React.createElement(Icon, {icon:match[2] ? {assets:sizes} : sizes});
      };
      const upload = component(initial, source => /async function/.test(source) && /libraryPersistenceMode:/.test(source) && /uploadPurpose:/.test(source), "Library upload");
      const setFavorite = component(initial, source => /target_ref:/.test(source) && /showToast:/.test(source), "Library favorite");
      const auth = String(setFavorite).match(/accountId:e.get\(([\w$]+)\),userId:e.get\(([\w$]+)\)/);
      const [accountAtom,userAtom] = await Promise.all([auth?.[1],auth?.[2]].map(local => binding(initialSource,initialUrl,local)));
      if (!accountAtom || !userAtom) throw new Error("Native Library account contract changed");
      const toastLocal = selection.source.match(/get\(([\w$]+)\)\.danger\(/)?.[1];
      const toastAtom = await binding(selection.source, selection.url, toastLocal);
      const favoritePrefix = selection.source.slice(Math.max(0,selection.source.indexOf("id:`library.favorites.add`")-2000),selection.source.indexOf("id:`library.favorites.add`")+500);
      const favoriteAsset = favoritePrefix.match(/\{16:([\w$]+),20:([\w$]+)\}:\{16:([\w$]+),20:([\w$]+)\}/);
      if (!favoriteAsset) throw new Error("Native Library favorite icon contract changed");
      const favoriteIconLocal = favoritePrefix.match(/icon:\{assets:/)?.index;
      const favoriteIconOwner = favoritePrefix.slice(0,favoriteIconLocal).match(/\(0,[\w$]+\.jsx\)\(([\w$]+),\{$/)?.[1];
      const [FavoriteIcon, savedSmall, savedMedium, emptySmall, emptyMedium] = await Promise.all([favoriteIconOwner,...favoriteAsset.slice(1)].map(local => binding(selection.source,selection.url,local)));
      const favoriteIcon = saved => React.createElement(FavoriteIcon,{icon:{assets:saved?{16:savedSmall,20:savedMedium}:{16:emptySmall,20:emptyMedium}}});
      const [chatIcon, downloadIcon, folderIcon, deleteIcon] = await Promise.all([
        libraryIcon("Chat about this"), libraryIcon("Download"), libraryIcon("Add to folder"), libraryIcon("{kind, select, directory {Delete folder} other {Delete}}"),
      ]);
      // 文件画布使用原生 Home Composer 的控制器、附件 scope 和输入组件。
      const composerLocals=["kr","Qn","$n","rr","ke","hn","tn","P"];
      const [useComposerController,useHomeComposer,Composer,ComposerSurface,ScopeProvider,composerScope,createComposerValue,composerRouteScope] = await Promise.all(composerLocals.map(local=>binding(filePreview.source,filePreview.url,local)));
      if (!React.createElement || !ReactDOM.createRoot || !Menu.Item) throw new Error("Native Images rendering contract changed");
      return {
        React, ReactDOM, createPortal, Dropdown, Menu, Button, MoreIcon, chatIcon, downloadIcon, folderIcon, favoriteIcon, routerAtom, switchMode, createChatDraft, upload, setFavorite, toastAtom, accountAtom, userAtom,
        MoveDialog:moveDialog.exports.MoveLibraryItemsDialog,
        Checkbox,rangeSelection,nativeSelectedIds,ClearIcon,Dialog,DialogContent,ConfirmationContent:dialogs.exports.LibraryItemConfirmationContent,
        Canvas:canvas.exports.t,CanvasLayout:canvasLayout.exports.r,
        useComposerController,useHomeComposer,Composer,ComposerSurface,ScopeProvider,composerScope,createComposerValue,composerRouteScope,
        editImage:component(initial,source=>/async function/.test(source)&&/requireDispatchAcceptance:/.test(source)&&/sourceAttachment:/.test(source)&&/imageVariant/.test(source),"image edit submission"),
        imageFile,attachChatImages,downloadImage,toolbarClass,toolbarPositionClass,deleteIcon,
        Masonry: component(masonry.exports, source => /\{items:[^}]+animate:/.test(source), "masonry"),
        Skeleton: component(masonry.exports, source => /square:/.test(source) && /Loading library/.test(source), "skeleton"),
        Card: component(layout.exports, source => /actionIndicator:/.test(source) && /documentHeader:/.test(source), "card"),
        useImage: component(sourceImage.exports, source => /shouldLoadFileDataUrl:/.test(source), "image resolver"),
        imageMenu: component(menu.exports, source => /onOpenedInNewTab:/.test(source), "image actions"),
        openImage: component(initial, source => /availableImageCount:/.test(source) && /openInEditor:/.test(source) && /entrypoint:/.test(source), "image preview"),
      };
    })().catch(error => { connecting = null; throw error; });
    return connecting;
  }

  function environment(anchor) {
    const providers = [];
    const seen = new Set();
    let scope, libraryScope, intl;
    const inspect = value => {
      const candidate = value?.current ?? value;
      if (!libraryScope && candidate?.value?.basePath && candidate.value.accountId && typeof candidate.get === "function") libraryScope = candidate;
      if (!scope && candidate?.value?.routeKind && typeof candidate.get === "function" && typeof candidate.set === "function" && typeof candidate.query?.getOrFetch === "function") scope = candidate;
    };
    let current, element = anchor;
    while (element && !current) {
      current = codex.currentFiber(element);
      element = element.parentElement;
    }
    for (let fiber = current; fiber; fiber = fiber.return) {
      if (fiber.tag === 10 && !seen.has(fiber.type)) {
        seen.add(fiber.type);
        const value = fiber.memoizedProps?.value;
        providers.push({type:fiber.type, value});
        if (!intl && typeof value?.formatMessage === "function") intl = value;
      }
      inspect(fiber.memoizedProps);
      for (const value of Object.values(fiber.memoizedProps ?? {})) inspect(value);
      for (let hook = fiber.memoizedState, count = 0; hook && count < 140; hook = hook.next, count++) inspect(hook.memoizedState);
    }
    if (!scope || !intl) throw new Error("Native Images context is unavailable");
    return {providers, scope, libraryScope, intl};
  }

  function navigationContract(anchor) {
    for (let fiber = codex.currentFiber(anchor); fiber; fiber = fiber.return) {
      const props = fiber.memoizedProps;
      if (typeof fiber.type === "function" && props?.variant === "browse"
        && props.tabs?.some(item => item.key === "generated")
        && props.tabs?.some(item => item.key === "uploaded")) return {type:fiber.type, props};
    }
    throw new Error("Native image navigation contract changed");
  }

  async function mountNavigation(container, anchor, onSelect) {
    const native = await connect();
    const context = environment(anchor);
    const root = native.ReactDOM.createRoot(container);
    return {
      render(selectedKey) {
        const contract = navigationContract(anchor);
        const props = {
          ...contract.props,
          selectedKey,
          tabs:[...contract.props.tabs, {key:"imagegen", name:"Image Gen"}],
          onSelect:key => {
            if (key === "imagegen") context.libraryScope?.set(native.nativeSelectedIds,new Set());
            onSelect(key);
            if (key !== "imagegen") navigationContract(anchor).props.onSelect(key);
          },
        };
        let tree = native.React.createElement(contract.type, props);
        for (const provider of context.providers) {
          tree = native.React.createElement(provider.type, {value:provider.value}, tree);
        }
        root.render(tree);
      },
      dispose() {root.unmount();},
    };
  }

  async function mount(container, anchor, {onOpen, onPrompt, onRetry, onHidden}) {
    const native = await connect();
    const context = environment(anchor);
    const {React, ReactDOM} = native;
    const h = React.createElement;
    let failure, currentContent, folderDialog, removeDialog, canvasImage, disposed=false, batchBusy=false;
    let currentImages=[],currentLoading=true,selectedIds=new Set(),selectionAnchor=null;
    const scope = context.libraryScope;
    if (!scope) throw new Error("Native Library context is unavailable");
    const {accountId,userId} = scope.value;
    const message = (id,defaultMessage) => context.intl.formatMessage({id,defaultMessage});
    const toast = () => scope.get(native.toastAtom);
    const assertAccount = () => {
      if (disposed || scope.get(native.accountAtom) !== accountId || scope.get(native.userAtom) !== userId) throw new Error("Library account changed");
    };
    const reference = (image,operation,extra={}) => requestHostAction("local-image-source",{operation,id:image.id,accountId,userId,...extra});
    async function favoriteStatus(id) {
      const result = await libraryApi.favoriteStatus(id);
      const status = result.items?.find(item => item.target_ref?.library_file_id === id);
      if (status?.availability !== "available") throw new Error("Library favorite status is unavailable");
      return status.favorite?.favorite_id ?? null;
    }
    const cloud = createCloudImageActions({
      reference, assertAccount,
      fileNode:id => libraryApi.fileNode(id), favoriteStatus,
      setFavorite:(libraryFileId,favoriteId,isFavorited) => native.setFavorite(scope,{libraryFileId,favoriteId,isFavorited,surface:"library_grid",showToast:true}),
      upload:async file => {
        const bytes = Uint8Array.from(atob(file.base64),value => value.charCodeAt(0));
        const pendingToast = toast().info(message("minecodex.images.saving","Saving image to Library…"),{duration:0,hasCloseButton:false});
        try {
          const uploaded = await native.upload(scope,new File([bytes],file.name,{type:"image/png"}),{
            libraryPersistenceMode:"required",storeInLibrary:true,uploadPurpose:"library",beforeRequest:assertAccount,
          });
          return uploaded.libraryFileId;
        } finally {pendingToast.close();}
      },
    });
    async function folder(image) {
      const images=Array.isArray(image)?image:[image];
      const registered=[];
      for(const item of images)registered.push(await cloud.registered(item));
      const entries=registered.map(item=>item.entry),created=registered.some(item=>item.created);
      let moved = false;
      folderDialog = h(native.MoveDialog,{
        accountId,userId,entries,initialPath:[],
        onMoved:() => {moved=true;},
        onClose:() => {
          folderDialog=null;render(currentContent);
          if (!moved) toast().info(created
            ? message("minecodex.images.folderCanceledSaved","Image saved to Library, but not added to a folder.")
            : message("minecodex.images.folderCanceled","No folder selected."));
        },
      });
      render(currentContent);
    }
    function operationError(error) {
      if (disposed) return;
      toast().danger(error.code === "UPLOAD_UNCONFIRMED"
        ? message("minecodex.images.uploadUnconfirmed","Image upload is pending or could not be confirmed. Check Library before uploading again.")
        : message("minecodex.images.libraryActionFailed","Couldn’t complete the Library action. Please try again."));
      console.error("MineCodex Library action",error);
    }
    const root = ReactDOM.createRoot(container, {onUncaughtError:error => {failure=error;onRetry(error);}});
    function render(content) {
      currentContent = content;
      let tree = h(React.Fragment,null,content,folderDialog,removeDialog,selectionToolbar(),canvasImage?h(ImageCanvas,{key:canvasImage.id,image:canvasImage}):null);
      for (const provider of context.providers) tree = h(provider.type, {value:provider.value}, tree);
      root.render(tree);
    }
    function refresh() {
      render(currentLoading ? h(native.Skeleton) : h("div",{className:"pt-4",children:h(native.Masonry,{items:currentImages.map(image=>({id:image.id,content:h(ImageCard,{image})})),animate:true})}));
    }
    function select(image,checked,extendRange=false) {
      if (batchBusy) return;
      const next=native.rangeSelection({orderedIds:currentImages.map(item=>item.id),selectedIds,anchor:selectionAnchor,id:image.id,selected:checked,extendRange});
      selectedIds=next.selectedIds;selectionAnchor=next.anchor;refresh();
    }
    const selectedImages = () => currentImages.filter(image=>selectedIds.has(image.id));
    function clearSelection() {selectedIds=new Set();selectionAnchor=null;removeDialog=null;refresh();}
    async function performBatch(action) {
      if (batchBusy) return;
      batchBusy=true;refresh();
      try {await action();} catch(error) {operationError(error);} finally {batchBusy=false;if(!disposed)refresh();}
    }
    function confirmRemove(images) {
      let pending=false;
      const close=()=>{if(pending)return;removeDialog=null;refresh();};
      const update=()=>{
        removeDialog=h(native.Dialog,{open:true,showDialogClose:false,onOpenChange:open=>{if(!open)close();}},
          h(native.DialogContent,{as:"form",onSubmit:event=>{
            event.preventDefault();if(pending)return;pending=true;update();refresh();
            void requestHostAction("local-image-source",{operation:"hide",ids:images.map(image=>image.id)}).then(result=>{
              if(disposed)return;
              const hidden=new Set(result.hiddenIds);
              currentImages=currentImages.filter(image=>!hidden.has(image.id));
              selectedIds=new Set([...selectedIds].filter(id=>!hidden.has(id)));
              pending=false;removeDialog=null;onHidden?.(result.hiddenIds);refresh();
              toast().info(message("minecodex.images.hidden","Hidden from Image Gen"));
            }).catch(error=>{pending=false;update();refresh();operationError(error);});
          }},h(native.ConfirmationContent,{
            title:context.intl.formatMessage({id:"minecodex.images.hideTitle",defaultMessage:"Delete {count, plural, one {image} other {# images}} from Image Gen?"},{count:images.length}),
            description:message("minecodex.images.hideDescription","These images will only be hidden from Image Gen. Local originals and cloud copies will be kept."),
            pending,confirmLabel:message("libraryNext.actions.delete","Delete"),onClose:close,
          })));
      };
      update();refresh();
    }
    function selectionToolbar() {
      if (!selectedIds.size) return null;
      const images=selectedImages();
      const button=(color,label,icon,onClick)=>h(native.Button,{color,radius:"full",size:"toolbar",disabled:batchBusy,onClick,children:[icon,label]});
      const more=h(native.Dropdown,{surface:"opaque",contentWidth:"sm",align:"end",
        triggerButton:h(native.Button,{color:"ghostActive",radius:"full",size:"toolbar",uniform:true,disabled:batchBusy,"aria-label":message("libraryNext.selection.more","More actions"),children:h(native.MoreIcon)}),
        children:h(native.Menu.Item,{leftIcon:native.folderIcon,onSelect:()=>{void performBatch(()=>folder(images));},children:message("libraryNext.selection.move","Move")}),
      });
      return h("div",{className:native.toolbarPositionClass,"data-theme":"dark",children:h("div",{className:native.toolbarClass,role:"toolbar","aria-label":message("libraryNext.selection.actions","Selected item actions"),children:[
        h("span",{className:"min-w-24 shrink-0 whitespace-nowrap tabular-nums select-none",children:context.intl.formatMessage({id:"libraryNext.selection.count",defaultMessage:"{count} selected"},{count:images.length})}),
        button("mediaSolid",message("libraryNext.selection.chat","Start chat"),native.chatIcon,()=>{void performBatch(()=>startChat(images));}),
        button("outline",message("libraryNext.actions.download","Download"),native.downloadIcon,()=>{void performBatch(async()=>{
          for(const image of images){const file=await reference(image,"upload-file");if(await native.downloadImage({downloadSrc:`data:image/png;base64,${file.base64}`,suggestedFilename:file.name})){selectedIds.delete(image.id);}}
        });}),
        button("dangerSolid",message("libraryNext.actions.delete","Delete"),native.deleteIcon,()=>confirmRemove(images)),
        more,h(native.Button,{color:"ghostActive",radius:"full",size:"toolbar",uniform:true,disabled:batchBusy,onClick:clearSelection,"aria-label":message("libraryNext.selection.clear","Clear selection"),children:h(native.ClearIcon)}),
      ]})});
    }
    function onSelectionKey(event) {
      if(event.key!=="Escape" || !selectedIds.size || batchBusy || removeDialog || folderDialog || event.defaultPrevented)return;
      if(event.target instanceof Element && event.target.closest("input,textarea,[contenteditable=true],[role=dialog],[role=menu]"))return;
      event.preventDefault();clearSelection();
    }
    document.addEventListener("keydown",onSelectionKey);
    async function startChat(images) {
      const conversationId=native.createChatDraft(context.scope,[]);
      native.switchMode(context.scope,"chat");
      const files=[];
      for(const image of images){const file=await reference(image,"upload-file");files.push(native.imageFile(`data:image/png;base64,${file.base64}`,file.name).file);}
      if (!await native.attachChatImages(context.scope,conversationId,files,{isTemporaryChat:false})) throw new Error("Could not attach selected images");
      const navigate=context.scope.get(native.routerAtom).prepareNavigation("/",{state:{codexAppMode:"chat",initialChatGptConversationId:conversationId,focusComposerNonce:Date.now()}});
      if(!navigate)throw new Error("Native Chat navigation is unavailable");
      clearSelection();await navigate();
    }
    function localImage(image) {
      return {id:image.imageGenerationItemId, src:image.sourcePath, previewSrc:image.sourcePath, alt:image.name, tabTitle:image.name, width:image.width, height:image.height};
    }
    function open(image, options) {
      opened.set(image.sourcePath, image);
      if (!options) {canvasImage=image;refresh();return;}
      const {readOnly=false,scope=context.scope,chatGptConversationId}=options;
      const result = native.openImage(scope, {
        chatGptConversationId, alt:image.name, title:image.name, attachmentId:`image-playground:${image.imageGenerationItemId}`,
        attachmentSrc:image.sourcePath, src:image.sourcePath, downloadSrc:image.sourcePath,
        imageId:image.imageGenerationItemId, sourceConversationId:image.threadId,
        imageSourceContext:{conversationId:image.threadId, hostId:"local"}, imageSource:"generated",
        readOnly, openInEditor:true,
        renderHeaderMenuActions:({renderMenu}) => renderMenu(h(native.Menu.Item, {onSelect:() => onPrompt(image), children:context.intl.formatMessage({id:"minecodex.images.viewPrompts",defaultMessage:"View prompts"})})),
      }, {addToHistory:false});
      if (!result) throw new Error("Native image preview could not open");
    }
    function ImageCanvas({image}) {
      const resolved=native.useImage({src:image.sourcePath,conversationId:null,shouldLoadFileDataUrl:true});
      const close=()=>{canvasImage=null;refresh();};
      const viewport=container.closest(".contain-layout");
      if(!viewport)throw new Error("Native Library preview viewport changed");
      React.useEffect(()=>{
        const page=container.closest(".overflow-y-auto");
        const previous=page?.inert;
        if(page)page.inert=true;
        return ()=>{if(page)page.inert=previous;};
      },[]);
      const [composerValue]=React.useState(()=>native.createComposerValue({kind:"image",image:{filename:image.name,id:image.id,src:image.sourcePath}},`minecodex-image:${image.id}`));
      const content=h(native.ScopeProvider,{scope:native.composerRouteScope.parent,value:{clientThreadId:`minecodex-image:${image.id}`,routeConversationId:null}},
        h(native.ScopeProvider,{scope:native.composerRouteScope,value:{pathname:"/",routeKind:"home",routeTemplate:"/",search:"",projectContext:null}},
          h(native.ScopeProvider,{scope:native.composerScope,value:composerValue},h(CanvasSurface,{image,resolved,close}))));
      // 原生文件预览占据主内容 viewport，保留导航、二级侧栏和窗口栏。
      return native.createPortal(h("div",{className:"absolute inset-0 z-40 overflow-hidden", "data-minecodex-image-canvas":image.id,children:content}),viewport);
    }
    function CanvasSurface({image,resolved,close}) {
      const controller=native.useComposerController();
      const home=native.useHomeComposer({homeComposerController:controller,homeComposerMode:"chat"});
      const [abort]=React.useState(()=>new AbortController());
      const [markup,setMarkup]=React.useState(false);
      const [manualZoomPercent,setManualZoomPercent]=React.useState(null);
      const [submitting,setSubmitting]=React.useState(false);
      const editorRef=React.useRef(null);
      const attachment=React.useRef(null);
      const submissionAccepted=React.useRef(false);
      React.useEffect(()=>()=>{if(!submissionAccepted.current)abort.abort();},[abort]);
      const assertCurrent=()=>{abort.signal.throwIfAborted();assertAccount();};
      // 查看不上传；首次发送或编辑时才准备原生临时附件，同一画布复用。
      const prepare=async()=>{
        assertCurrent();
        if(!attachment.current)attachment.current=(async()=>{
          const file=await reference(image,"upload-file");assertCurrent();
          const bytes=Uint8Array.from(atob(file.base64),value=>value.charCodeAt(0));
          const uploaded=await native.upload(context.scope,new File([bytes],file.name,{type:"image/png"}),{storeInLibrary:false,beforeRequest:assertCurrent,signal:abort.signal});
          return {...uploaded,width:image.width,height:image.height,imageReference:true};
        })().catch(error=>{attachment.current=null;throw error;});
        return attachment.current;
      };
      if(!home)return null;
      const props=home.composerProps;
      const accepted=(...args)=>{submissionAccepted.current=true;close();props.onSubmitAccepted?.(...args);};
      const requestClose=()=>{if(markup&&editorRef.current)editorRef.current.requestClose();else close();};
      const submitEdit=async request=>{
        if(submitting)return false;
        const editor=markup?editorRef.current:null;
        if(markup&&(!editor||editor.isReadOnly||editor.editor.getSnapshot().hasActiveGesture))return false;
        editor?.commitComment();editor?.editor.commitPendingTextEdit();
        const document=editor?.editor.getSnapshot().effectiveDocument;
        setSubmitting(true);
        try {
          const file=await prepare();assertCurrent();
          const sourceImage={id:image.id,src:`${file.id.startsWith("file_")?"sediment":"file-service"}://${file.id}`,status:"completed",type:"generated-image",width:image.width,height:image.height,sizeBytes:file.size};
          const ok=await native.editImage(context.scope,{
            beforeRequest:assertCurrent,conversationId:props.conversationId,document,image:sourceImage,
            isSubmissionCurrent:()=>!abort.signal.aborted&&!disposed,isTemporaryChat:false,
            request,requireDispatchAcceptance:true,signal:abort.signal,sourceAttachment:file,
          });
          if(ok){assertCurrent();accepted(props.conversationId);}
          return ok;
        }catch(error){if(!abort.signal.aborted)operationError(error);return false;}
        finally {if(!abort.signal.aborted)setSubmitting(false);}
      };
      const composer=h(native.ComposerSurface,{placement:{kind:"home"}},h(native.Composer,{
        ...props,composerController:controller,composerLayoutMode:"auto-single-line",lockedLayout:"single-line",
        className:"mx-auto w-full max-w-2xl px-toolbar",errorClassName:"p-3",showFilePicker:false,signal:abort.signal,
        placeholder:message("libraryFilePreview.composerPlaceholder","Ask about this file"),isPrimaryComposer:false,
        disableSubmit:props.disableSubmit||submitting,
        attachmentPreparation:{mimeTypes:["image/png"],prepare:async signal=>{signal?.throwIfAborted();return [await prepare()];}},
        onSubmitAccepted:accepted,
      }));
      const dataUrl=resolved.dataUrl??resolved.previewSrc;
      const canvas=h(native.Canvas,{
        alt:image.name,title:image.name,src:dataUrl??image.sourcePath,downloadSrc:dataUrl??image.sourcePath,downloadFilename:image.name,
        attachmentId:`image-playground:${image.imageGenerationItemId}`,attachmentSrc:image.sourcePath,
        chatGptConversationId:props.conversationId,
        imageSource:"generated",imageSourceContext:{conversationId:image.threadId,hostId:"local"},
        readOnly:false,presentation:"dialog",standalone:true,showViewerHeader:true,onClose:requestClose,
        markupMode:{active:markup,onActiveChange:setMarkup,editorRef,isSubmitting:submitting,standaloneComposer:true},
        onImageEditSubmit:submitEdit,
        zoom:{manualZoomPercent,onZoomPercentChange:setManualZoomPercent,onZoomToFit:()=>setManualZoomPercent(null)},
        renderComposer:visible=>h(React.Activity,{mode:visible?"visible":"hidden",children:composer}),
        renderHeaderMenuActions:({renderMenu})=>renderMenu(h(native.Menu.Item,{onSelect:()=>onPrompt(image),children:message("minecodex.images.viewPrompts","View prompts")})),
      });
      // 原生 overlay 负责底部留白、宽度、避让与 Comment 时的输入框显隐。
      return h(native.CanvasLayout,{assetName:image.name,contentOwnsHeader:true,onClose:requestClose,children:canvas});
    }
    async function chatAbout(image) {
      const conversationId = native.createChatDraft(context.scope, []);
      native.switchMode(context.scope, "chat");
      const navigate = context.scope.get(native.routerAtom).prepareNavigation("/", {
        state:{codexAppMode:"chat", initialChatGptConversationId:conversationId, focusComposerNonce:Date.now()},
      });
      if (!navigate) throw new Error("Native Chat navigation is unavailable");
      await navigate();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const composer = document.querySelector('[data-codex-composer="true"]') ?? document.querySelector('[contenteditable="true"]');
      if (!composer) throw new Error("Native Chat composer is unavailable");
      const chat = environment(composer);
      open(image, {readOnly:true, scope:chat.scope, chatGptConversationId:conversationId});
    }
    function ImageCard({image}) {
      const [saved,setSaved] = React.useState(false);
      const [busy,setBusy] = React.useState(false);
      async function perform(action) {
        if (busy) return;
        setBusy(true);
        try {await action();} catch(error) {operationError(error);} finally {setBusy(false);}
      }
      async function refreshFavorite(open) {
        if (!open) return;
        try {
          const cached = await reference(image,"reference");
          setSaved(cached.libraryFileId ? !!(await favoriteStatus(cached.libraryFileId)) : false);
        } catch(error) {console.error("MineCodex favorite status",error);}
      }
      const resolved = native.useImage({src:image.sourcePath, conversationId:image.threadId, hostId:"local", shouldLoadFileDataUrl:true});
      const value = localImage(image);
      const actions = native.imageMenu(context.scope, {hostId:"local",image:value,displaySrc:resolved.previewSrc ?? image.sourcePath,intl:context.intl});
      // Chat about this 组合原生新 Chat 导航、附件与图片面板链路。
      const byId = new Map(actions.map(item => [item.id, item]));
      const action = (id, icon, message) => {
        const item = byId.get(id);
        return item && {...item, icon, text:context.intl.formatMessage(message ?? item.message)};
      };
      const promptGlyph = document.querySelector('[aria-label="Prompts"] svg');
      const menuGlyph = promptGlyph?.cloneNode(true);
      if (menuGlyph) {
        menuGlyph.setAttribute("width","16");menuGlyph.setAttribute("height","16");
        menuGlyph.style.width="16px";menuGlyph.style.height="16px";
      }
      const promptIcon = menuGlyph ? h("span", {className:"inline-flex size-4 items-center justify-center", "aria-hidden":true, dangerouslySetInnerHTML:{__html:menuGlyph.outerHTML}}) : null;
      const menuItems = [
        {id:"chat-about", icon:native.chatIcon, text:context.intl.formatMessage({id:"libraryNext.actions.chatAboutItem",defaultMessage:"Chat about this"}),onSelect:() => {void chatAbout(image).catch(onRetry);}},
        {id:"favorite",icon:native.favoriteIcon(saved),text:saved
          ? message("library.favorites.remove","Remove from Favorites")
          : message("library.favorites.add","Add to Favorites"),onSelect:() => {void perform(async () => setSaved(await cloud.favorite(image)));}},
        action("download-a-copy", native.downloadIcon, {id:"libraryNext.actions.download", defaultMessage:"Download"}),
        {id:"folder",icon:native.folderIcon,text:message("libraryNext.actions.addToFolder","Add to folder"),onSelect:() => {void perform(() => folder(image));}},
        {id:"delete",icon:native.deleteIcon,tone:"danger",text:message("libraryNext.actions.delete","Delete"),onSelect:()=>confirmRemove([image])},
        {id:"view-prompts", icon:promptIcon, text:context.intl.formatMessage({id:"minecodex.images.viewPrompts",defaultMessage:"View prompts"}),onSelect:() => {open(image);onPrompt(image);}},
      ].filter(Boolean);
      const dropdown = h(native.Dropdown, {
        contentWidth:"menu", align:"end", onOpenChange:refreshFavorite,
        triggerButton:h(native.Button,{color:"mediaOverlay",size:"inputIcon",radius:"full","aria-label":context.intl.formatMessage({id:"minecodex.images.actions",defaultMessage:"More actions"}),children:h(native.MoreIcon)}),
        children:menuItems.map(item => h(native.Menu.Item,{key:item.id,disabled:busy || batchBusy || item.disabled,tone:item.tone,leftIcon:item.icon,onSelect:item.onSelect,children:item.text})),
      });
      // 卡片限制比例以容纳控件；超宽或超窄原图完整缩放，不能随卡片比例裁切。
      const imageRatio=image.width>0&&image.height>0?image.width/image.height:1;
      const cardRatio=Math.min(20/13,Math.max(1/2,imageRatio));
      const picture = resolved.previewSrc
        ? h("img",{src:resolved.dataUrl ?? resolved.previewSrc,alt:"",loading:"lazy",decoding:"async",draggable:false,className:`absolute inset-0 size-full ${imageRatio===cardRatio?"object-cover":"object-contain"}`})
        : h("span",{className:"absolute inset-0 bg-text/10","aria-busy":!resolved.isError,children:resolved.isError?"Image unavailable":null});
      const checked=selectedIds.has(image.id);
      const selection=h("span",{className:`relative flex items-center ${checked?"":"opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100"}`,onClickCapture:event=>{
        if(event.shiftKey){event.preventDefault();select(image,!checked,true);}
      },children:h(native.Checkbox,{className:"cursor-interaction",variant:"overlay",checked,disabled:batchBusy,"aria-label":context.intl.formatMessage({id:"libraryNext.selection.item",defaultMessage:"Select {name}"},{name:image.name}),onCheckedChange:value=>select(image,value===true)})});
      return h(native.Card,{name:image.name,selection,selected:checked,selectionActive:selectedIds.size>0,onSelect:event=>{
        if(selectedIds.size || event.shiftKey){select(image,!checked,event.shiftKey);return true;}return false;
      },onOpen:() => onOpen(image,open),actions:dropdown,children:h("span",{className:"relative flex min-h-0 w-full flex-1 items-center justify-center",children:h("span",{className:"relative flex w-full items-center justify-center",style:{aspectRatio:cardRatio},children:picture})})});
    }
    return {
      render({images,loading}) {
        if (failure) throw failure;
        currentImages=images;currentLoading=loading;
        if(loading){selectedIds=new Set();selectionAnchor=null;removeDialog=null;}
        refresh();
      },
      clearSelection,
      dispose() {disposed=true;document.removeEventListener("keydown",onSelectionKey);root.unmount();},
    };
  }

  function readViewer(header) {
    const props = codex.props(header, props => typeof props?.attachmentSrc === "string" && opened.has(props.attachmentSrc));
    return props ? opened.get(props.attachmentSrc) : null;
  }
  return {mount, mountNavigation, readViewer};
}
