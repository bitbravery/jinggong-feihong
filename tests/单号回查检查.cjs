// 精确回查：条件组合兼容“值=$and”与“文字=满足以上所有条件”，控件不可用就直接点，
// 最终只认“已选中”这一事实；点不中就继续等，绝不带着“或”的条件去回查。
const assert=require('node:assert/strict'),vm=require('node:vm'),{sourceAction}=require('../source.js');
const id='JGKD2026092036825';
const state={landOnChecked:false,swallowGroup:true,field:'单号',requests:0,relation:'小于',groupValue:''};
const input={value:'',isConnected:true};
const radio={id:'mini-17$ck$0',value:'$and',checked:false,click(){this.checked=state.landOnChecked;}};
const option={innerText:'等于',getBoundingClientRect:()=>({height:10}),dispatchEvent(){},click(){state.relation='等于';input.isConnected=false;}};
const group={setValue(v){if(!state.swallowGroup){state.groupValue=v;radio.checked=true;}},getValue:()=>state.groupValue};
const grid={on(){},un(){}};
const window={mini:{get:n=>n==='mini-17'?group:n==='grid'?grid:n==='paramValue_0'?{setValue(v){input.value=v;}}:{showPopup(){}}}};
const document={getElementById:n=>n==='paramValue_0$text'?input:n==='queryConditionFields_0$text'?{value:state.field}:n==='logicRelation_0$text'?{value:state.relation}:null,
 querySelectorAll:s=>s==='tr[id^="line_"]'?[{id:'line_0',getBoundingClientRect:()=>({height:10})}]:s==='.mini-listbox-item'?[option]:s==='input[type="radio"]'?[radio]:s==='.mini-grid'?[{id:'grid'}]:s==='a'?[{innerText:'查询',click(){state.requests++;}}]:[]};
const ctx={window,document,URL,Date,Math,location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/maindatabase/querymanage/queryResult.htm',href:'https://ehall.bit.edu.cn/EIP/maindatabase/querymanage/queryResult.htm?queryCode=8y4xbat8bd5dygdtw7ncbwcayenmnckt'},getComputedStyle:()=>({visibility:'visible'}),MouseEvent:class{}};
const run=()=>vm.runInNewContext('('+sourceAction+')({type:"queryOrder",id:"'+id+'"})',ctx);

assert(run().waiting);assert.equal(state.requests,0,'切换比较符后等待控件重建');
assert(run().waiting);assert.equal(state.requests,0,'输入框断开时不查询');
input.isConnected=true;
assert(run().waiting,'控件设不上、点击也没选中时必须继续等');
assert.equal(state.requests,0,'条件没真正选中就不能发起查询');
state.landOnChecked=true;
const ok=run();
assert(ok.queryRequested);assert.equal(state.requests,1);assert.equal(input.value,id);assert(ctx.window.__feihongReadProbe.strictLoad);
state.field='下单时间';
assert(run().error);assert.equal(state.requests,1);
console.log('通过：条件组合兼容两种结构，控件不可用时改为点击，未选中则等待不查询；字段不符即报错，单次查询且必须等待 load。');
