(function () {
  "use strict";

  var PLATFORMS = ["tiktok", "snapchat", "facebook"];
  var CAP = 20;
  var BUILD_CACHE = [];

  function parseNumber(value) {
    if (value == null || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    var cleaned = String(value).replace(/,/g, "").replace(/%/g, "").trim();
    var n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function num(value, digits) {
    var n = parseNumber(value);
    if (digits == null) return n;
    return Number(n.toFixed(digits));
  }

  function textKey(value) {
    var arabicDigits = "٠١٢٣٤٥٦٧٨٩";
    return String(value || "").toLowerCase().normalize("NFKC")
      .replace(/[٠-٩]/g, function (digit) { return String(arabicDigits.indexOf(digit)); })
      .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, "")
      .replace(/\u0640/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/[ىئ]/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/[ةه]/g, "ه")
      .replace(/[^\w\u0600-\u06ff]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasTerm(text, term) {
    return !!term && (" " + text + " ").indexOf(" " + term + " ") !== -1;
  }

  function productTokens(name) {
    var stop = {
      ad: true, ads: true, campaign: true, sales: true, sale: true, lead: true, leads: true,
      tiktok: true, tik: true, tok: true, snapchat: true, snap: true, facebook: true, meta: true,
      ksa: true, saudi: true, offer: true, new: true, test: true, original: true, product: true,
      "منتج": true, "عرض": true, "جديد": true, "اصلي": true, "حمله": true, "حملة": true
    };
    return textKey(name).split(" ").filter(function (token) {
      return token.length >= 3 && !stop[token] && !/^x\d+$/i.test(token) && !/^\d+$/.test(token);
    });
  }

  function productPhrases(tokens) {
    var phrases = [];
    for (var size = 2; size <= Math.min(3, tokens.length); size += 1) {
      for (var start = 0; start <= tokens.length - size; start += 1) {
        phrases.push(tokens.slice(start, start + size).join(" "));
      }
    }
    return phrases;
  }

  function cleanProductName(name) {
    if (!name) return "";
    var clean = String(name);
    clean = clean.replace(/\s*[\(\[\{]?\d+\s*x[\)\]\}]?\s*$/i, "");
    clean = clean.replace(/\s*[\(\[\{]?x\s*\d+[\)\]\}]?\s*$/i, "");
    clean = clean.replace(/^\s*([.\-ـ|#\s]+)/, "");
    clean = clean.replace(/([.\-ـ|#\s]+)$/, "");
    return clean.trim();
  }

  function groupProductsByName(products) {
    var groups = {};
    products.forEach(function (p) {
      if (!p) return;
      var rawName = p.name || p.key || "";
      var cleanName = cleanProductName(rawName);
      var key = textKey(cleanName) || rawName;
      
      if (!groups[key]) {
        groups[key] = {
          name: cleanName || rawName,
          key: key,
          skus: [],
          placedCount: 0,
          deliveredCount: 0,
          canceledCount: 0,
          failedCount: 0,
          confirmedCount: 0,
          shippingCount: 0,
          processingCount: 0,
          waitingCount: 0,
          pendingCount: 0,
          revenue: 0,
          commission: 0,
          deliveredSales: 0,
          qty: 0,
          units: 0,
          pieces: 0,
          cityMap: {}
        };
      }
      
      var g = groups[key];
      
      var skuStr = p.sku || p.sku_code || p.skuCode || "";
      skuStr.split(",").forEach(function (s) {
        var cleanSku = s.trim();
        if (cleanSku && g.skus.indexOf(cleanSku) === -1) {
          g.skus.push(cleanSku);
        }
      });
      
      g.placedCount += num(p.placedCount || p.orders);
      g.deliveredCount += num(p.deliveredCount || p.units || p.delivered);
      g.canceledCount += num(p.canceledCount || 0);
      g.failedCount += num(p.failedCount || p.realFailedCount || 0);
      g.confirmedCount += num(p.confirmedCount || 0);
      g.shippingCount += num(p.shippingCount || 0);
      g.processingCount += num(p.processingCount || 0);
      g.waitingCount += num(p.waitingCount || 0);
      g.pendingCount += num(p.pendingCount || 0);
      g.revenue += num(p.revenue || 0);
      g.commission += num(p.commission || 0);
      g.deliveredSales += num(p.deliveredSales || p.sales || 0);
      g.qty += num(p.qty || p.totalPieces || 0);
      g.units += num(p.units || 0);
      g.pieces += num(p.pieces || 0);
      
      var cities = p.cityBreakdown || [];
      cities.forEach(function (c) {
        var cityName = c.name || c.city || "";
        if (!cityName) return;
        if (!g.cityMap[cityName]) {
          g.cityMap[cityName] = {
            name: cityName,
            count: 0,
            delivered: 0,
            canceled: 0,
            commission: 0,
            revenue: 0
          };
        }
        var gc = g.cityMap[cityName];
        gc.count += num(c.count || c.orders);
        gc.delivered += num(c.delivered || 0);
        gc.canceled += num(c.canceled || 0);
        gc.commission += num(c.commission || 0);
        gc.revenue += num(c.revenue || 0);
      });
    });
    
    return Object.keys(groups).map(function (k) {
      var g = groups[k];
      
      var cityBreakdown = Object.keys(g.cityMap).map(function (cityName) {
        var c = g.cityMap[cityName];
        var total = c.count;
        var ndr = total > 0 ? parseFloat(((c.delivered / total) * 100).toFixed(1)) : 0;
        return {
          name: c.name,
          city: c.name,
          count: c.count,
          orders: c.count,
          delivered: c.delivered,
          canceled: c.canceled,
          ndr: ndr,
          ndrPct: ndr,
          commission: c.commission,
          revenue: c.revenue
        };
      }).sort(function (a, b) { return b.count - a.count; });
      
      var placed = g.placedCount;
      var activeTotal = g.placedCount - g.pendingCount;
      var delivered = g.deliveredCount;
      
      var ndrPct = placed > 0 ? parseFloat(((delivered / placed) * 100).toFixed(1)) : 0;
      var drPct = activeTotal > 0 ? parseFloat(((delivered / activeTotal) * 100).toFixed(1)) : 0;
      var cancelPct = placed > 0 ? parseFloat(((g.canceledCount / placed) * 100).toFixed(1)) : 0;
      var confirmationPct = placed > 0 ? parseFloat((((placed - g.pendingCount) / placed) * 100).toFixed(1)) : 0;
      
      var deliveredAov = delivered > 0 ? parseFloat((g.deliveredSales / delivered).toFixed(2)) : 0;
      
      return {
        key: g.name,
        sku: g.skus.join(", "),
        name: g.name,
        units: g.deliveredCount,
        pieces: g.pieces || g.qty,
        placedCount: g.placedCount,
        qty: g.qty,
        revenue: g.revenue,
        commission: g.commission,
        deliveredSales: g.deliveredSales,
        deliveredAov: deliveredAov,
        deliveredCount: g.deliveredCount,
        deliveryRate: ndrPct,
        drRate: drPct,
        totalPieces: g.qty,
        canceledCount: g.canceledCount,
        failedCount: g.failedCount,
        confirmedCount: g.confirmedCount,
        shippingCount: g.shippingCount,
        processingCount: g.processingCount,
        waitingCount: g.waitingCount,
        pendingCount: g.pendingCount,
        confirmationPct: confirmationPct,
        cancelPct: cancelPct,
        ndrPct: ndrPct,
        deliveryPct: ndrPct,
        cityBreakdown: cityBreakdown
      };
    });
  }

  function validSkus(product) {
    var raw = product && (product.sku || product.sku_code || product.skuCode) || "";
    var skus = [];
    raw.split(/[\s,]+/).forEach(function (part) {
      var sku = textKey(part);
      if (!sku || sku === "n a" || sku === "na") return;
      if (/[a-z\u0600-\u06ff]/i.test(sku) || /\d{6,}/.test(sku)) {
        if (skus.indexOf(sku) === -1) {
          skus.push(sku);
        }
      }
    });
    return skus;
  }

  function campaignName(row) {
    return String(row && (row.campaign || row.campaignName || row.name || row.campaign_name) || "Unnamed campaign");
  }

  function campaignId(row) {
    return String(row && (row.campaign_id || row.campaignId || row.campaignid || row.id) || "");
  }

  function platformOf(row, fallback) {
    return String(row && (row.platform || row.source || row.channel) || fallback || "unknown").toLowerCase();
  }

  function objectiveOf(row) {
    var raw = textKey((row && (
      row.campaign_objective ||
      row.campaignObjective ||
      row.objective ||
      row.optimization_goal ||
      row.optimizationGoal ||
      row.adsset_optimization_goal ||
      row.buyingType ||
      row.buying_type
    )) || "");
    var name = textKey(campaignName(row));
    var value = raw + " " + name;
    if (/website\s+leads?|lead\s+on\s+website|web\s+lead/.test(value) || hasTerm(value, "leads") || hasTerm(value, "lead")) {
      return "website_leads";
    }
    if (hasTerm(value, "sales") || hasTerm(value, "sale") || hasTerm(value, "purchase") || hasTerm(value, "conversions")) {
      return "sales";
    }
    return raw || "unknown";
  }

  function statusOf(row) {
    return String(row && (
      row.campaign_status ||
      row.campaign_effective_status ||
      row.effective_status ||
      row.status ||
      row.effectiveStatus ||
      row.campaignStatus
    ) || "unknown").toLowerCase();
  }

  function campaignSpendToSar(row, fallbackCurrency) {
    var amount = parseNumber(row && (
      row.rawSpend != null ? row.rawSpend :
      row.spend != null ? row.spend :
      row.adSpend != null ? row.adSpend :
      row.cost != null ? row.cost :
      row.amount_spent
    ) || 0);
    var currency = String(row && row.currency || fallbackCurrency || "SAR").toUpperCase();
    if (currency === "USD") return amount * 3.75;
    return amount;
  }

  function cleanCurrency(currency, fallback) {
    var value = String(currency || fallback || "SAR").toUpperCase();
    if (window.TaagerCurrency && typeof window.TaagerCurrency.cleanCurrency === "function") {
      return window.TaagerCurrency.cleanCurrency(value, fallback || "SAR");
    }
    return ["SAR", "USD"].indexOf(value) !== -1 ? value : "SAR";
  }

  function campaignRoiSettings(accountId, data) {
    var fallback = Object.assign({
      currency: data && data.meta && data.meta.activeCurrency || window.dashboardActiveCurrency || "SAR",
    }, data && data.roi || {});
    return window.DashboardRoiState && typeof window.DashboardRoiState.get === "function"
      ? window.DashboardRoiState.get(accountId, fallback)
      : fallback;
  }

  function sarToReportingCurrency(value, reportingCurrency) {
    var amount = parseNumber(value);
    var currency = cleanCurrency(reportingCurrency, "SAR");
    if (window.TaagerCurrency && typeof window.TaagerCurrency.convert === "function") {
      return window.TaagerCurrency.convert(amount, "SAR", currency);
    }
    if (currency === "USD") return amount / 3.75;
    return amount;
  }

  function metric(row, keys) {
    for (var i = 0; i < keys.length; i += 1) {
      var value = row && row[keys[i]];
      if (value != null && value !== "") return num(value, 4);
    }
    return 0;
  }

  function trafficViewMetrics(row) {
    var landingPageViews = metric(row, ["landingPageViews", "landing_page_views", "actions_landing_page_view", "total_pageview", "conversion_page_views"]);
    var contentViews = metric(row, ["contentViews", "content_views", "actions_view_content", "page_content_view_events", "conversion_view_content"]);
    return {
      landingPageViews: landingPageViews,
      contentViews: contentViews,
      trafficViews: landingPageViews > 0 ? landingPageViews : contentViews
    };
  }

  function rowCurrency(row, state) {
    return String(row && (row.currency || row.account_currency) || (state && state.currency) || "SAR").toUpperCase();
  }

  function campaignPerformance(row, spendSar, fallbackCurrency) {
    var rawCurrency = fallbackCurrency || "SAR";
    var rawSpend = metric(row, ["rawSpend", "spend", "adSpend", "cost", "amount_spent"]);
    var impressions = metric(row, ["impressions", "reach"]);
    var clicks = metric(row, ["clicks", "link_clicks", "outbound_clicks_outbound_click", "unique_clicks"]);
    var ctr = metric(row, ["ctr", "website_ctr_link_click", "unique_ctr", "unique_link_clicks_ctr", "outbound_clicks_ctr_outbound_click"]);
    var cpc = metric(row, ["cpc", "cost_per_link_click", "cost_per_unique_click"]);
    var cpm = metric(row, ["cpm"]);
    var views = trafficViewMetrics(row);
    if (!ctr && impressions > 0 && clicks > 0) ctr = (clicks / impressions) * 100;
    if (!cpc && clicks > 0) cpc = spendSar / clicks;
    if (!cpm && impressions > 0) cpm = spendSar / impressions * 1000;
    return {
      impressions: num(impressions),
      clicks: num(clicks),
      landingPageViews: num(views.landingPageViews),
      contentViews: num(views.contentViews),
      trafficViews: num(views.trafficViews),
      ctrPct: num(ctr, 2),
      cpcSar: num(cpc, 2),
      cpmSar: num(cpm, 2),
      rawCurrency: rawCurrency,
      rawSpend: rawSpend,
    };
  }

  function productSnapshot(product, reportingCurrency) {
    var orders = num(product && (product.placedCount || product.orders));
    var delivered = num(product && (product.deliveredCount || product.units || product.delivered));
    var commission = num(product && product.commission, 2);
    var totalSales = num(product && (product.totalSales != null ? product.totalSales : product.revenue), 2);
    var avgCommission = delivered > 0 ? commission / delivered : 0;
    var ndr = num(product && (product.ndrPct || product.deliveryRate || product.deliveryPct));
    var dr = num(product && (product.drRate || product.deliveryPct));
    var breakEven = avgCommission * (ndr / 100);
    return {
      id: String(product && (product.key || product.sku || product.name) || ""),
      name: String(product && (product.name || product.key || product.sku) || "Unknown product"),
      sku: String(product && product.sku || ""),
      orders: orders,
      delivered: delivered,
      ndrPct: num(ndr, 1),
      drPct: num(dr, 1),
      cancelPct: num(product && product.cancelPct, 1),
      deliveredSales: num(product && (product.deliveredSales || product.sales || 0), 2),
      totalSales: totalSales,
      totalSalesReporting: num(sarToReportingCurrency(totalSales, reportingCurrency), 2),
      commission: commission,
      commissionReporting: num(sarToReportingCurrency(commission, reportingCurrency), 2),
      deliveredAov: delivered > 0 ? num((product && (product.deliveredSales || product.sales || 0)) / delivered, 2) : 0,
      breakEvenCpaSar: num(breakEven, 2),
      breakEvenCpa: num(sarToReportingCurrency(breakEven, reportingCurrency), 2),
      topCities: (product && Array.isArray(product.cityBreakdown) ? product.cityBreakdown : []).slice(0, 4).map(function (city) {
        return {
          city: city.name || city.city || "",
          orders: num(city.count || city.orders),
          ndrPct: num(city.ndr || city.ndrPct, 1)
        };
      })
    };
  }

  function productMatchIndex(products) {
    var entries = products.map(function (product, idx) {
      var tokens = productTokens(product.name || product.key || "");
      return { idx: idx, skus: validSkus(product), tokens: tokens, phrases: productPhrases(tokens) };
    });
    var tokenOwners = {};
    var phraseOwners = {};
    entries.forEach(function (entry) {
      entry.tokens.forEach(function (token) { tokenOwners[token] = (tokenOwners[token] || 0) + 1; });
      entry.phrases.forEach(function (phrase) { phraseOwners[phrase] = (phraseOwners[phrase] || 0) + 1; });
    });
    return { entries: entries, tokenOwners: tokenOwners, phraseOwners: phraseOwners };
  }

  function nameMatchScore(campaignText, spaceText, entry, index) {
    var hasAnyToken = entry.tokens.some(function (token) {
      return campaignText.indexOf(token) !== -1;
    });
    if (!hasAnyToken) return 0;

    var hits = entry.tokens.filter(function (token) { return spaceText.indexOf(" " + token + " ") !== -1; });
    var phraseHits = entry.phrases.filter(function (phrase) { return spaceText.indexOf(" " + phrase + " ") !== -1; });
    var uniqueWordHit = hits.some(function (token) { return token.length >= 4 && index.tokenOwners[token] === 1; });
    var uniquePhraseHit = phraseHits.some(function (phrase) { return index.phraseOwners[phrase] === 1; });
    if (hits.length < Math.min(2, entry.tokens.length) && !uniqueWordHit && !uniquePhraseHit) return 0;
    return hits.reduce(function (total, token) {
      return total + token.length + (index.tokenOwners[token] === 1 ? 6 : 0);
    }, 0) + phraseHits.reduce(function (total, phrase) {
      return total + phrase.length + (index.phraseOwners[phrase] === 1 ? 12 : 0);
    }, 0);
  }

  function matchCampaign(row, products, index) {
    var campaignText = textKey(campaignName(row));
    if (!campaignText) return null;
    var spaceText = " " + campaignText + " ";
    
    // Quick SKU match in single loop (no allocations and sorting)
    var bestSkuEntry = null;
    var bestMatchedSkuLength = 0;
    for (var i = 0; i < index.entries.length; i++) {
      var entry = index.entries[i];
      if (entry.skus && entry.skus.length > 0) {
        for (var j = 0; j < entry.skus.length; j++) {
          var s = entry.skus[j];
          if (campaignText.indexOf(s) !== -1 && spaceText.indexOf(" " + s + " ") !== -1) {
            if (!bestSkuEntry || s.length > bestMatchedSkuLength) {
              bestSkuEntry = entry;
              bestMatchedSkuLength = s.length;
            }
          }
        }
      }
    }
    if (bestSkuEntry) {
      return { product: products[bestSkuEntry.idx], idx: bestSkuEntry.idx, method: "sku", confidence: "high" };
    }
    
    return null;
  }

  function marketingStates(accountId, platform) {
    if (!window.DashboardMarketingState || typeof window.DashboardMarketingState.get !== "function") return [];
    var requested = platform && platform !== "all" ? [platform] : PLATFORMS;
    return requested.map(function (id) {
      var state = window.DashboardMarketingState.get(accountId || "__all__", id);
      return state ? Object.assign({ platform: id }, state) : null;
    }).filter(Boolean);
  }

  function rowsFromState(state) {
    var summary = state && state.summary ? state.summary : {};
    return Array.isArray(summary.campaignBreakdown) ? summary.campaignBreakdown : [];
  }

  function pushTop(list, item, limit) {
    list.push(item);
    if (list.length > (limit || CAP) * 4) list.length = (limit || CAP) * 4;
  }

  function buildCacheKey(data, states, opts, accountId, rawProducts, reportingCurrency) {
    var meta = data && data.meta || {};
    var stateKey = (states || []).map(function (state) {
      var summary = state && state.summary || {};
      return [
        state && state.platform || "",
        state && state.lastSyncAt || summary.lastSyncAt || "",
        summary.dateFrom || "",
        summary.dateTo || "",
        summary.rowCount || 0,
        summary.campaignCount || 0
      ].join(":");
    }).join("|");
    return [
      accountId,
      opts.platform || "all",
      textKey(opts.productName || opts.product || ""),
      meta.lastUpdatedAt || meta.generatedAt || meta.periodLabel || "",
      rawProducts.length,
      stateKey,
      reportingCurrency || "SAR",
    ].join("::");
  }

  function cachedBuild(data, key) {
    for (var i = 0; i < BUILD_CACHE.length; i += 1) {
      if (BUILD_CACHE[i].data === data && BUILD_CACHE[i].key === key) return BUILD_CACHE[i].value;
    }
    return null;
  }

  function rememberBuild(data, key, value) {
    BUILD_CACHE.unshift({ data: data, key: key, value: value });
    if (BUILD_CACHE.length > 12) BUILD_CACHE.length = 12;
    return value;
  }

  function build(opts) {
    opts = opts || {};
    var data = opts.data || window.dashboardGeoData || {};
    var accountId = data.meta && data.meta.activeAccountId || (window.getActiveAccountId ? window.getActiveAccountId() : "__all__");
    var roiSettings = campaignRoiSettings(accountId, data);
    var reportingCurrency = cleanCurrency(roiSettings.currency, data.meta && data.meta.activeCurrency || window.dashboardActiveCurrency || "SAR");
    var rawProducts = data.products && Array.isArray(data.products.rankedList) ? data.products.rankedList : [];
    var states = opts.marketingState ? [opts.marketingState] : marketingStates(accountId, opts.platform);
    var periodLabel = (states[0] && states[0].summary && (states[0].summary.dateFrom || states[0].summary.dateTo))
      ? [states[0].summary.dateFrom, states[0].summary.dateTo].filter(Boolean).join(" - ")
      : (data.meta && data.meta.periodLabel || "Last 30 days / synced dashboard period");
    var cacheKey = buildCacheKey(data, states, opts, accountId, rawProducts, reportingCurrency);
    var cached = cachedBuild(data, cacheKey);
    if (cached) return cached;
    var products = groupProductsByName(rawProducts);
    var snapshots = products.map(function (product) {
      return productSnapshot(product, reportingCurrency);
    });
    var index = productMatchIndex(products);
    var rows = [];
    var totals = {
      adSpendSar: 0,
      campaignCount: 0,
      rowCount: 0,
      matchedSpendSar: 0,
      unmatchedSpendSar: 0,
      spentCampaignCount: 0,
      zeroSpendRowsSkipped: 0,
      missingSkuCampaignCount: 0
    };
    var objectiveMap = {};
    var productGroups = {};
    var topSpendCampaigns = [];
    var worstCampaigns = [];
    var allCampaignSummaries = [];
    var allWorstCampaigns = [];
    var targetKey = textKey(opts.productName || opts.product || "");

    states.forEach(function (state) {
      var summary = state && state.summary || {};
      totals.campaignCount += num(summary.campaignCount);
      totals.rowCount += num(summary.rowCount);
      rowsFromState(state).forEach(function (row) {
        rows.push({ row: row, state: state });
      });
    });

    rows.forEach(function (entry) {
      var row = entry.row;
      var platform = platformOf(row, entry.state && entry.state.platform);
      var currency = rowCurrency(row, entry.state);
      var spendSar = campaignSpendToSar(row, currency);
      if (spendSar <= 0) {
        totals.zeroSpendRowsSkipped += 1;
        return;
      }
      var objective = objectiveOf(row);
      var match = matchCampaign(row, products, index);
      var isVerifiedSkuMatch = !!(match && match.method === "sku" && match.product);
      var product = isVerifiedSkuMatch ? snapshots[match.idx] : null;
      var suggestedProduct = match && !isVerifiedSkuMatch ? snapshots[match.idx] : null;
      var khodOrders = product ? product.orders : 0;
      var estimatedCpaSar = product && khodOrders > 0 ? spendSar / khodOrders : 0;
      var performance = campaignPerformance(row, spendSar, currency);
      totals.adSpendSar += spendSar;
      totals.spentCampaignCount += 1;
      if (product) totals.matchedSpendSar += spendSar;
      else {
        totals.unmatchedSpendSar += spendSar;
        totals.missingSkuCampaignCount += 1;
      }
      if (!objectiveMap[objective]) objectiveMap[objective] = { objective: objective, spendSar: 0, campaignCount: 0 };
      objectiveMap[objective].spendSar += spendSar;
      objectiveMap[objective].campaignCount += 1;

      var campaign = {
        campaignId: campaignId(row),
        campaign: campaignName(row),
        platform: platform,
        objective: objective,
        status: statusOf(row),
        spendSar: num(spendSar, 2),
        impressions: performance.impressions,
        clicks: performance.clicks,
        landingPageViews: performance.landingPageViews,
        contentViews: performance.contentViews,
        trafficViews: performance.trafficViews,
        ctrPct: performance.ctrPct,
        cpcSar: performance.cpcSar,
        cpmSar: performance.cpmSar,
        rawCurrency: performance.rawCurrency,
        rawSpend: performance.rawSpend,
        product: product ? product.name : null,
        productSku: product ? product.sku : "",
        suggestedProduct: suggestedProduct ? suggestedProduct.name : "",
        suggestedProductSku: suggestedProduct ? suggestedProduct.sku : "",
        matchMethod: match ? match.method : "unmatched",
        matchConfidence: product ? match.confidence : (suggestedProduct ? "needs_sku" : "none"),
        attributionVerified: !!product,
        khodOrders: khodOrders,
        khodDelivered: product ? product.delivered : 0,
        khodNdrPct: product ? product.ndrPct : 0,
        estimatedCpaSar: num(estimatedCpaSar, 2),
        khodConversionRatePct: product && performance.trafficViews > 0 ? num((khodOrders / performance.trafficViews) * 100, 2) : 0,
        deliveredConversionRatePct: product && performance.trafficViews > 0 ? num((product.delivered / performance.trafficViews) * 100, 2) : 0,
        note: product ? "Orders and delivery results come from the KHOD dashboard." : "Unmatched spend; no KHOD product attribution."
      };
      campaign.searchHaystack = textKey([
        campaign.campaign,
        campaign.campaignId,
        campaign.platform,
        campaign.objective,
        campaign.status,
        campaign.product || "",
        campaign.suggestedProduct || "",
        campaign.productSku || "",
        campaign.suggestedProductSku || "",
        campaign.matchMethod,
        campaign.matchConfidence
      ].join(" "));
      allCampaignSummaries.push(campaign);
      pushTop(topSpendCampaigns, campaign);
      if (!product || khodOrders <= 0 || (estimatedCpaSar > 0 && product.breakEvenCpaSar > 0 && estimatedCpaSar > product.breakEvenCpaSar)) {
        allWorstCampaigns.push(campaign);
        pushTop(worstCampaigns, campaign);
      }
      if (product) {
        var matchedProduct = product;
        var key = matchedProduct.id || matchedProduct.name;
        if (!productGroups[key]) {
          productGroups[key] = {
            product: matchedProduct.name,
            sku: matchedProduct.sku,
            spendSar: 0,
            campaignCount: 0,
            khodOrders: matchedProduct.orders,
            khodDelivered: matchedProduct.delivered,
            khodNdrPct: matchedProduct.ndrPct,
            khodDrPct: matchedProduct.drPct,
            cancelPct: matchedProduct.cancelPct,
            deliveredSales: matchedProduct.deliveredSales,
            totalSales: matchedProduct.totalSales,
            deliveredAov: matchedProduct.deliveredAov,
            commission: matchedProduct.commission,
            breakEvenCpaSar: matchedProduct.breakEvenCpaSar,
            impressions: 0,
            clicks: 0,
            landingPageViews: 0,
            contentViews: 0,
            trafficViews: 0,
            objectives: {},
            cities: matchedProduct.topCities,
            matchConfidence: match.confidence
          };
        }
        productGroups[key].spendSar += spendSar;
        productGroups[key].campaignCount += 1;
        productGroups[key].impressions += performance.impressions;
        productGroups[key].clicks += performance.clicks;
        productGroups[key].landingPageViews += performance.landingPageViews;
        productGroups[key].contentViews += performance.contentViews;
        productGroups[key].trafficViews += performance.trafficViews;
        productGroups[key].objectives[objective] = (productGroups[key].objectives[objective] || 0) + spendSar;
        if (match.method === "sku") {
          productGroups[key].matchConfidence = "high";
        }
      }
    });

    var allProductGroups = Object.keys(productGroups).map(function (key) {
      var group = productGroups[key];
      var cpa = group.khodOrders > 0 ? group.spendSar / group.khodOrders : 0;
      var deliveredCpa = group.khodDelivered > 0 ? group.spendSar / group.khodDelivered : 0;
      var breakEven = group.breakEvenCpaSar || 0;
      var avgCommissionSar = group.khodDelivered > 0 ? group.commission / group.khodDelivered : 0;
      var trafficViews = group.trafficViews || 0;
      var netProfitSar = group.commission - group.spendSar;
      var cpaUnsafe = breakEven > 0 && cpa > breakEven;
      var deliveredCpaUnsafe = avgCommissionSar > 0 && deliveredCpa > avgCommissionSar;
      var decisionMetadata = window.KhodCampaignDecision && typeof window.KhodCampaignDecision.evaluate === "function"
        ? window.KhodCampaignDecision.evaluate({
          orders: group.khodOrders,
          delivered: group.khodDelivered,
          ndrPct: group.khodNdrPct,
          cancelPct: group.cancelPct,
          cpa: cpa,
          breakEvenCpa: breakEven,
          deliveredCpa: deliveredCpa,
          avgDeliveredProfit: avgCommissionSar,
          netProfit: netProfitSar,
          campaignCount: group.campaignCount,
          periodLabel: periodLabel,
          cities: group.cities
        })
        : {
          decision: cpaUnsafe || deliveredCpaUnsafe ? "fix_first" : "watch",
          status: cpaUnsafe || deliveredCpaUnsafe ? "fix_first" : "watch",
          passedChecks: [],
          failedChecks: [],
          warnings: [],
          reasons: ["Campaign decision evaluator is unavailable."],
          nextAction: "Collect more evidence before changing spend."
        };
      var decision = decisionMetadata.decision;
      var res = Object.assign({}, group, {
        spendSar: num(group.spendSar, 2),
        spend: num(sarToReportingCurrency(group.spendSar, reportingCurrency), 2),
        estimatedCpaSar: num(cpa, 2),
        estimatedCpa: num(sarToReportingCurrency(cpa, reportingCurrency), 2),
        khodCpaSar: num(cpa, 2),
        khodCpa: num(sarToReportingCurrency(cpa, reportingCurrency), 2),
        deliveredCpaSar: num(deliveredCpa, 2),
        deliveredCpa: num(sarToReportingCurrency(deliveredCpa, reportingCurrency), 2),
        breakEvenCpa: num(sarToReportingCurrency(breakEven, reportingCurrency), 2),
        avgCommissionSar: num(avgCommissionSar, 2),
        avgCommission: num(sarToReportingCurrency(avgCommissionSar, reportingCurrency), 2),
        avgDeliveredProfitSar: num(avgCommissionSar, 2),
        avgDeliveredProfit: num(sarToReportingCurrency(avgCommissionSar, reportingCurrency), 2),
        landingPageViews: num(group.landingPageViews),
        contentViews: num(group.contentViews),
        trafficViews: num(trafficViews),
        realConversionRatePct: trafficViews > 0 ? num(group.khodOrders / trafficViews * 100, 2) : 0,
        deliveredConversionRatePct: trafficViews > 0 ? num(group.khodDelivered / trafficViews * 100, 2) : 0,
        ctrPct: group.impressions > 0 ? num(group.clicks / group.impressions * 100, 2) : 0,
        cpcSar: group.clicks > 0 ? num(group.spendSar / group.clicks, 2) : 0,
        netProfitSar: num(netProfitSar, 2),
        netProfit: num(sarToReportingCurrency(netProfitSar, reportingCurrency), 2),
        commissionReporting: num(sarToReportingCurrency(group.commission, reportingCurrency), 2),
        totalSales: num(sarToReportingCurrency(group.totalSales, reportingCurrency), 2),
        totalSalesSar: num(group.totalSales, 2),
        reportingCurrency: reportingCurrency,
        roiPct: group.spendSar > 0 ? num(netProfitSar / group.spendSar * 100, 2) : 0,
        commissionRoas: group.spendSar > 0 ? num(group.commission / group.spendSar, 2) : 0,
        totalSalesRoas: group.spendSar > 0 ? num(group.totalSales / group.spendSar, 2) : 0,
        deliveredSalesRoas: group.spendSar > 0 ? num(group.deliveredSales / group.spendSar, 2) : 0,
        decision: decision,
        decisionMetadata: decisionMetadata,
        objectiveMix: Object.keys(group.objectives).map(function (objective) {
          return {
            objective: objective,
            spendSar: num(group.objectives[objective], 2),
            spend: num(sarToReportingCurrency(group.objectives[objective], reportingCurrency), 2)
          };
        }).sort(function (a, b) { return b.spendSar - a.spendSar; })
      });
      res.searchHaystack = textKey([res.product || "", res.sku || ""].join(" "));
      return res;
    }).sort(function (a, b) {
      return (b.khodOrders - a.khodOrders) || (b.spendSar - a.spendSar);
    });
    var topProductGroups = allProductGroups.slice(0, CAP);

    topSpendCampaigns = topSpendCampaigns.sort(function (a, b) { return b.spendSar - a.spendSar; }).slice(0, CAP);
    worstCampaigns = worstCampaigns.sort(function (a, b) {
      if (!a.product && b.product) return -1;
      if (a.product && !b.product) return 1;
      return b.spendSar - a.spendSar;
    }).slice(0, CAP);

    var focus = null;
    if (targetKey) {
      focus = allProductGroups.find(function (group) {
        return textKey(group.product) === targetKey || textKey(group.sku) === targetKey || textKey(group.product).indexOf(targetKey) !== -1;
      }) || null;
    }
    if (targetKey) {
      if (focus) {
        topSpendCampaigns = allCampaignSummaries.filter(function (campaign) {
          return textKey(campaign.product || "") === textKey(focus.product);
        }).sort(function (a, b) {
          return b.spendSar - a.spendSar;
        }).slice(0, CAP);
        worstCampaigns = allWorstCampaigns.filter(function (campaign) {
          return textKey(campaign.product || "") === textKey(focus.product);
        }).sort(function (a, b) {
          return b.spendSar - a.spendSar;
        }).slice(0, CAP);
        topProductGroups = [focus];
      } else {
        topSpendCampaigns = [];
        worstCampaigns = [];
        topProductGroups = [];
      }
    }

    var fatigueCandidates = topSpendCampaigns.filter(function (campaign) {
      return campaign.product && campaign.khodOrders > 0 && campaign.estimatedCpaSar > 0 && campaign.khodNdrPct < 30;
    }).slice(0, 8);
    var matchedProductTotals = allProductGroups.reduce(function (acc, group) {
      acc.khodOrders += num(group.khodOrders);
      acc.khodDelivered += num(group.khodDelivered);
      acc.clicks += num(group.clicks);
      acc.commission += num(group.commission, 2);
      acc.deliveredSales += num(group.deliveredSales, 2);
      acc.totalSales += num(group.totalSales, 2);
      acc.spendSar += num(group.spendSar, 2);
      return acc;
    }, { khodOrders: 0, khodDelivered: 0, clicks: 0, commission: 0, deliveredSales: 0, totalSales: 0, spendSar: 0 });
    var matchedNetProfit = matchedProductTotals.commission - matchedProductTotals.spendSar;
    var attributionQuality = {
      matchedSpendPct: totals.adSpendSar > 0 ? num(totals.matchedSpendSar / totals.adSpendSar * 100, 2) : 0,
      unmatchedSpendPct: totals.adSpendSar > 0 ? num(totals.unmatchedSpendSar / totals.adSpendSar * 100, 2) : 0,
      missingSkuCampaignCount: totals.missingSkuCampaignCount,
      khodOrders: num(matchedProductTotals.khodOrders),
      noKhodProductSpendSar: num(totals.unmatchedSpendSar, 2)
    };

    var latestSyncAt = states.reduce(function (latest, state) {
      var value = state && (state.lastSyncAt || state.summary && state.summary.lastSyncAt) || "";
      if (!value) return latest;
      if (!latest || new Date(value) > new Date(latest)) return value;
      return latest;
    }, "");
    var matchedKhodCpaSar = matchedProductTotals.khodOrders > 0 ? matchedProductTotals.spendSar / matchedProductTotals.khodOrders : 0;
    var result = {
      version: 2,
      sourceOfTruth: "Product decisions use SKU-matched campaign spend and KHOD orders, delivery, and commission data.",
      periodLabel: periodLabel,
      accountId: accountId,
      platform: opts.platform || "all",
      lastSyncAt: latestSyncAt,
      currency: reportingCurrency,
      reportingCurrency: reportingCurrency,
      totals: {
        adSpendSar: num(totals.adSpendSar, 2),
        adSpend: num(sarToReportingCurrency(totals.adSpendSar, reportingCurrency), 2),
        campaignCount: totals.spentCampaignCount || allCampaignSummaries.length,
        sourceCampaignCount: totals.campaignCount || rows.length,
        rowCount: totals.rowCount || rows.length,
        zeroSpendRowsSkipped: totals.zeroSpendRowsSkipped,
        matchedSpendSar: num(totals.matchedSpendSar, 2),
        matchedSpend: num(sarToReportingCurrency(totals.matchedSpendSar, reportingCurrency), 2),
        unmatchedSpendSar: num(totals.unmatchedSpendSar, 2),
        unmatchedSpend: num(sarToReportingCurrency(totals.unmatchedSpendSar, reportingCurrency), 2),
        matchedSpendPct: attributionQuality.matchedSpendPct,
        unmatchedSpendPct: attributionQuality.unmatchedSpendPct,
        khodOrders: num(matchedProductTotals.khodOrders),
        khodDelivered: num(matchedProductTotals.khodDelivered),
        khodCpaSar: num(matchedKhodCpaSar, 2),
        khodCpa: num(sarToReportingCurrency(matchedKhodCpaSar, reportingCurrency), 2),
        netProfitSar: num(matchedNetProfit, 2),
        netProfit: num(sarToReportingCurrency(matchedNetProfit, reportingCurrency), 2),
        commission: num(sarToReportingCurrency(matchedProductTotals.commission, reportingCurrency), 2),
        totalSalesSar: num(matchedProductTotals.totalSales, 2),
        totalSales: num(sarToReportingCurrency(matchedProductTotals.totalSales, reportingCurrency), 2),
        roiPct: matchedProductTotals.spendSar > 0 ? num(matchedNetProfit / matchedProductTotals.spendSar * 100, 2) : 0,
        commissionRoas: matchedProductTotals.spendSar > 0 ? num(matchedProductTotals.commission / matchedProductTotals.spendSar, 2) : 0,
        totalSalesRoas: matchedProductTotals.spendSar > 0 ? num(matchedProductTotals.totalSales / matchedProductTotals.spendSar, 2) : 0,
        deliveredSalesRoas: matchedProductTotals.spendSar > 0 ? num(matchedProductTotals.deliveredSales / matchedProductTotals.spendSar, 2) : 0
      },
      attributionQuality: attributionQuality,
      objectiveMix: Object.keys(objectiveMap).map(function (key) {
        return {
          objective: key,
          spendSar: num(objectiveMap[key].spendSar, 2),
          campaignCount: objectiveMap[key].campaignCount
        };
      }).sort(function (a, b) { return b.spendSar - a.spendSar; }).slice(0, CAP),
      topSpendCampaigns: topSpendCampaigns,
      allCampaigns: allCampaignSummaries.sort(function (a, b) { return b.spendSar - a.spendSar; }),
      allProductGroups: allProductGroups,
      topProductGroups: topProductGroups,
      worstCampaigns: worstCampaigns,
      creativeSummary: {
        fatigueCandidates: fatigueCandidates,
        needsNewCreatives: fatigueCandidates.slice(0, 5).map(function (campaign) { return campaign.campaign; }),
        winners: topProductGroups.filter(function (group) { return group.decision === "scale"; }).slice(0, 5).map(function (group) { return group.product; })
      },
      productFocus: focus || (targetKey ? {
        product: opts.productName || opts.product || "",
        matched: false,
        note: "No confident campaign match for this product. Keep unmatched spend separate and do not invent attribution."
      } : null),
      caps: {
        topSpendCampaigns: CAP,
        topProductGroups: CAP,
        worstCampaigns: CAP,
        rawRowsSentToAi: 0
      }
    };
    return rememberBuild(data, cacheKey, result);
  }

  function playbook() {
    var recipes = {
      launch_test: {
        mode: "launch_test",
        name: "Launch test",
        objective: "sales or website_leads",
        structure: "Create one controlled test campaign with two focused ad groups: broad audience and best-city audience when city data exists.",
        creatives: "Use three creatives: UGC/demo, problem-solution hook, and offer/price hook.",
        budgetRule: "Start with a small daily test budget and do not scale for the first 24-48h.",
        killRule: "Stop weak ad groups when KHOD orders are weak, CPA is above break-even, or NDR drops into the unsafe zone.",
        scaleRule: "Move to controlled scale only after KHOD orders, NDR, DR, and CPA remain stable."
      },
      controlled_scale: {
        mode: "controlled_scale",
        name: "Controlled scale",
        objective: "sales",
        structure: "Protect the current winner and add one scale campaign or ad group for broad/best-city expansion.",
        creatives: "Keep proven creatives live and add two fresh variations around the winning hook.",
        budgetRule: "Increase budget gradually after 24-48h of stable KHOD CPA, NDR, and delivered sales.",
        killRule: "Stop increases if CPA rises above break-even, NDR drops, or lost commission accelerates.",
        scaleRule: "Scale in steps only while KHOD dashboard quality remains healthy."
      },
      creative_reset: {
        mode: "creative_reset",
        name: "Creative reset",
        objective: "sales or website_leads",
        structure: "Keep targeting simple and rebuild the test around new hooks before increasing spend.",
        creatives: "Produce UGC/demo, problem-solution, objection-handling, and city/product-specific creatives.",
        budgetRule: "Hold or reduce budget while testing new creative angles.",
        killRule: "Cut creatives with spend but weak KHOD orders or unsafe NDR.",
        scaleRule: "Scale only the creative angle that improves KHOD orders and CPA without hurting NDR."
      },
      city_focus: {
        mode: "city_focus",
        name: "City focus",
        objective: "sales",
        structure: "Use a best-city ad group and isolate weak cities from the scale budget.",
        creatives: "Use product creative with city-relevant delivery promise and offer framing.",
        budgetRule: "Shift test budget toward cities with strong KHOD orders, NDR, DR, and commission.",
        killRule: "Exclude or isolate cities with order volume but weak delivery/COD quality.",
        scaleRule: "Expand cities only after their KHOD delivery quality stays stable."
      },
      fix_before_scale: {
        mode: "fix_before_scale",
        name: "Fix before scale",
        objective: "sales or website_leads",
        structure: "Do not add scale campaigns yet; isolate the biggest leak first.",
        creatives: "Refresh product promise, confirmation script, and objection-handling creatives.",
        budgetRule: "Keep budget flat or reduced until the leak improves.",
        killRule: "Pause segments with CPA above break-even, low NDR, high cancellation, or weak delivered sales.",
        scaleRule: "Restart scaling only after the product/city passes KHOD delivery and CPA guardrails."
      },
      pause_or_reduce: {
        mode: "pause_or_reduce",
        name: "Pause or reduce",
        objective: "none until fixed",
        structure: "Stop aggressive testing and keep only diagnostic traffic if needed.",
        creatives: "Do not produce more variants until the root issue is clear.",
        budgetRule: "Reduce or pause spend to protect margin.",
        killRule: "Pause when meaningful spend has weak KHOD orders, unsafe NDR, or CPA above break-even.",
        scaleRule: "No scale until sample, delivery quality, and break-even CPA checks recover."
      }
    };
    return {
      version: 1,
      sourceOfTruth: "Use KHOD orders, delivered orders, NDR, DR, delivered sales, commission, CPA, and break-even for decisions.",
      defaultObjectives: ["sales", "website_leads"],
      launch: "Start controlled tests. Judge by KHOD orders, NDR, CPA vs break-even, city quality, and delivered sales.",
      scale: "Scale only products with enough KHOD sample, healthy delivery, and CPA at or below break-even. Increase budgets gradually and protect winning cities.",
      fixFirst: "Before scaling, repair the biggest leak: creative fatigue, weak city mix, high CPA, low NDR, or low delivered AOV.",
      pause: "Pause or stop testing when spend is meaningful, KHOD orders are weak, NDR is unsafe, or CPA is above break-even without a clear fix.",
      creativeRefresh: "When spend is high but KHOD orders/NDR do not hold, produce new hooks, UGC/demo creatives, problem-solution angles, and city/product-specific variations.",
      cityScaling: "Push budget toward cities with strong KHOD orders, NDR, DR, and commission. Exclude or isolate weak cities before scaling.",
      budgetSteps: "Use small budget steps first, then larger increases only after 24-48h of stable KHOD CPA, NDR, and delivered sales.",
      strategyRecipes: recipes
    };
  }

  window.KhodCampaignIntelligence = {
    build: build,
    playbook: playbook,
    textKey: textKey,
    campaignSpendToSar: campaignSpendToSar
  };
})();
