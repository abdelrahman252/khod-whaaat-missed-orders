'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('xlsx');
const { parseFullMonthSnapshot } = require('../src/bot/parser');

const ROOT = path.resolve(__dirname, '..');
const WORKBOOK = path.join(ROOT, 'taager-orders-from marrch to may-SA country.xlsx');
const DASHBOARD_DIR = path.join(ROOT, 'src', 'renderer', 'pages', 'dashboard');
const PERIODS = [
  { name: 'Full sheet', preset: 'custom', dateFrom: '2026-03-01', dateTo: '2026-05-31' },
  { name: 'March', preset: 'custom', dateFrom: '2026-03-01', dateTo: '2026-03-31' },
  { name: 'April', preset: 'custom', dateFrom: '2026-04-01', dateTo: '2026-04-30' },
  { name: 'May', preset: 'custom', dateFrom: '2026-05-01', dateTo: '2026-05-31' },
];

let passed = 0;
let failed = 0;

function check(label, actual, expected, tolerance) {
  const ok = tolerance == null
    ? actual === expected
    : Math.abs(Number(actual) - Number(expected)) <= tolerance;
  if (ok) {
    console.log('[PASS] ' + label + ': ' + actual);
    passed += 1;
  } else {
    console.error('[FAIL] ' + label + ': expected ' + expected + ', got ' + actual);
    failed += 1;
  }
}

function ok(label, value, details) {
  check(label, !!value, true);
  if (!value && details) console.error('       ' + details);
}

function source(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readDashboard(relativePath) {
  return fs.readFileSync(path.join(DASHBOARD_DIR, relativePath), 'utf8');
}

function dateKey(value) {
  return String(value || '').slice(0, 10);
}

function inPeriod(value, period) {
  const key = dateKey(value);
  return !!key && key >= period.dateFrom && key <= period.dateTo;
}

function bucket(row) {
  if (row && (row.orderStatusBucket || row.exactStatusBucket || row.statusBucket)) {
    return row.orderStatusBucket || row.exactStatusBucket || row.statusBucket;
  }
  const raw = String(row && (row.orderStatus || row.status) || '').trim().toLowerCase();
  const mapped = {
    'تم التوصيل': 'delivered',
    'طلب ملغي بواسطتك': 'canceled_by_you',
    'فشل التسليم': 'failed',
    'تم التحقق من الإرجاع': 'failed',
    'العميل رفض التأكيد': 'failed',
    'قيد التوصيل': 'shipping',
    'تم تعليق التوصيل': 'shipping',
    'تم تأكيد الطلب': 'confirmed',
    'في انتظار الشحن': 'waiting',
    'معلق مؤقتًا': 'waiting',
    'انتهى من المخزن': 'waiting',
    'تم استلام الطلب': 'pending',
    'تمت خدمة ما بعد البيع': 'processing',
    'خدمة ما بعد البيع قيد التقدم': 'processing',
    delivered: 'delivered',
    completed: 'delivered',
    failed: 'failed',
    'delivery failed': 'failed',
    returned: 'failed',
    canceled: 'canceled_by_you',
    cancelled: 'canceled_by_you',
    'canceled by you': 'canceled_by_you',
    confirmed: 'confirmed',
    pending: 'pending',
    'under processing': 'pending',
    'order received': 'pending',
  };
  return mapped[raw] || row.orderStatusBucket || (row.isDelivered ? 'delivered' : 'other');
}

function isEligible(row) {
  return row.ndrEligible !== false && bucket(row) !== 'canceled_by_you';
}

function isLostBucketName(value) {
  return [
    'failed',
    'return_verified',
    'customer_refused_confirmation',
    'on_hold',
    'out_of_stock',
    'after_sales_done',
  ].includes(value);
}

function isIncomingBucketName(value) {
  return [
    'received',
    'shipping',
    'delivery_suspended',
    'confirmed',
    'waiting',
    'after_sales_progress',
  ].includes(value);
}

function isPrepaid(row) {
  return row.isPrepaid === true || String(row.paymentMethod || '').toLowerCase() !== 'cod';
}

function rowDashboardDate(row) {
  return dateKey(row.createdAt || row.date || row.dashboardDate);
}

function sum(rows, fn) {
  return rows.reduce((total, row) => total + Number(fn(row) || 0), 0);
}

function uniqueCount(rows, fn) {
  return new Set(rows.map(fn).filter(Boolean)).size;
}

function orderKey(row) {
  return String(row.taagerOrderNumber || row.orderNumber || row.orderId || row.id || row.reference || '');
}

function productOrderKey(row) {
  return orderKey(row) + '|' + String(row.sku || row.products || row.productName || row.product || '');
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

function sheetPaymentAudit() {
  const wb = XLSX.read(fs.readFileSync(WORKBOOK), { type: 'buffer', raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  const header = rows[0] || [];
  const receivedByIdx = header.findIndex((h) => String(h).trim() === 'الطلب المستلم بواسطة');
  const uniqueReceivedBy = new Set(rows.slice(1).map((row) => String(row[receivedByIdx] || '').trim()).filter(Boolean));
  const paymentHeaderHits = header.filter((h) => /payment|دفع|سداد|طريقة/i.test(String(h || '')));
  return {
    sheetNames: wb.SheetNames,
    sourceRows: Math.max(0, rows.length - 1),
    header,
    receivedByIdx,
    uniqueReceivedBy: Array.from(uniqueReceivedBy).slice(0, 10),
    paymentHeaderHits,
  };
}

function expectedFor(rows, period, deliveredMode) {
  const created = rows.filter((row) => inPeriod(rowDashboardDate(row), period));
  const orderRows = uniqueRows(created, orderKey);
  const eligibleCreated = orderRows.filter(isEligible);
  const productRows = created.filter(isEligible);
  const periodRows = orderRows;
  const ndrBaseRows = eligibleCreated;
  const delivered = orderRows.filter((row) => bucket(row) === 'delivered');
  const deliveredProductRows = uniqueRows(created.filter((row) => bucket(row) === 'delivered'), productOrderKey);
  const failed = orderRows.filter((row) => isLostBucketName(bucket(row)));
  const failedProductRows = uniqueRows(created.filter((row) => isLostBucketName(bucket(row))), productOrderKey);
  const canceled = orderRows.filter((row) => bucket(row) === 'canceled_by_you');
  const confirmed = orderRows.filter((row) => bucket(row) === 'confirmed');
  const shipping = orderRows.filter((row) => bucket(row) === 'shipping');
  const processing = orderRows.filter((row) => bucket(row) === 'processing');
  const waiting = orderRows.filter((row) => bucket(row) === 'waiting');
  const activePipeline = orderRows.filter((row) => isIncomingBucketName(bucket(row))).length;
  const createdNonDelivered = orderRows.filter((row) => bucket(row) !== 'delivered');
  const deliveredKeys = new Set(delivered.map((row) => row.taagerOrderNumber + '|' + row.sku));
  const outcome = createdNonDelivered.concat(delivered.filter((row) => !createdNonDelivered.some((other) => other.taagerOrderNumber === row.taagerOrderNumber && other.sku === row.sku)));
  const deliveredSales = sum(deliveredProductRows, (row) => row.totalPrice);
  const totalSales = sum(productRows, (row) => row.totalPrice);
  const earnedProfit = sum(delivered, (row) => row.taagerProfit);
  const lostProfit = sum(failed, (row) => row.taagerProfit);
  const incomingProfit = sum(eligibleCreated.filter((row) => bucket(row) !== 'delivered' && bucket(row) !== 'failed' && bucket(row) !== 'return_verified' && bucket(row) !== 'customer_refused_confirmation'), (row) => row.taagerProfit);
  const prepaid = eligibleCreated.filter(isPrepaid);
  const cod = eligibleCreated.filter((row) => !isPrepaid(row));
  return {
    created,
    orderRows,
    eligibleCreated,
    productRows,
    periodRows,
    ndrBaseRows,
    delivered,
    deliveredProductRows,
    failed,
    failedProductRows,
    canceled,
    confirmed,
    shipping,
    processing,
    waiting,
    activePipeline,
    outcome,
    totalSales,
    deliveredSales,
    earnedProfit,
    incomingProfit,
    lostProfit,
    prepaid,
    cod,
    uniqueProducts: uniqueCount(created, (row) => row.sku),
    rankedProducts: uniqueCount(productRows, (row) => row.sku),
    uniqueCities: uniqueCount(orderRows, (row) => row.city),
    totalPieces: sum(productRows, (row) => row.qty),
    ndrPct: ndrBaseRows.length ? Number((delivered.length / ndrBaseRows.length * 100).toFixed(1)) : 0,
    deliveredKeys,
  };
}

function createStorage() {
  const data = Object.create(null);
  return {
    getItem: (key) => Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null,
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: (key) => { delete data[key]; },
  };
}

async function runAggregator(rows, period, deliveredMode) {
  const storage = createStorage();
  storage.setItem('khod_active_account_id', '__all__');
  storage.setItem('khod_dashboard_delivered_date_mode', deliveredMode);
  const window = {
    _kbotLang: 'en',
    _kbotTheme: 'dark',
    dashboardAccountsList: [],
    currentActiveAccountLabel: 'All accounts',
    addEventListener: () => {},
    removeEventListener: () => {},
    DashboardPeriodState: { get: () => period },
    DashboardDeliveredDateState: { get: () => deliveredMode },
    api: {
      getDashboardSnapshot: async () => ({
        ok: true,
        data: {
          khodSheet: {
            snapshot: rows,
            snapshotMonth: period.dateTo.slice(0, 7),
            manualFetchTimestamp: '2026-06-01T00:00:00Z',
          },
        },
      }),
      getCredentials: async () => ({
        accounts: [{ id: 'khodSheet', easyEmail: 'khod-sheet@example.com', taagerEmail: 'khod-sheet@example.com', label: 'KHOD WHAAT sheet' }],
      }),
    },
  };
  window.window = window;
  window.localStorage = storage;
  window.dashboardI18n = {
    t: (key) => key,
    raw: (value) => String(value || ''),
    number: (value, opts) => Number(value || 0).toLocaleString('en-US', opts || {}),
    formatTimestamp: () => '2026-06-01 00:00',
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
  window.DashboardDeliveredDateState.set(deliveredMode);
  window.DashboardPeriodState.setCustomRange(period.dateFrom, period.dateTo);
  window.invalidateDashboardCache && window.invalidateDashboardCache();
  return new Promise((resolve, reject) => {
    window.runDashboardAggregator((result) => {
      if (!result) reject(new Error('Aggregator returned no result'));
      else resolve(result);
    });
  });
}

function verifySectionContracts(result, expected, periodName, deliveredMode) {
  const p = '[' + periodName + ' / ' + deliveredMode + '] ';
  const isExpectedMode = deliveredMode === 'expected';
  check(p + 'Section 8/master: total orders', result.overview.totalOrders.value, expected.eligibleCreated.length);
  if (!isExpectedMode) {
    check(p + 'Section 1/overview: earned KHOD WHAAT profit', result.overview.earnedCommission.value, expected.earnedProfit, 0.01);
    check(p + 'Section 1/overview: delivered sales', result.overview.totalDeliveredSales.value, expected.deliveredSales, 0.01);
  } else {
    ok(p + 'Section 1/overview: expected earned KHOD WHAAT profit is numeric', Number.isFinite(Number(result.overview.earnedCommission.value)));
    ok(p + 'Section 1/overview: expected delivered sales is numeric', Number.isFinite(Number(result.overview.totalDeliveredSales.value)));
  }
  ok(p + 'Section 1/overview: incoming KHOD WHAAT profit is numeric', Number.isFinite(Number(result.overview.incomingCommission.value)));
  ok(p + 'Section 1/overview: lost KHOD WHAAT profit is numeric', Number.isFinite(Number(result.overview.lostCommission.value)));
  check(p + 'Section 1/overview: total sales', result.overview.totalSales.value, expected.totalSales, 0.01);
  check(p + 'Section 2/pipeline: total orders', result.pipeline.metrics.totalOrders, expected.eligibleCreated.length);
  check(p + 'Section 2/pipeline: delivered count', result.pipeline.metrics.deliveredCount, expected.delivered.length);
  check(p + 'Section 2/pipeline: failed count', result.pipeline.metrics.failedCount, expected.failed.length);
  check(p + 'Section 2/pipeline: canceled by you count', result.pipeline.metrics.canceledByYouCount, expected.canceled.length);
  check(p + 'Section 2/pipeline: active count', result.pipeline.metrics.activeCount, expected.activePipeline);
  check(p + 'Section 2/pipeline: NDR', result.pipeline.metrics.deliveryRate, expected.ndrPct, 0.05);
  check(p + 'Section 3/orders: created/order intake rows', result.orders.length, expected.orderRows.length);
  check(p + 'Section 3/orders: outcome rows are populated', result.outcomeOrders.length >= expected.delivered.length, true);
  check(p + 'Section 4/COD: NDR base', result.cod.ndrBaseOrders, expected.ndrBaseRows.length);
  check(p + 'Section 4/COD: delivered count', result.cod.drDeliveredOrders, expected.delivered.length);
  check(p + 'Section 4/COD: payment method total', result.cod.deliveredCount, expected.prepaid.length + expected.cod.length);
  check(p + 'Section 5/products: unique products', result.products.summary.uniqueProducts, expected.uniqueProducts);
  check(p + 'Section 5/products: ranked product list length', result.products.rankedList.length, expected.rankedProducts);
  check(p + 'Section 5/products: delivered totals reconcile', result.products.rankedList.reduce((n, item) => n + (item.deliveredCount || 0), 0), expected.deliveredProductRows.length);
  check(p + 'Section 5/products: failed totals distinct', result.products.rankedList.reduce((n, item) => n + (item.failedCount || 0), 0), expected.failedProductRows.length);
  ok(p + 'Section 5/products: ranked product list is populated', result.products.rankedList.length > 0);
  check(p + 'Section cities: unique cities', Object.keys(result.geo.cityStats || {}).length, expected.uniqueCities);
  check(p + 'Section cities: delivered totals reconcile', Object.values(result.geo.cityStats || {}).reduce((n, city) => n + (city.deliveredOrders || 0), 0), expected.delivered.length);
  if (!isExpectedMode) check(p + 'Section 6/commission: total earned', result.commissionTrend.total, expected.earnedProfit, 0.01);
  else ok(p + 'Section 6/commission: expected total earned is numeric', Number.isFinite(Number(result.commissionTrend.total)));
  ok(p + 'Section 6/commission: 30-day trend exists', Array.isArray(result.commissionTrend.periods['30']));
  check(p + 'Section 7/calculator: total orders', result.roi.totalOrders, expected.eligibleCreated.length);
  check(p + 'Section 7/calculator: delivered count', result.roi.deliveredCount, expected.delivered.length);
  check(p + 'Section 7/calculator: NDR', result.roi.ndrPct, expected.ndrPct, 0.05);
  check(p + 'Section 9/product forecast: marketing/source data shell present', !!result.products.rankedList.length, true);
  check(p + 'Section prepaid: global prepaid count', (result.geo.prepaidIntelligence && result.geo.prepaidIntelligence.totalPrepaid) || 0, expected.prepaid.length);
  check(p + 'Section prepaid: global COD count', (result.geo.prepaidIntelligence && result.geo.prepaidIntelligence.totalCod) || 0, expected.cod.length);
  ok(p + 'Section KHOD WHAAT AI: certified dashboard context exists', result.overview && result.pipeline && result.products && result.geo);
}

function verifyStaticSectionCoverage() {
  console.log('\nSection wiring contract');
  const shell = readDashboard('dashboard-shell.js');
  const dashboard = readDashboard('dashboard.js');
  const sections = [
    ['master', 'renderSection8'],
    ['overview', 'renderSection1'],
    ['pipeline', 'renderSection2'],
    ['orders', 'renderSection3'],
    ['cod', 'renderSection4'],
    ['products', 'renderSection5'],
    ['cities', 'renderSectionCities'],
    ['commission', 'renderSection6'],
    ['marketing', 'renderSectionMarketingConnections'],
    ['calculator', 'renderSection7'],
    ['productForecast', 'renderSectionProductForecast'],
    ['prepaid', 'renderSectionPrepaid'],
    ['khodAi', 'renderSectionKhodAi'],
  ];
  sections.forEach(([id, renderer]) => {
    ok('Dashboard nav includes ' + id, shell.includes("{ id: '" + id + "'"));
    ok('Dashboard renderer maps ' + id, new RegExp("(?:^|\\s)" + id + "\\s*:\\s*['\"]" + renderer + "['\"]", 'm').test(shell));
  });
  ok('Dashboard transports outcome orders for order/status section', dashboard.includes('outcomeOrders: outcomeOrders'));
  ok('Dashboard period state is available', source('src/renderer/pages/dashboard/dashboard-filter-bus.js').includes('DashboardPeriodState'));
  ok('Prepaid section is wired to geo.prepaidIntelligence', source('src/renderer/pages/dashboard/sections/section-prepaid.js').includes('geo.prepaidIntelligence'));
}

(async function main() {
  if (!fs.existsSync(WORKBOOK)) throw new Error('Missing workbook: ' + WORKBOOK);
  const audit = sheetPaymentAudit();
  console.log('Workbook:', path.basename(WORKBOOK));
  console.log('Sheets:', audit.sheetNames.join(', '));
  console.log('Source rows:', audit.sourceRows);
  console.log('Payment-like headers:', audit.paymentHeaderHits.length ? audit.paymentHeaderHits.join(', ') : '(none)');
  console.log('Order received by sample:', audit.uniqueReceivedBy.join(', ') || '(empty)');
  ok('Workbook has the expected KHOD WHAAT orders sheet', audit.sheetNames.includes('الطلبات'));
  ok('Workbook does not expose a payment-method header; prepaid should be limited', audit.paymentHeaderHits.length === 0);

  const allRows = parseFullMonthSnapshot(fs.readFileSync(WORKBOOK), PERIODS[0]);
  ok('Parser produced dashboard rows from workbook', allRows.length > 0);
  ok('Parser preserved source order numbers', allRows.every((row) => row.taagerOrderNumber));
  ok('Parser preserved SKU/product column', allRows.every((row) => row.sku));
  ok('Parser preserved KHOD WHAAT profit math', allRows.some((row) => Number(row.taagerProfit) !== Number(row.profit)));

  verifyStaticSectionCoverage();

  for (const period of PERIODS) {
    for (const deliveredMode of ['actual', 'expected']) {
      console.log('\nReconciliation: ' + period.name + ' (' + period.dateFrom + '..' + period.dateTo + ') / ' + deliveredMode);
      const expected = expectedFor(allRows, period, deliveredMode);
      const result = await runAggregator(allRows, period, deliveredMode);
      check('Meta period from dashboard', result.meta.period.dateFrom + '..' + result.meta.period.dateTo, period.dateFrom + '..' + period.dateTo);
      check('Meta delivered mode from dashboard', result.meta.deliveredDateMode, deliveredMode);
      verifySectionContracts(result, expected, period.name, deliveredMode);
    }
  }

  console.log('\nResult: ' + passed + ' passed, ' + failed + ' failed');
  if (failed) process.exitCode = 1;
}()).catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
