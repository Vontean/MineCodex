import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const webRoot = new URL("../web/", import.meta.url);

test("native Image Details editor fails closed without its complete host-token contract", async () => {
  const app = await readFile(new URL("app.js", webRoot), "utf8");
  for (const token of [
    "--color-token-bg-tertiary", "--color-background-elevated-primary-opaque",
    "--font-sans-default", "--font-weight-normal", "--text-sm--line-height",
    "--shadow-md", "--shadow-xl", "--elevation-stroke",
  ]) assert.match(app, new RegExp(JSON.stringify(token)));
  assert.match(app, /editor\.hidden = !editorTokens\.every/);
});

test("native Image Details editor derives its visual hierarchy from runtime semantic tokens", async () => {
  const css = await readFile(new URL("styles.css", webRoot), "utf8");
  for (const token of [
    "--color-token-bg-tertiary", "--color-background-elevated-primary-opaque",
    "--color-token-list-hover-background", "--color-border-focus",
    "--font-sans-default", "--font-weight-normal", "--text-sm--line-height",
    "--shadow-md", "--shadow-xl", "--elevation-stroke",
  ]) assert.match(css, new RegExp(`var\\(${token.replace(/[-]/g, "\\-")}`));
  assert.doesNotMatch(css.match(/\.image-edit-actions[\s\S]*?\.image-zoom-trigger \{/s)?.[0] ?? "", /#[0-9a-f]{3,8}|rgb\(/i);
});
