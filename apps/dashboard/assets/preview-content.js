// 稳定 feature ID 对应功能说明；演示资源与实时状态分开维护。
const content = {
  'model-slider': [
    ['输入框的模型选择区域。', '模型与思考档位分散，切换不够直接。', '打开模型窗口，选择模型与思考档位；收藏常用模型以便再次选择。'],
    ['The model selector beside the composer.', 'Switching models and reasoning levels takes extra steps.', 'Open the model panel, choose a model and reasoning level, and save favorites for quick access.']],
  notes: [
    ['官方 Prompt 页面与输入框旁的 Quick Prompts。', '常用提示词需要反复查找和复制。', '按分类管理提示词，从 Quick Prompts 填入当前输入框；填入后由你检查并发送。'],
    ['The Prompt page and Quick Prompts beside the composer.', 'Reusable prompts are hard to find and copy repeatedly.', 'Organize prompts by category and insert one into the current composer. Review it before sending.']],
  'usage-meter': [
    ['Codex 侧栏的额度环。', '查看剩余额度需要打开账号菜单。', '用额度环查看使用比例，点击打开用量详情。'],
    ['The usage ring in the Codex sidebar.', 'Checking remaining usage requires opening the account menu.', 'Read usage at a glance, then click for usage details.']],
  'session-status': [
    ['当前会话的状态区域。', '会话用量与生成速度不容易集中查看。', '查看当前会话的用量、上下文和生成指标；可用项目取决于会话与提供方。'],
    ['The current conversation’s status area.', 'Usage and generation metrics are spread across the interface.', 'Read session usage, context and generation metrics when supported by the session and provider.']],
  'markdown-reading': [
    ['Codex 的 Markdown 文件预览。', '长文阅读、脚注跳转和表格查看不够方便。', '在文件预览中阅读增强排版，使用目录、脚注和表格操作。'],
    ['Markdown file previews in Codex.', 'Long documents, footnotes and tables take extra effort to read.', 'Read enhanced formatting and use the outline, footnote navigation and table actions.']],
  'mermaid-diagrams': [
    ['Markdown 文件预览中的 Mermaid 图表。', '实验性图表样式与交互仍在完善，默认关闭。', '按需开启图表增强，使用缩放和 PNG 下载；关闭后使用 Codex 原生图表。'],
    ['Mermaid diagrams in Markdown file previews.', 'Enhanced diagram styles and interactions are experimental and off by default.', 'Opt in to diagram zoom and PNG download. Turn it off to use native Codex diagrams.']],
  'file-navigation': [
    ['Codex 文件预览上方的路径区域。', '浏览相邻目录和文件需要额外跳转。', '点击路径展开分列目录，逐级浏览并打开另一个文件。'],
    ['The path above a file preview in Codex.', 'Browsing nearby files and folders takes extra navigation.', 'Open the path to browse cascading folder columns and choose another file.']],
  images: [
    ['Codex Library 的图片集合与图片查看器。', '查找图片及其提示词需要来回切换。', '浏览图片集合，打开图片查看大图及可追溯的提示词信息。'],
    ['Image collections in Codex Library and the image viewer.', 'Finding images and their prompts requires switching views.', 'Browse collections, open an image, and inspect available prompt provenance.']],
  sites: [
    ['Codex 中的 Sites 页面。', '本地项目与常用网址分散在不同位置。', '收藏网址、发现正在运行的本地站点，并从 Sites 打开。'],
    ['The Sites page in Codex.', 'Local projects and saved links are scattered.', 'Save URLs, discover running local sites, and open them from Sites.']],
  'quick-chat': [
    ['Codex 的浮动 Quick Chat 窗口。', '临时提问时需要切换主窗口，历史不易继续。', '从侧栏或快捷键打开 Quick Chat，发送后展开，恢复最小化输入框并查看历史。'],
    ['The floating Quick Chat window.', 'Quick questions and continuing recent chats require window switching.', 'Open Quick Chat from the sidebar or shortcut, expand after sending, restore a minimized composer and browse history.']],
  'sidebar-focus': [
    ['Codex 左侧栏的分组标题。', '多个侧栏分组展开时，当前分组不容易聚焦。', '点击当前分组，一键收起其他分组；再次点击恢复先前的展开状态。'],
    ['Group headings in the Codex sidebar.', 'Several expanded groups make the current group harder to focus on.', 'Click a group to collapse other groups. Click again to restore their previous expanded state.']],
  'hide-upsell-banner': [
    ['Codex 的额度推广提示区域。', '推广提示占用日常操作空间。', '隐藏额度推广提示，保留真实额度与运行错误反馈。'],
    ['Usage promotion banners in Codex.', 'Promotions take space during everyday tasks.', 'Hide usage promotions while retaining real usage and error feedback.']],
};
export function previewContent(id, locale) {
  return content[id]?.[locale === 'zh-CN' ? 0 : 1] ?? (locale === 'zh-CN'
    ? ['Codex 中对应功能的位置。', '请参考功能说明。', '效果取决于当前版本与适用页面。']
    : ['The feature’s location in Codex.', 'Refer to the feature description.', 'Availability depends on the version and current page.']);
}
