// 提交确认：只点「确定」不点「取消」；点「确定」后新出现“提交成功”才返回 confirmed。
// v0.9.177 契约变化：确认框关闭本身不再算成功（现场：没点确定、或点了但没提交成功的单被记成“已改好”）。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
function run({toastAfterOk}){
 let clicks=0,cancelClicks=0,closed=false,toast=false;
 const ok={innerText:'确定',getBoundingClientRect:()=>({height:10,width:60,left:600,top:300}),click(){clicks++;closed=true;toast=toastAfterOk;},dispatchEvent(ev){if(ev&&ev.type==='click'){clicks++;closed=true;toast=toastAfterOk;}}};
 const cancel={innerText:'取消',getBoundingClientRect:()=>({height:10}),click(){cancelClicks++;}};
 const box={innerText:'您确定要提交吗？',getBoundingClientRect:()=>({height:closed?0:100}),querySelectorAll:()=>[cancel,ok],get outerHTML(){return '<div class="mini-messagebox">…</div>';}};
 const tip={innerText:'提交成功',getBoundingClientRect:()=>({height:toast?40:0,width:toast?120:0})};
 const ctx={module:{exports:{}},location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/cooperative/openCooperative.htm',href:'https://ehall.bit.edu.cn/EIP/cooperative/openCooperative.htm'},URL,window:{},
  MouseEvent:class{constructor(t,i){this.type=t;Object.assign(this,i||{});}},
  document:{querySelectorAll:s=>/mini-window/.test(s)?[box]:s==='div,span,p,td'?[tip]:[]}};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 return {r:ctx.module.exports.sourceAction({type:'confirmSubmit',order:{id:'JGKD1'},target:'已送达',token:'T'}),clicks,cancelClicks};
}
let x=run({toastAfterOk:true});
assert(x.r&&x.r.confirmed&&x.r.via==='toast','点确定后出现“提交成功”才算确认');assert.equal(x.clicks,1);assert.equal(x.cancelClicks,0);
x=run({toastAfterOk:false});
assert(x.r&&!x.r.confirmed&&x.r.closedNoToast,'确认框关了但没看到“提交成功”，不得报确认');assert.equal(x.clicks,1);assert.equal(x.cancelClicks,0);
console.log('通过：提交确认仅点确定；以点确定后新出现的“提交成功”为准，确认框关闭本身不算。');
