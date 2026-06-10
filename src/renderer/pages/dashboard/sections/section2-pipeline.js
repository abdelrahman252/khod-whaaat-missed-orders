/* ══════════════════════════════════════════════════════════════════════════════
   section2-pipeline.js  — fixed: SVG icons use explicit hex colors (no currentColor)
   ══════════════════════════════════════════════════════════════════════════════ */

window.renderSection2 = function (mountEl, data, ctx) {
  'use strict';

  var isAr = window.dashboardI18n ? window.dashboardI18n.currentLocale === 'ar' : true;
  function s2Txt(en, ar) { return isAr ? ar : en; }

  /* ── Build an SVG icon with an explicit stroke color ─────────────────────── */
  function svgIcon(pathData, color, size, isFill) {
    size = size || 22;
    if (isFill) {
      return '<svg viewBox="0 0 24 24" fill="' + color + '" width="' + size + '" height="' + size + '">' + pathData + '</svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="' + size + '" height="' + size + '">' + pathData + '</svg>';
  }

  /* ── Per-stage icon path data ────────────────────────────────────────────── */
  var PATHS = {
    intake:     '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>',
    awaiting:   '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    confirmed:  '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    processing: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
    waiting:    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    shipping:   '<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    delivered:  '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    failed:     '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    /* metric / insight icons — slightly larger */
    bag:        '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>',
    trendUp:    '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    xCircle:    '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    barChart:   '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    trendDown:  '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>',
    calendar:   '<rect x="3" y="4" width="18" height="18" rx="2.5"/><path d="M8 2v4M16 2v4M3 10h18"/>',
    info:       '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  };

  /* Insight icon keys per index */
  var INSIGHT_ICON_KEYS = ['processing', 'trendDown', 'shipping', 'barChart'];

  /* ── Fallback / default data ─────────────────────────────────────────────── */
  var STAGES_DEFAULT = [
    { id: 'intake',     label: s2Txt('Order Intake', 'استلام الطلب'),    count: 187, pct: 100,  color: '#4f7df6', convLabel: s2Txt('% of Total', 'نسبة من الإجمالي'), conv: null, convFrom: s2Txt('of total orders', 'من إجمالي الطلبات'), active: false },
    { id: 'awaiting',   label: s2Txt('Awaiting Conf', 'بانتظار التأكيد'),  count: 8,   pct: 4.3,  color: '#a855f7', convLabel: s2Txt('% of Total', 'نسبة من الإجمالي'), conv: 4.3,  convFrom: s2Txt('of total orders', 'من إجمالي الطلبات') },
    { id: 'confirmed',  label: s2Txt('Confirmed', 'مؤكد'),             count: 18,  pct: 9.6,  color: '#4f55e0', convLabel: s2Txt('% of Total', 'نسبة من الإجمالي'), conv: 9.6,  convFrom: s2Txt('of total orders', 'من إجمالي الطلبات') },
    { id: 'processing', label: s2Txt('Processing', 'قيد المعالجة'),     count: 12,  pct: 6.4,  color: '#14b8a6', convLabel: s2Txt('% of Total', 'نسبة من الإجمالي'), conv: 6.4,  convFrom: s2Txt('of total orders', 'من إجمالي الطلبات') },
    { id: 'shipping',   label: s2Txt('Shipping', 'في الشحن'),         count: 31,  pct: 16.6, color: '#f59e0b', convLabel: s2Txt('% of Total', 'نسبة من الإجمالي'), conv: 16.6, convFrom: s2Txt('of total orders', 'من إجمالي الطلبات'), active: true },
    { id: 'delivered',  label: s2Txt('Delivered', 'تم التسليم'),        count: 94,  pct: 50.3, color: '#00e676', convLabel: s2Txt('% of Total', 'نسبة من الإجمالي'), conv: 50.3, convFrom: s2Txt('of total orders', 'من إجمالي الطلبات') },
    { id: 'failed',     label: s2Txt('Failed/Canceled', 'فشل / ملغي'),       count: 26,  pct: 13.9, color: '#ef4444', convLabel: s2Txt('Failure Rate', 'نسبة الفشل'),       conv: 13.9, convFrom: s2Txt('of total orders', 'من إجمالي الطلبات') },
  ];

  var INSIGHTS_DEFAULT = [
    { color: '#14b8a6', title: s2Txt('Best Stage Performance', 'أفضل مرحلة أداء'),         body: s2Txt('High conversion rate in\nprocessing stage', 'معدل تحويل مرتفع في مرحلة\nقيد المعالجة'),          highlight: null },
    { color: '#ef4444', title: s2Txt('Biggest Drop-off', 'أكبر نقطة تسرب'),          body: s2Txt('From shipping to delivery', 'من الشحن إلى التسليم'),                             highlight: s2Txt('Lost 16.9% of orders', 'فقدان 16.9% من الطلبات') },
    { color: '#f59e0b', title: s2Txt('Shipping Rate', 'نسبة الطلبات قيد الشحن'), body: s2Txt('16.6% of total orders\n31 orders in shipping', '16.6% من إجمالي الطلبات\n31 طلب في الشحن'),         highlight: null },
    { color: '#a855f7', title: s2Txt('Optimization Opp', 'فرصة تحسين'),               body: s2Txt('Improve confirmation speed\nto reduce awaiting orders', 'تحسين سرعة التأكيد لتقليل\nالطلبات في الانتظار'),   highlight: null },
  ];

  /* Use passed data or fall back */
  var stages   = (data && data.stages)   ? data.stages   : STAGES_DEFAULT;
  var insights = data ? (Array.isArray(data.insights) ? data.insights : []) : INSIGHTS_DEFAULT;
  var metrics  = (data && data.metrics)  ? data.metrics  : { overallConversion: 13.9, deliveryRate: 50.3, totalDelivery: 187 };
  var rawOrders = data && Array.isArray(data.orders) ? data.orders : [];
  var state = mountEl._s2State || { period: '30' };
  mountEl._s2State = state;

  function pctNum(part, total) { return total > 0 ? parseFloat(((part / total) * 100).toFixed(2)) : 0; }
  function pctLabel(value) {
    var n = Number(value || 0);
    if (n > 0 && n < 0.1) return '<0.1%';
    return (n % 1 === 0 ? n.toFixed(0) : n.toFixed(n < 1 ? 2 : 1)) + '%';
  }
  function raw(value) {
    return window.dashboardI18n ? window.dashboardI18n.raw(value) : value;
  }

  function normalizeStage(s) {
    var share = s.share != null
      ? Number(s.share || 0)
      : (typeof s.pct === 'string' ? Number(String(s.pct).replace(/[^\d.]/g, '')) : Number(s.pct || 0));
    var defaultStage = STAGES_DEFAULT.find(function(ds) { return ds.id === s.id; }) || {};
    return Object.assign({}, defaultStage, s, {
      share: share,
      pct: typeof s.pct === 'string' ? s.pct : pctLabel(share),
      convLabel: s.convLabel || s2Txt('% of Total', 'نسبة من الإجمالي'),
      conv: s.conv != null ? s.conv : share,
      convFrom: s.convFrom || s2Txt('of total orders', 'من إجمالي الطلبات'),
    });
  }

  stages = stages.map(normalizeStage);
  metrics.totalOrders = metrics.totalOrders || metrics.totalDelivery || stages.reduce(function (sum, s) { return sum + Number(s.count || 0); }, 0);
  metrics.deliveredCount = metrics.deliveredCount != null ? metrics.deliveredCount : ((stages.find(function (s) { return s.id === 'delivered'; }) || {}).count || 0);
  metrics.failedCount = metrics.failedCount != null ? metrics.failedCount : ((stages.find(function (s) { return s.id === 'failed'; }) || {}).count || 0);
  metrics.deliveryRate = metrics.deliveryRate != null ? metrics.deliveryRate : pctNum(metrics.deliveredCount, metrics.totalOrders);
  metrics.failureRate = metrics.failureRate != null ? metrics.failureRate : pctNum(metrics.failedCount, metrics.totalOrders);
  metrics.overallConversion = metrics.deliveryRate;

  function statusBucket(status) {
    var s = (status || '').toString().trim().toLowerCase();
    if (s === 'delivered' || s === 'مسلمة') return 'delivered';
    if (s === 'in shipping' || s === 'shipping' || s === 'في الشحن' || s === 'تم الشحن') return 'shipping';
    if (s === 'failed' || s === 'canceled' || s === 'cancelled' || s === 'ملغى' || s === 'مرتجع' || s === 'فشلت') return 'failed';
    if (s === 'awaiting confirmation' || s === 'pending' || s === 'بانتظار التأكيد') return 'awaiting';
    if (s === 'confirmed' || s === 'مؤكد') return 'confirmed';
    if (s === 'under processing' || s === 'قيد المعالجة') return 'processing';
    if (s === 'waiting' || s === 'قيد الانتظار' || s === 'بانتظار الشحن') return 'waiting';
    return 'processing';
  }

  function rowDate(row) {
    var raw = row && (row.createdAt || row.date || row.orderDate);
    var d = raw ? new Date(raw) : null;
    return d && !isNaN(d.getTime()) ? d : null;
  }

  function rebuildFromOrders() {
    if (!rawOrders.length) return;
    var days = Number(state.period || 30);
    var latest = rawOrders.reduce(function (max, row) {
      var d = rowDate(row);
      return d && (!max || d > max) ? d : max;
    }, null);
    var start = latest ? new Date(latest.getTime() - ((days - 1) * 86400000)) : null;
    var rows = start ? rawOrders.filter(function (row) {
      var d = rowDate(row); return !d || d >= start;
    }) : rawOrders.slice();
    var counts = { awaiting: 0, confirmed: 0, processing: 0, waiting: 0, shipping: 0, delivered: 0, failed: 0 };
    rows.forEach(function (row) {
      var bucket = statusBucket(row.orderStatus || row.status);
      counts[bucket] = (counts[bucket] || 0) + 1;
    });
    var total = rows.length;
    stages = stages.map(function (stage) {
      var count = counts[stage.id] || 0;
      return normalizeStage(Object.assign({}, stage, {
        count: count, share: pctNum(count, total), pct: pctLabel(pctNum(count, total))
      }));
    });
    metrics.totalOrders = total; metrics.totalDelivery = total;
    metrics.deliveredCount = counts.delivered; metrics.failedCount = counts.failed;
    metrics.deliveryRate = pctNum(counts.delivered, total);
    metrics.failureRate = pctNum(counts.failed, total);
    metrics.overallConversion = metrics.deliveryRate;
  }

  if (!(data && data.metrics && Array.isArray(data.stages))) {
    rebuildFromOrders();
  }

  function buildDynamicInsights() {
    if (insights && insights.length) return insights;
    var activeStages = stages.filter(function (s) { return ['awaiting','confirmed','processing','waiting','shipping'].indexOf(s.id) !== -1; });
    var biggest = activeStages.slice().sort(function (a, b) { return (b.count || 0) - (a.count || 0); })[0];
    var deliveryColor = window.dashboardRateColor ? window.dashboardRateColor(metrics.deliveryRate || 0) : ((metrics.deliveryRate || 0) >= 40 ? '#22d3ee' : (metrics.deliveryRate || 0) >= 30 ? '#00e676' : (metrics.deliveryRate || 0) >= 20 ? '#f59e0b' : '#ef4444');
    return [
      { color: deliveryColor, title: s2Txt('Delivery Rate', 'معدل التسليم'),       body: Number(metrics.deliveredCount || 0).toLocaleString('en-US') + s2Txt(' out of ', ' طلب من أصل ') + Number(metrics.totalOrders || 0).toLocaleString('en-US') + s2Txt(' orders', ''), highlight: pctLabel(metrics.deliveryRate) },
      { color: '#ef4444', title: s2Txt('Failure Rate', 'معدل الفشل'),          body: Number(metrics.failedCount || 0).toLocaleString('en-US') + s2Txt(' failed or canceled orders', ' طلب فاشل أو ملغى'),                                                          highlight: pctLabel(metrics.failureRate) },
      { color: biggest ? biggest.color : '#f59e0b', title: s2Txt('Largest Active Stage', 'أكبر مرحلة نشطة'), body: biggest ? biggest.label + s2Txt(' has ', ' فيها ') + Number(biggest.count || 0).toLocaleString('en-US') + s2Txt(' orders', ' طلب') : s2Txt('No active stages', 'لا توجد مراحل نشطة'), highlight: biggest ? biggest.pct : null },
      { color: '#a855f7', title: s2Txt('Account Filter', 'نوع الحساب المعروض'), body: s2Txt('Metrics calculated for the account selected in top bar', 'الأرقام محسوبة من الحساب المحدد في الشريط العلوي'), highlight: null }
    ];
  }

  /* ── Stage card HTML ─────────────────────────────────────────────────────── */
  function stageCardHtml(s, i) {
    var pctText   = s.pct || pctLabel(s.share);
    var primary   = Number(s.count || 0).toLocaleString('en-US');
    var secondary = pctText;
    var animTo    = Number(s.count || 0);
    var animDec   = 0;
    var suffix    = '';
    var active    = s.active || false;
    var isLight   = document.documentElement.getAttribute('data-theme') === 'light';
    var glowBase, bg, countColor, pctColor, iconBg, iconShadow;
    if (isLight) {
      /* Light mode: white card surface, soft visible outer glow (no ring — border handles the edge) */
      glowBase  = active
        ? '0 0 20px 4px ' + s.color + 'aa, 0 0 44px 8px ' + s.color + '55'
        : '0 0 12px 3px ' + s.color + '66, 0 0 28px 6px ' + s.color + '2e';
      bg        = 'linear-gradient(180deg,' + s.color + '18 0%,' + s.color + '06 28%,#ffffff 50%,' + s.color + '06 72%,' + s.color + '14 100%),#ffffff';
      countColor = '#1e293b';
      pctColor   = '#475569';
      iconBg     = s.color + '18';
      iconShadow = '0 0 14px ' + s.color + 'cc,0 0 28px ' + s.color + '77,inset 0 0 8px ' + s.color + '33';
    } else {
      /* Dark mode: original dark card surface with dark-optimised glow */
      glowBase  = active
        ? '0 0 22px ' + s.color + 'aa, 0 0 50px ' + s.color + '55, inset 0 0 24px ' + s.color + '22'
        : '0 0 14px ' + s.color + '77, 0 0 30px ' + s.color + '30, inset 0 0 18px ' + s.color + '14';
      bg        = 'linear-gradient(180deg,' + s.color + '26 0%,' + s.color + '06 28%,transparent 50%,' + s.color + '06 72%,' + s.color + '1f 100%),#0a0f1c';
      countColor = '#fff';
      pctColor   = 'rgba(255,255,255,0.7)';
      iconBg     = s.color + '22';
      iconShadow = '0 0 16px ' + s.color + 'aa,0 0 32px ' + s.color + '44,inset 0 0 12px ' + s.color + '33';
    }
    /* Icon: use the stage id to pick path, color baked in as explicit hex */
    var iconKey = PATHS[s.id] ? s.id : 'intake';
    var iconHtml = svgIcon(PATHS[iconKey], s.color, 22);

    return '<div class="s2-stage-wrapper fade-up" style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;animation-delay:' + (i * 80) + 'ms;">' +
      '<div class="s2-stage-label" style="font-size:13px;font-weight:700;margin-bottom:12px;white-space:nowrap;color:' + s.color + ';text-shadow:' + (isLight ? 'none' : '0 0 10px ' + s.color + '77') + ';">' + s.label + '</div>' +
      '<div class="s2-stage-card" style="position:relative;width:92%;height:220px;border-radius:16px;transform:skewX(-6deg);background:' + bg + ';border:1.5px solid ' + s.color + ';box-shadow:' + glowBase + ';">' +
        '<div class="s2-card-inner" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:24px 8px;box-sizing:border-box;transform:skewX(6deg);">' +
          '<div class="s2-card-top" style="text-align:center;margin-top:8px;">' +
            '<div class="s2-count s2-count-num" data-to="' + animTo + '" data-decimals="' + animDec + '" data-suffix="' + suffix + '" style="font-size:40px;font-weight:900;color:' + countColor + ';line-height:1;letter-spacing:-2px;">' + primary + '</div>' +
            '<div class="s2-pct-text" style="font-size:13px;font-weight:700;color:' + pctColor + ';margin-top:8px;letter-spacing:1px;">' + secondary + '</div>' +
          '</div>' +
          '<div class="s2-icon-wrap" style="width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:8px;flex-shrink:0;background:' + iconBg + ';border:1.5px solid ' + s.color + 'cc;box-shadow:' + iconShadow + ';">' +
            iconHtml +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Chevron HTML ────────────────────────────────────────────────────────── */
  function chevronHtml(leftColor, rightColor) {
    var isRtl = window.dashboardI18n ? window.dashboardI18n.isRtl() : true;
    var p1 = isRtl ? '11,3 5,9 11,15' : '15,3 21,9 15,15';
    var p2 = isRtl ? '21,3 15,9 21,15' : '5,3 11,9 5,15';
    /* SVG uses overflow="visible" so drop-shadow bleeds beyond the viewBox bounds
       without creating a rectangular clip. The filter is defined inline via <defs>
       and applied per-polyline so each chevron glows in its own color. */
    var uid = Math.random().toString(36).slice(2, 7);
    var f1 = 'chf1_' + uid;
    var f2 = 'chf2_' + uid;
    return '<div class="s2-chevron" style="flex-shrink:0;width:26px;display:flex;align-items:center;justify-content:center;height:220px;margin-top:25px;">' +
      '<svg width="26" height="18" viewBox="0 0 26 18" fill="none" overflow="visible" style="overflow:visible;">' +
        '<defs>' +
          '<filter id="' + f1 + '" x="-80%" y="-80%" width="260%" height="260%">' +
            '<feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>' +
            '<feFlood flood-color="' + leftColor  + '" flood-opacity="0.9" result="color"/>' +
            '<feComposite in="color" in2="blur" operator="in" result="glow"/>' +
            '<feMerge><feMergeNode in="glow"/><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>' +
          '</filter>' +
          '<filter id="' + f2 + '" x="-80%" y="-80%" width="260%" height="260%">' +
            '<feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>' +
            '<feFlood flood-color="' + rightColor + '" flood-opacity="0.9" result="color"/>' +
            '<feComposite in="color" in2="blur" operator="in" result="glow"/>' +
            '<feMerge><feMergeNode in="glow"/><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>' +
          '</filter>' +
        '</defs>' +
        '<polyline points="' + p1 + '" stroke="' + leftColor  + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#' + f1 + ')"/>' +
        '<polyline points="' + p2 + '" stroke="' + rightColor + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#' + f2 + ')"/>' +
      '</svg>' +
    '</div>';
  }

  /* ── Conversion card HTML ────────────────────────────────────────────────── */
  function convCardHtml(s, i) {
    var convText = s.conv == null ? '—' : pctLabel(s.conv);
    return '<div class="s2-conv-card fade-up" style="flex:1;min-width:0;background:#0b1120;border:1px solid rgba(255,255,255,0.10);border-radius:12px;padding:10px 12px;text-align:center;animation-delay:' + (500 + i * 60) + 'ms;">' +
      '<div class="s2-conv-label" style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:4px;">' + s.convLabel + '</div>' +
      '<div class="s2-conv-value" style="font-size:18px;font-weight:800;line-height:1;margin-bottom:6px;color:' + s.color + ';">' + convText + '</div>' +
      '<div class="s2-conv-from" style="font-size:10px;color:rgba(255,255,255,0.4);">' + s.convFrom + '</div>' +
    '</div>';
  }

  /* ── Metric card HTML ────────────────────────────────────────────────────── */
  function metricCardHtml(iconKey, color, label, value, sub, isPercent, animId, delay) {
    var isRtl     = window.dashboardI18n ? window.dashboardI18n.isRtl() : true;
    var textAlign = isRtl ? 'right' : 'left';
    var rowDir    = isRtl ? 'row-reverse' : 'row';
    var iconHtml  = svgIcon(PATHS[iconKey] || PATHS.bag, color, 30);
    return '<div class="s2-metric-card fade-up" style="flex:1;min-width:0;background:#0b1120;border:1px solid rgba(255,255,255,0.10);border-radius:16px;padding:32px;display:flex;align-items:center;gap:24px;flex-direction:' + rowDir + ';animation-delay:' + delay + 'ms;box-shadow:inset 0 0 30px ' + color + '08;">' +
      '<div class="s2-metric-text" style="flex:1;text-align:' + textAlign + ';">' +
        '<div class="s2-metric-label" style="font-size:14px;color:rgba(255,255,255,0.6);font-weight:600;margin-bottom:8px;">' + label + '</div>' +
        '<div class="s2-metric s2-metric-value" data-to="' + value + '" data-decimals="' + (isPercent ? '1' : '0') + '" data-suffix="' + (isPercent ? '%' : '') + '" id="' + animId + '" style="font-size:40px;font-weight:900;line-height:1;letter-spacing:-2px;color:' + color + ';text-shadow:0 0 20px ' + color + '55;">0</div>' +
        '<div class="s2-metric-sub" style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:8px;">' + sub + '</div>' +
      '</div>' +
      '<div class="s2-metric-icon" style="width:72px;height:72px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:radial-gradient(circle,' + color + '28 0%,' + color + '0a 70%);border:1.5px solid ' + color + ';box-shadow:0 0 22px ' + color + '66,0 0 40px ' + color + '33,inset 0 0 16px ' + color + '33;">' +
        iconHtml +
      '</div>' +
    '</div>';
  }

  function analyticsCardHtml(color, label, value, sub, progress, delay) {
    var isRtl = window.dashboardI18n ? window.dashboardI18n.isRtl() : true;
    var textAlign = isRtl ? 'right' : 'left';
    var safeProgress = Math.max(0, Math.min(100, Number(progress || 0)));
    return '<div class="s2-analytics-card fade-up" style="min-width:0;background:#0b1120;border:1px solid rgba(255,255,255,0.10);border-radius:12px;padding:16px 18px;text-align:' + textAlign + ';animation-delay:' + delay + 'ms;box-shadow:inset 0 0 22px ' + color + '07;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-direction:' + (isRtl ? 'row-reverse' : 'row') + ';margin-bottom:10px;">' +
        '<span style="font-size:12px;color:rgba(255,255,255,0.58);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + label + '</span>' +
        '<span style="width:8px;height:8px;border-radius:50%;background:' + color + ';box-shadow:0 0 10px ' + color + 'aa;"></span>' +
      '</div>' +
      '<div style="font-size:24px;font-weight:900;line-height:1;color:' + color + ';font-variant-numeric:tabular-nums;text-shadow:0 0 14px ' + color + '44;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + value + '</div>' +
      '<div style="height:5px;border-radius:999px;background:rgba(255,255,255,0.07);overflow:hidden;margin:12px 0 8px;">' +
        '<div style="height:100%;width:' + safeProgress + '%;border-radius:inherit;background:linear-gradient(90deg,' + color + '55,' + color + ');box-shadow:0 0 10px ' + color + '77;"></div>' +
      '</div>' +
      '<div style="font-size:11px;color:rgba(255,255,255,0.42);line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + sub + '</div>' +
    '</div>';
  }

  function buildPipelineAnalyticsHtml() {
    var byId = {};
    stages.forEach(function (stage) { byId[stage.id] = stage; });
    var total = Number(metrics.totalOrders || metrics.totalDelivery || 0);
    if (!total) {
      total = stages.reduce(function (sum, stage) { return sum + Number(stage.count || 0); }, 0);
    }
    function count(id) { return Number((byId[id] && byId[id].count) || 0); }
    var activeIds = ['awaiting', 'confirmed', 'processing', 'waiting', 'shipping'];
    var activeCount = activeIds.reduce(function (sum, id) { return sum + count(id); }, 0);
    var activeRate = pctNum(activeCount, total);
    var delivered = Number(metrics.deliveredCount || count('delivered') || 0);
    var failed = Number(metrics.failedCount || count('failed') || 0);
    var deliveryToFailure = failed > 0
      ? (delivered / failed).toFixed(delivered / failed >= 10 ? 0 : 1) + 'x'
      : (delivered > 0 ? s2Txt('No failures', 'لا يوجد فشل') : '0x');
    var bottleneck = activeIds.map(function (id) { return byId[id]; }).filter(Boolean).sort(function (a, b) {
      return Number(b.count || 0) - Number(a.count || 0);
    })[0];
    var attentionCount = count('awaiting') + failed;
    var attentionRate = pctNum(attentionCount, total);
    return [
      analyticsCardHtml('#14b8a6', s2Txt('Active Pipeline', 'المسار النشط'), Number(activeCount || 0).toLocaleString('en-US'), pctLabel(activeRate) + s2Txt(' still moving', ' ما زالت قيد الحركة'), activeRate, 420),
      analyticsCardHtml('#00e676', s2Txt('Delivery to Failure', 'التسليم مقابل الفشل'), deliveryToFailure, Number(delivered || 0).toLocaleString('en-US') + s2Txt(' delivered vs ', ' تم تسليمها مقابل ') + Number(failed || 0).toLocaleString('en-US') + s2Txt(' failed', ' فشل'), failed > 0 ? Math.min(100, (delivered / Math.max(failed, 1)) * 10) : 100, 480),
      analyticsCardHtml(bottleneck ? bottleneck.color : '#f59e0b', s2Txt('Main Bottleneck', 'عنق الزجاجة الرئيسي'), bottleneck ? bottleneck.label : s2Txt('Clear', 'واضح'), bottleneck ? Number(bottleneck.count || 0).toLocaleString('en-US') + s2Txt(' orders waiting here', ' طلب متوقف هنا') : s2Txt('No active queue', 'لا يوجد تكدس نشط'), bottleneck ? Number(bottleneck.share || 0) : 0, 540),
      analyticsCardHtml('#ef4444', s2Txt('Attention Queue', 'قائمة تحتاج متابعة'), Number(attentionCount || 0).toLocaleString('en-US'), pctLabel(attentionRate) + s2Txt(' awaiting or failed', ' بانتظار التأكيد أو فشل'), attentionRate, 600)
    ].join('');
  }

  /* ── Insight item HTML ───────────────────────────────────────────────────── */
  function insightHtml(ins, i) {
    var isRtl     = window.dashboardI18n ? window.dashboardI18n.isRtl() : true;
    var textAlign = isRtl ? 'right' : 'left';
    var rowDir    = isRtl ? 'row-reverse' : 'row';
    var iconKey   = INSIGHT_ICON_KEYS[i] || 'barChart';
    /* If caller passed iconSvg as a raw <svg> with explicit colors, use it; otherwise build from PATHS */
    var iconHtml;
    if (ins.iconSvg && !ins.iconSvg.includes('currentColor')) {
      iconHtml = ins.iconSvg;
    } else {
      iconHtml = svgIcon(PATHS[iconKey], ins.color, 24);
    }
    var bodyEscaped = ins.body.replace(/\n/g, '<br>');
    return '<div class="s2-insight-item fade-up" style="flex:1;min-width:0;display:flex;align-items:flex-start;gap:16px;padding:20px;flex-direction:' + rowDir + ';animation-delay:' + (700 + i * 80) + 'ms;">' +
      '<div class="s2-insight-icon" style="width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:radial-gradient(circle,' + ins.color + '28 0%,' + ins.color + '08 70%);border:1.5px solid ' + ins.color + ';box-shadow:0 0 18px ' + ins.color + '66,0 0 36px ' + ins.color + '33,inset 0 0 12px ' + ins.color + '33;">' +
        iconHtml +
      '</div>' +
      '<div class="s2-insight-text" style="flex:1;text-align:' + textAlign + ';">' +
        '<div class="s2-insight-title" style="font-size:14px;font-weight:800;margin-bottom:8px;color:' + ins.color + ';text-shadow:0 0 12px ' + ins.color + '55;">' + ins.title + '</div>' +
        '<div class="s2-insight-body" style="font-size:12px;color:rgba(255,255,255,0.6);line-height:1.6;">' + bodyEscaped + '</div>' +
        (ins.highlight ? '<div class="s2-insight-highlight" style="font-size:13px;font-weight:700;margin-top:6px;color:' + ins.color + ';">' + ins.highlight + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  /* ── Assemble funnel rows ─────────────────────────────────────────────────── */
  var stageCardsHtml = '', dottedRowHtml = '', convRowHtml = '';

  stages.forEach(function (s, i) {
    stageCardsHtml += stageCardHtml(s, i);
    if (i < stages.length - 1) stageCardsHtml += chevronHtml(stages[i + 1].color, s.color);

    dottedRowHtml += '<div style="flex:1;min-width:0;display:flex;justify-content:center;">' +
      '<div style="width:1px;height:100%;background:repeating-linear-gradient(to bottom,' + s.color + '99 0 3px,transparent 3px 7px);"></div>' +
    '</div>';
    if (i < stages.length - 1) dottedRowHtml += '<div style="width:26px;flex-shrink:0;"></div>';

    convRowHtml += convCardHtml(s, i);
    if (i < stages.length - 1) convRowHtml += '<div style="width:26px;flex-shrink:0;"></div>';
  });

  var isRtl  = window.dashboardI18n ? window.dashboardI18n.isRtl() : true;
  var dirStr = isRtl ? 'rtl' : 'ltr';

  /* ── Full HTML ───────────────────────────────────────────────────────────── */
  var html =
    '<div class="dash-scroll" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;background:#080b12;direction:' + dirStr + ';">' +

      '<div class="s2-header" style="padding:32px 40px;display:flex;flex-direction:row;justify-content:space-between;align-items:center;gap:16px;">' +
        '<div style="text-align:' + (isRtl ? 'right' : 'left') + ';flex:1;">' +
          '<h1 id="s2-h1" style="font-size:36px;font-weight:900;color:var(--dash-text,#fff);margin:0;line-height:1.15;opacity:0;transform:translateY(-8px);transition:opacity 0.4s ease,transform 0.4s ease;">' + s2Txt('Order Pipeline', 'خط سير الطلبات') + '</h1>' +
          '<div id="s2-sub" style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--dash-text-faint,rgba(255,255,255,0.5));margin-top:8px;justify-content:flex-' + (isRtl ? 'end' : 'start') + ';flex-direction:' + (isRtl ? 'row-reverse' : 'row') + ';opacity:0;transition:opacity 0.4s ease 0.12s;">' +
            s2Txt('From order intake to delivery or failure', 'من استلام الطلب حتى التسليم أو الفشل') +
            svgIcon(PATHS.info, '#3b82f6', 14) +
          '</div>' +
        '</div>' +

        '<div style="display:flex;flex-direction:column;gap:12px;align-items:flex-' + (isRtl ? 'end' : 'start') + ';">' +
          '<div id="s2-period-select-wrap" style="width:154px;min-height:42px;"></div>' +
        '</div>' +
      '</div>' +

      '<div class="s2-body" style="padding:0 0 40px;flex:1;">' +
        '<div class="s2-funnel-scroll" style="margin-bottom:24px;overflow-x:auto;padding-bottom:16px;">' +
          '<div class="s2-funnel-inner" style="min-width:860px;width:100%;direction:' + dirStr + ';padding:0 40px;box-sizing:border-box;">' +
            '<div class="s2-stage-row" style="display:flex;align-items:stretch;margin-bottom:16px;">' + stageCardsHtml + '</div>' +
            '<div class="s2-dotted-row" style="display:flex;margin-bottom:8px;height:18px;">'          + dottedRowHtml  + '</div>' +
            '<div class="s2-conv-row" style="display:flex;align-items:stretch;">'                    + convRowHtml    + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="s2-lower" style="padding:0 40px;display:flex;flex-direction:column;gap:24px;">' +
          '<div class="s2-metrics-grid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">' +
            metricCardHtml('bag',      '#3b82f6', s2Txt('Total Orders', 'إجمالي الطلبات'),       metrics.totalOrders,  s2Txt('across all stages', 'في جميع المراحل'),    false, 's2-m0', 300) +
            metricCardHtml('trendUp',  (window.dashboardRateColor ? window.dashboardRateColor(metrics.deliveryRate || 0) : ((metrics.deliveryRate || 0) >= 40 ? '#22d3ee' : (metrics.deliveryRate || 0) >= 30 ? '#00e676' : (metrics.deliveryRate || 0) >= 20 ? '#f59e0b' : '#ef4444')), s2Txt('Final Delivery Rate', 'معدل التسليم النهائي'),  metrics.deliveryRate, Number(metrics.deliveredCount || 0).toLocaleString('en-US') + s2Txt(' delivered orders', ' طلب تم تسليمها'), true, 's2-m1', 300) +
            metricCardHtml('xCircle',  '#ef4444', s2Txt('Overall Failure Rate', 'معدل الفشل الإجمالي'),  metrics.failureRate,  Number(metrics.failedCount    || 0).toLocaleString('en-US') + s2Txt(' orders', ' طلب'),            true, 's2-m2', 300) +
          '</div>' +

          '<div class="s2-analytics-grid" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;">' +
            buildPipelineAnalyticsHtml() +
          '</div>' +

          '<div class="s2-insights-box fade-up" style="background:#0b1120;border:1px solid rgba(255,255,255,0.10);border-radius:16px;padding:28px;animation-delay:600ms;">' +
            '<div class="s2-insights-head" style="display:flex;align-items:center;gap:10px;justify-content:flex-' + (isRtl ? 'end' : 'start') + ';margin-bottom:16px;flex-direction:' + (isRtl ? 'row-reverse' : 'row') + ';">' +
              '<span style="font-size:20px;color:#a855f7;text-shadow:0 0 12px #a855f7aa;">✦</span>' +
              '<span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:0.5px;">' + s2Txt('Quick Insights', 'رؤى سريعة') + '</span>' +
            '</div>' +
            '<div class="s2-insights-grid" style="display:flex;flex-wrap:nowrap;border-top:1px solid rgba(255,255,255,0.05);">' +
              buildDynamicInsights().map(function (ins, i) { return insightHtml(ins, i); }).join(
                '<div class="s2-insight-sep" style="width:1px;background:rgba(255,255,255,0.05);margin:12px 0;"></div>'
              ) +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  /* ── Inject ──────────────────────────────────────────────────────────────── */
  mountEl.innerHTML = html;

  var periodOptions = [
    { value: '7', label: raw(s2Txt('Last 7 days', 'عرض 7 أيام')) },
    { value: '14', label: raw(s2Txt('Last 14 days', 'عرض 14 يوم')) },
    { value: '30', label: raw(s2Txt('Last 30 days', 'عرض 30 يوم')) }
  ];
  var periodWrap = mountEl.querySelector('#s2-period-select-wrap');
  if (periodWrap && window.renderCustomSelect) {
    window.renderCustomSelect(periodWrap, periodOptions, state.period, function (value) {
      mountEl._s2State = Object.assign({}, mountEl._s2State || state, { period: value });
      window.renderSection2(mountEl, data, ctx);
    }, { ariaLabel: raw(s2Txt('Last 30 days', 'عرض 30 يوم')) });
  } else if (periodWrap) {
    periodWrap.innerHTML =
      '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.9);font-size:13px;font-weight:600;font-family:inherit;flex-direction:' + (isRtl ? 'row-reverse' : 'row') + ';">' +
        svgIcon(PATHS.calendar, 'rgba(255,255,255,0.6)', 16) +
        '<select id="s2-period-select" style="background:transparent;border:none;color:#fff;outline:none;font:inherit;cursor:pointer;">' +
          periodOptions.map(function (opt) {
            return '<option value="' + opt.value + '"' + (state.period === opt.value ? ' selected' : '') + '>' + opt.label + '</option>';
          }).join('') +
        '</select>' +
      '</label>';
    var periodSelect = mountEl.querySelector('#s2-period-select');
    if (periodSelect) periodSelect.addEventListener('change', function () {
      mountEl._s2State = Object.assign({}, mountEl._s2State || state, { period: periodSelect.value });
      window.renderSection2(mountEl, data, ctx);
    });
  }

  /* ── Post-injection animations ───────────────────────────────────────────── */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      var h1  = document.getElementById('s2-h1');
      var sub = document.getElementById('s2-sub');
      if (h1)  { h1.style.opacity = '1'; h1.style.transform = 'translateY(0)'; }
      if (sub) { sub.style.opacity = '1'; }

      mountEl.querySelectorAll('.s2-count[data-to]').forEach(function (el) {
        var to = parseFloat(el.getAttribute('data-to'));
        var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
        var suffix = el.getAttribute('data-suffix') || '';
        if (suffix) {
          (function (elem, target, dec, sfx) {
            var start = performance.now();
            function tick(now) {
              var t = Math.min(1, (now - start) / 1400);
              var eased = 1 - Math.pow(1 - t, 3);
              elem.textContent = (target * eased).toFixed(dec).replace(/\.0$/, '') + sfx;
              if (t < 1) requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
          }(el, to, decimals, suffix));
        } else {
          window.animateNumber(el, to, { duration: 1400 });
        }
      });

      mountEl.querySelectorAll('.s2-metric[data-to]').forEach(function (el) {
        var to       = parseFloat(el.getAttribute('data-to'));
        var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
        var suffix   = el.getAttribute('data-suffix') || '';
        if (suffix) {
          (function (elem, target, dec, sfx) {
            var start = performance.now();
            function tick(now) {
              var t = Math.min(1, (now - start) / 1400);
              var eased = 1 - Math.pow(1 - t, 3);
              elem.textContent = (target * eased).toFixed(dec) + sfx;
              if (t < 1) requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
          }(el, to, decimals, suffix));
        } else {
          window.animateNumber(el, to, { duration: 1400, decimals: decimals });
        }
      });
    });
  });

  /* ── Theme-change observer: re-render when data-theme toggles ────────────────── */
  if (mountEl._s2ThemeObserver) {
    mountEl._s2ThemeObserver.disconnect();
    mountEl._s2ThemeObserver = null;
  }
  var _s2ThemeObserver = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].attributeName === 'data-theme') {
        window.renderSection2(mountEl, data, ctx);
        return;
      }
    }
  });
  _s2ThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  mountEl._s2ThemeObserver = _s2ThemeObserver;
};
