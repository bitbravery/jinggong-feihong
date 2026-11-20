// v1.0.33：流程合并进「快件查询及状态调整」。执行 live.js 里的原文函数（按名字截取），不做纯文本匹配的部分都实际跑一遍。
const assert=require('node:assert/strict'),fs=require('node:fs');
const D=__dirname+'/../';
const live=fs.readFileSync(D+'live.js','utf8'),html=fs.readFileSync(D+'index.html','utf8');
const FeiHong=require(D+'logic.js'),CampusPerspective=require(D+'perspective.js'),SourceMapping=require(D+'mapping.js');
// 按名字截取一个函数的完整原文（括号配对）
function fn(name){const i=live.indexOf(name);assert(i>=0,'找不到 '+name);let j=/function/.test(name)?live.indexOf('){',i)+1:live.indexOf('{',i),d=0;for(;j<live.length;j++){if(live[j]==='{')d++;else if(live[j]==='}'&&--d===0)break;}return live.slice(i,j+1);}

// —— 1) 待办标签：只列本窗口校区发出的待办；与其他分类互斥 ——
const env=`let currentView='orders',campus='良乡',activeColumns=new Set(['both']),selected=new Set(),flowTab='待办',sortColumn='',sortDescending=false,officeKeywords=[],mappings={};
const records={query:[],flow:[]};const orders=()=>records.query;const $=id=>({direction:{value:'all'},identity:{value:'all'},region:{value:'all'},search:{value:''},orderDay:{value:''}})[id];`;
const L=new Function('FeiHong','CampusPerspective','matches',env+fn('function todoRows(')+fn('function todoActive(')+fn('function filtered(')+fn('function selectionKinds(')+
 ';return {records,set:(k,v)=>{({activeColumns:()=>activeColumns=v,selected:()=>selected=v,campus:()=>campus=v})[k]()},filtered,todoRows,selectionKinds};')(FeiHong,CampusPerspective,FeiHong.matches);
const q=(id,from,to,status)=>({id,fromCampus:from,toCampus:to,status,sender:'甲',receiver:'乙',personId:'6120000001',building:'文萃楼A',destination:'主楼'});
L.records.query.push(q('Q1','良乡','中关村','已揽件'),q('Q2','中关村','良乡','发出/派送中'));
L.records.flow.push({...q('T1','良乡','中关村','订单申请'),flow:'待办'},{...q('T2','中关村','良乡','订单申请'),flow:'待办'},{...q('D1','良乡','中关村','订单申请'),flow:'已办'});
assert.deepEqual(L.todoRows().map(o=>o.id),['T1'],'待办只列本窗口校区发出的');
assert.deepEqual(L.filtered().map(o=>o.id).sort(),['Q1','Q2'],'普通分类不混入待办');
L.set('activeColumns',new Set(['todo']));
assert.deepEqual(L.filtered().map(o=>o.id),['T1'],'点「待办」只显示待办');
L.set('campus','中关村');assert.deepEqual(L.filtered().map(o=>o.id),['T2']);L.set('campus','良乡');
const click=fn("$('overview').onclick");
assert(/k==='todo'\?new Set\(\['todo'\]\):activeColumns\.has\('todo'\)\?new Set\(\[k\]\):CampusPerspective\.toggleColumns/.test(click),'待办与其他分类互斥');
console.log('通过：分类最前面的「待办」只列本窗口校区发出的待办，与其他分类互斥；普通分类不混入待办。');

// —— 2) 选择栏：只勾待办 / 只勾其他 / 混勾 ——
L.set('selected',new Set(['T1']));assert.deepEqual({...L.selectionKinds()},{todo:1,other:0,mixed:false});
L.set('selected',new Set(['Q1','Q2']));assert.deepEqual({...L.selectionKinds()},{todo:0,other:2,mixed:false});
L.set('selected',new Set(['T1','Q1']));assert.equal(L.selectionKinds().mixed,true);
const r=fn('function render(');
assert(/\$\('batchApprove'\)\.hidden=\$\('batchReject'\)\.hidden=!selKinds\.todo/.test(r),'只勾待办才显示批量通过/退回');
assert(/for\(const id of \['batchApprove','batchReject','exportPickup'\]\)\$\(id\)\.disabled=busy\|\|m/.test(r)&&/\$\('batchChange'\)\.disabled=!selected\.size\|\|busy\|\|selKinds\.mixed/.test(r),'混勾时四个按钮都变灰');
assert(/id="selectionMixed"[^>]*>待办和其他单子请分开操作</.test(html));
// v1.0.32 的跨标签勾选：render 只剪掉已不在数据里的单号，不按当前筛选剪
assert(/ids=new Set\(\(flow\?matching:\[\.\.\.orders\(\),\.\.\.todoRows\(\)\]\)/.test(r),'勾选不能按当前筛选剪掉（否则切标签后勾选又没了）');
console.log('通过：只勾待办 → 批量通过/退回；只勾其他 → 批量改状态/导出取送件；混勾 → 全部变灰并提示分开操作；跨标签勾选不被剪掉。');

// —— 3) 待办行：通过 / 退回 / 打印申请单；单行通过走同一套核对 ——
assert(/data-approve="\$\{E\(o\.id\)\}">通过<\/button><button class="todo-reject" data-reject="\$\{E\(o\.id\)\}">退回<\/button><button data-print="\$\{E\(o\.id\)\}" data-flow="待办">打印申请单<\/button>/.test(r),'待办行右边：通过、退回、打印申请单');
assert(/if\(b\.dataset\.approve\)\{bulkApprove\('approve',\[b\.dataset\.approve\]\)/.test(live)&&/if\(b\.dataset\.reject\)\{bulkApprove\('reject',\[b\.dataset\.reject\]\)/.test(live));
const ba=fn('async function bulkApprove(');
assert(/\[\.\.\.selected\]\.filter\(id=>t\.has\(id\)\)/.test(ba),'批量通过只处理勾选里的待办');
assert(/got=await readTodo\(\{front:true\}\)/.test(ba),'处理完读全部待办核对');
console.log('通过：待办行有「通过 / 退回 / 打印申请单」，单行和批量走同一套原站操作与事后核对。');

// —— 4) 从已办补下单时分：已有时分跳过；找齐就停；最后把原站切回待办 ——
(async()=>{
 const timesEnv=`let records={query:[],flow:[]},bulkCancelled=false,orderTimes=null;const ORDER_TIME_KEY='k';const store={};const localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v}};`;
 const T=new Function('SourceMapping','request',timesEnv+fn('function flowTimeText(')+fn('function loadOrderTimes(')+fn('function rememberOrderTimes(')+fn('function timeFromFlow(')+fn('function fillQueryTimes(')+fn('async function fillTimesFromDone(')+';return {records,fillTimesFromDone};');
 const H=['流程事项名称','发起人','单号','寄件人工号','寄件人姓名','寄件人电话','下单时间','物流信息','寄件校区地址','收件人姓名','收件校区地址'];
 const row=(id,t)=>['寄件申请信息单','甲',id,'1','甲','138',t,'订单申请','良乡','乙','中关村'];
 const pages=[[row('JGKD700301','2026年11月20日 13时05分'),row('JGKD700309','2026年11月20日 12时00分')],[row('JGKD700302','2026年11月19日 08时07分')],[row('JGKD700303','2026年11月18日 09时00分')]];
 const calls=[];let p=0;
 const req=async m=>{calls.push(m.type+':'+(m.flowTab||''));if(m.type==='flowFirst'&&m.flowTab==='已办'){p=0;return {kind:'flow',flowTab:'已办',headers:H,rows:pages[0],next:true};}if(m.type==='flowNextPage'){p++;return {kind:'flow',flowTab:'已办',headers:H,rows:pages[p]||[],atEnd:p>=pages.length};}return {};};
 const A=T(SourceMapping,req);
 A.records.query.push({id:'JGKD700301',time:'2026-11-20'},{id:'JGKD700302',time:'2026-11-19'},{id:'Q0',time:'2026-11-20 10:00',timeSource:'grid'});
 const res=await A.fillTimesFromDone();
 assert.deepEqual({...res},{need:2,filled:2,pages:2},JSON.stringify(res));
 assert.equal(A.records.query[0].time,'2026-11-20 13:05');assert.equal(A.records.query[1].time,'2026-11-19 08:07');
 assert.deepEqual(calls,['flowFirst:已办','flowNextPage:已办','flowFirst:待办'],'找齐就停，最后切回待办：'+calls);
 // 都有时分时不碰原站
 calls.length=0;const B=T(SourceMapping,req);B.records.query.push({id:'Q0',time:'2026-11-20 10:00',timeSource:'grid'});
 assert.deepEqual({...(await B.fillTimesFromDone())},{need:0,filled:0,pages:0});assert.deepEqual(calls,[],'都有时分时不应去已办');
 // 整页都早于缺时分的最早那天就停
 calls.length=0;const C=T(SourceMapping,req);C.records.query.push({id:'JGKD700399',time:'2026-11-21'});
 const rc=await C.fillTimesFromDone();assert.equal(rc.pages,1,'整页都比要找的日子早时不再往后翻');
 console.log('通过：从已办补下单时分——已有时分跳过、不碰原站；找齐或翻过最早那天就停；读完把原站切回待办。');

 // —— 5) 读取流程：近一个月 / 自定义时段读完快件查询后接着读待办、补时分；待办标签下“读取当前页”读全部待办 ——
 assert(/const extra=await afterQueryRead\(\)/.test(fn("$('readAll').onclick")),'近一个月 / 自定义时段读完后要读待办并补时分');
 const aq=fn('async function afterQueryRead(');assert(aq.indexOf('readTodo(')<aq.indexOf('fillTimesFromDone('),'先读待办、再补时分');
 assert(/if\(todoActive\(\)\)\{readTodoNow\(\);return;\}/.test(fn('async function read(')));
 assert(/scanFlows\(\{pages:50,tabs:\['待办'\]/.test(fn('async function readTodo(')),'待办读全部页，不读已办 / 抄送给我');
 // 页面：流程办理隐藏保留、默认停在快件查询
 assert(/<button data-view="flow" hidden/.test(html),'「流程办理」先隐藏保留一个版本');
 assert(/<button class="active" data-view="orders">/.test(html));
 console.log('通过：近一个月 / 自定义时段读完快件查询后自动读全部待办、再补时分；「流程办理」已隐藏保留。');
})().catch(e=>{console.error(e);process.exitCode=1;});
