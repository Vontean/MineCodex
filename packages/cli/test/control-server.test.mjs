import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { BrowserExchangeStore } from "../src/browser-exchange.mjs";
import { writeConfig } from "../src/config.mjs";
import { createControlServer } from "../src/control-server.mjs";
import { PACKAGE_ROOT } from "../src/paths.mjs";

test("browser exchange values expire and are single-use", () => {
  let now = 100;
  const store = new BrowserExchangeStore({ ttlMs: 10, now: () => now, createValue: () => "exchange-1" });
  const value = store.issue("long-lived-token");
  assert.equal(store.consume(value), "long-lived-token");
  assert.throws(() => store.consume(value), /invalid or expired/);
  const second = store.issue("long-lived-token");
  now = 111;
  assert.throws(() => store.consume(second), /invalid or expired/);
});

test("control server exchanges a short-lived one-time value for a cookie and protects mutations", async () => {
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

    const longLivedInUrl = await fetch(`${origin}/auth?token=secret-token`, { redirect: "manual" });
    assert.equal(longLivedInUrl.status, 403);

    const exchangeResponse = await fetch(`${origin}/api/auth/exchange`, {
      method: "POST",
      headers: { Authorization: "Bearer secret-token", Origin: origin, "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(exchangeResponse.status, 200);
    const { exchange } = await exchangeResponse.json();
    assert.ok(exchange);

    const auth = await fetch(`${origin}/auth?exchange=${encodeURIComponent(exchange)}`, { redirect: "manual" });
    assert.equal(auth.status, 303);
    assert.equal(auth.headers.get("location"), "/");
    assert.match(auth.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
    const cookie = auth.headers.get("set-cookie").split(";", 1)[0];

    const reused = await fetch(`${origin}/auth?exchange=${encodeURIComponent(exchange)}`, { redirect: "manual" });
    assert.equal(reused.status, 403);

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

    await Promise.all([
      fetch(`${origin}/api/features/notes`, {
        method: "PATCH",
        headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      }),
      fetch(`${origin}/api/features/images`, {
        method: "PATCH",
        headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }),
    ]);
    const concurrentStatus = await (await fetch(`${origin}/api/status`, { headers: { Cookie: cookie } })).json();
    assert.equal(concurrentStatus.features.find((feature) => feature.id === "notes").enabled, true);
    assert.equal(concurrentStatus.features.find((feature) => feature.id === "images").enabled, false);

    const restarted = await fetch(`${origin}/api/restart`, {
      method: "POST",
      headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" },
      body: "{}",
    });
    const restartedState = await restarted.json();
    assert.equal(restartedState.features.find((feature) => feature.id === "notes").applied, true);
    assert.equal(restartedState.features.find((feature) => feature.id === "images").applied, false);

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

test("status consumes exact RuntimeHost plugin and renderer state, including failures", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-control-status-"));
  const paths = {
    packageRoot: PACKAGE_ROOT,
    configPath: path.join(root, "config.json"),
    featuresRoot: path.join(PACKAGE_ROOT, "features"),
    dashboardDir: path.join(PACKAGE_ROOT, "apps", "dashboard"),
  };
  await writeConfig(paths.configPath, { schemaVersion: 1, features: {} });
  const runtimeManager = {
    status: () => ({
      running: true,
      runtimeSessionId: "runtime-session-1",
      appliedFeatures: ["model-slider", "notes", "images"],
      plugins: [
        { featureId: "model-slider", state: "injected", owned: false, health: true, failure: null },
        { featureId: "notes", state: "failed", owned: true, health: null, failure: { code: "HEALTH_TIMEOUT", message: "Notes health timed out", phase: "health" } },
        { featureId: "images", state: "injected", owned: true, health: { service: "images", protocolVersion: 1, instanceId: "images-instance-1" }, failure: null },
      ],
      renderer: { discovered: true, injectedTargets: 3, active: true, runtimeSessionId: "runtime-session-1" },
    }),
  };
  const server = await createControlServer({ paths, token: "status-secret", runtimeManager, port: 0, logger: { error() {} } });
  try {
    const exchange = await fetch(`${server.url}/api/auth/exchange`, {
      method: "POST",
      headers: { Authorization: "Bearer status-secret", Origin: server.url, "Content-Type": "application/json" },
      body: "{}",
    });
    const { exchange: value } = await exchange.json();
    const auth = await fetch(`${server.url}/auth?exchange=${encodeURIComponent(value)}`, { redirect: "manual" });
    const cookie = auth.headers.get("set-cookie").split(";", 1)[0];
    const response = await fetch(`${server.url}/api/status`, { headers: { Cookie: cookie } });
    const status = await response.json();
    assert.equal(status.runtimeSessionId, "runtime-session-1");
    assert.equal(status.renderer.active, true);
    assert.equal(status.runtime.renderer.active, true);
    assert.equal(status.runtime.runtimeSessionId, "runtime-session-1");
    assert.equal(status.features.find((feature) => feature.id === "model-slider").state, "injected");
    assert.equal(status.features.find((feature) => feature.id === "images").state, "healthy");
    assert.equal(status.features.find((feature) => feature.id === "notes").state, "failed");
    assert.equal(status.features.find((feature) => feature.id === "notes").failure.code, "HEALTH_TIMEOUT");
  } finally {
    await server.close();
  }
});

test("a current-session verified service stays injected even when ownership provenance is false", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-control-owned-false-"));
  const paths = {
    packageRoot: PACKAGE_ROOT,
    configPath: path.join(root, "config.json"),
    featuresRoot: path.join(PACKAGE_ROOT, "features"),
    dashboardDir: path.join(PACKAGE_ROOT, "apps", "dashboard"),
  };
  await writeConfig(paths.configPath, { schemaVersion: 1, features: {} });
  const runtimeManager = {
    status: () => ({
      running: true,
      runtimeSessionId: "runtime-session-owned-false",
      appliedFeatures: ["images"],
      plugins: [{
        featureId: "images",
        state: "injected",
        owned: false,
        health: { service: "images", protocolVersion: 1, instanceId: "existing-images-instance" },
        failure: null,
      }],
      renderer: { discovered: true, injectedTargets: 1, active: true, runtimeSessionId: "runtime-session-owned-false" },
    }),
  };
  const server = await createControlServer({ paths, token: "owned-false-secret", runtimeManager, port: 0, logger: { error() {} } });
  try {
    const exchange = await fetch(`${server.url}/api/auth/exchange`, {
      method: "POST",
      headers: { Authorization: "Bearer owned-false-secret", Origin: server.url, "Content-Type": "application/json" },
      body: "{}",
    });
    const { exchange: value } = await exchange.json();
    const auth = await fetch(`${server.url}/auth?exchange=${encodeURIComponent(value)}`, { redirect: "manual" });
    const cookie = auth.headers.get("set-cookie").split(";", 1)[0];
    const status = await (await fetch(`${server.url}/api/status`, { headers: { Cookie: cookie } })).json();
    const images = status.features.find((feature) => feature.id === "images");
    assert.equal(images.state, "healthy");
    assert.equal(images.healthy, true);
  } finally {
    await server.close();
  }
});

test("boolean health is rejected even when the plugin is injected and renderer is current", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-control-bool-health-"));
  const paths = {
    packageRoot: PACKAGE_ROOT,
    configPath: path.join(root, "config.json"),
    featuresRoot: path.join(PACKAGE_ROOT, "features"),
    dashboardDir: path.join(PACKAGE_ROOT, "apps", "dashboard"),
  };
  await writeConfig(paths.configPath, { schemaVersion: 1, features: {} });
  const runtimeManager = {
    status: () => ({
      running: true,
      runtimeSessionId: "runtime-session-bool",
      appliedFeatures: ["images"],
      plugins: [{
        featureId: "images",
        state: "injected",
        owned: true,
        health: true,
        failure: null,
      }],
      renderer: { discovered: true, injectedTargets: 1, active: true, runtimeSessionId: "runtime-session-bool" },
    }),
  };
  const server = await createControlServer({ paths, token: "bool-health-secret", runtimeManager, port: 0, logger: { error() {} } });
  try {
    const exchange = await fetch(`${server.url}/api/auth/exchange`, {
      method: "POST",
      headers: { Authorization: "Bearer bool-health-secret", Origin: server.url, "Content-Type": "application/json" },
      body: "{}",
    });
    const { exchange: value } = await exchange.json();
    const auth = await fetch(`${server.url}/auth?exchange=${encodeURIComponent(value)}`, { redirect: "manual" });
    const cookie = auth.headers.get("set-cookie").split(";", 1)[0];
    const status = await (await fetch(`${server.url}/api/status`, { headers: { Cookie: cookie } })).json();
    const images = status.features.find((feature) => feature.id === "images");
    assert.equal(images.state, "injected");
    assert.equal(images.healthy, false);
  } finally {
    await server.close();
  }
});
