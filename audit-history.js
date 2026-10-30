(function(root){
 const key=h=>[h.iso,h.id,h.from,h.to,h.action].join('|');
 function prune(rows,now=new Date()){const cutoff=new Date(now);cutoff.setMonth(cutoff.getMonth()-1);return (Array.isArray(rows)?rows:[]).filter(h=>h&&h.iso&&!Number.isNaN(Date.parse(h.iso))&&new Date(h.iso)>=cutoff);}
 function merge(a,b){const out=new Map();for(const h of [...(a||[]),...(b||[])])out.set(key(h),h);return [...out.values()].sort((x,y)=>String(x.iso).localeCompare(String(y.iso)));}
 // 北京时间的日期（YYYY-MM-DD）；记录里的 iso 是国际标准时间，不能直接截前 10 位
 const beijingDay=iso=>{const d=new Date(iso||'');if(Number.isNaN(d.getTime()))return '';return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);};
 function dayKey(h){return beijingDay(h&&h.iso)||String(h&&h.time||'').slice(0,10);}
 function within(h,from,to){const day=beijingDay(h?.iso||'');if(!day)return false;return (!from||day>=from)&&(!to||day<=to);}
 // 结果分类：成功 / 失败 / 不明 / 中断（未提交） / 已取消
 const OUTCOME={ok:'成功',failed:'失败',unknown:'不明',interrupted:'中断未提交',cancelled:'已取消'};
 function outcome(h){
  const r=String(h&&h.result||'');
  if(/^已回读确认|^已确认提交|原站回读已核验/.test(r))return 'ok';
  if(/已取消/.test(r))return 'cancelled';
  if(/正在准备|尚未提交/.test(r))return 'interrupted';
  if(/不明|待核验|正在重试/.test(r))return 'unknown';
  if(/失败/.test(r))return 'failed';
  return 'unknown';
 }
 // 查过原站且与本次目标不一致（取不到的不算；已改回的不算）
 function mismatch(h){return !!(h&&h.currentStatus&&h.to&&!h.reverted&&!/^取不到/.test(h.currentStatus)&&h.currentStatus!==h.to);}
 // 「只看异常」：失败、不明、中断未提交，或查过原站发现与目标不符
 function needsAttention(h){const o=outcome(h);return o==='failed'||o==='unknown'||o==='interrupted'||mismatch(h);}
 function unresolved(rows){return (Array.isArray(rows)?rows:[]).filter(needsAttention);}
 // 能改回：确实提交过（成功或不明）且还没改回；没改成功的单原站状态没变，无需改回
 function canRevert(h){const o=outcome(h);return !!h&&!h.reverted&&(o==='ok'||o==='unknown');}
 function summary(list){const s={};for(const h of list||[]){const o=outcome(h);s[o]=(s[o]||0)+1;}return s;}
 function summaryText(list){const s=summary(list);return ['ok','failed','unknown','interrupted','cancelled'].filter(k=>s[k]).map(k=>OUTCOME[k]+' '+s[k]).join(' · ');}
 // 搜索：单号、寄/收件人、状态、结果、原因、失败原因、原站现态
 function matches(h,q,lookup){
  if(!q)return true;const k=lookup?lookup(h.id):null;
  return [h.id,h.from,h.to,h.reason,h.result,OUTCOME[outcome(h)],h.error,h.nameWarn,h.currentStatus,h.sender||k?.sender,h.receiver||k?.receiver,h.fromCampus||k?.fromCampus].filter(Boolean).join(' ').includes(q);
 }
 // 屏幕与导出共用同一套筛选：新的在前
 function filter(rows,{q='',from='',to='',onlyAttention=false}={},lookup){return [...(Array.isArray(rows)?rows:[])].reverse().filter(h=>h&&within(h,from,to)&&(!onlyAttention||needsAttention(h))&&matches(h,q,lookup));}
 const EXPORT_HEAD=['修改时间','单号','寄件人','收件人','寄件校区','原状态','目标状态','结果','结果详情','原站现为','查看原站时间','是否已改回','改回时间','原因','失败原因','姓名核对'];
 function exportRows(rows,lookup){return [EXPORT_HEAD,...(Array.isArray(rows)?rows:[]).map(h=>{const k=lookup?lookup(h.id):null;return [h.time||'',h.id||'',h.sender||k?.sender||'',h.receiver||k?.receiver||'',h.fromCampus||k?.fromCampus||'',h.from||'',h.to||'',OUTCOME[outcome(h)],h.result||'',h.currentStatus||'',h.checkedAt||'',h.reverted?'是':'',h.revertedAt||'',h.reason||'',h.error||'',h.nameWarn||''];})];}
 function csv(rows){const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const head=['修改时间','单号','寄件人','收件人','操作','原状态','新状态','结果','核验时间','原因','错误'];const body=(Array.isArray(rows)?rows:[]).map(h=>[h.time,h.id,h.sender||'',h.receiver||'',h.action,h.from,h.to,h.result,h.verifiedAt||'',h.reason||'',h.error||''].map(q).join(','));return '﻿'+[head.map(q).join(',')].concat(body).join('\r\n');}
 const api={prune,merge,within,dayKey,OUTCOME,outcome,mismatch,needsAttention,unresolved,canRevert,summary,summaryText,matches,filter,EXPORT_HEAD,exportRows,csv};if(typeof module!=='undefined')module.exports=api;else root.FeiHongAudit=api;
})(typeof window!=='undefined'?window:globalThis);
