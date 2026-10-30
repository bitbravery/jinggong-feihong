// 快捷标签清理：回查前必须清掉门户的快捷标签，否则按单号查会被旧条件过滤成 0 条。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../source.js','utf8');
function makeCtx({tags,path='/EIP/maindatabase/querymanage/queryResult.htm'}){
 const ctx={module:{exports:{}},window:{},document:{querySelectorAll:s=>s.startsWith('#quick-tag-box')?tags:[]},
  location:{origin:'https://ehall.bit.edu.cn',pathname:path,href:'https://ehall.bit.edu.cn'+path+'?queryCode=8y4xbat8bd5dygdtw7ncbwcayenmnckt'},URL,getComputedStyle:()=>({visibility:'visible'})};
 ctx.clicks=0;
 vm.createContext(ctx);vm.runInContext(src,ctx);return ctx;
}
const tagWithClose={innerText:'良乡订单申请×',querySelector:()=>({click(){ctxRef.clicks++;}})};
let ctxRef;
// 1. 有活动标签且有关闭控件 → 点一次，返回剩余数
ctxRef=makeCtx({tags:[tagWithClose,{innerText:'中关村已发出×',querySelector:()=>({click(){}}) }]});
let r=ctxRef.module.exports.sourceAction({type:'clearTags'});
assert.equal(r.active,1,'点掉一个后应剩一个');assert.equal(ctxRef.clicks,1);

// 2. 没有标签 → active 0
ctxRef=makeCtx({tags:[]});
r=ctxRef.module.exports.sourceAction({type:'clearTags'});
assert.equal(r.active,0);

// 3. 标签没有关闭控件 → 要求人工清除，不瞎点
ctxRef=makeCtx({tags:[{innerText:'良乡订单申请',querySelector:()=>null}]});
r=ctxRef.module.exports.sourceAction({type:'clearTags'});
assert.match(r.error||'',/手动/);assert.equal(ctxRef.clicks,0);

// 4. 非查询页不参与
ctxRef=makeCtx({tags:[tagWithClose],path:'/EIP/nonlogin/mixportal/framework.htm'});
assert.equal(ctxRef.module.exports.sourceAction({type:'clearTags'}),null);
console.log('通过：回查前清快捷标签（逐个点关闭并回报剩余），无关闭控件时要求人工清除，非查询页不参与。');
