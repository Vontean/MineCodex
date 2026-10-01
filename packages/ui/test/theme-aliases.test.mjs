import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { createInjectionSource } from "../../runtime-host/src/codex-injection.mjs";
import { CODEX_THEME_TOKENS, CODEX_THEME_TOKEN_ALIASES, MINECODEX_THEME_BINDINGS } from "../src/native/tokens.mjs";

import { createNativeThemeAdapter } from "../src/native/theme.mjs";

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
  const assigned=new Map();
  const root = { style:{getPropertyValue:name=>assigned.get(name) ?? "",setProperty:(name,value)=>assigned.set(name,value),removeProperty:name=>assigned.delete(name)}, dataset: {theme: "dark"}, classList: {contains: () => false} };
  const factory = vm.runInNewContext(`(${createNativeThemeAdapter.toString()})`, {
    document: {documentElement: root}, themeTokenNames: CODEX_THEME_TOKENS,
    themeTokenAliases: CODEX_THEME_TOKEN_ALIASES,
    getComputedStyle: () => ({getPropertyValue: name => values[name] ?? "", colorScheme: "normal"}),
  });
  const adapter=factory(CODEX_THEME_TOKENS,CODEX_THEME_TOKEN_ALIASES,MINECODEX_THEME_BINDINGS);
  const resolve=adapter.read;
  const {tokens, mode} = resolve();
  assert.equal(tokens["--mcx-color-border-focus"],"focus");
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
  assert.equal(assigned.has("--mcx-color-border-focus"),false);
  adapter.dispose();assert.equal(assigned.size,0);
});
