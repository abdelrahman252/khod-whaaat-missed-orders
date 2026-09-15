const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

const main = read("src/main/main.js");
const monitoring = read("src/monitoring/sentry.main.js");
const sql = read("admin-panel/SUPABASE_SETUP.sql");
const admin = read("admin-panel/index.html");

const checks = [];
function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
}

check("monitoring exposes admin error reporter hook", /function\s+setAdminErrorAlertReporter/.test(monitoring));
check("monitoring notifies hook for renderer exceptions", /khod-monitoring:capture-exception[\s\S]*notifyAdminErrorAlert/.test(monitoring));
check("monitoring wrapper mirrors captureException", /captureException:\s*\(error, context\)[\s\S]*notifyAdminErrorAlert/.test(monitoring));

check("main defines admin alert sanitizer", /function\s+sanitizeAdminAlertText/.test(main));
check("main redacts KHOD WHAAT license keys", /KHOD-\[A-Z0-9\]\{4\}/.test(main));
check("main redacts emails", /\[Filtered email\]/.test(main));
check("main redacts phone-like numbers", /\[Filtered number\]/.test(main));
check("main redacts secrets", /\[Filtered\]/.test(main) && /password\|pass\|token\|api/.test(main));
check("main sends admin error alert RPC", /supabaseRpc\("khod_record_admin_error_alert"/.test(main));
check("main rate limits admin alerts", /ADMIN_ERROR_ALERT_RATE_LIMIT_MS/.test(main) && /adminErrorAlertLastSent/.test(main));
check("main registers reporter hook", /setAdminErrorAlertReporter\(recordAdminErrorAlert\)/.test(main));
check("main payload excludes raw context object", !/p_event:\s*\{\s*payload,\s*context/.test(main));

check("SQL creates admin_error_alerts table", /CREATE TABLE IF NOT EXISTS public\.admin_error_alerts/.test(sql));
check("SQL enables RLS on admin_error_alerts", /ALTER TABLE public\.admin_error_alerts ENABLE ROW LEVEL SECURITY/.test(sql));
check("SQL revokes direct app table access", /REVOKE ALL ON TABLE public\.admin_error_alerts FROM anon, authenticated/.test(sql));
check("SQL defines record admin error RPC", /CREATE OR REPLACE FUNCTION public\.khod_record_admin_error_alert/.test(sql));
check("SQL validates active license before insert", /khod_record_admin_error_alert[\s\S]*WHERE license_key = normalized_key[\s\S]*revoked = FALSE/.test(sql));
check("SQL masks stored license key", /LEFT\(normalized_key, 9\) \|\| '\.\.\.' \|\| RIGHT\(normalized_key, 4\)/.test(sql));
check("SQL grants RPC to app roles", /GRANT EXECUTE ON FUNCTION public\.khod_record_admin_error_alert\(TEXT, JSONB\) TO anon, authenticated/.test(sql));

check("admin dashboard has error alerts card", /id="admin-error-alerts-card"/.test(admin));
check("admin loads unresolved error alerts", /function\s+loadAdminErrorAlerts/.test(admin) && /resolved_at=is\.null/.test(admin));
check("admin can resolve error alerts", /function\s+resolveAdminErrorAlert/.test(admin) && /resolved_at:\s*new Date\(\)\.toISOString/.test(admin));
check("admin card includes privacy wording", /no orders, phones, emails, passwords, API keys/.test(admin));

const failed = checks.filter(c => !c.ok);
if (failed.length) {
  console.error("Admin error alerts verification failed:");
  failed.forEach(c => console.error(" - " + c.name));
  process.exit(1);
}

console.log(`Admin error alerts verification passed (${checks.length} checks).`);
