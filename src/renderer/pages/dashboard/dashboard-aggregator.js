/*
   dashboard-aggregator.js
   Loads Dashboard snapshots, preserves account identity, and converts raw Khod
   rows into the section data consumed by dashboard-shell.js.

   FIXES (v2):
   - Sort: deliveredCount descending (b - a), commission as tiebreaker
   - NDR: deliveredCount / total orders
   - Confirmation %: (confirmed + shipping + processing + delivered) / total
   - Product counters: all buckets (confirmed, shipping, processing, waiting, pending) now properly incremented
   - Debug logging for first 3 products after build
*/
(function () {
  'use strict';

  // =======================================================================
  // IMPORTANT WARNING: Do not translate cities or provinces. 
  // Do not translate cities or provinces.
  // Force showing the city and the province name in Arabic everywhere.
  // =======================================================================

  // ─── T-02: THRESHOLDS ────────────────────────────────────────────────────────
  // Configurable thresholds for Saudi COD e-commerce market.
  // Exposed via window.getDashboardThresholds() for use by other modules.
  var THRESHOLDS = {
    NDR_DANGER:                  0.45,   // NDR < 45% = dangerous
    NDR_SAFE:                    0.75,   // NDR >= 75% = safe / scalable
    NDR_NATIONAL:                0.60,   // Saudi market average (configurable)
    DR_EXCELLENT:                0.75,   // DR > 75% = excellent
    DR_GOOD:                     0.65,   // DR 65-75% = good
    DR_POOR:                     0.55,   // DR < 55% = needs attention
    SCALING_MIN_ORDERS:          30,     // Minimum orders to calculate scaling score
    INSIGHT_MIN_SAMPLE:          15,     // Minimum orders for insight to fire
    PREPAID_ADVANTAGE_THRESHOLD: 0.15,   // If prepaidNdr - codNdr > 15pp, recommend prepaid
    COD_HEAVY_THRESHOLD:         0.85,   // City with >85% COD orders
    SCALING_SCORE_GREEN:         70,
    RISK_SCORE_RED:              65
  };
  window.getDashboardThresholds = function () { return THRESHOLDS; };
  // ─────────────────────────────────────────────────────────────────────────────

  var ALL_ACCOUNTS = '__all__';
  var AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

  function dt(key, params) {
    return window.dashboardI18n ? window.dashboardI18n.t(key, params) : key;
  }

  function raw(text) {
    return window.dashboardI18n ? window.dashboardI18n.raw(text) : text;
  }

  function allLabel() { return dt('shell.allAccounts'); }
  function noUpdate() { return dt('shell.noUpdate'); }

  function fmtNum(n, opts) {
    return window.dashboardI18n ? window.dashboardI18n.number(n, opts) : Number(n).toLocaleString('en-US');
  }

  function getStatusBucket(status) {
    var s = (status || '').toString().trim().toLowerCase();
    if (!s) return 'other';
    if (s === 'delivered' || s === 'مسلمة') return 'delivered';
    if (s === 'in shipping' || s === 'shipping' || s === 'في الشحن' || s === 'تم الشحن') return 'shipping';
    if (s === 'failed' || s === 'canceled' || s === 'cancelled' || s === 'ملغى' || s === 'مرتجع' || s === 'فشلت') return 'failed';
    if (s === 'awaiting confirmation' || s === 'pending' || s === 'بانتظار التأكيد') return 'pending';
    if (s === 'confirmed' || s === 'مؤكد') return 'confirmed';
    if (s === 'under processing' || s === 'قيد المعالجة') return 'processing';
    if (s === 'waiting' || s === 'قيد الانتظار' || s === 'بانتظار الشحن') return 'waiting';
    return 'other';
  }

  function normalizeDateKey(value) {
    if (!value) return '';
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
      var parsed = new Date(value);
      return isNaN(parsed.getTime()) ? value.trim() : parsed.toISOString().slice(0, 10);
    }
    var d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }

  function isRowCreatedInPeriod(row, period) {
    if (!period || !period.dateFrom || !period.dateTo) return true;
    var key = normalizeDateKey(row && (row.createdAt || row.date || row.dashboardDate));
    return key && key >= period.dateFrom && key <= period.dateTo;
  }

  function isRowUpdatedInPeriod(row, period) {
    if (!period || !period.dateFrom || !period.dateTo) return true;
    var key = normalizeDateKey(row && (row.lastUpdatedAt || row.updatedAt || row.dashboardDate));
    return key && key >= period.dateFrom && key <= period.dateTo;
  }

  function deliveredDateMode() {
    if (window.DashboardDeliveredDateState && typeof window.DashboardDeliveredDateState.get === 'function') {
      return window.DashboardDeliveredDateState.get() === 'createdAt' ? 'createdAt' : 'updatedAt';
    }
    return 'updatedAt';
  }

  function isDeliveredRowInPeriod(row, period, mode) {
    if (getStatusBucket(row && (row.orderStatus || row.status)) !== 'delivered') return false;
    return mode === 'createdAt'
      ? isRowCreatedInPeriod(row, period)
      : isRowUpdatedInPeriod(row, period);
  }

  function deliveredDashboardDate(row, mode) {
    return mode === 'createdAt'
      ? normalizeDateKey(row && (row.createdAt || row.date || row.dashboardDate))
      : normalizeDateKey(row && (row.lastUpdatedAt || row.updatedAt || row.dashboardDate));
  }

  function rowDashboardDate(row, mode) {
    if (!row) return '';
    var bucket = getStatusBucket(row.orderStatus || row.status);
    if (bucket === 'delivered') {
      return deliveredDashboardDate(row, mode);
    } else {
      return normalizeDateKey(row.createdAt || row.date || row.dashboardDate);
    }
  }

  function activePeriod() {
    return window.DashboardPeriodState ? window.DashboardPeriodState.get() : null;
  }

  function filterRowsByPeriod(rows, period, mode) {
    if (!period || !period.dateFrom || !period.dateTo) return rows;
    mode = mode || deliveredDateMode();
    return rows.filter(function (row) {
      var bucket = getStatusBucket(row.orderStatus || row.status);
      var createdIn = isRowCreatedInPeriod(row, period);
      return createdIn || (bucket === 'delivered' && isDeliveredRowInPeriod(row, period, mode));
    });
  }

  function filterCreatedOrders(rows, period) {
    if (!period || !period.dateFrom || !period.dateTo) return rows.slice();
    return rows.filter(function (row) {
      return isRowCreatedInPeriod(row, period);
    });
  }

  function filterOutcomeOrders(rows, period, mode) {
    if (!period || !period.dateFrom || !period.dateTo) return rows.slice();
    mode = mode || deliveredDateMode();
    return rows.filter(function (row) {
      var bucket = getStatusBucket(row.orderStatus || row.status);
      return bucket === 'delivered'
        ? isDeliveredRowInPeriod(row, period, mode)
        : isRowCreatedInPeriod(row, period);
    });
  }


  function formatDateRangeLabel(period) {
    if (!period || !period.dateFrom || !period.dateTo) return '';
    var from = new Date(period.dateFrom + 'T00:00:00');
    var to = new Date(period.dateTo + 'T00:00:00');
    var locale = window.dashboardI18n && window.dashboardI18n.locale ? window.dashboardI18n.locale() : ((window._kbotLang || 'en') === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US');
    function fmt(d, opts) { return d.toLocaleDateString(locale, opts); }
    if (period.dateFrom === period.dateTo) {
      return fmt(from, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return fmt(from, { month: 'short', day: 'numeric' }) +
      ' - ' +
      fmt(to, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function monthMeta(snapshotMonth) {
    var parts = (snapshotMonth || '').split('-');
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var now = new Date();
    if (!year || !month || month < 1 || month > 12) {
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }
    return {
      year: year,
      monthIndex: month - 1,
      monthNumber: month,
      label: window.dashboardI18n
        ? window.dashboardI18n.formatMonth(year, month - 1)
        : (AR_MONTHS[month - 1] + ' ' + year)
    };
  }

  function accountLabel(acc, fallback) {
    if (!acc) return fallback || dt('shell.account');
    return acc.easyEmail || acc.email || acc.khodEmail || acc.label || acc.easyStore || acc.storeName || acc.name || fallback || dt('shell.account');
  }

  function latestTimestamp(accounts, activeId) {
    var latest = 0;
    Object.keys(accounts || {}).forEach(function (id) {
      if (activeId !== ALL_ACCOUNTS && id !== activeId) return;
      var snap = accounts[id] || {};
      var ts = snap.autoFetchTimestamp || snap.manualFetchTimestamp || 0;
      if (ts > latest) latest = ts;
    });
    return latest || null;
  }

  function formatTimestamp(ts) {
    if (window.dashboardI18n) return window.dashboardI18n.formatTimestamp(ts);
    if (!ts) return noUpdate();
    var d = new Date(ts);
    if (isNaN(d.getTime())) return noUpdate();
    var now = new Date();
    var hh = ('0' + d.getHours()).slice(-2);
    var mm = ('0' + d.getMinutes()).slice(-2);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) {
      return 'اليوم ' + hh + ':' + mm;
    }
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + ' ' + hh + ':' + mm;
  }

  function chooseSnapshotMonth(accounts, activeId) {
    var months = [];
    Object.keys(accounts || {}).forEach(function (id) {
      if (activeId !== ALL_ACCOUNTS && id !== activeId) return;
      if (accounts[id] && accounts[id].snapshotMonth) months.push(accounts[id].snapshotMonth);
    });
    months.sort();
    return months[months.length - 1] || '';
  }

  function daysBetween(a, b) {
    var start = normalizeDateKey(a);
    var end = normalizeDateKey(b);
    if (!start || !end) return null;
    var da = new Date(start + 'T00:00:00');
    var db = new Date(end + 'T00:00:00');
    if (isNaN(da.getTime()) || isNaN(db.getTime()) || db < da) return null;
    return (db - da) / (24 * 60 * 60 * 1000);
  }

  function calcDelta(nowVal, prevVal) {
    if (prevVal === 0) return nowVal > 0 ? 100 : 0;
    return parseFloat((((nowVal - prevVal) / prevVal) * 100).toFixed(1));
  }

  function percentOf(part, total) {
    return total > 0 ? parseFloat(((part / total) * 100).toFixed(2)) : 0;
  }

  function netDeliveryRate(delivered, total) {
    total = Number(total || 0);
    return total > 0 ? Number(delivered || 0) / total : 0;
  }

  function netDeliveryRatePct(delivered, total) {
    return parseFloat((netDeliveryRate(delivered, total) * 100).toFixed(1));
  }

  function formatPct(part, total) {
    var pct = percentOf(part, total);
    if (pct > 0 && pct < 0.1) return '<0.1%';
    return (pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)) + '%';
  }

  function isCodActiveBucket(bucket) {
    return bucket === 'confirmed' || bucket === 'processing' || bucket === 'shipping';
  }

  function isRawFailedStatus(row) {
    var rawStatus = (row && (row.orderStatus || row.status) || '').toString().trim().toLowerCase();
    return rawStatus === 'failed' || rawStatus === 'فشلت' || rawStatus === 'مرتجع';
  }

  function normalizedQty(row) {
    var qty = Number(row && row.qty);
    return qty > 0 ? String(qty) : '1';
  }

  function amountLookupKey(row) {
    var sku = (row && row.sku != null ? row.sku : '').toString().trim();
    if (!sku) return '';
    return sku + '|' + normalizedQty(row);
  }

  function hasMissingAmountDue(row) {
    if (row && Object.prototype.hasOwnProperty.call(row, 'amountDueMissing')) {
      return !!row.amountDueMissing;
    }
    if (row && Object.prototype.hasOwnProperty.call(row, 'amountDueRaw')) {
      return !String(row.amountDueRaw || '').trim();
    }
    return Number(row && row.amountDue || 0) <= 0;
  }

  function hasMissingTotalPrice(row) {
    return Number(row && row.totalPrice || 0) <= 0;
  }


  // ─── T-01: resolveProvince(cityName) ─────────────────────────────────────────
  // Maps a city name string to one of 11 province IDs.
  // Extracted from section-cities.js coordMap — exact keys preserved.
  var _PROVINCE_MAP = [
    { id: 'riyadh',  keys: ['الرياض', 'الخرج', 'المجمعة', 'الدوادمي', 'riyadh'] },
    { id: 'eastern', keys: ['الشرقية', 'الدمام', 'الخبر', 'الأحساء', 'eastern'] },
    { id: 'mecca',   keys: ['مكة', 'جدة', 'الطائف', 'الغربية', 'mecca'] },
    { id: 'jazan',   keys: ['جيزان', 'جازان', 'jazan', 'gizan'] },
    { id: 'baha',    keys: ['الباحة', 'baha'] },
    { id: 'madinah', keys: ['المدينة', 'ينبع', 'madinah'] },
    { id: 'aseer',   keys: ['عسير', 'أبها', 'خميس', 'aseer'] },
    { id: 'qassim',  keys: ['القصيم', 'بريدة', 'عنيزة', 'qassim'] },
    { id: 'tabuk',    keys: ['تبوك', 'tabuk'] },
    { id: 'hail',     keys: ['حائل', 'hail'] },
    { id: 'najran',   keys: ['نجران', 'najran'] },
    { id: 'jawf',     keys: ['الجوف', 'سكاكا', 'jawf', 'jouf'] },
    { id: 'northern', keys: ['الحدود الشمالية', 'عرعر', 'northern', 'arar'] }
    // 'other' is the fallback — no keys needed
  ];

  function resolveProvince(cityName) {
    if (!cityName) return 'other';
    var lower = String(cityName).toLowerCase();
    for (var i = 0; i < _PROVINCE_MAP.length; i++) {
      var prov = _PROVINCE_MAP[i];
      for (var j = 0; j < prov.keys.length; j++) {
        if (lower.indexOf(prov.keys[j]) !== -1) return prov.id;
      }
    }
    return 'other';
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // ─── T-05: isRowPrepaid(row) ──────────────────────────────────────────────────
  // Determines if an order row is a prepaid (non-COD) order.
  // Defaults to false (COD) — accurate for Saudi COD-heavy market.
  var _PREPAID_METHODS = ['prepaid', 'online', 'card', 'visa', 'mada', 'apple pay', 'applepay', 'stc pay', 'stcpay', 'tabby', 'tabi', 'tamara', 'paymob', 'network'];
  function normalizePaymentText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function detectPrepaidMethod(value) {
    var text = normalizePaymentText(value);
    if (!text) return '';
    if (/tabby|tabi|تابي/.test(text)) return 'tabby';
    if (/tamara|تمارا/.test(text)) return 'tamara';
    if (/pay\s*mob|paymob|باي\s*موب/.test(text)) return 'paymob';
    if (/شبكه|network/.test(text)) return 'network';
    if (/mada|مدي|مدى|visa|فيزا|card|كارت|بطاق/.test(text)) return 'card';
    if (/apple\s*pay|stc\s*pay|online|اونلاين|الكتروني|الكترونى|إلكتروني/.test(text)) return 'online';
    return '';
  }
  var _COD_METHODS     = ['cod', 'cash', 'الدفع عند الاستلام', 'كاش'];

  function isRowPrepaid(row) {
    if (!row) return false;
    // Explicit boolean shorthand
    if (typeof row.isPrepaid === 'boolean') return row.isPrepaid;
    // paymentMethod string
    if (row.paymentMethod) {
      var pm = String(row.paymentMethod).toLowerCase().trim();
      for (var i = 0; i < _PREPAID_METHODS.length; i++) {
        if (pm.indexOf(_PREPAID_METHODS[i]) !== -1) return true;
      }
      for (var j = 0; j < _COD_METHODS.length; j++) {
        if (pm.indexOf(_COD_METHODS[j]) !== -1) return false;
      }
      if (detectPrepaidMethod(row.paymentMethod)) return true;
    }
    if (detectPrepaidMethod(row.notes || row.note || row.paymentNote || row.comment || row.comments)) return true;
    // Default: COD (Saudi market reality)
    return false;
  }
  // ─────────────────────────────────────────────────────────────────────────────

  function buildAmountDueLookup(rows) {
    var samplesByKey = {};
    rows.forEach(function (row) {
      var amount = Number(row.amountDue || 0);
      var key = amountLookupKey(row);
      if (!key || !(amount > 0)) return;
      if (!samplesByKey[key]) samplesByKey[key] = [];
      samplesByKey[key].push(amount);
    });

    var lookup = {};
    Object.keys(samplesByKey).forEach(function (key) {
      var samples = samplesByKey[key];
      var freq = {};
      var mode = samples[0];
      var modeCount = 0;
      samples.forEach(function (amount) {
        var k = String(amount);
        freq[k] = (freq[k] || 0) + 1;
        if (freq[k] > modeCount) {
          mode = amount;
          modeCount = freq[k];
        }
      });
      lookup[key] = {
        amount: mode,
        referenceCount: samples.length,
        modeCount: modeCount,
        distinctAmountCount: Object.keys(freq).length
      };
    });
    return lookup;
  }

  function buildTotalPriceLookup(rows) {
    var samplesByKey = {};
    rows.forEach(function (row) {
      var price = Number(row.totalPrice || 0);
      var key = amountLookupKey(row);
      if (!key || !(price > 0)) return;
      if (!samplesByKey[key]) samplesByKey[key] = [];
      samplesByKey[key].push(price);
    });

    var lookup = {};
    Object.keys(samplesByKey).forEach(function (key) {
      var samples = samplesByKey[key];
      var freq = {};
      var mode = samples[0];
      var modeCount = 0;
      samples.forEach(function (price) {
        var k = String(price);
        freq[k] = (freq[k] || 0) + 1;
        if (freq[k] > modeCount) {
          mode = price;
          modeCount = freq[k];
        }
      });
      lookup[key] = {
        amount: mode,
        referenceCount: samples.length,
        modeCount: modeCount,
        distinctAmountCount: Object.keys(freq).length
      };
    });
    return lookup;
  }


  function orderRef(row) {
    return row.khodOrderNumber || row.orderNumber || row.id || row.orderId || '';
  }

  function missingAmountReportRow(row, filledAmount, lookupInfo, reason) {
    return {
      order: orderRef(row),
      product: row.products || row.productName || row.product || '',
      sku: row.sku || '',
      qty: Number(row.qty || 1),
      amount: Number(filledAmount || 0),
      referenceCount: lookupInfo ? lookupInfo.referenceCount : 0,
      modeCount: lookupInfo ? lookupInfo.modeCount : 0,
      distinctAmountCount: lookupInfo ? lookupInfo.distinctAmountCount : 0,
      method: lookupInfo ? 'sku_qty' : '',
      reason: reason || '',
      customerName: row.customerName || row.name || row.customer || '',
      phone: row.phone || row.phone1 || row.phone2 || row.rawPhone || row.normPhone || row.customerPhone || row.phoneNumber || ''
    };
  }

  function emptyDayBucket() {
    return { earned: 0, incoming: 0, lost: 0, orders: 0, codCollected: 0, codDue: 0 };
  }

  function emptyDailyStats(period, snapshotMonth) {
    var mm = monthMeta((period && period.dateTo ? period.dateTo.slice(0, 7) : '') || snapshotMonth);
    var dayKeys = [];
    var dailyStats = {};

    if (period && period.dateFrom && period.dateTo) {
      var start = new Date(period.dateFrom + 'T00:00:00');
      var end = new Date(period.dateTo + 'T00:00:00');
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        for (var d = new Date(start.getTime()); d <= end; d.setDate(d.getDate() + 1)) {
          var rangeKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          dayKeys.push(rangeKey);
          dailyStats[rangeKey] = emptyDayBucket();
        }
        return { month: mm, dayKeys: dayKeys, dailyStats: dailyStats };
      }
    }

    var daysInMonth = new Date(mm.year, mm.monthNumber, 0).getDate();
    for (var day = 1; day <= daysInMonth; day++) {
      var key = mm.year + '-' + String(mm.monthNumber).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      dayKeys.push(key);
      dailyStats[key] = emptyDayBucket();
    }
    return { month: mm, dayKeys: dayKeys, dailyStats: dailyStats };
  }

  function stage(id, label, count, total, color, convLabel, conv, convFrom, sar) {
    var share = percentOf(count, total);
    return {
      id: id,
      count: count,
      pct: formatPct(count, total),
      share: share,
      color: color,
      label: raw(label),
      convLabel: raw(convLabel || 'نسبة من الإجمالي'),
      conv: conv == null ? share : conv,
      convFrom: raw(convFrom || 'من إجمالي الطلبات'),
      sar: sar != null ? fmtNum(sar) : undefined,
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><circle cx="12" cy="12" r="10"/></svg>'
    };
  }

  function buildAccountOptions(accounts, credList, period) {
    var byId = {};
    (credList || []).forEach(function (acc) {
      if (acc && acc.id) byId[acc.id] = acc;
    });

    var ids = [];
    (credList || []).forEach(function (acc) {
      if (acc && acc.id && ids.indexOf(acc.id) === -1) ids.push(acc.id);
    });
    if (!ids.length) {
      Object.keys(accounts || {}).forEach(function (id) {
        if (ids.indexOf(id) === -1) ids.push(id);
      });
    }

    return ids.map(function (id) {
      var snap = accounts[id] || {};
      var label = accountLabel(byId[id], id);
      var snapshot = Array.isArray(snap.snapshot) ? snap.snapshot : [];
      var periodRows = period && period.dateFrom && period.dateTo
        ? snapshot.filter(function (row) { return isRowCreatedInPeriod(row, period); })
        : snapshot;
      return {
        id: id,
        value: id,
        label: label,
        name: label,
        email: byId[id] ? (byId[id].khodEmail || byId[id].easyEmail || '') : '',
        hasSnapshot: snapshot.length > 0,
        orderCount: periodRows.length,
        rawOrderCount: snapshot.length,
        snapshotMonth: snap.snapshotMonth || '',
        lastUpdatedAt: snap.autoFetchTimestamp || snap.manualFetchTimestamp || null
      };
    });
  }

  window.getActiveAccountId = function () {
    return localStorage.getItem('khod_active_account_id') || ALL_ACCOUNTS;
  };

  window.setActiveAccountId = function (id) {
    localStorage.setItem('khod_active_account_id', id || ALL_ACCOUNTS);
    _aggregatorCache = null;
  };

  var _aggregatorCache = null;
  var _aggregatorCacheAt = 0;
  var _aggregatorCacheHash = '';
  var _aggregatorCachePreview = false;
  var AGGREGATOR_CACHE_TTL = 8000;

  // ─── T-04: Hash-based cache invalidation ──────────────────────────────────────
  // Prevents stale cache after same-account re-fetch with new data.
  // Uses row count + first/last order reference as a cheap structural hash.
  function hashRows(rows) {
    if (!rows || !rows.length) return '0__';
    var first = rows[0] ? (rows[0].khodOrderNumber || rows[0].orderNumber || rows[0].id || '') : '';
    var last  = rows[rows.length - 1] ? (rows[rows.length - 1].khodOrderNumber || rows[rows.length - 1].orderNumber || rows[rows.length - 1].id || '') : '';
    return rows.length + '_' + first + '_' + last;
  }
  // ─────────────────────────────────────────────────────────────────────────────

  window.invalidateDashboardCache = function () { _aggregatorCache = null; _aggregatorCacheHash = ''; _aggregatorCachePreview = false; };

  window.runDashboardAggregator = function (callback) {
    var previewActive = window.KhodPremiumPreview && window.KhodPremiumPreview.isActive('dashboard');
    if (!previewActive && (!window.api || typeof window.api.getDashboardSnapshot !== 'function')) {
      console.warn('[Dashboard] getDashboardSnapshot is not available.');
      callback(null);
      return;
    }

    // T-04: Cache is valid only if within TTL AND rows haven't changed structurally.
    // Hash is computed after rows are collected below — so we do a pre-flight with TTL only,
    // then re-validate with hash after rows are assembled.
    if (_aggregatorCache && _aggregatorCachePreview !== !!previewActive) {
      _aggregatorCache = null;
      _aggregatorCacheHash = '';
    }
    var ttlValid = _aggregatorCache && (Date.now() - _aggregatorCacheAt) < AGGREGATOR_CACHE_TTL;
    if (ttlValid && !_aggregatorCacheHash) {
      // Old cache without hash — invalidate to force rebuild
      _aggregatorCache = null;
    } else if (ttlValid) {
      callback(_aggregatorCache);
      return;
    }

    Promise.all([
      previewActive
        ? Promise.resolve({ ok: true, data: window.KhodPremiumPreview.dashboardAccounts() })
        : window.api.getDashboardSnapshot(ALL_ACCOUNTS),
      previewActive
        ? Promise.resolve({ accounts: [{ id: 'preview-store', easyEmail: 'preview@khodwhaat.com', khodEmail: 'preview@khodwhaat.com', label: 'Preview Store' }] })
        : (window.api.getCredentials ? window.api.getCredentials() : Promise.resolve({}))
    ]).then(function (results) {
      var snapshotRes = results[0];
      var creds = results[1] || {};
      if (!snapshotRes || !snapshotRes.ok) { callback(null); return; }

      var accounts = snapshotRes.data || {};
      var period = activePeriod();
      var accountOptions = buildAccountOptions(accounts, Array.isArray(creds.accounts) ? creds.accounts : [], period);
      var totalOrders = accountOptions.reduce(function (sum, acc) { return sum + acc.orderCount; }, 0);
      var allOption = {
        id: ALL_ACCOUNTS,
        value: ALL_ACCOUNTS,
        label: allLabel(),
        name: allLabel(),
        email: '',
        hasSnapshot: accountOptions.some(function (acc) { return acc.hasSnapshot; }),
        orderCount: totalOrders,
        rawOrderCount: accountOptions.reduce(function (sum, acc) { return sum + (acc.rawOrderCount || 0); }, 0),
        snapshotMonth: chooseSnapshotMonth(accounts, ALL_ACCOUNTS),
        lastUpdatedAt: latestTimestamp(accounts, ALL_ACCOUNTS)
      };

      var canUseAllAccounts = accountOptions.length > 1;
      window.dashboardAccountsList = canUseAllAccounts ? [allOption].concat(accountOptions) : accountOptions;

      var activeId = window.getActiveAccountId();
      if (!canUseAllAccounts && accountOptions.length) {
        activeId = accountOptions[0].id;
        window.setActiveAccountId(activeId);
      }
      if (activeId !== ALL_ACCOUNTS && !accountOptions.some(function (acc) { return acc.id === activeId; })) {
        activeId = canUseAllAccounts ? ALL_ACCOUNTS : (accountOptions[0] ? accountOptions[0].id : ALL_ACCOUNTS);
        window.setActiveAccountId(activeId);
      }

      var activeOption = activeId === ALL_ACCOUNTS
        ? allOption
        : accountOptions.find(function (acc) { return acc.id === activeId; });
      var activeLabel = activeOption ? activeOption.label : allLabel();
      window.currentActiveAccountLabel = activeLabel;

      var rows = [];
      accountOptions.forEach(function (accInfo) {
        if (activeId !== ALL_ACCOUNTS && accInfo.id !== activeId) return;
        var snap = accounts[accInfo.id] || {};
        if (!Array.isArray(snap.snapshot)) return;
        rows = rows.concat(snap.snapshot.map(function (row) {
          return Object.assign({}, row, {
            accountId: accInfo.id,
            accountEmail: accInfo.email || accInfo.label,
            accountLabel: accInfo.label
          });
        }));
      });

      var activeDeliveredDateMode = deliveredDateMode();
      rows = filterRowsByPeriod(rows, period, activeDeliveredDateMode);

      var snapshotMonth = chooseSnapshotMonth(accounts, activeId);
      var lastUpdatedAt = latestTimestamp(accounts, activeId);
      var meta = {
        activeAccountId: activeId,
        activeAccountLabel: activeLabel,
        snapshotMonth: snapshotMonth,
        monthLabel: period ? formatDateRangeLabel(period) : monthMeta(snapshotMonth).label,
        period: period,
        periodLabel: period ? formatDateRangeLabel(period) : monthMeta(snapshotMonth).label,
        deliveredDateMode: activeDeliveredDateMode,
        lastUpdatedAt: lastUpdatedAt,
        lastUpdatedLabel: formatTimestamp(lastUpdatedAt),
        accountOptions: window.dashboardAccountsList,
        hasData: rows.length > 0
      };

      var result = processSnapshotRows(rows, activeId, meta);
      // T-04: Validate hash AFTER rows assembled. If hash matches, old cache is still good.
      var accountHash = window.dashboardAccountsList.map(function (acc) {
        return (acc.id || '') + ':' + (acc.orderCount || 0) + ':' + (acc.lastUpdatedAt || '');
      }).join('|');
      var rowHash = hashRows(rows) + '|' + accountHash + '|' + (period ? (period.preset + ':' + period.dateFrom + ':' + period.dateTo) : '');
      if (_aggregatorCache && rowHash === _aggregatorCacheHash) {
        callback(_aggregatorCache);
        return;
      }
      _aggregatorCache = result;
      _aggregatorCacheAt = Date.now();
      _aggregatorCacheHash = rowHash;
      _aggregatorCachePreview = !!previewActive;
      callback(result);
    }).catch(function (err) {
      console.error('[Dashboard] Aggregator failed:', err);
      callback(null);
    });
  };

  function processSnapshotRows(rows, accountId, meta) {
    rows = Array.isArray(rows) ? rows : [];
    meta = meta || {};

    var dateState = emptyDailyStats(meta.period, meta.snapshotMonth);
    var dayKeys = dateState.dayKeys;
    var dailyStats = dateState.dailyStats;
    function labelForDayKey(key) {
      var parts = String(key || '').split('-');
      var day = Number(parts[2] || 0);
      var monthIndex = Number(parts[1] || 1) - 1;
      var labelMonth = window.dashboardI18n
        ? window.dashboardI18n.monthName(monthIndex)
        : AR_MONTHS[monthIndex];
      return fmtNum(day, { useGrouping: false }) + ' ' + labelMonth;
    }

    var placedCount = 0;
    var deliveredCount = 0, shippingCount = 0, failedCount = 0;
    var pendingCount = 0, confirmedCount = 0, processingCount = 0, waitingCount = 0;
    var earnedCommission = 0, incomingCommission = 0, lostCommission = 0;
    var collected = 0, gapSar = 0, totalDue = 0;
    var drBaseOrders = 0, drDeliveredOrders = 0;
    var prepaidDrBaseOrders = 0, prepaidDrDeliveredOrders = 0;
    var codDrBaseOrders = 0, codDrDeliveredOrders = 0;
    var cityStats = {}, productStats = {}, deliveryDays = [], displayRows = [];
    var amountDueLookup = buildAmountDueLookup(rows);
    var totalPriceLookup = buildTotalPriceLookup(rows);
    var totalSales = 0, totalDeliveredSales = 0;

    var amountRepairReport = {
      totalMissing: 0, filledCount: 0, unfilledCount: 0,
      fillRate: 0, filledRows: [], unfilledRows: []
    };

    var totalSalesRepairReport = {
      totalMissing: 0, filledCount: 0, unfilledCount: 0,
      fillRate: 0, filledRows: [], unfilledRows: []
    };

    rows.forEach(function (row) {
      var bucket = getStatusBucket(row.orderStatus || row.status);
      var commissionVal = Number(row.marketerCommission || row.commission || 0);
      var dueVal = Number(row.amountDue || 0);
      var priceVal = Number(row.totalPrice || 0);

      var inCreatedPeriod = isRowCreatedInPeriod(row, meta.period);
      var deliveredModeForRow = meta.deliveredDateMode || 'updatedAt';
      var isDeliveredInPeriod = isDeliveredRowInPeriod(row, meta.period, deliveredModeForRow);
      var rowIsPrepaid = isRowPrepaid(row);
      var rowIsRealFailed = bucket === 'failed' && isRawFailedStatus(row);

      if (inCreatedPeriod) {
        placedCount++;
      }

      // Repair amountDue
      if (bucket === 'delivered' && hasMissingAmountDue(row)) {
        if (isDeliveredInPeriod) {
          amountRepairReport.totalMissing++;
          var lookupInfo = amountDueLookup[amountLookupKey(row)] || row.amountDueLookup;
          if (lookupInfo && lookupInfo.amount > 0) {
            dueVal = lookupInfo.amount;
            amountRepairReport.filledCount++;
            amountRepairReport.filledRows.push(missingAmountReportRow(row, dueVal, lookupInfo, ''));
          } else {
            dueVal = 0;
            amountRepairReport.unfilledCount++;
            amountRepairReport.unfilledRows.push(missingAmountReportRow(row, 0, null, 'No SKU+qty reference amount found'));
          }
        }
      }

      // Repair totalPrice
      // A row can contribute to created-period sales, delivered-period sales, or both.
      var shouldProcessSales = inCreatedPeriod || isDeliveredInPeriod;
      if (shouldProcessSales && hasMissingTotalPrice(row)) {
        totalSalesRepairReport.totalMissing++;
        var priceLookupInfo = totalPriceLookup[amountLookupKey(row)];
        if (priceLookupInfo && priceLookupInfo.amount > 0) {
          priceVal = priceLookupInfo.amount;
          totalSalesRepairReport.filledCount++;
          totalSalesRepairReport.filledRows.push(missingAmountReportRow(row, priceVal, priceLookupInfo, ''));
        } else {
          priceVal = 0;
          totalSalesRepairReport.unfilledCount++;
          totalSalesRepairReport.unfilledRows.push(missingAmountReportRow(row, 0, null, 'No SKU+qty reference price found'));
        }
      }

      displayRows.push(Object.assign({}, row, {
        dashboardTotalPrice: priceVal,
        dashboardAmountDue: dueVal
      }));

      if (inCreatedPeriod) {
        totalSales += priceVal;
      }
      if (isDeliveredInPeriod) {
        totalDeliveredSales += priceVal;
      }

      if (isDeliveredInPeriod) {
        deliveredCount++; drDeliveredOrders++; drBaseOrders++;
        if (rowIsPrepaid) prepaidDrDeliveredOrders++;
        else codDrDeliveredOrders++;
        if (rowIsPrepaid) prepaidDrBaseOrders++;
        else codDrBaseOrders++;
        earnedCommission += commissionVal;
        collected += dueVal;
      }

      if (bucket === 'failed') {
        if (inCreatedPeriod) {
          failedCount++;
          lostCommission += commissionVal;

          if (rowIsRealFailed) {
            drBaseOrders++;
            if (rowIsPrepaid) prepaidDrBaseOrders++;
            else codDrBaseOrders++;
          }
        }
      } else if (bucket !== 'delivered') {
        if (inCreatedPeriod) {
          if (bucket === 'shipping')    shippingCount++;
          else if (bucket === 'pending')    pendingCount++;
          else if (bucket === 'confirmed')  confirmedCount++;
          else if (bucket === 'processing') processingCount++;
          else if (bucket === 'waiting')    waitingCount++;
          incomingCommission += commissionVal;
          totalDue += dueVal;
          if (isCodActiveBucket(bucket)) {
            drBaseOrders++;
            if (rowIsPrepaid) prepaidDrBaseOrders++;
            else codDrBaseOrders++;
            gapSar += dueVal;
          }
        }
      }

      var dateKey = rowDashboardDate(row, deliveredModeForRow);
      if (dateKey && !dailyStats[dateKey]) {
        dailyStats[dateKey] = emptyDayBucket();
        dayKeys.push(dateKey);
        dayKeys.sort();
      }
      if (dateKey) {
        if (isDeliveredInPeriod) {
          dailyStats[dateKey].orders++;
          dailyStats[dateKey].earned += commissionVal;
          dailyStats[dateKey].codCollected += dueVal;
          dailyStats[dateKey].codDue += dueVal;
        } else if (bucket === 'failed' && inCreatedPeriod) {
          dailyStats[dateKey].orders++;
          dailyStats[dateKey].lost += commissionVal;
        } else if (bucket !== 'delivered' && bucket !== 'failed' && inCreatedPeriod) {
          dailyStats[dateKey].orders++;
          dailyStats[dateKey].incoming += commissionVal;
          if (isCodActiveBucket(bucket)) dailyStats[dateKey].codDue += dueVal;
        }
      }

      // Delivery duration measures completed deliveries, not time to shipping.
      if (isDeliveredInPeriod) {
        var span = daysBetween(row.createdAt || row.date, row.lastUpdatedAt);
        if (span != null && span <= 60) deliveryDays.push(span);
      }

      var cityName = (row.city || '').toString().trim();
      if (cityName) {
        if (!cityStats[cityName]) {
          cityStats[cityName] = {
            due: 0, collected: 0, gap: 0, count: 0,
            deliveredOrders: 0, drBaseOrders: 0, drDeliveredOrders: 0,
            canceledCount: 0, shippingCount: 0, confirmedCount: 0, processingCount: 0,
            earnedCommission: 0, incomingCommission: 0, lostCommission: 0,
            totalRevenue: 0,
            prepaidCount: 0, codCount: 0,
            prepaidDeliveredCount: 0, codDeliveredCount: 0,
            prepaidCanceledCount: 0, codCanceledCount: 0,
            prepaidDrBaseOrders: 0, prepaidDrDeliveredOrders: 0,
            codDrBaseOrders: 0, codDrDeliveredOrders: 0,
            deliveryDays: [],
            provinceId: resolveProvince(cityName),
            productMap: {}
          };
        }

        var cs = cityStats[cityName];

        if (inCreatedPeriod) {
          cs.count++;
          cs.totalRevenue += priceVal;
          if (rowIsPrepaid) cs.prepaidCount++;
          else cs.codCount++;
        }

        if (isDeliveredInPeriod) {
          cs.due       += dueVal;
          cs.collected += dueVal;
          cs.deliveredOrders++;
          cs.drDeliveredOrders++;
          cs.drBaseOrders++;
          cs.earnedCommission += commissionVal;
          if (span != null && span <= 60) cs.deliveryDays.push(span);

          if (rowIsPrepaid) {
            cs.prepaidDeliveredCount++;
            cs.prepaidDrDeliveredOrders++;
            cs.prepaidDrBaseOrders++;
          } else {
            cs.codDeliveredCount++;
            cs.codDrDeliveredOrders++;
            cs.codDrBaseOrders++;
          }
        } else if (bucket === 'failed' && inCreatedPeriod) {
          cs.canceledCount++;
          cs.lostCommission += commissionVal;

          if (rowIsRealFailed) {
            cs.drBaseOrders++;
            if (rowIsPrepaid) cs.prepaidDrBaseOrders++;
            else cs.codDrBaseOrders++;
          }

          if (rowIsPrepaid) {
            cs.prepaidCanceledCount++;
          } else {
            cs.codCanceledCount++;
          }
        } else if (bucket !== 'delivered' && bucket !== 'failed' && inCreatedPeriod) {
          if (bucket === 'shipping')   cs.shippingCount++;
          if (bucket === 'confirmed')  cs.confirmedCount++;
          if (bucket === 'processing') cs.processingCount++;

          cs.incomingCommission += commissionVal;
          cs.due += dueVal;
          cs.gap += dueVal;
          if (isCodActiveBucket(bucket)) {
            cs.drBaseOrders++;
            if (rowIsPrepaid) cs.prepaidDrBaseOrders++;
            else cs.codDrBaseOrders++;
          }
        }

        var cityProductName = row.products || row.productName || row.product || '';
        var cityProductKey = row.sku || cityProductName;
        if (cityProductKey) {
          if (!cs.productMap[cityProductKey]) {
            cs.productMap[cityProductKey] = {
              sku: row.sku || '',
              name: cityProductName || row.sku || raw('منتج غير معروف'),
              orders: 0, delivered: 0, canceled: 0, commission: 0, revenue: 0,
              activeOrders: 0,
              prepaidCount: 0, codCount: 0,
              prepaidDelivered: 0, prepaidCanceled: 0,
              codDelivered: 0, codCanceled: 0
            };
          }
          var cp = cs.productMap[cityProductKey];

          if (inCreatedPeriod) {
            cp.orders++;
            cp.revenue += priceVal;
            if (rowIsPrepaid) cp.prepaidCount++;
            else cp.codCount++;
          }

          if (isDeliveredInPeriod) {
            cp.activeOrders++;
            cp.delivered++;
            cp.commission += commissionVal;

            if (rowIsPrepaid) {
              cp.prepaidDelivered++;
            } else {
              cp.codDelivered++;
            }
          } else if (bucket === 'failed' && inCreatedPeriod) {
            cp.canceled++;
            if (rowIsRealFailed) cp.activeOrders++;

            if (rowIsPrepaid) {
              cp.prepaidCanceled++;
            } else {
              cp.codCanceled++;
            }
          } else if (bucket !== 'delivered' && bucket !== 'failed' && inCreatedPeriod) {
            if (isCodActiveBucket(bucket)) {
              cp.activeOrders++;
            }
          }
        }
      }

      var productName = row.products || row.productName || row.product || '';
      var productKey = row.sku || productName;
      if (productKey) {
        if (!productStats[productKey]) {
          productStats[productKey] = {
            sku: row.sku || '',
            name: productName || row.sku || raw('منتج غير معروف'),
            qty: 0, deliveredQty: 0, revenue: 0, commission: 0,
            deliveredCount: 0, placedCount: 0,
            canceledCount: 0, failedCount: 0, confirmedCount: 0,
            shippingCount: 0, processingCount: 0,
            waitingCount: 0, pendingCount: 0,
            realFailedCount: 0,
            cityMap: {}, piecesMap: {}, quantityCityMap: {}
          };
        }
        var rowQty = Number(row.qty || 1);

        if (inCreatedPeriod) {
          productStats[productKey].placedCount++;
          productStats[productKey].qty += rowQty;
          productStats[productKey].revenue += priceVal;
          if (bucket === 'failed') {
            if (rowIsRealFailed) {
              productStats[productKey].realFailedCount++;
              productStats[productKey].failedCount++;
            }
            else productStats[productKey].canceledCount++;
          } else if (bucket !== 'delivered') {
            if (bucket === 'confirmed') productStats[productKey].confirmedCount++;
            else if (bucket === 'shipping') productStats[productKey].shippingCount++;
            else if (bucket === 'processing') productStats[productKey].processingCount++;
            else if (bucket === 'waiting') productStats[productKey].waitingCount++;
            else if (bucket === 'pending') productStats[productKey].pendingCount++;
          }
        }

        if (isDeliveredInPeriod) {
          productStats[productKey].deliveredQty += rowQty;
          productStats[productKey].commission += commissionVal;
          productStats[productKey].deliveredCount++;
        }

        var cityKey = (row.city || row.cityName || '').toString().trim();
        if (cityKey) {
          if (!productStats[productKey].cityMap[cityKey]) {
            productStats[productKey].cityMap[cityKey] = {
              orders: 0, delivered: 0, canceled: 0, commission: 0, revenue: 0,
              prepaidCount: 0, codCount: 0,
              prepaidDelivered: 0, prepaidCanceled: 0,
              codDelivered: 0, codCanceled: 0
            };
          }
          var pcm = productStats[productKey].cityMap[cityKey];

          if (inCreatedPeriod) {
            pcm.orders++;
            pcm.revenue += priceVal;
            if (rowIsPrepaid) pcm.prepaidCount++;
            else pcm.codCount++;
          }

          if (isDeliveredInPeriod) {
            pcm.delivered++;
            pcm.commission += commissionVal;
          } else if (bucket === 'failed' && inCreatedPeriod) {
            pcm.canceled++;
          }

          if (rowIsPrepaid) {
            if (isDeliveredInPeriod) {
              pcm.prepaidDelivered++;
            } else if (bucket === 'failed' && inCreatedPeriod) {
              pcm.prepaidCanceled++;
            }
          } else {
            if (isDeliveredInPeriod) {
              pcm.codDelivered++;
            } else if (bucket === 'failed' && inCreatedPeriod) {
              pcm.codCanceled++;
            }
          }
        }
        var piecesKey = String(rowQty);
        if (inCreatedPeriod) {
          productStats[productKey].piecesMap[piecesKey] = (productStats[productKey].piecesMap[piecesKey] || 0) + 1;
          if (cityKey) {
            if (!productStats[productKey].quantityCityMap[piecesKey]) {
              productStats[productKey].quantityCityMap[piecesKey] = {};
            }
            var _qcEntry = productStats[productKey].quantityCityMap[piecesKey][cityKey];
            if (!_qcEntry || typeof _qcEntry !== 'object') {
              _qcEntry = { count: typeof _qcEntry === 'number' ? _qcEntry : 0, delivered: 0 };
            }
            _qcEntry.count++;
            if (isDeliveredInPeriod) {
              _qcEntry.delivered++;
            }
            productStats[productKey].quantityCityMap[piecesKey][cityKey] = _qcEntry;
          }
        }
      }
    });


    var earnedSpark = [], incomingSpark = [], lostSpark = [], ordersSpark = [], gapSpark = [];
    var cumEarned = 0, cumIncoming = 0, cumLost = 0, cumOrders = 0, cumGap = 0;

    dayKeys.forEach(function (key) {
      var stat = dailyStats[key];
      cumEarned += stat.earned; cumIncoming += stat.incoming; cumLost += stat.lost;
      cumOrders += stat.orders; cumGap += Math.max(0, stat.codDue - stat.codCollected);
      earnedSpark.push(cumEarned); incomingSpark.push(cumIncoming); lostSpark.push(cumLost);
      ordersSpark.push(cumOrders); gapSpark.push(cumGap);
    });

    var midPoint = Math.floor(dayKeys.length / 2);
    var firstHalfOrders = 0, secondHalfOrders = 0;
    var firstHalfEarned = 0, secondHalfEarned = 0;
    var firstHalfIncoming = 0, secondHalfIncoming = 0;
    var firstHalfLost = 0, secondHalfLost = 0;
    dayKeys.forEach(function (key, idx) {
      var stat = dailyStats[key];
      if (idx < midPoint) {
        firstHalfOrders += stat.orders; firstHalfEarned += stat.earned;
        firstHalfIncoming += stat.incoming; firstHalfLost += stat.lost;
      } else {
        secondHalfOrders += stat.orders; secondHalfEarned += stat.earned;
        secondHalfIncoming += stat.incoming; secondHalfLost += stat.lost;
      }
    });

    var totalCommissionAll = earnedCommission + incomingCommission + lostCommission || 1;
    var healthEarnedPct   = parseFloat(((earnedCommission   / totalCommissionAll) * 100).toFixed(1));
    var healthIncomingPct = parseFloat(((incomingCommission / totalCommissionAll) * 100).toFixed(1));
    var healthLostPct     = parseFloat((Math.max(0, 100 - healthEarnedPct - healthIncomingPct)).toFixed(1));
    var collectedSar = collected;
    var expectedCodSar = collectedSar + gapSar;
    totalDue = expectedCodSar;
    var remaining = gapSar;
    var collectionRate = drBaseOrders > 0 ? parseFloat(((drDeliveredOrders / drBaseOrders) * 100).toFixed(1)) : 0;
    amountRepairReport.fillRate = amountRepairReport.totalMissing > 0
      ? parseFloat(((amountRepairReport.filledCount / amountRepairReport.totalMissing) * 100).toFixed(1))
      : 0;
    totalSalesRepairReport.fillRate = totalSalesRepairReport.totalMissing > 0
      ? parseFloat(((totalSalesRepairReport.filledCount / totalSalesRepairReport.totalMissing) * 100).toFixed(1))
      : 0;

    var overallAov = placedCount > 0 ? parseFloat((totalSales / placedCount).toFixed(2)) : 0;
    var deliveredAov = deliveredCount > 0 ? parseFloat((totalDeliveredSales / deliveredCount).toFixed(2)) : 0;

    var sortedCities = Object.keys(cityStats).map(function (name) {
      var stat = cityStats[name];
      // T-09/T-10: Compute derived rates from extended fields
      var ndrPctCity = netDeliveryRatePct(stat.deliveredOrders, stat.count);
      var drPctCity = stat.drBaseOrders > 0
        ? parseFloat(((stat.deliveredOrders / stat.drBaseOrders) * 100).toFixed(1))
        : 0;
      var prepaidPctCity = stat.count > 0
        ? parseFloat(((stat.prepaidCount / stat.count) * 100).toFixed(1))
        : 0;
      var codPctCity = stat.count > 0
        ? parseFloat(((stat.codCount / stat.count) * 100).toFixed(1))
        : 0;
      var avgOrderValue = stat.count > 0
        ? parseFloat((stat.totalRevenue / stat.count).toFixed(2))
        : 0;
      var avgDeliveryDays = stat.deliveryDays.length
        ? parseFloat((stat.deliveryDays.reduce(function (sum, value) { return sum + value; }, 0) / stat.deliveryDays.length).toFixed(1))
        : null;
      return {
        // Existing fields
        name: name, due: stat.due, collected: stat.collected, gap: stat.gap, sar: stat.gap,
        count: stat.count, deliveredOrders: stat.deliveredOrders, drBaseOrders: stat.drBaseOrders,
        drDeliveredOrders: stat.drDeliveredOrders,
        pct: drPctCity,
        // T-06: Province
        provinceId: stat.provinceId,
        // T-09: Financial
        totalRevenue: stat.totalRevenue, avgOrderValue: avgOrderValue,
        earnedCommission: stat.earnedCommission,
        incomingCommission: stat.incomingCommission,
        lostCommission: stat.lostCommission,
        // T-09: Delivery counters
        canceledCount: stat.canceledCount, shippingCount: stat.shippingCount,
        confirmedCount: stat.confirmedCount, processingCount: stat.processingCount,
        ndrPct: ndrPctCity, drPct: drPctCity,
        avgDeliveryDays: avgDeliveryDays, deliveryDurationOrders: stat.deliveryDays.length,
        // T-10: Prepaid/COD
        prepaidCount: stat.prepaidCount, codCount: stat.codCount,
        prepaidDeliveredCount: stat.prepaidDeliveredCount, codDeliveredCount: stat.codDeliveredCount,
        prepaidCanceledCount: stat.prepaidCanceledCount, codCanceledCount: stat.codCanceledCount,
        prepaidDrBaseOrders: stat.prepaidDrBaseOrders, codDrBaseOrders: stat.codDrBaseOrders,
        prepaidDrDeliveredOrders: stat.prepaidDrDeliveredOrders, codDrDeliveredOrders: stat.codDrDeliveredOrders,
        prepaidPct: prepaidPctCity, codPct: codPctCity,
        // T-12: Product map reference
        productMap: stat.productMap
      };
    }).sort(function (a, b) { return b.gap - a.gap; });

    var coords = {
      'الرياض': { x: 230.6, y: 164.1 }, 'جدة': { x: 87.1, y: 232.2 },
      'الدمام': { x: 294.7, y: 129.4 }, 'مكة': { x: 99.1, y: 233.5 },
      'مكة المكرمة': { x: 99.1, y: 233.5 }, 'المدينة': { x: 95.1, y: 170.5 },
      'المدينة المنورة': { x: 95.1, y: 170.5 }
    };
    var fallbackCoords = [{ x: 150, y: 180 }, { x: 200, y: 220 }, { x: 120, y: 140 }, { x: 250, y: 100 }, { x: 180, y: 130 }];
    var mapCities = sortedCities.slice(0, 5).map(function (city, idx) {
      var dot = coords[city.name] || fallbackCoords[idx] || { x: 150, y: 150 };
      return Object.assign({}, city, { x: dot.x, y: dot.y });
    });

    // ── T-18: Compute national KPI baselines for geo layer (moved up for product scaling score) ──────────────────────
    var nationalNdr = parseFloat(netDeliveryRate(deliveredCount, placedCount).toFixed(4));
    var nationalDr = drBaseOrders > 0
      ? parseFloat((drDeliveredOrders / drBaseOrders).toFixed(4))
      : 0;
    var totalPrepaidCount = 0, totalCodCount = 0;
    Object.keys(cityStats).forEach(function (cn) {
      totalPrepaidCount += cityStats[cn].prepaidCount;
      totalCodCount     += cityStats[cn].codCount;
    });
    var nationalPrepaidPct = placedCount > 0
      ? parseFloat((totalPrepaidCount / placedCount).toFixed(4))
      : 0;
    var avgCommission = deliveredCount > 0
      ? parseFloat((earnedCommission / deliveredCount).toFixed(2))
      : 0;

    var nationalAverages = {
      ndr: nationalNdr,
      dr:  nationalDr,
      prepaidPct: nationalPrepaidPct,
      avgCommission: avgCommission,
      avgOrderValue: placedCount > 0
        ? parseFloat((Object.keys(cityStats).reduce(function (s, cn) { return s + cityStats[cn].totalRevenue; }, 0) / placedCount).toFixed(2))
        : 0
    };

    var totalPiecesAll = Object.keys(productStats).reduce(function (sum, key) {
      return sum + productStats[key].qty;
    }, 0);

    var rankedProducts = Object.keys(productStats).map(function (key) {
      var p = productStats[key];
      var total = p.placedCount || 1;

      // FIX: Confirmation % = (confirmed + shipping + processing + delivered + realFailedCount) / total
      var confirmationPct = parseFloat((
        (p.confirmedCount + p.shippingCount + p.processingCount + p.deliveredCount + (p.realFailedCount || 0)) / total * 100
      ).toFixed(1));

      var cancelPct = parseFloat((p.canceledCount / total * 100).toFixed(1));

      var ndrPct = netDeliveryRatePct(p.deliveredCount, p.placedCount);
      var deliveryPct = parseFloat((p.deliveredCount / total * 100).toFixed(1));

      var activeTotal = p.deliveredCount + p.processingCount + p.confirmedCount + p.shippingCount + (p.realFailedCount || 0);
      var drPct = activeTotal > 0 ? parseFloat((p.deliveredCount / activeTotal * 100).toFixed(1)) : 0;

      var productCities = Object.keys(p.cityMap)
        .map(function (c) {
          var cm = p.cityMap[c];
          // T-11: cm is now a full object {orders, delivered, canceled, commission, revenue, ...}
          var cityOrders    = cm.orders    !== undefined ? cm.orders    : cm; // backward-compat guard
          var cityDelivered = cm.delivered !== undefined ? cm.delivered : 0;
          var cityCanceled  = cm.canceled  !== undefined ? cm.canceled  : 0;
          return {
            name:      c,
            count:     typeof cityOrders === 'object' ? cityOrders.orders || 0 : cityOrders,
            delivered: cityDelivered,
            canceled:  cityCanceled,
            ndr:       netDeliveryRatePct(cityDelivered, cityOrders),
            commission: cm.commission || 0,
            revenue:    cm.revenue    || 0
          };
        })
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, 5);

      var piecesBreakdown = Object.keys(p.piecesMap)
        .map(function (k) { return { qty: k, count: p.piecesMap[k] }; })
        .sort(function (a, b) { return Number(a.qty) - Number(b.qty); });

      var quantityCityBreakdown = Object.keys(p.quantityCityMap)
        .map(function (qtyKey) {
          return {
            qty: qtyKey,
            cities: Object.keys(p.quantityCityMap[qtyKey])
              .map(function (cityName) {
                var entry = p.quantityCityMap[qtyKey][cityName];
                return {
                  name: cityName,
                  count: typeof entry === 'object' ? entry.count : entry,
                  delivered: typeof entry === 'object' ? (entry.delivered || 0) : 0
                };
              })
              .sort(function (a, b) { return b.count - a.count; })
              .slice(0, 5)
          };
        })
        .sort(function (a, b) { return Number(a.qty) - Number(b.qty); });

      var productPrepaidCount = 0;
      Object.keys(p.cityMap).forEach(function(c) {
          productPrepaidCount += (p.cityMap[c].prepaidCount || 0);
      });
      var productPrepaidPct = total > 0 ? parseFloat((productPrepaidCount / total * 100).toFixed(1)) : 0;
      var scaleScore = typeof window.computeScalingScore === 'function' ? window.computeScalingScore({
        drPct: drPct,
        count: p.placedCount,
        prepaidPct: productPrepaidPct
      }, nationalAverages) : 0;

      return {
        key: key,
        sku: p.sku,
        name: p.name,
        units: p.deliveredCount,
        pieces: p.deliveredQty,
        placedCount: p.placedCount,
        qty: p.qty,
        revenue: p.revenue,
        commission: p.commission,
        deliveredCount: p.deliveredCount,
        deliveryRate: p.placedCount > 0 ? parseFloat(((p.deliveredCount / p.placedCount) * 100).toFixed(1)) : 0,
        drRate: activeTotal > 0 ? parseFloat(((p.deliveredCount / activeTotal) * 100).toFixed(1)) : 0,
        totalPieces:      p.qty,
        canceledCount:    p.canceledCount,
        failedCount:      p.failedCount || p.realFailedCount || 0,
        confirmedCount:   p.confirmedCount,
        shippingCount:    p.shippingCount,
        processingCount:  p.processingCount,
        waitingCount:     p.waitingCount,
        pendingCount:     p.pendingCount,
        confirmationPct:  confirmationPct,
        cancelPct:        cancelPct,
        ndrPct:           ndrPct,
        deliveryPct:      deliveryPct,
        scalingScore:     scaleScore,
        cityBreakdown:    productCities,
        piecesBreakdown:  piecesBreakdown,
        quantityCityBreakdown: quantityCityBreakdown
      };
    // FIX: sort descending — highest deliveredCount first; commission as tiebreaker (b - a = desc)
    }).sort(function (a, b) {
      return (b.deliveredCount - a.deliveredCount) || (b.commission - a.commission);
    });

    // DEBUG: verify all counters are correct for top 3 products
    console.log('[Dashboard][products] Counter check for top 3:');
    rankedProducts.slice(0, 3).forEach(function (p, i) {
      console.log('[#' + (i + 1) + '] ' + p.name, {
        placed: p.placedCount,
        delivered: p.deliveredCount,
        canceled: p.canceledCount,
        confirmed: p.confirmedCount,
        shipping: p.shippingCount,
        processing: p.processingCount,
        waiting: p.waitingCount,
        pending: p.pendingCount,
        confirmationPct: p.confirmationPct,
        cancelPct: p.cancelPct,
        ndrPct: p.ndrPct,
        deliveryPct: p.deliveryPct
      });
    });

    var productsWithEmojis = rankedProducts.map(function (p, idx) {
      return Object.assign({}, p, { rank: idx + 1, emoji: '📦' });
    });

    function generatePeriodData(daysBack, field) {
      field = field || 'earned';
      var period = [];
      var startIdx = Math.max(0, dayKeys.length - daysBack);
      for (var i = startIdx; i < dayKeys.length; i++) {
        var key = dayKeys[i];
        period.push({ d: labelForDayKey(key), v: dailyStats[key][field] });
      }
      return period;
    }

    var activeDays = dayKeys.filter(function (key) {
      return dailyStats[key].orders > 0 || dailyStats[key].earned > 0;
    }).length || 1;
    var dailyAvg = parseFloat((earnedCommission / activeDays).toFixed(2));
    var avgDays = deliveryDays.length
      ? parseFloat((deliveryDays.reduce(function (sum, n) { return sum + n; }, 0) / deliveryDays.length).toFixed(1))
      : null;
    var ndrBaseOrders = placedCount;
    var ndrPct = netDeliveryRatePct(deliveredCount, placedCount);

    // National KPIs moved up before rankedProducts

    // Call geo pass-2 builder if available (dashboard-aggregator-geo.js)
    var geoProductMap = null, provinceMap = null, prepaidIntelligence = null, geoInsights = [];
    if (typeof window.buildGeoProductMap === 'function') {
      try {
        var geoResult = window.buildGeoProductMap(cityStats, productStats, nationalAverages);
        geoProductMap       = geoResult.geoProductMap   || null;
        provinceMap         = geoResult.provinceMap     || null;
        prepaidIntelligence = geoResult.prepaidIntelligence || null;
      } catch (geoErr) {
        console.warn('[Dashboard][geo] buildGeoProductMap failed:', geoErr);
      }
    }
    if (typeof window.runInsightEngine === 'function' && geoProductMap) {
      try {
        geoInsights = window.runInsightEngine(
          { cityStats: cityStats, productStats: productStats, geoProductMap: geoProductMap, provinceMap: provinceMap, kpis: nationalAverages },
          THRESHOLDS
        ) || [];
      } catch (insightErr) {
        console.warn('[Dashboard][geo] runInsightEngine failed:', insightErr);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────────

    var savedRoiSettings = null;
    try {
      var roiJSON = localStorage.getItem('khod_roi_settings_' + accountId);
      if (roiJSON) savedRoiSettings = JSON.parse(roiJSON);
    } catch (e) {
      console.warn('Error reading ROI settings from local storage:', e);
    }
    var roiAdSpendRaw = Number(savedRoiSettings && savedRoiSettings.adSpend);
    var roiCurrencyRaw = String((savedRoiSettings && savedRoiSettings.currency) || 'SAR').toUpperCase();
    var roiEgpRateRaw = Number(savedRoiSettings && savedRoiSettings.egpRate);
    var roiAdSpend  = isFinite(roiAdSpendRaw) && roiAdSpendRaw >= 0 ? roiAdSpendRaw : 250;
    var roiCurrency = ['SAR', 'USD', 'EGP'].indexOf(roiCurrencyRaw) !== -1 ? roiCurrencyRaw : 'SAR';
    var roiEgpRate  = isFinite(roiEgpRateRaw) && roiEgpRateRaw > 0 ? roiEgpRateRaw : 52;
    var failureRate   = placedCount > 0 ? percentOf(failedCount, placedCount) : 0;
    var activePipelineCount = pendingCount + confirmedCount + processingCount + waitingCount + shippingCount;
    // Row scopes are intentionally distinct: intake totals use creation date,
    // while delivery outcomes use the date on which delivery happened.
    var createdOrders = filterCreatedOrders(displayRows, meta.period);
    var outcomeOrders = filterOutcomeOrders(displayRows, meta.period, meta.deliveredDateMode || 'updatedAt');

    var pmTotalCount = totalPrepaidCount + totalCodCount;
    var codVal = pmTotalCount > 0 ? parseFloat(((totalCodCount / pmTotalCount) * 100).toFixed(1)) : 0;
    var prepaidVal = pmTotalCount > 0 ? parseFloat(((totalPrepaidCount / pmTotalCount) * 100).toFixed(1)) : 0;
    var calculatedPayMethods = pmTotalCount > 0 ? [
      { label: 'الدفع عند الاستلام', value: codVal, color: '#00e676' },
      { label: 'دفع مسبق', value: prepaidVal, color: '#3b82f6' }
    ] : [];

    return {
      meta: meta,
      overview: {
        earnedCommission:   { value: earnedCommission,   delta: calcDelta(secondHalfEarned,    firstHalfEarned),    unit: 'SAR',         color: 'green'  },
        incomingCommission: { value: incomingCommission, delta: calcDelta(secondHalfIncoming,  firstHalfIncoming),  unit: 'SAR',         color: 'orange' },
        lostCommission:     { value: lostCommission,     delta: calcDelta(secondHalfLost,      firstHalfLost),      unit: 'SAR',         color: 'red'    },
        totalOrders:        { value: placedCount,         delta: calcDelta(secondHalfOrders,    firstHalfOrders),    unit: raw('طلب'),    color: 'blue'   },
        totalSales:          { value: totalSales,          delta: 0,                            unit: 'SAR',         color: 'green'  },
        overallAov:          { value: overallAov,          delta: 0,                            unit: 'SAR',         color: 'blue'   },
        totalDeliveredSales: { value: totalDeliveredSales, delta: 0,                            unit: 'SAR',         color: 'green'  },
        deliveredAov:        { value: deliveredAov,        delta: 0,                            unit: 'SAR',         color: 'blue'   },
        sparklines: { earned: earnedSpark, incoming: incomingSpark, lost: lostSpark, orders: ordersSpark },
        health: {
          earned:   { pct: healthEarnedPct,   sar: earnedCommission   },
          incoming: { pct: healthIncomingPct, sar: incomingCommission },
          lost:     { pct: healthLostPct,     sar: lostCommission     }
        }
      },
      pipeline: {
        metrics: {
          totalOrders: placedCount, totalDelivery: placedCount,
          deliveredCount: deliveredCount, failedCount: failedCount,
          activeCount: activePipelineCount,
          deliveryRate: ndrPct, failureRate: failureRate, overallConversion: ndrPct
        },
        insights: null,
        stages: [
          stage('awaiting',    'بانتظار التأكيد', pendingCount,    placedCount, '#a855f7', 'معدل التأكيد',  placedCount > 0 ? parseFloat((((placedCount - pendingCount) / placedCount) * 100).toFixed(1)) : 0),
          stage('confirmed',   'مؤكد',            confirmedCount,  placedCount, '#3b82f6'),
          stage('processing',  'قيد المعالجة',    processingCount, placedCount, '#3b82f6'),
          stage('waiting',     'قيد الانتظار',    waitingCount,    placedCount, '#64748b'),
          stage('shipping',    'قيد الشحن',        shippingCount,   placedCount, '#f59e0b', null, null, null, incomingCommission),
          stage('delivered',   'تم التسليم',       deliveredCount,  placedCount, '#00e676', 'معدل التسليم', placedCount > 0 ? parseFloat(((deliveredCount / placedCount) * 100).toFixed(1)) : 0, 'من إجمالي الطلبات', earnedCommission),
          stage('failed',      'فشل / ملغى',       failedCount,     placedCount, '#ef4444', 'نسبة الفشل',   placedCount > 0 ? parseFloat(((failedCount / placedCount) * 100).toFixed(1)) : 0, 'من إجمالي الطلبات', lostCommission)
        ]
      },
      orders: createdOrders,
      outcomeOrders: outcomeOrders,
      cod: {
        totalDue: totalDue, collected: collectedSar, remaining: remaining,
        collectionRate: collectionRate, collectedSar: collectedSar,
        gapSar: gapSar, expectedCodSar: expectedCodSar,
        drPct: drBaseOrders > 0 ? parseFloat(((drDeliveredOrders / drBaseOrders) * 100).toFixed(1)) : 0,
        drDeliveredOrders: drDeliveredOrders,
        drBaseOrders: drBaseOrders, drActiveOrders: Math.max(0, drBaseOrders - drDeliveredOrders),
        prepaidDrBaseOrders: prepaidDrBaseOrders, prepaidDrDeliveredOrders: prepaidDrDeliveredOrders,
        codDrBaseOrders: codDrBaseOrders, codDrDeliveredOrders: codDrDeliveredOrders,
        globalPrepaidDr: prepaidDrBaseOrders > 0 ? parseFloat((prepaidDrDeliveredOrders / prepaidDrBaseOrders).toFixed(4)) : 0,
        globalCodDr: codDrBaseOrders > 0 ? parseFloat((codDrDeliveredOrders / codDrBaseOrders).toFixed(4)) : 0,
        ndrPct: ndrPct, ndrBaseOrders: ndrBaseOrders, amountRepairReport: amountRepairReport,
        totalSalesRepairReport: totalSalesRepairReport,
        avgDays: avgDays, gapDelta: calcDelta(secondHalfOrders * 12, firstHalfOrders * 12),
        daysDelta: 0, rateDelta: calcDelta(collectionRate, 50),
        gapSparkData: gapSpark, cities: sortedCities, mapCities: mapCities,
        payMethods: calculatedPayMethods, deliveredCount: pmTotalCount,
        totalCitiesCount: Object.keys(cityStats).length
      },
      products: {
        summary: {
          totalOrders: placedCount, submitted: deliveredCount,
          totalComm: earnedCommission,
          uniqueProducts: Object.keys(productStats).length,
          totalPieces: totalPiecesAll
        },
        rankedList: productsWithEmojis
      },
      commissionTrend: {
        total: earnedCommission,
        totalDelta: calcDelta(secondHalfEarned, firstHalfEarned),
        periods: { '7': generatePeriodData(7, 'earned'), '14': generatePeriodData(14, 'earned'), '30': generatePeriodData(30, 'earned') },
        incomingPeriods: { '7': generatePeriodData(7, 'incoming'), '14': generatePeriodData(14, 'incoming'), '30': generatePeriodData(30, 'incoming') },
        lostPeriods: { '7': generatePeriodData(7, 'lost'), '14': generatePeriodData(14, 'lost'), '30': generatePeriodData(30, 'lost') },
        benchmarks: {
          dailyAvg: dailyAvg,
          weekly: Math.round(dailyAvg * 7),
          last24h: Math.round(dailyStats[dayKeys[dayKeys.length - 1]].earned)
        },
        distribution: [
          { label: raw('الأسبوع الأول'),  value: dayKeys.slice(0, 7).reduce(function (s, k) { return s + dailyStats[k].earned; }, 0),  color: '#a855f7' },
          { label: raw('الأسبوع الثاني'), value: dayKeys.slice(7, 14).reduce(function (s, k) { return s + dailyStats[k].earned; }, 0), color: '#3b82f6' },
          { label: raw('الأسبوع الثالث'), value: dayKeys.slice(14, 21).reduce(function (s, k) { return s + dailyStats[k].earned; }, 0),color: '#14b8a6' },
          { label: raw('الأسبوع الرابع'), value: dayKeys.slice(21).reduce(function (s, k) { return s + dailyStats[k].earned; }, 0),    color: '#00e676' }
        ],
        snapshotMonth: meta.snapshotMonth || '',
        snapshotMonthLabel: meta.monthLabel || ''
      },
      roi: {
        adSpend: roiAdSpend, currency: roiCurrency, egpRate: roiEgpRate, sarRate: 3.75,
        totalOrders: placedCount, ndrPct: ndrPct, avgCommission: avgCommission,
        deliveredCount: deliveredCount,
        avgCPA: placedCount > 0 ? parseFloat((roiAdSpend / placedCount).toFixed(2)) : 0
      },

      // ── T-18: GEO Intelligence layer ────────────────────────────────────────
      // cityStats and productStats are the extended versions built during Pass 1.
      // geoProductMap / provinceMap are built by dashboard-aggregator-geo.js (Pass 2),
      // null until that file is loaded.
      geo: {
        cityStats:          cityStats,
        productStats:       productStats,
        geoProductMap:      geoProductMap,
        provinceMap:        provinceMap,
        prepaidIntelligence: prepaidIntelligence,
        insights:           geoInsights,
        kpis:               nationalAverages
      }
      // ─────────────────────────────────────────────────────────────────────────
    };
  }
})();
