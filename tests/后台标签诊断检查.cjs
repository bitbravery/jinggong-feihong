// v1.0.23 诊断（不改行为）：批量改状态的成功记录与失败原因里写明原站标签页当时在前台还是后台、已在后台多久。
// 现场（11-13 17:18）：工作台在前、原站在后台时第 5 单报“门户没有切到调整单”，用户切到原站标签页后其余各单都顺利。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=__dirname+'/../';
const {sourceAction}=require(D+'source.js');
const SourceMapping=require(D+'mapping.js'),policy=require(D+'write-policy.js');

// 注入层：记下何时转到后台
let now=1000;const listeners={};const doc={hidden:false,addEventListener:(t,f)=>{listeners[t]=f;}};
const win={document:doc};win.top=win;
const ctx={document:doc,window:win,top:win,location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/nonlogin/mixportal/framework.htm',href:'x'},URL,Date:{now:()=>now}};
const ask=()=>vm.runInNewContext('('+sourceAction+')({type:"pageVisibility"})',ctx);
assert.equal(ask().hidden,false);
doc.hidden=true;listeners.visibilitychange();now+=42000;
const v=ask();assert.equal(v.hidden,true);assert.equal(v.hiddenFor,42000);
doc.hidden=false;listeners.visibilitychange();assert.equal(ask().hiddenFor,0);

// 编排层：失败原因末尾带上“原站标签页在后台（已 N 秒）”；原站不响应时这一步最多多花 1.5 秒
let T=1e6,listener;const c2={importScripts(){},FeiHongWritePolicy:policy,SourceMapping,FeiHongDates:{recentMonth:()=>({})},Date:{now:()=>T},setTimeout:(fn,ms)=>{T+=ms||0;setImmediate(fn);},
 chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async()=>{}},storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{},get:async()=>({})},scripting:{executeScript:async()=>[]}}};
vm.createContext(c2);vm.runInContext(fs.readFileSync(D+'worker.js','utf8'),c2);
c2.fakeRun=async c=>{if(c.type==='pageVisibility')return [{pageVisibility:true,hidden:true,hiddenFor:65000}];if(c.type==='portalState')return [{tabs:['工作台'],forms:0,service:false}];return [];};
vm.runInContext('run=fakeRun;',c2);
const call=msg=>new Promise(r=>listener(msg,{url:'extension://index.html',tab:{id:2}},r));
(async()=>{
 const r=await call({type:'prepare',order:{id:'JGKD700099',status:'已签收'}});
 assert.equal(r.ok,false);assert.match(r.error,/（原站标签页在后台（已 65 秒））$/,'失败原因没带上原站前后台状态：'+r.error);
 const w=fs.readFileSync(D+'worker.js','utf8');
 assert(/presses:\[await pressNote\(confirmToken\),await visNote\(\)\]/.test(w),'成功记录也要带上前后台状态');
 assert(/Promise\.race\(\[run\(\{type:'pageVisibility'\}\),pause\(1500\)/.test(w),'查前后台最多 1.5 秒');
 console.log('通过：成功与失败记录都写明原站标签页在前台还是后台、已在后台多久。');
})().catch(e=>{console.error(e);process.exitCode=1;});
