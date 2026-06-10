(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DashboardOrdersQueryCore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var ALL_ACCOUNTS = "__all__";

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function lower(value) {
    return text(value).toLowerCase();
  }

  function number(value) {
    if (typeof value === "number") return isFinite(value) ? value : 0;
    var parsed = Number(String(value == null ? "" : value).replace(/[^0-9.-]/g, ""));
    return isFinite(parsed) ? parsed : 0;
  }

  function normalizeDateKey(value) {
    if (!value) return "";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    var parsed = new Date(value);
    return isNaN(parsed.getTime()) ? text(value) : parsed.toISOString().slice(0, 10);
  }

  function getStatusBucket(status) {
    var s = lower(status);
    if (!s) return "other";
    if (s === "delivered" || s === "مسلمة") return "delivered";
    if (s === "in shipping" || s === "shipping" || s === "في الشحن" || s === "تم الشحن") return "shipping";
    if (s === "failed" || s === "canceled" || s === "cancelled" || s === "ملغى" || s === "ملغي" || s === "مرتجع" || s === "فشلت") return "failed";
    if (s === "canceled_by_you") return "canceled_by_you";
    if (s === "awaiting confirmation" || s === "pending" || s === "بانتظار التأكيد") return "pending";
    if (s === "confirmed" || s === "مؤكد") return "confirmed";
    if (s === "under processing" || s === "processing" || s === "قيد المعالجة") return "processing";
    if (s === "waiting" || s === "قيد الانتظار" || s === "بانتظار الشحن") return "waiting";
    return "other";
  }

  function isRowCreatedInPeriod(row, period) {
    if (!period || !period.dateFrom || !period.dateTo) return true;
    var key = normalizeDateKey(row && (row.createdAt || row.date || row.dashboardDate));
    return !!key && key >= period.dateFrom && key <= period.dateTo;
  }

  function isRowUpdatedInPeriod(row, period) {
    if (!period || !period.dateFrom || !period.dateTo) return true;
    var key = normalizeDateKey(row && (row.lastUpdatedAt || row.updatedAt || row.dashboardDate));
    return !!key && key >= period.dateFrom && key <= period.dateTo;
  }

  function isDeliveredRowInPeriod(row, period, mode) {
    if (getStatusBucket(row && (row.orderStatus || row.status)) !== "delivered") return false;
    return mode === "createdAt" ? isRowCreatedInPeriod(row, period) : isRowUpdatedInPeriod(row, period);
  }

  function filterRowsByPeriod(rows, period, mode) {
    if (!period || !period.dateFrom || !period.dateTo) return (rows || []).slice();
    mode = mode === "createdAt" ? "createdAt" : "updatedAt";
    return (rows || []).filter(function (row) {
      var bucket = getStatusBucket(row && (row.orderStatus || row.status));
      return isRowCreatedInPeriod(row, period) || (bucket === "delivered" && isDeliveredRowInPeriod(row, period, mode));
    });
  }

  function filterCreatedOrders(rows, period) {
    if (!period || !period.dateFrom || !period.dateTo) return (rows || []).slice();
    return (rows || []).filter(function (row) { return isRowCreatedInPeriod(row, period); });
  }

  function filterOutcomeOrders(rows, period, mode) {
    if (!period || !period.dateFrom || !period.dateTo) return (rows || []).slice();
    mode = mode === "createdAt" ? "createdAt" : "updatedAt";
    return (rows || []).filter(function (row) {
      var bucket = getStatusBucket(row && (row.orderStatus || row.status));
      return bucket === "delivered" ? isDeliveredRowInPeriod(row, period, mode) : isRowCreatedInPeriod(row, period);
    });
  }

  function normalizedQty(row) {
    var qty = number(row && row.qty);
    return qty > 0 ? String(qty) : "1";
  }

  function amountLookupKey(row) {
    var sku = text(row && row.sku);
    return sku ? sku + "|" + normalizedQty(row) : "";
  }

  function hasMissingAmountDue(row) {
    if (row && Object.prototype.hasOwnProperty.call(row, "amountDueMissing")) return !!row.amountDueMissing;
    if (row && Object.prototype.hasOwnProperty.call(row, "amountDueRaw")) return !text(row.amountDueRaw);
    return number(row && row.amountDue) <= 0;
  }

  function hasMissingTotalPrice(row) {
    return number(row && row.totalPrice) <= 0;
  }

  function buildModeLookup(rows, field) {
    var samplesByKey = {};
    (rows || []).forEach(function (row) {
      var amount = number(row && row[field]);
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
      lookup[key] = { amount: mode, referenceCount: samples.length, modeCount: modeCount, distinctAmountCount: Object.keys(freq).length };
    });
    return lookup;
  }

  function repairDisplayRows(rows, period, deliveredDateMode) {
    var source = (rows || []).slice();
    var amountDueLookup = buildModeLookup(source, "amountDue");
    var totalPriceLookup = buildModeLookup(source, "totalPrice");
    return filterRowsByPeriod(source, period, deliveredDateMode).map(function (row) {
      var dueVal = number(row && row.amountDue);
      var priceVal = number(row && row.totalPrice);
      var key = amountLookupKey(row);
      if (getStatusBucket(row && (row.orderStatus || row.status)) === "delivered" && hasMissingAmountDue(row)) {
        if (amountDueLookup[key] && amountDueLookup[key].amount > 0) dueVal = amountDueLookup[key].amount;
        else dueVal = 0;
      }
      if (hasMissingTotalPrice(row)) {
        if (totalPriceLookup[key] && totalPriceLookup[key].amount > 0) priceVal = totalPriceLookup[key].amount;
        else priceVal = 0;
      }
      return Object.assign({}, row, {
        dashboardTotalPrice: priceVal,
        dashboardAmountDue: dueVal,
      });
    });
  }

  function orderIdentity(row, index) {
    var accountId = text(row && (row.accountId || row.dashboardAccountId || row.account || ""));
    var direct = text(row && (row.khodOrderNumber || row.easyOrderNumber || row.taagerOrderNumber || row.orderNumber || row.orderId || row.id || row.reference || ""));
    return accountId + "|" + (direct || ("row:" + index));
  }

  function orderDateTime(row) {
    var raw = row && (row.createdAt || row.date);
    var d = raw ? new Date(raw) : null;
    return d && !isNaN(d.getTime()) ? d.getTime() : 0;
  }

  function compareOrders(a, b, sortVal) {
    sortVal = sortVal || "date_desc";
    function byString(field) {
      var av = text(a && a[field]);
      var bv = text(b && b[field]);
      return sortVal.slice(-4) === "_asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    function byNumber(getter) {
      var av = number(getter(a));
      var bv = number(getter(b));
      return sortVal.slice(-4) === "_asc" ? av - bv : bv - av;
    }
    if (sortVal.indexOf("date_") === 0) return byNumber(orderDateTime);
    if (sortVal.indexOf("total_") === 0) return byNumber(function (row) { return row && (row.dashboardTotalPrice != null ? row.dashboardTotalPrice : row.totalPrice); });
    if (sortVal.indexOf("commission_") === 0) return byNumber(function (row) { return row && (row.marketerCommission != null ? row.marketerCommission : row.commission); });
    if (sortVal.indexOf("id_") === 0) return byString("id");
    if (sortVal.indexOf("customer_") === 0) return byString("customerName");
    if (sortVal.indexOf("city_") === 0) return byString("city");
    if (sortVal.indexOf("product_") === 0) return byString("products");
    if (sortVal.indexOf("status_") === 0) return byString("orderStatus");
    return 0;
  }

  function statusBreakdown(rows) {
    return (rows || []).reduce(function (out, row) {
      var bucket = getStatusBucket(row && (row.orderStatus || row.status));
      out[bucket] = (out[bucket] || 0) + 1;
      return out;
    }, {});
  }

  function summarizeRows(rows) {
    var summary = {
      rawOrderCount: (rows || []).length,
      netOrderCount: 0,
      statusBreakdown: statusBreakdown(rows),
      totalValue: 0,
      totalProfit: 0,
      accountBreakdown: {},
    };
    (rows || []).forEach(function (row) {
      var bucket = getStatusBucket(row && (row.orderStatus || row.status));
      if (bucket !== "canceled_by_you") summary.netOrderCount++;
      var value = number(row && (row.dashboardTotalPrice != null ? row.dashboardTotalPrice : row.totalPrice));
      var profit = number(row && (row.marketerCommission != null ? row.marketerCommission : row.commission));
      var accountId = text(row && row.accountId) || "__unknown__";
      summary.totalValue += value;
      summary.totalProfit += profit;
      if (!summary.accountBreakdown[accountId]) {
        summary.accountBreakdown[accountId] = { accountId: accountId, count: 0, totalValue: 0, totalProfit: 0 };
      }
      summary.accountBreakdown[accountId].count++;
      summary.accountBreakdown[accountId].totalValue += value;
      summary.accountBreakdown[accountId].totalProfit += profit;
    });
    summary.accountBreakdown = Object.keys(summary.accountBreakdown).sort().map(function (key) {
      return summary.accountBreakdown[key];
    });
    return summary;
  }

  function pageRows(rows, page, pageSize, sortVal) {
    var sorted = (rows || []).slice().sort(function (a, b) { return compareOrders(a, b, sortVal || "date_desc"); });
    var safePageSize = Math.max(1, Math.min(1000, Number(pageSize || sorted.length || 1)));
    var safePage = Math.max(1, Number(page || 1));
    var start = (safePage - 1) * safePageSize;
    return {
      page: safePage,
      pageSize: safePageSize,
      total: sorted.length,
      totalPages: Math.max(1, Math.ceil(sorted.length / safePageSize)),
      rows: sorted.slice(start, start + safePageSize),
      allRows: sorted,
    };
  }

  function createOrdersResult(input) {
    input = input || {};
    var rows = Array.isArray(input.rows) ? input.rows : [];
    var period = input.period || {};
    var mode = input.deliveredDateMode === "createdAt" ? "createdAt" : "updatedAt";
    var displayRows = repairDisplayRows(rows, period, mode);
    var createdRows = filterCreatedOrders(displayRows, period);
    var outcomeRows = filterOutcomeOrders(displayRows, period, mode);
    var sortVal = input.sortVal || "date_desc";
    var createdPage = pageRows(createdRows, input.page || 1, input.pageSize || createdRows.length || 1, sortVal);
    var outcomePage = pageRows(outcomeRows, input.page || 1, input.pageSize || outcomeRows.length || 1, sortVal);

    return {
      ok: true,
      kind: "orders",
      accountScope: {
        activeAccountId: input.activeAccountId || ALL_ACCOUNTS,
        accountIds: (input.accountIds || []).slice(),
      },
      period: {
        dateFrom: period.dateFrom || "",
        dateTo: period.dateTo || "",
        deliveredDateMode: mode,
      },
      orders: createdPage.allRows,
      outcomeOrders: outcomePage.allRows,
      rows: createdPage.rows,
      pagination: {
        page: createdPage.page,
        pageSize: createdPage.pageSize,
        total: createdPage.total,
        totalPages: createdPage.totalPages,
      },
      exportRows: createdPage.allRows,
      summary: summarizeRows(createdRows),
      outcomeSummary: summarizeRows(outcomeRows),
    };
  }

  return {
    createOrdersResult: createOrdersResult,
    getStatusBucket: getStatusBucket,
    orderIdentity: orderIdentity,
    summarizeRows: summarizeRows,
    pageRows: pageRows,
    filterRowsByPeriod: filterRowsByPeriod,
    filterCreatedOrders: filterCreatedOrders,
    filterOutcomeOrders: filterOutcomeOrders,
    repairDisplayRows: repairDisplayRows,
  };
});
