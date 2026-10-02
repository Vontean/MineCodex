// 复用 Notes 已采用的原生 Close SVG，避免文字字形的基线偏移。
const closeGlyph = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" aria-hidden=\"true\"><path d=\"M10.962 4.29539C11.1669 4.09057 11.4992 4.09076 11.7042 4.29539C11.9092 4.50039 11.9091 4.83255 11.7042 5.03758L8.74229 7.99949L11.7052 10.9624C11.9097 11.1673 11.9097 11.4996 11.7052 11.7046C11.5003 11.9095 11.168 11.9093 10.963 11.7046L8.0001 8.74168L5.03721 11.7046C4.83216 11.9093 4.49994 11.9095 4.29502 11.7046C4.09047 11.4996 4.09045 11.1673 4.29502 10.9624L7.25791 7.99949L4.296 5.03758C4.09101 4.83255 4.09099 4.5004 4.296 4.29539C4.50105 4.09079 4.8333 4.09054 5.03819 4.29539L8.0001 7.2573L10.962 4.29539Z\" fill=\"currentColor\"/></svg>";
const deviceGlyphs = {"local": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"none\" aria-hidden=\"true\"><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M12.6667 2.47461C13.6928 2.47479 14.525 3.30694 14.5251 4.33301V10.1445C15.0248 10.184 15.3787 10.6177 15.3787 11.0928V11.9355C15.3785 12.9036 14.6274 13.7373 13.6433 13.7373H2.34644C1.36254 13.7371 0.611273 12.9035 0.611084 11.9355V11.0928C0.611084 10.6149 0.970003 10.1796 1.47437 10.1445V4.33301C1.47454 3.30702 2.3068 2.47492 3.33276 2.47461H12.6667ZM1.66187 11.9355C1.66205 12.3765 1.99397 12.6863 2.34644 12.6865H13.6433C13.9959 12.6865 14.3287 12.3767 14.3289 11.9355V11.1924H1.66187V11.9355ZM3.33276 3.52539C2.8867 3.5257 2.52532 3.88692 2.52515 4.33301V10.1416H13.4744V4.33301C13.4742 3.88684 13.1129 3.52557 12.6667 3.52539H3.33276Z\" fill=\"currentColor\"/></svg>", "remote": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"none\" aria-hidden=\"true\"><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M11.5005 1.1416C12.4346 1.14184 13.1919 1.89985 13.1919 2.83398V6.55859H13.3335C13.8259 6.55859 14.1917 6.9676 14.1919 7.42969V8.2959C14.1914 9.14015 13.5269 9.85938 12.6665 9.85938H3.3335C2.47306 9.85938 1.80856 9.14015 1.80811 8.2959V7.42969C1.80834 6.9677 2.17428 6.55877 2.6665 6.55859H2.80811V2.83398C2.80811 1.8997 3.56621 1.1416 4.50049 1.1416H11.5005ZM2.85889 8.2959C2.85933 8.59786 3.08989 8.80859 3.3335 8.80859H12.6665C12.9101 8.80859 13.1416 8.59786 13.1421 8.2959V7.60938H2.85889V8.2959ZM4.50049 2.19238C4.14611 2.19238 3.85889 2.4796 3.85889 2.83398V6.55859H12.1421V2.83398C12.1421 2.47975 11.8547 2.19262 11.5005 2.19238H4.50049Z\" fill=\"currentColor\"/> <path d=\"M2.8595 13.4307C3.28863 13.4308 3.63684 13.7788 3.63684 14.208C3.63677 14.6371 3.28859 14.9852 2.8595 14.9854C2.43029 14.9854 2.08222 14.6372 2.08215 14.208C2.08215 13.7788 2.43025 13.4307 2.8595 13.4307Z\" fill=\"currentColor\"/> <path d=\"M5.42981 13.4307C5.859 13.4307 6.20715 13.7788 6.20715 14.208C6.20709 14.6372 5.85896 14.9853 5.42981 14.9854C5.0006 14.9854 4.65253 14.6372 4.65247 14.208C4.65247 13.7788 5.00056 13.4307 5.42981 13.4307Z\" fill=\"currentColor\"/> <path d=\"M8.00012 13.4307C8.42937 13.4307 8.77747 13.7788 8.77747 14.208C8.7774 14.6372 8.42933 14.9854 8.00012 14.9854C7.57092 14.9854 7.22284 14.6372 7.22278 14.208C7.22278 13.7788 7.57087 13.4307 8.00012 13.4307Z\" fill=\"currentColor\"/> <path d=\"M10.5704 13.4307C10.9997 13.4307 11.3478 13.7788 11.3478 14.208C11.3477 14.6372 10.9996 14.9854 10.5704 14.9854C10.1414 14.9852 9.79413 14.6371 9.79407 14.208C9.79407 13.7789 10.1414 13.4309 10.5704 13.4307Z\" fill=\"currentColor\"/> <path d=\"M13.1417 13.4307C13.5707 13.4309 13.9181 13.7789 13.9181 14.208C13.918 14.637 13.5707 14.9851 13.1417 14.9854C12.7125 14.9854 12.3644 14.6372 12.3644 14.208C12.3644 13.7788 12.7125 13.4307 13.1417 13.4307Z\" fill=\"currentColor\"/> <path d=\"M8.00012 10.8809C8.42925 10.8809 8.77727 11.2281 8.77747 11.6572C8.77747 12.0865 8.42937 12.4346 8.00012 12.4346C7.57087 12.4346 7.22278 12.0865 7.22278 11.6572C7.22298 11.2281 7.571 10.8809 8.00012 10.8809Z\" fill=\"currentColor\"/></svg>"};
const text = (en, cn) => (document.documentElement.lang || navigator.language || "en").startsWith("zh") ? cn : en;
const projectIcons = new Map();
const folderGlyph = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" width=\"20\" height=\"20\" fill=\"none\" aria-hidden=\"true\"><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M6.94946 2.66821C7.58311 2.66821 8.20067 2.86877 8.71313 3.24146L9.77759 4.01587C10.0627 4.22319 10.4065 4.33521 10.759 4.33521H14.9583C16.6142 4.33521 17.9563 5.67732 17.9563 7.33325V14.3333C17.9563 15.9892 16.6142 17.3313 14.9583 17.3313H5.04126C3.38547 17.3311 2.04321 15.9891 2.04321 14.3333V5.66626C2.04339 4.01058 3.38558 2.66839 5.04126 2.66821H6.94946ZM3.37329 9.83228V14.3333C3.37329 15.2545 4.12001 16.001 5.04126 16.0012H14.9583C15.8796 16.0012 16.6262 15.2546 16.6262 14.3333V9.83228H3.37329ZM5.04126 3.99829C4.12012 3.99847 3.37347 4.74512 3.37329 5.66626V8.5022H16.6262V7.33325C16.6262 6.41186 15.8796 5.66528 14.9583 5.66528H10.759C10.1254 5.66528 9.50784 5.46377 8.99536 5.09106L7.93091 4.31763C7.64576 4.11024 7.30205 3.99829 6.94946 3.99829H5.04126Z\" fill=\"currentColor\"/></svg>";
const marker = "data-minecodex-unread";
const queue = createNotificationQueue();
const native = createNotificationAdapter(config.codex, loadThreadBindings, schedule);
const style = document.createElement("style");
style.textContent = `
[${marker}=panel] { --mcx-notification-padding:14px; width:min(320px,calc(100vw - 76px)); max-height:calc(100vh - 72px); overflow:auto; scrollbar-width:thin; scrollbar-color:var(--mcx-color-border) transparent; padding:6px; margin:-6px; box-sizing:content-box; display:flex; flex-direction:column; gap:8px; pointer-events:none; font-family:var(--mcx-font-sans-default); font-size:var(--mcx-text-sm); color:var(--mcx-color-text-primary); }
[${marker}=panel][hidden],[${marker}=more][hidden] { display:none; }
[${marker}=more] { pointer-events:auto; padding:5px 12px; border:1px solid var(--mcx-color-border); border-radius:999px; background:var(--mcx-color-surface-elevated-secondary); font-family:var(--mcx-font-sans-default); font-size:12px; line-height:16px; color:var(--mcx-color-text-secondary); cursor:pointer; transform:translateX(-50%); }
[${marker}=more]:hover { color:var(--mcx-color-text-primary); }
[${marker}=more]:focus-visible { outline:2px solid var(--mcx-color-ring); outline-offset:2px; }
[${marker}=tail] { pointer-events:none; height:32px; clip-path:inset(26px -12px -20px); }
[${marker}=tail][hidden] { display:none; }
[${marker}=tail] > div { position:absolute; height:26px; border-radius:16px; }
[${marker}=tail] > div:first-child { left:14px; right:14px; top:12px; }
[${marker}=tail] > div:last-child { left:7px; right:7px; top:6px; }
[${marker}=panel] .mcx-notification { position:relative; flex:none; border-radius:16px; overflow:visible; pointer-events:auto; overflow-anchor:none; }
[${marker}=panel] [data-unread-row] { display:flex; flex-direction:column; gap:4px; width:100%; padding:var(--mcx-notification-padding); border:0; border-radius:16px; background:transparent; text-align:start; color:inherit; font:inherit; cursor:pointer; }
[${marker}=panel] [data-unread-row]:hover { background:var(--mcx-color-background-primary-ghost-hover); }
[${marker}=panel] button:focus-visible { outline:2px solid var(--mcx-color-ring); outline-offset:-3px; border-radius:12px; }
[${marker}=panel] .mcx-dismiss { position:absolute; top:-4px; right:-4px; display:grid; place-items:center; width:22px; height:22px; padding:0; border:0; border-radius:50%; background:var(--mcx-color-surface-elevated-secondary); color:var(--mcx-color-text-tertiary); line-height:0; cursor:pointer; opacity:0; }
[${marker}=panel] .mcx-notification:hover .mcx-dismiss,[${marker}=panel] .mcx-notification:focus-within .mcx-dismiss { opacity:1; }
[${marker}=panel] .mcx-dismiss svg { display:block; width:16px; height:16px; }
[${marker}=panel] .mcx-dismiss:hover { color:var(--mcx-color-text-primary); }
[${marker}=panel] .mcx-unread-dot { width:6px; height:6px; border-radius:50%; flex:none; background:var(--mcx-color-chart-blue); }
[${marker}=panel] .mcx-thread-header { display:flex; align-items:center; gap:8px; width:100%; min-width:0; }
[${marker}=panel] .mcx-thread-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; font-size:13px; line-height:18px; font-weight:500; }
[${marker}=panel] .mcx-device { display:flex; flex-shrink:0; color:var(--mcx-color-text-tertiary); }
[${marker}=panel] time { margin-inline-start:auto; flex-shrink:0; font-size:var(--mcx-text-xs); color:var(--mcx-color-text-tertiary); }
[${marker}=panel] .mcx-summary { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; line-clamp:2; overflow:hidden; white-space:normal; overflow-wrap:anywhere; font-size:12px; line-height:16px; color:var(--mcx-color-text-secondary); }
[${marker}=panel] .mcx-project { display:flex; align-items:center; gap:6px; padding:0; min-width:0; font-size:11px; line-height:16px; color:var(--mcx-color-text-tertiary); font-weight:400; }
[${marker}=panel] .mcx-project > span:last-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
[${marker}=panel] .mcx-project svg, [${marker}=panel] .mcx-project-icon { width:12px; height:12px; flex:none; }
[${marker}=panel] .mcx-project-icon > * { width:12px; height:12px; }
[${marker}=panel] .mcx-attention { margin-inline-start:auto; flex:none; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border-radius:999px; padding:2px 10px 2px 8px; font-size:12px; line-height:16px; position:relative; isolation:isolate; color:var(--mcx-color-chart-blue); background:color-mix(in srgb,var(--mcx-color-chart-blue) 15%,transparent); }
[${marker}=panel] .mcx-attention[data-attention="approval"] { color:var(--mcx-color-chart-green); background:color-mix(in srgb,var(--mcx-color-chart-green) 20%,transparent); }

[${marker}=panel] .mcx-attention[data-countdown]::before { content:""; position:absolute; inset:0; z-index:-1; background:currentColor; opacity:.14; transform-origin:left; transform:scaleX(var(--countdown-progress,0)); transition:transform 1s linear; }
[${marker}=panel] .mcx-countdown { display:inline-block; margin-inline-start:5px; font-variant-numeric:tabular-nums; min-width:2.5ch; }
@media (prefers-reduced-motion:reduce) { [${marker}=panel] .mcx-attention::before { transition:none; } }
`;
document.head.append(style);
const panel=document.createElement("section");
panel.setAttribute(marker,"panel");
config.ui.layer(panel,"notification");
panel.setAttribute("aria-label",text("Chat notifications","会话通知"));
panel.hidden=true;
document.body.append(panel);
// 折叠装饰在真实卡片后方，展开按钮独立于滚动遮罩。
const tail=document.createElement("div");
tail.setAttribute(marker,"tail");tail.setAttribute("aria-hidden","true");
config.ui.layer(tail,"notification");tail.hidden=true;
for(let i=0;i<2;i++){const layer=document.createElement("div");config.ui.surface(layer,"popover");tail.append(layer);}
document.body.insertBefore(tail,panel);
const more=document.createElement("button");more.type="button";
more.setAttribute(marker,"more");
config.ui.layer(more,"notification");
more.hidden=true;
document.body.append(more);
let expanded=false,totalNotifications=0,pageKey=null;
let collapseAnimation=null;
more.addEventListener("click",()=>{
  expanded=true;more.hidden=true;tail.hidden=true;sync();
  // 展开后将键盘焦点交给第一条此前隐藏的通知。
  [...cards.values()][3]?.querySelector("[data-unread-row]")?.focus({preventScroll:true});
});
const cards=new Map();
let disposed=false,queued=false,account=null;
function relativeTime(timestamp, now = Date.now()) {
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return text("Just now", "刚刚");
  const units = seconds < 3600 ? [60, "m", "分钟"] : seconds < 86400 ? [3600, "h", "小时"] : [86400, "d", "天"];
  const value = Math.floor(seconds / units[0]);
  return text(value + units[1], value + units[2] + "前");
}
function cacheProjectIcons() {
  for (const row of document.querySelectorAll('#app-shell-sidebar [data-app-action-sidebar-project-row]')) {
    const glyph = row.querySelector("span.relative.inline-flex");
    if (glyph) projectIcons.set(row.dataset.appActionSidebarProjectId, glyph.cloneNode(true));
  }
}

function createCard(item) {
    const shell=document.createElement("div");
    shell.className="mcx-notification";
    config.ui.surface(shell,"popover");
    const card=document.createElement("button");
    card.type="button";
    card.dataset.unreadRow="";
    card.dataset.threadKey=item.key;
    const header = document.createElement("span");
    header.className = "mcx-thread-header";
    const title = document.createElement("span");
    title.className = "mcx-thread-title";
    title.textContent = item.title;
    const device = document.createElement("span");
    device.className = "mcx-device";
    const remote = item.hostId !== "local";
    device.innerHTML = deviceGlyphs[remote ? "remote" : "local"];
    device.setAttribute("data-minecodex-tooltip", text("Remote", "远程"));
    device.setAttribute("aria-label", text("Remote", "远程"));
    header.append(title);
    if (remote) header.append(device);
    const elapsed = relativeTime(item.timestamp);
    if (item.attention) {
      const label = document.createElement("span");
      label.className = "mcx-attention";
      label.dataset.attention = item.attention;
      label.textContent = item.attention === "approval" ? text("Awaiting approval", "等待批准") : text("Needs input", "需要回复");
      header.append(label);
    } else if (elapsed) {
      const time = document.createElement("time");
      time.dateTime = new Date(item.timestamp).toISOString();
      time.textContent = elapsed;
      time.setAttribute("data-minecodex-tooltip", new Date(item.timestamp).toLocaleString());
      header.append(time);
    }
    card.append(header);
    if (item.summary) {
      const summary = document.createElement("span");
      summary.className = "mcx-summary";
      summary.textContent = item.summary;
      card.append(summary);
    }
    if (item.project) {
      const project = document.createElement("span");
      project.className = "mcx-project";
      const icon = document.createElement("span");
      icon.className = "mcx-project-icon";
      const glyph = projectIcons.get(item.project.id)?.cloneNode(true);
      if (glyph) icon.append(glyph);
      else icon.innerHTML = folderGlyph;
      project.append(icon);
      const name = document.createElement("span");
      name.textContent = item.project.name;
      project.append(name);
      card.append(project);
    }

    if (item.unread && !item.attention && !item.working) {
      const dot=document.createElement("span");
      dot.className="mcx-unread-dot";
      if (!elapsed) dot.style.marginInlineStart="auto";
      dot.setAttribute("aria-label",text("Unread","未读"));
      header.append(dot);
    }
    const dismiss=document.createElement("button");
    dismiss.type="button";
    dismiss.className="mcx-dismiss";
    dismiss.innerHTML=closeGlyph;
    dismiss.setAttribute("aria-label",text("Dismiss notification","关闭通知"));
    dismiss.addEventListener("click",()=>{queue.dismiss(item.key);schedule();});
    card.addEventListener("click",async()=>{
      if (card.disabled) return;
      card.disabled=true;
      try { const navigated=await shell.record.activate(); if(navigated===false){card.disabled=false;return;} queue.dismiss(item.key); schedule(); }
      catch { card.disabled=false; }
    });
    shell.append(card,dismiss);
    shell.record=item;
    return shell;
}
const motion = {duration:320,easing:"cubic-bezier(.22,1,.36,1)"};
function updateCountdown(card,item) {
  const label=card.querySelector(".mcx-attention");
  if(!label)return;
  const value=item.countdown;
  let counter=label.querySelector(".mcx-countdown");
  if(!value){counter?.remove();delete label.dataset.countdown;label.removeAttribute("aria-label");return;}
  if(!counter){counter=document.createElement("span");counter.className="mcx-countdown";label.append(counter);}
  const remaining=Math.max(0,value.deadlineMs-Date.now());
  const seconds=Math.ceil(remaining/1000);
  counter.textContent=seconds+text("s","秒");
  label.dataset.countdown="";
  label.style.setProperty("--countdown-progress",String(Math.min(1,remaining/value.durationMs)));
  label.setAttribute("aria-label",text(`Needs input, ${seconds} seconds remaining`,`需要回复，剩余 ${seconds} 秒`));
}
function updateStackViewport() {
  const rows=[...cards.values()].filter(card=>card.isConnected).sort((a,b)=>a.offsetTop-b.offsetTop);
  const collapsedMore=!expanded&&totalNotifications>3;
  panel.style.maxHeight=`${Math.max(0,stackAvailableHeight-12-(collapsedMore?54:0))}px`;
  const bottom=panel.scrollTop+panel.clientHeight;
  const overflow=panel.scrollHeight>panel.clientHeight+1;
  const atBottom=bottom>=panel.scrollHeight-1;
  const edge=rows.find(card=>card.offsetTop+card.offsetHeight>=bottom)??rows.at(-1);
  const fade=Math.min((edge?.offsetHeight??80)/2,panel.clientHeight/3);
  panel.style.maskImage=expanded&&!panel.hidden&&overflow&&!atBottom ? `linear-gradient(to bottom,black calc(100% - ${fade}px),transparent 100%)` : "none";
  more.hidden=tail.hidden=panel.hidden||!collapsedMore;
  if(collapsedMore&&!panel.hidden&&!collapseAnimation){
    const rect=panel.getBoundingClientRect();
    tail.style.left=`${rect.left+6}px`;tail.style.top=`${rect.bottom-32}px`;tail.style.width=`${rect.width-12}px`;
    more.style.left=`${rect.left+rect.width/2}px`;more.style.top=`${rect.bottom+18}px`;
    const count=totalNotifications-3;
    const label=text(`${count} more ${count===1?"notification":"notifications"}`,`还有 ${count} 条通知`);
    if(more.textContent!==label)more.textContent=label;
    more.setAttribute("aria-expanded","false");
  }
}
let stackAvailableHeight=innerHeight;
panel.addEventListener("scroll",updateStackViewport,{signal,passive:true});
function renderRows(records) {
  const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const signatureFor=item=>JSON.stringify([item.title,item.summary,item.project,item.attention,item.unread,item.working,item.hostId,relativeTime(item.timestamp),document.documentElement.lang]);
  const ordered=[...panel.children].filter(card=>cards.get(card.record?.key)===card);
  if(records.length===cards.size && records.every((item,index)=>ordered[index]===cards.get(item.key)&&cards.get(item.key)?.signature===signatureFor(item))){
    records.forEach(item=>{const card=cards.get(item.key);card.record=item;updateCountdown(card,item);});
    updateStackViewport();return;
  }
  const positions=new Map([...cards].map(([key,card])=>[key,card.getBoundingClientRect().top]));
  // 从当前视觉位置接续，避免连续状态更新时叠加 transform 动画。
  for(const card of cards.values()) { card.moveAnimation?.cancel(); card.enterAnimation?.cancel(); }
  const keys=new Set(records.map(item=>item.key));
  for(const [key,card] of cards) if(!keys.has(key)){
    const top=card.offsetTop,width=card.offsetWidth;
    cards.delete(key);
    if(reducedMotion||panel.hidden){card.remove();continue;}
    card.style.cssText+=`;position:absolute;top:${top}px;width:${width}px;pointer-events:none;`;
    card.inert=true;
    card.animate([{opacity:1,transform:"translateX(0)"},{opacity:0,transform:"translateX(-10px)"}],{duration:180,easing:"ease-out"}).finished.then(()=>{card.remove();schedule();},()=>card.remove());
  }
  records.forEach((item,index)=>{
    const signature=signatureFor(item);
    let card=cards.get(item.key),fresh=!card;
    if(!card){card=createCard(item);cards.set(item.key,card);}
    else if(card.signature!==signature){
      // 保留容器、点击目标与键盘焦点；仅更新内容，不重播整卡入场。
      const next=createCard(item),button=card.querySelector("[data-unread-row]");
      button.replaceChildren(...next.querySelector("[data-unread-row]").childNodes);
      if(!reducedMotion)button.animate([{opacity:.65},{opacity:1}],{duration:180,easing:"ease-out"});
    }
    card.signature=signature;card.record=item;
    if(panel.children[index]!==card)panel.insertBefore(card,panel.children[index]??null);
    updateCountdown(card,item);
    if(fresh&&!reducedMotion)card.enterAnimation=card.animate([{opacity:0,transform:"translateX(-12px)"},{opacity:1,transform:"translateX(0)"}],motion);
  });
  updateStackViewport();
  if(!reducedMotion) for(const [key,card] of cards){
    const delta=positions.get(key)-card.getBoundingClientRect().top;
    if(Number.isFinite(delta)&&Math.abs(delta)>.5)card.moveAnimation=card.animate([{transform:`translateY(${delta}px)`},{transform:"translateY(0)"}],motion);
  }
}
function animateCollapse(before) {
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const after=panel.getBoundingClientRect();
  const distance=before.height-after.height;
  if(distance<=1)return;
  panel.style.overflow="hidden";
  collapseAnimation=panel.animate([{height:`${Math.max(0,before.height-12)}px`,maxHeight:`${before.height}px`},{height:`${Math.max(0,after.height-12)}px`,maxHeight:getComputedStyle(panel).maxHeight}],motion);
  for(const node of [tail,more]) if(!node.hidden)node.animate([
    {opacity:0,translate:`0 ${distance}px`},
    {opacity:1,translate:"0 0"}
  ],motion);
  const animation=collapseAnimation;
  animation.finished.then(()=>{
    if(collapseAnimation!==animation)return;
    collapseAnimation=null;panel.style.overflow="";updateStackViewport();
  },()=>{});
}
function sync() {
  if(disposed)return;
  const layout=native.layout(),snapshot=native.snapshot();
  const changedPage=layout.pageKey!=null&&pageKey!=null&&layout.pageKey!==pageKey;
  const collapseFrom=changedPage&&expanded&&!panel.hidden?panel.getBoundingClientRect():null;
  if(layout.pageKey!=null)pageKey=layout.pageKey;
  if(changedPage){
    expanded=false;collapseAnimation?.cancel();collapseAnimation=null;panel.style.overflow="";
    panel.scrollTop=0;
  }
  if(!snapshot){queue.clear();panel.replaceChildren();cards.clear();panel.hidden=true;more.hidden=true;tail.hidden=true;expanded=false;return;}
  if(account!==snapshot.account){queue.clear();expanded=false;account=snapshot.account;}
  cacheProjectIcons();
  const details=queue.update(snapshot.records.slice().sort((a,b)=>(a.timestamp??0)-(b.timestamp??0)),snapshot.currentKey);
  totalNotifications=details.length;
  if(!details.length)expanded=false;
  panel.hidden=!layout.visible||(!details.length&&!cards.size);
  if(!details.length){renderRows([]);return;}
  if(panel.hidden){more.hidden=true;tail.hidden=true;return;}
  const width=Math.min(320,Math.max(0,innerWidth-layout.left-12));
  panel.style.left=`${layout.left}px`;
  panel.style.top=`${layout.top}px`;
  panel.style.width=`${width}px`;
  stackAvailableHeight=Math.max(0,innerHeight-layout.top-12);
  panel.setAttribute("aria-label",text("Chat notifications","会话通知"));
  renderRows(expanded?details:details.slice(0,3));
  if(collapseFrom)animateCollapse(collapseFrom);
}
function schedule() {
  if(disposed||queued)return;
  queued=true;
  queueMicrotask(()=>{queued=false;sync();});
}
const observer=new MutationObserver(mutations=>{
  if(mutations.some(m=>!panel.contains(m.target)&&m.target!==style&&!more.contains(m.target)&&!tail.contains(m.target)))schedule();
});
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["inert","aria-hidden","aria-expanded","data-app-shell-sidebar-open","data-slate-sidebar-peeking","lang"]});
window.addEventListener("resize",schedule,{signal});
// 隐藏的原生视图不一定重绘；每秒读取 store，不发送请求或切换 Activity。
const timer=setInterval(schedule,1000);
sync();
return ()=>{disposed=true;clearInterval(timer);observer.disconnect();native.dispose();queue.clear();panel.remove();more.remove();tail.remove();style.remove();};
