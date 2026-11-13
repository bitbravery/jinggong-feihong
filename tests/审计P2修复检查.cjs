// v1.0.18：审计 P2 修复——执行真实代码（live.js 片段 / worker.js / source.js），不做文本匹配（第 19 项 CSS 除外）。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=__dirname+'/../';
const SourceMapping=require(D+'mapping.js'),policy=require(D+'write-policy.js'),FeiHongAudit=require(D+'audit-history.js');
const {sourceAction}=require(D+'source.js');
const live=fs.readFileSync(D+'live.js','utf8');

// ============ live.js：合并、快照、写后状态、历史保存 ============
const a=live.indexOf('// replace=true'),b=live.indexOf('// 所有读取都做加法');
assert(a>0&&b>a,'找不到 live.js 合并/快照原文');
const L=new Function('SourceMapping',`let records={query:[],flow:[]},snapshots={query:null,flow:null},lastReadError='';
${live.slice(a,b)};return {get records(){return records},set records(v){records=v},snapshots,mergeParsed,setSnapshotExtra,markWritten};`)(SourceMapping);
const qh=['序号','单号','物流信息','寄件人姓名','寄件人工号','寄件校区地址','收件人姓名','收件校区地址'];
const row=(n,id,st)=>[String(n),id,st,'甲','1','良乡','乙','中关村'];

// #6/#7：读取当前页后保留原站的每页条数与总数；本次读回行数与本地合并条数分开
L.setSnapshotExtra({kind:'query',headers:qh,rows:[row(1,'JGKD700001','已揽件'),row(2,'JGKD700002','已揽件')],page:1,pageSize:100,total:643,readAt:'t'},{singlePage:true});
L.setSnapshotExtra({kind:'query',headers:qh,rows:[row(1,'JGKD700003','已揽件')],page:1,pageSize:100,total:643,readAt:'t'},{singlePage:true});
let s=L.snapshots.query;
assert.equal(s.pageSize,100,'读取当前页后每页条数被清空，“下一页”永远不可点');
assert.equal(s.total,643,'快照总数应保持原站总数');
assert.equal(s.fetched,1);assert.equal(s.localCount,3);
const nextDisabled=new Function('busy','s',`return ${live.match(/\$\('nextPage'\)\.disabled=([^;]+);/)[1]};`);
assert.equal(nextDisabled(false,s),false,'原站第 1 页、共 643 条时“下一页”应可点');
assert.equal(nextDisabled(false,{...s,page:7}),true,'最后一页时“下一页”应禁用');
console.log('通过：读取当前页后保留原站每页条数和总数，“下一页”可用；本地合并条数另记。');

// #11：确认提交后本地状态跟着变；随后读到「快件查询」以原站为准，读到「已办」流程列表不覆盖
L.records={query:[],flow:[]};
L.setSnapshotExtra({kind:'query',headers:qh,rows:[row(1,'JGKD700010','已揽件')],page:1,pageSize:100,total:1,readAt:'t'});
L.setSnapshotExtra({kind:'flow',flowTab:'已办',headers:qh,rows:[row(1,'JGKD700010','订单申请')],page:1,pageSize:10,total:1,readAt:'t'});
assert.equal(L.markWritten('JGKD700010','已送达'),2);
assert(L.records.query.concat(L.records.flow).every(o=>o.status==='已送达'&&o.statusSource==='write'));
L.setSnapshotExtra({kind:'flow',flowTab:'已办',headers:qh,rows:[row(1,'JGKD700010','订单申请')],page:1,pageSize:10,total:1,readAt:'t'});
assert.equal(L.records.flow[0].status,'已送达','已办流程列表的“订单申请”覆盖了刚改的状态');
L.setSnapshotExtra({kind:'query',headers:qh,rows:[row(1,'JGKD700010','已签收')],page:1,pageSize:100,total:1,readAt:'t'});
assert.equal(L.records.query[0].status,'已签收','快件查询读到的原站状态应覆盖');
assert.notEqual(L.records.query[0].statusSource,'write');
console.log('通过：改成功后本地状态随之更新；快件查询以原站为准，已办流程列表不覆盖。');

// #12：两个工作台交替保存历史，不互相覆盖
const s1=live.indexOf('function storedAudit'),s2=live.indexOf('async function loadDurableAudit');
assert(s1>0&&s2>s1,'找不到 save 原文');
const storage={};const ls={getItem:k=>k in storage?storage[k]:null,setItem:(k,v)=>{storage[k]=String(v);}};
const tab=()=>new Function('localStorage','FeiHongAudit','chrome',`const key='feihong-connector-settings-v1';let audit=[],mappings={},campus='良乡';function saveMappings(){return true;}function toast(){}
${live.slice(s1,s2)};return {push(h){audit.push(h);return save();},get audit(){return audit;}};`)(ls,FeiHongAudit,{storage:{local:{set:async()=>{}}}});
const A=tab(),B=tab(),now=Date.now();
const h=(id,i)=>({iso:new Date(now-i*1000).toISOString(),id,from:'订单申请',to:'已揽件',action:'物流状态调整',result:'已确认提交（x）'});
A.push(h('JGKD700021',3));B.push(h('JGKD700022',2));A.push(h('JGKD700023',1));
const saved=JSON.parse(storage['feihong-connector-settings-v1']).audit.map(x=>x.id).sort();
assert.deepEqual(saved,['JGKD700021','JGKD700022','JGKD700023'],'旧工作台保存时覆盖掉了新工作台的记录');
console.log('通过：多个工作台交替保存历史不再互相覆盖。');

// ============ worker.js：原站动作用假 run ============
function boot(fakeRun,{store={}}={}){
 let T=1e6,listener;
 const ctx={importScripts(){},FeiHongWritePolicy:policy,SourceMapping,FeiHongDates:{recentMonth:()=>({})},
  Date:{now:()=>T},setTimeout:(fn,ms)=>{T+=ms||0;setImmediate(fn);},
  chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async()=>{}},
   storage:{session:{get:async()=>({sourceTabId:1})},local:{get:async k=>({[k]:store[k]}),set:async o=>Object.assign(store,o)}},
   tabs:{update:async()=>{},get:async()=>({}),query:async()=>[]},scripting:{executeScript:async()=>[]}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(D+'worker.js','utf8'),ctx);
 ctx.fakeRun=fakeRun;vm.runInContext('run=fakeRun;navigate=async()=>{};',ctx);
 const call=msg=>new Promise(res=>listener(msg,{url:'extension://index.html',tab:{id:2}},res));
 return {call,ctx,now:()=>T};
}

(async()=>{
 // #8：快件查询不在前台时，closeQuery 不报“已关闭”，后台也不空转 12 轮
 {
  let n=0;const w=boot(async c=>{if(c.type==='closeQuery'){n++;return [{wrongTab:true}];}return [];});
  const closed=await vm.runInContext('closeQueryPanel()',w.ctx);
  assert.equal(closed,false);assert.equal(n,1,'wrongTab 时应立即返回');
  console.log('通过：快件查询不在前台时，关闭查询如实返回“未关闭”且不空转。');
 }

 // #9：改回原状态与批量改状态同一判据（“提交成功”且调整单自动关闭）
 const revertRun=({toast,close})=>{let forms=1,submitted=false;const ID='JGKD700030';return async c=>{
  if(c.type==='formActive')return [{formActive:true}];
  if(c.type==='portalState')return [{tabs:['京工飞鸿两校快件系统','物流状态调整单'],forms,service:true}];
  if(c.type==='openForm')return [{openRequested:true}];
  if(c.type==='navigate')return [{navigated:true}];
  if(c.type==='prepare')return [{prepared:true}];
  if(c.type==='readForm')return [{dh:ID,fields:{DH:ID,JJRXM:'甲',SJRXM:'乙'},current:submitted?'订单申请':'已送达'}];
  if(c.type==='armSubmission')return [{armed:true}];
  if(c.type==='submitBare'){submitted=true;if(close)forms=0;return [{submitted:true}];}
  if(c.type==='confirmSubmit')return [toast?{confirmed:true,via:'toast'}:{submissionComplete:true}];
  if(c.type==='toastState')return [{toast:!!toast}];
  return [];};};
 {
  const only=await boot(revertRun({toast:true,close:false})).call({type:'revert',id:'JGKD700030',from:'订单申请',to:'已送达'});
  assert.equal(only.ok,false,'只有“提交成功”、标签没关时不能记改回成功');
  assert.match(only.error,/结果不明/);
  const both=await boot(revertRun({toast:true,close:true})).call({type:'revert',id:'JGKD700030',from:'订单申请',to:'已送达'});
  assert.equal(both.ok,true,both.error);assert.equal(both.data.basis,'提交成功+调整单自动关闭');
  console.log('通过：改回原状态要“提交成功”与调整单自动关闭同时出现，否则记结果不明。');
 }

 // #10a：开始批量前的预检——原站一直在保存时停下，不关调整单
 {
  const cmds=[];const w=boot(async c=>{cmds.push(c.type);
   if(c.type==='portalState')return [{tabs:['京工飞鸿两校快件系统','物流状态调整单'],forms:1,service:true}];
   if(c.type==='portalBusy')return [{busy:true}];return [];});
  const r=await w.call({type:'statusPreflight'});
  assert.equal(r.ok,false,'保存超过 90 秒仍继续了');assert.match(r.error,/加载中/);
  assert(!cmds.includes('closeFormTab'),'原站保存中关了调整单');
 }
 // #10b：提交后“提示框点 3 次仍未关闭”且原站在保存——不关调整单，记结果不明
 {
  const ID='JGKD700040',order={id:ID,status:'已揽件',sender:'甲',receiver:'乙'};let active='京工飞鸿两校快件系统',forms=0;const cmds=[];
  const w=boot(async c=>{cmds.push(c.type);
   if(c.type==='portalState')return [{tabs:['京工飞鸿两校快件系统'].concat(forms?['物流状态调整单']:[]),active,forms,service:true}];
   if(c.type==='formActive')return [{formActive:active==='物流状态调整单'}];
   if(c.type==='openForm'){forms=1;active='物流状态调整单';return [{openRequested:true}];}
   if(c.type==='navigate')return [{navigated:true}];
   if(c.type==='prepare')return [{prepared:true}];
   if(c.type==='inspect')return [{matched:true,current:'已揽件',names:{}}];
   if(c.type==='armSubmission')return [{armed:true}];
   if(c.type==='submit')return [{submitted:true}];
   if(c.type==='confirmSubmit')return [{error:'提示框连续点 3 次「确定」仍未关闭，本单放弃。'}];
   if(c.type==='portalBusy')return [{busy:cmds.includes('submit')}];
   return [];});
  const p=await w.call({type:'prepare',order});assert.equal(p.ok,true,p.error);
  const r=await w.call({type:'submit',order,target:'已送达'});
  assert.equal(r.ok,false);assert.match(r.error,/结果不明/);
  assert(!cmds.slice(cmds.indexOf('submit')).includes('closeFormTab'),'原站保存中关了调整单');
  console.log('通过：原站正在保存时，预检与“提示框点 3 次”两处都不再关调整单。');
 }

 // #13：「实际状态回查」可中途停止，剩余单号进失败清单
 {
  const ids=['JGKD700051','JGKD700052','JGKD700053','JGKD700054','JGKD700055'];let cur='',w;
  w=boot(async c=>{
   if(c.type==='portalState')return [{tabs:['快件查询'],active:'快件查询',forms:0}];
   if(c.type==='clearTags')return [{active:0}];
   if(c.type==='queryField'){cur=c.id;if(c.id===ids[1])w.call({type:'cancelSync'});return [{fieldSelected:true}];}
   if(c.type==='queryOrder')return [{queryRequested:true,token:'t'+c.id}];
   if(c.type==='snapshot')return [{kind:'query',rows:[[cur,'已签收','甲','1','良乡','乙','中关村']],headers:['单号','物流信息','寄件人姓名','寄件人工号','寄件校区地址','收件人姓名','收件校区地址'],total:1,probeToken:'t'+cur,probeSettled:true}];
   if(c.type==='closeQuery')return [{closed:true}];
   return [];});
  const r=await w.call({type:'syncFlowStatus',ids});
  assert.equal(Object.keys(r.data.statuses).length,2);
  assert.equal(JSON.stringify(r.data.failures.map(f=>f.reason)),JSON.stringify(Array(3).fill('已停止（手动取消）')));
  console.log('通过：实际状态回查可中途停止，未查的单号进失败清单。');
 }

 // #17：残留调整单没在保存时，打开标准页面不再白等 90 秒
 {
  let reachedAt=0,w;
  w=boot(async c=>{
   if(c.type==='portalState')return [{tabs:['工作台','物流状态调整单'],forms:1}];
   if(c.type==='portalBusy')return [{busy:false}];
   if(c.type==='tabCloseAll'){if(!reachedAt)reachedAt=w.now();return [{closed:0}];}
   return [];});
  const t0=w.now();await w.call({type:'openStandardPages'});
  assert(reachedAt,'没走到“关闭其他标签”这一步');
  assert(reachedAt-t0<10000,'没在保存的残留调整单仍等了 '+Math.round((reachedAt-t0)/1000)+' 秒');
  console.log('通过：没在保存的残留调整单不再等 90 秒，直接进入关闭标签。');
 }

 // ============ source.js：假 DOM ============
 const el=(o={})=>({children:[],className:'',classList:{contains:c=>String(o.className||'').split(/\s+/).includes(c)},getAttribute:()=>null,querySelector:()=>null,querySelectorAll:()=>[],getBoundingClientRect:()=>({height:20,width:100,left:0,top:0}),closest:()=>null,...o});
 function page({path,href,frameH=500,rows=[],headers=[],topTabs=[]}){
  const tabEls=topTabs.map(t=>el({innerText:t.text,className:'mini-tab'+(t.active?' mini-tab-active':'')}));
  const headEls=headers.map(t=>el({innerText:t}));
  const doc={body:el({innerText:headers.join(' ')+' 每页 10 条，共 '+rows.length+' 条'}),documentElement:{clientWidth:800,clientHeight:600},
   querySelector:s=>s==='tr[id^="line_"],tr.mini-grid-row'?(rows[0]||null):null,
   querySelectorAll:s=>s==='.mini-tab'?tabEls:/headerCell/.test(s)?headEls:/^tr|tr\./.test(s)?rows:[]};
  const win={frameElement:{getBoundingClientRect:()=>({height:frameH,width:frameH?800:0})},document:doc};win.top={document:doc};
  return {document:doc,window:win,location:{origin:'https://ehall.bit.edu.cn',pathname:path,href:href||'https://ehall.bit.edu.cn'+path},URL,getComputedStyle:()=>({visibility:'visible',zIndex:'1'}),MouseEvent:function(t){this.type=t;},performance:{getEntriesByType:()=>[]}};
 }
 const act=(ctx,cmd)=>vm.runInNewContext('('+sourceAction+')('+JSON.stringify(cmd)+')',ctx);
 const qhref='https://ehall.bit.edu.cn/EIP/maindatabase/querymanage/queryResult.htm?queryCode=8y4xbat8bd5dygdtw7ncbwcayenmnckt';
 // #8 注入层：前台是调整单时，快件查询帧不报“已关闭”
 assert.equal(JSON.stringify(act(page({path:'/EIP/maindatabase/querymanage/queryResult.htm',href:qhref,topTabs:[{text:'快件查询'},{text:'物流状态调整单',active:true}]}),{type:'closeQuery'})),'{"wrongTab":true}');

 // #15：诊断与报错不带行内容
 const SECRET='张三丰13800001234';
 const mkRow=(id,extra='')=>{const cells=['1','x',id,SECRET+extra].map(t=>el({innerText:t}));return el({id:'line_'+id,innerText:'1 x '+id+' '+SECRET+extra,children:cells,outerHTML:'<tr>'+SECRET+'</tr>',offsetHeight:20,
  querySelectorAll:s=>/input|checkbox/.test(s)?[el({tagName:'INPUT',className:'mini-checkbox-check'})]:[]});};
 const flowPath='/EIP/cooperative/toDoList.htm';
 const fp=page({path:flowPath,href:'https://ehall.bit.edu.cn'+flowPath+'?flowId=8a8082dc7fdeefce017ffdbfb7ec4c15',rows:[mkRow('JGKD700061'),mkRow('JGKD700062')],headers:['序号','状态','单号','寄件人']});
 for(const cmd of [{type:'rowDump'},{type:'flowFrames'},{type:'flowSelect',id:'JGKD799999'}]){
  const out=JSON.stringify(act(fp,cmd));
  assert(!out.includes(SECRET),cmd.type+' 把行内容（姓名/电话）带出去了：'+out.slice(0,120));
 }
 assert(!JSON.stringify(act(fp,{type:'flowFrames'})).includes('JGKD700061'),'诊断首行单号应打码');
 console.log('通过：诊断与勾选失败提示不再带出姓名、电话、完整单号。');

 // #16：打印详情只认完整单号；隐藏的分类页不动手
 let clicked='';
 const link=id=>el({innerText:'寄件申请信息单',click(){clicked=id;}});
 const dRow=id=>el({innerText:'1 '+id+' 寄件申请信息单',querySelectorAll:s=>s==='a'?[link(id)]:[],querySelector:()=>link(id)});
 const dp=page({path:flowPath,rows:[dRow('JGKD7000712'),dRow('JGKD700071')]});
 assert.equal(act(dp,{type:'openDetail',id:'JGKD700071'}).detailRequested,true);
 assert.equal(clicked,'JGKD700071','按子串命中了单号更长的另一单');
 assert.equal(act(page({path:flowPath,frameH:0,rows:[dRow('JGKD700071')]}),{type:'openDetail',id:'JGKD700071'}),null,'隐藏分类页里也打开了详情');
 console.log('通过：打印详情按完整单号匹配，隐藏的分类页不动手。');

 // #18：0 行的隐藏分类页按框架高度识别为隐藏
 const hidden=act(page({path:flowPath,href:'https://ehall.bit.edu.cn'+flowPath+'?flowId=8a8082dc7fdeefce017ffdbfb7ec4c15',frameH:0,rows:[],headers:['序号','单号']}),{type:'snapshot',kind:'flow'});
 assert.equal(hidden&&hidden.hiddenFrame,true,'0 行的隐藏待办页没被识别为隐藏');
 console.log('通过：0 行的隐藏分类页按框架高度识别为隐藏。');

 // #19：视口单位随 zoom 放大（Chromium 156 实测：zoom 2.14 下 50vw = 1464px / 1366px 窗口），上限要除以 --z
 const css=fs.readFileSync(D+'style.css','utf8');
 for(const r of ['dialog{max-width:calc(94vw / var(--z,1))','.print-dialog{max-width:calc(96vw / var(--z,1))}','#changeDialog{max-height:calc(100vh / var(--z,1) - 28px)}'])assert(css.includes(r),'缺少：'+r);
 assert(/setProperty\('--z',String\(p\/this\.base\)\)/.test(live),'字号生效时要同步写 --z');
 console.log('通过：弹窗等视口上限按页面缩放折算（实测数据见 docs 与 CHANGELOG）。');
})().catch(e=>{console.error(e);process.exitCode=1;});
