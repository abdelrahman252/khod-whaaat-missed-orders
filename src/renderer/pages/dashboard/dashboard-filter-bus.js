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
  function currentYearBounds() {
    var now = new Date();
    var max = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      min: new Date(max.getFullYear(), 0, 1),
      max: max
    };
  }
  function parseIso(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
    var parts = String(value).split('-').map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return isNaN(d.getTime()) ||
      d.getFullYear() !== parts[0] ||
      d.getMonth() !== parts[1] - 1 ||
      d.getDate() !== parts[2]
      ? null
      : d;
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
    var bounds = currentYearBounds();
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
    var bounds = currentYearBounds();
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
    var bounds = currentYearBounds();
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

  var ROI_CURRENCIES = { SAR: true, USD: true };
  var _roiListeners = [];

  function roiAccountId(accountId) {
    if (accountId) return String(accountId);
    if (window.getActiveAccountId) return String(window.getActiveAccountId() || '__all__');
    return '__all__';
  }

  function roiStorageKey(accountId) {
    return 'khod_roi_settings_' + roiAccountId(accountId);
  }

  function dashboardAccountCurrency(accountId) {
    var currency = String(window.dashboardActiveCurrency || '').toUpperCase();
    return ROI_CURRENCIES[currency] ? currency : 'SAR';
  }

  function normalizeRoiSettings(value, fallback) {
    value = value || {};
    fallback = fallback || {};
    var adSpend = Number(value.adSpend != null ? value.adSpend : fallback.adSpend);
    var currency = String(value.currency || fallback.currency || dashboardAccountCurrency(fallback.accountId || value.accountId)).toUpperCase();
    return {
      adSpend: isFinite(adSpend) && adSpend >= 0 ? adSpend : 0,
      currency: ROI_CURRENCIES[currency] ? currency : 'SAR'
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
        next.currency !== current.currency;
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
  var MARKETING_PLATFORMS = ['tiktok', 'snapchat', 'facebook'];
  var _marketingSyncSeq = 0;
  var _marketingSyncRequests = {};
  var _marketingLoadRequests = {};
  var _marketingQueuedForceLoads = {};
  var _marketingLoadSeq = {};

  function normalizeMarketingPlatform(platform) {
    platform = String(platform || 'tiktok').toLowerCase();
    return MARKETING_PLATFORMS.indexOf(platform) === -1 ? 'tiktok' : platform;
  }

  function platformLabel(platform) {
    platform = normalizeMarketingPlatform(platform);
    return platform === 'snapchat' ? 'Snapchat' : platform === 'facebook' ? 'Facebook' : 'TikTok';
  }

  function marketingAccountId(accountId) {
    return roiAccountId(accountId);
  }

  function marketingAccountLabel(account) {
    return String(account && (
      account.memberName ||
      account.easyEmail ||
      account.easy_email ||
      account.khodEmail ||
      account.khod_email ||
      account.email ||
      account.label ||
      account.name ||
      account.id ||
      ''
    ) || '');
  }

  function marketingAccountKeys(account) {
    var keys = [];
    function push(value) {
      var key = String(value || '').trim().toLowerCase();
      if (key && keys.indexOf(key) === -1) keys.push(key);
    }
    if (typeof account === 'string') {
      push(account);
      return keys;
    }
    push(account && account.id);
    push(account && account.khodEmail);
    push(account && account.khod_email);
    push(account && account.easyEmail);
    push(account && account.easy_email);
    push(account && account.email);
    push(account && account.label);
    push(account && account.name);
    push(account && account.memberName);
    push(marketingAccountLabel(account));
    return keys;
  }

  function marketingStableKey(account) {
    var keys = marketingAccountKeys(account);
    return keys.filter(function (key) {
      return key.indexOf('@') !== -1;
    })[0] || keys[1] || keys[0] || '';
  }

  function dashboardMarketingAccounts() {
    var source = Array.isArray(window.dashboardAccountsList) && window.dashboardAccountsList.length
      ? window.dashboardAccountsList
      : (Array.isArray(window._kbotAccounts) ? window._kbotAccounts : []);
    var seen = {};
    return source.map(function (account) {
      var id = String(account && (account.id || account.accountId || account.key || '') || '');
      if (!id || id === '__all__' || seen[id]) return null;
      seen[id] = true;
      return account;
    }).filter(Boolean);
  }

  function buildMarketingSyncAllSettings(accountId, platform) {
    var summary = summarizeMarketingPlatforms(accountId);
    var platformStatus = platform ? normalizeMarketingStatus(marketingBucket(accountId)[normalizeMarketingPlatform(platform)], accountId, platform) : null;
    var mappings = (platformStatus && platformStatus.mappings) || (summary && summary.mappings) || {};
    return dashboardMarketingAccounts().map(function (account) {
      var id = String(account && (account.id || account.accountId || account.key || '') || '');
      var keys = marketingAccountKeys(account);
      var mappedKey = keys.filter(function (key) {
        return Array.isArray(mappings[key]) && mappings[key].length;
      })[0];
      var roi = window.DashboardRoiState && typeof window.DashboardRoiState.get === 'function'
        ? window.DashboardRoiState.get(id, {})
        : {};
      return {
        dashboardAccountId: id,
        dashboardAccountKey: mappedKey || marketingStableKey(account) || id,
        dashboardAccountKeys: keys,
        currency: roi.currency || dashboardAccountCurrency(id)
      };
    });
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
      [account.memberName, account.easyEmail, account.email, account.khodEmail, account.label, account.name].forEach(function (value) {
        var key = String(value || '').trim().toLowerCase();
        if (key) keys.push(key);
      });
    }
    return keys.filter(function (key, index) { return key && keys.indexOf(key) === index; });
  }

  function normalizeMarketingStatus(value, accountId, platform) {
    value = value || {};
    platform = normalizeMarketingPlatform(platform || value.platform);
    var summary = value.summary && typeof value.summary === 'object' ? value.summary : null;
    var adSpend = summary ? Number(summary.adSpend) : NaN;
    var linkedAccounts = Array.isArray(value.linkedAccounts) ? value.linkedAccounts.map(function (account) {
      return { id: String(account.id || ''), name: String(account.name || ''), currency: String(account.currency || '').toUpperCase() };
    }).filter(function (account) { return !!account.id; }) : [];
    var mappedAccounts = Array.isArray(value.mappedAccounts) ? value.mappedAccounts.map(function (account) {
      return { id: String(account.id || ''), name: String(account.name || ''), currency: String(account.currency || '').toUpperCase() };
    }).filter(function (account) { return !!account.id; }) : linkedAccounts;
    var availableAccounts = Array.isArray(value.availableAccounts) ? value.availableAccounts.map(function (account) {
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
      platform: platform,
      platformLabel: platformLabel(platform),
      status: value.status || 'disconnected',
      sourceAccountId: value.sourceAccountId || '',
      sourceAccountName: value.sourceAccountName || '',
      linkedAccounts: linkedAccounts,
      linkedAccountCount: linkedAccounts.length,
      mappedAccounts: mappedAccounts,
      availableAccounts: availableAccounts,
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
      limit: value.limit && typeof value.limit === 'object' ? value.limit : null,
      limits: value.limits && typeof value.limits === 'object' ? value.limits : null,
      reconnectRequired: !!value.reconnectRequired,
      loading: !!value.loading,
      manualOverride: readManualMarketingOverride(accountId)
    };
  }

  function marketingBucket(accountId) {
    var id = marketingAccountId(accountId);
    var bucket = _marketingByAccount[id];
    if (!bucket || typeof bucket !== 'object' || bucket.platform || bucket.status || bucket.summary) {
      bucket = bucket ? { tiktok: bucket } : {};
      _marketingByAccount[id] = bucket;
    }
    return bucket;
  }

  function summarizeMarketingPlatforms(accountId) {
    var id = marketingAccountId(accountId);
    var bucket = marketingBucket(id);
    var statuses = MARKETING_PLATFORMS.map(function (platform) {
      return normalizeMarketingStatus(bucket[platform], id, platform);
    });
    var activeStatuses = statuses.filter(function (status) {
      return status.status === 'connected' && status.summary && !status.manualOverride;
    });
    var connectedStatuses = statuses.filter(function (status) { return status.status === 'connected'; });
    var linkedAccounts = [];
    var mappings = {};
    var selectedSourceAccounts = [];
    var sourceBreakdown = [];
    var campaignBreakdown = [];
    var summary = activeStatuses.length ? {
      adSpend: 0,
      currency: 'SAR',
      impressions: 0,
      clicks: 0,
      campaignCount: 0,
      rowCount: 0,
      dateFrom: '',
      dateTo: '',
      sourceBreakdown: sourceBreakdown,
      campaignBreakdown: campaignBreakdown,
      platformBreakdown: []
    } : null;
    var latestSyncAt = null;

    statuses.forEach(function (status) {
      (status.linkedAccounts || []).forEach(function (account) {
        linkedAccounts.push(Object.assign({ platform: status.platform }, account));
      });
      Object.keys(status.mappings || {}).forEach(function (key) {
        var rows = Array.isArray(status.mappings[key]) ? status.mappings[key] : [];
        mappings[key] = (mappings[key] || []).concat(rows.map(function (row) {
          return Object.assign({ platform: status.platform }, row);
        }));
      });
      selectedSourceAccounts = selectedSourceAccounts.concat((status.selectedSourceAccounts || []).map(function (row) {
        return Object.assign({ platform: status.platform }, row);
      }));
      if (status.lastSyncAt && (!latestSyncAt || new Date(status.lastSyncAt) > new Date(latestSyncAt))) {
        latestSyncAt = status.lastSyncAt;
      }
      if (!summary || !(status.status === 'connected' && status.summary && !status.manualOverride)) return;
      var source = status.summary || {};
      summary.adSpend += Number(source.adSpend || 0);
      summary.impressions += Number(source.impressions || 0);
      summary.clicks += Number(source.clicks || 0);
      summary.campaignCount += Number(source.campaignCount || 0);
      summary.rowCount += Number(source.rowCount || 0);
      if (source.dateFrom && (!summary.dateFrom || new Date(source.dateFrom) < new Date(summary.dateFrom))) summary.dateFrom = source.dateFrom;
      if (source.dateTo && (!summary.dateTo || new Date(source.dateTo) > new Date(summary.dateTo))) summary.dateTo = source.dateTo;
      (Array.isArray(source.sourceBreakdown) ? source.sourceBreakdown : []).forEach(function (row) {
        sourceBreakdown.push(Object.assign({ platform: status.platform }, row));
      });
      (Array.isArray(source.campaignBreakdown) ? source.campaignBreakdown : []).forEach(function (row) {
        campaignBreakdown.push(Object.assign({ platform: status.platform }, row));
      });
      summary.platformBreakdown.push({
        platform: status.platform,
        label: status.platformLabel,
        adSpend: Number(source.adSpend || 0),
        impressions: Number(source.impressions || 0),
        clicks: Number(source.clicks || 0),
        campaignCount: Number(source.campaignCount || 0),
        rowCount: Number(source.rowCount || 0),
        lastSyncAt: status.lastSyncAt || null
      });
    });
    if (summary) summary.adSpend = Number(summary.adSpend.toFixed(2));
    return {
      accountId: id,
      platform: 'combined',
      platformLabel: 'TikTok + Snapchat + Facebook',
      platforms: statuses,
      status: connectedStatuses.length ? 'connected' : (statuses.some(function (status) { return status.loading; }) ? 'pending' : 'disconnected'),
      sourceAccountId: '',
      sourceAccountName: connectedStatuses.length ? connectedStatuses.length + ' connected marketing platforms' : '',
      linkedAccounts: linkedAccounts,
      linkedAccountCount: linkedAccounts.length,
      mappedAccounts: linkedAccounts,
      availableAccounts: [],
      mappings: mappings,
      selectedSourceAccounts: selectedSourceAccounts,
      selectedSourceAccountIds: selectedSourceAccounts.map(function (account) { return String(account.id || ''); }).filter(Boolean),
      claimableAccounts: [],
      diagnostics: null,
      lastSyncAt: latestSyncAt,
      summary: summary,
      offline: statuses.some(function (status) { return !!status.offline; }),
      error: statuses.map(function (status) { return status.error || ''; }).filter(Boolean).join('; '),
      errorCode: statuses.map(function (status) { return status.errorCode || ''; }).filter(Boolean).join('; '),
      reconnectRequired: statuses.some(function (status) { return !!status.reconnectRequired; }),
      loading: statuses.some(function (status) { return !!status.loading; }),
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
    platforms: MARKETING_PLATFORMS.slice(),
    get: function (accountId, platform) {
      var id = marketingAccountId(accountId);
      if (!platform) return summarizeMarketingPlatforms(id);
      var bucket = marketingBucket(id);
      return normalizeMarketingStatus(bucket[normalizeMarketingPlatform(platform)], id, platform);
    },
    set: function (value, accountId, platform) {
      var id = marketingAccountId(accountId);
      platform = normalizeMarketingPlatform(platform || value && value.platform);
      var bucket = marketingBucket(id);
      if (value && value.ok === false) {
        var previous = bucket[platform] || {};
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
        value = Object.assign({}, previousHasConnectedState ? previous : {}, value, {
          loading: false,
          error: value.error || 'MARKETING_REQUEST_FAILED'
        });
        }
      }
      var next = normalizeMarketingStatus(value, id, platform);
      bucket[platform] = next;
      notifyMarketing(next);
      notifyMarketing(summarizeMarketingPlatforms(id));
      return next;
    },
    setLoading: function (loading, accountId, platform) {
      var current = this.get(accountId, platform);
      current.loading = !!loading;
      try {
        console.info('[Marketing][Store] loading', {
          accountId: marketingAccountId(accountId),
          platform: normalizeMarketingPlatform(platform || current.platform),
          loading: !!loading,
          status: current.status || '',
          error: current.error || ''
        });
      } catch (e) {}
      return this.set(current, accountId, platform);
    },
    invalidate: function (accountId, platform) {
      var id = marketingAccountId(accountId);
      var self = this;
      if (!platform) {
        MARKETING_PLATFORMS.forEach(function (item) { self.invalidate(id, item); });
        return;
      }
      platform = normalizeMarketingPlatform(platform);
      var loadKey = id + '|' + platform;
      _marketingLoadSeq[loadKey] = Number(_marketingLoadSeq[loadKey] || 0) + 1;
    },
    useManualSpend: function (manual, accountId) {
      var id = marketingAccountId(accountId);
      try { localStorage.setItem(manualMarketingKey(id), manual ? '1' : '0'); } catch (e) {}
      notifyMarketing(summarizeMarketingPlatforms(id));
      return this.get(id);
    },
    isSyncedSpendActive: function (accountId) {
      var current = this.get(accountId);
      return current.status === 'connected' && !!current.summary && !current.manualOverride;
    },
    load: function (accountId, platform, options) {
      var id = marketingAccountId(accountId);
      if (!platform) {
        var selfAll = this;
        return Promise.all(MARKETING_PLATFORMS.map(function (item) {
          return selfAll.load(id, item, options).catch(function () { return null; });
        })).then(function () { return selfAll.get(id); });
      }
      platform = normalizeMarketingPlatform(platform);
      options = options || {};
      var loadKey = id + '|' + platform;
      if (_marketingLoadRequests[loadKey]) {
        if (!options.force) return _marketingLoadRequests[loadKey];
        if (!_marketingQueuedForceLoads[loadKey]) {
          var queuedOptions = Object.assign({}, options, { force: true });
          var queuedSelf = this;
          _marketingQueuedForceLoads[loadKey] = _marketingLoadRequests[loadKey].catch(function () {
            return null;
          }).then(function () {
            delete _marketingQueuedForceLoads[loadKey];
            return queuedSelf.load(id, platform, queuedOptions);
          });
        }
        return _marketingQueuedForceLoads[loadKey];
      }
      if (!window.api || typeof window.api.getMarketingStatus !== 'function') {
        return Promise.resolve(this.get(id, platform));
      }
      var requestSeq = Number(_marketingLoadSeq[loadKey] || 0);
      if (!options.background) this.setLoading(true, id, platform);
      var self = this;
      console.info('[Marketing][Store] status request', { accountId: id, platform: platform });
      _marketingLoadRequests[loadKey] = window.api.getMarketingStatus(id, platform).then(function (response) {
        console.info('[Marketing][Store] status response', response);
        if (Number(_marketingLoadSeq[loadKey] || 0) !== requestSeq) return self.get(id, platform);
        return self.set(response && response.ok ? response : Object.assign({}, response || {}, {
          ok: false,
          error: response && response.error ? response.error : 'STATUS_UNAVAILABLE'
        }), id, platform);
      }).catch(function (error) {
        console.error('[Marketing][Store] status failed', error);
        if (Number(_marketingLoadSeq[loadKey] || 0) !== requestSeq) return self.get(id, platform);
        return self.set({ ok: false, error: error.message || String(error), platform: platform }, id, platform);
      }).finally(function () {
        delete _marketingLoadRequests[loadKey];
      });
      return _marketingLoadRequests[loadKey];
    },
    sync: function (accountId, range, platform) {
      var id = marketingAccountId(accountId);
      if (!platform) {
        var selfAll = this;
        var candidates = MARKETING_PLATFORMS.filter(function (item) {
          var current = selfAll.get(id, item);
          return current.status === 'connected' && (
            id === '__all__' ||
            (Array.isArray(current.selectedSourceAccountIds) && current.selectedSourceAccountIds.length) ||
            (current.mappings && Object.keys(current.mappings).length)
          );
        });
        if (!candidates.length) candidates = MARKETING_PLATFORMS.filter(function (item) {
          return selfAll.get(id, item).status === 'connected';
        });
        if (!candidates.length) return Promise.resolve(selfAll.get(id));
        return Promise.all(candidates.map(function (item) {
          return selfAll.sync(id, range, item).catch(function () { return null; });
        })).then(function () { return selfAll.get(id); });
      }
      platform = normalizeMarketingPlatform(platform);
      if (!window.api || typeof window.api.syncMarketingData !== 'function') {
        return Promise.resolve(this.set({ ok: false, error: 'SYNC_UNAVAILABLE', platform: platform }, id, platform));
      }
      this.setLoading(true, id, platform);
      var self = this;
      var requestKey = id + '|' + platform;
      var requestSeq = ++_marketingSyncSeq;
      _marketingSyncRequests[requestKey] = requestSeq;
      function logMarketingSyncMode(label, response) {
        response = response || {};
        var cache = response.cache || (response.summary && response.summary.cache) || null;
        var mode = response.mode || (cache && cache.mode) || '';
        console.info('[Marketing][Store] sync mode', {
          label: label,
          ok: !!response.ok,
          platform: response.platform || platform,
          mode: mode || 'unknown',
          cache: cache || null
        });
        if (response.ok && mode === 'incremental') {
          console.info('[Marketing][Store] incremental verified', {
            platform: response.platform || platform,
            mode: mode,
            cache: {
              mode: cache && cache.mode || mode,
              reusedDays: cache && cache.reusedDays || 0,
              refreshedDays: cache && cache.refreshedDays || 0,
              fetchedRanges: cache && cache.fetchedRanges || [],
              stale: !!(cache && cache.stale),
              providerRequestCount: cache && cache.providerRequestCount || 0
            }
          });
        }
      }
      console.info('[Marketing][Store] sync request', { accountId: id, platform: platform, range: range || {}, requestSeq: requestSeq });
      if (id === '__all__' && typeof window.api.syncAllMarketingData === 'function') {
        var allRange = Object.assign({}, range || {}, {
          accountSettings: Array.isArray(range && range.accountSettings) && range.accountSettings.length
            ? range.accountSettings
            : buildMarketingSyncAllSettings(id, platform)
        });
        return window.api.syncAllMarketingData(platform, allRange).then(function (response) {
          console.info('[Marketing][Store] sync_all response', response);
          logMarketingSyncMode('sync_all', response);
          if (_marketingSyncRequests[requestKey] !== requestSeq) return self.get(id, platform);
          if (response && response.ok && response.accountStatuses) {
            Object.keys(response.accountStatuses).forEach(function (accountKey) {
              self.set(response.accountStatuses[accountKey], accountKey, platform);
            });
          }
          return self.set(response && response.ok ? response : Object.assign({}, response || {}, {
            ok: false,
            error: response && response.error ? response.error : 'SYNC_FAILED'
          }), id, platform);
        }).catch(function (error) {
          console.error('[Marketing][Store] sync_all failed', error);
          if (_marketingSyncRequests[requestKey] !== requestSeq) return self.get(id, platform);
          return self.set({ ok: false, error: error.message || String(error), platform: platform }, id, platform);
        });
      }
      return window.api.syncMarketingData(id, platform, range || {}).then(function (response) {
        console.info('[Marketing][Store] sync response', response);
        logMarketingSyncMode('sync', response);
        if (_marketingSyncRequests[requestKey] !== requestSeq) return self.get(id, platform);
        return self.set(response && response.ok ? response : Object.assign({}, response || {}, {
          ok: false,
          error: response && response.error ? response.error : 'SYNC_FAILED'
        }), id, platform);
      }).catch(function (error) {
        console.error('[Marketing][Store] sync failed', error);
        if (_marketingSyncRequests[requestKey] !== requestSeq) return self.get(id, platform);
        return self.set({ ok: false, error: error.message || String(error), platform: platform }, id, platform);
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
      return toIso(currentYearBounds().min);
    },
    maxDate: function () {
      return toIso(currentYearBounds().max);
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
