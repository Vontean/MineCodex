import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
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
    assert.deepEqual(initial.features.map(feature => feature.label), ["模型窗口", "提示词库", "额度环", "会话状态", "Markdown 阅读增强", "Mermaid 图表增强（实验性）", "文件级联浏览", "Files 自动刷新", "图片集合", "站点收藏", "快捷聊天增强", "长指令展开编辑", "侧栏聚焦"]);
    assert.equal(initial.features.some(feature=>feature.id==="unread-inbox"),false);
    const retiredIcon=await fetch(`${origin}/api/icons/unread-inbox.svg`,{headers:{Cookie:cookie}});
    assert.equal(retiredIcon.status,404);
    const retiredEnable=await fetch(`${origin}/api/features/unread-inbox`,{
      method:"PATCH",headers:{Cookie:cookie,Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({enabled:true}),
    });
    assert.equal(retiredEnable.status,404);
    assert.equal(initial.features.find((feature) => feature.id === "usage-meter").label, "额度环");
    assert.equal(initial.features.filter(feature=>!["markdown-reading", "mermaid-diagrams", "file-navigation"].includes(feature.id)).every((feature) => feature.enabled), true);
    assert.equal(initial.features.find((feature) => feature.id === "images").label, "图片集合");
    assert.equal(initial.features.find((feature) => feature.id === "session-status").label, "会话状态");

    assert.equal(initial.features.find(feature=>feature.id==="markdown-reading").enabled,true);
    assert.equal(initial.features.find(feature=>feature.id==="mermaid-diagrams").enabled,false);
    assert.equal(initial.features.find(feature=>feature.id==="file-navigation").enabled,true);
    assert.equal(initial.features.find(feature=>feature.id==="markdown-reading").label,"Markdown 阅读增强");

    const english = await (await fetch(`${origin}/api/features`, {
      headers: { Cookie: cookie, "Accept-Language": "fr-FR" },
    })).json();
    assert.equal(english.features.find((feature) => feature.id === "session-status").label, "Session Status");

    const sessionSaved = await fetch(`${origin}/api/features/session-status`, {
      method: "PATCH",
      headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    const sessionSavedState = await sessionSaved.json();
    assert.equal(sessionSavedState.saved, true);
    assert.equal(sessionSavedState.features.find((feature) => feature.id === "session-status").enabled, false);
    assert.equal(sessionSavedState.pendingRestart, true);

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
    assert.equal(restartedState.features.find((feature) => feature.id === "session-status").applied, false);

    const dashboard = await fetch(origin);
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /MineCodex/);

    const icon = await fetch(`${origin}/api/icons/model-slider.svg`, { headers: { Cookie: cookie } });
    assert.equal(icon.status, 200);
    assert.match(icon.headers.get("content-type"), /image\/svg\+xml/);

    const bannerIcon = await fetch(`${origin}/api/icons/hide-upsell-banner.svg`, { headers: { Cookie: cookie } });
    assert.equal(bannerIcon.status, 404);

    const usageIcon = await fetch(`${origin}/api/icons/usage-meter.svg`, { headers: { Cookie: cookie } });
    assert.equal(usageIcon.status, 200);
    assert.match(await usageIcon.text(), /<circle/);

    for (const id of ["sidebar-focus", "sites", "markdown-reading", "file-navigation", "files-auto-refresh"]) {
      const response = await fetch(`${origin}/api/icons/${id}.svg`, { headers: { Cookie: cookie } });
      assert.equal(response.status, 200, `${id} must have a dashboard icon`);
      assert.match(await response.text(), /<svg[^>]+viewBox="0 0 24 24"/);
    }

    for (const feature of initial.features) {
      const svg = await (await fetch(`${origin}${feature.iconUrl}`, { headers: { Cookie: cookie } })).text();
      assert.match(svg, /stroke-width="2\.1"/, `${feature.id} must match the Prompts stroke`);
      assert.match(svg, /viewBox="0 0 24 24"/);
      assert.doesNotMatch(svg, /undefined/);
      assert.match(svg, /<(path|circle|rect|line|polyline|polygon)\b/);
    }

    const sessionIcon = await fetch(`${origin}/api/icons/session-status.svg`, { headers: { Cookie: cookie } });
    assert.equal(sessionIcon.status, 200);
    assert.match(sessionIcon.headers.get("content-type"), /image\/svg\+xml/);
    assert.match(await sessionIcon.text(), /<svg/);
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
        { featureId: "images", state: "injected", owned: true, health: { service: "images", protocolVersion: 1, instanceId: "images-instance-1", ok: true }, failure: null },
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
        health: { service: "images", protocolVersion: 1, instanceId: "existing-images-instance", ok: true },
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

test("matching health identity is healthy only when ok is explicitly true", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-control-health-ok-"));
  const paths = {
    packageRoot: PACKAGE_ROOT,
    configPath: path.join(root, "config.json"),
    featuresRoot: path.join(PACKAGE_ROOT, "features"),
    dashboardDir: path.join(PACKAGE_ROOT, "apps", "dashboard"),
  };
  await writeConfig(paths.configPath, { schemaVersion: 1, features: {} });
  let health = { service: "images", protocolVersion: 1, instanceId: "images-health-ok-instance" };
  const runtimeManager = {
    status: () => ({
      running: true,
      runtimeSessionId: "runtime-session-health-ok",
      appliedFeatures: ["images"],
      plugins: [{ featureId: "images", state: "injected", owned: true, health, failure: null }],
      renderer: { discovered: true, injectedTargets: 1, active: true, runtimeSessionId: "runtime-session-health-ok" },
    }),
  };
  const server = await createControlServer({
    paths,
    token: "health-ok-secret",
    runtimeManager,
    port: 0,
    logger: { error() {} },
  });
  try {
    const authorization = { Authorization: "Bearer health-ok-secret" };
    const omitted = await (await fetch(`${server.url}/api/status`, { headers: authorization })).json();
    const omittedImages = omitted.features.find((feature) => feature.id === "images");
    assert.equal(omittedImages.state, "injected");
    assert.equal(omittedImages.healthy, false);

    health = { ...health, ok: true };
    const accepted = await (await fetch(`${server.url}/api/status`, { headers: authorization })).json();
    const acceptedImages = accepted.features.find((feature) => feature.id === "images");
    assert.equal(acceptedImages.state, "healthy");
    assert.equal(acceptedImages.healthy, true);
  } finally {
    await server.close();
  }
});

test("runtime unavailability reports enabled and disabled plugins stopped without a pending restart", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-control-runtime-stopped-"));
  const paths = {
    packageRoot: PACKAGE_ROOT,
    configPath: path.join(root, "config.json"),
    featuresRoot: path.join(PACKAGE_ROOT, "features"),
    dashboardDir: path.join(PACKAGE_ROOT, "apps", "dashboard"),
  };
  await writeConfig(paths.configPath, {
    schemaVersion: 1,
    features: { "model-slider": false, notes: true, images: false },
  });
  let running = false;
  const runtimeManager = {
    status: () => running
      ? { running: true, appliedFeatures: [], plugins: [], renderer: null }
      : {
        running: false,
        appliedFeatures: ["images"],
        plugins: [{
          featureId: "notes",
          state: "failed",
          owned: true,
          health: null,
          failure: { code: "STALE_FAILURE", message: "Stale runtime failure", phase: "health" },
        }],
        renderer: null,
      },
  };
  const server = await createControlServer({
    paths,
    token: "runtime-stopped-secret",
    runtimeManager,
    port: 0,
    logger: { error() {} },
  });
  try {
    const authorization = { Authorization: "Bearer runtime-stopped-secret" };
    const stopped = await (await fetch(`${server.url}/api/status`, { headers: authorization })).json();
    assert.equal(stopped.runtime.running, false);
    assert.equal(stopped.features.find((feature) => feature.id === "notes").enabled, true);
    assert.equal(stopped.features.find((feature) => feature.id === "notes").state, "stopped");
    assert.equal(stopped.features.find((feature) => feature.id === "images").enabled, false);
    assert.equal(stopped.features.find((feature) => feature.id === "images").state, "stopped");
    assert.equal(stopped.pendingRestart, false);

    running = true;
    const runningMismatch = await (await fetch(`${server.url}/api/status`, { headers: authorization })).json();
    assert.equal(runningMismatch.features.find((feature) => feature.id === "notes").state, "restart-required");
    assert.equal(runningMismatch.pendingRestart, true);
  } finally {
    await server.close();
  }
});


test("dashboard media uses explicit MIME and CSP while browser authentication remains required", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mcx-dashboard-media-http-"));
  await mkdir(path.join(root, "assets/previews"), {recursive:true});
  for (const name of ["test.webm", "test.mp4", "test.webp", "manifest.json"]) await writeFile(path.join(root, "assets/previews", name), "test-only");
  const service = await createControlServer({paths:{dashboardDir:root}, token:"media-test", port:0, runtimeManager:{status:()=>({running:false})}});
  try {
    assert.equal((await fetch(service.url + "/api/status")).status,401);
    for (const [name, type] of [["test.webm","video/webm"],["test.mp4","video/mp4"],["test.webp","image/webp"],["manifest.json","application/json; charset=utf-8"]]) {
      const response = await fetch(service.url + "/assets/previews/" + name,{headers:{Authorization:"Bearer media-test"}});
      assert.equal(response.status,200);
      assert.equal(response.headers.get("content-type"),type);
      assert.match(response.headers.get("content-security-policy"),/media-src 'self' data: blob:/);
      assert.match(response.headers.get("content-security-policy"),/script-src 'self';/);
    }
  } finally {await service.close();await rm(root,{recursive:true,force:true});}
});
