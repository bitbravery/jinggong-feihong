// 改回原状态：走“打开调整单→填单号→等联动出联系人→核对原站现状仍是上次目标→选目标→提交→确认”，不依赖查询页。
// v0.9.164 契约变化：必须带 to（上次改成的状态）；新表单“当前状态”默认勾第一项，联系人未联动时不得据此判断或提交；
// 原站现状 ≠ to 时说明之后被别人改过，不覆盖。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),policy=require('../write-policy.js');

// ---------- A. worker 编排 ----------
let listener,t=0,calls=[];
const ctx={importScripts(){},FeiHongWritePolicy:policy,SourceMapping:{statuses:['订单申请','已揽件','发出/派送中','已送达','已签收'],normalize:r=>r,fingerprint:o=>o.id},
 Date:{now:()=>t},setTimeout:fn=>{t+=250;fn();},
 chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async()=>{}},storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{}},scripting:{executeScript:async()=>[]}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../worker.js','utf8'),ctx);
const ID='JGKD2026092036825';
let current='已送达',forms=1,linkAfter=0,submitCmd=null;
ctx.fakeRun=async c=>{if(c.type==='formActive')return [{formActive:true}];
 calls.push(c.type);
 if(c.type==='portalState')return [{tabs:['京工飞鸿两校快件系统','物流状态调整单'],forms,formActive:false,service:true,serviceActive:true,frames:[]}];
 if(c.type==='closeFormTab'){forms=Math.max(0,forms-1);return [{closed:1}];}
 if(c.type==='navigate')return [{navigated:true}];
 if(c.type==='openForm')return [{openRequested:true}];
 if(c.type==='prepare')return [{prepared:true}];
 if(c.type==='pokeForm'||c.type==='pressEnter')return [{poked:true}];
 // 联动前：联系人为空、当前状态是表单默认的“订单申请”
 if(c.type==='readForm'){const linked=t>=linkAfter;return [{dh:ID,fields:{DH:ID,JJRXM:linked?'张三':'',SJRXM:linked?'李四':''},current:linked?current:'订单申请'}];}
 if(c.type==='armSubmission')return [{armed:true}];
 if(c.type==='submitBare'){submitCmd=c;return [{submitted:true}];}
 if(c.type==='confirmSubmit')return [{confirmed:true}];
 return [];
};
vm.runInContext('run=fakeRun;',ctx);
const call=msg=>new Promise(r=>listener(msg,{url:'extension://index.html',tab:{id:2}},r));

(async()=>{
 // 1) 正常改回：联动较慢（2 秒后才出），期间不得把默认勾选当成当前状态
 linkAfter=t+2000;
 let r=await call({type:'revert',id:ID,from:'订单申请',to:'已送达'});
 assert(r.ok,r.error);
 assert.equal(r.data.submitted,true);assert.equal(r.data.from,'已送达');assert.equal(r.data.to,'订单申请');
 assert.equal(submitCmd.expect,'已送达','提交时要把预期现状带给注入层再核一次');
 assert.equal(calls.includes('queryField')||calls.includes('queryOrder'),false,'改回不得依赖查询页');
 assert(calls.includes('readForm')&&calls.includes('submitBare'),'必须走打开表单+读状态+提交');

 // 2) 原站已是原状态：联动出来后才判断，直接返回不提交
 current='订单申请';calls=[];linkAfter=t+1000;
 r=await call({type:'revert',id:ID,from:'订单申请',to:'已送达'});
 assert(r.ok);assert.equal(r.data.already,true,'已经是原状态要直接返回');
 assert(!calls.includes('submitBare'),'不需要改回时不得提交');

 // 3) 原站现状既不是原状态也不是上次目标：被别人改过，不覆盖
 current='已签收';calls=[];linkAfter=t;
 r=await call({type:'revert',id:ID,from:'订单申请',to:'已送达'});
 assert(!r.ok);assert.match(r.error,/可能已被他人修改/);assert(!calls.includes('submitBare'),'现状≠上次目标时不得提交');

 // 4) 一直不联动：补点空白、回车后放弃，不提交
 current='已送达';calls=[];linkAfter=Infinity;
 r=await call({type:'revert',id:ID,from:'订单申请',to:'已送达'});
 assert(!r.ok);assert.match(r.error,/仍未出订单信息/);
 assert(calls.includes('pokeForm')&&calls.includes('pressEnter'),'要按 点空白→回车 补触发');
 assert(!calls.includes('submitBare'),'未联动不得提交');

 // 5) 缺少 to（旧数据/旧页面）：拒绝
 calls=[];linkAfter=t;
 r=await call({type:'revert',id:ID,from:'订单申请'});
 assert(!r.ok);assert.match(r.error,/缺少上次修改的目标状态/);assert.equal(calls.length,0,'缺 to 时不得碰原站');

 // ---------- B. 表单侧 submitBare ----------
 const src=fs.readFileSync(__dirname+'/../source.js','utf8');
 const statuses=['订单申请','已揽件','发出/派送中','已送达','已签收'];
 const makeCtx=(dh,currentStatus,names=true)=>{
  let clicked=0;
  const mk=(g,i,checked)=>({value:statuses[i],id:'mini-'+g+'$ck$'+i,checked,click(){this.checked=true;}});
  const radios=[...statuses.map((v,i)=>mk(1,i,i===statuses.indexOf(currentStatus))),...statuses.map((v,i)=>mk(2,i,false))];
  const send={innerText:'提交',click(){clicked++;}};
  const vals={'DH$text':dh,'JJRXM$text':names?'张三':'','SJRXM$text':names?'李四':''};
  const document={getElementById:id=>id in vals?{value:vals[id]}:null,querySelectorAll:s=>s==='input[type="radio"]'?radios:[]};
  const window={mini:{get:()=>({setValue(){}})},parent:{document:{getElementById:()=>send}}};
  const sessionStorage={store:{},getItem(k){return this.store[k]??null;},setItem(k,v){this.store[k]=v;},removeItem(k){delete this.store[k];}};
  const ctx2={module:{exports:{}},window,document,sessionStorage,location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/flow/flowForm/3c9e2b168f194a628014fa4dd672971e.htm'},URL,Date,getComputedStyle:()=>({visibility:'visible'}),MouseEvent:class{}};
  vm.createContext(ctx2);vm.runInContext(src,ctx2);
  return {act:ctx2.module.exports.sourceAction,getClicked:()=>clicked,radios,sessionStorage};
 };
 let c=makeCtx(ID,'订单申请');
 let out=c.act({type:'submitBare',order:{id:ID},target:'已送达'});
 assert(out.submitted);assert.equal(c.getClicked(),1);assert(c.radios[5+3].checked,'必须选中目标状态');
 assert(c.sessionStorage.getItem('feihongSubmitIntent'),'必须写入一次性确认意图');

 c=makeCtx(ID,'已送达');
 out=c.act({type:'submitBare',order:{id:ID},target:'已送达'});
 assert.match(out.error||'',/相同/);assert.equal(c.getClicked(),0);

 c=makeCtx('JGKD0000000000000','订单申请');
 out=c.act({type:'submitBare',order:{id:ID},target:'已送达'});
 assert(out.waiting);assert.equal(c.getClicked(),0);

 c=makeCtx(ID,'订单申请',false);
 out=c.act({type:'submitBare',order:{id:ID},target:'已送达'});
 assert(out.waiting,'联系人未联动时只是默认勾选，必须等待');assert.equal(c.getClicked(),0);

 c=makeCtx(ID,'已签收');
 out=c.act({type:'submitBare',order:{id:ID},target:'订单申请',expect:'已送达'});
 assert.match(out.error||'',/不是预期/);assert.equal(c.getClicked(),0,'提交瞬间现状≠预期不得提交');
 console.log('通过：改回先等联动出联系人，现状须仍是上次目标才提交；已是原状态不提交；被他人改过不覆盖；不联动/缺目标状态不提交。');
})().catch(e=>{console.error(e);process.exitCode=1;});
