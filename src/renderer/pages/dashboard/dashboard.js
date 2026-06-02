/*
   dashboard.js
   Outer Dashboard page mount. The inner shell owns the fixed topbar, section
   routing, and account changes; this file owns loading aggregator data.
*/
(function () {
  'use strict';

  function resetObject(target, source) {
    Object.keys(target).forEach(function (key) {
      delete target[key];
    });
    Object.assign(target, source || {});
  }

  function emptyDashboardData() {
    var allLabel = window.dashboardI18n ? window.dashboardI18n.t('shell.allAccounts') : 'كل الحسابات المشتركة';
    var noUpdate = window.dashboardI18n ? window.dashboardI18n.t('shell.noUpdate') : 'لا يوجد تحديث';
    return {
      _loaded: true,
      meta: {
        activeAccountId: window.getActiveAccountId ? window.getActiveAccountId() : '__all__',
        activeAccountLabel: window.currentActiveAccountLabel || allLabel,
        monthLabel: '',
        hasData: false,
        lastUpdatedLabel: noUpdate,
        accountOptions: window.dashboardAccountsList || [{ id: '__all__', value: '__all__', label: allLabel, name: allLabel, orderCount: 0 }]
      },
      overview: null,
      pipeline: null,
      stages: [],
      orders: [],
      outcomeOrders: [],
      cod: null,
      products: null,
      commissionTrend: null,
      roi: null,
      geo: null
    };
  }

  function mapAggregatorToSections(result) {
    var orders = Array.isArray(result.orders) ? result.orders : [];
    var outcomeOrders = Array.isArray(result.outcomeOrders) ? result.outcomeOrders : orders;
    var pipeline = result.pipeline ? Object.assign({}, result.pipeline, { orders: orders }) : null;
    return {
      _loaded: true,
      meta: result.meta || {},
      overview: result.overview || null,
      pipeline: pipeline,
      stages: result.pipeline && result.pipeline.stages ? result.pipeline.stages : [],
      orders: orders,
      outcomeOrders: outcomeOrders,
      cod: result.cod || null,
      products: result.products || null,
      commissionTrend: result.commissionTrend || null,
      roi: result.roi || null,
      geo: result.geo || null
    };
  }

  window.renderDashboard = function () {
    var el = document.getElementById('page-dashboard');
    if (!el) return;

    // Preserve the active section across re-renders (e.g. language switches).
    // The shell stores it on the mount element; save it before the DOM is wiped.
    var prevMount = document.getElementById('db-shell-mount');
    if (prevMount && prevMount._dashboardActiveSection) {
      window._dashboardInitialSection = prevMount._dashboardActiveSection;
    }

    el.innerHTML =
      '<div class="sv3-shell dashboard-page-shell">' +
        renderSharedSidebar('dashboard') +
        '<div class="dashboard-page-main">' +
          '<div id="db-shell-mount"></div>' +
          '<div id="dashboard-update-overlay" class="dashboard-update-overlay" hidden aria-live="polite" aria-busy="false"></div>' +
        '</div>' +
      '</div>';

    wireSharedSidebar(el);
    if (window.dashboardI18n) window.dashboardI18n.apply(el);

    var shellMount = document.getElementById('db-shell-mount');
    var updateOverlay = document.getElementById('dashboard-update-overlay');
    var dashData = { _loaded: false, meta: { accountOptions: window.dashboardAccountsList || [] } };
    var dashVersion = 0;
    var marketingStatusLoads = {};
    var autoMarketingSyncTimer = null;
    var lastAutoMarketingSyncKey = '';
    var resolvePendingAutoMarketingSync = null;
    var dashboardRefreshSeq = 0;

    function esc(value) {
      if (window.KhodUI && typeof window.KhodUI.esc === 'function') return window.KhodUI.esc(value);
      return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
      });
    }

    function setDashboardUpdateOverlay(state) {
      var overlay = document.getElementById('dashboard-update-overlay') || updateOverlay;
      if (!overlay) return;
      state = state || {};
      var active = !!state.active;
      overlay.hidden = !active;
      overlay.setAttribute('aria-busy', active ? 'true' : 'false');
      if (!active) {
        overlay.innerHTML = '';
        return;
      }
      var title = state.title || (window._t ? window._t('dashboard.fetching_title') : 'Updating dashboard...');
      var body = state.body || (window._t ? window._t('dashboard.fetching_body') : 'Fetching orders, refreshing product data, and matching ad spend across accounts. This can take a few minutes; keep the app open.');
      overlay.innerHTML =
        '<div class="dashboard-update-panel" role="status">' +
          '<span class="dash-preloader-spinner" aria-hidden="true"></span>' +
          '<div class="dashboard-update-copy">' +
            '<strong>' + esc(title) + '</strong>' +
            '<span>' + esc(body) + '</span>' +
          '</div>' +
        '</div>';
    }

    window.setDashboardUpdateOverlay = setDashboardUpdateOverlay;
    if (window._dashboardFetchState) setDashboardUpdateOverlay(window._dashboardFetchState);

    function ensureMarketingStatusLoaded(data) {
      var store = window.DashboardMarketingState;
      if (!store || typeof store.get !== 'function' || typeof store.load !== 'function') return Promise.resolve(null);
      var meta = data && data.meta ? data.meta : {};
      var accountId = meta.activeAccountId || (window.getActiveAccountId ? window.getActiveAccountId() : '__all__');
      accountId = String(accountId || '__all__');
      if (!accountId) return Promise.resolve(null);

      var current = store.get(accountId);
      if (current && current.loading && marketingStatusLoads[accountId]) return marketingStatusLoads[accountId];
      if (marketingStatusLoads[accountId]) return marketingStatusLoads[accountId];
      if (current && (current.summary || current.status !== 'disconnected' || current.error || current.offline || current.reconnectRequired)) {
        return Promise.resolve(current);
      }

      marketingStatusLoads[accountId] = store.load(accountId).catch(function () { return null; }).then(function (status) {
        marketingStatusLoads[accountId] = null;
        return status;
      });
      return marketingStatusLoads[accountId];
    }

    function activeDashboardAccountId() {
      var activeId = window.getActiveAccountId ? window.getActiveAccountId() : '__all__';
      return String(activeId || '__all__');
    }

    function marketingSyncPayload(period, accountId) {
      period = period || (window.DashboardPeriodState && window.DashboardPeriodState.get()) || {};
      var roi = window.DashboardRoiState && typeof window.DashboardRoiState.get === 'function'
        ? window.DashboardRoiState.get(accountId, dashData && dashData.roi)
        : {};
      return {
        dateFrom: period.from || period.dateFrom || period.start || '',
        dateTo: period.to || period.dateTo || period.end || '',
        targetCurrency: 'SAR',
        egpRate: Number(roi.egpRate) || 52
      };
    }

    function setDashboardLoading() {
      dashData._loaded = false;
      dashData._loading = true;
      dashData._version = ++dashVersion;
      dashData.meta = dashData.meta || {};
      dashData.meta.activeAccountId = activeDashboardAccountId();
      if (typeof window.refreshDashboardShell === 'function') {
        window.refreshDashboardShell(shellMount, dashData);
      }
    }

    function syncMarketingSpend(period) {
      var store = window.DashboardMarketingState;
      if (!store || typeof store.sync !== 'function') return Promise.resolve(null);
      var accountId = activeDashboardAccountId();
      var payload = marketingSyncPayload(period, accountId);
      if (!payload.dateFrom || !payload.dateTo) return Promise.resolve(null);
      var syncKey = accountId + '|' + payload.dateFrom + '|' + payload.dateTo + '|' + payload.egpRate;
      clearTimeout(autoMarketingSyncTimer);
      if (resolvePendingAutoMarketingSync) {
        resolvePendingAutoMarketingSync(null);
        resolvePendingAutoMarketingSync = null;
      }
      return new Promise(function (resolve) {
        resolvePendingAutoMarketingSync = resolve;
        autoMarketingSyncTimer = setTimeout(function () {
          var currentKey = syncKey;
          lastAutoMarketingSyncKey = currentKey;
          var loadFirst = Promise.resolve(null);
          if (typeof store.get === 'function' && typeof store.load === 'function') {
            var current = store.get(accountId);
            var hasKnownMarketingState = !!(
              current &&
              (current.summary ||
                current.status !== 'disconnected' ||
                current.error ||
                current.offline ||
                current.reconnectRequired ||
                current.linkedAccountCount)
            );
            if (!hasKnownMarketingState) loadFirst = store.load(accountId).catch(function () { return null; });
          }
          loadFirst.then(function () {
            if (lastAutoMarketingSyncKey !== currentKey) return null;
            return store.sync(accountId, payload);
          }).then(function (result) {
            if (resolvePendingAutoMarketingSync === resolve) resolvePendingAutoMarketingSync = null;
            resolve(result);
          }).catch(function (error) {
            console.warn('[Dashboard] Automatic marketing spend sync failed:', error);
            if (resolvePendingAutoMarketingSync === resolve) resolvePendingAutoMarketingSync = null;
            resolve(null);
          });
        }, 350);
      });
    }

    function ensureMarketingReady(data, options) {
      options = options || {};
      return ensureMarketingStatusLoaded(data).then(function (status) {
        if (!options.syncMarketing) return status;
        var meta = data && data.meta ? data.meta : {};
        return syncMarketingSpend(meta.period).then(function (syncStatus) {
          return syncStatus || status;
        });
      });
    }

    function runAggregator(showLoader, options) {
      options = options || {};
      var readyResolve = null;
      var readyPromise = new Promise(function (resolve) { readyResolve = resolve; });
      if (document.getElementById('preloader') && !window._dashboardInitialReady) {
        window._dashboardInitialReady = readyPromise;
      }

      if (showLoader) {
        dashData._loaded = false;
        dashData._loading = true;
        dashData._version = ++dashVersion;
        dashData.meta = dashData.meta || {};
        dashData.meta.activeAccountId = window.getActiveAccountId ? window.getActiveAccountId() : '__all__';
        if (typeof window.refreshDashboardShell === 'function') {
          window.refreshDashboardShell(shellMount, dashData);
        }
      }

      if (typeof window.runDashboardAggregator !== 'function') {
        resetObject(dashData, emptyDashboardData());
        dashData._version = ++dashVersion;
        dashData._loading = false;
        if (typeof window.refreshDashboardShell === 'function') {
          window.refreshDashboardShell(shellMount, dashData);
        }
        if (readyResolve) readyResolve(dashData);
        return readyPromise;
      }

      window.runDashboardAggregator(function (result) {
        if (!result) {
          resetObject(dashData, emptyDashboardData());
        } else {
          resetObject(dashData, mapAggregatorToSections(result));
        }
        dashData._version = ++dashVersion;
        window.dashboardGeoData = dashData;
        dashData._loading = true;
        ensureMarketingReady(dashData, options).then(function () {
          dashData._loading = false;
          dashData._version = ++dashVersion;
          window.dashboardGeoData = dashData;
          if (typeof window.refreshDashboardShell === 'function') {
            window.refreshDashboardShell(shellMount, dashData);
          }
          if (readyResolve) readyResolve(dashData);
        });
      });
      return readyPromise;
    }

    function handlePeriodChange() {
      var period = window.DashboardPeriodState && window.DashboardPeriodState.get();
      var refreshSeq = ++dashboardRefreshSeq;
      setDashboardLoading();
      syncMarketingSpend(period).then(function () {
        if (refreshSeq !== dashboardRefreshSeq) return;
        runAggregator(true);
      });
    }

    function handleDeliveredDateModeChange() {
      runAggregator(true);
    }

    window.renderDashboardShell(shellMount, dashData, {
      onAccountChange: function (accountId) {
        if (window.setActiveAccountId) window.setActiveAccountId(accountId);
        var refreshSeq = ++dashboardRefreshSeq;
        setDashboardLoading();
        syncMarketingSpend(window.DashboardPeriodState && window.DashboardPeriodState.get()).then(function () {
          if (refreshSeq !== dashboardRefreshSeq) return;
          runAggregator(true);
        });
      },
      onPeriodChange: handlePeriodChange,
      onDeliveredDateModeChange: handleDeliveredDateModeChange,
      onDashboardUpdate: function (period) {
        var activeId = window.getActiveAccountId ? window.getActiveAccountId() : '__all__';
        var ids = [];
        if (activeId && activeId !== '__all__') ids = [activeId];
        else ids = (window.dashboardAccountsList || [])
          .filter(function (acc) { return acc && acc.id && acc.id !== '__all__'; })
          .map(function (acc) { return acc.id; });
        if (!ids.length && Array.isArray(window._kbotAccounts)) {
          ids = window._kbotAccounts
            .filter(function (acc) { return acc && acc.id; })
            .map(function (acc) { return acc.id; });
        }
        if (typeof window._onRunForDashboard === 'function') {
          window._onRunForDashboard(ids, period || (window.DashboardPeriodState && window.DashboardPeriodState.get()), { stayOnDashboard: true });
        }
      }
    });

    runAggregator(false, { syncMarketing: true });
    if (window.KhodPremiumPreview) window.KhodPremiumPreview.mount(el, 'dashboard');
  };
})();
