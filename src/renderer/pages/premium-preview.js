(function () {
  "use strict";

  var dismissed = {};

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function isoDate(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function nowBase() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30, 0, 0);
  }

  function addDays(date, n) {
    var d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function statusFor(i) {
    var statuses = ["Delivered", "Delivered", "Delivered", "In Shipping", "Under processing", "Confirmed", "Failed", "Canceled"];
    return statuses[i % statuses.length];
  }

  function productFor(i) {
    return [
      { name: "Royal Oud Perfume", sku: "ROY-OUD-50", price: 189, commission: 46 },
      { name: "Glow Skin Serum", sku: "GLW-SRM-30", price: 149, commission: 34 },
      { name: "Magnetic Back Support", sku: "BCK-SUP-01", price: 219, commission: 58 },
      { name: "Smart Mini Blender", sku: "BLD-MIN-02", price: 169, commission: 42 },
      { name: "Premium Hair Oil", sku: "HAI-OIL-75", price: 129, commission: 31 }
    ][i % 5];
  }

  function cityFor(i) {
    return [
      { city: "Riyadh", region: "Riyadh" },
      { city: "Jeddah", region: "Makkah" },
      { city: "Dammam", region: "Eastern Province" },
      { city: "Makkah", region: "Makkah" },
      { city: "Madinah", region: "Madinah" },
      { city: "Abha", region: "Aseer" }
    ][i % 6];
  }

  function makeOrder(i, runOffset) {
    var base = nowBase();
    var created = addDays(base, -runOffset);
    created.setHours(9 + (i % 8), (i * 7) % 60, 0, 0);
    var updated = addDays(created, (i % 4) + 1);
    var product = productFor(i);
    var place = cityFor(i);
    var qty = (i % 6 === 0) ? 2 : 1;
    var status = statusFor(i);
    var total = product.price * qty;
    var delivered = status === "Delivered";
    return {
      name: "Preview Customer " + (i + 1),
      phone: "9665" + String(43000000 + i).padStart(8, "0"),
      productName: product.name,
      sku: product.sku,
      qty: qty,
      unitPrice: product.price,
      subtotal: total,
      totalPrice: total,
      dashboardTotalPrice: total,
      city: place.city,
      region: place.region,
      address: "Preview district, building " + (20 + i),
      date: isoDate(created),
      createdAt: isoDate(created),
      lastUpdatedAt: isoDate(updated),
      source: i % 7 === 0 ? "missed" : "real",
      orderStatus: status,
      status: status,
      amountDue: delivered ? total : (status === "Canceled" ? 0 : total),
      dashboardAmountDue: delivered ? total : (status === "Canceled" ? 0 : total),
      marketerCommission: product.commission * qty,
      khodOrderNumber: "PV-" + String(2026000 + i),
      paymentMethod: i % 4 === 0 ? "Prepaid" : "COD"
    };
  }

  function buildRuns() {
    var base = nowBase();
    var runAOrders = Array.from({ length: 24 }, function (_, i) { return makeOrder(i, 0); });
    var runBOrders = Array.from({ length: 18 }, function (_, i) { return makeOrder(i + 24, 2); });
    var emptyLatest = {
      runId: "preview-empty-latest",
      runDate: isoDate(base),
      runTimestamp: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 13, 15).getTime(),
      accountId: "preview-store",
      accountEmail: "preview@khodwhaat.com",
      accountLabel: "Preview Store",
      ordersSubmitted: 0,
      ordersFailed: 0,
      runtimeMs: 7 * 60 * 1000,
      orders: []
    };
    return [
      {
        runId: "preview-run-today",
        runDate: isoDate(base),
        runTimestamp: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 11, 20).getTime(),
        accountId: "preview-store",
        accountEmail: "preview@khodwhaat.com",
        accountLabel: "Preview Store",
        ordersSubmitted: runAOrders.length,
        ordersFailed: runAOrders.filter(function (o) { return /failed|canceled/i.test(o.orderStatus); }).length,
        runtimeMs: 22 * 60 * 1000,
        orders: runAOrders
      },
      emptyLatest,
      {
        runId: "preview-run-previous",
        runDate: isoDate(addDays(base, -2)),
        runTimestamp: new Date(base.getFullYear(), base.getMonth(), base.getDate() - 2, 16, 45).getTime(),
        accountId: "preview-store",
        accountEmail: "preview@khodwhaat.com",
        accountLabel: "Preview Store",
        ordersSubmitted: runBOrders.length,
        ordersFailed: runBOrders.filter(function (o) { return /failed|canceled/i.test(o.orderStatus); }).length,
        runtimeMs: 17 * 60 * 1000,
        orders: runBOrders
      }
    ];
  }

  function buildDashboardAccounts() {
    var rows = [];
    var start = new Date(nowBase().getFullYear(), nowBase().getMonth(), 1, 10, 0, 0, 0);
    for (var i = 0; i < 138; i++) {
      rows.push(makeOrder(i, Math.max(0, Math.floor(i / 5))));
      rows[i].createdAt = isoDate(addDays(start, i % 24));
      rows[i].date = rows[i].createdAt;
      rows[i].lastUpdatedAt = isoDate(addDays(new Date(rows[i].createdAt), (i % 5) + 1));
      rows[i].khodOrderNumber = "DASH-PV-" + String(4000 + i);
    }
    return {
      "preview-store": {
        snapshot: rows,
        snapshotMonth: isoDate(start).slice(0, 7),
        autoFetchTimestamp: Date.now()
      }
    };
  }

  function copyRuns() {
    return buildRuns().map(function (run) {
      return Object.assign({}, run, {
        orders: (run.orders || []).map(function (order) { return Object.assign({}, order); })
      });
    });
  }

  function isActive(feature) {
    if (feature === "analytics") return window._analyticsEnabled === false;
    if (feature === "operations") return window._operationsEnabled === false;
    if (feature === "dashboard") return window._dashboardEnabled === false;
    return false;
  }

  function text(feature) {
    var isAr = (window._kbotLang || document.documentElement.lang || "en") === "ar";
    var names = {
      analytics: isAr ? "التحليلات" : "Analytics",
      operations: isAr ? "العمليات" : "Operations",
      dashboard: isAr ? "لوحة التحكم" : "Dashboard"
    };
    return {
      title: isAr ? "وضع المعاينة" : "Preview Mode",
      body: isAr
        ? "هذه بيانات تجريبية لتوضيح ما ستحصل عليه بعد فتح " + names[feature] + ". عند الترقية ستظهر بياناتك الحقيقية من تشغيلات البوت وبيانات Khod المباشرة."
        : "This is sample data showing what " + names[feature] + " unlocks. Upgrade this feature to connect the page to your real bot runs and live Khod data.",
      cta: isAr ? "استكشف المعاينة" : "Explore Preview",
      upgrade: isAr ? "تواصل للترقية" : "Contact Support",
      banner: isAr
        ? "بيانات معاينة فقط. افتح الميزة لعرض بياناتك الحقيقية."
        : "Preview data shown. Unlock this feature to use your live data."
    };
  }

  function mount(root, feature) {
    if (!root || !isActive(feature)) return;
    root.setAttribute("data-premium-preview", feature);
    if (!root.style.position) root.style.position = "relative";
    var copy = text(feature);
    var banner = document.createElement("div");
    banner.className = "premium-preview-banner";
    banner.textContent = copy.banner;
    root.querySelector(".dashboard-page-main, .analytics-page, .ops-page, [style*='overflow']")?.prepend(banner);

    if (dismissed[feature]) return;
    var overlay = document.createElement("div");
    overlay.className = "premium-preview-overlay";
    overlay.innerHTML =
      '<div class="premium-preview-card" role="dialog" aria-modal="true">' +
        '<div class="premium-preview-kicker">PREVIEW</div>' +
        '<h2>' + copy.title + '</h2>' +
        '<p>' + copy.body + '</p>' +
        '<div class="premium-preview-actions">' +
          '<button type="button" class="premium-preview-primary">' + copy.cta + '</button>' +
          '<button type="button" class="premium-preview-secondary">' + copy.upgrade + '</button>' +
        '</div>' +
      '</div>';
    root.appendChild(overlay);
    overlay.querySelector(".premium-preview-primary").addEventListener("click", function () {
      dismissed[feature] = true;
      overlay.remove();
    });
    overlay.querySelector(".premium-preview-secondary").addEventListener("click", function () {
      if (window.KhodUI && typeof window.KhodUI.toast === "function") {
        window.KhodUI.toast(copy.banner, { kind: "info", timeout: 6000 });
      }
    });
  }

  window.KhodPremiumPreview = {
    isActive: isActive,
    mount: mount,
    runs: copyRuns,
    dashboardAccounts: buildDashboardAccounts
  };
})();
