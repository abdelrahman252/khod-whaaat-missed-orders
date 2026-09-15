const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const preload = fs.readFileSync(path.join(root, "src/main/preload.js"), "utf8");
const main = fs.readFileSync(path.join(root, "src/main/main.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const checks = [
  ["main passes the app version to the sandboxed preload", /additionalArguments:\s*\[\s*`--khod-app-version=\$\{app\.getVersion\(\)\}`\s*\]/.test(main)],
  ["preload resolves app version without Node built-ins", /function\s+resolvePreloadAppVersion/.test(preload) && /APP_VERSION_ARG_PREFIX/.test(preload)],
  ["preload does not require path or package.json", !/require\(["']path["']\)/.test(preload) && !/require\([^)]*package\.json/.test(preload)],
  ["monitoring meta uses resolved preload version", /getMeta:\s*\(\)\s*=>\s*\(\{\s*appVersion:\s*PRELOAD_APP_VERSION\s*\}\)/.test(preload)],
  ["preload no longer hardcodes stale 1.0.5", !preload.includes('appVersion: "1.0.5"')],
  ["package version is present", typeof pkg.version === "string" && pkg.version.length > 0],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error("Preload app version verification failed:");
  failed.forEach(([name]) => console.error(" - " + name));
  process.exit(1);
}

console.log(`Preload app version verification passed (${checks.length} checks, package ${pkg.version}).`);
