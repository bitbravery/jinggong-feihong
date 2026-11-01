// Executed only in the user-selected ehall tab, in MAIN world. No raw HTTP API guesses.
function sourceAction(command){
 const flowActiveTab=()=>{
  const names=['待办','已办','抄送给我'];
  const pick=n=>{
   const c=Array.from(document.querySelectorAll('.mini-tab,a,li,button,span')).filter(el=>String(el.textContent||'').trim()===n&&el.getBoundingClientRect().height>0);
   const inner=c.filter(el=>!c.some(o=>o!==el&&el.contains(o)));
   return inner.length===1?inner[0]:null;
  };
  const styleOf=el=>{const s=getComputedStyle(el);return [s.color,s.fontWeight,s.borderBottomWidth,s.borderBottomColor,s.backgroundColor].join('|');};
  const els=names.map(pick),styles=els.map(el=>el?styleOf(el):'');
  for(let i=0;i<3;i++){
   if(!styles[i])continue;
   const others=[0,1,2].filter(j=>j!==i);
   if(styles[others[0]]&&styles[others[0]]===styles[others[1]]&&styles[i]!==styles[others[0]])return names[i];
  }
  return '';
 };
 if(location.origin!=='https://ehall.bit.edu.cn'||!location.pathname.startsWith('/EIP/'))return null;
 if(!window.__fhErr)window.__fhErr=[];
 if(!window.__fhErrHooked){
  window.__fhErrHooked=1;
  const keep=o=>{try{window.__fhErr.push(o);if(window.__fhErr.length>6)window.__fhErr.shift();}catch{}};
  try{window.addEventListener('error',e=>keep({m:String((e&&e.message)||'').slice(0,100),s:String((e&&e.filename)||'').split('/').pop()+':'+((e&&e.lineno)||0)}),true);}catch{}
  try{window.addEventListener('unhandledrejection',e=>{const r=e&&e.reason;keep({m:String((r&&r.message)||r||'').slice(0,100),s:'Promise'});},true);}catch{}
 }
 const text=e=>(e?.innerText||e?.textContent||'').trim();
  // 人工验证：填完单号后在表单空白处单击一次即可触发联动，不需要回车
  const fhPoke=()=>{try{
   const box=document.getElementById('DH$text');
   if(!box)return false;
   // 人工点击空白之所以能联动，是因为它让单号框“失焦”：门户在 blur/change 时才按单号查询，
   // 单纯点一下 <td> 不会触发。
   try{box.focus();}catch{}
   try{box.blur();}catch{}
   for(const type of ['change','blur']){try{box.dispatchEvent(new Event(type,{bubbles:true}));}catch{}}
   const widget=window.mini&&window.mini.get?window.mini.get('DH'):null;
   if(widget){
     try{if(typeof widget.doValueChanged==='function')widget.doValueChanged();}catch{}
     try{if(typeof widget.fire==='function')widget.fire('valuechanged');}catch{}
   }
   let target=null;
   const label=Array.from(document.querySelectorAll('td,th,div,span,label')).find(el=>text(el)==='下单时间'&&fhVis(el));
   if(label)target=(label.closest&&label.closest('td'))||label;
   if(!target){const cell=box.closest&&box.closest('td');target=(cell&&cell.parentElement&&cell.parentElement.querySelector('td'))||cell||box.form||box.parentElement||document.body;}
   const r=target.getBoundingClientRect();
   const at={bubbles:true,cancelable:true,view:window,button:0,detail:1,clientX:Math.round(r.left+Math.min(10,Math.max(2,r.width/2))),clientY:Math.round(r.top+Math.min(10,Math.max(2,r.height/2)))};
   for(const type of ['mousedown','mouseup','click'])target.dispatchEvent(new MouseEvent(type,Object.assign({buttons:type==='mousedown'?1:0},at)));
   return true;
  }catch{return false}};
  // 门户“数据不完整/请检查后重新提交”这类拒绝提示
  const fhDirtyAlert=()=>{try{
   const boxes=Array.from(document.querySelectorAll('.mini-messagebox,.mini-window,.mini-panel')).filter(fhVis);
   for(const box of boxes){const t=text(box);if(/数据不完整|请检查后重新提交/.test(t))return {box,text:t};}
   return null;
  }catch{return null}};
  const fhPickRadio=r=>{try{
   if(r.checked)return true;
   const box=(r.closest&&r.closest('.mini-radiobutton'))||r.parentElement;
   const mask=box&&box.querySelector?box.querySelector('.mini-radio-mask'):null;
   const shoot=el=>{if(!el)return;for(const t of ['mousedown','mouseup','click']){try{el.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window}));}catch{try{el.click();}catch{}}}};
   if(mask)shoot(mask);
   if(!r.checked){try{r.click();}catch{}}
   if(!r.checked&&box){try{box.click();}catch{}}
   return !!r.checked;
  }catch{return false}};
 const statusList=['订单申请','已揽件','发出/派送中','已送达','已签收'];
 const value=id=>document.getElementById(id+'$text')?.value?.trim()||'';
 function startReadProbe(){
   const nodes=Array.from(document.querySelectorAll('tr.mini-grid-row[id*="$row2$"]')),token=String(Date.now())+':'+Math.random();
   const probe={token,nodes,signature:nodes.map(text).join('\n'),loaded:false,error:''};
   if(window.__feihongReadCleanup)window.__feihongReadCleanup();
   window.__feihongReadProbe=probe;
   const widgets=Array.from(document.querySelectorAll('.mini-grid')).map(el=>window.mini?.get?.(el.id)).filter(g=>g?.on);
   if(widgets.length===1){const grid=widgets[0];
     const loaded=()=>{if(window.__feihongReadProbe===probe)probe.loaded=true;cleanup();};
     const failed=()=>{if(window.__feihongReadProbe===probe)probe.error='原站查询请求失败';cleanup();};
     function cleanup(){if(grid.un){grid.un('load',loaded);grid.un('loaderror',failed);}}
     grid.on('load',loaded);grid.on('loaderror',failed);window.__feihongReadCleanup=cleanup;
   }
   return token;
 }
 if(['queryField','queryOrder','queryAll','queryDateField','queryRecent'].includes(command.type)){
   if(!location.pathname.endsWith('/queryResult.htm')||new URL(location.href).searchParams.get('queryCode')!=='8y4xbat8bd5dygdtw7ncbwcayenmnckt')return null;
   if(['queryField','queryOrder'].includes(command.type)&&!/^JGKD\d+$/.test(command.id||''))return {error:'无效查询单号'};
   // 加载遮罩分两种：盖住整页的照旧等；只盖住下方列表的（上次翻页没加载完、一直显示“加载中”），人工此时仍可改条件、点“查询”重新加载，
   // 所以列表遮罩连续出现超过 8 秒就当作卡住，继续填条件并点“查询”；8 秒内照旧等它自己结束。
   const masks=Array.from(document.querySelectorAll('.mini-mask-loading,.mini-grid-loading')).filter(e=>e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden');
   if(masks.some(e=>!(e.closest&&e.closest('.mini-grid'))&&!(e.classList&&e.classList.contains('mini-grid-loading')))){window.__fhGridMaskSince=0;return {waiting:true,step:'原站页面加载中'};}
   if(masks.length){if(!window.__fhGridMaskSince)window.__fhGridMaskSince=Date.now();const held=Date.now()-window.__fhGridMaskSince;if(held<8000)return {waiting:true,step:'原站列表加载中（'+Math.round(held/1000)+' 秒）'};}else window.__fhGridMaskSince=0;
   const rows=Array.from(document.querySelectorAll('tr[id^="line_"]'));
   if(!rows.length){document.getElementById('opensearch')?.click();return {waiting:true,step:'展开高级查询（当前 0 行条件）'};}
   const first=rows[0],index=first.id.slice(5);
   if(!first.getBoundingClientRect().height){document.getElementById('opensearch')?.click();return {waiting:true,step:'展开高级查询（条件行被折叠）'};}
   function choose(widget,label){
     // New relation dropdowns initialize their options only when first opened.
     if(!widget?.showPopup)return false;let open=false;try{open=!!widget.isShowPopup?.();}catch{}if(!open)widget.showPopup();
     const items=Array.from(document.querySelectorAll('.mini-listbox-item')).filter(e=>e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden'&&text(e)===label);
     if(items.length!==1)return false;
   items[0].dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));items[0].dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));items[0].click();return true;
   }
   if(['queryField','queryDateField'].includes(command.type)){
     for(const row of rows.slice(1)){const remove=row.querySelector('a[onclick^="delete_search"]');if(!remove)return {error:'无法清除原站旧查询条件'};remove.click();}
     const widget=window.mini?.get?.('queryConditionFields_'+index);
     if(!choose(widget,command.type==='queryDateField'?'下单时间':'单号'))return {waiting:true,step:'选择查询字段（下拉未出现选项）'};
     return {fieldSelected:true};
   }
  if(command.type==='queryRecent'){
    const ok=/^\d{4}-\d{2}-\d{2}$/;
    if(!ok.test(command.from||'')||!ok.test(command.endExclusive||'')||command.from>=command.endExclusive)return {error:'无效读取日期范围'};
    if(rows.length<2){const add=first.querySelector('a[onclick^="add_search"]');if(!add)return {error:'原站缺少新增日期条件入口'};add.click();return {waiting:true,step:'新增第二条条件行'};}
    if(rows.length!==2)return {error:'日期筛选条件数量异常（当前 '+rows.length+' 行）'};
    for(let i=0;i<2;i++){
      const n=rows[i].id.slice(5),fid='queryConditionFields_'+n,field=window.mini?.get?.(fid);
      if(value(fid)!=='下单时间'){
        if(choose(field,'下单时间'))return {waiting:true,step:'选择字段第'+(i+1)+'行',row:i+1};
        if(field?.setValue)try{field.setValue('下单时间');}catch{}
        return {waiting:true,step:'选择字段第'+(i+1)+'行',row:i+1,value:value(fid)};
      }
      const relation=i===0?'大于等于':'小于',rid='logicRelation_'+n,rw=window.mini?.get?.(rid);
      if(value(rid)!==relation){
        if(choose(rw,relation))return {waiting:true,step:'选择比较符第'+(i+1)+'行',row:i+1};
        if(rw?.setValue)try{rw.setValue(relation);}catch{}
        return {waiting:true,step:'选择比较符第'+(i+1)+'行',row:i+1,value:value(rid)};
      }
      const input=document.getElementById('paramValue_'+n+'$text'),widget=window.mini?.get?.('paramValue_'+n),date=i===0?command.from:command.endExclusive;
      if(!input?.isConnected)return {error:'日期输入框未生成（第'+(i+1)+'行），无法重建查询字段'};
      if(widget?.setValue)widget.setValue(date);else {input.value=date;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
      if(input.value.trim().slice(0,10)!==date)return {error:'原站日期输入值未生效（第'+(i+1)+'行：期望 '+date+'，实际 '+input.value.trim().slice(0,10)+'）'};
    }
    const and=Array.from(document.querySelectorAll('input[type="radio"]')).find(r=>text(r.parentElement)==='满足以上所有条件')||Array.from(document.querySelectorAll('input[type="radio"]')).find(r=>r.value==='$and');
    if(!and)return {error:'未识别日期条件的“满足以上所有条件”选项'};
    if(!and.checked){and.click();if(and.checked===false)return {waiting:true,step:'选中“满足以上所有条件”'};}
    const links=Array.from(document.querySelectorAll('a')).filter(a=>text(a)==='查询');if(links.length!==1)return {error:'无法唯一识别原站查询按钮'};
    const token=startReadProbe();links[0].click();return {queryRequested:true,token};
  }
  if(command.type==='queryOrder'){
     if(rows.length!==1||value('queryConditionFields_'+index)!=='单号')return {error:'原站精确查询字段未生效，未发起回查。'};
     if(value('logicRelation_'+index)!=='等于'){choose(window.mini?.get?.('logicRelation_'+index),'等于');return {waiting:true};}
     const input=document.getElementById('paramValue_'+index+'$text'),widget=window.mini?.get?.('paramValue_'+index);
     if(!input?.isConnected||!widget?.setValue)return {waiting:true};
     widget.setValue(command.id);
     if(value('paramValue_'+index)!==command.id)return {error:'原站完整单号未生效，未发起回查。'};
     // 条件组合在不同门户版本里是不同结构：有的 radio 值是 $and，有的只有“满足以上所有条件”文字。
     const radios=Array.from(document.querySelectorAll('input[type="radio"]'));
     const all=radios.find(r=>r.value==='$and')||radios.find(r=>/满足以上所有条件/.test(text(r.parentElement)));
     if(!all)return {error:'未识别原站“满足以上所有条件”选项，未发起回查。'};
     if(!all.checked){
       const key=String(all.id||'').split('$ck$')[0];
       const group=key?window.mini?.get?.(key):null;
       if(group?.setValue)try{group.setValue('$and');}catch{}
       if(!all.checked&&typeof all.click==='function')all.click();
       // 两种方式都没选中就继续等，下一轮重试；不会带着“或”的条件去回查。
       if(!all.checked)return {waiting:true};
     }
     const grids=Array.from(document.querySelectorAll('.mini-grid')).map(el=>window.mini?.get?.(el.id)).filter(g=>g?.on);
     if(grids.length!==1)return {error:'无法跟踪原站精确查询完成事件，未发起回查。'};
     const links=Array.from(document.querySelectorAll('a')).filter(a=>text(a)==='查询');
     if(links.length!==1)return {error:'无法唯一识别原站查询按钮'};
     const token=startReadProbe();window.__feihongReadProbe.strictLoad=true;
     links[0].click();return {queryRequested:true,token};
   }
   if(!choose(window.mini?.get?.('logicRelation_'+index),'不为空'))return {waiting:true};
   const input=document.getElementById('paramValue_'+index+'$text'),widget=window.mini?.get?.('paramValue_'+index);
   const parameter=command.type==='queryAll'?'':command.id;
   if(widget?.setValue)widget.setValue(parameter);else if(input){input.value=parameter;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}else return {error:'缺少原站单号条件值输入框'};
   const all=Array.from(document.querySelectorAll('input[type="radio"]')).find(r=>text(r.parentElement)==='满足以上所有条件');all?.click();
   const links=Array.from(document.querySelectorAll('a')).filter(a=>text(a)==='查询');
   if(links.length!==1)return {error:'无法唯一识别原站查询按钮'};
   const token=startReadProbe();
   links[0].click();return {queryRequested:true,token};
 }
 if(command.type==='pageSize'){
   if(Array.from(document.querySelectorAll('.mini-mask-loading,.mini-grid-loading')).some(e=>e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden'))return {waiting:true};

   if(!location.pathname.endsWith('/queryResult.htm'))return null;
   const el=document.querySelector('.mini-pager-size .mini-combobox'),widget=el&&window.mini?.get?.(el.id);
   if(!widget?.getData||!widget.showPopup)return {pageSizeUnchanged:true};
   widget.showPopup();const items=Array.from(document.querySelectorAll('.mini-listbox-item')).filter(e=>e.getBoundingClientRect().height>0&&/^\d+$/.test(text(e))&&Number(text(e))<=100);
   items.sort((a,b)=>Number(text(b))-Number(text(a)));if(!items.length)return {error:'未识别每页条数选项'};
   const requestedSize=Number(text(items[0]));
   const currentSize=Number((text(document.body).match(/每页\s*(\d+)\s*条/)||[])[1]);
   if(currentSize===requestedSize){widget.hidePopup?.();return {pageSizeUnchanged:true,requestedSize};}
   const token=startReadProbe();
   items[0].dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));items[0].dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));items[0].click();return {pageSizeSelected:true,requestedSize,token};
 }
  if(command.type==='flowTab'){
    {const r=document.querySelector('tr[id^="line_"],tr.mini-grid-row');if(r&&r.offsetHeight===0)return null;}
    const name=command.flowTab;
    const pick=n=>{
      const c=Array.from(document.querySelectorAll('.mini-tab,a,li,button,span')).filter(el=>String(el.textContent||'').trim()===n&&el.getBoundingClientRect().height>0);
      const inner=c.filter(el=>!c.some(o=>o!==el&&el.contains(o)));
      return inner.length===1?inner[0]:null;
    };
    const styleOf=el=>{const s=getComputedStyle(el);return [s.color,s.fontWeight,s.borderBottomWidth,s.borderBottomColor,s.backgroundColor].join('|');};
    const names=['待办','已办','抄送给我'];
    const els=names.map(pick),styles=els.map(el=>el?styleOf(el):'');
    let active='';
    for(let i=0;i<3;i++){
      if(!styles[i])continue;
      const others=[0,1,2].filter(j=>j!==i);
      if(styles[others[0]]&&styles[others[0]]===styles[others[1]]&&styles[i]!==styles[others[0]]){active=names[i];break;}
    }
    // force：编排层已按“哪张列表页在显示”确认还没切过去，此时不再相信样式判断，照常点一次
    if(active===name&&!command.force)return {flowSelected:true,already:true,active};
    const el=els[names.indexOf(name)];
    if(!el)return {waiting:true,candidates:0,active};
    el.click();return {waiting:true,clicked:true,active,from:active};
  }
 if(command.type==='navigate'){
   if(window!==top)return null;
   const label=command.kind==='query'?'快件查询':command.kind==='service'?'京工飞鸿两校快件系统':command.kind==='form'?'物流状态调整单':'【流程】';
   const norm=s=>String(s||'').replace(/\s+/g,'');
 const tab=Array.from(document.querySelectorAll('.mini-tab')).find(t=>{const v=norm(text(t));return v===norm(label)||(command.kind==='service'&&/^京工飞鸿两校(?:区)?快件系统$/.test(v));});
   if(!tab&&command.kind==='form')return {waiting:true};
   if(!tab)return {error:'原站尚未打开“'+label+'”标签，请先在原站打开它。'};
   if(command.force||!tab.classList.contains('mini-tab-active'))tab.click();return {navigated:true};
 }
 if(command.type==='formActive'){
  if(window!==top||!location.pathname.endsWith('/mixportal/framework.htm'))return null;
  const norm=s=>String(s||'').replace(/\s+/g,'');
  const tabs=Array.from(document.querySelectorAll('.mini-tab'));
  const act=tabs.find(t=>t.classList.contains('mini-tab-active'));
  const actText=act?norm(text(act)):'';
  const forms=tabs.filter(t=>norm(text(t)).includes('物流状态调整单'));
  return {formActive:!!act&&actText.includes('物流状态调整单'),active:actText,forms:forms.length};
 }
 if(['armSubmission','submissionComplete'].includes(command.type)){
   if(window!==top||!location.pathname.endsWith('/mixportal/framework.htm'))return null;
   const tabs=Array.from(document.querySelectorAll('.mini-tab'));
   const forms=tabs.filter(t=>text(t)==='物流状态调整单');
   const service=tabs.find(t=>/^京工飞鸿两校(?:区)?快件系统$/.test(text(t)));
   if(command.type==='armSubmission'){
     if(forms.length!==1||!forms[0].classList.contains('mini-tab-active')||!service)return {error:'未唯一识别门户内活动调整单，未提交。'};
     window.__feihongSubmission={id:command.order.id,target:command.target,tab:forms[0]};return {armed:true};
   }
   const pending=window.__feihongSubmission;
   if(!pending||pending.id!==command.order.id||pending.target!==command.target)return {error:'提交完成跟踪已失效，提交结果不明，勿重复提交。'};
    const dirty=fhDirtyAlert();
    if(dirty){delete window.__feihongSubmission;fhDismiss(dirty.box);return {error:'原站拒绝提交：'+dirty.text.replace(/^提示/,'').replace(/确定$/,'').trim().slice(0,120)+'；已点确定关闭提示，本单未提交，继续下一单。'};}
    const alerts=Array.from(document.querySelectorAll('[id$="$content"]')).filter(el=>el.getBoundingClientRect().height>0&&/提交失败|保存失败|操作失败|系统错误|发生异常|不能提交/.test(text(el)));
    if(alerts.length){delete window.__feihongSubmission;return {error:'原站返回失败提示：'+text(alerts[0]).slice(0,60)};}
   // 门户提交完成后一般会关闭调整单标签；不再要求业务系统标签必须重新激活，
   // 否则门户激活了别的标签就会白等60秒。是否真的成功仍以按单号回读为准。
   if(!pending.tab.isConnected&&!forms.length){
     // 本单必须点过「确定」（confirmSubmit 记在门户顶层）；没点过就消失，说明不是提交成功关的标签
     let pressed=true;if(command.token){try{const p=window.__fhPressed||window.__fhPressLog;pressed=!!p&&p.token===command.token;}catch{pressed=false;}}
     if(!pressed)return {waiting:true,tabGoneNoPress:true};
     const serviceActive=!!service&&service.classList.contains('mini-tab-active');
     delete window.__feihongSubmission;return {submissionComplete:true,serviceActive};
   }
    return {waiting:true};
 }
  if(['portalState','closeFormTab'].includes(command.type)){
    if(window!==top)return null;
    const tabs=Array.from(document.querySelectorAll('.mini-tab'));
    const forms=tabs.filter(t=>text(t)==='物流状态调整单');
    if(command.type==='closeFormTab'){
      if(!forms.length)return {closed:0};
      const tab=forms[forms.length-1];
      const close=tab.querySelector?.('.mini-tab-close,[class*="tab-close"],a[title="关闭"]');
      if(!close)return {error:'门户未提供关闭调整单标签的入口，请手动关闭遗留的“物流状态调整单”标签后重试。'};
      close.click();return {closed:1,remaining:forms.length-1};
    }
    const service=tabs.find(t=>/^京工飞鸿两校(?:区)?快件系统$/.test(text(t)));
    const frames=[];let count=0;try{count=window.frames.length;}catch{}
    for(let i=0;i<count;i++){try{frames.push(window.frames[i].location.pathname);}catch{frames.push('跨域');}}
    return {tabs:tabs.map(t=>text(t)),forms:forms.length,formActive:forms.some(t=>t.classList.contains('mini-tab-active')),service:!!service,serviceActive:!!service&&service.classList.contains('mini-tab-active'),frames};
  }
  if(command.type==='frameReport'){
    const body=document.body?text(document.body):'';
    const formPath=location.pathname.endsWith('/3c9e2b168f194a628014fa4dd672971e.htm'),coop=location.pathname.endsWith('/openCooperative.htm');
    return {path:location.pathname,ready:document.readyState,dh:!!document.getElementById('DH$text'),miniDH:!!window.mini?.get?.('DH'),radios:document.querySelectorAll('input[type="radio"]').length,formPath,coop,snippet:(formPath||coop)?body.slice(0,80):''};
  }
  if(command.type==='readForm'){
    if(!location.pathname.endsWith('/3c9e2b168f194a628014fa4dd672971e.htm'))return null;
    const ids=['DH','JJRGH','JJRXM','JJRDH','JJDZXQ','JJDZYL','JJDZFJH','SJRXM','SJRDH','SJXQDZ','SJDZYL','SJDZFJH'];
    const fields=Object.fromEntries(ids.map(id=>[id,value(id)]));
    const groups=[],keys=[];
    for(const radio of document.querySelectorAll('input[type="radio"]')){const key=radio.id.split('$ck$')[0];let x=keys.indexOf(key);if(x<0){x=keys.length;keys.push(key);groups.push([]);}groups[x].push(radio);}
    const current=groups.length?groups[0].find(r=>r.checked)?.value||'':'';
    return {dh:value('DH'),fields,current};
  }
  if(command.type==='submissionStatus'){
    if(window!==top)return null;
    const tabs=Array.from(document.querySelectorAll('.mini-tab'));
    const forms=tabs.filter(t=>text(t)==='物流状态调整单');
    const service=tabs.find(t=>/^京工飞鸿两校(?:区)?快件系统$/.test(text(t)));
    const confirmOpen=Array.from(document.querySelectorAll('.mini-messagebox,[id$="$content"]')).some(el=>el.getBoundingClientRect().height>0&&text(el).includes('您确定要提交吗？'));
    return {forms:forms.length,formActive:forms.some(t=>t.classList.contains('mini-tab-active')),serviceActive:!!service&&service.classList.contains('mini-tab-active'),confirmOpen};
  }
  if(command.type==='notices'){
    const boxes=Array.from(document.querySelectorAll('div,section,aside,li')).filter(el=>{
      const t=text(el);
      return t.includes('消息提醒')&&t.includes('发送时间')&&el.getBoundingClientRect().height>0;
    });
    const inner=boxes.filter(el=>!boxes.some(o=>o!==el&&el.contains(o)));
    const notices=inner.map(el=>{
      const t=text(el).replace(/\s+/g,' ').trim();
      const timeMatch=t.match(/发送时间[:：]?\s*([0-9]{1,2}月[0-9]{1,2}日\s*[0-9]{1,2}:[0-9]{2}|[0-9\-\/ :]{6,20})/);
      const body=t.replace(/^消息提醒/,'').replace(/发送时间[:：]?.*$/,'').replace(/查看详情|详情/g,'').replace(/s+/g,' ').trim();
      const idMatch=body.match(/JGKD\d+/);
      return {body,time:timeMatch?timeMatch[1].trim():'',id:idMatch?idMatch[0]:''};
    }).filter(n=>n.body);
    return {notices};
  }
  if(command.type==='openDetail'){
    const p=location.pathname;
    if(!/List\.htm$/i.test(p))return null;
    const id=String(command.id||'');
    const norm=s=>String(s||'').replace(/\s+/g,'');
    const rows=Array.from(document.querySelectorAll('tr[id^="line_"],tr.mini-grid-row'));
    let hit=rows.find(r=>norm(text(r)).includes(id))||null;
    if(!hit&&id.length>=6){
      const tail=id.slice(-6);
      const cands=rows.filter(r=>norm(text(r)).includes(tail));
      if(cands.length===1)hit=cands[0];
      else if(cands.length>1)return {error:'按单号后 6 位匹配到 '+cands.length+' 行，无法唯一确定 '+id+'，已停止（避免打开错单）。'};
    }
    if(!hit)return {waiting:true,candidates:rows.length};
    const link=Array.from(hit.querySelectorAll('a')).find(a=>text(a).includes('寄件申请信息单'))||hit.querySelector('a');
    if(!link)return {error:'该行没有可点击的“寄件申请信息单”链接。'};
    link.click();return {detailRequested:true};
  }
  if(command.type==='detailPrint'){
    if(!/寄件申请信息单/.test(text(document.body)))return null;
    const all=Array.from(document.querySelectorAll('i,a,button,span,img,div'));
    let cands=all.filter(el=>{
      const outer=String(el.outerHTML||'').toLowerCase();
      const label=(el.getAttribute&&el.getAttribute('title')||'')+String(el.className||'')+outer;
      return /打印|print|dayin/.test(label)&&el.getBoundingClientRect().height>0;
    });
    cands=cands.filter(el=>!cands.some(o=>o!==el&&el.contains(o)));
    if(!cands.length)return {waiting:true,candidates:0,sample:(document.body.innerText||'').slice(0,0)||'none'};
    // 优先选屏幕上方、靠右的（工具栏区域）
    cands.sort((a,b)=>{const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();return (ra.top-rb.top)||(rb.left-ra.left);});
    cands[0].click();return {printRequested:true,candidates:cands.length};
  }
  if(command.type==='printConfirm'){
    const vis=el=>{const r=el.getBoundingClientRect();return r.height>0&&r.width>0;};
    const ok=[...document.querySelectorAll('button,a,span,div')]
      .filter(el=>/确\s*定/.test(text(el))&&!/取\s*消/.test(text(el))&&vis(el));
    const inner=ok.filter(el=>!ok.some(o=>o!==el&&el.contains(o)));
    if(!inner.length)return {waiting:true,step:'no-button'};
    const inModal=inner.filter(el=>{
      let p=el;
      for(let i=0;i<8&&p;i++,p=p.parentElement){if(/选择打印内容/.test(text(p)||''))return true;}
      return false;
    });
    if(!inModal.length)return {waiting:true,step:'no-modal'};
    const pick=inModal[0];
    pick.click();
    return {confirmed:true,total:inner.length,inModal:inModal.length};
  }
  if(command.type==='detailFrame'){
    if(!/寄件申请信息单/.test(text(document.body)))return null;
    if(command.print){try{window.print();}catch{return {detailFrame:true,print:false};}return {detailFrame:true,print:true};}
    return {detailFrame:true};
  }
  if(command.type==='submitBare'){
    if(!location.pathname.endsWith('/3c9e2b168f194a628014fa4dd672971e.htm'))return null;
    if(!document.getElementById('DH$text')||!window.mini?.get?.('DH'))return {waiting:true};
    const id=command.order?.id;
    if(!/^JGKD\d+$/.test(id||''))return {error:'无效单号，未提交。'};
    const statusList=['订单申请','已揽件','发出/派送中','已送达','已签收'];
    const groups=[],keys=[];
    for(const radio of document.querySelectorAll('input[type="radio"]')){const key=radio.id.split('$ck$')[0];let x=keys.indexOf(key);if(x<0){x=keys.length;keys.push(key);groups.push([]);}groups[x].push(radio);}
    if(groups.length!==2||groups.some(g=>g.length!==5||g.some((r,i)=>r.value!==statusList[i])))return {error:'状态选项结构与已核对版本不一致，未提交。'};
    if(value('DH')!==id)return {waiting:true};
    const current=groups[0].find(r=>r.checked)?.value;
    if(!current)return {waiting:true};
    // 联系人都没联动时，“当前状态”只是表单默认勾选，不能据此提交。
    if(!value('JJRXM')&&!value('SJRXM'))return {waiting:true,mismatch:['寄件人/收件人均未联动']};
    if(command.expect&&current!==command.expect)return {error:'原站当前状态是「'+current+'」，不是预期的「'+command.expect+'」，未提交。'};
    if(!statusList.includes(command.target)||command.target===current)return {error:'目标状态无效或与当前状态相同（当前 '+current+'）。'};
    const radio=groups[1].find(r=>r.value===command.target);
    if(!fhPickRadio(radio))return {error:'原站未选中目标状态，未提交。'};
    let send;try{send=window.parent.document.getElementById('sendBtn');}catch{}
    if(!send||text(send)!=='提交')return {error:'未识别原站提交入口，未提交。'};
    try{const r=send.getBoundingClientRect();window.parent.__fhSendInfo={id:send.id,cls:String(send.className||'').slice(0,40),t:text(send).slice(0,6),size:Math.round(r.width)+'x'+Math.round(r.height),oc:String(send.getAttribute('onclick')||'').slice(0,60),href:String(send.getAttribute('href')||'').slice(0,40),dis:!!send.disabled};}catch{}
    const intentPayload={id,target:command.target,at:Date.now()};
    try{window.__feihongSubmitIntent=intentPayload;}catch{}
    try{window.parent.__feihongSubmitIntent=intentPayload;}catch{}
    try{window.top.__feihongSubmitIntent=intentPayload;}catch{}
    try{sessionStorage.setItem('feihongSubmitIntent',JSON.stringify(intentPayload));}catch{}
    send.click();return {submitted:true,current};
  }
  if(command.type==='clearTags'){
    if(!location.pathname.endsWith('/queryResult.htm')||new URL(location.href).searchParams.get('queryCode')!=='8y4xbat8bd5dygdtw7ncbwcayenmnckt')return null;
    const actives=Array.from(document.querySelectorAll('#quick-tag-box .active,#quick-tag-box [class*="selected"],.query-tag-box'));
    if(!actives.length)return {active:0};
    const tag=actives[0];
    const close=tag.querySelector('[class*="close"],[class*="del"],a[title="删除"],a[title="关闭"]');
    if(!close)return {error:'门户快捷标签没有可自动点击的关闭控件，请先手动点掉「'+text(tag).slice(0,20)+'」再回查。'};
    close.click();return {active:actives.length-1};
  }
  if(command.type==='openForm'){
    if(!location.pathname.endsWith('/h8jpsdrafk3yxn3mdxt3dbgkekzxxiwt.htm'))return null;
    // 入口优先取唯一那个；MiniUI 面板延迟显示时也接受唯一的隐藏入口。
    const all=Array.from(document.querySelectorAll('li.bl-item[data-flowid="8a8082dd82875b1201828ba961ca0f27"][data-blname="物流状态调整单"]'));
    if(all.length>1)return {error:'发现多个物流状态调整办理入口，停止操作。'};
    if(!all.length){
      const others=Array.from(document.querySelectorAll('li.bl-item[data-blname]'));
      if(others.length)return {error:'门户的「物流状态调整单」入口标识已变化（页面上有 '+others.length+' 个办理入口，但都不匹配已知标识），疑似门户改版，请联系维护者。'};
      return {waiting:true,missing:'entry'};
    }
    all[0].click();return {openRequested:true};
  }
  const fhVis=e=>{try{return e.getBoundingClientRect().height>0}catch{return false}};
  const fhName=e=>{try{const cls=String(e.className||'').trim().split(/\s+/).filter(Boolean).slice(0,2).join('.');return String(e.tagName||'?').toLowerCase()+(e.id?'#'+e.id:'')+(cls?'.'+cls:'')}catch{return '?'}};
  const fhCover=e=>{
   try{
    const r=e.getBoundingClientRect();
    if(!r.width||!r.height)return '按钮尺寸为 0';
    const hit=document.elementFromPoint(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2));
    if(!hit)return '按钮中心点无元素';
    if(hit===e||e.contains(hit)||hit.contains(e))return '中心点未被遮挡';
    return '中心点被 '+fhName(hit)+' 覆盖(z='+getComputedStyle(hit).zIndex+')';
   }catch{return '遮挡检测失败'}
  };
  const fhErrs=()=>{try{const l=window.__fhErr||[];if(!l.length)return '';const e=l[l.length-1]||{};return String(e.m||'').slice(0,60)+(e.s?'@'+e.s:'')}catch{return ''}};
  const fhReqs=()=>{
   try{
    if(typeof window.__fhClickBase!=='number')return '';
    const all=performance.getEntriesByType('resource')||[];
    return all.slice(window.__fhClickBase).slice(-2).map(e=>String(e.name||'').split('?')[0].split('/').pop()+'('+Math.round(e.duration||0)+'ms)').join('、');
   }catch{return ''}
  };
  const fhOff=e=>{try{return !!(e.disabled||(e.getAttribute&&e.getAttribute('aria-disabled')==='true')||/disabled/i.test(String(e.className||'')))}catch{return false}};
  const fhOkBtn=box=>Array.from(box.querySelectorAll('button,a,span')).find(e=>/确\s*定/.test(text(e))&&!/取\s*消/.test(text(e))&&fhVis(e));
  const fhDismiss=box=>{try{const b=fhOkBtn(box);if(!b)return false;for(const type of ['mousedown','mouseup','click'])b.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window,button:0,buttons:type==='mousedown'?1:0}));return true;}catch{return false}};
  const fhOnclick=e=>{try{let p=e;for(let i=0;i<5&&p;i++,p=p.parentElement){const a=p.getAttribute&&p.getAttribute('onclick');if(a)return 'onclick='+String(a).replace(/\s+/g,' ').slice(0,60);}return '无 onclick'}catch{return 'onclick 未知'}};
  const fhDiag=(btn,justClicked)=>{
   const bits=[];
   if(btn)bits.push('已按下'+'「'+text(btn).slice(0,4)+'」'+fhName(btn)+'：'+fhCover(btn)+'，'+fhOnclick(btn)+'，'+(typeof btn.onclick==='function'?'已绑定事件':'无事件绑定'));
   const err=fhErrs();if(err)bits.push('页面报错 '+err);
   if(typeof window.__fhClickBase==='number'){const q=fhReqs();bits.push(q?'点击后新请求 '+q:'点击后无新请求');}
   try{const si=window.__fhSendInfo;if(si)bits.push('提交入口 '+(si.id||'无id')+'.'+si.cls+' '+(si.size||'?')+' onclick='+(si.oc||'无')+' href='+(si.href||'无')+(si.dis?' 已禁用':''));}catch{}
   return bits.join('｜');
  };
  // fresh=true：跳过“点提交前就已经在页面上”的提示（toastMark 打的旧标记）；旧提示消失后标记作废，同一元素再次出现算新提示
  const fhToast=(re,fresh)=>{try{
   const cands=Array.from(document.querySelectorAll('div,span,p,td'));
   for(const el of cands){
    const t=text(el);
    if(!t||t.length>500)continue;
    if(!re.test(t))continue;
    const r=el.getBoundingClientRect(),shown=r.height>0&&r.width>0;
    if(fresh&&el.__fhStale){if(!shown)delete el.__fhStale;continue;}
    if(shown)return t;
   }
   return '';
  }catch{return ''}};
  // 本单是否真的点过「确定」（记在门户顶层，弹窗与成功提示可能不在同一帧）
  const fhTop=(()=>{try{return window.top&&window.top.document?window.top:window;}catch{return window;}})();
  const fhPressed=token=>{try{return !!fhTop.__fhPressed&&fhTop.__fhPressed.token===token;}catch{return false;}};
  // 点「提交」前：把各帧里此刻看得见的“提交成功”标为旧的
  if(command.type==='toastMark'){
   let n=0;
   try{for(const el of Array.from(document.querySelectorAll('div,span,p,td'))){const t=text(el);if(!t||t.length>500||!/^提交成功$/.test(t))continue;const r=el.getBoundingClientRect();if(r.height>0&&r.width>0){el.__fhStale=1;n++;}}}catch{}
   try{if(fhTop.__fhPressed)delete fhTop.__fhPressed;}catch{}
   return {toastMarked:true,visible:n};
  }
  // —— v0.9.215：打开原站标准页面用的原站动作（只在用户点“打开原站标准页面”时调用）——
  const fhTabs=()=>Array.from(document.querySelectorAll('.mini-tab')).map(t=>{
   const close=t.querySelector&&t.querySelector('.mini-tab-close,[class*="tab-close"],a[title="关闭"]');
   return {text:text(t),active:t.classList.contains('mini-tab-active'),closable:!!close};
  });
  const fhNorm=s=>String(s||'').replace(/\s+/g,'');
  const fhSoftClick=el=>{if(!el)return false;try{el.scrollIntoView&&el.scrollIntoView({block:'center'});}catch{}for(const type of ['mousedown','mouseup','click']){try{el.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window,button:0,buttons:type==='mousedown'?1:0}));}catch{try{el.click();}catch{}}}return true;};
  const fhInner=els=>els.filter(el=>!els.some(o=>o!==el&&el.contains(o)));
  if(command.type==='tabs'){
   if(window!==top)return null;
   return {tabs:fhTabs()};
  }
  if(command.type==='tabClick'){
   if(window!==top)return null;
   const want=fhNorm(command.text),tabs=Array.from(document.querySelectorAll('.mini-tab'));
   const tab=tabs.find(t=>fhNorm(text(t))===want)||tabs.find(t=>fhNorm(text(t)).includes(want));
   if(!tab)return {error:'原站没有“'+command.text+'”标签（当前：'+(fhTabs().map(t=>t.text).join('、')||'无')+'）。'};
   if(!tab.classList.contains('mini-tab-active'))tab.click();
   return {clicked:true,text:text(tab)};
  }
  if(command.type==='tabClose'){
   if(window!==top)return null;
   const want=fhNorm(command.text),tab=Array.from(document.querySelectorAll('.mini-tab')).find(t=>fhNorm(text(t))===want);
   if(!tab)return {closed:0,missing:true};
   const close=tab.querySelector('.mini-tab-close,[class*="tab-close"],a[title="关闭"]');
   if(!close)return {error:'门户“'+command.text+'”标签没有可点的关闭按钮，请手动关闭它。'};
   close.click();return {closed:1};
  }
  if(command.type==='tabCloseAll'){
   if(window!==top)return null;
   const keep=fhNorm(command.keep);
   let closed=0;
   for(const tab of Array.from(document.querySelectorAll('.mini-tab'))){
    if(fhNorm(text(tab)).includes(keep))continue;
    const close=tab.querySelector('.mini-tab-close,[class*="tab-close"],a[title="关闭"]');
    if(!close)continue;
    close.click();closed++;
    if(closed>=6)break;
   }
   return {closed,remaining:fhTabs().map(t=>t.text)};
  }
  // 工作台：点“我的待办”里“寄件申请信息单”那一行的“待办”数字，门户会打开【流程】
  if(command.type==='workbenchOpenFlow'){
   if(window===top)return null;
   const page=text(document.body);
   if(!page.includes('我的待办'))return null;
   const rows=Array.from(document.querySelectorAll('div,li,tr,section')).filter(el=>{
    if(!fhVis(el))return false;
    const t=text(el);
    return t.includes('寄件申请信息单')&&t.includes('待办')&&t.length<=160;
   });
   if(!rows.length)return {error:'工作台有“我的待办”，但没有找到“寄件申请信息单”那一行（页面可能还没加载完）。'};
   const row=rows.reduce((a,b)=>(a.contains&&a.contains(b))?b:a);
   const label=Array.from(row.querySelectorAll('*')).find(el=>text(el)==='待办'&&fhVis(el));
   if(!label)return {error:'“寄件申请信息单”这一行里没有“待办”字样。'};
   let scope=label.parentElement,box=null;
   for(let i=0;i<4&&scope;i++){
    const nums=Array.from(scope.querySelectorAll('*')).filter(el=>el!==scope&&/^\d{1,4}$/.test(text(el))&&fhVis(el));
    if(nums.length){box=nums[0];break;}
    scope=scope.parentElement;
   }
   const target=box?((box.closest&&box.closest('a'))||box):label;
   fhSoftClick(target);
   return {clicked:true,sample:text(row).replace(/\s+/g,' ').slice(0,100)};
  }
  // 工作台“我的服务”：点“京工飞鸿两…”卡片，打开京工飞鸿两校快件系统
  if(command.type==='workbenchOpenService'){
   if(window===top)return null;
   const page=text(document.body);
   if(!page.includes('我的服务'))return null;
   const cands=Array.from(document.querySelectorAll('a,button,div,li,span')).filter(el=>{
    if(!fhVis(el))return false;
    const t=text(el);
    return /京工飞鸿/.test(t)&&t.length<=40;
   });
   if(!cands.length)return {error:'工作台“我的服务”里没有找到“京工飞鸿两…”（请确认工作台已加载完）。'};
   const withKj=cands.filter(el=>/京工飞鸿两.{0,6}快件/.test(text(el)));
   const el=fhInner(withKj.length?withKj:cands)[0]||cands[0];
   const target=(el.closest&&el.closest('a,[onclick]'))||el;
   fhSoftClick(target);
   return {clicked:true,sample:text(el).slice(0,60)};
  }
  // 工作台页面下滑：点“业务管理中心 »”
  if(command.type==='workbenchOpenBusinessCenter'){
   if(window===top)return null;
   const page=text(document.body);
   if(!page.includes('业务管理中心')||!page.includes('我的服务'))return null;
   const cands=Array.from(document.querySelectorAll('a,button,div,span,li')).filter(el=>{
    if(!fhVis(el))return false;
    const t=fhNorm(text(el));
    return t.includes('业务管理中心')&&t.length<=24;
   });
   if(!cands.length)return {error:'工作台页面里没有找到“业务管理中心”入口（请确认工作台已加载完）。'};
   const pick=cands.find(el=>/»|》|>/.test(text(el)))||cands.find(el=>el.tagName==='A')||cands[cands.length-1];
   const target=(pick.closest&&pick.closest('a,[onclick]'))||pick;
   fhSoftClick(target);
   return {clicked:true,sample:text(pick).slice(0,40)};
  }
  // 业务管理中心：点“京工飞鸿两校快件”业务包卡片
  if(command.type==='centerOpenPackage'){
   if(window===top)return null;
   const page=text(document.body);
   if(!page.includes('业务包名称'))return null;
   const cands=Array.from(document.querySelectorAll('a,div,li,section,article,span')).filter(el=>{
    if(!fhVis(el))return false;
    const t=fhNorm(text(el));
    return t.includes('京工飞鸿两校快件')&&t.length<=120;
   });
   if(!cands.length)return {error:'业务管理中心里没有找到“京工飞鸿两校快件”业务包（请确认页面已加载完）。'};
   const el=fhInner(cands)[0]||cands[0];
   const target=(el.closest&&el.closest('a,[onclick]'))||el;
   fhSoftClick(target);
   return {clicked:true,sample:text(el).replace(/\s+/g,' ').slice(0,80)};
  }
  // 业务包页面：点“快件查询”卡片，打开快件查询标签
  if(command.type==='packageOpenQuery'){
   if(window===top)return null;
   const page=text(document.body);
   if(!page.includes('大厅服务')||!page.includes('快件查询'))return null;
   const cands=Array.from(document.querySelectorAll('a,button,div,li,span')).filter(el=>{
    if(!fhVis(el))return false;
    return fhNorm(text(el))==='快件查询';
   });
   if(!cands.length)return {error:'业务包页面里没有找到“快件查询”入口（请确认页面已加载完）。'};
   const el=fhInner(cands)[0]||cands[0];
   const target=(el.closest&&el.closest('a,[onclick]'))||el;
   fhSoftClick(target);
   return {clicked:true};
  }
  if(command.type==='pressInfo'){
   if(window!==top)return null;
   const L=window.__fhPressLog;if(!L||L.token!==command.token)return {pressInfo:true,count:0};
   return {pressInfo:true,count:L.times.length,gaps:L.times.slice(1).map((t,i)=>Math.round((t-L.times[i])/100)/10),buf:L.buf||0,mini:!!L.mini};
  }
  // 原站是否正在“加载中”（点确定后保存期间整页蒙灰并显示“加载中…”；现场截图 0.9.177）
  if(command.type==='portalBusy'){
   let busy=false;
   try{
    busy=Array.from(document.querySelectorAll('.mini-mask-loading')).some(fhVis)||
     Array.from(document.querySelectorAll('div,span')).some(el=>{const t=text(el);return /^加载中/.test(t)&&t.length<=8&&fhVis(el);});
   }catch{}
   return {busy,path:location.pathname};
  }
  const fhDialogs=()=>Array.from(document.querySelectorAll('.mini-messagebox,.mini-window,.mini-panel')).filter(b=>fhVis(b)&&/您确定要提交吗/.test(text(b)));
  if(command.type==='confirmSubmit'){
   const dirtyAlert=fhDirtyAlert();
   if(dirtyAlert){
     let retry=window.__fhDirtyRetry;
     if(!retry||retry.token!==command.token)retry=window.__fhDirtyRetry={token:command.token,count:0};
     const text=dirtyAlert.text.replace(/^提示/,'').replace(/确定$/,'').trim().slice(0,90);
     fhDismiss(dirtyAlert.box);
     if(retry.count>=1)return {error:'原站提示「'+text+'」；已重新提交一次仍被拦截，本单未提交，继续下一单。'};
     retry.count++;
     let send=null;
     try{send=document.getElementById('sendBtn')||(window.parent&&window.parent.document&&window.parent.document.getElementById('sendBtn'));}catch{}
     if(!send)return {error:'原站提示「'+text+'」；已关闭提示，但没找到右上角“提交”，无法重新提交，本单未提交。'};
     try{send.click();}catch{}
     return {waiting:true,seen:true,dirtyRetry:retry.count,diag:'原站提示数据不完整 → 已点确定并重新提交（第 '+retry.count+' 次）'};
   }
   // 成功只认：本单点过「确定」之后新出现的“提交成功”（现场 0.9.176：页面上残留/别处的“提交成功”曾让没点确定的单被记成已改好）
   const okText=fhPressed(command.token)&&fhToast(/^提交成功$/,true);
   if(okText){delete window.__fhConfirmSeen;window.__fhPressState=null;try{delete fhTop.__fhPressed;}catch{}return {confirmed:true,via:'toast',resubmitted:!!(window.__fhDirtyRetry&&window.__fhDirtyRetry.count>0)};}
   const badText=fhToast(/提交失败|保存失败|操作失败/,true);
   if(badText)return {error:'原站提示「'+badText+'」，本次未改成功。'};
   const hit=fhDialogs();
   if(!hit.length){
    // 确认框消失本身不算成功：继续等“提交成功”提示或调整单标签自动关闭
    const seen=window.__fhConfirmSeen;
    if(seen&&seen.token===command.token&&Date.now()-seen.at<120000)return {waiting:true,seen:true,closedNoToast:true,pressed:fhPressed(command.token)};
    return null;
   }
   window.__fhConfirmSeen={token:command.token,at:Date.now()};
   const box=hit[0],btn=fhOkBtn(box);
 // v0.9.204：只要弹的是“提示信息”而不是「您确定要提交吗」，一律点确定关掉
 if(btn&&!/您确定要提交吗|确定要提交/.test(text(box))){
   fhDismiss(box);
   return {waiting:true,seen:true,genericDismissed:true,diag:'已点「确定」关闭提示：'+text(box).replace(/\s+/g,' ').slice(0,50)};
 }
   if(!btn)return {waiting:true,seen:true,buttons:hit.length,noBtn:true,diag:'弹窗里没有可见的「确定」按钮'+(hit[0]?'（'+fhName(hit[0])+'）':'')};
   if(fhOff(btn))return {waiting:true,seen:true,buttons:hit.length,off:true,diag:'「确定」按钮当前是禁用状态（'+fhName(btn)+'），等它可用后自动点'};
   let ps=window.__fhPressState;
   if(!ps||ps.token!==command.token){ps={token:command.token,tries:0,last:0,first:Date.now(),miniFired:false};window.__fhPressState=ps;delete window.__fhClickBase;}
 const canPress=ps.tries<3&&(ps.tries===0||Date.now()-ps.last>=100)&&Date.now()-ps.first<10000;
 if(canPress){
    ps.tries++;ps.last=Date.now();
    try{fhTop.__fhPressed={token:command.token,at:Date.now()};}catch{}
    try{const L=fhTop.__fhPressLog&&fhTop.__fhPressLog.token===command.token?fhTop.__fhPressLog:{token:command.token,times:[],buf:0,mini:false};L.times.push(Date.now());try{L.buf=(performance.getEntriesByType('resource')||[]).length;}catch{}fhTop.__fhPressLog=L;}catch{}
    try{delete window.__feihongSubmitIntent;}catch{}
    try{delete window.parent.__feihongSubmitIntent;}catch{}
    try{sessionStorage.removeItem('feihongSubmitIntent');}catch{}
    const target=btn.closest&&btn.closest('a,button,input')||btn;
    try{
     if(ps.tries===1){try{window.__fhClickBase=(performance.getEntriesByType('resource')||[]).length;}catch{}}
     const r=target.getBoundingClientRect();
     const at={bubbles:true,cancelable:true,view:window,button:0,detail:1,clientX:Math.round(r.left+r.width/2),clientY:Math.round(r.top+r.height/2)};
     try{target.focus&&target.focus();}catch{}
     if(ps.tries===1){try{target.click();}catch{}}
     else{
      target.dispatchEvent(new MouseEvent('mousedown',Object.assign({buttons:1},at)));
      target.dispatchEvent(new MouseEvent('mouseup',Object.assign({buttons:0},at)));
      target.dispatchEvent(new MouseEvent('click',Object.assign({buttons:0},at)));
     }
     // MiniUI 连续复用同一办理页后，DOM 按键序列偶尔不再进入组件处理器。
     // 第三次仍无请求且弹窗未关闭时，直接走该按钮组件的 click 事件一次。
 if(ps.tries===3&&!ps.miniFired&&fhDialogs().length){
      const component=window.mini?.get?.(target.id||btn.id);
      if(component&&typeof component.fire==='function'){
       ps.miniFired=true;try{if(fhTop.__fhPressLog&&fhTop.__fhPressLog.token===command.token)fhTop.__fhPressLog.mini=true;}catch{}
       component.fire('click',{sender:component,htmlEvent:null});
      }
     }
    }catch{}
   }
   if(fhPressed(command.token)&&fhToast(/^提交成功$/,true)){delete window.__fhConfirmSeen;window.__fhPressState=null;try{delete fhTop.__fhPressed;}catch{}return {confirmed:true,via:'toast',resubmitted:!!(window.__fhDirtyRetry&&window.__fhDirtyRetry.count>0)};}
   if(!fhDialogs().length)return {waiting:true,seen:true,closedNoToast:true,pressed:fhPressed(command.token),tries:ps.tries};
 if(ps.tries>=3){
   if(Date.now()-ps.last<600)return {waiting:true,seen:true,stillOpen:true,tries:ps.tries,diag:'已点 3 次「确定」，等提示框关闭'+(ps.miniFired?'｜已调用 MiniUI 按钮事件':'')};
   return {error:'提示框连续点 3 次「确定」仍未关闭，本单放弃。'};
 }
   return {waiting:true,seen:true,buttons:hit.length,clickedButOpen:true,diag:fhDiag(btn,ps.tries>0)+'｜已按 '+ps.tries+' 次'+(ps.miniFired?'｜已调用 MiniUI 按钮事件':'')};
  }
  if(command.type==='confirmProbe'){
   const hit=fhDialogs(),box=hit[0],btn=box?fhOkBtn(box):null;
   const ps=window.__fhPressState,tries=ps&&typeof ps.tries==='number'?ps.tries:0,clicked=tries>0;
   return {dialog:hit.length,buttons:hit.length,clicked,tries,noBtn:!!box&&!btn,off:!!btn&&fhOff(btn),diag:btn&&clicked?fhDiag(btn,false):''};
  }
  if(command.type==='confirmPress'){
   const hit=fhDialogs();
   if(!hit.length)return null;
   const box=hit[0],btn=fhOkBtn(box);
   if(!btn)return {waiting:true,pressed:false};
   const key=String(command.token||'press');
   if(box.__fhPressed===key)return {waiting:true,pressed:false,again:true};
   box.__fhPressed=key;
   const log=[];
   try{
     const ev=(type,buttons)=>new MouseEvent(type,{bubbles:true,cancelable:true,view:window,button:0,buttons,detail:1});
     try{btn.focus&&btn.focus();}catch{}
     for(const pair of [['mousedown',1],['mouseup',0],['click',0]]){try{btn.dispatchEvent(ev(pair[0],pair[1]));log.push(pair[0]);}catch{}}
   }catch{}
   return {waiting:true,pressed:log.length>0,events:log.join('>'),closed:!fhDialogs().length};
  }
  if(command.type==='confirmResidue'){
   const hit=fhDialogs();
   return {residue:hit.length,diag:hit.length?fhDiag(fhOkBtn(hit[0]),false):''};
  }
  if(command.type==='confirmDismiss'){
   const hit=fhDialogs();
   let n=0;
   for(const box of hit){
    const cancel=Array.from(box.querySelectorAll('button,a,span')).find(e=>/取\s*消/.test(text(e))&&fhVis(e));
    if(cancel){try{cancel.click();n++;}catch{}continue;}
    const close=box.querySelector('[class*="close"],.mini-panel-close,.mini-window-close');
    if(close){try{close.click();n++;}catch{}}
   }
   return {dismissed:n,left:fhDialogs().length};
  }
  if(command.type==='formAlert'){
   const boxes=Array.from(document.querySelectorAll('.mini-messagebox,.mini-window,.mini-panel')).filter(fhVis);
   for(const box of boxes){
    const t=text(box);
    if(!/数据不完整|请检查后重新提交|不能为空|格式不正确/.test(t))continue;
    const msg=t.replace(/^提示/,'').replace(/确定$/,'').trim().slice(0,120);
    const btn=fhOkBtn(box);
    if(btn)try{for(const type of ['mousedown','mouseup','click'])btn.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window,button:0,buttons:type==='mousedown'?1:0}));}catch{}
    return {alert:msg,dismissed:!!btn};
   }
   return null;
  }
  if(command.type==='preflight'){
   const pathname=location.pathname;
   const res={preflight:true,path:pathname,queryCode:null,flowId:null,entry:null,formPage:null};
   try{const u=new URL(location.href);res.queryCode=u.searchParams.get('queryCode')||'';res.flowId=u.searchParams.get('flowId')||'';}catch{}
   if(pathname.endsWith('/h8jpsdrafk3yxn3mdxt3dbgkekzxxiwt.htm'))res.entry=document.querySelectorAll('li.bl-item[data-blname]').length;
   if(pathname.endsWith('/3c9e2b168f194a628014fa4dd672971e.htm'))res.formPage=!!document.getElementById('DH$text');
   return res;
  }
 if(command.type==='confirmGone'){
   const boxes=Array.from(document.querySelectorAll('.mini-messagebox,.mini-window,.mini-panel')).filter(b=>b.getBoundingClientRect().height>0&&/您确定要提交吗/.test(text(b)));
   return {gone:boxes.length===0,count:boxes.length,html:boxes[0]?String(boxes[0].outerHTML||'').replace(/\s+/g,' ').slice(0,400):''};
 }
 if(command.type==='closeQuery'){
   const vis=el=>{try{const r=el.getBoundingClientRect();return r.height>0&&r.width>0;}catch{return false}};
   // 1) 先点条件行右侧的红色错号（删掉条件行）
   const closeEl=Array.from(document.querySelectorAll('button,a,span,div')).filter(vis).filter(el=>/关闭查询/.test(text(el))&&text(el).length<=14).sort((a,b)=>a.getBoundingClientRect().width-b.getBoundingClientRect().width)[0];
   let scope=closeEl;
   for(let n=0;n<6&&scope&&scope.parentElement&&!/条件字段/.test(text(scope));n++)scope=scope.parentElement;
   if(!scope||!/条件字段/.test(text(scope)))scope=document.body;
   const shoot=el=>{for(const t of ['mousedown','mouseup','click']){try{el.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window}));}catch{try{el.click();}catch{}}}};
   let cleared=0;
   for(let round=0;round<4;round++){
     const x=Array.from(scope.querySelectorAll('*')).filter(vis).filter(el=>{const t=text(el).trim();return /^[×✕✖]$/.test(t)||(el.tagName==='IMG'&&/error|del|remove/i.test(String(el.className||'')));}).sort((a,b)=>a.getBoundingClientRect().width-b.getBoundingClientRect().width)[0];
     if(!x)break;
     shoot(x);cleared++;
   }
   // 2) 再点「关闭查询」回到列表
   if(!closeEl)return {cleared,none:true};
   shoot(closeEl);
   return {closed:true,cleared,label:text(closeEl).slice(0,20)};
 }
 if(command.type==='toastState'){
   const t=fhToast(/^提交成功$/,true);
   return {toast:!!t,text:t||''};
 }
 if(command.type==='confirmDump'){
   const flat=s=>String(s||'').replace(/\s+/g,'');
   const has=/您确定要提交吗/.test(flat(document.body&&document.body.innerText));
   const boxes=fhDialogs(),box=boxes[0],btn=box?fhOkBtn(box):null;
   const btns=[];
   for(const b of boxes){for(const el of b.querySelectorAll('a,button,span')){const t=flat(text(el));if(t&&t.length<=6)btns.push(t);}}
   const masks=Array.from(document.querySelectorAll('[class*="mask"],[class*="shade"]')).filter(fhVis).slice(0,3).map(e=>fhName(e));
   return {confirmDump:true,path:(location.pathname||'').split('/').pop(),has,boxes:boxes.length,btns:[...new Set(btns)].slice(0,10),
     diag:box?fhDiag(btn,false):'',masks,
     handler:btn&&typeof btn.onclick==='function'?String(btn.onclick).replace(/\s+/g,' ').slice(0,200):'',
     miniType:(()=>{try{const c=window.mini&&window.mini.get&&window.mini.get(box&&box.id);return c?(c.type||(c.constructor&&c.constructor.name)||''):''}catch{return ''}})(),
     html:box?String(box.outerHTML||'').replace(/\s+/g,' ').slice(0,700):'',
     btnHtml:btn?String(btn.outerHTML||'').replace(/\s+/g,' ').slice(0,200):''};
 }
 if(command.type==='rowDump'){
   const p=location.pathname;
   if(!/List\.htm$/i.test(p))return null;
   const rows=Array.from(document.querySelectorAll('tr[id^="line_"],tr.mini-grid-row'));
   const first=rows[0];
   return {rowDump:true,path:p.endsWith('toDoList.htm')?'toDoList':'other',
     count:rows.length,
     inputs:first?first.querySelectorAll('input[type=checkbox]').length:0,
     boxes:first?first.querySelectorAll('.mini-checkbox,[class*="checkbox"]').length:0,
     html:first?String(first.outerHTML||'').replace(/\s+/g,' ').slice(0,600):''};
 }
 if(command.type==='flowFrames'){
   const p=location.pathname;
   if(!/List\.htm$/i.test(p))return null;
   const headers=Array.from(document.querySelectorAll('td[id*="$headerCell"]')).map(text);
   if(!headers.includes('单号'))return null;
   let rows=[];
   for(const list of [Array.from(document.querySelectorAll('tr.mini-grid-row[id*="$row2$"]')),Array.from(document.querySelectorAll('tr[id^="line_"]')),Array.from(document.querySelectorAll('tr.mini-grid-row'))]){
     const good=list.filter(r=>r.children.length===headers.length);
     if(good.length){rows=good;break;}
   }
   const summary=text(document.body).match(/每页\s*\d+\s*条[，,]?\s*共\s*(\d+)\s*条/);
   const de=document.documentElement||{};
   return {frame:true,path:p,total:summary?Number(summary[1]):null,count:rows.length,first:rows[0]?String(text(rows[0].children[2])||''):'',size:[de.clientWidth,de.clientHeight]};
 }
  if(command.type==='flowDate'){
    const p=location.pathname;
    if(!/List\.htm$/i.test(p))return null;
    // 只在正在显示的分类页里操作：隐藏的待办/已办/抄送页也会收到这条命令
    try{if(window.frameElement){const fr=window.frameElement.getBoundingClientRect();if(!(fr.height>0))return null;}}catch{}
    const vis=el=>{try{const r=el.getBoundingClientRect();return r.height>0&&r.width>0;}catch{return false}};
    const rowIds=()=>Array.from(document.querySelectorAll('tr[id^="line_"],tr.mini-grid-row')).map(r=>r.id).join(',');
    const label=Array.from(document.querySelectorAll('td,th,label,span,div')).find(el=>/发起日期/.test(text(el))&&vis(el));
    if(!label){
      // 查询区默认是收起的：先点“展开查询”，下一次调用再填日期
      const exp=Array.from(document.querySelectorAll('a,span,div,button')).filter(vis).find(el=>/^展开查询$/.test(text(el)));
      if(exp){exp.click();return {expanded:true};}
      return {error:'流程页没有找到“发起日期”，也没有找到“展开查询”按钮。'};
    }
    const box=label.closest('tr')||label.parentElement;
    const lr=label.getBoundingClientRect();
    const usable=i=>{
      if(String(i.type||'').toLowerCase()==='hidden')return false;
      if(i.disabled||i.readOnly&&i.tagName==='INPUT'&&i.hidden)return false;
      try{const r=i.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=lr.left-6;}catch{return false;}
    };
    // 优先认 MiniUI 日期控件（发起日期右侧的两个），再退回“标签右侧的可见输入框”
    let pickers=Array.from(box.querySelectorAll('.mini-datepicker')).filter(el=>{try{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=lr.left-6;}catch{return false;}});
    let inputs=pickers.map(p=>p.querySelector('input')).filter(Boolean);
    if(inputs.length<2)inputs=Array.from(box.querySelectorAll('input')).filter(usable).sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left);
    if(inputs.length<2){const panel=label.closest('.mini-panel,.query-box,.search-box')||(box&&box.parentElement)||box;pickers=Array.from(panel.querySelectorAll('.mini-datepicker')).filter(el=>{try{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}catch{return false;}});inputs=pickers.map(p=>p.querySelector('input')).filter(Boolean);}
    if(inputs.length<2)return {error:'“发起日期”右侧没有找到两个日期框（找到 '+inputs.length+' 个可见输入）。'};
    inputs=inputs.slice(0,2);
    // 按 MiniUI 控件写值（与快件查询页的做法相同），并核对确实写进去了
    const setDate=(el,v)=>{const w=window.mini?.get?.(String(el.id||'').replace(/\$text$/,''));if(w?.setValue){w.setValue(v);}else{try{const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;d.call(el,v);}catch{el.value=v;}try{el.dispatchEvent(new Event('input',{bubbles:true}));}catch{}try{el.dispatchEvent(new Event('change',{bubbles:true}));}catch{}}return String(el.value||'')===String(v);};
    const before=rowIds();
    if(!setDate(inputs[0],command.from)||!setDate(inputs[1],command.to))return {error:'发起日期没有写进原站日期框（当前为“'+String(inputs[0].value||'')+'”至“'+String(inputs[1].value||'')+'”），未查询。'};
    const caption=el=>String(el.tagName==='INPUT'?el.value:text(el)).replace(/\s+/g,'');
    const clickables=Array.from(document.querySelectorAll('button,a,span,input[type="button"],input[type="submit"]')).filter(vis);
    const btn=clickables.find(el=>/^(查询|搜索)$/.test(caption(el)))
      ||clickables.find(el=>{const c=String(el.className||'');return /(^|[\s_-])(query|search)([\s_-]|$)/i.test(c)&&!/重置|收起|展开/.test(caption(el));})
      ||clickables.find(el=>/查询|搜索/.test(String(el.getAttribute&&el.getAttribute('title')||'')));
    if(btn){btn.click();return {queried:true,via:'button',before};}
    // 没有独立“查询”按钮的版本：改完日期发 change/回车，让门户自己触发查询
    for(const el of inputs){try{el.dispatchEvent(new Event('change',{bubbles:true}));}catch{}}
    try{inputs[1].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,which:13,bubbles:true}));}catch{}
    try{inputs[1].dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',keyCode:13,which:13,bubbles:true}));}catch{}
    return {queried:true,via:'enter',before};
  }
  if(command.type==='flowRowIds'){
    if(!/List\.htm$/i.test(location.pathname))return null;
    try{if(window.frameElement){const fr=window.frameElement.getBoundingClientRect();if(!(fr.height>0))return null;}}catch{}
    return {ids:Array.from(document.querySelectorAll('tr[id^="line_"],tr.mini-grid-row')).map(r=>r.id).join(',')};
  }
  if(command.type==='flowQueryDump'){
    if(!/List\.htm$/i.test(location.pathname))return null;
    try{if(window.frameElement){const fr=window.frameElement.getBoundingClientRect();if(!(fr.height>0))return null;}}catch{}
    const vis=el=>{try{const r=el.getBoundingClientRect();return r.height>0&&r.width>0;}catch{return false}};
    const label=Array.from(document.querySelectorAll('td,th,label,span,div')).find(el=>/发起日期/.test(text(el))&&vis(el));
    const box=label?(label.closest('tr')||label.parentElement):(Array.from(document.querySelectorAll('td,th,label,span,div')).find(el=>/展开查询|收起/.test(text(el))&&vis(el))||null);
    const cap=el=>String(el.tagName==='INPUT'?el.value:text(el)).replace(/\s+/g,' ').trim().slice(0,14);
    const els=Array.from(document.querySelectorAll('button,a,span,input[type="button"],input[type="submit"],img,i')).filter(vis).map(el=>({tag:String(el.tagName||'').toLowerCase(),cls:String(el.className||'').slice(0,28),t:cap(el)}));
    return {queryDump:true,path:String(location.pathname.split('/').pop()),html:box?String(box.outerHTML||'').replace(/\s+/g,' ').slice(0,700):'',els:els.slice(0,40)};
  }
 if(command.type==='flowSelect'){
   {const g=document.querySelector('tr[id^="line_"],tr.mini-grid-row');if(g&&g.offsetHeight===0)return null;}
   const rows=Array.from(document.querySelectorAll('tr[id^="line_"],tr.mini-grid-row'));
   if(!rows.length)return {waiting:true};
   const norm=s=>String(s||'').replace(/\s+/g,'');
   // 只认完整单号（前后不能紧挨字母数字，避免 …1 命中 …12）；同期单号前缀几乎一样，不再退化为前 9 位
   const id=String(command.id||'').trim();
   let hit=null,via='单号';
   if(id){
     const re=new RegExp('(^|[^A-Za-z0-9])'+id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![A-Za-z0-9])');
     const cands=rows.filter(r=>re.test(text(r)));
     if(cands.length>1)return {error:'按完整单号匹配到 '+cands.length+' 行，无法唯一确定 '+id+'，未勾选'};
     if(!cands.length)return {waiting:true,error:'原站当前列表没有完整单号 '+id+' 的行，未勾选',sample:rows.slice(0,2).map(r=>text(r).replace(/\s+/g,' ').slice(0,60))};
     hit=cands[0];
   }
   // 没有单号时才按寄件人+收件人找，且必须唯一；不再按行号兜底（行号来自扩展本地列表，与原站行序无关）
   if(!hit&&!id&&command.sender){
     const sn=norm(command.sender),rn=norm(command.receiver);
     const cands=rows.filter(r=>{const t=norm(text(r));return t.includes(sn)&&(!rn||t.includes(rn));});
     if(cands.length===1){hit=cands[0];via='寄件人+收件人';}
     else if(cands.length>1)return {error:'按姓名匹配到 '+cands.length+' 行，无法唯一确定'};
   }
   if(!hit)return {waiting:true,sample:rows.slice(0,2).map(r=>text(r).replace(/\s+/g,' ').slice(0,60))};
   const cell=hit.querySelector('td.mini-checkcolumn')||hit.querySelector('td');
   const mask=cell?cell.querySelector('.mini-grid-radio-mask'):null;
   const input=cell?cell.querySelector('input[type=checkbox]'):hit.querySelector('input[type=checkbox]');
   const on=()=>!!((input&&input.checked)||/mini-grid-row-selected/.test(String(hit.className||'')));
   const shoot=el=>{if(!el)return;for(const t of ['mousedown','mouseup','click']){try{el.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window}));}catch{try{el.click();}catch{}}}};
   if(!on()){shoot(mask);}
   if(!on()){shoot(cell);}
   if(!on()&&input){input.checked=true;shoot(input);}
   return {selected:on(),via,found:true,hasMask:!!mask,hasInput:!!input};
  }
 if(command.type==='flowClearSelection'){
   {const g=document.querySelector('tr[id^="line_"],tr.mini-grid-row');if(g&&g.offsetHeight===0)return null;}
   let n=0;
   for(const r of Array.from(document.querySelectorAll('tr[id^="line_"],tr.mini-grid-row'))){const cb=r.querySelector('input[type=checkbox]');if(cb&&cb.checked){cb.click();n++;}}
   return {cleared:n};
 }
 if(command.type==='flowCheckedCount'){
   {const g=document.querySelector('tr[id^="line_"],tr.mini-grid-row');if(g&&g.offsetHeight===0)return null;}
   let n=0;
   for(const r of Array.from(document.querySelectorAll('tr[id^="line_"],tr.mini-grid-row'))){
     const input=r.querySelector('input[type=checkbox]');
     const box=r.querySelector('.mini-checkbox')||r.querySelector('[class*="checkbox"]');
     if((input&&input.checked)||(box&&/checked/.test(box.className))||/mini-grid-row-selected/.test(String(r.className||'')))n++;
   }
   return {checked:n};
  }
 if(command.type==='flowToolbar'){
   {const g=document.querySelector('tr[id^="line_"],tr.mini-grid-row');if(g&&g.offsetHeight===0)return null;}
   const label=command.label;
   const els=Array.from(document.querySelectorAll('button,a,span,div')).filter(e=>text(e).trim()===label&&e.getBoundingClientRect().height>0);
   const inner=els.filter(e=>!els.some(o=>o!==e&&e.contains(o)));
   if(inner.length!==1)return {waiting:true,candidates:inner.length};
   inner[0].click();return {clicked:true};
 }
 if(command.type==='flowMenu'){
   {const g=document.querySelector('tr[id^="line_"],tr.mini-grid-row');if(g&&g.offsetHeight===0)return null;}
   const label=command.label;
   const els=Array.from(document.querySelectorAll('a,li,span,div,button')).filter(e=>text(e).trim()===label&&e.getBoundingClientRect().height>0);
   const inner=els.filter(e=>!els.some(o=>o!==e&&e.contains(o)));
   if(!inner.length)return {waiting:true};
   inner[inner.length-1].click();return {clicked:true};
 }
 // 点「通过/退回」前：把此刻看得见的弹窗/面板标为旧的，之后只点新出现的弹窗里的「确定」
 if(command.type==='dialogMark'){
   let n=0;for(const b of Array.from(document.querySelectorAll('.mini-window,.mini-messagebox,.mini-panel'))){if(b.getBoundingClientRect().height>0){b.__fhOld=1;n++;}}
   return {dialogMarked:true,count:n};
 }
 if(command.type==='flowDialogOk'){
   const boxes=Array.from(document.querySelectorAll('.mini-window,.mini-messagebox,.mini-panel')).filter(e=>e.getBoundingClientRect().height>0&&!e.__fhOld);
   for(const box of boxes){
     const btn=Array.from(box.querySelectorAll('button,a,span')).find(e=>/确\s*定/.test(text(e))&&!/取\s*消/.test(text(e))&&e.getBoundingClientRect().height>0);
     if(btn){btn.click();return {ok:true};}
   }
   return {waiting:true};
 }
 if(command.type==='flowFirstPage'){
   const p=location.pathname;
   if(!/List\.htm$/i.test(p))return null;
   {const g=document.querySelector('tr[id^="line_"],tr.mini-grid-row');if(g&&g.offsetHeight===0)return null;}
   const pager=document.querySelector('.mini-pager');
   if(!pager)return {error:'未找到分页控件。'};
   const num=pager.querySelector('.mini-pager-num');
   if(num&&String(num.value)==='1')return {atFirst:true};
   const btn=pager.querySelector('a[title="首页"]');
   if(btn&&!btn.classList.contains('mini-disabled')){btn.click();return {clicked:true};}
   if(num){
     num.value='1';
     num.dispatchEvent(new Event('change',{bubbles:true}));
     num.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,which:13,bubbles:true}));
     return {clicked:true};
   }
   return {error:'无法回到第 1 页。'};
 }
 if(command.type==='flowNext'){
   const p=location.pathname;
   if(!/List\.htm$/i.test(p))return null;
   {const g=document.querySelector('tr[id^="line_"],tr.mini-grid-row');if(g&&g.offsetHeight===0)return null;}
   const pager=document.querySelector('.mini-pager');
   if(!pager)return {error:'未找到原站分页控件。'};
   const btn=pager.querySelector('a[title="下一页"]');
   if(!btn||btn.classList.contains('mini-disabled'))return {atEnd:true};
   const rows=Array.from(document.querySelectorAll('tr[id^="line_"],tr.mini-grid-row')).map(r=>r.id).join(',');
   btn.click();
   return {clicked:true,before:rows};
 }
 // 只读：本帧是不是流程分类列表页、是哪个分类、此刻是否正在显示。
 // 现场诊断（v0.9.168）确认：待办/已办/抄送给我是三张独立页面，显示中的那张框架高度 >0，其余为 0。
 if(command.type==='flowWhere'){
   const file=location.pathname.split('/').pop();
   const tab=/^toDoList\.htm$/i.test(file)?'待办':/^haveToDoList\.htm$/i.test(file)?'已办':/^makeCopeList\.htm$/i.test(file)?'抄送给我':'';
   if(!tab)return null;
   let visible=null;try{if(window.frameElement){const r=window.frameElement.getBoundingClientRect();visible=r.height>0&&r.width>0;}}catch{}
   return {flowWhere:true,file,tab,visible};
 }
 // 诊断专用（只读）：流程列表页当前状态的完整快照，供「诊断」显示
 if(command.type==='flowProbe'){
   const p=location.pathname;
   if(!/List\.htm$/i.test(p))return null;
   const vis=e=>{try{const r=e.getBoundingClientRect();return r.height>0&&getComputedStyle(e).visibility!=='hidden';}catch{return false}};
   const headers=Array.from(document.querySelectorAll('td[id*="$headerCell"]')).map(text);
   const rows={};
   for(const [k,s] of [['$row2$','tr.mini-grid-row[id*="$row2$"]'],['line_','tr[id^="line_"]'],['grid-row','tr.mini-grid-row']]){const l=Array.from(document.querySelectorAll(s));rows[k]=l.length+' 行（列数对齐 '+l.filter(r=>r.children.length===headers.length).length+'，首行 '+(l[0]?l[0].children.length:0)+' 格'+(l[0]&&!vis(l[0])?'，不可见':'')+'）';}
   let frameH=null;try{frameH=window.frameElement?Math.round(window.frameElement.getBoundingClientRect().height):null;}catch{}
   const tabs=['待办','已办','抄送给我'].map(n=>n+'×'+Array.from(document.querySelectorAll('.mini-tab,a,li,button,span')).filter(el=>String(el.textContent||'').trim()===n&&el.getBoundingClientRect().height>0).length);
   const pager=document.querySelector('.mini-pager');
   let flowId='';try{flowId=new URL(location.href).searchParams.get('flowId')||'';}catch{}
   return {flowProbe:true,path:p,flowId,ready:document.readyState,viewH:document.documentElement?document.documentElement.clientHeight:0,frameH,
     loading:Array.from(document.querySelectorAll('.mini-mask-loading,.mini-grid-loading')).filter(vis).length,
     active:flowActiveTab(),tabs,headers,rows,pageNum:String(document.querySelector('.mini-pager-num')?.value??''),
     pager:pager?text(pager).replace(/\s+/g,' ').slice(0,80):'',summary:(text(document.body).match(/每页\s*\d+\s*条[，,]?\s*共\s*\d+\s*条/)||[''])[0]};
 }
 if(command.type==='flowDebug'){
   const p=location.pathname;
   if(!/List\.htm$/i.test(p))return null;
   const headers=Array.from(document.querySelectorAll('td[id*="$headerCell"]')).map(text);
   const tabs=['待办','已办','抄送给我'].map(n=>{
     const c=Array.from(document.querySelectorAll('a,li,span,div,button')).filter(el=>String(el.textContent||'').trim()===n&&el.getBoundingClientRect().height>0);
     const inner=c.filter(el=>!c.some(o=>o!==el&&el.contains(o)));
     const el=inner[0];
     if(!el)return n+'=无';
     const st=getComputedStyle(el);
     return n+'='+el.tagName+'['+String(el.className||'').slice(0,14)+']'+st.color+'/'+st.fontWeight+'/'+st.borderBottomWidth;
   });
   const de=document.documentElement||{};
   return {flowDebug:true,path:p,size:[de.clientWidth,de.clientHeight],iw:window.innerWidth,rows2:document.querySelectorAll('tr.mini-grid-row[id*="$row2$"]').length,rowsLine:document.querySelectorAll('tr[id^="line_"]').length,headers:headers.slice(0,3),pager:(document.querySelector('.mini-pager')?text(document.querySelector('.mini-pager')).slice(0,60):''),tabs};
 }
  if(command.type==='snapshot'){
   const path=location.pathname;
   const kind=path.endsWith('/queryResult.htm')&&new URL(location.href).searchParams.get('queryCode')==='8y4xbat8bd5dygdtw7ncbwcayenmnckt'?'query':/(ToDo|Done|Copy)List\.htm$/i.test(path)&&new URL(location.href).searchParams.get('flowId')==='8a8082dc7fdeefce017ffdbfb7ec4c15'?'flow':null;
   if(!kind||command.kind!==kind)return null;
   // why/path 只用于诊断显示，不影响判断
   if(Array.from(document.querySelectorAll('.mini-mask-loading,.mini-grid-loading')).some(e=>e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden'))return {waiting:true,why:'列表加载中',path};
   const headerCells=Array.from(document.querySelectorAll('td[id*="$headerCell"]'));
   const headers=headerCells.map(text);if(!headers.includes('单号'))return {waiting:true,why:'表头里没有“单号”（共 '+headers.length+' 列'+(headers.length?'：'+headers.slice(0,5).join('/'):'')+'）',path};
    // 原站不同网格的行结构不一致：快件页行 id 含 $row2$，流程页是 line_ 前缀。
    // 先按原来的 $row2$ 取（保证快件读取不变），取不到再按表头列数选另一套，避免读出 0 行。
    const pickRows=()=>{
      const variants=[Array.from(document.querySelectorAll('tr.mini-grid-row[id*="$row2$"]')),Array.from(document.querySelectorAll('tr[id^="line_"]')),Array.from(document.querySelectorAll('tr.mini-grid-row'))];
      for(const list of variants){const good=list.filter(r=>r.children.length===headers.length);if(good.length)return good;}
      return [];
    };
    const bodyRows=pickRows();
   if(kind==='flow'){const h=bodyRows.length?(bodyRows[0].offsetHeight===undefined?1:bodyRows[0].offsetHeight):(document.querySelector('body')?1:1);if(!(h>0))return {hiddenFrame:true,path,size:[0,0]};}
    const rows=bodyRows.map(r=>Array.from(r.children).map(text));
   if(rows.some(row=>row.length!==headers.length))return {error:'表头与数据列数不一致，停止读取，防止字段错位。'};
   const pager=Array.from(document.querySelectorAll('.mini-pager')).map(text).join(' ');
   const summary=text(document.body).match(/每页\s*\d+\s*条[，,]?\s*共\s*(\d+)\s*条/);
   const activeTags=Array.from(document.querySelectorAll('#quick-tag-box .active,#quick-tag-box [class*="selected"],.query-tag-box')).map(text).join(' ');
   // 页面名 → 分类（现场确认）：haveToDoList=已办（名字里也含 ToDo，须先判断），makeCopeList=抄送给我，toDoList=待办
   let flowTab='待办';if(kind==='flow')flowTab=/havetodo|done/i.test(path)?'已办':/cope|copy/i.test(path)?'抄送给我':'待办';
   const pathTab=kind==='flow'?(/havetodo|done/i.test(path)?'已办':/cope|copy/i.test(path)?'抄送给我':/todo/i.test(path)?'待办':''):'';
   // 分类由调用方按“点了哪个标签”命名，这里不再按路径过滤。
   const page=Number(document.querySelector('.mini-pager-num')?.value)||1;
   const pageSize=Number((text(document.body).match(/每页\s*(\d+)\s*条/)||[])[1])||null;
   const probe=window.__feihongReadProbe;
   if(probe?.error)return {error:probe.error};
   const probeSettled=probe&&(probe.loaded||(!probe.strictLoad&&(probe.nodes.some(n=>!n.isConnected)||probe.signature!==bodyRows.map(text).join('\n'))));
   const nextBtn=document.querySelector('.mini-pager a[title="下一页"]');
   const hasNext=!!nextBtn&&!nextBtn.classList.contains('mini-disabled');
   return {path,active:kind==='flow'?flowActiveTab():'',next:hasNext,kind,headers,rows,rowIds:bodyRows.map(r=>r.id),pager,page,pageSize,total:summary?Number(summary[1]):null,scope:activeTags||'沿用原站当前查询条件；当前页',flowTab,pathTab,probeToken:probe?.token,probeSettled:!!probeSettled,readAt:new Date().toISOString(),sourcePath:path};
 }
 if(command.type==='page'){
   if(Array.from(document.querySelectorAll('.mini-mask-loading,.mini-grid-loading')).some(e=>e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden'))return {waiting:true};

   const path=location.pathname,params=new URL(location.href).searchParams;
   const isQuery=path.endsWith('/queryResult.htm')&&params.get('queryCode')==='8y4xbat8bd5dygdtw7ncbwcayenmnckt';
   const isFlow=/(ToDo|Done|Copy)List\.htm$/i.test(path)&&params.get('flowId')==='8a8082dc7fdeefce017ffdbfb7ec4c15';
   if(command.kind==='flow'&&!isFlow||command.kind!=='flow'&&!isQuery)return null;
   if(command.kind==='flow'){const r=document.querySelector('tr[id^="line_"],tr.mini-grid-row');if(r&&r.offsetHeight===0)return null;}
   // 翻页只要求当前帧是流程列表，分类由调用方命名。
   const pager=document.querySelector('.mini-pager'),page=Number(pager?.querySelector('.mini-pager-num')?.value);
   const summary=text(document.body).match(/每页\s*(\d+)\s*条[，,]?\s*共\s*(\d+)\s*条/);
   if(!page||!summary)return {error:'未识别原站分页范围，请在原站翻页。'};
   const target=command.direction==='first'?1:page+(command.direction==='next'?1:-1),last=Math.ceil(Number(summary[2])/Number(summary[1]));
   if(target===page)return {pageRequested:target,unchanged:true};
   if(target<1||target>last)return {error:'已到原站查询结果的边界。'};
   const button=pager.querySelector(command.direction==='first'?'a[title="首页"]':command.direction==='next'?'a[title="下一页"]':'a[title="上一页"]');
   if(!button||button.classList.contains('mini-disabled'))return {error:'原站分页按钮不可用。'};
   const before=Array.from(document.querySelectorAll('tr.mini-grid-row[id*="$row2$"]')).map(text).join('\n');
   const token=startReadProbe();button.click();return {pageRequested:target,before,token};
 }
 if(command.type==='refresh'){
   if(!location.pathname.endsWith('/queryResult.htm'))return null;
   const refresh=document.querySelector('.mini-pager-reload');
   if(!refresh)return {error:'未识别原站刷新按钮，请手动刷新原站列表。'};
   refresh.click();return {refreshRequested:true};
 }
 if(['prepare','inspect','submit','pressEnter','pokeForm'].includes(command.type)){
   if(command.order?.duplicateOrder)return {error:'此单号在原站当前结果中重复，禁止按单号填写或提交。请先核查原站记录。'};
   if(!location.pathname.endsWith('/3c9e2b168f194a628014fa4dd672971e.htm'))return null;
   if(!document.getElementById('DH$text')||!window.mini?.get?.('DH'))return {waiting:true};
   const ids=['DH','JJRGH','JJRXM','JJRDH','JJDZXQ','JJDZYL','JJDZFJH','SJRXM','SJRDH','SJXQDZ','SJDZYL','SJDZFJH'];
   const collect=()=>Object.fromEntries(ids.map(id=>[id,value(id)]));
   // The legacy page replaces the global Map constructor in MAIN world.
   const groups=[],groupKeys=[];
   for(const radio of document.querySelectorAll('input[type="radio"]')){const key=radio.id.split('$ck$')[0];let index=groupKeys.indexOf(key);if(index<0){index=groupKeys.length;groupKeys.push(key);groups.push([]);}groups[index].push(radio);}
   if(!groups.length)return {waiting:true};
   if(groups.length!==2||groups.some(g=>g.length!==5||g.some((r,i)=>r.value!==statusList[i])))return {error:'状态选项结构与已核对版本不一致，停止操作。'};
   const current=groups[0].find(r=>r.checked)?.value;
    if(command.type==='pokeForm'){
      if(!document.getElementById('DH$text'))return {error:'缺少单号输入框'};
      return fhPoke()?{poked:true}:{error:'未能在表单上点出联动'};
    }
    if(command.type==='pressEnter'){
      const box=document.getElementById('DH$text');
      if(!box)return {error:'缺少单号输入框'};
      box.focus();
      for(const type of ['keydown','keyup'])box.dispatchEvent(new KeyboardEvent(type,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
      return {pressed:true};
    }
    if(command.type==='prepare'){
      const loading=Array.from(document.querySelectorAll('.mini-mask,.mini-mask-loading')).some(el=>el.getBoundingClientRect().height>0&&getComputedStyle(el).visibility!=='hidden');
      if(loading)return {waiting:true,reason:'调整单仍在加载'};
      const box=document.getElementById('DH$text');if(!box)return {error:'缺少单号输入框'};
      const widget=window.mini?.get?.('DH');if(!widget?.setValue)return {error:'原站单号联动控件不可用，请在原站手动输入单号。'};
      const existing=box.value.trim();
      // 复用同一张调整单时，里面可能还留着上一单的号：不拒绝，直接清空重写并重新联动，
      // 后面 inspect 会核对完整单号与当前状态，填错不会提交。
      const carried=!!(existing&&existing!==command.order.id);
      // 先清空再写：表单里已有同一单号时，原生联动不会再触发。
      widget.setValue('');if(box.value.trim())box.value='';
      widget.setValue(command.order.id);
      if(box.value.trim()!==command.order.id)return {error:'原站单号未填入，停止操作。'};
      window.__feihongLookupAt=Date.now();
      window.__feihongLookupRetry=false;
      fhPoke();
      return {prepared:true,carried:!!carried,via:'click'};
    }
   const fields=collect(),o=command.order;
   if(fields.DH!==String(o.id||'').trim())return {waiting:true,mismatch:['完整单号']};
   if(!fields.JJRXM&&!fields.SJRXM)return {waiting:true,mismatch:['寄件人/收件人均未联动']};
   if(!current)return {waiting:true};
   if(current!==o.status)return {error:'原站表单里 '+o.id+' 的当前状态是「'+current+'」，工作台记录的是「'+o.status+'」；为避免改错单已停止。若原站确实已变，请在工作台点「读取当前页」同步后再操作；若原站表单还停在旧状态，请关掉原站「物流状态调整单」标签重试。'};
   if(command.type==='inspect'){
     // 仅记录：联动出的联系人是否与工作台记录一致（去空白与 @#@ 后比较；工作台无该值时为 null）。
     const nm=s=>String(s||'').replace(/@#@/g,'').replace(/\s+/g,'');
     const same=(form,mine)=>nm(mine)?nm(form)===nm(mine):null;
     return {matched:true,current,names:{sender:same(fields.JJRXM,o.sender),receiver:same(fields.SJRXM,o.receiver),formSender:fields.JJRXM,formReceiver:fields.SJRXM}};
   }
   if(!statusList.includes(command.target)||command.target===current)return {error:'目标状态无效或与当前状态相同。'};
   const radio=groups[1].find(r=>r.value===command.target);
   if(!fhPickRadio(radio))return {error:'原站未选中目标状态，未提交。'};
   let send;try{send=window.parent.document.getElementById('sendBtn');}catch{}
   if(!send||text(send)!=='提交')return {error:'未识别原站提交入口，未提交。'};
   try{const r0=send.getBoundingClientRect();window.parent.__fhSendInfo={id:send.id,cls:String(send.className||'').slice(0,40),t:text(send).slice(0,6),size:Math.round(r0.width)+'x'+Math.round(r0.height),oc:String(send.getAttribute('onclick')||'').slice(0,60),href:String(send.getAttribute('href')||'').slice(0,40),dis:!!send.disabled};}catch{}
   window.parent.__feihongSubmitIntent={id:command.order.id,target:command.target};try{sessionStorage.setItem('feihongSubmitIntent',JSON.stringify({id:command.order.id,target:command.target,at:Date.now()}));}catch{}
   send.click();return {submitted:true,before:current,target:command.target,at:new Date().toISOString()};
 }
 return null;
}
if(typeof module!=='undefined')module.exports={sourceAction};
