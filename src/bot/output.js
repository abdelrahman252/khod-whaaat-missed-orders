"use strict";

const XLSX = require("xlsx");
const { formatPhone966 } = require("./phone");

// ════════════════════════════════════════
// BUILD OUTPUT EXCEL
//
// Columns requested (matching Khod export field names exactly):
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
function buildOutputExcel(orders) {
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

  const dataRows = orders.map((order) => [
    order.qty        || 1,
    order.productName || "",
    order.subtotal   || "",
    order.date       || "",
    order.city       || "",
    order.region     || "",
    order.address    || "",
    order.name       || "",
    formatPhone966(order.normPhone) || "",
  ]);

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

module.exports = { buildOutputExcel };
