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
 if(typeof module!=='undefined')module.exports={workbook,simpleWorkbook};else{root.createWorkbook=workbook;root.createSimpleWorkbook=simpleWorkbook;}
})(typeof window!=='undefined'?window:globalThis);
