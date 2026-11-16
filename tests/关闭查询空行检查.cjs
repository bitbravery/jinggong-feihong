// v1.0.25：原站查询条件区永远至少剩一行，最后一行的红色错号点了也不会消失（用户 11-16 现场截图）。
// 只点还有内容的条件行；所有行都空了就直接点「关闭查询」。执行 source.js 原文。
const assert=require('node:assert/strict'),vm=require('node:vm');
const {sourceAction}=require('../source.js');
const clicks=[];
const el=(o={})=>({className:'',getBoundingClientRect:()=>({height:20,width:o.w||40,left:0,top:0}),querySelector:()=>null,querySelectorAll:()=>[],dispatchEvent(e){if(e.type==='click')clicks.push(o.name);},click(){clicks.push(o.name);},getAttribute:()=>null,...o});
const input=(id,value)=>el({id,type:'text',value,name:'输入框'});
const mkRow=(n,vals)=>{const ins=[input('queryConditionFields_'+n+'$text',vals[0]),input('logicRelation_'+n+'$text',vals[1]),input('paramValue_'+n+'$text',vals[2])];const del=el({name:'错号'+n});
 return el({id:'line_'+n,name:'行'+n,querySelectorAll:s=>s==='input'?ins:[],querySelector:s=>/delete_search/.test(s)?del:null,ins});};
const close=el({innerText:'关闭查询',name:'关闭查询',w:80});
let rows=[mkRow(1,['下单时间','大于等于','2023-10-31']),mkRow(2,['','',''])];
const tab=el({innerText:'快件查询',className:'mini-tab mini-tab-active',classList:{contains:c=>c==='mini-tab-active'}});
const doc={body:el({innerText:'',querySelectorAll:s=>s==='tr[id^="line_"]'?rows:[]}),querySelectorAll:s=>s==='tr[id^="line_"]'?rows:s==='.mini-tab'?[tab]:s==='button,a,span,div'?[close]:/mini-panel/.test(s)?[]:[]};
const win={document:doc};win.top=win;
const ctx={document:doc,window:win,top:win,location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/maindatabase/querymanage/queryResult.htm',href:'x'},URL,getComputedStyle:()=>({}),MouseEvent:function(t){this.type=t;}};
const act=()=>JSON.parse(JSON.stringify(vm.runInNewContext('('+sourceAction+')({type:"closeQuery"})',ctx)));

// 第 1 行有条件：先点它的错号
let r=act();assert.equal(r.cleared,1);assert.deepEqual(clicks.filter(c=>c!=='输入框'),['错号1']);
// 第 1 行被删掉，只剩那个空的第 2 行：直接点「关闭查询」，不再点它的错号
clicks.length=0;rows=[rows[1]];
r=act();assert.equal(r.closed,true,'只剩空行时没有直接关闭查询');
assert(!clicks.includes('错号2'),'对着最后一个空行点了错号');assert(clicks.includes('关闭查询'));
// 最后一行还有内容（原站把它清空而不是删掉）：先点它的错号，清空后下一轮再关
clicks.length=0;rows=[mkRow(3,['单号','等于','JGKD700001'])];
r=act();assert.equal(r.cleared,1);assert(clicks.includes('错号3'));
console.log('通过：只点有内容的条件行错号；条件全空就直接点「关闭查询」，不再对着最后一个空行反复点。');
