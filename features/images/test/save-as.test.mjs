import assert from "node:assert/strict";
import test from "node:test";
import { defaultImageFilename } from "../src/save-as.mjs";

test("creates a concise PNG filename for the native Save As dialog", () => {
  assert.equal(defaultImageFilename("A useful Thread"), "A useful Thread.png");
  assert.equal(defaultImageFilename("Draft: cards / navigation.png"), "Draft- cards - navigation.png");
  assert.equal(defaultImageFilename("..."), "Generated image.png");
});
