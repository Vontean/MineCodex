import { createNativeAccountMenuAdapter } from "./native/account-menu.mjs";
import { installAccountMenuEntry } from "./components/account-menu.mjs";
import { createNativeThemeAdapter } from "./native/theme.mjs";
import { createNativePageAdapter } from "./native/page.mjs";
import { createNativeRailAdapter } from "./native/navigation-rail.mjs";
import { installSurfaces } from "./foundation/surfaces.mjs";
import { installLayers } from "./foundation/layers.mjs";
import { installDialog } from "./components/dialog.mjs";
import { installButton } from "./components/button.mjs";
import { installPage } from "./components/page.mjs";
import { installComposerMenu } from "./components/composer-menu.mjs";
import { installNavigationRail } from "./components/navigation-rail.mjs";
import { installFeatureTooltips } from "./components/tooltip.mjs";

// 所有依赖在组装时显式写入源码，Renderer 不依赖 Node 模块闭包。
export function createUIInstallerSource() {
  const installers = [installSurfaces, installLayers, installDialog, installButton, installComposerMenu];
  return `function installFeatureUI(signal, context) {
    const ui = {theme:(${createNativeThemeAdapter.toString()})(context.themeTokens,context.themeTokenAliases,context.themeBindings)};
    ${installers.map(install => `Object.assign(ui, (${install.toString()})(signal, ui));`).join("\n")}
    Object.assign(ui, (${installPage.toString()})(signal, ui, (${createNativePageAdapter.toString()})(context.codex)));
    Object.assign(ui, (${installNavigationRail.toString()})(signal, ui, (${createNativeRailAdapter.toString()})(context.codex)));
    Object.assign(ui, (${installFeatureTooltips.toString()})(signal));
    Object.assign(ui, (${installAccountMenuEntry.toString()})(signal, ui, (${createNativeAccountMenuAdapter.toString()})(context.codex)));
    return ui;
  }`;
}
