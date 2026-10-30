// v0.9.169：按“哪张分类列表页正在显示”判断当前分类（现场诊断确认：toDoList=待办、haveToDoList=已办、
// makeCopeList=抄送给我；显示中的框架高度 >0）。复现诊断里的 27.5 秒：门户停在「抄送给我」时不得空等 25 秒；
// 已在目标分类不点；点一次就等，5 秒没切过去才补点、最多 3 次；读到的列表必须来自目标分类页。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');

// ---------- A. 注入层 ----------
const frame=(file,height,extra={})=>{const c={module:{exports:{}},window:{frameElement:height===undefined?null:{getBoundingClientRect:()=>({height,width:height?1300:0})}},document:{querySelectorAll:()=>[],querySelector:()=>null,body:{innerText:''}},
 location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/cooperative/'+file,href:'https://ehall.bit.edu.cn/EIP/cooperative/'+file+'?flowId=8a8082dc7fdeefce017ffdbfb7ec4c15'},URL,getComputedStyle:()=>({visibility:'visible'}),...extra};
 vm.createContext(c);vm.runInContext(src,c);return c.module.exports.sourceAction;};
let r=frame('toDoList.htm',528)({type:'flowWhere'});assert.equal(r.tab,'待办');assert.equal(r.visible,true);
r=frame('haveToDoList.htm',0)({type:'flowWhere'});assert.equal(r.tab,'已办','haveToDoList 是已办');assert.equal(r.visible,false);
r=frame('makeCopeList.htm',528)({type:'flowWhere'});assert.equal(r.tab,'抄送给我','makeCopeList 是抄送给我');
assert.equal(frame('queryResult.htm',528)({type:'flowWhere'}),null,'非分类页不响应');
assert.equal(frame('toDoList.htm',undefined)({type:'flowWhere'}).visible,null,'取不到框架时为未知');
// 快照按页面名标分类：haveToDoList 不能再被当成待办
const H=['流程事项名称','单号'];const cell=t=>({innerText:t});
const snapCtx=file=>frame(file,528,{document:{body:{innerText:'每页 20 条，共 1 条'},querySelector:s=>s==='.mini-pager-num'?{value:'1'}:null,
 querySelectorAll:s=>s==='td[id*="$headerCell"]'?H.map(cell):s==='tr.mini-grid-row[id*="$row2$"]'?[{id:'g$row2$1',offsetHeight:20,children:[cell('寄件申请信息单'),cell('JGKD1')]}]:[]}});
r=snapCtx('haveToDoList.htm')({type:'snapshot',kind:'flow'});assert.equal(r.pathTab,'已办');assert.equal(r.flowTab,'已办');
r=snapCtx('toDoList.htm')({type:'snapshot',kind:'flow'});assert.equal(r.pathTab,'待办');
// force：样式判断说“已在待办”，但编排层确认没切过去时仍点一次（单次 .click()，与原来相同）
let clicks=0;const SAME='a|400',ON='b|700';
const tabEls=['待办','已办','抄送给我'].map(n=>({textContent:n,__n:n,getBoundingClientRect:()=>({height:20}),contains:()=>false,click(){clicks++;}}));
const strip=frame('framework.htm',undefined,{document:{body:{innerText:''},querySelector:()=>null,querySelectorAll:s=>s.includes('span')?tabEls:[]},
 getComputedStyle:el=>{const v=(el.__n==='待办'?ON:SAME).split('|');return {color:v[0],fontWeight:v[1],borderBottomWidth:'0',borderBottomColor:'',backgroundColor:''};}});
assert(strip({type:'flowTab',flowTab:'待办'}).flowSelected);assert.equal(clicks,0,'不带 force 时行为不变');
r=strip({type:'flowTab',flowTab:'待办',force:true});assert(r.clicked);assert.equal(clicks,1);

// ---------- B. 编排层 ----------
function harness(){
 let listener,time=0;const log=[];const st={showing:'抄送给我',portalOnFlow:true,switchAt:Infinity,pending:null,neverSwitch:false};
 const ctx={importScripts(){},Date:{now:()=>time},setTimeout:fn=>{time+=250;fn();},
  chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async()=>{}},storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{}},scripting:{executeScript:async()=>[]}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../worker.js','utf8'),ctx);
 const files={'待办':'toDoList.htm','已办':'haveToDoList.htm','抄送给我':'makeCopeList.htm'};
 const tick=()=>{if(st.pending&&time>=st.switchAt){st.showing=st.pending;st.pending=null;}};
 ctx.fakeRun=async c=>{
  time+=40;tick();log.push({t:time,type:c.type,kind:c.kind});
  if(c.type==='flowWhere')return Object.entries(files).map(([tab,file])=>({flowWhere:true,file,tab,visible:st.portalOnFlow&&st.showing===tab}));
  if(c.type==='navigate'){if(c.kind==='flow')st.portalOnFlow=true;return [{navigated:true}];}
  if(c.type==='flowTab'){if(!st.neverSwitch){st.pending=c.flowTab;st.switchAt=time+1000;}return [{waiting:true,clicked:true,active:''}];}
  if(c.type==='snapshot'){if(!st.portalOnFlow||st.showing==='抄送给我')return [];const total=st.showing==='待办'?8:27255;
   return [{kind:'flow',path:'/EIP/cooperative/'+files[st.showing],pathTab:st.showing,headers:H,rows:Array.from({length:Math.min(20,total)},(_,i)=>['寄件申请信息单','JGKD'+i]),rowIds:[],page:1,pageSize:20,total,active:''}];}
  if(c.type==='page')return [{pageRequested:1,unchanged:true}];
  return [];
 };
 vm.runInContext('run=fakeRun;',ctx);
 return {st,log,now:()=>time,call:msg=>new Promise(res=>listener(msg,{url:'extension://index.html',tab:{id:2}},res))};
}
(async()=>{
 // 1) 复现诊断：门户停在「抄送给我」，读待办前 N 页——立即点「待办」，几秒内读完，不空等 25 秒
 let h=harness();
 let res=await h.call({type:'flowFirst',flowTab:'待办'});
 assert(res.ok,res.error);assert.equal(res.data.rows.length,8);
 assert(h.now()<4000,'停在抄送给我时应在 4 秒内读完（原来要 27.5 秒），实际 '+h.now()+' 毫秒');
 assert.equal(h.log.filter(x=>x.type==='flowTab').length,1,'只点一次');
 assert.equal(h.log.filter(x=>x.type==='navigate'&&x.kind==='flow').length,0,'已在流程页不点【流程】标签');

 // 2) 已在「已办」：一次都不点，直接读
 h=harness();h.st.showing='已办';
 res=await h.call({type:'read',kind:'flow',flowTab:'已办'});
 assert(res.ok,res.error);assert.equal(h.log.filter(x=>x.type==='flowTab').length,0,'已在目标分类不得点击');

 // 3) 门户停在「快件查询」（三张分类页都隐藏）：点一次【流程】标签，然后切到已办
 h=harness();h.st.portalOnFlow=false;h.st.showing='待办';
 res=await h.call({type:'read',kind:'flow',flowTab:'已办'});
 assert(res.ok,res.error);assert.equal(res.data.total,27255);
 assert.equal(h.log.filter(x=>x.type==='navigate'&&x.kind==='flow').length,1,'应点一次【流程】标签');
 assert.equal(h.log.filter(x=>x.type==='flowTab').length,1);

 // 4) 一直切不过去：点一次就等，至少隔 5 秒才补点，最多 3 次；不把已办的数据当成待办
 h=harness();h.st.showing='已办';h.st.neverSwitch=true;
 res=await h.call({type:'flowFirst',flowTab:'待办'});
 assert(!res.ok);assert.match(res.error,/原站当前显示的是「已办」，不是「待办」/);
 const taps=h.log.filter(x=>x.type==='flowTab').map(x=>x.t);
 assert(taps.length<=3,'最多点 3 次，实际 '+taps.length);
 for(let i=1;i<taps.length;i++)assert(taps[i]-taps[i-1]>=5000,'两次点击至少隔 5 秒');
 console.log('通过：按显示中的分类页判断；停在抄送给我不再空等（4 秒内读完）；已在目标不点；停在快件查询先切回【流程】；切不过去最多点 3 次且间隔 ≥5 秒，并拒绝读错分类。');
})().catch(e=>{console.error(e);process.exitCode=1;});
