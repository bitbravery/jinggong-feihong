// v1.0.13：所有读取都做加法——已有记录保留，新出现的追加，同一条用新数据更新（单号+寄收件指纹识别）
const assert=require('node:assert/strict'),fs=require('node:fs');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');

assert(live.includes('function mergeParsed(parsed,kind,flowTab,{replace=false}={})'),'要有统一的合并函数');
assert(/const key=o=>o\.id\+'\|'\+\(SourceMapping\.fingerprint/.test(live),'按单号+寄收件指纹识别同一条');
assert(/if\(isFlow\)records\.flow=\[\.\.\.others,\.\.\.rows\];else records\[kind\]=rows;/.test(live),'流程保留另一分类，查询保留旧数据');
assert(/function setSnapshotExtra\(s,\{singlePage=false\}=\{\}\)/.test(live),'快照统一走合并');
assert(live.includes('function setSnapshot(s){return setSnapshotExtra(s);}'),'普通读取（翻页、批量）也合并');
assert(live.includes('function mergeSnapshot(s){return setSnapshotExtra(s,{singlePage:true});}'),'读取当前页合并后关闭单页翻页');
assert(live.includes('const merge=mergeSnapshot(s)'),'读取当前页调用合并');
assert(live.includes("mergeParsed(fresh,'flow',flowTab,{replace:whole})"),'流程「读取前 N 页」也要并入旧数据（待办全部读完时整类替换）');
assert(live.includes("mergeParsed(e.partial.flatMap(p=>SourceMapping.normalize(p)),'flow',flowTab)"),'流程部分失败也要并入旧数据');
assert(live.includes('const m=setSnapshot(s)')&&live.includes('新增 '),'原站翻页也要提示新增/更新');
assert(live.includes('const mAll=setSnapshot(complete)'),'近一个月/自定义时段也要合并');
assert(live.includes('本次新增 '),'读取完成要提示新增条数');

