// 流程按页读取：点“下一页”→读一页→再点，读到前 N 页或原站到底为止；不依赖总数与日期。
const assert=require('node:assert/strict');
const {scanFlows}=require('../bulk.js');
const H=['序号','流程事项名称','单号','物流信息'];
const mk=(tab,page,total,rows)=>({kind:'flow',flowTab:tab,page,total,pageSize:10,headers:H,rows,rowIds:rows.map((_,i)=>tab+'_'+page+'_'+i)});
function fakeRequest({pagesAvailable=5}={}){
 let page={};
 return async msg=>{
  if(msg.type==='flowFirst'){page[msg.flowTab]=1;return {...mk(msg.flowTab,1,null,[['1'],['2']]),pageCount:pagesAvailable};}
  if(msg.type==='flowNextPage'){
   const p=(page[msg.flowTab]||1)+1;
   if(p>pagesAvailable)return {atEnd:true};
   page[msg.flowTab]=p;
   return mk(msg.flowTab,p,null,[[String(p*2-1)],[String(p*2)]]);
  }
  throw Error('未预期的命令 '+msg.type);
 };
}
(async()=>{
 // 1. 默认前 5 页，但原站只有 3 页 → 读到 3 页即止
 let progress=[];
 const parts=await scanFlows({request:fakeRequest({pagesAvailable:3}),onProgress:p=>progress.push(p)});
 assert.equal(parts.length,3,'必须返回三类');
 assert.equal(parts[0].pagesRead,3,'读到原站最后一页就停');
 assert.equal(parts[0].rows.length,6,'3 页 × 2 行');
 assert.equal(parts[1].flowTab,'已办');
 assert(progress.some(p=>p.tab==='待办'&&p.page===3),'要上报到第 3 页');

 // 2. 只读前 2 页
 const two=await scanFlows({request:fakeRequest({pagesAvailable:9}),pages:2});
 assert.equal(two[0].pagesRead,2);
 assert.equal(two[0].rows.length,4);

 // 3. 中途停止保留已读
 let calls=0;
 await assert.rejects(()=>scanFlows({request:fakeRequest({pagesAvailable:9}),isCancelled:()=>calls++>4}),e=>{
  assert.match(e.message,/已停止读取流程/);assert.equal(e.partial.length,1);return true;
 });

 // 4. 翻页失败不冒充成功
 const bad=async msg=>{
  if(msg.type==='flowFirst')return mk(msg.flowTab,1,null,[['1'],['2']]);
  throw Error('点击“下一页”后列表没有变化');
 };
 const r=await scanFlows({request:bad,pages:5});
 assert.equal(r[0].pagesRead,1,'翻页失败应停在第 1 页');
 assert.equal(r[0].rows.length,2);
 console.log('通过：流程按“点下一页→读一页”读取，读满 N 页或到底即止；可中途停止；翻页失败不冒充。');
})().catch(e=>{console.error(e);process.exitCode=1;});
