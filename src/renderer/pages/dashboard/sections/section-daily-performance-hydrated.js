// section-daily-performance-hydrated.js - cached Daily Performance renderer.
window.renderSectionDailyPerformanceHydratedEntry = function (mountEl, data, ctx) {
  'use strict';

  var cancelled = false;
  var fullData = (ctx && ctx.data) || data || {};
  var activeCurrency = (fullData.meta && fullData.meta.activeCurrency) || window.dashboardActiveCurrency || 'SAR';
  var PAGE_SIZE = 7;
  var accountPage = Math.max(1, Number(mountEl._dailyPerformanceAccountPage) || 1);
  var productPage = Math.max(1, Number(mountEl._dailyPerformanceProductPage) || 1);
  var accountPanelOpen = mountEl._dailyPerformanceAccountOpen !== false;
  var productPanelOpen = mountEl._dailyPerformanceProductOpen === true;
  var requestSeq = 0;

  function isRtl() {
    return window.dashboardI18n ? window.dashboardI18n.isRtl() : false;
  }

  function pick(en, ar) {
    return window.dashboardI18n && typeof window.dashboardI18n.pick === 'function'
      ? window.dashboardI18n.pick(en, ar)
      : (isRtl() ? ar : en);
  }

  function tr(key, fallback) {
    var value = window.dashboardI18n ? window.dashboardI18n.t(key) : key;
    return value && value !== key ? value : fallback;
  }

  function esc(value) {
    if (window.TaagerUI && typeof window.TaagerUI.esc === 'function') return window.TaagerUI.esc(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function icon(name) {
    return window.icon ? window.icon(name, { size: 15, color: 'currentColor' }) : '';
  }

  function num(value, decimals) {
    value = Number(value || 0);
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals || 0,
      maximumFractionDigits: decimals || 0
    });
  }

  function money(value) {
    if (window.formatDashboardMoney) return window.formatDashboardMoney(Number(value || 0), activeCurrency, 2);
    return num(value, 2) + ' ' + activeCurrency;
  }

  function pct(value) {
    value = Number(value || 0);
    return value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }

  function toneFor(row) {
    row = row || {};
    if (Number(row.netOrders || 0) <= 0) return 'neutral';
    if (Number(row.netProfit || 0) < 0) return 'danger';
    if (Number(row.cpa || 0) > 0 && Number(row.breakEvenCpa || 0) > 0 && Number(row.cpa || 0) > Number(row.breakEvenCpa || 0)) return 'warn';
    if (Number(row.ndr || 0) >= 35 && Number(row.confirmationRate || 0) >= 65) return 'good';
    return 'info';
  }

  function verdict(row) {
    var tone = toneFor(row);
    if (tone === 'danger') return pick('Losing', 'خاسر');
    if (tone === 'warn') return pick('CPA pressure', 'ضغط CPA');
    if (tone === 'good') return pick('Healthy', 'صحي');
    if (Number(row && row.netOrders || 0) <= 0) return pick('No orders', 'لا طلبات');
    return pick('Watch', 'راقب');
  }

  function productVerdict(row) {
    if (Number(row.netOrders || 0) < 3) return pick('Low sample', 'عينة قليلة');
    if (Number(row.netProfit || 0) < 0) return pick('Review spend', 'راجع الإنفاق');
    if (Number(row.confirmationRate || 0) < 45) return pick('Fix confirmation', 'أصلح التأكيد');
    if (Number(row.ndr || 0) < 20) return pick('Fix delivery', 'أصلح التسليم');
    if (Number(row.cpa || 0) > 0 && Number(row.breakEvenCpa || 0) > 0 && Number(row.cpa || 0) <= Number(row.breakEvenCpa || 0)) return pick('Scale candidate', 'مرشح للتوسع');
    return pick('Watch', 'راقب');
  }

  function summaryCard(label, value, sub, tone) {
    return '<div class="dp-summary-card dp-tone-' + esc(tone || 'neutral') + '">' +
      '<span>' + esc(label) + '</span>' +
      '<strong>' + value + '</strong>' +
      '<small>' + esc(sub || '') + '</small>' +
    '</div>';
  }

  function sectionHeader(id, title, sub, open) {
    return '<button type="button" class="dp-panel-toggle" data-dp-panel-toggle="' + esc(id) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
      '<span class="dp-panel-icon">' + icon('chevronDown') + '</span>' +
      '<span><strong>' + esc(title) + '</strong><small>' + esc(sub || '') + '</small></span>' +
    '</button>';
  }

  function platformChips(spend) {
    var rows = Object.keys(spend || {}).filter(function (key) { return Number(spend[key] || 0) > 0; });
    if (!rows.length) return '<span class="dp-empty-mini">' + esc(pick('No synced spend', 'لا يوجد إنفاق مزامن')) + '</span>';
    return rows.sort().map(function (key) {
      return '<span class="dp-chip"><bdi dir="auto">' + esc(key) + '</bdi><strong>' + esc(money(spend[key])) + '</strong></span>';
    }).join('');
  }

  function sourceChips(sources) {
    sources = Array.isArray(sources) ? sources.slice(0, 6) : [];
    if (!sources.length) return '<span class="dp-empty-mini">' + esc(pick('No source values', 'لا توجد مصادر')) + '</span>';
    return sources.map(function (source) {
      return '<span class="dp-chip"><bdi dir="auto">' + esc(source.label || 'Unknown') + '</bdi><strong>' + esc(num(source.netOrders || 0)) + '</strong></span>';
    }).join('');
  }

  function accountRow(day, index) {
    var m = day.metrics || {};
    var tone = toneFor(m);
    return '<tbody class="dp-day-group" data-dp-day-group="' + index + '">' +
      '<tr class="dp-account-row" data-dp-day-toggle="' + index + '">' +
        '<td><button type="button" class="dp-expand-btn" aria-expanded="false">' + icon('chevronDown') + '</button><strong>' + esc(day.date || '') + '</strong></td>' +
        '<td>' + num(m.netOrders || 0) + '</td>' +
        '<td>' + money(m.adSpend || 0) + '</td>' +
        '<td>' + money(m.cpa || 0) + '</td>' +
        '<td>' + num(m.confirmedOrders || 0) + ' <small>' + pct(m.confirmationRate) + '</small></td>' +
        '<td>' + num(m.deliveredOrders || 0) + ' <small>' + pct(m.ndr) + '</small></td>' +
        '<td>' + money(m.deliveredProfit || 0) + '</td>' +
        '<td class="' + (Number(m.netProfit || 0) >= 0 ? 'dp-good-text' : 'dp-danger-text') + '">' + money(m.netProfit || 0) + '</td>' +
        '<td><span class="dp-verdict dp-verdict-' + esc(tone) + '">' + esc(verdict(m)) + '</span></td>' +
      '</tr>' +
      '<tr class="dp-detail-row" hidden><td colspan="9">' +
        '<div class="dp-detail-grid">' +
          '<div><h4>' + esc(pick('Spend by platform', 'الإنفاق حسب المنصة')) + '</h4><div class="dp-chip-list">' + platformChips(day.platformSpend) + '</div></div>' +
          '<div><h4>' + esc(pick('Order sources', 'مصادر الطلبات')) + '</h4><div class="dp-chip-list">' + sourceChips(day.sources) + '</div></div>' +
          '<div class="dp-status-strip">' +
            '<span>' + esc(pick('Failed', 'فاشل')) + '<strong>' + num(m.failedOrders || 0) + '</strong></span>' +
            '<span>' + esc(pick('Pending', 'معلق')) + '<strong>' + num(m.pendingOrders || 0) + '</strong></span>' +
            '<span>' + esc(pick('Shipping', 'شحن')) + '<strong>' + num(m.shippingOrders || 0) + '</strong></span>' +
            '<span>' + esc(pick('Canceled by you', 'ملغي بواسطتك')) + '<strong>' + num(m.canceledByYou || 0) + '</strong></span>' +
          '</div>' +
        '</div>' +
      '</td></tr>' +
    '</tbody>';
  }

  function productRows(day) {
    var products = Array.isArray(day.products) ? day.products : [];
    if (!products.length) {
      return '<tr><td colspan="10" class="dp-empty">' + esc(pick('No product rows for this day.', 'لا توجد صفوف منتجات لهذا اليوم.')) + '</td></tr>';
    }
    return products.map(function (p) {
      var tone = toneFor(p);
      var name = p.name || p.sku || 'Unknown Product';
      var sku = p.sku ? '<small dir="ltr">' + esc(p.sku) + '</small>' : '';
      return '<tr>' +
        '<td><bdi dir="auto">' + esc(name) + '</bdi>' + sku + '</td>' +
        '<td>' + num(p.netOrders || 0) + '</td>' +
        '<td>' + money(p.adSpend || 0) + '</td>' +
        '<td>' + money(p.cpa || 0) + '</td>' +
        '<td>' + num(p.confirmedOrders || 0) + ' <small>' + pct(p.confirmationRate) + '</small></td>' +
        '<td>' + num(p.deliveredOrders || 0) + ' <small>' + pct(p.ndr) + '</small></td>' +
        '<td>' + money(p.breakEvenCpa || 0) + '</td>' +
        '<td>' + money(p.deliveredProfit || 0) + '</td>' +
        '<td class="' + (Number(p.netProfit || 0) >= 0 ? 'dp-good-text' : 'dp-danger-text') + '">' + money(p.netProfit || 0) + '</td>' +
        '<td><span class="dp-verdict dp-verdict-' + esc(tone) + '">' + esc(productVerdict(p)) + '</span></td>' +
      '</tr>';
    }).join('');
  }

  function productDayRow(day, index) {
    var m = day.metrics || {};
    return '<tbody class="dp-product-day-group" data-dp-product-day-group="' + index + '">' +
      '<tr class="dp-product-day-row" data-dp-product-day-toggle="' + index + '">' +
        '<td><button type="button" class="dp-expand-btn" aria-expanded="false">' + icon('chevronDown') + '</button><strong>' + esc(day.date || '') + '</strong><small>' + esc(num(day.productCount || 0) + ' ' + pick('products', 'منتج')) + '</small></td>' +
        '<td>' + num(m.netOrders || 0) + '</td>' +
        '<td>' + money(m.adSpend || 0) + '</td>' +
        '<td>' + money(m.cpa || 0) + '</td>' +
        '<td>' + num(m.deliveredOrders || 0) + '</td>' +
        '<td>' + pct(m.ndr) + '</td>' +
        '<td class="' + (Number(m.netProfit || 0) >= 0 ? 'dp-good-text' : 'dp-danger-text') + '">' + money(m.netProfit || 0) + '</td>' +
      '</tr>' +
      '<tr class="dp-product-detail-row" hidden><td colspan="7">' +
        '<div class="dp-nested-table-wrap"><table class="dp-nested-table"><thead><tr>' +
          '<th>' + esc(pick('Product', 'المنتج')) + '</th>' +
          '<th>' + esc(pick('Orders', 'الطلبات')) + '</th>' +
          '<th>' + esc(pick('Spend', 'الإنفاق')) + '</th>' +
          '<th>CPA</th><th>' + esc(pick('Confirmed', 'مؤكد')) + '</th>' +
          '<th>' + esc(pick('Delivered', 'مسلم')) + '</th>' +
          '<th>' + esc(pick('Break-even', 'التعادل')) + '</th>' +
          '<th>' + esc(pick('Profit', 'الربح')) + '</th>' +
          '<th>P&L</th><th>' + esc(pick('Decision', 'القرار')) + '</th>' +
        '</tr></thead><tbody>' + productRows(day) + '</tbody></table></div>' +
      '</td></tr>' +
    '</tbody>';
  }

  function paginationHtml(part, pagination) {
    pagination = pagination || {};
    var totalPages = Math.max(1, Number(pagination.totalPages || 1));
    var page = Math.max(1, Math.min(totalPages, Number(pagination.page || 1)));
    if (totalPages <= 1) {
      return '<div class="dp-pagination dp-pagination-single"><span>' + esc(pick('Page 1 of 1', 'صفحة 1 من 1')) + '</span></div>';
    }
    var buttons = [];
    var start = Math.max(1, page - 2);
    var end = Math.min(totalPages, page + 2);
    if (start > 1) buttons.push({ page: 1, label: '1' });
    if (start > 2) buttons.push({ gap: true });
    for (var i = start; i <= end; i++) buttons.push({ page: i, label: String(i), active: i === page });
    if (end < totalPages - 1) buttons.push({ gap: true });
    if (end < totalPages) buttons.push({ page: totalPages, label: String(totalPages) });
    return '<div class="dp-pagination" role="navigation" aria-label="' + esc(pick('Daily Performance pages', 'صفحات الأداء اليومي')) + '">' +
      '<button type="button" data-dp-page-part="' + esc(part) + '" data-dp-page="' + Math.max(1, page - 1) + '" ' + (page <= 1 ? 'disabled' : '') + '>' + esc(pick('Previous', 'السابق')) + '</button>' +
      buttons.map(function (item) {
        if (item.gap) return '<span class="dp-page-gap">...</span>';
        return '<button type="button" data-dp-page-part="' + esc(part) + '" data-dp-page="' + item.page + '" class="' + (item.active ? 'is-active' : '') + '" ' + (item.active ? 'aria-current="page"' : '') + '>' + esc(item.label) + '</button>';
      }).join('') +
      '<button type="button" data-dp-page-part="' + esc(part) + '" data-dp-page="' + Math.min(totalPages, page + 1) + '" ' + (page >= totalPages ? 'disabled' : '') + '>' + esc(pick('Next', 'التالي')) + '</button>' +
      '<span class="dp-page-count">' + esc(pick('Page', 'صفحة')) + ' ' + num(page) + ' / ' + num(totalPages) + '</span>' +
    '</div>';
  }

  function renderModel(model) {
    var accountDays = Array.isArray(model && model.accountDays) ? model.accountDays : (Array.isArray(model && model.days) ? model.days : []);
    var productDays = Array.isArray(model && model.productDays) ? model.productDays : accountDays;
    var summary = model && model.summary || {};
    var accountPagination = model && model.accountPagination || model && model.pagination || { page: 1, totalPages: 1, total: accountDays.length };
    var productPagination = model && model.productPagination || { page: 1, totalPages: 1, total: productDays.length };
    activeCurrency = model && model.currency || activeCurrency;
    mountEl.innerHTML = '<section class="daily-performance-section" dir="' + (isRtl() ? 'rtl' : 'ltr') + '">' +
      '<div class="dp-header">' +
        '<div><p>' + esc(tr('nav.dailyPerformance', pick('Daily Performance', 'الأداء اليومي'))) + '</p><h2>' + esc(pick('Account and product calculator results per day', 'نتائج حاسبة الحساب والمنتج يوما بيوم')) + '</h2></div>' +
        '<span class="dp-note">' + esc(pick('Read-only. Uses the selected dashboard period and calculator spend.', 'قراءة فقط. يستخدم فترة لوحة التحكم وإنفاق الحاسبة.')) + '</span>' +
      '</div>' +
      '<div class="dp-summary-grid">' +
        summaryCard(pick('Days', 'الأيام'), num(accountPagination.total || accountDays.length), pick('paginated daily rows', 'صفوف يومية مقسمة'), 'info') +
        summaryCard(pick('Net orders', 'صافي الطلبات'), num(summary.netOrders || 0), pick('raw minus canceled by you', 'الخام ناقص ملغي بواسطتك'), 'neutral') +
        summaryCard(pick('Ad spend', 'الإنفاق'), money(summary.adSpend || 0), money(summary.cpa || 0) + ' CPA', 'info') +
        summaryCard(pick('Delivered', 'المسلم'), num(summary.deliveredOrders || 0), pct(summary.ndr) + ' NDR', 'good') +
        summaryCard('P&L', money(summary.netProfit || 0), pct(summary.roi) + ' ROI', Number(summary.netProfit || 0) >= 0 ? 'good' : 'danger') +
      '</div>' +
      '<div class="dp-panel ' + (accountPanelOpen ? 'is-open' : '') + '" data-dp-panel="account">' +
        sectionHeader('account', pick('Daily Account Performance', 'أداء الحساب اليومي'), pick('Account Calculator metrics without changing the date filter.', 'مؤشرات حاسبة الحساب بدون تغيير فلتر التاريخ.'), accountPanelOpen) +
        '<div class="dp-panel-body" ' + (accountPanelOpen ? '' : 'hidden') + '><div class="dp-table-wrap"><table class="dp-table"><thead><tr>' +
          '<th>' + esc(pick('Date', 'التاريخ')) + '</th><th>' + esc(pick('Orders', 'الطلبات')) + '</th><th>' + esc(pick('Spend', 'الإنفاق')) + '</th><th>CPA</th><th>' + esc(pick('Confirmed', 'مؤكد')) + '</th><th>' + esc(pick('Delivered', 'مسلم')) + '</th><th>' + esc(pick('Profit', 'الربح')) + '</th><th>P&L</th><th>' + esc(pick('Status', 'الحالة')) + '</th>' +
        '</tr></thead>' + (accountDays.length ? accountDays.map(accountRow).join('') : '<tbody><tr><td colspan="9" class="dp-empty">' + esc(pick('No daily dashboard data for this period.', 'لا توجد بيانات يومية لهذه الفترة.')) + '</td></tr></tbody>') + '</table></div>' + paginationHtml('account', accountPagination) + '</div>' +
      '</div>' +
      '<div class="dp-panel ' + (productPanelOpen ? 'is-open' : '') + '" data-dp-panel="products">' +
        sectionHeader('products', pick('Daily Product Performance', 'أداء المنتجات اليومي'), pick('Product Calculator metrics grouped by day.', 'مؤشرات حاسبة المنتجات مقسمة حسب اليوم.'), productPanelOpen) +
        '<div class="dp-panel-body" ' + (productPanelOpen ? '' : 'hidden') + '><div class="dp-table-wrap"><table class="dp-table dp-product-day-table"><thead><tr>' +
          '<th>' + esc(pick('Date', 'التاريخ')) + '</th><th>' + esc(pick('Orders', 'الطلبات')) + '</th><th>' + esc(pick('Spend', 'الإنفاق')) + '</th><th>CPA</th><th>' + esc(pick('Delivered', 'مسلم')) + '</th><th>NDR</th><th>P&L</th>' +
        '</tr></thead>' + (productDays.length ? productDays.map(productDayRow).join('') : '<tbody><tr><td colspan="7" class="dp-empty">' + esc(pick('No product data for this period.', 'لا توجد بيانات منتجات لهذه الفترة.')) + '</td></tr></tbody>') + '</table></div>' + paginationHtml('products', productPagination) + '</div>' +
      '</div>' +
    '</section>';

    bindInteractions();
  }

  function bindInteractions() {
    mountEl.querySelectorAll('[data-dp-panel-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        var panel = button.closest('[data-dp-panel]');
        var body = panel && panel.querySelector('.dp-panel-body');
        if (!body) return;
        var open = body.hidden;
        body.hidden = !open;
        panel.classList.toggle('is-open', open);
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (panel.getAttribute('data-dp-panel') === 'products') {
          productPanelOpen = open;
          mountEl._dailyPerformanceProductOpen = open;
        } else {
          accountPanelOpen = open;
          mountEl._dailyPerformanceAccountOpen = open;
        }
      });
    });
    mountEl.querySelectorAll('[data-dp-day-toggle], [data-dp-product-day-toggle]').forEach(function (row) {
      row.addEventListener('click', function (event) {
        if (event.target && event.target.closest && event.target.closest('a,button:not(.dp-expand-btn)')) return;
        var group = row.closest('tbody');
        var detail = group && group.querySelector('.dp-detail-row, .dp-product-detail-row');
        var btn = row.querySelector('.dp-expand-btn');
        if (!detail) return;
        var opening = detail.hidden;
        detail.hidden = !opening;
        group.classList.toggle('is-open', opening);
        if (btn) btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
      });
    });
    mountEl.querySelectorAll('[data-dp-page]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (button.disabled) return;
        var part = button.getAttribute('data-dp-page-part') || 'account';
        var page = Math.max(1, Number(button.getAttribute('data-dp-page')) || 1);
        if (part === 'products') {
          if (page === productPage) return;
          productPage = page;
          mountEl._dailyPerformanceProductPage = productPage;
        } else {
          if (page === accountPage) return;
          accountPage = page;
          mountEl._dailyPerformanceAccountPage = accountPage;
        }
        setPanelLoading(part, true);
        loadPages(part);
      });
    });
  }

  function setPanelLoading(part, loading) {
    var panel = mountEl.querySelector('[data-dp-panel="' + (part === 'products' ? 'products' : 'account') + '"]');
    if (!panel) return;
    panel.classList.toggle('is-page-loading', !!loading);
    panel.querySelectorAll('[data-dp-page]').forEach(function (button) {
      button.disabled = !!loading || button.disabled;
    });
  }

  function renderLoading() {
    mountEl.innerHTML = '<section class="daily-performance-section" dir="' + (isRtl() ? 'rtl' : 'ltr') + '">' +
      '<div class="dp-loading"><span class="dp-spinner" aria-hidden="true"></span><strong>' + esc(pick('Preparing daily performance...', 'جاري تجهيز الأداء اليومي...')) + '</strong><span>' + esc(pick('Only one page of each table is rendered.', 'يتم عرض صفحة واحدة فقط من كل جدول.')) + '</span></div>' +
    '</section>';
  }

  function renderError(message) {
    mountEl.innerHTML = '<section class="daily-performance-section" dir="' + (isRtl() ? 'rtl' : 'ltr') + '">' +
      '<div class="dp-empty-state"><strong>' + esc(pick('Daily Performance is unavailable right now.', 'الأداء اليومي غير متاح الآن.')) + '</strong><span>' + esc(message || '') + '</span></div>' +
    '</section>';
  }

  var accountId = fullData && fullData.meta && fullData.meta.activeAccountId
    ? fullData.meta.activeAccountId
    : (window.getActiveAccountId ? window.getActiveAccountId() : '__all__');
  var roiFallback = fullData && fullData.roi || { adSpend: 0, currency: activeCurrency, egpRate: 52 };
  var roiState = window.DashboardRoiState && typeof window.DashboardRoiState.get === 'function'
    ? window.DashboardRoiState.get(accountId, roiFallback)
    : roiFallback;

  function loadPages(loadingPart) {
    var seq = ++requestSeq;
    if (!loadingPart) renderLoading();
    if (!window.DashboardQueryRuntime || typeof window.DashboardQueryRuntime.query !== 'function') {
      renderError('DASHBOARD_QUERY_UNAVAILABLE');
      return;
    }
    window.DashboardQueryRuntime.query('daily-performance', {
      accountPage: accountPage,
      accountPageSize: PAGE_SIZE,
      productPage: productPage,
      productPageSize: PAGE_SIZE,
      accountAdSpend: Number(roiState && roiState.adSpend || 0),
      accountSpendCurrency: roiState && roiState.currency || activeCurrency,
      productFinancialCurrency: activeCurrency,
      egpRate: Number(roiState && roiState.egpRate || 52),
      timeoutMs: 12000,
      requestChannel: 'daily-performance'
    }, fullData).then(function (result) {
      if (cancelled || !mountEl.isConnected || seq !== requestSeq) return;
      if (!result || !result.ok) {
        renderError(result && (result.error || result.kind) || 'DASHBOARD_QUERY_FAILED');
        return;
      }
      var accountTotalPages = result.accountPagination && Number(result.accountPagination.totalPages || 1) || 1;
      var productTotalPages = result.productPagination && Number(result.productPagination.totalPages || 1) || 1;
      if (accountPage > accountTotalPages || productPage > productTotalPages) {
        accountPage = Math.min(accountPage, accountTotalPages);
        productPage = Math.min(productPage, productTotalPages);
        mountEl._dailyPerformanceAccountPage = accountPage;
        mountEl._dailyPerformanceProductPage = productPage;
        loadPages(loadingPart);
        return;
      }
      renderModel(result);
      mountEl.dataset.dashboardReady = 'dailyPerformance';
    }).catch(function (error) {
      if (!cancelled && seq === requestSeq) renderError(error && error.message ? error.message : String(error || 'DASHBOARD_QUERY_FAILED'));
    });
  }

  loadPages();

  mountEl._dashboardSectionCleanup = function () {
    cancelled = true;
  };
  return mountEl._dashboardSectionCleanup;
};
