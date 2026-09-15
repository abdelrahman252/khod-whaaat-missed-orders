"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packagePath = path.join(root, "package.json");
const mainPath = path.join(root, "src", "main", "main.js");
const runtimeScriptPath = path.join(root, "scripts", "prepare-runtime-env.js");

const expectedRuntimeKeys = [
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

const buildOnlySecrets = [
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
  "SENTRY_DEBUG",
  "SENTRY_ENABLE_DEV",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
];

const checks = [];

function ok(label, pass, detail) {
  checks.push({ label, pass, detail: detail || "" });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function expandArtifactName(pattern, version, ext) {
  return String(pattern || "")
    .replace(/\$\{version\}/g, version)
    .replace(/\$\{ext\}/g, ext);
}

function electronBuilderCacheRoot() {
  if (process.env.ELECTRON_BUILDER_CACHE) return process.env.ELECTRON_BUILDER_CACHE;
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "electron-builder", "Cache");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Caches", "electron-builder");
  }
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "electron-builder");
}

function listNames(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      directory: entry.isDirectory(),
    }));
  } catch (_) {
    return [];
  }
}

function probeSymlinkPrivilege() {
  const dir = path.join(os.tmpdir(), `khod-build-preflight-${process.pid}-${Date.now()}`);
  const target = path.join(dir, "target.txt");
  const link = path.join(dir, "link.txt");
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(target, "preflight", "utf8");
    fs.symlinkSync(target, link, "file");
    return { ok: true, detail: "Created and removed a temporary file symlink." };
  } catch (error) {
    return {
      ok: false,
      detail: error && error.message ? error.message : String(error),
    };
  } finally {
    try { if (fs.existsSync(link)) fs.unlinkSync(link); } catch (_) {}
    try { if (fs.existsSync(target)) fs.unlinkSync(target); } catch (_) {}
    try { if (fs.existsSync(dir)) fs.rmdirSync(dir); } catch (_) {}
  }
}

const pkg = readJson(packagePath);
const mainSource = fs.readFileSync(mainPath, "utf8");
const runtimeSource = fs.readFileSync(runtimeScriptPath, "utf8");
const build = pkg.build || {};
const winBuild = build.win || {};
const artifactPattern = winBuild.artifactName || "";
const installerArtifact = expandArtifactName(artifactPattern, pkg.version, "exe");
const updaterRegex = /^Khod\.Whaat\.Orders\.Setup\..+\.exe$/i;

ok("productName is KHOD WHAAT Orders", build.productName === "KHOD WHAAT Orders", build.productName);
ok("version is 1.0.59", pkg.version === "1.0.59", pkg.version);
ok("Windows artifactName matches installer contract", artifactPattern === "Khod.Whaat.Orders.Setup.${version}.${ext}", artifactPattern);
ok("Expanded installer artifact matches updater regex", updaterRegex.test(installerArtifact), installerArtifact);
ok("main updater discovery regex is present", /\/\^Khod\\\.Whaat\\\.Orders\\\.Setup\\\.\.\+\\\.exe\$\/i/.test(mainSource), "src/main/main.js");

for (const key of expectedRuntimeKeys) {
  ok(`runtime env allows ${key}`, runtimeSource.includes(`"${key}"`), "prepare-runtime-env.js");
}
for (const key of buildOnlySecrets) {
  ok(`runtime env excludes ${key}`, !runtimeSource.includes(`"${key}"`), "prepare-runtime-env.js");
}

const cacheRoot = electronBuilderCacheRoot();
const winCodeSignCache = path.join(cacheRoot, "winCodeSign");
const cacheEntries = listNames(winCodeSignCache);
const extracted = cacheEntries.filter((entry) => entry.directory);
const archives = cacheEntries.filter((entry) => /\.7z$/i.test(entry.name));
ok("electron-builder cache path identified", !!cacheRoot, cacheRoot);
ok("winCodeSign cache folder exists", fs.existsSync(winCodeSignCache), winCodeSignCache);
ok("winCodeSign has extracted tool folders", extracted.length > 0, `${extracted.length} folder(s)`);
ok("winCodeSign has downloaded archives", archives.length > 0, `${archives.length} archive(s)`);
if (extracted.length > 1 || archives.length > 1) {
  ok("winCodeSign cache is cluttered", false, `${extracted.length} folder(s), ${archives.length} archive(s); delete ${winCodeSignCache} if extraction keeps failing.`);
}

const symlinkProbe = probeSymlinkPrivilege();
ok("Windows symlink privilege available", symlinkProbe.ok, symlinkProbe.detail);

console.log("Build preflight:");
for (const check of checks) {
  const marker = check.pass ? "OK" : "WARN";
  console.log(`[${marker}] ${check.label}${check.detail ? ` - ${check.detail}` : ""}`);
}

console.log("");
console.log(`Expected installer artifact: dist\\${installerArtifact}`);
console.log(`electron-builder cache root: ${cacheRoot}`);
console.log(`winCodeSign cache: ${winCodeSignCache}`);

const hardFailures = checks.filter((check) => !check.pass && !/cache is cluttered|symlink privilege/.test(check.label));
if (hardFailures.length) {
  process.exitCode = 1;
}
