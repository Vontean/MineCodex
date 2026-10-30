import { findCodexModule } from '../../../../../packages/codex-adapter/src/renderer/modules.mjs';
export function createModelControllerAdapter(codex,comparableModelLabel) {
function controllerView(props) {const view=Object.fromEntries(["models","model","reasoningEffort","powerSelections","selectedPowerSelection","fallbackPowerSelection","serviceTierOptions","selectedServiceTier","onSelectModel","onSelectReasoningEffort","onSelectPower","onCommitPower","onSelectServiceTier"].map(key=>[key,props[key]]));codex.report('model-controller',true);return view;}
function nativeComposerTriggers() {
    return Array.from(document.querySelectorAll("[data-codex-intelligence-trigger]"))
      .filter((trigger) => trigger.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }));
  }
function nativeComposerTrigger() {
    const triggers = nativeComposerTriggers();
    return triggers.find((trigger) => trigger.getAttribute("data-state") === "open")
      ?? triggers[0] ?? null;
  }
function nativeComposerModelController(trigger = nativeComposerTrigger()) {
    codex.report("model-controller",false,"task-controller-unavailable");
    let fiber = codex.currentFiber(trigger);
    let powerController = null;
    for (let depth = 0; fiber && depth < 40; depth += 1, fiber = fiber.return) {
      const props = fiber.memoizedProps;
      if (
        Array.isArray(props?.powerSelections)
        && typeof props.onCommitPower === "function"
      ) powerController ??= props;
      if (Array.isArray(props?.models) && typeof props.onSelectReasoningEffort === "function") return controllerView(props);
      if (Array.isArray(props?.models) && typeof props.onCommitPower === "function") {
        const power = powerController ?? props;
        return controllerView({
          ...props,
          powerSelections: power.powerSelections ?? props.powerSelections,
          selectedPowerSelection: power.selectedPowerSelection ?? props.selectedPowerSelection,
          fallbackPowerSelection: power.fallbackPowerSelection ?? props.fallbackPowerSelection,
          onSelectPower: power.onSelectPower ?? props.onSelectPower,
          onCommitPower: power.onCommitPower,
        });
      }
      // Chat／Temporary Chat 使用原生模型选择器，不进入任务模型适配。
      if (props?.selectedModel && typeof props.onModelChange === "function") return null;
    }
    return null;
  }
function nativeModelDescriptorForItem(item, observedRaw) {
    const target = comparableModelLabel(observedRaw);
    if (!target) return null;
    let fiber = codex.currentFiber(item);
    for (let depth = 0; fiber && depth < 35; depth += 1, fiber = fiber.return) {
      if (!Array.isArray(fiber.memoizedProps)) continue;
      const matches = fiber.memoizedProps.map((element) => {
        const props = element?.props?.children?.props;
        const slug = String(props?.model ?? element?.key ?? "").trim();
        const displayName = String(props?.displayName ?? "").trim();
        return slug && (
          comparableModelLabel(slug) === target || comparableModelLabel(displayName) === target
        ) ? { slug, displayName } : null;
      }).filter(Boolean);
      if (matches.length === 1) return matches[0];
    }
    return null;
  }
function setReactControlledMenuOpen(element, open) {
    if (!element) return false;
    let fiber = codex.currentFiber(element);
    for (let depth = 0; fiber && depth < 40; depth += 1, fiber = fiber.return) {
      const props = fiber.memoizedProps;
      if (typeof props?.open === "boolean" && props.open !== open && typeof props.onOpenChange === "function") {
        props.onOpenChange(open);
        return true;
      }
    }
    return false;
  }
function invokeNativeMenuItemSelect(item) {
    if (!item) return false;
    let fiber = codex.currentFiber(item);
    for (let depth = 0; fiber && depth < 24; depth += 1, fiber = fiber.return) {
      const onSelect = fiber.memoizedProps?.onSelect;
      if (typeof onSelect !== "function") continue;
      onSelect({ preventDefault() {}, defaultPrevented: false });
      return true;
    }
    return false;
  }
  function extractFastIconPath(source, prefix) {
    const match = String(source).match(new RegExp(`d:\`(${prefix}[^\`]*)\``));
    return match?.[1] ?? null;
  }

  async function fastIcons(signal) {
    const sourceUrl=await findCodexModule('app-primary',{signal}) ?? await findCodexModule('app-initial',{signal});
    if (!sourceUrl) {codex.report("fast-icons",false,"bundle-unavailable");return null;}
    const source=await (await fetch(sourceUrl,{signal})).text();
    const active=extractFastIconPath(source,"M11\\.9125 21\\.4125"),inactive=extractFastIconPath(source,"M9\\.80999 17\\.8302");
    codex.report("fast-icons",Boolean(active && inactive),active && inactive ? null : "icon-resource-contract-changed");
    return {active:{path:active,viewBox:"0 0 24 24"},inactive:{path:inactive,viewBox:"0 0 20 20"}};
  }
function selfCheck() {
  const trigger=nativeComposerTrigger();
  if (!trigger) {
    const path=codex.route();
    const applicable=Boolean(codex.composer(null,{threadOnly:false})) || path?.startsWith("/local/");
    return {state:applicable ? "unavailable" : path ? "not-applicable" : "unknown",reason:applicable ? "model-trigger-unavailable" : "no-task-composer",checks:[{name:"model-trigger",available:false}]};
  }
  const generic=codex.props(trigger,p=>!!p.selectedModel && typeof p.onModelChange === "function",40);
  if (generic) return {state:"not-applicable",reason:"chat-model-picker"};
  const available=Boolean(nativeComposerModelController());
  return {state:available ? "available" : "unavailable",reason:available ? null : "model-controller-unavailable",
    scopes:[{name:"model-trigger",element:trigger}],checks:[{name:"model-trigger",available:true},{name:"model-controller",available}]};
}
return {selfCheck,fastIcons,trigger:nativeComposerTrigger,triggers:nativeComposerTriggers,read:nativeComposerModelController,descriptor:nativeModelDescriptorForItem,setOpen:setReactControlledMenuOpen,selectItem:invokeNativeMenuItemSelect};
}
