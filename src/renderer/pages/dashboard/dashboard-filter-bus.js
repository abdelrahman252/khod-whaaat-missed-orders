/* ══════════════════════════════════════════════════════════════════════════════
   dashboard-filter-bus.js  (T-13)
   Global pub/sub state manager for cross-section filter synchronisation.
   No DOM dependencies — pure state object with subscriber notifications.

   Exposed on window:
     DashboardFilterBus.getState()
     DashboardFilterBus.setState(patch)
     DashboardFilterBus.subscribe(fn)
     DashboardFilterBus.unsubscribe(fn)
     DashboardFilterBus.reset()
     DashboardFilterBus.MODES  — valid mapMode values
   ══════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Valid map display modes ─────────────────────────────────────────────── */
  var MODES = {
    ORDERS:  'orders',    // Dot size = order volume (default)
    NDR:     'ndr',       // Province heatmap by NDR%
    REVENUE: 'revenue',   // Province heatmap by earned commission
    PREPAID: 'prepaid',   // Province heatmap by prepaid%
    PRODUCT: 'product'    // City dots coloured by selected product's NDR
  };

  /* ── Default state ───────────────────────────────────────────────────────── */
  var _defaultState = {
    selectedProvince: null,   // provinceId string | null
    selectedCity:     null,   // cityName string   | null
    selectedProduct:  null,   // productKey string | null  (T-22: product focus)
    paymentFilter:    'all',  // 'all' | 'prepaid' | 'cod'
    mapMode:          MODES.ORDERS,
    ndrRange:         null    // [min, max] fraction | null
  };

  var _state = Object.assign({}, _defaultState);
  var _listeners = [];

  var MS_DAY = 24 * 60 * 60 * 1000;
  var PERIOD_STORAGE_KEY = 'khod_dashboard_period';
  var DELIVERED_DATE_MODE_STORAGE_KEY = 'khod_dashboard_delivered_date_mode';
  var DELIVERED_DATE_MODES = {
    UPDATED_AT: 'updatedAt',
    CREATED_AT: 'createdAt'
  };

  function pad(n) { return String(n).padStart(2, '0'); }
  function toIso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function rollingBounds() {
    var now = new Date();
    var max = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      min: new Date(max.getFullYear(), max.getMonth() - 2, 1),
      max: max
    };
  }
  function parseIso(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
    var parts = String(value).split('-').map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return isNaN(d.getTime()) ? null : d;
  }
  function monthId(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  function presetForMonth(d) {
    var now = new Date();
    var current = new Date(now.getFullYear(), now.getMonth(), 1);
    var prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var twoBack = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    var id = monthId(d);
    if (id === monthId(current)) return 'thisMonth';
    if (id === monthId(prev)) return 'prevMonth';
    if (id === monthId(twoBack)) return 'twoMonthsAgo';
    return 'month:' + id;
  }
  function rangeForMonth(year, monthNumber) {
    var start = new Date(year, monthNumber - 1, 1);
    var end = new Date(year, monthNumber, 0);
    return clampRange({ dateFrom: toIso(start), dateTo: toIso(end) });
  }
  function rangeForPreset(preset) {
    var bounds = rollingBounds();
    var today = bounds.max;
    var start;
    var monthMatch = /^month:(\d{4})-(\d{2})$/.exec(String(preset || ''));
    if (monthMatch) return rangeForMonth(Number(monthMatch[1]), Number(monthMatch[2]));
    if (preset === 'today') start = new Date(today.getTime());
    else if (preset === 'yesterday') {
      start = new Date(today.getTime() - MS_DAY);
      today = new Date(today.getTime() - MS_DAY);
    }
    else if (preset === 'last7') start = new Date(today.getTime() - 6 * MS_DAY);
    else if (preset === 'last14') start = new Date(today.getTime() - 13 * MS_DAY);
    else if (preset === 'last30') start = new Date(today.getTime() - 29 * MS_DAY);
    else if (preset === 'prevMonth') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      today = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (preset === 'twoMonthsAgo') {
      start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      today = new Date(today.getFullYear(), today.getMonth() - 1, 0);
    } else {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    return clampRange({ dateFrom: toIso(start), dateTo: toIso(today) });
  }
  function clampRange(range) {
    var bounds = rollingBounds();
    var min = bounds.min;
    var max = bounds.max;
    var from = parseIso(range && range.dateFrom) || min;
    var to = parseIso(range && range.dateTo) || max;
    if (from < min) from = min;
    if (to > max) to = max;
    if (to < from) to = from;
    return { dateFrom: toIso(from), dateTo: toIso(to) };
  }
  function availableMonths() {
    var bounds = rollingBounds();
    var cursor = new Date(bounds.max.getFullYear(), bounds.max.getMonth(), 1);
    var first = new Date(bounds.min.getFullYear(), bounds.min.getMonth(), 1);
    var months = [];
    while (cursor >= first) {
      months.push({
        id: monthId(cursor),
        preset: presetForMonth(cursor),
        dateFrom: rangeForPreset(presetForMonth(cursor)).dateFrom,
        dateTo: rangeForPreset(presetForMonth(cursor)).dateTo,
        year: cursor.getFullYear(),
        monthIndex: cursor.getMonth()
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
    }
    return months;
  }
  function defaultPeriod() {
    return Object.assign({ preset: 'thisMonth' }, rangeForPreset('thisMonth'));
  }
  function loadPeriod() {
    try {
      var stored = JSON.parse(localStorage.getItem(PERIOD_STORAGE_KEY) || 'null');
      if (stored && stored.preset) {
        if (stored.preset === 'custom') return Object.assign({ preset: 'custom' }, clampRange(stored));
        return Object.assign({ preset: stored.preset }, clampRange(rangeForPreset(stored.preset)));
      }
    } catch (_) {}
    return defaultPeriod();
  }
  function normalizeDeliveredDateMode(value) {
    value = String(value || DELIVERED_DATE_MODES.UPDATED_AT);
    return value === DELIVERED_DATE_MODES.CREATED_AT
      ? DELIVERED_DATE_MODES.CREATED_AT
      : DELIVERED_DATE_MODES.UPDATED_AT;
  }
  function loadDeliveredDateMode() {
    try {
      return normalizeDeliveredDateMode(localStorage.getItem(DELIVERED_DATE_MODE_STORAGE_KEY));
    } catch (_) {
      return DELIVERED_DATE_MODES.UPDATED_AT;
    }
  }
  var _period = loadPeriod();
  var _periodListeners = [];
  var _deliveredDateMode = loadDeliveredDateMode();
  var _deliveredDateModeListeners = [];
  function notifyPeriod() {
    var snap = Object.assign({}, _period);
    _periodListeners.forEach(function (fn) {
      try { fn(snap); } catch (e) { console.warn('[FilterBus] Period subscriber threw:', e); }
    });
  }
  function notifyDeliveredDateMode() {
    var mode = _deliveredDateMode;
    _deliveredDateModeListeners.forEach(function (fn) {
      try { fn(mode); } catch (e) { console.warn('[FilterBus] Delivered date mode subscriber threw:', e); }
    });
  }

  /* ── Internal: notify all subscribers ───────────────────────────────────── */
  function _notify() {
    var snapshot = Object.assign({}, _state);
    for (var i = 0; i < _listeners.length; i++) {
      try { _listeners[i](snapshot); }
      catch (e) { console.warn('[FilterBus] Subscriber threw:', e); }
    }
  }

  /* ── Public API ──────────────────────────────────────────────────────────── */
  window.DashboardFilterBus = {

    MODES: MODES,

    /** Returns a shallow copy of the current filter state. */
    getState: function () {
      return Object.assign({}, _state);
    },

    /**
     * Merge a partial patch into state and notify all subscribers.
     * Only keys present in _defaultState are accepted (unknown keys ignored).
     * @param {object} patch
     */
    setState: function (patch) {
      if (!patch || typeof patch !== 'object') return;
      var changed = false;
      Object.keys(patch).forEach(function (key) {
        if (!Object.prototype.hasOwnProperty.call(_defaultState, key)) return;
        // Validate mapMode
        if (key === 'mapMode') {
          var validModes = Object.keys(MODES).map(function (k) { return MODES[k]; });
          if (validModes.indexOf(patch[key]) === -1) {
            console.warn('[FilterBus] Invalid mapMode:', patch[key]);
            return;
          }
        }
        // Validate paymentFilter
        if (key === 'paymentFilter') {
          if (['all', 'prepaid', 'cod'].indexOf(patch[key]) === -1) {
            console.warn('[FilterBus] Invalid paymentFilter:', patch[key]);
            return;
          }
        }
        if (_state[key] !== patch[key]) {
          _state[key] = patch[key];
          changed = true;
        }
      });
      if (changed) _notify();
    },

    /**
     * Register a subscriber function.
     * Called with a shallow copy of state whenever state changes.
     * @param {function} fn
     */
    subscribe: function (fn) {
      if (typeof fn !== 'function') return;
      if (_listeners.indexOf(fn) === -1) _listeners.push(fn);
    },

    /**
     * Remove a previously registered subscriber.
     * @param {function} fn
     */
    unsubscribe: function (fn) {
      _listeners = _listeners.filter(function (l) { return l !== fn; });
    },

    /** Reset all filters to defaults and notify subscribers. */
    reset: function () {
      _state = Object.assign({}, _defaultState);
      _notify();
    }
  };

  var ROI_CURRENCIES = { SAR: true, USD: true, EGP: true };
  var _roiListeners = [];

  function roiAccountId(accountId) {
    if (accountId) return String(accountId);
    if (window.getActiveAccountId) return String(window.getActiveAccountId() || '__all__');
    return '__all__';
  }

  function roiStorageKey(accountId) {
    return 'khod_roi_settings_' + roiAccountId(accountId);
  }

  function normalizeRoiSettings(value, fallback) {
    value = value || {};
    fallback = fallback || {};
    var adSpend = Number(value.adSpend != null ? value.adSpend : fallback.adSpend);
    var egpRate = Number(value.egpRate != null ? value.egpRate : fallback.egpRate);
    var currency = String(value.currency || fallback.currency || 'SAR').toUpperCase();
    return {
      adSpend: isFinite(adSpend) && adSpend >= 0 ? adSpend : 0,
      currency: ROI_CURRENCIES[currency] ? currency : 'SAR',
      egpRate: isFinite(egpRate) && egpRate > 0 ? egpRate : 52
    };
  }

  function loadRoiSettings(accountId, fallback) {
    var stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(roiStorageKey(accountId)) || 'null');
    } catch (e) {
      console.warn('[FilterBus] Invalid ROI settings storage:', e);
    }
    return normalizeRoiSettings(stored || fallback, fallback);
  }

  function notifyRoiSettings(settings, accountId) {
    var snapshot = Object.assign({ accountId: roiAccountId(accountId) }, settings);
    _roiListeners.forEach(function (fn) {
      try { fn(Object.assign({}, snapshot)); }
      catch (e) { console.warn('[FilterBus] ROI subscriber threw:', e); }
    });
  }

  window.DashboardRoiState = {
    currencies: Object.keys(ROI_CURRENCIES),
    get: function (accountId, fallback) {
      return loadRoiSettings(accountId, fallback);
    },
    set: function (patch, accountId, fallback) {
      var current = loadRoiSettings(accountId, fallback);
      var next = normalizeRoiSettings(Object.assign({}, current, patch || {}), current);
      var changed = next.adSpend !== current.adSpend ||
        next.currency !== current.currency ||
        next.egpRate !== current.egpRate;
      try {
        localStorage.setItem(roiStorageKey(accountId), JSON.stringify(next));
      } catch (e) {
        console.warn('[FilterBus] Unable to persist ROI settings:', e);
      }
      if (changed) notifyRoiSettings(next, accountId);
      return Object.assign({}, next);
    },
    subscribe: function (fn) {
      if (typeof fn === 'function' && _roiListeners.indexOf(fn) === -1) _roiListeners.push(fn);
    },
    unsubscribe: function (fn) {
      _roiListeners = _roiListeners.filter(function (listener) { return listener !== fn; });
    },
    normalize: normalizeRoiSettings
  };

  var _marketingByAccount = {};
  var _marketingListeners = [];

  function marketingAccountId(accountId) {
    return roiAccountId(accountId);
  }

  function manualMarketingKey(accountId) {
    return 'khod_marketing_manual_spend_' + marketingAccountId(accountId);
  }

  function readManualMarketingOverride(accountId) {
    try {
      return localStorage.getItem(manualMarketingKey(accountId)) === '1';
    } catch (e) {
      return false;
    }
  }

  function marketingMappingKeys(accountId) {
    var id = marketingAccountId(accountId);
    var keys = [id, String(id).toLowerCase()];
    var accounts = Array.isArray(window.dashboardAccountsList) ? window.dashboardAccountsList : [];
    var account = accounts.filter(function (candidate) {
      return String(candidate && candidate.id || '') === id;
    })[0];
    if (account) {
      [account.easyEmail, account.email, account.khodEmail, account.label, account.name].forEach(function (value) {
        var key = String(value || '').trim().toLowerCase();
        if (key) keys.push(key);
      });
    }
    return keys.filter(function (key, index) { return key && keys.indexOf(key) === index; });
  }

  function normalizeMarketingStatus(value, accountId) {
    value = value || {};
    var summary = value.summary && typeof value.summary === 'object' ? value.summary : null;
    var adSpend = summary ? Number(summary.adSpend) : NaN;
    var linkedAccounts = Array.isArray(value.linkedAccounts) ? value.linkedAccounts.map(function (account) {
      return { id: String(account.id || ''), name: String(account.name || ''), currency: String(account.currency || '').toUpperCase() };
    }).filter(function (account) { return !!account.id; }) : [];
    var mappings = value.mappings && typeof value.mappings === 'object' ? value.mappings : {};
    Object.keys(mappings).forEach(function (key) {
      mappings[key] = Array.isArray(mappings[key]) ? mappings[key].map(function (account) {
        return { id: String(account.id || ''), name: String(account.name || ''), currency: String(account.currency || '').toUpperCase() };
      }).filter(function (account) { return !!account.id; }) : [];
    });
    var selectedAccounts = [];
    marketingMappingKeys(accountId).some(function (key) {
      if (!Array.isArray(mappings[key])) return false;
      selectedAccounts = mappings[key];
      return true;
    });
    return {
      accountId: marketingAccountId(accountId),
      platform: 'tiktok',
      status: value.status || 'disconnected',
      sourceAccountId: value.sourceAccountId || '',
      sourceAccountName: value.sourceAccountName || '',
      linkedAccounts: linkedAccounts,
      linkedAccountCount: linkedAccounts.length,
      mappings: mappings,
      selectedSourceAccounts: selectedAccounts,
      selectedSourceAccountIds: selectedAccounts.map(function (account) { return String(account.id || ''); }).filter(Boolean),
      claimableAccounts: Array.isArray(value.claimableAccounts) ? value.claimableAccounts.map(function (account) {
        return { id: String(account.id || ''), name: String(account.name || ''), currency: String(account.currency || '').toUpperCase() };
      }).filter(function (account) { return !!account.id; }) : [],
      diagnostics: value.diagnostics || null,
      lastSyncAt: value.lastSyncAt || null,
      summary: summary ? Object.assign({}, summary, {
        adSpend: isFinite(adSpend) && adSpend >= 0 ? adSpend : 0
      }) : null,
      offline: !!value.offline,
      error: value.error || '',
      errorCode: value.errorCode || value.error || '',
      reconnectRequired: !!value.reconnectRequired,
      loading: !!value.loading,
      manualOverride: readManualMarketingOverride(accountId)
    };
  }

  function notifyMarketing(status) {
    _marketingListeners.forEach(function (fn) {
      try { fn(Object.assign({}, status, { summary: status.summary ? Object.assign({}, status.summary) : null })); }
      catch (e) { console.warn('[FilterBus] Marketing subscriber threw:', e); }
    });
  }

  window.DashboardMarketingState = {
    get: function (accountId) {
      var id = marketingAccountId(accountId);
      return normalizeMarketingStatus(_marketingByAccount[id], id);
    },
    set: function (value, accountId) {
      var id = marketingAccountId(accountId);
      if (value && value.ok === false) {
        var previous = _marketingByAccount[id] || {};
        if (value.reconnectRequired) {
          value = Object.assign({}, previous, value, {
            status: 'disconnected',
            loading: false,
            reconnectRequired: true,
            errorCode: value.error || 'WINDSOR_RECONNECT_REQUIRED',
            error: value.error || 'WINDSOR_RECONNECT_REQUIRED'
          });
        } else {
        var previousHasConnectedState = previous.status && previous.status !== 'disconnected' ||
          !!previous.summary ||
          (Array.isArray(previous.linkedAccounts) && previous.linkedAccounts.length > 0) ||
          (previous.mappings && Object.keys(previous.mappings).length > 0);
        value = Object.assign({}, value, previousHasConnectedState ? previous : {}, {
          loading: false,
          error: value.error || 'MARKETING_REQUEST_FAILED'
        });
        }
      }
      var next = normalizeMarketingStatus(value, id);
      _marketingByAccount[id] = next;
      notifyMarketing(next);
      return next;
    },
    setLoading: function (loading, accountId) {
      var current = this.get(accountId);
      current.loading = !!loading;
      return this.set(current, accountId);
    },
    useManualSpend: function (manual, accountId) {
      var id = marketingAccountId(accountId);
      try { localStorage.setItem(manualMarketingKey(id), manual ? '1' : '0'); } catch (e) {}
      return this.set(this.get(id), id);
    },
    isSyncedSpendActive: function (accountId) {
      var current = this.get(accountId);
      return current.status === 'connected' && !!current.summary && !current.manualOverride;
    },
    load: function (accountId) {
      var id = marketingAccountId(accountId);
      if (!window.api || typeof window.api.getMarketingStatus !== 'function') {
        return Promise.resolve(this.get(id));
      }
      this.setLoading(true, id);
      var self = this;
      console.info('[Marketing][Store] status request', { accountId: id, platform: 'tiktok' });
      return window.api.getMarketingStatus(id, 'tiktok').then(function (response) {
        console.info('[Marketing][Store] status response', response);
        return self.set(response && response.ok ? response : Object.assign({}, response || {}, {
          ok: false,
          error: response && response.error ? response.error : 'STATUS_UNAVAILABLE'
        }), id);
      }).catch(function (error) {
        console.error('[Marketing][Store] status failed', error);
        return self.set({ ok: false, error: error.message || String(error) }, id);
      });
    },
    sync: function (accountId, range) {
      var id = marketingAccountId(accountId);
      if (!window.api || typeof window.api.syncMarketingData !== 'function') {
        return Promise.resolve(this.set({ ok: false, error: 'SYNC_UNAVAILABLE' }, id));
      }
      this.setLoading(true, id);
      var self = this;
      return window.api.syncMarketingData(id, 'tiktok', range || {}).then(function (response) {
        return self.set(response && response.ok ? response : Object.assign({}, response || {}, {
          ok: false,
          error: response && response.error ? response.error : 'SYNC_FAILED'
        }), id);
      }).catch(function (error) {
        return self.set({ ok: false, error: error.message || String(error) }, id);
      });
    },
    subscribe: function (fn) {
      if (typeof fn === 'function' && _marketingListeners.indexOf(fn) === -1) _marketingListeners.push(fn);
    },
    unsubscribe: function (fn) {
      _marketingListeners = _marketingListeners.filter(function (listener) { return listener !== fn; });
    }
  };

  window.DashboardPeriodState = {
    get: function () { return Object.assign({}, _period); },
    setPreset: function (preset) {
      _period = preset === 'custom'
        ? Object.assign({ preset: 'custom' }, clampRange(_period))
        : Object.assign({ preset: preset }, clampRange(rangeForPreset(preset)));
      localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(_period));
      if (window.invalidateDashboardCache) window.invalidateDashboardCache();
      notifyPeriod();
    },
    setCustomRange: function (dateFrom, dateTo) {
      _period = Object.assign({ preset: 'custom' }, clampRange({ dateFrom: dateFrom, dateTo: dateTo }));
      localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(_period));
      if (window.invalidateDashboardCache) window.invalidateDashboardCache();
      notifyPeriod();
    },
    subscribe: function (fn) {
      if (typeof fn === 'function' && _periodListeners.indexOf(fn) === -1) _periodListeners.push(fn);
    },
    unsubscribe: function (fn) {
      _periodListeners = _periodListeners.filter(function (l) { return l !== fn; });
    },
    rangeForPreset: rangeForPreset,
    clampRange: clampRange,
    availableMonths: availableMonths,
    minDate: function () {
      return toIso(rollingBounds().min);
    },
    maxDate: function () {
      return toIso(rollingBounds().max);
    }
  };

  window.DashboardDeliveredDateState = {
    MODES: DELIVERED_DATE_MODES,
    get: function () { return _deliveredDateMode; },
    set: function (mode) {
      var next = normalizeDeliveredDateMode(mode);
      if (next === _deliveredDateMode) return _deliveredDateMode;
      _deliveredDateMode = next;
      try {
        localStorage.setItem(DELIVERED_DATE_MODE_STORAGE_KEY, _deliveredDateMode);
      } catch (e) {
        console.warn('[FilterBus] Unable to persist delivered date mode:', e);
      }
      if (window.invalidateDashboardCache) window.invalidateDashboardCache();
      notifyDeliveredDateMode();
      return _deliveredDateMode;
    },
    subscribe: function (fn) {
      if (typeof fn === 'function' && _deliveredDateModeListeners.indexOf(fn) === -1) _deliveredDateModeListeners.push(fn);
    },
    unsubscribe: function (fn) {
      _deliveredDateModeListeners = _deliveredDateModeListeners.filter(function (l) { return l !== fn; });
    },
    normalize: normalizeDeliveredDateMode
  };

})();
