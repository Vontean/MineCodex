import { assertPromptsRequest } from "../../../features/notes/src/adapters/codex/requests.mjs";
import { LocalImageSource } from "../../../features/images/src/backend/local-image-source.mjs";
// CodexRuntime：Codex Renderer 生命周期与 host action 执行。
// 注入源（createInjectionSource）与 CDP 客户端分别在 codex-injection.mjs / codex-cdp.mjs。

import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  CODEX_APP_ORIGIN,
  HOST_BINDING_NAME,
  RUNTIME_VERSION,
  createDocumentBootstrapSource,
  createInjectionSource,
  pageScriptServiceOrigin,
} from "./codex-injection.mjs";
import {
  connect,
  processChildHasExited,
  requireCdpWebSocketUrl,
  waitForExpression,
  waitForProcessChildExit,
} from "./codex-cdp.mjs";
import { ModelFavorites } from "../../../features/model-slider/src/backend/favorites.mjs";
import { SitesService } from "../../../features/sites/src/backend/sites-service.mjs";
import { SessionStatusReader, threadIdFromLocation } from "../../../features/session-status/src/adapters/codex/session-reader.mjs";
import { createCodexEnvironment } from "../../codex-adapter/src/renderer/environment.mjs";


export {
  createInjectionSource,
  createRuntimeReadyContract,
  pageScriptServiceOrigin,
} from "./codex-injection.mjs";

export const SESSION_STATUS_THREAD_ID_EXPRESSION = `(() => {
  const codex = (${createCodexEnvironment.toString()})();
  return [...new Set([...document.querySelectorAll('[data-codex-composer-root]')]
    .map(root => codex.composerSurface(root)?.threadId).filter(Boolean))];
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
    codexBuild = null,
    runtimeSessionId = randomBytes(16).toString("hex"),
    onStatusChange = null,
    sitesService = null,
    onManagedCodexPidChange = null,
  }) {
    this.features = features;
    this.sitesService = sitesService ?? (features.some(feature => feature.id === "sites") ? new SitesService() : null);
    this.localImageSource = features.some(feature => feature.id === "images") ? new LocalImageSource({dataDir:path.join(profileDir,"minecodex-image-gen")}) : null;
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
    this.codexBuild = codexBuild;
    this.runtimeSessionId = runtimeSessionId;
    this.onStatusChange = onStatusChange;
    this.onManagedCodexPidChange = onManagedCodexPidChange;
    this.injectedTargets = new Set();
    this.rendererTargetIds = new Set();
    this.targetFailures = new Map();
    this.targetChecks = new Map();
    this.targetCheckDeadlines = new Map();
    this.clients = new Map();
    this.scriptIds = new Map();
    this.bindingTokens = new Map();
    this.hostActionChains = new Map();
    this.sessionStatusUpdates = new Map();
    this.sessionStatusRevision = 0;
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
      ...(this.codexBuild ? {codexBuild:this.codexBuild,buildSource:"installation-at-start"} : {}),
      discovered: this.rendererDiscovered,
      discoveredTargets,
      injectedTargets,
      active,
      healthy: active && targetFailures.length === 0 && injectedTargets === discoveredTargets,
      targetFailures,
      runtimeSessionId: this.runtimeSessionId,
      targets:[...this.rendererTargetIds].map(targetId => ({targetId,...(this.targetChecks.get(targetId) ?? {sessionId:this.runtimeSessionId,checkedAt:null,plugins:[],tokens:[],reason:"self-check-pending"})})),
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
      && JSON.stringify(previous.targets) === JSON.stringify(status.targets)
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
    this.targetChecks.clear();
    this.targetCheckDeadlines.clear();
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
    const response = await this.fetchImpl(`http://127.0.0.1:${this.cdpPort}/json/version`, {
      signal: AbortSignal.timeout(3_000),
    });
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
      const response = await this.fetchImpl(`http://127.0.0.1:${this.cdpPort}/json/version`, {
        signal: AbortSignal.timeout(3_000),
      });
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
    if (feature?.id === "session-status" && request.action === "refresh-session-status") {
      if (this.sessionStatusReader && this.clients.get(targetId) === client && !this.stopping) {
        await this.publishSessionStatus(targetId);
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
    if (feature.id === "images" && request.action === "local-image-source") {
      try {
        const result = await this.localImageSource.action(request.payload);
        await this.resolveHostAction(client, request.requestId, {ok:true,result});
      } catch (error) {
        await this.resolveHostAction(client, request.requestId, {ok:false,error:{code:"LOCAL_IMAGE_SOURCE_FAILED",message:error.message}});
      }
      return;
    }
    if (feature.id === "model-slider" && request.action === "model-favorites") {
      try {
        this.modelFavorites ??= new ModelFavorites();
        const result = this.modelFavorites.action(request.payload);
        await this.resolveHostAction(client, request.requestId, { ok: true, result });
      } catch (error) {
        await this.resolveHostAction(client, request.requestId, { ok: false, error: { code: "MODEL_FAVORITES_FAILED", message: error.message } });
      }
      return;
    }
    if (feature.id === "sites" && request.action === "sites") {
      try {
        const result = await this.sitesService.action(request.payload);
        await this.resolveHostAction(client, request.requestId, { ok: true, result });
      } catch (error) {
        await this.resolveHostAction(client, request.requestId, { ok: false, error: { code: "SITES_REQUEST_FAILED", message: error.message } });
      }
      return;
    }
    if (feature.id === "notes" && request.action === "quick-prompts") {
      try {
        const { route, method = "GET", body } = request.payload ?? {};
        assertPromptsRequest(route, method);
        const origin = pageScriptServiceOrigin(feature);
        if (!origin) throw new Error("Prompt request is not allowed");
        const response = await this.fetchImpl(new URL(route, origin), {
          method, headers: { "Content-Type": "application/json", Origin: CODEX_APP_ORIGIN },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(8_000),
        });
        const result = response.status === 204 ? null : await response.json();
        if (!response.ok) throw new Error(result?.error?.message ?? "Prompt request failed");
        await this.resolveHostAction(client, request.requestId, { ok: true, result });
      } catch (error) {
        await this.resolveHostAction(client, request.requestId, { ok: false, error: { code: "PROMPT_REQUEST_FAILED", message: error.message } });
      }
      return;
    }
    await this.resolveHostAction(client, request.requestId, {
      ok: false,
      error: { code: "ACTION_NOT_IMPLEMENTED", message: "Host action has no RuntimeHost handler" },
    });
  }

  async refreshTargets() {
    let response;
    try {
      response = await this.fetchImpl(`http://127.0.0.1:${this.cdpPort}/json/list`, {
        signal: AbortSignal.timeout(3_000),
      });
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
      const socketState = this.clients.get(id)?.socket.readyState;
      if (liveRendererIds.has(id) && (socketState == null || socketState === 1)) continue;
      removedTarget = true;
      this.clients.get(id)?.socket.close();
      this.clients.delete(id);
      this.scriptIds.delete(id);
      this.bindingTokens.delete(id);
      this.targetChecks.delete(id);
      this.targetCheckDeadlines.delete(id);
      this.hostActionChains.delete(id);
      this.injectedTargets.delete(id);
      this.targetFailures.delete(id);
    }
    const rendererDiscovered = liveRendererIds.size > 0;
    const rendererChanged = rendererDiscovered !== this.rendererDiscovered;
    this.rendererDiscovered = rendererDiscovered;
    if (removedTarget || rendererChanged) this.notifyStatusChange();

    for (const target of targets) {
      if (this.injectedTargets.has(target.id)) {
        const present=await this.checkTarget(target.id);
        if (present) continue;
        const previousClient=this.clients.get(target.id),identifier=this.scriptIds.get(target.id);
        if (identifier) await previousClient?.send("Page.removeScriptToEvaluateOnNewDocument",{identifier}).catch(()=>{});
        previousClient?.socket.close();
        this.clients.delete(target.id);
        this.scriptIds.delete(target.id);
        this.bindingTokens.delete(target.id);
        this.injectedTargets.delete(target.id);
        this.targetChecks.delete(target.id);
        this.targetCheckDeadlines.delete(target.id);
      }
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
        client.on?.("Runtime.executionContextsCleared", () => {
          if (this.clients.get(target.id) !== client) return;
          // 新文档撤销启动检查，下一次接入周期重新检查一次。
          this.targetChecks.delete(target.id);
          this.targetCheckDeadlines.delete(target.id);
          this.notifyStatusChange();
        });
        client.on?.("Runtime.bindingCalled", (params) => {
          let action;
          try { action = JSON.parse(params.payload)?.action; } catch { return; }
          // 统计读取独立合并，避免排在图片等用户操作后面。
          const work = action === "refresh-session-status"
            ? this.handleBindingCalled(target.id, client, params)
            : this.enqueueHostAction(target.id, () => this.handleBindingCalled(target.id, client, params));
          work
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
        await this.checkTarget(target.id);
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

  async checkTarget(targetId) {
    const client=this.clients.get(targetId);
    if (!client || this.stopping) return false;
    const previous = this.targetChecks.get(targetId);
    const needsRetry = !previous?.checkedAt || previous.plugins.some(plugin =>
      ["unknown", "unavailable", "degraded"].includes(plugin.state));
    if (previous && (!needsRetry || Date.now() >= this.targetCheckDeadlines.get(targetId))) return true;
    // 页面启动时锚点尚未就绪：借用发现周期有限重试，稳定后停止检查。
    if (!this.targetCheckDeadlines.has(targetId)) this.targetCheckDeadlines.set(targetId, Date.now() + 30_000);
    try {
      const response=await client.send("Runtime.evaluate", {
        expression:`(() => { const runtime=window.__codexPersonalRuntime; return runtime?.version === ${RUNTIME_VERSION} && runtime.sessionId === ${JSON.stringify(this.runtimeSessionId)} ? runtime.selfCheck() : null; })()`,
        returnByValue:true,
      }, {timeoutMs:3_000});
      if (this.clients.get(targetId) !== client || this.stopping) return false;
      const snapshot=response.result?.value;
      if (!snapshot) return false;
      if (snapshot.sessionId !== this.runtimeSessionId || !Array.isArray(snapshot.plugins)) throw new Error("Invalid self-check snapshot");
      this.targetChecks.set(targetId,snapshot);
      return true;
    } catch {
      // 无法读到当前证据时立即撤销旧成功，不把临时 CDP 故障解释为插件不兼容。
      this.targetChecks.set(targetId,{sessionId:this.runtimeSessionId,checkedAt:null,plugins:[],tokens:[],reason:"self-check-unavailable"});
      return true;
    }
  }

  async publishSessionStatus(onlyTargetId = null) {
    for (const [targetId, client] of this.clients) {
      if (onlyTargetId && targetId !== onlyTargetId) continue;
      if (!this.injectedTargets.has(targetId)) continue;
      const pending = this.sessionStatusUpdates.get(targetId);
      if (pending) { await pending; continue; }
      const revision = ++this.sessionStatusRevision;
      const update = (async () => {
        try {
          const response = await client.send("Runtime.evaluate", {
            expression: SESSION_STATUS_THREAD_ID_EXPRESSION,
            returnByValue: true,
          }, { timeoutMs: 3_000 });
          for (const value of response.result?.value ?? []) {
            const threadId = threadIdFromLocation(value);
            const data = threadId ? await this.sessionStatusReader.read(threadId) : null;
            const snapshot = data ?? (threadId ? {
              threadId,
              retryAfterMs: this.sessionStatusReader.retryAfterMs?.(threadId) ?? 500,
            } : null);
            if (this.stopping || this.clients.get(targetId) !== client) return;
            await client.send("Runtime.evaluate", {
              expression: `window.__minecodexSessionStatus?.update(${JSON.stringify(snapshot)}, ${revision})`,
              returnByValue: true,
            }, { timeoutMs: 3_000 });
          }
        } catch (error) {
          this.logger.warn?.("Session Status update failed", error.message);
          if (this.clients.get(targetId) === client) {
            client.socket.close();
            this.injectedTargets.delete(targetId);
            this.targetChecks.delete(targetId);
            this.targetCheckDeadlines.delete(targetId);
            this.notifyStatusChange();
          }
        }
      })();
      this.sessionStatusUpdates.set(targetId, update);
      try { await update; }
      finally {
        if (this.sessionStatusUpdates.get(targetId) === update) this.sessionStatusUpdates.delete(targetId);
      }
    }
  }

  async stop() {
    this.sitesService?.launcher?.stop();
    if (this.stopPromise) return this.stopPromise;
    this.stopPromise = (async () => {
      this.stopping = true;
      await this.localImageSource?.close();
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
    this.targetChecks.clear();
    this.targetCheckDeadlines.clear();
      this.rendererDiscovered = false;
      this.notifyStatusChange();
      this.monitorPromise = null;
    })();
    return this.stopPromise;
  }
}
