// v0.9.203：改状态弹窗精简——去掉“操作原因”行；“本次将提交 N 单”移到顶部说明；
// 目标状态行字号统一；提示精简为 3 条；列表变矮，尽量一屏放得下。
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const css=fs.readFileSync(__dirname+'/../style.css','utf8');

// 1) 操作原因行删除（仅保留隐藏字段供历史记录）
assert(!html.includes('id="reasonField"'),'操作原因那一行应删除');
assert(!/操作原因<input/.test(html),'不应再有可见的操作原因输入框');
assert(html.includes('<input type="hidden" id="changeReason">'),'保留隐藏字段，历史记录仍能存原因');

// 2) 本次将提交 N 单挪到顶部说明
const hint=html.indexOf('change-hint');
const count=html.indexOf('id="batchCount"');
const summary=html.indexOf('id="changeSummary"');
assert(hint>=0&&count>hint&&count<summary,'“本次将提交 N 单”要放在顶部说明里、列表之前');

// 3) 目标状态行字号一致
assert(/#changeForm \.status-picker-label\{font-size:13px/.test(css),'目标状态标签字号要与选项一致');
assert(/#changeForm \.status-option\{font-size:13px/.test(css),'五个状态字号为 13px');
assert(/#changeForm \.status-option\{font-size:13px;padding:9px 4px\}/.test(css),'状态单元格要收紧高度');

// 4) 提示精简 + 弹窗一屏
const ol=html.slice(html.indexOf('<ol class="dialog-rules compact">'),html.indexOf('</ol>',html.indexOf('<ol class="dialog-rules compact">')));
const rules=(ol.match(/<li>/g)||[]).length;
assert(rules<=3,'提示最多 3 条，当前 '+rules);
assert(/\.change-summary\{max-height:220px/.test(css),'核对列表恢复 220px；不再压矮');
assert(/#changeDialog\{max-height:none;padding:26px\}/.test(css),'弹窗恢复原内边距，不再限制高度');

console.log('通过：操作原因已删、单数移到顶部、目标状态字号统一、提示精简、弹窗尽量一屏。');
