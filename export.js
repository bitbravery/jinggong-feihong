// 手写 OOXML 工作簿：所有单元格都是文本，不含公式。
// 只导出一张「发车清单」：A4 横向一页宽排版（16 列，宽度按真实内容预设）。
(function(root){
 const enc=new TextEncoder();
 const xml=s=>String(s??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
 function zip(files){let offset=0;const parts=[],central=[];for(const [name,text] of Object.entries(files)){const n=enc.encode(name),data=enc.encode(text),check=crc(data),h=new Uint8Array(30+n.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,check,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);h.set(n,30);parts.push(h,data);const ch=new Uint8Array(46+n.length),cv=new DataView(ch.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint32(16,check,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);ch.set(n,46);central.push(ch);offset+=h.length+data.length;}const size=central.reduce((n,a)=>n+a.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);const all=[...parts,...central,end],out=new Uint8Array(offset+size+22);let pos=0;for(const a of all){out.set(a,pos);pos+=a.length;}return out;}

 const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 const colName=n=>{let s='';n+=1;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26);}return s;};

 // 发车清单：按真实数据量过宽度（序号/单号/时间/状态/寄件人三项/寄件地址三项/物品/收件人两项/收件地址三项）
 // v1.0.0：用户反馈“物品信息列偏宽、总宽不变”——物品 24→18，多出的宽度分给寄件/收件楼宇地址
 const PRINT_WIDTHS=[5,18,11,9,11,11,15,9,18,13,18,11,15,9,20,13];
 const PRINT_COLS=PRINT_WIDTHS.length;

 function sheetXml(rows,{widths=null,print=false}={}){
  const colXml=widths?`<cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`:'';
  const data=rows.map((row,i)=>{
   const r=i+1,style=i===0?1:2,ht=i===0?' ht="30" customHeight="1"':' ht="24" customHeight="1"';
   return `<row r="${r}"${ht}>${row.map((val,j)=>`<c r="${colName(j)}${r}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(val)}</t></is></c>`).join('')}</row>`;
  }).join('');
  const lastCol=colName(Math.max(0,(rows[0]||[]).length-1)),lastRow=Math.max(1,rows.length);
  const view=print
   ?`<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
   :`<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;
  const page=print
   ?`<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0" horizontalDpi="600" verticalDpi="600"/>`
   :'';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}" xmlns:r="${R}"><sheetPr>${print?'<pageSetUpPr fitToPage="1"/>':''}</sheetPr><dimension ref="A1:${lastCol}${lastRow}"/>${view}<sheetFormatPr defaultRowHeight="14.5"/>${colXml}<sheetData>${data}</sheetData>${page}</worksheet>`;
 }

 const STYLES=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NS}">`
  +`<fonts count="2"><font><sz val="9"/><name val="宋体"/><charset val="134"/></font><font><b/><sz val="9"/><name val="宋体"/><charset val="134"/></font></fonts>`
  +`<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF3F0"/><bgColor indexed="64"/></patternFill></fill></fills>`
  +`<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border></borders>`
  +`<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
  +`<cellXfs count="3">`
  +`<xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>`
  +`<xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`
  +`<xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`
  +`</cellXfs><cellStyles count="1"><cellStyle name="常规" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

 function workbook(rows){
  const header=rows[0]||[],body=rows.slice(1);
  const printRows=[header.slice(0,PRINT_COLS),...body.map(r=>r.slice(0,PRINT_COLS))];
  return zip({
   '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
    +'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    +'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    +'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
   '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
   'xl/workbook.xml':`<workbook xmlns="${NS}" xmlns:r="${R}"><sheets><sheet name="发车清单" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'发车清单'!$1:$1</definedName></definedNames></workbook>`,
   'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    +'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
   'xl/styles.xml':STYLES,
   'xl/worksheets/sheet1.xml':sheetXml(printRows,{widths:PRINT_WIDTHS,print:true})
  });
 }
 function simpleWorkbook(rows,title="状态修改历史"){
  const header=rows[0]||[];
  const widths=header.map((h,i)=>Math.min(28,Math.max(9,(rows.slice(1,60).reduce((m,r)=>Math.max(m,String(r[i]??'').length*1.6),String(h).length*2))+2)));
  return zip({
   '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
    +'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    +'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    +'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
   '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
   'xl/workbook.xml':`<workbook xmlns="${NS}" xmlns:r="${R}"><sheets><sheet name="${xml(title)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
   'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
   'xl/styles.xml':STYLES,
   'xl/worksheets/sheet1.xml':sheetXml(rows,{widths,print:true})
  });
 }
 // v1.0.31：带颜色的清单（取送件清单用）。model 来自 pickup.js：rows[{cells:[{v,s}],merge,ht}]，s 为下面 PICK_XF 里的样式名。
 // 送件＝蓝，取件＝橙：标记格用实底白字，整行铺同色浅底；“学生”用紫色加粗。
 const PICK_FONT='<name val="微软雅黑"/><charset val="134"/>';
 const PICK_STYLES=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NS}">`
  +`<fonts count="9">`
  +`<font><sz val="10"/>${PICK_FONT}</font>`
  +`<font><b/><sz val="10"/>${PICK_FONT}</font>`
  +`<font><b/><sz val="15"/><color rgb="FF14503F"/>${PICK_FONT}</font>`
  +`<font><b/><sz val="11"/><color rgb="FFFFFFFF"/>${PICK_FONT}</font>`
  +`<font><b/><sz val="10"/><color rgb="FF1F3B5C"/>${PICK_FONT}</font>`
  +`<font><b/><sz val="10"/><color rgb="FF7030A0"/>${PICK_FONT}</font>`
  +`<font><sz val="9"/><color rgb="FF595959"/>${PICK_FONT}</font>`
  +`<font><b/><sz val="10"/><color rgb="FF404040"/>${PICK_FONT}</font>`
  +`<font><b/><sz val="12"/><color rgb="FFFFFFFF"/>${PICK_FONT}</font>`
  +`</fonts>`
  +`<fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>`
  +['FFDDE8E3','FFE4EEFA','FFFDECDB','FF2F6FB5','FFDD7414','FFF0F0F0'].map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="${c}"/><bgColor indexed="64"/></patternFill></fill>`).join('')
  +`</fills>`
  +`<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>`
  +`<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`;
 // [名称, 字体, 底色, 边框, 水平对齐]
 const PICK_XF=[
  ['default',0,0,1,''],['header',1,2,1,'center'],['title',2,0,0,'left'],['subtitle',6,0,0,'left'],
  ['send',0,3,1,''],['sendC',0,3,1,'center'],['sendB',4,3,1,''],['sendBadge',3,5,1,'center'],['sendStudent',5,3,1,'center'],
  ['take',0,4,1,''],['takeC',0,4,1,'center'],['takeB',4,4,1,''],['takeBadge',3,6,1,'center'],['takeStudent',5,4,1,'center'],
  ['sendSection',8,5,1,'left'],['takeSection',8,6,1,'left'],['group',7,7,1,'left'],['gap',0,0,0,'']
 ];
 const PICK_INDEX=Object.fromEntries(PICK_XF.map((x,i)=>[x[0],i]));
 const PICK_STYLESHEET=PICK_STYLES+`<cellXfs count="${PICK_XF.length}">`
  +PICK_XF.map(([,f,fill,b,h])=>`<xf numFmtId="0" fontId="${f}" fillId="${fill}" borderId="${b}" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${h?` horizontal="${h}"`:''} vertical="center" wrapText="1"/></xf>`).join('')
  +`</cellXfs><cellStyles count="1"><cellStyle name="常规" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
 function styledWorkbook(model,title='取送件清单'){
  const rows=model.rows||[],n=(model.widths||[]).length,last=colName(Math.max(0,n-1)),hr=model.headerRow||1;
  const merges=[];
  const data=rows.map((row,i)=>{
   const r=i+1;if(row.merge)merges.push(`A${r}:${last}${r}`);
   const ht=row.ht?` ht="${row.ht}" customHeight="1"`:'';
   return `<row r="${r}"${ht}>${row.cells.map((c,j)=>{const s=PICK_INDEX[c.s]??0;return c.v===''||c.v==null?`<c r="${colName(j)}${r}" s="${s}"/>`:`<c r="${colName(j)}${r}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${xml(c.v)}</t></is></c>`;}).join('')}</row>`;
  }).join('');
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}" xmlns:r="${R}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${last}${Math.max(1,rows.length)}"/>`
   +`<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${hr}" topLeftCell="A${hr+1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="16"/>`
   +`<cols>${(model.widths||[]).map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${data}</sheetData>`
   +(merges.length?`<mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`:'')
   +`<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0" horizontalDpi="600" verticalDpi="600"/></worksheet>`;
  return zip({
   '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
    +'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    +'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    +'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
   '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
   'xl/workbook.xml':`<workbook xmlns="${NS}" xmlns:r="${R}"><sheets><sheet name="${xml(title)}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'${xml(title)}'!$${hr}:$${hr}</definedName></definedNames></workbook>`,
   'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
   'xl/styles.xml':PICK_STYLESHEET,
   'xl/worksheets/sheet1.xml':sheet
  });
 }
 if(typeof module!=='undefined')module.exports={workbook,simpleWorkbook,styledWorkbook};else{root.createWorkbook=workbook;root.createSimpleWorkbook=simpleWorkbook;root.createStyledWorkbook=styledWorkbook;}
})(typeof window!=='undefined'?window:globalThis);
