// Arabic text: notice shown by the retired Android apps (moved from src/app-retired.js).
// passenger: true for the old booking app, false for the old driver app.
export default passenger=>({
  old:passenger?'تطبيق سفير للحجز':'تطبيق سفير للسائق',
  title:'تم استبدال هذا التطبيق',
  lead:passenger?'لدى سفير تطبيق جديد للمسافرين هو سفير المسافر. لم يعد هذا الإصدار يفتح سفير.':'لدى سفير تطبيق جديد للسائقين هو سفير السائق. لم يعد هذا الإصدار يفتح سفير.',
  download:passenger?'تنزيل سفير المسافر':'تنزيل سفير السائق',
  meta:(version,size)=>`أندرويد 8 أو أحدث · الإصدار <bdi>${version}</bdi>${size?` · <bdi>${size}</bdi>&nbsp;ميغابايت`:''}`,
  steps:['اضغط زر التنزيل.','افتح الملف الذي تم تنزيله واضغط تحديث. يُثبَّت التطبيق الجديد فوق هذا التطبيق.',passenger?'افتح سفير المسافر.':'افتح سفير السائق وسجّل الدخول بحساب السائق.'],
  note:passenger?'حجزت بهذا التطبيق من قبل؟ افتح <bdi dir="ltr">safeer.mohbaba.online/booking</bdi> في متصفح هاتفك واستخدم «ابحث عن حجزك» بمرجع الحجز ورقم الجوال.':'رحلاتك وسجلات الصعود محفوظة على سفير ولن تتغير.',
  other:'English',otherLang:'en',otherLabel:'Switch to English'
 });
