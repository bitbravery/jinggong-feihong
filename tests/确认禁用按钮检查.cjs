// 禁用态「确定」不点：按钮禁用时点击无效，必须等它可用后再点，且全程只点一次。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
let clicks=0,enabled=false;
const ok={innerText:'确定',className:'mini-button mini-button-disabled',
  getAttribute:()=>null,
  getBoundingClientRect:()=>({height:24,width:60,left:640,top:300}),
  click(){clicks++;},dispatchEvent(ev){if(ev&&ev.type==='click')clicks++;}};
const cancel={innerText:'取消',className:'mini-button',getAttribute:()=>null,getBoundingClientRect:()=>({height:24,width:60,left:560,top:300}),click(){}};
const box={innerText:'提示信息 您确定要提交吗？',getBoundingClientRect:()=>({height:132,width:250,left:554,top:223}),
  querySelectorAll:()=>[ok,cancel],querySelector:()=>null,get outerHTML(){return '<div class="mini-panel mini-window" id="mini-16">…</div>';}};
const ctx={module:{exports:{}},
 location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/cooperative/openCooperative.htm',href:'https://ehall.bit.edu.cn/EIP/cooperative/openCooperative.htm'},
 URL,window:{},sessionStorage:{removeItem(){}},MouseEvent:class{constructor(t,i){this.type=t;Object.assign(this,i||{});}},
 document:{querySelectorAll:()=>[box],elementFromPoint:()=>ok,body:{innerText:'您确定要提交吗？'}},
 getComputedStyle:()=>({zIndex:'1000'})};
vm.createContext(ctx);vm.runInContext(src,ctx);
const act=ctx.module.exports.sourceAction;
const cmd={type:'confirmSubmit',order:{id:'JGKD1'},target:'已送达',token:'D'};

const r1=act(cmd);
assert(r1&&r1.waiting&&r1.off,'禁用态应只等待并说明禁用');
assert.equal(clicks,0,'按钮禁用时不得点击');

const p1=act({type:'confirmProbe'});
assert(p1&&p1.off===true,'探针要回报禁用状态');

ok.className='mini-button';
const r2=act(cmd);
assert(r2&&r2.clickedButOpen,'按钮可用后才点，并如实报告未关闭');
assert.equal(clicks,1,'可用后只点一次');

act(cmd);
assert.equal(clicks,1,'之后不得重复点');
console.log('通过：禁用态不点，可用后只点一次。');
