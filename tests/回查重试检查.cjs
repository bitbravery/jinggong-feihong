// 回查重试：按单号查 0 条时在 60 秒窗口内继续重试；命中多条立即停止，不重试。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),policy=require('../write-policy.js');
let listener,t=0,q=0,script;
const ctx={importScripts(){},FeiHongWritePolicy:policy,
 SourceMapping:{statuses:['订单申请','已签收'],normalize:s=>s.rows,fingerprint:o=>o.id},
 Date:{now:()=>t},setTimeout:fn=>{t+=250;fn();},
 chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async()=>{}},storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{}},scripting:{executeScript:async()=>[]}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../worker.js','utf8'),ctx);
ctx.fakeRun=async c=>{
 if(c.type==='navigate')return [{navigated:true}];
 if(c.type==='clearTags')return [{active:0}];
 if(c.type==='queryField')return [{fieldSelected:true}];
 if(c.type==='queryOrder'){q++;return [{queryRequested:true,token:'q'+q}];}
 if(c.type==='snapshot')return [script(q)];
 return [];
};
vm.runInContext('run=fakeRun;',ctx);
const call=msg=>new Promise(r=>listener(msg,{url:'extension://index.html',tab:{id:2}},r));
const order='JGKD2026123456789';

(async()=>{
 // 1. 第一次 0 条，第二次才出现目标状态 → 必须重试并成功
 q=0;script=n=>n===1?{rows:[],total:0,probeToken:'q1',probeSettled:true}:{rows:[{id:order,status:'已签收'}],total:1,probeToken:'q2',probeSettled:true};
 let r=await call({type:'verify',id:order,target:'已签收'});
 assert(r.ok,'0 条后出现目标状态必须判定成功：'+r.error);
 assert.equal(q,2,'必须重试一次才成功');

 // 2. 命中多条 → 立即停止，不重试
 q=0;script=()=>({rows:[{id:order,status:'已签收'},{id:order,status:'已签收'}],total:2,probeToken:'q1',probeSettled:true});
 r=await call({type:'verify',id:order,target:'已签收'});
 assert(!r.ok);assert.match(r.error,/不是唯一一条/);assert.equal(q,1,'多条不能重试');
 console.log('通过：回查 0 条会在窗口内重试并在目标状态出现时成功；命中多条立即停止且不重试。');
})().catch(e=>{console.error(e);process.exitCode=1;});
