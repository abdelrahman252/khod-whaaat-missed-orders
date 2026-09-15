const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const arPath = path.join(root, "src/renderer/pages/dashboard/locales/ar/dashboard-locale.js");
const enPath = path.join(root, "src/renderer/pages/dashboard/locales/en/dashboard-locale.js");
const ar = fs.readFileSync(arPath, "utf8");
const en = fs.readFileSync(enPath, "utf8");

function keys(source) {
  return [...source.matchAll(/'([^']+)'\s*:/g)].map(match => match[1]);
}

const arKeys = keys(ar);
const enKeys = keys(en);
const counts = {};
arKeys.forEach(key => { counts[key] = (counts[key] || 0) + 1; });
const duplicates = Object.entries(counts).filter(([, count]) => count > 1);

const enNav = [...new Set(enKeys.filter(key => key.startsWith("nav.")))];
const arNav = new Set(arKeys.filter(key => key.startsWith("nav.")));
const missingNav = enNav.filter(key => !arNav.has(key));

const checks = [
  ["Arabic locale has no duplicate string keys", duplicates.length === 0, duplicates.map(([key, count]) => `${key}:${count}`).join(", ")],
  ["Arabic locale has no escaped Unicode cleanup block", !/\\u[0-9a-fA-F]{4}/.test(ar), ""],
  ["Arabic locale has readable Arabic text", /[\u0600-\u06FF]/.test(ar), ""],
  ["Arabic locale covers English nav keys", missingNav.length === 0, missingNav.join(", ")],
  ["GMV Arabic nav/tour labels remain present", ar.includes("'nav.gmvTarget'") && ar.includes("'tour.dashboard.gmvTarget.title'"), ""],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error("Arabic locale cleanup verification failed:");
  failed.forEach(([name, , detail]) => console.error(" - " + name + (detail ? ` (${detail})` : "")));
  process.exit(1);
}

console.log(`Arabic locale cleanup verification passed (${checks.length} checks).`);
