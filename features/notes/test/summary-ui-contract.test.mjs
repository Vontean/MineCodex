import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lucideIconPath = (name) => path.join(projectRoot, "assets", "icons", `${name}.svg`);

test("Summary follows the native fixed-limit, continuous-scroller contract", async () => {
  const [app, styles] = await Promise.all([
    readFile(path.join(projectRoot, "web/app.js"), "utf8"),
    readFile(path.join(projectRoot, "web/styles.css"), "utf8"),
  ]);

  assert.match(app, /const SUMMARY_ITEM_LIMIT = 5/);
  assert.match(app, /items\.slice\(0, SUMMARY_ITEM_LIMIT\)/);
  assert.match(app, /totalCount > SUMMARY_ITEM_LIMIT/);
  assert.match(app, /hasOverflow \? `<button[^`]*class="view-all"/s);
  assert.match(app, /data-summary-scroll/);
  assert.match(app, /codex-personal:surface-metrics/);
  assert.doesNotMatch(app, /allocateSummaryRows|summaryCapacity|summaryHeight/);

  assert.match(styles, /\.summary-scroll\s*\{[^}]*overflow-y: auto/s);
  assert.match(styles, /\.summary-section\s*\{[^}]*flex: 0 0 auto/s);
  assert.match(styles, /\.summary-section:not\(:last-child\)::after/);
  assert.match(styles, /--codex-summary-section-title-font-size/);
  assert.match(styles, /--codex-summary-section-title-font-weight/);
  assert.match(styles, /--codex-summary-row-font-size/);
  assert.match(styles, /\.row-primary\s*\{[^}]*padding: 0[^}]*--codex-summary-label-font-size[^}]*--codex-summary-label-line-height/s);
  assert.match(styles, /\.empty-row\s*\{[^}]*color: var\(--notes-text\)[^}]*--codex-summary-label-font-size/s);
  assert.match(styles, /\.view-all\s*\{[^}]*--color-token-conversation-summary-trailing/s);
  assert.match(styles, /--codex-summary-icon-size/);
  assert.match(styles, /--codex-summary-row-radius/);
  assert.match(styles, /\.summary-section > \.flat-list\s*\{[^}]*margin-top: 2px/s);
  assert.match(styles, /\.row\s*\{[^}]*isolation: isolate[^}]*padding: 4px 0/s);
  assert.match(styles, /\.row::before\s*\{[^}]*inset: 0 -8px[^}]*z-index: -1/s);
  assert.match(styles, /\.row:hover::before,[\s\S]*?\.row:has\(:focus-visible\)::before,[\s\S]*?\.prompt-row:has\(\.row-menu\[open\]\)::before\s*\{[^}]*var\(--notes-hover\)/s);
  assert.doesNotMatch(styles, /\.row:focus-within::before/);
  assert.match(styles, /\.row:hover \.row-actions,[\s\S]*?\.row:has\(:focus-visible\) \.row-actions,[\s\S]*?\.prompt-row:has\(\.row-menu\[open\]\) \.row-actions\s*\{[^}]*opacity: 1[^}]*pointer-events: auto/s);
  assert.doesNotMatch(styles, /\.row:focus-within \.row-actions/);
  assert.match(styles, /\.check-control\s*\{[^}]*margin-right: 8px/s);
  assert.match(styles, /\.todo-check-icon\s*\{[^}]*width: var\(--codex-summary-todo-unchecked-size, 16px\)[^}]*height: var\(--codex-summary-todo-unchecked-size, 16px\)/s);
  assert.match(styles, /\.check-control input:checked \+ \.todo-check-icon\s*\{[^}]*width: var\(--codex-summary-icon-size, 18px\)[^}]*height: var\(--codex-summary-icon-size, 18px\)/s);
  assert.match(styles, /\.summary-leading\s*\{[^}]*margin-right: 8px/s);
  assert.doesNotMatch(styles, /--section-rows/);
});

test("Injected Notes documents select the requested detail or editor surface from their canonical base URL", async () => {
  const app = await readFile(path.join(projectRoot, "web/app.js"), "utf8");

  assert.match(app, /const params = new URL\(document\.baseURI\)\.searchParams/);
  assert.doesNotMatch(app, /new URLSearchParams\((?:window\.)?location\.search\)/);
  assert.match(app, /else if \(surface === "todo"\) app\.innerHTML = renderTodoPage\(\)/);
  assert.match(app, /else if \(surface === "prompts"\) app\.innerHTML = renderPromptsPage\(\)/);
  assert.match(app, /else if \(surface === "files"\) app\.innerHTML = renderFilesPage\(\)/);
  assert.match(app, /class="full-shell todo-page"/);
  assert.match(app, /class="full-shell prompts-page"/);
  assert.match(app, /class="full-shell files-page"/);
});

test("Todo Summary fills its five-row capacity with completed items after active items", async () => {
  const [app, styles] = await Promise.all([
    readFile(path.join(projectRoot, "web/app.js"), "utf8"),
    readFile(path.join(projectRoot, "web/styles.css"), "utf8"),
  ]);

  assert.match(app, /const completed = ui\.state\.todos\.completed/);
  assert.match(app, /const visibleTodos = active\.length >= SUMMARY_ITEM_LIMIT[\s\S]*?active\.slice\(0, SUMMARY_ITEM_LIMIT\)[\s\S]*?\.\.\.completed\.slice\(0, SUMMARY_ITEM_LIMIT - active\.length\)/s);
  assert.match(app, /items: visibleTodos,[\s\S]*?totalCount: active\.length \+ completed\.length/s);
  assert.match(app, /completed: Boolean\(item\.completedAt\)/);
  assert.match(app, /draggable: !item\.completedAt/);
  assert.match(app, /completed \? " is-completed" : ""/);
  assert.match(app, /completed \? "checked" : ""/);
  assert.match(app, /const toggleLabel = completed \? t\("restoreTodo"\) : t\("completeTodo"\)/);
  assert.match(app, /<input type="checkbox" data-action="toggle-todo"[^>]*aria-label="\$\{escapeHtml\(toggleLabel\)\}"/);
  assert.match(app, /<span class="row-primary todo-label">\$\{escapeHtml\(todo\.body\)\}<\/span>/);
  assert.doesNotMatch(app, /toggle-todo-row/);
  assert.match(app, /actionButton\("edit-todo", t\("edit"\), \{ quiet: true \}\)[\s\S]*?actionButton\("delete-todo", t\("delete"\), \{ quiet: true \}\)/s);
  assert.match(app, /if \(target\.dataset\.action !== "toggle-todo"\) return;[\s\S]*?completed: target\.checked/s);
  assert.match(styles, /\.is-completed \.todo-label\s*\{[^}]*color: var\(--notes-text-tertiary\)[^}]*text-decoration: line-through/s);
});

test("Todo full view uses native section headings and compact section actions", async () => {
  const [app, styles] = await Promise.all([
    readFile(path.join(projectRoot, "web/app.js"), "utf8"),
    readFile(path.join(projectRoot, "web/styles.css"), "utf8"),
  ]);

  assert.doesNotMatch(app, /Available across every Project, Thread, and Codex window/);
  assert.doesNotMatch(app, /pageHeader\("Todo"/);
  assert.match(app, /class="full-shell todo-page"/);
  assert.match(app, /pageSectionTitle\(t\("active"\), active\.length, pageActionButton\("add-todo", t\("add"\), "plus"\)\)/);
  assert.match(app, /pageSectionTitle\([\s\S]*?t\("completed"\),[\s\S]*?completed\.length,[\s\S]*?pageActionButton\("clear-completed", t\("deleteAll"\), "trash-2", t\("deleteCompletedTitle"\)\)/s);
  assert.match(app, /function pageSectionTitle\(title, count, action = ""\)[\s\S]*?class="page-section-heading"[\s\S]*?class="page-section-count"/s);
  assert.match(styles, /\.page-section-heading\s*\{[^}]*gap: 12px/s);
  assert.match(styles, /\.page-section-title h2\s*\{[^}]*color: inherit[^}]*font: inherit/s);
  assert.match(styles, /\.page-action\s*\{[^}]*gap: 4px[^}]*padding-inline: 8px[^}]*background: var\(--notes-hover\)/s);
  assert.match(styles, /\.icon\.page-action-icon\s*\{[^}]*width: 16px[^}]*height: 16px/s);
  assert.match(styles, /\.full-shell\s*\{[^}]*width: 100%[^}]*padding: 22px 16px 64px/s);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*?\.full-shell\s*\{[^}]*padding: 16px 16px 48px/s);
  assert.match(styles, /\.page-section-title\s*\{[^}]*padding: 0 0 8px/s);
  assert.match(styles, /\.row-actions \.quiet-button\s*\{[^}]*border-radius: var\(--codex-summary-control-radius, var\(--radius-md, 10px\)\)/s);
});

test("Todo drag reordering mirrors the native Codex drop indicator and explicit placement", async () => {
  const [app, styles] = await Promise.all([
    readFile(path.join(projectRoot, "web/app.js"), "utf8"),
    readFile(path.join(projectRoot, "web/styles.css"), "utf8"),
  ]);

  assert.match(app, /class="todo-drop-indicator" aria-hidden="true" role="presentation"/);
  assert.match(app, /function todoDropPosition\(event, row\)[\s\S]*?event\.clientY < rect\.top \+ rect\.height \/ 2 \? "before" : "after"/s);
  assert.match(app, /function setTodoDropTarget\(row, position\)[\s\S]*?const previous = app\.querySelector\("\.todo-row\[data-drop-position\]"\)[\s\S]*?delete previous\.dataset\.dropPosition[\s\S]*?row\.dataset\.dropPosition = position/s);
  assert.doesNotMatch(app, /querySelectorAll\('\.todo-row\[draggable="true"\]'\)/);
  assert.match(app, /function reorderedTodoIds\(ids, draggedId, targetId, position\)[\s\S]*?targetIndex \+ \(position === "after" \? 1 : 0\)/s);
  assert.match(app, /function dragLeavesApp\(event\)[\s\S]*?app\.contains\(event\.relatedTarget\)[\s\S]*?event\.clientY >= rect\.bottom/s);
  assert.match(app, /function clearTodoDragPreview\(\)[\s\S]*?ui\.todoDragPreview\?\.remove\(\)[\s\S]*?ui\.todoDragPreview = null/s);
  assert.match(app, /function moveTodoDragPreview\(event\)[\s\S]*?event\.clientX - offsetX[\s\S]*?event\.clientY - offsetY/s);
  assert.match(app, /function setTodoDragPreview\(row, event\)[\s\S]*?document\.createElement\("div"\)[\s\S]*?row\.cloneNode\(true\)[\s\S]*?const width = rect\.width[\s\S]*?preview\.style\.left = `\$\{rect\.left\}px`[\s\S]*?preview\.append\(content\)[\s\S]*?document\.createElement\("canvas"\)[\s\S]*?event\.dataTransfer\.setDragImage\(dragImage, 0, 0\)[\s\S]*?requestAnimationFrame\(\(\) => dragImage\.remove\(\)\)/s);
  assert.match(app, /function clearTodoDraggingState\(\)[\s\S]*?ui\.draggingTodo = null/s);
  const dragStartHandler = app.match(/app\.addEventListener\("dragstart",[\s\S]*?\n\}\);/)?.[0] ?? "";
  assert.match(dragStartHandler, /setTodoDragPreview\(row, event\)[\s\S]*?row\.classList\.add\("is-dragging"\)/s);
  assert.doesNotMatch(dragStartHandler, /row\.inert\s*=/);
  assert.match(app, /const position = target\?\.dataset\.dropPosition \?\? ui\.todoDropTarget\?\.position/);
  assert.match(app, /reorderedTodoIds\(currentIds, draggedId, targetId, position\)/);
  assert.match(styles, /\*,\s*\*::before,\s*\*::after\s*\{[^}]*box-sizing: border-box/s);
  assert.match(styles, /\.row\.is-dragging\s*\{[^}]*opacity: 0\.2/s);
  assert.match(styles, /\.todo-drag-preview\s*\{[^}]*z-index: 4[^}]*width: var\(--todo-drag-preview-width\)[^}]*height: 31px[^}]*border: 1px solid var\(--color-token-border, var\(--notes-border\)\)[^}]*border-radius: var\(--radius-lg, 12\.5px\)[^}]*background: var\(--color-token-bg-primary, #f7f7f7\)[^}]*box-shadow: var\(--shadow-lg, 0 4px 8px -2px #0000001a\)[^}]*opacity: 0\.7[^}]*pointer-events: none/s);
  assert.match(styles, /\.todo-drag-preview-content\s*\{[^}]*height: 29px[^}]*padding: 0 8px[^}]*border-radius: 0[^}]*opacity: 1/s);
  assert.match(styles, /--todo-drop-indicator-color: var\(--color-token-text-link-foreground, var\(--color-text-accent, var\(--notes-accent\)\)\)/);
  assert.match(styles, /\.todo-drop-indicator::before\s*\{[^}]*top: -1px[^}]*right: 8px[^}]*left: 8px[^}]*height: 2px[^}]*border-radius: 999px/s);
  assert.match(styles, /\.todo-drop-indicator::after\s*\{[^}]*top: -4px[^}]*left: 4px[^}]*width: 8px[^}]*height: 8px[^}]*border: 2px solid var\(--todo-drop-indicator-color\)[^}]*border-radius: 50%/s);
});

test("Summary controls use shipped icon assets and native Codex silhouettes", async () => {
  const [
    app,
    styles,
    server,
    codexPlus,
    codexViewAll,
    codexTask,
    codexFile,
    codexDocument,
    codexImage,
    codexAttachment,
    codexPencil,
    lucideTrash2,
    lucideExternalLink,
    lucideListTodo,
    lucideMessageSquareQuote,
    lucideStickyNote,
    lucideStar,
    featureManifest,
  ] = await Promise.all([
    readFile(path.join(projectRoot, "web/app.js"), "utf8"),
    readFile(path.join(projectRoot, "web/styles.css"), "utf8"),
    readFile(path.join(projectRoot, "src/http-server.mjs"), "utf8"),
    readFile(path.join(projectRoot, "web/codex-plus.svg"), "utf8"),
    readFile(path.join(projectRoot, "web/codex-view-all.svg"), "utf8"),
    readFile(path.join(projectRoot, "web/codex-task.svg"), "utf8"),
    readFile(path.join(projectRoot, "web/codex-file.svg"), "utf8"),
    readFile(path.join(projectRoot, "web/codex-document.svg"), "utf8"),
    readFile(path.join(projectRoot, "web/codex-image.svg"), "utf8"),
    readFile(path.join(projectRoot, "web/codex-attachment.svg"), "utf8"),
    readFile(path.join(projectRoot, "web/codex-pencil.svg"), "utf8"),
    readFile(lucideIconPath("trash-2"), "utf8"),
    readFile(lucideIconPath("external-link"), "utf8"),
    readFile(lucideIconPath("list-todo"), "utf8"),
    readFile(lucideIconPath("message-square-quote"), "utf8"),
    readFile(lucideIconPath("sticky-note"), "utf8"),
    readFile(lucideIconPath("star"), "utf8"),
    readFile(path.join(projectRoot, "codex-feature.json"), "utf8"),
  ]);

  for (const icon of ["circle", "ellipsis", "external-link", "list-todo", "message-square-quote", "star", "trash-2"]) {
    assert.match(server, new RegExp(`"${icon}"`));
    assert.match(styles, new RegExp(`\\/icons\\/${icon}\\.svg`));
  }
  assert.doesNotMatch(server, /^\s*"copy",$/m);
  assert.doesNotMatch(styles, /\.icon-copy\s*\{/);
  for (const icon of ["attachment", "circle-check", "plus"]) {
    assert.match(server, new RegExp(`\\/icons\\/${icon}\\.svg`));
    assert.match(styles, new RegExp(`\\/icons\\/${icon}\\.svg`));
  }
  assert.match(server, /LUCIDE_ICON_ROOT/);
  assert.match(server, /absoluteFile: path\.join\(LUCIDE_ICON_ROOT, `\$\{name\}\.svg`\)/);
  assert.match(server, /opticalStrokeWidth: THIN_LUCIDE_ICON_NAMES\.has\(name\) \? "1\.5" : null/);
  assert.match(server, /source\.toString\("utf8"\)\.replace\(/);
  assert.doesNotMatch(server, /\/Applications\/ChatGPT\.app/);
  assert.match(server, /file: "codex-plus\.svg"/);
  assert.match(codexPlus, /M9\.33496 16\.5V10\.665/);
  assert.doesNotMatch(codexPlus, /stroke-width/);
  assert.doesNotMatch(server, /file: "codex-view-all\.svg"/);
  assert.match(codexViewAll, /M16\.6345 5\.83331/);
  assert.doesNotMatch(codexViewAll, /stroke-width/);
  assert.match(lucideTrash2, /lucide-trash-2/);
  assert.match(lucideTrash2, /M10 11v6/);
  assert.match(lucideTrash2, /M14 11v6/);
  assert.match(lucideTrash2, /stroke-width="2"/);
  assert.match(server, /\["\/icons\/edit-pencil\.svg", \{ file: "codex-pencil\.svg"/);
  assert.match(codexPencil, /width="21" height="21" viewBox="0 0 21 21"/);
  assert.match(codexPencil, /M11\.7313 4\.20472C13\.1489 2\.92391/);
  assert.match(codexPencil, /fill="currentColor"/);
  assert.doesNotMatch(codexPencil, /stroke-width/);
  assert.doesNotMatch(server, /^\s*"pencil",$/m);
  assert.doesNotMatch(styles, /\/icons\/pencil\.svg/);
  assert.match(lucideExternalLink, /lucide-external-link/);
  assert.match(lucideExternalLink, /M15 3h6v6/);
  assert.match(lucideExternalLink, /M10 14 21 3/);
  assert.match(lucideListTodo, /lucide-list-todo/);
  assert.match(lucideListTodo, /M13 5h8/);
  assert.match(lucideMessageSquareQuote, /lucide-message-square-quote/);
  assert.match(lucideStickyNote, /lucide-sticky-note/);
  assert.match(featureManifest, /"resource": "assets\/icons\/sticky-note\.svg"/);
  assert.match(lucideStar, /lucide-star/);
  assert.match(lucideStar, /M11\.525 2\.295/);
  assert.match(server, /file: "codex-task\.svg"/);
  assert.match(codexTask, /M17\.3516 10\.002/);
  assert.match(server, /file: `codex-\$\{kind\}\.svg`/);
  assert.match(codexFile, /viewBox="0 0 10 10"/);
  assert.match(codexFile, /M5\.62988 1\.12599/);
  assert.match(codexDocument, /viewBox="0 0 21 21"/);
  assert.match(codexDocument, /M3\.685 13\.9927/);
  assert.match(codexImage, /M16\.0012 7\.78796/);
  assert.match(server, /file: "codex-attachment\.svg"/);
  assert.match(codexAttachment, /M4\.43945 12\.8041V7\.68261/);
  assert.doesNotMatch(codexAttachment, /stroke-width/);
  assert.doesNotMatch(server, /reveal-folder/);
  assert.doesNotMatch(styles, /reveal-folder/);
  assert.match(app, /const CODEX_FILE_ICON_BY_EXTENSION = new Map/);
  assert.match(app, /\["md", "document"\]/);
  assert.match(app, /\["xlsx", "spreadsheet"\]/);
  assert.match(app, /\["pdf", "pdf"\]/);
  assert.match(app, /function codexFileIconKind\(file\)/);
  assert.match(app, /mimeType\.startsWith\("image\/"\)/);
  assert.match(app, /CODEX_COLOR_FILE_ICONS\.has\(kind\)/);
  assert.match(app, /iconMarkup\(`file-\$\{kind\}`/);
  assert.match(styles, /--codex-summary-file-icon-size, 16px/);
  assert.match(server, /THIN_LUCIDE_ICON_NAMES = new Set\(\[[^\]]*"message-square-quote"[^\]]*"star"/s);
  assert.match(styles, /\.star-mark\s*\{[^}]*width: var\(--codex-summary-prompt-star-icon-size, var\(--codex-summary-file-icon-size, 16px\)\)[^}]*height: var\(--codex-summary-prompt-star-icon-size, var\(--codex-summary-file-icon-size, 16px\)\)/s);
  assert.match(styles, /\.prompt-star-leading\s*\{[^}]*color: var\(--color-token-text-secondary, var\(--notes-text-secondary\)\)/s);
  assert.match(app, /class="summary-leading prompt-star-leading\$\{prompt\.starred \? " is-starred" : " is-placeholder"\}"/);
  assert.match(styles, /\.row-actions \.icon-trash-2\s*\{[^}]*--codex-summary-delete-icon-size, 16px/s);
  assert.match(styles, /\.file-row \.row-actions \.icon-trash-2\s*\{[^}]*width: var\(--codex-summary-file-action-icon-size, 15px\)[^}]*height: var\(--codex-summary-file-action-icon-size, 15px\)/s);
  assert.match(styles, /\.file-row \.row-actions \.icon-external-link\s*\{[^}]*width: var\(--codex-summary-file-action-icon-size, 15px\)[^}]*height: var\(--codex-summary-file-action-icon-size, 15px\)/s);
  assert.match(styles, /\.todo-row \.row-actions \.icon-edit-pencil,[\s\S]*?\.prompt-row \.row-actions \.icon-edit-pencil\s*\{[^}]*width: var\(--codex-summary-edit-icon-size, 16px\)[^}]*height: var\(--codex-summary-edit-icon-size, 16px\)/s);
  assert.match(app, /"edit-prompt": "edit-pencil"[\s\S]*?"edit-todo": "edit-pencil"/s);
  assert.match(server, /THIN_LUCIDE_ICON_NAMES = new Set\(\[[^\]]*"ellipsis"[^\]]*"external-link"/s);
  assert.doesNotMatch(server, /send-horizontal/);
  assert.doesNotMatch(styles, /send-horizontal/);
  assert.doesNotMatch(app, /send-horizontal/);
  assert.match(styles, /\.prompt-row \.row-actions \.icon\s*\{[^}]*width: var\(--codex-summary-prompt-action-icon-size, 15px\)[^}]*height: var\(--codex-summary-prompt-action-icon-size, 15px\)/s);
  assert.match(app, /const DOMAIN_ICON_BY_SURFACE = Object\.freeze\(\{[\s\S]*?todo: "list-todo"[\s\S]*?prompt: "message-square-quote"[\s\S]*?prompts: "message-square-quote"[\s\S]*?files: "paperclip"/);
  assert.match(app, /iconMarkup\(domainIconName\(key\), "view-all-icon"\)/);
  assert.doesNotMatch(app, /iconMarkup\("view-all", "view-all-icon"\)/);
  assert.match(app, /class="view-all-label">\$\{escapeHtml\(t\("viewAll"\)\)\}<\/span>/);
  assert.match(app, /class="file-thumbnail"[^>]*\/api\/files\/\$\{encodeURIComponent\(file\.id\)\}\/preview/);
  assert.match(app, /class="file-thumbnail-fallback"/);
  assert.match(styles, /\.file-thumbnail\s*\{[^}]*width: 18px[^}]*height: 18px[^}]*border-radius: 3px[^}]*object-fit: cover/s);
  assert.match(styles, /\.row-actions \.quiet-button\s*\{[^}]*--color-token-text-tertiary/s);
  assert.match(styles, /\.row-actions \.quiet-button:hover\s*\{[^}]*background: var\(--notes-hover\)/s);
  assert.match(styles, /--notes-hover: var\(--codex-list-hover, var\(--color-token-list-hover-background, rgba\(13, 13, 13, 0\.05\)\)\)/);
  assert.doesNotMatch(app, /•••|>IMG<|>FILE<|aria-label="Pinned">●/);
});

test("Prompts insert from the primary hit area, reserve Star alignment, and float More above following rows", async () => {
  const [app, styles] = await Promise.all([
    readFile(path.join(projectRoot, "web/app.js"), "utf8"),
    readFile(path.join(projectRoot, "web/styles.css"), "utf8"),
  ]);

  assert.match(app, /class="row-primary prompt-label" data-action="insert-prompt"[^>]*title="\$\{escapeHtml\(t\("insertPrompt"\)\)\}"/);
  assert.match(app, /actionButton\("edit-prompt", t\("edit"\), \{ quiet: true \}\)/);
  assert.doesNotMatch(app, /actionButton\("insert-prompt", "Insert", \{ quiet: true \}\)/);
  assert.match(app, /summarySection\(\{ key: "prompts", title: t\("prompts"\), items: prompts, addLabel: t\("addPrompt"\), rows: promptRow, emptyLabel: t\("noPrompts"\) \}\)/);
  assert.match(app, /data-action="toggle-prompt-star"[\s\S]*?iconMarkup\(prompt\.starred \? "star-off" : "star", "menu-item-icon"\)[\s\S]*?prompt\.starred \? t\("unstar"\) : t\("star"\)/s);
  assert.match(app, /data-action="delete-prompt"[\s\S]*?iconMarkup\("trash-2", "menu-item-icon"\)[\s\S]*?<span>\$\{escapeHtml\(t\("delete"\)\)\}<\/span>/s);
  assert.doesNotMatch(app, /class="danger-action"/);
  assert.match(app, /function promptLeading\(prompt\)[\s\S]*?prompt-star-leading\$\{prompt\.starred \? " is-starred" : " is-placeholder"\}[\s\S]*?prompt\.starred \? iconMarkup\("star", "star-mark"\) : ""/s);
  assert.doesNotMatch(app, /data-section="notes"|title: "Notes"|addLabel: "Add Note"|toggle-prompt-pin/);
  assert.doesNotMatch(app, /copy-prompt|actionButton\("copy-prompt"|function copyText\(/);
  assert.match(app, /async function insertPrompt\(id\)/);
  assert.match(app, /body: JSON\.stringify\(\{ action: "insert", success: true \}\)/);
  assert.match(app, /app\.addEventListener\("toggle",[\s\S]*?closeOpenPromptMenus\(menu\)/s);
  assert.match(app, /function dismissPromptMenus\(\{ releaseFocus = false \} = \{\}\)[\s\S]*?closeOpenPromptMenus\(\)[\s\S]*?releaseFocus[\s\S]*?document\.activeElement\.blur\(\)/s);
  assert.match(app, /document\.addEventListener\("pointerdown", \(event\) => \{[\s\S]*?!event\.target\.closest\?\.\("\.row-menu"\)[\s\S]*?dismissPromptMenus\(\)/s);
  assert.match(app, /window\.addEventListener\("blur", \(\) => \{[\s\S]*?hidePromptPreview\(\)[\s\S]*?dismissPromptMenus\(\{ releaseFocus: true \}\)/s);
  const toggleHandler = app.match(/app\.addEventListener\("toggle",[\s\S]*?\}, true\);/)?.[0] ?? "";
  assert.doesNotMatch(toggleHandler, /reportSummaryMetrics\(\)/);
  assert.match(styles, /\.prompt-row:has\(\.row-menu\[open\]\)\s*\{[^}]*z-index: 1/s);
  assert.doesNotMatch(styles, /\.prompt-row:has\(\.row-menu\[open\]\)\s*\{[^}]*margin-bottom/s);
  assert.match(styles, /\.menu-popover\s*\{[^}]*position: absolute[^}]*z-index: 20/s);
  assert.match(styles, /\.menu-popover\s*\{[^}]*min-width: var\(--codex-summary-menu-min-width, 160px\)[^}]*padding: var\(--codex-summary-menu-padding, 4px\)[^}]*--radius-xl, 15px/s);
  assert.match(styles, /\.menu-popover\s*\{[^}]*color-mix\(in srgb, var\(--notes-bg-elevated\) 90%, transparent\)[^}]*backdrop-filter: blur\(4px\)/s);
  assert.match(styles, /\.menu-popover\s*\{[^}]*font-size: var\(--codex-summary-menu-font-size, var\(--text-sm, 13px\)\)[^}]*--text-sm--line-height, 18\.5714px/s);
  assert.match(styles, /\.menu-popover button\s*\{[^}]*min-height: var\(--codex-summary-menu-item-height, 28\.5714px\)[^}]*gap: var\(--codex-summary-menu-icon-gap, 6px\)[^}]*padding: 5px 8px[^}]*color: var\(--notes-text\)/s);
  assert.match(styles, /\.menu-item-icon\s*\{[^}]*--codex-summary-menu-icon-size, 16px[^}]*--codex-summary-menu-icon-opacity, 0\.75/s);
  assert.match(styles, /\.menu-popover button:hover \.menu-item-icon,[\s\S]*?opacity: 1/s);
  assert.doesNotMatch(styles, /\.danger-action\s*\{/);
  assert.match(styles, /\.row-menu\[open\] > summary\s*\{[^}]*background: var\(--notes-hover\)/s);
});

test("Prompt rows reveal full content through an immediate Host-level hover preview", async () => {
  const app = await readFile(path.join(projectRoot, "web/app.js"), "utf8");

  assert.match(app, /const PROMPT_PREVIEW_POINTER_QUERY = "\(hover: hover\) and \(pointer: fine\)"/);
  assert.match(app, /type: "codex-personal:prompt-preview"/);
  assert.match(app, /message\.prompt = \{[\s\S]*?title: prompt\.title,[\s\S]*?body: prompt\.body/s);
  assert.match(app, /message\.anchor = \{[\s\S]*?top: rect\.top,[\s\S]*?height: rect\.height/s);
  assert.match(app, /function showPromptPreviewForRow\(row\)/);
  assert.match(app, /function pointerTargetsPromptMenu\(event, row\)[\s\S]*?getBoundingClientRect\(\)[\s\S]*?event\.clientX >= rect\.left[\s\S]*?event\.clientY <= rect\.bottom/s);
  assert.match(app, /ui\.promptPreviewId = id;\s*postPromptPreview\("show", prompt, row\)/);
  assert.match(app, /ui\.promptById = new Map\(state\.prompts\.map\(\(item\) => \[item\.id, item\]\)\)/);
  assert.match(app, /const prompt = ui\.promptById\.get\(id\)/);
  assert.doesNotMatch(app, /ui\.state\?\.prompts\.find\(\(item\) => item\.id === id\)/);
  assert.match(app, /app\.addEventListener\("pointerover"/);
  assert.match(app, /app\.addEventListener\("pointerover", \(event\) => \{[\s\S]*?pointerTargetsPromptMenu\(event, row\)[\s\S]*?hidePromptPreview\(\);[\s\S]*?return;[\s\S]*?showPromptPreviewForRow\(row\)/s);
  assert.match(app, /app\.addEventListener\("pointerout"/);
  assert.match(app, /if \(next instanceof Node && row\.contains\(next\)\) return/);
  assert.match(app, /app\.addEventListener\("scroll", hidePromptPreview, true\)/);
  assert.doesNotMatch(app, /PROMPT_PREVIEW_DELAY_MS|promptPreviewTimer/);
  assert.doesNotMatch(app, /event\.target\.closest\("\.row-actions"\)[\s\S]*?hidePromptPreview\(\)/);
});

test("File names attach to chat while a native Reveal action opens the canonical source", async () => {
  const [app, server, product] = await Promise.all([
    readFile(path.join(projectRoot, "web/app.js"), "utf8"),
    readFile(path.join(projectRoot, "src/http-server.mjs"), "utf8"),
    readFile(path.join(projectRoot, "src/product.mjs"), "utf8"),
  ]);

  assert.match(app, /class="row-primary file-label" data-action="add-file"[^>]*title="\$\{escapeHtml\(t\("attachToChat"\)\)\}"/);
  assert.match(app, /actionButton\("reveal-file", t\("showInFolder"\), \{ quiet: true \}\)/);
  assert.match(app, /"reveal-file": "external-link"/);
  assert.match(app, /\/api\/files\/\$\{encodeURIComponent\(id\)\}\/reveal/);
  assert.match(server, /idFrom\(pathname, "\/api\/files\/", "\/reveal"\)/);
  assert.match(server, /platform === "darwin"/);
  assert.match(server, /command = "\/usr\/bin\/open"/);
  assert.match(server, /args = \["-R", filePath\]/);
  assert.match(server, /platform === "win32"/);
  assert.match(server, /command = "explorer\.exe"/);
  assert.match(server, /args = \["\/select,", filePath\]/);
  assert.match(server, /fileRevealer\(file\.path\)/);
  assert.doesNotMatch(app, /renamingFile|rename-file|cancel-file-rename|data-action="rename-file"|"dblclick"/);
  assert.doesNotMatch(server, /\/rename|renameFile/);
  assert.doesNotMatch(product, /renameTarget|renameFile|file:renamed/);
});

test("Summary launches a Commit-level editor dialog with role-specific native surface tokens", async () => {
  const [app, styles] = await Promise.all([
    readFile(path.join(projectRoot, "web/app.js"), "utf8"),
    readFile(path.join(projectRoot, "web/styles.css"), "utf8"),
  ]);

  assert.match(app, /new Set\(\["summary", "todo", "prompts", "files", "editor"\]\)/);
  assert.match(app, /hostRequest\("open-editor-modal", \{ kind, id \}\)/);
  assert.match(app, /class="editor-modal-shell" data-editor-shell/);
  assert.match(app, /class="modal-actions"/);
  assert.match(app, /data-form="save-todo"/);
  assert.match(app, /data-form="save-prompt"/);
  assert.match(app, /function modalEditorTitle\(kind, label\)/);
  assert.match(app, /modalEditorTitle\("todo", editing \? t\("editTodo"\) : t\("newTodo"\)\)/);
  assert.match(app, /modalEditorTitle\("prompt", editing \? t\("editPrompt"\) : t\("newPrompt"\)\)/);
  assert.match(app, /modalCommand\(editing \? t\("saveTodo"\) : t\("addTodo"\), \{ submit: true, shortcut: "⌘↩", disabled: !draft\?\.body\.trim\(\) \}\)/);
  assert.match(app, /modalCommand\(editing \? t\("savePrompt"\) : t\("addPrompt"\), \{ submit: true, shortcut: "⌘↩", disabled: !draft\?\.body\.trim\(\) \}\)/);
  assert.match(app, /function syncEditorSubmitState\(form\)/);
  assert.match(app, /submit\.disabled = !body\?\.value\.trim\(\)/);
  assert.match(app, /if \(!submit\?\.disabled\) form\?\.requestSubmit\(submit\)/);
  assert.doesNotMatch(app, /summary-quick-add/);
  for (const token of [
    "--color-token-input-background",
    "--color-token-input-border",
    "--color-token-input-foreground",
    "--color-token-input-placeholder-foreground",
    "--color-background-primary-solid",
    "--color-text-primary-solid",
    "--color-background-button-tertiary-hover",
    "--spacing-token-button-composer",
  ]) {
    assert.match(styles, new RegExp(token));
  }
  assert.match(styles, /\.summary-shell\s*\{[^}]*--codex-summary-panel-radius[^}]*--codex-summary-panel-corner-shape/s);
  assert.match(styles, /\.editor-modal-shell\s*\{[^}]*--codex-dialog-radius[^}]*--codex-dialog-corner-shape/s);
  assert.match(styles, /\.modal-editor-fields input:focus-visible,[\s\S]*?\.modal-editor-fields textarea:focus-visible\s*\{[^}]*box-shadow: inset 0 0 0 2px var\(--notes-focus\)/s);
  assert.match(styles, /\.modal-command:focus-visible\s*\{[^}]*outline: 2px solid var\(--notes-focus\)/s);
  assert.match(styles, /\.check-control input:focus-visible \+ \.todo-check-icon\s*\{[^}]*outline: 2px solid var\(--notes-focus\)/s);
  assert.match(app, /if \(ui\.editorSubmitting \|\| ui\.editorMissing\) return/);
  assert.match(app, /form\.setAttribute\("aria-busy", "true"\)/);
  assert.match(app, /catch \(error\) \{[\s\S]*?await refreshState\(\{ quiet: true \}\);[\s\S]*?if \(surface !== "editor" && ui\.state\) render\(\)/s);
  assert.match(styles, /\.modal-actions\s*\{[^}]*flex-direction: column/s);
  assert.match(styles, /\.modal-command\s*\{[^}]*min-height: 31px[^}]*--radius-lg[^}]*--codex-corner-shape/s);
  assert.match(styles, /\.modal-command:disabled\s*\{[^}]*cursor: not-allowed[^}]*opacity: var\(--codex-dialog-command-disabled-opacity, 0\.4\)/s);
  assert.match(styles, /\.modal-command\.is-default:disabled\s*\{[^}]*background: transparent/s);
  assert.match(styles, /\.modal-editor-title-icon\s*\{[^}]*width: var\(--codex-dialog-title-icon-size, 18px\)[^}]*height: var\(--codex-dialog-title-icon-size, 18px\)/s);
  assert.doesNotMatch(app, /data-form="add-todo"|data-form="edit-todo"|class="prompt-editor"/);
  assert.match(styles, /:root\s*\{[^}]*font-size: 16px/s);
  assert.match(styles, /body\s*\{[^}]*font-size: var\(--text-base, 14px\)/s);
});

test("Visible copy, host labels, reconnects, and errors support English and Simplified Chinese", async () => {
  const [app, server, styles, manifestSource] = await Promise.all([
    readFile(path.join(projectRoot, "web/app.js"), "utf8"),
    readFile(path.join(projectRoot, "src/http-server.mjs"), "utf8"),
    readFile(path.join(projectRoot, "web/styles.css"), "utf8"),
    readFile(path.join(projectRoot, "codex-feature.json"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource);

  assert.match(app, /const SUPPORTED_LOCALES = new Set\(\["en", "zh-CN"\]\)/);
  assert.match(app, /"zh-CN": \{/);
  for (const copy of ["待办", "提示词", "文件", "查看全部", "请求无效"]) {
    assert.match(app, new RegExp(copy));
  }
  assert.match(app, /document\.documentElement\.lang = locale/);
  assert.match(app, /if \(message\.locale\) setLocale\(message\.locale\)/);
  assert.match(app, /localizedErrorMessage\(payload\?\.error\?\.code/);
  assert.match(app, /events\.addEventListener\("ready", handleRevision\)/);
  assert.match(app, /if \(!ui\.refreshPromise\) ui\.refreshPromise = performRefresh\(\)/);
  assert.match(app, /next\.revision > ui\.state\.revision/);
  assert.match(app, /window\.parent\.postMessage\(message, ui\.hostOrigin \?\? "\*"\)/);
  assert.match(server, /requestLocale\(request\)/);
  assert.match(server, /locale === "zh-CN" \? "将文件固定到 CodexNotes" : "Pin files to CodexNotes"/);
  assert.match(styles, /\.check-control input:focus-visible \+ \.todo-check-icon/);

  assert.deepEqual(manifest.label, { en: "Notes", "zh-CN": "笔记" });
  assert.equal(manifest.entry.ariaLabel["zh-CN"], "切换固定笔记");
  assert.equal(manifest.pinnedSummary.label["zh-CN"], "固定笔记");
  assert.deepEqual(manifest.detailTabs.map((tab) => tab.label["zh-CN"]), ["待办", "提示词", "文件"]);
  assert.ok(manifest.hostActions.every((action) => /^[a-z-]+$/.test(action)), "protocol action ids stay locale-independent");
});

test("Codex design-token inventory preserves native, derived, and component-level boundaries", async () => {
  const csv = await readFile(path.join(projectRoot, "codex-design-tokens.csv"), "utf8");

  assert.match(csv, /^"category","semantic_role","source_kind","codex_source","project_alias","resolved_value"/);
  assert.match(csv, /"color","surface\.dropdown","native_token","--color-token-dropdown-background"/);
  assert.match(csv, /"radius","summary\.panel","derived_token"[^\n]*"--codex-summary-panel-radius"[^\n]*"1\.25rem \* 1\.25 = 25px"/);
  assert.match(csv, /"radius","dialog\.outer","component_literal"[^\n]*"--codex-dialog-radius","20px"/);
  assert.match(csv, /"radius","dialog\.outer-shape","component_literal"[^\n]*"--codex-dialog-corner-shape","round"/);
  assert.match(csv, /"elevation","dialog\.shadow","component_literal"[^\n]*"--codex-dialog-shadow"/);
  assert.match(csv, /"layout","dialog\.prompt-height","project_contract"[^\n]*"250px"/);
  assert.match(csv, /"layout","dialog\.todo-height","project_contract"[^\n]*"198px"/);
  assert.match(csv, /"layout","dialog\.title-icon","project_semantic"[^\n]*"18px square"/);
  assert.match(csv, /"typography","size\.summary-label","native_token","--text-base","--codex-summary-label-font-size","14px"/);
  assert.match(csv, /"typography","line-height\.summary-label","native_token","--text-base--line-height","--codex-summary-label-line-height"/);
  assert.match(csv, /"layout","summary\.overflow-threshold","project_contract"[^\n]*"5 items"/);
  assert.match(csv, /"spacing","summary\.leading-to-label","component_literal"[^\n]*"12px total"/);
  assert.match(csv, /"spacing","summary\.hover-inline-extension","component_literal"[^\n]*"8px each side"/);
  assert.match(csv, /"color","summary\.control\.hover","native_token","--color-token-list-hover-background"[^\n]*"rgba\(13, 13, 13, 0\.05\)"/);
  assert.match(csv, /"spacing","summary\.header-to-list","component_literal","native Summary mt-0\.5"[^\n]*"2px"/);
  assert.match(csv, /"layout","summary\.image-thumbnail","component_literal"[^\n]*"18px square"/);
  assert.match(csv, /"layout","summary\.file-icon","native_utility","icon-xs"[^\n]*"16px square"/);
  assert.match(csv, /"layout","summary\.delete-icon","optical_adjustment"[^\n]*"16px and 1\.5 SVG stroke inside 28px control"/);
  assert.match(csv, /"layout","summary\.file-action-icon","optical_adjustment"[^\n]*"15px glyph with 1\.5 stroke inside 28px control"/);
  assert.match(csv, /"layout","summary\.prompt-action-icon","optical_adjustment"[^\n]*"15px glyph with 1\.5 stroke inside 28px control"/);
  assert.match(csv, /"asset","summary\.toolbar\.notes","library_component","Lucide StickyNote"[^\n]*sticky-note\.svg[^\n]*strokeWidth 1\.5/);
  assert.match(csv, /"asset","summary\.domain\.prompts","library_component","Lucide MessageSquareQuote"[^\n]*message-square-quote\.svg[^\n]*keep Star separate as the saved-state marker/);
  assert.match(csv, /"asset","summary\.row\.edit","component_asset","kU imported by hotkey-setter as Rz"[^\n]*"\/icons\/edit-pencil\.svg"/);
  assert.doesNotMatch(csv, /"asset","summary\.row\.edit","library_component","Lucide Pencil"|\/icons\/pencil\.svg via lucide-static/);
  assert.match(csv, /"layout","summary\.edit-icon","native_utility"[^\n]*"16px filled glyph inside 28px control"/);
  assert.match(csv, /"layout","summary\.prompt-star-icon","derived_token"[^\n]*"16px glyph with 1\.5 stroke"/);
  assert.match(csv, /"asset","summary\.file\.reveal","library_component","Lucide ExternalLink"[^\n]*"\/icons\/external-link\.svg via lucide-static"/);
  assert.doesNotMatch(csv, /summary\.row\.insert|SendHorizontal|send-horizontal/);
  assert.match(csv, /"behavior","summary\.todo\.primary-action","project_contract"[^\n]*"toggle completed or active"[^\n]*full row label toggle/);
  assert.match(csv, /"behavior","summary\.prompt\.primary-action","project_contract"[^\n]*"insert into composer"[^\n]*full row label insert/);
  assert.match(csv, /"behavior","summary\.file\.primary-action","project_contract"[^\n]*"attach to composer"[^\n]*full row label attach/);
  assert.match(csv, /"behavior","summary\.prompt-preview\.intent-delay","project_contract"[^\n]*"0ms; immediate"/);
  assert.match(csv, /"behavior","summary\.prompt-preview\.intent-delay"[^\n]*exclude the More trigger[^\n]*clicking it alone opens the action menu/);
  assert.match(csv, /"layout","summary\.prompt-preview\.width","component_literal"[^\n]*"360px max; 160px constrained minimum"/);
  assert.match(csv, /"radius","summary\.prompt-preview","component_literal"[^\n]*"16px; superellipse\(1\.5\)"/);
  assert.match(csv, /"elevation","summary\.prompt-preview","native_token","--elevation-prominent"/);
  assert.match(csv, /"layout","summary\.menu\.surface","native_component"[^\n]*"160px min-width; 4px padding; 15px radius"/);
  assert.match(csv, /"behavior","summary\.menu\.dismiss","project_contract"[^\n]*"trigger toggle; outside pointer; iframe blur"[^\n]*focus-visible feedback for keyboard navigation/);
  assert.match(csv, /"layout","summary\.menu\.item","native_component"[^\n]*"28\.5714px height; 5px 8px padding; 12\.5px radius"/);
  assert.match(csv, /"layout","summary\.menu\.icon","native_utility","icon-xs \+ opacity-75"[^\n]*"16px square; opacity 0\.75; 1 on hover or focus"/);
  assert.match(csv, /"spacing","summary\.menu\.icon-to-label","native_utility","gap-1\.5"[^\n]*"6px"/);
  assert.match(csv, /"typography","summary\.menu\.item","native_token","--text-sm \+ --text-sm--line-height"[^\n]*"13px; 18\.5714px; weight 445"/);
  assert.doesNotMatch(csv, /summary\.prompt-menu-reserved-space/);
  assert.match(csv, /"layout","summary\.todo-unchecked-icon","optical_adjustment"[^\n]*"16px ring inside 18px control"/);
  assert.match(csv, /"asset","summary\.file\.classifier","component_logic","EQi\(path, mime\) \+ NV icon map"/);
  assert.match(csv, /"asset","summary\.file\.default","component_asset","NV\.file = mL"/);
  assert.match(csv, /"asset","summary\.file\.attach","component_asset","composer\.contextAction\.filesAndFolders icon = vds"/);
  assert.match(csv, /"asset","summary\.domain\.todo","library_component","Lucide ListTodo"/);
  assert.match(csv, /"asset","summary\.domain\.prompts","library_component","Lucide MessageSquareQuote"/);
  assert.match(csv, /"asset","summary\.prompt\.star","library_component","Lucide Star"/);
  assert.match(csv, /"asset","summary\.domain\.files","component_asset","composer\.contextAction\.filesAndFolders icon = vds"/);
  assert.match(csv, /"asset","native\.sources\.trailing\.view-all","component_asset","NQo in FQo"/);
  assert.match(csv, /"asset","summary\.row\.delete","library_component","Lucide Trash2"/);
  assert.match(csv, /"asset","summary\.file\.image-preview","component_markup"[^\n]*"\/api\/files\/:id\/preview"/);
});
