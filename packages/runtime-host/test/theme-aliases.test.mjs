import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { createInjectionSource } from "../src/codex-injection.mjs";
import { CODEX_THEME_TOKENS, CODEX_THEME_TOKEN_ALIASES } from "../src/codex-design-contract.mjs";

const source = createInjectionSource([]);
const start = source.indexOf("function resolvedTheme()");
const end = source.indexOf("function sendTheme()", start);

test("current native theme aliases fill the editor contract without replacing existing tokens", () => {
  const values = {
    "--color-token-foreground": "ink",
    "--color-text-foreground-secondary": "existing-secondary",
    "--app-color-text-foreground-secondary": "new-secondary",
    "--app-color-text-foreground-tertiary": "muted",
    "--app-color-text-on-accent": "on-accent",
    "--app-color-text-accent": "accent",
    "--app-color-border-focus": "focus",
    "--app-color-background-control": "control",
    "--app-color-border-focus-random123": "wrong-focus",
  };
  const root = { dataset: {theme: "dark"}, classList: {contains: () => false} };
  const resolve = vm.runInNewContext(`(${source.slice(start, end).trim()})`, {
    document: {documentElement: root}, themeTokenNames: CODEX_THEME_TOKENS,
    themeTokenAliases: CODEX_THEME_TOKEN_ALIASES,
    getComputedStyle: () => ({getPropertyValue: name => values[name] ?? "", colorScheme: "normal"}),
  });
  const {tokens, mode} = resolve();
  assert.equal(mode, "dark");
  assert.equal(tokens["--color-text-foreground"], "ink");
  assert.equal(tokens["--color-text-foreground-secondary"], "existing-secondary");
  assert.equal(tokens["--color-text-foreground-tertiary"], "muted");
  assert.equal(tokens["--color-text-on-accent"], "on-accent");
  assert.equal(tokens["--color-text-accent"], "accent");
  assert.equal(tokens["--color-border-focus"], "focus");
  assert.equal(tokens["--color-token-input-foreground"], "ink");
  assert.equal(tokens["--color-background-control"], "control");
  delete values["--app-color-border-focus"];
  assert.equal(resolve().tokens["--color-border-focus"], undefined);
});
