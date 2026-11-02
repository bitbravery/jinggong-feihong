// v0.9.194：提交遇到“数据不完整/请检查后重新提交”提示时，点确定 → 重新提交一次 → 再点确认框确定。
const assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
const worker=fs.readFileSync(__dirname+'/../worker.js','utf8');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');

// 1) 识别这类提示（沿用已有探测器）
assert(/const fhDirtyAlert=/.test(src)&&/数据不完整\|请检查后重新提交/.test(src),'要能识别数据不完整提示');

// 2) 第一次拦截：点确定 → 等提示框消失 → 再重新点一次提交（不是同一步立刻点）
assert(/retry\.count===0/.test(src)&&/retry\.phase='closing'/.test(src),'第一次拦截先点确定，进入等待提示框关闭');
assert(/Date\.now\(\)-retry\.at<450/.test(src),'提示框消失后要稍等再重新提交，避免点空');
assert(/retry\.phase='resent'/.test(src),'重新提交只点一次');
assert(/retry\.phase==='resent'[\s\S]{0,120}已重新提交一次仍被拦截|已重新提交一次仍被拦截/.test(src),'只有重新提交后再次拦截才判失败');
assert(/提示框一直没关掉/.test(src),'提示框关不掉要明确报错，不能盲目重提');
assert(/document\.getElementById\('sendBtn'\)/.test(src),'重提要按右上角“提交”');
assert(/try\{send\.click\(\);\}catch\{\}/.test(src),'重提动作是再点一次提交');
assert(/dirtyRetry:1/.test(src),'要把“已重提”状态回报给后台');

// 3) 成功结果带 resubmitted，历史里能看出来
assert(/resubmitted:!!\(window\.__fhDirtyRetry&&window\.__fhDirtyRetry\.count>0\)/.test(src),'成功结果要标记重新提交过');
assert(/resubmitted:!!\(confirmHit&&confirmHit\.resubmitted\)/.test(worker),'后台要把标记带回前端');
assert(/submitted\.resubmitted/.test(live),'历史记录要写明重新提交过');

// 4) 第二次仍被拦截则明确失败，不无限重试
assert(/已重新提交一次仍被拦截/.test(src),'重提一次后仍失败要明确报错');

// 5) 帮助页有对应说明
assert(/数据不完整/.test(html),'重要提示里要说明这种弹窗');

console.log('通过：数据不完整提示 → 确定 → 重新提交一次 → 继续确认；失败有明确说明，历史可追溯。');
