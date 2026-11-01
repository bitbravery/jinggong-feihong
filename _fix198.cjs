const fs=require('fs');
const p='tests/表单页激活检查.cjs';
let s=fs.readFileSync(p,'utf8');
s=s.replace(
"assert(/const norm=s=>String\\(s\\|\\|''\\)\\.replace\\(\\/\\\\\\\\s\\+\\/g,'')\\)/.test(src),'标签文字要先去空白再比');",
"assert(src.includes('const norm=s=>String(s||\\\\'\\\\').replace(/\\\\s+/g,\\\\'\\\\')'),'标签文字要先去空白再比');");
fs.writeFileSync(p,s,'utf8');
console.log('已改为字符串包含断言');
