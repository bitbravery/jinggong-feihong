// 批量进度：弹窗里每单都有状态徽标；某一单失败只跳过它，后面的继续；收尾给出成功/失败统计。
const assert=require('node:assert/strict'),fs=require('node:fs');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');

assert(/\.cs-row/.test(live)&&/data-row/.test(live),'待提交清单必须逐单渲染，带 data-row');
assert(/\.cs-state/.test(live)&&/data-state/.test(live),'每单必须有状态徽标 data-state');
assert(/function setOrderState\(id,text,kind\)/.test(live),'缺少 setOrderState');
assert(/function setOrderNote\(id,note\)/.test(live),'缺少 setOrderNote');
assert(/batchIndex=orderIndex\+1;batchTotal=targets\.length;/.test(live),'缺少第 k/N 单进度');
assert(/for\(let orderIndex=0;orderIndex<targets\.length;orderIndex\+\+\)\{/.test(live),'批量循环必须逐单可中断');

const i=live.indexOf('for(let orderIndex=0;');
const seg=live.slice(i, i+4000);
assert(/catch\(err\)\{/.test(seg),'单次失败必须被捕获，而不是中断整批');
assert(/failures\.push\(order\.id\)/.test(seg),'失败单号要记录下来');
assert(/setOrderState\(order\.id,'失败','bad'\)/.test(seg),'失败单要标红');
assert(/setOrderState\(order\.id,'已改好','ok'\)/.test(seg),'成功单要标记');
assert(!/throw err;\s*\}\s*\}\s*\}/.test(seg)||/历史保存失败/.test(seg),'只有历史保存失败才允许中断整批');
assert(/批量完成：成功 '\+doneCount\+' 单，失败 '\+failures\.length/.test(live),'收尾要给成功/失败统计');
assert(!/consecutiveFails>=3/.test(live),'不再中断整批：一单失败继续下一单，直到全部处理完');
assert(/consecutiveFails===5/.test(live),'连续 5 单失败要给出提示，但不得停止整批');
console.log('通过：逐单显示进度，单次失败不中断整批，连续 5 单只提示不停止，收尾给统计。');
