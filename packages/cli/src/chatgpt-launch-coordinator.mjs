function hasExactArgument(command, argument) {
  const value = String(command);
  let offset = value.indexOf(argument);
  while (offset >= 0) {
    const before = offset === 0 || /\s/.test(value[offset - 1]);
    const end = offset + argument.length;
    const after = end === value.length || /\s/.test(value[end]);
    if (before && after) return true;
    offset = value.indexOf(argument, offset + 1);
  }
  return false;
}

export function hasLoopbackCdpArguments(command, cdpPort) {
  return hasExactArgument(command, "--remote-debugging-address=127.0.0.1")
    && hasExactArgument(command, `--remote-debugging-port=${cdpPort}`)
    && hasExactArgument(command, `--remote-allow-origins=http://127.0.0.1:${cdpPort}`);
}

function requireProcess(processInfo, context) {
  if (!processInfo || !Number.isInteger(processInfo.pid) || processInfo.pid <= 1) {
    throw new Error(`MineCodex could not verify the ${context} ChatGPT process.`);
  }
  if (typeof processInfo.command !== "string" || !processInfo.command.trim()) {
    throw new Error(`MineCodex could not verify the ${context} ChatGPT command line.`);
  }
  if (processInfo.verified === false) {
    throw new Error(`MineCodex rejected an unverified ${context} ChatGPT process.`);
  }
}

export class ChatGPTLaunchCoordinator {
  constructor({ platform, cdpPort }) {
    this.platform = platform;
    this.cdpPort = cdpPort;
  }

  async attach(processInfo, owned, { startRuntime, waitForHealthy }) {
    requireProcess(processInfo, owned ? "LaunchServices-created" : "observed");
    await this.platform.assertNativeCodexCdp(processInfo, this.cdpPort);
    const status = await startRuntime();
    const healthy = await waitForHealthy(status);
    await this.platform.assertNativeCodexCdp(processInfo, this.cdpPort);
    return {
      ...healthy,
      codex: { pid: processInfo.pid, owned, command: processInfo.command ?? null },
    };
  }

  async ensureObservedLaunch(processInfo, { stopRuntime, startRuntime, waitForHealthy }) {
    requireProcess(processInfo, "observed");
    if (typeof this.platform?.terminateNativeCodex !== "function"
      || typeof this.platform?.openNativeCodex !== "function"
      || typeof this.platform?.assertNativeCodexCdp !== "function") {
      throw new Error("MineCodex platform adapter cannot coordinate an official ChatGPT launch.");
    }

    await stopRuntime();
    if (hasLoopbackCdpArguments(processInfo.command, this.cdpPort)) {
      return this.attach(processInfo, false, { startRuntime, waitForHealthy });
    }

    const terminated = await this.platform.terminateNativeCodex(processInfo.pid, processInfo.command);
    if (terminated !== 1) {
      throw new Error(`MineCodex refused to replace ChatGPT pid ${processInfo.pid} after identity changed.`);
    }
    const launched = await this.platform.openNativeCodex({ cdpPort: this.cdpPort });
    return this.attach(launched, true, { startRuntime, waitForHealthy });
  }

  async relaunchOwned({ stopRuntime, terminateOwned, startRuntime, waitForHealthy }) {
    await stopRuntime();
    await terminateOwned();
    const launched = await this.platform.openNativeCodex({ cdpPort: this.cdpPort });
    return this.attach(launched, true, { startRuntime, waitForHealthy });
  }
}
