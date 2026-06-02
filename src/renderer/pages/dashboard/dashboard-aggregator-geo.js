/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   dashboard-aggregator-geo.js  (T-17)
   Pass 2 aggregation â€” builds the GEO intelligence layer on top of the
   extended cityStats / productStats from Pass 1.

   Depends on:
     window.getDashboardThresholds()    â€” from dashboard-aggregator.js (T-02)
     window.computeRiskScore()          â€” from dashboard-aggregator-score.js (T-14)
     window.computeScalingScore()       â€” from dashboard-aggregator-score.js (T-14)
     window.computeProfitabilityScore() â€” from dashboard-aggregator-score.js (T-14)
     window.computePipelineHealth()     â€” from dashboard-aggregator-score.js (T-14)

   Exposed on window:
     buildGeoProductMap(cityStats, productStats, nationalAverages)
       â†’ { geoProductMap, provinceMap, prepaidIntelligence }
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
(function () {
  'use strict';

  // =======================================================================
  // IMPORTANT WARNING: Do not translate cities or provinces. 
  // Do not translate cities or provinces.
  // Force showing the city and the province name in Arabic everywhere.
  // =======================================================================

  /* â”€â”€ Province metadata â€” single source of truth for name, color, coords â”€â”€â”€â”€ */
  var PROVINCE_META = {
    riyadh:   { name: 'Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø±ÙŠØ§Ø¶',           color: '#a855f7', x: 230.6, y: 164.1, rx: 95, ry: 80 },
    eastern:  { name: 'Ø§Ù„Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø´Ø±Ù‚ÙŠØ©',         color: '#14b8a6', x: 298,   y: 140,   rx: 55, ry: 45 },
    mecca:    { name: 'Ù…Ù†Ø·Ù‚Ø© Ù…ÙƒØ© Ø§Ù„Ù…ÙƒØ±Ù…Ø©',      color: '#3b82f6', x: 95,    y: 238,   rx: 50, ry: 38 },
    jazan:    { name: 'Ù…Ù†Ø·Ù‚Ø© Ø¬Ø§Ø²Ø§Ù†',             color: '#ec4899', x: 158,   y: 304,   rx: 28, ry: 22 },
    baha:     { name: 'Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø¨Ø§Ø­Ø©',            color: '#f97316', x: 132,   y: 258,   rx: 24, ry: 18 },
    madinah:  { name: 'Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ù…Ù†ÙˆØ±Ø©',  color: '#f59e0b', x: 92,    y: 175,   rx: 38, ry: 30 },
    aseer:    { name: 'Ù…Ù†Ø·Ù‚Ø© Ø¹Ø³ÙŠØ±',              color: '#ef4444', x: 152,   y: 272,   rx: 35, ry: 24 },
    qassim:   { name: 'Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ù‚ØµÙŠÙ…',            color: '#8b5cf6', x: 194,   y: 132,   rx: 38, ry: 30 },
    tabuk:    { name: 'Ù…Ù†Ø·Ù‚Ø© ØªØ¨ÙˆÙƒ',              color: '#0ea5e9', x: 80,    y: 110,   rx: 42, ry: 32 },
    hail:     { name: 'Ù…Ù†Ø·Ù‚Ø© Ø­Ø§Ø¦Ù„',              color: '#84cc16', x: 160,   y: 125,   rx: 32, ry: 24 },
    najran:   { name: 'Ù…Ù†Ø·Ù‚Ø© Ù†Ø¬Ø±Ø§Ù†',             color: '#06b6d4', x: 198,   y: 304,   rx: 28, ry: 20 },
    jawf:     { name: 'Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø¬ÙˆÙ',             color: '#a3e635', x: 140,   y: 80,    rx: 30, ry: 22 },
    northern: { name: 'Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø­Ø¯ÙˆØ¯ Ø§Ù„Ø´Ù…Ø§Ù„ÙŠØ©',  color: '#fb923c', x: 100,   y: 70,    rx: 28, ry: 20 },
    other:    { name: 'Ù…Ù†Ø§Ø·Ù‚ Ø£Ø®Ø±Ù‰',             color: '#64748b', x: 205,   y: 190,   rx: 30, ry: 22 }
  };

  /* â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function safeNdr(delivered, total) {
    total = Number(total || 0);
    return total > 0 ? Math.min(1, Math.max(0, Number(delivered || 0) / total)) : 0;
  }

  function safePct(part, total) {
    return total > 0 ? part / total : 0;
  }

  function callScoring(fn, stats, nat) {
    if (typeof window[fn] !== 'function') return 0;
    try {
      return nat !== undefined ? window[fn](stats, nat) : window[fn](stats);
    } catch (e) {
      console.warn('[GeoAggregator] Scoring fn ' + fn + ' failed:', e);
      return 0;
    }
  }

  /* â”€â”€ buildGeoProductMap(cityStats, productStats, nationalAverages) â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  window.buildGeoProductMap = function (cityStats, productStats, nationalAverages) {
    cityStats      = cityStats      || {};
    productStats   = productStats   || {};
    nationalAverages = nationalAverages || {};

    var T = typeof window.getDashboardThresholds === 'function'
      ? window.getDashboardThresholds()
      : { NDR_DANGER: 0.20, NDR_SAFE: 0.40, PREPAID_ADVANTAGE_THRESHOLD: 0.15, SCALING_MIN_ORDERS: 30 };

    /* â”€â”€ 1. Build geoProductMap (city Ã— product cells) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    var geoProductMap = {};

    Object.keys(cityStats).forEach(function (cityName) {
      var cs = cityStats[cityName];
      var productMap = cs.productMap || {};
      geoProductMap[cityName] = {};

      Object.keys(productMap).forEach(function (productKey) {
        var cp = productMap[productKey];

        var ndr = safeNdr(cp.delivered || 0, cp.ndrBaseOrders || cp.orders || 0);
        var dr = safeNdr(cp.delivered || 0, cp.activeOrders || 0);

        // COD vs prepaid NDR (approximate â€” derive from per-cell data if available)
        var hasPaymentOutcomeSplit =
          cp.prepaidDelivered !== undefined || cp.prepaidCanceled !== undefined ||
          cp.codDelivered !== undefined || cp.codCanceled !== undefined;
        var prepaidDelivered = hasPaymentOutcomeSplit
          ? (cp.prepaidDelivered || 0)
          : Math.round((cp.delivered || 0) * safePct(cp.prepaidCount || 0, cp.orders || 0));
        var prepaidCanceled = hasPaymentOutcomeSplit
          ? (cp.prepaidCanceled || 0)
          : Math.round((cp.canceled || 0) * safePct(cp.prepaidCount || 0, cp.orders || 0));
        var codDelivered = hasPaymentOutcomeSplit
          ? (cp.codDelivered || 0)
          : Math.max(0, (cp.delivered || 0) - prepaidDelivered);
        var codCanceled = hasPaymentOutcomeSplit
          ? (cp.codCanceled || 0)
          : Math.max(0, (cp.canceled || 0) - prepaidCanceled);

        var codNdrBase = cp.codNdrBaseOrders || cp.codCount || 0;
        var prepaidNdrBase = cp.prepaidNdrBaseOrders || cp.prepaidCount || 0;
        var codNdr    = safeNdr(codDelivered, codNdrBase);
        var prepaidNdr = safeNdr(prepaidDelivered, prepaidNdrBase);

        var prepaidPct = safePct(cp.prepaidCount || 0, cp.orders || 0);
        var codPct     = 1 - prepaidPct;

        // Active orders = placed - delivered - canceled
        var active = Math.max(0, (cp.orders || 0) - (cp.delivered || 0) - (cp.canceled || 0));

        // Scoring stats object shaped for scoring functions
        var scoringStats = {
          ndrPct:            ndr,
          drPct:             dr,
          count:             cp.orders || 0,
          deliveredOrders:   cp.delivered || 0,
          canceledCount:     cp.canceled || 0,
          failedCount:       cp.canceled || 0,
          codPct:            codPct,
          codNdr:            codNdr,
          prepaidPct:        prepaidPct,
          earnedCommission:  cp.commission || 0,
          totalRevenue:      cp.revenue    || 0,
          due:               cp.revenue    || 0,
          gap:               0
        };

        var riskScore           = callScoring('computeRiskScore',           scoringStats, undefined);
        var profitabilityScore  = callScoring('computeProfitabilityScore',  scoringStats, nationalAverages);
        var pipelineHealth      = callScoring('computePipelineHealth',      scoringStats, undefined);
        var scalingScore        = callScoring('computeScalingScore',        scoringStats, nationalAverages);

        var shouldForcePrepaid =
          (cp.codCount || 0) >= 10 &&
          (prepaidNdr - codNdr) > T.PREPAID_ADVANTAGE_THRESHOLD;

        geoProductMap[cityName][productKey] = {
          // Volume
          orders:    cp.orders    || 0,
          delivered: cp.delivered || 0,
          canceled:  cp.canceled  || 0,
          active:    active,

          // Rate metrics
          ndr:             parseFloat(ndr.toFixed(4)),
          dr:              parseFloat(dr.toFixed(4)),
          confirmationRate: 0,   // not tracked at cell level

          // Financial
          commission:            cp.commission || 0,
          revenue:               cp.revenue    || 0,
          avgOrderValue:         (cp.orders || 0) > 0 ? parseFloat(((cp.revenue || 0) / cp.orders).toFixed(2)) : 0,
          avgCommissionPerOrder: (cp.orders || 0) > 0 ? parseFloat(((cp.commission || 0) / cp.orders).toFixed(2)) : 0,

          // Payment
          prepaidCount:  cp.prepaidCount || 0,
          codCount:      cp.codCount     || 0,
          prepaidNdrBaseOrders: prepaidNdrBase,
          codNdrBaseOrders: codNdrBase,
          prepaidDelivered: prepaidDelivered,
          prepaidCanceled:  prepaidCanceled,
          codDelivered:     codDelivered,
          codCanceled:      codCanceled,
          prepaidPct:    parseFloat(prepaidPct.toFixed(4)),
          codPct:        parseFloat(codPct.toFixed(4)),
          prepaidNdr:    parseFloat(prepaidNdr.toFixed(4)),
          codNdr:        parseFloat(codNdr.toFixed(4)),

          // Scores
          profitabilityScore: profitabilityScore,
          riskScore:          riskScore,
          pipelineHealth:     pipelineHealth,
          scalingScore:       scalingScore,

          // Intelligence flags
          isDangerous:      ndr < T.NDR_DANGER,
          isScalable:       (cp.delivered || 0) >= T.SCALING_MIN_ORDERS && ndr >= T.NDR_SAFE,
          shouldForcePrepaid: shouldForcePrepaid,
          isBestInCity:     false   // resolved in pass below
        };
      });
    });

    /* â”€â”€ Mark isBestInCity per city â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    Object.keys(geoProductMap).forEach(function (city) {
      var cells = geoProductMap[city];
      var bestKey = null, bestComm = -1;
      Object.keys(cells).forEach(function (pk) {
        if ((cells[pk].commission || 0) > bestComm) {
          bestComm = cells[pk].commission;
          bestKey  = pk;
        }
      });
      if (bestKey) cells[bestKey].isBestInCity = true;
    });

    /* â”€â”€ 2. Build provinceMap (province-level roll-up from cityStats) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    var provinceMap = {};

    // Init all provinces
    Object.keys(PROVINCE_META).forEach(function (pid) {
      var meta = PROVINCE_META[pid];
      provinceMap[pid] = {
        id: pid, name: meta.name, color: meta.color, x: meta.x, y: meta.y, rx: meta.rx, ry: meta.ry,
        totalOrders:    0, totalDelivered: 0, totalCanceled: 0,
        totalRevenue:   0, totalCommission: 0,
        drBaseOrders:   0, drDeliveredOrders: 0,
        prepaidCount:   0, codCount: 0,
        prepaidDrBaseOrders: 0, prepaidDrDeliveredOrders: 0,
        codDrBaseOrders: 0, codDrDeliveredOrders: 0,
        canceledCount:  0,
        cities:         [],
        productMap:     {}
      };
    });

    // Roll-up cities into their province
    Object.keys(cityStats).forEach(function (cityName) {
      var cs   = cityStats[cityName];
      var pid  = cs.provinceId || 'other';
      var prov = provinceMap[pid] || provinceMap['other'];

      prov.cities.push(cityName);
      prov.totalOrders      += cs.count        || 0;
      prov.totalDelivered   += cs.deliveredOrders || 0;
      prov.totalCanceled    += cs.canceledCount   || 0;
      prov.totalRevenue     += cs.totalRevenue    || 0;
      prov.totalCommission  += cs.earnedCommission || 0;
      prov.drBaseOrders     += cs.drBaseOrders     || 0;
      prov.drDeliveredOrders += cs.drDeliveredOrders || cs.deliveredOrders || 0;
      prov.prepaidCount     += cs.prepaidCount     || 0;
      prov.codCount         += cs.codCount         || 0;
      prov.prepaidDrBaseOrders += cs.prepaidDrBaseOrders || 0;
      prov.prepaidDrDeliveredOrders += cs.prepaidDrDeliveredOrders || 0;
      prov.codDrBaseOrders += cs.codDrBaseOrders || 0;
      prov.codDrDeliveredOrders += cs.codDrDeliveredOrders || 0;
      prov.canceledCount    += cs.canceledCount    || 0;

      // Roll-up city productMap into province productMap
      Object.keys(cs.productMap || {}).forEach(function (pk) {
        var cp = cs.productMap[pk];
        if (!prov.productMap[pk]) {
          prov.productMap[pk] = { orders: 0, delivered: 0, canceled: 0, ndr: 0, commission: 0 };
        }
        prov.productMap[pk].orders    += cp.orders    || 0;
        prov.productMap[pk].delivered += cp.delivered || 0;
        prov.productMap[pk].canceled  += cp.canceled  || 0;
        prov.productMap[pk].commission+= cp.commission|| 0;
      });
    });

    // Compute derived province rates + scores after roll-up
    Object.keys(provinceMap).forEach(function (pid) {
      var p = provinceMap[pid];
      if (p.totalOrders === 0) return;

      p.ndrPct     = parseFloat(safeNdr(p.totalDelivered, p.totalOrders).toFixed(4));
      p.drPct      = p.drBaseOrders > 0 ? parseFloat((p.drDeliveredOrders / p.drBaseOrders).toFixed(4)) : 0;
      p.prepaidPct = safePct(p.prepaidCount, p.totalOrders);
      p.codPct     = 1 - p.prepaidPct;

      // Compute NDR per product in province
      Object.keys(p.productMap).forEach(function (pk) {
        var pp = p.productMap[pk];
        pp.ndr = parseFloat(safeNdr(pp.delivered, pp.orders).toFixed(4));
      });

      // Province scoring
      var provinceStats = {
        ndrPct:          p.ndrPct,
        drPct:           p.drPct,
        count:           p.totalOrders,
        deliveredOrders: p.totalDelivered,
        canceledCount:   p.totalCanceled,
        failedCount:     p.totalCanceled,
        codPct:          p.codPct,
        prepaidPct:      p.prepaidPct,
        earnedCommission: p.totalCommission,
        totalRevenue:    p.totalRevenue,
        due:             p.totalRevenue,
        gap:             0
      };
      p.riskScore          = callScoring('computeRiskScore',          provinceStats, undefined);
      p.scalingScore       = callScoring('computeScalingScore',       provinceStats, nationalAverages);
      p.profitabilityScore = callScoring('computeProfitabilityScore', provinceStats, nationalAverages);

      // Best / worst city within this province
      var bestScaling  = -1, worstRisk = -1;
      p.bestCity  = null;
      p.worstCity = null;
      p.cities.forEach(function (cName) {
        var cs = cityStats[cName];
        if (!cs) return;
        var csStats = {
          ndrPct: cs.ndrPct || 0, drPct: cs.drPct || 0,
          count: cs.count, deliveredOrders: cs.deliveredOrders,
          canceledCount: cs.canceledCount, failedCount: cs.canceledCount,
          codPct: cs.codPct || 0, prepaidPct: cs.prepaidPct || 0,
          earnedCommission: cs.earnedCommission || 0, totalRevenue: cs.totalRevenue || 0,
          due: cs.due || 0, gap: cs.gap || 0
        };
        var sc = callScoring('computeScalingScore', csStats, nationalAverages);
        var rs = callScoring('computeRiskScore',    csStats, undefined);
        cs.scalingScore = sc;
        cs.riskScore = rs;
        if (sc > bestScaling) { bestScaling = sc; p.bestCity = cName; }
        if (rs > worstRisk)   { worstRisk   = rs; p.worstCity = cName; }
      });
    });

    /* â”€â”€ 3. Build prepaidIntelligence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    var prepaidIntelligence = _buildPrepaidIntelligence(cityStats, geoProductMap, nationalAverages, T);

    return {
      geoProductMap:       geoProductMap,
      provinceMap:         provinceMap,
      prepaidIntelligence: prepaidIntelligence
    };
  };

  /* â”€â”€ buildPrepaidIntelligence (internal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function _buildPrepaidIntelligence(cityStats, geoProductMap, nationalAverages, T) {
    var totalOrders = 0, totalPrepaid = 0, totalCod = 0;
    var totalPrepaidNdrBase = 0, totalCodNdrBase = 0;
    var prepaidDelivered = 0, prepaidCanceled = 0;
    var codDelivered = 0, codCanceled = 0;
    var prepaidDrBase = 0, prepaidDrDelivered = 0;
    var codDrBase = 0, codDrDelivered = 0;

    var cityPrepaidList = [];
    var codHeavyCities  = [];

    Object.keys(cityStats).forEach(function (cityName) {
      var cs = cityStats[cityName];
      totalOrders  += cs.count        || 0;
      totalPrepaid += cs.prepaidCount || 0;
      totalCod     += cs.codCount     || 0;
      totalPrepaidNdrBase += cs.prepaidNdrBaseOrders || cs.prepaidCount || 0;
      totalCodNdrBase += cs.codNdrBaseOrders || cs.codCount || 0;
      prepaidDelivered += cs.prepaidDeliveredCount || 0;
      codDelivered     += cs.codDeliveredCount     || 0;
      prepaidDrBase += cs.prepaidDrBaseOrders || 0;
      prepaidDrDelivered += cs.prepaidDrDeliveredOrders || 0;
      codDrBase += cs.codDrBaseOrders || 0;
      codDrDelivered += cs.codDrDeliveredOrders || 0;

      var cityCanceled = cs.canceledCount || 0;
      var hasCityPaymentOutcomeSplit =
        cs.prepaidCanceledCount !== undefined || cs.codCanceledCount !== undefined;
      var cityPrepaidCanceled = hasCityPaymentOutcomeSplit
        ? (cs.prepaidCanceledCount || 0)
        : (cs.prepaidCount > 0 ? Math.round(cityCanceled * safePct(cs.prepaidCount, cs.count)) : 0);
      var cityCodCanceled = hasCityPaymentOutcomeSplit
        ? (cs.codCanceledCount || 0)
        : (cityCanceled - cityPrepaidCanceled);
      prepaidCanceled += cityPrepaidCanceled;
      codCanceled     += cityCodCanceled;

      var prep = safePct(cs.prepaidCount || 0, cs.count || 0);
      var cityNdr = safeNdr(cs.deliveredOrders || 0, cs.ndrBaseOrders || cs.count || 0);
      if ((cs.count || 0) >= 10) {
        cityPrepaidList.push({ city: cityName, prepaidPct: prep, orders: cs.count, ndr: cityNdr });
      }

      // COD-heavy and dangerous
      var codPct  = safePct(cs.codCount || 0, cs.count || 0);
      if (codPct > T.COD_HEAVY_THRESHOLD && cityNdr < T.NDR_DANGER && (cs.count || 0) >= 15) {
        codHeavyCities.push({
          city: cityName, codPct: codPct, codNdr: cityNdr,
          riskLevel: 'critical'
        });
      }
    });

    var globalPrepaidNdr = safeNdr(prepaidDelivered, totalPrepaidNdrBase);
    var globalCodNdr     = safeNdr(codDelivered, totalCodNdrBase);
    var globalPrepaidDr  = safeNdr(prepaidDrDelivered, prepaidDrBase);
    var globalCodDr      = safeNdr(codDrDelivered, codDrBase);

    // Force-prepaid recommendations from geoProductMap cells
    var forcePrepaidRecs = [];
    var codDangerousCombos = [];
    Object.keys(geoProductMap).forEach(function (city) {
      Object.keys(geoProductMap[city]).forEach(function (product) {
        var cell = geoProductMap[city][product];
        if (cell.shouldForcePrepaid) {
          forcePrepaidRecs.push({
            city: city,
            product: product,
            codNdr: cell.codNdr,
            prepaidNdr: cell.prepaidNdr,
            reason: 'COD NDR ' + Math.round(cell.codNdr * 100) + '% vs Prepaid NDR ' + Math.round(cell.prepaidNdr * 100) + '%'
          });
        }
        if (cell.codNdr < T.NDR_DANGER && (cell.codCount || 0) >= 10) {
          codDangerousCombos.push({
            city: city, product: product,
            codNdr: cell.codNdr, prepaidNdr: cell.prepaidNdr,
            recommendation: cell.prepaidNdr >= T.NDR_SAFE
              ? 'ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø³Ø¨Ù‚ ÙÙˆØ±Ø§Ù‹'
              : 'Ù…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ø­Ù…Ù„Ø© ÙÙŠ Ù‡Ø°Ù‡ Ø§Ù„Ù…Ø¯ÙŠÙ†Ø©'
          });
        }
      });
    });

    // Sort city lists
    var sortedDesc = cityPrepaidList.slice().sort(function (a, b) { return b.prepaidPct - a.prepaidPct; });
    var sortedAsc  = cityPrepaidList.slice().sort(function (a, b) { return a.prepaidPct - b.prepaidPct; });

    return {
      globalPrepaidPct:   safePct(totalPrepaid, totalOrders),
      globalCodPct:       safePct(totalCod, totalOrders),
      prepaidNdr:         globalPrepaidNdr,
      codNdr:             globalCodNdr,
      prepaidNdrBaseOrders: totalPrepaidNdrBase,
      codNdrBaseOrders: totalCodNdrBase,
      globalPrepaidDr:    globalPrepaidDr,
      globalCodDr:        globalCodDr,
      prepaidDr:          globalPrepaidDr,
      codDr:              globalCodDr,
      prepaidNdrAdvantage: globalPrepaidNdr - globalCodNdr,
      prepaidDrAdvantage: globalPrepaidDr - globalCodDr,
      highestPrepaidCities:  sortedDesc.slice(0, 5),
      lowestPrepaidCities:   sortedAsc.slice(0, 5),
      codHeavyCities:        codHeavyCities,
      codDangerousCombos:    codDangerousCombos,
      forcePrepaidRecs:      forcePrepaidRecs
    };
  }

})();
