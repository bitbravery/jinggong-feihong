const assert=require('node:assert/strict');
const {scanAll}=require('../bulk.js');
function fixtures(){const rows=Array.from({length:5},(_,i)=>[String(i+1),'JGKD'+i]);return {rows,page:n=>({kind:'query',headers:['序号','单号'],rows:rows.slice((n-1)*2,n*2),rowIds:rows.slice((n-1)*2,n*2).map((_,i)=>'row'+i),page:n,pageSize:2,total:5,readAt:'2026-10-19T12:00:00Z'})};}
async function main(){
 let page=1;const f=fixtures(),calls=[];const request=async m=>{calls.push(m);if(m.type==='beginAll'||m.direction==='first')page=1;else page++;return f.page(page);};
 const all=await scanAll({request});assert.equal(all.rows.length,5);assert.equal(all.pagesRead,3);assert(all.complete);assert.equal(new Set(all.rowIds).size,5);assert.equal(calls.at(-1).direction,'first');
 let stop=false;page=1;try{await scanAll({request,isCancelled:()=>stop,onProgress:p=>{if(p.page===2)stop=true;}});assert.fail('应停止');}catch(e){assert.equal(e.partial.rows.length,4);assert.equal(e.partial.complete,false);}
 page=1;await assert.rejects(scanAll({request:async m=>{const s=await request(m);if(s.page===2)s.total=6;return s;}}),/发生变化/);
 page=1;await assert.rejects(scanAll({request:async m=>{const s=await request(m);if(s.page===2)s.rows[0][0]='1';return s;}}),/序号/);
 const g=fixtures();let n=1;await assert.rejects(scanAll({request:async m=>{if(m.type==='beginAll')return g.page(1);if(m.direction==='first'){const s=g.page(1);s.rows[0]=['1','CHANGED'];return s;}return g.page(++n);}}),/首尾核对/);
 const dateSnapshot={kind:'query',headers:['序号','下单时间'],rows:[['1','2026-08-18']],page:1,pageSize:30,total:1,dateRange:{from:'2026-08-19',to:'2026-10-19',endExclusive:'2026-10-20'}};
 await assert.rejects(scanAll({request:async()=>dateSnapshot}),/日期范围之外/);
 console.log('通过：全页累积、跨页行键、中途停止、总数变化、重复页序号及首尾数据变化校验。');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
