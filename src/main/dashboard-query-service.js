"use strict";

const { readDashboardRolloutFlags } = require("./dashboard-rollout-flags");
const ordersQueryCore = require("../renderer/pages/dashboard/dashboard-orders-query-core");
const productAttribution = require("../renderer/pages/dashboard/dashboard-product-attribution");

const SECTION_FLAGS = Object.freeze({
  orders: "orders",
  products: "products",
  campaigns: "campaigns",
});

function sectionEnabled(flags, kind) {
  if (!kind) return false;
  return !!(flags && flags[SECTION_FLAGS[kind]]);
}

function sectionImplemented(kind) {
  return kind === "orders" || kind === "products" || kind === "campaigns";
}

function text(value) {
  return String(value == null ? "" : value).trim();
}

function campaignKey(row) {
  const source = row || {};
  const platform = text(source.platform).toLowerCase();
  const id = text(source.campaignId || source.campaign_id);
  const name = text(source.campaign || source.campaignName || source.name || source.campaign_name).toLowerCase();
  return platform + "|" + (id ? "id:" + id : "name:" + name);
}

function createDashboardQueryService(options) {
  const deps = options || {};
  const logger = deps.logger || console;

  function flags() {
    return deps.readFlags ? deps.readFlags() : readDashboardRolloutFlags();
  }

  function loadScopedRows(input) {
    if (typeof deps.loadDashboardAccounts !== "function") return [];
    const accounts = deps.loadDashboardAccounts() || {};
    const requested = Array.isArray(input.accountIds) ? input.accountIds.map(text).filter(Boolean) : [];
    const accountIds = requested.length ? requested : Object.keys(accounts || {});
    const rows = [];
    accountIds.forEach((accountId) => {
      const snap = accounts[accountId] || {};
      const snapshot = Array.isArray(snap.snapshot) ? snap.snapshot : [];
      const meta = typeof deps.getAccountMeta === "function" ? deps.getAccountMeta(accountId) || {} : {};
      snapshot.forEach((row) => {
        rows.push(Object.assign({}, row, {
          accountId,
          accountEmail: meta.email || row.accountEmail || "",
          accountLabel: meta.label || row.accountLabel || accountId,
        }));
      });
    });
    return rows;
  }

  function queryOrders(payload) {
    const rows = loadScopedRows(payload);
    return ordersQueryCore.createOrdersResult({
      rows,
      period: payload.period || { dateFrom: payload.dateFrom || "", dateTo: payload.dateTo || "" },
      deliveredDateMode: payload.deliveredDateMode || "updatedAt",
      activeAccountId: payload.activeAccountId || "__all__",
      accountIds: payload.accountIds || [],
      page: payload.page || 1,
      pageSize: payload.pageSize || rows.length || 1,
      sortVal: payload.sortVal || "date_desc",
    });
  }

  function queryProducts(payload) {
    const products = payload.products && typeof payload.products === "object" ? payload.products : {};
    const rows = Array.isArray(products.rankedList) ? products.rankedList.slice() : [];
    const campaignRows = Array.isArray(payload.campaignRows) ? payload.campaignRows : [];
    const index = productAttribution.createProductIndex(rows);
    const attribution = productAttribution.attributeCampaignRows(campaignRows, index, {
      accountId: payload.activeAccountId && payload.activeAccountId !== "__all__"
        ? payload.activeAccountId
        : "",
      getSpend: (row) => Number(row && row.attributionSpendSar || 0),
    });
    const attributedRows = rows.map((row, idx) => {
      const assignment = attribution.assignments[idx];
      return Object.assign({}, row, {
        attributedSpendSar: assignment ? Number(assignment.spend.toFixed(2)) : 0,
        attributedCampaignCount: assignment ? assignment.rowCount : 0,
        attributionMethods: assignment ? Object.keys(assignment.methods) : [],
        attributionDetails: assignment ? Object.keys(assignment.details) : [],
      });
    });
    return {
      ok: true,
      kind: "products",
      products: {
        summary: Object.assign({}, products.summary || {}),
        rankedList: attributedRows,
      },
      rows: attributedRows,
      attributionVersion: productAttribution.VERSION,
      attributionSummary: attribution.summary,
      pagination: {
        page: 1,
        pageSize: attributedRows.length || 1,
        total: attributedRows.length,
        totalPages: 1,
      },
      summary: Object.assign({}, products.summary || {}),
      source: "shared-attribution-main-source",
    };
  }

  function queryCampaigns(payload) {
    const intel = payload.campaignIntel && typeof payload.campaignIntel === "object" ? payload.campaignIntel : {};
    const rawProducts = payload.products && Array.isArray(payload.products.rankedList)
      ? payload.products.rankedList.slice()
      : [];
    const rawCampaignRows = Array.isArray(payload.campaignRows) ? payload.campaignRows : [];
    const index = productAttribution.createProductIndex(rawProducts);
    const attribution = productAttribution.attributeCampaignRows(rawCampaignRows, index, {
      accountId: payload.activeAccountId && payload.activeAccountId !== "__all__"
        ? payload.activeAccountId
        : "",
      getSpend: (row) => Number(row && row.attributionSpendSar || 0),
    });
    const matchesByKey = {};
    attribution.rows.forEach((entry) => {
      const key = campaignKey(entry.row);
      if (!matchesByKey[key]) matchesByKey[key] = [];
      matchesByKey[key].push(entry);
    });
    const campaigns = (Array.isArray(intel.allCampaigns) ? intel.allCampaigns : []).map((campaign) => {
      const key = campaignKey(campaign);
      const entry = matchesByKey[key] && matchesByKey[key].shift();
      if (!entry) return Object.assign({}, campaign);
      const result = entry.result;
      const product = result.status === "matched" ? result.product : null;
      const candidateProducts = (result.candidateIds || []).map((candidateId) => {
        const candidate = index.entries.find((item) => item.id === candidateId);
        if (!candidate) return null;
        return {
          id: candidate.id,
          name: text(candidate.product && (candidate.product.name || candidate.product.product || candidate.product.sku)),
          sku: text(candidate.product && candidate.product.sku),
        };
      }).filter(Boolean);
      return Object.assign({}, campaign, {
        product: product ? text(product.name || product.product || product.sku) : null,
        productSku: product ? text(product.sku) : "",
        suggestedProduct: !product && candidateProducts.length === 1 ? candidateProducts[0].name : "",
        suggestedProductSku: !product && candidateProducts.length === 1 ? candidateProducts[0].sku : "",
        matchMethod: result.method,
        matchConfidence: result.confidence,
        matchDetail: result.matchDetail,
        matchedSku: result.matchedSku,
        candidateIds: result.candidateIds,
        candidateProducts,
        attributionStatus: result.status,
        attributionVerified: result.status === "matched",
      });
    });
    const attributedProducts = rawProducts.map((product, idx) => {
      const assignment = attribution.assignments[idx];
      return {
        id: text(product && (product.id || product.key || product.sku || product.name)),
        product: text(product && (product.name || product.product || product.sku)),
        sku: text(product && product.sku),
        attributedSpendSar: assignment ? Number(assignment.spend.toFixed(2)) : 0,
        campaignCount: assignment ? assignment.rowCount : 0,
        methods: assignment ? Object.keys(assignment.methods) : [],
        details: assignment ? Object.keys(assignment.details) : [],
      };
    });
    const products = Array.isArray(intel.allProductGroups) ? intel.allProductGroups.slice() : [];
    const totals = Object.assign({}, intel.totals || {}, {
      matchedSpendSar: Number(attribution.summary.matchedSpend.toFixed(2)),
      unmatchedSpendSar: Number((attribution.summary.unmatchedSpend + attribution.summary.ambiguousSpend).toFixed(2)),
      separatedSkuRows: attribution.summary.separatedSkuRows,
      gluedSkuRows: attribution.summary.gluedSkuRows,
      nameRows: attribution.summary.nameRows,
      ambiguousRows: attribution.summary.ambiguousRows,
      unmatchedRows: attribution.summary.unmatchedRows,
    });
    const totalSpend = totals.matchedSpendSar + totals.unmatchedSpendSar;
    totals.matchedSpendPct = totalSpend > 0 ? Number((totals.matchedSpendSar / totalSpend * 100).toFixed(2)) : 0;
    totals.unmatchedSpendPct = totalSpend > 0 ? Number((totals.unmatchedSpendSar / totalSpend * 100).toFixed(2)) : 0;
    return {
      ok: true,
      kind: "campaigns",
      campaignIntel: Object.assign({}, intel, {
        allCampaigns: campaigns,
        allProductGroups: products,
        totals,
        attributionVersion: productAttribution.VERSION,
        attributionSummary: attribution.summary,
        attributedProducts,
      }),
      rows: campaigns,
      productRows: products,
      attributedProducts,
      attributionVersion: productAttribution.VERSION,
      attributionSummary: attribution.summary,
      pagination: {
        campaigns: { page: 1, pageSize: campaigns.length || 1, total: campaigns.length, totalPages: 1 },
        products: { page: 1, pageSize: products.length || 1, total: products.length, totalPages: 1 },
      },
      summary: totals,
      source: "shared-attribution-main-source",
    };
  }

  async function query(input) {
    const payload = input || {};
    const kind = String(payload.kind || "").trim();
    const activeFlags = flags();

    if (!sectionImplemented(kind)) {
      return {
        ok: false,
        disabled: true,
        code: "DASHBOARD_QUERY_NOT_IMPLEMENTED",
        kind,
        flags: activeFlags,
      };
    }

    if (!activeFlags.shadow && !sectionEnabled(activeFlags, kind)) {
      return {
        ok: false,
        disabled: true,
        code: "DASHBOARD_QUERY_DISABLED",
        kind,
        flags: activeFlags,
      };
    }

    if (kind === "orders") return queryOrders(payload);
    if (kind === "products") return queryProducts(payload);
    if (kind === "campaigns") return queryCampaigns(payload);

    logger.warn("[DashboardQuery] backend section requested before implementation", { kind });
    return { ok: false, disabled: true, code: "DASHBOARD_QUERY_NOT_IMPLEMENTED", kind, flags: activeFlags };
  }

  return {
    flags,
    query,
  };
}

module.exports = {
  createDashboardQueryService,
};
