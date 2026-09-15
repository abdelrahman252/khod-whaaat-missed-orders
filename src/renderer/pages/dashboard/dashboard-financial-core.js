(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KhodDashboardFinancialCore = api;
  if (root) root.TaagerDashboardFinancialCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function number(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    var parsed = Number(String(value == null ? "" : value).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function nonNegative(value) {
    return Math.max(0, number(value));
  }

  function rate(value) {
    return Math.max(0, Math.min(1, number(value)));
  }

  function divide(numerator, denominator) {
    var bottom = number(denominator);
    return bottom > 0 ? number(numerator) / bottom : 0;
  }

  function resolveExpectedRate(specificDelivered, specificBase, globalDelivered, globalBase) {
    var localBase = nonNegative(specificBase);
    var fallbackBase = nonNegative(globalBase);
    if (localBase > 0) {
      return {
        rate: rate(divide(specificDelivered, localBase)),
        source: "specific",
        insufficientHistory: false,
      };
    }
    if (fallbackBase > 0) {
      return {
        rate: rate(divide(globalDelivered, fallbackBase)),
        source: "global_fallback",
        insufficientHistory: false,
      };
    }
    return { rate: 0, source: "insufficient_history", insufficientHistory: true };
  }

  function calculate(input) {
    input = input || {};
    var netOrders = nonNegative(input.netOrders);
    var actualDeliveredOrders = nonNegative(input.actualDeliveredOrders);
    var actualEarnedCommission = number(
      input.actualEarnedCommission != null
        ? input.actualEarnedCommission
        : input.actualEarnedProfitAfterTax
    );
    var currentTotalSales = nonNegative(input.currentTotalSales);
    var adSpend = nonNegative(input.adSpend);
    var expectedNdrRate = rate(input.expectedNdrRate);

    var averageCommission = divide(actualEarnedCommission, actualDeliveredOrders);
    var actualNetProfit = actualEarnedCommission - adSpend;
    var actualDeliveredSales = nonNegative(input.actualDeliveredSales);
    var expectedDeliveriesExact = netOrders * expectedNdrRate;
    var expectedDeliveriesDisplay = Math.round(expectedDeliveriesExact);
    var expectedCommissionBeforeAdSpend = expectedDeliveriesExact * averageCommission;
    var expectedNetProfit = expectedCommissionBeforeAdSpend - adSpend;
    var expectedDeliveredSales = currentTotalSales * expectedNdrRate;
    var mode = input.mode === "expected" ? "expected" : "actual";

    return {
      mode: mode,
      netOrders: netOrders,
      expectedNdrRate: expectedNdrRate,
      insufficientHistory: !!input.insufficientHistory,
      averageCommission: averageCommission,
      averageProfit: averageCommission,
      cpa: divide(adSpend, netOrders),
      breakEvenCpa: averageCommission * expectedNdrRate,
      aov: divide(currentTotalSales, netOrders),

      actualDeliveredOrders: actualDeliveredOrders,
      actualEarnedCommission: actualEarnedCommission,
      actualCommissionReturn: actualEarnedCommission,
      actualEarnedProfitAfterTax: actualEarnedCommission,
      actualNetProfit: actualNetProfit,
      actualDeliveredSales: actualDeliveredSales,
      actualDeliveredCpa: divide(adSpend, actualDeliveredOrders),
      actualCommissionRoas: divide(actualEarnedCommission, adSpend),
      actualProfitRoas: divide(actualEarnedCommission, adSpend),
      actualRoi: divide(actualNetProfit, adSpend) * 100,
      actualSalesRoas: divide(actualDeliveredSales, adSpend),

      expectedDeliveriesExact: expectedDeliveriesExact,
      expectedDeliveriesDisplay: expectedDeliveriesDisplay,
      expectedCommission: expectedCommissionBeforeAdSpend,
      expectedCommissionBeforeAdSpend: expectedCommissionBeforeAdSpend,
      expectedTotalProfitBeforeAdSpend: expectedCommissionBeforeAdSpend,
      expectedNetProfit: expectedNetProfit,
      expectedDeliveredCpa: divide(adSpend, expectedDeliveriesExact),
      expectedCommissionRoas: divide(expectedCommissionBeforeAdSpend, adSpend),
      expectedProfitRoas: divide(expectedCommissionBeforeAdSpend, adSpend),
      expectedRoi: divide(expectedNetProfit, adSpend) * 100,
      expectedDeliveredSales: expectedDeliveredSales,
      expectedSalesRoas: divide(expectedDeliveredSales, adSpend),
      expectedDeliveredAov: divide(expectedDeliveredSales, expectedDeliveriesExact),

      displayedDeliveredOrders: mode === "expected" ? expectedDeliveriesDisplay : actualDeliveredOrders,
      displayedCommissionBeforeAdSpend: mode === "expected" ? expectedCommissionBeforeAdSpend : actualEarnedCommission,
      displayedTotalProfitBeforeAdSpend: mode === "expected" ? expectedCommissionBeforeAdSpend : actualEarnedCommission,
      displayedNetProfit: mode === "expected" ? expectedNetProfit : actualNetProfit,
      displayedDeliveredSales: mode === "expected" ? expectedDeliveredSales : actualDeliveredSales,
    };
  }

  return {
    calculate: calculate,
    divide: divide,
    number: number,
    rate: rate,
    resolveExpectedRate: resolveExpectedRate,
  };
});
