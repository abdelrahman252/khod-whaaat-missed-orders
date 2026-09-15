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
const shared = read('src/renderer/pages/dashboard/dashboard-shared.js');
const master = read('src/renderer/pages/dashboard/sections/section8-master.js');
const gmv = read('src/renderer/pages/dashboard/sections/section-gmv-target.js');
const css = read('src/renderer/pages/dashboard/dashboard-gmv-target.css');
const en = read('src/renderer/pages/dashboard/locales/en/dashboard-locale.js');
const ar = read('src/renderer/pages/dashboard/locales/ar/dashboard-locale.js');

assert('GMV target state exists', shared.includes('window.DashboardGmvTargetState'));
assert('GMV target state uses KHOD WHAAT storage key', shared.includes('khod_gmv_target_v1'));
assert('GMV target state uses KHOD WHAAT currency helper', shared.includes('window.KhodCurrency') && !shared.includes('taager_gmv_target_v1'));
assert('GMV section renderer exists', gmv.includes('window.renderSectionGmvTarget'));
assert('GMV section uses KhodUI helper', gmv.includes('window.KhodUI') && !gmv.includes('TaagerUI'));
assert('GMV section has save and clear controls', gmv.includes('gmv-save-target') && gmv.includes('gmv-clear-target'));
assert('GMV section has scenario controls', gmv.includes('gmv-ndr-input') && gmv.includes('gmv-aov-input') && gmv.includes('gmv-custom-daily-input'));
assert('GMV route registered in shell nav', shell.includes("id: 'gmvTarget'") && shell.includes("gmvTarget: 'renderSectionGmvTarget'"));
assert('GMV target icon is registered', shared.includes('    target:') && shell.includes("iconName: 'target'") && gmv.includes("'#8b5cf6', 'target'"));
assert('Best NDR icon is registered', shared.includes('    sparkles:') && shell.includes("icon('sparkles', 'currentColor')"));
assert('GMV route is cacheable', shell.includes('gmvTarget: true'));
assert('GMV feature script registered', app.includes('dashboardGmvTarget') && app.includes('section-gmv-target.js'));
assert('GMV feature style registered', app.includes('dashboard-gmv-target.css'));
assert('GMV feature mapped by section id', app.includes('gmvTarget: "dashboardGmvTarget"'));
assert('Master preview button exists', master.includes('s8-btn-gmv-target') && master.includes("onNavigate('gmvTarget')"));
assert('Master preview subscribes to GMV target state', master.includes('DashboardGmvTargetState.subscribe') && master.includes('DashboardGmvTargetState.unsubscribe'));
assert('GMV CSS exists', css.includes('.gmv-body') && css.includes('.gmv-target-panel'));
assert('GMV CSS uses KHOD WHAAT help class', css.includes('.gmv-tip.khod-help') && !css.includes('taager-help'));
assert('English locale has GMV nav/tour', en.includes("'nav.gmvTarget'") && en.includes('tour.dashboard.gmvTarget.title'));
assert('Arabic locale has GMV nav/tour', ar.includes("'nav.gmvTarget'") && ar.includes('tour.dashboard.gmvTarget.title'));
assert('No order-source dependency in GMV files', !/order-source|orderSourcesModel|LightFunnels/i.test([gmv, css, shared, master].join('\n')));

const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error('GMV Target Planner verification failed:');
  failed.forEach((check) => console.error(' - ' + check.name));
  process.exit(1);
}

console.log('GMV Target Planner verification passed (' + checks.length + ' checks).');
