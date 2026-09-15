"use strict";

/*
  build-perf-fixture.js
  ---------------------------------------------------------------------------
  Generates a synthetic "dashboard snapshot" fixture that matches the exact
  row schema window.runDashboardAggregator (src/renderer/pages/dashboard/
  dashboard-aggregator.js) expects. The schema is intentionally mirrored from
  src/renderer/pages/premium-preview.js's makeOrder() â€” that generator already
  flows through the REAL aggregator + REAL section renderers in production
  (premium preview mode), so cloning its field shape is the safest way to
  guarantee compatibility instead of guessing at the schema.

  Default size: 5,000 orders across 100 distinct products, spread across the
  13 real Saudi provinces/cities used by KhodGeo (src/renderer/app.js), with
  a realistic status funnel, COD/Prepaid mix, and a date distribution that
  concentrates most volume inside the CURRENT calendar month â€” because the
  dashboard's default period is "thisMonth" (dashboard-filter-bus.js), and a
  fixture whose orders mostly fall outside the default view wouldn't actually
  stress-test the default render path.

  Usage:
    node scripts/perf/build-perf-fixture.js
    node scripts/perf/build-perf-fixture.js --orders=20000 --products=250
    node scripts/perf/build-perf-fixture.js --seed=42 --out=custom-fixture.json

  Output:
    scripts/perf/fixtures/perf-fixture.json (by default)
*/

const fs = require("fs");
const path = require("path");

// â”€â”€â”€ CLI args â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function parseArgs(argv) {
  const out = {};
  argv.forEach((arg) => {
    const m = /^--([a-zA-Z]+)=(.+)$/.exec(arg);
    if (m) out[m[1]] = m[2];
  });
  return out;
}
const args = parseArgs(process.argv.slice(2));
const ORDER_COUNT = Math.max(1, Number(args.orders || 5000));
const PRODUCT_COUNT = Math.max(1, Number(args.products || 100));
const SEED = Number(args.seed || 1337);
const OUT_NAME = args.out || "perf-fixture.json";
const OUT_PATH = path.join(__dirname, "fixtures", OUT_NAME);

// â”€â”€â”€ Seeded PRNG (mulberry32) â€” deterministic so reports are comparable across runs â”€â”€
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function weightedPick(items) {
  // items: [{ value, weight }, ...]
  const total = items.reduce((sum, it) => sum + it.weight, 0);
  let r = rand() * total;
  for (const it of items) {
    if ((r -= it.weight) <= 0) return it.value;
  }
  return items[items.length - 1].value;
}

// â”€â”€â”€ Geography â€” lifted from window.KhodGeo's GEO.sa table (src/renderer/app.js) â”€â”€
// [provinceId, provinceNameAr, cities[]] â€” order volume weighted toward the
// provinces that actually carry most KHOD WHAAT order volume in practice.
const PROVINCES = [
  { id: "riyadh", name: "Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø±ÙŠØ§Ø¶", weight: 26, cities: ["Ø§Ù„Ø±ÙŠØ§Ø¶", "Ø§Ù„Ø®Ø±Ø¬", "Ø§Ù„Ù…Ø¬Ù…Ø¹Ø©", "Ø§Ù„Ø¯ÙˆØ§Ø¯Ù…ÙŠ"] },
  { id: "eastern", name: "Ø§Ù„Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø´Ø±Ù‚ÙŠØ©", weight: 18, cities: ["Ø§Ù„Ø¯Ù…Ø§Ù…", "Ø§Ù„Ø®Ø¨Ø±", "Ø§Ù„Ø£Ø­Ø³Ø§Ø¡", "Ø§Ù„Ø¬Ø¨ÙŠÙ„"] },
  { id: "mecca", name: "Ù…Ù†Ø·Ù‚Ø© Ù…ÙƒØ© Ø§Ù„Ù…ÙƒØ±Ù…Ø©", weight: 20, cities: ["Ø¬Ø¯Ø©", "Ù…ÙƒØ©", "Ø§Ù„Ø·Ø§Ø¦Ù"] },
  { id: "madinah", name: "Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ù…Ù†ÙˆØ±Ø©", weight: 9, cities: ["Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ù…Ù†ÙˆØ±Ø©", "ÙŠÙ†Ø¨Ø¹"] },
  { id: "qassim", name: "Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ù‚ØµÙŠÙ…", weight: 6, cities: ["Ø¨Ø±ÙŠØ¯Ø©", "Ø¹Ù†ÙŠØ²Ø©"] },
  { id: "aseer", name: "Ù…Ù†Ø·Ù‚Ø© Ø¹Ø³ÙŠØ±", weight: 6, cities: ["Ø£Ø¨Ù‡Ø§", "Ø®Ù…ÙŠØ³ Ù…Ø´ÙŠØ·"] },
  { id: "tabuk", name: "Ù…Ù†Ø·Ù‚Ø© ØªØ¨ÙˆÙƒ", weight: 3, cities: ["ØªØ¨ÙˆÙƒ"] },
  { id: "hail", name: "Ù…Ù†Ø·Ù‚Ø© Ø­Ø§Ø¦Ù„", weight: 3, cities: ["Ø­Ø§Ø¦Ù„"] },
  { id: "jazan", name: "Ù…Ù†Ø·Ù‚Ø© Ø¬Ø§Ø²Ø§Ù†", weight: 3, cities: ["Ø¬ÙŠØ²Ø§Ù†"] },
  { id: "najran", name: "Ù…Ù†Ø·Ù‚Ø© Ù†Ø¬Ø±Ø§Ù†", weight: 2, cities: ["Ù†Ø¬Ø±Ø§Ù†"] },
  { id: "baha", name: "Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø¨Ø§Ø­Ø©", weight: 2, cities: ["Ø§Ù„Ø¨Ø§Ø­Ø©"] },
  { id: "jawf", name: "Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø¬ÙˆÙ", weight: 1, cities: ["Ø³ÙƒØ§ÙƒØ§"] },
  { id: "northern", name: "Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø­Ø¯ÙˆØ¯ Ø§Ù„Ø´Ù…Ø§Ù„ÙŠØ©", weight: 1, cities: ["Ø¹Ø±Ø¹Ø±"] }
];
const PROVINCE_WEIGHTED = PROVINCES.map((p) => ({ value: p, weight: p.weight }));

// â”€â”€â”€ Status funnel â€” exact strings reused from premium-preview.js (proven to
// normalize correctly via window.KhodStatus). Weights model a realistic
// dropshipping funnel rather than a uniform spread. â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STATUS_TABLE = {
  winner: [
    ["ØªÙ… Ø§Ù„ØªÙˆØµÙŠÙ„", 55], ["ÙÙŠ Ø§Ù†ØªØ¸Ø§Ø± Ø§Ù„Ø´Ø­Ù†", 10], ["ØªÙ… ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø·Ù„Ø¨", 12],
    ["ØªÙ… Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø·Ù„Ø¨", 8], ["ÙØ´Ù„ Ø§Ù„ØªØ³Ù„ÙŠÙ…", 5], ["Ø·Ù„Ø¨ Ù…Ù„ØºÙŠ Ø¨ÙˆØ§Ø³Ø·ØªÙƒ", 4],
    ["Ø§Ù„Ø¹Ù…ÙŠÙ„ Ø±ÙØ¶ Ø§Ù„ØªØ£ÙƒÙŠØ¯", 3], ["ØªÙ… Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹", 3]
  ],
  average: [
    ["ØªÙ… Ø§Ù„ØªÙˆØµÙŠÙ„", 35], ["ÙÙŠ Ø§Ù†ØªØ¸Ø§Ø± Ø§Ù„Ø´Ø­Ù†", 14], ["ØªÙ… ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø·Ù„Ø¨", 16],
    ["ØªÙ… Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø·Ù„Ø¨", 10], ["ÙØ´Ù„ Ø§Ù„ØªØ³Ù„ÙŠÙ…", 9], ["Ø·Ù„Ø¨ Ù…Ù„ØºÙŠ Ø¨ÙˆØ§Ø³Ø·ØªÙƒ", 7],
    ["Ø§Ù„Ø¹Ù…ÙŠÙ„ Ø±ÙØ¶ Ø§Ù„ØªØ£ÙƒÙŠØ¯", 6], ["ØªÙ… Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹", 3]
  ],
  loser: [
    ["ØªÙ… Ø§Ù„ØªÙˆØµÙŠÙ„", 16], ["ÙÙŠ Ø§Ù†ØªØ¸Ø§Ø± Ø§Ù„Ø´Ø­Ù†", 10], ["ØªÙ… ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø·Ù„Ø¨", 14],
    ["ØªÙ… Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø·Ù„Ø¨", 10], ["ÙØ´Ù„ Ø§Ù„ØªØ³Ù„ÙŠÙ…", 20], ["Ø·Ù„Ø¨ Ù…Ù„ØºÙŠ Ø¨ÙˆØ§Ø³Ø·ØªÙƒ", 14],
    ["Ø§Ù„Ø¹Ù…ÙŠÙ„ Ø±ÙØ¶ Ø§Ù„ØªØ£ÙƒÙŠØ¯", 12], ["ØªÙ… Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹", 4]
  ]
};
function statusFor(tier) {
  const khodStatuses = {
    winner: [
      ["Delivered", 55], ["In shipping", 10], ["Confirmed", 12],
      ["Under processing", 8], ["Failed", 5], ["Canceled", 4],
      ["Pending", 3], ["Waiting", 3]
    ],
    average: [
      ["Delivered", 35], ["In shipping", 14], ["Confirmed", 16],
      ["Under processing", 10], ["Failed", 9], ["Canceled", 7],
      ["Pending", 6], ["Waiting", 3]
    ],
    loser: [
      ["Delivered", 16], ["In shipping", 10], ["Confirmed", 14],
      ["Under processing", 10], ["Failed", 20], ["Canceled", 14],
      ["Pending", 12], ["Waiting", 4]
    ]
  };
  return weightedPick(khodStatuses[tier].map(([value, weight]) => ({ value, weight })));
}

// â”€â”€â”€ Product catalog â€” 15 categories x procedurally generated variants â”€â”€â”€â”€â”€â”€
const CATEGORIES = [
  { code: "OUD", label: "Ø¹Ø·Ø±", priceRange: [120, 320] },
  { code: "SRM", label: "Ø³ÙŠØ±ÙˆÙ… Ø§Ù„Ø¹Ù†Ø§ÙŠØ© Ø¨Ø§Ù„Ø¨Ø´Ø±Ø©", priceRange: [90, 220] },
  { code: "HAI", label: "Ø²ÙŠØª Ø´Ø¹Ø± Ø¨Ø±ÙŠÙ…ÙŠÙˆÙ…", priceRange: [70, 180] },
  { code: "BLD", label: "Ø®Ù„Ø§Ø· Ù…Ù†Ø²Ù„ÙŠ Ø°ÙƒÙŠ", priceRange: [140, 260] },
  { code: "WCH", label: "Ø³Ø§Ø¹Ø© Ø°ÙƒÙŠØ©", priceRange: [160, 380] },
  { code: "BCK", label: "Ø­Ø²Ø§Ù… Ø¯Ø¹Ù… Ø§Ù„Ø¸Ù‡Ø±", priceRange: [110, 230] },
  { code: "BTH", label: "Ø³Ù…Ø§Ø¹Ø© Ø¨Ù„ÙˆØªÙˆØ«", priceRange: [80, 210] },
  { code: "TOY", label: "Ù„Ø¹Ø¨Ø© ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ù„Ù„Ø£Ø·ÙØ§Ù„", priceRange: [60, 150] },
  { code: "KIT", label: "Ù…Ø¬Ù…ÙˆØ¹Ø© Ø³ÙƒØ§ÙƒÙŠÙ† Ù…Ø·Ø¨Ø®", priceRange: [100, 240] },
  { code: "PRS", label: "Ø¬Ù‡Ø§Ø² Ø¹Ù†Ø§ÙŠØ© Ø´Ø®ØµÙŠØ©", priceRange: [130, 290] },
  { code: "CAR", label: "Ø­Ø§Ù…Ù„ Ù‡Ø§ØªÙ Ù„Ù„Ø³ÙŠØ§Ø±Ø©", priceRange: [50, 130] },
  { code: "FIT", label: "Ù…Ø¹Ø¯Ø§Øª Ø±ÙŠØ§Ø¶ÙŠØ© Ù…Ù†Ø²Ù„ÙŠØ©", priceRange: [90, 210] },
  { code: "DEC", label: "Ø¥ÙƒØ³Ø³ÙˆØ§Ø± Ø¯ÙŠÙƒÙˆØ± Ù…Ù†Ø²Ù„ÙŠ", priceRange: [70, 170] },
  { code: "GFT", label: "Ù…Ø¬Ù…ÙˆØ¹Ø© Ù‡Ø¯Ø§ÙŠØ§ ÙØ§Ø®Ø±Ø©", priceRange: [150, 300] },
  { code: "SUN", label: "Ù†Ø¸Ø§Ø±Ø© Ø´Ù…Ø³ÙŠØ©", priceRange: [60, 160] }
];
function buildProducts(count) {
  const products = [];
  let i = 0;
  while (products.length < count) {
    const cat = CATEGORIES[i % CATEGORIES.length];
    const variantIndex = Math.floor(i / CATEGORIES.length) + 1;
    const price = randInt(cat.priceRange[0], cat.priceRange[1]);
    const commission = Math.round(price * (0.18 + rand() * 0.1)); // ~18-28% of price
    const taxProfit = Math.round(commission * 0.1);
    // Pareto-ish performance tiers: ~20% winners, ~60% average, ~20% losers
    const roll = rand();
    const tier = roll < 0.2 ? "winner" : roll < 0.8 ? "average" : "loser";
    // Pareto-ish demand skew: winners get a much heavier order-volume weight
    const demandWeight = tier === "winner" ? randInt(8, 20) : tier === "average" ? randInt(2, 6) : randInt(1, 2);
    products.push({
      key: cat.code + "-" + String(variantIndex).padStart(3, "0"),
      sku: "KHOD-" + cat.code + "-" + String(variantIndex).padStart(3, "0"),
      name: cat.label + " " + (variantIndex > 1 ? "Ø¥ØµØ¯Ø§Ø± " + variantIndex : "Ø£Ø³Ø§Ø³ÙŠ"),
      price,
      commission,
      taxProfit,
      tier,
      demandWeight
    });
    i++;
  }
  return products;
}

// â”€â”€â”€ Customer name pool (kept small + simple; realism here matters less than
// the financial/status/geo fields the aggregator actually keys off of) â”€â”€â”€â”€â”€â”€
const FIRST_NAMES = ["Ø£Ø­Ù…Ø¯", "Ù…Ø­Ù…Ø¯", "Ø®Ø§Ù„Ø¯", "Ø³Ø¹ÙˆØ¯", "ÙÙ‡Ø¯", "Ù†ÙˆØ±Ø©", "Ø³Ø§Ø±Ø©", "Ø±ÙŠÙ…", "Ù…Ù†ÙŠØ±Ø©", "Ø¹Ø¨Ø¯Ø§Ù„Ù„Ù‡", "ÙŠØ§Ø³Ø±", "Ù‡Ù†Ø¯", "Ù„Ù…Ù‰", "ØªØ±ÙƒÙŠ", "Ø¨Ù†Ø¯Ø±"];
const LAST_NAMES = ["Ø§Ù„Ø¹ØªÙŠØ¨ÙŠ", "Ø§Ù„Ù‚Ø­Ø·Ø§Ù†ÙŠ", "Ø§Ù„Ø¯ÙˆØ³Ø±ÙŠ", "Ø§Ù„Ø´Ù‡Ø±ÙŠ", "Ø§Ù„Ù…Ø·ÙŠØ±ÙŠ", "Ø§Ù„Ø²Ù‡Ø±Ø§Ù†ÙŠ", "Ø§Ù„Ø³Ø¨ÙŠØ¹ÙŠ", "Ø§Ù„Ø­Ø±Ø¨ÙŠ", "Ø§Ù„Ø¹Ù†Ø²ÙŠ", "Ø§Ù„Ø¨Ù‚Ù…ÙŠ"];

function pad2(n) { return String(n).padStart(2, "0"); }
function isoDate(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }

function buildDateForOrder(today, daysSoFarThisMonth) {
  // ~85% of volume inside the current month (days 1..today), ~15% in the
  // full previous month â€” matches the dashboard's default "thisMonth" period
  // while still populating prevMonth for delta/comparison metrics.
  const inCurrentMonth = rand() < 0.85;
  let d;
  if (inCurrentMonth) {
    const dayOffset = randInt(0, Math.max(0, daysSoFarThisMonth - 1));
    d = new Date(today.getFullYear(), today.getMonth(), 1 + dayOffset);
  } else {
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const daysInPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    d = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), randInt(1, daysInPrevMonth));
  }
  d.setHours(randInt(8, 22), randInt(0, 59), 0, 0);
  return d;
}

function buildOrders(count, products) {
  const today = new Date();
  const daysSoFarThisMonth = today.getDate();
  const productWeighted = products.map((p) => ({ value: p, weight: p.demandWeight }));
  const orders = [];

  for (let i = 0; i < count; i++) {
    const product = weightedPick(productWeighted);
    const province = weightedPick(PROVINCE_WEIGHTED);
    const city = pick(province.cities);
    const created = buildDateForOrder(today, daysSoFarThisMonth);
    const status = statusFor(product.tier);
    const delivered = status === "ØªÙ… Ø§Ù„ØªÙˆØµÙŠÙ„";
    const canceledByUser = status === "Ø·Ù„Ø¨ Ù…Ù„ØºÙŠ Ø¨ÙˆØ§Ø³Ø·ØªÙƒ";
    const qty = rand() < 0.78 ? 1 : rand() < 0.92 ? 2 : 3;
    const total = product.price * qty;
    const grossCommission = product.commission * qty;
    const taxProfit = product.taxProfit * qty;
    const taagerProfit = grossCommission - taxProfit;
    const paymentMethod = rand() < 0.22 ? "Prepaid" : "COD";
    const updated = new Date(created.getTime() + (1 + randInt(0, 4)) * 86400000);
    const customer = pick(FIRST_NAMES) + " " + pick(LAST_NAMES);

    orders.push({
      name: customer,
      phone: "9665" + String(40000000 + i).padStart(8, "0"),
      productName: product.name,
      sku: product.sku,
      qty,
      unitPrice: product.price,
      subtotal: total,
      totalPrice: total,
      dashboardTotalPrice: total,
      city,
      region: province.name,
      address: "Ø­ÙŠ ØªØ¬Ø±ÙŠØ¨ÙŠØŒ Ù…Ø¨Ù†Ù‰ " + (10 + (i % 90)),
      date: isoDate(created),
      createdAt: isoDate(created),
      lastUpdatedAt: isoDate(updated),
      source: i % 17 === 0 ? "missed" : "real",
      orderStatus: status,
      status,
      amountDue: status === "Delivered" ? total : (status === "Canceled" ? 0 : total),
      dashboardAmountDue: status === "Delivered" ? total : (status === "Canceled" ? 0 : total),
      marketerCommission: grossCommission,
      commission: grossCommission,
      profit: grossCommission,
      taxProfit,
      taagerProfit,
      profitAfterTax: taagerProfit,
      orderNumber: "KHOD-PERF-" + String(5000000 + i),
      khodOrderNumber: "KHOD-PERF-" + String(5000000 + i),
      taagerOrderNumber: "KHOD-PERF-" + String(5000000 + i),
      paymentMethod,
      country: "SA",
      khodCountry: "sa",
      taagerCountry: "sa",
      currency: "SAR"
    });
  }
  return orders;
}

function summarize(orders, products) {
  const byStatus = {};
  const byProvince = {};
  orders.forEach((o) => {
    byStatus[o.orderStatus] = (byStatus[o.orderStatus] || 0) + 1;
    byProvince[o.region] = (byProvince[o.region] || 0) + 1;
  });
  const topProducts = products
    .map((p) => ({ name: p.name, sku: p.sku, tier: p.tier, demandWeight: p.demandWeight }))
    .sort((a, b) => b.demandWeight - a.demandWeight)
    .slice(0, 5);
  return { byStatus, byProvince, topProducts };
}

function main() {
  const products = buildProducts(PRODUCT_COUNT);
  const orders = buildOrders(ORDER_COUNT, products);
  const today = new Date();
  const fixture = {
    generatedAt: new Date().toISOString(),
    seed: SEED,
    accountId: "perf-test-store",
    orderCount: orders.length,
    productCount: products.length,
    snapshotMonth: today.getFullYear() + "-" + pad2(today.getMonth() + 1),
    autoFetchTimestamp: Date.now(),
    snapshot: orders
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(fixture), "utf8");

  const summary = summarize(orders, products);
  const sizeKb = Math.round(fs.statSync(OUT_PATH).size / 1024);
  console.log("[perf-fixture] Wrote " + OUT_PATH + " (" + sizeKb + " KB)");
  console.log("[perf-fixture] orders=" + orders.length + " products=" + products.length + " seed=" + SEED);
  console.log("[perf-fixture] status distribution:");
  Object.keys(summary.byStatus).sort((a, b) => summary.byStatus[b] - summary.byStatus[a]).forEach((status) => {
    console.log("    " + status + ": " + summary.byStatus[status]);
  });
  console.log("[perf-fixture] province distribution:");
  Object.keys(summary.byProvince).sort((a, b) => summary.byProvince[b] - summary.byProvince[a]).forEach((region) => {
    console.log("    " + region + ": " + summary.byProvince[region]);
  });
  console.log("[perf-fixture] top 5 demand-weighted products:");
  summary.topProducts.forEach((p) => console.log("    " + p.sku + " (" + p.tier + ") â€” " + p.name));
}

main();

module.exports = { buildProducts, buildOrders, OUT_PATH };
