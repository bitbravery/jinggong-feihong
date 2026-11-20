// v1.0.31：导出取送件清单。执行 pickup.js / export.js 原文；live.js 只查接线。
const assert=require('node:assert/strict'),fs=require('node:fs');
const D=__dirname+'/../';
const P=require(D+'pickup.js'),X=require(D+'export.js'),F=require(D+'logic.js');
const o=(id,from,b,r,sender,pid,to,db,dr,recv,st='已揽件')=>({id,fromCampus:from,building:b,room:r,sender,personId:pid,phone:'1',toCampus:to,destinationBuilding:db,destinationRoom:dr,receiver:recv,receiverPhone:'2',item:'文件',status:st});
const list=[
 o('A1','良乡','信创楼A','856A','张老师','7220250082','中关村','中心教学楼','209','罗老师'),
 o('A2','中关村','求是楼','418','郭老师','7220250055','良乡','前沿交叉学科大楼','409','宋老师'),
 o('A3','中关村','师生服务大厅','1','翟同学','3220255512','良乡','文萃楼A','907','陈老师'),
 o('A4','良乡','文萃楼A','10','王同学','1120200001','中关村','主楼','101','赵老师'),
 o('A5','良乡','文萃楼A','2','钱老师','6120200002','中关村','主楼','102','孙老师'),
 o('A6','中关村','主楼','1','某老师','6120200003','中关村','主楼','2','某某'), // 与良乡无关
];
const mappings={'信创楼':'东南校区','文萃楼':'北校区','前沿交叉学科大楼':'东校区'};
const lines=m=>m.rows.filter(r=>r.kind).map(r=>r.cells.map(c=>c.v));
// 取送件优先：先全部送件、再全部取件，中间隔开；每段内按 区域 → 楼宇 → 房间（数字大小）
{
 const m=P.build(list,{campus:'良乡',mode:'type',mappings,api:F,now:'t'});
 assert.deepEqual(m.counts,{send:2,take:3});assert.deepEqual(m.skipped,['A6']);
 const L=lines(m);
 assert.deepEqual(L.map(r=>r[11]),['A3','A2','A5','A4','A1'],'顺序不对：'+L.map(r=>r[11]));
 assert.deepEqual(L.map(r=>r[1]),['▼ 送件','▼ 送件','▲ 取件','▲ 取件','▲ 取件']);
 assert.deepEqual(L.map(r=>r[0]),['1','2','3','4','5'],'序号连续');
 const kinds=m.rows.map(r=>r.cells[0].s);
 assert(kinds.indexOf('sendSection')<kinds.indexOf('gap')&&kinds.indexOf('gap')<kinds.indexOf('takeSection'),'送件段在上、取件段在下、中间隔开');
 // 取件：人在寄件地址，“寄给谁”；送件：人在收件地址，“谁寄来”
 const take=L.find(r=>r[11]==='A1'),send=L.find(r=>r[11]==='A2');
 assert.deepEqual([take[2],take[3],take[4],take[5],take[7]],['东南校区','信创楼A','856A','张老师','7220250082']);
 assert(/^寄给 罗老师（中关村·中心教学楼 209）/.test(take[9]));
 assert.deepEqual([send[2],send[3],send[4],send[5]],['东校区','前沿交叉学科大楼','409','宋老师']);
 assert(/^郭老师 寄来（中关村·求是楼 418）/.test(send[9]));
 // 学生也导出，标“学生”且用醒目样式
 const stu=m.rows.find(r=>r.cells[11]&&r.cells[11].v==='A4');
 assert.equal(stu.cells[6].v,'学生');assert.equal(stu.cells[6].s,'takeStudent');
 assert.equal(stu.cells[1].s,'takeBadge');assert.equal(m.rows.find(r=>r.cells[11]&&r.cells[11].v==='A3').cells[1].s,'sendBadge');
 assert(m.rows.some(r=>r.merge&&/北校区 · 文萃楼A　　取 2/.test(r.cells[0].v)),'每栋楼前要有小标题');
 assert(!m.rows.some(r=>/送到收件人|到寄件人/.test(r.cells[0].v)),'标题和分段行不要再写“送到收件人/到寄件人处取”的解释');
 console.log('通过：取送件优先——送件在上、取件在下、中间隔开；按区域/楼宇/房间排；取件看寄件人、送件看收件人；学生照样导出并醒目标注。');
}
// 楼宇优先：混排，同一栋楼的取送放在一起
{
 const m=P.build(list,{campus:'良乡',mode:'building',mappings,api:F,now:'t'});
 const L=lines(m);
 assert.deepEqual(L.map(r=>r[11]),['A5','A4','A3','A2','A1'],'楼宇优先顺序不对：'+L.map(r=>r[11]));
 assert(!m.rows.some(r=>['sendSection','takeSection'].includes(r.cells[0].s)),'楼宇优先不分段');
 assert(m.rows.some(r=>r.merge&&/北校区 · 文萃楼A　　送 1 · 取 2/.test(r.cells[0].v)),'楼宇小标题要写清送几取几');
 console.log('通过：楼宇优先——按区域 → 楼宇 → 房间混排，同栋楼的取件送件挨在一起，小标题写明送几取几。');
}
// 中关村窗口：方向反过来
{
 const m=P.build(list,{campus:'中关村',mode:'type',mappings,api:F,now:'t'});
 assert.deepEqual(m.counts,{send:3,take:3});
 const L=lines(m);assert.equal(L.find(r=>r[11]==='A1')[1],'▼ 送件');assert.equal(L.find(r=>r[11]==='A1')[2],'中关村');
 console.log('通过：中关村窗口取送方向随之反过来，区域列写“中关村”。');
}
// xlsx：样式名都有定义；合并行、冻结表头、A4 横向
{
 const m=P.build(list,{campus:'良乡',mode:'type',mappings,api:F,now:'t'});
 const buf=Buffer.from(X.styledWorkbook(m)),s=buf.toString('latin1');
 assert(s.includes('<mergeCells count='),'要有合并行');assert(s.includes('state="frozen"'),'冻结表头');assert(s.includes('orientation="landscape"'));
 const exp=fs.readFileSync(D+'export.js','utf8');
 for(const r of m.rows)for(const c of r.cells)assert(exp.includes("['"+c.s+"',"),'样式 '+c.s+' 没有定义');
 assert(/'FF2F6FB5'/.test(exp)&&/'FFDD7414'/.test(exp),'送件蓝、取件橙');
 console.log('通过：清单 Excel 有合并标题行、冻结表头、A4 横向，取送件颜色样式齐全。');
}
// 工作台接线
{
 const html=fs.readFileSync(D+'index.html','utf8'),live=fs.readFileSync(D+'live.js','utf8');
 assert(/id="batchChange"[^>]*>批量改状态<\/button><button id="exportPickup"[^>]*>导出取送件<\/button>/.test(html),'“导出取送件”紧挨在“批量改状态”右边');
 assert(html.indexOf('pickup.js')>0&&html.indexOf('pickup.js')<html.indexOf('live.js'),'pickup.js 要在 live.js 之前加载');
 assert(/data-mode="type"[\s\S]*取送件优先[\s\S]*data-mode="building"[\s\S]*楼宇优先/.test(html),'导出时可选两种排法');
 assert(/\$\('exportPickup'\)\.hidden=isTodo/.test(live),'待办里（批量通过/退回）不显示');
 assert(/FeiHongPickup\.build\(list,\{campus,mode,mappings,api:FeiHong,now\}\)/.test(live));
 console.log('通过：勾选后“批量改状态”右边出现“导出取送件”，可选取送件优先 / 楼宇优先。');
}
