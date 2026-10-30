// 版本一致性：manifest / worker / 工作台校验串 / 侧栏文案 必须是同一个版本号，避免改了源码却漏改某处。
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=f=>fs.readFileSync(__dirname+'/../'+f,'utf8');
const manifest=JSON.parse(read('manifest.json'));
const version=manifest.version;
const worker=read('worker.js').match(/COMPONENT_VERSION = '([^']+)'/);
const live=read('live.js').match(/(?:component|c)\.version!=='([^']+)'/);
const html=read('index.html').match(/接入版 v([0-9.]+) · 提交核验版/);
assert(worker,'worker.js 缺少 COMPONENT_VERSION');
assert(live,'live.js 缺少版本校验串');
assert(html,'index.html 缺少版本文案');
assert.equal(worker[1],version,'worker 版本与 manifest 不一致');
assert.equal(live[1],version,'live.js 校验版本与 manifest 不一致');
assert.equal(html[1],version,'界面版本文案与 manifest 不一致');
assert.match(version,/^\d+\.\d+\.\d+$/,'版本号格式应为 x.y.z');
const probes=JSON.parse(read('manifest.json')).permissions.join(',');
assert.equal(probes,'activeTab,scripting,storage','权限不应扩大');
assert(/connect-src 'none'/.test(read('manifest.json')),'必须继续禁止扩展页外连');
console.log('通过：manifest、worker、live.js 校验串、侧栏文案版本一致（'+version+'），权限与禁止外连未变化。');
