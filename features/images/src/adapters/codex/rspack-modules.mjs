// 只按当前原生模块的角色与真实引用取值；不固定 chunk ID、导出别名或构建 hash。
export async function createRspackImageModules(registry) {
  const {module, value, binding} = registry;
  const required = (source, pattern, role) => {
    const match = source.match(pattern);
    if (!match) throw new Error(`Native Images contract changed: ${role}`);
    return match[1];
  };
  const fn = (entry, predicate, role) => value(entry, (item, source) => typeof item === 'function' && predicate(source), role);
  const bind = (entry, pattern, role) => binding(entry, required(entry.source, pattern, role));
  const ref = '[\\w$]+(?:\\.[\\w$]+)+';
  const renderRef = (props) => new RegExp(`\\.jsx\\)\\((${ref}),\\{${props}`);
  const declares = name => source => declaresRspackExport(source, name);
  const masonry = module(source => source.includes('Loading library') && source.includes('animate:'), 'image masonry');
  const React = binding(masonry, required(masonry.source, /\(0,([\w$]+)\.useRef\)/, 'React'));
  const roots = registry.entries.filter(entry => /\.createRoot=/.test(entry.source));
  const rootExports = [...new Set(roots.map(entry => registry.exports(entry)).filter(item => typeof item.createRoot === 'function'))];
  if (rootExports.length !== 1) throw new Error('Native Images React root is ambiguous');
  const [ReactDOM] = rootExports;
  if (!React.createElement || !ReactDOM?.createRoot) throw new Error('Native Images React runtime is unavailable');
  let connecting;
  async function gallery() {
    if (!connecting) connecting = (async () => {
      const toolbar = module(source => source.includes('libraryNext.selection.more'), 'selection toolbar');
      const selection = module(source => source.includes('default:e.MoveLibraryItemsDialog'), 'Library actions');
      const checkbox = module(source => source.includes('onCheckedChange:') && source.includes('viewMode:') && source.includes('cursor-interaction') && source.includes('data-library-selection'), 'image checkbox');
      const menu = module(declares('getGeneratedImageContextMenuItems'), 'image actions');
      const favorite = module(source => source.includes('target_ref:') && source.includes('showToast:'), 'Library favorite');
      const favoriteItem = module(source => source.includes('library.favorites.add') && source.includes('assets:') && source.includes('surface:"grid"'), 'favorite icon');
      const dialogs = await registry.lazy(toolbar, 'ConfirmLibraryItemsDialog');
      const move = await registry.lazy(selection, 'MoveLibraryItemsDialog');
      const iconBefore = marker => {
        const position = toolbar.source.indexOf(marker);
        if (position < 0) throw new Error('Native Library toolbar label changed');
        const prefix = toolbar.source.slice(Math.max(0, position - 700), position);
        const matches = [...prefix.matchAll(/\.jsx\)\(([\w$]+\.[\w$]+),\{\}\)/g)];
        if (!matches.length) throw new Error('Native Library toolbar icon changed');
        return React.createElement(binding(toolbar, matches.at(-1)[1]));
      };
      const favoriteAssets = favoriteItem.source.match(/assets:[\s\S]{0,80}?\?\{16:([\w$]+\.[\w$]+),20:([\w$]+\.[\w$]+)\}:\{16:([\w$]+\.[\w$]+),20:([\w$]+\.[\w$]+)\}/);
      if (!favoriteAssets) throw new Error('Native Library favorite icon changed');
      const FavoriteIcon = bind(favoriteItem, /\.jsx\)\(([\w$]+\.[\w$]+),\{icon:\{assets:/, 'favorite icon');
      const assets = favoriteAssets.slice(1).map(reference => binding(favoriteItem, reference));
      const favoriteIcon = saved => React.createElement(FavoriteIcon, {icon:{assets:{16:assets[saved?0:2],20:assets[saved?1:3]}}});
      const folderAssets = toolbar.source.match(/pageMovePending\?[\s\S]+?:\(0,[\w$]+\.jsx\)\(([\w$]+\.[\w$]+),\{icon:\{assets:\{16:([\w$]+\.[\w$]+),20:([\w$]+\.[\w$]+)/);
      if (!folderAssets) throw new Error('Native Library folder icon changed');
      const folderIcon = React.createElement(binding(toolbar, folderAssets[1]), {icon:{assets:{16:binding(toolbar, folderAssets[2]),20:binding(toolbar, folderAssets[3])}}});
      const sourceImage = module(source => source.includes('shouldLoadFileDataUrl:') && source.includes('loadTiming:') && source.includes('downloadSrc:'), 'image resolver');
      const layout = module(source => source.includes('actionIndicator:') && /documentHeader:[\w$]+,header:[\w$]+,overlayHeader:/.test(source), 'image card');
      const range = module(source => source.includes('orderedIds:') && source.includes('extendRange:') && source.length < 1000, 'range selection');
      const uploadModule = module(declares('uploadChatGptConversationFile'), 'Library upload');
      const openModule = module(declares('openImagePreview'), 'image preview');
      const toolbarClass = required(toolbar.source, /className:"(Toolbar-[\w-]+)"/, 'toolbar class');
      const toolbarPositionClass = `${required(toolbar.source, /"(Container-[\w-]+)"/, 'toolbar container')} fixed`;
      return {
        React, ReactDOM,
        Masonry:fn(masonry, source => /\{items:/.test(source) && /animate:/.test(source), 'masonry'),
        Skeleton:fn(masonry, source => source.includes('square:') && source.includes('Loading library'), 'skeleton'),
        Card:fn(layout, source => source.includes('actionIndicator:') && source.includes('documentHeader:'), 'card'),
        useImage:fn(sourceImage, source => source.includes('shouldLoadFileDataUrl:'), 'image resolver'),
        imageMenu:registry.exports(menu).getGeneratedImageContextMenuItems,
        openImage:registry.exports(openModule).openImagePreview,
        upload:registry.exports(uploadModule).uploadChatGptConversationFile,
        setFavorite:fn(favorite, source => source.includes('showToast:') && source.includes('target_ref:'), 'favorite action'),
        accountAtom:bind(favorite, /accountId:[\w$]+\.get\(([\w$]+\.[\w$]+)\)/, 'account'),
        userAtom:bind(favorite, /userId:[\w$]+\.get\(([\w$]+\.[\w$]+)\)/, 'user'),
        toastAtom:bind(menu, /get\(([\w$]+\.[\w$]+)\)\.danger\(/, 'toast'),
        routerAtom:bind(selection, /get\(([\w$]+\.[\w$]+)\)\.prepareNavigation\(/, 'router'),
        switchMode:bind(selection, /\(0,([\w$]+\.[\w$]+)\)\([\w$]+,[\w$]+\);let [\w$]+=1===/, 'mode switch'),
        createChatDraft:bind(selection, /let [\w$]+=\(0,([\w$]+\.[\w$]+)\)\([\w$]+,\[\]\)/, 'Chat draft'),
        imageFile:bind(menu, /let\{file:[\w$]+\}=\(0,([\w$]+\.[\w$]+)\)\(/, 'image file'),
        attachChatImages:bind(menu, /await\s*\(0,([\w$]+\.[\w$]+)\)\([\w$]+,[\w$]+,\[[\w$]+\],\{isTemporaryChat:/, 'Chat attachment'),
        downloadImage:bind(menu, /await\s*\(0,([\w$]+\.[\w$]+)\)\(\{downloadSrc:/, 'image download'),
        Dropdown:bind(toolbar, renderRef('surface:"opaque"'), 'dropdown'),
        Menu:bind(toolbar, /\.jsx\)\(([\w$]+\.[\w$]+)\.Item,\{/, 'menu'),
        Button:bind(toolbar, renderRef('color:"mediaSolid"'), 'button'),
        MoreIcon:bind(toolbar, /id:"libraryNext.selection.more"[\s\S]+?children:\(0,[\w$]+\.jsx\)\(([\w$]+\.[\w$]+),\{\}\)/, 'more icon'),
        ClearIcon:bind(toolbar, /id:"libraryNext.selection.clear"[\s\S]+?\.jsx\)\(([\w$]+\.[\w$]+),\{\}\)/, 'clear icon'),
        Checkbox:bind(checkbox, renderRef('className:"cursor-interaction"'), 'checkbox'),
        rangeSelection:fn(range, source => source.includes('orderedIds:'), 'range selection'),
        nativeSelectedIds:bind(toolbar, /\.set\(([\w$]+\.[\w$]+),new Set/, 'selected IDs'),
        Dialog:bind(dialogs, renderRef('open:[^,]+,showDialogClose:!1'), 'dialog'),
        DialogContent:bind(dialogs, renderRef('as:"form",onSubmit:'), 'dialog content'),
        ConfirmationContent:registry.exports(dialogs).LibraryItemConfirmationContent,
        MoveDialog:registry.exports(move).MoveLibraryItemsDialog,
        favoriteIcon, toolbarClass, toolbarPositionClass,
        chatIcon:iconBefore('id:"libraryNext.selection.chat"'),
        downloadIcon:iconBefore('id:"libraryNext.actions.download"'),
        deleteIcon:iconBefore('id:"libraryNext.actions.delete"'),
        folderIcon,
      };
    })().catch(error => {connecting=null;throw error;});
    return connecting;
  }
  async function canvas() {
    const preview = module(source => source.includes('homeComposerController:') && source.includes('prepareLocalConversationAttachments:'), 'file preview Composer');
    const references = discoverRspackPreviewBindings(preview.source);
    const composer = Object.fromEntries(Object.entries(references).map(([role, reference]) => [role, binding(preview, reference)]));
    const canvasModule = module(source => /attachmentSrc:[\w$]+,chatGptConversationId:[\w$]+,contextMenuEnabled:/.test(source) && source.includes('onImageEditSubmit:'), 'image canvas');
    const layout = module(source => source.includes('reserveImageComposerSpace:') && source.includes('contentOwnsHeader:') && /composerPresentation:[\w$]+,contentOwnsHeader:/.test(source), 'preview layout');
    const edit = module(source => source.includes('requireDispatchAcceptance:') && source.includes('sourceAttachment:') && source.includes('imageVariant'), 'image edit');
    const portalModule = module(source => source.includes('__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=') && /\.createPortal=function/.test(source), 'React portal');
    const createPortal = registry.exports(portalModule).createPortal;
    if (typeof createPortal !== 'function' || !composer.composerRouteScope?.parent) throw new Error('Native Images canvas contract changed');
    return {...composer, createPortal,
      Canvas:fn(canvasModule, source => /attachmentSrc:[\w$]+,chatGptConversationId:[\w$]+,contextMenuEnabled:/.test(source), 'image canvas'),
      CanvasLayout:fn(layout, source => source.includes('reserveImageComposerSpace:') && source.includes('contentOwnsHeader:'), 'preview layout'),
      editImage:fn(edit, source => source.includes('requireDispatchAcceptance:') && source.includes('sourceAttachment:'), 'image edit'),
    };
  }
  return {navigation:async()=>({React,ReactDOM}),gallery,canvas};
}

// 按导出声明识别模块，排除只调用该导出的消费方。rspack 具名导出有两种登记形式：
// getter `d(t,{name:()=>x})`，以及 26.1103 起出现的直接函数值 `d(t,{},{name:function…})`。
export function declaresRspackExport(source, name) {
  return new RegExp(`[{,]${name}:(?:\\(\\)=>|(?:async )?function\\b)`).test(source);
}

export function discoverRspackPreviewBindings(source) {
  const ref = '[\\w$]+\\.[\\w$]+';
  const requireMatch = (text, pattern) => {
    const match = text.match(pattern);
    if (!match) throw new Error('Native file preview Composer contract changed');
    return match[1];
  };
  const body = marker => {
    const index = source.indexOf(marker);
    if (index < 0) throw new Error('Native file preview Composer contract changed');
    const start = source.lastIndexOf('function ', index), end = source.indexOf('}function ', index);
    return source.slice(start, end < 0 ? source.length : end + 1);
  };
  const scope = body('draftId:'), home = body('homeComposerController:');
  const composer = body('lockedLayout:"single-line"'), local = body('prepareLocalConversationAttachments:');
  const alias = (text, name) => requireMatch(text, new RegExp(`\\b${name}=(${ref})(?=[,;])`));
  const scopes = [...scope.matchAll(/\.jsx\)\(([\w$]+),\{scope:([\w$]+),value:([\w$]+)/g)];
  if (scopes.length !== 2 || alias(scope, scopes[0][1]) !== alias(scope, scopes[1][1])) throw new Error('Native file preview scope providers changed');
  const controller = requireMatch(scope, /composerController:([\w$]+)/);
  const navigate = local.match(/,([\w$]+)\(\(0,([\w$]+\.[\w$]+)\)\([\w$]+\),\{state:/);
  if (!navigate) throw new Error('Native file preview navigation changed');
  return {
    useComposerController:requireMatch(scope, new RegExp(`\\b${controller}=\\(0,(${ref})\\)\\(\\)`)),
    useHomeComposer:requireMatch(home, new RegExp(`\\b[\\w$]+=\\(0,(${ref})\\)\\([\\w$]+\\),[\\w$]+=[\\w$]+\\?\\.composerProps`)),
    Composer:requireMatch(composer, new RegExp(`\\.jsx\\)\\((${ref}),\\{\\.\\.\\.[\\w$]+,ref:[\\w$]+,composerController:`)),
    ComposerSurface:requireMatch(composer, new RegExp(`\\.jsx\\)\\((${ref}),\\{placement:`)),
    ScopeProvider:alias(scope, scopes[0][1]), composerScope:alias(scope, scopes[0][2]), composerRouteScope:alias(scope, scopes[1][2]),
    createComposerValue:requireMatch(scope, new RegExp(`\\b${scopes[0][3]}=\\(0,(${ref})\\)`)),
    FileComposer:requireMatch(local, new RegExp(`\\.jsx\\)\\((${ref}),\\{\\.\\.\\.[\\w$]+,aboveComposerContent:`)),
    fileComposerAvailability:requireMatch(local, new RegExp(`composerModeAvailability:(${ref})`)),
    localAttachmentService:requireMatch(local, new RegExp(`\\(0,(${ref})\\)\\([\\w$]+,[\\w$]+\\)\\.createFileAttachment`)),
    deleteLocalAttachment:requireMatch(local, new RegExp(`\\(0,(${ref})\\)\\([\\w$]+,[\\w$]+,[\\w$]+\\.path\\)`)),
    useFileNavigate:requireMatch(local, new RegExp(`\\b${navigate[1]}=\\(0,(${ref})\\)\\(\\)`)), localThreadRoute:navigate[2],
  };
}
