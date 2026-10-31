// v0.9.187「读取日期段」：查询区默认收起，先点“展开查询”；日期按 MiniUI 写入并核对；
// 有独立“查询”按钮就点，没有就发 change/回车让门户自己触发；隐藏分类页不操作。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');

function page({frameH=528,button=null,widgetWorks=true,hasLabel=true,expanded=false}={}){
 const st={clicks:0,sets:[],expand:0};
 const vis={getBoundingClientRect:()=>({height:20,width:60})};
 const mkInput=id=>({id,value:'',offsetParent:{},...vis,dispatchEvent(){}});
 const inputs=[mkInput('fqrq1$text'),mkInput('fqrq2$text')];
 const row={querySelectorAll:s=>s==='input'?inputs:[],outerHTML:'<tr>发起日期<input></tr>'};
 const label={...vis,innerText:'发起日期:',closest:s=>s==='tr'?row:null,parentElement:row};
 const others=['导出汇总表','流程统计','收起'].map(t=>({...vis,innerText:t,tagName:'A'}));
 if(!expanded)others.push({...vis,innerText:'展开查询',tagName:'A',click(){st.expand++;}});
 const btns=button?[{...vis,...button,click(){st.clicks++;}}]:[];
 const document={querySelectorAll:s=>{
  if(s==='td,th,label,span,div')return hasLabel?[label]:[];
  if(s.includes('button'))return [...others,...btns];
  if(s==='tr[id^=\"line_\"],tr.mini-grid-row')return [];
  return [];
 }};
 const window={frameElement:{getBoundingClientRect:()=>({height:frameH,width:frameH?1300:0})},
  mini:{get:id=>({setValue(v){st.sets.push(id+'='+v);if(widgetWorks){const i=inputs.find(x=>x.id===id+'$text');if(i)i.value=v;}}})}};
 const c={module:{exports:{}},window,document,
  location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/cooperative/haveToDoList.htm',href:'https://ehall.bit.edu.cn/EIP/cooperative/haveToDoList.htm'},URL,
  Event:class{constructor(t){this.type=t;}},KeyboardEvent:class{constructor(t,o){Object.assign(this,o||{});this.type=t;}},
  HTMLInputElement:class{},getComputedStyle:()=>({visibility:'visible'})};
 vm.createContext(c);vm.runInContext(src,c);
 return {act:()=>c.module.exports.sourceAction({type:'flowDate',from:'2026-10-16',to:'2026-10-29'}),st,inputs};
}

// 1) 隐藏的分类页：不响应
let p=page({frameH:0,button:{innerText:'查询',tagName:'A'}});
assert.equal(p.act(),null,'隐藏的分类页不得操作');assert.equal(p.st.clicks,0);

// 2) 查询区收起：先点“展开查询”，不填日期
p=page({hasLabel:false});
let r=p.act();
assert(r.expanded,'应先展开查询区');assert.equal(p.st.expand,1);assert.equal(p.st.sets.length,0,'展开阶段不写日期');

// 3) 没有独立“查询”按钮：照常写日期，用 change/回车触发（不报错、不点按钮）
p=page();
r=p.act();
assert(r.queried&&r.via==='enter',JSON.stringify(r));
assert.deepEqual([...p.st.sets],['fqrq1=2026-10-16','fqrq2=2026-10-29']);
assert.equal(p.st.clicks,0);

// 4) 有 input 按钮、字间带空格：能找到并点一次
p=page({button:{tagName:'INPUT',value:'查 询'}});r=p.act();
assert(r.queried&&r.via==='button',JSON.stringify(r));assert.equal(p.st.clicks,1);

// 5) 日期没写进去：报错且不点查询
p=page({button:{innerText:'查询',tagName:'A'},widgetWorks:false});r=p.act();
assert.match(r.error,/发起日期没有写进原站日期框/);assert.equal(p.st.clicks,0,'日期没写进去不得查询');

console.log('通过：日期段读取先展开查询区；有按钮点按钮，没按钮回车触发；日期写不进去不查询；隐藏页不操作。');
