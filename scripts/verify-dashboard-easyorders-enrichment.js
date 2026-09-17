"use strict";

const assert = require("assert");
const XLSX = require("xlsx");
const { processDashboardSheets } = require("../src/bot/dashboard-sheet-processing");

function workbookBuffer(rows) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Orders");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

// Khod intentionally reads the KHOD WHAAT affiliate export for dashboard
// truth. It does not use Taager's EasyOrders enrichment split; this fixture
// keeps the verification aligned with that source contract.
const header = [
  "Order Number", "FullName", "Phone 1", "Phone 2", "Status",
  "Order Value", "Commission", "City", "Region", "Address",
  "Data Entry", "", "", "", "", "Qty", "Products", "SKU",
  "Price Without Shipping", "Shipping", "Total Price", "Created At",
  "Confirmed At", "Shipped At", "Last Updated", "Amount Due", "Collected",
  "Marketer Commission", "Order Type", "", "Notes",
];

const buffer = workbookBuffer([
  header,
  [
    "KH-1001", "Test Customer", "0500000001", "", "تم تأكيد الطلب",
    129, 10, "Riyadh", "Riyadh", "Test address", "", "", "", "", "",
    1, "Test product", "SKU-TEST", 119, 10, 129, "2026-09-10", "", "", "2026-09-10",
    129, 0, 10, "", "", "",
  ],
  [
    "KH-1002", "Outside Range", "0500000002", "", "تم تأكيد الطلب",
    129, 10, "Riyadh", "Riyadh", "Test address", "", "", "", "", "",
    1, "Old product", "SKU-OLD", 119, 10, 129, "2026-08-31", "", "", "2026-08-31",
    129, 0, 10, "", "", "",
  ],
]);

const result = processDashboardSheets({
  khodBuffer: buffer,
  dateFrom: "2026-09-01",
  dateTo: "2026-09-30",
});

assert.strictEqual(result.rows.length, 1, "only rows in the selected created-date range should be returned");
assert.strictEqual(result.rows[0].khodOrderNumber, "KH-1001");
assert.strictEqual(result.rows[0].sku, "SKU-TEST");
assert.strictEqual(result.enrichmentDiagnostics.provider, "khod-sheet");
assert.strictEqual(result.parseDiagnostics.source, "khod-sheet");
assert.strictEqual(result.warnings[0].code, "ROWS_OUTSIDE_PERIOD");

console.log("Khod dashboard source verification OK");
