importScripts('source.js');
importScripts('write-policy.js');
importScripts('mapping.js');
importScripts('date-range.js');
const COMPONENT_VERSION = '0.9.214';
// Every write requires a unique source record and matching form fields.
const WRITES_ENABLED = true;
chrome.action.onClicked.addListener(async tab=>{
 if(!tab.url?.startsWith('https://ehall.bit.edu.cn/EIP/')){await chrome.action.setBadgeText({text:'原站'});return;}
 await chrome.storage.session.set({sourceTabId:tab.id});await chrome.action.setBadgeText({text:''});await chrome.tabs.create({url:chrome.runtime.getURL('index.html')});
});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function run(command){
 const {sourceTabId}=await chrome.storage.session.get('sourceTabId');if(!sourceTabId)throw Error('请先在已登录的学校页面点击扩展图标建立连接。');
 let result;try{result=await Promise.race([chrome.scripting.executeScript({target:{tabId:sourceTabId,allFrames:true},world:'MAIN',func:sourceAction,args:[command]}),pause(8000).then(()=>({timeout:true}))]);}catch(e){if(/Cannot access contents|must request permission|No tab with id|tab was closed/i.test(e.message||'')){await chrome.storage.session.remove('sourceTabId');throw Error('原站连接或临时访问授权已失效。请切回已登录的学校页面，点击工具栏红色飞鸿图标，使用新打开的工作台；仅刷新本页不能恢复授权。');}throw e;}
 if(result.timeout)return [{timeout:true,command:command.type}];
 return result.map(r=>r.result).filter(Boolean);
}
async function navigate(kind){const out=await run({type:'navigate',kind});if(out.some(r=>r.timeout))throw Error('原站页面无响应（8秒），已停止本次操作；原站尚未提交。');const fail=out.find(r=>r.error);if(fail)throw Error(fail.error);}
async function formActive(){try{const out=await run({type:'formActive'});return out.some(r=>r&&r.formActive);}catch{return false;}}
// 门户标签必须真的切到“物流状态调整单”，否则填单号/提交都发生在看不见的旧页面上
async function ensureFormActive(stage){
 for(let i=0;i<12;i++){
  try{await run({type:'navigate',kind:'form',force:true});}catch{}
  if(await formActive())return true;
  if(stage)stage('正在切到“物流状态调整单”标签…');
  await pause(120);
 }
 throw Error('门户没有切到「物流状态调整单」（一直停在别的标签），本单未提交，已跳过。');
}
async function waitSnapshot(kind,predicate=()=>true,label='原站列表',flowTab,budget=60000){const end=Date.now()+budget;let last;while(Date.now()<end){const out=await run({type:'snapshot',kind,flowTab});if(out.some(r=>r.timeout)){await pause(250);continue;}const error=out.find(r=>r.error);if(error)throw Error(error.error);let results=out.filter(r=>r.rows);if(results.length>1&&kind==='flow'){const pref=results.filter(r=>flowTab&&r.active===flowTab);results=pref.length?pref:[results[0]];}else if(results.length>1)throw Error('发现多个候选列表，停止读取。');if(results.length){last=results[0];if(predicate(last))return last;}if(kind==='flow')flowStage(label+'：'+describeFlow(out)+(last?'；未就绪：'+notReady(last):''));await pause(200);}throw Error(label+'仍未完成加载（等待60秒；页码 '+(last?.page??'未知')+'，总数 '+(last?.total??'未知')+'）。已读取部分不算完整结果。');}
async function snapshot(kind,flowTab){return waitSnapshot(kind,s=>kind!=='flow'||!flowTab||s.active===flowTab,'原站列表',flowTab);}
function pageReady(s,page){if(s.page!==page||!s.pageSize||!Number.isInteger(s.total))return false;const expected=Math.max(0,Math.min(s.pageSize,s.total-(page-1)*s.pageSize));const seq=s.headers.findIndex(h=>h.replace(/\s/g,'')==='序号');return s.rows.length===expected&&(s.kind==='flow'||seq<0||s.rows.every((r,i)=>Number(r[seq])===(page-1)*s.pageSize+i+1));}
async function readPage(direction,kind='query',flowTab){await snapshot(kind);const moved=await waitSource({type:'page',direction,kind,flowTab},'pageRequested','原站翻页入口未就绪');const s=await waitSnapshot(kind,s=>pageReady(s,moved.pageRequested)&&(moved.unchanged||(s.probeToken===moved.token&&s.probeSettled)),'原站第'+moved.pageRequested+'页',flowTab);return kind==='flow'?{...s,flowTab}:s;}
async function formOrder(id){
 const readPortal=async()=>{const out=await run({type:'portalState'});const found=out.filter(r=>Array.isArray(r.tabs));if(found.length!==1)throw Error('未唯一识别门户页面，无法读取原站状态。');return found[0];};
 let portal=await readPortal();
 if(!portal.service)throw Error('原站未打开“京工飞鸿两校快件系统”标签。');
 let reuseTab=false;
 if(portal.forms>0){await pause(1500);portal=await readPortal();}
 if(portal.forms>0){await waitSaved();portal=await readPortal();}
 for(let i=0;i<4&&portal.forms>0;i++){await run({type:'closeFormTab'}).catch(()=>{});await pause(500);portal=await readPortal();}
 if(portal.forms>0)reuseTab=true;
 if(!reuseTab){
  await navigate('service');
  await waitSource({type:'openForm'},'openRequested','原站物流状态调整单入口未加载完成');
 }
 await waitSource({type:'navigate',kind:'form'},'navigated','原站状态表单标签未出现');
 await waitSource({type:'prepare',order:{id}},'prepared','原站状态表单未加载完成');
 const end=Date.now()+40000;let last=null;
 while(Date.now()<end){
  const out=await run({type:'readForm'});const bad=out.find(r=>r.error);if(bad)throw Error(bad.error);
  const f=out.find(r=>r&&r.fields);
  if(f){last=f;const vals=Object.values(f.fields);if(f.dh===id&&f.current&&vals.every(v=>v))break;}
  await pause(250);
 }
 // 收尾：等门户自己关标签；关不掉就留着，下次直接复用（下一次会先等它自关）
 try{
  const closeEnd=Date.now()+2000;
  while(Date.now()<closeEnd){
   const st=(await run({type:'portalState'})).filter(r=>Array.isArray(r.tabs))[0];
   if(!st||st.forms===0)break;
   await pause(300);
  }
 }catch{}
 if(!last)throw Error('未能读取原站调整单内容。');
 if(last.dh!==id)throw Error('原站调整单单号未生效（当前“'+last.dh+'”），未读取到状态。');
 if(!SourceMapping.statuses.includes(last.current))throw Error('原站当前物流状态无法识别：'+(last.current||'空'));
 const F=last.fields;
 return {id,status:last.current,sender:F.JJRXM,personId:F.JJRGH,phone:F.JJRDH,fromCampus:F.JJDZXQ,building:F.JJDZYL,room:F.JJDZFJH,receiver:F.SJRXM,receiverPhone:F.SJRDH,toCampus:F.SJXQDZ,destinationBuilding:F.SJDZYL,destinationRoom:F.SJDZFJH,duplicateOrder:false};
}

async function framePaths(){try{const out=await run({type:'frameReport'});return out.filter(r=>r&&r.path).map(r=>r.path);}catch{return [];}}
let flowCancelled=false;
let lastFlowSwitch='';
// —— 第 0 级诊断：把流程读取的每一步写进进度条和「诊断」，只报告，不改变任何点击、等待和判断 ——
let flowT0=0,flowTrace=[];
function flowBegin(label){flowT0=Date.now();flowTrace=[];flowStage(label);}
function flowStage(text){
 try{
  const sec=((Date.now()-(flowT0||Date.now()))/1000).toFixed(1);
  const last=flowTrace[flowTrace.length-1];
  if(last&&last.text===text)last.n++;else{flowTrace.push({sec,text,n:1});if(flowTrace.length>80)flowTrace.shift();}
  chrome.runtime.sendMessage({type:'flowStage',text:text+'（已 '+sec+' 秒）'}).catch(()=>{});
 }catch{}
}
// 门户页面文件名 → 中文名（界面与提示一律显示中文；认不出的显示“其他页面”）
const PAGE_NAMES={'framework.htm':'门户外壳','opencooperative.htm':'办理页外壳','h8jpsdrafk3yxn3mdxt3dbgkekzxxiwt.htm':'京工飞鸿业务介绍页','3c9e2b168f194a628014fa4dd672971e.htm':'物流状态调整单','queryresult.htm':'快件查询结果页','todolist.htm':'待办列表','havetodolist.htm':'已办列表','makecopelist.htm':'抄送列表','printcooperative.htm':'打印页'};
function pageName(p){const f=String(p||'').split('/').pop().toLowerCase();return PAGE_NAMES[f]||'其他页面';}
function describeFlow(out){
 const tail=pageName;
 const parts=(out||[]).map(r=>!r?'':r.timeout?'原站无响应（8秒）':r.error?'错误：'+r.error:r.rows?tail(r.path)+' '+r.rows.length+' 行/共 '+(r.total??'?')+' 条/第 '+(r.page??'?')+' 页'+(r.active?'/识别为'+r.active:''):r.hiddenFrame?tail(r.path)+' 被隐藏':r.waiting?tail(r.path)+' '+(r.why||'等待中'):'').filter(Boolean);
 return parts.length?parts.join('；'):'没有任何流程列表帧响应';
}
function notReady(s){return '第 '+s.page+' 页，'+s.rows.length+' 行，每页 '+(s.pageSize??'?')+'，共 '+(s.total??'?')+(s.probeToken?'，刷新信号'+(s.probeSettled?'已到':'未到'):'');}
// —— v0.9.178：按“哪张分类列表页正在显示”判断（现场诊断确认 toDoList=待办、haveToDoList=已办、makeCopeList=抄送给我）——
async function flowWhere(){try{return (await run({type:'flowWhere'})).filter(r=>r&&r.flowWhere);}catch{return [];}}
const whereKnown=w=>w.length>0&&w.some(x=>x.visible===true||x.visible===false);
const whereShowing=w=>(w.find(x=>x.visible)||{}).tab||'';
const whereText=w=>w.map(x=>pageName(x.file)+(x.visible?' 显示中':' 隐藏')).join('；');
async function openFlowPage(){
 const where=await flowWhere();
 if(whereKnown(where)){
  flowStage('检查流程页：'+whereText(where));
  if(whereShowing(where))return true;
  // 三张分类页都隐藏 = 门户停在别的标签（如快件查询）：切回【流程】标签，等任一分类页显示
  flowStage('流程页没有显示，点门户【流程】标签');
  await navigate('flow');
  const end=Date.now()+25000;
  while(Date.now()<end){
   if(flowCancelled)throw Error('已停止读取流程。');
   await pause(500);
   const w=await flowWhere();
   if(whereShowing(w)){flowStage('检查流程页：'+whereText(w));return true;}
  }
  flowStage('点了【流程】标签 25 秒，分类列表页仍没有显示');
  return false;
 }
 // 认不出分类页显示状态时，沿用原来的判断方式
 const probe=async()=>{try{const out=await run({type:'snapshot',kind:'flow'});flowStage('检查流程列表：'+describeFlow(out));return out.some(r=>r&&r.rows);}catch(e){flowStage('检查流程列表出错：'+e.message);return false;}};
 if(await probe())return true;
 flowStage('没读到流程列表行，点门户【流程】标签');
 await navigate('flow');
 const end=Date.now()+25000;
 while(Date.now()<end){
  if(flowCancelled)throw Error('已停止读取流程。');
  await pause(500);
  if(await probe())return true;
 }
 flowStage('等了 25 秒仍没读到流程列表行，继续下一步');
 return false;
}
async function ensureFlowTab(flowTab){
 if(flowCancelled)throw Error('已停止读取流程。');
 await openFlowPage();
 const where=await flowWhere();
 if(whereKnown(where)){
  // 已经显示目标分类页：不点。否则像人工一样点一次就等，5 秒仍没切过去才补点，最多 3 次。
  if(whereShowing(where)===flowTab){flowStage('切到「'+flowTab+'」：已在该分类（'+whereText(where)+'）');return true;}
  let clicks=0,lastClick=0,w=where;const end=Date.now()+20000;
  while(Date.now()<end){
   if(flowCancelled)throw Error('已停止读取流程。');
   if(clicks<3&&(!clicks||Date.now()-lastClick>=5000)){
    const out=await run({type:'flowTab',flowTab,force:true});clicks++;lastClick=Date.now();
    flowStage('切到「'+flowTab+'」：'+(out.some(r=>r.clicked)?'点了「'+flowTab+'」（第 '+clicks+' 次）':out.some(r=>r.candidates===0)?'没找到「'+flowTab+'」按钮':out.some(r=>r.timeout)?'原站无响应（8秒）':'未点到')+'；当前显示「'+(whereShowing(w)||'无')+'」');
   }
   await pause(300);
   w=await flowWhere();
   if(whereShowing(w)===flowTab){flowStage('切到「'+flowTab+'」：已切换（'+whereText(w)+'）');return true;}
  }
  flowStage('点了 '+clicks+' 次，20 秒内「'+flowTab+'」仍没有显示（当前显示「'+(whereShowing(w)||'无')+'」）');
  return false;
 }
 // 认不出分类页显示状态时，沿用原来的样式判断方式
 const click=async()=>{
  const out=await run({type:'flowTab',flowTab});
  const states=out.filter(r=>r.active!==undefined).map(r=>r.active||'未识别').join('、');
  if(states)lastFlowSwitch='各帧激活 '+states;
  flowStage('切到「'+flowTab+'」：'+(out.some(r=>r.flowSelected)?'已在该分类':out.some(r=>r.clicked)?'点了「'+flowTab+'」，等待切换':out.some(r=>r.candidates===0)?'没找到「'+flowTab+'」按钮':out.some(r=>r.timeout)?'原站无响应（8秒）':'未确认')+(states?'；识别到 '+states:''));
  return out.some(r=>r.flowSelected);
 };
 if(await click())return true;
 await pause(1200);
 if(await click())return true;
 // 确实不在流程页时才切过去
 flowStage('两次都没确认切到「'+flowTab+'」，点门户【流程】标签后反复重试（最多 20 秒）');
 await navigate('flow');
 const end=Date.now()+20000;
 while(Date.now()<end){
  if(flowCancelled)throw Error('已停止读取流程。');
  if(await click())return true;
  await pause(600);
 }
 flowStage('20 秒内没确认切到「'+flowTab+'」，按当前列表继续读取');
 return false;
}
// 读到的列表必须来自目标分类页，否则不把别的分类的数据记成这个分类
function checkFlowPage(s,flowTab){if(s&&s.pathTab&&s.pathTab!==flowTab)throw Error('原站当前显示的是「'+s.pathTab+'」，不是「'+flowTab+'」，未读取（以免把「'+s.pathTab+'」的数据记成「'+flowTab+'」）。请稍后再读一次，或在原站手动点一下「'+flowTab+'」。');}
async function flowFirst(flowTab){
 await ensureFlowTab(flowTab);
 flowStage('回到第 1 页并核对行数');
 const first=await readPage('first','flow',flowTab);
 checkFlowPage(first,flowTab);
 return {...first,flowTab,pageCount:first.total>0?Math.max(1,Math.ceil(first.total/first.pageSize)):1};
}
let preparedWrite=null,writeGeneration=0;
// 原站是否正在“加载中”（点「确定」后保存期间整页蒙灰；v0.9.178 现场截图）
// 诊断：本单点了几次「确定」、间隔多久、浏览器网络请求记录有多少条（满 250 条时“已点过就别再点”的判断会失效）
async function pressNote(token){try{const p=(await run({type:'pressInfo',token})).find(r=>r&&r.pressInfo);if(!p)return '';if(!p.count)return '没有记录到点「确定」';return '点「确定」'+p.count+' 次'+(p.gaps&&p.gaps.length?'（间隔 '+p.gaps.join('、')+' 秒）':'')+(p.mini?'，含一次控件点击事件':'')+'；浏览器网络请求记录 '+p.buf+' 条'+(p.buf>=250?'（已满 250 条，“已点过就别再点”的判断失效）':'');}catch{return '';}}
async function portalSaving(){try{return (await run({type:'portalBusy'})).some(r=>r&&r.busy);}catch{return false;}}
// 点「确定」后像人工一样等：每轮 15 秒找“提交成功”或标签自动关闭；原站仍在“加载中”就继续等（最长 90 秒），
// 期间不回查、不重试、不关标签。超过 90 秒仍在加载：报结果不明，不自动重试。
async function confirmPatiently(command,label,onTick,alt,stage){
 const hardEnd=Date.now()+90000;
 while(true){
  try{return await waitSource(command,'confirmed',label,undefined,onTick,15000,alt);}
  catch(e){
   if(!/（已等待\d+秒/.test(e.message))throw e;
   if(!(await portalSaving()))throw e;
   if(Date.now()>=hardEnd){const x=Error('原站点「确定」后保存超过 90 秒仍在“加载中”，提交结果不明，勿重复提交；请等原站加载结束后到原站核对该单。');x.stillSaving=true;throw x;}
   if(stage)stage('原站正在保存（加载中…），继续等它完成');
  }
 }
}
// 遗留的调整单若还在“加载中”（上一单保存未完），先等它完成，绝不在保存中途关掉
async function waitSaved(stage,check){
 const end=Date.now()+90000;
 while(Date.now()<end&&await portalSaving()){if(check)check();if(stage)stage('上一单原站仍在保存（加载中…），等它完成后再继续…');await pause(250);}
 if(await portalSaving())throw Error('上一单原站保存超过 90 秒仍在“加载中”，本单未提交；请等原站加载结束后再继续。');
}
// 原站只有一套标签/表单：所有会驱动原站的操作在这里排队，一次只跑一个。
// 准备成功到提交之间（准备令牌有效期内）挡住其他工作台的操作，避免改动已核对的表单；
// 同一工作台自己按 准备→提交 串行，不挡（否则工作台刷新后会被自己的旧令牌卡 2 分钟）。
const PORTAL_OPS=new Set(['syncFlowStatus','statusPreflight','read','page','flowFirst','flowDate','bulkApprove','flowFirstPage','flowNextPage','flowNext','beginAll','prepare','submit','verify','revert','printDetail','statusOf','openFlow']);
let portalBusy='';
const writeHeld=(type,owner)=>!!preparedWrite&&Date.now()-preparedWrite.at<=120000&&type!=='submit'&&preparedWrite.owner!==owner;
// 持有令牌的工作台已关闭：令牌作废，不再挡别人
async function dropOrphanWrite(){const owner=preparedWrite&&preparedWrite.owner;if(owner===undefined||!chrome.tabs?.get)return;let alive=true;try{alive=!!(await chrome.tabs.get(owner));}catch{alive=false;}if(!alive&&preparedWrite&&preparedWrite.owner===owner)preparedWrite=null;}
async function withPortal(type,owner,fn){
 if(!PORTAL_OPS.has(type))return fn();
 const end=Date.now()+180000;
 while(portalBusy||writeHeld(type,owner)){
  if(!portalBusy)await dropOrphanWrite();
  if(!writeHeld(type,owner)&&!portalBusy)break;
  if(Date.now()>end)throw Error('原站正被另一项操作占用（'+(portalBusy||'改状态已核对、等待提交')+'），已等待 3 分钟，本次操作未执行。');
  await pause(200);
 }
 portalBusy=type;
 try{return await fn();}finally{portalBusy='';}
}
// 等调整单联动出这一单：单号一致、至少一个联系人已出、当前状态已勾选；没出就按 点空白→回车 补触发，共 3 次。
async function waitLinked(id,stage){
 const linked=async budget=>{const end=Date.now()+budget;while(Date.now()<end){const out=await run({type:'readForm'});const bad=out.find(r=>r&&r.error);if(bad)throw Error(bad.error);const f=out.find(r=>r&&r.fields);if(f&&f.dh===id&&f.current&&(f.fields.JJRXM||f.fields.SJRXM))return f;await pause(250);}return null;};
 for(let attempt=0;attempt<3;attempt++){
  if(attempt){await run({type:attempt===1?'pokeForm':'pressEnter'}).catch(()=>{});if(stage)stage('第 '+(attempt+1)+' 次触发联动（'+(attempt===1?'点空白':'回车')+'）…');}
  const f=await linked(4000);if(f)return f;
 }
 return null;
}
async function waitSource(command,flag,label,generation,onTick,budget=60000,alt){const end=Date.now()+budget;let detail='',holes=0,ticks=0,altTicks=0,seen=false,btn=-1,clicked=false,cdiag='',noToast=false;while(Date.now()<end){if(generation!==undefined&&generation!==writeGeneration)throw Error('已取消修改；原站尚未提交。');const out=await run(command);if(out.some(r=>r.timeout)){if(++holes>=4)throw Error('原站页面连续无响应（约30秒），已停止操作'+(generation!==undefined?'；原站尚未提交':'')+'。请检查原站是否卡在弹窗或加载中。');await pause(120);continue;}holes=0;const error=out.find(r=>r.error);if(error)throw Error(error.error);let done=out.filter(r=>r[flag]);if(done.length>1&&command.kind==='flow')done=[done[0]];else if(done.length>1)throw Error('发现多个匹配页面，停止操作。');if(done.length===1)return done[0];if(alt&&++altTicks%4===0){let ao=null;try{ao=await run(alt.command);}catch{}if(ao){const bad=ao.find(r=>r&&r.error&&/提交失败|保存失败|操作失败|系统错误|发生异常|不能提交/.test(r.error));if(bad)throw Error(bad.error);const good=ao.find(r=>r&&r[alt.flag]);if(good)return good;}}const hit=out.find(r=>r.seen!==undefined);if(hit){if(hit.seen)seen=true;if(hit.closedNoToast)noToast=true;if(typeof hit.buttons==='number')btn=hit.buttons;if(hit.clickedButOpen){clicked=true;if(hit.diag)cdiag=hit.diag;}}const miss=out.find(r=>r.mismatch);detail=miss?.mismatch?.join('、')||'';if(miss&&typeof miss.filled==='number')detail+=(detail?'；':'')+'已联动 '+miss.filled+'/12 个字段';if(onTick&&++ticks%20===0){try{await onTick(detail,miss);}catch{}}await pause(120);}throw Error(label+'（已等待'+Math.round(budget/1000)+'秒，'+(['confirmSubmit','submissionComplete'].includes(command.type)?'提交结果不明，勿重复提交':'未提交')+'）'+(command.type==='confirmSubmit'?(seen?(noToast?'；已点「确定」、确认框已关闭，但没有看到“提交成功”，调整单标签也没有自动关闭':clicked?'；已点击“确定”，但弹窗仍未关闭（'+(cdiag||'无诊断信息')+'）':'；弹窗已出现，但未识别到唯一的“确定”按钮（候选 '+btn+' 个）'):'；没有看到确认弹窗'):'')+(detail?'；未匹配字段：'+detail:['confirmSubmit','submissionComplete'].includes(command.type)?'；请人工回查原站状态。':'；请在原站打开物流状态调整单并确认字段出现后重试。'));}
async function clearQueryTags(){
 for(let i=0;i<8;i++){
  const out=await run({type:'clearTags'});const bad=out.find(r=>r.error);if(bad)throw Error(bad.error);
  const found=out.filter(r=>typeof r.active==='number');
  if(!found.length)return;
  if(found[0].active<=0)return;
  await pause(150);
 }
 throw Error('门户快捷标签未能全部清除，按单号回查会被旧条件干扰，已停止。');
}
async function queryOneRaw(id,{allowEmpty=false}={}){
 await navigate('query');
 await clearQueryTags();
 await waitSource({type:'queryField',id},'fieldSelected','原站单号查询字段未加载完成');
 const {token}=await waitSource({type:'queryOrder',id},'queryRequested','原站未能发起单号查询');
 const end=Date.now()+60000;while(Date.now()<end){const out=await run({type:'snapshot',kind:'query'});if(out.some(r=>r.timeout)){await pause(250);continue;}const error=out.find(r=>r.error);if(error)throw Error(error.error);const results=out.filter(r=>r.rows&&r.probeToken===token&&r.probeSettled);if(results.length>1)throw Error('原站存在多个查询页面');if(results.length===1){const s=results[0];if(s.total===0&&allowEmpty)return s;if(s.total!==1||s.rows.length!==1)throw Error('原站按单号查询命中 '+(s.total??'未知')+' 条，不是唯一一条，停止操作。'+(s.scope&&s.scope!=='沿用原站当前查询条件；当前页'?'；门户当前查询条件：'+s.scope:''));const orders=SourceMapping.normalize(s);if(orders[0].id!==id||orders[0].duplicateOrder)throw Error('回查单号不匹配或重复');return s;}await pause(250);}throw Error('原站按单号查询未完成，请人工核验。');
}
async function closeQueryPanel(){
 try{const out=await run({type:'closeQuery'});if(out.some(r=>r&&r.closed)){await pause(150);return true;}return false;}catch{return false;}
}
// 门户的条件查询会一直停在“查询条件”面板，查完必须点「关闭查询」回到列表（用户要求：任何查询完成都要关）
async function queryOne(id,opts){
 try{return await queryOneRaw(id,opts);}
 finally{try{await closeQueryPanel();}catch{}}
}
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
 if(sender.url!==chrome.runtime.getURL('index.html'))return;
 withPortal(msg.type,sender.tab?.id,async()=>{
   if(msg.type==='hello')return {version:COMPONENT_VERSION,recentRead:true,readOnly:!WRITES_ENABLED};
    if(msg.type==='pageFont'){
     const key='feihongPageFont';
     if(msg.action==='get'){
      try{const o=await chrome.storage.local.get(key);const px=Number(o&&o[key]);return {px:Number.isFinite(px)&&px>=10&&px<=26?px:null};}catch{return {px:null};}
     }
     if(msg.action==='set'){
      const px=Math.min(26,Math.max(10,Math.round(Number(msg.px)||14)));
      try{await chrome.storage.local.set({[key]:px});}catch{}
      return {px};
     }
     return {px:null};
    }
   if(['prepare','submit'].includes(msg.type)&&!FeiHongWritePolicy.allowed([msg.order]))throw Error('无效单号或重复记录，禁止提交。');
   if(!WRITES_ENABLED&&['prepare','submit'].includes(msg.type))throw Error('当前版本锁定为只读验收，不填写或提交物流调整表单。');
   if(msg.type==='read'){
    if(msg.kind==='flow'){
      // 读取当前页：不重新打开流程页，也不做查询，直接点分类后读当前列表
      flowBegin('读取当前页（'+msg.flowTab+'）');
      await openFlowPage();
      if(whereKnown(await flowWhere())){
       // 认得出分类页显示状态：确认目标分类页在显示再读（点一次就等，不连点）
       await ensureFlowTab(msg.flowTab);
       const snap=await snapshot('flow');
       checkFlowPage(snap,msg.flowTab);
       return {...snap,flowTab:msg.flowTab};
      }
      let ok=false;
      try{const out=await run({type:'flowTab',flowTab:msg.flowTab});ok=out.some(r=>r.flowSelected);flowStage('切到「'+msg.flowTab+'」：'+(ok?'已在该分类':out.some(r=>r.clicked)?'点了「'+msg.flowTab+'」，1.5 秒后直接读':'未确认，1.5 秒后直接读'));}catch(e){flowStage('切换分类出错：'+e.message);}
      if(!ok)await pause(1500);
      const snap=await snapshot('flow');
      return {...snap,flowTab:msg.flowTab};
    }
    await navigate(msg.kind);
    let snap=await snapshot(msg.kind);
    if(!snap||!Array.isArray(snap.rows)||snap.rows.length===0){
      await pause(900);
      try{snap=await snapshot(msg.kind);}catch{}
    }
    return snap;
    return await snapshot(msg.kind);
   }
   if(msg.type==='page'){if(!['next','prev','first'].includes(msg.direction))throw Error('无效分页方向');await navigate('query');return readPage(msg.direction);}
   if(msg.type==='cancelFlow'){flowCancelled=true;return {cancelled:true};}
   if(msg.type==='flowFirst'){flowCancelled=false;flowBegin('读取前 N 页（'+msg.flowTab+'）');return flowFirst(msg.flowTab);}
    if(msg.type==='flowDate'){
     if(msg.flowTab)await ensureFlowTab(msg.flowTab);
     let out=await run({type:'flowDate',from:msg.from,to:msg.to});
     if(out.some(r=>r.expanded)){
       await pause(600);
       out=await run({type:'flowDate',from:msg.from,to:msg.to});
     }
     const bad=out.find(r=>r.error);if(bad)throw Error(bad.error);
     const hit=out.find(r=>r.queried);
     if(!hit)throw Error('流程页没有接受日期条件（可能没有“发起日期”查询项）。');
     const before=String(hit.before||'');
     const end=Date.now()+8000;let changed=false,ids=before;
     while(Date.now()<end){
       await pause(400);
       const list=(await run({type:'flowRowIds'})).map(r=>r.ids).filter(v=>typeof v==='string');
       if(!list.length)continue;
       ids=list[0];
       if(ids!==before){changed=true;break;}
     }
     if(!changed){
       let dump='';
       try{const d2=(await run({type:'flowQueryDump'})).find(r=>r&&r.queryDump);
         if(d2)dump='；查询区：'+(d2.html||'（未取到）')+'；可点元素：'+d2.els.map(e=>e.tag+(e.cls?'['+e.cls+']':'')+'“'+e.t+'”').join(' / ');
       }catch{}
       throw Error('日期已填入，但流程列表 8 秒内没有刷新（没找到会触发查询的按钮，回车也未生效）'+dump);
     }
     await pause(300);
     return {applied:true,via:hit.via};
    }
   if(msg.type==='bulkApprove'){
    if(!Array.isArray(msg.ids)||!msg.ids.length)throw Error('没有选中任何单号。');
    const action=msg.action==='reject'?'退回':'通过';
    let step='切换分类';
    try{
     const ok=await ensureFlowTab('待办');
     if(!ok)throw Error('未能在门户切到“待办”');
     step='等待列表出现';
     let listed=false;try{await waitSnapshot('flow',s=>Array.isArray(s.rows)&&s.rows.length>0,'原站待办列表','待办',15000);listed=true;}catch{}
     if(!listed)throw Error('原站“待办”列表 15 秒内没有出现');
     await pause(400);
     step='清空原站勾选';
     await run({type:'flowClearSelection'});
     step='勾选单据';
      for(const item of (msg.items&&msg.items.length?msg.items:msg.ids.map(id=>({id,index:0})))){
       const id=item.id;
       let ok=false,last='',lastOut=[];
       for(let attempt=0;attempt<3&&!ok;attempt++){
        const out=await run({type:'flowSelect',id,index:item.index||0});
        lastOut=out;
        ok=out.some(r=>r.selected);
        if(!ok){const bad=out.find(r=>r.error);const sm=out.find(r=>r.sample);last=bad?bad.error:(sm&&sm.sample&&sm.sample.length?('列表样例：'+sm.sample.join(' / ')):'原站列表暂无行');if(bad&&/匹配到 \d+ 行/.test(bad.error))break;await pause(700);}
       }
       const found=lastOut.some(r=>r.found);
       if(!ok)throw Error('没有勾上 '+id+(item.index?('（第 '+item.index+' 行）'):'')+'：'+(found?('行已找到但勾选状态未变化（遮罩'+lastOut.filter(r=>r.hasMask).length+'/输入框'+lastOut.filter(r=>r.hasInput).length+'）'):(last||'原站列表暂无行')));
      }
     step='核对勾选数量';
     await pause(600);
     const cnt=await run({type:'flowCheckedCount'});
     const counts=cnt.map(r=>r.checked).filter(v=>typeof v==='number');
     const n=counts.length?Math.max(...counts):null;
     if(n!==msg.ids.length)throw Error('原站勾选 '+(n??'未知')+' 个，应为 '+msg.ids.length+' 个');
     step='点“批量处理”';
     const tb=await run({type:'flowToolbar',label:'批量处理'});
     if(!tb.some(r=>r.clicked))throw Error('没有找到“批量处理”按钮');
     await pause(900);
     step='点“'+action+'”';
     await run({type:'dialogMark'}).catch(()=>{});
     const menu=await run({type:'flowMenu',label:action});
     if(!menu.some(r=>r.clicked))throw Error('“批量处理”菜单里没有“'+action+'”');
     await pause(1200);
     step='确认弹窗';
     let confirmed=false;const end=Date.now()+8000;
     while(Date.now()<end){
      const c=await run({type:'flowDialogOk'});
      if(c.some(r=>r.ok)){confirmed=true;break;}
      await pause(400);
     }
     return {count:msg.ids.length,action,confirmed,step:'完成'};
    }catch(err){
     const e=Error('批量'+action+'停在「'+step+'」：'+err.message);
     e.step=step;
     throw e;
    }
   }
   if(msg.type==='flowFirstPage'){
    const out=await run({type:'flowFirstPage'});
    const bad=out.find(r=>r.error);if(bad)throw Error(bad.error);
    await pause(600);
    return {done:true,atFirst:out.some(r=>r.atFirst)};
   }
   if(msg.type==='flowNextPage'){
    flowStage('点「下一页」');
    const out=await run({type:'flowNext'});
    const bad=out.find(r=>r.error);if(bad)throw Error(bad.error);
    if(out.some(r=>r.atEnd))return {atEnd:true};
    const clicked=out.find(r=>r.clicked);if(!clicked)throw Error('原站“下一页”不可用。');
    const end=Date.now()+8000;
    while(Date.now()<end){
     await pause(350);
     const s=await snapshot('flow');
     if(s&&s.rowIds&&s.rowIds.join(',')!==clicked.before)return {...s,flowTab:msg.flowTab};
    }
    const s=await snapshot('flow');
    return {...s,flowTab:msg.flowTab,stale:true};
   }
   if(msg.type==='flowNext')return readPage('next','flow',msg.flowTab);
   if(msg.type==='endRead')return {ended:true};
   if(msg.type==='beginAll'){
     const stage=text=>chrome.runtime.sendMessage({type:'readStage',readId:msg.readId,text}).catch(()=>{});
     stage('正在打开原站查询并设置每页条数…');
     await navigate('query');
     let qFrames=[];const qEnd=Date.now()+8000;
     do{qFrames=await framePaths();if(qFrames.some(p=>p.endsWith('/queryResult.htm')))break;await pause(300);}while(Date.now()<qEnd);
     if(!qFrames.some(p=>p.endsWith('/queryResult.htm')))throw Error('门户里没有“快件查询”结果页（当前页面：'+(qFrames.map(pageName).join('、')||'未取到')+'）。请在该标签里点一次“查询”，或刷新门户页后重新点击飞鸿图标连接。');
     try{await snapshot('query');}catch(e){throw Error(e.message+'；当前页面：'+((await framePaths()).map(pageName).join('、')||'未取到'));}
     const range=msg.range||FeiHongDates.recentMonth();
     if(!/^\d{4}-\d{2}-\d{2}$/.test(range.from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(range.to||'')||!/^\d{4}-\d{2}-\d{2}$/.test(range.endExclusive||'')||range.from>range.to||range.to>=range.endExclusive)throw Error('读取起止日期无效。');
     stage('正在设置下单日期：'+range.from+' 至 '+range.to+'…');
     let selected=false,selStep='',selStart=Date.now(),lastSay=0;const selEnd=Date.now()+60000;
     while(Date.now()<selEnd){
       const out=await run({type:'queryDateField'});const error=out.find(r=>r.error);if(error)throw Error(error.error);
       if(out.some(r=>r.fieldSelected)){selected=true;break;}
       const w=out.find(r=>r.step);if(w)selStep=w.step;
       if(Date.now()-lastSay>3000){lastSay=Date.now();stage('正在准备下单日期条件：'+(selStep||'等待查询页响应')+'（已 '+Math.round((Date.now()-selStart)/1000)+' 秒）');}
       await pause(150);
     }
     if(!selected)throw Error('原站高级查询控件未加载（60秒：'+(selStep||'未取到页面状态')+'）；请确认门户“快件查询”页仍登录、高级查询区域可展开。');
     let token,lastStep='';const setEnd=Date.now()+60000;
     while(Date.now()<setEnd){
       const out=await run({type:'queryRecent',from:range.from,endExclusive:range.endExclusive});const error=out.find(r=>r.error);if(error)throw Error(error.error);
       const done=out.find(r=>r.queryRequested);if(done){token=done.token;break;}
       const w=out.find(r=>r.step);if(w)lastStep=w.step+(w.value!==undefined?'，当前值“'+w.value+'”':'');
       await pause(150);
     }
     stage(lastStep?'日期条件尚未生效：'+lastStep:'日期条件已填入，等待原站返回查询总数…');
     if(!token)throw Error('未能在原站设置所选下单时间范围'+(lastStep?'（停在'+lastStep+'）':'')+'；请确认门户“快件查询”页仍处于登录状态、高级查询区域可见。');
     await waitSnapshot('query',s=>s.probeToken===token&&s.probeSettled,'日期查询');
     stage('日期查询已完成，正在设置并核对每页条数…');
     const sizeEnd=Date.now()+60000;let size;
     while(Date.now()<sizeEnd){const out=await run({type:'pageSize'}),error=out.find(r=>r.error);if(error)throw Error(error.error);size=out.find(r=>r.pageSizeSelected||r.pageSizeUnchanged);if(size)break;await pause(200);}
     if(!size)throw Error('每页条数控件未就绪，未开始翻页');
     if(size.pageSizeSelected)await waitSnapshot('query',s=>s.pageSize===size.requestedSize&&s.probeToken===size.token&&s.probeSettled,'每页条数刷新');
     stage('查询和每页条数已就绪，正在核对首页…');
     const first=await readPage('first');return {...first,dateRange:range,scope:'下单时间 '+range.from+' 至 '+range.to+'，所有物流状态'};
   }
    if(msg.type==='syncFlowStatus'){
 const ids=Array.isArray(msg.ids)?msg.ids.filter(x=>/^JGKD\d+$/.test(x)).slice(0,300):[];
 // 回查前先关掉“物流状态调整单”等没用的页面，避免影响查询
 {const out=await run({type:'portalState'});const portal=out.filter(r=>Array.isArray(r.tabs))[0];
  if(!portal||!portal.service)throw Error('原站没有打开“京工飞鸿两校快件系统”标签，无法回查。');
  for(let i=0;i<3&&portal.forms>0;i++){try{await run({type:'closeFormTab'});}catch{}await pause(120);const p2=(await run({type:'portalState'})).filter(r=>Array.isArray(r.tabs))[0];if(p2)portal=p2;}
 }
 const statuses={};
 try{
  await navigate('query');
  try{await clearQueryTags();}catch{}
  for(let i=0;i<ids.length;i++){
   const id=ids[i];
   try{
    await waitSource({type:'queryField',id},'fieldSelected','原站单号查询字段未加载完成');
    const {token}=await waitSource({type:'queryOrder',id},'queryRequested','原站未能发起单号查询');
    const end=Date.now()+60000;
    while(Date.now()<end){
     const out=await run({type:'snapshot',kind:'query'});
     if(out.some(r=>r.timeout)){await pause(250);continue;}
     const error=out.find(r=>r.error);if(error)throw Error(error.error);
     const results=out.filter(r=>r.rows&&r.probeToken===token&&r.probeSettled);
     if(results.length===1){const s=results[0];if(s.total===1){const st=(SourceMapping.normalize(s)[0]||{}).status;if(st)statuses[id]=st;}break;}
     await pause(200);
    }
   }catch{}
   try{chrome.runtime.sendMessage({type:'statusSync',done:i+1,total:ids.length,id,status:statuses[id]||''});}catch{}
  }
 }finally{
  // 批量全部查完，最后统一“先点红色错号、再点关闭查询”
  try{await closeQueryPanel();}catch{}
 }
 return {statuses,total:ids.length,done:Object.keys(statuses).length};
}
if(msg.type==='statusPreflight'){
     const readPortal=async()=>{const out=await run({type:'portalState'});const found=out.filter(r=>Array.isArray(r.tabs));if(found.length!==1)throw Error('未唯一识别门户页面，无法读取原站状态。');return found[0];};
     let portal=await readPortal();
     if(!portal.service)throw Error('原站没有打开“京工飞鸿两校快件系统”标签。请先在门户打开它（点一次办理入口即可），再开始批量修改。');
     let closed=0;
     for(let i=0;i<3&&portal.forms>0;i++){
      try{await run({type:'closeFormTab'});}catch{}
      await pause(120);
      const before=portal.forms;
      portal=await readPortal();
      closed+=Math.max(0,before-portal.forms);
     }
     return {service:true,closed,forms:portal.forms};
    }
   if(msg.type==='cancelWrite'){preparedWrite=null;writeGeneration++;return {cancelled:true};}
    if(msg.type==='prepare'){
     preparedWrite=null;const generation=++writeGeneration;
     const stage=text=>chrome.runtime.sendMessage({type:'writeStage',text}).catch(()=>{});
     const check=()=>{if(generation!==writeGeneration)throw Error('已取消修改；原站尚未提交。');};
     const T0=Date.now(),timing={},mark=k=>{timing[k]=Date.now()-T0;};
     const inventory=async()=>{try{const out=await run({type:'frameReport'});const rows=out.filter(r=>r&&r.path);return rows.map(r=>pageName(r.path)+'（'+(r.ready==='complete'?'已加载':'加载中')+(r.dh?'，有单号框':'')+(r.radios?'，'+r.radios+' 个单选':'')+'）').join('、');}catch{return '';}};
     stage('检查门户标签…');
     const readPortal=async()=>{const out=await run({type:'portalState'});const bad=out.find(r=>r.error);if(bad)throw Error(bad.error);if(out.some(r=>r.timeout))throw Error('原站门户页面无响应（8秒），未开始核对；原站尚未提交。');const found=out.filter(r=>Array.isArray(r.tabs));if(found.length!==1)throw Error('未唯一识别门户页面，无法核对门户标签；请确认原站停在同一门户页。');return found[0];};
     let portal=await readPortal();check();
     if(!portal.service)throw Error('原站未打开“京工飞鸿两校快件系统”标签，请先打开该业务标签。');
     let reuse=false;
     const preAlert=(await run({type:'formAlert'}).catch(()=>[])).find(r=>r&&r.alert);
     if(preAlert)stage('已关闭上一单残留的门户提示：'+preAlert.alert.slice(0,40));
     // v0.9.196：加载中只等不关（关掉会中断保存、把门户卡在加载中）；保存结束后再关，最多 3 次
     if(portal.forms>0&&await portalSaving()){
       stage('上一单仍在保存，等它结束（不关标签）…');
       await waitSaved(stage,check);
       portal=await readPortal();
     }
     for(let i=0;i<3&&portal.forms>0;i++){
       stage('关闭残留的调整单标签（'+portal.forms+' 张）…');
       try{await run({type:'closeFormTab'});}catch{}
       check();
       await pause(120);
       portal=await readPortal();
     }
     if(portal.forms>0){
       // 关不掉但门户不在保存：直接沿用这张标签继续（不中断整批）
       stage('残留的调整单标签关不掉，沿用现有标签继续…');
       reuse=true;
     }
           // v0.9.197：残留确认框点两次（间隔 200ms）；仍关不掉就跳过本单，不再空等 2 分钟
      for(let t=0;t<2;t++){
        const left=(await run({type:'confirmResidue'}).catch(()=>[])).reduce((m,r)=>Math.max(m,(r&&r.residue)||0),0);
        if(!left)break;
        stage('清理上一次遗留的确认框…');
        try{await run({type:'confirmDismiss'});}catch{}
        await pause(200);
        if(t===1)throw Error('原站残留的“您确定要提交吗”确认框关不掉；本单已跳过，不影响后续单，可稍后手动处理。');
      }
mark('portal');
     if(reuse){
       stage('切换到现有调整单标签…');
       await ensureFormActive(stage);
     }else{
       stage('打开业务介绍页的办理入口…');
       await navigate('service');
       await waitSource({type:'openForm'},'openRequested','原站物流状态调整办理入口未加载完成',generation);
     }
     stage('等待“物流状态调整单”标签出现…');
     try{await waitSource({type:'navigate',kind:'form'},'navigated','原站状态表单标签未出现',generation);}
     catch(e){const inv=await inventory();throw Error(e.message+(inv?'；原站页面：'+inv:''));}
     mark('form');
     await ensureFormActive(stage);
     try{await closeQueryPanel();}catch{}
     stage('等待识别调整单输入框（最多 10 秒，尚未填写单号）…');
     try{await waitSource({type:'prepare',order:msg.order},'prepared','未能识别或准备物流调整单输入控件；尚未完成单号填写，不代表单号无效',generation,undefined,10000);}
     catch(e){const inv=await inventory();let tabs='';try{const p2=await readPortal();tabs='；调整单标签 '+(p2.forms??'?')+' 张'+(p2.formActive?'（活动）':'');}catch{}throw Error(e.message+(inv?'；原站页面：'+inv:'')+tabs+(/未加载完成/.test(e.message)?'。若“物流状态调整单”标签已经消失，说明原站打开后又关闭了该表单，请看门户页面的提示。':''));}
     // 回车后没联动出订单信息时，每 1 秒补按一次回车，最多再补两次（共 3 次），仍无则跳过本单
           let matched=false,lastErr=null,names=null,freshRetry=false,attempt=0;
      while(attempt<3&&!matched){
       if(attempt){
        await pause(250);
        const al=(await run({type:'formAlert'}).catch(()=>[])).find(r=>r&&r.alert);
        if(al){try{await run({type:'closeFormTab'});}catch{}throw Error('原站提示「'+al.alert+'」；本单未提交，已跳过并继续下一单。');}
        if(attempt===1)await run({type:'pokeForm'}).catch(()=>{});
        else await run({type:'pressEnter'}).catch(()=>{});
        stage('第 '+(attempt+1)+' 次触发联动（'+(attempt===1?'点空白':'回车')+'），等待订单信息…');
       }else{
        stage('单号已回车，等待订单信息…');
       }
       try{
        const hit=await waitSource({type:'inspect',order:msg.order},'matched','触发联动后未出订单信息',generation,undefined,4000);
        matched=true;names=hit&&hit.names||null;mark('linked'+(attempt+1));
       }catch(e){
        // 沿用的旧标签表单里可能还留着别的单/旧状态：关掉重开一次再试（首单常见）
        if(/当前状态是「/.test(e.message)&&reuse&&!freshRetry){
         freshRetry=true;attempt=0;stage('旧标签里的表单状态与工作台不一致，关掉重开一次…');
         try{await run({type:'closeFormTab'});}catch{}
         await pause(200);
         await navigate('service');
         await waitSource({type:'openForm'},'openRequested','原站物流状态调整办理入口未加载完成',generation);
         await waitSource({type:'navigate',kind:'form'},'navigated','原站状态表单标签未出现',generation);
         await run({type:'navigate',kind:'form',force:true}).catch(()=>{});
         await waitSource({type:'prepare',order:msg.order},'prepared','未能识别或准备物流调整单输入控件；尚未完成单号填写，不代表单号无效',generation,undefined,10000);
         continue;
        }
        if(!/未联动|未出订单信息|未加载完成/.test(e.message))throw e;
        lastErr=e;
        stage('第 '+(attempt+1)+' 次回车后仍无订单信息…');
       }
       attempt++;
      }
     if(!matched){
       const al=(await run({type:'formAlert'}).catch(()=>[])).find(r=>r&&r.alert);
       try{await run({type:'closeFormTab'});}catch{}
       if(al)throw Error('原站提示「'+al.alert+'」；本单未提交，已跳过并继续下一单。');
       throw Error('单号 '+msg.order.id+' 连续 3 次触发联动（点空白/回车）仍未出订单信息；本单未提交，已跳过并继续下一单。');
     }
     check();
     // names 只用于记录“联动出的联系人与工作台是否一致”，本版本不据此拦截；timing 记录各阶段用时
     preparedWrite={order:msg.order,at:Date.now(),owner:sender.tab?.id};return {matched:true,names,timing};
    }
   if(msg.type==='submit'){
    if(!preparedWrite||preparedWrite.owner!==sender.tab?.id||Date.now()-preparedWrite.at>120000||SourceMapping.fingerprint(preparedWrite.order)!==SourceMapping.fingerprint(msg.order)||preparedWrite.order.status!==msg.order.status){preparedWrite=null;throw Error('提交准备已失效，请重新核对。');}
    preparedWrite=null;
    const stage=text=>chrome.runtime.sendMessage({type:'writeStage',text}).catch(()=>{});
    const T0=Date.now(),timing={},mark=k=>{timing[k]=Date.now()-T0;};
     await ensureFormActive(stage);
    await waitSource({type:'armSubmission',order:msg.order,target:msg.target},'armed','原站门户提交上下文未就绪');
    // 点提交前：各帧此刻看得见的“提交成功”标为旧的，之后只认点「确定」后新出现的
    let staleToast=0;try{staleToast=(await run({type:'toastMark'})).reduce((n,r)=>n+((r&&r.visible)||0),0);}catch{}
    const staleNote=staleToast?'；提交前页面上已有 '+staleToast+' 处“提交成功”字样（已忽略）':'';
    stage('正在点击原站提交…');
    const out=await run({type:'submit',order:msg.order,target:msg.target});const error=out.find(r=>r.error);if(error)throw Error(error.error);if(out.filter(r=>r.submitted).length!==1)throw Error('原站表单不匹配或提交结果不明，勿自动重试。');
    mark('clicked');
    const cs=Date.now(),confirmToken='c'+cs.toString(36)+Math.random().toString(36).slice(2,8);
    const confirmTick=async()=>{
     let tip='等待原站点“确定”';
     try{
      const ps=(await run({type:'confirmProbe'})).filter(r=>r&&typeof r.dialog==='number');
      const p=ps.find(r=>r.dialog>0)||ps[0];
      if(p&&p.dialog){
       tip=(p.off?'弹窗已出现，但「确定」按钮处于禁用状态：等它可用后自动点':
            p.noBtn?'弹窗已出现，但没找到可点的“确定”':
            p.clicked?'已点击“确定”但弹窗未关闭'+(p.diag?'（'+p.diag+'）':'')+'：扩展会继续等它关闭':
            '弹窗已出现，正在点击“确定”');
      }else{
       const st=(await run({type:'submissionStatus'})).filter(r=>r&&typeof r.forms==='number')[0];
       tip+=(st?(st.confirmOpen?'；弹窗已出现':'；弹窗尚未出现'):'；未取到门户状态');
      }
     }catch{tip+='；未取到弹窗状态';}
     stage(tip);
    };
    let confirmHit=null;
    try{confirmHit=await confirmPatiently({type:'confirmSubmit',order:msg.order,target:msg.target,token:confirmToken},'原站提交确认未完成',confirmTick,{command:{type:'submissionComplete',order:msg.order,target:msg.target,token:confirmToken},flag:'submissionComplete'},stage);}
    catch(e){
      if(/提示框连续点 3 次/.test(e.message)){try{await run({type:'closeFormTab'});}catch{}throw Error('提示框点了 3 次「确定」仍未关闭，已关闭“物流状态调整单”并跳过本单，继续下一单。');}
      if(e.stillSaving)throw Error(e.message+staleNote+'；'+(await pressNote(confirmToken)));
      if(/原站拒绝提交|原站提示.*未改成功/.test(e.message)){
        try{await run({type:'formAlert'});}catch{}
        throw Error(e.message);
      }
      stage('确认未返回，先清理残留确认框…');
      try{await run({type:'confirmDismiss'});}catch{}
      await pause(150);
      let extra='';try{const d=await run({type:'confirmDump'});extra=d.filter(r=>r&&r.confirmDump&&(r.has||r.boxes)).map(r=>r.path+':文本'+(r.has?'有':'无')+' 弹窗'+r.boxes+' 按钮['+(r.btns||[]).join('/')+']').join('；');}catch{}
      let open='';try{const g=await run({type:'confirmGone'});const o=g.find(r=>r&&r.html);if(o&&o.html)open='（弹窗仍在 '+o.html+'）';}catch{}
      // v0.9.199：不再跳回“快件查询”按单号回读（既慢又抢门户标签）；记结果不明，由下一单继续
      throw Error(e.message+(extra?'（'+extra+'）':'')+open+staleNote+'；本次不跳回“快件查询”回读，请稍后在历史里看结果或手动核对。');
    }
    mark('confirmed');
    // v0.9.196：成功口径 = 门户弹出“提交成功” 且 调整单标签自动关闭，两样都出现才算
    let sawToast=!!(confirmHit&&(confirmHit.via==='toast'||confirmHit.toast));
    let sawClosed=!!(confirmHit&&confirmHit.submissionComplete);
    let closedAt=sawClosed?Date.now():0;
    const sigEnd=Date.now()+15000;
    stage('等待门户完成：'+(sawToast?'已看到提交成功':'等提交成功')+'、'+(sawClosed?'标签已关':'等标签关闭'));
    while(Date.now()<sigEnd&&!(sawToast&&sawClosed)){
      await pause(120);
      if(!sawClosed){
        try{const st=(await run({type:'portalState'})).filter(r=>Array.isArray(r.tabs))[0];if(st&&st.forms===0){sawClosed=true;closedAt=Date.now();}}catch{}
      }
      if(!sawToast){
        try{const t=await run({type:'toastState'});if(t.some(r=>r&&r.toast))sawToast=true;}catch{}
      }
      if(sawClosed&&!sawToast&&Date.now()-closedAt>2000)break;
      const sec=Math.round((Date.now()-cs)/1000);
      stage('等待门户完成（'+sec+' 秒）：'+(sawToast?'已看到提交成功':'等提交成功')+'、'+(sawClosed?'标签已关':'等标签关闭'));
    }
    if(!(sawToast&&sawClosed)){
      throw Error('提交后没有同时出现“提交成功”和调整单自动关闭（'+(sawToast?'已看到提交成功':'未看到提交成功')+'、'+(sawClosed?'标签已关闭':'标签仍未关闭')+'）；本次记结果不明，已继续下一单，可稍后到原站核对。');
    }
    mark('settled');stage('已提交');
    return {submitted:true,confirmed:true,resubmitted:!!(confirmHit&&confirmHit.resubmitted),completion:'confirmed',timing,basis:'提交成功+调整单自动关闭',staleToast,presses:await pressNote(confirmToken)};
   }
   if(msg.type==='verify'){
    if(!/^JGKD\d+$/.test(msg.id||''))throw Error('无效回查单号');
    if(!SourceMapping.statuses.includes(msg.target))throw Error('无效核验目标状态');
    const end=Date.now()+60000;let last;do{const s=await queryOne(msg.id,{allowEmpty:true});last=s;if(s.total===1&&SourceMapping.normalize(s)[0].status===msg.target)return s;await pause(1500);}while(Date.now()<end);
    throw Error((last&&last.total===0?'原站按完整单号仍查不到该单（可能尚未生效或被门户查询条件限制），已停止。':'原站未回读到目标状态。')+'请人工核验，勿重复提交。');
   }
    if(msg.type==='revert'){
    if(!/^JGKD\d+$/.test(msg.id||''))throw Error('无效单号');
    if(!SourceMapping.statuses.includes(msg.from))throw Error('无效的原状态');
    // to = 上次改成的状态；原站现状必须仍是它才改回，否则说明之后被别人改过，不覆盖。
    if(!SourceMapping.statuses.includes(msg.to)||msg.to===msg.from)throw Error('这条记录缺少上次修改的目标状态，无法核对原站现状，未改回。');
    const stage=text=>chrome.runtime.sendMessage({type:'writeStage',text}).catch(()=>{});
    const readPortal=async()=>{const out=await run({type:'portalState'});const found=out.filter(r=>Array.isArray(r.tabs));if(found.length!==1)throw Error('未唯一识别门户页面，无法改回。');return found[0];};
    let portal=await readPortal();
    if(!portal.service)throw Error('原站未打开“京工飞鸿两校快件系统”标签，请先打开该业务标签。');
    if(portal.forms>0){await waitSaved(stage);portal=await readPortal();}
     for(let i=0;i<3&&portal.forms>0;i++){stage('关闭遗留的调整单标签…');try{await run({type:'closeFormTab'});}catch{}await pause(120);portal=await readPortal();}
     if(portal.forms>0)stage('遗留的调整单标签关不掉，沿用现有标签继续…');
    stage('打开业务介绍页的办理入口…');
    await navigate('service');
    await waitSource({type:'openForm'},'openRequested','原站物流状态调整办理入口未加载完成');
    stage('等待“物流状态调整单”标签出现…');
    await waitSource({type:'navigate',kind:'form'},'navigated','原站状态表单标签未出现');
    stage('填写完整单号并回车…');
     await ensureFormActive(stage);
    await waitSource({type:'prepare',order:{id:msg.id}},'prepared','原站状态表单未加载完成');
    stage('等待原站联动出订单信息…');
    // 新表单“当前状态”默认勾着第一项：必须等联系人联动出来，读到的才是这一单的真实状态。
    const linked=await waitLinked(msg.id,stage);
    if(!linked)throw Error('原站表单连续 3 次触发联动（点空白/回车）仍未出订单信息（单号 '+msg.id+'），未改回。');
    const cur=linked.current;
    if(cur===msg.from)return {already:true,current:cur};
    if(cur!==msg.to)throw Error('原站当前是「'+cur+'」，不是上次改成的「'+msg.to+'」，可能已被他人修改；为避免覆盖，未改回。');
    stage('选择目标状态并提交…');
    await waitSource({type:'armSubmission',order:{id:msg.id},target:msg.from},'armed','原站门户提交上下文未就绪');
    try{await run({type:'toastMark'});}catch{}
    const out=await run({type:'submitBare',order:{id:msg.id},target:msg.from,expect:msg.to});const bad=out.find(r=>r.error);if(bad)throw Error(bad.error);
    if(!out.some(r=>r.submitted))throw Error('原站表单不匹配或提交结果不明，未改回。');
    stage('等待原站点“确定”…');
    // 与批量改状态同一判据：点「确定」后新出现“提交成功”，或调整单标签自动关闭；都没有就报结果不明
    const rtoken='r'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    const hit=await confirmPatiently({type:'confirmSubmit',order:{id:msg.id},target:msg.from,token:rtoken},'原站提交确认未完成',undefined,{command:{type:'submissionComplete',order:{id:msg.id},target:msg.from,token:rtoken},flag:'submissionComplete'},stage);
    return {submitted:true,from:cur,to:msg.from,basis:hit&&hit.submissionComplete?'调整单标签已自动关闭':'看到“提交成功”'};
   }
   if(msg.type==='notices'){
    const out=await run({type:'notices'});
    const all=out.flatMap(r=>(r&&r.notices)||[]);
    const seen=new Set();const list=[];
    for(const n of all){const k=n.body+'|'+n.time;if(seen.has(k))continue;seen.add(k);list.push(n);}
    return {notices:list.slice(0,5)};
   }
   if(msg.type==='printDetail'){
    if(msg.flow)await ensureFlowTab(msg.flow);
    const tabsBefore=new Set((await chrome.tabs.query({currentWindow:true})).map(t=>t.id));
    const out=await run({type:'openDetail',id:msg.id});
    const bad=out.find(r=>r.error);if(bad)throw Error(bad.error);
    if(!out.some(r=>r.detailRequested))throw Error('未在流程列表里找到该单号所在行，请先切到对应分类并读取。');
    const {sourceTabId}=await chrome.storage.session.get('sourceTabId');
    await chrome.tabs.update(sourceTabId,{active:true});
    const end=Date.now()+25000;let ready=false;
    while(Date.now()<end){const o=await run({type:'detailFrame'});if(o.some(r=>r.detailFrame)){ready=true;break;}await pause(300);}
    if(!ready)throw Error('事项详情没有在 25 秒内出现，请检查原站标签后重试。');
    await pause(600);
    const p=await run({type:'detailPrint'});
    if(!p.some(r=>r.printRequested))throw Error('详情页没有识别到打印图标，请手动点右上角打印。');
    const end2=Date.now()+10000;let confirmed=false,lastStep='';
    while(Date.now()<end2){
     const c=await run({type:'printConfirm'});
     if(c.some(r=>r.confirmed)){confirmed=true;break;}
     const wait=c.find(r=>r.step);if(wait)lastStep=wait.step;
     await pause(300);
    }
    if(!confirmed)throw Error('已打开打印图标，但“选择打印内容”弹窗未确认'+(lastStep?'（'+lastStep+'）':'')+'，请手动点确定。');
    // 确认后会新开打印页标签：切过去，剩下的一下“打印”由你点
    const end3=Date.now()+12000;let newTab=null;
    while(Date.now()<end3){
     const list=await chrome.tabs.query({currentWindow:true});
     newTab=list.find(t=>!tabsBefore.has(t.id));
     if(newTab){await chrome.tabs.update(newTab.id,{active:true}).catch(()=>{});break;}
     await pause(400);
    }
    return {opened:true,newTab:!!newTab};
   }
   if(msg.type==='statusOf'){
          if(!/^JGKD\d+$/.test(msg.id||''))throw Error('无效单号');
const order=await formOrder(msg.id);
return {id:order.id,status:order.status,order};
    }
if(msg.type==='diagnose'){
    const portalOut=await run({type:'portalState'});
    const portal=portalOut.filter(r=>Array.isArray(r.tabs))[0]||null;
    const rowDumpOut=await run({type:'rowDump'});
    const rowDump=rowDumpOut.filter(r=>r&&r.rowDump);
    const flowOut=await run({type:'flowFrames'});
    const flowFrames=flowOut.filter(r=>r&&r.frame).map(f=>({path:f.path.split('/').pop(),name:pageName(f.path),total:f.total,count:f.count,first:f.first,size:f.size}));
    const flowDebugOut=await run({type:'flowDebug'});
    const flowDebug=flowDebugOut.filter(r=>r&&r.flowDebug).map(r=>({...r,name:pageName(r.path)}));
    const preflightOut=await run({type:'preflight'});const preflight=preflightOut.filter(r=>r&&r.preflight).map(r=>({...r,name:pageName(r.path)}));
    const frameOut=await run({type:'frameReport'});
    const frames=frameOut.filter(r=>r&&r.path).map(r=>({path:r.path,name:pageName(r.path),ready:r.ready,dh:!!r.dh,radios:r.radios||0}));
    let flowProbe=[];try{flowProbe=(await run({type:'flowProbe'})).filter(r=>r&&r.flowProbe).map(r=>({...r,name:pageName(r.path)}));}catch{}
    return {flowProbe,flowTrace:flowTrace.slice(),rowDump,flowDebug,preflight,lastFlowSwitch,version:COMPONENT_VERSION,writes:WRITES_ENABLED,prepared:!!preparedWrite,portal:portal?{tabs:portal.tabs,forms:portal.forms,formActive:portal.formActive,service:portal.service,frames:portal.frames}:null,frames};
   }
   if(msg.type==='openFlow'){const {sourceTabId}=await chrome.storage.session.get('sourceTabId');await navigate('flow');await chrome.tabs.update(sourceTabId,{active:true});return {opened:true};}
   throw Error('不支持的操作');
 }).then(async data=>{if(['verify'].includes(msg.type)&&sender.tab?.id)await chrome.tabs.update(sender.tab.id,{active:true}).catch(()=>{});respond({ok:true,data});}).catch(async e=>{if(['prepare','submit','verify','beginAll'].includes(msg.type)&&sender.tab?.id)await chrome.tabs.update(sender.tab.id,{active:true}).catch(()=>{});respond({ok:false,error:e.message});});return true;
});
