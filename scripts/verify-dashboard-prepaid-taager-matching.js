"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { processDashboardSheets } = require("../src/bot/dashboard-sheet-processing");

const ROOT = path.resolve(__dirname, "..");
const TAAGER_FILE = path.join(ROOT, "orders-prepaid.xlsx");
const EASY_FILE = path.join(ROOT, "1782138576477912069-easyorder-orders-2026-06-22 (prepaid data ).xlsx");

function exists(file) {
  assert.ok(fs.existsSync(file), "Missing fixture: " + path.basename(file));
}

function countBy(rows, keyFn) {
  return rows.reduce((out, row) => {
    const key = keyFn(row) || "unknown";
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
}

function uniqueOrderItemKey(row) {
  return [
    row.taagerOrderNumber || row.orderNumber || row.orderId || "",
    row.sku || row.products || "",
  ].join("|");
}

exists(TAAGER_FILE);
exists(EASY_FILE);

const result = processDashboardSheets({
  taagerBuffer: fs.readFileSync(TAAGER_FILE),
  easyOrdersBuffer: fs.readFileSync(EASY_FILE),
  dateFrom: "2026-01-01",
  dateTo: "2026-03-31",
  country: "sa",
  enrichmentEnabled: true,
  easyOrdersLookbackDays: 60,
});

const prepaidRows = result.rows.filter((row) => row.paymentClassification === "prepaid");
const uniquePrepaidRows = Array.from(new Map(prepaidRows.map((row) => [uniqueOrderItemKey(row), row])).values());
const bucketCounts = countBy(uniquePrepaidRows, (row) => row.orderStatusBucket);
const netRows = uniquePrepaidRows.filter((row) => row.orderStatusBucket !== "canceled_by_you");
const deliveredRows = uniquePrepaidRows.filter((row) => row.orderStatusBucket === "delivered");

assert.strictEqual(result.rows.length, 2023, "KHOD WHAAT sheet should parse to the expected item rows");
assert.strictEqual(uniquePrepaidRows.length, 95, "EasyOrders taager-payment rows should match 95 unique KHOD WHAAT order-items conservatively");
assert.strictEqual(netRows.length, 90, "prepaid NDR base should exclude canceled-by-you rows");
assert.strictEqual(deliveredRows.length, 16, "prepaid delivered count must come from KHOD WHAAT statuses");
assert.strictEqual(Number((deliveredRows.length / netRows.length * 100).toFixed(1)), 17.8, "prepaid NDR should be 17.8%");
assert.deepStrictEqual(bucketCounts, {
  delivered: 16,
  customer_refused_confirmation: 49,
  on_hold: 8,
  return_verified: 15,
  canceled_by_you: 5,
  after_sales_done: 2,
});

assert.strictEqual(result.enrichmentDiagnostics.prepaidTargetItemRows, 145, "EasyOrders taager payment item targets should be counted");
assert.strictEqual(result.enrichmentDiagnostics.prepaidTargetMatchedItemRows, 98, "matched EasyOrders taager target item rows should be counted");
assert.strictEqual(result.enrichmentDiagnostics.prepaidTargetMatchedRows, 95, "matched prepaid targets should be visible in diagnostics");
assert.strictEqual(result.enrichmentDiagnostics.prepaidTargetUnmatchedRows, 47, "unmatched prepaid targets should be visible in diagnostics");
assert.ok(result.enrichmentDiagnostics.paymentMatchSources, "payment match source diagnostics should be present");

console.log("Dashboard prepaid EasyOrders->Taager matching OK");
