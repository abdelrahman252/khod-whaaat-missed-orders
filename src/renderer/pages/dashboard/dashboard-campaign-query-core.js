(function (root, factory) {
  "use strict";
  const api = factory(
    typeof module !== "undefined" && module.exports
      ? require("./dashboard-campaign-decision")
      : root && root.TaagerCampaignDecision,
    typeof module !== "undefined" && module.exports
      ? require("./dashboard-currency-core")
      : root && root.TaagerDashboardCurrencyCore,
    typeof module !== "undefined" && module.exports
      ? require("./dashboard-product-attribution-core")
      : root && root.TaagerProductAttribution,
    typeof module !== "undefined" && module.exports
      ? require("./dashboard-financial-core")
      : root && root.TaagerDashboardFinancialCore,
    root && root.KhodDashboardLogic
  );
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) {
    root.KhodCampaignQueryCore = api;
    root.TaagerCampaignQueryCore = api;
  }
})(typeof window !== "undefined" ? window : null, function (decisionApi, currencyApi, attributionApi, financialApi, khodLogicApi) {
  "use strict";

const evaluate = decisionApi && decisionApi.evaluate ? decisionApi.evaluate : function () {
  return { decision: "watch", status: "watch", passedChecks: [], failedChecks: [], warnings: [] };
};

const RATES = { USD: 1, SAR: 3.75, EGP: 52, AED: 3.6725, IQD: 1310, OMR: 0.385 };

function text(value) {
  return String(value == null ? "" : value).trim();
}

function keyText(value) {
  if (attributionApi && attributionApi.normalizeText) return attributionApi.normalizeText(value);
  return text(value).toLowerCase().normalize("NFKC").replace(/[^\w\u0600-\u06ff]+/g, " ").replace(/\s+/g, " ").trim();
}

function number(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value == null ? "" : value).replace(/,/g, "").replace(/%/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value, digits = 2) {
  return Number(number(value).toFixed(digits));
}

function currency(value, fallback = "SAR") {
  const next = text(value || fallback).toUpperCase();
  return RATES[next] ? next : fallback;
}

function convert(value, from, to, egpRate, ratesOverride) {
  const source = currency(from);
  const target = currency(to, source);
  if (source === target) return number(value);
  if (currencyApi && typeof currencyApi.convert === "function") {
    return currencyApi.convert(value, source, target, { rates: ratesOverride || {}, egpRate });
  }
  const rates = { ...RATES, EGP: number(egpRate) > 0 ? number(egpRate) : RATES.EGP };
  Object.keys(ratesOverride || {}).forEach((key) => {
    const rateCurrency = currency(key, "");
    const rate = number(ratesOverride[key]);
    if (rateCurrency && rate > 0) rates[rateCurrency] = rate;
  });
  return number(value) / rates[source] * rates[target];
}

function normalizeKhodStatus(value) {
  if (khodLogicApi && typeof khodLogicApi.normalize === "function") {
    return khodLogicApi.normalize(value).bucket;
  }
  const status = keyText(value).replace(/_/g, " ");
  const aliases = {
    "pending": "pending",
    "awaiting confirmation": "pending",
    "pending confirmation": "pending",
    "confirmed": "confirmed",
    "under processing": "processing",
    "processing": "processing",
    "waiting": "waiting",
    "in shipping": "shipping",
    "shipping": "shipping",
    "shipped": "shipping",
    "delivered": "delivered",
    "failed": "failed",
    "canceled": "canceled",
    "cancelled": "canceled"
  };
  return aliases[status] || "other";
}

function statusBucket(row) {
  const explicit = text(row.orderStatusBucket || row.exactStatusBucket || row.statusBucket);
  return normalizeKhodStatus(explicit || row.orderStatus || row.status);
}

function hasKnownKhodStatus(row) {
  if (!row || typeof row !== "object") return false;
  if (khodLogicApi && typeof khodLogicApi.hasKnownLifecycleStatus === "function") {
    return khodLogicApi.hasKnownLifecycleStatus(row);
  }
  if (row.khodStatusKnown === true || row.orderStatusKnown === true) return statusBucket(row) !== "other";
  if (row.khodStatusKnown === false || row.orderStatusKnown === false) return false;
  if (row.khodOrderNumberKnown === true || row.khodOrderNumber || row.taagerOrderNumber) {
    return statusBucket(row) !== "other";
  }
  const raw = keyText(row.orderStatus || row.status);
  if (!raw || raw === "real" || raw === "missed" || raw === "pending khod sync") return false;
  if ((raw === "under processing" || raw === "processing") && !(row.khodOrderNumberKnown || row.khodOrderNumber || row.taagerOrderNumber)) return false;
  return statusBucket(row) !== "other";
}

function rowOrderKey(row, index) {
  return [text(row.accountId || row.dashboardAccountId), text(row.khodOrderNumber || row.taagerOrderNumber || row.orderNumber || row.orderId || row.id || row.reference) || "row:" + index].join("|");
}

function rowSku(row) {
  return text(row.sku || row.skuNumber);
}

  function rowName(row) {
    return text(row.productName || row.product || row.products || row.name) || "Unknown product";
}

function rowProfit(row) {
  return number(row.nativeCommission ?? row.marketerCommission ?? row.commission ?? row.commissionValue ?? row.dashboardCommission ?? row.nativeProfitAfterTax ?? row.profitAfterTax ?? row.taagerProfit ?? row.profitAfterFees);
}

function rowSales(row) {
  return number(row.nativeTotalPrice ?? row.totalPrice ?? row.priceNoShipping ?? row.subtotal ?? row.salesValue ?? row.dashboardTotalPrice ?? row.total ?? row.orderValue);
}

function metric(row, keys) {
  for (const key of keys) {
    if (row && row[key] != null && row[key] !== "") return number(row[key]);
  }
  return 0;
}

function fallbackMetric(row, keys) {
  let available = false;
  for (const key of keys) {
    if (!row || row[key] == null || row[key] === "") continue;
    available = true;
    const value = number(row[key]);
    if (value > 0) return { value, available };
  }
  return { value: 0, available };
}

function trafficViewMetrics(row) {
  const landing = fallbackMetric(row, ["landingPageViews", "landing_page_views", "actions_landing_page_view", "total_landing_page_view", "total_pageview", "conversion_page_views"]);
  const content = fallbackMetric(row, ["contentViews", "content_views", "actions_offsite_conversion_fb_pixel_view_content", "actions_view_content", "actions_omni_view_content", "page_content_view_events", "conversion_view_content"]);
  const landingPageViews = landing.value;
  const contentViews = content.value;
  return {
    landingPageViews,
    contentViews,
    trafficViews: landingPageViews > 0 ? landingPageViews : contentViews,
    trafficViewAvailable: row && row.trafficViewAvailable != null
      ? row.trafficViewAvailable === true
      : landing.available || content.available,
  };
}

function campaignName(row) {
  return text(row && (row.campaign || row.campaignName || row.name || row.campaign_name)) || "Unnamed campaign";
}

function campaignId(row) {
  return text(row && (row.campaign_id || row.campaignId || row.campaignid || row.id));
}

function objectiveOf(row) {
  const raw = keyText(row && (row.campaign_objective || row.campaignObjective || row.objective || row.optimization_goal || row.optimizationGoal));
  const combined = raw + " " + keyText(campaignName(row));
  if (combined.includes("lead")) return "website_leads";
  if (combined.includes("sales") || combined.includes("sale") || combined.includes("purchase") || combined.includes("conversion")) return "sales";
  return raw || "unknown";
}

function statusOf(row) {
  return keyText(row && (row.campaign_status || row.campaign_effective_status || row.effective_status || row.status || row.effectiveStatus || row.campaignStatus)) || "unknown";
}

function rawCampaignSpend(row) {
  return metric(row, ["rawSpend", "spend", "adSpend", "cost", "amount_spent"]);
}

function campaignSpendAmounts(row, reportingCurrency, egpRate, ratesOverride) {
  const rawFieldsAvailable = row && (
    row.rawSpend != null ||
    row.nativeRawSpend != null ||
    row.spend != null ||
    row.adSpend != null ||
    row.cost != null ||
    row.amount_spent != null
  );
  const convertedAvailable = row && row.convertedSpend != null && row.convertedSpend !== "";
  const rawSpendValue = rawFieldsAvailable
    ? number(row.rawSpend ?? row.nativeRawSpend ?? row.spend ?? row.adSpend ?? row.cost ?? row.amount_spent)
    : 0;
  const convertedSpendValue = convertedAvailable ? number(row.convertedSpend) : 0;
  if (rawFieldsAvailable && (rawSpendValue > 0 || convertedSpendValue <= 0)) {
    const rawCurrency = currency(row.rawCurrency || row.nativeRawCurrency || row.currency || row.account_currency || reportingCurrency || "SAR");
    const rawSpend = rawSpendValue;
    return {
      hasSpend: rawSpend > 0,
      rawSpend,
      rawCurrency,
      spend: convert(rawSpend, rawCurrency, reportingCurrency, egpRate, ratesOverride),
    };
  }
  if (convertedAvailable) {
    const convertedCurrency = currency(row.targetCurrency || row.reportingCurrency || row.currency || reportingCurrency || "SAR");
    const convertedSpend = convertedSpendValue;
    return {
      hasSpend: convertedSpend > 0,
      rawSpend: convertedSpend,
      rawCurrency: convertedCurrency,
      spend: convert(convertedSpend, convertedCurrency, reportingCurrency, egpRate, ratesOverride),
    };
  }
  return { hasSpend: false, rawSpend: 0, rawCurrency: currency(reportingCurrency || "SAR"), spend: 0 };
}

function compareRows(field, direction) {
  const factor = direction === "asc" ? 1 : -1;
  return (a, b) => {
    const av = a[field];
    const bv = b[field];
    if (typeof av === "number" || typeof bv === "number") return (number(av) - number(bv)) * factor;
    return text(av).localeCompare(text(bv)) * factor;
  };
}

function paginate(rows, page, pageSize) {
  const size = Math.min(50, Math.max(1, number(pageSize) || 10));
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const safePage = Math.min(totalPages, Math.max(1, number(page) || 1));
  const start = (safePage - 1) * size;
  return {
    rows: rows.slice(start, start + size),
    pagination: { page: safePage, pageSize: size, total: rows.length, totalPages, start: rows.length ? start + 1 : 0, end: Math.min(start + size, rows.length) }
  };
}

function productKey(row, accountId) {
  const sku = rowSku(row);
  const country = keyText(row.taagerCountry || row.country || "unknown");
  return sku ? accountId + "|" + country + "|" + sku.toLowerCase() : accountId + "|" + country + "|" + keyText(rowName(row));
}

function countryCurrency(row, fallback) {
  return currency(row.nativeCurrency || row.currency || row.orderCurrency || fallback || "SAR");
}

function isCustomerCancelBucket(bucket) {
  return bucket === "canceled";
}

function buildProducts(orderRows, reportingCurrency, egpRate, orderCurrency, ratesOverride) {
  const map = new Map();
  orderRows.forEach((row, index) => {
    if (!hasKnownKhodStatus(row)) return;
    const bucket = statusBucket(row);
    if (bucket === "other") return;
    const key = productKey(row, row.accountId);
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        accountId: text(row.accountId),
        country: keyText(row.taagerCountry || row.country || "unknown"),
        product: rowName(row),
        sku: rowSku(row),
        orders: 0,
        ndrBaseOrders: 0,
        delivered: 0,
        canceled: 0,
        cancelStatusCount: 0,
        statusTotalCount: 0,
        profit: 0,
        totalSales: 0,
        deliveredSales: 0,
        cities: {},
        seen: new Set(),
      });
    }
    const product = map.get(key);
    const orderKey = rowOrderKey(row, index);
    if (product.seen.has(orderKey)) return;
    product.seen.add(orderKey);
    const city = text(row.city || row.customerCity || row.province);
    if (city) {
      if (!product.cities[city]) product.cities[city] = { city, orders: 0, delivered: 0 };
      if (bucket !== "canceled") product.cities[city].orders++;
      if (bucket === "delivered") product.cities[city].delivered++;
    }
    product.orders++;
    product.statusTotalCount++;
    if (bucket !== "canceled") product.ndrBaseOrders++;
    if (isCustomerCancelBucket(bucket)) product.cancelStatusCount++;
    const sourceCurrency = countryCurrency(row, orderCurrency || reportingCurrency);
    product.totalSales += convert(rowSales(row), sourceCurrency, reportingCurrency, egpRate, ratesOverride);
    if (bucket === "delivered") {
      product.delivered++;
      const sourceCurrency = countryCurrency(row, orderCurrency || reportingCurrency);
      product.profit += convert(rowProfit(row), sourceCurrency, reportingCurrency, egpRate, ratesOverride);
      product.deliveredSales += convert(rowSales(row), sourceCurrency, reportingCurrency, egpRate, ratesOverride);
    }
    if (bucket === "canceled") product.canceled++;
  });
  return Array.from(map.values()).map((product) => {
    const clean = { ...product };
    delete clean.seen;
    clean.ndrPct = clean.ndrBaseOrders ? round(clean.delivered / clean.ndrBaseOrders * 100, 1) : 0;
    clean.cancelPct = clean.statusTotalCount ? round(clean.cancelStatusCount / clean.statusTotalCount * 100, 1) : 0;
    clean.avgDeliveredProfit = clean.delivered ? round(clean.profit / clean.delivered) : 0;
    clean.breakEvenCpa = round(clean.avgDeliveredProfit * clean.ndrPct / 100);
    clean.topCities = Object.values(clean.cities).map((city) => ({
      ...city,
      ndrPct: city.orders ? round(city.delivered / city.orders * 100, 1) : 0,
    })).sort((a, b) => b.orders - a.orders).slice(0, 4);
    delete clean.cities;
    return clean;
  });
}

function normalizeProducts(productRows, reportingCurrency, egpRate, orderCurrency, ratesOverride) {
  return (Array.isArray(productRows) ? productRows : []).map((row) => {
    const sourceCurrency = currency(row.currency || orderCurrency || reportingCurrency);
    const profit = round(convert(row.commissionValue ?? row.marketerCommission ?? row.commission ?? row.taagerProfit ?? row.profit ?? 0, sourceCurrency, reportingCurrency, egpRate, ratesOverride));
    const deliveredSales = round(convert(row.deliveredSales ?? row.salesValue ?? row.sales ?? 0, sourceCurrency, reportingCurrency, egpRate, ratesOverride));
    const totalSales = round(convert(row.totalSales ?? row.salesValue ?? row.totalPlacedSales ?? row.revenue ?? row.sales ?? row.deliveredSales ?? 0, sourceCurrency, reportingCurrency, egpRate, ratesOverride));
    const orders = number(row.netOrderCount ?? row.orders ?? row.placedCount);
    const totalOrderCount = number(row.totalOrderCount ?? row.rawTotalOrders ?? orders);
    const delivered = number(row.deliveredCount ?? row.units ?? row.delivered);
    const ndrPct = number(row.ndrPct ?? row.deliveryRate ?? row.deliveryPct);
    const avgDeliveredProfit = delivered ? round(profit / delivered) : 0;
    return {
      id: text(row.key || row.id || productKey(row, row.accountId || row.dashboardAccountId)).toLowerCase(),
      accountId: text(row.accountId || row.dashboardAccountId),
      country: keyText(row.country || row.taagerCountry || "unknown"),
      product: rowName(row),
      sku: rowSku(row),
      orders,
      ndrBaseOrders: number(row.ndrBaseCount ?? row.ndrBaseOrders ?? orders),
      netOrderCount: orders,
      totalOrderCount,
      delivered,
      canceled: number(row.canceledCount || row.canceled),
      profit,
      totalSales,
      deliveredSales,
      ndrPct,
      cancelPct: number(row.cancelPct),
      avgDeliveredProfit,
      breakEvenCpa: round(avgDeliveredProfit * ndrPct / 100),
      netOrderKeys: Array.isArray(row.netOrderKeys) ? row.netOrderKeys.map(text).filter(Boolean) : [],
      topCities: Array.isArray(row.cityBreakdown) ? row.cityBreakdown.slice(0, 4).map((city) => ({
        city: text(city.name || city.city),
        orders: number(city.netOrderCount ?? city.orders ?? city.count),
        netOrderCount: number(city.netOrderCount ?? city.orders ?? city.count),
        totalOrderCount: number(city.totalOrderCount ?? city.rawTotalOrders ?? city.netOrderCount ?? city.orders ?? city.count),
        ndrPct: number(city.ndr || city.ndrPct),
      })) : [],
    };
  });
}

function uniqueMatchedNetOrders(orderRows, matchedProductIds) {
  const matchedOrders = new Set();
  (Array.isArray(orderRows) ? orderRows : []).forEach((row, index) => {
    if (!hasKnownKhodStatus(row) || statusBucket(row) === "other") return;
    const id = productKey(row, text(row.accountId || row.dashboardAccountId)).toLowerCase();
    if (matchedProductIds.has(id)) matchedOrders.add(rowOrderKey(row, index));
  });
  return matchedOrders.size;
}

function buildCampaignIntelligence(input) {
  const reportingCurrency = currency(input.reportingCurrency || "SAR");
  const egpRate = number(input.egpRate) || 52;
  const ratesOverride = input.exchangeRates || {};
  const products = Array.isArray(input.products) && input.products.length
    ? normalizeProducts(input.products, reportingCurrency, egpRate, input.orderCurrency, ratesOverride)
    : buildProducts(input.orderRows || [], reportingCurrency, egpRate, input.orderCurrency, ratesOverride);
  const productIndex = attributionApi.createProductIndex(products, {
    productNameOverrides: input.productNameOverrides || {},
  });
  const productGroups = new Map();
  const campaigns = [];
  const objectiveMap = new Map();
  const totals = {
    spend: 0,
    matchedSpend: 0,
    unmatchedSpend: 0,
    campaignCount: 0,
    impressions: 0,
    clicks: 0,
    separatedSkuRows: 0,
    gluedSkuRows: 0,
    nameRows: 0,
    ambiguousRows: 0,
    unmatchedRows: 0,
  };

  (input.campaignRows || []).forEach((source) => {
    const spendAmounts = campaignSpendAmounts(source, reportingCurrency, egpRate, ratesOverride);
    const rawCurrency = spendAmounts.rawCurrency;
    const rawSpend = spendAmounts.rawSpend;
    if (!spendAmounts.hasSpend) return;
    const spend = spendAmounts.spend;
    const impressions = metric(source, ["impressions", "reach"]);
    const clicks = metric(source, ["clicks", "link_clicks", "outbound_clicks_outbound_click", "unique_clicks"]);
    const views = trafficViewMetrics(source);
    const platformCpc = metric(source, ["cpc", "cost_per_link_click", "cost_per_unique_click"]) || (clicks ? rawSpend / clicks : 0);
    const platformCpm = metric(source, ["cpm"]) || (impressions ? rawSpend / impressions * 1000 : 0);
    const objective = objectiveOf(source);
    const attribution = attributionApi.matchCampaign(source, productIndex);
    const product = attribution.status === "matched" ? attribution.product : null;
    const row = {
      campaignId: campaignId(source),
      campaign: campaignName(source),
      dashboardAccountId: text(source.dashboardAccountId || source.accountId),
      platform: text(source.platform || source.source || source.channel || "unknown").toLowerCase(),
      objective,
      status: statusOf(source),
      currency: reportingCurrency,
      spend: round(spend),
      rawCurrency,
      rawSpend: round(rawSpend),
      impressions: round(impressions, 0),
      clicks: round(clicks, 0),
      landingPageViews: round(views.landingPageViews, 0),
      contentViews: round(views.contentViews, 0),
      trafficViews: round(views.trafficViews, 0),
      trafficViewAvailable: views.trafficViewAvailable,
      ctrPct: impressions ? round(clicks / impressions * 100) : 0,
      platformCpc: round(platformCpc),
      platformCpm: round(platformCpm),
      platformCpcCurrency: rawCurrency,
      product: product ? product.product : null,
      productSku: product ? product.sku : "",
      productKey: product ? product.id : "",
      attributionVerified: !!product,
      matchMethod: attribution.method,
      matchDetail: attribution.matchDetail,
      matchConfidence: attribution.confidence,
      matchedSku: attribution.matchedSku,
      candidateIds: attribution.candidateIds,
      note: product
        ? "Orders and delivery results come from the KHOD dashboard."
        : (attribution.status === "ambiguous"
          ? "Ambiguous campaign name; spend was not assigned to a product."
          : "Unmatched spend; no KHOD product attribution."),
    };
    row.searchHaystack = keyText([row.campaign, row.campaignId, row.platform, row.objective, row.status, row.product, row.productSku, row.matchMethod].join(" "));
    campaigns.push(row);
    totals.spend += spend;
    totals.campaignCount++;
    totals.impressions += impressions;
    totals.clicks += clicks;
    if (product) totals.matchedSpend += spend;
    else totals.unmatchedSpend += spend;
    if (attribution.matchDetail === "separated_sku") totals.separatedSkuRows++;
    else if (attribution.matchDetail === "glued_sku") totals.gluedSkuRows++;
    else if (attribution.method === "name") totals.nameRows++;
    else if (attribution.method === "ambiguous") totals.ambiguousRows++;
    else totals.unmatchedRows++;
    if (!objectiveMap.has(objective)) objectiveMap.set(objective, { objective, spend: 0, campaignCount: 0 });
    objectiveMap.get(objective).spend += spend;
    objectiveMap.get(objective).campaignCount++;
    if (!product) return;
    if (!productGroups.has(product.id)) {
      productGroups.set(product.id, {
        id: product.id, accountId: product.accountId, country: product.country, currency: reportingCurrency,
        product: product.product, sku: product.sku, spend: 0, campaignCount: 0, impressions: 0, clicks: 0, landingPageViews: 0, contentViews: 0, trafficViews: 0, trafficViewAvailable: false,
        taagerOrders: product.orders, taagerDelivered: product.delivered, taagerNdrPct: product.ndrPct,
        netOrderCount: product.netOrderCount, totalOrderCount: product.totalOrderCount,
        cancelPct: product.cancelPct, taagerProfit: product.profit,
        totalSales: product.totalSales,
        deliveredSales: product.deliveredSales,
        breakEvenCpa: product.breakEvenCpa,
        cities: product.topCities,
        netOrderKeys: product.netOrderKeys || [],
      });
    }
    const group = productGroups.get(product.id);
    group.spend += spend;
    group.campaignCount++;
    group.impressions += impressions;
    group.clicks += clicks;
    group.landingPageViews += views.landingPageViews;
    group.contentViews += views.contentViews;
    group.trafficViews += views.trafficViews;
    group.trafficViewAvailable = group.trafficViewAvailable || views.trafficViewAvailable;
  });

  const groups = Array.from(productGroups.values()).map((group) => {
    const financials = financialApi.calculate({
      mode: "actual",
      netOrders: group.taagerOrders,
      actualDeliveredOrders: group.taagerDelivered,
      actualEarnedProfitAfterTax: group.taagerProfit,
      actualDeliveredSales: group.deliveredSales,
      currentTotalSales: group.totalSales,
      expectedNdrRate: group.taagerNdrPct / 100,
      adSpend: group.spend,
    });
    const taagerCpa = financials.cpa;
    const deliveredCpa = financials.actualDeliveredCpa;
    const avgDeliveredProfit = financials.averageProfit;
    const trafficViews = group.trafficViews;
    const netProfit = financials.actualNetProfit;
    const decisionMetadata = evaluate({
      orders: group.taagerOrders, delivered: group.taagerDelivered, ndrPct: group.taagerNdrPct,
      cancelPct: group.cancelPct, cpa: taagerCpa, breakEvenCpa: group.breakEvenCpa,
      deliveredCpa, avgDeliveredProfit, netProfit, campaignCount: group.campaignCount,
      cities: group.cities,
    });
    return {
      ...group,
      spend: round(group.spend),
      taagerCpa: round(taagerCpa),
      deliveredCpa: round(deliveredCpa),
      avgDeliveredProfit: round(avgDeliveredProfit),
      trafficViews: round(trafficViews, 0),
      conversionRateAvailable: trafficViews > 0,
      realConversionRatePct: trafficViews ? round(group.taagerOrders / trafficViews * 100) : 0,
      deliveredConversionRatePct: trafficViews ? round(group.taagerDelivered / trafficViews * 100) : 0,
      netProfit: round(netProfit),
      roiPct: round(financials.actualRoi),
      profitRoas: round(financials.actualProfitRoas),
      totalSalesRoas: group.spend ? round(group.totalSales / group.spend) : 0,
      deliveredSalesRoas: round(financials.actualSalesRoas),
      decision: decisionMetadata.decision,
      decisionMetadata,
      searchHaystack: keyText([group.product, group.sku, group.accountId, group.country].join(" ")),
    };
  }).sort((a, b) => b.taagerOrders - a.taagerOrders || b.spend - a.spend);

  totals.matchedSpendPct = totals.spend ? round(totals.matchedSpend / totals.spend * 100) : 0;
  totals.unmatchedSpendPct = totals.spend ? round(totals.unmatchedSpend / totals.spend * 100) : 0;
  totals.productOrderCount = groups.reduce((sum, row) => sum + row.taagerOrders, 0);
  const matchedOrderKeys = new Set();
  Array.from(productGroups.values()).forEach((group) => {
    (Array.isArray(group.netOrderKeys) ? group.netOrderKeys : []).forEach((key) => {
      if (key) matchedOrderKeys.add(key);
    });
  });
  totals.uniqueMatchedNetOrders = matchedOrderKeys.size || (
    Array.isArray(input.orderRows) && input.orderRows.length
      ? uniqueMatchedNetOrders(input.orderRows, new Set(productGroups.keys()))
      : totals.productOrderCount
  );
  totals.taagerOrders = totals.uniqueMatchedNetOrders;
  totals.taagerDelivered = groups.reduce((sum, row) => sum + row.taagerDelivered, 0);
  totals.taagerProfit = round(groups.reduce((sum, row) => sum + row.taagerProfit, 0));
  totals.deliveredSales = round(groups.reduce((sum, row) => sum + row.deliveredSales, 0));
  totals.totalSales = round(groups.reduce((sum, row) => sum + row.totalSales, 0));
  const totalFinancials = financialApi.calculate({
    mode: "actual",
    netOrders: totals.taagerOrders,
    actualDeliveredOrders: totals.taagerDelivered,
    actualEarnedProfitAfterTax: totals.taagerProfit,
    actualDeliveredSales: totals.deliveredSales,
    currentTotalSales: totals.totalSales,
    expectedNdrRate: totals.taagerOrders ? totals.taagerDelivered / totals.taagerOrders : 0,
    adSpend: totals.matchedSpend,
  });
  totals.netProfit = round(totalFinancials.actualNetProfit);
  totals.taagerCpa = round(totalFinancials.cpa);
  totals.roiPct = round(totalFinancials.actualRoi);
  totals.profitRoas = round(totalFinancials.actualProfitRoas);
  totals.deliveredSalesRoas = round(totalFinancials.actualSalesRoas);
  totals.totalSalesRoas = totals.matchedSpend ? round(totals.totalSales / totals.matchedSpend) : 0;

  return {
    currency: reportingCurrency,
    totals,
    objectiveMix: Array.from(objectiveMap.values()).map((row) => ({ ...row, spend: round(row.spend), spendSar: round(row.spend) })).sort((a, b) => b.spend - a.spend),
    objectives: Array.from(objectiveMap.keys()).sort(),
    campaigns: campaigns.sort((a, b) => b.spend - a.spend),
    productGroups: groups,
    decisionCounts: groups.reduce((result, row) => {
      result[row.decision] = (result[row.decision] || 0) + 1;
      return result;
    }, { scale: 0, fix_first: 0, watch: 0, pause: 0 }),
    creativeSummary: {
      fatigueCandidates: [],
      fatigueAvailable: false,
      winners: groups.filter((row) => row.decision === "scale").slice(0, 5).map((row) => row.product),
    },
  };
}

function filterAndPage(intel, input) {
  const campaignFilters = input.campaignFilters || {};
  const productFilters = input.productFilters || {};
  let campaigns = intel.campaigns.slice();
  let products = intel.productGroups.slice();
  const campaignSearch = keyText(campaignFilters.search);
  const productSearch = keyText(productFilters.search);
  campaigns = campaigns.filter((row) => {
    if (campaignFilters.match === "matched" && !row.attributionVerified) return false;
    if (campaignFilters.match === "unmatched" && row.attributionVerified) return false;
    if (campaignFilters.objective && campaignFilters.objective !== "all" && row.objective !== campaignFilters.objective) return false;
    return !campaignSearch || row.searchHaystack.includes(campaignSearch);
  });
  products = products.filter((row) => !productSearch || row.searchHaystack.includes(productSearch));
  campaigns.sort(compareRows(text(input.campaignSortBy) || "spend", input.campaignSortDir === "asc" ? "asc" : "desc"));
  if (input.productSortBy === "aiPriority") {
    const priority = { pause: 3, fix_first: 2, scale: 1, watch: 0 };
    products.sort((a, b) => (priority[b.decision] || 0) - (priority[a.decision] || 0) || b.spend - a.spend);
  } else {
    products.sort(compareRows(text(input.productSortBy) || "spend", input.productSortDir === "asc" ? "asc" : "desc"));
  }
  return {
    campaignPage: paginate(campaigns, input.campaignPage, input.pageSize),
    productPage: paginate(products, input.productPage, input.pageSize),
  };
}

return { buildCampaignIntelligence, filterAndPage };
});
