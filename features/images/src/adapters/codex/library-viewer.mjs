export function createLibraryViewerAdapter(codex) {
function libraryImage(header) {
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

return {read:libraryImage};
}
