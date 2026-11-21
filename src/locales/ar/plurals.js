// Arabic counted phrases for the booking site (Intl.PluralRules categories: zero, one, two, few, many, other).
export default {
 trips:{zero:()=>'لا توجد رحلات',one:()=>'رحلة واحدة',two:()=>'رحلتان',few:n=>`${n} رحلات`,many:n=>`${n} رحلة`,other:n=>`${n} رحلة`},
 seatsLeft:{zero:()=>'لا توجد مقاعد متبقية',one:()=>'مقعد واحد متبقٍ',two:()=>'مقعدان متبقيان',few:n=>`${n} مقاعد متبقية`,many:n=>`${n} مقعداً متبقياً`,other:n=>`${n} مقعد متبقٍ`},
 upcoming:{zero:()=>'لا توجد رحلات قادمة',one:()=>'رحلة قادمة واحدة',two:()=>'رحلتان قادمتان',few:n=>`${n} رحلات قادمة`,many:n=>`${n} رحلة قادمة`,other:n=>`${n} رحلة قادمة`}
};
