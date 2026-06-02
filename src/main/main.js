// DOTENV - load .env if present (dev or packaged extraResources)
(function loadEnv() {
  const path = require("path");
  const fs = require("fs");
  const devLocalPath = path.join(__dirname, "../../.env.local");
  const devPath = path.join(__dirname, "../../.env");
  const prodPath = process.resourcesPath ? path.join(process.resourcesPath, ".env") : null;
  const prodLocalPath = process.resourcesPath ? path.join(process.resourcesPath, ".env.local") : null;
  const dotenv = require("dotenv");
  const baseEnvPath = fs.existsSync(devPath)
    ? devPath
    : (prodPath && fs.existsSync(prodPath) ? prodPath : null);
  if (baseEnvPath) dotenv.config({ path: baseEnvPath });
  if (fs.existsSync(devLocalPath)) dotenv.config({ path: devLocalPath, override: true });
  else if (prodLocalPath && fs.existsSync(prodLocalPath)) dotenv.config({ path: prodLocalPath, override: true });
})();

const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const Store = require("electron-store");
const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const https = require("https");
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");
const monitoring = require("../monitoring/sentry.main");
const { normalizePhone } = require("../bot/phone");
let dashboardAiService = null;
let dashboardAiGatewayConfigured = false;

function getDashboardAiService() {
  if (!dashboardAiService) {
    dashboardAiService = require("./dashboard-ai-service");
  }
  if (!dashboardAiGatewayConfigured && dashboardStore) {
    dashboardAiService.configureAiGateway({
      loadState: () => dashboardStore.get("aiGatewayState", {}),
      saveState: (state) => dashboardStore.set("aiGatewayState", state || {}),
      logEvent: () => {},
    });
    dashboardAiGatewayConfigured = true;
  }
  return dashboardAiService;
}

if (process.env.KHOD_QA_USER_DATA_DIR) {
  try {
    fs.mkdirSync(process.env.KHOD_QA_USER_DATA_DIR, { recursive: true });
    app.setPath("userData", process.env.KHOD_QA_USER_DATA_DIR);
  } catch (error) {
    log.warn("[QA] Could not set isolated userData path:", error && error.message ? error.message : error);
  }
}

monitoring.initMainMonitoring();
monitoring.patchIpcMonitoring();
monitoring.registerRendererMonitoringBridge();

// ════════════════════════════════════════
// [KHOD AI DEBUG] — remove once AI is confirmed working
// ════════════════════════════════════════

// ════════════════════════════════════════
// STARTUP PERFORMANCE FLAGS
// Must be set before app is ready.
// ════════════════════════════════════════
// Disable GPU process sandbox (reduces process spawn overhead on Windows)
app.commandLine.appendSwitch("disable-gpu-sandbox");
// Skip GPU info collection on startup (saves ~50–150 ms)
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
// Use hardware acceleration but skip slow software rasterizer fallback
app.commandLine.appendSwitch("enable-gpu-rasterization");
// Reduce IPC overhead on renderer startup
app.commandLine.appendSwitch("renderer-process-limit", "1");
// V8 code cache: reuse compiled JS across launches (saves 20–60 ms per launch)
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=256");

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
try {
  autoUpdater.verifyUpdateCodeSignature = false;
} catch (_) {}
autoUpdater.logger = {
  info:  () => {},
  warn:  (...a) => log.warn("[AutoUpdate]", ...a),
  error: (...a) => log.error("[AutoUpdate]", ...a),
  debug: () => {},
};

// ══════════════════════════════════════════════════════
// SUPABASE CONFIG
// Primary source: .env file (dev) or extraResources/.env (packaged).
// No hardcoded fallback — missing config produces a clear warning rather than
// silently using stale credentials baked into the source.
// ══════════════════════════════════════════════════════
const SUPABASE_URL             = process.env.SUPABASE_URL             || "";
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  log.warn("[App] Supabase config missing — license checks will fail until .env is configured.");
}

const SUPABASE_TIMEOUT_MS = 180_000; // 180 s (3 minutes) — enough for slow connections and multi-account syncs

function supabaseRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      reject(new Error("supabase_config_missing"));
      return;
    }
    const baseUrl = SUPABASE_URL.replace(/\/+$/, "");
    const url = new URL(baseUrl + endpoint);
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
      "Prefer": method === "POST" ? "return=representation" : "",
    };
    headers["apikey"] = SUPABASE_PUBLISHABLE_KEY;
    const options = {
      hostname: url.hostname, path: url.pathname + url.search, method, headers,
      timeout: SUPABASE_TIMEOUT_MS,
    };
    if (bodyStr) options.headers["Content-Length"] = Buffer.byteLength(bodyStr);
    let settled = false;
    const settle = (fn, val) => { if (!settled) { settled = true; fn(val); } };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { settle(resolve, { status: res.statusCode, data: JSON.parse(data) }); }
        catch { settle(resolve, { status: res.statusCode, data }); }
      });
    });
    req.on("timeout", () => { req.destroy(); settle(reject, new Error("supabase_timeout")); });
    req.on("error", (e) => settle(reject, e));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function supabaseRpc(fn, body) {
  const res = await supabaseRequest("POST", `/rest/v1/rpc/${fn}`, body || {});
  if (res.status >= 400) {
    const msg = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    throw new Error(`supabase_rpc_${fn}_failed_${res.status}: ${msg}`);
  }
  return res.data;
}

function supabaseFunctionRequest(fn, body) {
  return new Promise((resolve, reject) => {
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      reject(new Error("supabase_config_missing"));
      return;
    }
    const baseUrl = SUPABASE_URL.replace(/\/+$/, "");
    const url = new URL(`${baseUrl}/functions/v1/${fn}`);
    const bodyStr = JSON.stringify(body || {});
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
        "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
        "apikey": SUPABASE_PUBLISHABLE_KEY,
      },
      timeout: SUPABASE_TIMEOUT_MS,
    };
    let settled = false;
    const settle = (fnSettle, value) => {
      if (!settled) {
        settled = true;
        fnSettle(value);
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { error: data || "invalid_function_response" }; }
        if (res.statusCode >= 400) {
          settle(reject, new Error(parsed.error || parsed.message || `function_${fn}_failed_${res.statusCode}`));
          return;
        }
        settle(resolve, parsed);
      });
    });
    req.on("timeout", () => { req.destroy(); settle(reject, new Error("supabase_function_timeout")); });
    req.on("error", (error) => settle(reject, error));
    req.write(bodyStr);
    req.end();
  });
}

function getIconPath() {
  // DEV:     assets/ is two levels up from src/main/
  // PACKAGED: extraResources copies assets/ → resources/assets/ (real disk, outside asar)
  //           so nativeImage.createFromPath() can always read it on any customer's PC
  const base = app.isPackaged
    ? path.join(process.resourcesPath, "assets")
    : path.join(__dirname, "..", "..", "assets");
  if (process.platform === "win32") return path.join(base, "icon.ico");
  if (process.platform === "darwin") return path.join(base, "icon.icns");
  return path.join(base, "icon.png");
}

// ══════════════════════════════════════════════════════
// STORE ENCRYPTION KEYS
// Derived at runtime from a stable machine UUID so each machine gets a unique
// key — a static hardcoded string is trivially reversible once someone has the
// source. Two salts produce different keys for the two stores.
// NOTE: We now use a stable, unencrypted machine-id.json to break the chicken-and-egg
// problem where we couldn't read the UUID from the encrypted license.json.
// ══════════════════════════════════════════════════════
let _cachedMachineUUID = "";

function getStableMachineUUID() {
  if (_cachedMachineUUID) return _cachedMachineUUID;
  try {
    const userData = app.getPath("userData");
    const filePath = require("path").join(userData, "machine-id.json");
    if (require("fs").existsSync(filePath)) {
      const raw = JSON.parse(require("fs").readFileSync(filePath, "utf8"));
      if (raw && raw.machineUUID) {
        _cachedMachineUUID = raw.machineUUID;
        return _cachedMachineUUID;
      }
    }
  } catch (e) {
    log.error("[MachineUUID] Error reading machine-id.json:", e);
  }
  return "";
}

function initializeUserDataAndStoreKeys() {
  try {
    const userData = app.getPath("userData");
    const machineIdPath = require("path").join(userData, "machine-id.json");
    let machineUUID = "";

    // 1. Try to read from machine-id.json
    if (require("fs").existsSync(machineIdPath)) {
      try {
        const raw = JSON.parse(require("fs").readFileSync(machineIdPath, "utf8"));
        if (raw && raw.machineUUID) {
          machineUUID = raw.machineUUID;
          _cachedMachineUUID = machineUUID;
        }
      } catch (e) {
        log.error("[Migration] Error reading machine-id.json:", e);
      }
    }

    // 2. If not found, check if we have a legacy configuration we can migrate
    if (!machineUUID) {
      const legacyBase = require("os").hostname() + require("os").cpus()[0].model;
      const legacyLicenseKey = require("crypto").createHash("sha256").update("khod-license-v1::" + legacyBase).digest("hex").slice(0, 32);

      try {
        const tempStore = new Store({ encryptionKey: legacyLicenseKey, name: "license" });
        const existingUUID = tempStore.get("machineUUID", "");
        if (existingUUID) {
          machineUUID = existingUUID;
          _cachedMachineUUID = machineUUID;
          require("fs").writeFileSync(machineIdPath, JSON.stringify({ machineUUID }, null, 2), "utf8");

          // Copy data from legacy license store
          const licenseData = tempStore.store;

          // Copy data from legacy credentials store if it exists
          let credentialsData = {};
          const legacyCredsKey = require("crypto").createHash("sha256").update("khod-creds-v1::" + legacyBase).digest("hex").slice(0, 32);
          try {
            const tempCredsStore = new Store({ encryptionKey: legacyCredsKey, name: "credentials" });
            credentialsData = tempCredsStore.store || {};
          } catch (credsErr) {
            log.warn("[Migration] Could not read legacy credentials store:", credsErr.message);
          }

          // Deriving the new keys based on machineUUID
          const newLicenseKey = require("crypto").createHash("sha256").update("khod-license-v1::" + machineUUID).digest("hex").slice(0, 32);
          const newCredsKey = require("crypto").createHash("sha256").update("khod-creds-v1::" + machineUUID).digest("hex").slice(0, 32);

          // Delete the legacy files to avoid decryption conflicts on next Store instantiations
          try {
            const licFile = require("path").join(userData, "license.json");
            if (require("fs").existsSync(licFile)) require("fs").unlinkSync(licFile);
          } catch (e) {
            log.error("[Migration] Failed to delete old license.json:", e);
          }
          try {
            const credsFile = require("path").join(userData, "credentials.json");
            if (require("fs").existsSync(credsFile)) require("fs").unlinkSync(credsFile);
          } catch (e) {
            log.error("[Migration] Failed to delete old credentials.json:", e);
          }

          // Write new encrypted files
          const newLicenseStore = new Store({ encryptionKey: newLicenseKey, name: "license" });
          newLicenseStore.store = licenseData;

          const newCredsStore = new Store({ encryptionKey: newCredsKey, name: "credentials" });
          newCredsStore.store = credentialsData;

        }
      } catch (err) {
        log.warn("[Migration] Legacy decryption failed or no legacy UUID found:", err.message);
      }
    }

    // 3. If still no machineUUID (fresh install), generate a new one
    if (!machineUUID) {
      machineUUID = require("crypto").randomUUID ? require("crypto").randomUUID() : require("crypto").createHash("sha256").update(require("crypto").randomBytes(16)).digest("hex");
      _cachedMachineUUID = machineUUID;
      try {
        require("fs").writeFileSync(machineIdPath, JSON.stringify({ machineUUID }, null, 2), "utf8");
      } catch (err) {
        log.error("[Migration] Failed to write new machineUUID to disk:", err);
      }
    }
  } catch (globalErr) {
    log.error("[Migration] Global error in initializeUserDataAndStoreKeys:", globalErr);
  }
}

// Run the migration/initialization first
initializeUserDataAndStoreKeys();

function deriveStoreKey(salt) {
  try {
    let uuid = getStableMachineUUID();
    const base = uuid || (require("os").hostname() + require("os").cpus()[0].model);
    return require("crypto").createHash("sha256").update(salt + "::" + base).digest("hex").slice(0, 32);
  } catch {
    return salt.length > 8 ? salt : salt + "-khod-bot-2025-fallback";
  }
}

function createStore(options) {
  try {
    return new Store(options);
  } catch (e) {
    // Corrupted store file — wipe it and recreate clean
    try {
      const filePath = path.join(app.getPath("userData"), options.name + ".json");
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      log.warn(`[store] Corrupted store "${options.name}" deleted and recreated.`);
    } catch (_) {}
    return new Store(options);
  }
}

const store          = createStore({ encryptionKey: deriveStoreKey("khod-creds-v1"),   name: "credentials" });
const licenseStore   = createStore({ encryptionKey: deriveStoreKey("khod-license-v1"), name: "license" });
const analyticsStore = createStore({ name: "analytics" }); // unencrypted — run history only
const dashboardStore = createStore({ name: "dashboard" }); // unencrypted — monthly snapshots
let analyticsRunsCache = null;
let analyticsRunsCacheDirty = true;
let analyticsSnapshotSyncCacheKey = "";

function invalidateAnalyticsRunsCache() {
  analyticsRunsCache = null;
  analyticsRunsCacheDirty = true;
}

let mainWindow, tray, autoRunTimer = null, autoRunEnabled = false, botRunning = false;
let lastExportTimestamp = 0;

// ── Chrome path cache — resolved once at startup so dashboard fetch skips discovery ──
let _cachedChromePath = null;
function getCachedChromePath() {
  if (_cachedChromePath) return _cachedChromePath;
  const { execSync } = require("child_process");
  try {
    if (process.platform === "win32") {
      const candidates = [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe"),
        process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google\\Chrome\\Application\\chrome.exe"),
      ].filter(Boolean);
      for (const p of candidates) { if (fs.existsSync(p)) { _cachedChromePath = p; return p; } }
      try {
        const reg = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /ve', { encoding: "utf8", timeout: 2000 });
        const m = reg.match(/REG_SZ\s+(.+)/);
        if (m && fs.existsSync(m[1].trim())) { _cachedChromePath = m[1].trim(); return _cachedChromePath; }
      } catch {}
    } else if (process.platform === "darwin") {
      const p = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
      if (fs.existsSync(p)) { _cachedChromePath = p; return p; }
    } else {
      const p = execSync("which google-chrome || which chromium-browser || which chromium", { encoding: "utf8", timeout: 2000 }).trim().split("\n")[0];
      if (p) { _cachedChromePath = p; return p; }
    }
  } catch {}
  return null; // dashboard-fetch will fall back to its own findChrome()
}
// Warm up the cache immediately on process start (non-blocking)
setImmediate(() => { try { getCachedChromePath(); } catch {} });

// ══════════════════════════════════════════════════════
// DEVICE FINGERPRINT — stable across reboots, updates, VPN, network changes
// Uses: CPU model + platform/arch + CPU count + RAM bucket (rounded to 4 GB)
//
// WHY hostname was REMOVED:
//   macOS silently renames the host after system updates or Bonjour conflicts
//   Windows may rename after domain join/leave or certain Windows Update passes
//   That was the #1 cause of unexpected "different device" kicks on Mac/Windows
// ══════════════════════════════════════════════════════
function _getOrCreateMachineUUID() {
  const stableUuid = getStableMachineUUID();
  if (stableUuid) {
    try {
      if (licenseStore.get("machineUUID") !== stableUuid) {
        licenseStore.set("machineUUID", stableUuid);
      }
    } catch (_) {}
    return stableUuid;
  }
  let uuid = licenseStore.get("machineUUID", "");
  if (!uuid) {
    uuid = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
    try {
      licenseStore.set("machineUUID", uuid);
    } catch (_) {}
  }
  return uuid;
}

function getDeviceFingerprint() {
  try {
    const cpus      = os.cpus();
    const cpuModel  = cpus && cpus.length ? cpus[0].model.trim() : "unknown-cpu";
    const platform  = `${process.platform}-${process.arch}`;
    const cpuCount  = String(cpus && cpus.length ? cpus.length : 1);
    // Math.max(1, ...) guards against <4 GB machines producing "0GB"
    const rawGB     = os.totalmem() / (4 * 1024 * 1024 * 1024);
    const memBucket = String(Math.max(1, Math.round(rawGB)) * 4) + "GB";
    const raw = `${cpuModel}::${platform}::${cpuCount}::${memBucket}`;
    return crypto.createHash("sha256").update(raw).digest("hex").toUpperCase().slice(0, 16);
  } catch {
    // Last-resort: use the stable machine UUID so the fingerprint survives
    // corrupted os.cpus() calls (rare but seen on some VMs)
    const uuid = _getOrCreateMachineUUID();
    return crypto.createHash("sha256").update(uuid).digest("hex").toUpperCase().slice(0, 16);
  }
}

// ── Account slot hash — includes account id so two accounts with identical
//    emails still get distinct hashes and count as separate slots in DB.
function accountHash(acc) {
  const id   = (acc.id         || "").trim();
  const easy = (acc.easyEmail  || "").toLowerCase().trim();
  const khod = (acc.khodEmail  || "").toLowerCase().trim();
  return crypto.createHash("sha256").update(`${id}|${easy}|${khod}`).digest("hex");
}

function _buildAccountIdents() {
  try {
    const accounts = store.get("accounts", []);
    return accounts.map(a => ({
      easy_email: (a.easyEmail || "").toLowerCase().trim(),
      khod_email: (a.khodEmail || "").toLowerCase().trim(),
    })).filter(x => x.easy_email || x.khod_email);
  } catch { return []; }
}

function looksLikeEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function accountDisplayName(acc, fallback = "Account") {
  if (!acc) return fallback;
  return (acc.memberName || acc.easyEmail || acc.email || acc.khodEmail || acc.easyStore || acc.storeName || acc.label || acc.name || fallback || "Account").trim();
}

function getStoredAccountById(accountId) {
  if (!accountId || accountId === "__single__" || accountId === "legacy") {
    const easyEmail = store.get("easyEmail", "");
    return easyEmail ? {
      id: accountId || "__single__",
      label: "Account 1",
      easyEmail,
    } : null;
  }
  const accounts = store.get("accounts", []) || [];
  return accounts.find(a => a.id === accountId) || null;
}

function getStoredAccountsMap() {
  const accounts = store.get("accounts", []) || [];
  return new Map(accounts.map(a => [a.id, a]));
}

function normalizeAnalyticsRun(run, accountsById) {
  const accountId = run.accountId || "__single__";
  const storedAccount = (accountId === "__single__" || accountId === "legacy")
    ? getStoredAccountById(accountId)
    : accountsById?.get(accountId);
  const storedEmail = (storedAccount?.easyEmail || "").trim();
  const payloadEmail = (run.accountEmail || "").trim();
  const payloadLabel = (run.accountLabel || "").trim();
  const email = storedEmail || (looksLikeEmail(payloadEmail) ? payloadEmail : "") || (looksLikeEmail(payloadLabel) ? payloadLabel : "") || payloadEmail;
  const label = accountDisplayName(storedAccount, payloadLabel || email || payloadEmail || "");

  return {
    ...run,
    accountId,
    accountEmail: email,
    accountLabel: label,
  };
}

function parseOrderRowsFromOutputBuffer(bufferLike) {
  try {
    if (!bufferLike) return [];
    const buffer = Buffer.isBuffer(bufferLike)
      ? bufferLike
      : Buffer.from(bufferLike instanceof ArrayBuffer ? new Uint8Array(bufferLike) : bufferLike);
    if (!buffer.length) return [];

    const XLSX = require("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets.Orders || wb.Sheets[wb.SheetNames[0]];
    if (!ws) return [];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }).slice(1);

    return rows
      .filter(row => row && row.some(cell => String(cell || "").trim()))
      .map(row => ({
        qty: Number(row[0]) || 1,
        productName: String(row[1] || ""),
        sku: "",
        unitPrice: "",
        subtotal: Number(row[2]) || 0,
        date: String(row[3] || ""),
        city: String(row[4] || ""),
        region: String(row[5] || ""),
        address: String(row[6] || ""),
        name: String(row[7] || ""),
        phone: String(row[8] || ""),
        source: "real",
        orderStatus: "Under processing",
        amountDue: 0,
        marketerCommission: 0,
        khodOrderNumber: "",
      }));
  } catch (err) {
    console.warn("[Analytics] Failed to parse order rows from output buffer:", err.message);
    return [];
  }
}

function khodRowKey(row) {
  const sku = (row?.sku || "").toString().trim();
  if (!sku) return null;
  const phone = normalizePhone(row.phone) || normalizePhone(row.phone1) || normalizePhone(row.phone2);
  return phone ? `${phone}|${sku}` : null;
}

function analyticsOrderKey(order) {
  const sku = (order?.sku || "").toString().trim();
  if (!sku) return null;
  const phone = normalizePhone(order.phone || order.rawPhone || order.normPhone || "");
  return phone ? `${phone}|${sku}` : null;
}

function mergeKhodRowIntoOrder(order, khodRow) {
  if (!khodRow) return order;
  const next = { ...order };
  if (khodRow.orderStatus) next.orderStatus = khodRow.orderStatus;
  if (khodRow.khodOrderNumber) next.khodOrderNumber = khodRow.khodOrderNumber;
  if (Number(khodRow.amountDue) > 0) next.amountDue = Number(khodRow.amountDue);
  if (Number(khodRow.marketerCommission) > 0) next.marketerCommission = Number(khodRow.marketerCommission);
  if (Number(khodRow.totalPrice) > 0) next.subtotal = Number(khodRow.totalPrice);
  if (khodRow.city && !next.city) next.city = khodRow.city;
  if (khodRow.createdAt && !next.date) next.date = khodRow.createdAt;
  return next;
}

function dashboardRowKey(row) {
  if (!row) return null;
  const direct = row.khodOrderNumber || row.orderNumber || row.orderId || row.id;
  if (direct) return `id:${String(direct).trim()}`;
  const sku = (row.sku || row.productSku || "").toString().trim();
  const phone = normalizePhone(row.phone || row.phone1 || row.phone2 || row.rawPhone || "");
  const date = (row.createdAt || row.date || row.lastUpdatedAt || "").toString().slice(0, 10);
  if (phone || sku || date) return `sig:${phone}|${sku}|${date}`;
  return null;
}

function normalizeDashboardDateKey(value) {
  if (!value) return "";
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function dashboardRowDateKey(row) {
  if (!row) return "";
  return normalizeDashboardDateKey(row.dashboardDate || row.createdAt || row.date || row.lastUpdatedAt || row.updatedAt);
}

function mergeDashboardRows(existingRows, incomingRows) {
  const merged = [];
  const index = new Map();
  const addOrReplace = (row) => {
    if (!row) return;
    const key = dashboardRowKey(row) || `row:${merged.length}`;
    const prevIndex = index.get(key);
    if (prevIndex == null) {
      index.set(key, merged.length);
      merged.push(row);
      return;
    }
    merged[prevIndex] = { ...merged[prevIndex], ...row };
  };
  (Array.isArray(existingRows) ? existingRows : []).forEach(addOrReplace);
  (Array.isArray(incomingRows) ? incomingRows : []).forEach(addOrReplace);
  return merged;
}

function replaceDashboardRowsInRange(existingRows, incomingRows, dateFrom, dateTo) {
  const from = normalizeDashboardDateKey(dateFrom);
  const to = normalizeDashboardDateKey(dateTo);
  if (!from || !to) return mergeDashboardRows(existingRows, incomingRows);

  const outsideFetchedWindow = (Array.isArray(existingRows) ? existingRows : []).filter((row) => {
    const key = dashboardRowDateKey(row);
    return !key || key < from || key > to;
  });
  return mergeDashboardRows(outsideFetchedWindow, incomingRows);
}

function enrichAnalyticsRunsFromKhodRows(accountId, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  const khodMap = new Map();
  for (const row of rows) {
    const key = khodRowKey(row);
    if (key) khodMap.set(key, row);
  }
  if (khodMap.size === 0) return 0;

  const storedRuns = analyticsStore.get("runs", []);
  let changed = 0;
  const accountsById = getStoredAccountsMap();
  const runs = storedRuns.map(run => normalizeAnalyticsRun(run, accountsById)).map((run) => {
    if (accountId && run.accountId !== accountId) return run;
    if (!Array.isArray(run.orders) || run.orders.length === 0) return run;

    let runChanged = false;
    const orders = run.orders.map((order) => {
      const khodRow = khodMap.get(analyticsOrderKey(order));
      if (!khodRow) return order;
      const merged = mergeKhodRowIntoOrder(order, khodRow);
      if (JSON.stringify(merged) !== JSON.stringify(order)) {
        runChanged = true;
        changed++;
      }
      return merged;
    });

    return runChanged ? { ...run, orders } : run;
  });

  if (changed > 0) {
    analyticsStore.set("runs", runs);
    invalidateAnalyticsRunsCache();
  }
  return changed;
}

function normalizeKhodSnapshotEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  return entries.map((entry) => {
    if (!Array.isArray(entry) || entry.length < 2) return null;
    const key = String(entry[0] || "");
    const parts = key.split("|");
    const row = entry[1] || {};
    return {
      ...row,
      phone: parts[0] || row.phone || row.phone1 || row.phone2 || "",
      sku: parts[1] || row.sku || row.productSku || "",
    };
  }).filter(Boolean);
}

function enrichOrdersFromKhodRows(orders, khodRows) {
  if (!Array.isArray(orders) || orders.length === 0 || !Array.isArray(khodRows) || khodRows.length === 0) {
    return { orders: Array.isArray(orders) ? orders : [], changed: 0 };
  }
  const khodMap = new Map();
  for (const row of khodRows) {
    const key = khodRowKey(row);
    if (key) khodMap.set(key, row);
  }
  if (khodMap.size === 0) return { orders, changed: 0 };

  let changed = 0;
  const enriched = orders.map((order) => {
    const khodRow = khodMap.get(analyticsOrderKey(order));
    if (!khodRow) return order;
    const merged = mergeKhodRowIntoOrder(order, khodRow);
    if (JSON.stringify(merged) !== JSON.stringify(order)) changed++;
    return merged;
  });
  return { orders: enriched, changed };
}

function isOperationsSuiteEnabled() {
  return licenseStore.get("analyticsEnabled", true) !== false ||
    licenseStore.get("operationsEnabled", true) !== false;
}

function isReportingDataEnabled() {
  return isOperationsSuiteEnabled() || licenseStore.get("dashboardEnabled", false) === true;
}

function saveDashboardSnapshotRows(accountId, data, source) {
  if (!accountId || !data || !Array.isArray(data.snapshot)) return 0;
  const rows = data.snapshot || [];
  const accounts = dashboardStore.get("accounts", {});
  if (!accounts[accountId]) accounts[accountId] = {};
  const rangeFrom = data.dateFrom || "";
  const rangeTo = data.dateTo || "";
  accounts[accountId].snapshot = replaceDashboardRowsInRange(accounts[accountId].snapshot, rows, rangeFrom, rangeTo);
  accounts[accountId].snapshotMonth = data.snapshotMonth || "";
  accounts[accountId].lastFetchRange = { dateFrom: rangeFrom, dateTo: rangeTo, rows: rows.length, source: source || "bot" };
  accounts[accountId].botSnapshotTimestamp = Date.now();
  dashboardStore.set("accounts", accounts);
  analyticsSnapshotSyncCacheKey = "";
  return rows.length;
}

function syncAnalyticsFromDashboardSnapshots() {
  const accounts = dashboardStore.get("accounts", {});
  const cacheKey = JSON.stringify(Object.entries(accounts || {}).map(([accountId, snap]) => [
    accountId,
    Array.isArray(snap?.snapshot) ? snap.snapshot.length : 0,
    snap?.updatedAt || snap?.lastUpdatedAt || snap?.timestamp || "",
  ]));
  if (cacheKey && cacheKey === analyticsSnapshotSyncCacheKey) return 0;
  let total = 0;
  for (const [accountId, snap] of Object.entries(accounts || {})) {
    total += enrichAnalyticsRunsFromKhodRows(accountId, snap?.snapshot || []);
  }
  analyticsSnapshotSyncCacheKey = cacheKey;
  return total;
}

// ══════════════════════════════════════════════════════
// LICENSE — server-only, random key, auto device lock
// Format: KHOD-XXXX-XXXX-XXXX-XXXX
// ══════════════════════════════════════════════════════
// Short-lived in-memory cache — shared by isLicenseValid() (auto-run timer)
// and the check-license IPC handler to prevent redundant Supabase calls.
// Busted by submit-license and clear-reset-flag.
let _licenseCache = null;
let _licenseCacheAt = 0;
const LICENSE_CACHE_TTL_MS = 60 * 1000; // 60 seconds

function isValidKeyFormat(key) {
  return /^KHOD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key.trim().toUpperCase());
}

async function isLicenseValid() {
  const key = licenseStore.get("licenseKey", "");
  if (!key) return false;
  if (_licenseCache && (Date.now() - _licenseCacheAt) < LICENSE_CACHE_TTL_MS) {
    return _licenseCache.valid === true;
  }
  try {
    const r = await supabaseRpc("khod_check_license_with_identity", {
      p_license_key:    key,
      p_machine_uuid:   _getOrCreateMachineUUID(),
      p_device_id:      getDeviceFingerprint(),
      p_account_idents: _buildAccountIdents(),
    });
    if (!r || !r.valid) {
      if (!r || r.reason === "License not found on server.") {
        log.warn(`[License] Key "${key}" not found on server. Clearing local licenseKey.`);
        licenseStore.delete("licenseKey");
      }
      return false;
    }
    if (r.force_flush) _handleForceFlush();
    _saveLastValidResult({ valid: true, key });
    return true;
  } catch {
    return !!_getOfflineGraceResult();
  }
}

// ════════════════════════════════════════
// TRAY
// ════════════════════════════════════════
function createTray() {
  const iconPath = getIconPath();
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) console.warn("[tray] nativeImage loaded empty — check path and file validity");
    if (process.platform === "win32" && !icon.isEmpty()) icon = icon.resize({ width: 16, height: 16 });
  } catch (e) {
    console.error("[tray] failed to load icon:", e.message);
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);
  tray.setToolTip("Khod Order Bot");
  updateTrayMenu();
  tray.on("click", () => { if (mainWindow.isVisible()) mainWindow.hide(); else { mainWindow.show(); mainWindow.focus(); } });
}
function updateTrayMenu() {
  if (!tray) return;
  const label = autoRunEnabled && autoRunTimer ? "Auto-Run: ON" : "Auto-Run: OFF";
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Khod Order Bot", enabled: false }, { type: "separator" },
    { label, enabled: false }, { type: "separator" },
    { label: "Show Window", click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: "separator" }, { label: "Quit", click: () => { app.quit(); } },
  ]));
}

// ════════════════════════════════════════
// WINDOW
// ════════════════════════════════════════
function createWindow() {
  // Read saved theme synchronously so we can pass the correct backgroundColor
  // before the window is shown — prevents a white/dark flash during startup.
  const savedTheme = store.get("theme", "dark");
  const bgColor = savedTheme === "light" ? "#f0f2f7" : "#0f1117";

  mainWindow = new BrowserWindow({
    width: 1100, height: 750, minWidth: 760, minHeight: 560,
    frame: false, titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // V8 snapshot: reuse compiled bytecode across launches
      v8CacheOptions: "bypassHeatCheck",
      // Disable spell check — saves renderer init time for a non-document app
      spellcheck: false,
    },
    backgroundColor: bgColor, icon: getIconPath(), show: false,
  });
  monitoring.monitorWindow(mainWindow, "main");
  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    log.error("[Preload] preload-error:", preloadPath, error && error.stack ? error.stack : error);
    monitoring.captureException(error, { operation: "preload.error", extra: { preloadPath } });
  });
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  mainWindow.once("ready-to-show", () => {
    const launchHidden = store.get("launchMinimized", false) === true;
    const autoRunOn = store.get("autoRun", false) === true;
    if (launchHidden || autoRunOn) {
      mainWindow.hide();
      return;
    }
    mainWindow.show();
    if (!autoRunOn) {
      mainWindow.maximize();
    }
    mainWindow.focus();
  });
  mainWindow.on("close", (e) => {
    if (app.isQuitting) return;
    e.preventDefault();
    const autoRunOn = store.get("autoRun", false);
    const { response } = dialog.showMessageBoxSync(mainWindow, {
      type: "question", buttons: ["Minimize to Tray", "Close App"],
      defaultId: 0, cancelId: 0, title: "Close Khod Bot?",
      message: autoRunOn ? "Auto-Run is active" : "Keep running in tray?",
      detail: autoRunOn
        ? "Auto-Run is active — minimizing to tray keeps the bot running every " + autoRunIntervalLabel() + "."
        : "The app will keep running in the system tray. Click the tray icon to reopen it.",
    });
    if (response === 0) mainWindow.hide();
    else { clearAutoRun(); app.isQuitting = true; app.quit(); }
  });
}

// ════════════════════════════════════════
// AUTO-RUN
// ════════════════════════════════════════
function todayStr() { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-"); }
function autoRunIntervalLabel() {
  const m = store.get("autoRunInterval", 30);
  return m < 60 ? m + " min" : (m / 60) + " hr";
}

// Declared BEFORE app.whenReady so it is always defined when scheduleAutoRun() is called.
let autoRunStartedAt = 0;

function scheduleAutoRun() {
  clearAutoRun();
  autoRunStartedAt = Date.now();
  const intervalMs = store.get("autoRunInterval", 30) * 60 * 1000;

  // Recursive setTimeout: each tick recalculates remaining time from wall clock.
  // Unlike setInterval this doesn't drift, and survives sleep/wake correctly.
  function scheduleTick() {
    const remaining = Math.max(0, intervalMs - (Date.now() - autoRunStartedAt));
    autoRunTimer = setTimeout(async () => {
      if (botRunning) {
        // Bot still running — check again in 10 s without resetting the cycle
        autoRunTimer = setTimeout(scheduleTick, 10000);
        return;
      }
      if (!(await isLicenseValid())) {
        mainWindow.webContents.send("license-expired");
        autoRunStartedAt = Date.now();
        scheduleTick();
        return;
      }
      autoRunStartedAt = Date.now();
      mainWindow.webContents.send("auto-run-tick", { dateFrom: todayStr(), dateTo: todayStr() });
      scheduleTick();
    }, remaining);
  }

  scheduleTick();
  updateTrayMenu();
}

function getAutoRunProgress() {
  if (!autoRunEnabled || !autoRunTimer) return null;
  const intervalMs = store.get("autoRunInterval", 30) * 60 * 1000;
  const remaining  = Math.max(0, intervalMs - (Date.now() - autoRunStartedAt));
  return { remainingMs: remaining, intervalMs };
}

function clearAutoRun() {
  if (autoRunTimer) { clearTimeout(autoRunTimer); autoRunTimer = null; }
  updateTrayMenu();
}

// ── Analytics: auto-purge old runs on startup ──────────────────────────────
function purgeOldAnalyticsRuns(daysToKeep = 30) {
  const runs = analyticsStore.get("runs", []);
  const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  const filtered = runs.filter(r => r.runTimestamp >= cutoff);
  if (filtered.length < runs.length) {
    analyticsStore.set("runs", filtered);
    invalidateAnalyticsRunsCache();
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  autoRunEnabled = store.get("autoRun", false);
  if (autoRunEnabled) scheduleAutoRun();
  purgeOldAnalyticsRuns(store.get("analyticsPurgeDays", 30));

  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        log.error("[AutoUpdate] Startup checkForUpdates failed:", err.message);
        monitoring.captureException(err, { operation: "autoUpdater.startupCheck" });
      });
    }, 3000);
  }
});
app.on("before-quit", () => { app.isQuitting = true; });
app.on("will-quit", (event) => {
  if (app.__sentryFlushed) return;
  event.preventDefault();
  app.__sentryFlushed = true;
  monitoring.flushMainMonitoring(2000).finally(() => app.quit());
});
app.on("window-all-closed", () => {});

autoUpdater.on("checking-for-update", () => {
});

autoUpdater.on("update-available", (info) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-available", { version: info.version });
  }
});

autoUpdater.on("update-not-available", (info) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-not-available");
  }
});

autoUpdater.on("download-progress", (progress) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-progress", {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    });
  }
});

autoUpdater.on("update-downloaded", (info) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-downloaded");
  }
});

autoUpdater.on("error", (err) => {
  log.error(`[AutoUpdate] AutoUpdater error: ${err.message}`, err.stack || "");
  monitoring.captureException(err, { operation: "autoUpdater.error" });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-error", { message: err.message });
  }
});

ipcMain.handle("check-for-updates", async () => {
  if (!app.isPackaged) {
    log.warn("[AutoUpdate] App is not packaged - skipping update check");
    return { dev: true };
  }
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    log.error(`[AutoUpdate] autoUpdater.checkForUpdates() threw: ${e.message}`, e.stack || "");
    monitoring.captureException(e, { operation: "autoUpdater.manualCheck" });
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("download-update", () => {
  autoUpdater.downloadUpdate();
  return { ok: true };
});

ipcMain.handle("install-update", () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle("get-app-version", () => app.getVersion());

// ════════════════════════════════════════
// IPC — Window
// ════════════════════════════════════════
ipcMain.on("window-minimize", () => mainWindow.minimize());
ipcMain.on("window-maximize", () => { if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize(); });
ipcMain.on("window-close", () => mainWindow.hide());

// ════════════════════════════════════════
// IPC — License (server-based, auto device lock)
// Handlers registered below after _checkLicenseImpl is defined.
// ════════════════════════════════════════

// ════════════════════════════════════════
// IPC — Credentials — Multi-Account Edition
// ════════════════════════════════════════

const OFFLINE_GRACE_MS = 48 * 60 * 60 * 1000;

function _saveLastValidResult(result) {
  licenseStore.set("lastValidResult", result);
  licenseStore.set("lastValidAt", Date.now());
}

function _getOfflineGraceResult() {
  const lastValidAt = licenseStore.get("lastValidAt", 0);
  const lastResult  = licenseStore.get("lastValidResult", null);
  if (!lastResult || !lastResult.valid) return null;
  const age = Date.now() - lastValidAt;
  if (age > OFFLINE_GRACE_MS) return null;
  const hoursLeft = Math.ceil((OFFLINE_GRACE_MS - age) / 3600000);
  log.warn(`[License] Offline grace active - last valid ${Math.round(age / 60000)} min ago, ${hoursLeft}h left`);
  return { ...lastResult, offline: true };
}

function _handleForceFlush() {
  log.warn("[License] Force flush received — wiping all local data per admin request.");
  try { store.clear(); } catch (_) {}
  try { analyticsStore.clear(); } catch (_) {}
  try { dashboardStore.clear(); } catch (_) {}
  // licenseStore intentionally NOT cleared — customer can re-enter their existing key
  // Bust in-memory caches
  _licenseCache = null; _licenseCacheAt = 0;
  _credCache = null; _credCacheAt = 0;
  // Wipe bot profiles
  const userData = app.getPath("userData");
  try {
    const legacy = path.join(userData, "bot-profile");
    if (fs.existsSync(legacy)) fs.rmSync(legacy, { recursive: true, force: true });
  } catch (_) {}
  try {
    fs.readdirSync(userData)
      .filter(f => f.startsWith("bot-profile-"))
      .forEach(f => { try { fs.rmSync(path.join(userData, f), { recursive: true, force: true }); } catch (_) {} });
  } catch (_) {}
  // Notify renderer — it handles navigation to the license screen
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("force-flush");
  }
}

async function _checkLicenseImpl(bustCache) {
  const key = licenseStore.get("licenseKey", "");
  if (!key) return { valid: false, reason: "No license key." };
  if (!bustCache && _licenseCache && (Date.now() - _licenseCacheAt) < LICENSE_CACHE_TTL_MS) return _licenseCache;
  if (bustCache) {
    _licenseCache = null;
    _licenseCacheAt = 0;
    _credCache = null;
    _credCacheAt = 0;
  }

  try {
    const r = await supabaseRpc("khod_check_license_with_identity", {
      p_license_key:    key,
      p_machine_uuid:   _getOrCreateMachineUUID(),
      p_device_id:      getDeviceFingerprint(),
      p_account_idents: _buildAccountIdents(),
    });
    if (!r || !r.valid) {
      if (!r || r.reason === "License not found on server.") {
        log.warn(`[License] Key "${key}" not found on server. Clearing local licenseKey.`);
        licenseStore.delete("licenseKey");
      }
      return { valid: false, reason: r?.reason || "License not found on server." };
    }

    // Handle force flush: wipe local data and notify renderer.
    // Return valid:true here so the IPC caller doesn't also trigger the expired overlay —
    // the renderer navigates to the license screen exclusively via the force-flush event.
    if (r.force_flush) {
      _handleForceFlush();
      return { valid: true, forceFlush: true };
    }

    const daysLeft = r.expires_at ? Math.max(0, Math.ceil((new Date(r.expires_at) - new Date()) / 86400000)) : null;
    const customerName = r.customer_name || null;
    if (customerName) licenseStore.set("customerName", customerName);
    if (daysLeft !== null) licenseStore.set("daysLeft", daysLeft);
    licenseStore.set("allowReset", false);
    if (r.max_accounts) licenseStore.set("maxAccounts", r.max_accounts);
    const operationsSuiteEnabled = r.analytics_enabled !== false || r.operations_enabled !== false;
    licenseStore.set("analyticsEnabled",  operationsSuiteEnabled);
    licenseStore.set("operationsEnabled", operationsSuiteEnabled);
    licenseStore.set("dashboardEnabled",  r.dashboard_enabled  === true);
    const result = {
      valid: true, key, daysLeft, customerName, allowReset: false,
      analyticsEnabled:  operationsSuiteEnabled,
      operationsEnabled: operationsSuiteEnabled,
      dashboardEnabled:  r.dashboard_enabled  === true,
    };
    _licenseCache = result;
    _licenseCacheAt = Date.now();
    _saveLastValidResult(result);
    return result;
  } catch (e) {
    log.warn("[License] License check failed:", e.message);
    const grace = _getOfflineGraceResult();
    if (grace) return grace;
    return { valid: false, reason: "Cannot reach license server. Check your internet connection." };
  }
}

ipcMain.handle("check-license", async () => _checkLicenseImpl(false));
ipcMain.handle("check-license-nocache", async () => _checkLicenseImpl(true));
ipcMain.handle("submit-license", async (_, key) => {
  const clean = key.trim().toUpperCase();
  if (!isValidKeyFormat(clean)) return { success: false, reason: "Invalid format. Keys look like: KHOD-XXXX-XXXX-XXXX-XXXX" };
  try {
    const r = await supabaseRpc("khod_check_license_with_identity", {
      p_license_key:    clean,
      p_machine_uuid:   _getOrCreateMachineUUID(),
      p_device_id:      getDeviceFingerprint(),
      p_account_idents: _buildAccountIdents(),
    });
    if (!r || !r.valid) return { success: false, reason: r?.reason || "License key not found. Contact support." };
    const daysLeft = r.expires_at ? Math.max(0, Math.ceil((new Date(r.expires_at) - new Date()) / 86400000)) : null;
    const customerName = r.customer_name || null;
    licenseStore.set("licenseKey", clean);
    if (customerName) licenseStore.set("customerName", customerName);
    if (daysLeft !== null) licenseStore.set("daysLeft", daysLeft);
    if (r.max_accounts) licenseStore.set("maxAccounts", r.max_accounts);
    const operationsSuiteEnabled = r.analytics_enabled !== false || r.operations_enabled !== false;
    licenseStore.set("analyticsEnabled",  operationsSuiteEnabled);
    licenseStore.set("operationsEnabled", operationsSuiteEnabled);
    licenseStore.set("dashboardEnabled",  r.dashboard_enabled  === true);
    _licenseCache = null;
    _licenseCacheAt = 0;
    return { success: true, daysLeft, customerName };
  } catch {
    return { success: false, reason: "Cannot reach server. Check your internet connection." };
  }
});

// Helper: get max accounts allowed by this license
async function getMaxAccounts() {
  const key = licenseStore.get("licenseKey", "");
  if (!key) return 1;
  try {
    const res = await supabaseRpc("khod_get_max_accounts", { p_license_key: key });
    if (res && res.max_accounts) return res.max_accounts;
  } catch {}
  return licenseStore.get("maxAccounts", 1);
}

// Short-lived in-memory cache for get-credentials — eliminates the duplicate
// Supabase request when init() and afterLicense() both call it within milliseconds.
let _credCache = null;
let _credCacheAt = 0;
const CRED_CACHE_TTL_MS = 15 * 1000; // 15 seconds

ipcMain.handle("get-credentials", async () => {
  // Serve from cache if fresh
  if (_credCache && (Date.now() - _credCacheAt) < CRED_CACHE_TTL_MS) {
    return _credCache;
  }

  const rawAccounts = store.get("accounts", null);
  const maxAccounts = await getMaxAccounts();
  const legacyEmail = store.get("easyEmail", "");
  const accounts = rawAccounts || [];

  // Fetch per-account lock status from license_accounts table
  let lockedHashes = [];
  let unlockedAccountIds = store.get("unlockedAccountIds", []); // admin-unlocked accounts (local cache)
  const licKey = licenseStore.get("licenseKey", "");
  if (licKey) {
    try {
      const rows = await supabaseRpc("khod_get_license_accounts", { p_license_key: licKey });
      if (Array.isArray(rows)) {
        lockedHashes = rows.filter(r => !r.unlocked).map(r => r.account_hash);
        // Update local cache of unlocked accounts
        const serverUnlocked = rows.filter(r => r.unlocked).map(r => r.account_hash);
        unlockedAccountIds = accounts
          .filter(a => serverUnlocked.includes(accountHash(a)))
          .map(a => a.id);
        store.set("unlockedAccountIds", unlockedAccountIds);

        // If DB returned zero rows but local accounts exist with credentials,
        // it means admin used "Clear All Slots" — treat all existing accounts as locked
        // so they can't be edited until admin explicitly unlocks them.
        if (rows.length === 0 && accounts.length > 0) {
          lockedHashes = accounts.map(a => accountHash(a));
          unlockedAccountIds = [];
          store.set("unlockedAccountIds", []);
        }
      }
    } catch {
      // Offline: use local cache
    }
  }

  // Enrich accounts with lock status
  const accountsWithStatus = accounts.map(a => {
    const hash = accountHash(a);
    const isLocked = lockedHashes.includes(hash); // server says locked
    const isUnlocked = unlockedAccountIds.includes(a.id); // admin unlocked
    return { ...a, locked: isLocked && !isUnlocked };
  });

  const result = {
    hasCredentials:   accountsWithStatus.length > 0 || !!legacyEmail,
    accounts:         accountsWithStatus,
    maxAccounts,
    analyticsEnabled:  licenseStore.get("analyticsEnabled",  true),
    operationsEnabled: licenseStore.get("operationsEnabled", true),
    dashboardEnabled:  licenseStore.get("dashboardEnabled",  false),
    easyEmail:        store.get("easyEmail",       ""),
    easyStore:        store.get("easyStore",       ""),
    khodEmail:        store.get("khodEmail",       ""),
    khodCountry:      store.get("khodCountry",     "sa"),
    autoRun:          store.get("autoRun",         false),
    autoRunInterval:  store.get("autoRunInterval", 30),
    autoRunAccountIds: store.get("autoRunAccountIds", []),
    launchMinimized:  store.get("launchMinimized", false),
  };
  _credCache = result;
  _credCacheAt = Date.now();
  return result;
});

// Legacy single-account save (kept for backward compat with any older calls)
ipcMain.handle("save-credentials", async (_, creds) => {
  store.set("easyEmail",    creds.easyEmail    || "");
  store.set("easyPassword", creds.easyPassword || "");
  store.set("easyStore",    creds.easyStore    || "");
  store.set("khodEmail",    creds.khodEmail    || "");
  store.set("khodPassword", creds.khodPassword || "");
  store.set("khodCountry",  creds.khodCountry  || "sa");
  invalidateAnalyticsRunsCache();
  return { success: true };
});

// ── NEW: save full accounts array ──
ipcMain.handle("save-all-accounts", async (_, accounts) => {
  const licKey = licenseStore.get("licenseKey", "");
  const maxAccounts = await getMaxAccounts();

  if (accounts.length > maxAccounts)
    return { success: false, reason: "limit_reached" };

  if (accounts.some(a => !(a.easyStore || "").trim())) {
    return { success: false, reason: "easy_store_required" };
  }

  // ── Per-account lock check via license_accounts table ──
  if (licKey) {
    try {
      const dbRows      = await supabaseRpc("khod_get_license_accounts", { p_license_key: licKey }) || [];
      const dbHashes    = dbRows.map(r => r.account_hash);

      // Build a map of accountId → old hash using the CURRENTLY stored accounts
      // (before we overwrite them). This lets us detect when an edit changed emails.
      const storedAccounts = store.get("accounts", []);
      const oldHashById = {};
      for (const a of storedAccounts) oldHashById[a.id] = accountHash(a);

      const newHashes = accounts.map(a => accountHash(a));

      for (const a of accounts) {
        const newH = accountHash(a);
        const oldH = oldHashById[a.id]; // undefined for brand-new accounts

        // Case 1: hash unchanged — already in DB, nothing to do
        if (newH === oldH) continue;

        // Case 2: this is an edit that changed the email — swap old hash for new hash
        if (oldH && dbHashes.includes(oldH)) {
          // Preserve the unlocked state from the old row
          const oldRow   = dbRows.find(r => r.account_hash === oldH);
          const wasUnlocked = oldRow ? !!oldRow.unlocked : false;
          // Server-side guard: reject the edit if the account is still locked
          if (!wasUnlocked) return { success: false, reason: "account_locked" };
          // Delete old hash row
          await supabaseRpc("khod_delete_license_account", { p_license_key: licKey, p_account_hash: oldH });
          // Insert new hash row (keep unlocked state so admin unlock survives email edits)
          const newAccObj = accounts.find(a => accountHash(a) === newH);
          await supabaseRpc("khod_insert_license_account", {
            p_license_key:  licKey,
            p_account_hash: newH,
            p_easy_email:   (newAccObj?.easyEmail || "").toLowerCase().trim() || null,
            p_khod_email:   (newAccObj?.khodEmail || "").toLowerCase().trim() || null,
            p_unlocked:     wasUnlocked,
          });
          continue;
        }

        // Case 3: genuinely new account — check slot limit then register
        if (!dbHashes.includes(newH)) {
          // Count how many truly new hashes (not in DB and not an edit swap) we're adding
          const alreadyKnownOrSwapped = accounts
            .filter(b => { const bOld = oldHashById[b.id]; return bOld && dbHashes.includes(bOld); })
            .map(b => accountHash(b));
          const genuinelyNew = newHashes.filter(h => !dbHashes.includes(h) && !alreadyKnownOrSwapped.includes(h));
          if (dbHashes.length + genuinelyNew.length > maxAccounts)
            return { success: false, reason: "limit_reached" };
          const newAccForInsert = accounts.find(a => accountHash(a) === newH);
          await supabaseRpc("khod_insert_license_account", {
            p_license_key:  licKey,
            p_account_hash: newH,
            p_easy_email:   (newAccForInsert?.easyEmail || "").toLowerCase().trim() || null,
            p_khod_email:   (newAccForInsert?.khodEmail || "").toLowerCase().trim() || null,
            p_unlocked:     false,
          });
        }
      }

      // Remove hashes for deleted accounts (hashes in DB not present in newHashes and not an old-hash being swapped)
      const swappedOldHashes = accounts
        .map(a => oldHashById[a.id])
        .filter(h => h && dbHashes.includes(h) && !newHashes.includes(h));
      const deletedHashes = dbHashes.filter(h => !newHashes.includes(h) && !swappedOldHashes.includes(h));
      for (const h of deletedHashes) {
        // Server-side guard: never delete a locked account slot — only unlocked ones can be removed
        const row = dbRows.find(r => r.account_hash === h);
        if (row && !row.unlocked) return { success: false, reason: "account_locked" };
        try {
          await supabaseRpc("khod_delete_license_account", { p_license_key: licKey, p_account_hash: h });
        } catch {}
      }
    } catch {
      // Offline: trust local
    }
  }

  // Encrypt passwords in store — store accounts without plaintext passwords, keep passwords separately keyed
  const safeAccounts = accounts.map(a => ({
    id:         a.id,
    memberName: String(a.memberName || "").trim(),
    label:      a.label || a.easyStore || a.easyEmail || a.khodEmail || "",
    easyEmail:  a.easyEmail,
    easyStore:  a.easyStore  || "",
    khodEmail:  a.khodEmail,
    khodAffiliateCode: a.khodAffiliateCode || "",
    khodCountry: a.khodCountry || "sa",
  }));
  store.set("accounts", safeAccounts);

  // Prune local unlockedAccountIds cache — remove IDs that no longer exist
  const remainingIds = accounts.map(a => a.id);
  const savedAutoRunIds = store.get("autoRunAccountIds", []);
  if (Array.isArray(savedAutoRunIds)) {
    store.set("autoRunAccountIds", savedAutoRunIds.filter(id => remainingIds.includes(id)));
  }
  const cachedUnlocked = store.get("unlockedAccountIds", []).filter(id => remainingIds.includes(id));
  store.set("unlockedAccountIds", cachedUnlocked);

  // Store passwords per account id
  for (const a of accounts) {
    if (a.easyPassword) store.set(`pwd_easy_${a.id}`, a.easyPassword);
    if (a.khodPassword) store.set(`pwd_khod_${a.id}`, a.khodPassword);
  }

  // Also update legacy flat fields from first account (for any code still reading them)
  if (accounts[0]) {
    store.set("easyEmail",    accounts[0].easyEmail    || "");
    store.set("easyPassword", accounts[0].easyPassword || store.get(`pwd_easy_${accounts[0].id}`, ""));
    store.set("easyStore",    accounts[0].easyStore    || "");
    store.set("khodEmail",    accounts[0].khodEmail    || "");
    store.set("khodPassword", accounts[0].khodPassword || store.get(`pwd_khod_${accounts[0].id}`, ""));
    store.set("khodCountry",  accounts[0].khodCountry  || "sa");
  }
  // Cache maxAccounts locally
  licenseStore.set("maxAccounts", maxAccounts);
  // Bust credentials cache so next get-credentials reflects the new accounts
  _credCache = null;
  _credCacheAt = 0;
  invalidateAnalyticsRunsCache();
  return { success: true };
});


// ── ADMIN: unlock a single account (called when admin unlocks via panel) ──
// The app polls this on startup — when admin sets unlocked=true in DB,
// unlockedAccountIds is updated locally so UI re-enables edit button.
ipcMain.handle("unlock-single-account", async (_, { accountId }) => {
  return { success: false, reason: "admin_only" };
});

// ── Re-lock after user saves new credentials for an account ──
ipcMain.handle("relock-account", async (_, { accountId }) => {
  const accounts = store.get("accounts", []);
  const acc = accounts.find(a => a.id === accountId);
  if (!acc) return { success: true };
  const licKey = licenseStore.get("licenseKey", "");
  const hash = accountHash(acc);
  if (licKey) {
    try {
      await supabaseRpc("khod_set_license_account_unlocked", {
        p_license_key: licKey,
        p_account_hash: hash,
        p_unlocked: false,
      });
    } catch {}
  }
  const unlocked = store.get("unlockedAccountIds", []).filter(id => id !== accountId);
  store.set("unlockedAccountIds", unlocked);
  return { success: true };
});

function bindKhodAffiliateCode(accountId, code) {
  const cleanCode = String(code || "").trim();
  if (!accountId || !cleanCode || accountId === "__single__" || accountId === "legacy") return;
  const accounts = store.get("accounts", []) || [];
  const idx = accounts.findIndex(a => a.id === accountId);
  if (idx < 0) return;
  const current = String(accounts[idx].khodAffiliateCode || "").trim();
  if (current && current === cleanCode) return;
  if (current && current !== cleanCode) return;
  accounts[idx] = { ...accounts[idx], khodAffiliateCode: cleanCode };
  store.set("accounts", accounts);
  _credCache = null;
  _credCacheAt = 0;
}
ipcMain.handle("get-settings", () => ({
  theme: store.get("theme", "dark"),
  lang:  store.get("lang",  "ar"),
}));
ipcMain.handle("save-settings", (_, { theme, lang }) => {
  if (theme !== undefined) store.set("theme", theme);
  if (lang  !== undefined) store.set("lang",  lang);
  return true;
});

ipcMain.handle("open-folder", (_, p) => { shell.openPath(p); return true; });
ipcMain.handle("set-auto-run", (_, v) => { autoRunEnabled = v; store.set("autoRun", v); if (v) scheduleAutoRun(); else clearAutoRun(); return true; });
ipcMain.handle("set-auto-run-interval", (_, m) => { store.set("autoRunInterval", m); if (autoRunEnabled) scheduleAutoRun(); return true; });
ipcMain.handle("set-auto-run-accounts", (_, ids) => {
  const accounts = store.get("accounts", []) || [];
  const validIds = accounts.map(a => a.id);
  const selected = Array.isArray(ids) ? ids.filter(id => validIds.includes(id)) : [];
  store.set("autoRunAccountIds", selected);
  return selected;
});
ipcMain.handle("get-auto-run-progress", () => getAutoRunProgress());
ipcMain.handle("set-launch-minimized", (_, v) => { store.set("launchMinimized", v); return true; });

let currentBotChild = null;
ipcMain.on("bot-started", () => { botRunning = true; if (store.get("launchMinimized") && store.get("autoRun")) mainWindow.minimize(); });
ipcMain.on("bot-finished", () => { botRunning = false; currentBotChild = null; botChildren = []; });
ipcMain.on("kill-bot", () => {
  const toKill = botChildren.length ? botChildren : (currentBotChild ? [currentBotChild] : []);
  for (const child of toKill) { try { child.kill("SIGKILL"); } catch {} }
  currentBotChild = null; botChildren = []; botRunning = false;
});

// ── Analytics IPC Handlers ─────────────────────────────────────────────────

ipcMain.handle("save-run-analytics", async (_, payload) => {
  try {
    // Extract khodSnapshot before storing (don't persist it — it's only for enrichment)
    const { khodSnapshot, khodDashboardSnapshot, buffer, ...rawRunData } = payload;
    if ((!Array.isArray(rawRunData.orders) || rawRunData.orders.length === 0) && buffer) {
      rawRunData.orders = parseOrderRowsFromOutputBuffer(buffer);
    }
    const runData = normalizeAnalyticsRun(rawRunData);

    const dashboardRowsSaved = licenseStore.get("dashboardEnabled", false) === true
      ? saveDashboardSnapshotRows(runData.accountId, khodDashboardSnapshot, "bot-run")
      : 0;
    const runs = analyticsStore.get("runs", []);
    const alreadyExists = runs.some(r => r.runId === runData.runId);
    if (alreadyExists) return { ok: true, duplicate: true, dashboardRowsSaved };

    // ── Enrichment pass: update previous stored runs with current Khod statuses ──
    // On every new bot run, we get a fresh Khod export. Any order from a previous run
    // whose phone+SKU now appears in the Khod sheet gets its status/amounts updated.
    // This is how "Under processing" → "Delivered" / "Failed" transitions happen.
    let enrichedCount = 0;
    const khodRows = normalizeKhodSnapshotEntries(khodSnapshot?.entries);
    if (khodRows.length) {
      const currentRunMerge = enrichOrdersFromKhodRows(runData.orders, khodRows);
      runData.orders = currentRunMerge.orders;
      enrichedCount += currentRunMerge.changed;

      for (const run of runs) {
        if (runData.accountId && run.accountId && run.accountId !== runData.accountId) continue;
        if (!Array.isArray(run.orders)) continue;
        const merged = enrichOrdersFromKhodRows(run.orders, khodRows);
        if (merged.changed > 0) {
          run.orders = merged.orders;
          enrichedCount += merged.changed;
        }
      }
    }

    runs.push(runData);
    analyticsStore.set("runs", runs);
    invalidateAnalyticsRunsCache();
    return { ok: true, enrichedCount, dashboardRowsSaved };
  } catch (err) {
    console.error("[Analytics] save-run-analytics error:", err.message);
    monitoring.captureException(err, { operation: "analytics.saveRun", extra: { runId: payload && payload.runId } });
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("get-analytics-runs", async (_, { dateFrom, dateTo, accountId } = {}) => {
  try {
    syncAnalyticsFromDashboardSnapshots();
    if (!analyticsRunsCache || analyticsRunsCacheDirty) {
      const storedRuns = analyticsStore.get("runs", []);
      const accountsById = getStoredAccountsMap();
      let dirty = false;
      analyticsRunsCache = storedRuns.map(run => {
        const n = normalizeAnalyticsRun(run, accountsById);
        if (n.accountId !== run.accountId || n.accountEmail !== run.accountEmail || n.accountLabel !== run.accountLabel) dirty = true;
        return n;
      });
      analyticsRunsCacheDirty = false;
      if (dirty) analyticsStore.set("runs", analyticsRunsCache);
    }
    let runs = analyticsRunsCache;
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      runs = runs.filter(r => r.runTimestamp >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + (86400000 - 1);
      runs = runs.filter(r => r.runTimestamp <= to);
    }
    if (accountId && accountId !== "__all__") {
      runs = runs.filter(r => r.accountId === accountId || r.accountEmail === accountId);
    }
    return { ok: true, runs };
  } catch (err) {
    monitoring.captureException(err, { operation: "analytics.getRuns" });
    return { ok: false, runs: [], error: err.message };
  }
});

ipcMain.handle("clear-analytics-data", async () => {
  try {
    analyticsStore.set("runs", []);
    invalidateAnalyticsRunsCache();
    return { ok: true };
  } catch (err) {
    monitoring.captureException(err, { operation: "analytics.clear" });
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("get-analytics-settings", async () => ({
  minutesPerOrder: store.get("analyticsMinutesPerOrder", 5),
  purgeDays:       store.get("analyticsPurgeDays",       30),
  defaultDate:     store.get("analyticsDefaultDate",     "today"),
  defaultAccount:  store.get("analyticsDefaultAccount",  ""),
  showMissed:      store.get("analyticsShowMissed",      true),
  showInsights:    store.get("analyticsShowInsights",    true),
}));

ipcMain.handle("save-analytics-settings", async (_, { minutesPerOrder, purgeDays, defaultDate, defaultAccount, showMissed, showInsights }) => {
  if (minutesPerOrder != null) store.set("analyticsMinutesPerOrder", minutesPerOrder);
  if (purgeDays       != null) store.set("analyticsPurgeDays",       purgeDays);
  if (defaultDate     != null) store.set("analyticsDefaultDate",     defaultDate);
  if (defaultAccount  != null) store.set("analyticsDefaultAccount",  defaultAccount);
  if (showMissed      != null) store.set("analyticsShowMissed",      showMissed);
  if (showInsights    != null) store.set("analyticsShowInsights",    showInsights);
  return { ok: true };
});

// ── Dashboard Fetch — spawn dashboard-fetch.js (Khod-only, no Easy-Orders) ──
ipcMain.handle("run-dashboard-fetch", async (_, { accountId, dateFrom, dateTo } = {}) => {
  if (!(await isLicenseValid())) return { success: false, error: "LICENSE_INVALID" };
  if (!licenseStore.get("dashboardEnabled", false)) return { success: false, error: "DASHBOARD_NOT_ENABLED" };

  const { fork } = require("child_process");
  const allAccounts = store.get("accounts", null);
  const legacyEmail = store.get("easyEmail", "");

  let acc;
  if (allAccounts && allAccounts.length > 0) {
    if (accountId) {
      acc = allAccounts.find(a => a.id === accountId);
      if (!acc) return { success: false, error: `Dashboard account not found: ${accountId}` };
    } else {
      acc = allAccounts[0];
    }
  } else {
    acc = {
      easyEmail:    legacyEmail,
      easyPassword: store.get("easyPassword", ""),
      khodEmail:    store.get("khodEmail", ""),
      khodPassword: store.get("khodPassword", ""),
      easyStore:    store.get("easyStore", ""),
    };
  }

  if (!acc) return { success: false, error: "No account found" };

  const userData = app.getPath("userData");
  const dashboardAccountId = accountId || acc.id || "__single__";
  const khodEmail = acc.khodEmail || store.get("khodEmail", "");
  const khodPassword = acc.khodPassword || (acc.id ? store.get(`pwd_khod_${acc.id}`, "") : "") || store.get("khodPassword", "");
  if (!khodEmail || !khodPassword) {
    const label = accountDisplayName(acc, dashboardAccountId);
    return { success: false, error: `Khod credentials missing for ${label}. Re-save this account, then retry dashboard update.` };
  }
  const profilePath = path.join(userData, `bot-profile${acc.id ? `-${acc.id}` : ""}`);
  if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });

  const creds = {
    ...acc,
    profilePath,
    launchMinimized: store.get("launchMinimized", false),
    khodEmail,
    khodPassword,
    dashboardDateFrom: dateFrom || "",
    dashboardDateTo: dateTo || "",
    chromePath: getCachedChromePath() || undefined,
  };

  return new Promise((resolve) => {
    const child = fork(path.join(__dirname, "../bot/dashboard-fetch.js"), [], {
      env: { ...process.env, BOT_CONFIG: JSON.stringify(creds) },
      silent: true,
      execArgv: ["--max-old-space-size=256"],
    });

    const accountLabel = accountDisplayName(acc, dashboardAccountId);

    child.stdout.on("data", (d) => {
      const text = d.toString();
      mainWindow.webContents.send("bot-log", `[Dashboard:${accountLabel}] ${text}`);
    });
    child.stderr.on("data", (d) => {
      mainWindow.webContents.send("bot-log", `[Dashboard:${accountLabel}][ERR] ` + d.toString());
    });

    let resolved = false;
    const safeResolve = (v) => { if (!resolved) { resolved = true; resolve(v); } };

    child.on("message", async (msg) => {
      if (msg.type === "dashboard-result") {
        // Save snapshot to dashboardStore
        const rows = msg.rows || [];
        try {
          const accounts = dashboardStore.get("accounts", {});
          if (!accounts[dashboardAccountId]) accounts[dashboardAccountId] = {};
          const rangeFrom = msg.dateFrom || dateFrom || "";
          const rangeTo = msg.dateTo || dateTo || "";
          const mergedRows = replaceDashboardRowsInRange(accounts[dashboardAccountId].snapshot, rows, rangeFrom, rangeTo);
          accounts[dashboardAccountId].snapshot      = mergedRows;
          accounts[dashboardAccountId].snapshotMonth = msg.snapshotMonth || "";
          accounts[dashboardAccountId].lastFetchRange = { dateFrom: rangeFrom, dateTo: rangeTo, rows: rows.length };
          accounts[dashboardAccountId].autoFetchTimestamp = Date.now();
          dashboardStore.set("accounts", accounts);
          enrichAnalyticsRunsFromKhodRows(dashboardAccountId, rows);
        } catch (e) {
          console.error("[Dashboard] Failed to save snapshot:", e.message);
          monitoring.captureException(e, { operation: "dashboard.fetch.saveSnapshot", extra: { accountId: dashboardAccountId } });
        }
        safeResolve({ success: true, rows: rows.length, snapshotMonth: msg.snapshotMonth });
      } else if (msg.type === "error") {
        safeResolve({ success: false, error: msg.error });
      } else if (msg.type === "export-timestamp") {
        lastExportTimestamp = msg.timestamp || Date.now();
      } else if (msg.type === "khod-restart") {
        mainWindow.webContents.send("bot-log", `[Dashboard:${accountLabel}] Restarting export after ${msg.waitSeconds}s. Reason: ${msg.reason || "export retry"}`);
        mainWindow.webContents.send("bot-khod-restart", { ...msg, accountId: dashboardAccountId, accountLabel });
      } else if (msg.type === "cooldown") {
        mainWindow.webContents.send("bot-log", `[Dashboard:${accountLabel}] Waiting for Khod export file. Attempt ${msg.attempt}/${msg.maxAttempts}.`);
        mainWindow.webContents.send("bot-cooldown", { ...msg, accountId: dashboardAccountId, accountLabel });
      } else if (msg.type === "session-event") {
        if (msg.site === "khod" && msg.event === "identity-verified") {
          bindKhodAffiliateCode(dashboardAccountId, msg.affiliateCode);
        }
        mainWindow.webContents.send("bot-session-event", { ...msg, accountId: dashboardAccountId, accountLabel });
      }
    });

    child.on("error", (err) => {
      monitoring.captureException(err, { operation: "dashboard.fetch.childProcess", extra: { accountId: dashboardAccountId } });
      safeResolve({ success: false, error: err.message });
    });
    child.on("exit", (code) => {
      if (!resolved) safeResolve({ success: false, error: `Process exited with code ${code}` });
    });
  });
});

// ── Dashboard IPC Handlers ─────────────────────────────────────────────────

ipcMain.handle("save-dashboard-snapshot", async (_, accountId, data) => {
  try {
    const rows = data.snapshot || [];
    const accounts = dashboardStore.get("accounts", {});
    if (!accounts[accountId]) accounts[accountId] = {};
    const rangeFrom = data.dateFrom || "";
    const rangeTo = data.dateTo || "";
    accounts[accountId].snapshot          = replaceDashboardRowsInRange(accounts[accountId].snapshot, rows, rangeFrom, rangeTo);
    accounts[accountId].snapshotMonth     = data.snapshotMonth     || "";
    accounts[accountId].lastFetchRange    = { dateFrom: rangeFrom, dateTo: rangeTo, rows: rows.length };
    accounts[accountId].manualFetchTimestamp = Date.now();
    dashboardStore.set("accounts", accounts);
    analyticsSnapshotSyncCacheKey = "";
    const enriched = enrichAnalyticsRunsFromKhodRows(accountId, rows);
    return { ok: true, enriched };
  } catch (err) {
    console.error("[Dashboard] save-dashboard-snapshot error:", err.message);
    monitoring.captureException(err, { operation: "dashboard.saveSnapshot", extra: { accountId } });
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("get-dashboard-snapshot", async (_, accountId) => {
  try {
    const accounts = dashboardStore.get("accounts", {});
    if (accountId && accountId !== "__all__") {
      return { ok: true, data: accounts[accountId] || null };
    }
    const allowedIds = (store.get("accounts", []) || []).map((account) => account && account.id).filter(Boolean);
    if (allowedIds.length) {
      const filtered = {};
      allowedIds.forEach((id) => {
        if (accounts[id]) filtered[id] = accounts[id];
      });
      return { ok: true, data: filtered };
    }
    // Return all accounts
    return { ok: true, data: accounts };
  } catch (err) {
    monitoring.captureException(err, { operation: "dashboard.getSnapshot", extra: { accountId } });
    return { ok: false, data: null, error: err.message };
  }
});

ipcMain.handle("get-dashboard-auto-ts", async (_, accountId) => {
  try {
    const accounts = dashboardStore.get("accounts", {});
    const ts = accounts[accountId]?.autoFetchTimestamp || null;
    return { ok: true, ts };
  } catch (err) {
    monitoring.captureException(err, { operation: "dashboard.getAutoTimestamp", extra: { accountId } });
    return { ok: false, ts: null, error: err.message };
  }
});

ipcMain.handle("set-dashboard-auto-ts", async (_, accountId, ts) => {
  try {
    const accounts = dashboardStore.get("accounts", {});
    if (!accounts[accountId]) accounts[accountId] = {};
    accounts[accountId].autoFetchTimestamp = ts;
    dashboardStore.set("accounts", accounts);
    return { ok: true };
  } catch (err) {
    monitoring.captureException(err, { operation: "dashboard.setAutoTimestamp", extra: { accountId } });
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("clear-dashboard-data", async () => {
  try {
    dashboardStore.set("accounts", {});
    analyticsSnapshotSyncCacheKey = "";
    return { ok: true };
  } catch (err) {
    monitoring.captureException(err, { operation: "dashboard.clear" });
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("get-dashboard-enabled", async () => {
  return licenseStore.get("dashboardEnabled", false);
});

function marketingAccountKey(accountId, allowAll = false) {
  const clean = String(accountId || "").trim();
  return clean && (allowAll || clean !== "__all__") ? clean : "";
}

function marketingStableAccountKey(accountId) {
  const clean = String(accountId || "").trim();
  if (!clean || clean === "__all__") return clean;
  const account = getStoredAccountById(clean);
  const stable = account && (account.khodEmail || account.easyEmail || account.label || "");
  return String(stable || clean).trim().toLowerCase();
}

function marketingAccountLookupKeys(accountId) {
  const clean = String(accountId || "").trim();
  const account = getStoredAccountById(clean);
  const values = [
    clean,
    account && account.khodEmail,
    account && account.easyEmail,
    account && account.email,
    account && account.label,
    account && account.name,
    account && account.memberName,
    accountDisplayName(account, ""),
  ];
  const keys = [];
  values.forEach((value) => {
    const key = String(value || "").trim().toLowerCase();
    if (key && !keys.includes(key)) keys.push(key);
  });
  return keys;
}

function normalizeMarketingAccountSettings(settings = []) {
  const supplied = Array.isArray(settings) ? settings : [];
  const suppliedById = new Map();
  supplied.forEach((setting) => {
    const id = String(setting && setting.dashboardAccountId || "").trim();
    if (id) suppliedById.set(id, setting);
  });
  const accounts = store.get("accounts", []) || [];
  const base = accounts
    .map((account) => String(account && account.id || "").trim())
    .filter((id) => id && id !== "__all__");
  supplied.forEach((setting) => {
    const id = String(setting && setting.dashboardAccountId || "").trim();
    if (id && id !== "__all__" && !base.includes(id)) base.push(id);
  });
  return base.map((id) => {
    const setting = suppliedById.get(id) || {};
    const lookupKeys = marketingAccountLookupKeys(id);
    const explicitKeys = Array.isArray(setting.dashboardAccountKeys)
      ? setting.dashboardAccountKeys.map((key) => String(key || "").trim().toLowerCase()).filter(Boolean)
      : [];
    const allKeys = [...new Set([...(explicitKeys || []), ...lookupKeys])];
    return {
      ...setting,
      dashboardAccountId: id,
      dashboardAccountKey: String(setting.dashboardAccountKey || marketingStableAccountKey(id) || id).trim().toLowerCase(),
      dashboardAccountKeys: allKeys,
      currency: setting.currency || "SAR",
      egpRate: Number(setting.egpRate) || 52,
    };
  });
}

function getCachedMarketingStatus(accountId, platform) {
  const accounts = dashboardStore.get("accounts", {});
  if (accountId === "__all__") {
    const individualStatuses = Object.keys(accounts)
      .filter((id) => id !== "__all__" && id !== "__connection__")
      .map((id) => accounts[id]?.marketing?.[platform])
      .filter(Boolean);

    if (individualStatuses.length === 0) return null;

    const connectedStatuses = individualStatuses.filter((s) => s.status === "connected");
    if (connectedStatuses.length === 0) {
      return {
        platform,
        status: "disconnected",
        lastSyncAt: null,
        summary: null,
        linkedAccounts: [],
        mappings: {},
      };
    }

    const allSummary = connectedStatuses.reduce((summary, s) => {
      const source = s.summary || {};
      summary.adSpend += Number(source.adSpend || 0);
      summary.impressions += Number(source.impressions || 0);
      summary.clicks += Number(source.clicks || 0);
      summary.campaignCount += Number(source.campaignCount || 0);
      summary.rowCount += Number(source.rowCount || 0);
      summary.sourceBreakdown = summary.sourceBreakdown.concat(Array.isArray(source.sourceBreakdown) ? source.sourceBreakdown : []);
      summary.campaignBreakdown = summary.campaignBreakdown.concat(Array.isArray(source.campaignBreakdown) ? source.campaignBreakdown : []);
      return summary;
    }, {
      adSpend: 0,
      currency: "SAR",
      impressions: 0,
      clicks: 0,
      campaignCount: 0,
      rowCount: 0,
      dateFrom: "",
      dateTo: "",
      sourceBreakdown: [],
      campaignBreakdown: [],
    });

    allSummary.adSpend = Number(allSummary.adSpend.toFixed(2));

    let latestSyncAt = null;
    let minDateFrom = "";
    let maxDateTo = "";
    connectedStatuses.forEach((s) => {
      if (s.lastSyncAt) {
        if (!latestSyncAt || new Date(s.lastSyncAt) > new Date(latestSyncAt)) {
          latestSyncAt = s.lastSyncAt;
        }
      }
      const source = s.summary || {};
      if (source.dateFrom) {
        if (!minDateFrom || new Date(source.dateFrom) < new Date(minDateFrom)) {
          minDateFrom = source.dateFrom;
        }
      }
      if (source.dateTo) {
        if (!maxDateTo || new Date(source.dateTo) > new Date(maxDateTo)) {
          maxDateTo = source.dateTo;
        }
      }
    });

    allSummary.dateFrom = minDateFrom;
    allSummary.dateTo = maxDateTo;

    const linkedAccountsMap = new Map();
    const combinedMappings = {};
    individualStatuses.forEach((s) => {
      if (Array.isArray(s.linkedAccounts)) {
        s.linkedAccounts.forEach((acc) => {
          if (acc && acc.id) linkedAccountsMap.set(acc.id, acc);
        });
      }
      if (s.mappings) {
        Object.assign(combinedMappings, s.mappings);
      }
    });

    return {
      platform,
      status: "connected",
      lastSyncAt: latestSyncAt,
      summary: allSummary,
      sourceAccountName: `${connectedStatuses.length} synced accounts`,
      sourceAccountId: "",
      linkedAccounts: Array.from(linkedAccountsMap.values()),
      mappings: combinedMappings,
    };
  }

  const account = accounts[accountId] || {};
  const marketing = account.marketing || {};
  return marketing[platform] || null;
}

function saveCachedMarketingStatus(accountId, platform, status) {
  if (!accountId || !status) return;
  const accounts = dashboardStore.get("accounts", {});
  if (!accounts[accountId]) accounts[accountId] = {};
  if (!accounts[accountId].marketing) accounts[accountId].marketing = {};
  accounts[accountId].marketing[platform] = {
    platform,
    status: status.status || "disconnected",
    lastSyncAt: status.lastSyncAt || null,
    summary: status.summary || null,
    sourceAccountName: status.sourceAccountName || "",
    sourceAccountId: status.sourceAccountId || "",
    linkedAccounts: Array.isArray(status.linkedAccounts) ? status.linkedAccounts : [],
    diagnostics: status.diagnostics || null,
    reconnectRequired: !!status.reconnectRequired,
    error: status.error || "",
    limit: status.limit || null,
    limits: status.limits || null,
    mappings: status.mappings || {},
  };
  dashboardStore.set("accounts", accounts);
}

async function callMarketingBackend(action, accountId, platform, range) {
  const dashboardAccountId = marketingAccountKey(accountId, action !== "sync");
  if (!dashboardAccountId) return { ok: false, error: "SELECT_SINGLE_ACCOUNT" };
  if (!["tiktok", "snapchat", "facebook"].includes(platform)) return { ok: false, error: "PLATFORM_NOT_AVAILABLE" };
  if (!(await isLicenseValid())) return { ok: false, error: "LICENSE_INVALID" };

  const licenseKey = licenseStore.get("licenseKey", "");
  const account = getStoredAccountById(dashboardAccountId);
  const dashboardAccountKey = marketingStableAccountKey(dashboardAccountId);
  const accountSettings = range && Array.isArray(range.accountSettings)
    ? range.accountSettings
    : (action === "status" && dashboardAccountId === "__all__" ? normalizeMarketingAccountSettings([]) : []);
  const result = await supabaseFunctionRequest("windsor-marketing", {
    action,
    platform,
    dashboardAccountId,
    dashboardAccountKey,
    dashboardAccountLabel: accountDisplayName(account, dashboardAccountId),
    sourceAccountId: range && range.sourceAccountId ? range.sourceAccountId : "",
    sourceAccountIds: range && Array.isArray(range.sourceAccountIds) ? range.sourceAccountIds : [],
    sourceAccounts: range && Array.isArray(range.sourceAccounts) ? range.sourceAccounts : [],
    mappings: range && Array.isArray(range.mappings) ? range.mappings : [],
    targetCurrency: range && range.targetCurrency ? range.targetCurrency : "",
    egpRate: range && range.egpRate ? range.egpRate : null,
    accountSettings,
    dateFrom: range && range.dateFrom ? range.dateFrom : "",
    dateTo: range && range.dateTo ? range.dateTo : "",
    identity: {
      licenseKey,
      machineUuid: _getOrCreateMachineUUID(),
      deviceId: getDeviceFingerprint(),
      accountIdents: _buildAccountIdents(),
    },
  });
  return result;
}

ipcMain.handle("get-marketing-status", async (_, accountId, platform = "tiktok") => {
  const dashboardAccountId = marketingAccountKey(accountId, true);
  if (!dashboardAccountId) return { ok: false, error: "SELECT_ACCOUNT" };
  try {
    const result = await callMarketingBackend("status", dashboardAccountId, platform);
    if (result && result.ok) {
      saveCachedMarketingStatus(dashboardAccountId, platform, result);
    } else if (result && result.reconnectRequired) {
      return result;
    } else {
      const cached = getCachedMarketingStatus(dashboardAccountId, platform);
      if (cached) return { ok: true, ...cached, offline: true, error: result && result.error || "STATUS_UNAVAILABLE" };
    }
    return result;
  } catch (error) {
    monitoring.captureException(error, { operation: "marketing.status", extra: { platform } });
    const cached = getCachedMarketingStatus(dashboardAccountId, platform);
    if (cached) return { ok: true, ...cached, offline: true, error: error.message };
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("connect-marketing-platform", async (_, accountId, platform = "tiktok") => {
  try {
    return await callMarketingBackend("connect", accountId, platform);
  } catch (error) {
    monitoring.captureException(error, { operation: "marketing.connect", extra: { platform } });
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("save-marketing-mapping", async (_, accountId, platform = "tiktok", sourceAccountIds = []) => {
  const dashboardAccountId = marketingAccountKey(accountId);
  if (!dashboardAccountId) return { ok: false, error: "SELECT_ACCOUNT_TO_MAP" };
  try {
    const sourceAccounts = Array.isArray(sourceAccountIds) ? sourceAccountIds.map((source) =>
      typeof source === "string" ? { id: source } : source) : [];
    const result = await callMarketingBackend("save_mapping", dashboardAccountId, platform, { sourceAccounts });
    if (result && result.ok) saveCachedMarketingStatus(dashboardAccountId, platform, result);
    return result;
  } catch (error) {
    monitoring.captureException(error, { operation: "marketing.saveMapping", extra: { platform } });
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("save-all-marketing-mappings", async (_, platform = "tiktok", mappings = []) => {
  try {
    return await callMarketingBackend("save_mappings", "__all__", platform, { mappings });
  } catch (error) {
    monitoring.captureException(error, { operation: "marketing.saveAllMappings", extra: { platform } });
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("sync-marketing-data", async (_, accountId, platform = "tiktok", range = {}) => {
  const dashboardAccountId = marketingAccountKey(accountId);
  if (!dashboardAccountId) return { ok: false, error: "SELECT_SINGLE_ACCOUNT" };
  try {
    const result = await callMarketingBackend("sync", dashboardAccountId, platform, range);
    if (result && result.ok) saveCachedMarketingStatus(dashboardAccountId, platform, result);
    else if (result && result.reconnectRequired) return result;
    else {
      const cached = getCachedMarketingStatus(dashboardAccountId, platform);
      if (cached) return { ok: false, ...cached, error: result && result.error || "SYNC_FAILED" };
    }
    return result;
  } catch (error) {
    monitoring.captureException(error, { operation: "marketing.sync", extra: { platform } });
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("sync-all-marketing-data", async (_, platform = "tiktok", range = {}) => {
  try {
    const result = await callMarketingBackend("sync_all", "__all__", platform, {
      ...(range || {}),
      accountSettings: normalizeMarketingAccountSettings(range && range.accountSettings),
    });
    if (result && result.ok && result.accountStatuses) {
      Object.keys(result.accountStatuses).forEach((accountId) => {
        saveCachedMarketingStatus(accountId, platform, result.accountStatuses[accountId]);
      });
      saveCachedMarketingStatus("__all__", platform, result);
    }
    return result;
  } catch (error) {
    monitoring.captureException(error, { operation: "marketing.syncAll", extra: { platform } });
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("open-external-url", async (_, externalUrl) => {
  try {
    const parsed = new URL(String(externalUrl || ""));
    if (parsed.protocol !== "https:" || parsed.hostname !== "onboard.windsor.ai") {
      return { ok: false, error: "URL_NOT_ALLOWED" };
    }
    await shell.openExternal(parsed.toString());
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("dashboard-ai-query", async (_, payload) => {
  // [KHOD AI DEBUG] ────────────────────────────────────────────────
  const _cmd = payload && payload.command ? String(payload.command).slice(0, 80) : "(no command)";
  const _ctxBytes = payload && payload.context ? Buffer.byteLength(JSON.stringify(payload.context), "utf8") : 0;
  const aiService = getDashboardAiService();
  // ─────────────────────────────────────────────────────────────────
  try {
    const validation = aiService.validateDashboardAiPayload(payload || {});
    if (!validation.ok) {
      return {
        message: validation.message || "Invalid AI request.",
        insights: [],
        recommendations: [],
        forecasts: [],
        alerts: [],
        actions: [],
        meta: { source: "local-guard", blocked: true, code: validation.code },
      };
    }
    const _result = await aiService.askDashboardAi(payload || {});
    return _result;
  } catch (err) {
    monitoring.captureException(err, { operation: "dashboard.aiQuery", extra: { command: _cmd, contextBytes: _ctxBytes } });
    return {
      message: "AI service failed.",
      insights: [err && err.message ? err.message : String(err)],
      actions: [],
    };
  }
});

ipcMain.handle("get-ai-admin-analytics", async () => {
  return getDashboardAiService().getAiAdminAnalytics();
});

ipcMain.handle("debug-gemini-ping", async () => {
  return getDashboardAiService().debugGeminiPing();
});

// ───────────────────────────────────────────────────────────────────────────

if (!app.isPackaged || process.env.SENTRY_ENABLE_TESTS === "1") {
  ipcMain.handle("sentry-test-main-error", async () => {
    throw new Error("SENTRY_TEST_MAIN_ERROR");
  });
  ipcMain.handle("sentry-test-async-rejection", async () => {
    await Promise.reject(new Error("SENTRY_TEST_MAIN_ASYNC_REJECTION"));
  });
}

ipcMain.handle("clear-all-data", () => {
  store.clear(); clearAutoRun();
  // licenseStore NOT cleared — device lock and key survive reset
  // Clear all bot profiles (single legacy + all per-account profiles)
  const userData = app.getPath("userData");
  const legacy = path.join(userData, "bot-profile");
  if (fs.existsSync(legacy)) fs.rmSync(legacy, { recursive: true, force: true });
  // Also delete any per-account profiles: bot-profile-<id>
  try {
    fs.readdirSync(userData)
      .filter(f => f.startsWith("bot-profile-"))
      .forEach(f => fs.rmSync(path.join(userData, f), { recursive: true, force: true }));
  } catch(e) {}
  return true;
});

// After a successful reset, admin must flip allow_reset back to false so the button re-locks
ipcMain.handle("clear-reset-flag", async () => {
  const key = licenseStore.get("licenseKey", "");
  if (!key) return { success: false };
  try {
    await supabaseRpc("khod_clear_reset_flag", { p_license_key: key });
    licenseStore.set("allowReset", false);
    // Bust cache so next check-license reflects the change
    _licenseCache = null; _licenseCacheAt = 0;
    return { success: true };
  } catch { return { success: false }; }
});
ipcMain.handle("get-profile-path", () => path.join(app.getPath("userData"), "bot-profile"));
ipcMain.handle("save-output-file", async (_, { buffer, filename }) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, { defaultPath: filename, filters: [{ name: "Excel", extensions: ["xlsx"] }] });
  if (filePath) { fs.writeFileSync(filePath, Buffer.from(buffer)); return { saved: true, path: filePath }; }
  return { saved: false };
});

// ════════════════════════════════════════
// IPC — Bot runner (license-gated)
// ════════════════════════════════════════
// ── Helper: spawn one bot child for one account ──
function spawnBotChild(creds) {
  const { fork } = require("child_process");
  const botPath = path.join(__dirname, "../bot/runner.js");
  return fork(botPath, [], {
    env: { ...process.env, BOT_CONFIG: JSON.stringify(creds) },
    silent: true,
    execArgv: ["--max-old-space-size=512"],
  });
}

let botChildren = []; // track all running children

// ── Helper: auto-save failed orders xlsx to %APPDATA%/khod-order-bot/failed-orders/{easyEmail}/ ──
function saveFailedOrdersFile(easyEmail, buffer) {
  try {
    // Sanitise the email so it's safe as a folder name (replace @ and special chars)
    const safeEmail = (easyEmail || "unknown").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
    // Build timestamp: YYYY-MM-DD_HH-MM-SS (local time)
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    // %APPDATA% on Windows; fallback to userData on other platforms
    const appdata = process.env.APPDATA || app.getPath("userData");
    const dir = path.join(appdata, "khod-order-bot", "failed-orders", safeEmail);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `failed-${ts}.xlsx`);
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return { dir, filePath };
  } catch (e) {
    console.error("[saveFailedOrdersFile] error:", e.message);
    return { dir: "", filePath: "" };
  }
}

ipcMain.handle("run-bot", async (_, { dateFrom, dateTo, accountIds }) => {
  if (!(await isLicenseValid())) return { success: false, error: "LICENSE_INVALID" };
  const operationsSuiteEnabled = isOperationsSuiteEnabled();
  const dashboardEnabled = licenseStore.get("dashboardEnabled", false) === true;

  // Reset export timestamp so the staggered-launch cooldown timer starts fresh
  // for this run (a stale value from a previous run would cause waitForExportCooldown
  // Phase 1 to skip the "wait for export" guard immediately).
  lastExportTimestamp = 0;

  // ── Build account list to run ──
  const allAccounts = store.get("accounts", null);
  let accountsToRun = [];

  if (allAccounts && allAccounts.length > 0) {
    // Multi-account: filter by selected ids (if provided), else run all
    const selected = Array.isArray(accountIds) && accountIds.length > 0 ? accountIds : allAccounts.map(a => a.id);
    accountsToRun = allAccounts
      .filter(a => selected.includes(a.id))
      .map(a => ({
        ...a,
        easyPassword: store.get(`pwd_easy_${a.id}`, ""),
        khodPassword: store.get(`pwd_khod_${a.id}`, ""),
      }));
  }

  // Fallback to legacy single-account
  if (accountsToRun.length === 0) {
    accountsToRun = [{
      id: "legacy",
      label: "Account 1",
      easyEmail:    store.get("easyEmail",    ""),
      easyPassword: store.get("easyPassword", ""),
      easyStore:    store.get("easyStore",    ""),
      khodEmail:    store.get("khodEmail",    ""),
      khodPassword: store.get("khodPassword", ""),
      khodCountry:  store.get("khodCountry",  "sa"),
    }];
  }

  // ── Single account: original flow ──
  if (accountsToRun.length === 1) {
    const acc = accountsToRun[0];
    const profilePath = path.join(app.getPath("userData"), `bot-profile-${acc.id}`);
    if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });

    const creds = {
      ...acc,
      profilePath,
      dateFrom,
      dateTo,
      launchMinimized: store.get("launchMinimized", false),
      needsSnapshot: false,
      operationsSuiteEnabled,
      dashboardEnabled,
    };
    return new Promise((resolve) => {
      const runStartedAt = Date.now();
      const finishTiming = () => {
        const runEndedAt = Date.now();
        return { runStartedAt, runEndedAt, runtimeMs: Math.max(0, runEndedAt - runStartedAt) };
      };
      const child = spawnBotChild(creds);
      currentBotChild = child;
      botChildren = [child];
      const logs = []; let resolved = false;
      const safeResolve = (v) => { if (!resolved) { resolved = true; resolve(v); } };
      child.stdout.on("data", (d) => { const m = d.toString().trim(); if (m) { logs.push(m); mainWindow.webContents.send("bot-log", m); } });
      child.stderr.on("data", (d) => {
        const m = d.toString().trim(); if (!m) return;
        if (m.includes("CHROME_NOT_FOUND")) {
          mainWindow.webContents.send("bot-log", "❌ Google Chrome غير مثبت على جهازك.");
          mainWindow.webContents.send("bot-log", "👉 حمّل Chrome من: https://www.google.com/chrome");
          mainWindow.webContents.send("bot-log", "✅ بعد التثبيت افتح البرنامج من جديد.");
        } else { mainWindow.webContents.send("bot-log", "ERR: " + m); }
      });
      child.on("message", (msg) => {
        if (msg.type === "result") {
          // Auto-save failed orders to per-email folder before resolving
          const data = msg.data || {};
          if (data.failedOrders?.buffer && data.failedOrders.buffer.length > 0) {
            const email = acc.easyEmail || "unknown";
            const { dir, filePath } = saveFailedOrdersFile(email, data.failedOrders.buffer);
            data.failedOrders.failedDir  = dir;
            data.failedOrders.failedPath = filePath;
          }
          mainWindow.webContents.send("bot-run-complete");
          safeResolve({
            success: true,
            data,
            ...finishTiming(),
            accountId: acc.id || "__single__",
            accountEmail: acc.easyEmail || "",
            accountLabel: accountDisplayName(acc, "Account 1"),
          });
        }
        if (msg.type === "error") {
          mainWindow.webContents.send("bot-run-complete");
          safeResolve({
            success: false,
            error: msg.error,
            ...finishTiming(),
            accountId: acc.id || "__single__",
            accountEmail: acc.easyEmail || "",
            accountLabel: accountDisplayName(acc, "Account 1"),
          });
        }
        if (msg.type === "export-timestamp") {
          lastExportTimestamp = msg.timestamp;
        }
        if (msg.type === "2fa-needed")     mainWindow.webContents.send("bot-2fa-needed");
        if (msg.type === "needs-confirm")  mainWindow.webContents.send("bot-needs-confirm");
        if (msg.type === "cooldown")       mainWindow.webContents.send("bot-cooldown", msg);
        if (msg.type === "preview")        mainWindow.webContents.send("bot-preview", msg);
        if (msg.type === "order-progress") {
          mainWindow.webContents.send("bot-order-progress", {
            ...msg,
            accountId: acc.id || "__single__",
            accountEmail: acc.easyEmail || "",
            accountLabel: accountDisplayName(acc, "Account 1"),
            accountIdx: 0,
            totalAccounts: 1,
          });
        }
        if (msg.type === "khod-restart")   mainWindow.webContents.send("bot-khod-restart", msg);
        if (msg.type === "session-event") {
          if (msg.site === "khod" && msg.event === "identity-verified") {
            bindKhodAffiliateCode(acc.id || "__single__", msg.affiliateCode);
          }
          mainWindow.webContents.send("bot-session-event", msg);
        }
      });
      child.on("error", (err) => {
        monitoring.captureException(err, { operation: "bot.childProcess", extra: { accountId: acc.id || "__single__" } });
        mainWindow.webContents.send("bot-run-complete");
        safeResolve({
          success: false,
          error: err.message,
          logs,
          ...finishTiming(),
          accountId: acc.id || "__single__",
          accountEmail: acc.easyEmail || "",
          accountLabel: accountDisplayName(acc, "Account 1"),
        });
      });
      child.on("exit", (code) => {
        mainWindow.webContents.send("bot-run-complete");
        safeResolve({
          success: code === 0,
          error: code !== 0 ? "Bot exited with code " + code : null,
          logs,
          ...finishTiming(),
          accountId: acc.id || "__single__",
          accountEmail: acc.easyEmail || "",
          accountLabel: accountDisplayName(acc, "Account 1"),
        });
      });
    });
  }

  // Multiple accounts — stagger starts by Easy-Orders export cooldown.
  // The next account can start while the previous account is still uploading orders.
  mainWindow.webContents.send("bot-log",
    `🚀 تشغيل ${accountsToRun.length} حسابات بفاصل أمان بين التصديرات — الحساب التالي يبدأ بعد انتهاء الانتظار...`);

  const accountExportTimestamps = new Array(accountsToRun.length).fill(0);

  function runOneAccount(acc, idx) {
    const profilePath = path.join(app.getPath("userData"), `bot-profile-${acc.id}`);
    if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });
    const creds = {
      ...acc,
      profilePath,
      dateFrom,
      dateTo,
      launchMinimized: store.get("launchMinimized", false),
      needsSnapshot: false,
      operationsSuiteEnabled,
      dashboardEnabled,
    };
    const prefix = `[${accountDisplayName(acc, "Account " + (idx + 1))}] `;

    return new Promise((resolve) => {
      const runStartedAt = Date.now();
      const finishTiming = () => {
        const runEndedAt = Date.now();
        return { runStartedAt, runEndedAt, runtimeMs: Math.max(0, runEndedAt - runStartedAt) };
      };
      const child = spawnBotChild(creds);
      botChildren.push(child);
      currentBotChild = child;
      const logs = [];
      let resolved = false;
      const safeResolve = (v) => { if (!resolved) { resolved = true; resolve(v); } };

      child.stdout.on("data", (d) => {
        const m = d.toString().trim();
        if (m) { logs.push(m); mainWindow.webContents.send("bot-log", prefix + m); }
      });

      child.stderr.on("data", (d) => {
        const m = d.toString().trim();
        if (!m) return;
        if (m.includes("CHROME_NOT_FOUND")) {
          mainWindow.webContents.send("bot-log", prefix + "❌ Google Chrome غير مثبت على جهازك.");
          mainWindow.webContents.send("bot-log", prefix + "👉 حمّل Chrome من: https://www.google.com/chrome");
          mainWindow.webContents.send("bot-log", prefix + "✅ بعد التثبيت افتح البرنامج من جديد.");
        } else {
          mainWindow.webContents.send("bot-log", prefix + "ERR: " + m);
        }
      });

      child.on("message", (msg) => {
        const accountId    = acc.id;
        const accountEmail = acc.easyEmail || "";
        const accountLabel = accountDisplayName(acc, accountEmail || ("Account " + (idx + 1)));

        if (msg.type === "result") {
          const data = msg.data || {};
          if (data.failedOrders?.buffer && data.failedOrders.buffer.length > 0) {
            const email = acc.easyEmail || acc.label || ("account-" + (idx + 1));
            const { dir, filePath } = saveFailedOrdersFile(email, data.failedOrders.buffer);
            data.failedOrders.failedDir  = dir;
            data.failedOrders.failedPath = filePath;
          }
          safeResolve({ success: true, data, ...finishTiming(), accountId, accountEmail, accountLabel });
        }
        if (msg.type === "error") safeResolve({ success: false, error: msg.error, ...finishTiming(), accountId, accountEmail, accountLabel });

        if (msg.type === "export-timestamp") {
          lastExportTimestamp = msg.timestamp;
          accountExportTimestamps[idx] = msg.timestamp;
        }
        const tagged = { ...msg, accountId, accountEmail, accountLabel, accountIdx: idx, totalAccounts: accountsToRun.length };
        if (msg.type === "2fa-needed")     mainWindow.webContents.send("bot-2fa-needed",     tagged);
        if (msg.type === "needs-confirm")  mainWindow.webContents.send("bot-needs-confirm",  tagged);
        if (msg.type === "cooldown")       mainWindow.webContents.send("bot-cooldown",       tagged);
        if (msg.type === "preview")        mainWindow.webContents.send("bot-preview",        tagged);
        if (msg.type === "order-progress") mainWindow.webContents.send("bot-order-progress", tagged);
        if (msg.type === "khod-restart")   mainWindow.webContents.send("bot-khod-restart",   tagged);
        if (msg.type === "session-event") {
          if (msg.site === "khod" && msg.event === "identity-verified") {
            bindKhodAffiliateCode(accountId, msg.affiliateCode);
          }
          mainWindow.webContents.send("bot-session-event", tagged);
        }
      });

      child.on("error", (err) => {
        monitoring.captureException(err, { operation: "bot.childProcess", extra: { accountId: acc.id } });
        safeResolve({
          success: false,
          error: `${prefix}${err.message}`,
          logs,
          ...finishTiming(),
          accountId:    acc.id,
          accountEmail: acc.easyEmail || "",
          accountLabel: accountDisplayName(acc, "Account " + (idx + 1)),
        });
      });

      child.on("exit", (code) => {
        safeResolve({
          success: code === 0,
          error: code !== 0 ? `${prefix}exited with code ${code}` : null,
          logs,
          ...finishTiming(),
          accountId:    acc.id,
          accountEmail: acc.easyEmail || "",
          accountLabel: accountDisplayName(acc, "Account " + (idx + 1)),
        });
      });
    });
  }

  botChildren = [];

  // ── Staggered multi-account launch ──────────────────────────────────────────
  // Each account is launched COOLDOWN_MS after the previous account's export
  // timestamp fires — NOT after the previous account fully finishes.
  //
  // How it works:
  //   1. Launch account[0] immediately.
  //   2. Wait until the previous account's export timestamp is set (the child sends "export-timestamp"
  //      when its Easy-Orders export succeeds), then start the COOLDOWN_MS timer.
  //   3. Once COOLDOWN_MS has elapsed from the export timestamp, launch account[1]
  //      — regardless of whether account[0] is still running.
  //   4. Repeat for every subsequent account.
  //   5. Collect all results once every launched account has finished.
  // ────────────────────────────────────────────────────────────────────────────
  const INTER_ACCOUNT_COOLDOWN_MS = 5 * 60 * 1000 + 30 * 1000; // 5 min 30 s

  // Helper: wait until COOLDOWN_MS has passed since the export timestamp that
  // was recorded when the previous account finished exporting. The timer is
  // anchored to that account's actual export moment, not process start/end.
  async function waitForExportCooldown(previousAccountIndex, nextAccountIndex, previousResultPromise) {
    const previousLabel = accountDisplayName(accountsToRun[previousAccountIndex], `Account ${previousAccountIndex + 1}`);
    const label = `Account ${nextAccountIndex + 1}`;

    // Phase 1 – wait until the previous account has actually exported something
    // (lastExportTimestamp gets set the moment the child reports success).
    mainWindow.webContents.send("bot-log",
      `\n⏳  [${label}] في انتظار تصدير الحساب السابق قبل بدء العد التنازلي...`);

    let previousFinished = false;
    previousResultPromise.finally(() => { previousFinished = true; }).catch(() => {});

    while (botRunning && !accountExportTimestamps[previousAccountIndex] && !previousFinished) {
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!botRunning) return;
    const exportTimestamp = accountExportTimestamps[previousAccountIndex];
    if (!exportTimestamp) {
      const previousResult = previousFinished ? await previousResultPromise.catch((error) => ({ error: error && error.message ? error.message : String(error) })) : null;
      const previousError = String(previousResult && previousResult.error || "");
      const shouldWaitAfterNoExport = previousError.includes("ERR_CONNECTION") ||
        previousError.includes("net::") ||
        previousError.toLowerCase().includes("timeout");
      if (shouldWaitAfterNoExport) {
        const waitSec = Math.ceil(INTER_ACCOUNT_COOLDOWN_MS / 1000);
        mainWindow.webContents.send("bot-log",
          `\n⏸️  [تجنب حد التصدير] ${previousLabel} فشل قبل التصدير بسبب الشبكة — الانتظار ${Math.floor(waitSec / 60)} دقيقة قبل بدء ${label}...`);
        let remainingMs = INTER_ACCOUNT_COOLDOWN_MS;
        while (remainingMs > 0 && botRunning) {
          const tick = Math.min(1000, remainingMs);
          await new Promise(resolve => setTimeout(resolve, tick));
          remainingMs -= tick;
          if (!botRunning) break;
          const remSec = Math.ceil(remainingMs / 1000);
          mainWindow.webContents.send("bot-log",
            `⏸️  [تجنب حد التصدير] الانتظار لمدة ${Math.floor(remSec / 60)} دقيقة و ${remSec % 60} ثانية قبل بدء ${label}...`);
        }
        return;
      }
      mainWindow.webContents.send("bot-log",
        `\n[${label}] ${previousLabel} finished before export; starting next account without export cooldown.`);
      return;
    }

    // Phase 2 – respect the cooldown window from the moment of that export.
    const elapsed = Date.now() - exportTimestamp;
    let remainingMs = Math.max(0, INTER_ACCOUNT_COOLDOWN_MS - elapsed);

    if (remainingMs > 0) {
      let remainingSec = Math.ceil(remainingMs / 1000);
      mainWindow.webContents.send("bot-log",
        `\n⏸️  [تجنب حد التصدير] الانتظار لمدة ${Math.floor(remainingSec / 60)} دقيقة و ${remainingSec % 60} ثانية قبل بدء ${label}...`);

      while (remainingMs > 0 && botRunning) {
        const currentElapsed = Date.now() - exportTimestamp;
        if (currentElapsed >= INTER_ACCOUNT_COOLDOWN_MS) break;
        const waitTime = Math.min(1000, INTER_ACCOUNT_COOLDOWN_MS - currentElapsed);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        remainingMs = INTER_ACCOUNT_COOLDOWN_MS - (Date.now() - exportTimestamp);

        if (!botRunning) break;
        let remSec = Math.ceil(remainingMs / 1000);
        mainWindow.webContents.send("bot-log",
          `⏸️  [تجنب حد التصدير] الانتظار لمدة ${Math.floor(remSec / 60)} دقيقة و ${remSec % 60} ثانية قبل بدء ${label}...`);
      }
    }
  }

  // Launch all accounts with staggered timing; collect promises so we can
  // await every account's completion at the end.
  const resultPromises = [];

  for (let i = 0; i < accountsToRun.length; i++) {
    if (!botRunning) break;

    const acc   = accountsToRun[i];
    const label = accountDisplayName(acc, `Account ${i + 1}`);

    // For every account after the first, wait for the export cooldown window
    // to elapse from the previous account's export timestamp.  This runs
    // concurrently with the previous account still processing orders.
    if (i > 0) {
      await waitForExportCooldown(i - 1, i, resultPromises[i - 1]);
      if (!botRunning) break;
    }

    mainWindow.webContents.send("bot-log",
      `\n▶️  [${i + 1}/${accountsToRun.length}] بدء الحساب: ${label}`);

    // Start this account and store its promise — do NOT await here so the
    // next iteration can begin its cooldown timer immediately.
    const promise = runOneAccount(acc, i).then(result => {
      mainWindow.webContents.send("bot-log",
        `✅ [${i + 1}/${accountsToRun.length}] انتهى الحساب: ${label} — ${result.success ? "نجح" : "فشل"}`);
      return result;
    });
    resultPromises.push(promise);
  }

  // Wait for every account to finish before reporting overall completion.
  const results = await Promise.all(resultPromises);

  botChildren = [];
  mainWindow.webContents.send("bot-run-complete");
  const allOk = results.every(r => r.success);
  return { success: allOk, multiAccount: true, results };
});
