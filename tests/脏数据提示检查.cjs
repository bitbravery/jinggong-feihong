// v1.0.4 契约：原站提交时弹「控件【…】数据不完整…请检查后重新提交」，
// 扩展先点「确定」、等提示框真正关闭，再点一次「提交」；只有重新提交后再次被拦才算失败。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');

function makeCtx(alertText,{withSend=false}={}){
  let time=100000, alertVisible=!!alertText;
  let okClicked=0,sendClicked=0;
  const okBtn={innerText:'确定',className:'mini-button',getAttribute:()=>null,
    getBoundingClientRect:()=>({height:22,width:60,left:600,top:520}),
    dispatchEvent(ev){if(ev.type==='click')okClicked++;}};
  const toast={innerText:alertText,getBoundingClientRect:()=>({height:0,width:300,left:500,top:480}),querySelectorAll:()=>[]};
  const box={innerText:alertText,className:'mini-messagebox',
    getBoundingClientRect:()=>({height:alertVisible?90:0,width:360,left:480,top:460}),
    querySelectorAll:()=>[okBtn],querySelector:()=>null};
  const sendBtn={id:'sendBtn',innerText:'提交',click(){sendClicked++;}};
  const ctx={module:{exports:{}},URL,Date:{now:()=>time},
    location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/cooperative/openCooperative.htm',href:'https://ehall.bit.edu.cn/EIP/cooperative/openCooperative.htm'},
    window:{},
    document:{querySelectorAll:s=>s.includes('mini-messagebox')?[box]:[toast],
      getElementById:id=>id==='sendBtn'&&withSend?sendBtn:null},
    getComputedStyle:()=>({zIndex:'1000',visibility:'visible'}),
    MouseEvent:class{constructor(t,i){this.type=t;Object.assign(this,i||{});}},
    performance:{getEntriesByType:()=>[]},
    sessionStorage:{removeItem(){}}};
  vm.createContext(ctx);vm.runInContext(src,ctx);
  return {act:ctx.module.exports.sourceAction,get ok(){return okClicked;},get send(){return sendClicked;},
    clear(){alertVisible=false;},show(){alertVisible=true;},advance(ms){time+=ms;}};
}

// 1) 没找到「提交」按钮：等提示框关掉后明确报错，不乱点
{
  const t=makeCtx('数据不完整,值是:研究生教学楼@#@,请检查后重新提交');
  let r=t.act({type:'confirmSubmit',order:{id:'JGKD1'},target:'已签收',token:'t1'});
  assert(r&&r.waiting,'第一次先关提示，不立刻判失败');
  t.clear();t.advance(500);
  r=t.act({type:'confirmSubmit',order:{id:'JGKD1'},target:'已签收',token:'t1'});
  assert(r&&r.error,'关掉提示后找不到提交按钮要报错');
  assert(/没找到右上角“提交”/.test(r.error),'错误要说明找不到提交按钮：'+r.error);
  assert.equal(t.ok,1,'要点一次确定关掉提示');
  assert.equal(t.send,0,'没有提交按钮就不能重提');
}

// 2) 有「提交」按钮：点确定 → 等提示消失 → 重提一次 → 继续等确认框
{
  const t=makeCtx('数据不完整,值是:研究生教学楼@#@,请检查后重新提交',{withSend:true});
  let r=t.act({type:'confirmSubmit',order:{id:'JGKD2'},target:'已签收',token:'t2'});
  assert(r&&r.waiting&&r.seen,'第一次应继续等待：'+JSON.stringify(r));
  assert.equal(t.ok,1,'点一次确定');
  assert.equal(t.send,0,'提示框还没消失，不能立刻点提交');
  t.clear();t.advance(500);
  r=t.act({type:'confirmSubmit',order:{id:'JGKD2'},target:'已签收',token:'t2'});
  assert(r&&r.waiting&&r.seen,'提示消失后重新提交并继续等：'+JSON.stringify(r));
  assert.equal(t.send,1,'提示消失后只重提一次');
}

// 3) 重新提交后又被拦：明确失败，不再无限重提
{
  const t=makeCtx('数据不完整,值是:研究生教学楼@#@,请检查后重新提交',{withSend:true});
  t.act({type:'confirmSubmit',order:{id:'JGKD3'},target:'已签收',token:'t3'});
  t.clear();t.advance(500);
  t.act({type:'confirmSubmit',order:{id:'JGKD3'},target:'已签收',token:'t3'});
  t.show();
  const r2=t.act({type:'confirmSubmit',order:{id:'JGKD3'},target:'已签收',token:'t3'});
  assert(r2&&r2.error,'第二次要报错');
  assert(/已重新提交一次仍被拦截/.test(r2.error),'错误要说明重提后仍被拦：'+r2.error);
  assert.equal(t.send,1,'不得循环重提');
}

// 4) 没有提示：本帧不适用，不乱点
{
  const t=makeCtx('');
  const r=t.act({type:'confirmSubmit',order:{id:'JGKD4'},target:'已签收',token:'t4'});
  assert(r===null,'没有弹窗时返回 null');
  assert.equal(t.ok,0);assert.equal(t.send,0);
}

console.log('通过：数据不完整提示 → 点确定 → 等提示框消失 → 重提一次 → 继续确认；无按钮/二次被拦均有明确错误。');
