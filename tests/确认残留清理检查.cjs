// 残留确认框：开单前必须先清掉上一次遗留的「您确定要提交吗」，否则下一单会在坏弹窗上继续按。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),policy=require('../write-policy.js');
const src=fs.readFileSync(__dirname+'/../worker.js','utf8');
function harness(residues){
  let listener;const stages=[];let dismissed=0;let residueCalls=0;
  const ctx={importScripts(){},FeiHongWritePolicy:policy,
    SourceMapping:{statuses:['订单申请','已签收'],normalize:r=>r,fingerprint:o=>o.id},
    Date:Date,setTimeout:fn=>setImmediate(fn),
    chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async m=>{stages.push(m.text);}},storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{}},scripting:{executeScript:async()=>[]}}};
  vm.createContext(ctx);vm.runInContext(src,ctx);
  ctx.fakeRun=async c=>{
    if(c.type==='portalState')return [{tabs:[],forms:0,service:true,serviceActive:true,frames:[]}];
    if(c.type==='confirmResidue'){const v=residues[Math.min(residueCalls++,residues.length-1)];return [{residue:v}];}
    if(c.type==='confirmDismiss'){dismissed++;return [{dismissed:1,left:0}];}
    if(c.type==='navigate')return [{navigated:true}];
    if(c.type==='openForm')return [{openRequested:true}];
    if(c.type==='closeFormTab')return [{closed:0}];
    if(c.type==='prepare')return [{prepared:true}];
    if(c.type==='inspect')return [{matched:true}];
    return [];
  };
  vm.runInContext('run=fakeRun;',ctx);
  return {call:msg=>new Promise(r=>listener(msg,{url:'extension://index.html',tab:{id:2}},r)),stages,stats:()=>({dismissed,residueCalls})};
}
(async()=>{
  const order={id:'JGKD202610238276',status:'订单申请'};
  let h=harness([1,0]);
  let r=await h.call({type:'prepare',order});
  assert(r.ok,'残留清掉后应能继续：'+r.error);
  assert.equal(h.stats().dismissed,1,'应尝试关闭一次残留弹窗');
  assert(h.stages.some(s=>/清理上一次遗留的确认框/.test(s)),'应有清理阶段提示');

  // 清不掉时：暂停并等人手动关掉（最多 120 秒），关掉后自动继续
  h=harness([1,1,1,0]);
  r=await h.call({type:'prepare',order});
  assert(r.ok,'手动关掉残留后应继续：'+r.error);
  assert(h.stages.some(s=>/请到原站点「取消」关闭上一单确认框/.test(s)),'暂停时要提示手动关闭');
  console.log('通过：开单前清理残留确认框；清不掉则暂停等手动关闭，关掉后自动继续。');
})().catch(e=>{console.error(e);process.exitCode=1;});

