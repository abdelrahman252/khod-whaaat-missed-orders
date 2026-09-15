"use strict";

const os = require("os");

const DEFAULT_ENVIRONMENT = process.env.NODE_ENV || (process.defaultApp ? "development" : "production");
const DEFAULT_SAMPLE_RATE = DEFAULT_ENVIRONMENT === "production" ? 0.15 : 1.0;
const DEFAULT_ERROR_SAMPLE_RATE = 1.0;
const IPC_NAMESPACE = "khod-sentry";
const SENSITIVE_EXTRA_KEYS = new Set([
  "password",
  "easypassword",
  "taagerpassword",
  "khodpassword",
  "token",
  "licensekey",
  "supabase_publishable_key",
  "gemini_api_key",
]);

function shouldFilterExtraKey(key) {
  const normalized = String(key || "").toLowerCase();
  return SENSITIVE_EXTRA_KEYS.has(normalized)
    || /^pwd_khod/.test(normalized)
    || /^pwd_taager/.test(normalized)
    || /khod.*password/.test(normalized);
}

function redactSensitiveFields(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactSensitiveFields(item, seen));
  const copy = {};
  Object.keys(value).forEach((key) => {
    copy[key] = shouldFilterExtraKey(key) ? "[Filtered]" : redactSensitiveFields(value[key], seen);
  });
  return copy;
}

function boolEnv(name, fallback) {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getRelease(appVersion) {
  return process.env.SENTRY_RELEASE || `khod-orders@${appVersion || "0.0.0"}`;
}

function getEnvironment() {
  return process.env.SENTRY_ENVIRONMENT || DEFAULT_ENVIRONMENT;
}

function isEnabled(isPackaged) {
  if (!process.env.SENTRY_DSN) return false;
  if (boolEnv("SENTRY_DISABLED", false)) return false;
  return !!isPackaged || boolEnv("SENTRY_ENABLE_DEV", false);
}

function getRuntimeContext(appVersion) {
  const cpus = os.cpus() || [];
  return {
    appVersion: appVersion || "unknown",
    electronVersion: process.versions.electron || "unknown",
    nodeVersion: process.versions.node || "unknown",
    chromeVersion: process.versions.chrome || "unknown",
    platform: process.platform,
    osRelease: os.release(),
    arch: process.arch,
    totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
    cpuCount: cpus.length,
    cpuModel: cpus[0] ? cpus[0].model : "unknown",
    environment: getEnvironment(),
  };
}

function scrubEvent(event) {
  if (!event) return event;
  delete event.user;

  const request = event.request || {};
  if (request.headers) {
    delete request.headers.authorization;
    delete request.headers.Authorization;
    delete request.headers.cookie;
    delete request.headers.Cookie;
  }
  if (request.cookies) delete request.cookies;

  event.extra = redactSensitiveFields(event.extra || {});

  return event;
}

function getCommonOptions(appVersion, isPackaged) {
  return {
    dsn: process.env.SENTRY_DSN || "",
    enabled: isEnabled(isPackaged),
    environment: getEnvironment(),
    release: getRelease(appVersion),
    tracesSampleRate: numberEnv("SENTRY_TRACES_SAMPLE_RATE", DEFAULT_SAMPLE_RATE),
    sampleRate: numberEnv("SENTRY_ERROR_SAMPLE_RATE", DEFAULT_ERROR_SAMPLE_RATE),
    debug: boolEnv("SENTRY_DEBUG", false),
    attachStacktrace: true,
    sendDefaultPii: false,
    maxBreadcrumbs: 80,
    beforeSend: scrubEvent,
  };
}

module.exports = {
  IPC_NAMESPACE,
  boolEnv,
  getCommonOptions,
  getEnvironment,
  getRelease,
  getRuntimeContext,
  isEnabled,
  numberEnv,
  scrubEvent,
};
