const assert=require('node:assert/strict');
const {columns,includes}=require('../perspective.js');
const out={fromCampus:'良乡',toCampus:'中关村',status:'发出/派送中'};
const incoming={fromCampus:'中关村',toCampus:'良乡',status:'已送达'};
function match(o,campus,key){const c=columns(campus).find(c=>c.key===key);return includes(o,campus,c.side,c.status);}
assert(match(out,'良乡','out-transit'));assert(!match(out,'中关村','out-transit'));
assert(match(incoming,'良乡','in-arrived'));assert(!match(incoming,'中关村','in-arrived'));
assert(match({...incoming,status:'已签收'},'良乡','in-signed'));
assert(match(out,'良乡','all'));assert(!match(incoming,'良乡','all'));
for(const campus of ['良乡','中关村']){
 assert.deepEqual(columns(campus).filter(c=>c.key!=='both').slice(0,6).map(c=>c.label),[campus+'所有寄件',campus+'订单申请',campus+'已揽件',campus+'发出/派送中','已送达'+campus,campus+'已签收']);
 assert.equal(new Set(columns(campus).map(c=>c.key)).size,columns(campus).length);
}
console.log('通过：两校区六个栏目名称、所有寄件仅含本校寄出、送达/签收按收件校区。');

const all=columns('良乡');for(const label of ['中关村已揽件','中关村已发出','中关村已签收','东区已揽件','东区订单申请','已送达东区件'])assert(all.some(c=>c.label===label));
const {matchesColumn}=require('../perspective.js');const east=all.find(c=>c.key==='east-collected');assert(matchesColumn({fromCampus:'良乡',toCampus:'中关村',status:'已揽件',building:'文萃楼A'},'良乡',east));assert(!matchesColumn({fromCampus:'良乡',toCampus:'中关村',status:'已揽件',building:'学生服务中心'},'良乡',east));
console.log('通过：原站对方校区及东区快捷标签、地址字段及物流状态组合。');

// 东区不再只认“文萃”：配置为东校区的楼宇也要计入
const eastOrder={fromCampus:'良乡',toCampus:'中关村',status:'已揽件',building:'学生服务中心'};
assert(matchesColumn(eastOrder,'良乡',east,{'学生服务中心':'东校区'}),'映射为东校区的楼宇应算东区');
assert(!matchesColumn(eastOrder,'良乡',east,{'学生服务中心':'北校区'}),'映射为北校区的不算东区');
console.log('通过：东区栏目既认文萃楼宇，也认已配置为东校区的楼宇。');
