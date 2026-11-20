// v1.0.32：切换分类标签、方向/身份/区域筛选、搜索与下单日期时保留已勾选，可跨标签累加；
// 重新读取、换校区、换页面、点“取消选择”仍然清空。勾选里有不在当前列表的，选择栏写明几件。
const assert=require('node:assert/strict'),fs=require('node:fs');
const D=__dirname+'/../';
const live=fs.readFileSync(D+'live.js','utf8'),html=fs.readFileSync(D+'index.html','utf8');
const handler=(start)=>{const i=live.indexOf(start);assert(i>=0,'找不到：'+start);return live.slice(i,live.indexOf('\n',i));};
assert(!/selected\.clear\(\)/.test(handler("$('overview').onclick")),'切换分类标签不能清空已勾选');
assert(!/selected\.clear\(\)/.test(handler("for(const id of ['direction','identity','region'])")),'方向/身份/区域筛选不能清空已勾选');
assert(!/selected\.clear\(\)/.test(handler('function applyInputFilter(')),'搜索/下单日期不能清空已勾选');
assert(/selected\.clear\(\)/.test(handler("$('confirmCampus').onclick")),'换校区仍要清空');
assert(/selected\.clear\(\)/.test(handler("$('cancelSelection').onclick")),'取消选择仍要清空');
assert(/selected\.clear\(\)/.test(handler('function view(')),'换页面（流程/快件查询）仍要清空');
console.log('通过：切换分类标签与各种筛选都保留已勾选；换校区、换页面、取消选择仍会清空。');

// 选择栏：有勾选不在当前列表里时写明几件（执行 render 里的这段原文）
const i=live.indexOf("{const shown=new Set(filtered().map(o=>o.id))");assert(i>0);
let depth=0,j=i;for(;j<live.length;j++){if(live[j]==='{')depth++;else if(live[j]==='}'&&--depth===0)break;}
const piece=live.slice(i,j+1);
const el={hidden:true,textContent:''};
new Function('filtered','selected','$',piece)(()=>[{id:'A'},{id:'B'}],new Set(['A','X','Y']),id=>id==='selectedHidden'?el:null);
assert.equal(el.hidden,false);assert.equal(el.textContent,'（其中 2 件在其他标签里）');
new Function('filtered','selected','$',piece)(()=>[{id:'A'}],new Set(['A']),id=>id==='selectedHidden'?el:null);
assert.equal(el.hidden,true);
assert(/id="selectedCount">0<\/b> 件<span id="selectedHidden"/.test(html));
console.log('通过：已选里有不在当前列表的，选择栏写明“其中 N 件在其他标签里”，批量改状态/导出前一眼可见。');
