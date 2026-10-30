// 姓名核对（仅记录，不拦截）：inspect 返回联动出的联系人与工作台记录是否一致（去空白与 @#@），
// 不一致时照样 matched；工作台把不一致写进本单历史与「复制修改信息」，同时记录分段耗时。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const statuses=['订单申请','已揽件','发出/派送中','已送达','已签收'];
const make=(jj,sj)=>{
 const vals={'DH$text':'JGKD2026092036825','JJRXM$text':jj,'SJRXM$text':sj};
 const radios=[0,1].flatMap(g=>statuses.map((value,i)=>({value,id:'mini-'+g+'$ck$'+i,checked:g===0&&i===1})));
 const document={getElementById:id=>id in vals?{value:vals[id]}:null,querySelectorAll:s=>s==='input[type="radio"]'?radios:[]};
 const c={module:{exports:{}},window:{mini:{get:()=>({setValue(){}})}},document,location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/flow/flowForm/3c9e2b168f194a628014fa4dd672971e.htm'},URL,Date,getComputedStyle:()=>({visibility:'visible'})};
 vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/../source.js','utf8'),c);return c.module.exports.sourceAction;
};
const order={id:'JGKD2026092036825',status:'已揽件',sender:'张 三',receiver:'李四'};

let r=make('张三','李四@#@')({type:'inspect',order});
assert(r.matched);assert.equal(r.names.sender,true,'去空白后应一致');assert.equal(r.names.receiver,true,'去 @#@ 后应一致');

r=make('王五','赵六')({type:'inspect',order});
assert(r.matched,'姓名不一致本版本只记录，不得拦截');assert.equal(r.names.sender,false);assert.equal(r.names.receiver,false);
assert.equal(r.names.formSender,'王五');

r=make('王五','')({type:'inspect',order:{...order,receiver:''}});
assert(r.matched);assert.equal(r.names.receiver,null,'工作台无收件人时记为未知');

// 工作台侧：nameWarning 只在“都不一致且至少一个确定不一致”时记录
const live=fs.readFileSync(__dirname+'/../live.js','utf8');
const fnSrc=live.slice(live.indexOf('function nameWarning'),live.indexOf('function renderHistory'));
const box={};vm.createContext(box);vm.runInContext(fnSrc+';this.nameWarning=nameWarning;this.timingText=timingText;',box);
assert.equal(box.nameWarning({sender:true,receiver:false},order),'','有一个一致就不记录');
assert.equal(box.nameWarning({sender:null,receiver:null},order),'','都未知不记录');
assert.equal(box.nameWarning(null,order),'');
assert.match(box.nameWarning({sender:false,receiver:null,formSender:'王五',formReceiver:''},order),/王五.*仅记录，未拦截/);
assert.equal(box.timingText({prepare:{portal:1200,linked1:7500},submit:{confirmed:3100}}),'准备[门户1.2 联动(第1次)7.5] 提交[确认3.1]');
assert.equal(box.timingText({prepare:{linked2:9100}}),'准备[联动(第2次)9.1]','要写明第几次触发联动才出订单信息');
assert.equal(box.timingText(null),'');

assert(/row\.nameWarn=nameWarning\(prep&&prep\.names,order\)/.test(live),'准备成功后要记录姓名核对');
assert(/'姓名核对','分段耗时\(秒\)'/.test(live),'复制修改信息要带姓名核对与分段耗时');
assert(/h\.nameWarn\|\|''/.test(live),'历史详情要显示姓名核对提示');
const worker=fs.readFileSync(__dirname+'/../worker.js','utf8');
assert(/return \{matched:true,names,timing\}/.test(worker),'prepare 要回传姓名核对与计时');
console.log('通过：姓名核对去空白/@#@ 后比较，只记录不拦截；历史与复制信息带核对提示和分段耗时。');
