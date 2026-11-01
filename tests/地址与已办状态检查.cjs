// v0.9.206：寄件地址行把校区并入括号；查询条件行自适应；已办状态回到「快件查询」校正。
const assert=require('node:assert/strict'),fs=require('node:fs');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');
const w=fs.readFileSync(__dirname+'/../worker.js','utf8');
const css=fs.readFileSync(__dirname+'/../style.css','utf8');

// 1) 地址格：校区进第一行括号，第二行只留收件地址
assert(live.includes('region-tag'),'校区要渲染成标签');
assert(!live.includes("r!=='—'?'（'+E(r)+'）'"),'不要再写成括号文本');
assert(!live.includes("${E(region(o,mappings))}</small></td>"),'校区不应再占第三行');

// 2) 主区与查询条件行自适应
assert(/main\{max-width:none\}/.test(css),'主区不再限宽，随窗口铺满');
assert(/#queryRow\{flex-wrap:wrap!important/.test(css),'查询条件行可换行，不超出页面');

// 3) 已办状态校正
assert(w.includes("msg.type==='syncFlowStatus'"),'后台要能按单号核对实际状态');
assert(w.includes("queryOne(id,{allowEmpty:true})"),'核对要回快件查询');
assert(!live.includes("if(flowTab==='已办'&&fresh.length)"),'读取时只读取，不再自动回查状态');
assert(live.includes('flowSyncBtn.onclick'),'已办页要有“实际状态回查”按钮');
assert(/currentView==='flow'&&flowTab==='已办'/.test(live),'按钮只在已办页出现');
assert(live.includes("request({type:'syncFlowStatus',ids})"),'点击后才调用回查命令');
assert(live.includes("statusSource:'query'"),'回查到的行要标来源');
assert(live.includes("m.type==='statusSync'"),'要显示回查进度');
assert(w.includes('if(!portal||!portal.service)throw Error'),'回查前先确认业务标签并关掉残留调整单');
assert(w.includes("'syncFlowStatus','statusPreflight'"),'回查要纳入原站串行');


// v0.9.207：顶部工具行/查询条件行不换行；已办先渲染再回填
assert(/\.header-layout-controls\{flex-wrap:nowrap!important/.test(css),'诊断/页面字号/密度/恢复默认列宽要在同一行');
assert(/#queryRow\{flex-wrap:nowrap!important/.test(css),'查询条件行不换行');
assert(/#queryRow input\[type=date\]\{width:116px/.test(css),'日期框按内容收紧');
assert(/hit\.statusSource='query'/.test(live),'回查进度要逐条回填到列表');
console.log('通过：校区进括号、查询行自适应、已办状态回快件查询校正。');
