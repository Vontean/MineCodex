import { createModelControllerAdapter } from "./adapters/codex/controller.mjs";
import { createModelRules } from "./domain/model-rules.mjs";
import { installModelSlider } from "./frontend/install.mjs";

// 两部分均显式序列化，Renderer 不捕获 Node imports。
export function createModelSliderInstallerSource() {
  return `function installModelSliderFeature(signal, context) {
    return (${installModelSlider.toString()})(signal, context, (${createModelRules.toString()})(), ${createModelControllerAdapter.toString()});
  }`;
}
