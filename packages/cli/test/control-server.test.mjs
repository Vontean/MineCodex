import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeConfig } from "../src/config.mjs";
import { createControlServer } from "../src/control-server.mjs";
import { PACKAGE_ROOT } from "../src/paths.mjs";

test("control server exchanges one-time URL auth for a cookie and protects mutations", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-control-"));
  const paths = {
    packageRoot: PACKAGE_ROOT,
    configPath: path.join(root, "config.json"),
    featuresRoot: path.join(PACKAGE_ROOT, "features"),
    dashboardDir: path.join(PACKAGE_ROOT, "apps", "dashboard"),
  };
  await writeConfig(paths.configPath, { schemaVersion: 1, features: {} });
  let appliedFeatures = ["model-slider", "notes", "images"];
  const runtimeManager = {
    status: () => ({ running: true, appliedFeatures }),
    restart: async () => {
      const config = JSON.parse(await (await import("node:fs/promises")).readFile(paths.configPath, "utf8"));
      appliedFeatures = Object.entries(config.features).filter(([, enabled]) => enabled).map(([id]) => id);
    },
  };
  const server = await createControlServer({ paths, token: "secret-token", runtimeManager, port: 0, logger: { error() {} } });
  const origin = server.url;
  try {
    const unauthorized = await fetch(`${origin}/api/status`);
    assert.equal(unauthorized.status, 401);

    const auth = await fetch(`${origin}/auth?token=secret-token`, { redirect: "manual" });
    assert.equal(auth.status, 303);
    assert.equal(auth.headers.get("location"), "/");
    assert.match(auth.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
    const cookie = auth.headers.get("set-cookie").split(";", 1)[0];

    const status = await fetch(`${origin}/api/status`, { headers: { Cookie: cookie, "Accept-Language": "zh-CN" } });
    const initial = await status.json();
    assert.equal(initial.features.length, 3);
    assert.equal(initial.features.every((feature) => feature.enabled), true);
    assert.equal(initial.features.find((feature) => feature.id === "images").label, "图片");

    const forged = await fetch(`${origin}/api/features/notes`, {
      method: "PATCH",
      headers: { Cookie: cookie, Origin: "https://example.com", "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    assert.equal(forged.status, 403);

    const saved = await fetch(`${origin}/api/features/notes`, {
      method: "PATCH",
      headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    const savedState = await saved.json();
    assert.equal(savedState.pendingRestart, true);

    const restarted = await fetch(`${origin}/api/restart`, {
      method: "POST",
      headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" },
      body: "{}",
    });
    const restartedState = await restarted.json();
    assert.equal(restartedState.features.find((feature) => feature.id === "notes").applied, false);

    const dashboard = await fetch(origin);
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /MineCodex/);

    const icon = await fetch(`${origin}/api/icons/model-slider.svg`, { headers: { Cookie: cookie } });
    assert.equal(icon.status, 200);
    assert.match(icon.headers.get("content-type"), /image\/svg\+xml/);
  } finally {
    await server.close();
  }
});
