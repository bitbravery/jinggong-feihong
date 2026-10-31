// v0.9.196：成功口径 = “提交成功”+“调整单自动关闭”两个信号同时成立；
// 加载中只等不关；关不掉标签则复用继续；只有“原站卡在加载中”才停整批。
const assert=require('node:assert/strict'),fs=require('node:fs');
const w=fs.readFileSync(__dirname+'/../worker.js','utf8');
const l=fs.readFileSync(__dirname+'/../live.js','utf8');
const s=fs.readFileSync(__dirname+'/../source.js','utf8');

// 1) 双信号
assert(/let sawToast=/.test(w)&&/let sawClosed=/.test(w),'要分别跟踪“提交成功”和“标签关闭”');
assert(/while\(Date\.now\(\)<sigEnd&&!\(sawToast&&sawClosed\)\)/.test(w),'要等到两个信号都出现');
assert(/basis:'提交成功\+调整单自动关闭'/.test(w),'成功依据要写明两个信号');
assert(/throw Error\('提交后没有同时出现/.test(w),'少一个信号就记结果不明');
assert(/已继续下一单/.test(w),'结果不明也要继续下一单');
assert(/command\.type==='toastState'/.test(s),'要有 toastState 供核对“提交成功”');

// 2) 加载中只等不关
assert(/if\(portal\.forms>0&&await portalSaving\(\)\)\{[\s\S]{0,120}waitSaved/.test(w),'正在保存时只等不关');
assert(!/关闭遗留的调整单标签[\s\S]{0,80}await pause\(500\)/.test(w),'不应再有“关一下等 500ms”的旧循环');
assert(/已尝试 3 次/.test(w)===false,'关不掉不再直接报错');
assert(/沿用现有标签继续/.test(w),'关不掉时应复用现有标签');

// 3) 只有卡加载才停批
assert(/仍在“加载中”\|保存超过 90 秒\|卡在加载中/.test(l),'批量要识别“卡在加载中”');
assert(/原站一直卡在加载中（已处理/.test(l),'停批时要提示已处理多少单');
assert(/请到原站刷新页面/.test(l),'停批时要告诉用户去原站刷新');

// 4) 单子失败仍然继续（通用 catch 不抛）
assert(/consecutiveFails\+\+/.test(l)&&/continue|for\(const/.test(l),'单子失败应继续下一单');

console.log('通过：双信号成功口径、加载中只等不关、关不掉复用继续、仅卡加载时停批。');
