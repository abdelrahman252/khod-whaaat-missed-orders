"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const flags = [
  "KHOD_DASHBOARD_QUERY_SHADOW",
  "KHOD_DASHBOARD_QUERY_ORDERS",
  "KHOD_DASHBOARD_QUERY_PRODUCTS",
  "KHOD_DASHBOARD_QUERY_CAMPAIGNS",
  "KHOD_DASHBOARD_QUERY_CITIES",
];

const root = path.resolve(__dirname, "..");
const envText = fs.existsSync(path.join(root, ".env")) ? fs.readFileSync(path.join(root, ".env"), "utf8") : "";
const parsedEnv = dotenv.parse(envText);
const expectedRuntimePolicy = {
  KHOD_DASHBOARD_QUERY_SHADOW: "0",
  KHOD_DASHBOARD_QUERY_ORDERS: "1",
  KHOD_DASHBOARD_QUERY_PRODUCTS: "1",
  KHOD_DASHBOARD_QUERY_CAMPAIGNS: "1",
  KHOD_DASHBOARD_QUERY_CITIES: "0",
};

for (const flag of flags) {
  assert.match(parsedEnv[flag] || "", /^(0|1)$/, `${flag} is loadable by dotenv syntax`);
  assert.equal(parsedEnv[flag], expectedRuntimePolicy[flag], `${flag} matches the production rollout policy`);
  // Exercise the enabled path independently from the production defaults.
  process.env[flag] = "1";
  assert.equal(process.env[flag], "1", `${flag} is enabled for query verification`);
}

const main = fs.readFileSync(path.join(root, "src", "main", "main.js"), "utf8");
const section3 = [
  "section3-orders.js",
  "section3-orders-hydrated.js",
].map((name) => fs.readFileSync(path.join(root, "src", "renderer", "pages", "dashboard", "sections", name), "utf8")).join("\n");
assert.ok(main.includes('dashboardQueryRuntimeFlag("KHOD_DASHBOARD_QUERY_ORDERS", "TAAGER_DASHBOARD_QUERY_ORDERS")'), "Main process reads the canonical KHOD WHAAT orders query flag before the legacy fallback");
assert.ok(section3.includes("DashboardQueryRuntime.currentFlags") && section3.includes("!!(currentQueryFlags && currentQueryFlags.orders)"), "Section 3 consumes already-resolved KHOD WHAAT query flags without waiting for a second full-data render");
assert.ok(section3.includes("backendOrdersEnabled = !!(flags && flags.orders);"), "Section 3 enables backend orders only from KHOD WHAAT orders query flags");
assert.ok(section3.includes("var currentQueryFlags") && section3.includes(": null;"), "Section 3 leaves backend orders disabled when resolved flags are unavailable");
assert.ok(section3.includes("function canUseBackendOrdersPage()") && section3.includes("backendOrdersEnabled &&"), "Section 3 backend orders gate depends on backendOrdersEnabled");
assert.ok(section3.includes("DashboardQueryRuntime.query('orders'"), "Section 3 table interactions call the backend orders query when enabled");

require("./verify-dashboard-query-service");

console.log(`[PASS] KHOD WHAAT dashboard query verification covered enabled paths with production shadow/cities queries disabled`);
