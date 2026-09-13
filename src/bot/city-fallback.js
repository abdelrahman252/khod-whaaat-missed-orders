"use strict";

// Canonical labels must remain substrings of EasyOrders' #government options.
const CITY_KEYWORDS = [
  { keywords: ["الرياض", "riyadh"], label: "منطقة الرياض" },
  { keywords: ["الغربية", "مكة", "مكه", "جدة", "جده", "الطائف", "makkah", "mecca", "jeddah", "taif"], label: "المنطقة الغربية" },
  { keywords: ["الشرقية", "الدمام", "الخبر", "الاحساء", "الأحساء", "eastern", "dammam", "khobar"], label: "المنطقة الشرقية" },
  { keywords: ["المدينة المنورة", "المدينه المنوره", "المدينة", "المدينه", "medina", "madinah"], label: "المدينة المنورة" },
  { keywords: ["القصيم", "قصيم", "بريدة", "عنيزة", "qassim", "buraidah"], label: "منطقة القصيم" },
  { keywords: ["عسير", "أبها", "ابها", "خميس مشيط", "asir", "abha"], label: "عسير" },
  { keywords: ["جيزان", "جازان", "jizan", "jazan"], label: "جيزان" },
  { keywords: ["نجران", "najran"], label: "نجران" },
  { keywords: ["تبوك", "tabuk"], label: "تبوك" },
  { keywords: ["حائل", "حايل", "hail"], label: "حائل" },
  { keywords: ["سكاكا", "الجوف", "جوف", "sakaka", "jouf"], label: "سكاكا" },
  { keywords: ["عرعر", "الحدود الشمالية", "الحدود الشماليه", "حدود", "arar", "northern borders"], label: "عرعر" },
  { keywords: ["الباحة", "الباحه", "باحة", "baha"], label: "الباحة" },
];

const DEFAULT_CITY = "منطقة الرياض";

function normalizeCityText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\w\u0600-\u06ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchCityLabel(cityName) {
  const raw = String(cityName || "").trim();
  if (!raw || raw.toLowerCase() === "unspecified") return { raw, city: "", matched: false };
  const clean = normalizeCityText(raw);
  for (const entry of CITY_KEYWORDS) {
    if (normalizeCityText(entry.label) === clean) return { raw, city: entry.label, matched: true };
    for (const keyword of entry.keywords) {
      const normalizedKeyword = normalizeCityText(keyword);
      if (normalizedKeyword && (clean.includes(normalizedKeyword) || normalizedKeyword.includes(clean))) {
        return { raw, city: entry.label, matched: true };
      }
    }
  }
  return { raw, city: "", matched: false };
}

function validFallbackCity(value) {
  const match = matchCityLabel(value);
  return match.matched ? match.city : "";
}

function fallbackCityForOrder(order, options = {}) {
  const provided = matchCityLabel(order?.city);
  if (provided.matched) return { city: provided.city, tier: "provided", raw: provided.raw };

  const sku = String(order?.sku || "").trim();
  const bySku = options.fallbackCityBySku;
  const skuValue = bySku instanceof Map
    ? bySku.get(sku)
    : (bySku && typeof bySku === "object" && Object.prototype.hasOwnProperty.call(bySku, sku) ? bySku[sku] : "");
  const skuCity = validFallbackCity(skuValue);
  if (skuCity) return { city: skuCity, tier: "sku", raw: provided.raw };

  const globalCity = validFallbackCity(options.fallbackCity);
  if (globalCity) return { city: globalCity, tier: "global", raw: provided.raw };
  return { city: DEFAULT_CITY, tier: "static", raw: provided.raw };
}

module.exports = {
  CITY_KEYWORDS,
  DEFAULT_CITY,
  normalizeCityText,
  matchCityLabel,
  validFallbackCity,
  fallbackCityForOrder,
};
