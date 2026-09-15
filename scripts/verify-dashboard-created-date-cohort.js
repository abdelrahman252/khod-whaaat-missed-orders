'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('xlsx');
const { parseFullMonthSnapshot } = require('../src/bot/parser');

const ROOT = path.resolve(__dirname, '..');
const WORKBOOK = path.join(ROOT, 'TODAY ORDERS.xlsx');
const DASHBOARD_DIR = path.join(ROOT, 'src', 'renderer', 'pages', 'dashboard');
const PERIOD = { preset: 'custom', dateFrom: '2026-06-01', dateTo: '2026-06-08' };

function dateKey(value) {
  return String(value || '').slice(0, 10);
}

function inPeriod(value) {
  const key = dateKey(value);
  return key >= PERIOD.dateFrom && key <= PERIOD.dateTo;
}

function orderKey(row) {
  return String(row.taagerOrderNumber || row.orderNumber || row.orderId || row.id || row.reference || '');
}

function uniqueRows(rows, fn) {
  const seen = new Set();
  const out = [];
  rows.forEach((row) => {
    const key = fn(row);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(row);
  });
  return out;
}

function createStorage(mode) {
  const data = {
    khod_active_account_id: '__all__',
    khod_dashboard_delivered_date_mode: mode,
  };
  return {
    getItem: (key) => Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null,
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: (key) => { delete data[key]; },
  };
}

async function runAggregator(rows, mode) {
  const storage = createStorage(mode);
  const window = {
    _kbotLang: 'en',
    _kbotTheme: 'dark',
    dashboardAccountsList: [],
    currentActiveAccountLabel: 'All accounts',
    addEventListener: () => {},
    removeEventListener: () => {},
    DashboardPeriodState: { get: () => PERIOD },
    DashboardDeliveredDateState: { get: () => mode },
    DashboardExpectedNdrRangeState: { get: () => PERIOD },
    api: {
      getDashboardSnapshot: async () => ({
        ok: true,
        data: {
          todayOrders: {
            snapshot: rows,
            snapshotMonth: '2026-06',
            manualFetchTimestamp: '2026-06-08T00:00:00Z',
          },
        },
      }),
      getCredentials: async () => ({
        accounts: [{ id: 'todayOrders', label: 'TODAY ORDERS' }],
      }),
    },
  };
  window.window = window;
  window.localStorage = storage;
  window.dashboardI18n = {
    t: (key) => key,
    raw: (value) => String(value || ''),
    number: (value, opts) => Number(value || 0).toLocaleString('en-US', opts || {}),
    formatTimestamp: () => '2026-06-08 00:00',
    formatMonth: (year, monthIndex) => new Date(year, monthIndex, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    monthName: (monthIndex) => new Date(2026, monthIndex, 1).toLocaleDateString('en-US', { month: 'long' }),
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
    path.join(DASHBOARD_DIR, 'dashboard-filter-bus.js'),
    path.join(DASHBOARD_DIR, 'dashboard-aggregator-score.js'),
    path.join(DASHBOARD_DIR, 'dashboard-aggregator-geo.js'),
    path.join(DASHBOARD_DIR, 'dashboard-insight-engine.js'),
    path.join(DASHBOARD_DIR, 'dashboard-aggregator.js'),
  ].forEach((file) => vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file }));
  window.DashboardPeriodState.setCustomRange(PERIOD.dateFrom, PERIOD.dateTo);
  window.DashboardDeliveredDateState.set(mode);
  window.invalidateDashboardCache && window.invalidateDashboardCache();
  return new Promise((resolve, reject) => {
    window.runDashboardAggregator((result) => {
      if (!result) reject(new Error('Aggregator returned no result'));
      else resolve(result);
    });
  });
}

(async function main() {
  if (!fs.existsSync(WORKBOOK)) throw new Error('Missing workbook: ' + WORKBOOK);

  const workbook = XLSX.read(fs.readFileSync(WORKBOOK), { type: 'buffer', raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  const header = sheetRows[0] || [];
  assert.equal(String(header[3] || '').trim(), 'تاريخ الإنشاء');
  assert.equal(String(header[4] || '').trim(), 'اخر تحديث');

  const rows = parseFullMonthSnapshot(fs.readFileSync(WORKBOOK), {
    dateFrom: '2026-04-01',
    dateTo: '2026-06-30',
  });

  const createdPeriodOrders = uniqueRows(rows.filter((row) => inPeriod(row.createdAt || row.date || row.dashboardDate)), orderKey);
  const deliveredCreatedPeriodOrders = createdPeriodOrders.filter((row) => row.orderStatusBucket === 'delivered');
  const updatedOnlyOrders = uniqueRows(rows.filter((row) => {
    return !inPeriod(row.createdAt || row.date || row.dashboardDate) && inPeriod(row.lastUpdatedAt || row.updatedAt);
  }), orderKey);
  const updatedOnlyDelivered = updatedOnlyOrders.filter((row) => row.orderStatusBucket === 'delivered');

  assert.ok(createdPeriodOrders.length > 0, 'TODAY ORDERS has created-date rows in the selected period');
  assert.ok(updatedOnlyDelivered.length > 0, 'TODAY ORDERS has delivered rows updated inside the period but created outside it');

  const actual = await runAggregator(rows, 'actual');
  const expected = await runAggregator(rows, 'expected');
  const hiddenUpdatedDeliveredIds = new Set(updatedOnlyDelivered.map(orderKey));

  assert.equal(actual.orders.length, createdPeriodOrders.length);
  assert.equal(expected.orders.length, createdPeriodOrders.length);
  assert.equal(actual.pipeline.metrics.deliveredCount, deliveredCreatedPeriodOrders.length);
  assert.equal(expected.pipeline.metrics.deliveredCount, deliveredCreatedPeriodOrders.length);
  assert.equal(actual.overview.totalOrders.value, createdPeriodOrders.filter((row) => row.orderStatusBucket !== 'canceled_by_you').length);
  assert.equal(expected.overview.totalOrders.value, actual.overview.totalOrders.value);
  assert.equal(actual.products.rankedList.length, expected.products.rankedList.length);
  assert.equal(actual.orders.some((row) => hiddenUpdatedDeliveredIds.has(orderKey(row))), false);
  assert.equal(expected.orders.some((row) => hiddenUpdatedDeliveredIds.has(orderKey(row))), false);

  console.log('[PASS] TODAY ORDERS created-date cohort: تاريخ الإنشاء controls dashboard inclusion; اخر تحديث stays metadata.');
}()).catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
