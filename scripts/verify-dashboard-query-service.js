"use strict";

const assert = require("assert");
const { createDashboardQueryService } = require("../src/main/dashboard-query-service");

const accounts = {
  a1: { snapshot: [], marketing: { tiktok: { summary: { campaignBreakdown: [] } } } },
  a2: { snapshot: [], marketing: { facebook: { summary: { campaignBreakdown: [] } } } },
};

for (let i = 0; i < 15000; i++) {
  const accountId = Math.floor(i / 40) % 2 ? "a1" : "a2";
  const sku = "SKU-" + (i % 40);
  accounts[accountId].snapshot.push({
    taagerOrderNumber: "ORDER-" + i,
    createdAt: "2026-05-" + String((i % 28) + 1).padStart(2, "0"),
    orderStatusBucket: i % 4 === 0 ? "delivered" : "confirmed",
    products: "Product " + (i % 40),
    sku,
    city: "City " + (i % 20),
    qty: 1,
    dashboardTotalPrice: 100,
    profitAfterTax: 20,
  });
}

accounts.a1.marketing.tiktok.summary.campaignBreakdown.push({
  campaign: "Scale SKU-1 now",
  spend: 500,
  currency: "USD",
  clicks: 100,
  impressions: 1000,
  landingPageViews: 0,
  total_landing_page_view: 200,
});
accounts.a2.marketing.facebook.summary.campaignBreakdown.push({
  campaign: "Unknown campaign",
  spend: 100,
  clicks: 10,
  impressions: 100,
});

let revision = 1;
const service = createDashboardQueryService({
  getAccounts: () => accounts,
  getAllowedAccountIds: () => ["a1", "a2"],
  getRevision: () => revision,
});

const startedAt = Date.now();
const orders = service.query({
  kind: "orders",
  accountIds: ["a1", "a2"],
  dateFrom: "2026-05-01",
  dateTo: "2026-05-31",
  page: 2,
  pageSize: 25,
});
assert.equal(orders.ok, true);
assert.equal(orders.pagination.total, 15000);
assert.equal(orders.rows.length, 25);
assert.equal(orders.summary.rawOrders, 15000);
assert.equal(orders.summary.delivered, 3750);

const deliveredOrdersPage = service.query({
  kind: "orders",
  accountIds: ["a1", "a2"],
  dateFrom: "2026-05-01",
  dateTo: "2026-05-31",
  page: 1,
  pageSize: 25,
  filters: { stageId: "status:delivered" },
});
assert.equal(deliveredOrdersPage.ok, true);
assert.equal(deliveredOrdersPage.pagination.total, 3750, "Section 3 exact-status stage filter stays backend-paged");
assert.equal(deliveredOrdersPage.rows.length, 25);
assert.ok(deliveredOrdersPage.rows.every((row) => row.statusBucket === "delivered"));

const confirmedMilestonePage = service.query({
  kind: "orders",
  accountIds: ["a1", "a2"],
  dateFrom: "2026-05-01",
  dateTo: "2026-05-31",
  page: 1,
  pageSize: 25,
  filters: { stageId: "confirmed" },
});
assert.equal(confirmedMilestonePage.pagination.total, 15000, "Confirmed milestone includes exact Confirmed and Delivered orders");
assert.ok(confirmedMilestonePage.rows.every((row) => ["confirmed", "delivered"].includes(row.statusBucket)));

const exactConfirmedPage = service.query({
  kind: "orders",
  accountIds: ["a1", "a2"],
  dateFrom: "2026-05-01",
  dateTo: "2026-05-31",
  page: 1,
  pageSize: 25,
  filters: { stageId: "status:confirmed" },
});
assert.equal(exactConfirmedPage.pagination.total, 11250, "Explicit exact-status Confirmed filter remains available");
assert.ok(exactConfirmedPage.rows.every((row) => row.statusBucket === "confirmed"));

const recentOrdersPage = service.query({
  kind: "orders",
  accountIds: ["a1", "a2"],
  dateFrom: "2026-05-01",
  dateTo: "2026-05-31",
  page: 1,
  pageSize: 25,
  filters: { dateShortcut: "7" },
});
const expectedRecentOrderCount = Object.values(accounts).reduce((sum, account) => {
  return sum + account.snapshot.filter((row) => row.createdAt >= "2026-05-22").length;
}, 0);
assert.equal(recentOrdersPage.ok, true);
assert.equal(recentOrdersPage.pagination.total, expectedRecentOrderCount, "Section 3 last-7-days filter uses latest order date as anchor");
assert.equal(recentOrdersPage.rows.length, 25);
assert.ok(recentOrdersPage.rows.every((row) => row.dashboardDate >= "2026-05-22"));

const productsStartedAt = Date.now();
const products = service.query({
  kind: "products",
  accountIds: ["a1", "a2"],
  dateFrom: "2026-05-01",
  dateTo: "2026-05-31",
  page: 1,
  pageSize: 10,
});
assert.equal(products.ok, true);
assert.equal(products.pagination.total, 40);
assert.equal(products.rows.length, 10);
assert.equal(products.summary.totalOrders, 15000);
assert.ok(products.rows.some((row) => row.accountCount === 2));
assert.ok(products.rows.every((row) => Number.isFinite(row.ndrPct) && Number.isFinite(row.profitLoss)));
assert.ok(Date.now() - productsStartedAt < 750, "Initial Products page query should complete within 750ms");

const deliveredProducts = service.query({
  kind: "products",
  accountIds: ["a1", "a2"],
  filters: { statusKey: "delivered" },
  sortBy: "commission",
  sortDir: "desc",
  page: 1,
  pageSize: 10,
});
assert.equal(deliveredProducts.ok, true);
assert.equal(deliveredProducts.rows.length, 10);
assert.ok(deliveredProducts.rows.every((row) => row.deliveredCount > 0));

const campaigns = service.query({
  kind: "campaigns",
  accountIds: ["a1", "a2"],
  page: 1,
  pageSize: 25,
});
assert.equal(campaigns.ok, true);
assert.equal(campaigns.pagination.total, 2);
assert.ok(campaigns.rows.some((row) => row.attributionVerified && row.productSku === "SKU-1"));
assert.ok(campaigns.rows.some((row) => !row.attributionVerified));

const campaignOverviewStartedAt = Date.now();
const campaignOverview = service.query({
  kind: "campaign-overview",
  accountIds: ["a1", "a2"],
  reportingCurrency: "SAR",
  platform: "all",
  campaignPage: 1,
  productPage: 1,
  pageSize: 10,
});
assert.equal(campaignOverview.ok, true);
assert.equal(campaignOverview.campaignRows.length, 2);
assert.equal(campaignOverview.productRows.length, 1);
assert.equal(campaignOverview.campaignRows[0].rawCurrency, "USD");
assert.equal(campaignOverview.campaignRows[0].rawSpend, 500);
assert.equal(campaignOverview.campaignRows[0].spend, 1875);
assert.equal(campaignOverview.productRows[0].accountId, "a1", "Exact SKU attribution stays inside the campaign account");
assert.equal(campaignOverview.productRows[0].trafficViews, 200, "A positive platform fallback is used when the normalized landing-page field is zero");
assert.equal(campaignOverview.productRows[0].conversionRateAvailable, true, "Conversion rate is marked available only with a usable tracked-view denominator");
assert.equal(campaignOverview.objectives.length > 0, true);
assert.ok(Date.now() - campaignOverviewStartedAt < 750, "Initial Campaigns page query should complete within 750ms");

const bundleSkuService = createDashboardQueryService({
  getAccounts: () => ({
    bundle: {
      country: "sa",
      snapshot: [
        { taagerOrderNumber: "SINGLE-1", taagerCountry: "SA", sku: "SKU-X", products: "Single Product", orderStatusBucket: "confirmed", profitAfterTax: 10 },
        { taagerOrderNumber: "BUNDLE-1", taagerCountry: "SA", sku: "SKU-Y, SKU-X", products: "Bundle Product", orderStatusBucket: "confirmed", profitAfterTax: 20 },
      ],
      marketing: {
        tiktok: { summary: { currency: "SAR", campaignBreakdown: [
          { campaign: "Scale SKU-X", spend: 300, currency: "SAR" },
          { campaign: "Scale SKU-X SKU-Y", spend: 500, currency: "SAR" },
        ] } },
      },
    },
  }),
  getAllowedAccountIds: () => ["bundle"],
  getRevision: () => 1,
  getMarketingRevision: () => 1,
});
const bundleSkuOverview = bundleSkuService.query({
  kind: "campaign-overview",
  accountIds: ["bundle"],
  reportingCurrency: "SAR",
  platform: "all",
  campaignPage: 1,
  productPage: 1,
  pageSize: 10,
});
const singleSkuCampaign = bundleSkuOverview.campaignRows.find((row) => row.campaign === "Scale SKU-X");
const bundleSkuCampaign = bundleSkuOverview.campaignRows.find((row) => row.campaign === "Scale SKU-X SKU-Y");
assert.equal(singleSkuCampaign.attributionVerified, true, "Single-SKU campaigns should not be blocked by bundle rows that also contain the SKU");
assert.equal(singleSkuCampaign.productSku, "SKU-X");
assert.equal(bundleSkuCampaign.attributionVerified, true, "Campaigns containing all bundle SKUs can attribute to the bundle row");
assert.equal(bundleSkuCampaign.productSku, "SKU-Y, SKU-X");

const multiProductCampaignService = createDashboardQueryService({
  getAccounts: () => ({
    multi: {
      snapshot: [
        { taagerOrderNumber: "MULTI-1", taagerCountry: "SA", sku: "SKU-A", products: "Product A", orderStatusBucket: "confirmed" },
        { taagerOrderNumber: "MULTI-1", taagerCountry: "SA", sku: "SKU-B", products: "Product B", orderStatusBucket: "confirmed" },
        { taagerOrderNumber: "NET-2", taagerCountry: "SA", sku: "SKU-A", products: "Product A", orderStatusBucket: "confirmed" },
        { taagerOrderNumber: "CANCELED-3", taagerCountry: "SA", sku: "SKU-A", products: "Product A", orderStatusBucket: "canceled" },
      ],
      marketing: {
        tiktok: {
          summary: {
            campaignBreakdown: [
              { campaign: "Scale SKU-A", spend: 100, currency: "SAR" },
              { campaign: "Scale SKU-B", spend: 100, currency: "SAR" },
            ],
          },
        },
      },
    },
  }),
  getAllowedAccountIds: () => ["multi"],
  getRevision: () => 1,
});
const multiProductCampaignOverview = multiProductCampaignService.query({
  kind: "campaign-overview",
  accountIds: ["multi"],
  reportingCurrency: "SAR",
  platform: "all",
  campaignPage: 1,
  productPage: 1,
  pageSize: 10,
});
assert.equal(multiProductCampaignOverview.totals.productOrderCount, 4, "Product totals may include one order under multiple SKUs and visible KHOD WHAAT canceled orders");
assert.equal(multiProductCampaignOverview.totals.taagerOrders, 3, "Campaign KPI uses unique matched KHOD WHAAT lifecycle orders");

const independentCampaignPage = service.query({
  kind: "campaign-rows",
  accountIds: ["a1", "a2"],
  reportingCurrency: "SAR",
  filters: { match: "unmatched" },
  page: 1,
  pageSize: 10,
});
assert.equal(independentCampaignPage.rows.length, 1);
assert.equal(independentCampaignPage.rows[0].attributionVerified, false);

const independentProductActions = service.query({
  kind: "campaign-product-actions",
  accountIds: ["a1", "a2"],
  reportingCurrency: "SAR",
  page: 1,
  pageSize: 10,
});
assert.equal(independentProductActions.rows.length, 1);

const campaignAi = service.query({
  kind: "campaign-ai-context",
  accountIds: ["a1", "a2"],
  reportingCurrency: "SAR",
});
assert.equal(campaignAi.ok, true);
assert.ok(campaignAi.productActions.length <= 20);
assert.ok(campaignAi.topSpendCampaigns.length <= 20);

const details = service.query({
  kind: "product-details",
  accountIds: ["a1", "a2"],
  productKeys: [products.rows[0].key, products.rows[1].key],
});
assert.equal(details.ok, true);
assert.ok(details.details[products.rows[0].key]);
assert.ok(details.details[products.rows[1].key]);
assert.ok(Array.isArray(details.details[products.rows[0].key].cityBreakdown));
assert.ok(Array.isArray(details.details[products.rows[0].key].quantityCityBreakdown));

const productOptions = service.query({
  kind: "product-options",
  accountIds: ["a1", "a2"],
});
assert.equal(productOptions.ok, true);
assert.equal(productOptions.rows.length, 40);

const expectedNdrAccounts = {
  june: { snapshot: [], marketing: { tiktok: { summary: { campaignBreakdown: [] } } } },
};
for (let day = 1; day <= 30; day++) {
  expectedNdrAccounts.june.snapshot.push({
    taagerOrderNumber: "JUNE-" + day,
    createdAt: "2026-06-" + String(day).padStart(2, "0"),
    orderStatusBucket: day <= 2 ? "delivered" : "confirmed",
    products: "June Product",
    sku: "JUNE-SKU",
    city: "Riyadh",
    qty: 1,
    dashboardTotalPrice: 100,
    profitAfterTax: 20,
  });
}
const expectedNdrService = createDashboardQueryService({
  getAccounts: () => expectedNdrAccounts,
  getAllowedAccountIds: () => ["june"],
  getRevision: () => 1,
});
const juneExpectedProducts = expectedNdrService.query({
  kind: "products",
  accountIds: ["june"],
  dateFrom: "2026-06-01",
  dateTo: "2026-06-30",
  deliveredDateMode: "expected",
  ndrDateFrom: "2026-06-01",
  ndrDateTo: "2026-06-08",
  page: 1,
  pageSize: 10,
});
assert.equal(juneExpectedProducts.ok, true);
assert.equal(juneExpectedProducts.summary.netOrderCount, 30, "Expected NDR keeps full selected-period net orders visible");
assert.equal(juneExpectedProducts.rows.length, 1, "Expected NDR does not empty the visible product list");
assert.equal(juneExpectedProducts.rows[0].netOrderCount, 30, "Product base orders stay on the full June period");
assert.equal(juneExpectedProducts.rows[0].ndrBaseOrders, 8, "Expected product NDR base is the closed-cycle createdAt cohort");
assert.equal(juneExpectedProducts.rows[0].ndrDeliveredOrders, 2, "Expected product NDR delivered count is from the closed-cycle createdAt cohort");
assert.equal(juneExpectedProducts.rows[0].expectedNdrRate, 0.25, "Expected product NDR is delivered/net from the closed-cycle cohort");
assert.equal(juneExpectedProducts.rows[0].expectedDeliveriesExact, 7.5, "Expected deliveries apply cohort NDR to the full-period net orders");
assert.equal(juneExpectedProducts.rows[0].deliveredCount, 8, "Displayed expected deliveries are projected, not limited to cohort deliveries");

const juneExpectedCities = expectedNdrService.query({
  kind: "cities",
  accountIds: ["june"],
  dateFrom: "2026-06-01",
  dateTo: "2026-06-30",
  deliveredDateMode: "expected",
  ndrDateFrom: "2026-06-01",
  ndrDateTo: "2026-06-08",
});
assert.equal(juneExpectedCities.ok, true);
assert.equal(juneExpectedCities.cities.length, 1, "Expected NDR does not empty visible cities");
assert.equal(juneExpectedCities.cities[0].count, 30, "City net orders stay on the full June period");
assert.equal(juneExpectedCities.cities[0].ndrBaseOrders, 8, "City NDR base uses the expected createdAt cohort");
assert.equal(juneExpectedCities.cities[0].ndrDeliveredOrders, 2, "City NDR delivered uses the expected createdAt cohort");
assert.equal(juneExpectedCities.cities[0].expectedNdrRate, 0.25, "City expected NDR uses closed-cycle delivered/net");

const juneEmptyCohort = expectedNdrService.query({
  kind: "products",
  accountIds: ["june"],
  dateFrom: "2026-06-01",
  dateTo: "2026-06-30",
  deliveredDateMode: "expected",
  ndrDateFrom: "2026-05-01",
  ndrDateTo: "2026-05-08",
  page: 1,
  pageSize: 10,
});
assert.equal(juneEmptyCohort.ok, true);
assert.equal(juneEmptyCohort.rows.length, 1, "Empty expected NDR cohort must not empty full-period product rows");
assert.equal(juneEmptyCohort.rows[0].netOrderCount, 30);
assert.equal(juneEmptyCohort.rows[0].insufficientHistory, true, "Empty expected NDR cohort is marked as insufficient history");

assert.ok(Date.now() - startedAt < 6000, "Synthetic 15k query verification should complete quickly");
const cachedStartedAt = Date.now();
service.query({
  kind: "orders",
  accountIds: ["a1", "a2"],
  dateFrom: "2026-05-01",
  dateTo: "2026-05-31",
  page: 2,
  pageSize: 25,
});
assert.ok(Date.now() - cachedStartedAt < 750, "Cached local page query should complete within 750ms");
const cachedProductsStartedAt = Date.now();
service.query({
  kind: "products",
  accountIds: ["a1", "a2"],
  dateFrom: "2026-05-01",
  dateTo: "2026-05-31",
  page: 1,
  pageSize: 10,
});
assert.ok(Date.now() - cachedProductsStartedAt < 750, "Cached Products page query should complete within 750ms");
const cachedCampaignsStartedAt = Date.now();
service.query({
  kind: "campaign-overview",
  accountIds: ["a1", "a2"],
  reportingCurrency: "SAR",
  platform: "all",
  campaignPage: 1,
  productPage: 1,
  pageSize: 10,
});
assert.ok(Date.now() - cachedCampaignsStartedAt < 750, "Cached Campaigns page query should complete within 750ms");

const parityService = createDashboardQueryService({
  getAccounts: () => ({
    one: { snapshot: [
      { taagerOrderNumber: "D-1", taagerCountry: "SA", sku: "SAME", products: "Same Product", orderStatusBucket: "delivered", qty: 1, dashboardTotalPrice: 100, profitAfterTax: 20, city: "Riyadh" },
      { taagerOrderNumber: "X-1", taagerCountry: "SA", sku: "SAME", products: "Same Product", orderStatusBucket: "canceled", qty: 5, dashboardTotalPrice: 500, profitAfterTax: 80, city: "Riyadh" },
    ] },
    two: { snapshot: [
      { taagerOrderNumber: "C-1", taagerCountry: "SA", sku: "SAME", products: "Same Product", orderStatusBucket: "confirmed", qty: 2, dashboardTotalPrice: 200, profitAfterTax: 40, city: "Jeddah" },
    ] },
  }),
  getAllowedAccountIds: () => ["one", "two"],
  getRevision: () => 1,
});
const parityProducts = parityService.query({ kind: "products", accountIds: ["one", "two"], page: 1, pageSize: 10 });
assert.equal(parityProducts.pagination.total, 1, "All Accounts combines matching country + SKU");
assert.equal(parityProducts.rows[0].totalOrders, 3, "Total orders includes visible KHOD WHAAT canceled orders");
assert.equal(parityProducts.rows[0].totalOrderCount, 3, "Total order count includes visible KHOD WHAAT canceled orders");
assert.equal(parityProducts.rows[0].placedCount, 3, "Product placed count includes KHOD WHAAT lifecycle orders");
assert.equal(parityProducts.rows[0].netOrderCount, 3, "Backend net order compatibility count includes KHOD WHAAT canceled orders");
assert.equal(parityProducts.rows[0].canceledCount, 1, "KHOD WHAAT canceled is counted separately from failed");
assert.equal(parityProducts.rows[0].totalPieces, 8, "KHOD WHAAT canceled pieces remain visible in product totals");
assert.equal(parityProducts.rows[0].revenue, 20, "Product table revenue field remains earned commission for UI compatibility");
assert.equal(parityProducts.rows[0].commission, 20, "Only delivered commission is earned");

function statusRows(bucket, count, start) {
  return Array.from({ length: count }, (_, i) => ({
    taagerOrderNumber: "STATUS-" + (start + i),
    taagerCountry: "SA",
    sku: "STATUS-SPLIT",
    products: "Status Split Product",
    orderStatusBucket: bucket,
    qty: 1,
    dashboardTotalPrice: 100,
    profitAfterTax: 10,
    city: "Riyadh",
  }));
}

const statusSplitRows = [
  ...statusRows("confirmed", 30, 0),
  ...statusRows("delivered", 10, 30),
  ...statusRows("failed", 10, 40),
  ...statusRows("failed", 10, 50),
  ...statusRows("canceled", 25, 60),
  ...statusRows("received", 15, 85),
];
const statusSplitService = createDashboardQueryService({
  getAccounts: () => ({ split: { snapshot: statusSplitRows } }),
  getAllowedAccountIds: () => ["split"],
  getRevision: () => 1,
});
const statusSplitProducts = statusSplitService.query({ kind: "products", accountIds: ["split"], page: 1, pageSize: 10 });
assert.equal(statusSplitProducts.pagination.total, 1, "Status split product is grouped into one product row");
assert.equal(statusSplitProducts.rows[0].statusTotalCount, 100, "Product status-rate base includes KHOD WHAAT lifecycle rows");
assert.equal(statusSplitProducts.rows[0].confirmationStatusCount, 60, "Confirmed, delivered, and failed count as confirmed/progressed");
assert.equal(statusSplitProducts.rows[0].cancelStatusCount, 25, "KHOD WHAAT canceled counts as cancel");
assert.equal(statusSplitProducts.rows[0].pendingStatusCount, 15, "Order received normalizes to KHOD WHAAT pending");
assert.equal(statusSplitProducts.rows[0].netOrderCount, 100, "Product confirmation-rate base includes KHOD WHAAT canceled rows");
assert.equal(statusSplitProducts.rows[0].failedCount, 20, "Failed and Canceled stay separate");
assert.equal(statusSplitProducts.rows[0].canceledCount, 25, "Canceled remains separate from Failed");
assert.equal(statusSplitProducts.rows[0].confirmationPct, 60, "Confirmation share uses KHOD WHAAT lifecycle status total");
assert.equal(statusSplitProducts.rows[0].cancelPct, 25, "Cancel % uses KHOD WHAAT lifecycle status total");
assert.equal(statusSplitProducts.rows[0].pendingPct, 15, "Pending % uses KHOD WHAAT lifecycle status total");
assert.equal(
  statusSplitProducts.rows[0].confirmationPct + statusSplitProducts.rows[0].cancelPct + statusSplitProducts.rows[0].pendingPct,
  100,
  "Confirmation, cancel, and pending shares total 100%"
);
const statusSplitDetails = statusSplitService.query({
  kind: "product-details",
  accountIds: ["split"],
  productKeys: [statusSplitProducts.rows[0].key],
});
const statusCity = statusSplitDetails.details[statusSplitProducts.rows[0].key].cityBreakdown[0];
assert.equal(statusCity.statusTotalCount, 100, "Product detail city status base includes KHOD WHAAT lifecycle rows");
assert.equal(statusCity.netOrderCount, 100, "Product detail city confirmation-rate base includes KHOD WHAAT canceled rows");
assert.equal(statusCity.confirmationPct, 60, "Product detail city confirmation share uses KHOD WHAAT status groups");
assert.equal(statusCity.cancelPct, 25, "Product detail city cancel % uses KHOD WHAAT status groups");
assert.equal(statusCity.pendingPct, 15, "Product detail city pending % uses KHOD WHAAT status groups");
assert.equal(statusCity.confirmationPct + statusCity.cancelPct + statusCity.pendingPct, 100, "City status shares total 100%");

const preserveAccounts = {
  sar: {
    country: "sa",
    snapshot: [
      {
        taagerOrderNumber: "SAME-ORDER",
        taagerCountry: "sa",
        createdAt: "2026-05-10",
        orderStatusBucket: "delivered",
        sku: "SKU-SA",
        products: "Saudi Product",
        nativeCurrency: "SAR",
        nativeTotalPrice: 100,
        nativeCommission: 20,
        city: "Riyadh",
      },
    ],
    marketing: { facebook: { summary: { currency: "SAR", campaignBreakdown: [
      { campaign: "Scale SKU-SA", country: "eg", spend: 50, currency: "SAR", clicks: 4, impressions: 400 },
    ] } } },
  },
  eg: {
    country: "eg",
    snapshot: [
      {
        taagerOrderNumber: "SAME-ORDER",
        taagerCountry: "eg",
        createdAt: "2026-05-10",
        orderStatusBucket: "delivered",
        sku: "SKU-EG",
        products: "Egypt Product",
        nativeCurrency: "EGP",
        nativeTotalPrice: 520,
        nativeCommission: 52,
        city: "Cairo",
      },
    ],
    marketing: { facebook: { summary: { currency: "EGP", campaignBreakdown: [
      { campaign: "Scale SKU-EG", country: "eg", spend: 520, currency: "EGP", clicks: 10, impressions: 1000 },
    ] } } },
  },
};
const preserveService = createDashboardQueryService({
  getAccounts: () => preserveAccounts,
  getAllowedAccountIds: () => ["sar", "eg"],
  getRevision: () => 1,
  getMarketingRevision: () => 1,
});
const preservedOrders = preserveService.query({
  kind: "orders",
  accountIds: ["eg", "sar", "eg", "unauthorized"],
  reportingCurrency: "SAR",
  exchangeRates: { USD: 1, SAR: 3.75, EGP: 52 },
  sortBy: "dashboardTotalPrice",
  sortDir: "desc",
  page: 1,
  pageSize: 10,
});
assert.deepEqual(preservedOrders.scope.accountIds, ["eg", "sar"], "Account scope is canonical and sorted");
assert.deepEqual(preservedOrders.scope.ignoredAccountIds, ["unauthorized"], "Unauthorized requested account IDs are returned for diagnostics");
assert.equal(preservedOrders.scope.accountCount, 2);
assert.equal(preservedOrders.pagination.total, 2, "Identical order numbers in two accounts remain separate");
assert.equal(preservedOrders.summary.totalValue, 137.5, "Mixed-country totals are normalized into reporting currency");
assert.equal(preservedOrders.rows[0].accountId, "sar", "Global sorting happens after combining accounts");
const preservedOrdersDifferentRate = preserveService.query({
  kind: "orders",
  accountIds: ["sar", "eg"],
  reportingCurrency: "SAR",
  exchangeRates: { USD: 1, SAR: 3.75, EGP: 26 },
  sortBy: "dashboardTotalPrice",
  sortDir: "desc",
  page: 1,
  pageSize: 10,
});
assert.equal(preservedOrdersDifferentRate.summary.totalValue, 175, "Changing exchange rates invalidates query cache and recalculates totals");
const preservedExport = preserveService.query({
  kind: "orders",
  accountIds: ["sar", "eg"],
  reportingCurrency: "SAR",
  exchangeRates: { USD: 1, SAR: 3.75, EGP: 52 },
  sortBy: "dashboardTotalPrice",
  sortDir: "desc",
  allRows: true,
});
assert.equal(preservedExport.rows.length, preservedOrders.pagination.total, "Orders export query matches filtered backend count");
assert.equal(preservedExport.rows[0].accountId, preservedOrders.rows[0].accountId, "Orders export uses the same global order as visible backend rows");
const countryBoundCampaigns = preserveService.query({
  kind: "campaign-overview",
  accountIds: ["sar", "eg"],
  reportingCurrency: "SAR",
  exchangeRates: { USD: 1, SAR: 3.75, EGP: 52 },
  platform: "all",
  campaignPage: 1,
  productPage: 1,
  pageSize: 10,
});
const mismatchedCountry = countryBoundCampaigns.campaignRows.find((row) => row.accountId === "sar" || row.dashboardAccountId === "sar");
assert.equal(mismatchedCountry.attributionVerified, false, "Campaigns never match products from another country");
assert.ok(countryBoundCampaigns.totals.spend >= 87.5, "Campaign spend is normalized into reporting currency while raw values are preserved");

const largeCampaignAccounts = {
  one: { snapshot: accounts.a1.snapshot.slice(0, 500), marketing: { tiktok: { summary: { currency: "USD", campaignBreakdown: [] } } } },
  two: { snapshot: accounts.a2.snapshot.slice(0, 500), marketing: { facebook: { summary: { currency: "SAR", campaignBreakdown: [] } } } },
};
for (let i = 0; i < 3000; i++) {
  const target = i % 2 ? largeCampaignAccounts.one.marketing.tiktok.summary : largeCampaignAccounts.two.marketing.facebook.summary;
  target.campaignBreakdown.push({
    campaign: (i % 3 ? "Scale SKU-" + (i % 40) : "Unmatched") + " " + i,
    spend: 10 + i % 20,
    clicks: 5 + i % 10,
    impressions: 100 + i,
    objective: i % 2 ? "sales" : "leads",
  });
}
let marketingRevision = 1;
const largeCampaignService = createDashboardQueryService({
  getAccounts: () => largeCampaignAccounts,
  getAllowedAccountIds: () => ["one", "two"],
  getRevision: () => 1,
  getMarketingRevision: () => marketingRevision,
});
const largeCampaignStartedAt = Date.now();
const largeCampaignPage = largeCampaignService.query({
  kind: "campaign-overview",
  accountIds: ["one", "two"],
  reportingCurrency: "SAR",
  campaignPage: 2,
  productPage: 1,
  pageSize: 10,
});
assert.equal(largeCampaignPage.campaignPagination.total, 3000);
assert.equal(largeCampaignPage.campaignRows.length, 10);
assert.ok(Date.now() - largeCampaignStartedAt < 750, "Campaigns query with 3,000 campaigns should complete within 750ms");
marketingRevision++;
assert.equal(largeCampaignService.query({ kind: "campaign-overview", accountIds: ["one"], pageSize: 10 }).ok, true);

revision++;
assert.equal(service.query({ kind: "orders", accountIds: ["a1"], page: 1, pageSize: 25 }).pagination.total, accounts.a1.snapshot.length);

console.log("[PASS] Dashboard query service: All Accounts, 15k orders, pagination, products, campaigns, lazy details, and revision cache");
