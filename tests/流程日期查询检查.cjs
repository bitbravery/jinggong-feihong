// v0.9.171「读取日期段」：只在正在显示的分类页操作（隐藏页也会收到命令）；先找到“查询”按钮再填日期；
// 按钮也可以是 input 按钮或字间带空格；日期按 MiniUI 控件写入并核对；找不到按钮时不动日期框，并列出页面上能点的字。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
function page({frameH=528,button=null,widgetWorks=true}={}){
 const st={clicks:0,sets:[]};
 const vis={getBoundingClientRect:()=>({height:20,width:60})};
 const mkInput=id=>({id,value:'',offsetParent:{},...vis,dispatchEvent(){}});
 const inputs=[mkInput('fqrq1$text'),mkInput('fqrq2$text')];
 const row={querySelectorAll:s=>s==='input'?inputs:[]};
 const label={...vis,innerText:'发起日期:',closest:s=>s==='tr'?row:null,parentElement:row};
 const others=['导出汇总表','流程统计','收起'].map(t=>({...vis,innerText:t,tagName:'A'}));
 const btns=button?[{...vis,...button,click(){st.clicks++;}}]:[];
 const document={querySelectorAll:s=>s==='td,th,label,span,div'?[label]:s.startsWith('button,a,span')?[...others,...btns]:s==='tr[id^="line_"],tr.mini-grid-row'?[]:[]};
 const window={frameElement:{getBoundingClientRect:()=>({height:frameH,width:frameH?1300:0})},
  mini:{get:id=>({setValue(v){st.sets.push(id+'='+v);if(widgetWorks)inputs.find(i=>i.id===id+'$text').value=v;}})}};
 const c={module:{exports:{}},window,document,location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/cooperative/haveToDoList.htm',href:'https://ehall.bit.edu.cn/EIP/cooperative/haveToDoList.htm'},URL,
  Event:class{constructor(t){this.type=t;}},HTMLInputElement:class{},getComputedStyle:()=>({visibility:'visible'})};
 vm.createContext(c);vm.runInContext(src,c);
 return {act:()=>c.module.exports.sourceAction({type:'flowDate',from:'2026-10-16',to:'2026-10-29'}),st,inputs};
}
// 1) 隐藏的分类页：不响应
let p=page({frameH:0,button:{innerText:'查询',tagName:'A'}});
assert.equal(p.act(),null,'隐藏的分类页不得操作');assert.equal(p.st.clicks,0);
// 2) 找不到“查询”：不填日期，并列出能点的字
p=page();let r=p.act();
assert.match(r.error,/没有找到“查询”按钮，日期条件未填入/);assert.match(r.error,/导出汇总表、流程统计、收起/);
assert.equal(p.st.sets.length,0,'找不到按钮时不得改动日期框');assert.equal(p.inputs[0].value,'');
// 3) input 按钮、字间带空格：能找到；日期按 MiniUI 控件写入并核对后点一次
p=page({button:{tagName:'INPUT',value:'查 询'}});r=p.act();
assert(r.queried,JSON.stringify(r));assert.equal(p.st.clicks,1);
assert.deepEqual([...p.st.sets],['fqrq1=2026-10-16','fqrq2=2026-10-29']);
// 4) 日期没写进去：不点查询
p=page({button:{innerText:'查询',tagName:'A'},widgetWorks:false});r=p.act();
assert.match(r.error,/发起日期没有写进原站日期框/);assert.equal(p.st.clicks,0,'日期没写进去不得查询');
console.log('通过：日期查询只在显示中的分类页操作；先找按钮再填日期；支持 input 按钮；按 MiniUI 写日期并核对；找不到按钮时列出可点的字且不动日期框。');
