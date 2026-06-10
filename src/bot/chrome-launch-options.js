"use strict";

const BASE_CHROME_ARGS = [
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
  "--lang=en-US",
  "--accept-lang=en-US,en",
];

const MAX_SPEED_CHROME_ARGS = [
  "--disable-component-update",
  "--disable-domain-reliability",
  "--disable-breakpad",
  "--disable-crash-reporter",
  "--disable-notifications",
  "--disable-features=AutofillServerCommunication,OptimizationHints,MediaRouter,TabHoverCardImages,TabHoverCards,TranslateUI,InterestFeedContentSuggestions,CalculateNativeWinOcclusion,HeavyAdPrivacyMitigations,CertificateTransparencyComponentUpdater,PrivacySandboxSettings4,HardwareMediaKeyHandling",
  "--disable-ipc-flooding-protection",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-accessibility",
  "--disable-search-engine-choice-screen",
];

function uniqueArgs(args) {
  return Array.from(new Set(args.filter(Boolean)));
}

function buildChromeLaunchOptions(chromePath, options = {}) {
  const args = uniqueArgs([
    ...BASE_CHROME_ARGS,
    ...MAX_SPEED_CHROME_ARGS,
    ...(options.args || []),
  ]);

  return {
    executablePath: chromePath,
    headless: false,
    ignoreDefaultArgs: ["--enable-automation"],
    chromiumSandbox: true,
    args,
    locale: "en-US",
    waitForInitialPage: false,
    ...(options.viewport === undefined ? {} : { viewport: options.viewport }),
  };
}

module.exports = { buildChromeLaunchOptions };
