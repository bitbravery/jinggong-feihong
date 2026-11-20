// v1.0.31：导出取送件清单——给去老师那里取件、送件的同学用（用户 2026-11-20 要求）。
// 以当前窗口校区为准：从本校区寄出的 = 取件（去寄件人那里取）；寄到本校区的 = 送件（送到收件人那里）。
// 两种排法，都是一张表：
//  type     取送件优先：上面一段全是送件，下面一段全是取件，中间隔开（两个人分开跑）
//  building 楼宇优先：按 区域 → 楼宇 → 房间 → 姓名 混排，取送件用颜色区分（一个人既取又送）
// 只生成表格模型（单元格文字 + 样式名 + 合并），写 xlsx 由 export.js 的 createStyledWorkbook 完成。
(function(root){
 const coll=new Intl.Collator('zh-Hans-CN-u-co-pinyin',{numeric:true,sensitivity:'base'});
 const s=v=>String(v??'').trim();
 const COLS=[
  ['序号',5],['取/送',7],['区域',8],['楼宇',15],['房间',8],['姓名',10],['身份',7],['学工号',11],['电话',13],
  ['寄给谁 / 谁寄来',28],['物品',12],['单号',20],['当前状态',11],['✓',4]
 ];
 // 取件：人在本校区寄件地址；送件：人在本校区收件地址
 function stop(o,campus,api){
  const out=o.fromCampus===campus,inn=o.toCampus===campus;
  if(!out&&!inn)return null;
  const kind=out?'取件':'送件'; // 同校区内互寄（极少）按取件处理：先要去取
  const label=x=>x==='身份待确认'?'':x;
  if(kind==='取件'){
   const info=api.senderInfo?api.senderInfo(o):{label:''};
   return {kind,campus,building:s(o.building),room:s(o.room),name:s(o.sender),who:label(info.label),pid:s(o.personId),phone:s(o.phone),
    other:'寄给 '+(s(o.receiver)||'（未填姓名）')+'（'+[s(o.toCampus),[s(o.destinationBuilding),s(o.destinationRoom)].filter(Boolean).join(' ')].filter(Boolean).join('·')+'）'+(s(o.receiverPhone)?' '+s(o.receiverPhone):'')};
  }
  // 原站快件查询不提供收件人学工号；收件人身份只能从姓名里的“老师/同学”粗略看出
  const rid=s(o.receiverId),who=rid&&api.identity?label(api.identity(rid)):/老师|教授/.test(s(o.receiver))?'老师':/同学/.test(s(o.receiver))?'学生':'';
  return {kind,campus,building:s(o.destinationBuilding),room:s(o.destinationRoom),name:s(o.receiver),who,pid:rid,phone:s(o.receiverPhone),
   other:(s(o.sender)||'（未填姓名）')+' 寄来（'+[s(o.fromCampus),[s(o.building),s(o.room)].filter(Boolean).join(' ')].filter(Boolean).join('·')+'）'+(s(o.phone)?' '+s(o.phone):'')};
 }
 function area(st,mappings,api){
  if(st.campus!=='良乡')return st.campus;
  const r=api.region?api.region({fromCampus:'良乡',building:st.building},mappings):'';
  return r&&r!=='—'?r:'区域待分配';
 }
 const AREA_ORDER=['北校区','东校区','南校区','东南校区','区域待分配'];
 const areaRank=a=>{const i=AREA_ORDER.indexOf(a);return i<0?0:i+1;};
 const byPlace=(a,b)=>areaRank(a.area)-areaRank(b.area)||coll.compare(a.area,b.area)||coll.compare(a.building||'~',b.building||'~')||coll.compare(a.room,b.room)||coll.compare(a.name,b.name)||coll.compare(a.id,b.id);
 function build(orders,{campus,mode='type',mappings={},api={},now=''}={}){
  const items=[],skipped=[];
  for(const o of orders||[]){
   const st=stop(o,campus,api);
   if(!st){skipped.push(o.id);continue;}
   st.id=s(o.id);st.item=s(o.item);st.status=s(o.status);st.area=area(st,mappings,api);
   items.push(st);
  }
  const send=items.filter(x=>x.kind==='送件').sort(byPlace),take=items.filter(x=>x.kind==='取件').sort(byPlace);
  const n=COLS.length,rows=[];
  const full=(text,style,ht)=>rows.push({merge:true,ht,cells:[{v:text,s:style},...Array(n-1).fill({v:'',s:style})]});
  const modeName=mode==='building'?'楼宇优先（一人既取又送）':'取送件优先（送件在上、取件在下）';
  full('京工飞鸿 · 取送件清单（'+campus+'窗口）','title',26);
  full('导出 '+now+'　｜　送件 '+send.length+' 件　·　取件 '+take.length+' 件　｜　排法：'+modeName,'subtitle',20);
  rows.push({header:true,ht:24,cells:COLS.map(c=>({v:c[0],s:'header'}))});
  let seq=0;
  const line=x=>{
   seq++;const t=x.kind==='送件'?'send':'take';
   rows.push({ht:30,kind:x.kind,cells:[
    {v:String(seq),s:t+'C'},{v:x.kind==='送件'?'▼ 送件':'▲ 取件',s:t+'Badge'},{v:x.area,s:t+'C'},{v:x.building,s:t+'B'},{v:x.room,s:t+'C'},
    {v:x.name,s:t+'B'},{v:x.who,s:x.who==='学生'?t+'Student':t+'C'},{v:x.pid,s:t+'C'},{v:x.phone,s:t},
    {v:x.other,s:t},{v:x.item,s:t},{v:x.id,s:t},{v:x.status,s:t+'C'},{v:'',s:t+'C'}]});
  };
  // 每栋楼前一行小标题：区域 · 楼宇　送 n · 取 m
  const groups=list=>{
   let key=null;
   for(const x of list){
    const k=x.area+'|'+x.building;
    if(k!==key){
     key=k;const same=list.filter(y=>y.area+'|'+y.building===k),ns=same.filter(y=>y.kind==='送件').length,nt=same.length-ns;
     full([x.area,x.building||'（楼宇未填）'].join(' · ')+'　　'+[ns?'送 '+ns:'',nt?'取 '+nt:''].filter(Boolean).join(' · '),'group',20);
    }
    line(x);
   }
  };
  if(mode==='building'){
   // 同一地点先送后取：手里的件先放下，再取新的
   groups([...send,...take].sort((a,b)=>byPlace(a,b)||(a.kind===b.kind?0:a.kind==='送件'?-1:1)));
  }else{
   if(send.length){full('▼ 送件 · '+send.length+' 件','sendSection',26);groups(send);}
   if(send.length&&take.length)rows.push({ht:14,cells:Array(n).fill({v:'',s:'gap'})});
   if(take.length){full('▲ 取件 · '+take.length+' 件','takeSection',26);groups(take);}
  }
  return {rows,widths:COLS.map(c=>c[1]),headerRow:3,counts:{send:send.length,take:take.length},skipped,items:items.length};
 }
 const api={build,COLS};
 if(typeof module!=='undefined')module.exports=api;else root.FeiHongPickup=api;
})(typeof window!=='undefined'?window:globalThis);
