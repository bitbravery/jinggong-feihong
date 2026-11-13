// v1.0.22：依据 11-01 至 11-10 的真实历史（353 条）做的三处加固，执行真实代码。
// 1) 13 批里 7 批第一单因“调整单输入框 10 秒没出来”失败（平时 0.2 秒）：放宽到 30 秒，这一步还没填单号
// 2) “数据不完整”被拒的 23 单之后没有一单改成功过：按“原站拒绝，未提交”报（历史里记失败），不再记结果不明
// 3) “残留确认框关不掉”的报错带上框在哪个页面、页面是否显示（只加诊断，不改行为）
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=__dirname+'/../';
const SourceMapping=require(D+'mapping.js'),policy=require(D+'write-policy.js'),FeiHongAudit=require(D+'audit-history.js');
const {sourceAction}=require(D+'source.js');

function boot(fakeRun){
 let T=1e6,listener;
 const ctx={importScripts(){},FeiHongWritePolicy:policy,SourceMapping,FeiHongDates:{recentMonth:()=>({})},
  Date:{now:()=>T},setTimeout:(fn,ms)=>{T+=ms||0;setImmediate(fn);},
  chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async()=>{}},
   storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{},get:async()=>({})},scripting:{executeScript:async()=>[]}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(D+'worker.js','utf8'),ctx);
 const w={T0:T,now:()=>T};ctx.fakeRun=c=>fakeRun(c,w);vm.runInContext('run=fakeRun;navigate=async()=>{};',ctx);
 w.call=msg=>new Promise(res=>listener(msg,{url:'extension://index.html',tab:{id:2}},res));
 return w;
}
// 一个最小的门户：开调整单后过 formReadyAfter 毫秒输入框才出来
function portal({formReadyAfter=0,confirm}={}){
 let active='京工飞鸿两校快件系统',forms=0,openedAt=0;const cmds=[];
 const run=async(c,w)=>{cmds.push(c.type);
  if(c.type==='portalState')return [{tabs:['京工飞鸿两校快件系统'].concat(forms?['物流状态调整单']:[]),active,forms,service:true}];
  if(c.type==='formActive')return [{formActive:active==='物流状态调整单'}];
  if(c.type==='openForm'){forms=1;active='物流状态调整单';openedAt=w.now();return [{openRequested:true}];}
  if(c.type==='navigate')return [{navigated:true}];
  if(c.type==='prepare')return w.now()-openedAt>=formReadyAfter?[{prepared:true}]:[{waiting:true}];
  if(c.type==='inspect')return [{matched:true,current:'已签收',names:{}}];
  if(c.type==='armSubmission')return [{armed:true}];
  if(c.type==='submit')return [{submitted:true}];
  if(c.type==='confirmSubmit')return confirm?confirm(c):[];
  if(c.type==='formAlert')return [{alert:'数据不完整',dismissed:true}];
  return [];};
 return {run,cmds};
}
const order={id:'JGKD700090',status:'已签收',sender:'甲',receiver:'乙'};
(async()=>{
 // 1) 调整单 20 秒才出输入框：准备要成功（原来 10 秒就放弃）
 {const p=portal({formReadyAfter:20000});const w=boot(p.run);
  const r=await w.call({type:'prepare',order});
  assert.equal(r.ok,true,'调整单 20 秒才加载出来就放弃了：'+r.error);
  const p2=portal({formReadyAfter:Infinity});const w2=boot(p2.run);const t0=w2.now();
  const r2=await w2.call({type:'prepare',order});
  assert.equal(r2.ok,false);assert(w2.now()-t0<60000,'输入框一直不出来时不能无限等');
  console.log('通过：调整单输入框最多等 30 秒（冷启动慢也能过），一直不出来照样放弃。');}

 // 2) 数据不完整被拒：报“原站拒绝提交，本单未提交”，并说明是哪个字段
 {const msg='原站提示「控件【收件地址宇楼】数据不完整,值是:文萃楼A（东区）@#@,请检查后重新提交」；已重新提交一次仍被拦截，本单未提交，继续下一单。';
  const p=portal({confirm:()=>[{error:msg}]});const w=boot(p.run);
  assert.equal((await w.call({type:'prepare',order})).ok,true);
  const r=await w.call({type:'submit',order,target:'已送达'});
  assert.equal(r.ok,false);
  assert.match(r.error,/^原站拒绝提交，本单未提交：「收件地址宇楼」的值“文萃楼A（东区）”原站已不认/);
  assert(!/结果不明|勿重复提交/.test(r.error),'被原站拒绝的单不能说结果不明');
  assert(p.cmds.slice(p.cmds.lastIndexOf('submit')).includes('formAlert'),'要关掉原站的“数据不完整”提示框');
  // 真的点了确定、结果不明的情况不能被误判成“拒绝”
  const p3=portal({confirm:()=>[{error:'原站提交确认未完成（已等待15秒，提交结果不明，勿重复提交）'}]});const w3=boot(p3.run);
  await w3.call({type:'prepare',order});const r3=await w3.call({type:'submit',order,target:'已送达'});
  assert(!/^原站拒绝提交/.test(r3.error),'结果不明的单被误判成原站拒绝');
  // 工作台：这类记“提交失败（原站拒绝），未提交”，历史里算失败、不显示“改回原状态”
  const live=fs.readFileSync(D+'live.js','utf8');
  assert(/else if\(\/\^原站拒绝提交，本单未提交\/\.test\(String\(e\.message\|\|''\)\)\)\{\s*\/\/[^\n]*\n\s*row\.result='提交失败（原站拒绝），未提交'/.test(live),'工作台要把原站拒绝记成失败');
  const h={result:'提交失败（原站拒绝），未提交'};
  assert.equal(FeiHongAudit.outcome(h),'failed');assert.equal(FeiHongAudit.canRevert(h),false);
  console.log('通过：“数据不完整”被拒记为原站拒绝、未提交，写明哪个字段的值原站不认；结果不明的不会被误判。');}

 // 3) 残留确认框的诊断：说明在哪个页面、页面是否显示
 {const btn={innerText:'确定',getBoundingClientRect:()=>({height:20,width:40}),getAttribute:()=>null,className:''};
  const box={innerText:'提示信息 您确定要提交吗？ 确定 取消',getBoundingClientRect:()=>({height:120,width:300}),querySelectorAll:()=>[btn]};
  const doc={querySelectorAll:s=>/mini-messagebox/.test(s)?[box]:/mini-tab-active/.test(s)?[]:[],querySelector:s=>s==='.mini-tab-active'?{innerText:'京工飞鸿两校快件系统'}:null};
  const win={document:doc,frameElement:{getBoundingClientRect:()=>({height:0,width:0})}};win.parent=win;win.top={document:doc};
  const ctx={document:doc,window:win,location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/cooperative/openCooperative.htm',href:'x'},URL,getComputedStyle:()=>({}),MouseEvent:function(){},performance:{getEntriesByType:()=>[]}};
  const out=vm.runInNewContext('('+sourceAction+')({type:"confirmResidue"})',ctx);
  assert.equal(out.residue,1);
  assert.equal(out.where,'openCooperative.htm，页面已隐藏，门户当前标签「京工飞鸿两校快件系统」');
  const worker=fs.readFileSync(D+'worker.js','utf8');
  assert(/确认框关不掉；本单已跳过，不影响后续单，可稍后手动处理。'\+\(where\?'（诊断：'\+where\+'）':''\)/.test(worker),'报错里要带上诊断');
  console.log('通过：“残留确认框关不掉”的报错会写明框在哪个页面、页面是否显示、门户当前标签。');}
})().catch(e=>{console.error(e);process.exitCode=1;});
