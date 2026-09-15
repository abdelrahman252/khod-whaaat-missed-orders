"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { fetchActiveAdminNotification } = require("../src/main/admin-notification");

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

async function verifyLicenseFetch() {
  const calls = [];
  const result = await fetchActiveAdminNotification(async (fn, params) => {
    calls.push({ fn, params });
    return { id:"notice-1", title:"Hello", message:"KHOD WHAAT update", kind:"warn", created_at:"2026-07-01T00:00:00Z" };
  }, "KHOD-TEST", console);
  assert(calls[0].fn === "khod_get_active_admin_notification", "mocked notification RPC is called after licensing");
  assert(calls[0].params.p_license_key === "KHOD-TEST", "license key reaches the notification RPC");
  assert(result && result.id === "notice-1" && result.createdAt === "2026-07-01T00:00:00Z", "mocked RPC result is normalized for the license response");
  const nonFatal = await fetchActiveAdminNotification(async () => { throw new Error("missing migration"); }, "KHOD-TEST", { warn() {} });
  assert(nonFatal === null, "notification RPC failures stay non-fatal");

  const mainSource = fs.readFileSync(path.join(__dirname, "..", "src", "main", "main.js"), "utf8");
  assert(/adminNotification:\s*await _getActiveAdminNotification\(key\)/.test(mainSource), "live license response includes adminNotification");
  assert(/adminNotification:\s*null, offline:\s*true/.test(mainSource) && /adminNotification:\s*null, startupCached:\s*true/.test(mainSource), "offline and startup caches cannot replay broadcasts");
}

function verifyRendererManager() {
  const storage = new Map();
  const timers = [];
  const listeners = {};
  const toastCalls = [];
  let warningVisible = false;
  let expiredVisible = false;
  let timerId = 0;

  const windowObject = {
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, value); },
    },
    isLicenseExpiryWarningVisible: () => warningVisible,
    isExpiredOverlayVisible: () => expiredVisible,
    setTimeout(callback, delay) {
      const timer = { id:++timerId, callback, delay, cancelled:false };
      timers.push(timer);
      return timer.id;
    },
    clearTimeout(id) {
      const timer = timers.find((item) => item.id === id);
      if (timer) timer.cancelled = true;
    },
    KhodUI: {
      toast(message, options) {
        toastCalls.push({ message, options });
        let closed = false;
        return () => {
          if (closed) return;
          closed = true;
          if (typeof options.onClose === "function") options.onClose();
        };
      },
    },
  };
  const documentObject = {
    addEventListener(name, callback) { listeners[name] = callback; },
  };
  const runTimer = (delay, quiet = false) => {
    const timer = timers.find((item) => !item.cancelled && item.delay === delay);
    if (!timer) throw new Error(`Expected a ${delay}ms delivery timer`);
    if (!quiet) console.log(`PASS a ${delay}ms delivery timer is queued`);
    timer.cancelled = true;
    timer.callback();
  };

  const context = vm.createContext({ window:windowObject, document:documentObject, console, JSON, String, Boolean });
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "admin-notifications.js"), "utf8");
  new vm.Script(source, { filename:"admin-notifications.js" }).runInContext(context);
  const manager = windowObject.KhodAdminNotifications;

  const first = { id:"one", title:"First", message:"First message", kind:"info" };
  manager.handle(first);
  runTimer(0);
  assert(toastCalls.length === 1, "a new broadcast displays");
  toastCalls[0].options.onClose();
  manager.handle(first);
  assert(toastCalls.length === 1, "dismissed IDs do not display twice");

  manager.handle({ id:"two", title:"Replacement", message:"New ID", kind:"success" });
  runTimer(0);
  assert(toastCalls.length === 2, "a replacement ID displays again");
  assert(toastCalls[1].options.persistent === true && toastCalls[1].options.variant === "admin" && toastCalls[1].options.title === "Replacement", "persistent admin-toast options are applied");

  warningVisible = true;
  manager.handle({ id:"three", title:"Queued", message:"After warning", kind:"warn" });
  assert(toastCalls.length === 2, "expiry warning delays the broadcast");
  warningVisible = false;
  listeners["khod-license-overlay-change"]();
  runTimer(450);
  assert(toastCalls.length === 3, "broadcast appears about 450ms after warning closure");

  expiredVisible = true;
  manager.handle({ id:"four", title:"Recovery", message:"After recovery", kind:"info" });
  assert(toastCalls.length === 3, "expired overlay delays the broadcast");
  expiredVisible = false;
  listeners["khod-license-overlay-change"]();
  runTimer(450);
  assert(toastCalls.length === 4, "broadcast appears after expired-overlay recovery");

  warningVisible = true;
  manager.handle({ id:"five", title:"Cancelled", message:"Do not show", kind:"info" });
  manager.handle(null);
  warningVisible = false;
  listeners["khod-license-overlay-change"]();
  assert(toastCalls.length === 4, "disabled broadcasts clear pending notifications");

  for (let index = 0; index < 105; index++) {
    manager.handle({ id:`history-${index}`, title:"History", message:"Retention", kind:"info" });
    runTimer(0, true);
    toastCalls.at(-1).options.onClose();
  }
  const dismissed = JSON.parse(storage.get("khod.dismissedAdminNotificationIds"));
  assert(dismissed.length === 100 && dismissed[0] === "history-5" && dismissed.at(-1) === "history-104", "only the latest 100 dismissed IDs are retained");
}

(async () => {
  await verifyLicenseFetch();
  verifyRendererManager();
  console.log("Admin notification behavior verified.");
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
