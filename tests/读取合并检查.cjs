// v1.0.12：已有读取内容时，再点「读取当前页」要把本次页内容并入旧列表：
// 旧记录保留、没有的追加、同一条用原站新数据更新（按单号+寄收件指纹识别同一条）。
const assert=require('node:assert/strict'),fs=require('node:fs');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');

assert(live.includes('function mergeSnapshot(s)'),'要有“合并当前页”函数');
assert(/const key=o=>o\.id\+'\|'\+\(SourceMapping\.fingerprint/.test(live),'按单号+寄收件指纹识别同一条，避免把重复单号合并掉');
assert(/const oldRows=isFlow\?records\.flow\.filter\(o=>o\.flow===s\.flowTab\):records\[s\.kind\]/.test(live),'要区分流程分类和快件查询的旧数据');
assert(/if\(!oldRows\.length\)\{setSnapshot\(s\);return \{first:true/.test(live),'之前没有数据时按普通读取处理');
assert(live.includes('if(!prev){map.set(k,n);added++;}else{updated++;'),'新的追加、已有的更新');
assert(live.includes("history:prev.history||n.history,recordKey:prev.recordKey"),'保留旧记录的历史和操作标识');
assert(/const merged=\[\.\.\.map\.values\(\)\];/.test(live)&&/rows:merged,total:merged\.length,pageSize:null,merged:true/.test(live),'合并后列表与总数要更新，并关闭单页翻页');
assert(live.includes('原站当前页已合并：新增 '),'要提示本次新增多少条');
assert(live.includes('保留之前读取的旧记录'),'要提示旧记录保留');
assert(live.includes('const merge=mergeSnapshot(s)'),'读取当前页要调用合并，而不是直接替换');
assert(!/setSnapshot\(s\);Object\.assign\(readProgress/.test(live),'不能再整页替换旧列表');
console.log('通过：读取当前页会把新内容并入已有列表（保留旧的、追加新的、更新同一条）。');
