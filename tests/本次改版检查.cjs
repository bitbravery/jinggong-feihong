// v0.9.185 六项改版：校区卡片相邻、打印 2:3+120%、状态点选、表格字号、历史重要提示、查询进度 k/n。
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=f=>fs.readFileSync(__dirname+'/../'+f,'utf8');
const html=read('index.html'),live=read('live.js'),css=read('style.css'),persp=read('perspective.js'),layout=read('table-layout.js');

// 1) 校区卡片：对方“发出/派送中”紧挨本校
assert(/key:'out-transit'/.test(persp)&&/key:'in-transit',label:other\+'发出\/派送中'/.test(persp),'对方“发出/派送中”卡片要存在且用新名称');
{
  const {columns}=require(__dirname+'/../perspective.js');
  for(const campus of ['良乡','中关村']){
    const cs=columns(campus),i=cs.findIndex(c=>c.key==='out-transit');
    assert.equal(cs[i+1].key,'in-transit','对方卡片必须紧跟本校“发出/派送中”');
    const other=campus==='良乡'?'中关村':'良乡';
    assert.equal(cs[i+1].label,other+'发出/派送中','对方卡片名称应为“对方+发出/派送中”');
  }
}

// 2) 打印：列宽 20/30/20/30（2:3），整体字号放大约 120%
assert(/\.pf-table col\.c1\{width:20%\}/.test(live)&&/col\.c2\{width:30%\}/.test(live),'打印列宽应为 20%/30%');
assert(/col\.c3\{width:20%\}/.test(live)&&/col\.c4\{width:30%\}/.test(live),'第二组列宽也应为 20%/30%');
assert(/font-size:19px/.test(live),'打印单元格字号应放大约 1.2 倍（19px）');
assert(/\.print-form \.pf-table col\.c1\{width:20%\}/.test(css),'预览列宽要与打印一致');
assert(!/col\.c1\{width:16%\}/.test(css),'预览不应残留旧的 16% 列宽');

// 3) 目标状态：五个点选而不是下拉
assert(/id="targetStatus" class="status-picker"/.test(html),'目标状态要改成点选容器');
assert(!/<select id="targetStatus"/.test(html),'不应再使用下拉选择目标状态');
assert(/initStatusPicker/.test(live)&&/type="radio" name="targetStatus"/.test(live),'要用单选项渲染五个状态');
assert(/dataset\.value\|\|''/.test(live),'提交时要读点选结果');
assert(/\.status-option:has\(input:checked\)/.test(css),'选中态要有样式');

// 4) 表格字号：密度左侧的新选择 + 自定义 + 持久化
assert(/id="tableFont"/.test(html)&&/id="tableFontCustom"/.test(html),'要有表格字号与自定义输入');
assert(html.indexOf('id="tableFont"')<html.indexOf('id="tableDensity"'),'字号选择应在密度左侧');
assert(/--table-fs/.test(css),'字号要通过 CSS 变量生效');
assert(/fontSel\.onchange/.test(layout)&&/applyFont/.test(layout),'字号切换要即时生效并保存');
assert(/font:fontSel\.value/.test(layout),'字号要写进本地保存');

// 5) 状态修改历史：重要提示（含开发说明与仓库地址）
assert(/id="tips"/.test(html),'重要提示要独立成一个栏目页');
assert((html.match(/data-view="/g)||[]).length===5,'侧栏应有 5 个栏目（新增重要提示）');
assert(/data-view="tips"/.test(html),'侧栏要有「重要提示」入口');
assert(!/historyNotice/.test(html),'重要提示不应再嵌在状态修改历史里');
assert(html.indexOf('id="tips"')<html.indexOf('id="settings"'),'重要提示放在设置之前');
assert(/值班必读/.test(html)&&/常见问题/.test(html),'提示里要有值班要点与常见问题');
assert(/这个工具是怎么来的/.test(html),'提示里要有开发说明');
assert(/github\.com\/bitbravery\/jinggong-feihong/.test(html),'提示里要有仓库地址');

// 6) 查询进度：查询中 k/n、排队中 m/n，每轮从 1 开始
assert(/historySeq=new Map\(\)/.test(live)&&/historyTotal=0/.test(live),'要有本轮序号与总数');
assert(/\('查询中 '\+sSeq\+'\/'\+historyTotal\)/.test(live),'运行中显示“查询中 k/n”');
assert(/\('排队中 '\+sSeq\+'\/'\+historyTotal\)/.test(live),'排队中显示“排队中 m/n”');
assert(/historySeq\.clear\(\)/.test(live)&&/historyTotal=0/.test(live),'一轮结束后序号复位');
console.log('通过：v0.9.185 六项改版（卡片相邻/打印 2:3+120%/状态点选/表格字号/历史提示/查询进度）。');
