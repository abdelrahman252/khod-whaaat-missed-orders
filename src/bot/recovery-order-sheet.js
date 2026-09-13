"use strict";

const XLSX = require("xlsx");
const { normalizePhoneWithMeta, formatPhone } = require("./phone");

function asBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return Buffer.from(value);
  if (value && Array.isArray(value.data)) return Buffer.from(value.data);
  return Buffer.from(value || []);
}

function normalizeDigits(value) {
  return String(value == null ? "" : value)
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0));
}

function normalizeText(value) {
  return normalizeDigits(value)
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value) {
  return normalizeText(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

function parseNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = normalizeDigits(value).replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
  if (!text) return fallback;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function readRows(buffer) {
  const workbook = XLSX.read(asBuffer(buffer), { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames && workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
}

function headerIndex(header, candidates, fallback = -1) {
  const normalized = header.map((value) => normalizeText(value));
  const compact = header.map((value) => compactText(value));
  const wanted = candidates.map((value) => normalizeText(value));
  const wantedCompact = candidates.map((value) => compactText(value));

  for (const candidate of wanted) {
    const index = normalized.indexOf(candidate);
    if (index >= 0) return index;
  }
  for (const candidate of wantedCompact) {
    const index = compact.indexOf(candidate);
    if (index >= 0) return index;
  }
  for (const candidate of wanted) {
    const index = normalized.findIndex((value) => value && candidate && value.includes(candidate));
    if (index >= 0) return index;
  }
  for (const candidate of wantedCompact) {
    const index = compact.findIndex((value) => value && candidate && value.includes(candidate));
    if (index >= 0) return index;
  }
  return fallback;
}

const COLUMN_CANDIDATES = Object.freeze({
  status: [
    "status",
    "order status",
    "\u0627\u0644\u062D\u0627\u0644\u0629",
    "\u062D\u0627\u0644\u0629",
    "\u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628",
    "\u062D\u0627\u0644\u0629 \u0627\u0644\u0623\u0648\u0631\u062F\u0631",
    "\u062D\u0627\u0644\u0647 \u0627\u0644\u0627\u0648\u0631\u062F\u0631",
  ],
  phone: [
    "phone",
    "mobile",
    "phone 1",
    "phone1",
    "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641",
    "\u0627\u0644\u0647\u0627\u062A\u0641",
    "\u0627\u0644\u062C\u0648\u0627\u0644",
    "\u062C\u0648\u0627\u0644",
    "\u0645\u0648\u0628\u0627\u064A\u0644",
  ],
  name: [
    "name",
    "full name",
    "customer name",
    "recipient name",
    "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u0644\u0645",
    "\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644",
    "\u0627\u0644\u0627\u0633\u0645",
    "\u0627\u0644\u0625\u0633\u0645",
  ],
  city: ["city", "government", "governorate", "\u0627\u0644\u0645\u062D\u0627\u0641\u0638\u0629", "\u0627\u0644\u0645\u062F\u064A\u0646\u0629"],
  address: ["address", "\u0627\u0644\u0639\u0646\u0648\u0627\u0646", "\u0627\u0633\u0645 \u0627\u0644\u0634\u0627\u0631\u0639"],
  createdAt: ["created at", "order date", "date", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0646\u0634\u0627\u0621", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0646\u0634\u0627\u0621"],
  orderNumber: ["order number", "\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628", "\u0631\u0642\u0645 \u0627\u0644\u0627\u0648\u0631\u062F\u0631"],
});

function detectColumns(header, overrides = {}) {
  const result = {};
  Object.keys(COLUMN_CANDIDATES).forEach((field) => {
    const override = overrides[field];
    const numericOverride = override === "" || override == null ? NaN : Number(override);
    if (Number.isInteger(numericOverride) && numericOverride >= 0 && numericOverride < header.length) {
      result[field] = numericOverride;
      return;
    }
    if (typeof override === "string" && override.trim()) {
      const exact = header.findIndex((value) => normalizeText(value) === normalizeText(override));
      if (exact >= 0) {
        result[field] = exact;
        return;
      }
    }
    result[field] = headerIndex(header, COLUMN_CANDIDATES[field]);
  });
  return result;
}

function isCanceledByYouStatus(value) {
  const normalized = normalizeText(value);
  const compact = compactText(value);
  if (!normalized) return false;
  if (/cancel+ed by (you|seller|merchant|store)/i.test(String(value || ""))) return true;
  if (compact.includes(compactText("\u0637\u0644\u0628 \u0645\u0644\u063A\u064A \u0628\u0648\u0627\u0633\u0637\u062A\u0643"))) return true;
  if (compact.includes(compactText("\u0627\u0644\u0637\u0644\u0628 \u0645\u0644\u063A\u0649 \u0628\u0648\u0627\u0633\u0637\u062A\u0643"))) return true;
  return compact.includes(compactText("\u0645\u0644\u063A")) &&
    (compact.includes(compactText("\u0628\u0648\u0627\u0633\u0637\u062A\u0643")) || compact.includes(compactText("\u0628\u0648\u0627\u0633\u0637\u0629")));
}

function isLikelyRealName(value) {
  const text = normalizeText(value);
  if (!text || /^\d+$/.test(text)) return false;
  const letters = text.match(/\p{L}/gu) || [];
  if (letters.length < 2) return false;
  const compact = text.replace(/\s+/g, "");
  if (/^(.)\1{2,}$/.test(compact)) return false;
  return true;
}

function cleanName(value, normPhone) {
  const raw = String(value == null ? "" : value).trim();
  return isLikelyRealName(raw) ? raw : "0" + normPhone;
}

function parseRecoveryCustomersFromWorkbook(input = {}, options = {}) {
  const rows = readRows(input.buffer);
  const header = rows[0] || [];
  const country = String(options.country || "sa").trim().toLowerCase();
  const mode = String(options.mode || "canceled").trim().toLowerCase();
  const phoneListMode = mode === "phone-list" || mode === "phone_list" || mode === "phones";
  const columns = detectColumns(header, options.columns || {});
  const errors = [];
  const warnings = [];
  const customers = [];
  const fileName = input.name || input.filename || "sheet";
  const required = phoneListMode ? ["phone"] : ["status", "phone", "name"];

  required.forEach((field) => {
    if (columns[field] == null || columns[field] < 0) {
      errors.push({ row: 1, field, message: `Missing required column: ${field}`, fileName });
    }
  });
  if (errors.length) {
    return {
      fileName,
      rows: Math.max(0, rows.length - 1),
      columns,
      headers: header.map(String),
      customers,
      errors,
      warnings,
      statusMatches: 0,
      invalidPhones: 0,
      fakeNames: 0,
    };
  }

  let statusMatches = 0;
  let invalidPhones = 0;
  let fakeNames = 0;
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index] || [];
    const status = columns.status >= 0 ? row[columns.status] : "";
    if (!phoneListMode && !isCanceledByYouStatus(status)) continue;
    statusMatches++;

    const rawPhone = row[columns.phone];
    const phoneMeta = normalizePhoneWithMeta(rawPhone, country);
    if (!phoneMeta) {
      invalidPhones++;
      warnings.push({ row: index + 1, field: "phone", message: "Phone could not be normalized.", fileName });
      continue;
    }

    const rawName = columns.name >= 0 ? String(row[columns.name] || "").trim() : "";
    const name = cleanName(rawName, phoneMeta.digits);
    if (name !== rawName) fakeNames++;
    if (phoneMeta.uncertain) {
      warnings.push({ row: index + 1, field: "phone", message: "Phone was auto-corrected and should be reviewed.", fileName });
    }

    customers.push({
      source: phoneListMode ? "phone_list" : "canceled_by_you",
      fileName,
      row: index + 1,
      orderNumber: columns.orderNumber >= 0 ? String(row[columns.orderNumber] || "").trim() : "",
      name,
      rawName,
      rawPhone: String(rawPhone || "").trim(),
      normPhone: phoneMeta.digits,
      phone: formatPhone(phoneMeta.digits, country) || String(rawPhone || "").trim(),
      uncertain: !!phoneMeta.uncertain,
      phoneCorrection: phoneMeta.correction || "",
      city: columns.city >= 0 ? String(row[columns.city] || "").trim() : "",
      address: columns.address >= 0 ? String(row[columns.address] || "").trim() : "",
      date: columns.createdAt >= 0 ? String(row[columns.createdAt] || "").trim() : "",
      status: String(status || (phoneListMode ? "phone-list" : "")).trim(),
    });
  }

  return {
    fileName,
    rows: Math.max(0, rows.length - 1),
    columns,
    headers: header.map(String),
    customers,
    errors,
    warnings,
    statusMatches,
    matchedRows: statusMatches,
    invalidPhones,
    fakeNames,
  };
}

function parseRecoveryCustomersFromWorkbooks(files = [], options = {}) {
  const fileSummaries = [];
  const allCustomers = [];
  const errors = [];
  const warnings = [];
  let statusMatches = 0;
  let invalidPhones = 0;
  let fakeNames = 0;

  files.forEach((file) => {
    const parsed = parseRecoveryCustomersFromWorkbook(file, options);
    fileSummaries.push({
      fileName: parsed.fileName,
      rows: parsed.rows,
      columns: parsed.columns,
      headers: parsed.headers,
      statusMatches: parsed.statusMatches,
      matchedRows: parsed.matchedRows,
      validCustomers: parsed.customers.length,
      invalidPhones: parsed.invalidPhones,
      fakeNames: parsed.fakeNames,
    });
    allCustomers.push(...parsed.customers);
    errors.push(...parsed.errors);
    warnings.push(...parsed.warnings);
    statusMatches += parsed.statusMatches;
    invalidPhones += parsed.invalidPhones;
    fakeNames += parsed.fakeNames;
  });

  const seen = new Set();
  const customers = [];
  let duplicates = 0;
  for (const customer of allCustomers) {
    if (seen.has(customer.normPhone)) {
      duplicates++;
      continue;
    }
    seen.add(customer.normPhone);
    customers.push(customer);
  }

  return {
    success: errors.length === 0,
    totalFiles: files.length,
    totalRows: fileSummaries.reduce((sum, file) => sum + file.rows, 0),
    totalCanceledRows: statusMatches,
    totalMatchedRows: statusMatches,
    totalValidCustomers: allCustomers.length,
    uniqueCustomers: customers.length,
    duplicatePhones: duplicates,
    invalidPhones,
    fakeNames,
    customers,
    previewCustomers: customers.slice(0, 60),
    fileSummaries,
    errors,
    warnings,
  };
}

function filterRecoveryCustomersByUsedPhones(inspection = {}, usedPhones = []) {
  const used = new Set((Array.isArray(usedPhones) ? usedPhones : [])
    .map((phone) => String(phone || "").trim())
    .filter(Boolean));
  const customers = Array.isArray(inspection.customers) ? inspection.customers : [];
  const totalExtractedUniqueCustomers = Number(inspection.uniqueCustomers || customers.length || 0);
  if (!used.size || !customers.length) {
    return {
      ...inspection,
      totalExtractedUniqueCustomers,
      reusedPhonesSkipped: 0,
      availableCustomers: customers.length,
    };
  }

  const available = [];
  let reusedPhonesSkipped = 0;
  customers.forEach((customer) => {
    const phone = String(customer && customer.normPhone || "").trim();
    if (phone && used.has(phone)) {
      reusedPhonesSkipped++;
      return;
    }
    available.push(customer);
  });

  return {
    ...inspection,
    totalExtractedUniqueCustomers,
    customers: available,
    previewCustomers: available.slice(0, 60),
    uniqueCustomers: available.length,
    availableCustomers: available.length,
    reusedPhonesSkipped,
  };
}
function modeNumber(values) {
  const freq = new Map();
  let winner = 0;
  let winnerCount = 0;
  values.forEach((value) => {
    const rounded = Math.round(Number(value) || 0);
    if (rounded <= 0) return;
    const count = (freq.get(rounded) || 0) + 1;
    freq.set(rounded, count);
    if (count > winnerCount) {
      winner = rounded;
      winnerCount = count;
    }
  });
  return winner;
}

function buildRecoveryProductCatalogFromRows(rows = [], options = {}) {
  const bySku = new Map();
  rows.forEach((row) => {
    const sku = String(row && (row.sku || row.productSku || row.skuNumber) || "").trim();
    if (!sku) return;
    const name = String(row.productName || row.products || row.product || sku).trim() || sku;
    const qty = Math.max(1, Math.round(parseNumber(row.qty || row.quantity, 1)));
    const priceNoShipping = parseNumber(row.priceNoShipping, 0);
    const subtotal = priceNoShipping ||
      Math.max(parseNumber(row.totalPrice, 0) - parseNumber(row.shippingCost, 0), 0) ||
      parseNumber(row.amountDue, 0) ||
      parseNumber(row.orderValue, 0);
    if (subtotal <= 0) return;

    if (!bySku.has(sku)) {
      bySku.set(sku, {
        sku,
        productName: name,
        names: new Map(),
        quantities: new Map(),
        samples: [],
      });
    }
    const entry = bySku.get(sku);
    entry.names.set(name, (entry.names.get(name) || 0) + 1);
    entry.quantities.set(qty, (entry.quantities.get(qty) || 0) + 1);
    entry.samples.push({ qty, subtotal, unitPrice: subtotal / qty });
  });

  const products = Array.from(bySku.values()).map((entry) => {
    const name = Array.from(entry.names.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || entry.productName || entry.sku;
    const qty = Number(Array.from(entry.quantities.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 1);
    const sameQtySamples = entry.samples.filter((sample) => sample.qty === qty);
    const sampleSet = sameQtySamples.length ? sameQtySamples : entry.samples;
    const subtotal = modeNumber(sampleSet.map((sample) => sample.subtotal));
    const unitPrice = modeNumber(sampleSet.map((sample) => sample.unitPrice)) || Math.round(subtotal / qty);
    return {
      key: entry.sku,
      sku: entry.sku,
      productName: name,
      name,
      qty,
      subtotal,
      unitPrice,
      sampleCount: entry.samples.length,
    };
  }).filter((product) => product.sku && product.subtotal > 0);

  const query = normalizeText(options.query || "");
  const filtered = query
    ? products.filter((product) => normalizeText(product.name + " " + product.sku).includes(query))
    : products;
  return filtered.sort((a, b) => b.sampleCount - a.sampleCount || a.name.localeCompare(b.name));
}

function seededShuffle(items, seedValue) {
  const result = items.slice();
  let seed = Number(seedValue);
  if (!Number.isFinite(seed) || seed <= 0) seed = Date.now();
  for (let i = result.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildRecoveryOrders(customers = [], products = [], options = {}) {
  const count = Math.max(0, Math.min(
    Math.round(Number(options.count) || 0),
    customers.length
  ));
  const selectedProducts = products.filter((product) => product && product.sku && product.subtotal > 0);
  if (!count) throw new Error("Choose how many orders to create.");
  if (!customers.length) throw new Error("No canceled customers were extracted.");
  if (!selectedProducts.length) throw new Error("Select at least one SKU-backed product.");

  const shuffledCustomers = seededShuffle(customers, options.seed);
  const shuffledProducts = seededShuffle(selectedProducts, (Number(options.seed) || Date.now()) + 17);
  const orders = [];
  for (let i = 0; i < count; i++) {
    const customer = shuffledCustomers[i];
    const product = shuffledProducts[i % shuffledProducts.length];
    const qty = Math.max(1, Math.round(Number(product.qty) || 1));
    const subtotal = Math.round(Number(product.subtotal) || Number(product.unitPrice) * qty || 0);
    orders.push({
      source: "canceled_recovery",
      customerSourceFile: customer.fileName || "",
      customerSourceRow: customer.row || "",
      name: customer.name || ("0" + customer.normPhone),
      rawPhone: customer.rawPhone,
      phone: formatPhone(customer.normPhone, "sa") || customer.phone,
      normPhone: customer.normPhone,
      uncertain: !!customer.uncertain,
      phoneCorrection: customer.phoneCorrection || "",
      city: customer.city || "",
      address: customer.address || customer.city || "",
      date: customer.date || "",
      createdAt: customer.date || "",
      productName: product.productName || product.name || product.sku,
      sku: product.sku,
      qty,
      subtotal,
      unitPrice: Math.round(Number(product.unitPrice) || subtotal / qty),
      orderStatus: "Under processing",
      amountDue: 0,
      marketerCommission: 0,
      khodOrderNumber: "",
    });
  }
  return orders;
}

function previewRecoveryOrders(orders = [], limit = 60) {
  return orders.slice(0, limit).map((order) => ({
    name: order.name || "",
    phone: order.phone || (order.normPhone ? "966" + order.normPhone : ""),
    productName: order.productName || "",
    sku: order.sku || "",
    qty: order.qty || 1,
    subtotal: order.subtotal || 0,
    city: order.city || "",
    fileName: order.customerSourceFile || "",
    row: order.customerSourceRow || "",
  }));
}

module.exports = {
  asBuffer,
  normalizeText,
  compactText,
  detectColumns,
  isCanceledByYouStatus,
  parseRecoveryCustomersFromWorkbook,
  parseRecoveryCustomersFromWorkbooks,
  filterRecoveryCustomersByUsedPhones,
  buildRecoveryProductCatalogFromRows,
  buildRecoveryOrders,
  previewRecoveryOrders,
};
