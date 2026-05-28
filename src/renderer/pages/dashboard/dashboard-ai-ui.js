(function () {
  "use strict";

  var rootRef = null;
  var dataRef = null;
  var ctxRef = null;
  var isOpen = false;
  var lastState = null;
  var popupMessages = [];
  var popupBusy = false;
  var popupRequestSeq = 0;
  var popupInjectedAi = { insights: [], recommendations: [], forecasts: [], alerts: [] };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function icon(name) {
    if (window.icon) return window.icon(name, { size: 15, color: "currentColor" });
    return "";
  }

  function tr(key, fallback, params) {
    var value = window.dashboardI18n ? window.dashboardI18n.t(key, params || null) : key;
    return value && value !== key ? value : (fallback || key);
  }

  function num(value) {
    if (window.dashboardI18n) return window.dashboardI18n.number(Number(value || 0), { maximumFractionDigits: 0 });
    return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function getAiSessionId() {
    try {
      var key = "khod_ai_session_id";
      var existing = localStorage.getItem(key);
      if (existing) return existing;
      var next = "ai-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(key, next);
      return next;
    } catch (_) {
      return "ai-session";
    }
  }

  function sectionForTarget(target) {
    target = String(target || "").toLowerCase();
    if (target.indexOf("product-forecast") !== -1 || target.indexOf("forecast") !== -1) return "productForecast";
    if (target.indexOf("products") !== -1) return "products";
    if (target.indexOf("cities") !== -1 || target.indexOf("city") !== -1) return "cities";
    if (target.indexOf("calculator") !== -1 || target.indexOf("roi") !== -1) return "calculator";
    if (target.indexOf("cod") !== -1) return "cod";
    if (target.indexOf("pipeline") !== -1) return "pipeline";
    if (target.indexOf("orders") !== -1) return "orders";
    if (target.indexOf("commission") !== -1) return "commission";
    if (target.indexOf("prepaid") !== -1) return "prepaid";
    return "master";
  }

  function navigate(section) {
    if (ctxRef && typeof ctxRef.onNavigate === "function") ctxRef.onNavigate(section);
  }

  function findProductById(id) {
    var list = dataRef && dataRef.products && dataRef.products.rankedList ? dataRef.products.rankedList : [];
    var needle = String(id || "").toLowerCase();
    return list.find(function (p) {
      return [p.key, p.sku, p.name, p.rank].some(function (v) {
        return String(v == null ? "" : v).toLowerCase() === needle;
      });
    });
  }

  function findCity(name) {
    var cityStats = dataRef && dataRef.geo && dataRef.geo.cityStats ? dataRef.geo.cityStats : {};
    var needle = String(name || "").toLowerCase();
    return Object.keys(cityStats).find(function (city) {
      return city.toLowerCase() === needle || city.toLowerCase().indexOf(needle) !== -1;
    });
  }

  function highlightProduct(productKey) {
    setTimeout(function () {
      var row = document.querySelector('.s5-product-row[data-product-key="' + CSS.escape(String(productKey)) + '"]');
      if (!row) return;
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.classList.add("ai-target-pulse");
      setTimeout(function () { row.classList.remove("ai-target-pulse"); }, 1600);
    }, 280);
  }

  function runAction(action) {
    if (!action || !action.type) return;
    var type = String(action.type).toUpperCase();

    if (type === "NAVIGATE" || type === "OPEN_PAGE") {
      navigate(action.section || sectionForTarget(action.target));
      if (action.productId && window.DashboardFilterBus) {
        window.DashboardFilterBus.setState({ selectedProduct: action.productId, mapMode: window.DashboardFilterBus.MODES.PRODUCT });
      }
      if (action.city && window.DashboardFilterBus) {
        window.DashboardFilterBus.setState({ selectedCity: action.city });
      }
      if (action.filter) {
        window.dispatchEvent(new CustomEvent("dashboard-ai-filter-products", { detail: { filter: action.filter } }));
      }
      return;
    }

    if (type === "OPEN_PRODUCT") {
      var product = findProductById(action.productId || action.productKey);
      var key = product ? (product.key || product.sku || product.name) : (action.productKey || action.productId);
      if (window.DashboardFilterBus) {
        window.DashboardFilterBus.setState({ selectedProduct: key, mapMode: window.DashboardFilterBus.MODES.PRODUCT });
      }
      navigate("products");
      if (key) {
        highlightProduct(key);
        setTimeout(function () {
          if (typeof window.openProductModal === "function") {
            window.openProductModal(key);
          }
        }, 320);
      }
      return;
    }

    if (type === "OPEN_CITY") {
      var city = findCity(action.city || action.target);
      if (window.DashboardFilterBus && city) window.DashboardFilterBus.setState({ selectedCity: city });
      navigate("cities");
      return;
    }

    if (type === "FILTER_PRODUCTS") {
      navigate("products");
      window.dispatchEvent(new CustomEvent("dashboard-ai-filter-products", { detail: { filter: action.filter || "" } }));
    }
  }

  function buildFallbackState(data) {
    var context = window.getDashboardAiContext
      ? window.getDashboardAiContext({ data: data })
      : (window.buildDashboardAiContext ? window.buildDashboardAiContext({ data: data }) : {});
    var local = context.localSummary || { message: tr("aii.summary.ready", "AI is ready for review."), insights: [] };
    var insights = (local.insights || []).map(function (text, idx) {
      return {
        id: "local-" + idx,
        title: local.message || tr("dashboardAi.signal.title", "AI insights available"),
        summary: text,
        severity: "info",
        confidence: "limited",
      };
    });
    return {
      insights: insights,
      recommendations: [],
      forecasts: [],
      alerts: [],
      health: { score: insights.length ? 58 : 0, label: tr("dashboardAi.health.local", "Local dashboard signals") },
      opportunityScore: insights.length ? 48 : 0,
      state: insights.length ? "partial" : "empty",
    };
  }

  function pushInjectedAi(normalized) {
    normalized = normalized || {};
    if (normalized.insights && normalized.insights.length) {
      popupInjectedAi.insights = normalized.insights.concat(popupInjectedAi.insights).slice(0, 8);
    }
    if (normalized.recommendations && normalized.recommendations.length) {
      popupInjectedAi.recommendations = normalized.recommendations.concat(popupInjectedAi.recommendations).slice(0, 8);
    }
    if (normalized.forecasts && normalized.forecasts.length) {
      popupInjectedAi.forecasts = normalized.forecasts.concat(popupInjectedAi.forecasts).slice(0, 6);
    }
    if (normalized.alerts && normalized.alerts.length) {
      popupInjectedAi.alerts = normalized.alerts.concat(popupInjectedAi.alerts).slice(0, 6);
    }
  }

  function buildSignalState(data) {
    if (data && (data._loading || data._loaded === false)) {
      return {
        status: "loading",
        count: 0,
        urgent: 0,
        title: tr("dashboardAi.loadingTitle", "AI is reviewing dashboard signals"),
        body: tr("dashboardAi.loadingBody", "Insights will appear when the dashboard finishes loading."),
        items: [],
      };
    }

    var serviceAvailable = !!(window.api && typeof window.api.dashboardAiQuery === "function");
    var intelligence = window.KhodAiIntelligenceData && window.KhodAiIntelligenceData.build
      ? window.KhodAiIntelligenceData.build({ data: data || {} })
      : buildFallbackState(data || {});

    var alerts = popupInjectedAi.alerts.concat(intelligence.alerts || []);
    var insights = popupInjectedAi.insights.concat(intelligence.insights || []);
    var recommendations = popupInjectedAi.recommendations.concat(intelligence.recommendations || []);
    var forecasts = popupInjectedAi.forecasts.concat(intelligence.forecasts || []);
    var urgent = alerts.filter(function (item) { return item.urgency === "high" || item.urgency === "critical"; }).length;
    var count = insights.length + recommendations.length + forecasts.length + alerts.length;
    var status = "populated";

    if (!window.KhodAiIntelligenceData) status = "unavailable";
    else if (!count) status = "empty";
    else if (urgent) status = "alert";
    else if (!serviceAvailable) status = "populated";

    var title;
    var body;
    if (status === "alert") {
      title = tr("dashboardAi.alertTitle", "AI detected urgent opportunities");
      body = tr("dashboardAi.alertBody", "Review the highest-impact signals in AI Intelligence.");
    } else if (status === "empty") {
      title = tr("dashboardAi.emptyTitle", "AI is quiet right now");
      body = tr("dashboardAi.emptyBody", "No strong AI findings are available for this dashboard view.");
    } else if (status === "unavailable") {
      title = tr("dashboardAi.unavailableTitle", "AI Intelligence is unavailable");
      body = tr("dashboardAi.unavailableBody", "Local dashboard analytics remain available.");
    } else {
      title = tr("dashboardAi.populatedTitle", "{count} AI insights available", { count: num(count) });
      body = tr("dashboardAi.populatedBody", "Open AI Intelligence for recommendations and forecasts.");
    }

    return {
      status: status,
      count: count,
      urgent: urgent,
      title: title,
      body: body,
      items: alerts.concat(insights).concat(recommendations).slice(0, 3),
      intelligence: intelligence,
    };
  }

  function renderItemAsMessage(item) {
    var label = item.urgency || item.severity || item.riskLevel || item.confidence || "info";
    var severityClass = "severity-" + label.toLowerCase();

    var title = item.title || "";
    var body = item.summary || item.reason || item.expectedBenefit || "";

    var titleHtml = title ? '<div class="ai-insight-title">' + esc(title) + '</div>' : '';
    var bodyHtml = (body && body !== title) ? '<div class="ai-insight-body" style="font-size: 11px; opacity: 0.8; margin-top: 2px;">' + esc(body) + '</div>' : '';

    return '<div class="ai-insight-block ' + esc(severityClass) + '">' +
             '<div class="ai-insight-label">' + esc(label) + '</div>' +
             titleHtml +
             bodyHtml +
           '</div>';
  }

  function renderPopupActions(actions, msgIdx) {
    actions = Array.isArray(actions) ? actions : [];
    if (!actions.length) return "";
    return '<div class="ai-popup-actions">' + actions.slice(0, 4).map(function (action, actionIdx) {
      return '<button type="button" class="ai-popup-action" data-ai-popup-action="' + msgIdx + ':' + actionIdx + '">' +
        esc(action.label || action.type || tr("aii.action.review", "Review")) +
      '</button>';
    }).join("") + '</div>';
  }

  function renderPopupMessage(msg, msgIdx) {
    var sender = msg.sender === "user" ? "user" : "ai";
    var state = msg.state || "complete";
    return '<div class="ai-message ' + esc(sender) + ' ' + esc(state) + '">' +
      '<div class="ai-message-bubble">' +
        '<div>' + esc(msg.text || "") + '</div>' +
        renderPopupActions(msg.actions, msgIdx) +
      '</div>' +
    '</div>';
  }

  function renderRoot(state) {
    var toggleText = isOpen ? tr("dashboardAi.closePanel", "Close AI insights") : tr("dashboardAi.openPanel", "Show AI insights");
    var placeholderText = tr("ai.askPlaceholder", "Ask AI about your business...");

    // Suggested prompts
    var prompts = [
      "Why is this product losing?",
      "Best cities to scale?",
      "Explain weak NDR",
      "Forecast next month"
    ];
    var promptsHtml = prompts.map(function(p) {
      return '<button type="button" class="ai-prompt-pill">' + esc(p) + '</button>';
    }).join("");

    var itemsHtml = state.items.length
      ? state.items.map(renderItemAsMessage).join("")
      : '<div class="ai-insight-block severity-info"><span class="ai-insight-title">' + esc(state.status === "loading" ? tr("dashboardAi.loadingBody", "Insights will appear when loading finishes.") : tr("dashboardAi.emptyBody", "No strong AI findings are available for this dashboard view.")) + '</span></div>';
    var feedHtml = popupMessages.length
      ? popupMessages.map(renderPopupMessage).join("")
      : '<div class="ai-message ai">' +
          '<div class="ai-message-bubble">' + esc(state.body) + '</div>' +
        '</div>' +
        (state.items.length || state.status === "empty" || state.status === "loading" ?
          '<div class="ai-message ai">' +
            '<div class="ai-message-bubble">' + itemsHtml + '</div>' +
          '</div>' : '');

    return '' +
      '<button type="button" class="ai-copilot-orb state-' + esc(state.status) + '" id="ai-copilot-orb" aria-expanded="' + (isOpen ? "true" : "false") + '" aria-controls="ai-copilot-panel" aria-label="' + esc(toggleText) + '" data-tooltip="' + esc(toggleText) + '">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L22 12L12 22L2 12L12 2Z"/></svg>' +
      '</button>' +
      '<section id="ai-copilot-panel" class="ai-copilot-panel" role="dialog" aria-label="' + esc(tr("dashboardAi.panelTitle", "Dashboard AI insights")) + '" aria-hidden="' + (isOpen ? "false" : "true") + '">' +
        '<div class="ai-panel-header">' +
          '<div class="ai-panel-title"><strong>Khod Whaat AI</strong><span>' + esc(popupBusy ? tr("ai.thinking", "Analyzing") : (state.status === 'loading' ? 'Scanning' : 'Ready')) + '</span></div>' +
          '<button type="button" id="ai-panel-close" class="ai-panel-close" aria-label="' + esc(tr("dashboardAi.closePanel", "Close AI insights")) + '">&#10005;</button>' +
        '</div>' +
        '<div class="ai-copilot-feed" id="ai-copilot-feed">' +
          feedHtml +
        '</div>' +
        '<div class="ai-copilot-input-area">' +
          '<div class="ai-suggested-prompts">' + promptsHtml + '</div>' +
          '<div class="ai-chat-input-wrapper">' +
            '<input type="text" class="ai-chat-input" id="ai-chat-input" placeholder="' + esc(placeholderText) + '" />' +
            '<button type="button" class="ai-chat-send" id="ai-chat-send" aria-label="Send"' + (popupBusy ? ' disabled' : '') + '>&#8593;</button>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function openPanel() {
    isOpen = true;
    refresh();
  }

  function closePanel() {
    isOpen = false;
    refresh();
  }

  function openIntelligencePage() {
    isOpen = false;
    navigate("khodAi");
  }

  function setPopupAssistant(requestId, state, text, actions) {
    var idx = popupMessages.findIndex(function (msg) { return msg.requestId === requestId; });
    if (idx === -1) return;
    popupMessages[idx] = {
      sender: "assistant",
      state: state || "complete",
      text: text || "",
      actions: actions || [],
      requestId: requestId,
    };
    refresh();
  }

  function localFallbackMessage(context) {
    context = context || {};
    var local = context.localSummary || {};
    var parts = [local.message].concat(local.insights || []).filter(Boolean);
    return parts.length ? parts.join("\n") : tr("ai.contextReady", "Dashboard context is ready.");
  }

  async function askPopup(prompt) {
    var text = String(prompt || "").trim();
    if (!text || popupBusy) return;

    isOpen = true;
    popupBusy = true;
    var requestId = ++popupRequestSeq;
    popupMessages.push({ sender: "user", state: "complete", text: text });
    popupMessages.push({
      sender: "assistant",
      state: "pending",
      text: tr("ai.thinking", "Analyzing dashboard intelligence..."),
      requestId: requestId,
    });
    refresh();

    var dashboardData = dataRef || window.dashboardGeoData || {};
    var context = {};
    var parsedIntent = null;
    var analyticsResult = null;
    var localStrategic = null;

    try {
      if (window.KhodAiBusinessOrchestrator && window.KhodAiBusinessOrchestrator.orchestrate) {
        var orchestration = window.KhodAiBusinessOrchestrator.orchestrate(text, dashboardData);
        if (orchestration.mode === "followup" || orchestration.mode === "local") {
          popupBusy = false;
          setPopupAssistant(requestId, orchestration.mode === "followup" ? "pending-input" : "complete", orchestration.message, orchestration.actions || []);
          return;
        }
        parsedIntent = orchestration.parsedIntent;
        analyticsResult = orchestration.analyticsResult;
        context = orchestration.context || {};
        localStrategic = orchestration.localStrategic || null;
      } else if (window.KhodAiIntentDetector && window.KhodAiAnalyticsEngine && window.KhodAiContextCompressor && window.KhodAiSessionMemory) {
        parsedIntent = window.KhodAiIntentDetector.parse(text, dashboardData, window.KhodAiSessionMemory.get());
        window.KhodAiSessionMemory.update(parsedIntent);
        analyticsResult = window.KhodAiAnalyticsEngine.processIntent(parsedIntent, dashboardData || {});
        context = window.KhodAiContextCompressor.compress(parsedIntent, analyticsResult);
      } else {
        context = window.getDashboardAiContext
          ? window.getDashboardAiContext({ data: dashboardData })
          : (window.buildDashboardAiContext ? window.buildDashboardAiContext({ data: dashboardData }) : {});
      }

      if (parsedIntent && (parsedIntent.blockedReason || parsedIntent.localOnly || parsedIntent.aiAllowed === false)) {
        var localText = window.KhodAiAnalyticsEngine && window.KhodAiAnalyticsEngine.localResponse
          ? window.KhodAiAnalyticsEngine.localResponse(parsedIntent, analyticsResult || {})
          : tr("ai.localFallback", "Use local dashboard insights for now.");
        popupBusy = false;
        setPopupAssistant(requestId, parsedIntent.blockedReason ? "error" : "complete", localText, []);
        return;
      }

      if (!window.api || typeof window.api.dashboardAiQuery !== "function") {
        popupBusy = false;
        setPopupAssistant(requestId, "complete", localStrategic ? localStrategic.message : localFallbackMessage(context), localStrategic && localStrategic.actions || []);
        return;
      }

      var response = await window.api.dashboardAiQuery({
        command: text,
        context: context,
        forceGemini: true,
        sessionId: getAiSessionId(),
        history: popupMessages.slice(-8).map(function (msg) {
          return { role: msg.sender === "user" ? "user" : "assistant", text: msg.text || "" };
        }),
      });
      var normalized = window.KhodAiIntelligenceData ? window.KhodAiIntelligenceData.normalizeAiResponse(response) : { message: response && response.message || "" };
      var meta = response && response.meta ? response.meta : {};
      var shouldUseLocal = localStrategic && (meta.blocked || meta.error || (meta.source === "fallback" && response.message === "AI service is not available. I am showing local dashboard guidance instead."));
      var answerText = shouldUseLocal
        ? localStrategic.message
        : (normalized.message || (localStrategic && localStrategic.message) || tr("ai.contextReady", "Analysis complete."));
      var answerActions = shouldUseLocal
        ? (localStrategic.actions || [])
        : ((normalized.actions && normalized.actions.length ? normalized.actions : (localStrategic && localStrategic.actions)) || []);

      if (shouldUseLocal && localStrategic) {
        normalized = {
          message: localStrategic.message,
          insights: localStrategic.insights || [],
          recommendations: localStrategic.recommendations || [],
          forecasts: localStrategic.forecasts || [],
          alerts: localStrategic.alerts || [],
        };
      }
      pushInjectedAi(normalized);
      popupBusy = false;
      setPopupAssistant(requestId, "complete", answerText, answerActions);
    } catch (err) {
      popupBusy = false;
      if (localStrategic) {
        pushInjectedAi(localStrategic);
        setPopupAssistant(requestId, "complete", localStrategic.message, localStrategic.actions || []);
      } else {
        setPopupAssistant(requestId, "error", tr("ai.requestFailed", "AI request failed.") + " " + (err && err.message ? err.message : ""), []);
      }
    }
  }

  function wire(root) {
    var orb = root.querySelector("#ai-copilot-orb");
    var close = root.querySelector("#ai-panel-close");
    var input = root.querySelector("#ai-chat-input");
    var sendBtn = root.querySelector("#ai-chat-send");
    var feed = root.querySelector("#ai-copilot-feed");
    var promptPills = root.querySelectorAll(".ai-prompt-pill");

    if (orb) orb.addEventListener("click", function () { isOpen ? closePanel() : openPanel(); });
    if (close) close.addEventListener("click", closePanel);

    function handleSend() {
      if (!input || !input.value.trim()) return;
      var text = input.value.trim();
      input.value = "";
      askPopup(text);
    }

    if (sendBtn) sendBtn.addEventListener("click", handleSend);
    if (input) {
      input.addEventListener("keydown", function(e) {
        if (e.key === "Enter") handleSend();
      });
    }

    var promptContainer = root.querySelector(".ai-suggested-prompts");
    var hasDragged = false;
    if (promptContainer) {
      var isDown = false;
      var startX;
      var scrollLeft;

      promptContainer.addEventListener("mousedown", function(e) {
        isDown = true;
        hasDragged = false;
        startX = e.pageX - promptContainer.offsetLeft;
        scrollLeft = promptContainer.scrollLeft;
        promptContainer.style.cursor = "grabbing";
      });
      promptContainer.addEventListener("mouseleave", function() {
        isDown = false;
        promptContainer.style.cursor = "";
      });
      promptContainer.addEventListener("mouseup", function() {
        isDown = false;
        promptContainer.style.cursor = "";
      });
      promptContainer.addEventListener("mousemove", function(e) {
        if (!isDown) return;
        e.preventDefault();
        var x = e.pageX - promptContainer.offsetLeft;
        var walk = (x - startX) * 2;
        if (Math.abs(walk) > 5) hasDragged = true;
        promptContainer.scrollLeft = scrollLeft - walk;
      });
    }

    promptPills.forEach(function(pill) {
      pill.addEventListener("click", function(e) {
        if (hasDragged) {
          e.preventDefault();
          return;
        }
        if (input) {
          input.value = "";
          input.focus();
        }
        askPopup(pill.textContent);
      });
    });

    root.querySelectorAll("[data-ai-popup-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var parts = String(btn.getAttribute("data-ai-popup-action") || "").split(":");
        var msg = popupMessages[Number(parts[0])];
        var action = msg && msg.actions ? msg.actions[Number(parts[1])] : null;
        runAction(action);
      });
    });
  }

  function refresh() {
    if (!rootRef) return;
    lastState = buildSignalState(dataRef || {});
    rootRef.classList.toggle("is-open", isOpen);
    rootRef.innerHTML = renderRoot(lastState);
    wire(rootRef);
    if (window.dashboardI18n) window.dashboardI18n.apply(rootRef);
    if (window.KhodUI) window.KhodUI.enhance(rootRef);
    if (isOpen) {
      setTimeout(function () {
        var feed = rootRef && rootRef.querySelector("#ai-copilot-feed");
        if (feed) feed.scrollTop = feed.scrollHeight;
      }, 0);
    }
  }

  function mountUi(shellEl, data, ctx) {
    dataRef = data || {};
    ctxRef = ctx || {};
    if (!shellEl) return;

    rootRef = document.getElementById("dashboard-ai-root");
    if (!rootRef || rootRef.parentNode !== shellEl) {
      if (rootRef && rootRef.parentNode) rootRef.parentNode.removeChild(rootRef);
      rootRef = document.createElement("div");
      rootRef.id = "dashboard-ai-root";
      shellEl.appendChild(rootRef);
    }
    refresh();
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && isOpen) closePanel();
  });

  window.mountDashboardAI = mountUi;
  window.askDashboardAI = askPopup;
  window.openDashboardAI = openPanel;
  window.runDashboardAiAction = runAction;
})();
