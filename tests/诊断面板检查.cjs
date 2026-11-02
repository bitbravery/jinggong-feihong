// 诊断面板：只输出版本、开关、门户标签与帧路径，不把页面正文（可能含姓名电话）带出来。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),policy=require('../write-policy.js');
let listener;
const ctx={importScripts(){},FeiHongWritePolicy:policy,SourceMapping:{statuses:['订单申请'],normalize:r=>r,fingerprint:o=>o.id},
 setTimeout:fn=>setImmediate(fn),
 chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async()=>{}},storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{}},scripting:{executeScript:async()=>[]}}};
vm.createContext(ctx);vm.runInContext('var sourceAction=function(){};',ctx);
vm.runInContext(fs.readFileSync(__dirname+'/../worker.js','utf8'),ctx);
ctx.fakeRun=async c=>{
 if(c.type==='portalState')return [{tabs:['快件查询','京工飞鸿两校快件系统'],forms:0,formActive:false,service:true,serviceActive:false,frames:['/EIP/nonlogin/mixportal/framework.htm']}];
 if(c.type==='frameReport')return [
  {path:'/EIP/nonlogin/mixportal/framework.htm',ready:'complete',dh:false,radios:0,snippet:'李雷 13800000000'},
  {path:'/EIP/flow/flowForm/3c9e2b168f194a628014fa4dd672971e.htm',ready:'interactive',dh:false,radios:0,snippet:'张三 13800000000'}];
 return [];
};
vm.runInContext('run=fakeRun;',ctx);
const call=msg=>new Promise(r=>listener(msg,{url:'extension://index.html',tab:{id:2}},r));
(async()=>{
 const r=await call({type:'diagnose'});
 assert(r.ok,r.error);
 const d=r.data,version=JSON.parse(fs.readFileSync(__dirname+'/../manifest.json','utf8')).version;
 assert.equal(d.version,version);
 assert.equal(d.writes,true);
 assert.equal(d.prepared,false);
 assert.equal(d.portal.service,true);assert.equal(d.portal.forms,0);
 assert.equal(d.frames.length,2);
 for(const f of d.frames){
  // v0.9.171 契约变化：增加由路径推出的中文页面名 name（不含页面正文）
  assert.deepEqual(Object.keys(f).sort(),['dh','name','path','radios','ready'],'帧信息只能有路径/中文名/就绪/单号框/单选数');
  assert(!JSON.stringify(f).includes('138'),'不得带出电话号码');
  assert(!JSON.stringify(f).includes('李雷')&&!JSON.stringify(f).includes('张三'),'不得带出姓名');
 }
 assert.deepEqual(d.frames.map(f=>f.name),['门户外壳','物流状态调整单'],'页面要给出中文名');
 console.log('通过：诊断输出含版本、写入开关、门户标签与页面（中文名），且不包含姓名或电话。');
})().catch(e=>{console.error(e);process.exitCode=1;});
