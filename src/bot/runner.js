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
// SESSION HELPERS
// ════════════════════════════════════════

// Returns true if the current page URL looks like a login/auth page.
function isOnLoginPage(url) {
  return (
    url.includes("/login") ||
    url.includes("/auth/login") ||
    url.includes("#/login") ||
    url.includes("/auth")
  );
}

// Takes a debug screenshot and logs its path.  Non-fatal — never throws.
async function debugScreenshot(page, label) {
  try {
    const ts   = Date.now();
    const p    = require("os").tmpdir() + `/kbot-debug-${label}-${ts}.png`;
    await page.screenshot({ path: p, fullPage: false });
    log(`📸 [DEBUG] Screenshot saved: ${p}`);
    process.send && process.send({ type: "debug-screenshot", path: p, label });
  } catch (_) {}
}

// SESSION GUARD
// Wraps any page action.
//  • Catches thrown errors AND checks URL after the action in case the SPA
//    silently redirected to login without raising an exception.
//  • On session loss: re-authenticates and retries the action once.
async function withSessionGuard(page, actionFn, reloginFn, siteName) {
  try {
    const result = await actionFn();
    // Proactive check: even if no error was thrown, verify we're not on the login page
    const urlAfter = page.url();
    if (isOnLoginPage(urlAfter)) {
      log(`⚠️ ${siteName}: action succeeded but page landed on login — SESSION_DESYNC detected`);
      process.send && process.send({ type: "session-event", site: siteName, event: "session-desync-post-action", url: urlAfter });
      await debugScreenshot(page, `${siteName}-desync`);
      await reloginFn();
      log(`🔄 ${siteName}: retrying after re-login (desync recovery)...`);
      return await actionFn();
    }
    return result;
  } catch (err) {
    const url = page.url();
    const isLoggedOut = isOnLoginPage(url);

    if (isLoggedOut) {
      log(`⚠️ ${siteName}: session expired mid-run — re-logging in...`);
      process.send && process.send({ type: "session-event", site: siteName, event: "session-expired", url });
      await debugScreenshot(page, `${siteName}-session-expired`);
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
    "CHROME_NOT_FOUND: Google Chrome is not installed or could not be found on this device.\n" +
    "Please install Google Chrome from https://www.google.com/chrome/ and try again.\n" +
    "If Chrome is installed in a non-standard location, contact support."
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
  const monthNamesEn = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const monthNamesAr = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

  await page.waitForSelector(".react-datepicker", { timeout: 8000 });
  await page.waitForTimeout(300);

  // Detect Hijri calendar and try to switch to Gregorian
  const HIJRI_MONTHS = ["محرم","صفر","ربيع الأول","ربيع الثاني","جمادى الأولى","جمادى الثانية","رجب","شعبان","رمضان","شوال","ذو القعدة","ذو الحجة"];
  const headerText0 = await page.$eval(".react-datepicker__current-month", (el) => el.innerText.trim()).catch(() => "");
  const isHijri = HIJRI_MONTHS.some(hm => headerText0.includes(hm));
  if (isHijri) {
    log("⚠️ Calendar showing Hijri dates — switching to Gregorian (ميلادي)...");
    const toggled = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll("button, span, div"))
        .filter(el => {
          const t = el.innerText || "";
          return t.includes("ميلادي") || t.includes("م") || t.includes("Gregorian");
        });
      if (candidates.length > 0) { candidates[0].click(); return true; }
      return false;
    });
    if (toggled) {
      await page.waitForTimeout(800);
      log("✅ Switched to Gregorian calendar");
    } else {
      log("⚠️ No Gregorian toggle found — will navigate using Arabic month names");
    }
  }

  // Navigate to the correct month — handles both English and Arabic headers
  for (let i = 0; i < 24; i++) {
    const headerText = await page.$eval(".react-datepicker__current-month", (el) => el.innerText.trim()).catch(() => "");
    const parts = headerText.trim().split(/\s+/);

    let shownMonth = monthNamesEn.indexOf(parts[0]);
    if (shownMonth === -1) shownMonth = monthNamesAr.indexOf(parts[0]);

    // Year is the last 4-digit token in the header
    const yearToken = parts.find(p => /^\d{4}$/.test(p));
    const shownYear = yearToken ? parseInt(yearToken) : NaN;

    if (!isNaN(shownYear) && shownYear === targetYear && shownMonth === targetMonth) break;

    const shownTotal  = isNaN(shownYear) ? -1 : shownYear * 12 + shownMonth;
    const targetTotal = targetYear * 12 + targetMonth;

    if (shownTotal === -1 || targetTotal < shownTotal) await page.click(".react-datepicker__navigation--previous");
    else                                                await page.click(".react-datepicker__navigation--next");
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

    // ── Ensure English FIRST — before any selector checks ──
    log(`[NAV] → ${pageUrl}`);
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const landedUrl = page.url();
    log(`[NAV] landed: ${landedUrl} | title: ${await page.title().catch(() => "?")}`);

    // ── Session probe before attempting export ──
    try {
      await assertEasyOrdersSession(page);
    } catch (sessionErr) {
      log(`⚠️ Easy-Orders SESSION_DESYNC before export: ${sessionErr.message}`);
      await debugScreenshot(page, `easy-orders-export-session-fail-${n}`);
      await phase1_easyOrdersLogin(page);
      await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
    }

    const switchedLang = await ensureEasyOrdersEnglish(page);
    if (switchedLang) {
      log("⏳ Language switched — waiting for page to re-render...");
      await page.waitForTimeout(2000);
    }

    // ── FALLBACK: reload page up to 3 times if table or export button not found ──
    let pageReady = false;
    for (let reload = 1; reload <= 3; reload++) {
      try {
        await page.waitForSelector("table", { timeout: 15000 });
        await page.waitForSelector('button:has-text("Export")', { timeout: 15000 });
        pageReady = true;
        break;
      } catch (e) {
        log(`⚠️ Page not ready (reload ${reload}/3): ${e.message}`);
        if (reload < 3) {
          log(`🔄 Reloading page and trying again...`);
          await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(4000);
          // Re-ensure English after reload
          const switched2 = await ensureEasyOrdersEnglish(page);
          if (switched2) await page.waitForTimeout(2000);
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
    await page.waitForTimeout(2000);

    // Build href patterns that distinguish orders vs missed-orders without suffix tricks.
    // Use dash-wrapped strings: "-orders-" never matches "-missed-orders-" files.
    const hrefMustContain    = keyword === "missed-orders" ? "-missed-orders-" : "-orders-";
    const hrefMustNotContain = keyword === "orders"        ? "-missed-orders-" : null;

    for (let i = 1; i <= CHECK_ROUNDS; i++) {
      log(`🔁 Checking notifications (${i}/${CHECK_ROUNDS}) for "${keyword}"...`);
      try {
        const found = await page.evaluate(
          ({ hrefMustContain, hrefMustNotContain }) => {
            // Rows are ordered newest-first — first matching row with chip = correct file
            const rows = Array.from(document.querySelectorAll("tr"));

            for (const row of rows) {
              const links = Array.from(row.querySelectorAll('a[href*=".xlsx"]'));
              if (!links.length) continue;

              // Find a link whose href matches our keyword pattern
              const matchingLink = links.find(a => {
                const href = a.href || "";
                if (!href.includes(hrefMustContain)) return false;
                if (hrefMustNotContain && href.includes(hrefMustNotContain)) return false;
                return true;
              });
              if (!matchingLink) continue;

              // Check for success chip anywhere in this row (chip is sibling of link,
              // not ancestor — so searching the whole row is the correct approach)
              const hasChip = !!row.querySelector(".MuiChip-colorSuccess");

              if (hasChip) {
                return matchingLink.href; // newest ready export for this keyword
              }
              // Row matched keyword but no chip yet — export still processing.
              // Rows are newest-first so stop here, don't check older rows.
              return null;
            }
            return null;
          },
          { hrefMustContain, hrefMustNotContain }
        );
        if (found) { log(`✅ Download URL found: ${found.slice(0, 80)}...`); return found; }
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

  // Navigate to app root — if already logged in it redirects to dashboard/orders
  log(`[NAV] → https://app.easy-orders.net/`);
  await page.goto("https://app.easy-orders.net/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const landedUrl = page.url();
  log(`[NAV] landed: ${landedUrl} | title: ${await page.title().catch(() => "?")}`);

  // ── Session probe on the persisted browser profile ──
  // Even if the URL looks authenticated, verify a real post-auth DOM element
  // before skipping login.  Prevents stale/revoked cookie false positives.
  const alreadyLoggedIn = !landedUrl.includes("login");
  if (alreadyLoggedIn) {
    const authDomPresent = await page.$(
      '.MuiAppBar-root, [aria-label="language-switcher"], nav, .sidebar, [data-testid="user-avatar"]'
    ) !== null;
    if (authDomPresent) {
      log("✅ Easy-orders: already logged in (URL + DOM verified), skipping login\n");
      process.send && process.send({ type: "session-event", site: "easy-orders", event: "session-reused", method: "dom-verified", url: landedUrl });
    } else {
      log("⚠️ Easy-orders: URL looks authenticated but auth DOM not found — SESSION_PROBE failed, re-logging in");
      process.send && process.send({ type: "session-event", site: "easy-orders", event: "session-probe-failed", url: landedUrl });
      await debugScreenshot(page, "easy-orders-probe-fail");
      // Fall through to login block below
      goto_login: {
        await doEasyOrdersLogin(page);
      }
    }
  } else {
    log("🔐 Easy-orders: session expired, logging in...");
    await doEasyOrdersLogin(page);
  }

  // ── Switch to English FIRST — before store selection and everything else ──
  await ensureEasyOrdersEnglish(page);

  // ── Store selection (if user has multiple stores) ──
  await page.waitForTimeout(1500);
  if (page.url().includes("store-selection")) {
    log("🏪 Store selection page detected...");

    const storeName = (config.easyStore || "").trim().toLowerCase();

    if (!storeName) {
      log("⚠️ No store name configured — clicking first store");
      await page.locator('.MuiCard-root').first().click();
    } else {
      log(`🔍 Looking for store: "${config.easyStore}"`);

      const cards = page.locator('.MuiCard-root');
      const count = await cards.count();
      let found   = false;

      for (let i = 0; i < count; i++) {
        const card     = cards.nth(i);
        const nameEl   = card.locator('h6');
        const cardName = (await nameEl.innerText().catch(() => "")).trim().toLowerCase();

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

    await page.waitForFunction(
      () => !window.location.href.includes("store-selection"),
      { timeout: 15000 }
    );
    await page.waitForTimeout(1500);
    log("✅ Store selected\n");

    await ensureEasyOrdersEnglish(page);
  }
}

// ════════════════════════════════════════
// EASY-ORDERS LOGIN — INNER IMPLEMENTATION
// Separated so it can be called from both the "not logged in" and "probe failed" paths.
// ════════════════════════════════════════
async function doEasyOrdersLogin(page) {
  // Navigate to login page
  log(`[NAV] → https://app.easy-orders.net/#/login`);
  await page.goto("https://app.easy-orders.net/#/login", { waitUntil: "domcontentloaded" });

  // SPA needs time to mount the login form — wait for the actual input, not just DOM ready
  try {
    await page.waitForSelector('#username', { timeout: 15000 });
  } catch {
    log("⚠️ Login form didn't mount — reloading...");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('#username', { timeout: 15000 });
  }

  await page.waitForTimeout(800);

  try {
    await page.fill('#username', '');
    await page.waitForTimeout(200);
    await page.fill('#username', config.easyEmail);
    await page.waitForTimeout(400);

    await page.fill('#password', '');
    await page.waitForTimeout(200);
    await page.fill('#password', config.easyPassword);
    await page.waitForTimeout(500);

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.waitFor({ state: "visible", timeout: 5000 });
    const isDisabled = await submitBtn.isDisabled().catch(() => false);
    if (isDisabled) {
      log("⚠️ Submit button is disabled — waiting for it to enable...");
      await page.waitForFunction(
        () => !document.querySelector('button[type="submit"]')?.disabled,
        { timeout: 8000 }
      );
    }

    await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]');
      if (btn) btn.click();
    });
    await page.waitForTimeout(2000);

    // Log submission — note: this only means the form was submitted, NOT that login succeeded
    log("✅ Easy-orders: credentials SUBMITTED (awaiting server confirmation...)");
  } catch (e) {
    log(`⚠️ Easy-orders login form error: ${e.message}`);
  }

  // 2FA signal + wait loop
  process.send && process.send({ type: "2fa-needed" });
  log("⏳ If 2FA is required, complete it in the browser (5 min max)...");

  const maxWait = 5 * 60 * 1000;
  const started = Date.now();
  let confirmed = false;

  while (Date.now() - started < maxWait) {
    await page.waitForTimeout(3000);
    const currentUrl   = page.url();
    const currentTitle = await page.title().catch(() => "");
    log(`[NAV] ${Math.round((Date.now() - started) / 1000)}s — url: ${currentUrl} | title: ${currentTitle}`);

    if (!currentUrl.includes("login")) {
      // URL moved off login — now perform DOM verification before declaring success
      const authDomPresent = await page.$(
        '.MuiAppBar-root, [aria-label="language-switcher"], nav, .sidebar'
      ) !== null;
      if (authDomPresent) {
        confirmed = true;
        log(`✅ Easy-orders: login CONFIRMED (URL + DOM verified) — url: ${currentUrl} | title: ${currentTitle}`);
        process.send && process.send({ type: "session-event", site: "easy-orders", event: "login-confirmed", method: "dom-verified", url: currentUrl });
        await debugScreenshot(page, "easy-orders-login-confirmed");
        break;
      }
      log(`⏳ URL left login but auth DOM not yet present — waiting for SPA hydration...`);
    }
  }

  if (!confirmed) {
    await debugScreenshot(page, "easy-orders-login-timeout");
    throw new Error("Easy-orders login timeout after 5 minutes");
  }
  log("✅ Easy-orders login confirmed\n");
}

// ════════════════════════════════════════
// SWITCH EASY-ORDERS TO ENGLISH
// Must run BEFORE any export/navigation that depends on English button text.
// Called immediately after login (and after store selection if applicable).
// Returns true if a language switch was performed (caller may want to re-wait for render).
// ════════════════════════════════════════
async function ensureEasyOrdersEnglish(page) {
  try {
    // If switcher not in DOM yet (slow client), retry up to 3 times with short waits
    let langLabel = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      langLabel = await page.$eval(
        '[aria-label="language-switcher"] p',
        (el) => el.innerText.trim()
      ).catch(() => null);

      if (langLabel !== null) break;
      if (attempt < 2) {
        log(`⏳ Language switcher not found yet (attempt ${attempt + 1}/3) — waiting...`);
        await page.waitForTimeout(1500);
      }
    }

    if (langLabel === null) {
      log("⚠️ Language switcher not found after retries — continuing anyway");
      return false;
    }

    if (langLabel !== "en") {
      log("🌐 Easy-orders switched to non-English — forcing English...");
      await page.click('[aria-label="language-switcher"]');
      await page.waitForTimeout(800);
      const clicked =
        await page.locator('[role="menuitem"][aria-label="english"]').click().then(() => true).catch(() => false) ||
        await page.locator('[role="menuitem"]:has-text("English")').click().then(() => true).catch(() => false) ||
        await page.locator('[role="menuitem"]:has-text("en")').click().then(() => true).catch(() => false);
      if (clicked) {
        await page.waitForTimeout(1500);
        log("✅ Switched back to English");
        return true; // caller should re-wait for page re-render
      } else {
        log("⚠️ Could not find English menu item — continuing anyway");
        await page.keyboard.press("Escape");
      }
    }
  } catch (e) {
    log(`⚠️ Language check error: ${e.message}`);
  }
  return false;
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
  log(`[NAV] → https://khod-whaat.com/affiliate/auth/login`);
  await page.goto("https://khod-whaat.com/affiliate/auth/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const landedUrl   = page.url();
  const landedTitle = await page.title().catch(() => "?");
  log(`[NAV] landed: ${landedUrl} | title: ${landedTitle}`);

  // ── SESSION PROBE — verify URL + DOM before skipping login ──
  // URL check alone is unreliable: a stale/expired cookie in the persistent profile
  // can redirect away from /auth/login momentarily before the server invalidates it.
  const urlLooksAuthenticated = !landedUrl.includes("/auth/login") && !landedUrl.includes("/login");
  if (urlLooksAuthenticated) {
    const authDomPresent = await page.$(
      '.affiliate-orders, .sidebar, nav, [data-user], .user-info, .affiliate-header, [data-affiliate-id], main'
    ) !== null;
    if (authDomPresent) {
      log("✅ Khod: already logged in (URL + DOM verified)");
      process.send && process.send({ type: "session-event", site: "khod", event: "session-reused", method: "dom-verified", url: landedUrl });
      return;
    }
    // URL moved but no auth DOM — stale cookie / redirect loop
    log("⚠️ Khod: URL looks authenticated but auth DOM not found — SESSION_PROBE failed, re-logging in");
    process.send && process.send({ type: "session-event", site: "khod", event: "session-probe-failed", url: landedUrl });
    await debugScreenshot(page, "khod-probe-fail");
    // Clear sessionStorage to evict any stale client-side auth state
    await page.evaluate(() => { try { sessionStorage.clear(); } catch (_) {} });
    // Navigate to login page explicitly
    await page.goto("https://khod-whaat.com/affiliate/auth/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
  }

  const method = config.khodLoginMethod || "email";
  log(`🔐 Khod: logging in via ${method}...`);

  // ── Fill credentials with reload fallback ──
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
      // Log SUBMISSION separately from CONFIRMATION
      log("✅ Khod: credentials SUBMITTED (awaiting server confirmation...)");
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
    const currentUrl   = page.url();
    const currentTitle = await page.title().catch(() => "");
    log(`[NAV] ${Math.round((Date.now() - started) / 1000)}s — url: ${currentUrl} | title: ${currentTitle}`);

    const urlOffLogin = !currentUrl.includes("/login") && !currentUrl.includes("/auth");
    if (urlOffLogin) {
      // DOM-verify: look for any authenticated element before declaring success
      const authDomPresent = await page.$(
        '.affiliate-orders, .sidebar, nav, main, [data-user], .user-info'
      ) !== null;
      if (authDomPresent) {
        confirmed = true;
        log(`✅ Khod: login CONFIRMED (URL + DOM verified) — url: ${currentUrl} | title: ${currentTitle}`);
        process.send && process.send({ type: "session-event", site: "khod", event: "login-confirmed", method: "dom-verified", url: currentUrl });
        await debugScreenshot(page, "khod-login-confirmed");
        break;
      }
      // URL moved but SPA hasn't hydrated yet — keep waiting
      log(`⏳ URL left login but auth DOM not yet present — waiting for SPA hydration...`);
    }
  }

  if (!confirmed) {
    await debugScreenshot(page, "khod-login-timeout");
    throw new Error("Khod login timeout after 5 minutes");
  }
  log("✅ Khod login confirmed");
}

// ════════════════════════════════════════
// SESSION PROBE — KHOD
// Asserts the page is in an authenticated state.
// Throws SESSION_DESYNC if the URL or DOM indicates the session is gone.
// ════════════════════════════════════════
async function assertKhodSession(page) {
  const url = page.url();
  if (isOnLoginPage(url)) {
    throw new Error(`SESSION_EXPIRED: on login page (${url})`);
  }
  // DOM-verify: look for any known post-auth element
  const authDomPresent = await page.$(
    '.affiliate-orders, .sidebar, nav, main, [data-user], .user-info'
  ) !== null;
  if (!authDomPresent) {
    const title = await page.title().catch(() => "");
    throw new Error(`SESSION_UNVERIFIED: URL ok (${url}) but no auth DOM found | title: "${title}"`);
  }
}

async function khodExportAttempt(page, exportFromDate, dateTo, attemptNum) {
  log(`\n🔄 Khod export attempt ${attemptNum}/${MAX_KHOD_ATTEMPTS}`);

  // ── Navigate to orders list with fallback reload ──
  log("🌐 Loading Khod orders page...");
  let pageLoaded = false;
  for (let reload = 1; reload <= 3; reload++) {
    try {
      log(`[NAV] → https://khod-whaat.com/affiliate/orders/list/all`);
      await page.goto("https://khod-whaat.com/affiliate/orders/list/all", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);

      const landedUrl = page.url();
      log(`[NAV] landed: ${landedUrl} | title: ${await page.title().catch(() => "?")}`);

      // ── Session probe: URL + DOM check before loading protected resources ──
      // This runs BEFORE waitForSelector so we get a meaningful error, not
      // a cryptic "date picker not found" when the real issue is a lost session.
      try {
        await assertKhodSession(page);
        process.send && process.send({ type: "session-event", site: "khod", event: "session-probe-ok", url: landedUrl });
      } catch (sessionErr) {
        log(`🔐 Khod SESSION_DESYNC before export attempt: ${sessionErr.message}`);
        process.send && process.send({ type: "session-event", site: "khod", event: "session-probe-failed", url: landedUrl, error: sessionErr.message });
        await debugScreenshot(page, `khod-export-session-fail-${attemptNum}`);
        await khodLogin(page);
        log(`[NAV] → https://khod-whaat.com/affiliate/orders/list/all (post re-login)`);
        await page.goto("https://khod-whaat.com/affiliate/orders/list/all", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(3000);
      }

      // ── Wait for date input to appear ──
      log("⌛ Waiting for date filter input...");
      try {
        await page.waitForSelector("#from_date + input", { timeout: 20000 });
      } catch (selectorErr) {
        // Before surfacing as a generic timeout, check if this is a session issue
        const isSession = isOnLoginPage(page.url()) ||
          (await page.$('input[name="email"], input[name="phone"]') !== null);
        if (isSession) {
          log(`🔐 Date picker missing — actually a session loss (URL: ${page.url()})`);
          await debugScreenshot(page, `khod-datepicker-session-fail-${attemptNum}`);
          await khodLogin(page);
          await page.goto("https://khod-whaat.com/affiliate/orders/list/all", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(3000);
          await page.waitForSelector("#from_date + input", { timeout: 20000 });
        } else {
          await debugScreenshot(page, `khod-datepicker-missing-${attemptNum}`);
          throw selectorErr;
        }
      }

      pageLoaded = true;
      break;
    } catch (e) {
      log(`⚠️ Khod orders page not ready (reload ${reload}/3): ${e.message}`);
      if (reload < 3) {
        log(`🔄 Reloading Khod orders page...`);
        await page.waitForTimeout(4000);
      } else {
        await debugScreenshot(page, `khod-orders-page-fail-${attemptNum}`);
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

  // ── Ensure Arabic language is active BEFORE any export attempt ──
  // We always navigate to /lang/sa first — this is idempotent (safe if already Arabic)
  // and eliminates the selector-based language detection which fails on some client machines.
  log("🌐 Khod: ensuring Arabic language is active...");
  try {
    await page.goto("https://khod-whaat.com/lang/sa", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    log("✅ Khod: Arabic language confirmed");
  } catch (e) {
    log(`⚠️ Khod: language set failed (non-fatal): ${e.message} — continuing`);
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

        // Always re-set Arabic after a re-login or page reload
        try {
          await page.goto("https://khod-whaat.com/lang/sa", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2000);
          log("🌐 Khod: Arabic language re-confirmed before next attempt");
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
// SESSION PROBE — EASY-ORDERS
// ════════════════════════════════════════
async function assertEasyOrdersSession(page) {
  const url = page.url();
  if (url.includes("login")) {
    throw new Error(`SESSION_EXPIRED: on login page (${url})`);
  }
  const authDomPresent = await page.$(
    '.MuiAppBar-root, [aria-label="language-switcher"], nav'
  ) !== null;
  if (!authDomPresent) {
    const title = await page.title().catch(() => "");
    throw new Error(`SESSION_UNVERIFIED: URL ok (${url}) but no auth DOM found | title: "${title}"`);
  }
}
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
  log(`[NAV] → https://app.easy-orders.net/#/orders/create`);
  await page.goto("https://app.easy-orders.net/#/orders/create", { waitUntil: "domcontentloaded" });

  // ── Session probe: DOM-verified check before loading any protected selectors ──
  try {
    await assertEasyOrdersSession(page);
  } catch (sessionErr) {
    log(`⚠️ Easy-Orders ${orderNum} SESSION_DESYNC: ${sessionErr.message}`);
    process.send && process.send({ type: "session-event", site: "easy-orders", event: "session-probe-failed", url: page.url(), error: sessionErr.message });
    await debugScreenshot(page, `easy-orders-session-fail`);
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

  // ════════════════════════════════════════════════════════════════
  // CHROME LAUNCH — REAL BROWSER MODE
  //
  // TASK 1 ✅ Remove --enable-automation (Playwright injects it by default)
  //           Done via ignoreDefaultArgs — this alone causes the banner.
  //
  // TASK 2 ✅ Remove --disable-blink-features=AutomationControlled
  //           Tells Chrome to hide the automation flag in Blink engine.
  //
  // TASK 3 ✅ Remove ALL flags that trigger "unsupported command-line flag" banner:
  //           --no-sandbox           → triggers warning in Chrome 120+
  //           --disable-dev-shm-usage → Linux-only, triggers on Windows
  //           --disable-extensions    → conflicts + triggers banner
  //           --use-mock-keychain     → macOS-only, triggers on Windows
  //           --password-store=basic  → triggers on newer Chrome
  //           --metrics-recording-only → deprecated, triggers warning
  //           --no-service-autorun    → deprecated, triggers warning
  //           --disable-extensions-except= → conflicts with real Chrome
  //
  // TASK 4 ✅ Keep only flags that real Chrome uses silently with no banners.
  //
  // TASK 5 ✅ Spoof navigator.webdriver + plugins via addInitScript so
  //           bot-detection JS on websites sees a real browser fingerprint.
  // ════════════════════════════════════════════════════════════════

  const context = await chromium.launchPersistentContext(profilePath, {
    executablePath: chromePath,
    headless: false,

    // Stop Playwright injecting --enable-automation (causes "controlled" banner)
    ignoreDefaultArgs: ["--enable-automation"],

    // Stop Playwright injecting --no-sandbox automatically.
    // Playwright source: if (options.chromiumSandbox !== true) push("--no-sandbox")
    // --no-sandbox triggers "unsupported command-line flag" warning in Chrome 120+
    chromiumSandbox: true,

    args: [
      // ── Startup behaviour (all safe, no banners) ──
      "--no-first-run",
      "--no-default-browser-check",

      // ── Hide automation traces ──
      // NOTE: --disable-blink-features=AutomationControlled and --exclude-switches=enable-automation
      // are removed — they trigger the "unsupported command-line flag" banner in real Chrome.
      // Automation is hidden via addInitScript (navigator.webdriver spoof) below instead.

      // ── Performance / stability (safe, no banners) ──
      "--disable-background-networking",
      "--disable-client-side-phishing-detection",
      "--disable-default-apps",
      "--disable-hang-monitor",
      "--disable-popup-blocking",
      "--disable-prompt-on-repost",
      "--disable-sync",
      "--disable-translate",

      // ── Startup speed improvements ──
      // Limit disk cache to 50 MB — bot uses very few unique URLs, large cache wastes init time
      "--disk-cache-size=52428800",
      // Skip checking for Chrome updates on launch (saves ~200ms on first run)
      "--no-pings",
      // Disable background tab throttling — keeps bot pages responsive
      "--disable-background-timer-throttling",
      // Disable renderer backgrounding — prevents Playwright pages from being throttled
      "--disable-renderer-backgrounding",
      // Skip loading unused component extensions on startup
      "--disable-component-extensions-with-background-pages",
      // Faster V8 startup: skip idle GC tasks during launch
      "--disable-v8-idle-tasks",

      // ── Display (safe, no banners) ──
      "--force-device-scale-factor=1",
      "--window-size=1400,900",

      // ── Locale — force Gregorian calendar dates on Arabic OS (safe) ──
      "--lang=en-US",
      "--accept-lang=en-US,en",
    ],

    locale: "en-US",
    waitForInitialPage: false,
  });

  // ── TASK 5: Spoof browser fingerprint on every page before any JS runs ──
  // Hides all Playwright/automation traces from website bot-detection scripts.
  await context.addInitScript(() => {
    // Hide the webdriver flag (set by all automation tools)
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });

    // Remove Playwright-specific window globals
    delete window.__playwright;
    delete window.__pw_manual;
    delete window.__PW_inspect;

    // Real Chrome always has plugins — empty array = detected as bot
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });

    // Real Chrome reports languages — missing = detected as bot
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
  });

  const page = context.pages()[0] || (await context.newPage());
  page.setViewportSize({ width: 1400, height: 900 }).catch(() => {});

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