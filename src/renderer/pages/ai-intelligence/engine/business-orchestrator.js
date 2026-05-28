(function () {
  "use strict";

  var LOCAL_ONLY = {};

  function num(value) {
    return Number(value || 0);
  }

  function pct(value) {
    var n = Number(value || 0);
    return n > 1 ? n : n * 100;
  }

  function clean(value, max) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || 180);
  }

  function fmt(value) {
    return Math.round(num(value)).toLocaleString("en-US");
  }

  function productKey(value) {
    return clean(value, 120).toLowerCase();
  }

  function slug(value) {
    return encodeURIComponent(clean(value, 180));
  }

  function getMemory() {
    return window.KhodAiSessionMemory && window.KhodAiSessionMemory.get
      ? window.KhodAiSessionMemory.get()
      : {};
  }

  function getProducts(data) {
    return (data && data.products && data.products.rankedList) || [];
  }

  function getCities(data) {
    var stats = data && data.geo && data.geo.cityStats ? data.geo.cityStats : {};
    return Object.keys(stats).map(function (name) {
      return Object.assign({ name: name }, stats[name] || {});
    });
  }

  function findProduct(data, name) {
    var wanted = productKey(name);
    if (!wanted) return null;
    return getProducts(data).find(function (p) {
      return productKey(p.name) === wanted || productKey(p.sku) === wanted || productKey(p.key) === wanted;
    }) || null;
  }

  function findCity(data, name) {
    var wanted = productKey(name);
    if (!wanted) return null;
    return getCities(data).find(function (c) { return productKey(c.name) === wanted; }) || null;
  }

  function readSavedProductSpend(product) {
    if (!product || !window.localStorage) return null;
    var ids = [product.key, product.sku, product.name].filter(Boolean);
    for (var i = 0; i < ids.length; i += 1) {
      var raw = window.localStorage.getItem("kbot_s9_spend_" + ids[i]);
      var n = Number(raw);
      if (n > 0) return n;
    }
    return null;
  }

  function normalizeRoiSettings(value) {
    value = value || {};
    var adSpend = Number(value.adSpend);
    var egpRate = Number(value.egpRate);
    var currency = clean(value.currency || "SAR", 12).toUpperCase();
    return {
      adSpend: isFinite(adSpend) && adSpend >= 0 ? adSpend : 0,
      currency: /^(SAR|USD|EGP)$/.test(currency) ? currency : "SAR",
      egpRate: isFinite(egpRate) && egpRate > 0 ? egpRate : 52
    };
  }

  function readAccountRoiSettings(data) {
    var accountId = data && data.meta && data.meta.activeAccountId ? data.meta.activeAccountId : "__all__";
    var fallback = data && data.roi ? data.roi : {};
    var marketing = window.DashboardMarketingState && typeof window.DashboardMarketingState.get === "function"
      ? window.DashboardMarketingState.get(accountId)
      : null;
    var syncedSummary = marketing && marketing.status === "connected" && marketing.summary && !marketing.manualOverride
      ? marketing.summary
      : null;
    var stored = null;
    var hasStoredSpend = false;
    try {
      if (window.localStorage) {
        stored = JSON.parse(window.localStorage.getItem("khod_roi_settings_" + accountId) || "null");
        hasStoredSpend = !!(stored && isFinite(Number(stored.adSpend)) && Number(stored.adSpend) > 0);
      }
    } catch (_) {}
    if (syncedSummary && Number(syncedSummary.adSpend) > 0) {
      var syncedCurrency = (syncedSummary.currency || marketing.currency || (stored && stored.currency) || fallback.currency || "SAR");
      var synced = normalizeRoiSettings({
        adSpend: syncedSummary.adSpend,
        currency: syncedCurrency,
        egpRate: stored && stored.egpRate || fallback.egpRate || 52
      });
      synced.hasExplicitSpend = true;
      synced.source = "syncedTiktok";
      synced.lastSyncAt = marketing.lastSyncAt || syncedSummary.lastSyncAt || null;
      return synced;
    }
    var settings = normalizeRoiSettings(stored || {
      adSpend: fallback.adSpend,
      currency: fallback.currency || "SAR",
      egpRate: fallback.egpRate || 52
    });
    settings.hasExplicitSpend = hasStoredSpend;
    settings.source = hasStoredSpend ? "savedCalculator" : "missing";
    return settings;
  }

  function accountAllocatedProductSpend(data, product) {
    if (!product) return null;
    var settings = readAccountRoiSettings(data || {});
    if (!settings.adSpend || !settings.hasExplicitSpend) return null;
    var products = getProducts(data || {});
    var totalPlaced = products.reduce(function (sum, p) {
      return sum + num(p.placedCount || p.orders);
    }, 0);
    var placed = num(product.placedCount || product.orders);
    if (!totalPlaced || !placed) return null;
    return {
      amount: Math.round((settings.adSpend * placed / totalPlaced) * 100) / 100,
      currency: settings.currency,
      source: "allocatedAccountSpend",
      accountSpend: settings.adSpend
    };
  }

  function extractMoneyAnswer(text) {
    var raw = clean(text, 120);
    var match = raw.match(/(?:spend|spent|budget|ad\s*spend)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(sar|usd|egp|ريال|دولار|جنيه)?/i);
    if (!match) return null;
    var amount = Number(String(match[1]).replace(/,/g, ""));
    if (!amount || amount <= 0) return null;
    var currency = (match[2] || "").toUpperCase();
    if (currency === "ريال") currency = "SAR";
    if (currency === "دولار") currency = "USD";
    if (currency === "جنيه") currency = "EGP";
    return { amount: amount, currency: currency || null };
  }

  function normalizeCurrency(value) {
    var currency = clean(value, 20).toUpperCase();
    if (currency === "ريال") return "SAR";
    if (currency === "دولار") return "USD";
    if (currency === "جنيه") return "EGP";
    return currency || null;
  }

  function maybeResolvePending(text, memory) {
    var pending = memory && memory.pendingMissingInputs;
    if (!pending) return null;
    var cleaned = clean(text, 500);
    var looksLikeNewQuestion =
      /\b(what|which|why|how|show|top|worst|best|strongest|weakest|highest|lowest|analyze|compare)\b/i.test(cleaned) ||
      (/\b(account|city|cities|product|products|app|apps|ndr|cpa|roi|profit|commission|orders)\b/i.test(cleaned) && /\?/.test(cleaned));
    if (pending.scope === "product_lookup") {
      if (looksLikeNewQuestion) {
        if (window.KhodAiSessionMemory) window.KhodAiSessionMemory.clearPending();
        return null;
      }
      if (window.KhodAiSessionMemory) window.KhodAiSessionMemory.clearPending();
      return {
        mode: "resume",
        text: (pending.originalQuestion || "") + " " + clean(text, 240)
      };
    }
    var money = extractMoneyAnswer(text);
    var currencyOnly = clean(text, 20).match(/^(sar|usd|egp|ريال|دولار|جنيه)$/i);
    if (!money && !currencyOnly && /\b(what|which|why|how|show|top|worst|best|strongest|weakest|highest|lowest|analyze|compare|city|cities|product|products|app|apps|ndr|cpa|roi|profit|commission)\b/i.test(cleaned)) {
      if (window.KhodAiSessionMemory) window.KhodAiSessionMemory.clearPending();
      return null;
    }
    if (!money && pending.amount && currencyOnly) {
      money = { amount: pending.amount, currency: normalizeCurrency(currencyOnly[1]) };
    }
    if (!money) {
      return {
        mode: "followup",
        message: "I still need the spend amount and currency to finish the profitability analysis. Please send it like: 500 SAR, 120 USD, or 8000 EGP."
      };
    }
    var currency = normalizeCurrency(money.currency || pending.currency || memory.knownInputs && memory.knownInputs.currency);
    if (!currency) {
      if (window.KhodAiSessionMemory) {
        window.KhodAiSessionMemory.setPending(Object.assign({}, pending, { amount: money.amount }));
      }
      return {
        mode: "followup",
        message: "Got the spend amount. Which currency is it in: SAR, USD, or EGP?"
      };
    }
    if (window.KhodAiSessionMemory) {
      if (pending.scope === "product" && pending.product) {
        window.KhodAiSessionMemory.rememberInput("productSpend", productKey(pending.product), {
          amount: money.amount,
          currency: currency
        });
      } else {
        window.KhodAiSessionMemory.rememberInput("knownInputs", "accountSpend", {
          amount: money.amount,
          currency: currency
        });
      }
      window.KhodAiSessionMemory.rememberInput("knownInputs", "currency", currency);
      window.KhodAiSessionMemory.clearPending();
    }
    return {
      mode: "resume",
      text: pending.originalQuestion || memory.lastStrategicQuestion || text
    };
  }

  function needsProfitabilityInputs(parsedIntent) {
    var text = clean(parsedIntent.rawText, 500).toLowerCase();
    if (parsedIntent.intent === "RANKING_QUERY") return false;
    if (parsedIntent.intent === "LOSS_ANALYSIS") return true;
    if (parsedIntent.intent === "SCALE_ANALYSIS") {
      return /\b(margin|cpa|roi|roas|budget|spend|ad\s*spend|losing|loss)\b/i.test(text);
    }
    return /\b(why|losing|loss|profit|profitable|margin|cpa|roi|roas|scale|budget|spend)\b/i.test(text);
  }

  function getKnownProductSpend(productName, product, data) {
    var memory = getMemory();
    var saved = memory.knownInputs && memory.knownInputs.productSpend
      ? memory.knownInputs.productSpend[productKey(productName)]
      : null;
    if (saved && saved.amount) return saved;
    var local = readSavedProductSpend(product);
    if (local) {
      return {
        amount: local,
        currency: memory.knownInputs && memory.knownInputs.currency || "SAR"
      };
    }
    var allocated = accountAllocatedProductSpend(data, product);
    if (allocated) return allocated;
    return null;
  }

  function validateDependencies(parsedIntent, analytics, data) {
    if (!needsProfitabilityInputs(parsedIntent)) return { ok: true, missing: [] };
    var productName = parsedIntent.entities.products[0] || getMemory().currentProduct;
    var product = findProduct(data, productName);
    var missing = [];
    var accountSettings = readAccountRoiSettings(data || {});
    var accountSpend = getMemory().knownInputs && getMemory().knownInputs.accountSpend;
    if ((!accountSpend || !accountSpend.amount) && accountSettings.adSpend && accountSettings.hasExplicitSpend) {
      accountSpend = {
        amount: accountSettings.adSpend,
        currency: accountSettings.currency,
        source: "accountCalculator"
      };
    }
    var spend = productName ? getKnownProductSpend(productName, product, data) : accountSpend;
    var currency = spend && spend.currency || getMemory().knownInputs && getMemory().knownInputs.currency;

    if (!spend || !spend.amount) missing.push("spend");
    if (!currency) missing.push("currency");
    if (!missing.length) return { ok: true, missing: [], spend: spend, currency: currency };

    return {
      ok: false,
      missing: missing,
      product: productName || "",
      scope: productName ? "product" : "account",
      message: productName
        ? "I can analyze " + productName + ", but I still need the advertising spend for this product to calculate CPA and profitability accurately. How much did you spend, and in which currency (SAR/USD/EGP)?"
        : "I can analyze the account, but I need the advertising spend and currency to calculate CPA and profitability accurately. How much did you spend, and in which currency (SAR/USD/EGP)?"
    };
  }

  function validateCalculatorDependencies(parsedIntent) {
    if (!parsedIntent || parsedIntent.intent !== "CALCULATOR_SIMULATION") return { ok: true, missing: [] };
    var text = clean(parsedIntent.rawText, 500).toLowerCase();
    if (!/\b(no|missing|without|unknown|don'?t have)\b/.test(text)) return { ok: true, missing: [] };
    var missing = [];
    if (/\bcurrency\b/i.test(text)) missing.push("currency");
    if (/\b(spend|budget|cpa|roi|roas|margin)\b/i.test(text)) missing.push("calculatorInputs");
    if (!missing.length) missing.push("calculatorInputs");
    return {
      ok: false,
      missing: missing,
      scope: "calculator",
      message: "I can run the calculator locally, but I need the missing calculator input first: " + missing.join(" and ") + ". Send the amount and currency, for example 500 SAR."
    };
  }

  function productSummary(product, spend) {
    if (!product) return null;
    var orders = num(product.placedCount || product.orders);
    var delivered = num(product.deliveredCount || product.units);
    var commission = num(product.commission);
    var ndr = pct(product.ndrPct || product.deliveryPct || (orders ? delivered / orders : 0));
    var cancel = pct(product.cancelPct || 0);
    var cpa = spend && spend.amount && orders ? spend.amount / orders : null;
    var profit = spend && spend.amount ? commission - spend.amount : null;
    var margin = profit != null && commission ? (profit / commission) * 100 : null;
    return {
      name: product.name || product.key || product.sku,
      sku: product.sku || "",
      orders: orders,
      delivered: delivered,
      ndr: Math.round(ndr * 10) / 10,
      cancelRate: Math.round(cancel * 10) / 10,
      commission: Math.round(commission * 100) / 100,
      spend: spend || null,
      cpa: cpa == null ? null : Math.round(cpa * 100) / 100,
      profit: profit == null ? null : Math.round(profit * 100) / 100,
      marginPct: margin == null ? null : Math.round(margin * 10) / 10,
      spendSource: spend && spend.source || null,
      topCities: (product.cityBreakdown || []).slice(0, 5).map(function (c) {
        return {
          city: c.name,
          orders: num(c.count || c.orders),
          ndr: Math.round(pct(c.ndr || c.deliveryPct || 0) * 10) / 10
        };
      })
    };
  }

  function isDirectProductMetricQuestion(parsedIntent) {
    var text = clean(parsedIntent && parsedIntent.rawText, 500).toLowerCase();
    return parsedIntent &&
      parsedIntent.entities &&
      parsedIntent.entities.products &&
      parsedIntent.entities.products.length &&
      /\b(cpa|profit|p\s*&\s*l|pnl|margin|ndr|delivery|commission|orders|delivered|cancel|canceled|cancelled)\b/i.test(text) &&
      /\b(what|wht|whats|how much|tell me|show me|fr|for|for it|for this|for the product)\b/i.test(text);
  }

  function isProductMetricIntentWithoutProduct(parsedIntent) {
    var text = clean(parsedIntent && parsedIntent.rawText, 500).toLowerCase();
    return parsedIntent &&
      parsedIntent.intent === "PRODUCT_ANALYSIS" &&
      parsedIntent.entities &&
      (!parsedIntent.entities.products || !parsedIntent.entities.products.length) &&
      /\b(cpa|profit|p\s*&\s*l|pnl|margin|ndr|delivery|commission|orders|delivered|cancel|canceled|cancelled)\b/i.test(text);
  }

  function productClarificationMessage(parsedIntent) {
    var entities = parsedIntent && parsedIntent.entities || {};
    var candidates = Array.isArray(entities.productCandidates) ? entities.productCandidates.filter(Boolean) : [];
    if (candidates.length) {
      return "I found more than one possible product. Which one do you mean?\n\n" +
        candidates.slice(0, 4).map(function (name, idx) { return (idx + 1) + ". " + name; }).join("\n") +
        "\n\nReply with the full product name or a clearer part of it, and I will calculate CPA, NDR, commission, and P&L.";
    }
    if (entities.productQueryTooShort) {
      return "That product name is too short for me to identify safely. Send a clearer part of the product name, for example two or three unique words from it, and I will calculate CPA, NDR, commission, and P&L.";
    }
    return "Which product do you mean? Send the product name exactly as it appears in Product Analytics, or any clear unique part of it, and I will calculate CPA, NDR, commission, and P&L.";
  }

  function productMetricResponse(product, data, dependency) {
    var summary = productSummary(product, dependency && dependency.spend);
    if (!summary) return "No matching product record was found in the current dashboard mode.";
    var currency = summary.spend && summary.spend.currency || dependency && dependency.currency || "";
    if (!summary.spend || !summary.spend.amount) {
      return "I found " + summary.name + ", but I still need the advertising spend and currency to calculate CPA and profitability accurately." +
        "\n\nCurrent facts: " +
        fmt(summary.orders) + " orders, " +
        fmt(summary.delivered) + " delivered, " +
        summary.ndr + "% NDR, " +
        summary.cancelRate + "% cancel rate, " +
        fmt(summary.commission) + " SAR commission." +
        "\n\nSend the spend like 500 SAR, 120 USD, or 8000 EGP and I will calculate CPA and P&L from the current dashboard data.";
    }
    var spendLine = summary.spend
      ? ", allocated ad spend " + fmt(summary.spend.amount) + (currency ? " " + currency : "")
      : "";
    var cpaLine = summary.cpa != null
      ? ", CPA " + summary.cpa.toLocaleString("en-US") + (currency ? " " + currency : "")
      : "";
    var profitLine = summary.profit != null
      ? ", P&L " + summary.profit.toLocaleString("en-US") + (currency ? " " + currency : "")
      : "";
    var mode = data && data.meta && data.meta.deliveredDateMode === "createdAt" ? "Created At" : "Last Updated";
    return "For " + summary.name + ", the CPA is " + (summary.cpa != null ? summary.cpa.toLocaleString("en-US") + (currency ? " " + currency : "") : "not available yet") + "." +
      "\n\nHere is the full read in " + mode + " mode: " +
      fmt(summary.orders) + " orders, " +
      fmt(summary.delivered) + " delivered, " +
      summary.ndr + "% NDR, " +
      summary.cancelRate + "% cancel rate, " +
      fmt(summary.commission) + " SAR commission" +
      spendLine + cpaLine + profitLine + "." +
      "\n\nWhat it means: if this CPA is higher than the commission you earn per delivered order, scaling this product will likely increase losses. If it is lower, then the next thing to check is delivery quality, because low NDR can still kill profit even when CPA looks acceptable." +
      "\n\nNext steps:\n- Compare this product against your best product by CPA, NDR, and P&L.\n- If P&L is negative, reduce spend or pause until delivery quality improves.\n- Switch the top mode between Created At and Last Updated when you want the delivered numbers recalculated by that mode.";
  }

  function citySummary(city) {
    if (!city) return null;
    var orders = num(city.count || city.orders);
    var delivered = num(city.deliveredOrders);
    return {
      name: city.name,
      orders: orders,
      delivered: delivered,
      ndr: Math.round(pct(orders ? delivered / orders : city.ndrPct || city.drPct || 0) * 10) / 10,
      deliveryRate: Math.round(pct(city.drBaseOrders ? delivered / city.drBaseOrders : city.drPct || 0) * 10) / 10,
      commission: Math.round(num(city.earnedCommission) * 100) / 100,
      codPct: Math.round(pct(orders ? num(city.codCount) / orders : city.codPct || 0) * 10) / 10,
      riskScore: Math.round(num(city.riskScore)),
      scalingScore: Math.round(num(city.scalingScore))
    };
  }

  function detectIssues(accountHealth, product, city) {
    var issues = [];
    if (accountHealth.metrics.ndr && accountHealth.metrics.ndr < 55) issues.push("Low account NDR is limiting profitability.");
    if (product && product.ndr < 55) issues.push("Selected product has weak delivery quality.");
    if (product && product.profit != null && product.profit < 0) issues.push("Selected product is not covering ad spend.");
    if (product && product.cpa != null && product.delivered > 0 && product.cpa > product.commission / Math.max(1, product.delivered)) issues.push("CPA is high relative to delivered commission.");
    if (city && city.riskScore >= 65) issues.push("Selected city has elevated delivery/COD risk.");
    return issues.slice(0, 5);
  }

  function detectOpportunities(accountHealth, product, city) {
    var opportunities = [];
    (accountHealth.topWinningProducts || []).slice(0, 2).forEach(function (p) {
      opportunities.push("Potential winner product: " + p.name + " with " + Math.round(num(p.ndr) * 10) / 10 + "% NDR.");
    });
    (accountHealth.bestCities || []).slice(0, 2).forEach(function (c) {
      opportunities.push("Strong city signal: " + c.name + " with meaningful commission.");
    });
    if (product && product.ndr >= 65 && (!product.profit || product.profit > 0)) opportunities.push("Selected product can be tested for controlled scaling.");
    if (city && city.scalingScore >= 60) opportunities.push("Selected city may be a scale candidate if CPA stays controlled.");
    return opportunities.slice(0, 5);
  }

  function detectAnomalies(accountHealth, product, city) {
    var anomalies = [];
    if (product && product.orders >= 20 && product.delivered === 0) anomalies.push("Product has order volume but no delivered units.");
    if (city && city.orders >= 20 && city.delivered === 0) anomalies.push("City has order volume but no delivered orders.");
    if (accountHealth.metrics.lostCommission > accountHealth.metrics.revenue) anomalies.push("Lost commission is larger than earned commission.");
    return anomalies.slice(0, 4);
  }

  function buildStrategicContext(parsedIntent, analyticsResult, data, dependency) {
    var accountHealth = window.KhodAiAnalyticsEngine.processIntent({
      intent: "ACCOUNT_HEALTH_CHECK",
      entities: { products: [], cities: [], metrics: [] }
    }, data).data;
    var productName = parsedIntent.entities.products[0] || getMemory().currentProduct;
    var cityName = parsedIntent.entities.cities[0] || getMemory().currentCity;
    var product = productSummary(findProduct(data, productName), dependency && dependency.spend);
    var city = citySummary(findCity(data, cityName));
    var mainIssues = detectIssues(accountHealth, product, city);
    var opportunities = detectOpportunities(accountHealth, product, city);
    var anomalies = detectAnomalies(accountHealth, product, city);
    var accountSpend = !product && dependency && dependency.spend ? dependency.spend : null;
    var accountProfit = accountSpend && accountSpend.amount
      ? Math.round((num(accountHealth.metrics.revenue) - num(accountSpend.amount)) * 100) / 100
      : null;
    var accountCpa = accountSpend && accountSpend.amount && data && data.overview && data.overview.totalOrders
      ? Math.round((num(accountSpend.amount) / Math.max(1, num(data.overview.totalOrders.value || data.overview.totalOrders))) * 100) / 100
      : null;
    var localAnswer = window.KhodAiAnalyticsEngine && window.KhodAiAnalyticsEngine.localResponse
      ? window.KhodAiAnalyticsEngine.localResponse(parsedIntent, analyticsResult || {})
      : "";
    var exactRows = analyticsResult && analyticsResult.data;

    return {
      intent: parsedIntent.intent,
      question: clean(parsedIntent.rawText, 500),
      localAnswer: clean(localAnswer, 1400),
      localResultType: analyticsResult && analyticsResult.type || "",
      localResultRows: Array.isArray(exactRows) ? exactRows.slice(0, 6) : exactRows,
      sessionFocus: {
        product: productName || null,
        city: cityName || null,
        timeframe: getMemory().currentTimeframe || null
      },
      accountHealth: {
        revenue: accountHealth.metrics.revenue,
        profit: product && product.profit != null ? product.profit : accountHealth.metrics.profit,
        lostCommission: accountHealth.metrics.lostCommission,
        ndr: accountHealth.metrics.ndr,
        deliveryRate: accountHealth.metrics.deliveryRate,
        mainIssues: mainIssues
      },
      selectedProduct: product,
      selectedCity: city,
      worstProducts: accountHealth.topLosingProducts || [],
      worstCities: accountHealth.worstCities || [],
      opportunities: opportunities,
      anomalies: anomalies,
      localCalculations: {
        spend: dependency && dependency.spend || null,
        currency: dependency && dependency.currency || null,
        missingInputs: dependency && dependency.missing || [],
        accountProfit: accountProfit,
        accountCpa: accountCpa,
        profitComputedLocally: !!(product && product.profit != null),
        cpaComputedLocally: !!(product && product.cpa != null)
      },
      operatorInstruction: "Explain root causes, relationships between KPIs, priorities, and end with actionable Tips."
    };
  }

  function localOnlyResult(parsedIntent, analyticsResult) {
    var text = window.KhodAiAnalyticsEngine && window.KhodAiAnalyticsEngine.localResponse
      ? window.KhodAiAnalyticsEngine.localResponse(parsedIntent, analyticsResult || {})
      : "This request is handled locally.";
    if (parsedIntent.intent === "RANKING_QUERY" && analyticsResult && Array.isArray(analyticsResult.data) && analyticsResult.data[0]) {
      if (analyticsResult.data[0].type === "product" && window.KhodAiSessionMemory) {
        window.KhodAiSessionMemory.update({
          intent: parsedIntent.intent,
          rawText: parsedIntent.rawText,
          entities: { products: [analyticsResult.data[0].name], cities: [], dates: [] }
        });
      }
      if (analyticsResult.data[0].type === "city" && window.KhodAiSessionMemory) {
        window.KhodAiSessionMemory.update({
          intent: parsedIntent.intent,
          rawText: parsedIntent.rawText,
          entities: { products: [], cities: [analyticsResult.data[0].name], dates: [] }
        });
      }
    }
    var actions = [];
    if (parsedIntent.intent === "RANKING_QUERY") actions.push({ type: "OPEN_PAGE", label: "View Ranked Products", route: "/dashboard/products?sort=ranked", section: "products" });
    if (parsedIntent.intent === "RANKING_QUERY" && parsedIntent.entities && parsedIntent.entities.rankingEntity === "cities") {
      actions = [{ type: "OPEN_PAGE", label: "Open City Analytics", route: "/dashboard/cities?sort=commission", section: "cities" }];
    }
    if (parsedIntent.intent === "KPI_ANALYSIS") actions.push({ type: "OPEN_PAGE", label: "Open KPI Overview", route: "/dashboard/overview", section: "overview" });
    if (parsedIntent.intent === "COMPARISON_QUERY") actions.push({ type: "OPEN_PAGE", label: "Compare Dashboard Signals", route: "/dashboard/products?view=compare", section: "products" });
    if (parsedIntent.intent === "CALCULATOR_SIMULATION") actions.push({ type: "OPEN_PAGE", label: "Open Calculator", route: "/dashboard/calculator", section: "calculator" });
    if (parsedIntent.intent === "SCALE_ANALYSIS") actions.push({ type: "OPEN_PAGE", label: "View Scale Candidates", route: "/dashboard/products?sort=scale", section: "products" });
    return { mode: "local", message: text, actions: actions, parsedIntent: parsedIntent, analyticsResult: analyticsResult };
  }

  function ensureTips(message, parsedIntent, actions) {
    var text = clean(message, 1800);
    if (!text) text = "Dashboard analysis is ready.";
    if (/Tips:/i.test(text)) return text;
    var tips = [];
    var intent = parsedIntent && parsedIntent.intent || "";
    if (intent === "RANKING_QUERY") {
      tips.push("Open the ranked section and compare the first item against the account average.");
      tips.push("Check NDR, delivered orders, and commission before increasing spend.");
    } else if (intent === "CALCULATOR_SIMULATION") {
      tips.push("Use the calculator with current spend, currency, and delivery assumptions.");
      tips.push("Test one conservative scenario before scaling budget.");
    } else if (intent === "KPI_ANALYSIS") {
      tips.push("Compare this KPI with delivery rate, cancellation rate, and lost commission.");
      tips.push("Prioritize the product or city creating the largest negative movement.");
    } else if (intent === "COMPARISON_QUERY") {
      tips.push("Compare both sides using the same date mode and account filter.");
      tips.push("Act on the side with better delivery quality and lower risk first.");
    } else {
      tips.push("Start with the biggest loss signal before changing spend.");
      tips.push("Use the linked dashboard action to inspect the underlying orders.");
    }
    if (actions && actions[0] && actions[0].label) {
      tips.push("Next action: " + clean(actions[0].label, 80) + ".");
    }
    return text + "\n\nTips:\n- " + tips.slice(0, 3).join("\n- ");
  }

  function rememberMissingInputsForGemini(text, dependency, calculatorDependency) {
    if (!window.KhodAiSessionMemory || typeof window.KhodAiSessionMemory.setPending !== "function") return;
    if (calculatorDependency && calculatorDependency.ok === false) {
      window.KhodAiSessionMemory.setPending({
        scope: "calculator",
        missing: calculatorDependency.missing || [],
        originalQuestion: text
      });
      return;
    }
    if (dependency && dependency.ok === false) {
      window.KhodAiSessionMemory.setPending({
        scope: dependency.scope || "account",
        product: dependency.product || "",
        missing: dependency.missing || [],
        originalQuestion: text
      });
    }
  }

  function rememberProductLookupForGemini(text, parsedIntent) {
    if (!window.KhodAiSessionMemory || typeof window.KhodAiSessionMemory.setPending !== "function") return;
    var entities = parsedIntent && parsedIntent.entities || {};
    var candidates = Array.isArray(entities.productCandidates) ? entities.productCandidates : [];
    if (!candidates.length && !entities.productQueryTooShort) return;
    window.KhodAiSessionMemory.setPending({
      scope: "product_lookup",
      originalQuestion: text,
      candidates: candidates
    });
  }

  function orchestrate(text, data) {
    var memory = getMemory();
    var pendingResolution = maybeResolvePending(text, memory);
    if (pendingResolution && pendingResolution.mode === "followup") return pendingResolution;
    if (pendingResolution && pendingResolution.mode === "resume") text = pendingResolution.text;

    var parsedIntent = window.KhodAiIntentDetector.parse(text, data, getMemory());
    var analyticsResult = window.KhodAiAnalyticsEngine.processIntent(parsedIntent, data || {});
    if (window.KhodAiSessionMemory) window.KhodAiSessionMemory.update(parsedIntent);

    var needsProductClarification = isProductMetricIntentWithoutProduct(parsedIntent);
    if (needsProductClarification) {
      // Allow conversational/business queries to proceed to Gemini instead of strictly blocking or clarifying
      console.log("[KhodAI-Orchestrator] Product metric query without product, proceeding to AI mode.");
      rememberProductLookupForGemini(text, parsedIntent);
    }

    var calculatorDependency = validateCalculatorDependencies(parsedIntent);
    // Do not force conversational followup - let Gemini answer based on available context
    
    var dependency = validateDependencies(parsedIntent, analyticsResult, data || {});
    // Do not force conversational followup - let Gemini answer based on available context
    rememberMissingInputsForGemini(text, dependency, calculatorDependency);

    var strategicContext = buildStrategicContext(parsedIntent, analyticsResult, data || {}, dependency);
    var exactLocal = localOnlyResult(parsedIntent, analyticsResult);
    var localStrategic = /^(RANKING_QUERY|KPI_ANALYSIS|COMPARISON_QUERY|CALCULATOR_SIMULATION|SCALE_ANALYSIS)$/.test(parsedIntent.intent)
      ? { message: exactLocal.message, actions: exactLocal.actions || [], insights: [], recommendations: [], alerts: [] }
      : window.KhodAiLocalReasoningEngine && window.KhodAiLocalReasoningEngine.compose
      ? window.KhodAiLocalReasoningEngine.compose(strategicContext)
      : { message: "Local strategic analysis is ready.", actions: [] };
    if (isDirectProductMetricQuestion(parsedIntent)) {
      var directProductName = parsedIntent.entities.products[0] || getMemory().currentProduct;
      var directProduct = findProduct(data || {}, directProductName);
      localStrategic = {
        message: productMetricResponse(directProduct, data || {}, dependency),
        actions: [
          { type: "OPEN_PRODUCT", label: "Open Product Analytics", route: "/dashboard/products?product=" + slug(directProductName), productId: directProductName },
          { type: "OPEN_PAGE", label: "Open Product Calculator", route: "/calculator/product?product=" + slug(directProductName), section: "productForecast", productId: directProductName }
        ],
        insights: [],
        recommendations: [],
        alerts: []
      };
    }
    if (needsProductClarification) {
      localStrategic = {
        message: productClarificationMessage(parsedIntent),
        actions: [],
        insights: [],
        recommendations: [],
        alerts: []
      };
      strategicContext.needsClarification = {
        type: "product",
        candidates: parsedIntent.entities && parsedIntent.entities.productCandidates || []
      };
    }
    localStrategic.message = ensureTips(localStrategic.message, parsedIntent, localStrategic.actions || []);
    strategicContext.localStrategicSkeleton = {
      message: localStrategic.message,
      rootCauses: localStrategic.localReasoning && localStrategic.localReasoning.rootCauses || [],
      opportunities: localStrategic.localReasoning && localStrategic.localReasoning.opportunities || [],
      tips: localStrategic.localReasoning && localStrategic.localReasoning.tips || [],
      actions: localStrategic.actions || []
    };

    return {
      mode: "ai",
      parsedIntent: parsedIntent,
      analyticsResult: analyticsResult,
      context: strategicContext,
      localStrategic: localStrategic
    };
  }

  window.KhodAiBusinessOrchestrator = {
    orchestrate: orchestrate,
    validateDependencies: validateDependencies,
    validateCalculatorDependencies: validateCalculatorDependencies,
    buildStrategicContext: buildStrategicContext
  };
})();
