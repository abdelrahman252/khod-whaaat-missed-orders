"use strict";

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { processDashboardSheets } = require("../src/bot/dashboard-sheet-processing");

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed++;
    console.log(`[PASS] ${label}`);
  } else {
    failed++;
    console.error(`[FAIL] ${label}`);
  }
}

function workbookBuffer(rows, sheetName) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName || "Sheet1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

// KHOD WHAAT affiliate export fixture. Static Update now consumes this sheet directly;
// the old dual Taager + EasyOrders verifier was retired in Phase 3.12.
const khodHeader = [
  "Unused", "Order Number", "FullName", "Phone 1", "Phone 2", "Status",
  "Order Value", "Commission", "City", "Region", "Address", "Data Entry",
  "Unused 12", "Unused 13", "Unused 14", "Qty", "Products", "SKU",
  "Price Without Shipping", "Shipping", "Total Price", "Created At",
  "Confirmed At", "Shipped At", "Last Updated", "Amount Due", "Collected",
  "Marketer Commission", "Order Type", "Unused 29", "Notes"
];
const khodRow = [
  "", "K-100", "Client", "0500000000", "", "Delivered",
  100, 35, "Riyadh", "Central", "Street", "QA",
  "", "", "", 1, "KHOD WHAAT Product", "SKU-1",
  100, 20, 120, "2026-05-10", "2026-05-11", "2026-05-11", "2026-05-12",
  120, 120, 35, "Standard", "", "prepaid visa"
];

const khodBuffer = workbookBuffer([khodHeader, khodRow], "Orders");
const wrongBuffer = workbookBuffer([["Something Else"], ["value"]], "Other");

const khodOnly = processDashboardSheets({
  khodBuffer,
  dateFrom: "2026-05-01",
  dateTo: "2026-05-31",
  country: "sa",
});
check("KHOD WHAAT workbook produces one dashboard row", khodOnly.rows.length === 1);
check("KHOD WHAAT source diagnostics do not require legacy enrichment", khodOnly.warnings.length === 0 && khodOnly.enrichmentDiagnostics.status === "source");
check("KHOD WHAAT row preserves product and SKU", khodOnly.rows[0].products === "KHOD WHAAT Product" && khodOnly.rows[0].sku === "SKU-1");
check("KHOD WHAAT notes classify prepaid while preserving COD fields", khodOnly.rows[0].isPrepaid === true && khodOnly.rows[0].amountDue === 120);

const emptyRange = processDashboardSheets({
  khodBuffer,
  dateFrom: "2026-06-01",
  dateTo: "2026-06-30",
  country: "sa",
});
check("A valid KHOD WHAAT workbook can produce a zero-row selected period", emptyRange.rows.length === 0);
check("Out-of-period diagnostics retain source and parser row counts", emptyRange.parseDiagnostics.sourceRows === 1 && emptyRange.parseDiagnostics.parserRows === 1);
check("Out-of-period diagnostics count ignored KHOD WHAAT rows", emptyRange.parseDiagnostics.parsedRows === 0 && emptyRange.parseDiagnostics.rowsOutsidePeriod === 1);

let rejected = false;
try {
  processDashboardSheets({ khodBuffer: wrongBuffer, dateFrom: "2026-05-01", dateTo: "2026-05-31" });
} catch (_) {
  rejected = true;
}
check("Unrelated workbook is rejected as a KHOD WHAAT upload", rejected);

const root = path.join(__dirname, "..");
const main = fs.readFileSync(path.join(root, "src/main/main.js"), "utf8");
const preload = fs.readFileSync(path.join(root, "src/main/preload.js"), "utf8");
const shell = fs.readFileSync(path.join(root, "src/renderer/pages/dashboard/dashboard-shell.js"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "src/renderer/pages/dashboard/dashboard.js"), "utf8");
const setup = fs.readFileSync(path.join(root, "src/renderer/pages/setup.js"), "utf8");
const marketing = fs.readFileSync(path.join(root, "src/renderer/pages/dashboard/sections/section-marketing-connections.js"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin-panel/index.html"), "utf8");
const section = fs.readFileSync(path.join(root, "src/renderer/pages/dashboard/sections/section-static-update.js"), "utf8");
check("Main process exposes inspect and apply handlers", main.includes('ipcMain.handle("inspect-static-dashboard-update"') && main.includes('ipcMain.handle("apply-static-dashboard-update"'));
check("Main process blocks period-mismatched static uploads", main.includes("staticDashboardPeriodMismatch") && main.includes("canApply: !prepared.periodMismatch"));
check("Preload exposes inspect and apply APIs", preload.includes("inspectStaticDashboardUpdate") && preload.includes("applyStaticDashboardUpdate"));
check("Dashboard sidebar and renderer map Static Update", shell.includes("nav.staticUpdate") && shell.includes("renderSectionStaticUpdate"));
check("Static section uses explicit replacement confirmation", section.includes("requiresConfirmation") && section.includes("allowSuspiciousReplacement"));
check("Static section skips non-applicable period inspections before apply", section.includes("entry.result.canApply !== false") && section.includes("entry.result.canApply === false"));
check("Main process preserves saved product names during static updates", main.includes("preserveExistingDashboardProductNames(normalizedRows, existingRows)"));
check("Main process preserves saved product names during live fetch updates", main.includes("preserveExistingDashboardProductNames(rows, existingRows)"));
check("Static accounts use a name-only setup mode", setup.includes('data-account-type="static"') && setup.includes('id="sv3-static-name"'));
check("Static accounts bypass credentials but still use license account slots", main.includes('if (isStaticAccount(a))') && main.includes('function staticAccountIdentityOf') && main.includes('accounts.length > maxAccounts'));
check("Static accounts cannot launch live bot or dashboard workers", main.includes('STATIC_ACCOUNTS_CANNOT_RUN') && main.includes('STATIC_ACCOUNT_OFFLINE'));
check("Dashboard live update is disabled for a selected static account", shell.includes('activeDashboardAccountIsStatic') && shell.includes('updateBtn.dataset.staticBlocked'));
check("Mixed-account dashboard refresh filters out static accounts", dashboard.includes("account.accountType !== 'static'") && dashboard.includes('liveAccountIds'));
check("Marketing mappings use the permanent static account identity", marketing.includes("return 'static:' + accountIdOf(account)") && main.includes('return id ? `static:${id}` : ""'));
check("Admin account slots identify static accounts", admin.includes("startsWith('static:')") && admin.includes('Static &middot;'));

console.log(`\nStatic Update verification: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
