"use strict";

const XLSX = require("xlsx");
const { parseFullMonthSnapshot } = require("./parser");

function asBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (Array.isArray(value)) return Buffer.from(value);
  if (value && value.type === "Buffer" && Array.isArray(value.data)) return Buffer.from(value.data);
  throw new Error("Workbook buffer is missing or invalid.");
}

function parseDateKey(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const parts = String(value).split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return isNaN(date.getTime()) ? null : date;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizedHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function findHeader(header, candidates) {
  const values = header.map(normalizedHeader);
  const wanted = candidates.map(normalizedHeader);
  for (const candidate of wanted) {
    const exact = values.indexOf(candidate);
    if (exact >= 0) return exact;
  }
  for (const candidate of wanted) {
    const partial = values.findIndex((value) => value && value.includes(candidate));
    if (partial >= 0) return partial;
  }
  return -1;
}

const KHOD_REQUIRED_HEADERS = {
  order: ["Order Number", "رقم الاوردر", "رقم الطلب"],
  status: ["Status", "حالة الأوردر", "حاله الاوردر", "الحالة", "حالة"],
  sku: ["SKU", "sku_code", "كود_المنتج"],
  created: ["Created At", "تاريخ الإنشاء", "تاريخ الانشاء"],
};

function validateKhodWorkbook(buffer) {
  let workbook;
  try {
    workbook = XLSX.read(asBuffer(buffer), { type: "buffer", cellDates: false });
  } catch (error) {
    throw new Error(`KHOD WHAAT workbook could not be read: ${error.message}`);
  }
  const sheetName = workbook.SheetNames && workbook.SheetNames[0];
  if (!sheetName || !workbook.Sheets[sheetName]) throw new Error("KHOD WHAAT workbook has no worksheets.");
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
  if (!rows.length) throw new Error("KHOD WHAAT workbook is empty.");
  const headerMap = {};
  const missing = [];
  Object.entries(KHOD_REQUIRED_HEADERS).forEach(([name, candidates]) => {
    headerMap[name] = findHeader(rows[0] || [], candidates);
    if (headerMap[name] < 0) missing.push(name);
  });
  if (missing.length) {
    throw new Error(`This does not look like a KHOD WHAAT affiliate orders export. Missing required columns: ${missing.join(", ")}.`);
  }
  return { sourceRows: Math.max(0, rows.length - 1), headerMap };
}

function processDashboardSheet(options = {}) {
  const now = new Date();
  const dateFrom = parseDateKey(options.dateFrom) || new Date(now.getFullYear(), now.getMonth(), 1);
  const dateTo = parseDateKey(options.dateTo) || new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dateFrom > dateTo) throw new Error("A valid dashboard date range is required.");

  const khodBuffer = options.khodBuffer || options.taagerBuffer;
  const khodValidation = validateKhodWorkbook(khodBuffer);
  const rangeFrom = dateKey(dateFrom);
  const rangeTo = dateKey(dateTo);
  const parsedRows = parseFullMonthSnapshot(asBuffer(khodBuffer), {
    dateFrom: rangeFrom,
    dateTo: rangeTo,
  });
  if (!Array.isArray(parsedRows)) throw new Error("KHOD WHAAT workbook could not be parsed.");

  const rows = parsedRows.filter((row) => {
    const createdAt = String(row && row.createdAt || "").slice(0, 10);
    return createdAt && createdAt >= rangeFrom && createdAt <= rangeTo;
  }).map((row) => ({
    ...row,
    country: row.country || row.khodCountry || row.taagerCountry || "sa",
    khodCountry: row.khodCountry || row.taagerCountry || row.country || "sa",
    taagerCountry: row.taagerCountry || row.khodCountry || row.country || "sa",
  }));
  const rowsOutsidePeriod = parsedRows.length - rows.length;
  return {
    rows,
    learnedSkuNameMap: {},
    enrichmentDiagnostics: { provider: "khod-sheet", status: "source" },
    warnings: rowsOutsidePeriod > 0 ? [{
      code: "ROWS_OUTSIDE_PERIOD",
      count: rowsOutsidePeriod,
      message: `${rowsOutsidePeriod} row(s) outside the selected dashboard period were ignored.`,
    }] : [],
    dateFrom: rangeFrom,
    dateTo: rangeTo,
    snapshotMonth: rangeTo.slice(0, 7),
    parseDiagnostics: {
      source: "khod-sheet",
      sourceRows: khodValidation.sourceRows,
      parserRows: parsedRows.length,
      parsedRows: rows.length,
      rowsOutsidePeriod,
      khodValidation,
      enrichment: { provider: "khod-sheet", status: "source" },
      country: "sa",
    },
  };
}

function processDashboardSheets(options = {}) {
  return processDashboardSheet(options);
}

module.exports = {
  asBuffer,
  validateKhodWorkbook,
  processDashboardSheet,
  processDashboardSheets,
};
