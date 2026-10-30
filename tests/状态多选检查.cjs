const assert=require('node:assert/strict');const {toggleColumns,matchesColumns}=require('../perspective.js');
let s=toggleColumns(new Set(['all']),'out-request');s=toggleColumns(s,'out-collected');assert.deepEqual([...s],['out-request','out-collected']);
assert(matchesColumns({fromCampus:'良乡',toCampus:'中关村',status:'订单申请'},'良乡',s));assert(matchesColumns({fromCampus:'良乡',toCampus:'中关村',status:'已揽件'},'良乡',s));assert(!matchesColumns({fromCampus:'良乡',toCampus:'中关村',status:'已签收'},'良乡',s));
s=toggleColumns(s,'all');assert.deepEqual([...s],['all']);s=toggleColumns(s,'in-arrived');s=toggleColumns(s,'in-arrived');assert.deepEqual([...s],['all']);
console.log('通过：状态多选并集、所有寄件与单项互斥、取消最后一项回到所有寄件。');

for(const campus of ['良乡','中关村'])for(const status of ['订单申请','已揽件','发出/派送中','已送达','已签收'])for(const fromCampus of ['良乡','中关村'])assert(matchesColumns({fromCampus,toCampus:fromCampus==='良乡'?'中关村':'良乡',status},campus,new Set(['both'])));
assert.deepEqual([...toggleColumns(new Set(['out-request','in-collected']),'both')],['both']);assert.deepEqual([...toggleColumns(new Set(['both']),'out-request')],['out-request']);console.log('通过：两校区所有件覆盖双向全部物流状态，并与单项标签互斥。');
