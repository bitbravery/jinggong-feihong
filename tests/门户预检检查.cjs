// 门户预检：提交前先盘点门户标签，遗留调整单必须先关闭，关闭不掉或业务系统未打开就拒绝进入提交。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),policy=require('../write-policy.js');
let listener,forms=2,service=true,stuck=false,calls=[],stages=[];
const ctx={importScripts(){},FeiHongWritePolicy:policy,SourceMapping:{statuses:['订单申请','已送达'],normalize:r=>r,fingerprint:o=>o.id},
 setTimeout:fn=>setImmediate(()=>{if(stuck&&stages.some(x=>/已暂停/.test(x)))forms=0;fn();}),
 chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async m=>{stages.push(m.text);}},storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{}},scripting:{executeScript:async()=>[]}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../worker.js','utf8'),ctx);
ctx.fakeRun=async c=>{
 calls.push(c.type);
 if(c.type==='portalState')return [{tabs:['快件查询','京工飞鸿两校快件系统'],forms,service,serviceActive:true,frames:[]}];
 if(c.type==='closeFormTab'){if(!stuck)forms=Math.max(0,forms-1);return [{closed:1}];}
 if(c.type==='openForm')return [{openRequested:true}];
 if(c.type==='navigate')return [{navigated:true}];
 if(c.type==='prepare')return [{prepared:true}];
 if(c.type==='inspect')return [{matched:true,current:'订单申请'}];
 return [];
};
vm.runInContext('run=fakeRun;',ctx);
const call=msg=>new Promise(r=>listener(msg,{url:'extension://index.html',tab:{id:2}},r));
const order={id:'JGKD2026092036825',status:'订单申请'};
(async()=>{
 let r=await call({type:'prepare',order});
 assert(r.ok,r.error);
 const firstOpen=calls.indexOf('openForm'),lastClose=calls.lastIndexOf('closeFormTab');
 assert(lastClose>=0&&lastClose<firstOpen,'必须先关闭遗留调整单，再打开新的办理入口');
 assert.equal(calls.filter(t=>t==='closeFormTab').length,2,'两张遗留标签各关一次');

 forms=1;stuck=true;calls=[];
 r=await call({type:'prepare',order});
 assert(!r.ok,'关不掉时应直接报错');
 assert.match(r.error,/关不掉/,'错误要说明关不掉');
 assert.equal(calls.filter(t=>t==='closeFormTab').length,4,'最多尝试四次');
 assert(!calls.includes('openForm'),'关不掉时不得打开新表单');

 forms=0;stuck=false;service=false;calls=[];
 r=await call({type:'prepare',order});
 assert(!r.ok);assert.match(r.error,/未打开/);
 assert(!calls.includes('openForm'));
 console.log('通过：遗留标签先等门户自关、再尝试点关闭；仍关不掉则沿用现有标签继续；业务系统未打开仍直接拒绝。');
})().catch(e=>{console.error(e);process.exitCode=1;});
