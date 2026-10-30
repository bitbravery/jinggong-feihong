// v0.9.181 诊断（不改行为）：每单记录点「确定」的次数、间隔、浏览器网络请求记录条数（满 250 条时“已点过就别再点”判断失效）。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
let t=1000,clicks=0;const resources=[];
const ok={id:'mini-9',innerText:'确定',className:'mini-button',getAttribute:()=>null,getBoundingClientRect:()=>({height:24,width:60,left:640,top:300}),dispatchEvent(e){if(e&&e.type==='click')clicks++;},click(){clicks++;}};
const box={innerText:'提示信息 您确定要提交吗？',getBoundingClientRect:()=>({height:132,width:250}),querySelectorAll:()=>[ok],querySelector:()=>null,get outerHTML(){return '';}};
const w={};
const ctx={module:{exports:{}},window:w,top:w,Date:{now:()=>t},performance:{getEntriesByType:()=>resources},
 location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/cooperative/openCooperative.htm',href:''},URL,sessionStorage:{removeItem(){}},
 MouseEvent:class{constructor(ty,i){this.type=ty;Object.assign(this,i||{});}},getComputedStyle:()=>({zIndex:'1'}),
 document:{querySelectorAll:s=>s==='div,span,p,td'?[]:[box],elementFromPoint:()=>ok,body:{innerText:''}}};
vm.createContext(ctx);vm.runInContext(src,ctx);const act=c=>ctx.module.exports.sourceAction(c);
// 网络请求记录已满 250 条（门户开了一整天），确认框一直不关：会按节奏重按
for(let i=0;i<250;i++)resources.push({name:'x',duration:1});
const cmd={type:'confirmSubmit',order:{id:'JGKD1'},target:'已签收',token:'P'};
act(cmd);t+=1500;act(cmd);
const info=act({type:'pressInfo',token:'P'});
assert.equal(info.count,2,'应记下点了 2 次');assert.deepEqual([...info.gaps],[1.5],'应记下间隔 1.5 秒');assert.equal(info.buf,250,'应记下请求记录条数');
assert.equal(act({type:'pressInfo',token:'OTHER'}).count,0,'别的提交查不到本单记录');
// 编排层把它写成一句话，满 250 条要点明判断失效
const worker=fs.readFileSync(__dirname+'/../worker.js','utf8');
const fn=worker.slice(worker.indexOf('async function pressNote'),worker.indexOf('async function portalSaving'));
const c2={run:async()=>[null,{pressInfo:true,count:2,gaps:[1.5],buf:250,mini:false}]};vm.createContext(c2);vm.runInContext(fn+';this.f=pressNote;',c2);
c2.f('P').then(text=>{
 assert.equal(text,'点「确定」2 次（间隔 1.5 秒）；浏览器网络请求记录 250 条（已满 250 条，“已点过就别再点”的判断失效）');
 const live=fs.readFileSync(__dirname+'/../live.js','utf8');
 assert(/row\.presses=submitted\.presses/.test(live)&&/h\.presses\|\|''/.test(live)&&/'点确定记录'\]/.test(live),'历史详情与复制修改信息要带点确定记录');
 assert(/presses:await pressNote\(confirmToken\)/.test(worker),'成功结果要带点确定记录');
 console.log('通过：记录点确定次数、间隔、请求记录条数（满 250 条点明失效），并写进历史与复制修改信息。');
}).catch(e=>{console.error(e);process.exitCode=1;});
