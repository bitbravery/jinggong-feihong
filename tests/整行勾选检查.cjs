// v0.9.193：快件表首列整格可勾选（行间分界线除外），选中整行浅绿底、取消恢复。
const assert=require('node:assert/strict'),fs=require('node:fs');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');
const css=fs.readFileSync(__dirname+'/../style.css','utf8');

// 1) 行标记：选中行带 row-selected，首列带 select-cell
assert(/<tr class="\$\{selected\.has\(o\.id\)\?'row-selected':''\}"><td class="select-cell">/.test(live),'选中行与首列要有标记');
assert(/data-select="\$\{E\(o\.id\)\}"/.test(live),'复选框仍按单号绑定');

// 2) 首列整格点击：排除输入/链接/按钮，且避开上下 2px 分界线
assert(/closest\('td\.select-cell'\)/.test(live),'要监听首列单元格点击');
assert(/if\(e\.target\.closest\('input,label,a,button'\)\)return;/.test(live),'点复选框本身走原生 change，不要重复切换');
assert(/e\.clientY-r\.top<2\|\|r\.bottom-e\.clientY<2/.test(live),'行间分界线不触发勾选');
assert(/input\.checked=!input\.checked;/.test(live),'点击整格要切换勾选');
assert(/input\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\)/.test(live),'切换后复用原有 change 逻辑（更新计数/渲染）');

// 3) 样式：浅绿底、首列热区、勾选框 18px
assert(/#parcelTable tbody tr\.row-selected>td\{background:#e9f5ee\}/.test(css),'选中行要浅绿底');
assert(/#parcelTable tbody tr\.row-selected:hover>td\{background:#e2f1e9\}/.test(css),'悬停时略深一点');
assert(/#parcelTable td\.select-cell\{cursor:pointer\}/.test(css),'首列整格显示可点');
assert(/#parcelTable td\.select-cell input\[type=checkbox\]\{width:18px;height:18px/.test(css),'勾选框放大到 18px');
assert(/#parcelTable tbody tr\.row-selected td:first-child\{box-shadow:inset 3px 0 0 var\(--green\)\}/.test(css),'选中行左侧有绿色标记条');
console.log('通过：首列整格可勾选（分界线除外），选中整行浅绿底、取消恢复，勾选框放大。');
