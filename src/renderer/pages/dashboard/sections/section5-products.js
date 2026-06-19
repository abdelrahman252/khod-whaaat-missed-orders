window.renderSection5 = function (mountEl, data, ctx) {
  const isAr = window.dashboardI18n
    ? window.dashboardI18n.currentLocale === "ar"
    : true;
  function s5Txt(en, ar) {
    return isAr ? ar : en;
  }
  function tx(key) {
    var str = window.dashboardI18n ? window.dashboardI18n.t(key) : key;
    return str || key;
  }
  function p5Txt(key) {
    return tx("products." + key);
  }

  if (!mountEl) return;

  var productCleanupTasks = [
    function () {
      mountEl._s5RenderToken = (mountEl._s5RenderToken || 0) + 1;
    },
  ];
  function addProductCleanup(cleanup) {
    if (typeof cleanup === "function") productCleanupTasks.push(cleanup);
  }
  mountEl._dashboardSectionCleanup = function () {
    productCleanupTasks.splice(0).forEach(function (fn) {
      fn();
    });
  };

  const renderToken = (mountEl._s5RenderToken || 0) + 1;
  mountEl._s5RenderToken = renderToken;
  if (!mountEl.isConnected || mountEl._s5RenderToken !== renderToken) return;

    function _animateNumber(el, target, opts) {
      if (!el) return;
      opts = opts || {};
      const decimals = opts && opts.decimals != null ? opts.decimals : 0;
      const to = Number(target) || 0;
      const fmt = function (value) {
        return opts.compact
          ? productCompactNumber(value, decimals, opts.compactThreshold || 10000)
          : productNumber(value, decimals);
      };
      el.classList.add("s5-number-fit");
      el.title = productNumber(to, decimals);
      el.textContent = fmt(to);
    }

    function esc(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function attr(value) {
      return esc(value).replace(/`/g, "&#96;");
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ data defaults Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const pd = data && data.products ? data.products : null;
    const activeCurrency =
      (data && data.meta && data.meta.activeCurrency) ||
      window.dashboardActiveCurrency ||
      "SAR";

    const PRODUCTS_DEFAULT = [
      {
        rank: 1,
        name: "Ã™Æ’Ã˜Â±Ã™Å Ã™â€¦ Ã˜Â§Ã™â€žÃ˜ÂªÃ™ÂÃ˜ÂªÃ™Å Ã˜Â­ Ã˜Â§Ã™â€žÃ™â€¦Ã™Æ’Ã˜Â«Ã™Â",
        cat: "SKU: N/A",
        deliveries: 34,
        sharePct: 36.2,
        revenue: 1428,
        delta: 18.4,
        spark: [700, 850, 950, 1050, 1180, 1300, 1428],
        sparkColor: "#00e676",
        accent: "#fbbf24",
        placedCount: 94,
        commission: 1428,
        deliveredCount: 34,
        totalPieces: 94,
        failedCount: 5,
        canceledCount: 20,
        confirmedCount: 10,
        shippingCount: 8,
        processingCount: 4,
        confirmationPct: 59.6,
        cancelPct: 21.3,
        ndrPct: 37.0,
        deliveryPct: 36.2,
        cityBreakdown: [
          { name: "Ã˜Â§Ã™â€žÃ˜Â±Ã™Å Ã˜Â§Ã˜Â¶", count: 40 },
          { name: "Ã˜Â¬Ã˜Â¯Ã˜Â©", count: 28 },
          { name: "Ã˜Â§Ã™â€žÃ˜Â¯Ã™â€¦Ã˜Â§Ã™â€¦", count: 16 },
        ],
        piecesBreakdown: [
          { qty: "1", count: 60, delivered: 20, ndr: 33.3 },
          { qty: "2", count: 24, delivered: 10, ndr: 41.7 },
          { qty: "3", count: 10, delivered: 4, ndr: 40 },
        ],
      },
      {
        rank: 2,
        name: "Ã˜Â³Ã™Å Ã˜Â±Ã™Ë†Ã™â€¦ Ã˜Â§Ã™â€žÃ™Æ’Ã™Ë†Ã™â€žÃ˜Â§Ã˜Â¬Ã™Å Ã™â€ ",
        cat: "SKU: N/A",
        deliveries: 22,
        sharePct: 23.4,
        revenue: 924,
        delta: 15.7,
        spark: [500, 590, 660, 730, 800, 870, 924],
        sparkColor: "#a855f7",
        accent: "#a855f7",
        placedCount: 60,
        commission: 924,
        deliveredCount: 22,
        totalPieces: 60,
        failedCount: 7,
        canceledCount: 25,
        confirmedCount: 5,
        shippingCount: 4,
        processingCount: 3,
        confirmationPct: 56.7,
        cancelPct: 41.7,
        ndrPct: 53.2,
        deliveryPct: 36.7,
        cityBreakdown: [
          { name: "Ã˜Â§Ã™â€žÃ˜Â±Ã™Å Ã˜Â§Ã˜Â¶", count: 24 },
          { name: "Ã™â€¦Ã™Æ’Ã˜Â©", count: 18 },
          { name: "Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã™Å Ã™â€ Ã˜Â©", count: 10 },
        ],
        piecesBreakdown: [
          { qty: "1", count: 48, delivered: 18, ndr: 37.5 },
          { qty: "2", count: 12, delivered: 4, ndr: 33.3 },
        ],
      },
      {
        rank: 3,
        name: "Ã™â€¦Ã˜Â¬Ã™â€¦Ã™Ë†Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜Â§Ã™Å Ã˜Â© Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â´Ã˜Â±Ã˜Â©",
        cat: "SKU: N/A",
        deliveries: 19,
        sharePct: 20.2,
        revenue: 798,
        delta: 12.1,
        spark: [600, 660, 700, 730, 755, 775, 798],
        sparkColor: "#14b8a6",
        accent: "#14b8a6",
        placedCount: 50,
        commission: 798,
        deliveredCount: 19,
        totalPieces: 50,
        failedCount: 3,
        canceledCount: 12,
        confirmedCount: 6,
        shippingCount: 5,
        processingCount: 4,
        confirmationPct: 68.0,
        cancelPct: 24.0,
        ndrPct: 38.7,
        deliveryPct: 38.0,
        cityBreakdown: [
          { name: "Ã˜Â¬Ã˜Â¯Ã˜Â©", count: 20 },
          { name: "Ã˜Â§Ã™â€žÃ˜Â±Ã™Å Ã˜Â§Ã˜Â¶", count: 16 },
          { name: "Ã˜Â§Ã™â€žÃ˜Â·Ã˜Â§Ã˜Â¦Ã™Â", count: 8 },
        ],
        piecesBreakdown: [
          { qty: "1", count: 35, delivered: 14, ndr: 40 },
          { qty: "2", count: 12, delivered: 4, ndr: 33.3 },
          { qty: "3", count: 3, delivered: 1, ndr: 33.3 },
        ],
      },
    ];

    const STAT_CARDS_DEFAULT = [
      {
        label: s5Txt(
          "Total Products Sold",
          "Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¨Ã˜Â§Ã˜Â¹Ã˜Â©",
        ),
        value: 0,
        unit: s5Txt("unique products", "Ã™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬ Ã™â€¦Ã˜Â®Ã˜ÂªÃ™â€žÃ™Â"),
        color: "#a855f7",
        iconType: "grid",
      },
      {
        label: s5Txt(
          "Total Orders",
          "Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã™ÂÃ˜Â³Ã˜Â¬Ã™â€žÃ˜Â©",
        ),
        value: 0,
        unit: s5Txt("orders", "Ã˜Â·Ã™â€žÃ˜Â¨"),
        color: "#14b8a6",
        iconType: "box",
      },
      {
        label: s5Txt(
          "Total Pieces Sold",
          "Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ™â€šÃ˜Â·Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã™ÂÃ˜Â¨Ã˜Â§Ã˜Â¹Ã˜Â©",
        ),
        value: 0,
        unit: s5Txt("pieces", "Ã™â€šÃ˜Â·Ã˜Â¹Ã˜Â©"),
        color: "#3b82f6",
        iconType: "pieces",
      },
      {
        label: s5Txt(
          "Total Earned Commission",
          "Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™Ë†Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã™â€šÃ™â€šÃ˜Â©",
        ),
        value: 0,
        unit: "SAR",
        color: "#f59e0b",
        iconType: "coins",
      },
      {
        label: s5Txt(
          "Products generating 80% of commission",
          "Ã™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â­Ã™â€šÃ™â€š 80% Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™Ë†Ã™â€žÃ˜Â©",
        ),
        value: 1,
        unit: s5Txt("products only", "Ã™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Âª Ã™ÂÃ™â€šÃ˜Â·"),
        color: "#ef4444",
        iconType: "pie",
      },
    ];

    const INSIGHTS_DEFAULT = [
      {
        emoji: "Ã°Å¸Ââ€ ",
        bg: "rgba(0,230,118,0.12)",
        border: "rgba(0,230,118,0.28)",
        iconGlow: "#00e676",
        label: s5Txt(
          "Best Commission Performance",
          "Ã˜Â£Ã™ÂÃ˜Â¶Ã™â€ž Ã˜Â£Ã˜Â¯Ã˜Â§Ã˜Â¡ Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™Ë†Ã™â€žÃ˜Â©",
        ),
        value: "Ã¢â‚¬â€",
        detail: "Ã˜Â¬Ã˜Â§Ã˜Â±Ã™Å  Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™â€¦Ã™Å Ã™â€ž...",
        detailColor: "#fbbf24",
      },
      {
        emoji: "Ã°Å¸â€œÅ ",
        bg: "rgba(59,130,246,0.12)",
        border: "rgba(59,130,246,0.28)",
        iconGlow: "#3b82f6",
        label: s5Txt(
          "Highest Commission Concentration",
          "Ã˜Â£Ã˜Â¹Ã™â€žÃ™â€° Ã˜ÂªÃ˜Â±Ã™Æ’Ã™Å Ã˜Â² Ã™â€žÃ™â€žÃ˜Â¹Ã™â€¦Ã™Ë†Ã™â€žÃ˜Â©",
        ),
        value: s5Txt("Top 3 products", "Ã˜Â£Ã™Ë†Ã™â€ž 3 Ã™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Âª"),
        detail: "Ã¢â‚¬â€",
        detailColor: "#3b82f6",
      },
    ];

    let PRODUCTS_RAW = PRODUCTS_DEFAULT;
    let STAT_CARDS = STAT_CARDS_DEFAULT;
    let INSIGHTS = INSIGHTS_DEFAULT;
    const productAccountId =
      data && data.meta && data.meta.activeAccountId
        ? data.meta.activeAccountId
        : window.getActiveAccountId
          ? window.getActiveAccountId()
          : "__all__";
    const roiFallback = (data && data.roi) || {
      adSpend: 0,
      currency: "SAR",
    };
    let productFinancialSettings = window.DashboardRoiState
      ? window.DashboardRoiState.get(productAccountId, roiFallback)
      : roiFallback;
    let productMarketingState = window.DashboardMarketingState
      ? window.DashboardMarketingState.get(productAccountId)
      : null;
    let refreshProductModal = function () {};
    let refreshProductCompareModal = function () {};

    function selectedCurrency() {
      var currency = String(
        productFinancialSettings.currency || "SAR",
      ).toUpperCase();
      if (window.TaagerCurrency && window.TaagerCurrency.cleanCurrency) {
        return window.TaagerCurrency.cleanCurrency(currency, window.dashboardActiveCurrency || "SAR");
      }
      return ["SAR", "USD"].indexOf(currency) !== -1
        ? currency
        : (window.dashboardActiveCurrency || "SAR");
    }
    if (STAT_CARDS && STAT_CARDS[3]) STAT_CARDS[3].unit = selectedCurrency();

    function supportedProductCurrencies() {
      if (window.TaagerCurrency && Array.isArray(window.TaagerCurrency.supported)) {
        return window.TaagerCurrency.supported.slice();
      }
      return ["SAR", "USD"];
    }

    function setProductCurrency(currency) {
      var nextCurrency = String(currency || selectedCurrency()).toUpperCase();
      if (window.TaagerCurrency && window.TaagerCurrency.cleanCurrency) {
        nextCurrency = window.TaagerCurrency.cleanCurrency(nextCurrency, selectedCurrency());
      }
      if (supportedProductCurrencies().indexOf(nextCurrency) === -1) return;
      if (nextCurrency === selectedCurrency()) return;

      if (window.DashboardRoiState) {
        productFinancialSettings = window.DashboardRoiState.set(
          { currency: nextCurrency },
          productAccountId,
          productFinancialSettings,
        );
      } else {
        productFinancialSettings = Object.assign({}, productFinancialSettings, { currency: nextCurrency });
      }

      applyProductFinancials();
      listCache = null;
      listCacheKey = "";
      clearProductDetailCache();
      updateProductCurrencyUIOnly();
      refreshProductModal();
      refreshProductCompareModal();
    }

    function commissionInCurrency(sarValue) {
      var currency = selectedCurrency();
      var sar = Number(sarValue) || 0;
      if (window.TaagerCurrency && typeof window.TaagerCurrency.convert === "function") {
        return window.TaagerCurrency.convert(sar, window.dashboardActiveCurrency || activeCurrency || "SAR", currency);
      }
      if (currency === "USD") return sar / 3.75;
      return sar;
    }

    function sarToSelectedCurrency(sarValue) {
      return commissionInCurrency(sarValue);
    }

    function productMoney(value) {
      var n = Number(value) || 0;
      return (
        n.toLocaleString(isAr ? "ar-EG-u-nu-latn" : "en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) +
        " " +
        selectedCurrency()
      );
    }

    function productFinancialText(value, decimals) {
      return productCompactNumber(value || 0, decimals == null ? 2 : decimals, 10000);
    }

    function updateFinancialValue(row, field, value, color) {
      if (!row) return;
      var el = row.querySelector('[data-financial-value="' + field + '"]');
      if (!el) return;
      el.textContent = productFinancialText(value, field === "revenue" ? 0 : 2);
      el.setAttribute("title", productMoney(value || 0));
      if (color) el.style.color = color;
    }

    function updateProductSummaryCurrencyUIOnly() {
      var currency = selectedCurrency();
      var totalComm = pd && pd.summary ? Number(pd.summary.totalComm || 0) : PRODUCTS_RAW.reduce(function (sum, p) {
        return sum + (Number(p.commission) || 0);
      }, 0);
      var totalCommission = commissionInCurrency(totalComm);
      if (STAT_CARDS && STAT_CARDS[3]) {
        STAT_CARDS[3].value = totalCommission;
        STAT_CARDS[3].unit = currency;
      }
      var statValue = mountEl.querySelector("#s5-stat-3");
      if (statValue) {
        statValue.textContent = productFinancialText(totalCommission, 0);
        statValue.setAttribute("title", productMoney(totalCommission));
      }
      var statUnit = mountEl.querySelector('[data-stat-unit="3"]');
      if (statUnit) statUnit.textContent = currency;

      INSIGHTS = buildInsights(PRODUCTS_RAW);
      var insightRow = mountEl.querySelector(".s5-insights-row");
      if (insightRow) {
        if (insightRow.children.length !== INSIGHTS.length) {
          insightRow.innerHTML = INSIGHTS.map(function (ins, i) { return insightCardHTML(ins, i); }).join("");
        } else {
          INSIGHTS.forEach(function (ins, i) {
            var valueEl = insightRow.querySelector('[data-insight-value="' + i + '"]');
            var detailEl = insightRow.querySelector('[data-insight-detail="' + i + '"]');
            if (valueEl) valueEl.textContent = ins.value;
            if (detailEl) {
              detailEl.textContent = ins.detail;
              detailEl.style.color = ins.detailColor;
            }
          });
        }
      }
    }

    function updateProductCurrencyUIOnly() {
      var currency = selectedCurrency();
      var byKey = {};
      PRODUCTS_RAW.forEach(function (p, index) {
        byKey[String(p.key || p.sku || p.name || index)] = p;
      });
      mountEl.querySelectorAll(".s5-product-row").forEach(function (row) {
        var product = byKey[String(row.getAttribute("data-product-key") || "")];
        if (!product) return;
        updateFinancialValue(row, "averageCommission", product.averageCommission, "#38bdf8");
        updateFinancialValue(row, "allocatedAdSpend", product.allocatedAdSpend, "#60a5fa");
        updateFinancialValue(row, "cpa", product.cpa, "#a78bfa");
        updateFinancialValue(row, "breakEvenCpa", product.breakEvenCpa, (Number(product.cpa) || 0) > (Number(product.breakEvenCpa) || 0) ? "#ef4444" : "#f59e0b");
        updateFinancialValue(row, "profitLoss", product.profitLoss, product.profitLoss >= 0 ? "#00e676" : "#ef4444");
        var pnlCurrency = row.querySelector('[data-financial-currency="profitLoss"]');
        if (pnlCurrency) pnlCurrency.style.color = product.profitLoss >= 0 ? "rgba(0,230,118,0.55)" : "rgba(239,68,68,0.55)";
        var revenue = commissionInCurrency(product.revenue || 0);
        var revenueEl = row.querySelector('[data-financial-value="revenue"]');
        if (revenueEl) {
          revenueEl.textContent = productFinancialText(revenue, 0);
          revenueEl.setAttribute("title", productMoney(revenue) + (currency !== activeCurrency ? " | Native: " + productNumber(product.revenue || 0, 0) + " " + activeCurrency : ""));
        }
        row.querySelectorAll("[data-financial-currency]").forEach(function (label) {
          label.textContent = currency;
        });
      });
      updateProductSummaryCurrencyUIOnly();
      bindProductCurrencySelect();
    }

    function productNumber(value, decimals) {
      decimals = decimals == null ? 0 : decimals;
      var n = Number(value) || 0;
      return n.toLocaleString(isAr ? "ar-EG-u-nu-latn" : "en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }

    function productCompactNumber(value, decimals, threshold) {
      var n = Number(value) || 0;
      var abs = Math.abs(n);
      threshold = threshold == null ? 10000 : threshold;
      if (window.formatDashboardNumber && abs >= threshold) {
        return window.formatDashboardNumber(n, {
          decimals: decimals == null ? 0 : decimals,
          compact: true,
          compactThreshold: threshold,
        });
      }
      return productNumber(n, decimals == null ? 0 : decimals);
    }

    function textKey(value) {
      var arabicDigits = "Ù Ù¡Ù¢Ù£Ù¤Ù¥Ù¦Ù§Ù¨Ù©";
      return String(value || "")
        .toLowerCase()
        .normalize("NFKC")
        .replace(/[Ù -Ù©]/g, function (digit) {
          return String(arabicDigits.indexOf(digit));
        })
        .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, "")
        .replace(/\u0640/g, "")
        .replace(/[Ø£Ø¥Ø¢Ù±]/g, "Ø§")
        .replace(/[Ù‰Ø¦]/g, "ÙŠ")
        .replace(/Ø¤/g, "Ùˆ")
        .replace(/[Ø©Ù‡]/g, "Ù‡")
        .replace(/[^\w\u0600-\u06ff]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function campaignSpendToSar(row) {
      var amount = Number(
        (row && row.rawSpend) || (row && row.convertedSpend) || 0,
      );
      var currency = String((row && row.currency) || "SAR").toUpperCase();
      if (window.TaagerCurrency && typeof window.TaagerCurrency.convert === "function") {
        return window.TaagerCurrency.convert(amount, currency, window.dashboardActiveCurrency || activeCurrency || "SAR");
      }
      if (currency === "USD") return amount * 3.75;
      return amount;
    }

    function buildCampaignAssignments(campaignRows) {
      var attribution = window.KhodProductAttribution;
      var index = attribution.createProductIndex(PRODUCTS_RAW);
      var result = attribution.attributeCampaignRows(campaignRows || [], index, {
        accountId: productAccountId !== "__all__" ? productAccountId : "",
        getSpend: campaignSpendToSar,
      });
      var assignments = {};
      Object.keys(result.assignments).forEach(function (idx) {
        var assignment = result.assignments[idx];
        assignments[idx] = {
          spendSar: assignment.spend,
          methods: assignment.methods,
          details: assignment.details,
          rowCount: assignment.rowCount,
        };
      });
      return { assignments: assignments, summary: result.summary };
    }

    function applyProductFinancials() {
      var totalPlaced = PRODUCTS_RAW.reduce(function (sum, p) {
        return sum + (Number(p.placedCount) || 0);
      }, 0);
      var budget = Math.max(0, Number(productFinancialSettings.adSpend) || 0);
      var marketingSummary =
        (productMarketingState && productMarketingState.summary) || null;
      var campaignRows =
        marketingSummary && Array.isArray(marketingSummary.campaignBreakdown)
          ? marketingSummary.campaignBreakdown
          : [];
      var hasSyncedProductSpend = !!(campaignRows && campaignRows.length);
      var campaignAssignmentResult = hasSyncedProductSpend
        ? buildCampaignAssignments(campaignRows)
        : { assignments: {}, summary: null };
      var campaignAssignments = campaignAssignmentResult.assignments;
      PRODUCTS_RAW.forEach(function (p, idx) {
        var placed = Number(p.placedCount) || 0;
        var synced = campaignAssignments[idx];
        p.syncedAdSpend = !!synced;
        p.syncMatchMethod = synced
          ? synced.methods.sku && synced.methods.name
            ? "sku+name"
            : synced.methods.sku
              ? "sku"
              : "name"
          : "";
        p.syncMatchedRows = synced ? synced.rowCount : 0;
        p.syncMatchDetails = synced ? Object.keys(synced.details || {}) : [];
        p.allocatedAdSpend = hasSyncedProductSpend
          ? synced
            ? sarToSelectedCurrency(Number(synced.spendSar.toFixed(2)))
            : 0
          : totalPlaced > 0
            ? (budget * placed) / totalPlaced
            : 0;
        p.cpa = placed > 0 ? p.allocatedAdSpend / placed : 0;
        var delivered = Number(p.deliveredCount) || 0;
        var avgCommissionSar = window.KhodFinancialMetrics.averageCommission(
          p.commission,
          delivered
        );
        p.averageCommission = sarToSelectedCurrency(avgCommissionSar);
        var breakEvenSar = avgCommissionSar * ((Number(p.ndrPct) || 0) / 100);
        p.breakEvenCpa = sarToSelectedCurrency(breakEvenSar);
        p.profitLoss = commissionInCurrency(p.commission) - p.allocatedAdSpend;
        p.financialCurrency = selectedCurrency();
      });
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Build real data Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    if (pd && (!pd.rankedList || pd.rankedList.length === 0)) {
      PRODUCTS_RAW = [];
      STAT_CARDS = [
        {
          label: s5Txt(
            "Total Products Sold",
            "Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¨Ã˜Â§Ã˜Â¹Ã˜Â©",
          ),
          value: (pd.summary && pd.summary.uniqueProducts) || 0,
          unit: s5Txt("unique products", "Ã™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬ Ã™â€¦Ã˜Â®Ã˜ÂªÃ™â€žÃ™Â"),
          color: "#a855f7",
          iconType: "grid",
        },
        {
          label: s5Txt(
            "Total Orders",
            "Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã™ÂÃ˜Â³Ã˜Â¬Ã™â€žÃ˜Â©",
          ),
          value: (pd.summary && pd.summary.totalOrders) || 0,
          unit: s5Txt("orders", "Ã˜Â·Ã™â€žÃ˜Â¨"),
          color: "#14b8a6",
          iconType: "box",
        },
        {
          label: s5Txt(
            "Total Pieces Sold",
            "Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ™â€šÃ˜Â·Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã™ÂÃ˜Â¨Ã˜Â§Ã˜Â¹Ã˜Â©",
          ),
          value: (pd.summary && pd.summary.totalPieces) || 0,
          unit: s5Txt("pieces", "Ã™â€šÃ˜Â·Ã˜Â¹Ã˜Â©"),
          color: "#3b82f6",
          iconType: "pieces",
        },
        {
          label: s5Txt(
            "Total Earned Commission",
            "Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™Ë†Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã™â€šÃ™â€šÃ˜Â©",
          ),
          value: commissionInCurrency((pd.summary && pd.summary.totalComm) || 0),
          unit: selectedCurrency(),
          color: "#f59e0b",
          iconType: "coins",
        },
        {
          label: s5Txt(
            "Products generating 80% of commission",
            "Ã™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â­Ã™â€šÃ™â€š 80% Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™Ë†Ã™â€žÃ˜Â©",
          ),
          value: 0,
          unit: s5Txt("product", "Ã™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬"),
          color: "#ef4444",
          iconType: "pie",
        },
      ];
      INSIGHTS = [];
    } else if (pd && pd.rankedList && pd.rankedList.length > 0) {
      const totalDeliveries =
        pd.rankedList.reduce(
          (acc, x) => acc + (x.deliveredCount || x.units || 0),
          0,
        ) || 1;

      PRODUCTS_RAW = pd.rankedList.map((p, idx) => {
        const rank = p.rank || idx + 1;
        const units = p.deliveredCount || p.units || 0;
        const commission = p.commission || 0;
        const sharePct = parseFloat(
          ((units / totalDeliveries) * 100).toFixed(1),
        );

        const spark = [];
        for (let j = 0; j < 7; j++) {
          const factor = 0.4 + (j / 6) * 0.6;
          const noise = 1 + Math.sin(j + units) * 0.05;
          spark.push(Math.round(commission * factor * noise));
        }
        spark[6] = commission;

        const rankIdx = Math.min(rank - 1, 4);
        const styleCfg = [
          { sparkColor: "#00e676", accent: "#fbbf24" },
          { sparkColor: "#a855f7", accent: "#a855f7" },
          { sparkColor: "#14b8a6", accent: "#14b8a6" },
          { sparkColor: "#a855f7", accent: "#8892a4" },
          { sparkColor: "#7c3aed", accent: "#8892a4" },
        ][rankIdx];

        const productKey = p.key || p.sku || p.name || `product-${idx}`;

        return {
          key: productKey,
          sku: p.sku || "",
          rank,
          name: p.name || "Ã™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬ Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â¹Ã˜Â±Ã™Ë†Ã™Â",
          cat: `SKU: ${p.sku || "N/A"}`,
          deliveries: units,
          placedCount: p.placedCount || 0,
          pieces: p.pieces || p.qty || 0,
          sharePct,
          revenue: commission,
          delta: Number(p.delta || 0),
          spark,
          ...styleCfg,
          commission,
          deliveredCount: units,
          totalPieces: p.totalPieces || p.qty || 0,
          failedCount: p.failedCount || 0,
          canceledCount: p.canceledCount || 0,
          confirmedCount: p.confirmedCount || 0,
          shippingCount: p.shippingCount || 0,
          processingCount: p.processingCount || 0,
          confirmationPct: p.confirmationPct || 0,
          cancelPct: p.cancelPct || 0,
          ndrPct: p.ndrPct || 0,
          drRate: p.drRate || 0,
          scalingScore:
            p.scalingScore || Math.round((commission * (p.drRate || 0)) / 100),
          deliveryPct: p.deliveryPct || p.deliveryRate || 0,
          cityBreakdown: p.cityBreakdown || [],
          piecesBreakdown: (p.piecesBreakdown || []).map(function (item) {
            var count = Number(item.count || item.orders || 0);
            var delivered = Number(item.delivered || item.deliveredCount || 0);
            var ndr =
              item.ndr !== undefined
                ? Number(item.ndr || 0)
                : count > 0
                  ? parseFloat(((delivered / count) * 100).toFixed(1))
                  : 0;
            return Object.assign({}, item, {
              count: count,
              delivered: delivered,
              ndr: ndr,
            });
          }),
          quantityCityBreakdown: p.quantityCityBreakdown || [],
        };
      });

      const sortedByComm = [...PRODUCTS_RAW].sort(
        (a, b) => b.revenue - a.revenue,
      );
      const target80 = (pd.summary.totalComm || 0) * 0.8;
      let runningSum = 0,
        count80 = 0;
      for (const p of sortedByComm) {
        runningSum += p.revenue;
        count80++;
        if (runningSum >= target80) break;
      }
      if (count80 === 0) count80 = 1;

      STAT_CARDS = [
        {
          label: s5Txt(
            "Total Products Sold",
            "Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¨Ã˜Â§Ã˜Â¹Ã˜Â©",
          ),
          value: pd.summary.uniqueProducts || 0,
          unit: s5Txt("unique products", "Ã™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬ Ã™â€¦Ã˜Â®Ã˜ÂªÃ™â€žÃ™Â"),
          color: "#a855f7",
          iconType: "grid",
        },
        {
          label: s5Txt(
            "Total Orders",
            "Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã™ÂÃ˜Â³Ã˜Â¬Ã™â€žÃ˜Â©",
          ),
          value: pd.summary.totalOrders || 0,
          unit: s5Txt("orders", "Ã˜Â·Ã™â€žÃ˜Â¨"),
          color: "#14b8a6",
          iconType: "box",
        },
        {
          label: s5Txt(
            "Total Pieces Sold",
            "Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ™â€šÃ˜Â·Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã™ÂÃ˜Â¨Ã˜Â§Ã˜Â¹Ã˜Â©",
          ),
          value: pd.summary.totalPieces || 0,
          unit: s5Txt("pieces", "Ã™â€šÃ˜Â·Ã˜Â¹Ã˜Â©"),
          color: "#3b82f6",
          iconType: "pieces",
        },
        {
          label: s5Txt(
            "Total Earned Commission",
            "Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™Ë†Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã™â€šÃ™â€šÃ˜Â©",
          ),
          value: commissionInCurrency(pd.summary.totalComm || 0),
          unit: selectedCurrency(),
          color: "#f59e0b",
          iconType: "coins",
        },
        {
          label: s5Txt(
            "Products generating 80% of commission",
            "Ã™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â­Ã™â€šÃ™â€š 80% Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™Ë†Ã™â€žÃ˜Â©",
          ),
          value: count80,
          unit: s5Txt("products only", "Ã™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Âª Ã™ÂÃ™â€šÃ˜Â·"),
          color: "#ef4444",
          iconType: "pie",
        },
      ];

      INSIGHTS = buildInsights(PRODUCTS_RAW);
    }

    applyProductFinancials();

    const PRODUCT_BY_KEY = {};
    PRODUCTS_RAW.forEach((p, idx) => {
      const key = p.key || p.sku || p.name || idx;
      PRODUCT_BY_KEY[key] = p;
    });

    // Ã¢â€â‚¬Ã¢â€â‚¬ T8: Smart Insights Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function buildInsights(products) {
      if (!products || !products.length) return [];
      const insights = [];

      const worstCancel = products.reduce(
        (prev, cur) => (cur.cancelPct > prev.cancelPct ? cur : prev),
        products[0],
      );
      if (worstCancel && worstCancel.cancelPct >= 40) {
        insights.push({
          emoji: "!",
          bg: "rgba(239,68,68,0.12)",
          border: "rgba(239,68,68,0.28)",
          iconGlow: "#ef4444",
          label: "Warning: High Cancel Rate",
          value: worstCancel.name,
          detail:
            worstCancel.cancelPct +
            "% canceled - consider pausing",
          detailColor: "#ef4444",
        });
      }

      const bestDelivery = products.reduce(
        (prev, cur) => ((cur.drRate || 0) > (prev.drRate || 0) ? cur : prev),
        products[0],
      );
      if (bestDelivery) {
        const bestDeliveryColor = window.dashboardRateColor
          ? window.dashboardRateColor(bestDelivery.drRate || 0)
          : (bestDelivery.drRate || 0) >= 40
            ? "#22d3ee"
            : (bestDelivery.drRate || 0) >= 30
              ? "#00e676"
              : (bestDelivery.drRate || 0) >= 20
                ? "#f59e0b"
                : "#ef4444";
        insights.push({
          emoji: "#1",
          bg: bestDeliveryColor + "1f",
          border: bestDeliveryColor + "47",
          iconGlow: bestDeliveryColor,
          label: "Best Delivery Rate",
          value: bestDelivery.name,
          detail:
            (bestDelivery.drRate || 0) +
            "% delivered - scalable",
          detailColor: bestDeliveryColor,
        });
      }

      const worstNdr = products.reduce(
        (prev, cur) => (cur.ndrPct < prev.ndrPct ? cur : prev),
        products[0],
      );
      if (worstNdr && worstNdr.ndrPct < 20) {
        insights.push({
          emoji: "!",
          bg: "rgba(239,68,68,0.12)",
          border: "rgba(239,68,68,0.28)",
          iconGlow: "#ef4444",
          label: "Potential Shipping Issue",
          value: worstNdr.name,
          detail:
            "NDR " +
            worstNdr.ndrPct +
            "% - check responsible company",
          detailColor: "#ef4444",
        });
      }

      const bestScale = products.reduce((prev, cur) => {
        const scoreA = (cur.commission * (cur.drRate || 0)) / 100;
        const scoreB = (prev.commission * (prev.drRate || 0)) / 100;
        return scoreA > scoreB ? cur : prev;
      }, products[0]);
      if (bestScale) {
        insights.push({
          emoji: "*",
          bg: "rgba(245,158,11,0.12)",
          border: "rgba(245,158,11,0.28)",
          iconGlow: "#f59e0b",
          label: "Best Product for Scaling",
          value: bestScale.name,
          detail:
            "Commission " +
            productNumber(commissionInCurrency(bestScale.commission || 0), 0) +
            " " + selectedCurrency() + " x " +
            (bestScale.drRate || 0) +
            "% delivery",
          detailColor: "#f59e0b",
        });
      }

      if (insights.length === 0) {
        const topComm = products.reduce(
          (prev, cur) => (cur.revenue > prev.revenue ? cur : prev),
          products[0],
        );
        insights.push({
          emoji: "Ã°Å¸Ââ€ ",
          bg: bestDeliveryColor + "1f",
          border: bestDeliveryColor + "47",
          iconGlow: bestDeliveryColor,
          label: s5Txt(
            "Best Commission Performance",
            "Ã˜Â£Ã™ÂÃ˜Â¶Ã™â€ž Ã˜Â£Ã˜Â¯Ã˜Â§Ã˜Â¡ Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™Ë†Ã™â€žÃ˜Â©",
          ),
          value: topComm.name,
          detail: productNumber(commissionInCurrency(topComm.revenue || 0), 0) + " " + selectedCurrency(),
          detailColor: "#fbbf24",
        });
      }
      return insights;
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ State Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    let filterState = { search: "", statusKey: "all" };
    let sortState = { field: "deliveredCount", dir: "desc" };
    let viewMode = "expanded";
    const QUANTITY_CITY_PAGE_SIZE = 4;
    const quantityCityPages = {};
    let isFirstMount = false;
    let listCacheKey = "";
    let listCache = null;
    let detailPanelCache = new Map();
    let _sortMenuCleanup = null;

    const STATUS_PILLS = [
      { key: "all", label: s5Txt("All", "Ã˜Â§Ã™â€žÃ™Æ’Ã™â€ž"), color: "#fff" },
      {
        key: "delivered",
        label: s5Txt("Delivered", "Ã™â€¦Ã™ÂÃ˜Â³Ã™â€žÃ™Å½Ã™â€˜Ã™â€¦Ã˜Â©"),
        color: "#00e676",
      },
      { key: "failed", label: p5Txt("failedOrders"), color: "#f97316" },
      { key: "canceled", label: p5Txt("canceledOrders"), color: "#ef4444" },
      {
        key: "shipping",
        label: s5Txt("In Shipping", "Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â­Ã™â€ "),
        color: "#14b8a6",
      },
      {
        key: "processing",
        label: s5Txt("Processing", "Ã™â€šÃ™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã˜Â§Ã™â€žÃ˜Â¬Ã˜Â©"),
        color: "#3b82f6",
      },
    ];

    // Ã¢â€â‚¬Ã¢â€â‚¬ FIX 1: applyFilters Ã¢â‚¬â€ NEVER re-assigns rank Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function applyFilters() {
      const marketingSyncStamp =
        productMarketingState &&
        (productMarketingState.lastSyncAt ||
          (productMarketingState.summary &&
            productMarketingState.summary.lastSyncAt) ||
          productMarketingState.updatedAt ||
          "");
      const cacheKey = [
        PRODUCTS_RAW.length,
        filterState.search,
        filterState.statusKey,
        sortState.field,
        sortState.dir,
        productAccountId || "__all__",
        marketingSyncStamp,
        selectedCurrency(),
        activeCurrency,
      ].join("|");
      if (listCache && listCacheKey === cacheKey) return listCache;

      let list = PRODUCTS_RAW.slice();

      if (filterState.search) {
        const q = filterState.search.toLowerCase();
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.cat && p.cat.toLowerCase().includes(q)),
        );
      }

      if (filterState.statusKey !== "all") {
        list = list.filter((p) => {
          if (filterState.statusKey === "delivered")
            return p.deliveredCount > 0;
          if (filterState.statusKey === "failed") return p.failedCount > 0;
          if (filterState.statusKey === "canceled") return p.canceledCount > 0;
          if (filterState.statusKey === "shipping") return p.shippingCount > 0;
          if (filterState.statusKey === "processing")
            return p.processingCount > 0;
          return true;
        });
      }

      list.sort((a, b) => {
        if (sortState.field === "default") {
          return (a.rank || 0) - (b.rank || 0);
        }
        const dir = sortState.dir === "desc" ? 1 : -1;
        const primary =
          dir * ((b[sortState.field] || 0) - (a[sortState.field] || 0));
        if (primary !== 0) return primary;
        const byPlaced = (b.placedCount || 0) - (a.placedCount || 0);
        if (byPlaced !== 0) return byPlaced;
        const byCanceled = (b.canceledCount || 0) - (a.canceledCount || 0);
        if (byCanceled !== 0) return byCanceled;
        return (b.commission || 0) - (a.commission || 0);
      });

      // FIX 1: preserve the original rank from PRODUCTS_RAW Ã¢â‚¬â€ do NOT re-number
      listCacheKey = cacheKey;
      listCache = list;
      return listCache;
    }

    const PAGE_SIZE = 10;
    let currentPage = 1;

    function currentList() {
      return applyFilters();
    }
    function totalProductPages(list) {
      list = list || currentList();
      return Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    }
    function pagedProducts(list) {
      list = list || currentList();
      const start = (currentPage - 1) * PAGE_SIZE;
      return list.slice(start, start + PAGE_SIZE);
    }

    function productKeyForState(p) {
      return String((p && (p.key || p.sku || p.name || p.rank)) || "");
    }

    function clearProductDetailCache() {
      if (detailPanelCache && detailPanelCache.clear) detailPanelCache.clear();
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Health row styling Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function healthRowStyle(p) {
      if (p.deliveredCount === 0) {
        return {
          border: "rgba(255,255,255,0.05)",
          shadow: "none",
          bg: "rgba(255,255,255,0.012)",
          opacity: "0.45",
        };
      }
      if (p.rank <= 3) {
        const rankColors = [
          {
            border: "rgba(251,191,36,0.2)",
            shadow:
              "0 0 0 1px rgba(251,191,36,0.12), 0 2px 20px rgba(251,191,36,0.08)",
            bg: "linear-gradient(to left, rgba(251,191,36,0.05), rgba(251,191,36,0.01) 60%, transparent)",
          },
          {
            border: "rgba(168,85,247,0.2)",
            shadow:
              "0 0 0 1px rgba(168,85,247,0.12), 0 2px 16px rgba(168,85,247,0.07)",
            bg: "linear-gradient(to left, rgba(168,85,247,0.04), transparent 60%)",
          },
          {
            border: "rgba(20,184,166,0.18)",
            shadow:
              "0 0 0 1px rgba(20,184,166,0.10), 0 2px 14px rgba(20,184,166,0.06)",
            bg: "linear-gradient(to left, rgba(20,184,166,0.04), transparent 60%)",
          },
        ];
        return Object.assign({}, rankColors[p.rank - 1], { opacity: "1" });
      }
      if (p.placedCount >= 5) {
        if ((p.drRate || 0) >= 40)
          return {
            border: "rgba(34,211,238,0.22)",
            shadow:
              "0 0 0 1px rgba(34,211,238,0.13), 0 2px 12px rgba(34,211,238,0.07)",
            bg: "linear-gradient(to left, rgba(34,211,238,0.035), transparent 60%)",
            opacity: "1",
          };
        if ((p.drRate || 0) >= 30)
          return {
            border: "rgba(0,230,118,0.2)",
            shadow:
              "0 0 0 1px rgba(0,230,118,0.12), 0 2px 12px rgba(0,230,118,0.06)",
            bg: "linear-gradient(to left, rgba(0,230,118,0.03), transparent 60%)",
            opacity: "1",
          };
        if (p.cancelPct >= 40)
          return {
            border: "rgba(239,68,68,0.2)",
            shadow:
              "0 0 0 1px rgba(239,68,68,0.10), 0 2px 12px rgba(239,68,68,0.06)",
            bg: "linear-gradient(to left, rgba(239,68,68,0.03), transparent 60%)",
            opacity: "1",
          };
        if (p.ndrPct < 20)
          return {
            border: "rgba(239,68,68,0.2)",
            shadow:
              "0 0 0 1px rgba(239,68,68,0.10), 0 2px 12px rgba(239,68,68,0.06)",
            bg: "linear-gradient(to left, rgba(239,68,68,0.03), transparent 60%)",
            opacity: "1",
          };
      }
      return {
        border: "rgba(255,255,255,0.07)",
        shadow: "none",
        bg: "rgba(255,255,255,0.018)",
        opacity: "1",
      };
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Rank badge Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const RANK_CFG = [
      {
        bg: "linear-gradient(135deg,#fcd34d,#d97706)",
        shadow: "0 0 10px rgba(251,191,36,0.6)",
        color: "#1c1400",
      },
      {
        bg: "linear-gradient(135deg,#9ca3af,#6b7280)",
        shadow: "0 0 8px rgba(156,163,175,0.4)",
        color: "#fff",
      },
      {
        bg: "linear-gradient(135deg,#fb923c,#b45309)",
        shadow: "0 0 8px rgba(251,146,60,0.4)",
        color: "#fff",
      },
      {
        bg: "rgba(255,255,255,0.07)",
        shadow: "none",
        color: "rgba(255,255,255,0.4)",
      },
    ];
    function rankBadgeHTML(rank, deliveredCount) {
      const hasDeliveries = (deliveredCount || 0) > 0;
      if (!hasDeliveries) {
        return `<div style="width:32px;height:32px;border-radius:50%;flex-shrink:0;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.25);font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center">${rank}</div>`;
      }
      const cfg = rank <= 3 ? RANK_CFG[rank - 1] : RANK_CFG[3];
      return `<div style="width:32px;height:32px;border-radius:50%;flex-shrink:0;background:${cfg.bg};box-shadow:${cfg.shadow};color:${cfg.color};font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center">${rank}</div>`;
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Stat card icons Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function statIconHTML(type, color) {
      if (type === "grid")
        return `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" style="display:block"><rect x="1" y="1" width="8" height="8" rx="2" fill="${color}"/><rect x="13" y="1" width="8" height="8" rx="2" fill="${color}" opacity="0.8"/><rect x="1" y="13" width="8" height="8" rx="2" fill="${color}" opacity="0.8"/><rect x="13" y="13" width="8" height="8" rx="2" fill="${color}" opacity="0.6"/></svg>`;
      if (type === "box")
        return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="display:block"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="${color}"/><path d="M2 17l10 5 10-5" stroke="${color}" stroke-width="1.8" fill="none" opacity="0.7"/><path d="M2 12l10 5 10-5" stroke="${color}" stroke-width="1.8" fill="none" opacity="0.85"/></svg>`;
      if (type === "pieces")
        return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="display:block"><rect x="2" y="7" width="6" height="10" rx="1" fill="${color}"/><rect x="9" y="4" width="6" height="13" rx="1" fill="${color}" opacity="0.8"/><rect x="16" y="9" width="6" height="8" rx="1" fill="${color}" opacity="0.6"/></svg>`;
      if (type === "coins")
        return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="display:block"><ellipse cx="12" cy="18" rx="7" ry="2.5" fill="${color}" opacity="0.4"/><ellipse cx="12" cy="15" rx="7" ry="2.5" fill="${color}" opacity="0.6"/><ellipse cx="12" cy="12" rx="7" ry="2.5" fill="${color}" opacity="0.8"/><ellipse cx="12" cy="9" rx="7" ry="2.5" fill="${color}"/><path d="M5 9v9M19 9v9" stroke="${color}" stroke-width="0.8" opacity="0.5"/></svg>`;
      if (type === "pie")
        return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="display:block"><circle cx="12" cy="12" r="9" stroke="${color}" stroke-width="1.5" opacity="0.3"/><path d="M12 3 A9 9 0 0 1 21 12 L12 12 Z" fill="${color}"/><path d="M12 12 L21 12 A9 9 0 0 1 12 21 Z" fill="${color}" opacity="0.55"/><path d="M12 12 L12 21 A9 9 0 0 1 3 12 Z" fill="${color}" opacity="0.3"/></svg>`;
      return "";
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Rate badge Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function formatRatePercent(value) {
      const n = Number(value);
      const safe = Number.isFinite(n) ? n : 0;
      const rounded = safe.toFixed(1);
      return rounded.replace(/\.0$/, "") + "%";
    }

    function rateBadgeHTML(value, type) {
      let color;
      if (type === "delivery") color = ndrColor(value);
      else if (type === "cancel")
        color = value >= 40 ? "#ef4444" : value >= 30 ? "#f59e0b" : "#8892a4";
      else if (type === "ndr") color = ndrColor(value);
      else if (type === "confirmation") {
        if (value < 50) color = "#ef4444";
        else if (value <= 60) color = "#f59e0b";
        else if (value <= 70) color = "#00e676";
        else color = "#22d3ee";
      }
      else color = "#8892a4";

      const capped = Math.min(Math.max(value, 0), 100);

      return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-width:0">
<div style="font-size:18px;font-weight:900;color:${color};line-height:1;text-align:center;white-space:nowrap">${formatRatePercent(value)}</div>
<div style="width:100%;height:3px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden">
  <div class="s5-rate-bar" data-target="${capped}" style="height:100%;width:100%;transform:scaleX(${capped / 100});transform-origin:${isAr ? "right" : "left"};background:${color};border-radius:2px;transition:none"></div>
</div></div>`;
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Funnel panel content Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function funnelHTML(p) {
      const total = p.placedCount || 1;
      const stages = [
        {
          label: s5Txt(
            "Total Orders",
            s5Txt("Total Orders", "Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª"),
          ),
          count: p.placedCount,
          color: "#fff",
          pct: 100,
        },
        {
          label: s5Txt("Confirmed", "Ã™â€¦Ã˜Â¤Ã™Æ’Ã˜Â¯Ã˜Â©"),
          count: p.confirmedCount,
          color: "#3b82f6",
          pct: p.confirmationPct,
        },
        {
          label: s5Txt("In Shipping", "Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â­Ã™â€ "),
          count: p.shippingCount,
          color: "#14b8a6",
          pct: parseFloat(((p.shippingCount / total) * 100).toFixed(1)),
        },
        {
          label: "Delivered",
          count: p.deliveredCount,
          color: "#00e676",
          pct: p.deliveryPct,
        },
        {
          label: p5Txt("funnelFailed"),
          count: p.failedCount,
          color: "#f97316",
          pct: parseFloat((((p.failedCount || 0) / total) * 100).toFixed(1)),
        },
        {
          label: p5Txt("funnelCanceled"),
          count: p.canceledCount,
          color: "#ef4444",
          pct: p.cancelPct,
        },
      ];
      return stages
        .map((s, i) => {
          const indent = i * 14;
          return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding-right:${indent}px">
        <div style="width:${Math.max(4, s.pct)}%;max-width:160px;height:20px;border-radius:4px;background:${s.color}22;border:1px solid ${s.color}55;display:flex;align-items:center;padding:0 8px;min-width:56px">
          <div style="font-size:10px;font-weight:700;color:${s.color};white-space:nowrap">${formatRatePercent(s.pct)}</div>
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.7);flex-shrink:0">${s.label}</div>
        <div style="font-size:12px;font-weight:700;color:#fff;margin-right:auto">${(s.count || 0).toLocaleString("en-US")}</div>
      </div>`;
        })
        .join("");
    }

    function citiesHTML(p) {
      if (!p.cityBreakdown || !p.cityBreakdown.length)
        return `<div style="color:rgba(255,255,255,0.3);font-size:12px">${s5Txt("No data", "Ã™â€žÃ˜Â§ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã˜Â¯ Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª")}</div>`;
      const topCities = p.cityBreakdown.slice(0, 5);
      const maxCount = topCities[0].count;

      // Pull per-city NDR/delivered for this product from geoProductMap
      const _geoD = window.dashboardGeoData;
      const _gpm = _geoD && _geoD.geo && _geoD.geo.geoProductMap;
      const _prodKey = p.key || p.sku || p.name || "";

      function _getCityStats(cityName) {
        if (!_gpm) return null;
        var cell = _gpm[cityName] && _gpm[cityName][_prodKey];
        if (!cell) {
          const lc = cityName.toLowerCase();
          const found = Object.keys(_gpm).find(
            (k) =>
              k.toLowerCase().indexOf(lc) !== -1 ||
              lc.indexOf(k.toLowerCase()) !== -1,
          );
          cell = found && _gpm[found][_prodKey];
        }
        if (!cell || (!cell.orders && !cell.delivered)) return null;
        const ndr =
          cell.orders > 0
            ? Math.round(((cell.delivered || 0) / cell.orders) * 1000) / 10
            : null;
        const confirmation =
          typeof cell.confirmationRate === "number"
            ? Math.round(cell.confirmationRate * 1000) / 10
            : cell.orders > 0
              ? Math.round(
                  (((cell.confirmed || 0) +
                    (cell.shipping || 0) +
                    (cell.processing || 0) +
                    (cell.delivered || 0)) /
                    cell.orders) *
                    1000,
                ) / 10
              : null;
        return { delivered: cell.delivered || 0, ndr, confirmation };
      }

      const headerRow = `<div style="display:grid;grid-template-columns:1fr 44px 44px 44px 46px;gap:5px;
      padding:3px 6px 6px;margin-bottom:2px;border-bottom:1px solid rgba(255,255,255,0.06);">
      <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.28)">${s5Txt("City", "Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã™Å Ã™â€ Ã˜Â©")}</span>
      <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">${s5Txt("Orders", "Ã˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª")}</span>
      <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">${s5Txt("Dlvrd", "Ã™Ë†Ã˜ÂµÃ™â€ž")}</span>
      <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">${s5Txt("Conf", "ÃƒËœÃ‚ÂªÃƒËœÃ‚Â£Ãƒâ„¢Ã†â€™Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â¯")}</span>
      <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">NDR</span>
    </div>`;

      const dataRows = topCities
        .map((c, i) => {
          const barPct = Math.round((c.count / maxCount) * 100);
          const colors = ["#f59e0b", "#a855f7", "#14b8a6"];
          const color = colors[i] || "#8892a4";
          const stats = _getCityStats(c.name);
          const deliveredDisplay = stats
            ? stats.delivered.toLocaleString("en-US")
            : "-";
          const ndrVal = stats ? stats.ndr : null;
          const ndrColor =
            ndrVal === null
              ? "rgba(255,255,255,0.22)"
              : window.dashboardRateColor(ndrVal);
          const ndrText = ndrVal === null ? "-" : ndrVal.toFixed(1) + "%";
          const confirmationVal =
            c.confirmationPct !== undefined
              ? Number(c.confirmationPct)
              : stats
                ? stats.confirmation
                : null;
          const confirmationColor =
            confirmationVal === null || isNaN(confirmationVal)
              ? "rgba(255,255,255,0.22)"
              : window.dashboardRateColor(confirmationVal);
          const confirmationText =
            confirmationVal === null || isNaN(confirmationVal)
              ? "-"
              : confirmationVal.toFixed(1) + "%";
          return `<div style="display:grid;grid-template-columns:1fr 44px 44px 44px 46px;gap:5px;
        align-items:center;margin-bottom:7px;padding:5px 6px;border-radius:7px;background:rgba(255,255,255,0.02);">
        <div>
          <div style="font-size:11px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(tx(c.name))}</div>
          <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;margin-top:4px">
            <div style="height:100%;width:${barPct}%;background:${color};border-radius:2px"></div>
          </div>
        </div>
        <div style="text-align:center;font-size:11px;font-weight:700;color:${color}">${c.count}</div>
        <div style="text-align:center;font-size:11px;font-weight:700;color:rgba(255,255,255,0.65)">${deliveredDisplay}</div>
        <div style="text-align:center;font-size:11px;font-weight:800;color:${confirmationColor}">${confirmationText}</div>
        <div style="text-align:center;font-size:11px;font-weight:800;color:${ndrColor}">${ndrText}</div>
      </div>`;
        })
        .join("");

      return headerRow + dataRows;
    }

    function ndrColor(value) {
      return window.dashboardRateColor
        ? window.dashboardRateColor(value)
        : value >= 40
          ? "#22d3ee"
          : value >= 30
            ? "#00e676"
            : value >= 20
              ? "#f59e0b"
              : "#ef4444";
    }

    function piecesBreakdownHTML(p) {
      if (!p.piecesBreakdown || !p.piecesBreakdown.length) return "";
      const total = p.piecesBreakdown.reduce((s, x) => s + x.count, 0) || 1;
      const maxCount =
        p.piecesBreakdown.reduce(
          (max, x) => Math.max(max, Number(x.count) || 0),
          0,
        ) || 1;
      const headerRow = `<div style="display:grid;grid-template-columns:42px 50px 56px 52px 50px;gap:6px;
      padding:3px 0 6px;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06);">
      <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.28)">${s5Txt("Qty", "Qty")}</span>
      <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">${s5Txt("Orders", "Orders")}</span>
      <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">${s5Txt("Delivered", "Delivered")}</span>
      <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">${s5Txt("Conf", "Confirm")}</span>
      <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">${s5Txt("NDR", "NDR")}</span>
    </div>`;
      const rows = p.piecesBreakdown
        .map((item) => {
          const pct = parseFloat(((item.count / total) * 100).toFixed(1));
          const barPct = Math.round(
            ((Number(item.count) || 0) / maxCount) * 100,
          );
          const delivered = Number(item.delivered || 0);
          const hasOrders = (Number(item.count) || 0) > 0;
          const hasDeliveredMetric = hasOrders || delivered > 0;
          const ndrVal =
            item.ndr !== undefined
              ? Number(item.ndr || 0)
              : (Number(item.count) || 0) > 0
                ? (delivered / Number(item.count)) * 100
                : 0;
          const ndrText = hasOrders ? ndrVal.toFixed(1) + "%" : "-";
          const ndrTextColor = hasOrders
            ? ndrColor(ndrVal)
            : "rgba(255,255,255,0.45)";
          const confirmationVal =
            item.confirmationPct !== undefined
              ? Number(item.confirmationPct || 0)
              : hasOrders
                ? (((Number(item.confirmed || 0) + Number(item.shipping || 0) + Number(item.processing || 0) + delivered) / Number(item.count || 1)) * 100)
                : 0;
          const confirmationText = hasOrders ? confirmationVal.toFixed(1) + "%" : "-";
          const confirmationTextColor = hasOrders
            ? ndrColor(confirmationVal)
            : "rgba(255,255,255,0.45)";
          return `<div style="display:grid;grid-template-columns:42px 50px 56px 52px 50px;gap:6px;align-items:center;margin-bottom:8px">
        <div>
          <div style="font-size:13px;font-weight:900;color:#f59e0b">${esc(item.qty)}x</div>
          <div style="height:3px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;margin-top:4px">
            <div style="height:100%;width:${barPct || pct}%;background:#f59e0b;border-radius:2px"></div>
          </div>
        </div>
        <span style="text-align:center;font-size:12px;font-weight:700;color:#f59e0b">${Number(item.count || 0).toLocaleString("en-US")}</span>
        <span style="text-align:center;font-size:12px;font-weight:700;color:#00e676">${hasDeliveredMetric ? delivered.toLocaleString("en-US") : "-"}</span>
        <span style="text-align:center;font-size:11px;font-weight:700;color:${confirmationTextColor}">${confirmationText}</span>
        <span style="text-align:center;font-size:11px;font-weight:700;color:${ndrTextColor}">${ndrText}</span>
      </div>`;
        })
        .join("");
      return headerRow + rows;
    }

    function quantityCitiesHTML(p) {
      if (!p.quantityCityBreakdown || !p.quantityCityBreakdown.length) {
        return `<div style="color:rgba(255,255,255,0.3);font-size:12px">${s5Txt("No data", "Ã™â€žÃ˜Â§ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã˜Â¯ Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª")}</div>`;
      }

      const productKey = String(p.key || p.sku || p.name || p.rank || "");
      const productAttr = attr(productKey);
      const totalCards = p.quantityCityBreakdown.length;
      const totalPages = Math.max(
        1,
        Math.ceil(totalCards / QUANTITY_CITY_PAGE_SIZE),
      );
      const currentQtyPage = Math.min(
        Math.max(quantityCityPages[productKey] || 1, 1),
        totalPages,
      );
      const startIndex = (currentQtyPage - 1) * QUANTITY_CITY_PAGE_SIZE;
      const hasQuantityPager =
        totalPages > 1 && window.renderDashboardPagination;
      const visibleBreakdown = hasQuantityPager
        ? p.quantityCityBreakdown.slice(
            startIndex,
            startIndex + QUANTITY_CITY_PAGE_SIZE,
          )
        : p.quantityCityBreakdown;
      quantityCityPages[productKey] = currentQtyPage;

      const quantityPaginationHtml = hasQuantityPager
        ? `<div class="s5-quantity-pagination-wrap" style="margin-top:12px">${window.renderDashboardPagination(
            {
              currentPage: currentQtyPage,
              totalPages: totalPages,
              totalItems: totalCards,
              startItem: startIndex + 1,
              endItem: Math.min(
                startIndex + QUANTITY_CITY_PAGE_SIZE,
                totalCards,
              ),
              itemLabel: s5Txt("quantity cards", "quantity cards"),
              pageButtonClass: "s5-quantity-page-btn",
              className: "dash-pagination-compact s5-quantity-pagination",
            },
          )}</div>`
        : "";

      return `<div class="s5-quantity-cities" data-product-key="${productAttr}">
      <div class="s5-quantity-card-grid" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">
      ${visibleBreakdown
        .map((item) => {
          const cities = (item.cities || []).slice(0, 5);
          const maxCount = cities.length ? cities[0].count : 1;

          // City | Orders | Delivered | Confirm | NDR
          const colHdr = `<div style="display:grid;grid-template-columns:1fr 46px 52px 48px 48px;gap:5px;
          padding:3px 6px 5px;margin-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.28)">${s5Txt("City", "Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã™Å Ã™â€ Ã˜Â©")}</span>
          <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">${s5Txt("Orders", "Ã˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª")}</span>
          <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">${s5Txt("Delivered", "Ã™â€¦Ã™ÂÃ˜Â³Ã™â€žÃ™Å½Ã™â€˜Ã™â€¦Ã˜Â©")}</span>
          <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">${s5Txt("Conf", "Confirm")}</span>
          <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">${s5Txt("NDR", "NDR")}</span>
        </div>`;

          const cityRows = cities.length
            ? cities
                .map((city, i) => {
                  const barPct = Math.round((city.count / maxCount) * 100);
                  const hasDelivered = city.delivered !== undefined;
                  const deliveredCell = hasDelivered
                    ? city.delivered.toLocaleString("en-US")
                    : "-";
                  let ndrCell = "-";
                  let ndrColor = "rgba(255,255,255,0.45)";
                  if (city.count > 0) {
                    const ndrVal = parseFloat(
                      ((city.delivered / city.count) * 100).toFixed(1),
                    );
                    ndrCell = ndrVal + "%";
                    ndrColor = window.dashboardRateColor
                      ? window.dashboardRateColor(ndrVal)
                      : "#ef4444";
                  }
                  const confirmationVal =
                    city.confirmationPct !== undefined
                      ? Number(city.confirmationPct)
                      : city.count > 0
                        ? parseFloat(
                            ((((city.confirmed || 0) +
                              (city.shipping || 0) +
                              (city.processing || 0) +
                              (city.delivered || 0)) /
                              city.count) *
                              100).toFixed(1),
                          )
                        : null;
                  const confirmationCell =
                    confirmationVal === null || isNaN(confirmationVal)
                      ? "-"
                      : confirmationVal + "%";
                  const confirmationColor =
                    confirmationVal === null || isNaN(confirmationVal)
                      ? "rgba(255,255,255,0.45)"
                      : window.dashboardRateColor
                        ? window.dashboardRateColor(confirmationVal)
                        : "#f59e0b";
                  return `<div style="display:grid;grid-template-columns:1fr 46px 52px 48px 48px;gap:5px;
            align-items:center;margin-bottom:${i === cities.length - 1 ? "0" : "7px"};
            padding:5px 6px;border-radius:7px;background:rgba(255,255,255,0.02);">
            <div>
              <div style="font-size:11px;color:rgba(255,255,255,0.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(tx(city.name))}</div>
              <div style="height:2px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;margin-top:3px">
                <div style="height:100%;width:${barPct}%;background:#f59e0b;border-radius:2px"></div>
              </div>
            </div>
            <span style="text-align:center;font-size:12px;font-weight:700;color:#f59e0b">${city.count.toLocaleString("en-US")}</span>
            <span style="text-align:center;font-size:12px;font-weight:700;color:#00e676">${deliveredCell}</span>
            <span style="text-align:center;font-size:11px;font-weight:700;color:${confirmationColor}">${confirmationCell}</span>
            <span style="text-align:center;font-size:11px;font-weight:700;color:${ndrColor}">${ndrCell}</span>
          </div>`;
                })
                .join("")
            : `<div style="color:rgba(255,255,255,0.3);font-size:11px">${s5Txt("No data", "Ã™â€žÃ˜Â§ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã˜Â¯ Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª")}</div>`;

          return `<div style="min-width:0;padding:12px;border-radius:10px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06)">
          <div style="font-size:13px;font-weight:900;color:#f59e0b;margin-bottom:10px">${esc(item.qty)}x</div>
          ${colHdr}${cityRows}
        </div>`;
        })
        .join("")}
      </div>
      ${quantityPaginationHtml}
    </div>`;
    }

    function detailPanelContent(p) {
      return `<div style="display:flex;gap:20px;flex-wrap:wrap">
      <div style="flex:1 1 100%;min-width:220px">
        ${window.renderProductAiAdvisor ? window.renderProductAiAdvisor(p) : ""}
      </div>
      <div style="flex:1;min-width:220px">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);margin-bottom:12px;text-align:right">${s5Txt("Order Funnel", "Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª")}</div>
        ${funnelHTML(p)}
      </div>
      <div style="flex:1;min-width:160px">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);margin-bottom:12px;text-align:right">${s5Txt("Top Cities", "Ã˜Â£Ã˜Â¨Ã˜Â±Ã˜Â² Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã™â€ ")}</div>
        ${citiesHTML(p)}
      </div>
      <div style="flex:1;min-width:120px">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);margin-bottom:12px;text-align:right">${s5Txt("Quantity Distribution", "Ã˜ÂªÃ™Ë†Ã˜Â²Ã™Å Ã˜Â¹ Ã˜Â§Ã™â€žÃ™Æ’Ã™â€¦Ã™Å Ã˜Â§Ã˜Âª")}</div>
        ${piecesBreakdownHTML(p)}
      </div>
      <div style="flex:1 1 100%;min-width:220px">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);margin-bottom:12px;text-align:right">${s5Txt("Top Cities by Quantity", "Ã˜Â£Ã˜Â¨Ã˜Â±Ã˜Â² Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã™â€  Ã˜Â­Ã˜Â³Ã˜Â¨ Ã˜Â§Ã™â€žÃ™Æ’Ã™â€¦Ã™Å Ã˜Â©")}</div>
        ${quantityCitiesHTML(p)}
      </div>
    </div>`;
    }

    function cachedDetailPanelContent(product) {
      var stateKey = productKeyForState(product);
      var key =
        stateKey +
        "|" +
        selectedCurrency() +
        "|" +
        filterState.statusKey +
        "|" +
        (quantityCityPages[stateKey] || 1);
      if (detailPanelCache.has(key)) return detailPanelCache.get(key);
      var html = detailPanelContent(product);
      detailPanelCache.set(key, html);
      return html;
    }

    function refreshDetailPanelContent(panel, product) {
      if (!panel || !product) return;
      panel.innerHTML = cachedDetailPanelContent(product);
      bindQuantityCityPagination(panel, product);
      if (!panel.isConnected) return;
      panel.style.maxHeight = "none";
    }

    const DIV =
      '<div class="s5-col-divider" style="width:1px;align-self:stretch;background:rgba(255,255,255,0.05)"></div>';

    // Ã¢â€â‚¬Ã¢â€â‚¬ Product row HTML Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function productRowHTML(p, i, displayRank) {
      const hs = healthRowStyle(p);
      const compact = viewMode === "compact";
      const minH = compact ? "60px" : "96px";

      const noDeliveryRate = p.deliveredCount === 0;
      const noDeliveriesLabel = s5Txt("No deliveries yet", "Ã™â€žÃ˜Â§ Ã˜ÂªÃ˜Â³Ã™â€žÃ™Å Ã™â€¦Ã˜Â§Ã˜Âª Ã˜Â¨Ã˜Â¹Ã˜Â¯");
      const zeroRate = `<div class="s5-empty-rate" title="${attr(noDeliveriesLabel)}" aria-label="${attr(noDeliveriesLabel)}"><span aria-hidden="true">&mdash;</span></div>`;

      const fadeClass = "";
      const fadeDelay = "";
      const productKey = p.key || p.sku || p.name || i;
      const totalPiecesText = productCompactNumber(p.totalPieces || 0, 0, 10000);
      const failedText = productCompactNumber(p.failedCount || 0, 0, 10000);
      const canceledText = productCompactNumber(p.canceledCount || 0, 0, 10000);
      const averageCommissionText = productCompactNumber(p.averageCommission || 0, 2, 10000);
      const adSpendText = productCompactNumber(p.allocatedAdSpend || 0, 2, 10000);
      const cpaText = productCompactNumber(p.cpa || 0, 2, 10000);
      const breakEvenText = productCompactNumber(p.breakEvenCpa || 0, 2, 10000);
      const pnlText = productCompactNumber(p.profitLoss || 0, 2, 10000);
      let hlCount = p.deliveries || 0;
      if (filterState.statusKey === "shipping") hlCount = p.shippingCount || 0;
      else if (filterState.statusKey === "failed") hlCount = p.failedCount || 0;
      else if (filterState.statusKey === "canceled") hlCount = p.canceledCount || 0;
      else if (filterState.statusKey === "processing") hlCount = p.processingCount || 0;
      const placedText = productCompactNumber(p.placedCount || 0, 0, 10000);
      const hlCountText = productCompactNumber(hlCount, 0, 10000);
      const revenueInFinancialCurrency = commissionInCurrency(p.revenue || 0);
      const revenueText = productCompactNumber(revenueInFinancialCurrency, 0, 10000);

      return `<div class="s5-product-row s5-metrics-track ${fadeClass}" data-idx="${i}" data-product-key="${attr(productKey)}"
         style="display:flex;align-items:center;border-radius:14px;
                background:${hs.bg};
                box-shadow:${hs.shadow};
                border:1px solid ${hs.border};
                opacity:${hs.opacity};
                overflow:hidden;margin-bottom:8px;min-height:${minH};
                ${fadeDelay}">

      <!-- Col 1: Identity -->
      <div class="s5-cell s5-cell-identity" style="flex:0 0 210px;min-width:210px;padding:12px 10px;display:flex;align-items:center;gap:8px">
        ${rankBadgeHTML(displayRank || (i + 1), p.deliveredCount)}
        <div style="text-align:right;min-width:0">
          <div class="s5-product-title" data-modal-open="1" title="${attr(p.name)}" style="font-size:14px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer">${esc(p.name)}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.32);margin-top:3px">${esc(p.cat)}</div>
        </div>
      </div>
      ${DIV}

      <!-- Col 2: Total Orders -->
      <div class="s5-cell s5-cell-orders" style="flex:0 0 70px;text-align:center;padding:0 7px">
        <div id="s5-placed-${i}" class="s5-number-fit" title="${attr(productNumber(p.placedCount || 0, 0))}" style="font-size:${compact ? "16px" : "18px"};font-weight:900;color:rgba(255,255,255,0.8)">${placedText}</div>
      </div>
      ${DIV}

      <!-- Col 3: Quantity -->
      <div class="s5-cell s5-cell-pieces" style="flex:0 0 76px;text-align:center;padding:0 6px">
        <div class="s5-number-fit" title="${attr(productNumber(p.totalPieces || 0, 0))}" style="font-size:${compact ? "15px" : "17px"};font-weight:800;color:#3b82f6">${totalPiecesText}</div>
      </div>
      ${DIV}

      <!-- Col 4: Failed Orders raw count -->
      <div class="s5-cell s5-cell-failed" style="flex:0 0 72px;text-align:center;padding:0 6px">
        <div class="s5-number-fit" title="${attr(productNumber(p.failedCount || 0, 0))}" style="font-size:${compact ? "15px" : "17px"};font-weight:800;color:#f97316">${failedText}</div>
      </div>
      ${DIV}

      <!-- Col 5: Canceled Orders raw count -->
      <div class="s5-cell s5-cell-canceled-raw" style="flex:0 0 76px;text-align:center;padding:0 6px">
        <div class="s5-number-fit" title="${attr(productNumber(p.canceledCount || 0, 0))}" style="font-size:${compact ? "15px" : "17px"};font-weight:800;color:#ef4444">${canceledText}</div>
      </div>
      ${DIV}

      <!-- Col 6: Confirmation % -->
      <div class="s5-cell s5-cell-confirmation" style="flex:0 0 ${compact ? "74px" : "80px"};padding:0 8px">
        ${rateBadgeHTML(p.confirmationPct, "confirmation")}
      </div>
      ${DIV}

      <!-- Col 7: Cancel % -->
      <div class="s5-cell s5-cell-cancel" style="flex:0 0 ${compact ? "74px" : "80px"};padding:0 8px">
        ${rateBadgeHTML(p.cancelPct, "cancel")}
      </div>
      ${DIV}

      <!-- Col 8: NDR % -->
      <div class="s5-cell s5-cell-ndr" style="flex:0 0 ${compact ? "72px" : "76px"};padding:0 7px">
        ${noDeliveryRate ? zeroRate : rateBadgeHTML(p.ndrPct, "ndr")}
      </div>
      ${DIV}

      <!-- Col 9: Delivery % -->
      <div class="s5-cell s5-cell-delivery" style="flex:0 0 ${compact ? "74px" : "80px"};padding:0 8px">
        ${noDeliveryRate ? zeroRate : rateBadgeHTML(p.drRate, "delivery")}
      </div>
      ${DIV}

      <!-- Col 10: Highlighted outcome count -->
      <div class="s5-cell s5-cell-delivery-count" style="flex:0 0 ${compact ? "72px" : "76px"};text-align:center;padding:0 7px">
        <div id="s5-del-${i}" class="s5-number-fit" title="${attr(productNumber(hlCount, 0))}" style="font-size:${compact ? "16px" : "20px"};font-weight:900;color:${
          filterState.statusKey === "shipping"
            ? "#14b8a6"
            : filterState.statusKey === "failed"
              ? "#f97316"
              : filterState.statusKey === "canceled"
                ? "#ef4444"
                : filterState.statusKey === "processing"
                  ? "#3b82f6"
                  : "#14b8a6"
        }">${hlCountText}</div>
      </div>
      ${DIV}

      <!-- Col 11: Average Commission -->
      <div class="s5-cell s5-cell-average-commission" title="${attr(s5Txt("Average commission per delivered order", "Ù…ØªÙˆØ³Ø· Ø§Ù„Ø¹Ù…ÙˆÙ„Ø© Ù„ÙƒÙ„ Ø·Ù„Ø¨ Ù…Ø³Ù„Ù…"))}" style="flex:0 0 98px;text-align:center;padding:0 6px">
        <div class="s5-number-fit" data-financial-value="averageCommission" title="${attr(productMoney(p.averageCommission || 0))}" style="font-size:${compact ? "13px" : "14px"};font-weight:900;color:#38bdf8;white-space:nowrap">${averageCommissionText}</div>
        <div data-financial-currency="averageCommission" style="font-size:9px;color:rgba(56,189,248,0.55);font-weight:700;margin-top:2px">${selectedCurrency()}</div>
      </div>
      ${DIV}

      <!-- Col 12: Allocated Ad Spend -->
      <div class="s5-cell s5-cell-ad-spend" title="${attr(p5Txt("adSpendHelp"))}" style="flex:0 0 88px;text-align:center;padding:0 6px">
        <div class="s5-number-fit" data-financial-value="allocatedAdSpend" title="${attr(productMoney(p.allocatedAdSpend || 0))}" style="font-size:${compact ? "13px" : "14px"};font-weight:800;color:#60a5fa;white-space:nowrap">${adSpendText}</div>
        <div data-financial-currency="allocatedAdSpend" style="font-size:9px;color:rgba(96,165,250,0.55);font-weight:700;margin-top:2px">${selectedCurrency()}</div>
      </div>
      ${DIV}

      <!-- Col 13: CPA -->
      <div class="s5-cell s5-cell-cpa" title="${attr(p5Txt("cpaHelp"))}" style="flex:0 0 84px;text-align:center;padding:0 6px">
        <div class="s5-number-fit" data-financial-value="cpa" title="${attr(productMoney(p.cpa || 0))}" style="font-size:${compact ? "13px" : "14px"};font-weight:800;color:#a78bfa;white-space:nowrap">${cpaText}</div>
        <div data-financial-currency="cpa" style="font-size:9px;color:rgba(167,139,250,0.55);font-weight:700;margin-top:2px">${selectedCurrency()}</div>
      </div>
      ${DIV}

      <!-- Col 14: Break-even CPA -->
      <div class="s5-cell s5-cell-breakeven" title="${attr(p5Txt("breakEvenHelp"))}" style="flex:0 0 90px;text-align:center;padding:0 6px">
        <div class="s5-number-fit" data-financial-value="breakEvenCpa" title="${attr(productMoney(p.breakEvenCpa || 0))}" style="font-size:${compact ? "13px" : "14px"};font-weight:900;color:${(Number(p.cpa) || 0) > (Number(p.breakEvenCpa) || 0) ? "#ef4444" : "#f59e0b"};white-space:nowrap">${breakEvenText}</div>
        <div data-financial-currency="breakEvenCpa" style="font-size:9px;color:rgba(245,158,11,0.55);font-weight:700;margin-top:2px">${selectedCurrency()}</div>
      </div>
      ${DIV}

      <!-- Col 15: P&L -->
      <div class="s5-cell s5-cell-pnl" title="${attr(p5Txt("pnlHelp"))}" style="flex:0 0 88px;text-align:center;padding:0 6px">
        <div class="s5-number-fit" data-financial-value="profitLoss" title="${attr(productMoney(p.profitLoss || 0))}" style="font-size:${compact ? "13px" : "14px"};font-weight:900;color:${p.profitLoss >= 0 ? "#00e676" : "#ef4444"};white-space:nowrap">${pnlText}</div>
        <div data-financial-currency="profitLoss" style="font-size:9px;color:${p.profitLoss >= 0 ? "rgba(0,230,118,0.55)" : "rgba(239,68,68,0.55)"};font-weight:700;margin-top:2px">${selectedCurrency()}</div>
      </div>
      ${DIV}

      <!-- Col 16: Commission -->
      <div class="s5-cell s5-cell-commission" style="flex:0 0 86px;text-align:center;padding:0 7px">
        <div style="font-size:${compact ? "18px" : "22px"};font-weight:900;color:${p.accent || "#f59e0b"};letter-spacing:-0.5px">
          <span id="s5-rev-${i}" class="s5-number-fit" data-financial-value="revenue" title="${attr(productMoney(revenueInFinancialCurrency) + (selectedCurrency() !== activeCurrency ? " | Native: " + productNumber(p.revenue || 0, 0) + " " + activeCurrency : ""))}">${revenueText}</span>
        </div>
        <div data-financial-currency="revenue" style="font-size:9px;color:rgba(255,255,255,0.35);font-weight:600;margin-top:2px">${selectedCurrency()}</div>
      </div>

      <!-- Actions cell -->
      <div class="s5-cell s5-cell-actions" style="width:128px;height:100%;min-height:${minH};flex-shrink:0;display:flex;align-items:center;justify-content:center;gap:6px;
                  background:transparent;position:sticky;right:0;z-index:2;border-left:1px solid var(--dash-border-soft, rgba(255,255,255,0.08));
                  padding:0 8px;box-sizing:border-box;">
        
        <!-- T-22: Show on map button -->
        <button class="s5-map-btn" data-product-key="${attr(productKey)}" data-tooltip="${s5Txt("Analyze cities for this product", "ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ù…Ø¯Ù† Ù„Ù‡Ø°Ø§ Ø§Ù„Ù…Ù†ØªØ¬")}"
                style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(20,184,166,0.3);
                       background:rgba(20,184,166,0.1);color:#14b8a6;font-size:12px;
                       display:flex;align-items:center;justify-content:center;cursor:pointer;
                       flex-shrink:0;padding:0;">
          ðŸ—ºï¸
        </button>

        <!-- Modal Details Button -->
        <button class="s5-modal-btn" data-modal-open="1" data-product-key="${attr(productKey)}" data-tooltip="${s5Txt("View full product details", "Ø¹Ø±Ø¶ ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ù…Ù†ØªØ¬ ÙƒØ§Ù…Ù„Ø©")}"
                style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(139,92,246,0.3);
                       background:rgba(139,92,246,0.1);color:#8b5cf6;
                       display:flex;align-items:center;justify-content:center;cursor:pointer;
                       flex-shrink:0;padding:0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        </button>

        <!-- Compare product button -->
        <button class="s5-compare-row-btn" data-compare-open="1" data-product-key="${attr(productKey)}" data-tooltip="${s5Txt("Compare this product", "\u0642\u0627\u0631\u0646 \u0647\u0630\u0627 \u0627\u0644\u0645\u0646\u062a\u062c")}"
                style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(245,158,11,0.38);
                       background:rgba(245,158,11,0.12);color:#f59e0b;
                       display:flex;align-items:center;justify-content:center;cursor:pointer;
                       flex-shrink:0;padding:0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><path d="M12 3v18"/><path d="M5 7h14"/><path d="M6 7l-4 7h8L6 7z"/><path d="M18 7l-4 7h8l-4-7z"/></svg>
        </button>

        <!-- Expand accordion button -->
        <button class="s5-expand-btn" data-idx="${i}" data-tooltip="${s5Txt("Quick analysis (funnel / cities)", "ØªØ­Ù„ÙŠÙ„ Ø³Ø±ÙŠØ¹ (Ù…Ø³Ø§Ø± / Ù…Ø¯Ù†)")}"
                style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);
                       background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.6);
                       display:flex;align-items:center;justify-content:center;cursor:pointer;
                       flex-shrink:0;padding:0;">
          <svg class="s5-expand-arrow" data-idx="${i}" width="14" height="14" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2.5"
               style="pointer-events:none">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Detail panel -->
    <div class="s5-detail-panel" id="s5-detail-${i}"
         style="display:none;max-height:0;overflow:hidden;opacity:1;
                padding:0 24px;
                margin-bottom:0;border-radius:14px;
                background:rgba(255,255,255,0.02);
                border:1px solid rgba(255,255,255,0);
                box-sizing:border-box">
    </div>`;
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Column header sort button Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function colHeaderBtn(label, field, flexStyle) {
      const isActive = sortState.field === field;
      const arrow = isActive
        ? sortState.dir === "desc"
          ? "v"
          : "^"
        : "-";
      const arrowColor = isActive ? "#f59e0b" : "rgba(255,255,255,0.2)";
      return `<button class="s5-sort-col" data-field="${field}"
        style="${flexStyle};background:none;border:none;color:rgba(255,255,255,0.35);
               font-size:11px;font-weight:700;cursor:pointer;
               display:flex;align-items:center;justify-content:center;gap:4px;
               font-family:inherit;padding:0;width:100%;text-align:center;
               ">
      ${label}
      <span class="s5-sort-arrow" data-field="${field}" style="color:${arrowColor}">${arrow}</span>
    </button>`;
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Pagination Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function paginationHTML(list) {
      list = list || currentList();
      const total = totalProductPages(list);
      if (total <= 1) return "";

      const start = (currentPage - 1) * PAGE_SIZE + 1;
      const end = Math.min(currentPage * PAGE_SIZE, list.length);

      if (window.renderDashboardPagination) {
        return window.renderDashboardPagination({
          currentPage: currentPage,
          totalPages: total,
          totalItems: list.length,
          startItem: start,
          endItem: end,
          itemLabel: s5Txt("product", "\u0645\u0646\u062a\u062c"),
          pageButtonClass: "s5-page-btn",
          prevId: "s5-prev-page",
          nextId: "s5-next-page",
          className: "s5-dashboard-pagination",
        });
      }

      function pageButtons() {
        const pages = [];
        const WINDOW = 2;

        for (let p = 1; p <= total; p++) {
          if (
            p === 1 ||
            p === total ||
            (p >= currentPage - WINDOW && p <= currentPage + WINDOW)
          ) {
            pages.push(p);
          } else if (pages[pages.length - 1] !== "â€¦") {
            pages.push("â€¦");
          }
        }

        return pages
          .map((p) => {
            if (p === "â€¦") {
              return `<span style="width:32px;text-align:center;color:rgba(255,255,255,0.25);font-size:13px;font-weight:600;user-select:none">â€¦</span>`;
            }
            const isActive = p === currentPage;
            return `<button class="s5-page-btn" data-page="${p}"
          style="width:32px;height:32px;border-radius:8px;border:1px solid ${isActive ? "#f59e0b" : "rgba(255,255,255,0.1)"};
                 background:${isActive ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.03)"};
                 color:${isActive ? "#f59e0b" : "rgba(255,255,255,0.6)"};
                 font-size:13px;font-weight:${isActive ? "800" : "600"};
                 cursor:${isActive ? "default" : "pointer"};font-family:inherit;
                 transition:all 0.18s;display:inline-flex;align-items:center;justify-content:center">${p}</button>`;
          })
          .join("");
      }

      const prevDisabled = currentPage <= 1;
      const nextDisabled = currentPage >= total;

      const arrowStyle = (disabled) =>
        `width:32px;height:32px;border-radius:8px;border:1px solid ${disabled ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.12)"};
       background:${disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)"};
       color:${disabled ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.7)"};
       cursor:${disabled ? "default" : "pointer"};font-family:inherit;
       display:inline-flex;align-items:center;justify-content:center;
       transition:all 0.18s;flex-shrink:0`;

      return `<div id="s5-pagination" style="display:flex;align-items:center;justify-content:space-between;gap:10px;
              margin:14px 0 24px;padding:12px 16px;
              border:1px solid rgba(255,255,255,0.06);border-radius:12px;
              background:rgba(255,255,255,0.02);direction:${isAr ? "ltr" : "rtl"}">
      <button id="s5-prev-page" ${prevDisabled ? "disabled" : ""} style="${arrowStyle(prevDisabled)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div style="display:flex;align-items:center;gap:6px;flex:1;justify-content:center;flex-wrap:wrap">
        ${pageButtons()}
      </div>
      <button id="s5-next-page" ${nextDisabled ? "disabled" : ""} style="${arrowStyle(nextDisabled)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
    <div style="text-align:center;font-size:11px;color:rgba(255,255,255,0.3);font-weight:600;margin-bottom:8px;direction:${isAr ? "rtl" : "ltr"}">
      ${s5Txt(`Showing ${start}â€“${end} of ${list.length} products`, `Ã˜Â¹Ã˜Â±Ã˜Â¶ ${start}â€“${end} Ã™â€¦Ã™â€  ${list.length} Ã™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬`)}
    </div>`;
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Stat card Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function statCardHTML(c, i) {
      return `<div class="s5-stat-card" style="flex:1;background:#0b1120;border:1px solid ${c.color}28;border-radius:14px;padding:14px 16px;direction:${isAr ? "ltr" : "rtl"};display:flex;flex-direction:row;align-items:center;gap:14px;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 20% 50%,${c.color}10 0%,transparent 65%)"></div>
      <div style="width:46px;height:46px;border-radius:12px;flex-shrink:0;background:${c.color}22;border:1.5px solid ${c.color}35;display:flex;align-items:center;justify-content:center;position:relative;z-index:1">${statIconHTML(c.iconType, c.color)}</div>
      <div style="flex:1;text-align:right;direction:${isAr ? "rtl" : "ltr"};position:relative;z-index:1">
        <div style="font-size:10px;color:rgba(255,255,255,0.35);font-weight:600;margin-bottom:4px;line-height:1.3">${c.label}</div>
        <div id="s5-stat-${i}" class="s5-stat-value s5-number-fit" title="${attr(productNumber(c.value, 0))}" style="font-size:26px;font-weight:900;color:#fff;line-height:1;letter-spacing:0">${productCompactNumber(c.value || 0, 0, 10000)}</div>
        <div data-stat-unit="${i}" style="font-size:10px;color:${c.color};font-weight:700;margin-top:4px;letter-spacing:0.3px">${c.unit}</div>
      </div>
    </div>`;
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Insight card Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function insightCardHTML(ins, i) {
      return `<div data-insight-card="${i}" style="flex:1;background:${ins.bg};border:1px solid ${ins.border};border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;direction:${isAr ? "ltr" : "rtl"}">
      <div style="width:44px;height:44px;border-radius:50%;flex-shrink:0;background:${ins.iconGlow}22;border:1.5px solid ${ins.iconGlow}35;display:flex;align-items:center;justify-content:center;font-size:20px">${ins.emoji}</div>
      <div style="flex:1;text-align:right;direction:${isAr ? "rtl" : "ltr"}">
        <div style="font-size:10px;color:rgba(255,255,255,0.4);font-weight:600;margin-bottom:3px">${ins.label}</div>
        <div data-insight-value="${i}" style="font-size:12px;font-weight:700;color:#fff;margin-bottom:4px;line-height:1.3">${esc(ins.value)}</div>
        <div data-insight-detail="${i}" style="font-size:11px;font-weight:700;color:${ins.detailColor}">${esc(ins.detail)}</div>
      </div>
    </div>`;
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Sort options Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const SORT_OPTIONS = [
      {
        value: "deliveredCount",
        label: s5Txt("Deliveries", "Ã˜Â¹Ã˜Â¯Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â³Ã™â€žÃ™Å Ã™â€¦Ã˜Â§Ã˜Âª"),
        icon: "ðŸ“¦",
      },
      {
        value: "commission",
        label: s5Txt("Commission", "Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™Ë†Ã™â€žÃ˜Â©"),
        icon: "ðŸ’°",
      },
      { value: "ndrPct", label: "NDR", icon: "%" },
      {
        value: "drRate",
        label: s5Txt("Delivery Rate", "Ã™â€ Ã˜Â³Ã˜Â¨Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â³Ã™â€žÃ™Å Ã™â€¦"),
        icon: "âœ…",
      },
      {
        value: "scalingScore",
        label: s5Txt("Scale Index", "Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â³Ã˜Â¹"),
        icon: "*",
      },
      {
        value: "cancelPct",
        label: s5Txt("Cancellation Rate", "Ã™â€ Ã˜Â³Ã˜Â¨Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¥Ã™â€žÃ˜ÂºÃ˜Â§Ã˜Â¡"),
        icon: "âŒ",
      },
      {
        value: "placedCount",
        label: s5Txt("Total Orders", "Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª"),
        icon: "ðŸ“‹",
      },
      {
        value: "totalPieces",
        label: s5Txt("Quantity", "Quantity"),
        icon: "BOX",
      },
      {
        value: "confirmationPct",
        label: s5Txt("Confirmation Rate", "Ã™â€ Ã˜Â³Ã˜Â¨Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â£Ã™Æ’Ã™Å Ã˜Â¯"),
        icon: "â˜‘ï¸",
      },
      { value: "failedCount", label: p5Txt("failedOrders"), icon: "!" },
      {
        value: "canceledCount",
        label: s5Txt("Canceled Count", "Ã˜Â¹Ã˜Â¯Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã™â€žÃ˜ÂºÃ™Å Ã˜Â©"),
        icon: "ðŸš«",
      },
      {
        value: "averageCommission",
        label: s5Txt("Average Commission", "Ù…ØªÙˆØ³Ø· Ø§Ù„Ø¹Ù…ÙˆÙ„Ø©"),
        icon: "$",
      },
      { value: "allocatedAdSpend", label: p5Txt("adSpend"), icon: "$" },
      { value: "cpa", label: p5Txt("cpa"), icon: "$" },
      { value: "breakEvenCpa", label: p5Txt("breakEven"), icon: "$" },
      { value: "profitLoss", label: p5Txt("pnl"), icon: "$" },
      {
        value: "shippingCount",
        label: s5Txt("In Shipping", "Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â­Ã™â€ "),
        icon: "ðŸšš",
      },
      {
        value: "processingCount",
        label: s5Txt("Processing", "Ã™â€šÃ™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã˜Â§Ã™â€žÃ˜Â¬Ã˜Â©"),
        icon: "â³",
      },
    ];

    function activeSortLabel() {
      if (sortState.field === "default")
        return s5Txt("Default", "Ã˜Â§Ã™â€žÃ˜Â§Ã™ÂÃ˜ÂªÃ˜Â±Ã˜Â§Ã˜Â¶Ã™Å ");
      const opt = SORT_OPTIONS.find((o) => o.value === sortState.field);
      return opt ? opt.label : s5Txt("Default", "Ã˜Â§Ã™â€žÃ˜Â§Ã™ÂÃ˜ÂªÃ˜Â±Ã˜Â§Ã˜Â¶Ã™Å ");
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ FIX 3 helper: filter bar re-render needs to know the current dropdown state Ã¢â€â‚¬Ã¢â€â‚¬
    let _dropdownOpen = false;

    // Ã¢â€â‚¬Ã¢â€â‚¬ Filter bar Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function filterBarHTML(list) {
      const filteredCount = (list || currentList()).length;
      const pillsHTML = STATUS_PILLS.map((pill) => {
        const isActive = filterState.statusKey === pill.key;
        const isAll = pill.key === "all";

        if (isAll) {
          return `<button class="s5-pill" data-key="all"
          style="display:flex;align-items:center;gap:6px;
                 padding:6px 14px;border-radius:100px;font-size:12px;font-weight:${isActive ? "800" : "600"};
                 border:1px solid ${isActive ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.1)"};
                 cursor:pointer;font-family:inherit;
                 background:${isActive ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)"};
                 color:${isActive ? "#fff" : "rgba(255,255,255,0.5)"};
                 white-space:nowrap">
          ${s5Txt("All", "Ã˜Â§Ã™â€žÃ™Æ’Ã™â€ž")}
          ${isActive ? `<span style="background:#f59e0b;color:#000;font-size:9px;font-weight:900;padding:1px 6px;border-radius:100px;line-height:1.5">${filteredCount}</span>` : ""}
        </button>`;
        }

        return `<button class="s5-pill" data-key="${pill.key}"
          style="display:flex;align-items:center;gap:6px;
                 padding:6px 14px;border-radius:100px;font-size:12px;font-weight:${isActive ? "800" : "600"};
                 border:1px solid ${isActive ? pill.color + "60" : "rgba(255,255,255,0.08)"};
                 cursor:pointer;font-family:inherit;
                 background:${isActive ? pill.color + "18" : "rgba(255,255,255,0.03)"};
                 color:${isActive ? pill.color : "rgba(255,255,255,0.45)"};
                 white-space:nowrap">
        <span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;
                     background:${isActive ? pill.color : "rgba(255,255,255,0.2)"};
                     "></span>
        ${pill.label}
      </button>`;
      }).join("");

      const sortMenuHTML = SORT_OPTIONS.map((opt) => {
        const isActive = sortState.field === opt.value;
        return `<div class="s5-sort-option ${isActive ? "active" : ""}" data-value="${opt.value}">
        <span class="s5-opt-dot"></span>
        <span style="font-size:14px;line-height:1">${opt.icon}</span>
        <span>${opt.label}</span>
        ${isActive ? `<svg style="margin-right:auto;flex-shrink:0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ""}
      </div>`;
      }).join("");

      return `<div id="s5-filter-bar"
        style="margin-bottom:16px;
               background:linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%);
               border:1px solid rgba(255,255,255,0.09);
               border-radius:16px;padding:14px 16px;direction:${isAr ? "rtl" : "ltr"};
               ">

      <!-- Search bar -->
      <div style="position:relative;margin-bottom:12px">
        <svg style="position:absolute;right:14px;top:50%;transform:translateY(-50%);opacity:0.35;pointer-events:none;z-index:1"
             width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input id="s5-search" type="text" placeholder="${s5Txt("Search by Product name or SKU...", "Ã˜Â§Ã˜Â¨Ã˜Â­Ã˜Â« Ã˜Â¨Ã˜Â§Ã˜Â³Ã™â€¦ Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬ Ã˜Â£Ã™Ë† SKU...")}" value="${attr(filterState.search)}"
          style="width:100%;padding:10px 42px 10px 42px;border-radius:11px;
                 border:1px solid rgba(255,255,255,0.1);
                 background:rgba(255,255,255,0.05);color:#fff;font-size:13px;font-family:inherit;
                 outline:none;box-sizing:border-box;direction:${isAr ? "rtl" : "ltr"};
                 "/>
        ${
          filterState.search
            ? `<button id="s5-search-clear"
          style="position:absolute;left:12px;top:50%;transform:translateY(-50%);
                 width:20px;height:20px;border-radius:50%;border:none;cursor:pointer;
                 background:rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);
                 display:flex;align-items:center;justify-content:center;font-size:10px;
                 line-height:1;padding:0;font-family:inherit">x</button>`
            : ""
        }
      </div>

      <!-- Row 2: pills + sort -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div id="s5-status-pills" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          ${pillsHTML}
          
          <div style="display:flex;align-items:center;gap:12px;margin-inline-start:12px;padding-inline-start:12px;border-inline-start:1px solid rgba(255,255,255,0.06);">
            <div style="display:flex;align-items:center;gap:4px;" title="${s5Txt("Delivery rate >= 40%", "Ù†Ø³Ø¨Ø© Ø§Ù„ØªØ³Ù„ÙŠÙ… >= 40%")}">
               <div style="width:8px;height:8px;border-radius:50%;background:#22d3ee"></div>
               <span style="font-size:10px;color:rgba(255,255,255,0.45);font-weight:600">${s5Txt("Scalable", "Ã™â€šÃ˜Â§Ã˜Â¨Ã™â€ž Ã™â€žÃ™â€žÃ˜ÂªÃ™Ë†Ã˜Â³Ã˜Â¹")}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;" title="${s5Txt("Cancel rate >= 40%", "Ù†Ø³Ø¨Ø© Ø§Ù„Ø¥Ù„ØºØ§Ø¡ >= 40%")}">
               <div style="width:8px;height:8px;border-radius:50%;background:#ef4444"></div>
               <span style="font-size:10px;color:rgba(255,255,255,0.45);font-weight:600">${s5Txt("Danger", "Ã˜Â®Ã˜Â·Ã˜Â±")}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;" title="${s5Txt("NDR < 20%", "Ù†Ø³Ø¨Ø© Ø§Ù„ØªØ³Ù„ÙŠÙ… Ø§Ù„ØµØ§ÙÙŠ < 20%")}">
               <div style="width:8px;height:8px;border-radius:50%;background:#ef4444"></div>
               <span style="font-size:10px;color:rgba(255,255,255,0.45);font-weight:600">${s5Txt("Warning", "Ã˜ÂªÃ˜Â­Ã˜Â°Ã™Å Ã˜Â±")}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;" title="${s5Txt("Top 3 performing products", "Ø£ÙØ¶Ù„ 3 Ù…Ù†ØªØ¬Ø§Øª Ø£Ø¯Ø§Ø¡")}">
               <div style="width:8px;height:8px;border-radius:50%;background:#fbbf24"></div>
               <span style="font-size:10px;color:rgba(255,255,255,0.45);font-weight:600">${s5Txt("Top Products", "Ã˜Â£Ã™ÂÃ˜Â¶Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Âª")}</span>
            </div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:10px;border:1px solid rgba(255,255,255,0.09);background:rgba(255,255,255,0.035)">
            <span style="font-size:10px;color:rgba(255,255,255,0.38);font-weight:800;white-space:nowrap">${s5Txt("Currency", "Currency")}</span>
            <div id="s5-currency-select" style="width:82px;min-width:82px"></div>
          </div>
          <button id="s5-compare-open" data-tooltip="${s5Txt("Compare Products", "Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª")}" style="display:flex;align-items:center;gap:7px;padding:7px 13px;border-radius:10px;border:1px solid rgba(245,158,11,0.38);background:rgba(245,158,11,0.12);color:#fbbf24;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 7h14"/><path d="M6 7l-4 7h8L6 7z"/><path d="M18 7l-4 7h8l-4-7z"/></svg>
            ${s5Txt("Compare Products", "Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª")}
          </button>
          <div style="width:1px;height:20px;background:rgba(255,255,255,0.08);flex-shrink:0"></div>
          <span style="font-size:10px;color:rgba(255,255,255,0.28);font-weight:700;
                       letter-spacing:0.5px;white-space:nowrap;text-transform:uppercase">${s5Txt("Sort", "Ã˜ÂªÃ˜Â±Ã˜ÂªÃ™Å Ã˜Â¨")}</span>

          <!-- Trigger only Ã¢â‚¬â€ menu is body-teleported in bindFilterBar to escape overflow:hidden -->
          <div class="s5-sort-dropdown" id="s5-sort-dropdown" style="position:relative">
            <div class="s5-sort-trigger" id="s5-sort-trigger" tabindex="0">
              <span id="s5-sort-label" style="direction:${isAr ? "rtl" : "ltr"}">${activeSortLabel()}</span>
              <svg class="s5-sort-chevron" width="12" height="12" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2.5"
                   stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>

          <!-- Direction toggle -->
          <div style="display:flex;align-items:center;gap:4px;">
            ${
              sortState.field !== "default"
                ? `
            <button id="s5-clear-sort" title="${s5Txt("Clear Sort", "Ø¥Ù„ØºØ§Ø¡ Ø§Ù„ØªØ±ØªÙŠØ¨")}"
              style="width:34px;height:34px;border-radius:9px;border:1px solid rgba(239,68,68,0.2);
                     background:rgba(239,68,68,0.05);color:#ef4444;display:flex;align-items:center;
                     justify-content:center;cursor:pointer;flex-shrink:0;padding:0;box-sizing:border-box;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>`
                : ""
            }
            
            <button id="s5-sort-dir-btn"
            style="width:34px;height:34px;border-radius:9px;
                   border:1px solid rgba(255,255,255,0.1);
                   background:rgba(255,255,255,0.04);
                   color:rgba(255,255,255,0.6);cursor:pointer;
                   display:flex;align-items:center;justify-content:center;
                   flex-shrink:0;padding:0;box-sizing:border-box;"
            title="${sortState.dir === "desc" ? s5Txt("Ascending", "ØªØµØ§Ø¹Ø¯ÙŠ") : s5Txt("Descending", "ØªÙ†Ø§Ø²Ù„ÙŠ")}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              ${
                sortState.dir === "desc"
                  ? '<path d="M12 20V4M5 13l7 7 7-7"/>'
                  : '<path d="M12 4v16M5 11l7-7 7 7"/>'
              }
            </svg>
          </button>
          </div>
        </div>
      </div>
    </div>`;
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Column headers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function columnHeadersHTML() {
      const compact = viewMode === "compact";
      return `<div class="s5-header-cols s5-metrics-track" style="display:flex;align-items:center;padding:0 0 10px 0;border-bottom:1px solid rgba(255,255,255,0.05);margin-bottom:14px;position:sticky;top:0;z-index:9;background:#080b12">
      <div style="flex:0 0 210px;min-width:210px;padding-right:10px;font-size:10px;color:rgba(255,255,255,0.3);font-weight:700;text-align:right">${s5Txt("Product", "Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬")}</div>
      <div style="width:1px"></div>
      ${colHeaderBtn(s5Txt("Orders", "Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª"), "placedCount", "flex:0 0 70px")}
      <div style="width:1px"></div>
      ${colHeaderBtn(s5Txt("Quantity", "Quantity"), "totalPieces", "flex:0 0 76px")}
      <div style="width:1px"></div>
      ${colHeaderBtn(p5Txt("failedOrders"), "failedCount", "flex:0 0 72px")}
      <div style="width:1px"></div>
      ${colHeaderBtn(p5Txt("canceledOrders"), "canceledCount", "flex:0 0 76px")}
      <div style="width:1px"></div>
      ${colHeaderBtn(s5Txt("Confirm", "Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â£Ã™Æ’Ã™Å Ã˜Â¯"), "confirmationPct", `flex:0 0 ${compact ? "74" : "80"}px`)}
      <div style="width:1px"></div>
      ${colHeaderBtn(s5Txt("Cancel", "Ã˜Â§Ã™â€žÃ˜Â¥Ã™â€žÃ˜ÂºÃ˜Â§Ã˜Â¡"), "cancelPct", `flex:0 0 ${compact ? "74" : "80"}px`)}
      <div style="width:1px"></div>
      ${colHeaderBtn("NDR", "ndrPct", `flex:0 0 ${compact ? "72" : "76"}px`)}
      <div style="width:1px"></div>
      ${colHeaderBtn(s5Txt("DR", "Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â³Ã™â€žÃ™Å Ã™â€¦"), "drRate", `flex:0 0 ${compact ? "74" : "80"}px`)}
      <div style="width:1px"></div>
      ${colHeaderBtn(
        filterState.statusKey === "shipping"
          ? s5Txt("Shipping", "Ã˜Â´Ã˜Â­Ã™â€ ")
          : filterState.statusKey === "failed"
            ? p5Txt("failedShort")
            : filterState.statusKey === "canceled"
              ? s5Txt("Canceled", "Ã™â€¦Ã™â€žÃ˜ÂºÃ™Å ")
              : filterState.statusKey === "processing"
                ? s5Txt("Processing", "Ã™â€¦Ã˜Â¹Ã˜Â§Ã™â€žÃ˜Â¬Ã˜Â©")
                : s5Txt("Delivered", "Ã˜ÂªÃ™â€¦ Ã˜ÂªÃ˜Â³Ã™â€žÃ™Å Ã™â€¦Ã™â€¡Ã˜Â§"),
        filterState.statusKey === "shipping"
          ? "shippingCount"
          : filterState.statusKey === "failed"
            ? "failedCount"
            : filterState.statusKey === "canceled"
              ? "canceledCount"
              : filterState.statusKey === "processing"
                ? "processingCount"
                : "deliveredCount",
        `flex:0 0 ${compact ? "72" : "76"}px`,
      )}
      <div style="width:1px"></div>
      ${colHeaderBtn(s5Txt("Average Commission", "Ù…ØªÙˆØ³Ø· Ø§Ù„Ø¹Ù…ÙˆÙ„Ø©"), "averageCommission", "flex:0 0 98px")}
      <div style="width:1px"></div>
      ${colHeaderBtn(p5Txt("adSpend"), "allocatedAdSpend", "flex:0 0 88px")}
      <div style="width:1px"></div>
      ${colHeaderBtn(p5Txt("cpa"), "cpa", "flex:0 0 84px")}
      <div style="width:1px"></div>
      ${colHeaderBtn(p5Txt("breakEven"), "breakEvenCpa", "flex:0 0 90px")}
      <div style="width:1px"></div>
      ${colHeaderBtn(p5Txt("pnl"), "profitLoss", "flex:0 0 88px")}
      <div style="width:1px"></div>
      ${colHeaderBtn(s5Txt("Commission", "Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™Ë†Ã™â€žÃ˜Â©"), "commission", "flex:0 0 86px")}
      <div style="width:1px"></div>
      <div style="width:128px;text-align:center;font-size:10px;color:rgba(255,255,255,0.3);font-weight:700;position:sticky;right:0;background:transparent;z-index:10;border-left:1px solid var(--dash-border-soft, rgba(255,255,255,0.08));">${s5Txt("Actions", "Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡Ã˜Â§Ã˜Âª")}</div>
    </div>`;
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Main render Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const initialProductList = currentList();
    const initialPagedProducts = pagedProducts(initialProductList);

    mountEl.innerHTML = `
    <style>
      .fade-up {
        opacity: 1;
        animation: none;
        will-change: auto;
      }
      .s5-root {
        --s5-row-num-size: 14px;
        --s5-row-num-size-strong: 16px;
        --s5-name-size: 14px;
        --s5-sku-size: 11px;
      }
      .s5-number-fit {
        display: inline-block;
        max-width: 100%;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        direction: ltr;
        unicode-bidi: isolate;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0 !important;
        line-height: 1.05;
      }
      .s5-cell {
        min-width: 0;
        box-sizing: border-box;
      }
      .s5-cell > div {
        max-width: 100%;
      }
      .s5-empty-rate {
        width: 28px;
        height: 22px;
        margin-inline: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        border: 1px dashed rgba(148,163,184,0.24);
        border-radius: 7px;
        background: rgba(148,163,184,0.055);
        color: rgba(203,213,225,0.5);
        font-size: 14px;
        font-weight: 800;
        line-height: 1;
        cursor: help;
      }
      .s5-empty-rate:hover {
        border-color: rgba(148,163,184,0.42);
        background: rgba(148,163,184,0.1);
        color: rgba(226,232,240,0.75);
      }
      .s5-product-title {
        font-size: var(--s5-name-size) !important;
        max-width: 100%;
      }

      /* Ã¢â€â‚¬Ã¢â€â‚¬ Row hover Ã¢â€â‚¬Ã¢â€â‚¬ */
      .s5-product-row { outline: none !important; -webkit-tap-highlight-color: transparent; }
      .s5-product-row:focus, .s5-product-row:active { outline: none !important; }
      .s5-product-row:hover {
        border-color: rgba(255,255,255,0.13) !important;
      }

      /* Ã¢â€â‚¬Ã¢â€â‚¬ Expand cell Ã¢â€â‚¬Ã¢â€â‚¬ */
      .s5-expand-btn:hover { background: rgba(255,255,255,0.07) !important; }
      .s5-expand-btn:hover .s5-expand-icon-wrap {
        background: rgba(255,255,255,0.1) !important;
        border-color: rgba(255,255,255,0.28) !important;
      }

      /* Ã¢â€â‚¬Ã¢â€â‚¬ Pagination Ã¢â€â‚¬Ã¢â€â‚¬ */
      .s5-quantity-pagination .dash-pagination-spacer,
      .s5-quantity-pagination .dash-pagination-info {
        display: none !important;
      }
      .s5-quantity-pagination {
        justify-content: center !important;
      }
      @media (max-width: 1120px) {
        .s5-quantity-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      }
      @media (max-width: 680px) {
        .s5-quantity-card-grid { grid-template-columns: 1fr !important; }
      }
      .s5-page-btn:hover:not([disabled]) {
        background: rgba(255,255,255,0.09) !important;
        border-color: rgba(255,255,255,0.25) !important;
        color: #fff !important;
      }
      #s5-prev-page:hover:not([disabled]),
      #s5-next-page:hover:not([disabled]) {
        background: rgba(255,255,255,0.09) !important;
        border-color: rgba(255,255,255,0.25) !important;
        color: #fff !important;
      }

      /* Ã¢â€â‚¬Ã¢â€â‚¬ Search input focus Ã¢â€â‚¬Ã¢â€â‚¬ */
      #s5-search:focus {
        border-color: rgba(245,158,11,0.5) !important;
        background: rgba(245,158,11,0.04) !important;
      }
      #s5-search-clear {
        width: 28px !important;
        height: 28px !important;
        min-width: 28px !important;
        max-width: 28px !important;
        min-height: 28px !important;
        aspect-ratio: 1 / 1 !important;
        border-radius: 999px !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        flex: 0 0 28px !important;
        font-size: 0 !important;
      }
      #s5-search-clear svg { display: none !important; }
      #s5-search-clear::before,
      #s5-search-clear::after {
        content: "";
        position: absolute;
        width: 11px;
        height: 2px;
        border-radius: 99px;
        background: currentColor;
        left: 50%;
        top: 50%;
      }
      #s5-search-clear::before { transform: translate(-50%, -50%) rotate(45deg); }
      #s5-search-clear::after { transform: translate(-50%, -50%) rotate(-45deg); }

      /* Ã¢â€â‚¬Ã¢â€â‚¬ Status pills Ã¢â€â‚¬Ã¢â€â‚¬ */
      .s5-pill:hover { filter: brightness(1.08) !important; }

      /* Ã¢â€â‚¬Ã¢â€â‚¬ Custom dropdown Ã¢â‚¬â€ FIX 2: z-index 99999 Ã¢â€â‚¬Ã¢â€â‚¬ */
      .s5-sort-dropdown { position: relative; user-select: none; }
      .s5-sort-trigger {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        color: #fff; font-size: 12px; font-weight: 600;
        cursor: pointer; white-space: nowrap;
        font-family: 'Cairo', sans-serif;
        min-width: 148px; justify-content: space-between;
      }
      .s5-sort-trigger:hover {
        background: rgba(255,255,255,0.09);
        border-color: rgba(255,255,255,0.22);
      }
      .s5-sort-trigger.open {
        background: rgba(245,158,11,0.1);
        border-color: rgba(245,158,11,0.45);
        color: #f59e0b;
      }
      .s5-sort-trigger.open .s5-sort-chevron { color: #f59e0b; }
      .s5-sort-chevron { color: rgba(255,255,255,0.4); flex-shrink: 0; }

      /* Ã¢â€â‚¬Ã¢â€â‚¬ Sort col header Ã¢â€â‚¬Ã¢â€â‚¬ */
      .s5-sort-col { transition: none !important; }
      .s5-sort-col:hover { color: rgba(255,255,255,0.7) !important; }

      /* Ã¢â€â‚¬Ã¢â€â‚¬ Rate badge bar fill Ã¢â€â‚¬Ã¢â€â‚¬ */
      .s5-rate-bar { transition: none !important; }

      /* Ã¢â€â‚¬Ã¢â€â‚¬ Stat card hover Ã¢â€â‚¬Ã¢â€â‚¬ */
      .s5-stat-card:hover { border-color: rgba(255,255,255,0.16) !important; }

      /* Ã¢â€â‚¬Ã¢â€â‚¬ Detail panel Ã¢â€â‚¬Ã¢â€â‚¬ */
      .s5-detail-panel {
        transition: max-height 0.2s cubic-bezier(0.4,0,0.2,1),
                    opacity 0.15s ease,
                    padding 0.2s cubic-bezier(0.4,0,0.2,1),
                    margin-bottom 0.2s cubic-bezier(0.4,0,0.2,1) !important;
      }
      .s5-compare-modal-panel {
        width: min(1200px, calc(100vw - 24px));
        max-height: calc(100vh - 24px);
        box-sizing: border-box;
      }
      .s5-compare-modal-panel * { box-sizing: border-box; }
      .s5-compare-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 36px minmax(0, 1fr);
        gap: 14px;
        align-items: start;
      }
      .s5-compare-column,
      .s5-compare-verdict {
      }
      .s5-compare-metric {
      }
      .s5-compare-metric.is-winner {
        border-color: color-mix(in srgb, var(--cmp-win-color, #00e676) 55%, transparent) !important;
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--cmp-win-color, #00e676) 20%, transparent),
                    0 0 18px color-mix(in srgb, var(--cmp-win-color, #00e676) 12%, transparent) !important;
        background: color-mix(in srgb, var(--cmp-win-color, #00e676) 7%, transparent) !important;
      }
    .s5-compare-metric.is-loser {
  border-color: rgba(245,158,11,0.3) !important;
  background: rgba(245,158,11,0.04) !important;
  opacity: 0.85;
}
      .s5-compare-metric.is-danger {
        border-color: rgba(239,68,68,0.55) !important;
        box-shadow: 0 0 0 1px rgba(239,68,68,0.22), 0 0 18px rgba(239,68,68,0.13) !important;
        background: rgba(239,68,68,0.07) !important;
        opacity: 1 !important;
      }
      .s5-compare-section-header {
        display: flex;
        align-items: center;
        gap: 7px;
        margin: 16px 0 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .s5-compare-section-header:first-child {
        margin-top: 4px;
      }
      .s5-cmp-cards-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px;
      }
      .s5-cmp-cards-grid.cols-1 {
        grid-template-columns: 1fr;
      }
      @media (max-width: 860px) {
        .s5-compare-grid {
          grid-template-columns: 1fr !important;
        }
        .s5-compare-modal-panel {
          width: calc(100vw - 16px) !important;
          border-radius: 16px !important;
        }
        .s5-compare-divider {
          min-height: 42px !important;
          flex-direction: row !important;
        }
        .s5-compare-divider-line {
          width: 100% !important;
          height: 1px !important;
        }
      }
      @media (max-width: 560px) {
        .s5-cmp-cards-grid {
          grid-template-columns: 1fr !important;
        }
      }
      @media (max-width: 1366px) {
        .s5-root {
          --s5-row-num-size: 12px;
          --s5-row-num-size-strong: 14px;
          --s5-name-size: 12.5px;
          --s5-sku-size: 10px;
        }
        .s5-topbar {
          height: 60px !important;
          padding-inline: 18px !important;
        }
        .s5-status-chip {
          padding: 6px 10px !important;
          font-size: 11px !important;
        }
        .s5-stat-row {
          gap: 9px !important;
          margin-bottom: 14px !important;
        }
        .s5-stat-card {
          padding: 11px 12px !important;
          gap: 10px !important;
          border-radius: 12px !important;
        }
        .s5-product-row {
          border-radius: 11px !important;
          margin-bottom: 6px !important;
        }
        .s5-cell {
          padding-inline: 5px !important;
        }
        .s5-cell-identity {
          flex-basis: 176px !important;
          min-width: 176px !important;
          padding: 9px 8px !important;
          gap: 6px !important;
        }
        .s5-cell-identity button.s5-product-name-edit {
          font-size: 9px !important;
          margin-top: 2px !important;
        }
        .s5-cell-identity div[style*="font-size:11px"] {
          font-size: var(--s5-sku-size) !important;
        }
        .s5-cell-orders { flex-basis: 60px !important; }
        .s5-cell-pieces { flex-basis: 70px !important; }
        .s5-cell-failed { flex-basis: 62px !important; }
        .s5-cell-canceled-raw { flex-basis: 64px !important; }
        .s5-cell-confirmation,
        .s5-cell-cancel,
        .s5-cell-delivery { flex-basis: 66px !important; }
        .s5-cell-ndr,
        .s5-cell-delivery-count { flex-basis: 64px !important; }
        .s5-cell-average-commission { flex-basis: 80px !important; }
        .s5-cell-ad-spend { flex-basis: 72px !important; }
        .s5-cell-cpa { flex-basis: 70px !important; }
        .s5-cell-breakeven { flex-basis: 76px !important; }
        .s5-cell-pnl { flex-basis: 74px !important; }
        .s5-cell-commission { flex-basis: 72px !important; }
        .s5-cell-actions {
          width: 108px !important;
          gap: 3px !important;
          padding-inline: 4px !important;
        }
        .s5-cell-actions button {
          width: 22px !important;
          height: 22px !important;
        }
        .s5-cell .s5-number-fit {
          font-size: var(--s5-row-num-size) !important;
        }
        .s5-cell-orders .s5-number-fit,
        .s5-cell-delivery-count .s5-number-fit,
        .s5-cell-commission .s5-number-fit {
          font-size: var(--s5-row-num-size-strong) !important;
        }
        .s5-header-cols > div:first-child {
          flex-basis: 176px !important;
          min-width: 176px !important;
          padding-right: 8px !important;
          font-size: 9px !important;
        }
        .s5-header-cols .s5-sort-col {
          font-size: 9px !important;
          gap: 3px !important;
        }
        .s5-header-cols .s5-sort-col[data-field="placedCount"] { flex-basis: 60px !important; }
        .s5-header-cols > div:nth-child(5) { flex-basis: 70px !important; }
        .s5-header-cols .s5-sort-col[data-field="failedCount"] { flex-basis: 62px !important; }
        .s5-header-cols .s5-sort-col[data-field="canceledCount"] { flex-basis: 64px !important; }
        .s5-header-cols .s5-sort-col[data-field="confirmationPct"],
        .s5-header-cols .s5-sort-col[data-field="cancelPct"],
        .s5-header-cols .s5-sort-col[data-field="drRate"] { flex-basis: 66px !important; }
        .s5-header-cols .s5-sort-col[data-field="ndrPct"],
        .s5-header-cols .s5-sort-col[data-field="deliveredCount"],
        .s5-header-cols .s5-sort-col[data-field="shippingCount"],
        .s5-header-cols .s5-sort-col[data-field="processingCount"] { flex-basis: 64px !important; }
        .s5-header-cols .s5-sort-col[data-field="averageCommission"] { flex-basis: 80px !important; }
        .s5-header-cols .s5-sort-col[data-field="allocatedAdSpend"] { flex-basis: 72px !important; }
        .s5-header-cols .s5-sort-col[data-field="cpa"] { flex-basis: 70px !important; }
        .s5-header-cols .s5-sort-col[data-field="breakEvenCpa"] { flex-basis: 76px !important; }
        .s5-header-cols .s5-sort-col[data-field="profitLoss"] { flex-basis: 74px !important; }
        .s5-header-cols .s5-sort-col[data-field="commission"] { flex-basis: 72px !important; }
        .s5-header-cols > div:last-child {
          width: 108px !important;
          flex: 0 0 108px !important;
          font-size: 9px !important;
        }
      }
      @media (max-width: 1180px) {
        .s5-topbar {
          gap: 10px !important;
        }
        .s5-status-chip {
          max-width: 150px;
        }
        .s5-status-chip span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .s5-stat-row {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .s5-stat-card {
          min-width: 0;
        }
        .s5-metrics-track {
          min-width: 1180px;
        }
      }
    </style>
    <div class="s5-root dash-scroll" dir="${isAr ? "rtl" : "ltr"}" style="flex:1 1 auto;display:flex;flex-direction:column;background:#080b12;color:#fff;font-family:'Cairo',sans-serif;overflow-y:auto;overflow-x:hidden;height:100%;min-height:0">

      <!-- Sticky topbar -->
      <div class="s5-topbar" style="display:flex;align-items:center;justify-content:space-between;padding:0 28px;height:68px;border-bottom:1px solid rgba(255,255,255,0.05);background:#080b12;position:sticky;top:0;z-index:10;flex-shrink:0">
        <div style="display:flex;gap:10px;align-items:center">
          <span class="s5-status-chip" aria-label="${s5Txt("Dashboard period", "ÙØªØ±Ø© Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…")}" style="display:flex;align-items:center;gap:8px;padding:7px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;font-family:inherit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="3" stroke="rgba(255,255,255,0.45)" stroke-width="1.5"/><path d="M8 2v4M16 2v4M3 10h18" stroke="rgba(255,255,255,0.45)" stroke-width="1.5" stroke-linecap="round"/></svg>
            <span style="color:#f59e0b">${(function () {
              var M = [
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
              ];
              var M_ar = [
                "Ã™Å Ã™â€ Ã˜Â§Ã™Å Ã˜Â±",
                "Ã™ÂÃ˜Â¨Ã˜Â±Ã˜Â§Ã™Å Ã˜Â±",
                "Ã™â€¦Ã˜Â§Ã˜Â±Ã˜Â³",
                "Ã˜Â£Ã˜Â¨Ã˜Â±Ã™Å Ã™â€ž",
                "Ã™â€¦Ã˜Â§Ã™Å Ã™Ë†",
                "Ã™Å Ã™Ë†Ã™â€ Ã™Å Ã™Ë†",
                "Ã™Å Ã™Ë†Ã™â€žÃ™Å Ã™Ë†",
                "Ã˜Â£Ã˜ÂºÃ˜Â³Ã˜Â·Ã˜Â³",
                "Ã˜Â³Ã˜Â¨Ã˜ÂªÃ™â€¦Ã˜Â¨Ã˜Â±",
                "Ã˜Â£Ã™Æ’Ã˜ÂªÃ™Ë†Ã˜Â¨Ã˜Â±",
                "Ã™â€ Ã™Ë†Ã™ÂÃ™â€¦Ã˜Â¨Ã˜Â±",
                "Ã˜Â¯Ã™Å Ã˜Â³Ã™â€¦Ã˜Â¨Ã˜Â±",
              ];
              var n = new Date();
              return (
                (isAr ? M_ar[n.getMonth()] : M[n.getMonth()]) +
                " " +
                n.getFullYear()
              );
            })()}</span>
          </span>
          <span class="s5-status-chip" aria-label="${s5Txt("Dashboard account", "Ø­Ø³Ø§Ø¨ Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…")}" style="display:flex;align-items:center;gap:8px;padding:7px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;font-family:inherit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="rgba(255,255,255,0.45)" stroke-width="1.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(255,255,255,0.45)" stroke-width="1.5" stroke-linecap="round"/></svg>
            <span>${window.currentActiveAccountLabel || s5Txt("All Shared Accounts", "Ã™Æ’Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â³Ã˜Â§Ã˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Æ’Ã˜Â©")}</span>
          </span>
        </div>
        <div style="text-align:center;flex:1">
          <div class="fade-up" style="font-size:22px;font-weight:900;color:#fff;display:flex;align-items:center;justify-content:center;gap:8px">
            ${s5Txt("Top Products", "Ã˜Â£Ã™ÂÃ˜Â¶Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Âª")}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.2L12 17l-6.2 3.9 2.4-7.2L2 9.2h7.6z" fill="#f59e0b"/></svg>
          </div>
          <div class="fade-up" style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:3px;animation-delay:100ms">${s5Txt("Product Health Board", "Ã™â€žÃ™Ë†Ã˜Â­Ã˜Â© Ã˜ÂµÃ˜Â­Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Âª")}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <button id="s5-view-toggle" style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:9px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.55);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 0.18s">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            ${s5Txt("Compact", "Ã™â€¦Ã˜Â¶Ã˜ÂºÃ™Ë†Ã˜Â·")}
          </button>
          <div style="font-size:11px;color:rgba(255,255,255,0.35)">${s5Txt("Last update: Today", "Ã˜Â¢Ã˜Â®Ã˜Â± Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â«: Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦")}</div>
          <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.7)">${(function () {
            var n = new Date();
            return (
              ("0" + n.getHours()).slice(-2) +
              ":" +
              ("0" + n.getMinutes()).slice(-2)
            );
          })()}</div>
        </div>
      </div>

      <!-- Non-scrolling block -->
      <div style="padding:22px 28px 0;flex-shrink:0">
        <div class="s5-stat-row" style="display:flex;gap:12px;margin-bottom:20px;align-items:stretch">
          ${STAT_CARDS.map((c, i) => statCardHTML(c, i)).join("")}
        </div>
        ${filterBarHTML(initialProductList)}
      </div>

      <!-- Scroll wrapper -->
      <div id="s5-scroll-wrapper" style="flex:0 0 auto;overflow-x:auto;overflow-y:visible;min-height:0;width:100%">
        <div style="padding:0 28px 22px">
          ${columnHeadersHTML()}
          <div id="s5-rows">
            ${initialPagedProducts
              .map((p, i) => productRowHTML(p, i, (currentPage - 1) * PAGE_SIZE + i + 1))
              .join("")}
          </div>
          <div id="s5-pagination-wrap">${paginationHTML(initialProductList)}</div>

          ${
            INSIGHTS.length
              ? `
          <div>
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:14px">
              <span style="font-size:15px;font-weight:800;color:rgba(255,255,255,0.82)">Ã˜Â±Ã˜Â¤Ã™â€° Ã˜Â°Ã™Æ’Ã™Å Ã˜Â©</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.2L12 17l-6.2 3.9 2.4-7.2L2 9.2h7.6z" fill="#f59e0b"/></svg>
            </div>
            <div class="s5-insights-row" style="display:flex;gap:12px;flex-wrap:wrap">
              ${INSIGHTS.map((ins, i) => insightCardHTML(ins, i)).join("")}
            </div>
          </div>`
              : ""
          }
        </div>
      </div>
    </div>`;

    // Ã¢â€â‚¬Ã¢â€â‚¬ Sort arrows sync Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function updateSortArrows() {
      mountEl.querySelectorAll(".s5-sort-arrow").forEach((arrow) => {
        if (arrow.dataset.field === sortState.field) {
          arrow.textContent = sortState.dir === "desc" ? "v" : "^";
          arrow.style.color = "#f59e0b";
        } else {
          arrow.textContent = "-";
          arrow.style.color = "rgba(255,255,255,0.2)";
        }
      });
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ FIX 3: renderProductPage re-renders filter bar + pills Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    let pageRenderToken = 0;

    function scheduleProductPageRender(options) {
      renderProductPage(options || { keepFilterBar: true });
    }

    function renderProductPage(options) {
      options = options || {};
      isFirstMount = false;
      const token = ++pageRenderToken;
      const list = options.list || currentList();

      // Re-render filter bar so pills and dropdown show correct active state
      const filterBarEl = mountEl.querySelector("#s5-filter-bar");
      if (filterBarEl && !options.keepFilterBar) {
        filterBarEl.outerHTML = filterBarHTML(list);
        bindFilterBar();
      }

      const rowsEl = mountEl.querySelector("#s5-rows");
      const pagerEl = mountEl.querySelector("#s5-pagination-wrap");
      if (
        !mountEl.isConnected ||
        mountEl._s5RenderToken !== renderToken ||
        token !== pageRenderToken
      )
        return;
      const visibleProducts = pagedProducts(list);
      if (rowsEl) {
        if (visibleProducts.length === 0) {
          rowsEl.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center;background:rgba(255,255,255,0.015);border:1px solid rgba(255,255,255,0.05);border-radius:14px;margin-bottom:12px;">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" style="margin-bottom:16px;">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <div style="font-size:16px;font-weight:800;color:rgba(255,255,255,0.6);margin-bottom:8px;">${s5Txt("No products match the filter", "Ã™â€žÃ˜Â§ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã˜Â¯ Ã™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Âª Ã˜ÂªÃ˜Â·Ã˜Â§Ã˜Â¨Ã™â€š Ã˜Â§Ã™â€žÃ™ÂÃ™â€žÃ˜ÂªÃ˜Â±")}</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.3);">Ã˜Â¬Ã˜Â±Ã˜Â¨ Ã˜ÂªÃ˜ÂºÃ™Å Ã™Å Ã˜Â± Ã˜Â®Ã™Å Ã˜Â§Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ˜ÂµÃ™ÂÃ™Å Ã˜Â© Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â­Ã˜Â« Ã™â€žÃ˜Â¹Ã˜Â±Ã˜Â¶ Ã˜Â§Ã™â€žÃ™â€ Ã˜ÂªÃ˜Â§Ã˜Â¦Ã˜Â¬.</div>
            </div>`;
        } else {
          rowsEl.innerHTML = visibleProducts
            .map((p, i) => productRowHTML(p, i, (currentPage - 1) * PAGE_SIZE + i + 1))
            .join("");
        }
      }
      if (pagerEl) {
        pagerEl.innerHTML = paginationHTML(list);
      }

      updateSortArrows();
      if (_s5SelectedProductKey) _selectS5Row(_s5SelectedProductKey);
    }

    function renderProductChromeAndPage() {
      const list = currentList();
      const filterBarEl = mountEl.querySelector("#s5-filter-bar");
      if (filterBarEl) {
        filterBarEl.outerHTML = filterBarHTML(list);
        bindFilterBar();
      }
      const headersWrap = mountEl.querySelector(".s5-header-cols");
      if (headersWrap) headersWrap.outerHTML = columnHeadersHTML();
      renderProductPage({ keepFilterBar: true, list: list });
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Rate bar: use CSS transition approach Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    // We store target width in data-target and animate via CSS transition
    // (already in rateBadgeHTML via inline transition style)
    // After DOM is inserted we flip widths from 0 Ã¢â€ â€™ target
    // Ã¢â€â‚¬Ã¢â€â‚¬ Search debounce Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    let searchDebounce = null;

    function syncSearchClearButton() {
      const clearBtn = mountEl.querySelector("#s5-search-clear");
      if (!clearBtn) return;
      const active = !!filterState.search;
      clearBtn.style.opacity = active ? "1" : "0";
      clearBtn.style.pointerEvents = active ? "auto" : "none";
    }

    function ensureSearchClearButton(searchEl) {
      if (!searchEl || mountEl.querySelector("#s5-search-clear")) return;
      const clearBtn = document.createElement("button");
      clearBtn.id = "s5-search-clear";
      clearBtn.type = "button";
      clearBtn.setAttribute(
        "aria-label",
        s5Txt("Clear search", "Ã™â€¦Ã˜Â³Ã˜Â­ Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â­Ã˜Â«"),
      );
      clearBtn.style.cssText = [
        "position:absolute",
        "left:12px",
        "top:50%",
        "transform:translateY(-50%)",
        "width:28px",
        "height:28px",
        "min-width:28px",
        "max-width:28px",
        "aspect-ratio:1/1",
        "border-radius:999px",
        "border:none",
        "cursor:pointer",
        "box-sizing:border-box",
        "background:rgba(255,255,255,0.12)",
        "color:rgba(255,255,255,0.6)",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "line-height:1",
        "padding:0",
        "font-family:inherit",
        "transition:background 0.15s, opacity 0.15s",
      ].join(";");
      clearBtn.innerHTML =
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"></path></svg>';
      searchEl.parentNode.appendChild(clearBtn);
    }

    function bindProductCurrencySelect() {
      var wrap = mountEl.querySelector("#s5-currency-select");
      if (!wrap) return;
      var options = supportedProductCurrencies().map(function (currency) {
        return { value: currency, label: currency };
      });
      var current = selectedCurrency();

      if (window.renderCustomSelect) {
        window.renderCustomSelect(wrap, options, current, function (value) {
          setProductCurrency(value);
        }, { maxHeight: "220px", ariaLabel: s5Txt("Products calculator currency", "Products calculator currency") });
        return;
      }

      wrap.innerHTML = '<select id="s5-currency-native" style="width:100%;height:32px;border-radius:9px;border:1px solid rgba(255,255,255,0.12);background:#0b1120;color:#fff;font-size:12px;font-weight:800;font-family:inherit;padding:0 8px">' +
        options.map(function (opt) {
          return '<option value="' + attr(opt.value) + '"' + (opt.value === current ? ' selected' : '') + '>' + esc(opt.label) + '</option>';
        }).join("") +
        "</select>";
      var nativeSelect = wrap.querySelector("#s5-currency-native");
      if (nativeSelect) {
        nativeSelect.addEventListener("change", function () {
          setProductCurrency(this.value);
        });
      }
    }

    function bindFilterBar() {
      if (_sortMenuCleanup) {
        _sortMenuCleanup();
        _sortMenuCleanup = null;
      }

      const searchEl = mountEl.querySelector("#s5-search");
      bindProductCurrencySelect();
      if (searchEl) ensureSearchClearButton(searchEl);
      syncSearchClearButton();

      // Ã¢â€â‚¬Ã¢â€â‚¬ Custom sort dropdown Ã¢â‚¬â€ body-teleported to escape overflow:hidden Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
      // Remove any stale body-menu from a previous render cycle
      const staleMenu = document.getElementById("s5-body-sort-menu");
      if (staleMenu) staleMenu.remove();

      const trigger = mountEl.querySelector("#s5-sort-trigger");

      // Build the floating menu and append to <body>
      const sortMenuHTML2 = SORT_OPTIONS.map((opt) => {
        const isActive = sortState.field === opt.value;
        return `<div class="s5-sort-option ${isActive ? "active" : ""}" data-value="${opt.value}"
        style="display:flex;align-items:center;gap:10px;padding:10px 14px;
               font-size:12px;font-weight:600;
               color:${isActive ? "#f59e0b" : "rgba(255,255,255,0.65)"};
               cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04);
               font-family:'Cairo',sans-serif;direction:${isAr ? "rtl" : "ltr"};
               background:${isActive ? "rgba(245,158,11,0.12)" : "transparent"};
               transition:background 0.15s,color 0.15s">
        <span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:#f59e0b;
                     opacity:${isActive ? 1 : 0};transition:opacity 0.15s"></span>
        <span style="font-size:14px;line-height:1">${opt.icon}</span>
        <span>${opt.label}</span>
        ${isActive ? `<svg style="margin-right:auto;flex-shrink:0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ""}
      </div>`;
      }).join("");

      const bodyMenu = document.createElement("div");
      bodyMenu.id = "s5-body-sort-menu";
      bodyMenu.innerHTML = `
      <div style="padding:10px 14px 8px;border-bottom:1px solid rgba(255,255,255,0.06);
                  font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);
                  text-transform:uppercase;letter-spacing:0.6px;direction:${isAr ? "rtl" : "ltr"}">${s5Txt("Sort By", "Ã˜ÂªÃ˜Â±Ã˜ÂªÃ™Å Ã˜Â¨ Ã˜Â­Ã˜Â³Ã˜Â¨")}</div>
      ${sortMenuHTML2}`;
      bodyMenu.style.cssText = `
      position:fixed;
      background:#0f1523;
      border:1px solid rgba(255,255,255,0.14);
      border-radius:12px;
      overflow:hidden;
      z-index:2147483647;
      box-shadow:0 8px 24px rgba(0,0,0,0.45);
      opacity:0;
      pointer-events:none;
      min-width:180px;
      direction:${isAr ? "rtl" : "ltr"};
    `;
      document.body.appendChild(bodyMenu);

      function positionMenu() {
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        bodyMenu.style.top = rect.bottom + 6 + "px";
        // Align right edge of menu to right edge of trigger
        const menuW = bodyMenu.offsetWidth || 180;
        bodyMenu.style.left = rect.right - menuW + "px";
      }

      function openMenu() {
        if (!trigger) return;
        positionMenu();
        bodyMenu.style.opacity = "1";
        bodyMenu.style.pointerEvents = "all";
        trigger.classList.add("open");
        _dropdownOpen = true;
      }
      function closeMenu() {
        bodyMenu.style.opacity = "0";
        bodyMenu.style.pointerEvents = "none";
        if (trigger) trigger.classList.remove("open");
        _dropdownOpen = false;
      }
      function toggleMenu() {
        if (_dropdownOpen) closeMenu();
        else openMenu();
      }

      mountEl._s5ToggleSortMenu = toggleMenu;
      mountEl._s5CloseSortMenu = closeMenu;

      // Outside-click closes menu; also clean up body menu when section unmounts
      function s5OutsideClick(e) {
        const dropdown = mountEl.querySelector("#s5-sort-dropdown");
        if (
          dropdown &&
          !dropdown.contains(e.target) &&
          !bodyMenu.contains(e.target)
        )
          closeMenu();
        if (!mountEl.isConnected) {
          if (_sortMenuCleanup) _sortMenuCleanup();
        }
      }
      document.addEventListener("click", s5OutsideClick);
      _sortMenuCleanup = function () {
        document.removeEventListener("click", s5OutsideClick);
        if (bodyMenu && bodyMenu.parentNode) bodyMenu.remove();
        if (trigger) trigger.classList.remove("open");
        _dropdownOpen = false;
      };

      bodyMenu.addEventListener("click", function (e) {
        const opt = e.target.closest(".s5-sort-option");
        if (!opt) return;
        e.stopPropagation();
        const val = opt.dataset.value;
        if (!val) return;
        sortState.field = val;
        sortState.dir = "desc";
        currentPage = 1;
        closeMenu();
        renderProductChromeAndPage();
      });
    }

    function setProductStatusFilter(key) {
      filterState.statusKey = key || "all";
      if (key === "shipping") {
        sortState.field = "shippingCount";
        sortState.dir = "desc";
      } else if (key === "processing") {
        sortState.field = "processingCount";
        sortState.dir = "desc";
      } else if (key === "failed") {
        sortState.field = "failedCount";
        sortState.dir = "desc";
      } else if (key === "canceled") {
        sortState.field = "canceledCount";
        sortState.dir = "desc";
      } else if (key === "delivered") {
        sortState.field = "deliveredCount";
        sortState.dir = "desc";
      } else {
        sortState.field = "default";
        sortState.dir = "asc";
      }
      currentPage = 1;
      renderProductChromeAndPage();
    }

    function toggleProductDetails(btn) {
      if (!btn) return;
      const row = btn.closest(".s5-product-row");
      const idx = btn.dataset.idx;
      const panel = document.getElementById(`s5-detail-${idx}`);
      if (!panel || !row) return;
      const isOpen = panel.style.display === "block";

      mountEl.querySelectorAll(".s5-detail-panel").forEach((p) => {
        p.style.display = "none";
        p.style.maxHeight = "0";
        p.style.opacity = "1";
        p.style.padding = "0 24px";
        p.style.marginBottom = "0";
        p.style.borderColor = "rgba(255,255,255,0)";
      });
      mountEl.querySelectorAll(".s5-expand-arrow").forEach((a) => {
        a.style.transform = "rotate(0deg)";
        a.setAttribute("stroke", "rgba(255,255,255,0.5)");
      });
      mountEl.querySelectorAll(".s5-expand-btn").forEach((b) => {
        b.style.background = "rgba(255,255,255,0.05)";
        b.style.borderColor = "rgba(255,255,255,0.12)";
      });

      if (isOpen) return;
      const product = PRODUCT_BY_KEY[row.dataset.productKey] || null;
      if (!product) return;
      panel.innerHTML = cachedDetailPanelContent(product);
      bindQuantityCityPagination(panel, product);
      panel.style.display = "block";
      panel.style.maxHeight = "none";
      panel.style.padding = "20px 24px";
      panel.style.marginBottom = "8px";
      panel.style.borderColor = "rgba(255,255,255,0.06)";

      const arrow = btn.querySelector(".s5-expand-arrow");
      if (arrow) {
        arrow.style.transform = "rotate(180deg)";
        arrow.setAttribute("stroke", "#f59e0b");
      }
      btn.style.background = "rgba(245,158,11,0.15)";
      btn.style.borderColor = "rgba(245,158,11,0.5)";
    }

    function handleProductRootClick(e) {
      const target = e.target;
      const sortTrigger = target.closest("#s5-sort-trigger");
      if (sortTrigger) {
        e.preventDefault();
        e.stopPropagation();
        if (mountEl._s5ToggleSortMenu) mountEl._s5ToggleSortMenu();
        return;
      }

      const clearSearch = target.closest("#s5-search-clear");
      if (clearSearch) {
        e.preventDefault();
        filterState.search = "";
        currentPage = 1;
        const searchInput = mountEl.querySelector("#s5-search");
        if (searchInput) {
          searchInput.value = "";
          searchInput.focus();
        }
        syncSearchClearButton();
        renderProductPage({ keepFilterBar: true });
        return;
      }

      const compareBtn = target.closest("#s5-compare-open,[data-compare-open]");
      if (compareBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (window.openProductCompareModal) {
          window.openProductCompareModal(compareBtn.dataset.productKey || "");
        }
        return;
      }

      const modalBtn = target.closest("[data-modal-open]");
      if (modalBtn) {
        e.preventDefault();
        e.stopPropagation();
        const row = modalBtn.closest(".s5-product-row");
        const productKey =
          modalBtn.dataset.productKey || (row && row.dataset.productKey) || "";
        if (window.openProductModal) window.openProductModal(productKey);
        return;
      }

      const mapBtn = target.closest(".s5-map-btn");
      if (mapBtn) {
        e.preventDefault();
        e.stopPropagation();
        var pk = mapBtn.dataset.productKey || mapBtn.getAttribute("data-product-key");
        if (window.DashboardFilterBus) {
          window.DashboardFilterBus.setState({
            selectedProduct: pk,
            mapMode: window.DashboardFilterBus.MODES
              ? window.DashboardFilterBus.MODES.PRODUCT
              : "product",
          });
        }
        if (ctx && typeof ctx.onNavigate === "function") {
          ctx.onNavigate("cities");
        } else {
          var navBtn = document.querySelector('[data-section="cities"], [data-id="cities"]');
          if (navBtn) navBtn.click();
        }
        return;
      }

      const expandBtn = target.closest(".s5-expand-btn");
      if (expandBtn) {
        e.preventDefault();
        e.stopPropagation();
        toggleProductDetails(expandBtn);
        return;
      }

      const pill = target.closest(".s5-pill");
      if (pill) {
        e.preventDefault();
        setProductStatusFilter(pill.dataset.key || "all");
        return;
      }

      const sortCol = target.closest(".s5-sort-col");
      if (sortCol) {
        e.preventDefault();
        const field = sortCol.dataset.field;
        if (sortState.field === field && field !== "default") {
          sortState.dir = sortState.dir === "desc" ? "asc" : "desc";
        } else {
          sortState.field = field;
          sortState.dir = "desc";
        }
        currentPage = 1;
        renderProductChromeAndPage();
        return;
      }

      const dirBtn = target.closest("#s5-sort-dir-btn");
      if (dirBtn) {
        e.preventDefault();
        sortState.dir = sortState.dir === "desc" ? "asc" : "desc";
        currentPage = 1;
        renderProductChromeAndPage();
        return;
      }

      const clearSortBtn = target.closest("#s5-clear-sort");
      if (clearSortBtn) {
        e.preventDefault();
        sortState.field = "default";
        sortState.dir = "asc";
        currentPage = 1;
        renderProductChromeAndPage();
        return;
      }

      const pageBtn = target.closest(".s5-page-btn");
      if (pageBtn) {
        e.preventDefault();
        const p = parseInt(pageBtn.dataset.page, 10);
        if (p && p !== currentPage) {
          currentPage = p;
          renderProductPage({ keepFilterBar: true });
          scrollToRows();
        }
        return;
      }

      if (target.closest("#s5-prev-page")) {
        e.preventDefault();
        if (currentPage > 1) {
          currentPage--;
          renderProductPage({ keepFilterBar: true });
          scrollToRows();
        }
        return;
      }

      if (target.closest("#s5-next-page")) {
        e.preventDefault();
        if (currentPage < totalProductPages()) {
          currentPage++;
          renderProductPage({ keepFilterBar: true });
          scrollToRows();
        }
        return;
      }

      const toggleBtn = target.closest("#s5-view-toggle");
      if (toggleBtn) {
        e.preventDefault();
        viewMode = viewMode === "expanded" ? "compact" : "expanded";
        toggleBtn.innerHTML =
          viewMode === "compact"
            ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Ã™â€¦Ã™Ë†Ã˜Â³Ã™â€˜Ã˜Â¹`
            : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Ã™â€¦Ã˜Â¶Ã˜ÂºÃ™Ë†Ã˜Â·`;
        const headerEl = mountEl.querySelector(".s5-header-cols");
        if (headerEl) headerEl.outerHTML = columnHeadersHTML();
        renderProductPage({ keepFilterBar: true });
        return;
      }

      const row = target.closest(".s5-product-row");
      if (row && !target.closest("button,input,select,textarea,a")) {
        var productKey = row.dataset.productKey;
        if (!productKey) return;
        if (_s5SelectedProductKey === productKey) {
          _clearS5Selection();
          if (window.DashboardFilterBus) {
            window.DashboardFilterBus.setState({
              selectedProduct: null,
              mapMode: "orders",
            });
          }
        } else {
          _selectS5Row(productKey);
          if (window.DashboardFilterBus) {
            window.DashboardFilterBus.setState({
              selectedProduct: productKey,
              mapMode: window.DashboardFilterBus.MODES
                ? window.DashboardFilterBus.MODES.PRODUCT
                : "product",
            });
          }
        }
      }
    }

    function handleProductRootInput(e) {
      const search = e.target.closest("#s5-search");
      if (!search) return;
      clearTimeout(searchDebounce);
      filterState.search = search.value.trim();
      currentPage = 1;
      syncSearchClearButton();
      renderProductPage({ keepFilterBar: true });
    }

    function handleProductRootChange(e) {
      const currencySelect = e.target.closest("#s5-currency-native");
      if (currencySelect) {
        setProductCurrency(currencySelect.value);
      }
    }

    mountEl.addEventListener("click", handleProductRootClick);
    mountEl.addEventListener("input", handleProductRootInput);
    mountEl.addEventListener("change", handleProductRootChange);
    addProductCleanup(function () {
      mountEl.removeEventListener("click", handleProductRootClick);
      mountEl.removeEventListener("input", handleProductRootInput);
      mountEl.removeEventListener("change", handleProductRootChange);
      if (_sortMenuCleanup) _sortMenuCleanup();
      clearTimeout(searchDebounce);
    });
    bindFilterBar();

    // Ã¢â€â‚¬Ã¢â€â‚¬ Column sort Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function bindSortCols() {
      updateSortArrows();
    }
    bindSortCols();

    // Ã¢â€â‚¬Ã¢â€â‚¬ Expand buttons Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function bindExpandButtons() {
      return;
    }
    bindExpandButtons();

    function bindQuantityCityPagination(panel, product) {
      if (!panel || !product || !window.bindDashboardPagination) return;
      const pager = panel.querySelector(".s5-quantity-cities");
      if (!pager) return;

      const productKey = String(
        product.key || product.sku || product.name || product.rank || "",
      );
      const totalCards = product.quantityCityBreakdown
        ? product.quantityCityBreakdown.length
        : 0;
      const totalPages = Math.max(
        1,
        Math.ceil(totalCards / QUANTITY_CITY_PAGE_SIZE),
      );

      function renderQuantityPage(page) {
        quantityCityPages[productKey] = Math.min(
          Math.max(Number(page) || 1, 1),
          totalPages,
        );
        refreshDetailPanelContent(panel, product);
      }

      window.bindDashboardPagination(pager, {
        pageButtonSelector: ".s5-quantity-page-btn",
        onPage: renderQuantityPage,
        onPrev: function () {
          renderQuantityPage((quantityCityPages[productKey] || 1) - 1);
        },
        onNext: function () {
          renderQuantityPage((quantityCityPages[productKey] || 1) + 1);
        },
      });
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ T-22: Product-row FilterBus wiring Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    var _s5SelectedProductKey = null;

    function _clearS5Selection() {
      mountEl.querySelectorAll(".s5-product-row").forEach(function (row) {
        if (row._origBorderColor !== undefined) {
          row.style.borderColor = row._origBorderColor;
        }
        if (row._origShadow !== undefined) {
          row.style.boxShadow = row._origShadow;
        }
      });
      _s5SelectedProductKey = null;
    }

    function _selectS5Row(productKey) {
      _clearS5Selection();
      _s5SelectedProductKey = productKey;
      mountEl.querySelectorAll(".s5-product-row").forEach(function (row) {
        if (row._origBorderColor === undefined)
          row._origBorderColor = row.style.borderColor;
        if (row._origShadow === undefined)
          row._origShadow = row.style.boxShadow;

        if (row.dataset.productKey === productKey) {
          row.style.borderColor = "rgba(20,184,166,0.55)";
          row.style.boxShadow =
            "0 0 0 2px rgba(20,184,166,0.22), inset 3px 0 0 #14b8a6";
        }
      });
    }

    function _bindProductRowClicks() {
      return;
    }
    _bindProductRowClicks();

    // Ã¢â€â‚¬Ã¢â€â‚¬ Pagination Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    function bindPagination() {
      return;
    }
    bindPagination();

    function bindPageNumbers() {
      return;
    }
    bindPageNumbers();

    function scrollToRows() {
      const root = mountEl.querySelector(".s5-root");
      const wrapper = mountEl.querySelector("#s5-scroll-wrapper");
      const targetTop = wrapper && root ? Math.max(0, wrapper.offsetTop - 78) : 0;
      if (root) root.scrollTop = targetTop;
      if (wrapper) wrapper.scrollLeft = 0;
    }

    function aiTextKey(value) {
      return String(value == null ? "" : value)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    }

    function findProductKeyForAi(query) {
      const needle = aiTextKey(query);
      if (!needle) return "";
      if (PRODUCT_BY_KEY[query]) return query;
      const exact = PRODUCTS_RAW.find(function (p) {
        return [p.key, p.sku, p.name, p.cat].some(function (value) {
          return aiTextKey(value) === needle;
        });
      });
      if (exact) return exact.key || exact.sku || exact.name || "";
      const partial = PRODUCTS_RAW.find(function (p) {
        return [p.key, p.sku, p.name, p.cat].some(function (value) {
          const haystack = aiTextKey(value);
          return (
            haystack &&
            (haystack.indexOf(needle) !== -1 || needle.indexOf(haystack) !== -1)
          );
        });
      });
      return partial ? partial.key || partial.sku || partial.name || "" : "";
    }

    function resetAiProductListCache() {
      listCache = null;
      listCacheKey = "";
      clearProductDetailCache();
      currentPage = 1;
    }

    function highlightAiProductRow(productKey) {
      const selector =
        '.s5-product-row[data-product-key="' +
        (window.CSS && CSS.escape
          ? CSS.escape(String(productKey))
          : String(productKey).replace(/"/g, '\\"')) +
        '"]';
      const row = mountEl.querySelector(selector);
      if (!row) return;
      row.scrollIntoView({ block: "center" });
    }

    function applyAiProductFilter(filter, options) {
      options = options || {};
      const key = aiTextKey(
        filter || options.filter || options.sort || options.query,
      );
      const productQuery =
        options.productKey || options.productId || options.productName || "";
      filterState.search = options.searchText || "";
      filterState.statusKey = "all";

      if (productQuery) {
        const productKey = findProductKeyForAi(productQuery);
        const product = productKey ? PRODUCT_BY_KEY[productKey] : null;
        filterState.search = product
          ? product.name || product.sku || product.key
          : productQuery;
      } else if (key === "failed" || key === "failed_products") {
        filterState.statusKey = "failed";
        sortState = { field: "failedCount", dir: "desc" };
      } else if (
        key === "canceled" ||
        key === "cancelled" ||
        key === "canceled_products"
      ) {
        filterState.statusKey = "canceled";
        sortState = { field: "canceledCount", dir: "desc" };
      } else if (key === "delivered") {
        filterState.statusKey = "delivered";
        sortState = { field: "deliveredCount", dir: "desc" };
      } else if (key === "ranked" || key === "rank") {
        sortState = { field: "default", dir: "asc" };
      } else if (
        key === "loss" ||
        key === "losing" ||
        key === "pnl" ||
        key === "profit_loss"
      ) {
        sortState = { field: "profitLoss", dir: "asc" };
      } else if (key === "cpa") {
        sortState = { field: "cpa", dir: "desc" };
      } else if (
        key === "scale" ||
        key === "scale_candidates" ||
        key === "best_scale"
      ) {
        sortState = { field: "scalingScore", dir: "desc" };
      } else if (
        key === "best" ||
        key === "best_products" ||
        key === "best_ndr"
      ) {
        sortState = { field: "drRate", dir: "desc" };
      } else if (key === "commission" || key === "top_commission") {
        sortState = { field: "commission", dir: "desc" };
      } else if (
        key === "worst" ||
        key === "worst_ndr" ||
        key === "dangerous" ||
        key === "risk" ||
        key === "risky_products"
      ) {
        sortState = { field: "ndrPct", dir: "asc" };
      } else if (key) {
        filterState.search = filter || options.query || "";
      }

      resetAiProductListCache();
      renderProductPage();
      scrollToRows();
      return currentList().length;
    }

    function openAiProduct(query, options) {
      options = options || {};
      const productKey = findProductKeyForAi(query);
      if (!productKey) return false;
      const product = PRODUCT_BY_KEY[productKey];
      if (options.search)
        filterState.search = product
          ? product.name || product.sku || product.key
          : "";
      filterState.statusKey = "all";
      resetAiProductListCache();
      const list = currentList();
      const idx = list.findIndex(function (p) {
        return (p.key || p.sku || p.name) === productKey;
      });
      if (idx >= 0) currentPage = Math.floor(idx / PAGE_SIZE) + 1;
      renderProductPage();
      highlightAiProductRow(productKey);
      if (window.DashboardFilterBus) {
        window.DashboardFilterBus.setState({
          selectedProduct: productKey,
          mapMode: window.DashboardFilterBus.MODES.PRODUCT,
        });
      }
      if (typeof window.openProductModal === "function")
        window.openProductModal(productKey);
      return true;
    }

    function onAiProductFilter(event) {
      const detail = (event && event.detail) || {};
      if (detail.productKey || detail.productId || detail.productName) {
        openAiProduct(
          detail.productKey || detail.productId || detail.productName,
          { search: true },
        );
        return;
      }
      applyAiProductFilter(
        detail.filter || detail.sort || detail.query || "",
        detail,
      );
    }

    window.addEventListener("dashboard-ai-filter-products", onAiProductFilter);
    window.DashboardProductsActions = {
      findProductKey: findProductKeyForAi,
      applyAiFilter: applyAiProductFilter,
      openProduct: openAiProduct,
    };
    addProductCleanup(function () {
      window.removeEventListener(
        "dashboard-ai-filter-products",
        onAiProductFilter,
      );
      if (
        window.DashboardProductsActions &&
        window.DashboardProductsActions.openProduct === openAiProduct
      ) {
        delete window.DashboardProductsActions;
      }
    });

    // Ã¢â€â‚¬Ã¢â€â‚¬ Phase 5: Full Product Modal Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    (function buildProductCompareModal() {
      var COMPARE_ID = "s5-compare-modal";
      var existingCompare = document.getElementById(COMPARE_ID);
      if (existingCompare) existingCompare.remove();

      var compareState = { leftKey: "", rightKey: "" };
      var compareModal = document.createElement("div");
      compareModal.id = COMPARE_ID;
      compareModal.className = "dash-overlay-scope";
      compareModal.style.cssText = [
        "position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;",
        "padding:18px;background:rgba(0,0,0,0.72);",
        "font-family:Cairo,sans-serif;direction:" +
          (isAr ? "rtl" : "ltr") +
          ";box-sizing:border-box;",
      ].join("");
      document.body.appendChild(compareModal);

      function cmpNum(n, decimals) {
        return (Number(n) || 0).toLocaleString(
          isAr ? "ar-EG-u-nu-latn" : "en-US",
          {
            minimumFractionDigits: decimals || 0,
            maximumFractionDigits: decimals || 0,
          },
        );
      }
      function cmpPct(n) {
        return cmpNum(n, 1) + "%";
      }
      function cmpMoney(n) {
        return productMoney(Number(n) || 0);
      }
      function topCity(p) {
        var rows =
          p && p.cityBreakdown && p.cityBreakdown.length
            ? p.cityBreakdown.slice()
            : [];
        rows.sort(function (a, b) {
          return (Number(b.count) || 0) - (Number(a.count) || 0);
        });
        return rows[0] && rows[0].name
          ? rows[0].name
          : s5Txt(
              "No data",
              "\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a",
            );
      }
      function headroom(p) {
        return (Number(p && p.breakEvenCpa) || 0) - (Number(p && p.cpa) || 0);
      }
      function logisticsScore(p) {
        return (
          (Number(p && (p.drRate || p.deliveryPct)) || 0) -
          (Number(p && p.cancelPct) || 0) * 0.55 -
          (Number(p && p.ndrPct) || 0) * 0.45
        );
      }
      function compareWinner(a, b, metric) {
        if (!a || !b || !metric || metric.compare === "none") return "";
        var av = Number(metric.get(a)) || 0;
        var bv = Number(metric.get(b)) || 0;
        if (Math.abs(av - bv) < 0.0001) return "";
        if (metric.compare === "low") return av < bv ? "left" : "right";
        return av > bv ? "left" : "right";
      }
      function verdict(a, b) {
        if (!a && !b) {
          return {
            color: "#f59e0b",
            title: s5Txt(
              "Select two products to compare",
              "\u0627\u062e\u062a\u0631 \u0645\u0646\u062a\u062c\u064a\u0646 \u0644\u0644\u0645\u0642\u0627\u0631\u0646\u0629",
            ),
            text: s5Txt(
              "The verdict will weigh profitability, delivery quality, and bid headroom once both sides are selected.",
              "\u0633\u064a\u0638\u0647\u0631 \u0627\u0644\u062d\u0643\u0645 \u0628\u0639\u062f \u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u0645\u0646\u062a\u062c\u064a\u0646.",
            ),
          };
        }
        if (!a || !b) {
          var one = a || b;
          return {
            color: "#f59e0b",
            title: s5Txt(
              "One product selected",
              "\u062a\u0645 \u0627\u062e\u062a\u064a\u0627\u0631 \u0645\u0646\u062a\u062c \u0648\u0627\u062d\u062f",
            ),
            text:
              esc(one.name || "") +
              " " +
              s5Txt(
                "is ready. Select the second side to unlock the final verdict.",
                "\u062c\u0627\u0647\u0632. \u0627\u062e\u062a\u0631 \u0627\u0644\u0637\u0631\u0641 \u0627\u0644\u062b\u0627\u0646\u064a \u0644\u0625\u0638\u0647\u0627\u0631 \u0627\u0644\u062d\u0643\u0645.",
              ),
          };
        }
        var summary = comparisonSummary(a, b);
        if (!summary.winner) {
          return {
            color: "#f59e0b",
            title: s5Txt(
              "Too close to call",
              "\u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0645\u062a\u0642\u0627\u0631\u0628\u0629",
            ),
            text: s5Txt(
              "Both products are tied across the key comparison metrics. Check the highlighted green and amber cards before scaling either one.",
              "\u0627\u0644\u0645\u0646\u062a\u062c\u0627\u0646 \u0645\u062a\u0639\u0627\u062f\u0644\u0627\u0646 \u0639\u0628\u0631 \u0623\u0647\u0645 \u0645\u0624\u0634\u0631\u0627\u062a \u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629.",
            ),
          };
        }
        var winnerProduct = summary.winner === "left" ? a : b;
        var loserProduct = summary.winner === "left" ? b : a;
        var winnerLabel =
          summary.winner === "left"
            ? s5Txt("Product A", "\u0627\u0644\u0645\u0646\u062a\u062c A")
            : s5Txt("Product B", "\u0627\u0644\u0645\u0646\u062a\u062c B");
        return {
          color: "#00e676",
          title:
            winnerLabel +
            " " +
            s5Txt(
              "is better",
              "\u0647\u0648 \u0627\u0644\u0623\u0641\u0636\u0644",
            ),
          text:
            esc(winnerProduct.name) +
            " " +
            s5Txt(
              "beats",
              "\u064a\u062a\u0641\u0648\u0642 \u0639\u0644\u0649",
            ) +
            " " +
            esc(loserProduct.name) +
            " " +
            s5Txt("by winning", "\u0641\u064a") +
            " " +
            cmpNum(summary.wins) +
            " / " +
            cmpNum(summary.total) +
            " " +
            s5Txt(
              "metric checks. Strongest edges:",
              "\u0645\u0646 \u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062a. \u0623\u0642\u0648\u0649 \u0627\u0644\u0646\u0642\u0627\u0637:",
            ) +
            " " +
            summary.reasons.map(esc).join(" | ") +
            ".",
        };
      }
      function productOptions() {
        return PRODUCTS_RAW.map(function (p, idx) {
          var key = p.key || p.sku || p.name || String(idx);
          var label =
            (p.name ||
              s5Txt(
                "Unnamed product",
                "\u0645\u0646\u062a\u062c \u0628\u062f\u0648\u0646 \u0627\u0633\u0645",
              )) + (p.sku ? " - " + p.sku : "");
          return (
            '<option value="' +
            attr(label) +
            '" data-key="' +
            attr(key) +
            '"></option>'
          );
        }).join("");
      }
      function findProductFromInput(value) {
        var raw = String(value || "").trim();
        if (!raw) return "";
        var needle = textKey(raw);
        var found =
          PRODUCTS_RAW.find(function (p) {
            var key = String(p.key || p.sku || p.name || "");
            var label = (p.name || "") + " " + (p.sku || "");
            return (
              key === raw ||
              textKey(label) === needle ||
              textKey(p.name) === needle ||
              textKey(p.sku) === needle
            );
          }) ||
          PRODUCTS_RAW.find(function (p) {
            return (
              textKey((p.name || "") + " " + (p.sku || "")).indexOf(needle) !==
              -1
            );
          });
        return found ? String(found.key || found.sku || found.name || "") : "";
      }
      var metrics = [
        {
          group: s5Txt("Volume", "\u0627\u0644\u062d\u062c\u0645"),
          label: s5Txt("Placed", "\u0627\u0644\u0637\u0644\u0628\u0627\u062a"),
          fmt: function (p) {
            return cmpNum(p.placedCount);
          },
          get: function (p) {
            return p.placedCount;
          },
          compare: "high",
        },
        {
          group: s5Txt("Volume", "\u0627\u0644\u062d\u062c\u0645"),
          label: s5Txt("Delivered", "\u0627\u0644\u0645\u0633\u0644\u0645"),
          fmt: function (p) {
            return cmpNum(p.deliveredCount);
          },
          get: function (p) {
            return p.deliveredCount;
          },
          compare: "high",
        },
        {
          group: s5Txt("Volume", "\u0627\u0644\u062d\u062c\u0645"),
          label: s5Txt("Pieces", "\u0627\u0644\u0642\u0637\u0639"),
          fmt: function (p) {
            return cmpNum(p.totalPieces);
          },
          get: function (p) {
            return p.totalPieces;
          },
          compare: "high",
        },
        {
          group: s5Txt("Rates", "\u0627\u0644\u0646\u0633\u0628"),
          label: s5Txt(
            "Confirmation",
            "\u0627\u0644\u062a\u0623\u0643\u064a\u062f",
          ),
          fmt: function (p) {
            return cmpPct(p.confirmationPct);
          },
          get: function (p) {
            return p.confirmationPct;
          },
          compare: "high",
          pct: true,
        },
        {
          group: s5Txt("Rates", "\u0627\u0644\u0646\u0633\u0628"),
          label: "DR",
          fmt: function (p) {
            return cmpPct(p.drRate || p.deliveryPct);
          },
          get: function (p) {
            return p.drRate || p.deliveryPct;
          },
          compare: "high",
          pct: true,
        },
        {
          group: s5Txt("Rates", "\u0627\u0644\u0646\u0633\u0628"),
          label: s5Txt("Cancel", "\u0627\u0644\u0625\u0644\u063a\u0627\u0621"),
          fmt: function (p) {
            return cmpPct(p.cancelPct);
          },
          get: function (p) {
            return p.cancelPct;
          },
          compare: "low",
          pct: true,
        },
        {
          group: s5Txt("Rates", "\u0627\u0644\u0646\u0633\u0628"),
          label: "NDR",
          fmt: function (p) {
            return cmpPct(p.ndrPct);
          },
          get: function (p) {
            return p.ndrPct;
          },
          compare: "high",
          pct: true,
        },
        {
          group: s5Txt(
            "Financials",
            "\u0627\u0644\u0645\u0627\u0644\u064a\u0627\u062a",
          ),
          label: p5Txt("adSpend"),
          fmt: function (p) {
            return cmpMoney(p.allocatedAdSpend);
          },
          get: function (p) {
            return p.allocatedAdSpend;
          },
          compare: "low",
        },
        {
          group: s5Txt(
            "Financials",
            "\u0627\u0644\u0645\u0627\u0644\u064a\u0627\u062a",
          ),
          label: s5Txt(
            "Commission",
            "\u0627\u0644\u0639\u0645\u0648\u0644\u0629",
          ),
          fmt: function (p) {
            return cmpMoney(commissionInCurrency(p.commission));
          },
          get: function (p) {
            return commissionInCurrency(p.commission);
          },
          compare: "high",
        },
        {
          group: s5Txt(
            "Financials",
            "\u0627\u0644\u0645\u0627\u0644\u064a\u0627\u062a",
          ),
          label: p5Txt("pnl"),
          fmt: function (p) {
            return cmpMoney(p.profitLoss);
          },
          get: function (p) {
            return p.profitLoss;
          },
          compare: "high",
        },
        {
          group: s5Txt(
            "Financials",
            "\u0627\u0644\u0645\u0627\u0644\u064a\u0627\u062a",
          ),
          label: "CPA",
          fmt: function (p) {
            return cmpMoney(p.cpa);
          },
          get: function (p) {
            return p.cpa;
          },
          compare: "low",
        },
        {
          group: s5Txt(
            "Financials",
            "\u0627\u0644\u0645\u0627\u0644\u064a\u0627\u062a",
          ),
          label: s5Txt(
            "CPA vs Break-even",
            "CPA \u0645\u0642\u0627\u0628\u0644 \u0627\u0644\u062a\u0639\u0627\u062f\u0644",
          ),
          fmt: function (p) {
            return cmpMoney(p.cpa) + " / " + cmpMoney(p.breakEvenCpa);
          },
          get: function (p) {
            return headroom(p);
          },
          compare: "high",
        },
        {
          group: s5Txt(
            "Geography",
            "\u0627\u0644\u0645\u0646\u0627\u0637\u0642",
          ),
          label: s5Txt(
            "Top city",
            "\u0623\u0641\u0636\u0644 \u0645\u062f\u064a\u0646\u0629",
          ),
          fmt: function (p) {
            return esc(topCity(p));
          },
          get: function () {
            return 0;
          },
          compare: "none",
        },
      ];
      function metricWeight(metric) {
        var group = String(metric.group || "").toLowerCase();
        var label = String(metric.label || "").toLowerCase();
        if (label.indexOf("p&l") !== -1 || label === "pnl") return 2.2;
        if (label === "cpa" || label.indexOf("break") !== -1) return 2;
        if (label === "ndr" || label === "dr" || label.indexOf("cancel") !== -1)
          return 1.7;
        if (group.indexOf("financial") !== -1) return 1.8;
        if (group.indexOf("rate") !== -1) return 1.5;
        return 1;
      }
      function comparisonSummary(a, b) {
        var leftScore = 0;
        var rightScore = 0;
        var leftWins = [];
        var rightWins = [];
        var total = 0;
        metrics.forEach(function (metric) {
          if (!metric || metric.compare === "none") return;
          total += 1;
          var winner = compareWinner(a, b, metric);
          if (!winner) return;
          var weight = metricWeight(metric);
          if (winner === "left") {
            leftScore += weight;
            leftWins.push(metric.label);
          } else {
            rightScore += weight;
            rightWins.push(metric.label);
          }
        });
        var scoreGap = Math.abs(leftScore - rightScore);
        var winner = scoreGap < 0.35 ? "" : leftScore > rightScore ? "left" : "right";
        var wins = winner === "left" ? leftWins.length : winner === "right" ? rightWins.length : 0;
        var reasons = (winner === "left" ? leftWins : rightWins).slice(0, 4);
        return {
          winner: winner,
          wins: wins,
          total: total,
          reasons: reasons.length ? reasons : [s5Txt("balanced metrics", "\u0645\u0624\u0634\u0631\u0627\u062a \u0645\u062a\u0648\u0627\u0632\u0646\u0629")],
        };
      }
      function selectorHTML(side, p) {
        var sideColor = side === "left" ? "#f59e0b" : "#14b8a6";
        var label =
          side === "left"
            ? s5Txt("Product A", "\u0627\u0644\u0645\u0646\u062a\u062c A")
            : s5Txt("Product B", "\u0627\u0644\u0645\u0646\u062a\u062c B");
        var displayName = p
          ? esc(
              p.name ||
                s5Txt("Unnamed", "\u0628\u062f\u0648\u0646 \u0627\u0633\u0645"),
            )
          : "";
        var displaySku = p ? esc(p.sku || "") : "";
        var placeholder = s5Txt(
          "Search products\u2026",
          "\u0627\u0628\u062d\u062b \u0639\u0646 \u0645\u0646\u062a\u062c\u2026",
        );
        var triggerInner = p
          ? '<span style="display:flex;flex-direction:column;align-items:flex-start;min-width:0;flex:1;gap:1px">' +
            '<span style="font-size:12px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">' +
            displayName +
            "</span>" +
            (displaySku
              ? '<span style="font-size:10px;color:rgba(255,255,255,0.42);font-weight:700">SKU: ' +
                displaySku +
                "</span>"
              : "") +
            "</span>"
          : '<span style="font-size:12px;color:rgba(255,255,255,0.35);font-weight:700;flex:1">' +
            placeholder +
            "</span>";
        return (
          '<div class="s5-cmp-dd-wrap" data-side="' +
          side +
          '" style="margin-bottom:14px;position:relative">' +
          '<div style="font-size:10px;font-weight:900;color:rgba(255,255,255,0.38);margin-bottom:7px;text-transform:uppercase;letter-spacing:.4px">' +
          label +
          "</div>" +
          '<button type="button" class="s5-cmp-dd-trigger" data-side="' +
          side +
          '" style="' +
          "width:100%;min-height:44px;border-radius:11px;" +
          "border:1px solid " +
          (p ? sideColor + "55" : "rgba(255,255,255,0.12)") +
          ";" +
          "background:" +
          (p ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.035)") +
          ";" +
          "color:#fff;padding:0 12px;font-size:12px;font-weight:700;font-family:inherit;" +
          "cursor:pointer;display:flex;align-items:center;gap:10px;text-align:start;" +
          "box-sizing:border-box;outline:none;" +
          '">' +
          (p
            ? '<span style="width:28px;height:28px;border-radius:8px;flex-shrink:0;background:' +
              sideColor +
              "22;border:1px solid " +
              sideColor +
              "55;color:" +
              sideColor +
              ';display:flex;align-items:center;justify-content:center">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' +
              "</span>"
            : '<span style="width:28px;height:28px;border-radius:8px;flex-shrink:0;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
              "</span>") +
          triggerInner +
          '<svg class="s5-cmp-dd-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:rgba(255,255,255,0.35)"><polyline points="6 9 12 15 18 9"/></svg>' +
          "</button>" +
          '<div class="s5-cmp-dd-panel" data-side="' +
          side +
          '" style="' +
          "display:none;position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:99999;" +
          "background:#0d1526;border:1px solid rgba(255,255,255,0.13);border-radius:14px;" +
          "box-shadow:0 20px 60px rgba(0,0,0,0.75);overflow:hidden;" +
          "flex-direction:column;" +
          '">' +
          '<div style="padding:10px 10px 8px;border-bottom:1px solid rgba(255,255,255,0.07)">' +
          '<div style="position:relative">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;' +
          (isAr ? "right:10px" : "left:10px") +
          ';top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.35);pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
          '<input type="text" class="s5-cmp-dd-search" placeholder="' +
          attr(placeholder) +
          '" style="' +
          "width:100%;height:36px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);" +
          "background:rgba(255,255,255,0.06);color:#fff;" +
          "padding:0 " +
          (isAr ? "10px" : "32px") +
          " 0 " +
          (isAr ? "32px" : "10px") +
          ";" +
          "font-size:12px;font-weight:700;font-family:inherit;outline:none;box-sizing:border-box;" +
          "direction:" +
          (isAr ? "rtl" : "ltr") +
          ";" +
          '">' +
          "</div>" +
          "</div>" +
          '<div class="s5-cmp-dd-list" style="max-height:220px;overflow-y:auto;padding:6px">' +
          PRODUCTS_RAW.map(function (pr, idx) {
            var key = pr.key || pr.sku || pr.name || String(idx);
            var name =
              pr.name ||
              s5Txt("Unnamed", "\u0628\u062f\u0648\u0646 \u0627\u0633\u0645");
            var sku = pr.sku || "";
            var searchStr = (name + " " + sku).toLowerCase();
            var isSelected =
              p && (p.key === key || p.sku === key || p.name === key);
            return (
              '<div class="s5-cmp-dd-option' +
              (isSelected ? " selected" : "") +
              '" data-key="' +
              attr(key) +
              '" data-search="' +
              attr(searchStr) +
              '" style="' +
              "display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;cursor:pointer;" +
              "background:" +
              (isSelected ? sideColor + "18" : "transparent") +
              ";" +
              "border:1px solid " +
              (isSelected ? sideColor + "44" : "transparent") +
              ";" +
              "margin-bottom:3px;" +
              '">' +
              '<span style="min-width:0;flex:1">' +
              '<span style="display:block;font-size:12px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
              esc(name) +
              "</span>" +
              (sku
                ? '<span style="display:block;font-size:10px;color:rgba(255,255,255,0.38);font-weight:700;margin-top:1px">SKU: ' +
                  esc(sku) +
                  "</span>"
                : "") +
              "</span>" +
              (isSelected
                ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="' +
                  sideColor +
                  '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M20 6L9 17l-5-5"/></svg>'
                : "") +
              "</div>"
            );
          }).join("") +
          "</div>" +
          "</div>" +
          "</div>"
        );
      }
      function getMetricColor(metric, val) {
        var v = Number(val) || 0;
        if (metric.compare === "none") return "rgba(255,255,255,0.55)";
        // Cancel rate: lower is better â†’ color by threshold
        if (
          metric.label &&
          metric.label.toLowerCase().indexOf("cancel") !== -1
        ) {
          return v >= 40 ? "#ef4444" : v >= 25 ? "#f59e0b" : "#00e676";
        }
        // NDR: lower is better â†’ color by threshold
        if (metric.label === "NDR") {
          return v < 20 ? "#ef4444" : v < 30 ? "#f59e0b" : "#00e676";
        }
        // DR / Confirmation / Delivery: higher is better
        if (metric.compare === "high") return "#00e676";
        // lower is better (CPA, ad spend etc)
        if (metric.compare === "low") return "#00e676";
        return "#00e676";
      }
      function isDangerValue(metric, val) {
        var v = Number(val) || 0;
        if (
          metric.label &&
          metric.label.toLowerCase().indexOf("cancel") !== -1 &&
          v >= 40
        )
          return true;
        if (metric.label === "NDR" && v < 20 && v > 0) return true;
        if (
          (metric.label === "P&L" ||
            (metric.label &&
              metric.label.toLowerCase().indexOf("p&l") !== -1) ||
            metric.label === "pnl") &&
          v < 0
        )
          return true;
        return false;
      }
      function dangerBadge(metric, p) {
        var val = Number(metric.get(p)) || 0;
        if (!isDangerValue(metric, val)) return "";
        return '<span style="display:inline-flex;align-items:center;gap:3px;font-size:9px;font-weight:900;color:#ef4444;background:rgba(239,68,68,0.14);border:1px solid rgba(239,68,68,0.35);border-radius:5px;padding:1px 5px;margin-left:4px;vertical-align:middle;flex-shrink:0">âš </span>';
      }
      function winnerCrown() {
        return '<svg width="11" height="11" viewBox="0 0 24 24" fill="#fbbf24" stroke="none" style="flex-shrink:0;margin-left:3px;vertical-align:middle"><path d="M2 19h20v2H2zM2 8l5 6 5-8 5 8 5-6v9H2z"/></svg>';
      }
      function metricHTML(side, p, other, metric, idx) {
        if (!p) return "";
        var win = compareWinner(p, other, metric);
        var isWinner = win === "left";
        var isLoser = win === "right";
        var val = Number(metric.get(p)) || 0;
        var maxVal = Math.max(
          Math.abs(Number(metric.get(p)) || 0),
          Math.abs(Number(other && metric.get(other)) || 0),
          metric.pct ? 100 : 1,
        );
        var winColor = getMetricColor(metric, val);
        var danger = isDangerValue(metric, val);
        var cls = danger
          ? " is-danger"
          : isWinner
            ? " is-winner"
            : isLoser
              ? " is-loser"
              : "";
        var cssVar = isWinner && !danger ? ";--cmp-win-color:" + winColor : "";
        // Bar
        var barColor = danger
          ? "#ef4444"
          : isWinner
            ? winColor
            : isLoser
              ? "rgba(245,158,11,0.4)"
              : winColor;
        var barWidth =
          metric.compare === "none"
            ? 0
            : Math.min(
                100,
                maxVal > 0 ? Math.round((Math.abs(val) / maxVal) * 100) : 0,
              );
        var bar =
          metric.compare === "none"
            ? ""
            : '<div style="height:5px;background:rgba(255,255,255,0.07);border-radius:99px;overflow:hidden;margin-top:7px">' +
              '<div style="height:100%;width:' +
              barWidth +
              "%;background:" +
              barColor +
              ';border-radius:99px"></div>' +
              "</div>";
        var badge = dangerBadge(metric, p);
        var crown =
          isWinner && !danger && metric.compare !== "none" ? winnerCrown() : "";
        return (
          '<div class="s5-compare-metric' +
          cls +
          '" style="padding:9px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.065);background:rgba(255,255,255,0.025);animation-delay:' +
          idx * 14 +
          "ms" +
          cssVar +
          '">' +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">' +
          '<div style="font-size:9px;color:rgba(255,255,255,0.38);font-weight:800;line-height:1.3;text-transform:uppercase;letter-spacing:.3px;flex-shrink:0">' +
          metric.label +
          badge +
          "</div>" +
          '<div style="display:flex;align-items:center;gap:2px">' +
          '<div style="font-size:14px;color:' +
          (danger
            ? "#ef4444"
            : isLoser && metric.compare !== "none"
              ? "#f59e0b"
              : isWinner && metric.compare !== "none"
                ? winColor
                : "#fff") +
          ';font-weight:900;text-align:right;line-height:1.2;overflow-wrap:anywhere">' +
          metric.fmt(p) +
          "</div>" +
          crown +
          "</div>" +
          "</div>" +
          bar +
          "</div>"
        );
      }
      function columnHTML(side, p, other) {
        var sideColor = side === "left" ? "#f59e0b" : "#14b8a6";
        if (!p)
          return (
            '<div class="s5-compare-column" style="border:1px dashed rgba(255,255,255,0.12);border-radius:18px;background:rgba(255,255,255,0.025);padding:16px">' +
            selectorHTML(side, null) +
            '<div style="height:340px;display:flex;align-items:center;justify-content:center;text-align:center;color:rgba(255,255,255,0.32);font-size:13px;font-weight:800">' +
            s5Txt(
              "Choose a product to load metrics",
              "\u0627\u062e\u062a\u0631 \u0645\u0646\u062a\u062c\u0627 \u0644\u0639\u0631\u0636 \u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062a",
            ) +
            "</div>" +
            "</div>"
          );

        // Group metrics into sections
        var groups = {};
        var groupOrder = [];
        metrics.forEach(function (m, idx) {
          if (!groups[m.group]) {
            groups[m.group] = [];
            groupOrder.push(m.group);
          }
          groups[m.group].push({ m: m, idx: idx });
        });

        var sectionsHTML = groupOrder
          .map(function (groupName) {
            var items = groups[groupName];
            // Identity group: show as single-col list (name/sku/rank are wide)
            var isIdentity =
              groupName ===
              s5Txt("Identity", "\u0627\u0644\u0647\u0648\u064a\u0629");
            var isGeography =
              groupName ===
              s5Txt("Geography", "\u0627\u0644\u0645\u0646\u0627\u0637\u0642");
            var singleCol = isIdentity || isGeography || items.length === 1;
            var cards = items
              .map(function (obj) {
                return metricHTML(side, p, other, obj.m, obj.idx);
              })
              .join("");
            return (
              '<div class="s5-compare-section-header">' +
              '<div style="width:3px;height:12px;border-radius:99px;background:' +
              sideColor +
              ';flex-shrink:0"></div>' +
              '<div style="font-size:9px;font-weight:900;color:' +
              sideColor +
              ';text-transform:uppercase;letter-spacing:.6px">' +
              groupName +
              "</div>" +
              "</div>" +
              '<div class="s5-cmp-cards-grid' +
              (singleCol ? " cols-1" : "") +
              '">' +
              cards +
              "</div>"
            );
          })
          .join("");

        return (
          '<div class="s5-compare-column" style="border:1px solid rgba(255,255,255,0.095);border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018));padding:16px">' +
          selectorHTML(side, p) +
          '<div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:rgba(0,0,0,0.18);border:1px solid rgba(255,255,255,0.06);margin-bottom:4px">' +
          '<div style="width:36px;height:36px;border-radius:10px;flex-shrink:0;background:' +
          sideColor +
          "22;border:1px solid " +
          sideColor +
          "55;color:" +
          sideColor +
          ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900">#' +
          cmpNum(p.rank) +
          "</div>" +
          '<div style="min-width:0">' +
          '<div style="font-size:13px;font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
          esc(p.name) +
          "</div>" +
          '<div style="font-size:10px;color:rgba(255,255,255,0.38);margin-top:2px">SKU: ' +
          esc(p.sku || "-") +
          "</div>" +
          "</div>" +
          "</div>" +
          sectionsHTML +
          "</div>"
        );
      }
      function compareHTML() {
        var left = PRODUCT_BY_KEY[compareState.leftKey] || null;
        var right = PRODUCT_BY_KEY[compareState.rightKey] || null;
        var v = verdict(left, right);
        return (
          '<div class="s5-compare-modal-panel" style="max-height:92vh;overflow:auto;border-radius:22px;background:#0b1120;border:1px solid rgba(255,255,255,0.11);box-shadow:0 14px 34px rgba(0,0,0,0.45);position:relative"><div style="position:sticky;top:0;z-index:5;padding:18px 22px;border-bottom:1px solid rgba(255,255,255,0.075);background:rgba(11,17,32,0.96);display:flex;align-items:center;justify-content:space-between;gap:16px;border-radius:22px 22px 0 0"><div style="display:flex;align-items:center;gap:12px"><div style="width:42px;height:42px;border-radius:13px;background:rgba(245,158,11,0.14);border:1px solid rgba(245,158,11,0.35);color:#fbbf24;display:flex;align-items:center;justify-content:center"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 7h14"/><path d="M6 7l-4 7h8L6 7z"/><path d="M18 7l-4 7h8l-4-7z"/></svg></div><div><div style="font-size:18px;font-weight:950;color:#fff">' +
          s5Txt(
            "Product Comparison",
            "\u0645\u0642\u0627\u0631\u0646\u0629 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a",
          ) +
          '</div><div style="font-size:11px;color:rgba(255,255,255,0.38);font-weight:700;margin-top:3px">' +
          s5Txt(
            "Volumes, rates, financials, and scale verdict",
            "\u0627\u0644\u062d\u062c\u0645 \u0648\u0627\u0644\u0646\u0633\u0628 \u0648\u0627\u0644\u0645\u0627\u0644\u064a\u0627\u062a \u0648\u062d\u0643\u0645 \u0627\u0644\u0623\u062f\u0627\u0621",
          ) +
          '</div></div></div><button id="s5-compare-close" style="width:36px;height:36px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.65);cursor:pointer;font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;font-family:inherit">&times;</button></div><div style="padding:18px 20px 20px"><div class="s5-compare-grid">' +
          columnHTML("left", left, right) +
          '<div class="s5-compare-divider" style="display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:rgba(255,255,255,0.32);align-self:stretch"><div class="s5-compare-divider-line" style="width:1px;flex:1;background:linear-gradient(180deg,transparent,rgba(245,158,11,0.45),transparent)"></div><div style="width:34px;height:34px;border-radius:50%;border:1px solid rgba(245,158,11,0.32);background:rgba(245,158,11,0.10);color:#fbbf24;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:950;flex-shrink:0">VS</div><div class="s5-compare-divider-line" style="width:1px;flex:1;background:linear-gradient(180deg,transparent,rgba(20,184,166,0.45),transparent)"></div></div>' +
          columnHTML("right", right, left) +
          '</div><div class="s5-compare-verdict" style="margin-top:16px;border-radius:18px;border:1px solid ' +
          v.color +
          "66;background:linear-gradient(135deg," +
          v.color +
          "22,rgba(255,255,255,0.025));box-shadow:0 0 34px " +
          v.color +
          '18;padding:18px 20px;display:flex;align-items:flex-start;gap:13px"><div style="width:38px;height:38px;border-radius:12px;background:' +
          v.color +
          "22;border:1px solid " +
          v.color +
          "66;color:" +
          v.color +
          ';display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div><div><div style="font-size:15px;font-weight:950;color:#fff;margin-bottom:5px">' +
          v.title +
          '</div><div style="font-size:12px;line-height:1.75;color:rgba(255,255,255,0.72);font-weight:700">' +
          v.text +
          "</div></div></div></div></div>"
        );
      }
      function bindCompareInputs() {
        // â”€â”€ Custom dropdown wiring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        compareModal
          .querySelectorAll(".s5-cmp-dd-wrap")
          .forEach(function (wrap) {
            var side = wrap.dataset.side;
            var trigger = wrap.querySelector(".s5-cmp-dd-trigger");
            var panel = wrap.querySelector(".s5-cmp-dd-panel");
            var search = wrap.querySelector(".s5-cmp-dd-search");
            var list = wrap.querySelector(".s5-cmp-dd-list");
            var arrow = wrap.querySelector(".s5-cmp-dd-arrow");
            if (!trigger || !panel) return;

            function openPanel() {
              // Close any other open panels first
              compareModal
                .querySelectorAll(".s5-cmp-dd-panel")
                .forEach(function (p) {
                  if (p !== panel) {
                    p.style.display = "none";
                    var a =
                      p.closest(".s5-cmp-dd-wrap") &&
                      p
                        .closest(".s5-cmp-dd-wrap")
                        .querySelector(".s5-cmp-dd-arrow");
                    if (a) a.style.transform = "";
                  }
                });
              panel.style.display = "flex";
              if (arrow) arrow.style.transform = "rotate(180deg)";
              if (search) {
                search.value = "";
                filterOptions("");
                search.focus();
              }
            }

            function closePanel() {
              panel.style.display = "none";
              if (arrow) arrow.style.transform = "";
            }

            function filterOptions(q) {
              var needle = q.toLowerCase();
              list &&
                list
                  .querySelectorAll(".s5-cmp-dd-option")
                  .forEach(function (opt) {
                    var text = opt.getAttribute("data-search") || "";
                    opt.style.display = text.includes(needle) ? "" : "none";
                  });
            }

            function selectKey(key) {
              if (side === "left") compareState.leftKey = key;
              else compareState.rightKey = key;
              closePanel();
              refreshCompare();
            }

            trigger.addEventListener("click", function (e) {
              e.stopPropagation();
              if (panel.style.display === "flex") closePanel();
              else openPanel();
            });

            if (search) {
              search.addEventListener("input", function () {
                filterOptions(search.value);
              });
              search.addEventListener("click", function (e) {
                e.stopPropagation();
              });
            }

            list &&
              list
                .querySelectorAll(".s5-cmp-dd-option")
                .forEach(function (opt) {
                  opt.addEventListener("mouseenter", function () {
                    if (!opt.classList.contains("selected"))
                      opt.style.background = "rgba(255,255,255,0.06)";
                  });
                  opt.addEventListener("mouseleave", function () {
                    if (!opt.classList.contains("selected"))
                      opt.style.background = "transparent";
                  });
                  opt.addEventListener("click", function (e) {
                    e.stopPropagation();
                    selectKey(opt.getAttribute("data-key") || "");
                  });
                });

            // Close on outside click
            document.addEventListener("click", function handler(e) {
              if (!wrap.contains(e.target)) {
                closePanel();
              }
            });
          });

        var closeBtn = compareModal.querySelector("#s5-compare-close");
        if (closeBtn) closeBtn.addEventListener("click", closeCompare);
      }
      function refreshCompare() {
        compareModal.innerHTML = compareHTML();
        bindCompareInputs();
      }
      refreshProductCompareModal = function () {
        if (compareModal.style.display !== "none") refreshCompare();
      };
      function openCompare(productKey) {
        compareState.leftKey = productKey || "";
        compareState.rightKey = "";
        refreshCompare();
        compareModal.style.display = "flex";
        document.body.style.overflow = "hidden";
      }
      function closeCompare() {
        compareModal.style.display = "none";
        document.body.style.overflow = "";
      }
      compareModal.addEventListener("click", function (e) {
        if (e.target === compareModal) closeCompare();
      });
      function onCompareKeydown(e) {
        if (e.key === "Escape" && compareModal.style.display !== "none")
          closeCompare();
      }
      document.addEventListener("keydown", onCompareKeydown);
      function bindCompareRows(root) {
        return;
      }
      bindCompareRows(mountEl);
      var headerCompare = mountEl.querySelector("#s5-compare-open");
      if (headerCompare && headerCompare.dataset.compareBound !== "1" && !headerCompare._compareBound) {
        headerCompare.dataset.compareBound = "1";
        headerCompare._compareBound = true;
      }

      window.openProductCompareModal = openCompare;
      window.s5BindProductCompareRows = bindCompareRows;
      addProductCleanup(function () {
        document.removeEventListener("keydown", onCompareKeydown);
        if (window.openProductCompareModal === openCompare)
          delete window.openProductCompareModal;
        if (window.s5BindProductCompareRows === bindCompareRows)
          delete window.s5BindProductCompareRows;
        if (compareModal.parentNode) compareModal.remove();
      });
    })();

    (function buildProductModal() {
      var currentModalProductKey = null;
      var currentModalCityPage = 1;

      /* Create modal overlay once */
      var MODAL_ID = "s5-product-modal";
      var existingModal = document.getElementById(MODAL_ID);
      if (existingModal) existingModal.remove();

      var modal = document.createElement("div");
      modal.id = MODAL_ID;
      modal.className = "dash-overlay-scope";
      modal.style.cssText = [
        "position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;",
        "background:rgba(0,0,0,0.72);",
        "font-family:Cairo,sans-serif;direction:" +
          (isAr ? "rtl" : "ltr") +
          ";",
      ].join("");
      document.body.appendChild(modal);

      function pct(n, d) {
        return (+(n || 0)).toFixed(d != null ? d : 1) + "%";
      }
      function num(n) {
        return Math.round(n || 0).toLocaleString("en-US");
      }
      function sar(n) {
        return productMoney(n || 0);
      }
      function sb(score, type) {
        return window.scoreBadge
          ? window.scoreBadge(score, type)
          : "<span>" + score + "</span>";
      }

      function ndrColor(v) {
        return window.dashboardRateColor
          ? window.dashboardRateColor(v)
          : v >= 40
            ? "#22d3ee"
            : v >= 30
              ? "#00e676"
              : v >= 20
                ? "#f59e0b"
                : "#ef4444";
      }
      function drColor(v) {
        return window.dashboardRateColor
          ? window.dashboardRateColor(v)
          : v >= 40
            ? "#22d3ee"
            : v >= 30
              ? "#00e676"
              : v >= 20
                ? "#f59e0b"
                : "#ef4444";
      }

      function modalHTML(p) {
        if (!p) return "";
        var geoD = window.dashboardGeoData;
        var gpm = geoD && geoD.geo && geoD.geo.geoProductMap;
        var prodKey = p.key || p.sku || p.name || "";

        /* City breakdown from geoProductMap */
        var cityRows = "";
        var cityPaginationHtml = "";
        if (gpm) {
          var cityEntries = p._s5ModalCityEntries || null;
          if (!cityEntries) {
            cityEntries = [];
          Object.keys(gpm).forEach(function (cityName) {
            var cell = gpm[cityName] && gpm[cityName][prodKey];
            // Show cities with created orders or delivered events in the selected attribution mode.
            if (cell && ((cell.orders || 0) > 0 || (cell.delivered || 0) > 0)) {
              var cellNdr =
                (cell.orders || 0) > 0
                  ? ((cell.delivered || 0) / (cell.orders || 0)) * 100
                  : 0;
              cellNdr = isNaN(cellNdr) ? 0 : cellNdr;
              cityEntries.push({
                name: cityName,
                orders: cell.orders,
                ndr: cellNdr,
                delivered: cell.delivered || 0,
                confirmation:
                  typeof cell.confirmationRate === "number"
                    ? Math.round(cell.confirmationRate * 1000) / 10
                    : (cell.orders || 0) > 0
                      ? Math.round(
                          (((cell.confirmed || 0) +
                            (cell.shipping || 0) +
                            (cell.processing || 0) +
                            (cell.delivered || 0)) /
                            (cell.orders || 0)) *
                            1000,
                        ) / 10
                      : null,
                commission: cell.commission || 0,
                riskScore: cell.riskScore || 0,
                scalingScore: cell.scalingScore || 0,
              });
            }
          });
          cityEntries.sort(function (a, b) {
            return b.orders - a.orders;
          });
            p._s5ModalCityEntries = cityEntries;
          }

          var MODAL_CITY_PAGE_SIZE = 5;
          var totalCities = cityEntries.length;
          var totalPages = Math.ceil(totalCities / MODAL_CITY_PAGE_SIZE);
          var startIndex = (currentModalCityPage - 1) * MODAL_CITY_PAGE_SIZE;
          var pageEntries = cityEntries.slice(
            startIndex,
            startIndex + MODAL_CITY_PAGE_SIZE,
          );

          pageEntries.forEach(function (c, i) {
            var barW = Math.min(
              100,
              Math.round(
                (c.orders / ((cityEntries[0] && cityEntries[0].orders) || 1)) *
                  100,
              ),
            );
            cityRows +=
              '<div style="display:grid;grid-template-columns:1fr 56px 58px 58px 68px;gap:8px;align-items:center;' +
              'padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.03);margin-bottom:4px;">' +
              "<div>" +
              '<div style="font-size:12px;font-weight:800;color:#fff;margin-bottom:3px">' +
              esc(tx(c.name)) +
              "</div>" +
              '<div style="height:3px;background:rgba(255,255,255,0.06);border-radius:3px">' +
              '<div style="height:100%;width:' +
              barW +
              '%;background:linear-gradient(90deg,#7c3aed,#14b8a6);border-radius:3px"></div>' +
              "</div>" +
              "</div>" +
              '<div style="text-align:center;font-size:12px;font-weight:700;color:rgba(255,255,255,0.7)">' +
              num(c.orders) +
              "</div>" +
              '<div style="text-align:center;font-size:12px;font-weight:800;color:' +
              ndrColor(c.ndr) +
              '">' +
              pct(c.ndr) +
              "</div>" +
              '<div style="text-align:center;font-size:12px;font-weight:800;color:' +
              ndrColor(c.confirmation || 0) +
              '">' +
              (c.confirmation == null ? "â€”" : pct(c.confirmation)) +
              "</div>" +
              '<div style="text-align:center">' +
              sb(c.scalingScore, "scale") +
              "</div>" +
              "</div>";
          });

          if (totalPages > 1 && window.renderDashboardPagination) {
            cityPaginationHtml =
              '<div style="margin-top:10px;">' +
              window.renderDashboardPagination({
                currentPage: currentModalCityPage,
                totalPages: totalPages,
                pageButtonClass: "s5-modal-city-page-btn",
                prevClass: "s5-modal-city-prev",
                nextClass: "s5-modal-city-next",
                className: "dash-pagination-compact s5-modal-pagination",
                infoText: "",
              }) +
              "</div>";
          }
        }

        /* Funnel bars */
        var total = p.placedCount || 1;
        var funnel = [
          {
            label: s5Txt("Delivered", "Ã˜ÂªÃ™â€¦ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â³Ã™â€žÃ™Å Ã™â€¦"),
            count: p.deliveredCount || 0,
            color: "#00e676",
          },
          {
            label: s5Txt("In Shipping", "Ã™â€šÃ™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â­Ã™â€ "),
            count: p.shippingCount || 0,
            color: "#14b8a6",
          },
          {
            label: s5Txt("Confirmed", "Ã™â€¦Ã˜Â¤Ã™Æ’Ã˜Â¯"),
            count: p.confirmedCount || 0,
            color: "#3b82f6",
          },
          {
            label: p5Txt("funnelFailed"),
            count: p.failedCount || 0,
            color: "#f97316",
          },
          {
            label: p5Txt("funnelCanceled"),
            count: p.canceledCount || 0,
            color: "#ef4444",
          },
          {
            label: s5Txt("Pending", "Ã™â€šÃ™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã˜ÂªÃ˜Â¸Ã˜Â§Ã˜Â±"),
            count: (p.pendingCount || 0) + (p.waitingCount || 0),
            color: "#a855f7",
          },
        ];

        var _fIsLight =
          document.documentElement.getAttribute("data-theme") === "light";
        var funnelHTML = funnel
          .map(function (f) {
            var barW = Math.round((f.count / total) * 100);
            return (
              '<div style="margin-bottom:8px">' +
              '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">' +
              '<span style="color:' +
              (_fIsLight ? "rgba(30,10,60,0.6)" : "rgba(255,255,255,0.55)") +
              '">' +
              f.label +
              "</span>" +
              '<span style="font-weight:700;color:' +
              (_fIsLight ? "rgba(15,5,30,0.9)" : "#fff") +
              '">' +
              num(f.count) +
              ' <span style="color:' +
              (_fIsLight ? "rgba(15,5,30,0.45)" : "rgba(255,255,255,0.35)") +
              ';font-weight:500">(' +
              barW +
              "%)</span></span>" +
              "</div>" +
              '<div style="height:6px;background:' +
              (_fIsLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.06)") +
              ';border-radius:6px;overflow:hidden">' +
              '<div style="height:100%;width:' +
              barW +
              "%;background:" +
              f.color +
              ';border-radius:6px"></div>' +
              "</div>" +
              "</div>"
            );
          })
          .join("");

        var ndrVal = typeof p.ndr === "number" ? p.ndr : p.ndrPct || 0;
        var drVal =
          typeof p.drRate === "number"
            ? p.drRate
            : typeof p.dr === "number"
              ? p.dr
              : p.deliveryPct || 0;
        var cancelVal =
          typeof p.cancelPct === "number" ? p.cancelPct : p.cancel || 0;
        var cnfVal =
          typeof p.confirmationPct === "number"
            ? p.confirmationPct
            : p.confirmation || 0;

        return (
          '<div style="background:#0c1121;border:1px solid rgba(255,255,255,0.1);border-radius:22px;' +
          "width:min(860px,96vw);max-height:88vh;overflow-y:auto;position:relative;" +
          'box-shadow:0 14px 34px rgba(0,0,0,0.45);">' +
          /* Header */
          '<div style="padding:24px 28px 20px;border-bottom:1px solid rgba(255,255,255,0.07);' +
          "display:flex;align-items:flex-start;justify-content:space-between;gap:16px;" +
          'position:sticky;top:0;background:#0c1121;z-index:10;border-radius:22px 22px 0 0;">' +
          '<div style="display:flex;align-items:center;gap:14px;">' +
          '<div style="width:46px;height:46px;border-radius:14px;background:rgba(124,58,237,0.15);' +
          'border:1px solid rgba(124,58,237,0.3);display:flex;align-items:center;justify-content:center;">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>' +
          "</div>" +
          "<div>" +
          '<div style="font-size:18px;font-weight:900;color:#fff">' +
          esc(p.name || s5Txt("product", "Ã™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬")) +
          "</div>" +
          '<div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:3px">SKU: ' +
          esc(p.sku || "-") +
          "  Ã‚Â·  " +
          s5Txt("Rank #", "Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â© #") +
          esc(p.rank || "-") +
          "</div>" +
          "</div>" +
          "</div>" +
          '<button id="s5-modal-close" style="background:rgba(255,255,255,0.07);border:none;color:rgba(255,255,255,0.6);' +
          "font-size:18px;width:34px;height:34px;border-radius:10px;cursor:pointer;flex-shrink:0;" +
          "display:flex;align-items:center;justify-content:center;font-family:inherit;" +
          'line-height:1;">x</button>' +
          "</div>" +
          /* KPI bar */
          '<div class="s5-modal-kpi-grid" style="padding:20px 28px;display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;' +
          'border-bottom:1px solid rgba(255,255,255,0.06);">' +
          [
            {
              label: s5Txt("Total Orders", "Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª"),
              value: num(total),
              color: "#a855f7",
              badge: null,
            },
            {
              label: s5Txt("Delivery Rate", "Ã™â€¦Ã˜Â¹Ã˜Â¯Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â³Ã™â€žÃ™Å Ã™â€¦"),
              value: pct(drVal),
              color: drColor(drVal),
              badge: null,
            },
            {
              label: s5Txt("Cancel Rate", "Ã™â€¦Ã˜Â¹Ã˜Â¯Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¥Ã™â€žÃ˜ÂºÃ˜Â§Ã˜Â¡"),
              value: pct(cancelVal),
              color: "#ef4444",
              badge: null,
            },
            {
              label: s5Txt("Confirm Rate", "Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â£Ã™Æ’Ã™Å Ã˜Â¯"),
              value: pct(cnfVal),
              color: "#14b8a6",
              badge: null,
            },
            {
              label: s5Txt("Scale Index", "Ã™â€¦Ã˜Â¤Ã˜Â´Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â³Ã˜Â¹"),
              value: "",
              color: "#f59e0b",
              badge: sb(p.scalingScore || 0, "scale"),
            },
            {
              label: p5Txt("adSpend"),
              value: productMoney(p.allocatedAdSpend),
              color: "#60a5fa",
              badge: null,
              help: p5Txt("adSpendHelp"),
            },
            {
              label: p5Txt("cpa"),
              value: productMoney(p.cpa),
              color: "#a78bfa",
              badge: null,
              help: p5Txt("cpaHelp"),
            },
            {
              label: p5Txt("breakEven"),
              value: productMoney(p.breakEvenCpa),
              color: "#f59e0b",
              badge: null,
              help: p5Txt("breakEvenHelp"),
            },
            {
              label: p5Txt("pnl"),
              value: productMoney(p.profitLoss),
              color: p.profitLoss >= 0 ? "#00e676" : "#ef4444",
              badge: null,
              help: p5Txt("pnlHelp"),
            },
          ]
            .map(function (k) {
              return (
                "<div" +
                (k.help ? ' title="' + attr(k.help) + '"' : "") +
                ' style="background:#0b1423;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px 10px;text-align:center">' +
                '<div style="font-size:' +
                (k.badge ? "0" : k.help ? "13" : "18") +
                "px;font-weight:900;color:" +
                k.color +
                ';line-height:1;margin-bottom:6px;white-space:nowrap">' +
                k.value +
                (k.badge || "") +
                "</div>" +
                '<div style="font-size:10px;color:rgba(255,255,255,0.38);font-weight:700">' +
                k.label +
                "</div>" +
                "</div>"
              );
            })
            .join("") +
          "</div>" +
          /* Body: funnel + city table */
          '<div style="padding:24px 28px;display:grid;grid-template-columns:1fr 1fr;gap:24px;">' +
          /* Funnel */
          "<div>" +
          '<div style="font-size:12px;font-weight:800;color:rgba(255,255,255,0.45);margin-bottom:14px;">' +
          s5Txt("Order Funnel", "Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª") +
          "</div>" +
          funnelHTML +
          "</div>" +
          /* City breakdown */
          "<div>" +
          '<div style="font-size:12px;font-weight:800;color:rgba(255,255,255,0.45);margin-bottom:14px;">' +
          s5Txt("City Performance", "Ã˜Â£Ã˜Â¯Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã™â€ ") +
          "</div>" +
          (cityRows
            ? '<div style="font-size:10px;color:rgba(255,255,255,0.3);display:grid;grid-template-columns:1fr 56px 58px 58px 68px;gap:8px;padding:0 10px;margin-bottom:6px;">' +
              "<span>" +
              s5Txt("City", "Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã™Å Ã™â€ Ã˜Â©") +
              '</span><span style="text-align:center">' +
              s5Txt("Orders", "Ã˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª") +
              '</span><span style="text-align:center">NDR</span><span style="text-align:center">' +
              s5Txt("Confirm", "Ã˜ÂªÃ˜Â£Ã™Æ’Ã™Å Ã˜Â¯") +
              '</span><span style="text-align:center">' +
              s5Txt("Scale", "Ã˜ÂªÃ™Ë†Ã˜Â³Ã˜Â¹") +
              "</span>" +
              "</div>" +
              cityRows +
              cityPaginationHtml
            : '<div style="color:rgba(255,255,255,0.25);font-size:12px;padding:20px 0">' +
              s5Txt(
                "No geographical data available",
                "Ã™â€žÃ˜Â§ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã˜Â¯ Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â¬Ã˜ÂºÃ˜Â±Ã˜Â§Ã™ÂÃ™Å Ã˜Â© Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â­Ã˜Â©",
              ) +
              "</div>") +
          "</div>" +
          "</div>" +
          "</div>"
        );
      }

      function refreshModal() {
        var p = PRODUCT_BY_KEY[currentModalProductKey] || null;
        if (!p) return;
        modal.innerHTML = modalHTML(p);
        bindModalCityPagination();
        var closeBtn = modal.querySelector("#s5-modal-close");
        if (closeBtn) closeBtn.addEventListener("click", closeModal);
      }
      refreshProductModal = refreshModal;

      function bindModalCityPagination() {
        if (window.bindDashboardPagination) {
          window.bindDashboardPagination(modal, {
            pageButtonSelector: ".s5-modal-city-page-btn",
            prevSelector: ".s5-modal-city-prev",
            nextSelector: ".s5-modal-city-next",
            onPage: function (p) {
              currentModalCityPage = p;
              refreshModal();
            },
            onPrev: function () {
              currentModalCityPage--;
              refreshModal();
            },
            onNext: function () {
              currentModalCityPage++;
              refreshModal();
            },
          });
        }
      }

      function openModal(productKey) {
        currentModalProductKey = productKey;
        currentModalCityPage = 1;

        var p = PRODUCT_BY_KEY[productKey] || null;
        if (!p) return;
        modal.innerHTML = modalHTML(p);
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";

        var closeBtn = modal.querySelector("#s5-modal-close");
        if (closeBtn) closeBtn.addEventListener("click", closeModal);

        bindModalCityPagination();
      }

      function closeModal() {
        modal.style.display = "none";
        document.body.style.overflow = "";
      }

      modal.addEventListener("click", function (e) {
        if (e.target === modal) closeModal();
      });

      function onModalKeydown(e) {
        if (e.key === "Escape" && modal.style.display !== "none") closeModal();
      }
      document.addEventListener("keydown", onModalKeydown);

      function bindModalRows(root) {
        return;
      }
      bindModalRows(mountEl);

      /* Expose globally so city drawer can open it */
      window.openProductModal = openModal;
      window.s5BindProductModalRows = bindModalRows;

      var modalObserver = new MutationObserver(function () {
        if (!document.body.contains(mountEl)) {
          document.removeEventListener("keydown", onModalKeydown);
          if (modal.parentNode) modal.remove();
          modalObserver.disconnect();
        }
      });
      if (mountEl.parentNode)
        modalObserver.observe(mountEl.parentNode, { childList: true });
      addProductCleanup(function () {
        document.removeEventListener("keydown", onModalKeydown);
        if (modal.parentNode) modal.remove();
        modalObserver.disconnect();
      });
    })();

    if (window.DashboardRoiState) {
      if (mountEl._s5RoiListener) {
        window.DashboardRoiState.unsubscribe(mountEl._s5RoiListener);
      }
      mountEl._s5RoiListener = function (settings) {
        if (ctx && ctx.sectionId && ctx.sectionId !== "products") return;
        if (String(settings.accountId) !== String(productAccountId)) return;
        var previousAdSpend = Number(productFinancialSettings && productFinancialSettings.adSpend || 0);
        var nextAdSpend = Number(settings && settings.adSpend || 0);
        productFinancialSettings = settings;
        applyProductFinancials();
        listCache = null;
        listCacheKey = "";
        clearProductDetailCache();
        if (previousAdSpend !== nextAdSpend) {
          scheduleProductPageRender({ keepFilterBar: true });
        } else {
          updateProductCurrencyUIOnly();
        }
        refreshProductModal();
        refreshProductCompareModal();
      };
      window.DashboardRoiState.subscribe(mountEl._s5RoiListener);
      var productSettingsObserver = new MutationObserver(function () {
        if (!document.body.contains(mountEl)) {
          window.DashboardRoiState.unsubscribe(mountEl._s5RoiListener);
          mountEl._s5RoiListener = null;
          productSettingsObserver.disconnect();
        }
      });
      if (mountEl.parentNode)
        productSettingsObserver.observe(mountEl.parentNode, {
          childList: true,
        });
      addProductCleanup(function () {
        if (mountEl._s5RoiListener) {
          window.DashboardRoiState.unsubscribe(mountEl._s5RoiListener);
          mountEl._s5RoiListener = null;
        }
        productSettingsObserver.disconnect();
      });
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Compact toggle Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    if (window.DashboardMarketingState) {
      if (mountEl._s5MarketingListener) {
        window.DashboardMarketingState.unsubscribe(
          mountEl._s5MarketingListener,
        );
      }
      mountEl._s5MarketingListener = function (status) {
        if (ctx && ctx.sectionId && ctx.sectionId !== "products") return;
        if (String(status.accountId) !== String(productAccountId)) return;
        productMarketingState = status;
        applyProductFinancials();
        listCache = null;
        listCacheKey = "";
        clearProductDetailCache();
        scheduleProductPageRender({ keepFilterBar: true });
        refreshProductModal();
      };
      window.DashboardMarketingState.subscribe(mountEl._s5MarketingListener);
      var productMarketingObserver = new MutationObserver(function () {
        if (!document.body.contains(mountEl)) {
          window.DashboardMarketingState.unsubscribe(
            mountEl._s5MarketingListener,
          );
          mountEl._s5MarketingListener = null;
          productMarketingObserver.disconnect();
        }
      });
      if (mountEl.parentNode)
        productMarketingObserver.observe(mountEl.parentNode, {
          childList: true,
        });
      addProductCleanup(function () {
        if (mountEl._s5MarketingListener) {
          window.DashboardMarketingState.unsubscribe(
            mountEl._s5MarketingListener,
          );
          mountEl._s5MarketingListener = null;
        }
        productMarketingObserver.disconnect();
      });
      if (typeof window.DashboardMarketingState.load === "function") {
        window.DashboardMarketingState.load(productAccountId);
      }
    }

    const toggleBtn = document.getElementById("s5-view-toggle");
    if (toggleBtn) {
      toggleBtn.dataset.s5Delegated = "1";
    }
    if (window.dashboardI18n) window.dashboardI18n.apply(mountEl);
    if (window.KhodUI) window.KhodUI.enhance(mountEl);
};
