"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createDashboardQueryService } = require("../src/main/dashboard-query-service");

const ROOT = path.resolve(__dirname, "..");
const CURRENT_PERIOD = { dateFrom: "2026-06-01", dateTo: "2026-06-30" };
const HISTORICAL_PERIOD = { dateFrom: "2026-05-01", dateTo: "2026-05-31" };

function row(order, date, status, sku, city) {
  return {
    taagerOrderNumber: order,
    createdAt: date,
    orderStatusBucket: status,
    orderStatus: status,
    sku,
    products: sku,
    qty: 1,
    dashboardTotalPrice: 100,
    profitAfterTax: 20,
    city: city || "Riyadh",
  };
}

const rows = [
  row("CUR-400-1", "2026-06-05", "confirmed", "SKU-400"),
  ...Array.from({ length: 9 }, (_, i) => row("CUR-400-X-" + i, "2026-06-05", "canceled_by_you", "SKU-400")),
  row("OLD-400-D-1", "2026-05-05", "delivered", "SKU-400"),
  row("OLD-400-D-2", "2026-05-05", "delivered", "SKU-400"),
  row("OLD-400-P-1", "2026-05-05", "received", "SKU-400"),
  row("OLD-400-P-2", "2026-05-05", "received", "SKU-400"),
  row("OLD-400-P-3", "2026-05-05", "received", "SKU-400"),
  row("CUR-FALLBACK-1", "2026-06-06", "confirmed", "SKU-FALLBACK"),
  row("CUR-FALLBACK-2", "2026-06-06", "confirmed", "SKU-FALLBACK"),
  row("OLD-ONLY-D", "2026-05-07", "delivered", "SKU-HISTORICAL-ONLY"),
  row("OLD-ONLY-F", "2026-05-07", "failed", "SKU-HISTORICAL-ONLY"),
  row("CUR-CITY-ZERO", "2026-06-08", "confirmed", "SKU-CITY-ZERO", "Jeddah"),
  row("OLD-CITY-ZERO-D", "2026-05-08", "delivered", "SKU-CITY-ZERO", "Jeddah"),
  row("OLD-CITY-ZERO-F-1", "2026-05-08", "failed", "SKU-CITY-ZERO", "Jeddah"),
  row("OLD-CITY-ZERO-F-2", "2026-05-08", "failed", "SKU-CITY-ZERO", "Jeddah"),
];

function createService() {
  return createDashboardQueryService({
    getAccounts: () => ({ account: { snapshot: rows } }),
    getAllowedAccountIds: () => ["account"],
    getRevision: () => 1,
  });
}

function queryProducts(mode) {
  return createService().query({
    kind: "products",
    accountIds: ["account"],
    dateFrom: CURRENT_PERIOD.dateFrom,
    dateTo: CURRENT_PERIOD.dateTo,
    deliveredDateMode: mode,
    ndrDateFrom: mode === "expected" ? HISTORICAL_PERIOD.dateFrom : CURRENT_PERIOD.dateFrom,
    ndrDateTo: mode === "expected" ? HISTORICAL_PERIOD.dateTo : CURRENT_PERIOD.dateTo,
    allRows: true,
  }).rows;
}

function queryCities(mode) {
  return createService().query({
    kind: "cities",
    accountIds: ["account"],
    dateFrom: CURRENT_PERIOD.dateFrom,
    dateTo: CURRENT_PERIOD.dateTo,
    deliveredDateMode: mode,
    ndrDateFrom: mode === "expected" ? HISTORICAL_PERIOD.dateFrom : CURRENT_PERIOD.dateFrom,
    ndrDateTo: mode === "expected" ? HISTORICAL_PERIOD.dateTo : CURRENT_PERIOD.dateTo,
    allRows: true,
  }).cities;
}

function createStorage() {
  const values = Object.create(null);
  return {
    getItem: (key) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null,
    setItem: (key, value) => { values[key] = String(value); },
    removeItem: (key) => { delete values[key]; },
  };
}

async function runLegacyAggregator() {
  const storage = createStorage();
  storage.setItem("khod_active_account_id", "account");
  const window = {
    _kbotLang: "en",
    _kbotTheme: "dark",
    addEventListener: () => {},
    removeEventListener: () => {},
    dashboardAccountsList: [],
    currentActiveAccountLabel: "Account",
    api: {
      getDashboardSnapshot: async () => ({ ok: true, data: { account: { snapshot: rows, snapshotMonth: "2026-06" } } }),
      getCredentials: async () => ({ accounts: [{ id: "account", easyEmail: "account@example.com", label: "Account" }] }),
    },
  };
  window.window = window;
  window.localStorage = storage;
  window.dashboardI18n = {
    t: (key) => key,
    raw: (value) => String(value || ""),
    number: (value) => String(value || 0),
    formatTimestamp: () => "",
    formatMonth: () => "June 2026",
    monthName: () => "June",
    locale: () => "en-US",
    isRtl: () => false,
  };
  const context = vm.createContext({
    window,
    localStorage: storage,
    document: { documentElement: { getAttribute: () => "en" } },
    console,
    Promise,
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    JSON,
    RegExp,
    parseFloat,
    parseInt,
    isNaN,
    isFinite,
    setTimeout,
    clearTimeout,
  });
  [
    "src/renderer/pages/khod-product-names.js",
    "src/renderer/pages/khod-status.js",
    "src/renderer/pages/dashboard/dashboard-filter-bus.js",
    "src/renderer/pages/dashboard/dashboard-aggregator-score.js",
    "src/renderer/pages/dashboard/dashboard-aggregator-geo.js",
    "src/renderer/pages/dashboard/dashboard-insight-engine.js",
    "src/renderer/pages/dashboard/dashboard-aggregator.js",
  ].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  });
  window.DashboardPeriodState.setCustomRange(CURRENT_PERIOD.dateFrom, CURRENT_PERIOD.dateTo);
  window.DashboardExpectedNdrRangeState.setRange(HISTORICAL_PERIOD.dateFrom, HISTORICAL_PERIOD.dateTo);
  window.DashboardDeliveredDateState.set("expected");
  window.invalidateDashboardCache();
  return new Promise((resolve, reject) => {
    window.runDashboardAggregator((result) => result ? resolve(result) : reject(new Error("No dashboard result")));
  });
}

function verifyBoundedRates(products, label) {
  products.forEach((product) => {
    assert.ok(product.ndrPct >= 0 && product.ndrPct <= 100, label + " NDR is bounded");
    assert.ok(product.drRate >= 0 && product.drRate <= 100, label + " DR is bounded");
    assert.ok(product.deliveredCount <= product.netOrderCount, label + " delivered does not exceed net orders");
    if (product.deliveredCount === 0) assert.equal(product.ndrPct, 0, label + " zero delivered means zero NDR");
  });
}

(async function main() {
  const actual = queryProducts("actual");
  const expected = queryProducts("expected");
  const actualCities = queryCities("actual");
  const expectedCities = queryCities("expected");
  verifyBoundedRates(actual, "Backend actual");
  verifyBoundedRates(expected, "Backend expected");

  const product400 = expected.find((product) => product.sku === "SKU-400");
  assert.ok(product400, "Reproduction product exists");
  assert.equal(product400.totalOrderCount, 10, "Raw orders still include canceled-by-you");
  assert.equal(product400.netOrderCount, 1, "Net orders exclude canceled-by-you");
  assert.ok(product400.deliveredCount === 0 || product400.deliveredCount === 1, "Expected deliveries are bounded by the one net order");
  assert.equal(product400.deliveredCount, 0, "Expected product deliveries round to zero");
  assert.equal(product400.ndrPct, 0, "Zero displayed product deliveries force zero NDR");
  assert.equal(product400.drRate, 100, "Expected DR is historical delivered / historical confirmed");
  assert.equal(product400.rateMode, "historical_cohort");
  assert.equal(product400.ndrBaseOrders, 5);
  assert.equal(product400.ndrDeliveredOrders, 2);
  assert.equal(product400.drBaseOrders, 2);
  assert.equal(product400.drDeliveredOrders, 2);

  const fallback = expected.find((product) => product.sku === "SKU-FALLBACK");
  assert.ok(fallback, "Current product without history exists");
  assert.equal(fallback.rateSource, "global_fallback", "Missing product history uses global historical rates");
  assert.ok(fallback.deliveredCount <= fallback.netOrderCount, "Global fallback projection is bounded by current net orders");
  assert.equal(expected.some((product) => product.sku === "SKU-HISTORICAL-ONLY"), false, "Historical-only products are excluded");

  [actualCities, expectedCities].forEach((cities, index) => {
    cities.forEach((city) => {
      if (city.deliveredOrders === 0) assert.equal(city.ndrPct, 0, (index ? "Expected" : "Actual") + " city zero delivered means zero NDR");
    });
  });
  const zeroCity = expectedCities.find((city) => city.name === "Jeddah");
  assert.ok(zeroCity, "Expected zero-delivery city exists");
  assert.equal(zeroCity.deliveredOrders, 0, "Expected city deliveries round to zero");
  assert.equal(zeroCity.ndrPct, 0, "Zero displayed city deliveries force zero NDR");

  const legacy = await runLegacyAggregator();
  const legacyProducts = legacy.products.rankedList;
  const legacyCities = Object.values(legacy.geo.cityStats || {});
  verifyBoundedRates(legacyProducts, "Legacy expected");
  legacyCities.forEach((city) => {
    if (city.deliveredOrders === 0) assert.equal(city.ndrPct, 0, "Legacy city zero delivered means zero NDR");
  });
  assert.equal(legacyProducts.some((product) => product.sku === "SKU-HISTORICAL-ONLY"), false, "Legacy excludes historical-only products");
  ["SKU-400", "SKU-FALLBACK"].forEach((sku) => {
    const backendProduct = expected.find((product) => product.sku === sku);
    const legacyProduct = legacyProducts.find((product) => product.sku === sku);
    assert.ok(legacyProduct, "Legacy product exists for " + sku);
    assert.equal(legacyProduct.deliveredCount, backendProduct.deliveredCount, sku + " delivered parity");
    assert.equal(legacyProduct.ndrPct, backendProduct.ndrPct, sku + " NDR parity");
    assert.equal(legacyProduct.drRate, backendProduct.drRate, sku + " DR parity");
    assert.equal(legacyProduct.ndrBaseOrders, backendProduct.ndrBaseOrders, sku + " NDR base parity");
    assert.equal(legacyProduct.ndrDeliveredOrders, backendProduct.ndrDeliveredOrders, sku + " NDR delivered parity");
    assert.equal(legacyProduct.drBaseOrders, backendProduct.drBaseOrders, sku + " DR base parity");
    assert.equal(legacyProduct.drDeliveredOrders, backendProduct.drDeliveredOrders, sku + " DR delivered parity");
    assert.equal(legacyProduct.rateMode, backendProduct.rateMode, sku + " rate mode parity");
    assert.equal(legacyProduct.rateSource, backendProduct.rateSource, sku + " rate source parity");
  });

  const productsSection = fs.readFileSync(path.join(ROOT, "src/renderer/pages/dashboard/sections/section5-products.js"), "utf8");
  const forecastSection = fs.readFileSync(path.join(ROOT, "src/renderer/pages/dashboard/sections/section9-product-forecast.js"), "utf8");
  const citiesSection = fs.readFileSync(path.join(ROOT, "src/renderer/pages/dashboard/sections/section-cities.js"), "utf8");
  const cityDrawer = fs.readFileSync(path.join(ROOT, "src/renderer/pages/dashboard/sections/section-city-drawer.js"), "utf8");
  assert.ok(!forecastSection.includes("if (realNdr  === 0) realNdr  = 0.30"), "Product calculator no longer invents 30% NDR");
  assert.ok(forecastSection.includes('min="0" max="100"'), "Product calculator accepts zero NDR");
  assert.ok(productsSection.includes("rateBadgeHTML(p.deliveredCount > 0 ? p.ndrPct : 0, 'ndr')"), "Section 5 explicitly renders zero NDR for zero deliveries");
  assert.ok(citiesSection.includes("city.deliveredOrders != null ? city.deliveredOrders"), "City section preserves literal zero delivered orders");
  assert.ok(cityDrawer.includes("if (Number(cityData.deliveredOrders || 0) <= 0) ndrPct = 0"), "City drawer forces zero NDR for zero deliveries");

  console.log("[PASS] Product NDR/DR integrity: bounded actual/expected rates, historical DR, net-order projection, and backend/legacy parity");
}()).catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
