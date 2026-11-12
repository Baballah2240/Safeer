// Runs before the page draws: marks JavaScript as available (so reveal animations can start hidden)
// and applies the saved or requested language direction, so Arabic visitors never see a flash of LTR.
(function () {
  var root = document.documentElement, lang = null;
  try { lang = new URLSearchParams(location.search).get('lang') || localStorage.getItem('safeer-site-lang'); } catch (e) { /* storage blocked */ }
  root.className += ' js';
  // Preload the headline font when served over the web; browsers refuse font preloads for files opened from disk.
  if (location.protocol !== 'file:') {
    var font = document.createElement('link');
    font.rel = 'preload'; font.as = 'font'; font.type = 'font/woff2'; font.href = '/src/fonts/inter-latin.woff2'; font.crossOrigin = 'anonymous';
    document.head.appendChild(font);
  }
  if (lang === 'ar') {
    root.lang = 'ar'; root.dir = 'rtl'; root.className += ' i18n-pending';
    // If the main script fails, never leave the page hidden.
    setTimeout(function () { root.classList.remove('i18n-pending'); }, 1500);
  }
})();
