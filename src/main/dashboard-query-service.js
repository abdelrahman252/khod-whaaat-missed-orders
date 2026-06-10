"use strict";

const { readDashboardRolloutFlags } = require("./dashboard-rollout-flags");
const ordersQueryCore = require("../renderer/pages/dashboard/dashboard-orders-query-core");

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
    return {
      ok: true,
      kind: "products",
      products: {
        summary: Object.assign({}, products.summary || {}),
        rankedList: rows,
      },
      rows,
      pagination: {
        page: 1,
        pageSize: rows.length || 1,
        total: rows.length,
        totalPages: 1,
      },
      summary: Object.assign({}, products.summary || {}),
      source: "legacy-computed-main-source",
    };
  }

  function queryCampaigns(payload) {
    const intel = payload.campaignIntel && typeof payload.campaignIntel === "object" ? payload.campaignIntel : {};
    const campaigns = Array.isArray(intel.allCampaigns) ? intel.allCampaigns.slice() : [];
    const products = Array.isArray(intel.allProductGroups) ? intel.allProductGroups.slice() : [];
    return {
      ok: true,
      kind: "campaigns",
      campaignIntel: Object.assign({}, intel, {
        allCampaigns: campaigns,
        allProductGroups: products,
      }),
      rows: campaigns,
      productRows: products,
      pagination: {
        campaigns: { page: 1, pageSize: campaigns.length || 1, total: campaigns.length, totalPages: 1 },
        products: { page: 1, pageSize: products.length || 1, total: products.length, totalPages: 1 },
      },
      summary: Object.assign({}, intel.totals || {}),
      source: "legacy-computed-main-source",
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
