"use strict";

const { chromium } = require("playwright-core");
const XLSX = require("xlsx");
const fs   = require("fs");
const os   = require("os");
const path = require("path");
const {
  parseKhodPhones,
  parseRealOrders,
  parseMissedOrders,
  buildProductCatalog,
  resolveMissedOrders,
  mergeAndDeduplicate,
} = require("./parser");
const { buildOutputExcel, buildFailedExcel } = require("./output");

const config = JSON.parse(process.env.BOT_CONFIG || "{}");
const log = (msg) => process.stdout.write(msg + "\n");

// ════════════════════════════════════════
// SESSION GUARD
// Wraps any page action. If the site redirected
// to a login page mid-run, re-logs in and retries once.
// ════════════════════════════════════════
async function withSessionGuard(page, actionFn, reloginFn, siteName) {
  try {
    return await actionFn();
  } catch (err) {
    const url = page.url();
    const isLoggedOut =
      url.includes("/login") ||
      url.includes("/auth/login") ||
      url.includes("#/login");

    if (isLoggedOut) {
      log(`⚠️ ${siteName}: session expired mid-run — re-logging in...`);
      await reloginFn();
      log(`🔄 ${siteName}: retrying after re-login...`);
      return await actionFn(); // retry once
    }

    throw err; // not a session issue — bubble up normally
  }
}

// ════════════════════════════════════════
// FIND REAL CHROME
// ════════════════════════════════════════
function findChrome() {
  const { execSync } = require("child_process");
  if (process.platform === "win32") {
    const paths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      (process.env.LOCALAPPDATA || "") + "\\Google\\Chrome\\Application\\chrome.exe",
      (process.env.PROGRAMFILES || "") + "\\Google\\Chrome\\Application\\chrome.exe",
    ];
    for (const p of paths) if (fs.existsSync(p)) return p;
    try {
      const reg = execSync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /ve',
        { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
      );
      const m = reg.match(/REG_SZ\s+(.+)/);
      if (m && fs.existsSync(m[1].trim())) return m[1].trim();
    } catch {}
  } else if (process.platform === "darwin") {
    const paths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
    for (const p of paths) if (fs.existsSync(p)) return p;
  }
  throw new Error(
    "CHROME_NOT_FOUND"
  );
}

// ════════════════════════════════════════
// DATE HELPERS
// ════════════════════════════════════════
function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function subtractDay(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d;
}

function formatDataDay(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

// ════════════════════════════════════════
// EASY-ORDERS CALENDAR PICKER
// ════════════════════════════════════════
async function pickDateInEasyOrdersCalendar(page, targetDt) {
  const targetMonth = targetDt.getMonth();
  const targetYear  = targetDt.getFullYear();
  const dayClass    = String(targetDt.getDate()).padStart(3, "0");
  const monthNames  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  await page.waitForSelector(".react-datepicker", { timeout: 8000 });
  await page.waitForTimeout(300);

  for (let i = 0; i < 24; i++) {
    const headerText = await page.$eval(".react-datepicker__current-month", (el) => el.innerText.trim()).catch(() => "");
    const parts      = headerText.split(" ");
    const shownMonth = monthNames.indexOf(parts[0]);
    const shownYear  = parseInt(parts[1]);

    if (shownYear === targetYear && shownMonth === targetMonth) break;

    const shownTotal  = shownYear  * 12 + shownMonth;
    const targetTotal = targetYear * 12 + targetMonth;

    if (targetTotal < shownTotal) await page.click(".react-datepicker__navigation--previous");
    else                          await page.click(".react-datepicker__navigation--next");
    await page.waitForTimeout(300);
  }

  await page.click(`.react-datepicker__day--${dayClass}:not(.react-datepicker__day--outside-month)`);
  await page.waitForTimeout(400);
  log(`✅ Easy-orders calendar: ${targetDt.toDateString()}`);
}

// ════════════════════════════════════════
// TAAGER CALENDAR PICKER
// ════════════════════════════════════════
async function pickDateInTaagerCalendar(page, targetDt) {
  const targetDataDay = formatDataDay(targetDt);
  log(`📅 Khod whaat calendar → ${targetDataDay}`);

  await page.waitForSelector('[role="grid"]', { timeout: 10000 });
  await page.waitForTimeout(300);

  for (let i = 0; i < 24; i++) {
    if ((await page.locator(`[data-day="${targetDataDay}"]`).count()) > 0) break;

    const firstCell = await page.locator("[data-day]").first().getAttribute("data-day").catch(() => null);
    if (!firstCell) break;

    const goBack = new Date(targetDataDay) < new Date(firstCell);
    if (goBack) {
      const ok = await page.locator('button[name="previous-month"]').click().then(() => true).catch(() => false);
      if (!ok) await page.locator('[role="grid"]').locator("..").locator("button").first().click();
    } else {
      const ok = await page.locator('button[name="next-month"]').click().then(() => true).catch(() => false);
      if (!ok) await page.locator('[role="grid"]').locator("..").locator("button").last().click();
    }
    await page.waitForTimeout(300);
  }

  await page.locator(`[data-day="${targetDataDay}"] button`).click();
  await page.waitForTimeout(400);
  log(`✅ Khod whaat calendar: ${targetDataDay}`);
}

// ════════════════════════════════════════
// EASY-ORDERS EXPORT TRIGGER
// ════════════════════════════════════════
async function triggerEasyOrdersExport(page, exportFromDate, keyword) {
  const MAX_ATTEMPTS  = 3;
  const COOLDOWN_MS   = 6 * 60 * 1000; // Easy-Orders rate limit: 1 export per 5 min
  const CHECK_POLL_MS = 5000;
  const CHECK_ROUNDS  = 24; // ~2 min of polling after triggering

  const pageUrl = keyword === "missed-orders"
    ? "https://app.easy-orders.net/#/missed-orders"
    : "https://app.easy-orders.net/#/orders";

  // ── Step 1: Trigger the export and immediately return the timestamp ──
  const triggerExport = async (n) => {
    log(`\n📤 Export attempt ${n}/${MAX_ATTEMPTS} for "${keyword}"...`);

    // ── FALLBACK: reload page up to 3 times if table or export button not found ──
    let pageReady = false;
    for (let reload = 1; reload <= 3; reload++) {
      try {
        await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("table", { timeout: 15000 });
        await page.waitForSelector('button:has-text("Export")', { timeout: 15000 });
        pageReady = true;
        break;
      } catch (e) {
        log(`⚠️ Page not ready (reload ${reload}/3): ${e.message}`);
        if (reload < 3) {
          log(`🔄 Reloading page and trying again...`);
          await page.waitForTimeout(4000);
        } else {
          throw new Error(`Export page failed to load after 3 reloads for "${keyword}": ${e.message}`);
        }
      }
    }

    await page.click('button:has-text("Export")');
    await page.waitForTimeout(2000);

    await page.click(".react-datepicker-wrapper:first-of-type input");
    await pickDateInEasyOrdersCalendar(page, exportFromDate);
    await page.click(".MuiDialogTitle-root");
    await page.waitForTimeout(500);

    await page.waitForSelector(".MuiDialogActions-root button", { timeout: 5000 });
    const triggeredAt = Date.now();
    await page.click(".MuiDialogActions-root button");
    await page.waitForTimeout(1500);
    log(`⏱️ Export triggered at ${new Date(triggeredAt).toISOString()}`);
    return triggeredAt;
  };

  // ── Step 2: Poll notifications for the ready file ──
  const pollForFile = async (triggeredAt) => {
    await page.goto("https://app.easy-orders.net/#/notifications", { waitUntil: "domcontentloaded" });

    for (let i = 1; i <= CHECK_ROUNDS; i++) {
      log(`🔁 Checking notifications (${i}/${CHECK_ROUNDS}) for "${keyword}"...`);
      try {
        const found = await page.evaluate(
          ({ triggeredAt, keyword }) => {
            const links = Array.from(document.querySelectorAll(`a[href*="${keyword}"][href*=".xlsx"]`));
            for (const link of links) {
              let node = link.parentElement;
              let hasChip = false;
              for (let j = 0; j < 15; j++) {
                if (!node) break;
                if (node.querySelector(".MuiChip-colorSuccess")) { hasChip = true; break; }
                node = node.parentElement;
              }
              if (!hasChip) continue;
              const match = link.href.match(/\/([0-9]{13,})/);
              if (match) {
                const ts = Number(match[1].slice(0, 13));
                if (ts < triggeredAt - 60000) continue;
              }
              return link.href;
            }
            return null;
          },
          { triggeredAt, keyword }
        );
        if (found) { log(`✅ Download URL found`); return found; }
      } catch (e) {
        log(`⚠️ Check error: ${e.message}`);
      }
      await page.waitForTimeout(CHECK_POLL_MS);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
    }
    return null; // not ready after polling window
  };

  // ── Main retry loop ──
  // Strategy: trigger → poll for ~2 min → if still not ready, DON'T keep checking.
  // Instead: wait out the full 6-min cooldown (from trigger time), then re-trigger fresh.
  // This avoids hammering the server and respects the 1-export-per-5-min rate limit.
  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    const triggeredAt = await triggerExport(n);
    const url = await pollForFile(triggeredAt);
    if (url) return url;

    if (n < MAX_ATTEMPTS) {
      // Calculate how long we've already spent since triggering
      const elapsed   = Date.now() - triggeredAt;
      const remaining = Math.max(0, COOLDOWN_MS - elapsed);
      const waitSecs  = Math.ceil(remaining / 1000);

      log(`\n⚠️ Export not ready after polling — rate limit hit.`);
      log(`⏸️  Cooling down for ${waitSecs}s before re-triggering (already waited ${Math.round(elapsed / 1000)}s)...`);

      // Notify UI about the cooldown
      process.send && process.send({ type: "cooldown", seconds: waitSecs, attempt: n, maxAttempts: MAX_ATTEMPTS });

      // Wait out the remaining cooldown in 10s ticks so the log stays alive
      let left = remaining;
      while (left > 0) {
        const tick = Math.min(10000, left);
        await page.waitForTimeout(tick);
        left -= tick;
        if (left > 0) log(`⏳ Re-triggering in ${Math.ceil(left / 1000)}s...`);
      }

      log(`🔄 Cooldown done — re-triggering export now\n`);
    }
  }
  throw new Error(`Export failed after ${MAX_ATTEMPTS} attempts for "${keyword}"`);
}

// ════════════════════════════════════════
// DOWNLOAD URL TO BUFFER
// ════════════════════════════════════════
async function downloadToBuffer(page, url) {
  const response = await page.context().request.get(url);
  const body     = await response.body();
  return Buffer.from(body);
}

// ════════════════════════════════════════
// PHASE 1 — EASY-ORDERS LOGIN
// Selectors from real HTML:
//   Email:    #username  (type=email, name=username)
//   Password: #password  (type=password, name=password)
//   Button:   button[type="submit"]  text="تسجيل الدخول"
// ════════════════════════════════════════
async function phase1_easyOrdersLogin(page) {
  log("\n═══════════════════════════════════════");
  log("  PHASE 1 — Easy-Orders Login");
  log("═══════════════════════════════════════\n");

  // Go to app root — if already logged in it goes to dashboard/orders directly
  // Only navigates to login if session expired
  await page.goto("https://app.easy-orders.net/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const currentUrl      = page.url();
  const alreadyLoggedIn = !currentUrl.includes("login");

  if (alreadyLoggedIn) {
    log("✅ Easy-orders: already logged in, skipping login\n");
  } else {
    log("🔐 Easy-orders: session expired, logging in...");

    // ── LOGIN WITH FALLBACK: if form fields not found, reload and try again ──
    let loginFormFound = false;
    for (let loginAttempt = 1; loginAttempt <= 3; loginAttempt++) {
      try {
        await page.goto("https://app.easy-orders.net/#/login", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1000);

        // Wait for email field: id="username", type="email"
        await page.waitForSelector('#username', { timeout: 10000 });
        loginFormFound = true;

        await page.fill('#username', config.easyEmail);
        await page.waitForTimeout(400);

        // Password field: id="password"
        await page.fill('#password', config.easyPassword);
        await page.waitForTimeout(400);

        // Submit: button[type="submit"]
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);

        log("✅ Easy-orders: credentials submitted, waiting for result...");
        break;
      } catch (e) {
        log(`⚠️ Easy-orders login attempt ${loginAttempt}/3 failed: ${e.message}`);
        if (loginAttempt < 3) {
          log(`🔄 Reloading login page and retrying (${loginAttempt + 1}/3)...`);
          await page.waitForTimeout(3000);
        } else {
          log("❌ Could not find Easy-orders login form after 3 attempts");
        }
      }
    }

    // 2FA: signal the UI, then wait up to 5 min for login to complete
    process.send && process.send({ type: "2fa-needed" });
    log("⏳ If 2FA is required, complete it in the browser (5 min max)...");

    const maxWait = 5 * 60 * 1000;
    const started = Date.now();
    let confirmed = false;

    while (Date.now() - started < maxWait) {
      await page.waitForTimeout(3000);
      if (!page.url().includes("login")) {
        confirmed = true;
        break;
      }
      log(`⏳ ${Math.round((Date.now() - started) / 1000)}s — waiting...`);
    }

    if (!confirmed) throw new Error("Easy-orders login timeout after 5 minutes");
    log("✅ Easy-orders login confirmed\n");
  }

  // ── Store selection (if user has multiple stores) ──
  await page.waitForTimeout(1500);
  if (page.url().includes("store-selection")) {
    log("🏪 Store selection page detected...");

    const storeName = (config.easyStore || "").trim().toLowerCase();

    if (!storeName) {
      // No store configured — just click the first one
      log("⚠️ No store name configured — clicking first store");
      await page.locator('.MuiCard-root').first().click();
    } else {
      // Find the card whose h6 text matches the configured store name
      log(`🔍 Looking for store: "${config.easyStore}"`);

      const cards = page.locator('.MuiCard-root');
      const count = await cards.count();
      let found   = false;

      for (let i = 0; i < count; i++) {
        const card      = cards.nth(i);
        const nameEl    = card.locator('h6');
        const cardName  = (await nameEl.innerText().catch(() => "")).trim().toLowerCase();

        if (cardName === storeName || cardName.includes(storeName) || storeName.includes(cardName)) {
          log(`✅ Found store: "${cardName}" — clicking`);
          await card.click();
          found = true;
          break;
        }
      }

      if (!found) {
        log(`⚠️ Store "${config.easyStore}" not found — clicking first store as fallback`);
        await cards.first().click();
      }
    }

    // Wait for redirect away from store-selection
    await page.waitForFunction(
      () => !window.location.href.includes("store-selection"),
      { timeout: 15000 }
    );
    await page.waitForTimeout(1500);
    log("✅ Store selected\n");
  }

  // Switch to English if needed
  try {
    const langLabel = await page.$eval(
      '[aria-label="language-switcher"] p',
      (el) => el.innerText.trim()
    );
    if (langLabel !== "en") {
      await page.click('[aria-label="language-switcher"]');
      await page.waitForTimeout(1000);
      await page.click('[role="menuitem"][aria-label="english"]');
      await page.waitForTimeout(2000);
      log("✅ Switched to English");
    }
  } catch {}
}

// ════════════════════════════════════════
// PHASE 2 — REAL ORDERS EXPORT
// ════════════════════════════════════════
async function phase2_realOrders(page, exportFromDate) {
  log("\n═══════════════════════════════════════");
  log("  PHASE 2 — Real Orders Export");
  log("═══════════════════════════════════════\n");

  const url = await withSessionGuard(
    page,
    () => triggerEasyOrdersExport(page, exportFromDate, "orders"),
    () => phase1_easyOrdersLogin(page),
    "Easy-Orders"
  );
  const buffer = await downloadToBuffer(page, url);
  log(`✅ Real orders downloaded: ${buffer.length} bytes`);
  return buffer;
}

// ════════════════════════════════════════
// PHASE 3 — MISSED ORDERS EXPORT
// ════════════════════════════════════════
async function phase3_missedOrders(page, exportFromDate) {
  log("\n═══════════════════════════════════════");
  log("  PHASE 3 — Missed Orders Export");
  log("═══════════════════════════════════════\n");

  const url = await withSessionGuard(
    page,
    () => triggerEasyOrdersExport(page, exportFromDate, "missed-orders"),
    () => phase1_easyOrdersLogin(page),
    "Easy-Orders"
  );
  const buffer = await downloadToBuffer(page, url);
  log(`✅ Missed orders downloaded: ${buffer.length} bytes`);
  return buffer;
}

// ════════════════════════════════════════
// PHASE 4 — KHOD LOGIN + EXPORT
//
// URL: https://khod-whaat.com/affiliate/auth/login
// Orders: https://khod-whaat.com/affiliate/orders/list/all
//
// Export flow (with full fallback/retry):
//   1. Login if needed
//   2. Navigate to orders list
//   3. Pick date range via flatpickr
//   4. Click فلترة (filter button)
//   5. Click استخراج اكسل (export button) → wait for download
//
// If ANY step fails → full page reload + restart from step 2.
// Retries: up to MAX_KHOD_ATTEMPTS total. Between retries: KHOD_RETRY_WAIT_MS.
// ════════════════════════════════════════
const MAX_KHOD_ATTEMPTS  = 5;
const KHOD_RETRY_WAIT_MS = 6 * 60 * 1000; // 6 min (matches existing cooldown)

async function khodLogin(page) {
  await page.goto("https://khod-whaat.com/affiliate/auth/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const alreadyLoggedIn = !page.url().includes("/auth/login") && !page.url().includes("/login");
  if (alreadyLoggedIn) { log("✅ Khod: already logged in"); return; }

  const method = config.khodLoginMethod || "email";
  log(`🔐 Khod: logging in via ${method}...`);

  // ── FALLBACK: reload login page up to 3 times if form fields not found ──
  for (let loginAttempt = 1; loginAttempt <= 3; loginAttempt++) {
    try {
      if (method === "phone") {
        await page.waitForSelector('input[name="phone"], input[name="phoneNumber"]', { timeout: 10000 });
        await page.fill('input[name="phone"], input[name="phoneNumber"]', config.khodPhone);
        await page.waitForTimeout(400);
        await page.fill('input[name="password"]', config.khodPassword);
        await page.waitForTimeout(400);
        await page.click('button[type="submit"]');
      } else {
        await page.waitForSelector('input[name="email"]', { timeout: 10000 });
        await page.fill('input[name="email"]', config.khodEmail);
        await page.waitForTimeout(400);
        await page.fill('input[name="password"]', config.khodPassword);
        await page.waitForTimeout(400);
        await page.click('button[type="submit"]');
      }
      await page.waitForTimeout(2000);
      log("✅ Khod: credentials submitted");
      break;
    } catch (e) {
      log(`⚠️ Khod login form attempt ${loginAttempt}/3 failed: ${e.message}`);
      if (loginAttempt < 3) {
        log(`🔄 Reloading Khod login page and retrying...`);
        await page.goto("https://khod-whaat.com/affiliate/auth/login", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(3000);
      } else {
        log("❌ Khod login form not found after 3 attempts — proceeding to wait for manual login");
      }
    }
  }

  process.send && process.send({ type: "2fa-needed" });
  log("⏳ If 2FA required, complete it in the browser (5 min max)...");

  const maxWait = 5 * 60 * 1000;
  const started = Date.now();
  let confirmed = false;
  while (Date.now() - started < maxWait) {
    await page.waitForTimeout(3000);
    const url = page.url();
    if (!url.includes("/login") && !url.includes("/auth")) { confirmed = true; break; }
    log(`⏳ ${Math.round((Date.now() - started) / 1000)}s — waiting for Khod login...`);
  }
  if (!confirmed) throw new Error("Khod login timeout after 5 minutes");
  log("✅ Khod login confirmed");
}

async function khodExportAttempt(page, exportFromDate, dateTo, attemptNum) {
  log(`\n🔄 Khod export attempt ${attemptNum}/${MAX_KHOD_ATTEMPTS}`);

  // ── Navigate to orders list with fallback reload ──
  log("🌐 Loading Khod orders page...");
  let pageLoaded = false;
  for (let reload = 1; reload <= 3; reload++) {
    try {
      await page.goto("https://khod-whaat.com/affiliate/orders/list/all", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);

      // ── Session guard: if redirected to login, re-login before proceeding ──
      const currentUrl = page.url();
      if (currentUrl.includes("/login") || currentUrl.includes("/auth")) {
        log("🔐 Khod session expired mid-attempt — re-logging in...");
        await khodLogin(page);
        await page.goto("https://khod-whaat.com/affiliate/orders/list/all", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(3000);
      }

      // ── Wait for date input to appear ──
      log("⌛ Waiting for date filter input...");
      await page.waitForSelector("#from_date + input", { timeout: 20000 });
      pageLoaded = true;
      break;
    } catch (e) {
      log(`⚠️ Khod orders page not ready (reload ${reload}/3): ${e.message}`);
      if (reload < 3) {
        log(`🔄 Reloading Khod orders page...`);
        await page.waitForTimeout(4000);
      } else {
        throw new Error(`Khod orders page failed to load after 3 reloads: ${e.message}`);
      }
    }
  }
  await page.waitForTimeout(1000);

  // ── Set date range via flatpickr ──
  log("📅 Picking date range...");
  await pickDateRangeInFlatpickr(page, exportFromDate, dateTo);

  // ── Click فلترة (filter) ──
  log("🔍 Clicking فلترة (filter)...");

  // Fallback selectors for filter button
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
        await page.locator(sel).first().click();
        filtered = true;
        log(`✅ Filter clicked via: ${sel}`);
        break;
      }
    } catch {}
  }
  if (!filtered) {
    // Last scan of all buttons to help debug
    const allBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button, input[type=submit]"))
        .map(el => (el.innerText || el.value || "").trim().slice(0, 60))
        .filter(Boolean)
    );
    log(`📋 All buttons on page: ${allBtns.join(" | ")}`);
    throw new Error(`Filter button (فلترة) not found — page may not have loaded correctly. Buttons: ${allBtns.join(" | ")}`);
  }

  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(4000);

  let countAfter = "?";
  try { countAfter = await page.$eval(".badge.badge-soft-dark", (el) => el.innerText.trim()); } catch {}
  log(`📊 Orders after filter: ${countAfter}`);

  // ── Click استخراج اكسل (export) ──
  log("📥 Looking for استخراج اكسل (export) button...");
  process.send && process.send({ type: "cooldown", seconds: 600, attempt: attemptNum, maxAttempts: MAX_KHOD_ATTEMPTS });

  // Multiple fallback selectors for export button
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

  let exportFound = false;
  for (const sel of exportSelectors) {
    try {
      const count = await page.locator(sel).count();
      if (count > 0) {
        log(`✅ Export button found via: ${sel}`);
        exportFound = true;

        const dlPromise = page.waitForEvent("download", { timeout: 15 * 60 * 1000 });
        await page.locator(sel).first().click({ noWaitAfter: true });
        log("⏳ Waiting for Khod to generate file (page may reload — normal)...");

        const dl = await dlPromise;
        const stream = await dl.createReadStream();
        const chunks = [];
        await new Promise((res, rej) => {
          stream.on("data", (c) => chunks.push(c));
          stream.on("end", res);
          stream.on("error", rej);
        });
        const buffer = Buffer.concat(chunks);
        log(`✅ Khod orders downloaded: ${buffer.length} bytes`);
        return buffer;
      }
    } catch (e) {
      log(`⚠️ Selector "${sel}" failed: ${e.message}`);
    }
  }

  if (!exportFound) {
    // Last-resort: try to find ANY button that could be export by scanning all buttons
    log("🔎 Scanning all buttons on page for export button...");
    const allButtonTexts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("button, input[type=submit], a"))
        .map((el, i) => ({ i, text: (el.innerText || el.value || el.textContent || "").trim().slice(0, 60) }))
        .filter(b => b.text);
    });
    log(`📋 Buttons found: ${JSON.stringify(allButtonTexts.slice(0, 20))}`);
    throw new Error(`Export button not found. Buttons on page: ${allButtonTexts.map(b => b.text).join(" | ")}`);
  }
}

async function phase4_khod(page, exportFromDate, dateTo) {
  log("\n═══════════════════════════════════════");
  log("  PHASE 4 — Khod Login & Export");
  log("═══════════════════════════════════════\n");

  // ── Login (once — session persists across retries) ──
  await khodLogin(page);
  log("");

  // ── Ensure Arabic language is active ──
  // The current language shows as text in .topbar-link span
  // If it says "english" we navigate to /lang/sa to switch to Arabic
  try {
    const langSpan = await page.$(".topbar-link .d-none.d-sm-inline-block");
    if (langSpan) {
      const langText = (await langSpan.innerText()).trim().toLowerCase();
      if (langText === "english") {
        log("🌐 Khod: switching language from English → Arabic...");
        await page.goto("https://khod-whaat.com/lang/sa", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2000);
        log("✅ Khod: language set to Arabic");
      } else {
        log("✅ Khod: language already Arabic, no change needed");
      }
    } else {
      // Selector not found — navigate to Arabic directly as safe fallback
      log("⚠️ Khod: could not read language — forcing Arabic via /lang/sa");
      await page.goto("https://khod-whaat.com/lang/sa", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    log(`⚠️ Khod language check failed (non-fatal): ${e.message}`);
  }

  // ── Export with full fallback retry loop ──
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_KHOD_ATTEMPTS; attempt++) {
    try {
      const buffer = await khodExportAttempt(page, exportFromDate, dateTo, attempt);
      return buffer; // ✅ success
    } catch (err) {
      lastError = err;
      log(`\n❌ Khod export attempt ${attempt}/${MAX_KHOD_ATTEMPTS} FAILED`);
      log(`   Reason: ${err.message}`);

      if (attempt < MAX_KHOD_ATTEMPTS) {
        const waitSec = Math.ceil(KHOD_RETRY_WAIT_MS / 1000);
        const waitMin = Math.floor(waitSec / 60);
        const waitSecRem = waitSec % 60;

        log(`\n⚠️ Please wait — restarting in ${waitMin}m ${waitSecRem}s...`);
        log(`   The page will refresh and try again automatically.`);

        // Notify UI with countdown
        process.send && process.send({
          type: "khod-restart",
          reason: err.message,
          attempt,
          maxAttempts: MAX_KHOD_ATTEMPTS,
          waitSeconds: waitSec,
        });

        // Wait with live countdown ticks
        let remaining = KHOD_RETRY_WAIT_MS;
        while (remaining > 0) {
          const tick = Math.min(15000, remaining);
          await page.waitForTimeout(tick);
          remaining -= tick;
          if (remaining > 0) {
            const secLeft = Math.ceil(remaining / 1000);
            log(`⏳ Restarting in ${Math.floor(secLeft / 60)}m ${secLeft % 60}s — please wait...`);
            process.send && process.send({
              type: "khod-restart",
              reason: err.message,
              attempt,
              maxAttempts: MAX_KHOD_ATTEMPTS,
              waitSeconds: Math.ceil(remaining / 1000),
            });
          }
        }

        log(`\n🔄 Restarting Khod export (attempt ${attempt + 1}/${MAX_KHOD_ATTEMPTS})...`);

        // Hard refresh before next attempt
        try {
          await page.goto("https://khod-whaat.com/affiliate/orders/list/all", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(3000);
        } catch {}

        // Re-login if session was lost
        try {
          const currentUrl = page.url();
          if (currentUrl.includes("/login") || currentUrl.includes("/auth")) {
            log("🔐 Session expired — re-logging into Khod...");
            await khodLogin(page);
          }
        } catch {}
      }
    }
  }

  throw new Error(`Khod export failed after ${MAX_KHOD_ATTEMPTS} attempts. Last error: ${lastError?.message}`);
}

// ════════════════════════════════════════
// FLATPICKR RANGE CALENDAR PICKER
//
// Khod uses flatpickr in range mode — one calendar handles both from + to.
// First click sets "from", second click sets "to".
//
// Selectors:
//   Open trigger : #from_date + input
//   Calendar     : .flatpickr-calendar.open
//   Day cells    : span.flatpickr-day[aria-label="April 19, 2026"]
//   Prev month   : .flatpickr-prev-month
//   Next month   : .flatpickr-next-month
//   Month select : .flatpickr-monthDropdown-months  (value = 0–11)
//   Year input   : .numInput.cur-year
// ════════════════════════════════════════
async function pickDateRangeInFlatpickr(page, dateFrom, dateTo) {
  const MONTH_NAMES = ["January","February","March","April","May","June",
    "July","August","September","October","November","December"];

  function ariaLabel(d) {
    return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  log(`📅 Flatpickr: ${ariaLabel(dateFrom)} → ${ariaLabel(dateTo)}`);

  // Open calendar by clicking the visible text input
  await page.click("#from_date + input");
  await page.waitForSelector(".flatpickr-calendar.open", { timeout: 8000 });
  await page.waitForTimeout(400);

  // Navigate to dateFrom month and click it
  await navigateFlatpickrToMonth(page, dateFrom);
  await page.click(`span.flatpickr-day[aria-label="${ariaLabel(dateFrom)}"]:not(.prevMonthDay):not(.nextMonthDay)`);
  await page.waitForTimeout(400);
  log(`✅ From date clicked: ${ariaLabel(dateFrom)}`);

  // Navigate to dateTo month if different and click it
  if (dateFrom.getMonth() !== dateTo.getMonth() || dateFrom.getFullYear() !== dateTo.getFullYear()) {
    await navigateFlatpickrToMonth(page, dateTo);
  }
  await page.click(`span.flatpickr-day[aria-label="${ariaLabel(dateTo)}"]:not(.prevMonthDay):not(.nextMonthDay)`);
  await page.waitForTimeout(400);
  log(`✅ To date clicked: ${ariaLabel(dateTo)}`);

  // Close calendar
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

async function navigateFlatpickrToMonth(page, targetDate) {
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

// ════════════════════════════════════════
// CITY — keyword → canonical display text
// We match by visible text, NOT data-value (UUIDs change on every deploy)
// ════════════════════════════════════════
const CITY_KEYWORDS = [
  // Each entry: { keywords[], label }
  // label must be a substring of the actual <li> text in Easy-Orders
  { keywords: ["الرياض"],                          label: "منطقة الرياض" },
  { keywords: ["الغربية", "مكة", "جدة"],           label: "المنطقة الغربية" },
  { keywords: ["الشرقية", "الدمام"],               label: "المنطقة الشرقية" },
  { keywords: ["المدينة المنورة", "المدينة"],      label: "المدينة المنورة" },
  { keywords: ["القصيم", "قصيم"],                  label: "منطقة القصيم" },
  { keywords: ["عسير", "أبها", "ابها"],            label: "عسير" },
  { keywords: ["جيزان", "جازان"],                  label: "جيزان" },
  { keywords: ["نجران"],                           label: "نجران" },
  { keywords: ["تبوك"],                            label: "تبوك" },
  { keywords: ["حائل"],                            label: "حائل" },
  { keywords: ["سكاكا", "الجوف", "جوف"],           label: "سكاكا" },
  { keywords: ["عرعر", "الحدود الشمالية", "حدود"], label: "عرعر" },
  { keywords: ["الباحة", "باحة"],                  label: "الباحة" },
];

// DEFAULT_CITY is the single source of truth for all fallbacks.
const DEFAULT_CITY = "منطقة الرياض";

function resolveCityLabel(cityName) {
  if (!cityName) return DEFAULT_CITY;
  const clean = cityName.trim();
  for (const entry of CITY_KEYWORDS) {
    for (const kw of entry.keywords) {
      if (clean.includes(kw) || kw.includes(clean)) return entry.label;
    }
  }
  log(`⚠️ City "${clean}" not matched — defaulting to ${DEFAULT_CITY}`);
  return DEFAULT_CITY;
}

// Clicks the city dropdown and selects by visible text (immune to UUID changes)
async function selectCityByText(page, cityName) {
  const label = resolveCityLabel(cityName);
  await page.locator('#government').click();
  await page.waitForTimeout(800);

  // The open MUI listbox — find the li whose text contains our label
  const listbox = page.locator('ul[role="listbox"]');
  await listbox.waitFor({ timeout: 10000 });

  // Try exact text first, then partial (handles extra text like "سكاكا ( الجوف )")
  const option = listbox.locator(`li:has-text("${label}")`).first();
  await option.waitFor({ timeout: 8000 });
  await option.click();
}

// ════════════════════════════════════════
// PHASE 5 — CREATE ORDERS IN EASY-ORDERS ONE BY ONE
// ════════════════════════════════════════
async function phase5_createOrders(page, orders) {
  log("\n═══════════════════════════════════════");
  log("  PHASE 5 — Creating Orders in Easy-Orders");
  log(`  Total: ${orders.length} orders`);
  log("═══════════════════════════════════════\n");

  const results = { success: 0, failed: 0, failedOrders: [] };

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const orderNum = `[${i + 1}/${orders.length}]`;

    log(`\n${orderNum} Creating order for: ${order.name} | ${order.productName} | qty:${order.qty} | subtotal:${order.subtotal}`);

    try {
      await createSingleOrder(page, order, orderNum);
      results.success++;
      log(`${orderNum} ✅ Order created successfully`);

      // Report progress to UI
      process.send && process.send({
        type: "order-progress",
        current: i + 1,
        total: orders.length,
        success: results.success,
        failed: results.failed,
        lastOrder: { name: order.name, product: order.productName },
      });

    } catch (err) {
      results.failed++;
      log(`${orderNum} ❌ FAILED: ${err.message}`);
      results.failedOrders.push({
        name: order.name,
        product: order.productName,
        phone: "966" + order.normPhone,
        source: order.source || "real",   // "real" or "missed"
        city: order.city || "",
        address: order.address || "",
        qty: order.qty || 1,
        subtotal: order.subtotal || 0,
        error: err.message,
      });

      // Still report progress
      process.send && process.send({
        type: "order-progress",
        current: i + 1,
        total: orders.length,
        success: results.success,
        failed: results.failed,
        lastOrder: { name: order.name, product: order.productName, error: err.message },
      });

      // Navigate back to orders list to reset state before next order
      try {
        // Navigate back to reset React state; next iteration goes straight to /create
        await page.goto("https://app.easy-orders.net/#/orders", { waitUntil: "domcontentloaded" });
      } catch {}
    }

    // Brief pause between orders — server breathing room
    if (i < orders.length - 1) await page.waitForTimeout(800);
  }

  log(`\n✅ Phase 5 done — success:${results.success} failed:${results.failed}`);
  return results;
}

async function createSingleOrder(page, order, orderNum) {
  const MAX_ORDER_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ORDER_ATTEMPTS; attempt++) {
    try {
      await createSingleOrderAttempt(page, order, orderNum, attempt);
      return; // ✅ success
    } catch (err) {
      log(`${orderNum} ⚠️ Attempt ${attempt}/${MAX_ORDER_ATTEMPTS} failed: ${err.message}`);

      if (attempt < MAX_ORDER_ATTEMPTS) {
        log(`${orderNum} 🔄 Reloading page and retrying...`);
        try {
          // Hard reset: go to orders list first to fully clear React state
          await page.goto("https://app.easy-orders.net/#/orders", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2000);
          // Re-login if session was lost during the attempt
          if (page.url().includes("login")) {
            log(`${orderNum} 🔐 Session expired — re-logging in before retry...`);
            await phase1_easyOrdersLogin(page);
          }
        } catch { /* non-fatal — next attempt will handle it */ }
        await page.waitForTimeout(1500);
      } else {
        // All attempts exhausted — rethrow so phase5 records it as failed
        throw err;
      }
    }
  }
}

async function createSingleOrderAttempt(page, order, orderNum, attempt) {
  // ── Resolve address/city ──
  console.log("PARSED CITY:", order.city);
  const finalCity    = (order.city    && order.city.trim())    ? order.city.trim()    : DEFAULT_CITY;
  const finalAddress = (order.address && order.address.trim()) ? order.address.trim() : finalCity;
  console.log("FINAL CITY:", finalCity);

  if (attempt > 1) log(`${orderNum} ↳ [Attempt ${attempt}] city="${finalCity}"`);
  else             log(`${orderNum} ↳ city="${finalCity}" address="${finalAddress}"`);

  // ── 1. Navigate directly to create page ──
  await page.goto("https://app.easy-orders.net/#/orders/create", { waitUntil: "domcontentloaded" });

  // ── Session guard ──
  if (page.url().includes("login")) {
    log(`${orderNum} ⚠️ Easy-Orders session expired — re-logging in...`);
    await phase1_easyOrdersLogin(page);
    await page.goto("https://app.easy-orders.net/#/orders/create", { waitUntil: "domcontentloaded" });
  }

  await page.waitForSelector('button:has-text("Choose Products")', { timeout: 15000 });
  await page.waitForTimeout(800);

  // ── 2. Click "Choose Products" ──
  await page.click('button:has-text("Choose Products")');
  await page.waitForTimeout(1200);

  // ── 3. Search + select product (multi-strategy inside selectProductInModal) ──
  const productSelected = await selectProductInModal(page, order.productName, orderNum);
  if (!productSelected) {
    throw new Error(`Product not found in modal: "${order.productName}"`);
  }

  // ── 4. Click "Add Products" ──
  await page.waitForSelector('button:has-text("Add Products")', { timeout: 8000 });
  await page.click('button:has-text("Add Products")');
  // Wait for modal to close — detected by the qty input appearing
  const qtyInput = page.locator('div[aria-label="Quantity"] input[type="number"]');
  await qtyInput.waitFor({ timeout: 12000 });

  // ── 5. Set quantity ──
  const targetQty      = order.qty      || 1;
  const targetSubtotal = order.subtotal || 0;

  const currentQty = parseInt(await qtyInput.inputValue() || "1");
  if (currentQty !== targetQty) {
    await qtyInput.click({ clickCount: 3 });
    await qtyInput.fill(String(targetQty));
    await page.keyboard.press("Tab");
    await page.waitForTimeout(500);
    log(`${orderNum} ↳ Set qty: ${currentQty} → ${targetQty}`);
  }

  // ── 6. Verify / fix price ──
  const targetUnitPrice = targetSubtotal / targetQty;
  await verifyAndFixPrice(page, targetUnitPrice, targetSubtotal, orderNum);

  // ── 7. Fill customer info ──
  const nameInput = page.locator('input#full_name');
  await nameInput.waitFor({ timeout: 10000 });
  await nameInput.click({ clickCount: 3 });
  await nameInput.fill(order.name || "عميل");

  const phoneInput = page.locator('input#phone');
  await phoneInput.click({ clickCount: 3 });
  await phoneInput.fill("966" + order.normPhone);

  await selectCityByText(page, finalCity);

  const addressInput = page.locator('textarea#address');
  await addressInput.click({ clickCount: 3 });
  await addressInput.fill(finalAddress);

  // ── 9. Final total check before submit ──
  const totalOk = await verifyFinalTotal(page, targetSubtotal, orderNum);
  if (!totalOk) {
    throw new Error(`Total mismatch — expected ${targetSubtotal} SAR, aborting order`);
  }

  // ── 10. Submit ──
  const submitBtn = page.locator('button[type="submit"]:has-text("Submit Order")');
  await submitBtn.waitFor({ timeout: 8000 });
  // Make sure the button is not disabled
  const isDisabled = await submitBtn.isDisabled();
  if (isDisabled) {
    throw new Error("Submit Order button is disabled — form may have validation errors");
  }
  await submitBtn.click();
  await page.waitForTimeout(1000);

  // ── 11. Wait for redirect back to orders list (up to 20s) ──
  const maxWait = 20000;
  const started = Date.now();
  while (Date.now() - started < maxWait) {
    const url = page.url();
    if (url.includes("#/orders") && !url.includes("/create")) {
      return; // ✅ success — page redirected to orders list
    }
    await page.waitForTimeout(600);
  }

  // Still on create page after timeout
  if (page.url().includes("/create")) {
    throw new Error("Order submit timed out — still on create page after 20s");
  }
}

// ════════════════════════════════════════
// PRODUCT SEARCH STRATEGIES
//
// Problem: Easy-Orders search is sensitive to mixed Arabic/English names.
// e.g. "splash بخاخ تقشير القدمين بزيت البرتقال" fails when searched in full
// because the English word "splash" at the start confuses the search index.
//
// Solution: try multiple search queries in order until one returns results.
//   1. Full product name (original)
//   2. Arabic words only (strip English/numbers) — handles mixed names
//   3. First 3 Arabic words — handles long names that get truncated
//   4. Longest single Arabic word — last-resort keyword search
// ════════════════════════════════════════
function buildSearchStrategies(productName) {
  const full = productName.trim();

  // Extract only Arabic words (Unicode Arabic block)
  const arabicWords = full.match(/[\u0600-\u06FF]+/g) || [];

  // Extract only English words
  const englishWords = full.match(/[a-zA-Z]+/g) || [];

  const strategies = [full]; // always try full name first

  if (arabicWords.length > 0) {
    strategies.push(arabicWords.join(" "));            // all Arabic words
    strategies.push(arabicWords.slice(0, 3).join(" ")); // first 3 Arabic words
    if (arabicWords.length > 3) {
      // Longest Arabic word — usually the most distinctive
      const longest = arabicWords.sort((a, b) => b.length - a.length)[0];
      strategies.push(longest);
    }
  }

  if (englishWords.length > 0) {
    strategies.push(englishWords[0]); // just the English brand name e.g. "splash"
  }

  // Deduplicate while preserving order
  return [...new Set(strategies)];
}

async function searchProductInModal(page, query, orderNum) {
  const searchInput = page.locator('input[name="name"]');
  await searchInput.waitFor({ timeout: 10000 });
  await searchInput.click({ clickCount: 3 });

  // Inject value via React synthetic event (same as before)
  await page.evaluate((text) => {
    const el = document.querySelector('input[name="name"]');
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, text);
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, query);

  await page.waitForTimeout(1200); // let React re-render results
}

async function selectProductInModal(page, productName, orderNum) {
  const strategies = buildSearchStrategies(productName);
  log(`${orderNum} 🔍 Product search strategies: ${strategies.map(s => `"${s}"`).join(" → ")}`);

  for (const query of strategies) {
    log(`${orderNum} 🔎 Trying search: "${query}"`);
    await searchProductInModal(page, query, orderNum);

    await page.waitForSelector('table tbody tr', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);

    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    if (count === 0) {
      log(`${orderNum} ↳ No results for "${query}" — trying next strategy`);
      continue;
    }

    // Try to find the best matching row
    const cleanTarget = productName.trim().toLowerCase();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const nameCell = row.locator('td[aria-label="product name"]');
      const cellText = (await nameCell.innerText().catch(() => "")).trim().toLowerCase();

      const isMatch =
        cellText === cleanTarget ||
        cellText.includes(cleanTarget) ||
        cleanTarget.includes(cellText) ||
        wordOverlap(cleanTarget, cellText) >= 0.5; // lowered from 0.6 → more forgiving

      if (isMatch) {
        log(`${orderNum} ✅ Product match via "${query}": "${cellText}"`);
        const checkbox = row.locator('td[aria-label="select"] input[type="checkbox"]');
        await checkbox.click();
        await page.waitForTimeout(300);
        return true;
      }
    }

    // Results exist but no match found — if this is the last strategy, use first result
    const isLastStrategy = query === strategies[strategies.length - 1];
    if (isLastStrategy) {
      log(`${orderNum} ⚠️ No name match — using first result as fallback`);
      const firstIsExpandButton = await rows.first().locator('button[title="Expand variants"]').count();
      const targetRow = firstIsExpandButton > 0 ? rows.nth(1) : rows.first();
      const checkbox = targetRow.locator('td[aria-label="select"] input[type="checkbox"]');
      await checkbox.click();
      await page.waitForTimeout(300);
      return true;
    }

    log(`${orderNum} ↳ Results found but no name match for "${query}" — trying next strategy`);
  }

  // All strategies exhausted with zero results each time
  log(`${orderNum} ❌ Product not found in modal after all search strategies: "${productName}"`);
  return false;
}

function wordOverlap(a, b) {
  const wordsA = new Set(a.split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.split(/\s+/).filter(Boolean));
  let common = 0;
  for (const w of wordsA) if (wordsB.has(w)) common++;
  const total = Math.max(wordsA.size, wordsB.size);
  return total === 0 ? 0 : common / total;
}

async function verifyAndFixPrice(page, targetUnitPrice, targetSubtotal, orderNum) {
  // Read current displayed total
  await page.waitForTimeout(500);

  // Get the edit (pencil) button for price
  const editPriceBtn = page.locator('.MuiInputAdornment-root button').first();

  // Read current total text from the product row
  const currentTotalText = await page.locator('p.MuiTypography-body1').filter({ hasText: "SAR" }).first().innerText().catch(() => "");
  const currentTotal = parseFloat(currentTotalText.replace(/[^\d.]/g, "")) || 0;

  log(`${orderNum} ↳ Price check: current total=${currentTotal} SAR, expected=${targetSubtotal} SAR`);

  if (Math.abs(currentTotal - targetSubtotal) < 0.1) {
    log(`${orderNum} ↳ Price ✅ already correct`);
    return;
  }

  // Price is wrong — click pencil to unlock price field
  log(`${orderNum} ↳ Price mismatch — editing unit price to ${targetUnitPrice} SAR`);
  await editPriceBtn.click();
  await page.waitForTimeout(500);

  // Now the price input should be enabled
  const priceInput = page.locator('input[type="number"][min="0"]').first();
  await priceInput.click({ clickCount: 3 });
  await priceInput.fill(String(targetUnitPrice));
  await page.waitForTimeout(600); // wait for total to recalculate

  // Verify total updated
  const newTotalText = await page.locator('p.MuiTypography-body1').filter({ hasText: "SAR" }).first().innerText().catch(() => "");
  const newTotal = parseFloat(newTotalText.replace(/[^\d.]/g, "")) || 0;
  log(`${orderNum} ↳ After edit: total=${newTotal} SAR`);
}

async function verifyFinalTotal(page, targetSubtotal, orderNum) {
  await page.waitForTimeout(500);
  // Read Products Total from the summary section at bottom
  const totalRows = page.locator('text=/Products Total/').first();
  let totalText = "";
  try {
    const parent = await totalRows.locator("..").innerText();
    const match = parent.match(/([\d.]+)\s*SAR/);
    totalText = match ? match[1] : "";
  } catch {}

  if (!totalText) {
    // Fallback: look for any SAR amount that matches
    const allSarTexts = await page.locator('p:has-text("SAR")').allInnerTexts().catch(() => []);
    for (const t of allSarTexts) {
      const n = parseFloat(t.replace(/[^\d.]/g, ""));
      if (Math.abs(n - targetSubtotal) < 0.1) {
        log(`${orderNum} ↳ Final total verified via fallback: ${n} SAR ✅`);
        return true;
      }
    }
    // Can't verify but proceed anyway with a warning
    log(`${orderNum} ⚠️ Could not read final total — proceeding with submit`);
    return true;
  }

  const actualTotal = parseFloat(totalText);
  if (Math.abs(actualTotal - targetSubtotal) < 0.1) {
    log(`${orderNum} ↳ Final total ✅ ${actualTotal} SAR`);
    return true;
  }

  log(`${orderNum} ❌ Final total mismatch: got ${actualTotal} SAR, expected ${targetSubtotal} SAR`);
  return false;
}

// ════════════════════════════════════════
// MAIN
// ════════════════════════════════════════
(async () => {
  const dateFrom       = parseDate(config.dateFrom);
  const dateTo         = parseDate(config.dateTo);
  const exportFromDate = subtractDay(dateFrom); // -1 day, same as Easy-Orders

  log(`📅 Date range  : ${formatDataDay(dateFrom)} → ${formatDataDay(dateTo)}`);
  log(`📅 Export from : ${formatDataDay(exportFromDate)} (one day before)\n`);

  const profilePath = config.profilePath;
  if (!profilePath) throw new Error("profilePath not set in config — cannot persist sessions");

  if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath, { recursive: true });
    log(`📁 Created profile directory: ${profilePath}`);
  } else {
    log(`📁 Using existing profile: ${profilePath}`);
  }

  const chromePath = findChrome();
  log(`🌐 Using Chrome: ${chromePath}`);

  const context = await chromium.launchPersistentContext(profilePath, {
    executablePath: chromePath,
    headless: false,
    args: ["--start-maximized"],
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.setViewportSize({ width: 1760, height: 1080 });

  // Minimize the Chrome window via CDP if launchMinimized is set
  if (config.launchMinimized) {
    try {
      const cdp = await context.newCDPSession(page);
      const { windowId } = await cdp.send("Browser.getWindowForTarget");
      await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "minimized" } });
      await cdp.detach();
    } catch (e) {
      // CDP minimize failed — not critical, bot continues
      log(`⚠️ Could not minimize Chrome window: ${e.message}`);
    }
  }

  try {
    // Phase 1 — Easy-Orders login (unchanged)
    await phase1_easyOrdersLogin(page);

    // Phase 2 — Real orders export (unchanged)
    const realBuffer = await phase2_realOrders(page, exportFromDate);

    // Phase 3 — Missed orders export (unchanged)
    const missedBuffer = await phase3_missedOrders(page, exportFromDate);

    // Phase 4 — Khod login + export (dedup list)
    // IMPORTANT: khodEndDate is always TODAY, not the user's dateTo.
    // Reason: orders submitted on previous bot runs already exist in Khod under
    // dates AFTER the user's range. If we cap at dateTo we miss them and re-submit.
    const khodEndDate = new Date();            // today at runtime
    const khodBuffer  = await phase4_khod(page, exportFromDate, khodEndDate);

    // ── Parse all sheets ──
    log("\n═══════════════════════════════════════");
    log("  PROCESSING DATA");
    log("═══════════════════════════════════════\n");

    const khodPhones      = parseKhodPhones(khodBuffer);
    const realOrders      = parseRealOrders(realBuffer, dateFrom, dateTo);
    const missedOrders    = parseMissedOrders(missedBuffer, dateFrom, dateTo);
    const catalog         = buildProductCatalog(realOrders);
    const resolvedMissed  = resolveMissedOrders(missedOrders, catalog);
    const { orders, stats } = mergeAndDeduplicate(realOrders, resolvedMissed, khodPhones);

    log(`\n✅ FINAL: ${orders.length} new orders to save`);

    if (orders.length === 0) {
      process.send && process.send({ type: "result", data: { orders: 0, stats, buffer: null, productSummary: [] } });
      return;
    }

    // ── Build output Excel (kept for download / reference) ──
    const outputBuffer = buildOutputExcel(orders);
    log(`✅ Output Excel built: ${outputBuffer.length} bytes`);

    // ── Send preview to dashboard before starting upload ──
    const previewRows = orders.slice(0, 50).map(o => ({
      productName: o.productName || "",
      qty:         o.qty || 1,
      unitPrice:   o.unitPrice || "",
      date:        o.date || "",
      city:        o.city || "",
      region:      o.region || "",
      address:     o.address || "",
      name:        o.name || "",
      phone:       "966" + o.normPhone,
    }));
    process.send && process.send({
      type: "preview",
      rows: previewRows,
      total: orders.length,
      buffer: Array.from(outputBuffer),
    });
    log(`📋 Preview sent to dashboard (${orders.length} orders)`);

    // ── Phase 5 — Create orders one by one in Easy-Orders ──
    // Re-login to Easy-Orders (already logged in from Phase 1, session is still alive)
    await phase1_easyOrdersLogin(page);
    const uploadResults = await phase5_createOrders(page, orders);

    // ── Build product summary ──
    const productMap = {};
    for (const order of orders) {
      const key = order.productName || "Unknown";
      if (!productMap[key]) productMap[key] = { productName: key, count: 0, totalQty: 0 };
      productMap[key].count++;
      productMap[key].totalQty += order.qty || 1;
    }

    // ── Send final result ──
    const failedBuffer = uploadResults.failedOrders.length > 0
      ? buildFailedExcel(uploadResults.failedOrders)
      : null;

    process.send && process.send({
      type: "result",
      data: {
        orders: uploadResults.success,
        stats,
        productSummary: Object.values(productMap),
        buffer: Array.from(outputBuffer),
        failedOrders: {
          count: uploadResults.failed,
          summary: uploadResults.failedOrders,
          errorRows: uploadResults.failedOrders,
          failedDir: "",
          failedPath: "",
          buffer: failedBuffer ? Array.from(failedBuffer) : null,
        },
      },
    });

  } catch (err) {
    log(`❌ FATAL: ${err.message}`);
    process.send && process.send({ type: "error", error: err.message });
  } finally {
    await context.close();
  }
})();