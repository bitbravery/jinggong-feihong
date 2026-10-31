// 状态修改历史：按日期（几月几日）折叠；操作列「改回原状态 / 查看原站状态」同一行；
// 查过原站后把原站现态显示在该行。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');
const css=fs.readFileSync(__dirname+'/../style.css','utf8');

// 1) 按日分组 + 折叠
assert(/const groups=new Map\(\);/.test(live),'历史应按日期分组');
assert(/data-day=/.test(live),'日期标题要有可点击的三角按钮');
assert(/collapsedDays\.has\(day\)/.test(live),'要支持折叠状态');
assert(/feihong-history-days/.test(live),'折叠状态要持久化');
assert(/function dayLabel\(day\)/.test(live),'缺少日期显示格式');
assert(/月'\+Number\(m\[3\]\)\+'日'/.test(live),'日期要显示成几月几日');
assert(/data-day/.test(css)||/\.history-day \.day-toggle/.test(css),'三角形按钮需要样式');

// 2) 两个按钮在同一行
assert(/const actions=`\$\{revertCell\}\$\{/.test(live),'改回原状态与查看原站状态应放在同一容器');
assert(/class="history-actions">\$\{actions\}/.test(live),'操作列要输出合并后的按钮组');
assert(/\.history-table td\.history-actions\{white-space:nowrap/.test(css),'操作列不得换行（需高于 .history-table td 的优先级）');
assert(/\.history-table td\.history-actions \.button\{[^}]*display:inline-block/.test(css),'两个按钮要横排且宽度自适应');
assert(/width:20%/.test(fs.readFileSync(__dirname+'/../index.html','utf8')),'处理列要留出放两个按钮的宽度');

// 3) 查看原站状态后显示原站现态
assert(/原站现为：/.test(live),'要显示原站现态');
assert(/history-live\$\{mismatch\?' bad':''\}/.test(live),'与原站不一致时要打红标');
assert(/（≠目标）/.test(live),'不一致时要有文字说明');
assert(/\.history-live\.bad\{background:#fbeaea/.test(css),'不一致用浅红色');
assert(/h\.currentStatus/.test(live)&&/h\.checkedAt/.test(live),'现态要带查询时间');
assert(/row\.currentStatus=r\.status/.test(live),'查询成功要把状态写回记录');

// 4) 空结果要有说明
assert(/所选时间段内没有修改记录/.test(live),'空结果要说明');

// 5) 实际渲染一次：给定两条不同日期的记录，应输出两个日期标题
{
 const nodes=new Map();
 const mk=id=>{const n={value:'',checked:false,textContent:'',dataset:{},addEventListener(){},setAttribute(){},removeAttribute(){}};Object.defineProperty(n,'innerHTML',{set(v){n._html=v;},get(){return n._html||'';}});return n;};
 const $=id=>{if(!nodes.has(id))nodes.set(id,mk(id));return nodes.get(id);};
 $('historySearch').value='';$('historyFrom').value='';$('historyTo').value='';
 const records={query:[{id:'A',sender:'甲',receiver:'乙',fromCampus:'良乡'}],flow:[]};
 const audit=[
  {id:'A',from:'已签收',to:'已送达',iso:'2026-10-25T13:48:00.000Z',time:'10-25 13:48',result:'已确认提交',action:'物流状态调整',currentStatus:'已送达',checkedAt:'10-25 13:50'},
  {id:'B',from:'已签收',to:'已送达',iso:'2026-10-24T09:10:00.000Z',time:'10-24 09:10',result:'准备失败，未提交',action:'物流状态调整'}
 ];
 const ctx={$:$,audit,records,collapsedDays:new Set(),historyPicked:new Set(),historyQueued:new Set(),historyRunning:'',historySeq:new Map(),historyTotal:0,localStorage:{getItem:()=>'[]',setItem(){}},
  // v0.9.176 契约变化：渲染改用 audit-history.js 的筛选/分类/北京时间分日，这里加载真实文件而不是只给 within 的替身
  FeiHongAudit:require('../audit-history.js'),E:s=>String(s??''),formatTime:()=>'10-25 13:50',toast(){},request:async()=>({status:'已送达'}),Date,Map,Set,Number,String,JSON};
 vm.createContext(ctx);
 const fn=live.slice(live.indexOf('function renderHistory(){'),live.indexOf("$('officeKeywords').value=officeKeywords.join"));
 vm.runInContext(fn+'renderHistory();',ctx);
 const html=$('historyRows').innerHTML;
 assert((html.match(/class="history-day"/g)||[]).length===2,'两条不同日期应生成两个日期分组，实际：'+(html.match(/class="history-day"/g)||[]).length);
 assert(/10月25日/.test(html)&&/10月24日/.test(html),'日期标题应写成几月几日');
 assert(/原站现为：已送达/.test(html),'应显示原站现态');
 assert(/data-revert="A"/.test(html)&&/data-status="A"/.test(html),'两个按钮都要在行里');
}
console.log('通过：历史按日期折叠，操作按钮同一行，查看后显示原站现态。');
