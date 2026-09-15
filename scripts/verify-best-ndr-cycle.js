const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];

function assert(name, condition) {
  checks.push({ name, ok: !!condition });
}

const app = read('src/renderer/app.js');
const shell = read('src/renderer/pages/dashboard/dashboard-shell.js');
const calc = read('src/renderer/pages/dashboard/sections/section7-calculator.js');
const section5 = read('src/renderer/pages/dashboard/sections/section5-products.js');
const styles = read('src/renderer/pages/dashboard/dashboard-styles.css');
const calcStyles = read('src/renderer/pages/dashboard/dashboard-calculator.css');
const best = read('src/renderer/pages/dashboard/dashboard-best-ndr-cycle.js');

const bestScript = '"pages/dashboard/dashboard-best-ndr-cycle.js"';
const shellScript = '"pages/dashboard/dashboard-shell.js"';
assert('Best NDR script exists', best.includes('window.DashboardBestNdrCycle'));
assert('Best NDR script loads before dashboard shell', app.indexOf(bestScript) !== -1 && app.indexOf(bestScript) < app.indexOf(shellScript));
assert('Best NDR script is available to calculator bundle', /dashboardCalculator:[\s\S]*dashboard-best-ndr-cycle\.js[\s\S]*section7-calculator\.js/.test(app));

assert('Toolbar markup exists', shell.includes('data-best-ndr-control') && shell.includes('data-best-ndr-action="simulator"'));
assert('Toolbar sync exists', shell.includes('function syncBestNdrCycle') && shell.includes('DashboardBestNdrCycle.analyze'));
assert('Toolbar stores preferred simulator state', shell.includes('window.DashboardBestNdrCyclePreferred = payload'));
assert('Toolbar creates pending Section 5 request', shell.includes('window.__khodPendingExpectedNdrCompare'));
assert('Toolbar uses shell navigation', shell.includes('_dashboardNavigate'));

assert('Calculator references Best NDR analyzer', calc.includes('DashboardBestNdrCycle.analyze'));
assert('Calculator references preferred Best NDR state', calc.includes('DashboardBestNdrCyclePreferred'));
assert('Calculator only exposes overall and best cycle selector values', calc.includes('value="overall"') && calc.includes('value="best_cycle"'));
assert('Calculator has Best NDR card actions', calc.includes('s7-use-best-ndr-cycle') && calc.includes('s7-use-actual-ndr-cycle'));
assert('Calculator does not introduce order-source model', !/orderSourcesModel|order-source|order source/i.test(calc));

assert('Section 5 exposes Expected NDR compare modal', section5.includes('window.openProductExpectedNdrCompareModal'));
assert('Section 5 consumes pending Expected NDR compare request', section5.includes('consumePendingExpectedNdrCompare') && section5.includes('__khodPendingExpectedNdrCompare'));
assert('Section 5 does not introduce product edit-name flow', !/edit[-_ ]?name|ProductNameEdit|openProductNameEdit/i.test(section5));

assert('Dashboard Best NDR styles exist', styles.includes('.dashboard-best-ndr-control') && styles.includes('.dashboard-best-ndr-panel'));
assert('Calculator Best NDR styles exist', calcStyles.includes('.s7-best-ndr-card') && calcStyles.includes('.s7-order-ndr-selector'));
assert('Best analyzer excludes canceled-by-you buckets', best.includes('canceled_by_you') && best.includes('cancelled_by_you'));
assert('Best analyzer uses 7-day / 30-order defaults', best.includes('DEFAULT_CYCLE_DAYS = 7') && best.includes('DEFAULT_MIN_SAMPLE = 30'));

const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error('Best NDR Cycle verification failed:');
  failed.forEach((check) => console.error(' - ' + check.name));
  process.exit(1);
}

console.log('Best NDR Cycle verification passed (' + checks.length + ' checks).');
