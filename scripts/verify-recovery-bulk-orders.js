"use strict";

const fs = require("fs");
const assert = require("assert");
const {
  parseRecoveryCustomersFromWorkbooks,
  filterRecoveryCustomersByUsedPhones,
  buildRecoveryProductCatalogFromRows,
  buildRecoveryOrders,
  previewRecoveryOrders,
} = require("../src/bot/recovery-order-sheet");

const FIXTURES = [
  "F:/code/khod-bot2/khod-order-bot/taager clone from khod whaat/june orders.xlsx",
  "F:/code/khod-bot2/khod-order-bot/taager clone from khod whaat/orders-may-with -2 before date and +2 after date.xlsx",
];

function fixtureFiles() {
  return FIXTURES.map((filePath) => ({
    name: filePath.split(/[\\/]/).pop(),
    buffer: fs.readFileSync(filePath),
  }));
}

function syntheticKhodRows() {
  return [
    { sku: "SKU-REC-001", products: "Recovery Product One", qty: 1, priceNoShipping: 99, orderStatus: "Delivered" },
    { sku: "SKU-REC-001", products: "Recovery Product One", qty: 1, priceNoShipping: 99, orderStatus: "Delivered" },
    { sku: "SKU-REC-002", products: "Recovery Product Two", qty: 2, priceNoShipping: 150, orderStatus: "Delivered" },
    { sku: "SKU-REC-002", products: "Recovery Product Two", qty: 2, priceNoShipping: 150, orderStatus: "Delivered" },
    { sku: "SKU-REC-003", products: "Recovery Product Three", qty: 1, priceNoShipping: 125, orderStatus: "Delivered" },
  ];
}

function main() {
  const inspection = parseRecoveryCustomersFromWorkbooks(fixtureFiles(), { country: "sa" });
  assert.strictEqual(inspection.success, true, "fixture sheets should parse");
  assert.strictEqual(inspection.totalFiles, 2, "two fixture files loaded");
  assert.strictEqual(inspection.totalCanceledRows, 263, "canceled-by-you row count changed");
  assert.strictEqual(inspection.totalValidCustomers, 263, "all canceled fixture phones should normalize");
  assert.strictEqual(inspection.uniqueCustomers, 212, "unique normalized phone count changed");
  assert.strictEqual(inspection.invalidPhones, 0, "fixture should not have invalid canceled phones");

  const filtered = filterRecoveryCustomersByUsedPhones(inspection, inspection.customers.slice(0, 2).map((customer) => customer.normPhone));
  assert.strictEqual(filtered.reusedPhonesSkipped, 2, "used recovery phones should be skipped");
  assert.strictEqual(filtered.uniqueCustomers, inspection.uniqueCustomers - 2, "available customer count should exclude used phones");
  assert.ok(!filtered.customers.some((customer) => customer.normPhone === inspection.customers[0].normPhone), "first used phone should not be available again");
  const phoneList = parseRecoveryCustomersFromWorkbooks([fixtureFiles()[0]], {
    country: "sa",
    mode: "phone-list",
    columns: { phone: 5, name: 1, city: 7, address: 6 },
  });
  assert.strictEqual(phoneList.success, true, "generic phone-list mode should parse");
  assert.ok(phoneList.totalMatchedRows > inspection.fileSummaries[0].statusMatches, "phone-list mode should use more than canceled rows");
  assert.ok(phoneList.uniqueCustomers > inspection.fileSummaries[0].validCustomers, "phone-list mode should collect generic phone rows");

  const catalog = buildRecoveryProductCatalogFromRows(syntheticKhodRows());
  assert.ok(catalog.length >= 3, "synthetic KHOD catalog should produce SKU products");
  assert.ok(catalog.every((product) => product.sku && product.subtotal > 0), "catalog products need SKU and price");

  const selected = catalog.slice(0, 2);
  const orders = buildRecoveryOrders(inspection.customers, selected, { count: 12, seed: 12345 });
  assert.strictEqual(orders.length, 12, "requested order count should be generated");
  assert.strictEqual(new Set(orders.map((order) => order.normPhone)).size, orders.length, "generated preview should not repeat phones");
  assert.ok(orders.every((order) => order.normPhone && order.phone && order.name), "orders need normalized customer data");
  assert.ok(orders.every((order) => selected.some((product) => product.sku === order.sku)), "orders should only use selected products");
  assert.ok(orders.every((order) => order.subtotal > 0 && order.qty > 0 && order.unitPrice > 0), "orders need product pricing");

  const preview = previewRecoveryOrders(orders, 3);
  assert.strictEqual(preview.length, 3, "preview limit should apply");
  console.log("[verify-recovery-bulk-orders] OK", JSON.stringify({
    canceledRows: inspection.totalCanceledRows,
    validCustomers: inspection.totalValidCustomers,
    uniqueCustomers: inspection.uniqueCustomers,
    duplicatePhones: inspection.duplicatePhones,
    fakeNames: inspection.fakeNames,
    generatedOrders: orders.length,
    products: selected.map((product) => product.sku),
  }));
}

main();
