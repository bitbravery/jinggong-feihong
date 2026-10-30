// v0.9.180 写入加固：
// ② 调整单标签消失，只有本单点过「确定」才算提交成功（否则可能是门户因错关闭或被手动关闭）；
// ⑤ 批量通过/退回：点菜单前给已有弹窗打标记，只点之后新出现弹窗里的「确定」；结束后刷新待办并核对所选单号是否还在。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
const MouseEvent=class{constructor(t,i){this.type=t;Object.assign(this,i||{});}};

// ---------- ② 标签消失 ----------
function portal(){
 const st={tabGone:false};
 const tab={textContent:'物流状态调整单',innerText:'物流状态调整单',get isConnected(){return !st.tabGone;},classList:{contains:c=>c==='mini-tab-active'}};
 const service={textContent:'京工飞鸿两校快件系统',innerText:'京工飞鸿两校快件系统',isConnected:true,classList:{contains:()=>false}};
 const w={};
 const ctx={module:{exports:{}},window:w,top:w,location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/nonlogin/mixportal/framework.htm',href:''},URL,MouseEvent,
  document:{querySelectorAll:s=>s==='.mini-tab'?(st.tabGone?[service]:[tab,service]):[]}};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 return {act:c=>ctx.module.exports.sourceAction(c),st,w};
}
const order={id:'JGKD1'};
let p=portal();
assert(p.act({type:'armSubmission',order,target:'已签收'}).armed);
p.st.tabGone=true;
let r=p.act({type:'submissionComplete',order,target:'已签收',token:'T'});
assert(!r.submissionComplete&&r.tabGoneNoPress,'没点过「确定」标签就没了，不得算提交成功');
p=portal();p.act({type:'armSubmission',order,target:'已签收'});p.w.__fhPressed={token:'T',at:1};p.st.tabGone=true;
r=p.act({type:'submissionComplete',order,target:'已签收',token:'T'});
assert(r.submissionComplete,'点过本单「确定」后标签自动关闭，算提交成功');
p=portal();p.act({type:'armSubmission',order,target:'已签收'});p.w.__fhPressed={token:'OTHER',at:1};p.st.tabGone=true;
r=p.act({type:'submissionComplete',order,target:'已签收',token:'T'});
assert(!r.submissionComplete,'点的是别的提交的「确定」，不算本单');

// ---------- ⑤ 批量通过的确认弹窗 ----------
function flowPage(){
 const st={newBox:false,clicked:[]};
 const mk=(name)=>({getBoundingClientRect:()=>({height:100}),querySelectorAll:()=>[{innerText:'确定',getBoundingClientRect:()=>({height:20}),click(){st.clicked.push(name);}}]});
 const oldBox=mk('旧弹窗'),newBox=mk('新弹窗');
 const ctx={module:{exports:{}},window:{},location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/cooperative/toDoList.htm',href:''},URL,MouseEvent,
  document:{querySelectorAll:s=>s==='.mini-window,.mini-messagebox,.mini-panel'?(st.newBox?[oldBox,newBox]:[oldBox]):[]}};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 return {act:c=>ctx.module.exports.sourceAction(c),st};
}
let f=flowPage();
assert.equal(f.act({type:'dialogMark'}).count,1,'点菜单前要标记已有弹窗');
r=f.act({type:'flowDialogOk'});assert(r.waiting,'新弹窗出现前不得点旧弹窗的「确定」');assert.equal(f.st.clicked.length,0);
f.st.newBox=true;r=f.act({type:'flowDialogOk'});assert(r.ok);assert.deepEqual([...f.st.clicked],['新弹窗'],'只点新出现弹窗的「确定」');
const worker=fs.readFileSync(__dirname+'/../worker.js','utf8');
assert(worker.indexOf("type:'dialogMark'")>=0&&worker.indexOf("type:'dialogMark'")<worker.indexOf("run({type:'flowMenu'"),'点「通过/退回」前要先标记已有弹窗');
assert(/type:'submissionComplete',order:msg\.order,target:msg\.target,token:confirmToken/.test(worker),'批量提交的标签消失信号要带本单令牌');
assert(/type:'submissionComplete',order:\{id:msg\.id\},target:msg\.from,token:rtoken/.test(worker),'改回的标签消失信号要带令牌');

// ---------- ⑤ 结束后核对待办 ----------
const live=fs.readFileSync(__dirname+'/../live.js','utf8');
assert(/const left=ids\.filter\(id=>records\.flow\.some\(o=>o\.id===id&&o\.flow==='待办'\)\)/.test(live),'刷新后要核对所选单号是否仍在待办');
assert(/请到原站核对是否已'\+label/.test(live),'仍在待办的要提示到原站核对');
console.log('通过：标签消失须本单点过确定才算成功；批量通过只点新弹窗的确定；结束后核对待办。');
