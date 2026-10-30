// 完成信号兜底：门户迟迟不关闭调整单标签时，不再直接判失败，而是标记 completion=unknown 交给回读；
// 同时必须持续把阶段（等待“确定”/等待完成）写回工作台。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),policy=require('../write-policy.js');
let listener,t=0,stages=[],confirmCalls=0;
const ctx={importScripts(){},FeiHongWritePolicy:policy,SourceMapping:{statuses:['订单申请','已签收'],normalize:r=>r,fingerprint:o=>o.id},
 Date:{now:()=>t},setTimeout:fn=>{t+=250;fn();},
 chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async m=>{stages.push(m.text);}},storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{}},scripting:{executeScript:async()=>[]}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../worker.js','utf8'),ctx);
const order={id:'JGKD2026092136917',status:'订单申请'};
ctx.fakeRun=async c=>{
 if(c.type==='portalState')return [{tabs:[],forms:0,service:true,serviceActive:true,frames:[]}];
 if(c.type==='closeFormTab')return [{closed:0}];
 if(c.type==='navigate')return [{navigated:true}];
 if(c.type==='openForm')return [{openRequested:true}];
 if(c.type==='prepare')return [{prepared:true}];
 if(c.type==='inspect')return [{matched:true}];
 if(c.type==='armSubmission')return [{armed:true}];
 if(c.type==='submit')return [{submitted:true}];
 if(c.type==='confirmSubmit'){confirmCalls++;return confirmCalls<30?[{waiting:true}]:[{confirmed:true}];}
 if(c.type==='submissionStatus')return [{forms:1,formActive:true,serviceActive:false,confirmOpen:confirmCalls<30}];
 if(c.type==='submissionComplete')return [{waiting:true}];
 if(c.type==='frameReport')return [{path:'/EIP/nonlogin/mixportal/framework.htm',ready:'complete'}];
 return [];
};
vm.runInContext('run=fakeRun;',ctx);
const call=msg=>new Promise(r=>listener(msg,{url:'extension://index.html',tab:{id:2}},r));
(async()=>{
 let r=await call({type:'prepare',order});assert(r.ok,r.error);
 r=await call({type:'submit',order,target:'已签收'});
 assert(r.ok,'完成信号缺失不应直接判失败：'+r.error);
 assert.equal(r.data.completion,'confirmed');
 assert(stages.some(s=>/等待原站点“确定”/.test(s)),'必须上报等待确认弹窗的阶段');
 assert(stages.some(s=>/弹窗已出现/.test(s)),'必须上报确认弹窗是否出现');
 assert(!stages.some(s=>/等待门户提交完成/.test(s)),'确认后不等待门户刷新');
 assert(!stages.some(s=>/回读核验/.test(s)),'提交不触发回读');
 console.log('通过：门户不关标签时标记 completion=unknown 交给回读，并全程上报“确定/完成”阶段状态。');
})().catch(e=>{console.error(e);process.exitCode=1;});
