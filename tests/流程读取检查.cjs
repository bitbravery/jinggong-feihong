// 流程读取：流程网格的行结构不含 $row2$ 时，必须按表头列数回退选行，不能再把 3 条读成 0 条。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
const headers=['序号','流程事项名称','单号','物流信息','寄件人工号','寄件人姓名','寄件人电话','寄件校区地址','寄件地址楼宇','寄件房间号地址','寄件物品信息','收件人姓名','收件人电话','收件校区地址','收件地址楼宇','收件地址房间号'];
const cell=t=>({innerText:t});
const mkRow=(id,n)=>({id,children:headers.map((h,i)=>cell(i===2?'JGKD2026000000'+n:i===3?'订单申请':i===0?String(n):'x'))});
function makeCtx({path,href,wrapped,lined}){
 const document={
  body:{innerText:'每页 20 条，共 3 条'},
  querySelector:s=>s==='.mini-pager-num'?{value:'1'}:null,
  querySelectorAll:s=>{
   if(s==='td[id*="$headerCell"]')return headers.map(cell);
   if(s==='tr.mini-grid-row[id*="$row2$"]')return wrapped;
   if(s==='tr[id^="line_"]')return lined;
   if(s==='tr.mini-grid-row')return [];
   if(s==='.mini-mask-loading,.mini-grid-loading')return [];
   if(s==='#quick-tag-box .active,#quick-tag-box [class*="selected"],.query-tag-box')return [];
   if(s==='.mini-pager')return [{innerText:'每页 20 条，共 3 条'}];
   return [];
  }
 };
 const ctx={module:{exports:{}},window:{},top:{},document,location:{origin:'https://ehall.bit.edu.cn',pathname:path,href},URL,getComputedStyle:()=>({visibility:'visible'})};
 vm.createContext(ctx);vm.runInContext(src,ctx);return ctx;
}
// A. 流程页：$row2$ 一条都没有，line_ 有三条
let ctx=makeCtx({path:'/EIP/flow/flowList/toDoList.htm',href:'https://ehall.bit.edu.cn/EIP/flow/flowList/toDoList.htm?flowId=8a8082dc7fdeefce017ffdbfb7ec4c15',wrapped:[],lined:[mkRow('line_1',1),mkRow('line_2',2),mkRow('line_3',3)]});
let s=ctx.module.exports.sourceAction({type:'snapshot',kind:'flow'});
assert(s&&s.rows,'流程页必须返回快照');
assert.equal(s.rows.length,3,'流程页 3 条记录不能读成 0 条');
assert.equal(s.total,3);assert.equal(s.pageSize,20);assert.equal(s.kind,'flow');assert.equal(s.flowTab,'待办');

// B. 快件页：两套行都在时仍以 $row2$ 为准，避免重复计数
ctx=makeCtx({path:'/EIP/maindatabase/querymanage/queryResult.htm',href:'https://ehall.bit.edu.cn/EIP/maindatabase/querymanage/queryResult.htm?queryCode=8y4xbat8bd5dygdtw7ncbwcayenmnckt',wrapped:[mkRow('g$row2$1',1),mkRow('g$row2$2',2)],lined:[mkRow('line_1',1),mkRow('line_2',2),mkRow('line_3',3)]});
s=ctx.module.exports.sourceAction({type:'snapshot',kind:'query'});
assert.equal(s.rows.length,2,'快件页仍按 $row2$ 取，不能被 line_ 覆盖成 3 条');
console.log('通过：流程网格回退选行后 3 条可读；快件页保持原有 $row2$ 选择，不会重复计数。');
