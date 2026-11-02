// v1.0.0 发布前修复检查：P0×2（开批保存保护、回读单号校验）+ P1（快照分类、快速查询熔断/进度、取消清确认框、隐藏帧防重复提交、脏数据重提核对）
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=f=>fs.readFileSync(__dirname+'/../'+f,'utf8');
const src=read('source.js'),worker=read('worker.js'),live=read('live.js');

// 1) 开批前关残留调整单必须先等保存（不重演 0.9.195 卡“加载中”）
const pre=worker.slice(worker.indexOf("msg.type==='statusPreflight'"),worker.indexOf("msg.type==='cancelWrite'"));
assert(/portalSaving\(\)[\s\S]{0,200}waitSaved\(\)[\s\S]{0,500}closeFormTab/.test(pre),'开批前先等门户保存完，再关残留调整单');

// 2) 批量按单号查询必须核对回读单号，避免把 A 单状态记到 B 单
const sync=worker.slice(worker.indexOf("msg.type==='syncFlowStatus'"),worker.indexOf("msg.type==='statusPreflight'"));
assert(/\brec\.id!==id\b/.test(sync),'回读单号必须与请求单号一致');
assert(sync.includes('回读单号不匹配'),'单号不一致要记失败重试');
assert(sync.includes('batchEnd')&&/consecutive>=8/.test(sync),'快速查询要有整批超时与连续失败熔断');
assert(sync.includes('attempt<2'),'单号失败要重试一次');

// 3) 流程快照带 flowTab，避免把待办行当已办下一页
const snapCount=(worker.match(/snapshot\('flow',msg\.flowTab\)/g)||[]).length;
assert(snapCount>=4,'流程读取/翻页快照都要带分类，当前 '+snapCount+' 处');

// 4) 取消时顺手点掉「您确定要提交吗」的取消，避免之后误点确定
assert(worker.includes("run({type:'confirmCancel'})"),'取消后要尝试关掉残留确认框');
assert(src.includes("command.type==='confirmCancel'")&&src.includes('cancelledDialogs'),'source 要能点确认框的“取消”');
assert(/confirmCancel[\s\S]{0,300}您确定要提交吗/.test(src),'只处理「您确定要提交吗」确认框');

// 5) 隐藏的第二个表单 iframe 不许动手，防止同一单点两次提交
assert(/fhTabHere=want=>\{try\{if\(window\.frameElement\)/.test(src),'动作前要确认本帧真的显示着');
assert(src.includes('fr.height')&&src.includes('fr.width'),'隐藏帧高度/宽度为 0 时不得操作');

// 6) 脏数据重提前核对当前表单单号
assert(src.includes('dhNow!==command.order.id'),'重提前要核对当前表单是不是本单');

// 7) 历史快速查询进度不被 busy 挡住
assert(live.includes("if(m.type==='statusSync'){"),'statusSync 要单独处理（不被 busy 挡住）');
assert(live.includes("if(typeof statusBusy!=='undefined'&&statusBusy&&historyStatusMode==='fast')"),'历史快速查询要更新“快速查询中 k/n”');
assert(live.includes("btn.textContent='快速查询中 '"),'快速查询要有进度文案');

// 8) 顺手修掉的两个小 bug：通知正文正则、空样例
assert(!/replace\(\/s\+\/g/.test(src),'通知正文去空白正则要有反斜杠');
assert(!/slice\(0,0\)/.test(src),'不能再用 slice(0,0) 取样例');

// 9) 前端：提交前置检查失败不能把界面永久卡 busy
assert(/try\{pre=await request\(\{type:'statusPreflight'\}\);\}/.test(live),'前置检查要包在 try/catch 里');
assert(/catch\(err\)\{busy=false;writePhase='idle';changeCancelled=false;/.test(live),'前置检查失败要复位 busy/取消状态并提示');
// 10) 读取入口不再吞掉“未连接/后台版本不匹配”的错误
assert(/try\{await requireComponent\(\);\}catch\(err\)\{toast\(err\.message,8000\);return;\}/.test(live),'读取入口要先检查后台版本并提示');
// 11) 快速查询期间新入队的记录不能丢
assert(live.includes('statusQueue.splice(0)'),'快速查询要逐个处理队列，不能整体清空');
assert(!/快速查询[\s\S]{0,2000}statusQueue\.length=0/.test(live),'快速查询结束不能把新入队记录静默清掉');
// 12) 流程部分读取失败要保留另一个分类；流程完整性不再谎报“近一个月”
assert(live.includes("records.flow=[...records.flow.filter(o=>o.flow!==flowTab),...e.partial.flatMap"),'流程读取失败也要保留其他分类');
assert(live.includes('limited:true'),'流程读取要标记为“前 N 页/未完整”');
assert(live.includes("currentView==='flow'&&s)$('scopeFooter')")&&live.includes("currentView==='flow'&&!lastReadError&&s)$('connection')"),'流程页读取状态用独立文案');
// 13) 流程视图改状态只取当前分类，避免旧待办副本误拦截
assert(live.includes("currentView!=='flow'||o.flow===flowTab"),'openChange 要按当前分类取记录');
console.log('通过：开批保存保护、回读单号校验、快照分类、快速查询熔断/进度/队列、取消清理确认框、隐藏帧防重复提交、脏数据重提核对、前端 busy/错误提示/流程完整性。');
