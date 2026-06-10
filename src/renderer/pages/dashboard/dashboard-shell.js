/*
   dashboard-shell.js
   Inner Dashboard frame: fixed account topbar, sidebar navigation, loaders,
   and section routing.
*/
(function () {
  'use strict';

  var NAV_ITEMS = [
    { id: 'master',     key: 'nav.master',     iconName: 'home'       },
    { id: 'overview',   key: 'nav.overview',   iconName: 'trendingUp' },
    { id: 'pipeline',   key: 'nav.pipeline',   iconName: 'truck'      },
    { id: 'orders',     key: 'nav.orders',     iconName: 'list'       },
    { id: 'cod',        key: 'nav.cod',        iconName: 'creditCard' },
    { id: 'products',   key: 'nav.products',   iconName: 'package'    },
    { id: 'cities',     key: 'nav.cities',     iconName: 'mapPin'     },
    { id: 'commission', key: 'nav.commission', iconName: 'fileText'   },
    { id: 'marketing',  key: 'nav.marketing',  iconName: 'activity'   },
    { id: 'campaigns',  key: 'nav.campaigns',  iconName: 'megaphone'  },
    { id: 'calculator', key: 'nav.calculator', iconName: 'calculator' },
    { id: 'productForecast', key: 'nav.productForecast', iconName: 'activity' },
    { id: 'prepaid',    key: 'nav.prepaid',    iconName: 'wallet'     },
    { id: 'staticUpdate', key: 'nav.staticUpdate', iconName: 'upload' },
    { id: 'khodAi',     key: 'nav.khodAi',     iconName: 'diamond'    },
  ];

  var SECTION_FN = {
    master: 'renderSection8',
    overview: 'renderSection1',
    pipeline: 'renderSection2',
    orders: 'renderSection3',
    cod: 'renderSection4',
    products: 'renderSection5',
    cities: 'renderSectionCities',
    commission: 'renderSection6',
    marketing: 'renderSectionMarketingConnections',
    campaigns: 'renderSectionCampaigns',
    calculator: 'renderSection7',
    productForecast: 'renderSectionProductForecast',
    prepaid:    'renderSectionPrepaid',
    staticUpdate: 'renderSectionStaticUpdate',
    khodAi:     'renderSectionKhodAi'
  };

  var DATA_KEY = {
    overview: 'overview',
    pipeline: 'pipeline',
    commission: 'commissionTrend',
    calculator: 'roi'
  };

  var customRangeDraft = null;
  var dashboardPageObserver = null;
  var dashboardPageObserved = null;
  var viewRangePulseTimer = null;

  function copyRange(period) {
    return {
      dateFrom: period && period.dateFrom ? period.dateFrom : '',
      dateTo: period && period.dateTo ? period.dateTo : '',
      lastEdited: null
    };
  }

  function ensureCustomRangeDraft(period) {
    if (!customRangeDraft) customRangeDraft = copyRange(period);
    return customRangeDraft;
  }

  function customRangeDraftPending(period) {
    return !!customRangeDraft && (
      customRangeDraft.dateFrom !== (period && period.dateFrom ? period.dateFrom : '') ||
      customRangeDraft.dateTo !== (period && period.dateTo ? period.dateTo : '')
    );
  }

  function normalizeCustomRangeDraft() {
    var draft = customRangeDraft || {};
    var dateFrom = draft.dateFrom || '';
    var dateTo = draft.dateTo || '';
    if (dateFrom > dateTo) {
      if (draft.lastEdited === 'dateTo') dateFrom = dateTo;
      else dateTo = dateFrom;
    }
    if (window.DashboardPeriodState && typeof window.DashboardPeriodState.clampRange === 'function') {
      return window.DashboardPeriodState.clampRange({ dateFrom: dateFrom, dateTo: dateTo });
    }
    return { dateFrom: dateFrom, dateTo: dateTo };
  }

  function observeDashboardPageState() {
    var page = document.getElementById('page-dashboard');
    if (!page) return;
    if (!page.classList.contains('active')) customRangeDraft = null;
    if (dashboardPageObserved === page && dashboardPageObserver) return;
    if (dashboardPageObserver) dashboardPageObserver.disconnect();
    dashboardPageObserved = page;
    dashboardPageObserver = new MutationObserver(function () {
      if (page.classList.contains('active')) return;
      customRangeDraft = null;
      clearTimeout(viewRangePulseTimer);
      closeDashboardDatePicker();
    });
    dashboardPageObserver.observe(page, { attributes: true, attributeFilter: ['class'] });
  }

  function icon(name, color) {
    return window.icon ? window.icon(name, { size: 15, color: color }) : '';
  }

  function tr(key, params) {
    return window.dashboardI18n ? window.dashboardI18n.t(key, params) : key;
  }

  function trText(key, fallback, params) {
    var value = tr(key, params);
    return value && value !== key ? value : fallback;
  }

  function esc(value) {
    if (window.KhodUI && typeof window.KhodUI.esc === 'function') return window.KhodUI.esc(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function isRtl() {
    return !window.dashboardI18n || window.dashboardI18n.isRtl();
  }

  function navLabel(item) {
    var label = tr(item.key);
    return label === item.key && item.id === 'campaigns' ? 'Campaigns' : label;
  }

  function navItemById(id) {
    return NAV_ITEMS.find(function (item) { return item.id === id; }) || NAV_ITEMS[0];
  }

  function isDashboardPreviewMode() {
    return window.KhodPremiumPreview && window.KhodPremiumPreview.isActive('dashboard');
  }

  function sectionAllowed(sectionId) {
    return !(isDashboardPreviewMode() && (sectionId === 'khodAi' || sectionId === 'staticUpdate'));
  }

  function normalizeSection(sectionId) {
    return sectionAllowed(sectionId) ? sectionId : 'master';
  }

  function buildSidebar(activeId) {
    activeId = normalizeSection(activeId);
    var navHTML = NAV_ITEMS.filter(function (item) {
      return sectionAllowed(item.id);
    }).map(function (item) {
      var active = item.id === activeId;
      var labelText = navLabel(item);
      return '<button type="button" class="dash-nav-btn ' + (active ? 'is-active' : '') + '" data-section="' + item.id + '" aria-label="' + labelText + '" aria-current="' + (active ? 'page' : 'false') + '" data-tooltip="' + labelText + '">' +
        '<span class="dash-nav-icon">' + icon(item.iconName, 'currentColor') + '</span>' +
        '<span class="dash-nav-lbl">' + labelText + '</span>' +
      '</button>';
    }).join('');

    return '<div id="dash-inner-sidebar" class="dash-sidebar" dir="' + (isRtl() ? 'rtl' : 'ltr') + '">' +
      '<div id="dash-branding-area" class="dash-branding">' +
        '<svg width="36" height="36" viewBox="0 0 36 36" fill="none"><polygon points="18,2 34,18 18,34 2,18" fill="none" stroke="#a855f7" stroke-width="2"/><polygon points="18,8 28,18 18,28 8,18" fill="#a855f7" opacity="0.25"/><circle cx="18" cy="18" r="4" fill="#a855f7"/><circle cx="18" cy="18" r="2" fill="#e9d5ff"/></svg>' +
        '<div id="dash-khod-text" class="dash-brand-text"><div class="dash-brand-name">' + tr('shell.brandName') + '</div><div class="dash-brand-sub">' + tr('shell.brandSub') + '</div></div>' +
      '</div>' +
      '<nav class="dash-scroll dash-nav-list">' + navHTML + '</nav>' +
      '<div id="dash-online-row" class="dash-online-row">' +
        '<span class="dash-live-dot"></span>' +
        '<span id="dash-online-label" class="dash-online-label">' + tr('shell.online') + '</span>' +
      '</div>' +
    '</div>';
  }

  function buildTopbar(activeSection) {
    activeSection = normalizeSection(activeSection);
    var title = navLabel(navItemById(activeSection));
    return '<div id="dash-global-topbar" class="dash-global-topbar" dir="' + (isRtl() ? 'rtl' : 'ltr') + '">' +
      '<div class="dash-topbar-cluster">' +
        '<div class="dashboard-account-select-wrap" id="dashboard-account-select-wrap" aria-label="' + tr('shell.account') + '" style="min-width:0;max-width:360px;"></div>' +
        '<div class="dashboard-rates-control">' +
          '<button type="button" id="dashboard-rates-btn" class="dash-rates-btn" title="Exchange rates" data-tooltip="Exchange rates">' +
            '<span>Rates</span><strong id="dashboard-rates-note">defaults</strong>' +
          '</button>' +
          '<div id="dashboard-rates-panel" class="dashboard-rates-panel" hidden></div>' +
        '</div>' +
        '<div id="dashboard-period-select-wrap" class="dashboard-period-select-wrap" aria-label="' + tr('period.label') + '"></div>' +
        '<span class="dash-topbar-field-label">' + tr('deliveredDate.label') + '</span>' +
        '<div id="dashboard-delivered-date-select-wrap" class="dashboard-delivered-date-select-wrap" aria-label="' + tr('deliveredDate.label') + '"></div>' +
        '<div id="dashboard-custom-range" class="dashboard-custom-range" hidden>' +
          '<div class="dashboard-custom-dates">' +
            '<button type="button" id="dashboard-date-from" class="dashboard-date-input"></button>' +
            '<span class="dashboard-date-sep">-</span>' +
            '<button type="button" id="dashboard-date-to" class="dashboard-date-input"></button>' +
          '</div>' +
          '<button type="button" id="dashboard-view-range-btn" class="dash-view-range-btn" disabled aria-disabled="true">' +
            '<span class="dash-view-range-icon">' + icon('calendar', 'currentColor') + '<span class="dash-view-range-check" aria-hidden="true">&#10003;</span></span>' +
            '<span>' + tr('period.viewRange') + '</span>' +
          '</button>' +
        '</div>' +
        '<span id="dashboard-update-wrap" class="dash-update-wrap">' +
          '<button type="button" id="dashboard-update-btn" class="dash-update-btn">' + icon('refreshCw', 'currentColor') + '<span>' + tr('period.update') + '</span></button>' +
        '</span>' +
      '</div>' +
      '<div class="dash-topbar-title">' +
        '<span class="dash-title-dot"></span>' +
        '<span id="dashboard-section-title">' + title + '</span>' +
        '<span class="dash-title-dot"></span>' +
      '</div>' +
      '<div class="dash-topbar-cluster dash-chip">' +
        '<button type="button" id="dashboard-tour-btn" class="khod-tour-quick-guide" title="' + tr('tour.common.quickGuide') + '" data-tooltip="' + tr('tour.common.quickGuide') + '"><span class="khod-tour-guide-mark">?</span><span>' + tr('tour.common.quickGuide') + '</span></button>' +
        '<span class="dash-live-dot"></span>' +
        '<span class="dash-last-update-label">' + tr('shell.lastUpdate') + '</span>' +
        '<span id="dashboard-last-updated" data-tooltip="' + tr('shell.lastUpdate') + '" class="dash-last-updated">--</span>' +
      '</div>' +
    '</div>';
  }

  function bindDashboardTour(shellEl, data, ctx) {
    if (!window.KhodGuidedTour || !shellEl) return;
    var opts = {
      root: shellEl,
      navigate: function (sectionId) {
        switchSection(shellEl, sectionId, data, ctx, true);
      }
    };
    var btn = shellEl.querySelector('#dashboard-tour-btn');
    if (btn && !btn._tourReady) {
      btn._tourReady = true;
      btn.addEventListener('click', function () {
        window.KhodGuidedTour.start('dashboard', opts);
      });
    }
    setTimeout(function () {
      if (document.body.contains(shellEl)) {
        window.KhodGuidedTour.mountPagePrompt('dashboard', opts);
      }
    }, 700);
  }

  function periodOptions() {
    var now = new Date();
    var locale = window.dashboardI18n ? window.dashboardI18n.locale() : 'en-US';
    var monthFmt = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
    var options = [
      { value: 'today', label: tr('period.today') },
      { value: 'yesterday', label: tr('period.yesterday') },
      { value: 'last7', label: tr('period.last7') },
      { value: 'last14', label: tr('period.last14') },
      { value: 'last30', label: tr('period.last30') }
    ];
    var months = window.DashboardPeriodState && typeof window.DashboardPeriodState.availableMonths === 'function'
      ? window.DashboardPeriodState.availableMonths()
      : [
          { preset: 'thisMonth', year: now.getFullYear(), monthIndex: now.getMonth() },
          { preset: 'prevMonth', year: now.getFullYear(), monthIndex: now.getMonth() - 1 },
          { preset: 'twoMonthsAgo', year: now.getFullYear(), monthIndex: now.getMonth() - 2 }
        ];
    months.forEach(function (month) {
      options.push({
        value: month.preset,
        label: monthFmt.format(new Date(month.year, month.monthIndex, 1))
      });
    });
    options.push({ value: 'custom', label: tr('period.custom') });
    return options;
  }

  function deliveredDateOptions() {
    return [
      { value: 'updatedAt', label: tr('deliveredDate.updatedAt') },
      { value: 'createdAt', label: tr('deliveredDate.createdAt') }
    ];
  }

  function parseIso(value) {
    var parts = String(value || '').split('-').map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return new Date();
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function toIso(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function shortDate(value) {
    var locale = window.dashboardI18n ? window.dashboardI18n.locale() : 'en-US';
    return parseIso(value).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function rateTimeLabel(value) {
    if (!value) return 'not refreshed yet';
    try {
      return new Date(value).toLocaleString(window.dashboardI18n ? window.dashboardI18n.locale() : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return String(value || '');
    }
  }

  function refreshDashboardAfterRateChange(shellEl, opts) {
    if (!shellEl) return;
    if (typeof opts.onDashboardUpdate === 'function') {
      opts.onDashboardUpdate(window.DashboardPeriodState ? window.DashboardPeriodState.get() : null);
    }
  }

  function closeRatesPanel(shellEl) {
    var panel = shellEl && shellEl.querySelector('#dashboard-rates-panel');
    if (!panel) return;
    panel.hidden = true;
    if (shellEl._ratesOutsideHandler) {
      document.removeEventListener('pointerdown', shellEl._ratesOutsideHandler);
      shellEl._ratesOutsideHandler = null;
    }
  }

  function renderRatesPanel(shellEl, opts) {
    if (!window.TaagerCurrency || !shellEl) return;
    var panel = shellEl.querySelector('#dashboard-rates-panel');
    if (!panel) return;
    var snap = window.TaagerCurrency.snapshot();
    var supported = snap.supported || window.TaagerCurrency.supported || ['SAR', 'USD'];
    var rates = snap.rates || {};
    var warning = shellEl._dashboardRateWarning || '';
    var inputs = supported.map(function (currency) {
      var readonly = currency === 'USD' ? ' readonly aria-readonly="true"' : '';
      return '<label class="dashboard-rate-row">' +
        '<span>' + esc(currency) + '</span>' +
        '<input type="number" min="0" step="0.0001" data-rate-currency="' + esc(currency) + '" value="' + esc(String(Number(rates[currency] || 0))) + '"' + readonly + '>' +
      '</label>';
    }).join('');
    panel.innerHTML =
      '<div class="dashboard-rates-head">' +
        '<div><strong>Exchange rates</strong><span>Base: 1 USD</span></div>' +
        '<button type="button" class="dashboard-rates-close" data-rate-close aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="dashboard-rates-meta">' +
        '<span>Source: <strong>' + esc(snap.source || 'defaults') + '</strong></span>' +
        '<span>Updated: <strong>' + esc(rateTimeLabel(snap.updatedAt)) + '</strong></span>' +
      '</div>' +
      (warning ? '<div class="dashboard-rates-warning">' + esc(warning) + '</div>' : '') +
      '<div class="dashboard-rates-grid">' + inputs + '</div>' +
      '<div class="dashboard-rates-actions">' +
        '<button type="button" class="dash-update-btn" data-rate-refresh>Refresh live rates</button>' +
        '<button type="button" class="dash-update-btn" data-rate-save>Save manual</button>' +
        '<button type="button" class="dash-update-btn" data-rate-reset>Reset to defaults</button>' +
      '</div>';

    var closeBtn = panel.querySelector('[data-rate-close]');
    if (closeBtn) closeBtn.addEventListener('click', function () { closeRatesPanel(shellEl); });
    var saveBtn = panel.querySelector('[data-rate-save]');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var next = {};
      panel.querySelectorAll('[data-rate-currency]').forEach(function (input) {
        next[input.getAttribute('data-rate-currency')] = Number(input.value || 0);
      });
      shellEl._dashboardRateWarning = '';
      window.TaagerCurrency.setManualRates(next);
      renderRatesPanel(shellEl, opts);
      updateRatesTopbar(shellEl);
      refreshDashboardAfterRateChange(shellEl, opts || {});
    });
    var resetBtn = panel.querySelector('[data-rate-reset]');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      shellEl._dashboardRateWarning = '';
      window.TaagerCurrency.resetRates();
      renderRatesPanel(shellEl, opts);
      updateRatesTopbar(shellEl);
      refreshDashboardAfterRateChange(shellEl, opts || {});
    });
    var refreshBtn = panel.querySelector('[data-rate-refresh]');
    if (refreshBtn) refreshBtn.addEventListener('click', function () {
      if (!window.TaagerCurrency.ensureLiveRates) return;
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing...';
      window.TaagerCurrency.ensureLiveRates({ force: true }).then(function (res) {
        shellEl._dashboardRateWarning = res && res.ok ? '' : ((res && res.error) || 'Live refresh failed. Keeping the last usable rates.');
        renderRatesPanel(shellEl, opts);
        updateRatesTopbar(shellEl);
        if (res && res.ok) refreshDashboardAfterRateChange(shellEl, opts || {});
      });
    });
  }

  function updateRatesTopbar(shellEl) {
    if (!window.TaagerCurrency || !shellEl) return;
    var note = shellEl.querySelector('#dashboard-rates-note');
    var btn = shellEl.querySelector('#dashboard-rates-btn');
    var snap = window.TaagerCurrency.snapshot();
    var text = (snap.source || 'defaults') + (snap.updatedAt ? ' - ' + rateTimeLabel(snap.updatedAt) : '');
    if (note) note.textContent = snap.source || 'defaults';
    if (btn) {
      btn.title = 'Exchange rates: ' + text;
      btn.setAttribute('data-tooltip', 'Exchange rates: ' + text);
    }
  }

  function bindRatesControl(shellEl, opts) {
    if (!window.TaagerCurrency || !shellEl) return;
    updateRatesTopbar(shellEl);
    var btn = shellEl.querySelector('#dashboard-rates-btn');
    var panel = shellEl.querySelector('#dashboard-rates-panel');
    if (btn && !btn._ratesReady) {
      btn._ratesReady = true;
      btn.addEventListener('click', function () {
        var opening = panel && panel.hidden;
        if (!panel) return;
        if (opening) {
          renderRatesPanel(shellEl, opts || {});
          panel.hidden = false;
          setTimeout(function () {
            if (shellEl._ratesOutsideHandler) document.removeEventListener('pointerdown', shellEl._ratesOutsideHandler);
            shellEl._ratesOutsideHandler = function (e) {
              if (!panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) closeRatesPanel(shellEl);
            };
            document.addEventListener('pointerdown', shellEl._ratesOutsideHandler);
          }, 0);
        } else {
          closeRatesPanel(shellEl);
        }
      });
    }
    if (!shellEl._ratesAutoRefreshChecked && window.TaagerCurrency.ensureLiveRates) {
      shellEl._ratesAutoRefreshChecked = true;
      window.TaagerCurrency.ensureLiveRates().then(function (res) {
        shellEl._dashboardRateWarning = res && res.ok ? '' : ((res && res.error) || 'Live refresh failed. Keeping the last usable rates.');
        updateRatesTopbar(shellEl);
        if (panel && !panel.hidden) renderRatesPanel(shellEl, opts || {});
        if (res && res.ok && res.refreshed) refreshDashboardAfterRateChange(shellEl, opts || {});
      });
    }
  }

  function openDashboardDatePicker(anchor, value, onSelect) {
    closeDashboardDatePicker();
    var current = parseIso(value);
    var min = parseIso(window.DashboardPeriodState.minDate());
    var max = parseIso(window.DashboardPeriodState.maxDate());
    var minMonth = new Date(min.getFullYear(), min.getMonth(), 1);
    var maxMonth = new Date(max.getFullYear(), max.getMonth(), 1);
    var view = new Date(current.getFullYear(), current.getMonth(), 1);
    var pop = document.createElement('div');
    pop.className = 'dashboard-date-popover';
    document.body.appendChild(pop);

    function render() {
      var locale = window.dashboardI18n ? window.dashboardI18n.locale() : 'en-US';
      var monthLabel = view.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      var first = new Date(view.getFullYear(), view.getMonth(), 1);
      var days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      var offset = first.getDay();
      var prevMonth = new Date(view.getFullYear(), view.getMonth() - 1, 1);
      var nextMonth = new Date(view.getFullYear(), view.getMonth() + 1, 1);
      var prevDisabled = prevMonth < minMonth;
      var nextDisabled = nextMonth > maxMonth;
      var cells = '';
      for (var i = 0; i < offset; i++) cells += '<span class="dash-cal-cell is-empty"></span>';
      for (var d = 1; d <= days; d++) {
        var date = new Date(view.getFullYear(), view.getMonth(), d);
        var iso = toIso(date);
        var disabled = date < min || date > max;
        var selected = iso === value;
        cells += '<button type="button" class="dash-cal-cell' + (selected ? ' is-selected' : '') + (disabled ? ' is-disabled' : '') + '" data-date="' + iso + '"' + (disabled ? ' disabled' : '') + '>' + d + '</button>';
      }
      pop.innerHTML =
        '<div class="dash-cal-head">' +
          '<button type="button" class="dash-cal-nav' + (prevDisabled ? ' is-disabled' : '') + '" data-dir="-1"' + (prevDisabled ? ' disabled aria-disabled="true"' : '') + '>‹</button>' +
          '<strong>' + monthLabel + '</strong>' +
          '<button type="button" class="dash-cal-nav' + (nextDisabled ? ' is-disabled' : '') + '" data-dir="1"' + (nextDisabled ? ' disabled aria-disabled="true"' : '') + '>›</button>' +
        '</div>' +
        '<div class="dash-cal-week"><span>' + tr('calendar.weekdays.sun') + '</span><span>' + tr('calendar.weekdays.mon') + '</span><span>' + tr('calendar.weekdays.tue') + '</span><span>' + tr('calendar.weekdays.wed') + '</span><span>' + tr('calendar.weekdays.thu') + '</span><span>' + tr('calendar.weekdays.fri') + '</span><span>' + tr('calendar.weekdays.sat') + '</span></div>' +
        '<div class="dash-cal-grid">' + cells + '</div>';
      pop.querySelectorAll('.dash-cal-nav').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.disabled) return;
          view = new Date(view.getFullYear(), view.getMonth() + Number(btn.dataset.dir), 1);
          render();
        });
      });
      pop.querySelectorAll('.dash-cal-cell[data-date]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          onSelect(btn.dataset.date);
          closeDashboardDatePicker();
        });
      });
    }

    function position() {
      var r = anchor.getBoundingClientRect();
      pop.style.left = Math.min(r.left, window.innerWidth - 292) + 'px';
      pop.style.top = (r.bottom + 8) + 'px';
    }

    pop._dashOutside = function (e) {
      if (!pop.contains(e.target) && e.target !== anchor) closeDashboardDatePicker();
    };
    setTimeout(function () { document.addEventListener('pointerdown', pop._dashOutside); }, 0);
    render();
    position();
  }

  function closeDashboardDatePicker() {
    var old = document.querySelector('.dashboard-date-popover');
    if (!old) return;
    if (old._dashOutside) document.removeEventListener('pointerdown', old._dashOutside);
    old.remove();
  }

  function applyNavBtnState(btn, active) {
    var id = btn.getAttribute('data-section');
    btn.classList.toggle('is-active', active);
    var iconEl = btn.querySelector('span:first-child');
    if (iconEl) iconEl.innerHTML = icon(navItemById(id).iconName, 'currentColor');
  }

  function setSidebarActive(shellEl, sectionId) {
    var prevId = shellEl._dashboardActiveSection;
    shellEl._dashboardActiveSection = sectionId;
    var title = shellEl.querySelector('#dashboard-section-title');
    if (title) title.textContent = navLabel(navItemById(sectionId));

    if (prevId && prevId !== sectionId) {
      var prevBtn = shellEl.querySelector('.dash-nav-btn[data-section="' + prevId + '"]');
      if (prevBtn) applyNavBtnState(prevBtn, false);
      if (prevBtn) prevBtn.setAttribute('aria-current', 'false');
    }
    var nextBtn = shellEl.querySelector('.dash-nav-btn[data-section="' + sectionId + '"]');
    if (nextBtn) applyNavBtnState(nextBtn, true);
    if (nextBtn) nextBtn.setAttribute('aria-current', 'page');
  }

  function loaderHTML(sectionId) {
    var label = navLabel(navItemById(sectionId || 'master'));
    var steps = [
      trText('shell.loadingStep.privateData', 'Preparing private data'),
      trText('shell.loadingStep.orders', 'Organizing orders'),
      trText('shell.loadingStep.pipeline', 'Building order pipeline'),
      trText('shell.loadingStep.cities', 'Mapping cities'),
      trText('shell.loadingStep.products', 'Reading product signals'),
      trText('shell.loadingStep.cod', 'Checking COD collection'),
      trText('shell.loadingStep.accountCalculator', 'Preparing account calculator'),
      trText('shell.loadingStep.productCalculator', 'Preparing product calculator'),
      trText('shell.loadingStep.marketing', 'Matching marketing spend'),
      trText('shell.loadingStep.buyLines', 'Reading buy-line signals'),
      trText('shell.loadingStep.ai', 'Scanning dashboard insights')
    ];
    var stepHtml = steps.map(function (step, idx) {
      return '<span style="--dash-loader-delay:' + (idx * 1.6).toFixed(1) + 's">' + esc(step) + '</span>';
    }).join('');
    return '<div class="dash-section-preloader" data-dashboard-preloader="true" role="status" aria-live="polite">' +
      '<div class="dash-preloader-head">' +
        '<span class="dash-preloader-spinner" aria-hidden="true"></span>' +
        '<div class="dash-preloader-copy">' +
          '<div class="dash-preloader-title">' + esc(tr('shell.loading')) + '</div>' +
          '<div class="dash-preloader-section">' +
            '<span class="dash-preloader-cycle" aria-hidden="true">' + stepHtml + '</span>' +
            '<span class="dash-preloader-target">' + esc(trText('shell.loadingFor', 'for')) + ' ' + esc(label) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="dash-preloader-grid" aria-hidden="true">' +
        '<span></span><span></span><span></span><span></span>' +
      '</div>' +
      '<div class="dash-preloader-block" aria-hidden="true"></div>' +
    '</div>';
  }

  function getDataVersion(data) {
    return data && data._version != null ? data._version : (data && data._loaded ? 'loaded' : 'pending');
  }

  function scheduleSectionRender(shellEl, render) {
    var token = (shellEl._dashboardRenderToken || 0) + 1;
    shellEl._dashboardRenderToken = token;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (shellEl._dashboardRenderToken !== token) return;
        render();
      });
    });
  }

  function emptyState(data) {
    var label = data && data.meta && data.meta.activeAccountLabel ? data.meta.activeAccountLabel : tr('shell.thisAccount');
    label = window.dashboardI18n ? window.dashboardI18n.raw(label) : label;
    if (window.KhodUI) {
      return window.KhodUI.stateBlock({
        kind: 'empty',
        title: tr('shell.noDataTitle'),
        body: tr('shell.noDataBody', { account: label })
      });
    }
    return '<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;color:rgba(255,255,255,0.35);text-align:center;padding:32px;">' +
      '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      '<div style="font-size:16px;font-weight:800;color:rgba(255,255,255,0.78);">' + tr('shell.noDataTitle') + '</div>' +
      '<div style="font-size:12px;max-width:340px;line-height:1.7;">' + tr('shell.noDataBody', { account: label }) + '</div>' +
    '</div>';
  }

  function syncDashboardUpdateButton(shellEl, period) {
    var updateBtn = shellEl && shellEl.querySelector('#dashboard-update-btn');
    if (!updateBtn) return;
    var updateWrap = shellEl.querySelector('#dashboard-update-wrap');
    var draftPending = customRangeDraftPending(period);
    var fetchActive = !!(window._dashboardFetchState && window._dashboardFetchState.active);
    var tooltip = draftPending ? tr('period.viewFirstTooltip') : '';
    updateBtn.dataset.draftPending = draftPending ? 'true' : 'false';
    updateBtn.classList.toggle('is-draft-blocked', draftPending);
    updateBtn.disabled = fetchActive || draftPending;
    updateBtn.setAttribute('aria-disabled', updateBtn.disabled ? 'true' : 'false');
    if (!updateWrap) return;
    if (tooltip) {
      updateWrap.setAttribute('data-tooltip', tooltip);
      updateWrap.setAttribute('aria-label', tooltip);
      updateWrap.setAttribute('tabindex', '0');
    } else {
      updateWrap.removeAttribute('data-tooltip');
      updateWrap.removeAttribute('aria-label');
      updateWrap.removeAttribute('tabindex');
    }
  }

  function pulseViewRangeButton(button) {
    if (!button) return;
    clearTimeout(viewRangePulseTimer);
    button.classList.remove('is-applied');
    void button.offsetWidth;
    button.classList.add('is-applied');
    viewRangePulseTimer = setTimeout(function () {
      button.classList.remove('is-applied');
    }, 700);
  }

  function updateCustomRangeControls(shellEl, period, opts) {
    var custom = shellEl.querySelector('#dashboard-custom-range');
    var from = shellEl.querySelector('#dashboard-date-from');
    var to = shellEl.querySelector('#dashboard-date-to');
    var viewBtn = shellEl.querySelector('#dashboard-view-range-btn');
    var showCustom = !!customRangeDraft || (period && period.preset === 'custom');
    if (showCustom) ensureCustomRangeDraft(period);
    if (custom) custom.hidden = !showCustom;
    if (!showCustom) {
      syncDashboardUpdateButton(shellEl, period);
      return;
    }

    if (from) from.textContent = customRangeDraft.dateFrom ? shortDate(customRangeDraft.dateFrom) : '--';
    if (to) to.textContent = customRangeDraft.dateTo ? shortDate(customRangeDraft.dateTo) : '--';
    var pending = customRangeDraftPending(period);
    if (viewBtn) {
      viewBtn.disabled = !pending;
      viewBtn.setAttribute('aria-disabled', pending ? 'false' : 'true');
      viewBtn.classList.toggle('is-pending', pending);
      if (!viewBtn._dashViewRangeReady) {
        viewBtn._dashViewRangeReady = true;
        viewBtn.addEventListener('click', function () {
          if (viewBtn.disabled || !customRangeDraft || !window.DashboardPeriodState) return;
          var nextRange = normalizeCustomRangeDraft();
          customRangeDraft = {
            dateFrom: nextRange.dateFrom,
            dateTo: nextRange.dateTo,
            lastEdited: null
          };
          window.DashboardPeriodState.setCustomRange(nextRange.dateFrom, nextRange.dateTo);
          var committed = window.DashboardPeriodState.get();
          customRangeDraft = copyRange(committed);
          updateCustomRangeControls(shellEl, committed, opts);
          pulseViewRangeButton(viewBtn);
          if (typeof opts.onPeriodChange === 'function') opts.onPeriodChange(committed);
        });
      }
    }
    syncDashboardUpdateButton(shellEl, period);
  }

  function updateTopbar(shellEl, data, opts) {
    data = data || {};
    opts = opts || {};
    var meta = data.meta || {};
    var monthEl = shellEl.querySelector('#dashboard-month-label span');
    var lastEl = shellEl.querySelector('#dashboard-last-updated');
    var newMonth = meta.monthLabel || '--';
    var newLast = meta.lastUpdatedLabel || tr('shell.noUpdate');
    if (monthEl && monthEl.textContent !== newMonth) monthEl.textContent = newMonth;
    if (lastEl && lastEl.textContent !== newLast) lastEl.textContent = newLast;
    bindRatesControl(shellEl, opts);

    var wrap = shellEl.querySelector('#dashboard-account-select-wrap');
    var periodWrap = shellEl.querySelector('#dashboard-period-select-wrap');
    var deliveredDateWrap = shellEl.querySelector('#dashboard-delivered-date-select-wrap');
    if (periodWrap && window.renderCustomSelect && window.DashboardPeriodState) {
      var period = window.DashboardPeriodState.get();
      if (period.preset === 'custom') ensureCustomRangeDraft(period);
      var pOptions = periodOptions();
      var periodSignature = pOptions.map(function (opt) { return opt.value + ':' + opt.label; }).join('|');
      var selectedPreset = customRangeDraft
        ? 'custom'
        : (pOptions.some(function (opt) { return opt.value === period.preset; }) ? period.preset : 'custom');
      var draftKey = customRangeDraft ? customRangeDraft.dateFrom + '|' + customRangeDraft.dateTo : '';
      var pKey = selectedPreset + '|' + period.dateFrom + '|' + period.dateTo + '|' + draftKey + '|' + (window._kbotLang || 'en') + '|' + periodSignature;
      if (shellEl._topbarPeriodKey !== pKey) {
        shellEl._topbarPeriodKey = pKey;
        window.renderCustomSelect(periodWrap, pOptions, selectedPreset || 'thisMonth', function (value) {
          shellEl._topbarPeriodKey = null;
          if (value === 'custom') {
            ensureCustomRangeDraft(window.DashboardPeriodState.get());
            updateTopbar(shellEl, data, opts);
            return;
          }
          customRangeDraft = null;
          window.DashboardPeriodState.setPreset(value);
          if (typeof opts.onPeriodChange === 'function') opts.onPeriodChange(window.DashboardPeriodState.get());
        }, { maxHeight: '280px', ariaLabel: tr('period.label') });
      }
      var from = shellEl.querySelector('#dashboard-date-from');
      var to = shellEl.querySelector('#dashboard-date-to');
      [from, to].forEach(function (button) {
        if (!button || button._dashDateReady) return;
        button._dashDateReady = true;
        button.addEventListener('click', function () {
          var current = ensureCustomRangeDraft(window.DashboardPeriodState.get());
          var isFrom = button.id === 'dashboard-date-from';
          openDashboardDatePicker(button, isFrom ? current.dateFrom : current.dateTo, function (nextDate) {
            if (isFrom) customRangeDraft.dateFrom = nextDate;
            else customRangeDraft.dateTo = nextDate;
            customRangeDraft.lastEdited = isFrom ? 'dateFrom' : 'dateTo';
            shellEl._topbarPeriodKey = null;
            updateCustomRangeControls(shellEl, window.DashboardPeriodState.get(), opts);
          });
        });
      });
      updateCustomRangeControls(shellEl, period, opts);
    }

    if (deliveredDateWrap && window.renderCustomSelect && window.DashboardDeliveredDateState) {
      var deliveredDateMode = window.DashboardDeliveredDateState.get();
      var dOptions = deliveredDateOptions();
      var dSignature = dOptions.map(function (opt) { return opt.value + ':' + opt.label; }).join('|');
      var dKey = deliveredDateMode + '|' + (window._kbotLang || 'en') + '|' + dSignature;
      if (shellEl._topbarDeliveredDateKey !== dKey) {
        shellEl._topbarDeliveredDateKey = dKey;
        window.renderCustomSelect(deliveredDateWrap, dOptions, deliveredDateMode, function (value) {
          shellEl._topbarDeliveredDateKey = null;
          window.DashboardDeliveredDateState.set(value);
          if (typeof opts.onDeliveredDateModeChange === 'function') opts.onDeliveredDateModeChange(window.DashboardDeliveredDateState.get());
        }, { maxHeight: '180px', ariaLabel: tr('deliveredDate.label') });
      }
    }

    var updateBtn = shellEl.querySelector('#dashboard-update-btn');
    if (updateBtn && !updateBtn._dashReady) {
      updateBtn._dashReady = true;
      updateBtn.addEventListener('click', function () {
        if (updateBtn.disabled) return;
        if (typeof opts.onDashboardUpdate === 'function') opts.onDashboardUpdate(window.DashboardPeriodState ? window.DashboardPeriodState.get() : null);
      });
    }
    syncDashboardUpdateButton(shellEl, window.DashboardPeriodState ? window.DashboardPeriodState.get() : null);

    if (!wrap || !window.renderCustomSelect) return;

    var rawOptions = meta.accountOptions || window.dashboardAccountsList || [];
    if (!rawOptions.length) rawOptions = [{ id: '__all__', label: tr('shell.allAccounts'), orderCount: 0 }];
    var current = meta.activeAccountId || (window.getActiveAccountId ? window.getActiveAccountId() : '__all__');

    // Skip re-rendering the select if nothing changed
    var optionSignature = rawOptions.map(function (acc) {
      return [
        acc.id || acc.value || '',
        acc.orderCount || 0,
        acc.memberName || acc.easyEmail || acc.email || acc.khodEmail || acc.easyStore || acc.storeName || acc.label || acc.name || '',
        acc.email || acc.khodEmail || acc.easyEmail || ''
      ].join(':');
    }).join('|');
    var activePeriod = window.DashboardPeriodState ? window.DashboardPeriodState.get() : null;
    var periodKey = activePeriod ? (activePeriod.preset + ':' + activePeriod.dateFrom + ':' + activePeriod.dateTo) : '';
    var deliveredDateKey = window.DashboardDeliveredDateState ? window.DashboardDeliveredDateState.get() : 'updatedAt';
    var cacheKey = current + '|' + periodKey + '|' + deliveredDateKey + '|' + optionSignature;
    if (shellEl._topbarSelectKey === cacheKey) return;
    shellEl._topbarSelectKey = cacheKey;

    var options = rawOptions.map(function (acc) {
      var count = Number(acc.orderCount || 0);
      var primary = acc.memberName || acc.label || acc.name || acc.easyStore || acc.storeName || acc.easyEmail || acc.email || acc.khodEmail || acc.id;
      var email = acc.email || acc.khodEmail || acc.easyEmail || '';
      var displayStr = primary;
      var countText = count ? '  ' + (window.dashboardI18n ? window.dashboardI18n.number(count) : count.toLocaleString('en-US')) + ' ' + tr(count === 1 ? 'shell.ordersSuffix' : 'shell.orderCountSuffix') : '';
      return {
        value: acc.id || acc.value,
        label: (window.dashboardI18n ? window.dashboardI18n.raw(displayStr) : displayStr) + countText,
        subLabel: email && email !== primary ? email : ''
      };
    });
    window.renderCustomSelect(wrap, options, current, function (value) {
      shellEl._topbarSelectKey = null; // force re-render after change
      if (typeof opts.onAccountChange === 'function') opts.onAccountChange(value);
    }, { searchable: true, maxHeight: '280px', ariaLabel: tr('shell.account') });
  }

  function updateFirstRunGuidance(shellEl, data) {
    var guidance = shellEl && shellEl.querySelector('#dashboard-first-run-guidance');
    if (!guidance) return;
    var show = !!(data && data.meta && data.meta.hasData === false) && !isDashboardPreviewMode();
    guidance.style.display = show ? 'flex' : 'none';
    var btn = guidance.querySelector('#dashboard-first-run-btn');
    if (btn && !btn._dashFirstRunReady) {
      btn._dashFirstRunReady = true;
      btn.addEventListener('click', function () {
        if (typeof goToSetup === 'function') goToSetup('run');
      });
    }
  }

  function applyInnerCollapse(shellEl, collapsed) {
    var sidebar = shellEl.querySelector('#dash-inner-sidebar');
    var khodText = shellEl.querySelector('#dash-khod-text');
    var onlineLbl = shellEl.querySelector('#dash-online-label');
    var navLabels = shellEl.querySelectorAll('.dash-nav-lbl');
    var navBtns = shellEl.querySelectorAll('.dash-nav-btn');
    var handle = shellEl.querySelector('.dash-inner-handle');
    var w = collapsed ? 44 : 210;
    var rtl = isRtl();

    if (sidebar) sidebar.style.width = w + 'px';
    shellEl.classList.toggle('dash-inner-collapsed', collapsed);
    shellEl.setAttribute('data-sidebar-collapsed', collapsed ? 'true' : 'false');
    if (khodText) khodText.style.display = collapsed ? 'none' : 'block';
    if (onlineLbl) onlineLbl.style.display = collapsed ? 'none' : 'inline';
    navLabels.forEach(function (label) { label.style.display = collapsed ? 'none' : 'block'; });
    navBtns.forEach(function (btn) {
      btn.style.justifyContent = collapsed ? 'center' : 'flex-start';
      btn.style.padding = collapsed ? '10px 0' : '10px 12px';
    });
    if (handle) {
      handle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      handle.setAttribute('aria-label', tr(collapsed ? 'shell.expand' : 'shell.collapse'));
      handle.setAttribute('data-tooltip', tr(collapsed ? 'shell.expand' : 'shell.collapse'));
      handle.style.left = '';
      handle.style.right = '';
      handle.style.top = 'auto';
      handle.style.bottom = '32px';
      handle.style.insetInlineStart = w + 'px';
      handle.style.transform = 'translateX(' + (rtl ? '50%' : '-50%') + ')' +
        (collapsed ? ' rotate(180deg)' : '');
    }
  }

  function applyResponsiveState(shellEl) {
    if (!shellEl) return;
    var w = shellEl.clientWidth || window.innerWidth || 0;
    shellEl.classList.toggle('dash-size-lg', w >= 1180);
    shellEl.classList.toggle('dash-size-md', w < 1180 && w >= 960);
    shellEl.classList.toggle('dash-size-sm', w < 960 && w >= 760);
    shellEl.classList.toggle('dash-size-xs', w < 760);
    shellEl.style.setProperty('--dash-shell-width', w + 'px');
  }

  function isLightTheme() {
    var theme = document.documentElement.getAttribute('data-theme') || window._kbotTheme || 'dark';
    return theme === 'light';
  }

  function hasDarkInlineSurface(styleText) {
    styleText = String(styleText || '').toLowerCase();
    return /background\s*:/.test(styleText) && (
      styleText.indexOf('#030712') !== -1 ||
      styleText.indexOf('#050a15') !== -1 ||
      styleText.indexOf('#060c1a') !== -1 ||
      styleText.indexOf('#070a13') !== -1 ||
      styleText.indexOf('#080b12') !== -1 ||
      styleText.indexOf('#0a0f18') !== -1 ||
      styleText.indexOf('#0a0f1c') !== -1 ||
      styleText.indexOf('#0b0c0f') !== -1 ||
      styleText.indexOf('#0b0f19') !== -1 ||
      styleText.indexOf('#0b1120') !== -1 ||
      styleText.indexOf('#0d1220') !== -1 ||
      styleText.indexOf('#0d1320') !== -1 ||
      styleText.indexOf('#0f172a') !== -1 ||
      styleText.indexOf('#111318') !== -1 ||
      styleText.indexOf('#111827') !== -1 ||
      styleText.indexOf('rgba(0,0,0') !== -1 ||
      styleText.indexOf('rgba(0, 0, 0') !== -1 ||
      styleText.indexOf('rgba(13,19,32') !== -1 ||
      styleText.indexOf('rgba(15,23,42') !== -1 ||
      styleText.indexOf('rgba(17,24,39') !== -1 ||
      styleText.indexOf('rgba(30,41,59') !== -1
    );
  }

  function hasFaintWhiteInlineColor(styleText) {
    styleText = String(styleText || '').toLowerCase();
    return /color\s*:/.test(styleText) && (
      styleText.indexOf('#fff') !== -1 ||
      styleText.indexOf('#ffffff') !== -1 ||
      styleText.indexOf('#f0f1f3') !== -1 ||
      styleText.indexOf('#f5edff') !== -1 ||
      styleText.indexOf('#f8fafc') !== -1 ||
      styleText.indexOf('rgba(255,255,255') !== -1 ||
      styleText.indexOf('rgba(255, 255, 255') !== -1
    );
  }

  function alphaFromRgba(styleText) {
    var match = String(styleText || '').match(/rgba\(255,\s*255,\s*255,\s*([0-9.]+)\)/i);
    return match ? Number(match[1]) : 1;
  }

  function applyDashboardInlineTheme(root) {
    if (!root) return;
    var light = isLightTheme();
    root.setAttribute('data-inline-theme-fixed', light ? 'light' : 'dark');
    if (!light) return;

    var nodes = [root].concat(Array.from(root.querySelectorAll('[style]')));
    nodes.forEach(function (el) {
      var styleText = el.getAttribute('style') || '';
      if (hasDarkInlineSurface(styleText)) {
        var isPageRoot = el.classList.contains('s7-body') ||
          el.classList.contains('s9-body') ||
          styleText.indexOf('flex:1') !== -1 && styleText.indexOf('overflow-y:auto') !== -1;
        el.style.setProperty('background', isPageRoot ? 'var(--dash-bg)' : 'var(--dash-surface)', 'important');
        el.style.setProperty('border-color', 'var(--dash-border-soft)', 'important');
        if (styleText.indexOf('box-shadow:inset') !== -1 || styleText.indexOf('box-shadow:0 ') !== -1) {
          el.style.setProperty('box-shadow', 'var(--dash-shadow-card)', 'important');
        }
      }

      if (hasFaintWhiteInlineColor(styleText)) {
        var alpha = alphaFromRgba(styleText);
        var color = alpha <= 0.42 ? 'var(--dash-text-faint)' : (alpha <= 0.72 ? 'var(--dash-text-muted)' : 'var(--dash-text)');
        el.style.setProperty('color', color, 'important');
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('text-shadow', 'none', 'important');
      }

      if (/border-(top|bottom|left|right)\s*:.*rgba\(255,\s*255,\s*255/i.test(styleText)) {
        el.style.setProperty('border-color', 'var(--dash-border-soft)', 'important');
      }
    });

    root.querySelectorAll('input, textarea, select').forEach(function (el) {
      el.style.setProperty('background', 'var(--dash-input-bg)', 'important');
      el.style.setProperty('border-color', 'var(--dash-border)', 'important');
      el.style.setProperty('color', 'var(--dash-text)', 'important');
    });

    root.querySelectorAll('thead, th').forEach(function (el) {
      el.style.setProperty('background', 'var(--dash-table-header)', 'important');
      el.style.setProperty('color', 'var(--dash-text-faint)', 'important');
    });

    root.querySelectorAll('td').forEach(function (el) {
      el.style.setProperty('color', 'var(--dash-text-muted)', 'important');
      el.style.setProperty('border-color', 'var(--dash-border-soft)', 'important');
    });

    root.querySelectorAll('.sfe-wrapper, .sfe-panel, .sfe-metric-card, .s7-card, .s7-input-wrap').forEach(function (el) {
      el.style.setProperty('background', 'var(--dash-surface)', 'important');
      el.style.setProperty('border-color', 'var(--dash-border-soft)', 'important');
      el.style.setProperty('color', 'var(--dash-text)', 'important');
      el.style.setProperty('box-shadow', 'var(--dash-shadow-card)', 'important');
    });

    root.querySelectorAll('.sc-custom-menu, .sc-custom-container > div:first-child').forEach(function (el) {
      el.style.setProperty('background', 'var(--dash-surface)', 'important');
      el.style.setProperty('border-color', 'var(--dash-border)', 'important');
      el.style.setProperty('color', 'var(--dash-text)', 'important');
      el.style.setProperty('box-shadow', 'var(--dash-shadow-float)', 'important');
    });

    root.querySelectorAll('.ai-inline-advisor strong, .ai-advisor-card strong').forEach(function (el) {
      el.style.setProperty('color', 'var(--dash-text)', 'important');
    });
    root.querySelectorAll('.ai-inline-advisor span, .ai-inline-advisor em, .ai-advisor-card span, .ai-advisor-card em').forEach(function (el) {
      el.style.setProperty('color', 'var(--dash-text-faint)', 'important');
    });

    root.querySelectorAll('.khod-ai-section, .aii-panel, .aii-hero-header').forEach(function (el) {
      el.style.setProperty('background', 'var(--dash-surface)', 'important');
      el.style.setProperty('border-color', 'var(--dash-border-soft)', 'important');
      el.style.setProperty('color', 'var(--dash-text)', 'important');
      el.style.setProperty('box-shadow', 'var(--dash-shadow-card)', 'important');
    });
    root.querySelectorAll('.aii-alert-chip:not([class*="aii-glow-"]), .aii-feed-card:not([class*="aii-glow-"]), .aii-chat-msg-body, .aii-action-btn, .aii-chip, .aii-close-btn, .aii-stream-tab:not(.active), .aii-stream-tab:not(.active) strong, .aii-badge').forEach(function (el) {
      el.style.setProperty('background', 'var(--dash-surface-soft)', 'important');
      el.style.setProperty('border-color', 'var(--dash-border-soft)', 'important');
      el.style.setProperty('color', 'var(--dash-text)', 'important');
    });
    root.querySelectorAll('.aii-hero-title h1, .aii-panel-head h2, .aii-feed-card strong, .aii-detail-top h3, .aii-state strong, .aii-chat-msg-body p, .aii-alert-chip-content strong').forEach(function (el) {
      el.style.setProperty('color', 'var(--dash-text)', 'important');
    });
    root.querySelectorAll('.aii-hero-title p, .aii-metric span, .aii-chat-msg-body span, .aii-feed-card em, .aii-detail-content, .aii-state, .aii-explain-block span, .aii-alert-chip-content em, .aii-ai-disclaimer').forEach(function (el) {
      el.style.setProperty('color', 'var(--dash-text-muted)', 'important');
    });

  }

  window.applyDashboardInlineTheme = applyDashboardInlineTheme;

  function scheduleInlineThemeFix(pane) {
    if (!pane) return;
    applyDashboardInlineTheme(pane);
    [60, 180, 420, 900].forEach(function (delay) {
      setTimeout(function () { applyDashboardInlineTheme(pane); }, delay);
    });
    if (!window.MutationObserver) return;
    if (pane._inlineThemeObserver) pane._inlineThemeObserver.disconnect();
    var pending = false;
    var applying = false;
    pane._inlineThemeObserver = new MutationObserver(function () {
      if (applying || pending || !isLightTheme()) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        applying = true;
        applyDashboardInlineTheme(pane);
        applying = false;
      });
    });
    pane._inlineThemeObserver.observe(pane, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  function disconnectPaneThemeObservers(pane) {
    if (!pane) return;
    ['_s7ThemeObserver', '_s8ThemeObserver', '_s9ThemeObserver'].forEach(function (key) {
      if (pane[key] && typeof pane[key].disconnect === 'function') {
        pane[key].disconnect();
      }
      pane[key] = null;
    });
  }

  function switchSection(shellEl, sectionId, data, ctx, skipDelay) {
    sectionId = normalizeSection(sectionId);
    setSidebarActive(shellEl, sectionId);
    updateTopbar(shellEl, data, ctx.options);
    updateFirstRunGuidance(shellEl, data);

    var pane = shellEl.querySelector('#dash-section-pane');
    if (!pane) return;
    var version = getDataVersion(data);
    var renderKey = sectionId + '|' + version + '|' + (window._kbotLang || '') + '|' + (window._kbotTheme || '');
    if (!skipDelay && pane._dashboardRenderKey === renderKey && pane.children.length && !(data && data._loading)) {
      return;
    }

    shellEl._dashboardSectionDomCache = shellEl._dashboardSectionDomCache || new Map();
    if (pane._dashboardRenderKey && pane.children.length && !(data && data._loading)) {
      var previousCleanup = typeof pane._dashboardSectionCleanup === 'function'
        ? pane._dashboardSectionCleanup
        : null;
      var canCachePreviousSection = !previousCleanup;
      if (previousCleanup) {
        try { previousCleanup(); } catch (_) {}
        pane._dashboardSectionCleanup = null;
      }
      disconnectPaneThemeObservers(pane);
      if (pane._inlineThemeObserver) {
        try { pane._inlineThemeObserver.disconnect(); } catch (_) {}
        pane._inlineThemeObserver = null;
      }
      if (!canCachePreviousSection) {
        pane.innerHTML = '';
      } else {
      var previousFragment = document.createDocumentFragment();
      while (pane.firstChild) previousFragment.appendChild(pane.firstChild);
      shellEl._dashboardSectionDomCache.set(pane._dashboardRenderKey, {
        fragment: previousFragment,
        cleanup: null,
        inlineThemeObserver: null
      });
      if (shellEl._dashboardSectionDomCache.size > 5) {
        var firstKey = shellEl._dashboardSectionDomCache.keys().next().value;
        var evicted = shellEl._dashboardSectionDomCache.get(firstKey);
        if (evicted && typeof evicted.cleanup === 'function') {
          try { evicted.cleanup(); } catch (_) {}
        }
        if (evicted && evicted.inlineThemeObserver) {
          try { evicted.inlineThemeObserver.disconnect(); } catch (_) {}
        }
        shellEl._dashboardSectionDomCache.delete(firstKey);
      }
      }
      pane._dashboardSectionCleanup = null;
      pane._inlineThemeObserver = null;
    }

    var cachedSection = shellEl._dashboardSectionDomCache.get(renderKey);
    if (cachedSection && !(data && data._loading)) {
      pane.innerHTML = '';
      pane.appendChild(cachedSection.fragment);
      pane._dashboardSectionCleanup = cachedSection.cleanup || null;
      pane._inlineThemeObserver = cachedSection.inlineThemeObserver || null;
      pane._dashboardRenderKey = renderKey;
      shellEl._dashboardSectionDomCache.delete(renderKey);
      if (window.KhodUI) window.KhodUI.enhance(pane);
      return;
    }

    disconnectPaneThemeObservers(pane);
    if (typeof pane._dashboardSectionCleanup === 'function') {
      pane._dashboardSectionCleanup();
      pane._dashboardSectionCleanup = null;
    }
    if (pane._inlineThemeObserver) {
      pane._inlineThemeObserver.disconnect();
      pane._inlineThemeObserver = null;
    }
    pane._dashboardRenderKey = null;
    pane.innerHTML = loaderHTML(sectionId);

    var render = function () {
      if (data && data._loading) return;
      pane.innerHTML = '';
      if (!data || !data._loaded) {
        pane.innerHTML = loaderHTML(sectionId);
        return;
      }
      var fn = window[SECTION_FN[sectionId]];
      if (typeof fn !== 'function') {
        // Section registered but not yet loaded.
        pane.innerHTML = '<div class="dash-coming-soon">' +
          '<div class="dash-coming-soon-icon">...</div>' +
          '<div class="dash-coming-soon-title">' + tr('misc.comingSoon') + '</div>' +
          '<div class="dash-coming-soon-body">' + tr('misc.sectionInProgress') + '</div>' +
          '</div>';
        return;
      }
      var key = DATA_KEY[sectionId];
      var slice = key ? (data[key] || null) : data;
      ctx.data = data;
      ctx.sectionId = sectionId;
      try {
        if (window.performance && window.performance.mark) {
          window.performance.mark('dashboard-section:' + sectionId + ':start');
        }
      } catch (_) {}
      fn(pane, slice, ctx);
      pane._dashboardRenderKey = renderKey;
      if (window.dashboardI18n) window.dashboardI18n.apply(pane);
      if (window.KhodUI) window.KhodUI.enhance(pane);
      scheduleInlineThemeFix(pane);
      try {
        if (window.performance && window.performance.mark && window.performance.measure) {
          window.performance.mark('dashboard-section:' + sectionId + ':end');
          window.performance.measure('dashboard-section:' + sectionId, 'dashboard-section:' + sectionId + ':start', 'dashboard-section:' + sectionId + ':end');
        }
      } catch (_) {}
    };

    if (skipDelay) render();
    else scheduleSectionRender(shellEl, render);
  }

  window.renderDashboardShell = function (mountEl, data, options) {
    if (!mountEl) return;
    observeDashboardPageState();
    if (typeof mountEl._dashboardCleanup === 'function') {
      mountEl._dashboardCleanup();
      mountEl._dashboardCleanup = null;
    }
    options = options || {};
    mountEl._dashboardOptions = options;
    var activeSection = normalizeSection(mountEl._dashboardActiveSection || window._dashboardInitialSection || 'master');
    window._dashboardInitialSection = null;
    var innerCollapsed = false;
    var ctx = {
      options: options,
      onNavigate: function (sectionId) {
        switchSection(mountEl, sectionId, data, ctx);
      },
      accent: '#a855f7',
      formatSAR: window.formatSAR,
      i18n: window.dashboardI18n || null
    };

    mountEl.classList.add('dash-shell');
    mountEl.setAttribute('dir', isRtl() ? 'rtl' : 'ltr');
    mountEl.innerHTML =
      buildSidebar(activeSection) +
      '<div class="dash-main">' +
        buildTopbar(activeSection) +
        '<div id="dashboard-first-run-guidance" class="dashboard-first-run-guidance" style="display:none;margin:12px 16px 0;padding:14px 16px;border:1px solid var(--dash-border, var(--border));border-radius:12px;background:var(--dash-card, var(--bg2));align-items:center;justify-content:space-between;gap:14px;box-shadow:0 10px 28px rgba(0,0,0,.10);">' +
          '<div style="min-width:0;">' +
            '<div style="font-size:13px;font-weight:800;color:var(--dash-text, var(--text));margin-bottom:3px;">' + trText('shell.firstRunTitle', 'Dashboard is ready') + '</div>' +
            '<div style="font-size:12px;color:var(--dash-muted, var(--text2));line-height:1.5;">' + trText('shell.firstRunBody', 'Run the bot or update the dashboard to start filling every section with live account data. Until then, the dashboard stays visible with zero-value metrics.') + '</div>' +
          '</div>' +
          '<button type="button" class="dash-update-btn" id="dashboard-first-run-btn" style="white-space:nowrap;">' + icon('play', 'currentColor') + '<span>' + trText('shell.firstRunAction', 'Go to Run') + '</span></button>' +
        '</div>' +
        '<div id="dash-section-pane" class="dash-scroll dash-content" style="flex:1 1 0;display:flex;flex-direction:column;min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden;"></div>' +
      '</div>';

    updateTopbar(mountEl, data, options);
    updateFirstRunGuidance(mountEl, data);
    if (window.dashboardI18n) window.dashboardI18n.apply(mountEl);
    if (window.KhodUI) window.KhodUI.enhance(mountEl);

    // Mount floating collapse handle centered on the inner sidebar edge
    (function () {
      var rtl = isRtl();
      var handle = document.createElement('button');
      handle.className = 'sb-collapse-handle dash-inner-handle sb-collapse-handle2';
      handle.type = 'button';
      handle.title = tr('shell.collapse');
      handle.setAttribute('aria-label', tr('shell.collapse'));
      handle.setAttribute('aria-expanded', 'true');
      handle.setAttribute('data-tooltip', tr('shell.collapse'));
      handle.innerHTML = rtl ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
      handle.style.insetInlineStart = '210px';
      handle.style.top = 'auto';
      handle.style.bottom = '32px';
      handle.style.transform = 'translateX(' + (rtl ? '50%' : '-50%') + ')';
      mountEl.appendChild(handle);
      handle.addEventListener('click', function () {
        innerCollapsed = !innerCollapsed;
        applyInnerCollapse(mountEl, innerCollapsed);
      });
    })();

    var sidebar = mountEl.querySelector('#dash-inner-sidebar');
    if (sidebar) {
      sidebar.addEventListener('click', function (e) {
        var btn = e.target.closest('.dash-nav-btn');
        if (!btn) return;
        var id = btn.getAttribute('data-section');
        if (id) switchSection(mountEl, id, data, ctx);
      });
    }

    var _resizeTimer;
    var _resizeObserver = window.ResizeObserver ? new ResizeObserver(_debouncedResize) : null;
    var lastIsSmallScreen = null;
    function handleResize() {
      if (!document.body.contains(mountEl)) {
        window.removeEventListener('resize', _debouncedResize);
        if (_resizeObserver) _resizeObserver.disconnect();
        return;
      }
      applyResponsiveState(mountEl);
      var width = mountEl.clientWidth || window.innerWidth || 0;
      var isSmallScreen = width < 760;
      if (lastIsSmallScreen === null) {
        lastIsSmallScreen = isSmallScreen;
        innerCollapsed = isSmallScreen;
        applyInnerCollapse(mountEl, innerCollapsed);
      } else if (isSmallScreen !== lastIsSmallScreen) {
        lastIsSmallScreen = isSmallScreen;
        innerCollapsed = isSmallScreen;
        applyInnerCollapse(mountEl, innerCollapsed);
      }
    }
    function _debouncedResize() {
      clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(handleResize, 80);
    }
    window.addEventListener('resize', _debouncedResize);
    if (_resizeObserver) _resizeObserver.observe(mountEl);
    mountEl._dashboardCleanup = function () {
      disconnectPaneThemeObservers(mountEl.querySelector('#dash-section-pane'));
      if (mountEl._dashboardSectionDomCache) {
        mountEl._dashboardSectionDomCache.forEach(function (entry) {
          if (entry && typeof entry.cleanup === 'function') {
            try { entry.cleanup(); } catch (_) {}
          }
          if (entry && entry.inlineThemeObserver) {
            try { entry.inlineThemeObserver.disconnect(); } catch (_) {}
          }
        });
        mountEl._dashboardSectionDomCache.clear();
      }
      window.removeEventListener('resize', _debouncedResize);
      clearTimeout(_resizeTimer);
      if (_resizeObserver) _resizeObserver.disconnect();
    };
    handleResize();
    switchSection(mountEl, activeSection, data, ctx);
    bindDashboardTour(mountEl, data, ctx);
    if (!(window.KhodPremiumPreview && window.KhodPremiumPreview.isActive('dashboard')) && typeof window.mountDashboardAI === 'function') window.mountDashboardAI(mountEl, data, ctx);
  };

  window.refreshDashboardShell = function (mountEl, data) {
    if (!mountEl) return;
    applyResponsiveState(mountEl);
    var active = normalizeSection(mountEl._dashboardActiveSection || 'master');
    var ctx = {
      options: mountEl._dashboardOptions || {},
      onNavigate: function (id) { switchSection(mountEl, id, data, ctx); },
      accent: '#a855f7',
      formatSAR: window.formatSAR,
      i18n: window.dashboardI18n || null
    };
    switchSection(mountEl, active, data, ctx);
    bindDashboardTour(mountEl, data, ctx);
    updateFirstRunGuidance(mountEl, data);
    if (window.dashboardI18n) window.dashboardI18n.apply(mountEl);
    if (window.KhodUI) window.KhodUI.enhance(mountEl);
    if (!(window.KhodPremiumPreview && window.KhodPremiumPreview.isActive('dashboard')) && typeof window.mountDashboardAI === 'function') window.mountDashboardAI(mountEl, data, ctx);
  };
})();
