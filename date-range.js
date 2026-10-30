(function(root){
 function recentMonth(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get=type=>Number(parts.find(p=>p.type===type).value),y=get('year'),m=get('month'),d=get('day');
  const month=m-1-1,last=new Date(Date.UTC(y,month+1,0)).getUTCDate();
  const iso=date=>date.toISOString().slice(0,10);
  return {from:iso(new Date(Date.UTC(y,month,Math.min(d,last)))),to:iso(new Date(Date.UTC(y,m-1,d))),endExclusive:iso(new Date(Date.UTC(y,m-1,d+1)))};
 }
 function recentDays(days,now=new Date()){
  const n=Math.max(1,Math.floor(Number(days)||14));
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get=type=>Number(parts.find(p=>p.type===type).value);
  const today=Date.UTC(get('year'),get('month')-1,get('day'));
  const iso=ms=>new Date(ms).toISOString().slice(0,10);
  return {from:iso(today-(n-1)*86400000),to:iso(today),endExclusive:iso(today+86400000)};
 }
 function selected(from,to){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(to||'')||from>to)throw Error('请选择有效的读取起止日期。');
  const end=new Date(to+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+1);
  return {from,to,endExclusive:end.toISOString().slice(0,10)};
 }
 const api={recentMonth,recentDays,selected};if(typeof module!=='undefined')module.exports=api;else root.FeiHongDates=api;
})(typeof window!=='undefined'?window:globalThis);
