// 提交弹窗：阶段提示统一带“已用时 N 秒”，且只有一处渲染入口（避免有的阶段漏掉计时）。
const assert=require('node:assert/strict'),fs=require('node:fs');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');
assert(/function renderStage\(\)\{/.test(live),'缺少 renderStage');
assert(/performance\.now\(\)-writeStarted/.test(live),'阶段渲染必须计算已用时');
assert(/function setStage\(t\)\{stageText=t;renderStage\(\);\}/.test(live),'阶段文字必须统一走 setStage');
assert(/setInterval\(renderStage,500\)/.test(live),'计时需要定时刷新');
assert(!/\$\('changeStage'\)\.textContent=/.test(live),'不得绕过 setStage 直接写 changeStage');
assert(/writeStarted=performance\.now\(\)/.test(live),'弹窗打开时必须开始计时');
assert(/for\(let orderIndex=0[\s\S]{0,400}writeStarted=performance\.now\(\);/.test(live),'批量时每单重置计时');
assert(/if\(stageTimer\)\{clearInterval\(stageTimer\);stageTimer=null;\}/.test(live),'收尾要停掉计时器');
console.log('通过：提交阶段提示统一带“已用时 N 秒”，且只有一处渲染入口。');
