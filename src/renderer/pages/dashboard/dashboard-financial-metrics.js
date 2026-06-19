(function () {
  'use strict';

  function finiteNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  window.KhodFinancialMetrics = Object.freeze({
    averageCommission: function (deliveredCommission, deliveredOrders) {
      var commission = finiteNumber(deliveredCommission);
      var delivered = finiteNumber(deliveredOrders);
      if (delivered <= 0) return 0;
      var average = commission / delivered;
      return Number.isFinite(average) ? average : 0;
    }
  });
})();
