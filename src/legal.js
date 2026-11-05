import {themeButton} from './theme.js';

// Fill before store submission: a monitored email or web form for privacy and deletion requests.
// mobile/release.mjs refuses to build store bundles while this is empty.
export const SUPPORT_CONTACT='';

const params=new URLSearchParams(location.search),language=params.get('lang')==='ar'?'ar':'en',ar=language==='ar';
const page=location.pathname==='/account-deletion'?'deletion':'privacy';
const e=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const contact=SUPPORT_CONTACT?`<a href="mailto:${e(SUPPORT_CONTACT)}">${e(SUPPORT_CONTACT)}</a>`:(ar?'(يُضاف عنوان التواصل قبل النشر)':'(contact address is added before publishing)');
const T={
 en:{
  privacy:'Privacy policy',deletion:'Delete your account and data',updated:'Last updated 5 November 2026',
  back:'Back',other:'العربية',
  privacyBody:[
   ['Who we are','Safeer is a bus booking and station management service used by approved Sudanese bus companies. The Safeer Booking and Safeer Driver apps show the same Safeer service.'],
   ['What we collect',`<ul><li><b>Passengers:</b> each traveler's full name, one mobile number per booking, an optional luggage description, chosen seats, booking reference, tickets, payments recorded at the station and bag tags.</li><li><b>Staff and drivers:</b> name, work email, password (stored only as a one-way hash), role, company, sign-in sessions with device type, and an audit history of actions.</li><li><b>Technical:</b> a session cookie needed to stay signed in and your theme, language and sidebar choices stored on your device.</li></ul>We do not collect location, contacts, photos, camera or microphone data, and we show no advertising.`],
   ['How we use it','To hold seats, issue tickets and receipts, track luggage, let drivers check tickets and board passengers, keep financial records and protect accounts from misuse.'],
   ['Who receives it','Your booking details go only to the bus company operating your trip. Safeer does not sell personal data or share it with advertisers. Payments are recorded by the company at its station; Safeer does not process cards or wallets.'],
   ['How long we keep it','Passenger names, mobile numbers and luggage notes are erased automatically 90 days after the trip ends. Financial records (amounts, receipt and ticket numbers) are kept as required for accounting. Staff accounts stay until the company or the platform administrator removes them.'],
   ['Security','Data travels over encrypted connections. Passwords are hashed, access follows each person\'s company and role, and sensitive actions require the current password.'],
   ['Your choices',`You can ask to see, correct or delete your data. See <a href="/account-deletion?lang=en">Delete your account and data</a>. Contact: ${contact}.`],
  ],
  deletionBody:[
   ['Staff and driver accounts',`Ask your company manager to deactivate and delete your account, or send a deletion request from your work email to ${contact}. We confirm your identity, delete the account and its sessions within 30 days, and tell you when it is done.`],
   ['Passenger bookings',`Passengers do not create accounts. Booking details are erased automatically 90 days after the trip. To have them erased sooner, send your booking reference and mobile number to ${contact} or ask the bus company at its station.`],
   ['What is kept','Financial records that the law or accounting requires (amounts, ticket and receipt numbers) are kept without your name and mobile number. Audit entries keep the action but not your personal details after deletion.'],
  ]},
 ar:{
  privacy:'سياسة الخصوصية',deletion:'حذف حسابك وبياناتك',updated:'آخر تحديث ٥ نوفمبر ٢٠٢٦',
  back:'رجوع',other:'English',
  privacyBody:[
   ['من نحن','سفير خدمة لحجز الحافلات وإدارة المحطات تستخدمها شركات حافلات سودانية معتمدة. تطبيقا «حجز سفير» و«سائق سفير» يعرضان خدمة سفير نفسها.'],
   ['ما نجمعه',`<ul><li><b>الركاب:</b> الاسم الكامل لكل مسافر، ورقم جوال واحد لكل حجز، ووصف اختياري للأمتعة، والمقاعد المختارة، ورقم الحجز، والتذاكر، والمدفوعات المسجلة في المحطة، وبطاقات الأمتعة.</li><li><b>الموظفون والسائقون:</b> الاسم، والبريد الإلكتروني للعمل، وكلمة المرور (تُحفظ مشفرة باتجاه واحد فقط)، والدور، والشركة، وجلسات الدخول مع نوع الجهاز، وسجل تدقيق للإجراءات.</li><li><b>تقنياً:</b> ملف جلسة لازم لبقائك مسجلاً، واختيارات المظهر واللغة والقائمة الجانبية المحفوظة على جهازك.</li></ul>لا نجمع الموقع أو جهات الاتصال أو الصور أو بيانات الكاميرا أو الميكروفون، ولا نعرض إعلانات.`],
   ['كيف نستخدمها','لحجز المقاعد وإصدار التذاكر والإيصالات وتتبع الأمتعة وتمكين السائقين من فحص التذاكر وصعود الركاب وحفظ السجلات المالية وحماية الحسابات من إساءة الاستخدام.'],
   ['من يتلقاها','تصل بيانات حجزك فقط إلى شركة الحافلات المشغلة لرحلتك. لا يبيع سفير البيانات الشخصية ولا يشاركها مع المعلنين. تسجل الشركة المدفوعات في محطتها؛ ولا يعالج سفير البطاقات أو المحافظ.'],
   ['مدة الاحتفاظ','تُحذف أسماء الركاب وأرقام الجوال وملاحظات الأمتعة تلقائياً بعد ٩٠ يوماً من انتهاء الرحلة. تُحفظ السجلات المالية (المبالغ وأرقام الإيصالات والتذاكر) كما تتطلب المحاسبة. تبقى حسابات الموظفين حتى تحذفها الشركة أو مسؤول المنصة.'],
   ['الأمان','تنتقل البيانات عبر اتصالات مشفرة. كلمات المرور مشفرة، والوصول حسب شركة كل شخص ودوره، والإجراءات الحساسة تتطلب كلمة المرور الحالية.'],
   ['خياراتك',`يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها. راجع <a href="/account-deletion?lang=ar">حذف حسابك وبياناتك</a>. للتواصل: ${contact}.`],
  ],
  deletionBody:[
   ['حسابات الموظفين والسائقين',`اطلب من مدير شركتك إيقاف حسابك وحذفه، أو أرسل طلب حذف من بريد عملك إلى ${contact}. نتحقق من هويتك ونحذف الحساب وجلساته خلال ٣٠ يوماً ونبلغك عند الانتهاء.`],
   ['حجوزات الركاب',`لا ينشئ الركاب حسابات. تُحذف بيانات الحجز تلقائياً بعد ٩٠ يوماً من الرحلة. لحذفها قبل ذلك أرسل رقم الحجز ورقم الجوال إلى ${contact} أو اطلب ذلك من شركة الحافلات في محطتها.`],
   ['ما يُحتفظ به','تُحفظ السجلات المالية التي يتطلبها القانون أو المحاسبة (المبالغ وأرقام التذاكر والإيصالات) دون اسمك ورقم جوالك. تحتفظ سجلات التدقيق بالإجراء دون بياناتك الشخصية بعد الحذف.'],
  ]}}[language];
document.documentElement.lang=language;document.documentElement.dir=ar?'rtl':'ltr';
document.title='Safeer | '+(page==='privacy'?T.privacy:T.deletion);
const other=`${location.pathname}?lang=${ar?'en':'ar'}`;
document.getElementById('legal-app').innerHTML=`<header class="staff-topbar legal-top"><div class="staff-topbar-title"><strong>Safeer / سفير</strong></div><div class="staff-top-actions"><a class="staff-link" href="${other}">${T.other}</a>${themeButton(language)}</div></header>
<article class="staff-panel legal-body"><h1>${page==='privacy'?T.privacy:T.deletion}</h1><p class="staff-muted">${T.updated}</p>${(page==='privacy'?T.privacyBody:T.deletionBody).map(([h,b])=>`<h2>${h}</h2><div>${/^</.test(b)?b:`<p>${b}</p>`}</div>`).join('')}
<p><a href="${page==='privacy'?'/account-deletion':'/privacy'}?lang=${language}">${page==='privacy'?T.deletion:T.privacy}</a></p></article>`;
