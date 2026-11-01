// v0.9.200：前端隐藏「读取日期段」入口；侧栏折叠（图标模式）要显示「重要提示」图标。
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');
const css=fs.readFileSync(__dirname+'/../style.css','utf8');

// 1) 日期段入口已隐藏
assert(!html.includes('readFlowByDate'),'前端不应再有「读取日期段」按钮');
assert(!html.includes('id="flowFrom"'),'日期框也应一并隐藏');
assert(!live.includes("$('readFlowByDate')"),'前端不应再绑定日期段按钮');
assert(!/FeiHongDates\.selected\(\$\('flowFrom'\)/.test(live),'日期段处理函数应移除');
// 读取前 N 页仍保留
assert(html.includes('id="readFlowPages"'),'“读取前 N 页”要保留');

// 2) 折叠后图标：四个原有 + 重要提示
for(const v of ['flow','orders','settings','history','tips']){
  assert(css.includes(`[data-view=${v}]:before`),'折叠模式缺少图标：'+v);
}
assert(/\[data-view=tips\]:before\{content:'⚠'\}/.test(css),'「重要提示」折叠图标应为 ⚠');

assert(live.includes("$('flowPagesWrap').hidden=v!=='flow'"),'“读取前 N 页”只应在流程页显示');
// v0.9.202：整页禁止横向滚动，避免正文钻到固定侧栏下面
assert(/html,body\{overflow-x:hidden\}/.test(css),'整页不应横向滚动');
assert(/侧栏压住标题|浏览器缩放被改了/.test(html),'重要提示要说明缩放错位怎么恢复');
console.log('通过：读取日期段入口已隐藏；折叠模式下「重要提示」图标已补齐。');
