const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const inputs={},handlers=new Map();let requests=0;
const conditions=[0,1].map(n=>({id:'line_'+n,getBoundingClientRect:()=>({height:20})}));
for(let n=0;n<2;n++){inputs['queryConditionFields_'+n+'$text']={value:'下单时间'};inputs['logicRelation_'+n+'$text']={value:n?'小于':'大于等于'};inputs['paramValue_'+n+'$text']={value:'',isConnected:true};}
const row={id:'row1',innerText:'JGKD1',isConnected:true,children:[{innerText:'JGKD1'}]};
const grid={on:(event,fn)=>handlers.set(event,fn),un:(event,fn)=>{if(handlers.get(event)===fn)handlers.delete(event);}};
const document={body:{innerText:'每页 100 条, 共 1 条'},getElementById:id=>inputs[id],querySelector:s=>s==='.mini-pager-num'?{value:'1'}:null,querySelectorAll:s=>{
 if(s==='tr[id^="line_"]')return conditions;if(s==='a')return [{innerText:'查询',click(){requests++;}}];if(s==='input[type="radio"]')return [{parentElement:{innerText:'满足以上所有条件'},click(){}}];
 if(s==='.mini-grid')return [{id:'grid'}];if(s.includes('headerCell'))return [{innerText:'单号'}];if(s.startsWith('tr.mini-grid-row'))return [row];return [];
}};
const window={mini:{get:id=>id==='grid'?grid:{setValue:v=>{inputs[id+'$text'].value=v;}}}};
const ctx={module:{exports:{}},document,window,location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/maindatabase/querymanage/queryResult.htm',href:'https://ehall.bit.edu.cn/EIP/maindatabase/querymanage/queryResult.htm?queryCode=8y4xbat8bd5dygdtw7ncbwcayenmnckt'},URL,Date,Math,getComputedStyle:()=>({visibility:'visible'})};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../source.js','utf8'),ctx);const act=ctx.module.exports.sourceAction;
const command={type:'queryRecent',from:'2026-09-20',endExclusive:'2026-10-21'};
const first=act(command);assert(first.queryRequested);assert.equal(act({type:'snapshot',kind:'query'}).probeSettled,false,'结果未变且未返回时不能视为完成');
handlers.get('load')();let result=act({type:'snapshot',kind:'query'});assert.equal(result.probeToken,first.token);assert(result.probeSettled,'相同数据同节点收到load后必须完成');assert.equal(handlers.size,0);
const second=act(command);assert.notEqual(second.token,first.token);assert.equal(act({type:'snapshot',kind:'query'}).probeSettled,false,'新查询不继承旧完成信号');
window.__feihongReadProbe.strictLoad=true;row.isConnected=false;row.innerText='旧列表重绘';
assert.equal(act({type:'snapshot',kind:'query'}).probeSettled,false,'精确查询不能仅凭旧行断开或文本变化判定完成');
handlers.get('loaderror')();assert.match(act({type:'snapshot',kind:'query'}).error,/请求失败/);assert.equal(requests,2);
console.log('通过：相同行节点与相同结果在load后完成；load前不误判；新查询不复用旧完成信号；查询失败明确报错。');
