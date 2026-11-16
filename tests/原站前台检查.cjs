// v1.0.24：长操作期间把原站标签页切到前台（浏览器给后台标签页限速/休眠，门户切标签、加载调整单会慢到超时）。
// 现场 11-13 17:18：第 4 单被原站拒收后，扩展按老逻辑把工作台切到前面，原站进了后台，第 5 单随即“门户没有切到调整单”；
// 用户切回原站后其余各单都顺利。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=__dirname+'/../';
const SourceMapping=require(D+'mapping.js'),policy=require(D+'write-policy.js');
const SOURCE=11,BENCH=22;
function boot(fakeRun){
 let T=1e6,listener;const updates=[],focus=[],badges=[];const tabs={[SOURCE]:{id:SOURCE,active:false,windowId:1},[BENCH]:{id:BENCH,active:true,windowId:1}};
 const ctx={importScripts(){},FeiHongWritePolicy:policy,SourceMapping,FeiHongDates:{recentMonth:()=>({})},Date:{now:()=>T},setTimeout:(fn,ms)=>{T+=ms||0;setImmediate(fn);},
  chrome:{action:{onClicked:{addListener(){}},setBadgeText:async o=>{badges.push(o.text);},setBadgeBackgroundColor:async()=>{}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async()=>{}},
   storage:{session:{get:async()=>({sourceTabId:SOURCE})}},
   tabs:{get:async id=>({...tabs[id]}),update:async(id,o)=>{updates.push(id);if(o.active)for(const k in tabs)tabs[k].active=Number(k)===id;return {...tabs[id]};}},
   windows:{update:async(id,o)=>{focus.push(id);}},scripting:{executeScript:async()=>[]}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(D+'worker.js','utf8'),ctx);
 ctx.fakeRun=fakeRun;vm.runInContext('run=fakeRun;navigate=async()=>{};',ctx);
 const call=msg=>new Promise(r=>listener(msg,{url:'extension://index.html',tab:{id:BENCH}},r));
 return {call,updates,focus,badges,tabs};
}
const failingPortal=async c=>{if(c.type==='portalState')return [{tabs:['工作台'],forms:0,service:false}];return [];};
(async()=>{
 // 开始：原站切到前台（连同窗口）
 const w=boot(failingPortal);
 assert.equal((await w.call({type:'portalFront',on:true})).data.front,true);
 assert.equal(w.tabs[SOURCE].active,true,'原站标签页没切到前台');assert(w.focus.includes(1),'原站所在窗口没切到前面');
 // 用户中途切回工作台看了一眼；下一单开始前要再把原站切回前台
 w.tabs[SOURCE].active=false;w.tabs[BENCH].active=true;
 const r=await w.call({type:'prepare',order:{id:'JGKD700120',status:'已签收'},front:true});
 assert.equal(r.ok,false,'这里本来就该失败（假门户没开业务标签）');
 assert.equal(w.tabs[SOURCE].active,true,'失败后被切回了工作台，下一单又会在后台跑');
 // 结束：切回工作台
 await w.call({type:'portalFront',on:false});
 assert.equal(w.tabs[BENCH].active,true,'结束后没切回工作台');
 // 不在长操作里时，失败照旧把工作台切到前面（老行为保留给单次操作）
 const w2=boot(failingPortal);w2.tabs[SOURCE].active=true;w2.tabs[BENCH].active=false;
 await w2.call({type:'prepare',order:{id:'JGKD700121',status:'已签收'}});
 assert.equal(w2.tabs[BENCH].active,true,'单次操作失败后应切回工作台');
 // 工具栏进度
 await w.call({type:'badge',text:'3/10'});await w.call({type:'badge',text:''});
 assert.deepEqual([...w.badges],['3/10','']);
 console.log('通过：长操作开始把原站（连同窗口）切到前台，每单前再确认；途中失败不切走；结束切回工作台；进度显示在图标上。');

 // 工作台：所有长操作都包上
 const live=fs.readFileSync(D+'live.js','utf8');
 const need={
  '批量改状态':/batchStartedAt=performance\.now\(\)[\s\S]{0,400}await portalFront\(true\);/,
  '每单准备':/request\(\{type:'prepare',order,front:true\}\)/,
  '批量结束切回':/\}finally\{badge\(''\);await portalFront\(false\);if\(stageTimer\)/,
  '改回原状态':/withPortalFront\(\(\)=>request\(\{type:'revert'/,
  '批量通过/退回':/withPortalFront\(\(\)=>request\(\{type:'bulkApprove'/,
  '实际状态回查':/await portalFront\(true\);\s*for\(let i=0;i<ids\.length;i\+=200\)/,
  '历史查看原站状态':/statusBusy=true;\s*await portalFront\(true\);/,
  '近一个月/自定义时段':/await portalFront\(true\);\s*const complete=await FeiHongBulk\.scanAll/,
  '流程读取前 N 页':/await portalFront\(true\);\s*const parts=await FeiHongBulk\.scanFlows/,
 };
 for(const [k,re] of Object.entries(need))assert(re.test(live),k+' 没有在长操作期间把原站切到前台');
 assert(/badge\(\(batchIndex\+'\/'\+batchTotal\)\.length<=4\?/.test(live),'图标进度超过 4 个字时要改成只显示第几单');
 console.log('通过：批量改状态、改回、批量通过/退回、实际状态回查、查看原站状态、批量读取都在期间保持原站在前台。');
})().catch(e=>{console.error(e);process.exitCode=1;});
