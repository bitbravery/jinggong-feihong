// v0.9.198：门户必须真的切到「物流状态调整单」再操作（填单号/提交/点确定），
// 否则会停在京工飞鸿两校快件系统页面上操作；另外看到确认框立即点确定，不再等网络静默。
const assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
const worker=fs.readFileSync(__dirname+'/../worker.js','utf8');

// 1) 标签匹配：去空白后比较/包含，不再要求完全相等
assert(src.includes('const norm=s=>String(s||\'\').replace('),'标签文字要先去空白再比');
assert(src.includes('v===norm(label)'),'导航要按去空白后的文字匹配');

// 2) 新增 formActive：顶层读当前激活标签
assert(src.includes("command.type==='formActive'"),'source 要能报告表单标签是否激活');
assert(src.includes("actText.includes('物流状态调整单')"),'判断依据是激活标签文字');

// 3) worker：ensureFormActive 必须真的切过去并校验（v0.9.218：带取消令牌，先确认再点）
assert(worker.includes('async function ensureFormActive(stage,generation)'),'要有表单页激活保障');
assert(worker.includes('if(await formActive())return true;'),'切完要校验是否真的激活');
assert(worker.includes('门户没有切到「物流状态调整单」'),'切不过去要明确报错跳过');

// 4) 关键操作前都要先激活
const count=(worker.match(/await ensureFormActive\(/g)||[]).length;
assert(count>=4,'准备(开新/复用)、提交、改回都要先激活表单页，当前 '+count+' 处');
const prepIdx=worker.indexOf("waitSource({type:'prepare',order:msg.order}");
assert(worker.lastIndexOf('await ensureFormActive(',prepIdx)>0,'填单号前要激活');
const armIdx=worker.indexOf("waitSource({type:'armSubmission'");
assert(worker.lastIndexOf('await ensureFormActive(',armIdx)>0,'点提交前要激活');

// 5) 看到确认框立即点确定（首按不等网络静默），后续仍防连点
assert(src.includes('const canPress=ps.tries<3&&(ps.tries===0||Date.now()-ps.last>=100)'),'确认框最多点 3 次、间隔 0.1 秒');
assert(src.includes('if(canPress){'),'看到弹窗立即点，不再等网络静默');
assert(src.includes('提示框连续点 3 次'),'3 次仍未关要明确报错');

console.log('通过：表单页激活校验接入准备/提交/改回；确认框首按立即点击。');
