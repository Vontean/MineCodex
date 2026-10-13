import { readQvTheme } from '../../mermaid/frame.mjs';
export function createMarkdownMermaidControls(native) {
  const { React, Actions, Button, CopyButton, Tooltip, ExpandIcon, DownloadIcon, downloadImage, TablePreview } = native;
  const h = React.createElement, chinese = document.documentElement.lang.startsWith('zh');
  const download = chinese ? '下载图表' : 'Download diagram';
  const expand = chinese ? '放大图表' : 'Expand diagram';
  function configureShell(area) {
    const shell=area.parentElement.parentElement;
    shell.style.paddingTop='64px';shell.style.paddingBottom='48px';
    shell.style.paddingInline='clamp(16px, 4vw, 48px)';
  }
  function CanvasMeasure({onMeasured}) {
    const ref=React.useRef(null);
    React.useLayoutEffect(()=>{
      const area=ref.current.closest('[data-testid="image-preview-dismiss-area"]');
      configureShell(area);
      let ticket=requestAnimationFrame(()=>{ticket=requestAnimationFrame(()=>onMeasured({width:area.clientWidth,height:area.clientHeight}));});
      return ()=>cancelAnimationFrame(ticket);
    },[onMeasured]);
    return h('div',{ref});
  }
  function FrameView({ item, size, palette, onViewport }) {
    const ref = React.useRef(null);
    React.useLayoutEffect(() => {
      const slot = ref.current, frame = item.controller.frame;
      item.expanded = true;
      slot.moveBefore(frame, null);
      frame.style.width = size.width + 'px'; frame.style.height = size.height + 'px';
      frame.style.transformOrigin = '0 0'; item.controller.mode('viewer');
      const wrapper = slot.parentElement;
      const area = slot.closest('[data-testid="image-preview-dismiss-area"]');
      configureShell(area);
      const update = () => { const scale=wrapper.getBoundingClientRect().width/size.width;frame.style.transform=`scale(${scale})`;frame.dataset.zoom=String(scale); };
      const measure = () => {
        const rect = area.getBoundingClientRect();
        onViewport(previous => previous?.width === rect.width && previous?.height === rect.height
          ? previous : { width: rect.width, height: rect.height });
      };
      const observer = new ResizeObserver(update); observer.observe(wrapper); update();
      const viewportObserver = new ResizeObserver(measure); viewportObserver.observe(area); measure();
      let drag = null;
      item.controller.input(input => {
        const rect = frame.getBoundingClientRect(), scale = rect.width / size.width;
        if (input.kind === 'wheel') {
          area.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:input.deltaY,deltaMode:input.deltaMode,clientX:rect.left+input.x*scale,clientY:rect.top+input.y*scale}));
        }
        if (input.kind === 'start') drag = {left:area.scrollLeft,top:area.scrollTop};
        if (input.kind === 'drag' && drag) { area.scrollLeft = drag.left-input.dx*scale; area.scrollTop = drag.top-input.dy*scale; }
        if (input.kind === 'end') drag = null;
        if (input.kind === 'pan') {area.scrollLeft+=input.dx;area.scrollTop+=input.dy;}
      });
      return () => {
        observer.disconnect(); viewportObserver.disconnect(); item.controller.input(null); item.expanded = false;
        if (item.slot.isConnected) item.slot.moveBefore(frame, null);
        frame.style.transform = ''; frame.style.transformOrigin = ''; frame.style.width = '';
        frame.style.height = item.height + 'px'; item.controller.mode('inline');
      };
    }, [item,size.width]);
    React.useLayoutEffect(()=>{item.controller.frame.style.height=size.height+'px';},[item,size.height]);
    return h('div',{ref,className:'mcx-reading-qv-slot',style:palette});
  }
  return function Controls({ item }) {
    const [open,setOpen] = React.useState(false), [size,setSize] = React.useState(null);
    const [downloading,setDownloading] = React.useState(false), [failed,setFailed] = React.useState(false);
    const [measuring,setMeasuring] = React.useState(false);
    const pendingMeasurement = React.useRef(null);
    const onMeasured = React.useCallback(canvas=>{pendingMeasurement.current?.resolve(canvas);pendingMeasurement.current=null;setMeasuring(false);},[]);
    React.useEffect(()=>()=>{pendingMeasurement.current?.reject(new Error('diagram-disposed'));},[]);
    const [viewport,setViewport] = React.useState(null);
    const [ready,setReady] = React.useState(item.ready), [palette,setPalette] = React.useState({});
    const trigger = React.useRef(null);
    React.useEffect(() => { item.setReady=setReady; item.setNaturalHeight=height=>setSize(size=>size&&size.height!==height?{...size,height}:size); item.close=()=>setOpen(false); return ()=>{item.setReady=null;item.setNaturalHeight=null;item.close=null;}; }, [item]);
    const save = async () => {
      if (downloading || !item.ready) return;
      setDownloading(true);setFailed(false);
      try {
        const canvas = open && viewport ? viewport : await new Promise((resolve,reject)=>{pendingMeasurement.current={resolve,reject};setMeasuring(true);});
        const blob = await item.export(canvas);
        if (!await downloadImage({downloadSrc:blob,suggestedFilename:'mermaid-diagram.png'})) throw new Error('diagram-download-failed');
      } catch { setFailed(true); }
      finally { setDownloading(false); }
    };
    // 把占画幅 90% 的适配尺寸交给原生组件，作为其 100% 缩放基准。
    const fit = viewport && size ? .9 * Math.min(viewport.width / size.width, viewport.height / size.height) : 1;
    return h(React.Fragment,null,
      h(Actions, { 'data-visible':true, 'data-markdown-copy':'exclude' },
        h(CopyButton,{ariaLabel:chinese?'复制图表源码':'Copy diagram source',buttonText:chinese?'复制图表源码':'Copy diagram source',iconOnly:true,variant:'blockAction',onCopy:()=>navigator.clipboard.writeText(item.source).then(()=>true)}),
        h(Tooltip,{tooltipContent:failed?(chinese?'下载失败，点击重试':'Download failed. Retry'):download,delayOpen:true},h(Button,{'aria-label':download,'aria-busy':downloading,disabled:!ready||downloading,color:'blockAction',radius:'full',size:'inputIcon',onClick:save},h(DownloadIcon,{className:'icon-xs'}))),
        h(Tooltip,{tooltipContent:expand,delayOpen:true},h(Button,{ref:trigger,'aria-label':expand,'aria-expanded':open,disabled:!ready,color:'blockAction',radius:'full',size:'inputIcon',onClick:()=>{setFailed(false);const theme=readQvTheme(item.host);setPalette({background:theme.tokens['--background'],color:theme.tokens['--foreground']});setViewport(null);setSize(item.controller.size());setOpen(true);}},h(ExpandIcon)))),
      measuring?h('div',{'aria-hidden':true,inert:true,style:{position:'fixed',inset:0,width:'100vw',height:'100dvh',visibility:'hidden',pointerEvents:'none',zIndex:-1}},
        h(TablePreview,{src:'',alt:expand,open:true,inline:true,imageSurface:'card',showDownload:false,showZoomControls:true,onOpenChange:()=>{},zoomableContent:{width:1,height:1,content:h(CanvasMeasure,{onMeasured})}})):null,
      open&&size?h(TablePreview,{src:'',alt:expand,open:true,dialogAriaLabel:expand,closeAriaLabel:chinese?'关闭图表预览':'Close diagram preview',imageSurface:'card',caption:failed?(chinese?'下载失败，请重试。':'Download failed. Please retry.'):undefined,showDownload:true,downloadAriaLabel:download,onDownload:save,showZoomControls:true,disableOpenAnimation:true,onOpenChange:setOpen,onOpenAutoFocus:event=>{event.preventDefault();item.controller.frame.focus({preventScroll:true});},onCloseAutoFocus:event=>{event.preventDefault();trigger.current?.focus({preventScroll:true});},
        zoomableContent:{width:size.width*fit,height:size.height*fit,content:h(FrameView,{item,size,palette,onViewport:setViewport})}}):null);
  };
}
