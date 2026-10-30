(function(root){
 function columns(campus){const other=campus==='良乡'?'中关村':'良乡';return [
  {key:'all',label:campus+'所有寄件',side:'out',status:'all'},
  {key:'both',label:'两校区所有件',side:'all',status:'all'},
  {key:'out-request',label:campus+'订单申请',side:'out',status:'订单申请'},
  {key:'out-collected',label:campus+'已揽件',side:'out',status:'已揽件'},
  {key:'out-transit',label:campus+'发出/派送中',side:'out',status:'发出/派送中'},
  {key:'in-arrived',label:'已送达'+campus,side:'in',status:'已送达'},
  {key:'in-signed',label:campus+'已签收',side:'in',status:'已签收'},
  {key:'in-collected',label:other+'已揽件',side:'in',status:'已揽件'},
  {key:'in-transit',label:other+'已发出',side:'in',status:'发出/派送中'},
  {key:'out-arrived',label:'已送达'+other,side:'out',status:'已送达'},
  {key:'out-signed',label:other+'已签收',side:'out',status:'已签收'},
  ...(campus==='良乡'?[{key:'east-collected',label:'东区已揽件',side:'out',status:'已揽件',building:'sender'},
  {key:'east-request',label:'东区订单申请',side:'out',status:'订单申请',building:'sender'},
  {key:'east-arrived',label:'已送达东区件',side:'in',status:'已送达',building:'receiver'}]:[])
 ];}
 function includes(o,campus,side='all',status='all'){
  const route=side==='out'?o.fromCampus===campus:side==='in'?o.toCampus===campus:o.fromCampus===campus||o.toCampus===campus;
  return route&&(status==='all'||o.status===status);
 }
 function toggleColumns(selected,key){const next=new Set(selected);if(key==='all'||key==='both')return new Set([key]);next.delete('all');next.delete('both');next.has(key)?next.delete(key):next.add(key);return next.size?next:new Set(['all']);}
 function matchesColumn(o,campus,c,mappings){
  if(!includes(o,campus,c.side,c.status))return false;
  if(!c.building)return true;
  // 东区既认楼宇名里的“文萃”，也认已在“楼宇与区域”里配置为东校区的楼宇，避免把东区锁死成单一楼宇。
  const text=String(c.building==='sender'?o.building:o.destinationBuilding);
  return text.includes('文萃')||!!(mappings&&mappings[text]==='东校区');
 }
 function matchesColumns(o,campus,selected,mappings){return columns(campus).some(c=>selected.has(c.key)&&matchesColumn(o,campus,c,mappings));}
 const api={columns,includes,toggleColumns,matchesColumns,matchesColumn};if(typeof module!=='undefined')module.exports=api;else root.CampusPerspective=api;
})(typeof window!=='undefined'?window:globalThis);
