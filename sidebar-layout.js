(()=>{
 const handle=document.getElementById('sidebarResizer'),sidebar=document.getElementById('sidebar'),key='feihong-sidebar-width-v1';
 let width=232;
 function apply(value){width=Math.round(Math.max(72,Math.min(420,window.innerWidth*.4,value)));document.documentElement.style.setProperty('--sidebar-width',width+'px');document.body.classList.toggle('sidebar-icon-only',width<=110);handle.setAttribute('aria-valuemin','72');handle.setAttribute('aria-valuemax',String(Math.max(72,Math.min(420,Math.floor(window.innerWidth*.4)))));handle.setAttribute('aria-valuenow',String(width));}
 function save(){try{localStorage.setItem(key,String(width));}catch{}}
 try{const saved=Number(localStorage.getItem(key));if(saved>=72&&saved<=420)width=saved;}catch{}
 // v0.9.205：新打开默认展开（上次是图标模式则回到 232）
 if(width<=110)width=232;
 apply(width);
 handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();const start=e.clientX,initial=sidebar.getBoundingClientRect().width;handle.setPointerCapture(e.pointerId);document.body.classList.add('resizing-sidebar');handle.onpointermove=m=>apply(initial+m.clientX-start);};
 function finish(){handle.onpointermove=null;document.body.classList.remove('resizing-sidebar');save();}
 handle.onpointerup=handle.onpointercancel=handle.onlostpointercapture=finish;
 handle.ondblclick=()=>{apply(232);save();};
 handle.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();apply(width+(e.key==='ArrowRight'?10:-10));save();}};
 window.FeihongSidebar={compact(){apply(72);save();},expand(){apply(232);save();}};
 window.addEventListener('resize',()=>apply(width));
})();
