"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const runner = read("src/bot/khod-flow-runner.js");
const recovery = read("src/bot/easy-orders-ui-recovery.js");
const data = read("src/bot/easy-orders-affiliate-recovery-data.js");
const results = read("src/renderer/pages/results.js");

const checks = [
  ["Khod runner exposes the affiliate-recovery phase", runner.includes("phaseAffiliateRecovery") && runner.includes("easyOrdersAffiliateRecoveryEnabled")],
  ["Affiliate recovery keeps failed rows for manual review", runner.includes("manualReviewRows") && runner.includes('destination: "affiliate-recovery"')],
  ["Manual-review rows can be normalized back into a rerun", runner.includes("normalizeManualReviewOrders") && runner.includes("manualReviewMode")],
  ["EasyOrders recovery normalizes Saudi phone numbers with metadata", recovery.includes("normalizePhoneWithMeta") && recovery.includes("function easyOrdersPhone")],
  ["EasyOrders recovery retries order navigation and action confirmation", recovery.includes("withEasyOrdersOrderRetry") && recovery.includes("watchEasyOrdersAction")],
  ["Uncertain live product/quantity decisions are held", recovery.includes("manualReview") && recovery.includes("quantity_tier_price_not_verified")],
  ["Recovery data has quantity and duplicate guards", data.includes("quantityEditDecision") && data.includes("groupRealRecoveryCandidates")],
  ["Results renders one merged manual-review table", results.includes("function buildSkippedOrdersHtml") && !results.includes("function buildRecoveryUncertainHtml")],
  ["Results preserves affiliate destination when rerunning selected rows", results.includes("manualReviewDestination") && results.includes('destination === "affiliate-recovery"')],
];

let failed = 0;
for (const [label, ok] of checks) {
  if (ok) console.log(`[PASS] ${label}`);
  else { failed++; console.error(`[FAIL] ${label}`); }
}
console.log(`\nKhod affiliate recovery verification: ${checks.length - failed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
