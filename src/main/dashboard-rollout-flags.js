"use strict";

const FLAG_NAMES = Object.freeze({
  shadow: "KHOD_DASHBOARD_QUERY_SHADOW",
  orders: "KHOD_DASHBOARD_QUERY_ORDERS",
  products: "KHOD_DASHBOARD_QUERY_PRODUCTS",
  campaigns: "KHOD_DASHBOARD_QUERY_CAMPAIGNS",
  marketingIncrementalSync: "KHOD_MARKETING_INCREMENTAL_SYNC",
});

const LEGACY_FLAG_NAMES = Object.freeze({
  shadow: "TAAGER_DASHBOARD_QUERY_SHADOW",
  orders: "TAAGER_DASHBOARD_QUERY_ORDERS",
  products: "TAAGER_DASHBOARD_QUERY_PRODUCTS",
  campaigns: "TAAGER_DASHBOARD_QUERY_CAMPAIGNS",
  marketingIncrementalSync: "TAAGER_MARKETING_INCREMENTAL_SYNC",
});

function envFlagEnabled(name) {
  const raw = String(process.env[name] || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function flagValueEnabled(value) {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function readDashboardRolloutFlags(env) {
  const source = env || process.env;

  return {
    shadow: flagValueEnabled(source[FLAG_NAMES.shadow]) || flagValueEnabled(source[LEGACY_FLAG_NAMES.shadow]),
    orders: flagValueEnabled(source[FLAG_NAMES.orders]) || flagValueEnabled(source[LEGACY_FLAG_NAMES.orders]),
    products: flagValueEnabled(source[FLAG_NAMES.products]) || flagValueEnabled(source[LEGACY_FLAG_NAMES.products]),
    campaigns: flagValueEnabled(source[FLAG_NAMES.campaigns]) || flagValueEnabled(source[LEGACY_FLAG_NAMES.campaigns]),
    marketingIncrementalSync: flagValueEnabled(source[FLAG_NAMES.marketingIncrementalSync]) || flagValueEnabled(source[LEGACY_FLAG_NAMES.marketingIncrementalSync]),
  };
}

module.exports = {
  FLAG_NAMES,
  LEGACY_FLAG_NAMES,
  readDashboardRolloutFlags,
  envFlagEnabled,
  flagValueEnabled,
};
