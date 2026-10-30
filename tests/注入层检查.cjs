// 注入层（P1-4）：真跑 sourceAction，覆盖两个曾经出过问题、又最容易被改坏的命令。
// - flowDebug：曾因引用未定义的 path 而整条诊断失败；
// - openDetail：曾用 9 位前缀匹配，可能打开/打印同日前缀相同的另一单。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');

function ctxFor({pathname,rows,href}={}){
  const body={
    innerText:'',querySelectorAll:()=>[],querySelector:()=>null,
    getBoundingClientRect:()=>({height:10,width:10})
  };
  const ctx={
    module:{exports:{}},URL,
    location:{origin:'https://ehall.bit.edu.cn',pathname:pathname||'/EIP/flow/ToDoList.htm',
      href:href||('https://ehall.bit.edu.cn'+(pathname||'/EIP/flow/ToDoList.htm')),
      search:(href||'').includes('?')?('?'+(href||'').split('?')[1]):''},
    window:{},
    document:{
      body,
      documentElement:{clientWidth:1200,clientHeight:800},
      querySelectorAll:s=>{
        if(/tr\[id\^="line_"\]/.test(s))return rows||[];
        return [];
      },
      querySelector:()=>null,
      getElementById:()=>null
    },
    getComputedStyle:()=>({color:'#000',fontWeight:'400',borderBottomWidth:'0px',visibility:'visible'}),
    MouseEvent:class{constructor(t,i){this.type=t;Object.assign(this,i||{});}}
  };
  vm.createContext(ctx);vm.runInContext(src,ctx);
  return ctx.module.exports.sourceAction;
}

function row(txt,clicked){
  return {
    innerText:txt,className:'mini-grid-row',
    getBoundingClientRect:()=>({height:20,width:100}),
    querySelectorAll:s=>s.includes('a')?[{
      innerText:'寄件申请信息单',
      getBoundingClientRect:()=>({height:12,width:60}),
      click(){clicked.push(txt);}
    }]:[],
    querySelector:()=>null
  };
}

// 1) flowDebug 必须返回 path（回归：曾用未定义的 path 变量）
const act1=ctxFor({pathname:'/EIP/flow/ToDoList.htm'});
const dbg=act1({type:'flowDebug'});
assert(dbg&&dbg.flowDebug,'flowDebug 必须返回 flowDebug:true');
assert.equal(dbg.path,'/EIP/flow/ToDoList.htm','flowDebug 必须返回当前帧路径');

// 2) openDetail：整串单号命中，不得误开前缀相同的别单
{
  const clicked=[];
  const rows=[
    row('1 JGKD202610238275 王五 → 李四',clicked),
    row('2 JGKD202610238276 张三 → 李四',clicked)
  ];
  const act=ctxFor({rows});
  const r=act({type:'openDetail',id:'JGKD202610238276'});
  assert(r&&r.detailRequested,'应发起打开详情');
  assert.equal(clicked.length,1,'只应点一行');
  assert(/…|张三/.test(clicked[0])||clicked[0].includes('8276'),'必须点中 8276 那一行，实际：'+clicked[0]);
}

// 3) 前缀相同但整串都找不到时，不允许按前 9 位猜
{
  const clicked=[];
  const rows=[row('1 JGKD202610238275 王五',clicked),row('2 JGKD202610238274 赵六',clicked)];
  const act=ctxFor({rows});
  const r=act({type:'openDetail',id:'JGKD202610238299'});
  assert(!r.detailRequested,'不得在没有唯一匹配时打开详情');
  assert.equal(clicked.length,0,'不得点击任何行');
}

// 4) 后 8 位唯一匹配时允许（兼容列表截断显示）
{
  const clicked=[];
  const rows=[row('1 …8238276 张三',clicked),row('2 …8238275 王五',clicked)];
  const act=ctxFor({rows});
  const r=act({type:'openDetail',id:'JGKD202610238276'});
  assert(r&&r.detailRequested,'唯一后 8 位匹配时应允许');
  assert.equal(clicked.length,1,'只点一行');
}

console.log('通过：注入层 flowDebug 返回路径；openDetail 只认整串或唯一后缀，不会猜单。');
