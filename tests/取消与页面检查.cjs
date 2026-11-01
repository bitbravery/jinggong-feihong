// v0.9.218：状态调整每一步都在正确的门户标签页；取消可以立即中止并进行/未进行的单
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=f=>fs.readFileSync(__dirname+'/../'+f,'utf8');
const src=read('source.js'),worker=read('worker.js'),live=read('live.js');

// 1) source：每个动作前确认自己的门户标签在前台，不在就点自己的标签再重试
assert(/const fhSelfTab=want=>/.test(src),'source 要有“本帧对应标签是否在前台”的判断');
assert(src.includes('if(!fhSelfTab(/物流状态调整单/))return {waiting:true,wrongTab:true};'),'填单号/提交前确认调整单标签在前台');
assert(src.includes('if(!fhSelfTab(/京工飞鸿两校(?:区)?快件系统/))return {waiting:true,wrongTab:true};'),'点办理入口前确认系统标签在前台');
assert(src.includes('if(!fhSelfTab(/快件查询/))return {waiting:true,wrongTab:true};'),'单号查询/清条件前确认快件查询标签在前台');
const guards=(src.match(/fhSelfTab\(/g)||[]).length;
assert(guards>=6,'查询、办理入口、调整单三类动作都要有自纠，当前 '+guards+' 处');
assert(src.includes("active:act?text(act):''"),'portalState 要返回当前前台标签名');

// 2) worker：每一步前确认并切到正确标签
assert(/async function ensureFormActive\(stage,generation\)/.test(worker),'调整单标签校验');
assert(/async function ensureFormActive\(stage,generation\)\{[\s\S]{0,300}if\(await formActive\(\)\)return true;[\s\S]{0,150}await run\(\{type:'navigate',kind:'form'/.test(worker),'先确认再切换，不无脑连点');
assert(worker.includes('async function ensureServiceActive'),'系统标签校验');
assert(worker.includes('async function ensureQueryActive'),'快件查询标签校验');
assert(worker.includes("stage('正在切到“快件查询”标签…')"),'查询前会主动切到快件查询');
assert(worker.includes('await ensureServiceActive(stage,generation)'),'打开办理入口前切到系统标签');
assert(worker.includes('await ensureQueryActive();'),'按单号查询前切到快件查询');
assert(worker.includes('await ensureServiceActive();'),'查看原站状态打开办理入口前也校验系统标签');
assert(worker.includes('await ensureFormActive();'),'查看原站状态填单前也校验调整单标签');

// 3) 取消：准备/提交/等待都能立刻停，未开始的单不再执行
assert(live.includes('let changeCancelled=false'),'要有取消标记');
assert(/async function cancelChange\(\)\{[\s\S]{0,600}writePhase==='submitted'/.test(live),'提交阶段也能取消');
assert(live.includes("if(changeCancelled){setStage('已取消，剩余单未执行');break;}"),'每一单开始前检查取消');
assert(live.includes("if(changeCancelled){row.result='已取消，未提交';save();break;}"),'核对完表单后、提交前检查取消');
assert(live.includes('已取消（提交结果不明，请核对）'),'提交已发出时取消要如实记录结果不明');
assert(live.includes("'已取消：成功 '"),'取消后显示已完成/剩余统计');
assert(worker.includes("if(msg.type==='cancelWrite'){preparedWrite=null;writeGeneration++;return {cancelled:true};}"),'取消要作废准备令牌');
assert(/async function confirmPatiently\(command,label,onTick,alt,stage,generation\)/.test(worker),'确认/等待阶段可被取消打断');
assert(worker.includes('已取消等待：本单提交已发出'),'提交后取消的提示');
assert(worker.includes('generation!==writeGeneration)throw cancelledAfterSubmit()'),'收尾等待检查取消');
console.log('通过：查询/办理/调整单三类动作都先确认标签；取消可在准备、提交、等待阶段立即中止并跳过剩余单。');
