// 确认要分次重按：首次按下可能太早（MiniUI 尚未就绪），因此每 ≥1.5 秒重按一次，最多 5 次；
// 弹窗一关立即停，绝不在关闭后继续按。
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

act(cmd);assert.equal(clicks,1,'首次应点一次');
t=1200;act(cmd);assert.equal(clicks,1,'不到 1.5 秒不得重按');
t=2500;act(cmd);assert.equal(clicks,2,'满 1.5 秒应重按');
t=4000;act(cmd);t=5500;act(cmd);t=7000;act(cmd);t=8500;const r=act(cmd);
assert.equal(clicks,6,'最多按 6 次，实际 '+clicks);
assert(/已按 6 次/.test(r.diag||''),'诊断要写明按了几次');
t=11000;act(cmd);assert.equal(clicks,6,'超过 6 次后不得再按');
closed=true;
// v0.9.177 契约变化：弹窗消失本身不算确认，要看到点确定后新出现的“提交成功”
const gone=act(cmd);
assert(gone&&!gone.confirmed&&gone.closedNoToast,'弹窗消失但没有“提交成功”，不得确认');
toastOn=true;
const done=act(cmd);
assert(done&&done.confirmed,'点过确定且出现新的“提交成功”才算确认');toastOn=false;
assert.equal(clicks,6,'关闭后不得再按');
console.log('通过：首次点击 + 之后每 ≥1.5 秒重按、最多 6 次、关闭即停。');
let resources=[];ctx.performance={getEntriesByType:()=>resources};
for(let n=0;n<25;n++){closed=false;t+=2000;resources.push({name:'previous-submit',duration:10});ctx.window.__fhClickBase=0;const before=clicks;act({...cmd,token:'batch-'+n});assert.equal(clicks,before+1,'batch '+n);closed=true;act({...cmd,token:'batch-'+n});}
console.log('通过：25 单确认的请求基线相互隔离。');

let miniClicks=0;ctx.window.mini={get:id=>id==='mini-17'?{fire(type){if(type==='click')miniClicks++;}}:null};
resources=[];closed=false;t+=2000;
const stale={...cmd,token:'stale-miniui'};
act(stale);t+=1500;act(stale);t+=1500;const staleResult=act(stale);
assert.equal(miniClicks,1,'DOM 连续三次无请求时应调用一次 MiniUI 组件 click');
assert(/已调用 MiniUI 按钮事件/.test(staleResult.diag||''),'诊断应记录 MiniUI 兜底');
t+=1500;act(stale);assert.equal(miniClicks,1,'MiniUI 组件事件不得重复调用');
console.log('通过：连续复用页面导致 DOM 点击失效时，第三次改走 MiniUI 组件事件且只调用一次。');
