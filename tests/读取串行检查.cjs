const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');let listener,time=0,phase='initial',polls=0,pageClicks=0;const log=[];
const rowset=(page,size)=>Array.from({length:Math.min(size,130-(page-1)*size)},(_,i)=>[String((page-1)*size+i+1),'2026-10-20','JGKD'+i]);
const snap=(page,size,token,settled)=>({kind:'query',headers:['序号','下单时间','单号'],rows:rowset(page,size),page,pageSize:size,total:130,probeToken:token,probeSettled:settled});
const ctx={importScripts(){},Date:{now:()=>time},setTimeout:fn=>{time+=200;fn();},chrome:{action:{onClicked:{addListener(){}}},storage:{session:{get:async()=>({sourceTabId:1})}},tabs:{update:async()=>{}},runtime:{getURL:p=>'extension://'+p,sendMessage:async()=>{},onMessage:{addListener:fn=>listener=fn}}},FeiHongDates:{recentMonth:()=>({from:'2026-09-20',to:'2026-10-20',endExclusive:'2026-10-21'})}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../worker.js','utf8'),ctx);
ctx.fakeRun=async c=>{
 if(c.type==='frameReport')return [{path:'/EIP/maindatabase/querymanage/queryResult.htm',ready:'complete'}];
 if(c.type==='queryDateField'){assert.equal(phase,'initial');log.push('dateField');return [{fieldSelected:true}];}
 if(c.type==='queryRecent'){phase='date';log.push('query');return [{queryRequested:true,token:'date'}];}
 if(c.type==='pageSize'){assert.equal(phase,'dateDone','不能在日期查询完成前改每页条数');phase='size';log.push('size');return [{pageSizeSelected:true,requestedSize:100,token:'size'}];}
 if(c.type==='page'){assert.equal(phase,'sizeDone','不能在每页条数刷新完成前翻页');pageClicks++;phase='first';polls=0;log.push('first');return [{pageRequested:1,token:'first'}];}
 if(c.type==='snapshot'){
  if(phase==='initial')return [snap(2,30,'',false)];
  if(phase==='date'){if(++polls<3)return [];phase='dateDone';return [snap(2,30,'date',true)];}
  if(phase==='size'){if(time<25000)return [];phase='sizeDone';return [snap(2,100,'size',true)];}
  if(phase==='sizeDone')return [snap(2,100,'size',true)];
  if(phase==='first'){const s=snap(1,100,'first',true);if(++polls<3)s.rows=rowset(2,100);return [s];}
 }
 return [];
};vm.runInContext('run=fakeRun;navigate=async()=>{};',ctx);
new Promise(resolve=>listener({type:'beginAll'},{url:'extension://index.html',tab:{id:2}},resolve)).then(r=>{assert(r.ok,r.error);assert(time>=25000);assert.equal(r.data.pageSize,100);assert.equal(r.data.rows.length,100);assert.equal(r.data.rows[0][0],'1');assert.equal(pageClicks,1);assert.deepEqual(log,['dateField','query','size','first']);console.log('通过：日期查询→每页刷新→首页串行；模拟25秒加载无14秒内层失败；旧行序号拒收；翻页只发起一次。');}).catch(e=>{console.error(e);process.exitCode=1;});
