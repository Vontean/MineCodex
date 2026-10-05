// MCP Apps 的宿主变量是 iframe 的主题来源；不读取父窗口 DOM。
export function applyMcpTheme(context) {
  const root = document.documentElement;
  root.dataset.theme = context.theme ?? root.dataset.theme ?? 'light';
  root.style.colorScheme = root.dataset.theme;
  for (const [name,value] of Object.entries(context.styles?.variables ?? {})) root.style.setProperty(name,value);
  const aliases = {
    'color-surface':'--color-background-primary', 'color-surface-elevated-secondary':'--color-background-secondary',
    'color-text-primary':'--color-text-primary', 'color-text-secondary':'--color-text-secondary', 'color-text-tertiary':'--color-text-tertiary',
    'color-border':'--color-border-primary', 'color-border-subtle':'--color-border-secondary', 'color-border-primary-outline':'--color-border-primary',
    'color-background-primary-ghost-hover':'--color-background-primary-ghost-hover', 'color-background-primary-outline-hover':'--color-background-primary-ghost-hover',
    'color-background-primary-solid':'--color-text-primary', 'color-text-primary-solid':'--color-background-primary',
    'color-background-primary-solid-hover':'--color-text-secondary', 'color-ring':'--color-border-info', 'color-text-danger':'--color-text-danger',
    'font-sans-default':'--font-sans', 'text-sm':'--font-text-sm-size', 'text-base':'--font-text-md-size', 'text-xs':'--font-text-xs-size',
    'text-heading-lg':'--font-heading-lg-size', 'text-heading-md':'--font-heading-md-size',
    'radius-md':'--border-radius-md','radius-lg':'--border-radius-lg','radius-xl':'--border-radius-xl', 'radius-full':'--border-radius-full',
  };
  for (const [target,source] of Object.entries(aliases)) root.style.setProperty(`--mcx-${target}`,`var(${source})`);
  if (context.locale) root.lang = context.locale;
}
