// 页面滚动记忆：每个页面首次进入从顶部开始；切走再切回来，回到刚才停留的位置（不强制回顶）
const assert=require('node:assert/strict'),fs=require('node:fs');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');

assert(live.includes('const viewScroll={orders:0,flow:0,settings:0,history:0,tips:0};'),'要有每个页面的滚动位置记录');
assert(/function view\(v\)\{try\{viewScroll\[currentView\]=window\.scrollY\|\|document\.documentElement\.scrollTop\|\|0;\}catch\{\}/.test(live),'切走前要记住当前页面的滚动位置');
assert(live.includes('viewScroll[v]||0'),'切回来要读取该页面的滚动位置');
assert(live.includes('window.scrollTo(0,y)'),'切回来要恢复滚动位置');
assert(!live.includes("rows.scrollTop=0"),'不能一切到状态修改历史就强制滚回顶部');
assert(!live.includes("if(v==='history'){try{const rows=document.getElementById('historyRows')"),'历史页不再做强制回顶');
console.log('通过：每个页面单独记住滚动位置；首次进入在顶部，切走再切回恢复上次位置。');
