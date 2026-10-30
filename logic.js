(function (root) {
  const statuses = ['订单申请', '已揽件', '发出/派送中', '已送达', '已签收'];
  function identity(id) { const first = String(id || '').trim()[0]; return '135'.includes(first) ? '学生' : '679'.includes(first) ? '老师' : '身份待确认'; }
  const defaultOfficeKeywords=['办公','文萃','工业生态','宇航','求是','远志','前沿交叉','中心教学','中心数学','主楼'];
  function senderInfo(o,keywords=defaultOfficeKeywords){const service=/^京工[一二三四五六七八九十百零〇两0-9]+号$/.test(String(o.sender||'').trim()),label=service?'京工飞鸿':identity(o.personId),student=label==='学生',proxy=student&&!/学生服务中心|师生服务大厅/.test(o.building||'')&&keywords.some(k=>k&&(o.building||'').includes(k));return {label,kind:service?'service':student?'student':label==='老师'?'teacher':'unknown',proxy};}
  // 楼宇名兼容：先按完整名匹配，再去掉末尾的字母/编号（文萃楼A → 文萃楼、信创楼A → 信创楼）
  function buildingKey(name) {
    const key = String(name || '').trim();
    return key.replace(/[\s\-]*(?:[A-Za-z]|[0-9]+\s*号?)$/, '').trim();
  }
  function region(order, mappings) {
    if (order.fromCampus !== '良乡') return '—';
    const m = mappings || {};
    const key = String(order.building || '').trim();
    if (m[key]) return m[key];
    const base = buildingKey(key);
    if (base && base !== key && m[base]) return m[base];
    return '区域待分配';
  }
  function matches(o, filters, mappings) {
    const direction = o.fromCampus === '良乡' ? 'out' : 'in';
    return (filters.status === 'all' || o.status === filters.status) && (filters.direction === 'all' || direction === filters.direction) && (filters.identity === 'all' || (filters.identity==='疑似代老师下单'?senderInfo(o,filters.officeKeywords).proxy:senderInfo(o,filters.officeKeywords).label === filters.identity)) && (filters.region === 'all' || region(o, mappings) === filters.region) && [o.id, o.sender, o.receiver, o.personId, o.receiverId, o.phone, o.receiverPhone, o.building, o.destination, o.item].join(' ').toLowerCase().includes(filters.search.toLowerCase().trim());
  }
  const nameOrder=new Intl.Collator('zh-Hans-CN-u-co-pinyin',{numeric:true,sensitivity:'base'});
  function queryRows(rows,{day='',sender='',receiver='',sort='',descending=false}={}){
    const result=rows.filter(o=>(!day||String(o.time||'').slice(0,10)===day)&&(!sender||o.sender===sender)&&(!receiver||o.receiver===receiver));
    if(['time','sender','receiver'].includes(sort))result.sort((a,b)=>{const av=String(a[sort]||''),bv=String(b[sort]||'');return (sort==='time'?av.localeCompare(bv):nameOrder.compare(av,bv))*(descending?-1:1);});return result;
  }
  function orderTime(value){const s=String(value||'').trim().replace('T',' ');return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)?s.slice(0,16):s;}
  function formatTime(date) { return new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date); }
  const api = { statuses, identity, senderInfo, defaultOfficeKeywords, region, matches, formatTime, queryRows, orderTime };
  if (typeof module !== 'undefined') module.exports = api; else root.FeiHong = api;
})(typeof window !== 'undefined' ? window : globalThis);
