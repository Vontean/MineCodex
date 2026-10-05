import { installMcpAppChrome } from "./native/mcp-app.mjs";
import { installMcpNavigationIcons } from "./native/mcp-navigation.mjs";
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
    if (context.mcpServer) (${installMcpAppChrome.toString()})(signal, context.codex, {server:context.mcpServer,pluginId:context.mcpPluginId});
    if (context.mcpNavigationIcons) (${installMcpNavigationIcons.toString()})(signal, (${createNativeRailAdapter.toString()})(context.codex), {server:context.mcpServer,pluginId:context.mcpPluginId,icons:context.mcpNavigationIcons});
    return ui;
  }`;
}
