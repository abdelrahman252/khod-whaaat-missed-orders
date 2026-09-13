"use strict";

const XLSX = require("xlsx");
const { normalizePhone, normalizePhoneCandidatesWithMeta } = require("./phone");
const { matchCityLabel } = require("./city-fallback");
const { sanitizeCustomerFields, assessCustomerOrder } = require("./customer-quality");
const { buildGroupedCartOrders, mergeItemList } = require("./cart-order-groups");

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
  let s = name
    .toString()
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[\u00A0\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .trim();
  s = s.replace(/^\d+x\s*/i, "");
  s = s.replace(/[â€â€‘â€’â€“â€”â€•]+/g, "-");
  s = s.replace(/[-\s]+$/, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function productLookupKey(name) {
  return normalizeProductName(name)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[.,ØŒ:;Ø›"'`Â´()[\]{}<>|\\/!ØŸ?_*~]+/g, "")
    .replace(/[Ø£Ø¥Ø¢Ù±]/g, "Ø§")
    .replace(/Ù‰/g, "ÙŠ")
    .replace(/Ø©/g, "Ù‡");
}

function productNamesMatch(nameA, nameB) {
  if (!nameA || !nameB) return false;
  const a = normalizeProductName(nameA).toLowerCase();
  const b = normalizeProductName(nameB).toLowerCase();
  const keyA = productLookupKey(nameA);
  const keyB = productLookupKey(nameB);
  if (a === b) return true;
  if (keyA && keyA === keyB) return true;
  if (a.length >= 4 && b.includes(a)) return true;
  if (b.length >= 4 && a.includes(b)) return true;
  if (keyA.length >= 4 && keyB.includes(keyA)) return true;
  if (keyB.length >= 4 && keyA.includes(keyB)) return true;
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

function rowDateTimeString(rawDate) {
  try {
    const d = parseExcelDate(rawDate);
    if (!d || isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
    .replace(/[Ø£Ø¥Ø¢]/g, "Ø§")
    .replace(/Ù‰/g, "ÙŠ")
    .replace(/Ø©/g, "Ù‡")
    .replace(/\s+/g, " ");

  if (/tabby|tabi|ØªØ§Ø¨ÙŠ/.test(normalized)) return "tabby";
  if (/tamara|ØªÙ…Ø§Ø±Ø§/.test(normalized)) return "tamara";
  if (/pay\s*mob|paymob|Ø¨Ø§ÙŠ\s*Ù…ÙˆØ¨/.test(normalized)) return "paymob";
  if (/Ø´Ø¨ÙƒÙ‡|network/.test(normalized)) return "network";
  if (/mada|Ù…Ø¯ÙŠ|Ù…Ø¯Ù‰|visa|ÙÙŠØ²Ø§|card|ÙƒØ§Ø±Øª|Ø¨Ø·Ø§Ù‚/.test(normalized)) return "card";
  if (/apple\s*pay|stc\s*pay|online|Ø§ÙˆÙ†Ù„Ø§ÙŠÙ†|Ø§Ù„ÙƒØªØ±ÙˆÙ†ÙŠ|Ø§Ù„ÙƒØªØ±ÙˆÙ†Ù‰|Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ/.test(normalized)) return "online";
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
    orderId: String(row["Order ID"] || row["ID"] || row["External Order ID"] || "").trim(),
    normPhone,
    uncertain: phoneMeta.uncertain || false,
    phoneAmbiguous: !!phoneMeta.phoneAmbiguous,
    phoneAmbiguityGroupId: phoneMeta.phoneAmbiguityGroupId || "",
    phoneCandidateIndex: phoneMeta.phoneCandidateIndex || 1,
    phoneCandidateCount: phoneMeta.phoneCandidateCount || 1,
    phoneCorrection: phoneMeta.correction || "",
    rawPhone: row["Phone"],
    name: (row["FullName"] || "").toString().trim() || ("0" + normPhone),
    city: rawCity !== "" ? rawCity : null,
    region: "",
    address: (row["Address"] || "").toString().trim() || null,
    date: rowDateString(rawDate),
    createdAt: rowDateTimeString(rawDate),
    // â”€â”€ Analytics fields â”€â”€
    // NOTE: explodeRealOrderRow processes the Easy-Orders export (English headers).
    // The KHOD WHAAT affiliate sheet (Arabic headers) is parsed separately via parseKhodAnalyticsMap().
    // runner.js enriches these defaults using exact phone|sku match (update runs) or
    // SKU-level inference (first-run estimation).
    orderStatus:        "Under processing",               // default until KHOD WHAAT confirms
    amountDue:          parseMoney(row["Total Cost"] || "0"),  // Easy-Orders fallback
    marketerCommission: 0,                                // inferred from KHOD WHAAT SKU data
    khodOrderNumber:    "",                               // assigned after KHOD WHAAT submission
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

function applyCustomerIdentityReview(order) {
  const assessment = assessCustomerOrder(order);
  if (!assessment.ok) {
    order.manualReview = true;
    order.uncertain = true;
    order.reason = "invalid_customer_data";
    order.actionMessage = assessment.message || "Customer data needs correction before upload.";
    order.customerQuality = {
      ...(order.customerQuality || {}),
      identity: assessment,
    };
    if (order.rawCustomerName) order.name = order.rawCustomerName;
  }
  return order;
}

function parseRealOrders(buffer, dateFrom, dateTo, country = "sa") {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  const orders = [];
  const skipped = { date: 0, phone: 0, status: 0, sku: 0 };
  let uncertainPhones = 0;

  let ambiguousPhones = 0;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!matchesDateRange(row["CreatedAt"], dateFrom, dateTo)) { skipped.date++; continue; }

    const status = (row["Status"] || "").toString().toLowerCase();
    if (status === "cancelled" || status === "canceled") { skipped.status++; continue; }

    const phoneMetas = normalizePhoneCandidatesWithMeta(row["Phone"], country);
    if (!phoneMetas.length) {
      skipped.phone++;
      const reviewItems = explodeRealOrderRow(row, { digits: "", uncertain: true, correction: "phone_parse_failed" });
      const rowsForReview = reviewItems.length ? reviewItems : [{
        source: "real",
        orderId: String(row["Order ID"] || row["ID"] || row["External Order ID"] || "").trim(),
        rawPhone: row["Phone"],
        name: String(row["FullName"] || "").trim(),
        sku: String(row["SKU"] || "").trim(),
        productName: String(row["Product Name"] || "").trim(),
        qty: parseQty(row["Quantity"]),
        subtotal: parseMoney(row["Total Cost"]),
        city: String(row["City"] || row["Government"] || "").trim(),
        address: String(row["Address"] || "").trim(),
      }];
      rowsForReview.forEach((order) => {
        const reviewed = applyCustomerIdentityReview(sanitizeCustomerFields({
          ...order,
          manualReview: true,
          uncertain: true,
        }, { country }));
        reviewed.manualReview = true;
        reviewed.uncertain = true;
        reviewed.reason = "phone_parse_failed";
        reviewed.actionMessage = "Phone could not be normalized automatically. Correct it before upload.";
        orders.push(reviewed);
      });
      continue;
    }
    if (phoneMetas.some((meta) => meta.uncertain)) uncertainPhones++;
    if (phoneMetas.length > 1) ambiguousPhones++;

    const groupId = phoneMetas.length > 1 ? `real-${rowIndex + 2}` : "";
    let explodedCount = 0;
    phoneMetas.forEach((phoneMeta, candidateIndex) => {
      const exploded = explodeRealOrderRow(row, {
        ...phoneMeta,
        phoneAmbiguous: phoneMetas.length > 1,
        phoneAmbiguityGroupId: groupId,
        phoneCandidateIndex: candidateIndex + 1,
        phoneCandidateCount: phoneMetas.length,
      });
      explodedCount += exploded.length;
      orders.push(...exploded.map((order) => applyCustomerIdentityReview(
        sanitizeCustomerFields(order, { country })
      )));
    });
    if (explodedCount === 0) skipped.sku++;
  }

  console.log(`ðŸ“¦ Real orders: ${orders.length} valid items | skipped date:${skipped.date} phone:${skipped.phone} status:${skipped.status} sku:${skipped.sku}`);
  if (uncertainPhones > 0) console.log(`âš ï¸ Real orders uncertain phones rescued with trailing 0: ${uncertainPhones}`);
  if (ambiguousPhones > 0) console.log(`âš ï¸ Real orders expanded from ambiguous phones: ${ambiguousPhones}`);
  return orders;
}

function stripProductBrackets(rawProducts) {
  const raw = (rawProducts || "").toString().trim();
  const bracketMatch = raw.match(/^\[([\s\S]*)\]$/);
  return bracketMatch ? bracketMatch[1].trim() : raw.replace(/^\[|\]$/g, "").trim();
}

function parseMissedOrders(buffer, dateFrom, dateTo, country = "sa") {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  const orders = [];
  const skippedOrders = [];
  const skipped = { date: 0, phone: 0, completed: 0 };
  let uncertainPhones = 0;

  let ambiguousPhones = 0;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const isCompleted = String(row["Is Completed"] || "").toLowerCase();
    if (isCompleted === "true" || isCompleted === "1") { skipped.completed++; continue; }

    if (!matchesDateRange(row["Created At"], dateFrom, dateTo)) { skipped.date++; continue; }

    const phoneMetas = normalizePhoneCandidatesWithMeta(row["Phone"], country);
    if (!phoneMetas.length) {
      skipped.phone++;
      const rawProducts = (row["Products"] || "").toString().trim();
      skippedOrders.push({
        name: (row["Full Name"] || "").toString().trim(),
        rawPhone: (row["Phone"] || "").toString().trim(),
        normalizedPhone: "",
        sku: "",
        productName: stripProductBrackets(rawProducts) || rawProducts,
        city: (row["Government"] || row["City"] || "").toString().trim(),
        address: (row["Address"] || "").toString().trim(),
        reason: "phone_parse_failed",
        actionMessage: "Phone could not be normalized automatically. Correct it before upload.",
        manualReview: true,
        uncertain: true,
      });
      continue;
    }
    const rawCity = (row["Government"] || row["City"] || "").toString().trim();
    const rawProducts = (row["Products"] || "").toString().trim();
    if (phoneMetas.some((meta) => meta.uncertain)) uncertainPhones++;
    if (phoneMetas.length > 1) ambiguousPhones++;
    const groupId = phoneMetas.length > 1 ? `missed-${rowIndex + 2}` : "";

    phoneMetas.forEach((phoneMeta, candidateIndex) => {
      const normPhone = phoneMeta.digits;
      orders.push(applyCustomerIdentityReview(sanitizeCustomerFields({
        source: "missed",
        normPhone,
        uncertain: phoneMeta.uncertain || false,
        phoneAmbiguous: phoneMetas.length > 1,
        phoneAmbiguityGroupId: groupId,
        phoneCandidateIndex: candidateIndex + 1,
        phoneCandidateCount: phoneMetas.length,
        phoneCorrection: phoneMeta.correction || "",
        rawPhone: row["Phone"],
        name: (row["Full Name"] || "").toString().trim() || ("0" + normPhone),
        city: rawCity !== "" ? rawCity : null,
        region: "",
        address: (row["Address"] || "").toString().trim() || null,
        date: rowDateString(row["Created At"]),
        createdAt: rowDateTimeString(row["Created At"]),
        rawProducts,
        productName: stripProductBrackets(rawProducts),
        sku: null,
        qty: null,
        subtotal: null,
        unitPrice: null,
        // Analytics defaults (missed source is origin, not a KHOD WHAAT lifecycle status)
        orderStatus:        "Under processing",
        amountDue:          0,
        marketerCommission: 0,
        khodOrderNumber:    "",
      }, { country })));
    });
  }

  console.log(`ðŸ“¦ Missed orders: ${orders.length} valid rows | skipped date:${skipped.date} phone:${skipped.phone} completed:${skipped.completed}`);
  if (uncertainPhones > 0) console.log(`âš ï¸ Missed orders uncertain phones rescued with trailing 0: ${uncertainPhones}`);
  if (ambiguousPhones > 0) console.log(`âš ï¸ Missed orders expanded from ambiguous phones: ${ambiguousPhones}`);
  if (skippedOrders.length > 0) console.log(`Phone-parse failures (will appear in Couldn't Process): ${skippedOrders.length}`);
  return { orders, skippedOrders };
}

function modeNumber(values) {
  const freq = {};
  for (const value of Array.isArray(values) ? values : []) {
    if (!Number.isFinite(Number(value))) continue;
    const rounded = Math.round(value);
    freq[rounded] = (freq[rounded] || 0) + 1;
  }
  const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return entries.length ? parseInt(entries[0][0], 10) : 0;
}

function buildProductCatalog(realOrders) {
  const byName = {};
  const bySku = {};
  const byLookupKey = {};

  for (const order of realOrders) {
    if (!order.sku || !order.productName) continue;

    const name = normalizeProductName(order.productName);
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

    const lookupKey = productLookupKey(name);
    if (lookupKey && !byLookupKey[lookupKey]) byLookupKey[lookupKey] = name;
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

  Object.defineProperty(result, "__lookupIndex", {
    value: byLookupKey,
    enumerable: false,
  });

  console.log(`ðŸ“š Product catalog: ${Object.keys(result).length} products | ${Object.keys(result.__skuIndex).length} SKUs`);
  return result;
}

function findProductInCatalog(productName, catalog) {
  if (!productName) return null;
  const clean = normalizeProductName(productName);
  if (catalog[clean]) return catalog[clean];

  const lower = clean.toLowerCase();
  const lookupKey = productLookupKey(clean);
  const lookupName = catalog.__lookupIndex && catalog.__lookupIndex[lookupKey];
  if (lookupName && catalog[lookupName]) return catalog[lookupName];

  for (const [key, val] of Object.entries(catalog)) {
    if (!val || !val.sku) continue;
    const k = key.toLowerCase();
    const kLookup = productLookupKey(key);
    if (k === lower) return val;
    if (k.includes(lower) || lower.includes(k)) return val;
    if (lookupKey.length >= 4 && kLookup.includes(lookupKey)) return val;
    if (kLookup.length >= 4 && lookupKey.includes(kLookup)) return val;
  }
  return null;
}

function parseMissedProductNamesFromCatalog(rawProducts, catalog) {
  const source = stripProductBrackets(rawProducts);
  if (!source) return [];

  const matches = [];
  const names = Object.keys(catalog).sort((a, b) => b.length - a.length);
  let masked = source;
  const normalizedSourceKey = productLookupKey(source);
  const compactMatches = [];

  for (const name of names) {
    if (!name) continue;
    let index = masked.indexOf(name);
    while (index !== -1) {
      matches.push({ name, index, length: name.length });
      masked = masked.slice(0, index) + " ".repeat(name.length) + masked.slice(index + name.length);
      index = masked.indexOf(name);
    }

    const nameKey = productLookupKey(name);
    if (nameKey && normalizedSourceKey.includes(nameKey)) {
      compactMatches.push({ name, index: normalizedSourceKey.indexOf(nameKey), length: nameKey.length });
    }
  }

  if (matches.length > 0) {
    return matches
      .sort((a, b) => a.index - b.index)
      .map((match) => match.name);
  }

  if (compactMatches.length > 0) {
    const used = [];
    return compactMatches
      .sort((a, b) => a.index - b.index || b.length - a.length)
      .filter((match) => {
        const overlaps = used.some((range) => match.index < range.end && match.index + match.length > range.start);
        if (overlaps) return false;
        used.push({ start: match.index, end: match.index + match.length });
        return true;
      })
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
    console.log(`âš ï¸ Missed orders skipped (no live catalog match): ${[...new Set(skipped)].join(", ")}`);
  }

  console.log(`ðŸ“¦ Missed orders resolved: ${resolved.length} SKU-backed items`);
  return { resolved, skippedOrders };
}

function parseKhodOrderKeys(buffer, country = "sa") {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const header = rows[0] || [];

  const phoneColIdx = findHeaderIndex(header, ["Ø§Ù„Ù‡Ø§ØªÙ  1", "Ø§Ù„Ù‡Ø§ØªÙ 1", "Ø§Ù„Ù‡Ø§ØªÙ"], 3);
  const skuColIdx = findHeaderIndex(header, ["sku_code", "SKU", "Sku", "ÙƒÙˆØ¯_Ø§Ù„Ù…Ù†ØªØ¬"], 17);

  const keys = new Set();
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const normPhone = normalizePhone(rows[i][phoneColIdx], country);
    const sku = (rows[i][skuColIdx] || "").toString().trim();
    const key = makeOrderKey(normPhone, sku);
    if (key) keys.add(key);
    else skipped++;
  }

  console.log(`ðŸ“‹ KHOD WHAAT: ${keys.size} phone+SKU keys loaded | skipped:${skipped}`);
  return keys;
}

function parseKhodOrderCount(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const header = rows[0] || [];
  const orderColIdx = findHeaderIndex(header, ["Ø±Ù‚Ù… Ø§Ù„Ø§ÙˆØ±Ø¯Ø±", "Ø±Ù‚Ù… Ø§Ù„Ø·Ù„Ø¨", "Order Number"], 1);
  const orderNumbers = new Set();

  for (let i = 1; i < rows.length; i++) {
    const orderNumber = String(rows[i][orderColIdx] || "").trim();
    if (orderNumber) orderNumbers.add(orderNumber);
  }

  console.log(`ðŸ“‹ KHOD WHAAT: ${orderNumbers.size} distinct order numbers loaded`);
  return orderNumbers.size;
}

function parseKhodPhones(buffer, country = "sa") {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const header = rows[0] || [];
  const phoneColIdx = findHeaderIndex(header, ["Ø§Ù„Ù‡Ø§ØªÙ  1", "Ø§Ù„Ù‡Ø§ØªÙ 1", "Ø§Ù„Ù‡Ø§ØªÙ"], 3);

  const phones = new Set();
  for (let i = 1; i < rows.length; i++) {
    const normPhone = normalizePhone(rows[i][phoneColIdx], country);
    if (normPhone) phones.add(normPhone);
  }

  console.log(`ðŸ“‹ KHOD WHAAT: ${phones.size} phones loaded`);
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
  const skippedOrders = [];
  const stats = {
    realNew: 0, realDupe: 0, realInKhod: 0, realMissingSku: 0,
    realPartialInKhod: 0,
    missedNew: 0, missedDupe: 0, missedInKhod: 0, missedMissingSku: 0,
    missedPartialInKhod: 0,
  };

  function addSkipped(order, reason, detail = {}) {
    skippedOrders.push({
      ...(order || {}),
      rawPhone: order?.rawPhone || order?.phone || order?.normPhone || "",
      normalizedPhone: detail.normalizedPhone != null
        ? detail.normalizedPhone
        : (order?.normPhone || order?.phone || ""),
      reason,
      actionMessage: detail.actionMessage || order?.actionMessage || "",
      manualReview: detail.manualReview === true || order?.manualReview === true,
      uncertain: detail.uncertain === true || order?.uncertain === true,
    });
  }

  // An EasyOrders order that expands to several phone candidates is a
  // customer-data correction. Keep one editable row for it. A different
  // source-ID conflict without candidate expansion remains a normal skip.
  const conflictedOrders = new Set();
  const bySourceOrderId = new Map();
  for (const order of [...realOrders, ...resolvedMissed]) {
    const sourceId = String(order?.orderId || "").trim();
    if (!sourceId) continue;
    if (!bySourceOrderId.has(sourceId)) bySourceOrderId.set(sourceId, []);
    bySourceOrderId.get(sourceId).push(order);
  }
  for (const items of bySourceOrderId.values()) {
    const phones = new Set(items.map((item) => String(item?.normPhone || "").trim()).filter(Boolean));
    if (phones.size <= 1 || items.length <= 1) continue;
    items.forEach((item) => conflictedOrders.add(item));
    const grouped = buildGroupedCartOrders(mergeItemList(items))[0] || items[0];
    const phoneCandidateConflict = items.some((item) => item?.phoneAmbiguous === true);
    const reason = "duplicate_easyorders_uuid_conflicting_phone";
    addSkipped(grouped, reason, {
      manualReview: phoneCandidateConflict,
      uncertain: phoneCandidateConflict,
      normalizedPhone: phoneCandidateConflict ? String(grouped.rawPhone || "").trim() : undefined,
      actionMessage: phoneCandidateConflict
        ? "Phone has more than one plausible correction; review it before upload."
        : "Same EasyOrders order ID produced conflicting phone candidates; it was not uploaded.",
    });
    const source = grouped.source === "missed" ? "missed" : "real";
    stats[`${source}PartialInKhod`]++;
  }

  function accept(order, source) {
    if (conflictedOrders.has(order)) return;
    if (order && order.manualReview === true) {
      addSkipped(order, order.reason || "invalid_customer_data", {
        manualReview: true,
        uncertain: true,
        normalizedPhone: order.normalizedPhone || order.normPhone || order.rawPhone || "",
      });
      stats[`${source}PartialInKhod`]++;
      return;
    }
    const key = makeOrderKey(order.normPhone, order.sku);
    if (!key) {
      stats[`${source}MissingSku`]++;
      addSkipped(order, "missing_sku_in_group");
      return;
    }
    if (khodOrderKeys.has(key)) { stats[`${source}InKhod`]++; return; }
    if (seen.has(key)) { stats[`${source}Dupe`]++; return; }

    seen.add(key);
    result.push(order);
    stats[`${source}New`]++;
  }

  for (const order of realOrders) accept(order, "real");
  for (const order of resolvedMissed) accept(order, "missed");

  console.log(`âœ… New orders: real=${stats.realNew} missed=${stats.missedNew}`);
  console.log(`ðŸš« Already in KHOD WHAAT (phone+SKU): real=${stats.realInKhod} missed=${stats.missedInKhod}`);
  console.log(`ðŸ” Dupes in this batch (phone+SKU): real=${stats.realDupe} missed=${stats.missedDupe}`);
  console.log(`âš ï¸ Missing SKU keys: real=${stats.realMissingSku} missed=${stats.missedMissingSku}`);

  return { orders: result, stats, skippedOrders };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// KHOD WHAAT ANALYTICS MAP
// Reads the KHOD WHAAT affiliate sheet (Arabic headers, from khodBuffer)
// Returns:
//   byPhoneSku  Map<"normPhone|sku", {orderStatus, amountDue, marketerCommission, khodOrderNumber}>
//   skuDefaults Object<sku, {amountDue, marketerCommission}>  â† mode/avg for first-run inference
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const CITY_FALLBACK_POLICY = Object.freeze({
  skuMinDelivered: 10,
  skuMinWinner: 3,
  skuMinShare: 0.30,
  globalMinDelivered: 10,
  globalMinWinner: 3,
  globalMinShare: 0.20,
});

function isKhodDeliveredStatus(value) {
  const status = String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return status === "delivered"
    || status === "completed"
    || status === "ØªÙ… Ø§Ù„ØªÙˆØµÙŠÙ„"
    || status === "ØªÙ… Ø§Ù„ØªÙˆØµÙŠÙ„ Ø¨Ù†Ø¬Ø§Ø­"
    || status === "ØªÙ… Ø§Ù„ØªØ³Ù„ÙŠÙ…"
    || status === "ØªÙ… Ø§Ù„ØªØ³Ù„ÙŠÙ… Ø¨Ù†Ø¬Ø§Ø­"
    || status === "Ù…Ø³Ù„Ù…";
}

function chooseCityFallback(counts, total, policy) {
  let city = "";
  let winnerCount = 0;
  for (const [candidate, count] of counts.entries()) {
    // Strictly greater preserves first-seen order as the deterministic tie-breaker.
    if (count > winnerCount) {
      city = candidate;
      winnerCount = count;
    }
  }
  const share = total > 0 ? winnerCount / total : 0;
  const qualified = total >= policy.minDelivered
    && winnerCount >= policy.minWinner
    && share >= policy.minShare;
  return { city: qualified ? city : "", winner: city, winnerCount, total, share, qualified };
}

function buildCityFallback(rows, indexes) {
  const globalCounts = new Map();
  const skuCounts = new Map();
  const skuTotals = new Map();
  let deliveredRows = 0;
  let validDeliveredRows = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    if (!isKhodDeliveredStatus(row[indexes.status])) continue;
    deliveredRows++;
    const cityMatch = matchCityLabel(row[indexes.city]);
    if (!cityMatch.matched) continue;
    validDeliveredRows++;
    globalCounts.set(cityMatch.city, (globalCounts.get(cityMatch.city) || 0) + 1);

    const sku = String(row[indexes.sku] || "").trim();
    if (!sku) continue;
    if (!skuCounts.has(sku)) skuCounts.set(sku, new Map());
    const counts = skuCounts.get(sku);
    counts.set(cityMatch.city, (counts.get(cityMatch.city) || 0) + 1);
    skuTotals.set(sku, (skuTotals.get(sku) || 0) + 1);
  }

  const globalChoice = chooseCityFallback(globalCounts, validDeliveredRows, {
    minDelivered: CITY_FALLBACK_POLICY.globalMinDelivered,
    minWinner: CITY_FALLBACK_POLICY.globalMinWinner,
    minShare: CITY_FALLBACK_POLICY.globalMinShare,
  });
  const fallbackCityBySku = Object.create(null);
  const skuStats = Object.create(null);
  for (const [sku, counts] of skuCounts.entries()) {
    const choice = chooseCityFallback(counts, skuTotals.get(sku) || 0, {
      minDelivered: CITY_FALLBACK_POLICY.skuMinDelivered,
      minWinner: CITY_FALLBACK_POLICY.skuMinWinner,
      minShare: CITY_FALLBACK_POLICY.skuMinShare,
    });
    if (choice.qualified) fallbackCityBySku[sku] = choice.city;
    skuStats[sku] = { ...choice, counts: Object.fromEntries(counts.entries()) };
  }

  return {
    fallbackCity: globalChoice.city,
    fallbackCityBySku,
    fallbackCityCounts: Object.fromEntries(globalCounts.entries()),
    fallbackCityStats: {
      policy: CITY_FALLBACK_POLICY,
      deliveredRows,
      validDeliveredRows,
      global: globalChoice,
      bySku: skuStats,
    },
  };
}

function logCityFallbackDecision(fallbackStats) {
  const stats = fallbackStats.fallbackCityStats;
  const global = stats.global;
  const pct = `${Math.round(global.share * 100)}%`;
  const globalDecision = global.qualified
    ? `${global.city} (${global.winnerCount}/${global.total}, ${pct})`
    : `none; leading=${global.winner || "none"} (${global.winnerCount}/${global.total}, ${pct})`;
  const qualifiedSkus = Object.entries(fallbackStats.fallbackCityBySku);
  console.log(`[City fallback] delivered rows=${stats.deliveredRows} | usable city rows=${stats.validDeliveredRows} | global=${globalDecision} | qualified SKUs=${qualifiedSkus.length}`);
  if (qualifiedSkus.length) {
    const preview = qualifiedSkus.slice(0, 20).map(([sku, city]) => `${sku}=>${city}`).join(", ");
    console.log(`[City fallback] SKU choices: ${preview}${qualifiedSkus.length > 20 ? `, ... +${qualifiedSkus.length - 20} more` : ""}`);
  }
}

function parseKhodAnalyticsMap(buffer, country = "sa") {
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!rows || rows.length < 2) {
      console.log("ðŸ“Š KHOD WHAAT analytics map: empty sheet");
      return { byPhoneSku: new Map(), skuDefaults: {}, fallbackCity: "", fallbackCityBySku: {}, fallbackCityCounts: {}, fallbackCityStats: {} };
    }

    const header = rows[0] || [];

    // â”€â”€ Column discovery with fallbacks â”€â”€
    const phoneIdx  = findHeaderIndex(header, ["Ø§Ù„Ù‡Ø§ØªÙ  1", "Ø§Ù„Ù‡Ø§ØªÙ 1", "Ø§Ù„Ù‡Ø§ØªÙ"], 3);
    const skuIdx    = findHeaderIndex(header, ["sku_code", "SKU", "Sku", "ÙƒÙˆØ¯_Ø§Ù„Ù…Ù†ØªØ¬"], 17);
    const orderIdx  = findHeaderIndex(header, ["Ø±Ù‚Ù… Ø§Ù„Ø§ÙˆØ±Ø¯Ø±", "Ø±Ù‚Ù… Ø§Ù„Ø·Ù„Ø¨", "Order Number"], 1);
    const statusIdx = findHeaderIndex(header, ["Ø­Ø§Ù„Ø© Ø§Ù„Ø£ÙˆØ±Ø¯Ø±", "Ø­Ø§Ù„Ù‡ Ø§Ù„Ø§ÙˆØ±Ø¯Ø±", "Ø§Ù„Ø­Ø§Ù„Ø©", "Ø­Ø§Ù„Ø©"], 5);
    const cityIdx   = findHeaderIndex(header, ["Ø§Ù„Ù…Ø¯ÙŠÙ†Ø©", "City"], 8);
    const amountIdx = findHeaderIndex(header, ["Ø§Ù„Ù…Ø·Ù„ÙˆØ¨ ØªØ­ØµÙŠÙ„Ù‡", "Ù…Ø¨Ù„Øº Ø§Ù„ØªØ­ØµÙŠÙ„", "Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…Ø·Ù„ÙˆØ¨"], 25);
    const commIdx   = findHeaderIndex(header, ["Ø¹Ù…ÙˆÙ„Ø© Ø§Ù„Ù…Ø³ÙˆÙ‚", "Ø¹Ù…ÙˆÙ„Ø© Ø§Ù„Ù…Ø³ÙˆÙ‘Ù‚", "Ø§Ù„Ø¹Ù…ÙˆÙ„Ø©"], 27);
    const fallbackStats = buildCityFallback(rows, { status: statusIdx, city: cityIdx, sku: skuIdx });

    const byPhoneSku = new Map();
    const skuSamples = {}; // sku â†’ [{amountDue, marketerCommission}]

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

      const normPhone = normalizePhone(row[phoneIdx], country);
      if (!normPhone) continue;

      byPhoneSku.set(`${normPhone}|${sku}`, {
        orderStatus:        (row[statusIdx] || "").toString().trim(),
        amountDue,
        marketerCommission,
        khodOrderNumber:    row[orderIdx] ? String(row[orderIdx]).trim() : "",
      });
    }

    // â”€â”€ Build SKU defaults using mode for amountDue, mean for commission â”€â”€
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

    logCityFallbackDecision(fallbackStats);
    console.log(`ðŸ“Š KHOD WHAAT analytics map: ${byPhoneSku.size} phone+SKU pairs | ${Object.keys(skuDefaults).length} SKU templates | fallback city: ${fallbackStats.fallbackCity || "none"}`);
    return { byPhoneSku, skuDefaults, ...fallbackStats };

  } catch (err) {
    console.error("[Analytics] parseKhodAnalyticsMap error:", err.message);
    return { byPhoneSku: new Map(), skuDefaults: {}, fallbackCity: "", fallbackCityBySku: {}, fallbackCityCounts: {}, fallbackCityStats: {} };
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FULL MONTH SNAPSHOT â€” for Dashboard Infrastructure (STEP 2)
// Reads ALL rows from the KHOD WHAAT affiliate sheet (including Cancelled).
// Date range: selected dashboard range, falling back to current month.
// Read-only: no phone normalization, no SKU matching, no dedup.
// Returns flat array of row objects for dashboardStore.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

    // â”€â”€ Column discovery â€” same robust helper used elsewhere â”€â”€
    const orderNumIdx  = findHeaderIndex(header, ["Ø±Ù‚Ù… Ø§Ù„Ø§ÙˆØ±Ø¯Ø±", "Ø±Ù‚Ù… Ø§Ù„Ø·Ù„Ø¨", "Order Number"], 1);
    const nameIdx      = findHeaderIndex(header, ["Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªÙ„Ù…", "Ø§Ù„Ø§Ø³Ù…", "FullName"], 2);
    const phone1Idx    = findHeaderIndex(header, ["Ø§Ù„Ù‡Ø§ØªÙ  1", "Ø§Ù„Ù‡Ø§ØªÙ 1", "Ø§Ù„Ù‡Ø§ØªÙ"], 3);
    const phone2Idx    = findHeaderIndex(header, ["Ø§Ù„Ù‡Ø§ØªÙ  2", "Ø§Ù„Ù‡Ø§ØªÙ 2"], 4);
    const statusIdx    = findHeaderIndex(header, ["Ø­Ø§Ù„Ø© Ø§Ù„Ø£ÙˆØ±Ø¯Ø±", "Ø­Ø§Ù„Ù‡ Ø§Ù„Ø§ÙˆØ±Ø¯Ø±", "Ø§Ù„Ø­Ø§Ù„Ø©", "Ø­Ø§Ù„Ø©"], 5);
    const orderValIdx  = findHeaderIndex(header, ["Ù‚ÙŠÙ…Ø© Ø§Ù„Ø§ÙˆØ±Ø¯Ø±", "Ù‚ÙŠÙ…Ø© Ø§Ù„Ø·Ù„Ø¨"], 6);
    const commIdx      = findHeaderIndex(header, ["Ø§Ù„Ø¹Ù…ÙˆÙ„Ø©", "Commission"], 7);
    const cityIdx      = findHeaderIndex(header, ["Ø§Ù„Ù…Ø¯ÙŠÙ†Ø©", "City"], 8);
    const regionIdx    = findHeaderIndex(header, ["Ø§Ù„Ù…Ù†Ø·Ù‚Ø©", "Region"], 9);
    const addressIdx   = findHeaderIndex(header, ["Ø§Ù„Ø¹Ù†ÙˆØ§Ù†", "Address"], 10);
    const dataEntryIdx = findHeaderIndex(header, ["Ø¯Ø§ØªØ§ Ø§Ù†ØªØ±ÙŠ", "Data Entry"], 11);
    const qtyIdx       = findHeaderIndex(header, ["Ø¹Ø¯Ø¯ Ø§Ù„Ù‚Ø·Ø¹", "Qty"], 15);
    const productsIdx  = findHeaderIndex(header, ["Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª", "Products"], 16);
    const skuIdx       = findHeaderIndex(header, ["sku_code", "SKU", "Sku", "ÙƒÙˆØ¯_Ø§Ù„Ù…Ù†ØªØ¬"], 17);
    const priceNoShipIdx = findHeaderIndex(header, ["Ø§Ù„Ø³Ø¹Ø± Ø§Ù„ÙƒÙ„ÙŠ Ø¨Ø¯ÙˆÙ† Ø§Ù„Ø´Ø­Ù†"], 18);
    const shippingIdx  = findHeaderIndex(header, ["Ø³Ø¹Ø± Ø§Ù„Ø´Ø­Ù†"], 19);
    const totalPriceIdx= findHeaderIndex(header, ["Ø§Ù„Ø³Ø¹Ø± Ø§Ù„ÙƒÙ„ÙŠ Ø¨Ø§Ù„Ø´Ø­Ù†"], 20);
    const createdAtIdx = findHeaderIndex(header, ["ØªØ§Ø±ÙŠØ® Ø§Ù„Ø¥Ù†Ø´Ø§Ø¡", "ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ù†Ø´Ø§Ø¡", "Created At"], 21);
    const confirmedIdx = findHeaderIndex(header, ["ØªØ§Ø±ÙŠØ® Ø§Ù„ØªØ£ÙƒÙŠØ¯", "Confirmed At"], 22);
    const shippedIdx   = findHeaderIndex(header, ["ØªØ§Ø±ÙŠØ® Ø§Ù„Ø´Ø­Ù†", "Shipped At"], 23);
    const updatedIdx   = findHeaderIndex(header, ["ØªØ§Ø±ÙŠØ® Ø£Ø®Ø± ØªØ­Ø¯ÙŠØ«", "Ø¢Ø®Ø± ØªØ­Ø¯ÙŠØ«", "Last Updated"], 24);
    const amountDueIdx = findHeaderIndex(header, ["Ø§Ù„Ù…Ø·Ù„ÙˆØ¨ ØªØ­ØµÙŠÙ„Ù‡", "Ù…Ø¨Ù„Øº Ø§Ù„ØªØ­ØµÙŠÙ„", "Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…Ø·Ù„ÙˆØ¨"], 25);
    const collectedIdx = findHeaderIndex(header, ["Ø§Ù„Ù…Ø­ØµÙ„", "Collected"], 26);
    const mktCommIdx   = findHeaderIndex(header, ["Ø¹Ù…ÙˆÙ„Ø© Ø§Ù„Ù…Ø³ÙˆÙ‚", "Ø¹Ù…ÙˆÙ„Ø© Ø§Ù„Ù…Ø³ÙˆÙ‘Ù‚"], 27);
    const orderTypeIdx = findHeaderIndex(header, ["Ù†ÙˆØ¹ Ø§Ù„Ø§ÙˆØ±Ø¯Ø±", "Order Type"], 28);
    const notesIdx     = findHeaderIndex(header, ["Ø§Ù„Ù…Ù„Ø§Ø­Ø¸Ø§Øª", "Notes"], 30);

    // â”€â”€ Date range: selected range, matching the KHOD WHAAT list filter/count â”€â”€
    // KHOD WHAAT's "all orders" counter follows the order creation date selected in
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
      const paymentClassification = paymentMethod ? "prepaid" : "cod";
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
        paymentClassification,
        paymentMethodSource: "khod-notes",
        paymentEvidenceSource: "khod-notes",
        effectivePaymentClassification: paymentClassification,
        isEffectiveCod:     paymentClassification !== "prepaid",
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
  console.log("â„¹ï¸ Product map learning skipped: live SKU catalog is used for dedupe.");
  return {};
}

function lookupEoNameInMap() {
  return null;
}

module.exports = {
  parseKhodPhones,
  parseKhodOrderKeys,
  parseKhodOrderCount,
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
