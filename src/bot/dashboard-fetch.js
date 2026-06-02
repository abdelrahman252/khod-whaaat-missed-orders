"use strict";

// ════════════════════════════════════════════════════════════════
// DASHBOARD FETCH — Khod Whaat-only lightweight mode
// Spawned by main.js to fetch the dashboard snapshot.
// Does NOT touch Easy-Orders. No bot submission.
// Sends { type: "result", rows } or { type: "error", error } back.
// ════════════════════════════════════════════════════════════════

const { chromium } = require("playwright-core");
const fs   = require("fs");
const path = require("path");
const { parseFullMonthSnapshot } = require("./parser");

const config = JSON.parse(process.env.BOT_CONFIG || "{}");
const log = (msg) => process.stdout.write(msg + "\n");

// ── Find real Chrome install ──────────────────────────────────────────────
function findChrome() {
  const { execSync } = require("child_process");
  if (process.platform === "win32") {
    const paths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe"),
    ].filter(Boolean);
    for (const p of paths) if (fs.existsSync(p)) return p;
    try { return execSync("where chrome", { encoding: "utf8" }).trim().split("\n")[0]; } catch {}
  } else if (process.platform === "darwin") {
    const p = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    if (fs.existsSync(p)) return p;
  } else {
    try { return execSync("which google-chrome || which chromium-browser || which chromium", { encoding: "utf8" }).trim(); } catch {}
  }
  throw new Error("Chrome not found — install Google Chrome and try again.");
}

// ── Khod Whaat login ────────────────────────────────────────────────────────────
const MAX_KHOD_ATTEMPTS = 3;
const KHOD_DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000;

async function khodLogin(page) {
  log(`[NAV] → https://khod-whaat.com/affiliate/auth/login`);
  await page.goto("https://khod-whaat.com/affiliate/auth/login", { waitUntil: "domcontentloaded" });
  try { await page.waitForLoadState("networkidle", { timeout: 5000 }); } catch (e) {}

  const currentUrl = page.url();
  const isOnLogin = currentUrl.includes("/login") || currentUrl.includes("/auth");

  if (!isOnLogin) {
    log("✅ Khod Whaat: already logged in (session active)");
    return;
  }

  const method = config.khodLoginMethod || "email";
  log(`🔐 Khod Whaat: logging in via ${method}...`);

  if (!config.khodEmail || !config.khodPassword) {
    throw new Error("Khod Whaat credentials missing in config.");
  }

  if (method === "phone") {
    try {
      const phoneBtn = await page.locator('button:has-text("هاتف"), button:has-text("Phone"), a:has-text("هاتف")').first();
      if (await phoneBtn.isVisible({ timeout: 3000 })) await phoneBtn.click();
    } catch {}
  }

  let passInput;
  try {
    const emailInput = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="بريد" i]').first();
    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.fill(config.khodEmail);
    passInput = await page.locator('input[type="password"]').first();
    await passInput.fill(config.khodPassword);
    
    const submitBtn = await page.locator('button[type="submit"], button:has-text("دخول"), button:has-text("Login"), button:has-text("تسجيل")').first();
    await submitBtn.click({ noWaitAfter: true });
  } catch (e) {
    throw new Error(`Khod Whaat login form interaction failed: ${e.message}`);
  }

  log("⏳ Waiting for login to process...");
  try {
    // Smart wait: wait until URL doesn't contain login/auth
    await page.waitForURL(url => !url.href.includes("/login") && !url.href.includes("/auth"), { timeout: 45000 });
  } catch (err) {
    log("⚠️ URL didn't change after click. Checking for errors or retrying via Enter key...");
    const currentUrlAfter = page.url();
    if (currentUrlAfter.includes("/login") || currentUrlAfter.includes("/auth")) {
      const errorLoc = page.locator('.invalid-feedback, .text-danger, .alert-danger, .alert').first();
      if (await errorLoc.isVisible({ timeout: 2000 })) {
        const errText = await errorLoc.innerText();
        throw new Error(`Login rejected by server: ${errText.trim()}`);
      }
      
      log("🔄 Fallback: pressing Enter on password field...");
      try {
        await passInput.press("Enter");
        await page.waitForURL(url => !url.href.includes("/login") && !url.href.includes("/auth"), { timeout: 45000 });
      } catch (fallbackErr) {
        throw new Error("Khod Whaat login failed — still on login page after multiple submit attempts.");
      }
    }
  }

  log("✅ Khod Whaat: login successful");
}

// ── Flatpickr date range picker (same as runner.js) ──────────────────────
const FLATPICKR_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function _fpAriaLabel(d) {
  return `${FLATPICKR_MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

async function _fpNavigateToMonth(page, targetDate) {
  for (let i = 0; i < 24; i++) {
    const monthVal = await page.$eval(
      ".flatpickr-calendar.open .flatpickr-monthDropdown-months",
      (el) => parseInt(el.value)
    ).catch(() => -1);
    const yearVal = await page.$eval(
      ".flatpickr-calendar.open .numInput.cur-year",
      (el) => parseInt(el.value)
    ).catch(() => -1);

    if (monthVal === targetDate.getMonth() && yearVal === targetDate.getFullYear()) break;

    const shownTotal  = yearVal  * 12 + monthVal;
    const targetTotal = targetDate.getFullYear() * 12 + targetDate.getMonth();

    if (targetTotal < shownTotal) {
      await page.click(".flatpickr-calendar.open .flatpickr-prev-month");
    } else {
      await page.click(".flatpickr-calendar.open .flatpickr-next-month");
    }
    await page.waitForTimeout(300);
  }
}

async function pickDateRangeInFlatpickr(page, dateFrom, dateTo) {
  log(`📅 Flatpickr: ${_fpAriaLabel(dateFrom)} → ${_fpAriaLabel(dateTo)}`);

  try {
    await page.locator("#from_date + input").click({ timeout: 10000 });
    await page.waitForSelector(".flatpickr-calendar.open", { timeout: 10000 });
  } catch (e) {
    log("⚠️ Normal date picker click failed. Trying force click...");
    await page.locator("#from_date + input").click({ force: true });
    await page.waitForSelector(".flatpickr-calendar.open", { timeout: 10000 });
  }

  await _fpNavigateToMonth(page, dateFrom);
  const fromDaySel = `span.flatpickr-day[aria-label="${_fpAriaLabel(dateFrom)}"]:not(.prevMonthDay):not(.nextMonthDay)`;
  try {
    await page.locator(fromDaySel).click({ timeout: 5000 });
  } catch (e) {
    log("⚠️ Could not click FROM date normally. Trying force click...");
    await page.locator(fromDaySel).click({ force: true });
  }
  log(`✅ From date clicked: ${_fpAriaLabel(dateFrom)}`);

  if (dateFrom.getMonth() !== dateTo.getMonth() || dateFrom.getFullYear() !== dateTo.getFullYear()) {
    await _fpNavigateToMonth(page, dateTo);
  }
  const toDaySel = `span.flatpickr-day[aria-label="${_fpAriaLabel(dateTo)}"]:not(.prevMonthDay):not(.nextMonthDay)`;
  try {
    await page.locator(toDaySel).click({ timeout: 5000 });
  } catch (e) {
    log("⚠️ Could not click TO date normally. Trying force click...");
    await page.locator(toDaySel).click({ force: true });
  }
  log(`✅ To date clicked: ${_fpAriaLabel(dateTo)}`);

  await page.keyboard.press("Escape");
  try {
    await page.waitForSelector(".flatpickr-calendar.open", { state: "hidden", timeout: 2000 });
  } catch (e) {
    log("⚠️ Calendar didn't close with Escape. Clicking outside...");
    await page.mouse.click(0, 0); 
  }
}

function parseConfigDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  const parsed = new Date(y, m - 1, d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(value) {
  if (!value || isNaN(value.getTime())) return "";
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function isOnLoginPage(url) {
  return String(url || "").includes("/login") || String(url || "").includes("/auth");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeAffiliateCode(value) {
  return String(value || "").replace(/[^\dA-Za-z_-]/g, "").trim();
}

function assertIdentityMatch(site, expectedLabel, expected, actual) {
  if (expected !== actual) {
    throw new Error(`${site}_IDENTITY_MISMATCH: expected ${expectedLabel} "${expected}", detected "${actual || "unknown"}"`);
  }
}

async function readKhodIdentity(page) {
  const trigger = page.locator('[data-hs-unfold-target="#accountNavbarDropdown"], .navbar-dropdown-account-wrapper').first();
  if (await trigger.count().catch(() => 0)) {
    await trigger.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  return page.evaluate(() => {
    const root = document.querySelector("#accountNavbarDropdown") || document.body;
    const text = root.innerText || root.textContent || "";
    const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || "";
    const codeMatch = text.match(/(?:كود|code)\s*:?\s*([0-9A-Za-z_-]+)/i);
    return { email: email.trim().toLowerCase(), affiliateCode: codeMatch ? codeMatch[1].trim() : "" };
  });
}

async function verifyKhodIdentity(page, where = "dashboard-fetch") {
  const expectedEmail = normalizeEmail(config.khodEmail);
  const expectedCode = normalizeAffiliateCode(config.khodAffiliateCode);
  if (!expectedEmail) throw new Error("KHOD_IDENTITY_CONFIG_MISSING: khodEmail is not set");
  const identity = await readKhodIdentity(page);
  const actualEmail = normalizeEmail(identity.email);
  const actualCode = normalizeAffiliateCode(identity.affiliateCode);
  log(`[IDENTITY][Khod Dashboard] expected email=${expectedEmail}, expected code=${expectedCode || "(first-bind)"}, detected email=${actualEmail || "unknown"}, detected code=${actualCode || "unknown"}, where=${where}`);
  assertIdentityMatch("KHOD", "email", expectedEmail, actualEmail);
  if (expectedCode) assertIdentityMatch("KHOD", "affiliate code", expectedCode, actualCode);
  if (!actualCode) throw new Error("KHOD_IDENTITY_UNVERIFIED: affiliate code was not visible in the account dropdown");
  process.send && process.send({ type: "session-event", site: "khod", event: "identity-verified", email: actualEmail, affiliateCode: actualCode, where });
}

async function isLoginDomVisible(page) {
  return await page.locator('input[type="password"], input[name="email"], input[name="phone"]').first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);
}

async function waitForOrdersPage(page, attempt) {
  for (let reload = 1; reload <= 3; reload++) {
    try {
      log(`[NAV] → https://khod-whaat.com/affiliate/orders/list/all (load ${reload}/3, attempt ${attempt})`);
      await page.goto("https://khod-whaat.com/affiliate/orders/list/all", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

      if (isOnLoginPage(page.url()) || await isLoginDomVisible(page)) {
        log("🔐 Khod Whaat session expired before dashboard export — re-logging in...");
        await khodLogin(page);
        await page.goto("https://khod-whaat.com/affiliate/orders/list/all", { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      }

      log("⌛ Waiting for date filter input...");
      await verifyKhodIdentity(page, `dashboard-fetch-${attempt}`);
      await page.waitForSelector("#from_date + input", { timeout: 20000 });
      return;
    } catch (e) {
      log(`⚠️ Khod Whaat orders page not ready (${reload}/3): ${e.message}`);
      if (reload >= 3) throw new Error(`Khod Whaat orders page failed to load: ${e.message}`);
      await page.waitForTimeout(3000);
    }
  }
}

// ── Dashboard export ───────────────────────────────────────────────────────
async function khodExportFullMonth(context, page, requestedFrom, requestedTo) {
  const now       = new Date();
  const monthStart = requestedFrom || new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rangeEnd  = requestedTo || today;

  log(`📅 Dashboard fetch: ${_fpAriaLabel(monthStart)} → ${_fpAriaLabel(rangeEnd)}`);

  try {
    await page.goto("https://khod-whaat.com/lang/sa", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    log("🌐 Khod Whaat: Arabic language confirmed");
  } catch (e) {
    log(`⚠️ Language set failed (non-fatal): ${e.message}`);
  }

  let lastError = null;

  async function ensureOpenPage() {
    if (page && !page.isClosed()) return page;
    log("⚠️ Khod Whaat page was closed — opening a fresh dashboard page before retry...");
    page = await context.newPage();
    await page.setViewportSize({ width: 1400, height: 900 }).catch(() => {});
    return page;
  }

  for (let attempt = 1; attempt <= MAX_KHOD_ATTEMPTS; attempt++) {
    try {
      page = await ensureOpenPage();
      log(`\n🔄 Export attempt ${attempt}/${MAX_KHOD_ATTEMPTS}...`);
      await waitForOrdersPage(page, attempt);

      await pickDateRangeInFlatpickr(page, monthStart, rangeEnd);

      log("🔍 Clicking فلترة (filter)...");
      let filtered = false;
      const filterSelectors = [
        'button[name="filter"]',
        'button:has-text("فلترة")',
        'button:has-text("Filter")',
        'input[type="submit"][value*="فلتر"]',
        'form button[type="submit"]',
      ];
      for (const sel of filterSelectors) {
        try {
          const count = await page.locator(sel).count();
          if (count > 0) {
            await page.locator(sel).first().click({ noWaitAfter: true });
            filtered = true;
            log(`✅ Filter clicked via: ${sel}`);
            break;
          }
        } catch (e) {
          log(`⚠️ Filter selector "${sel}" failed: ${e.message}`);
        }
      }
      if (!filtered) {
        const allBtns = await page.evaluate(() =>
          Array.from(document.querySelectorAll("button, input[type=submit]"))
            .map(el => (el.innerText || el.value || "").trim().slice(0, 60))
            .filter(Boolean)
        );
        throw new Error(`Filter button not found. Buttons: ${allBtns.join(" | ")}`);
      }

      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await page.waitForTimeout(4000);

      let countAfter = "?";
      try { countAfter = await page.$eval(".badge.badge-soft-dark", (el) => el.innerText.trim()); } catch {}
      log(`📊 Orders after filter: ${countAfter}`);

      log("📥 Looking for استخراج اكسل (export) button...");
      process.send && process.send({ type: "cooldown", seconds: 600, attempt, maxAttempts: MAX_KHOD_ATTEMPTS });
      const exportSelectors = [
        'button[name="export"]',
        'button:has-text("استخراج")',
        'button:has-text("اكسل")',
        'button:has-text("Excel")',
        'a[href*="export"]',
        'button:has-text("تصدير")',
        'input[type="submit"][value*="استخراج"]',
        'input[type="submit"][value*="اكسل"]',
      ];

      let buffer = null;
      let exportFound = false;
      for (const sel of exportSelectors) {
        try {
          const count = await page.locator(sel).count();
          if (count <= 0) continue;
          log(`✅ Export button found via: ${sel}`);
          exportFound = true;

          const dlPromise = page.waitForEvent("download", { timeout: KHOD_DOWNLOAD_TIMEOUT_MS });
          await page.locator(sel).first().click({ noWaitAfter: true });
          log("⏳ Waiting for Khod Whaat to generate file (page may reload — normal)...");
          
          const dl = await dlPromise;
          log("✅ Download started, reading file stream...");
          const stream = await dl.createReadStream();
          const chunks = [];
          await new Promise((res, rej) => {
            stream.on("data", (c) => chunks.push(c));
            stream.on("end", res);
            stream.on("error", rej);
          });
          buffer = Buffer.concat(chunks);
          log(`✅ Khod Whaat export success — ${buffer.length} bytes downloaded`);
          process.send && process.send({ type: "export-timestamp", timestamp: Date.now() });
          break;
        } catch (e) {
          log(`⚠️ Selector "${sel}" failed: ${e.message}`);
          if (page.isClosed()) throw new Error(`Khod Whaat page closed while waiting for export download: ${e.message}`);
        }
      }

      if (!exportFound) {
        const allButtonTexts = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("button, input[type=submit], a"))
            .map((el, i) => ({ i, text: (el.innerText || el.value || el.textContent || "").trim().slice(0, 60) }))
            .filter(b => b.text);
        });
        log(`📋 Buttons found: ${JSON.stringify(allButtonTexts.slice(0, 20))}`);
        throw new Error(`Export button not found. Buttons on page: ${allButtonTexts.map(b => b.text).join(" | ")}`);
      }

      if (!buffer) {
        throw new Error("Export button was found, but no dashboard export file was downloaded.");
      }

      return buffer;

    } catch (err) {
      lastError = err;
      log(`❌ Export attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_KHOD_ATTEMPTS) {
        const waitSec = 6 * 60;
        log(`⚠️ Please wait — restarting dashboard export in ${Math.floor(waitSec / 60)}m ${waitSec % 60}s...`);
        process.send && process.send({
          type: "khod-restart",
          reason: err.message,
          attempt,
          maxAttempts: MAX_KHOD_ATTEMPTS,
          waitSeconds: waitSec,
        });
        if (!page.isClosed()) {
          await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        }
        for (let remaining = waitSec; remaining > 0; remaining -= 15) {
          await new Promise(resolve => setTimeout(resolve, Math.min(15, remaining) * 1000));
          if (remaining > 15) {
            process.send && process.send({
              type: "khod-restart",
              reason: err.message,
              attempt,
              maxAttempts: MAX_KHOD_ATTEMPTS,
              waitSeconds: remaining - 15,
            });
          }
        }
        page = await ensureOpenPage();
        try {
          await page.goto("https://khod-whaat.com/lang/sa", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2000);
          log("🌐 Khod Whaat: Arabic language re-confirmed before next attempt");
        } catch (_) {}
      }
    }
  }

  throw new Error(`Khod Whaat dashboard export failed after ${MAX_KHOD_ATTEMPTS} attempts. Last error: ${lastError ? lastError.message : "unknown error"}`);
}

// ── Main ──────────────────────────────────────────────────────────────────
(async () => {
  const profilePath = config.profilePath;
  if (!profilePath) {
    process.send && process.send({ type: "error", error: "profilePath not set in config" });
    return;
  }

  if (!config.khodEmail || !config.khodPassword) {
    process.send && process.send({ type: "error", error: "Khod Whaat credentials missing for this account. Re-save the account credentials, then retry dashboard update." });
    return;
  }

  if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath, { recursive: true });
  }

  const chromePath = config.chromePath || findChrome();
  log(`🌐 Using Chrome: ${chromePath}`);

  const context = await chromium.launchPersistentContext(profilePath, {
    executablePath: chromePath,
    headless: false,
    ignoreDefaultArgs: ["--enable-automation"],
    chromiumSandbox: true,
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-client-side-phishing-detection",
      "--disable-default-apps",
      "--disable-hang-monitor",
      "--disable-popup-blocking",
      "--disable-prompt-on-repost",
      "--disable-sync",
      "--disable-translate",
      "--disk-cache-size=52428800",
      "--no-pings",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-component-extensions-with-background-pages",
      "--disable-v8-idle-tasks",
      "--hide-crash-restore-bubble",
      "--force-device-scale-factor=1",
      "--window-size=1400,900",
      "--lang=en-US",
      "--accept-lang=en-US,en",
      // ── Speed-up flags (safe, no anti-bot impact) ──
      "--disable-ipc-flooding-protection", // faster IPC between renderer/browser process
      "--disable-features=TranslateUI,InterestFeedContentSuggestions", // skip feature init
    ],
    locale: "en-US",
    waitForInitialPage: false,
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    delete window.__playwright;
    delete window.__pw_manual;
    delete window.__PW_inspect;
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
  });

  const page = context.pages()[0] || (await context.newPage());
  page.setViewportSize({ width: 1400, height: 900 }).catch(() => {});

  try {
    log("\n═══════════════════════════════════════");
    log("  DASHBOARD FETCH — Khod Whaat Full Month");
    log("═══════════════════════════════════════\n");

    await khodLogin(page);
    log("");

    const requestedFrom = parseConfigDate(config.dashboardDateFrom);
    const requestedTo = parseConfigDate(config.dashboardDateTo);
    const buffer = await khodExportFullMonth(context, page, requestedFrom, requestedTo);
    const rows   = parseFullMonthSnapshot(buffer, {
      dateFrom: requestedFrom,
      dateTo: requestedTo,
    });

    const now = new Date();
    const snapshotBasis = requestedTo || now;
    const snapshotMonth = `${snapshotBasis.getFullYear()}-${String(snapshotBasis.getMonth() + 1).padStart(2, "0")}`;

    log(`\n✅ Dashboard snapshot ready — ${rows.length} rows for ${snapshotMonth}`);

    process.send && process.send({
      type: "dashboard-result",
      rows,
      snapshotMonth,
      dateFrom: toDateKey(requestedFrom),
      dateTo: toDateKey(requestedTo),
    });

  } catch (err) {
    log(`❌ FATAL: ${err.message}`);
    process.send && process.send({ type: "error", error: err.message });
  } finally {
    await context.close();
  }
})();
