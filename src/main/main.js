// DOTENV - load .env if present (dev or packaged extraResources)
(function loadEnv() {
  const path = require("path");
  const fs = require("fs");
  const devLocalPath = path.join(__dirname, "../../.env.local");
  const devPath = path.join(__dirname, "../../.env");
  const prodPath = process.resourcesPath ? path.join(process.resourcesPath, ".env") : null;
  const dotenv = require("dotenv");
  const baseEnvPath = fs.existsSync(devPath)
    ? devPath
    : (prodPath && fs.existsSync(prodPath) ? prodPath : null);
  if (baseEnvPath) dotenv.config({ path: baseEnvPath });
  if (fs.existsSync(devLocalPath)) dotenv.config({ path: devLocalPath, override: true });
})();

const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require("electron");
app.setAppUserModelId("com.khodbot.app");
const path = require("path");
const Store = require("electron-store");
const fs = require("fs");
const crypto = require("crypto");
const zlib = require("zlib");
const os = require("os");
const https = require("https");
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");
const monitoring = require("../monitoring/sentry.main");
const { normalizePhone } = require("../bot/phone");
const { processDashboardSheet } = require("../bot/dashboard-sheet-processing");
const { createDashboardQueryService } = require("./dashboard-query-service");
const { findNewDuplicateConflict } = require("./account-duplicates");
const { fetchActiveAdminNotification } = require("./admin-notification");
const { evaluateCachedLicense, isInsideWarningWindow } = require("./license-expiry-policy");
const {
  replaceRowsInDateRange,
  validateCurrentYearDashboardRange,
} = require("./dashboard-range-utils");
const XLSX = require("xlsx");
const {
  askDashboardAi,
  getAiGatewayState,
  getAiAdminAnalytics,
  configureAiGateway,
  validateDashboardAiPayload,
  debugGeminiPing,
} = require("./dashboard-ai-service");
const {
  buildBulkOrderSampleWorkbook,
  parseBulkOrderWorkbook,
  previewBulkOrders,
  samplePreviewRows,
} = require("../bot/bulk-order-sheet");
const {
  parseRecoveryCustomersFromWorkbooks,
  buildRecoveryProductCatalogFromRows,
  buildRecoveryOrders,
  previewRecoveryOrders,
} = require("../bot/recovery-order-sheet");
const {
  MONTHLY_DATA_CLEANUP_DAY,
  createMonthlyCleanupScheduler,
  monthlyCleanupCutoff,
  monthlyCleanupEligible,
  monthlyCleanupMonthKey,
  nextMonthlyCleanupDateKey,
  pruneAnalyticsRunsForCurrentMonth,
  pruneDashboardAccountsForCurrentMonth,
} = require("./monthly-data-cleanup");

function pathEquals(left, right) {
  return path.resolve(String(left || "")).toLowerCase() === path.resolve(String(right || "")).toLowerCase();
}

function copyIfMissing(source, target) {
  try {
    if (!source || !target || !fs.existsSync(source) || fs.existsSync(target)) return false;
    const stat = fs.statSync(source);
    if (stat.isDirectory()) {
      fs.cpSync(source, target, { recursive: true, errorOnExist: false });
    } else {
      fs.copyFileSync(source, target);
    }
    return true;
  } catch (error) {
    log.warn("[UserData] Could not migrate item:", source, "->", target, error && error.message ? error.message : error);
    return false;
  }
}

function migrateUserDataSource(sourceDir, targetDir) {
  try {
    if (!sourceDir || !targetDir || pathEquals(sourceDir, targetDir) || !fs.existsSync(sourceDir)) return 0;
    fs.mkdirSync(targetDir, { recursive: true });

    let copied = 0;
    const encryptedStoreNames = ["machine-id.json", "license.json", "credentials.json"];
    const targetHasMachineId = fs.existsSync(path.join(targetDir, "machine-id.json"));
    const sourceHasMachineId = fs.existsSync(path.join(sourceDir, "machine-id.json"));

    // Encrypted stores are only useful with their matching machine-id.json.
    if (!targetHasMachineId && sourceHasMachineId) {
      for (const name of encryptedStoreNames) {
        if (copyIfMissing(path.join(sourceDir, name), path.join(targetDir, name))) copied++;
      }
    }

    for (const name of ["analytics.json", "dashboard.json", "bot-profile"]) {
      if (copyIfMissing(path.join(sourceDir, name), path.join(targetDir, name))) copied++;
    }

    for (const name of fs.readdirSync(sourceDir)) {
      if (!name.startsWith("bot-profile-")) continue;
      if (copyIfMissing(path.join(sourceDir, name), path.join(targetDir, name))) copied++;
    }

    if (copied > 0) log.info(`[UserData] Migrated ${copied} item(s) from ${sourceDir} to ${targetDir}`);
    return copied;
  } catch (error) {
    log.warn("[UserData] Migration failed:", error && error.message ? error.message : error);
    return 0;
  }
}

function configureStableUserDataPath() {
  if (!app.isPackaged || process.env.KHOD_QA_USER_DATA_DIR) return;
  try {
    const appData = app.getPath("appData");
    const currentUserData = app.getPath("userData");
    const stableUserData = path.join(appData, "KHOD WHAAT Orders");
    const candidates = Array.from(new Set([
      currentUserData,
      path.join(appData, "khod-whaat-orders"),
      path.join(appData, "Khod.Whaat.Orders"),
      path.join(appData, "com.khodbot.app"),
    ].filter(Boolean)));

    for (const candidate of candidates) {
      migrateUserDataSource(candidate, stableUserData);
    }

    if (!pathEquals(currentUserData, stableUserData)) {
      fs.mkdirSync(stableUserData, { recursive: true });
      app.setPath("userData", stableUserData);
      log.info("[UserData] Using stable userData path:", stableUserData);
    }
  } catch (error) {
    log.warn("[UserData] Could not configure stable userData path:", error && error.message ? error.message : error);
  }
}

configureStableUserDataPath();

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
// [KHOD WHAAT Bot DEBUG] - remove once AI is confirmed working
setTimeout(function () {
  const keyLoaded = process.env.GEMINI_API_KEY;
  log.info("[KhodAI-Debug] Gemini config:", {
    keyPresent: !!keyLoaded,
    keyLength: keyLoaded ? keyLoaded.length : 0,
    forcedOff: String(process.env.TAAGER_AI_FORCE_GEMINI_OFF || "") === "1",
    freeTierHint: "Check getAiAdminAnalytics().gemini for attempts, successes, failures, and fallback reasons.",
  });
}, 0);
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
// The installer is launched explicitly after the tray/window process is torn
// down. Leaving this enabled lets electron-updater start a second install path
// through app.quit(), which races the tray process and makes NSIS report that
// KHOD WHAAT cannot be closed.
autoUpdater.autoInstallOnAppQuit = false;
try {
  autoUpdater.verifyUpdateCodeSignature = false;
} catch (_) {}
autoUpdater.logger = {
  info:  (...a) => log.info("[AutoUpdate]", ...a),
  warn:  (...a) => log.warn("[AutoUpdate]", ...a),
  error: (...a) => log.error("[AutoUpdate]", ...a),
  debug: (...a) => log.debug("[AutoUpdate]", ...a),
};

// ══════════════════════════════════════════════════════
// SUPABASE CONFIG
// Primary source: .env file (dev) or extraResources/.env (packaged).
// No hardcoded fallback — missing config produces a clear warning rather than
// silently using stale credentials baked into the source.
// ══════════════════════════════════════════════════════
const SUPABASE_URL             = process.env.SUPABASE_URL             || "";
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";
const SAUDIIPICK_MARKETING_API_BASE = (process.env.SAUDIIPICK_MARKETING_API_BASE || "https://saudiipick.com").replace(/\/+$/, "");

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  log.warn("[App] Supabase config missing — license checks will fail until .env is configured.");
}

const SUPABASE_TIMEOUT_MS = 180_000; // 180 s (3 minutes) — enough for slow connections and multi-account syncs

function buildSupabaseAuthHeaders(key) {
  const headers = { apikey: key };
  // Legacy anon/service-role keys are JWTs and can be used as Bearer tokens.
  // New sb_publishable_* keys are API keys only; sending them as Bearer causes
  // PostgREST to reject the request before the RPC runs.
  if (/^eyJ/.test(key)) headers.Authorization = "Bearer " + key;
  return headers;
}

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
      "Prefer": method === "POST" ? "return=representation" : "",
      ...buildSupabaseAuthHeaders(SUPABASE_PUBLISHABLE_KEY),
    };
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
        ...buildSupabaseAuthHeaders(SUPABASE_PUBLISHABLE_KEY),
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
          log.info("[Migration] Migrating legacy machineUUID to machine-id.json:", machineUUID);
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

          log.info("[Migration] Re-encryption successful!");
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
        log.info("[Migration] Generated new stable machineUUID:", machineUUID);
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
const AI_MIRROR_STORE_KEY = "aiMirrors.v1";
const AI_MIRROR_STORE_LIMIT = 8;
const dashboardQueryService = createDashboardQueryService({
  getAccounts: () => dashboardStore.get("accounts", {}),
  getAllowedAccountIds: () => {
    const configured = (store.get("accounts", []) || []).map((account) => account && account.id).filter(Boolean);
    return configured.length ? configured : Object.keys(dashboardStore.get("accounts", {}) || {});
  },
  getRevision: () => Number(dashboardStore.get("snapshotRevision", 0) || 0),
  getMarketingRevision: () => Number(dashboardStore.get("marketingRevision", 0) || 0),
});
let analyticsRunsCache = null;
let analyticsRunsCacheDirty = true;
let analyticsSnapshotSyncCacheKey = "";
const ADMIN_ERROR_ALERT_RATE_LIMIT_MS = 5 * 60 * 1000;
const adminErrorAlertLastSent = new Map();
let adminErrorAlertRpcWarned = false;

function sanitizeAdminAlertText(value, limit) {
  let text = String(value == null ? "" : value);
  text = text.replace(/\bKHOD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\b/gi, "[Filtered license]");
  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[Filtered email]");
  text = text.replace(/\+?\d[\d\s().-]{7,}\d/g, "[Filtered number]");
  text = text.replace(/\b(password|pass|token|api[_-]?key|apikey|authorization|cookie|secret|licenseKey|key)\b\s*[:=]\s*["']?[^"',\s}]+/gi, "$1=[Filtered]");
  text = text.replace(/[A-Z]:\\Users\\[^\\\s]+/gi, "C:\\Users\\[Filtered]");
  text = text.replace(/\/Users\/[^/\s]+/g, "/Users/[Filtered]");
  text = text.replace(/\s+/g, " ").trim();
  const max = Math.max(0, Number(limit || 0));
  return max && text.length > max ? text.slice(0, max - 3) + "..." : text;
}

function adminAlertStackTop(stack) {
  return String(stack || "")
    .split(/\r?\n/)
    .slice(0, 5)
    .map(line => sanitizeAdminAlertText(line, 240))
    .filter(Boolean)
    .join("\n")
    .slice(0, 900);
}

function normalizeAdminErrorAlertPayload(error, context, level) {
  const err = error && typeof error === "object" ? error : new Error(String(error || "Unknown error"));
  const safeContext = context && typeof context === "object" ? context : {};
  const processName = ["main", "renderer", "preload"].includes(safeContext.process) ? safeContext.process : "main";
  const severity = ["warning", "error", "fatal"].includes(level) ? level : "error";
  const operation = safeContext.operation || safeContext.name || safeContext.channel || "unknown";
  return {
    process: processName,
    severity,
    operation: sanitizeAdminAlertText(operation, 140) || "unknown",
    route: sanitizeAdminAlertText(safeContext.route || safeContext.activeRoute || "", 120),
    errorName: sanitizeAdminAlertText(err.name || "Error", 80) || "Error",
    message: sanitizeAdminAlertText(err.message || String(err), 500) || "Unknown error",
    stackTop: adminAlertStackTop(err.stack || ""),
    appVersion: sanitizeAdminAlertText(app.getVersion ? app.getVersion() : "", 40),
  };
}

async function recordAdminErrorAlert(error, context, level) {
  const key = licenseStore.get("licenseKey", "");
  if (!key) return false;
  const payload = normalizeAdminErrorAlertPayload(error, context, level);
  if (!payload.message || /khod_record_admin_error_alert/i.test(payload.message)) return false;
  const rateKey = [payload.process, payload.severity, payload.operation, payload.errorName, payload.message].join("|").slice(0, 700);
  const now = Date.now();
  const lastSent = adminErrorAlertLastSent.get(rateKey) || 0;
  if (now - lastSent < ADMIN_ERROR_ALERT_RATE_LIMIT_MS) return false;
  adminErrorAlertLastSent.set(rateKey, now);
  try {
    const result = await supabaseRpc("khod_record_admin_error_alert", {
      p_license_key: key,
      p_event: payload,
    });
    if (result && result.ok === true) {
      adminErrorAlertRpcWarned = false;
      return true;
    }
  } catch (err) {
    if (!adminErrorAlertRpcWarned) {
      adminErrorAlertRpcWarned = true;
      log.warn("[AdminErrorAlert] Could not send sanitized alert:", err && err.message ? err.message : err);
    }
  }
  return false;
}

if (typeof monitoring.setAdminErrorAlertReporter === "function") {
  monitoring.setAdminErrorAlertReporter(recordAdminErrorAlert);
}

function bumpDashboardSnapshotRevision() {
  const next = Number(dashboardStore.get("snapshotRevision", 0) || 0) + 1;
  dashboardStore.set("snapshotRevision", next);
  dashboardQueryService.clearCache();
  return next;
}

function bumpDashboardMarketingRevision() {
  const next = Number(dashboardStore.get("marketingRevision", 0) || 0) + 1;
  dashboardStore.set("marketingRevision", next);
  dashboardQueryService.clearCache();
  return next;
}

function defaultAiAssistantMemory() {
  return {
    version: 1,
    businessMemoryByAccount: {},
    sessionSummariesById: {},
    knownInputs: {
      accountSpend: null,
      productSpend: {},
      currency: null,
    },
    lastDiagnosis: null,
    activeWorkflow: null,
    userPreferences: { mediaBuying: {} },
    pendingLearningSuggestion: null,
    updatedAt: null,
  };
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function compactAiText(value, max = 600) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

function sanitizeAiAssistantMemory(value) {
  const src = plainObject(value);
  const known = plainObject(src.knownInputs);
  return {
    version: 1,
    businessMemoryByAccount: plainObject(src.businessMemoryByAccount),
    sessionSummariesById: plainObject(src.sessionSummariesById),
    knownInputs: {
      accountSpend: known.accountSpend && typeof known.accountSpend === "object" ? known.accountSpend : null,
      productSpend: plainObject(known.productSpend),
      currency: compactAiText(known.currency, 12) || null,
    },
    lastDiagnosis: src.lastDiagnosis && typeof src.lastDiagnosis === "object" ? src.lastDiagnosis : null,
    activeWorkflow: src.activeWorkflow && typeof src.activeWorkflow === "object" ? src.activeWorkflow : null,
    userPreferences: Object.assign({ mediaBuying: {} }, plainObject(src.userPreferences)),
    pendingLearningSuggestion: src.pendingLearningSuggestion && typeof src.pendingLearningSuggestion === "object" ? src.pendingLearningSuggestion : null,
    updatedAt: src.updatedAt || null,
  };
}

function mergeAiAssistantMemory(base, delta) {
  const current = sanitizeAiAssistantMemory(base);
  const src = plainObject(delta);
  const next = sanitizeAiAssistantMemory(Object.assign({}, current, src));
  next.businessMemoryByAccount = Object.assign({}, current.businessMemoryByAccount, plainObject(src.businessMemoryByAccount));
  next.sessionSummariesById = Object.assign({}, current.sessionSummariesById, plainObject(src.sessionSummariesById));
  next.knownInputs = Object.assign({}, current.knownInputs, plainObject(src.knownInputs));
  next.knownInputs.productSpend = Object.assign({}, current.knownInputs.productSpend, plainObject(src.knownInputs && src.knownInputs.productSpend));
  next.userPreferences = Object.assign({}, current.userPreferences, plainObject(src.userPreferences));
  next.userPreferences.mediaBuying = Object.assign({}, plainObject(current.userPreferences && current.userPreferences.mediaBuying), plainObject(src.userPreferences && src.userPreferences.mediaBuying));
  next.pendingLearningSuggestion = src.pendingLearningSuggestion === null ? null : (src.pendingLearningSuggestion || current.pendingLearningSuggestion);
  next.lastDiagnosis = src.lastDiagnosis === null ? null : (src.lastDiagnosis || current.lastDiagnosis);
  next.activeWorkflow = src.activeWorkflow === null ? null : (src.activeWorkflow || current.activeWorkflow);
  next.updatedAt = new Date().toISOString();
  return sanitizeAiAssistantMemory(next);
}

function invalidateAnalyticsRunsCache() {
  analyticsRunsCache = null;
  analyticsRunsCacheDirty = true;
}

configureAiGateway({
  loadState: () => dashboardStore.get("aiGatewayState", {}),
  saveState: (state) => dashboardStore.set("aiGatewayState", state || {}),
  logEvent: (event) => log.info("[KhodAI-Event]", JSON.stringify(event)),
});

let mainWindow, tray, autoRunTimer = null, autoRunEnabled = false, botRunning = false;
let currentBotChild = null;

const APP_ZOOM_LEVELS = [75, 90, 100, 110, 125, 150];
const DEFAULT_APP_ZOOM = 100;

function normalizeAppZoom(value) {
  const numeric = Number(value);
  return APP_ZOOM_LEVELS.includes(numeric) ? numeric : DEFAULT_APP_ZOOM;
}

function getSavedAppZoom() {
  return normalizeAppZoom(store.get("appZoom", DEFAULT_APP_ZOOM));
}

function broadcastAppZoom(percent) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("app-zoom-changed", percent);
}

function applyAppZoom(percent, options = {}) {
  const next = normalizeAppZoom(percent);
  if (!mainWindow || mainWindow.isDestroyed()) return next;
  mainWindow.webContents.setZoomFactor(next / 100);
  if (options.persist !== false) store.set("appZoom", next);
  broadcastAppZoom(next);
  return next;
}

function stepAppZoom(direction) {
  const current = normalizeAppZoom(
    Math.round((mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents.getZoomFactor() : 1) * 100)
  );
  const currentIndex = APP_ZOOM_LEVELS.indexOf(current);
  const nextIndex = Math.max(0, Math.min(APP_ZOOM_LEVELS.length - 1, currentIndex + direction));
  return applyAppZoom(APP_ZOOM_LEVELS[nextIndex]);
}

function installAppZoomControls(window) {
  const contents = window.webContents;
  contents.on("did-finish-load", () => {
    applyAppZoom(getSavedAppZoom(), { persist: false });
  });
  contents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || (!input.control && !input.meta)) return;
    const key = String(input.key || "").toLowerCase();
    const code = String(input.code || "").toLowerCase();
    if (key === "0" || code === "digit0" || code === "numpad0") {
      event.preventDefault();
      applyAppZoom(DEFAULT_APP_ZOOM);
    } else if (key === "+" || key === "=" || key === "add" || code === "equal" || code === "numpadadd") {
      event.preventDefault();
      stepAppZoom(1);
    } else if (key === "-" || key === "_" || key === "subtract" || code === "minus" || code === "numpadsubtract") {
      event.preventDefault();
      stepAppZoom(-1);
    }
  });
}

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
function khodEmailIdentityOf(acc) {
  const staticIdentity = staticAccountIdentityOf(acc);
  if (staticIdentity) return staticIdentity;
  return String(acc && acc.khodEmail || "").toLowerCase().trim();
}

function isStaticAccount(acc) {
  return !!acc && acc.accountType === "static";
}

function staticAccountIdentityOf(acc) {
  if (!isStaticAccount(acc)) return "";
  const id = String(acc.id || "").trim().toLowerCase();
  return id ? `static:${id}` : "";
}

function licenseEasyStoreOf(acc) {
  if (isStaticAccount(acc)) {
    return String(acc.label || acc.memberName || "Static account").replace(/\s+/g, " ").trim().toLowerCase();
  }
  return String(acc && acc.easyStore || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function khodMarketingLoginMethodOf(acc) {
  const method = (acc && (acc.khodLoginMethod || acc.taagerLoginMethod) || "email").toLowerCase().trim();
  return ["email", "phone", "google"].includes(method) ? method : "email";
}

function khodMarketingIdentityOf(acc) {
  const method = khodMarketingLoginMethodOf(acc);
  const country = String(acc && (acc.khodCountry || acc.taagerCountry) || "sa").trim().toLowerCase();
  if (method === "phone") return normalizePhone(acc && (acc.khodPhone || acc.taagerPhone) || "", country);
  return (acc && (acc.khodEmail || acc.taagerEmail) || "").toLowerCase().trim();
}

function khodMarketingKeyOf(acc) {
  const merchantId = String(acc && (acc.khodAffiliateCode || acc.taagerAffiliateCode) || "").trim().toLowerCase();
  const country = String(acc && (acc.khodCountry || acc.taagerCountry) || "sa").trim().toLowerCase();
  if (merchantId) return `khod:${country}:${merchantId}`;
  const method = khodMarketingLoginMethodOf(acc);
  const identity = khodMarketingIdentityOf(acc);
  if (!identity) return "";
  return method === "phone" ? `phone:${identity}` : identity;
}

function accountIdentityKey(acc) {
  const staticIdentity = staticAccountIdentityOf(acc);
  if (staticIdentity) return staticIdentity;
  const easy = (acc.easyEmail || "").toLowerCase().trim();
  const khod = khodEmailIdentityOf(acc);
  return `${easy}|${khod}`;
}

function accountHash(acc) {
  const id = (acc.id || "").trim();
  const identityKey = accountIdentityKey(acc);
  if (acc && acc.licenseAccountHash && acc.licenseIdentityKey === identityKey) {
    return acc.licenseAccountHash;
  }
  return crypto.createHash("sha256").update(`${id}|${identityKey}`).digest("hex");
}

function licenseRowMatchesAccount(row, acc) {
  if (!row || !acc) return false;
  const easy = (acc.easyEmail || "").toLowerCase().trim();
  const rowEasy = String(row.easy_email || "").toLowerCase().trim();
  if (easy && rowEasy && easy !== rowEasy) return false;
  const easyStore = String(acc.easyStore || "").replace(/\s+/g, " ").trim().toLowerCase();
  const rowEasyStore = String(row.easy_store || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (easyStore && easy && rowEasyStore && rowEasyStore !== easyStore) return false;
  const khod = khodEmailIdentityOf(acc);
  const rowKhod = String(row.khod_email || "").toLowerCase().trim();
  return !!khod && rowKhod === khod;
}

function summarizeRemoteLicenseAccounts(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    count: list.length,
    lockedCount: list.filter(row => !row || row.unlocked !== true).length,
    accounts: list.slice(0, 10).map((row) => ({
      easyEmail: String(row && row.easy_email || "").trim(),
      easyStore: String(row && row.easy_store || "").trim(),
      khodEmail: String(row && row.khod_email || "").trim(),
      unlocked: row && row.unlocked === true,
    })),
  };
}

function _buildAccountIdents() {
  try {
    const accounts = store.get("accounts", []);
    return accounts.map(a => ({
      easy_email: (a.easyEmail || "").toLowerCase().trim(),
      khod_email: khodEmailIdentityOf(a),
    })).filter(x => x.easy_email || x.khod_email);
  } catch { return []; }
}

const LICENSE_CREDENTIAL_BACKUP_VERSION = 1;
const LICENSE_CREDENTIAL_BACKUP_PROMPT_VERSION = 1;
const LICENSE_CREDENTIAL_BACKUP_AAD = Buffer.from("khod-license-credentials-v1");

function deriveLicenseCredentialBackupKey(licenseKey, salt) {
  return crypto.pbkdf2Sync(
    String(licenseKey || "").trim().toUpperCase(),
    `khod-license-credentials-v1:${salt}`,
    100000,
    32,
    "sha256"
  );
}

function encryptLicenseCredentialBackup(payload, licenseKey) {
  const salt = crypto.randomBytes(16).toString("base64");
  const iv = crypto.randomBytes(12);
  const key = deriveLicenseCredentialBackupKey(licenseKey, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(LICENSE_CREDENTIAL_BACKUP_AAD);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    v: 1,
    alg: "aes-256-gcm",
    kdf: "pbkdf2-sha256",
    iterations: 100000,
    salt,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: encrypted.toString("base64"),
  };
}

function decryptLicenseCredentialBackup(envelope, licenseKey) {
  if (!envelope || envelope.v !== 1 || envelope.alg !== "aes-256-gcm") {
    throw new Error("unsupported_credential_backup");
  }
  const key = deriveLicenseCredentialBackupKey(licenseKey, envelope.salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAAD(LICENSE_CREDENTIAL_BACKUP_AAD);
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

function backupString(value, max = 512) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function accountForCredentialBackup(account) {
  const id = backupString(account && account.id, 80);
  return {
    id,
    accountType: isStaticAccount(account) ? "static" : "live",
    memberName: backupString(account && account.memberName, 120),
    label: backupString(account && account.label, 160),
    licenseAccountHash: backupString(account && account.licenseAccountHash, 160),
    licenseIdentityKey: backupString(account && account.licenseIdentityKey, 512),
    easyEmail: backupString(account && account.easyEmail, 320),
    easyPassword: id ? store.get(`pwd_easy_${id}`, "") : "",
    easyStore: backupString(account && account.easyStore, 180),
    dashboardEnrichmentProvider: account && account.dashboardEnrichmentProvider === "easyorders" ? "easyorders" : "none",
    easyOrdersLookbackDays: Number(account && account.easyOrdersLookbackDays || 60),
    khodEmail: backupString(account && account.khodEmail, 320),
    khodPassword: id ? store.get(`pwd_khod_${id}`, "") : "",
    khodCountry: backupString(account && account.khodCountry || "sa", 12).toLowerCase() || "sa",
    khodAffiliateCode: backupString(account && account.khodAffiliateCode, 80),
  };
}

function legacyAccountForCredentialBackup() {
  const easyEmail = backupString(store.get("easyEmail", ""), 320);
  if (!easyEmail) return null;
  const id = "__single__";
  return {
    id,
    memberName: "",
    label: backupString(store.get("easyStore", "") || easyEmail, 160),
    licenseAccountHash: "",
    licenseIdentityKey: "",
    easyEmail,
    easyPassword: String(store.get("easyPassword", "") || ""),
    easyStore: backupString(store.get("easyStore", ""), 180),
    dashboardEnrichmentProvider: store.get("dashboardEnrichmentProvider", "none") === "easyorders" ? "easyorders" : "none",
    easyOrdersLookbackDays: Number(store.get("easyOrdersLookbackDays", 60) || 60),
    khodEmail: backupString(store.get("khodEmail", ""), 320),
    khodPassword: String(store.get("khodPassword", "") || ""),
    khodCountry: backupString(store.get("khodCountry", "sa") || "sa", 12).toLowerCase() || "sa",
    khodAffiliateCode: backupString(store.get("khodAffiliateCode", ""), 80),
  };
}

function localCredentialBackupAccountCount() {
  const accounts = store.get("accounts", []) || [];
  if (accounts.length) return accounts.length;
  return legacyAccountForCredentialBackup() ? 1 : 0;
}

function buildLicenseCredentialBackupPayload() {
  let accounts = (store.get("accounts", []) || []).map(accountForCredentialBackup).filter(a => a.id);
  if (!accounts.length) {
    const legacy = legacyAccountForCredentialBackup();
    if (legacy) accounts = [legacy];
  }
  return {
    version: LICENSE_CREDENTIAL_BACKUP_VERSION,
    updatedAt: new Date().toISOString(),
    accounts,
  };
}

function normalizeRestoredCredentialAccount(raw, index) {
  const src = raw && typeof raw === "object" ? raw : {};
  const fallbackId = `account_${Date.now()}_${index}`;
  const id = backupString(src.id || fallbackId, 80).replace(/[^\w-]/g, "_") || fallbackId;
  const restored = {
    id,
    accountType: src.accountType === "static" ? "static" : "live",
    memberName: backupString(src.memberName, 120),
    label: backupString(src.label, 160),
    easyEmail: backupString(src.easyEmail, 320),
    easyPassword: String(src.easyPassword || ""),
    easyStore: backupString(src.easyStore, 180),
    dashboardEnrichmentProvider: src.dashboardEnrichmentProvider === "easyorders" ? "easyorders" : "none",
    easyOrdersLookbackDays: Number(src.easyOrdersLookbackDays || 60),
    khodEmail: backupString(src.khodEmail || src.taagerEmail, 320),
    khodPassword: String(src.khodPassword || src.taagerPassword || ""),
    khodCountry: backupString(src.khodCountry || src.taagerCountry || "sa", 12).toLowerCase() || "sa",
    khodAffiliateCode: backupString(src.khodAffiliateCode || src.taagerAffiliateCode, 80),
  };
  const identityKey = accountIdentityKey(restored);
  if (src.licenseAccountHash && src.licenseIdentityKey === identityKey) {
    restored.licenseAccountHash = backupString(src.licenseAccountHash, 160);
    restored.licenseIdentityKey = identityKey;
  }
  return restored;
}

async function getLicenseCredentialBackupStatus() {
  const licKey = licenseStore.get("licenseKey", "");
  if (!licKey) return { ok: false, available: false, reason: "no_license" };
  try {
    const status = await supabaseRpc("khod_get_license_credential_backup_status", {
      p_license_key: licKey,
      p_machine_uuid: _getOrCreateMachineUUID(),
      p_device_id: getDeviceFingerprint(),
    });
    return {
      ok: status && status.ok === true,
      available: status && status.available === true,
      accountCount: Number(status && status.account_count || 0),
      updatedAt: status && status.updated_at || null,
      reason: status && status.reason || "",
    };
  } catch (error) {
    log.warn("[LicenseCredentials] Backup status failed:", error && error.message ? error.message : error);
    return { ok: false, available: false, reason: "backup_status_failed" };
  }
}

async function getLicenseCredentialBackupPromptStatus() {
  const licKey = licenseStore.get("licenseKey", "");
  const accountCount = localCredentialBackupAccountCount();
  if (!licKey) return { show: false, reason: "no_license", version: LICENSE_CREDENTIAL_BACKUP_PROMPT_VERSION };
  if (!accountCount) return { show: false, reason: "no_accounts", version: LICENSE_CREDENTIAL_BACKUP_PROMPT_VERSION };
  if (store.get("licenseCredentialBackupPromptDoneVersion", 0) >= LICENSE_CREDENTIAL_BACKUP_PROMPT_VERSION) {
    return { show: false, reason: "already_done", version: LICENSE_CREDENTIAL_BACKUP_PROMPT_VERSION };
  }
  const status = await getLicenseCredentialBackupStatus();
  if (status && status.ok === false) {
    return {
      show: false,
      reason: status.reason || "backup_status_unavailable",
      version: LICENSE_CREDENTIAL_BACKUP_PROMPT_VERSION,
      accountCount,
    };
  }
  if (status && status.available) {
    store.set("licenseCredentialBackupPromptDoneVersion", LICENSE_CREDENTIAL_BACKUP_PROMPT_VERSION);
    return {
      show: false,
      reason: "backup_exists",
      version: LICENSE_CREDENTIAL_BACKUP_PROMPT_VERSION,
      accountCount: status.accountCount || accountCount,
      updatedAt: status.updatedAt || null,
    };
  }
  return {
    show: true,
    reason: status && status.reason || "backup_missing",
    version: LICENSE_CREDENTIAL_BACKUP_PROMPT_VERSION,
    accountCount,
  };
}

async function syncLicenseCredentialsBackup(reason = "credentials-updated") {
  const licKey = licenseStore.get("licenseKey", "");
  if (!licKey) return { ok: false, reason: "no_license" };
  const payload = buildLicenseCredentialBackupPayload();
  if (!payload.accounts.length) return { ok: false, reason: "no_accounts" };
  const encrypted = encryptLicenseCredentialBackup(payload, licKey);
  try {
    const result = await supabaseRpc("khod_upsert_license_credential_backup", {
      p_license_key: licKey,
      p_machine_uuid: _getOrCreateMachineUUID(),
      p_device_id: getDeviceFingerprint(),
      p_payload_version: LICENSE_CREDENTIAL_BACKUP_VERSION,
      p_encrypted_payload: encrypted,
      p_account_count: payload.accounts.length,
      p_account_hashes: payload.accounts.map(a => accountHash(a)),
    });
    if (!result || result.ok !== true) {
      log.warn("[LicenseCredentials] Backup rejected:", result && result.reason || "unknown");
      return { ok: false, reason: result && result.reason || "backup_rejected" };
    }
    log.info("[LicenseCredentials] Credential backup synced:", { reason, accounts: payload.accounts.length });
    return { ok: true, accountCount: payload.accounts.length };
  } catch (error) {
    log.warn("[LicenseCredentials] Backup sync failed:", error && error.message ? error.message : error);
    return { ok: false, reason: "backup_sync_failed" };
  }
}

async function backupLicenseCredentialsNow() {
  const result = await syncLicenseCredentialsBackup("manual-backup-prompt");
  if (result && result.ok === true) {
    store.set("licenseCredentialBackupPromptDoneVersion", LICENSE_CREDENTIAL_BACKUP_PROMPT_VERSION);
  }
  return Object.assign({ version: LICENSE_CREDENTIAL_BACKUP_PROMPT_VERSION }, result || { ok: false, reason: "backup_failed" });
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
  const khodCountry = String(
    run.khodCountry || run.taagerCountry || storedAccount?.khodCountry || storedAccount?.taagerCountry || store.get("khodCountry", "sa") || "sa"
  ).trim().toLowerCase();

  return {
    ...run,
    accountId,
    accountEmail: email,
    accountLabel: label,
    khodCountry,
    taagerCountry: khodCountry,
    orders: Array.isArray(run.orders)
      ? normalizeAnalyticsOrders(run.orders, khodCountry)
      : run.orders,
  };
}

function parseOrderRowsFromOutputBuffer(bufferLike) {
  try {
    if (!bufferLike) return [];
    const buffer = Buffer.isBuffer(bufferLike)
      ? bufferLike
      : Buffer.from(bufferLike instanceof ArrayBuffer ? new Uint8Array(bufferLike) : bufferLike);
    if (!buffer.length) return [];

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
        khodStatusKnown: false,
        orderStatusKnown: false,
        khodFinancialsKnown: false,
        khodOrderNumberKnown: false,
      }));
  } catch (err) {
    console.warn("[Analytics] Failed to parse order rows from output buffer:", err.message);
    return [];
  }
}

function analyticsIsMissedPlaceholderStatus(status) {
  return String(status || "").trim().toLowerCase().replace(/[\s_-]+/g, "") === "missed";
}

function analyticsIsNeutralKhodStatus(status) {
  const compact = String(status || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  return !compact || compact === "missed" || compact === "underprocessing" || compact === "pendingkhodsync";
}
function normalizeAnalyticsOrderStatus(order) {
  const status = String(order?.orderStatus || "").trim();
  if (!status || analyticsIsMissedPlaceholderStatus(status)) return "Under processing";
  return status;
}

function analyticsOrderProductNameFallback(order) {
  if (!order || typeof order !== "object") return "";
  const fields = [
    order.productName,
    order.products,
    order.product,
    order.displayName,
    order.itemName,
    order.nameAr,
    order.nameEn,
  ];
  for (const field of fields) {
    const value = String(field || "").trim();
    if (value) return value;
  }
  return String(order.sku || order.productSku || order.skuCode || order.sku_code || "").trim();
}

function normalizeAnalyticsOrder(order, khodCountry) {
  if (!order || typeof order !== "object") return order;
  const country = String(order.khodCountry || order.taagerCountry || khodCountry || "sa").trim().toLowerCase();
  const next = {
    ...order,
    khodCountry: country,
    taagerCountry: country,
    source: order.source === "missed" ? "missed" : "real",
    orderStatus: normalizeAnalyticsOrderStatus(order),
  };
  const productName = analyticsOrderProductNameFallback(next);
  if (productName && !String(next.productName || "").trim()) next.productName = productName;
  const khodOrderNumber = next.khodOrderNumber || next.taagerOrderNumber || "";
  const explicitStatusKnown = order.khodStatusKnown ?? order.orderStatusKnown;
  const explicitFinancialsKnown = order.khodFinancialsKnown;
  const existingKhodStatusKnown = Boolean(khodOrderNumber || !analyticsIsNeutralKhodStatus(next.orderStatus));
  const khodStatusKnown = explicitStatusKnown == null ? existingKhodStatusKnown : explicitStatusKnown === true;
  if (khodOrderNumber) {
    next.khodOrderNumber = khodOrderNumber;
    next.taagerOrderNumber = khodOrderNumber;
  }
  const khodProfit = next.khodProfit ?? next.profitAfterTax ?? next.taagerProfit ?? next.profitAfterFees ?? next.commission ?? next.marketerCommission;
  if (khodProfit != null && khodProfit !== "") {
    next.khodProfit = khodProfit;
    next.taagerProfit = khodProfit;
  }
  next.khodStatusKnown = khodStatusKnown;
  next.orderStatusKnown = khodStatusKnown;
  next.khodOrderNumberKnown = order.khodOrderNumberKnown === true || Boolean(khodOrderNumber);
  next.khodFinancialsKnown = explicitFinancialsKnown == null
    ? Boolean(khodOrderNumber && (Number(next.marketerCommission) || Number(next.amountDue)))
    : explicitFinancialsKnown === true;
  return next;
}

function normalizeAnalyticsOrders(orders, khodCountry) {
  return (Array.isArray(orders) ? orders : []).map((order) => normalizeAnalyticsOrder(order, khodCountry));
}

function countryOfRow(row, fallback = "sa") {
  return String(row?.khodCountry || row?.taagerCountry || row?.country || fallback || "sa").trim().toLowerCase();
}

function khodSnapshotRowKey(row, fallbackCountry = "sa") {
  const sku = (row?.sku || "").toString().trim();
  if (!sku) return null;
  const country = countryOfRow(row, fallbackCountry);
  const phone = normalizePhone(row.phone, country) || normalizePhone(row.phone1, country) || normalizePhone(row.phone2, country);
  return phone ? `${phone}|${sku}` : null;
}

function analyticsOrderKey(order, fallbackCountry = "sa") {
  const sku = (order?.sku || "").toString().trim();
  if (!sku) return null;
  const country = countryOfRow(order, fallbackCountry);
  const phone = normalizePhone(order.phone || order.rawPhone || order.normPhone || "", country);
  return phone ? `${phone}|${sku}` : null;
}

function parseDashboardMoney(value) {
  if (value == null || value === "") return 0;
  let text = String(value).trim()
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06F0))
    .replace(/[\u066B\u00B7]/g, ".")
    .replace(/[\u066C\u060C]/g, ",");
  const sign = /^\s*\(.*\)\s*$/.test(text) || /-/.test(text) ? -1 : 1;
  text = text.replace(/[^\d.,-]/g, "").replace(/-/g, "");
  if (!text) return 0;
  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");
  if (lastComma > lastDot && /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    text = text.replace(/,/g, "");
  } else if (lastComma > lastDot && text.split(",").length === 2 && text.split(",")[1].length <= 2) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }
  const n = Number(text);
  return Number.isFinite(n) ? sign * n : 0;
}

function hasAnalyticsValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function mergeKhodSnapshotRowIntoOrder(order, khodRow) {
  if (!khodRow) return order;
  const next = { ...order };
  const khodStatus = String(khodRow.orderStatus || "").trim();
  if (khodStatus) next.orderStatus = normalizeAnalyticsOrderStatus({ orderStatus: khodStatus });
  const khodStatusBucket = khodRow.orderStatusBucket || khodRow.exactStatusBucket || khodRow.statusBucket;
  if (khodStatusBucket) {
    next.orderStatusBucket = khodStatusBucket;
    next.exactStatusBucket = khodStatusBucket;
    next.statusBucket = khodStatusBucket;
  }
  const khodOrderNumber = khodRow.khodOrderNumber || khodRow.taagerOrderNumber || khodRow.orderNumber || khodRow.orderId || "";
  if (khodOrderNumber) {
    next.khodOrderNumber = khodOrderNumber;
    next.taagerOrderNumber = khodOrderNumber;
  }
  const amountDueSource = hasAnalyticsValue(khodRow.amountDueRaw) ? khodRow.amountDueRaw : khodRow.amountDue;
  const amountDue = parseDashboardMoney(amountDueSource);
  const marketerCommission = parseDashboardMoney(khodRow.marketerCommission);
  if (hasAnalyticsValue(amountDueSource)) next.amountDue = amountDue;
  if (hasAnalyticsValue(khodRow.marketerCommission)) {
    next.marketerCommission = marketerCommission;
    next.khodProfit = marketerCommission;
    next.taagerProfit = marketerCommission;
  }
  if (khodRow.city && !next.city) next.city = khodRow.city;
  if (khodRow.createdAt && !next.date) next.date = khodRow.createdAt;
  const khodProductName = analyticsOrderProductNameFallback(khodRow);
  if (khodProductName && !String(next.productName || "").trim()) next.productName = khodProductName;
  if (khodRow.products && !next.products) next.products = khodRow.products;
  if (khodRow.product && !next.product) next.product = khodRow.product;
  const hasKhodStatus = Boolean(khodStatus || khodOrderNumber);
  next.khodStatusKnown = hasKhodStatus;
  next.orderStatusKnown = hasKhodStatus;
  next.khodOrderNumberKnown = Boolean(khodOrderNumber);
  next.khodFinancialsKnown = [
    khodRow.amountDueRaw,
    khodRow.amountDue,
    khodRow.marketerCommission,
    khodRow.totalPriceRaw,
    khodRow.totalPrice,
  ].some(hasAnalyticsValue);
  return normalizeAnalyticsOrder(next, next.khodCountry || next.taagerCountry || order.khodCountry || order.taagerCountry);
}

function dashboardRowKey(row) {
  if (!row) return null;
  const direct = row.khodOrderNumber || row.taagerOrderNumber || row.orderNumber || row.orderId || row.id;
  if (direct) {
    const sku = (row.sku || row.productSku || row.products || "").toString().trim();
    const itemIndex = row.orderItemIndex != null ? String(row.orderItemIndex) : "";
    const qty = (row.qty || "").toString().trim();
    return `id:${String(direct).trim()}|${sku}|${itemIndex || qty}`;
  }
  const sku = (row.sku || row.productSku || "").toString().trim();
  const country = countryOfRow(row);
  const phone = normalizePhone(row.phone || row.phone1 || row.phone2 || row.rawPhone || "", country);
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
  return normalizeDashboardDateKey(row.createdAt || row.date || row.dashboardDate || row.lastUpdatedAt || row.updatedAt);
}

function dashboardOrderOnlyKey(row, fallbackIndex = 0) {
  if (!row) return `idx:${fallbackIndex}`;
  const direct = row.khodOrderNumber || row.taagerOrderNumber || row.orderNumber || row.orderId || row.id || row.reference;
  if (direct) return `id:${String(direct).trim()}`;
  const country = countryOfRow(row);
  const phone = normalizePhone(row.phone || row.phone1 || row.phone2 || row.rawPhone || "", country);
  const date = normalizeDashboardDateKey(row.createdAt || row.date || row.dashboardDate);
  const status = String(row.orderStatusBucket || row.statusBucket || row.orderStatus || row.status || "");
  return `sig:${phone}|${date}|${status}|${fallbackIndex}`;
}

function dashboardExactStatusBucket(row) {
  const bucket = String(row?.orderStatusBucket || row?.exactStatusBucket || row?.statusBucket || "").trim();
  if (bucket) return bucket;
  const status = String(row?.orderStatus || row?.status || "").trim();
  if (/canceled_by_you|طلب ملغي بواسطتك/.test(status)) return "canceled_by_you";
  if (/delivered|تم التوصيل/.test(status)) return "delivered";
  if (/customer_refused_confirmation|رفض/.test(status)) return "customer_refused_confirmation";
  if (/on_hold|معلق/.test(status)) return "on_hold";
  if (/received|استلام/.test(status)) return "received";
  return status || "other";
}

function dashboardSummaryForRange(rows, dateFrom, dateTo) {
  const from = normalizeDashboardDateKey(dateFrom);
  const to = normalizeDashboardDateKey(dateTo);
  const orders = new Map();
  let itemRows = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = dashboardRowDateKey(row);
    if (from && to && (!key || key < from || key > to)) continue;
    itemRows++;
    const orderKey = dashboardOrderOnlyKey(row, itemRows);
    if (!orders.has(orderKey)) orders.set(orderKey, row);
  }
  const statusBreakdown = {};
  let canceledByYou = 0;
  let delivered = 0;
  let confirmed = 0;
  for (const row of orders.values()) {
    const bucket = dashboardExactStatusBucket(row);
    statusBreakdown[bucket] = (statusBreakdown[bucket] || 0) + 1;
    const isCanceled = bucket === "canceled_by_you";
    if (isCanceled) {
      canceledByYou++;
      continue;
    }
    if (bucket === "delivered") delivered++;
    if ([
      "confirmed", "waiting", "shipping", "delivery_suspended", "processing",
      "delivered", "failed", "return_verified", "after_sales_progress", "after_sales_done",
    ].includes(bucket)) confirmed++;
  }
  return {
    itemRows,
    rawOrders: orders.size,
    canceledByYou,
    netOrders: Math.max(0, orders.size - canceledByYou),
    delivered,
    confirmed,
    statusBreakdown,
  };
}

function dashboardIsIncomingBucket(bucket) {
  return bucket === "received" ||
    bucket === "shipping" ||
    bucket === "delivery_suspended" ||
    bucket === "confirmed" ||
    bucket === "waiting" ||
    bucket === "after_sales_progress";
}

function dashboardIsLostBucket(bucket) {
  return bucket === "failed" ||
    bucket === "return_verified" ||
    bucket === "customer_refused_confirmation" ||
    bucket === "on_hold" ||
    bucket === "out_of_stock" ||
    bucket === "after_sales_done";
}

function dashboardProfitValue(row) {
  return parseDashboardMoney(
    row && (
      row.profitAfterTax ??
      row.khodProfit ??
      row.taagerProfit ??
      row.profitAfterFees ??
      row.commission ??
      row.marketerCommission ??
      0
    )
  );
}

function normalizeDashboardProfitFields(row) {
  if (!row) return row;
  const next = { ...row };
  const orderProfit = parseDashboardMoney(next.profitRaw ?? next.orderProfitRaw ?? next.profit ?? next.orderProfit ?? next.profitBeforeTax ?? next.grossProfit ?? 0);
  let taxProfit = parseDashboardMoney(next.taxProfitRaw ?? next.taagerTaxProfitRaw ?? next.taxProfit ?? next.taagerTaxProfit ?? next.taagerFees ?? next.tax ?? 0);
  if (orderProfit > 0 && taxProfit > orderProfit) {
    while (taxProfit > orderProfit && taxProfit >= 1) taxProfit = taxProfit / 10;
  }
  if (orderProfit > 0 || taxProfit > 0) {
    const profitAfterTax = orderProfit - taxProfit;
    next.profit = orderProfit;
    next.taxProfit = taxProfit;
    next.taagerTaxProfit = taxProfit;
    next.taagerFees = taxProfit;
    next.profitAfterTax = profitAfterTax;
    next.profitAfterFees = profitAfterTax;
    next.khodProfit = profitAfterTax;
    next.taagerProfit = profitAfterTax;
    next.commission = profitAfterTax;
    next.marketerCommission = profitAfterTax;
  }
  return next;
}

function normalizeDashboardProfitRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(normalizeDashboardProfitFields);
}

function normalizeSkuNameCacheMap(value) {
  const map = {};
  Object.entries(value || {}).forEach(([sku, name]) => {
    const cleanSku = String(sku || "").trim();
    const cleanName = String(name || "").trim().replace(/\s+/g, " ");
    if (cleanSku && cleanName) map[cleanSku] = cleanName;
  });
  return map;
}

function dashboardSkuNameCacheKey(accountId) {
  const safeId = String(accountId || "__single__").trim().replace(/[.$[\]#/\\]/g, "_") || "__single__";
  return `skuNameCache.v1.${safeId}`;
}

function getDashboardSkuNameCache(accountId) {
  return normalizeSkuNameCacheMap(dashboardStore.get(dashboardSkuNameCacheKey(accountId), {}));
}

function mergeDashboardSkuNameCache(accountId, learnedMap) {
  const learned = normalizeSkuNameCacheMap(learnedMap);
  const keys = Object.keys(learned);
  if (!keys.length) {
    const existing = getDashboardSkuNameCache(accountId);
    return { added: 0, updated: 0, total: Object.keys(existing).length };
  }
  const existing = getDashboardSkuNameCache(accountId);
  let added = 0;
  let updated = 0;
  keys.forEach((sku) => {
    if (!existing[sku]) added++;
    else if (existing[sku] !== learned[sku]) updated++;
    existing[sku] = learned[sku];
  });
  dashboardStore.set(dashboardSkuNameCacheKey(accountId), existing);
  return { added, updated, total: Object.keys(existing).length };
}

function dashboardRowSku(row) {
  return String(row && (row.sku || row.products) || "").trim();
}

function cleanDashboardProductName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function hasExplicitDashboardProductName(row) {
  const sku = dashboardRowSku(row);
  const name = cleanDashboardProductName(row && row.productName);
  const products = cleanDashboardProductName(row && row.products);
  return !!name && name !== sku && name !== products;
}

function productNameMapFromDashboardRows(rows) {
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const sku = dashboardRowSku(row);
    if (!sku || map[sku] || !hasExplicitDashboardProductName(row)) return;
    map[sku] = cleanDashboardProductName(row.productName);
  });
  return map;
}

function preserveExistingDashboardProductNames(rows, existingRows) {
  const existingNames = productNameMapFromDashboardRows(existingRows);
  if (!Object.keys(existingNames).length) return rows;
  return (Array.isArray(rows) ? rows : []).map((row) => {
    if (hasExplicitDashboardProductName(row)) return row;
    const sku = dashboardRowSku(row);
    const name = sku ? existingNames[sku] : "";
    return name ? { ...row, productName: name } : row;
  });
}

function normalizeDashboardAccountSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return snapshot || null;
  const next = { ...snapshot };
  next.snapshot = normalizeDashboardProfitRows(next.snapshot || []);
  return next;
}

function normalizeDashboardAccountsSnapshot(accounts) {
  const normalized = {};
  for (const [id, snapshot] of Object.entries(accounts || {})) {
    normalized[id] = normalizeDashboardAccountSnapshot(snapshot);
  }
  return normalized;
}

function dashboardAccountIdentityMeta(account, fallbackId = "") {
  if (!account || typeof account !== "object") return null;
  const id = String(account.id || fallbackId || "").trim();
  return {
    id,
    identityKey: accountIdentityKey(account),
    marketingKey: khodMarketingKeyOf(account),
    khodIdentity: khodEmailIdentityOf(account),
    khodEmail: String(account.khodEmail || "").trim().toLowerCase(),
    easyEmail: String(account.easyEmail || account.email || "").trim().toLowerCase(),
    easyStore: licenseEasyStoreOf(account),
    khodCountry: String(account.khodCountry || account.taagerCountry || "sa").trim().toLowerCase(),
    label: accountDisplayName(account, id || "Account"),
  };
}

function dashboardIdentityMatchScore(left, right) {
  if (!left || !right) return 0;
  let score = 0;
  if (left.identityKey && right.identityKey && left.identityKey === right.identityKey) score += 100;
  if (left.marketingKey && right.marketingKey && left.marketingKey === right.marketingKey) score += 80;
  if (left.khodIdentity && right.khodIdentity && left.khodIdentity === right.khodIdentity) score += 60;
  if (left.khodEmail && right.khodEmail && left.khodEmail === right.khodEmail) score += 40;
  if (left.easyEmail && right.easyEmail && left.easyEmail === right.easyEmail) score += 15;
  if (left.easyStore && right.easyStore && left.easyStore === right.easyStore) score += 15;
  if (left.khodCountry && right.khodCountry && left.khodCountry === right.khodCountry) score += 5;
  return score;
}

function latestDashboardTimestamp(...values) {
  return values.map((value) => Number(value || 0)).filter(Number.isFinite).reduce((max, value) => Math.max(max, value), 0) || null;
}

function mergeDashboardSnapshotRows(primaryRows, secondaryRows) {
  const merged = [];
  const seen = new Set();
  for (const row of [...(Array.isArray(primaryRows) ? primaryRows : []), ...(Array.isArray(secondaryRows) ? secondaryRows : [])]) {
    const key = dashboardRowKey(row) || `idx:${merged.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}

function mergeDashboardAccountSnapshots(primary, secondary, identityMeta) {
  const base = primary && typeof primary === "object" ? primary : {};
  const extra = secondary && typeof secondary === "object" ? secondary : {};
  return {
    ...extra,
    ...base,
    snapshot: mergeDashboardSnapshotRows(base.snapshot, extra.snapshot),
    snapshotMonth: base.snapshotMonth || extra.snapshotMonth || "",
    accountIdentity: identityMeta || base.accountIdentity || extra.accountIdentity || null,
    accountLabel: (identityMeta && identityMeta.label) || base.accountLabel || extra.accountLabel || "",
    autoFetchTimestamp: latestDashboardTimestamp(base.autoFetchTimestamp, extra.autoFetchTimestamp),
    manualFetchTimestamp: latestDashboardTimestamp(base.manualFetchTimestamp, extra.manualFetchTimestamp),
    staticUploadTimestamp: latestDashboardTimestamp(base.staticUploadTimestamp, extra.staticUploadTimestamp),
    botSnapshotTimestamp: latestDashboardTimestamp(base.botSnapshotTimestamp, extra.botSnapshotTimestamp),
  };
}

function reconcileDashboardSnapshotsWithAccounts() {
  const accounts = dashboardStore.get("accounts", {});
  if (!accounts || typeof accounts !== "object") return accounts || {};
  const storedAccounts = store.get("accounts", []) || [];
  if (!Array.isArray(storedAccounts) || !storedAccounts.length) return accounts;

  const currentById = new Map(storedAccounts.filter(Boolean).map((account) => [String(account.id || ""), account]));
  const currentIdentityById = new Map();
  storedAccounts.forEach((account) => {
    const id = String(account && account.id || "");
    if (id) currentIdentityById.set(id, dashboardAccountIdentityMeta(account, id));
  });

  let changed = false;
  const next = { ...accounts };

  for (const [snapshotId, snapshot] of Object.entries(accounts)) {
    if (!snapshot || typeof snapshot !== "object") continue;
    const currentAccount = currentById.get(snapshotId);
    if (currentAccount) {
      if (!snapshot.accountIdentity) {
        next[snapshotId] = {
          ...snapshot,
          accountIdentity: currentIdentityById.get(snapshotId),
          accountLabel: snapshot.accountLabel || accountDisplayName(currentAccount, snapshotId),
        };
        changed = true;
      }
      continue;
    }

    const snapshotIdentity = snapshot.accountIdentity || null;
    if (!snapshotIdentity) continue;

    let best = null;
    for (const [accountId, identity] of currentIdentityById.entries()) {
      const score = dashboardIdentityMatchScore(snapshotIdentity, identity);
      if (score >= 70 && (!best || score > best.score)) best = { accountId, identity, score };
    }
    if (!best || best.accountId === snapshotId) continue;

    next[best.accountId] = mergeDashboardAccountSnapshots(next[best.accountId], snapshot, best.identity);
    delete next[snapshotId];
    changed = true;
    log.info(`[Dashboard] Migrated snapshot from stale account id ${snapshotId} to ${best.accountId}.`);
  }

  if (changed) {
    dashboardStore.set("accounts", next);
    bumpDashboardSnapshotRevision();
  }
  return next;
}

function dashboardDebugSummaryForRange(rows, dateFrom, dateTo, diagnostics) {
  const base = dashboardSummaryForRange(rows, dateFrom, dateTo);
  const from = normalizeDashboardDateKey(dateFrom);
  const to = normalizeDashboardDateKey(dateTo);
  const orderProfitRows = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const dateKey = dashboardRowDateKey(row);
    if (from && to && (!dateKey || dateKey < from || dateKey > to)) continue;
    const orderKey = dashboardOrderOnlyKey(row, orderProfitRows.size);
    if (!orderProfitRows.has(orderKey)) orderProfitRows.set(orderKey, row);
  }

  const profitBuckets = { earned: 0, incoming: 0, lost: 0, ignoredCanceledByYou: 0 };
  const highProfitExamples = [];
  for (const [orderKey, row] of orderProfitRows.entries()) {
    const bucket = dashboardExactStatusBucket(row);
    const profit = dashboardProfitValue(row);
    if (bucket === "canceled_by_you") {
      profitBuckets.ignoredCanceledByYou += profit;
      continue;
    }
    if (bucket === "delivered") profitBuckets.earned += profit;
    else if (dashboardIsLostBucket(bucket)) profitBuckets.lost += profit;
    else if (dashboardIsIncomingBucket(bucket)) profitBuckets.incoming += profit;

    if (Math.abs(profit) >= 5000) {
      highProfitExamples.push({
        order: String(row.khodOrderNumber || row.taagerOrderNumber || row.orderNumber || row.orderId || orderKey).slice(0, 80),
        status: bucket,
        profitAfterTax: profit,
        price: parseDashboardMoney(row.totalPriceRaw || row.totalPrice || row.priceNoShipping || row.orderValue || 0),
        createdAt: dashboardRowDateKey(row)
      });
    }
  }

  highProfitExamples.sort((a, b) => Math.abs(b.profitAfterTax) - Math.abs(a.profitAfterTax));
  return {
    ...base,
    parseDiagnostics: diagnostics || null,
    profitBuckets,
    highProfitExamples: highProfitExamples.slice(0, 8)
  };
}

function dashboardDebugLines(label, rangeFrom, rangeTo, exportFrom, exportTo, existingSummary, incomingSummary, savedSummary) {
  const diag = incomingSummary && incomingSummary.parseDiagnostics || {};
  const enrichment = diag.enrichment || {};
  const highProfit = (incomingSummary.highProfitExamples || []).map((x) =>
    `${x.order}:${x.status}:${x.profitAfterTax}`
  ).join(", ") || "none";
  return [
    `[Dashboard Debug:${label}] selected=${rangeFrom || "?"}..${rangeTo || "?"} export=${exportFrom || "?"}..${exportTo || "?"}`,
    `[Dashboard Debug:${label}] parse sourceRows=${diag.sourceRows ?? "?"} parsedItems=${diag.parsedItemRows ?? "?"} parsedOrders=${diag.parsedOrderCount ?? "?"} skippedNoSku=${diag.skippedNoSku ?? "?"} skippedOutOfRange=${diag.skippedOutOfRange ?? "?"} expandedItems=${diag.expandedItemRows ?? "?"}`,
    `[Dashboard Debug:${label}] easyorders provider=${enrichment.provider || "none"} status=${enrichment.status || "n/a"} nameRows=${enrichment.nameRowsScanned ?? "?"} paymentRows=${enrichment.paymentRowsScanned ?? "?"} learnedSku=${enrichment.learnedSkuNames ?? "?"} cacheHits=${enrichment.cacheHits ?? "?"} paymentMatches=${enrichment.paymentMatches ?? "?"}`,
    `[Dashboard Debug:${label}] incoming raw=${incomingSummary.rawOrders} net=${incomingSummary.netOrders} canceledByYou=${incomingSummary.canceledByYou} delivered=${incomingSummary.delivered} confirmed=${incomingSummary.confirmed} itemRows=${incomingSummary.itemRows}`,
    `[Dashboard Debug:${label}] existing raw=${existingSummary.rawOrders} net=${existingSummary.netOrders} canceledByYou=${existingSummary.canceledByYou} delivered=${existingSummary.delivered} confirmed=${existingSummary.confirmed} itemRows=${existingSummary.itemRows}`,
    `[Dashboard Debug:${label}] saved raw=${savedSummary.rawOrders} net=${savedSummary.netOrders} canceledByYou=${savedSummary.canceledByYou} delivered=${savedSummary.delivered} confirmed=${savedSummary.confirmed} itemRows=${savedSummary.itemRows}`,
    `[Dashboard Debug:${label}] status incoming=${JSON.stringify(incomingSummary.statusBreakdown || {})}`,
    `[Dashboard Debug:${label}] profit incoming earned=${Math.round(incomingSummary.profitBuckets.earned)} incoming=${Math.round(incomingSummary.profitBuckets.incoming)} lost=${Math.round(incomingSummary.profitBuckets.lost)} ignoredCanceledByYou=${Math.round(incomingSummary.profitBuckets.ignoredCanceledByYou)}`,
    `[Dashboard Debug:${label}] highProfitExamples=${highProfit}`
  ];
}

function validateDashboardSnapshotReplacement(existingRows, incomingRows, dateFrom, dateTo, diagnostics) {
  const incoming = dashboardSummaryForRange(incomingRows, dateFrom, dateTo);
  const existing = dashboardSummaryForRange(existingRows, dateFrom, dateTo);
  const hasComparableExisting = existing.rawOrders >= 50;
  const rawDrop = existing.rawOrders - incoming.rawOrders;
  const netDrop = existing.netOrders - incoming.netOrders;
  const itemDrop = existing.itemRows - incoming.itemRows;
  const suspicious = hasComparableExisting && (rawDrop > 0 || netDrop > 0 || itemDrop > Math.max(2, Math.ceil(existing.itemRows * 0.005)));
  return {
    ok: true,
    suspicious,
    warning: suspicious
      ? `Dashboard snapshot count changed for ${dateFrom || "?"} - ${dateTo || "?"}. Existing raw/net/items ${existing.rawOrders}/${existing.netOrders}/${existing.itemRows}, incoming ${incoming.rawOrders}/${incoming.netOrders}/${incoming.itemRows}.`
      : "",
    existing,
    incoming,
    diagnostics: diagnostics || null
  };
}

function staticDashboardPeriodMismatch(processed) {
  const diagnostics = processed && processed.parseDiagnostics || {};
  const sourceRows = Number(diagnostics.sourceRows || 0);
  const parsedRows = Number(diagnostics.parsedRows || 0);
  const rowsOutsidePeriod = Number(diagnostics.rowsOutsidePeriod || 0);
  const datedRows = Number(diagnostics.datedSourceRows || 0);
  const skippedOutOfRange = Number(diagnostics.skippedOutOfRange || 0);
  const parsedItems = Number(diagnostics.parsedItemRows || 0);
  const sourceDateFrom = diagnostics.sourceDateFrom || "";
  const sourceDateTo = diagnostics.sourceDateTo || "";
  const dateFrom = processed && processed.dateFrom || diagnostics.dateFrom || "";
  const dateTo = processed && processed.dateTo || diagnostics.dateTo || "";
  const khodPeriodMismatch = diagnostics.source === "khod-sheet" &&
    sourceRows > 0 &&
    parsedRows === 0 &&
    rowsOutsidePeriod >= sourceRows &&
    dateFrom &&
    dateTo;
  if (khodPeriodMismatch) {
    return {
      code: "KHOD_DASHBOARD_PERIOD_MISMATCH",
      selectedDateFrom: dateFrom,
      selectedDateTo: dateTo,
      sourceRows,
      parsedRows,
      rowsOutsidePeriod,
      count: rowsOutsidePeriod,
      message: `The uploaded KHOD WHAAT orders sheet has no rows in the selected dashboard period ${dateFrom} - ${dateTo}. Select the period that matches the KHOD WHAAT orders sheet, then upload/update again.`,
    };
  }
  const allDatedRowsOutsideRange = sourceRows > 0 &&
    datedRows > 0 &&
    parsedItems === 0 &&
    skippedOutOfRange >= datedRows &&
    sourceDateFrom &&
    sourceDateTo &&
    dateFrom &&
    dateTo;
  if (!allDatedRowsOutsideRange) return null;
  return {
    selectedDateFrom: dateFrom,
    selectedDateTo: dateTo,
    sourceDateFrom,
    sourceDateTo,
    sourceRows,
    datedRows,
    skippedOutOfRange,
    count: skippedOutOfRange,
    code: "KHOD_DASHBOARD_PERIOD_MISMATCH",
    message: `The uploaded KHOD WHAAT orders sheet contains orders dated ${sourceDateFrom} - ${sourceDateTo}, but the selected dashboard period is ${dateFrom} - ${dateTo}. Select the matching period for the KHOD WHAAT orders sheet, then upload/update again.`,
  };
}

function replaceDashboardRowsInRange(existingRows, incomingRows, dateFrom, dateTo) {
  const from = normalizeDashboardDateKey(dateFrom);
  const to = normalizeDashboardDateKey(dateTo);
  return replaceRowsInDateRange(existingRows, incomingRows, from, to, {
    rowKey: dashboardRowKey,
    rowDateKey: dashboardRowDateKey,
  });
}

function enrichAnalyticsRunsFromKhodRows(accountId, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  const khodMap = new Map();
  for (const row of rows) {
    const key = khodSnapshotRowKey(row);
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
      const khodRow = khodMap.get(analyticsOrderKey(order, run.khodCountry || run.taagerCountry));
      if (!khodRow) return order;
      const merged = mergeKhodSnapshotRowIntoOrder(order, khodRow);
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

function enrichOrdersFromKhodRows(orders, khodRows, fallbackCountry = "sa") {
  if (!Array.isArray(orders) || orders.length === 0 || !Array.isArray(khodRows) || khodRows.length === 0) {
    return { orders: Array.isArray(orders) ? orders : [], changed: 0 };
  }
  const khodMap = new Map();
  for (const row of khodRows) {
    const key = khodSnapshotRowKey(row, fallbackCountry);
    if (key) khodMap.set(key, row);
  }
  if (khodMap.size === 0) return { orders, changed: 0 };

  let changed = 0;
  const enriched = orders.map((order) => {
    const khodRow = khodMap.get(analyticsOrderKey(order, order.khodCountry || order.taagerCountry || fallbackCountry));
    if (!khodRow) return order;
    const merged = mergeKhodSnapshotRowIntoOrder(order, khodRow);
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

function persistDashboardSnapshot(accountId, data, options = {}) {
  if (!accountId || !data || !Array.isArray(data.snapshot)) throw new Error("Dashboard snapshot data is invalid.");
  const rows = normalizeDashboardProfitRows(data.snapshot || []);
  const accounts = dashboardStore.get("accounts", {});
  const storedAccount = getStoredAccountById(accountId) || staticDashboardAccount(accountId);
  const identityMeta = dashboardAccountIdentityMeta(storedAccount, accountId);
  if (!accounts[accountId]) accounts[accountId] = {};
  const rangeFrom = data.dateFrom || "";
  const rangeTo = data.dateTo || "";
  const validation = validateDashboardSnapshotReplacement(accounts[accountId].snapshot, rows, rangeFrom, rangeTo, data.parseDiagnostics);
  if (validation.suspicious) console.warn(`[Dashboard] ${validation.warning}`);
  const requiresConfirmation = validation.suspicious || rows.length === 0;
  if (requiresConfirmation && options.requireConfirmation && !options.allowSuspiciousReplacement) {
    return { saved: false, requiresConfirmation, rows, validation, warnings: data.warnings || [] };
  }
  const mergedRows = replaceDashboardRowsInRange(accounts[accountId].snapshot, rows, rangeFrom, rangeTo);
  const savedInRange = dashboardSummaryForRange(mergedRows, rangeFrom, rangeTo);
  if (rangeFrom && rangeTo && savedInRange.itemRows < rows.length) {
    console.warn(`[Dashboard] Saved fewer in-range dashboard rows than parsed for ${accountId}: parsed=${rows.length}, savedInRange=${savedInRange.itemRows}`);
  }
  accounts[accountId].snapshot = mergedRows;
  accounts[accountId].snapshotMonth = data.snapshotMonth || "";
  accounts[accountId].accountIdentity = identityMeta;
  accounts[accountId].accountLabel = identityMeta && identityMeta.label || accounts[accountId].accountLabel || "";
  accounts[accountId].enrichmentDiagnostics = data.enrichmentDiagnostics || data.parseDiagnostics?.enrichment || null;
  accounts[accountId].lastFetchRange = {
    dateFrom: rangeFrom,
    dateTo: rangeTo,
    exportDateFrom: data.exportDateFrom || "",
    exportDateTo: data.exportDateTo || "",
    rows: rows.length,
    savedRowsInRange: savedInRange.itemRows,
    savedRawOrdersInRange: savedInRange.rawOrders,
    source: options.source || "bot",
    validation,
    parseDiagnostics: data.parseDiagnostics || null,
    enrichment: data.enrichmentDiagnostics || data.parseDiagnostics?.enrichment || null,
  };
  accounts[accountId][options.timestampKey || "botSnapshotTimestamp"] = Date.now();
  dashboardStore.set("accounts", accounts);
  bumpDashboardSnapshotRevision();
  analyticsSnapshotSyncCacheKey = "";
  const enriched = options.enrichAnalytics === false ? 0 : enrichAnalyticsRunsFromKhodRows(accountId, rows);
  return { saved: true, requiresConfirmation, rows, validation, mergedRows, enriched, warnings: data.warnings || [] };
}

function saveDashboardSnapshotRows(accountId, data, source) {
  if (!accountId || !data || !Array.isArray(data.snapshot)) return 0;
  return persistDashboardSnapshot(accountId, data, { source: source || "bot" }).rows.length;
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
  if (total > 0) console.log(`[Analytics] Synced ${total} stored orders from dashboard snapshots`);
  return total;
}

const MONTHLY_DATA_CLEANUP_LAST_RUN_KEY = "monthlyDataCleanupLastRun";
const MONTHLY_DATA_CLEANUP_LAST_RESULT_KEY = "monthlyDataCleanupLastResult";

function getMonthlyCleanupStatus(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const cutoff = monthlyCleanupCutoff(now);
  const lastRunMonth = String(dashboardStore.get(MONTHLY_DATA_CLEANUP_LAST_RUN_KEY, "") || "");
  return {
    ok: true,
    cleanupDay: MONTHLY_DATA_CLEANUP_DAY,
    currentMonth: monthlyCleanupMonthKey(now),
    cutoffDate: cutoff.cutoffDateKey,
    lastRunMonth,
    eligible: monthlyCleanupEligible({
      now,
      cleanupDay: MONTHLY_DATA_CLEANUP_DAY,
      lastRunMonth,
      force: false,
    }),
    nextEligibleDate: nextMonthlyCleanupDateKey({
      now,
      cleanupDay: MONTHLY_DATA_CLEANUP_DAY,
      lastRunMonth,
    }),
    lastResult: dashboardStore.get(MONTHLY_DATA_CLEANUP_LAST_RESULT_KEY, null),
  };
}

function runMonthlyDataCleanup(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const force = options.force === true;
  const status = getMonthlyCleanupStatus({ now });
  if (!force && !status.eligible) {
    return { ok: true, skipped: true, reason: "not_eligible", status };
  }

  const cutoff = monthlyCleanupCutoff(now);
  const analyticsPrune = pruneAnalyticsRunsForCurrentMonth(
    analyticsStore.get("runs", []),
    cutoff.cutoffTime
  );
  const dashboardPrune = pruneDashboardAccountsForCurrentMonth(
    dashboardStore.get("accounts", {}),
    cutoff.cutoffDateKey,
    dashboardRowDateKey
  );

  if (analyticsPrune.removed > 0) {
    analyticsStore.set("runs", analyticsPrune.runs);
    invalidateAnalyticsRunsCache();
  }

  if (dashboardPrune.changed) {
    dashboardStore.set("accounts", dashboardPrune.accounts);
    bumpDashboardSnapshotRevision();
  }

  const changed = analyticsPrune.removed > 0 || dashboardPrune.removedRows > 0;
  if (changed) {
    analyticsSnapshotSyncCacheKey = "";
    dashboardQueryService.clearCache();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("reset-cache");
    }
  }

  const result = {
    ok: true,
    skipped: false,
    cleanupDay: MONTHLY_DATA_CLEANUP_DAY,
    monthKey: cutoff.monthKey,
    cutoffDate: cutoff.cutoffDateKey,
    analyticsRunsRemoved: analyticsPrune.removed,
    analyticsRunsKept: analyticsPrune.runs.length,
    dashboardRowsRemoved: dashboardPrune.removedRows,
    dashboardAccountsTouched: dashboardPrune.touchedAccounts,
    changed,
    ranAt: now.toISOString(),
  };

  dashboardStore.set(MONTHLY_DATA_CLEANUP_LAST_RUN_KEY, cutoff.monthKey);
  dashboardStore.set(MONTHLY_DATA_CLEANUP_LAST_RESULT_KEY, result);
  if (changed) {
    log.info(`[MonthlyCleanup] Removed ${analyticsPrune.removed} analytics runs and ${dashboardPrune.removedRows} dashboard rows before ${cutoff.cutoffDateKey}.`);
  } else {
    log.info(`[MonthlyCleanup] Checked ${cutoff.monthKey}; no old reporting data found.`);
  }
  return result;
}

const monthlyDataCleanupScheduler = createMonthlyCleanupScheduler({
  runCleanup: () => runMonthlyDataCleanup(),
  onError: (error) => {
    log.error("[MonthlyCleanup] Scheduled cleanup failed:", error && error.message ? error.message : error);
    monitoring.captureException(error, { operation: "monthlyDataCleanup.scheduled" });
  },
});

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
const LICENSE_PRESENCE_INTERVAL_MS = 60 * 1000;
let licensePresenceTimer = null;
let licensePresenceRpcWarned = false;

function isValidKeyFormat(key) {
  return /^KHOD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key.trim().toUpperCase());
}

function rememberBulkOrderAccessFromLicense(row) {
  const email = String(row && row.bulk_orders_email || "").trim();
  const password = String(row && row.bulk_orders_password || "").trim();
  if (email || password) {
    licenseStore.set("bulkOrdersEmail", email);
    licenseStore.set("bulkOrdersPassword", password);
  } else {
    licenseStore.delete("bulkOrdersEmail");
    licenseStore.delete("bulkOrdersPassword");
  }
}

function verifyBulkOrderAccessInput(input = {}) {
  const expectedEmail = String(licenseStore.get("bulkOrdersEmail", "") || "").trim().toLowerCase();
  const expectedPassword = String(licenseStore.get("bulkOrdersPassword", "") || "").trim();
  if (!expectedEmail || !expectedPassword) return { success: false, error: "BULK_ORDERS_LOCK_NOT_CONFIGURED" };
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "").trim();
  return {
    success: email === expectedEmail && password === expectedPassword,
    error: "BULK_ORDERS_ACCESS_DENIED",
  };
}

function isBulkOrderAccessConfigured() {
  const expectedEmail = String(licenseStore.get("bulkOrdersEmail", "") || "").trim();
  const expectedPassword = String(licenseStore.get("bulkOrdersPassword", "") || "").trim();
  return !!(expectedEmail && expectedPassword);
}

async function isLicenseValid() {
  const key = licenseStore.get("licenseKey", "");
  if (!key) {
    stopLicensePresenceHeartbeat();
    return false;
  }
  if (_licenseCache && (Date.now() - _licenseCacheAt) < LICENSE_CACHE_TTL_MS) {
    const cached = evaluateCachedLicense(_licenseCache);
    if (cached.expired) {
      _licenseCache = null;
      _licenseCacheAt = 0;
      stopLicensePresenceHeartbeat();
      return false;
    }
    _licenseCache = cached.result;
    if (_licenseCache.valid === true) startLicensePresenceHeartbeat();
    else stopLicensePresenceHeartbeat();
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
      const reason = r?.reason || "License not found on server.";
      const savedExpired = _getExpiredSavedLicenseResult(key);
      if (savedExpired && reason === "License not found on server.") {
        log.warn(`[License] Server reported key "${key}" as missing during validity check, but local expiry metadata is expired. Keeping saved key for the expired overlay.`);
        stopLicensePresenceHeartbeat();
        return false;
      }
      if (!r || reason === "License not found on server.") {
        log.warn(`[License] Key "${key}" not found on server. Clearing local licenseKey.`);
        licenseStore.delete("licenseKey");
      }
      stopLicensePresenceHeartbeat();
      return false;
    }
    if (r.force_flush) _handleForceFlush();
    if (r.reset_cache) _handleResetCache();
    rememberBulkOrderAccessFromLicense(r);
    const expiresAt = r.expires_at || null;
    _saveLastValidResult(evaluateCachedLicense({ valid: true, key, expiresAt }).result);
    startLicensePresenceHeartbeat();
    return true;
  } catch {
    const grace = _getOfflineGraceResult();
    if (!grace) stopLicensePresenceHeartbeat();
    return !!grace;
  }
}

async function recordLicensePresence() {
  const key = licenseStore.get("licenseKey", "");
  if (!key) return false;
  try {
    const result = await supabaseRpc("khod_record_license_presence", {
      p_license_key: key,
      p_machine_uuid: _getOrCreateMachineUUID(),
      p_device_id: getDeviceFingerprint(),
    });
    const ok = result && result.ok === true;
    if (ok) licensePresenceRpcWarned = false;
    return ok;
  } catch (error) {
    if (!licensePresenceRpcWarned) {
      licensePresenceRpcWarned = true;
      log.warn("[LicensePresence] Heartbeat failed:", error && error.message ? error.message : error);
    }
    return false;
  }
}

function startLicensePresenceHeartbeat() {
  recordLicensePresence();
  if (licensePresenceTimer) return;
  licensePresenceTimer = setInterval(() => {
    recordLicensePresence();
  }, LICENSE_PRESENCE_INTERVAL_MS);
  if (typeof licensePresenceTimer.unref === "function") licensePresenceTimer.unref();
}

function stopLicensePresenceHeartbeat() {
  if (licensePresenceTimer) {
    clearInterval(licensePresenceTimer);
    licensePresenceTimer = null;
  }
}

// ════════════════════════════════════════
// TRAY
// ════════════════════════════════════════
function createTray() {
  const iconPath = getIconPath();
  console.log("[tray] icon path:", iconPath, "| exists:", require("fs").existsSync(iconPath));
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
  tray.setToolTip("KHOD WHAAT Orders");
  updateTrayMenu();
  tray.on("click", () => { if (mainWindow.isVisible()) mainWindow.hide(); else { mainWindow.show(); mainWindow.focus(); } });
}
function updateTrayMenu() {
  if (!tray) return;
  const label = autoRunEnabled && autoRunTimer ? "Auto-Run: ON" : "Auto-Run: OFF";
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "KHOD WHAAT Orders", enabled: false }, { type: "separator" },
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
  const launchMinimized = store.get("launchMinimized", false) === true;
  const autoRunOn = store.get("autoRun", false) === true;
  const startHiddenInTray = launchMinimized && autoRunOn;

  mainWindow = new BrowserWindow({
    width: 1100, height: 750, minWidth: 760, minHeight: 560,
    frame: false, titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Sandboxed preloads cannot require package.json or Node's path module.
      additionalArguments: [`--khod-app-version=${app.getVersion()}`],
      // V8 snapshot: reuse compiled bytecode across launches
      v8CacheOptions: "bypassHeatCheck",
      // Disable spell check — saves renderer init time for a non-document app
      spellcheck: false,
    },
    backgroundColor: bgColor, icon: getIconPath(), show: false,
  });
  monitoring.monitorWindow(mainWindow, "main");
  installAppZoomControls(mainWindow);
  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    log.error("[Preload] preload-error:", preloadPath, error && error.stack ? error.stack : error);
    monitoring.captureException(error, { operation: "preload.error", extra: { preloadPath } });
  });
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  mainWindow.once("ready-to-show", () => {
    if (startHiddenInTray) {
      mainWindow.hide();
      return;
    }
    mainWindow.show();
    mainWindow.maximize();
    mainWindow.focus();
  });
  mainWindow.on("close", (e) => {
    if (app.isQuitting) return;
    if (!mainWindow.isVisible()) {
      app.isQuitting = true;
      app.quit();
      return;
    }
    e.preventDefault();
    const autoRunOn = store.get("autoRun", false);
    const { response } = dialog.showMessageBoxSync(mainWindow, {
      type: "question", buttons: ["Minimize to Tray", "Close App"],
      defaultId: 0, cancelId: 0, title: "Close KHOD WHAAT Orders?",
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
      if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents || mainWindow.webContents.isDestroyed()) {
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
    log.info(`[Analytics] Purged ${runs.length - filtered.length} old runs (>${daysToKeep}d)`);
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  autoRunEnabled = store.get("autoRun", false);
  if (autoRunEnabled) scheduleAutoRun();
  monthlyDataCleanupScheduler.start();
  purgeOldAnalyticsRuns(store.get("analyticsPurgeDays", 30));

  if (app.isPackaged) {
    setTimeout(() => {
      log.info("[AutoUpdate] Startup auto-update check triggered (3s delay)");
      autoUpdater.checkForUpdates().catch(err => {
        log.error("[AutoUpdate] Startup checkForUpdates failed:", err.message);
        monitoring.captureException(err, { operation: "autoUpdater.startupCheck" });
      });
    }, 3000);
  } else {
    log.info("[AutoUpdate] Skipping startup update check - app is not packaged");
  }
});
app.on("before-quit", () => {
  app.isQuitting = true;
  stopLicensePresenceHeartbeat();
  monthlyDataCleanupScheduler.stop();
});

app.on("window-all-closed", () => {});

autoUpdater.on("checking-for-update", () => {
  log.info("[AutoUpdate] Checking for update...");
});

autoUpdater.on("update-available", (info) => {
  log.info(`[AutoUpdate] Update available - version=${info.version} releaseDate=${info.releaseDate}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-available", { version: info.version });
  }
});

autoUpdater.on("update-not-available", (info) => {
  log.info(`[AutoUpdate] No update available - latestVersion=${info?.version}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-not-available");
  }
});

autoUpdater.on("download-progress", (progress) => {
  log.info(`[AutoUpdate] Download progress - ${Math.round(progress.percent)}%`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-progress", {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    });
  }
});

autoUpdater.on("update-downloaded", (info) => {
  log.info(`[AutoUpdate] Update downloaded - version=${info.version}`);
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
  log.info("[AutoUpdate] IPC check-for-updates received");
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
  log.info("[AutoUpdate] IPC download-update received - starting download");
  autoUpdater.downloadUpdate();
  return { ok: true };
});

ipcMain.handle("install-update", () => {
  log.info("[AutoUpdate] IPC install-update received - launching installer independently");

  // ── Why quitAndInstall() alone doesn't work with a tray app ────────────
  // quitAndInstall() relies on Electron's app.quit() flow, which fires
  // will-quit, before-quit, window-all-closed, etc.  When the app lives in
  // the tray (window hidden, process still running) those events don't
  // cleanly terminate all native handles fast enough.  NSIS checks for the
  // running process right after spawning and shows "cannot be closed" if it
  // finds it still alive.
  //
  // Solution: find the already-downloaded installer in electron-updater's
  // temp cache, spawn it as a fully detached independent process, then
  // hard-exit THIS process immediately.  The installer runs on its own —
  // it no longer needs this process to be alive.
  // ─────────────────────────────────────────────────────────────────────────

  const { spawn } = require("child_process");
  const os = require("os");

  // electron-updater stores the downloaded installer in the OS temp dir.
  // The file name matches the artifactName pattern from package.json.
  // We search for it rather than hardcode the version.
  function findDownloadedInstaller() {
    // Prefer electron-updater's own cache entry. This is the authoritative
    // downloaded file and avoids selecting an older installer left in %TEMP%.
    try {
      const helper = autoUpdater._downloadedUpdateHelper;
      if (helper && helper.downloadedFileInfo && helper.downloadedFileInfo.path) {
        return helper.downloadedFileInfo.path;
      }
    } catch (_) {}

    // Windows fallback for updater versions that do not expose the helper path.
    if (process.platform === "win32") {
      const tmpDir = os.tmpdir();
      try {
        const files = fs.readdirSync(tmpDir);
        // Match the package.json artifactName, e.g.
        // "Khod.Whaat.Orders.Setup.1.0.15.exe".
        const match = files
          .filter(f => /^Khod\.Whaat\.Orders\.Setup\.\d+\.\d+\.\d+\.exe$/i.test(f))
          .sort()
          .pop();
        if (match) return path.join(tmpDir, match);
      } catch (_) {}
    }

    return null;
  }

  function launchInstallerAfterExit(installerPath) {
    if (process.platform !== "win32") {
      const child = spawn(installerPath, ["--updated"], {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });
      child.unref();
      return child;
    }

    // Delay NSIS until this process has disappeared.  Starting it directly
    // races the installer's running-process check when the app was hidden in
    // the system tray.
    const comspec = process.env.ComSpec || "cmd.exe";
    const quotedInstaller = `"${String(installerPath).replace(/"/g, '""')}"`;
    const command = `ping 127.0.0.1 -n 3 > nul & start "" ${quotedInstaller} --updated`;
    const child = spawn(comspec, ["/d", "/s", "/c", command], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    return child;
  }

  // 1. Tear everything down
  app.isQuitting = true;
  app.__sentryFlushed = true;
  clearAutoRun();

  const toKill = botChildren.length ? botChildren : (currentBotChild ? [currentBotChild] : []);
  for (const child of toKill) { try { child.kill("SIGKILL"); } catch (_) {} }
  currentBotChild = null;
  botChildren = [];
  botRunning = false;

  try {
    if (tray && !tray.isDestroyed()) {
      tray.removeAllListeners();
      tray.destroy();
    }
  } catch (_) {}
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.removeAllListeners("close");
      mainWindow.destroy();
    }
  } catch (_) {}

  // 2. Try to find and launch the installer ourselves (detached, independent)
  const installerPath = findDownloadedInstaller();
  log.info("[AutoUpdate] Installer path found:", installerPath || "NOT FOUND — falling back to quitAndInstall");

  if (installerPath && fs.existsSync(installerPath)) {
    try {
      launchInstallerAfterExit(installerPath);
      log.info("[AutoUpdate] Delayed installer helper spawned, exiting now");
    } catch (spawnErr) {
      log.error("[AutoUpdate] Failed to spawn installer:", spawnErr.message);
      // Fall through to quitAndInstall below
    }
    // Hard-exit immediately — installer is running on its own
    process.exit(0);
    return;
  }

  // 3. Fallback: couldn't find installer file, use quitAndInstall + hard exit
  log.warn("[AutoUpdate] Installer file not found, falling back to quitAndInstall");
  try { autoUpdater.quitAndInstall(false, true); } catch (_) {}
  setTimeout(() => process.exit(0), 500);
});

ipcMain.handle("get-app-version", () => app.getVersion());

// ════════════════════════════════════════
// IPC — Window
// ════════════════════════════════════════
ipcMain.on("window-minimize", () => mainWindow.minimize());
ipcMain.on("window-maximize", () => { if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize(); });
ipcMain.on("window-close", () => mainWindow.hide());
ipcMain.handle("get-app-zoom", () => getSavedAppZoom());
ipcMain.on("increase-app-zoom", () => stepAppZoom(1));
ipcMain.on("decrease-app-zoom", () => stepAppZoom(-1));
ipcMain.on("reset-app-zoom", () => applyAppZoom(DEFAULT_APP_ZOOM));

// ════════════════════════════════════════
// IPC — License (server-based, auto device lock)
// Handlers registered below after _checkLicenseImpl is defined.
// ════════════════════════════════════════

// ════════════════════════════════════════
// IPC — Credentials — Multi-Account Edition
// ════════════════════════════════════════

const OFFLINE_GRACE_MS = 48 * 60 * 60 * 1000;
const STARTUP_LICENSE_FAST_PATH_MS = 6 * 60 * 60 * 1000;
const LICENSE_WARNING_DAYS = 3;

function _saveLastValidResult(result) {
  const previous = licenseStore.get("lastValidResult", null);
  const { adminNotification: _ignored, ...nextResult } = result || {};
  const canMerge = previous && previous.key && nextResult.key && previous.key === nextResult.key;
  const persistableResult = canMerge ? { ...previous, ...nextResult } : nextResult;
  licenseStore.set("lastValidResult", persistableResult);
  licenseStore.set("lastValidAt", Date.now());
}

function _getOfflineGraceResult() {
  const lastValidAt = licenseStore.get("lastValidAt", 0);
  const lastResult  = licenseStore.get("lastValidResult", null);
  if (!lastResult || !lastResult.valid) return null;
  const age = Date.now() - lastValidAt;
  if (age > OFFLINE_GRACE_MS) return null;
  const cached = evaluateCachedLicense(lastResult);
  if (cached.expired) {
    log.warn("[License] Offline grace rejected because the known license expiry has passed.");
    return null;
  }
  if (!cached.hasKnownExpiry) {
    log.warn("[License] Offline grace rejected for legacy cache without expiry metadata.");
    return null;
  }
  const hoursLeft = Math.ceil((OFFLINE_GRACE_MS - age) / 3600000);
  log.warn(`[License] Offline grace active - last valid ${Math.round(age / 60000)} min ago, ${hoursLeft}h left`);
  const { adminNotification: _ignored, ...offlineResult } = cached.result;
  return { ...offlineResult, adminNotification: null, offline: true };
}

function _getStartupCachedLicenseResult() {
  const key = licenseStore.get("licenseKey", "");
  const lastValidAt = licenseStore.get("lastValidAt", 0);
  const lastResult = licenseStore.get("lastValidResult", null);
  if (!key || !lastResult || !lastResult.valid || lastResult.key !== key) return null;
  if ((Date.now() - lastValidAt) > STARTUP_LICENSE_FAST_PATH_MS) return null;
  const cached = evaluateCachedLicense(lastResult);
  if (cached.expired || !cached.hasKnownExpiry) return null;
  if (isInsideWarningWindow(cached, LICENSE_WARNING_DAYS)) return null;
  const { adminNotification: _ignored, ...startupResult } = cached.result;
  return { ...startupResult, adminNotification: null, startupCached: true };
}

function _getExpiredSavedLicenseResult(key) {
  const lastResult = licenseStore.get("lastValidResult", null);
  if (!key || !lastResult || !lastResult.valid || lastResult.key !== key) return null;
  const cached = evaluateCachedLicense(lastResult);
  if (!cached.expired || !cached.hasKnownExpiry) return null;
  return {
    ...cached.result,
    valid: false,
    key,
    customerName: cached.result.customerName || licenseStore.get("customerName", "") || null,
    daysLeft: 0,
    reason: "License expired. Please renew.",
  };
}

async function _getActiveAdminNotification(key) {
  return fetchActiveAdminNotification(supabaseRpc, key, log);
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

function _handleResetCache() {
  log.warn("[License] Reset cache received - wiping local metrics and dashboard cache.");
  try { analyticsStore.clear(); } catch (_) {}
  try { dashboardStore.clear(); } catch (_) {}
  invalidateAnalyticsRunsCache();
  analyticsSnapshotSyncCacheKey = "";
  dashboardQueryService.clearCache();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("reset-cache");
  }
}

async function _checkLicenseImpl(bustCache) {
  const key = licenseStore.get("licenseKey", "");
  if (!key) {
    stopLicensePresenceHeartbeat();
    return { valid: false, reason: "No license key." };
  }
  if (!bustCache && _licenseCache && (Date.now() - _licenseCacheAt) < LICENSE_CACHE_TTL_MS) {
    const cached = evaluateCachedLicense(_licenseCache);
    if (cached.expired) {
      _licenseCache = null;
      _licenseCacheAt = 0;
      stopLicensePresenceHeartbeat();
    } else {
      _licenseCache = cached.result;
      if (_licenseCache.valid === true) startLicensePresenceHeartbeat();
      else stopLicensePresenceHeartbeat();
      return _licenseCache;
    }
  }
  if (!bustCache) {
    const startupCached = _getStartupCachedLicenseResult();
    if (startupCached) {
      _licenseCache = startupCached;
      _licenseCacheAt = Date.now();
      if (startupCached.valid === true) startLicensePresenceHeartbeat();
      else stopLicensePresenceHeartbeat();
      return startupCached;
    }
  }
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
      const reason = r?.reason || "License not found on server.";
      const savedExpired = _getExpiredSavedLicenseResult(key);
      if (savedExpired && reason === "License not found on server.") {
        log.warn(`[License] Server reported key "${key}" as missing, but local expiry metadata is expired. Keeping expired overlay context.`);
        stopLicensePresenceHeartbeat();
        return savedExpired;
      }
      if (!r || reason === "License not found on server.") {
        log.warn(`[License] Key "${key}" not found on server. Clearing local licenseKey.`);
        licenseStore.delete("licenseKey");
      }
      stopLicensePresenceHeartbeat();
      return {
        valid: false,
        key,
        customerName: licenseStore.get("customerName", "") || null,
        daysLeft: licenseStore.get("daysLeft", null),
        reason,
      };
    }

    // Handle force flush: wipe local data and notify renderer.
    // Return valid:true here so the IPC caller doesn't also trigger the expired overlay —
    // the renderer navigates to the license screen exclusively via the force-flush event.
    if (r.force_flush) {
      _handleForceFlush();
      startLicensePresenceHeartbeat();
      return { valid: true, forceFlush: true };
    }
    if (r.reset_cache) {
      _handleResetCache();
      startLicensePresenceHeartbeat();
      return { valid: true, resetCache: true };
    }

    const expiresAt = r.expires_at || null;
    const daysLeft = evaluateCachedLicense({ expiresAt }).result.daysLeft ?? null;
    const customerName = r.customer_name || null;
    if (customerName) licenseStore.set("customerName", customerName);
    if (daysLeft !== null) licenseStore.set("daysLeft", daysLeft);
    licenseStore.set("allowReset", false);
    if (r.max_accounts) licenseStore.set("maxAccounts", r.max_accounts);
    if (r.max_devices) licenseStore.set("maxDevices", r.max_devices);
    if (r.active_devices !== undefined) licenseStore.set("activeDevices", r.active_devices);
    const operationsSuiteEnabled = r.analytics_enabled !== false || r.operations_enabled !== false;
    const teamLeaderEnabled = r.team_leader_enabled === true;
    rememberBulkOrderAccessFromLicense(r);
    licenseStore.set("analyticsEnabled",  operationsSuiteEnabled);
    licenseStore.set("operationsEnabled", operationsSuiteEnabled);
    licenseStore.set("dashboardEnabled",  r.dashboard_enabled === true || teamLeaderEnabled);
    licenseStore.set("teamLeaderEnabled", teamLeaderEnabled);
    const result = {
      valid: true, key, daysLeft, expiresAt, customerName, allowReset: false,
      maxDevices: r.max_devices || licenseStore.get("maxDevices", 1),
      activeDevices: r.active_devices || licenseStore.get("activeDevices", 1),
      analyticsEnabled:  operationsSuiteEnabled,
      operationsEnabled: operationsSuiteEnabled,
      dashboardEnabled:  r.dashboard_enabled === true || teamLeaderEnabled,
      teamLeaderEnabled,
      adminNotification: await _getActiveAdminNotification(key),
    };
    _licenseCache = result;
    _licenseCacheAt = Date.now();
    _saveLastValidResult(result);
    startLicensePresenceHeartbeat();
    return result;
  } catch (e) {
    log.warn("[License] License check failed:", e.message);
    const grace = _getOfflineGraceResult();
    if (grace) return grace;
    stopLicensePresenceHeartbeat();
    const cached = evaluateCachedLicense(licenseStore.get("lastValidResult", null));
    return {
      valid: false,
      key,
      customerName: licenseStore.get("customerName", "") || null,
      daysLeft: cached.expired ? 0 : licenseStore.get("daysLeft", null),
      reason: cached.expired
        ? "License expired. Please renew."
        : "Cannot reach license server. Check your internet connection.",
    };
  }
}

ipcMain.handle("check-license", async () => _checkLicenseImpl(false));
ipcMain.handle("check-license-nocache", async () => _checkLicenseImpl(true));
ipcMain.handle("get-license-credential-backup-status", async () => getLicenseCredentialBackupStatus());
ipcMain.handle("get-license-credential-backup-prompt-status", async () => getLicenseCredentialBackupPromptStatus());
ipcMain.handle("backup-license-credentials-now", async () => backupLicenseCredentialsNow());
ipcMain.handle("restore-license-credentials", async () => restoreLicenseCredentialsFromBackup());
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
    const expiresAt = r.expires_at || null;
    const daysLeft = evaluateCachedLicense({ expiresAt }).result.daysLeft ?? null;
    const customerName = r.customer_name || null;
    licenseStore.set("licenseKey", clean);
    if (customerName) licenseStore.set("customerName", customerName);
    if (daysLeft !== null) licenseStore.set("daysLeft", daysLeft);
    if (r.max_accounts) licenseStore.set("maxAccounts", r.max_accounts);
    if (r.max_devices) licenseStore.set("maxDevices", r.max_devices);
    if (r.active_devices !== undefined) licenseStore.set("activeDevices", r.active_devices);
    const operationsSuiteEnabled = r.analytics_enabled !== false || r.operations_enabled !== false;
    const teamLeaderEnabled = r.team_leader_enabled === true;
    rememberBulkOrderAccessFromLicense(r);
    licenseStore.set("analyticsEnabled",  operationsSuiteEnabled);
    licenseStore.set("operationsEnabled", operationsSuiteEnabled);
    licenseStore.set("dashboardEnabled",  r.dashboard_enabled === true || teamLeaderEnabled);
    licenseStore.set("teamLeaderEnabled", teamLeaderEnabled);
    _licenseCache = null;
    _licenseCacheAt = 0;
    _saveLastValidResult({ valid: true, key: clean, daysLeft, expiresAt, customerName });
    startLicensePresenceHeartbeat();
    return {
      success: true,
      daysLeft,
      customerName,
      maxDevices: r.max_devices || licenseStore.get("maxDevices", 1),
      activeDevices: r.active_devices || licenseStore.get("activeDevices", 1),
    };
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

function removeAccountLocalArtifacts(accountId) {
  const id = String(accountId || "").trim();
  if (!id || id === "__single__" || id === "legacy") return;
  try { store.delete(`pwd_easy_${id}`); } catch (_) {}
  try { store.delete(`pwd_khod_${id}`); } catch (_) {}
  try {
    const accounts = dashboardStore.get("accounts", {});
    if (accounts && accounts[id]) {
      delete accounts[id];
      dashboardStore.set("accounts", accounts);
      bumpDashboardSnapshotRevision();
    }
  } catch (_) {}
  try {
    const runs = analyticsStore.get("runs", []);
    if (Array.isArray(runs)) {
      const filtered = runs.filter(run => String(run && run.accountId || "") !== id);
      if (filtered.length !== runs.length) {
        analyticsStore.set("runs", filtered);
        invalidateAnalyticsRunsCache();
      }
    }
  } catch (_) {}
  try {
    const memory = dashboardStore.get("aiAssistantState.v1", null);
    if (memory && memory.businessMemoryByAccount && memory.businessMemoryByAccount[id]) {
      delete memory.businessMemoryByAccount[id];
      dashboardStore.set("aiAssistantState.v1", memory);
    }
  } catch (_) {}
  try {
    const profilePath = path.join(app.getPath("userData"), `bot-profile-${id}`);
    if (fs.existsSync(profilePath)) fs.rmSync(profilePath, { recursive: true, force: true });
  } catch (_) {}
}

function persistAccountsAfterAdminDelete(nextAccounts) {
  const accounts = Array.isArray(nextAccounts) ? nextAccounts : [];
  store.set("accounts", accounts.map(safeAccountForStorage));
  const remainingIds = accounts.map(a => a.id);
  const runnableIds = accounts.filter(a => !isStaticAccount(a)).map(a => a.id);
  const savedAutoRunIds = store.get("autoRunAccountIds", []);
  if (Array.isArray(savedAutoRunIds)) {
    store.set("autoRunAccountIds", savedAutoRunIds.filter(id => runnableIds.includes(id)));
  }
  store.set("unlockedAccountIds", store.get("unlockedAccountIds", []).filter(id => remainingIds.includes(id)));

  const first = accounts[0];
  if (first) {
    store.set("easyEmail", first.easyEmail || "");
    store.set("easyPassword", store.get(`pwd_easy_${first.id}`, ""));
    store.set("easyStore", first.easyStore || "");
    store.set("khodEmail", first.khodEmail || "");
    store.set("khodPassword", store.get(`pwd_khod_${first.id}`, ""));
    store.set("khodCountry", first.khodCountry || "sa");
    store.set("khodAffiliateCode", first.khodAffiliateCode || "");
  } else {
    ["easyEmail", "easyPassword", "easyStore", "khodEmail", "khodPassword", "khodCountry", "khodAffiliateCode"].forEach(key => {
      store.delete(key);
    });
  }
  invalidateAnalyticsRunsCache();
}

function getLocalCredentialsSnapshot() {
  const rawAccounts = store.get("accounts", null);
  let accounts = rawAccounts || [];
  const unlockedAccountIds = store.get("unlockedAccountIds", []);
  const accountsWithStatus = accounts.map(a => ({ ...a, locked: !unlockedAccountIds.includes(a.id) && accounts.length > 0 }));
  const hasAny = accountsWithStatus.length > 0;
  return {
    hasCredentials:   hasAny,
    accounts:         accountsWithStatus,
    remoteAccountSlots: null,
    maxAccounts:      licenseStore.get("maxAccounts", 1),
    analyticsEnabled:  licenseStore.get("analyticsEnabled",  true),
    operationsEnabled: licenseStore.get("operationsEnabled", true),
    dashboardEnabled:  licenseStore.get("dashboardEnabled",  false),
    teamLeaderEnabled: licenseStore.get("teamLeaderEnabled", false),
    easyEmail:        hasAny ? store.get("easyEmail",       "") : "",
    easyStore:        hasAny ? store.get("easyStore",       "") : "",
    khodEmail:        hasAny ? store.get("khodEmail",       "") : "",
    khodCountry:      hasAny ? store.get("khodCountry",     "sa") : "sa",
    khodAffiliateCode: hasAny ? store.get("khodAffiliateCode", "") : "",
    autoRun:          store.get("autoRun",         false),
    autoRunInterval:  store.get("autoRunInterval", 30),
    autoRunAccountIds: store.get("autoRunAccountIds", []),
    launchMinimized:  store.get("launchMinimized", false),
    autoConfirm:      store.get("autoConfirm", false),
    easyOrdersAffiliateRecoveryEnabled: store.get("easyOrdersAffiliateRecoveryEnabled", false),
    startupCached:    true,
  };
}

ipcMain.handle("get-startup-state", async () => {
  const license = await _checkLicenseImpl(false);
  const credentials = getLocalCredentialsSnapshot();
  _credCache = credentials;
  _credCacheAt = Date.now();
  return {
    settings: {
      theme: store.get("theme", "dark"),
      lang:  store.get("lang",  "ar"),
      appZoom: getSavedAppZoom(),
    },
    license,
    credentials,
  };
});

ipcMain.handle("get-credentials", async () => {
  // Serve from cache if fresh
  if (_credCache && (Date.now() - _credCacheAt) < CRED_CACHE_TTL_MS) {
    return _credCache;
  }

  const rawAccounts = store.get("accounts", null);
  const maxAccounts = await getMaxAccounts();
  const legacyEmail = store.get("easyEmail", "");
  let accounts = rawAccounts || [];
  let remoteAccountSlots = null;

  // Fetch per-account lock status from license_accounts table
  let licenseRows = null;
  let lockedHashes = [];
  let unlockedAccountIds = store.get("unlockedAccountIds", []); // admin-unlocked accounts (local cache)
  const licKey = licenseStore.get("licenseKey", "");
  if (licKey) {
    try {
      const rows = await supabaseRpc("khod_get_license_accounts", { p_license_key: licKey });
      if (Array.isArray(rows)) {
        licenseRows = rows;
        if (accounts.length === 0 && rows.length > 0) {
          remoteAccountSlots = summarizeRemoteLicenseAccounts(rows);
        }
        if (accounts.length > 0) {
          const keptAccounts = [];
          const deletedAccounts = [];
          for (const account of accounts) {
            const hash = accountHash(account);
            const hasServerSlot = rows.some(row => row.account_hash === hash || licenseRowMatchesAccount(row, account));
            if (hasServerSlot) keptAccounts.push(account);
            else deletedAccounts.push(account);
          }
          if (deletedAccounts.length > 0) {
            for (const account of deletedAccounts) removeAccountLocalArtifacts(account.id);
            accounts = keptAccounts;
            persistAccountsAfterAdminDelete(accounts);
          }
        }
        lockedHashes = rows.filter(r => !r.unlocked).map(r => r.account_hash);
        // Update local cache of unlocked accounts
        unlockedAccountIds = accounts
          .filter(a => {
            const hash = accountHash(a);
            const exactRow = rows.find(r => r.account_hash === hash);
            if (exactRow) return !!exactRow.unlocked;
            const identityRows = rows.filter(r => licenseRowMatchesAccount(r, a));
            return identityRows.length > 0 && identityRows.every(r => !!r.unlocked);
          })
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
    if (Array.isArray(licenseRows)) {
      const exactRow = licenseRows.find(r => r.account_hash === hash);
      if (exactRow) return { ...a, locked: !exactRow.unlocked };
      const identityRows = licenseRows.filter(r => licenseRowMatchesAccount(r, a));
      if (identityRows.length) {
        const hasLockedDuplicate = identityRows.some(r => !r.unlocked);
        return { ...a, locked: hasLockedDuplicate };
      }
      return { ...a, locked: accounts.length > 0 };
    }
    const isLocked = lockedHashes.includes(hash);
    const isUnlocked = unlockedAccountIds.includes(a.id);
    return { ...a, locked: isLocked && !isUnlocked };
  });

  const result = {
    hasCredentials:   accountsWithStatus.length > 0 || !!legacyEmail,
    accounts:         accountsWithStatus,
    remoteAccountSlots,
    maxAccounts,
    analyticsEnabled:  licenseStore.get("analyticsEnabled",  true),
    operationsEnabled: licenseStore.get("operationsEnabled", true),
    dashboardEnabled:  licenseStore.get("dashboardEnabled",  false),
    teamLeaderEnabled: licenseStore.get("teamLeaderEnabled", false),
    // Suppress legacy flat fields when accounts array is empty — if we still return
    // easyEmail here, the renderer's loadAccounts() will resurrect a ghost account.
    easyEmail:        accountsWithStatus.length > 0 ? store.get("easyEmail",       "") : "",
    easyStore:        accountsWithStatus.length > 0 ? store.get("easyStore",       "") : "",
    khodEmail:        accountsWithStatus.length > 0 ? store.get("khodEmail",       "") : "",
    khodCountry:      accountsWithStatus.length > 0 ? store.get("khodCountry",     "sa") : "sa",
    khodAffiliateCode: accountsWithStatus.length > 0 ? store.get("khodAffiliateCode", "") : "",
    autoRun:          store.get("autoRun",         false),
    autoRunInterval:  store.get("autoRunInterval", 30),
    autoRunAccountIds: store.get("autoRunAccountIds", []),
    launchMinimized:  store.get("launchMinimized", false),
    autoConfirm:      store.get("autoConfirm", false),
    easyOrdersAffiliateRecoveryEnabled: store.get("easyOrdersAffiliateRecoveryEnabled", false),
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
  store.set("khodAffiliateCode", creds.khodAffiliateCode || "");
  invalidateAnalyticsRunsCache();
  syncLicenseCredentialsBackup("save-credentials").catch(() => {});
  return { success: true };
});

function validateAccountCredentialsForSave(a) {
  if (isStaticAccount(a)) {
    return String(a.label || a.memberName || "").trim()
      ? { success: true }
      : { success: false, reason: "static_name_required" };
  }
  const easyPassword = a.easyPassword || (a.id ? store.get(`pwd_easy_${a.id}`, "") : "");
  const khodPassword = a.khodPassword || (a.id ? store.get(`pwd_khod_${a.id}`, "") : "");
  if (!(a.easyStore || "").trim() || !(a.easyEmail || "").trim() || !easyPassword) {
    return { success: false, reason: "easy_credentials_required" };
  }
  if (!(a.khodEmail || "").trim()) {
    return { success: false, reason: "khod_email_required" };
  }
  if (!khodPassword) {
    return { success: false, reason: "khod_password_required" };
  }
  return { success: true };
}

function safeAccountForStorage(a) {
  const identityKey = accountIdentityKey(a);
  return {
    id:         a.id,
    accountType: isStaticAccount(a) ? "static" : "live",
    memberName: String(a.memberName || "").trim(),
    label:      a.label || a.easyStore || a.easyEmail || a.khodEmail || "",
    licenseAccountHash: a.licenseAccountHash && a.licenseIdentityKey === identityKey ? a.licenseAccountHash : "",
    licenseIdentityKey: a.licenseAccountHash && a.licenseIdentityKey === identityKey ? a.licenseIdentityKey : "",
    easyEmail:  a.easyEmail,
    easyStore:  a.easyStore  || "",
    dashboardEnrichmentProvider: a.dashboardEnrichmentProvider === "easyorders" ? "easyorders" : "none",
    easyOrdersLookbackDays: Number(a.easyOrdersLookbackDays || 60),
    khodEmail:  a.khodEmail,
    khodAffiliateCode: a.khodAffiliateCode || "",
    khodCountry: a.khodCountry || "sa",
  };
}

function persistAccountsWithoutDeleting(accounts, maxAccounts) {
  store.set("accounts", accounts.map(safeAccountForStorage));

  const remainingIds = accounts.map(a => a.id);
  const runnableIds = accounts.filter(a => !isStaticAccount(a)).map(a => a.id);
  const savedAutoRunIds = store.get("autoRunAccountIds", []);
  if (Array.isArray(savedAutoRunIds)) {
    store.set("autoRunAccountIds", savedAutoRunIds.filter(id => runnableIds.includes(id)));
  }
  const cachedUnlocked = store.get("unlockedAccountIds", []).filter(id => remainingIds.includes(id));
  store.set("unlockedAccountIds", cachedUnlocked);

  for (const a of accounts) {
    if (a.easyPassword) store.set(`pwd_easy_${a.id}`, a.easyPassword);
    if (a.khodPassword) store.set(`pwd_khod_${a.id}`, a.khodPassword);
  }

  if (accounts[0]) {
    store.set("easyEmail",    accounts[0].easyEmail    || "");
    store.set("easyPassword", accounts[0].easyPassword || store.get(`pwd_easy_${accounts[0].id}`, ""));
    store.set("easyStore",    accounts[0].easyStore    || "");
    store.set("khodEmail",    accounts[0].khodEmail    || "");
    store.set("khodPassword", accounts[0].khodPassword || store.get(`pwd_khod_${accounts[0].id}`, ""));
    store.set("khodCountry",  accounts[0].khodCountry  || "sa");
    store.set("khodAffiliateCode", accounts[0].khodAffiliateCode || "");
  } else {
    ["easyEmail", "easyPassword", "easyStore", "khodEmail", "khodPassword", "khodCountry", "khodAffiliateCode"].forEach(k => store.delete(k));
  }

  licenseStore.set("maxAccounts", maxAccounts);
  _credCache = null;
  _credCacheAt = 0;
  invalidateAnalyticsRunsCache();
}

async function syncRestoredAccountLicenseSlots(accounts, maxAccounts) {
  const licKey = licenseStore.get("licenseKey", "");
  if (!licKey) return { success: true };
  const dbRows = await supabaseRpc("khod_get_license_accounts", { p_license_key: licKey }) || [];
  const dbHashes = dbRows.map(r => r.account_hash);
  const missingAccounts = [];

  for (const account of accounts) {
    if (account.licenseAccountHash && dbHashes.includes(account.licenseAccountHash)) continue;
    const matchingRow = dbRows.find(row => licenseRowMatchesAccount(row, account));
    if (matchingRow && matchingRow.account_hash) {
      account.licenseAccountHash = matchingRow.account_hash;
      account.licenseIdentityKey = accountIdentityKey(account);
      continue;
    }
    const hash = accountHash(account);
    if (!dbHashes.includes(hash)) missingAccounts.push(account);
  }

  if (dbHashes.length + missingAccounts.length > maxAccounts) {
    return { success: false, reason: "remote_slots_full", remoteAccountSlots: summarizeRemoteLicenseAccounts(dbRows) };
  }

  for (const account of missingAccounts) {
    const hash = accountHash(account);
    const insertRes = await supabaseRpc("khod_insert_license_account", {
      p_license_key: licKey,
      p_account_hash: hash,
      p_easy_email: (account.easyEmail || "").toLowerCase().trim() || null,
      p_easy_store: licenseEasyStoreOf(account) || null,
      p_khod_email: khodEmailIdentityOf(account) || null,
      p_unlocked: false,
    });
    if (insertRes && insertRes.success === false) {
      return { success: false, reason: insertRes.reason || "license_account_sync_failed" };
    }
    account.licenseAccountHash = hash;
    account.licenseIdentityKey = accountIdentityKey(account);
  }

  return { success: true };
}

async function restoreLicenseCredentialsFromBackup() {
  const licKey = licenseStore.get("licenseKey", "");
  if (!licKey) return { success: false, reason: "no_license" };
  if ((store.get("accounts", []) || []).length > 0) {
    return { success: false, reason: "local_credentials_exist" };
  }

  const license = await _checkLicenseImpl(true);
  if (!license || !license.valid) return { success: false, reason: license && license.reason || "license_invalid" };

  let remote;
  try {
    remote = await supabaseRpc("khod_get_license_credential_backup", {
      p_license_key: licKey,
      p_machine_uuid: _getOrCreateMachineUUID(),
      p_device_id: getDeviceFingerprint(),
    });
  } catch (error) {
    log.warn("[LicenseCredentials] Restore fetch failed:", error && error.message ? error.message : error);
    return { success: false, reason: "restore_fetch_failed" };
  }

  if (!remote || remote.ok !== true) return { success: false, reason: remote && remote.reason || "restore_not_allowed" };
  if (remote.available !== true || !remote.encrypted_payload) return { success: false, reason: "no_backup" };

  let payload;
  try {
    payload = decryptLicenseCredentialBackup(remote.encrypted_payload, licKey);
  } catch (error) {
    log.warn("[LicenseCredentials] Restore decrypt failed:", error && error.message ? error.message : error);
    return { success: false, reason: "restore_decrypt_failed" };
  }

  if (!payload || payload.version !== LICENSE_CREDENTIAL_BACKUP_VERSION || !Array.isArray(payload.accounts)) {
    return { success: false, reason: "invalid_backup" };
  }

  const maxAccounts = await getMaxAccounts();
  const restoredAccounts = payload.accounts
    .slice(0, Math.max(0, maxAccounts))
    .map(normalizeRestoredCredentialAccount);

  if (!restoredAccounts.length) return { success: false, reason: "no_backup_accounts" };
  if (payload.accounts.length > maxAccounts) return { success: false, reason: "limit_reached" };

  for (const account of restoredAccounts) {
    const validation = validateAccountCredentialsForSave(account);
    if (!validation.success) return validation;
  }

  try {
    const slotSync = await syncRestoredAccountLicenseSlots(restoredAccounts, maxAccounts);
    if (!slotSync.success) return slotSync;
  } catch (error) {
    log.warn("[LicenseCredentials] Restore slot sync failed:", error && error.message ? error.message : error);
    return { success: false, reason: "license_account_sync_failed" };
  }

  persistAccountsWithoutDeleting(restoredAccounts, maxAccounts);
  _credCache = null;
  _credCacheAt = 0;
  log.info("[LicenseCredentials] Restored credential backup:", { accounts: restoredAccounts.length });
  return { success: true, accountCount: restoredAccounts.length };
}
async function syncSingleEditedAccountLicenseSlot(oldAccount, newAccount, maxAccounts) {
  const licKey = licenseStore.get("licenseKey", "");
  if (!licKey) return { success: true };

  try {
    const dbRows = await supabaseRpc("khod_get_license_accounts", { p_license_key: licKey }) || [];
    const dbHashes = dbRows.map(r => r.account_hash);
    const oldH = accountHash(oldAccount);

    if (!(newAccount.licenseAccountHash && dbHashes.includes(newAccount.licenseAccountHash))) {
      const matchingRow = dbRows.find(r => licenseRowMatchesAccount(r, newAccount));
      if (matchingRow && matchingRow.account_hash) {
        newAccount.licenseAccountHash = matchingRow.account_hash;
        newAccount.licenseIdentityKey = accountIdentityKey(newAccount);
      }
    }

    const newH = accountHash(newAccount);

    if (newH === oldH && dbHashes.includes(newH)) {
      const oldStore = licenseEasyStoreOf(oldAccount);
      const newStore = licenseEasyStoreOf(newAccount);
      if (oldStore !== newStore) {
        const currentRow = dbRows.find(row => row.account_hash === newH);
        const syncRes = await supabaseRpc("khod_insert_license_account", {
          p_license_key: licKey,
          p_account_hash: newH,
          p_easy_email: (newAccount.easyEmail || "").toLowerCase().trim() || null,
          p_easy_store: newStore || null,
          p_khod_email: khodEmailIdentityOf(newAccount) || null,
          p_unlocked: !!currentRow?.unlocked,
        });
        if (syncRes && syncRes.success === false) {
          return { success: false, reason: syncRes.reason || "license_account_sync_failed" };
        }
      }
      return { success: true };
    }

    if (oldH && dbHashes.includes(oldH)) {
      const oldRow = dbRows.find(r => r.account_hash === oldH);
      const wasUnlocked = oldRow ? !!oldRow.unlocked : false;
      if (!wasUnlocked) return { success: false, reason: "account_locked" };
      const newKhodEmail = khodEmailIdentityOf(newAccount);
      const replaceRes = await supabaseRpc("khod_replace_license_account", {
        p_license_key: licKey,
        p_old_account_hash: oldH,
        p_new_account_hash: newH,
        p_easy_email: (newAccount.easyEmail || "").toLowerCase().trim() || null,
        p_easy_store: licenseEasyStoreOf(newAccount) || null,
        p_khod_email:   newKhodEmail || null,
      });
      if (replaceRes && replaceRes.success === false) {
        return { success: false, reason: replaceRes.reason || "license_account_sync_failed" };
      }
      return { success: true };
    }

    if (!dbHashes.includes(newH)) {
      if (dbHashes.length + 1 > maxAccounts) {
        return { success: false, reason: "limit_reached", remoteAccountSlots: summarizeRemoteLicenseAccounts(dbRows) };
      }
      const insertRes = await supabaseRpc("khod_insert_license_account", {
        p_license_key: licKey,
        p_account_hash: newH,
        p_easy_email: (newAccount.easyEmail || "").toLowerCase().trim() || null,
        p_easy_store: licenseEasyStoreOf(newAccount) || null,
        p_khod_email: khodEmailIdentityOf(newAccount) || null,
        p_unlocked: false,
      });
      if (insertRes && insertRes.success === false) {
        return { success: false, reason: insertRes.reason || "license_account_sync_failed", remoteAccountSlots: summarizeRemoteLicenseAccounts(dbRows) };
      }
    }
    return { success: true };
  } catch (error) {
    log.warn("[Accounts] Could not sync edited license account slot:", error && error.message ? error.message : error);
    return { success: false, reason: "license_account_sync_failed" };
  }
}

function buildAccountPatchForUpdate(patch) {
  const src = patch && typeof patch === "object" ? patch : {};
  const next = {};
  [
    "memberName", "label", "easyEmail", "easyStore", "dashboardEnrichmentProvider",
    "easyOrdersLookbackDays", "khodEmail", "khodCountry", "khodAffiliateCode"
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(src, key)) next[key] = src[key];
  });
  if (src.easyPassword) next.easyPassword = src.easyPassword;
  if (src.khodPassword) next.khodPassword = src.khodPassword;
  return next;
}

ipcMain.handle("update-account", async (_, data = {}) => {
  const accountId = String(data.accountId || "").trim();
  if (!accountId) return { success: false, reason: "account_not_found" };

  const accounts = store.get("accounts", []) || [];
  const idx = accounts.findIndex(a => a.id === accountId);
  if (idx < 0) return { success: false, reason: "account_not_found" };

  const maxAccounts = await getMaxAccounts();
  const oldAccount = { ...accounts[idx] };
  const updatedAccount = {
    ...oldAccount,
    ...buildAccountPatchForUpdate(data.patch || {}),
    id: oldAccount.id,
  };
  const nextAccounts = accounts.map((a, i) => i === idx ? updatedAccount : { ...a });

  const duplicateConflict = findNewDuplicateConflict(accounts, nextAccounts);
  if (duplicateConflict) {
    return {
      success: false,
      reason: "duplicate_account",
      conflictAccountId: duplicateConflict.conflict.id || "",
      conflictAccountLabel: accountDisplayName(duplicateConflict.conflict, "Account"),
    };
  }

  const validation = validateAccountCredentialsForSave(updatedAccount);
  if (!validation.success) return validation;

  const licenseSync = await syncSingleEditedAccountLicenseSlot(oldAccount, updatedAccount, maxAccounts);
  if (!licenseSync.success) return licenseSync;

  persistAccountsWithoutDeleting(nextAccounts, maxAccounts);
  syncLicenseCredentialsBackup("update-account").catch(() => {});
  return { success: true };
});

// ── NEW: save full accounts array ──
ipcMain.handle("save-all-accounts", async (_, accounts) => {
  const licKey = licenseStore.get("licenseKey", "");
  const maxAccounts = await getMaxAccounts();
  const storedAccountsBeforeSave = store.get("accounts", []);

  const duplicateConflict = findNewDuplicateConflict(storedAccountsBeforeSave, accounts);
  if (duplicateConflict) {
    return {
      success: false,
      reason: "duplicate_account",
      conflictAccountId: duplicateConflict.conflict.id || "",
      conflictAccountLabel: accountDisplayName(duplicateConflict.conflict, "Account"),
    };
  }

  if (accounts.length > maxAccounts)
    return { success: false, reason: "limit_reached" };

  for (const a of accounts) {
    const validation = validateAccountCredentialsForSave(a);
    if (!validation.success) return validation;
  }

  // Per-account lock check via license_accounts table ──
  if (licKey) {
    try {
      const dbRows      = await supabaseRpc("khod_get_license_accounts", { p_license_key: licKey }) || [];
      const dbHashes    = dbRows.map(r => r.account_hash);

      // Build a map of accountId → old hash using the CURRENTLY stored accounts
      // (before we overwrite them). This lets us detect when an edit changed emails.
      const oldHashById = {};
      for (const a of storedAccountsBeforeSave) oldHashById[a.id] = accountHash(a);

      for (const a of accounts) {
        if (a.licenseAccountHash && dbHashes.includes(a.licenseAccountHash)) continue;
        const matchingRow = dbRows.find(r => licenseRowMatchesAccount(r, a));
        if (matchingRow && matchingRow.account_hash) {
          a.licenseAccountHash = matchingRow.account_hash;
          a.licenseIdentityKey = accountIdentityKey(a);
        }
      }

      const newHashes = accounts.map(a => accountHash(a));

      for (const a of accounts) {
        const newH = accountHash(a);
        const oldH = oldHashById[a.id]; // undefined for brand-new accounts

        // Case 1: hash unchanged — already in DB, nothing to do
        if (newH === oldH && dbHashes.includes(newH)) {
          const oldAccount = storedAccountsBeforeSave.find(item => item.id === a.id);
          const oldStore = licenseEasyStoreOf(oldAccount);
          const newStore = licenseEasyStoreOf(a);
          if (oldStore !== newStore) {
            const currentRow = dbRows.find(row => row.account_hash === newH);
            const syncRes = await supabaseRpc("khod_insert_license_account", {
              p_license_key: licKey,
              p_account_hash: newH,
              p_easy_email: (a.easyEmail || "").toLowerCase().trim() || null,
              p_easy_store: newStore || null,
              p_khod_email: khodEmailIdentityOf(a) || null,
              p_unlocked: !!currentRow?.unlocked,
            });
            if (syncRes && syncRes.success === false) {
              return { success: false, reason: syncRes.reason || "license_account_sync_failed" };
            }
          }
          continue;
        }

        // Case 2: this is an edit that changed the email — swap old hash for new hash
        if (oldH && dbHashes.includes(oldH)) {
          // Preserve the unlocked state from the old row
          const oldRow   = dbRows.find(r => r.account_hash === oldH);
          const wasUnlocked = oldRow ? !!oldRow.unlocked : false;
          // Server-side guard: reject the edit if the account is still locked
          if (!wasUnlocked) return { success: false, reason: "account_locked" };
          // Replace atomically so a duplicate rejection cannot remove the old slot.
          const newAccObj = accounts.find(a => accountHash(a) === newH);
          const newKhodEmail = khodEmailIdentityOf(newAccObj);
          const replaceRes = await supabaseRpc("khod_replace_license_account", {
            p_license_key:  licKey,
            p_old_account_hash: oldH,
            p_new_account_hash: newH,
            p_easy_email:   (newAccObj?.easyEmail || "").toLowerCase().trim() || null,
            p_easy_store:   licenseEasyStoreOf(newAccObj) || null,
            p_khod_email:   newKhodEmail || null,
          });
          if (replaceRes && replaceRes.success === false) {
            return { success: false, reason: replaceRes.reason || "license_account_sync_failed" };
          }
          continue;
        }

        // Case 3: genuinely new account — check slot limit then register
        if (!dbHashes.includes(newH)) {
          // Count how many truly new hashes (not in DB and not an edit swap) we're adding
          const alreadyKnownOrSwapped = accounts
            .filter(b => { const bOld = oldHashById[b.id]; return bOld && dbHashes.includes(bOld); })
            .map(b => accountHash(b));
          const genuinelyNew = newHashes.filter(h => !dbHashes.includes(h) && !alreadyKnownOrSwapped.includes(h));
          if (dbHashes.length + genuinelyNew.length > maxAccounts) {
            return {
              success: false,
              reason: storedAccountsBeforeSave.length === 0 && dbHashes.length > 0 ? "remote_slots_full" : "limit_reached",
              remoteAccountSlots: summarizeRemoteLicenseAccounts(dbRows),
            };
          }
          const newAccForInsert = accounts.find(a => accountHash(a) === newH);
          const newKhodEmail = khodEmailIdentityOf(newAccForInsert);
          const insertRes = await supabaseRpc("khod_insert_license_account", {
            p_license_key:  licKey,
            p_account_hash: newH,
            p_easy_email:   (newAccForInsert?.easyEmail || "").toLowerCase().trim() || null,
            p_easy_store:   licenseEasyStoreOf(newAccForInsert) || null,
            p_khod_email:   newKhodEmail || null,
            p_unlocked:     false,
          });
          if (insertRes && insertRes.success === false) {
            return {
              success: false,
              reason: insertRes.reason === "limit_reached" && storedAccountsBeforeSave.length === 0 && dbHashes.length > 0
                ? "remote_slots_full"
                : (insertRes.reason || "license_account_sync_failed"),
              remoteAccountSlots: summarizeRemoteLicenseAccounts(dbRows),
            };
          }
        }
      }

      // Remove only local accounts the user actually deleted. Remote-only slots can
      // exist after an interrupted save or admin action and must not break adds.
      const storedOldHashes = Object.values(oldHashById).filter(Boolean);
      const swappedOldHashes = accounts
        .map(a => oldHashById[a.id])
        .filter(h => h && dbHashes.includes(h) && !newHashes.includes(h));
      const deletedHashes = storedOldHashes.filter(h => dbHashes.includes(h) && !newHashes.includes(h) && !swappedOldHashes.includes(h));
      for (const h of deletedHashes) {
        // Server-side guard: never delete a locked account slot — only unlocked ones can be removed
        const row = dbRows.find(r => r.account_hash === h);
        if (row && !row.unlocked) return { success: false, reason: "account_locked" };
        try {
          const deleteRes = await supabaseRpc("khod_delete_license_account", { p_license_key: licKey, p_account_hash: h });
          if (deleteRes && deleteRes.success === false) {
            return { success: false, reason: deleteRes.reason || "license_account_sync_failed" };
          }
        } catch (error) {
          log.warn("[Accounts] Could not delete license account slot:", error && error.message ? error.message : error);
          return { success: false, reason: "license_account_sync_failed" };
        }
      }
    } catch (error) {
      log.warn("[Accounts] Could not sync license account slots before save:", error && error.message ? error.message : error);
      return { success: false, reason: "license_account_sync_failed" };
    }
  }

  // Encrypt passwords in store - store accounts without plaintext passwords, keep passwords separately keyed
  const nextAccountIds = new Set(accounts.map(a => a.id));
  for (const oldAccount of storedAccountsBeforeSave) {
    if (!nextAccountIds.has(oldAccount.id)) removeAccountLocalArtifacts(oldAccount.id);
  }

  persistAccountsWithoutDeleting(accounts, maxAccounts);
  syncLicenseCredentialsBackup("save-all-accounts").catch(() => {});
  return { success: true };
});


// ADMIN: unlock a single account (called when admin unlocks via panel)
// The app polls this on startup - when admin sets unlocked=true in DB,
// unlockedAccountIds is updated locally so UI re-enables edit button.
ipcMain.handle("unlock-single-account", async (_, { accountId }) => {
  return { success: false, reason: "admin_only" };
});

// Re-lock after user saves new credentials for an account
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
  appZoom: getSavedAppZoom(),
}));
ipcMain.handle("save-settings", (_, { theme, lang, appZoom } = {}) => {
  if (theme !== undefined) store.set("theme", theme);
  if (lang  !== undefined) store.set("lang",  lang);
  if (appZoom !== undefined) store.set("appZoom", normalizeAppZoom(appZoom));
  return true;
});

ipcMain.handle("open-folder", (_, folderPath) => {
  shell.openPath(folderPath);
  return true;
});
ipcMain.handle("set-auto-run", (_, value) => {
  autoRunEnabled = value === true;
  store.set("autoRun", autoRunEnabled);
  if (autoRunEnabled) scheduleAutoRun();
  else clearAutoRun();
  return true;
});
ipcMain.handle("set-auto-run-interval", (_, minutes) => {
  const next = Number(minutes);
  store.set("autoRunInterval", Number.isFinite(next) && next > 0 ? next : 30);
  if (autoRunEnabled) scheduleAutoRun();
  return true;
});
ipcMain.handle("set-auto-run-accounts", (_, ids) => {
  const accounts = store.get("accounts", []) || [];
  const validIds = accounts.filter(a => !isStaticAccount(a)).map(a => a.id);
  const selected = Array.isArray(ids) ? ids.filter(id => validIds.includes(id)) : [];
  store.set("autoRunAccountIds", selected);
  return selected;
});
ipcMain.handle("get-auto-run-progress", () => getAutoRunProgress());
ipcMain.handle("set-launch-minimized", (_, value) => {
  store.set("launchMinimized", value === true);
  return true;
});

ipcMain.handle("save-run-analytics", async (_, payload) => {
  try {
    // Extract KHOD WHAAT snapshot before storing (don't persist it; it's only for enrichment).
    // taagerSnapshot is kept as a compatibility alias from the Taager-derived app shell.
    const { khodSnapshot, taagerSnapshot, taagerDashboardSnapshot, buffer, ...rawRunData } = payload;
    if ((!Array.isArray(rawRunData.orders) || rawRunData.orders.length === 0) && buffer) {
      rawRunData.orders = parseOrderRowsFromOutputBuffer(buffer);
    }
    const runData = normalizeAnalyticsRun(rawRunData);

    // Normal order runs should not refresh dashboard snapshots. Dashboard rows
    // are updated only by the manual Dashboard Update flow.
    const dashboardRowsSaved = 0;
    const accountsById = getStoredAccountsMap();
    const runs = analyticsStore.get("runs", []).map(run => normalizeAnalyticsRun(run, accountsById));
    const alreadyExists = runs.some(r => r.runId === runData.runId);
    if (alreadyExists) return { ok: true, duplicate: true, dashboardRowsSaved };

    // Enrichment pass: update previous stored runs with current KHOD WHAAT statuses.
    // On every new bot run, a fresh KHOD WHAAT export updates prior phone+SKU matches.
    // This is how "Under processing" → "Delivered" / "Failed" transitions happen.
    let enrichedCount = 0;
    const analyticsSnapshot = khodSnapshot || taagerSnapshot || null;
    const khodRows = normalizeKhodSnapshotEntries(analyticsSnapshot?.entries);
    if (khodRows.length) {
      const currentRunMerge = enrichOrdersFromKhodRows(runData.orders, khodRows, runData.khodCountry || runData.taagerCountry);
      runData.orders = currentRunMerge.orders;
      enrichedCount += currentRunMerge.changed;

      for (const run of runs) {
        if (runData.accountId && run.accountId && run.accountId !== runData.accountId) continue;
        if (!Array.isArray(run.orders)) continue;
        const merged = enrichOrdersFromKhodRows(run.orders, khodRows, run.khodCountry || run.taagerCountry || runData.khodCountry || runData.taagerCountry);
        if (merged.changed > 0) {
          run.orders = merged.orders;
          enrichedCount += merged.changed;
        }
      }
      if (enrichedCount > 0) {
        console.log(`[Analytics] Enriched ${enrichedCount} orders from KHOD WHAAT snapshot`);
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
        if (n.accountId !== run.accountId || n.accountEmail !== run.accountEmail || n.accountLabel !== run.accountLabel || JSON.stringify(n.orders || []) !== JSON.stringify(run.orders || [])) dirty = true;
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

// Must exceed the KHOD WHAAT worker's download timeout plus retry wait windows.
const DASHBOARD_FETCH_ACCOUNT_TIMEOUT_MS = 45 * 60 * 1000;

// ── Dashboard Fetch — spawn dashboard-fetch.js (KHOD WHAAT dashboard export) ──
ipcMain.handle("run-dashboard-fetch", async (_, { accountId, dateFrom, dateTo } = {}) => {
  if (!(await isLicenseValid())) return { success: false, error: "LICENSE_INVALID" };
  if (!licenseStore.get("dashboardEnabled", false)) return { success: false, error: "DASHBOARD_NOT_ENABLED" };
  const rangeValidation = validateCurrentYearDashboardRange(dateFrom, dateTo);
  if (!rangeValidation.ok) return { success: false, error: rangeValidation.error };

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
  if (isStaticAccount(acc)) {
    return { success: false, error: "STATIC_ACCOUNT_OFFLINE" };
  }

  const userData = app.getPath("userData");
  const dashboardAccountId = accountId || acc.id || "__single__";
  const khodEmail = acc.khodEmail || store.get("khodEmail", "");
  const khodPassword = acc.khodPassword || (acc.id ? store.get(`pwd_khod_${acc.id}`, "") : "") || store.get("khodPassword", "");
  if (!khodEmail || !khodPassword) {
    const label = accountDisplayName(acc, dashboardAccountId);
    return { success: false, error: `KHOD WHAAT credentials missing for ${label}. Re-save this account and add the KHOD WHAAT email/password, then retry dashboard update.` };
  }
  const profilePath = path.join(userData, `bot-profile${acc.id ? `-${acc.id}` : ""}`);
  if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });

  const creds = {
    id: acc.id || dashboardAccountId,
    label: acc.label || "",
    memberName: acc.memberName || "",
    easyEmail: acc.easyEmail || store.get("easyEmail", ""),
    easyStore: acc.easyStore || store.get("easyStore", ""),
    khodEmail,
    khod_email: khodEmail,
    khodPassword,
    khodAffiliateCode: acc.khodAffiliateCode || store.get("khodAffiliateCode", ""),
    khodCountry: acc.khodCountry || store.get("khodCountry", "sa"),
    profilePath,
    launchMinimized: store.get("launchMinimized", false),
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

    let resolved = false;
    let lastStage = "dashboard.fetch.spawned";
    let killedByWatchdog = false;

    const forwardDashboardLog = (text, options = {}) => {
      const message = String(text || "");
      const payload = {
        accountId: dashboardAccountId,
        accountLabel,
        message,
        stream: options.stream || "stdout",
        timestamp: Date.now(),
      };
      mainWindow.webContents.send("bot-dashboard-log", payload);
      mainWindow.webContents.send("bot-log", `[Dashboard:${accountLabel}]${options.stream === "stderr" ? "[ERR]" : ""} ${message}`);
    };

    child.stdout.on("data", (d) => {
      forwardDashboardLog(d.toString(), { stream: "stdout" });
    });
    child.stderr.on("data", (d) => {
      forwardDashboardLog(d.toString(), { stream: "stderr" });
    });

    const watchdog = setTimeout(() => {
      killedByWatchdog = true;
      const error = `DASHBOARD_FETCH_TIMEOUT: last stage was ${lastStage}`;
      forwardDashboardLog(error, { stream: "stderr" });
      try { child.kill(); } catch (_) {}
      safeResolve({ success: false, error, lastStage });
    }, DASHBOARD_FETCH_ACCOUNT_TIMEOUT_MS);

    const safeResolve = (v) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(watchdog);
        resolve(v);
      }
    };

    child.on("message", async (msg) => {
      if (msg.type === "stage") {
        lastStage = msg.stage || lastStage;
        const payload = {
          ...msg,
          accountId: dashboardAccountId,
          accountLabel,
          lastStage,
          timestamp: Date.now(),
        };
        mainWindow.webContents.send("bot-dashboard-stage", payload);
        if (msg.message) {
          forwardDashboardLog(`[stage:${msg.status || "info"}] ${msg.stage || lastStage} - ${msg.message}`);
        }
      } else if (msg.type === "dashboard-result") {
        let rows = normalizeDashboardProfitRows(msg.rows || []);
        try {
          const rangeFrom = msg.dateFrom || dateFrom || "";
          const rangeTo = msg.dateTo || dateTo || "";
          const skuCacheUpdate = mergeDashboardSkuNameCache(dashboardAccountId, msg.learnedSkuNameMap || {});
          if (msg.enrichmentDiagnostics && msg.enrichmentDiagnostics.provider === "easyorders") {
            msg.enrichmentDiagnostics = {
              ...msg.enrichmentDiagnostics,
              skuNameCacheAdded: skuCacheUpdate.added,
              skuNameCacheUpdated: skuCacheUpdate.updated,
              skuNameCacheTotal: skuCacheUpdate.total,
            };
            if (msg.parseDiagnostics && msg.parseDiagnostics.enrichment) {
              msg.parseDiagnostics.enrichment = msg.enrichmentDiagnostics;
            }
          }
          const existingRows = dashboardStore.get(`accounts.${dashboardAccountId}.snapshot`, []);
          rows = preserveExistingDashboardProductNames(rows, existingRows);
          const existingDebugSummary = dashboardDebugSummaryForRange(existingRows, rangeFrom, rangeTo, null);
          const incomingDebugSummary = dashboardDebugSummaryForRange(rows, rangeFrom, rangeTo, msg.parseDiagnostics);
          const persisted = persistDashboardSnapshot(dashboardAccountId, {
            snapshot: rows,
            dateFrom: rangeFrom,
            dateTo: rangeTo,
            exportDateFrom: msg.exportDateFrom || "",
            exportDateTo: msg.exportDateTo || "",
            snapshotMonth: msg.snapshotMonth || "",
            parseDiagnostics: msg.parseDiagnostics || null,
            enrichmentDiagnostics: msg.enrichmentDiagnostics || null,
          }, { source: "live-fetch", timestampKey: "autoFetchTimestamp" });
          const savedDebugSummary = dashboardDebugSummaryForRange(persisted.mergedRows, rangeFrom, rangeTo, null);
          const debugLines = dashboardDebugLines(
            accountLabel,
            rangeFrom,
            rangeTo,
            msg.exportDateFrom || "",
            msg.exportDateTo || "",
            existingDebugSummary,
            incomingDebugSummary,
            savedDebugSummary
          );
          debugLines.forEach((line) => {
            console.log(line);
            mainWindow.webContents.send("bot-log", line);
          });
          console.log(`[Dashboard] Snapshot replaced ${rangeFrom || "?"}..${rangeTo || "?"} for ${dashboardAccountId}: ${rows.length} fetched, ${persisted.mergedRows.length} stored`);
          if (skuCacheUpdate.added || skuCacheUpdate.updated) {
            console.log(`[Dashboard] SKU name cache updated for ${dashboardAccountId}: +${skuCacheUpdate.added}, changed=${skuCacheUpdate.updated}, total=${skuCacheUpdate.total}`);
          }
          if (persisted.enriched > 0) console.log(`[Analytics] Enriched ${persisted.enriched} stored orders from dashboard fetch`);
        } catch (e) {
          console.error("[Dashboard] Failed to save snapshot:", e.message);
          monitoring.captureException(e, { operation: "dashboard.fetch.saveSnapshot", extra: { accountId: dashboardAccountId } });
        }
        safeResolve({
          success: true,
          rows: rows.length,
          snapshotMonth: msg.snapshotMonth,
          parseDiagnostics: msg.parseDiagnostics || null,
          enrichmentDiagnostics: msg.enrichmentDiagnostics || (msg.parseDiagnostics && msg.parseDiagnostics.enrichment) || null,
          debugSummary: dashboardDebugSummaryForRange(rows, msg.dateFrom || dateFrom || "", msg.dateTo || dateTo || "", msg.parseDiagnostics),
          lastStage
        });
      } else if (msg.type === "error") {
        safeResolve({ success: false, error: msg.error, lastStage });
      } else if (msg.type === "export-timestamp") {
        lastExportTimestamp = msg.timestamp || Date.now();
      } else if (msg.type === "khod-restart") {
        mainWindow.webContents.send("bot-log", `[Dashboard:${accountLabel}] Restarting export after ${msg.waitSeconds}s. Reason: ${msg.reason || "export retry"}`);
        mainWindow.webContents.send("bot-khod-restart", { ...msg, accountId: dashboardAccountId, accountLabel });
      } else if (msg.type === "cooldown") {
        mainWindow.webContents.send("bot-log", `[Dashboard:${accountLabel}] Waiting for KHOD WHAAT export file. Attempt ${msg.attempt}/${msg.maxAttempts}.`);
        mainWindow.webContents.send("bot-cooldown", { ...msg, accountId: dashboardAccountId, accountLabel });
      } else if (msg.type === "session-event") {
        mainWindow.webContents.send("bot-session-event", { ...msg, accountId: dashboardAccountId, accountLabel });
      }
    });

    child.on("error", (err) => {
      monitoring.captureException(err, { operation: "dashboard.fetch.childProcess", extra: { accountId: dashboardAccountId } });
      safeResolve({ success: false, error: err.message, lastStage });
    });
    child.on("exit", (code) => {
      if (!resolved && !killedByWatchdog) safeResolve({ success: false, error: `Process exited with code ${code}`, lastStage });
    });
  });
});

// ── Dashboard IPC Handlers ─────────────────────────────────────────────────

function staticDashboardAccount(accountId) {
  const accounts = store.get("accounts", []) || [];
  const account = accounts.find((item) => item && item.id === accountId);
  if (account) return account;
  if (accountId === "__single__" || (!accountId && !accounts.length)) {
    return {
      id: "__single__",
      khodEmail: store.get("khodEmail", ""),
      memberName: store.get("memberName", ""),
    };
  }
  return null;
}

function prepareStaticDashboardUpdate(payload = {}) {
  const accountId = String(payload.accountId || "").trim();
  const account = staticDashboardAccount(accountId);
  if (!account) throw new Error(`Dashboard account not found: ${accountId || "unknown"}`);
  const processed = processDashboardSheet({
    khodBuffer: payload.khodBuffer || payload.taagerBuffer,
    dateFrom: payload.dateFrom,
    dateTo: payload.dateTo,
  });
  let normalizedRows = normalizeDashboardProfitRows(processed.rows);
  const existingRows = dashboardStore.get("accounts", {})[accountId]?.snapshot || [];
  normalizedRows = preserveExistingDashboardProductNames(normalizedRows, existingRows);
  const validation = validateDashboardSnapshotReplacement(existingRows, normalizedRows, processed.dateFrom, processed.dateTo, processed.parseDiagnostics);
  const periodMismatch = staticDashboardPeriodMismatch({ ...processed, rows: normalizedRows });
  if (periodMismatch) {
    processed.warnings = [
      ...(processed.warnings || []),
      {
        code: periodMismatch.code || "KHOD_DASHBOARD_PERIOD_MISMATCH",
        count: periodMismatch.count || periodMismatch.rowsOutsidePeriod || periodMismatch.skippedOutOfRange || 0,
        message: periodMismatch.message,
      },
    ];
  }
  return {
    accountId,
    processed: { ...processed, rows: normalizedRows },
    validation,
    periodMismatch,
    requiresConfirmation: validation.suspicious || normalizedRows.length === 0,
  };
}

function staticDashboardResult(prepared, extra = {}) {
  return {
    ok: true,
    accountId: prepared.accountId,
    rows: prepared.processed.rows.length,
    orders: prepared.validation.incoming.rawOrders,
    dateFrom: prepared.processed.dateFrom,
    dateTo: prepared.processed.dateTo,
    snapshotMonth: prepared.processed.snapshotMonth,
    warnings: prepared.processed.warnings || [],
    parseDiagnostics: prepared.processed.parseDiagnostics,
    enrichmentDiagnostics: prepared.processed.enrichmentDiagnostics,
    validation: prepared.validation,
    periodMismatch: prepared.periodMismatch,
    canApply: !prepared.periodMismatch,
    blockedReason: prepared.periodMismatch ? prepared.periodMismatch.message : "",
    requiresConfirmation: prepared.requiresConfirmation,
    ...extra,
  };
}

ipcMain.handle("inspect-static-dashboard-update", async (_, payload) => {
  try {
    if (!(await isLicenseValid())) return { ok: false, error: "LICENSE_INVALID" };
    if (!licenseStore.get("dashboardEnabled", false)) return { ok: false, error: "DASHBOARD_NOT_ENABLED" };
    return staticDashboardResult(prepareStaticDashboardUpdate(payload));
  } catch (error) {
    monitoring.captureException(error, { operation: "dashboard.static.inspect", extra: { accountId: payload?.accountId } });
    return { ok: false, accountId: payload?.accountId || "", error: error.message };
  }
});

ipcMain.handle("apply-static-dashboard-update", async (_, payload) => {
  try {
    if (!(await isLicenseValid())) return { ok: false, error: "LICENSE_INVALID" };
    if (!licenseStore.get("dashboardEnabled", false)) return { ok: false, error: "DASHBOARD_NOT_ENABLED" };
    const prepared = prepareStaticDashboardUpdate(payload);
    if (prepared.periodMismatch) {
      return staticDashboardResult(prepared, {
        ok: false,
        saved: false,
        blocked: true,
        error: prepared.periodMismatch.message,
      });
    }
    const persisted = persistDashboardSnapshot(prepared.accountId, {
      snapshot: prepared.processed.rows,
      dateFrom: prepared.processed.dateFrom,
      dateTo: prepared.processed.dateTo,
      snapshotMonth: prepared.processed.snapshotMonth,
      parseDiagnostics: prepared.processed.parseDiagnostics,
      enrichmentDiagnostics: prepared.processed.enrichmentDiagnostics,
      warnings: prepared.processed.warnings,
    }, {
      source: "static-upload",
      timestampKey: "staticUploadTimestamp",
      requireConfirmation: true,
      allowSuspiciousReplacement: payload.allowSuspiciousReplacement === true,
    });
    if (!persisted.saved) return staticDashboardResult(prepared, { saved: false });
    const skuCacheUpdate = mergeDashboardSkuNameCache(prepared.accountId, prepared.processed.learnedSkuNameMap || {});
    if (prepared.processed.enrichmentDiagnostics && prepared.processed.enrichmentDiagnostics.provider === "easyorders") {
      prepared.processed.enrichmentDiagnostics = {
        ...prepared.processed.enrichmentDiagnostics,
        skuNameCacheAdded: skuCacheUpdate.added,
        skuNameCacheUpdated: skuCacheUpdate.updated,
        skuNameCacheTotal: skuCacheUpdate.total,
      };
      if (prepared.processed.parseDiagnostics && prepared.processed.parseDiagnostics.enrichment) {
        prepared.processed.parseDiagnostics.enrichment = prepared.processed.enrichmentDiagnostics;
      }
    }
    return staticDashboardResult(prepared, {
      saved: true,
      storedRows: persisted.mergedRows.length,
      enriched: persisted.enriched,
    });
  } catch (error) {
    monitoring.captureException(error, { operation: "dashboard.static.apply", extra: { accountId: payload?.accountId } });
    return { ok: false, accountId: payload?.accountId || "", error: error.message };
  }
});

ipcMain.handle("save-dashboard-snapshot", async (_, accountId, data) => {
  try {
    const persisted = persistDashboardSnapshot(accountId, data, { source: "manual-snapshot", timestampKey: "manualFetchTimestamp" });
    return { ok: true, enriched: persisted.enriched };
  } catch (err) {
    console.error("[Dashboard] save-dashboard-snapshot error:", err.message);
    monitoring.captureException(err, { operation: "dashboard.saveSnapshot", extra: { accountId } });
    return { ok: false, error: err.message };
  }
});

function getDashboardSnapshotResult(accountId, knownRevision) {
  try {
    const allowedIds = (store.get("accounts", []) || []).map((account) => account && account.id).filter(Boolean);
    const accounts = reconcileDashboardSnapshotsWithAccounts();
    const revision = String(Number(dashboardStore.get("snapshotRevision", 0) || 0)) + "|" + allowedIds.join(",");
    if (knownRevision != null && String(knownRevision) === revision) {
      return { ok: true, unchanged: true, revision, data: null };
    }
    if (accountId && accountId !== "__all__") {
      return { ok: true, revision, data: normalizeDashboardAccountSnapshot(accounts[accountId]) };
    }
    if (allowedIds.length) {
      const filtered = {};
      allowedIds.forEach((id) => {
        if (accounts[id]) filtered[id] = normalizeDashboardAccountSnapshot(accounts[id]);
      });
      Object.keys(accounts || {}).forEach((id) => {
        if (filtered[id]) return;
        const snapshot = accounts[id] && accounts[id].snapshot;
        if (Array.isArray(snapshot) && snapshot.length) filtered[id] = normalizeDashboardAccountSnapshot(accounts[id]);
      });
      return { ok: true, revision, data: filtered };
    }
    // Return all accounts
    return { ok: true, revision, data: normalizeDashboardAccountsSnapshot(accounts) };
  } catch (err) {
    monitoring.captureException(err, { operation: "dashboard.getSnapshot", extra: { accountId } });
    return { ok: false, data: null, error: err.message };
  }
}

const dashboardSnapshotTransportCache = new Map();
function getDashboardSnapshotTransport(accountId, knownRevision) {
  const totalStartedAt = Date.now();
  const resultStartedAt = Date.now();
  const result = getDashboardSnapshotResult(accountId, knownRevision);
  const resultMs = Date.now() - resultStartedAt;
  if (!result || !result.ok) {
    return {
      result,
      json: JSON.stringify(result),
      cacheHit: false,
      timings: { resultMs, stringifyMs: 0, gzipMs: 0, totalMs: Date.now() - totalStartedAt }
    };
  }
  const key = String(accountId || "__all__") + "|" + String(result.revision || "") + "|" + (result.unchanged ? "unchanged" : "data");
  let cached = dashboardSnapshotTransportCache.get(key);
  let cacheHit = true;
  if (!cached) {
    cacheHit = false;
    const stringifyStartedAt = Date.now();
    const json = JSON.stringify(result);
    const stringifyMs = Date.now() - stringifyStartedAt;
    const gzipStartedAt = Date.now();
    const gzipBytes = zlib.gzipSync(json, { level: 1 });
    const gzipMs = Date.now() - gzipStartedAt;
    cached = {
      json,
      gzipBytes,
      timings: { stringifyMs, gzipMs }
    };
    if (dashboardSnapshotTransportCache.size >= 2) dashboardSnapshotTransportCache.clear();
    dashboardSnapshotTransportCache.set(key, cached);
  }
  return {
    result,
    json: cached.json,
    gzipBytes: cached.gzipBytes,
    cacheHit,
    timings: {
      resultMs,
      stringifyMs: cacheHit ? 0 : cached.timings.stringifyMs,
      gzipMs: cacheHit ? 0 : cached.timings.gzipMs,
      totalMs: Date.now() - totalStartedAt
    }
  };
}

ipcMain.handle("get-dashboard-snapshot", async (_, accountId, knownRevision) => {
  return getDashboardSnapshotResult(accountId, knownRevision);
});

ipcMain.handle("get-dashboard-snapshot-json", async (_, accountId, knownRevision) => {
  return getDashboardSnapshotTransport(accountId, knownRevision).json;
});

ipcMain.handle("get-dashboard-snapshot-gzip", async (_, accountId, knownRevision) => {
  const transport = getDashboardSnapshotTransport(accountId, knownRevision);
  const gzipBytes = transport.gzipBytes || zlib.gzipSync(transport.json, { level: 1 });
  return {
    encoding: "gzip",
    data: gzipBytes,
    revision: transport.result && transport.result.revision,
    unchanged: !!(transport.result && transport.result.unchanged),
    cacheHit: !!transport.cacheHit,
    timings: transport.timings || null
  };
});

function dashboardQueryRuntimeFlag(canonicalKey, legacyKey) {
  return process.env[canonicalKey] === "1" || process.env[legacyKey] === "1";
}

ipcMain.handle("get-dashboard-query-flags", async () => ({
  ok: true,
  shadow: dashboardQueryRuntimeFlag("KHOD_DASHBOARD_QUERY_SHADOW", "TAAGER_DASHBOARD_QUERY_SHADOW"),
  orders: dashboardQueryRuntimeFlag("KHOD_DASHBOARD_QUERY_ORDERS", "TAAGER_DASHBOARD_QUERY_ORDERS"),
  products: dashboardQueryRuntimeFlag("KHOD_DASHBOARD_QUERY_PRODUCTS", "TAAGER_DASHBOARD_QUERY_PRODUCTS"),
  campaigns: dashboardQueryRuntimeFlag("KHOD_DASHBOARD_QUERY_CAMPAIGNS", "TAAGER_DASHBOARD_QUERY_CAMPAIGNS"),
  // Cities has a complete legacy model in the renderer. Keep its rollout
  // independent from Products so enabling backend product pagination cannot
  // silently start a second O(order-count) Cities pass in the main process.
  cities: dashboardQueryRuntimeFlag("KHOD_DASHBOARD_QUERY_CITIES", "TAAGER_DASHBOARD_QUERY_CITIES"),
  lazyMarketing: process.env.TAAGER_DASHBOARD_LAZY_MARKETING !== "0",
  incrementalMarketing: process.env.TAAGER_MARKETING_INCREMENTAL_SYNC === "1",
}));

ipcMain.handle("query-dashboard-data", async (_, payload = {}) => {
  const startedAt = Date.now();
  try {
    const result = dashboardQueryService.query(payload);
    return { ...result, durationMs: Date.now() - startedAt, revision: Number(dashboardStore.get("snapshotRevision", 0) || 0) };
  } catch (error) {
    monitoring.captureException(error, { operation: "dashboard.query", extra: { kind: payload && payload.kind } });
    return { ok: false, error: error.message, durationMs: Date.now() - startedAt };
  }
});

ipcMain.handle("export-dashboard-orders-query", async (_, payload = {}) => {
  try {
    const result = dashboardQueryService.query({ ...payload, kind: "orders", allRows: true, page: 1 });
    if (!result || !result.ok) return result || { ok: false, error: "DASHBOARD_EXPORT_FAILED" };
    const rows = (result.rows || []).map((row) => ({
      Account: row.accountLabel || row.accountId || "",
      "Order Number": row.khodOrderNumber || row.taagerOrderNumber || row.orderNumber || row.id || "",
      Customer: row.customerName || row.name || "",
      Phone: (row.phone || row.phone1 || row.phone2 || "").toString().replace(/[\s\-\+]/g, "").replace(/^966/, "0"),
      City: row.city || "",
      Products: row.products || "",
      SKUs: row.sku || "",
      Status: row.orderStatus || row.status || row.statusBucket || "",
      Date: row.createdAt || row.date || "",
      Total: row.dashboardTotalPrice || row.totalPrice || 0,
      "Profit After Tax": row.profitAfterTax || row.khodProfit || row.taagerProfit || 0,
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Orders");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const filename = `dashboard-orders-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const { filePath } = await dialog.showSaveDialog(mainWindow, { defaultPath: filename, filters: [{ name: "Excel", extensions: ["xlsx"] }] });
    if (!filePath) return { ok: true, saved: false };
    fs.writeFileSync(filePath, buffer);
    return { ok: true, saved: true, path: filePath, rows: rows.length };
  } catch (error) {
    monitoring.captureException(error, { operation: "dashboard.query.exportOrders" });
    return { ok: false, error: error.message };
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
    bumpDashboardSnapshotRevision();
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
  const stable = account && (khodEmailIdentityOf(account) || account.easyEmail || account.email || account.label || account.memberName || "");
  return String(stable || clean).trim().toLowerCase();
}

function marketingAccountLookupKeys(accountId) {
  const clean = String(accountId || "").trim();
  const account = getStoredAccountById(clean);
  const values = [
    clean,
    account && khodEmailIdentityOf(account),
    account && account.khodEmail,
    account && account.khod_email,
    account && account.easyEmail,
    account && account.easy_email,
    account && account.email,
    account && account.label,
    account && account.name,
    account && account.memberName,
    accountDisplayName(account, ""),
    // Compatibility only: older dashboard marketing rows may have been keyed by Taager identity.
    account && khodMarketingKeyOf(account),
    account && khodMarketingIdentityOf(account),
    account && (account.khodPhone || account.taagerPhone),
    account && (account.khodEmail || account.taagerEmail),
  ];
  const keys = [];
  values.forEach((value) => {
    const key = String(value || "").trim().toLowerCase();
    if (key && !keys.includes(key)) keys.push(key);
  });
  return keys;
}

const TAAGER_USD_RATES = { USD: 1, SAR: 3.75, EGP: 52, AED: 3.6725, IQD: 1310, OMR: 0.385 };

function normalizeMarketingExchangeRates(rates, egpRate) {
  const source = rates && typeof rates === "object" ? rates : {};
  const normalized = {};
  Object.keys(TAAGER_USD_RATES).forEach((currency) => {
    const value = Number(source[currency]);
    normalized[currency] = Number.isFinite(value) && value > 0 ? value : TAAGER_USD_RATES[currency];
  });
  const legacyEgp = Number(egpRate);
  if ((!source.EGP || !(Number(source.EGP) > 0)) && legacyEgp > 0) normalized.EGP = legacyEgp;
  normalized.USD = 1;
  return normalized;
}

function marketingExchangeRatesEqual(left, right) {
  if (!left || !right) return false;
  const a = normalizeMarketingExchangeRates(left);
  const b = normalizeMarketingExchangeRates(right);
  return Object.keys(TAAGER_USD_RATES).every((currency) => Number(a[currency]) === Number(b[currency]));
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
    const account = accounts.find((candidate) => String(candidate && candidate.id || "").trim() === id) || {};
    const accountCountry = String(account.khodCountry || account.taagerCountry || "sa").trim().toLowerCase();
    const countryCurrency = accountCountry === "eg" ? "EGP" :
      accountCountry === "ae" ? "AED" :
      accountCountry === "iq" ? "IQD" :
      accountCountry === "om" ? "OMR" : "SAR";
    const lookupKeys = marketingAccountLookupKeys(id);
    const explicitKeys = Array.isArray(setting.dashboardAccountKeys)
      ? setting.dashboardAccountKeys.map((key) => String(key || "").trim().toLowerCase()).filter(Boolean)
      : [];
    const allKeys = [...new Set([...(explicitKeys || []), ...lookupKeys])];
    const exchangeRates = normalizeMarketingExchangeRates(setting.exchangeRates, setting.egpRate);
    return {
      ...setting,
      dashboardAccountId: id,
      dashboardAccountKey: String(setting.dashboardAccountKey || marketingStableAccountKey(id) || id).trim().toLowerCase(),
      dashboardAccountKeys: allKeys,
      currency: setting.currency || countryCurrency,
      exchangeRates,
      egpRate: exchangeRates.EGP,
    };
  });
}

function marketingCurrency(value, fallback = "USD") {
  const cur = String(value || fallback || "USD").trim().toUpperCase();
  return TAAGER_USD_RATES[cur] ? cur : String(fallback || "USD").toUpperCase();
}

function convertMarketingAmount(amount, from, to, egpRate = 52, exchangeRates) {
  const source = marketingCurrency(from);
  const target = marketingCurrency(to, source);
  if (source === target) return Number(amount || 0) || 0;
  const rates = normalizeMarketingExchangeRates(exchangeRates, egpRate);
  return ((Number(amount || 0) || 0) / Number(rates[source] || 1)) * Number(rates[target] || 1);
}

function mergeMarketingSourceAccounts(...lists) {
  const byId = new Map();
  lists.forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((account) => {
      const id = String(account && account.id || "").trim();
      if (!id) return;
      byId.set(id, { ...(byId.get(id) || {}), ...account, id });
    });
  });
  return Array.from(byId.values());
}

function mergeMarketingMappings(...items) {
  const out = {};
  items.forEach((mappings) => {
    if (!mappings || typeof mappings !== "object") return;
    Object.keys(mappings).forEach((key) => {
      out[key] = mergeMarketingSourceAccounts(out[key], mappings[key]);
    });
  });
  return out;
}

function mappedMarketingSourcesForKeys(mappings, keys) {
  const source = mappings && typeof mappings === "object" ? mappings : {};
  const lookup = (Array.isArray(keys) ? keys : [])
    .map((key) => String(key || "").trim().toLowerCase())
    .filter(Boolean);
  for (const key of lookup) {
    if (Array.isArray(source[key])) return source[key];
  }
  return [];
}

function marketingSourceAccountSignature(list) {
  return (Array.isArray(list) ? list : [])
    .map((source) => String(source && source.id || "").trim())
    .filter(Boolean)
    .sort()
    .join("|");
}

function marketingDiagnosticFingerprint(value) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  return crypto.createHash("sha256").update(clean).digest("hex").slice(0, 12);
}

function marketingDiagnosticAccountIds(list) {
  const ids = [];
  (Array.isArray(list) ? list : []).forEach((item) => {
    const id = String(item && (
      item.id ||
      item.accountId ||
      item.account_id ||
      item.sourceAccountId ||
      item.source_account_id ||
      item.adAccountId ||
      item.ad_account_id ||
      item.account ||
      ""
    ) || "").trim();
    if (id && !ids.includes(id)) ids.push(id);
  });
  return ids;
}

function marketingDiagnosticMappingIds(mappings) {
  const out = {};
  if (!mappings || typeof mappings !== "object") return out;
  Object.keys(mappings).forEach((key) => {
    out[key] = marketingDiagnosticAccountIds(mappings[key]);
  });
  return out;
}

function marketingDiagnosticUrlFingerprints(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return {};
  try {
    const parsed = new URL(value);
    const fingerprints = {};
    parsed.searchParams.forEach((paramValue, paramName) => {
      const lower = String(paramName || "").toLowerCase();
      if (/(^|_)(access|refresh)?token($|_)|authorization|code|state|secret|key/.test(lower)) {
        fingerprints[paramName] = marketingDiagnosticFingerprint(paramValue);
      }
    });
    return {
      host: parsed.hostname,
      path: parsed.pathname,
      paramFingerprints: fingerprints,
    };
  } catch (_) {
    return { malformed: true, fingerprint: marketingDiagnosticFingerprint(value) };
  }
}

function marketingSensitiveDiagnosticKey(key) {
  const lower = String(key || "").toLowerCase();
  if (!lower) return false;
  if (lower.includes("fingerprint") || lower.endsWith("present") || lower.endsWith("count")) return false;
  return lower.includes("access_token") ||
    lower.includes("refresh_token") ||
    lower.includes("authorizationurl") ||
    lower.includes("authorization_url") ||
    lower === "token" ||
    lower.endsWith("token") ||
    lower.includes("secret") ||
    lower.includes("apikey") ||
    lower.includes("api_key");
}

function sanitizeMarketingDiagnostics(value, key = "") {
  if (marketingSensitiveDiagnosticKey(key)) {
    return { present: !!value, fingerprint: marketingDiagnosticFingerprint(value) };
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeMarketingDiagnostics(item));
  if (!value || typeof value !== "object") return value;
  const out = {};
  Object.keys(value).forEach((childKey) => {
    out[childKey] = sanitizeMarketingDiagnostics(value[childKey], childKey);
  });
  return out;
}

function marketingStatusAccountIdSnapshot(status) {
  return {
    linked: marketingDiagnosticAccountIds(status && status.linkedAccounts),
    mapped: marketingDiagnosticAccountIds(status && status.mappedAccounts),
    available: marketingDiagnosticAccountIds(status && status.availableAccounts),
    claimable: marketingDiagnosticAccountIds(status && status.claimableAccounts),
    mappings: marketingDiagnosticMappingIds(status && status.mappings),
  };
}

function marketingResultLogSummary(result) {
  const summary = result && result.summary && typeof result.summary === "object" ? result.summary : null;
  const diagnostics = result && result.diagnostics && typeof result.diagnostics === "object" ? result.diagnostics : {};
  return {
    ok: !!(result && result.ok),
    status: result && result.status || "",
    error: result && result.error || "",
    linkedAccountCount: result && result.linkedAccountCount || 0,
    mappedAccountCount: result && Array.isArray(result.mappedAccounts) ? result.mappedAccounts.length : 0,
    availableAccountCount: result && Array.isArray(result.availableAccounts) ? result.availableAccounts.length : 0,
    claimableAccountCount: result && Array.isArray(result.claimableAccounts) ? result.claimableAccounts.length : 0,
    cacheStatus: result && result.cache && result.cache.status || "",
    providerRequestCount: result && result.cache && result.cache.providerRequestCount || diagnostics.providerRequestCount || 0,
    diagnostics: {
      clientRequestId: diagnostics.clientRequestId || "",
      accountConnected: diagnostics.accountConnected,
      accountConnectionVerified: diagnostics.accountConnectionVerified,
      authorizationPending: diagnostics.authorizationPending,
      discoveredAccountCount: diagnostics.discoveredAccountCount,
      sessionAccountCount: diagnostics.sessionAccountCount,
      staleMappingPrunedCount: diagnostics.staleMappingPrunedCount,
      staleMappingPruneReason: diagnostics.staleMappingPruneReason,
      providerGroupCount: diagnostics.providerGroupCount,
      providerRefs: diagnostics.providerRefs,
      sourceProviderRefs: diagnostics.sourceProviderRefs,
      providerOwnershipCorrectedCount: diagnostics.providerOwnershipCorrectedCount,
      claimProviderKeyId: diagnostics.claimProviderKeyId,
      claimProviderChanged: diagnostics.claimProviderChanged,
      releaseProviderKeyId: diagnostics.releaseProviderKeyId,
      reconnectRequired: result && result.reconnectRequired,
      windsorStatus: diagnostics.windsorStatus,
      windsorCode: diagnostics.windsorCode,
      windsorMessage: diagnostics.windsorMessage,
    },
    summary: summary ? {
      adSpend: summary.adSpend,
      currency: summary.currency,
      rowCount: summary.rowCount,
      campaignCount: summary.campaignCount,
    } : null,
  };
}

function marketingDiagnosticTokenFingerprintFromDiagnostics(diagnostics) {
  const source = diagnostics && typeof diagnostics === "object" ? diagnostics : {};
  const candidates = [
    source.tokenFingerprint,
    source.accessTokenFingerprint,
    source.access_token_fingerprint,
    source.storedTokenFingerprint,
    source.previousTokenFingerprint,
    source.previousStoredTokenFingerprint,
  ];
  for (const candidate of candidates) {
    const clean = String(candidate || "").trim();
    if (clean) return clean;
  }
  return "";
}

function getCachedMarketingStatus(accountId, platform) {
  const accounts = dashboardStore.get("accounts", {});
  if (accountId === "__all__") {
    const storedAll = accounts.__all__?.marketing?.[platform] || null;
    const individualStatuses = Object.keys(accounts)
      .filter((id) => id !== "__all__" && id !== "__connection__")
      .map((id) => accounts[id]?.marketing?.[platform])
      .filter(Boolean);

    if (individualStatuses.length === 0) return storedAll;

    const connectedStatuses = individualStatuses.filter((s) => s.status === "connected");
    if (connectedStatuses.length === 0) {
      return {
        platform,
        status: storedAll && (storedAll.status === "connected" || storedAll.status === "pending") ? storedAll.status : "disconnected",
        lastSyncAt: storedAll && storedAll.lastSyncAt || null,
        summary: storedAll && storedAll.summary || null,
        linkedAccounts: storedAll && Array.isArray(storedAll.linkedAccounts) ? storedAll.linkedAccounts : [],
        mappedAccounts: storedAll && Array.isArray(storedAll.mappedAccounts) ? storedAll.mappedAccounts : [],
        availableAccounts: storedAll && Array.isArray(storedAll.availableAccounts) ? storedAll.availableAccounts : [],
        mappings: storedAll && storedAll.mappings || {},
        limits: storedAll && storedAll.limits || null,
        diagnostics: storedAll && storedAll.diagnostics || null,
        statusCheckedAt: storedAll && storedAll.statusCheckedAt || null,
      };
    }

    const allTargetCurrency = marketingCurrency(storedAll && storedAll.summary && storedAll.summary.currency, "USD");
    const allExchangeRates = storedAll && storedAll.summary && storedAll.summary.exchangeRates || null;
    const allSummary = connectedStatuses.reduce((summary, s) => {
      const source = s.summary || {};
      summary.adSpend += convertMarketingAmount(source.adSpend || 0, source.currency || "USD", allTargetCurrency, source.egpRate || 52, source.exchangeRates || allExchangeRates);
      summary.impressions += Number(source.impressions || 0);
      summary.clicks += Number(source.clicks || 0);
      summary.campaignCount += Number(source.campaignCount || 0);
      summary.rowCount += Number(source.rowCount || 0);
      summary.sourceBreakdown = summary.sourceBreakdown.concat(Array.isArray(source.sourceBreakdown) ? source.sourceBreakdown : []);
      summary.campaignBreakdown = summary.campaignBreakdown.concat(Array.isArray(source.campaignBreakdown) ? source.campaignBreakdown : []);
      return summary;
    }, {
      adSpend: 0,
      currency: allTargetCurrency,
      exchangeRates: allExchangeRates,
      egpRate: allExchangeRates && allExchangeRates.EGP || 52,
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
    let oldestStatusCheckedAt = null;
    let minDateFrom = "";
    let maxDateTo = "";
    connectedStatuses.forEach((s) => {
      if (s.lastSyncAt) {
        if (!latestSyncAt || new Date(s.lastSyncAt) > new Date(latestSyncAt)) {
          latestSyncAt = s.lastSyncAt;
        }
      }
      if (s.statusCheckedAt) {
        if (!oldestStatusCheckedAt || new Date(s.statusCheckedAt) < new Date(oldestStatusCheckedAt)) {
          oldestStatusCheckedAt = s.statusCheckedAt;
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
      linkedAccounts: mergeMarketingSourceAccounts(storedAll && storedAll.linkedAccounts, Array.from(linkedAccountsMap.values())),
      mappedAccounts: mergeMarketingSourceAccounts(storedAll && storedAll.mappedAccounts),
      availableAccounts: mergeMarketingSourceAccounts(storedAll && storedAll.availableAccounts),
      mappings: mergeMarketingMappings(storedAll && storedAll.mappings, combinedMappings),
      limits: storedAll && storedAll.limits || null,
      diagnostics: storedAll && storedAll.diagnostics || null,
      statusCheckedAt: oldestStatusCheckedAt,
    };
  }

  const account = accounts[accountId] || {};
  const marketing = account.marketing || {};
  return marketing[platform] || null;
}

function getCachedSaudiIPickMarketingStatus(accountId, platform) {
  // Compatibility contract: getCachedMarketingStatus(dashboardAccountId, platform)
  // remains the shared local cache lookup used by the native provider.
  const cached = getCachedMarketingStatus(accountId, platform);
  return cached && cached.provider === "saudiipick" ? cached : null;
}

function getSaudiIPickDesktopToken() {
  return String(dashboardStore.get("saudiIPickMarketing.desktopToken", "") || process.env.SAUDIIPICK_DESKTOP_TOKEN || "").trim();
}

function maskToken(value) {
  const clean = String(value || "");
  if (!clean) return "";
  return `${clean.slice(0, 7)}...${clean.slice(-4)}`;
}

function normalizeNativeSourceAccount(source, fallbackCurrency = "SAR", platform = "snapchat") {
  const id = String(source && (source.id || source.sourceAccountId || source.adAccountId) || "").trim();
  if (!id) return null;
  const health = source && source.connectionHealth && typeof source.connectionHealth === "object" ? source.connectionHealth : null;
  const fallback = platform === "tiktok" ? "UNKNOWN" : fallbackCurrency || "SAR";
  return {
    id,
    name: String(source && (source.name || source.sourceAccountName || source.adAccountName) || id),
    currency: String(source && (source.rawCurrency || source.nativeRawCurrency || source.sourceCurrency || source.accountCurrency || source.account_currency || source.currency) || fallback).toUpperCase(),
    platform,
    provider: "saudiipick",
    organizationName: String(source && source.organizationName || ""),
    connectionId: String(source && (source.connectionId || source.connection_id) || ""),
    connectionStatus: String(source && (source.connectionStatus || source.connection_status) || health && health.status || ""),
    connectionHealth: health,
    usable: health ? health.usable !== false : !(source && source.usable === false),
    error: source && source.error || "",
    errorDescription: source && (source.errorDescription || source.error_description) || health && health.message || "",
    canManageCampaigns: !!(source && source.canManageCampaigns),
  };
}

function nativeMarketingNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function nativeMarketingSourceId(value) {
  return String(value && (value.accountId || value.id || value.sourceAccountId || value.adAccountId || value.advertiserId) || "").trim();
}

function nativeMarketingUsableAccountIds(result) {
  const ids = new Set();
  ["selectedSourceAccounts", "mappedAccounts", "linkedAccounts", "availableAccounts", "accounts"].forEach((key) => {
    (Array.isArray(result && result[key]) ? result[key] : []).forEach((source) => {
      const id = nativeMarketingSourceId(source);
      if (id && !(source && source.usable === false)) ids.add(id);
    });
  });
  const summary = result && result.summary || {};
  ["sourceBreakdown", "campaignBreakdown"].forEach((key) => {
    (Array.isArray(summary[key]) ? summary[key] : []).forEach((row) => {
      const id = nativeMarketingSourceId(row);
      if (id) ids.add(id);
    });
  });
  return ids;
}

function nativeMarketingSanitizeAccountHealth(result) {
  if (!result || typeof result !== "object") return result;
  const usableIds = nativeMarketingUsableAccountIds(result);
  const isStaleConnectionError = (error) => {
    const id = nativeMarketingSourceId(error);
    return !!(id && usableIds.has(id) && String(error && error.endpoint || "") === "connection");
  };
  const originalAccountErrors = Array.isArray(result.accountErrors) ? result.accountErrors : [];
  const originalErrors = Array.isArray(result.errors) ? result.errors : [];
  const accountErrors = originalAccountErrors.filter((error) => !isStaleConnectionError(error));
  const errors = originalErrors.filter((error) => !isStaleConnectionError(error));
  const healthById = new Map();
  (Array.isArray(result.accountHealth) ? result.accountHealth : []).forEach((health) => {
    const id = nativeMarketingSourceId(health);
    if (!id) return;
    const current = healthById.get(id);
    if (!current || current.usable === false && health.usable !== false) healthById.set(id, health);
  });
  const next = {
    ...result,
    accountErrors,
    errors,
    accountHealth: Array.from(healthById.values()),
  };
  if (result.partial && originalAccountErrors.length && !accountErrors.length && !errors.length && !(result.diagnostics && result.diagnostics.accountSpendFallbackUsed)) {
    next.partial = false;
  } else if (accountErrors.length || errors.length) {
    next.partial = true;
  }
  return next;
}

function nativeMarketingCurrency(value) {
  return String(value || "").trim().toUpperCase();
}

function nativeMarketingRowCurrency(row, source, fallbackCurrency, sourceMatched) {
  const sourceCurrency = sourceMatched ? nativeMarketingCurrency(source && source.currency) : "";
  const rowCurrency = nativeMarketingCurrency(row && (row.rawCurrency || row.nativeRawCurrency || row.sourceCurrency || row.accountCurrency || row.account_currency || row.currency));
  const fallback = nativeMarketingCurrency(fallbackCurrency);
  return sourceCurrency || rowCurrency || (fallback && fallback !== "MIXED" ? fallback : "SAR");
}

function nativeMarketingRawSpendByCurrency(sourceBreakdown, fallbackCurrency = "") {
  const totals = {};
  (Array.isArray(sourceBreakdown) ? sourceBreakdown : []).forEach((row) => {
    const currency = nativeMarketingCurrency(row && (row.rawCurrency || row.currency) || fallbackCurrency);
    if (!currency || currency === "MIXED") return;
    const amount = nativeMarketingNumber(row && (row.rawSpend ?? row.nativeRawSpend ?? row.spend ?? row.adSpend));
    if (amount <= 0) return;
    totals[currency] = nativeMarketingNumber(totals[currency]) + amount;
  });
  Object.keys(totals).forEach((currency) => {
    totals[currency] = Number(totals[currency].toFixed(2));
  });
  return totals;
}

function normalizeNativeMarketingSummary(summary, sourceAccounts, dashboardAccountId, platform = "snapchat") {
  if (!summary || typeof summary !== "object") return summary || null;
  const selected = (Array.isArray(sourceAccounts) ? sourceAccounts : [])
    .map((source) => normalizeNativeSourceAccount(source, summary.currency || "SAR", platform))
    .filter(Boolean);
  const byId = new Map(selected.map((source) => [source.id, source]));
  const fallbackSource = selected[0] || null;
  const fallbackCurrency = fallbackSource && fallbackSource.currency || String(summary.currency || "SAR").toUpperCase();

  const campaignBreakdown = (Array.isArray(summary.campaignBreakdown) ? summary.campaignBreakdown : []).map((row) => {
    const sourceId = String(row && (row.sourceAccountId || row.adAccountId || row.accountId) || fallbackSource && fallbackSource.id || "");
    const source = byId.get(sourceId) || fallbackSource || {};
    const sourceMatched = byId.has(sourceId);
    const rawCurrency = nativeMarketingRowCurrency(row, source, fallbackCurrency, sourceMatched);
    const rawSpend = nativeMarketingNumber(row && (row.rawSpend ?? row.nativeRawSpend ?? row.spend ?? row.adSpend ?? row.cost));
    return {
      ...row,
      provider: "saudiipick",
      platform,
      dashboardAccountId: row && row.dashboardAccountId || dashboardAccountId,
      sourceAccountId: sourceId,
      sourceAccountName: row && row.sourceAccountName || source.name || sourceId,
      rawSpend,
      rawCurrency,
      currency: rawCurrency,
      spend: rawSpend,
      adSpend: rawSpend,
    };
  });

  let sourceBreakdown = (Array.isArray(summary.sourceBreakdown) ? summary.sourceBreakdown : []).map((row) => {
    const sourceId = String(row && (row.sourceAccountId || row.id || row.adAccountId || row.accountId) || fallbackSource && fallbackSource.id || "");
    const source = byId.get(sourceId) || fallbackSource || {};
    const sourceMatched = byId.has(sourceId);
    const rawCurrency = nativeMarketingRowCurrency(row, source, fallbackCurrency, sourceMatched);
    const rawSpend = nativeMarketingNumber(row && (row.rawSpend ?? row.nativeRawSpend ?? row.spend ?? row.adSpend ?? row.cost));
    return {
      ...row,
      id: sourceId,
      name: row && row.name || row && row.sourceAccountName || source.name || sourceId,
      provider: "saudiipick",
      platform,
      dashboardAccountId: row && row.dashboardAccountId || dashboardAccountId,
      sourceAccountId: sourceId,
      sourceAccountName: row && row.sourceAccountName || source.name || sourceId,
      rawSpend,
      rawCurrency,
      currency: rawCurrency,
      spend: rawSpend,
      adSpend: rawSpend,
    };
  });

  if (!sourceBreakdown.length && campaignBreakdown.length) {
    const grouped = new Map();
    campaignBreakdown.forEach((row) => {
      const sourceId = String(row.sourceAccountId || fallbackSource && fallbackSource.id || "");
      if (!sourceId) return;
      const source = byId.get(sourceId) || fallbackSource || {};
      const current = grouped.get(sourceId) || {
        id: sourceId,
        name: source.name || row.sourceAccountName || sourceId,
        provider: "saudiipick",
        platform,
        dashboardAccountId,
        sourceAccountId: sourceId,
        sourceAccountName: source.name || row.sourceAccountName || sourceId,
        rawSpend: 0,
        rawCurrency: nativeMarketingRowCurrency(row, source, fallbackCurrency, byId.has(sourceId)),
        currency: nativeMarketingRowCurrency(row, source, fallbackCurrency, byId.has(sourceId)),
        spend: 0,
        adSpend: 0,
      };
      current.rawSpend += nativeMarketingNumber(row.rawSpend);
      current.spend = current.rawSpend;
      current.adSpend = current.rawSpend;
      grouped.set(sourceId, current);
    });
    sourceBreakdown = Array.from(grouped.values()).map((row) => ({
      ...row,
      rawSpend: Number(row.rawSpend.toFixed(2)),
      spend: Number(row.spend.toFixed(2)),
      adSpend: Number(row.adSpend.toFixed(2)),
    }));
  }

  if (!sourceBreakdown.length && selected.length === 1 && nativeMarketingNumber(summary.adSpend) > 0) {
    const source = selected[0];
    sourceBreakdown = [{
      id: source.id,
      name: source.name,
      provider: "saudiipick",
      platform,
      dashboardAccountId,
      sourceAccountId: source.id,
      sourceAccountName: source.name,
      rawSpend: nativeMarketingNumber(summary.adSpend),
      rawCurrency: source.currency || fallbackCurrency,
      currency: source.currency || fallbackCurrency,
      spend: nativeMarketingNumber(summary.adSpend),
      adSpend: nativeMarketingNumber(summary.adSpend),
    }];
  }

  const normalizedRawSpendByCurrency = nativeMarketingRawSpendByCurrency(sourceBreakdown, fallbackCurrency);
  const normalizedCurrencies = Object.keys(normalizedRawSpendByCurrency);
  const normalizedCurrency = normalizedCurrencies.length === 1
    ? normalizedCurrencies[0]
    : (normalizedCurrencies.length > 1 ? "MIXED" : nativeMarketingCurrency(summary.currency || fallbackCurrency || "SAR"));

  return {
    ...summary,
    provider: "saudiipick",
    platform,
    currency: normalizedCurrency,
    sourceCurrency: normalizedCurrency,
    currencyMixed: normalizedCurrency === "MIXED",
    rawSpendByCurrency: normalizedCurrencies.length ? normalizedRawSpendByCurrency : (summary.rawSpendByCurrency || {}),
    sourceBreakdown,
    campaignBreakdown,
    rowCount: Number(summary.rowCount || campaignBreakdown.length || sourceBreakdown.length || 0),
    campaignCount: Number(summary.campaignCount || campaignBreakdown.length || 0),
  };
}

function mergeNativeMarketingMappings(previous, dashboardAccountId, dashboardAccountKey, sourceAccounts, platform = "snapchat") {
  const mappings = previous && previous.mappings && typeof previous.mappings === "object" ? { ...previous.mappings } : {};
  const sources = (Array.isArray(sourceAccounts) ? sourceAccounts : [])
    .map((source) => normalizeNativeSourceAccount(source, "SAR", platform))
    .filter(Boolean);
  mappings[dashboardAccountId] = sources;
  if (dashboardAccountKey) mappings[dashboardAccountKey] = sources;
  return mappings;
}

async function callSaudiIPickMarketing(action, accountId, platform = "snapchat", range = {}) {
  const dashboardAccountId = marketingAccountKey(accountId, action !== "sync");
  if (!dashboardAccountId) return { ok: false, error: "SELECT_SINGLE_ACCOUNT" };
  if (!["snapchat", "tiktok", "facebook"].includes(platform)) return { ok: false, error: "PLATFORM_NOT_AVAILABLE" };
  if (!(await isLicenseValid())) return { ok: false, error: "LICENSE_INVALID" };

  const token = getSaudiIPickDesktopToken();
  const connectUrl = `${SAUDIIPICK_MARKETING_API_BASE}/dashboard/settings`;
  if (!token) {
    return {
      ok: false,
      provider: "saudiipick",
      platform,
      status: "disconnected",
      error: "SAUDIIPICK_TOKEN_REQUIRED",
      authorizationUrl: connectUrl,
    };
  }

  const account = getStoredAccountById(dashboardAccountId);
  const dashboardAccountKey = marketingStableAccountKey(dashboardAccountId);
  const previous = getCachedSaudiIPickMarketingStatus(dashboardAccountId, platform);
  const payload = {
    action,
    platform,
    dashboardAccountId,
    dashboardAccountKey,
    dashboardAccountLabel: accountDisplayName(account, dashboardAccountId),
    range: range || {},
    sourceAccounts: range && Array.isArray(range.sourceAccounts) ? range.sourceAccounts : [],
    mappings: range && Array.isArray(range.mappings) ? range.mappings : [],
    identity: {
      licenseKey: licenseStore.get("licenseKey", ""),
      machineUuid: _getOrCreateMachineUUID(),
      deviceId: getDeviceFingerprint(),
      accountIdents: _buildAccountIdents(),
    },
  };

  log.info("[SaudiIPick][Marketing] request", {
    action,
    platform,
    dashboardAccountId,
    sourceAccountIds: payload.sourceAccounts.map((source) => source && (source.id || source.sourceAccountId)).filter(Boolean),
    token: maskToken(token),
  });

  const result = await httpsJsonRequest("POST", `${SAUDIIPICK_MARKETING_API_BASE}/api/desktop/marketing/${platform}`, payload, {
    Authorization: `Bearer ${token}`,
  });

  log.info("[SaudiIPick][Marketing] response", {
    action,
    platform,
    dashboardAccountId,
    ok: !!(result && result.ok),
    status: result && result.status || "",
    error: result && result.error || "",
    availableAccountCount: Array.isArray(result && result.availableAccounts) ? result.availableAccounts.length : 0,
    mappedAccountCount: Array.isArray(result && result.mappedAccounts) ? result.mappedAccounts.length : 0,
    selectedAccountCount: Array.isArray(result && result.selectedSourceAccounts) ? result.selectedSourceAccounts.length : 0,
    summaryAdSpend: result && result.summary ? result.summary.adSpend : null,
    summaryCurrency: result && result.summary ? result.summary.currency : "",
    partial: !!(result && result.partial),
  });

  const merged = nativeMarketingSanitizeAccountHealth({
    ...result,
    provider: "saudiipick",
    platform,
    mappings: result.mappings && Object.keys(result.mappings).length ? result.mappings : previous && previous.mappings || {},
  });

  if (action === "sync" && merged.ok) {
    const requestedSources = (Array.isArray(range && range.sourceAccounts) ? range.sourceAccounts : [])
      .map((source) => normalizeNativeSourceAccount(source, merged.summary && merged.summary.currency || "SAR", platform))
      .filter(Boolean);
    const responseSources = (Array.isArray(merged.selectedSourceAccounts) && merged.selectedSourceAccounts.length
      ? merged.selectedSourceAccounts
      : Array.isArray(merged.mappedAccounts) && merged.mappedAccounts.length
      ? merged.mappedAccounts
      : Array.isArray(merged.linkedAccounts) && merged.linkedAccounts.length
      ? merged.linkedAccounts
      : [])
      .map((source) => normalizeNativeSourceAccount(source, merged.summary && merged.summary.currency || "SAR", platform))
      .filter((source) => source && source.usable !== false);
    const summarySources = responseSources.length ? responseSources : requestedSources.filter((source) => source.usable !== false);
    if (merged.summary) {
      const summaryRatePayload = {
        ...merged.summary,
        targetCurrency: range && range.targetCurrency || merged.summary.targetCurrency || null,
        egpRate: Number(range && range.egpRate) || merged.summary.egpRate || 52,
        exchangeRates: range && range.exchangeRates && typeof range.exchangeRates === "object"
          ? normalizeMarketingExchangeRates(range.exchangeRates, range.egpRate)
          : merged.summary.exchangeRates || null,
      };
      merged.summary = normalizeNativeMarketingSummary(summaryRatePayload, summarySources, dashboardAccountId, platform);
    }
    if (requestedSources.length || responseSources.length) {
      merged.status = responseSources.length || merged.summary ? "connected" : "disconnected";
      merged.mappedAccounts = responseSources;
      merged.selectedSourceAccounts = responseSources;
      merged.availableAccounts = Array.isArray(merged.availableAccounts) && merged.availableAccounts.length
        ? merged.availableAccounts
        : previous && Array.isArray(previous.availableAccounts) && previous.availableAccounts.length
        ? previous.availableAccounts
        : responseSources.length ? responseSources : requestedSources;
      merged.linkedAccounts = Array.isArray(merged.linkedAccounts) && merged.linkedAccounts.length
        ? merged.linkedAccounts
        : previous && Array.isArray(previous.linkedAccounts) && previous.linkedAccounts.length
        ? previous.linkedAccounts
        : merged.availableAccounts;
      merged.mappings = mergeNativeMarketingMappings(previous, dashboardAccountId, dashboardAccountKey, requestedSources, platform);
    }
    saveCachedMarketingStatus(dashboardAccountId, platform, merged);
  }

  if (action === "status" && merged.ok) {
    const stableStatus = {
      ...merged,
      summary: previous && previous.summary || null,
      lastSyncAt: previous && previous.lastSyncAt || null,
      mappedAccounts: previous && previous.mappedAccounts && previous.mappedAccounts.length ? previous.mappedAccounts : merged.mappedAccounts,
      selectedSourceAccounts: previous && previous.selectedSourceAccounts && previous.selectedSourceAccounts.length ? previous.selectedSourceAccounts : merged.selectedSourceAccounts,
      mappings: previous && previous.mappings || merged.mappings || {},
    };
    const stableSources = Array.isArray(stableStatus.selectedSourceAccounts) && stableStatus.selectedSourceAccounts.length
      ? stableStatus.selectedSourceAccounts
      : (Array.isArray(stableStatus.mappedAccounts) ? stableStatus.mappedAccounts : []);
    if (stableStatus.summary) {
      stableStatus.summary = normalizeNativeMarketingSummary(stableStatus.summary, stableSources, dashboardAccountId, platform);
    }
    if ((Array.isArray(stableStatus.selectedSourceAccounts) && stableStatus.selectedSourceAccounts.length) ||
      (Array.isArray(stableStatus.mappedAccounts) && stableStatus.mappedAccounts.length) ||
      stableStatus.summary) {
      stableStatus.status = "connected";
    }
    saveCachedMarketingStatus(dashboardAccountId, platform, stableStatus);
    return stableStatus;
  }

  return merged;
}

function marketingSyncShouldRetry(result) {
  if (!result || result.ok || result.reconnectRequired) return false;
  const text = String(result.error || result.message || "").toUpperCase();
  return text === "WINDSOR_AUTH_FAILED" ||
    text.includes("TIMEOUT") ||
    text.includes("ECONNRESET") ||
    text.includes("FETCH");
}

function delayMarketingRetry(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveSaudiIPickMarketingMappingState(accountId, platform = "snapchat", sourceAccounts = []) {
  const dashboardAccountId = marketingAccountKey(accountId);
  if (!dashboardAccountId) return { ok: false, error: "SELECT_ACCOUNT_TO_MAP" };
  const previous = getCachedSaudiIPickMarketingStatus(dashboardAccountId, platform) || {};
  const account = getStoredAccountById(dashboardAccountId);
  const dashboardAccountKey = marketingStableAccountKey(dashboardAccountId);
  const selected = (Array.isArray(sourceAccounts) ? sourceAccounts : [])
    .map((source) => normalizeNativeSourceAccount(source, "SAR", platform))
    .filter(Boolean);
  const next = {
    ...previous,
    ok: true,
    provider: "saudiipick",
    platform,
    status: selected.length ? "connected" : "disconnected",
    sourceAccountId: selected.length === 1 ? selected[0].id : "",
    sourceAccountName: selected.length === 1 ? selected[0].name : accountDisplayName(account, dashboardAccountId),
    mappedAccounts: selected,
    selectedSourceAccounts: selected,
    selectedSourceAccountIds: selected.map((source) => source.id),
    availableAccounts: previous.availableAccounts || selected,
    linkedAccounts: previous.linkedAccounts || selected,
    mappings: mergeNativeMarketingMappings(previous, dashboardAccountId, dashboardAccountKey, selected, platform),
    statusCheckedAt: new Date().toISOString(),
  };
  saveCachedMarketingStatus(dashboardAccountId, platform, next);
  return { ok: true, ...getCachedSaudiIPickMarketingStatus(dashboardAccountId, platform), provider: "saudiipick" };
}

ipcMain.handle("get-marketing-status", async (_, accountId, platform = "tiktok", options = {}) => {
  const dashboardAccountId = marketingAccountKey(accountId, true);
  if (!dashboardAccountId) return { ok: false, error: "SELECT_ACCOUNT" };
  try {
    return await callSaudiIPickMarketing("status", dashboardAccountId, platform, options || {});
  } catch (error) {
    log.error("[SaudiIPick][Marketing] compatibility status failed", { accountId: dashboardAccountId, platform, error: error.message });
    const cached = getCachedSaudiIPickMarketingStatus(dashboardAccountId, platform);
    return cached
      ? { ok: false, ...cached, provider: "saudiipick", platform, error: error.message, offline: true }
      : { ok: false, provider: "saudiipick", platform, error: error.message || "STATUS_UNAVAILABLE" };
  }
});
ipcMain.handle("set-auto-confirm", (_, value) => {
  const enabled = value === true;
  store.set("autoConfirm", enabled);
  _credCache = null;
  return enabled;
});
ipcMain.handle("set-easyorders-affiliate-recovery-enabled", (_, value) => {
  const enabled = value === true;
  store.set("easyOrdersAffiliateRecoveryEnabled", enabled);
  _credCache = null;
  return enabled;
});

ipcMain.handle("connect-marketing-platform", async (_, accountId, platform = "tiktok") => {
  try {
    return await callSaudiIPickMarketing("status", accountId, platform, { mode: "force" });
  } catch (error) {
    log.error("[SaudiIPick][Marketing] compatibility connect failed", { accountId, platform, error: error.message });
    return { ok: false, provider: "saudiipick", platform, error: error.message };
  }
});

ipcMain.handle("claim-marketing-source-account", async (_, accountId, platform = "tiktok", sourceAccountId = "") => {
  const dashboardAccountId = marketingAccountKey(accountId, true);
  if (!dashboardAccountId) return { ok: false, error: "SELECT_ACCOUNT" };
  return {
    ok: false,
    provider: "saudiipick",
    platform,
    sourceAccountId,
    error: "SAUDIIPICK_MAPPING_REQUIRED"
  };
});

ipcMain.handle("release-marketing-source-account", async (_, accountId, platform = "tiktok", sourceAccountId = "") => {
  const dashboardAccountId = marketingAccountKey(accountId, true);
  if (!dashboardAccountId || dashboardAccountId === "__all__") return { ok: false, error: "SELECT_ACCOUNT_TO_RELEASE" };
  return {
    ok: false,
    provider: "saudiipick",
    platform,
    sourceAccountId,
    error: "SAUDIIPICK_MAPPING_REQUIRED"
  };
});

ipcMain.handle("save-marketing-mapping", async (_, accountId, platform = "tiktok", sourceAccountIds = []) => {
  try {
    const sourceAccounts = Array.isArray(sourceAccountIds) ? sourceAccountIds.map((source) =>
      typeof source === "string" ? { id: source } : source) : [];
    return await saveSaudiIPickMarketingMappingState(accountId, platform, sourceAccounts);
  } catch (error) {
    log.error("[SaudiIPick][Marketing] compatibility mapping save failed", { accountId, platform, error: error.message });
    return { ok: false, provider: "saudiipick", platform, error: error.message };
  }
});

ipcMain.handle("save-all-marketing-mappings", async (_, platform = "tiktok", mappings = []) => {
  return {
    ok: false,
    provider: "saudiipick",
    platform,
    error: "SAUDIIPICK_ACCOUNT_MAPPING_REQUIRED",
    mappingCount: Array.isArray(mappings) ? mappings.length : 0
  };
});

ipcMain.handle("sync-marketing-data", async (_, accountId, platform = "tiktok", range = {}) => {
  try {
    return await callSaudiIPickMarketing("sync", accountId, platform, range || {});
  } catch (error) {
    log.error("[SaudiIPick][Marketing] compatibility sync failed", { accountId, platform, error: error.message });
    return { ok: false, provider: "saudiipick", platform, error: error.message };
  }
});

ipcMain.handle("sync-all-marketing-data", async (_, platform = "tiktok", range = {}) => {
  const accountSettings = normalizeMarketingAccountSettings(range && range.accountSettings);
  const accountIds = accountSettings.map((setting) => setting.dashboardAccountId).filter(Boolean);
  if (!accountIds.length) return { ok: false, provider: "saudiipick", platform, error: "SAUDIIPICK_ACCOUNT_REQUIRED" };
  try {
    const accountStatuses = {};
    for (const accountId of accountIds) {
      accountStatuses[accountId] = await callSaudiIPickMarketing("sync", accountId, platform, range || {});
    }
    const failed = Object.values(accountStatuses).filter((result) => !result || !result.ok);
    return {
      ok: failed.length === 0,
      provider: "saudiipick",
      platform,
      accountStatuses,
      error: failed.length ? failed.map((result) => result && result.error || "SYNC_FAILED").join("; ") : ""
    };
  } catch (error) {
    log.error("[SaudiIPick][Marketing] compatibility sync all failed", { platform, error: error.message });
    return { ok: false, provider: "saudiipick", platform, error: error.message };
  }
});

ipcMain.handle("get-saudiipick-marketing-token-status", async () => {
  const token = getSaudiIPickDesktopToken();
  return {
    ok: true,
    configured: !!token,
    tokenPreview: maskToken(token),
    connectUrl: `${SAUDIIPICK_MARKETING_API_BASE}/dashboard/settings`,
  };
});

ipcMain.handle("save-saudiipick-marketing-token", async (_, token) => {
  const clean = String(token || "").trim();
  if (!clean || !clean.startsWith("sipdt_")) {
    log.warn("[SaudiIPick][Marketing] rejected invalid desktop token", { hasToken: !!clean, tokenPreview: maskToken(clean) });
    return { ok: false, error: "INVALID_SAUDIIPICK_TOKEN" };
  }
  dashboardStore.set("saudiIPickMarketing.desktopToken", clean);
  log.info("[SaudiIPick][Marketing] desktop token saved", { tokenPreview: maskToken(clean) });
  return { ok: true, configured: true, tokenPreview: maskToken(clean) };
});

ipcMain.handle("clear-saudiipick-marketing-token", async () => {
  dashboardStore.delete("saudiIPickMarketing.desktopToken");
  return { ok: true, configured: false };
});

ipcMain.handle("get-saudiipick-marketing-status", async (_, accountId, platform = "snapchat", options = {}) => {
  const dashboardAccountId = marketingAccountKey(accountId, true);
  if (!dashboardAccountId) return { ok: false, error: "SELECT_ACCOUNT" };
  const cached = getCachedSaudiIPickMarketingStatus(dashboardAccountId, platform);
  if (cached && options && options.mode === "cached") {
    return { ok: true, ...cached, provider: cached.provider || "saudiipick", cache: { ...(cached.cache || {}), status: "local", providerRequestCount: 0 } };
  }
  try {
    const result = await callSaudiIPickMarketing("status", dashboardAccountId, platform, options || {});
    if (result && result.ok) {
      const nextCached = getCachedSaudiIPickMarketingStatus(dashboardAccountId, platform) || {};
      return {
        ...result,
        ...nextCached,
        ok: true,
        provider: "saudiipick",
        availableAccounts: result.availableAccounts || nextCached.availableAccounts || [],
        linkedAccounts: result.linkedAccounts || nextCached.linkedAccounts || [],
      };
    }
    return cached ? { ok: true, ...cached, offline: true, error: result && result.error || "" } : result;
  } catch (error) {
    log.error("[SaudiIPick][Marketing] status failed", { accountId: dashboardAccountId, platform, error: error.message });
    if (cached) return { ok: true, ...cached, offline: true, error: error.message };
    return { ok: false, provider: "saudiipick", platform, error: error.message };
  }
});

ipcMain.handle("save-saudiipick-marketing-mapping", async (_, accountId, platform = "snapchat", sourceAccounts = []) => {
  return await saveSaudiIPickMarketingMappingState(accountId, platform, sourceAccounts);
});

ipcMain.handle("sync-saudiipick-marketing-data", async (_, accountId, platform = "snapchat", range = {}) => {
  const dashboardAccountId = marketingAccountKey(accountId);
  if (!dashboardAccountId) return { ok: false, error: "SELECT_SINGLE_ACCOUNT" };
  try {
    const previous = getCachedSaudiIPickMarketingStatus(dashboardAccountId, platform) || {};
    const dashboardAccountKey = marketingStableAccountKey(dashboardAccountId);
    let sourceAccounts = Array.isArray(range && range.sourceAccounts) && range.sourceAccounts.length
      ? range.sourceAccounts
      : previous.selectedSourceAccounts || previous.mappedAccounts || [];
    if (!sourceAccounts.length && previous.mappings && typeof previous.mappings === "object") {
      sourceAccounts = previous.mappings[dashboardAccountId] || previous.mappings[dashboardAccountKey] || [];
    }
    const result = await callSaudiIPickMarketing("sync", dashboardAccountId, platform, {
      ...(range || {}),
      sourceAccounts,
    });
    return result;
  } catch (error) {
    log.error("[SaudiIPick][Marketing] sync failed", { accountId: dashboardAccountId, platform, error: error.message });
    const cached = getCachedSaudiIPickMarketingStatus(dashboardAccountId, platform);
    if (cached) return { ok: false, ...cached, provider: "saudiipick", error: error.message };
    return { ok: false, provider: "saudiipick", platform, error: error.message };
  }
});



function stableMarketingValue(value) {
  if (Array.isArray(value)) return value.map(stableMarketingValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stableMarketingValue(value[key]);
    return out;
  }, {});
}

function marketingRevisionValue(status) {
  const mappings = status && status.mappings && typeof status.mappings === "object" ? status.mappings : {};
  return JSON.stringify(stableMarketingValue({
    status: status && status.status || "disconnected",
    summary: status && status.summary || null,
    sourceAccountId: status && status.sourceAccountId || "",
    linkedAccounts: status && status.linkedAccounts || [],
    mappedAccounts: status && status.mappedAccounts || [],
    availableAccounts: status && status.availableAccounts || [],
    mappings,
    reconnectRequired: !!(status && status.reconnectRequired),
  }));
}

function hasMarketingConnectionPayload(status) {
  return !!(status && (
    status.summary ||
    (Array.isArray(status.linkedAccounts) && status.linkedAccounts.length) ||
    (Array.isArray(status.mappedAccounts) && status.mappedAccounts.length) ||
    (Array.isArray(status.availableAccounts) && status.availableAccounts.length) ||
    (status.mappings && typeof status.mappings === "object" && Object.keys(status.mappings).length)
  ));
}

function isPendingMarketingStatus(status) {
  const state = String(status && status.status || "").toLowerCase();
  return !!(status && (state === "pending" || status.authorizationUrl || status.awaitingAuthorization));
}

function saveCachedMarketingStatus(accountId, platform, status) {
  if (!accountId || !status) return;
  const accounts = dashboardStore.get("accounts", {});
  if (!accounts[accountId]) accounts[accountId] = {};
  if (!accounts[accountId].marketing) accounts[accountId].marketing = {};
  const previous = accounts[accountId].marketing[platform] || null;
  const preservePreviousPayload = hasMarketingConnectionPayload(previous) &&
    isPendingMarketingStatus(status) &&
    !hasMarketingConnectionPayload(status);
  const next = {
    platform,
    status: status.status || (isPendingMarketingStatus(status) ? "pending" : "disconnected"),
    statusCheckedAt: status.statusCheckedAt || previous && previous.statusCheckedAt || null,
    lastSyncAt: preservePreviousPayload ? previous.lastSyncAt || null : status.lastSyncAt || null,
    summary: preservePreviousPayload ? previous.summary || null : status.summary || null,
    sourceAccountName: status.sourceAccountName || preservePreviousPayload && previous.sourceAccountName || "",
    sourceAccountId: status.sourceAccountId || preservePreviousPayload && previous.sourceAccountId || "",
    linkedAccounts: preservePreviousPayload ? previous.linkedAccounts || [] : Array.isArray(status.linkedAccounts) ? status.linkedAccounts : [],
    mappedAccounts: preservePreviousPayload ? previous.mappedAccounts || [] : Array.isArray(status.mappedAccounts) ? status.mappedAccounts : [],
    availableAccounts: preservePreviousPayload ? previous.availableAccounts || [] : Array.isArray(status.availableAccounts) ? status.availableAccounts : [],
    diagnostics: status.diagnostics || null,
    reconnectRequired: !!status.reconnectRequired,
    error: status.error || "",
    limit: status.limit || null,
    limits: status.limits || null,
    mappings: preservePreviousPayload ? previous.mappings || {} : status.mappings || {},
    cache: status.cache || null,
    stale: !!status.stale,
  };
  accounts[accountId].marketing[platform] = next;
  dashboardStore.set("accounts", accounts);
  const changed = marketingRevisionValue(previous) !== marketingRevisionValue(next);
  if (changed) bumpDashboardMarketingRevision();
  return changed;
}

function saveCachedAllMarketingMappingStatus(platform, result, options = {}) {
  if (!result || !result.ok) return;
  saveCachedMarketingStatus("__all__", platform, result);
  const mappings = result.mappings && typeof result.mappings === "object" ? result.mappings : {};
  const knownAccounts = mergeMarketingSourceAccounts(result.availableAccounts, result.linkedAccounts, result.mappedAccounts);
  const settings = normalizeMarketingAccountSettings([]);
  settings.forEach((setting) => {
    const sourceAccounts = mappedMarketingSourcesForKeys(mappings, [
      setting.dashboardAccountId,
      setting.dashboardAccountKey,
      ...(Array.isArray(setting.dashboardAccountKeys) ? setting.dashboardAccountKeys : []),
    ]);
    const previous = getCachedMarketingStatus(setting.dashboardAccountId, platform);
    const sameSources = marketingSourceAccountSignature(previous && previous.mappedAccounts) === marketingSourceAccountSignature(sourceAccounts);
    const preserveSummary = !!options.preserveExistingSummary && sameSources && sourceAccounts.length > 0;
    saveCachedMarketingStatus(setting.dashboardAccountId, platform, {
      platform,
      status: sourceAccounts.length ? "connected" : "disconnected",
      linkedAccounts: sourceAccounts,
      mappedAccounts: sourceAccounts,
      availableAccounts: sourceAccounts.length ? [] : knownAccounts,
      mappings,
      limit: result.limits && result.limits[setting.dashboardAccountId] || null,
      summary: preserveSummary ? previous && previous.summary || null : null,
      lastSyncAt: preserveSummary ? previous && previous.lastSyncAt || null : null,
      statusCheckedAt: result.statusCheckedAt || null,
      cache: result.cache || null,
    });
  });
}

async function callMarketingBackend(action, accountId, platform, range) {
  const dashboardAccountId = marketingAccountKey(accountId, action !== "sync");
  if (!dashboardAccountId) return { ok: false, error: "SELECT_SINGLE_ACCOUNT" };
  if (!["tiktok", "snapchat", "facebook"].includes(platform)) return { ok: false, error: "PLATFORM_NOT_AVAILABLE" };
  if (!(await isLicenseValid())) return { ok: false, error: "LICENSE_INVALID" };

  const licenseKey = licenseStore.get("licenseKey", "");
  const account = getStoredAccountById(dashboardAccountId);
  const dashboardAccountKey = marketingStableAccountKey(dashboardAccountId);
  const clientRequestId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
  const previousStatus = getCachedMarketingStatus(dashboardAccountId, platform);
  const previousDiagnostics = previousStatus && previousStatus.diagnostics || {};
  const connectSnapshotIds = marketingStatusAccountIdSnapshot(previousStatus);
  const previousTokenFingerprint = marketingDiagnosticTokenFingerprintFromDiagnostics(previousDiagnostics);
  log.info("[Marketing][Main] request", {
    clientRequestId,
    action,
    mode: range && range.mode ? range.mode : "",
    platform,
    dashboardAccountId,
    dashboardAccountKey,
    sourceAccountId: range && range.sourceAccountId ? range.sourceAccountId : "",
    sourceAccountIds: range && Array.isArray(range.sourceAccountIds) ? range.sourceAccountIds : [],
    sourceAccounts: range && Array.isArray(range.sourceAccounts) ? range.sourceAccounts : [],
    mappings: range && Array.isArray(range.mappings) ? range.mappings : [],
    targetCurrency: range && range.targetCurrency ? range.targetCurrency : "",
    egpRate: range && range.egpRate ? range.egpRate : null,
    accountSettings: range && Array.isArray(range.accountSettings) ? range.accountSettings : [],
    dateFrom: range && range.dateFrom ? range.dateFrom : "",
    dateTo: range && range.dateTo ? range.dateTo : "",
  });
  if (action === "connect" || action === "status") {
    log.info("[Marketing][Diagnostics] before request", {
      clientRequestId,
      action,
      mode: range && range.mode ? range.mode : "",
      platform,
      dashboardAccountId,
      previousTokenFingerprint,
      connectSnapshotIds,
      mappedIds: connectSnapshotIds.mappings,
    });
  }
  const exchangeRates = normalizeMarketingExchangeRates(range && range.exchangeRates, range && range.egpRate);
  const result = await supabaseFunctionRequest("windsor-marketing", {
    clientRequestId,
    diagnosticsRequested: true,
    action,
    mode: range && range.mode ? range.mode : undefined,
    platform,
    dashboardAccountId,
    dashboardAccountKey,
    dashboardAccountLabel: accountDisplayName(account, dashboardAccountId),
    sourceAccountId: range && range.sourceAccountId ? range.sourceAccountId : "",
    sourceAccountIds: range && Array.isArray(range.sourceAccountIds) ? range.sourceAccountIds : [],
    sourceAccounts: range && Array.isArray(range.sourceAccounts) ? range.sourceAccounts : [],
    mappings: range && Array.isArray(range.mappings) ? range.mappings : [],
    targetCurrency: range && range.targetCurrency ? range.targetCurrency : "",
    exchangeRates,
    egpRate: exchangeRates.EGP,
    accountSettings: range && Array.isArray(range.accountSettings)
      ? range.accountSettings
      : (action === "status" && dashboardAccountId === "__all__" ? normalizeMarketingAccountSettings([]) : []),
    dateFrom: range && range.dateFrom ? range.dateFrom : "",
    dateTo: range && range.dateTo ? range.dateTo : "",
    identity: {
      licenseKey,
      machineUuid: _getOrCreateMachineUUID(),
      deviceId: getDeviceFingerprint(),
      accountIdents: _buildAccountIdents(),
    },
  });
  if (result && result.diagnostics) {
    result.diagnostics = sanitizeMarketingDiagnostics(result.diagnostics);
  }
  const responseSnapshotIds = marketingStatusAccountIdSnapshot(result);
  const authorizationUrlDiagnostics = marketingDiagnosticUrlFingerprints(result && result.authorizationUrl);
  if (result && typeof result === "object") {
    result.diagnostics = {
      ...(result.diagnostics && typeof result.diagnostics === "object" ? result.diagnostics : {}),
      clientRequestId,
      previousStoredTokenFingerprint: previousTokenFingerprint,
      generatedAuthorizationUrl: authorizationUrlDiagnostics,
      connectSnapshotIdsBeforeAuth: connectSnapshotIds,
      responseAccountIds: responseSnapshotIds,
      mappedIds: responseSnapshotIds.mappings,
    };
  }
  if (action === "connect" || action === "status") {
    log.info("[Marketing][Diagnostics] after response", {
      clientRequestId,
      action,
      mode: range && range.mode ? range.mode : "",
      platform,
      dashboardAccountId,
      previousTokenFingerprint,
      generatedAuthorizationUrl: authorizationUrlDiagnostics,
      connectSnapshotIdsBeforeAuth: connectSnapshotIds,
      responseAccountIds: responseSnapshotIds,
      mappedIds: responseSnapshotIds.mappings,
      backendDiagnostics: marketingResultLogSummary(result).diagnostics,
    });
  }
  log.info("[Marketing][Main] response", {
    clientRequestId,
    action,
    ...marketingResultLogSummary(result),
  });
  return result;
}

function shouldRetryMarketingSync(result) {
  if (!result || typeof result !== "object") return true;
  if (result.ok || result.reconnectRequired) return false;
  const code = String(result.error || result.errorCode || "").toUpperCase();
  return !/(AUTH|RECONNECT|UNAUTHORIZED|FORBIDDEN|ACCESS_TOKEN|TOKEN_EXPIRED|HTTP_?40[13]|LICENSE|MAP_|MAPPING|CURRENCY_REQUIRED|DATE_RANGE|SELECT_|PLATFORM_NOT_AVAILABLE)/.test(code);
}

async function callMarketingBackendWithRetry(action, accountId, platform, range) {
  let first;
  try {
    first = await callMarketingBackend(action, accountId, platform, range);
  } catch (error) {
    first = { ok: false, error: error && error.message || String(error) };
  }
  if (!shouldRetryMarketingSync(first)) return first;
  log.warn("[Marketing][Main] retrying transient sync failure", { action, accountId, platform, error: first && first.error || "" });
  return callMarketingBackend(action, accountId, platform, range);
}

ipcMain.handle("open-external-url", async (_, externalUrl) => {
  try {
    const parsed = new URL(String(externalUrl || ""));
    const allowedHosts = new Set(["onboard.windsor.ai", "saudiipick.com", "www.saudiipick.com", "wa.me", "api.whatsapp.com", "web.whatsapp.com"]);
    if (parsed.protocol !== "https:" || !allowedHosts.has(parsed.hostname)) {
      return { ok: false, error: "URL_NOT_ALLOWED" };
    }
    await shell.openExternal(parsed.toString());
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("get-ai-assistant-memory", async () => {
  try {
    const saved = dashboardStore.get("aiAssistantState.v1", null);
    return { ok: true, memory: saved ? sanitizeAiAssistantMemory(saved) : defaultAiAssistantMemory() };
  } catch (err) {
    monitoring.captureException(err, { operation: "dashboard.getAiAssistantMemory" });
    return { ok: false, memory: defaultAiAssistantMemory(), error: err.message };
  }
});

ipcMain.handle("save-ai-assistant-memory", async (_, delta) => {
  try {
    const saved = dashboardStore.get("aiAssistantState.v1", null);
    const next = mergeAiAssistantMemory(saved || defaultAiAssistantMemory(), delta || {});
    dashboardStore.set("aiAssistantState.v1", next);
    return { ok: true, memory: next };
  } catch (err) {
    monitoring.captureException(err, { operation: "dashboard.saveAiAssistantMemory" });
    return { ok: false, memory: defaultAiAssistantMemory(), error: err.message };
  }
});

ipcMain.handle("clear-ai-assistant-memory", async (_, scope) => {
  try {
    const cleanScope = String(scope || "all").toLowerCase();
    if (cleanScope === "all") {
      const empty = defaultAiAssistantMemory();
      dashboardStore.set("aiAssistantState.v1", empty);
      return { ok: true, memory: empty };
    }
    const saved = dashboardStore.get("aiAssistantState.v1", null);
    const next = sanitizeAiAssistantMemory(saved || defaultAiAssistantMemory());
    if (cleanScope === "workflow") next.activeWorkflow = null;
    if (cleanScope === "diagnosis") next.lastDiagnosis = null;
    if (cleanScope === "inputs") next.knownInputs = defaultAiAssistantMemory().knownInputs;
    next.updatedAt = new Date().toISOString();
    dashboardStore.set("aiAssistantState.v1", next);
    return { ok: true, memory: next };
  } catch (err) {
    monitoring.captureException(err, { operation: "dashboard.clearAiAssistantMemory" });
    return { ok: false, memory: defaultAiAssistantMemory(), error: err.message };
  }
});

function sanitizeDashboardAiMirror(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const pick = (obj, keys) => {
    const out = {};
    keys.forEach((key) => {
      if (obj && Object.prototype.hasOwnProperty.call(obj, key)) out[key] = obj[key];
    });
    return out;
  };
  const limitRows = (rows, limit) => (Array.isArray(rows) ? rows : [])
    .slice(0, limit)
    .map((row) => row && typeof row === "object" ? pick(row, [
      "id", "name", "sku", "city", "orders", "delivered", "ndrPct", "drPct", "cancelPct",
      "deliveredSales", "aov", "cpa", "breakEvenCpa", "netProfit", "profitLoss",
      "earnedProfitAfterTax", "earnedCommission", "riskScore", "scalingScore",
      "scaleScore", "decision", "nextAction", "matchedProduct", "objective", "status",
      "spend", "currency", "deliveredCpa", "roi", "action"
    ]) : null)
    .filter(Boolean);
  const mirrorKey = String(value.mirrorKey || "").slice(0, 500);
  if (!mirrorKey) return null;
  return {
    version: Number(value.version || 1),
    mirrorKey,
    builtAt: String(value.builtAt || new Date().toISOString()).slice(0, 80),
    freshness: String(value.freshness || "persisted").slice(0, 40),
    accountSummary: value.accountSummary && typeof value.accountSummary === "object" ? pick(value.accountSummary, [
      "activeAccountId", "activeAccountLabel", "periodLabel", "deliveredDateMode",
      "totalOrders", "delivered", "ndrPct", "drPct", "cpa", "spend", "deliveredSales",
      "aov", "earnedProfitAfterTax", "lostProfitAfterTax", "netProfit", "breakEvenCpa",
      "currency", "healthLevel", "growthLevel"
    ]) : {},
    productScorecards: limitRows(value.productScorecards, 40),
    cityScorecards: limitRows(value.cityScorecards, 40),
    campaignScorecards: limitRows(value.campaignScorecards, 25),
    rankings: value.rankings && typeof value.rankings === "object" ? value.rankings : {},
    decisions: value.decisions && typeof value.decisions === "object" ? value.decisions : {},
    planInputs: value.planInputs && typeof value.planInputs === "object" ? value.planInputs : {},
    diagnostics: value.diagnostics && typeof value.diagnostics === "object" ? value.diagnostics : {},
  };
}

function readDashboardAiMirrorStore() {
  const saved = dashboardStore.get(AI_MIRROR_STORE_KEY, null);
  const items = saved && saved.items && typeof saved.items === "object" ? saved.items : {};
  const order = Array.isArray(saved && saved.order) ? saved.order.map((key) => String(key || "")).filter(Boolean) : Object.keys(items);
  const migrated = dashboardStore.get("aiMirror.v1", null);
  if (migrated && migrated.mirrorKey && !items[migrated.mirrorKey]) {
    const mirror = sanitizeDashboardAiMirror(migrated);
    if (mirror) {
      items[mirror.mirrorKey] = mirror;
      order.unshift(mirror.mirrorKey);
    }
  }
  const cleanOrder = [];
  order.forEach((key) => {
    if (items[key] && cleanOrder.indexOf(key) === -1) cleanOrder.push(key);
  });
  Object.keys(items).forEach((key) => {
    if (cleanOrder.indexOf(key) === -1) cleanOrder.push(key);
  });
  while (cleanOrder.length > AI_MIRROR_STORE_LIMIT) {
    const oldKey = cleanOrder.pop();
    delete items[oldKey];
  }
  return { version: 1, items, order: cleanOrder };
}

function writeDashboardAiMirrorStore(next) {
  const items = next && next.items && typeof next.items === "object" ? next.items : {};
  const order = Array.isArray(next && next.order) ? next.order : Object.keys(items);
  dashboardStore.set(AI_MIRROR_STORE_KEY, {
    version: 1,
    savedAt: new Date().toISOString(),
    items,
    order: order.slice(0, AI_MIRROR_STORE_LIMIT),
  });
}

ipcMain.handle("get-dashboard-ai-mirror", async (_, mirrorKey) => {
  const key = String(mirrorKey || "");
  const cache = readDashboardAiMirrorStore();
  const saved = cache.items[key] || null;
  if (!saved || saved.mirrorKey !== key) return null;
  cache.order = [key].concat(cache.order.filter((item) => item !== key));
  writeDashboardAiMirrorStore(cache);
  return { ok: true, mirror: saved };
});

ipcMain.handle("save-dashboard-ai-mirror", async (_, payload) => {
  const mirror = sanitizeDashboardAiMirror(payload && payload.mirror || payload);
  if (!mirror) return { ok: false, error: "invalid_mirror" };
  const cache = readDashboardAiMirrorStore();
  mirror.savedAt = new Date().toISOString();
  cache.items[mirror.mirrorKey] = mirror;
  cache.order = [mirror.mirrorKey].concat(cache.order.filter((key) => key !== mirror.mirrorKey));
  while (cache.order.length > AI_MIRROR_STORE_LIMIT) {
    const oldKey = cache.order.pop();
    delete cache.items[oldKey];
  }
  writeDashboardAiMirrorStore(cache);
  return { ok: true, mirrorKey: mirror.mirrorKey, builtAt: mirror.builtAt };
});

ipcMain.handle("dashboard-ai-query", async (event, payload) => {
  const _aiRequestStartedAt = Date.now();
  const _aiRequestId = payload && payload.requestId ? String(payload.requestId).slice(0, 120) : "";
  const emitAiProgress = (done, error) => {
    if (!_aiRequestId || !event || !event.sender || event.sender.isDestroyed()) return;
    event.sender.send("dashboard-ai-progress", {
      requestId: _aiRequestId,
      done: !!done,
      error: !!error,
    });
  };
  // [KHOD WHAAT Bot DEBUG] ---------------------------------------------
  const _cmd = payload && payload.command ? String(payload.command).slice(0, 80) : "(no command)";
  const _ctxBytes = payload && payload.context ? Buffer.byteLength(JSON.stringify(payload.context), "utf8") : 0;
  log.info("[KhodAI] gateway state:", getAiGatewayState());
  const _ctxKB    = (_ctxBytes / 1024).toFixed(1);
  log.info("[KhodAI-Debug] dashboard-ai-query → command:", _cmd);
  log.info("[KhodAI-Debug] context payload size:", _ctxKB + " KB (" + _ctxBytes + " bytes)");
  if (_ctxBytes > 150000) {
    log.warn("[KhodAI-Debug] ⚠️  Context is VERY LARGE (" + _ctxKB + " KB) — likely to hit Gemini input token limit!");
  }
  // ─────────────────────────────────────────────────────────────────
  try {
    const validation = validateDashboardAiPayload(payload || {});
    if (!validation.ok) {
      emitAiProgress(true, false);
      return {
        message: validation.message || "Invalid AI request.",
        insights: [],
        recommendations: [],
        forecasts: [],
        alerts: [],
        actions: [],
        meta: { source: "local-guard", blocked: true, code: validation.code, mainProcessDurationMs: Date.now() - _aiRequestStartedAt },
      };
    }
    const _result = await askDashboardAi(payload || {}, {
      onProgress: () => emitAiProgress(false, false),
    });
    emitAiProgress(true, false);
    if (_result && typeof _result === "object") {
      _result.meta = Object.assign({}, _result.meta || {}, {
        mainProcessDurationMs: Date.now() - _aiRequestStartedAt
      });
    }
    // [KHOD WHAAT Bot DEBUG]
    log.info("[KhodAI-Debug] AI response message:", _result && _result.message ? _result.message.slice(0, 120) : "(empty)");
    log.info("[KhodAI-Debug] AI insights count:", _result && _result.insights ? _result.insights.length : 0);
    if (_result && _result.insights && _result.insights.length > 0) {
      log.info("[KhodAI-Debug] First insight:", JSON.stringify(_result.insights[0]).slice(0, 200));
    }
    return _result;
  } catch (err) {
    emitAiProgress(true, true);
    log.error("[KhodAI-Debug] dashboard-ai-query THREW unexpectedly:", err && err.message ? err.message : String(err));
    monitoring.captureException(err, { operation: "dashboard.aiQuery", extra: { command: _cmd, contextBytes: _ctxBytes } });
    return {
      message: "AI service failed.",
      insights: [err && err.message ? err.message : String(err)],
      actions: [],
      meta: { source: "fallback", error: true, mainProcessDurationMs: Date.now() - _aiRequestStartedAt },
    };
  }
});

ipcMain.handle("get-ai-admin-analytics", async () => {
  return getAiAdminAnalytics();
});

ipcMain.handle("debug-gemini-ping", async () => {
  return debugGeminiPing();
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
ipcMain.handle("bulk-orders:is-configured", async () => {
  const key = licenseStore.get("licenseKey", "");
  if (!key) return { success: false, configured: false, error: "LICENSE_MISSING" };
  const license = await _checkLicenseImpl(true);
  if (!license || !license.valid) return { success: false, configured: false, error: "LICENSE_INVALID" };
  return { success: true, configured: isBulkOrderAccessConfigured() };
});

ipcMain.handle("bulk-orders:verify-access", async (_, credentials = {}) => {
  const key = licenseStore.get("licenseKey", "");
  if (!key) return { success: false, error: "LICENSE_MISSING" };
  const license = await _checkLicenseImpl(true);
  if (!license || !license.valid) return { success: false, error: "LICENSE_INVALID" };
  return verifyBulkOrderAccessInput(credentials);
});

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
ipcMain.handle("approve-bot-preview", async (_, payload = {}) => {
  const message = {
    type: "approve-preview",
    rows: Array.isArray(payload.rows) ? payload.rows : [],
    accountId: String(payload.accountId || "").trim(),
  };
  let sent = 0;
  for (const child of botChildren) {
    if (child && child.connected) {
      try { child.send(message); sent++; } catch (_) {}
    }
  }
  return { ok: sent > 0, sent };
});

function waitForBotChildExit(child, timeoutMs) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener("exit", onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once("exit", onExit);
  });
}

function forceKillBotProcessTree(child) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  if (process.platform === "win32") {
    const { spawn } = require("child_process");
    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
      killer.once("error", () => {
        try { child.kill("SIGKILL"); } catch (_) {}
        resolve();
      });
      killer.once("exit", (code) => {
        if (code !== 0) {
          try { child.kill("SIGKILL"); } catch (_) {}
        }
        resolve();
      });
    });
  }
  try { child.kill("SIGKILL"); } catch (_) {}
  return Promise.resolve();
}

async function stopRunningBots() {
  botRunning = false;
  const children = Array.from(new Set([
    ...botChildren,
    ...(currentBotChild ? [currentBotChild] : []),
  ])).filter((child) => child && child.exitCode === null && child.signalCode === null);

  if (children.length === 0) {
    botChildren = [];
    currentBotChild = null;
    return { success: true, stopped: 0, forced: 0 };
  }

  for (const child of children) {
    try {
      if (child.connected) child.send({ type: "stop" });
    } catch (_) {}
  }

  const graceful = await Promise.all(children.map((child) => waitForBotChildExit(child, 4000)));
  const stuck = children.filter((_child, index) => !graceful[index]);
  await Promise.all(stuck.map(forceKillBotProcessTree));
  if (stuck.length) await Promise.all(stuck.map((child) => waitForBotChildExit(child, 2500)));

  botChildren = [];
  currentBotChild = null;
  return { success: true, stopped: children.length, forced: stuck.length };
}

ipcMain.handle("kill-bot", async () => {
  log.info("[Bot] Stop requested by user");
  const result = await stopRunningBots();
  log.info(`[Bot] Stop complete - children=${result.stopped}, forced=${result.forced}`);
  return result;
});

// Auto-save failed orders under the KHOD WHAAT application data folder.
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
    const dir = path.join(appdata, "khod-whaat-orders", "failed-orders", safeEmail);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `failed-${ts}.xlsx`);
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return { dir, filePath };
  } catch (e) {
    console.error("[saveFailedOrdersFile] error:", e.message);
    return { dir: "", filePath: "" };
  }
}

function bufferFromIpc(value) {
  if (!value) return Buffer.alloc(0);
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value));
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return Buffer.from(value);
  if (value && Array.isArray(value.data)) return Buffer.from(value.data);
  return Buffer.from(value);
}

function getRunnableAccountForBulk(accountId) {
  const allAccounts = store.get("accounts", null);
  if (Array.isArray(allAccounts) && allAccounts.length > 0) {
    const acc = allAccounts.find((account) => account.id === accountId);
    if (!acc || isStaticAccount(acc)) return null;
    return {
      ...acc,
      easyPassword: store.get(`pwd_easy_${acc.id}`, ""),
      khodPassword: store.get(`pwd_khod_${acc.id}`, ""),
      khodCountry: acc.khodCountry || "sa",
    };
  }

  if (!accountId || accountId === "legacy" || accountId === "__single__") {
    const easyEmail = store.get("easyEmail", "");
    if (!easyEmail) return null;
    return {
      id: "legacy",
      label: "Account 1",
      easyEmail,
      easyPassword: store.get("easyPassword", ""),
      easyStore: store.get("easyStore", ""),
      khodEmail: store.get("khodEmail", ""),
      khodPassword: store.get("khodPassword", ""),
      khodCountry: store.get("khodCountry", "sa"),
      khodAffiliateCode: store.get("khodAffiliateCode", ""),
    };
  }

  return null;
}

ipcMain.handle("bulk-orders:get-sample", async () => {
  const buffer = buildBulkOrderSampleWorkbook();
  return {
    success: true,
    filename: "bulk-orders-sample.xlsx",
    buffer: Array.from(buffer),
    previewRows: samplePreviewRows(),
  };
});

function filesFromRecoveryPayload(payload = {}) {
  return (Array.isArray(payload.files) ? payload.files : []).map((file, index) => ({
    name: file.name || file.filename || `sheet-${index + 1}.xlsx`,
    buffer: bufferFromIpc(file.buffer),
  })).filter((file) => file.buffer && file.buffer.length > 0);
}

function dashboardRowsForBulkCatalog(accountId) {
  const accounts = dashboardStore.get("accounts", {}) || {};
  const wanted = String(accountId || "").trim();
  const direct = wanted && accounts[wanted] && Array.isArray(accounts[wanted].snapshot)
    ? accounts[wanted].snapshot
    : null;
  if (direct) return direct;
  if ((wanted === "legacy" || wanted === "__single__") && accounts.__single__ && Array.isArray(accounts.__single__.snapshot)) {
    return accounts.__single__.snapshot;
  }
  const allRows = [];
  Object.values(accounts).forEach((entry) => {
    if (entry && Array.isArray(entry.snapshot)) allRows.push(...entry.snapshot);
  });
  return allRows;
}

function dashboardEntryForBulkAccount(accountId) {
  const accounts = dashboardStore.get("accounts", {}) || {};
  const wanted = String(accountId || "").trim();
  if (wanted && accounts[wanted]) return accounts[wanted];
  if ((wanted === "legacy" || wanted === "__single__") && accounts.__single__) return accounts.__single__;
  return null;
}

function dashboardRowsForBulkRange(accountId, dateFrom, dateTo) {
  const from = normalizeDashboardDateKey(dateFrom);
  const to = normalizeDashboardDateKey(dateTo);
  return dashboardRowsForBulkCatalog(accountId).filter((row) => {
    if (!from || !to) return true;
    const date = dashboardRowDateKey(row);
    return date && date >= from && date <= to;
  });
}

function bulkRecoveryKhodValidation(accountId, dateFrom, dateTo, country = "sa") {
  const from = normalizeDashboardDateKey(dateFrom);
  const to = normalizeDashboardDateKey(dateTo);
  const entry = dashboardEntryForBulkAccount(accountId);
  const last = entry && entry.lastFetchRange || {};
  const fetchedRange = Boolean(
    from &&
    to &&
    String(last.dateFrom || "") === from &&
    String(last.dateTo || "") === to
  );
  const rows = dashboardRowsForBulkRange(accountId, from, to);
  const phones = new Set();
  rows.forEach((row) => {
    const raw = row && (row.phone || row.phone1 || row.phone2 || row.rawPhone || row.normPhone || row.customerPhone || row.phoneNumber);
    const phone = normalizePhone(raw, country);
    if (phone) phones.add(phone);
  });
  return {
    dateFrom: from,
    dateTo: to,
    fetchedRange,
    needsFetch: !fetchedRange,
    rows: rows.length,
    phones: phones.size,
    phoneSet: phones,
    lastFetchRange: last && {
      dateFrom: last.dateFrom || "",
      dateTo: last.dateTo || "",
      rows: last.rows || 0,
      savedRowsInRange: last.savedRowsInRange || 0,
    },
  };
}

function filterRecoveryCustomersByKhodPhones(inspection = {}, validation = {}) {
  const used = validation.phoneSet instanceof Set ? validation.phoneSet : new Set();
  const customers = Array.isArray(inspection.customers) ? inspection.customers : [];
  const khodValidation = {
    dateFrom: validation.dateFrom || "",
    dateTo: validation.dateTo || "",
    fetchedRange: !!validation.fetchedRange,
    needsFetch: !!validation.needsFetch,
    rows: Number(validation.rows || 0),
    phones: Number(validation.phones || 0),
    lastFetchRange: validation.lastFetchRange || null,
  };

  if (!used.size || !customers.length) {
    return {
      ...inspection,
      khodPhonesSkipped: 0,
      khodValidation,
    };
  }

  const available = [];
  let khodPhonesSkipped = 0;
  customers.forEach((customer) => {
    const phone = String(customer && customer.normPhone || "").trim();
    if (phone && used.has(phone)) {
      khodPhonesSkipped++;
      return;
    }
    available.push(customer);
  });

  return {
    ...inspection,
    customers: available,
    previewCustomers: available.slice(0, 60),
    uniqueCustomers: available.length,
    availableCustomers: available.length,
    khodPhonesSkipped,
    khodValidation,
  };
}

function recoveryProductCatalogResult(accountId, query = "", dateFrom = "", dateTo = "") {
  const validation = bulkRecoveryKhodValidation(accountId, dateFrom, dateTo);
  const rows = dateFrom || dateTo ? dashboardRowsForBulkRange(accountId, dateFrom, dateTo) : dashboardRowsForBulkCatalog(accountId);
  const products = buildRecoveryProductCatalogFromRows(rows, { query }).slice(0, 500);
  return {
    success: true,
    products,
    rows: rows.length,
    total: products.length,
    needsFetch: validation.needsFetch || rows.length === 0 || products.length === 0,
    khodValidation: {
      dateFrom: validation.dateFrom,
      dateTo: validation.dateTo,
      fetchedRange: validation.fetchedRange,
      needsFetch: validation.needsFetch,
      rows: validation.rows,
      phones: validation.phones,
      lastFetchRange: validation.lastFetchRange,
    },
  };
}

function inspectRecoveryPayload(payload = {}) {
  const files = filesFromRecoveryPayload(payload);
  const account = getRunnableAccountForBulk(payload.accountId);
  const country = String(payload.country || account?.khodCountry || "sa").trim().toLowerCase();
  if (!files.length) {
    return {
      success: false,
      error: "Upload at least one sheet.",
      totalFiles: 0,
      customers: [],
      previewCustomers: [],
      errors: [{ row: 0, field: "files", message: "Upload at least one sheet." }],
      warnings: [],
    };
  }
  const inspection = parseRecoveryCustomersFromWorkbooks(files, {
    country,
    columns: payload.columns || {},
    mode: payload.mode || "canceled",
  });
  const validation = bulkRecoveryKhodValidation(payload.accountId, payload.dateFrom, payload.dateTo, country);
  return filterRecoveryCustomersByKhodPhones(inspection, validation);
}

function selectedRecoveryProducts(payload = {}) {
  const products = Array.isArray(payload.products) ? payload.products : [];
  return products.map((product) => ({
    key: String(product.key || product.sku || "").trim(),
    sku: String(product.sku || product.key || "").trim(),
    productName: String(product.productName || product.name || product.sku || "").trim(),
    name: String(product.name || product.productName || product.sku || "").trim(),
    qty: Math.max(1, Math.round(Number(product.qty) || 1)),
    subtotal: Math.round(Number(product.subtotal) || 0),
    unitPrice: Math.round(Number(product.unitPrice) || 0),
  })).filter((product) => product.sku && product.subtotal > 0);
}

function buildRecoveryOrdersFromPayload(payload = {}) {
  const inspection = inspectRecoveryPayload(payload);
  if (!inspection.success) {
    const message = inspection.errors && inspection.errors[0] && inspection.errors[0].message;
    throw new Error(message || inspection.error || "Recovery sheets could not be parsed.");
  }
  if (inspection.khodValidation && inspection.khodValidation.needsFetch) {
    throw new Error(`Fetch KHOD validation for ${inspection.khodValidation.dateFrom || "selected"} to ${inspection.khodValidation.dateTo || "selected"} before preview/run.`);
  }
  const products = selectedRecoveryProducts(payload);
  const count = Math.max(0, Math.round(Number(payload.count) || 0));
  const orders = buildRecoveryOrders(inspection.customers, products, {
    count,
    seed: payload.seed || Date.now(),
  });
  return { inspection, orders };
}

ipcMain.handle("bulk-orders:inspect-recovery", async (_, payload = {}) => {
  try {
    return inspectRecoveryPayload(payload);
  } catch (error) {
    return { success: false, error: error.message, customers: [], previewCustomers: [], errors: [{ row: 0, field: "sheet", message: error.message }], warnings: [] };
  }
});

ipcMain.handle("bulk-orders:get-recovery-products", async (_, payload = {}) => {
  try {
    return recoveryProductCatalogResult(payload.accountId, payload.query || "", payload.dateFrom || "", payload.dateTo || "");
  } catch (error) {
    return { success: false, error: error.message, products: [], rows: 0, total: 0, needsFetch: true };
  }
});

ipcMain.handle("bulk-orders:preview-recovery", async (_, payload = {}) => {
  try {
    const { inspection, orders } = buildRecoveryOrdersFromPayload(payload);
    return {
      success: true,
      inspection,
      total: orders.length,
      previewRows: previewRecoveryOrders(orders),
    };
  } catch (error) {
    return { success: false, error: error.message, total: 0, previewRows: [] };
  }
});

ipcMain.handle("bulk-orders:inspect-sheet", async (_, payload = {}) => {
  const account = getRunnableAccountForBulk(payload.accountId);
  const country = String(payload.country || account?.khodCountry || "sa").trim().toLowerCase();
  const parsed = parseBulkOrderWorkbook(bufferFromIpc(payload.buffer), { country });
  return {
    success: parsed.errors.length === 0,
    total: parsed.orders.length,
    previewRows: previewBulkOrders(parsed.orders),
    errors: parsed.errors,
    warnings: parsed.warnings,
    country,
  };
});

ipcMain.handle("bulk-orders:run-recovery", async (_, payload = {}) => {
  if (!(await isLicenseValid())) return { success: false, error: "LICENSE_INVALID" };
  if (licenseStore.get("teamLeaderEnabled", false) === true) {
    return { success: false, error: "TEAM_LEADER_DASHBOARD_ONLY" };
  }
  if (botRunning) return { success: false, error: "BOT_ALREADY_RUNNING" };

  const acc = getRunnableAccountForBulk(payload.accountId);
  if (!acc) return { success: false, error: "Select a runnable EasyOrders account." };
  if (!String(acc.easyEmail || "").trim() || !String(acc.easyPassword || "").trim()) {
    return { success: false, error: `EasyOrders credentials missing for ${accountDisplayName(acc, acc.id || "Account")}.` };
  }

  let built;
  try {
    built = buildRecoveryOrdersFromPayload(payload);
  } catch (error) {
    return { success: false, error: error.message };
  }
  const parsed = { orders: built.orders, warnings: built.inspection.warnings || [] };
  if (!parsed.orders.length) return { success: false, error: "No recovery orders were generated." };

  botRunning = true;
  botChildren = [];
  currentBotChild = null;

  const profilePath = path.join(app.getPath("userData"), `bot-profile-${acc.id || "legacy"}`);
  if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });

  const runDateFrom = built.inspection?.khodValidation?.dateFrom || payload.dateFrom || todayStr();
  const runDateTo = built.inspection?.khodValidation?.dateTo || payload.dateTo || runDateFrom;
  const creds = {
    ...acc,
    profilePath,
    dateFrom: runDateFrom,
    dateTo: runDateTo,
    launchMinimized: store.get("launchMinimized", false),
    chromePath: getCachedChromePath() || undefined,
    bulkOrderMode: true,
    bulkRecoveryMode: true,
    bulkOrders: parsed.orders,
    bulkOrderWarnings: parsed.warnings,
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
    const logs = [];
    let resolved = false;
    let gotResultMessage = false;
    const accountId = acc.id || "__single__";
    const accountEmail = acc.easyEmail || "";
    const accountLabel = accountDisplayName(acc, "Account 1");
    const safeResolve = (value) => {
      if (resolved) return;
      resolved = true;
      botRunning = false;
      botChildren = [];
      currentBotChild = null;
      resolve(value);
    };

    child.stdout.on("data", (d) => {
      const m = d.toString().trim();
      if (m) {
        logs.push(m);
        mainWindow.webContents.send("bot-log", m);
      }
    });
    child.stderr.on("data", (d) => {
      const m = d.toString().trim();
      if (!m) return;
      mainWindow.webContents.send("bot-log", "ERR: " + m);
    });
    child.on("message", (msg) => {
      if (msg.type === "result") {
        gotResultMessage = true;
        const data = msg.data || {};
        if (data.failedOrders?.buffer && data.failedOrders.buffer.length > 0) {
          const saved = saveFailedOrdersFile(accountEmail || "unknown", data.failedOrders.buffer);
          data.failedOrders.failedDir = saved.dir;
          data.failedOrders.failedPath = saved.filePath;
        }
        data.recoveryUsedPhones = { added: 0, total: 0, source: "khod-validation" };
        mainWindow.webContents.send("bot-run-complete");
        safeResolve({
          success: true,
          bulkOrder: true,
          recoveryOrder: true,
          data,
          inspection: {
            totalCanceledRows: built.inspection.totalCanceledRows,
            uniqueCustomers: built.inspection.uniqueCustomers,
            duplicatePhones: built.inspection.duplicatePhones,
          },
          ...finishTiming(),
          accountId,
          accountEmail,
          accountLabel,
        });
      }
      if (msg.type === "error") {
        mainWindow.webContents.send("bot-run-complete");
        safeResolve({
          success: false,
          error: msg.error,
          ...finishTiming(),
          accountId,
          accountEmail,
          accountLabel,
        });
      }
      if (msg.type === "stage") {
        mainWindow.webContents.send("bot-log", `[Stage:${msg.flow || "bulk-orders"}] ${msg.stage || "unknown"} ${msg.status ? `(${msg.status})` : ""}${msg.message ? ` - ${msg.message}` : ""}`);
      }
      if (msg.type === "2fa-needed") mainWindow.webContents.send("bot-2fa-needed", msg);
      if (msg.type === "preview-ready" || msg.type === "preview") mainWindow.webContents.send("bot-preview", msg);
      if (msg.type === "order-progress") {
        mainWindow.webContents.send("bot-order-progress", {
          ...msg,
          accountId,
          accountEmail,
          accountLabel,
          accountIdx: 0,
          totalAccounts: 1,
        });
      }
      if (msg.type === "session-event") mainWindow.webContents.send("bot-session-event", msg);
    });
    child.on("error", (err) => {
      monitoring.captureException(err, { operation: "bulkOrders.recoveryChildProcess", extra: { accountId } });
      mainWindow.webContents.send("bot-run-complete");
      safeResolve({
        success: false,
        error: err.message,
        logs,
        ...finishTiming(),
        accountId,
        accountEmail,
        accountLabel,
      });
    });
    child.on("exit", (code) => {
      if (resolved || gotResultMessage) return;
      mainWindow.webContents.send("bot-run-complete");
      safeResolve({
        success: false,
        error: `Bot exited with code ${code}`,
        logs,
        ...finishTiming(),
        accountId,
        accountEmail,
        accountLabel,
      });
    });
  });
});

ipcMain.handle("bulk-orders:run", async (_, payload = {}) => {
  if (!(await isLicenseValid())) return { success: false, error: "LICENSE_INVALID" };
  if (licenseStore.get("teamLeaderEnabled", false) === true) {
    return { success: false, error: "TEAM_LEADER_DASHBOARD_ONLY" };
  }
  if (botRunning) return { success: false, error: "BOT_ALREADY_RUNNING" };

  const acc = getRunnableAccountForBulk(payload.accountId);
  if (!acc) return { success: false, error: "Select a runnable EasyOrders account." };
  if (!String(acc.easyEmail || "").trim() || !String(acc.easyPassword || "").trim()) {
    return { success: false, error: `EasyOrders credentials missing for ${accountDisplayName(acc, acc.id || "Account")}.` };
  }

  const country = String(acc.khodCountry || "sa").trim().toLowerCase();
  const parsed = parseBulkOrderWorkbook(bufferFromIpc(payload.buffer), { country });
  if (parsed.errors.length > 0 || parsed.orders.length === 0) {
    return {
      success: false,
      error: parsed.errors[0]?.message || "Sheet has no valid orders.",
      validation: {
        total: parsed.orders.length,
        previewRows: previewBulkOrders(parsed.orders),
        errors: parsed.errors,
        warnings: parsed.warnings,
      },
    };
  }

  botRunning = true;
  botChildren = [];
  currentBotChild = null;

  const profilePath = path.join(app.getPath("userData"), `bot-profile-${acc.id || "legacy"}`);
  if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });

  const creds = {
    ...acc,
    profilePath,
    launchMinimized: store.get("launchMinimized", false),
    chromePath: getCachedChromePath() || undefined,
    bulkOrderMode: true,
    bulkOrders: parsed.orders,
    bulkOrderWarnings: parsed.warnings,
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
    const logs = [];
    let resolved = false;
    let gotResultMessage = false;
    const accountId = acc.id || "__single__";
    const accountEmail = acc.easyEmail || "";
    const accountLabel = accountDisplayName(acc, "Account 1");
    const safeResolve = (value) => {
      if (resolved) return;
      resolved = true;
      botRunning = false;
      botChildren = [];
      currentBotChild = null;
      resolve(value);
    };

    child.stdout.on("data", (d) => {
      const m = d.toString().trim();
      if (m) {
        logs.push(m);
        mainWindow.webContents.send("bot-log", m);
      }
    });
    child.stderr.on("data", (d) => {
      const m = d.toString().trim();
      if (!m) return;
      mainWindow.webContents.send("bot-log", "ERR: " + m);
    });
    child.on("message", (msg) => {
      if (msg.type === "result") {
        gotResultMessage = true;
        const data = msg.data || {};
        if (data.failedOrders?.buffer && data.failedOrders.buffer.length > 0) {
          const saved = saveFailedOrdersFile(accountEmail || "unknown", data.failedOrders.buffer);
          data.failedOrders.failedDir = saved.dir;
          data.failedOrders.failedPath = saved.filePath;
        }
        mainWindow.webContents.send("bot-run-complete");
        safeResolve({
          success: true,
          bulkOrder: true,
          data,
          ...finishTiming(),
          accountId,
          accountEmail,
          accountLabel,
        });
      }
      if (msg.type === "error") {
        mainWindow.webContents.send("bot-run-complete");
        safeResolve({
          success: false,
          error: msg.error,
          ...finishTiming(),
          accountId,
          accountEmail,
          accountLabel,
        });
      }
      if (msg.type === "stage") {
        mainWindow.webContents.send("bot-log", `[Stage:${msg.flow || "bulk-orders"}] ${msg.stage || "unknown"} ${msg.status ? `(${msg.status})` : ""}${msg.message ? ` - ${msg.message}` : ""}`);
      }
      if (msg.type === "2fa-needed") mainWindow.webContents.send("bot-2fa-needed", msg);
      if (msg.type === "preview-ready" || msg.type === "preview") mainWindow.webContents.send("bot-preview", msg);
      if (msg.type === "order-progress") {
        mainWindow.webContents.send("bot-order-progress", {
          ...msg,
          accountId,
          accountEmail,
          accountLabel,
          accountIdx: 0,
          totalAccounts: 1,
        });
      }
      if (msg.type === "session-event") mainWindow.webContents.send("bot-session-event", msg);
    });
    child.on("error", (err) => {
      monitoring.captureException(err, { operation: "bulkOrders.childProcess", extra: { accountId } });
      mainWindow.webContents.send("bot-run-complete");
      safeResolve({
        success: false,
        error: err.message,
        logs,
        ...finishTiming(),
        accountId,
        accountEmail,
        accountLabel,
      });
    });
    child.on("exit", (code) => {
      if (resolved || gotResultMessage) return;
      mainWindow.webContents.send("bot-run-complete");
      safeResolve({
        success: false,
        error: code === 0 ? "Bulk order runner exited without sending a result" : "Bulk order runner exited with code " + code,
        logs,
        ...finishTiming(),
        accountId,
        accountEmail,
        accountLabel,
      });
    });
  });
});

ipcMain.handle("run-bot", async (_, { dateFrom, dateTo, accountIds, autoConfirm: requestedAutoConfirm, easyOrdersAffiliateRecoveryEnabled: requestedAffiliateRecovery, manualReviewOrders, manualReviewMode, manualReviewDestination } = {}) => {
  if (!(await isLicenseValid())) return { success: false, error: "LICENSE_INVALID" };
  if (licenseStore.get("teamLeaderEnabled", false) === true) {
    return { success: false, error: "TEAM_LEADER_DASHBOARD_ONLY" };
  }
  const operationsSuiteEnabled = isOperationsSuiteEnabled();
  const dashboardEnabled = licenseStore.get("dashboardEnabled", false) === true;
  const reportingDataEnabled = operationsSuiteEnabled || dashboardEnabled;
  const autoConfirm = requestedAutoConfirm === true || store.get("autoConfirm", false) === true;
  const easyOrdersAffiliateRecoveryEnabled = requestedAffiliateRecovery === true || store.get("easyOrdersAffiliateRecoveryEnabled", false) === true;
  botRunning = true;
  botChildren = [];
  currentBotChild = null;

  // Reset export timestamp so each run's inter-account cooldown is anchored
  // only to exports from this run.
  lastExportTimestamp = 0;
  // ── Build account list to run ──
  const allAccounts = store.get("accounts", null);
  let accountsToRun = [];

  if (allAccounts && allAccounts.length > 0) {
    // Multi-account: filter by selected ids (if provided), else run all
    const selected = Array.isArray(accountIds) && accountIds.length > 0 ? accountIds : allAccounts.map(a => a.id);
    accountsToRun = allAccounts
      .filter(a => selected.includes(a.id) && !isStaticAccount(a))
      .map(a => ({
        ...a,
        easyPassword: store.get(`pwd_easy_${a.id}`, ""),
        khodPassword: store.get(`pwd_khod_${a.id}`, ""),
        khodCountry: a.khodCountry || "sa",
      }));
  }

  // Fallback to legacy single-account
  if (accountsToRun.length === 0 && (!allAccounts || allAccounts.length === 0)) {
    accountsToRun = [{
      id: "legacy",
      label: "Account 1",
      easyEmail:    store.get("easyEmail",    ""),
      easyPassword: store.get("easyPassword", ""),
      easyStore:    store.get("easyStore",    ""),
      khodEmail:    store.get("khodEmail",    ""),
      khodPassword: store.get("khodPassword", ""),
      khodCountry:  store.get("khodCountry",  "sa"),
      khodAffiliateCode: store.get("khodAffiliateCode", ""),
    }];
  }

  if (accountsToRun.length === 0) {
    botRunning = false;
    return { success: false, error: "STATIC_ACCOUNTS_CANNOT_RUN" };
  }

  // ── Single account: original flow ──
  if (accountsToRun.length === 1) {
    const acc = accountsToRun[0];
    if (!String(acc.khodEmail || "").trim() || !String(acc.khodPassword || "").trim()) {
      const label = accountDisplayName(acc, acc.id || "Account");
      botRunning = false;
      return { success: false, error: `KHOD WHAAT credentials missing for ${label}. Re-save this account and add the KHOD WHAAT email/password.` };
    }
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
      reportingDataEnabled,
      autoConfirm,
      easyOrdersAffiliateRecoveryEnabled,
      manualReviewDestination: manualReviewDestination === "affiliate-recovery" ? "affiliate-recovery" : "cart",
      manualReviewOrders: Array.isArray(manualReviewOrders) ? manualReviewOrders : [],
      manualReviewMode: manualReviewMode === true,
      chromePath: getCachedChromePath() || undefined,
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
      const logs = []; let resolved = false; let gotResultMessage = false;
      const safeResolve = (v) => {
        if (!resolved) {
          resolved = true;
          botRunning = false;
          botChildren = [];
          currentBotChild = null;
          resolve(v);
        }
      };
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
          gotResultMessage = true;
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
        if (msg.type === "stage") {
          mainWindow.webContents.send("bot-log", `[Stage:${msg.flow || "runner"}] ${msg.stage || "unknown"} ${msg.status ? `(${msg.status})` : ""}${msg.message ? ` - ${msg.message}` : ""}`);
        }
        if (msg.type === "2fa-needed")     mainWindow.webContents.send("bot-2fa-needed");
        if (msg.type === "needs-confirm")  mainWindow.webContents.send("bot-needs-confirm");
        if (msg.type === "cooldown")       mainWindow.webContents.send("bot-cooldown", msg);
        if (msg.type === "preview-ready" || msg.type === "preview") {
          mainWindow.webContents.send("bot-preview", msg);
        }
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
        if (msg.type === "khod-restart") mainWindow.webContents.send("bot-khod-restart", msg);
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
        if (resolved || gotResultMessage) return;
        mainWindow.webContents.send("bot-run-complete");
        safeResolve({
          success: false,
          error: code === 0 ? "Bot exited without sending a result" : "Bot exited with code " + code,
          logs,
          ...finishTiming(),
          accountId: acc.id || "__single__",
          accountEmail: acc.easyEmail || "",
          accountLabel: accountDisplayName(acc, "Account 1"),
        });
      });
    });
  }

  const selectedAccounts = accountsToRun;
  const preflightResults = [];
  accountsToRun = selectedAccounts.filter((acc) => {
    if (String(acc.khodEmail || "").trim() && String(acc.khodPassword || "").trim()) return true;
    const now = Date.now();
    const label = accountDisplayName(acc, acc.id || "Account");
    preflightResults.push({
      success: false,
      error: `KHOD WHAAT credentials missing for ${label}. Re-save this account and add the KHOD WHAAT email/password.`,
      accountId: acc.id || "__single__",
      accountEmail: acc.easyEmail || "",
      accountLabel: label,
      runStartedAt: now,
      runEndedAt: now,
      runtimeMs: 0,
    });
    return false;
  });

  if (accountsToRun.length === 0) {
    botRunning = false;
    botChildren = [];
    currentBotChild = null;
    mainWindow.webContents.send("bot-run-complete");
    return { success: false, multiAccount: true, results: preflightResults };
  }

  // Multiple accounts use a fixed 6-minute start stagger; later account runs may overlap.
  mainWindow.webContents.send("bot-log",
    `🚀 تشغيل ${accountsToRun.length} حسابات بشكل تسلسلي — حساب واحد في كل مرة...`);

  const accountExportTimestamps = new Array(accountsToRun.length).fill(0);
  mainWindow.webContents.send("bot-log", "Multi-account mode: account starts use a fixed 6-minute stagger; account runs may overlap.");

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
      reportingDataEnabled,
      autoConfirm,
      easyOrdersAffiliateRecoveryEnabled,
      manualReviewDestination: manualReviewDestination === "affiliate-recovery" ? "affiliate-recovery" : "cart",
      manualReviewOrders: Array.isArray(manualReviewOrders) ? manualReviewOrders : [],
      manualReviewMode: manualReviewMode === true,
      chromePath: getCachedChromePath() || undefined,
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
      let gotResultMessage = false;
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
          gotResultMessage = true;
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
        if (msg.type === "stage") {
          mainWindow.webContents.send("bot-log", `${prefix}[Stage:${msg.flow || "runner"}] ${msg.stage || "unknown"} ${msg.status ? `(${msg.status})` : ""}${msg.message ? ` - ${msg.message}` : ""}`);
        }
        if (msg.type === "2fa-needed")     mainWindow.webContents.send("bot-2fa-needed",     tagged);
        if (msg.type === "needs-confirm")  mainWindow.webContents.send("bot-needs-confirm",  tagged);
        if (msg.type === "cooldown")       mainWindow.webContents.send("bot-cooldown",       tagged);
        if (msg.type === "preview-ready" || msg.type === "preview") {
          mainWindow.webContents.send("bot-preview", tagged);
        }
        if (msg.type === "order-progress") mainWindow.webContents.send("bot-order-progress", tagged);
        if (msg.type === "khod-restart") mainWindow.webContents.send("bot-khod-restart", tagged);
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
        if (resolved || gotResultMessage) return;
        safeResolve({
          success: false,
          error: code === 0 ? "Bot exited without sending a result" : "Bot exited with code " + code,
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

  const INTER_ACCOUNT_COOLDOWN_MS = 6 * 60 * 1000; // Fixed 6-minute start stagger after the preceding EasyOrders export signal; runs may overlap.
  const INTER_ACCOUNT_COOLDOWN_LOG_INTERVAL_MS = 60 * 1000;

  async function waitForExportCooldown(previousAccountIndex, nextAccountIndex, previousResultPromise) {
    const previousLabel = accountDisplayName(accountsToRun[previousAccountIndex], `Account ${previousAccountIndex + 1}`);
    const label = `Account ${nextAccountIndex + 1}`;
    const launchTimestamp = accountExportTimestamps[previousAccountIndex];

    if (launchTimestamp) {
      let remainingMs = Math.max(0, INTER_ACCOUNT_COOLDOWN_MS - (Date.now() - launchTimestamp));
      if (remainingMs > 0) {
        let remainingSec = Math.ceil(remainingMs / 1000);
        mainWindow.webContents.send("bot-log",
          `\n⏸️  [Account schedule] Waiting ${Math.floor(remainingSec / 60)} min ${remainingSec % 60}s before starting ${label} after ${previousLabel}...`);

        let nextLogAt = Date.now() + INTER_ACCOUNT_COOLDOWN_LOG_INTERVAL_MS;
        while (remainingMs > 0 && botRunning) {
          const elapsed = Date.now() - launchTimestamp;
          if (elapsed >= INTER_ACCOUNT_COOLDOWN_MS) break;
          const waitTime = Math.min(1000, INTER_ACCOUNT_COOLDOWN_MS - elapsed);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          remainingMs = INTER_ACCOUNT_COOLDOWN_MS - (Date.now() - launchTimestamp);

          if (!botRunning) break;
          const now = Date.now();
          if (now >= nextLogAt) {
            while (nextLogAt <= now) nextLogAt += INTER_ACCOUNT_COOLDOWN_LOG_INTERVAL_MS;
            const remSec = Math.max(0, Math.ceil(remainingMs / 1000));
            mainWindow.webContents.send("bot-log",
              `⏸️  [Account schedule] Waiting ${Math.floor(remSec / 60)} min ${remSec % 60}s before starting ${label}...`);
          }
        }
      }
      return;
    }

    mainWindow.webContents.send("bot-log",
      `\n⏳  [${label}] في انتظار تصدير الحساب السابق قبل بدء العد التنازلي...`);

    let previousFinished = false;
    previousResultPromise.finally(() => { previousFinished = true; }).catch(() => {});

    while (botRunning && !accountExportTimestamps[previousAccountIndex] && !previousFinished) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!botRunning) return;

    const exportTimestamp = accountExportTimestamps[previousAccountIndex];
    if (!exportTimestamp) {
      const previousResult = previousFinished
        ? await previousResultPromise.catch((error) => ({ error: error && error.message ? error.message : String(error) }))
        : null;
      const previousError = String(previousResult && previousResult.error || "");
      const shouldWaitAfterNoExport = previousError.includes("ERR_CONNECTION") ||
        previousError.includes("net::") ||
        previousError.toLowerCase().includes("timeout") ||
        previousError.includes("INTERNET_ISSUE");

      if (shouldWaitAfterNoExport) {
        let remainingMs = INTER_ACCOUNT_COOLDOWN_MS;
        let remainingSec = Math.ceil(remainingMs / 1000);
        mainWindow.webContents.send("bot-log",
          `\n⏸️  [تجنب حد التصدير] ${previousLabel} فشل قبل التصدير بسبب الشبكة — الانتظار ${Math.floor(remainingSec / 60)} دقيقة و ${remainingSec % 60} ثانية قبل بدء ${label}...`);

        let nextLogAt = Date.now() + INTER_ACCOUNT_COOLDOWN_LOG_INTERVAL_MS;
        while (remainingMs > 0 && botRunning) {
          const tick = Math.min(1000, remainingMs);
          await new Promise(resolve => setTimeout(resolve, tick));
          remainingMs -= tick;
          if (!botRunning) break;
          const now = Date.now();
          if (now >= nextLogAt) {
            while (nextLogAt <= now) nextLogAt += INTER_ACCOUNT_COOLDOWN_LOG_INTERVAL_MS;
            const remSec = Math.ceil(remainingMs / 1000);
            mainWindow.webContents.send("bot-log",
              `⏸️  [تجنب حد التصدير] الانتظار لمدة ${Math.floor(remSec / 60)} دقيقة و ${remSec % 60} ثانية قبل بدء ${label}...`);
          }
        }
        return;
      }

      mainWindow.webContents.send("bot-log",
        `\n[${label}] ${previousLabel} انتهى قبل التصدير؛ بدء الحساب التالي بدون انتظار تصدير.`);
      return;
    }

    let remainingMs = Math.max(0, INTER_ACCOUNT_COOLDOWN_MS - (Date.now() - exportTimestamp));
    if (remainingMs > 0) {
      const remainingSec = Math.ceil(remainingMs / 1000);
      mainWindow.webContents.send("bot-log",
        `\n⏸️  [تجنب حد التصدير] الانتظار لمدة ${Math.floor(remainingSec / 60)} دقيقة و ${remainingSec % 60} ثانية قبل بدء ${label}...`);

      let nextLogAt = Date.now() + INTER_ACCOUNT_COOLDOWN_LOG_INTERVAL_MS;
      while (remainingMs > 0 && botRunning) {
        const currentElapsed = Date.now() - exportTimestamp;
        if (currentElapsed >= INTER_ACCOUNT_COOLDOWN_MS) break;
        const waitTime = Math.min(1000, INTER_ACCOUNT_COOLDOWN_MS - currentElapsed);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        remainingMs = INTER_ACCOUNT_COOLDOWN_MS - (Date.now() - exportTimestamp);
        if (!botRunning) break;

        const now = Date.now();
        if (now >= nextLogAt) {
          while (nextLogAt <= now) nextLogAt += INTER_ACCOUNT_COOLDOWN_LOG_INTERVAL_MS;
          const remSec = Math.ceil(remainingMs / 1000);
          mainWindow.webContents.send("bot-log",
            `⏸️  [تجنب حد التصدير] الانتظار لمدة ${Math.floor(remSec / 60)} دقيقة و ${remSec % 60} ثانية قبل بدء ${label}...`);
        }
      }
    }
  }

  const resultPromises = [];
  for (let i = 0; i < accountsToRun.length; i++) {
    if (!botRunning) break;

    const acc = accountsToRun[i];
    const label = accountDisplayName(acc, `Account ${i + 1}`);

    if (i > 0) {
      await waitForExportCooldown(i - 1, i, resultPromises[i - 1]);
      if (!botRunning) break;
    }

    mainWindow.webContents.send("bot-log",
      `\n▶️  [${i + 1}/${accountsToRun.length}] بدء الحساب: ${label}`);

    const promise = runOneAccount(acc, i).then(result => {
      mainWindow.webContents.send("bot-log",
        `✅ [${i + 1}/${accountsToRun.length}] انتهى الحساب: ${label} — ${result.success ? "نجح" : "فشل"}`);
      return result;
    });
    resultPromises.push(promise);
  }

  const results = [...preflightResults, ...(await Promise.all(resultPromises))];

  botRunning = false;
  botChildren = [];
  currentBotChild = null;
  mainWindow.webContents.send("bot-run-complete");
  const allOk = results.every(r => r.success);
  return { success: allOk, multiAccount: true, results };
});
