// 提交确认：点一次「确定」；点确定后新出现“提交成功”才算确认成功（不会谎报）。
// v0.9.177 契约变化：弹窗关闭本身不再算成功，需看到新的“提交成功”（或由编排层看到调整单标签自动关闭）。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
function ctxFor({withDialog=true,withOk=true,toastAfterOk=true}={}){
 let clicks=0,cancelClicks=0,closed=false,toast=false;
 const hit=()=>{clicks++;closed=true;toast=toastAfterOk;};
 const ok={innerText:'确定',getBoundingClientRect:()=>({height:10,width:60,left:600,top:300}),click:hit,dispatchEvent(ev){if(ev&&ev.type==='click')hit();}};
 const cancel={innerText:'取消',getBoundingClientRect:()=>({height:10}),click(){cancelClicks++;}};
 const box={innerText:'提示信息 您确定要提交吗？',getBoundingClientRect:()=>({height:closed?0:120}),querySelectorAll:()=>(withOk?[ok,cancel]:[cancel]),get outerHTML(){return '<div class="mini-messagebox">…</div>';}};
 const tip={innerText:'提交成功',getBoundingClientRect:()=>({height:toast?40:0,width:toast?120:0})};
 const win={};
 const ctx={module:{exports:{}},location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/cooperative/openCooperative.htm',href:'https://ehall.bit.edu.cn/EIP/cooperative/openCooperative.htm'},URL,window:win,MouseEvent:class{constructor(t,i){this.type=t;Object.assign(this,i||{});}},
  document:{querySelectorAll:s=>/mini-window/.test(s)?(withDialog?[box]:[]):s==='div,span,p,td'?[tip]:[]}};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 return {act:ctx.module.exports.sourceAction,get clicks(){return clicks;},get cancelClicks(){return cancelClicks;}};
}
const cmd={type:'confirmSubmit',order:{id:'JGKD1'},target:'已揽件',token:'X'};
let c=ctxFor();
let r=c.act(cmd);
assert(r&&r.confirmed,'点确定后出现“提交成功”才确认');assert.equal(c.clicks,1);assert.equal(c.cancelClicks,0);
c=ctxFor({toastAfterOk:false});
r=c.act(cmd);
assert(r&&!r.confirmed&&r.closedNoToast,'弹窗关了但没有“提交成功”，不得确认');
c=ctxFor({withDialog:false});
assert.equal(c.act(cmd),null,'无弹窗返回 null');
c=ctxFor({withOk:false});
r=c.act(cmd);
assert(!r.confirmed&&r.waiting);assert.equal(c.clicks,0);
console.log('通过：确认点击一次，且以点确定后新出现的“提交成功”为准。');
