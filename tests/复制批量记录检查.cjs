// 批量结束后「复制修改记录」：按钮在关闭旁边，把本次批量明细（含失败原因）复制到剪贴板，
// 制表符分隔，可直接粘进 Excel 或聊天窗口；没有记录时给出提示，不静默失败。
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const live=fs.readFileSync(__dirname+'/../live.js','utf8');

// 1) 按钮位置与文案
const actions=html.slice(html.indexOf('<div class="dialog-actions">'),html.indexOf('</div></form></dialog>'));
assert(/id="cancelChange"/.test(actions),'缺少取消按钮');
assert(/id="copyBatchRecords"/.test(actions),'复制按钮必须在弹窗按钮区');
assert(/复制修改信息/.test(actions),'按钮文字应为「复制修改信息」');
assert(!/导出修改记录/.test(actions),'不应再出现「导出修改记录」');
assert(/已复制到剪贴板/.test(live),'复制成功要有“已复制到剪贴板”的交互反馈');
assert(actions.indexOf('cancelChange')<actions.indexOf('copyBatchRecords'),'复制按钮要排在「取消/关闭」后面');
assert(actions.indexOf('copyBatchRecords')<actions.indexOf('type="submit"'),'复制按钮要在「提交修改」前面');

// 2) 数据来源：本批次的行对象
assert(/let lastBatch=null;/.test(live),'lastBatch 必须在模块作用域');
assert(/audit\.push\(row\);batchRows\.push\(row\);/.test(live),'每单都要收进本批次集合');
assert(/lastBatch=\{rows:batchRows/.test(live),'批次结束要留存本批次记录');

// 3) 写剪贴板：优先 clipboard API，失败要有兜底
assert(/\$\('copyBatchRecords'\)\.onclick=/.test(live),'必须绑定复制点击');
assert(/navigator\.clipboard\.writeText\(text\)/.test(live),'应写入剪贴板而不是下载文件');
assert(!/createSimpleWorkbook\(body,'本次修改记录'\)/.test(live),'不应再生成 Excel 文件');
assert(/execCommand\('copy'\)/.test(live),'剪贴板不可用时要有兜底');

// 4) 内容：制表符分隔 + 汇总行 + 逐单明细（含失败原因）
assert(/head\.join\('\\t'\)/.test(live),'表头应用制表符分隔，便于粘进 Excel');
assert(/批量修改记录/.test(live)&&/成功 '\+lastBatch\.doneCount/.test(live),'应带批次汇总');
for(const col of ['单号','寄件人','收件人','目标状态','原状态','结果','失败原因']){
  assert(new RegExp("'"+col+"'").test(live),'表头缺少「'+col+'」');
}

// 5) 空数据提示
assert(/本次还没有可复制的修改记录/.test(live),'无数据时要提示');
console.log('通过：批量结束后可在「关闭」旁复制本次逐单明细，复制后按钮给出“已复制到剪贴板”反馈。');
