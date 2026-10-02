export function createNativeAccountMenuAdapter(codex) {
  function settings() {
    for (const menu of document.querySelectorAll('[role="menu"]')) {
      if (!menu.checkVisibility({ visibilityProperty:true })) continue;
      for (const item of menu.querySelectorAll('[role="menuitem"]')) {
        const profile = codex.props(item, p => typeof p.onOpenSettings === "function" && "settingsShortcut" in p);
        if (!profile || !codex.props(item, p => p.onClick === profile.onOpenSettings)) continue;
        const content = item.querySelector('[data-menu-row-content]');
        const [leading, label, shortcut] = content?.children ?? [];
        if (!leading?.querySelector('svg') || !label || !shortcut) continue;
        const owner = codex.props(item, p => typeof p.onClose === "function" && "open" in p);
        if (!owner) continue;
        codex.report("account-menu", true);
        return { menu, item, close:owner.onClose };
      }
    }
    codex.report("account-menu", false, "profile-menu-unavailable");
    return null;
  }
  return { settings };
}
