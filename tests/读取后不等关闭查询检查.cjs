// v1.0.21：自定义时段/近一个月读完后，列表马上显示，不再等原站「关闭查询」（endRead 要切标签、逐个点条件，可能好几秒）。
const assert=require('node:assert/strict'),fs=require('node:fs');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');
const start=live.indexOf("$('readAll').onclick=async()=>{");
const body=live.slice(start,live.indexOf('\n};',start));
assert(start>=0&&body.length>100,'找不到自定义时段读取入口');
const fin=body.slice(body.lastIndexOf(' finally{'));
assert(!/await request\(\{type:'endRead'\}\)/.test(body),'读完后不能 await endRead，否则列表要等关闭查询面板');
const endAt=fin.indexOf("request({type:'endRead'})"),busyAt=fin.indexOf('busy=false'),renderAt=fin.lastIndexOf('render();',endAt);
assert(endAt>0,'读完后仍要关闭原站查询面板');
assert(busyAt>=0&&busyAt<endAt,'先结束忙碌状态，再去关查询面板');
assert(renderAt>busyAt&&renderAt<endAt,'先重画列表，再去关查询面板');
assert(/request\(\{type:'endRead'\}\)\.then\([\s\S]{0,200}\(\)=>false\)/.test(fin),'关面板出错不能抛到外面');
assert(/if\(!closed\)toast\(/.test(fin),'没关上要提示用户');
assert(/首页复核 /.test(body)&&/逐页读取 /.test(body),'完成提示要分开写逐页读取与首页复核用时');
// 后台仍把 endRead 放进原站串行队列，后续原站操作会排在它后面，不会与关面板抢原站
const w=fs.readFileSync(__dirname+'/../worker.js','utf8');
assert(/PORTAL_OPS=new Set\(\[[^\]]*'endRead'/.test(w),'endRead 必须仍在原站串行队列里');
console.log('通过：读完先显示列表，关闭原站查询面板在后台排队进行；完成提示分开写读取与复核用时。');
