// D76 Safeer home page behaviour: language, reveal and scroll motion, tabs, menu. Stagger indexes are set
// here because the Content-Security-Policy blocks inline style attributes. Motion uses transform/opacity only and honours prefers-reduced-motion.
(function () {
  'use strict';
  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wideQuery = window.matchMedia('(min-width: 960px)');

  /* ---------- Language ---------- */
  var AR = {
    'skip': 'انتقل إلى المحتوى', 'brand.home': 'سفير، العودة إلى الأعلى', 'nav.label': 'القائمة الرئيسية',
    'nav.about': 'من نحن', 'nav.travel': 'السفر', 'nav.shipping': 'الشحن', 'nav.how': 'كيف يعمل', 'nav.routes': 'الخطوط', 'nav.menu': 'القائمة',
    'cta.book': 'احجز رحلة', 'cta.send': 'أرسل طردًا', 'cta.track': 'تتبّع طردًا', 'cta.find': 'ابحث عن رحلة',
    'hero.alt': 'حافلة سفر بيضاء على طريق صحراوي', 'hero.eyebrow': 'السفر البري والشحن بين المدن في السودان',
    'hero.title': 'سافر واشحن بين مدن السودان بالطريقة الموثوقة.',
    'hero.lead': 'احجز مقعدك لدى شركات حافلات معتمدة، أو أرسل طردك على الحافلات نفسها. اختر مقعدك عبر الإنترنت، وادفع في المحطة، وتابع كل خطوة.',
    'chip.approved': 'شركات حافلات معتمدة', 'chip.pay': 'الدفع في المحطة', 'chip.track': 'تذاكر QR ورموز تتبّع', 'hero.scroll': 'مرّر لمعرفة المزيد',
    'about.eyebrow': 'عن سفير', 'about.title': 'منصة واحدة للطريق بين المدن.',
    'about.p1': 'يجمع سفير شركات الحافلات السودانية المعتمدة في مكان واحد، لتجد رحلتك وتختار مقعدك وترسل طردك بلا عناء.',
    'about.p2': 'تدير الشركات الحافلات والمحطات، ويحفظ سفير كل حجز وتذكرة وطرد منظَّمًا وسهل المتابعة.',
    'value.safe.t': 'آمن', 'value.safe.d': 'شركات حافلات معتمدة فقط، وتُفحص كل تذكرة عند الصعود.',
    'value.fast.t': 'سريع', 'value.fast.d': 'اعثر على رحلتك واحجز مقاعدك ببضع لمسات من أي هاتف.',
    'value.org.t': 'منظَّم', 'value.org.d': 'أسعار واضحة وإيصالات ورموز تتبّع لكل حجز وطرد.',
    'value.welcome.t': 'مُرحِّب', 'value.welcome.d': 'بالعربية والإنجليزية، ودون حاجة إلى حساب للحجز.',
    'travel.eyebrow': 'سفر الركاب', 'travel.title': 'مقاعد مريحة وخطط واضحة.',
    'travel.lead': 'قارن الرحلات المنشورة بين المدن، واعرف السعر قبل أن تقرر، واختر المقاعد التي تريدها.',
    'seat.title': 'اختر مقاعدك', 'seat.picked': 'مقاعدك', 'seat.taken': 'محجوز',
    'travel.f1.t': 'اختر مقعدك', 'travel.f1.d': 'شاهد خريطة المقاعد واختر مقعدًا لكل مسافر.',
    'travel.f2.t': 'اعرف السعر أولًا', 'travel.f2.d': 'تعرض كل رحلة سعرها قبل أن تحجز مقعدًا.',
    'travel.f3.t': 'احجز الآن وادفع في المحطة', 'travel.f3.d': 'تبقى مقاعدك محجوزة لمدة محددة حتى تدفع للشركة حضوريًا.',
    'travel.f4.t': 'تذكرة QR للصعود', 'travel.f4.d': 'بعد الدفع تظهر تذكرتك على هاتفك، ويفحصها السائق عند صعودك.',
    'travel.f5.t': 'أمتعتك ببطاقات', 'travel.f5.d': 'صرّح بأمتعتك عند الحجز، وتضع المحطة عليها بطاقات للرحلة.',
    'travel.f6.t': 'احجز كضيف', 'travel.f6.d': 'لا حاجة إلى حساب. احتفظ برقم الحجز لتعثر عليه لاحقًا.',
    'ship.eyebrow': 'الشحن بين المدن', 'ship.title': 'أرسل طرودك على الحافلات التي تثق بها.',
    'ship.lead': 'سلّم طردك في مكتب شركة الحافلات، فيسافر على رحلة مجدولة وينتظر بأمان في مكتب الوصول حتى يستلمه الشخص الصحيح.',
    'ship.f1.t': 'أسعار ثابتة وبسيطة', 'ship.f1.d': 'سعر واحد لكل نوع: ظرف أو طرد صغير أو طرد كبير أو غرض آخر.',
    'ship.f2.t': 'ادفع مرة واحدة عند التسليم', 'ship.f2.d': 'تحصل على إيصال مطبوع يحمل رمز التتبّع.',
    'ship.f3.t': 'تتبّع كل خطوة', 'ship.f3.d': 'تابعه من الاستلام إلى الحافلة ثم الوصول والتسليم.',
    'ship.f4.t': 'للمستلم الصحيح فقط', 'ship.f4.d': 'يجب أن يطابق اسم المستلم ورقم هاتفه ما أدخلته.',
    'ship.f5.t': 'خصوصية منذ البداية', 'ship.f5.d': 'يعرض التتبّع العام الحالة والمكاتب فقط، دون أسماء أو أرقام.',
    'ship.note': 'غير مقبول: النقود والأسلحة والمواد الخطرة والحيوانات الحية والأطعمة سريعة التلف.',
    'track.example': 'طرد للتوضيح', 'track.code': 'رمز التتبّع',
    'track.s1': 'استُلم في المكتب', 'track.s2': 'حُمِّل على الحافلة', 'track.s3': 'في الطريق', 'track.s4': 'وصل إلى مكتب الوصول', 'track.s5': 'سُلِّم إلى المستلم', 'track.now': 'الآن',
    'city.portsudan': 'بورتسودان', 'city.kassala': 'كسلا', 'city.khartoum': 'الخرطوم', 'city.madani': 'ود مدني', 'city.atbara': 'عطبرة', 'city.gedaref': 'القضارف', 'city.kosti': 'كوستي', 'city.obeid': 'الأبيض',
    'how.eyebrow': 'كيف يعمل', 'how.title': 'ثلاث خطوات بسيطة.', 'how.tabs': 'اختر الخدمة', 'how.tab.travel': 'السفر', 'how.tab.ship': 'الشحن',
    'how.t1.t': 'اعثر على رحلتك', 'how.t1.d': 'اختر مسارك وتاريخك، وقارن الرحلات، واختر مقاعدك.',
    'how.t2.t': 'احجز وادفع', 'how.t2.d': 'تبقى مقاعدك محجوزة حتى تدفع في محطة الشركة.',
    'how.t3.t': 'اصعد وانطلق', 'how.t3.d': 'أظهر تذكرة QR للسائق واستمتع بالرحلة.',
    'how.s1.t': 'سلّم طردك', 'how.s1.d': 'أحضر طردك إلى مكتب الشركة مع اسم المستلم ورقم هاتفه.',
    'how.s2.t': 'يسافر بالحافلة', 'how.s2.d': 'ادفع السعر الثابت، واحتفظ برمز التتبّع، وتابع رحلته.',
    'how.s3.t': 'يُستلم بأمان', 'how.s3.d': 'يقدّم المستلم بيانات مطابقة في مكتب الوصول.',
    'routes.eyebrow': 'الخطوط', 'routes.title': 'خطوط رئيسية عبر السودان.',
    'routes.lead': 'تنشر شركات الحافلات على سفير رحلاتها ومواعيدها بنفسها. ابحث لترى المتاح على مسارك.',
    'routes.both': 'ركاب وطرود', 'routes.see': 'عرض الرحلات',
    'trust.eyebrow': 'لماذا سفير', 'trust.title': 'صُمّم لراحة بالك.', 'trust.lead': 'صُمّم كل جزء في سفير لتعرف دائمًا ما الذي سيحدث بعد ذلك.',
    'trust.p1.t': 'شركات معتمدة فقط', 'trust.p1.d': 'لا تظهر شركات الحافلات على سفير إلا بعد اعتمادها.',
    'trust.p2.t': 'أسعار واضحة مسبقًا', 'trust.p2.d': 'تظهر أسعار الرحلات والطرود قبل أن تدفع.',
    'trust.p3.t': 'إيصال لكل دفعة', 'trust.p3.d': 'تُسجَّل المدفوعات في المحطة مع إيصال تحتفظ به.',
    'trust.p4.t': 'فحص التذاكر عند الصعود', 'trust.p4.d': 'يفحص السائقون كل تذكرة، فلا يصعد إلا المسافرون المحجوزون.',
    'trust.p5.t': 'الطرود للشخص الصحيح', 'trust.p5.d': 'لا يُسلَّم الطرد إلا عند تطابق بيانات المستلم.',
    'trust.p6.t': 'بياناتك محمية', 'trust.p6.d': 'تُحذف بيانات الركاب بعد ٩٠ يومًا من الرحلة.',
    'cta.title': 'إلى أين وجهتك؟', 'cta.lead': 'احجز مقعدك أو أرسل طردك اليوم. لديك سؤال عن رحلة؟ تواصل مع شركة الحافلات من صفحتها على سفير.',
    'cta.book.t': 'احجز رحلة', 'cta.book.d': 'ابحث في الخطوط، وقارن الرحلات، واختر مقعدك.', 'cta.book.btn': 'ابحث عن الرحلات',
    'cta.send.t': 'أرسل طردًا', 'cta.send.d': 'سلّمه في مكتب الشركة وتابعه برمز التتبّع.',
    'cta.company': 'تدير شركة حافلات؟ سجّل الدخول إلى مساحة الموظفين.',
    'footer.desc': 'السفر البري والشحن بين المدن في السودان مع شركات حافلات معتمدة.', 'footer.label': 'روابط التذييل',
    'footer.travel': 'السفر', 'footer.book': 'احجز رحلة', 'footer.mytrips': 'رحلاتي',
    'footer.shipping': 'الشحن', 'footer.track': 'تتبّع طردًا', 'footer.howship': 'كيف يعمل الشحن',
    'footer.safeer': 'سفير', 'footer.about': 'من نحن', 'footer.companies': 'لشركات الحافلات',
    'footer.help': 'المساعدة', 'footer.privacy': 'سياسة الخصوصية', 'footer.delete': 'حذف الحساب والبيانات',
    'footer.rights': 'سفير. جميع الحقوق محفوظة.'
  };
  var META = {
    en: {title: document.title, description: ($('meta[name=description]') || {}).content || ''},
    ar: {title: 'سفير | السفر البري وشحن الطرود في السودان', description: 'سفير: احجز مقاعدك لدى شركات حافلات معتمدة وأرسل طرودك بين مدن السودان. اختر مقعدك عبر الإنترنت، وادفع في المحطة، وتابع كل خطوة.'}
  };
  var textNodes = $$('[data-i18n]'), attrNodes = $$('[data-i18n-attr]'), toggles = $$('[data-lang-toggle]'), safeerLinks = $$('a[data-safeer]');
  var EN = {}, ENA = {};
  textNodes.forEach(function (n) { EN[n.getAttribute('data-i18n')] = n.innerHTML; });
  var attrPairs = function (n) { return n.getAttribute('data-i18n-attr').split(';').map(function (p) { return p.split(':'); }); };
  attrNodes.forEach(function (n) { attrPairs(n).forEach(function (p) { ENA[p[1]] = n.getAttribute(p[0]); }); });
  safeerLinks.forEach(function (a) { a.setAttribute('data-base', a.getAttribute('href')); });

  function applyLanguage(lang) {
    var ar = lang === 'ar';
    root.lang = lang; root.dir = ar ? 'rtl' : 'ltr';
    textNodes.forEach(function (n) { var k = n.getAttribute('data-i18n'), v = ar ? AR[k] : EN[k]; if (v != null) n.innerHTML = v; });
    attrNodes.forEach(function (n) { attrPairs(n).forEach(function (p) { var v = ar ? AR[p[1]] : ENA[p[1]]; if (v != null) n.setAttribute(p[0], v); }); });
    document.title = META[lang].title;
    var description = $('meta[name=description]'); if (description) description.content = META[lang].description;
    toggles.forEach(function (b) { b.textContent = ar ? 'English' : 'العربية'; b.lang = ar ? 'en' : 'ar'; b.setAttribute('aria-label', ar ? 'Switch to English' : 'التبديل إلى العربية'); });
    // The live Safeer pages follow the chosen language.
    safeerLinks.forEach(function (a) { var base = a.getAttribute('data-base'); a.href = ar ? base + (base.indexOf('?') < 0 ? '?' : '&') + 'lang=ar' : base; });
    root.classList.remove('i18n-pending');
    requestScroll();
  }
  toggles.forEach(function (b) {
    b.addEventListener('click', function () {
      var next = root.lang === 'ar' ? 'en' : 'ar';
      applyLanguage(next);
      try { localStorage.setItem('safeer-site-lang', next); } catch (e) { /* storage blocked */ }
      try { var url = new URL(location.href); if (url.searchParams.has('lang')) { url.searchParams.delete('lang'); history.replaceState(null, '', url); } } catch (e) { /* file:// */ }
    });
  });

  /* ---------- Header, progress, parallax and the moving bus ---------- */
  var header = $('[data-header]'), progress = $('.scroll-progress'), hero = $('.hero');
  var heroMedia = $('[data-hero-media]'), heroCopy = $('[data-hero-copy]'), steps = $('[data-steps]');
  var reduce = reduceQuery.matches, ticking = false;
  function update() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset, vh = window.innerHeight;
    var max = Math.max(1, document.documentElement.scrollHeight - vh);
    header.classList.toggle('is-solid', y > 16);
    progress.style.setProperty('--progress', clamp(y / max, 0, 1).toFixed(4));
    if (reduce) { heroMedia.style.transform = heroCopy.style.transform = ''; steps.style.setProperty('--p', '1'); return; }
    var p = clamp(y / Math.max(1, hero.offsetHeight), 0, 1);
    // The bus drifts slower than the page and the headline lifts away; phones keep it still.
    heroMedia.style.transform = wideQuery.matches ? 'translate3d(0,' + (p * 72).toFixed(1) + 'px,0)' : '';
    heroCopy.style.transform = wideQuery.matches ? 'translate3d(0,' + (-p * 44).toFixed(1) + 'px,0)' : '';
    var r = steps.getBoundingClientRect();
    steps.style.setProperty('--p', clamp((vh * 0.85 - r.top) / (vh * 0.6), 0, 1).toFixed(3));
  }
  function requestScroll() { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }
  window.addEventListener('scroll', requestScroll, {passive: true});
  window.addEventListener('resize', requestScroll);
  var onReduce = function (e) { reduce = e.matches; requestScroll(); };
  if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', onReduce); else reduceQuery.addListener(onReduce);

  /* ---------- Reveal on scroll ---------- */
  $$('[data-hero-item]').forEach(function (n, i) { n.style.setProperty('--i', String(i)); });
  $$('.track-steps li').forEach(function (n, i) { n.style.setProperty('--i', String(i)); });
  $$('[data-reveal-group]').forEach(function (g) { Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty('--i', String(Math.min(i, 7))); }); });
  var revealables = $$('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, {rootMargin: '0px 0px -8% 0px', threshold: 0.12});
    revealables.forEach(function (el) { io.observe(el); });
  } else revealables.forEach(function (el) { el.classList.add('is-in'); });

  /* ---------- Mobile menu ---------- */
  var nav = $('[data-nav]'), menuButton = $('[data-menu-toggle]');
  function setMenu(open) {
    nav.classList.toggle('is-open', open); header.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    if (open) { var first = $('a', nav); if (first) first.focus(); }
  }
  menuButton.addEventListener('click', function () { setMenu(menuButton.getAttribute('aria-expanded') !== 'true'); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') { setMenu(false); menuButton.focus(); } });
  document.addEventListener('click', function (e) { if (nav.classList.contains('is-open') && !e.target.closest('[data-header]')) setMenu(false); });
  var desktopNav = window.matchMedia('(min-width: 1024px)');
  var onDesktop = function (e) { if (e.matches) setMenu(false); };
  if (desktopNav.addEventListener) desktopNav.addEventListener('change', onDesktop); else desktopNav.addListener(onDesktop);

  /* ---------- How it works tabs ---------- */
  var tabs = $$('[role=tab]');
  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      var rtl = root.dir === 'rtl', n = null;
      if (e.key === 'ArrowRight') n = rtl ? i - 1 : i + 1;
      if (e.key === 'ArrowLeft') n = rtl ? i + 1 : i - 1;
      if (e.key === 'Home') n = 0;
      if (e.key === 'End') n = tabs.length - 1;
      if (n !== null) { e.preventDefault(); selectTab(tabs[(n + tabs.length) % tabs.length], true); }
    });
  });

  /* ---------- Current section in the menu ---------- */
  var navLinks = $$('.site-nav a[href^="#"]');
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) { var on = a.getAttribute('href') === '#' + e.target.id; a.classList.toggle('is-current', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      });
    }, {rootMargin: '-45% 0px -50% 0px'});
    navLinks.forEach(function (a) { var s = document.getElementById(a.getAttribute('href').slice(1)); if (s) spy.observe(s); });
  }

  /* ---------- Start ---------- */
  $$('[data-year]').forEach(function (n) { n.textContent = String(new Date().getFullYear()); });
  if (root.lang === 'ar') applyLanguage('ar'); else root.classList.remove('i18n-pending');
  update();
  window.requestAnimationFrame(function () { window.requestAnimationFrame(function () { root.classList.add('hero-ready'); }); });
})();
