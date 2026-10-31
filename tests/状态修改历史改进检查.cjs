// v0.9.176 状态修改历史 13 项改进：每一项一组断言（编号与改动说明一致）。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../audit-history.js');
const live=fs.readFileSync(__dirname+'/../live.js','utf8'),html=fs.readFileSync(__dirname+'/../index.html','utf8'),layout=fs.readFileSync(__dirname+'/../table-layout.js','utf8');
const R=(id,result,extra={})=>({id,from:'订单申请',to:'已揽件',iso:'2026-10-25T03:00:00.000Z',time:'2026-10-25 11:00:00',result,action:'物流状态调整',...extra});
const ok=R('JGKD1','已确认提交（未回读）'),fail=R('JGKD2','准备失败，未提交'),unknown=R('JGKD3','提交结果不明，禁止自动重试'),pending=R('JGKD4','提交结果待核验'),
 interrupted=R('JGKD5','正在准备，尚未提交'),cancelled=R('JGKD6','已取消，未提交'),diff=R('JGKD7','已确认提交（未回读）',{currentStatus:'订单申请'}),readback=R('JGKD8','已回读确认：已揽件');
const items={};const item=(n,fn)=>{items[n]=fn;};

item(1,()=>{ // 「只看异常」包含失败/不明/待核验/中断/与原站不符，不含成功与已取消
 const att=[ok,fail,unknown,pending,interrupted,cancelled,diff,readback].filter(A.needsAttention).map(h=>h.id);
 assert.deepEqual(att,['JGKD2','JGKD3','JGKD4','JGKD5','JGKD7'],'只看异常：'+att.join(','));
 assert(!A.needsAttention({...diff,currentStatus:'取不到（超时）'}),'取不到原站状态不算“与原站不符”');
 assert(!A.needsAttention({...diff,reverted:true}),'已改回的不再算不符');
});
item(2,()=>{ // 导出时的“只看异常”与屏幕同一套规则
 assert.deepEqual(A.unresolved([ok,unknown,diff]).map(h=>h.id),['JGKD3','JGKD7']);
 assert(/historyDisplayRows\(\),picked=shown\.filter\(h=>historyPicked\.has\(h\.iso\)\)/.test(live),'导出要用屏幕上的同一份列表');
});
item(3,()=>{ // 按北京时间分日：国际标准时间 10-24 17:30 = 北京 10-25 01:30
 assert.equal(A.dayKey({iso:'2026-10-24T17:30:00.000Z'}),'2026-10-25');
 assert.equal(A.dayKey({iso:'2026-10-25T15:59:00.000Z'}),'2026-10-25');
 assert(A.within({iso:'2026-10-24T17:30:00.000Z'},'2026-10-25','2026-10-25'),'筛选与分组一致');
});
item(4,()=>{ // 行内「查看原站状态」按记录自身找，不按单号
 assert(/data-status="\$\{E\(h\.id\)\}" data-key="\$\{E\(h\.iso\)\}"/.test(live),'按钮要带记录键');
 assert(/\(statusKey&&audit\.find\(h=>h\.iso===statusKey\)\)/.test(live),'点击时按记录键找');
});
item(5,()=>{ // 列宽 6 列，与 colgroup 一致；换 v2 键
 const cols=(html.slice(html.indexOf('<table class="history-table">')).match(/<col style="width:(\d+)%">/g)||[]).slice(0,6).map(c=>Number(c.match(/\d+/)[0]));
 const ratios=JSON.parse(layout.match(/ratios=(\[[^\]]*\])/g).pop().slice(7));
 assert.equal(ratios.length,6,'列宽比例要 6 个');assert.deepEqual(ratios,cols,'列宽比例要与表格 colgroup 一致');
 assert(/feihong-history-widths-v2/.test(layout)&&/saved\.length===cols\.length/.test(layout),'按 6 列保存与读取');
});
item(6,()=>{ // 改回生成的记录：沿用寄/收件人，不写“原站现为”
 const blk=live.slice(live.indexOf('// 改回记录：'),live.indexOf('audit.push(row);',live.indexOf('// 改回记录：')));
 assert(/sender:src\?\.sender/.test(blk)&&/revertOf:key/.test(blk),'要沿用原记录的寄/收件人并标明改回来源');
 assert(!/currentStatus/.test(blk),'没查过原站，不得写“原站现为”');
});
item(7,()=>{ // 导出：表头含原站现为/查看时间/是否已改回；结果用中文分类
 const t=A.exportRows([{...ok,currentStatus:'已揽件',checkedAt:'2026-10-25 12:00:00',reverted:true,revertedAt:'2026-10-25 13:00:00'}],()=>({sender:'甲',receiver:'乙',fromCampus:'良乡'}));
 for(const c of ['原站现为','查看原站时间','是否已改回','改回时间','失败原因'])assert(t[0].includes(c),'导出缺少列：'+c);
 const row=Object.fromEntries(t[0].map((k,i)=>[k,t[1][i]]));
 assert.equal(row['结果'],'成功');assert.equal(row['原站现为'],'已揽件');assert.equal(row['是否已改回'],'是');assert.equal(row['寄件人'],'甲');
 assert(/仅勾选的记录':'当前筛选结果'/.test(live),'导出提示要说明导出范围');
});
item(8,()=>{ // 没改成功的记录不给「改回原状态」
 assert(A.canRevert(ok)&&A.canRevert(unknown),'成功、不明可改回');
 for(const h of [fail,interrupted,cancelled])assert(!A.canRevert(h),h.result+' 不应可改回');
 assert(!A.canRevert({...ok,reverted:true}),'已改回的不再显示');
});
item(10,()=>{ // 搜索：寄/收件人、失败原因、结果分类
 assert(A.matches({...fail,error:'原站提示数据不完整'},'数据不完整'),'按失败原因搜');
 assert(A.matches(ok,'张三',()=>({sender:'张三'})),'按寄件人搜（从已读取数据补）');
 assert(A.matches(unknown,'不明'),'按结果分类搜');
 assert(!A.matches(ok,'李四',()=>({sender:'张三'})));
});

// 渲染：9 结果标签与日汇总、11 勾选计数、12 复查不明单、13 批次小标题，以及 3/8 在画面上的体现
const render=(audit,picked=[])=>{
 const nodes=new Map();
 const mk=()=>{const n={value:'',checked:false,indeterminate:false,disabled:false,hidden:false,textContent:'',dataset:{}};Object.defineProperty(n,'innerHTML',{set(v){n._html=v;},get(){return n._html||'';}});return n;};
 const $=id=>{if(!nodes.has(id))nodes.set(id,mk());return nodes.get(id);};
 const ctx={$,audit,records:{query:[],flow:[]},collapsedDays:new Set(),historyPicked:new Set(picked),historyQueued:new Set(),historyRunning:'',historySeq:new Map(),historyTotal:0,
  FeiHongAudit:A,E:s=>String(s??''),timingText:()=>'',Date,Map,Set,Number,String,JSON};
 vm.createContext(ctx);
 vm.runInContext(live.slice(live.indexOf('function renderHistory(){'),live.indexOf("$('officeKeywords').value=officeKeywords.join"))+'renderHistory();',ctx);
 return {html:$('historyRows').innerHTML,$};
};
item(9,()=>{
 const {html}=render([ok,fail,unknown]);
 assert(/class="history-badge ok">成功/.test(html)&&/class="history-badge failed">失败/.test(html)&&/class="history-badge unknown">不明/.test(html),'结果要有颜色标签');
 assert(/（3 条：成功 1 · 失败 1 · 不明 1）/.test(html),'日期标题要带成功/失败/不明计数');
});
item(11,()=>{
 const {$}=render([ok,{...fail,iso:'2026-10-25T03:01:00.000Z'}],[ok.iso]);
 assert.equal($('historyPickedCount').textContent,'已选 1 条');
 assert.equal($('historyAll').indeterminate,true);assert.equal($('historyAll').checked,false);
 assert.equal($('clearHistoryPicks').hidden,false);
 assert(/id="historyPickedCount"/.test(html)&&/id="clearHistoryPicks"/.test(html),'界面要有已选计数与清除选择');
});
item(12,()=>{
 const {$}=render([ok,unknown,pending,{...unknown,id:'JGKD9',reverted:true}]);
 assert.equal($('recheckUnknown').textContent,'复查不明单（2）','只算未改回的不明单');assert.equal($('recheckUnknown').disabled,false);
 assert(/outcome\(h\)==='unknown'&&!h\.reverted\);\r?\n if\(!rows\.length\)\{toast\('当前列表没有结果不明的记录/.test(live),'复查按钮只把不明单加入队列');
 assert(/id="recheckUnknown"/.test(html));
});
item(13,()=>{
 const b={batchId:'b1',batchSize:3};
 const {html:h}=render([{...ok,...b,iso:'2026-10-25T03:00:01.000Z'},{...fail,...b,iso:'2026-10-25T03:00:02.000Z'},{...unknown,...b,iso:'2026-10-25T03:00:03.000Z'},R('JGKD10','已确认提交（未回读）',{iso:'2026-10-25T01:00:00.000Z',time:'2026-10-25 09:00:00'})]);
 assert.equal((h.match(/class="history-batch"/g)||[]).length,1,'同一批次只出一行批次小标题');
 assert(/批量修改 11:00 · 共 3 单（本列表 3 条：成功 1 · 失败 1 · 不明 1）/.test(h),'批次小标题要写明时间与成败');
 assert(/batchId,batchSize:targets\.length\}/.test(live),'批量修改时要记下批次');
});
item('3/8 画面',()=>{
 const {html:h}=render([{...ok,iso:'2026-10-24T17:30:00.000Z',time:'2026-10-25 01:30:00'},fail]);
 assert.equal((h.match(/class="history-day"/g)||[]).length,1,'北京 10-25 凌晨的记录应与 10-25 白天的在同一组');
 assert(/data-revert="JGKD1"/.test(h)&&!/data-revert="JGKD2"/.test(h)&&/无需改回/.test(h),'失败的单显示“无需改回”');
});

const only=process.argv[2];let n=0;
for(const [k,fn] of Object.entries(items)){if(only&&String(k)!==only)continue;try{fn();n++;}catch(e){console.error('第 '+k+' 项失败：'+e.message);process.exitCode=1;}}
if(!process.exitCode)console.log('通过：状态修改历史 13 项改进逐项通过（'+n+' 组）。');
