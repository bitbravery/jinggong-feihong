// 原站串行：worker 内所有驱动原站的操作排队执行；准备成功到提交结束之间，查看状态等操作必须等待，
// 不能在已核对的表单上插队；取消不排队；工作台侧批量查看与改状态/改回互相让行。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),policy=require('../write-policy.js');
let listener;const log=[];
const statuses=['订单申请','已揽件','发出/派送中','已送达','已签收'];
const ctx={importScripts(){},FeiHongWritePolicy:policy,SourceMapping:{statuses,normalize:s=>s.rows,fingerprint:o=>o.id},setTimeout,
 chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async()=>{}},storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{},get:async id=>{if(closedTabs.has(id))throw Error('No tab with id');return {id};}},scripting:{executeScript:async()=>[]}}};
const closedTabs=new Set();
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../worker.js','utf8'),ctx);
const A='JGKD2026092036825',B='JGKD2026092036826';
let gate=null;
const full=id=>({DH:id,JJRGH:'1',JJRXM:'张三',JJRDH:'1',JJDZXQ:'良乡',JJDZYL:'1号楼',JJDZFJH:'101',SJRXM:'李四',SJRDH:'2',SJXQDZ:'中关村',SJDZYL:'2号楼',SJDZFJH:'202'});
let formDh='';
ctx.fakeRun=async c=>{
 log.push(c.type);
 if(c.type==='navigate'&&c.kind==='flow'&&gate)await gate.promise;
 if(c.type==='portalState')return [{tabs:['京工飞鸿两校快件系统'],forms:0,service:true,serviceActive:true,frames:[]}];
 if(c.type==='navigate')return [{navigated:true}];
 if(c.type==='openForm')return [{openRequested:true}];
 if(c.type==='prepare'){formDh=c.order.id;return [{prepared:true}];}
 if(c.type==='inspect')return [{matched:true,current:'已揽件',names:{sender:true,receiver:true}}];
 if(c.type==='readForm')return [{dh:formDh,fields:full(formDh),current:'已揽件'}];
 if(c.type==='armSubmission')return [{armed:true}];
 if(c.type==='submit')return [{submitted:true}];
 if(c.type==='confirmSubmit')return [{confirmed:true}];
 return [];
};
vm.runInContext('run=fakeRun;',ctx);
const call=(msg,tab=2)=>new Promise(r=>listener(msg,{url:'extension://index.html',tab:{id:tab}},r));
const tick=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
 // 1) 一个原站操作没结束，另一个不得开始
 let open;gate={};gate.promise=new Promise(r=>open=r);
 const first=call({type:'openFlow'});await tick(20);
 const second=call({type:'statusOf',id:B},3);await tick(300);
 assert(!log.includes('portalState'),'前一个操作未结束时，查看状态不得开始操作原站：'+log.join(','));
 open();gate=null;
 assert((await first).ok);const s=await second;assert(s.ok,s.error);assert.equal(s.data.status,'已揽件');

 // 2) 取消不排队
 gate={};gate.promise=new Promise(r=>open=r);
 const busy=call({type:'openFlow'});await tick(20);
 const cancelled=await Promise.race([call({type:'cancelWrite'}),tick(500).then(()=>null)]);
 assert(cancelled&&cancelled.ok,'取消必须立刻返回，不能排在原站操作后面');
 open();gate=null;await busy;

 // 3) 准备成功后、提交前：其他工作台的查看状态必须等提交结束
 const order={id:A,status:'已揽件'};
 let r=await call({type:'prepare',order});assert(r.ok,r.error);
 log.length=0;
 const peek=call({type:'statusOf',id:B},3);await tick(400);
 assert(!log.includes('readForm')&&!log.includes('portalState'),'令牌有效期内查看状态不得插队：'+log.join(','));
 r=await call({type:'submit',order,target:'已送达'});assert(r.ok,r.error);
 const submitAt=log.lastIndexOf('confirmSubmit');
 const p=await peek;assert(p.ok,p.error);
 assert(log.indexOf('readForm')>submitAt,'查看状态必须在提交确认之后才读表单');

 // 4) 同一工作台重新准备（重试路径）不会被自己的令牌卡住
 r=await call({type:'prepare',order});assert(r.ok,r.error);
 const again=await Promise.race([call({type:'prepare',order}),tick(4000).then(()=>null)]);
 assert(again&&again.ok,'同一工作台的重新准备应立即执行');
 await call({type:'cancelWrite'});

 // 5) 同一工作台（例如刷新后）读取，不被自己的旧令牌卡住
 r=await call({type:'prepare',order});assert(r.ok,r.error);
 const own=await Promise.race([call({type:'openFlow'}),tick(1500).then(()=>null)]);
 assert(own&&own.ok,'同一工作台的读取不应被自己的令牌挡住');

 // 6) 持有令牌的工作台已关闭：其他工作台不再被挡
 closedTabs.add(2);
 const other=await Promise.race([call({type:'openFlow'},3),tick(1500).then(()=>null)]);
 assert(other&&other.ok,'令牌持有者已关闭时，应释放给其他工作台');
 const late=await call({type:'submit',order,target:'已送达'});assert(!late.ok,'已作废的令牌不能再提交');

 // 7) 工作台侧互相让行（静态约束）
 const live=fs.readFileSync(__dirname+'/../live.js','utf8');
 const pump=live.slice(live.indexOf('async function pumpStatus'),live.indexOf("$('batchStatusCheck').onclick"));
 assert(/while\(busy\)/.test(pump),'批量查看遇到改状态/改回/读取进行中要等待');
 const sub=live.slice(live.indexOf('async function submit'),live.indexOf('function renderHistory'));
 assert(/if\(statusBusy\)\{toast/.test(sub),'批量查看进行中不得开始改状态');
 assert(/if\(statusBusy\)\{toast\('正在批量查看原站状态，请等它结束后再改回/.test(live),'批量查看进行中不得改回');
 console.log('通过：原站操作串行排队；准备到提交之间不被插队；取消不排队；同一工作台可重新准备；工作台侧查看与写操作互相让行。');
})().catch(e=>{console.error(e);process.exitCode=1;});
