"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");

const main = read("src/main/main.js");
const dashboardFetch = read("src/bot/dashboard-fetch.js");
const dashboardAggregator = read("src/renderer/pages/dashboard/dashboard-aggregator.js");
const dashboardCampaignCore = read("src/renderer/pages/dashboard/dashboard-campaign-query-core.js");
const dashboardQueryRuntime = read("src/renderer/pages/dashboard/dashboard-query-runtime.js");
const dashboardQueryService = read("src/main/dashboard-query-service.js");

function dashboardFetchBlock() {
  const start = main.indexOf('ipcMain.handle("run-dashboard-fetch"');
  assert(start >= 0, "run-dashboard-fetch handler must exist");
  const endMarker = "\n});\n\n//";
  const end = main.indexOf(endMarker, start);
  assert(end > start, "run-dashboard-fetch handler block must be extractable");
  return main.slice(start, end);
}

const block = dashboardFetchBlock();
const forbiddenTerms = [
  "taager" + "Email",
  "taager" + "Phone",
  "taager" + "Merchant",
  "merchant" + "Id",
  "login" + "Method",
  "taager_" + "login",
  "taager_" + "phone",
  "taager_" + "merchant",
  "Taager " + "email",
  "Taager " + "phone",
  "Taager " + "merchant",
];
const hasForbiddenIdentity = (source) => forbiddenTerms.some((term) => source.includes(term));

assert(!hasForbiddenIdentity(dashboardFetch),
  "dashboard-fetch worker must not depend on donor phone/email/merchant/login-method identity");
assert(!hasForbiddenIdentity(block),
  "run-dashboard-fetch payload must not pass donor phone/email/merchant/login-method identity");

assert(dashboardFetch.includes("config.khodEmail || config.khod_email"),
  "dashboard-fetch worker must read khodEmail/khod_email");
assert(dashboardFetch.includes("config.khodPassword || config.khod_password"),
  "dashboard-fetch worker must read khodPassword/khod_password");
assert(dashboardFetch.includes("KHOD_IDENTITY_MISMATCH"),
  "dashboard-fetch worker must verify the active KHOD WHAAT session identity");
assert(dashboardFetch.includes('require("./dashboard-sheet-processing")') &&
  dashboardFetch.includes("processDashboardSheets({ khodBuffer: buffer"),
  "dashboard-fetch worker must feed the KHOD WHAAT sheet into the existing dashboard processor");
assert(dashboardFetch.includes("resolveSafeKhodExportRange"),
  "dashboard-fetch worker must use the KHOD WHAAT export range helper");

assert(block.includes("const khodEmail = acc.khodEmail || store.get(\"khodEmail\", \"\")"),
  "main dashboard-fetch handler must source khodEmail");
assert(block.includes("const khodPassword = acc.khodPassword || (acc.id ? store.get(`pwd_khod_${acc.id}`, \"\") : \"\") || store.get(\"khodPassword\", \"\")"),
  "main dashboard-fetch handler must source khodPassword");
assert(block.includes("khod_email: khodEmail"),
  "main dashboard-fetch payload must include khod_email compatibility field");
assert(block.includes('msg.type === "khod-restart"') &&
  block.includes("Waiting for KHOD WHAAT export file"),
  "main dashboard-fetch handler must report KHOD WHAAT retry/download progress");
assert(!block.includes('msg.type === "2fa-needed"') &&
  !block.includes('msg.type === "google-login-needed"') &&
  !block.includes("openManualGoogleLoginChrome"),
  "dashboard update must not surface EasyOrders 2FA or KHOD WHAAT/Google login prompts");
assert(main.includes("const direct = row.khodOrderNumber || row.taagerOrderNumber || row.orderNumber || row.orderId || row.id"),
  "dashboard snapshot row key must preserve distinct KHOD WHAAT rows by khodOrderNumber");
assert(main.includes("const direct = row.khodOrderNumber || row.taagerOrderNumber || row.orderNumber || row.orderId || row.id || row.reference"),
  "dashboard order summary key must use KHOD WHAAT order number before donor aliases");
assert(dashboardAggregator.includes("row.khodOrderNumber || row.taagerOrderNumber || row.orderNumber || row.id || row.orderId || row.reference"),
  "dashboard renderer row identity must preserve distinct KHOD WHAAT rows by khodOrderNumber");
assert(dashboardAggregator.includes("row.khodOrderNumber || row.taagerOrderNumber || row.orderNumber || row.id || row.orderId || row.reference"),
  "dashboard renderer order key must use KHOD WHAAT order number before donor aliases");
assert(dashboardAggregator.includes("rows[0].khodOrderNumber || rows[0].taagerOrderNumber"),
  "dashboard renderer cache hash must include KHOD WHAAT order numbers");
assert(dashboardCampaignCore.includes("row.khodOrderNumber || row.taagerOrderNumber || row.orderNumber || row.orderId || row.id || row.reference"),
  "dashboard campaign query keys must use KHOD WHAAT order number before donor aliases");
assert(dashboardQueryRuntime.includes("row.orderScopeKey || row.khodOrderNumber || row.taagerOrderNumber"),
  "dashboard query runtime order identity must use KHOD WHAAT order number before donor aliases");
assert(dashboardQueryService.includes("const direct = row.khodOrderNumber || row.taagerOrderNumber || row.orderNumber || row.orderId || row.id || row.reference"),
  "dashboard query service order key must use KHOD WHAAT order number before donor aliases");

console.log("Dashboard fetch KHOD WHAAT identity verification passed.");
