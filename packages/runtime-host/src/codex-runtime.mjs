// CodexRuntime：Codex Renderer 生命周期与 host action 执行。
// 注入源（createInjectionSource）与 CDP 客户端分别在 codex-injection.mjs / codex-cdp.mjs。

import { randomBytes } from "node:crypto";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  CODEX_APP_ORIGIN,
  HOST_BINDING_NAME,
  LOOPBACK_SURFACE_HOSTS,
  RUNTIME_VERSION,
  SURFACE_FRAME_PREFIX,
  SURFACE_LOAD_ACTION,
  createDocumentBootstrapSource,
  createInjectionSource,
  documentWithBase,
  findFrameByName,
  pageScriptServiceOrigin,
  requireDeclaredLoopbackSurface,
} from "./codex-injection.mjs";
import {
  connect,
  evaluationValue,
  processChildHasExited,
  requireCdpWebSocketUrl,
  waitForExpression,
  waitForProcessChildExit,
} from "./codex-cdp.mjs";
import {
  attachFileToComposer,
  attachFilesToComposer,
  createImageEditThread,
} from "./host-actions.mjs";
import { SessionStatusReader, threadIdFromLocation } from "./session-status-reader.mjs";


// 保持公共入口兼容：历史 import 从本文件继续可用。
export {
  RESPONSIVE_SUMMARY_LAYOUT,
  createInjectionSource,
  createRuntimeReadyContract,
  pageScriptServiceOrigin,
  responsiveSummaryContentShift,
  responsiveSummaryDisplayMode,
  responsiveSummaryVisibleSurface,
} from "./codex-injection.mjs";

export const SESSION_STATUS_THREAD_ID_EXPRESSION = `(() => {
  const composer = document.querySelector('[data-codex-composer="true"][contenteditable="true"]')
    ?? document.querySelector('[contenteditable="true"][role="textbox"]');
  const card = composer?.closest('[data-codex-composer-root]');
  const portal = card?.querySelector('[data-above-composer-portal]');
  if (portal) return portal.getAttribute('data-above-composer-conversation-id');
  if (card?.getAttribute('data-composer-placement') === 'home') return null;
  const selected = document.querySelector('[data-app-action-sidebar-thread-selected="true"]');
  return selected?.getAttribute('data-app-action-sidebar-thread-id')
    ?? location.pathname + location.search + location.hash;
})()`;

export class CodexRuntime {
  constructor({
    features,
    profileDir,
    appPath = "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT",
    cdpPort = 9231,
    logger = console,
    fetchImpl = globalThis.fetch,
    launchApplication = null,
    connectClient = connect,
    sleep = (timeoutMs) => new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    availabilityTimeoutMs = 20_000,
    availabilityPollMs = 500,
    monitorIntervalMs = 2_000,
    surfaceLoadTimeoutMs = 5_000,
    surfaceFramePollMs = 25,
    featureInstanceId = null,
    runtimeSessionId = randomBytes(16).toString("hex"),
    onStatusChange = null,
    onManagedCodexPidChange = null,
  }) {
    this.features = features;
    this.profileDir = profileDir;
    this.appPath = appPath;
    this.cdpPort = cdpPort;
    this.logger = logger;
    this.fetchImpl = fetchImpl;
    this.launchApplication = launchApplication;
    this.connectClient = connectClient;
    this.sleep = sleep;
    this.availabilityTimeoutMs = availabilityTimeoutMs;
    this.availabilityPollMs = availabilityPollMs;
    this.monitorIntervalMs = monitorIntervalMs;
    this.surfaceLoadTimeoutMs = surfaceLoadTimeoutMs;
    this.surfaceFramePollMs = surfaceFramePollMs;
    this.featureInstanceId = featureInstanceId;
    this.runtimeSessionId = runtimeSessionId;
    this.onStatusChange = onStatusChange;
    this.onManagedCodexPidChange = onManagedCodexPidChange;
    this.injectedTargets = new Set();
    this.rendererTargetIds = new Set();
    this.targetFailures = new Map();
    this.clients = new Map();
    this.scriptIds = new Map();
    this.bindingTokens = new Map();
    this.hostActionChains = new Map();
    this.refreshPromise = null;
    this.stopping = false;
    this.monitorPromise = null;
    this.browserClient = null;
    this.targetRefreshQueued = false;
    this.appPid = null;
    this.managedCodexChild = null;
    this.monitorTimer = null;
    this.monitorWake = null;
    this.stopPromise = null;
    this.pidChangePromise = Promise.resolve();
    this.pidChangeQueue = null;
    this.rendererDiscovered = false;
    this.lastRendererStatus = null;
    this.sessionStatusReader = features.some((feature) => feature.id === "session-status")
      ? new SessionStatusReader() : null;
  }

  async start({ launchCodex = false } = {}) {
    this.stopping = false;
    await mkdir(this.profileDir, { recursive: true });
    const available = await this.isAvailable();
    if (!available && launchCodex) {
      const child = this.launchManagedCodex();
      try {
        await this.waitUntilAvailable();
      } catch (error) {
        if (this.managedCodexChild === child && !processChildHasExited(child)) {
          child.kill?.("SIGTERM");
          const exited = await waitForProcessChildExit(child, 500);
          if (!exited && !processChildHasExited(child)) {
            child.kill?.("SIGKILL");
            await waitForProcessChildExit(child, 500);
          }
        }
        throw error;
      }
    }

    if (available || launchCodex) {
      await this.startTargetDiscovery();
      await this.refresh();
    } else {
      this.notifyStatusChange();
    }
    await this.flushManagedCodexPidChange();
    this.monitorPromise = this.monitor();
  }

  getRendererStatus() {
    const injectedTargets = this.injectedTargets.size;
    const discoveredTargets = this.rendererTargetIds.size;
    const targetFailures = Array.from(this.targetFailures, ([targetId, failure]) => ({
      targetId,
      attempts: failure.attempts,
      state: "retrying",
      lastFailure: failure.lastFailure,
    })).sort((left, right) => left.targetId.localeCompare(right.targetId));
    const active = !this.stopping && this.rendererDiscovered && injectedTargets > 0;
    return {
      discovered: this.rendererDiscovered,
      discoveredTargets,
      injectedTargets,
      active,
      healthy: active && targetFailures.length === 0 && injectedTargets === discoveredTargets,
      targetFailures,
      runtimeSessionId: this.runtimeSessionId,
    };
  }

  notifyStatusChange() {
    const status = this.getRendererStatus();
    const previous = this.lastRendererStatus;
    if (
      previous
      && previous.discovered === status.discovered
      && previous.discoveredTargets === status.discoveredTargets
      && previous.injectedTargets === status.injectedTargets
      && previous.active === status.active
      && previous.healthy === status.healthy
      && JSON.stringify(previous.targetFailures) === JSON.stringify(status.targetFailures)
      && previous.runtimeSessionId === status.runtimeSessionId
    ) return;
    this.lastRendererStatus = status;
    try {
      this.onStatusChange?.(status);
    } catch (error) {
      this.logger.warn?.("Runtime status update failed", error.message);
    }
  }

  notifyManagedCodexPidChange(pid) {
    const invoke = () => {
      try {
        return this.onManagedCodexPidChange?.(pid);
      } catch (error) {
        this.logger.warn?.("Managed Codex PID update failed", error.message);
        return null;
      }
    };
    const next = this.pidChangeQueue
      ? this.pidChangeQueue.catch(() => {}).then(invoke)
      : invoke();
    const tracked = Promise.resolve(next).catch((error) => {
      this.logger.warn?.("Managed Codex PID update failed", error.message);
    });
    const settled = tracked.finally(() => {
      if (this.pidChangeQueue === settled) this.pidChangeQueue = null;
    });
    this.pidChangeQueue = settled;
    this.pidChangePromise = settled;
  }

  async flushManagedCodexPidChange() {
    await this.pidChangePromise;
  }

  clearRendererState() {
    for (const client of this.clients.values()) client.socket.close();
    this.clients.clear();
    this.scriptIds.clear();
    this.bindingTokens.clear();
    this.hostActionChains.clear();
    this.injectedTargets.clear();
    this.rendererTargetIds.clear();
    this.targetFailures.clear();
    this.rendererDiscovered = false;
    this.browserClient?.socket.close();
    this.browserClient = null;
    this.notifyStatusChange();
  }

  markCodexUnavailable(error) {
    this.clearRendererState();
    return error;
  }

  launchManagedCodex() {
    if (typeof this.launchApplication !== "function") {
      throw new Error("CodexRuntime requires an explicit application launcher for isolated tests.");
    }
    const child = this.launchApplication({
      appPath: this.appPath,
      args: [
        `--user-data-dir=${this.profileDir}`,
        "--remote-debugging-address=127.0.0.1",
        `--remote-debugging-port=${this.cdpPort}`,
        `--remote-allow-origins=http://127.0.0.1:${this.cdpPort}`,
        "--no-first-run",
      ],
    });
    this.managedCodexChild = child;
    this.appPid = child.pid ?? null;
    this.notifyManagedCodexPidChange(this.appPid);
    let handled = false;
    const onExit = () => {
      if (handled) return;
      handled = true;
      if (this.managedCodexChild !== child) return;
      this.managedCodexChild = null;
      this.appPid = null;
      this.notifyManagedCodexPidChange(null);
      if (this.stopping) return;
      this.clearRendererState();
    };
    child.once?.("exit", onExit);
    child.once?.("error", (error) => {
      this.logger.warn?.("Managed Codex exited before CDP became available", error.message);
      onExit();
    });
    child.unref?.();
    return child;
  }

  queueTargetRefresh() {
    if (this.targetRefreshQueued || this.stopping) return;
    this.targetRefreshQueued = true;
    queueMicrotask(() => {
      this.targetRefreshQueued = false;
      if (this.stopping) return;
      this.refresh().catch((error) => {
        this.logger.warn?.("Waiting for Codex renderer", error.message);
      });
    });
  }

  async startTargetDiscovery() {
    const response = await this.fetchImpl(`http://127.0.0.1:${this.cdpPort}/json/version`);
    if (!response?.ok) {
      throw new Error(`Codex CDP version returned HTTP ${response?.status ?? "error"}`);
    }
    const version = await response.json();
    const webSocketDebuggerUrl = requireCdpWebSocketUrl(version, this.cdpPort);
    let client;
    try {
      client = await this.connectClient(webSocketDebuggerUrl);
      for (const method of [
        "Target.targetCreated",
        "Target.targetInfoChanged",
        "Target.targetDestroyed",
      ]) {
        client.on(method, () => this.queueTargetRefresh());
      }
      await client.send("Target.setDiscoverTargets", { discover: true });
      this.browserClient = client;
    } catch (error) {
      client?.socket.close();
      if (this.browserClient === client) this.browserClient = null;
      this.logger.warn?.("CDP target discovery unavailable; using /json/list polling", error.message);
    }
  }

  refresh() {
    if (this.refreshPromise) return this.refreshPromise;
    const refresh = this.refreshTargets()
      .catch((error) => {
        if (!this.rendererDiscovered) this.notifyStatusChange();
        throw error;
      })
      .finally(() => {
        if (this.refreshPromise === refresh) this.refreshPromise = null;
      });
    this.refreshPromise = refresh;
    return refresh;
  }

  async monitor() {
    while (!this.stopping) {
      await new Promise((resolve) => {
        this.monitorWake = () => {
          this.monitorWake = null;
          if (this.monitorTimer) clearTimeout(this.monitorTimer);
          this.monitorTimer = null;
          resolve();
        };
        this.monitorTimer = setTimeout(() => {
          this.monitorTimer = null;
          this.monitorWake = null;
          resolve();
        }, this.monitorIntervalMs);
      });
      if (this.stopping) break;
      try {
        await this.refresh();
      } catch (error) {
        this.logger.warn?.("Waiting for Codex renderer", error.message);
      }
    }
  }

  async isAvailable() {
    try {
      const response = await this.fetchImpl(`http://127.0.0.1:${this.cdpPort}/json/version`);
      if (!response?.ok) return false;
      requireCdpWebSocketUrl(await response.json(), this.cdpPort);
      return true;
    } catch {
      return false;
    }
  }

  async waitUntilAvailable() {
    const deadline = Date.now() + this.availabilityTimeoutMs;
    while (Date.now() < deadline) {
      if (this.stopping) throw new Error("RuntimeHost is stopping");
      if (await this.isAvailable()) return;
      await this.sleep(this.availabilityPollMs);
    }
    throw new Error(`Codex CDP did not become available on port ${this.cdpPort}`);
  }

  enqueueHostAction(targetId, operation) {
    const previous = this.hostActionChains.get(targetId) ?? Promise.resolve();
    const next = previous.then(operation, operation).finally(() => {
      if (this.hostActionChains.get(targetId) === next) this.hostActionChains.delete(targetId);
    });
    this.hostActionChains.set(targetId, next);
    return next;
  }

  async resolveHostAction(client, requestId, response) {
    const expression = `window.__codexPersonalRuntime?.resolveHostAction(${JSON.stringify(
      requestId,
    )}, ${JSON.stringify(response)})`;
    await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  }

  async fetchSurfaceResource(url, label) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.surfaceLoadTimeoutMs);
    try {
      return await this.fetchImpl(url, {
        cache: "no-store",
        headers: { origin: CODEX_APP_ORIGIN },
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw Object.assign(new Error(`${label} timed out`), { code: "SURFACE_LOAD_TIMEOUT" });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async verifiedSurfaceDocument(feature, surfaceUrl) {
    requireDeclaredLoopbackSurface(feature, surfaceUrl);
    if (!this.featureInstanceId || !feature.healthUrl) {
      throw Object.assign(new Error("Surface service identity is unavailable"), {
        code: "SURFACE_IDENTITY_UNAVAILABLE",
      });
    }
    const healthResponse = await this.fetchSurfaceResource(feature.healthUrl, "Surface health check");
    if (!healthResponse?.ok) {
      throw Object.assign(new Error(`Surface health returned HTTP ${healthResponse?.status ?? "error"}`), {
        code: "SURFACE_HEALTH_FAILED",
      });
    }
    let health;
    try {
      health = await healthResponse.json();
    } catch {
      throw Object.assign(new Error("Surface health returned invalid JSON"), {
        code: "SURFACE_HEALTH_FAILED",
      });
    }
    if (
      health?.ok !== true
      || health.service !== feature.id
      || health.protocolVersion !== 1
      || health.instanceId !== this.featureInstanceId
    ) {
      throw Object.assign(new Error("Surface service identity does not match this RuntimeHost"), {
        code: "SURFACE_IDENTITY_MISMATCH",
      });
    }

    const response = await this.fetchSurfaceResource(surfaceUrl, "Surface document request");
    if (!response?.ok) {
      throw Object.assign(new Error(`Surface document returned HTTP ${response?.status ?? "error"}`), {
        code: "SURFACE_DOCUMENT_FAILED",
      });
    }
    const contentType = String(response.headers?.get?.("content-type") ?? "").toLowerCase();
    if (!contentType.startsWith("text/html")) {
      throw Object.assign(new Error("Surface document must be HTML"), {
        code: "SURFACE_DOCUMENT_INVALID",
      });
    }
    return documentWithBase(await response.text(), surfaceUrl);
  }

  async loadSurfaceIntoFrame(client, feature, payload = {}) {
    const frameName = payload.frameName;
    if (
      typeof frameName !== "string"
      || !frameName.startsWith(SURFACE_FRAME_PREFIX)
      || frameName.length > 256
    ) {
      throw Object.assign(new Error("Surface frame identity is invalid"), {
        code: "SURFACE_FRAME_INVALID",
      });
    }
    const surfaceUrl = payload.surfaceUrl;
    const html = await this.verifiedSurfaceDocument(feature, surfaceUrl);
    const deadline = Date.now() + this.surfaceLoadTimeoutMs;
    let frame = null;
    while (!frame && Date.now() < deadline) {
      const { frameTree } = await client.send("Page.getFrameTree");
      frame = findFrameByName(frameTree, frameName);
      if (!frame) await this.sleep(this.surfaceFramePollMs);
    }
    if (!frame) {
      throw Object.assign(new Error("Surface frame was not discovered"), {
        code: "SURFACE_FRAME_NOT_FOUND",
      });
    }
    if (frame.url !== "about:blank") {
      throw Object.assign(new Error("Surface frame must remain at about:blank before loading"), {
        code: "SURFACE_FRAME_INVALID",
      });
    }
    await client.send("Page.setDocumentContent", { frameId: frame.id, html });
    return { loaded: true };
  }

  // 薄转发：host action 实现已迁至 host-actions.mjs，
  // 保留方法入口以稳定测试与 handleBindingCalled 路由。
  attachFileToComposer(client, filePath, requestId) {
    return attachFileToComposer(client, filePath, requestId);
  }

  attachFilesToComposer(client, filePaths, requestId) {
    return attachFilesToComposer(client, filePaths, requestId);
  }

  createImageEditThread(client, feature, payload, requestId) {
    return createImageEditThread(client, feature, payload, requestId, {
      fetchImpl: this.fetchImpl,
      attachFiles: (_client, filePaths, _requestId) => this.attachFilesToComposer(client, filePaths, requestId),
    });
  }


  async handleBindingCalled(targetId, client, params) {
    if (params.name !== HOST_BINDING_NAME) return;
    let request;
    try {
      request = JSON.parse(params.payload);
    } catch {
      return;
    }
    if (request.token !== this.bindingTokens.get(targetId) || typeof request.requestId !== "string") return;
    const feature = this.features.find((candidate) => candidate.id === request.featureId);
    if (feature && request.action === SURFACE_LOAD_ACTION) {
      try {
        const result = await this.loadSurfaceIntoFrame(client, feature, request.payload);
        await this.resolveHostAction(client, request.requestId, { ok: true, result });
      } catch (error) {
        await this.resolveHostAction(client, request.requestId, {
          ok: false,
          error: { code: error.code ?? "SURFACE_LOAD_FAILED", message: error.message },
        });
      }
      return;
    }
    if (!feature?.hostActions?.includes(request.action)) {
      await this.resolveHostAction(client, request.requestId, {
        ok: false,
        error: { code: "ACTION_NOT_ALLOWED", message: "Host action is not registered" },
      });
      return;
    }
    if (request.action === "import-generated-image") {
      await this.importGeneratedImage(feature, request.payload);
      return;
    }
    try {
      const result = request.action === "create-image-edit-thread"
        ? await this.createImageEditThread(client, feature, request.payload, request.requestId)
        : await this.attachFileToComposer(client, request.payload?.path, request.requestId);
      await this.resolveHostAction(client, request.requestId, { ok: true, result });
    } catch (error) {
      await this.resolveHostAction(client, request.requestId, {
        ok: false,
        error: { code: error.code ?? "ATTACH_FAILED", message: error.message },
      });
    }
  }

  async importGeneratedImage(feature, payload) {
    const origin = pageScriptServiceOrigin(feature);
    if (!origin) throw new Error("Generated image import service is unavailable");
    const response = await this.fetchImpl(new URL("/api/import-generated-image", origin), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: CODEX_APP_ORIGIN,
      },
      body: JSON.stringify(payload),
    });
    if (!response?.ok) {
      throw new Error(`Generated image import returned HTTP ${response?.status ?? "error"}`);
    }
  }

  async refreshTargets() {
    let response;
    try {
      response = await this.fetchImpl(`http://127.0.0.1:${this.cdpPort}/json/list`);
    } catch (error) {
      throw this.markCodexUnavailable(error);
    }
    if (!response?.ok) {
      throw this.markCodexUnavailable(
        new Error(`Codex target list returned HTTP ${response?.status ?? "error"}`),
      );
    }
    let targets;
    try {
      targets = await response.json();
    } catch (error) {
      throw this.markCodexUnavailable(error);
    }
    if (!Array.isArray(targets)) {
      throw this.markCodexUnavailable(new Error("Codex target list was not an array"));
    }
    const liveRendererIds = new Set(
      targets
        .filter((target) => target.type === "page" && target.url === "app://-/index.html")
        .map((target) => target.id),
    );
    this.rendererTargetIds = liveRendererIds;
    let removedTarget = false;
    const trackedTargetIds = new Set([
      ...this.injectedTargets,
      ...this.clients.keys(),
      ...this.targetFailures.keys(),
    ]);
    for (const id of trackedTargetIds) {
      if (liveRendererIds.has(id)) continue;
      removedTarget = true;
      this.clients.get(id)?.socket.close();
      this.clients.delete(id);
      this.scriptIds.delete(id);
      this.bindingTokens.delete(id);
      this.hostActionChains.delete(id);
      this.injectedTargets.delete(id);
      this.targetFailures.delete(id);
    }
    const rendererDiscovered = liveRendererIds.size > 0;
    const rendererChanged = rendererDiscovered !== this.rendererDiscovered;
    this.rendererDiscovered = rendererDiscovered;
    if (removedTarget || rendererChanged) this.notifyStatusChange();

    for (const target of targets) {
      if (target.type !== "page" || target.url !== "app://-/index.html" || this.injectedTargets.has(target.id)) {
        continue;
      }
      const previousFailure = this.targetFailures.get(target.id);
      if (previousFailure && Date.now() < previousFailure.nextRetryAt) continue;
      let client;
      let scriptIdentifier = null;
      try {
        client = await this.connectClient(target.webSocketDebuggerUrl);
        await Promise.all([
          client.send("Page.enable"),
          client.send("Runtime.enable"),
          client.send("DOM.enable"),
        ]);
        await client.send("Page.setBypassCSP", { enabled: true });
        await client.send("Runtime.removeBinding", { name: HOST_BINDING_NAME }).catch(() => {});
        await client.send("Runtime.addBinding", { name: HOST_BINDING_NAME });
        const bindingToken = randomBytes(24).toString("hex");
        this.bindingTokens.set(target.id, bindingToken);
        client.on?.("Runtime.bindingCalled", (params) => {
          this.enqueueHostAction(target.id, () => this.handleBindingCalled(target.id, client, params))
            .catch((error) => this.logger.warn?.("Codex Host action failed", error.message));
        });
        const source = createInjectionSource(this.features, {
          bindingToken,
          runtimeSessionId: this.runtimeSessionId,
        });
        const script = await client.send("Page.addScriptToEvaluateOnNewDocument", {
          source: createDocumentBootstrapSource(source),
        });
        scriptIdentifier = script.identifier;
        await waitForExpression(
          client,
          `document.readyState === "interactive" || document.readyState === "complete"`,
        );
        await client.send("Page.setBypassCSP", { enabled: true });
        await client.send("Runtime.evaluate", { expression: source, awaitPromise: true });
        await waitForExpression(
          client,
          `window.__codexPersonalRuntime?.version === ${RUNTIME_VERSION}`
            + ` && window.__codexPersonalRuntime?.sessionId === ${JSON.stringify(this.runtimeSessionId)}`,
        );
        this.clients.set(target.id, client);
        this.scriptIds.set(target.id, scriptIdentifier);
        this.injectedTargets.add(target.id);
        this.targetFailures.delete(target.id);
        this.notifyStatusChange();
      } catch (error) {
        this.bindingTokens.delete(target.id);
        if (client) {
          if (scriptIdentifier) {
            await client.send("Page.removeScriptToEvaluateOnNewDocument", {
              identifier: scriptIdentifier,
            }).catch(() => {});
          }
          await client.send("Runtime.removeBinding", { name: HOST_BINDING_NAME }).catch(() => {});
          client.socket.close();
        }
        const attempts = (previousFailure?.attempts ?? 0) + 1;
        const retryDelay = Math.min(5_000, 250 * (2 ** Math.min(attempts - 1, 5)));
        this.targetFailures.set(target.id, {
          attempts,
          lastFailure: error.message,
          nextRetryAt: Date.now() + retryDelay,
        });
        this.logger.warn?.(`Renderer injection failed for ${target.id}; retrying`, error.message);
        this.notifyStatusChange();
      }
    }
    if (this.sessionStatusReader) await this.publishSessionStatus();
    this.notifyStatusChange();
  }

  async publishSessionStatus() {
    for (const [targetId, client] of this.clients) {
      if (!this.injectedTargets.has(targetId)) continue;
      try {
        const response = await client.send("Runtime.evaluate", {
          expression: SESSION_STATUS_THREAD_ID_EXPRESSION,
          returnByValue: true,
        });
        const threadId = threadIdFromLocation(response.result?.value);
        const snapshot = threadId ? await this.sessionStatusReader.read(threadId) : null;
        await client.send("Runtime.evaluate", {
          expression: `window.__minecodexSessionStatus?.update(${JSON.stringify(snapshot)})`,
          returnByValue: true,
        });
      } catch (error) {
        this.logger.warn?.("Session Status update failed", error.message);
      }
    }
  }

  async stop() {
    if (this.stopPromise) return this.stopPromise;
    this.stopPromise = (async () => {
      this.stopping = true;
      this.targetRefreshQueued = false;
      this.monitorWake?.();
      await this.monitorPromise?.catch(() => {});
      await Promise.all(Array.from(this.clients, async ([targetId, client]) => {
        const identifier = this.scriptIds.get(targetId);
        await client.send("Runtime.evaluate", {
          expression: "window.__codexPersonalRuntime?.dispose?.()",
          awaitPromise: true,
          returnByValue: true,
        }).catch(() => {});
        if (identifier) {
          await client.send("Page.removeScriptToEvaluateOnNewDocument", { identifier }).catch(() => {});
        }
        await client.send("Runtime.removeBinding", { name: HOST_BINDING_NAME }).catch(() => {});
        client.socket.close();
      }));
      this.browserClient?.socket.close();
      this.browserClient = null;
      this.clients.clear();
      this.scriptIds.clear();
      this.bindingTokens.clear();
      this.hostActionChains.clear();
      this.injectedTargets.clear();
      this.rendererTargetIds.clear();
      this.targetFailures.clear();
      this.rendererDiscovered = false;
      this.notifyStatusChange();
      this.monitorPromise = null;
    })();
    return this.stopPromise;
  }
}
