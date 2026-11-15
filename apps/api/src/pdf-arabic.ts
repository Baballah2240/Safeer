import {readFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';

// D83: Arabic text for generated PDFs without a document library. It reads the Noto Sans Arabic TrueType fonts the
// mobile app already ships (SIL Open Font License), joins Arabic letters with the Unicode presentation forms the font
// maps, orders each line right to left (keeping Latin words and numbers left to right), and embeds the fonts as
// Type0/Identity-H with a ToUnicode map so the text can be searched and copied. Short vowel marks are left out
// because the font's mark positioning is not applied.
type Font={data:Buffer;packed?:Buffer;unitsPerEm:number;ascent:number;descent:number;bbox:number[];cmap:Map<number,number>;adv:number[]};

function parse(data:Buffer):Font{
 const tables:Record<string,number>={};for(let i=0,n=data.readUInt16BE(4);i<n;i++){const o=12+i*16;tables[data.toString('latin1',o,o+4)]=data.readUInt32BE(o+8);}
 const head=tables.head,hhea=tables.hhea,hmtx=tables.hmtx,cmapAt=tables.cmap;
 const unitsPerEm=data.readUInt16BE(head+18),bbox=[0,2,4,6].map(k=>data.readInt16BE(head+36+k));
 const ascent=data.readInt16BE(hhea+4),descent=data.readInt16BE(hhea+6),metrics=data.readUInt16BE(hhea+34),glyphs=data.readUInt16BE(tables.maxp+4);
 const adv:number[]=[];for(let g=0;g<glyphs;g++)adv.push(data.readUInt16BE(hmtx+4*Math.min(g,metrics-1)));
 const cmap=new Map<number,number>();
 for(let i=0,n=data.readUInt16BE(cmapAt+2);i<n;i++){
  const platform=data.readUInt16BE(cmapAt+4+i*8),encoding=data.readUInt16BE(cmapAt+6+i*8),sub=cmapAt+data.readUInt32BE(cmapAt+8+i*8);
  if(platform!==3||encoding!==10||data.readUInt16BE(sub)!==12)continue;
  for(let k=0,groups=data.readUInt32BE(sub+12);k<groups;k++){const s=data.readUInt32BE(sub+16+k*12),e=data.readUInt32BE(sub+20+k*12),g=data.readUInt32BE(sub+24+k*12);for(let cp=s;cp<=e;cp++)cmap.set(cp,g+cp-s);}
 }
 if(!cmap.size)throw new Error('The Arabic PDF font has no Unicode cmap.');
 return {data,unitsPerEm,ascent,descent,bbox,cmap,adv};
}

// The fonts live with the mobile app (dist/api -> repository root); they are read once, on the first Arabic PDF.
const fontDir=new URL('../../mobile/flutter/packages/safeer_core/assets/fonts/',import.meta.url);
const fonts:{regular?:Font;bold?:Font}={};
const font=(bold:boolean)=>bold?(fonts.bold??=parse(readFileSync(new URL('NotoSansArabic-700.ttf',fontDir)))):(fonts.regular??=parse(readFileSync(new URL('NotoSansArabic-400.ttf',fontDir))));

// Presentation forms: [isolated, final, initial, medial]; letters with two forms join only to the letter before them.
const forms:Record<number,number[]>={};
const dual=(cp:number,base:number)=>{forms[cp]=[base,base+1,base+2,base+3];},right=(cp:number,base:number)=>{forms[cp]=[base,base+1];};
forms[0x0621]=[0xFE80];right(0x0622,0xFE81);right(0x0623,0xFE83);right(0x0624,0xFE85);right(0x0625,0xFE87);dual(0x0626,0xFE89);right(0x0627,0xFE8D);
dual(0x0628,0xFE8F);right(0x0629,0xFE93);dual(0x062A,0xFE95);dual(0x062B,0xFE99);dual(0x062C,0xFE9D);dual(0x062D,0xFEA1);dual(0x062E,0xFEA5);
right(0x062F,0xFEA9);right(0x0630,0xFEAB);right(0x0631,0xFEAD);right(0x0632,0xFEAF);dual(0x0633,0xFEB1);dual(0x0634,0xFEB5);dual(0x0635,0xFEB9);
dual(0x0636,0xFEBD);dual(0x0637,0xFEC1);dual(0x0638,0xFEC5);dual(0x0639,0xFEC9);dual(0x063A,0xFECD);dual(0x0641,0xFED1);dual(0x0642,0xFED5);
dual(0x0643,0xFED9);dual(0x0644,0xFEDD);dual(0x0645,0xFEE1);dual(0x0646,0xFEE5);dual(0x0647,0xFEE9);right(0x0648,0xFEED);right(0x0649,0xFEEF);dual(0x064A,0xFEF1);
const lamAlef:Record<number,number>={0x0622:0xFEF5,0x0623:0xFEF7,0x0625:0xFEF9,0x0627:0xFEFB};
const TATWEEL=0x0640,joinsAfter=(cp:number|undefined)=>cp===TATWEEL||(cp!==undefined&&(forms[cp]?.length??0)===4),joinsBefore=(cp:number|undefined)=>cp===TATWEEL||(cp!==undefined&&(forms[cp]?.length??0)>=2);
const mirror:Record<string,string>={'(':')',')':'(','[':']',']':'[','<':'>','>':'<','{':'}','}':'{'};
export const isArabic=(s:string)=>/[؀-ۿ]/.test(s);

type Glyph={gid:number;text:string};
// One word, logical order, as glyphs with the source text each stands for.
function shapeWord(word:string,f:Font):Glyph[]{
 const cps=[...word.normalize('NFC')].map(ch=>ch.codePointAt(0)!).filter(cp=>!(cp>=0x064B&&cp<=0x065F)&&cp!==0x0670),out:Glyph[]=[];
 const gid=(cp:number)=>f.cmap.get(cp)??f.cmap.get(0x3F)??0;
 for(let i=0;i<cps.length;i++){
  const cp=cps[i],prev=cps[i-1],next=cps[i+1],linked=joinsAfter(prev);
  if(cp===0x0644&&next!==undefined&&lamAlef[next]){out.push({gid:gid(lamAlef[next]+(linked?1:0)),text:String.fromCodePoint(cp,next)});i++;continue;}
  const set=forms[cp];
  if(!set){out.push({gid:f.cmap.has(cp)?gid(cp):gid(0x3F),text:String.fromCodePoint(cp)});continue;}
  const after=set.length===4&&joinsBefore(next);
  out.push({gid:gid(set.length===1?set[0]:linked&&after?set[3]:linked?set[1]:after?set[2]:set[0]),text:String.fromCodePoint(cp)});
 }
 return out;
}

// A run of text in a right-to-left paragraph, ready to draw left to right.
export class ArabicFace {
 private used=[new Map<number,string>(),new Map<number,string>()];
 inUse(){return this.used.some(m=>m.size>0);}
 measure(s:string,size:number,bold:boolean){const f=font(bold);return this.visual(s,bold,false).reduce((w,g)=>w+f.adv[g.gid],0)*size/f.unitsPerEm;}
 private visual(s:string,bold:boolean,record=true):Glyph[]{
  const f=font(bold),words=s.split(/\s+/).filter(Boolean).flatMap(w=>{if(isArabic(w)||!/[A-Za-z0-9]/.test(w))return [w];const m=/^([.,،؛:;!?()[\]"«»]*)(.*?)([.,،؛:;!?()[\]"«»]*)$/u.exec(w)!;return [...m[1],m[2],...m[3]].filter(Boolean);}),space:Glyph={gid:f.cmap.get(0x20)??0,text:' '};
  // Words with Latin letters or digits read left to right; punctuation on its own follows the paragraph. Group neighbouring left-to-right words so "SDG 25,000.00" keeps its order, then lay the groups out right to left.
  const runs:{rtl:boolean;words:string[]}[]=[];
  for(const w of words){const rtl=isArabic(w)||!/[A-Za-z0-9]/.test(w),last=runs.at(-1);if(last&&!last.rtl&&!rtl)last.words.push(w);else runs.push({rtl,words:[w]});}
  const out:Glyph[]=[];
  runs.reverse().forEach((run,i)=>{
   if(i)out.push(space);
   if(run.rtl)out.push(...shapeWord([...run.words[0]].map(ch=>mirror[ch]??ch).join(''),f).reverse());
   else run.words.forEach((w,k)=>{if(k)out.push(space);out.push(...shapeWord(w,f));});
  });
  if(record)for(const g of out)this.used[bold?1:0].set(g.gid,g.text);
  return out;
 }
 draw(s:string,x:number,y:number,size:number,bold:boolean,color:string){
  const hex=this.visual(s,bold).map(g=>g.gid.toString(16).padStart(4,'0')).join('');
  return `BT ${color} rg /${bold?'F4':'F3'} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td <${hex}> Tj ET`;
 }
 // PDF objects for /F3 (regular) and /F4 (bold), numbered from `first`; returns them in order.
 objects(first:number):string[]{
  const out:string[]=[];
  [false,true].forEach((bold,k)=>{
   const f=font(bold),n=first+k*5,used=[...this.used[k].entries()].sort((a,b)=>a[0]-b[0]),scale=1000/f.unitsPerEm,name=bold?'NotoSansArabic-Bold':'NotoSansArabic-Regular';
   const widths=used.map(([g])=>`${g} [${Math.round(f.adv[g]*scale)}]`).join(' '),file=(f.packed??=deflateSync(f.data));
   const utf16=(s:string)=>Buffer.from(s,'utf16le').swap16().toString('hex');
   const cmap=['/CIDInit /ProcSet findresource begin','12 dict begin','begincmap','/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def','/CMapName /Adobe-Identity-UCS def','/CMapType 2 def','1 begincodespacerange','<0000> <FFFF>','endcodespacerange'];
   for(let i=0;i<used.length;i+=100){const part=used.slice(i,i+100);cmap.push(`${part.length} beginbfchar`,...part.map(([g,t])=>`<${g.toString(16).padStart(4,'0')}> <${utf16(t)}>`),'endbfchar');}
   cmap.push('endcmap','CMapName currentdict /CMap defineresource pop','end','end');const cmapText=cmap.join('\n');
   out.push(`<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /Identity-H /DescendantFonts [${n+1} 0 R] /ToUnicode ${n+4} 0 R >>`,
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${n+2} 0 R /CIDToGIDMap /Identity /DW 500 /W [${widths}] >>`,
    `<< /Type /FontDescriptor /FontName /${name} /Flags 32 /FontBBox [${f.bbox.map(v=>Math.round(v*scale)).join(' ')}] /ItalicAngle 0 /Ascent ${Math.round(f.ascent*scale)} /Descent ${Math.round(f.descent*scale)} /CapHeight ${Math.round(f.ascent*scale*.7)} /StemV ${bold?120:80} /FontFile2 ${n+3} 0 R >>`,
    `<< /Length ${file.length} /Length1 ${f.data.length} /Filter /FlateDecode >>\nstream\n${file.toString('latin1')}\nendstream`,
    `<< /Length ${Buffer.byteLength(cmapText,'latin1')} >>\nstream\n${cmapText}\nendstream`);
  });
  return out;
 }
}
