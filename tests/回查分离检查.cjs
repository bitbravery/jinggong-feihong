// v0.9.211：读取与回查分离；已办页手动“实际状态回查”；历史状态改走快件查询（更快）。
const assert=require('node:assert/strict'),fs=require('node:fs');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');
const w=fs.readFileSync(__dirname+'/../worker.js','utf8');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');

// 1) 读取流程不再自动回查
assert(!live.includes("if(flowTab==='已办'&&fresh.length)"),'读取时只读取，不自动回查');

// 2) 已办页有手动按钮，且只在已办页显示
assert(live.includes('data-sync'),'流程标签行要有“实际状态回查”');
assert(!live.includes("'抄送给我'"),'标签行不再有抄送给我');
assert(live.includes('async function runSyncFlowStatus()'),'点击才回查');

// 3) 回查前先确认业务标签、关掉残留调整单
const sync=w.slice(w.indexOf("msg.type==='syncFlowStatus'"),w.indexOf("msg.type==='statusPreflight'"));
assert(sync.includes('closeFormTab'),'回查前要关掉残留的物流状态调整单');
assert(sync.includes('没有打开“京工飞鸿两校快件系统”'),'业务标签没开要提示');

// 4) 历史“查看原站状态”保持原方式（打开调整单核对）
const so=w.slice(w.indexOf("msg.type==='statusOf'"),w.indexOf("msg.type==='diagnose'"));
assert(so.includes('formOrder(msg.id)'),'历史状态回查仍走调整单');
assert(!so.includes('queryOne(msg.id'),'不再走快件查询');


// 批量查完只关一次查询（不是每单都关）
const syncBlock=w.slice(w.indexOf("msg.type==='syncFlowStatus'"),w.indexOf("msg.type==='statusPreflight'"));
assert(!syncBlock.includes('queryOne('),'批量回查不再逐单调用 queryOne（那会每单都关一次）');
assert(syncBlock.includes('for(let i=0;i<ids.length;i++)'),'批内逐单查询');
assert(/finally\{[\s\S]{0,160}closeQueryPanel/.test(syncBlock),'全部查完在 finally 里统一关闭查询');
console.log('通过：读取/回查分离、已办手动回查、历史状态改走快件查询。');
