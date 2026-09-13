/*
   dashboard-khod-logic-core.js
   KHOD dashboard business semantics shared by dashboard aggregation and
   later dashboard sections. Plain globals for the Electron renderer.
*/
(function () {
  'use strict';

  var STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    WAITING: 'waiting',
    SHIPPING: 'shipping',
    DELIVERED: 'delivered',
    FAILED: 'failed',
    CANCELED: 'canceled',
    OTHER: 'other'
  };

  var STATUS_META = [
    { bucket: STATUS.PENDING, label: 'Pending', order: 10, businessGroup: 'incoming', color: '#f59e0b' },
    { bucket: STATUS.CONFIRMED, label: 'Confirmed', order: 20, businessGroup: 'incoming', color: '#22c55e' },
    { bucket: STATUS.PROCESSING, label: 'Under processing', order: 30, businessGroup: 'incoming', color: '#3b82f6' },
    { bucket: STATUS.WAITING, label: 'Waiting', order: 40, businessGroup: 'incoming', color: '#06b6d4' },
    { bucket: STATUS.SHIPPING, label: 'In shipping', order: 50, businessGroup: 'incoming', color: '#f97316' },
    { bucket: STATUS.DELIVERED, label: 'Delivered', order: 60, businessGroup: 'delivered', color: '#10b981' },
    { bucket: STATUS.FAILED, label: 'Failed', order: 70, businessGroup: 'lost', color: '#ef4444' },
    { bucket: STATUS.CANCELED, label: 'Canceled', order: 80, businessGroup: 'canceled', color: '#94a3b8' },
    { bucket: STATUS.OTHER, label: 'Unknown', order: 999, businessGroup: 'other', color: '#8892a4' }
  ];

  var META_BY_BUCKET = STATUS_META.reduce(function (map, item) {
    map[item.bucket] = item;
    return map;
  }, {});

  var ARABIC_ALIASES = {
    'بانتظار التأكيد': STATUS.PENDING,
    'قيد الانتظار': STATUS.WAITING,
    'في الانتظار': STATUS.WAITING,
    'مؤكد': STATUS.CONFIRMED,
    'مؤكدة': STATUS.CONFIRMED,
    'قيد المعالجة': STATUS.PROCESSING,
    'في الشحن': STATUS.SHIPPING,
    'قيد الشحن': STATUS.SHIPPING,
    'تم الشحن': STATUS.SHIPPING,
    'مسلمة': STATUS.DELIVERED,
    'تم التسليم': STATUS.DELIVERED,
    'تم التوصيل': STATUS.DELIVERED,
    'فشلت': STATUS.FAILED,
    'فشل': STATUS.FAILED,
    'ملغى': STATUS.CANCELED,
    'ملغي': STATUS.CANCELED,
    'ملغاة': STATUS.CANCELED
  };

  var TEXT_ALIASES = {
    'pending': STATUS.PENDING,
    'awaiting confirmation': STATUS.PENDING,
    'pending confirmation': STATUS.PENDING,
    'confirmed': STATUS.CONFIRMED,
    'under processing': STATUS.PROCESSING,
    'under-processing': STATUS.PROCESSING,
    'processing': STATUS.PROCESSING,
    'waiting': STATUS.WAITING,
    'in shipping': STATUS.SHIPPING,
    'shipping': STATUS.SHIPPING,
    'shipped': STATUS.SHIPPING,
    'delivered': STATUS.DELIVERED,
    'failed': STATUS.FAILED,
    'fail': STATUS.FAILED,
    'canceled': STATUS.CANCELED,
    'cancelled': STATUS.CANCELED,
    'cancel': STATUS.CANCELED
  };

  function normalizeText(value) {
    return String(value == null ? '' : value)
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function normalizeArabic(value) {
    return String(value == null ? '' : value)
      .trim()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ');
  }

  function moneyValue(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return isFinite(value) ? value : 0;
    var text = String(value).trim();
    var sign = /^\s*\(.*\)\s*$/.test(text) || /-/.test(text) ? -1 : 1;
    var cleaned = text.replace(/[^\d.,-]/g, '').replace(/-/g, '');
    if (!cleaned) return 0;
    var lastDot = cleaned.lastIndexOf('.');
    var lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot && /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, '');
    } else if (lastComma > lastDot && cleaned.split(',').length === 2 && cleaned.split(',')[1].length <= 2) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
    var n = Number(cleaned);
    return isFinite(n) ? sign * n : 0;
  }

  function firstMoney(row, keys) {
    row = row || {};
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (!Object.prototype.hasOwnProperty.call(row, key)) continue;
      var n = moneyValue(row[key]);
      if (n > 0) return n;
    }
    return 0;
  }

  function normalizeStatus(input) {
    var raw = input && typeof input === 'object'
      ? (input.orderStatus != null ? input.orderStatus : input.status)
      : input;
    var text = normalizeText(raw);
    if (!text) return Object.assign({ raw: raw || '' }, META_BY_BUCKET[STATUS.OTHER]);

    if (TEXT_ALIASES[text]) {
      return Object.assign({ raw: raw }, META_BY_BUCKET[TEXT_ALIASES[text]]);
    }

    var ar = normalizeArabic(raw);
    if (NORMALIZED_ARABIC_ALIASES[ar]) {
      return Object.assign({ raw: raw }, META_BY_BUCKET[NORMALIZED_ARABIC_ALIASES[ar]]);
    }

    return Object.assign({ raw: raw }, META_BY_BUCKET[STATUS.OTHER]);
  }

  function hasKnownLifecycleStatus(row) {
    if (!row || typeof row !== 'object') return false;
    if (row.khodStatusKnown === true || row.orderStatusKnown === true) {
      return normalizeStatus(row).bucket !== STATUS.OTHER;
    }
    if (row.khodStatusKnown === false || row.orderStatusKnown === false) return false;
    if (row.khodOrderNumberKnown === true || row.khodOrderNumber || row.taagerOrderNumber) {
      return normalizeStatus(row).bucket !== STATUS.OTHER;
    }

    var raw = row.orderStatus != null && String(row.orderStatus).trim() !== ''
      ? row.orderStatus
      : row.status;
    var text = normalizeText(raw);
    if (!text || text === 'real' || text === 'missed' || text === 'pending khod sync') return false;
    // EasyOrders-only first-run rows historically carry this neutral placeholder.
    if (text === 'under processing' || text === 'under-processing' || text === 'processing') return false;
    return normalizeStatus(raw).bucket !== STATUS.OTHER;
  }

  function statusInfo(bucketOrStatus) {
    var bucket = META_BY_BUCKET[bucketOrStatus] ? bucketOrStatus : normalizeStatus(bucketOrStatus).bucket;
    return META_BY_BUCKET[bucket] || META_BY_BUCKET[STATUS.OTHER];
  }

  function display(bucketOrStatus) {
    return statusInfo(bucketOrStatus).label;
  }

  function color(bucketOrStatus) {
    return statusInfo(bucketOrStatus).color;
  }

  function dashboardBucket(status) {
    return normalizeStatus(status).bucket;
  }

  function isDelivered(orderOrStatus) {
    return normalizeStatus(orderOrStatus).bucket === STATUS.DELIVERED;
  }

  function isFailed(orderOrStatus) {
    return normalizeStatus(orderOrStatus).bucket === STATUS.FAILED;
  }

  function isCanceled(orderOrStatus) {
    return normalizeStatus(orderOrStatus).bucket === STATUS.CANCELED;
  }

  function isIncoming(orderOrStatus) {
    return statusInfo(normalizeStatus(orderOrStatus).bucket).businessGroup === 'incoming';
  }

  function isActivePipeline(orderOrStatus) {
    return isIncoming(orderOrStatus);
  }

  function isEligibleForNdr(orderOrStatus) {
    return !isCanceled(orderOrStatus);
  }

  function isConfirmed(orderOrStatus) {
    var bucket = normalizeStatus(orderOrStatus).bucket;
    return bucket === STATUS.CONFIRMED ||
      bucket === STATUS.PROCESSING ||
      bucket === STATUS.WAITING ||
      bucket === STATUS.SHIPPING ||
      bucket === STATUS.DELIVERED ||
      bucket === STATUS.FAILED;
  }

  function statusGroup(bucketOrStatus) {
    var bucket = normalizeStatus(bucketOrStatus).bucket;
    if (bucket === STATUS.CANCELED) return 'cancel';
    if (isConfirmed(bucket)) return 'confirmation';
    return 'pending';
  }

  function revenueValue(row) {
    return firstMoney(row, ['totalPrice', 'priceNoShipping', 'subtotal', 'salesValue', 'dashboardTotalPrice']);
  }

  function codValue(row) {
    return firstMoney(row, ['amountDue', 'dashboardAmountDue', 'codValue']);
  }

  function commissionValue(row) {
    return firstMoney(row, ['marketerCommission', 'commission', 'commissionValue', 'dashboardCommission']);
  }

  function rateInputs(row) {
    var meta = normalizeStatus(row);
    return {
      bucket: meta.bucket,
      ndrEligible: isEligibleForNdr(meta.bucket),
      drEligible: isConfirmed(meta.bucket),
      confirmationEligible: isConfirmed(meta.bucket),
      delivered: meta.bucket === STATUS.DELIVERED,
      failed: meta.bucket === STATUS.FAILED,
      canceled: meta.bucket === STATUS.CANCELED,
      incoming: isIncoming(meta.bucket)
    };
  }

  function productName(row) {
    return row && (row.products || row.productName || row.product || '') || '';
  }

  var NORMALIZED_ARABIC_ALIASES = Object.keys(ARABIC_ALIASES).reduce(function (map, key) {
    map[normalizeArabic(key)] = ARABIC_ALIASES[key];
    return map;
  }, {});

  var api = {
    statuses: STATUS,
    ordered: STATUS_META.slice(),
    all: STATUS_META.slice(),
    normalize: normalizeStatus,
    hasKnownLifecycleStatus: hasKnownLifecycleStatus,
    dashboardBucket: dashboardBucket,
    statusInfo: statusInfo,
    display: display,
    color: color,
    statusOrder: function (bucketOrStatus) { return statusInfo(bucketOrStatus).order; },
    statusGroup: statusGroup,
    isDelivered: isDelivered,
    isFailed: isFailed,
    isCanceled: isCanceled,
    isIncoming: isIncoming,
    isActivePipeline: isActivePipeline,
    isEligibleForNdr: isEligibleForNdr,
    isConfirmed: isConfirmed,
    rateInputs: rateInputs,
    moneyValue: moneyValue,
    revenueValue: revenueValue,
    codValue: codValue,
    commissionValue: commissionValue,
    productName: productName
  };

  window.KhodDashboardLogic = api;
})();
