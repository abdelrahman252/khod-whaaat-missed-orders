const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

const shell = read("src/renderer/pages/dashboard/dashboard-shell.js");
const app = read("src/renderer/app.js");
const pipeline = read("src/renderer/pages/dashboard/sections/section2-pipeline.js");
const orders = read("src/renderer/pages/dashboard/sections/section3-orders.js") +
  "\n" + read("src/renderer/pages/dashboard/sections/section3-orders-hydrated.js");
const master = read("src/renderer/pages/dashboard/sections/section8-master.js");

const checks = [];
function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
}

check("dashboard pane cache limit matches Tiger warm-section architecture", /DASHBOARD_PANE_CACHE_LIMIT\s*=\s*16/.test(shell));
check("pipeline section is cacheable", /pipeline:\s*true/.test(shell));
check("orders section is cacheable", /orders:\s*true/.test(shell));
check("marketing remains uncached because it owns focus/refresh listeners", !/marketing:\s*true/.test(shell));
check("pipeline theme observer cleanup exists", /_s2ThemeObserver\.disconnect\(\)/.test(pipeline) && /_dashboardSectionCleanup/.test(pipeline));
check("orders theme observer cleanup exists", /_s3ThemeObserver\.disconnect\(\)/.test(orders) && /_dashboardSectionCleanup/.test(orders));
check("dashboard AI is idle prewarmed last", /"dashboardMarketing",\s*"dashboardAi"/.test(app));
check(
  "master detail cards render in the initial pass without an idle full rerender",
  /var citiesList = cod\.cities \|\| \[\]/.test(master) &&
    /var PRODUCTS = \(d\.products \?/.test(master) &&
    !/_s8LazyDetail|hydrateDetailCards/.test(master)
);

const failed = checks.filter(c => !c.ok);
if (failed.length) {
  console.error("Dashboard speed follow-up verification failed:");
  failed.forEach(c => console.error(" - " + c.name));
  process.exit(1);
}

console.log(`Dashboard speed follow-up verification passed (${checks.length} checks).`);
