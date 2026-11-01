const fs=require('fs');
let s=fs.readFileSync('live.js','utf8');
const anchor="$('flowTools').hidden=!flow;$('overview').hidden=flow;";
if(!s.includes(anchor))throw Error('未找到 flowTools 行');
if(!s.includes("$('flowPagesWrap').hidden=!flow")){
  s=s.replace(anchor,"$('flowTools').hidden=!flow;$('flowPagesWrap').hidden=!flow;$('overview').hidden=flow;");
  fs.writeFileSync('live.js',s,'utf8');
  console.log('已让“读取前 N 页”只在流程页显示');
}
