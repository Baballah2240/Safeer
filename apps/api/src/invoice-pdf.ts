import {document,serialize,money,percent} from './contract-pdf.js';

// D87: a monthly invoice as a PDF in English or Arabic, in the same frame as the contract. The amounts are the
// fixed snapshot the database computed when the invoice was issued.
export type InvoiceTerms={number:string;lang:'en'|'ar';contractNumber:string;companyNameEn:string;companyNameAr:string;contactEmail:string;address:string;
 periodMonth:string;currency:string;feeMinor:string;commissionBps:number;paymentsMinor:string;refundsMinor:string;commissionMinor:string;totalMinor:string;
 dueOn:string;issuedAt:string;paidAt:string|null;paidReference:string|null;voidedAt:string|null;voidReason:string|null};

const words={
 en:{brand:'SAFEER',tagline:'Transport platform - Invoice',label:'Invoice',title:'Invoice',running:(n:string)=>`Safeer invoice ${n}`,
  billTo:'Bill to',company:'Company',email:'Email',address:'Address',details:'Invoice details',rows:['Invoice number','Service month','Issued','Due date','Contract'],
  lines:'Charges',item:'Item',amount:'Amount',fee:(m:string)=>`Monthly fee - ${m}`,commission:(p:string)=>`Commission (${p} of net collections)`,total:'Total due',
  basis:'How the commission is calculated',collections:'Payments recorded in Safeer',refunds:'Refunds',net:'Net collections',
  note:(c:string)=>`Amounts are in ${c}. Net collections are ticket and parcel payments minus refunds recorded in Safeer for the service month (UTC), in the contract currency. Payment is due by the due date shown above.`,
  paid:(d:string,r:string)=>`PAID on ${d} - reference ${r}`,void:(d:string,r:string)=>`VOID since ${d} - ${r}`,
  month:(iso:string)=>new Date(iso+'T00:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'})},
 ar:{brand:'سفير',tagline:'منصة النقل - فاتورة',label:'فاتورة',title:'فاتورة',running:(n:string)=>`فاتورة سفير ${n}`,
  billTo:'الفاتورة إلى',company:'الشركة',email:'البريد الإلكتروني',address:'العنوان',details:'بيانات الفاتورة',rows:['رقم الفاتورة','شهر الخدمة','تاريخ الإصدار','تاريخ الاستحقاق','العقد'],
  lines:'الرسوم',item:'البند',amount:'المبلغ',fee:(m:string)=>`الرسوم الشهرية - ${m}`,commission:(p:string)=>`العمولة: ${p} من صافي التحصيل`,total:'الإجمالي المستحق',
  basis:'طريقة حساب العمولة',collections:'المدفوعات المسجلة في سفير',refunds:'المبالغ المستردة',net:'صافي التحصيل',
  note:(c:string)=>`جميع المبالغ بعملة ${c} وهي عملة العقد. وصافي التحصيل هو مدفوعات التذاكر والطرود مطروحا منها المبالغ المستردة المسجلة في سفير خلال شهر الخدمة (بالتوقيت العالمي). ويستحق السداد في موعد أقصاه تاريخ الاستحقاق المذكور أعلاه.`,
  paid:(d:string,r:string)=>`مدفوعة بتاريخ ${d} - المرجع ${r}`,void:(d:string,r:string)=>`ملغاة منذ ${d} - ${r}`,
  month:(iso:string)=>new Date(iso+'T00:00:00Z').toLocaleDateString('ar-u-nu-latn',{month:'long',year:'numeric',timeZone:'UTC'})},
};

export function invoicePdf(v:InvoiceTerms):Buffer{
 const w=words[v.lang];
 const {arabic,face,layout:L,day}=document(v.lang,{brand:w.brand,tagline:w.tagline,label:w.label,number:v.number,running:w.running(v.number)});
 const muted='0.36 0.38 0.37',green='0.07 0.23 0.18',cash=(m:string)=>money(m,v.currency),month=w.month(v.periodMonth);
 L.y=730;L.text(w.title,56,L.y,20,true);L.y-=20+face.lead;
 L.text(`${v.number} - ${month}`,56,L.y,10.5,false,muted);L.y-=12;
 if(v.paidAt||v.voidedAt){L.y-=6;L.para(v.paidAt?w.paid(day(v.paidAt),v.paidReference||''):w.void(day(v.voidedAt!),v.voidReason||''),{bold:true});}
 L.rule(L.y);L.y-=6;
 L.heading(w.billTo);L.rows([[w.company,v.lang==='ar'?v.companyNameAr:v.companyNameEn],[w.email,v.contactEmail],[w.address,v.address]]);
 L.heading(w.details);L.rows([[w.rows[0],v.number],[w.rows[1],month],[w.rows[2],day(v.issuedAt)],[w.rows[3],day(v.dueOn+'T00:00:00Z')],[w.rows[4],v.contractNumber]]);
 // Charges: item on the start side, amount aligned to the end of the column.
 L.heading(w.lines);
 const line=(label:string,amount:string,bold=false)=>{L.need(22+face.lead);L.y-=12+face.lead;L.text(label,56,L.y,10.5,bold);L.text(amount,539-face.measure(amount,10.5,bold),L.y,10.5,bold);};
 L.text(w.item,56,L.y-14,9,false,muted);L.text(w.amount,539-face.measure(w.amount,9,false),L.y-14,9,false,muted);L.y-=18;L.rule(L.y);
 line(w.fee(month),cash(v.feeMinor));line(w.commission(percent(v.commissionBps)),cash(v.commissionMinor));
 L.y-=8;L.rule(L.y);L.y-=4;
 L.need(30);L.y-=14+face.lead;L.text(w.total,56,L.y,13,true,green);const total=cash(v.totalMinor);L.text(total,539-face.measure(total,13,true),L.y,13,true,green);L.y-=10;
 L.heading(w.basis);
 const net=(BigInt(v.paymentsMinor)-BigInt(v.refundsMinor)),netText=net<0n?`-${cash((-net).toString())}`:cash(net.toString());
 L.rows([[w.collections,cash(v.paymentsMinor)],[w.refunds,cash(v.refundsMinor)],[w.net,netText]]);
 L.para(w.note(v.currency),{size:9});
 return serialize(L.finish(),arabic,v.lang,`Safeer invoice ${v.number}`);
}
