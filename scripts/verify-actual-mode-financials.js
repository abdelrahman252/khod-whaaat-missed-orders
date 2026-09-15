"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log("[PASS] " + label);
  } else {
    failed += 1;
    console.error("[FAIL] " + label);
  }
}

const financialCore = require(path.join(root, "src/renderer/pages/dashboard/dashboard-financial-core.js"));
const calculator = read("src/renderer/pages/dashboard/sections/section7-calculator.js") + "\n" +
  read("src/renderer/pages/dashboard/sections/section7-calculator-hydrated.js");
const campaigns = read("src/renderer/pages/dashboard/sections/section-campaigns.js") + "\n" +
  read("src/renderer/pages/dashboard/sections/section-campaigns-hydrated.js");
const section8 = read("src/renderer/pages/dashboard/sections/section8-master.js");

const actual = financialCore.calculate({
  mode: "actual",
  netOrders: 772,
  actualDeliveredOrders: 137,
  actualEarnedCommission: 2292.01,
  actualDeliveredSales: 5769.2,
  currentTotalSales: 32550,
  expectedNdrRate: 136.62 / 772,
  adSpend: 3064.62,
});

const expected = financialCore.calculate({
  mode: "expected",
  netOrders: 772,
  actualDeliveredOrders: 137,
  actualEarnedCommission: 2292.01,
  actualDeliveredSales: 5769.2,
  currentTotalSales: 32550,
  expectedNdrRate: 136.62 / 772,
  adSpend: 3064.62,
});

check("financial core actual delivered uses sheet delivered count",
  actual.displayedDeliveredOrders === 137);
check("financial core actual commission before ads uses earned marketer commission",
  actual.displayedTotalProfitBeforeAdSpend === 2292.01);
check("financial core actual net result uses earned marketer commission minus spend",
  Math.abs(actual.displayedNetProfit - (2292.01 - 3064.62)) < 0.0001);
check("financial core expected mode still uses exact expected deliveries",
  Math.abs(expected.displayedTotalProfitBeforeAdSpend - expected.expectedTotalProfitBeforeAdSpend) < 0.0001 &&
  expected.displayedDeliveredOrders === Math.round(expected.expectedDeliveriesExact));

check("account calculator prefers KHOD WHAAT earned commission in actual mode",
  calculator.includes("d.actualEarnedCommission != null") &&
  calculator.includes("var commissionSAR = isExpectedRateMode ? (realAvgCommission * realExpectedDvlExact) : realEarnedCommission"));
check("account calculator actual delivered exact count is not replaced by expected deliveries",
  calculator.includes("var realExpectedDvlExact = isExpectedRateMode") &&
  calculator.includes(": realExpectedDvl;"));
check("account calculator actual tooltip names delivered sheet status",
  calculator.includes("counted from delivered sheet status") &&
  calculator.includes("commissionBeforeAdSpend = actualEarnedMarketerCommission"));

check("campaign top KPIs do not expose SKU-matched profit/ROI/ROAS cards",
  !campaigns.includes('card("SKU-matched net profit"') &&
  !campaigns.includes('card("SKU-matched ROI"') &&
  !campaigns.includes('card("SKU-matched profit ROAS"'));
check("campaign top KPIs avoid product-order and product-CPA totals",
  !campaigns.includes('card("Matched product orders"') &&
  !campaigns.includes('card("Matched product CPA"') &&
  !campaigns.includes('card("SKU-matched net orders"'));
check("product actions label product-level order count",
  campaigns.includes('sortableTh("KHOD WHAAT orders", "taagerOrders"') &&
  campaigns.includes("Product orders can differ from whole-account unique orders"));
check("Section 8 top products normalize commission aliases",
  section8.includes("function productCommissionValue(p)") &&
  section8.includes("p && p.expectedTotalProfitBeforeAdSpend") &&
  section8.includes("var earnedProfitAfterTax = productCommissionValue(p);"));
check("Section 8 top products exclude zero-signal placed-only rows",
  section8.includes("function productHasTopSignal(p)") &&
  section8.includes(".filter(productHasTopSignal)") &&
  section8.includes("productDeliveredValue(p) > 0"));
check("Section 8 top products show small positive expected deliveries as less than one",
  section8.includes("if (displayed <= 0 && exact > 0) return '<1';"));

console.log(`\nActual-mode financial verification: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
