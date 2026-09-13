"use strict";

const XLSX = require("xlsx");
const { normalizePhoneWithMeta, formatPhone } = require("./phone");

const SAMPLE_ROWS = [
  {
    "Product Name": "Example product name",
    "SKU": "SKU-001",
    "Quantity": 1,
    "Unit Price": 99,
    "Subtotal": 99,
    "Customer Name": "Customer Name",
    "Phone": "966512345678",
    "City": "Riyadh",
    "Address": "Riyadh",
    "Order Date": "2026-07-17",
  },
  {
    "Product Name": "Another product name",
    "SKU": "SKU-002",
    "Quantity": 2,
    "Unit Price": 75,
    "Subtotal": 150,
    "Customer Name": "Second Customer",
    "Phone": "0512345678",
    "City": "Jeddah",
    "Address": "Jeddah",
    "Order Date": "2026-07-17",
  },
];

const FIELD_ALIASES = {
  productName: [
    "product name", "product", "products", "item", "item name", "name of product",
    "المنتج", "المنتجات", "اسم المنتج",
  ],
  sku: ["sku", "product sku", "كود", "كود المنتج"],
  qty: ["quantity", "qty", "pieces", "count", "عدد", "عدد القطع", "الكمية"],
  unitPrice: ["unit price", "price", "سعر", "سعر الوحدة"],
  subtotal: ["subtotal", "total", "total price", "price without shipping", "المجموع", "السعر الكلي بدون الشحن"],
  name: ["customer name", "name", "full name", "recipient name", "اسم العميل", "اسم المستلم"],
  phone: ["phone", "mobile", "phone 1", "phone1", "الهاتف", "رقم الهاتف", "الهاتف  1"],
  city: ["city", "government", "governorate", "المدينة", "المحافظة"],
  address: ["address", "full address", "العنوان"],
  date: ["order date", "date", "created at", "تاريخ الإنشاء", "تاريخ الانشاء"],
};

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[._-]+/g, " ");
}

function normalizeDigits(value) {
  return String(value == null ? "" : value)
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0));
}

function parseNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = normalizeDigits(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "")
    .trim();
  if (!text) return fallback;
  const n = Number(text);
  return Number.isFinite(n) ? n : fallback;
}

function buildHeaderMap(headerRow) {
  const headerToIndex = new Map();
  headerRow.forEach((header, index) => {
    const clean = normalizeHeader(header);
    if (clean && !headerToIndex.has(clean)) headerToIndex.set(clean, index);
  });

  const map = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const idx = headerToIndex.get(normalizeHeader(alias));
      if (idx != null) {
        map[field] = idx;
        break;
      }
    }
  }
  return map;
}

function cell(row, idx) {
  if (idx == null || idx < 0) return "";
  return row[idx] == null ? "" : row[idx];
}

function buildBulkOrderSampleWorkbook() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(SAMPLE_ROWS);
  ws["!cols"] = [
    { wch: 34 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 32 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Bulk Orders Sample");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function samplePreviewRows() {
  return SAMPLE_ROWS.map((row, index) => ({
    row: index + 2,
    productName: row["Product Name"],
    sku: row.SKU,
    qty: row.Quantity,
    subtotal: row.Subtotal,
    name: row["Customer Name"],
    phone: row.Phone,
    city: row.City,
    address: row.Address,
    date: row["Order Date"],
  }));
}

function readWorkbookRows(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = sheetName ? wb.Sheets[sheetName] : null;
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
}

function parseBulkOrderWorkbook(buffer, options = {}) {
  const country = String(options.country || "sa").trim().toLowerCase();
  const rows = readWorkbookRows(buffer).filter((row) => row.some((cellValue) => String(cellValue || "").trim()));
  const errors = [];
  const warnings = [];
  if (!rows.length) {
    return { orders: [], errors: [{ row: 0, field: "sheet", message: "Sheet is empty." }], warnings: [] };
  }

  const header = rows[0];
  const headerMap = buildHeaderMap(header);
  ["productName", "qty", "subtotal", "name", "phone"].forEach((field) => {
    if (headerMap[field] == null) errors.push({ row: 1, field, message: `Missing required column: ${field}` });
  });
  if (errors.length) return { orders: [], errors, warnings };

  const orders = [];
  rows.slice(1).forEach((row, idx) => {
    const rowNumber = idx + 2;
    const productName = String(cell(row, headerMap.productName) || "").trim();
    const sku = String(cell(row, headerMap.sku) || "").trim();
    const qty = Math.max(1, Math.round(parseNumber(cell(row, headerMap.qty), 1)));
    const unitPrice = parseNumber(cell(row, headerMap.unitPrice), 0);
    const explicitSubtotal = parseNumber(cell(row, headerMap.subtotal), 0);
    const subtotal = explicitSubtotal || (unitPrice * qty);
    const name = String(cell(row, headerMap.name) || "").trim();
    const rawPhone = String(cell(row, headerMap.phone) || "").trim();
    const city = String(cell(row, headerMap.city) || "").trim();
    const address = String(cell(row, headerMap.address) || "").trim();
    const dateCell = cell(row, headerMap.date);
    const date = dateCell instanceof Date && !isNaN(dateCell.getTime())
      ? dateCell.toISOString().slice(0, 10)
      : String(dateCell || "").trim();
    const phoneMeta = normalizePhoneWithMeta(rawPhone, country);

    if (!productName) errors.push({ row: rowNumber, field: "productName", message: "Product Name is required." });
    if (!name) errors.push({ row: rowNumber, field: "customerName", message: "Customer Name is required." });
    if (!phoneMeta) errors.push({ row: rowNumber, field: "phone", message: "Phone is invalid for the selected account country." });
    if (!subtotal || subtotal <= 0) errors.push({ row: rowNumber, field: "subtotal", message: "Subtotal must be greater than zero." });
    if (phoneMeta && phoneMeta.uncertain) warnings.push({ row: rowNumber, field: "phone", message: "Phone was auto-corrected and should be reviewed." });
    if (!city) warnings.push({ row: rowNumber, field: "city", message: "City is empty; EasyOrders fallback city will be used." });

    if (productName && name && phoneMeta && subtotal > 0) {
      orders.push({
        row: rowNumber,
        productName,
        sku,
        qty,
        unitPrice: unitPrice || (subtotal / qty),
        subtotal,
        name,
        phone: formatPhone(phoneMeta.digits, country) || rawPhone,
        rawPhone,
        normPhone: phoneMeta.digits,
        uncertain: !!phoneMeta.uncertain,
        city,
        address: address || city,
        date,
        createdAt: date,
        region: "",
        source: "manual_sheet",
        orderStatus: "Under processing",
        amountDue: 0,
        marketerCommission: 0,
        khodOrderNumber: "",
      });
    }
  });

  return { orders, errors, warnings };
}

function previewBulkOrders(orders, limit = 50) {
  return (Array.isArray(orders) ? orders : []).slice(0, limit).map((order) => ({
    row: order.row,
    productName: order.productName || "",
    sku: order.sku || "",
    qty: order.qty || 1,
    subtotal: order.subtotal || 0,
    name: order.name || "",
    phone: order.phone || order.rawPhone || "",
    city: order.city || "",
    address: order.address || "",
    date: order.date || "",
  }));
}

module.exports = {
  buildBulkOrderSampleWorkbook,
  parseBulkOrderWorkbook,
  previewBulkOrders,
  samplePreviewRows,
};
