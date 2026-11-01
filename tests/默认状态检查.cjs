// v0.9.205：新打开的三个默认 + 表格自适应宽度
const assert=require('node:assert/strict'),fs=require('node:fs');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');
const sidebar=fs.readFileSync(__dirname+'/../sidebar-layout.js','utf8');
const layout=fs.readFileSync(__dirname+'/../table-layout.js','utf8');

// 1) 默认展开侧栏：上次若是图标模式（≤110），新打开回到 232
assert(/if\(width<=110\)width=232;/.test(sidebar),'新打开侧栏应展开');

// 2) 默认视图 = 快件查询及状态调整
assert(live.includes("let currentView='orders'"),'默认视图应为快件查询及状态调整');
assert(live.includes("view('orders');loadDurableAudit();"),'启动时应切到快件查询页');

// 3) 进入状态修改历史回到顶部
assert(/if\(v==='history'\)\{try\{const rows=document\.getElementById\('historyRows'\);if\(rows\)rows\.scrollTop=0;/.test(live),'历史页打开时列表回到顶部');

// 4) 表格自适应：列宽按比例、表格始终 100%
assert(/cols\.forEach\(\(c,i\)=>c\.style\.width=\(widths\[i\]\/total\*100\)\.toFixed\(4\)\+'%'\)/.test(layout),'快件表列宽按比例分配');
assert(/table\.style\.width='100%';table\.dataset\.density/.test(layout),'快件表宽度始终 100%');
assert(/cols\.forEach\(\(c,i\)=>c\.style\.width=\(widths\[i\]\/total\*100\)/.test(layout),'历史表也按比例自适应');
assert(/if\(!widths\)\{cols\.forEach\(\(c,i\)=>c\.style\.width=ratios\[i\]\+'%'\)/.test(layout),'历史表默认按比例撑满');

console.log('通过：侧栏默认展开、默认进快件查询、历史回到顶部、两张表都自适应宽度。');
