(function(root){
 const statuses=['订单申请','已揽件','发出/派送中','已送达','已签收'];
 const aliases={id:['单号'],time:['下单时间'],status:['物流信息'],personId:['寄件人工号'],sender:['寄件人姓名'],phone:['寄件人电话'],fromCampus:['寄件校区地址'],building:['寄件宇楼地址','寄件地址楼宇'],room:['寄件房间号地址','寄件房间号地址'],item:['寄件物品信息'],receiver:['收件人姓名'],receiverPhone:['收件人电话'],toCampus:['收件校区地址'],destinationBuilding:['收件地址宇楼','收件地址楼宇'],destinationRoom:['收件地址房间号'],workflowState:['状态'],processedAt:['处理时间'],processor:['处理人']};
 function normalize(snapshot){
   const headers=snapshot.headers.map(s=>s.replace(/\s/g,''));const idx={};
   for(const [key,names] of Object.entries(aliases))idx[key]=headers.findIndex(h=>names.includes(h));
   const required=['id','status','sender','personId','fromCampus','receiver','toCampus'];
   const missing=required.filter(k=>idx[k]<0);if(missing.length)throw Error('原站表头缺少必要字段：'+missing.join('、')+'；已停止映射。');
   const result=snapshot.rows.map((cells,rowIndex)=>{
     const o={};for(const [key,n]of Object.entries(idx))o[key]=n<0?'':String(cells[n]??'').trim();
     if(!/^JGKD\d+$/.test(o.id))throw Error('发现无法识别的原站单号，已停止读取。');
     if(!statuses.includes(o.status))throw Error('未知物流状态：'+o.status+'，已停止读取。');
     o.destination=[o.destinationBuilding,o.destinationRoom].filter(Boolean).join(' ');
     // The source exposes no recipient student/employee ID; never synthesize one.
     o.receiverId='';o.flow=snapshot.kind==='query'?'未读取流程':snapshot.flowTab;o.history=[];o.sourceKind=snapshot.kind;o.readAt=snapshot.readAt;
     o.sourceSequence=headers.includes('序号')?String(cells[headers.indexOf('序号')]??''):String(rowIndex+1);
     o.recordKey=[snapshot.kind,snapshot.page||1,snapshot.rowIds?.[rowIndex]||rowIndex].join(':');
     return o;
   });
   const groups=new Map();for(const o of result){if(!groups.has(o.id))groups.set(o.id,[]);groups.get(o.id).push(o);}
   for(const group of groups.values())for(const o of group){
     o.duplicateCount=group.length;o.duplicateOrder=group.length>1;
     o.duplicateConflict=group.length>1&&group.some(other=>fingerprint(other)!==fingerprint(o)||other.status!==o.status||other.time!==o.time||other.item!==o.item);
   }
   return result;
 }
 function fingerprint(o){return JSON.stringify([o.id,o.sender,o.personId,o.phone,o.fromCampus,o.building,o.room,o.receiver,o.receiverPhone,o.toCampus,o.destinationBuilding,o.destinationRoom]);}
 const api={statuses,normalize,fingerprint};if(typeof module!=='undefined')module.exports=api;else root.SourceMapping=api;
})(typeof window!=='undefined'?window:globalThis);
