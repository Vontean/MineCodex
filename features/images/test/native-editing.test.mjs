import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const webRoot = new URL("../web/", import.meta.url);

test("native Image Details editor fails closed without its complete host-token contract while preserving the image stage", async () => {
  const app = await readFile(new URL("app.js", webRoot), "utf8");
  for (const token of [
    "--color-surface-tertiary", "--color-surface-elevated-secondary",
    "--color-border-subtle", "--color-background-primary-ghost-hover",
    "--color-chart-blue", "--color-text-inverse",
    "--font-sans-default", "--font-weight-normal", "--text-sm--line-height",
    "--shadow-md", "--shadow-xl",
  ]) assert.match(app, new RegExp(JSON.stringify(token)));
  assert.match(app, /editorControls\.hidden = !editorTokens\.every/);
  const html = await readFile(new URL("index.html", webRoot), "utf8");
  assert.match(html, /class="image-editor-controls" hidden/);
  assert.doesNotMatch(html, /class="image-editor"[^>]*hidden/);
});

test("native Image Details editor derives its visual hierarchy from runtime semantic tokens", async () => {
  const css = await readFile(new URL("styles.css", webRoot), "utf8");
  for (const token of [
    "--color-surface-tertiary", "--color-surface-elevated-secondary",
    "--color-border-subtle", "--color-background-primary-ghost-hover", "--color-border-focus",
    "--font-sans-default", "--font-weight-normal", "--text-sm--line-height",
    "--shadow-md", "--shadow-xl",
  ]) assert.match(css, new RegExp(`var\\(${token.replace(/[-]/g, "\\-")}`));
  assert.doesNotMatch(css.match(/\.image-edit-actions[\s\S]*?\.image-zoom-trigger \{/s)?.[0] ?? "", /#[0-9a-f]{3,8}|rgb\(/i);
});

test("native Image Details editor matches the measured Codex image toolbar and menu contracts", async () => {
  const html = await readFile(new URL("index.html", webRoot), "utf8");
  const css = await readFile(new URL("styles.css", webRoot), "utf8");
  const app = await readFile(new URL("app.js", webRoot), "utf8");

  for (const token of [
    "--color-surface-tertiary", "--color-surface-elevated-secondary",
    "--color-border-subtle", "--color-background-primary-ghost-hover",
  ]) assert.match(css, new RegExp(`var\\(${token.replace(/[-]/g, "\\-")}`));

  assert.match(html, /viewBox="0 0 20 20"[^>]*data-native-image-icon="comment"/);
  assert.match(html, /viewBox="0 0 20 20"[^>]*data-native-image-icon="remove"/);
  assert.match(html, /viewBox="0 0 20 20"[^>]*data-native-image-icon="resize"/);
  assert.match(html, /data-zoom-value/);
  assert.match(html, /data-zoom-chevron/);
  assert.match(app, /function fitZoomPercent\(\)/);
  assert.match(app, /zoomTriggerValue\.textContent = `\$\{fitZoomPercent\(\)\}%`/);
  assert.match(app, /class="image-menu-check/);
  assert.match(app, /const RATIO_ICON_PATHS =/);
  assert.match(app, /dataset\.editSend/);
  assert.match(app, /dataset\.editCancel/);
  assert.match(app, /undo\.hidden = !historyVisible/);
  assert.match(app, /redo\.hidden = !historyVisible/);
  assert.match(app, /function openCommentEditor\(comment\)/);
  assert.match(app, /comment\.editingExisting = !isNew/);
  assert.match(app, /aria-label", "Delete comment"/);
  assert.match(app, /save\.disabled = !textarea\.value\.trim\(\)/);
  assert.match(app, /finishExistingEdit\(\{ restore: true \}\)/);
  assert.doesNotMatch(app.match(/function annotationPng\(comments\)[\s\S]*?function removeMaskPng/s)?.[0] ?? "", /drawImage\(/);
  assert.match(app, /transparent position overlay aligned exactly to the first image/);
  assert.match(app, /comment\.draft = false/);
  assert.match(app, /if \(keyEvent\.key === "Enter"\)/);
  assert.match(app, /if \(!text\) \{\s*input\.focus\(\);\s*return;/s);
  assert.match(app, /if \(keyEvent\.key === "Escape"\)/);
  assert.match(app, /function cancelActiveCommentEditor\(\)/);
  assert.match(app, /editComments = editComments\.filter\(\(entry\) => !entry\.draft\)/);
  assert.match(app, /editComments = editComments\.filter\(\(entry\) => entry === comment \|\| !entry\.draft\)/);
  assert.match(app, /!hostSurfaceActive && editMode === "comment" && !commentPopover\.hidden/);
  assert.match(app, /committedComments\.length/);
  assert.match(app, /event\.target\.closest\('\.image-edit-menu, \[data-zoom-trigger\], \[data-edit-action="resize"\]'/);
  assert.doesNotMatch(app, /textContent = "[×↶↷]"/);
  assert.match(css, /\.image-edit-menu \{[^}]*width: 160px[^}]*padding: 4px/s);
  assert.match(css, /\.image-edit-menu\[data-resize-menu\] \{[^}]*top: 48px/s);
  assert.match(css, /\.image-zoom-menu \{[^}]*width: 136px[^}]*padding: 6px[^}]*border-radius: 10px/s);
  assert.match(css, /\.image-zoom-menu button \{[^}]*line-height: 20px/s);
  assert.match(css, /\.image-edit-action > svg \{[^}]*width: 16px[^}]*height: 16px/s);
  assert.match(css, /data-native-image-icon="resize"[^}]*width: 18px[^}]*height: 18px/s);
  assert.match(css, /\[data-edit-send\][^}]*var\(--color-chart-blue\)[^}]*var\(--color-text-inverse\)/s);
  assert.match(css, /\.image-editor \{[^}]*background: var\(--color-token-bg-primary\)/s);
  assert.match(css, /\.image-editor-controls \{[^}]*position: sticky[^}]*top: 0[^}]*background: var\(--color-token-bg-primary\)/s);
  assert.match(css, /\.image-editor-toolbar \{[^}]*min-height: 48px[^}]*padding: 8px 16px[^}]*\}/s);
  assert.match(css, /\.image-comment-marker \{[^}]*width: 30px[^}]*height: 30px/s);
  assert.match(css, /\.image-comment-popover \{[^}]*width: min\(294px[^}]*height: 44px[^}]*border-radius: 22px/s);
  assert.match(css, /\.image-comment-popover\.is-existing-comment \{[^}]*height: 120px/s);
  assert.match(css, /\.image-comment-popover textarea \{[^}]*height: 60px/s);
});

test("new comment editor never covers its marker at either horizontal image edge", async () => {
  const app = await readFile(new URL("app.js", webRoot), "utf8");
  const source = app.match(/function commentEditorPosition\([\s\S]*?\n\}/)?.[0];
  assert.ok(source, "comment editor positioning function is missing");
  const commentEditorPosition = Function(`${source}; return commentEditorPosition;`)();
  const stage = { stageWidth: 1_249, stageHeight: 752, popoverHeight: 44 };
  const popoverWidth = 294;
  const markerRadius = 15;

  for (const markerX of [17, 1_233]) {
    const position = commentEditorPosition({ ...stage, markerX, markerY: 376 });
    const markerLeft = markerX - markerRadius;
    const markerRight = markerX + markerRadius;
    const overlapsHorizontally = position.left < markerRight
      && position.left + popoverWidth > markerLeft;
    assert.equal(overlapsHorizontally, false, `popover overlaps marker at x=${markerX}`);
  }
});
