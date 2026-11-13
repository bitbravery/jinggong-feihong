// v1.0.20：用户实测第一次读待办读到 0 条、再点一次才有 5 条——切到分类后原站先出表头、过一会儿才出行。
// 读到 0 行时要等原站加载（最多 8 秒）；一直是 0 行才认定原站确实为空，并且只有这种“确认过的空”才允许清掉本地待办。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=__dirname+'/../';
const SourceMapping=require(D+'mapping.js'),policy=require(D+'write-policy.js');
const headers=['序号','单号','物流信息','寄件人姓名','寄件人工号','寄件校区地址','收件人姓名','收件校区地址'];
const row=i=>[String(i),'JGKD70010'+i,'订单申请','甲','1','良乡','乙','中关村'];

function boot(rowsAt){
 let T=1e6,listener;const t0=T;
 const ctx={importScripts(){},FeiHongWritePolicy:policy,SourceMapping,FeiHongDates:{recentMonth:()=>({})},
  Date:{now:()=>T},setTimeout:(fn,ms)=>{T+=ms||0;setImmediate(fn);},
  chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async()=>{}},
   storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{},get:async()=>({})},scripting:{executeScript:async()=>[]}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(D+'worker.js','utf8'),ctx);
 ctx.fakeRun=async c=>{
  if(c.type==='flowWhere')return [];
  if(c.type==='flowTab')return [{flowSelected:true,active:'待办'}];
  if(c.type==='page')return [{pageRequested:1,unchanged:true}];
  if(c.type==='snapshot'){const n=T-t0>=rowsAt?5:0;return [{kind:'flow',path:'/EIP/cooperative/toDoList.htm',pathTab:'待办',active:'待办',headers,rows:Array.from({length:n},(_,i)=>row(i+1)),rowIds:[],page:1,pageSize:10,total:n}];}
  return [];};
 vm.runInContext('run=fakeRun;navigate=async()=>{};',ctx);
 return {call:msg=>new Promise(r=>listener(msg,{url:'extension://index.html',tab:{id:2}},r)),elapsed:()=>T-t0};
}
(async()=>{
 // 1) 原站 3 秒后才出行：第一次读取就要拿到 5 条
 const a=boot(3000);const r=await a.call({type:'read',kind:'flow',flowTab:'待办'});
 assert(r.ok,r.error);assert.equal(r.data.rows.length,5,'第一次读取读到 0 条（没等原站加载）');
 assert(!r.data.emptyConfirmed);
 // 2) 原站确实没有待办：等满 8 秒左右后返回空，并标明“确认过的空”
 const b=boot(Infinity);const e=await b.call({type:'read',kind:'flow',flowTab:'待办'});
 assert(e.ok,e.error);assert.equal(e.data.rows.length,0);assert.equal(e.data.emptyConfirmed,true);
 assert(b.elapsed()>=8000&&b.elapsed()<15000,'空列表应等约 8 秒，实际 '+b.elapsed()+' 毫秒');
 // 3) 「读取前 N 页」走的 flowFirst 同样要等
 const c=boot(3000);const f=await c.call({type:'flowFirst',flowTab:'待办'});
 assert(f.ok,f.error);assert.equal(f.data.rows.length,5,'读取前 N 页第一次也读到 0 条');

 // 4) 工作台：没确认过的空列表不能清掉本地待办；确认过的可以
 const live=fs.readFileSync(D+'live.js','utf8');
 const s1=live.indexOf('// replace=true'),s2=live.indexOf('// 所有读取都做加法');
 const L=new Function('SourceMapping',`let records={query:[],flow:[]},snapshots={query:null,flow:null},lastReadError='';
${live.slice(s1,s2)};return {get records(){return records},setSnapshotExtra};`)(SourceMapping);
 const snap=(rows,extra={})=>({kind:'flow',flowTab:'待办',headers,rows,page:1,pageSize:10,total:rows.length,readAt:'t',...extra});
 L.setSnapshotExtra(snap([row(1),row(2)]));
 L.setSnapshotExtra(snap([]));
 assert.equal(L.records.flow.length,2,'一次没等加载的空读取清掉了本地待办');
 L.setSnapshotExtra(snap([],{emptyConfirmed:true}));
 assert.equal(L.records.flow.length,0,'确认原站为空后应清掉本地待办');
 console.log('通过：待办第一次读取会等原站加载出行；确认为空才清本地待办；读取前 N 页同样处理。');
})().catch(e=>{console.error(e);process.exitCode=1;});
