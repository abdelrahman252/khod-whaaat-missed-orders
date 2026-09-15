"use strict";

const fs = require("fs");
const path = require("path");
const {
  evaluateCachedLicense,
  isInsideWarningWindow,
} = require("../src/main/license-expiry-policy");

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

const now = Date.parse("2026-07-02T12:00:00.000Z");
const healthy = evaluateCachedLicense({
  valid: true,
  expiresAt: "2026-07-12T12:00:00.000Z",
  daysLeft: 30,
}, now);
assert(!healthy.expired && healthy.result.daysLeft === 10, "future expiry is recalculated");
assert(!isInsideWarningWindow(healthy, 3), "healthy cache can use startup fast path");

const nearExpiry = evaluateCachedLicense({
  valid: true,
  expiresAt: "2026-07-03T00:00:00.000Z",
  daysLeft: 1,
}, now);
assert(!nearExpiry.expired && nearExpiry.result.daysLeft === 1, "partial positive day remains one day");
assert(isInsideWarningWindow(nearExpiry, 3), "near-expiry cache requires a fresh startup check");

const expired = evaluateCachedLicense({
  valid: true,
  expiresAt: "2026-07-02T11:59:59.000Z",
  daysLeft: 1,
}, now);
assert(expired.expired && expired.result.daysLeft === 0, "stale valid cache is rejected after expiry");

const legacy = evaluateCachedLicense({ valid: true, daysLeft: 1 }, now);
assert(!legacy.hasKnownExpiry, "legacy cache without expiry metadata requires revalidation");

const perpetual = evaluateCachedLicense({ valid: true, expiresAt: null }, now);
assert(perpetual.hasKnownExpiry && !perpetual.expired, "perpetual license remains valid");
assert(!isInsideWarningWindow(perpetual, 3), "perpetual license can use startup fast path");

const overlaySource = fs.readFileSync(path.join(__dirname, "../src/renderer/pages/expired-overlay.js"), "utf8");
const mainSource = fs.readFileSync(path.join(__dirname, "../src/main/main.js"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "../src/renderer/app.js"), "utf8");
const supportSource = fs.readFileSync(path.join(__dirname, "../src/renderer/support.js"), "utf8");
const capturedCallbacks = overlaySource.match(/const onResumeCallback = _onResumeCallback;/g) || [];
assert(capturedCallbacks.length === 2, "manual and background renewal preserve the resume callback before teardown");
assert(/_startBackgroundRecheck[\s\S]*invalidReason\.includes\('not found'\)[\s\S]*returnToLicensePage/.test(overlaySource),
  "background recheck routes deleted licenses back to activation");
assert(/valid: false,[\s\S]*key,[\s\S]*customerName:[\s\S]*daysLeft:[\s\S]*reason:/.test(mainSource),
  "invalid server results retain saved license context");
assert(/const hasKnownKey[\s\S]*result && result\.key/.test(appSource),
  "renderer distinguishes a saved invalid key from a missing key");
assert(/if \(!shouldReturnToLicensePage\(licenseResult\)\)[\s\S]*rememberInvalidLicenseContext[\s\S]*_triggerExpiredOverlay/.test(appSource),
  "cold startup routes saved expired licenses directly to the overlay");
assert(/onResume: \(freshResult\)[\s\S]*if \(freshResult\)[\s\S]*startPeriodicLicenseCheck\(\)/.test(appSource),
  "renewal refreshes metadata and restarts periodic validation");
assert(/const displayKey = cleanLicenseKey \|\|/.test(overlaySource) && !/●●●●/.test(overlaySource),
  "expired overlay displays the full license ID without masking");
assert(/id="eo-copy-license"[\s\S]*_copyText\(cleanLicenseKey\)/.test(overlaySource),
  "expired overlay copies the full license ID");
assert(/expired\.meta_merchant/.test(overlaySource) && /customerName: \(window\._kbotUser/.test(appSource),
  "expired overlay receives and displays the merchant name");
assert(/KhodSupport\.open\(\{[\s\S]*_supportMessage\(cleanLicenseKey, cleanCustomerName\)/.test(overlaySource),
  "expired overlay sends license and merchant details to support");
assert(/function openSupport\(options\)[\s\S]*supportUrl\(options\)/.test(supportSource),
  "centralized support accepts a contextual prefilled message");

console.log("License expiry cache policy verified.");
