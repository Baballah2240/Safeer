// D59 public shipment tracking by the random code on the receipt. Shows status and offices only.
import {themeButton} from './theme.js';

const root=document.querySelector('#track-app'),params=new URLSearchParams(location.search);
let language=params.get('lang')==='ar'?'ar':'en',code=(params.get('code')||'').trim().toUpperCase(),result=null,problem='',busy=false;
const pattern=/^SH-[2-9A-HJ-NP-Z]{8}$/;
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const words={
 en:{title:'Track a shipment',lead:'Enter the tracking code printed on the shipment receipt, for example',code:'Tracking code',track:'Track',back:'Find a bus trip',other:'العربية',
  invalid:'Enter a code in the form SH- followed by 8 letters and numbers.',missing:'We could not find that tracking code. Check it on the receipt.',busy:'Too many attempts. Try again later.',failed:'Tracking is unavailable right now. Try again shortly.',
  from:'From',to:'To',company:'Bus company',trip:'Trip',updated:'Last update',items:'Items',loading:'Checking…',
  collect:'The receiver collects it at the destination office with their phone number and full name.',
  received:'Received',loaded:'Loaded',in_transit:'In transit',arrived:'Arrived',delivered:'Delivered',returned:'Returned to sender',lost:'Lost',delayed:'Delayed — the company is checking it',canceled:'The trip was canceled. Contact the bus company.'},
 ar:{title:'تتبع شحنة',lead:'أدخل رمز التتبع المطبوع على إيصال الشحنة، مثل',code:'رمز التتبع',track:'تتبع',back:'ابحث عن رحلة حافلة',other:'English',
  invalid:'أدخل رمزاً يبدأ بـ SH- يليه ٨ أحرف وأرقام.',missing:'لم نعثر على رمز التتبع هذا. تحقق منه في الإيصال.',busy:'محاولات كثيرة. حاول لاحقاً.',failed:'التتبع غير متاح الآن. حاول بعد قليل.',
  from:'من',to:'إلى',company:'شركة الحافلات',trip:'الرحلة',updated:'آخر تحديث',items:'القطع',loading:'جارٍ التحقق…',
  collect:'يستلمها المستلم من مكتب الوجهة برقم هاتفه واسمه الكامل.',
  received:'مستلمة',loaded:'محمّلة',in_transit:'في الطريق',arrived:'وصلت',delivered:'سُلّمت',returned:'أُرجعت للمرسل',lost:'مفقودة',delayed:'متأخرة — تتحقق الشركة منها',canceled:'أُلغيت الرحلة. تواصل مع شركة الحافلات.'}};
const w=key=>words[language][key];
const steps=['received','loaded','in_transit','arrived','delivered'];
const when=(row,value)=>value?new Intl.DateTimeFormat(language==='ar'?'ar-SD':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:row.timezone}).format(new Date(value)):'';
const pick=(row,key)=>language==='ar'?row[key+'Ar']:row[key+'En'];

function progress(row){
 const at=steps.indexOf(row.status);
 if(at<0)return `<p class="track-state track-state-${e(row.status)}" role="status"><strong>${e(w(row.status))}</strong></p>`;
 return `<ol class="track-steps" aria-label="${e(w('title'))}">${steps.map((s,i)=>`<li class="${i<at?'done':i===at?'current':''}" ${i===at?'aria-current="step"':''}><span aria-hidden="true"></span>${e(w(s))}</li>`).join('')}</ol>`;
}
function view(){
 document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';document.title='Safeer | '+w('title');
 const row=result;
 const card=row?`<section class="market-card track-result" aria-live="polite"><p class="market-small"><bdi>${e(row.trackingCode)}</bdi></p>${progress(row)}
  ${row.tripCanceled&&row.status!=='delivered'?`<p class="staff-alert bad">${e(w('canceled'))}</p>`:''}
  <dl class="track-facts"><div><dt>${e(w('from'))}</dt><dd>${e(pick(row,'origin'))}</dd></div><div><dt>${e(w('to'))}</dt><dd>${e(pick(row,'destination'))}</dd></div>
  <div><dt>${e(w('company'))}</dt><dd>${e(pick(row,'companyName'))}</dd></div><div><dt>${e(w('trip'))}</dt><dd>${e(pick(row,'routeName'))} · <bdi>${e(when(row,row.departureAt))}</bdi></dd></div>
  <div><dt>${e(w('items'))}</dt><dd><bdi>${e(row.itemCount)}</bdi></dd></div>${row.updatedAt?`<div><dt>${e(w('updated'))}</dt><dd><bdi>${e(when(row,row.updatedAt))}</bdi></dd></div>`:''}</dl>
  ${row.status==='arrived'?`<p class="market-note">${e(w('collect'))}</p>`:''}</section>`:'';
 root.innerHTML=`<header class="market-bar track-bar"><a class="market-link" href="/marketplace?lang=${language}">${e(w('back'))}</a><div class="track-tools">${themeButton(language)}<button type="button" class="secondary" id="track-language" lang="${language==='en'?'ar':'en'}">${e(w('other'))}</button></div></header>
 <main class="market-wrap track-wrap"><section class="market-card"><h1>${e(w('title'))}</h1><p>${e(w('lead'))} <bdi dir="ltr">SH-AB23CD45</bdi></p>
 <form id="track-form" class="track-form" novalidate><label>${e(w('code'))}<input name="code" dir="ltr" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="11" placeholder="SH-AB23CD45" value="${e(code)}" ${problem?'aria-invalid="true" aria-describedby="track-problem"':''}></label><button class="market-book" ${busy?'disabled':''}>${e(busy?w('loading'):w('track'))}</button></form>
 ${problem?`<p class="staff-alert bad" id="track-problem" role="alert">${e(w(problem))}</p>`:''}</section>${card}</main>`;
 root.querySelector('#track-form').onsubmit=event=>{event.preventDefault();code=new FormData(event.target).get('code').trim().toUpperCase();void lookup();};
 root.querySelector('#track-language').onclick=()=>{language=language==='en'?'ar':'en';const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);view();};
}
async function lookup(){
 result=null;problem='';
 if(!pattern.test(code)){problem='invalid';view();root.querySelector('[name=code]').focus();return;}
 busy=true;view();
 const url=new URL(location.href);url.searchParams.set('code',code);history.replaceState(null,'',url);
 try{
  const response=await fetch('/api/v1/public/shipments/'+encodeURIComponent(code),{headers:{Accept:'application/json'},cache:'no-store'});
  if(response.status===404)problem='missing';else if(response.status===429)problem='busy';else if(!response.ok)problem='failed';
  else result=(await response.json()).data;
 }catch{problem='failed';}
 busy=false;view();
}
view();
if(code)void lookup();
