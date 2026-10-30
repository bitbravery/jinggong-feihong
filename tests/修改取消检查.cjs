const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),policy=require('../write-policy.js');
let listener,submitted=0;const order={id:'JGKD2026092036825',status:'已送达'};
const ctx={importScripts(){},FeiHongWritePolicy:policy,SourceMapping:{statuses:['订单申请','已送达'],fingerprint:o=>o.id},FeiHongDates:{recentMonth:()=>({from:'2026-09-20',to:'2026-10-20',endExclusive:'2026-10-21'})},setTimeout,
 chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async()=>{}},storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{}},scripting:{executeScript:async()=>[]}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../worker.js','utf8'),ctx);
ctx.fakeRun=async c=>{if(c.type==='portalState')return [{tabs:['快件查询','京工飞鸿两校快件系统'],forms:0,service:true,serviceActive:false}];if(c.type==='closeFormTab')return [{closed:0}];if(c.type==='navigate')return [{navigated:true}];if(c.type==='openForm')return [];if(c.type==='submit'){submitted++;return [{submitted:true}];}return [];};
vm.runInContext('run=fakeRun;navigate=async()=>{};',ctx);
const call=msg=>new Promise(resolve=>listener(msg,{url:'extension://index.html',tab:{id:2}},resolve));
(async()=>{const preparing=call({type:'prepare',order});await new Promise(r=>setTimeout(r,10));const cancelled=await call({type:'cancelWrite'});assert(cancelled.ok);const stopped=await preparing;assert(!stopped.ok);assert.match(stopped.error,/已取消/);assert.equal(submitted,0);const submit=await call({type:'submit',order,target:'订单申请'});assert(!submit.ok);assert.equal(submitted,0);console.log('通过：准备阶段可取消，取消后没有提交令牌且不能继续提交。');})().catch(e=>{console.error(e);process.exitCode=1;});
