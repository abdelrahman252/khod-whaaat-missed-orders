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
    console.log(`[PASS] ${label}`);
  } else {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  }
}

const dashboard = read("src/renderer/pages/dashboard/dashboard.js");
const app = read("src/renderer/app.js");
const shell = read("src/renderer/pages/dashboard/dashboard-shell.js");
const runner = read("src/bot/runner.js");
const khodRunner = read("src/bot/khod-flow-runner.js");
const dashboardFetch = read("src/bot/dashboard-fetch.js");
const shared = read("src/bot/easy-orders-export.js");
const main = read("src/main/main.js");
const donorIdentityTerms = [
  "taager" + "Email",
  "taager" + "Phone",
  "taager" + "Merchant",
  "merchant" + "Id",
  "login" + "Method",
  "taager_" + "login",
  "taager_" + "phone",
  "taager_" + "merchant",
];
const containsDonorIdentityTerm = (source) => donorIdentityTerms.some((term) => source.includes(term));
const rateRefreshFn = (shell.match(/function refreshDashboardAfterRateChange\(shellEl, opts\) \{[\s\S]*?\n  \}/) || [""])[0];
const handlePeriodChangeFn = (dashboard.match(/function handlePeriodChange\(\) \{[\s\S]*?\n    \}/) || [""])[0];
const onAccountChangeFn = (dashboard.match(/onAccountChange: function \(accountId\) \{[\s\S]*?\n      \},/) || [""])[0];

check("dashboard opening completes from saved aggregation while marketing runs in background",
  dashboard.includes("var initialReady = syncMarketingAndRunAggregator(false, 'dashboard-open');") &&
  dashboard.includes("triggerMarketingSync(reason);") &&
  dashboard.includes("return runAggregator(showLoader);") &&
  dashboard.includes("saved order data and local aggregation") &&
  !dashboard.includes("syncMarketingSpend"));
check("period and account changes do not invoke the live dashboard update",
  handlePeriodChangeFn.includes("syncMarketingAndRunAggregator(true, 'period-change');") &&
  onAccountChangeFn.includes("syncMarketingAndRunAggregator(true, 'account-change');") &&
  !handlePeriodChangeFn.includes("_onRunForDashboard") &&
  !onAccountChangeFn.includes("_onRunForDashboard"));
check("period changes load marketing connections before automatic sync",
  dashboard.includes("Loading connections before dashboard auto-sync") &&
  dashboard.includes("store.load(activeId)") &&
  dashboard.indexOf("store.load(activeId)") < dashboard.indexOf("return store.sync(activeId, syncPayload);"));
check("dashboard rate refresh only re-runs saved-data aggregation",
  rateRefreshFn.includes("opts.onReportingCurrencyChange(window.dashboardActiveCurrency || 'SAR');") &&
  !rateRefreshFn.includes("onDashboardUpdate"));
check("static dashboard updates do not sync marketing", dashboard.includes("onStaticUpdateComplete: function () {\n        runAggregator(true);"));
check("explicit dashboard update carries the selected marketing scope", dashboard.includes("marketingAccountId: activeId || '__all__'"));
check("manual dashboard update refreshes connected marketing", app.includes("await marketingStore.sync(marketingAccountId, marketingPayload)"));
check("titlebar Sync refreshes app state and restores the current route",
  app.includes("async function adminRefresh()") &&
  app.includes('addEventListener("click", adminRefresh)') &&
  app.includes('window.invalidateDashboardCache("admin-refresh")') &&
  app.includes('invalidatePage("page-dashboard", "admin-refresh")') &&
  app.includes('reloadAppPreservingRoute("admin-refresh")') &&
  app.includes("captureAppReloadRestoreState") &&
  app.includes("consumeAppReloadRestoreState") &&
  shell.includes("function triggerDashboardUpdate(shellEl, opts)") &&
  shell.includes("window.triggerDashboardUpdate = function ()"));
check("titlebar Sync preserves the active dashboard section across refresh",
  app.includes("dashboardSection") &&
  app.includes("window._dashboardInitialSection = restoreState.dashboardSection") &&
  app.includes("routeAfterCredentialsReady(creds, reloadRestoreState)") &&
  shell.includes("mountEl._dashboardActiveSection") &&
  shell.includes("shellEl._dashboardActiveSection"));
check("manual dashboard update reports enrichment warnings", app.includes("enrichmentWarnings") && app.includes("EasyOrders enrichment unavailable"));
check("Run worker still uses the shared EasyOrders exporter",
  runner.includes('require("./khod-flow-runner")') &&
  khodRunner.includes('require("./easy-orders-export")') &&
  khodRunner.includes("await easyOrdersFlow.login(page);") &&
  khodRunner.includes("easyOrdersFlow.exportReport"));
check("dashboard refresh uses the KHOD WHAAT affiliate sheet processor",
  dashboardFetch.includes('require("./dashboard-sheet-processing")') &&
  dashboardFetch.includes("processDashboardSheets({ khodBuffer: buffer") &&
  dashboardFetch.includes("resolveSafeKhodExportRange") &&
  dashboardFetch.includes("khod.sheet.parse"));
check("dashboard refresh uses KHOD WHAAT identity only",
  dashboardFetch.includes("config.khodEmail || config.khod_email") &&
  dashboardFetch.includes("config.khodPassword || config.khod_password") &&
  dashboardFetch.includes("KHOD_IDENTITY_MISMATCH") &&
  !containsDonorIdentityTerm(dashboardFetch));
check("main dashboard-fetch payload passes KHOD WHAAT credentials without Taager identity",
  main.includes("const khodEmail = acc.khodEmail || store.get(\"khodEmail\", \"\")") &&
  main.includes("const khodPassword = acc.khodPassword || (acc.id ? store.get(`pwd_khod_${acc.id}`, \"\") : \"\") || store.get(\"khodPassword\", \"\")") &&
  main.includes("khod_email: khodEmail") &&
  !((main.match(/ipcMain\.handle\(\"run-dashboard-fetch\"[\s\S]*?\/\/ /) || [""])[0]).includes("Taager credentials missing for") &&
  !((main.match(/ipcMain\.handle\(\"run-dashboard-fetch\"[\s\S]*?\/\/ /) || [""])[0]).includes("Taager " + "merchant ID missing"));
check("shared EasyOrders flow verifies exact store identity and bounds export attempts",
  shared.includes("EASY_ORDERS_STORE_MISMATCH") &&
  shared.includes("EASY_ORDERS_STORE_UNVERIFIED") &&
  shared.includes("selectExpectedStore") &&
  shared.includes("const exportAttempts = Math.max(1, Number(options.exportAttempts || 1));") &&
  shared.includes("for (let attempt = 1; attempt <= 3; attempt++)") &&
  shared.includes("EASY_ORDERS_NOTIFICATION_TIMEOUT") &&
  shared.includes("EASY_ORDERS_EXPORT_RATE_LIMITED"));
check("shared EasyOrders flow enforces English before English-only controls and notification matching",
  shared.includes("EASY_ORDERS_ENGLISH_REQUIRED") &&
  shared.includes("async function readLanguageState(page)") &&
  shared.includes("await ensureEnglish(page, { force: true });") &&
  shared.includes("async function waitForExportLink(page, keyword, attempt, ignoredHrefs = [])") &&
  shared.includes("const result = await findExportLink(page, keyword, ignoredHrefs);") &&
  shared.includes("const requiredNotificationRefreshes = 2") &&
  shared.includes("poll <= requiredNotificationRefreshes") &&
  shared.includes("clickExportDialogSubmit(page, dialog, keyword)") &&
  shared.includes('dialog.locator(".MuiDialogActions-root button")') &&
  shared.includes("EASY_ORDERS_EXPORT_SUBMIT_UNAVAILABLE") &&
  shared.includes("clickExportButton(page, exportButton, keyword)") &&
  shared.includes("EASY_ORDERS_EXPORT_BUTTON_UNAVAILABLE") &&
  shared.includes("EASY_ORDERS_EXPORT_DIALOG_NOT_OPEN") &&
  shared.includes('dialog.locator(\'input[type="text"]\')') &&
  shared.includes("readOptionalExportToast") &&
  shared.includes("isVisible({ timeout: 1200 })") &&
  shared.includes("refreshNotificationsForPoll") &&
  shared.includes("timeout: 8000") &&
  !shared.includes('dialog.locator(".MuiDialogActions-root button").click()') &&
  shared.includes("easyorders.notifications") &&
  khodRunner.includes("await easyOrdersFlow.login(page);"));
check("shared EasyOrders login waits for first-run 2FA before identity verification",
  shared.includes('emit({ type: "2fa-needed", site: "easy-orders" })') &&
  shared.includes("const maxWaitMs = 5 * 60 * 1000") &&
  shared.includes("verificationCodeVisible") &&
  shared.includes("EASY_ORDERS_LOGIN_TIMEOUT"));
check("dashboard worker does not request EasyOrders 2FA or Google login",
  !dashboardFetch.includes('type: "2fa-needed"') &&
  !dashboardFetch.includes('type: "google-login-needed"') &&
  !((main.match(/ipcMain\.handle\("run-dashboard-fetch"[\s\S]*?\/\/ /) || [""])[0]).includes('msg.type === "2fa-needed"') &&
  !((main.match(/ipcMain\.handle\("run-dashboard-fetch"[\s\S]*?\/\/ /) || [""])[0]).includes('msg.type === "google-login-needed"'));
check("partial dashboard warning omits an empty Failed section",
  app.includes('failures.length ? "dashboard.fetch_partial_body" : "dashboard.fetch_partial_clean_body"'));

console.log(`\nExplicit dashboard refresh verification: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
