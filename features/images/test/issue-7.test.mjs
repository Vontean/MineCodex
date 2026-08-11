import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Images split detail exposes honest region semantics and a shared keyboard context", async () => {
  const [html, app, styles] = await Promise.all([
    readFile(new URL("../web/index.html", import.meta.url), "utf8"),
    readFile(new URL("../web/app.js", import.meta.url), "utf8"),
    readFile(new URL("../web/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(html, /class="detail-drawer"[^>]*role="region"/);
  assert.doesNotMatch(html, /aria-modal=/);
  assert.match(html, /aria-labelledby="drawer-title"/);
  assert.match(html, /<h2 id="drawer-title">Image details<\/h2>/);
  assert.match(html, /class="status-announcer" role="status" aria-live="polite" aria-atomic="true"/);

  assert.match(app, /let drawerOrigin = null/);
  assert.match(app, /let groupOrigin = null/);
  assert.match(app, /function restoreDrawerFocus\(\)/);
  assert.match(app, /origin\.focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /function detailContextFocusableElements\(\)/);
  assert.match(app, /grid\.querySelectorAll\(/);
  assert.match(app, /function trapDetailContextFocus\(event\)/);
  assert.match(app, /event\.key !== "Tab"/);
  assert.match(app, /drawer\.querySelectorAll\(/);
  assert.match(app, /function rememberGroupOrigin\(/);
  assert.match(app, /viewContext === "thread" && groupOrigin/);
  assert.match(app, /drawer\.querySelector\("\.drawer-close"\)\?\.focus/);
  assert.match(app, /thumbnail\.width = image\.width/);
  assert.match(app, /drawerImage\.width = image\.width/);
  assert.match(app, /announce\(/);
  assert.match(app, /Prompt could not be loaded\./);

  assert.match(styles, /\.drawer-scroll\s*\{[^}]*overscroll-behavior: contain/s);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("Images source selector implements the complete listbox keyboard model", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../web/index.html", import.meta.url), "utf8"),
    readFile(new URL("../web/app.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /aria-controls="source-menu"/);
  assert.match(html, /class="source-menu" id="source-menu" role="listbox"/);
  assert.match(app, /function moveSourceOption\(/);
  for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Escape", "Enter", "Tab"]) {
    assert.match(app, new RegExp(`event\\.key === "${key}"`));
  }
  assert.match(app, /aria-selected/);
  assert.match(app, /option\.tabIndex = optionIndex === activeIndex \? 0 : -1/);
  const focusFunction = app.match(/function setSourceOptionFocus\([\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(focusFunction, /option\.dataset\.scope === selectedScope/);
  assert.doesNotMatch(focusFunction, /String\(optionIndex === activeIndex\)/);
  assert.match(app, /filterButton\.focus\(\)/);

  const triggerKeydown = app.match(/filterButton\.addEventListener\("keydown",[\s\S]*?\n\}\);/)?.[0] ?? "";
  assert.match(triggerKeydown, /event\.key === "Home"[\s\S]*openSourceMenu\(\{ focusIndex: 0 \}\)/);
  assert.match(triggerKeydown, /event\.key === "End"[\s\S]*openSourceMenu\(\{ focusIndex: sourceOptions\(\)\.length - 1 \}\)/);

  const menuKeydown = app.match(/sourceMenu\.addEventListener\("keydown",[\s\S]*?\n\}\);/)?.[0] ?? "";
  const tabBranch = menuKeydown.match(/event\.key === "Tab"\) \{[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.match(tabBranch, /closeSourceMenu\(\)/);
  assert.doesNotMatch(tabBranch, /preventDefault/);
  const detailTabModel = app.match(/function trapDetailContextFocus\(event\) \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(detailTabModel, /!sourceMenu\.hidden/);
});
