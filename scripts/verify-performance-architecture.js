"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log("[PASS] " + label);
  } else {
    failed += 1;
    console.error("[FAIL] " + label);
  }
}

const app = read("src/renderer/app.js");
const dashboard = read("src/renderer/pages/dashboard/dashboard.js");
const shell = read("src/renderer/pages/dashboard/dashboard-shell.js");
const aggregator = read("src/renderer/pages/dashboard/dashboard-aggregator.js");
const productsWrapper = read("src/renderer/pages/dashboard/sections/section5-products.js");
const products = productsWrapper + "\n" + read("src/renderer/pages/dashboard/sections/section5-products-hydrated.js");
const codWrapper = read("src/renderer/pages/dashboard/sections/section4-cod.js");
const codHydrated = read("src/renderer/pages/dashboard/sections/section4-cod-hydrated.js");
const commissionWrapper = read("src/renderer/pages/dashboard/sections/section6-commission.js");
const calculatorWrapper = read("src/renderer/pages/dashboard/sections/section7-calculator.js");
const campaignsWrapper = read("src/renderer/pages/dashboard/sections/section-campaigns.js");
const campaigns = campaignsWrapper + "\n" + read("src/renderer/pages/dashboard/sections/section-campaigns-hydrated.js");
const citiesWrapper = read("src/renderer/pages/dashboard/sections/section-cities.js");
const citiesHydrated = read("src/renderer/pages/dashboard/sections/section-cities-hydrated.js");
const cityProductMatrix = read("src/renderer/pages/dashboard/sections/section-product-matrix.js");
const marketingConnectionsWrapper = read("src/renderer/pages/dashboard/sections/section-marketing-connections.js");
const prepaidWrapper = read("src/renderer/pages/dashboard/sections/section-prepaid.js");
const commissionHydrated = read("src/renderer/pages/dashboard/sections/section6-commission-hydrated.js");
const calculatorHydrated = read("src/renderer/pages/dashboard/sections/section7-calculator-hydrated.js");
const masterSection = read("src/renderer/pages/dashboard/sections/section8-master.js");
const pipelineSection = read("src/renderer/pages/dashboard/sections/section2-pipeline.js");
const gmvTargetSection = read("src/renderer/pages/dashboard/sections/section-gmv-target.js");
const dashboardAiSection = read("src/renderer/pages/dashboard/sections/section-khod-ai.js");
const shared = read("src/renderer/pages/dashboard/dashboard-shared.js");
const typography = read("src/renderer/styles/typography.css");
const dashboardStyles = read("src/renderer/pages/dashboard/dashboard-styles.css");
const marketing = read("src/renderer/pages/dashboard/dashboard-filter-bus.js");
const queryRuntime = read("src/renderer/pages/dashboard/dashboard-query-runtime.js");
const campaignQueryCore = read("src/renderer/pages/dashboard/dashboard-campaign-query-core.js");
const queryService = read("src/main/dashboard-query-service.js");
const main = read("src/main/main.js");
const preload = read("src/main/preload.js");
const runtimeEnv = read(".env");
const marketingSection = read("src/renderer/pages/dashboard/sections/section-marketing-connections.js") +
  "\n" + read("src/renderer/pages/dashboard/sections/section-marketing-connections-hydrated.js");
const ordersWrapper = read("src/renderer/pages/dashboard/sections/section3-orders.js");
const ordersSection = ordersWrapper + "\n" + read("src/renderer/pages/dashboard/sections/section3-orders-hydrated.js");
const marketingBackend = read("supabase/functions/windsor-marketing/index.ts");

const dashboardCore = app.match(/\n\s*dashboard:\s*\[([\s\S]*?)\n\s*\],\n\s*[a-zA-Z]/);
check("dashboard core excludes XLSX and AI engine", !!dashboardCore &&
  !dashboardCore[1].includes("xlsx.full.min.js") &&
  !dashboardCore[1].includes("business-orchestrator.js"));
const dashboardOrders = app.match(/dashboardOrders:\s*\[([\s\S]*?)\],\n\s*dashboardOrdersExport:/);
const dashboardOrdersExport = app.match(/dashboardOrdersExport:\s*\[([\s\S]*?)\],/);
check("orders load XLSX only when export is requested", !!dashboardOrders &&
  !dashboardOrders[1].includes("xlsx.full.min.js") &&
  !!dashboardOrdersExport &&
  dashboardOrdersExport[1].includes("xlsx.full.min.js") &&
  ordersSection.includes("ensureFeatureScripts('dashboardOrdersExport')"));
check("orders route uses lightweight hydrated loader",
  ordersWrapper.includes("renderSection3HydratedEntry") &&
  ordersWrapper.includes("ensureFeatureScripts('dashboardOrdersHydrated')") &&
  app.includes("dashboardOrdersHydrated"));
check("cached lightweight sections stop hidden observers and delayed order hydration",
  pipelineSection.includes("mountEl._dashboardSectionDeactivate") &&
  ordersSection.includes("if (!isActiveOrdersMount() || productCityOptionsReady) return;") &&
  ordersSection.includes("window.requestIdleCallback(run, { timeout: 900 })") &&
  !ordersSection.includes("}, 2500);") &&
  gmvTargetSection.includes("mountEl._dashboardSectionDeactivate = function ()"));
check("dashboard sections load on demand", app.includes("window.ensureDashboardSection") && shell.includes("window.ensureDashboardSection(sectionId)"));
check("dashboard section routing avoids duplicate loader paints",
  shell.includes("function showSectionLoader(pane, sectionId)") &&
  shell.includes("current.getAttribute('data-dashboard-section') === sectionId") &&
  shell.includes("if (!data || !data._loaded || data._loading) {\n      showSectionLoader(pane, sectionId);\n      return;\n    }") &&
  !shell.includes("pane._dashboardRenderKey = null;\n    pane.innerHTML = loaderHTML(sectionId);\n\n    var render = function"));
check("feature resources preload in parallel before ordered execution", app.includes("scripts.forEach(preloadScriptResource)"));
check("warm dashboard activation skips rerender", app.includes('if (dashboardState.mounted)') && app.includes('if (!dashboardState.invalid)'));
check("heavy panes share a lifecycle-aware resource bag",
  shared.includes("window.DashboardSectionResources") &&
  shell.includes("pane._dashboardResources.deactivate()") &&
  shell.includes("pane._dashboardResources.destroy()"));
check("all seven heavy panes are cacheable",
  ["cod", "products", "cities", "calculator", "productForecast", "commission", "marketing"].every((sectionId) =>
    new RegExp("\\b" + sectionId + ": true").test(shell)
  ));
check("cache restore does not rewalk enhanced pane DOM",
  shell.includes("TaagerUI already") &&
  !shell.includes("runSectionPhase(sectionId, 'ui-enhance', function () { window.TaagerUI.enhance(cachedPane); })"));
check("dashboard render resolves when usable data is shown", dashboard.includes("return initialReady") && dashboard.includes("readyResolve(dashData)"));
check("aggregator cache lasts until explicit invalidation", aggregator.includes("Number.MAX_SAFE_INTEGER") && aggregator.includes("KhodPageLifecycle.invalidate"));
check("snapshot transport prefers gzip with JSON and object fallbacks",
  aggregator.includes("getDashboardSnapshotGzip") &&
  aggregator.includes("getDashboardSnapshotJson") &&
  aggregator.indexOf("getDashboardSnapshotGzip") < aggregator.indexOf("getDashboardSnapshotJson") &&
  aggregator.includes("snapshotTransportMeta.transport = 'object'"));
check("snapshot requests are shared and stale aggregation is canceled",
  aggregator.includes("_snapshotRequestsInFlight") &&
  aggregator.includes("_latestAggregationRequestId") &&
  aggregator.includes("aggregationRequestId !== _latestAggregationRequestId"));
check("aggregation transport and processing phases are timed",
  ["snapshot-ipc", "snapshot-transfer", "snapshot-decompression", "snapshot-json-parse", "reporting-row-prep", "process-snapshot-rows"]
    .every((phase) => aggregator.includes("'" + phase + "'")) &&
  aggregator.includes("aggregationPhaseTimings"));
check("query runtime times out and falls back on incomplete scope",
  queryRuntime.includes("DASHBOARD_QUERY_TIMEOUT") &&
  queryRuntime.includes("DASHBOARD_QUERY_SCOPE_INCOMPLETE") &&
  queryRuntime.includes("incomplete scope; using legacy dashboard data"));
check("shell instruments render phases and suppresses repeat entrances",
  shell.includes("runSectionPhase") &&
  ["query-observe", "i18n", "ui-enhance", "theme-fix", "render-body"].every((phase) => shell.includes("'" + phase + "'")) &&
  shell.includes("dash-section-no-entrance") && shell.includes("dash-section-refreshing"));
check("products render synchronously with final values and no startup spinner",
  !products.includes("}, 24);") &&
  !products.includes("s5Spin") &&
  !products.includes("function _animateNumber") &&
  products.includes("initialPageProducts"));
check("products route uses lightweight hydrated loader",
  productsWrapper.includes("renderSection5HydratedEntry") &&
  productsWrapper.includes("ensureFeatureScripts('dashboardProductsHydrated')") &&
  app.includes("dashboardProductsHydrated"));
check("cod, commission, and calculator routes use lightweight hydrated loaders",
  codWrapper.includes("renderSection4HydratedEntry") &&
  codWrapper.includes("ensureFeatureScripts('dashboardCodHydrated')") &&
  commissionWrapper.includes("renderSection6HydratedEntry") &&
  commissionWrapper.includes("ensureFeatureScripts('dashboardCommissionHydrated')") &&
  calculatorWrapper.includes("renderSection7HydratedEntry") &&
  calculatorWrapper.includes("ensureFeatureScripts('dashboardCalculatorHydrated')") &&
  app.includes("dashboardCodHydrated") &&
  app.includes("dashboardCommissionHydrated") &&
  app.includes("dashboardCalculatorHydrated"));
check("COD repair reports avoid mount-time full-array sorting and below-fold layout",
  (codHydrated.match(/filled: \{ key: null, dir: "asc" \}/g) || []).length === 4 &&
  (codHydrated.match(/if \(!term\) return rows;/g) || []).length === 2 &&
  (codHydrated.match(/if \(!state\.key\) return rows;/g) || []).length === 2 &&
  (codHydrated.match(/content-visibility:auto;contain-intrinsic-size:auto 900px/g) || []).length === 2 &&
  (codHydrated.match(/searchTimer = scheduleCodTimeout/g) || []).length === 2);
check("cities, campaigns, marketing, and prepaid routes use lightweight hydrated loaders",
  citiesWrapper.includes("renderSectionCitiesHydratedEntry") &&
  citiesWrapper.includes("ensureFeatureScripts('dashboardCitiesHydrated')") &&
  campaignsWrapper.includes("renderSectionCampaignsHydratedEntry") &&
  campaignsWrapper.includes("ensureFeatureScripts('dashboardCampaignsHydrated')") &&
  marketingConnectionsWrapper.includes("renderSectionMarketingConnectionsHydratedEntry") &&
  marketingConnectionsWrapper.includes("ensureFeatureScripts('dashboardMarketingHydrated')") &&
  prepaidWrapper.includes("renderSectionPrepaidHydratedEntry") &&
  prepaidWrapper.includes("ensureFeatureScripts('dashboardPrepaidHydrated')") &&
  app.includes("dashboardCitiesHydrated") &&
  app.includes("dashboardCampaignsHydrated") &&
  app.includes("dashboardMarketingHydrated") &&
  app.includes("dashboardPrepaidHydrated"));
check("cities schedule query and secondary widgets at the first idle opportunity",
  citiesHydrated.includes("window.requestIdleCallback(guardedCallback, { timeout: deadline })") &&
  citiesHydrated.includes("whenCitiesIdle(mountCitiesSecondaryWidgets, 1000)") &&
  !citiesHydrated.includes("whenCitiesIdle(mountCitiesSecondaryWidgets, 2800)") &&
  !citiesHydrated.includes("}, 1800);"));
check("cached Cities panes deactivate the hidden product-matrix subscriber",
  cityProductMatrix.includes("deactivate: function ()") &&
  cityProductMatrix.includes("unsubscribe();") &&
  cityProductMatrix.includes("return lifecycle;") &&
  citiesHydrated.includes("mountEl._citiesProductMatrixLifecycle.deactivate()") &&
  citiesHydrated.includes("mountEl._citiesProductMatrixLifecycle.activate()") &&
  citiesHydrated.includes("mountEl._citiesProductMatrixLifecycle.destroy()"));
check("Orders, Cities, and Campaigns avoid hidden full-data work",
  ordersSection.includes("data.pipeline && Array.isArray(data.pipeline.stages)") &&
  ordersSection.includes("var useCertifiedDetails = backendOrdersEnabled") &&
  ordersSection.includes("if (requestId !== backendOrdersRequest || !isActiveOrdersMount()) return;") &&
  citiesHydrated.includes("function mapHTML()") &&
  citiesHydrated.includes("var fastMapPaint = true;") &&
  campaigns.includes("mount._campaignDeferredBackendResult = result") &&
  campaigns.includes("if (mount.hidden)"));
check("dashboard prewarm includes hydrated section bundles",
  [
    "dashboardOrdersHydrated",
    "dashboardCodHydrated",
    "dashboardProductsHydrated",
    "dashboardCommissionHydrated",
    "dashboardPrepaidHydrated",
    "dashboardCitiesHydrated",
    "dashboardCampaignsHydrated",
    "dashboardCalculatorHydrated",
    "dashboardForecastHydrated",
    "dashboardMarketingHydrated",
  ].every((feature) => app.includes('"' + feature + '"')));
check("Static Update and dashboard AI use lightweight route bundles",
  app.includes('dashboardStaticUpdate: ["pages/dashboard/sections/section-static-update.js"]') &&
  app.includes("dashboardAiSection:") &&
  app.includes("dashboardAiEngine:") &&
  app.includes('khodAi: "dashboardAiSection"') &&
  dashboardAiSection.includes('ensureFeatureScripts("dashboardAiEngine")'));
check("cached Master and Campaigns panes release global state subscriptions",
  masterSection.includes("function unsubscribeSection8()") &&
  masterSection.includes("unsubscribeSection8();") &&
  campaigns.includes("mount._dashboardSectionDeactivate = function ()") &&
  campaigns.includes("window.DashboardRoiState.unsubscribe(mount._campaignRoiListener)"));
check("Commission paints HTML before constructing its charts",
  commissionHydrated.includes("function scheduleInitialCharts()") &&
  commissionHydrated.includes("requestAnimationFrame(function ()") &&
  commissionHydrated.includes("if (!chartInstance || !donutChartInstance) scheduleInitialCharts()"));
check("dashboard chart and CSS motion are clamped for fast renders",
  !commissionHydrated.includes("animation: { duration") &&
  !calculatorHydrated.includes("animation: { duration") &&
  !masterSection.includes("animation: { duration") &&
  dashboardStyles.includes("#page-dashboard *,") &&
  dashboardStyles.includes("animation: none !important") &&
  dashboardStyles.includes("animation-duration: 0s !important") &&
  dashboardStyles.includes("transition: none !important") &&
  dashboardStyles.includes("transition-duration: 0s !important") &&
  shared.includes("window.disableDashboardChartMotion"));
check("campaigns fill tables synchronously after shell mount",
  !campaigns.includes('window.requestAnimationFrame(function () {') &&
  campaigns.includes("updateCampaignsUIOnly(mount, data, ctx, state, activeIntel()"));
check("products cache exact render inputs and delegate root interactions",
  products.includes("marketingSyncStamp") &&
  products.includes("selectedCurrency()") &&
  products.includes("_s5DelegatedBound") &&
  products.includes("const list = currentList();"));
check("campaigns delegate filters, sorting, and pagination from the section root",
  campaigns.includes("_campaignDelegatedBound") &&
  campaigns.includes('mount.addEventListener("click"') &&
  campaigns.includes('mount.addEventListener("input"') &&
  campaigns.includes('mount.addEventListener("change"'));
check("products share campaign assignment results", products.includes("_dashboardProductCampaignAssignments"));
check("campaign intelligence survives remounts", campaigns.includes("campaignIntelCache") && campaigns.includes("rememberCampaignIntel"));
check("marketing status loads are deduplicated and cached", marketing.includes("_marketingLoadRequests") && marketing.includes("MARKETING_STATUS_TTL"));
check("paginated dashboard query service is exposed through IPC",
  queryService.includes("createDashboardQueryService") &&
  main.includes('ipcMain.handle("query-dashboard-data"') &&
  preload.includes("queryDashboardData"));
check("query rollout is independently feature flagged with legacy fallback",
  main.includes('dashboardQueryRuntimeFlag("KHOD_DASHBOARD_QUERY_ORDERS", "TAAGER_DASHBOARD_QUERY_ORDERS")') &&
  main.includes('dashboardQueryRuntimeFlag("KHOD_DASHBOARD_QUERY_PRODUCTS", "TAAGER_DASHBOARD_QUERY_PRODUCTS")') &&
  main.includes('dashboardQueryRuntimeFlag("KHOD_DASHBOARD_QUERY_CAMPAIGNS", "TAAGER_DASHBOARD_QUERY_CAMPAIGNS")') &&
  queryRuntime.includes("shadow"));
check("production dashboard avoids diagnostic shadow duplication and implicit Cities queries",
  runtimeEnv.includes("KHOD_DASHBOARD_QUERY_SHADOW=0") &&
  runtimeEnv.includes("KHOD_DASHBOARD_QUERY_CITIES=0") &&
  main.includes('cities: dashboardQueryRuntimeFlag("KHOD_DASHBOARD_QUERY_CITIES", "TAAGER_DASHBOARD_QUERY_CITIES")') &&
  !main.includes('dashboardQueryRuntimeFlag("KHOD_DASHBOARD_QUERY_CITIES", "TAAGER_DASHBOARD_QUERY_CITIES") || dashboardQueryRuntimeFlag("KHOD_DASHBOARD_QUERY_PRODUCTS"'));
check("Cities query work has one section-owned trigger and no global prewarm",
  !queryRuntime.includes("scheduleQueryPrewarm") &&
  queryRuntime.includes("currentFlags: function ()") &&
  citiesHydrated.includes("citiesQueryKnownDisabled") &&
  citiesHydrated.includes("!citiesQueryKnownDisabled") &&
  citiesHydrated.includes('DashboardQueryRuntime.query("cities", {}, data)'));
check("products use backend pagination with lazy batched details and legacy fallback",
  products.includes("requestBackendProductPage") &&
  products.includes("loadBackendProductDetails") &&
  products.includes("productOptionSource") &&
  products.includes("backendProductsActive ? backendProductsRows : applyFilters()") &&
  products.includes("backend query failed; using legacy data"));
check("products shadow mode compares KPIs and rankings",
  queryRuntime.includes("compareProductShadow") &&
  queryRuntime.includes("rollout mismatch") &&
  queryRuntime.includes("topRanking"));
check("campaigns use backend dual pagination, lazy AI context, and legacy fallback",
  queryService.includes("campaignOverview") &&
  queryService.includes("campaignAiContext") &&
  campaigns.includes("requestBackendCampaigns") &&
  campaigns.includes("campaign-ai-context") &&
  campaigns.includes("backend query failed; using legacy data"));
check("campaign intelligence core is shared by renderer and main process",
  app.includes("dashboard-campaign-query-core.js") &&
  queryService.includes("dashboard-campaign-query-core") &&
  campaignQueryCore.includes("buildCampaignIntelligence"));
check("campaigns shadow mode compares complete KPI totals",
  queryRuntime.includes("compareCampaignShadow") &&
  queryRuntime.includes("objectiveMix") &&
  queryRuntime.includes("decisionCounts"));
check("rollout verifier covers manual gates and structured comparison",
  read("package.json").includes("verify:dashboard-rollout") &&
  fs.existsSync(path.join(root, "scripts", "verify-dashboard-rollout.js")) &&
  read("scripts/verify-dashboard-rollout.js").includes("moneyMinor") &&
  read("scripts/verify-dashboard-rollout.js").includes("KHOD_DASHBOARD_QUERY_SHADOW") &&
  read("scripts/verify-dashboard-rollout.js").includes("TAAGER_DASHBOARD_QUERY_SHADOW"));
check("marketing changes invalidate dashboard query caches",
  main.includes("marketingRevision") &&
  main.includes("bumpDashboardMarketingRevision"));
check("marketing status primes only for relevant sections",
  dashboard.includes("sectionNeedsMarketing") &&
  dashboard.includes("onSectionChange"));
check("marketing status is stale-while-revalidate with bounded connection polling",
  marketing.includes("15 * 60 * 1000") &&
  marketing.includes("revalidate: true") &&
  marketingSection.includes("AUTO_REFRESH_DELAYS_MS"));
check("marketing incremental sync is feature flagged with legacy fallback",
  main.includes("TAAGER_MARKETING_INCREMENTAL_SYNC") &&
  marketingBackend.includes("syncDashboardAccountIncremental") &&
  marketingBackend.includes("syncDashboardAccountLegacy"));
check("marketing incremental cache stores raw daily data and returns diagnostics",
  marketingBackend.includes("marketing_daily_metrics") &&
  marketingBackend.includes("providerRequestCount") &&
  marketingBackend.includes("reusedDays"));

console.log(`\nPerformance architecture verification: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
