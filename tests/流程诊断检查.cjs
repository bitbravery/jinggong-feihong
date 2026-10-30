// 第 0 级诊断：流程读取每一步都写进进度条（flowStage）与「诊断」的步骤记录；
// 注入层对“等待”说明原因（如表头没有“单号”）；flowProbe 只读地报告流程页现状。只报告，不改变行为。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

// ---------- A. 编排层：步骤上报 + 诊断返回步骤记录 ----------
let listener,time=0;const stages=[];
const ctx={importScripts(){},Date:{now:()=>time},setTimeout:fn=>{time+=250;fn();},
 chrome:{action:{onClicked:{addListener(){}}},runtime:{getURL:p=>'extension://'+p,onMessage:{addListener:fn=>listener=fn},sendMessage:async m=>{if(m.type==='flowStage')stages.push(m.text);}},storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{}},scripting:{executeScript:async()=>[]}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../worker.js','utf8'),ctx);
const H=['流程事项名称','发起人','单号'];
let headerOk=false;
ctx.fakeRun=async c=>{
 if(c.type==='snapshot')return headerOk?[{kind:'flow',path:'/EIP/f/doneList.htm',headers:H,rows:[['a','b','JGKD1']],rowIds:['line_1'],page:1,pageSize:20,total:1,active:'已办'}]:[{waiting:true,why:'表头里没有“单号”（共 7 列：序号/流程事项名称）',path:'/EIP/f/makeCopeList.htm'}];
 if(c.type==='flowTab'){headerOk=true;return [{waiting:true,clicked:true,active:'抄送给我',path:'/EIP/f/makeCopeList.htm'}];}
 if(c.type==='navigate')return [{navigated:true}];
 if(c.type==='flowProbe')return [{flowProbe:true,path:'/EIP/f/doneList.htm',headers:H,active:'已办',rows:{line_:'1 行'},tabs:['待办×1'],loading:0}];
 if(c.type==='portalState')return [{tabs:['【流程】'],forms:0,service:true,frames:[]}];
 return [];
};
vm.runInContext('run=fakeRun;',ctx);
const call=msg=>new Promise(r=>listener(msg,{url:'extension://index.html',tab:{id:2}},r));
(async()=>{
 const r=await call({type:'read',kind:'flow',flowTab:'已办'});
 assert(r.ok,r.error);
 const all=stages.join('\n');
 assert(/^读取当前页（已办）/.test(stages[0]),'第一步应标明在读什么：'+stages[0]);
 // v0.9.171：页面显示中文名
 assert(/抄送列表 表头里没有“单号”/.test(all),'等待时要说明原因与是哪个页面：\n'+all);
 assert(!/\.htm/.test(all),'进度提示里不应再出现英文页面文件名：\n'+all);
 assert(/点门户【流程】标签/.test(all),'点了【流程】标签要说出来');
 assert(/切到「已办」：点了「已办」/.test(all),'切换分类要说出来');
 assert(stages.every(s=>/（已 \d+\.\d 秒）$/.test(s)),'每一步都带已用时间');
 const d=await call({type:'diagnose'});
 assert(d.ok,d.error);
 assert(d.data.flowTrace.length>=3&&d.data.flowTrace[0].text.startsWith('读取当前页'),'诊断要带最近一次读取的步骤');
 assert(d.data.flowTrace.some(s=>s.n>1)||d.data.flowTrace.length<80,'重复步骤要合并计数');
 assert.equal(d.data.flowProbe[0].active,'已办','诊断要带流程页现状');

 // ---------- B. 注入层 ----------
 const src=fs.readFileSync(__dirname+'/../source.js','utf8');
 const make=({headers,loading=false,rows=[]})=>{
  const cell=t=>({innerText:t});
  const doc={body:{innerText:'每页 20 条，共 8 条'},documentElement:{clientHeight:600},
   querySelector:s=>s==='.mini-pager-num'?{value:'1'}:s==='.mini-pager'?{innerText:'20 1 / 1'}:null,
   querySelectorAll:s=>s==='td[id*="$headerCell"]'?headers.map(cell):s==='.mini-mask-loading,.mini-grid-loading'?(loading?[{getBoundingClientRect:()=>({height:50})}]:[]):s==='tr[id^="line_"]'?rows:[]};
  const c={module:{exports:{}},window:{},document:doc,location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/flow/copyList.htm',href:'https://ehall.bit.edu.cn/EIP/flow/copyList.htm?flowId=8a8082dc7fdeefce017ffdbfb7ec4c15'},URL,getComputedStyle:()=>({visibility:'visible'})};
  vm.createContext(c);vm.runInContext(src,c);return c.module.exports.sourceAction;
 };
 let out=make({headers:['序号','流程事项名称','发起人']})({type:'snapshot',kind:'flow'});
 assert(out.waiting&&/表头里没有“单号”/.test(out.why),'无单号列时要说明原因');assert.equal(out.path,'/EIP/flow/copyList.htm');
 out=make({headers:H,loading:true})({type:'snapshot',kind:'flow'});
 assert(out.waiting);assert.equal(out.why,'列表加载中');
 const row={children:[1,2,3],getBoundingClientRect:()=>({height:20})};
 out=make({headers:H,rows:[row,row]})({type:'flowProbe'});
 assert(out.flowProbe);assert.equal(JSON.stringify(out.headers),JSON.stringify(H));assert.match(out.rows['line_'],/^2 行（列数对齐 2/);
 assert.equal(out.pageNum,'1');assert.match(out.summary,/共 8 条/);

 // ---------- C. 工作台：进度条接收步骤，诊断显示现状与步骤 ----------
 const live=fs.readFileSync(__dirname+'/../live.js','utf8');
 assert(/if\(busy&&m\.type==='flowStage'\)\{readProgress\.note=m\.text;drawReadProgress\(\);\}/.test(live),'进度条要显示当前步骤');
 assert(/流程页现状：/.test(live)&&/最近一次流程读取的步骤：/.test(live),'诊断要显示流程页现状与步骤记录');
 console.log('通过：流程读取每一步带用时上报到进度条；等待说明原因与页面；诊断带流程页现状与最近一次读取步骤。');
})().catch(e=>{console.error(e);process.exitCode=1;});
