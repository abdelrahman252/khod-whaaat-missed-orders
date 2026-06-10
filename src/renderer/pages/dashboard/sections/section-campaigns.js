(function () {
  "use strict";

  /*
   * CAMPAIGNS SECTION ROADMAP / READ BEFORE EDITING
   *
   * The next campaigns refactor must keep two money layers separate:
   * 1. Source-native campaign rows: raw ad-platform values exactly as TikTok,
   *    Snapchat, or Facebook reports them. Row spend, CPC, CPM, and platform
   *    totals should show the ad account currency and must not be silently
   *    converted in-place.
   * 2. Reporting/product totals: objective rollups, product attribution totals,
   *    CPA comparisons, and profitability views may use the selected reporting
   *    or calculator currency, but labels must say that clearly.
   *
   * Never sum mixed raw currencies into one "native" total. If sources are
   * mixed, show the converted reporting total first and show raw currency chips
   * or per-source rows beneath it. Attribution should also distinguish exact
   * SKU matches from guessed/name matches and "needs review" matches so product
   * spend is not treated as verified when it is only inferred.
   */

  var PLATFORMS = [
    { id: "all", label: "All" },
    { id: "tiktok", label: "TikTok" },
    { id: "snapchat", label: "Snapchat" },
    { id: "facebook", label: "Facebook" }
  ];
  var PAGE_SIZES = [10, 25, 50];
  var campaignDecisionTipSeq = 0;
  var campaignIntelCache = new Map();

  function campaignIntelCacheKey(data, accountId, platform, syncStamp, reportingCurrency) {
    return [
      data && data._version || data && data.meta && (data.meta.lastUpdatedAt || data.meta.generatedAt || data.meta.periodLabel) || "loaded",
      accountId || "__all__",
      platform || "all",
      syncStamp || "",
      reportingCurrency || "SAR",
    ].join("|");
  }

  function rememberCampaignIntel(key, intel) {
    campaignIntelCache.set(key, intel);
    if (campaignIntelCache.size > 12) {
      campaignIntelCache.delete(campaignIntelCache.keys().next().value);
    }
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmt(value) {
    return Math.round(Number(value || 0)).toLocaleString("en-US");
  }

  function fmtDecimal(value, digits) {
    var n = Number(value || 0);
    if (!Number.isFinite(n)) n = 0;
    return n.toLocaleString("en-US", { maximumFractionDigits: digits == null ? 2 : digits });
  }

  function money(value, currency) {
    var code = String(currency || "SAR").toUpperCase();
    if (window.formatDashboardMoney) {
      return window.formatDashboardMoney(value, code, 2);
    }
    if (window.TaagerCurrency && typeof window.TaagerCurrency.format === "function") {
      return window.TaagerCurrency.format(value, code, { decimals: 2, style: "code" });
    }
    return fmtDecimal(value, 2) + " " + code;
  }

  function percent(value) {
    return fmtDecimal(value, 2) + "%";
  }

  function formatSyncTime(value) {
    if (!value) return "Not synced yet";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "Not synced yet";
    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function roas(value) {
    return fmtDecimal(value, 2) + "x";
  }

  function signedMoney(value, currency) {
    var n = Number(value || 0);
    return (n > 0 ? "+" : "") + money(n, currency);
  }

  function campaignPick(en, ar) {
    return window.dashboardI18n && window.dashboardI18n.currentLocale === "ar" ? ar : en;
  }

  function financialState(value, available) {
    if (available === false || value == null || !Number.isFinite(Number(value))) return "neutral";
    var n = Number(value);
    if (n > 0) return "positive";
    if (n < 0) return "negative";
    return "zero";
  }

  function supportedCampaignCurrencies() {
    if (window.DashboardRoiState && Array.isArray(window.DashboardRoiState.currencies)) {
      return window.DashboardRoiState.currencies.slice();
    }
    if (window.TaagerCurrency && Array.isArray(window.TaagerCurrency.supported)) {
      return window.TaagerCurrency.supported.slice();
    }
    return ["SAR", "USD"];
  }

  function normalizeCampaignCurrency(currency, fallback) {
    var next = String(currency || fallback || window.dashboardActiveCurrency || "SAR").toUpperCase();
    if (window.TaagerCurrency && typeof window.TaagerCurrency.cleanCurrency === "function") {
      next = window.TaagerCurrency.cleanCurrency(next, fallback || window.dashboardActiveCurrency || "SAR");
    }
    return supportedCampaignCurrencies().indexOf(next) !== -1 ? next : String(fallback || window.dashboardActiveCurrency || "SAR").toUpperCase();
  }

  function campaignAccountId(data) {
    return data && data.meta && data.meta.activeAccountId || (window.getActiveAccountId ? window.getActiveAccountId() : "__all__");
  }

  function campaignRoiSettings(accountId, data) {
    var fallback = Object.assign({ currency: data && data.meta && data.meta.activeCurrency || window.dashboardActiveCurrency || "SAR" }, data && data.roi || {});
    return window.DashboardRoiState && typeof window.DashboardRoiState.get === "function"
      ? window.DashboardRoiState.get(accountId, fallback)
      : fallback;
  }

  function currentCampaignCurrency(accountId, data) {
    var settings = campaignRoiSettings(accountId, data);
    return normalizeCampaignCurrency(settings.currency, data && data.meta && data.meta.activeCurrency || window.dashboardActiveCurrency || "SAR");
  }

  function sarToCampaignCurrency(value, currency) {
    var amount = Number(value || 0);
    var code = normalizeCampaignCurrency(currency, "SAR");
    if (window.TaagerCurrency && typeof window.TaagerCurrency.convert === "function") {
      return window.TaagerCurrency.convert(amount, "SAR", code);
    }
    if (code === "USD") return amount / 3.75;
    return amount;
  }

  function setCampaignProductCurrency(mount, data, ctx, currency) {
    var accountId = campaignAccountId(data);
    var current = currentCampaignCurrency(accountId, data);
    var next = normalizeCampaignCurrency(currency, current);
    if (next === current) return;
    mount._cachedIntel = null;
    campaignIntelCache.clear();
    if (window.DashboardRoiState && typeof window.DashboardRoiState.set === "function") {
      window.DashboardRoiState.set({ currency: next }, accountId, data && data.roi || {});
      return;
    }
    if (data) data.roi = Object.assign({}, data.roi || {}, { currency: next });
    refreshCampaignCurrencyUIOnly(mount, data, ctx);
  }

  function bindCampaignCurrencySelect(mount, data, ctx) {
    var wrap = mount.querySelector("[data-campaign-product-currency]");
    if (!wrap) return;
    var accountId = campaignAccountId(data);
    var current = currentCampaignCurrency(accountId, data);
    var options = supportedCampaignCurrencies().map(function (currency) {
      return { value: currency, label: currency };
    });
    if (window.renderCustomSelect) {
      window.renderCustomSelect(wrap, options, current, function (value) {
        setCampaignProductCurrency(mount, data, ctx, value);
      }, { maxHeight: "220px", ariaLabel: "Product Actions shared calculator currency" });
      return;
    }
    wrap.innerHTML = '<select class="campaign-currency-native" style="width:100%;height:32px;border-radius:9px;border:1px solid rgba(255,255,255,0.12);background:#0b1120;color:#fff;font-size:12px;font-weight:800;font-family:inherit;padding:0 8px">' +
      options.map(function (opt) {
        return '<option value="' + esc(opt.value) + '"' + (opt.value === current ? " selected" : "") + '>' + esc(opt.label) + '</option>';
      }).join("") +
      '</select>';
  }

  function icon(name) {
    var rendered = window.icon ? window.icon(name, { size: 15 }) : "";
    if (rendered) return rendered;
    var s = 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    var fallbacks = {
      search: '<circle cx="11" cy="11" r="7" ' + s + ' fill="none"/><path d="m20 20-3.5-3.5" ' + s + '/>',
      sparkles: '<path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3z" ' + s + ' fill="none"/><path d="M5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8L5 16z" ' + s + ' fill="none"/>',
      target: '<circle cx="12" cy="12" r="9" ' + s + ' fill="none"/><circle cx="12" cy="12" r="5" ' + s + ' fill="none"/><circle cx="12" cy="12" r="1" ' + s + ' fill="none"/>',
      wallet: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19a2 2 0 0 1 2 2v12H5.5A2.5 2.5 0 0 1 3 16.5v-9Z" ' + s + ' fill="none"/><path d="M16 12h5v5h-5a2.5 2.5 0 0 1 0-5Z" ' + s + ' fill="none"/><path d="M16 14.5h.01" ' + s + '/>',
      shieldHalved: '<path d="M12 3 5 6v5c0 4.8 3 8.3 7 10 4-1.7 7-5.2 7-10V6l-7-3Z" ' + s + ' fill="none"/><path d="M12 3v18" ' + s + '/>',
      circleXmark: '<circle cx="12" cy="12" r="9" ' + s + ' fill="none"/><path d="m9 9 6 6M15 9l-6 6" ' + s + '/>',
      package: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" ' + s + ' fill="none"/><path d="m4.5 7.8 7.5 4.2 7.5-4.2M12 21v-9" ' + s + '/>',
      calculator: '<rect x="5" y="3" width="14" height="18" rx="2" ' + s + ' fill="none"/><path d="M8 7h8M8 11h2M12 11h2M16 11h.01M8 15h2M12 15h2M16 15h.01" ' + s + '/>',
      moneyBill: '<rect x="3" y="6" width="18" height="12" rx="2" ' + s + ' fill="none"/><circle cx="12" cy="12" r="3" ' + s + ' fill="none"/><path d="M6 9v.01M18 15v.01" ' + s + '/>',
      trendingUp: '<path d="M3 17 9 11l4 4 8-8" ' + s + ' fill="none"/><path d="M15 7h6v6" ' + s + '/>',
      pulse: '<path d="M3 12h4l2-5 4 10 2-5h6" ' + s + ' fill="none"/>'
    };
    return fallbacks[name]
      ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="color:currentColor;vertical-align:middle;flex-shrink:0">' + fallbacks[name] + '</svg>'
      : "";
  }

  function compactText(value, max) {
    value = String(value == null ? "" : value).trim();
    max = Number(max) || 64;
    return value.length > max ? value.slice(0, max - 1) + "..." : value;
  }

  function stateForPlatform(accountId, platform) {
    if (!window.DashboardMarketingState || typeof window.DashboardMarketingState.get !== "function") return null;
    if (platform && platform !== "all") return window.DashboardMarketingState.get(accountId, platform);
    return window.DashboardMarketingState.get(accountId);
  }

  function textKey(value) {
    if (window.KhodCampaignIntelligence && typeof window.KhodCampaignIntelligence.textKey === "function") {
      return window.KhodCampaignIntelligence.textKey(value);
    }
    return String(value || "").toLowerCase().trim();
  }

  function defaultState(mount) {
    mount._campaignUi = mount._campaignUi || {};
    var state = mount._campaignUi;
    state.campaignPage = Number(state.campaignPage || 1);
    state.productPage = Number(state.productPage || 1);
    state.pageSize = PAGE_SIZES.indexOf(Number(state.pageSize)) !== -1 ? Number(state.pageSize) : 10;
    state.search = String(state.search || "");
    state.productSearch = String(state.productSearch || "");
    state.matchFilter = state.matchFilter || "all";
    state.objectiveFilter = state.objectiveFilter || "all";
    state.sortKey = state.sortKey || "spendSar";
    state.sortDir = state.sortDir || "desc";
    state.productSortKey = state.productSortKey || "spendSar";
    state.productSortDir = state.productSortDir || "desc";
    return state;
  }

  function card(label, value, sub, iconName, tone, valueState) {
    return '<div class="campaign-kpi campaign-kpi-' + esc(tone || "neutral") + (valueState ? " campaign-value-state-" + esc(valueState) : "") + '">' +
      '<div class="campaign-kpi-top"><span class="campaign-kpi-icon">' + icon(iconName || "activity") + '</span><span>' + esc(label) + '</span></div>' +
      '<strong class="' + (valueState ? "campaign-financial-" + esc(valueState) : "") + '">' + esc(value) + '</strong>' +
      (sub ? '<em>' + esc(sub) + '</em>' : '') +
    '</div>';
  }

  function renderCampaignKpis(intel) {
    var currency = intel.currency || intel.reportingCurrency || "SAR";
    var totals = intel.totals || {};
    return card("Spend", money(totals.adSpend != null ? totals.adSpend : sarToCampaignCurrency(totals.adSpendSar, currency), currency), "Spent campaigns in this period", "wallet", "spend") +
      card("Matched spend", percent(totals.matchedSpendPct), money(totals.matchedSpend != null ? totals.matchedSpend : sarToCampaignCurrency(totals.matchedSpendSar, currency), currency) + " exact SKU", "shieldHalved", "matched") +
      card("Unmatched spend", percent(totals.unmatchedSpendPct), money(totals.unmatchedSpend != null ? totals.unmatchedSpend : sarToCampaignCurrency(totals.unmatchedSpendSar, currency), currency) + " needs SKU", "circleXmark", "unmatched") +
      card("KHOD orders", fmt(totals.khodOrders), "From SKU-confirmed products", "package", "orders") +
      card("KHOD CPA", totals.khodOrders > 0 ? money(totals.khodCpa != null ? totals.khodCpa : sarToCampaignCurrency(totals.khodCpaSar, currency), currency) : "No KHOD orders", "Spend / KHOD orders", "calculator", "cpa") +
      card("Net profit", signedMoney(totals.netProfit != null ? totals.netProfit : sarToCampaignCurrency(totals.netProfitSar, currency), currency), "Earned commission - spend", "moneyBill", "profit", financialState(totals.netProfitSar, true)) +
      card("ROI", totals.matchedSpendSar > 0 ? percent(totals.roiPct) : campaignPick("Unavailable", "غير متوفر"), "Net profit / spend", "trendingUp", "roi", financialState(totals.roiPct, totals.matchedSpendSar > 0)) +
      card("Commission ROAS", roas(totals.commissionRoas), "Earned commission / spend", "pulse", "roas");
  }

  function sortValue(row, key) {
    var value = row && row[key];
    if (typeof value === "number") return value;
    if (value == null) return "";
    return String(value).toLowerCase();
  }

  function sortRows(rows, key, dir) {
    var factor = dir === "asc" ? 1 : -1;
    return rows.slice().sort(function (a, b) {
      var av = sortValue(a, key);
      var bv = sortValue(b, key);
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * factor;
      }
      var avNum = Number(av);
      var bvNum = Number(bv);
      var isAvNum = typeof av === "number" || (!isNaN(avNum) && av !== "" && av != null);
      var isBvNum = typeof bv === "number" || (!isNaN(bvNum) && bv !== "" && bv != null);
      if (isAvNum && isBvNum) {
        return (avNum - bvNum) * factor;
      }
      var as = String(av);
      var bs = String(bv);
      if (as < bs) return -1 * factor;
      if (as > bs) return 1 * factor;
      return 0;
    });
  }

  function objectiveOptions(rows, selected) {
    var seen = {};
    rows.forEach(function (row) {
      var objective = row.objective || "unknown";
      seen[objective] = true;
    });
    return '<option value="all">All objectives</option>' + Object.keys(seen).sort().map(function (objective) {
      return '<option value="' + esc(objective) + '"' + (selected === objective ? " selected" : "") + '>' + esc(objective) + '</option>';
    }).join("");
  }

  function filterCampaignRows(rows, state) {
    var query = textKey(state.search);
    return rows.filter(function (row) {
      if (state.matchFilter === "matched" && !row.attributionVerified) return false;
      if (state.matchFilter === "unmatched" && row.attributionVerified) return false;
      if (state.objectiveFilter !== "all" && row.objective !== state.objectiveFilter) return false;
      if (!query) return true;
      var haystack = row.searchHaystack || textKey([
        row.campaign,
        row.campaignId,
        row.platform,
        row.objective,
        row.status,
        row.product,
        row.suggestedProduct,
        row.productSku,
        row.suggestedProductSku,
        row.matchMethod,
        row.matchConfidence
      ].join(" "));
      return haystack.indexOf(query) !== -1;
    });
  }

  function paginate(rows, page, pageSize) {
    var total = rows.length;
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    var safePage = Math.min(Math.max(1, page), totalPages);
    var start = (safePage - 1) * pageSize;
    return {
      rows: rows.slice(start, start + pageSize),
      page: safePage,
      totalPages: totalPages,
      start: total ? start + 1 : 0,
      end: Math.min(start + pageSize, total),
      total: total
    };
  }

  function headerTip(mode, key, label) {
    var tips = {
      products: {
        product: "KHOD product matched only by exact SKU in the campaign name.",
        spendSar: "SKU-matched campaign spend shown in the shared calculator/product currency.",
        clicks: "Synced platform clicks. The small line shows how many SKU-matched campaigns feed this product.",
        khodOrders: "Real conversions from KHOD dashboard orders. Conversion rate = KHOD orders / landing-page views, or content views when landing-page views are unavailable.",
        khodDelivered: "Delivered KHOD orders from dashboard data. Delivered conversion rate uses the same landing-page or content-view denominator.",
        khodNdrPct: "NDR from KHOD dashboard delivery data.",
        khodCpaSar: "KHOD CPA = SKU-matched campaign spend / KHOD dashboard orders, shown in shared currency.",
        deliveredCpaSar: "Delivered CPA = SKU-matched campaign spend / delivered KHOD orders, shown in shared currency.",
        breakEvenCpaSar: "Break-even CPA uses KHOD average commission and NDR, shown in shared currency.",
        commission: "Earned commission from KHOD delivered/order data, shown in shared currency.",
        avgCommissionSar: "Average commission = earned commission / delivered KHOD orders, shown in shared currency.",
        netProfitSar: "Net profit = earned commission - SKU-matched campaign spend. ROI = net profit / spend.",
        commissionRoas: "Commission ROAS = earned commission / spend. Small line shows total sales and total sales ROAS.",
        decision: "Decision uses KHOD orders, delivered orders, NDR, CPA vs break-even, and net profit."
      },
      campaigns: {
        campaign: "Synced campaign name and ID. Add the exact SKU to the name for product attribution.",
        platform: "The ad platform that owns this campaign.",
        objective: "Campaign objective detected from synced fields and campaign naming.",
        status: "Current or effective campaign status reported by the ad platform.",
        spendSar: "Raw ad-platform spend in the ad account currency for this campaign row.",
        impressions: "Synced platform impressions.",
        clicks: "Synced platform clicks.",
        ctrPct: "CTR = clicks / impressions.",
        cpcSar: "Raw ad-platform CPC in the ad account currency.",
        cpmSar: "Raw ad-platform CPM in the ad account currency.",
        product: "Attribution result. Product Actions only use exact SKU matches; unmatched spend stays separate."
      }
    };
    return tips[mode || "campaigns"] && tips[mode || "campaigns"][key] || label;
  }

  function sortableTh(label, key, state, mode) {
    var activeKey = mode === "products" ? state.productSortKey : state.sortKey;
    var activeDir = mode === "products" ? state.productSortDir : state.sortDir;
    var active = activeKey === key;
    var tip = headerTip(mode || "campaigns", key, label);
    return '<th class="campaign-col-' + esc(key) + '"><button type="button" class="campaign-sort-btn" data-tooltip="' + esc(tip) + '" aria-label="' + esc(label + ". " + tip) + '" data-sort-mode="' + esc(mode || "campaigns") + '" data-sort-key="' + esc(key) + '">' +
      '<span>' + esc(label) + '</span><em>' + (active ? (activeDir === "asc" ? "↑" : "↓") : "↕") + '</em>' +
    '</button></th>';
  }

  function renderObjectiveMix(items) {
    if (!items || !items.length) return '<div class="campaign-empty">No synced objective mix for spent campaigns yet.</div>';
    return items.slice(0, 8).map(function (item) {
      return '<div class="campaign-mix-row">' +
        '<span>' + esc(item.objective || "unknown") + '</span>' +
        '<strong>' + money(item.spendSar) + '</strong>' +
        '<em>' + fmt(item.campaignCount) + ' spent campaigns</em>' +
      '</div>';
    }).join("");
  }

  function renderSpendMatchHealth(intel) {
    var totals = intel && intel.totals || {};
    var matchedPct = Math.max(0, Math.min(100, Number(totals.matchedSpendPct || 0)));
    var unmatchedPct = Math.max(0, Math.min(100, Number(totals.unmatchedSpendPct || 0)));
    var note = totals.adSpendSar > 0
      ? (unmatchedPct > 0
        ? "Add SKU to campaign names to move unmatched spend into Product Actions."
        : "All spent campaigns are SKU-matched for product-level decisions.")
      : "Sync spent campaigns to unlock SKU-based Product Actions.";
    return '<div class="campaign-health-card">' +
      '<div class="campaign-health-top"><span>SKU match coverage</span><strong>' + percent(matchedPct) + '</strong></div>' +
      '<div class="campaign-match-bar" aria-label="SKU matched spend coverage">' +
        '<i class="campaign-match-bar-fill" style="width:' + esc(String(matchedPct)) + '%"></i>' +
      '</div>' +
      '<div class="campaign-health-legend">' +
        '<span><i class="matched"></i>SKU-matched</span>' +
        '<span><i class="unmatched"></i>Unmatched</span>' +
      '</div>' +
      '<div class="campaign-note">' + esc(note) + '</div>' +
      (unmatchedPct > 0 ? '<div class="campaign-health-foot"><span>Needs SKU</span><strong>' + percent(unmatchedPct) + '</strong></div>' : '') +
    '</div>';
  }

  function renderMediaBuyingSignals(intel) {
    intel = intel || {};
    var groups = Array.isArray(intel.allProductGroups) ? intel.allProductGroups : [];
    var scaleCount = groups.filter(function (group) { return group.decision === "scale"; }).length;
    var fixCount = groups.filter(function (group) { return group.decision === "fix_first"; }).length;
    var watchCount = groups.filter(function (group) { return group.decision === "watch"; }).length;
    var pauseCount = groups.filter(function (group) { return group.decision === "pause"; }).length;
    return '<div class="campaign-signal"><span>Scale ready</span><strong>' + fmt(scaleCount) + '</strong></div>' +
      '<div class="campaign-signal"><span>Fix first</span><strong>' + fmt(fixCount) + '</strong></div>' +
      '<div class="campaign-signal"><span>Watch / needs data</span><strong>' + fmt(watchCount) + '</strong></div>' +
      '<div class="campaign-signal"><span>Pause / reduce</span><strong>' + fmt(pauseCount) + '</strong></div>' +
      '<div class="campaign-signal"><span>Creative refresh</span><strong>' + fmt((intel.creativeSummary && intel.creativeSummary.fatigueCandidates || []).length) + '</strong></div>' +
      '<div class="campaign-note">Product Actions use campaign spend and clicks only when the campaign name contains an exact SKU. KHOD orders, NDR, commission, ROI, ROAS, and decisions come from dashboard orders.</div>';
  }

  function decisionLabel(decision) {
    return {
      scale: campaignPick("Scale", "توسّع"),
      fix_first: campaignPick("Fix First", "أصلح أولا"),
      pause: campaignPick("Pause", "أوقف مؤقتا"),
      watch: campaignPick("Needs Data", "يحتاج بيانات"),
      both: campaignPick("Scale + Fix", "توسّع + أصلح")
    }[decision] || String(decision || campaignPick("Review", "راجع"));
  }

  function decisionSummary(decision) {
    return {
      scale: campaignPick("All scale guardrails passed.", "اجتاز المنتج جميع شروط التوسع."),
      fix_first: campaignPick("Recoverable issues must improve before scaling.", "توجد مشكلات قابلة للإصلاح قبل التوسع."),
      pause: campaignPick("Critical risk requires reducing or pausing traffic.", "توجد مخاطرة حرجة تتطلب خفض أو إيقاف الزيارات."),
      watch: campaignPick("There is not enough evidence for a reliable decision yet.", "لا توجد بيانات كافية لاتخاذ قرار موثوق حتى الآن."),
      both: campaignPick("A controlled scaling opportunity exists, but a specific issue also needs correction.", "توجد فرصة توسع محدودة، مع وجود مشكلة محددة تحتاج إلى إصلاح.")
    }[decision] || campaignPick("Review the available evidence.", "راجع البيانات المتاحة.");
  }

  function decisionNextAction(decision) {
    return {
      scale: campaignPick("Increase budget in small steps. Stop if NDR falls or CPA rises above break-even.", "ارفع الميزانية بخطوات صغيرة، وتوقف إذا انخفض NDR أو تجاوزت CPA نقطة التعادل."),
      fix_first: campaignPick("Keep budget stable, improve the failed checks, then reassess before scaling.", "ثبّت الميزانية وحسّن المؤشرات الضعيفة ثم أعد التقييم قبل التوسع."),
      pause: campaignPick("Reduce or pause traffic, fix the critical risk, then reassess.", "خفّض أو أوقف الزيارات مؤقتا، أصلح الخطر الحرج، ثم أعد التقييم."),
      watch: campaignPick("Keep the test controlled until at least 15 orders, then reassess.", "استمر باختبار محدود حتى 15 طلبا على الأقل، ثم أعد التقييم."),
      both: campaignPick("Scale only the proven segment in small steps while correcting the failed checks elsewhere.", "وسّع الجزء المثبت فقط بخطوات صغيرة، وأصلح المؤشرات الضعيفة في الأجزاء الأخرى.")
    }[decision] || campaignPick("Review the product before changing spend.", "راجع المنتج قبل تغيير الإنفاق.");
  }

  function decisionCheckLabel(key) {
    return {
      orders: campaignPick("Order sample", "عينة الطلبات"),
      delivered: campaignPick("Delivered sample", "عينة التسليم"),
      ndr: "NDR",
      cpa: campaignPick("CPA vs break-even", "CPA مقابل نقطة التعادل"),
      net_profit: campaignPick("Net profit", "صافي الربح"),
      cancellation: campaignPick("Cancellation rate", "نسبة الإلغاء"),
      city_mix: campaignPick("City mix", "مزيج المدن")
    }[key] || key;
  }

  function decisionCheckValue(item) {
    var actual = item.actual;
    var target = item.target;
    if (item.key === "orders" || item.key === "delivered") return fmt(actual) + " / " + fmt(target) + "+";
    if (item.key === "ndr") return fmtDecimal(actual, 1) + "% / " + fmtDecimal(target, 0) + "%+";
    if (item.key === "cancellation") return fmtDecimal(actual, 1) + "% / <" + fmtDecimal(target, 0) + "%";
    if (item.key === "cpa") {
      if (!(Number(actual) > 0) || !(Number(target) > 0)) return campaignPick("Unavailable", "غير متوفر");
      return money(actual) + " / " + money(target);
    }
    if (item.key === "net_profit") return actual == null ? campaignPick("Unavailable", "غير متوفر") : signedMoney(actual);
    if (item.key === "city_mix") return fmt(actual) + " " + campaignPick("weak cities", "مدن ضعيفة");
    return String(actual == null ? "" : actual);
  }

  function renderDecisionChecks(title, items, tone) {
    if (!items || !items.length) return "";
    return '<div class="campaign-decision-tip-group ' + esc(tone) + '"><h5>' + esc(title) + '</h5>' +
      items.map(function (item) {
        return '<div class="campaign-decision-tip-check ' + esc(item.status || tone) + '"><span>' + esc(decisionCheckLabel(item.key)) + '</span><strong>' + esc(decisionCheckValue(item)) + '</strong></div>';
      }).join("") + '</div>';
  }

  function renderDecisionTooltip(group, periodLabel, templateId) {
    var metadata = group.decisionMetadata || {};
    var confidence = metadata.confidence || { level: "limited", label: "Limited evidence" };
    var confidenceLabel = {
      limited: campaignPick("Limited evidence", "بيانات محدودة"),
      developing: campaignPick("Developing evidence", "بيانات قيد الاكتمال"),
      strong: campaignPick("Strong evidence", "بيانات قوية")
    }[confidence.level] || confidence.label;
    var isRtl = window.dashboardI18n && typeof window.dashboardI18n.isRtl === "function"
      ? window.dashboardI18n.isRtl()
      : document.documentElement.dir === "rtl";
    return '<template id="' + esc(templateId) + '"><div class="campaign-decision-tooltip" dir="' + (isRtl ? "rtl" : "ltr") + '">' +
      '<div class="campaign-decision-tip-head ' + esc(group.decision) + '"><span>' + esc(decisionLabel(group.decision)) + '</span><strong>' + esc(decisionSummary(group.decision)) + '</strong></div>' +
      '<div class="campaign-decision-tip-meta"><span>' + esc(confidenceLabel) + '</span><span>' + fmt(group.campaignCount) + ' ' + esc(campaignPick("campaigns", "حملات")) + '</span></div>' +
      renderDecisionChecks(campaignPick("Passed", "مؤشرات ناجحة"), metadata.passedChecks, "passed") +
      renderDecisionChecks(campaignPick("Needs attention", "يحتاج انتباها"), metadata.failedChecks, "failed") +
      renderDecisionChecks(campaignPick("Context / warnings", "السياق / التحذيرات"), metadata.warnings, "warning") +
      '<div class="campaign-decision-tip-next"><span>' + esc(campaignPick("Next action", "الإجراء التالي")) + '</span><strong>' + esc(decisionNextAction(group.decision)) + '</strong></div>' +
      '<div class="campaign-decision-tip-foot"><span>' + esc(campaignPick("Product-level decision across exact-SKU matched campaigns.", "قرار على مستوى المنتج عبر الحملات المطابقة لرمز SKU بدقة.")) + '</span>' +
      '<span>' + esc(periodLabel || campaignPick("Current synced period", "فترة المزامنة الحالية")) + '</span></div>' +
    '</div></template>';
  }

  function renderProductRows(groups, periodLabel, currency) {
    currency = normalizeCampaignCurrency(currency || "SAR", "SAR");
    if (!groups.length) return '<tr><td colspan="14" class="campaign-empty">No SKU-confirmed product spend on this page.</td></tr>';
    return groups.map(function (group) {
      var cpaLabel = group.khodOrders > 0 ? money(group.khodCpa != null ? group.khodCpa : sarToCampaignCurrency(group.khodCpaSar || group.estimatedCpaSar, currency), currency) : "No KHOD orders";
      var deliveredCpaLabel = group.khodDelivered > 0 ? money(group.deliveredCpa != null ? group.deliveredCpa : sarToCampaignCurrency(group.deliveredCpaSar, currency), currency) : "No delivered orders";
      var productTitle = group.product || "";
      var displayDecision = decisionLabel(group.decision);
      var netAvailable = group.netProfitSar != null && Number.isFinite(Number(group.netProfitSar));
      var roiAvailable = group.spendSar > 0 && group.roiPct != null && Number.isFinite(Number(group.roiPct));
      var netState = financialState(group.netProfitSar, netAvailable);
      var roiState = financialState(group.roiPct, roiAvailable);
      var templateId = "campaign-decision-tip-" + (++campaignDecisionTipSeq);
      var decisionAria = displayDecision + ". " + decisionSummary(group.decision) + " " + decisionNextAction(group.decision);
      var trafficViewCount = Number(group.trafficViews || (Number(group.landingPageViews) > 0 ? group.landingPageViews : group.contentViews) || 0);
      var trafficViewLabel = trafficViewCount > 0 ? "landing/content views" : "views unavailable";
      var totalSales = group.totalSales != null ? group.totalSales : sarToCampaignCurrency(group.totalSalesSar || group.deliveredSales, currency);
      var totalSalesRoas = group.totalSalesRoas != null ? group.totalSalesRoas : group.deliveredSalesRoas;
      
      return '<tr>' +
        '<td class="campaign-cell-name" title="' + esc(productTitle) + '"><strong>' + esc(compactText(productTitle, 58)) + '</strong><small>SKU ' + esc(group.sku || "missing") + '</small></td>' +
        '<td class="campaign-num">' + money(group.spend != null ? group.spend : sarToCampaignCurrency(group.spendSar, currency), currency) + '</td>' +
        '<td class="campaign-num"><strong>' + fmt(group.clicks) + '</strong><small>' + fmt(group.campaignCount) + ' campaigns</small></td>' +
        '<td class="campaign-num"><strong>' + fmt(group.khodOrders) + '</strong><small>' + percent(group.realConversionRatePct) + ' conversion · ' + fmt(trafficViewCount) + ' ' + trafficViewLabel + '</small></td>' +
        '<td class="campaign-num"><strong>' + fmt(group.khodDelivered) + '</strong><small>' + percent(group.deliveredConversionRatePct) + ' delivered CVR</small></td>' +
        '<td class="campaign-num">' + esc(Number(group.khodNdrPct || 0).toFixed(1)) + '%</td>' +
        '<td class="campaign-num">' + cpaLabel + '</td>' +
        '<td class="campaign-num">' + deliveredCpaLabel + '</td>' +
        '<td class="campaign-num">' + money(group.breakEvenCpa != null ? group.breakEvenCpa : sarToCampaignCurrency(group.breakEvenCpaSar, currency), currency) + '</td>' +
        '<td class="campaign-num">' + money(group.commissionReporting != null ? group.commissionReporting : sarToCampaignCurrency(group.commission, currency), currency) + '</td>' +
        '<td class="campaign-num">' + money(group.avgCommission != null ? group.avgCommission : sarToCampaignCurrency(group.avgCommissionSar || group.avgDeliveredProfitSar, currency), currency) + '</td>' +
        '<td class="campaign-num campaign-financial-cell"><strong class="campaign-financial-' + netState + '">' + (netAvailable ? signedMoney(group.netProfit != null ? group.netProfit : sarToCampaignCurrency(group.netProfitSar, currency), currency) : esc(campaignPick("Unavailable", "غير متوفر"))) + '</strong><small class="campaign-financial-' + roiState + '">' + (roiAvailable ? percent(group.roiPct) + ' ROI' : esc(campaignPick("ROI unavailable", "العائد غير متوفر"))) + '</small></td>' +
        '<td class="campaign-num"><strong>' + roas(group.commissionRoas) + '</strong><small>' + money(totalSales, currency) + ' total sales · ' + roas(totalSalesRoas) + ' sales ROAS</small></td>' +
        '<td class="campaign-decision-cell"><button type="button" class="campaign-decision ' + esc(group.decision) + '" data-tooltip-template="' + esc(templateId) + '" aria-label="' + esc(decisionAria) + '">' + esc(displayDecision) + '</button>' +
        renderDecisionTooltip(group, periodLabel, templateId) + '</td>' +
      '</tr>';
    }).join("");
  }

  function campaignNativeMoney(value, currency) {
    return money(value, currency || "SAR");
  }

  function campaignNativeCpc(row) {
    var clicks = Number(row && row.clicks || 0);
    if (clicks > 0 && Number(row && row.rawSpend) > 0) return Number(row.rawSpend) / clicks;
    return sarToCampaignCurrency(row && row.cpcSar || 0, row && row.rawCurrency || "SAR");
  }

  function campaignNativeCpm(row) {
    var impressions = Number(row && row.impressions || 0);
    if (impressions > 0 && Number(row && row.rawSpend) > 0) return Number(row.rawSpend) / impressions * 1000;
    return sarToCampaignCurrency(row && row.cpmSar || 0, row && row.rawCurrency || "SAR");
  }

  function renderCampaignRows(rows) {
    if (!rows.length) return '<tr><td colspan="11" class="campaign-empty">No spent campaigns match the current filters.</td></tr>';
    return rows.map(function (row) {
      var matchText = row.attributionVerified ? row.product : (row.suggestedProduct ? "Needs SKU" : "Unmatched");
      var matchSub = row.attributionVerified
        ? ("SKU " + (row.productSku || ""))
        : (row.suggestedProduct ? compactText(row.suggestedProduct, 42) : "No KHOD product attribution");
      var campaignTitle = row.campaign || "";
      return '<tr>' +
        '<td class="campaign-cell-name campaign-cell-campaign" title="' + esc(campaignTitle) + '"><strong>' + esc(compactText(campaignTitle, 48)) + '</strong><small>' + esc(row.campaignId || row.note || "") + '</small></td>' +
        '<td>' + esc(row.platform || "") + '</td>' +
        '<td>' + esc(compactText(row.objective || "unknown", 18)) + '</td>' +
        '<td>' + esc(compactText(row.status || "unknown", 14)) + '</td>' +
        '<td class="campaign-num">' + campaignNativeMoney(row.rawSpend != null ? row.rawSpend : row.spendSar, row.rawCurrency || "SAR") + '</td>' +
        '<td class="campaign-num">' + fmt(row.impressions) + '</td>' +
        '<td class="campaign-num">' + fmt(row.clicks) + '</td>' +
        '<td class="campaign-num">' + percent(row.ctrPct) + '</td>' +
        '<td class="campaign-num"><strong>' + campaignNativeMoney(campaignNativeCpc(row), row.rawCurrency || "SAR") + '</strong><small>Platform CPC</small></td>' +
        '<td class="campaign-num">' + campaignNativeMoney(campaignNativeCpm(row), row.rawCurrency || "SAR") + '</td>' +
        '<td class="campaign-cell-match" title="' + esc(row.product || row.suggestedProduct || "") + '"><strong>' + esc(matchText) + '</strong><small>' + esc(matchSub) + '</small></td>' +
      '</tr>';
    }).join("");
  }

  function renderPager(prefix, page) {
    if (window.renderDashboardPagination) {
      return window.renderDashboardPagination({
        currentPage: page.page,
        totalPages: page.totalPages,
        totalItems: page.total,
        startItem: page.start,
        endItem: page.end,
        itemLabel: prefix === "products" ? "products" : "campaigns",
        pageButtonClass: "campaign-" + prefix + "-page",
        prevClass: "campaign-" + prefix + "-prev",
        nextClass: "campaign-" + prefix + "-next",
        className: "campaign-dashboard-pagination dash-pagination-compact",
        alwaysVisible: true
      });
    }
    return '<div class="campaign-pager"><span>' + fmt(page.start) + '-' + fmt(page.end) + ' of ' + fmt(page.total) + '</span></div>';
  }

  function pageSizeSelect(value) {
    return '<label class="campaign-field"><span>Show</span><select data-campaign-page-size>' +
      PAGE_SIZES.map(function (size) {
        return '<option value="' + size + '"' + (Number(value) === size ? " selected" : "") + '>' + size + '</option>';
      }).join("") +
    '</select></label>';
  }

  function campaignAiContext(intel) {
    var products = (intel.allProductGroups || []).slice().sort(function (a, b) {
      var priority = { pause: 4, fix_first: 3, both: 2, watch: 1, scale: 0 };
      return (priority[b.decision] || 0) - (priority[a.decision] || 0) ||
        Number(b.spendSar || 0) - Number(a.spendSar || 0);
    }).slice(0, 20);
    return {
      currency: intel.currency || intel.reportingCurrency || "SAR",
      sourceOfTruth: intel.sourceOfTruth,
      periodLabel: intel.periodLabel,
      lastSyncAt: intel.lastSyncAt || "",
      totals: intel.totals || {},
      productActions: products,
      topSpendCampaigns: (intel.allCampaigns || []).slice(0, 20),
      creativeSummary: intel.creativeSummary || {}
    };
  }



  function updateCampaignsUIOnly(mount, data, ctx, state, intel, options) {
    options = options || {};
    var allCampaigns = Array.isArray(intel.allCampaigns) ? intel.allCampaigns : [];
    var allProducts = Array.isArray(intel.allProductGroups) ? intel.allProductGroups : (intel.topProductGroups || []);

    // Campaigns filtering & sorting cache
    var filterKey = [state.search, state.matchFilter, state.objectiveFilter].join("\u0000");
    var sortKey = [state.sortKey, state.sortDir].join("\u0000");
    
    var filteredCampaigns;
    if (mount._cachedCampaignsFilterKey === filterKey && mount._cachedCampaignsIntel === intel && mount._cachedFilteredCampaigns) {
      filteredCampaigns = mount._cachedFilteredCampaigns;
    } else {
      filteredCampaigns = filterCampaignRows(allCampaigns, state);
      mount._cachedCampaignsFilterKey = filterKey;
      mount._cachedCampaignsIntel = intel;
      mount._cachedFilteredCampaigns = filteredCampaigns;
      mount._cachedCampaignsSortKey = null;
    }
    
    var sortedCampaigns;
    if (mount._cachedCampaignsSortKey === sortKey && mount._cachedSortedCampaigns) {
      sortedCampaigns = mount._cachedSortedCampaigns;
    } else {
      sortedCampaigns = sortRows(filteredCampaigns, state.sortKey, state.sortDir);
      mount._cachedCampaignsSortKey = sortKey;
      mount._cachedSortedCampaigns = sortedCampaigns;
    }
    var campaignPage = paginate(sortedCampaigns, state.campaignPage, state.pageSize);
    state.campaignPage = campaignPage.page;

    // Products filtering & sorting cache
    var productFilterKey = state.productSearch;
    var productSortKey = [state.productSortKey, state.productSortDir].join("\u0000");
    
    var filteredProducts;
    if (mount._cachedProductsFilterKey === productFilterKey && mount._cachedProductsIntel === intel && mount._cachedFilteredProducts) {
      filteredProducts = mount._cachedFilteredProducts;
    } else {
      var productSearchQuery = textKey(state.productSearch);
      if (productSearchQuery) {
        filteredProducts = allProducts.filter(function (p) {
          return p.searchHaystack ? p.searchHaystack.indexOf(productSearchQuery) !== -1 : (textKey(p.product).indexOf(productSearchQuery) !== -1 || textKey(p.sku).indexOf(productSearchQuery) !== -1);
        });
      } else {
        filteredProducts = allProducts;
      }
      mount._cachedProductsFilterKey = productFilterKey;
      mount._cachedProductsIntel = intel;
      mount._cachedFilteredProducts = filteredProducts;
      mount._cachedProductsSortKey = null;
    }
    
    var sortedProducts;
    if (mount._cachedProductsSortKey === productSortKey && mount._cachedSortedProducts) {
      sortedProducts = mount._cachedSortedProducts;
    } else {
      sortedProducts = sortRows(filteredProducts, state.productSortKey, state.productSortDir);
      mount._cachedProductsSortKey = productSortKey;
      mount._cachedSortedProducts = sortedProducts;
    }
    var productPage = paginate(sortedProducts, state.productPage, state.pageSize);
    state.productPage = productPage.page;

    var productTbody = mount.querySelector(".campaign-table-products tbody");
    if (productTbody) {
      productTbody.innerHTML = renderProductRows(productPage.rows, intel.periodLabel, intel.currency || intel.reportingCurrency || "SAR");
    }

    if (!options.skipCampaignRows) {
      var campaignTbody = mount.querySelector(".campaign-table-campaigns tbody");
      if (campaignTbody) {
        campaignTbody.innerHTML = renderCampaignRows(campaignPage.rows);
      }
    }

    var productPagerContainer = mount.querySelector('[data-pager-prefix="products"]');
    if (productPagerContainer) {
      productPagerContainer.innerHTML = renderPager("products", productPage);
    }

    if (!options.skipCampaignRows) {
      var campaignPagerContainer = mount.querySelector('[data-pager-prefix="campaigns"]');
      if (campaignPagerContainer) {
        campaignPagerContainer.innerHTML = renderPager("campaigns", campaignPage);
      }
    }

    mount.querySelectorAll(".campaign-sort-btn").forEach(function (button) {
      var mode = button.getAttribute("data-sort-mode") || "campaigns";
      var key = button.getAttribute("data-sort-key") || "spendSar";
      var activeKey = mode === "products" ? state.productSortKey : state.sortKey;
      var activeDir = mode === "products" ? state.productSortDir : state.sortDir;
      var em = button.querySelector("em");
      if (em) {
        em.textContent = activeKey === key ? (activeDir === "asc" ? "↑" : "↓") : "↕";
      }
    });
  }

  function renderMainCampaignsUI(mount, data, ctx, state, intel) {
    var allCampaigns = Array.isArray(intel.allCampaigns) ? intel.allCampaigns : [];
    if (mount._campaignDelegatedCleanup) {
      mount._campaignDelegatedCleanup();
      mount._campaignDelegatedCleanup = null;
    }
    mount._campaignIntel = intel;
    function activeIntel() {
      return mount._campaignIntel || intel;
    }
    
    var selectedPlatform = mount && mount._campaignPlatform || "all";
    var platformButtons = PLATFORMS.map(function (platform) {
      return '<button type="button" class="campaign-tab ' + (selectedPlatform === platform.id ? "active" : "") + '" data-campaign-platform="' + esc(platform.id) + '">' +
        esc(platform.label) +
      '</button>';
    }).join("");

    mount.innerHTML = '<section class="campaign-section">' +
      '<div class="campaign-head">' +
        '<div class="campaign-head-copy"><p>Campaign Intelligence</p><h2>Media Buying Brain</h2><span>' + esc(intel.sourceOfTruth) + '</span><small class="campaign-sync-time">Synced at ' + esc(formatSyncTime(intel.lastSyncAt)) + '</small></div>' +
        '<div class="campaign-tabs">' + platformButtons + '</div>' +
      '</div>' +
      '<div class="campaign-kpis">' +
        card("Spend", money(intel.totals.adSpend != null ? intel.totals.adSpend : sarToCampaignCurrency(intel.totals.adSpendSar, intel.currency || intel.reportingCurrency || "SAR"), intel.currency || intel.reportingCurrency || "SAR"), "Spent campaigns in this period", "wallet", "spend") +
        card("Matched spend", percent(intel.totals.matchedSpendPct), money(intel.totals.matchedSpend != null ? intel.totals.matchedSpend : sarToCampaignCurrency(intel.totals.matchedSpendSar, intel.currency || intel.reportingCurrency || "SAR"), intel.currency || intel.reportingCurrency || "SAR") + " exact SKU", "shieldHalved", "matched") +
        card("Unmatched spend", percent(intel.totals.unmatchedSpendPct), money(intel.totals.unmatchedSpend != null ? intel.totals.unmatchedSpend : sarToCampaignCurrency(intel.totals.unmatchedSpendSar, intel.currency || intel.reportingCurrency || "SAR"), intel.currency || intel.reportingCurrency || "SAR") + " needs SKU", "circleXmark", "unmatched") +
        card("KHOD orders", fmt(intel.totals.khodOrders), "From SKU-confirmed products", "package", "orders") +
        card("KHOD CPA", intel.totals.khodOrders > 0 ? money(intel.totals.khodCpa != null ? intel.totals.khodCpa : sarToCampaignCurrency(intel.totals.khodCpaSar, intel.currency || intel.reportingCurrency || "SAR"), intel.currency || intel.reportingCurrency || "SAR") : "No KHOD orders", "Spend / KHOD orders", "calculator", "cpa") +
        card("Net profit", signedMoney(intel.totals.netProfit != null ? intel.totals.netProfit : sarToCampaignCurrency(intel.totals.netProfitSar, intel.currency || intel.reportingCurrency || "SAR"), intel.currency || intel.reportingCurrency || "SAR"), "Earned commission - spend", "moneyBill", "profit", financialState(intel.totals.netProfitSar, true)) +
        card("ROI", intel.totals.matchedSpendSar > 0 ? percent(intel.totals.roiPct) : campaignPick("Unavailable", "غير متوفر"), "Net profit / spend", "trendingUp", "roi", financialState(intel.totals.roiPct, intel.totals.matchedSpendSar > 0)) +
        card("Commission ROAS", roas(intel.totals.commissionRoas), "Earned commission / spend", "pulse", "roas") +
      '</div>' +
      '<div class="campaign-grid">' +
        '<div class="campaign-panel campaign-panel-health"><h3>Spend Match Health</h3>' + renderSpendMatchHealth(intel) + '</div>' +
        '<div class="campaign-panel campaign-panel-signals"><h3>Media Buying Signals</h3>' + renderMediaBuyingSignals(intel) + '</div>' +
      '</div>' +
      '<div class="campaign-panel wide"><div class="campaign-panel-title"><div><h3>Product Actions</h3><span>SKU-confirmed products only. Financial columns use the shared calculator/product currency.</span></div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end"><div style="display:flex;align-items:center;gap:6px;padding:4px 7px;border-radius:10px;border:1px solid rgba(96,165,250,0.18);background:rgba(96,165,250,0.06);" title="Product Actions use the same shared calculator currency as Products and calculators. Raw campaign rows stay in the ad account currency."><span style="font-size:10px;color:rgba(255,255,255,0.42);font-weight:800;white-space:nowrap;text-transform:uppercase;letter-spacing:0.4px">Currency</span><div data-campaign-product-currency style="width:88px;min-width:88px"></div></div><button type="button" class="campaign-ai-chip" data-campaign-ai-review>' + icon("sparkles") + 'Analyze actions</button></div></div>' +
        '<div class="campaign-controls">' +
          '<label class="campaign-search"><span>' + icon("search") + '</span><input type="search" data-product-search placeholder="Search product or SKU" value="' + esc(state.productSearch || "") + '" /></label>' +
        '</div>' +
        '<div class="campaign-table-scroll"><table class="campaign-table campaign-table-products"><thead><tr>' +
          sortableTh("Product", "product", state, "products") +
          sortableTh("Spend", "spendSar", state, "products") +
          sortableTh("Clicks", "clicks", state, "products") +
          sortableTh("KHOD orders", "khodOrders", state, "products") +
          sortableTh("Delivered", "khodDelivered", state, "products") +
          sortableTh("NDR", "khodNdrPct", state, "products") +
          sortableTh("KHOD CPA", "khodCpaSar", state, "products") +
          sortableTh("Del. CPA", "deliveredCpaSar", state, "products") +
          sortableTh("Break-even", "breakEvenCpaSar", state, "products") +
          sortableTh("Commission", "commission", state, "products") +
          sortableTh("Average Commission", "avgCommissionSar", state, "products") +
          sortableTh("Net profit", "netProfitSar", state, "products") +
          sortableTh("ROAS", "commissionRoas", state, "products") +
          sortableTh("Decision", "decision", state, "products") +
        '</tr></thead><tbody></tbody></table></div>' +
        '<div class="campaign-pager-container" data-pager-prefix="products"></div>' +
      '</div>' +
      '<div class="campaign-panel wide"><div class="campaign-panel-title"><div><h3>Spent Campaigns</h3><span>Search campaign name, SKU, product, objective, status, or platform.</span></div>' + pageSizeSelect(state.pageSize) + '</div>' +
        '<div class="campaign-controls">' +
          '<label class="campaign-search"><span>' + icon("search") + '</span><input type="search" data-campaign-search placeholder="Search campaign or SKU" value="' + esc(state.search) + '" /></label>' +
          '<label class="campaign-field"><span>Match</span><select data-campaign-match-filter>' +
            '<option value="all"' + (state.matchFilter === "all" ? " selected" : "") + '>All</option>' +
            '<option value="matched"' + (state.matchFilter === "matched" ? " selected" : "") + '>Matched</option>' +
            '<option value="unmatched"' + (state.matchFilter === "unmatched" ? " selected" : "") + '>Unmatched</option>' +
          '</select></label>' +
          '<label class="campaign-field"><span>Objective</span><select data-campaign-objective-filter>' + objectiveOptions(allCampaigns, state.objectiveFilter) + '</select></label>' +
        '</div>' +
        '<div class="campaign-table-scroll"><table class="campaign-table campaign-table-campaigns"><thead><tr>' +
          sortableTh("Campaign", "campaign", state, "campaigns") +
          sortableTh("Platform", "platform", state, "campaigns") +
          sortableTh("Objective", "objective", state, "campaigns") +
          sortableTh("Status", "status", state, "campaigns") +
          sortableTh("Spend", "spendSar", state, "campaigns") +
          sortableTh("Impr.", "impressions", state, "campaigns") +
          sortableTh("Clicks", "clicks", state, "campaigns") +
          sortableTh("CTR", "ctrPct", state, "campaigns") +
          sortableTh("CPC", "cpcSar", state, "campaigns") +
          sortableTh("CPM", "cpmSar", state, "campaigns") +
          sortableTh("Match", "product", state, "campaigns") +
        '</tr></thead><tbody></tbody></table></div>' +
        '<div class="campaign-pager-container" data-pager-prefix="campaigns"></div>' +
      '</div>' +
    '</section>';

    function onCampaignClick(e) {
      var platformButton = e.target.closest("[data-campaign-platform]");
      if (platformButton) {
        mount._campaignPlatform = platformButton.getAttribute("data-campaign-platform") || "all";
        state.objectiveFilter = "all";
        state.matchFilter = "all";
        state.campaignPage = 1;
        state.productPage = 1;
        renderSectionCampaigns(mount, data, ctx);
        return;
      }

      var sortButton = e.target.closest("[data-sort-key]");
      if (sortButton) {
        var mode = sortButton.getAttribute("data-sort-mode") || "campaigns";
        var key = sortButton.getAttribute("data-sort-key") || "spendSar";
        if (mode === "products") {
          state.productSortDir = state.productSortKey === key && state.productSortDir === "desc" ? "asc" : "desc";
          state.productSortKey = key;
          state.productPage = 1;
        } else {
          state.sortDir = state.sortKey === key && state.sortDir === "desc" ? "asc" : "desc";
          state.sortKey = key;
          state.campaignPage = 1;
        }
        updateCampaignsUIOnly(mount, data, ctx, state, activeIntel());
        return;
      }

      var productPageButton = e.target.closest(".campaign-products-page");
      if (productPageButton) {
        state.productPage = Number(productPageButton.getAttribute("data-page")) || state.productPage;
        updateCampaignsUIOnly(mount, data, ctx, state, activeIntel());
        return;
      }
      if (e.target.closest(".campaign-products-prev")) {
        state.productPage -= 1;
        updateCampaignsUIOnly(mount, data, ctx, state, activeIntel());
        return;
      }
      if (e.target.closest(".campaign-products-next")) {
        state.productPage += 1;
        updateCampaignsUIOnly(mount, data, ctx, state, activeIntel());
        return;
      }

      var campaignPageButton = e.target.closest(".campaign-campaigns-page");
      if (campaignPageButton) {
        state.campaignPage = Number(campaignPageButton.getAttribute("data-page")) || state.campaignPage;
        updateCampaignsUIOnly(mount, data, ctx, state, activeIntel());
        return;
      }
      if (e.target.closest(".campaign-campaigns-prev")) {
        state.campaignPage -= 1;
        updateCampaignsUIOnly(mount, data, ctx, state, activeIntel());
        return;
      }
      if (e.target.closest(".campaign-campaigns-next")) {
        state.campaignPage += 1;
        updateCampaignsUIOnly(mount, data, ctx, state, activeIntel());
        return;
      }

      if (e.target.closest("[data-campaign-ai-review]")) {
        var context = campaignAiContext(activeIntel());
        if (window.KhodDashboardAi && typeof window.KhodDashboardAi.openCampaignReview === "function") {
          window.KhodDashboardAi.openCampaignReview({ context: context });
        } else if (window.KhodDashboardAi && typeof window.KhodDashboardAi.open === "function") {
          window.KhodDashboardAi.open();
        } else if (typeof window.openDashboardAI === "function") {
          window.openDashboardAI();
        }
      }
    }

    function onCampaignInput(e) {
      if (e.target.matches("[data-campaign-search]")) {
        state.search = e.target.value || "";
        state.campaignPage = 1;
        updateCampaignsUIOnly(mount, data, ctx, state, activeIntel());
      } else if (e.target.matches("[data-product-search]")) {
        state.productSearch = e.target.value || "";
        state.productPage = 1;
        updateCampaignsUIOnly(mount, data, ctx, state, activeIntel());
      }
    }

    function onCampaignChange(e) {
      if (e.target.matches("[data-campaign-page-size]")) {
        state.pageSize = Number(e.target.value) || 10;
        state.campaignPage = 1;
        state.productPage = 1;
        updateCampaignsUIOnly(mount, data, ctx, state, activeIntel());
      } else if (e.target.matches("[data-campaign-match-filter]")) {
        state.matchFilter = e.target.value || "all";
        state.campaignPage = 1;
        updateCampaignsUIOnly(mount, data, ctx, state, activeIntel());
      } else if (e.target.matches("[data-campaign-objective-filter]")) {
        state.objectiveFilter = e.target.value || "all";
        state.campaignPage = 1;
        updateCampaignsUIOnly(mount, data, ctx, state, activeIntel());
      } else if (e.target.matches(".campaign-currency-native")) {
        setCampaignProductCurrency(mount, data, ctx, e.target.value);
      }
    }

    mount.addEventListener("click", onCampaignClick);
    mount.addEventListener("input", onCampaignInput);
    mount.addEventListener("change", onCampaignChange);
    mount._campaignDelegatedCleanup = function () {
      mount.removeEventListener("click", onCampaignClick);
      mount.removeEventListener("input", onCampaignInput);
      mount.removeEventListener("change", onCampaignChange);
    };
    bindCampaignCurrencySelect(mount, data, ctx);

    mount._campaignRenderToken = Number(mount._campaignRenderToken || 0) + 1;
    updateCampaignsUIOnly(mount, data, ctx, state, activeIntel());
  }

  function buildCampaignIntelSnapshot(mount, data, ctx) {
    data = data || window.dashboardGeoData || {};
    ctx = ctx || {};
    var state = defaultState(mount);
    var accountId = campaignAccountId(data);
    var selectedPlatform = mount && mount._campaignPlatform || "all";
    var selectedState = stateForPlatform(accountId, selectedPlatform);
    var syncStamp = selectedState && (selectedState.lastSyncAt || selectedState.summary && selectedState.summary.lastSyncAt) || "";
    var roiSettings = campaignRoiSettings(accountId, data);
    var reportingCurrency = currentCampaignCurrency(accountId, data);
    var sharedCacheKey = campaignIntelCacheKey(data, accountId, selectedPlatform, syncStamp, reportingCurrency);
    
    var cacheHit = (
      mount._cachedData === data &&
      mount._cachedPlatform === selectedPlatform &&
      mount._cachedAccountId === accountId &&
      mount._cachedSyncStamp === syncStamp &&
      mount._cachedReportingCurrency === reportingCurrency &&      mount._cachedIntel
    );
    
    var intel;
    if (data && data._campaignBackendActive && data._campaignBackendIntel) {
      intel = data._campaignBackendIntel;
    } else if (cacheHit) {
      intel = mount._cachedIntel;
    } else if (campaignIntelCache.has(sharedCacheKey)) {
      intel = campaignIntelCache.get(sharedCacheKey);
    } else {
      intel = window.KhodCampaignIntelligence && typeof window.KhodCampaignIntelligence.build === "function"
        ? window.KhodCampaignIntelligence.build({
          data: data,
          marketingState: selectedPlatform === "all" ? null : Object.assign({ platform: selectedPlatform }, selectedState || {}),
          platform: selectedPlatform
        })
        : null;
      intel = intel || {
        totals: {},
        objectiveMix: [],
        allProductGroups: [],
        allCampaigns: [],
        creativeSummary: {},
        sourceOfTruth: "KHOD dashboard orders only."
      };
      rememberCampaignIntel(sharedCacheKey, intel);
    }

    mount._cachedData = data;
    mount._cachedPlatform = selectedPlatform;
    mount._cachedAccountId = accountId;
    mount._cachedSyncStamp = syncStamp;
    mount._cachedReportingCurrency = reportingCurrency;
    mount._cachedIntel = intel;
    mount._campaignIntel = intel;

    return {
      state: state,
      intel: intel,
      accountId: accountId
    };
  }

  function refreshCampaignCurrencyUIOnly(mount, data, ctx) {
    if (!mount || mount.isConnected === false) return;
    var snapshot = buildCampaignIntelSnapshot(mount, data, ctx);
    var intel = snapshot.intel;
    var state = snapshot.state;
    var kpis = mount.querySelector(".campaign-kpis");
    if (kpis) kpis.innerHTML = renderCampaignKpis(intel);
    var syncTime = mount.querySelector(".campaign-sync-time");
    if (syncTime) syncTime.textContent = "Synced at " + formatSyncTime(intel.lastSyncAt);
    bindCampaignCurrencySelect(mount, data, ctx);
    updateCampaignsUIOnly(mount, data, ctx, state, intel, { skipCampaignRows: true });
    if (window.dashboardI18n && typeof window.dashboardI18n.apply === "function") window.dashboardI18n.apply(mount);
    if (window.TaagerUI && typeof window.TaagerUI.enhance === "function") window.TaagerUI.enhance(mount);
  }

  function renderSectionCampaigns(mount, data, ctx) {
    var snapshot = buildCampaignIntelSnapshot(mount, data, ctx);
    data = data || window.dashboardGeoData || {};
    ctx = ctx || {};
    var state = snapshot.state;
    var intel = snapshot.intel;
    var accountId = snapshot.accountId;
    
    renderMainCampaignsUI(mount, data, ctx, state, intel);

    if (window.DashboardRoiState && typeof window.DashboardRoiState.subscribe === "function") {
      if (mount._campaignRoiListener) {
        window.DashboardRoiState.unsubscribe(mount._campaignRoiListener);
      }
      if (mount._campaignRoiObserver) {
        mount._campaignRoiObserver.disconnect();
      }
      mount._campaignRoiListener = function (settings) {
        if (String(settings && settings.accountId || "__all__") !== String(accountId || "__all__")) return;
        mount._cachedIntel = null;
        campaignIntelCache.clear();
        refreshCampaignCurrencyUIOnly(mount, data, ctx);
      };
      window.DashboardRoiState.subscribe(mount._campaignRoiListener);
      mount._campaignRoiObserver = new MutationObserver(function () {
        if (!document.body.contains(mount)) {
          if (mount._campaignDelegatedCleanup) {
            mount._campaignDelegatedCleanup();
            mount._campaignDelegatedCleanup = null;
          }
          window.DashboardRoiState.unsubscribe(mount._campaignRoiListener);
          mount._campaignRoiListener = null;
          mount._campaignRoiObserver.disconnect();
          mount._campaignRoiObserver = null;
        }
      });
      if (mount.parentNode) mount._campaignRoiObserver.observe(mount.parentNode, { childList: true });
    }
  }

  window.renderSectionCampaigns = renderSectionCampaigns;
})();
