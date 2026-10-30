const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(__dirname+'/../live.js','utf8'),html=fs.readFileSync(__dirname+'/../index.html','utf8');
assert(!html.includes('<datalist'));assert(!html.includes('list="receiverNames"'));assert(code.includes("compositionstart"));assert(code.includes('render(true)'));
const render=code.slice(code.indexOf('function render('),code.indexOf('function view('));
let rowsUpdated=0;const nodes=new Map();
const node=id=>{if(!nodes.has(id)){const n={rows:[],value:'all',textContent:'',hidden:false,disabled:false};Object.defineProperty(n,'innerHTML',{set(v){if(['direction','overview','flowTabs','personTabs','regionTabs'].includes(id))throw Error('输入期间不应重建 '+id);if(id==='rows')rowsUpdated++;}});nodes.set(id,n);}return nodes.get(id);};
const context={$:node,currentView:'orders',filtered:()=>[],localPage:1,LOCAL_PAGE_SIZE:50,selected:new Set(),snapshots:{query:null},kind:()=> 'query',orders:()=>Array.from({length:1219},()=>({duplicateOrder:false})),busy:false,lastReadError:'',campus:'良乡',activeColumn:'all',flowTab:'待办',formatTime:()=>'',document:{querySelectorAll(){throw Error('输入期间不应重建表头');}}};
vm.runInNewContext(render+'render(true);',context);assert.equal(rowsUpdated,1);assert(node('resultCount').textContent.includes('1219'));
console.log('通过：1219条样例输入更新结果表格一次，不重建姓名候选/方向/统计/表头，保留中文组合输入处理。');
