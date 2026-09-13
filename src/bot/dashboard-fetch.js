"use strict";

const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");
const {
  addChromeFingerprintSpoofing,
  getOrCreateAutomationPage,
  installUnexpectedBlankPageGuard,
  launchPersistentChromeContext,
} = require("./chrome-launch");
const { formatDataDay, resolveSafeKhodExportRange } = require("./khod-date-range");

const config = JSON.parse(process.env.BOT_CONFIG || "{}");
const log = (message) => process.stdout.write(String(message || "") + "\n");
const emitStage = (stage, status, message, extra = {}) => {
  if (process.send) process.send({ type: "stage", flow: "dashboard", stage, status, message, ...extra });
};

const LOGIN_URL = "https://khod-whaat.com/affiliate/auth/login";
const ORDERS_URL = "https://khod-whaat.com/affiliate/orders/list/all";
const LANGUAGE_URL = "https://khod-whaat.com/lang/sa";
const DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_EXPORT_ATTEMPTS = 3;
const RETRY_WAIT_SECONDS = 6 * 60;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function findChrome() {
  const { execSync } = require("child_process");
  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe"),
    ].filter(Boolean);
    for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
    try { return execSync("where chrome", { encoding: "utf8" }).trim().split(/\r?\n/)[0]; } catch (_) {}
  } else if (process.platform === "darwin") {
    const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    if (fs.existsSync(chrome)) return chrome;
  } else {
    try { return execSync("which google-chrome || which chromium-browser || which chromium", { encoding: "utf8" }).trim().split(/\r?\n/)[0]; } catch (_) {}
  }
  throw new Error("Chrome not found - install Google Chrome and try again.");
}

function parseConfigDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(date) {
  if (!date || isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizedEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizedCode(value) {
  return String(value || "").replace(/[^\dA-Za-z_-]/g, "").trim();
}

function isLoginUrl(url) {
  return String(url || "").includes("/login") || String(url || "").includes("/auth");
}

function isNetworkError(error) {
  const message = String(error && error.message || error || "").toLowerCase();
  return message.includes("err_connection") || message.includes("net::") || message.includes("timeout");
}

function isBrowserClosedError(error) {
  const message = String(error && error.message || error || "");
  const lower = message.toLowerCase();
  return message.includes("Target page, context or browser has been closed") ||
    lower.includes("target closed") ||
    lower.includes("page closed") ||
    lower.includes("browser has been closed") ||
    lower.includes("browser closed");
}

function dashboardAccountClosedMessage() {
  return "DASHBOARD_ACCOUNT_BROWSER_CLOSED: Chrome was closed for this account. Skipping to the next account.";
}

async function gotoWithRetries(page, url, label, options = {}) {
  const attempts = options.attempts || 3;
  const timeout = options.timeout || 45000;
  const waitMs = options.waitMs || 5000;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      log(`[NAV] -> ${url}${attempt > 1 ? ` (retry ${attempt}/${attempts})` : ""}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });
      return;
    } catch (error) {
      if (!isNetworkError(error) || attempt >= attempts) throw error;
      log(`Network issue while loading ${label}: ${error.message}; retrying in ${Math.round(waitMs / 1000)}s`);
      await page.waitForTimeout(waitMs);
    }
  }
}

async function loginFormVisible(page) {
  return page.locator('input[type="password"], input[name="email"], input[name="phone"]').first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);
}

async function khodAuthDomPresent(page) {
  return page.evaluate(() => {
    const specific = [
      'a[href*="/affiliate/orders"]',
      'a[href*="/affiliate/statistics"]',
      '[class*="affiliate-header"]',
      '[data-affiliate-id]',
      '[data-user]',
      '.user-dropdown',
      '[class*="welcome"]',
      'a[href*="statistics"]',
      'header a[href]:not([href*="login"]):not([href*="auth"])',
    ];
    return specific.some((selector) => document.querySelector(selector) !== null);
  }).catch(() => false);
}

async function assertKhodSession(page) {
  const url = page.url();
  if (isLoginUrl(url) || await loginFormVisible(page)) {
    throw new Error(`SESSION_EXPIRED: on login page (${url})`);
  }
  if (!(await khodAuthDomPresent(page))) {
    const title = await page.title().catch(() => "");
    throw new Error(`SESSION_UNVERIFIED: URL ok (${url}) but no auth DOM found | title: "${title}"`);
  }
}

async function openKhodAccountDropdown(page, where) {
  const triggerSelectors = [
    '[data-hs-unfold-target="#accountNavbarDropdown"]',
    '[aria-controls="accountNavbarDropdown"]',
    '.navbar-dropdown-account-wrapper',
    '.navbar-dropdown-account-wrapper a',
    '.navbar-dropdown-account-wrapper button',
    '.js-hs-unfold-invoker',
    'button.dropdown-toggle',
    'a.dropdown-toggle',
    '[data-bs-toggle="dropdown"]',
    '[data-toggle="dropdown"]',
  ];
  for (const selector of triggerSelectors) {
    const trigger = page.locator(selector).first();
    const count = await trigger.count().catch(() => 0);
    if (!count) continue;
    const visible = await trigger.isVisible({ timeout: 800 }).catch(() => false);
    log(`[IDENTITY][KHOD WHAAT Dashboard] dropdown candidate selector=${selector}, visible=${visible ? "yes" : "no"}, where=${where}`);
    if (visible) {
      await trigger.click({ timeout: 2500 }).catch(async () => trigger.click({ timeout: 2500, force: true }).catch(() => {}));
      await page.waitForTimeout(500);
      return true;
    }
    await trigger.click({ timeout: 2500, force: true }).catch(() => {});
    await page.waitForTimeout(500);
    return true;
  }
  log(`[IDENTITY][KHOD WHAAT Dashboard] dropdown trigger not found, where=${where}`);
  return false;
}

async function assertKhodIdentity(page, where) {
  const expectedEmail = normalizedEmail(config.khodEmail || config.khod_email);
  const expectedCode = normalizedCode(config.khodAffiliateCode || config.khod_affiliate_code);
  if (!expectedEmail) throw new Error("KHOD_IDENTITY_CONFIG_MISSING: khodEmail is not set");

  await openKhodAccountDropdown(page, where);

  const identity = await page.evaluate(() => {
    const roots = [document.querySelector("#accountNavbarDropdown"), document.body].filter(Boolean);
    let matchedText = "";
    let email = "";
    for (const root of roots) {
      const text = root.innerText || root.textContent || "";
      const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (match && match[0]) {
        matchedText = text;
        email = match[0];
        break;
      }
      if (!matchedText && text) matchedText = text;
    }
    const text = matchedText || "";
    const codeMatch = text.match(/(?:\u0643\u0648\u062f|code)\s*:?\s*([0-9A-Za-z_-]+)/i);
    return { email: email.trim().toLowerCase(), affiliateCode: codeMatch ? codeMatch[1].trim() : "" };
  });

  const actualEmail = normalizedEmail(identity.email);
  const actualCode = normalizedCode(identity.affiliateCode);
  log(`[IDENTITY][KHOD WHAAT Dashboard] expected email=${expectedEmail}, detected email=${actualEmail || "unknown"}, detected code=${actualCode || "unknown"}, where=${where}`);
  if (actualEmail !== expectedEmail) throw new Error(`KHOD_IDENTITY_MISMATCH: expected email "${expectedEmail}", detected "${actualEmail || "unknown"}"`);
  if (expectedCode && actualCode && actualCode !== expectedCode) throw new Error(`KHOD_IDENTITY_MISMATCH: expected affiliate code "${expectedCode}", detected "${actualCode}"`);
  if (process.send) process.send({ type: "session-event", site: "khod", event: "identity-verified", email: actualEmail, affiliateCode: actualCode, where });
}

function isKhodIdentityFailure(error) {
  const message = String(error && error.message || error || "");
  return message.includes("KHOD_IDENTITY_MISMATCH") || message.includes("KHOD_IDENTITY_UNVERIFIED");
}

function isKhodSessionFailure(error) {
  const message = String(error && error.message || error || "");
  return message.includes("SESSION_EXPIRED") || message.includes("SESSION_UNVERIFIED");
}

async function resetKhodSession(context, page, reason) {
  log(`KHOD WHAAT reused session failed identity check (${reason}). Clearing KHOD WHAAT session and logging in again.`);
  await context.clearCookies().catch(() => {});
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await page.evaluate(() => {
    try { localStorage.clear(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
  }).catch(() => {});
  await gotoWithRetries(page, LOGIN_URL, "KHOD WHAAT login after session reset", { attempts: 2, timeout: 30000, waitMs: 2500 });
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
}

async function ensureKhodArabic(page, where) {
  try {
    await gotoWithRetries(page, LANGUAGE_URL, "KHOD WHAAT language", { attempts: 2, timeout: 30000, waitMs: 2500 });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    log(`KHOD WHAAT Arabic language confirmed (${where})`);
  } catch (error) {
    log(`KHOD WHAAT language confirmation skipped (${where}): ${error.message}`);
  }
}

async function khodLogin(context, page) {
  emitStage("khod.login", "started", "Logging into KHOD WHAAT");
  await gotoWithRetries(page, LOGIN_URL, "KHOD WHAAT login");
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

  const landedUrl = page.url();
  const landedTitle = await page.title().catch(() => "");
  log(`[NAV] landed: ${landedUrl} | title: ${landedTitle}`);

  if (!isLoginUrl(landedUrl) && !(await loginFormVisible(page))) {
    if (await khodAuthDomPresent(page)) {
      log("KHOD WHAAT session reused after URL and DOM verification");
      if (process.send) process.send({ type: "session-event", site: "khod", event: "session-reused", method: "dom-verified", url: landedUrl });
      emitStage("khod.login", "ok", "KHOD WHAAT session confirmed");
      return page;
    }
    await resetKhodSession(context, page, `SESSION_UNVERIFIED: URL ok (${landedUrl}) but no auth DOM found`);
  }

  const email = config.khodEmail || config.khod_email || "";
  const password = config.khodPassword || config.khod_password || "";
  if (!email || !password) throw new Error("KHOD WHAAT credentials missing for this account.");

  const emailSelectors = ['input[type="email"]', 'input[name="email"]', 'input[placeholder*="email" i]', 'input[placeholder*="\u0628\u0631\u064a\u062f" i]'];
  let passwordInput = null;
  for (const selector of emailSelectors) {
    const input = page.locator(selector).first();
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await input.fill(email);
      passwordInput = page.locator('input[type="password"], input[name="password"]').first();
      await passwordInput.fill(password);
      break;
    }
  }
  if (!passwordInput) throw new Error("KHOD WHAAT login form was not found.");

  const submitSelectors = ['button[type="submit"]', 'button:has-text("\u062f\u062e\u0648\u0644")', 'button:has-text("Login")', 'button:has-text("\u062a\u0633\u062c\u064a\u0644")', 'input[type="submit"]'];
  let submitted = false;
  for (const selector of submitSelectors) {
    const submit = page.locator(selector).first();
    if (await submit.isVisible({ timeout: 1500 }).catch(() => false)) {
      await submit.click({ noWaitAfter: true });
      submitted = true;
      break;
    }
  }
  if (!submitted) await passwordInput.press("Enter");

  const started = Date.now();
  while (Date.now() - started < 5 * 60 * 1000) {
    await page.waitForTimeout(2500);
    const currentUrl = page.url();
    if (!isLoginUrl(currentUrl) && !(await loginFormVisible(page))) {
      await page.waitForTimeout(1500);
      if (!(await khodAuthDomPresent(page))) {
        log(`KHOD WHAAT URL left login but auth DOM is not ready yet: ${currentUrl}`);
        continue;
      }
      log(`KHOD WHAAT login confirmed after URL and DOM verification: ${currentUrl}`);
      if (process.send) process.send({ type: "session-event", site: "khod", event: "login-confirmed", method: "dom-verified", url: currentUrl });
      emitStage("khod.login", "ok", "KHOD WHAAT login confirmed");
      return page;
    }
    const errorText = await page.locator(".invalid-feedback, .text-danger, .alert-danger, .alert").first().innerText({ timeout: 1000 }).catch(() => "");
    if (errorText) throw new Error(`KHOD WHAAT login rejected: ${errorText.trim()}`);
  }
  throw new Error("KHOD WHAAT login timeout after 5 minutes.");
}

function flatpickrLabel(date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

async function navigateFlatpickr(page, targetDate) {
  for (let i = 0; i < 24; i++) {
    const month = await page.$eval(".flatpickr-calendar.open .flatpickr-monthDropdown-months", (el) => parseInt(el.value, 10)).catch(() => -1);
    const year = await page.$eval(".flatpickr-calendar.open .numInput.cur-year", (el) => parseInt(el.value, 10)).catch(() => -1);
    if (month === targetDate.getMonth() && year === targetDate.getFullYear()) return;
    const selector = targetDate.getFullYear() * 12 + targetDate.getMonth() < year * 12 + month
      ? ".flatpickr-calendar.open .flatpickr-prev-month"
      : ".flatpickr-calendar.open .flatpickr-next-month";
    await page.click(selector);
    await page.waitForTimeout(250);
  }
}

async function pickDateRange(page, from, to) {
  emitStage("khod.orders.filter", "started", `Selecting ${formatDataDay(from)} to ${formatDataDay(to)}`);
  await page.locator("#from_date + input").click({ timeout: 10000 }).catch(async () => page.locator("#from_date + input").click({ force: true }));
  await page.waitForSelector(".flatpickr-calendar.open", { timeout: 10000 });
  await navigateFlatpickr(page, from);
  const fromSelector = `span.flatpickr-day[aria-label="${flatpickrLabel(from)}"]:not(.prevMonthDay):not(.nextMonthDay)`;
  await page.locator(fromSelector).click({ timeout: 5000 }).catch(async () => page.locator(fromSelector).click({ force: true }));
  if (from.getMonth() !== to.getMonth() || from.getFullYear() !== to.getFullYear()) await navigateFlatpickr(page, to);
  const toSelector = `span.flatpickr-day[aria-label="${flatpickrLabel(to)}"]:not(.prevMonthDay):not(.nextMonthDay)`;
  await page.locator(toSelector).click({ timeout: 5000 }).catch(async () => page.locator(toSelector).click({ force: true }));
  await page.keyboard.press("Escape").catch(() => {});
}

async function waitForOrdersPage(context, page, attempt) {
  for (let reload = 1; reload <= 3; reload++) {
    try {
      await gotoWithRetries(page, ORDERS_URL, `KHOD WHAAT orders page ${reload}`, { attempts: 2, timeout: 45000, waitMs: 3000 });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      try {
        await assertKhodSession(page);
        await assertKhodIdentity(page, `orders-page-${attempt}`);
      } catch (sessionError) {
        if (!isKhodSessionFailure(sessionError) && !isKhodIdentityFailure(sessionError)) throw sessionError;
        log(`KHOD WHAAT session/identity probe failed before export: ${sessionError.message}. Re-logging in.`);
        if (process.send) process.send({ type: "session-event", site: "khod", event: "session-probe-failed", url: page.url(), error: sessionError.message });
        page = await khodLogin(context, page);
        await gotoWithRetries(page, ORDERS_URL, "KHOD WHAAT orders page after re-login", { attempts: 2, timeout: 45000, waitMs: 3000 });
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
        await assertKhodSession(page);
        await assertKhodIdentity(page, `orders-page-${attempt}-post-login`);
      }
      await page.waitForSelector("#from_date + input", { timeout: 20000 });
      return page;
    } catch (error) {
      log(`KHOD WHAAT orders page not ready (${reload}/3): ${error.message}`);
      if (reload >= 3) throw new Error(`KHOD WHAAT orders page failed to load: ${error.message}`);
      await page.waitForTimeout(3000);
    }
  }
  return page;
}

async function clickFirstVisible(page, selectors, label) {
  for (const selector of selectors) {
    const item = page.locator(selector).first();
    if (await item.isVisible({ timeout: 1500 }).catch(() => false)) {
      await item.click({ noWaitAfter: true });
      log(`${label} clicked via ${selector}`);
      return true;
    }
  }
  return false;
}

async function downloadToBuffer(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  await new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  return Buffer.concat(chunks);
}

async function exportKhodOrders(context, page, from, to) {
  await ensureKhodArabic(page, "before-export");
  let lastError = null;
  const ensurePage = async () => {
    if (page && !page.isClosed()) return page;
    throw new Error(dashboardAccountClosedMessage());
  };
  const openFreshPage = async () => {
    page = await context.newPage();
    await page.setViewportSize({ width: 1400, height: 900 }).catch(() => {});
    return page;
  };

  for (let attempt = 1; attempt <= MAX_EXPORT_ATTEMPTS; attempt++) {
    try {
      page = await ensurePage();
      emitStage("khod.orders.export", "started", `Export attempt ${attempt}/${MAX_EXPORT_ATTEMPTS}`);
      log(`KHOD WHAAT dashboard export attempt ${attempt}/${MAX_EXPORT_ATTEMPTS}: ${formatDataDay(from)} -> ${formatDataDay(to)}`);
      page = await waitForOrdersPage(context, page, attempt);
      await pickDateRange(page, from, to);
      const filtered = await clickFirstVisible(page, ['button[name="filter"]', 'button:has-text("\u0641\u0644\u062a\u0631\u0629")', 'button:has-text("Filter")', 'input[type="submit"][value*="\u0641\u0644\u062a\u0631"]', 'form button[type="submit"]'], "KHOD WHAAT filter");
      if (!filtered) throw new Error("KHOD WHAAT filter button not found.");
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await page.waitForTimeout(4000);

      const exportSelectors = ['button[name="export"]', 'button:has-text("\u0627\u0633\u062a\u062e\u0631\u0627\u062c")', 'button:has-text("\u0627\u0643\u0633\u0644")', 'button:has-text("Excel")', 'a[href*="export"]', 'button:has-text("\u062a\u0635\u062f\u064a\u0631")', 'input[type="submit"][value*="\u0627\u0633\u062a\u062e\u0631\u0627\u062c"]', 'input[type="submit"][value*="\u0627\u0643\u0633\u0644"]'];
      for (const selector of exportSelectors) {
        const item = page.locator(selector).first();
        if (!(await item.isVisible({ timeout: 1500 }).catch(() => false))) continue;
        emitStage("khod.orders.download", "started", "Waiting for KHOD WHAAT export download");
        if (process.send) process.send({ type: "cooldown", seconds: Math.round(DOWNLOAD_TIMEOUT_MS / 1000), attempt, maxAttempts: MAX_EXPORT_ATTEMPTS, site: "khod" });
        const downloadPromise = page.waitForEvent("download", { timeout: DOWNLOAD_TIMEOUT_MS });
        await item.click({ noWaitAfter: true });
        const buffer = await downloadToBuffer(await downloadPromise);
        if (!buffer.length) throw new Error("KHOD WHAAT export file was empty.");
        emitStage("khod.orders.download", "ok", `KHOD WHAAT export downloaded ${buffer.length} bytes`, { bytes: buffer.length });
        if (process.send) process.send({ type: "export-timestamp", timestamp: Date.now() });
        return buffer;
      }
      throw new Error("KHOD WHAAT export button not found.");
    } catch (error) {
      lastError = error;
      const message = isBrowserClosedError(error) ? dashboardAccountClosedMessage() : (error.message || String(error));
      emitStage("khod.orders.export", "error", message, { attempt, maxAttempts: MAX_EXPORT_ATTEMPTS });
      log(`KHOD WHAAT export attempt ${attempt} failed: ${message}`);
      if (message.includes("DASHBOARD_ACCOUNT_BROWSER_CLOSED")) throw new Error(message);
      if (attempt >= MAX_EXPORT_ATTEMPTS) break;
      if (process.send) process.send({ type: "khod-restart", reason: message, attempt, maxAttempts: MAX_EXPORT_ATTEMPTS, waitSeconds: RETRY_WAIT_SECONDS });
      for (let remaining = RETRY_WAIT_SECONDS; remaining > 0; remaining -= 15) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(15, remaining) * 1000));
        if (process.send && remaining > 15) process.send({ type: "khod-restart", reason: message, attempt, maxAttempts: MAX_EXPORT_ATTEMPTS, waitSeconds: remaining - 15 });
      }
      page = await openFreshPage();
      await ensureKhodArabic(page, `retry-${attempt + 1}`);
    }
  }
  throw new Error(`KHOD WHAAT dashboard export failed after ${MAX_EXPORT_ATTEMPTS} attempts. Last error: ${lastError ? lastError.message : "unknown error"}`);
}

(async () => {
  const profilePath = config.profilePath;
  if (!profilePath) return process.send && process.send({ type: "error", error: "profilePath not set in config" });
  if (!(config.khodEmail || config.khod_email) || !(config.khodPassword || config.khod_password)) {
    return process.send && process.send({ type: "error", error: "KHOD WHAAT credentials missing for this account. Re-save the account credentials, then retry dashboard update." });
  }

  if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });
  const chromePath = config.chromePath || findChrome();
  log(`Using Chrome: ${chromePath}`);
  const context = await launchPersistentChromeContext(chromium, profilePath, { executablePath: chromePath, windowSize: "1400,900" });
  let page = null;
  installUnexpectedBlankPageGuard(context, { getActivePage: () => page, log });
  await addChromeFingerprintSpoofing(context);
  page = await getOrCreateAutomationPage(context, { log });
  await page.setViewportSize({ width: 1400, height: 900 }).catch(() => {});

  try {
    emitStage("dashboard.fetch.start", "started", "Preparing KHOD WHAAT dashboard fetch");
    page = await khodLogin(context, page);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const requestedFrom = parseConfigDate(config.dashboardDateFrom);
    const requestedTo = parseConfigDate(config.dashboardDateTo);
    const dateFrom = requestedFrom || new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const dateTo = requestedTo || today;
    const { exportDateFrom, exportDateTo } = resolveSafeKhodExportRange(dateFrom, dateTo, { today });
    log(`Dashboard fetch - KHOD WHAAT ${formatDataDay(exportDateFrom)} -> ${formatDataDay(exportDateTo)} (saving created-date range ${formatDataDay(dateFrom)} -> ${formatDataDay(dateTo)})`);
    const buffer = await exportKhodOrders(context, page, exportDateFrom, exportDateTo);
    emitStage("khod.sheet.parse", "started", "Parsing KHOD WHAAT export");
    const { processDashboardSheets } = require("./dashboard-sheet-processing");
    const processed = processDashboardSheets({ khodBuffer: buffer, dateFrom: toDateKey(dateFrom), dateTo: toDateKey(dateTo) });
    emitStage("khod.sheet.parse", "ok", `Parsed ${processed.rows.length} dashboard rows`, { rows: processed.rows.length });
    if (process.send) process.send({
      type: "dashboard-result",
      rows: processed.rows,
      learnedSkuNameMap: processed.learnedSkuNameMap || {},
      enrichmentDiagnostics: processed.enrichmentDiagnostics || null,
      parseDiagnostics: processed.parseDiagnostics,
      snapshotMonth: processed.snapshotMonth,
      dateFrom: processed.dateFrom,
      dateTo: processed.dateTo,
      exportDateFrom: toDateKey(exportDateFrom),
      exportDateTo: toDateKey(exportDateTo),
    });
  } catch (error) {
    const fatalMessage = isBrowserClosedError(error) ? dashboardAccountClosedMessage() : (error.message || String(error));
    log(`FATAL: ${fatalMessage}`);
    if (process.send) process.send({ type: "error", error: fatalMessage });
  } finally {
    await context.close().catch(() => {});
  }
})();
