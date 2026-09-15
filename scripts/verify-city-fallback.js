"use strict";

const XLSX = require("xlsx");
const { formatPhone966 } = require("../src/bot/phone");
const { DEFAULT_CITY, matchCityLabel, fallbackCityForOrder } = require("../src/bot/city-fallback");
const { buildOutputExcel, buildFailedExcel } = require("../src/bot/output");
const { parseKhodAnalyticsMap } = require("../src/bot/parser");

let passed = 0;
function check(label, condition) {
  if (!condition) throw new Error(label);
  passed++;
  console.log(`[PASS] ${label}`);
}

function workbookRows(buffer, sheetName) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
}

function khodWorkbookBuffer(rows) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Orders");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

check("Saudi phone formatting remains unchanged", formatPhone966("501234567") === "966501234567");
check("Arabic Riyadh normalizes", matchCityLabel("الرياض").city === "منطقة الرياض");
check("English Jeddah normalizes", matchCityLabel("Jeddah").city === "المنطقة الغربية");
check("unknown city is invalid history", !matchCityLabel("Definitely Unknown").matched);

const baseOrder = {
  sku: "SKU-A", productName: "Product", qty: 1, subtotal: 100,
  date: "2026-06-29", city: "Definitely Unknown", address: "",
  name: "Customer", normPhone: "501234567",
};
const legacyRows = workbookRows(buildOutputExcel([{ ...baseOrder, city: "Raw Legacy City" }]), "Orders");
check("one-argument output keeps legacy behavior", legacyRows[1][4] === "Raw Legacy City");

const globalDecision = fallbackCityForOrder(baseOrder, { fallbackCity: "المنطقة الغربية", fallbackCityBySku: {} });
check("global dynamic fallback works", globalDecision.city === "المنطقة الغربية" && globalDecision.tier === "global");
const skuDecision = fallbackCityForOrder(baseOrder, { fallbackCity: "منطقة الرياض", fallbackCityBySku: { "SKU-A": "المنطقة الغربية" } });
check("SKU fallback precedes global", skuDecision.city === "المنطقة الغربية" && skuDecision.tier === "sku");
const staticDecision = fallbackCityForOrder(baseOrder, { fallbackCity: "Invalid", fallbackCityBySku: { "SKU-A": "Also Invalid" } });
check("invalid data reaches Riyadh static fallback", staticDecision.city === DEFAULT_CITY && staticDecision.tier === "static");

const options = { applyCityFallback: true, fallbackCity: "المنطقة الغربية", fallbackCityBySku: {} };
const outputRows = workbookRows(buildOutputExcel([baseOrder], options), "Orders");
check("output Excel uses dynamic city", outputRows[1][4] === "المنطقة الغربية");
check("blank output address uses resolved city", outputRows[1][6] === "المنطقة الغربية");
const failedRows = workbookRows(buildFailedExcel([{ ...baseOrder, product: "Product", error: "Test" }], options), "Failed Orders");
check("failed Excel uses identical dynamic city", failedRows[1][8] === "المنطقة الغربية");

const deliveredRows = Array.from({ length: 10 }, (_, index) => ({
  "رقم الاوردر": `D-${index + 1}`,
  "حالة الأوردر": index % 2 ? "تم التسليم" : "Delivered",
  "المدينة": index < 6 ? "Riyadh" : "Makkah",
  "sku_code": "SKU-A",
  "الهاتف  1": `9665012345${String(index).slice(-1)}`,
}));
deliveredRows[0]["sku_code"] = "SKU-B";
const ignoredRows = [
  ...Array.from({ length: 12 }, (_, index) => ({ "رقم الاوردر": `F-${index}`, "حالة الأوردر": "فشل التسليم", "المدينة": "Makkah", "sku_code": "SKU-A" })),
  ...Array.from({ length: 5 }, (_, index) => ({ "رقم الاوردر": `B-${index}`, "حالة الأوردر": "تم التسليم", "المدينة": "", "sku_code": "SKU-A" })),
];
const analytics = parseKhodAnalyticsMap(khodWorkbookBuffer([...deliveredRows, ...ignoredRows]));
check("global fallback uses delivered rows only", analytics.fallbackCity === "منطقة الرياض");
check("one global sample is counted per order row", analytics.fallbackCityCounts["منطقة الرياض"] === 6 && analytics.fallbackCityCounts["المنطقة الغربية"] === 4);
check("under-sampled SKUs do not qualify", !analytics.fallbackCityBySku["SKU-A"] && !analytics.fallbackCityBySku["SKU-B"]);
check("blank cities and failed statuses are ignored", analytics.fallbackCityStats.deliveredRows === 15 && analytics.fallbackCityStats.validDeliveredRows === 10);

const qualifiedRows = deliveredRows.map((row) => ({ ...row, "sku_code": "SKU-A" }));
const qualified = parseKhodAnalyticsMap(khodWorkbookBuffer(qualifiedRows));
check("qualified SKU fallback is selected", qualified.fallbackCityBySku["SKU-A"] === "منطقة الرياض");
const underSampled = parseKhodAnalyticsMap(khodWorkbookBuffer(qualifiedRows.slice(0, 9)));
check("under-sampled global fallback is rejected", underSampled.fallbackCity === "");

console.log(`\nKhod city-fallback verification: ${passed} passed.`);
