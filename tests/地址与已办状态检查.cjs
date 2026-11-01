// v0.9.206：寄件地址行把校区并入括号；查询条件行自适应；已办状态回到「快件查询」校正。
const assert=require('node:assert/strict'),fs=require('node:fs');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');
const w=fs.readFileSync(__dirname+'/../worker.js','utf8');
const css=fs.readFileSync(__dirname+'/../style.css','utf8');

// 1) 地址格：校区进第一行括号，第二行只留收件地址
assert(live.includes("const r=region(o,mappings);return r&&r!=='—'?'（'+E(r)+'）':''"),'寄件地址第一行要有（校区）');
assert(!live.includes("${E(region(o,mappings))}</small></td>"),'校区不应再占第三行');

// 2) 主区与查询条件行自适应
assert(/main\{max-width:none\}/.test(css),'主区不再限宽，随窗口铺满');
assert(/#queryRow\{flex-wrap:wrap!important/.test(css),'查询条件行可换行，不超出页面');

// 3) 已办状态校正
assert(w.includes("msg.type==='syncFlowStatus'"),'后台要能按单号核对实际状态');
assert(w.includes("queryOne(id,{allowEmpty:true})"),'核对要回快件查询');
assert(live.includes("if(flowTab==='已办'&&fresh.length)"),'读取已办后自动校正');
assert(live.includes("request({type:'syncFlowStatus',ids})"),'前端要调用校正命令');
assert(live.includes("statusSource:'query'"),'校正过的行要标来源');
assert(live.includes("m.type==='statusSync'"),'要显示核对进度');

console.log('通过：校区进括号、查询行自适应、已办状态回快件查询校正。');
