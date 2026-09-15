"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
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

const backend = read("supabase/functions/windsor-marketing/index.ts");
const migration = read("supabase/migrations/202606060001_marketing_incremental_cache.sql");
const main = read("src/main/main.js");
const preload = read("src/main/preload.js");
const store = read("src/renderer/pages/dashboard/dashboard-filter-bus.js");
const dashboard = read("src/renderer/pages/dashboard/dashboard.js");
const app = read("src/renderer/app.js");
const section = read("src/renderer/pages/dashboard/sections/section-marketing-connections.js");
const sectionCampaigns = read("src/renderer/pages/dashboard/sections/section-campaigns.js");
const calculator = read("src/renderer/pages/dashboard/sections/section7-calculator.js");

check("daily cache is keyed by license, provider, platform, source, and date",
  migration.includes("primary key (") &&
  migration.includes("license_key_hash") &&
  migration.includes("provider_key_ref") &&
  migration.includes("source_account_id") &&
  migration.includes("report_date"));
check("connection status freshness is persisted",
  migration.includes("status_checked_at") &&
  backend.includes("status_checked_at: statusCheckedAt") &&
  main.includes("statusCheckedAt"));
check("cached status avoids provider validation",
  backend.includes('body.mode === "cached"') &&
  backend.includes('providerRequestCount: 0') &&
  main.includes('mode === "cached"'));
check("missing cached status stays local for disconnected accounts",
  main.includes('if (!cached && mode === "cached")') &&
  main.includes('status: "disconnected"') &&
  main.includes('summary: null') &&
  main.includes('cache: { status: "local", providerRequestCount: 0 }'));
check("renderer uses 15-minute stale-while-revalidate",
  store.includes("15 * 60 * 1000") &&
  store.includes("requestMode === 'cached'") &&
  store.includes("revalidate: true") &&
  store.includes("_marketingLoadRequests"));
check("connection polling uses bounded backoff",
  section.includes("AUTO_REFRESH_DELAYS_MS") &&
  section.includes("setTimeout") &&
  !section.includes("setInterval(function ()"));
check("connection polling can detect completion after its timer fires",
  section.includes("options.autoRefresh && pollPlatform === platform") &&
  !section.includes("options.autoRefresh && pollTimer && pollPlatform === platform"));
check("connection refresh starts independently of opening the authorization URL",
  section.indexOf("startAutoRefresh(platform);") <
  section.indexOf("window.api.openExternalUrl(result.authorizationUrl);"));
check("returning from authorization triggers a live status refresh",
  section.includes("refreshAfterAuthorizationFocus") &&
  section.includes("window.addEventListener('focus', refreshAfterAuthorizationFocus)") &&
  section.includes("window.removeEventListener('focus', refreshAfterAuthorizationFocus)"));
check("claim and release invalidate stale status before forced refresh",
  section.includes("invalidateStatus(selectedAccountId, platform)") &&
  section.includes("if (result && result.ok) return loadStatus(platform, { force: true });"));
check("forced status refreshes queue behind active requests",
  store.includes("_marketingQueuedForceLoads") &&
  store.includes("if (!options.force) return _marketingLoadRequests[loadKey]") &&
  store.includes("return queuedSelf.load(id, platform, queuedOptions)"));
check("marketing mutations prevent older status responses from overwriting state",
  store.includes("_marketingLoadSeq") &&
  store.includes("Number(_marketingLoadSeq[loadKey] || 0) !== requestSeq") &&
  store.includes("delete _marketingLoadedAt[loadKey]"));
check("provider key allocation is sequential until soft limit",
  backend.includes('order: "created_at.asc"') &&
  backend.includes("if (used >= key.softLimit) continue;") &&
  backend.includes("return key;") &&
  !backend.includes("used < best.used"));
check("pending authorization does not erase connected marketing payload",
  store.includes("mergePendingMarketingUpdate(previous, value)") &&
  store.includes("hasMarketingConnectionPayload(previous)") &&
  main.includes("preservePreviousPayload") &&
  main.includes('status.status || (isPendingMarketingStatus(status) ? "pending" : "disconnected")'));
check("marketing diagnostics render with platform context and section fallback",
  section.includes("function diagnosticMarkup(current, platform)") &&
  section.includes("diagnosticMarkup(current, platform)") &&
  section.includes("function safePlatformCard(config)") &&
  section.includes("LIVE_PLATFORMS.map(safePlatformCard)"));
check("incremental sync requests daily provider data",
  backend.includes("marketingReportFields(platform, true)") &&
  backend.includes('"account_id,account_name,campaign_id,campaign,spend,impressions,clicks"') &&
  backend.includes("fetchDailyMetricsRange") &&
  backend.includes("marketing_daily_metrics"));
check("Windsor spend reports cannot silently truncate",
  backend.includes("WINDSOR_MAX_REPORT_ROWS") &&
  backend.includes('url.searchParams.set("_max_rows"') &&
  backend.includes("WINDSOR_REPORT_ROW_LIMIT_REACHED") &&
  backend.includes("windsorReportRows(report)"));
check("older daily cache rows are invalidated after report-integrity changes",
  backend.includes("DAILY_METRIC_CACHE_SCHEMA_VERSION") &&
  backend.includes("_dailyMetricCache") &&
  backend.includes("cacheMarker.cacheSchemaVersion === DAILY_METRIC_CACHE_SCHEMA_VERSION"));
check("Windsor traffic views are requested and cached for conversion rates",
  backend.includes("actions_landing_page_view") &&
  backend.includes("actions_offsite_conversion_fb_pixel_view_content") &&
  backend.includes("actions_omni_view_content") &&
  backend.includes("total_landing_page_view") &&
  backend.includes("page_content_view_events") &&
  backend.includes("conversion_page_views") &&
  backend.includes("landingPageViews") &&
  backend.includes("contentViews") &&
  backend.includes("TRAFFIC_VIEW_SCHEMA_VERSION") &&
  backend.includes("trafficViewAvailable") &&
  backend.includes("hasTrafficViewSchema"));
check("missing tracked-view denominators are shown as unavailable instead of zero conversion",
  sectionCampaigns.includes('var conversionLabel = conversionAvailable ? percent(group.realConversionRatePct) : "N/A"') &&
  sectionCampaigns.includes("views unavailable"));
check("normal sync refreshes a rolling three-day window",
  backend.includes("addUtcDays(today, -2)") &&
  backend.includes("incrementalRefreshDates"));
check("currency-only changes recompose cached raw data",
  main.includes("currencyChanged") &&
  main.includes("recomposeOnly") &&
  backend.includes("body.recomposeOnly ? []"));
check("incremental and full refresh modes remain behind a rollout flag",
  main.includes('TAAGER_MARKETING_INCREMENTAL_SYNC === "1"') &&
  main.includes('range.mode === "full" ? "full" : "incremental"') &&
  backend.includes('body.mode === "incremental" || body.mode === "full"'));
check("legacy sync remains the default fallback",
  backend.includes("syncDashboardAccountLegacy") &&
  main.includes("mode: incrementalEnabled ? requestedMode : undefined"));
check("unchanged mappings avoid database rewrites",
  backend.includes("mappingSignature(existingForOwner)") &&
  backend.includes("mappingsSignature(existingMappings)") &&
  backend.includes("unchanged: true"));
check("cache diagnostics are returned",
  backend.includes("reusedDays") &&
  backend.includes("fetchedRanges") &&
  backend.includes("refreshedDays") &&
  backend.includes("providerRequestCount") &&
  backend.includes("stale"));
check("All Accounts schedules every source account only once",
  backend.includes("scheduledSourceAccountIds") &&
  backend.includes("scheduledSourceAccountIds.has(source.id)") &&
  backend.includes("scheduledSourceAccountIds.add(source.id)"));
check("full selected-range refresh requires confirmation",
  section.includes("data-marketing-full-sync") &&
  section.includes("data-marketing-full-sync-all") &&
  section.includes("fullRefreshConfirm") &&
  section.includes("window.confirm"));
check("marketing mapping and claim-release blocks use focused disclosure controls",
  section.includes("mappingDisclosure") &&
  section.includes("data-marketing-mapping-disclosure") &&
  section.includes("data-marketing-claim-disclosure") &&
  section.includes("marketing-claim-tabs") &&
  !section.includes("data-marketing-toggle"));
check("connect and claim automatically reveal mapping",
  section.includes("pendingMappingOpen[platform] = true") &&
  section.includes("mappingDisclosure[platform] = true"));
check("marketing first-use guide is dismissible and versioned",
  section.includes("taager_marketing_guide_dismissed_v1") &&
  section.includes("data-marketing-guide-dismiss") &&
  section.includes("data-marketing-guide-open"));
check("marketing release uses the theme-aware confirmation dialog",
  section.includes("window.KhodUI.confirm") &&
  section.includes("marketing.disconnectConfirmBody") &&
  section.includes("danger: true"));
check("marketing uses the dashboard translation API",
  section.includes("window.dashboardI18n") &&
  !section.includes("window.DashboardI18n"));
check("status modes are exposed through preload",
  preload.includes("(accountId, platform, options)") &&
  preload.includes('"get-marketing-status", accountId, platform, options'));
check("marketing revisions ignore timestamp-only cache refreshes",
  main.includes("marketingRevisionValue(previous) !== marketingRevisionValue(next)") &&
  !main.match(/statusCheckedAt[\s\S]{0,120}marketingRevisionValue/));
check("dashboard exact marketing cache includes the full rate snapshot",
  dashboard.includes("function exactMarketingCacheMatches") &&
  dashboard.includes("summary.exchangeRates") &&
  dashboard.includes("JSON.stringify(syncPayload.exchangeRates)"));
check("dashboard loader completes from saved data while marketing refreshes in the background",
  dashboard.includes("triggerMarketingSync(reason);") &&
  dashboard.includes("return runAggregator(showLoader);") &&
  dashboard.indexOf("triggerMarketingSync(reason);") < dashboard.indexOf("return runAggregator(showLoader);") &&
  dashboard.includes("refreshAfterBackgroundMarketing(activeMarketingSyncPromise)") &&
  dashboard.includes("saved order data and local aggregation") &&
  !dashboard.includes("marketingProgress += 1"));
check("new marketing requests clear stale in-memory errors",
  store.includes("if (loading) {") && store.includes("current.error = ''") &&
  store.includes("current.errorCode = ''") && store.includes("current.offline = false"));
check("all renderer marketing sync callers send exchange rates",
  dashboard.includes("exchangeRates: exchangeRates") &&
  app.includes("exchangeRates,") &&
  section.includes("exchangeRates: exchangeRates") &&
  calculator.includes("exchangeRates: exchangeRates"));
check("main cache identity compares full exchange rates and retries transient failures",
  main.includes("function marketingExchangeRatesEqual") &&
  main.includes("function callMarketingBackendWithRetry") &&
  main.includes("!marketingExchangeRatesEqual(cachedSummary.exchangeRates, exchangeRates)"));
check("backend converts and stores the full exchange-rate snapshot",
  backend.includes("function normalizeExchangeRates") &&
  backend.includes("exchangeRates?: Record<string, number>") &&
  backend.includes("source.exchangeRates || allExchangeRates") &&
  backend.includes("exchangeRates,"));

console.log(`\nMarketing optimization verification: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
