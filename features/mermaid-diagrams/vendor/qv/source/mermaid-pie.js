async function renderMermaidPie(root,data) {
 root.dataset.renderer='qv-pie';root.classList.add('qv-pie');
 const config={title:root.querySelector('h3').textContent||data.title,items:data.items.map(d=>({label:d.name,value:d.value,description:d.description})),decimals:data.items.every(d=>Number.isInteger(d.value))?0:2,showData:data.showData,exactValues:true,showTooltip:false,valuePrefix:'',valueSuffix:''};
 await renderMermaidDonutPreset(root,config,data.items.map(d=>`${d.name}：${d.value}`).join('；'));root.dataset.state='enhanced';
 const style=document.createElement('style');style.textContent=`#${root.id} .legend button{max-width:100%;min-width:0;text-align:left}#${root.id} .legend .name{min-width:0;overflow-wrap:anywhere}#${root.id} .legend .percent{flex:none}#${root.id} .center-value{line-height:1.2}#${root.id} .center-label{max-width:140px;overflow-wrap:anywhere}`;root.append(style);
 const number=root.querySelector('.center-value'),ctx=document.createElement('canvas').getContext('2d');ctx.font='500 32px '+getComputedStyle(root).fontFamily;const fit=()=>number.style.fontSize=Math.min(32,32*136/Math.max(1,ctx.measureText(number.textContent).width))+'px';fit();new MutationObserver(fit).observe(number,{childList:true,characterData:true,subtree:true});
 if(data.showData)root.querySelectorAll('.legend .percent').forEach((n,i)=>n.textContent=data.items[i].value+' · '+n.textContent);
}
