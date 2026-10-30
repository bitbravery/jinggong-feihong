// 表单新鲜度：同一张调整单里残留上一单的号时，不清空拒绝，而是清空重写并重新联动；
// 联动按人工验证的方式触发——填完单号后在空白处点一下（不再依赖回车）。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let keys=[],sets=[],loading=false,now=10000;
const box={value:'',focus(){},dispatchEvent:e=>keys.push(e.type||e),
  getBoundingClientRect:()=>({left:10,top:10,width:120,height:22}),
  closest:()=>null};
const radios=Array.from({length:2},(_,g)=>['订单申请','已揽件','发出/派送中','已送达','已签收'].map((value,i)=>({value,id:'mini-'+g+'$ck$'+i,checked:g===0&&i===0}))).flat();
const document={getElementById:id=>id==='DH$text'?box:null,
  querySelectorAll:s=>s==='input[type="radio"]'?radios:s==='.mini-mask,.mini-mask-loading'&&loading?[{getBoundingClientRect:()=>({height:100})}]:[],
  body:{dispatchEvent:e=>keys.push(e.type||e),getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})}};
const window={mini:{get:()=>({setValue:v=>{sets.push(v);box.value=v;}})}};
const ctx={module:{exports:{}},window,top:window,document,
  location:{origin:'https://ehall.bit.edu.cn',pathname:'/EIP/flow/flowForm/3c9e2b168f194a628014fa4dd672971e.htm'},
  getComputedStyle:()=>({visibility:'visible'}),
  Event:class{constructor(t,o){this.type=t;Object.assign(this,o||{});}},KeyboardEvent:class{constructor(t,o){this.type=t;Object.assign(this,o);}},
  MouseEvent:class{constructor(t,o){this.type=t;Object.assign(this,o);}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../source.js','utf8'),ctx);
ctx.Date={now:()=>now};
const act=ctx.module.exports.sourceAction,order={id:'JGKD2026092036825',status:'订单申请'};

// 1) 残留上一单：清空重写，并标记 carried
box.value='JGKD2026000000001';sets=[];keys=[];
const stale=act({type:'prepare',order});
assert(stale&&stale.prepared,'残留他单时应清空重写而不是拒绝');
assert.equal(stale.carried,true,'应标记 carried（沿用了残留表单）');
assert.deepEqual(sets,['',order.id],'必须先清空再写本次单号');
assert.equal(box.value,order.id);

// 2) 联动方式：点空白（mousedown/mouseup/click），不再发回车
assert.deepEqual(keys,['change','blur','mousedown','mouseup','click'],'填完单号要先让输入框失焦再点空白，实际：'+keys.join(','));
assert.equal(stale.via,'click','应标明用点击触发');

// 3) 新鲜表单：同样先清空再写，再点一下
box.value='';sets=[];keys=[];
const fresh=act({type:'prepare',order});
assert(fresh.prepared);
assert.equal(fresh.carried,false,'新鲜表单不应标 carried');
assert.deepEqual(sets,['',order.id],'必须先清空再写完整单号');
assert.deepEqual(keys,['change','blur','mousedown','mouseup','click'],'新鲜表单也要先失焦再点空白');

// 4) 加载中不得写入、不得点击
loading=true;sets=[];keys=[];
assert(act({type:'prepare',order}).waiting);assert.equal(sets.length,0);assert.equal(keys.length,0,'加载中不得写入或点击');

// 5) inspect 不自行补触发
loading=false;act({type:'prepare',order});keys=[];
now+=5000;act({type:'inspect',order});
assert.equal(keys.length,0,'inspect 不得自行补发回车或点击');

// 6) 两个重试命令都还在：pokeForm 点空白，pressEnter 回车兜底
keys=[];sets=[];
assert(act({type:'pokeForm'}).poked);
assert.deepEqual(keys,['change','blur','mousedown','mouseup','click'],'pokeForm 同样先失焦再点空白');
assert.equal(sets.length,0,'pokeForm 不得改写单号');
keys=[];
assert(act({type:'pressEnter'}).pressed);
assert.deepEqual(keys,['keydown','keyup'],'pressEnter 作为兜底只发一次回车');

console.log('通过：残留/新鲜表单都先清空再写单号，然后点空白触发联动；回车仅作兜底。');
