"use strict";

const XLSX = require("xlsx");
const { normalizePhone, normalizePhoneWithMeta } = require("./phone");

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

function normalizeProductName(name) {
  if (!name) return "";
  let s = name.toString().trim();
  s = s.replace(/^\d+x\s*/i, "");
  s = s.replace(/[-\s]+$/, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function productNamesMatch(nameA, nameB) {
  if (!nameA || !nameB) return false;
  const a = normalizeProductName(nameA).toLowerCase();
  const b = normalizeProductName(nameB).toLowerCase();
  if (a === b) return true;
  if (a.length >= 4 && b.includes(a)) return true;
  if (b.length >= 4 && a.includes(b)) return true;
  return false;
}

function splitCellLines(value) {
  const text = value == null ? "" : value.toString();
  return text
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseMoney(value) {
  return parseFloat((value || "0").toString().replace(/[^\d.]/g, "")) || 0;
}

function parseQty(value) {
  return parseInt((value || "1").toString().replace(/[^\d]/g, ""), 10) || 1;
}

function makeOrderKey(normPhone, sku) {
  const phone = normPhone ? normPhone.toString().trim() : "";
  const cleanSku = sku ? sku.toString().trim() : "";
  if (!phone || !cleanSku) return null;
  return `${phone}|${cleanSku}`;
}

function rowDateString(rawDate) {
  try {
    return parseExcelDate(rawDate)?.toISOString().slice(0, 10) || "";
  } catch (_) {
    return "";
  }
}

function findHeaderIndex(header, candidates, fallback) {
  for (const candidate of candidates) {
    const idx = header.findIndex((h) => String(h || "").trim() === candidate);
    if (idx !== -1) return idx;
  }

  for (const candidate of candidates) {
    const idx = header.findIndex((h) => String(h || "").includes(candidate));
    if (idx !== -1) return idx;
  }

  return fallback;
}

function detectPrepaidMethod(value) {
  const text = value == null ? "" : String(value).trim();
  if (!text) return "";
  const normalized = text
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");

  if (/tabby|tabi|تابي/.test(normalized)) return "tabby";
  if (/tamara|تمارا/.test(normalized)) return "tamara";
  if (/pay\s*mob|paymob|باي\s*موب/.test(normalized)) return "paymob";
  if (/شبكه|network/.test(normalized)) return "network";
  if (/mada|مدي|مدى|visa|فيزا|card|كارت|بطاق/.test(normalized)) return "card";
  if (/apple\s*pay|stc\s*pay|online|اونلاين|الكتروني|الكترونى|إلكتروني/.test(normalized)) return "online";
  return "";
}

function explodeRealOrderRow(row, phoneMeta) {
  const normPhone = phoneMeta.digits;
  const productNames = splitCellLines(row["Product Name"]);
  const skus = splitCellLines(row["SKU"]);
  const qtys = splitCellLines(row["Quantity"]);
  const prices = splitCellLines(row["Item Price"]);
  const itemCount = Math.max(productNames.length, skus.length, qtys.length, prices.length, 1);

  const rawDate = row["CreatedAt"];
  const rawCity = (row["City"] || row["Government"] || "").toString().trim();
  const base = {
    source: "real",
    normPhone,
    uncertain: phoneMeta.uncertain || false,
    rawPhone: row["Phone"],
    name: (row["FullName"] || "").toString().trim() || ("0" + normPhone),
    city: rawCity !== "" ? rawCity : null,
    region: "",
    address: (row["Address"] || "").toString().trim() || null,
    date: rowDateString(rawDate),
    // ── Analytics fields ──
    // NOTE: explodeRealOrderRow processes the Easy-Orders export (English headers).
    // The Khod affiliate sheet (Arabic headers) is parsed separately via parseKhodAnalyticsMap().
    // runner.js enriches these defaults using exact phone|sku match (update runs) or
    // SKU-level inference (first-run estimation).
    orderStatus:        "Under processing",               // default until Khod confirms
    amountDue:          parseMoney(row["Total Cost"] || "0"),  // Easy-Orders fallback
    marketerCommission: 0,                                // inferred from Khod SKU data
    khodOrderNumber:    "",                               // assigned after Khod submission
  };

  const bySku = new Map();
  for (let i = 0; i < itemCount; i++) {
    const productName = (productNames[i] || productNames[0] || "").trim();
    const sku = (skus[i] || skus[0] || "").trim();
    if (!productName || !sku) continue;

    const qty = parseQty(qtys[i] || qtys[0] || "1");
    const itemPrice = parseMoney(prices[i] || prices[0] || "0");
    const totalCost = parseMoney(row["Total Cost"]);
    const shippingCost = parseMoney(row["Shipping Cost"] || "28") || 28;
    const subtotal = itemPrice > 0 ? itemPrice * qty : Math.max(totalCost - shippingCost, 0);

    const existing = bySku.get(sku);
    if (existing) {
      existing.qty += qty;
      existing.subtotal += subtotal;
      existing.unitPrice = Math.round(existing.subtotal / existing.qty);
      if (!existing.productName.includes(productName)) {
        existing.productName = `${existing.productName} + ${productName}`;
      }
      continue;
    }

    bySku.set(sku, {
      ...base,
      sku,
      productName,
      qty,
      subtotal,
      unitPrice: itemPrice > 0 ? itemPrice : Math.round(subtotal / qty),
    });
  }

  return [...bySku.values()];
}

function parseRealOrders(buffer, dateFrom, dateTo) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  const orders = [];
  const skipped = { date: 0, phone: 0, status: 0, sku: 0 };
  let uncertainPhones = 0;

  for (const row of rows) {
    if (!matchesDateRange(row["CreatedAt"], dateFrom, dateTo)) { skipped.date++; continue; }

    const status = (row["Status"] || "").toString().toLowerCase();
    if (status === "cancelled" || status === "canceled") { skipped.status++; continue; }

    const phoneMeta = normalizePhoneWithMeta(row["Phone"]);
    if (!phoneMeta) { skipped.phone++; continue; }
    if (phoneMeta.uncertain) uncertainPhones++;

    const exploded = explodeRealOrderRow(row, phoneMeta);
    if (exploded.length === 0) { skipped.sku++; continue; }
    orders.push(...exploded);
  }

  console.log(`📦 Real orders: ${orders.length} valid items | skipped date:${skipped.date} phone:${skipped.phone} status:${skipped.status} sku:${skipped.sku}`);
  if (uncertainPhones > 0) console.log(`⚠️ Real orders uncertain phones rescued with trailing 0: ${uncertainPhones}`);
  return orders;
}

function stripProductBrackets(rawProducts) {
  const raw = (rawProducts || "").toString().trim();
  const bracketMatch = raw.match(/^\[([\s\S]*)\]$/);
  return bracketMatch ? bracketMatch[1].trim() : raw.replace(/^\[|\]$/g, "").trim();
}

function parseMissedOrders(buffer, dateFrom, dateTo) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  const orders = [];
  const skippedOrders = [];
  const skipped = { date: 0, phone: 0, completed: 0 };
  let uncertainPhones = 0;

  for (const row of rows) {
    const isCompleted = String(row["Is Completed"] || "").toLowerCase();
    if (isCompleted === "true" || isCompleted === "1") { skipped.completed++; continue; }

    if (!matchesDateRange(row["Created At"], dateFrom, dateTo)) { skipped.date++; continue; }

    const phoneMeta = normalizePhoneWithMeta(row["Phone"]);
    if (!phoneMeta) {
      skipped.phone++;
      const rawProducts = (row["Products"] || "").toString().trim();
      skippedOrders.push({
        name: (row["Full Name"] || "").toString().trim(),
        rawPhone: (row["Phone"] || "").toString().trim(),
        productName: stripProductBrackets(rawProducts) || rawProducts,
        city: (row["Government"] || row["City"] || "").toString().trim(),
        address: (row["Address"] || "").toString().trim(),
        reason: "phone_parse_failed",
      });
      continue;
    }
    if (phoneMeta.uncertain) uncertainPhones++;
    const normPhone = phoneMeta.digits;

    const rawCity = (row["Government"] || row["City"] || "").toString().trim();
    const rawProducts = (row["Products"] || "").toString().trim();
    orders.push({
      source: "missed",
      normPhone,
      uncertain: phoneMeta.uncertain || false,
      rawPhone: row["Phone"],
      name: (row["Full Name"] || "").toString().trim() || ("0" + normPhone),
      city: rawCity !== "" ? rawCity : null,
      region: "",
      address: (row["Address"] || "").toString().trim() || null,
      date: rowDateString(row["Created At"]),
      rawProducts,
      productName: stripProductBrackets(rawProducts),
      sku: null,
      qty: null,
      subtotal: null,
      unitPrice: null,
      // Analytics defaults (missed orders have no Khod sheet data)
      orderStatus:        "missed",
      amountDue:          0,
      marketerCommission: 0,
      khodOrderNumber:    "",
    });
  }

  console.log(`📦 Missed orders: ${orders.length} valid rows | skipped date:${skipped.date} phone:${skipped.phone} completed:${skipped.completed}`);
  if (uncertainPhones > 0) console.log(`⚠️ Missed orders uncertain phones rescued with trailing 0: ${uncertainPhones}`);
  if (skippedOrders.length > 0) console.log(`Phone-parse failures (will appear in Couldn't Process): ${skippedOrders.length}`);
  return { orders, skippedOrders };
}

function modeNumber(values) {
  const freq = {};
  for (const value of values) {
    const rounded = Math.round(value);
    freq[rounded] = (freq[rounded] || 0) + 1;
  }
  return parseInt(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0], 10);
}

function buildProductCatalog(realOrders) {
  const byName = {};
  const bySku = {};

  for (const order of realOrders) {
    if (!order.sku || !order.productName) continue;

    const name = order.productName.trim();
    if (!byName[name]) {
      byName[name] = { sku: order.sku, productName: name, prices: {}, qtyCounts: {} };
    }

    const entry = byName[name];
    const q = order.qty || 1;
    const p = order.subtotal || 0;
    entry.qtyCounts[q] = (entry.qtyCounts[q] || 0) + 1;
    if (!entry.prices[q]) entry.prices[q] = [];
    entry.prices[q].push(p);

    if (!bySku[order.sku]) bySku[order.sku] = { sku: order.sku, names: new Set(), count: 0 };
    bySku[order.sku].names.add(name);
    bySku[order.sku].count++;
  }

  const result = {};
  for (const [name, entry] of Object.entries(byName)) {
    const qtys = Object.keys(entry.qtyCounts).map(Number).sort((a, b) => a - b);
    const minQty = qtys[0] || 1;
    const finalPrices = {};
    for (const [q, prices] of Object.entries(entry.prices)) {
      finalPrices[parseInt(q, 10)] = modeNumber(prices);
    }
    result[name] = { sku: entry.sku, productName: name, minQty, prices: finalPrices };
  }

  Object.defineProperty(result, "__skuIndex", {
    value: Object.fromEntries(Object.entries(bySku).map(([sku, info]) => [
      sku,
      { sku, names: [...info.names], count: info.count },
    ])),
    enumerable: false,
  });

  console.log(`📚 Product catalog: ${Object.keys(result).length} products | ${Object.keys(result.__skuIndex).length} SKUs`);
  return result;
}

function findProductInCatalog(productName, catalog) {
  if (!productName) return null;
  const clean = productName.trim();
  if (catalog[clean]) return catalog[clean];

  const lower = clean.toLowerCase();
  for (const [key, val] of Object.entries(catalog)) {
    if (!val || !val.sku) continue;
    const k = key.toLowerCase();
    if (k === lower) return val;
    if (k.includes(lower) || lower.includes(k)) return val;
  }
  return null;
}

function parseMissedProductNamesFromCatalog(rawProducts, catalog) {
  const source = stripProductBrackets(rawProducts);
  if (!source) return [];

  const matches = [];
  const names = Object.keys(catalog).sort((a, b) => b.length - a.length);
  let masked = source;

  for (const name of names) {
    if (!name) continue;
    let index = masked.indexOf(name);
    while (index !== -1) {
      matches.push({ name, index, length: name.length });
      masked = masked.slice(0, index) + " ".repeat(name.length) + masked.slice(index + name.length);
      index = masked.indexOf(name);
    }
  }

  if (matches.length > 0) {
    return matches
      .sort((a, b) => a.index - b.index)
      .map((match) => match.name);
  }

  const direct = findProductInCatalog(source, catalog);
  return direct ? [direct.productName] : [];
}

function resolveMissedOrders(missedOrders, catalog) {
  const resolved = [];
  const skipped = [];
  const skippedOrders = [];

  for (const order of missedOrders) {
    const productNames = parseMissedProductNamesFromCatalog(order.rawProducts || order.productName, catalog);
    if (productNames.length === 0) {
      skipped.push(order.productName || order.rawProducts);
      skippedOrders.push({
        name: order.name,
        rawPhone: order.rawPhone,
        productName: order.productName || order.rawProducts,
        city: order.city,
        address: order.address,
        reason: "product_not_in_catalog",
        uncertain: order.uncertain || false,
      });
      continue;
    }

    const bySku = new Map();
    for (const productName of productNames) {
      const match = findProductInCatalog(productName, catalog);
      if (!match) {
        skipped.push(productName);
        skippedOrders.push({
          name: order.name,
          rawPhone: order.rawPhone,
          productName,
          city: order.city,
          address: order.address,
          reason: "product_not_in_catalog",
          uncertain: order.uncertain || false,
        });
        continue;
      }

      const qty = match.minQty || 1;
      const price = match.prices[qty] || match.prices[Object.keys(match.prices)[0]] || 0;
      const existing = bySku.get(match.sku);
      if (existing) {
        existing.qty += qty;
        existing.subtotal += price;
        existing.unitPrice = Math.round(existing.subtotal / existing.qty);
        continue;
      }

      bySku.set(match.sku, {
        ...order,
        sku: match.sku,
        productName: match.productName,
        qty,
        subtotal: price,
        unitPrice: Math.round(price / qty),
      });
    }

    resolved.push(...bySku.values());
  }

  if (skipped.length > 0) {
    console.log(`⚠️ Missed orders skipped (no live catalog match): ${[...new Set(skipped)].join(", ")}`);
  }

  console.log(`📦 Missed orders resolved: ${resolved.length} SKU-backed items`);
  return { resolved, skippedOrders };
}

function parseKhodOrderKeys(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const header = rows[0] || [];

  const phoneColIdx = findHeaderIndex(header, ["الهاتف  1", "الهاتف 1", "الهاتف"], 3);
  const skuColIdx = findHeaderIndex(header, ["sku_code", "SKU", "Sku", "كود_المنتج"], 17);

  const keys = new Set();
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const normPhone = normalizePhone(rows[i][phoneColIdx]);
    const sku = (rows[i][skuColIdx] || "").toString().trim();
    const key = makeOrderKey(normPhone, sku);
    if (key) keys.add(key);
    else skipped++;
  }

  console.log(`📋 Khod: ${keys.size} phone+SKU keys loaded | skipped:${skipped}`);
  return keys;
}

function parseKhodPhones(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const header = rows[0] || [];
  const phoneColIdx = findHeaderIndex(header, ["الهاتف  1", "الهاتف 1", "الهاتف"], 3);

  const phones = new Set();
  for (let i = 1; i < rows.length; i++) {
    const normPhone = normalizePhone(rows[i][phoneColIdx]);
    if (normPhone) phones.add(normPhone);
  }

  console.log(`📋 Khod: ${phones.size} phones loaded`);
  return phones;
}

function isInKhod(orderOrPhone, khodOrderKeys, sku) {
  const key = typeof orderOrPhone === "object"
    ? makeOrderKey(orderOrPhone.normPhone, orderOrPhone.sku)
    : makeOrderKey(orderOrPhone, sku);
  return key ? khodOrderKeys.has(key) : false;
}

function mergeAndDeduplicate(realOrders, resolvedMissed, khodOrderKeys) {
  const seen = new Set();
  const result = [];
  const stats = {
    realNew: 0, realDupe: 0, realInKhod: 0, realMissingSku: 0,
    missedNew: 0, missedDupe: 0, missedInKhod: 0, missedMissingSku: 0,
  };

  function accept(order, source) {
    const key = makeOrderKey(order.normPhone, order.sku);
    if (!key) { stats[`${source}MissingSku`]++; return; }
    if (khodOrderKeys.has(key)) { stats[`${source}InKhod`]++; return; }
    if (seen.has(key)) { stats[`${source}Dupe`]++; return; }

    seen.add(key);
    result.push(order);
    stats[`${source}New`]++;
  }

  for (const order of realOrders) accept(order, "real");
  for (const order of resolvedMissed) accept(order, "missed");

  console.log(`✅ New orders: real=${stats.realNew} missed=${stats.missedNew}`);
  console.log(`🚫 Already in Khod (phone+SKU): real=${stats.realInKhod} missed=${stats.missedInKhod}`);
  console.log(`🔁 Dupes in this batch (phone+SKU): real=${stats.realDupe} missed=${stats.missedDupe}`);
  console.log(`⚠️ Missing SKU keys: real=${stats.realMissingSku} missed=${stats.missedMissingSku}`);

  return { orders: result, stats };
}

// ════════════════════════════════════════════════════════════════
// KHOD ANALYTICS MAP
// Reads the Khod affiliate sheet (Arabic headers, from khodBuffer)
// Returns:
//   byPhoneSku  Map<"normPhone|sku", {orderStatus, amountDue, marketerCommission, khodOrderNumber}>
//   skuDefaults Object<sku, {amountDue, marketerCommission}>  ← mode/avg for first-run inference
// ════════════════════════════════════════════════════════════════
function parseKhodAnalyticsMap(buffer) {
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!rows || rows.length < 2) {
      console.log("📊 Khod analytics map: empty sheet");
      return { byPhoneSku: new Map(), skuDefaults: {} };
    }

    const header = rows[0] || [];

    // ── Column discovery with fallbacks ──
    const phoneIdx  = findHeaderIndex(header, ["الهاتف  1", "الهاتف 1", "الهاتف"], 3);
    const skuIdx    = findHeaderIndex(header, ["sku_code", "SKU", "Sku", "كود_المنتج"], 17);
    const orderIdx  = findHeaderIndex(header, ["رقم الاوردر", "رقم الطلب", "Order Number"], 1);
    const statusIdx = findHeaderIndex(header, ["حالة الأوردر", "حاله الاوردر", "الحالة", "حالة"], 5);
    const amountIdx = findHeaderIndex(header, ["المطلوب تحصيله", "مبلغ التحصيل", "المبلغ المطلوب"], 25);
    const commIdx   = findHeaderIndex(header, ["عمولة المسوق", "عمولة المسوّق", "العمولة"], 27);

    const byPhoneSku = new Map();
    const skuSamples = {}; // sku → [{amountDue, marketerCommission}]

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.length) continue;

      const sku = (row[skuIdx] || "").toString().trim();
      if (!sku) continue;

      const rawAmount = (row[amountIdx] || "0").toString();
      const rawComm   = (row[commIdx]   || "0").toString();
      const amountDue          = parseFloat(rawAmount.replace(/[^\d.]/g, "")) || 0;
      const marketerCommission = parseFloat(rawComm.replace(/[^\d.]/g, ""))   || 0;

      // Always collect SKU samples for inference (even without a valid phone)
      if (!skuSamples[sku]) skuSamples[sku] = [];
      if (amountDue > 0 || marketerCommission > 0) {
        skuSamples[sku].push({ amountDue, marketerCommission });
      }

      const normPhone = normalizePhone(row[phoneIdx]);
      if (!normPhone) continue;

      byPhoneSku.set(`${normPhone}|${sku}`, {
        orderStatus:        (row[statusIdx] || "").toString().trim(),
        amountDue,
        marketerCommission,
        khodOrderNumber:    row[orderIdx] ? String(row[orderIdx]).trim() : "",
      });
    }

    // ── Build SKU defaults using mode for amountDue, mean for commission ──
    const skuDefaults = {};
    for (const [sku, samples] of Object.entries(skuSamples)) {
      if (!samples.length) continue;

      // Mode of amountDue
      const freqMap = {};
      let maxFreq = 0;
      let modeAmt = samples[0].amountDue;
      for (const { amountDue } of samples) {
        if (!amountDue) continue;
        freqMap[amountDue] = (freqMap[amountDue] || 0) + 1;
        if (freqMap[amountDue] > maxFreq) { maxFreq = freqMap[amountDue]; modeAmt = amountDue; }
      }

      // Mean of commission
      const comms = samples.map(s => s.marketerCommission).filter(c => c > 0);
      const meanComm = comms.length
        ? Math.round(comms.reduce((a, b) => a + b, 0) / comms.length)
        : 0;

      skuDefaults[sku] = { amountDue: modeAmt || 0, marketerCommission: meanComm };
    }

    console.log(`📊 Khod analytics map: ${byPhoneSku.size} phone+SKU pairs | ${Object.keys(skuDefaults).length} SKU templates`);
    return { byPhoneSku, skuDefaults };

  } catch (err) {
    console.error("[Analytics] parseKhodAnalyticsMap error:", err.message);
    return { byPhoneSku: new Map(), skuDefaults: {} };
  }
}

// ════════════════════════════════════════════════════════════════
// FULL MONTH SNAPSHOT — for Dashboard Infrastructure (STEP 2)
// Reads ALL rows from the Khod affiliate sheet (including Cancelled).
// Date range: selected dashboard range, falling back to current month.
// Read-only: no phone normalization, no SKU matching, no dedup.
// Returns flat array of row objects for dashboardStore.
// ════════════════════════════════════════════════════════════════
function parseFullMonthSnapshot(buffer, options = {}) {
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!rows || rows.length < 2) {
      console.log("[Dashboard] parseFullMonthSnapshot: empty sheet");
      return [];
    }

    const header = rows[0] || [];

    // ── Column discovery — same robust helper used elsewhere ──
    const orderNumIdx  = findHeaderIndex(header, ["رقم الاوردر", "رقم الطلب", "Order Number"], 1);
    const nameIdx      = findHeaderIndex(header, ["اسم المستلم", "الاسم", "FullName"], 2);
    const phone1Idx    = findHeaderIndex(header, ["الهاتف  1", "الهاتف 1", "الهاتف"], 3);
    const phone2Idx    = findHeaderIndex(header, ["الهاتف  2", "الهاتف 2"], 4);
    const statusIdx    = findHeaderIndex(header, ["حالة الأوردر", "حاله الاوردر", "الحالة", "حالة"], 5);
    const orderValIdx  = findHeaderIndex(header, ["قيمة الاوردر", "قيمة الطلب"], 6);
    const commIdx      = findHeaderIndex(header, ["العمولة", "Commission"], 7);
    const cityIdx      = findHeaderIndex(header, ["المدينة", "City"], 8);
    const regionIdx    = findHeaderIndex(header, ["المنطقة", "Region"], 9);
    const addressIdx   = findHeaderIndex(header, ["العنوان", "Address"], 10);
    const dataEntryIdx = findHeaderIndex(header, ["داتا انتري", "Data Entry"], 11);
    const qtyIdx       = findHeaderIndex(header, ["عدد القطع", "Qty"], 15);
    const productsIdx  = findHeaderIndex(header, ["المنتجات", "Products"], 16);
    const skuIdx       = findHeaderIndex(header, ["sku_code", "SKU", "Sku", "كود_المنتج"], 17);
    const priceNoShipIdx = findHeaderIndex(header, ["السعر الكلي بدون الشحن"], 18);
    const shippingIdx  = findHeaderIndex(header, ["سعر الشحن"], 19);
    const totalPriceIdx= findHeaderIndex(header, ["السعر الكلي بالشحن"], 20);
    const createdAtIdx = findHeaderIndex(header, ["تاريخ الإنشاء", "تاريخ الانشاء", "Created At"], 21);
    const confirmedIdx = findHeaderIndex(header, ["تاريخ التأكيد", "Confirmed At"], 22);
    const shippedIdx   = findHeaderIndex(header, ["تاريخ الشحن", "Shipped At"], 23);
    const updatedIdx   = findHeaderIndex(header, ["تاريخ أخر تحديث", "آخر تحديث", "Last Updated"], 24);
    const amountDueIdx = findHeaderIndex(header, ["المطلوب تحصيله", "مبلغ التحصيل", "المبلغ المطلوب"], 25);
    const collectedIdx = findHeaderIndex(header, ["المحصل", "Collected"], 26);
    const mktCommIdx   = findHeaderIndex(header, ["عمولة المسوق", "عمولة المسوّق"], 27);
    const orderTypeIdx = findHeaderIndex(header, ["نوع الاوردر", "Order Type"], 28);
    const notesIdx     = findHeaderIndex(header, ["الملاحظات", "Notes"], 30);

    // ── Date range: selected range, matching the Khod list filter/count ──
    // Khod's "all orders" counter follows the order creation date selected in
    // the page filters. Keep dashboard totals on the same basis so the UI count
    // matches the source screen exactly after each fetch.
    const now = new Date();
    const parseRangeDate = (value) => {
      if (!value) return null;
      if (value instanceof Date && !isNaN(value.getTime())) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
      }
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split("-").map(Number);
        return new Date(y, m - 1, d);
      }
      return null;
    };
    const rangeStart = parseRangeDate(options.dateFrom) || new Date(now.getFullYear(), now.getMonth(), 1);
    const rangeEnd = parseRangeDate(options.dateTo) || new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const localDateKey = (date) => {
      if (!date || isNaN(date.getTime())) return "";
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };
    const rangeFromKey = localDateKey(rangeStart);
    const rangeToKey = localDateKey(rangeEnd);
    const sameMonthRange = rangeFromKey.slice(0, 7) === rangeToKey.slice(0, 7);
    const dateKeyFromRaw = (value) => {
      const parsed = parseExcelDate(value);
      return parsed ? localDateKey(parsed) : "";
    };
    const isKeyInRange = (key) => !!key && key >= rangeFromKey && key <= rangeToKey;
    const dashboardDateForRow = (createdRaw, updatedRaw) => {
      const createdKey = dateKeyFromRaw(createdRaw);
      if (isKeyInRange(createdKey)) return createdKey;
      const updatedKey = dateKeyFromRaw(updatedRaw);
      if (isKeyInRange(updatedKey)) return updatedKey;
      return rangeFromKey || createdKey || updatedKey || "";
    };

    const lookupSafeStr = (v) => v != null ? String(v).trim() : "";
    const lookupSafeNum = (v) => parseFloat((v || "0").toString().replace(/[^\d.]/g, "")) || 0;
    const amountSamples = {};
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.length) continue;
      const sku = lookupSafeStr(row[skuIdx]);
      const qty = parseInt(lookupSafeStr(row[qtyIdx]) || "1", 10) || 1;
      const amount = lookupSafeNum(row[amountDueIdx]);
      if (!sku || amount <= 0) continue;
      const key = `${sku}|${qty}`;
      if (!amountSamples[key]) amountSamples[key] = [];
      amountSamples[key].push(amount);
    }
    const amountDueLookup = {};
    Object.entries(amountSamples).forEach(([key, samples]) => {
      const freq = {};
      let amount = samples[0];
      let modeCount = 0;
      samples.forEach((sample) => {
        const k = String(sample);
        freq[k] = (freq[k] || 0) + 1;
        if (freq[k] > modeCount) {
          amount = sample;
          modeCount = freq[k];
        }
      });
      amountDueLookup[key] = {
        amount,
        referenceCount: samples.length,
        modeCount,
        distinctAmountCount: Object.keys(freq).length
      };
    });

    const result = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.length) continue;

      const safeStr  = (v) => v != null ? String(v).trim() : "";
      const safeNum  = (v) => parseFloat((v || "0").toString().replace(/[^\d.]/g, "")) || 0;
      const notes = safeStr(row[notesIdx]);
      const paymentMethod = detectPrepaidMethod(notes);
      const amountDueRaw = safeStr(row[amountDueIdx]);
      const rowQty = parseInt(safeStr(row[qtyIdx]) || "1", 10) || 1;
      const rowSku = safeStr(row[skuIdx]);
      const rowAmountLookup = amountDueLookup[`${rowSku}|${rowQty}`] || null;
      const safeDate = (v) => {
        const d = parseExcelDate(v);
        return d ? localDateKey(d) : null;
      };
      const dashboardDate = dashboardDateForRow(row[createdAtIdx], row[updatedIdx]);

      result.push({
        khodOrderNumber:    safeStr(row[orderNumIdx]),
        name:               safeStr(row[nameIdx]),
        phone1:             safeStr(row[phone1Idx]),
        phone2:             safeStr(row[phone2Idx]),
        orderStatus:        safeStr(row[statusIdx]),
        orderValue:         safeNum(row[orderValIdx]),
        commission:         safeNum(row[commIdx]),
        city:               safeStr(row[cityIdx]),
        region:             safeStr(row[regionIdx]),
        address:            safeStr(row[addressIdx]),
        dataEntry:          safeStr(row[dataEntryIdx]),
        qty:                rowQty,
        products:           safeStr(row[productsIdx]),
        sku:                rowSku,
        priceNoShipping:    safeNum(row[priceNoShipIdx]),
        shippingCost:       safeNum(row[shippingIdx]),
        totalPrice:         safeNum(row[totalPriceIdx]),
        createdAt:          safeDate(row[createdAtIdx]),
        confirmedAt:        safeDate(row[confirmedIdx]),
        shippedAt:          safeDate(row[shippedIdx]),
        lastUpdatedAt:      safeDate(row[updatedIdx]),
        amountDue:          safeNum(row[amountDueIdx]),
        amountDueRaw:       amountDueRaw,
        amountDueMissing:   amountDueRaw === "",
        amountDueLookup:    rowAmountLookup,
        collected:          safeNum(row[collectedIdx]),
        marketerCommission: safeNum(row[mktCommIdx]),
        orderType:          safeStr(row[orderTypeIdx]),
        notes:              notes,
        paymentMethod:      paymentMethod,
        isPrepaid:          !!paymentMethod,
        dashboardDate:       dashboardDate,
        dashboardBucketMonth: sameMonthRange ? rangeFromKey.slice(0, 7) : dashboardDate.slice(0, 7),
        dashboardRangeFrom:  rangeFromKey,
        dashboardRangeTo:    rangeToKey,
      });
    }

    const rangeLabel = `${rangeFromKey}..${rangeToKey}`;
    console.log(`[Dashboard] parseFullMonthSnapshot: ${result.length} rows for ${rangeLabel}`);
    return result;

  } catch (err) {
    console.error("[Dashboard] parseFullMonthSnapshot error:", err.message);
    return [];
  }
}

function loadProductMap() {
  return {};
}

function saveProductMap() {}

function learnProductMappings() {
  console.log("ℹ️ Product map learning skipped: live SKU catalog is used for dedupe.");
  return {};
}

function lookupEoNameInMap() {
  return null;
}

module.exports = {
  parseKhodPhones,
  parseKhodOrderKeys,
  parseKhodAnalyticsMap,
  parseRealOrders,
  parseMissedOrders,
  buildProductCatalog,
  resolveMissedOrders,
  mergeAndDeduplicate,
  normalizeProductName,
  productNamesMatch,
  makeOrderKey,
  splitCellLines,
  explodeRealOrderRow,
  parseMissedProductNamesFromCatalog,
  isInKhod,
  loadProductMap,
  saveProductMap,
  learnProductMappings,
  lookupEoNameInMap,
  parseFullMonthSnapshot,
  detectPrepaidMethod,
};
