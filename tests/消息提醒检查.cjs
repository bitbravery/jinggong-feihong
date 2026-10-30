// 原站消息提醒：从门户的“消息提醒”浮层里提取正文与发送时间，供工作台展示。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
function makeCtx(boxes){
 const ctx={module:{exports:{}},window:{},document:{body:{innerText:''},querySelectorAll:s=>s==='div,section,aside,li'?boxes:[]},
  location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/nonlogin/mixportal/framework.htm',href:'https://ehall.bit.edu.cn/EIP/nonlogin/mixportal/framework.htm?isactivatePersonalHomeTab=true'},URL,Date,getComputedStyle:()=>({visibility:'visible'})};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 return ctx.module.exports.sourceAction;
}
const box={innerText:'消息提醒\n您好,您收到了徐则晨发起的事项【寄件申请信息单】,请及时办理。\n发送时间：10月22日 16:01\n详情',getBoundingClientRect:()=>({height:60}),contains:()=>false};
let r=makeCtx([box])({type:'notices'});
assert(r.notices.length===1);
assert(r.notices[0].body.includes('寄件申请信息单'),'正文要保留事项名');
assert.equal(r.notices[0].time,'10月22日 16:01','要解析出发送时间');

r=makeCtx([])({type:'notices'});
assert.equal(r.notices.length,0,'没有提醒时返回空数组');
console.log('通过：能从原站“消息提醒”浮层提取正文与发送时间；无提醒时返回空。');
