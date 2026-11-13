// v1.0.22：每次读取都用本次结果刷新（用户要求，取代 v1.0.13 起的“只增不减”）。执行 live.js 原文，不做文本匹配。
// - 快件查询：读到哪些就是哪些，原站上变了的状态跟着变，不再出现的单从本地消失
// - 流程：只刷新本次读的分类（读待办不动已办）
// - 唯一保留：已办里经「实际状态回查」核实、或工作台刚改成功的状态（原站已办列表一律显示订单申请）
// - 流程列表 0 行且没等过加载确认：结果不可信，保留上次的列表
const assert=require('node:assert/strict'),fs=require('node:fs');
const D=__dirname+'/../';
const SourceMapping=require(D+'mapping.js');
const live=fs.readFileSync(D+'live.js','utf8');
const a=live.indexOf('// v1.0.22：每次读取都用本次结果刷新'),b=live.indexOf('// v1.0.22：所有读取都用本次结果刷新');
assert(a>0&&b>a,'找不到 live.js 读取刷新原文');
const L=new Function('SourceMapping',`let records={query:[],flow:[]},snapshots={query:null,flow:null},lastReadError='';
${live.slice(a,b)};return {get records(){return records},set records(v){records=v},setSnapshotExtra,markWritten,refreshNote};`)(SourceMapping);
const headers=['序号','单号','物流信息','寄件人姓名','寄件人工号','寄件校区地址','收件人姓名','收件校区地址'];
const row=(n,id,st)=>[String(n),id,st,'甲','1','良乡','乙','中关村'];
const q=rows=>({kind:'query',headers,rows,page:1,pageSize:100,total:rows.length,readAt:'t'});
const fl=(tab,rows,extra={})=>({kind:'flow',flowTab:tab,headers,rows,page:1,pageSize:10,total:rows.length,readAt:'t',...extra});
const ids=list=>list.map(o=>o.id+':'+o.status).join(',');

// 快件查询：第二次读取以原站为准
L.setSnapshotExtra(q([row(1,'JGKD800001','已揽件'),row(2,'JGKD800002','已揽件'),row(3,'JGKD800003','已揽件')]));
const m=L.setSnapshotExtra(q([row(1,'JGKD800001','已签收'),row(2,'JGKD800004','订单申请')]));
assert.equal(ids(L.records.query),'JGKD800001:已签收,JGKD800004:订单申请','读取没有用本次结果刷新');
assert.equal(m.added,1);assert.equal(m.removed,2);assert.equal(m.changed,1);
assert.equal(L.refreshNote(m),'已刷新，共 2 条（和上次比：新出现 1 条，不再出现 2 条，状态有变化 1 条）');
console.log('通过：快件查询每次读取都以原站为准，提示写明新出现、不再出现和状态变化各几条。');

// 流程：只刷新本次读的分类
L.setSnapshotExtra(fl('已办',[row(1,'JGKD800011','订单申请'),row(2,'JGKD800012','订单申请')]));
L.setSnapshotExtra(fl('待办',[row(1,'JGKD800021','订单申请'),row(2,'JGKD800022','订单申请')]));
L.setSnapshotExtra(fl('待办',[row(1,'JGKD800022','订单申请')]));
assert.equal(ids(L.records.flow.filter(o=>o.flow==='待办')),'JGKD800022:订单申请','已通过的待办单重读后还在');
assert.equal(L.records.flow.filter(o=>o.flow==='已办').length,2,'读待办把已办动了');
console.log('通过：读待办只刷新待办，已办不受影响；已通过的单重读后从待办消失。');

// 已办：回查过 / 工作台刚改成功的状态保留
L.records={...L.records,flow:L.records.flow.map(o=>o.id==='JGKD800011'?{...o,status:'已签收',statusSource:'query'}:o)};
L.markWritten('JGKD800012','已送达');
L.setSnapshotExtra(fl('已办',[row(1,'JGKD800011','订单申请'),row(2,'JGKD800012','订单申请'),row(3,'JGKD800013','订单申请')]));
assert.equal(ids(L.records.flow.filter(o=>o.flow==='已办')),'JGKD800011:已签收,JGKD800012:已送达,JGKD800013:订单申请','已办里核实过的状态被原站列表的“订单申请”盖掉了');
// 已办里不再出现的单照样消失
L.setSnapshotExtra(fl('已办',[row(1,'JGKD800013','订单申请')]));
assert.equal(ids(L.records.flow.filter(o=>o.flow==='已办')),'JGKD800013:订单申请');
console.log('通过：已办里经回查或工作台改过的状态保留，其余照常刷新。');

// 流程 0 行：没确认过不清空，确认过才清空
const kept=L.setSnapshotExtra(fl('待办',[]));
assert.equal(kept.kept,true);assert.equal(L.records.flow.filter(o=>o.flow==='待办').length,1,'没确认过的空读取清空了待办');
L.setSnapshotExtra(fl('待办',[],{emptyConfirmed:true}));
assert.equal(L.records.flow.filter(o=>o.flow==='待办').length,0);
console.log('通过：流程列表 0 行时，只有确认过原站为空才清空。');

// 所有读取入口都走刷新：读取当前页、原站翻页、近一个月/自定义时段、流程前 N 页（含部分失败）
for(const s of ["const merge=mergeSnapshot(s)","const m=setSnapshot(s)","const mAll=setSnapshot(complete)","mergeParsed(fresh,'flow',flowTab,{keepOld:","mergeParsed(e.partial.flatMap(p=>SourceMapping.normalize(p)),'flow',flowTab)"])assert(live.includes(s),'读取入口没走统一刷新：'+s);
assert(!/本次新增|保留之前读取的旧记录|含之前读取的/.test(live),'界面上还有“只增不减”时代的文字');
console.log('通过：所有读取入口都走统一刷新，界面文字已去掉“新增/保留旧记录”。');
