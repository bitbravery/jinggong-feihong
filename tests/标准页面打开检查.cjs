// v1.0.29：打开原站标准页面（按用户 2026-11-20 的录屏和图文教程重做）。
// 执行 worker.js 原文，用一个假门户模拟标签栏、各页面帧、点击后新开标签（含整页跳转时暂时读不到），检查：
// 幂等、只关多余/重复、只开缺的、打开路径与人工操作一致、失败时说清卡在哪一步并带诊断。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=__dirname+'/../';
const read=f=>fs.readFileSync(D+f,'utf8');
const html=read('index.html'),live=read('live.js'),worker=read('worker.js'),source=read('source.js'),css=read('style.css');

// —— 1) 侧栏按钮：启用、整行、不再 hidden ——
const btn=html.match(/<button id="openStandard"[^>]*>([^<]*)<\/button>/);
assert(btn,'侧栏要有 #openStandard 按钮');
assert.equal(btn[1],'打开原站标准页面');
assert(!/\bhidden\b/.test(btn[0]),'按钮要显示出来（不能再带 hidden）');
assert(html.indexOf('id="campusSwitch"')<html.indexOf('id="openStandard"'),'按钮在校区切换下面');
assert(/#openStandard\{[^}]*width:100%/.test(css),'按钮要占整行');
console.log('通过：侧栏校区切换下面显示整行按钮「打开原站标准页面」。');

// —— 2) 工作台：禁用 + “正在打开…” + 不确定进度 + 前台执行 + 成功/失败文案 ——
const a=live.indexOf('// v1.0.29：一键把原站收拾成标准四标签'),b=live.indexOf("$('openStandard').onclick");
assert(a>0&&b>a,'找不到 live.js 的 openStandardPages');
function liveRun(result){
 const els={};const $=id=>els[id]||(els[id]={hidden:true,disabled:false,textContent:'',max:0,value:0,removeAttribute(k){if(k==='value')this.value=null;}});
 const log=[];const toasts=[];
 const env={busy:false,standardBusy:false,lastReadError:''};
 const fn=new Function('$','toast','requireComponent','withPortalFront','request','setTimeout','env',
  'let busy=env.busy,standardBusy=env.standardBusy,lastReadError=env.lastReadError;'+live.slice(a,b)+';return openStandardPages;');
 const open=fn($,(s)=>toasts.push(s),async()=>{},async f=>{log.push('front-on');try{return await f();}finally{log.push('front-off');}},
  async m=>{log.push('request:'+m.type+':'+$('openStandard').textContent+':'+$('openStandard').disabled+':'+$('bulkBar').value);if(result instanceof Error)throw result;return result;},()=>{},env);
 return {open,$,log,toasts};
}
(async()=>{
 {
  const L=liveRun({already:false,opened:['【流程】','快件查询','京工飞鸿两校快件系统'],closed:2});
  await L.open();
  assert.deepEqual(L.log,['front-on','request:openStandardPages:正在打开…:true:null','front-off'],'点击后要先禁用按钮、显示“正在打开…”、进度条不确定，再在原站前台执行，最后切回扩展');
  assert(L.toasts[0].startsWith('原站标准页面已打开：工作台、【流程】、快件查询、京工飞鸿两校快件系统'),'成功提示文字不对：'+L.toasts[0]);
  assert.equal(L.$('openStandard').disabled,false);assert.equal(L.$('openStandard').textContent,'打开原站标准页面');
  const F=liveRun(new Error('卡在第 3 步「从工作台“我的待办”点“待办”数字，打开【流程】」：…。当前原站标签：工作台(当前)。页面诊断：…'));
  await F.open();
  assert(/打开原站标准页面失败——卡在第 3 步/.test(F.$('bulkText').textContent),'失败要把卡在哪一步写到进度条上');
  assert.equal(F.$('bulkProgress').hidden,false,'失败信息要留在页面上');
  console.log('通过：点击后禁用并显示“正在打开…”、进度条不确定、原站切前台执行、结束切回扩展；成功/失败提示完整。');
 }

 // —— 3) 后台编排：假门户 ——
 // 页面里的入口：工作台（我的待办数字 / 业务管理中心按钮 / 我的服务卡片），业务管理中心（业务包卡片），业务包页（快件查询卡片）
 const OPENS={todoCount:'【流程】',centerButton:'业务管理中心',packageCard:'京工飞鸿两校快件',queryCard:'快件查询',serviceCard:'京工飞鸿两校快件系统'};
 const ON={todoCount:'工作台',centerButton:'工作台',serviceCard:'工作台',packageCard:'业务管理中心',queryCard:'京工飞鸿两校快件'};
 function portal(start,{broken={},noClose={},reloadOnClick=true,lazy=true}={}){
  const P={tabs:start.map((t,i)=>({text:t,active:i===0})),clicks:[],closes:[],tabClicks:[],blank:0,scrolled:0};
  P.active=()=>P.tabs.find(t=>t.active);
  P.exec=async({target,args:[c]})=>{
   if(P.blank>0){P.blank--;throw Error('Frame with ID 0 was removed.');} // 整页跳转中
   const top=r=>[{frameId:0,result:r}],frame=r=>[{frameId:7,result:r}];
   if(c.type==='stdTabs')return top({stdTabs:P.tabs.map(t=>({text:t.text,active:t.active,closable:t.text!=='工作台'&&noClose[t.text]!==true}))});
   if(c.type==='stdTabClick'){const t=P.tabs[c.index];if(!t||t.text!==c.text)return top({stdError:'变了'});P.tabClicks.push(t.text);P.tabs.forEach(x=>x.active=x===t);return top({stdDone:true});}
   if(c.type==='stdTabClose'){const t=P.tabs[c.index];if(!t||t.text!==c.text)return top({stdError:'变了'});P.closes.push(t.text);if(noClose[t.text]==='stuck')return top({stdDone:true});const was=t.active;P.tabs.splice(c.index,1);if(was)P.tabs[0].active=true;return top({stdDone:true});}
   if(c.type==='stdScroll'){P.scrolled++;return frame({stdScrolled:true,atEnd:false});}
   if(c.type==='stdDiag')return frame({stdDiag:true,top:false,path:'workbench.htm',visible:true,ready:'complete',marks:['我的待办'],found:[]});
   if(c.type==='stdLocate'||c.type==='stdClick'){
    const here=P.active().text;
    if(ON[c.target]!==here)return [];
    if(broken[c.target])return frame({stdMissing:'没看到',needScroll:false});
    if(lazy&&c.target!=='todoCount'&&P.scrolled<2)return frame({stdMissing:'还没加载',needScroll:true});
    if(c.type==='stdLocate')return frame({stdFound:true,sample:c.target});
    assert.equal(JSON.stringify(target.frameIds),'[7]','只能在找到目标的那个帧里点');
    P.clicks.push(c.target);
    if(broken[c.target]!=='silent'){P.tabs.forEach(x=>x.active=false);P.tabs.push({text:OPENS[c.target],active:true});if(reloadOnClick)P.blank=2;}
    return frame({stdClicked:true,sample:c.target});
   }
   return [];
  };
  return P;
 }
 function boot(P){
  let T=1e6,listener;
  const ctx={importScripts(){},sourceAction:()=>null,SourceMapping:{},FeiHongWritePolicy:{},FeiHongDates:{recentMonth:()=>({})},
   // 假时钟：计时器真正到点才拨表；被 clearTimeout 取消的不算（注入 6 秒超时上限正常情况下会被取消）
   Date:{now:()=>T},setTimeout:(fn,ms)=>{const id={};setImmediate(()=>{if(id.off)return;T+=ms||0;fn();});return id;},clearTimeout:id=>{if(id)id.off=true;},
   chrome:{action:{onClicked:{addListener(){}},setBadgeText:async()=>{}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async m=>{if(m.type==='standardStage')P.stages=(P.stages||[]).concat(m.text);}},
    storage:{session:{get:async()=>({sourceTabId:1})},local:{get:async()=>({}),set:async()=>{}}},
    tabs:{update:async()=>({}),get:async()=>({active:true,windowId:1})},windows:{update:async()=>{}},scripting:{executeScript:P.exec}}};
  vm.createContext(ctx);vm.runInContext(worker,ctx);
  ctx.fakeRun=async c=>c.type==='portalBusy'?[{busy:false}]:[];vm.runInContext('run=fakeRun;',ctx);
  return msg=>new Promise(res=>listener(msg,{url:'extension://index.html',tab:{id:2}},res));
 }
 const names=P=>P.tabs.map(t=>t.text);
 const STD=['工作台','【流程】','快件查询','京工飞鸿两校快件系统'];
 const sameSet=(x,y)=>assert.deepEqual([...x].sort(),[...y].sort());

 // 3a 幂等：已经是标准四标签，再点：不开、不关、不报错，只切到快件查询
 {
  const P=portal(['工作台','【流程】','快件查询','京工飞鸿两校快件系统']);
  const r=await boot(P)({type:'openStandardPages'});
  assert(r.ok,JSON.stringify(r));assert.equal(r.data.already,true);
  assert.deepEqual(P.clicks,[],'已经标准时不应再点任何入口');assert.deepEqual(P.closes,[],'已经标准时不应关任何标签');
  assert.deepEqual(names(P),STD);assert.equal(P.active().text,'快件查询');
  // 系统标签叫“京工飞鸿两校区快件系统”也算标准
  const P2=portal(['工作台','快件查询','京工飞鸿两校区快件系统','【流程】']);
  const r2=await boot(P2)({type:'openStandardPages'});
  assert.equal(r2.data.already,true);assert.deepEqual(P2.closes,[]);assert.deepEqual(P2.clicks,[]);
  console.log('通过：已经是标准四标签时再点：不重复开、不重复关、不报错，最后切到“快件查询”。');
 }

 // 3b 只有工作台：按人工路径依次打开，临时标签关掉，最后正好四个、快件查询在前台
 {
  const P=portal(['工作台']);
  const r=await boot(P)({type:'openStandardPages'});
  assert(r.ok,JSON.stringify(r)+' clicks='+P.clicks+' closes='+P.closes+' tabClicks='+P.tabClicks);
  assert.deepEqual(P.clicks,['todoCount','centerButton','packageCard','queryCard','serviceCard'],'打开顺序/路径应与录屏一致');
  sameSet(P.closes,['业务管理中心','京工飞鸿两校快件']);
  sameSet(names(P),STD);assert.equal(P.tabs.length,4);assert.equal(P.active().text,'快件查询');
  assert(P.scrolled>=2,'工作台下方区块要先往下滚才会加载');
  assert(P.stages.some(s=>/业务管理中心/.test(s))&&P.stages.some(s=>/我的服务/.test(s)),'进度要显示当前步骤');
  sameSet(JSON.parse(JSON.stringify(r.data.opened)),['【流程】','快件查询','京工飞鸿两校快件系统']);
  console.log('通过：只有工作台时按录屏路径打开【流程】→ 快件查询（经业务管理中心、业务包页）→ 京工飞鸿两校快件系统，临时标签已关，最后切到快件查询。');
 }

 // 3c 多余 + 重复：只关多余/重复，只开缺的
 {
  const P=portal(['工作台','【流程】','物流状态调整单','快件查询','【流程】','业务管理中心','快件查询']);
  const r=await boot(P)({type:'openStandardPages'});
  assert(r.ok,JSON.stringify(r));
  assert.deepEqual(P.clicks,['serviceCard'],'只缺系统页，只该点“我的服务”里的卡片');
  assert.equal(P.closes.length,4);sameSet(P.closes,['物流状态调整单','【流程】','业务管理中心','快件查询']);
  assert.deepEqual(names(P),STD);assert.equal(r.data.closed,4);
  console.log('通过：多余标签和重复标签都关掉（每种标准标签只留一个），只打开缺的那个。');
 }

 // 3d 点了没反应：等一会再点一次；多开的重复标签最后关掉
 {
  const P=portal(['工作台','【流程】','快件查询'],{reloadOnClick:false});
  let first=true;const exec=P.exec;
  P.exec=async o=>{const c=o.args[0];if(c.type==='stdClick'&&c.target==='serviceCard'&&first){first=false;P.clicks.push('serviceCard(无反应)');return [{frameId:7,result:{stdClicked:true}}];}return exec(o);};
  const r=await boot(P)({type:'openStandardPages'});
  assert(r.ok,JSON.stringify(r));
  assert.deepEqual(P.clicks,['serviceCard(无反应)','serviceCard']);
  assert.deepEqual(names(P),STD);
  console.log('通过：第一次点击没反应时会再点一次。');
 }

 // 3e 失败：说清卡在哪一步、当前标签，并附页面诊断
 {
  const P=portal(['工作台','【流程】','快件查询'],{broken:{serviceCard:true}});
  const r=await boot(P)({type:'openStandardPages'});
  assert.equal(r.ok,false);
  assert(/^卡在第 \d+ 步「从工作台“我的服务”打开京工飞鸿两校快件系统」：/.test(r.error),r.error);
  assert(/当前原站标签：工作台\(当前\)、【流程】、快件查询/.test(r.error),'失败要列出当前标签：'+r.error);
  assert(/页面诊断：workbench\.htm：我的待办/.test(r.error),'失败要附页面诊断：'+r.error);
  const Q=portal(['工作台','【流程】','快件查询','京工飞鸿两校快件系统','业务管理中心'],{noClose:{'业务管理中心':'stuck'}});
  const r2=await boot(Q)({type:'openStandardPages'});
  assert.equal(r2.ok,false);assert(/卡在第 2 步「关闭多余和重复的标签」：点了“业务管理中心”的关闭按钮，但它没有消失/.test(r2.error),r2.error);
  const Z=portal(['工作台','某个没有关闭按钮的页'],{noClose:{'某个没有关闭按钮的页':true}});
  const r3=await boot(Z)({type:'openStandardPages'});
  assert(/“某个没有关闭按钮的页”标签没有关闭按钮/.test(r3.error),r3.error);
  console.log('通过：失败时说明卡在第几步、当前有哪些标签，并附页面诊断。');
 }

 // —— 4) 注入层：关键约束 ——
 for(const t of ['stdTabs','stdTabClick','stdTabClose','stdLocate','stdClick','stdScroll','stdDiag'])assert(source.includes("command.type==='"+t+"'"),'source.js 缺少 '+t);
 for(const t of ['todoCount','serviceCard','centerButton','packageCard','queryCard'])assert(source.includes("target==='"+t+"'"),'source.js 缺少目标 '+t);
 assert(/const sFrameVis=/.test(source)&&/if\(!sFrameVis\(\)\)return null;/.test(source),'只在看得见的帧里找（未激活标签的同名文字不能点）');
 assert(/sInBar/.test(source),'标签栏里的同名文字要排除');
 assert(/'pointerdown','mousedown','pointerup','mouseup','click'/.test(source),'点击要像人一样派发完整事件，不用单次 .click()');
 assert(!/tabCloseAll|workbenchOpenFlow|packageOpenQuery/.test(source+worker),'旧 v0.9.216 编排已整体弃用');
 console.log('通过：注入层只在看得见的帧里找目标、排除标签栏、用完整事件点击；旧编排已删除。');
})().catch(e=>{console.error(e);process.exitCode=1;});
