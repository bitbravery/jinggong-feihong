// 批量通过/退回勾选：只按完整单号找行。前 9 位相同的同期单号不能互相顶替；完整单号找不到或多行命中时报错且一行都不勾；不再按行号兜底。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
function mkRow(n,id,names){
 const input={checked:false,dispatchEvent(){}};
 const mask={dispatchEvent(e){if(e.type==='click')input.checked=true;}};
 const cell={querySelector:s=>s==='.mini-grid-radio-mask'?mask:s==='input[type=checkbox]'?input:null};
 return {id:'line_'+n,className:'mini-grid-row',offsetHeight:20,input,
  innerText:[n,'寄件申请',id,'订单申请',names||'张三\t李四'].join('\t'),
  querySelector:s=>s==='td.mini-checkcolumn'||s==='td'?cell:s==='input[type=checkbox]'?input:null};
}
function run(rows,command){
 const document={body:{innerText:''},querySelector:s=>/line_|mini-grid-row/.test(s)?rows[0]||null:null,querySelectorAll:s=>/line_|mini-grid-row/.test(s)?rows:[]};
 const ctx={module:{exports:{}},window:{},top:{},document,location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/flow/flowList/toDoList.htm',href:'https://ehall.bit.edu.cn/EIP/flow/flowList/toDoList.htm'},URL,MouseEvent:class{constructor(t){this.type=t;}},getComputedStyle:()=>({visibility:'visible'})};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 return ctx.module.exports.sourceAction({type:'flowSelect',...command});
}
const checked=rows=>rows.filter(r=>r.input.checked).map(r=>r.id);
// A. 前 9 位（JGKD20261）相同的两行，只勾完整单号那行，哪怕它排在后面
let rows=[mkRow(1,'JGKD2026100011'),mkRow(2,'JGKD2026100022')];
let r=run(rows,{id:'JGKD2026100022',index:1});
assert.equal(r.selected,true,'完整单号那行必须勾上');assert.equal(r.via,'单号');
assert.deepEqual(checked(rows),['line_2'],'只能勾完整单号所在行，不能勾前 9 位相同的另一单');
// B. 完整单号不在列表里：报错、一行不勾（不能退化为前 9 位，也不能按行号兜底）
rows=[mkRow(1,'JGKD2026100011'),mkRow(2,'JGKD2026100022')];
r=run(rows,{id:'JGKD2026100033',index:2});
assert(!r.selected,'找不到完整单号时不能报告已勾选');
assert.match(String(r.error||''),/没有完整单号 JGKD2026100033/,'找不到时要给出明确错误');
assert.deepEqual(checked(rows),[],'找不到完整单号时一行都不能勾');
// C. 单号是另一单号的前缀：JGKD202610001 不能命中 JGKD2026100012
rows=[mkRow(1,'JGKD2026100012')];
r=run(rows,{id:'JGKD202610001',index:1});
assert.deepEqual(checked(rows),[],'单号前缀不算命中');
// D. 有单号但找不到时，寄件人+收件人也不能顶替（同一寄件人可能有多单）
rows=[mkRow(1,'JGKD2026100011','王五\t赵六')];
r=run(rows,{id:'JGKD2026100099',sender:'王五',receiver:'赵六'});
assert.deepEqual(checked(rows),[],'有单号时不能退化为按姓名勾选');
// E. 同一完整单号出现在两行：报错不勾（worker 见“匹配到 N 行”立即停止）
rows=[mkRow(1,'JGKD2026100011'),mkRow(2,'JGKD2026100011')];
r=run(rows,{id:'JGKD2026100011'});
assert.match(String(r.error||''),/匹配到 2 行/);
assert.deepEqual(checked(rows),[],'多行命中时一行都不能勾');
// F. worker 对“匹配到 N 行”立即停止，对找不到会重试后报错
const worker=fs.readFileSync(__dirname+'/../worker.js','utf8');
assert(worker.includes('if(bad&&/匹配到 \\d+ 行/.test(bad.error))break;'),'worker 遇到多行命中应停止重试');
console.log('通过：流程勾选只认完整单号；前 9 位相同的同期单号、单号前缀、姓名、行号都不能顶替；找不到或多行命中时报错且不勾。');
