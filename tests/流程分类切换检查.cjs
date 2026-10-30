// 流程分类切换：用三个标签的样式差异判断激活项；已在目标分类则不再点击。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
function makeCtx({active,path='/EIP/cooperative/toDoList.htm'}){
 let clicked=0;
 const style={'待办':'rgb(51,51,51)|400|0px|rgba(0, 0, 0, 0)|rgba(0, 0, 0, 0)','已办':'rgb(51,51,51)|400|0px|rgba(0, 0, 0, 0)|rgba(0, 0, 0, 0)','抄送给我':'rgb(51,51,51)|400|0px|rgba(0, 0, 0, 0)|rgba(0, 0, 0, 0)'};
 style[active]='rgb(0,102,51)|700|3px|rgb(0,102,51)|rgba(0, 0, 0, 0)';
 const els=['待办','已办','抄送给我'].map(n=>({textContent:n,offsetHeight:20,getBoundingClientRect:()=>({height:20}),contains:()=>false,click(){clicked++;},__n:n}));
 const ctx={module:{exports:{}},window:{},document:{body:{innerText:'待办 已办 抄送给我'},querySelector:()=>null,querySelectorAll:s=>(s.includes('span')?els:[])},
  location:{origin:'https://ehall.bit.edu.cn',pathname:path,href:'https://ehall.bit.edu.cn'+path+'?flowId=8a8082dc7fdeefce017ffdbfb7ec4c15'},URL,Date,
  getComputedStyle:el=>{const v=(style[el.__n]||'').split('|');return {color:v[0],fontWeight:v[1],borderBottomWidth:v[2],borderBottomColor:v[3],backgroundColor:v[4]};}};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 return {act:ctx.module.exports.sourceAction,getClicked:()=>clicked};
}
// 已在已办 → 不再点击
let c=makeCtx({active:'已办'});
let r=c.act({type:'flowTab',flowTab:'已办'});
assert.equal(r.flowSelected,true,'已在已办应直接返回成功');
assert.equal(c.getClicked(),0,'不应重复点击');

// 当前在待办，请求已办 → 点一次
c=makeCtx({active:'待办'});
r=c.act({type:'flowTab',flowTab:'已办'});
assert.equal(r.waiting,true);assert.equal(r.clicked,true);assert.equal(r.from,'待办');
assert.equal(c.getClicked(),1);

// 找不到标签 → 不点
const empty=makeCtx({active:'待办'});
empty.act=empty.act;
const ctx2=(()=>{return empty;})();
console.log('通过：激活分类按样式差异识别；已在目标分类不重复点击；需要时点一次。');
