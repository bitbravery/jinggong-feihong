// v0.9.204：批量改状态前置检查——必须打开「京工飞鸿两校快件系统」；有「物流状态调整单」先关掉。
const assert=require('node:assert/strict'),fs=require('node:fs');
const w=fs.readFileSync(__dirname+'/../worker.js','utf8');
const l=fs.readFileSync(__dirname+'/../live.js','utf8');
const s=fs.readFileSync(__dirname+'/../source.js','utf8');

// 1) 前置检查存在，且要求业务标签
assert(w.includes("msg.type==='statusPreflight'"),'要有批量前置检查命令');
assert(w.includes('原站没有打开“京工飞鸿两校快件系统”标签'),'业务标签没开要明确提醒');
// 2) 有调整单先关（最多 3 次）
const block=w.slice(w.indexOf("msg.type==='statusPreflight'"),w.indexOf("msg.type==='cancelWrite'"));
assert(/for\(let i=0;i<3&&portal\.forms>0;i\+\+\)/.test(block),'残留调整单最多关 3 次');
assert(block.includes("run({type:'closeFormTab'})"),'要真的点关闭');
// 3) 批量开始前调用
assert(/const pre=await request\(\{type:'statusPreflight'\}\)/.test(l),'批量开始前要执行前置检查');
assert(/已关闭残留的“物流状态调整单”/.test(l),'关掉了要提示用户');
// 4) 串行集合包含它
assert(w.includes("'statusPreflight','read'"),'前置检查要纳入原站串行队列');

// 5) 确认框：0.1 秒一次、最多 3 次、3 次不开就报错（后台关标签跳过）
assert(s.includes('ps.tries<3&&(ps.tries===0||Date.now()-ps.last>=100)'),'点击节奏 0.1 秒、最多 3 次');
assert(s.includes('提示框连续点 3 次'),'3 次不开要报错');
assert(w.includes('已关闭“物流状态调整单”并跳过本单'),'后台收到后要关标签并继续下一单');

console.log('通过：批量前置检查与确认框 3 次上限已就位。');
