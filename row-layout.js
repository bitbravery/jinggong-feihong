(()=>{
 const key='feihong-dimensions-v1';let sizes={};
 try{const saved=JSON.parse(localStorage.getItem(key))||{};for(const [k,v] of Object.entries(saved))if(k.startsWith('width:')&&Number.isFinite(v))sizes[k]=v;}catch{}
 const save=()=>{try{localStorage.setItem(key,JSON.stringify(sizes));}catch{}};
 save();
 function addWidthHandles(){
  const controls=[...document.querySelectorAll('#overview .status-tab')];
  controls.forEach((control,i)=>{
   if(control.dataset.widthReady)return;control.dataset.widthReady='true';
   // Native controls cannot contain resize handles, so give them a stable wrapper.
   let box=control;if(['SELECT','INPUT','BUTTON'].includes(control.tagName)){box=document.createElement('div');box.className='sized-control';control.before(box);box.append(control);}
   box.dataset.widthReady='true';
   const id=control.id||control.querySelector('input,select')?.id||control.dataset.column||'control-'+i;
   if(Number.isFinite(sizes['width:'+id])){box.style.width=sizes['width:'+id]+'px';box.style.flex='0 0 auto';box.style.minWidth='0';}
   const h=document.createElement('span');h.className='control-width-handle';h.tabIndex=0;h.setAttribute('role','separator');h.setAttribute('aria-label','调整此项宽度，左右方向键微调');box.append(h);
   const set=w=>{sizes['width:'+id]=Math.max(60,Math.min(2400,Math.round(w)));box.style.width=sizes['width:'+id]+'px';box.style.flex='0 0 auto';box.style.minWidth='0';};
   h.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();const start=e.clientX,width=box.getBoundingClientRect().width;h.setPointerCapture(e.pointerId);h.onpointermove=m=>set(width+m.clientX-start);h.onpointerup=h.onpointercancel=()=>{h.onpointermove=null;save();};};
   h.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();e.stopPropagation();set(box.getBoundingClientRect().width+(e.key==='ArrowRight'?6:-6));save();}};
   h.ondblclick=e=>{e.stopPropagation();delete sizes['width:'+id];box.style.width='';box.style.flex='';box.style.minWidth='';save();};
  });
 }
 document.addEventListener('feihong-layout',addWidthHandles);addWidthHandles();
})();
