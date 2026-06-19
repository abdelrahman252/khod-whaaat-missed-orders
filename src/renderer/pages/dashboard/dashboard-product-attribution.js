(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KhodProductAttribution = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = 3;
  var MAX_CANDIDATES = 5;
  var ARABIC_DIGITS = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669";
  var NAME_STOP_WORDS = {
    ad: true, ads: true, campaign: true, campaigns: true, sales: true, sale: true,
    lead: true, leads: true, tiktok: true, tik: true, tok: true, snapchat: true,
    snap: true, sc: true, facebook: true, fb: true, meta: true, ksa: true,
    saudi: true, offer: true, new: true, test: true, original: true, product: true,
    "\u0645\u0646\u062a\u062c": true,
    "\u0639\u0631\u0636": true,
    "\u062c\u062f\u064a\u062f": true,
    "\u0627\u0635\u0644\u064a": true,
    "\u062d\u0645\u0644\u0647": true,
    "\u062c\u0647\u0627\u0632": true,
    "\u0628\u0639\u062f": true,
    "\u062a\u0639\u0645\u0644": true,
    "\u064a\u0639\u0645\u0644": true,
    "\u0639\u062f\u062f": true,
    "\u0642\u0637\u0639\u0647": true,
    "\u062d\u0628\u0647": true
  };

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizeText(value) {
    return text(value).toLowerCase().normalize("NFKC")
      .replace(/[\u0660-\u0669]/g, function (digit) { return String(ARABIC_DIGITS.indexOf(digit)); })
      .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, "")
      .replace(/\u0640/g, "")
      .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
      .replace(/[\u0649\u0626]/g, "\u064a")
      .replace(/\u0624/g, "\u0648")
      .replace(/[\u0629\u0647]/g, "\u0647")
      .replace(/[^\w\u0600-\u06ff]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactText(value) {
    return normalizeText(value).replace(/[^\w\u0600-\u06ff]+/g, "");
  }

  function hasTerm(normalizedText, normalizedTerm) {
    return !!normalizedTerm &&
      (" " + normalizedText + " ").indexOf(" " + normalizedTerm + " ") !== -1;
  }

  function parseSkuList(value) {
    var source = Array.isArray(value) ? value : [value];
    var seen = {};
    var list = [];
    source.forEach(function (item) {
      text(item).split(/[\r\n,|]+/).forEach(function (part) {
        var raw = text(part);
        var normalized = normalizeText(raw);
        var compact = compactText(raw);
        if (!compact || compact === "na" || compact.length < 2 || seen[compact]) return;
        seen[compact] = true;
        list.push({ raw: raw, normalized: normalized, compact: compact });
      });
    });
    return list;
  }

  function nameTokens(value) {
    return normalizeText(value).split(" ").filter(function (token) {
      return token.length >= 3 &&
        !NAME_STOP_WORDS[token] &&
        !/^x\d+$/i.test(token) &&
        !/^\d+$/.test(token);
    });
  }

  function productId(product, index) {
    return text(product && (product.id || product.key || product.legacyKey || product.sku || product.name)) ||
      "product-" + index;
  }

  function normalizeCountry(value) {
    var country = normalizeText(value);
    return country === "unknown" || country === "na" || country === "n a" ? "" : country;
  }

  function addScope(list, seen, accountId, country) {
    var account = text(accountId);
    var normalizedCountry = normalizeCountry(country);
    if (!account && !normalizedCountry) return;
    var key = account + "|" + normalizedCountry;
    if (seen[key]) return;
    seen[key] = true;
    list.push({ accountId: account, country: normalizedCountry });
  }

  function productScopes(product) {
    var list = [];
    var seen = {};
    var directAccount = text(product && (product.accountId || product.dashboardAccountId));
    var directCountry = product && (product.khodCountry || product.country);
    addScope(list, seen, directAccount, directCountry);

    (Array.isArray(product && product.scopes) ? product.scopes : []).forEach(function (scope) {
      addScope(list, seen, scope && (scope.accountId || scope.dashboardAccountId), scope && (scope.khodCountry || scope.country));
    });

    (Array.isArray(product && product.accountIds) ? product.accountIds : []).forEach(function (accountId) {
      var account = text(accountId);
      if (!list.some(function (scope) { return scope.accountId === account; })) {
        addScope(list, seen, account, "");
      }
    });

    Object.keys(product && product.accounts || {}).forEach(function (accountId) {
      var account = product.accounts[accountId];
      if (!list.some(function (scope) { return scope.accountId === text(accountId); })) {
        addScope(list, seen, accountId, account && typeof account === "object"
          ? (account.khodCountry || account.country)
          : "");
      }
    });

    (Array.isArray(product && product.countries) ? product.countries : []).forEach(function (country) {
      var normalizedCountry = normalizeCountry(country);
      if (!list.some(function (scope) { return scope.country === normalizedCountry; })) {
        addScope(list, seen, "", normalizedCountry);
      }
    });
    return list;
  }

  function createProductIndex(products) {
    var accountIds = {};
    var countries = {};
    var entries = (Array.isArray(products) ? products : []).map(function (product, index) {
      var skus = parseSkuList(product && (product.skus || product.sku || product.sku_code || product.skuCode));
      var name = text(product && (product.displayName || product.productName || product.product || product.name)) ||
        (skus[0] && skus[0].raw) || "";
      var scopes = productScopes(product);
      scopes.forEach(function (scope) {
        if (scope.accountId) accountIds[scope.accountId] = true;
        if (scope.country) countries[scope.country] = true;
      });
      return {
        id: productId(product, index),
        idx: index,
        product: product,
        scopes: scopes,
        skus: skus,
        name: name,
        normalizedName: normalizeText(name),
        tokens: nameTokens(name)
      };
    });
    return {
      version: VERSION,
      entries: entries,
      requiresScope: Object.keys(accountIds).length > 1 || Object.keys(countries).length > 1,
      accountIds: Object.keys(accountIds).sort(),
      countries: Object.keys(countries).sort()
    };
  }

  function campaignName(value) {
    if (value && typeof value === "object") {
      return text(value.campaign || value.campaignName || value.name || value.campaign_name);
    }
    return text(value);
  }

  function scopeFor(value, options) {
    options = options || {};
    var row = value && typeof value === "object" ? value : {};
    var accountId = text(
      options.accountId ||
      row.dashboardAccountId ||
      row.khodAccountId ||
      row.accountId ||
      ""
    );
    if (accountId === "__all__") accountId = "";
    return {
      accountId: accountId,
      country: normalizeCountry(options.country || row.khodCountry || row.country)
    };
  }

  function inScope(entry, scope) {
    if (!entry.scopes.length) return true;
    if (!scope.accountId && !scope.country) return true;
    return entry.scopes.some(function (candidate) {
      if (scope.accountId && candidate.accountId && candidate.accountId !== scope.accountId) return false;
      if (scope.country && candidate.country && candidate.country !== scope.country) return false;
      return true;
    });
  }

  function candidateIds(entries) {
    var seen = {};
    return entries.map(function (entry) { return entry.id; }).filter(function (id) {
      if (!id || seen[id]) return false;
      seen[id] = true;
      return true;
    }).sort().slice(0, MAX_CANDIDATES);
  }

  function withLegacyFields(result) {
    result.matchMethod = result.method;
    result.matchConfidence = result.confidence;
    return result;
  }

  function unmatched(detail, entries) {
    return withLegacyFields({
      status: "unmatched",
      product: null,
      productIndex: -1,
      method: "unmatched",
      matchDetail: detail || "no_match",
      confidence: "none",
      matchedSku: "",
      candidateIds: candidateIds(entries || [])
    });
  }

  function ambiguous(detail, entries) {
    return withLegacyFields({
      status: "ambiguous",
      product: null,
      productIndex: -1,
      method: "ambiguous",
      matchDetail: detail || "multiple_products",
      confidence: "none",
      matchedSku: "",
      candidateIds: candidateIds(entries || [])
    });
  }

  function matched(entry, method, detail, confidence, matchedSku) {
    return withLegacyFields({
      status: "matched",
      product: entry.product,
      productIndex: entry.idx,
      method: method,
      matchDetail: detail,
      confidence: confidence,
      matchedSku: matchedSku || "",
      candidateIds: [entry.id]
    });
  }

  function pruneNestedSkuMatches(matches) {
    return matches.filter(function (candidate) {
      return !matches.some(function (other) {
        return other.sku.compact !== candidate.sku.compact &&
          other.sku.compact.length > candidate.sku.compact.length &&
          other.sku.compact.indexOf(candidate.sku.compact) !== -1;
      });
    });
  }

  function hasSeparatedSku(normalizedCampaign, sku) {
    if (hasTerm(normalizedCampaign, sku.normalized)) return true;
    var tokens = normalizedCampaign.split(" ").filter(Boolean);
    for (var start = 0; start < tokens.length; start += 1) {
      var joined = "";
      for (var end = start; end < tokens.length; end += 1) {
        joined += compactText(tokens[end]);
        if (joined === sku.compact) return true;
        if (joined.length >= sku.compact.length) break;
      }
    }
    return false;
  }

  function skuMatch(normalizedCampaign, compactCampaign, entries) {
    var matches = [];
    entries.forEach(function (entry) {
      entry.skus.forEach(function (sku) {
        var separated = hasSeparatedSku(normalizedCampaign, sku);
        if (separated || compactCampaign.indexOf(sku.compact) !== -1) {
          matches.push({ entry: entry, sku: sku, separated: separated });
        }
      });
    });
    if (!matches.length) return null;

    var maximal = pruneNestedSkuMatches(matches);
    var bySku = {};
    maximal.forEach(function (match) {
      if (!bySku[match.sku.compact]) bySku[match.sku.compact] = [];
      bySku[match.sku.compact].push(match);
    });

    var detectedSkus = Object.keys(bySku);
    if (detectedSkus.length > 1) {
      var multiEntries = [];
      var multiSeen = {};
      maximal.forEach(function (match) {
        if (multiSeen[match.entry.id]) return;
        multiSeen[match.entry.id] = true;
        multiEntries.push(match.entry);
      });
      if (multiEntries.length > 1) return ambiguous("multiple_products", multiEntries);
      return matched(
        multiEntries[0],
        "sku",
        "multiple_skus_same_product",
        "high",
        maximal.map(function (match) { return match.sku.raw; }).join(", ")
      );
    }

    var skuMatches = bySku[detectedSkus[0]] || [];
    var uniqueEntries = [];
    var seenEntries = {};
    skuMatches.forEach(function (match) {
      if (seenEntries[match.entry.id]) return;
      seenEntries[match.entry.id] = true;
      uniqueEntries.push(match.entry);
    });
    if (uniqueEntries.length !== 1) return ambiguous("sku_collision", uniqueEntries);

    var winningEntry = uniqueEntries[0];
    var winningMatch = skuMatches.find(function (match) {
      return match.entry.id === winningEntry.id && match.separated;
    }) || skuMatches.find(function (match) {
      return match.entry.id === winningEntry.id;
    });
    return matched(
      winningEntry,
      "sku",
      winningMatch.separated ? "sku_separated" : "sku_glued",
      "high",
      winningMatch.sku.raw
    );
  }

  function tokenOwners(entries) {
    var owners = {};
    entries.forEach(function (entry) {
      entry.tokens.forEach(function (token) {
        owners[token] = (owners[token] || 0) + 1;
      });
    });
    return owners;
  }

  function nameScore(normalizedCampaign, entry, owners) {
    if (!entry.normalizedName || !entry.tokens.length) return null;
    var hits = entry.tokens.filter(function (token) { return hasTerm(normalizedCampaign, token); });
    var fullPhrase = hasTerm(normalizedCampaign, entry.normalizedName);
    var uniqueHit = hits.some(function (token) {
      return token.length >= 4 && owners[token] === 1;
    });
    if (fullPhrase) {
      return { score: 1000 + entry.normalizedName.length, detail: "name_phrase", confidence: "high" };
    }
    if (hits.length >= 2) {
      return {
        score: 500 + hits.reduce(function (sum, token) { return sum + token.length; }, 0),
        detail: "name_tokens",
        confidence: "high"
      };
    }
    if (uniqueHit) {
      return {
        score: 250 + hits[0].length,
        detail: "name_unique_token",
        confidence: "medium"
      };
    }
    return null;
  }

  function nameMatch(normalizedCampaign, entries) {
    var owners = tokenOwners(entries);
    var scored = entries.map(function (entry) {
      var score = nameScore(normalizedCampaign, entry, owners);
      return score ? { entry: entry, score: score } : null;
    }).filter(Boolean).sort(function (a, b) {
      if (b.score.score !== a.score.score) return b.score.score - a.score.score;
      return a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0;
    });
    if (!scored.length) return unmatched("no_match");
    if (scored[1] && scored[0].score.score === scored[1].score.score) {
      var tied = scored.filter(function (item) {
        return item.score.score === scored[0].score.score;
      });
      return unmatched("ambiguous_name", tied.map(function (item) { return item.entry; }));
    }
    return matched(scored[0].entry, "name", scored[0].score.detail, scored[0].score.confidence, "");
  }

  function matchCampaignName(value, index, options) {
    index = index && Array.isArray(index.entries) ? index : createProductIndex([]);
    var rawCampaign = campaignName(value);
    var normalizedCampaign = normalizeText(rawCampaign);
    if (!normalizedCampaign) return unmatched("empty_campaign");

    var scope = scopeFor(value, options);
    if (index.requiresScope && !scope.accountId && !scope.country) {
      return unmatched("missing_scope");
    }
    var entries = index.entries.filter(function (entry) {
      if (index.requiresScope && !entry.scopes.length) return false;
      return inScope(entry, scope);
    });
    if (!entries.length) return unmatched("no_scope_products");

    var skuResult = skuMatch(normalizedCampaign, compactText(rawCampaign), entries);
    if (skuResult) return skuResult;
    return nameMatch(normalizedCampaign, entries);
  }

  function defaultSpend(row) {
    var value = row && (
      row.attributionSpendSar != null ? row.attributionSpendSar :
      row.convertedSpend != null ? row.convertedSpend :
      row.rawSpend != null ? row.rawSpend :
      row.spend != null ? row.spend : 0
    );
    var amount = Number(value);
    return isFinite(amount) ? amount : 0;
  }

  function attributeCampaignRows(rows, index, options) {
    options = options || {};
    var assignments = {};
    var matchedRows = [];
    var summary = {
      version: VERSION,
      matchedRows: 0,
      separatedSkuRows: 0,
      gluedSkuRows: 0,
      nameRows: 0,
      ambiguousRows: 0,
      unmatchedRows: 0,
      matchedSpend: 0,
      ambiguousSpend: 0,
      unmatchedSpend: 0
    };
    var getSpend = typeof options.getSpend === "function" ? options.getSpend : defaultSpend;

    (Array.isArray(rows) ? rows : []).forEach(function (row, rowIndex) {
      var matchOptions = typeof options.scopeForRow === "function"
        ? options.scopeForRow(row, rowIndex) || {}
        : { accountId: options.accountId, country: options.country };
      var result = matchCampaignName(row, index, matchOptions);
      var spend = Number(getSpend(row, rowIndex));
      if (!isFinite(spend)) spend = 0;
      matchedRows.push({ row: row, rowIndex: rowIndex, spend: spend, result: result });

      if (result.status === "matched") {
        summary.matchedRows += 1;
        summary.matchedSpend += spend;
        if (result.matchDetail === "sku_separated") summary.separatedSkuRows += 1;
        else if (result.matchDetail === "sku_glued") summary.gluedSkuRows += 1;
        else if (result.method === "name") summary.nameRows += 1;

        if (!assignments[result.productIndex]) {
          assignments[result.productIndex] = {
            product: result.product,
            productIndex: result.productIndex,
            spend: 0,
            rowCount: 0,
            methods: {},
            details: {}
          };
        }
        assignments[result.productIndex].spend += spend;
        assignments[result.productIndex].rowCount += 1;
        assignments[result.productIndex].methods[result.method] = true;
        assignments[result.productIndex].details[result.matchDetail] = true;
      } else if (result.status === "ambiguous") {
        summary.ambiguousRows += 1;
        summary.ambiguousSpend += spend;
      } else {
        summary.unmatchedRows += 1;
        summary.unmatchedSpend += spend;
      }
    });

    return {
      version: VERSION,
      rows: matchedRows,
      assignments: assignments,
      summary: summary
    };
  }

  function toLegacyResult(result) {
    result = result || unmatched("no_match");
    return {
      product: result.product,
      idx: result.productIndex,
      method: result.method,
      confidence: result.confidence,
      matchMethod: result.method,
      matchConfidence: result.confidence,
      matchDetail: result.matchDetail,
      matchedSku: result.matchedSku,
      candidateIds: result.candidateIds.slice(),
      status: result.status
    };
  }

  return {
    VERSION: VERSION,
    MAX_CANDIDATES: MAX_CANDIDATES,
    normalizeText: normalizeText,
    compactText: compactText,
    hasTerm: hasTerm,
    parseSkuList: parseSkuList,
    createProductIndex: createProductIndex,
    matchCampaignName: matchCampaignName,
    matchCampaign: matchCampaignName,
    attributeCampaignRows: attributeCampaignRows,
    toLegacyResult: toLegacyResult,
    withLegacyFields: withLegacyFields
  };
});
