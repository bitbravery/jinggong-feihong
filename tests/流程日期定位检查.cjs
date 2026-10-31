// v0.9.191：流程日期框必须取「发起日期」右侧的两个可见输入，不能取到左侧的筛选项或隐藏 input。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');

const rect=(left,width=120)=>({height:24,width,left,top:0,right:left+width,bottom:24});
const mkInput=(id,type,left,value='',extra={})=>({
  id,type,value,offsetParent:{},tagName:'INPUT',
  getBoundingClientRect:()=>rect(left),
  dispatchEvent(){},...extra
});

const st={sets:[]};
const leftInput=mkInput('fqr$text','text',-300,'起草人');
const hidden=mkInput('fqrq1','hidden',10,'');           // 隐藏域，不能被选中
const d1=mkInput('fqrq1$text','text',620,'');
const d2=mkInput('fqrq2$text','text',900,'');
const row={querySelectorAll:s=>s==='input'?[leftInput,hidden,d1,d2]:[],outerHTML:'<tr>…</tr>',parentElement:null};
const label={innerText:'发起日期:',getBoundingClientRect:()=>rect(540,80),closest:s=>s==='tr'?row:null,parentElement:row};
const queryBtn={tagName:'A',innerText:'查询',className:'mini-button',getBoundingClientRect:()=>rect(1300),click(){st.clicks=(st.clicks||0)+1;}};
const document={querySelectorAll:s=>{
  if(s==='td,th,label,span,div')return [label];
  if(s.includes('button'))return [queryBtn];
  return [];
}};
const window={frameElement:{getBoundingClientRect:()=>rect(0,1200)},
  mini:{get:id=>({setValue(v){st.sets.push(id+'='+v);const el=[d1,d2].find(x=>x.id===id+'$text');if(el)el.value=v;}})}};
const c={module:{exports:{}},window,document,
  location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/cooperative/haveToDoList.htm',href:'https://ehall.bit.edu.cn/x'},URL,
  Event:class{constructor(t){this.type=t;}},KeyboardEvent:class{constructor(t,o){Object.assign(this,o||{});this.type=t;}},
  HTMLInputElement:class{},getComputedStyle:()=>({visibility:'visible'})};
vm.createContext(c);vm.runInContext(src,c);
const r=c.module.exports.sourceAction({type:'flowDate',from:'2026-10-19',to:'2026-11-01'});
assert(r.queried,JSON.stringify(r));
assert.deepEqual([...st.sets],['fqrq1=2026-10-19','fqrq2=2026-11-01'],'必须写右侧两个日期框，且起始在前');
assert.equal(d1.value,'2026-10-19');assert.equal(d2.value,'2026-11-01');
assert.equal(leftInput.value,'起草人','左侧筛选项不得被改');
assert.equal(st.clicks,1,'应点一次“查询”');
console.log('通过：日期框按“发起日期”右侧定位，隐藏域与左侧输入不参与，起始/截止顺序正确，并点“查询”。');
