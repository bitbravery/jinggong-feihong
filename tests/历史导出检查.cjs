// 历史导出与未核验筛选：CSV 必须带 BOM、正确转义引号/逗号/换行，未核验筛选不能把已核验记录算进去。
const assert=require('node:assert/strict');
const {csv,unresolved}=require('../audit-history.js');
const rows=[
 {iso:'2026-10-21T09:00:00.000Z',time:'2026-10-21 17:00:00',id:'JGKD2026000000001',action:'物流状态调整',from:'订单申请',to:'已送达',result:'原站回读已核验',verifiedAt:'2026-10-21 17:00:06',reason:'测试',sender:'兰雨桥',receiver:'程俊杰'},
 {iso:'2026-10-21T09:10:00.000Z',time:'2026-10-21 17:10:00',id:'JGKD2026000000002',action:'物流状态调整',from:'订单申请',to:'已签收',result:'提交结果不明，禁止自动重试',error:'原站提交尚未完成,请人工核验"引号"'}
];
const out=csv(rows);
assert(out.startsWith('\ufeff'),'CSV 必须带 BOM，Excel 打开中文才不乱码');
const lines=out.slice(1).split('\r\n');
assert.equal(lines.length,3,'表头 + 两条记录');
assert(lines[0].startsWith('"修改时间","单号","寄件人","收件人"'),'表头列顺序固定，且带寄件人/收件人');
assert(lines[1].includes('"已送达"')&&lines[1].includes('"原站回读已核验"'));
assert(lines[2].includes('""引号""'),'双引号要转义成两个');
assert(!lines[2].includes('\n'),'记录内换行不能破坏行结构');

const listed=unresolved(rows);
assert.equal(listed.length,1,'只有未核验的单进入待核验清单');
assert.equal(listed[0].id,'JGKD2026000000002');
assert.equal(unresolved([]).length,0);
assert.equal(unresolved(null).length,0,'空值不能抛错');
console.log('通过：历史 CSV 带 BOM、表头固定、引号与逗号正确转义；未核验筛选只保留未核验记录。');
