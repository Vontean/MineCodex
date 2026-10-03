import {createNativeImageModules} from "./native-image-modules.mjs";

// 原生呈现与上下文只在此适配；构建产物发现由专用模块提供。
export function createNativeImageSource(codex, { requestHostAction, libraryApi, createCloudImageActions, promptGlyphSource, signal, modules = createNativeImageModules() } = {}) {
  const connect = modules.gallery;
  const opened = new Map();

  function uploadFile({base64,name}) {
    const decoded=atob(base64),bytes=new Uint8Array(decoded.length);
    // 直接写入字节，避免大图经字符串迭代器创建中间数组。
    for(let index=0;index<decoded.length;index++)bytes[index]=decoded.charCodeAt(index);
    return new File([bytes],name,{type:"image/png"});
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
    const native = await modules.navigation();
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
    let native = await connect();
    const context = environment(anchor);
    const {React, ReactDOM} = native;
    const h = React.createElement;
    const promptIcon=h("span",{className:"inline-flex size-4 items-center justify-center","aria-hidden":true,dangerouslySetInnerHTML:{__html:promptGlyphSource}});
    let failure, currentContent, folderDialog, removeDialog, canvasImage, disposed=false, batchBusy=false;
    let currentImages=[],currentLoading=true,selectedIds=new Set(),selectionAnchor=null,openRevision=0;
    const scope = context.libraryScope;
    if (!scope) throw new Error("Native Library context is unavailable");
    const {accountId,userId} = scope.value;
    const message = (id,defaultMessage) => context.intl.formatMessage({id,defaultMessage});
    const toast = () => scope.get(native.toastAtom);
    const sameAccount = () => scope.get(native.accountAtom) === accountId && scope.get(native.userAtom) === userId;
    const isCurrent = () => !disposed && sameAccount();
    const assertAccount = () => {if (!isCurrent()) throw new Error("Library action is no longer current");};
    const reference = (image,operation,extra={}) => requestHostAction("local-image-source",{operation,id:image.id,accountId,userId,...extra});
    async function favoriteStatus(id) {
      const result = await libraryApi.favoriteStatus(id);
      const status = result.items?.find(item => item.target_ref?.library_file_id === id);
      if (status?.availability !== "available") throw new Error("Library favorite status is unavailable");
      return status.favorite?.favorite_id ?? null;
    }
    const cloud = createCloudImageActions({
      reference, assertAccount,
      favoriteStatus,
      setFavorite:(libraryFileId,favoriteId,isFavorited) => native.setFavorite(scope,{libraryFileId,favoriteId,isFavorited,surface:"library_grid",showToast:true}),
      upload:async file => {
        const pendingToast = toast().info(message("minecodex.images.saving","Saving image to Library…"),{duration:0,hasCloseButton:false});
        try {
          const uploaded = await native.upload(scope,uploadFile(file),{
            libraryPersistenceMode:"required",storeInLibrary:true,uploadPurpose:"library",beforeRequest:assertAccount,
          });
          return uploaded.libraryFileId;
        } finally {pendingToast.close();}
      },
    });
    async function folder(image) {
      const images=Array.isArray(image)?image:[image];
      const registered=[];
      const entries=[];
      for (const item of images) {
        const result=await cloud.registered(item);
        const node=await libraryApi.fileNode(result.libraryFileId);
        assertAccount();
        registered.push(result);
        entries.push({node});
      }
      const created=registered.some(item=>item.created);
      let moved = false;
      folderDialog = h(native.MoveDialog,{
        accountId,userId,entries,initialPath:[],
        onMoved:() => {moved=true;},
        onClose:() => {
          if (!isCurrent()) return;
          folderDialog=null;render(currentContent);
          if (!moved) toast().info(created
            ? message("minecodex.images.folderCanceledSaved","Image saved to Library, but not added to a folder.")
            : message("minecodex.images.folderCanceled","No folder selected."));
        },
      });
      render(currentContent);
    }
    function operationError(error) {
      if (!isCurrent()) return;
      toast().danger(error.code === "UPLOAD_UNCONFIRMED"
        ? message("minecodex.images.uploadUnconfirmed","Image upload is pending or could not be confirmed. Check Library before uploading again.")
        : message("minecodex.images.libraryActionFailed","Couldn’t complete the Library action. Please try again."));
      console.error("MineCodex Library action",error);
    }
    const root = ReactDOM.createRoot(container, {onUncaughtError:error => {failure=error;onRetry(error);}});
    function render(content) {
      if (!isCurrent()) return;
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
    function clearSelection() {openRevision++;selectedIds=new Set();selectionAnchor=null;removeDialog=null;refresh();}
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
              if(!isCurrent())return;
              const hidden=new Set(result.hiddenIds);
              currentImages=currentImages.filter(image=>!hidden.has(image.id));
              selectedIds=new Set([...selectedIds].filter(id=>!hidden.has(id)));
              pending=false;removeDialog=null;onHidden?.(result.hiddenIds);refresh();
              toast().info(message("minecodex.images.hidden","Hidden from Image Gen"));
            }).catch(error=>{if(!isCurrent())return;pending=false;update();refresh();operationError(error);});
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
      assertAccount();
      const conversationId=native.createChatDraft(context.scope,[]);
      native.switchMode(context.scope,"chat");
      const files=[];
      for(const image of images){const file=await reference(image,"upload-file");assertAccount();files.push(native.imageFile(`data:image/png;base64,${file.base64}`,file.name).file);}
      if (!await native.attachChatImages(context.scope,conversationId,files,{isTemporaryChat:false})) throw new Error("Could not attach selected images");
      assertAccount();
      const navigate=context.scope.get(native.routerAtom).prepareNavigation("/",{state:{codexAppMode:"chat",initialChatGptConversationId:conversationId,focusComposerNonce:Date.now()}});
      if(!navigate)throw new Error("Native Chat navigation is unavailable");
      clearSelection();await navigate();
    }
    function localImage(image) {
      return {id:image.imageGenerationItemId, src:image.sourcePath, previewSrc:image.sourcePath, alt:image.name, tabTitle:image.name, width:image.width, height:image.height};
    }
    async function open(image, options) {
      if (!options) {
        assertAccount();
        const revision=++openRevision;
        const canvas=await modules.canvas();
        // 切换来源或重置列表后，不让晚到的画布覆盖当前页面。
        if(revision!==openRevision || !isCurrent())return false;
        native={...native,...canvas};
        opened.set(image.sourcePath,image);
        canvasImage=image;refresh();return true;
      }
      if (signal?.aborted || !sameAccount()) return;
      opened.set(image.sourcePath, image);
      const {readOnly=false,scope=context.scope,chatGptConversationId}=options;
      const result = native.openImage(scope, {
        chatGptConversationId, alt:image.name, title:image.name, attachmentId:`image-playground:${image.imageGenerationItemId}`,
        attachmentSrc:image.sourcePath, src:image.sourcePath, downloadSrc:image.sourcePath,
        imageId:image.imageGenerationItemId, sourceConversationId:image.threadId,
        imageSourceContext:{conversationId:image.threadId, hostId:"local"}, imageSource:"generated",
        readOnly, openInEditor:true,
        renderHeaderMenuActions:({renderMenu}) => renderMenu(h(native.Menu.Item, {leftIcon:promptIcon,onSelect:() => onPrompt(image), children:context.intl.formatMessage({id:"minecodex.images.viewPrompts",defaultMessage:"View prompts"})})),
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
      return native.createPortal(h("div",{className:"absolute inset-0 z-40 overflow-hidden", "data-minecodex-image-canvas":image.id,children:[
        // 画布在主内容内，原生窗口级 overlay 的交通灯避让不适用于此处。
        h("style",{children:'[data-minecodex-image-canvas] .shrink-0:has(>[data-testid="viewer-header"]){padding-left:0!important;padding-right:0!important}'}),content,
      ]}),viewport);
    }
    function CanvasSurface({image,resolved,close}) {
      const controller=native.useComposerController();
      const navigate=native.useFileNavigate();
      const home=native.useHomeComposer({homeComposerController:controller,homeComposerMode:"chat"});
      const [abort]=React.useState(()=>new AbortController());
      const [markup,setMarkup]=React.useState(false);
      const [manualZoomPercent,setManualZoomPercent]=React.useState(null);
      const [submitting,setSubmitting]=React.useState(false);
      const [composerHeight,setComposerHeight]=React.useState(0);
      const measureComposer=React.useCallback(node=>{
        const element=node?.querySelector("[data-codex-composer-root]");
        if(!element)return;
        const measure=()=>setComposerHeight(element.getBoundingClientRect().height);
        const observer=new ResizeObserver(measure);
        observer.observe(element);measure();
        return ()=>{observer.disconnect();setComposerHeight(0);};
      },[]);
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
          const uploaded=await native.upload(context.scope,uploadFile(file),{storeInLibrary:false,beforeRequest:assertCurrent,signal:abort.signal});
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
      const composer=h("div",{ref:measureComposer,className:"contents"},h(native.ComposerSurface,{placement:{kind:"home"}},h(native.FileComposer,{
        composerController:controller,composerLayoutMode:"auto-single-line",
        className:"mx-auto w-[min(48rem,calc(100vw-2rem))] max-w-full",
        composerModeAvailability:native.fileComposerAvailability,
        hideRunLocationDropdownOverride:true,showUtilityBar:false,surfaceVariant:"inline",
        placeholderText:message("libraryFilePreview.composerPlaceholder","Ask about this file"),
        submitDisabled:submitting,selectedProject:null,
        // 原图仅在发送时成为本地附件，不伪造 Library 身份，也不上传云端。
        prepareLocalConversationAttachments:async ({fileAttachments,hostId})=>{
          assertCurrent();
          const file=await reference(image,"upload-file");assertCurrent();
          const attached=await native.localAttachmentService(context.scope,hostId).createFileAttachment({contents:uploadFile(file),label:file.name});
          if(abort.signal.aborted||!isCurrent()){
            await native.deleteLocalAttachment(context.scope,hostId,attached.path);
            assertCurrent();
          }
          return [...fileAttachments,attached];
        },
        onLocalFirstTurnAccepted:()=>{submissionAccepted.current=true;},
        onLocalConversationCreated:(conversationId,state)=>{submissionAccepted.current=true;close();navigate(native.localThreadRoute(conversationId),{state});},
      })));
      const dataUrl=resolved.dataUrl??resolved.previewSrc;
      const canvas=h(native.Canvas,{
        alt:image.name,title:image.name,src:dataUrl??image.sourcePath,downloadSrc:dataUrl??image.sourcePath,downloadFilename:image.name,
        attachmentId:`image-playground:${image.imageGenerationItemId}`,attachmentSrc:image.sourcePath,
        chatGptConversationId:props.conversationId,
        imageSource:"generated",imageSourceContext:{conversationId:image.threadId,hostId:"local"},
        readOnly:false,presentation:"overlay",standalone:true,showViewerHeader:true,onClose:requestClose,
        markupMode:{active:markup,onActiveChange:setMarkup,editorRef,isSubmitting:submitting,standaloneComposer:true},
        onImageEditSubmit:submitEdit,
        zoom:{manualZoomPercent,onZoomPercentChange:setManualZoomPercent,onZoomToFit:()=>setManualZoomPercent(null)},
        renderComposer:visible=>h(React.Activity,{mode:visible?"visible":"hidden",children:composer}),
        renderHeaderMenuActions:({renderMenu})=>renderMenu(h(native.Menu.Item,{leftIcon:promptIcon,onSelect:()=>onPrompt(image),children:message("minecodex.images.viewPrompts","View prompts")})),
      });
      // 原生 overlay 的 118px 下限属于旧输入框；画布和拖拽边界跟随实际高度。
      const reserve=composerHeight>0?`calc(${composerHeight}px + var(--spacing)*4)`:"0px";
      return h("div",{className:"contents",style:{"--right-panel-composer-overlay-reserve":reserve}},
        h(native.CanvasLayout,{assetName:image.name,contentOwnsHeader:true,onClose:requestClose,children:canvas}));
    }
    async function chatAbout(image) {
      assertAccount();
      const conversationId = native.createChatDraft(context.scope, []);
      native.switchMode(context.scope, "chat");
      const navigate = context.scope.get(native.routerAtom).prepareNavigation("/", {
        state:{codexAppMode:"chat", initialChatGptConversationId:conversationId, focusComposerNonce:Date.now()},
      });
      if (!navigate) throw new Error("Native Chat navigation is unavailable");
      await navigate();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      // 导航会正常卸载图库；只把面板移交给目标 Chat 的可见输入框。
      if (signal?.aborted || !sameAccount()) return;
      const composer = codex.composer(null,{purpose:"insertion"})?.editable;
      if (!composer) throw new Error("Native Chat composer is unavailable");
      const chat = environment(composer);
      await open(image, {readOnly:true, scope:chat.scope, chatGptConversationId:conversationId});
    }
    function ImageCard({image}) {
      const [saved,setSaved] = React.useState(false);
      const [busy,setBusy] = React.useState(false);
      const active=React.useRef(true);
      const favoriteRevision=React.useRef(0);
      React.useEffect(()=>{active.current=true;return()=>{active.current=false;favoriteRevision.current++;};},[]);
      async function perform(action) {
        if (busy) return;
        setBusy(true);
        try {assertAccount();await action();} catch(error) {operationError(error);} finally {if(active.current&&isCurrent())setBusy(false);}
      }
      async function refreshFavorite(open) {
        const revision=++favoriteRevision.current;
        if (!open) return;
        try {
          const cached = await reference(image,"reference");
          const value=cached.libraryFileId ? !!(await favoriteStatus(cached.libraryFileId)) : false;
          if (active.current && isCurrent() && revision===favoriteRevision.current) setSaved(value);
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
      const menuItems = [
        {id:"chat-about", icon:native.chatIcon, text:context.intl.formatMessage({id:"libraryNext.actions.chatAboutItem",defaultMessage:"Chat about this"}),onSelect:() => {void chatAbout(image).catch(onRetry);}},
        {id:"view-prompts", icon:promptIcon, text:context.intl.formatMessage({id:"minecodex.images.viewPrompts",defaultMessage:"View prompts"}),onSelect:() => {void open(image).then(opened=>{if(opened&&isCurrent())onPrompt(image);}).catch(operationError);}},
        {id:"favorite",icon:native.favoriteIcon(saved),text:saved
          ? message("library.favorites.remove","Remove from Favorites")
          : message("library.favorites.add","Add to Favorites"),onSelect:() => {void perform(async () => {
            favoriteRevision.current++;
            const value=await cloud.favorite(image);
            if(active.current&&isCurrent()){favoriteRevision.current++;setSaved(value);}
          });}},
        action("download-a-copy", native.downloadIcon, {id:"libraryNext.actions.download", defaultMessage:"Download"}),
        {id:"folder",icon:native.folderIcon,text:message("libraryNext.actions.addToFolder","Add to folder"),onSelect:() => {void perform(() => folder(image));}},
        {id:"delete",icon:native.deleteIcon,tone:"danger",text:message("libraryNext.actions.delete","Delete"),onSelect:()=>confirmRemove([image])},
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
      },onOpen:() => {void Promise.resolve(onOpen(image,open)).catch(operationError);},actions:dropdown,children:h("span",{className:"relative flex min-h-0 w-full flex-1 items-center justify-center",children:h("span",{className:"relative flex w-full items-center justify-center",style:{aspectRatio:cardRatio},children:picture})})});
    }
    return {
      render({images,loading}) {
        if (failure) throw failure;
        currentImages=images;currentLoading=loading;
        if(loading){openRevision++;selectedIds=new Set();selectionAnchor=null;removeDialog=null;scope.set(native.nativeSelectedIds,new Set());}
        refresh();
      },
      clearSelection,
      dispose() {disposed=true;openRevision++;document.removeEventListener("keydown",onSelectionKey);root.unmount();},
    };
  }

  function readViewer(header) {
    const props = codex.props(header, props => typeof props?.attachmentSrc === "string" && opened.has(props.attachmentSrc));
    return props ? opened.get(props.attachmentSrc) : null;
  }
  return {mount, mountNavigation, readViewer};
}
