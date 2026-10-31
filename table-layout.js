(()=>{
 const table=document.getElementById('parcelTable'),cols=[...table.querySelectorAll('col')],headers=[...table.querySelectorAll('th')],density=document.getElementById('tableDensity');
 const fontSel=document.getElementById('pageFont'),fontCustom=document.getElementById('pageFontCustom');
 const applyFont=()=>window.FeiHongPageFont.save(window.FeiHongPageFont.readControls(fontSel,fontCustom));
 const freezeInputs=[...document.querySelectorAll('[data-freeze]')],panel=document.getElementById('parcelPanel');
 const freezeKey='feihong-freeze-rows-v1';let frozen={};try{frozen=JSON.parse(localStorage.getItem(freezeKey))||{};}catch{}
 function updateFreeze(){let offset=0;for(const id of ['statusRow','queryRow']){const row=document.getElementById(id),enabled=freezeInputs.find(i=>i.dataset.freeze===id).checked;row.classList.toggle('pinned-row',enabled);row.style.top=enabled?offset+'px':'auto';if(enabled)offset+=row.getBoundingClientRect().height;}
 table.classList.toggle('pinned-header',document.getElementById('freezeHeader').checked);table.style.setProperty('--header-offset',offset+'px');}
 freezeInputs.forEach(input=>{input.checked=!!frozen[input.dataset.freeze];input.onchange=()=>{frozen[input.dataset.freeze]=input.checked;localStorage.setItem(freezeKey,JSON.stringify(frozen));updateFreeze();};});
 const rowObserver=new ResizeObserver(updateFreeze);for(const id of ['statusRow','queryRow'])rowObserver.observe(document.getElementById(id));updateFreeze();
 const ratios=[.035,.045,.17,.15,.24,.11,.10,.15],key='feihong-table-layout-v3';let autoFit=true,widths=[];
 function defaults(){const available=Math.max(700,table.parentElement.clientWidth||1100);const values=ratios.map(r=>Math.floor(available*r));values[7]+=available-values.reduce((a,b)=>a+b,0);return values;}
 widths=defaults();
 function save(){try{localStorage.setItem(key,JSON.stringify({widths,density:density.value,autoFit,font:fontSel.value,fontCustom:fontCustom.value}));}catch{}}
 function apply(){cols.forEach((c,i)=>c.style.width=widths[i]+'px');table.style.width=widths.reduce((a,b)=>a+b,0)+'px';table.dataset.density=density.value;}
 try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.autoFit===false&&saved?.widths?.length===8&&saved.widths.every(w=>Number.isFinite(w)&&w>=40&&w<=900)){widths=saved.widths;autoFit=false;}if(['compact','standard','loose'].includes(saved?.density))density.value=saved.density;if(saved&&saved.font){fontSel.value=saved.font;if(saved.font==='custom'){fontCustom.hidden=false;fontCustom.value=saved.fontCustom||14;}}}catch{}
 headers.forEach((th,i)=>{
  const handle=document.createElement('span');handle.className='column-resizer';handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-label','调整'+th.textContent+'列宽，左右方向键微调');th.append(handle);
  function resize(w){autoFit=false;widths[i]=Math.max(i===0?40:90,Math.min(900,w));apply();}
  handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();const start=e.clientX,width=widths[i];handle.setPointerCapture(e.pointerId);document.body.classList.add('resizing-columns');handle.onpointermove=m=>resize(width+m.clientX-start);handle.onpointerup=handle.onpointercancel=()=>{handle.onpointermove=null;document.body.classList.remove('resizing-columns');save();};};
  handle.ondblclick=()=>{resize(defaults()[i]);save();};
  handle.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();resize(widths[i]+(e.key==='ArrowRight'?10:-10));save();}};
 });
 density.onchange=()=>{apply();save();};
 fontSel.onchange=()=>{fontCustom.hidden=fontSel.value!=='custom';if(fontSel.value==='custom'){fontCustom.focus();}applyFont();save();};
 fontCustom.oninput=()=>applyFont();
 try{window.FeiHongPageFont.restore();}catch{}document.getElementById('resetColumns').onclick=()=>{autoFit=true;widths=defaults();apply();save();};new ResizeObserver(()=>{if(autoFit&&table.parentElement.clientWidth){widths=defaults();apply();}}).observe(table.parentElement);apply();
})();
(()=>{
 // 历史表 6 列：勾选 / 修改时间 / 快件 / 原→新状态 / 处理 / 操作与结果（比例与 index.html 的 colgroup 一致）。
 // v1 按 5 列保存，勾选列会吃掉“修改时间”的宽度，且 6 列的拖动结果重开就丢；换 v2 键、按 6 列存取。
 const table=document.querySelector('.history-table'),cols=[...table.querySelectorAll('col')],heads=[...table.querySelectorAll('th')],key='feihong-history-widths-v2',ratios=[3,9,18,20,20,30];let widths=null;
 const minOf=i=>i===0?32:80;
 try{const saved=JSON.parse(localStorage.getItem(key));if(Array.isArray(saved)&&saved.length===cols.length&&saved.every((w,i)=>Number.isFinite(w)&&w>=minOf(i)&&w<=1400))widths=saved;}catch{}
 function apply(){cols.forEach((c,i)=>c.style.width=widths?widths[i]+'px':ratios[i]+'%');table.style.width=widths?widths.reduce((a,b)=>a+b,0)+'px':'100%';}
 function save(){try{localStorage.setItem(key,JSON.stringify(widths));}catch{}}
 heads.forEach((th,i)=>{if(i===0)return;/* 勾选列不提供拖动 */const grip=document.createElement('span');grip.className='column-resizer';grip.tabIndex=0;grip.setAttribute('role','separator');grip.setAttribute('aria-label','调整'+th.textContent+'列宽');grip.setAttribute('aria-orientation','vertical');th.append(grip);
 function resize(w){if(!widths)widths=heads.map((h,j)=>Math.max(minOf(j),h.getBoundingClientRect().width));widths[i]=Math.max(minOf(i),Math.min(1400,w));apply();}
 grip.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();const start=e.clientX,w=th.getBoundingClientRect().width;grip.setPointerCapture(e.pointerId);grip.onpointermove=m=>resize(w+m.clientX-start);grip.onpointerup=grip.onpointercancel=()=>{grip.onpointermove=null;save();};};
 grip.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();resize(th.getBoundingClientRect().width+(e.key==='ArrowRight'?10:-10));save();}};
 });document.getElementById('resetHistoryColumns').onclick=()=>{widths=null;apply();save();};apply();
})();
