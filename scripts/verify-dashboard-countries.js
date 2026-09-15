'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('xlsx');
const { processDashboardSheets } = require('../src/bot/dashboard-sheet-processing');
const { createDashboardQueryService } = require('../src/main/dashboard-query-service');

const ROOT = path.resolve(__dirname, '..');
const DASHBOARD_DIR = path.join(ROOT, 'src', 'renderer', 'pages', 'dashboard');
const APP_FILE = path.join(ROOT, 'src', 'renderer', 'app.js');
const ATLAS_FILE = path.join(DASHBOARD_DIR, 'dashboard-country-atlas.js');
const AGGREGATOR_FILE = path.join(DASHBOARD_DIR, 'dashboard-aggregator.js');
const COD_FILE = path.join(DASHBOARD_DIR, 'sections', 'section4-cod.js');
const CITIES_FILE = path.join(DASHBOARD_DIR, 'sections', 'section-cities.js');
const OVERVIEW_FILE = path.join(DASHBOARD_DIR, 'sections', 'section1-overview.js');
const PRODUCTS_FILE = path.join(DASHBOARD_DIR, 'sections', 'section5-products.js');
const COMMISSION_FILE = path.join(DASHBOARD_DIR, 'sections', 'section6-commission.js');
const MASTER_FILE = path.join(DASHBOARD_DIR, 'sections', 'section8-master.js');
const PERIOD = { preset: 'custom', dateFrom: '2026-05-01', dateTo: '2026-05-31' };
const RATES = { USD: 1, SAR: 3.75, EGP: 50, AED: 3.67, IQD: 1300, OMR: 0.385 };
const COUNTRY_CURRENCIES = { sa: 'SAR', eg: 'EGP', iq: 'IQD', ae: 'AED', om: 'OMR' };

let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log('[PASS] ' + label);
    return;
  }
  failed += 1;
  console.error('[FAIL] ' + label + (detail ? ': ' + detail : ''));
}

function close(actual, expected, epsilon) {
  return Math.abs(Number(actual || 0) - Number(expected || 0)) <= (epsilon || 0.01);
}

function createStorage() {
  const data = Object.create(null);
  return {
    getItem: (key) => Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null,
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: (key) => { delete data[key]; },
  };
}

function row(id, country, city, status, date, totalPrice, amountDue, profit, payment) {
  return Object.assign({
    orderId: id,
    taagerOrderNumber: id,
    country,
    taagerCountry: country,
    city,
    status,
    orderStatus: status,
    createdAt: date,
    date,
    totalPrice,
    amountDue,
    profit,
    taxProfit: 0,
    products: 'Shared SKU',
    productName: 'Shared SKU',
    sku: 'shared-sku',
    qty: 1,
    quantity: 1,
  }, payment || {});
}

const rowsByAccount = {
  sa: [
    row('sa-unknown', 'sa', 'Alexandria', 'delivered', '2026-05-10', 200, 100, 20, {
      paymentClassification: 'unknown',
      notes: 'Paid online by Visa',
    }),
  ],
  eg: [
    row('eg-prepaid', 'eg', 'Alexandria', 'delivered', '2026-05-11', 2000, 1000, 200, {
      paymentClassification: 'prepaid',
      paymentEvidenceSource: 'easyorders.payment_method',
      paymentMethod: 'card',
    }),
    row('eg-cod', 'eg', 'Cairo', 'confirmed', '2026-05-12', 1000, 500, 100, {
      paymentClassification: 'cod',
      paymentEvidenceSource: 'taager.payment_method',
      paymentMethod: 'cash',
    }),
  ],
};

async function runAggregator() {
  const storage = createStorage();
  storage.setItem('khod_active_account_id', '__all__');
  storage.setItem('khod_dashboard_reporting_currency', 'SAR');
  storage.setItem('khod_dashboard_delivered_date_mode', 'actual');

  const currency = {
    cleanCurrency(value, fallback) {
      const normalized = String(value || fallback || 'SAR').trim().toUpperCase();
      return RATES[normalized] ? normalized : String(fallback || 'SAR').toUpperCase();
    },
    rates: () => Object.assign({}, RATES),
    snapshot: () => ({
      rates: Object.assign({}, RATES),
      source: 'fixed-test',
      updatedAt: '2026-06-04T00:00:00Z',
    }),
    convert(value, from, to, opts) {
      const activeRates = Object.assign({}, RATES, opts && opts.rates);
      const source = this.cleanCurrency(from, 'SAR');
      const target = this.cleanCurrency(to, source);
      return (Number(value || 0) / activeRates[source]) * activeRates[target];
    },
  };

  const country = {
    currency: (value) => COUNTRY_CURRENCIES[String(value || 'sa').toLowerCase()] || 'SAR',
  };

  const geo = {
    provinceMap: () => ({ other: { id: 'other', label: 'Other', x: 200, y: 170 } }),
    resolveProvince: () => 'other',
    cityPoint(cityName, countryCode, index) {
      const cc = String(countryCode || 'sa');
      const seed = cc.charCodeAt(0) + cc.charCodeAt(1) + String(cityName || '').length;
      return { country: cc, provinceId: 'other', x: 40 + seed + Number(index || 0), y: 50 + seed };
    },
    outline: (countryCode) => 'M0 0L' + String(countryCode || '').length + ' 1Z',
    viewBox: () => '0 0 400 340',
  };

  const snapshots = {
    sa: { snapshot: rowsByAccount.sa, snapshotMonth: '2026-05', manualFetchTimestamp: '2026-06-01T00:00:00Z' },
    eg: { snapshot: rowsByAccount.eg, snapshotMonth: '2026-05', manualFetchTimestamp: '2026-06-01T00:00:00Z' },
  };
  const credentials = [
    { id: 'sa', label: 'Saudi store', taagerCountry: 'sa' },
    { id: 'eg', label: 'Egypt store', taagerCountry: 'eg' },
  ];
  const window = {
    _kbotLang: 'en',
    _kbotTheme: 'dark',
    dashboardAccountsList: [],
    currentActiveAccountLabel: 'All accounts',
    KhodCountry: country,
    KhodCurrency: currency,
    KhodGeo: geo,
    DashboardPeriodState: { get: () => PERIOD },
    DashboardDeliveredDateState: { get: () => 'actual' },
    api: {
      getDashboardSnapshot: async () => ({ ok: true, data: snapshots }),
      getCredentials: async () => ({ accounts: credentials }),
    },
  };
  window.window = window;
  window.localStorage = storage;
  window.addEventListener = () => {};
  window.dashboardI18n = {
    t: (key) => key,
    raw: (value) => String(value || ''),
    number: (value, opts) => Number(value || 0).toLocaleString('en-US', opts || {}),
    formatTimestamp: () => '2026-06-01 00:00',
    formatMonth: () => 'May 2026',
    monthName: () => 'May',
    locale: () => 'en-US',
    isRtl: () => false,
  };

  const context = vm.createContext({
    window,
    localStorage: storage,
    console,
    Promise,
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    JSON,
    RegExp,
    parseFloat,
    parseInt,
    isNaN,
    isFinite,
    setTimeout,
    clearTimeout,
  });
  [
    path.join(ROOT, 'src', 'renderer', 'pages', 'khod-product-names.js'),
    path.join(ROOT, 'src', 'renderer', 'pages', 'khod-status.js'),
    path.join(DASHBOARD_DIR, 'dashboard-currency-core.js'),
    path.join(DASHBOARD_DIR, 'dashboard-filter-bus.js'),
    path.join(DASHBOARD_DIR, 'dashboard-aggregator-score.js'),
    path.join(DASHBOARD_DIR, 'dashboard-aggregator-geo.js'),
    path.join(DASHBOARD_DIR, 'dashboard-insight-engine.js'),
    AGGREGATOR_FILE,
  ].forEach((file) => vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file }));
  vm.runInContext('window.KhodDashboardCurrencyCore = KhodDashboardCurrencyCore;', context);


  window.DashboardPeriodState.setCustomRange(PERIOD.dateFrom, PERIOD.dateTo);
  window.invalidateDashboardCache();
  return new Promise((resolve, reject) => {
    window.runDashboardAggregator((result) => {
      if (!result) reject(new Error('Aggregator returned no result'));
      else resolve(result);
    });
  });
}

function verifyIraqCityQueryMapping() {
  const fixture = path.join(ROOT, 'orders IRAQ.xlsx');
  if (!fs.existsSync(fixture)) {
    assert('Iraq workspace workbook exists for city mapping', false);
    return;
  }
  const processed = processDashboardSheets({
    taagerBuffer: fs.readFileSync(fixture),
    dateFrom: PERIOD.dateFrom,
    dateTo: PERIOD.dateTo,
    country: 'iq',
  });
  const service = createDashboardQueryService({
    getAccounts: () => ({
      iq: {
        country: 'iq',
        snapshot: processed.rows,
      },
    }),
    getAllowedAccountIds: () => ['iq'],
    getRevision: () => 1,
  });
  const result = service.query({
    kind: 'cities',
    accountIds: ['iq'],
    dateFrom: PERIOD.dateFrom,
    dateTo: PERIOD.dateTo,
    isMixedCountry: false,
    reportingCurrency: 'IQD',
  });
  const cities = result.cities || [];
  const mapped = cities.filter((city) => city.name !== 'unspecified' && city.provinceId && city.provinceId !== 'other');
  const unmapped = cities.filter((city) => city.name !== 'unspecified' && (!city.provinceId || city.provinceId === 'other'));
  assert('Iraq fixture city query succeeds', result.ok === true && cities.length > 0);
  assert('Iraq fixture city query maps real governorates', unmapped.length === 0,
    'unmapped: ' + unmapped.map((city) => city.name).join(', '));
  assert('Iraq fixture includes multiple colored regions',
    new Set(mapped.map((city) => city.provinceId)).size >= 8,
    'regions: ' + mapped.map((city) => city.provinceId).join(', '));
}

function loadGeoWithAtlas() {
  const appSource = fs.readFileSync(APP_FILE, 'utf8');
  const match = appSource.match(/window\.KhodGeo = \(\(\) => \{[\s\S]*?\n\}\)\(\);/);
  if (!match) throw new Error('Unable to extract KhodGeo closure');
  const window = {};
  const context = vm.createContext({ window, console, Math, Number, String, Object, Array });
  vm.runInContext(fs.readFileSync(ATLAS_FILE, 'utf8'), context, { filename: ATLAS_FILE });
  vm.runInContext(match[0], context, { filename: APP_FILE });
  return window.KhodGeo;
}

function distance(a, b) {
  return Math.sqrt(Math.pow(Number(a.x) - Number(b.x), 2) + Math.pow(Number(a.y) - Number(b.y), 2));
}

function minDistance(points) {
  let min = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      min = Math.min(min, distance(points[i], points[j]));
    }
  }
  return min;
}

function verifyCityPointAtlas() {
  const geo = loadGeoWithAtlas();
  const iraqSouth = ['ميسان', 'دوانية', 'سماوة', 'بابل', 'ذي قار'].map((city, idx) => geo.cityPoint(city, 'iq', idx));
  const egyptCore = ['القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية'].map((city, idx) => geo.cityPoint(city, 'eg', idx));
  const omanCore = ['مسقط', 'السيب', 'صحار', 'صلالة'].map((city, idx) => geo.cityPoint(city, 'om', idx));
  const uaeCore = ['دبي', 'الشارقة', 'عجمان', 'أبو ظبي'].map((city, idx) => geo.cityPoint(city, 'ae', idx));

  assert('central atlas exposes city-level map points',
    fs.readFileSync(ATLAS_FILE, 'utf8').includes('cityPoints: CITY_POINTS'));
  assert('Iraq same-region cities are separated on the map',
    iraqSouth.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) && minDistance(iraqSouth) >= 18,
    'minimum distance: ' + minDistance(iraqSouth).toFixed(1));
  assert('Egypt city points are separated on the map',
    egyptCore.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) && minDistance(egyptCore) >= 18,
    'minimum distance: ' + minDistance(egyptCore).toFixed(1));
  assert('Oman city points are separated on the map',
    omanCore.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) && minDistance(omanCore) >= 18,
    'minimum distance: ' + minDistance(omanCore).toFixed(1));
  assert('UAE city points are separated on the map',
    uaeCore.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) && minDistance(uaeCore) >= 12,
    'minimum distance: ' + minDistance(uaeCore).toFixed(1));
}

function verifyStaticCountryCoverage() {
  const appSource = fs.readFileSync(APP_FILE, 'utf8');
  const atlasSource = fs.readFileSync(ATLAS_FILE, 'utf8');
  const aggregatorSource = fs.readFileSync(AGGREGATOR_FILE, 'utf8');
  const codSource = fs.readFileSync(COD_FILE, 'utf8');
  const citiesSource = fs.readFileSync(CITIES_FILE, 'utf8');
  const overviewSource = fs.readFileSync(OVERVIEW_FILE, 'utf8');
  const productsSource = fs.readFileSync(PRODUCTS_FILE, 'utf8');
  const commissionSource = fs.readFileSync(COMMISSION_FILE, 'utf8');
  const masterSource = fs.readFileSync(MASTER_FILE, 'utf8');

  COUNTRY_CURRENCIES.sa = 'SAR';
  Object.entries(COUNTRY_CURRENCIES).forEach(([country, currency]) => {
    assert('country metadata includes ' + country.toUpperCase() + ' / ' + currency,
      appSource.includes(country + ': {') && appSource.includes('currency: "' + currency + '"'));
    assert('central outline includes ' + country.toUpperCase(), appSource.includes(country + ': "M'));
    assert('province metadata includes ' + country.toUpperCase(), appSource.includes(country + ': ['));
  });
  assert('central geo exposes deterministic city points', appSource.includes('function cityPoint(cityName, country, index)'));
  assert('central geo prefers atlas city points',
    appSource.includes('function resolveCityPoint(cityName, country)') &&
      appSource.includes('atlas.cityPoints || {}') &&
      atlasSource.includes('const CITY_POINTS = {'));
  assert('central geo exposes premium country shapes',
    appSource.includes('function shape(country)') &&
    appSource.includes('regions: rows(cc).map'));
  assert('amount repair lookup includes country and native currency',
    /country\s*\+\s*'\|'\s*\+\s*currency/.test(aggregatorSource));
  assert('COD section uses centralized outlines and mixed panels',
    codSource.includes('KhodGeo.outline') &&
      codSource.includes('KhodGeo.shape') &&
      codSource.includes('s4-region-shape') &&
      codSource.includes('const mixedMaps = isMixedCountry') &&
      !codSource.includes('M174 68L230'));
  assert('Cities section uses centralized outlines and mixed panels',
    citiesSource.includes('KhodGeo.outline') &&
      citiesSource.includes('KhodGeo.shape') &&
      citiesSource.includes('sc-region-shape') &&
      citiesSource.includes('mixedCountryMapsHTML') &&
      !citiesSource.includes('M174 68L230'));
  [
    ['Overview', overviewSource, 'nativeCurrency'],
    ['Products', productsSource, 'activeCurrency'],
    ['Commission', commissionSource, 'activeCurrency'],
    ['Master', masterSource, 'nativeCurrency'],
    ['COD', codSource, 'activeCurrency'],
    ['Cities', citiesSource, 'activeCurrency'],
  ].forEach(([name, source, token]) => {
    assert(name + ' section uses the active reporting currency', source.includes(token));
  });
  ['eg', 'iq', 'ae', 'om'].forEach((country) => {
    const fixture = path.join(ROOT, 'countries', 'orders-' + country + '.xlsx');
    const exists = fs.existsSync(fixture);
    assert(country.toUpperCase() + ' workbook fixture exists', exists);
    if (exists) {
      const workbook = XLSX.read(fs.readFileSync(fixture), { type: 'buffer' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const fixtureRows = firstSheet ? XLSX.utils.sheet_to_json(firstSheet, { header: 1, blankrows: false }) : [];
      assert(country.toUpperCase() + ' workbook fixture contains data', fixtureRows.length > 1);
    }
  });
  assert('Saudi workbook fixture exists',
    fs.existsSync(path.join(ROOT, 'orders-may-with -2 before date and +2 after date.xlsx')));
}

(async function main() {
  verifyStaticCountryCoverage();
  verifyIraqCityQueryMapping();
  verifyCityPointAtlas();
  const result = await runAggregator();
  const groups = result.meta.countryGroups || [];
  const saGroup = groups.find((group) => group.country === 'sa');
  const egGroup = groups.find((group) => group.country === 'eg');
  const cities = result.cod.cities || [];
  const alexandrias = cities.filter((city) => city.name === 'Alexandria');

  assert('mixed mode is detected', result.meta.activeCountry === 'mixed' && result.meta.isMixedCountry);
  assert('mixed mode defaults to persisted SAR reporting currency',
    result.meta.reportingCurrency === 'SAR' && result.meta.activeCurrency === 'SAR');
  assert('one fixed rate snapshot is exposed', result.meta.exchangeRateSource === 'fixed-test');
  assert('all sales convert before aggregation', close(result.overview.totalSales.value, 425),
    'got ' + result.overview.totalSales.value);
  assert('general profit remains inclusive of prepaid',
    close(result.overview.earnedCommission.value, 35) && close(result.overview.incomingCommission.value, 7.5));
  assert('country summary retains Saudi native totals',
    saGroup && saGroup.currency === 'SAR' && close(saGroup.nativeSales, 200) && close(saGroup.nativeAmountDue, 100));
  assert('country summary retains Egypt native totals',
    egGroup && egGroup.currency === 'EGP' && close(egGroup.nativeSales, 3000) && close(egGroup.nativeAmountDue, 1500));
  assert('country summaries expose reporting totals',
    close(saGroup && saGroup.reportingSales, 200) && close(egGroup && egGroup.reportingSales, 225));
  assert('unknown payment with prepaid-looking notes remains COD',
    result.cod.codDrBaseOrders === 2 && result.cod.prepaidDrBaseOrders === 1);
  assert('collected COD includes unknown and excludes structured prepaid',
    close(result.cod.collectedSar, 100), 'got ' + result.cod.collectedSar);
  assert('active COD gap includes explicit COD',
    close(result.cod.gapSar, 37.5), 'got ' + result.cod.gapSar);
  assert('identical city names remain separate by country',
    alexandrias.length === 2 &&
      alexandrias.some((city) => city.country === 'sa') &&
      alexandrias.some((city) => city.country === 'eg'));
  assert('map points use country-aware helper output',
    (result.cod.mapCities || []).every((city) => Number.isFinite(city.x) && Number.isFinite(city.y)));

  console.log('\nFive-country dashboard verification: ' + passed + ' passed, ' + failed + ' failed.');
  if (failed) process.exitCode = 1;
}()).catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
