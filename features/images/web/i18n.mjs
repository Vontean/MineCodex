// 与宿主共享语言；只翻译界面文案，保留用户标题、提示词和批注原文。
let locale = "en";
export function getLocale() {
  return locale;
}
export function setLocale(value) {
  const next = String(value ?? "").toLowerCase().startsWith("zh") ? "zh-CN" : "en";
  if (next === locale) return false;
  locale = next;
  return true;
}
const zh = {
  "Images": "图片",
  "Images · Codex": "图片 · Codex",
  "Show sidebar": "显示侧边栏",
  "Refresh images": "刷新图片",
  "Image library controls": "图片库控制",
  "All images": "全部图片",
  "Filter images by source": "按来源筛选图片",
  "Grid columns": "网格列数",
  "Group images by Thread": "按任务分组图片",
  "Group by Thread": "按任务分组",
  "No images yet": "暂无图片",
  "Generate an image in any Task and it will appear here automatically.": "在任意任务中生成图片后，图片会自动显示在这里。",
  "Generated images": "生成的图片",
  "Generated image": "生成的图片",
  "Image details": "图片详情",
  "Close image details": "关闭图片详情",
  "Close": "关闭",
  "Image editor": "图片编辑器",
  "Comment": "批注",
  "Remove": "移除",
  "Resize": "调整尺寸",
  "Brush size": "画笔大小",
  "Generation prompt": "生成提示词",
  "Copy generation prompt": "复制生成提示词",
  "Copy prompt": "复制提示词",
  "Select an image to view its prompt.": "选择图片以查看生成提示词。",
  "Information": "信息",
  "Project": "项目",
  "Thread": "任务",
  "Created": "创建时间",
  "Dimensions": "尺寸",
  "File size": "文件大小",
  "Open Thread": "打开任务",
  "This Thread has been archived and can’t be opened.": "此任务已归档，无法打开。",
  "Save as": "另存为",
  "Original file": "原始文件",
  "Work": "工作任务",
  "Chat": "聊天",
  "Chats": "聊天",
  "Untitled chat": "未命名聊天",
  "Untitled task": "未命名任务",
  "Untitled work": "未命名工作任务",
  "Could not load image sources": "无法加载图片来源",
  "No images in this Thread": "此任务中暂无图片",
  "Return to the library and choose another Thread.": "返回图片库并选择其他任务。",
  "Choose another source or generate a new image in this Task.": "选择其他来源，或在此任务中生成新图片。",
  "Could not load images": "无法加载图片",
  "Could not check for new images": "无法检查新图片",
  "This ChatGPT conversation cannot be opened from Images.": "无法从图片库打开此 ChatGPT 对话。",
  "Open Thread unavailable: this Thread has been archived": "无法打开任务：此任务已归档",
  "Open conversation unavailable": "无法打开对话",
  "Original": "原始尺寸",
  "Prompt is not available for this image.": "此图片暂无生成提示词。",
  "Loading generation prompt…": "正在加载生成提示词…",
  "Could not load image details": "无法加载图片详情",
  "Prompt could not be loaded.": "无法加载提示词。",
  "Could not refresh images": "无法刷新图片",
  "Image refresh is already in progress.": "正在刷新图片。",
  "Images refreshed.": "图片已刷新。",
  "Prompt could not be copied.": "无法复制提示词。",
  "Prompt copied": "提示词已复制",
  "Copied": "已复制",
  "Prompt copied.": "提示词已复制。",
  "Saving…": "正在保存…",
  "Could not save image": "无法保存图片",
  "Saved": "已保存",
  "Image saved.": "图片已保存。",
  "Square": "正方形",
  "Portrait": "竖幅",
  "Story": "竖屏",
  "Landscape": "横幅",
  "Widescreen": "宽屏",
  "Image editing is available inside Codex only.": "请在 Codex 中使用图片编辑。",
  "Codex did not respond to the image edit request.": "Codex 未响应图片编辑请求。",
  "Codex could not start the image edit.": "Codex 无法开始图片编辑。",
  "The original image is not ready.": "原图尚未就绪。",
  "Add at least one comment before sending.": "请至少添加一条批注后再发送。",
  "Could not prepare the image edit.": "无法准备图片编辑。",
  "Click on the image to add comments": "点击图片添加批注",
  "Brush over what you want to remove": "涂抹要移除的区域",
  "Send": "发送",
  "Cancel": "取消",
  "Undo": "撤销",
  "Redo": "重做",
  "Zoom to fit": "缩放至适合大小",
  "Edit comment": "编辑批注",
  "Delete comment": "删除批注",
  "Save": "保存",
  "Add comment": "添加批注",
  "Add a comment…": "添加批注…",
  "{source} · {count} images": "{source} · {count} 张图片",
  "Open image from {source}, created {date}": "打开来自{source}的图片，创建于{date}",
  "Open {title}, {count} images": "打开{title}，共 {count} 张图片",
  "{count} image": "{count} 张图片",
  "{count} images": "{count} 张图片",
  "No images in {source}": "{source}中暂无图片",
  "{count} comment": "{count} 条批注",
  "{count} comments": "{count} 条批注",
  "Edit comment {number}": "编辑批注 {number}"
};
export function t(message, values = {}) {
  const translated = locale === "zh-CN" ? zh[message] ?? message : message;
  return translated.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}
export function translateDocument(document) {
  document.documentElement.lang = locale;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const attribute of ["aria-label", "title", "placeholder"]) {
    for (const element of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
    }
  }
}
