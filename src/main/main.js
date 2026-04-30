const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const Store = require("electron-store");
const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const https = require("https");

// ══════════════════════════════════════════════════════
// SUPABASE CONFIG  — replace with your project values
// ══════════════════════════════════════════════════════
const SUPABASE_URL = "https://lkzmvtrwqgspbbbjyijj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_hg-XZyOtPfn6bc3gJYCNDw_3aG1njOM";

function supabaseRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const baseUrl = SUPABASE_URL.replace(/\/+$/, "");
    const url = new URL(baseUrl + endpoint);
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
      "Prefer": method === "POST" ? "return=representation" : "",
    };
    headers["apikey"] = SUPABASE_PUBLISHABLE_KEY; // required for both sb_publishable_ and eyJ key types
    const options = { hostname: url.hostname, path: url.pathname + url.search, method, headers };
    if (bodyStr) options.headers["Content-Length"] = Buffer.byteLength(bodyStr);
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function getIconPath() {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, "app", "assets")
    : path.join(__dirname, "..", "..", "assets");
  if (process.platform === "win32") return path.join(base, "icon.ico");
  if (process.platform === "darwin") return path.join(base, "icon.icns");
  return path.join(base, "icon.png");
}

const store = new Store({ encryptionKey: "taager-bot-secure-key-2024", name: "credentials" });
const licenseStore = new Store({ encryptionKey: "khod-bot-license-2024-secure", name: "license" });

let mainWindow, tray, autoRunTimer = null, autoRunEnabled = false, botRunning = false;

// ══════════════════════════════════════════════════════
// DEVICE FINGERPRINT — auto, never shown to user
// ══════════════════════════════════════════════════════
function getDeviceFingerprint() {
  try {
    const nets = os.networkInterfaces();
    const macs = [];
    for (const iface of Object.values(nets))
      for (const net of iface)
        if (!net.internal && net.mac && net.mac !== "00:00:00:00:00:00") macs.push(net.mac.toLowerCase());
    macs.sort();
    const raw = `${macs.join("|")}::${os.hostname().toLowerCase()}::${(os.cpus()[0]||{model:"x"}).model}`;
    return crypto.createHash("sha256").update(raw).digest("hex").toUpperCase().slice(0, 16);
  } catch {
    return crypto.createHash("sha256").update(os.hostname()).digest("hex").toUpperCase().slice(0, 16);
  }
}

// ══════════════════════════════════════════════════════
// LICENSE — server-only, random key, auto device lock
// Format: KHOD-XXXX-XXXX-XXXX-XXXX
// ══════════════════════════════════════════════════════
function isValidKeyFormat(key) {
  return /^KHOD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key.trim().toUpperCase());
}

async function isLicenseValid() {
  const key = licenseStore.get("licenseKey", "");
  if (!key) return false;
  try {
    const res = await supabaseRequest("GET",
      `/rest/v1/licenses?license_key=eq.${encodeURIComponent(key)}&select=revoked,device_id,expires_at`, null);
    if (!res.data || !Array.isArray(res.data) || !res.data.length) return false;
    const r = res.data[0];
    if (r.revoked) return false;
    if (r.expires_at && new Date(r.expires_at) < new Date()) return false;
    if (r.device_id && r.device_id !== getDeviceFingerprint()) return false;
    return true;
  } catch { return !!key; } // offline: trust local
}

// ════════════════════════════════════════
// TRAY
// ════════════════════════════════════════
function createTray() {
  const iconPath = getIconPath();
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (process.platform === "win32" && !icon.isEmpty()) icon = icon.resize({ width: 16, height: 16 });
  } catch { icon = nativeImage.createEmpty(); }
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
  mainWindow = new BrowserWindow({
    width: 1100, height: 750, minWidth: 900, minHeight: 600,
    frame: false, titleBarStyle: "hidden",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
    backgroundColor: "#0f1117", icon: getIconPath(), show: false,
  });
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (store.get("autoRun", false)) setTimeout(() => mainWindow.minimize(), 150);
    else mainWindow.focus();
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

app.whenReady().then(() => { createWindow(); createTray(); autoRunEnabled = store.get("autoRun", false); if (autoRunEnabled) scheduleAutoRun(); });
app.on("before-quit", () => { app.isQuitting = true; });
app.on("window-all-closed", () => {});

// ════════════════════════════════════════
// AUTO-RUN
// ════════════════════════════════════════
function todayStr() { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-"); }
function autoRunIntervalLabel() {
  const m = store.get("autoRunInterval", 30);
  return m < 60 ? m + " min" : (m / 60) + " hr";
}
function scheduleAutoRun() {
  clearAutoRun();
  autoRunTimer = setInterval(async () => {
    if (botRunning) return;
    if (!(await isLicenseValid())) { mainWindow.webContents.send("license-expired"); return; }
    mainWindow.webContents.send("auto-run-tick", { dateFrom: todayStr(), dateTo: todayStr() });
  }, store.get("autoRunInterval", 30) * 60 * 1000);
  updateTrayMenu();
}
function clearAutoRun() { if (autoRunTimer) { clearInterval(autoRunTimer); autoRunTimer = null; } updateTrayMenu(); }

// ════════════════════════════════════════
// IPC — Window
// ════════════════════════════════════════
ipcMain.on("window-minimize", () => mainWindow.minimize());
ipcMain.on("window-maximize", () => { if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize(); });
ipcMain.on("window-close", () => mainWindow.hide());

// ════════════════════════════════════════
// IPC — License (server-based, auto device lock)
// ════════════════════════════════════════
ipcMain.handle("check-license", async () => {
  const key = licenseStore.get("licenseKey", "");
  if (!key) return { valid: false, reason: "No license key." };
  const deviceId = getDeviceFingerprint();
  try {
    const res = await supabaseRequest("GET",
      `/rest/v1/licenses?license_key=eq.${encodeURIComponent(key)}&select=revoked,device_id,expires_at`, null);
    if (!res.data || !Array.isArray(res.data) || !res.data.length) return { valid: false, reason: "License not found on server." };
    const r = res.data[0];
    if (r.revoked) return { valid: false, reason: "Your license has been revoked. Contact support." };
    if (r.expires_at && new Date(r.expires_at) < new Date()) return { valid: false, reason: `License expired on ${new Date(r.expires_at).toLocaleDateString()}. Please renew.` };
    if (r.device_id && r.device_id !== deviceId) return { valid: false, reason: "This license is activated on a different device. Contact support to transfer." };
    const daysLeft = r.expires_at ? Math.max(0, Math.ceil((new Date(r.expires_at) - new Date()) / 86400000)) : null;
    return { valid: true, key, daysLeft };
  } catch { return { valid: true, key, daysLeft: null, offline: true }; }
});

ipcMain.handle("submit-license", async (_, key) => {
  const clean = key.trim().toUpperCase();
  if (!isValidKeyFormat(clean)) return { success: false, reason: "Invalid format. Keys look like: KHOD-XXXX-XXXX-XXXX-XXXX" };
  const deviceId = getDeviceFingerprint();
  try {
    const res = await supabaseRequest("GET",
      `/rest/v1/licenses?license_key=eq.${encodeURIComponent(clean)}&select=license_key,revoked,device_id,expires_at`, null);
    if (!res.data || !Array.isArray(res.data) || !res.data.length) return { success: false, reason: "License key not found. Contact support." };
    const r = res.data[0];
    if (r.revoked) return { success: false, reason: "This license has been revoked. Contact support." };
    if (r.expires_at && new Date(r.expires_at) < new Date()) return { success: false, reason: `This license expired on ${new Date(r.expires_at).toLocaleDateString()}. Please renew.` };
    if (r.device_id && r.device_id !== deviceId) return { success: false, reason: "This license is already active on a different device. Contact support to transfer." };
    if (!r.device_id) {
      await supabaseRequest("PATCH", `/rest/v1/licenses?license_key=eq.${encodeURIComponent(clean)}`,
        { device_id: deviceId, activated_at: new Date().toISOString() });
    }
    const daysLeft = r.expires_at ? Math.max(0, Math.ceil((new Date(r.expires_at) - new Date()) / 86400000)) : null;
    licenseStore.set("licenseKey", clean);
    return { success: true, daysLeft };
  } catch { return { success: false, reason: "Cannot reach server. Check your internet connection." }; }
});

// ════════════════════════════════════════
// IPC — Credentials (email-only + hardened account lock)
// ════════════════════════════════════════
ipcMain.handle("get-credentials", () => ({
  hasCredentials: store.has("easyPassword") && store.has("khodPassword"),
  easyEmail:       store.get("easyEmail",       ""),
  easyStore:       store.get("easyStore",       ""),
  khodEmail:       store.get("khodEmail",       ""),
  autoRun:         store.get("autoRun",         false),
  autoRunInterval: store.get("autoRunInterval", 30),
  launchMinimized: store.get("launchMinimized", false),
}));

ipcMain.handle("save-credentials", async (_, creds) => {
  const licKey = licenseStore.get("licenseKey", "");

  // ── HARDENED ACCOUNT LOCK ──
  if (licKey) {
    const identity = (creds.easyEmail + "|" + creds.khodEmail).toLowerCase().trim();
    const accountHash = crypto.createHash("sha256").update(identity).digest("hex");
    try {
      const res = await supabaseRequest("GET",
        `/rest/v1/licenses?license_key=eq.${encodeURIComponent(licKey)}&select=account_hash,account_locked`, null);
      if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
        const row = res.data[0];
        if (row.account_locked && row.account_hash && row.account_hash !== accountHash)
          return { success: false, reason: "account_locked" };
        if (!row.account_hash || !row.account_locked)
          await supabaseRequest("PATCH", `/rest/v1/licenses?license_key=eq.${encodeURIComponent(licKey)}`,
            { account_hash: accountHash, account_locked: true });
      }
    } catch {
      const localHash = licenseStore.get("lockedAccountHash", null);
      if (localHash && localHash !== accountHash) return { success: false, reason: "account_locked" };
      if (!localHash) licenseStore.set("lockedAccountHash", accountHash);
    }
    licenseStore.set("lockedAccountHash",
      crypto.createHash("sha256").update((creds.easyEmail + "|" + creds.khodEmail).toLowerCase().trim()).digest("hex"));
  }
  // ── END ACCOUNT LOCK ──

  store.set("easyEmail",    creds.easyEmail);
  store.set("easyPassword", creds.easyPassword);
  store.set("easyStore",    creds.easyStore || "");
  store.set("khodEmail",    creds.khodEmail);
  store.set("khodPassword", creds.khodPassword);
  return { success: true };
});

ipcMain.handle("open-folder", (_, p) => { shell.openPath(p); return true; });
ipcMain.handle("set-auto-run", (_, v) => { autoRunEnabled = v; store.set("autoRun", v); if (v) scheduleAutoRun(); else clearAutoRun(); return true; });
ipcMain.handle("set-auto-run-interval", (_, m) => { store.set("autoRunInterval", m); if (autoRunEnabled) scheduleAutoRun(); return true; });
ipcMain.handle("set-launch-minimized", (_, v) => { store.set("launchMinimized", v); return true; });

let currentBotChild = null;
ipcMain.on("bot-started", () => { botRunning = true; if (store.get("launchMinimized") && store.get("autoRun")) mainWindow.minimize(); });
ipcMain.on("bot-finished", () => { botRunning = false; currentBotChild = null; });
ipcMain.on("kill-bot", () => { if (currentBotChild) { try { currentBotChild.kill("SIGKILL"); } catch {} currentBotChild = null; } botRunning = false; });

ipcMain.handle("clear-all-data", () => {
  store.clear(); clearAutoRun();
  // licenseStore NOT cleared — device lock and key survive reset
  const p = path.join(app.getPath("userData"), "bot-profile");
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  return true;
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
ipcMain.handle("run-bot", async (_, { dateFrom, dateTo }) => {
  if (!(await isLicenseValid())) return { success: false, error: "LICENSE_INVALID" };
  const { fork } = require("child_process");
  const botPath = path.join(__dirname, "../bot/runner.js");
  const profilePath = path.join(app.getPath("userData"), "bot-profile");
  if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });
  const creds = {
    easyEmail:    store.get("easyEmail",    ""),
    easyPassword: store.get("easyPassword", ""),
    easyStore:    store.get("easyStore",    ""),
    khodEmail:    store.get("khodEmail",    ""),
    khodPassword: store.get("khodPassword", ""),
    profilePath, dateFrom, dateTo,
    launchMinimized: store.get("launchMinimized", false),
  };
  return new Promise((resolve) => {
    const child = fork(botPath, [], { env: { ...process.env, BOT_CONFIG: JSON.stringify(creds) }, silent: true });
    currentBotChild = child;
    const logs = []; let resolved = false;
    const safeResolve = (v) => { if (!resolved) { resolved = true; resolve(v); } };
    child.stdout.on("data", (d) => { const m = d.toString().trim(); if (m) { logs.push(m); mainWindow.webContents.send("bot-log", m); } });
    child.stderr.on("data", (d) => {
      const m = d.toString().trim();
      if (!m) return;
      if (m.includes("CHROME_NOT_FOUND")) {
        mainWindow.webContents.send("bot-log", "❌ Google Chrome غير مثبت على جهازك.");
        mainWindow.webContents.send("bot-log", "👉 حمّل Chrome من: https://www.google.com/chrome");
        mainWindow.webContents.send("bot-log", "✅ بعد التثبيت افتح البرنامج من جديد.");
      } else {
        mainWindow.webContents.send("bot-log", "ERR: " + m);
      }
    });
    child.on("message", (msg) => {
      if (msg.type === "result")         safeResolve({ success: true, data: msg.data });
      if (msg.type === "error")          safeResolve({ success: false, error: msg.error });
      if (msg.type === "2fa-needed")     mainWindow.webContents.send("bot-2fa-needed");
      if (msg.type === "needs-confirm")  mainWindow.webContents.send("bot-needs-confirm");
      if (msg.type === "cooldown")       mainWindow.webContents.send("bot-cooldown", msg);
      if (msg.type === "preview")        mainWindow.webContents.send("bot-preview", msg);
      if (msg.type === "order-progress") mainWindow.webContents.send("bot-order-progress", msg);
      if (msg.type === "khod-restart")   mainWindow.webContents.send("bot-khod-restart", msg);
    });
    child.on("exit", (code) => safeResolve({ success: code === 0, error: code !== 0 ? "Bot exited with code " + code : null, logs }));
  });
});