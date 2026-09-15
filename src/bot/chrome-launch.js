"use strict";

const SAFE_STARTUP_ARGS = Object.freeze([
  "--no-first-run",
  "--no-default-browser-check",
]);

const MAXIMUM_SPEED_ARGS = Object.freeze([
  "--disable-background-networking",
  "--disable-client-side-phishing-detection",
  "--disable-component-update",
  "--disable-domain-reliability",
  "--disable-breakpad",
  "--disable-crash-reporter",
  "--disable-default-apps",
  "--disable-hang-monitor",
  "--disable-popup-blocking",
  "--disable-prompt-on-repost",
  "--disable-sync",
  "--disable-translate",
  "--disable-notifications",
  "--disable-component-extensions-with-background-pages",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--disable-v8-idle-tasks",
  "--disable-features=MediaRouter,OptimizationHints,OptimizationHintsFetching,AutofillServerCommunication,TabHoverCards,TabHoverCardImages,CalculateNativeWinOcclusion,GlobalMediaControls,InterestFeedContentSuggestions,CertificateTransparencyComponentUpdater,PrivacySandboxSettings4",
  "--hide-crash-restore-bubble",
  "--disk-cache-size=52428800",
  "--no-pings",
]);

const LOCALE_ARGS = Object.freeze([
  "--lang=ar-SA",
  "--accept-lang=ar-SA,ar,en",
]);

function buildMaximumSpeedChromeArgs(options = {}) {
  const windowSize = options.windowSize || "1280,800";
  return [
    ...SAFE_STARTUP_ARGS,
    ...MAXIMUM_SPEED_ARGS,
    "--force-device-scale-factor=1",
    `--window-size=${windowSize}`,
    ...LOCALE_ARGS,
  ];
}

function buildPersistentContextOptions(options = {}) {
  const launchOptions = {
    executablePath: options.executablePath,
    headless: false,
    ignoreDefaultArgs: ["--enable-automation"],
    chromiumSandbox: true,
    args: buildMaximumSpeedChromeArgs({ windowSize: options.windowSize }),
    locale: "ar-SA",
    waitForInitialPage: false,
  };

  if (Object.prototype.hasOwnProperty.call(options, "viewport")) {
    launchOptions.viewport = options.viewport;
  }

  return launchOptions;
}

async function launchPersistentChromeContext(chromium, profilePath, options = {}) {
  return chromium.launchPersistentContext(
    profilePath,
    buildPersistentContextOptions(options)
  );
}

function safePageUrl(page) {
  try {
    return page && !page.isClosed() ? page.url() : "";
  } catch (_) {
    return "";
  }
}

function isBlankOrInternalChromeUrl(url) {
  const normalized = String(url || "").trim().toLowerCase();
  if (!normalized || normalized === "about:blank") return true;
  return normalized.startsWith("chrome://") ||
    normalized.startsWith("chrome-untrusted://") ||
    normalized.startsWith("devtools://");
}

function isUsableAutomationPage(page) {
  return Boolean(page && !page.isClosed() && !isBlankOrInternalChromeUrl(safePageUrl(page)));
}

async function closePageIfSafe(page, log, reason) {
  if (!page || page.isClosed()) return false;
  const url = safePageUrl(page) || "unknown";
  try {
    await page.close({ runBeforeUnload: false });
    if (log) log(`[CHROME] Closed ${reason}: ${url}`);
    return true;
  } catch (error) {
    if (log) log(`[CHROME] Could not close ${reason}: ${url} (${error.message})`);
    return false;
  }
}

async function closeExtraBlankPages(context, activePage, log) {
  const pages = context.pages().filter((page) => page && !page.isClosed());
  const hasUsablePage = pages.some(isUsableAutomationPage);
  if (!hasUsablePage) return;

  await Promise.all(pages.map(async (page) => {
    if (page === activePage || page.isClosed()) return;
    if (!isBlankOrInternalChromeUrl(safePageUrl(page))) return;
    await closePageIfSafe(page, log, "extra blank/internal startup tab");
  }));
}

async function getOrCreateAutomationPage(context, options = {}) {
  const log = options.log;
  const pages = context.pages().filter((page) => page && !page.isClosed());
  const page = pages.find(isUsableAutomationPage) || pages[0] || (await context.newPage());
  await closeExtraBlankPages(context, page, log);
  return page;
}

function installUnexpectedBlankPageGuard(context, options = {}) {
  const log = options.log;
  const delayMs = Number.isFinite(options.delayMs) ? options.delayMs : 5000;
  const getActivePage = typeof options.getActivePage === "function"
    ? options.getActivePage
    : () => null;

  context.on("page", (page) => {
    let sawDownload = false;
    page.once("download", () => {
      sawDownload = true;
    });

    setTimeout(async () => {
      if (!page || page.isClosed() || sawDownload) return;
      const activePage = getActivePage();
      if (page === activePage) return;
      if (!isBlankOrInternalChromeUrl(safePageUrl(page))) return;

      const hasOtherUsablePage = context.pages().some((candidate) =>
        candidate !== page && candidate && !candidate.isClosed() && isUsableAutomationPage(candidate)
      );
      if (!hasOtherUsablePage) return;

      await closePageIfSafe(page, log, "unexpected blank/internal tab");
    }, delayMs);
  });
}

async function addChromeFingerprintSpoofing(context) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    delete window.__playwright;
    delete window.__pw_manual;
    delete window.__PW_inspect;
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["ar-SA", "ar", "en"] });
  });
}

module.exports = {
  addChromeFingerprintSpoofing,
  buildMaximumSpeedChromeArgs,
  buildPersistentContextOptions,
  getOrCreateAutomationPage,
  installUnexpectedBlankPageGuard,
  launchPersistentChromeContext,
};
