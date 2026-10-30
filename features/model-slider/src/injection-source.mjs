import { findCodexModule } from '../../../packages/codex-adapter/src/renderer/modules.mjs';
import { createModelControllerAdapter } from "./adapters/codex/controller.mjs";
import { createModelRules } from "./domain/model-rules.mjs";
import { installModelSlider, replaceModelSliderShell } from "./frontend/install.mjs";

// 两部分均显式序列化，Renderer 不捕获 Node imports。
export function createModelSliderInstallerSource() {
  return `function installModelSliderFeature(signal, context) {
    const findCodexModule = ${findCodexModule.toString()};
    const replaceModelSliderShell = ${replaceModelSliderShell.toString()};
    return (${installModelSlider.toString()})(signal, context, (${createModelRules.toString()})(), ${createModelControllerAdapter.toString()});
  }`;
}
