// 提交完成判定：调整单标签消失即视为门户提交结束（不再强依赖业务系统标签重新激活），
// 但失败提示优先，且跟踪只能用一次；多个调整单标签时拒绝提交。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let active=true,alertText='';
const form={innerText:'物流状态调整单',isConnected:true,classList:{contains:()=>true}};
const service={innerText:'京工飞鸿两校快件系统',classList:{contains:()=>active}};
let tabs=[form,service];
const window={};
const ctx={module:{exports:{}},window,top:window,location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/nonlogin/mixportal/framework.htm'},
 document:{querySelectorAll:s=>s==='.mini-tab'?tabs:(s==='[id$="$content"]'?(alertText?[{getBoundingClientRect:()=>({height:10}),innerText:alertText}]:[]):[])}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../source.js','utf8'),ctx);
const act=ctx.module.exports.sourceAction,cmd={order:{id:'JGKD1'},target:'已送达'};

assert(act({...cmd,type:'armSubmission'}).armed);
assert(!act({...cmd,type:'submissionComplete'}).submissionComplete,'标签还在时不能算完成');

form.isConnected=false;tabs=[service];active=false;
const done=act({...cmd,type:'submissionComplete'});
assert(done.submissionComplete,'调整单标签消失即视为门户提交结束');
assert.equal(done.serviceActive,false,'业务系统标签未激活也应完成，最终由回读裁决');
assert(act({...cmd,type:'submissionComplete'}).error,'跟踪只消费一次');

// 失败提示优先于“完成”
form.isConnected=true;tabs=[form,service];active=true;alertText='提交失败：数据库异常';
assert(act({...cmd,type:'armSubmission'}).armed);
assert.match(act({...cmd,type:'submissionComplete'}).error||'',/失败提示/);alertText='';

// 多张调整单标签：拒绝提交
active=true;tabs=[{...form,innerText:'物流状态调整单'},form,service];
assert.match(act({...cmd,type:'armSubmission'}).error||'',/未唯一识别/);

// 非门户顶层帧不参与
ctx.top={};assert.equal(act({...cmd,type:'armSubmission'}),null);
console.log('通过：标签消失即完成（不依赖业务系统标签激活）、失败提示优先、跟踪一次性消费、多标签拒绝提交、非门户帧不参与。');
