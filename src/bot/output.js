"use strict";

const XLSX = require("xlsx");
const { formatPhone } = require("./phone");
const { fallbackCityForOrder } = require("./city-fallback");

function configuredCountry(options) {
  if (options && options.country) return String(options.country).trim().toLowerCase();
  try {
    return String(JSON.parse(process.env.BOT_CONFIG || "{}").khodCountry || "sa").trim().toLowerCase();
  } catch (_) {
    return "sa";
  }
}

function cityDecision(order, options) {
  if (order && order.resolvedCity) {
    return { city: order.resolvedCity, tier: order.cityFallbackTier || "provided" };
  }
  const hasConfiguredFallback = options.applyCityFallback
    || options.fallbackCity
    || (options.fallbackCityBySku instanceof Map && options.fallbackCityBySku.size > 0)
    || Object.keys(options.fallbackCityBySku || {}).length > 0;
  if (!hasConfiguredFallback) {
    return { city: String(order?.city || "").trim(), tier: order?.city ? "provided" : "static" };
  }
  return fallbackCityForOrder(order, options);
}

function logFallbackUsage(label, orders, usage, options) {
  const configuredSkuFallbacks = options.fallbackCityBySku instanceof Map
    ? options.fallbackCityBySku.size
    : Object.keys(options.fallbackCityBySku || {}).length;
  console.log(
    `[City fallback] ${label} rows=${orders.length} | provided=${usage.provided} | SKU=${usage.sku} | global=${usage.global} | static=${usage.static}`
    + ` | configured SKU fallbacks=${configuredSkuFallbacks} | global city=${options.fallbackCity || "none"}`
  );
}

// ════════════════════════════════════════
// BUILD OUTPUT EXCEL
//
// Columns requested (matching KHOD WHAAT export field names exactly):
//   عدد القطع              — qty
//   المنتجات               — product name
//   السعر الكلي بدون الشحن — price without shipping (subtotal)
//   تاريخ الإنشاء          — creation date
//   المدينة                — city
//   المنطقة                — region
//   العنوان                — address
//   اسم المستلم            — customer name
//   الهاتف  1              — phone (966XXXXXXXXX format)
// ════════════════════════════════════════
function buildOutputExcel(orders, options = {}) {
  const country = configuredCountry(options);
  const wb = XLSX.utils.book_new();

  const headers = [
    "عدد القطع",
    "المنتجات",
    "السعر الكلي بدون الشحن",
    "تاريخ الإنشاء",
    "المدينة",
    "المنطقة",
    "العنوان",
    "اسم المستلم",
    "الهاتف  1",
  ];

  const usage = { provided: 0, sku: 0, global: 0, static: 0 };
  const dataRows = orders.map((order) => {
    const decision = cityDecision(order, options);
    usage[decision.tier]++;
    return [
      order.qty        || 1,
      order.productName || "",
      order.subtotal   || "",
      order.date       || "",
      decision.city,
      order.region     || "",
      order.address    || decision.city,
      order.name       || "",
      formatPhone(order.normPhone, country) || "",
    ];
  });
  logFallbackUsage("Output Excel", orders, usage, options);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  ws["!cols"] = [
    { wch: 12 }, { wch: 45 }, { wch: 24 }, { wch: 16 },
    { wch: 20 }, { wch: 20 }, { wch: 35 }, { wch: 25 }, { wch: 16 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Orders");

  // ── Summary sheet ──
  const groups = {};
  for (const order of orders) {
    const key = order.productName || "Unknown";
    if (!groups[key]) groups[key] = { productName: key, count: 0, totalQty: 0 };
    groups[key].count++;
    groups[key].totalQty += order.qty || 1;
  }

  const summaryHeaders = ["المنتج", "عدد الطلبات", "إجمالي القطع"];
  const summaryRows = Object.values(groups).map((g) => [g.productName, g.count, g.totalQty]);
  summaryRows.push(["TOTAL", orders.length, orders.reduce((s, o) => s + (o.qty || 1), 0)]);

  const summaryWs = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  summaryWs["!cols"] = [{ wch: 45 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

// ════════════════════════════════════════
// BUILD FAILED ORDERS EXCEL
//
// One sheet with full order details + source column (real / missed)
// so the user knows where each failed order came from.
// ════════════════════════════════════════
function buildFailedExcel(failedOrders, options = {}) {
  const wb = XLSX.utils.book_new();

  const headers = [
    "المصدر",                   // source: real orders / missed orders
    "اسم المستلم",              // customer name
    "الهاتف",                   // phone
    "المنتجات",                 // product name
    "SKU",
    "رقم غير مؤكد",
    "عدد القطع",                // qty
    "السعر الكلي بدون الشحن",  // subtotal
    "المدينة",                  // city
    "العنوان",                  // address
    "سبب الفشل",                // error reason
  ];

  const sourceLabel = (s) => {
    if (s === "missed") return "طلبات فائتة";
    return "طلبات فعلية";
  };

  const usage = { provided: 0, sku: 0, global: 0, static: 0 };
  const dataRows = failedOrders.map((f) => {
    const decision = cityDecision(f, options);
    usage[decision.tier]++;
    return [
      sourceLabel(f.source),
      f.name    || "",
      f.phone   || "",
      f.product || "",
      f.sku     || "",
      f.uncertain ? "YES" : "NO",
      f.qty     || 1,
      f.subtotal || "",
      decision.city,
      f.address || decision.city,
      f.error   || "",
    ];
  });
  logFallbackUsage("Failed Excel", failedOrders, usage, options);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  ws["!cols"] = [
    { wch: 16 }, { wch: 25 }, { wch: 16 }, { wch: 45 }, { wch: 22 },
    { wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 20 }, { wch: 35 }, { wch: 50 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Failed Orders");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function buildSkippedExcel(skippedOrders) {
  if (!skippedOrders || skippedOrders.length === 0) return null;

  const reasonLabels = {
    phone_parse_failed: "Invalid phone number",
    phone_uncertain_zero_appended: "Phone missing digit - trailing 0 added",
    product_not_in_catalog: "Product not found in catalog",
  };

  const headers = [
    "Account Email",
    "Account Label",
    "KHOD WHAAT Country",
    "Full Name",
    "Raw Phone",
    "Product",
    "City",
    "Address",
    "Reason",
    "Reason Label",
    "Uncertain",
  ];

  const rows = skippedOrders.map((o) => {
    const reasonKey = o.uncertain && o.reason === "phone_parse_failed"
      ? "phone_uncertain_zero_appended"
      : o.reason;
    return [
      o.accountEmail || "",
      o.accountLabel || "",
      o.khodCountry || "sa",
      o.name || "",
      o.rawPhone || "",
      o.productName || "",
      o.city || "",
      o.address || "",
      reasonKey || "",
      reasonLabels[reasonKey] || reasonKey || "",
      o.uncertain ? "YES" : "NO",
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = [
    { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 28 },
    { wch: 18 }, { wch: 45 }, { wch: 22 }, { wch: 35 },
    { wch: 30 }, { wch: 34 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Couldnt Process");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

module.exports = { buildOutputExcel, buildFailedExcel, buildSkippedExcel };
