// v0.9.194：提交遇到“数据不完整/请检查后重新提交”提示时，点确定 → 重新提交一次 → 再点确认框确定。
const assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
const worker=fs.readFileSync(__dirname+'/../worker.js','utf8');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');

// 1) 识别这类提示（沿用已有探测器）
assert(/const fhDirtyAlert=/.test(src)&&/数据不完整\|请检查后重新提交/.test(src),'要能识别数据不完整提示');

// 2) 点确定后重新点提交，而不是直接判失败
assert(/fhDismiss\(dirtyAlert\.box\);[\s\S]{0,300}if\(retry\.count>=1\)/.test(src),'先点确定关闭提示（并核对表单单号）');
assert(/retry\.count\+\+;/.test(src),'同一单只允许重提一次');
assert(/document\.getElementById\('sendBtn'\)/.test(src),'重提要按右上角“提交”');
assert(/try\{send\.click\(\);\}catch\{\}/.test(src),'重提动作是再点一次提交');
assert(/dirtyRetry:retry\.count/.test(src),'要把“已重提”状态回报给后台');

// 3) 成功结果带 resubmitted，历史里能看出来
assert(/resubmitted:!!\(window\.__fhDirtyRetry&&window\.__fhDirtyRetry\.count>0\)/.test(src),'成功结果要标记重新提交过');
assert(/resubmitted:!!\(confirmHit&&confirmHit\.resubmitted\)/.test(worker),'后台要把标记带回前端');
assert(/submitted\.resubmitted/.test(live),'历史记录要写明重新提交过');

// 4) 第二次仍被拦截则明确失败，不无限重试
assert(/已重新提交一次仍被拦截/.test(src),'重提一次后仍失败要明确报错');

// 5) 帮助页有对应说明
assert(/数据不完整/.test(html),'重要提示里要说明这种弹窗');

console.log('通过：数据不完整提示 → 确定 → 重新提交一次 → 继续确认；失败有明确说明，历史可追溯。');
