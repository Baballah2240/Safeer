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
  // D138: other languages' texts live in src/locales/<language>/home.js and load when chosen.
  var LOCALE = {}, LIST = null;
  function loadLanguage(lang) {
    return Promise.all([
      LIST ? Promise.resolve() : import('/src/locales/index.js').then(function (m) { LIST = m; }),
      lang === 'en' || LOCALE[lang] ? Promise.resolve() : import('/src/locales/' + lang + '/home.js').then(function (m) { LOCALE[lang] = m.default; }),
      LOCALE.en ? Promise.resolve() : import('/src/locales/en/home.js').then(function (m) { LOCALE.en = m.default; })
    ]);
  }
  var META = {
    en: {title: document.title, description: ($('meta[name=description]') || {}).content || ''}
  };
  var textNodes = $$('[data-i18n]'), attrNodes = $$('[data-i18n-attr]'), toggles = $$('[data-lang-toggle]'), safeerLinks = $$('a[data-safeer]');
  var EN = {}, ENA = {};
  textNodes.forEach(function (n) { EN[n.getAttribute('data-i18n')] = n.innerHTML; });
  var attrPairs = function (n) { return n.getAttribute('data-i18n-attr').split(';').map(function (p) { return p.split(':'); }); };
  attrNodes.forEach(function (n) { attrPairs(n).forEach(function (p) { ENA[p[1]] = n.getAttribute(p[0]); }); });
  safeerLinks.forEach(function (a) { a.setAttribute('data-base', a.getAttribute('href')); });

  function applyLanguage(lang) {
    var english = lang === 'en' || !LOCALE[lang], words = english ? null : LOCALE[lang], next = LIST ? LIST.nextLanguage(lang) : (lang === 'en' ? 'ar' : 'en');
    root.lang = english ? 'en' : lang; root.dir = !english && LIST && LIST.isRtl(lang) ? 'rtl' : 'ltr';
    textNodes.forEach(function (n) { var k = n.getAttribute('data-i18n'), v = english ? EN[k] : words.text[k]; if (v != null) n.innerHTML = v; });
    attrNodes.forEach(function (n) { attrPairs(n).forEach(function (p) { var v = english ? ENA[p[1]] : words.text[p[1]]; if (v != null) n.setAttribute(p[0], v); }); });
    document.title = english ? META.en.title : words.title;
    var description = $('meta[name=description]'); if (description) description.content = english ? META.en.description : words.description;
    // The switch offers the next language in the list, named in that language.
    toggles.forEach(function (b) { b.textContent = LIST ? LIST.languageName(next) : (next === 'ar' ? 'العربية' : 'English'); b.lang = next; var label = LOCALE[next] && LOCALE[next].switchLabel; if (label) b.setAttribute('aria-label', label); });
    // The live Safeer pages follow the chosen language.
    safeerLinks.forEach(function (a) { var base = a.getAttribute('data-base'); a.href = english ? base : base + (base.indexOf('?') < 0 ? '?' : '&') + 'lang=' + lang; });
    root.classList.remove('i18n-pending');
    requestScroll();
  }

  toggles.forEach(function (b) {
    b.addEventListener('click', function () {
      var next = LIST ? LIST.nextLanguage(root.lang) : (root.lang === 'ar' ? 'en' : 'ar');
      // Usually already loaded in the background, so the switch is instant.
      if (next === 'en' || LOCALE[next]) applyLanguage(next);
      else loadLanguage(next).then(function () { applyLanguage(next); }, function () { applyLanguage('en'); });
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
  var asked = root.lang && root.lang !== 'en' ? root.lang : 'en';
  loadLanguage(asked).then(function () {
    applyLanguage(LIST && LIST.supported(asked) ? asked : 'en');
    loadLanguage(LIST.nextLanguage(root.lang)).catch(function () { /* the switch loads it on click instead */ });
  }, function () { applyLanguage('en'); });
  update();
  window.requestAnimationFrame(function () { window.requestAnimationFrame(function () { root.classList.add('hero-ready'); }); });
})();
