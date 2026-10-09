import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ensureControlToken, normalizeConfig, readConfig, updateFeature, writeConfig } from "../src/config.mjs";

test("config keeps established defaults and enables reading by default and preserves unknown fields", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-config-"));
  const configPath = path.join(root, "config.json");
  await writeFile(configPath, JSON.stringify({
    schemaVersion: 1,
    future: { channel: "preview" },
    features: { notes: false, "future-plugin": true },
  }));

  const config = await readConfig(configPath);
  assert.deepEqual(config.features, {
    notes: false,
    "future-plugin": true,
    "model-slider": true,
    images: true,
    "hide-upsell-banner": true,
    "session-status": true,
    "usage-meter": true,
    "sidebar-focus": true,
    sites: true,
    "markdown-reading": true,
    "file-navigation": true,
    "quick-chat": true,
    "quick-chat-repair": true,
  });
  assert.deepEqual(config.future, { channel: "preview" });

  await updateFeature(configPath, "images", false);
  await updateFeature(configPath, "session-status", false);
  const saved = JSON.parse(await readFile(configPath, "utf8"));
  assert.equal(saved.features.images, false);
  assert.equal(saved.features["session-status"], false);
  assert.equal(saved.features["future-plugin"], true);
  assert.deepEqual(saved.future, { channel: "preview" });
});

test("config writes atomically and control token stays stable with private permissions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-token-"));
  const configPath = path.join(root, "state", "config.json");
  const tokenPath = path.join(root, "state", "control-token");
  await writeConfig(configPath, { schemaVersion: 1, features: {} });
  const token = await ensureControlToken(tokenPath);
  assert.equal(await ensureControlToken(tokenPath), token);
  assert.equal(token.length >= 40, true);
  assert.equal((await stat(tokenPath)).mode & 0o777, 0o600);
});

test("concurrent feature updates serialize the read-modify-write seam", async () => {
  const configPath = "/fake/minecodex-config.json";
  let value = normalizeConfig({ schemaVersion: 1, features: {} });
  const read = async () => {
    await new Promise((resolve) => setTimeout(resolve, 2));
    return structuredClone(value);
  };
  const write = async (_path, next) => {
    await new Promise((resolve) => setTimeout(resolve, 2));
    value = structuredClone(next);
    return next;
  };

  await Promise.all([
    updateFeature(configPath, "notes", false, { read, write }),
    updateFeature(configPath, "images", false, { read, write }),
  ]);

  assert.equal(value.features.notes, false);
  assert.equal(value.features.images, false);
});

test("retired Task notifications cannot be restored by old config or feature updates", async () => {
  const config=normalizeConfig({features:{"unread-inbox":true,"future-plugin":true}});
  assert.equal("unread-inbox" in config.features,false);
  assert.equal(config.features["future-plugin"],true);
  await assert.rejects(updateFeature("/unused/config.json","unread-inbox",true),/Unknown MineCodex plugin/);
});

test("explicit reading and navigation opt-outs are preserved", () => {
  for (const id of ["markdown-reading","file-navigation"])
    assert.equal(normalizeConfig({features:{[id]:false}}).features[id],false);
});
