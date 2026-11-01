// v0.9.204：看到「提示信息」弹窗立即点确定；没反应就每 ≥0.1 秒再点，最多 3 次；
// 3 次仍未关 → 报「提示框连续点 3 次」让后台关标签跳过本单。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
let t=1000,clicks=0,closed=false,toastOn=false;
const tip={innerText:'提交成功',getBoundingClientRect:()=>({height:toastOn?40:0,width:toastOn?120:0})};
const ok={id:'mini-17',innerText:'确定',className:'mini-button',getAttribute:()=>null,
  getBoundingClientRect:()=>({height:24,width:60,left:640,top:300}),
  dispatchEvent(ev){if(ev&&ev.type==='click')clicks++;},click(){clicks++;}};
const cancel={innerText:'取消',className:'mini-button',getAttribute:()=>null,getBoundingClientRect:()=>({height:24,width:60,left:560,top:300}),dispatchEvent(){}};
const box={innerText:'提示信息 您确定要提交吗？',getBoundingClientRect:()=>({height:closed?0:132,width:250,left:554,top:223}),
  querySelectorAll:()=>[ok,cancel],querySelector:()=>null,get outerHTML(){return '<div class="mini-panel mini-window" id="mini-16">…</div>';}};
const ctx={module:{exports:{}},Date:{now:()=>t},
 location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/cooperative/openCooperative.htm',href:'https://ehall.bit.edu.cn/EIP/cooperative/openCooperative.htm'},
 URL,window:{},sessionStorage:{removeItem(){}},
 MouseEvent:class{constructor(type,init){this.type=type;Object.assign(this,init||{});}},
 document:{querySelectorAll:s=>s==='div,span,p,td'?[tip]:[box],elementFromPoint:()=>ok,body:{innerText:'您确定要提交吗？'}},
 getComputedStyle:()=>({zIndex:'1000'})};
vm.createContext(ctx);vm.runInContext(src,ctx);
const act=ctx.module.exports.sourceAction;
const cmd={type:'confirmSubmit',order:{id:'JGKD1'},target:'已送达',token:'R'};

// 1) 看到弹窗立刻点一次（不等网络静默）
act(cmd);assert.equal(clicks,1,'看到弹窗应立即点一次');
// 2) 0.1 秒内不重复
t=1050;act(cmd);assert.equal(clicks,1,'不到 0.1 秒不得重按');
t=1150;act(cmd);assert.equal(clicks,2,'满 0.1 秒应重按第 2 次');
t=1260;act(cmd);assert.equal(clicks,3,'第 3 次点击');
// 3) 3 次后仍在：600ms 内不放弃，之后明确报错
t=1500;const waiting=act(cmd);assert.equal(clicks,3,'最多点 3 次');assert(waiting&&waiting.waiting,'3 次后先等它关闭');
t=2200;const gave=act(cmd);
assert(gave&&gave.error,'3 次仍未关应报错');assert(/提示框连续点 3 次/.test(gave.error),'错误要写明点了 3 次');
assert.equal(clicks,3,'报错后不得再点');

// 4) 弹窗关闭：没“提交成功”不算成功；有才算
const tok='R';closed=true;t=5000;
const gone=act({...cmd,token:tok});
assert(gone&&!gone.confirmed&&gone.closedNoToast,'关掉但没提示不得确认');
toastOn=true;const done=act({...cmd,token:tok});
assert(done&&done.confirmed,'出现新的“提交成功”才确认');

// 5) MiniUI 兜底：第 3 次点击时调一次组件事件
let miniClicks=0;ctx.window.mini={get:id=>id==='mini-17'?{fire(type){if(type==='click')miniClicks++;}}:null};
closed=false;toastOn=false;t=9000;
const tok3='R3';
act({...cmd,token:tok3});t=9150;act({...cmd,token:tok3});t=9300;const third=act({...cmd,token:tok3});
assert.equal(miniClicks,1,'第 3 次应调用一次 MiniUI 组件事件');
assert(/已调用 MiniUI 按钮事件/.test(third.diag||''),'诊断要记录 MiniUI 兜底');

console.log('通过：弹窗出现立即点确定，0.1 秒一次最多 3 次，仍不开则报错交后台关标签。');
