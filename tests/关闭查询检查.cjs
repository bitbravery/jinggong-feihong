// v0.9.209：查询结束后先点条件行的红色错号，再点「关闭查询」（用户现场顺序）。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
const order=[];

function el(innerText,{cls='',w=60,h=20,children=[]}={}){
  const self={
    innerText,className:cls,textContent:innerText,tagName:'SPAN',
    children,parentElement:null,
    getBoundingClientRect:()=>({height:h,width:w,left:0,top:0}),
    querySelectorAll:()=>children,
    dispatchEvent(ev){if(ev&&ev.type==='click')order.push(innerText);},
    click(){order.push(innerText);}
  };
  for(const c of children)c.parentElement=self;
  return self;
}
const x=el('✕',{w:18});
const close=el('关闭查询',{w:90});
const panel=el('条件字段 条件 条件值 操作 关闭查询',{w:900,children:[x,close]});
const ctx={module:{exports:{}},location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/cooperative/queryResult.htm',href:'x'},URL,
 window:{},document:{querySelectorAll:s=>s==='button,a,span,div'?[panel,x,close]:[],body:panel},
 getComputedStyle:()=>({visibility:'visible'}),MouseEvent:class{constructor(t,o){this.type=t;Object.assign(this,o||{});}}};
vm.createContext(ctx);vm.runInContext(src,ctx);
const r=ctx.module.exports.sourceAction({type:'closeQuery'});
assert(r&&r.closed,'应执行关闭查询：'+JSON.stringify(r));
assert.equal(r.cleared>=1,true,'要点掉条件行的红色错号');
const xi=order.indexOf('✕'),ci=order.indexOf('关闭查询');
assert(xi>=0&&ci>=0,'两个动作都要发生：'+order.join(','));
assert(xi<ci,'必须先点红色错号，再点关闭查询：'+order.join(','));

// 后台：每次按单号查询结束都自动关闭（含异常）
const w=fs.readFileSync(__dirname+'/../worker.js','utf8');
assert(w.includes('async function queryOneRaw'),'queryOne 原逻辑保留');
assert(/async function queryOne\(id,opts\)\{\s*try\{return await queryOneRaw\(id,opts\);\}\s*finally\{try\{await closeQueryPanel\(\);\}catch\{\}\}\s*\}/.test(w),'查询结束必须关闭查询面板');
assert(/await ensureFormActive\(stage\);\s*\n\s*try\{await closeQueryPanel\(\);\}catch\{\}/.test(w),'填单号前也先关查询面板');
// v0.9.217：自定义时段/近一个月批量读取结束后也要自动关闭查询面板（先红✕再「关闭查询」）
assert(/PORTAL_OPS=new Set\(\['openStandardPages','endRead'/.test(w),'endRead 要进原站串行队列');
assert(/if\(msg\.type==='endRead'\)\{[\s\S]{0,400}closeQueryPanel\(\)/.test(w),'批量读取结束后必须关闭查询面板');
assert(/ended:true,closed/.test(w),'endRead 要返回关闭结果');
// v1.0.0：条件行红叉是 delete_search 链接（图标没有“×”文字），要逐个清完再「关闭查询」；后台循环调用
const cq=src.slice(src.indexOf("command.type==='closeQuery'"),src.indexOf("command.type==='toastState'"));
assert(cq.includes('delete_search'),'条件行红叉要用 delete_search 链接识别');
assert(/if\(delLinks\.length\)\{shoot\(delLinks\[0\]\);return \{cleared:1,more:/.test(cq),'一次清一个条件行红叉，清完再关');
assert(/for\(let i=0;i<12;i\+\+\)[\s\S]{0,600}cleared/.test(w),'后台要循环清条件，全部清完才关闭查询');
console.log('通过：先逐个点掉条件行红色错号，再点「关闭查询」（含查询失败的情况）。');
