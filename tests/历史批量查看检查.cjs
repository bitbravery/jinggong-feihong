// 历史批量查看状态：勾选若干条后按显示顺序逐条查；单行点击也进同一队列，绝不并发。
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');
const worker=fs.readFileSync(__dirname+'/../worker.js','utf8');

// 1) 界面：勾选列 + 全选 + 批量按钮
assert(/id="historyAll"/.test(html),'表头要有全选勾选框');
assert(/class="history-check"/.test(html),'要有勾选列');
assert(/id="batchStatusCheck"/.test(html),'要有「批量查看状态」按钮');
assert(/批量查看状态/.test(html),'按钮文字应为「批量查看状态」');
assert(/data-pick=/.test(live),'每行要能勾选');
assert(/querySelectorAll\('#historyRows input\[data-pick\]'\)/.test(live),'全选只作用于当前列表');

// 2) 顺序执行：一个队列、一个泵，逐条查
assert(/\$\('batchStatusCheck'\)\.onclick=/.test(live),'必须绑定批量查看');
assert(/async function pumpStatus\(\)/.test(live),'要有串行队列');
assert(/while\(statusQueue\.length\)/.test(live),'必须一条一条顺序查');
assert(/statusQueue\.shift\(\)/.test(live),'每查完一条才取下一条');
assert(/type:'statusOf',id:row\.id/.test(live),'精确查询要逐条打开调整单核对');
assert(live.includes("historyStatusMode==='fast'"),'要有精确/快速二选一分支');
assert(/type:'syncFlowStatus'/.test(live),'快速查询复用批量按单号查询');
assert(/it\.row\.via='fast'/.test(live),'快速查询结果要标明来源');
assert(/name="historyStatusMode"/.test(html)&&/input\[name="historyStatusMode"\]/.test(live),'要有精确/快速二选一');
assert(/enqueueStatus\(\[row\]\)/.test(live),'单行“查看原站状态”也要入队，不能并发');
assert(/查询中 '\+sSeq\+'\/'\+historyTotal/.test(live)&&/排队中 '\+sSeq\+'\/'\+historyTotal/.test(live),'行内按钮要显示“查询中 k/n / 排队中 m/n”');
assert(/historyQueued/.test(live)&&/historyRunning/.test(live),'队列状态要驱动行内按钮');
assert(/historySeq=new Map\(\)/.test(live)&&/historyTotal=0/.test(live),'要有本轮序号与总数，供 k/n 显示');
assert(/if\(statusBusy\)return;/.test(live),'泵必须防重入');
assert(/查询中 '\+Math\.min\(statusDone\+1,statusTotal\)\+'\/'\+statusTotal/.test(live),'要有进度提示');
assert(/function historyDisplayRows\(\)/.test(live),'批量要按当前显示顺序取记录');
assert(/historyDisplayRows\(\)\.filter\(h=>picked\.includes\(h\.iso\)\)/.test(live),'勾选批量按显示顺序排队');

// 3) 失败继续 + 结果落库
assert(/row\.currentStatus='取不到（'/.test(live),'单条失败要记下来并继续');
assert(/row\.currentStatus=r\.status;row\.via='exact';row\.checkedAt=formatTime/.test(live),'结果要写进记录');
assert(/原站现为：/.test(live),'行内要显示原站现态');

// 4) 连续查看不再卡在标签上
const fo=worker.slice(worker.indexOf('async function formOrder'),worker.indexOf('async function framePaths'));
assert(!/throw Error\('[^']*关不掉/.test(fo),'查看状态不应再因残留标签直接失败');
assert(/reuseTab/.test(fo),'关不掉时应复用现有标签');

console.log('通过：历史批量查看按显示顺序逐条执行，单行点击同样入队，失败继续、结果落库。');
