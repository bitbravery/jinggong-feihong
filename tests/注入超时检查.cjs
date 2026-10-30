// 注入超时：原站页面无响应时不得永久挂起，必须快速失败且不算已提交。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),policy=require('../write-policy.js');
const worker=fs.readFileSync(__dirname+'/../worker.js','utf8');
function makeCtx(scripting){
 const ctx={importScripts(){},FeiHongWritePolicy:policy,SourceMapping:{statuses:['订单申请','已送达'],normalize:r=>r,fingerprint:o=>o.id},
  setTimeout:fn=>setImmediate(fn),
  chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>{ctx.listener=fn;}},sendMessage:async()=>{}},storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{}},scripting}};
 vm.createContext(ctx);
 vm.runInContext('var sourceAction=function(){};',ctx);
 vm.runInContext(worker,ctx);
 return ctx;
}
// A. 真实 run：注入调用永不返回，8 秒超时后必须报错而不是挂起。
const ctxA=makeCtx({executeScript:()=>new Promise(()=>{})});
const callA=msg=>new Promise(r=>ctxA.listener(msg,{url:'extension://index.html',tab:{id:2}},r));
// B. 等待环节连续收到超时标记：四次之后必须停止，并注明尚未提交。
const ctxB=makeCtx({executeScript:async()=>[]});
ctxB.fakeRun=async c=>{if(c.type==='portalState')return [{tabs:[],forms:0,service:true,serviceActive:true,frames:[]}];if(c.type==='navigate')return [{navigated:true}];if(c.type==='openForm')return [{timeout:true}];return [];};
vm.runInContext('run=fakeRun;',ctxB);
const callB=msg=>new Promise(r=>ctxB.listener(msg,{url:'extension://index.html',tab:{id:2}},r));

(async()=>{
 const t0=Date.now();
 let r=await callA({type:'read',kind:'query'});
 assert(!r.ok);assert.match(r.error,/无响应（8秒）/);
 assert(Date.now()-t0<5000,'必须在数秒内失败');

 const t1=Date.now();
 r=await callB({type:'prepare',order:{id:'JGKD2026092036825',status:'订单申请'}});
 assert(!r.ok);assert.match(r.error,/连续无响应/);assert.match(r.error,/尚未提交/);
 assert(Date.now()-t1<5000,'连续无响应也要快速停止');
 console.log('通过：注入调用卡死会在8秒超时；等待环节连续无响应后停止并明确标注尚未提交。');
})().catch(e=>{console.error(e);process.exitCode=1;});
