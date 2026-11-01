// v0.9.215：侧栏「打开原站标准页面」按钮 + 后台编排
// 流程（用户 2026-11-02 定）：先把原站别的标签关掉（正在保存的调整单先等它存完），
// 再从工作台依次打开【流程】、京工飞鸿两校快件系统、快件查询；最后关掉业务管理中心和业务包页。
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=f=>fs.readFileSync(__dirname+'/../'+f,'utf8');
const html=read('index.html'),live=read('live.js'),worker=read('worker.js'),source=read('source.js'),css=read('style.css');

// 1) 侧栏：删掉校区提示行，新增整行按钮
assert(html.includes('id="openStandard"'),'侧栏要有“打开原站标准页面”按钮');
assert(html.includes('打开原站标准页面'),'按钮文字应是“打开原站标准页面”');
assert(!html.includes('campusHint'),'旧的“当前：…点击另一校区后确认”提示行要删掉');
assert(/#openStandard\{[^}]*width:100%/.test(css),'按钮要占整行');
assert(!live.includes('campusHint'),'live.js 不再更新已删除的提示行');

// 2) 工作台接线
assert(/async function openStandardPages\(\)/.test(live),'按钮要调用 openStandardPages');
assert(live.includes("type:'openStandardPages'"),'消息类型应为 openStandardPages');
assert(live.includes("m.type==='standardStage'"),'后台进度要能显示到工作台');
assert(/standardBusy/.test(live),'要有防重复点击标记');
assert(live.includes('原站标准页面已打开'),'成功要有提示');

// 3) 后台：串行 + 第 0 步 + 三个标准页面
assert(/PORTAL_OPS=new Set\(\['openStandardPages'/.test(worker),'openStandardPages 必须进串行队列 PORTAL_OPS');
assert(/async function openStandardPages\(\)/.test(worker),'后台要有编排函数');
assert(/portal\.forms>0[\s\S]{0,400}90000/.test(worker),'正在保存的调整单要先等它存完（上限 90 秒）');
assert(worker.includes("type:'tabCloseAll',keep:'工作台'"),'第 0 步关掉其他标签、只留工作台');
assert(worker.includes('90 秒内没有保存完'),'等调整单超时要停止并提示');
assert(worker.includes("waitSource({type:'workbenchOpenFlow'},'clicked'"),'【流程】要按“我的待办 → 待办数字”打开');
assert(worker.includes("waitSource({type:'workbenchOpenService'},'clicked'"),'系统页要按“我的服务 → 京工飞鸿两…”打开');
assert(worker.includes("waitSource({type:'workbenchOpenBusinessCenter'},'clicked'"),'业务管理中心入口');
assert(worker.includes("waitSource({type:'centerOpenPackage'},'clicked'"),'业务包卡片入口');
assert(worker.includes("waitSource({type:'packageOpenQuery'},'clicked'"),'业务包里的快件查询入口');
assert(/STANDARD_TAB_TESTS=\[\/工作台\/,\/\^【流程】\$\/,\/\^快件查询\$\/,/.test(worker),'最终只认 工作台/【流程】/快件查询/系统 四个标签');
assert(worker.includes("for(const name of ['业务管理中心','京工飞鸿两校快件'])"),'最后要关掉两个临时标签');
assert(worker.includes('标准页面没有全部打开'),'缺标签要报错');
assert(worker.includes('计划外标签'),'多出计划外标签要报错');
assert(worker.includes("clickPortalTab('快件查询')"),'完成后停在快件查询标签');

// 4) 注入层：标签操作 + 五个页面点击动作
for(const t of ['tabs','tabClick','tabClose','tabCloseAll','workbenchOpenFlow','workbenchOpenService','workbenchOpenBusinessCenter','centerOpenPackage','packageOpenQuery'])
 assert(new RegExp("command\\.type==='"+t+"'").test(source),'source.js 缺少 '+t+' 动作');
assert(source.includes('我的待办')&&source.includes('寄件申请信息单'),'按“寄件申请信息单 → 待办数字”定位');
assert(source.includes('我的服务'),'按“我的服务”定位系统入口');
assert(source.includes('业务包名称'),'业务管理中心页判断');
assert(source.includes('大厅服务'),'业务包页判断');
assert(source.includes('.mini-tab-close'),'要有标签关闭按钮选择器');
console.log('通过：侧栏按钮、进度显示、第0步关标签、三个标准页面打开链路与收尾核对都在。');
