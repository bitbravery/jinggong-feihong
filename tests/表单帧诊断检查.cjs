// 表单帧诊断：表单标签出现但表单页未就绪时，错误里必须带出各帧状态，而不是只说“未加载完成”。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),policy=require('../write-policy.js');
let t=0,listener,prepared=false;
const ctx={importScripts(){},FeiHongWritePolicy:policy,SourceMapping:{statuses:['订单申请','已送达'],normalize:r=>r,fingerprint:o=>o.id},
 Date:{now:()=>t},setTimeout:fn=>{t+=250;fn();},
 chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async()=>{}},storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{}},scripting:{executeScript:async()=>[]}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../worker.js','utf8'),ctx);
ctx.fakeRun=async c=>{if(c.type==='formActive')return [{formActive:true}];
 if(c.type==='portalState')return [{tabs:[],forms:0,service:true,serviceActive:true,frames:[]}];
 if(c.type==='navigate')return [{navigated:true}];
 if(c.type==='openForm')return [{openRequested:true}];
 if(c.type==='frameReport')return [
  {path:'/EIP/nonlogin/mixportal/framework.htm',ready:'complete',dh:false,radios:0},
  {path:'/EIP/cooperative/openCooperative.htm',ready:'complete',dh:false,radios:0},
  {path:'/EIP/flow/flowForm/3c9e2b168f194a628014fa4dd672971e.htm',ready:'interactive',dh:false,radios:0}];
 if(c.type==='prepare')return prepared?[{prepared:true}]:[];
 if(c.type==='inspect')return [{matched:true}];
 return [];
};
vm.runInContext('run=fakeRun;',ctx);
const call=msg=>new Promise(r=>listener(msg,{url:'extension://index.html',tab:{id:2}},r));
const order={id:'JGKD2026092036825',status:'订单申请'};
(async()=>{
 let r=await call({type:'prepare',order});
 assert(!r.ok);
 assert.match(r.error,/未能识别或准备物流调整单输入控件|原站状态表单未加载完成/);
 // v0.9.171 契约变化：页面改用中文名（原站页面：物流状态调整单（加载中）…）
 assert.match(r.error,/原站页面：/);
 assert.match(r.error,/物流状态调整单（加载中/,'错误里必须点名表单页面及其加载状态');
 assert.match(r.error,/办理页外壳（已加载/);
 assert(!/\.htm/.test(r.error),'提示里不应再出现英文页面文件名');
 prepared=true;
 r=await call({type:'prepare',order});
 assert(r.ok,r.error);
 console.log('通过：表单页未就绪时错误带出全部帧状态（含表单帧 readyState），就绪后正常进入核对。');
})().catch(e=>{console.error(e);process.exitCode=1;});
