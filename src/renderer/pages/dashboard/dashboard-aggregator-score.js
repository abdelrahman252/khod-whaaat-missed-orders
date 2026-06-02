/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   dashboard-aggregator-score.js  (T-14)
   Pure scoring functions â€” no side effects, no DOM, no global state.
   All return a rounded integer 0â€“100.

   Exposed on window:
     computeRiskScore(stats)
     computeScalingScore(stats, nationalAverages)
     computeProfitabilityScore(stats, nationalAverages)
     computePipelineHealth(stats)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
(function () {
  'use strict';

  /* â”€â”€ computeRiskScore(stats) â†’ 0â€“100 (100 = most dangerous) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     Composite:
              50% - NDR component   (0 at >=40%, 100 at <20%)
       30% â€” COD component   (high COD% Ã— high COD NDR)
       20% â€” Gap component   (unpaid COD gap / total due)
  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  window.computeRiskScore = function (stats) {
    if (!stats) return 0;

    var ndr = Number(stats.ndrPct) > 1
      ? Number(stats.ndrPct) / 100          // already a percentage
      : Number(stats.ndrPct) || 0;          // already a fraction
    if (ndr > 1) ndr = ndr / 100;
    var ndrComponent = ndr >= 0.40
      ? 0
      : (ndr < 0.20 ? 100 : Math.round(((0.40 - ndr) / 0.20) * 100));

    // COD component: codPct (fraction) Ã— codNdr (fraction) Ã— 150
    var codPct = Number(stats.codPct) || 0;
    if (codPct > 1) codPct = codPct / 100;
    // codNdr: derive from codDeliveredCount / codCount if not stored directly
    var codNdr = 0;
    if (stats.codNdr !== undefined) {
      codNdr = Number(stats.codNdr);
      if (codNdr > 1) codNdr = codNdr / 100;
    } else if (stats.codCount > 0) {
      codNdr = ndr;
    }
    var codNdrRisk = codNdr >= 0.40
      ? 0
      : (codNdr < 0.20 ? 100 : Math.round(((0.40 - codNdr) / 0.20) * 100));
    var codComponent = Math.min(100, codPct * codNdrRisk);

    // Gap component: gap / due (fraction of uncollected revenue)
    var due = Number(stats.due) || 0;
    var gap = Number(stats.gap) || 0;
    var gapComponent = due > 0 ? Math.min(100, (gap / due) * 100) : 0;

    var riskScore = (ndrComponent * 0.5) + (codComponent * 0.3) + (gapComponent * 0.2);
    return Math.round(Math.min(100, Math.max(0, riskScore)));
  };

  /* â”€â”€ computeScalingScore(stats, nationalAverages) â†’ 0â€“100 (100 = best to scale)
     Composite:
       50% â€” DR ratio vs national average (capped at 2Ã—)
       20% â€” Volume score (capped at 200 orders)
       20% â€” Prepaid adoption bonus
       10% â€” Consistency (inverse of NDR stddev if available)
  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  window.computeScalingScore = function (stats, nationalAverages) {
    if (!stats) return 0;
    var nat = nationalAverages || {};

    var drPct = Number(stats.drPct) || 0;
    if (drPct > 1) drPct = drPct / 100;
    var nationalDr = Number(nat.dr) || 0.30;        // fallback to healthy baseline if unknown
    if (nationalDr > 1) nationalDr = nationalDr / 100;

    // DR ratio: capped at 2Ã— national average â†’ maps to 0â€“50
    var drRatio   = nationalDr > 0 ? Math.min(2, drPct / nationalDr) : 0;
    var drScore   = drRatio * 50;

    // Volume score: 0â€“20 (saturates at 200 orders)
    var count       = Number(stats.count) || Number(stats.orders) || 0;
    var volumeScore = Math.min(1, count / 200) * 20;

    // Prepaid bonus: 0â€“20 (higher prepaid adoption = easier to scale)
    var prepaidPct = Number(stats.prepaidPct) || 0;
    if (prepaidPct > 1) prepaidPct = prepaidPct / 100;
    var prepaidBonus = prepaidPct * 20;

    // Consistency: uses ndrStddev if provided, otherwise max score
    var stddev          = Number(stats.ndrStddev) || 0;
    var consistencyScore = (1 - Math.min(1, stddev)) * 10;

    var scalingScore = drScore + volumeScore + prepaidBonus + consistencyScore;
    return Math.round(Math.min(100, Math.max(0, scalingScore)));
  };

  /* â”€â”€ computeProfitabilityScore(stats, nationalAverages) â†’ 0â€“100 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     Composite:
       60% â€” Commission ratio vs expected (earned / (count Ã— avgCommission))
       40% â€” Revenue efficiency (earnedCommission / totalRevenue)
     Both sub-scores normalised to 0â€“100 before weighting.
  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  window.computeProfitabilityScore = function (stats, nationalAverages) {
    if (!stats) return 0;
    var nat = nationalAverages || {};

    var earnedComm   = Number(stats.earnedCommission) || Number(stats.commission) || 0;
    var count        = Number(stats.count) || Number(stats.orders) || Number(stats.placedCount) || 1;
    var avgComm      = Number(nat.avgCommission) || 1;
    var totalRevenue = Number(stats.totalRevenue) || Number(stats.revenue) || 0;

    // Commission ratio: how much was earned vs what could have been earned if all delivered at average
    var commissionRatio  = Math.min(2, earnedComm / Math.max(1, count * avgComm));
    var commissionScore  = commissionRatio * 50;   // 0â€“100, then Ã—60% weight

    // Revenue efficiency: what fraction of total potential revenue became earned commission
    var revenueEfficiency = totalRevenue > 0
      ? Math.min(1, earnedComm / totalRevenue)
      : 0;
    var revenueScore = revenueEfficiency * 100;    // 0â€“100, then Ã—40% weight

    var profScore = (commissionScore * 0.6) + (revenueScore * 0.4);
    return Math.round(Math.min(100, Math.max(0, profScore)));
  };

  /* â”€â”€ computePipelineHealth(stats) â†’ 0â€“100 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     Measures the quality of the active order pipeline.
     Good orders (delivered + confirmed + shipping + processing) contribute positively.
     Bad orders (canceled Ã— 2 + failed Ã— 1.5) reduce the score.
  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  window.computePipelineHealth = function (stats) {
    if (!stats) return 0;

    var total = Number(stats.count) || Number(stats.placedCount) || 0;
    if (total === 0) return 0;

    var delivered   = Number(stats.deliveredOrders)  || Number(stats.deliveredCount)  || 0;
    var confirmed   = Number(stats.confirmedCount)   || 0;
    var shipping    = Number(stats.shippingCount)    || 0;
    var processing  = Number(stats.processingCount)  || 0;
    var canceled    = Number(stats.canceledCount)    || Number(stats.failedCount)      || 0;
    var failed      = Number(stats.failedCount)      || canceled;

    var goodOrders = delivered + confirmed + shipping + processing;
    var badOrders  = (canceled * 2) + (failed * 1.5);

    // Clamp: bad orders can't exceed total (double-counting guard)
    badOrders = Math.min(badOrders, total * 2);

    var health = Math.max(0, ((goodOrders - badOrders) / total) * 100);
    return Math.round(Math.min(100, health));
  };

})();
