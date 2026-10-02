export function createLibraryViewerAdapter(codex, imageSource = null) {
function libraryImage(header) {
  const local=imageSource?.readViewer(header);
  if(local)return {kind:"local",id:local.id,threadId:local.threadId,itemId:local.imageGenerationItemId};
  let fiber = codex.currentFiber(header);
  let selected = null;
  for (let depth = 0; fiber && depth < 80; depth++, fiber = fiber.return) {
    const file = fiber.memoizedProps?.file;
    if (!file || !/^libfile_[\w-]+$/.test(file.id ?? "") || !file.mime_type?.startsWith("image/")) continue;
    if (selected && selected.id !== file.id) break;
    selected = file;
    if (file.origination_thread_id && file.origination_message_id) break;
  }
  if (!selected) return null;
  // 只保留关联字段，签名下载地址和图片数据不进入插件。
  return Object.fromEntries(["id", "file_id", "current_version_number", "origination_thread_id", "origination_message_id"].map(key => [key, selected[key]]));
}

function toolbar(header) {
  // 原生缩放菜单含隐藏的尺寸测量文字，只读取实际显示的百分比。
  const zoom = [...header.querySelectorAll('button[aria-haspopup="menu"]')]
    .find(button => /^\d+(?:\.\d+)?%$/.test(button.innerText.trim()));
  const group = zoom?.parentElement?.parentElement;
  // Space 的嵌入式图片视口与浮层是原生两种承载方式。
  const host = header.closest('.relative.flex.h-full.min-w-0.flex-1') ?? header.closest('[role="presentation"]');
  const trigger = header.querySelector('[data-viewer-header-collapsible]')?.closest("button");
  return zoom && group && host && trigger ? {zoom,group,host,trigger} : null;
}
function promptMenu(file) {
  if(file.kind === "local") return null;
  for (const menu of document.querySelectorAll('[role="menu"][data-state="open"]')) {
    if (!menu.getBoundingClientRect().width || libraryImage(menu)?.id !== file.id) continue;
    const original = [...menu.querySelectorAll('a[role="menuitem"][href]')].find(item => {
      const url = new URL(item.getAttribute("href"), location.href);
      return url.pathname === `/c/${file.origination_thread_id}` && url.searchParams.get("messageId") === file.origination_message_id;
    });
    if (original) return {menu,original};
  }
  return null;
}
return {read:libraryImage,toolbar,promptMenu};
}
