// v0.9.216：侧栏「打开原站标准页面」按钮 + 后台编排
// 用户 2026-11-02 定：第0步先关掉原站其他标签（正在保存的调整单先等它存完），
// 再从工作台依次打开【流程】、京工飞鸿两校快件系统、快件查询；最后关掉业务管理中心和业务包页。
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=f=>fs.readFileSync(__dirname+'/../'+f,'utf8');
const html=read('index.html'),live=read('live.js'),worker=read('worker.js'),source=read('source.js'),css=read('style.css');

// 1) 侧栏：删掉校区提示行，新增整行按钮（v0.9.220 起功能暂缓，按钮 hidden，后台代码保留）
assert(html.includes('id="openStandard"'),'侧栏要有“打开原站标准页面”按钮');
assert(html.includes('打开原站标准页面'),'按钮文字应是“打开原站标准页面”');
assert(/<button id="openStandard"[^>]*\bhidden\b/.test(html),'功能暂缓：按钮要先隐藏');
assert(!html.includes('campusHint'),'旧的“当前：…点击另一校区后确认”提示行要删掉');
assert(/#openStandard\{[^}]*width:100%/.test(css),'按钮要占整行');
assert(!live.includes('campusHint'),'live.js 不再更新已删除的提示行');

// 2) 工作台接线
assert(/async function openStandardPages\(\)/.test(live),'按钮要调用 openStandardPages');
assert(live.includes("type:'openStandardPages'"),'消息类型应为 openStandardPages');
assert(live.includes("m.type==='standardStage'"),'后台进度要能显示到工作台');
assert(/standardBusy/.test(live),'要有防重复点击标记');
assert(live.includes('原站标准页面已打开'),'成功要有提示');

// 3) 后台编排
assert(/PORTAL_OPS=new Set\(\['openStandardPages'/.test(worker),'openStandardPages 必须进串行队列 PORTAL_OPS');
assert(/async function openStandardPages\(returnTabId\)/.test(worker),'后台要有编排函数');
assert(/portal\.forms>0[\s\S]{0,400}90000/.test(worker),'正在保存的调整单要先等它存完（上限 90 秒）');
assert(worker.includes("type:'tabCloseAll',keep:'工作台'"),'第 0 步关掉其他标签、只留工作台');
assert(worker.includes('90 秒内没有保存完'),'等调整单超时要停止并提示');
assert(worker.includes('activatePortalTab'),'切标签后要确认真的切到前台再操作');
assert(worker.includes('chrome.tabs.update(sourceTabId,{active:true})'),'自动化期间原站标签要切到前台（下方区块是滚动懒加载）');
assert(worker.includes('returnTabId'),'结束后要切回工作台');
assert(worker.includes('scrollWorkbench'),'点“我的服务/业务管理中心”前要先滚动到该区块');
assert(worker.includes("standardClick({type:'workbenchOpenFlow'}"),'【流程】要按“我的待办 → 待办数字”打开');
assert(worker.includes("standardClick({type:'workbenchOpenService'}"),'系统页要按“我的服务 → 京工飞鸿两…”打开');
assert(worker.includes("standardClick({type:'workbenchOpenBusinessCenter'}"),'业务管理中心入口');
assert(worker.includes("standardClick({type:'centerOpenPackage'}"),'业务包卡片入口');
assert(worker.includes("standardClick({type:'packageOpenQuery'}"),'业务包里的快件查询入口');
assert(worker.includes('页面诊断'),'失败时要带每个页面的诊断信息');
assert(/STANDARD_TAB_TESTS=\[\/工作台\/,\/\^【流程】\$\/,\/\^快件查询\$\/,/.test(worker),'最终只认 工作台/【流程】/快件查询/系统 四个标签');
assert(worker.includes("for(const name of ['业务管理中心','京工飞鸿两校快件'])"),'最后要关掉两个临时标签');
assert(worker.includes('标准页面没有全部打开'),'缺标签要报错');
assert(worker.includes('计划外标签'),'多出计划外标签要报错');

// 4) 注入层：标签操作 + 页面点击动作 + 诊断
for(const t of ['tabs','tabClick','tabClose','tabCloseAll','scrollToText','workbenchOpenFlow','workbenchOpenService','workbenchOpenBusinessCenter','centerOpenPackage','packageOpenQuery','probeFrames'])
 assert(new RegExp("command\\.type==='"+t+"'").test(source),'source.js 缺少 '+t+' 动作');
assert(source.includes('寄件申请信息单'),'按“寄件申请信息单 → 待办数字”定位');
assert(source.includes('京工飞鸿'),'按“京工飞鸿”定位服务卡片');
assert(source.includes("title','alt','aria-label'"),'卡片文字被截断时也要认 title/alt/aria-label');
assert(source.includes('.mini-tab-close'),'要有标签关闭按钮选择器');
console.log('通过：侧栏按钮、前台执行、滚动懒加载、三个标准页面链路、收尾核对与失败诊断都在。');
