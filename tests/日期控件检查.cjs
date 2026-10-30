const assert=require('node:assert/strict'),vm=require('node:vm');
const {sourceAction}=require('../source.js');
let submitted=0,changed=0;
const inputs={};
const rows=[0,1].map(n=>({id:'line_'+n,getBoundingClientRect:()=>({height:20})}));
for(let n=0;n<2;n++){
 inputs['queryConditionFields_'+n+'$text']={value:'下单时间'};
 inputs['logicRelation_'+n+'$text']={value:n?'小于':'大于等于'};
}
const document={getElementById:id=>inputs[id],querySelectorAll:s=>s==='tr[id^="line_"]'?rows:s==='a'?[{innerText:'查询',click:()=>submitted++}]:s==='input[type="radio"]'?[{parentElement:{innerText:'满足以上所有条件'},click(){}}]:[]};
const window={mini:{get:id=>({getData:()=>[{id:'gte',text:'大于等于'},{id:'lt',text:'小于'}],setText:t=>{inputs[id+'$text'].value=t;},setValue:()=>{},fire:()=>changed++})}};
const context={document,window,location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/maindatabase/querymanage/queryResult.htm',href:'https://ehall.bit.edu.cn/EIP/maindatabase/querymanage/queryResult.htm?queryCode=8y4xbat8bd5dygdtw7ncbwcayenmnckt'},URL,Date,Math,getComputedStyle:()=>({visibility:'visible'})};
const run=()=>vm.runInNewContext('('+sourceAction+')({type:"queryRecent",from:"2026-08-19",endExclusive:"2026-10-20"})',context);
assert.match(run().error,/重建/);assert.equal(submitted,0); // Detached controls must never submit.
for(let n=0;n<2;n++)inputs['paramValue_'+n+'$text']={value:'',isConnected:true};
assert.match(run().error,/未生效/);assert.equal(submitted,0); // A stale widget cannot silently swallow dates.
window.mini.get=id=>({setValue:v=>{inputs[id+'$text'].value=v;}});
assert.equal(run().queryRequested,true);assert.equal(submitted,1);assert.equal(changed,0);
console.log('通过：日期控件缺失或未生效时禁止查询；已选条件不重复重建；日期生效后才查询。');

const events=[];context.MouseEvent=function(type){this.type=type;};
const originalQuery=document.querySelectorAll;
const option={innerText:'小于',getBoundingClientRect:()=>({height:20}),dispatchEvent:e=>events.push(e.type),click:()=>{events.push('click');inputs['logicRelation_1$text'].value='小于';}};
document.querySelectorAll=s=>s==='.mini-listbox-item'?[option]:originalQuery(s);
inputs['logicRelation_1$text'].value='等于';
window.mini.get=id=>({getData:()=>[{id:'lt',text:'小于'}],setValue:v=>{inputs[id+'$text'].value=v;},fire(){},showPopup(){}});
assert(run().waiting);assert.deepEqual(events,['mousedown','mouseup','click']);assert.equal(inputs['logicRelation_1$text'].value,'小于');assert.equal(submitted,1);
console.log('通过：使用原站下拉菜单鼠标事件设置条件，等待控件重建后再查询。');

inputs['logicRelation_1$text'].value='等于';events.length=0;
window.mini.get=id=>({getData:()=>{throw Error('未打开前不应读取数据');},setValue:v=>{inputs[id+'$text'].value=v;},showPopup(){}});
assert(run().waiting);assert.equal(inputs['logicRelation_1$text'].value,'小于');assert.equal(submitted,1);
console.log('通过：首次打开时惰性初始化的比较菜单不依赖提前读取 getData。');
