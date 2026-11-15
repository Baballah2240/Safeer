import {ArabicFace} from './pdf-arabic.js';

// D82: the company service agreement as a PDF, written directly (A4) so no document library or headless browser runs
// on the server. English uses the PDF standard Helvetica fonts (Latin only; other characters print as "?").
// D83: Arabic uses the embedded Noto Sans Arabic fonts, laid out right to left, and names the company in Arabic.
export type ContractTerms={number:string;copy:'company'|'safeer';lang:'en'|'ar';companyNameEn:string;companyNameAr:string;contactEmail:string;phone:string;address:string;
 monthlyFeeMinor:number|string;commissionBps:number;currency:string;startsOn:string;notes:string;issuedAt:string;issuedByName:string;
 acceptedAt:string|null;acceptedByName:string|null;supersededAt:string|null};

const width=(ch:string)=>' '===ch?.278:/[il.,:;|!'()\[\]]/.test(ch)?.28:/[mwMW@]/.test(ch)?.85:/[A-Z]/.test(ch)?.68:/[0-9]/.test(ch)?.556:.52;
const measure=(s:string,size:number,bold:boolean)=>[...s].reduce((sum,ch)=>sum+width(ch),0)*size*(bold?1.06:1);
const latin=(s:string)=>s.replace(/[^\x20-\x7e]/g,'?');
const esc=(s:string)=>latin(s).replace(/([\\()])/g,'\\$1');
const dayIn=(lang:'en'|'ar')=>(iso:string)=>new Date(iso).toLocaleDateString(lang==='ar'?'ar-u-nu-latn':'en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
export const money=(minor:number|string,currency:string)=>{const v=BigInt(minor),whole=v/100n,cents=(v%100n).toString().padStart(2,'0');return `${currency} ${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g,',')}.${cents}`;};
export const percent=(bps:number)=>(bps/100).toFixed(2).replace(/\.?0+$/,'')+'%';

// How text is measured and drawn: Helvetica left to right, or embedded Arabic right to left. Positions are written
// for left to right; a right-to-left face mirrors each piece across the page (the margins are symmetric).
type Face={rtl:boolean;lead:number;measure(s:string,size:number,bold:boolean):number;draw(s:string,x:number,y:number,size:number,bold:boolean,color:string):string;clean(s:string):string};
const helvetica:Face={rtl:false,lead:4,measure,clean:latin,draw:(s,x,y,size,bold,color)=>`BT ${color} rg /${bold?'F2':'F1'} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${esc(s)}) Tj ET`};
const arabicFace=(a:ArabicFace):Face=>({rtl:true,lead:8,measure:(s,size,bold)=>a.measure(s,size,bold),clean:s=>s.replace(/[\u0000-\u001f]/g,' '),draw:(s,x,y,size,bold,color)=>a.draw(s,x,y,size,bold,color)});
const place=(f:Face,s:string,x:number,y:number,size:number,bold:boolean,color:string)=>f.draw(s,f.rtl?595-x-f.measure(s,size,bold):x,y,size,bold,color);

class Layout {
 pages:string[]=[];private ops:string[]=[];y=0;
 constructor(readonly face:Face,private readonly header:(page:number)=>string[]){this.page();}
 page(){if(this.ops.length)this.pages.push(this.ops.join('\n'));this.ops=[...this.header(this.pages.length+1)];this.y=this.pages.length?760:700;}
 need(h:number){if(this.y-h<72)this.page();}
 text(s:string,x:number,y:number,size:number,bold=false,color='0.11 0.13 0.12'){this.ops.push(place(this.face,s,x,y,size,bold,color));}
 rule(y:number){this.ops.push(`0.85 0.83 0.79 RG 0.6 w 56 ${y} m 539 ${y} l S`);}
 private wrap(s:string,size:number,bold:boolean,max:number){const words=this.face.clean(s).split(/\s+/).filter(Boolean),lines:string[]=[];let line='';
  for(const w of words){const next=line?line+' '+w:w;if(line&&this.face.measure(next,size,bold)>max){lines.push(line);line=w;}else line=next;}lines.push(line);return lines;}
 para(s:string,{size=10.5,bold=false,indent=0,gap=4}={}){
  for(const l of this.wrap(s,size,bold,483-indent).filter(Boolean)){this.need(size+this.face.lead);this.y-=size+this.face.lead;this.text(l,56+indent,this.y,size,bold);}this.y-=gap;
 }
 heading(s:string){this.need(40);this.y-=14+this.face.lead;this.text(s,56,this.y,12,true,'0.07 0.23 0.18');this.y-=8;}
 rows(items:[string,string][]){for(const [k,v] of items){this.need(18+this.face.lead);this.y-=12+this.face.lead;this.text(k,56,this.y,10,false,'0.36 0.38 0.37');
  this.wrap(v||'-',10.5,true,300).forEach((l,i)=>{if(i){this.need(16);this.y-=10+this.face.lead;}this.text(l,239,this.y,10.5,true);});}this.y-=6;}
 finish(){this.pages.push(this.ops.join('\n'));return this.pages;}
}

// The agreement wording. Both languages carry the same terms.
const words={
 en:{copy:{company:'Company copy',safeer:'Safeer copy'},brand:'SAFEER',tagline:'Transport platform - Service agreement',title:'Service Agreement',
  issued:(d:string,n:string)=>`Issued ${d} - Contract ${n}`,superseded:(d:string)=>`This contract was replaced by a newer plan on ${d} and is kept for the record.`,
  running:(n:string,copy:string)=>`Safeer service agreement ${n} - ${copy}`,
  h:['1. Parties','2. Service','3. Fees','4. Billing and payment',"5. The Company's responsibilities",'6. Data and privacy','7. Term and changes','8. Additional terms'],
  parties:'This agreement is between Safeer, the operator of the Safeer transport platform ("Safeer"), and the transport company named below (the "Company").',
  partyRows:['Company','Contact email','Phone','Address'],
  service:"Safeer gives the Company its own private workspace to run its business: trips, routes, vehicles, drivers, bookings, ticketing, luggage, parcels, staff and reports. The Company decides who on its staff has access and what each person can do. Once the Company is approved and its public page is listed, its published trips appear on the Safeer booking site.",
  feeRows:['Monthly fee','Commission','Currency','Start date'],commission:(p:string)=>`${p} of each paid booking and parcel`,
  fees:'The monthly fee is charged for each calendar month from the start date. The commission is calculated on payments recorded in Safeer for the Company, after refunds, and is invoiced with the monthly fee.',
  billing:'Safeer sends one invoice per month. Payment is due within 14 days of the invoice date. If an invoice stays unpaid for 30 days after a written reminder, Safeer may pause the publishing of new trips until it is paid. Bookings already sold are honored.',
  duties:'The Company keeps its trips, fares and timetables accurate, operates licensed vehicles with qualified drivers, is responsible for passenger safety and service, and manages its own staff accounts and permissions.',
  privacy:'Each company sees only its own data. Safeer protects passenger information as described in its privacy notice and does not sell it. The Company uses passenger details only to provide the trip or delivery.',
  term:'This agreement runs month to month from the start date. Either party may end it with 30 days written notice. When Safeer issues a new plan for the Company, the new contract replaces this one from its own start date. An Arabic copy with the same terms is available in Safeer.',
  signatures:'Signatures',forSafeer:'For Safeer',forCompany:'For the Company',issuedOn:(d:string)=>`Issued ${d}`,acceptedOn:(d:string)=>`Accepted in Safeer ${d}`,
  notYet:'Not yet accepted',howAccept:'A company manager accepts it in Safeer.',record:'Accepting in Safeer, signed in with a personal account and password, records the name and time shown above.'},
 ar:{copy:{company:'نسخة الشركة',safeer:'نسخة سفير'},brand:'سفير',tagline:'منصة النقل - اتفاقية خدمة',title:'اتفاقية تقديم خدمة',
  issued:(d:string,n:string)=>`صدرت في ${d} - العقد ${n}`,superseded:(d:string)=>`استبدل هذا العقد بخطة أحدث في ${d} ويحتفظ به للسجل.`,
  running:(n:string,copy:string)=>`اتفاقية خدمة سفير ${n} - ${copy}`,
  h:['أولا: الأطراف','ثانيا: الخدمة','ثالثا: الرسوم','رابعا: الفوترة والدفع','خامسا: التزامات الشركة','سادسا: البيانات والخصوصية','سابعا: المدة والتعديل','ثامنا: شروط إضافية'],
  parties:'هذه الاتفاقية مبرمة بين سفير، مشغل منصة سفير للنقل ("سفير")، وشركة النقل المذكورة أدناه ("الشركة").',
  partyRows:['الشركة','البريد الإلكتروني','الهاتف','العنوان'],
  service:'تمنح سفير الشركة مساحة عمل خاصة بها لإدارة أعمالها: الرحلات والمسارات والمركبات والسائقين والحجوزات والتذاكر والأمتعة والطرود والموظفين والتقارير. وتحدد الشركة من يحق له الدخول من موظفيها وما يمكن لكل منهم القيام به. وبعد اعتماد الشركة ونشر صفحتها العامة، تظهر رحلاتها المنشورة على موقع الحجز في سفير.',
  feeRows:['الرسوم الشهرية','العمولة','العملة','تاريخ البدء'],commission:(p:string)=>`${p} من كل حجز وطرد مدفوع`,
  fees:'تستحق الرسوم الشهرية عن كل شهر ميلادي ابتداء من تاريخ البدء. وتحسب العمولة على المدفوعات المسجلة في سفير لصالح الشركة بعد خصم المبالغ المستردة، وتدرج في فاتورة الرسوم الشهرية.',
  billing:'ترسل سفير فاتورة واحدة كل شهر، ويستحق سدادها خلال 14 يوما من تاريخ الفاتورة. وإذا بقيت الفاتورة غير مسددة لمدة 30 يوما بعد تذكير كتابي، يجوز لسفير إيقاف نشر الرحلات الجديدة مؤقتا حتى سدادها، مع الوفاء بالحجوزات المباعة سابقا.',
  duties:'تلتزم الشركة بدقة رحلاتها وأسعارها ومواعيدها، وبتشغيل مركبات مرخصة بسائقين مؤهلين، وتتحمل مسؤولية سلامة الركاب وجودة الخدمة، وتدير حسابات موظفيها وصلاحياتهم.',
  privacy:'لا ترى كل شركة إلا بياناتها. وتحمي سفير بيانات الركاب وفق إشعار الخصوصية الخاص بها ولا تبيعها. ولا تستخدم الشركة بيانات الركاب إلا لتقديم الرحلة أو خدمة التوصيل.',
  term:'تسري هذه الاتفاقية شهرا بشهر من تاريخ البدء، ويجوز لأي من الطرفين إنهاؤها بإشعار كتابي مدته 30 يوما. وعندما تصدر سفير خطة جديدة للشركة، يحل العقد الجديد محل هذا العقد من تاريخ بدئه. وتتوفر في سفير نسخة إنجليزية بالشروط نفسها.',
  signatures:'التوقيعات',forSafeer:'عن سفير',forCompany:'عن الشركة',issuedOn:(d:string)=>`صدر في ${d}`,acceptedOn:(d:string)=>`قبل في سفير بتاريخ ${d}`,
  notYet:'لم يقبل بعد',howAccept:'يقبله أحد مديري الشركة في سفير.',record:'يسجل القبول في سفير، بعد تسجيل الدخول بحساب شخصي وكلمة مرور، الاسم والوقت الموضحين أعلاه.'},
};

export function contractPdf(c:ContractTerms):Buffer{
 const w=words[c.lang],day=dayIn(c.lang),copy=w.copy[c.copy],arabic=c.lang==='ar'?new ArabicFace():null,face=arabic?arabicFace(arabic):helvetica;
 const at=(s:string,x:number,y:number,size:number,bold:boolean,color:string)=>place(face,s,x,y,size,bold,color);
 const right=(s:string,size:number,bold:boolean)=>539-face.measure(s,size,bold);
 const header=(n:number)=>n===1?[
  '0.07 0.23 0.18 rg 0 762 595 80 re f',
  at(w.brand,56,806,22,true,'1 1 1'),at(w.tagline,56,788,10,false,'0.85 0.93 0.89'),
  at(copy,right(copy,10,true),806,10,true,'1 1 1'),at(c.number,right(c.number,10,false),788,10,false,'0.85 0.93 0.89'),
 ]:[at(w.running(c.number,copy),56,806,9,false,'0.36 0.38 0.37'),'0.85 0.83 0.79 RG 0.6 w 56 796 m 539 796 l S'];
 const L=new Layout(face,header);
 L.y=730;L.text(w.title,56,L.y,20,true);L.y-=20+face.lead;
 L.text(w.issued(day(c.issuedAt),c.number),56,L.y,10.5,false,'0.36 0.38 0.37');L.y-=12;
 if(c.supersededAt){L.y-=6;L.para(w.superseded(day(c.supersededAt)),{bold:true});}
 L.rule(L.y);L.y-=6;
 L.heading(w.h[0]);L.para(w.parties);
 L.rows([[w.partyRows[0],c.lang==='ar'?c.companyNameAr:c.companyNameEn],[w.partyRows[1],c.contactEmail],[w.partyRows[2],c.phone],[w.partyRows[3],c.address]]);
 L.heading(w.h[1]);L.para(w.service);
 L.heading(w.h[2]);
 L.rows([[w.feeRows[0],money(c.monthlyFeeMinor,c.currency)],[w.feeRows[1],w.commission(percent(c.commissionBps))],[w.feeRows[2],c.currency],[w.feeRows[3],day(c.startsOn+'T00:00:00Z')]]);
 L.para(w.fees);
 L.heading(w.h[3]);L.para(w.billing);
 L.heading(w.h[4]);L.para(w.duties);
 L.heading(w.h[5]);L.para(w.privacy);
 L.heading(w.h[6]);L.para(w.term);
 if(c.notes.trim()){L.heading(w.h[7]);L.para(c.notes);}
 L.need(140);L.y-=10;L.rule(L.y);L.y-=8;L.heading(w.signatures);
 const top=L.y,gap=face.lead;
 L.text(w.forSafeer,56,top-16,10,false,'0.36 0.38 0.37');L.text(c.issuedByName,56,top-34-gap,11,true);L.text(w.issuedOn(day(c.issuedAt)),56,top-50-gap*2,10);
 L.text(w.forCompany,310,top-16,10,false,'0.36 0.38 0.37');
 if(c.acceptedAt){L.text(c.acceptedByName||'',310,top-34-gap,11,true);L.text(w.acceptedOn(day(c.acceptedAt)),310,top-50-gap*2,10);}
 else{L.text(w.notYet,310,top-34-gap,11,true);L.text(w.howAccept,310,top-50-gap*2,10);}
 L.y=top-64-gap*2;L.para(w.record,{size:9});
 const pages=L.finish();
 // Objects: 1 catalog, 2 pages, 3-4 Helvetica, 5 info, then one page and one content stream per page, then the
 // Arabic fonts (five objects each) when used.
 const objects:string[]=[];const kids=pages.map((_,i)=>`${6+i*2} 0 R`).join(' '),fontsAt=6+pages.length*2;
 const fontRefs=`/F1 3 0 R /F2 4 0 R${arabic?` /F3 ${fontsAt} 0 R /F4 ${fontsAt+5} 0 R`:''}`;
 objects.push(`<< /Type /Catalog /Pages 2 0 R /Lang (${c.lang}) >>`,`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  `<< /Title (Safeer service agreement ${esc(c.number)}) /Producer (Safeer) >>`);
 pages.forEach((stream,i)=>{
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << ${fontRefs} >> >> /Contents ${7+i*2} 0 R >>`);
  objects.push(`<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}\nendstream`);
 });
 if(arabic)objects.push(...arabic.objects(fontsAt));
 let out='%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';const offsets:number[]=[];
 objects.forEach((body,i)=>{offsets.push(Buffer.byteLength(out,'latin1'));out+=`${i+1} 0 obj\n${body}\nendobj\n`;});
 const xref=Buffer.byteLength(out,'latin1');
 out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(out,'latin1');
}
