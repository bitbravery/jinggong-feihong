// v0.9.177「已改好」判定（现场：批量改 5 单全显示已改好，部分单原站仍是“订单申请”）：
// 成功只认：本单点过「确定」后新出现的“提交成功”，或调整单标签被门户自动关闭；
// 提交前页面上已有的“提交成功”不算；确认框关闭本身不算；都没有就走“结果不明”回查，不报已改好。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');

// ---------- A. 注入层 ----------
function frame(){
 const st={clicks:0,dialog:true,toast:true,toastAfterOk:false};
 const ok={innerText:'确定',getBoundingClientRect:()=>({height:24,width:60,left:600,top:300}),click(){st.clicks++;if(st.okCloses)st.dialog=false;if(st.toastAfterOk)st.toast=true;},dispatchEvent(e){if(e.type==='click')this.click();}};
 const box={innerText:'提示信息 您确定要提交吗？',getBoundingClientRect:()=>({height:st.dialog?120:0,width:250}),querySelectorAll:()=>[ok],get outerHTML(){return '';}};
 // 上一单留下、此刻仍看得见的“提交成功”
 const tip={innerText:'提交成功',getBoundingClientRect:()=>({height:st.toast?40:0,width:st.toast?120:0})};
 const ctx={module:{exports:{}},window:{},location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/cooperative/openCooperative.htm',href:'https://ehall.bit.edu.cn/EIP/cooperative/openCooperative.htm'},URL,
  MouseEvent:class{constructor(t,i){this.type=t;Object.assign(this,i||{});}},
  document:{querySelectorAll:s=>/mini-window/.test(s)?[box]:s==='div,span,p,td'?[tip]:[]}};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 return {act:c=>ctx.module.exports.sourceAction(c),st,tip};
}
const cmd={type:'confirmSubmit',order:{id:'JGKD20221123192713'},target:'已送达',token:'T1'};
// 1) 复现现场：确认框刚弹出，页面上还挂着上一单的“提交成功”
let f=frame();
let m=f.act({type:'toastMark'});assert.equal(m.visible,1,'提交前要数出已有的“提交成功”');
let r=f.act(cmd);
assert(!r||!r.confirmed,'旧的“提交成功”不得让本单被判成功');
assert.equal(f.st.clicks,1,'必须真的去点「确定」（旧代码在这里一次都不点就报成功）');
// 2) 点了确定、确认框关了，但只剩旧提示：仍不算
f.st.okCloses=true;f.st.dialog=false;
r=f.act(cmd);assert(r&&!r.confirmed&&r.closedNoToast,'确认框关闭+旧提示，不得算成功');
// 3) 旧提示消失后，同一提示元素再次出现（门户复用提示框）：算本单新提示
f.st.toast=false;f.act(cmd);f.st.toast=true;
r=f.act(cmd);assert(r&&r.confirmed&&r.via==='toast','旧提示消失后再次出现，算点确定后的新提示');
// 4) 没点过确定（别的令牌）：即使出现新提示也不算本单
f=frame();f.act({type:'toastMark'});f.st.toast=false;f.act({...cmd,token:'OTHER'});
const g=frame();g.st.toast=false;g.act({type:'toastMark'});g.st.dialog=false;g.st.toast=true;
r=g.act(cmd);assert(!r||!r.confirmed,'本单没点过确定，出现的“提交成功”不算本单');
// 5) 正常：点确定 → 确认框关闭 → 出现提示
const h=frame();h.st.toast=false;h.act({type:'toastMark'});h.st.okCloses=true;h.st.toastAfterOk=true;
r=h.act(cmd);assert(r&&r.confirmed&&r.via==='toast','点确定后出现“提交成功”应算成功');assert.equal(h.st.clicks,1);

// ---------- B. 编排层 ----------
function worker(scn){
 let listener,time=0;const log=[];
 const ctx={importScripts(){},Date:{now:()=>time},setTimeout:fn=>{time+=250;fn();},FeiHongWritePolicy:require('../write-policy.js'),
  SourceMapping:{statuses:['订单申请','已揽件','发出/派送中','已送达','已签收'],fingerprint:o=>o.id,normalize:s=>s.rows.map(x=>({id:x[0],status:x[1],duplicateOrder:false}))},
  chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async()=>{}},storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{}},scripting:{executeScript:async()=>[]}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../worker.js','utf8'),ctx);
 const order={id:'JGKD20221123192713',status:'订单申请'};
 const saving=()=>!!scn.busyUntil&&time<scn.busyUntil;
 ctx.fakeRun=async c=>{log.push(c.type);
  if(c.type==='portalBusy')return [{busy:saving(),path:'/EIP/x/openCooperative.htm'},{busy:false,path:'/EIP/x/framework.htm'}];
  if(c.type==='portalState')return [{tabs:['京工飞鸿两校快件系统'],forms:scn.leftoverForm&&saving()?1:0,service:true}];
  if(c.type==='closeFormTab'){if(saving())log.push('在保存中关标签！');return [{closed:1}];}
  if(c.type==='navigate')return [{navigated:true}];if(c.type==='openForm')return [{openRequested:true}];
  if(c.type==='prepare')return [{prepared:true}];if(c.type==='inspect')return [{matched:true,current:'订单申请'}];
  if(c.type==='toastMark')return [{toastMarked:true,visible:scn.stale||0},{toastMarked:true,visible:0}];
  if(c.type==='armSubmission')return [{armed:true}];if(c.type==='submit')return [{submitted:true}];
  if(c.type==='confirmSubmit')return scn.toast||(scn.toastAfterSave&&scn.busyUntil&&!saving()&&!scn.leftoverForm)?[{confirmed:true,via:'toast'}]:[{waiting:true,seen:true,closedNoToast:true,pressed:true}];
  if(c.type==='submissionComplete')return scn.tabClosed?[{submissionComplete:true}]:[{waiting:true}];
  if(c.type==='queryField')return [{fieldSelected:true}];if(c.type==='queryOrder')return [{queryRequested:true,token:'q'}];
  if(c.type==='snapshot')return [{rows:[[order.id,scn.after||'订单申请']],headers:['单号','物流信息'],total:1,probeToken:'q',probeSettled:true}];
  return [];};
 vm.runInContext('run=fakeRun;navigate=async()=>{};',ctx);
 const call=msg=>new Promise(res=>listener(msg,{url:'extension://index.html',tab:{id:2}},res));
 return (async()=>{let p=await call({type:'prepare',order});assert(p.ok,p.error);return {res:await call({type:'submit',order,target:'已送达'}),log};})();
}
(async()=>{
 // 点确定后看到新的“提交成功”：成功，并写明依据与提交前的旧提示数
 let w=await worker({toast:true,stale:2});
 assert(w.res.ok,w.res.error);assert.equal(w.res.data.basis,'提交成功+调整单自动关闭');assert.equal(w.res.data.staleToast,2);
 assert(w.log.indexOf('toastMark')>=0&&w.log.indexOf('toastMark')<w.log.indexOf('submit'),'点提交前要先给旧提示打标记');
 // 只有标签关闭、没有“提交成功”：按新口径不算成功（结果不明）
 w=await worker({tabClosed:true});
 assert(!w.res.ok,'只关标签没有提交成功时不得记成功');
 assert.match(w.res.error,/未看到提交成功/,'错误要说明缺少“提交成功”');
 // 两个信号都没有、回查仍是“订单申请”（复现现场那单）：不得报已改好，报出原站现状（工作台据此只重试一次）
 w=await worker({stale:1});
 assert(!w.res.ok,'没有任何成功信号时不得报已改好');
 assert.match(w.res.error,/已点「确定」、确认框已关闭，但没有看到“提交成功”/);
 assert.match(w.res.error,/已回读原站，当前状态是「订单申请」，未到「已送达」/);
 assert.match(w.res.error,/提交前页面上已有 1 处“提交成功”字样（已忽略）/);
 // 两个信号都没有，但回查已是目标：按回查记成功，写明依据
 w=await worker({after:'已送达'});
 assert(w.res.ok,w.res.error);assert.match(w.res.data.basis,/按单号回查原站已是「已送达」/);

 // ---------- v0.9.178：原站点确定后“加载中”保存较久（现场：整页蒙灰两个“加载中…”）----------
 // 保存 40 秒才出“提交成功”：一直等；期间不回查、不重试、不关标签
 w=await worker({busyUntil:40000,toastAfterSave:true});
 assert(w.res.ok,w.res.error);assert.equal(w.res.data.basis,'提交成功+调整单自动关闭');
 assert(!w.log.includes('queryField'),'原站还在保存时不得去回查');
 assert(!w.log.includes('在保存中关标签！'),'不得在保存中途关调整单');
 // 一直卡在“加载中”：90 秒后报结果不明，不回查、不触发自动重试
 w=await worker({busyUntil:1e9});
 assert(!w.res.ok);assert.match(w.res.error,/保存超过 90 秒仍在“加载中”，提交结果不明，勿重复提交/);
 assert(!/已回读原站，当前状态是/.test(w.res.error),'不得给出会触发自动重试的回读结论');
 assert(!w.log.includes('queryField'),'卡在加载中时不得去回查');
 // 准备下一单时上一张调整单还在保存：先等保存完，不去关它
 w=await worker({busyUntil:20000,leftoverForm:true,toast:true});
 assert(w.res.ok,w.res.error);assert(!w.log.includes('在保存中关标签！'),'准备阶段不得关正在保存的调整单');
 assert(w.log.indexOf('portalBusy')<w.log.indexOf('prepare'),'准备前要先确认上一单保存完成');
 // 注入层：看得见的“加载中”遮罩算保存中
 {const mk=(cls,txt,h)=>({className:cls,innerText:txt,getBoundingClientRect:()=>({height:h,width:h?100:0})});
  const run=els=>{const c={module:{exports:{}},window:{},location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/x/openCooperative.htm',href:''},URL,document:{querySelectorAll:s=>s==='.mini-mask-loading'?els.filter(e=>e.className==='mini-mask-loading'):s==='div,span'?els:[]}};vm.createContext(c);vm.runInContext(src,c);return c.module.exports.sourceAction({type:'portalBusy'});};
  assert.equal(run([mk('mini-mask-loading','加载中...',40)]).busy,true,'可见的加载遮罩算保存中');
  assert.equal(run([mk('x','加载中...',30)]).busy,true,'可见的“加载中…”文字算保存中');
  assert.equal(run([mk('mini-mask-loading','加载中...',0)]).busy,false,'隐藏的遮罩不算');}

 // ---------- C. 工作台：结果写明依据 ----------
 const live=fs.readFileSync(__dirname+'/../live.js','utf8');
 assert(/'已确认提交（'\+\(submitted&&submitted\.basis\|\|'未回读'\)\+'）'/.test(live),'历史结果要写明判定依据');
 assert(/row\.staleToast='提交前页面上已有 '/.test(live)&&/h\.staleToast\|\|''/.test(live),'旧提示要记进历史详情');
 console.log('通过：旧“提交成功”与确认框关闭都不算成功；只认点确定后的新提示或标签自动关闭；都没有则回查、不报已改好；结果写明依据。');
})().catch(e=>{console.error(e);process.exitCode=1;});
