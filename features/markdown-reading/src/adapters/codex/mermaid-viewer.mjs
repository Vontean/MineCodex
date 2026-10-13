import { readQvTheme } from '../../mermaid/frame.mjs';
export function createMarkdownMermaidControls(native) {
  const { React, Actions, Button, CopyButton, Tooltip, ExpandIcon, TablePreview } = native;
  const h = React.createElement, chinese = document.documentElement.lang.startsWith('zh');
  const expand = chinese ? '放大图表' : 'Expand diagram';
  function FrameView({ item, mode }) {
    const ref = React.useRef(null);
    React.useLayoutEffect(() => {
      const slot = ref.current;
      // moveBefore 保留 iframe 的 browsing context，关闭后 QV 分组与视口状态仍在。
      slot.moveBefore(item.controller.frame, null);
      item.expanded = true;
      return () => {
        item.expanded = false;
        if (item.slot.isConnected) item.slot.moveBefore(item.controller.frame, null);
        item.controller.frame.style.height = item.height + 'px';
        item.controller.mode('inline');
      };
    }, [item]);
    React.useLayoutEffect(() => {
      item.mode = mode;
      item.controller.frame.style.height = mode === 'fit' ? '100%' : item.height + 'px';
      item.controller.mode(mode === 'fit' ? 'fullscreen' : 'inline');
    }, [mode, item]);
    return h('div', { ref, className:'mcx-reading-qv-slot', 'data-size':mode });
  }
  return function Controls({ item }) {
    const [open,setOpen] = React.useState(false), [mode,setMode] = React.useState('fit');
    const [ready,setReady] = React.useState(item.ready), [palette,setPalette] = React.useState({});
    const trigger = React.useRef(null);
    React.useEffect(() => { item.setReady=setReady; item.close=()=>setOpen(false); return ()=>{item.setReady=null;item.close=null;}; }, [item]);
    return h(React.Fragment,null,
      h(Actions, { 'data-visible':true, 'data-markdown-copy':'exclude' },
        h(CopyButton,{ariaLabel:chinese?'复制图表源码':'Copy diagram source',buttonText:chinese?'复制图表源码':'Copy diagram source',iconOnly:true,variant:'blockAction',onCopy:()=>navigator.clipboard.writeText(item.source).then(()=>true)}),
        h(Tooltip,{tooltipContent:expand,delayOpen:true},h(Button,{ref:trigger,'aria-label':expand,'aria-expanded':open,disabled:!ready,color:'blockAction',radius:'full',size:'inputIcon',onClick:()=>{const theme=readQvTheme(item.host);setPalette({background:theme.tokens['--background'],color:theme.tokens['--foreground']});setMode('fit');setOpen(true);}},h(ExpandIcon)))),
      open?h(TablePreview,{src:'',alt:expand,open:true,dialogAriaLabel:expand,closeAriaLabel:chinese?'关闭图表预览':'Close diagram preview',showDownload:false,showZoomControls:false,disableOpenAnimation:true,onOpenChange:setOpen,onCloseAutoFocus:event=>{event.preventDefault();trigger.current?.focus({preventScroll:true});},previewContent:h('div',{className:'mcx-reading-qv-expanded',style:palette},
        h('div',{className:'mcx-reading-qv-size'},h(Button,{color:'blockAction',size:'sm',style:{color:'inherit'},'aria-pressed':mode==='actual',onClick:()=>setMode(mode==='fit'?'actual':'fit')},mode==='fit'?(chinese?'实际大小':'Actual size'):(chinese?'适配视口':'Fit to view'))),h(FrameView,{item,mode}))}):null);
  };
}
