// D82: the company service agreement as a PDF, written directly (A4, the PDF standard Helvetica fonts) so no
// document library or headless browser runs on the server. The standard fonts carry Latin text only, so the
// agreement is in English and names the company by its English name; other characters print as "?".
export type ContractTerms={number:string;copy:'company'|'safeer';companyNameEn:string;contactEmail:string;phone:string;address:string;
 monthlyFeeMinor:number|string;commissionBps:number;currency:string;startsOn:string;notes:string;issuedAt:string;issuedByName:string;
 acceptedAt:string|null;acceptedByName:string|null;supersededAt:string|null};

const width=(ch:string)=>' '===ch?.278:/[il.,:;|!'()\[\]]/.test(ch)?.28:/[mwMW@]/.test(ch)?.85:/[A-Z]/.test(ch)?.68:/[0-9]/.test(ch)?.556:.52;
const measure=(s:string,size:number,bold:boolean)=>[...s].reduce((sum,ch)=>sum+width(ch),0)*size*(bold?1.06:1);
const latin=(s:string)=>s.replace(/[^\x20-\x7e]/g,'?');
const esc=(s:string)=>latin(s).replace(/([\\()])/g,'\\$1');
const day=(iso:string)=>new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
export const money=(minor:number|string,currency:string)=>{const v=BigInt(minor),whole=v/100n,cents=(v%100n).toString().padStart(2,'0');return `${currency} ${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g,',')}.${cents}`;};
export const percent=(bps:number)=>(bps/100).toFixed(2).replace(/\.?0+$/,'')+'%';

class Layout {
 pages:string[]=[];private ops:string[]=[];y=0;
 constructor(private readonly header:(page:number)=>string[]){this.page();}
 page(){if(this.ops.length)this.pages.push(this.ops.join('\n'));this.ops=[...this.header(this.pages.length+1)];this.y=this.pages.length?760:700;}
 need(h:number){if(this.y-h<72)this.page();}
 text(s:string,x:number,y:number,size:number,bold=false,color='0.11 0.13 0.12'){this.ops.push(`BT ${color} rg /${bold?'F2':'F1'} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${esc(s)}) Tj ET`);}
 rule(y:number){this.ops.push(`0.85 0.83 0.79 RG 0.6 w 56 ${y} m 539 ${y} l S`);}
 para(s:string,{size=10.5,bold=false,indent=0,gap=4}={}){
  const max=483-indent,words=latin(s).split(/\s+/).filter(Boolean),lines:string[]=[];let line='';
  for(const w of words){const next=line?line+' '+w:w;if(line&&measure(next,size,bold)>max){lines.push(line);line=w;}else line=next;}if(line)lines.push(line);
  for(const l of lines){this.need(size+4);this.y-=size+4;this.text(l,56+indent,this.y,size,bold);}this.y-=gap;
 }
 heading(s:string){this.need(40);this.y-=14;this.text(s,56,this.y,12,true,'0.07 0.23 0.18');this.y-=8;}
 rows(items:[string,string][]){for(const [k,v] of items){this.need(18);this.y-=16;this.text(k,56,this.y,10,false,'0.36 0.38 0.37');const lines:string[]=[];let line='';for(const w of latin(v||'-').split(/\s+/)){const next=line?line+' '+w:w;if(line&&measure(next,10.5,true)>300){lines.push(line);line=w;}else line=next;}lines.push(line);lines.forEach((l,i)=>{if(i){this.need(16);this.y-=14;}this.text(l,239,this.y,10.5,true);});}this.y-=6;}
 finish(){this.pages.push(this.ops.join('\n'));return this.pages;}
}

export function contractPdf(c:ContractTerms):Buffer{
 const copy=c.copy==='company'?'Company copy':'Safeer copy';
 const header=(n:number)=>n===1?[
  '0.07 0.23 0.18 rg 0 762 595 80 re f',
  `BT 1 1 1 rg /F2 22 Tf 56 806 Td (SAFEER) Tj ET`,`BT 0.85 0.93 0.89 rg /F1 10 Tf 56 788 Td (Transport platform - Service agreement) Tj ET`,
  `BT 1 1 1 rg /F2 10 Tf ${(539-measure(copy,10,true)).toFixed(1)} 806 Td (${copy}) Tj ET`,
  `BT 0.85 0.93 0.89 rg /F1 10 Tf ${(539-measure(c.number,10,false)).toFixed(1)} 788 Td (${esc(c.number)}) Tj ET`,
 ]:[`BT 0.36 0.38 0.37 rg /F1 9 Tf 56 806 Td (Safeer service agreement ${esc(c.number)} - ${copy}) Tj ET`,'0.85 0.83 0.79 RG 0.6 w 56 796 m 539 796 l S'];
 const L=new Layout(header);
 L.y=730;L.text('Service Agreement',56,L.y,20,true);L.y-=20;
 L.text(`Issued ${day(c.issuedAt)} - Contract ${c.number}`,56,L.y,10.5,false,'0.36 0.38 0.37');L.y-=12;
 if(c.supersededAt){L.y-=6;L.para(`This contract was replaced by a newer plan on ${day(c.supersededAt)} and is kept for the record.`,{bold:true});}
 L.rule(L.y);L.y-=6;
 L.heading('1. Parties');
 L.para('This agreement is between Safeer, the operator of the Safeer transport platform ("Safeer"), and the transport company named below (the "Company").');
 L.rows([['Company',c.companyNameEn],['Contact email',c.contactEmail],['Phone',c.phone],['Address',c.address]]);
 L.heading('2. Service');
 L.para("Safeer gives the Company its own private workspace to run its business: trips, routes, vehicles, drivers, bookings, ticketing, luggage, parcels, staff and reports. The Company decides who on its staff has access and what each person can do. Once the Company is approved and its public page is listed, its published trips appear on the Safeer booking site.");
 L.heading('3. Fees');
 L.rows([['Monthly fee',money(c.monthlyFeeMinor,c.currency)],['Commission',`${percent(c.commissionBps)} of each paid booking and parcel`],['Currency',c.currency],['Start date',day(c.startsOn+'T00:00:00Z')]]);
 L.para('The monthly fee is charged for each calendar month from the start date. The commission is calculated on payments recorded in Safeer for the Company, after refunds, and is invoiced with the monthly fee.');
 L.heading('4. Billing and payment');
 L.para('Safeer sends one invoice per month. Payment is due within 14 days of the invoice date. If an invoice stays unpaid for 30 days after a written reminder, Safeer may pause the publishing of new trips until it is paid. Bookings already sold are honored.');
 L.heading("5. The Company's responsibilities");
 L.para('The Company keeps its trips, fares and timetables accurate, operates licensed vehicles with qualified drivers, is responsible for passenger safety and service, and manages its own staff accounts and permissions.');
 L.heading('6. Data and privacy');
 L.para("Each company sees only its own data. Safeer protects passenger information as described in its privacy notice and does not sell it. The Company uses passenger details only to provide the trip or delivery.");
 L.heading('7. Term and changes');
 L.para('This agreement runs month to month from the start date. Either party may end it with 30 days written notice. When Safeer issues a new plan for the Company, the new contract replaces this one from its own start date.');
 if(c.notes.trim()){L.heading('8. Additional terms');L.para(c.notes);}
 L.need(130);L.y-=10;L.rule(L.y);L.y-=8;L.heading('Signatures');
 const top=L.y;L.text('For Safeer',56,top-16,10,false,'0.36 0.38 0.37');L.text(c.issuedByName,56,top-34,11,true);L.text(`Issued ${day(c.issuedAt)}`,56,top-50,10);
 L.text('For the Company',310,top-16,10,false,'0.36 0.38 0.37');
 if(c.acceptedAt){L.text(c.acceptedByName||'',310,top-34,11,true);L.text(`Accepted in Safeer ${day(c.acceptedAt)}`,310,top-50,10);}
 else{L.text('Not yet accepted',310,top-34,11,true);L.text('A company manager accepts it in Safeer.',310,top-50,10);}
 L.y=top-64;L.para('Accepting in Safeer, signed in with a personal account and password, records the name and time shown above.',{size:9});
 const pages=L.finish();
 // Objects: 1 catalog, 2 pages, 3-4 fonts, 5 info, then one page and one content stream per page.
 const objects:string[]=[];const kids=pages.map((_,i)=>`${6+i*2} 0 R`).join(' ');
 objects.push('<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  `<< /Title (Safeer service agreement ${esc(c.number)}) /Producer (Safeer) >>`);
 pages.forEach((stream,i)=>{
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${7+i*2} 0 R >>`);
  objects.push(`<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}\nendstream`);
 });
 let out='%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';const offsets:number[]=[];
 objects.forEach((body,i)=>{offsets.push(Buffer.byteLength(out,'latin1'));out+=`${i+1} 0 obj\n${body}\nendobj\n`;});
 const xref=Buffer.byteLength(out,'latin1');
 out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(out,'latin1');
}
