// Chrome 不允许扩展目录里出现以 "_" 开头的文件/目录（报 Cannot load extension with file or directory name _xxx）。
// 这条检查防止临时脚本（_patch.cjs 之类）落在扩展目录里导致“加载解压缩的扩展”直接失败。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const bad=[];
(function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(ent.name==='.git'||ent.name==='node_modules')continue;
    const p=path.join(dir,ent.name);
    if(ent.name.startsWith('_'))bad.push(path.relative(root,p));
    if(ent.isDirectory())walk(p);
  }
})(root);

assert.deepEqual(bad,[],'扩展目录里不能有 "_" 开头的文件/目录（Chrome 会拒绝加载）：'+bad.join('、'));

// 打包脚本要排除 _*（防止临时文件混进 zip）
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
assert(/manifest\.json/.test(readme),'README 要说明根目录必须有 manifest.json');

console.log('通过：扩展目录没有 "_" 开头的文件/目录；打包会排除 _* 临时文件。');
