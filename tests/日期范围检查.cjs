const assert=require('node:assert/strict');
const d=require('../date-range.js'),{recentMonth}=d;
assert.deepEqual(recentMonth(new Date('2026-10-19T12:00:00Z')),{from:'2026-09-19',to:'2026-10-19',endExclusive:'2026-10-20'});
assert.deepEqual(recentMonth(new Date('2026-01-01T00:00:00Z')),{from:'2025-12-01',to:'2026-01-01',endExclusive:'2026-01-02'});
assert.deepEqual(recentMonth(new Date('2026-04-30T00:00:00Z')),{from:'2026-03-30',to:'2026-04-30',endExclusive:'2026-05-01'});
assert.equal(recentMonth(new Date('2026-10-19T16:01:00Z')).to,'2026-10-20');
console.log('通过：北京时间、一个月滚动范围、跨年、月末截断及包含今天全天。');
assert.deepEqual(d.selected('2025-01-01','2026-10-20'),{from:'2025-01-01',to:'2026-10-20',endExclusive:'2026-10-21'});
assert.throws(()=>d.selected('2026-10-21','2026-10-20'));
console.log('通过：自定义起止日期及结束日全天边界。');

// 默认时段：自定义时段初始为“近两周（14 天，含今天）”，点“近一个月”才用一个月。
assert.deepEqual(d.recentDays(14,new Date('2026-10-23T06:00:00Z')),{from:'2026-10-10',to:'2026-10-23',endExclusive:'2026-10-24'});
assert.equal(d.recentDays(14,new Date('2026-01-05T02:00:00Z')).from,'2025-12-23');
const live=require('node:fs').readFileSync(__dirname+'/../live.js','utf8');
assert(/setDefaultRange\(\)/.test(live)&&/FeiHongDates\.recentDays\(14\)/.test(live),'自定义时段必须默认近两周');
assert(/function setRecentRange\(\)\{const r=FeiHongDates\.recentMonth\(\)/.test(live),'“近一个月”按钮仍用一个月');
assert(!/setDefaultRange\(\);\s*setRecentRange\(\);/.test(live),'初始化时不得再被“近一个月”覆盖');
console.log('通过：默认近两周（14 天），初始化不被覆盖，近一个月按钮不受影响。');
