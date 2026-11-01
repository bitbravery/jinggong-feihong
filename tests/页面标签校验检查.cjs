// v0.9.219：每个操作前先确认门户上方标签；不在正确页 → 等 0.1 秒 → 关掉残留调整单 → 点回正确标签 → 再继续。
// 注入层只报告“自己是不是前台”，绝不自己点标签（0.9.218 就是注入层抢标签把门户卡在调整单页）。
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=f=>fs.readFileSync(__dirname+'/../'+f,'utf8');
const src=read('source.js'),worker=read('worker.js'),live=read('live.js');

// 1) 注入层只报告，不自己点标签
assert(/const fhTabHere=want=>/.test(src),'要有“本帧标签是否前台”的判断');
assert(!src.includes('fhSelfTab'),'注入层不再自己点标签');
assert(!/fhTabHere=[^;]*\.click\(/.test(src),'fhTabHere 里不能点标签');
for(const re of ['物流状态调整单','京工飞鸿两校(?:区)?快件系统','快件查询'])
  assert(src.includes('if(!fhTabHere(/'+re+'/))return {wrongTab:true};'),'动作前报告 wrongTab：'+re);
assert(src.includes("active:act?text(act):''"),'portalState 返回当前前台标签名');

// 2) 后台按用户顺序切页：先等 0.1 秒 → 关残留调整单 → 点正确标签
assert(worker.includes('const PAGE_KINDS='),'页面定义');
assert(worker.includes('async function closeResidualForm'),'关残留调整单');
assert(/async function closeResidualForm[\s\S]{0,300}portalSaving\(\)[\s\S]{0,120}waitSaved/.test(worker),'残留调整单保存中绝不关，先等保存完');
assert(worker.includes('async function ensurePortalPage'),'每个操作前的页面校验');
assert(/async function ensurePortalPage[\s\S]{0,800}await pause\(100\);[\s\S]{0,200}closeResidualForm[\s\S]{0,200}await run\(\{type:'navigate',kind\}\)/.test(worker),'顺序：等0.1秒→关残留→点回正确标签');
assert(worker.includes('if(!active)return true;'),'门户不报激活标签时不硬拦');
assert(worker.includes("if(onWrongTab&&out.some(r=>r&&r.wrongTab)){await onWrongTab();continue;}"),'等待中页面被切走也能切回');
assert(worker.includes("ensurePortalPage('form',stage,generation)"),'填单/提交前校验调整单页');
assert(worker.includes("ensurePortalPage('service',stage,generation)"),'打开办理入口前校验系统页');
assert(worker.includes("ensurePortalPage('query')"),'按单号查询前校验快件查询页');
assert(worker.includes("ensurePortalPage('form')"),'查看原站状态读表单前校验调整单页');

// 3) 取消（回退后按需求重新加回）：准备/提交/等待都能停
assert(live.includes('let changeCancelled=false'),'取消标记');
assert(/async function cancelChange\(\)\{[\s\S]{0,600}writePhase==='submitted'/.test(live),'提交阶段也能取消');
assert(live.includes("if(changeCancelled){setStage('已取消，剩余单未执行');break;}"),'每单开始前检查取消');
assert(worker.includes("if(msg.type==='cancelWrite'){preparedWrite=null;writeGeneration++;return {cancelled:true};}"),'取消作废准备令牌');
assert(/async function confirmPatiently\(command,label,onTick,alt,stage,generation\)/.test(worker),'等待确认可被取消打断');
console.log('通过：每个操作前校验门户标签（等0.1秒→关残留调整单→切回正确页）；批量改状态可随时取消。');
