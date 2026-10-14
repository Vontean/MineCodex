// 导出副本保留原始排版；正文和原生查看器的缩放、滚动与动画不受影响。
export async function exportQvDiagram(frame, toBlob, canvasSize) {
  const doc = frame.contentDocument, root = doc.querySelector('.qv-mermaid');
  await doc.fonts.ready;
  await Promise.all((root.getAnimations?.({subtree:true})||[])
    .filter(a=>a.playState==='running'&&Number.isFinite(a.effect?.getComputedTiming().endTime))
    .map(a=>a.finished.catch(()=>{})));
  // 雷达顶点由 rAF 更新属性；只等待正在变化的几何稳定，不修改原图。
  if (root.classList?.contains('qv-radar')) {
    let last='',stable=0;
    for (let i=0;i<60&&stable<3;i++) {
      const current=[...root.querySelectorAll('polygon')].map(n=>n.getAttribute('points')).join('|');
      stable=current===last?stable+1:0;last=current;
      if(stable<3)await new Promise(resolve=>setTimeout(resolve,20));
    }
  }
  const scene = root.querySelector('.scene'), viewport = root.querySelector('.diagram-scroll');
  const width = Math.ceil(Math.max(root.clientWidth, scene.offsetWidth));
  const copy = root.cloneNode(true);
  copy.classList.add('mcx-qv-export');
  copy.querySelectorAll('.scope-nav,.edge-key,.scope-status,[popover],[role="tooltip"],.node-tip,.seq-tip,.qv-notice').forEach(node => node.remove());
  copy.style.cssText += `;position:absolute;left:0;top:0;width:${width}px;max-width:none;margin:0;transform:translateX(-100000px);overflow:visible;`;
  const copiedViewport = copy.querySelector('.diagram-scroll'), copiedScene = copy.querySelector('.scene');
  copiedViewport.style.cssText += `;width:${viewport.offsetWidth}px;height:${scene.offsetHeight}px;overflow:visible;padding-bottom:0;transform:none;`;
  copiedScene.style.cssText += `;width:${scene.offsetWidth}px;height:${scene.offsetHeight}px;min-width:${scene.offsetWidth}px;transform:none;`;
  copy.querySelectorAll('svg [mask]').forEach(node => {
    if(node.getAttribute('mask').includes('reveal'))node.removeAttribute('mask');
  });
  copy.querySelectorAll('svg [clip-path]').forEach(node => {
    if(node.getAttribute('clip-path').includes('sankey-mask'))node.removeAttribute('clip-path');
  });
  const style = doc.createElement('style');
  style.textContent = `#${root.id}.mcx-qv-export *{animation:none!important;transition:none!important}`;
  copy.append(style);
  doc.body.append(copy);
  try {
    // html-to-image 深拷贝 SVG 而不逐个解析其子节点样式；先冻结线条、文字和渐变。
    const svgProperties=['fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','vector-effect','opacity','visibility','font-family','font-size','font-weight','text-anchor','dominant-baseline','stop-color','stop-opacity','mask','clip-path'];
    for(const node of copy.querySelectorAll('svg,svg *')) {
      const computed=frame.contentWindow.getComputedStyle(node);
      for(const name of svgProperties)node.style.setProperty(name,computed.getPropertyValue(name));
    }
    copy.querySelectorAll('svg style').forEach(node=>node.remove());
    // 系统字体在 SVG 图像内的字宽可能有细微差异；冻结原本单行的文字，避免导出时多换一行。
    for(const node of copy.querySelectorAll('*')) {
      if(node.namespaceURI!=='http://www.w3.org/1999/xhtml'||![...node.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
      const textStyle=frame.contentWindow.getComputedStyle(node),line=parseFloat(textStyle.lineHeight);
      if(Number.isFinite(line)&&node.getBoundingClientRect().height<=line+.5)node.style.whiteSpace='nowrap';
    }
    const customProperties = new Set(Array.from(frame.contentWindow.getComputedStyle(root)).filter(name=>name.startsWith('--')));
    for(const node of copy.querySelectorAll('*'))for(const name of node.style)if(name.startsWith('--'))customProperties.add(name);
    const height = Math.ceil(Math.max(copy.offsetHeight,copy.scrollHeight||0));
    const blob = await toBlob(copy, { width, height, pixelRatio:canvasSize?2*Math.max(1,.9*Math.min(canvasSize.width/width,canvasSize.height/height)):2, skipAutoScale:true, filter:node=>node.tagName!=='STYLE',
      includeStyleProperties:['display','position','left','top','right','bottom','width','height','min-width','max-width','min-height','max-height','box-sizing','padding','margin','overflow','background-color','background-image','background-size','background-position','color','font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-align','text-decoration','text-overflow','white-space','word-break','overflow-wrap','flex-direction','flex-wrap','flex-grow','flex-shrink','flex-basis','align-items','align-content','align-self','justify-content','gap','row-gap','column-gap','grid-template-columns','grid-template-rows','grid-auto-flow','vertical-align','border','border-top','border-right','border-bottom','border-left','border-radius','box-shadow','opacity','transform','transform-origin','z-index','visibility','fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','vector-effect','mask','clip-path','stop-color','stop-opacity','color-scheme',...customProperties],
      backgroundColor:frame.contentWindow.getComputedStyle(doc.body).backgroundColor,
      style:{position:'relative',left:'0',top:'0',transform:'none'} });
    if (!blob) throw new Error('diagram-export-empty');
    if (!canvasSize) return blob;
    const canvas=doc.createElement('canvas');
    canvas.width=Math.round(canvasSize.width*2);canvas.height=Math.round(canvasSize.height*2);
    const context=canvas.getContext('2d'),image=new frame.contentWindow.Image();
    const url=frame.contentWindow.URL.createObjectURL(blob);
    try {
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('diagram-export-image-failed'));image.src=url;});
      context.fillStyle=frame.contentWindow.getComputedStyle(doc.body).backgroundColor;
      context.fillRect(0,0,canvas.width,canvas.height);
      const fit=.9*Math.min(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight);
      const w=image.naturalWidth*fit,h=image.naturalHeight*fit;
      context.drawImage(image,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
      const result=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!result)throw new Error('diagram-export-empty');
      return result;
    } finally {frame.contentWindow.URL.revokeObjectURL(url);}

  } finally { copy.remove(); }
}

export async function saveQvDiagram(blob, saveFile, directory, filename) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary='';
  for (let start=0;start<bytes.length;start+=32768) binary+=String.fromCharCode(...bytes.subarray(start,start+32768));
  return saveFile('save-file',{params:{kind:'contents',suggestedFilename:directory+'/'+filename,contentsBase64:btoa(binary)}});
}
