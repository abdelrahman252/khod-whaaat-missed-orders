const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

const main = read("src/main/main.js");
const sql = read("admin-panel/SUPABASE_SETUP.sql");
const admin = read("admin-panel/index.html");

const checks = [];
function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
}

check("main declares heartbeat interval", /LICENSE_PRESENCE_INTERVAL_MS\s*=\s*60\s*\*\s*1000/.test(main));
check("main records presence through KHOD WHAAT RPC", /supabaseRpc\("khod_record_license_presence"/.test(main));
check("main has start heartbeat helper", /function\s+startLicensePresenceHeartbeat\s*\(/.test(main));
check("main has stop heartbeat helper", /function\s+stopLicensePresenceHeartbeat\s*\(/.test(main));
check("heartbeat timer is unrefed", /licensePresenceTimer\.unref/.test(main));
check("license validation starts heartbeat", /isLicenseValid[\s\S]*startLicensePresenceHeartbeat\(\)/.test(main));
check("license invalid path stops heartbeat", /License not found on server[\s\S]*stopLicensePresenceHeartbeat\(\)/.test(main));
check("check-license IPC starts heartbeat", /_checkLicenseImpl[\s\S]*startLicensePresenceHeartbeat\(\)/.test(main));
check("submit-license starts heartbeat", /submit-license[\s\S]*startLicensePresenceHeartbeat\(\)/.test(main));
check("app quit stops heartbeat", /before-quit[\s\S]*stopLicensePresenceHeartbeat\(\)/.test(main));

check("SQL defines presence RPC", /CREATE OR REPLACE FUNCTION public\.khod_record_license_presence/.test(sql));
check("SQL defines admin online RPC", /CREATE OR REPLACE FUNCTION public\.khod_admin_online_customers/.test(sql));
check("SQL heartbeat updates last_seen_at", /khod_record_license_presence[\s\S]*last_seen_at\s*=\s*NOW\(\)/.test(sql));
check("SQL heartbeat updates one matched device", /WITH matched AS[\s\S]*LIMIT 1[\s\S]*UPDATE public\.license_devices ld/.test(sql));
check("SQL grants app heartbeat RPC to anon", /GRANT EXECUTE ON FUNCTION public\.khod_record_license_presence\(TEXT, TEXT, TEXT\) TO anon, authenticated/.test(sql));
check("SQL keeps admin online RPC off public", /REVOKE ALL ON FUNCTION public\.khod_admin_online_customers\(INTEGER\) FROM PUBLIC/.test(sql));
check("SQL grants admin online RPC to service role", /GRANT EXECUTE ON FUNCTION public\.khod_admin_online_customers\(INTEGER\) TO service_role/.test(sql));

check("admin dashboard has online customers card", /id="admin-online-customers-card"/.test(admin));
check("admin calls online customers RPC", /sbRpc\("khod_admin_online_customers"/.test(admin));
check("admin refreshes online customers", /ONLINE_CUSTOMERS_REFRESH_MS/.test(admin) && /ensureOnlineCustomersRefresh/.test(admin));
check("admin masks device identifiers", /function\s+maskPresenceIdentifier/.test(admin));
const presenceLoader = (admin.match(/function loadOnlineCustomers[\s\S]*?function adminErrorSeverityBadge/) || [""])[0];
check("admin renders no order data in presence loader", !/\border(s|_id|Id)?\b/.test(presenceLoader));
check("admin presence loader does not render emails", !/(easy_email|khod_email|email)/.test(presenceLoader));

const failed = checks.filter(c => !c.ok);
if (failed.length) {
  console.error("Admin presence heartbeat verification failed:");
  failed.forEach(c => console.error(" - " + c.name));
  process.exit(1);
}

console.log(`Admin presence heartbeat verification passed (${checks.length} checks).`);
