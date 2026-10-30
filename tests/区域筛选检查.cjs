// 寄件区域筛选：区域来自「楼宇 → 区域」对照表；未配置时筛选不能静默变空，要说明原因并给出配置入口。
const assert=require('node:assert/strict'),fs=require('node:fs');
const {region}=require('../logic.js');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');

// 1) 对照表口径
const mappings={'文萃楼':'东校区','学生服务中心':'北校区'};
assert.equal(region({fromCampus:'良乡',building:'文萃楼'},mappings),'东校区','良乡：按楼宇取区域');
assert.equal(region({fromCampus:'良乡',building:'没配过的楼'},mappings),'区域待分配','未配置楼宇归“区域待分配”');
assert.equal(region({fromCampus:'中关村',building:'文萃楼'},mappings),'—','中关村寄件不参与区域');

// 2) 带字母/编号的房间自动归并到基础楼名（用户口径：文萃楼不按字母分开）
assert.equal(region({fromCampus:'良乡',building:'文萃楼A'},mappings),'东校区','文萃楼A 应归并到 文萃楼');
assert.equal(region({fromCampus:'良乡',building:'文萃楼J'},mappings),'东校区','文萃楼J 应归并到 文萃楼');

// 3) 标题与配置入口
assert(/<h2>楼宇 → 区域<\/h2>/.test(html),'设置页标题应为「楼宇 → 区域」');
assert(!/取件区域/.test(html),'不应再出现「取件区域」');
assert(/id="pendingBuildings"/.test(html),'设置页要有“待配置楼宇”区域');
assert(/function renderPendingBuildings\(\)/.test(live),'缺少待配置楼宇渲染');
assert(/data-assign=/.test(live),'待配置楼宇要能一键保存');

// 4) 空结果不能静默
assert(/function emptyRow\(\)/.test(live),'缺少空态说明');
assert(/对照表筛选/.test(live),'区域筛选为空时要说明依赖对照表');
assert(/\|\|emptyRow\(\)/.test(live),'空结果必须走 emptyRow');

// 5) 默认对照表：覆盖 2026-10-23 导出里的全部 27 个楼宇（含带字母的）
const defaults=require('../mappings-default.js').defaults;
const exported=['学生服务中心','工业生态楼','文萃楼A','文萃楼E','文萃楼J','信创楼A','徐特立图书馆','文萃楼C',
 '理学楼B','前沿交叉附属楼','行政楼','文萃楼L','至善园A','文萃楼K','丹枫园C','良乡校医院','生态楼B','理学楼A',
 '前沿交叉学科大楼','甘棠园A','文萃楼D','物理实验中心','生态楼C','静园C','文萃楼I','疏桐园B','工程实践训练中心'];
for(const b of exported){
  const z=region({fromCampus:'良乡',building:b},defaults);
  assert(z!=='区域待分配','默认对照表漏了 '+b);
  assert(['北校区','东校区','南校区','东南校区'].includes(z),b+' 的区域值非法：'+z);
}
for(const [k,v] of Object.entries(defaults))assert(['北校区','东校区','南校区','东南校区'].includes(v),k+' 的区域值非法：'+v);
assert(!Object.keys(defaults).some(k=>/[A-Za-z]$/.test(k)),'默认表只写基础楼名，不带字母后缀');

// 6) 用户口径逐条核对（2026-10-23 用户确认）
const expect={
 '文萃楼':'东校区','信创楼':'东南校区','甘棠园':'东校区','静园':'北校区','疏桐园':'南校区','至善园':'南校区',
 '丹枫园':'北校区','良乡校医院':'北校区','工程实践训练中心':'东南校区','工业生态楼':'南校区','理学楼':'南校区',
 '生态楼':'南校区','物理实验中心':'南校区','学生服务中心':'北校区','徐特立图书馆':'北校区','行政楼':'北校区'
};
for(const [k,v] of Object.entries(expect))assert.equal(defaults[k],v,'默认区不符合用户口径：'+k);

// 7) 合并逻辑：默认值不得覆盖用户配置
assert(/FeiHongDefaultMappings/.test(live),'live.js 必须合并默认对照表');
assert(/if\(!\(k in mappings\)\)mappings\[k\]=v/.test(live),'用户已配置的值必须优先于默认值');
assert(/region\(o,mappings\)==='区域待分配'/.test(live),'待配置楼宇应按 region() 结果判断');

console.log('通过：区域由楼宇对照表决定；带字母楼宇自动归并；默认表覆盖全部 27 个楼宇且不覆盖用户配置。');
