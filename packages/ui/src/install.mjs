import { installSurfaces } from "./foundation/surfaces.mjs";
import { installLayers } from "./foundation/layers.mjs";
import { installDialog } from "./components/dialog.mjs";
import { installButton } from "./components/button.mjs";
import { installPage } from "./components/page.mjs";
import { installComposerMenu } from "./components/composer-menu.mjs";
import { installFeatureTooltips } from "./components/tooltip.mjs";

// 所有依赖在组装时显式写入源码，Renderer 不依赖 Node 模块闭包。
export function createUIInstallerSource() {
  const installers = [installSurfaces, installLayers, installDialog, installButton, installPage, installComposerMenu];
  return `function installFeatureUI(signal) {
    const ui = {};
    ${installers.map(install => `Object.assign(ui, (${install.toString()})(signal, ui));`).join("\n")}
    Object.assign(ui, (${installFeatureTooltips.toString()})(signal));
    return ui;
  }`;
}
