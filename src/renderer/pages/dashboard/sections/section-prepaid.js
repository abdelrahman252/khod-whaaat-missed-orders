/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   section-prepaid.js  (T-24 Part B)
   Full Prepaid Intelligence section UI.

   Layout:
     1. Header + KPI summary strip
     2. Global Comparison Panel  (Prepaid vs COD side-by-side)
     3. City Ranking Chart       (horizontal CSS bars, clickable â†’ CityDrawer)
     4. Product Prepaid vs COD Table (sortable)
     5. Recommendation Cards     (from forcePrepaidRecs + codDangerousCombos)

   Depends on:
     window.formatSAR()               â€” dashboard-shared.js
     window.animateNumber()            â€” dashboard-shared.js
     window.scoreBadge()               â€” dashboard-shared.js (T-03)
     window.sectionTopBar()            â€” dashboard-shared.js
     window.icon()                     â€” dashboard-shared.js
     window.CityIntelligenceDrawer     â€” section-city-drawer.js (T-21) [optional]
     window.DashboardFilterBus         â€” dashboard-filter-bus.js (T-13)  [optional]
     window.dashboardGeoData           â€” set by aggregator after aggregation

   Exposed on window:
     window.renderSectionPrepaid(mountEl, data, ctx)
       mountEl â€” DOM element to render into
       data    â€” full aggregator output (data.geo.prepaidIntelligence)
       ctx     â€” optional context object {account, month}
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
(function () {
  'use strict';
  var isAr = (document.documentElement.getAttribute('lang') || window._kbotLang || localStorage.getItem('kbot-lang') || 'ar') === 'ar';
  function sTx(en, ar) { return isAr ? ar : en; }

  /* â”€â”€ Design tokens (matches dashboard dark theme) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var C = {
    bg:        '#0a0f1e',
    surface:   '#0d1525',
    card:      '#111827',
    border:    'rgba(255,255,255,0.07)',
    muted:     'rgba(255,255,255,0.35)',
    text:      'rgba(255,255,255,0.88)',
    prepaid:   '#3b82f6',   // blue   â€” prepaid
    cod:       '#f59e0b',   // amber  â€” COD
    green:     '#00e676',
    red:       '#ef4444',
    purple:    '#a855f7'
  };

  /* â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function pct(v, decimals) {
    var d = decimals === undefined ? 1 : decimals;
    return (typeof v === 'number' ? clamp(v, 0, 1) * 100 : 0).toFixed(d) + '%';
  }

  function fmtSAR(n) {
    if (window.formatSAR) return window.formatSAR(n);
    return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ' + sTx('SAR', 'Ø±.Ø³');
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeProductSearch(value) {
    return String(value || '')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[Ø£Ø¥Ø¢Ø§]/g, 'Ø§')
      .replace(/Ø©/g, 'Ù‡')
      .replace(/Ù‰/g, 'ÙŠ')
      .trim()
      .toLowerCase();
  }

  function ndrColor(rate) {
    return window.dashboardRateColor ? window.dashboardRateColor(rate, { scale: 'ratio' }) : (rate >= 0.40 ? '#22d3ee' : rate >= 0.30 ? C.green : rate >= 0.20 ? C.cod : C.red);
  }

  function prepaidColor(prepaidPct) {
    if (prepaidPct > 0.5)  return C.green;
    if (prepaidPct > 0.2)  return C.prepaid;
    return C.muted;
  }

  function deltaLabel(advantage) {
    if (advantage > 0.15) return { color: C.green,  label: sTx('â†‘ Much Better', 'â†‘ Ø£ÙØ¶Ù„ Ø¨ÙƒØ«ÙŠØ±') };
    if (advantage > 0.05) return { color: C.prepaid, label: sTx('â†‘ Better', 'â†‘ Ø£ÙØ¶Ù„') };
    if (advantage < 0)    return { color: C.red,     label: sTx('â†“ COD Better', 'â†“ COD Ø£ÙØ¶Ù„') };
    return { color: C.muted, label: sTx('â‰ˆ Similar', 'â‰ˆ Ù…ØªÙ‚Ø§Ø±Ø¨') };
  }

  function emptyState(msg) {
    return '<div style="display:flex;align-items:center;justify-content:center;' +
      'padding:40px;color:' + C.muted + ';font-size:13px;gap:8px;">' +
      '<span style="font-size:22px;">ðŸ“­</span>' + msg + '</div>';
  }

  function sectionCard(title, iconName, content, extra) {
    var iconHtml = (window.icon && iconName) ? window.icon(iconName, { size: 16, color: C.prepaid }) : '';
    return '<div style="background:' + C.card + ';border:1px solid ' + C.border + ';' +
      'border-radius:16px;padding:20px 24px;margin-bottom:20px;">' +
      (title ? '<div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;">' +
        iconHtml +
        '<span style="font-size:13px;font-weight:700;color:' + C.text + ';">' + title + '</span>' +
        (extra || '') +
      '</div>' : '') +
      content +
    '</div>';
  }

  function generatePagination(currentPage, totalPages, typeClass) {
    if (totalPages <= 1) return '';

    if (window.renderDashboardPagination) {
      return window.renderDashboardPagination({
        currentPage: currentPage,
        totalPages: totalPages,
        pageButtonClass: typeClass,
        prevClass: typeClass,
        nextClass: typeClass,
        prevPage: currentPage - 1,
        nextPage: currentPage + 1,
        className: 'dash-pagination-compact'
      });
    }

    var btnBase = 'background:transparent;border:1px solid rgba(255,255,255,0.1);color:' + C.muted + ';border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;transition:all 0.15s;cursor:pointer;';
    var activeBase = 'background:' + C.prepaid + '22;border:1px solid ' + C.prepaid + '55;color:' + C.prepaid + ';border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;';
    var disabledBase = 'background:transparent;border:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.2);border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;cursor:not-allowed;';

    var html = '<div style="display:flex;justify-content:center;align-items:center;gap:6px;margin-top:14px;padding-top:14px;border-top:1px solid ' + C.border + ';">';

    var prevDisabled = currentPage === 1;
    html += '<button class="' + typeClass + '" data-page="' + (currentPage - 1) + '" ' +
      (prevDisabled ? 'disabled style="' + disabledBase + '"' : 'style="' + btnBase + '"') +
      '>&lt;</button>';

    var maxPagesToShow = 5;
    var startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    var endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    if (startPage > 1) {
      html += '<button class="' + typeClass + '" data-page="1" style="' + btnBase + '">1</button>';
      if (startPage > 2) {
        html += '<span style="color:' + C.muted + ';font-size:12px;display:flex;align-items:end;padding-bottom:4px;">...</span>';
      }
    }

    for (var i = startPage; i <= endPage; i++) {
      if (i === currentPage) {
        html += '<div style="' + activeBase + '">' + i + '</div>';
      } else {
        html += '<button class="' + typeClass + '" data-page="' + i + '" style="' + btnBase + '">' + i + '</button>';
      }
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        html += '<span style="color:' + C.muted + ';font-size:12px;display:flex;align-items:end;padding-bottom:4px;">...</span>';
      }
      html += '<button class="' + typeClass + '" data-page="' + totalPages + '" style="' + btnBase + '">' + totalPages + '</button>';
    }

    var nextDisabled = currentPage === totalPages;
    html += '<button class="' + typeClass + '" data-page="' + (currentPage + 1) + '" ' +
      (nextDisabled ? 'disabled style="' + disabledBase + '"' : 'style="' + btnBase + '"') +
      '>&gt;</button>';

    html += '</div>';
    return html;
  }

  /* â”€â”€ 1. Global KPI Strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function buildKpiStrip(pi) {
    var noData = !pi || pi.globalPrepaidPct === 0;

    var items = [
      {
        label: sTx('Prepaid Share', 'Ù†Ø³Ø¨Ø© Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚'),
        value: noData ? 'â€”' : pct(pi.globalPrepaidPct),
        color: C.prepaid,
        sub: noData ? sTx('No data available', 'Ù„Ø§ ØªØªÙˆÙØ± Ø¨ÙŠØ§Ù†Ø§Øª') : sTx('of total orders', 'Ù…Ù† Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø·Ù„Ø¨Ø§Øª')
      },
      {
        label: sTx('Prepaid NDR', 'NDR Ø§Ù„Ù…Ø³Ø¨Ù‚'),
        value: noData ? 'â€”' : pct(pi.prepaidNdr),
        color: pi ? ndrColor(pi.prepaidNdr) : C.red,
        sub: sTx('Prepaid delivery quality', 'Ù…Ø±ØªØ¬Ø¹Ø§Øª Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚')
      },
      {
        label: sTx('COD NDR', 'NDR Ø§Ù„Ø¯ÙØ¹ Ø¹Ù†Ø¯ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…'),
        value: noData ? 'â€”' : pct(pi.codNdr),
        color: pi ? ndrColor(pi.codNdr) : C.red,
        sub: sTx('COD Delivery Quality', 'Ù…Ø±ØªØ¬Ø¹Ø§Øª COD')
      },
      {
        label: sTx('Prepaid Advantage', 'Ø£ÙØ¶Ù„ÙŠØ© Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚'),
        value: (pi && pi.prepaidNdrAdvantage > 0) ? '+' + pct(pi.prepaidNdrAdvantage) : (noData ? 'â€”' : pct(pi.prepaidNdrAdvantage)),
        color: (pi && pi.prepaidNdrAdvantage > 0.05) ? C.green : C.muted,
        sub: sTx('NDR delta', 'ÙØ§Ø±Ù‚ NDR')
      },
      {
        label: sTx('Risky COD Cities', 'Ù…Ø¯Ù† COD Ø®Ø·Ø±Ø©'),
        value: (pi && pi.codHeavyCities) ? pi.codHeavyCities.length : '0',
        color: (pi && pi.codHeavyCities && pi.codHeavyCities.length > 0) ? C.red : C.muted,
        sub: 'COD > 85% + NDR < 20%'
      },
      {
        label: sTx('Mandatory Actions', 'ØªÙˆØµÙŠØ§Øª Ø¥Ù„Ø²Ø§Ù…ÙŠØ©'),
        value: (pi && pi.forcePrepaidRecs) ? pi.forcePrepaidRecs.length : '0',
        color: (pi && pi.forcePrepaidRecs && pi.forcePrepaidRecs.length > 0) ? C.purple : C.muted,
        sub: sTx('Convert to Prepaid', 'ØªØ­ÙˆÙŠÙ„ Ø¥Ù„Ù‰ Ù…Ø³Ø¨Ù‚')
      }
    ];

    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));' +
      'gap:12px;margin-bottom:20px;">' +
      items.map(function (item) {
        return '<div style="background:' + C.card + ';border:1px solid ' + C.border + ';' +
          'border-radius:14px;padding:16px 18px;position:relative;overflow:hidden;">' +
          '<div style="position:absolute;top:0;right:0;width:3px;height:100%;' +
            'background:' + item.color + ';border-radius:0 14px 14px 0;"></div>' +
          '<div style="font-size:22px;font-weight:900;color:' + item.color + ';' +
            'line-height:1;margin-bottom:4px;">' + item.value + '</div>' +
          '<div style="font-size:11px;font-weight:700;color:' + C.text + ';margin-bottom:3px;">' + item.label + '</div>' +
          '<div style="font-size:10px;color:' + C.muted + ';">' + item.sub + '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  /* â”€â”€ 2. Global Comparison Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function buildComparisonPanel(pi) {
    var noData = !pi || (pi.globalPrepaidPct === 0 && pi.globalCodPct === 0);

    if (noData) {
      return sectionCard(sTx('Payment Method Comparison', 'Ù…Ù‚Ø§Ø±Ù†Ø© Ø£Ø³Ù„ÙˆØ¨ Ø§Ù„Ø¯ÙØ¹'), 'creditCard',
        '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:30px;">' +
          '<div style="font-size:40px;">ðŸ’³</div>' +
          '<div style="color:' + C.muted + ';font-size:13px;text-align:center;max-width:320px;">' +
            sTx(
              'Payment method data is not available. You need to export the <code style="background:rgba(255,255,255,0.07);padding:1px 5px;border-radius:4px;">paymentMethod</code> field from the orders source to enable this analysis.',
              'Ø¨ÙŠØ§Ù†Ø§Øª Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø¯ÙØ¹ ØºÙŠØ± Ù…ØªÙˆÙØ±Ø©. ØªØ­ØªØ§Ø¬ Ø¥Ù„Ù‰ ØªØµØ¯ÙŠØ± Ø­Ù‚Ù„ <code style="background:rgba(255,255,255,0.07);padding:1px 5px;border-radius:4px;">paymentMethod</code> Ù…Ù† Ù…ØµØ¯Ø± Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ù„ØªÙØ¹ÙŠÙ„ Ù‡Ø°Ø§ Ø§Ù„ØªØ­Ù„ÙŠÙ„.'
            ) +
          '</div>' +
        '</div>'
      );
    }

    var adv = pi.prepaidNdrAdvantage || 0;
    var dl  = deltaLabel(adv);

    function side(label, color, emoji, ndr, dr, codPct) {
      var ndrVal = ndr || 0;
      var drVal  = dr  || 0;
      return '<div style="flex:1;background:' + color + '0d;border:1px solid ' + color + '33;' +
        'border-radius:14px;padding:22px;text-align:center;">' +
        '<div style="font-size:28px;margin-bottom:6px;">' + emoji + '</div>' +
        '<div style="font-size:14px;font-weight:800;color:' + color + ';margin-bottom:16px;">' + label + '</div>' +
        '<div style="font-size:11px;color:' + C.muted + ';margin-bottom:2px;">' + sTx('Order Share', 'Ù†Ø³Ø¨Ø© Ø§Ù„Ø·Ù„Ø¨Ø§Øª') + '</div>' +
        '<div style="font-size:26px;font-weight:900;color:' + color + ';margin-bottom:16px;">' + pct(codPct) + '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
          '<div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:10px;">' +
            '<div style="font-size:10px;color:' + C.muted + ';margin-bottom:3px;">NDR</div>' +
            '<div style="font-size:18px;font-weight:900;color:' + ndrColor(ndrVal) + ';">' + pct(ndrVal) + '</div>' +
          '</div>' +
          '<div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:10px;">' +
            '<div style="font-size:10px;color:' + C.muted + ';margin-bottom:3px;">' + sTx('DR (Estimated)', 'DR (ØªÙ‚Ø¯ÙŠØ±)') + '</div>' +
            '<div style="font-size:18px;font-weight:900;color:' + ndrColor(drVal) + ';">' + pct(drVal) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    var advBadge = '<span style="display:inline-flex;align-items:center;gap:5px;' +
      'padding:4px 12px;border-radius:20px;font-size:11px;font-weight:800;' +
      'background:' + dl.color + '1a;color:' + dl.color + ';border:1px solid ' + dl.color + '44;">' +
      dl.label + sTx(' | Delta ', ' | ÙØ§Ø±Ù‚ ') + pct(Math.abs(adv)) +
    '</span>';

    return sectionCard(sTx('Payment Method Comparison', 'Ù…Ù‚Ø§Ø±Ù†Ø© Ø£Ø³Ù„ÙˆØ¨ Ø§Ù„Ø¯ÙØ¹'), 'creditCard',
      '<div style="display:flex;gap:16px;align-items:stretch;">' +
        side(sTx('Prepaid', 'Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚'), C.prepaid, 'ðŸ’³', pi.prepaidNdr, pi.globalPrepaidDr || pi.prepaidDr, pi.globalPrepaidPct) +
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
          'padding:0 10px;gap:10px;min-width:80px;">' +
          '<div style="font-size:24px;">âš¡</div>' +
          advBadge +
          '<div style="font-size:10px;color:' + C.muted + ';text-align:center;">' + sTx('Prepaid NDR Advantage', 'Ø£ÙØ¶Ù„ÙŠØ© NDR Ù„Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚') + '</div>' +
        '</div>' +
        side(sTx('Cash on Delivery (COD)', 'Ø§Ù„Ø¯ÙØ¹ Ø¹Ù†Ø¯ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù… (COD)'), C.cod, 'ðŸ’°', pi.codNdr, pi.globalCodDr || pi.codDr, pi.globalCodPct) +
      '</div>'
    );
  }

  function buildPrepaidPromoSuggester(pi, geo) {
    var avgCommission = geo && geo.kpis ? Number(geo.kpis.avgCommission || 0) : 0;
    var codNdr = pi ? Number(pi.codNdr || 0) : 0;
    var prepaidNdr = pi ? Number(pi.prepaidNdr || pi.globalPrepaidDr || pi.prepaidDr || 0) : 0;
    var hasData = avgCommission > 0 && codNdr > 0 && prepaidNdr > 0;

    if (!hasData) {
      return sectionCard(
        sTx('Prepaid Promo Code Suggester', 'مقترح كود خصم الدفع المسبق'),
        'tag',
        '<div style="color:' + C.muted + ';font-size:13px;line-height:1.8;">' +
          sTx(
            'Add commission and payment-method delivery data to calculate the safe prepaid discount.',
            'أضف بيانات العمولة والتسليم حسب طريقة الدفع لحساب خصم الدفع المسبق الآمن.'
          ) +
        '</div>'
      );
    }

    var codExpected = avgCommission * codNdr;
    var maxDiscountSar = Math.max(0, avgCommission - (codExpected / prepaidNdr));
    var maxDiscountPct = avgCommission > 0 ? (maxDiscountSar / avgCommission) * 100 : 0;
    var suggestedPct = Math.max(0, Math.min(30, Math.floor(maxDiscountPct)));
    var code = suggestedPct > 0 ? 'PREPAID' + suggestedPct : 'PREPAID';
    var targetCities = [];

    if (pi && Array.isArray(pi.codHeavyCities)) {
      targetCities = pi.codHeavyCities.slice(0, 5).map(function (city) {
        return city.city || city.name;
      }).filter(Boolean);
    }

    var suggestedText = suggestedPct > 0
      ? sTx('Offer ' + suggestedPct + '% prepaid discount', 'قدم خصم ' + suggestedPct + '% للدفع المسبق')
      : sTx('Do not offer a discount yet', 'لا تقدم خصما الآن');
    var actionText = suggestedPct > 0
      ? sTx(
          'Create a prepaid-only promo code in your store, then use this text in the ad creative.',
          'أنشئ كود خصم للدفع المسبق فقط داخل المتجر، ثم استخدم هذا النص في الإعلان.'
        )
      : sTx(
          'The data does not show enough room for a prepaid discount. Keep the regular offer for now.',
          'البيانات لا تعطي مساحة كافية لخصم الدفع المسبق. استخدم العرض العادي حاليا.'
        );
    var creativeText = suggestedPct > 0
      ? sTx(
          'Pay online and use code ' + code + ' for ' + suggestedPct + '% off.',
          'ادفع أونلاين واستخدم كود ' + code + ' للحصول على خصم ' + suggestedPct + '%.'
        )
      : '';

    var metrics = [
      {
        label: sTx('What should I do?', 'ماذا أفعل؟'),
        value: suggestedText,
        sub: actionText,
        color: suggestedPct > 0 ? C.green : C.cod
      },
      {
        label: sTx('Code to create', 'الكود الذي تنشئه'),
        value: code,
        sub: suggestedPct > 0 ? sTx('Make this prepaid-only in your store.', 'اجعله للدفع المسبق فقط داخل المتجر.') : sTx('No discount recommended yet.', 'لا يوجد خصم مقترح الآن.'),
        color: C.prepaid
      },
      {
        label: sTx('Safety limit', 'حد الأمان'),
        value: fmtSAR(maxDiscountSar),
        sub: sTx('Do not give more than this discount per order.', 'لا تعط خصما أعلى من هذا لكل طلب.'),
        color: C.green
      }
    ].map(function (item) {
      return '<div style="background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.07);' +
        'border-radius:12px;padding:14px;min-height:96px;">' +
        '<div style="font-size:11px;color:' + C.muted + ';margin-bottom:7px;">' + item.label + '</div>' +
        '<div style="font-size:18px;font-weight:900;color:' + item.color + ';line-height:1.35;">' + esc(item.value) + '</div>' +
        '<div style="font-size:11px;color:' + C.muted + ';line-height:1.6;margin-top:8px;">' + esc(item.sub) + '</div>' +
      '</div>';
    }).join('');

    var cityChips = targetCities.map(function (name) {
      return '<span style="display:inline-flex;padding:5px 9px;border-radius:999px;' +
        'background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.26);' +
        'color:#fde68a;font-size:11px;font-weight:800;">' + esc(name) + '</span>';
    }).join('');

    return sectionCard(
      sTx('Prepaid Promo Code Suggester', 'مقترح كود خصم الدفع المسبق'),
      'tag',
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px;">' +
        metrics +
      '</div>' +
      (creativeText ? '<div style="background:rgba(59,130,246,0.10);border:1px solid rgba(59,130,246,0.24);' +
        'border-radius:12px;padding:14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
        '<div>' +
          '<div style="font-size:11px;color:' + C.muted + ';font-weight:800;margin-bottom:5px;">' + sTx('Ad text you can copy', 'نص إعلان يمكنك نسخه') + '</div>' +
          '<div id="sp-promo-copy-text" style="font-size:14px;color:' + C.text + ';font-weight:900;line-height:1.6;">' + esc(creativeText) + '</div>' +
        '</div>' +
        '<button id="sp-promo-copy-btn" style="padding:9px 14px;border-radius:10px;border:1px solid rgba(59,130,246,0.4);' +
          'background:rgba(59,130,246,0.16);color:#93c5fd;font-size:12px;font-weight:900;font-family:inherit;cursor:pointer;">' +
          sTx('Copy ad text', 'نسخ نص الإعلان') +
        '</button>' +
      '</div>' : '') +
      '<div style="font-size:12px;color:' + C.muted + ';line-height:1.8;margin-bottom:12px;">' +
        sTx('Why: prepaid orders deliver better than COD, so you can spend part of that improvement as a discount without hurting margin.', 'السبب: طلبات الدفع المسبق تصل أفضل من COD، لذلك يمكنك استخدام جزء من هذا التحسن كخصم بدون تدمير الهامش.') +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<span style="font-size:11px;color:' + C.muted + ';font-weight:800;">' + sTx('Target cities:', 'المدن المستهدفة:') + '</span>' +
        (cityChips || '<span style="font-size:11px;color:' + C.muted + ';line-height:1.7;">' + sTx('No specific city has enough bad COD data yet. Test this prepaid offer broadly, or wait until a city shows many COD orders with weak delivery.', 'لا توجد مدينة محددة لديها بيانات COD سيئة كافية بعد. اختبر عرض الدفع المسبق بشكل عام، أو انتظر حتى تظهر مدينة فيها طلبات COD كثيرة مع تسليم ضعيف.') + '</span>') +
      '</div>'
    );
  }

  /* â”€â”€ 3. City Ranking Chart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var cityPagination = {
    allItems: [],
    items: [],
    page: 1,
    pageSize: 5,
    geo: null,
    sortKey: 'prepaidPct',
    sortDir: 1
  };

  var CITY_DEFAULT_SORT_KEY = 'prepaidPct';
  var CITY_DEFAULT_SORT_DIR = 1;

  function sortCities(arr, key, dir) {
    return arr.slice().sort(function (a, b) {
      var av = key === 'name' ? String(a.name || '') : Number(a[key] || 0);
      var bv = key === 'name' ? String(b.name || '') : Number(b[key] || 0);
      var comparison = key === 'name'
        ? av.localeCompare(bv, isAr ? 'ar' : 'en')
        : (av - bv);
      if (comparison === 0 && key !== 'orders') comparison = (Number(a.orders || 0) - Number(b.orders || 0));
      return dir === 1 ? -comparison : comparison;
    });
  }

  function updateCitySortHeaders() {
    document.querySelectorAll('.sp-city-sort-btn').forEach(function (btn) {
      var key = btn.dataset.sortKey;
      var isActive = key === cityPagination.sortKey;
      var arrow = btn.querySelector('.sp-city-sort-arrow');
      if (arrow) {
        arrow.textContent = isActive
          ? (cityPagination.sortDir === 1 ? ' â–¼' : ' â–²')
          : ' â‡…';
        arrow.style.opacity = isActive ? '1' : '0.4';
      }
      btn.style.opacity = isActive ? '1' : '0.65';
    });
  }

  function applyCitySort() {
    cityPagination.items = sortCities(cityPagination.allItems, cityPagination.sortKey, cityPagination.sortDir);
    cityPagination.page = 1;
    updateCitySortHeaders();
    updateCityPage();
  }

  function updateCityPage() {
    var container = document.getElementById('sp-city-rows-container');
    if (!container) return;

    var start = (cityPagination.page - 1) * cityPagination.pageSize;
    var end = start + cityPagination.pageSize;
    var pageItems = cityPagination.items.slice(start, end);

    var rowsHtml = pageItems.map(function (city, idx) {
      var globalIdx = start + idx;
      var prepPct  = clamp(city.prepaidPct, 0, 1);
      var barPrep  = Math.round(prepPct * 100);
      var barCod   = 100 - barPrep;
      var rankColor = globalIdx < 3 ? C.green : globalIdx < 7 ? C.prepaid : C.muted;
      var ndrC      = ndrColor(city.ndr);

      return '<div class="sp-city-row" data-city="' + city.name + '" ' +
        'style="display:grid;grid-template-columns:140px 1fr 70px 60px;' +
        'align-items:center;gap:12px;padding:9px 12px;border-radius:10px;' +
        'cursor:pointer;transition:background 0.15s;margin-bottom:4px;" ' +
        'onmouseover="this.style.background=\'rgba(59,130,246,0.08)\'" ' +
        'onmouseout="this.style.background=\'transparent\'">' +
        '<div style="display:flex;align-items:center;gap:6px;overflow:hidden;">' +
          '<span style="font-size:10px;font-weight:900;color:' + rankColor + ';' +
            'min-width:18px;text-align:center;">' + (globalIdx + 1) + '</span>' +
          '<span style="font-size:12px;font-weight:600;color:' + C.text + ';' +
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + city.name + '</span>' +
        '</div>' +
        '<div style="position:relative;height:20px;border-radius:10px;overflow:hidden;' +
          'background:rgba(255,255,255,0.06);">' +
          (barPrep > 0 ? '<div style="position:absolute;right:0;top:0;height:100%;width:' + barPrep + '%;' +
            'background:' + C.prepaid + ';border-radius:10px 0 0 10px;transition:width 0.4s;' +
            'display:flex;align-items:center;justify-content:center;">' +
            '<span style="font-size:9px;font-weight:800;color:#fff;">' + barPrep + '%</span>' +
          '</div>' : '') +
          (barCod > 0 ? '<div style="position:absolute;left:0;top:0;height:100%;width:' + barCod + '%;' +
            'background:' + C.cod + '55;border-radius:0 10px 10px 0;transition:width 0.4s;' +
            'display:flex;align-items:center;justify-content:center;">' +
            '<span style="font-size:9px;font-weight:800;color:' + C.cod + ';">' + barCod + '%</span>' +
          '</div>' : '') +
        '</div>' +
        '<div style="text-align:center;font-size:12px;font-weight:800;color:' + ndrC + ';">' +
          (city.ndr > 0 ? pct(city.ndr, 0) : 'â€”') +
        '</div>' +
        '<div style="text-align:center;font-size:11px;color:' + C.muted + ';">' +
          city.orders.toLocaleString('en-US') +
        '</div>' +
      '</div>';
    }).join('');

    var totalPages = Math.ceil(cityPagination.items.length / cityPagination.pageSize);
    var paginationHtml = generatePagination(cityPagination.page, totalPages, 'sp-city-page-btn');

    container.innerHTML = '<div id="sp-city-rows">' + rowsHtml + '</div>' + paginationHtml;

    container.querySelectorAll('.sp-city-page-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (this.hasAttribute('disabled')) return;
        cityPagination.page = parseInt(this.dataset.page, 10);
        updateCityPage();
      });
    });

    container.querySelectorAll('.sp-city-row').forEach(function (row) {
      row.addEventListener('click', function () {
        var cityName = row.dataset.city;
        if (!cityName) return;
        if (window.CityIntelligenceDrawer && cityPagination.geo) {
          window.CityIntelligenceDrawer.open(cityName, { geo: cityPagination.geo });
        }
        if (window.DashboardFilterBus) {
          window.DashboardFilterBus.setState({ selectedCity: cityName });
        }
      });
    });
  }

  function buildCityRanking(pi, geo) {
    var cityList = [];

    if (geo && geo.cityStats) {
      Object.keys(geo.cityStats).forEach(function (cityName) {
        var cs = geo.cityStats[cityName];
        if ((cs.count || 0) < 5) return;
        var prepaidPct = cs.prepaidCount > 0 ? (cs.prepaidCount / cs.count) : 0;
        var ndrBase = cs.ndrBaseOrders || cs.count || 0;
        var ndrVal = ndrBase > 0 ? clamp((cs.deliveredOrders || 0) / ndrBase, 0, 1) : 0;
        cityList.push({
          name:       cityName,
          prepaidPct: prepaidPct,
          codPct:     1 - prepaidPct,
          orders:     cs.count || 0,
          ndr:        ndrVal,
          commission: cs.earnedCommission || 0
        });
      });
    } else if (pi && pi.highestPrepaidCities && pi.lowestPrepaidCities) {
      var seen = {};
      pi.highestPrepaidCities.concat(pi.lowestPrepaidCities).forEach(function (c) {
        if (!seen[c.city]) {
          seen[c.city] = true;
          cityList.push({
            name: c.city, prepaidPct: c.prepaidPct, codPct: 1 - c.prepaidPct,
            orders: c.orders || 0, ndr: c.ndr || 0, commission: 0
          });
        }
      });
    }

    if (cityList.length === 0) {
      return sectionCard(sTx('City Ranking by Prepaid Share', 'ØªØµÙ†ÙŠÙ Ø§Ù„Ù…Ø¯Ù† Ø­Ø³Ø¨ Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚'), 'mapPin', emptyState(sTx('No city data available', 'Ù„Ø§ ØªØªÙˆÙØ± Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ø¯Ù†')));
    }

    cityPagination.sortKey = CITY_DEFAULT_SORT_KEY;
    cityPagination.sortDir = CITY_DEFAULT_SORT_DIR;
    cityPagination.allItems = cityList;
    cityPagination.items = sortCities(cityList, CITY_DEFAULT_SORT_KEY, CITY_DEFAULT_SORT_DIR);
    cityPagination.page = 1;
    cityPagination.geo = geo;

    var legend = '<div style="display:flex;align-items:center;gap:16px;margin-bottom:14px;' +
      'font-size:10px;color:' + C.muted + ';">' +
      '<div style="display:flex;align-items:center;gap:4px;"><div style="width:10px;height:10px;' +
        'border-radius:3px;background:' + C.prepaid + ';"></div>' + sTx('Prepaid', 'Ù…Ø³Ø¨Ù‚') + '</div>' +
      '<div style="display:flex;align-items:center;gap:4px;"><div style="width:10px;height:10px;' +
        'border-radius:3px;background:' + C.cod + '55;"></div>COD</div>' +
      '<span style="margin-right:auto;">' + sTx('NDR | Orders', 'NDR | Ø§Ù„Ø·Ù„Ø¨Ø§Øª') + '</span>' +
    '</div>';

    function citySortHdr(key, label, align) {
      var isActive = cityPagination.sortKey === key;
      var arrow = isActive ? (cityPagination.sortDir === 1 ? ' â–¼' : ' â–²') : ' â‡…';
      return '<button class="sp-city-sort-btn" data-sort-key="' + key + '" style="all:unset;cursor:pointer;opacity:' + (isActive ? '1' : '0.65') + ';font-size:10px;color:' + C.muted + ';text-align:' + (align || 'start') + ';transition:opacity 0.15s,transform 0.1s;">' +
        label + '<span class="sp-city-sort-arrow" style="opacity:' + (isActive ? '1' : '0.4') + ';">' + arrow + '</span>' +
      '</button>';
    }

    var header = '<div style="display:grid;grid-template-columns:140px 1fr 70px 60px;' +
      'gap:12px;padding:0 12px;margin-bottom:8px;">' +
      '<span style="font-size:10px;color:' + C.muted + ';">' + sTx('City', 'Ø§Ù„Ù…Ø¯ÙŠÙ†Ø©') + '</span>' +
      '<span style="font-size:10px;color:' + C.muted + ';">' + sTx('Payment Mix', 'ØªÙˆØ²ÙŠØ¹ Ø£Ø³Ù„ÙˆØ¨ Ø§Ù„Ø¯ÙØ¹') + '</span>' +
      citySortHdr('ndr', 'NDR', 'center') +
      '<span style="font-size:10px;color:' + C.muted + ';text-align:center;">' + sTx('Orders', 'Ø·Ù„Ø¨Ø§Øª') + '</span>' +
    '</div>';

    return sectionCard(sTx('City Ranking by Prepaid Share', 'ØªØµÙ†ÙŠÙ Ø§Ù„Ù…Ø¯Ù† Ø­Ø³Ø¨ Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚'), 'mapPin',
      legend + (
        '<div style="display:grid;grid-template-columns:140px 1fr 70px 60px;gap:12px;padding:0 12px;margin-bottom:8px;">' +
        citySortHdr('name', sTx('City', 'Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã™Å Ã™â€ Ã˜Â©')) +
        citySortHdr('prepaidPct', sTx('Payment Mix', 'Ã˜ÂªÃ™Ë†Ã˜Â²Ã™Å Ã˜Â¹ Ã˜Â£Ã˜Â³Ã™â€žÃ™Ë†Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â¯Ã™ÂÃ˜Â¹')) +
        citySortHdr('ndr', 'NDR', 'center') +
        citySortHdr('orders', sTx('Orders', 'Ã˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª'), 'center') +
        '</div>'
      ) +
      '<div id="sp-city-rows-container"></div>',
      '<span style="margin-right:auto;font-size:10px;color:' + C.muted + ';">' + sTx('All cities Â· Click for details', 'Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù…Ø¯Ù† Â· Ø§Ù†Ù‚Ø± Ù„Ù„ØªÙØ§ØµÙŠÙ„') + '</span>'
    );
  }

  /* â”€â”€ 4. Product Prepaid vs COD Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var productPagination = {
    items: [],
    allItems: [],
    page: 1,
    pageSize: 10,
    geo: null,
    searchQuery: '',
    sortKey: 'ndrDiff',
    sortDir: 1
  };

  var PRODUCT_DEFAULT_SORT_KEY = 'ndrDiff';
  var PRODUCT_DEFAULT_SORT_DIR = 1;

  function sortProducts(arr, key, dir) {
    // dir: 1 = descending (largest first, â–¼), -1 = ascending (smallest first, â–²)
    return arr.slice().sort(function (a, b) {
      var av = (a[key] !== null && a[key] !== undefined) ? a[key] : -Infinity;
      var bv = (b[key] !== null && b[key] !== undefined) ? b[key] : -Infinity;
      return dir === 1 ? (bv - av) : (av - bv);
    });
  }

  function applySort() {
    productPagination.allItems = sortProducts(
      productPagination.allItems, productPagination.sortKey, productPagination.sortDir
    );

    /* Update all column header arrows in-place without full re-render */
    document.querySelectorAll('.sp-sort-btn').forEach(function (btn) {
      var key = btn.dataset.sortKey;
      var isActive = key === productPagination.sortKey;
      var isDefault = key === PRODUCT_DEFAULT_SORT_KEY;
      var arrow = btn.querySelector('.sp-sort-arrow');
      if (arrow) {
        arrow.textContent = isActive
          ? (productPagination.sortDir === 1 ? ' â–¼' : ' â–²')
          : ' â‡…';
        arrow.style.opacity = isActive ? '1' : '0.4';
      }
      btn.style.opacity = isActive ? '1' : '0.65';
    });

    /* Toggle reset button visibility */
    var resetBtn = document.getElementById('sp-sort-reset');
    if (resetBtn) {
      var isDefault = productPagination.sortKey === PRODUCT_DEFAULT_SORT_KEY &&
                      productPagination.sortDir === PRODUCT_DEFAULT_SORT_DIR;
      resetBtn.style.opacity = isDefault ? '0.35' : '1';
      resetBtn.style.pointerEvents = isDefault ? 'none' : 'auto';
      resetBtn.style.borderColor = isDefault ? 'rgba(255,255,255,0.08)' : 'rgba(59,130,246,0.4)';
      resetBtn.style.color = isDefault ? 'rgba(255,255,255,0.3)' : C.prepaid;
    }

    productPagination.page = 1;
    updateProductPage();
  }

  function updateProductPage() {
    var container = document.getElementById('sp-product-table-content');
    if (!container) return;

    var query = normalizeProductSearch(productPagination.searchQuery);
    productPagination.items = query
      ? productPagination.allItems.filter(function (p) {
          return normalizeProductSearch([p.name, p.displayName, p.sku].join(' ')).indexOf(query) !== -1;
        })
      : productPagination.allItems.slice();

    var start = (productPagination.page - 1) * productPagination.pageSize;
    var end = start + productPagination.pageSize;
    var pageItems = productPagination.items.slice(start, end);

    var recStyles = {
      force:   { label: sTx('Mandatory Prepaid', 'Ø¥Ù„Ø²Ø§Ù…ÙŠ Ù…Ø³Ø¨Ù‚'), bg: C.green  + '18', color: C.green,  border: C.green  + '44' },
      prefer:  { label: sTx('Prefer Prepaid', 'ÙŠÙÙØ¶ÙŽÙ‘Ù„ Ù…Ø³Ø¨Ù‚'), bg: C.prepaid + '18', color: C.prepaid, border: C.prepaid + '44' },
      ok:      { label: sTx('Both Acceptable', 'ÙƒÙ„Ø§Ù‡Ù…Ø§ Ù…Ù‚Ø¨ÙˆÙ„'), bg: 'rgba(255,255,255,0.05)', color: C.muted,  border: C.border },
      unknown: { label: sTx('Incomplete Data', 'Ø¨ÙŠØ§Ù†Ø§Øª Ù†Ø§Ù‚ØµØ©'), bg: 'rgba(255,255,255,0.04)', color: C.muted,  border: C.border }
    };

    var geo = productPagination.geo;

    var rowsHtml = pageItems.map(function (p) {
      var rs       = recStyles[p.rec] || recStyles.ok;
      var prepNdrDisp = p.prepaidNdr !== null ? pct(p.prepaidNdr, 1) : 'â€”';
      var codNdrDisp  = p.codNdr     !== null ? pct(p.codNdr, 1)     : 'â€”';
      var diffDisp    = p.ndrDiff    !== null
        ? (p.ndrDiff > 0 ? '+' : '') + pct(p.ndrDiff, 1)
        : 'â€”';
      var diffColor   = p.ndrDiff > 0.10 ? C.green : p.ndrDiff > 0 ? C.prepaid : p.ndrDiff < 0 ? C.red : C.muted;

      var pStat = (geo && geo.productStats && geo.productStats[p.name]) ? geo.productStats[p.name] : null;
      var pName = (pStat && pStat.name) ? pStat.name : p.name;
      var pSku = (pStat && pStat.sku) ? pStat.sku : '';

      var displayName = pName;
      if (pSku && pSku !== pName) {
        displayName = pName + ' (' + pSku + ')';
      }

      var name = esc(displayName);

      var prepaidPct = p.totalOrders > 0 ? Math.round(p.prepaidOrders / p.totalOrders * 100) : 0;
      var codPct     = p.totalOrders > 0 ? Math.round(p.codOrders     / p.totalOrders * 100) : 0;

      return '<div class="sp-product-row" style="display:grid;grid-template-columns:1fr 90px 90px 100px 100px 110px 130px;' +
        'gap:8px;align-items:center;padding:12px 14px;border-radius:10px;' +
        'transition:background 0.15s;margin-bottom:4px;" ' +
        'onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" ' +
        'onmouseout="this.style.background=\'transparent\'">' +
        '<div style="overflow:hidden;padding-left:10px;">' +
          '<div style="font-size:13px;font-weight:700;color:' + C.text + ';line-height:1.4;">' + name + '</div>' +
          '<div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:5px;font-weight:600;">' +
            'ðŸ’° ' + sTx(fmtSAR(p.totalCommission) + ' commission', fmtSAR(p.totalCommission) + ' Ø¹Ù…ÙˆÙ„Ø©') +
          '</div>' +
        '</div>' +
        '<div style="text-align:center;">' +
          '<div style="font-size:13px;font-weight:800;color:' + C.prepaid + ';">' + p.prepaidOrders.toLocaleString('en-US') + '</div>' +
          '<div style="font-size:9px;color:' + C.prepaid + '88;margin-top:2px;font-weight:600;">' + prepaidPct + '%</div>' +
        '</div>' +
        '<div style="text-align:center;">' +
          '<div style="font-size:13px;font-weight:800;color:' + C.cod + ';">' + p.codOrders.toLocaleString('en-US') + '</div>' +
          '<div style="font-size:9px;color:' + C.cod + '88;margin-top:2px;font-weight:600;">' + codPct + '%</div>' +
        '</div>' +
        '<div style="text-align:center;font-size:13px;font-weight:800;color:' + (p.prepaidNdr !== null ? ndrColor(p.prepaidNdr) : C.muted) + ';">' + prepNdrDisp + '</div>' +
        '<div style="text-align:center;font-size:13px;font-weight:800;color:' + (p.codNdr !== null ? ndrColor(p.codNdr) : C.muted) + ';">' + codNdrDisp + '</div>' +
        '<div style="text-align:center;font-size:13px;font-weight:900;color:' + diffColor + ';">' + diffDisp + '</div>' +
        '<div style="display:flex;justify-content:center;">' +
          '<span style="padding:3px 10px;border-radius:8px;font-size:10px;font-weight:800;' +
            'background:' + rs.bg + ';color:' + rs.color + ';border:1px solid ' + rs.border + ';' +
            'white-space:normal;overflow-wrap:anywhere;word-break:normal;max-width:100%;line-height:1.2;">' + rs.label + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    var totalPages = Math.ceil(productPagination.items.length / productPagination.pageSize);
    var paginationHtml = generatePagination(productPagination.page, totalPages, 'sp-page-btn');

    if (!rowsHtml) {
      rowsHtml = emptyState(sTx('No products match this search', 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ù†ØªØ¬Ø§Øª ØªØ·Ø§Ø¨Ù‚ Ø§Ù„Ø¨Ø­Ø«'));
    }

    container.innerHTML = '<div id="sp-product-rows">' + rowsHtml + '</div>' + paginationHtml;

    container.querySelectorAll('.sp-page-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (this.hasAttribute('disabled')) return;
        productPagination.page = parseInt(this.dataset.page, 10);
        updateProductPage();
      });
    });
  }

  function buildProductTable(geo) {
    if (!geo || !geo.geoProductMap) {
      return sectionCard(sTx('Product Comparison: Prepaid vs COD', 'Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª: Ù…Ø³Ø¨Ù‚ Ù…Ù‚Ø§Ø¨Ù„ COD'), 'package', emptyState(sTx('No product data available', 'Ù„Ø§ ØªØªÙˆÙØ± Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ù†ØªØ¬Ø§Øª')));
    }

    var productAgg = {};
    Object.keys(geo.geoProductMap).forEach(function (cityName) {
      Object.keys(geo.geoProductMap[cityName]).forEach(function (productKey) {
        var cell = geo.geoProductMap[cityName][productKey];
        if (!productAgg[productKey]) {
          productAgg[productKey] = {
            name:              productKey,
            totalOrders:       0, prepaidOrders: 0, codOrders: 0,
            prepaidNdrBase:    0, codNdrBase: 0,
            prepaidDelivered:  0, prepaidCanceled: 0,
            codDelivered:      0, codCanceled: 0,
            totalCommission:   0
          };
        }
        var p = productAgg[productKey];
        p.totalOrders      += cell.orders      || 0;
        p.prepaidOrders    += cell.prepaidCount || 0;
        p.codOrders        += cell.codCount     || 0;
        p.prepaidNdrBase   += cell.prepaidNdrBaseOrders || cell.prepaidCount || 0;
        p.codNdrBase       += cell.codNdrBaseOrders || cell.codCount || 0;
        p.totalCommission  += cell.commission   || 0;

        if (cell.prepaidDelivered !== undefined || cell.prepaidCanceled !== undefined ||
            cell.codDelivered !== undefined || cell.codCanceled !== undefined) {
          p.prepaidDelivered += cell.prepaidDelivered || 0;
          p.prepaidCanceled  += cell.prepaidCanceled  || 0;
          p.codDelivered     += cell.codDelivered     || 0;
          p.codCanceled      += cell.codCanceled      || 0;
        } else {
          var totalDel = cell.delivered || 0;
          var totalCan = cell.canceled  || 0;
          var pRatio   = (cell.orders > 0) ? ((cell.prepaidCount || 0) / cell.orders) : 0;
          p.prepaidDelivered  += Math.round(totalDel * pRatio);
          p.prepaidCanceled   += Math.round(totalCan * pRatio);
          p.codDelivered      += Math.round(totalDel * (1 - pRatio));
          p.codCanceled       += Math.round(totalCan * (1 - pRatio));
        }
      });
    });

    var products = Object.values(productAgg).filter(function (p) { return p.totalOrders >= 5; });
    if (products.length === 0) return sectionCard(sTx('Product Comparison: Prepaid vs COD', 'Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª: Ù…Ø³Ø¨Ù‚ Ù…Ù‚Ø§Ø¨Ù„ COD'), 'package', emptyState(sTx('Insufficient data for comparison', 'Ø¨ÙŠØ§Ù†Ø§Øª ØºÙŠØ± ÙƒØ§ÙÙŠØ© Ù„Ù„Ù…Ù‚Ø§Ø±Ù†Ø©')));

    products.forEach(function (p) {
      var pStat = (geo.productStats && geo.productStats[p.name]) ? geo.productStats[p.name] : null;
      p.productName = (pStat && pStat.name) ? pStat.name : p.name;
      p.sku = (pStat && pStat.sku) ? pStat.sku : '';
      p.displayName = p.sku && p.sku !== p.productName ? p.productName + ' (' + p.sku + ')' : p.productName;
      p.prepaidNdr = p.prepaidNdrBase > 0 ? clamp(p.prepaidDelivered / p.prepaidNdrBase, 0, 1) : null;
      p.codNdr     = p.codNdrBase     > 0 ? clamp(p.codDelivered / p.codNdrBase, 0, 1) : null;
      p.ndrDiff    = (p.prepaidNdr !== null && p.codNdr !== null) ? (p.prepaidNdr - p.codNdr) : null;
      p.rec = p.ndrDiff === null ? 'unknown'
        : p.ndrDiff > 0.15 ? 'force'
        : p.ndrDiff > 0.05 ? 'prefer'
        : 'ok';
    });

    productPagination.sortKey = PRODUCT_DEFAULT_SORT_KEY;
    productPagination.sortDir = PRODUCT_DEFAULT_SORT_DIR;
    productPagination.allItems = sortProducts(products, PRODUCT_DEFAULT_SORT_KEY, PRODUCT_DEFAULT_SORT_DIR);
    productPagination.items = productPagination.allItems.slice();
    productPagination.page = 1;
    productPagination.geo = geo;
    productPagination.searchQuery = '';

    /* â”€â”€ Search bar + Reset sort button â”€â”€ */
    var searchBar =
      '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
        '<input id="sp-product-search" type="text" placeholder="' + esc(sTx('Search product name or SKU...', 'Ø§Ø¨Ø­Ø« Ø¨Ø§Ø³Ù… Ø§Ù„Ù…Ù†ØªØ¬ Ø£Ùˆ Ø§Ù„ÙƒÙˆØ¯...')) + '" ' +
          'style="flex:1;min-width:0;background:#0b1120;border:1px solid rgba(255,255,255,0.1);' +
          'border-radius:10px;color:#fff;font-family:Cairo,sans-serif;font-size:12px;padding:9px 12px;outline:none;' +
          'transition:border-color 0.2s;" />' +
        '<button id="sp-sort-reset" title="' + esc(sTx('Reset to default sort (Gap desc)', 'إعادة الترتيب الافتراضي (الفارق تنازلي)')) + '" ' +
          'style="flex-shrink:0;display:flex;align-items:center;gap:5px;padding:0 14px;height:38px;' +
          'background:transparent;border:1px solid rgba(255,255,255,0.08);border-radius:10px;' +
          'color:rgba(255,255,255,0.3);font-size:11px;font-weight:700;font-family:Cairo,sans-serif;' +
          'cursor:pointer;white-space:nowrap;transition:all 0.18s;' +
          'opacity:0.35;pointer-events:none;">' +
          sTx('Reset', 'إعادة') +
        '</button>' +
      '</div>';

    /* â”€â”€ Column header builder â”€â”€ */
    function sortHdr(key, color, label, sub) {
      var isActive = productPagination.sortKey === key;
      var arrow    = isActive ? (productPagination.sortDir === 1 ? ' â–¼' : ' â–²') : ' â‡…';
      var opacity  = isActive ? '1' : '0.65';
      /* Use data attributes for hover â€” avoids broken inline quote escaping */
      return '<button class="sp-sort-btn" data-sort-key="' + key + '" data-active-opacity="' + opacity + '" ' +
        'style="all:unset;display:flex;flex-direction:column;align-items:center;gap:2px;' +
        'cursor:pointer;width:100%;opacity:' + opacity + ';transition:opacity 0.15s,transform 0.1s;">' +
        '<span style="font-size:10px;font-weight:800;color:' + color + ';letter-spacing:0.5px;text-transform:uppercase;">' +
          label + '<span class="sp-sort-arrow" style="opacity:' + (isActive ? '1' : '0.4') + ';">' + arrow + '</span>' +
        '</span>' +
        '<span style="font-size:9px;color:rgba(255,255,255,0.35);font-weight:500;">' + sub + '</span>' +
      '</button>';
    }

    var header =
      '<div class="sp-product-header" style="display:grid;grid-template-columns:1fr 90px 90px 100px 100px 110px 130px;' +
      'gap:8px;padding:10px 14px 12px;border-bottom:1px solid ' + C.border + ';margin-bottom:6px;' +
      'background:rgba(255,255,255,0.015);border-radius:10px 10px 0 0;">' +
        '<div style="display:flex;flex-direction:column;gap:2px;">' +
          '<span style="font-size:10px;font-weight:800;color:' + C.text + ';letter-spacing:0.5px;text-transform:uppercase;">' + sTx('Product', 'Ø§Ù„Ù…Ù†ØªØ¬') + '</span>' +
          '<span style="font-size:9px;color:' + C.muted + ';font-weight:500;">' + sTx('Name Â· SKU Â· Commission', 'Ø§Ù„Ø§Ø³Ù… Â· Ø§Ù„ÙƒÙˆØ¯ Â· Ø§Ù„Ø¹Ù…ÙˆÙ„Ø©') + '</span>' +
        '</div>' +
        sortHdr('prepaidOrders', C.prepaid, sTx('Prepaid', 'Ù…Ø³Ø¨Ù‚'),  sTx('Orders', 'Ø·Ù„Ø¨Ø§Øª')) +
        sortHdr('codOrders',     C.cod,     'COD',                   sTx('Orders', 'Ø·Ù„Ø¨Ø§Øª')) +
        sortHdr('prepaidNdr',    C.prepaid, sTx('Prepaid', 'Ù…Ø³Ø¨Ù‚'),  'NDR') +
        sortHdr('codNdr',        C.cod,     'COD',                   'NDR') +
        sortHdr('ndrDiff',       C.green,   sTx('Gap', 'Ø§Ù„ÙØ§Ø±Ù‚'),   sTx('Prepaid âˆ’ COD', 'Ù…Ø³Ø¨Ù‚ âˆ’ COD')) +
        '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
          '<span style="font-size:10px;font-weight:800;color:' + C.text + ';letter-spacing:0.5px;text-transform:uppercase;">' + sTx('Action', 'Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡') + '</span>' +
          '<span style="font-size:9px;color:' + C.muted + ';font-weight:500;">' + sTx('What to do', 'Ù…Ø§Ø°Ø§ ØªÙØ¹Ù„') + '</span>' +
        '</div>' +
      '</div>';

    return sectionCard(sTx('Product Comparison: Prepaid vs COD', 'Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª: Ù…Ø³Ø¨Ù‚ Ù…Ù‚Ø§Ø¨Ù„ COD'), 'package',
      searchBar + header + '<div id="sp-product-table-content"></div>');
  }

  /* â”€â”€ 5. Recommendation Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var recsState = {
    activeTab: 'actions',
    page: 1,
    pageSize: 11,
    data: { actions: [], risks: [], opportunities: [], cities: [], products: [] },
    geo: null
  };

  function updateRecsState(pi, geo) {
    recsState.geo = geo;
    recsState.data = { actions: [], risks: [], opportunities: [], cities: [], products: [] };
    if (!pi) return;

    if (pi.forcePrepaidRecs) {
      pi.forcePrepaidRecs.forEach(function (rec) {
        recsState.data.actions.push({
          type: 'action', emoji: 'ðŸš¨', title: sTx('Apply Prepaid Immediately', 'ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚ ÙÙˆØ±Ø§Ù‹'),
          city: rec.city, product: rec.product,
          reason: rec.reason || (sTx('COD NDR ' + Math.round((rec.codNdr || 0) * 100) + '% vs ' + Math.round((rec.prepaidNdr || 0) * 100) + '% for Prepaid', 'NDR COD ' + Math.round((rec.codNdr || 0) * 100) + '% Ù…Ù‚Ø§Ø¨Ù„ ' + Math.round((rec.prepaidNdr || 0) * 100) + '% Ù„Ù„Ù…Ø³Ø¨Ù‚')),
          accentColor: '#3DDC97'
        });
      });
    }

    if (pi.codDangerousCombos) {
      pi.codDangerousCombos.forEach(function (combo) {
        recsState.data.risks.push({
          type: 'risk', emoji: 'âš ï¸', title: sTx('Dangerous COD Concentration', 'ØªØ±ÙƒÙŠØ² COD Ø®Ø·Ø±'),
          city: combo.city, product: combo.product,
          reason: combo.recommendation || sTx('COD NDR is extremely high for this product in this city', 'NDR COD Ù…Ø±ØªÙØ¹ Ø¬Ø¯Ø§Ù‹ ÙÙŠ Ù‡Ø°Ù‡ Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ù„Ù„Ù…Ù†ØªØ¬'),
          accentColor: '#F4B860'
        });
      });
    }

    if (pi.codHeavyCities) {
      pi.codHeavyCities.forEach(function (c) {
        recsState.data.cities.push({
          type: 'city', emoji: 'ðŸ“', title: sTx('Heavy COD City', 'Ù…Ø¯ÙŠÙ†Ø© COD Ø«Ù‚ÙŠÙ„Ø©'),
          city: c.city, product: null,
          reason: sTx('COD share ' + Math.round((c.codPct || 0) * 100) + '% Â· NDR ' + Math.round((c.codNdr || 0) * 100) + '%', 'Ù†Ø³Ø¨Ø© COD ' + Math.round((c.codPct || 0) * 100) + '% Â· NDR ' + Math.round((c.codNdr || 0) * 100) + '%'),
          accentColor: '#8B7CF6'
        });
      });
    }

    if (geo && geo.geoProductMap) {
      var allCells = [];
      Object.keys(geo.geoProductMap).forEach(function(city) {
        Object.keys(geo.geoProductMap[city]).forEach(function(product) {
          var cell = geo.geoProductMap[city][product];
          allCells.push({
            city: city, product: product,
            prepaidNdr: cell.prepaidNdr, codNdr: cell.codNdr,
            codCount: cell.codCount, prepaidCount: cell.prepaidCount,
            prepaidNdrBaseOrders: cell.prepaidNdrBaseOrders,
            prepaidDelivered: cell.prepaidDelivered
          });
        });
      });

      allCells.forEach(function(cell) {
        var diff = (cell.prepaidNdr !== undefined && cell.codNdr !== undefined) ? (cell.prepaidNdr - cell.codNdr) : 0;
        if (diff > 0.05 && diff <= 0.15 && (cell.codCount || 0) >= 5 && (cell.prepaidCount || 0) >= 5) {
          recsState.data.opportunities.push({
            type: 'opportunity', emoji: 'ðŸ“ˆ', title: sTx('Performance Improvement Opportunity', 'ÙØ±ØµØ© ØªØ­Ø³ÙŠÙ† Ø§Ù„Ø£Ø¯Ø§Ø¡'),
            city: cell.city, product: cell.product,
            reason: sTx('Prepaid outperforms by ' + Math.round(diff * 100) + '% - encourage it', 'Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚ ÙŠØªÙÙˆÙ‚ Ø¨Ù†Ø³Ø¨Ø© ' + Math.round(diff * 100) + '% - ÙŠÙÙØ¶Ù„ ØªØ´Ø¬ÙŠØ¹Ù‡'),
            accentColor: '#3DDC97'
          });
        }
      });

      var productAgg = {};
      allCells.forEach(function(cell) {
        var pk = cell.product;
        if (!productAgg[pk]) productAgg[pk] = { name: pk, prepaidCount: 0, codCount: 0, prepaidNdrBase: 0, prepaidDelivered: 0 };
        productAgg[pk].prepaidCount += cell.prepaidCount || 0;
        productAgg[pk].codCount += cell.codCount || 0;
        productAgg[pk].prepaidNdrBase += cell.prepaidNdrBaseOrders || cell.prepaidCount || 0;
        productAgg[pk].prepaidDelivered += cell.prepaidDelivered || 0;
      });

      var topProducts = Object.values(productAgg).filter(function(p) { return p.prepaidCount >= 10; });
      topProducts.forEach(function(p) { p.ndr = p.prepaidNdrBase > 0 ? clamp(p.prepaidDelivered / p.prepaidNdrBase, 0, 1) : 0; });
      topProducts.sort(function(a, b) { return b.ndr - a.ndr; });

      topProducts.slice(0, 10).forEach(function(p) {
        if (p.ndr >= 0.40) {
          recsState.data.products.push({
            type: 'product', emoji: 'ðŸŒŸ', title: sTx('Outstanding Prepaid Product', 'Ù…Ù†ØªØ¬ Ù…ØªÙ…ÙŠØ² Ø¨Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚'),
            city: null, product: p.name,
            reason: sTx('Prepaid delivery rate ' + Math.round(p.ndr * 100) + '% of ' + p.prepaidCount + ' orders', 'Ù…Ø¹Ø¯Ù„ ØªØ³Ù„ÙŠÙ… Ø§Ù„Ù…Ø³Ø¨Ù‚ ' + Math.round(p.ndr * 100) + '% Ù…Ù† ' + p.prepaidCount + ' Ø·Ù„Ø¨'),
            accentColor: '#22d3ee'
          });
        }
      });
    }
  }

  function updateRecsPage() {
    var container = document.getElementById('sp-recs-content');
    if (!container) return;

    var items = recsState.data[recsState.activeTab] || [];
    var totalActive = 0;
    Object.keys(recsState.data).forEach(function(k) { totalActive += recsState.data[k].length; });

    var subtitleEl = document.getElementById('sp-recs-subtitle');
    if (subtitleEl) subtitleEl.innerText = totalActive + sTx(' active recommendations', ' ØªÙˆØµÙŠØ© Ù†Ø´Ø·Ø©');

    if (items.length === 0) {
      container.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:12px;">' +
          '<div style="font-size:32px;opacity:0.6;">âœ¨</div>' +
          '<div style="color:' + C.muted + ';font-size:13px;">' + sTx('No recommendations in this category', 'Ù„Ø§ ØªÙˆØ¬Ø¯ ØªÙˆØµÙŠØ§Øª ÙÙŠ Ù‡Ø°Ù‡ Ø§Ù„ÙØ¦Ø©') + '</div>' +
        '</div>';
      return;
    }

    var start = (recsState.page - 1) * recsState.pageSize;
    var end = start + recsState.pageSize;
    var pageItems = items.slice(start, end);

    var html = '';

    function renderCard(card, isFeatured, index) {
        var geo = recsState.geo;
        var cityTag = card.city
          ? '<span style="padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;' +
              'background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.06);">' +
              'ðŸ“ ' + card.city + '</span>'
          : '';
        var pStat = (card.product && geo && geo.productStats && geo.productStats[card.product]) ? geo.productStats[card.product] : null;
        var pName = (pStat && pStat.name) ? pStat.name : card.product;
        var pSku = (pStat && pStat.sku) ? pStat.sku : '';
        var displayProduct = pName;
        if (pSku && pSku !== pName) {
            displayProduct = pName + ' (' + pSku + ')';
        }

        var productTag = card.product
          ? '<span style="padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;' +
              'background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.06);">' +
              'ðŸ“¦ ' + (displayProduct && displayProduct.length > 30 ? displayProduct.slice(0, 28) + 'â€¦' : (displayProduct || '')) + '</span>'
          : '';

        var priority = isFeatured ? 'high' : (index === 1 ? 'medium' : 'low');

        var hoverRgba = card.accentColor === '#3DDC97' ? '61,220,151' :
                        card.accentColor === '#F4B860' ? '244,184,96' :
                        card.accentColor === '#8B7CF6' ? '139,124,246' : '212,177,90';
        var btnHoverBg = 'rgba(' + hoverRgba + ',0.12)';
        var btnHoverBorder = 'rgba(' + hoverRgba + ',0.3)';
        var btnHoverShadow = '0 4px 12px rgba(' + hoverRgba + ',0.1), inset 0 1px 0 rgba(255,255,255,0.1)';

        var ctaBtn = card.city
          ? '<button class="sp-rec-cta" data-city="' + card.city + '" ' +
              'data-product="' + (card.product || '') + '" ' +
              'style="margin-top:10px;width:100%;padding:6px;border:1px solid rgba(255,255,255,0.04);' +
              'background:rgba(255,255,255,0.015);color:rgba(255,255,255,0.4);border-radius:6px;' +
              'font-size:10px;font-weight:600;cursor:pointer;transition:all 0.2s cubic-bezier(0.22, 1, 0.36, 1);box-shadow:none;transform:translateY(0);">' +
              sTx('Details â†’', 'Ø§Ù„ØªÙØ§ØµÙŠÙ„ â†') +
            '</button>'
          : '';

        var bg, shadow, border;
        if (isFeatured) {
            if (card.accentColor === '#3DDC97') {
                bg = 'linear-gradient(180deg, rgba(61,220,151,0.05) 0%, rgba(13,19,32,1) 100%)';
                shadow = 'box-shadow: 0 -1px 12px rgba(61,220,151,0.06), 0 4px 12px rgba(0,0,0,0.3);';
            } else if (card.accentColor === '#F4B860') {
                bg = 'linear-gradient(180deg, rgba(244,184,96,0.04) 0%, rgba(10,12,18,1) 100%)';
                shadow = 'box-shadow: 0 -1px 12px rgba(244,184,96,0.05), 0 4px 12px rgba(0,0,0,0.4);';
            } else if (card.accentColor === '#8B7CF6') {
                bg = 'linear-gradient(180deg, rgba(139,124,246,0.05) 0%, rgba(13,19,32,1) 100%)';
                shadow = 'box-shadow: 0 -1px 12px rgba(139,124,246,0.06), 0 4px 12px rgba(0,0,0,0.3);';
            } else {
                bg = 'radial-gradient(120% 100% at 50% 0%, rgba(212,177,90,0.06) 0%, rgba(13,19,32,1) 100%)';
                shadow = 'box-shadow: 0 -1px 12px rgba(212,177,90,0.08), 0 4px 12px rgba(0,0,0,0.3);';
            }
            border = '1px solid ' + card.accentColor + '1a';
        } else {
            bg = '#0D1320';
            border = '1px solid rgba(255,255,255,0.03)';
            shadow = '';
        }

        var padding = priority === 'high' ? '16px 20px' : (priority === 'medium' ? '14px 16px' : '12px 14px');
        var titleSize = priority === 'high' ? '13px' : (priority === 'medium' ? '12px' : '11.5px');
        var emojiSize = priority === 'high' ? '18px' : '16px';
        var titleColor = isFeatured ? card.accentColor : (priority === 'medium' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)');
        var reasonColor = priority === 'high' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.45)';
        var reasonSize = priority === 'high' ? '11.5px' : '11px';
        var barOpacity = isFeatured ? '0.8' : (priority === 'medium' ? '0.3' : '0.15');

        return '<div class="sp-rec-card" style="background:' + bg + ';border:' + border + ';' +
          'border-radius:12px;padding:' + padding + ';position:relative;overflow:hidden;' +
          'transition:all 0.2s ease;' + shadow + '">' +
          '<div style="position:absolute;top:0;right:0;width:2px;height:100%;background:' + card.accentColor + ';' +
            'opacity:' + barOpacity + ';border-radius:0 12px 12px 0;"></div>' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
            '<span style="font-size:' + emojiSize + ';opacity:0.9;">' + card.emoji + '</span>' +
            '<span style="font-size:' + titleSize + ';font-weight:700;letter-spacing:0.2px;color:' + titleColor + ';">' + card.title + '</span>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">' +
            cityTag + productTag +
          '</div>' +
          '<div style="font-size:' + reasonSize + ';color:' + reasonColor + ';line-height:1.5;">' + card.reason + '</div>' +
          ctaBtn +
        '</div>';
    }

    if (pageItems.length > 0) {
      html += '<div style="margin-bottom:12px;">' + renderCard(pageItems[0], true, 0) + '</div>';
      if (pageItems.length > 1) {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;">' +
          pageItems.slice(1).map(function(c, i) { return renderCard(c, false, i + 1); }).join('') +
        '</div>';
      }
    }

    var totalPages = Math.ceil(items.length / recsState.pageSize);
    var paginationHtml = generatePagination(recsState.page, totalPages, 'sp-rec-page-btn');

    container.innerHTML = html + paginationHtml;

    container.querySelectorAll('.sp-rec-cta').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cityName    = btn.dataset.city;
        var productKey  = btn.dataset.product;
        if (cityName && window.CityIntelligenceDrawer && recsState.geo) {
          window.CityIntelligenceDrawer.open(cityName, { geo: recsState.geo });
        }
        if (window.DashboardFilterBus) {
          var patch = { selectedCity: cityName || null };
          if (productKey) patch.selectedProduct = productKey;
          window.DashboardFilterBus.setState(patch);
        }
      });
    });

    container.querySelectorAll('.sp-rec-page-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (this.hasAttribute('disabled')) return;
        recsState.page = parseInt(this.dataset.page, 10);
        updateRecsPage();
      });
    });
  }

  function buildRecommendationCards(pi, geo) {
    updateRecsState(pi, geo);

    var tabs = [
      { id: 'actions',       label: sTx('Prepaid Actions', 'Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚'),     icon: 'ðŸ”¥', count: recsState.data.actions.length,       color: '#3DDC97' },
      { id: 'risks',         label: sTx('COD Risks', 'Ù…Ø®Ø§Ø·Ø± COD'),                       icon: 'âš ï¸', count: recsState.data.risks.length,         color: '#F4B860' },
      { id: 'opportunities', label: sTx('Improvement Opportunities', 'ÙØ±Øµ Ø§Ù„ØªØ­Ø³ÙŠÙ†'),     icon: 'ðŸ“ˆ', count: recsState.data.opportunities.length, color: '#3DDC97' },
      { id: 'cities',        label: sTx('Critical Cities', 'Ø§Ù„Ù…Ø¯Ù† Ø§Ù„Ø­Ø±Ø¬Ø©'),               icon: 'ðŸ“', count: recsState.data.cities.length,        color: '#8B7CF6' },
      { id: 'products',      label: sTx('Featured Products', 'Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø§Ù„Ù…Ù…ÙŠØ²Ø©'),         icon: 'ðŸŒŸ', count: recsState.data.products.length,      color: '#D4B15A' }
    ];

    var totalActive = 0;
    tabs.forEach(function(t) { totalActive += t.count; });

    var tabsHtml = '<div id="sp-recs-tabs" style="display:flex;gap:4px;background:rgba(255,255,255,0.015);padding:3px;border-radius:8px;overflow-x:auto;border:1px solid rgba(255,255,255,0.03);">' +
      tabs.map(function(t) {
        var isActive = recsState.activeTab === t.id;
        var bg = isActive ? 'rgba(255,255,255,0.06)' : 'transparent';
        var border = isActive ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent';
        var color = isActive ? t.color : 'rgba(255,255,255,0.4)';
        var fontWeight = isActive ? '600' : '500';
        return '<button class="sp-rec-tab-btn" data-tab="' + t.id + '" data-color="' + t.color + '" ' +
          'style="display:flex;align-items:center;gap:6px;flex:0 0 auto;box-sizing:border-box;padding:5px 12px;border-radius:6px;' +
          'background:' + bg + ';border:' + border + ';color:' + color + ';' +
          'font-size:11px;font-weight:' + fontWeight + ';cursor:pointer;transition:all 0.15s;white-space:nowrap;box-shadow:' + (isActive ? '0 2px 4px rgba(0,0,0,0.1)' : 'none') + '">' +
          '<span style="font-size:12px;opacity:0.8;">' + t.icon + '</span>' +
          '<span>' + t.label + '</span>' +
          '<span class="sp-rec-tab-count" style="background:rgba(255,255,255,0.05);padding:1px 5px;border-radius:8px;font-size:10px;color:' + (isActive ? t.color : 'rgba(255,255,255,0.3)') + ';">' + t.count + '</span>' +
        '</button>';
      }).join('') +
    '</div>';

    var legendHtml = '<div style="display:flex;align-items:center;gap:12px;margin-right:auto;font-size:10px;color:rgba(255,255,255,0.4);">' +
      '<div style="display:flex;align-items:center;gap:4px;"><span style="color:#3DDC97;font-size:14px;line-height:0.5;">â—</span> ' + sTx('Prepaid Opportunities', 'ÙØ±Øµ Ø§Ù„Ø¯ÙØ¹') + '</div>' +
      '<div style="display:flex;align-items:center;gap:4px;"><span style="color:#F4B860;font-size:14px;line-height:0.5;">â—</span> ' + sTx('COD Risks', 'Ù…Ø®Ø§Ø·Ø± COD') + '</div>' +
      '<div style="display:flex;align-items:center;gap:4px;"><span style="color:#8B7CF6;font-size:14px;line-height:0.5;">â—</span> ' + sTx('Critical Cities', 'Ø§Ù„Ù…Ø¯Ù† Ø§Ù„Ø­Ø±Ø¬Ø©') + '</div>' +
      '<div style="display:flex;align-items:center;gap:4px;"><span style="color:#D4B15A;font-size:14px;line-height:0.5;">â—</span> ' + sTx('Featured Products', 'Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª') + '</div>' +
    '</div>';

    var headerHtml = '<div style="display:flex;flex-direction:column;gap:14px;margin-bottom:16px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          ((window.icon && window.icon('alertCircle')) ? window.icon('alertCircle', { size: 16, color: 'rgba(255,255,255,0.8)' }) : '') +
          '<div>' +
            '<div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.9);letter-spacing:0.3px;">' + sTx('Recommendations & Alerts', 'Ø§Ù„ØªÙˆØµÙŠØ§Øª ÙˆØ§Ù„ØªØ­Ø°ÙŠØ±Ø§Øª') + '</div>' +
            '<div id="sp-recs-subtitle" style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;">' + sTx(totalActive + ' active recommendations', totalActive + ' ØªÙˆØµÙŠØ© Ù†Ø´Ø·Ø©') + '</div>' +
          '</div>' +
        '</div>' +
        legendHtml +
      '</div>' +
      tabsHtml +
    '</div>';

    var containerHtml = '<div id="sp-recs-content" style="min-height:200px;"></div>';

    return '<div style="background:' + C.card + ';border:1px solid ' + C.border + ';' +
      'border-radius:16px;padding:22px 24px;margin-bottom:20px;">' +
      headerHtml + containerHtml +
    '</div>';
  }

  /* â”€â”€ 6. No-data banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function buildNoDataBanner() {
    return '<div style="background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.20);' +
      'border-radius:14px;padding:18px 22px;margin-bottom:20px;display:flex;align-items:center;gap:14px;">' +
      '<span style="font-size:24px;flex-shrink:0;">â„¹ï¸</span>' +
      '<div>' +
        '<div style="font-size:13px;font-weight:700;color:' + C.prepaid + ';margin-bottom:4px;">' + sTx('Limited Prepaid Data', 'Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚ Ù…Ø­Ø¯ÙˆØ¯Ø©') + '</div>' +
        '<div style="font-size:12px;color:' + C.muted + ';line-height:1.6;">' +
          sTx(
            'Most of your orders do not contain the <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;">paymentMethod</code> field. ' +
            'Currently displaying analysis for categorized orders only. To enable full analysis, please add the payment method field to your export file.',
            'Ù…Ø¹Ø¸Ù… Ø·Ù„Ø¨Ø§ØªÙƒ Ù„Ø§ ØªØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ Ø­Ù‚Ù„ <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;">paymentMethod</code>. ' +
            'ÙŠÙØ¹Ø±Ø¶ Ø§Ù„Ø¢Ù† ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ù…ØµÙ†ÙØ© ÙÙ‚Ø·. Ù„ØªÙØ¹ÙŠÙ„ Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ø§Ù„ÙƒØ§Ù…Ù„ØŒ ÙŠØ±Ø¬Ù‰ Ø¥Ø¶Ø§ÙØ© Ø­Ù‚Ù„ Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø¯ÙØ¹ Ø¥Ù„Ù‰ Ù…Ù„Ù Ø§Ù„ØªØµØ¯ÙŠØ±.'
          ) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* â”€â”€ Wire events after render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function wireEvents(mountEl, geo) {

    /* Recommendation tabs */
    mountEl.querySelectorAll('.sp-rec-tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tabId = this.dataset.tab;
        if (recsState.activeTab === tabId) return;
        recsState.activeTab = tabId;
        recsState.page = 1;

        mountEl.querySelectorAll('.sp-rec-tab-btn').forEach(function(b) {
          var tColor = b.dataset.color || '#3DDC97';
          var isAct = b.dataset.tab === tabId;
          b.style.background  = isAct ? 'rgba(255,255,255,0.06)' : 'transparent';
          b.style.border      = isAct ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent';
          b.style.color       = isAct ? tColor : 'rgba(255,255,255,0.4)';
          b.style.fontWeight  = isAct ? '600' : '500';
          b.style.boxShadow   = isAct ? '0 2px 4px rgba(0,0,0,0.1)' : 'none';
          var countSpan = b.querySelector('.sp-rec-tab-count');
          if (countSpan) countSpan.style.color = isAct ? tColor : 'rgba(255,255,255,0.3)';
        });

        updateRecsPage();
      });
    });

    /* Product search */
    var productSearch = document.getElementById('sp-product-search');
    if (productSearch) {
      productSearch.addEventListener('input', function () {
        productPagination.searchQuery = this.value;
        productPagination.page = 1;
        updateProductPage();
      });
      productSearch.addEventListener('focus', function () { this.style.borderColor = C.prepaid; });
      productSearch.addEventListener('blur',  function () { this.style.borderColor = 'rgba(255,255,255,0.1)'; });
    }

    var promoCopyBtn = document.getElementById('sp-promo-copy-btn');
    var promoCopyText = document.getElementById('sp-promo-copy-text');
    if (promoCopyBtn && promoCopyText) {
      promoCopyBtn.addEventListener('click', function () {
        var text = promoCopyText.textContent || '';
        function markCopied() {
          promoCopyBtn.textContent = sTx('Copied', 'تم النسخ');
          setTimeout(function () {
            promoCopyBtn.textContent = sTx('Copy ad text', 'نسخ نص الإعلان');
          }, 1400);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(markCopied);
        } else {
          var temp = document.createElement('textarea');
          temp.value = text;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          temp.remove();
          markCopied();
        }
      });
    }

    /* Sort column buttons â€” attached via event delegation to avoid re-attaching on page changes */
    if (mountEl._spSortClickHandler) mountEl.removeEventListener('click', mountEl._spSortClickHandler);
    if (mountEl._spSortMouseOverHandler) mountEl.removeEventListener('mouseover', mountEl._spSortMouseOverHandler);
    if (mountEl._spSortMouseOutHandler) mountEl.removeEventListener('mouseout', mountEl._spSortMouseOutHandler);

    mountEl._spSortClickHandler = function (e) {
      var cityBtn = e.target.closest('.sp-city-sort-btn');
      if (cityBtn) {
        var cityKey = cityBtn.dataset.sortKey;
        if (!cityKey) return;
        if (cityPagination.sortKey === cityKey) {
          cityPagination.sortDir = cityPagination.sortDir === 1 ? -1 : 1;
        } else {
          cityPagination.sortKey = cityKey;
          cityPagination.sortDir = 1;
        }
        applyCitySort();
        return;
      }

      var btn = e.target.closest('.sp-sort-btn');
      if (!btn) return;
      var key = btn.dataset.sortKey;
      if (!key) return;
      if (productPagination.sortKey === key) {
        productPagination.sortDir = productPagination.sortDir === 1 ? -1 : 1;
      } else {
        productPagination.sortKey = key;
        productPagination.sortDir = 1;
      }
      applySort();
    };
    mountEl.addEventListener('click', mountEl._spSortClickHandler);

    /* Sort hover effects â€” event delegation so they survive table re-renders */
    mountEl._spSortMouseOverHandler = function (e) {
      var cityBtn = e.target.closest('.sp-city-sort-btn');
      if (cityBtn) {
        cityBtn.style.opacity = '1';
        cityBtn.style.transform = 'translateY(-1px)';
        return;
      }
      var btn = e.target.closest('.sp-sort-btn');
      if (!btn) return;
      btn.style.opacity = '1';
      btn.style.transform = 'translateY(-1px)';
    };
    mountEl.addEventListener('mouseover', mountEl._spSortMouseOverHandler);
    mountEl._spSortMouseOutHandler = function (e) {
      var cityBtn = e.target.closest('.sp-city-sort-btn');
      if (cityBtn) {
        var cityActive = cityBtn.dataset.sortKey === cityPagination.sortKey;
        cityBtn.style.opacity = cityActive ? '1' : '0.65';
        cityBtn.style.transform = 'none';
        return;
      }
      var btn = e.target.closest('.sp-sort-btn');
      if (!btn) return;
      var isActive = btn.dataset.sortKey === productPagination.sortKey;
      btn.style.opacity = isActive ? '1' : '0.65';
      btn.style.transform = 'none';
    };
    mountEl.addEventListener('mouseout', mountEl._spSortMouseOutHandler);

    var excludeBtn = document.getElementById('sp-exclude-export');
    if (excludeBtn) {
      excludeBtn.addEventListener('click', function () {
        var uniqueCities = {};
        if (recsState && recsState.data) {
          if (Array.isArray(recsState.data.cities)) {
            recsState.data.cities.forEach(function(item) {
              if (item.city) uniqueCities[item.city] = true;
            });
          }
          if (Array.isArray(recsState.data.actions)) {
            recsState.data.actions.forEach(function(item) {
              if (item.city) uniqueCities[item.city] = true;
            });
          }
        }
        var list = Object.keys(uniqueCities).map(function(name) {
          return { name: name, ndr: null };
        });
        openExclusionModal(list, sTx('Low delivery / COD-heavy cities recommended for exclusion', 'المدن ذات التوصيل المنخفض الموصى باستبعادها من إعلانات الدفع عند الاستلام'));
      });
      excludeBtn.addEventListener('mouseover', function () {
        this.style.borderColor = '#a855f7';
        this.style.background = 'rgba(168,85,247,0.2)';
      });
      excludeBtn.addEventListener('mouseout', function () {
        this.style.borderColor = 'rgba(168,85,247,0.3)';
        this.style.background = 'rgba(168,85,247,0.1)';
      });
    }

    /* Reset sort button */
    var resetBtn = document.getElementById('sp-sort-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        productPagination.sortKey = PRODUCT_DEFAULT_SORT_KEY;
        productPagination.sortDir = PRODUCT_DEFAULT_SORT_DIR;
        productPagination.page    = 1;
        applySort();
      });
      resetBtn.addEventListener('mouseover', function () {
        if (this.style.pointerEvents === 'none') return;
        this.style.color = C.prepaid;
        this.style.borderColor = 'rgba(59,130,246,0.4)';
        this.style.background = 'rgba(59,130,246,0.06)';
      });
      resetBtn.addEventListener('mouseout', function () {
        if (this.style.pointerEvents === 'none') return;
        this.style.color = C.prepaid;
        this.style.borderColor = 'rgba(59,130,246,0.4)';
        this.style.background = 'transparent';
      });
    }

    /* Reset sort button hover effects â€” also handle in pagination re-render via applySort */
    updateCityPage();
    updateProductPage();
    updateRecsPage();
  }

  /* â”€â”€ Main render function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  window.renderSectionPrepaid = function (mountEl, data, ctx) {
    if (!mountEl) return;

    var geoData = (data && data.geo) ? data.geo : null;
    var pi      = geoData ? (geoData.prepaidIntelligence || null) : null;

    var hasPrepaidData = pi && (pi.globalPrepaidPct > 0 || (pi.forcePrepaidRecs && pi.forcePrepaidRecs.length > 0));
    var hasGeoData     = geoData && geoData.cityStats && Object.keys(geoData.cityStats).length > 0;

    var topBarHtml = '';
    if (window.sectionTopBar) {
      topBarHtml = window.sectionTopBar({
        account: (ctx && ctx.account) || null,
        month:   (ctx && ctx.month)   || null
      });
    }

    var headerHtml =
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:22px;">' +
        '<div style="width:40px;height:40px;border-radius:12px;background:rgba(59,130,246,0.15);' +
          'border:1px solid rgba(59,130,246,0.30);display:flex;align-items:center;justify-content:center;' +
          'font-size:20px;flex-shrink:0;">ðŸ’³</div>' +
        '<div>' +
          '<div style="font-size:20px;font-weight:900;color:' + C.text + ';">' + sTx('Prepaid Intelligence', 'Ø°ÙƒØ§Ø¡ Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚') + '</div>' +
          '<div style="font-size:12px;color:' + C.muted + ';margin-top:2px;">' +
            sTx('Analysis of prepaid vs cash on delivery performance Â· Cities Â· Products Â· Recommendations', 'ØªØ­Ù„ÙŠÙ„ Ø£Ø¯Ø§Ø¡ Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚ Ù…Ù‚Ø§Ø¨Ù„ Ø§Ù„Ø¯ÙØ¹ Ø¹Ù†Ø¯ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù… Â· Ø§Ù„Ù…Ø¯Ù† Â· Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Â· Ø§Ù„ØªÙˆØµÙŠØ§Øª') +
          '</div>' +
        '</div>' +
      '</div>';

    var content =
      topBarHtml +
      '<div style="padding:0 2px;">' +
        headerHtml +
        (!hasPrepaidData && hasGeoData ? buildNoDataBanner() : '') +
        buildKpiStrip(pi) +
        buildComparisonPanel(pi) +
        buildPrepaidPromoSuggester(pi, geoData) +
        buildCityRanking(pi, geoData) +
        buildProductTable(geoData) +
        buildRecommendationCards(pi, geoData) +
      '</div>';

    mountEl.innerHTML = content;
    wireEvents(mountEl, geoData);

    if (window.animateNumber) {
      mountEl.querySelectorAll('[data-animate]').forEach(function (el) {
        var to = parseFloat(el.dataset.animate) || 0;
        window.animateNumber(el, to);
      });
    }
  };

})();
