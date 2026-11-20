// v1.0.27：快件查询的下单时间只显示年月日；扩展从原站表格的原始行数据里按完整单号取时分（日期一致才用、同一天有多个取最早），
// 取不到时用待办/已办里读到的时分补上。执行 source.js / mapping.js / bulk.js / live.js 原文。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=__dirname+'/../';
const {sourceAction}=require(D+'source.js');
const SourceMapping=require(D+'mapping.js'),FeiHongBulk=require(D+'bulk.js');

// —— 注入层：假的快件查询页 ——
const H=['序号','下单时间','物流信息','单号','寄件人工号','寄件人姓名','寄件校区地址','收件人姓名','收件校区地址'];
const cell=t=>({innerText:t,textContent:t});
const row=(n,id,day)=>{const c=[String(n),day,'已揽件',id,'1','甲','良乡','乙','中关村'].map(cell);return {id:'g$row2$'+n,children:c,offsetHeight:20,innerText:c.map(x=>x.innerText).join('\t')};};
const rows=[row(1,'JGKD700201','2026-11-20'),row(2,'JGKD700202','2026-11-19'),row(3,'JGKD700203','2026-11-18')];
const data=[
 {DH:'JGKD700201',CLSJ:'2026-11-20 16:40:00',XDSJ:'2026-11-20 13:05:22'}, // 同一天还有处理时间：取较早的下单时间
 {DH:'JGKD700202',XDSJ:'2026-11-18 09:00:00'},                            // 日期和显示的不一致：不用
 {DH:'JGKD700203',XDSJ:'2026-11-18'},                                     // 只有日期：取不到
];
const doc={body:{innerText:'每页 100 条，共 3 条'},
 querySelectorAll:s=>/headerCell/.test(s)?H.map(cell):/row2/.test(s)?rows:s==='.mini-grid'?[{id:'grid1'}]:[],
 querySelector:s=>s==='.mini-pager-num'?{value:'1'}:null};
const ctx={document:doc,window:{mini:{get:id=>id==='grid1'?{getData:()=>data}:null}},
 location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/maindatabase/querymanage/queryResult.htm',href:'https://ehall.bit.edu.cn/EIP/maindatabase/querymanage/queryResult.htm?queryCode=8y4xbat8bd5dygdtw7ncbwcayenmnckt'},
 URL,getComputedStyle:()=>({visibility:'visible'})};
ctx.window.top=ctx.window;ctx.top=ctx.window;
const snap=JSON.parse(JSON.stringify(vm.runInNewContext('('+sourceAction+')({type:"snapshot",kind:"query"})',ctx)));
assert.deepEqual(snap.rowTimes,['2026-11-20 13:05','',''],'按单号取时分不对：'+JSON.stringify(snap.rowTimes));
assert.equal(snap.timeHits,1);assert.equal(snap.timeField,'XDSJ');
console.log('通过：从原站表格数据按单号取时分；同一天多个时间取最早；日期不一致或只有日期时不填。');

// —— 映射：补上时分；没取到的保持只有日期 ——
const orders=SourceMapping.normalize(snap);
assert.equal(orders[0].time,'2026-11-20 13:05');assert.equal(orders[0].timeSource,'grid');
assert.equal(orders[1].time,'2026-11-19');assert.equal(orders[2].time,'2026-11-18');

// —— 批量读取：时分跟着逐页合并 ——
(async()=>{
 const page=(n)=>({...snap,page:n,pageSize:3,total:6,rows:snap.rows.map((r,i)=>{const c=[...r];c[0]=String((n-1)*3+i+1);return c;}),rowTimes:snap.rowTimes,timeHits:1});
 let p=1;const all=await FeiHongBulk.scanAll({request:async m=>m.type==='beginAll'?page(1):m.direction==='first'?page(1):page(++p)});
 assert.equal(all.rowTimes.length,6);assert.equal(all.timeHits,2);assert.equal(all.rowTimes[3],'2026-11-20 13:05');
 console.log('通过：近一个月 / 自定义时段逐页读取时，时分跟着合并。');

 // —— 工作台：原站表格没取到的，用待办/已办里的时分补 ——
 const live=fs.readFileSync(D+'live.js','utf8');
 const a=live.indexOf('// v1.0.22：每次读取都用本次结果刷新'),b=live.indexOf('// v1.0.22：所有读取都用本次结果刷新');
 const L=new Function('SourceMapping',`let records={query:[],flow:[]},snapshots={query:null,flow:null},lastReadError='';
${live.slice(a,b)};return {get records(){return records},set records(v){records=v},get snapshots(){return snapshots},setSnapshotExtra};`)(SourceMapping);
 L.records={query:[],flow:[{id:'JGKD700202',flow:'已办',time:'2026年11月19日 08时07分'},{id:'JGKD700203',flow:'待办',time:'2026年11月17日 10时00分'}]};
 L.setSnapshotExtra(snap);
 const q=L.records.query;
 assert.equal(q.find(o=>o.id==='JGKD700201').time,'2026-11-20 13:05','原站表格取到的被覆盖了');
 assert.equal(q.find(o=>o.id==='JGKD700202').time,'2026-11-19 08:07','没用待办/已办的时分补上');
 assert.equal(q.find(o=>o.id==='JGKD700203').time,'2026-11-18','日期不一致的待办时分也被拿来用了');
 assert.equal(L.snapshots.query.timeFlowHits,1);
 assert(/下单时分：原站表格取到/.test(live),'读取状态里要写明取到时分的行数');
 console.log('通过：原站表格没取到的单，用待办/已办里同一天的时分补上；读取状态写明取到几行。');
})().catch(e=>{console.error(e);process.exitCode=1;});
