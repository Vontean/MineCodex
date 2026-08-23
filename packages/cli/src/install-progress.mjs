const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function createInstallReporter({ output = console.log, terminalOutput = process.stdout } = {}) {
  // 只有真实终端才显示 spinner；测试或脚本环境保持普通逐行文本。
  const interactive = output === console.log && Boolean(terminalOutput?.isTTY);
  let timer = null;

  function stopSpinner() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function writeLine(line) {
    if (!interactive) {
      output(line);
      return;
    }
    terminalOutput.write(`\r\x1b[2K${line}\n`);
  }

  function startSpinner(line) {
    if (!interactive) {
      output(line);
      return;
    }
    let frame = 0;
    terminalOutput.write(`\r\x1b[2K${SPINNER_FRAMES[frame]} ${line}`);
    timer = setInterval(() => {
      frame = (frame + 1) % SPINNER_FRAMES.length;
      terminalOutput.write(`\r\x1b[2K${SPINNER_FRAMES[frame]} ${line}`);
    }, 80);
  }

  return {
    heading(line) {
      writeLine(line);
    },

    async step(index, total, label, action) {
      const prefix = `[${index}/${total}] ${label}`;
      startSpinner(prefix);
      try {
        const result = await action();
        stopSpinner();
        writeLine(`✓ ${prefix}`);
        return result;
      } catch (error) {
        stopSpinner();
        writeLine(`✗ ${prefix}`);
        throw error;
      }
    },
  };
}

export { createInstallReporter };
