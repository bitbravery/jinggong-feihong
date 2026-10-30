// v0.9.182：工作区文本文件统一用 LF 换行（.gitattributes 固定）；混用 CRLF 会让按原文定位的修改脚本漏改。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
assert(/\*\s+text=auto\s+eol=lf/.test(fs.readFileSync(path.join(__dirname,'..','.gitattributes'),'utf8')),'.gitattributes 要写 * text=auto eol=lf');
const bad=[];
(function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name==='.git'||e.name==='node_modules'||e.name==='.analysis-deps')continue;const p=path.join(dir,e.name);
 if(e.isDirectory())walk(p);else if(/\.(js|cjs|html|css|json|md)$/i.test(e.name)&&fs.readFileSync(p,'utf8').includes('\r'))bad.push(path.relative(path.join(__dirname,'..'),p));}})(__dirname);
assert.deepEqual(bad,[],'这些文件含 CRLF：'+bad.join('、'));
console.log('通过：文本文件统一为 LF 换行。');
