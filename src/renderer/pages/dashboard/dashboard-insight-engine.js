/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   dashboard-insight-engine.js  (T-19)
   Cross-dimensional insight engine â€” runs after Pass 2 geo data is available.
   Produces a priority-sorted array of Insight objects.

   Depends on:
     window.getDashboardThresholds() â€” from dashboard-aggregator.js (T-02)

   Exposed on window:
     runInsightEngine(geo, thresholds) â†’ Insight[]
       geo = { cityStats, productStats, geoProductMap, provinceMap, kpis }
       thresholds = optional override (defaults to getDashboardThresholds())

   Insight schema:
     { id, type, level, priority, city?, product?, province?,
       title, body, recommendation, metric, tags }

   Priority order: critical â†’ high â†’ medium â†’ low
   Types: risk | opportunity | observation | recommendation
   Levels: global | province | city | product | product-city
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
(function () {
  'use strict';

  var PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

  function pct(fraction) {
    return Math.round((fraction || 0) * 100);
  }

  function safeNdr(delivered, total) {
    total = Number(total || 0);
    return total > 0 ? Number(delivered || 0) / total : 0;
  }

  function safePct(part, total) {
    return total > 0 ? part / total : 0;
  }

  var _insightCounter = 0;
  function makeInsight(type, level, priority, opts) {
    _insightCounter++;
    return {
      id:             'ins_' + _insightCounter,
      type:           type,
      level:          level,
      priority:       priority,
      city:           opts.city       || undefined,
      product:        opts.product    || undefined,
      province:       opts.province   || undefined,
      title:          opts.title      || '',
      body:           opts.body       || '',
      recommendation: opts.recommendation || '',
      metric:         opts.metric     || {},
      tags:           opts.tags       || []
    };
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     MAIN ENGINE
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  window.runInsightEngine = function (geo, thresholds) {
  const isAr = window.dashboardI18n ? window.dashboardI18n.currentLocale === 'ar' : true;
  function tx(en, ar) { return isAr ? ar : en; }

    _insightCounter = 0;
    geo = geo || {};
    var cityStats    = geo.cityStats    || {};
    var productStats = geo.productStats || {};
    var geoMap       = geo.geoProductMap || {};
    var provinceMap  = geo.provinceMap   || {};
    var kpis         = geo.kpis          || {};

    var T = thresholds || (typeof window.getDashboardThresholds === 'function'
      ? window.getDashboardThresholds()
      : {
          NDR_DANGER: 0.20, NDR_SAFE: 0.40, NDR_NATIONAL: 0.30,
          DR_EXCELLENT: 0.40, DR_GOOD: 0.30, DR_POOR: 0.20,
          SCALING_MIN_ORDERS: 30, INSIGHT_MIN_SAMPLE: 15,
          PREPAID_ADVANTAGE_THRESHOLD: 0.15, COD_HEAVY_THRESHOLD: 0.85,
          SCALING_SCORE_GREEN: 70, RISK_SCORE_RED: 65
        });

    var nationalNdr     = Number(kpis.ndr)       || T.NDR_NATIONAL;
    var nationalDr      = Number(kpis.dr)        || T.DR_GOOD;
    var nationalPrepaid = Number(kpis.prepaidPct) || 0;
    var MIN_SAMPLE      = T.INSIGHT_MIN_SAMPLE;
    var MIN_SCALING     = T.SCALING_MIN_ORDERS;

    function getProductName(key) {
      if (!key) return tx('Unknown product', 'Ù…Ù†ØªØ¬ ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ');
      var ps = productStats[key];
      if (ps && ps.name && ps.name !== key && ps.name !== 'Unknown') return ps.name;
      return key; // Fallback to key/sku if name is unavailable
    }

    var insights = [];

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       RISK RULE 1 â€” City NDR < danger threshold AND orders â‰¥ INSIGHT_MIN_SAMPLE
       Level: city | Priority: critical
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    Object.keys(cityStats).forEach(function (city) {
      var cs = cityStats[city];
      if ((cs.count || 0) < MIN_SAMPLE) return;
      var cityNdr  = safeNdr(cs.deliveredOrders || 0, cs.count || 0);
      if (cityNdr < T.NDR_DANGER) {
        insights.push(makeInsight('risk', 'city', 'critical', {
          city:  city,
          title: tx('âš ï¸ NDR Risk: ', 'âš ï¸ NDR Ø®Ø·Ø±: ') + city,
          body:  tx('Returns rate ', 'Ù†Ø³Ø¨Ø© Ø§Ù„Ù…Ø±ØªØ¬Ø¹Ø§Øª ') + pct(cityNdr) + tx('% â€” much higher than the safe limit (', '% â€” Ø£Ø¹Ù„Ù‰ Ø¨ÙƒØ«ÙŠØ± Ù…Ù† Ø§Ù„Ø­Ø¯ Ø§Ù„Ø¢Ù…Ù† (') + pct(T.NDR_DANGER) + '%)',
          recommendation: tx('Pause campaigns in ', 'Ø£ÙˆÙ‚Ù Ø§Ù„Ø­Ù…Ù„Ø§Øª ÙÙŠ ') + city + tx(' temporarily and review Orders quality', ' Ù…Ø¤Ù‚ØªØ§Ù‹ ÙˆØ±Ø§Ø¬Ø¹ Ø¬ÙˆØ¯Ø© Ø§Ù„Ø·Ù„Ø¨Ø§Øª'),
          metric: { ndr: cityNdr, orders: cs.count },
          tags:   ['ndr', 'risk']
        }));
      }
    });

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       RISK RULE 2 â€” Product NDR in specific city < danger threshold AND orders â‰¥ MIN_SAMPLE
       Level: product-city | Priority: critical
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    Object.keys(geoMap).forEach(function (city) {
      Object.keys(geoMap[city]).forEach(function (product) {
        var cell = geoMap[city][product];
        if ((cell.orders || 0) < MIN_SAMPLE) return;
        if ((cell.ndr || 0) < T.NDR_DANGER) {
          var pName = getProductName(product);
          insights.push(makeInsight('risk', 'product-city', 'critical', {
            city: city, product: product,
            title: tx('ðŸ”´ NDR Warning: ', 'ðŸ”´ ØªØ­Ø°ÙŠØ± NDR: ') + pName + tx(' in ', ' ÙÙŠ ') + city,
            body:  'NDR ' + pct(cell.ndr) + tx('% â€” very high risk for this product in this city', '% â€” Ø®Ø·Ø± Ø¹Ø§Ù„Ù Ø¬Ø¯Ø§Ù‹ Ù„Ù‡Ø°Ø§ Ø§Ù„Ù…Ù†ØªØ¬ ÙÙŠ Ù‡Ø°Ù‡ Ø§Ù„Ù…Ø¯ÙŠÙ†Ø©'),
            recommendation: tx('Stop ads for this product in ', 'Ø£ÙˆÙ‚Ù Ø¥Ø¹Ù„Ø§Ù†Ø§Øª Ù‡Ø°Ø§ Ø§Ù„Ù…Ù†ØªØ¬ ÙÙŠ ') + city + tx(' immediately', ' ÙÙˆØ±Ø§Ù‹'),
            metric: { ndr: cell.ndr, orders: cell.orders, delivered: cell.delivered },
            tags:   ['ndr', 'risk', 'product']
          }));
        }
      });
    });

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       RISK RULE 3 â€” City prepaidNdr - codNdr > 15pp AND codCount â‰¥ 10
       Level: city | Priority: high
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    Object.keys(cityStats).forEach(function (city) {
      var cs = cityStats[city];
      if ((cs.codCount || 0) < 10) return;

      // Derive COD NDR approximation from available data
      var cityNdr       = safeNdr(cs.deliveredOrders || 0, cs.count || 0);
      var codDelivered  = cs.codDeliveredCount    || 0;
      var prepDelivered = cs.prepaidDeliveredCount || 0;

      // Approximate: assume canceled proportional to COD/prepaid split
      var codFrac    = safePct(cs.codCount || 0, cs.count || 0);
      var codCanceled   = Math.round((cs.canceledCount || 0) * codFrac);
      var prepCanceled  = (cs.canceledCount || 0) - codCanceled;

      var codNdr    = safeNdr(codDelivered, cs.codCount || 0);
      var prepNdr   = safeNdr(prepDelivered, cs.prepaidCount || 0);
      var advantage = prepNdr - codNdr;

      if (advantage > T.PREPAID_ADVANTAGE_THRESHOLD && (cs.prepaidCount || 0) >= 5) {
        insights.push(makeInsight('recommendation', 'city', 'high', {
          city: city,
          title: tx('ðŸ’³ Apply Prepaid: ', 'ðŸ’³ ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚: ') + city,
          body:  tx('COD NDR ', 'NDR Ø§Ù„Ø¯ÙØ¹ Ø¹Ù†Ø¯ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù… ') + pct(codNdr) + tx('% vs ', '% Ù…Ù‚Ø§Ø¨Ù„ ') + pct(prepNdr) + tx('% for Prepaid â€” gap of ', '% Ù„Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚ â€” ÙØ§Ø±Ù‚ ') + pct(advantage) + '%',
          recommendation: tx('Switching campaigns in ', 'ØªØ­ÙˆÙŠÙ„ Ø­Ù…Ù„Ø§Øª ') + city + tx(' to Prepaid will significantly improve delivery rate', ' Ù„Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚ Ø³ÙŠØ­Ø³Ù† Ù†Ø³Ø¨Ø© Ø§Ù„ØªØ³Ù„ÙŠÙ… Ø¨Ø´ÙƒÙ„ Ù…Ù„Ø­ÙˆØ¸'),
          metric: { codNdr: codNdr, prepaidNdr: prepNdr, advantage: advantage },
          tags:   ['prepaid', 'recommendation']
        }));
      }
    });

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       RISK RULE 4 â€” Province NDR below danger threshold
       Level: province | Priority: high
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    Object.keys(provinceMap).forEach(function (pid) {
      var p = provinceMap[pid];
      if ((p.totalOrders || 0) < MIN_SCALING) return;
      if ((p.ndrPct || 0) < T.NDR_DANGER) {
        insights.push(makeInsight('risk', 'province', 'high', {
          province: pid,
          title:    tx('ðŸ“ Region ', 'ðŸ“ Ù…Ù†Ø·Ù‚Ø© ') + p.name + tx(': High NDR', ': NDR Ù…Ø±ØªÙØ¹'),
          body:     tx('Region NDR ', 'NDR Ø§Ù„Ù…Ù†Ø·Ù‚Ø© ') + pct(p.ndrPct) + tx('% is lower than national average ', '% Ø£Ù‚Ù„ Ù…Ù† Ø§Ù„Ù…ØªÙˆØ³Ø· Ø§Ù„ÙˆØ·Ù†ÙŠ ') + pct(nationalNdr) + '%',
          recommendation: tx('Review order quality in cities of ', 'Ø±Ø§Ø¬Ø¹ Ø¬ÙˆØ¯Ø© Ø§Ù„Ø·Ù„Ø¨Ø§Øª ÙÙŠ Ù…Ø¯Ù† ') + p.name,
          metric: { provinceNdr: p.ndrPct, nationalNdr: nationalNdr },
          tags:   ['ndr', 'risk', 'province']
        }));
      }
    });

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       RISK RULE 7 â€” City COD% > 85% AND city NDR < danger threshold
       Level: city | Priority: high
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    Object.keys(cityStats).forEach(function (city) {
      var cs = cityStats[city];
      if ((cs.count || 0) < MIN_SAMPLE) return;
      var codPct   = safePct(cs.codCount || 0, cs.count || 0);
      var cityNdr  = safeNdr(cs.deliveredOrders || 0, cs.count || 0);
      if (codPct > T.COD_HEAVY_THRESHOLD && cityNdr < T.NDR_DANGER) {
        insights.push(makeInsight('risk', 'city', 'high', {
          city: city,
          title: tx('ðŸš¨ Dangerous COD concentration: ', 'ðŸš¨ ØªØ±ÙƒÙŠØ² COD Ø®Ø·ÙŠØ±: ') + city,
          body:  tx('COD rate ', 'Ù†Ø³Ø¨Ø© Ø§Ù„Ø¯ÙØ¹ Ø¹Ù†Ø¯ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù… ') + pct(codPct) + tx('% with NDR ', '% Ù…Ø¹ NDR ') + pct(cityNdr) + tx('% â€” high financial exposure', '% â€” ØªØ¹Ø±Ø¶ Ù…Ø§Ù„ÙŠ Ø¹Ø§Ù„Ù'),
          recommendation: tx('Start converting part of orders in ', 'Ø§Ø¨Ø¯Ø£ Ø¨ØªØ­ÙˆÙŠÙ„ Ø¬Ø²Ø¡ Ù…Ù† Ø·Ù„Ø¨Ø§Øª ') + city + tx(' to prepaid gradually', ' Ø¥Ù„Ù‰ Ø¯ÙØ¹ Ù…Ø³Ø¨Ù‚ ØªØ¯Ø±ÙŠØ¬ÙŠØ§Ù‹'),
          metric: { codPct: codPct, ndr: cityNdr },
          tags:   ['cod', 'risk']
        }));
      }
    });

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       OPPORTUNITY RULE 9 â€” City prepaidPct > 50% AND excellent DR
       Level: city | Priority: high
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    Object.keys(cityStats).forEach(function (city) {
      var cs = cityStats[city];
      if ((cs.count || 0) < MIN_SCALING) return;
      var prepPct = safePct(cs.prepaidCount || 0, cs.count || 0);
      var drPct   = cs.drPct || safePct(cs.deliveredOrders || 0, cs.drBaseOrders || 0);
      if (typeof drPct === 'number' && drPct > 1) drPct = drPct / 100;
      if (prepPct > 0.50 && drPct > T.DR_EXCELLENT) {
        insights.push(makeInsight('opportunity', 'city', 'high', {
          city: city,
          title: tx('ðŸš€ Excellent expansion opportunity: ', 'ðŸš€ ÙØ±ØµØ© ØªÙˆØ³Ø¹ Ù…Ù…ØªØ§Ø²Ø©: ') + city,
          body:  tx('Prepaid ', 'Ø¯ÙØ¹ Ù…Ø³Ø¨Ù‚ ') + pct(prepPct) + tx('% + delivery rate ', '% + Ù†Ø³Ø¨Ø© ØªØ³Ù„ÙŠÙ… ') + pct(drPct) + tx('% â€” ideal environment for expansion', '% â€” Ø¨ÙŠØ¦Ø© Ù…Ø«Ø§Ù„ÙŠØ© Ù„Ù„ØªÙˆØ³Ø¹'),
          recommendation: tx('Increase campaign budget in ', 'Ø²ÙŠØ§Ø¯Ø© Ù…ÙŠØ²Ø§Ù†ÙŠØ© Ø§Ù„Ø­Ù…Ù„Ø§Øª ÙÙŠ ') + city + tx(' confidently', ' Ø¨Ø«Ù‚Ø©'),
          metric: { prepaidPct: prepPct, dr: drPct },
          tags:   ['prepaid', 'opportunity', 'scaling']
        }));
      }
    });

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       OPPORTUNITY RULE 10 â€” Product prepaidNdr strong AND codNdr weak
       Requires geoMap cells with enough prepaid data.
       Level: product | Priority: high
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    // Aggregate per product across all cities
    var productPrepaidNdr = {};
    var productCodNdr     = {};
    var productPrepaidOrders = {};
    var productCodOrders     = {};

    Object.keys(geoMap).forEach(function (city) {
      Object.keys(geoMap[city]).forEach(function (product) {
        var cell = geoMap[city][product];
        if (!productPrepaidNdr[product]) {
          productPrepaidNdr[product] = 0; productCodNdr[product] = 0;
          productPrepaidOrders[product] = 0; productCodOrders[product] = 0;
        }
        productPrepaidOrders[product] += cell.prepaidCount || 0;
        productCodOrders[product]     += cell.codCount     || 0;
        // Weighted average NDR
        productPrepaidNdr[product] += (cell.prepaidNdr || 0) * (cell.prepaidCount || 0);
        productCodNdr[product]     += (cell.codNdr     || 0) * (cell.codCount     || 0);
      });
    });

    Object.keys(productPrepaidNdr).forEach(function (product) {
      var pOrders = productPrepaidOrders[product] || 0;
      var cOrders = productCodOrders[product]     || 0;
      if (pOrders < 5 || cOrders < 10) return;
      var avgPrepaidNdr = pOrders > 0 ? productPrepaidNdr[product] / pOrders : 0;
      var avgCodNdr     = cOrders > 0 ? productCodNdr[product]     / cOrders : 0;
      if (avgPrepaidNdr >= T.NDR_SAFE && avgCodNdr < T.NDR_DANGER) {
        var pName = getProductName(product);
        insights.push(makeInsight('opportunity', 'product', 'high', {
          product: product,
          title:   tx('ðŸ’¡ Prepaid Candidate: ', 'ðŸ’¡ Ù…Ø±Ø´Ø­ Ù„Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚: ') + pName,
          body:    tx('Prepaid NDR ', 'NDR Ø¯ÙØ¹ Ù…Ø³Ø¨Ù‚ ') + pct(avgPrepaidNdr) + tx('% vs ', '% Ù…Ù‚Ø§Ø¨Ù„ ') + pct(avgCodNdr) + tx('% for COD â€” advantage of ', '% Ù„Ù„Ù€COD â€” Ù…ÙŠØ²Ø© ') + pct(avgPrepaidNdr - avgCodNdr) + '%',
          recommendation: tx('Converting this product to prepaid will significantly increase delivery rate', 'ØªØ­ÙˆÙŠÙ„ Ù‡Ø°Ø§ Ø§Ù„Ù…Ù†ØªØ¬ Ù„Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚ Ø³ÙŠØ±ÙØ¹ Ù†Ø³Ø¨Ø© Ø§Ù„ØªØ³Ù„ÙŠÙ… Ø¨Ø´ÙƒÙ„ ÙƒØ¨ÙŠØ±'),
          metric: { prepaidNdr: avgPrepaidNdr, codNdr: avgCodNdr, advantage: avgPrepaidNdr - avgCodNdr },
          tags:   ['prepaid', 'opportunity', 'product']
        }));
      }
    });

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       OPPORTUNITY RULE 14 â€” City orders < 50 AND excellent DR (untapped)
       Level: city | Priority: medium
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    Object.keys(cityStats).forEach(function (city) {
      var cs = cityStats[city];
      if ((cs.count || 0) < 5 || (cs.count || 0) >= 50) return;     // skip tiny or large
      var drPct = cs.drPct || safePct(cs.deliveredOrders || 0, cs.drBaseOrders || 0);
      if (typeof drPct === 'number' && drPct > 1) drPct = drPct / 100;
      if (drPct > T.DR_EXCELLENT) {
        insights.push(makeInsight('opportunity', 'city', 'medium', {
          city: city,
          title: tx('ðŸ“ Untapped City: ', 'ðŸ“ Ù…Ø¯ÙŠÙ†Ø© ØºÙŠØ± Ù…Ø³ØªØºÙ„Ø©: ') + city,
          body:  city + tx(' achieves ', ' ØªØ­Ù‚Ù‚ ') + pct(drPct) + tx('% delivery with low volume â€” high growth potential', '% ØªØ³Ù„ÙŠÙ… Ø¨Ø­Ø¬Ù… Ù…Ù†Ø®ÙØ¶ â€” Ø¥Ù…ÙƒØ§Ù†ÙŠØ© Ù†Ù…Ùˆ ÙƒØ¨ÙŠØ±Ø©'),
          recommendation: tx('Try gradually increasing order volume in ', 'Ø¬Ø±Ø¨ Ø²ÙŠØ§Ø¯Ø© Ø­Ø¬Ù… Ø§Ù„Ø·Ù„Ø¨Ø§Øª ÙÙŠ ') + city + tx(' gradually', ' ØªØ¯Ø±ÙŠØ¬ÙŠØ§Ù‹'),
          metric: { orders: cs.count, dr: drPct },
          tags:   ['opportunity', 'scaling']
        }));
      }
    });

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       OPPORTUNITY RULE 15 â€” Product with scalingScore > 80 in its best city
       Level: product | Priority: medium
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    Object.keys(geoMap).forEach(function (city) {
      Object.keys(geoMap[city]).forEach(function (product) {
        var cell = geoMap[city][product];
        if (!cell.isBestInCity) return;
        if ((cell.orders || 0) < MIN_SCALING) return;
        // Quick proxy scaling score: DR > excellent AND orders > 50
        var drPct = cell.dr || 0;
        if (drPct > 1) drPct = drPct / 100;
        if (drPct > T.DR_EXCELLENT && (cell.orders || 0) > 50) {
          var pName = getProductName(product);
          insights.push(makeInsight('recommendation', 'product-city', 'medium', {
            city: city, product: product,
            title: tx('ðŸ“ˆ Expand now: ', 'ðŸ“ˆ ØªÙˆØ³Ø¹ Ø§Ù„Ø¢Ù†: ') + pName + tx(' in ', ' ÙÙŠ ') + city,
            body:  tx('Best product in ', 'Ø£ÙØ¶Ù„ Ù…Ù†ØªØ¬ ÙÙŠ ') + city + tx(' with delivery rate ', ' Ø¨Ù†Ø³Ø¨Ø© ØªØ³Ù„ÙŠÙ… ') + pct(drPct) + tx('% â€” ready for expansion', '% â€” Ø¬Ø§Ù‡Ø² Ù„Ù„ØªÙˆØ³Ø¹'),
            recommendation: tx('Increase campaign budget for this product in ', 'Ø²ÙŠØ§Ø¯Ø© Ù…ÙŠØ²Ø§Ù†ÙŠØ© Ø§Ù„Ø­Ù…Ù„Ø§Øª Ù„Ù‡Ø°Ø§ Ø§Ù„Ù…Ù†ØªØ¬ ÙÙŠ ') + city,
            metric: { dr: drPct, orders: cell.orders, commission: cell.commission },
            tags:   ['scaling', 'opportunity']
          }));
        }
      });
    });

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       Sort by priority then by metric severity
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    insights.sort(function (a, b) {
      var pa = PRIORITY_ORDER[a.priority] !== undefined ? PRIORITY_ORDER[a.priority] : 99;
      var pb = PRIORITY_ORDER[b.priority] !== undefined ? PRIORITY_ORDER[b.priority] : 99;
      return pa - pb;
    });

    return insights;
  };

})();
