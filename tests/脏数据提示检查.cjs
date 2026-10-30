// 脏数据提示：原站提交时弹「控件【收件地址宇楼】数据不完整…请检查后重新提交」，
// 必须识别为“原站拒绝”、点掉「确定」关闭提示，并让批量继续下一单。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');

function makeCtx(alertText){
  let clicked=0;
  const okBtn={innerText:'确定',className:'mini-button',
    getAttribute:()=>null,
    getBoundingClientRect:()=>({height:22,width:60,left:600,top:520}),
    dispatchEvent(ev){if(ev.type==='click')clicked++;}};
  const toast={innerText:alertText,getBoundingClientRect:()=>({height:alertText?60:0,width:300,left:500,top:480}),querySelectorAll:()=>[]};
  const box={innerText:alertText,className:'mini-messagebox',
    getBoundingClientRect:()=>({height:alertText?90:0,width:360,left:480,top:460}),
    querySelectorAll:()=>[okBtn],querySelector:()=>null};
  const ctx={module:{exports:{}},URL,
    location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/cooperative/openCooperative.htm',href:'https://ehall.bit.edu.cn/EIP/cooperative/openCooperative.htm'},
    window:{},document:{querySelectorAll:s=>s.includes('mini-messagebox')?[box]:[toast]},
    getComputedStyle:()=>({zIndex:'1000',visibility:'visible'}),
    MouseEvent:class{constructor(t,i){this.type=t;Object.assign(this,i||{});}}};
  vm.createContext(ctx);vm.runInContext(src,ctx);
  return {act:ctx.module.exports.sourceAction,get clicked(){return clicked;}};
}

// 1) 有脏数据提示：报“原站拒绝提交”，并点掉确定
{
  const text='数据不完整,值是:研究生教学楼@#@,请检查后重新提交';
  const t=makeCtx(text);
  const r=t.act({type:'confirmSubmit',order:{id:'JGKD1'},target:'已签收',token:'t'});
  assert(r&&r.error,'必须报错');
  assert(/原站拒绝提交/.test(r.error),'错误里要说明是原站拒绝：'+r.error);
  assert.equal(t.clicked,1,'必须点一次确定把提示关掉');
}

// 2) 没有提示：不得误判、不得乱点
{
  const t=makeCtx('');
  const r=t.act({type:'confirmSubmit',order:{id:'JGKD1'},target:'已签收',token:'t'});
  assert(r===null,'没有弹窗时本帧不适用');
  assert.equal(t.clicked,0,'不得乱点确定');
}

console.log('通过：脏数据提示被识别为原站拒绝，点确定关闭后由批量继续下一单。');
