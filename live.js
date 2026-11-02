let activeReadId=null,writeStageText='',writeStarted=0,stageText='',stageTimer=null,batchIndex=0,batchTotal=0,batchLabel='';
let lastBatch=null;
let changeCancelled=false;
const collapsedDays=new Set();
const historyPicked=new Set();let historyBusy=false;
const historyQueued=new Set();let historyRunning='';
// 本轮查询的序号：iso → 第几个；historyTotal 是本轮总数（每轮从 1 开始）
const historySeq=new Map();let historyTotal=0;

try{const saved=JSON.parse(localStorage.getItem('feihong-history-days')||'[]');if(Array.isArray(saved))saved.forEach(d=>collapsedDays.add(String(d)));}catch{}
document.getElementById('changeDialog').addEventListener('close',()=>{changeBatchSummary.textContent='';document.getElementById('cancelChange').textContent='取消';document.querySelector('#changeForm button[type="submit"]').hidden=false;});
function renderStage(){const el=$('changeStage');if(!el)return;el.textContent=stageText+(writeStarted?'（'+Math.round((performance.now()-writeStarted)/1000)+' 秒）':'');}
function setStage(t){stageText=t;renderStage();}
function tagText(){return batchTotal>1?(batchIndex+'/'+batchTotal+' '):'';}
function setOrderState(id,text,kind){try{const el=document.querySelector('.cs-state[data-state="'+CSS.escape(String(id))+'"]');if(!el)return;el.textContent=text;el.dataset.kind=kind||'';}catch{}}
function setOrderNote(id,note){try{const row=document.querySelector('.cs-row[data-row="'+CSS.escape(String(id))+'"]');if(row&&note)row.title=note;}catch{}}
if(globalThis.chrome?.runtime?.onMessage)chrome.runtime.onMessage.addListener(m=>{
 if(!m)return;
 if(m.type==='writeStage'){writeStageText=m.text;setStage((batchTotal>1&&batchLabel?batchLabel+'：':'')+m.text);const target=$('changeForm')?.querySelector('button[type="submit"]');if(target&&busy)target.textContent='正在提交…';return;}
 if(busy&&m.type==='readStage'&&m.readId===activeReadId){readProgress.note=m.text;drawReadProgress();}
 if(busy&&m.type==='flowStage'){readProgress.note=m.text;drawReadProgress();}
 if(m.type==='standardStage'){$('bulkText').textContent='打开原站标准页面：'+m.text;const c=$('connection');if(c)c.textContent='打开原站标准页面：'+m.text;}
 if(m.type==='statusSync'){
  if(typeof statusBusy!=='undefined'&&statusBusy&&historyStatusMode==='fast'){const b=$('batchStatusCheck');if(b)b.textContent='快速查询中 '+m.done+'/'+m.total;}
  if(busy){
   const t=$('bulkText');if(t)t.textContent='正在核对实际状态 '+m.done+'/'+m.total+'…';
   const bar=$('bulkBar');if(bar){bar.max=m.total||1;bar.value=m.done||0;}
   const cnt=$('bulkCount');if(cnt)cnt.textContent='已回查 '+m.done+'/'+m.total+' 单';
   if(m.id&&m.status){const hit=records.flow.find(o=>o.id===m.id&&o.flow==='已办');if(hit){hit.status=m.status;hit.statusSource='query';try{render();}catch{}}}
  }
 }
});
let readProgress={rows:0,total:null,page:0,pages:null,percent:null,started:0,note:''};
function drawReadProgress(){const p=readProgress,seconds=p.started?((performance.now()-p.started)/1000).toFixed(1):'0.0';$('bulkText').textContent=`已查询 ${p.rows}/${p.total??'—'} 行，第 ${p.page}/${p.pages??'—'} 页，用时 ${seconds} 秒，进度 ${p.percent===null?'待计算':p.percent+'%'}${p.note?' · '+p.note:''}`;}
let localPage=1, pendingCampus=null, bulkCancelled=false;
const LOCAL_PAGE_SIZE=50;
const $=id=>document.getElementById(id),E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const {statuses,identity,senderInfo,defaultOfficeKeywords,region,matches,formatTime}=FeiHong;
let officeKeywords=defaultOfficeKeywords;try{const v=JSON.parse(localStorage.getItem('feihong-office-keywords'));if(Array.isArray(v)&&v.every(k=>typeof k==='string'))officeKeywords=v;}catch{}
function personBadge(o){const info=senderInfo(o,officeKeywords);return `<span class="person-tag person-${info.kind}">${info.kind==='student'?'●':info.kind==='teacher'?'◆':info.kind==='service'?'✉':'?'} ${E(info.label)}</span>${info.proxy?'<small class="proxy-tag">↗ 疑似代老师下单 · 地址推断，待核实</small>':''}`;}
let sortColumn='',sortDescending=false;
let campus='良乡',activeColumn='all',activeColumns=new Set(['all']);
let currentView='orders',flowTab='待办',selected=new Set(),snapshots={query:null,flow:null},records={query:[],flow:[]},mappings=Object.create(null),audit=[],pending=[],busy=false,standardBusy=false,prepared=false,writePhase='idle';
// 每个页面自己记住滚动位置：首次进入从顶部开始，切走再切回来回到刚才停留的位置
const viewScroll={orders:0,flow:0,settings:0,history:0,tips:0};
let lastReadError='';
const key='feihong-connector-settings-v1',mKey='feihong-mappings-v1';
try{const m=JSON.parse(localStorage.getItem(mKey)||'null');if(m&&typeof m==='object')for(const [k,v]of Object.entries(m))if(['北校区','东校区','南校区','东南校区'].includes(v))mappings[k]=v;}catch{}
try{const d=window.FeiHongDefaultMappings&&window.FeiHongDefaultMappings.defaults;if(d)for(const [k,v]of Object.entries(d))if(!(k in mappings))mappings[k]=v;}catch{}
 try{const saved=JSON.parse(localStorage.getItem(key));if(saved){if(['良乡','中关村'].includes(saved.campus))campus=saved.campus;if(Array.isArray(saved.audit))audit=saved.audit;if(saved.mappings&&typeof saved.mappings==='object')for(const [k,v]of Object.entries(saved.mappings))if(['北校区','东校区','南校区','东南校区'].includes(v))mappings[k]=v;}}catch{}
audit=FeiHongAudit.prune(audit);
function saveMappings(){try{localStorage.setItem(mKey,JSON.stringify(mappings));chrome.storage?.local?.set({feihongMappingsV1:mappings}).catch(()=>{});return true;}catch{toast('楼宇映射保存失败，请检查浏览器存储。');return false;}}
function save(){try{saveMappings();audit=FeiHongAudit.prune(audit);localStorage.setItem(key,JSON.stringify({mappings,audit,campus}));chrome.storage?.local?.set({feihongAuditV2:audit}).catch(()=>{});return true;}catch{toast('本机历史无法保存，已停止后续提交。请先导出或检查浏览器存储。');return false;}}
async function loadDurableAudit(){try{const stored=(await chrome.storage.local.get('feihongAuditV2')).feihongAuditV2;audit=FeiHongAudit.prune(FeiHongAudit.merge(audit,stored));save();if(currentView==='history')renderHistory();}catch{}}
function toast(s,duration=6500){
 const el=$('toast');
 el.textContent=s;el.hidden=false;
 el.onclick=()=>{clearTimeout(toast.timer);el.hidden=true;};
 el.style.cursor='pointer';el.title='点击关闭';
 clearTimeout(toast.timer);
 toast.timer=setTimeout(()=>el.hidden=true,duration);
}
async function request(msg){if(!globalThis.chrome?.runtime?.id)throw Error('请按安装说明加载扩展，并从原站点击扩展图标打开；不要双击此HTML。');const r=await chrome.runtime.sendMessage(msg);if(!r?.ok)throw Error(r?.error==='不支持的操作'?'后台组件仍是旧版本：请在 Edge 扩展卡片点圆形箭头重新加载，再回学校页点击扩展图标。仅刷新工作台不会更新后台。':r?.error||'扩展连接已中断，请在原站重新点击扩展图标。');return r.data;}
function kind(){return currentView==='flow'?'flow':'query';}
// v0.9.190：页面字号——按“标准 14px”为 1.0 缩放整页；本地立即生效，后台 chrome.storage 持久化
const PageFont={key:'feihong-page-font',min:10,max:26,base:14,
 readControls(sel,custom){const v=sel&&sel.value==='custom'?Number(custom&&custom.value||this.base):Number(sel&&sel.value||this.base);return Math.min(this.max,Math.max(this.min,Math.round(v)||this.base));},
 apply(px){const p=Math.min(this.max,Math.max(this.min,Number(px)||this.base));document.documentElement.style.setProperty('--page-fs',p+'px');document.body.style.zoom=String(p/this.base);this.px=p;},
 save(px){this.apply(px);try{localStorage.setItem(this.key,String(px));}catch{}try{request({type:'pageFont',action:'set',px}).catch(()=>{});}catch{}},
 applyControls(px){const sel=$('pageFont'),custom=$('pageFontCustom');if(!sel)return;const preset=['12','14','16','18'].includes(String(px));sel.value=preset?String(px):'custom';custom.hidden=preset;if(!preset)custom.value=String(px);this.apply(px);},
 async restore(){let px=Number(localStorage.getItem(this.key))||0;try{const r=await request({type:'pageFont',action:'get'});if(r&&Number(r.px))px=Number(r.px);}catch{}this.applyControls(px||this.base);}};
window.FeiHongPageFont=PageFont;
function orders(){return records[kind()];}
function filtered(){const selectedDirection=$('direction').value;const column=CampusPerspective.columns(campus).find(c=>c.key===activeColumn)||CampusPerspective.columns(campus)[0];const f={status:'all',direction:'all',identity:$('identity').value,region:$('region').value,search:$('search').value,officeKeywords};return FeiHong.queryRows(orders().filter(o=>matches(o,f,mappings)&&CampusPerspective.includes(o,campus,selectedDirection)&&(currentView==='flow'?o.flow===flowTab&&o.fromCampus===campus:CampusPerspective.matchesColumns(o,campus,activeColumns,mappings))),{day:$('orderDay').value,sort:sortColumn,descending:sortDescending});}
function setSnapshot(s){
 lastReadError='';
 const parsed=SourceMapping.normalize(s);
 if(s.kind==='flow'&&s.flowTab){
  // 流程按分类合并：只替换本次读到的分类，保留另一类数据
  records.flow=[...records.flow.filter(o=>o.flow!==s.flowTab),...parsed];
 }else{
  records[s.kind]=parsed;
 }
 snapshots[s.kind]=s;
}
async function requireComponent(){const c=await request({type:'hello'});if(!c||!c.recentRead||c.version!=='1.0.12')throw Error('后台版本不匹配（'+((c&&c.version)||'未知')+'）：请在 Edge 扩展管理页重新加载扩展，再从原站点击红色飞鸿图标重新连接。');}
// v1.0.12：再次读取当前页时，把本次读到的行并入已有列表：旧的保留、新的追加、同一条用原站新数据更新
function mergeSnapshot(s){
 lastReadError='';
 const parsed=SourceMapping.normalize(s);
 const isFlow=s.kind==='flow'&&s.flowTab;
 const oldRows=isFlow?records.flow.filter(o=>o.flow===s.flowTab):records[s.kind];
 const others=isFlow?records.flow.filter(o=>o.flow!==s.flowTab):[];
 if(!oldRows.length){setSnapshot(s);return {first:true,added:parsed.length,updated:0,total:parsed.length};}
 const key=o=>o.id+'|'+(SourceMapping.fingerprint?SourceMapping.fingerprint(o):'');
 const map=new Map();for(const o of oldRows)map.set(key(o),o);
 let added=0,updated=0;
 for(const n of parsed){const k=key(n),prev=map.get(k);if(!prev){map.set(k,n);added++;}else{updated++;map.set(k,{...prev,...n,history:prev.history||n.history,recordKey:prev.recordKey});}}
 const merged=[...map.values()];
 if(isFlow)records.flow=[...others,...merged];else records[s.kind]=merged;
 snapshots[s.kind]={...s,rows:merged,total:merged.length,pageSize:null,merged:true,mergeAdded:added,mergeUpdated:updated,mergeOld:oldRows.length};
 return {first:false,added,updated,total:merged.length};
}
async function read(){
 if(busy)return;try{await requireComponent();}catch(err){toast(err.message,8000);return;}lastReadError='';readProgress={rows:0,total:null,page:0,pages:1,percent:null,started:performance.now(),note:'读取当前页'};busy=true;render();$('readSource').textContent='正在读取…';$('bulkProgress').hidden=false;$('cancelBulk').disabled=true;$('bulkText').textContent='正在读取原站当前页…';$('bulkCount').textContent='已查询 0 条 · 等待当前页返回';$('bulkElapsed').textContent='';$('bulkBar').removeAttribute('value');drawReadProgress();
 try{  const s=await request({type:'read',kind:kind(),flowTab});
   if(kind()==='query'&&(!s.rows||s.rows.length===0)){
     const keep=records.query.length>0;
     $('connection').textContent=keep?('原站查询页暂无数据，已保留上次读取的 '+records.query.length+' 条'):'原站查询页暂无数据';
     toast(keep?'原站查询页暂无数据（可能还在加载），已保留上次结果；可再点一次「读取当前页」。':'原站查询页暂无数据：请确认门户停在查询结果页并已查询，再点「读取当前页」。');
     busy=false;$('bulkProgress').hidden=true;$('readSource').textContent='读取当前页';render();return;
   }
   const merge=mergeSnapshot(s);Object.assign(readProgress,{rows:merge.total,total:merge.total,page:1,pages:1,percent:100,note:'仅当前页'});drawReadProgress();$('bulkCount').textContent='已查询 '+merge.total+' 条 · '+(merge.first?'当前页进度 100%（仅本页）':'已合并（新增 '+merge.added+' / 更新 '+merge.updated+'）');$('bulkBar').max=100;$('bulkBar').value=100;render();toast(merge.first?'读取完成，已逐列映射 '+merge.total+' 件原站记录。':'原站当前页已合并：新增 '+merge.added+' 条、更新 '+merge.updated+' 条，共 '+merge.total+' 条（保留之前读取的旧记录）。');}
 catch(e){lastReadError=e.message;$('connection').textContent='读取失败：'+e.message+' 现有列表未更新，请勿把旧列表当作最新结果。';readProgress.note='读取失败：'+e.message;drawReadProgress();$('bulkCount').textContent='已查询 0 条 · 本次读取未完成';$('bulkBar').max=100;$('bulkBar').value=0;toast(e.message);}
 finally{busy=false;$('bulkProgress').hidden=true;$('readSource').textContent='读取当前页';render();}
}
function render(listOnly=false){
 const flow=currentView==='flow';
 if(!listOnly){
 const currentDirection=$('direction').value;
 document.querySelectorAll('[data-sort]').forEach(b=>{const active=b.dataset.sort===sortColumn;b.textContent=({time:'快件 / 下单时间',sender:'寄件人',receiver:'收件人'})[b.dataset.sort]+' '+(active?(sortDescending?'↓':'↑'):'↕');b.closest('th').setAttribute('aria-sort',active?(sortDescending?'descending':'ascending'):'none');});
 $('footerCampus').textContent='京工飞鸿 · '+campus+'窗口';
 document.title='京工飞鸿 · '+campus+'窗口工作台';
 document.querySelectorAll('[data-campus]').forEach(b=>{b.classList.toggle('primary',b.dataset.campus===campus);b.setAttribute('aria-pressed',String(b.dataset.campus===campus));});
 $('direction').innerHTML='<option value="all">全部方向</option><option value="out">'+campus+'→'+(campus==='良乡'?'中关村':'良乡')+'</option><option value="in">'+(campus==='良乡'?'中关村':'良乡')+'→'+campus+'</option>';
 $('direction').value=currentDirection;
 $('clearFilters').classList.toggle('filters-active',!!($('search').value||$('orderDay').value||$('direction').value!=='all'||$('identity').value!=='all'||$('region').value!=='all'||sortColumn));
 $('region').hidden=campus!=='良乡';
 $('flowTools').hidden=!flow;$('overview').hidden=flow;$('listTitle').hidden=!flow;$('exportExcel').hidden=flow;
 }
 const matching=filtered(),localPages=Math.max(1,Math.ceil(matching.length/LOCAL_PAGE_SIZE));localPage=Math.min(localPage,localPages);const visible=matching.slice((localPage-1)*LOCAL_PAGE_SIZE,localPage*LOCAL_PAGE_SIZE),eligible=visible.filter(o=>!o.duplicateOrder),ids=new Set(matching.filter(o=>!o.duplicateOrder).map(o=>o.id));selected=new Set([...selected].filter(id=>ids.has(id)));
 const s=snapshots[kind()];
 $('scopeFooter').textContent='原站数据 · '+(s?.bulk?(s.complete?'所有页面读取批次':'尚未读完的批次'):'当前原站页')+' · 收件人学号/工号原站未提供';
 if(currentView==='flow'&&s)$('scopeFooter').textContent='流程数据 · 已读取 '+s.rows.length+' 条'+(s.limited?'（前 '+s.pagesRead+' 页）':'');
 const duplicateRows=orders().filter(o=>o.duplicateOrder).length,duplicateIds=new Set(orders().filter(o=>o.duplicateOrder).map(o=>o.id)).size;
 $('prevPage').hidden=flow||!!s?.bulk;$('nextPage').hidden=flow||!!s?.bulk;$('sourcePage').hidden=flow||!!s?.bulk;
 $('readSource').disabled=busy;$('readRecent').disabled=busy;$('readAll').disabled=busy;
 $('localPrev').disabled=localPage<=1||busy;$('localNext').disabled=localPage>=localPages||busy;
 $('localPageLabel').textContent='本地 '+localPage+' / '+localPages+' 页';
 $('prevPage').disabled=busy||!s?.page||s.page<=1;
 $('nextPage').disabled=busy||!s||!s.pageSize||!s.total||s.page>=Math.ceil(s.total/s.pageSize);
 $('sourcePage').textContent=s?.page?'原站第 '+s.page+' 页':'';
 const connectionDetail=s?`${s.bulk?(s.complete?'近一个月全部页面读取完成':'读取未完成，以下仅为已读部分'):'原站当前页'}：已读取 ${s.rows.length} 行 / 原站范围 ${s.total??'未识别'} 行。${s.bulk?'已读 '+s.pagesRead+' / '+s.pageCount+' 页。':''}${duplicateIds?'有 '+duplicateIds+' 个重复单号，涉及 '+duplicateRows+' 行，全部保留并禁止修改。':''}读取时间 ${formatTime(new Date(s.readAt))}（北京时间）。${s.bulk?(s.dateRange?'下单时间 '+s.dateRange.from+' 至 '+s.dateRange.to+'。分批读取期间数据可能更新。':'分批读取期间数据可能更新；可重新读取刷新。'):'当前仅本页；一键读取近一个月可自动读取该时段所有状态、所有页面。'}`:'尚未读取。可读取当前页，或一键读取近一个月所有状态与页面。';
 $('connection').title=lastReadError||connectionDetail;
 $('connection').textContent=lastReadError?('读取未完成：'+(s?.bulk&&!s.complete?'仅已读 '+s.rows.length+'/'+(s.total??'—')+' 行 · ':'')+lastReadError):s?`${s.bulk?(s.complete?'近一个月读取完成':'未读完，仅显示已读部分'):'当前页读取完成'} · ${s.rows.length}/${s.total??'—'} 行${s.bulk?' · '+s.pagesRead+'/'+s.pageCount+' 页':''} · ${formatTime(new Date(s.readAt))}${s.dateRange?' · '+s.dateRange.from+' 至 '+s.dateRange.to:''}${duplicateIds?' · '+duplicateIds+' 个重复单号（禁改）':''}`:'尚未读取';
 if(currentView==='flow'&&!lastReadError&&s)$('connection').textContent='流程已读取 '+s.rows.length+' 条'+(s.limited?'（前 '+s.pagesRead+' 页，可继续读取）':'');
 if(!listOnly){
 $('overview').innerHTML=CampusPerspective.columns(campus).map(c=>`<button aria-pressed="${activeColumns.has(c.key)}" class="status-tab ${activeColumns.has(c.key)?'active':''}" data-column="${c.key}"><span>${E(c.label)}</span><b>${orders().filter(o=>CampusPerspective.matchesColumn(o,campus,c,mappings)).length}</b></button>`).join('');
 $('flowTabs').innerHTML=['待办','已办'].map(t=>`<button class="button ${flowTab===t?'primary':''}" data-flow="${t}">${t}</button>`).join('')+(flowTab==='已办'?`<button class="button flow-sync-tab" data-sync="1">实际状态回查</button>`:'');
 $('personTabs').innerHTML=['all','老师','学生','京工飞鸿','身份待确认','疑似代老师下单'].map(t=>`<button class="button ${$('identity').value===t?'primary':''}" data-person="${t}">${t==='all'?'全部下单':t==='疑似代老师下单'?t:t+'下单'}</button>`).join('');
 $('regionTabs').hidden=!['老师','疑似代老师下单'].includes($('identity').value)||campus!=='良乡';$('regionTabs').innerHTML=['all','北校区','东校区','南校区','东南校区','区域待分配'].map(t=>`<button class="button" data-region="${t}">${t==='all'?'全部区域':t}</button>`).join('');
 $('listTitle').textContent=flow?campus+'流程办理 · '+flowTab:CampusPerspective.columns(campus).find(c=>c.key===activeColumn).label;
 }
 const rowMarkup=visible.map((o,idx)=>`<tr class="${selected.has(o.id)?'row-selected':''}"><td class="select-cell"><input type="checkbox" data-select="${E(o.id)}" ${o.duplicateOrder?'disabled':''} ${selected.has(o.id)?'checked':''} aria-label="选择 ${E(o.id)}"></td><td class="sequence-cell">${E(seqMode==='local'?(idx+1):(o.sourceSequence??o.seq??''))}</td><td><b>${E(o.id)}</b>${o.duplicateOrder?`<small class="duplicate-warning">原站重复单号 ×${o.duplicateCount}${o.duplicateConflict?' · 信息有冲突':''}（禁改）</small>`:''}<small>${E(FeiHong.orderTime(o.time))}<br>${E(o.item)}</small></td><td>${E(o.sender)} ${personBadge(o)}<small>${E(o.personId)}<br>${E(o.phone)}</small></td><td>${E(o.fromCampus)} · ${E(o.building)} ${E(o.room)}${(()=>{const r=region(o,mappings);if(!r||r==='—')return '';return '<span class="person-tag region-tag '+({'北校区':'north','东校区':'east','南校区':'south','东南校区':'southeast','区域待分配':'pending'}[r]||'other')+'">'+E(r)+'</span>';})()}<small>↓ ${E(o.toCampus)} · ${E(o.destination)}</small></td><td>${E(o.receiver)}<small>${E(o.receiverPhone)}</small></td><td><span class="status s${statuses.indexOf(o.status)}">${E(o.status)}</span><small>${flow?'流程：'+E(o.workflowState||o.flow):''}</small></td><td><div class="row-actions"><button data-print="${E(o.id)}" data-flow="${E(o.flow||'')}">打印申请单</button><button data-change="${E(o.id)}" ${(o.duplicateOrder||o.flow==='待办')?'disabled title="待办单需先在原站“批量处理→通过”，变成已办后才能改物流状态"':''}>改物流状态</button><button data-detail="${E(o.recordKey)}">详情</button></div></td></tr>`).join('')||emptyRow();
 $('rows').innerHTML=rowMarkup.replace(/<td([^>]*)>/g,'<td$1><div class="cell-content">').replace(/<\/td>/g,'</div></td>');
 $('resultCount').textContent=`${snapshots[kind()]?.bulk&&!snapshots[kind()].complete?'未读完 · 仅已读取部分；':''}本页 ${visible.length} 行 · 匹配 ${matching.length} / 已读取 ${orders().length} 行`;$('selectedCount').textContent=selected.size;{const isTodo=currentView==='flow'&&flowTab==='待办';$('batchApprove').hidden=!isTodo;$('batchReject').hidden=!isTodo;$('batchChange').hidden=isTodo;}const showBar=['orders','flow'].includes(currentView)&&selected.size>0;const sb=$('selectionBar');if(sb)sb.hidden=!showBar;if(document.body&&document.body.classList)document.body.classList.toggle('has-selection-bar',showBar);$('batchChange').disabled=!selected.size||busy;$('batchChange').textContent='批量改状态';$('selectAll').disabled=eligible.length===0;$('selectAll').checked=eligible.length>0&&eligible.every(o=>selected.has(o.id));$('selectAll').indeterminate=eligible.some(o=>selected.has(o.id))&&!eligible.every(o=>selected.has(o.id));
 if(!listOnly)document.dispatchEvent(new Event('feihong-layout')); 
}
function emptyRow(){
 const count=(typeof mappings==='object'&&mappings)?Object.keys(mappings).length:0;
 const region=($('region')||{}).value||'all';
 if(region!=='all')return '<tr><td colspan="8" class="empty">寄件区域按「楼宇 → 区域」对照表筛选：'+(count?('已配置 '+count+' 个楼宇，但该区域目前没有分配楼宇'):'尚未配置任何楼宇')+'。请到「楼宇与区域」配置后再筛。</td></tr>';
 return '<tr><td colspan="8" class="empty">暂无已读取的匹配快件。请先读取原站对应列表。</td></tr>';
}
function view(v){try{viewScroll[currentView]=window.scrollY||document.documentElement.scrollTop||0;}catch{}const sub=document.querySelector('.header-subtitle');if(sub)sub.hidden=false;const HINTS={flow:'待办/已办流程读取与批量通过、退回。',orders:'查询、分类、改状态，在这里一次完成。',settings:'维护寄件楼宇 → 校区区域对照；只影响工作台筛选，不改原站。',history:'本地保存最近一个月的改动记录；可核对原站状态或改回。',tips:'值班注意事项、主要功能、改状态要点和常见问题。'};const hintEl=document.getElementById('pageHint');if(hintEl)hintEl.textContent=HINTS[v]||'';const connEl=document.getElementById('connection');if(connEl)connEl.hidden=!['orders','flow'].includes(v);const bar=$('selectionBar');if(bar)bar.hidden=true;if(document.body&&document.body.classList)document.body.classList.remove('has-selection-bar');if(!busy)$('bulkProgress').hidden=true;currentView=v;localPage=1;selected.clear();activeColumn='all';activeColumns=new Set(['all']);$('search').value='';for(const id of ['direction','identity','region'])$(id).value='all';document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('settings').hidden=v!=='settings';$('history').hidden=v!=='history';$('tips').hidden=v!=='tips';$('work').hidden=!['orders','flow'].includes(v);const work=['orders','flow'].includes(v),query=v==='orders';$('readSource').hidden=!work;$('readFlows').hidden=true;$('diagnose').hidden=v!=='flow';$('readSource').textContent='读取当前页';$('flowPagesWrap').hidden=v!=='flow';$('readRecent').hidden=v==='flow'||!work;$('readAll').hidden=v==='flow'||!work;document.querySelector('.read-range').hidden=v==='flow'||!work;if($('statusRow'))$('statusRow').hidden=(v==='flow');$('pageTitle').textContent={flow:'流程办理',orders:'快件查询及状态调整',settings:'楼宇与区域',history:'状态修改历史',tips:'重要提示'}[v];if(v==='settings')renderMappings();else if(v==='history')renderHistory();else render();try{const y=viewScroll[v]||0;const go=()=>{try{window.scrollTo(0,y);}catch{}};if(typeof requestAnimationFrame==='function')requestAnimationFrame(go);else setTimeout(go,0);}catch{}}
function openChange(ids){pending=orders().filter(o=>ids.includes(o.id)&&!o.duplicateOrder&&(currentView!=='flow'||o.flow===flowTab));if(!pending.length)return;
 const pendingFlow=pending.filter(o=>o.flow==='待办');
 if(pendingFlow.length){toast('选中的 '+pendingFlow.length+' 单还在“待办”：请先在原站「批量处理 → 通过」，变成已办并进入良乡申请寄件后，才能改物流状态。');return;}writePhase='idle';changeCancelled=false;writeStarted=performance.now();if(!stageTimer)stageTimer=setInterval(renderStage,500);setStage('尚未提交，可随时取消。');$('cancelChange').textContent='取消';$('cancelChange').disabled=false;$('closeChange').disabled=false;$('changeSummary').innerHTML=pending.map(o=>'<div class="cs-row" data-row="'+E(o.id)+'">'+E(o.id)+' · '+E(o.sender)+' → '+E(o.receiver)+' · '+E(o.status)+'<span class="cs-state" data-state="'+E(o.id)+'">待处理</span></div>').join('');const pick=$('targetStatus');pick.dataset.value='';pick.dataset.selected='0';pick.style.setProperty('--i','0');pick.querySelectorAll('input[type=radio]').forEach(r=>{r.checked=false;});$('changeReason').value='';$('changeForm').querySelector('button[type="submit"]').disabled=!FeiHongWritePolicy.allowed(pending);$('batchCount').textContent=pending.length;$('changeDialog').showModal();}
async function submit(e){
 e.preventDefault();if(busy||!pending.length)return;if(statusBusy){toast('正在批量查看原站状态（'+Math.min(statusDone+1,statusTotal)+'/'+statusTotal+'），原站一次只能做一件事：请等它结束后再提交修改。');return;}if(!FeiHongWritePolicy.allowed(pending)){toast('所选记录含无效单号或重复单，禁止提交。');return;}const target=$('targetStatus').dataset.value||'';if(!statuses.includes(target)){toast('请先选择目标状态，再提交。');const first=$('targetStatus').querySelector('input[type=radio]');if(first)first.focus();return;}
 const targets=pending.filter(o=>o.status!==target);if(!targets.length){toast('目标与当前状态相同，无需提交。');return;}
 busy=true;changeCancelled=false;writePhase='preparing';setStage('正在核对原站；此阶段可以取消，取消后不会提交。');let pre=null;
 try{pre=await request({type:'statusPreflight'});}
 catch(err){busy=false;writePhase='idle';changeCancelled=false;if(stageTimer){clearInterval(stageTimer);stageTimer=null;}$('closeChange').disabled=false;$('cancelChange').disabled=false;try{$('changeDialog').close();}catch{}render();toast('开始批量修改前检查原站失败：'+err.message,12000);return;}
 if(pre&&pre.closed)toast('已关闭残留的“物流状态调整单” '+pre.closed+' 张。');const submitButton=$('changeForm').querySelector('button[type="submit"],button:not([type])');submitButton.disabled=true;
 const batchStartedAt=performance.now(),batchId='b'+Date.now();$('changeBatchSummary').textContent='正在提交申请，请耐心等待；批量修改期间请勿操作原站或扩展（需要人工清理时按提示操作）。';
 let doneCount=0;const failures=[];let consecutiveFails=0;const batchRows=[];
 try{
  for(let orderIndex=0;orderIndex<targets.length;orderIndex++){
    if(changeCancelled){setStage('已取消，剩余单未执行');break;}
    const order=targets[orderIndex];
    batchIndex=orderIndex+1;batchTotal=targets.length;
    batchLabel=batchIndex+'/'+batchTotal+' '+order.id+' · '+(order.sender||'')+'→'+(order.receiver||'');
    writeStarted=performance.now();
    setOrderState(order.id,'准备中','busy');
    let row=null;
    try{
   submitButton.textContent='正在核对原站并等待表单…';
   writePhase='preparing';$('cancelChange').disabled=false;$('closeChange').disabled=false;
   row={id:order.id,from:order.status,to:target,iso:new Date().toISOString(),time:formatTime(new Date()),reason:$('changeReason').value.trim(),result:'正在准备，尚未提交',action:'物流状态调整',sender:order.sender,receiver:order.receiver,fromCampus:order.fromCampus,toCampus:order.toCampus,building:order.building,batchId,batchSize:targets.length};
   audit.push(row);batchRows.push(row);if(!save())throw Error('历史保存失败，未提交。');
   let prep=null;
   try{prep=await request({type:'prepare',order});}catch(e){row.result=/已取消/.test(e.message)?'已取消，未提交':'准备失败，未提交';row.error=e.message;save();throw e;}
   if(changeCancelled){row.result='已取消，未提交';save();break;}
   row.nameWarn=nameWarning(prep&&prep.names,order);
   // Persist uncertain state before dispatch: a failed response may still have committed.
   row.result='提交结果待核验';save();
   writePhase='submitted';setStage('正在提交并确认原站弹窗…（可点取消停止等待、跳过剩余单）');$('cancelChange').disabled=false;$('closeChange').disabled=true;submitButton.textContent='正在提交…';
   let submitted=null;
   try{submitted=await request({type:'submit',order,target});if(!submitted?.confirmed)throw Error('尚未确认原站提交弹窗。');}
   catch(e){
    const retryable=/已回读原站，当前状态是/.test(String(e.message||''))&&!order.__retried;
    if(retryable){
     order.__retried=1;
     row.result='第一次提交未确认（原站状态未变），正在重试一次';save();
     setStage(tagText()+'第一次提交未确认（原站状态未变），正在重试一次');
     try{
      prep=await request({type:'prepare',order});
      submitted=await request({type:'submit',order,target});
      if(!submitted?.confirmed)throw Error('尚未确认原站提交弹窗。');
     }catch(e2){
      row.result='提交结果不明，禁止自动重试';row.error=e2.message;save();
      throw Error(e2.message+'；已重试一次，勿再重复提交。');
     }
    }else{
     row.result='提交结果不明，禁止自动重试';row.error=e.message;save();
     throw Error(e.message+'；勿重复提交。');
    }
   }
   // 结果里写明判定依据：看到“提交成功” / 调整单标签已自动关闭 / 按单号回查
   doneCount++;row.result=submitted&&submitted.verified?('已回读确认：'+target):'已确认提交（'+(submitted&&submitted.basis||'未回读')+'）';row.basis=submitted&&submitted.basis||'';if(submitted&&submitted.presses)row.presses=submitted.presses;if(submitted&&submitted.staleToast)row.staleToast='提交前页面上已有 '+submitted.staleToast+' 处“提交成功”字样（已忽略）';if(submitted&&submitted.resubmitted)row.reason=(row.reason?row.reason+' · ':'')+'原站提示数据不完整，已点确定并重新提交一次';row.confirmedAt=formatTime(new Date());row.timing={prepare:prep&&prep.timing||null,submit:submitted&&submitted.timing||null};if(!save())throw Error('已确认提交，但历史保存失败；批量已停止。');
   consecutiveFails=0;
   setStage(tagText()+'状态修改成功，请等待全部改完后刷新原网站查看');toast('已提交 '+order.id,1500);setOrderState(order.id,'已改好','ok');
    }catch(err){
     if(changeCancelled||/已取消/.test(String(err.message||''))){const unknown=/结果不明|已发出/.test(String(err.message||''));if(row){row.result=unknown?'已取消（提交结果不明，请核对）':'已取消，未提交';row.error=err.message;save();}setStage(unknown?'已取消等待：本单提交结果不明，请到原站核对':'已取消，本单未提交');break;}
     if(/历史保存失败/.test(err.message))throw err;
      // 原站一直卡在加载中：这一单记失败后不要继续硬改，停下来让用户去原站刷新
      if(/仍在“加载中”|保存超过 90 秒|卡在加载中/.test(String(err.message||''))){
       if(row){if(!/失败|不明|待核验|已取消/.test(String(row.result||'')))row.result='提交失败，未改成功';row.error=err.message;save();}
       failures.push(order.id);setOrderState(order.id,'失败','bad');setOrderNote(order.id,err.message);
       setStage('原站一直卡在加载中，已停止批量。');
       throw new Error('原站一直卡在加载中（已处理 '+doneCount+'/'+targets.length+' 单）。请到原站刷新页面，确认不卡后再重新批量。');
      }
     if(row){if(!/失败|不明|待核验|已取消/.test(String(row.result||'')))row.result='提交失败，未改成功';row.error=err.message;save();}
     failures.push(order.id);setOrderState(order.id,'失败','bad');setOrderNote(order.id,err.message);
     setStage(tagText()+'状态修改失败（'+String(err.message).slice(0,60)+'）');
     consecutiveFails++;
     if(consecutiveFails===5)toast('已连续 5 单失败，后面仍会继续尝试；若一直失败，请回原站刷新页面后再继续。',20000);
    }
  }
  const elapsed=(performance.now()-batchStartedAt)/1000,processed=doneCount+failures.length;
  if(changeCancelled){$('changeBatchSummary').textContent='已取消：成功 '+doneCount+'/'+targets.length+' 单，失败 '+failures.length+' 单，剩余 '+Math.max(0,targets.length-doneCount-failures.length)+' 单未执行。';}
  else{$('changeBatchSummary').textContent='处理完成：成功 '+doneCount+'/'+targets.length+' 单，失败 '+failures.length+'/'+targets.length+' 单；共用时 '+elapsed.toFixed(1)+' 秒，平均每单 '+(processed?elapsed/processed:0).toFixed(1)+' 秒。';}
 try{const seg=phaseAvg(batchRows);if(seg)$('changeBatchSummary').textContent+='；分期平均：'+seg;}catch{}
  lastBatch={rows:batchRows,target,elapsed,doneCount,failures:[...failures],at:Date.now(),count:targets.length};
  writeStarted=0;setStage(changeCancelled?'已取消：剩余单未执行，原因见状态修改历史。':'处理结束；失败原因可在状态修改历史查看。');
  pending=[];selected.clear();render();
  if(changeCancelled)toast('已取消：成功 '+doneCount+' 单，失败 '+failures.length+' 单，其余未执行',20000);
  else if(failures.length)toast('批量完成：成功 '+doneCount+' 单，失败 '+failures.length+' 单（原因见「状态修改历史」）',20000);
  else toast('已提交 '+targets.length+' 单',1500);
 }catch(e){toast((targets.length>1?'批量改状态：已完成 '+doneCount+'/'+targets.length+' 单，其余未执行；':'')+e.message,20000);$('changeDialog').close();render();}finally{if(stageTimer){clearInterval(stageTimer);stageTimer=null;}busy=false;writePhase='idle';changeCancelled=false;$('cancelChange').disabled=false;$('closeChange').disabled=false;submitButton.disabled=false;submitButton.textContent='提交修改';if(!pending.length){$('cancelChange').textContent='关闭';submitButton.disabled=true;}renderHistory();render();}
}
// 姓名核对（仅记录，不拦截）：两个联系人都不一致、且至少有一个能确定不一致时记一笔，供现场评估误报率。
function nameWarning(n,o){
 if(!n||n.sender===true||n.receiver===true||(n.sender!==false&&n.receiver!==false))return '';
 return '表单联动出 寄件人「'+(n.formSender||'空')+'」/收件人「'+(n.formReceiver||'空')+'」，工作台为「'+(o.sender||'空')+'」/「'+(o.receiver||'空')+'」（仅记录，未拦截）';
}
// 每单分段用时（累计秒）：linked1/2/3 表示第几次触发联动后才出订单信息
function timingText(t){
 if(!t)return '';
 const L={portal:'门户',form:'表单',linked1:'联动(第1次)',linked2:'联动(第2次)',linked3:'联动(第3次)',clicked:'点提交',confirmed:'确认',settled:'收尾'};
 const part=x=>x?Object.entries(x).map(([k,v])=>(L[k]||k)+(v/1000).toFixed(1)).join(' '):'';
 return [t.prepare?'准备['+part(t.prepare)+']':'',t.submit?'提交['+part(t.submit)+']':''].filter(Boolean).join(' ');
}
// 批次分期平均：准备段(门户/表单/联动) 与 提交段(点提交/确认/收尾)
function phaseAvg(rows){
 const acc={},cnt={},add=(k,v)=>{if(typeof v==='number'&&v>=0){acc[k]=(acc[k]||0)+v;cnt[k]=(cnt[k]||0)+1;}};
 for(const r of rows||[]){
  const p=r&&r.timing&&r.timing.prepare,sub=r&&r.timing&&r.timing.submit;
  if(p){let prev=0;for(const k of ['portal','form','linked1','linked2','linked3']){if(typeof p[k]==='number'){add(k,p[k]-prev);prev=p[k];}}}
  if(sub){let prev=0;for(const k of ['clicked','confirmed','settled']){if(typeof sub[k]==='number'){add(k,sub[k]-prev);prev=sub[k];}}}
 }
 const N={portal:'门户',form:'表单',linked1:'联动1',linked2:'联动2',linked3:'联动3',clicked:'点提交',confirmed:'确认',settled:'收尾'};
 return Object.keys(acc).map(k=>N[k]+' '+(acc[k]/cnt[k]/1000).toFixed(1)+'s').join(' / ');
}
function renderHistory(){
 const all=records.query.concat(records.flow),lookup=id=>all.find(x=>x.id===id);
 const rows=FeiHongAudit.filter(audit,historyFilter(),lookup);
 updateHistoryBar(rows);
 if(!rows.length){$('historyRows').innerHTML='<tr><td colspan="6" class="empty">所选时间段内没有修改记录。</td></tr>';return;}
 // 按北京时间分日（筛选也用北京时间，两者一致）
 const groups=new Map();
 for(const h of rows){
  const day=FeiHongAudit.dayKey(h);
  if(!groups.has(day))groups.set(day,[]);
  groups.get(day).push(h);
 }
 const days=[...groups.keys()].sort().reverse();
 $('historyRows').innerHTML=days.map(day=>{
  const list=groups.get(day),collapsed=collapsedDays.has(day),tally=FeiHongAudit.summaryText(list);
  const head=`<tr class="history-day"><td colspan="6"><button type="button" class="day-toggle" data-day="${E(day)}" aria-expanded="${collapsed?'false':'true'}">${collapsed?'▸':'▾'} ${E(dayLabel(day))}（${list.length} 条${tally?'：'+E(tally):''}）</button></td></tr>`;
  if(collapsed)return head;
  let lastBatch='';
  return head+list.map(h=>{
   // 同一次批量修改的记录前加一行批次小标题
   let batchHead='';
   if(h.batchId&&h.batchSize>1&&h.batchId!==lastBatch){const members=list.filter(x=>x.batchId===h.batchId);batchHead=`<tr class="history-batch"><td colspan="6">批量修改 ${E((h.time||'').slice(11,16))} · 共 ${E(h.batchSize)} 单（本列表 ${members.length} 条：${E(FeiHongAudit.summaryText(members))}）</td></tr>`;}
   lastBatch=h.batchId||'';
   const k=lookup(h.id);
   const sender=h.sender||k?.sender||'',receiver=h.receiver||k?.receiver||'',campus=h.fromCampus||k?.fromCampus||'';
   const o=FeiHongAudit.outcome(h);
   const badges=`<span class="history-badge ${o}">${E(FeiHongAudit.OUTCOME[o])}</span>${h.reverted?'<span class="history-badge reverted">已改回</span>':''}${h.revertOf?'<span class="history-badge revert">改回操作</span>':''}`;
   const note=[h.reason?'原因'+h.reason:'',h.error||'',h.nameWarn||'',h.staleToast||'',h.presses||'',h.timing?'用时 '+timingText(h.timing):''].filter(Boolean).join(' · ');
   const mismatch=FeiHongAudit.mismatch(h),unreadable=/^取不到/.test(h.currentStatus||'');
   const live=h.currentStatus?`<small class="history-live${mismatch?' bad':''}${unreadable?' unknown':''}" title="${mismatch?'原站状态与本次改为的目标状态不一致':unreadable?'没有查到原站状态':'原站状态与本次目标一致'}">原站现为：${h.via==='fast'?'【快速】':h.via==='exact'?'【精确】':''}${E(h.currentStatus)}${h.checkedAt?' · '+E(h.checkedAt.slice(5,16)):''}${mismatch?'（≠目标）':''}</small>`:'';
   const revertCell=h.reverted?'<button class="button reverted" disabled>已改回原状态</button>':FeiHongAudit.canRevert(h)?`<button class="button primary" data-revert="${E(h.id)}" data-from="${E(h.from)}" data-to="${E(h.to)}" data-key="${E(h.iso)}">改回原状态</button>`:'<button class="button" disabled title="这次没有改成功，原站状态没变，无需改回">无需改回</button>';
   const sSeq=historySeq.get(h.iso)||0,sLabel=historyRunning===h.iso?('查询中 '+sSeq+'/'+historyTotal):(historyQueued.has(h.iso)?('排队中 '+sSeq+'/'+historyTotal):'');
 const actions=`${revertCell}${sLabel?`<button class="button" disabled>${sLabel}</button>`:`<button class="button" data-status="${E(h.id)}" data-key="${E(h.iso)}">查看原站状态</button>`}`;
   return batchHead+`<tr><td class="history-check"><input type="checkbox" data-pick="${E(h.iso)}" aria-label="选择 ${E(h.id)}" ${historyPicked.has(h.iso)?'checked':''}></td><td class="history-time" title="${E(h.time)}">${E((h.time||'').slice(5,16))}</td><td class="history-id">${E(h.id)}<small>${sender||receiver?E(sender||'—')+' → '+E(receiver||'—')+(campus?' · '+E(campus):''):''}</small></td><td>${E(h.from)} → ${E(h.to)}${live}</td><td class="history-actions">${actions}</td><td class="history-note" title="${E(h.action+' · '+h.result+(note?' · '+note:''))}">${badges}<span class="history-result">${E(h.result)}</span>${note?'<details><summary>展开详情</summary>'+E(note)+'</details>':''}</td></tr>`;
  }).join('');
 }).join('');
}
function dayLabel(day){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
 if(!m)return day;
 const nowY=new Date().getFullYear();
 return (Number(m[1])!==nowY?m[1]+'年':'')+Number(m[2])+'月'+Number(m[3])+'日';
}
// 屏幕、批量查看、导出共用同一套筛选条件
function historyFilter(){return {q:$('historySearch').value.trim(),from:$('historyFrom').value,to:$('historyTo').value,onlyAttention:$('historyUnverified').checked};}
// 勾选计数、全选框与“复查不明单”按钮跟着当前列表走
function updateHistoryBar(rows){
 const isos=new Set(rows.map(h=>h.iso)),picked=[...historyPicked].filter(iso=>isos.has(iso)).length;
 const count=$('historyPickedCount');if(count)count.textContent=picked?'已选 '+picked+' 条':'';
 const clear=$('clearHistoryPicks');if(clear)clear.hidden=!historyPicked.size;
 const all=$('historyAll');if(all){all.checked=rows.length>0&&picked===rows.length;all.indeterminate=picked>0&&picked<rows.length;}
 const unknown=rows.filter(h=>FeiHongAudit.outcome(h)==='unknown'&&!h.reverted).length;
 const re=$('recheckUnknown');if(re){re.textContent='复查不明单'+(unknown?'（'+unknown+'）':'');re.disabled=!unknown;}
}
$('officeKeywords').value=officeKeywords.join('\n');
$('saveOfficeKeywords').onclick=()=>{officeKeywords=$('officeKeywords').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);localStorage.setItem('feihong-office-keywords',JSON.stringify(officeKeywords));toast('办公楼识别规则已保存，仅用于疑似代办提示。');render();};
function renderMappings(){$('mappings').innerHTML=Object.entries(mappings).map(([n,r])=>`<div class="mapping"><span>${E(n)}</span><span>${E(r)}</span><button data-remove="${E(n)}">移除</button></div>`).join('')||'<p>尚未配置楼宇对应关系。</p>';renderPendingBuildings();}
function renderPendingBuildings(){const el=$('pendingBuildings');if(!el)return;const names=[...new Set(orders().filter(o=>o.fromCampus==='良乡'&&o.building&&region(o,mappings)==='区域待分配').map(o=>o.building))].sort((a,b)=>a.localeCompare(b,'zh-Hans-CN'));el.innerHTML=names.length?names.map(n=>`<div class="mapping"><span>${E(n)}</span><select data-pick="${E(n)}">${regions.map(r=>`<option>${E(r)}</option>`).join('')}</select><button data-assign="${E(n)}">保存</button></div>`).join(''):'<p class="muted">没有待配置的楼宇（或尚未读取数据）。</p>';}
const regions=['北校区','东校区','南校区','东南校区'];
let seqMode='local';
let filterTimer;
function applyInputFilter(){clearTimeout(filterTimer);localPage=1;selected.clear();render(true);}
for(const id of ['search','orderDay']){
 const input=$(id);let composing=false;
 input.addEventListener('compositionstart',()=>{composing=true;clearTimeout(filterTimer);});
 input.addEventListener('compositionend',()=>{composing=false;filterTimer=setTimeout(applyInputFilter,60);});
 input.addEventListener('input',e=>{if(composing||e.isComposing)return;clearTimeout(filterTimer);filterTimer=setTimeout(applyInputFilter,60);});
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!composing)applyInputFilter();});
}

document.querySelector('#parcelTable thead').addEventListener('click',e=>{const b=e.target.closest('[data-sort]');if(!b)return;sortDescending=sortColumn===b.dataset.sort?!sortDescending:false;sortColumn=b.dataset.sort;localPage=1;render();});
// 「读取前 N 页」的进度按本次要读的量算：min(原站总条数, N 页 × 每页条数)，
// 而不是原站全部条数（已办有几万条，按全部算会一直显示 0%）
function flowProgress(p){
 const pageCap=p.limited&&p.pageSize?p.pages*p.pageSize:null;
 const target=Number.isInteger(p.total)?(pageCap?Math.min(p.total,pageCap):p.total):pageCap;
 const pagesTarget=p.limited&&p.pageSize&&Number.isInteger(p.total)?Math.max(1,Math.min(p.pages,Math.ceil(p.total/p.pageSize))):p.pages;
 const percent=target?Math.min(99,Math.floor(p.rowsRead/target*100)):p.pages?Math.min(99,Math.floor(p.page/p.pages*100)):0;
 return {target,pagesTarget,percent};
}
async function readFlows(pages=5){
 if(busy)return;try{await requireComponent();}catch(err){toast(err.message,8000);return;}busy=true;bulkCancelled=false;lastReadError='';localPage=1;selected.clear();
 const started=performance.now();readProgress={rows:0,total:null,page:0,pages:null,percent:null,started,note:'读取'+flowTab};
 $('bulkProgress').hidden=false;$('cancelBulk').disabled=false;$('bulkBar').removeAttribute('value');$('readFlows').textContent='正在读取…';drawReadProgress();render();
 const timer=setInterval(drawReadProgress,100);
 const tally=tab=>orders().filter(o=>o.flow===tab).length;
 try{
  const parts=await FeiHongBulk.scanFlows({pages,tabs:[flowTab],request,isCancelled:()=>bulkCancelled,onProgress:p=>{
   if(p.phase==='switch'){$('bulkText').textContent='正在切换到“'+p.tab+'”…';readProgress.note=p.tab;drawReadProgress();return;}
   const {target,pagesTarget,percent}=flowProgress(p);
   $('bulkText').textContent='正在读取“'+p.tab+'”：已取 '+p.rowsRead+' 条 · 第 '+p.page+' / '+pagesTarget+' 页';
   Object.assign(readProgress,{rows:p.rowsRead,total:target??p.total,page:p.page,pages:pagesTarget,percent,note:p.tab});
   drawReadProgress();$('bulkBar').max=100;$('bulkBar').value=percent;
  }});
  const fresh=parts.flatMap(p=>SourceMapping.normalize(p));records.flow=[...records.flow.filter(o=>o.flow!==flowTab),...fresh];
  // v0.9.206：原站把“已办”的状态一律写成订单申请，必须回「快件查询」核对真实状态

  snapshots.flow={kind:'flow',bulk:true,complete:false,limited:true,page:1,pageSize:null,total:records.flow.length,rows:parts.flatMap(p=>p.rows),rowIds:[],headers:[],readAt:new Date().toISOString(),pagesRead:parts.reduce((n,p)=>n+p.pagesRead,0),pageCount:parts.reduce((n,p)=>n+p.pageCount,0),scope:'流程（前 '+pages+' 页）'};
  readProgress.percent=100;readProgress.rows=records.flow.length;readProgress.total=records.flow.length;$('bulkBar').value=100;
  try{await request({type:'flowFirstPage'});}catch{}
 $('bulkText').textContent='已读取“'+flowTab+'”'+fresh.length+' 条（前 '+pages+' 页），当前共 '+records.flow.length+' 条';
  $('bulkCount').textContent='待办 '+tally('待办')+' 条 · 已办 '+tally('已办')+' 条';
  toast('已读取“'+flowTab+'”'+fresh.length+' 条（前 '+pages+' 页），用时 '+((performance.now()-started)/1000).toFixed(1)+' 秒。');refreshNotices();
 }catch(e){
  if(e.partial&&e.partial.length){records.flow=[...records.flow.filter(o=>o.flow!==flowTab),...e.partial.flatMap(p=>SourceMapping.normalize(p))];snapshots.flow={kind:'flow',bulk:true,complete:false,limited:true,page:1,total:records.flow.length,pageSize:null,rows:e.partial.flatMap(p=>p.rows),rowIds:[],headers:[],readAt:new Date().toISOString(),pagesRead:e.partial.reduce((n,p)=>n+p.pagesRead,0),pageCount:e.partial.reduce((n,p)=>n+p.pageCount,0),scope:'流程（未读完）'};}
  lastReadError=e.message;$('bulkText').textContent=e.message;$('bulkCount').textContent='流程读取未完成';
  toast(e.message);
 }finally{clearInterval(timer);$('bulkElapsed').textContent='耗时 '+((performance.now()-started)/1000).toFixed(1)+' 秒';busy=false;$('bulkProgress').hidden=true;$('readFlows').textContent='读取全部流程';render();}
}
let noticeCache=[];
function renderNotices(list){
 noticeCache=list||[];
 const bar=$('noticeBar');
 if(!noticeCache.length){bar.hidden=true;bar.innerHTML='';return;}
 bar.innerHTML='<b>消息提醒</b>'+noticeCache.map((n,i)=>'<span class="notice-item">'+E(n.body)
   +(n.time?'<small>发送时间：'+E(n.time)+'</small>':'')
   +'<button class="link-button" data-notice="'+i+'">查看详情</button></span>').join('');
 bar.hidden=false;
 bar.onclick=e=>{
  const b=e.target.closest('[data-notice]');
  if(!b)return;
  const idx=Number(b.dataset.notice);
  const n=noticeCache[idx];
  if(!n)return;
  if(n.id)focusOrder(n.id);else toast('这条提醒没有单号，请到原站查看。');
  noticeCache=noticeCache.filter((_,i)=>i!==idx);
  renderNotices(noticeCache);
 };
}
function focusOrder(id){
 const inQuery=(records.query||[]).some(o=>o.id===id);
 const inFlow=(records.flow||[]).some(o=>o.id===id);
 if(!inQuery&&!inFlow){toast('该单还没有读取，请先读取对应列表后再查看。');return false;}
 const target=inQuery?'orders':'flow';
 if(currentView!==target)view(target);
 if(target==='flow'){
  const rec=[...(records.flow||[])].find(o=>o.id===id);
  if(rec&&rec.flow){flowTab=rec.flow;document.querySelectorAll('#flowTabs [data-flow]').forEach(b=>b.classList.toggle('primary',b.dataset.flow===flowTab));}
 }
 $('search').value=id;
 applyInputFilter();
 const box=document.querySelector('#rows [data-select="'+id+'"]');
 const row=box?box.closest('tr'):null;
 if(row){row.classList.add('row-flash');row.scrollIntoView({block:'center'});setTimeout(()=>row.classList.remove('row-flash'),2600);}
 return !!row;
}
async function refreshNotices(){
 try{const d=await request({type:'notices'});renderNotices(d.notices||[]);}catch{/* 未连接时静默 */}
}
async function diagnose(){
 try{
  const d=await request({type:'diagnose'}),p=d.portal||{};
  // 页面一律显示中文名；扩展不认识的页面才附上文件名，便于维护者辨认
  const pn=(f,path)=>{const n=f&&f.name;const file=String(path||'').split('/').pop();return n&&n!=='其他页面'?n:'其他页面（'+(file||'未知')+'）';};
  const ready=r=>r==='complete'?'已加载':r?'加载中':'未知';
  const lines=['扩展版本：'+(d.version||'未知'),'写入开关：'+(d.writes?'开启':'关闭'),'提交准备令牌：'+(d.prepared?'存在（2分钟内有效）':'无'),'门户标签：'+((p.tabs||[]).join(' | ')||'未识别'),'门户外壳页面：'+((d.frames||[]).some(f=>/framework\.htm$/.test(String(f.path||'')))?'已识别':'未识别'),'调整单标签：'+(p.forms??'?')+' 张'+(p.formActive?'（活动）':''),'业务系统标签：'+(p.service?'已打开':'未打开'),'门户里的页面：'];
  for(const f of d.frames||[])lines.push('  - '+pn(f,f.path)+'（'+ready(f.ready)+(f.dh?'，有单号框':'')+(f.radios?'，'+f.radios+' 个单选':'')+'）');
   if((d.flowFrames||[]).length){lines.push('流程列表页：');for(const f of d.flowFrames)lines.push('  - '+pn(f,f.path)+' 共 '+(f.total===null?'?':f.total)+' 条 / 本页 '+f.count+' 行 / 首行 '+(f.first||'—')+' / 视口 '+(f.size||[]).join('×'));}
   for(const r of d.rowDump||[]){lines.push('行结构：'+(r.path==='toDoList'?'待办列表':'其他列表')+' 行数 '+r.count+'，勾选框 '+r.inputs+'，方块 '+r.boxes);if(r.html)lines.push('  '+r.html);}
   for(const f of d.flowDebug||[]){lines.push('流程页：'+pn(f,f.path)+' 行（第一种取法 '+f.rows2+'，第二种取法 '+f.rowsLine+'） 视口 '+(f.size||[]).join('×')+' 分页「'+f.pager+'」');lines.push('  分类按钮：'+(f.tabs||[]).join(' ｜ '));}
   if(d.lastFlowSwitch)lines.push('最近切换：'+d.lastFlowSwitch);
   for(const f of d.flowProbe||[]){
    lines.push('流程页现状：'+pn(f,f.path)+'（'+ready(f.ready)+'，可视高度 '+f.viewH+(f.frameH!==null&&f.frameH!==undefined?'，框架高度 '+f.frameH+(f.frameH>0?'，正在显示':'，隐藏'):'')+(f.flowId?'，流程编号 '+f.flowId:'')+'）');
    lines.push('  识别当前分类：'+(f.active||'识别不出')+'；按钮 '+(f.tabs||[]).join(' ')+'；加载遮罩 '+f.loading+' 个');
    lines.push('  表头 '+(f.headers||[]).length+' 列：'+(f.headers||[]).join(' | '));
    lines.push('  行：'+Object.entries(f.rows||{}).map(([k,v],i)=>'第'+['一','二','三'][i]+'种取法 '+v).join('；'));
    lines.push('  分页：第 '+(f.pageNum||'?')+' 页；'+(f.summary||'未找到“每页/共”文字')+(f.pager?'；分页栏「'+f.pager+'」':''));
   }
   if((d.flowTrace||[]).length){lines.push('最近一次流程读取的步骤：');for(const s of d.flowTrace)lines.push('  '+s.sec+' 秒  '+s.text+(s.n>1?'（重复 '+s.n+' 次）':''));}
  for(const x of d.preflight||[]){const tag=[];if(x.entry!==null)tag.push('办理入口 '+x.entry+' 个');if(x.formPage!==null)tag.push(x.formPage?'表单页正常':'表单页缺单号框');if(x.queryCode)tag.push('查询编号 '+x.queryCode);if(x.flowId)tag.push('流程编号 '+x.flowId);if(tag.length)lines.push('结构预检 '+pn(x,x.path)+'：'+tag.join('，'));}
  lines.push('最近读取错误：'+(lastReadError||'无'));
  $('diagnoseText').textContent=lines.join('\n');$('diagnoseDialog').showModal();
 }catch(e){toast(e.message);}
}
$('diagnose').onclick=diagnose;
$('copyDiagnose').onclick=async()=>{try{await navigator.clipboard.writeText($('diagnoseText').textContent);toast('已复制诊断信息。');}catch{toast('复制失败，请手动选择文本复制。');}};
for(const id of ['closeDiagnose','closeDiagnose2'])$(id).onclick=()=>$('diagnoseDialog').close();
for(const id of ['closeRevert','revertDone'])$(id).onclick=()=>{if(!busy)$('revertDialog').close();};
$('revertDialog').addEventListener('cancel',e=>{e.preventDefault();if(!busy)$('revertDialog').close();});
$('historyUnverified').onchange=renderHistory;
function copiedFeedback(){
 const btn=$('copyBatchRecords');if(!btn)return;
 const n=lastBatch?lastBatch.rows.length:0;
 if(btn.__t)clearTimeout(btn.__t);
 btn.dataset.copied='1';btn.textContent='已复制到剪贴板';
 toast('已复制 '+n+' 条修改记录，可直接粘贴',1600);
 btn.__t=setTimeout(()=>{btn.dataset.copied='';btn.textContent='复制修改信息';btn.__t=null;},1600);
}
$('copyBatchRecords').onclick=async()=>{
 if(!lastBatch||!lastBatch.rows.length){toast('本次还没有可复制的修改记录。');return;}
 const pad=n=>String(n).padStart(2,'0'),d=new Date();
 const stamp=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes());
 const head=['序号','单号','寄件人','收件人','寄件校区','原状态','目标状态','结果','失败原因','记录时间','姓名核对','分段耗时(秒)','点确定记录'];
 const lines=['京工飞鸿 批量修改记录 '+stamp,
  '目标状态：'+lastBatch.target+'　成功 '+lastBatch.doneCount+'/'+lastBatch.count+'，失败 '+lastBatch.failures.length+'/'+lastBatch.count,
  head.join('\t')];
 lastBatch.rows.forEach((r,i)=>lines.push([i+1,r.id,r.sender||'',r.receiver||'',r.fromCampus||'',r.from||'',r.to||'',r.result||'',String(r.error||'').replace(/[\r\n\t]+/g,' '),r.time||'',r.nameWarn||'',timingText(r.timing),r.presses||''].join('\t')));
 const text=lines.join('\n');
 try{
  await navigator.clipboard.writeText(text);
  copiedFeedback();
 }catch(err){
  try{
   const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
   const ok=document.execCommand('copy');ta.remove();
   if(ok)copiedFeedback();
   else toast('复制失败：请改用「状态修改历史」页的导出');
  }catch(e2){toast('复制失败：'+e2.message);}
 }
};
// 导出跟随当前筛选（日期段、搜索、只看异常）；有勾选时只导出勾选的
$('exportHistory').onclick=()=>{const shown=historyDisplayRows(),picked=shown.filter(h=>historyPicked.has(h.iso)),rows=picked.length?picked:shown;if(!rows.length){toast('当前列表没有可导出的记录。');return;}const all=records.query.concat(records.flow),body=FeiHongAudit.exportRows(rows,id=>all.find(x=>x.id===id));const blob=new Blob([createSimpleWorkbook(body,'状态修改历史')],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='飞鸿状态修改历史-'+Date.now()+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);toast('已导出 '+rows.length+' 条历史记录（'+(picked.length?'仅勾选的记录':'当前筛选结果')+'）。');};
$('readSource').onclick=read;
$('flowPages').onclick=e=>e.stopPropagation();
$('flowPages').onkeydown=e=>e.stopPropagation();
$('flowPages').oninput=()=>{const v=parseInt($('flowPages').value||'5',10)||5;if(v<1)$('flowPages').value=1;if(v>50)$('flowPages').value=50;};
// v0.9.200：读取日期段入口已隐藏（原站查询区操作不稳定），保留后台命令以备恢复
$('readFlowPages').onclick=()=>{if(busy)return;const n=Math.max(1,Math.min(50,parseInt($('flowPages').value||'5',10)||5));$('flowPages').value=n;toast('将读取“'+flowTab+'”：扩展会自动把原站切到该分类。');readFlows(n);};
document.querySelector('nav').onclick=e=>{const b=e.target.closest('[data-view]');if(b&&!busy)view(b.dataset.view);};
async function runSyncFlowStatus(){
 if(busy||statusBusy)return;
 if(flowTab!=='已办'){toast('“实际状态回查”只在「已办」页可用；待办状态原站是准确的，不需要回查。');return;}
 const rows=records.flow.filter(o=>o.flow==='已办');
 const ids=[...new Set(rows.map(o=>o.id).filter(id=>/^JGKD\d+$/.test(id)))];
 if(!ids.length){toast('已办列表还没有数据，请先在「已办」里读取流程。');return;}
 busy=true;bulkCancelled=false;lastReadError='';
 $('bulkProgress').hidden=false;$('bulkBar').max=ids.length;$('bulkBar').value=0;
 $('bulkText').textContent='正在到「快件查询」回查实际状态 0/'+ids.length+'…';$('bulkCount').textContent='已回查 0/'+ids.length+' 单';drawReadProgress();
 try{
  const synced=await request({type:'syncFlowStatus',ids});
  let n=0;const got=(synced&&synced.statuses)||{};
  records.flow=records.flow.map(o=>o.flow==='已办'&&got[o.id]?(n++,{...o,status:got[o.id],statusSource:'query'}):o);
  $('bulkBar').value=ids.length;
  const fail=(synced&&synced.failures)||[],failIds=fail.map(f=>f.id);
  $('bulkText').textContent='实际状态回查完成：'+n+'/'+ids.length+' 单'+(failIds.length?'；没查到：'+failIds.slice(0,6).join('、')+(failIds.length>6?' 等':'')+'（可稍后再点一次）':'');
  $('bulkCount').textContent='已回查 '+n+'/'+ids.length+' 单';
  render();
  toast(n?('已回查 '+n+'/'+ids.length+' 单实际状态'+(failIds.length?'，'+failIds.length+' 单没查到（'+failIds.slice(0,3).join('、')+(failIds.length>3?' 等':'')+'）':'')+'。'):'没有回查到状态，请确认原站「快件查询」能正常按单号查到。',failIds.length?12000:6000);
 }catch(err){toast('实际状态回查失败：'+err.message,10000);}
 finally{busy=false;setTimeout(()=>{if(!busy)$('bulkProgress').hidden=true;},5000);}
}
$('flowTools').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.sync!==undefined){runSyncFlowStatus();return;}if(b.dataset.flow){flowTab=b.dataset.flow;toast('已切到“'+flowTab+'”分类，点右上「读取」只读这一类。');}if(b.dataset.person){$('identity').value=b.dataset.person;$('region').value='all';}if(b.dataset.region)$('region').value=b.dataset.region;render();};
$('overview').onclick=e=>{const b=e.target.closest('[data-column]');if(b){activeColumns=CampusPerspective.toggleColumns(activeColumns,b.dataset.column);activeColumn=[...activeColumns][0];localPage=1;$('direction').value='all';selected.clear();render();}};
$('campusSwitch').onclick=e=>{const b=e.target.closest('[data-campus]');if(!b||busy||b.dataset.campus===campus)return;pendingCampus=b.dataset.campus;$('campusConfirmText').textContent='从'+campus+'窗口切换至'+pendingCampus+'窗口？';$('campusDialog').showModal();};
$('confirmCampus').onclick=()=>{if(!pendingCampus||busy)return;campus=pendingCampus;pendingCampus=null;localPage=1;activeColumn='all';activeColumns=new Set(['all']);selected.clear();$('direction').value='all';$('region').value='all';save();$('campusDialog').close();render();};
for(const id of ['cancelCampus','closeCampus'])$(id).onclick=()=>{pendingCampus=null;$('campusDialog').close();};
// v0.9.215：一键把原站收拾成标准页面（关掉其他标签 → 只打开【流程】/快件查询/京工飞鸿两校快件系统）
async function openStandardPages(){
 if(busy||standardBusy)return;
 standardBusy=true;const btn=$('openStandard'),label=btn?btn.textContent:'打开原站标准页面';if(btn){btn.disabled=true;btn.textContent='正在打开…';}
 $('bulkProgress').hidden=false;$('bulkBar').removeAttribute('value');$('bulkText').textContent='正在打开原站标准页面…';$('bulkCount').textContent='正在检查原站标签';lastReadError='';
 try{
  await requireComponent();
  const r=await request({type:'openStandardPages'});
  $('bulkText').textContent=r.note||('原站标准页面已就绪：'+((r.tabs||[]).join('、')));
  $('bulkCount').textContent='原站标准页面已就绪';
  toast('原站标准页面已打开：'+((r.tabs||[]).join('、')),8000);
 }catch(e){
  $('bulkText').textContent='打开原站标准页面失败：'+e.message;$('bulkCount').textContent='打开原站标准页面失败';
  toast('打开原站标准页面失败：'+e.message,12000);
 }finally{
  standardBusy=false;if(btn){btn.disabled=false;btn.textContent=label;}
  $('bulkBar').max=100;$('bulkBar').value=100;
  setTimeout(()=>{if(!busy)$('bulkProgress').hidden=true;},6000);
 }
}
$('openStandard').onclick=()=>{openStandardPages();};
for(const id of ['direction','identity','region'])$(id).addEventListener('change',()=>{localPage=1;selected.clear();render();});
$('clearFilters').onclick=()=>{for(const id of ['orderDay'])$(id).value='';sortColumn='';sortDescending=false;localPage=1;$('search').value='';for(const id of ['direction','identity','region'])$(id).value='all';render();};
$('rows').onchange=e=>{if(e.target.dataset.select){e.target.checked?selected.add(e.target.dataset.select):selected.delete(e.target.dataset.select);render();}};
// v0.9.193：首列整格可勾选（行与行之间的分界线不响应），选中整行加浅绿底
$('rows').addEventListener('click',e=>{
 if(e.target.closest('input,label,a,button'))return;
 const cell=e.target.closest('td.select-cell');
 if(!cell||!$('rows').contains(cell))return;
 const tr=cell.closest('tr'),input=cell.querySelector('input[data-select]');
 if(!tr||!input||input.disabled)return;
 const r=cell.getBoundingClientRect();
 if(e.clientY-r.top<2||r.bottom-e.clientY<2)return; // 分界线不触发
 input.checked=!input.checked;
 input.dispatchEvent(new Event('change',{bubbles:true}));
});
$('selectAll').onchange=e=>{for(const o of filtered().slice((localPage-1)*LOCAL_PAGE_SIZE,localPage*LOCAL_PAGE_SIZE).filter(o=>!o.duplicateOrder)){if(e.target.checked)selected.add(o.id);else selected.delete(o.id);}render();};async function bulkApprove(action){
 const ids=[...selected];
 if(!ids.length)return;
 const label=action==='reject'?'退回':'通过';
 if(!confirm('将对选中的 '+ids.length+' 单执行「'+label+'」，确认继续？'))return;
 try{
  const pageRows=filtered().slice((localPage-1)*LOCAL_PAGE_SIZE,localPage*LOCAL_PAGE_SIZE);const indexOf=id=>{const i=pageRows.findIndex(o=>o.id===id);return i>=0?i+1:0;};
 const recOf=id=>{const arr=filtered();return arr.find(o=>o.id===id)||{};};
 const items=ids.map(id=>{const o=recOf(id);return {id,index:indexOf(id),sender:o.sender||'',receiver:o.receiver||''};});
 const r=await request({type:'bulkApprove',ids,items,action});
  toast('已在原站对 '+r.count+' 单执行「'+r.action+'」'+(r.confirmed?'（已确认）':'（未见确认弹窗）')+'，正在刷新列表…');
  selected.clear();render();
  // 刷新待办后核对：所选单号还在「待办」里，说明原站没有真正处理
  setTimeout(async()=>{if(busy)return;try{await read();}catch{return;}const left=ids.filter(id=>records.flow.some(o=>o.id===id&&o.flow==='待办'));toast(left.length?('注意：原站「待办」当前页仍有 '+left.length+' 单：'+left.join('、')+'，请到原站核对是否已'+label+'。'):('已核对：所选 '+ids.length+' 单已不在原站「待办」当前页。'),left.length?30000:6000);},900);
 }catch(err){toast('批量'+label+'失败：'+err.message);}
}
$('batchApprove').onclick=()=>bulkApprove('approve');
$('batchReject').onclick=()=>bulkApprove('reject');
$('cancelSelection').onclick=()=>{selected.clear();render();};$('batchChange').onclick=()=>openChange([...selected]);
function printFormHtml(o){
 const v=x=>E(x==null||x===''?'—':String(x));
 const cols='<colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"></colgroup>';
 const row=(k1,v1,k2,v2)=>'<tr><th>'+k1+'</th><td>'+v(v1)+'</td><th>'+k2+'</th><td>'+v(v2)+'</td></tr>';
 return '<h2 class="pf-title">寄件申请信息单</h2><p class="pf-no">'+v(o.id)+'</p>'
 +'<div class="pf-sec">寄件信息</div><table class="pf-table">'+cols
 +row('寄件人工号',o.personId,'寄件人姓名',o.sender)
 +row('寄件人电话',o.phone,'下单时间',o.time)
 +row('寄件地址',o.fromCampus,'楼宇/房间',[o.building,o.room].filter(Boolean).join(' '))
 +'<tr><th>寄件物品信息</th><td colspan="3">'+v(o.item)+'</td></tr>'
 +'</table>'
 +'<div class="pf-sec">收件信息</div><table class="pf-table">'+cols
 +row('收件人姓名',o.receiver,'收件人电话',o.receiverPhone)
 +row('收件地址',o.toCampus,'楼宇/房间',[o.destinationBuilding,o.destinationRoom].filter(Boolean).join(' '))
 +'</table>'
 +'<p class="pf-tip-title">温馨提示：</p>'
 +'<p class="pf-tip">1、学生寄/收件地址请选择中关村：师生服务大厅，良乡：学生服务中心102；并请寄/收件人到指定地点寄/收件。</p>'
 +'<p class="pf-tip">2、教师寄件或收件地址请写具体联系人地址及电话，我们会安排工作人员上门取件或送件。</p>'
 +'<p class="pf-tip">3、请正确填写，勿重复下单，谢谢！</p>';
}
function openPrint(id){
 const all=[...orders(),...(records.flow||[]),...(records.query||[])];
 const o=all.find(x=>x.id===id);
 if(!o){toast('没有找到该单的已读数据，请先读取后再打印。');return;}
 $('printForm').innerHTML=printFormHtml(o);
 $('printDialog').showModal();
}
const PRINT_CSS='@page{size:auto;margin:6mm 3mm 2mm}*{box-sizing:border-box}html,body{width:100%;height:auto}body{width:80%;margin:0 auto;color:#111;font:12px/1.35 "Microsoft YaHei",system-ui,sans-serif}.pf-title{text-align:center;font-size:20px;font-weight:600;width:70%;margin:0 auto 2px}.pf-no{text-align:center;font-size:20px;font-weight:600;letter-spacing:.2px;width:70%;margin:0 auto 6px}.pf-sec{background:#e7ebef;border-left:4px solid #2f6fb3;padding:5px 9px;margin:7px 0 4px;font-size:15px;font-weight:600;page-break-inside:avoid}.pf-table{width:100%;border-collapse:collapse;margin:0 0 4px;table-layout:fixed;page-break-inside:avoid}.pf-table col.c1{width:20%}.pf-table col.c2{width:20%}.pf-table col.c3{width:20%}.pf-table col.c4{width:40%}.pf-table th,.pf-table td{border:1px solid #222;padding:4px 8px;font-size:15px;font-weight:400;height:auto;vertical-align:middle}.pf-table th{white-space:nowrap;text-align:center;background:#fafafa}.pf-table td{text-align:left;overflow-wrap:anywhere}.pf-table tr{page-break-inside:avoid}.pf-tip-title{margin:5px 0 2px;font-size:12px;font-weight:600}.pf-tip{margin:2px 0;font-size:12px;font-weight:400;line-height:1.5}';
function nextExportName(){
 const d=new Date();
 const ymd=String(d.getFullYear())+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
 const key='feihong-export-seq-'+ymd;
 let n=0;
 try{n=Number(localStorage.getItem(key)||'0')||0;}catch{}
 n+=1;
 try{localStorage.setItem(key,String(n));}catch{}
 return '飞鸿清单'+ymd+(n>1?'('+(n-1)+')':'')+'.xlsx';
}
function printHtml(html){
 const f=document.createElement('iframe');
 Object.assign(f.style,{position:'fixed',right:'0',bottom:'0',width:'0',height:'0',border:'0',opacity:'0'});
 document.body.appendChild(f);
 const doc=f.contentDocument;
 doc.open();
 doc.write('<!doctype html><html><head><meta charset="utf-8"><title>寄件申请信息单</title><style>'+PRINT_CSS+'</style></head><body>'+html+'</body></html>');
 doc.close();
 setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print();}catch(e){toast(e.message);}setTimeout(()=>f.remove(),60000);},200);
}
$('printNow').onclick=()=>printHtml($('printForm').innerHTML);
$('printClose').onclick=()=>$('printDialog').close();
$('rows').onclick=async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.change)openChange([b.dataset.change]);if(b.dataset.print){openPrint(b.dataset.print);return;}
 if(b.dataset.original){try{await request({type:'openFlow'});toast('已切回原站流程，请核对单号 '+b.dataset.original+' 后办理。审核不自动标记为揽件。');}catch(e){toast(e.message);}}if(b.dataset.detail){const o=orders().find(o=>o.recordKey===b.dataset.detail);$('detailContent').innerHTML=Object.entries(o).filter(([k])=>!['history'].includes(k)).map(([k,v])=>`<p>${E(k)}：${E(v)}</p>`).join('');$('detailDialog').showModal();}};
// 目标状态点选：五个状态并排，点击圆点选中（与门户“调整物流信息”一致）
(function initStatusPicker(){
 const box=$('targetStatus');
 if(!box)return;
 box.innerHTML='<i class="status-glider" aria-hidden="true"></i>'+statuses.map(s=>'<label class="status-option"><input type="radio" name="targetStatus" value="'+E(s)+'"><span>'+E(s)+'</span></label>').join('');
 box.addEventListener('change',e=>{
  if(e.target&&e.target.name==='targetStatus'){box.dataset.value=e.target.value;const idx=statuses.indexOf(e.target.value);box.dataset.selected='1';box.style.setProperty('--i',String(Math.max(0,idx)));}
 });
})();
$('changeForm').onsubmit=submit;async function cancelChange(){
 if(writePhase==='preparing'||writePhase==='submitted'||writePhase==='cancelling'){
  if(changeCancelled)return;
  const wasSubmitted=writePhase==='submitted';
  changeCancelled=true;writePhase='cancelling';$('cancelChange').disabled=true;
  setStage(wasSubmitted?'正在取消：停止等待，本单提交已发出，结果请到原站核对…':'正在取消：原站不会提交…');
  try{await request({type:'cancelWrite'});}catch{}
  return;
 }
 $('changeDialog').close();
}for(const id of ['closeChange','cancelChange'])$(id).onclick=cancelChange;$('changeDialog').addEventListener('cancel',e=>{e.preventDefault();cancelChange();});$('closeDetail').onclick=()=>$('detailDialog').close();
for(const id of ['historySearch','historyFrom','historyTo'])$(id).oninput=renderHistory;$('historyRows').onchange=e=>{
 const iso=e.target.dataset.pick;
 if(!iso)return;
 if(e.target.checked)historyPicked.add(iso);else historyPicked.delete(iso);
 updateHistoryBar(historyDisplayRows());
};
$('historyAll').onchange=e=>{
 const boxes=[...document.querySelectorAll('#historyRows input[data-pick]')];
 boxes.forEach(b=>{if(e.target.checked)historyPicked.add(b.dataset.pick);else historyPicked.delete(b.dataset.pick);b.checked=e.target.checked;});
 updateHistoryBar(historyDisplayRows());
};
$('clearHistoryPicks').onclick=()=>{historyPicked.clear();renderHistory();};
// 一键复查：把当前列表里“结果不明”且未改回的记录加入查看原站状态队列
$('recheckUnknown').onclick=()=>{
 const rows=historyDisplayRows().filter(h=>FeiHongAudit.outcome(h)==='unknown'&&!h.reverted);
 if(!rows.length){toast('当前列表没有结果不明的记录。');return;}
 enqueueStatus(rows);toast('已把 '+rows.length+' 条结果不明的记录加入查看原站状态队列。');
};
const statusQueue=[];let statusBusy=false,statusDone=0,statusTotal=0;
let historyStatusMode='exact';
function historyDisplayRows(){
 const all=records.query.concat(records.flow);
 return FeiHongAudit.filter(audit,historyFilter(),id=>all.find(x=>x.id===id));
}
function statusButtonLabel(){
 const btn=$('batchStatusCheck');if(!btn)return;
 if(statusBusy)btn.textContent='查询中 '+Math.min(statusDone+1,statusTotal)+'/'+statusTotal;
 else btn.textContent='批量查看状态';
}
function enqueueStatus(rows){
 const queued=new Set(statusQueue.map(x=>x.iso));
 let added=0;
 if(!statusBusy&&!statusQueue.length){historySeq.clear();historyTotal=0;}
 for(const h of rows){
  if(!h||!h.iso||queued.has(h.iso))continue;
  historyTotal++;
  historySeq.set(h.iso,historyTotal);
  statusQueue.push({iso:h.iso,row:h});queued.add(h.iso);historyQueued.add(h.iso);added++;
 }
 statusTotal=statusDone+statusQueue.length;
 if(!added){if(!statusBusy)toast('这些记录已在查询队列里。');try{renderHistory();}catch{}return;}
 if(!statusBusy){statusDone=0;statusTotal=statusQueue.length;historyRunning=statusQueue[0]&&statusQueue[0].iso||'';if(historyRunning)historyQueued.delete(historyRunning);}
 // 点完立刻把按钮改成“查询中 k/n / 排队中 m/n”，不等第一个请求发出
 try{renderHistory();}catch{}
 statusButtonLabel();
 if(!statusBusy)pumpStatus();
}
async function pumpStatus(){
 if(statusBusy)return;
 statusBusy=true;
 const btn=$('batchStatusCheck');if(btn)btn.disabled=true;
 try{
  if(historyStatusMode==='fast'){
   // 改状态/改回/读取进行中时不插队：原站一次只做一件事。
   while(busy){const b=$('batchStatusCheck');if(b)b.textContent='等待当前操作结束…';await new Promise(r=>setTimeout(r,500));}
   let totalIds=0,totalGot=0,totalFail=0;
   while(statusQueue.length){
    const items=statusQueue.splice(0);
    const ids=[...new Set(items.map(x=>x.row.id).filter(id=>/^JGKD\d+$/.test(id)))];
    if(!ids.length){continue;}
    if(btn)btn.textContent='快速查询中 0/'+ids.length;
    const got={},fails=[];
    try{
     for(let i=0;i<ids.length;i+=200){
      if(btn)btn.textContent='快速查询中 '+Math.min(i+200,ids.length)+'/'+ids.length;
      const r=await request({type:'syncFlowStatus',ids:ids.slice(i,i+200)});
      Object.assign(got,(r&&r.statuses)||{});
      if(r&&Array.isArray(r.failures))fails.push(...r.failures);
     }
    }catch(e){
     // 已经查到的先落盘，失败的按原因标出（不整批丢弃）
     for(const it of items){
      if(got[it.row.id])it.row.currentStatus=got[it.row.id];
      else it.row.currentStatus='取不到（'+String(e.message||'快速查询失败').slice(0,40)+'）';
      it.row.via='fast';it.row.checkedAt=formatTime(new Date());
      historyQueued.delete(it.iso);
     }
     statusDone+=items.length;totalIds+=ids.length;totalGot+=Object.keys(got).length;totalFail+=(ids.length-Object.keys(got).length);
     save();renderHistory();
     continue;
    }
    const failMap=new Map(fails.map(f=>[f.id,f.reason]));
    for(const it of items){
     const st=got[it.row.id];
     if(st)it.row.currentStatus=st;else it.row.currentStatus='取不到（'+(failMap.get(it.row.id)||'快速查询未返回')+'）';
     it.row.via='fast';it.row.checkedAt=formatTime(new Date());
     historyQueued.delete(it.iso);
    }
    statusDone+=items.length;totalIds+=ids.length;totalGot+=Object.keys(got).length;totalFail+=(ids.length-Object.keys(got).length);
    save();renderHistory();
   }
   toast('快速查询完成：查到 '+totalGot+'/'+totalIds+' 单'+(totalFail?'，'+totalFail+' 单没查到（可稍后再试）':'')+'。',totalFail?10000:5000);
   return;
  }
  while(statusQueue.length){
   const item=statusQueue[0],row=item.row;
    historyRunning=item.iso;historyQueued.delete(item.iso);renderHistory();
   statusButtonLabel();
   // 改状态/改回/读取进行中时不插队：原站一次只做一件事。
   while(busy){const b=$('batchStatusCheck');if(b)b.textContent='等待当前操作结束…';await new Promise(r=>setTimeout(r,500));}
   statusButtonLabel();
   try{
    const r=await request({type:'statusOf',id:row.id});
    row.currentStatus=r.status;row.via='exact';row.checkedAt=formatTime(new Date());
    collapsedDays.delete(FeiHongAudit.dayKey(row));
    toast('原站当前状态：'+r.status+'（'+formatTime(new Date())+'）',1200);
   }catch(err){
    row.currentStatus='取不到（'+String(err.message||'').slice(0,40)+'）';row.via='exact';row.checkedAt=formatTime(new Date());
   }
   statusQueue.shift();statusDone++;historyRunning='';
   save();renderHistory();
  }
 }catch(e){
  toast('查询原站状态失败：'+e.message,10000);
  // 出错时把还没查的行标出来，不要静默丢弃队列
  while(statusQueue.length){const it=statusQueue.shift();it.row.currentStatus='取不到（'+String(e.message||'查询失败').slice(0,40)+'）';it.row.via=historyStatusMode;it.row.checkedAt=formatTime(new Date());historyQueued.delete(it.iso);}
  try{save();renderHistory();}catch{}
 }
 finally{
  statusBusy=false;historyRunning='';historyQueued.clear();historySeq.clear();historyTotal=0;
  try{renderHistory();}catch{}
  const btn2=$('batchStatusCheck');if(btn2)btn2.disabled=false;
  statusButtonLabel();
  try{localStorage.setItem('feihong-history-days',JSON.stringify([...collapsedDays]));}catch{}
 }
}
$('batchStatusCheck').onclick=()=>{
 const picked=[...historyPicked];
 const rows=(picked.length?historyDisplayRows().filter(h=>picked.includes(h.iso)):historyDisplayRows());
 if(!rows.length){toast('当前列表没有可查询的记录。');return;}
 enqueueStatus(rows);
};
try{const m=localStorage.getItem('feihong-history-status-mode');if(m==='fast'||m==='exact')historyStatusMode=m;}catch{}
function applyHistoryStatusMode(){document.querySelectorAll('input[name="historyStatusMode"]').forEach(r=>{r.checked=r.value===historyStatusMode;});}
applyHistoryStatusMode();
document.addEventListener('change',e=>{const r=e.target;if(r&&r.name==='historyStatusMode'&&r.checked){historyStatusMode=r.value;try{localStorage.setItem('feihong-history-status-mode',r.value);}catch{}toast(r.value==='fast'?'已切换到「快速查询」：按单号到快件查询核对（更快）':'已切换到「精确查询」：打开物流状态调整单逐单核对（原方式）',4000);}});

$('historyRows').onclick=async e=>{
 const day=e.target.dataset.day;
 if(day){
  if(collapsedDays.has(day))collapsedDays.delete(day);else collapsedDays.add(day);
  try{localStorage.setItem('feihong-history-days',JSON.stringify([...collapsedDays]));}catch{}
  renderHistory();return;
 }
 const statusId=e.target.dataset.status;
 if(statusId){
  // 按记录自身（修改时间）找，不按单号：同一单号改过又改回会有多条
  const statusKey=e.target.dataset.key;
  const row=(statusKey&&audit.find(h=>h.iso===statusKey))||audit.find(h=>h.id===statusId);
  if(row)enqueueStatus([row]);
  return;
 }
 const revertId=String(e.target.dataset.revert||'').trim();
  if(revertId){
   const from=String(e.target.dataset.from||'').trim();
   const to=String(e.target.dataset.to||'').trim();
   const key=e.target.dataset.key;
   if(!from){toast('这条记录缺少原状态，无法改回。');return;}
   if(!to){toast('这条记录缺少上次修改的目标状态，无法核对原站现状，不能改回。');return;}
   if(statusBusy){toast('正在批量查看原站状态，请等它结束后再改回。');return;}
   if(!/^JGKD\d+$/.test(revertId)){toast('单号里有空格或异常字符，无法改回。');return;}
   if(!confirm('确认把 '+revertId+' 改回“'+from+'”？会实际修改原站状态。'))return;
   if(busy){toast('有操作正在进行，请稍后再试。');return;}
   busy=true;
   const text=$('revertText'),stage=$('revertStage'),done=$('revertDone');
   text.textContent='正在把 '+revertId+' 从当前状态改回“'+from+'”，请不要操作原站。';
   stage.textContent='准备中…';done.hidden=true;$('closeRevert').disabled=true;
   $('revertDialog').showModal();
   try{
    const r=await request({type:'revert',id:revertId,from,to});
    if(r.already){stage.textContent='原站已经是“'+from+'”，无需改回。';stage.hidden=false;return;}
    // 改回记录：沿用原记录的寄/收件人；没去原站查过，不写“原站现为”
    const src=audit.find(x=>x.iso===key);
    const row={id:revertId,from:r.from,to:from,iso:new Date().toISOString(),time:formatTime(new Date()),reason:'按历史改回原状态',result:'已确认提交（'+(r.basis||'未回读')+'）',action:'物流状态调整',sender:src?.sender||'',receiver:src?.receiver||'',fromCampus:src?.fromCampus||'',toCampus:src?.toCampus||'',revertOf:key||''};
    audit.push(row);
    if(src){src.reverted=true;src.revertedAt=formatTime(new Date());}
    save();
    stage.textContent='已提交：'+revertId+' → '+from+'。原站状态更新有延迟，稍后可用“查看原站状态”核对。';
    toast('已提交改回：'+revertId+' → '+from);
    renderHistory();
   }catch(err){stage.textContent='改回失败：'+err.message;}
   finally{busy=false;$('closeRevert').disabled=false;done.hidden=false;}
   return;
  }
  const id=e.target.dataset.correct;
 if(id){view('orders');$('search').value=id;render();toast('已按单号筛选，请重新读取原站后核对。');}
};
$('exportSettings').onclick=()=>{const data={mappings,officeKeywords,campus,exportedAt:new Date().toISOString()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='飞鸿设置-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);toast('已导出设置：楼宇映射、办公关键词、校区。');};
$('importSettings').onchange=e=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const d=JSON.parse(String(reader.result));let n=0;if(d.mappings&&typeof d.mappings==='object')for(const [k,v]of Object.entries(d.mappings))if(['北校区','东校区','南校区','东南校区'].includes(v)){mappings[k]=v;n++;}if(Array.isArray(d.officeKeywords)){officeKeywords=d.officeKeywords.filter(x=>typeof x==='string');localStorage.setItem('feihong-office-keywords',JSON.stringify(officeKeywords));$('officeKeywords').value=officeKeywords.join('\n');}saveMappings();save();renderMappings();render();toast('已导入 '+n+' 条楼宇映射与识别规则。');}catch(err){toast('导入失败：'+err.message);}e.target.value='';};reader.readAsText(file,'utf-8');};
$('mappingForm').onsubmit=e=>{e.preventDefault();const b=$('building').value.trim();if(!b)return;mappings[b]=$('mappingRegion').value;saveMappings();save();renderMappings();$('building').value='';};$('mappings').onclick=e=>{if(e.target.dataset.remove){delete mappings[e.target.dataset.remove];saveMappings();save();renderMappings();render();}};
$('pendingBuildings').onclick=e=>{const n=e.target.dataset.assign;if(!n)return;const box=e.target.parentElement,sel=box&&box.querySelector('select');if(!sel)return;mappings[n]=sel.value;if(!saveMappings())return;save();renderMappings();render();toast('已把「'+n+'」归到 '+sel.value);};
$('seqToggle').onclick=()=>{seqMode=seqMode==='local'?'source':'local';$('seqToggle').textContent=seqMode==='local'?'序号':'原站序号';render();};
$('exportExcel').onclick=()=>{const data=filtered().filter(o=>!selected.size||selected.has(o.id));if(!data.length){toast('没有可导出的已读取记录。');return;}const fields=[['序号','__seq'],['单号','id'],['下单时间','time'],['物流信息','status'],['寄件人工号','personId'],['寄件人姓名','sender'],['寄件人电话','phone'],['寄件校区','fromCampus'],['寄件楼宇地址','building'],['寄件地址\n房间号','room'],['寄件物品信息','item'],['收件人姓名','receiver'],['收件人电话','receiverPhone'],['收件校区','toCampus'],['收件楼宇地址','destinationBuilding'],['收件地址\n房间号','destinationRoom'],['处理时间','processedAt'],['处理人','processor'],['读取范围内单号出现次数','duplicateCount'],['原站序号','sourceSequence']];const rows=[fields.map(f=>f[0]),...data.map((o,i)=>fields.map(f=>f[1]==='__seq'?String(i+1):o[f[1]]))];const url=URL.createObjectURL(new Blob([createWorkbook(rows)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=nextExportName();a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('已导出 '+data.length+' 行当前筛选结果；'+(snapshots.query?.bulk?(snapshots.query.complete?'全页读取批次':'未读完批次'):'仅原站当前页')+'。');};
try{saveMappings();}catch{}
setInterval(()=>{if(!busy)refreshNotices();},60000);
setTimeout(()=>refreshNotices(),1500);
const historyRange=FeiHongDates.recentMonth();$('historyFrom').value=historyRange.from;$('historyTo').value=historyRange.to;view('orders');loadDurableAudit();

async function changePage(direction){if(busy||currentView!=='orders')return;busy=true;render();try{const s=await request({type:'page',direction});setSnapshot(s);selected.clear();render();toast('已读取原站第 '+s.page+' 页，共 '+s.rows.length+' 件。');}catch(e){toast(e.message);}finally{busy=false;render();}}
$('prevPage').onclick=()=>changePage('prev');$('nextPage').onclick=()=>changePage('next');

$('localPrev').onclick=()=>{localPage=Math.max(1,localPage-1);render();};$('localNext').onclick=()=>{localPage++;render();};
$('cancelBulk').onclick=()=>{bulkCancelled=true;request({type:'cancelFlow'}).catch(()=>{});readProgress.note='正在停止，等待当前页返回';drawReadProgress();$('cancelBulk').disabled=true;};
function setRecentRange(){const r=FeiHongDates.recentMonth();$('readFrom').value=r.from;$('readTo').value=r.to;}
function setDefaultRange(){const r=FeiHongDates.recentDays(14);$('readFrom').value=r.from;$('readTo').value=r.to;if($('flowFrom')){$('flowFrom').value=r.from;$('flowTo').value=r.to;}}
setDefaultRange();
$('readRecent').onclick=()=>{if(busy)return;setRecentRange();if(currentView==='flow'){const r=FeiHongDates.recentMonth();readFlows({from:r.from,to:r.to,endExclusive:r.endExclusive});return;}$('readAll').click();};
$('readAll').onclick=async()=>{
 if(busy)return;let range;try{range=FeiHongDates.selected($('readFrom').value,$('readTo').value);}catch(e){toast(e.message);return;}if(currentView==='flow'){readFlows(range);return;}lastReadError='';const started=performance.now();readProgress={rows:0,total:null,page:0,pages:null,percent:null,started,note:'设置日期筛选'};busy=true;bulkCancelled=false;localPage=1;selected.clear();$('bulkProgress').hidden=false;$('cancelBulk').disabled=false;$('bulkText').textContent='准备读取 '+range.from+' 至 '+range.to+' 的所有状态…';$('bulkBar').removeAttribute('value');$('bulkCount').textContent='已查询 0 条 · 正在确认总数，进度待计算';render();$('readAll').textContent='正在读取…';drawReadProgress();const elapsedTimer=setInterval(drawReadProgress,100);
 try{
  const readId=String(Date.now());activeReadId=readId;await requireComponent();
  const complete=await FeiHongBulk.scanAll({range,request:m=>request({...m,readId}),isCancelled:()=>bulkCancelled,onProgress:p=>{$('bulkText').textContent=(p.verifying?'正在进行首尾复核':'正在读取')+'：'+p.rowsRead+' / '+p.total+' 行，第 '+p.page+' / '+p.pages+' 页';const percent=p.total?Math.min(99,Math.floor(p.rowsRead/p.total*100)):0;$('bulkBar').max=100;$('bulkBar').value=percent;Object.assign(readProgress,{rows:p.rowsRead,total:p.total,page:p.page,pages:p.pages,percent,note:p.verifying?'复核中':''});drawReadProgress();$('bulkCount').textContent='已查询 '+p.rowsRead+' / '+p.total+' 条 · 进度 '+percent+'%'+(p.verifying?' · 正在复核完整性':'');}});
  setSnapshot(complete);Object.assign(readProgress,{rows:complete.rows.length,total:complete.total,page:complete.pagesRead,pages:complete.pageCount,percent:100,note:'已完成'});$('bulkBar').value=100;$('bulkCount').textContent='已查询 '+complete.rows.length+' / '+complete.total+' 条 · 进度 100% · 完整性复核通过';$('bulkText').textContent='已完成：'+complete.rows.length+' 行，'+complete.pagesRead+' 页，'+range.from+' 至 '+range.to+' 所有物流状态。';toast('全部快件页面读取与首尾核对完成，用时 '+((performance.now()-started)/1000).toFixed(1)+' 秒。');
 }catch(e){if(e.partial?.rows.length){e.partial.complete=false;setSnapshot(e.partial);}lastReadError=e.message;readProgress.note=e.message;$('bulkText').textContent=e.message;if(!$('bulkBar').hasAttribute('value')){$('bulkBar').max=100;$('bulkBar').value=0;$('bulkCount').textContent='已查询 0 条 · 未完成日期筛选或总数确认';}else $('bulkCount').textContent+=' · 批次未完成';toast(e.message);}
 finally{await request({type:'endRead'}).catch(()=>{});activeReadId=null;clearInterval(elapsedTimer);drawReadProgress();$('bulkElapsed').textContent='耗时 '+((performance.now()-started)/1000).toFixed(1)+' 秒';busy=false;$('bulkProgress').hidden=true;$('readAll').textContent='自定义时段';$('cancelBulk').disabled=true;render();}
};

function setSidebarCollapsed(collapsed){document.body.classList.remove('sidebar-collapsed');$('expandSidebar').hidden=true;$('collapseSidebar').setAttribute('aria-expanded',String(!collapsed));window.FeihongSidebar?.[collapsed?'compact':'expand']();}
$('collapseSidebar').onclick=()=>setSidebarCollapsed(!document.body.classList.contains('sidebar-icon-only'));
$('expandSidebar').onclick=()=>setSidebarCollapsed(false);
