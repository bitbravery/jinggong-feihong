// v0.9.208：门户“查询条件”面板用完必须点「关闭查询」，否则页面停在查询态，后续读取/改状态都会错乱。
const assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
const w=fs.readFileSync(__dirname+'/../worker.js','utf8');

// 1) source 能点「关闭查询」
assert(src.includes("command.type==='closeQuery'"),'source 要有 closeQuery 命令');
assert(/关闭查询/.test(src),'要按文字找「关闭查询」');
assert(/cands\.sort\(\(a,b\)=>a\.getBoundingClientRect\(\)\.width/.test(src),'取最里层元素，避免点到外层容器');

// 2) 每次按单号查询后自动关闭
assert(w.includes('async function queryOneRaw'),'queryOne 原逻辑保留');
assert(/async function queryOne\(id,opts\)\{\s*try\{return await queryOneRaw\(id,opts\);\}\s*finally\{try\{await closeQueryPanel\(\);\}catch\{\}\}\s*\}/.test(w),'查询结束必须关闭查询面板（finally，异常也关）');

// 3) 填调整单前也先关
assert(/await ensureFormActive\(stage\);\s*\n\s*try\{await closeQueryPanel\(\);\}catch\{\}/.test(w),'填单号前先关掉残留查询面板');

console.log('通过：任何单号查询结束后自动点「关闭查询」；填单前也会先关。');
