(function () {
  'use strict';

  var DEFAULT_LANG = 'ar';
  var localeCache = window.KHOD_DASHBOARD_LOCALES || {};
  var observer = null;
  var applying = false;

  function lang() {
    return window._kbotLang || localStorage.getItem('kbot-lang') || DEFAULT_LANG;
  }

  function pack(nextLang) {
    return localeCache[nextLang || lang()] || localeCache.en || localeCache.ar || { dir: 'rtl', locale: 'ar-EG-u-nu-latn', strings: {}, raw: {} };
  }

  function interpolate(value, params) {
    if (!params || typeof value !== 'string') return value;
    return value.replace(/\{(\w+)\}/g, function (_, key) {
      return params[key] == null ? '' : String(params[key]);
    });
  }

  function t(key, params) {
    var active = pack();
    var fallback = pack(DEFAULT_LANG);
    var value = active.strings && active.strings[key];
    if (value == null && fallback.strings) value = fallback.strings[key];
    if (value == null && window._t) {
      var ext = window._t('dashboard.' + key);
      if (ext !== 'dashboard.' + key) value = ext;
    }
    if (value == null) value = key;
    if (typeof value === 'function') value = value(params);
    return interpolate(value, params);
  }

  function isRtl() {
    return (pack().dir || 'rtl') === 'rtl';
  }

  function dir() {
    return isRtl() ? 'rtl' : 'ltr';
  }

  function locale() {
    return pack().locale || (isRtl() ? 'ar-EG-u-nu-latn' : 'en-US');
  }

  function rawMap() {
    return (pack().raw || {});
  }

  function translateRaw(text) {
    if (isRtl() || text == null) return text;
    var output = String(text);
    var map = rawMap();
    Object.keys(map)
      .sort(function (a, b) { return b.length - a.length; })
      .forEach(function (source) {
        if (!source) return;
        output = output.split(source).join(map[source]);
      });
    return output;
  }

  function formatNumber(value, opts) {
    var n = Number(value);
    if (!isFinite(n)) return value == null ? '' : String(value);
    return new Intl.NumberFormat(locale(), opts || {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(n);
  }

  function formatCurrency(value, currency, decimals) {
    var n = Number(value);
    if (!isFinite(n)) return value == null ? '' : String(value);
    return new Intl.NumberFormat(locale(), {
      style: 'currency',
      currency: currency || 'SAR',
      minimumFractionDigits: decimals == null ? 0 : decimals,
      maximumFractionDigits: decimals == null ? 0 : decimals
    }).format(n);
  }

  function monthName(index) {
    var names = isRtl()
      ? ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
      : ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return names[index] || '';
  }

  function formatMonth(year, monthIndex) {
    return monthName(monthIndex) + ' ' + formatNumber(year, { useGrouping: false });
  }

  function formatTime(ts) {
    var d = ts instanceof Date ? ts : new Date(ts);
    if (isNaN(d.getTime())) return t('shell.noUpdate');
    return new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(d);
  }

  function formatTimestamp(ts) {
    if (!ts) return t('shell.noUpdate');
    var d = new Date(ts);
    if (isNaN(d.getTime())) return t('shell.noUpdate');
    var now = new Date();
    var sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    if (sameDay) return t('time.todayAt', { time: formatTime(d) });
    return new Intl.DateTimeFormat(locale(), {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  }

  function localizeTextNode(node) {
    if (!node || !node.nodeValue || !/[\u0600-\u06FF]/.test(node.nodeValue)) return;
    var translated = translateRaw(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
  }

  function localizeAttributes(el) {
    ['title', 'aria-label', 'placeholder', 'value'].forEach(function (attr) {
      if (!el.hasAttribute || !el.hasAttribute(attr)) return;
      var value = el.getAttribute(attr);
      if (!/[\u0600-\u06FF]/.test(value || '')) return;
      el.setAttribute(attr, translateRaw(value));
    });
  }

  function apply(root) {
    root = root || document.getElementById('page-dashboard');
    if (!root || applying) return;
    applying = true;
    try {
      root.setAttribute('dir', dir());
      root.setAttribute('lang', lang());
      root.classList.toggle('dash-dir-rtl', isRtl());
      root.classList.toggle('dash-dir-ltr', !isRtl());

      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          var parent = node.parentElement;
          if (!parent || /^(SCRIPT|STYLE|TEXTAREA)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
          return /[\u0600-\u06FF]/.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      });
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(localizeTextNode);
      root.querySelectorAll('[title],[aria-label],[placeholder]').forEach(localizeAttributes);
    } finally {
      applying = false;
    }
  }

  function setDirectionClasses() {
    var page = document.getElementById('page-dashboard');
    if (page) apply(page);
  }

  function observe() {
    if (observer || !window.MutationObserver) return;
    var page = document.getElementById('page-dashboard');
    if (!page) return;
    observer = new MutationObserver(function (mutations) {
      if (applying || isRtl()) return;
      var shouldApply = mutations.some(function (m) { return m.addedNodes && m.addedNodes.length; });
      if (shouldApply) requestAnimationFrame(function () { apply(page); });
    });
    observer.observe(page, { childList: true, subtree: true });
  }

  window.dashboardI18n = {
    t: t,
    raw: translateRaw,
    apply: apply,
    observe: observe,
    dir: dir,
    isRtl: isRtl,
    locale: locale,
    number: formatNumber,
    currency: formatCurrency,
    monthName: monthName,
    formatMonth: formatMonth,
    formatTimestamp: formatTimestamp,
    get currentLocale() { return lang(); }
  };

  window.dashT = t;
  window.dashText = translateRaw;
  window.dashIsRtl = isRtl;
  window.dashDir = dir;
  window.dashNum = formatNumber;
  window.dashCurrency = formatCurrency;

  window.addEventListener('khod-lang-change', setDirectionClasses);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      observe();
      setDirectionClasses();
    });
  } else {
    observe();
    setDirectionClasses();
  }
})();
