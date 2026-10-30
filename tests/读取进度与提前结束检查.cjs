// v0.9.168：①「读取前 N 页」已读够原站总条数就不再点“下一页”；总条数未知时行为不变。
// ②进度按本次要读的量（min(总条数, N 页×每页)）计算，已办几万条也不会一直 0%。
// ③“日期范围之外”的报错写明第几页第几行、单号与下单时间；仍然停止读取，判断不变。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {scanFlows,scanAll}=require('../bulk.js');
const H=['流程事项名称','单号'];
const page=(n,rows,total,next=true)=>({kind:'flow',page:n,pageSize:20,total,next,headers:H,rows:Array.from({length:rows},(_,i)=>['寄件申请信息单','JGKD'+n+'_'+i]),rowIds:Array.from({length:rows},(_,i)=>'r'+n+'_'+i)});
function fake(pages,total){let p=1;const log=[];return {log,request:async m=>{log.push(m.type);if(m.type==='flowFirst'){p=1;return page(1,pages[0],total);}p++;if(p>pages.length)return {atEnd:true};return page(p,pages[p-1],total);}};}
(async()=>{
 // ① 待办共 8 条：读完第 1 页就结束，不点“下一页”（即使原站下一页按钮没被识别为灰色）
 let f=fake([8],8);let parts=await scanFlows({request:f.request,tabs:['待办'],pages:5});
 assert.equal(parts[0].rows.length,8);assert.deepEqual(f.log,['flowFirst'],'已读够总条数不应再点下一页：'+f.log.join(','));
 // 共 45 条：读 3 页（20+20+5）后结束，不点第 4 次
 f=fake([20,20,5,0],45);parts=await scanFlows({request:f.request,tabs:['已办'],pages:5});
 assert.equal(parts[0].rows.length,45);assert.equal(f.log.filter(x=>x==='flowNextPage').length,2);
 // 已办几万条：照常读满 N 页
 f=fake([20,20,20,20,20,20],27255);parts=await scanFlows({request:f.request,tabs:['已办'],pages:5});
 assert.equal(parts[0].pagesRead,5);assert.equal(parts[0].rows.length,100);
 // 总条数未知：行为与以前一致，一直读到原站说到底
 f=fake([8,8],null);parts=await scanFlows({request:f.request,tabs:['待办'],pages:5});
 assert.equal(parts[0].pagesRead,2,'总条数未知时不得提前结束');

 // ② 进度
 const live=fs.readFileSync(__dirname+'/../live.js','utf8');
 const box={};vm.createContext(box);vm.runInContext(live.slice(live.indexOf('function flowProgress'),live.indexOf('async function readFlows'))+';this.f=flowProgress;',box);
 let r=box.f({rowsRead:80,total:27255,page:4,pages:5,pageSize:20,limited:true});
 assert.equal(r.percent,80,'已办读到第 4/5 页应显示 80%');assert.equal(r.target,100);assert.equal(r.pagesTarget,5);
 r=box.f({rowsRead:8,total:8,page:1,pages:5,pageSize:20,limited:true});
 assert.equal(r.pagesTarget,1,'待办 8 条应显示共 1 页');assert.equal(r.percent,99);
 r=box.f({rowsRead:20,total:null,page:1,pages:5,pageSize:null,limited:true});
 assert.equal(r.percent,20,'总条数与每页未知时按页数算');

 // ③ 日期越界报错写明是哪一条
 const H2=['序号','下单时间','单号'];
 const first={page:1,pageSize:2,total:2,headers:H2,rows:[['1','2026-10-16','JGKD1'],['2','2026-10-15 22:10','JGKD2']],dateRange:{from:'2026-10-16',to:'2026-10-29',endExclusive:'2026-10-30'}};
 await assert.rejects(scanAll({request:async()=>first}),e=>{
  assert.match(e.message,/日期范围之外/);assert.match(e.message,/第 1 页第 2 行，单号 JGKD2，下单时间「2026-10-15 22:10」；读取范围 2026-10-16 至 2026-10-29/);return true;});
 console.log('通过：读够总条数即停、总数未知照旧；前 N 页进度按要读的量计算；日期越界写明是哪一条且仍停止读取。');
})().catch(e=>{console.error(e);process.exitCode=1;});
