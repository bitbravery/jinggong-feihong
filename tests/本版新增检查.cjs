// v0.9.223：回查进度/仅已办、查询页只看快件查询、历史精确/快速查询、侧栏核心提示、重要提示扩写
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=f=>fs.readFileSync(__dirname+'/../'+f,'utf8');
const html=read('index.html'),live=read('live.js'),worker=read('worker.js'),css=read('style.css');

// 1) 实际状态回查：只在已办显示；有进度条、k/n、没查到的单单独上报
assert(live.includes("(flowTab==='已办'?"),'“实际状态回查”按钮只在已办页显示');
assert(live.includes("flowTab!=='已办'"),'非已办点了也要拦住');
assert(/bar\.max=m\.total\|\|1/.test(live),'回查要有进度条');
assert(/已回查 '\+m\.done\+'\/'\+m\.total/.test(live),'回查要显示 k/n');
assert(live.includes('failures'),'回查要把没查到的单报回来');
assert(/attempt<2/.test(worker),'单号一次没查到要重试一次');

// 2) 快件查询页：只确保「快件查询」在前台，不关原站其他标签、不要求业务标签
assert(worker.includes("if(kind!=='form'&&kind!=='query')await closeResidualForm"),'查询页不关闭其他标签');
assert(!worker.includes('没有打开“京工飞鸿两校快件系统”标签，无法回查'),'回查不再要求业务标签');
assert(worker.includes("ensurePortalPage('query')"),'查询前确保快件查询标签');

// 3) 状态修改历史：精确 / 快速二选一
assert(html.includes('name="historyStatusMode"'),'历史要有精确/快速二选一');
assert(html.includes('精确查询')&&html.includes('快速查询'),'两个选项文字');
assert(live.includes("historyStatusMode==='fast'"),'前端按选择走快/慢');
assert(worker.includes("msg.type==='statusOfFast'"),'后台要有快速查询命令');
assert(worker.includes('queryOne(msg.id'),'快速查询按单号走快件查询');

// 4) 侧栏核心提示（深绿区域），折叠后不显示
assert(html.includes('id="sidebarNotes"'),'侧栏要有核心提示区域');
assert(/10 分钟/.test(html),'要提醒每 10 分钟回原站刷新');
assert(/不要点击操作原站/.test(html),'要提醒操作期间不要点原站');
assert(/不代表 100% 正确/.test(html),'要有免责与反馈提示');
assert(css.includes('.sidebar-notes')&&css.includes('.sidebar-icon-only .sidebar-notes'),'折叠后不显示侧栏提示');

// 5) 重要提示页扩写：关键提醒、主要功能、导出 Excel 的 A4 排版说明、最后一句
assert(/<h3>关键提醒<\/h3>/.test(html),'提示页要有「关键提醒」');
assert(/<h3>主要功能<\/h3>/.test(html),'提示页要有「主要功能」');
assert(/导出 Excel/.test(html),'主要功能里要有导出 Excel 说明');
assert(/A4 横向预设列宽/.test(html),'导出 Excel 要说明 A4 排版');
assert(/以上为部分主要功能列举，当然还有一些其他功能可以探索使用/.test(html),'主要功能最后一句');
console.log('通过：回查进度/仅已办、查询页只看快件查询、精确+快速查询、侧栏核心提示、重要提示扩写。');
