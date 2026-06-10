(function () {
  "use strict";

  var flagsPromise = null;
  var cachedFlags = null;
  var latestResults = {};
  var shadowComparators = {};
  var implementedSections = {};

  function defaultFlags() {
    return {
      shadow: false,
      orders: false,
      products: false,
      campaigns: false,
      marketingIncrementalSync: false,
    };
  }

  function loadFlags() {
    if (flagsPromise) return flagsPromise;
    if (!window.api || typeof window.api.getDashboardQueryFlags !== "function") {
      cachedFlags = defaultFlags();
      flagsPromise = Promise.resolve(cachedFlags);
      return flagsPromise;
    }
    flagsPromise = window.api.getDashboardQueryFlags().then(function (result) {
      cachedFlags = Object.assign(defaultFlags(), result || {});
      return cachedFlags;
    }).catch(function () {
      cachedFlags = defaultFlags();
      return cachedFlags;
    });
    return flagsPromise;
  }

  function query(kind, params) {
    if (!window.api || typeof window.api.queryDashboardData !== "function") {
      return Promise.resolve({ ok: false, disabled: true, code: "DASHBOARD_QUERY_BRIDGE_MISSING", kind: kind });
    }
    return window.api.queryDashboardData(Object.assign({ kind: kind }, params || {})).then(function (result) {
      if (result && result.ok) latestResults[kind] = result;
      return result;
    });
  }

  function number(value) {
    if (typeof value === "number") return isFinite(value) ? value : 0;
    var parsed = Number(String(value == null ? "" : value).replace(/[^0-9.-]/g, ""));
    return isFinite(parsed) ? parsed : 0;
  }

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizeMoney(value) {
    return Math.round(number(value) * 100);
  }

  function normalizePeriod(period) {
    period = period || {};
    return {
      dateFrom: text(period.dateFrom || period.from || period.start || ""),
      dateTo: text(period.dateTo || period.to || period.end || ""),
      deliveredDateMode: text(period.deliveredDateMode || period.deliveryMode || ""),
    };
  }

  function rowIdentity(row, fallbackIndex) {
    row = row || {};
    var accountId = text(row.accountId || row.dashboardAccountId || row.account || row.accountKey || "");
    var direct = text(
      row.orderScopeKey ||
      row.rowIdentity ||
      row.legacyKey ||
      row.key ||
      row.id ||
      row.orderId ||
      row.taagerOrderNumber ||
      row.orderNumber ||
      row.sku ||
      row.campaignId ||
      row.campaign ||
      row.name ||
      ""
    );
    if (direct && accountId && direct.indexOf(accountId + "|") === 0) return direct;
    return accountId + "|" + (direct || ("row:" + String(fallbackIndex == null ? "" : fallbackIndex)));
  }

  function paginationTotal(value) {
    if (Array.isArray(value)) return value.length;
    if (!value || typeof value !== "object") return 0;
    if (value.total != null) return number(value.total);
    if (value.totalRows != null) return number(value.totalRows);
    if (value.pagination && value.pagination.total != null) return number(value.pagination.total);
    if (Array.isArray(value.rows)) return value.rows.length;
    if (Array.isArray(value.items)) return value.items.length;
    return 0;
  }

  function pushMismatch(list, field, legacy, backend, extra) {
    list.push(Object.assign({
      field: field,
      legacy: legacy,
      backend: backend,
    }, extra || {}));
  }

  function compareCounts(list, field, legacyRows, backendRows) {
    var legacyCount = Array.isArray(legacyRows) ? legacyRows.length : number(legacyRows);
    var backendCount = Array.isArray(backendRows) ? backendRows.length : number(backendRows);
    if (legacyCount !== backendCount) pushMismatch(list, field || "count", legacyCount, backendCount);
  }

  function compareMoney(list, field, legacyValue, backendValue, extra) {
    var legacyMinor = normalizeMoney(legacyValue);
    var backendMinor = normalizeMoney(backendValue);
    if (legacyMinor !== backendMinor) pushMismatch(list, field, legacyMinor, backendMinor, extra);
  }

  function compareValue(list, field, legacyValue, backendValue, extra) {
    if (String(legacyValue) !== String(backendValue)) pushMismatch(list, field, legacyValue, backendValue, extra);
  }

  function comparePaginationTotals(list, legacyPage, backendPage) {
    var legacyTotal = paginationTotal(legacyPage);
    var backendTotal = paginationTotal(backendPage);
    if (legacyTotal !== backendTotal) pushMismatch(list, "pagination.total", legacyTotal, backendTotal);
  }

  function identityList(rows) {
    return (Array.isArray(rows) ? rows : []).map(function (row, index) {
      return rowIdentity(row, index);
    });
  }

  function compareSortOrder(list, legacyRows, backendRows, limit) {
    var max = Math.min(number(limit || 50), Math.max((legacyRows || []).length, (backendRows || []).length));
    var legacyIds = identityList(legacyRows).slice(0, max);
    var backendIds = identityList(backendRows).slice(0, max);
    if (legacyIds.join("|") !== backendIds.join("|")) {
      pushMismatch(list, "sortOrder", legacyIds, backendIds);
    }
  }

  function compareAccountScope(list, legacyScope, backendScope) {
    var normalize = function (scope) {
      if (Array.isArray(scope)) return scope.map(text).filter(Boolean).sort().join("|");
      if (scope && Array.isArray(scope.accountIds)) return scope.accountIds.map(text).filter(Boolean).sort().join("|");
      return text(scope);
    };
    var legacy = normalize(legacyScope);
    var backend = normalize(backendScope);
    if (legacy !== backend) pushMismatch(list, "accountScope", legacy, backend);
  }

  function comparePeriod(list, legacyPeriod, backendPeriod) {
    var legacy = normalizePeriod(legacyPeriod);
    var backend = normalizePeriod(backendPeriod);
    ["dateFrom", "dateTo", "deliveredDateMode"].forEach(function (field) {
      if (legacy[field] !== backend[field]) {
        pushMismatch(list, "period." + field, legacy[field], backend[field]);
      }
    });
  }

  function logShadowVerified(section, details) {
    console.info("[DashboardQuery][shadow] rollout verified", Object.assign({ section: section, mismatchCount: 0 }, details || {}));
  }

  function logShadowMismatch(section, mismatches, details) {
    console.warn("[DashboardQuery][shadow] rollout mismatch", Object.assign({
      section: section,
      mismatchCount: Array.isArray(mismatches) ? mismatches.length : 0,
      mismatches: Array.isArray(mismatches) ? mismatches.slice(0, 25) : [],
    }, details || {}));
  }

  function markImplemented(section, value) {
    var key = text(section);
    if (key) implementedSections[key] = value !== false;
  }

  function registerShadowComparator(section, comparator) {
    var key = text(section);
    if (!key || typeof comparator !== "function") return false;
    shadowComparators[key] = comparator;
    markImplemented(key, true);
    return true;
  }

  function canRunShadow(section, flags) {
    var key = text(section);
    return !!(flags && flags.shadow && implementedSections[key] && typeof shadowComparators[key] === "function");
  }

  function runShadow(section, legacyValue, backendValue, context) {
    var key = text(section);
    return loadFlags().then(function (flags) {
      if (!canRunShadow(key, flags)) {
        return { ok: true, skipped: true, reason: flags && flags.shadow ? "not_implemented" : "shadow_off", section: key };
      }
      var mismatches = shadowComparators[key](legacyValue, backendValue, context || {}) || [];
      if (mismatches.length) logShadowMismatch(key, mismatches, context);
      else logShadowVerified(key, context);
      return { ok: !mismatches.length, section: key, mismatchCount: mismatches.length, mismatches: mismatches };
    }).catch(function (error) {
      logShadowMismatch(key, [{ field: "shadow.error", legacy: "", backend: error && error.message || String(error) }], context);
      return { ok: false, section: key, error: error && error.message || String(error) };
    });
  }

  function accountIdsFromData(data) {
    var meta = data && data.meta || {};
    var activeId = text(meta.activeAccountId || (typeof window.getActiveAccountId === "function" ? window.getActiveAccountId() : "__all__") || "__all__");
    if (activeId && activeId !== "__all__") return [activeId];
    return (meta.accountOptions || window.dashboardAccountsList || []).filter(function (account) {
      return account && account.id && account.id !== "__all__";
    }).map(function (account) { return account.id; });
  }

  function sortedOrderRows(rows) {
    if (!window.DashboardOrdersQueryCore || typeof window.DashboardOrdersQueryCore.pageRows !== "function") {
      return (rows || []).slice();
    }
    return window.DashboardOrdersQueryCore.pageRows(rows || [], 1, (rows || []).length || 1, "date_desc").allRows;
  }

  function stableJson(value) {
    if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
    if (value && typeof value === "object") {
      return "{" + Object.keys(value).sort().map(function (key) {
        return JSON.stringify(key) + ":" + stableJson(value[key]);
      }).join(",") + "}";
    }
    return JSON.stringify(value);
  }

  function compareOrdersShadow(legacyData, backendResult) {
    var mismatches = [];
    var core = window.DashboardOrdersQueryCore;
    if (!core || typeof core.summarizeRows !== "function") {
      pushMismatch(mismatches, "orders.core", "available", "missing");
      return mismatches;
    }
    var legacyOrders = legacyData && legacyData.orders || [];
    var backendOrders = backendResult && backendResult.orders || [];
    var legacySummary = core.summarizeRows(legacyOrders);
    var backendSummary = backendResult && backendResult.summary || core.summarizeRows(backendOrders);
    var legacySorted = sortedOrderRows(legacyOrders);
    var backendExport = backendResult && backendResult.exportRows || backendOrders;

    compareValue(mismatches, "rawOrderCount", legacySummary.rawOrderCount, backendSummary.rawOrderCount);
    compareValue(mismatches, "netOrderCount", legacySummary.netOrderCount, backendSummary.netOrderCount);
    compareValue(mismatches, "statusBreakdown", stableJson(legacySummary.statusBreakdown), stableJson(backendSummary.statusBreakdown));
    compareMoney(mismatches, "totalValue", legacySummary.totalValue, backendSummary.totalValue);
    compareMoney(mismatches, "totalProfit", legacySummary.totalProfit, backendSummary.totalProfit);
    compareValue(mismatches, "accountBreakdown", stableJson(legacySummary.accountBreakdown), stableJson(backendSummary.accountBreakdown));
    comparePaginationTotals(mismatches, { total: legacyOrders.length }, backendResult && backendResult.pagination);
    compareSortOrder(mismatches, legacySorted, backendExport, 100);
    compareValue(
      mismatches,
      "exportParity",
      legacySorted.map(function (row, index) { return core.orderIdentity(row, index); }).join("|"),
      backendExport.map(function (row, index) { return core.orderIdentity(row, index); }).join("|")
    );
    compareAccountScope(mismatches, accountIdsFromData(legacyData), backendResult && backendResult.accountScope);
    comparePeriod(mismatches, {
      dateFrom: legacyData && legacyData.meta && legacyData.meta.period && legacyData.meta.period.dateFrom,
      dateTo: legacyData && legacyData.meta && legacyData.meta.period && legacyData.meta.period.dateTo,
      deliveredDateMode: legacyData && legacyData.meta && legacyData.meta.deliveredDateMode,
    }, backendResult && backendResult.period);
    return mismatches;
  }

  function queryOrdersPayload(data) {
    var meta = data && data.meta || {};
    var period = meta.period || {};
    return {
      kind: "orders",
      activeAccountId: meta.activeAccountId || "__all__",
      accountIds: accountIdsFromData(data),
      period: {
        dateFrom: period.dateFrom || "",
        dateTo: period.dateTo || "",
      },
      deliveredDateMode: meta.deliveredDateMode || "updatedAt",
      page: 1,
      pageSize: 1000000,
      sortVal: "date_desc",
    };
  }

  function applyOrdersRollout(data) {
    if (!data || !data._loaded) return Promise.resolve(data);
    return loadFlags().then(function (flags) {
      markImplemented("orders", true);
      if (!flags.shadow && !flags.orders) return data;
      return query("orders", queryOrdersPayload(data)).then(function (result) {
        if (!result || !result.ok) {
          if (flags.orders) console.warn("[DashboardQuery] orders backend query failed; using legacy data", result);
          return data;
        }
        if (flags.shadow) {
          var mismatches = compareOrdersShadow(data, result);
          if (mismatches.length) logShadowMismatch("orders", mismatches, { accountScope: accountIdsFromData(data) });
          else logShadowVerified("orders", { mismatchCount: 0 });
        }
        if (flags.orders) {
          data.orders = Array.isArray(result.orders) ? result.orders : data.orders;
          data.outcomeOrders = Array.isArray(result.outcomeOrders) ? result.outcomeOrders : data.outcomeOrders;
          data._ordersBackendActive = true;
          data._ordersBackendSummary = result.summary || null;
          if (data.pipeline) data.pipeline.orders = data.orders;
        }
        return data;
      });
    }).catch(function (error) {
      console.warn("[DashboardQuery] orders rollout failed; using legacy data", error && error.message || error);
      return data;
    });
  }

  function compareProductsShadow(legacyData, backendResult) {
    var mismatches = [];
    var legacyProducts = legacyData && legacyData.products || {};
    var legacyRows = legacyProducts.rankedList || [];
    var backendProducts = backendResult && backendResult.products || {};
    var backendRows = backendProducts.rankedList || [];
    compareCounts(mismatches, "products.count", legacyRows, backendRows);
    compareValue(mismatches, "products.summary", stableJson(legacyProducts.summary || {}), stableJson(backendProducts.summary || {}));
    compareSortOrder(mismatches, legacyRows, backendRows, 100);
    return mismatches;
  }

  function applyProductsRollout(data) {
    if (!data || !data._loaded) return Promise.resolve(data);
    return loadFlags().then(function (flags) {
      markImplemented("products", true);
      if (!flags.shadow && !flags.products) return data;
      return query("products", {
        kind: "products",
        activeAccountId: data.meta && data.meta.activeAccountId || "__all__",
        accountIds: accountIdsFromData(data),
        period: data.meta && data.meta.period || {},
        products: data.products || {},
      }).then(function (result) {
        if (!result || !result.ok) {
          if (flags.products) console.warn("[DashboardQuery] products backend query failed; using legacy data", result);
          return data;
        }
        if (flags.shadow) {
          var mismatches = compareProductsShadow(data, result);
          if (mismatches.length) logShadowMismatch("products", mismatches, { accountScope: accountIdsFromData(data) });
          else logShadowVerified("products", { mismatchCount: 0 });
        }
        if (flags.products) {
          data.products = result.products || data.products;
          data._productsBackendActive = true;
        }
        return data;
      });
    }).catch(function (error) {
      console.warn("[DashboardQuery] products rollout failed; using legacy data", error && error.message || error);
      return data;
    });
  }

  function buildCampaignIntelForRollout(data) {
    if (!window.KhodCampaignIntelligence || typeof window.KhodCampaignIntelligence.build !== "function") return null;
    var accountId = data && data.meta && data.meta.activeAccountId || "__all__";
    var marketingState = window.DashboardMarketingState && typeof window.DashboardMarketingState.get === "function"
      ? window.DashboardMarketingState.get(accountId)
      : null;
    return window.KhodCampaignIntelligence.build({
      data: data,
      marketingState: marketingState,
      platform: "all",
    });
  }

  function compareCampaignShadow(legacyIntel, backendResult) {
    var mismatches = [];
    var backendIntel = backendResult && backendResult.campaignIntel || {};
    compareValue(mismatches, "campaigns.totals", stableJson(legacyIntel && legacyIntel.totals || {}), stableJson(backendIntel.totals || {}));
    compareCounts(mismatches, "campaigns.rows", legacyIntel && legacyIntel.allCampaigns || [], backendIntel.allCampaigns || []);
    compareCounts(mismatches, "campaigns.productActions", legacyIntel && legacyIntel.allProductGroups || [], backendIntel.allProductGroups || []);
    compareValue(mismatches, "campaigns.objectiveMix", stableJson(legacyIntel && legacyIntel.objectiveMix || []), stableJson(backendIntel.objectiveMix || []));
    return mismatches;
  }

  function applyCampaignsRollout(data) {
    if (!data || !data._loaded) return Promise.resolve(data);
    return loadFlags().then(function (flags) {
      markImplemented("campaigns", true);
      if (!flags.shadow && !flags.campaigns) return data;
      var legacyIntel = buildCampaignIntelForRollout(data);
      return query("campaigns", {
        kind: "campaigns",
        activeAccountId: data.meta && data.meta.activeAccountId || "__all__",
        accountIds: accountIdsFromData(data),
        period: data.meta && data.meta.period || {},
        campaignIntel: legacyIntel || {},
      }).then(function (result) {
        if (!result || !result.ok) {
          if (flags.campaigns) console.warn("[DashboardQuery] campaigns backend query failed; using legacy data", result);
          return data;
        }
        if (flags.shadow) {
          var mismatches = compareCampaignShadow(legacyIntel || {}, result);
          if (mismatches.length) logShadowMismatch("campaigns", mismatches, { accountScope: accountIdsFromData(data) });
          else logShadowVerified("campaigns", { mismatchCount: 0 });
        }
        if (flags.campaigns) {
          data._campaignBackendActive = true;
          data._campaignBackendIntel = result.campaignIntel || null;
        }
        return data;
      });
    }).catch(function (error) {
      console.warn("[DashboardQuery] campaigns rollout failed; using legacy data", error && error.message || error);
      return data;
    });
  }

  function applyDashboardRollouts(data) {
    return applyOrdersRollout(data)
      .then(applyProductsRollout)
      .then(applyCampaignsRollout);
  }

  window.DashboardQueryRuntime = {
    loadFlags: loadFlags,
    query: query,
    applyOrdersRollout: applyOrdersRollout,
    applyProductsRollout: applyProductsRollout,
    applyCampaignsRollout: applyCampaignsRollout,
    applyDashboardRollouts: applyDashboardRollouts,
    compareOrdersShadow: compareOrdersShadow,
    compareProductsShadow: compareProductsShadow,
    compareCampaignShadow: compareCampaignShadow,
    latest: function (kind) { return latestResults[kind] || null; },
    markImplemented: markImplemented,
    registerShadowComparator: registerShadowComparator,
    runShadow: runShadow,
    canRunShadow: canRunShadow,
    compare: {
      number: number,
      text: text,
      normalizeMoney: normalizeMoney,
      normalizePeriod: normalizePeriod,
      rowIdentity: rowIdentity,
      paginationTotal: paginationTotal,
      pushMismatch: pushMismatch,
      counts: compareCounts,
      money: compareMoney,
      value: compareValue,
      paginationTotals: comparePaginationTotals,
      sortOrder: compareSortOrder,
      accountScope: compareAccountScope,
      period: comparePeriod,
      identityList: identityList,
    },
    shadow: {
      verified: logShadowVerified,
      mismatch: logShadowMismatch,
    },
  };
})();
