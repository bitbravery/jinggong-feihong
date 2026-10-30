// 确认点击只发一次：弹窗不关时不重复点（避免重复提交），并如实上报“已点但未关”。
// 另：只有同一次提交（token 相同）见过弹窗，弹窗消失才算确认；上一次遗留的状态不得让新一次提交误判成功。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
let clicks=0,cancelClicks=0,closed=false,toastOn=false;
const tip={innerText:'提交成功',getBoundingClientRect:()=>({height:toastOn?40:0,width:toastOn?120:0})};
const ok={innerText:'确定',getBoundingClientRect:()=>({height:24,width:60,left:640,top:300}),click(){clicks++;},dispatchEvent(ev){if(ev&&ev.type==='click')clicks++;}};
const cancel={innerText:'取消',getBoundingClientRect:()=>({height:24,width:60,left:560,top:300}),click(){cancelClicks++;}};
const box={
 innerText:'提示信息 您确定要提交吗？',
 getBoundingClientRect:()=>({height:closed?0:132,width:250,left:554,top:223}),
 querySelectorAll:()=>[ok,cancel],
 querySelector:()=>null,
 get outerHTML(){return '<div class="mini-panel mini-window" id="mini-16">…</div>';}
};
const ctx={module:{exports:{}},
 location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/cooperative/openCooperative.htm',href:'https://ehall.bit.edu.cn/EIP/cooperative/openCooperative.htm'},
 URL,window:{},sessionStorage:{removeItem(){}},
 MouseEvent:class{constructor(type,init){this.type=type;Object.assign(this,init||{});}},
 document:{querySelectorAll:s=>s==='div,span,p,td'?[tip]:[box],elementFromPoint:()=>ok,body:{innerText:'您确定要提交吗？'}},
 getComputedStyle:()=>({zIndex:'1000'})};
vm.createContext(ctx);vm.runInContext(src,ctx);
const act=ctx.module.exports.sourceAction;
const cmd=token=>({type:'confirmSubmit',order:{id:'JGKD1'},target:'已送达',token});

const r1=act(cmd('A'));
assert(r1&&r1.waiting&&r1.clickedButOpen,'第一次应报告“已点但弹窗未关”');
assert.equal(clicks,1,'第一次应点一次确定');
assert.equal(cancelClicks,0,'不得点取消');
assert(/已按下/.test(r1.diag||''),'诊断里应写明已按下');
assert(r1.diag.length<400,'诊断不宜过长');

const r2=act(cmd('A'));
assert(r2&&r2.clickedButOpen,'弹窗未关时继续等待，不得报成功');
assert.equal(clicks,1,'同页第二次提交不得重复点击确定');
assert(/已按下/.test(r2.diag||''),'第二次应报告已按下');

const probe=act({type:'confirmProbe'});
assert(probe&&probe.dialog===1&&probe.clicked,'探针要如实回报弹窗与已点击状态');
assert(/中心点/.test(probe.diag||'')&&/onclick/.test(probe.diag||''),'探针诊断要带遮挡判定与事件绑定情况：'+probe.diag);

const seq=[];
ok.dispatchEvent=ev=>{seq.push(ev.type);};
const press=act({type:'confirmPress',token:'A'});
assert(press&&press.pressed,'补点应执行一次完整按下序列');
assert.deepEqual(seq,['mousedown','mouseup','click'],'按下序列应为 mousedown→mouseup→click');
const pressAgain=act({type:'confirmPress',token:'A'});
assert(pressAgain&&pressAgain.pressed===false&&pressAgain.again,'同一令牌只补点一次');

closed=true;
assert.equal(act(cmd('B')),null,'新一次提交不得靠上一次遗留的“见过弹窗”被判成功');

// v0.9.177 契约变化：弹窗消失本身不算确认；要等点确定后新出现的“提交成功”
const r3=act(cmd('A'));
assert(r3&&!r3.confirmed&&r3.closedNoToast,'弹窗消失但没看到“提交成功”，不得报确认');
toastOn=true;
const r4=act(cmd('A'));
assert(r4&&r4.confirmed&&r4.via==='toast','同一次提交里点过确定、且出现新的“提交成功”才算确认');
assert.equal(clicks,1,'确认过程只点一次');
assert.equal(cancelClicks,0,'全程不得点取消');
assert.equal(act(cmd('A')),null,'确认后令牌作废，不得反复确认');
console.log('通过：确定按钮只点一次；弹窗未关如实上报；仅同一次提交点过确定且出现新的“提交成功”才算确认。');
