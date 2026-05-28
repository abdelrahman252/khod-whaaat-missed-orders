// ─────────────────────────────────────────────────────────────────────────────
// section5-products.js  —  Task 5: أفضل المنتجات  (v7 — bug fixes + smooth animations)
//
// FIXES vs v6:
//  Fix 1  — Rank badges preserve original rank; ascending sort no longer re-numbers
//  Fix 2  — Dropdown z-index raised to 99999 so it floats above all rows
//  Fix 3  — renderProductPage() re-renders filter bar so pills show active state
//  Fix 4  — animateNumber() fully rewritten: easeOutExpo, 60fps rAF, no jank
// ─────────────────────────────────────────────────────────────────────────────

window.renderSection5 = function (mountEl, data, ctx) {
  const isAr = window.dashboardI18n ? window.dashboardI18n.currentLocale === 'ar' : true;
  function s5Txt(en, ar) { return isAr ? ar : en; }
  function tx(key) { var str = window.dashboardI18n ? window.dashboardI18n.t(key) : key; return str || key; }
  function p5Txt(key) { return tx('products.' + key); }

  if (!mountEl) return;

  var productCleanupTasks = [function () {
    mountEl._s5RenderToken = (mountEl._s5RenderToken || 0) + 1;
  }];
  function addProductCleanup(cleanup) {
    if (typeof cleanup === 'function') productCleanupTasks.push(cleanup);
  }
  mountEl._dashboardSectionCleanup = function () {
    productCleanupTasks.splice(0).forEach(function (fn) { fn(); });
  };

  const renderToken = (mountEl._s5RenderToken || 0) + 1;
  mountEl._s5RenderToken = renderToken;
  mountEl.innerHTML = `
    <div dir="${isAr ? 'rtl' : 'ltr'}" style="flex:1;display:flex;align-items:center;justify-content:center;background:#080b12;color:#fff;font-family:'Cairo',sans-serif;height:100%;min-height:420px">
      <div style="display:flex;flex-direction:column;align-items:center;gap:14px">
        <div style="width:42px;height:42px;border-radius:50%;border:3px solid rgba(245,158,11,0.18);border-top-color:#f59e0b;animation:s5Spin 0.8s linear infinite"></div>
        <div style="font-size:13px;font-weight:800;color:rgba(255,255,255,0.76)">${s5Txt("Preparing products...", "جاري تجهيز المنتجات...")}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.35)">${s5Txt("Loading only the current page for faster speed", "يتم تحميل الصفحة الحالية فقط لتحسين السرعة")}</div>
      </div>
      <style>@keyframes s5Spin{to{transform:rotate(360deg)}}</style>
    </div>`;

  setTimeout(function () {
    if (!mountEl.isConnected || mountEl._s5RenderToken !== renderToken) return;

  // ── Smooth number animation (replaces any global animateNumber) ───────────
  // Uses requestAnimationFrame + easeOutExpo so every frame increments by a
  // tiny step — you see 1, 2, 3, 4 … not 1, 50, 150, 400.
  function _animateNumber(el, target, opts) {
    if (!el) return;
    const duration = Math.min((opts && opts.duration) || 520, 700);
    const decimals = (opts && opts.decimals != null) ? opts.decimals : 0;
    const start    = performance.now();
    const from     = 0;
    const to       = Number(target) || 0;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || duration <= 16 || !document.body.contains(el)) {
      el.textContent = decimals > 0 ? to.toFixed(decimals) : Math.round(to).toLocaleString('en-US');
      return;
    }

    // easeOutExpo — fast start, smooth deceleration
    function ease(t) {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function tick(now) {
      if (!document.body.contains(el)) return;
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const value    = from + (to - from) * ease(progress);
      const nextText = decimals > 0
        ? value.toFixed(decimals)
        : Math.round(value).toLocaleString('en-US');
      if (el.textContent !== nextText) {
        el.textContent = nextText;
      }
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function attr(value) {
    return esc(value).replace(/`/g, '&#96;');
  }

  function setNumberText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = Math.round(Number(value) || 0).toLocaleString('en-US');
  }

  // ── data defaults ────────────────────────────────────────────────────────
  const pd = (data && data.products) ? data.products : null;

  const PRODUCTS_DEFAULT = [
    {
      rank: 1, name: 'كريم التفتيح المكثف', cat: 'SKU: N/A',
      deliveries: 34, sharePct: 36.2, revenue: 1428, delta: 18.4,
      spark: [700,850,950,1050,1180,1300,1428], sparkColor: '#00e676', accent: '#fbbf24',
      placedCount: 94, commission: 1428, deliveredCount: 34,
      totalPieces: 94, failedCount: 5, canceledCount: 20, confirmedCount: 10, shippingCount: 8, processingCount: 4,
      confirmationPct: 59.6, cancelPct: 21.3, ndrPct: 37.0, deliveryPct: 36.2,
      cityBreakdown: [{name:'الرياض',count:40},{name:'جدة',count:28},{name:'الدمام',count:16}],
      piecesBreakdown: [{qty:'1',count:60},{qty:'2',count:24},{qty:'3',count:10}],
    },
    {
      rank: 2, name: 'سيروم الكولاجين', cat: 'SKU: N/A',
      deliveries: 22, sharePct: 23.4, revenue: 924, delta: 15.7,
      spark: [500,590,660,730,800,870,924], sparkColor: '#a855f7', accent: '#a855f7',
      placedCount: 60, commission: 924, deliveredCount: 22,
      totalPieces: 60, failedCount: 7, canceledCount: 25, confirmedCount: 5, shippingCount: 4, processingCount: 3,
      confirmationPct: 56.7, cancelPct: 41.7, ndrPct: 53.2, deliveryPct: 36.7,
      cityBreakdown: [{name:'الرياض',count:24},{name:'مكة',count:18},{name:'المدينة',count:10}],
      piecesBreakdown: [{qty:'1',count:48},{qty:'2',count:12}],
    },
    {
      rank: 3, name: 'مجموعة العناية بالبشرة', cat: 'SKU: N/A',
      deliveries: 19, sharePct: 20.2, revenue: 798, delta: 12.1,
      spark: [600,660,700,730,755,775,798], sparkColor: '#14b8a6', accent: '#14b8a6',
      placedCount: 50, commission: 798, deliveredCount: 19,
      totalPieces: 50, failedCount: 3, canceledCount: 12, confirmedCount: 6, shippingCount: 5, processingCount: 4,
      confirmationPct: 68.0, cancelPct: 24.0, ndrPct: 38.7, deliveryPct: 38.0,
      cityBreakdown: [{name:'جدة',count:20},{name:'الرياض',count:16},{name:'الطائف',count:8}],
      piecesBreakdown: [{qty:'1',count:35},{qty:'2',count:12},{qty:'3',count:3}],
    },
  ];

  const STAT_CARDS_DEFAULT = [
    { label: s5Txt('Total Products Sold', 'إجمالي المنتجات المباعة'),    value: 0, unit: s5Txt('unique products', 'منتج مختلف'),  color: '#a855f7', iconType: 'grid'   },
    { label: s5Txt('Total Orders', 'إجمالي الطلبات المُسجلة'),    value: 0, unit: s5Txt('orders', 'طلب'),          color: '#14b8a6', iconType: 'box'    },
    { label: s5Txt('Total Pieces Sold', 'إجمالي القطع المُباعة'),       value: 0, unit: s5Txt('pieces', 'قطعة'),         color: '#3b82f6', iconType: 'pieces' },
    { label: s5Txt('Total Earned Commission', 'إجمالي العمولة المحققة'),      value: 0, unit: 'SAR',          color: '#f59e0b', iconType: 'coins'  },
    { label: s5Txt('Products generating 80% of commission', 'منتجات تحقق 80% من العمولة'), value: 1, unit: s5Txt('products only', 'منتجات فقط'),  color: '#ef4444', iconType: 'pie'    },
  ];

  const INSIGHTS_DEFAULT = [
    { emoji: '🏆', bg: 'rgba(0,230,118,0.12)',  border: 'rgba(0,230,118,0.28)', iconGlow: '#00e676', label: s5Txt('Best Commission Performance', 'أفضل أداء في العمولة'), value: '—', detail: 'جاري التحميل...', detailColor: '#fbbf24' },
    { emoji: '📊', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.28)', iconGlow: '#3b82f6', label: s5Txt('Highest Commission Concentration', 'أعلى تركيز للعمولة'),   value: s5Txt('Top 3 products', 'أول 3 منتجات'), detail: '—', detailColor: '#3b82f6' },
  ];

  let PRODUCTS_RAW = PRODUCTS_DEFAULT;
  let STAT_CARDS   = STAT_CARDS_DEFAULT;
  let INSIGHTS     = INSIGHTS_DEFAULT;
  const productAccountId = data && data.meta && data.meta.activeAccountId
    ? data.meta.activeAccountId
    : (window.getActiveAccountId ? window.getActiveAccountId() : '__all__');
  const roiFallback = (data && data.roi) || { adSpend: 0, currency: 'SAR', egpRate: 52 };
  let productFinancialSettings = window.DashboardRoiState
    ? window.DashboardRoiState.get(productAccountId, roiFallback)
    : roiFallback;
  let productMarketingState = window.DashboardMarketingState
    ? window.DashboardMarketingState.get(productAccountId)
    : null;
  let refreshProductModal = function () {};

  function selectedCurrency() {
    var currency = String(productFinancialSettings.currency || 'SAR').toUpperCase();
    return ['SAR', 'USD', 'EGP'].indexOf(currency) !== -1 ? currency : 'SAR';
  }

  function commissionInCurrency(sarValue) {
    var currency = selectedCurrency();
    var sar = Number(sarValue) || 0;
    if (currency === 'USD') return sar / 3.75;
    if (currency === 'EGP') return (sar / 3.75) * (Number(productFinancialSettings.egpRate) || 52);
    return sar;
  }

  function sarToSelectedCurrency(sarValue) {
    return commissionInCurrency(sarValue);
  }

  function productMoney(value) {
    var n = Number(value) || 0;
    return n.toLocaleString(isAr ? 'ar-EG-u-nu-latn' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' ' + selectedCurrency();
  }

  function textKey(value) {
    var arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    return String(value || '').toLowerCase().normalize('NFKC')
      .replace(/[٠-٩]/g, function (digit) { return String(arabicDigits.indexOf(digit)); })
      .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
      .replace(/\u0640/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/[ىئ]/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/[ةه]/g, 'ه')
      .replace(/[^\w\u0600-\u06ff]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function validSku(product) {
    var sku = textKey(product && product.sku || '');
    return sku && sku !== 'n a' && sku !== 'na' ? sku : '';
  }

  function hasTerm(text, term) {
    return !!term && (' ' + text + ' ').indexOf(' ' + term + ' ') !== -1;
  }

  function productTokens(name) {
    var stop = {
      ad: true, ads: true, campaign: true, tiktok: true, tik: true, tok: true,
      ksa: true, saudi: true, sale: true, offer: true, new: true, test: true,
      flying: true, original: true, product: true,
      منتج: true, عرض: true, جديد: true, اصلي: true, جهاز: true,
      بعد: true, تعمل: true, يعمل: true, عدد: true, قطعه: true, حبه: true
    };
    return textKey(name).split(' ').filter(function (token) {
      return token.length >= 3 && !stop[token] && !/^x\d+$/i.test(token) && !/^\d+$/.test(token);
    });
  }

  function productPhrases(tokens) {
    var phrases = [];
    for (var size = 2; size <= Math.min(3, tokens.length); size++) {
      for (var start = 0; start <= tokens.length - size; start++) {
        phrases.push(tokens.slice(start, start + size).join(' '));
      }
    }
    return phrases;
  }

  function campaignSpendToSar(row) {
    var amount = Number(row && row.rawSpend || row && row.convertedSpend || 0);
    var currency = String(row && row.currency || 'SAR').toUpperCase();
    if (currency === 'USD') return amount * 3.75;
    if (currency === 'EGP') return (amount / (Number(productFinancialSettings.egpRate) || 52)) * 3.75;
    return amount;
  }

  function buildCampaignAssignments(campaignRows) {
    var productMatchKeys = PRODUCTS_RAW.map(function (product, idx) {
      var tokens = productTokens(product.name || '');
      return { idx: idx, sku: validSku(product), tokens: tokens, phrases: productPhrases(tokens) };
    });
    var tokenOwners = {};
    var phraseOwners = {};
    productMatchKeys.forEach(function (product) {
      product.tokens.forEach(function (token) {
        tokenOwners[token] = (tokenOwners[token] || 0) + 1;
      });
      product.phrases.forEach(function (phrase) {
        phraseOwners[phrase] = (phraseOwners[phrase] || 0) + 1;
      });
    });
    function nameMatchScore(campaignText, product) {
      var hits = product.tokens.filter(function (token) { return hasTerm(campaignText, token); });
      var phraseHits = product.phrases.filter(function (phrase) { return hasTerm(campaignText, phrase); });
      var uniqueWordHit = hits.some(function (token) { return token.length >= 4 && tokenOwners[token] === 1; });
      var uniquePhraseHit = phraseHits.some(function (phrase) { return phraseOwners[phrase] === 1; });
      if (hits.length < Math.min(2, product.tokens.length) && !uniqueWordHit && !uniquePhraseHit) return 0;
      var score = hits.reduce(function (total, token) {
        return total + token.length + (tokenOwners[token] === 1 ? 6 : 0);
      }, 0);
      return score + phraseHits.reduce(function (total, phrase) {
        return total + phrase.length + (phraseOwners[phrase] === 1 ? 12 : 0);
      }, 0);
    }
    var assignments = {};
    (campaignRows || []).forEach(function (row) {
      var campaignText = textKey(row && row.campaign || '');
      if (!campaignText) return;
      var skuCandidates = productMatchKeys.filter(function (product) {
        return product.sku && hasTerm(campaignText, product.sku);
      }).sort(function (a, b) { return b.sku.length - a.sku.length; });
      var best = skuCandidates.length ? { idx: skuCandidates[0].idx, method: 'sku' } : null;
      if (!best) {
        var nameCandidates = productMatchKeys.map(function (product) {
          return { idx: product.idx, score: nameMatchScore(campaignText, product) };
        }).filter(function (candidate) { return candidate.score > 0; })
          .sort(function (a, b) { return b.score - a.score; });
        if (nameCandidates.length && (!nameCandidates[1] || nameCandidates[0].score > nameCandidates[1].score)) {
          best = { idx: nameCandidates[0].idx, method: 'name' };
        }
      }
      if (!best) return;
      if (!assignments[best.idx]) assignments[best.idx] = { spendSar: 0, methods: {}, rowCount: 0 };
      assignments[best.idx].spendSar += campaignSpendToSar(row);
      assignments[best.idx].methods[best.method] = true;
      assignments[best.idx].rowCount++;
    });
    return assignments;
  }

  function applyProductFinancials() {
    var totalPlaced = PRODUCTS_RAW.reduce(function (sum, p) { return sum + (Number(p.placedCount) || 0); }, 0);
    var budget = Math.max(0, Number(productFinancialSettings.adSpend) || 0);
    var marketingSummary = productMarketingState && productMarketingState.summary || null;
    var campaignRows = marketingSummary && Array.isArray(marketingSummary.campaignBreakdown)
      ? marketingSummary.campaignBreakdown
      : [];
    var hasSyncedProductSpend = !!(campaignRows && campaignRows.length);
    var campaignAssignments = hasSyncedProductSpend ? buildCampaignAssignments(campaignRows) : {};
    PRODUCTS_RAW.forEach(function (p, idx) {
      var placed = Number(p.placedCount) || 0;
      var synced = campaignAssignments[idx];
      p.syncedAdSpend = !!synced;
      p.syncMatchMethod = synced
        ? (synced.methods.sku && synced.methods.name ? 'sku+name' : (synced.methods.sku ? 'sku' : 'name'))
        : '';
      p.syncMatchedRows = synced ? synced.rowCount : 0;
      p.allocatedAdSpend = hasSyncedProductSpend
        ? (synced ? sarToSelectedCurrency(Number(synced.spendSar.toFixed(2))) : 0)
        : (totalPlaced > 0 ? budget * placed / totalPlaced : 0);
      p.cpa = placed > 0 ? p.allocatedAdSpend / placed : 0;
      p.profitLoss = commissionInCurrency(p.commission) - p.allocatedAdSpend;
      p.financialCurrency = selectedCurrency();
    });
  }

  // ── Build real data ───────────────────────────────────────────────────────
  if (pd && (!pd.rankedList || pd.rankedList.length === 0)) {
    PRODUCTS_RAW = [];
    STAT_CARDS = [
      { label: s5Txt('Total Products Sold', 'إجمالي المنتجات المباعة'),    value: (pd.summary && pd.summary.uniqueProducts) || 0, unit: s5Txt('unique products', 'منتج مختلف'), color: '#a855f7', iconType: 'grid'   },
      { label: s5Txt('Total Orders', 'إجمالي الطلبات المُسجلة'),    value: (pd.summary && pd.summary.totalOrders)    || 0, unit: s5Txt('orders', 'طلب'),        color: '#14b8a6', iconType: 'box'    },
      { label: s5Txt('Total Pieces Sold', 'إجمالي القطع المُباعة'),       value: (pd.summary && pd.summary.totalPieces)    || 0, unit: s5Txt('pieces', 'قطعة'),       color: '#3b82f6', iconType: 'pieces' },
      { label: s5Txt('Total Earned Commission', 'إجمالي العمولة المحققة'),      value: (pd.summary && pd.summary.totalComm)      || 0, unit: 'SAR',        color: '#f59e0b', iconType: 'coins'  },
      { label: s5Txt('Products generating 80% of commission', 'منتجات تحقق 80% من العمولة'), value: 0,                                               unit: s5Txt('product', 'منتج'),       color: '#ef4444', iconType: 'pie'    },
    ];
    INSIGHTS = [];
  } else if (pd && pd.rankedList && pd.rankedList.length > 0) {
    const totalDeliveries = pd.rankedList.reduce((acc, x) => acc + (x.deliveredCount || x.units || 0), 0) || 1;

    PRODUCTS_RAW = pd.rankedList.map((p, idx) => {
      const rank       = p.rank || (idx + 1);
      const units      = p.deliveredCount || p.units || 0;
      const commission = p.commission || 0;
      const sharePct   = parseFloat(((units / totalDeliveries) * 100).toFixed(1));

      const spark = [];
      for (let j = 0; j < 7; j++) {
        const factor = 0.4 + (j / 6) * 0.6;
        const noise  = 1 + (Math.sin(j + units) * 0.05);
        spark.push(Math.round(commission * factor * noise));
      }
      spark[6] = commission;

      const rankIdx = Math.min(rank - 1, 4);
      const styleCfg = [
        { sparkColor:'#00e676', accent:'#fbbf24' },
        { sparkColor:'#a855f7', accent:'#a855f7' },
        { sparkColor:'#14b8a6', accent:'#14b8a6' },
        { sparkColor:'#a855f7', accent:'#8892a4' },
        { sparkColor:'#7c3aed', accent:'#8892a4' },
      ][rankIdx];

      const productKey = p.key || p.sku || p.name || `product-${idx}`;

      return {
        key: productKey, sku: p.sku || '', rank, name: p.name || 'منتج غير معروف', cat: `SKU: ${p.sku || 'N/A'}`,
        deliveries: units, placedCount: p.placedCount || 0, pieces: p.pieces || p.qty || 0,
        sharePct, revenue: commission, delta: Number(p.delta || 0), spark, ...styleCfg,
        commission, deliveredCount: units,
        totalPieces:     p.totalPieces     || p.qty || 0,
        failedCount:     p.failedCount     || 0,
        canceledCount:   p.canceledCount   || 0,
        confirmedCount:  p.confirmedCount  || 0,
        shippingCount:   p.shippingCount   || 0,
        processingCount: p.processingCount || 0,
        confirmationPct: p.confirmationPct || 0,
        cancelPct:       p.cancelPct       || 0,
        ndrPct:          p.ndrPct          || 0,
        drRate:          p.drRate          || 0,
        deliveryPct:     p.deliveryPct     || p.deliveryRate || 0,
        cityBreakdown:   p.cityBreakdown   || [],
        piecesBreakdown: p.piecesBreakdown || [],
        quantityCityBreakdown: p.quantityCityBreakdown || [],
      };
    });

    const sortedByComm = [...PRODUCTS_RAW].sort((a, b) => b.revenue - a.revenue);
    const target80 = (pd.summary.totalComm || 0) * 0.8;
    let runningSum = 0, count80 = 0;
    for (const p of sortedByComm) {
      runningSum += p.revenue; count80++;
      if (runningSum >= target80) break;
    }
    if (count80 === 0) count80 = 1;

    STAT_CARDS = [
      { label: s5Txt('Total Products Sold', 'إجمالي المنتجات المباعة'),    value: pd.summary.uniqueProducts || 0,  unit: s5Txt('unique products', 'منتج مختلف'),  color: '#a855f7', iconType: 'grid'   },
      { label: s5Txt('Total Orders', 'إجمالي الطلبات المُسجلة'),    value: pd.summary.totalOrders    || 0,  unit: s5Txt('orders', 'طلب'),          color: '#14b8a6', iconType: 'box'    },
      { label: s5Txt('Total Pieces Sold', 'إجمالي القطع المُباعة'),       value: pd.summary.totalPieces    || 0,  unit: s5Txt('pieces', 'قطعة'),         color: '#3b82f6', iconType: 'pieces' },
      { label: s5Txt('Total Earned Commission', 'إجمالي العمولة المحققة'),      value: pd.summary.totalComm      || 0,  unit: 'SAR',          color: '#f59e0b', iconType: 'coins'  },
      { label: s5Txt('Products generating 80% of commission', 'منتجات تحقق 80% من العمولة'), value: count80,                         unit: s5Txt('products only', 'منتجات فقط'),  color: '#ef4444', iconType: 'pie'    },
    ];

    INSIGHTS = buildInsights(PRODUCTS_RAW);
  }

  applyProductFinancials();

  const PRODUCT_BY_KEY = {};
  PRODUCTS_RAW.forEach((p, idx) => {
    const key = p.key || p.sku || p.name || idx;
    PRODUCT_BY_KEY[key] = p;
  });

  // ── T8: Smart Insights ───────────────────────────────────────────────────
  function buildInsights(products) {
    if (!products || !products.length) return [];
    const insights = [];

    const worstCancel = products.reduce((prev, cur) => cur.cancelPct > prev.cancelPct ? cur : prev, products[0]);
    if (worstCancel && worstCancel.cancelPct >= 40) {
      insights.push({ emoji:'🔴', bg:'rgba(239,68,68,0.12)', border:'rgba(239,68,68,0.28)', iconGlow:'#ef4444',
        label:s5Txt('Warning: High Cancel Rate', 'تحذير: نسبة إلغاء عالية'), value: worstCancel.name,
        detail: worstCancel.cancelPct + s5Txt('% canceled — consider pausing', '٪ إلغاء — فكر في إيقافه مؤقتاً'), detailColor:'#ef4444' });
    }

    const bestDelivery = products.reduce((prev, cur) => (cur.drRate || 0) > (prev.drRate || 0) ? cur : prev, products[0]);
    if (bestDelivery) {
      insights.push({ emoji:'🏆', bg:'rgba(0,230,118,0.12)', border:'rgba(0,230,118,0.28)', iconGlow:'#00e676',
        label:s5Txt('Best Delivery Rate', 'أفضل نسبة تسليم'), value: bestDelivery.name,
        detail: (bestDelivery.drRate || 0) + s5Txt('% delivered — scalable', '٪ تسليم — قابل للتوسع'), detailColor:'#00e676' });
    }

    const worstNdr = products.reduce((prev, cur) => cur.ndrPct < prev.ndrPct ? cur : prev, products[0]);
    if (worstNdr && worstNdr.ndrPct <= 45) {
      insights.push({ emoji:'🚚', bg:'rgba(249,115,22,0.12)', border:'rgba(249,115,22,0.28)', iconGlow:'#f97316',
        label:s5Txt('Potential Shipping Issue', 'مشكلة شحن محتملة'), value: worstNdr.name,
        detail: 'NDR ' + worstNdr.ndrPct + s5Txt('% — check responsible company', '٪ — تحقق من الشركة المسؤولة'), detailColor:'#f97316' });
    }

    const bestScale = products.reduce((prev, cur) => {
      const scoreA = (cur.commission * (cur.drRate || 0)) / 100;
      const scoreB = (prev.commission * (prev.drRate || 0)) / 100;
      return scoreA > scoreB ? cur : prev;
    }, products[0]);
    if (bestScale) {
      insights.push({ emoji:'⭐', bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.28)', iconGlow:'#f59e0b',
        label:s5Txt('Best Product for Scaling', 'أفضل منتج للتوسع'), value: bestScale.name,
        detail: s5Txt('Commission ', 'عمولة ') + (bestScale.commission || 0).toLocaleString('en-US') + ' SAR × ' + (bestScale.drRate || 0) + s5Txt('% delivery', '٪ تسليم'),
        detailColor:'#f59e0b' });
    }

    if (insights.length === 0) {
      const topComm = products.reduce((prev, cur) => cur.revenue > prev.revenue ? cur : prev, products[0]);
      insights.push({ emoji:'🏆', bg:'rgba(0,230,118,0.12)', border:'rgba(0,230,118,0.28)', iconGlow:'#00e676',
        label:s5Txt('Best Commission Performance', 'أفضل أداء في العمولة'), value: topComm.name,
        detail: (topComm.revenue||0).toLocaleString('en-US') + ' SAR', detailColor:'#fbbf24' });
    }
    return insights;
  }

  // ── State ────────────────────────────────────────────────────────────────
  let filterState = { search: '', statusKey: 'all' };
  let sortState   = { field: 'deliveredCount', dir: 'desc' };
  let viewMode    = 'expanded';
  let isFirstMount = true;
  let listCacheKey = '';
  let listCache = null;
  let _sortMenuCleanup = null;

  const STATUS_PILLS = [
    { key:'all',        label: s5Txt('All', 'الكل'),          color:'#fff'     },
    { key:'delivered',  label: s5Txt('Delivered', 'مُسلَّمة'),       color:'#00e676'  },
    { key:'failed',     label: p5Txt('failedOrders'), color:'#f97316' },
    { key:'canceled',   label: p5Txt('canceledOrders'), color:'#ef4444'  },
    { key:'shipping',   label: s5Txt('In Shipping', 'في الشحن'),       color:'#14b8a6'  },
    { key:'processing', label: s5Txt('Processing', 'قيد المعالجة'),   color:'#3b82f6'  },
  ];

  // ── FIX 1: applyFilters — NEVER re-assigns rank ───────────────────────────
  function applyFilters() {
    const cacheKey = [
      PRODUCTS_RAW.length,
      filterState.search,
      filterState.statusKey,
      sortState.field,
      sortState.dir
    ].join('|');
    if (listCache && listCacheKey === cacheKey) return listCache;

    let list = PRODUCTS_RAW.slice();

    if (filterState.search) {
      const q = filterState.search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.cat && p.cat.toLowerCase().includes(q)));
    }

    if (filterState.statusKey !== 'all') {
      list = list.filter(p => {
        if (filterState.statusKey === 'delivered')  return p.deliveredCount > 0;
        if (filterState.statusKey === 'failed')     return p.failedCount    > 0;
        if (filterState.statusKey === 'canceled')   return p.canceledCount  > 0;
        if (filterState.statusKey === 'shipping')   return p.shippingCount  > 0;
        if (filterState.statusKey === 'processing') return p.processingCount > 0;
        return true;
      });
    }

    list.sort((a, b) => {
      if (sortState.field === 'default') {
        return (a.rank || 0) - (b.rank || 0);
      }
      const dir = sortState.dir === 'desc' ? 1 : -1;
      const primary = dir * ((b[sortState.field] || 0) - (a[sortState.field] || 0));
      if (primary !== 0) return primary;
      const byPlaced = (b.placedCount || 0) - (a.placedCount || 0);
      if (byPlaced !== 0) return byPlaced;
      const byCanceled = (b.canceledCount || 0) - (a.canceledCount || 0);
      if (byCanceled !== 0) return byCanceled;
      return (b.commission || 0) - (a.commission || 0);
    });

    // FIX 1: preserve the original rank from PRODUCTS_RAW — do NOT re-number
    listCacheKey = cacheKey;
    listCache = list;
    return listCache;
  }

  const PAGE_SIZE = 10;
  let currentPage = 1;

  function currentList()       { return applyFilters(); }
  function totalProductPages() { return Math.max(1, Math.ceil(currentList().length / PAGE_SIZE)); }
  function pagedProducts() {
    const list  = currentList();
    const start = (currentPage - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }

  // ── Health row styling ────────────────────────────────────────────────────
  function healthRowStyle(p) {
    if (p.deliveredCount === 0) {
      return { border: 'rgba(255,255,255,0.05)', shadow: 'none', bg: 'rgba(255,255,255,0.012)', opacity: '0.45' };
    }
    if (p.rank <= 3) {
      const rankColors = [
        { border:'rgba(251,191,36,0.2)',  shadow:'0 0 0 1px rgba(251,191,36,0.12), 0 2px 20px rgba(251,191,36,0.08)', bg:'linear-gradient(to left, rgba(251,191,36,0.05), rgba(251,191,36,0.01) 60%, transparent)' },
        { border:'rgba(168,85,247,0.2)',  shadow:'0 0 0 1px rgba(168,85,247,0.12), 0 2px 16px rgba(168,85,247,0.07)', bg:'linear-gradient(to left, rgba(168,85,247,0.04), transparent 60%)' },
        { border:'rgba(20,184,166,0.18)', shadow:'0 0 0 1px rgba(20,184,166,0.10), 0 2px 14px rgba(20,184,166,0.06)', bg:'linear-gradient(to left, rgba(20,184,166,0.04), transparent 60%)' },
      ];
      return Object.assign({}, rankColors[p.rank - 1], { opacity: '1' });
    }
    if (p.placedCount >= 5) {
      if ((p.drRate || 0) >= 30)  return { border:'rgba(0,230,118,0.2)',  shadow:'0 0 0 1px rgba(0,230,118,0.12), 0 2px 12px rgba(0,230,118,0.06)',  bg:'linear-gradient(to left, rgba(0,230,118,0.03), transparent 60%)',  opacity:'1' };
      if (p.cancelPct  >= 40)  return { border:'rgba(239,68,68,0.2)',   shadow:'0 0 0 1px rgba(239,68,68,0.10), 0 2px 12px rgba(239,68,68,0.06)',   bg:'linear-gradient(to left, rgba(239,68,68,0.03), transparent 60%)',   opacity:'1' };
      if (p.ndrPct     <= 45)  return { border:'rgba(249,115,22,0.2)',  shadow:'0 0 0 1px rgba(249,115,22,0.10), 0 2px 12px rgba(249,115,22,0.06)', bg:'linear-gradient(to left, rgba(249,115,22,0.03), transparent 60%)',  opacity:'1' };
    }
    return { border:'rgba(255,255,255,0.07)', shadow:'none', bg:'rgba(255,255,255,0.018)', opacity:'1' };
  }

  // ── Rank badge ───────────────────────────────────────────────────────────
  const RANK_CFG = [
    { bg:'linear-gradient(135deg,#fcd34d,#d97706)', shadow:'0 0 10px rgba(251,191,36,0.6)',  color:'#1c1400' },
    { bg:'linear-gradient(135deg,#9ca3af,#6b7280)', shadow:'0 0 8px rgba(156,163,175,0.4)',  color:'#fff'    },
    { bg:'linear-gradient(135deg,#fb923c,#b45309)', shadow:'0 0 8px rgba(251,146,60,0.4)',   color:'#fff'    },
    { bg:'rgba(255,255,255,0.07)',                   shadow:'none',                            color:'rgba(255,255,255,0.4)' },
  ];
  function rankBadgeHTML(rank, deliveredCount) {
    const hasDeliveries = (deliveredCount || 0) > 0;
    if (!hasDeliveries) {
      return `<div style="width:32px;height:32px;border-radius:50%;flex-shrink:0;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.25);font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center">${rank}</div>`;
    }
    const cfg = (rank <= 3) ? RANK_CFG[rank - 1] : RANK_CFG[3];
    return `<div style="width:32px;height:32px;border-radius:50%;flex-shrink:0;background:${cfg.bg};box-shadow:${cfg.shadow};color:${cfg.color};font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center">${rank}</div>`;
  }

  // ── Stat card icons ──────────────────────────────────────────────────────
  function statIconHTML(type, color) {
    if (type === 'grid')   return `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" style="display:block"><rect x="1" y="1" width="8" height="8" rx="2" fill="${color}"/><rect x="13" y="1" width="8" height="8" rx="2" fill="${color}" opacity="0.8"/><rect x="1" y="13" width="8" height="8" rx="2" fill="${color}" opacity="0.8"/><rect x="13" y="13" width="8" height="8" rx="2" fill="${color}" opacity="0.6"/></svg>`;
    if (type === 'box')    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="display:block"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="${color}"/><path d="M2 17l10 5 10-5" stroke="${color}" stroke-width="1.8" fill="none" opacity="0.7"/><path d="M2 12l10 5 10-5" stroke="${color}" stroke-width="1.8" fill="none" opacity="0.85"/></svg>`;
    if (type === 'pieces') return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="display:block"><rect x="2" y="7" width="6" height="10" rx="1" fill="${color}"/><rect x="9" y="4" width="6" height="13" rx="1" fill="${color}" opacity="0.8"/><rect x="16" y="9" width="6" height="8" rx="1" fill="${color}" opacity="0.6"/></svg>`;
    if (type === 'coins')  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="display:block"><ellipse cx="12" cy="18" rx="7" ry="2.5" fill="${color}" opacity="0.4"/><ellipse cx="12" cy="15" rx="7" ry="2.5" fill="${color}" opacity="0.6"/><ellipse cx="12" cy="12" rx="7" ry="2.5" fill="${color}" opacity="0.8"/><ellipse cx="12" cy="9" rx="7" ry="2.5" fill="${color}"/><path d="M5 9v9M19 9v9" stroke="${color}" stroke-width="0.8" opacity="0.5"/></svg>`;
    if (type === 'pie')    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="display:block"><circle cx="12" cy="12" r="9" stroke="${color}" stroke-width="1.5" opacity="0.3"/><path d="M12 3 A9 9 0 0 1 21 12 L12 12 Z" fill="${color}"/><path d="M12 12 L21 12 A9 9 0 0 1 12 21 Z" fill="${color}" opacity="0.55"/><path d="M12 12 L12 21 A9 9 0 0 1 3 12 Z" fill="${color}" opacity="0.3"/></svg>`;
    return '';
  }

  // ── Rate badge ────────────────────────────────────────────────────────────
  function rateBadgeHTML(value, type) {
    let color;
    if      (type === 'delivery')     color = value >= 30 ? '#00e676' : value >= 20 ? '#f59e0b' : '#ef4444';
    else if (type === 'cancel')       color = value >= 40 ? '#ef4444' : value >= 30 ? '#f59e0b' : '#8892a4';
    else if (type === 'ndr')          color = value >= 75 ? '#00e676' : value >= 55 ? '#f59e0b' : '#f97316';
    else if (type === 'confirmation') color = value >= 65 ? '#00e676' : value >= 50 ? '#f59e0b' : '#ef4444';
    else color = '#8892a4';

    const capped = Math.min(Math.max(value, 0), 100);

    return `<div style="font-size:18px;font-weight:900;color:${color};line-height:1;text-align:center">${value}٪</div>
<div style="width:100%;height:3px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;margin-top:6px">
  <div class="s5-rate-bar" data-target="${capped}" style="height:100%;width:100%;transform:scaleX(0);transform-origin:${isAr ? 'right' : 'left'};background:${color};border-radius:2px;transition:transform 0.75s cubic-bezier(0.4,0,0.2,1);will-change:transform"></div>
</div>`;
  }

  // ── Funnel panel content ─────────────────────────────────────────────────
  function funnelHTML(p) {
    const total = p.placedCount || 1;
    const stages = [
      { label:s5Txt('Total Orders', s5Txt('Total Orders', 'إجمالي الطلبات')), count: p.placedCount,    color:'#fff',    pct: 100 },
      { label:s5Txt('Confirmed', 'مؤكدة'),          count: p.confirmedCount, color:'#3b82f6', pct: p.confirmationPct },
      { label: s5Txt('In Shipping', 'في الشحن'),       count: p.shippingCount,  color:'#14b8a6', pct: parseFloat((p.shippingCount/total*100).toFixed(1)) },
      { label:s5Txt('Delivered ✓', 'مُسلَّمة ✓'),    count: p.deliveredCount, color:'#00e676', pct: p.deliveryPct },
      { label:p5Txt('funnelFailed'), count: p.failedCount, color:'#f97316', pct: parseFloat(((p.failedCount || 0)/total*100).toFixed(1)) },
      { label:p5Txt('funnelCanceled'), count: p.canceledCount, color:'#ef4444', pct: p.cancelPct },
    ];
    return stages.map((s, i) => {
      const indent = i * 14;
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding-right:${indent}px">
        <div style="width:${Math.max(4, s.pct)}%;max-width:160px;height:20px;border-radius:4px;background:${s.color}22;border:1px solid ${s.color}55;display:flex;align-items:center;padding:0 8px;min-width:56px">
          <div style="font-size:10px;font-weight:700;color:${s.color};white-space:nowrap">${s.pct}٪</div>
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.7);flex-shrink:0">${s.label}</div>
        <div style="font-size:12px;font-weight:700;color:#fff;margin-right:auto">${(s.count||0).toLocaleString('en-US')}</div>
      </div>`;
    }).join('');
  }

  function citiesHTML(p) {
    if (!p.cityBreakdown || !p.cityBreakdown.length) return `<div style="color:rgba(255,255,255,0.3);font-size:12px">${s5Txt('No data', 'لا توجد بيانات')}</div>`;
    const topCities = p.cityBreakdown.slice(0, 5);
    const maxCount = topCities[0].count;

    // Pull per-city NDR/delivered for this product from geoProductMap
    const _geoD = window.dashboardGeoData;
    const _gpm  = _geoD && _geoD.geo && _geoD.geo.geoProductMap;
    const _prodKey = p.key || p.sku || p.name || '';

    function _getCityStats(cityName) {
      if (!_gpm) return null;
      var cell = _gpm[cityName] && _gpm[cityName][_prodKey];
      if (!cell) {
        const lc = cityName.toLowerCase();
        const found = Object.keys(_gpm).find(k => k.toLowerCase().indexOf(lc) !== -1 || lc.indexOf(k.toLowerCase()) !== -1);
        cell = found && _gpm[found][_prodKey];
      }
      if (!cell || !cell.orders) return null;
      const ndr = cell.orders > 0 ? Math.round((cell.delivered || 0) / cell.orders * 1000) / 10 : null;
      return { delivered: cell.delivered || 0, ndr };
    }

    const headerRow = `<div style="display:grid;grid-template-columns:1fr 46px 46px 44px;gap:5px;
      padding:3px 6px 6px;margin-bottom:2px;border-bottom:1px solid rgba(255,255,255,0.06);">
      <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.28)">${s5Txt('City','المدينة')}</span>
      <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">${s5Txt('Orders','طلبات')}</span>
      <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">${s5Txt('Dlvrd','وصل')}</span>
      <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">NDR</span>
    </div>`;

    const dataRows = topCities.map((c, i) => {
      const barPct = Math.round((c.count / maxCount) * 100);
      const colors = ['#f59e0b','#a855f7','#14b8a6'];
      const color  = colors[i] || '#8892a4';
      const stats  = _getCityStats(c.name);
      const deliveredDisplay = stats ? stats.delivered.toLocaleString('en-US') : '—';
      const ndrVal   = stats ? stats.ndr : null;
      const ndrColor = ndrVal === null ? 'rgba(255,255,255,0.22)' : ndrVal >= 75 ? '#00e676' : ndrVal >= 55 ? '#f59e0b' : '#ef4444';
      const ndrText  = ndrVal === null ? '—' : ndrVal.toFixed(1) + '%';
      return `<div style="display:grid;grid-template-columns:1fr 46px 46px 44px;gap:5px;
        align-items:center;margin-bottom:7px;padding:5px 6px;border-radius:7px;background:rgba(255,255,255,0.02);">
        <div>
          <div style="font-size:11px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(tx(c.name))}</div>
          <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;margin-top:4px">
            <div style="height:100%;width:${barPct}%;background:${color};border-radius:2px"></div>
          </div>
        </div>
        <div style="text-align:center;font-size:11px;font-weight:700;color:${color}">${c.count}</div>
        <div style="text-align:center;font-size:11px;font-weight:700;color:rgba(255,255,255,0.65)">${deliveredDisplay}</div>
        <div style="text-align:center;font-size:11px;font-weight:800;color:${ndrColor}">${ndrText}</div>
      </div>`;
    }).join('');

    return headerRow + dataRows;
  }

  function piecesBreakdownHTML(p) {
    if (!p.piecesBreakdown || !p.piecesBreakdown.length) return '';
    const total = p.piecesBreakdown.reduce((s, x) => s + x.count, 0) || 1;
    return p.piecesBreakdown.map(item => {
      const pct = parseFloat((item.count / total * 100).toFixed(1));
      return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:13px;font-weight:900;color:#f59e0b">${item.qty}x</span>
        <div style="flex:1;height:4px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;margin:0 10px">
          <div style="height:100%;width:${pct}%;background:#f59e0b;border-radius:2px"></div>
        </div>
        <span style="font-size:11px;color:rgba(255,255,255,0.6)">${item.count}</span>
      </div>`;
    }).join('');
  }

  function quantityCitiesHTML(p) {
    if (!p.quantityCityBreakdown || !p.quantityCityBreakdown.length) {
      return `<div style="color:rgba(255,255,255,0.3);font-size:12px">${s5Txt('No data', 'لا توجد بيانات')}</div>`;
    }

    return `<div style="display:flex;gap:12px;flex-wrap:wrap">
      ${p.quantityCityBreakdown.map(item => {
        const cities = (item.cities || []).slice(0, 5);
        const maxCount = cities.length ? cities[0].count : 1;

        // 4-column header: City | Orders | Delivered | NDR
        const colHdr = `<div style="display:grid;grid-template-columns:1fr 52px 58px 52px;gap:6px;
          padding:3px 6px 5px;margin-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.28)">${s5Txt('City','المدينة')}</span>
          <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">${s5Txt('Orders','طلبات')}</span>
          <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">${s5Txt('Delivered','مُسلَّمة')}</span>
          <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.28);text-align:center">${s5Txt('NDR','NDR')}</span>
        </div>`;

        const cityRows = cities.length ? cities.map((city, i) => {
          const barPct = Math.round((city.count / maxCount) * 100);
          const hasDelivered = city.delivered !== undefined && city.delivered > 0;
          const deliveredCell = hasDelivered
            ? city.delivered.toLocaleString('en-US')
            : '—';
          let ndrCell = '—';
          let ndrColor = 'rgba(255,255,255,0.45)';
          if (hasDelivered && city.count > 0) {
            const ndrVal = parseFloat((city.delivered / city.count * 100).toFixed(1));
            ndrCell = ndrVal + '%';
            ndrColor = ndrVal >= 75 ? '#00e676' : ndrVal >= 55 ? '#f59e0b' : '#ef4444';
          }
          return `<div style="display:grid;grid-template-columns:1fr 52px 58px 52px;gap:6px;
            align-items:center;margin-bottom:${i === cities.length - 1 ? '0' : '7px'};
            padding:5px 6px;border-radius:7px;background:rgba(255,255,255,0.02);">
            <div>
              <div style="font-size:11px;color:rgba(255,255,255,0.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(tx(city.name))}</div>
              <div style="height:2px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;margin-top:3px">
                <div style="height:100%;width:${barPct}%;background:#f59e0b;border-radius:2px"></div>
              </div>
            </div>
            <span style="text-align:center;font-size:12px;font-weight:700;color:#f59e0b">${city.count.toLocaleString('en-US')}</span>
            <span style="text-align:center;font-size:12px;font-weight:700;color:#00e676">${deliveredCell}</span>
            <span style="text-align:center;font-size:11px;font-weight:700;color:${ndrColor}">${ndrCell}</span>
          </div>`;
        }).join('') : `<div style="color:rgba(255,255,255,0.3);font-size:11px">${s5Txt('No data', 'لا توجد بيانات')}</div>`;

        return `<div style="flex:1 1 240px;min-width:220px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06)">
          <div style="font-size:13px;font-weight:900;color:#f59e0b;margin-bottom:10px">${esc(item.qty)}x</div>
          ${colHdr}${cityRows}
        </div>`;
      }).join('')}
    </div>`;
  }

  function detailPanelContent(p) {
    return `<div style="display:flex;gap:20px;flex-wrap:wrap">
      <div style="flex:1 1 100%;min-width:220px">
        ${window.renderProductAiAdvisor ? window.renderProductAiAdvisor(p) : ''}
      </div>
      <div style="flex:1;min-width:220px">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);margin-bottom:12px;text-align:right">${s5Txt("Order Funnel", "مسار الطلبات")}</div>
        ${funnelHTML(p)}
      </div>
      <div style="flex:1;min-width:160px">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);margin-bottom:12px;text-align:right">${s5Txt("Top Cities", "أبرز المدن")}</div>
        ${citiesHTML(p)}
      </div>
      <div style="flex:1;min-width:120px">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);margin-bottom:12px;text-align:right">${s5Txt("Quantity Distribution", "توزيع الكميات")}</div>
        ${piecesBreakdownHTML(p)}
      </div>
      <div style="flex:1 1 100%;min-width:220px">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);margin-bottom:12px;text-align:right">${s5Txt("Top Cities by Quantity", "أبرز المدن حسب الكمية")}</div>
        ${quantityCitiesHTML(p)}
      </div>
    </div>`;
  }

  const DIV = '<div class="s5-col-divider" style="width:1px;align-self:stretch;background:rgba(255,255,255,0.05)"></div>';

  // ── Product row HTML ──────────────────────────────────────────────────────
  function productRowHTML(p, i) {
    const hs      = healthRowStyle(p);
    const compact = viewMode === 'compact';
    const minH    = compact ? '60px' : '96px';

    const noDeliveryRate = p.deliveredCount === 0;
    const zeroPill = `<div style="display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);font-size:10px;color:rgba(255,255,255,0.4);font-weight:700;white-space:nowrap">${s5Txt('No deliveries yet', 'لا تسليمات بعد')}</div>`;

    const fadeClass = isFirstMount ? 'fade-up' : '';
    const fadeDelay = isFirstMount ? `animation-delay:${50 + i * 60}ms` : '';
    const productKey = p.key || p.sku || p.name || i;

    return `<div class="s5-product-row s5-metrics-track ${fadeClass}" data-idx="${i}" data-product-key="${attr(productKey)}"
         style="display:flex;align-items:center;border-radius:14px;
                background:${hs.bg};
                box-shadow:${hs.shadow};
                border:1px solid ${hs.border};
                opacity:${hs.opacity};
                overflow:hidden;margin-bottom:8px;min-height:${minH};
                transition:box-shadow 0.25s ease, transform 0.2s ease, opacity 0.3s ease, border-color 0.2s ease;${fadeDelay}">

      <!-- Col 1: Identity -->
      <div class="s5-cell s5-cell-identity" style="flex:0 0 210px;min-width:210px;padding:12px 10px;display:flex;align-items:center;gap:8px">
        ${rankBadgeHTML(p.rank, p.deliveredCount)}
        <div style="text-align:right;min-width:0">
          <div class="s5-product-title" data-modal-open="1" title="${attr(tx(p.name))}" style="font-size:14px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer">${esc(tx(p.name))}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.32);margin-top:3px">${esc(p.cat)}</div>
        </div>
      </div>
      ${DIV}

      <!-- Col 2: Total Orders -->
      <div class="s5-cell s5-cell-orders" style="flex:0 0 70px;text-align:center;padding:0 7px">
        <div id="s5-placed-${i}" style="font-size:${compact?'16px':'18px'};font-weight:900;color:rgba(255,255,255,0.8)">0</div>
      </div>
      ${DIV}

      <!-- Col 3: Quantity -->
      <div class="s5-cell s5-cell-pieces" style="flex:0 0 62px;text-align:center;padding:0 6px">
        <div style="font-size:${compact?'15px':'17px'};font-weight:800;color:#3b82f6">${p.totalPieces}</div>
      </div>
      ${DIV}

      <!-- Col 4: Failed Orders raw count -->
      <div class="s5-cell s5-cell-failed" style="flex:0 0 72px;text-align:center;padding:0 6px">
        <div style="font-size:${compact?'15px':'17px'};font-weight:800;color:#f97316">${Number(p.failedCount || 0).toLocaleString('en-US')}</div>
      </div>
      ${DIV}

      <!-- Col 5: Canceled Orders raw count -->
      <div class="s5-cell s5-cell-canceled-raw" style="flex:0 0 76px;text-align:center;padding:0 6px">
        <div style="font-size:${compact?'15px':'17px'};font-weight:800;color:#ef4444">${Number(p.canceledCount || 0).toLocaleString('en-US')}</div>
      </div>
      ${DIV}

      <!-- Col 6: Confirmation % -->
      <div class="s5-cell s5-cell-confirmation" style="flex:0 0 ${compact?'74px':'80px'};padding:0 8px">
        ${rateBadgeHTML(p.confirmationPct, 'confirmation')}
      </div>
      ${DIV}

      <!-- Col 7: Cancel % -->
      <div class="s5-cell s5-cell-cancel" style="flex:0 0 ${compact?'74px':'80px'};padding:0 8px">
        ${rateBadgeHTML(p.cancelPct, 'cancel')}
      </div>
      ${DIV}

      <!-- Col 8: NDR % -->
      <div class="s5-cell s5-cell-ndr" style="flex:0 0 ${compact?'72px':'76px'};padding:0 7px">
        ${noDeliveryRate ? zeroPill : rateBadgeHTML(p.ndrPct, 'ndr')}
      </div>
      ${DIV}

      <!-- Col 9: Delivery % -->
      <div class="s5-cell s5-cell-delivery" style="flex:0 0 ${compact?'74px':'80px'};padding:0 8px">
        ${noDeliveryRate ? zeroPill : rateBadgeHTML(p.drRate, 'delivery')}
      </div>
      ${DIV}

      <!-- Col 10: Highlighted outcome count -->
      <div class="s5-cell s5-cell-delivery-count" style="flex:0 0 ${compact?'72px':'76px'};text-align:center;padding:0 7px">
        <div id="s5-del-${i}" style="font-size:${compact?'16px':'20px'};font-weight:900;color:${
          filterState.statusKey === 'shipping' ? '#14b8a6' :
          filterState.statusKey === 'failed' ? '#f97316' :
          filterState.statusKey === 'canceled' ? '#ef4444' :
          filterState.statusKey === 'processing' ? '#3b82f6' : '#14b8a6'
        }">0</div>
      </div>
      ${DIV}

      <!-- Col 11: Allocated Ad Spend -->
      <div class="s5-cell s5-cell-ad-spend" title="${attr(p5Txt('adSpendHelp'))}" style="flex:0 0 98px;text-align:center;padding:0 6px">
        <div style="font-size:${compact?'13px':'14px'};font-weight:800;color:#60a5fa;white-space:nowrap">${(Number(p.allocatedAdSpend)||0).toLocaleString(isAr?'ar-EG-u-nu-latn':'en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div style="font-size:9px;color:rgba(96,165,250,0.55);font-weight:700;margin-top:2px">${selectedCurrency()}</div>
      </div>
      ${DIV}

      <!-- Col 12: CPA -->
      <div class="s5-cell s5-cell-cpa" title="${attr(p5Txt('cpaHelp'))}" style="flex:0 0 94px;text-align:center;padding:0 6px">
        <div style="font-size:${compact?'13px':'14px'};font-weight:800;color:#a78bfa;white-space:nowrap">${(Number(p.cpa)||0).toLocaleString(isAr?'ar-EG-u-nu-latn':'en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div style="font-size:9px;color:rgba(167,139,250,0.55);font-weight:700;margin-top:2px">${selectedCurrency()}</div>
      </div>
      ${DIV}

      <!-- Col 13: P&L -->
      <div class="s5-cell s5-cell-pnl" title="${attr(p5Txt('pnlHelp'))}" style="flex:0 0 110px;text-align:center;padding:0 6px">
        <div style="font-size:${compact?'13px':'14px'};font-weight:900;color:${p.profitLoss >= 0 ? '#00e676' : '#ef4444'};white-space:nowrap">${(Number(p.profitLoss)||0).toLocaleString(isAr?'ar-EG-u-nu-latn':'en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div style="font-size:9px;color:${p.profitLoss >= 0 ? 'rgba(0,230,118,0.55)' : 'rgba(239,68,68,0.55)'};font-weight:700;margin-top:2px">${selectedCurrency()}</div>
      </div>
      ${DIV}

      <!-- Col 14: Commission -->
      <div class="s5-cell s5-cell-commission" style="flex:0 0 100px;text-align:center;padding:0 7px">
        <div style="font-size:${compact?'18px':'22px'};font-weight:900;color:${p.accent || '#f59e0b'};letter-spacing:-0.5px">
          <span id="s5-rev-${i}">0</span>
        </div>
        <div style="font-size:9px;color:rgba(255,255,255,0.35);font-weight:600;margin-top:2px">SAR</div>
      </div>

      <!-- Actions cell -->
      <div class="s5-cell s5-cell-actions" style="width:104px;height:100%;min-height:${minH};flex-shrink:0;display:flex;align-items:center;justify-content:center;gap:6px;
                  background:var(--dash-table-row, #0b101e);position:sticky;right:0;z-index:2;border-left:1px solid var(--dash-border-soft, rgba(255,255,255,0.08));
                  padding:0 8px;box-sizing:border-box;">
        
        <!-- T-22: Show on map button -->
        <button class="s5-map-btn" data-product-key="${attr(productKey)}" data-tooltip="${s5Txt('Analyze cities for this product', 'تحليل المدن لهذا المنتج')}"
                style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(20,184,166,0.3);
                       background:rgba(20,184,166,0.1);color:#14b8a6;font-size:12px;
                       display:flex;align-items:center;justify-content:center;cursor:pointer;
                       transition:all 0.2s;flex-shrink:0;padding:0;">
          🗺️
        </button>

        <!-- Modal Details Button -->
        <button class="s5-modal-btn" data-modal-open="1" data-product-key="${attr(productKey)}" data-tooltip="${s5Txt('View full product details', 'عرض تفاصيل المنتج كاملة')}"
                style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(139,92,246,0.3);
                       background:rgba(139,92,246,0.1);color:#8b5cf6;
                       display:flex;align-items:center;justify-content:center;cursor:pointer;
                       transition:all 0.2s;flex-shrink:0;padding:0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        </button>

        <!-- Expand accordion button -->
        <button class="s5-expand-btn" data-idx="${i}" data-tooltip="${s5Txt('Quick analysis (funnel / cities)', 'تحليل سريع (مسار / مدن)')}"
                style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);
                       background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.6);
                       display:flex;align-items:center;justify-content:center;cursor:pointer;
                       transition:all 0.2s;flex-shrink:0;padding:0;">
          <svg class="s5-expand-arrow" data-idx="${i}" width="14" height="14" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2.5"
               style="pointer-events:none;transition:transform 0.35s cubic-bezier(0.4,0,0.2,1)">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Detail panel -->
    <div class="s5-detail-panel" id="s5-detail-${i}"
         style="max-height:0;overflow:hidden;opacity:0;
                padding:0 24px;
                transition:max-height 0.42s cubic-bezier(0.4,0,0.2,1),
                            opacity 0.32s ease,
                            padding 0.42s cubic-bezier(0.4,0,0.2,1),
                            margin-bottom 0.42s cubic-bezier(0.4,0,0.2,1);
                margin-bottom:0;border-radius:14px;
                background:rgba(255,255,255,0.02);
                border:1px solid rgba(255,255,255,0);
                box-sizing:border-box;
                will-change:max-height,opacity">
    </div>`;
  }

  // ── Column header sort button ─────────────────────────────────────────────
  function colHeaderBtn(label, field, flexStyle) {
    const isActive = sortState.field === field;
    const arrow    = isActive ? (sortState.dir === 'desc' ? '↓' : '↑') : '↕';
    const arrowColor = isActive ? '#f59e0b' : 'rgba(255,255,255,0.2)';
    return `<button class="s5-sort-col" data-field="${field}"
        style="${flexStyle};background:none;border:none;color:rgba(255,255,255,0.35);
               font-size:11px;font-weight:700;cursor:pointer;
               display:flex;align-items:center;justify-content:center;gap:4px;
               font-family:inherit;padding:0;width:100%;text-align:center;
               transition:color 0.18s">
      ${label}
      <span class="s5-sort-arrow" data-field="${field}" style="color:${arrowColor};transition:color 0.18s">${arrow}</span>
    </button>`;
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  function paginationHTML() {
    const list  = currentList();
    const total = totalProductPages();
    if (total <= 1) return '';

    const start = ((currentPage - 1) * PAGE_SIZE) + 1;
    const end   = Math.min(currentPage * PAGE_SIZE, list.length);

    if (window.renderDashboardPagination) {
      return window.renderDashboardPagination({
        currentPage: currentPage,
        totalPages: total,
        totalItems: list.length,
        startItem: start,
        endItem: end,
        itemLabel: s5Txt('product', '\u0645\u0646\u062a\u062c'),
        pageButtonClass: 's5-page-btn',
        prevId: 's5-prev-page',
        nextId: 's5-next-page',
        className: 's5-dashboard-pagination'
      });
    }

    function pageButtons() {
      const pages = [];
      const WINDOW = 2;

      for (let p = 1; p <= total; p++) {
        if (
          p === 1 || p === total ||
          (p >= currentPage - WINDOW && p <= currentPage + WINDOW)
        ) {
          pages.push(p);
        } else if (pages[pages.length - 1] !== '…') {
          pages.push('…');
        }
      }

      return pages.map(p => {
        if (p === '…') {
          return `<span style="width:32px;text-align:center;color:rgba(255,255,255,0.25);font-size:13px;font-weight:600;user-select:none">…</span>`;
        }
        const isActive = p === currentPage;
        return `<button class="s5-page-btn" data-page="${p}"
          style="width:32px;height:32px;border-radius:8px;border:1px solid ${isActive ? '#f59e0b' : 'rgba(255,255,255,0.1)'};
                 background:${isActive ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.03)'};
                 color:${isActive ? '#f59e0b' : 'rgba(255,255,255,0.6)'};
                 font-size:13px;font-weight:${isActive ? '800' : '600'};
                 cursor:${isActive ? 'default' : 'pointer'};font-family:inherit;
                 transition:all 0.18s;display:inline-flex;align-items:center;justify-content:center">${p}</button>`;
      }).join('');
    }

    const prevDisabled = currentPage <= 1;
    const nextDisabled = currentPage >= total;

    const arrowStyle = (disabled) =>
      `width:32px;height:32px;border-radius:8px;border:1px solid ${disabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)'};
       background:${disabled ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)'};
       color:${disabled ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.7)'};
       cursor:${disabled ? 'default' : 'pointer'};font-family:inherit;
       display:inline-flex;align-items:center;justify-content:center;
       transition:all 0.18s;flex-shrink:0`;

    return `<div id="s5-pagination" style="display:flex;align-items:center;justify-content:space-between;gap:10px;
              margin:14px 0 24px;padding:12px 16px;
              border:1px solid rgba(255,255,255,0.06);border-radius:12px;
              background:rgba(255,255,255,0.02);direction:${isAr ? 'ltr' : 'rtl'}">
      <button id="s5-prev-page" ${prevDisabled ? 'disabled' : ''} style="${arrowStyle(prevDisabled)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div style="display:flex;align-items:center;gap:6px;flex:1;justify-content:center;flex-wrap:wrap">
        ${pageButtons()}
      </div>
      <button id="s5-next-page" ${nextDisabled ? 'disabled' : ''} style="${arrowStyle(nextDisabled)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
    <div style="text-align:center;font-size:11px;color:rgba(255,255,255,0.3);font-weight:600;margin-bottom:8px;direction:${isAr ? 'rtl' : 'ltr'}">
      ${s5Txt(`Showing ${start}–${end} of ${list.length} products`, `عرض ${start}–${end} من ${list.length} منتج`)}
    </div>`;
  }

  // ── Stat card ─────────────────────────────────────────────────────────────
  function statCardHTML(c, i) {
    return `<div class="fade-up" style="flex:1;background:#0b1120;border:1px solid ${c.color}28;border-radius:14px;padding:14px 16px;direction:${isAr ? 'ltr' : 'rtl'};display:flex;flex-direction:row;align-items:center;gap:14px;position:relative;overflow:hidden;box-shadow:0 0 0 1px ${c.color}12,inset 0 0 40px ${c.color}06;animation-delay:${i * 60}ms">
      <div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 20% 50%,${c.color}10 0%,transparent 65%)"></div>
      <div style="width:46px;height:46px;border-radius:12px;flex-shrink:0;background:${c.color}22;border:1.5px solid ${c.color}35;display:flex;align-items:center;justify-content:center;position:relative;z-index:1;box-shadow:0 0 12px ${c.color}25">${statIconHTML(c.iconType, c.color)}</div>
      <div style="flex:1;text-align:right;direction:${isAr ? 'rtl' : 'ltr'};position:relative;z-index:1">
        <div style="font-size:10px;color:rgba(255,255,255,0.35);font-weight:600;margin-bottom:4px;line-height:1.3">${c.label}</div>
        <div id="s5-stat-${i}" style="font-size:26px;font-weight:900;color:#fff;line-height:1;letter-spacing:-0.5px">0</div>
        <div style="font-size:10px;color:${c.color};font-weight:700;margin-top:4px;letter-spacing:0.3px">${c.unit}</div>
      </div>
    </div>`;
  }

  // ── Insight card ──────────────────────────────────────────────────────────
  function insightCardHTML(ins, i) {
    return `<div class="fade-up" style="flex:1;background:${ins.bg};border:1px solid ${ins.border};border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;direction:${isAr ? 'ltr' : 'rtl'};animation-delay:${500 + i * 80}ms">
      <div style="width:44px;height:44px;border-radius:50%;flex-shrink:0;background:${ins.iconGlow}22;border:1.5px solid ${ins.iconGlow}35;box-shadow:0 0 12px ${ins.iconGlow}28;display:flex;align-items:center;justify-content:center;font-size:20px">${ins.emoji}</div>
      <div style="flex:1;text-align:right;direction:${isAr ? 'rtl' : 'ltr'}">
        <div style="font-size:10px;color:rgba(255,255,255,0.4);font-weight:600;margin-bottom:3px">${ins.label}</div>
        <div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:4px;line-height:1.3">${esc(ins.value)}</div>
        <div style="font-size:11px;font-weight:700;color:${ins.detailColor}">${esc(ins.detail)}</div>
      </div>
    </div>`;
  }

  // ── Sort options ──────────────────────────────────────────────────────────
  const SORT_OPTIONS = [
    { value: 'deliveredCount',  label: s5Txt('Deliveries', 'عدد التسليمات'), icon: '📦' },
    { value: 'commission',      label: s5Txt('Commission', 'العمولة'),        icon: '💰' },
    { value: 'drRate',          label: s5Txt('Delivery Rate', 'نسبة التسليم'),   icon: '✅' },
    { value: 'cancelPct',       label: s5Txt('Cancellation Rate', 'نسبة الإلغاء'),   icon: '❌' },
    { value: 'placedCount',     label: s5Txt('Total Orders', 'إجمالي الطلبات'), icon: '📋' },
    { value: 'confirmationPct', label: s5Txt('Confirmation Rate', 'نسبة التأكيد'),   icon: '☑️' },
    { value: 'failedCount',     label: p5Txt('failedOrders'), icon: '!' },
    { value: 'canceledCount',   label: s5Txt('Canceled Count', 'عدد الملغية'),    icon: '🚫' },
    { value: 'allocatedAdSpend',label: p5Txt('adSpend'), icon: '$' },
    { value: 'cpa',             label: p5Txt('cpa'), icon: '$' },
    { value: 'profitLoss',      label: p5Txt('pnl'), icon: '$' },
    { value: 'shippingCount',   label: s5Txt('In Shipping', 'في الشحن'),       icon: '🚚' },
    { value: 'processingCount', label: s5Txt('Processing', 'قيد المعالجة'),   icon: '⏳' },
  ];

  function activeSortLabel() {
    if (sortState.field === 'default') return s5Txt('Default', 'الافتراضي');
    const opt = SORT_OPTIONS.find(o => o.value === sortState.field);
    return opt ? opt.label : s5Txt('Default', 'الافتراضي');
  }

  // ── FIX 3 helper: filter bar re-render needs to know the current dropdown state ──
  let _dropdownOpen = false;

  // ── Filter bar ────────────────────────────────────────────────────────────
  function filterBarHTML() {
    const pillsHTML = STATUS_PILLS.map(pill => {
      const isActive = filterState.statusKey === pill.key;
      const isAll    = pill.key === 'all';

      if (isAll) {
        return `<button class="s5-pill" data-key="all"
          style="display:flex;align-items:center;gap:6px;
                 padding:6px 14px;border-radius:100px;font-size:12px;font-weight:${isActive?'800':'600'};
                 border:1px solid ${isActive ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'};
                 cursor:pointer;font-family:inherit;
                 background:${isActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'};
                 color:${isActive ? '#fff' : 'rgba(255,255,255,0.5)'};
                 white-space:nowrap;transition:all 0.2s cubic-bezier(0.4,0,0.2,1)">
          ${s5Txt('All', 'الكل')}
          ${isActive ? `<span style="background:#f59e0b;color:#000;font-size:9px;font-weight:900;padding:1px 6px;border-radius:100px;line-height:1.5">${currentList().length}</span>` : ''}
        </button>`;
      }

      return `<button class="s5-pill" data-key="${pill.key}"
          style="display:flex;align-items:center;gap:6px;
                 padding:6px 14px;border-radius:100px;font-size:12px;font-weight:${isActive?'800':'600'};
                 border:1px solid ${isActive ? pill.color + '60' : 'rgba(255,255,255,0.08)'};
                 cursor:pointer;font-family:inherit;
                 background:${isActive ? pill.color + '18' : 'rgba(255,255,255,0.03)'};
                 color:${isActive ? pill.color : 'rgba(255,255,255,0.45)'};
                 white-space:nowrap;transition:all 0.2s cubic-bezier(0.4,0,0.2,1)">
        <span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;
                     background:${isActive ? pill.color : 'rgba(255,255,255,0.2)'};
                     transition:background 0.18s"></span>
        ${pill.label}
      </button>`;
    }).join('');

    const sortMenuHTML = SORT_OPTIONS.map(opt => {
      const isActive = sortState.field === opt.value;
      return `<div class="s5-sort-option ${isActive ? 'active' : ''}" data-value="${opt.value}">
        <span class="s5-opt-dot"></span>
        <span style="font-size:14px;line-height:1">${opt.icon}</span>
        <span>${opt.label}</span>
        ${isActive ? `<svg style="margin-right:auto;flex-shrink:0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
      </div>`;
    }).join('');

    return `<div id="s5-filter-bar"
        style="margin-bottom:16px;
               background:linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%);
               border:1px solid rgba(255,255,255,0.09);
               border-radius:16px;padding:14px 16px;direction:${isAr ? 'rtl' : 'ltr'};
               backdrop-filter:blur(8px);">

      <!-- Search bar -->
      <div style="position:relative;margin-bottom:12px">
        <svg style="position:absolute;right:14px;top:50%;transform:translateY(-50%);opacity:0.35;pointer-events:none;z-index:1"
             width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input id="s5-search" type="text" placeholder="${s5Txt('Search by Product name or SKU...', 'ابحث باسم المنتج أو SKU...')}" value="${attr(filterState.search)}"
          style="width:100%;padding:10px 42px 10px 42px;border-radius:11px;
                 border:1px solid rgba(255,255,255,0.1);
                 background:rgba(255,255,255,0.05);color:#fff;font-size:13px;font-family:inherit;
                 outline:none;box-sizing:border-box;direction:${isAr ? 'rtl' : 'ltr'};
                 transition:border-color 0.25s, background 0.25s, box-shadow 0.25s;"/>
        ${filterState.search ? `<button id="s5-search-clear"
          style="position:absolute;left:12px;top:50%;transform:translateY(-50%);
                 width:20px;height:20px;border-radius:50%;border:none;cursor:pointer;
                 background:rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);
                 display:flex;align-items:center;justify-content:center;font-size:10px;
                 line-height:1;padding:0;font-family:inherit;transition:background 0.15s">✕</button>` : ''}
      </div>

      <!-- Row 2: pills + sort -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div id="s5-status-pills" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          ${pillsHTML}
          
          <div style="display:flex;align-items:center;gap:12px;margin-inline-start:12px;padding-inline-start:12px;border-inline-start:1px solid rgba(255,255,255,0.06);">
            <div style="display:flex;align-items:center;gap:4px;" title="${s5Txt('Delivery rate >= 30%', 'نسبة التسليم >= 30%')}">
               <div style="width:8px;height:8px;border-radius:50%;background:#00e676;box-shadow:0 0 6px rgba(0,230,118,0.4)"></div>
               <span style="font-size:10px;color:rgba(255,255,255,0.45);font-weight:600">${s5Txt('Scalable', 'قابل للتوسع')}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;" title="${s5Txt('Cancel rate >= 40%', 'نسبة الإلغاء >= 40%')}">
               <div style="width:8px;height:8px;border-radius:50%;background:#ef4444;box-shadow:0 0 6px rgba(239,68,68,0.4)"></div>
               <span style="font-size:10px;color:rgba(255,255,255,0.45);font-weight:600">${s5Txt('Danger', 'خطر')}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;" title="${s5Txt('NDR <= 45%', 'نسبة التوصيل <= 45%')}">
               <div style="width:8px;height:8px;border-radius:50%;background:#f97316;box-shadow:0 0 6px rgba(249,115,22,0.4)"></div>
               <span style="font-size:10px;color:rgba(255,255,255,0.45);font-weight:600">${s5Txt('Warning', 'تحذير')}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;" title="${s5Txt('Top 3 performing products', 'أفضل 3 منتجات أداء')}">
               <div style="width:8px;height:8px;border-radius:50%;background:#fbbf24;box-shadow:0 0 6px rgba(251,191,36,0.4)"></div>
               <span style="font-size:10px;color:rgba(255,255,255,0.45);font-weight:600">${s5Txt('Top Products', 'أفضل المنتجات')}</span>
            </div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <span style="font-size:10px;color:rgba(255,255,255,0.28);font-weight:700;
                       letter-spacing:0.5px;white-space:nowrap;text-transform:uppercase">${s5Txt("Sort", "ترتيب")}</span>

          <!-- Trigger only — menu is body-teleported in bindFilterBar to escape overflow:hidden -->
          <div class="s5-sort-dropdown" id="s5-sort-dropdown" style="position:relative">
            <div class="s5-sort-trigger" id="s5-sort-trigger" tabindex="0">
              <span id="s5-sort-label" style="direction:${isAr ? 'rtl' : 'ltr'}">${activeSortLabel()}</span>
              <svg class="s5-sort-chevron" width="12" height="12" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2.5"
                   stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>

          <!-- Direction toggle -->
          <div style="display:flex;align-items:center;gap:4px;">
            ${sortState.field !== 'default' ? `
            <button id="s5-clear-sort" title="${s5Txt('Clear Sort', 'إلغاء الترتيب')}"
              style="width:34px;height:34px;border-radius:9px;border:1px solid rgba(239,68,68,0.2);
                     background:rgba(239,68,68,0.05);color:#ef4444;display:flex;align-items:center;
                     justify-content:center;cursor:pointer;transition:all 0.2s;flex-shrink:0;padding:0;box-sizing:border-box;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>` : ''}
            
            <button id="s5-sort-dir-btn"
            style="width:34px;height:34px;border-radius:9px;
                   border:1px solid rgba(255,255,255,0.1);
                   background:rgba(255,255,255,0.04);
                   color:rgba(255,255,255,0.6);cursor:pointer;
                   display:flex;align-items:center;justify-content:center;
                   transition:all 0.2s;flex-shrink:0;padding:0;box-sizing:border-box;"
            title="${sortState.dir === 'desc' ? s5Txt('Ascending', 'تصاعدي') : s5Txt('Descending', 'تنازلي')}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              ${sortState.dir === 'desc'
                ? '<path d="M12 20V4M5 13l7 7 7-7"/>'
                : '<path d="M12 4v16M5 11l7-7 7 7"/>'}
            </svg>
          </button>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── Column headers ────────────────────────────────────────────────────────
  function columnHeadersHTML() {
    const compact = viewMode === 'compact';
    return `<div class="s5-header-cols s5-metrics-track" style="display:flex;align-items:center;padding:0 0 10px 0;border-bottom:1px solid rgba(255,255,255,0.05);margin-bottom:10px;position:sticky;top:0;z-index:9;background:#080b12">
      <div style="flex:0 0 210px;min-width:210px;padding-right:10px;font-size:10px;color:rgba(255,255,255,0.3);font-weight:700;text-align:right">${s5Txt('Product', 'المنتج')}</div>
      <div style="width:1px"></div>
      ${colHeaderBtn(s5Txt('Orders', 'الطلبات'),'placedCount','flex:0 0 70px')}
      <div style="width:1px"></div>
      <div style="flex:0 0 62px;font-size:10px;color:rgba(255,255,255,0.3);font-weight:700;text-align:center">${s5Txt('Quantity', 'القطع')}</div><div style="width:1px"></div>
      ${colHeaderBtn(p5Txt('failedOrders'),'failedCount','flex:0 0 72px')}
      <div style="width:1px"></div>
      ${colHeaderBtn(p5Txt('canceledOrders'),'canceledCount','flex:0 0 76px')}
      <div style="width:1px"></div>
      ${colHeaderBtn(s5Txt('Confirm', 'التأكيد'),'confirmationPct',`flex:0 0 ${compact?'74':'80'}px`)}
      <div style="width:1px"></div>
      ${colHeaderBtn(s5Txt('Cancel', 'الإلغاء'),'cancelPct',`flex:0 0 ${compact?'74':'80'}px`)}
      <div style="width:1px"></div>
      ${colHeaderBtn('NDR','ndrPct',`flex:0 0 ${compact?'72':'76'}px`)}
      <div style="width:1px"></div>
      ${colHeaderBtn(s5Txt('DR', 'التسليم'),'drRate',`flex:0 0 ${compact?'74':'80'}px`)}
      <div style="width:1px"></div>
      ${colHeaderBtn(
        filterState.statusKey === 'shipping' ? s5Txt('Shipping', 'شحن') :
        filterState.statusKey === 'failed' ? p5Txt('failedShort') :
        filterState.statusKey === 'canceled' ? s5Txt('Canceled', 'ملغي') :
        filterState.statusKey === 'processing' ? s5Txt('Processing', 'معالجة') : s5Txt('Delivered', 'تم تسليمها'),
        filterState.statusKey === 'shipping' ? 'shippingCount' :
        filterState.statusKey === 'failed' ? 'failedCount' :
        filterState.statusKey === 'canceled' ? 'canceledCount' :
        filterState.statusKey === 'processing' ? 'processingCount' : 'deliveredCount',
        `flex:0 0 ${compact?'72':'76'}px`
      )}
      <div style="width:1px"></div>
      ${colHeaderBtn(p5Txt('adSpend'),'allocatedAdSpend','flex:0 0 98px')}
      <div style="width:1px"></div>
      ${colHeaderBtn(p5Txt('cpa'),'cpa','flex:0 0 94px')}
      <div style="width:1px"></div>
      ${colHeaderBtn(p5Txt('pnl'),'profitLoss','flex:0 0 110px')}
      <div style="width:1px"></div>
      ${colHeaderBtn(s5Txt('Commission', 'العمولة'),'commission','flex:0 0 100px')}
      <div style="width:1px"></div>
      <div style="width:104px;text-align:center;font-size:10px;color:rgba(255,255,255,0.3);font-weight:700;position:sticky;right:0;background:var(--dash-bg, #080b12);z-index:10;border-left:1px solid var(--dash-border-soft, rgba(255,255,255,0.08));">${s5Txt('Actions', 'إجراءات')}</div>
    </div>`;
  }

  // ── Main render ───────────────────────────────────────────────────────────
  mountEl.innerHTML = `
    <style>
      /* ── Fade-up entry animation ── */
      @keyframes s5FadeUp {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .fade-up {
        opacity: 0;
        animation: s5FadeUp 0.45s cubic-bezier(0.4,0,0.2,1) forwards;
        will-change: transform, opacity;
      }

      /* ── Row hover ── */
      .s5-product-row { transition: box-shadow 0.25s ease, transform 0.2s ease !important; will-change: transform, box-shadow; outline: none !important; -webkit-tap-highlight-color: transparent; }
      .s5-product-row:focus, .s5-product-row:active { outline: none !important; }
      .s5-product-row:hover {
        box-shadow: 0 0 0 1px rgba(255,255,255,0.13), 0 6px 28px rgba(0,0,0,0.35) !important;
        transform: translateY(-1px) !important;
      }

      /* ── Expand cell ── */
      .s5-expand-btn { transition: background 0.2s !important; }
      .s5-expand-btn:hover { background: rgba(255,255,255,0.07) !important; }
      .s5-expand-btn:hover .s5-expand-icon-wrap {
        background: rgba(255,255,255,0.1) !important;
        border-color: rgba(255,255,255,0.28) !important;
        transform: scale(1.08) !important;
      }

      /* ── Pagination ── */
      .s5-page-btn { transition: all 0.18s !important; }
      .s5-page-btn:hover:not([disabled]) {
        background: rgba(255,255,255,0.09) !important;
        border-color: rgba(255,255,255,0.25) !important;
        color: #fff !important;
        transform: translateY(-1px) !important;
      }
      #s5-prev-page, #s5-next-page { transition: all 0.18s !important; }
      #s5-prev-page:hover:not([disabled]),
      #s5-next-page:hover:not([disabled]) {
        background: rgba(255,255,255,0.09) !important;
        border-color: rgba(255,255,255,0.25) !important;
        color: #fff !important;
      }

      /* ── Search input focus ── */
      #s5-search { transition: border-color 0.25s, background 0.25s, box-shadow 0.25s !important; }
      #s5-search:focus {
        border-color: rgba(245,158,11,0.5) !important;
        background: rgba(245,158,11,0.04) !important;
        box-shadow: 0 0 0 3px rgba(245,158,11,0.08) !important;
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

      /* ── Status pills ── */
      .s5-pill { transition: all 0.2s cubic-bezier(0.4,0,0.2,1) !important; }
      .s5-pill:hover { transform: translateY(-1px) !important; filter: brightness(1.15) !important; }

      /* ── Custom dropdown — FIX 2: z-index 99999 ── */
      .s5-sort-dropdown { position: relative; user-select: none; }
      .s5-sort-trigger {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        color: #fff; font-size: 12px; font-weight: 600;
        cursor: pointer; white-space: nowrap;
        transition: all 0.2s;
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
      .s5-sort-trigger.open .s5-sort-chevron { transform: rotate(180deg); color: #f59e0b; }
      .s5-sort-chevron { transition: transform 0.25s ease, color 0.2s; color: rgba(255,255,255,0.4); flex-shrink: 0; }

      /* ── Sort col header ── */
      .s5-sort-col { transition: color 0.18s !important; }
      .s5-sort-col:hover { color: rgba(255,255,255,0.7) !important; }

      /* ── Rate badge bar fill ── */
      .s5-rate-bar { transition: transform 0.7s cubic-bezier(0.4,0,0.2,1) !important; }

      /* ── Stat card hover ── */
      .s5-stat-card { transition: transform 0.2s ease, box-shadow 0.2s ease !important; }
      .s5-stat-card:hover { transform: translateY(-2px) !important; }

      /* ── Detail panel ── */
      .s5-detail-panel {
        transition: max-height 0.42s cubic-bezier(0.4,0,0.2,1),
                    opacity 0.32s ease,
                    padding 0.42s cubic-bezier(0.4,0,0.2,1),
                    margin-bottom 0.42s cubic-bezier(0.4,0,0.2,1) !important;
      }
    </style>
    <div class="s5-root" dir="${isAr ? 'rtl' : 'ltr'}" style="flex:1;display:flex;flex-direction:column;background:#080b12;color:#fff;font-family:'Cairo',sans-serif;overflow:hidden;height:100%">

      <!-- Sticky topbar -->
      <div class="s5-topbar" style="display:flex;align-items:center;justify-content:space-between;padding:0 28px;height:68px;border-bottom:1px solid rgba(255,255,255,0.05);background:#080b12;position:sticky;top:0;z-index:10;flex-shrink:0">
        <div style="display:flex;gap:10px;align-items:center">
          <button style="display:flex;align-items:center;gap:8px;padding:7px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);cursor:pointer;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;font-family:inherit;transition:background 0.18s">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="3" stroke="rgba(255,255,255,0.45)" stroke-width="1.5"/><path d="M8 2v4M16 2v4M3 10h18" stroke="rgba(255,255,255,0.45)" stroke-width="1.5" stroke-linecap="round"/></svg>
            <span style="color:#f59e0b">${(function(){ var M=['January','February','March','April','May','June','July','August','September','October','November','December']; var M_ar=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']; var n=new Date(); return (isAr ? M_ar[n.getMonth()] : M[n.getMonth()])+' '+n.getFullYear(); })()}</span>
          </button>
          <button style="display:flex;align-items:center;gap:8px;padding:7px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);cursor:pointer;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;font-family:inherit;transition:background 0.18s">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="rgba(255,255,255,0.45)" stroke-width="1.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(255,255,255,0.45)" stroke-width="1.5" stroke-linecap="round"/></svg>
            <span>${window.currentActiveAccountLabel || s5Txt('All Shared Accounts', 'كل الحسابات المشتركة')}</span>
          </button>
        </div>
        <div style="text-align:center;flex:1">
          <div class="fade-up" style="font-size:22px;font-weight:900;color:#fff;display:flex;align-items:center;justify-content:center;gap:8px">
            ${s5Txt('Top Products', 'أفضل المنتجات')}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.2L12 17l-6.2 3.9 2.4-7.2L2 9.2h7.6z" fill="#f59e0b"/></svg>
          </div>
          <div class="fade-up" style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:3px;animation-delay:100ms">${s5Txt('Product Health Board', 'لوحة صحة المنتجات')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <button id="s5-view-toggle" style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:9px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.55);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 0.18s">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            ${s5Txt('Compact', 'مضغوط')}
          </button>
          <div style="font-size:11px;color:rgba(255,255,255,0.35)">${s5Txt('Last update: Today', 'آخر تحديث: اليوم')}</div>
          <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.7)">${(function(){ var n=new Date(); return ('0'+n.getHours()).slice(-2)+':'+('0'+n.getMinutes()).slice(-2); })()}</div>
        </div>
      </div>

      <!-- Non-scrolling block -->
      <div style="padding:22px 28px 0;flex-shrink:0">
        <div class="s5-stat-row" style="display:flex;gap:12px;margin-bottom:20px;align-items:stretch">
          ${STAT_CARDS.map((c, i) => statCardHTML(c, i)).join('')}
        </div>
        ${filterBarHTML()}
      </div>

      <!-- Scroll wrapper -->
      <div id="s5-scroll-wrapper" class="dash-scroll" style="flex:1;overflow:auto;min-height:0">
        <div style="padding:0 28px 22px">
          ${columnHeadersHTML()}
          <div id="s5-rows">
            ${pagedProducts().map((p, i) => productRowHTML(p, i)).join('')}
          </div>
          <div id="s5-pagination-wrap">${paginationHTML()}</div>

          ${INSIGHTS.length ? `
          <div>
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:14px">
              <span style="font-size:15px;font-weight:800;color:rgba(255,255,255,0.82)">رؤى ذكية</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.2L12 17l-6.2 3.9 2.4-7.2L2 9.2h7.6z" fill="#f59e0b"/></svg>
            </div>
            <div class="s5-insights-row" style="display:flex;gap:12px;flex-wrap:wrap">
              ${INSIGHTS.map((ins, i) => insightCardHTML(ins, i)).join('')}
            </div>
          </div>` : ''}
        </div>
      </div>
    </div>`;

  // ── Trigger rate bar animations after render ──────────────────────────────
  // Double rAF ensures browser commits width:0% paint before we flip to target,
  // which is required for the CSS transition to actually fire.
  function triggerRateBars() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        mountEl.querySelectorAll('.s5-rate-bar').forEach(bar => {
          const target = bar.dataset.target;
          if (target != null) bar.style.transform = `scaleX(${target / 100})`;
        });
      });
    });
  }

  // ── Stat card animation (smooth, staggered) ───────────────────────────────
  STAT_CARDS.forEach((c, i) => {
    const el = mountEl.querySelector(`#s5-stat-${i}`);
    if (!el) return;
    // Stagger: each card starts 120ms after the previous
    setTimeout(() => {
      _animateNumber(el, c.value, { duration: 1400, decimals: 0 });
    }, 200 + i * 120);
  });

  // ── Product row number animations ─────────────────────────────────────────
  function animateVisibleProducts() {
    // Keep row rendering cheap. Counters across every cell created noticeable
    // rAF pressure on larger product catalogs; rate bars provide the motion.
    pagedProducts().forEach((p, i) => {
      setNumberText(`s5-placed-${i}`, p.placedCount || 0);
      let hlCount = p.deliveries || 0;
      if (filterState.statusKey === 'shipping') hlCount = p.shippingCount || 0;
      else if (filterState.statusKey === 'failed') hlCount = p.failedCount || 0;
      else if (filterState.statusKey === 'canceled') hlCount = p.canceledCount || 0;
      else if (filterState.statusKey === 'processing') hlCount = p.processingCount || 0;
      setNumberText(`s5-del-${i}`,    hlCount);
      setNumberText(`s5-rev-${i}`,    p.revenue     || 0);
    });
    setTimeout(triggerRateBars, 80);
  }
  animateVisibleProducts();

  // ── Sort arrows sync ──────────────────────────────────────────────────────
  function updateSortArrows() {
    mountEl.querySelectorAll('.s5-sort-arrow').forEach(arrow => {
      if (arrow.dataset.field === sortState.field) {
        arrow.textContent = sortState.dir === 'desc' ? '↓' : '↑';
        arrow.style.color = '#f59e0b';
      } else {
        arrow.textContent = '↕';
        arrow.style.color = 'rgba(255,255,255,0.2)';
      }
    });
  }

  // ── FIX 3: renderProductPage re-renders filter bar + pills ────────────────
  let pageRenderToken = 0;

  function productsPageLoaderHTML() {
    return `<div class="s5-products-page-loader" style="min-height:280px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.06);border-radius:14px;background:rgba(255,255,255,0.018);margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:12px;color:rgba(255,255,255,0.62);font-size:12px;font-weight:800">
        <span style="width:24px;height:24px;border-radius:50%;border:2px solid rgba(245,158,11,0.18);border-top-color:#f59e0b;animation:s5Spin 0.8s linear infinite"></span>
        <span>${s5Txt('Loading products page...', 'جاري تحميل صفحة المنتجات...')}</span>
      </div>
    </div>`;
  }

  function renderProductPage(options) {
    options = options || {};
    isFirstMount = false;
    const token = ++pageRenderToken;

    // Re-render filter bar so pills and dropdown show correct active state
    const filterBarEl = mountEl.querySelector('#s5-filter-bar');
    if (filterBarEl && !options.keepFilterBar) {
      filterBarEl.outerHTML = filterBarHTML();
      bindFilterBar();
    }

    const rowsEl  = mountEl.querySelector('#s5-rows');
    const pagerEl = mountEl.querySelector('#s5-pagination-wrap');
    if (rowsEl) rowsEl.innerHTML = productsPageLoaderHTML();
    if (pagerEl) pagerEl.style.opacity = '0.45';

    requestAnimationFrame(() => {
      if (!mountEl.isConnected || mountEl._s5RenderToken !== renderToken || token !== pageRenderToken) return;
      const visibleProducts = pagedProducts();
      if (rowsEl) {
        if (visibleProducts.length === 0) {
          rowsEl.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center;background:rgba(255,255,255,0.015);border:1px solid rgba(255,255,255,0.05);border-radius:14px;margin-bottom:12px;">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" style="margin-bottom:16px;">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <div style="font-size:16px;font-weight:800;color:rgba(255,255,255,0.6);margin-bottom:8px;">${s5Txt('No products match the filter', 'لا توجد منتجات تطابق الفلتر')}</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.3);">جرب تغيير خيارات التصفية أو البحث لعرض النتائج.</div>
            </div>`;
        } else {
          rowsEl.innerHTML = visibleProducts.map((p, i) => productRowHTML(p, i)).join('');
        }
      }
      if (pagerEl) {
        pagerEl.innerHTML = paginationHTML();
        pagerEl.style.opacity = '1';
      }

      // Filtering/sorting should feel instant; avoid spawning dozens of rAF counters.
      visibleProducts.forEach((p, i) => {
        setNumberText(`s5-placed-${i}`, p.placedCount || 0);
        let hlCount = p.deliveries || 0;
        if (filterState.statusKey === 'shipping') hlCount = p.shippingCount || 0;
        else if (filterState.statusKey === 'failed') hlCount = p.failedCount || 0;
        else if (filterState.statusKey === 'canceled') hlCount = p.canceledCount || 0;
        else if (filterState.statusKey === 'processing') hlCount = p.processingCount || 0;
        setNumberText(`s5-del-${i}`,    hlCount);
        setNumberText(`s5-rev-${i}`,    p.revenue     || 0);
      });

      setTimeout(triggerRateBars, 40);

      bindExpandButtons();
      bindPagination();
      bindPageNumbers();
      updateSortArrows();
      _bindProductRowClicks();
      if (_s5SelectedProductKey) _selectS5Row(_s5SelectedProductKey);
      if (window.s5BindProductModalRows) window.s5BindProductModalRows(mountEl);
    });
  }

  // ── Rate bar: use CSS transition approach ─────────────────────────────────
  // We store target width in data-target and animate via CSS transition
  // (already in rateBadgeHTML via inline transition style)
  // After DOM is inserted we flip widths from 0 → target
  setTimeout(() => {
    mountEl.querySelectorAll('[data-rate-target]').forEach(el => {
      el.style.width = el.dataset.rateTarget + '%';
    });
    // Also handle the inline-transition bars rendered in rateBadgeHTML
    mountEl.querySelectorAll('.s5-rows [style*="width:0%"]').forEach(bar => {
      // handled by triggerRateBars
    });
  }, 300);

  // ── Search debounce ───────────────────────────────────────────────────────
  let searchDebounce = null;

  function syncSearchClearButton() {
    const clearBtn = mountEl.querySelector('#s5-search-clear');
    if (!clearBtn) return;
    const active = !!filterState.search;
    clearBtn.style.opacity = active ? '1' : '0';
    clearBtn.style.pointerEvents = active ? 'auto' : 'none';
  }

  function ensureSearchClearButton(searchEl) {
    if (!searchEl || mountEl.querySelector('#s5-search-clear')) return;
    const clearBtn = document.createElement('button');
    clearBtn.id = 's5-search-clear';
    clearBtn.type = 'button';
    clearBtn.setAttribute('aria-label', s5Txt('Clear search', 'مسح البحث'));
    clearBtn.style.cssText = [
      'position:absolute',
      'left:12px',
      'top:50%',
      'transform:translateY(-50%)',
      'width:28px',
      'height:28px',
      'min-width:28px',
      'max-width:28px',
      'aspect-ratio:1/1',
      'border-radius:999px',
      'border:none',
      'cursor:pointer',
      'box-sizing:border-box',
      'background:rgba(255,255,255,0.12)',
      'color:rgba(255,255,255,0.6)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'line-height:1',
      'padding:0',
      'font-family:inherit',
      'transition:background 0.15s, opacity 0.15s'
    ].join(';');
    clearBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"></path></svg>';
    searchEl.parentNode.appendChild(clearBtn);
  }

  function bindFilterBar() {
    if (_sortMenuCleanup) {
      _sortMenuCleanup();
      _sortMenuCleanup = null;
    }

    const searchEl = mountEl.querySelector('#s5-search');
    if (searchEl) {
      ensureSearchClearButton(searchEl);
      searchEl.addEventListener('input', function() {
        clearTimeout(searchDebounce);
        const val = this.value.trim();
        searchDebounce = setTimeout(() => {
          filterState.search = val;
          currentPage = 1;
          syncSearchClearButton();
          renderProductPage({ keepFilterBar: true });
        }, 200);
      });
    }

    const clearBtn = mountEl.querySelector('#s5-search-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      filterState.search = '';
      currentPage = 1;
      const searchInput = mountEl.querySelector('#s5-search');
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      syncSearchClearButton();
      renderProductPage({ keepFilterBar: true });
    });
    syncSearchClearButton();


    // ── Custom sort dropdown — body-teleported to escape overflow:hidden ──────
    // Remove any stale body-menu from a previous render cycle
    const staleMenu = document.getElementById('s5-body-sort-menu');
    if (staleMenu) staleMenu.remove();

    const trigger = mountEl.querySelector('#s5-sort-trigger');

    // Build the floating menu and append to <body>
    const sortMenuHTML2 = SORT_OPTIONS.map(opt => {
      const isActive = sortState.field === opt.value;
      return `<div class="s5-sort-option ${isActive ? 'active' : ''}" data-value="${opt.value}"
        style="display:flex;align-items:center;gap:10px;padding:10px 14px;
               font-size:12px;font-weight:600;
               color:${isActive ? '#f59e0b' : 'rgba(255,255,255,0.65)'};
               cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04);
               font-family:'Cairo',sans-serif;direction:${isAr ? 'rtl' : 'ltr'};
               background:${isActive ? 'rgba(245,158,11,0.12)' : 'transparent'};
               transition:background 0.15s,color 0.15s">
        <span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:#f59e0b;
                     opacity:${isActive ? 1 : 0};transition:opacity 0.15s"></span>
        <span style="font-size:14px;line-height:1">${opt.icon}</span>
        <span>${opt.label}</span>
        ${isActive ? `<svg style="margin-right:auto;flex-shrink:0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
      </div>`;
    }).join('');

    const bodyMenu = document.createElement('div');
    bodyMenu.id = 's5-body-sort-menu';
    bodyMenu.innerHTML = `
      <div style="padding:10px 14px 8px;border-bottom:1px solid rgba(255,255,255,0.06);
                  font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);
                  text-transform:uppercase;letter-spacing:0.6px;direction:${isAr ? 'rtl' : 'ltr'}">${s5Txt('Sort By', 'ترتيب حسب')}</div>
      ${sortMenuHTML2}`;
    bodyMenu.style.cssText = `
      position:fixed;
      background:#0f1523;
      border:1px solid rgba(255,255,255,0.14);
      border-radius:12px;
      overflow:hidden;
      z-index:2147483647;
      box-shadow:0 20px 60px rgba(0,0,0,0.85),0 0 0 1px rgba(255,255,255,0.04);
      opacity:0;
      transform:translateY(-8px) scale(0.97);
      pointer-events:none;
      transition:opacity 0.2s ease,transform 0.2s cubic-bezier(0.4,0,0.2,1);
      min-width:180px;
      direction:${isAr ? 'rtl' : 'ltr'};
    `;
    document.body.appendChild(bodyMenu);

    function positionMenu() {
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      bodyMenu.style.top  = (rect.bottom + 6) + 'px';
      // Align right edge of menu to right edge of trigger
      const menuW = bodyMenu.offsetWidth || 180;
      bodyMenu.style.left = (rect.right - menuW) + 'px';
    }

    function openMenu() {
      if (!trigger) return;
      positionMenu();
      bodyMenu.style.opacity       = '1';
      bodyMenu.style.transform     = 'translateY(0) scale(1)';
      bodyMenu.style.pointerEvents = 'all';
      trigger.classList.add('open');
      _dropdownOpen = true;
    }
    function closeMenu() {
      bodyMenu.style.opacity       = '0';
      bodyMenu.style.transform     = 'translateY(-8px) scale(0.97)';
      bodyMenu.style.pointerEvents = 'none';
      if (trigger) trigger.classList.remove('open');
      _dropdownOpen = false;
    }
    function toggleMenu() {
      if (_dropdownOpen) closeMenu(); else openMenu();
    }

    if (trigger) {
      trigger.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(); }
        if (e.key === 'Escape') closeMenu();
      });
    }

    // Outside-click closes menu; also clean up body menu when section unmounts
    function s5OutsideClick(e) {
      const dropdown = mountEl.querySelector('#s5-sort-dropdown');
      if (dropdown && !dropdown.contains(e.target) && !bodyMenu.contains(e.target)) closeMenu();
      if (!mountEl.isConnected) {
        if (_sortMenuCleanup) _sortMenuCleanup();
      }
    }
    document.addEventListener('click', s5OutsideClick);
    _sortMenuCleanup = function () {
      document.removeEventListener('click', s5OutsideClick);
      if (bodyMenu && bodyMenu.parentNode) bodyMenu.remove();
      if (trigger) trigger.classList.remove('open');
      _dropdownOpen = false;
    };

    // Option click
    bodyMenu.querySelectorAll('.s5-sort-option').forEach(opt => {
      opt.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255,255,255,0.06)';
        this.style.color      = '#fff';
      });
      opt.addEventListener('mouseleave', function() {
        const isActive = sortState.field === this.dataset.value;
        this.style.background = isActive ? 'rgba(245,158,11,0.12)' : 'transparent';
        this.style.color      = isActive ? '#f59e0b' : 'rgba(255,255,255,0.65)';
      });
      opt.addEventListener('click', function(e) {
        e.stopPropagation();
        const val = this.dataset.value;
        if (val) {
          sortState.field = val;
          sortState.dir   = 'desc';
          currentPage     = 1;
          closeMenu();
          renderProductPage();
          updateSortArrows();
        }
      });
    });

    // Direction toggle
    const dirBtn = mountEl.querySelector('#s5-sort-dir-btn');
    if (dirBtn) {
      dirBtn.addEventListener('click', () => {
        sortState.dir = sortState.dir === 'desc' ? 'asc' : 'desc';
        const descArrow = '<path d="M12 20V4M5 13l7 7 7-7"/>';
        const ascArrow  = '<path d="M12 4v16M5 11l7-7 7 7"/>';
        const svgEl = dirBtn.querySelector('svg');
        if (svgEl) svgEl.innerHTML = sortState.dir === 'desc' ? descArrow : ascArrow;
        dirBtn.title = sortState.dir === 'desc' ? s5Txt('Ascending', 'تصاعدي') : s5Txt('Descending', 'تنازلي');
        dirBtn.style.cssText += ';color:#f59e0b;border-color:rgba(245,158,11,0.4);background:rgba(245,158,11,0.1)';
        setTimeout(() => {
          if (dirBtn.isConnected) {
            dirBtn.style.color       = 'rgba(255,255,255,0.6)';
            dirBtn.style.borderColor = 'rgba(255,255,255,0.1)';
            dirBtn.style.background  = 'rgba(255,255,255,0.04)';
          }
        }, 350);
        currentPage = 1;
        renderProductPage();
        updateSortArrows();
      });
      dirBtn.addEventListener('mouseenter', () => {
        dirBtn.style.background  = 'rgba(255,255,255,0.08)';
        dirBtn.style.borderColor = 'rgba(255,255,255,0.2)';
        dirBtn.style.color       = '#fff';
      });
      dirBtn.addEventListener('mouseleave', () => {
        dirBtn.style.background  = 'rgba(255,255,255,0.04)';
        dirBtn.style.borderColor = 'rgba(255,255,255,0.1)';
        dirBtn.style.color       = 'rgba(255,255,255,0.6)';
      });
    }

    const clearSortBtn = mountEl.querySelector('#s5-clear-sort');
    if (clearSortBtn) {
      clearSortBtn.addEventListener('click', () => {
        sortState.field = 'default';
        sortState.dir = 'asc';
        currentPage = 1;
        renderProductPage();
        updateSortArrows();
      });
    }

    // FIX 3: Status pills — active state now visible because filterBarHTML re-renders
    mountEl.querySelectorAll('.s5-pill').forEach(pill => {
      pill.addEventListener('click', function(e) {
        e.preventDefault();
        const key = e.currentTarget.dataset.key || this.dataset.key;
        filterState.statusKey = key;
        
        if (key === 'shipping') { sortState.field = 'shippingCount'; sortState.dir = 'desc'; }
        else if (key === 'processing') { sortState.field = 'processingCount'; sortState.dir = 'desc'; }
        else if (key === 'failed') { sortState.field = 'failedCount'; sortState.dir = 'desc'; }
        else if (key === 'canceled') { sortState.field = 'canceledCount'; sortState.dir = 'desc'; }
        else if (key === 'delivered') { sortState.field = 'deliveredCount'; sortState.dir = 'desc'; }
        else { sortState.field = 'default'; sortState.dir = 'asc'; }

        currentPage = 1;
        renderProductPage(); // re-renders entire filter bar including pills
        
        // Ensure column headers refresh to show the newly sorted column
        const headersWrap = mountEl.querySelector('.s5-header-cols');
        if (headersWrap) {
          headersWrap.outerHTML = columnHeadersHTML();
          if (typeof bindSortCols === 'function') bindSortCols();
        }
      });
    });
  }
  bindFilterBar();

  // ── Column sort ───────────────────────────────────────────────────────────
  function bindSortCols() {
    mountEl.querySelectorAll('.s5-sort-col').forEach(btn => {
      btn.addEventListener('click', function() {
        const field = this.dataset.field;
        if (sortState.field === field && field !== 'default') {
          sortState.dir = sortState.dir === 'desc' ? 'asc' : 'desc';
        } else {
          sortState.field = field;
          sortState.dir   = 'desc';
        }
        const labelEl = mountEl.querySelector('#s5-sort-label');
        if (labelEl) labelEl.textContent = activeSortLabel();
        updateSortArrows();
        currentPage = 1;
        renderProductPage();
      });
    });
  }
  bindSortCols();

  // ── Expand buttons ────────────────────────────────────────────────────────
  function bindExpandButtons() {
    mountEl.querySelectorAll('.s5-expand-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const idx    = this.dataset.idx;
        const panel  = document.getElementById(`s5-detail-${idx}`);
        const isOpen = panel && panel.style.maxHeight && panel.style.maxHeight !== '0px' && panel.style.maxHeight !== '0' && panel.style.maxHeight !== '';

        mountEl.querySelectorAll('.s5-detail-panel').forEach(p => {
          p.style.maxHeight    = '0';
          p.style.opacity      = '0';
          p.style.padding      = '0 24px';
          p.style.marginBottom = '0';
          p.style.borderColor  = 'rgba(255,255,255,0)';
        });
        mountEl.querySelectorAll('.s5-expand-arrow').forEach(a => {
          a.style.transform = 'rotate(0deg)';
          a.setAttribute('stroke', 'rgba(255,255,255,0.5)');
        });
        mountEl.querySelectorAll('.s5-expand-btn').forEach(b => {
          b.style.background = 'rgba(255,255,255,0.05)';
          b.style.borderColor = 'rgba(255,255,255,0.12)';
        });

        if (!isOpen && panel) {
          const product = pagedProducts()[parseInt(idx, 10)];
          if (product) panel.innerHTML = detailPanelContent(product);

          requestAnimationFrame(() => {
            panel.style.maxHeight    = (panel.scrollHeight + 40) + 'px';
            panel.style.opacity      = '1';
            panel.style.padding      = '20px 24px';
            panel.style.marginBottom = '8px';
            panel.style.borderColor  = 'rgba(255,255,255,0.06)';
          });

          const arrow = this.querySelector('.s5-expand-arrow');
          if (arrow) { arrow.style.transform = 'rotate(180deg)'; arrow.setAttribute('stroke', '#f59e0b'); }
          this.style.background = 'rgba(245,158,11,0.15)';
          this.style.borderColor = 'rgba(245,158,11,0.5)';
        }
      });
    });
  }
  bindExpandButtons();

  // ── T-22: Product-row FilterBus wiring ───────────────────────────────────
  var _s5SelectedProductKey = null;

  function _clearS5Selection() {
    mountEl.querySelectorAll('.s5-product-row').forEach(function (row) {
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
    mountEl.querySelectorAll('.s5-product-row').forEach(function (row) {
      if (row._origBorderColor === undefined) row._origBorderColor = row.style.borderColor;
      if (row._origShadow === undefined) row._origShadow = row.style.boxShadow;

      if (row.dataset.productKey === productKey) {
        row.style.borderColor = 'rgba(20,184,166,0.55)';
        row.style.boxShadow   = '0 0 0 2px rgba(20,184,166,0.22), inset 3px 0 0 #14b8a6';
      }
    });
  }

  function _bindProductRowClicks() {
    mountEl.querySelectorAll('.s5-product-row').forEach(function (row) {
      if (row.dataset.s5Bound === '1') return;
      row.dataset.s5Bound = '1';
      /* row-level click — skip expand btn area */
      row.addEventListener('click', function (e) {
        if (e.target.closest('.s5-expand-btn')) return;
        var productKey = row.dataset.productKey;
        if (!productKey) return;

        if (_s5SelectedProductKey === productKey) {
          _clearS5Selection();
          if (window.DashboardFilterBus) {
            window.DashboardFilterBus.setState({ selectedProduct: null, mapMode: 'orders' });
          }
        } else {
          _selectS5Row(productKey);
          if (window.DashboardFilterBus) {
            window.DashboardFilterBus.setState({
              selectedProduct: productKey,
              mapMode: window.DashboardFilterBus.MODES
                ? window.DashboardFilterBus.MODES.PRODUCT
                : 'product'
            });
          }
        }
      });

      var mapBtn = row.querySelector('.s5-map-btn');
      if (mapBtn) {
        /* Map button: focus product AND navigate to Cities section */
        mapBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var pk = this.dataset.productKey || this.getAttribute('data-product-key');
          if (window.DashboardFilterBus) {
            window.DashboardFilterBus.setState({
              selectedProduct: pk,
              mapMode: window.DashboardFilterBus.MODES
                ? window.DashboardFilterBus.MODES.PRODUCT
                : 'product'
            });
          }
          /* Navigate to cities section */
          if (ctx && typeof ctx.onNavigate === 'function') {
            ctx.onNavigate('cities');
          } else {
            var navBtn = document.querySelector('[data-section="cities"], [data-id="cities"]');
            if (navBtn) navBtn.click();
          }
        });
      }
    });
  }
  _bindProductRowClicks();

  // ── Pagination ────────────────────────────────────────────────────────────
  function bindPagination() {
    const prev = mountEl.querySelector('#s5-prev-page');
    const next = mountEl.querySelector('#s5-next-page');
    if (prev) prev.addEventListener('click', () => {
      if (currentPage > 1) { currentPage--; renderProductPage(); scrollToRows(); }
    });
    if (next) next.addEventListener('click', () => {
      if (currentPage < totalProductPages()) { currentPage++; renderProductPage(); scrollToRows(); }
    });
  }
  bindPagination();

  function bindPageNumbers() {
    mountEl.querySelectorAll('.s5-page-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const p = parseInt(this.dataset.page, 10);
        if (p && p !== currentPage) {
          currentPage = p;
          renderProductPage();
          scrollToRows();
        }
      });
    });
  }
  bindPageNumbers();

  function scrollToRows() {
    const wrapper = mountEl.querySelector('#s5-scroll-wrapper');
    if (wrapper) wrapper.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Phase 5: Full Product Modal ──────────────────────────────────────────
  (function buildProductModal() {
    var currentModalProductKey = null;
    var currentModalCityPage = 1;
    
    /* Create modal overlay once */
    var MODAL_ID = 's5-product-modal';
    var existingModal = document.getElementById(MODAL_ID);
    if (existingModal) existingModal.remove();

    var modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'dash-overlay-scope';
    modal.style.cssText = [
      'position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;',
      'background:rgba(0,0,0,0.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);',
      'font-family:Cairo,sans-serif;direction:' + (isAr ? 'rtl' : 'ltr') + ';'
    ].join('');
    document.body.appendChild(modal);

    function pct(n, d) { return (+(n || 0)).toFixed(d != null ? d : 1) + '%'; }
    function num(n)     { return Math.round(n || 0).toLocaleString('en-US'); }
    function sar(n)     { return (window.formatSAR ? window.formatSAR(n || 0, 0) : Math.round(n || 0).toLocaleString('en-US') + ' SAR'); }
    function sb(score, type) { return (window.scoreBadge ? window.scoreBadge(score, type) : '<span>' + score + '</span>'); }

    function ndrColor(v) { return v >= 75 ? '#00e676' : v >= 55 ? '#f59e0b' : '#ef4444'; }
    function drColor(v)  { return v > 70 ? '#00e676' : v > 55 ? '#f59e0b' : '#ef4444'; }

    function modalHTML(p) {
      if (!p) return '';
      var geoD = window.dashboardGeoData;
      var gpm  = geoD && geoD.geo && geoD.geo.geoProductMap;
      var prodKey = p.key || p.sku || p.name || '';

      /* City breakdown from geoProductMap */
      var cityRows = '';
      var cityPaginationHtml = '';
      if (gpm) {
        var cityEntries = [];
        Object.keys(gpm).forEach(function (cityName) {
          var cell = gpm[cityName] && gpm[cityName][prodKey];
          // Show all cities with at least 1 order, instead of >= 3
          if (cell && cell.orders > 0) {
            var cellNdr = (cell.orders || 0) > 0 ? (cell.delivered || 0) / (cell.orders || 0) * 100 : 0;
            cellNdr = isNaN(cellNdr) ? 0 : cellNdr;
            cityEntries.push({ name: cityName, orders: cell.orders, ndr: cellNdr,
              delivered: cell.delivered || 0, commission: cell.commission || 0,
              riskScore: cell.riskScore || 0, scalingScore: cell.scalingScore || 0 });
          }
        });
        cityEntries.sort(function (a, b) { return b.orders - a.orders; });

        var MODAL_CITY_PAGE_SIZE = 5;
        var totalCities = cityEntries.length;
        var totalPages = Math.ceil(totalCities / MODAL_CITY_PAGE_SIZE);
        var startIndex = (currentModalCityPage - 1) * MODAL_CITY_PAGE_SIZE;
        var pageEntries = cityEntries.slice(startIndex, startIndex + MODAL_CITY_PAGE_SIZE);

        pageEntries.forEach(function (c, i) {
          var barW = Math.min(100, Math.round(c.orders / (cityEntries[0] && cityEntries[0].orders || 1) * 100));
          cityRows += '<div style="display:grid;grid-template-columns:1fr 60px 60px 70px;gap:8px;align-items:center;' +
            'padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.03);margin-bottom:4px;">' +
            '<div>' +
              '<div style="font-size:12px;font-weight:800;color:#fff;margin-bottom:3px">' + esc(tx(c.name)) + '</div>' +
              '<div style="height:3px;background:rgba(255,255,255,0.06);border-radius:3px">' +
                '<div style="height:100%;width:' + barW + '%;background:linear-gradient(90deg,#7c3aed,#14b8a6);border-radius:3px;transition:width 0.6s ease"></div>' +
              '</div>' +
            '</div>' +
            '<div style="text-align:center;font-size:12px;font-weight:700;color:rgba(255,255,255,0.7)">' + num(c.orders) + '</div>' +
            '<div style="text-align:center;font-size:12px;font-weight:800;color:' + ndrColor(c.ndr) + '">' + pct(c.ndr) + '</div>' +
            '<div style="text-align:center">' + sb(c.scalingScore, 'scale') + '</div>' +
          '</div>';
        });

        if (totalPages > 1 && window.renderDashboardPagination) {
          cityPaginationHtml = '<div style="margin-top:10px;">' + window.renderDashboardPagination({
            currentPage: currentModalCityPage,
            totalPages: totalPages,
            pageButtonClass: 's5-modal-city-page-btn',
            prevClass: 's5-modal-city-prev',
            nextClass: 's5-modal-city-next',
            className: 'dash-pagination-compact s5-modal-pagination',
            infoText: ''
          }) + '</div>';
        }
      }

      /* Funnel bars */
      var total = p.placedCount || 1;
      var funnel = [
        { label: s5Txt('Delivered', 'تم التسليم'),  count: p.deliveredCount || 0, color: '#00e676' },
        { label: s5Txt('In Shipping', 'قيد الشحن'),   count: p.shippingCount  || 0, color: '#14b8a6' },
        { label: s5Txt('Confirmed', 'مؤكد'),        count: p.confirmedCount || 0, color: '#3b82f6' },
        { label: p5Txt('funnelFailed'), count: p.failedCount || 0, color: '#f97316' },
        { label: p5Txt('funnelCanceled'), count: p.canceledCount || 0, color: '#ef4444' },
        { label: s5Txt('Pending', 'قيد الانتظار'),count: (p.pendingCount||0)+(p.waitingCount||0), color: '#a855f7' },
      ];

      var _fIsLight = document.documentElement.getAttribute('data-theme')==='light';
      var funnelHTML = funnel.map(function (f) {
        var barW = Math.round((f.count / total) * 100);
        return '<div style="margin-bottom:8px">' +
          '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">' +
            '<span style="color:' + (_fIsLight ? 'rgba(30,10,60,0.6)' : 'rgba(255,255,255,0.55)') + '">' + f.label + '</span>' +
            '<span style="font-weight:700;color:' + (_fIsLight ? 'rgba(15,5,30,0.9)' : '#fff') + '">' + num(f.count) + ' <span style="color:' + (_fIsLight ? 'rgba(15,5,30,0.45)' : 'rgba(255,255,255,0.35)') + ';font-weight:500">(' + barW + '%)</span></span>' +
          '</div>' +
          '<div style="height:6px;background:' + (_fIsLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.06)') + ';border-radius:6px;overflow:hidden">' +
            '<div style="height:100%;width:' + barW + '%;background:' + f.color + ';border-radius:6px;transition:width 0.7s ease"></div>' +
          '</div>' +
        '</div>';
      }).join('');

      var ndrVal = typeof p.ndr === 'number' ? p.ndr : (p.ndrPct || 0);
      var drVal  = typeof p.drRate === 'number' ? p.drRate : (typeof p.dr === 'number' ? p.dr : (p.deliveryPct || 0));
      var cancelVal = typeof p.cancelPct === 'number' ? p.cancelPct : (p.cancel || 0);
      var cnfVal = typeof p.confirmationPct === 'number' ? p.confirmationPct : (p.confirmation || 0);

      return '<div style="background:#0c1121;border:1px solid rgba(255,255,255,0.1);border-radius:22px;' +
        'width:min(860px,96vw);max-height:88vh;overflow-y:auto;position:relative;' +
        'box-shadow:0 30px 80px rgba(0,0,0,0.6);">' +

        /* Header */
        '<div style="padding:24px 28px 20px;border-bottom:1px solid rgba(255,255,255,0.07);' +
          'display:flex;align-items:flex-start;justify-content:space-between;gap:16px;' +
          'position:sticky;top:0;background:#0c1121;z-index:10;border-radius:22px 22px 0 0;">' +
          '<div style="display:flex;align-items:center;gap:14px;">' +
            '<div style="width:46px;height:46px;border-radius:14px;background:rgba(124,58,237,0.15);' +
              'border:1px solid rgba(124,58,237,0.3);display:flex;align-items:center;justify-content:center;">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>' +
            '</div>' +
            '<div>' +
              '<div style="font-size:18px;font-weight:900;color:#fff">' + esc(p.name || s5Txt('product', 'منتج')) + '</div>' +
              '<div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:3px">SKU: ' + esc(p.sku || '—') + '  ·  ' + s5Txt('Rank #', 'رتبة #') + esc(p.rank || '—') + '</div>' +
            '</div>' +
          '</div>' +
          '<button id="s5-modal-close" style="background:rgba(255,255,255,0.07);border:none;color:rgba(255,255,255,0.6);' +
            'font-size:18px;width:34px;height:34px;border-radius:10px;cursor:pointer;flex-shrink:0;' +
            'display:flex;align-items:center;justify-content:center;transition:all 0.2s;font-family:inherit;' +
            'line-height:1;">✕</button>' +
        '</div>' +

        /* KPI bar */
        '<div class="s5-modal-kpi-grid" style="padding:20px 28px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;' +
          'border-bottom:1px solid rgba(255,255,255,0.06);">' +
          [
            { label: s5Txt('Total Orders', 'إجمالي الطلبات'), value: num(total),          color: '#a855f7', badge: null },
            { label: s5Txt('Delivery Rate', 'معدل التسليم'),   value: pct(drVal),          color: '#00e676', badge: null },
            { label: s5Txt('Cancel Rate', 'معدل الإلغاء'),   value: pct(cancelVal),      color: '#ef4444', badge: null },
            { label: s5Txt('Confirm Rate', 'التأكيد'),        value: pct(cnfVal),         color: '#14b8a6', badge: null },
            { label: s5Txt('Scale Index', 'مؤشر التوسع'),    value: '',                  color: '#f59e0b', badge: sb(p.scalingScore || 0, 'scale') },
            { label: p5Txt('adSpend'), value: productMoney(p.allocatedAdSpend), color: '#60a5fa', badge: null, help: p5Txt('adSpendHelp') },
            { label: p5Txt('cpa'), value: productMoney(p.cpa), color: '#a78bfa', badge: null, help: p5Txt('cpaHelp') },
            { label: p5Txt('pnl'), value: productMoney(p.profitLoss), color: p.profitLoss >= 0 ? '#00e676' : '#ef4444', badge: null, help: p5Txt('pnlHelp') },
          ].map(function (k) {
            return '<div' + (k.help ? ' title="' + attr(k.help) + '"' : '') + ' style="background:#0b1423;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px 10px;text-align:center">' +
              '<div style="font-size:' + (k.badge ? '0' : (k.help ? '13' : '18')) + 'px;font-weight:900;color:' + k.color + ';line-height:1;margin-bottom:6px;white-space:nowrap">' + k.value + (k.badge || '') + '</div>' +
              '<div style="font-size:10px;color:rgba(255,255,255,0.38);font-weight:700">' + k.label + '</div>' +
            '</div>';
          }).join('') +
        '</div>' +

        /* Body: funnel + city table */
        '<div style="padding:24px 28px;display:grid;grid-template-columns:1fr 1fr;gap:24px;">' +

          /* Funnel */
          '<div>' +
            '<div style="font-size:12px;font-weight:800;color:rgba(255,255,255,0.45);margin-bottom:14px;">' + s5Txt("Order Funnel", "مسار الطلبات") + '</div>' +
            funnelHTML +
          '</div>' +

          /* City breakdown */
          '<div>' +
            '<div style="font-size:12px;font-weight:800;color:rgba(255,255,255,0.45);margin-bottom:14px;">' + s5Txt("City Performance", "أداء المدن") + '</div>' +
            (cityRows
              ? '<div style="font-size:10px;color:rgba(255,255,255,0.3);display:grid;grid-template-columns:1fr 60px 60px 70px;gap:8px;padding:0 10px;margin-bottom:6px;">' +
                  '<span>' + s5Txt('City', 'المدينة') + '</span><span style="text-align:center">' + s5Txt('Orders', 'طلبات') + '</span><span style="text-align:center">NDR</span><span style="text-align:center">' + s5Txt('Scale', 'توسع') + '</span>' +
                '</div>' + cityRows + cityPaginationHtml
              : '<div style="color:rgba(255,255,255,0.25);font-size:12px;padding:20px 0">' + s5Txt('No geographical data available', 'لا توجد بيانات جغرافية متاحة') + '</div>') +
          '</div>' +

        '</div>' +
      '</div>';
    }

    function refreshModal() {
      var p = PRODUCT_BY_KEY[currentModalProductKey] || null;
      if (!p) return;
      modal.innerHTML = modalHTML(p);
      bindModalCityPagination();
      var closeBtn = modal.querySelector('#s5-modal-close');
      if (closeBtn) closeBtn.addEventListener('click', closeModal);
    }
    refreshProductModal = refreshModal;

    function bindModalCityPagination() {
      if (window.bindDashboardPagination) {
        window.bindDashboardPagination(modal, {
          pageButtonSelector: '.s5-modal-city-page-btn',
          prevSelector: '.s5-modal-city-prev',
          nextSelector: '.s5-modal-city-next',
          onPage: function (p) { currentModalCityPage = p; refreshModal(); },
          onPrev: function () { currentModalCityPage--; refreshModal(); },
          onNext: function () { currentModalCityPage++; refreshModal(); }
        });
      }
    }

    function openModal(productKey) {
      currentModalProductKey = productKey;
      currentModalCityPage = 1;

      var p = PRODUCT_BY_KEY[productKey] || null;
      if (!p) return;
      modal.innerHTML = modalHTML(p);
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';

      /* Animate in */
      var panel = modal.firstElementChild;
      if (panel) {
        panel.style.transform = 'scale(0.92) translateY(20px)';
        panel.style.opacity   = '0';
        panel.style.transition = 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1),opacity 0.22s ease';
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            panel.style.transform = 'scale(1) translateY(0)';
            panel.style.opacity   = '1';
          });
        });
      }

      var closeBtn = modal.querySelector('#s5-modal-close');
      if (closeBtn) closeBtn.addEventListener('click', closeModal);
      
      bindModalCityPagination();
    }

    function closeModal() {
      var panel = modal.firstElementChild;
      if (panel) {
        panel.style.transform = 'scale(0.94) translateY(16px)';
        panel.style.opacity   = '0';
        setTimeout(function () {
          modal.style.display = 'none';
          document.body.style.overflow = '';
        }, 220);
      } else {
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }
    }

    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });

    function onModalKeydown(e) {
      if (e.key === 'Escape' && modal.style.display !== 'none') closeModal();
    }
    document.addEventListener('keydown', onModalKeydown);

    function bindModalRows(root) {
      root = root || mountEl;
      root.querySelectorAll('.s5-product-row').forEach(function (row) {
        if (row.dataset.modalBound === '1') return;
        row.dataset.modalBound = '1';
      });

      root.querySelectorAll('.s5-product-row [data-modal-open]').forEach(function (el) {
        if (el.dataset.modalBound === '1') return;
        el.dataset.modalBound = '1';
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          var row = el.closest('.s5-product-row');
          if (row) openModal(row.dataset.productKey);
        });
      });
    }
    bindModalRows(mountEl);

    /* Expose globally so city drawer can open it */
    window.openProductModal = openModal;
    window.s5BindProductModalRows = bindModalRows;

    var modalObserver = new MutationObserver(function () {
      if (!document.body.contains(mountEl)) {
        document.removeEventListener('keydown', onModalKeydown);
        if (modal.parentNode) modal.remove();
        modalObserver.disconnect();
      }
    });
    if (mountEl.parentNode) modalObserver.observe(mountEl.parentNode, { childList: true });
    addProductCleanup(function () {
      document.removeEventListener('keydown', onModalKeydown);
      if (modal.parentNode) modal.remove();
      modalObserver.disconnect();
    });
  })();

  if (window.DashboardRoiState) {
    if (mountEl._s5RoiListener) {
      window.DashboardRoiState.unsubscribe(mountEl._s5RoiListener);
    }
    mountEl._s5RoiListener = function (settings) {
      if (ctx && ctx.sectionId && ctx.sectionId !== 'products') return;
      if (String(settings.accountId) !== String(productAccountId)) return;
      productFinancialSettings = settings;
      applyProductFinancials();
      listCache = null;
      listCacheKey = '';
      renderProductPage();
      refreshProductModal();
    };
    window.DashboardRoiState.subscribe(mountEl._s5RoiListener);
    var productSettingsObserver = new MutationObserver(function () {
      if (!document.body.contains(mountEl)) {
        window.DashboardRoiState.unsubscribe(mountEl._s5RoiListener);
        mountEl._s5RoiListener = null;
        productSettingsObserver.disconnect();
      }
    });
    if (mountEl.parentNode) productSettingsObserver.observe(mountEl.parentNode, { childList: true });
    addProductCleanup(function () {
      if (mountEl._s5RoiListener) {
        window.DashboardRoiState.unsubscribe(mountEl._s5RoiListener);
        mountEl._s5RoiListener = null;
      }
      productSettingsObserver.disconnect();
    });
  }

  // ── Compact toggle ────────────────────────────────────────────────────────
  if (window.DashboardMarketingState) {
    if (mountEl._s5MarketingListener) {
      window.DashboardMarketingState.unsubscribe(mountEl._s5MarketingListener);
    }
    mountEl._s5MarketingListener = function (status) {
      if (ctx && ctx.sectionId && ctx.sectionId !== 'products') return;
      if (String(status.accountId) !== String(productAccountId)) return;
      productMarketingState = status;
      applyProductFinancials();
      listCache = null;
      listCacheKey = '';
      renderProductPage();
      refreshProductModal();
    };
    window.DashboardMarketingState.subscribe(mountEl._s5MarketingListener);
    var productMarketingObserver = new MutationObserver(function () {
      if (!document.body.contains(mountEl)) {
        window.DashboardMarketingState.unsubscribe(mountEl._s5MarketingListener);
        mountEl._s5MarketingListener = null;
        productMarketingObserver.disconnect();
      }
    });
    if (mountEl.parentNode) productMarketingObserver.observe(mountEl.parentNode, { childList: true });
    addProductCleanup(function () {
      if (mountEl._s5MarketingListener) {
        window.DashboardMarketingState.unsubscribe(mountEl._s5MarketingListener);
        mountEl._s5MarketingListener = null;
      }
      productMarketingObserver.disconnect();
    });
    if (typeof window.DashboardMarketingState.load === 'function') {
      window.DashboardMarketingState.load(productAccountId);
    }
  }

  const toggleBtn = document.getElementById('s5-view-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      viewMode = viewMode === 'expanded' ? 'compact' : 'expanded';
      this.innerHTML = (viewMode === 'compact')
        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> موسّع`
        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> مضغوط`;
      const headerEl = mountEl.querySelector('.s5-header-cols');
      if (headerEl) headerEl.outerHTML = columnHeadersHTML();
      bindSortCols();
      renderProductPage();
    });
    toggleBtn.addEventListener('mouseenter', () => { toggleBtn.style.background = 'rgba(255,255,255,0.07)'; });
    toggleBtn.addEventListener('mouseleave', () => { toggleBtn.style.background = 'rgba(255,255,255,0.03)'; });
  }
  if (window.dashboardI18n) window.dashboardI18n.apply(mountEl);
  if (window.KhodUI) window.KhodUI.enhance(mountEl);
  }, 24);
};
