"use strict";

const XLSX = require("xlsx");
const { normalizePhone } = require("./phone");

// ── Date helpers ──
function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function matchesDateRange(val, dateFrom, dateTo) {
  const d = parseExcelDate(val);
  if (!d) return false;
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const from = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate());
  const to = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate());
  return day >= from && day <= to;
}

// ── Parse Taager sheet → Set of normalized phones ──
function parseTaagerPhones(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Find header row to locate phone column
  let phoneColIdx = 5; // default col index
  const header = rows[0] || [];
  for (let i = 0; i < header.length; i++) {
    if (String(header[i] || "").includes("هاتف")) {
      phoneColIdx = i;
      break;
    }
  }

  const phones = new Set();
  for (let i = 1; i < rows.length; i++) {
    const raw = rows[i][phoneColIdx];
    const norm = normalizePhone(raw);
    if (norm) phones.add(norm);
  }

  console.log(`📋 khod: ${phones.size} phones loaded`);
  return phones;
}

// ── Parse Real Orders ──
function parseRealOrders(buffer, dateFrom, dateTo) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  const orders = [];
  const skipped = { date: 0, phone: 0, status: 0 };

  for (const row of rows) {
    // Date filter
    if (!matchesDateRange(row["CreatedAt"], dateFrom, dateTo)) {
      skipped.date++;
      continue;
    }

    // Skip cancelled
    const status = (row["Status"] || "").toLowerCase();
    if (status === "cancelled" || status === "canceled") {
      skipped.status++;
      continue;
    }

    const normPhone = normalizePhone(row["Phone"]);
    if (!normPhone) {
      skipped.phone++;
      continue;
    }

    const rawSku = (row["SKU"] || "").toString().split("\n")[0].trim();
    const productName = (row["Product Name"] || "").toString().trim();
    const qty = parseInt((row["Quantity"] || "1").toString().split("\n")[0]) || 1;
    const itemPrice = parseFloat((row["Item Price"] || "0").toString().replace(/[^\d.]/g, "")) || 0;
    const totalCost = parseFloat((row["Total Cost"] || "0").toString().replace(/[^\d.]/g, "")) || 0;
    const shippingCost = parseFloat((row["Shipping Cost"] || "28").toString().replace(/[^\d.]/g, "")) || 28;

    // Price = total cost - shipping
    const subtotal = itemPrice > 0 ? itemPrice * qty : (totalCost - shippingCost);

    // Format date as string for output
    const rawDate = row["CreatedAt"];
    let dateStr = "";
    try { dateStr = parseExcelDate(rawDate)?.toISOString().slice(0,10) || ""; } catch {}

    // City: support both "City" and "Government" columns; no fallback here — null means "use default later"
    const rawCity = (row["City"] || row["Government"] || "").toString().trim();
    console.log("RAW CITY:", row["City"]);

    orders.push({
      source: "real",
      normPhone,
      rawPhone: row["Phone"],
      name: (row["FullName"] || "").toString().trim() || ("0" + normPhone),
      city: rawCity !== "" ? rawCity : null,
      region: "",
      address: (row["Address"] || "").toString().trim() || null,
      date: dateStr,
      sku: rawSku,
      productName,
      qty,
      subtotal,
      unitPrice: itemPrice > 0 ? itemPrice : Math.round(subtotal / qty),
    });
  }

  console.log(`📦 Real orders: ${orders.length} valid | skipped date:${skipped.date} phone:${skipped.phone} status:${skipped.status}`);
  return orders;
}

// ── Parse Missed Orders ──
function parseMissedOrders(buffer, dateFrom, dateTo) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  const orders = [];
  const skipped = { date: 0, phone: 0, completed: 0 };

  for (const row of rows) {
    // Skip completed
    const isCompleted = String(row["Is Completed"] || "").toLowerCase();
    if (isCompleted === "true" || isCompleted === "1") {
      skipped.completed++;
      continue;
    }

    // Date filter
    if (!matchesDateRange(row["Created At"], dateFrom, dateTo)) {
      skipped.date++;
      continue;
    }

    const normPhone = normalizePhone(row["Phone"]);
    if (!normPhone) {
      skipped.phone++;
      continue;
    }

    // Product name: extract first product from [لعبة ...][other...] → لعبة ...
    const rawProduct = (row["Products"] || "").toString().trim();
    const bracketMatch = rawProduct.match(/\[([^\]]+)\]/);
    const productName = bracketMatch ? bracketMatch[1].trim() : rawProduct.replace(/^\[|\]$/, "").trim();

    const rawDate2 = row["Created At"];
    let dateStr2 = "";
    try { dateStr2 = parseExcelDate(rawDate2)?.toISOString().slice(0,10) || ""; } catch {}

    // City: support both "Government" and "City" columns; no fallback here — null means "use default later"
    const rawCityMissed = (row["Government"] || row["City"] || "").toString().trim();
    console.log("RAW CITY:", row["Government"] || row["City"]);

    orders.push({
      source: "missed",
      normPhone,
      rawPhone: row["Phone"],
      name: (row["Full Name"] || "").toString().trim() || ("0" + normPhone),
      city: rawCityMissed !== "" ? rawCityMissed : null,
      region: "",
      address: (row["Address"] || "").toString().trim() || null,
      date: dateStr2,
      productName,
      sku: null,       // will be resolved later
      qty: null,       // will be resolved later
      subtotal: null,  // will be resolved later
      unitPrice: null,
    });
  }

  console.log(`📦 Missed orders: ${orders.length} valid | skipped date:${skipped.date} phone:${skipped.phone} completed:${skipped.completed}`);
  return orders;
}

// ── Build product catalog from real orders ──
// Maps productName → { sku, minQty, minPrice, prices: {qty: price} }
function buildProductCatalog(realOrders) {
  const catalog = {}; // productName → data

  for (const order of realOrders) {
    if (!order.sku || !order.productName) continue;

    const key = order.productName.trim();
    if (!catalog[key]) {
      catalog[key] = {
        sku: order.sku,
        productName: key,
        prices: {},      // qty → [prices seen]
        qtyCounts: {},   // qty → count
      };
    }

    const entry = catalog[key];
    const q = order.qty;
    const p = order.subtotal;

    if (!entry.qtyCounts[q]) entry.qtyCounts[q] = 0;
    entry.qtyCounts[q]++;

    if (!entry.prices[q]) entry.prices[q] = [];
    entry.prices[q].push(p);
  }

  // Finalize: compute minQty and best price per qty
  const result = {};
  for (const [name, entry] of Object.entries(catalog)) {
    const qtys = Object.keys(entry.qtyCounts).map(Number).sort((a, b) => a - b);
    const minQty = qtys[0] || 1;

    // For each qty, use the most common price (mode)
    const finalPrices = {};
    for (const [q, prices] of Object.entries(entry.prices)) {
      const freq = {};
      for (const p of prices) {
        const rounded = Math.round(p);
        freq[rounded] = (freq[rounded] || 0) + 1;
      }
      const modePrice = parseInt(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
      finalPrices[parseInt(q)] = modePrice;
    }

    result[name] = {
      sku: entry.sku,
      productName: name,
      minQty,
      prices: finalPrices,
    };
  }

  console.log(`📚 Product catalog: ${Object.keys(result).length} products`);
  return result;
}

// ── Fuzzy match product name ──
function findProductInCatalog(missedProductName, catalog) {
  if (!missedProductName) return null;
  const clean = missedProductName.trim();

  // Exact match first
  if (catalog[clean]) return catalog[clean];

  // Case-insensitive
  const lower = clean.toLowerCase();
  if (catalog[lower]) return catalog[lower];

  // Substring match
  for (const [key, val] of Object.entries(catalog)) {
    if (typeof val !== "object" || !val.sku) continue;
    const k = key.toLowerCase();
    if (k.includes(lower) || lower.includes(k)) return val;
  }

  return null;
}

// ── Resolve missed orders using catalog ──
function resolveMissedOrders(missedOrders, catalog) {
  const resolved = [];
  const skipped = [];

  for (const order of missedOrders) {
    const match = findProductInCatalog(order.productName, catalog);
    if (!match) {
      skipped.push(order.productName);
      continue;
    }

    const qty = match.minQty;
    const price = match.prices[qty] || match.prices[Object.keys(match.prices)[0]];

    resolved.push({
      ...order,
      sku: match.sku,
      productName: match.productName,
      qty,
      subtotal: price,
      unitPrice: Math.round(price / qty),
    });
  }

  if (skipped.length > 0) {
    console.log(`⚠️ Missed orders skipped (no product match): ${[...new Set(skipped)].join(", ")}`);
  }

  return resolved;
}

// ── Merge + deduplicate ──
// Key = normPhone + "|" + productName  →  same phone with DIFFERENT product is NOT a dupe
function mergeAndDeduplicate(realOrders, resolvedMissed, taagerPhones) {
  const seen = new Set();
  const result = [];
  const stats = {
    realNew: 0, realDupe: 0, realInTaager: 0,
    missedNew: 0, missedDupe: 0, missedInTaager: 0,
  };

  for (const order of realOrders) {
    const key = order.normPhone + "|" + (order.productName || "").trim().toLowerCase();
    if (taagerPhones.has(key)) { stats.realInTaager++; continue; }
    if (seen.has(key)) { stats.realDupe++; continue; }
    seen.add(key);
    result.push(order);
    stats.realNew++;
  }

  for (const order of resolvedMissed) {
    const key = order.normPhone + "|" + (order.productName || "").trim().toLowerCase();
    if (taagerPhones.has(key)) { stats.missedInTaager++; continue; }
    if (seen.has(key)) { stats.missedDupe++; continue; }
    seen.add(key);
    result.push(order);
    stats.missedNew++;
  }

  console.log(`✅ New orders: real=${stats.realNew} missed=${stats.missedNew}`);
  console.log(`🚫 In Taager: real=${stats.realInTaager} missed=${stats.missedInTaager}`);
  console.log(`🔁 Dupes in batch: real=${stats.realDupe} missed=${stats.missedDupe}`);

  return { orders: result, stats };
}

module.exports = {
  parseKhodPhones,
  parseRealOrders,
  parseMissedOrders,
  buildProductCatalog,
  resolveMissedOrders,
  mergeAndDeduplicate,
};

// ── Parse Khod sheet → Set of normalized phones ──
//
// Khod export column map (0-indexed):
//   [3]  الهاتف  1  ← phone column we need for dedup
//
// We load ALL rows without date filtering — same approach as original
// parseTaagerPhones, just to build the dedup Set.
function parseKhodPhones(buffer) {
  const wb   = XLSX.read(buffer, { type: "buffer" });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const header = rows[0] || [];

  // Find phone column — look for "هاتف" but NOT "هاتف  2"
  let phoneColIdx = 3; // default: col[3] = "الهاتف  1"
  for (let i = 0; i < header.length; i++) {
    const h = String(header[i] || "");
    if (h.includes("هاتف") && !h.includes("2")) {
      phoneColIdx = i;
      break;
    }
  }

  // Find product column — "المنتجات" (col 15 by default)
  let productColIdx = 15;
  for (let i = 0; i < header.length; i++) {
    const h = String(header[i] || "");
    if (h.includes("المنتج")) {
      productColIdx = i;
      break;
    }
  }

  // Build composite Set: "normPhone|productName"
  // so same phone with a DIFFERENT product is NOT treated as already-in-Khod.
  const phones = new Set();
  for (let i = 1; i < rows.length; i++) {
    const norm = normalizePhone(rows[i][phoneColIdx]);
    if (!norm) continue;

    // Khod product format: "1x اسم المنتج-" → extract the name part
    const rawProduct = String(rows[i][productColIdx] || "").trim();
    const productMatch = rawProduct.match(/\d+x\s+(.+?)[\-\s]*$/);
    const productName = productMatch
      ? productMatch[1].trim().toLowerCase()
      : rawProduct.toLowerCase();

    phones.add(norm + "|" + productName);
  }

  console.log(`📋 Khod: ${phones.size} phone+product combos loaded (dedup list)`);
  return phones;
}