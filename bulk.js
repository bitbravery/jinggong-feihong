(function(root){
 async function scanAll({request,onProgress=()=>{},isCancelled=()=>false,range}){
  let combined;
  const fail=message=>{const e=Error(message);e.partial=combined;throw e;};
  const checkCancel=()=>{if(isCancelled())fail('已停止读取；当前批次未完成。');};
  try{
   checkCancel();const first=await request({type:'beginAll',range});
   if(!Number.isInteger(first.total)||first.total<0||!first.pageSize||first.page!==1)fail('无法确认全部查询的总数、每页条数或首页，停止读取。');
   const pages=Math.max(1,Math.ceil(first.total/first.pageSize)),headers=JSON.stringify(first.headers),firstSignature=JSON.stringify(first.rows);
   combined={...first,rows:[],rowIds:[],bulk:true,complete:false,pagesRead:0,pageCount:pages,startedAt:new Date().toISOString(),scope:'全部物流状态，正在逐页读取'};
   const add=(s,page)=>{
    if(s.page!==page||s.total!==first.total||s.pageSize!==first.pageSize||JSON.stringify(s.headers)!==headers)fail('原站页码、总数或表头在读取期间发生变化；本批次不完整，请重新读取。');
    const expected=Math.max(0,Math.min(first.pageSize,first.total-(page-1)*first.pageSize));
    if(s.rows.length!==expected)fail('原站第 '+page+' 页行数与分页范围不符，停止读取。');
    if(first.dateRange){
     const dateColumn=s.headers.findIndex(h=>h.replace(/\s/g,'')==='下单时间');
     const badAt=dateColumn<0?-1:s.rows.findIndex(r=>{const day=String(r[dateColumn]||'').slice(0,10);return !/^\d{4}-\d{2}-\d{2}$/.test(day)||day<first.dateRange.from||day>=first.dateRange.endExclusive;});
     if(dateColumn<0)fail('原站返回了日期范围之外或日期不明的记录（第 '+page+' 页没有“下单时间”列），停止读取；未把范围外数据混入本批次。');
     if(badAt>=0){
      // 写明是哪一条，便于判断原因；判断与停止读取的行为不变
      const idColumn=s.headers.findIndex(h=>h.replace(/\s/g,'')==='单号'),bad=s.rows[badAt];
      fail('原站返回了日期范围之外或日期不明的记录（第 '+page+' 页第 '+(badAt+1)+' 行，单号 '+(idColumn>=0?String(bad[idColumn]||'空'):'未知')+'，下单时间「'+String(bad[dateColumn]??'')+'」；读取范围 '+first.dateRange.from+' 至 '+first.dateRange.to+'），停止读取；未把范围外数据混入本批次。');
     }
    }
    const sequence=s.headers.findIndex(h=>h.replace(/\s/g,'')==='序号');
    if(sequence>=0&&s.rows.some((r,i)=>Number(r[sequence])!==(page-1)*first.pageSize+i+1))fail('原站行序号与当前页不一致，停止读取以免漏页或重复计数。');
    combined.rows.push(...s.rows);combined.rowIds.push(...s.rows.map((_,i)=>page+':'+(s.rowIds?.[i]||i)));combined.pagesRead=page;combined.readAt=s.readAt;
    onProgress({rowsRead:combined.rows.length,total:first.total,page,pages,partial:combined});
   };
   add(first,1);
   for(let p=2;p<=pages;p++){checkCancel();add(await request({type:'page',direction:'next'}),p);}
   checkCancel();onProgress({rowsRead:combined.rows.length,total:first.total,page:pages,pages,verifying:true,partial:combined});
   const lastCheck=await request({type:'page',direction:'first'});
   if(lastCheck.page!==1||lastCheck.total!==first.total||JSON.stringify(lastCheck.rows)!==firstSignature)fail('首尾核对发现原站数据已变化，本批次未认定完整，请重新读取。');
   if(combined.rows.length!==first.total)fail('累计行数与原站总数不同，未认定完整。');
   combined.complete=true;combined.scope='全部物流状态与所有页面；已完成页数、行数及首页复核';return combined;
  }catch(e){if(!e.partial&&combined)e.partial=combined;throw e;}
 }
  const flowDay=v=>{const m=String(v||'').match(/(\d{4})\D{1,3}(\d{1,2})\D{1,3}(\d{1,2})/);return m?(m[1]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[3]).padStart(2,'0')):'';};
 async function scanFlows({request,onProgress=()=>{},isCancelled=()=>false,pages=5,tabs=['待办','已办','抄送给我']}){
  const parts=[];
  const limit=Math.max(1,Math.min(50,Number(pages)||5));
  const stop=()=>{const e=Error('已停止读取流程；已读完的分类保留。');e.partial=parts;throw e;};
  for(const tab of tabs){
   if(isCancelled())stop();
   onProgress({tab,phase:'switch'});
   const first=await request({type:'flowFirst',flowTab:tab});
   const rows=[...first.rows],rowIds=[...(first.rowIds||[]).map(id=>tab+':1:'+id)];
   // 原站显示了总条数且已读够，就不再点“下一页”（例如待办共 8 条、只有 1 页）
   const readAll=s=>Number.isInteger(s&&s.total)&&s.total>=0&&rows.length>=s.total;
   let pagesRead=1,atEnd=!!first.atEnd||first.next===false||readAll(first);
   onProgress({tab,rowsRead:rows.length,total:first.total===undefined?null:first.total,page:1,pages:limit,pageSize:first.pageSize||null,limited:true});
   while(!atEnd&&pagesRead<limit){
    if(isCancelled())stop();
    let next;
    try{next=await request({type:'flowNextPage',flowTab:tab});}
    catch(err){if(/没有变化|不可用/.test(err.message))break;throw err;}
    if(next.atEnd)break;
    if(next.stale)break;
    pagesRead++;
    rows.push(...next.rows);rowIds.push(...(next.rowIds||[]).map(id=>tab+':'+pagesRead+':'+id));
    onProgress({tab,rowsRead:rows.length,total:next.total===undefined?null:next.total,page:pagesRead,pages:limit,pageSize:first.pageSize||null,limited:true});
    if(readAll(next))break;
   }
   parts.push({...first,rows,rowIds,page:1,bulk:true,complete:true,pagesRead,pageCount:pagesRead,flowTab:tab,limited:true,limit});
  }
  return parts;
 }
 async function scanFlowsByDate({request,onProgress=()=>{},isCancelled=()=>false,pages=5,from,to}){
  const tabs=['待办','已办','抄送给我'],parts=[];
  const limit=Math.max(1,Math.min(50,Number(pages)||5));
  const stop=()=>{const e=Error('已停止读取流程；已读完的分类保留。');e.partial=parts;throw e;};
  for(const tab of tabs){
   if(isCancelled())stop();
   onProgress({tab,phase:'switch'});
   await request({type:'flowFirst',flowTab:tab});
   const first=await request({type:'flowDate',from,to,flowTab:tab});
   const rows=[...first.rows],rowIds=[...(first.rowIds||[]).map(id=>tab+':1:'+id)];
   let pagesRead=1;
   onProgress({tab,rowsRead:rows.length,total:null,page:1,pages:limit,limited:true});
   while(pagesRead<limit){
    if(isCancelled())stop();
    let next;
    try{next=await request({type:'flowNextPage',flowTab:tab});}catch(err){if(/没有变化|不可用/.test(err.message))break;throw err;}
    if(next.atEnd)break;
    pagesRead++;
    rows.push(...next.rows);rowIds.push(...(next.rowIds||[]).map(id=>tab+':'+pagesRead+':'+id));
    onProgress({tab,rowsRead:rows.length,total:null,page:pagesRead,pages:limit,limited:true});
   }
   parts.push({...first,rows,rowIds,page:1,bulk:true,complete:true,pagesRead,pageCount:pagesRead,flowTab:tab,limited:true,limit});
  }
  return parts;
 }
 const api={scanAll,scanFlows,scanFlowsByDate};if(typeof module!=='undefined')module.exports=api;else root.FeiHongBulk=api;
})(typeof window!=='undefined'?window:globalThis);
