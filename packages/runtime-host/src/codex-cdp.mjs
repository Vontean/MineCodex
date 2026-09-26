// CDP (Chrome DevTools Protocol) 客户端：WebSocket 连接、表达式求值与进程等待。
// 与注入内容无关；CodexRuntime 通过这里的 connectClient 与 Codex Renderer 通信。
export async function connect(url, { timeoutMs = 10_000 } = {}) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const eventWaiters = new Map();
  const eventListeners = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("error", onError);
      socket.removeEventListener("close", onClose);
      if (error) reject(error);
      else resolve();
    };
    const onOpen = () => finish();
    const onError = () => finish(new Error("CDP WebSocket connection failed"));
    const onClose = () => finish(new Error("CDP WebSocket closed before opening"));
    const timer = setTimeout(() => {
      finish(new Error("CDP WebSocket connection timed out"));
      socket.close();
    }, timeoutMs);
    socket.addEventListener("open", onOpen, { once: true });
    socket.addEventListener("error", onError, { once: true });
    socket.addEventListener("close", onClose, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) {
      for (const listener of eventListeners.get(message.method) ?? []) listener(message.params);
      const waiters = eventWaiters.get(message.method) ?? [];
      eventWaiters.delete(message.method);
      for (const waiter of waiters) waiter.resolve(message.params);
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  socket.addEventListener("close", () => {
    const error = new Error("CDP WebSocket closed");
    for (const request of pending.values()) request.reject(error);
    pending.clear();
    for (const waiters of eventWaiters.values()) {
      for (const waiter of waiters) waiter.reject(error);
    }
    eventWaiters.clear();
    eventListeners.clear();
  });

  return {
    socket,
    send(method, params = {}, { timeoutMs = 30_000 } = {}) {
      // 关闭后的 send 不会再收到 close 事件，必须立即结束请求。
      if (socket.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error("CDP WebSocket is not open"));
      }
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const finish = (callback, value) => {
          clearTimeout(timer);
          pending.delete(id);
          callback(value);
        };
        const timer = setTimeout(() => {
          finish(reject, new Error(`CDP request timed out: ${method}`));
        }, timeoutMs);
        pending.set(id, {
          resolve: (value) => finish(resolve, value),
          reject: (error) => finish(reject, error),
        });
        try { socket.send(JSON.stringify({ id, method, params })); }
        catch (error) { finish(reject, error); }
      });
    },
    on(method, listener) {
      const listeners = eventListeners.get(method) ?? new Set();
      listeners.add(listener);
      eventListeners.set(method, listeners);
      return () => listeners.delete(listener);
    },
    waitFor(method, timeoutMs) {
      return new Promise((resolve, reject) => {
        const waiters = eventWaiters.get(method) ?? [];
        const waiter = {
          resolve(value) {
            clearTimeout(timeout);
            resolve(value);
          },
          reject(error) {
            clearTimeout(timeout);
            reject(error);
          },
        };
        const timeout = setTimeout(() => {
          const remaining = (eventWaiters.get(method) ?? []).filter((item) => item !== waiter);
          if (remaining.length) eventWaiters.set(method, remaining);
          else eventWaiters.delete(method);
          reject(new Error(`Timed out waiting for CDP event ${method}`));
        }, timeoutMs);
        waiters.push(waiter);
        eventWaiters.set(method, waiters);
      });
    },
  };
}

export async function waitForExpression(client, expression, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const result = await client.send("Runtime.evaluate", { expression, returnByValue: true });
      if (result.result?.value) return;
    } catch {
      // Reloading briefly destroys the previous execution context.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for renderer state: ${expression}`);
}

export function evaluationValue(result) {
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result?.value;
}

export function requireCdpWebSocketUrl(version, expectedCdpPort) {
  const value = typeof version?.webSocketDebuggerUrl === "string"
    ? version.webSocketDebuggerUrl.trim()
    : "";
  if (!value) {
    throw new Error("Codex CDP /json/version is missing webSocketDebuggerUrl");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Codex CDP webSocketDebuggerUrl is invalid");
  }
  if (!new Set(["ws:", "wss:"]).has(parsed.protocol) || !parsed.host) {
    throw new Error("Codex CDP webSocketDebuggerUrl must use ws: or wss:");
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(hostname)) {
    throw new Error("Codex CDP webSocketDebuggerUrl must use a loopback host");
  }
  const configuredPort = Number(expectedCdpPort);
  const effectivePort = parsed.port
    ? Number(parsed.port)
    : parsed.protocol === "wss:" ? 443 : 80;
  if (!Number.isInteger(configuredPort) || effectivePort !== configuredPort) {
    throw new Error(`Codex CDP webSocketDebuggerUrl must use configured CDP port ${expectedCdpPort}`);
  }
  return value;
}

export function processChildHasExited(child) {
  return child && (
    (child.exitCode !== null && child.exitCode !== undefined)
    || (child.signalCode !== null && child.signalCode !== undefined)
  );
}

export function waitForProcessChildExit(child, timeoutMs) {
  if (processChildHasExited(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener?.("exit", onExit);
      resolve(exited || processChildHasExited(child));
    };
    const onExit = () => finish(true);
    child.once?.("exit", onExit);
    timer = setTimeout(() => finish(false), timeoutMs);
  });
}
