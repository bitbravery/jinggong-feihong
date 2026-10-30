// v0.9.183：上次翻页没加载完、下方列表一直显示“加载中”时，第二次读取不再无限等待——
// 列表遮罩连续超过 8 秒就继续填日期条件并点“查询”（人工也是这样重新查询）；盖住整页的遮罩仍然照旧等待。
const assert=require('node:assert/strict'),vm=require('node:vm');
const {sourceAction}=require('../source.js');
let now=100000,submitted=0,popups=0,open=false;
const inputs={};
const rows=[0,1].map(n=>({id:'line_'+n,getBoundingClientRect:()=>({height:20})}));
for(let n=0;n<2;n++){inputs['queryConditionFields_'+n+'$text']={value:'下单时间'};inputs['logicRelation_'+n+'$text']={value:n?'小于':'大于等于'};inputs['paramValue_'+n+'$text']={value:'',isConnected:true};}
const grid={};
const gridMask={getBoundingClientRect:()=>({height:40}),closest:s=>s==='.mini-grid'?grid:null,classList:{contains:()=>false}};
const pageMask={getBoundingClientRect:()=>({height:40}),closest:()=>null,classList:{contains:()=>false}};
let masks=[gridMask];
const document={getElementById:id=>inputs[id],querySelectorAll:s=>s==='.mini-mask-loading,.mini-grid-loading'?masks:s==='tr[id^="line_"]'?rows:s==='a'?[{innerText:'查询',click:()=>submitted++}]:s==='input[type="radio"]'?[{parentElement:{innerText:'满足以上所有条件'},checked:true,click(){}}]:s==='.mini-grid'?[]:[]};
const window={mini:{get:id=>({setValue:v=>{inputs[id+'$text'].value=v;}})}};
const context={document,window,location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/maindatabase/querymanage/queryResult.htm',href:'https://ehall.bit.edu.cn/EIP/maindatabase/querymanage/queryResult.htm?queryCode=8y4xbat8bd5dygdtw7ncbwcayenmnckt'},URL,Math,Date:{now:()=>now},getComputedStyle:()=>({visibility:'visible'})};
const run=(type='queryRecent')=>vm.runInNewContext('('+sourceAction+')({type:"'+type+'",from:"2022-10-16",endExclusive:"2022-11-30"})',context);

// 列表遮罩刚出现：照旧等，并说明在等什么
let r=run();assert.equal(r.waiting,true);assert.match(r.step,/原站列表加载中/);assert.equal(submitted,0);
now+=5000;r=run();assert.equal(r.waiting,true);assert.equal(submitted,0,'8 秒内不抢在原站前面查询');
// 超过 8 秒仍在：当作卡住，继续填条件并点“查询”
now+=4000;r=run();assert.equal(r.queryRequested,true,'列表遮罩卡住超过 8 秒后应重新查询');assert.equal(submitted,1);
assert.equal(inputs['paramValue_0$text'].value,'2022-10-16');assert.equal(inputs['paramValue_1$text'].value,'2022-11-30');
// 遮罩消失后计时清零；再出现要重新等满 8 秒
masks=[];run();submitted=0;masks=[gridMask];r=run();assert.equal(r.waiting,true);assert.equal(submitted,0);
// 盖住整页的遮罩：无论多久都等
masks=[pageMask];now+=60000;r=run();assert.equal(r.waiting,true);assert.equal(r.step,'原站页面加载中');now+=60000;assert.equal(run().waiting,true);assert.equal(submitted,0);
console.log('通过：列表“加载中”卡住超过 8 秒会重新填条件并查询；8 秒内与整页加载时照旧等待。');

// 下拉已展开时不重复展开（每 150 毫秒反复展开会让选项一直重建）
masks=[];inputs['queryConditionFields_1$text'].value='';
context.MouseEvent=function(t){this.type=t;};
const item={innerText:'下单时间',getBoundingClientRect:()=>({height:20}),dispatchEvent(){},click(){}};
const baseQuery=document.querySelectorAll;document.querySelectorAll=s=>s==='.mini-listbox-item'?(open?[item]:[]):baseQuery(s);
window.mini.get=id=>({setValue:v=>{inputs[id+'$text'].value=v;},showPopup(){popups++;open=true;},isShowPopup:()=>open});
run();run();run();
assert.equal(popups,1,'下拉只展开一次，之后等选项生效');
console.log('通过：条件下拉已展开时不再重复展开。');
