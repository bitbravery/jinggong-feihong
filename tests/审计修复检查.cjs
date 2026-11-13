// v1.0.17：审计 P1/P2 修复——全部执行真实代码，不做文本匹配。
// 1) 已办回查到的真实状态不会被重读“已办”覆盖回订单申请
// 2) 待办读到完整列表时整类替换：已通过/退回的单从本地待办消失
// 3) 精确查询：联系人一个都没联动出来时报“读不到”，不把表单默认勾选当真实状态
// 4) 已办回查超过 300 个单号时不悄悄丢单
// 5) 字号后台存取范围与工作台一致（10–40，默认 30）
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=__dirname+'/../';
const SourceMapping=require(D+'mapping.js'),policy=require(D+'write-policy.js');
const live=fs.readFileSync(D+'live.js','utf8');

// —— 取出 live.js 里的合并相关函数原文执行 ——
const a=live.indexOf('// replace=true'),b=live.indexOf('function setSnapshotExtra');
assert(a>0&&b>a,'找不到 mergeParsed/wholeTodo 原文');
const records={query:[],flow:[]};
const {mergeParsed,wholeTodo}=new Function('records','SourceMapping',live.slice(a,b)+';return {mergeParsed,wholeTodo};')(records,SourceMapping);
const headers=['序号','单号','物流信息','寄件人姓名','寄件人工号','寄件校区地址','收件人姓名','收件校区地址'];
const row=(n,id,st)=>[String(n),id,st,'甲','1','良乡','乙','中关村'];
const snap=(tab,rows,total,extra={})=>({kind:'flow',flowTab:tab,headers,rows,page:1,total,rowIds:rows.map((_,i)=>'r'+i),readAt:'t',...extra});
const load=s=>mergeParsed(SourceMapping.normalize(s),'flow',s.flowTab,{replace:wholeTodo(s)});

// 1) 回查后再读已办
load(snap('已办',[row(1,'JGKD900001','订单申请')],1));
records.flow=records.flow.map(o=>o.id==='JGKD900001'?{...o,status:'已签收',statusSource:'query'}:o);
load(snap('已办',[row(1,'JGKD900001','订单申请')],1));
const done1=records.flow.find(o=>o.id==='JGKD900001');
assert.equal(done1.status,'已签收','已回查的真实状态被重读覆盖了');
assert.equal(done1.statusSource,'query');
// 没回查过的已办行照常用原站列表的值
load(snap('已办',[row(1,'JGKD900001','订单申请'),row(2,'JGKD900004','订单申请')],2));
assert.equal(records.flow.find(o=>o.id==='JGKD900004').status,'订单申请');
console.log('通过：已办回查到的真实状态不会被重读覆盖；未回查的行照常更新。');

// 2) 待办：两单 → 原站通过后待办为空 → 重读
load(snap('待办',[row(1,'JGKD900002','订单申请'),row(2,'JGKD900003','订单申请')],2));
assert.equal(records.flow.filter(o=>o.flow==='待办').length,2);
// v1.0.20：空列表只有后台等过加载、确认为空（emptyConfirmed）才算完整
assert.equal(load(snap('待办',[],0)).removed,0,'没确认过的空读取清掉了本地待办');
const r2=load(snap('待办',[],0,{emptyConfirmed:true}));
assert.equal(records.flow.filter(o=>o.flow==='待办').length,0,'通过后的单仍留在本地待办');
assert.equal(r2.removed,2);
assert(records.flow.some(o=>o.id==='JGKD900001'&&o.flow==='已办'),'整类替换待办时不能动已办');
// 只读到一部分（总数 > 本页行数）时不能替换，旧行保留
load(snap('待办',[row(1,'JGKD900005','订单申请'),row(2,'JGKD900006','订单申请')],2));
load(snap('待办',[row(1,'JGKD900005','订单申请')],30));
assert(records.flow.some(o=>o.id==='JGKD900006'&&o.flow==='待办'),'只读到部分待办时误删了旧行');
// 总数认不出时也不替换
load(snap('待办',[],null));
assert.equal(records.flow.filter(o=>o.flow==='待办').length,2);
console.log('通过：待办读到完整列表才整类替换；只读到部分或总数不明时保留旧行。');

// —— worker.js 在 vm 里跑，原站动作用假 run 代替 ——
function boot(fakeRun,store={}){
 let T=1e6,listener;
 const ctx={importScripts(){},FeiHongWritePolicy:policy,SourceMapping,FeiHongDates:{recentMonth:()=>({})},
  Date:{now:()=>T},setTimeout:(fn,ms)=>{T+=ms||0;setImmediate(fn);},
  chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async()=>{}},
   storage:{session:{get:async()=>({sourceTabId:1})},local:{get:async k=>({[k]:store[k]}),set:async o=>Object.assign(store,o)}},
   tabs:{update:async()=>{},get:async()=>({})},scripting:{executeScript:async()=>[]}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(D+'worker.js','utf8'),ctx);
 ctx.fakeRun=fakeRun;vm.runInContext('run=fakeRun;navigate=async()=>{};',ctx);
 return msg=>new Promise(res=>listener(msg,{url:'extension://index.html',tab:{id:2}},res));
}
const empty={JJRGH:'',JJRXM:'',JJRDH:'',JJDZXQ:'',JJDZYL:'',JJDZFJH:'',SJRXM:'',SJRDH:'',SJXQDZ:'',SJDZYL:'',SJDZFJH:''};
function formPortal(id,fields){
 let opened=false;
 return async c=>{
  if(c.type==='portalState')return [{tabs:['京工飞鸿两校快件系统'],active:opened?'物流状态调整单':'京工飞鸿两校快件系统',forms:opened?1:0,service:true}];
  if(c.type==='openForm'){opened=true;return [{openRequested:true}];}
  if(c.type==='navigate')return [{navigated:true}];
  if(c.type==='prepare')return [{prepared:true}];
  if(c.type==='readForm')return [{dh:id,current:'订单申请',fields:{DH:id,...fields}}];
  return [];
 };
}
(async()=>{
 // 3) 精确查询
 const id='JGKD900009';
 const bad=await boot(formPortal(id,empty))({type:'statusOf',id});
 assert.equal(bad.ok,false,'联系人都没联动时不能返回状态');
 assert.match(bad.error,/没有联动出这一单的订单信息/);
 const good=await boot(formPortal(id,{...empty,JJRXM:'甲',SJRXM:'乙'}))({type:'statusOf',id});
 assert.equal(good.ok,true,good.error);assert.equal(good.data.status,'订单申请');
 console.log('通过：精确查询在未联动时报“读不到”，联动出联系人后照常返回状态。');

 // 4) 超过 300 个单号
 const ids=Array.from({length:350},(_,i)=>'JGKD'+(800000+i));let cur='';const progress=[];
 const call=boot(async c=>{
  if(c.type==='portalState')return [{tabs:['快件查询'],active:'快件查询',forms:0}];
  if(c.type==='clearTags')return [{active:0}];
  if(c.type==='queryField'){cur=c.id;return [{fieldSelected:true}];}
  if(c.type==='queryOrder')return [{queryRequested:true,token:'t'+c.id}];
  if(c.type==='snapshot')return [{kind:'query',rows:[[cur,'已签收','甲','1','良乡','乙','中关村']],headers:['单号','物流信息','寄件人姓名','寄件人工号','寄件校区地址','收件人姓名','收件校区地址'],total:1,probeToken:'t'+cur,probeSettled:true}];
  if(c.type==='closeQuery')return [{closed:true}];
  return [];
 });
 const one=await call({type:'syncFlowStatus',ids});
 assert.equal(Object.keys(one.data.statuses).length+one.data.failures.length,350,'一次发 350 个时有单号既没查到也没进失败清单');
 assert.equal(one.data.total,350);
 // 工作台的实际做法：按 200 个一批，进度按总数换算
 const got={};
 for(let i=0;i<ids.length;i+=200){const r=await call({type:'syncFlowStatus',ids:ids.slice(i,i+200),offset:i,grand:ids.length});Object.assign(got,r.data.statuses);}
 assert.equal(Object.keys(got).length,350,'分批后应全部查到');
 assert(live.includes("request({type:'syncFlowStatus',ids:part,offset:i,grand:ids.length})"),'工作台「实际状态回查」要按批发送');
 console.log('通过：回查超过 300 个单号不再丢单；工作台按 200 个一批发送。');

 // 5) 字号
 const store={},font=boot(async()=>[],store);
 for(const px of [30,40,10]){
  const s=await font({type:'pageFont',action:'set',px});assert.equal(s.data.px,px);
  const g=await font({type:'pageFont',action:'get'});assert.equal(g.data.px,px,'存 '+px+' 读回来变了');
 }
 assert.equal((await font({type:'pageFont',action:'set',px:99})).data.px,40);
 assert.equal((await font({type:'pageFont',action:'set'})).data.px,30,'缺省应为 30');
 const m=live.match(/min:10,max:(\d+),base:14,defaultPx:(\d+)/);assert(m&&m[1]==='40'&&m[2]==='30','工作台字号范围应为 10–40、默认 30');
 console.log('通过：字号后台存取与工作台一致（10–40，默认 30）。');
})().catch(e=>{console.error(e);process.exitCode=1;});
