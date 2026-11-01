// v0.9.211：读取与回查分离；已办页手动“实际状态回查”；历史状态改走快件查询（更快）。
const assert=require('node:assert/strict'),fs=require('node:fs');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');
const w=fs.readFileSync(__dirname+'/../worker.js','utf8');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');

// 1) 读取流程不再自动回查
assert(!live.includes("if(flowTab==='已办'&&fresh.length)"),'读取时只读取，不自动回查');

// 2) 已办页有手动按钮，且只在已办页显示
assert(html.includes('id="syncFlowStatus"'),'要新增“实际状态回查”按钮');
assert(/currentView==='flow'&&flowTab==='已办'/.test(live),'按钮只在已办页显示');
assert(/flowSyncBtn\.onclick=async\(\)=>\{/.test(live),'点击后才回查');

// 3) 回查前先确认业务标签、关掉残留调整单
const sync=w.slice(w.indexOf("msg.type==='syncFlowStatus'"),w.indexOf("msg.type==='statusPreflight'"));
assert(sync.includes('closeFormTab'),'回查前要关掉残留的物流状态调整单');
assert(sync.includes('没有打开“京工飞鸿两校快件系统”'),'业务标签没开要提示');

// 4) 历史“查看原站状态”改走快件查询
const so=w.slice(w.indexOf("msg.type==='statusOf'"),w.indexOf("msg.type==='diagnose'"));
assert(so.includes('queryOne(msg.id'),'状态回查要走快件查询按单号查');
assert(!so.includes('formOrder('),'不再打开调整单逐单核对');
assert(so.includes('没有这个单号'),'查不到要明确提示');

// 5) 历史批量查看前先关残留调整单（statusPreflight）
assert(/async function pumpStatus\(\)\{\s*\n\s*if\(statusBusy\)return;\s*\n\s*statusBusy=true;[\s\S]{0,200}statusPreflight/.test(live),'历史批量查看前要先清理调整单');

console.log('通过：读取/回查分离、已办手动回查、历史状态改走快件查询。');
