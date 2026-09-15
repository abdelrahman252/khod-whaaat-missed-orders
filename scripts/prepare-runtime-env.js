"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, ".env");
const outputDir = path.join(root, ".runtime-build");
const outputPath = path.join(outputDir, "build-runtime.env");
const runtimeKeys = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "GEMINI_API_KEY",
  "SENTRY_DSN",
  "SENTRY_ENVIRONMENT",
  "SENTRY_RELEASE",
  "SENTRY_TRACES_SAMPLE_RATE",
  "SENTRY_ERROR_SAMPLE_RATE",
  "KHOD_DASHBOARD_QUERY_SHADOW",
  "KHOD_DASHBOARD_QUERY_ORDERS",
  "KHOD_DASHBOARD_QUERY_PRODUCTS",
  "KHOD_DASHBOARD_QUERY_CAMPAIGNS",
  "KHOD_DASHBOARD_QUERY_CITIES",
];

const parsed = {};
if (fs.existsSync(sourcePath)) {
  fs.readFileSync(sourcePath, "utf8").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) parsed[match[1]] = match[2];
  });
}

const missing = [];
const lines = runtimeKeys.map((key) => {
  const value = Object.prototype.hasOwnProperty.call(process.env, key)
    ? process.env[key]
    : parsed[key];
  if ((key === "SUPABASE_URL" || key === "SUPABASE_PUBLISHABLE_KEY") && !value) missing.push(key);
  return `${key}=${value || ""}`;
});

if (missing.length) {
  throw new Error(`Missing required runtime configuration: ${missing.join(", ")}`);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Prepared runtime environment (${runtimeKeys.length} allowed keys; build-only secrets excluded).`);
