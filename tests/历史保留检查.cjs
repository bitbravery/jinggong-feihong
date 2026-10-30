const assert=require('node:assert/strict'),A=require('../audit-history.js');
const now=new Date('2026-10-20T12:00:00+08:00'),old={iso:'2026-09-19T12:00:00+08:00',id:'OLD'},keep={iso:'2026-09-20T12:00:00+08:00',id:'KEEP'};
assert.deepEqual(A.prune([old,keep],now).map(x=>x.id),['KEEP']);assert.equal(A.merge([keep],[keep]).length,1);
assert(A.within(keep,'2026-09-20','2026-10-20'));assert(!A.within(keep,'2026-09-21','2026-10-20'));
assert(A.within({iso:'2026-10-20T16:30:00.000Z'},'2026-10-21','2026-10-21'));
console.log('通过：历史记录保留一个月、合并去重并按独立起止日期筛选。');
