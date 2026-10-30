// 批量闸门：不再强制输入单量，但提交前必须能把全部单号和状态摆出来（逐单可见），
// 写入策略仍只接受合法且不重复的 JGKD 单号。
const assert=require('node:assert/strict'),fs=require('node:fs');
const {allowed}=require('../write-policy.js');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');

assert(allowed([{id:'JGKD2026000000001'}]),'合法单号应允许');
assert(!allowed([{id:'JGKD2026000000001'},{id:'JGKD2026000000001'}]),'重复单号应拒绝');
assert(!allowed([{id:'BAD-1'}]),'非 JGKD 单号应拒绝');

assert(!/batchConfirm/.test(live),'已取消“输入单量”这一步，不应再引用 batchConfirm');
assert(!/needsBatchConfirm/.test(live),'提交时不应再走单量确认');
assert(/id="batchCount"/.test(fs.readFileSync(__dirname+'/../index.html','utf8')),'仍要显示本次将提交多少单');
assert(/data-row="'\+E\(o\.id\)\+'"/.test(live),'提交前必须逐单列出单号，便于人工核对');
assert(/data-state="'\+E\(o\.id\)\+'"/.test(live),'每单要有状态徽标，边改边显示');
console.log('通过：取消单量输入，但提交前逐单可见；写入策略仍只接受合法且不重复的单号。');
