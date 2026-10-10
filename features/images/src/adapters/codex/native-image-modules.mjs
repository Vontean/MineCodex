// 以调用位置和参数结构识别角色，不绑定压缩后的局部变量名。
export function discoverImageActionBinding(source, role) {
  const patterns = {
    switchMode: /([\w$]+)\([\w$]+,[\w$]+\);let [\w$]+=[\w$]+\.length===1/,
    attachChatImages: /await ([\w$]+)\([\w$]+,[\w$]+,\[[\w$]+\],\{isTemporaryChat:/,
  };
  const match = source.match(patterns[role]);
  if (!match) throw new Error(`Native Images action contract changed: ${role}`);
  return match[1];
}

// 按文件预览的调用关系读取角色，不依赖构建时分配的短变量名。
export function discoverFilePreviewComposerBindings(source) {
  const starts = [...source.matchAll(/function [\w$]+\(/g)].map(match => match.index);
  const bodies = starts.map((start,index) => source.slice(start,starts[index+1] ?? source.length));
  const requireBody = marker => {
    const found=bodies.filter(body=>marker.test(body));
    if(found.length!==1)throw new Error("Native file preview Composer contract changed");
    return found[0];
  };
  const scopeBody=requireBody(/draftId:[\w$]+,(?:imageSrc|imageDataUrl):/);
  const homeBody=requireBody(/homeComposerController:[\w$]+,homeComposerMode:/);
  const composerBody=requireBody(/lockedLayout:`single-line`/);
  const localBody=requireBody(/prepareLocalConversationAttachments:/);
  const alias=(body,local,call=false)=>{
    const escaped=local?.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const value=escaped&&body.match(new RegExp(`(?:[,;]|let )${escaped}=([\\w$]+)${call?"\\(":"(?=[,;])"}`))?.[1];
    if(!value)throw new Error("Native file preview Composer role changed");
    return value;
  };
  const controller=scopeBody.match(/composerController:([\w$]+)/)?.[1];
  const scopes=[...scopeBody.matchAll(/jsx\)\(([\w$]+),\{scope:([\w$]+),value:([\w$]+)/g)];
  if(scopes.length!==2)throw new Error("Native file preview Composer scopes changed");
  const scopeProvider=alias(scopeBody,scopes[0][1]);
  if(scopeProvider!==alias(scopeBody,scopes[1][1]))throw new Error("Native file preview Composer providers changed");
  const roles={
    useComposerController:alias(scopeBody,controller,true),
    useHomeComposer:homeBody.match(/let [\w$]+=([\w$]+)\([\w$]+\),[\w$]+=[\w$]+\?\.composerProps/)?.[1],
    Composer:composerBody.match(/jsx\)\(([\w$]+),\{\.\.\.[\w$]+,[^;]+?lockedLayout:`single-line`/)?.[1],
    ComposerSurface:composerBody.match(/jsx\)\(([\w$]+),\{placement:/)?.[1],
    ScopeProvider:scopeProvider,
    composerScope:alias(scopeBody,scopes[0][2]),
    createComposerValue:alias(scopeBody,scopes[0][3],true),
    composerRouteScope:alias(scopeBody,scopes[1][2]),
    FileComposer:localBody.match(/jsx\)\(([\w$]+),\{\.\.\.[\w$]+,aboveComposerContent:/)?.[1],
    fileComposerAvailability:localBody.match(/composerModeAvailability:([\w$]+)/)?.[1],
    localAttachmentService:localBody.match(/await ([\w$]+)\([\w$]+,[\w$]+\)\.createFileAttachment/)?.[1],
    deleteLocalAttachment:localBody.match(/aborted&&\(([\w$]+)\(/)?.[1],
    useFileNavigate:alias(localBody,localBody.match(/([\w$]+)\(([\w$]+)\([\w$]+\),\{state:/)?.[1],true),
    localThreadRoute:localBody.match(/[\w$]+\(([\w$]+)\([\w$]+\),\{state:/)?.[1],
  };
  if(Object.values(roles).some(value=>!value))throw new Error("Native file preview Composer role changed");
  return roles;
}

// 构建产物发现只返回当前能力；原生组件呈现不参与引用解析。
export function createNativeImageModules({read = async url => (await fetch(url)).text(), load = url => import(url)} = {}) {
  let starting, connecting, canvasConnecting;
  function imported(source, local) {
    for (const match of source.matchAll(/import\{([^}]+)\}from["']([^"']+)["']/g)) {
      for (const binding of match[1].split(",")) {
        const parts = binding.trim().split(/\s+as\s+/);
        if (parts.at(-1) === local) return { name: parts[0], file: match[2] };
      }
    }
    throw new Error(`Native Images import contract changed: ${local}`);
  }

  async function bootstrap() {
    if (!starting) starting = (async () => {
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
      const masonry = await module("library-masonry");
      const rootOwner = mainSource.match(/\(0,([\w$]+)\.createRoot\)/)?.[1];
      const rootInit = rootOwner && mainSource.match(new RegExp(`${rootOwner}=([\\w$]+)\\(\\)`))?.[1];
      const reactOwner = masonry.source.match(/([\w$]+)\.useRef\b/)?.[1];
      const reactInit = reactOwner && masonry.source.match(new RegExp(`${reactOwner}=([\\w$]+)\\(\\)`))?.[1];
      const [reactFactory, rootFactory] = await Promise.all([
        binding(masonry.source, masonry.url, reactInit), binding(mainSource, mainUrl, rootInit),
      ]);
      const React = reactFactory(), ReactDOM = rootFactory();
      const initial = await load(initialUrl);
      return {React,ReactDOM,module,component,binding,initialUrl,initialSource,initial};
    })().catch(error=>{starting=null;throw error;});
    return starting;
  }

  async function gallery() {
    if (!connecting) connecting = (async () => {
      const {React,ReactDOM,module,component,binding,initialUrl,initialSource,initial}=await bootstrap();
      const [masonry,layout,sourceImage,menu,toolbar]=await Promise.all([
        module("library-masonry"),module("library-item-layout"),module("generated-image-source"),
        module("generated-image-context-menu"),module("library-selection-toolbar"),
      ]);
      // 26.1007 将选择状态与图库动作移到 selectable-library-item；工具栏保留按钮与材质。
      const selection=await module("selectable-library-item",toolbar.source);
      const [moveDialog,dialogs]=await Promise.all([module("library-move-dialog",selection.source),module("library-item-dialogs",toolbar.source)]);
      const routerLocal = selection.source.match(/get\(([\w$]+)\)\.prepareNavigation\(/)?.[1];
      const routerAtom = await binding(selection.source, selection.url, routerLocal);
      const switchLocal = discoverImageActionBinding(selection.source, "switchMode");
      const switchMode = await binding(selection.source, selection.url, switchLocal);
      const draftLocal = selection.source.match(/let [\w$]+=([\w$]+)\([\w$]+,\[\]\);[\w$]+\.set/)?.[1];
      const createChatDraft = await binding(selection.source, selection.url, draftLocal);
      const dropdownLocal = selection.source.match(/\(0,[\w$]+\.jsxs?\)\(([\w$]+),\{contentWidth:`menu`/)?.[1];
      const itemsLocal = selection.source.match(/\(0,[\w$]+\.jsxs?\)\(([\w$]+)\.Item,\{/)?.[1];
      const buttonLocal = toolbar.source.match(/jsx\)\(([\w$]+),\{color:`mediaSolid`/)?.[1];
      const iconLocal = toolbar.source.match(/id:`libraryNext.selection.more`[^;]+?children:\(0,[\w$]+\.jsx\)\(([\w$]+),\{\}\)/)?.[1];
      const [Dropdown, Menu] = await Promise.all([dropdownLocal, itemsLocal].map(local => binding(selection.source, selection.url, local)));
      const [Button, MoreIcon] = await Promise.all([buttonLocal, iconLocal].map(local => binding(toolbar.source, toolbar.url, local)));
      const checkboxFunction = component(selection.exports,source=>/onCheckedChange:/.test(source)&&/viewMode:/.test(source),"selection checkbox");
      const checkboxLocal = String(checkboxFunction).match(/jsx\)\(([\w$]+),\{className:`cursor-interaction`,/)?.[1];
      const Checkbox = await binding(selection.source,selection.url,checkboxLocal);
      const rangeSelection = component(selection.exports,source=>/^function [\w$]+\(\{orderedIds:/.test(source)&&/extendRange:/.test(source),"range selection");
      const selectionLocal = toolbar.source.match(/\.set\(([\w$]+),new Set[,)]/)?.[1];
      const nativeSelectedIds = await binding(toolbar.source,toolbar.url,selectionLocal);
      const clearPrefix = toolbar.source.slice(toolbar.source.indexOf("id:`libraryNext.selection.clear`"));
      const clearLocal = clearPrefix.match(/\(0,[\w$]+\.jsx\)\(([\w$]+),\{\}\)/)?.[1];
      const ClearIcon = await binding(toolbar.source,toolbar.url,clearLocal);
      const dialogLocal = dialogs.source.match(/\(0,[\w$]+\.jsx\)\(([\w$]+),\{open:[^,]+,showDialogClose:!1/)?.[1];
      const contentLocal = dialogs.source.match(/\(0,[\w$]+\.jsx\)\(([\w$]+),\{as:`form`,onSubmit:/)?.[1];
      const [Dialog,DialogContent] = await Promise.all([dialogLocal,contentLocal].map(local=>binding(dialogs.source,dialogs.url,local)));
      const menuCoreFile = menu.source.match(/from["']([^"']*generated-image-context-menu-[^"']+)["']/)?.[1];
      const menuCoreUrl = menuCoreFile ? new URL(menuCoreFile,menu.url).href : menu.url;
      const menuCoreSource = menuCoreFile ? await read(menuCoreUrl) : menu.source;
      const imageActions = component(menu.exports,source=>/onOpenedInNewTab:/.test(source),"image actions");
      const imageActionSource = String(imageActions);
      const imageFileLocal = imageActionSource.match(/let\{file:[\w$]+\}=([\w$]+)\(/)?.[1];
      const attachLocal = discoverImageActionBinding(imageActionSource, "attachChatImages");
      const downloadLocal = imageActionSource.match(/await ([\w$]+)\(\{downloadSrc:/)?.[1];
      const [imageFile,attachChatImages,downloadImage] = await Promise.all([imageFileLocal,attachLocal,downloadLocal].map(local=>binding(menuCoreSource,menuCoreUrl,local)));
      const toolbarClass = toolbar.source.match(/=\`(_Toolbar_[^`]+)\`/)?.[1];
      const toolbarContainer = toolbar.source.match(/=\`(_Container_[^`]+)\`/)?.[1];
      const toolbarPositionClass = toolbarContainer && `${toolbarContainer} fixed`;
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
      const chatLocal = toolbar.source.match(/children:[\w$]+\?[^;]+?:\(0,[\w$]+\.jsxs\)\([\w$]+\.Fragment,\{children:\[\(0,[\w$]+\.jsx\)\(([\w$]+),\{\}\),\(0,[\w$]+\.jsx\)\([\w$]+,\{id:`libraryNext.selection.chat`/)?.[1];
      const ChatIcon = await binding(toolbar.source,toolbar.url,chatLocal);
      const chatIcon = React.createElement(ChatIcon,{});
      const [downloadIcon, folderIcon, deleteIcon] = await Promise.all([
        libraryIcon("Download"), libraryIcon("Move to folder"), libraryIcon("{kind, select, directory {Delete folder} other {Delete}}"),
      ]);
      if (!React.createElement || !ReactDOM.createRoot || !Menu.Item) throw new Error("Native Images rendering contract changed");
      return {
        React, ReactDOM, Dropdown, Menu, Button, MoreIcon, chatIcon, downloadIcon, folderIcon, favoriteIcon, routerAtom, switchMode, createChatDraft, upload, setFavorite, toastAtom, accountAtom, userAtom,
        MoveDialog:moveDialog.exports.MoveLibraryItemsDialog,
        Checkbox,rangeSelection,nativeSelectedIds,ClearIcon,Dialog,DialogContent,ConfirmationContent:dialogs.exports.LibraryItemConfirmationContent,
        imageFile,attachChatImages,downloadImage,toolbarClass,toolbarPositionClass,deleteIcon,
        Masonry: component(masonry.exports, source => /\{items:[^}]+animate:/.test(source), "masonry"),
        Skeleton: component(masonry.exports, source => /square:/.test(source) && /Loading library/.test(source), "skeleton"),
        Card: component(layout.exports, source => /actionIndicator:/.test(source) && /documentHeader:/.test(source), "card"),
        useImage: component(sourceImage.exports, source => /shouldLoadFileDataUrl:/.test(source), "image resolver"),
        imageMenu: component(menu.exports, source => /onOpenedInNewTab:/.test(source), "image actions"),
        openImage: component(initial, source => /availableImageCount:/.test(source) && /openInEditor:/.test(source) && /entrypoint:/.test(source), "image preview"),
      };
    })().catch(error=>{connecting=null;throw error;});
    return connecting;
  }

  async function canvas() {
    if (!canvasConnecting) canvasConnecting = (async () => {
      const {module,binding,component,initial}=await bootstrap();
      const [canvas,canvasLayout,filePreview]=await Promise.all([
        module("image-side-panel"),module("preview-layout"),module("library-cloud-file-preview"),
      ]);
      const portalOwner=canvas.source.match(/\(0,([\w$]+)\.createPortal\)/)?.[1];
      const portalInit=portalOwner&&canvas.source.match(new RegExp(`${portalOwner}=([\\w$]+)\\(\\)`))?.[1];
      const createPortal=(await binding(canvas.source,canvas.url,portalInit))().createPortal;
      // 文件画布使用原生 Home Composer 的控制器、附件 scope 和输入组件。
      const composerLocals=Object.values(discoverFilePreviewComposerBindings(filePreview.source));
      const [useComposerController,useHomeComposer,Composer,ComposerSurface,ScopeProvider,composerScope,createComposerValue,composerRouteScope,FileComposer,fileComposerAvailability,localAttachmentService,deleteLocalAttachment,useFileNavigate,localThreadRoute] = await Promise.all(composerLocals.map(local=>binding(filePreview.source,filePreview.url,local)));
      if (!canvas.exports.t || !canvasLayout.exports.r || !Composer || !ComposerSurface || !ScopeProvider
        || !composerScope || !composerRouteScope?.parent
        || !FileComposer || !fileComposerAvailability
        || [createPortal,useComposerController,useHomeComposer,createComposerValue,localAttachmentService,deleteLocalAttachment,useFileNavigate,localThreadRoute].some(value=>typeof value!=="function")) {
        throw new Error("Native Images canvas contract changed");
      }
      return {
        createPortal,Canvas:canvas.exports.t,CanvasLayout:canvasLayout.exports.r,
        useComposerController,useHomeComposer,Composer,ComposerSurface,ScopeProvider,composerScope,createComposerValue,composerRouteScope,
        FileComposer,fileComposerAvailability,localAttachmentService,deleteLocalAttachment,useFileNavigate,localThreadRoute,
        editImage:component(initial,source=>/async function/.test(source)&&/requireDispatchAcceptance:/.test(source)&&/sourceAttachment:/.test(source)&&/imageVariant/.test(source),"image edit submission"),
      };
    })().catch(error=>{canvasConnecting=null;throw error;});
    return canvasConnecting;
  }
  return {navigation:async()=>{const {React,ReactDOM}=await bootstrap();return {React,ReactDOM};},gallery,canvas};
}
