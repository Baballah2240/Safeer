// D82: Plan & contract (Safeer bills each company a monthly fee plus a commission) and Brand & theme (each
// company's own colors and logo). Only a Super Administrator sets a plan; every plan issues a numbered
// contract that the company's managers and the Safeer owner receive as a PDF in their notifications.
import {formatMinor} from './finance-format.mjs';

const SAFEER_PRIMARY='#1f5d49',SAFEER_HEADER='#123a2d';
const percent=bps=>(Number(bps)/100).toFixed(2).replace(/\.?0+$/,'')+'%';
// "25,000.50" -> "2500050" without floating point, so large fees stay exact.
function toMinor(value){
  const s=String(value||'').replace(/[,\s]/g,'');if(!/^\d{1,10}(\.\d{1,2})?$/.test(s))throw Error('INVALID_FEE');
  const [whole,cents='']=s.split('.');return (BigInt(whole)*100n+BigInt((cents+'00').slice(0,2))).toString();
}
const fromMinor=minor=>{const v=BigInt(minor||0);return `${v/100n}.${String(v%100n).padStart(2,'0')}`;};
// D83: the PDF follows the reader's language (Arabic is laid out right to left with the Arabic company name).
const contractPdfUrl=(companyId,id,language)=>`/api/v1/companies/${encodeURIComponent(companyId)}/contracts/${encodeURIComponent(id)}/pdf?lang=${language==='ar'?'ar':'en'}`;
export const companyLogoUrl=(companyId,branding)=>branding?.logoVersion?`/api/v1/companies/${encodeURIComponent(companyId)}/branding/logo?v=${encodeURIComponent(branding.logoVersion)}`:'';

// D115: dates as YYYY-MM-DD in UTC. A term of n months ends the day before the same date n months later.
const addDays=(iso,n)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
const addMonths=(iso,n)=>{const d=new Date(iso+'T00:00:00Z'),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return addDays(d.toISOString().slice(0,10),-1)}
// Each contract's state today: waiting, scheduled, active, expired, replaced or withdrawn. The newest accepted contract that has started is active.
export function contractState(contracts,today){
  const map=new Map(),started=contracts.filter(k=>k.acceptedAt&&k.startsOn<=today).sort((a,b)=>b.startsOn.localeCompare(a.startsOn)||String(b.issuedAt).localeCompare(String(a.issuedAt)))[0]
  for(const k of contracts)map.set(k.id,!k.acceptedAt?(k.supersededAt?'withdrawn':'waiting'):k.startsOn>today?'scheduled':k!==started?'replaced':k.endsOn&&k.endsOn<today?'expired':'active')
  return map
}

export function billingView(data,{t,e,language}){
  const b=data.billing,c=data.company,plan=b?.plan,money=(minor,currency)=>formatMinor(minor,'en',currency);
  const day=value=>new Intl.DateTimeFormat(language==='ar'?'ar-SD-u-nu-latn':'en-GB',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value.length===10?value+'T00:00:00Z':value));
  if(!b)return '';
  const today=b.today||new Date().toISOString().slice(0,10)
  const state=contractState(b.contracts,today)
  const status=k=>{const [label,tone]={withdrawn:['Withdrawn','is-old'],replaced:['Replaced','is-old'],waiting:['Waiting for acceptance','is-wait'],scheduled:['Starts later','is-wait'],expired:['Expired','is-late'],active:['Active','is-ok']}[state.get(k.id)]
return `<span class="staff-badge billing-status ${tone}">${t(label)}</span>`}
  const term=k=>`<bdi>${e(day(k.startsOn))}</bdi> – ${k.endsOn?`<bdi>${e(day(k.endsOn))}</bdi>`:t('No end date')}`;
  const current=b.contracts.find(k=>!k.supersededAt&&!k.acceptedAt)||b.contracts.find(k=>state.get(k.id)==='active');
  const active=b.contracts.find(k=>state.get(k.id)==='active'),shown=active||plan,left=active?.endsOn?Math.round((Date.parse(active.endsOn)-Date.parse(today))/864e5):null
  const expiring=active&&left!==null&&left<=30?`<p class="staff-alert ${left<=7?'bad':''} billing-expiry" role="note">${t('This contract ends in')} <strong>${left} ${t(left===1?'day':'days')}</strong>. ${t(b.canEdit?'Issue a new contract so billing continues without a gap.':'Safeer will send a new contract before it ends.')}</p>`:!active&&b.contracts.some(k=>state.get(k.id)==='expired')?`<p class="staff-alert bad billing-expiry" role="note">${t('No contract is in force. The last one has ended.')}</p>`:''
  const summary=shown?`<div class="staff-summary billing-summary">${[...(active?[['Contract',`<bdi>${e(active.number)}</bdi>`]]:[]),['Monthly fee',`<bdi>${e(money(shown.monthlyFeeMinor,shown.currency))}</bdi>`],['Commission',`<bdi>${e(percent(shown.commissionBps))}</bdi><small>${t('of each paid booking and parcel')}</small>`],['Term',`<span class="billing-term">${term(shown)}</span>`],...(left!==null?[['Time left',`<bdi>${left}</bdi> ${t(left===1?'day':'days')}`]]:[])].map(([label,value])=>`<article><span>${t(label)}</span><strong>${value}</strong></article>`).join('')}</div>`
    :`<p class="billing-empty">${t(b.canEdit?'No plan yet. Set a monthly fee and commission to issue the first contract.':'No plan yet. The Safeer owner sets your plan and sends you the contract.')}</p>`;
  const pending=current&&!current.acceptedAt&&b.canAccept?`<aside class="staff-alert company-approval billing-accept" role="note"><span class="company-approval-copy"><strong>${t('Contract waiting for your acceptance')}</strong><span>${e(current.number)} · ${t('Read the PDF, then accept it on behalf of the company.')}</span></span><span class="staff-actions"><a class="staff-link" href="${contractPdfUrl(c.id,current.id,language)}" download>${t('Download PDF')}</a><button type="button" class="staff-primary" data-contract-accept="${e(current.id)}">${t('Accept contract')}</button></span></aside>`:'';
  const rows=b.contracts.map(k=>`<tr><td><bdi>${e(k.number)}</bdi></td><td><bdi>${e(day(k.issuedAt))}</bdi></td><td>${term(k)}</td><td><bdi>${e(money(k.monthlyFeeMinor,k.currency))}</bdi></td><td><bdi>${e(percent(k.commissionBps))}</bdi></td><td>${status(k)}${k.acceptedAt?`<small class="staff-muted billing-by">${e(k.acceptedByName)} · <bdi>${e(day(k.acceptedAt))}</bdi></small>`:''}</td><td><div class="staff-actions billing-row-actions"><a class="staff-link" href="${contractPdfUrl(c.id,k.id,language)}" download>${t('Download PDF')}</a>${!k.acceptedAt&&!k.supersededAt&&b.canAccept?`<button type="button" data-contract-accept="${e(k.id)}">${t('Accept')}</button>`:''}</div></td></tr>`).join('');
  return `<section class="staff-panel billing-panel"><header class="staff-section-head"><div><h2>${t('Plan & contract')}</h2><p>${t('Safeer charges a monthly fee plus a commission on paid bookings and parcels. Each new plan issues a contract to the company and to Safeer, delivered to both notification centers as a PDF.')}</p></div>${b.canEdit?`<button type="button" class="staff-primary" data-billing-edit>${t(plan?'New contract':'Set plan')}</button>`:''}</header>${pending}${expiring}${summary}${shown?.notes?`<p class="billing-notes"><strong>${t('Additional terms')}:</strong> ${e(shown.notes)}</p>`:''}</section>`
    +`<section class="staff-panel"><header class="staff-section-head"><div><h2>${t('Contracts')}</h2><p>${t('Issued contracts cannot be edited. A change is a new contract: it replaces the current one from its start date once the company accepts it, and a contract not yet accepted is withdrawn.')}</p></div></header>${rows?`<div class="staff-table-wrap"><table class="staff-table billing-table"><thead><tr>${['Contract','Issued','Term','Monthly fee','Commission','Status',''].map(h=>`<th>${h?t(h):`<span class="staff-visually-hidden">${t('Actions')}</span>`}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`:`<p class="staff-muted">${t('No contracts yet.')}</p>`}</section>`+invoicesView(b,c,{t,e,language,money,day});
}

// D87: monthly invoices (fee + commission on the month's net collections), issued by the Safeer owner.
const invoicePdfUrl=(companyId,id,language)=>`/api/v1/companies/${encodeURIComponent(companyId)}/invoices/${encodeURIComponent(id)}/pdf?lang=${language==='ar'?'ar':'en'}`;
const invoiceTone={issued:'is-wait',overdue:'is-late',paid:'is-ok',void:'is-old'},invoiceLabel={issued:'Awaiting payment',overdue:'Overdue',paid:'Paid',void:'Void'};
function invoicesView(b,c,{t,e,language,money,day}){
  const month=m=>new Intl.DateTimeFormat(language==='ar'?'ar-SD-u-nu-latn':'en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
  const list=b.invoices||[],open=list.filter(i=>i.status==='issued'||i.status==='overdue');
  const owed=open.length?`<p class="billing-owed"><strong>${t('Outstanding')}:</strong> ${[...new Set(open.map(i=>i.currency))].map(cur=>`<bdi>${e(money(open.filter(i=>i.currency===cur).reduce((s,i)=>s+BigInt(i.totalMinor),0n).toString(),cur))}</bdi>`).join(' · ')}${open.some(i=>i.status==='overdue')?` <span class="staff-badge billing-status is-late">${t('Overdue')}</span>`:''}</p>`:'';
  const rows=list.map(i=>`<tr><td><bdi>${e(i.number)}</bdi></td><td>${e(month(i.month))}</td><td><bdi>${e(money(i.feeMinor,i.currency))}</bdi></td><td><bdi>${e(money(i.commissionMinor,i.currency))}</bdi><small class="staff-muted billing-by">${e(percent(i.commissionBps))} × <bdi>${e(money((BigInt(i.paymentsMinor)-BigInt(i.refundsMinor)).toString(),i.currency))}</bdi></small></td><td><strong><bdi>${e(money(i.totalMinor,i.currency))}</bdi></strong></td><td><bdi>${e(day(i.dueOn))}</bdi></td><td><span class="staff-badge billing-status ${invoiceTone[i.status]}">${t(invoiceLabel[i.status])}</span>${i.paidReference?`<small class="staff-muted billing-by"><bdi>${e(i.paidReference)}</bdi></small>`:''}${i.voidReason?`<small class="staff-muted billing-by">${e(i.voidReason)}</small>`:''}</td><td><div class="staff-actions billing-row-actions"><a class="staff-link" href="${invoicePdfUrl(c.id,i.id,language)}" download>${t('Download PDF')}</a>${b.canEdit&&(i.status==='issued'||i.status==='overdue')?`<button type="button" data-invoice-paid="${e(i.id)}">${t('Mark paid')}</button><button type="button" data-invoice-void="${e(i.id)}">${t('Void')}</button>`:''}</div></td></tr>`).join('');
  return `<section class="staff-panel billing-invoices"><header class="staff-section-head"><div><h2>${t('Invoices')}</h2><p>${t('One invoice per month: the monthly fee plus the commission on that month\'s net collections (payments minus refunds) in the contract currency. Payment is due within 14 days.')}</p></div>${b.canEdit&&b.contracts.some(k=>k.acceptedAt)?`<button type="button" class="staff-primary" data-invoice-issue>${t('Issue invoice')}</button>`:''}</header>${owed}${rows?`<div class="staff-table-wrap"><table class="staff-table billing-table"><thead><tr>${['Invoice','Month','Monthly fee','Commission','Total','Due','Status',''].map(h=>`<th>${h?t(h):`<span class="staff-visually-hidden">${t('Actions')}</span>`}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`:`<p class="staff-muted">${t(b.contracts.some(k=>k.acceptedAt)?'No invoices yet.':'Invoices start once a contract is accepted.')}</p>`}</section>`;
}

export function bindBilling(root,data,{api,openForm,currentPassword,t,e}){
  const b=data.billing,path='companies/'+data.company.id;if(!b)return;
  root.querySelector('[data-billing-edit]')?.addEventListener('click',()=>{const p=b.plan;const today=b.today||new Date().toISOString().slice(0,10),state=contractState(b.contracts,today),active=b.contracts.find(k=>state.get(k.id)==='active')
    // A renewal starts the day after the current contract ends; otherwise today.
    const after=active?.endsOn?addDays(active.endsOn,1):today,start=after>today?after:today,end=addMonths(start,12)
    openForm(p?'Change plan':'Set plan',`<p>${t('Saving issues a new contract. The company and you receive it as a PDF in Notifications, and a company manager accepts it.')}</p><div class="billing-form-grid"><label>${t('Monthly fee')}<input name="fee" inputmode="decimal" dir="ltr" required pattern="[0-9][0-9,]*(\\.[0-9]{1,2})?" maxlength="16" value="${e(p?fromMinor(p.monthlyFeeMinor):'')}" placeholder="25000.00"></label><label>${t('Currency')}<input name="currency" dir="ltr" required maxlength="3" pattern="[A-Za-z]{3}" value="${e(p?.currency||'SDG')}"></label><label>${t('Commission (%)')}<input name="commission" type="number" dir="ltr" required min="0" max="50" step="0.01" value="${e(p?String(p.commissionBps/100):'')}" placeholder="3.5"></label><label>${t('Start date')}<input name="startsOn" type="date" required min="${e(today)}" value="${e(start)}"></label><label>${t('Length')}<select name="length">${[[6,'6 months'],[12,'1 year'],[24,'2 years'],[36,'3 years'],[0,'Custom end date']].map(([m,label])=>`<option value="${m}" ${m===12?'selected':''}>${t(label)}</option>`).join('')}</select></label><label>${t('End date')}<input name="endsOn" type="date" required min="${e(addDays(start,1))}" value="${e(end)}"></label></div><p class="staff-muted">${t('A contract cannot start in the past and cannot be edited after it is issued.')}${active?` ${t('The current contract stays in force until the company accepts this one.')}`:''}</p><label>${t('Additional terms (optional)')}<textarea name="notes" rows="3" maxlength="500">${e(p?.notes||'')}</textarea></label>`+currentPassword(),
      f=>api(path+'/billing','PUT',{monthlyFeeMinor:toMinor(f.get('fee')),commissionBps:Math.round(Number(f.get('commission'))*100),currency:String(f.get('currency')).toUpperCase(),startsOn:f.get('startsOn'),endsOn:f.get('endsOn'),notes:f.get('notes')||'',version:p?.version??null,currentPassword:f.get('currentPassword')}),{submit:'Issue contract'});
    // Length sets the end date; editing the end date by hand switches to Custom.
    const form=document.querySelector('#staff-dialog form'),startField=form?.querySelector('[name=startsOn]'),endField=form?.querySelector('[name=endsOn]'),lengthField=form?.querySelector('[name=length]')
    const sync=()=>{if(!startField.value)return
endField.min=addDays(startField.value,1)
const m=Number(lengthField.value)
if(m)endField.value=addMonths(startField.value,m)}
    startField?.addEventListener('change',sync)
lengthField?.addEventListener('change',sync)
endField?.addEventListener('input',()=>{lengthField.value='0'})
});
  root.querySelectorAll('[data-contract-accept]').forEach(button=>button.onclick=()=>{const k=b.contracts.find(x=>x.id===button.dataset.contractAccept);
    openForm('Accept contract',`<p><strong><bdi>${e(k.number)}</bdi></strong></p><p>${t('By accepting, you agree to this contract on behalf of the company. Your name and the time are recorded on both copies.')}</p>`+currentPassword(),f=>api(`${path}/contracts/${k.id}/accept`,'POST',{currentPassword:f.get('currentPassword')}),{submit:'Accept contract'});});
  // D87: issue last month's invoice by default; the server refuses a month that has not ended yet.
  root.querySelector('[data-invoice-issue]')?.addEventListener('click',()=>{const now=new Date(),last=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,1)).toISOString().slice(0,7);
    openForm('Issue invoice',`<p>${t('The invoice uses the accepted contract and the payments recorded for that month. The company receives it in Notifications.')}</p><label>${t('Service month')}<input name="month" type="month" required dir="ltr" max="${e(last)}" value="${e(last)}"></label>`+currentPassword(),
      f=>api(path+'/invoices','POST',{month:f.get('month'),currentPassword:f.get('currentPassword')}),{submit:'Issue invoice'});});
  root.querySelectorAll('[data-invoice-paid]').forEach(button=>button.onclick=()=>{const i=b.invoices.find(x=>x.id===button.dataset.invoicePaid);
    openForm('Mark paid',`<p><strong><bdi>${e(i.number)}</bdi></strong></p><label>${t('Payment reference')}<input name="reference" required maxlength="100" dir="auto" placeholder="${e(t('Bank transfer or receipt number'))}"></label>`+currentPassword(),
      f=>api(`${path}/invoices/${i.id}/paid`,'POST',{reference:f.get('reference'),currentPassword:f.get('currentPassword')}),{submit:'Mark paid'});});
  root.querySelectorAll('[data-invoice-void]').forEach(button=>button.onclick=()=>{const i=b.invoices.find(x=>x.id===button.dataset.invoiceVoid);
    openForm('Void invoice',`<p><strong><bdi>${e(i.number)}</bdi></strong></p><p>${t('A voided invoice stays on record. You can then issue that month again.')}</p><label>${t('Reason')}<input name="reason" required maxlength="300" dir="auto"></label>`+currentPassword(),
      f=>api(`${path}/invoices/${i.id}/void`,'POST',{reason:f.get('reason'),currentPassword:f.get('currentPassword')}),{submit:'Void invoice'});});
}

export function brandingView(data,{t,e,language}){
  const b=data.branding,c=data.company,name=e(language==='ar'?c.nameAr:c.nameEn),logo=companyLogoUrl(c.id,b);
  const swatch=(label,value,fallback)=>`<div><dt>${t(label)}</dt><dd><span class="brand-swatch" data-swatch="${e(value||fallback)}"></span><bdi>${e(value||t('Safeer default'))}</bdi></dd></div>`;
  return `<section class="staff-panel brand-panel"><header class="staff-section-head"><div><h2>${t('Brand & theme')}</h2><p>${t('Your logo and colors appear in your company workspace and on your public booking page.')}</p></div>${data.capabilities.profile?`<button type="button" class="staff-primary" data-brand-edit>${t('Edit brand')}</button>`:''}</header>
<div class="brand-layout"><div class="brand-preview" aria-label="${t('Preview')}"><div class="brand-preview-band">${logo?`<img src="${logo}" alt="" width="48" height="48">`:`<span class="brand-preview-mark" aria-hidden="true">${e((c.nameEn.trim()[0]||'').toUpperCase())}</span>`}<strong>${name}</strong></div><div class="brand-preview-body"><span class="brand-preview-line"></span><span class="brand-preview-line short"></span><span class="brand-preview-button">${t('Book seats')}</span></div></div>
<dl class="public-summary brand-facts">${swatch('Main color',b?.primaryColor,SAFEER_PRIMARY)}${swatch('Header color',b?.secondaryColor,SAFEER_HEADER)}<div><dt>${t('Logo')}</dt><dd>${logo?t('Uploaded'):t('No logo yet')}</dd></div></dl></div></section>`;
}

// The page's security policy forbids inline style attributes, so colors go through the style API.
export function applyBrand(root,data){
  const shell=root.querySelector('.staff-shell'),b=data?.branding;if(!shell)return;
  for(const [prop,value] of [['--accent',b?.primaryColor],['--material-enamel',b?.primaryColor],['--company-band',b?.secondaryColor]])value?shell.style.setProperty(prop,value):shell.style.removeProperty(prop);
  shell.classList.toggle('has-company-brand',Boolean(b?.primaryColor));
  root.querySelectorAll('[data-swatch]').forEach(node=>node.style.setProperty('background',node.dataset.swatch));
  const preview=root.querySelector('.brand-preview');if(preview){preview.style.setProperty('--preview-main',b?.primaryColor||SAFEER_PRIMARY);preview.style.setProperty('--preview-band',b?.secondaryColor||SAFEER_HEADER);}
}

const readFile=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('INVALID_LOGO'));reader.readAsDataURL(file);});
export function bindBranding(root,data,{api,openForm,currentPassword,t,e}){
  const b=data.branding,path='companies/'+data.company.id;
  root.querySelector('[data-brand-edit]')?.addEventListener('click',()=>{
    openForm('Edit brand',`<p>${t('Pick colors dark enough for white text. Buttons, links and highlights use the main color; your public page header uses the header color.')}</p><div class="billing-form-grid"><label>${t('Main color')}<input name="primaryColor" type="color" value="${e(b?.primaryColor||SAFEER_PRIMARY)}"></label><label>${t('Header color')}<input name="secondaryColor" type="color" value="${e(b?.secondaryColor||SAFEER_HEADER)}"></label></div><label class="staff-check"><input type="checkbox" name="reset">${t('Use the Safeer colors')}</label><label>${t('Logo (PNG, JPEG or WebP, up to 96 KB, square works best)')}<input name="logo" type="file" accept="image/png,image/jpeg,image/webp"></label>${b?.logoVersion?`<label class="staff-check"><input type="checkbox" name="removeLogo">${t('Remove the current logo')}</label>`:''}`+currentPassword(),
      async f=>{const file=f.get('logo'),reset=f.has('reset');let logo=null;
        if(file&&file.size){if(file.size>98304)throw Error('LOGO_TOO_LARGE');if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('INVALID_LOGO');logo=await readFile(file);}
        return api(path+'/branding','PUT',{primaryColor:reset?null:f.get('primaryColor'),secondaryColor:reset?null:f.get('secondaryColor'),logo,removeLogo:f.has('removeLogo')&&!logo,version:b?.version??null,currentPassword:f.get('currentPassword')});});
  });
}
