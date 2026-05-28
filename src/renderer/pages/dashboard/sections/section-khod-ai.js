(function () {
  "use strict";

  var lastState = null;
  var selectedDetail = null;
  var activeStream = null;
  var chatMessages = [];
  var injectedAi = { insights: [], recommendations: [], forecasts: [], alerts: [] };
  var _mountEl = null;

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

  function tr(key, params, fallback) {
    var value = window.dashboardI18n ? window.dashboardI18n.t(key, params || null) : key;
    return value && value !== key ? value : (fallback || key);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function icon(name) {
    if (window.icon) return window.icon(name, { size: 16, color: "currentColor" });
    return "";
  }

  function num(value) {
    if (window.dashboardI18n) return window.dashboardI18n.number(Number(value || 0), { maximumFractionDigits: 0 });
    return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function currentData() {
    try {
      var state = window.KhodAiIntelligenceData && window.KhodAiIntelligenceData.build
        ? window.KhodAiIntelligenceData.build({ data: window.dashboardGeoData || {} })
        : { insights: [], recommendations: [], forecasts: [], alerts: [], health: { score: 0, label: "" }, opportunityScore: 0, state: "empty" };
      state.insights = injectedAi.insights.concat(state.insights || []);
      state.recommendations = injectedAi.recommendations.concat(state.recommendations || []);
      state.forecasts = injectedAi.forecasts.concat(state.forecasts || []);
      state.alerts = injectedAi.alerts.concat(state.alerts || []);
      return state;
    } catch (err) {
      return { insights: [], recommendations: [], forecasts: [], alerts: [], health: { score: 0, label: "" }, opportunityScore: 0, state: "error", error: err };
    }
  }

  function runAction(action) {
    if (!action) return;
    if (window.runDashboardAiAction && action.type) {
      window.runDashboardAiAction(action);
      return;
    }
  }

  function actionButtons(actions, msgIdx) {
    actions = Array.isArray(actions) ? actions : [];
    if (!actions.length) return "";
    return '<div class="aii-chat-actions">' + actions.slice(0, 4).map(function (action, actionIdx) {
      return '<button type="button" class="aii-action-btn" data-aii-chat-action="' + msgIdx + ':' + actionIdx + '">' +
        esc(action.label || action.type || tr("aii.action.review", null, "Review")) +
      '</button>';
    }).join("") + '</div>';
  }

  function defaultChatMessages() {
    return [{
      sender: "assistant",
      state: "complete",
      text: tr("aii.chatWelcome", null, "I am Khod Whaat AI. How can I assist you with your operations, forecasting, or strategic planning today?"),
    }];
  }

  function chatMessageHtml(msg, msgIdx) {
    var avatar = msg.sender === "user" ? '<div class="aii-avatar user-avatar">' + icon('user') + '</div>' : '<div class="aii-avatar ai-avatar">' + icon('diamond') + '</div>';
    var name = msg.sender === "user" ? tr("aii.you", null, "You") : tr("aii.assistant", null, "Khod Whaat AI");
    return '<div class="aii-chat-msg ' + esc(msg.sender) + ' ' + esc(msg.state || "complete") + '">' +
      avatar +
      '<div class="aii-chat-msg-body">' +
        '<span>' + esc(name) + '</span>' +
        '<p>' + esc(msg.text) + '</p>' +
        actionButtons(msg.actions, msgIdx) +
      '</div>' +
    '</div>';
  }

  function chatLogHtml(messages) {
    return (messages && messages.length ? messages : defaultChatMessages()).map(chatMessageHtml).join("");
  }

  function severityLabel(value) {
    var map = {
      critical: tr("aii.severity.critical", null, "Critical Risk"),
      warning: tr("aii.severity.warning", null, "Warning"),
      watch: tr("aii.severity.watch", null, "Watch"),
      positive: tr("aii.severity.positive", null, "Opportunity"),
      info: tr("aii.severity.info", null, "Info"),
      high: tr("aii.risk.high", null, "High Risk"),
      medium: tr("aii.risk.medium", null, "Medium Risk"),
      low: tr("aii.risk.low", null, "Low Risk"),
      limited: tr("aii.confidence.limited", null, "Limited"),
    };
    return map[value] || value || map.info;
  }

  function confidenceLabel(value) {
    var map = {
      high: tr("aii.confidence.high", null, "High confidence"),
      medium: tr("aii.confidence.medium", null, "Medium confidence"),
      low: tr("aii.confidence.low", null, "Low confidence"),
      limited: tr("aii.confidence.limited", null, "Limited data"),
    };
    return map[value] || map.limited;
  }

  function stateBlock(kind, title, body) {
    return '<div class="aii-state aii-state-' + esc(kind || "info") + '">' +
      '<div class="aii-state-icon">' + icon(kind === "error" ? "info" : "activity") + '</div>' +
      '<strong>' + esc(title) + '</strong>' +
      '<span>' + esc(body) + '</span>' +
    '</div>';
  }

  function renderAlerts(state) {
    if (!state.alerts.length) return "";
    return '<section class="aii-alert-strip" aria-label="' + esc(tr("aii.importantAlerts", null, "Important alerts")) + '">' +
      state.alerts.slice(0, 3).map(function (item, idx) {
        var cls = (item.urgency === 'critical' || item.urgency === 'high') ? 'aii-glow-red' : 'aii-glow-amber';
        return '<button type="button" class="aii-alert-chip ' + cls + '" data-aii-detail="alerts:' + idx + '">' +
          '<div class="aii-alert-chip-content">' +
            '<span>' + esc(severityLabel(item.urgency || item.severity || "warning")) + '</span>' +
            '<strong>' + esc(item.title) + '</strong>' +
            '<em>' + esc(item.reason || item.summary || "") + '</em>' +
          '</div>' +
          '<div class="aii-alert-chip-action">' + icon('chevron-right') + '</div>' +
        '</button>';
      }).join("") +
    '</section>';
  }

  function renderChat() {
    var suggestions = [
      tr("ai.suggestion.risk", null, "Analyze current risks"),
      tr("ai.suggestion.scale", null, "How can I scale faster?"),
      tr("ai.suggestion.cityProfit", null, "Breakdown profit by city"),
    ];
    return '<section class="aii-panel aii-chat-panel">' +
      '<div class="aii-panel-head"><div><span>' + esc(tr("aii.chatKicker", null, "Business Assistant")) + '</span><h2>' + esc(tr("aii.chatTitle", null, "Command Center")) + '</h2></div></div>' +
      '<div id="aii-chat-log" class="aii-chat-log">' +
        chatLogHtml(chatMessages) +
      '</div>' +
      '<div class="aii-suggestions">' + suggestions.map(function (item) {
        return '<button type="button" class="aii-chip" data-aii-prompt="' + esc(item) + '">' + esc(item) + '</button>';
      }).join("") + '</div>' +
      '<form id="aii-chat-form" class="aii-chat-form">' +
        '<input id="aii-chat-input" type="text" autocomplete="off" placeholder="' + esc(tr("aii.chatPlaceholder", null, "Ask Khod Whaat AI to analyze your data...")) + '" aria-label="' + esc(tr("aii.chatPlaceholder", null, "Ask AI...")) + '">' +
        '<button type="submit"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button>' +
      '</form>' +
      '<div class="aii-ai-disclaimer" style="font-size:11px;color:var(--text-muted,#888);margin-top:12px;text-align:center;line-height:1.4;">' +
        esc(tr("aii.disclaimer.metrics", null, "Controlled business copilot: local-first metrics with guarded AI reasoning.")) + '<br>' +
        esc(tr("aii.disclaimer.scope", null, "AI is used only for strategy, explanations, recommendations, and forecasting.")) +
      '</div>' +
    '</section>';
  }

  function getSemanticClass(item) {
    var severity = (item.severity || item.riskLevel || "").toLowerCase();
    var category = (item.category || "").toLowerCase();
    if (severity === "critical" || severity === "high") return "aii-glow-red";
    if (severity === "warning" || severity === "medium" || severity === "watch") return "aii-glow-amber";
    if (severity === "positive" || category === "opportunity") return "aii-glow-green";
    return "aii-glow-blue";
  }

  function renderFeedCard(item, type, idx) {
    var cls = getSemanticClass(item);
    var label = item.horizonLabel || severityLabel(item.severity || item.riskLevel);
    var valueStr = item.valueLabel || item.expectedBenefit || item.summary || "";
    
    return '<button type="button" class="aii-feed-card ' + cls + '" data-aii-detail="' + type + ':' + idx + '">' +
      '<div class="aii-feed-card-header">' +
        '<span class="aii-badge">' + esc(label) + '</span>' +
        '<small>' + esc(confidenceLabel(item.confidence)) + '</small>' +
      '</div>' +
      '<strong>' + esc(item.title) + '</strong>' +
      '<em>' + esc(valueStr) + '</em>' +
    '</button>';
  }

  function renderIntelligenceStreams(state) {
    var groups = {
      risks: { id: 'risks', label: tr("aii.stream.risks", null, "Risks"), items: [], color: 'red' },
      opportunities: { id: 'opportunities', label: tr("aii.stream.opportunities", null, "Opportunities"), items: [], color: 'green' },
      forecasts: { id: 'forecasts', label: tr("aii.stream.forecasts", null, "Forecasts"), items: [], color: 'blue' },
      operations: { id: 'operations', label: tr("aii.stream.operations", null, "Operations"), items: [], color: 'amber' }
    };

    state.alerts.forEach(function(item, idx) {
      if(item.urgency === 'critical' || item.urgency === 'high') groups.risks.items.push({item: item, type: 'alerts', idx: idx});
      else groups.operations.items.push({item: item, type: 'alerts', idx: idx});
    });
    
    state.insights.forEach(function(item, idx) {
      var sev = (item.severity || "").toLowerCase();
      var cat = (item.category || "").toLowerCase();
      if (sev === 'critical' || sev === 'high' || cat === 'risk') {
        groups.risks.items.push({item: item, type: 'insights', idx: idx});
      } else if (sev === 'positive' || cat === 'opportunity' || cat === 'growth') {
        groups.opportunities.items.push({item: item, type: 'insights', idx: idx});
      } else {
        groups.operations.items.push({item: item, type: 'insights', idx: idx});
      }
    });

    state.recommendations.forEach(function(item, idx) {
      var sev = (item.riskLevel || "").toLowerCase();
      if (sev === 'critical' || sev === 'high') {
        groups.risks.items.push({item: item, type: 'recommendations', idx: idx});
      } else {
        groups.opportunities.items.push({item: item, type: 'recommendations', idx: idx});
      }
    });

    state.forecasts.forEach(function(item, idx) {
      groups.forecasts.items.push({item: item, type: 'forecasts', idx: idx});
    });

    if (!activeStream) {
      if (groups.risks.items.length) activeStream = 'risks';
      else if (groups.opportunities.items.length) activeStream = 'opportunities';
      else if (groups.forecasts.items.length) activeStream = 'forecasts';
      else activeStream = 'operations';
    }

    var navHtml = '<div class="aii-stream-nav">';
    ['risks', 'opportunities', 'forecasts', 'operations'].forEach(function(key) {
      var g = groups[key];
      var isActive = activeStream === key ? ' active ' + g.color : '';
      var isEmpty = g.items.length === 0 ? ' empty ' : '';
      navHtml += '<button type="button" class="aii-stream-tab' + isActive + isEmpty + '" data-aii-stream="' + key + '">' + 
        '<span>' + esc(g.label) + '</span>' + 
        '<strong>' + g.items.length + '</strong>' + 
        '</button>';
    });
    navHtml += '</div>';

    var activeGroup = groups[activeStream] || groups.risks;
    var contentHtml = '<div class="aii-stream-content animate-in">';
    if (activeGroup.items.length) {
      contentHtml += activeGroup.items.map(function(obj) { return renderFeedCard(obj.item, obj.type, obj.idx); }).join("");
    } else {
      contentHtml += stateBlock("empty", tr("aii.emptyStreamTitle", null, "No Data"), tr("aii.emptyStreamBody", null, "No intelligence available in this stream yet."));
    }
    contentHtml += '</div>';

    return '<section class="aii-panel aii-streams-panel">' +
      '<div class="aii-panel-head" style="margin-bottom:12px;"><div><span>' + esc(tr("aii.streamsKicker", null, "Live Feed")) + '</span><h2>' + esc(tr("aii.streamsTitle", null, "Intelligence Streams")) + '</h2></div></div>' +
      navHtml +
      '<div class="aii-streams-viewport">' + contentHtml + '</div>' +
    '</section>';
  }

  function renderDetail(state) {
    if (!selectedDetail) return "";
    var parts = selectedDetail.split(":");
    var list = state[parts[0]] || [];
    var item = list[Number(parts[1])];
    if (!item) return "";

    var ex = item.explanation || {};
    var cls = getSemanticClass(item);

    return '<section class="aii-panel aii-detail-panel ' + cls + '">' +
      '<div class="aii-panel-head">' +
        '<h2>' + esc(tr("aii.explainabilityTitle", null, "AI Analysis Details")) + '</h2>' +
        '<button type="button" class="aii-close-btn" data-aii-close="1"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>' +
      '</div>' +
      '<div class="aii-detail-content animate-in">' +
        '<div class="aii-detail-top">' +
          '<span class="aii-badge">' + esc(confidenceLabel(ex.confidence || item.confidence)) + '</span>' +
          '<h3>' + esc(item.title) + '</h3>' +
          '<p>' + esc(item.summary || item.expectedBenefit || item.valueLabel || item.reason || "") + '</p>' +
        '</div>' +
        '<div class="aii-explain-block"><span>' + esc(tr("aii.why", null, "Reasoning")) + '</span><p>' + esc(ex.why || tr("aii.explain.missing", null, "Calculated based on current dashboard parameters.")) + '</p></div>' +
        ((ex.signals || item.evidence || []).length ? '<div class="aii-explain-block"><span>' + esc(tr("aii.evidence", null, "Supporting Evidence")) + '</span><ul>' + (ex.signals || item.evidence || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join("") + '</ul></div>' : "") +
        ((ex.limitations || []).length ? '<div class="aii-explain-block"><span>' + esc(tr("aii.limitations", null, "Limitations")) + '</span><ul>' + ex.limitations.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join("") + '</ul></div>' : "") +
        (ex.nextStep || item.recommendedFollowUp ? '<div class="aii-explain-block"><span>' + esc(tr("aii.nextStep", null, "Recommended Action")) + '</span><p>' + esc(ex.nextStep || item.recommendedFollowUp || "") + '</p></div>' : "") +
        (item.nextAction || item.action ? '<button type="button" class="aii-primary-action" data-aii-run-action="1">' + esc((item.nextAction || item.action).label || item.primaryActionLabel || tr("aii.action.review", null, "Execute Action")) + '</button>' : "") +
      '</div>' +
    '</section>';
  }

  function captureScrollState() {
    var state = [];
    state.push({ win: true, top: window.pageYOffset || 0, left: window.pageXOffset || 0 });
    [
      document.scrollingElement,
      document.documentElement,
      document.body,
      document.getElementById("page-dashboard"),
      document.querySelector(".dashboard-main"),
      document.querySelector(".dashboard-content"),
      document.querySelector(".dash-main"),
      document.querySelector(".dashboard-workspace"),
      document.querySelector(".dashboard-section"),
      document.querySelector(".dash-page")
    ].forEach(function (el) {
      if (el && state.indexOf(el) === -1) state.push(el);
    });
    var parent = _mountEl;
    while (parent) {
      if (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth) {
        if (state.indexOf(parent) === -1) state.push(parent);
      }
      parent = parent.parentElement;
    }
    return state.map(function (el) {
      if (el && el.win) return el;
      return { el: el, top: el.scrollTop || 0, left: el.scrollLeft || 0 };
    });
  }

  function restoreScrollState(snapshot) {
    (snapshot || []).forEach(function (item) {
      if (item && item.win) {
        try { window.scrollTo(item.left, item.top); } catch (_) {}
        return;
      }
      if (!item || !item.el) return;
      try {
        item.el.scrollTop = item.top;
        item.el.scrollLeft = item.left;
      } catch (_) {}
    });
  }

  function scheduleScrollRestore(snapshot) {
    restoreScrollState(snapshot);
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(function () { restoreScrollState(snapshot); });
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { restoreScrollState(snapshot); });
      });
    }
    setTimeout(function () { restoreScrollState(snapshot); }, 0);
    setTimeout(function () { restoreScrollState(snapshot); }, 60);
    setTimeout(function () { restoreScrollState(snapshot); }, 180);
  }

  function renderPage() {
    if (!_mountEl) return;
    var scrollSnapshot = captureScrollState();
    lastState = currentData();
    var isRtl = window.dashboardI18n && window.dashboardI18n.isRtl();
    
    var healthScore = lastState.health.score || 0;
    var healthClass = healthScore >= 80 ? "aii-text-green" : (healthScore >= 50 ? "aii-text-amber" : "aii-text-red");
    var alertCount = lastState.alerts.length;
    var oppCount = lastState.insights.filter(function(i){ return i.category === 'opportunity' || i.severity === 'positive'; }).length;

    _mountEl.innerHTML =
      '<div class="khod-ai-section" dir="' + (isRtl ? "rtl" : "ltr") + '">' +
        '<div class="aii-hero-header">' +
          '<div class="aii-hero-title">' +
            '<div class="aii-hero-icon">' + icon('diamond') + '</div>' +
            '<div>' +
              '<h1>' + esc(tr("nav.khodAi", null, "Khod Whaat AI Copilot")) + '</h1>' +
              '<p>' + esc(tr("aii.systemStatus", null, "System connected. Ready to analyze.")) + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="aii-system-metrics">' +
            '<div class="aii-metric">' +
              '<span>' + esc(tr("aii.metric.health", null, "Health")) + '</span>' +
              '<strong class="' + healthClass + '">' + esc(num(healthScore)) + '%</strong>' +
            '</div>' +
            '<div class="aii-metric">' +
              '<span>' + esc(tr("aii.metric.alerts", null, "Alerts")) + '</span>' +
              '<strong class="' + (alertCount > 0 ? "aii-text-red" : "aii-text-blue") + '">' + esc(num(alertCount)) + '</strong>' +
            '</div>' +
            '<div class="aii-metric">' +
              '<span>' + esc(tr("aii.metric.opportunities", null, "Opportunities")) + '</span>' +
              '<strong class="' + (oppCount > 0 ? "aii-text-green" : "aii-text-blue") + '">' + esc(num(oppCount)) + '</strong>' +
            '</div>' +
          '</div>' +
        '</div>' +
        renderAlerts(lastState) +
        '<div class="aii-layout-split">' +
          '<div class="aii-main-col">' +
            renderChat() +
          '</div>' +
          '<aside class="aii-side-col">' +
            (selectedDetail ? renderDetail(lastState) : renderIntelligenceStreams(lastState)) +
          '</aside>' +
        '</div>' +
      '</div>';

    wireEvents(_mountEl);
    if (window.dashboardI18n) window.dashboardI18n.apply(_mountEl);
    if (window.KhodUI) window.KhodUI.enhance(_mountEl);
    
    var log = _mountEl.querySelector('#aii-chat-log');
    if (log) log.scrollTop = log.scrollHeight;
    scheduleScrollRestore(scrollSnapshot);
  }

  window.renderSectionKhodAi = function (mountEl, data, ctx) {
    _mountEl = mountEl;
    renderPage();
  };

  function wireChatActionEvents(root) {
    root.querySelectorAll("[data-aii-chat-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var parts = String(btn.getAttribute("data-aii-chat-action") || "").split(":");
        var msg = chatMessages[Number(parts[0])];
        var action = msg && msg.actions ? msg.actions[Number(parts[1])] : null;
        runAction(action);
      });
    });
  }

  function updateChatOnly() {
    if (!_mountEl) return;
    var log = _mountEl.querySelector("#aii-chat-log");
    if (!log) {
      renderPage();
      return;
    }
    var snapshot = captureScrollState();
    var input = _mountEl.querySelector("#aii-chat-input");
    var hadFocus = document.activeElement === input;
    log.innerHTML = chatLogHtml(chatMessages);
    wireChatActionEvents(_mountEl);
    log.scrollTop = log.scrollHeight;
    if (hadFocus && input) {
      try { input.focus({ preventScroll: true }); } catch (_) { try { input.focus(); } catch (_) {} }
    }
    scheduleScrollRestore(snapshot);
  }

  function wireEvents(root) {
    var streamNav = root.querySelector('.aii-stream-nav');
    if (streamNav) {
      var isDown = false, dragged = false, startX, scrollLeft;
      streamNav.addEventListener('mousedown', function(e) {
        isDown = true; dragged = false;
        startX = e.pageX - streamNav.offsetLeft;
        scrollLeft = streamNav.scrollLeft;
      });
      streamNav.addEventListener('mouseleave', function() {
        isDown = false; streamNav.classList.remove('is-dragging');
      });
      streamNav.addEventListener('mouseup', function(e) {
        isDown = false; streamNav.classList.remove('is-dragging');
        if (dragged) {
          var target = e.target.closest('.aii-stream-tab');
          if (target) { target.setAttribute('data-dragged', '1'); setTimeout(function(){ target.removeAttribute('data-dragged'); }, 50); }
        }
      });
      streamNav.addEventListener('mousemove', function(e) {
        if (!isDown) return;
        e.preventDefault();
        var x = e.pageX - streamNav.offsetLeft;
        var walk = (x - startX) * 2;
        if (Math.abs(walk) > 5) {
            dragged = true;
            streamNav.classList.add('is-dragging');
        }
        streamNav.scrollLeft = scrollLeft - walk;
      });
    }

    root.querySelectorAll("[data-aii-stream]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        if (btn.hasAttribute('data-dragged')) return;
        activeStream = btn.getAttribute("data-aii-stream");
        selectedDetail = null;
        renderPage();
      });
    });
    root.querySelectorAll("[data-aii-detail]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectedDetail = btn.getAttribute("data-aii-detail");
        renderPage();
      });
    });
    var btnClose = root.querySelector("[data-aii-close]");
    if (btnClose) {
      btnClose.addEventListener("click", function () {
        selectedDetail = null;
        renderPage();
      });
    }
    root.querySelectorAll("[data-aii-prompt]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        ask(btn.getAttribute("data-aii-prompt"));
      });
    });
    wireChatActionEvents(root);
    var btnAction = root.querySelector("[data-aii-run-action]");
    if (btnAction) {
      btnAction.addEventListener("click", function () {
        if (!lastState) return;
        var parts = (selectedDetail || "insights:0").split(":");
        var item = (lastState[parts[0]] || [])[Number(parts[1])] || lastState.insights[0];
        runAction(item && (item.nextAction || item.action));
      });
    }
    var form = root.querySelector("#aii-chat-form");
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var input = root.querySelector("#aii-chat-input");
        ask(input && input.value);
        if (input) input.value = "";
        return false;
      });
    }
  }

  function refreshMarketingSpendForAi() {
    var accountId = window.dashboardGeoData && window.dashboardGeoData.meta && window.dashboardGeoData.meta.activeAccountId;
    if (!accountId || !window.DashboardMarketingState || typeof window.DashboardMarketingState.get !== "function" || typeof window.DashboardMarketingState.load !== "function") {
      return Promise.resolve();
    }
    var current = window.DashboardMarketingState.get(accountId);
    if (current && current.summary && current.status === "connected") return Promise.resolve(current);
    return window.DashboardMarketingState.load(accountId).catch(function () { return null; });
  }

  async function ask(prompt) {
    var text = String(prompt || "").trim();
    if (!text) return;

    // [KHOD AI DEBUG] ──────────────────────────────────────────────
    console.log("[KhodAI-Debug] ask() called with:", text.slice(0, 80));
    console.log("[KhodAI-Debug] window.api present:", !!window.api);
    console.log("[KhodAI-Debug] dashboardAiQuery type:", typeof (window.api && window.api.dashboardAiQuery));
    console.log("[KhodAI-Debug] window.dashboardGeoData present:", !!window.dashboardGeoData);
    // ─────────────────────────────────────────────────────────────

    chatMessages.push({ sender: "user", state: "complete", text: text });
    chatMessages.push({ sender: "assistant", state: "pending", text: tr("ai.thinking", null, "Analyzing dashboard intelligence...") });
    updateChatOnly();

    var context = {};
    var parsedIntent = null;
    var analyticsResult = null;
    var localStrategic = null;
    await refreshMarketingSpendForAi();
    if (window.KhodAiBusinessOrchestrator && window.KhodAiBusinessOrchestrator.orchestrate) {
      var orchestration = window.KhodAiBusinessOrchestrator.orchestrate(text, window.dashboardGeoData || {});
      if (orchestration.mode === "followup" || orchestration.mode === "local") {
        console.log("[KhodAI-Debug] Intent:", orchestration.parsedIntent && orchestration.parsedIntent.intent, "| Response source:", orchestration.mode === "local" ? "LOCAL_ONLY" : "LOCAL_DEPENDENCY_FOLLOWUP", "| No Gemini call");
        chatMessages.pop();
        chatMessages.push({ sender: "assistant", state: orchestration.mode === "followup" ? "pending-input" : "complete", text: orchestration.message, actions: orchestration.actions || [] });
        updateChatOnly();
        return;
      }
      parsedIntent = orchestration.parsedIntent;
      analyticsResult = orchestration.analyticsResult;
      context = orchestration.context || {};
      localStrategic = orchestration.localStrategic || null;
      console.log("[KhodAI-Debug] Business Orchestrator executed. Intent:", parsedIntent && parsedIntent.intent, "| Source: LOCAL_STRATEGY_BASE -> Gemini enhancement attempt");
    } else if (window.KhodAiIntentDetector && window.KhodAiAnalyticsEngine && window.KhodAiContextCompressor && window.KhodAiSessionMemory) {
      parsedIntent = window.KhodAiIntentDetector.parse(text, window.dashboardGeoData, window.KhodAiSessionMemory.get());
      window.KhodAiSessionMemory.update(parsedIntent);
      analyticsResult = window.KhodAiAnalyticsEngine.processIntent(parsedIntent, window.dashboardGeoData || {});
      context = window.KhodAiContextCompressor.compress(parsedIntent, analyticsResult);
      console.log("[KhodAI-Debug] Local Engine Pipeline executed. Intent:", parsedIntent.intent);
    } else {
      context = window.getDashboardAiContext ? window.getDashboardAiContext({ data: window.dashboardGeoData || {} }) : (window.buildDashboardAiContext ? window.buildDashboardAiContext({ data: window.dashboardGeoData || {} }) : {});
    }

    if (parsedIntent && (parsedIntent.blockedReason || parsedIntent.localOnly || parsedIntent.aiAllowed === false)) {
      var localText = window.KhodAiAnalyticsEngine && window.KhodAiAnalyticsEngine.localResponse
        ? window.KhodAiAnalyticsEngine.localResponse(parsedIntent, analyticsResult || {})
        : tr("ai.localFallback", null, "Use local dashboard insights for now.");
      chatMessages.pop();
      chatMessages.push({ sender: "assistant", state: parsedIntent.blockedReason ? "error" : "complete", text: localText });
      updateChatOnly();
      return;
    }

    // [KHOD AI DEBUG]
    try {
      var _ctxStr = JSON.stringify(context);
      console.log("[KhodAI-Debug] Context built. Size:", (_ctxStr.length / 1024).toFixed(1), "KB");
      if (_ctxStr.length > 150000) {
        console.warn("[KhodAI-Debug] ⚠️  Context is VERY LARGE:", (_ctxStr.length / 1024).toFixed(1), "KB — will likely fail Gemini token limit!");
      }
    } catch (_) {}

    if (!window.api || typeof window.api.dashboardAiQuery !== "function") {
      // [KHOD AI DEBUG]
      console.error("[KhodAI-Debug] ❌ window.api.dashboardAiQuery is NOT available — AI offline branch triggered");
      chatMessages.pop();
      chatMessages.push({ sender: "assistant", state: "error", text: tr("ai.unavailableMessage", null, "AI systems offline. Using cached intelligence models.") });
      updateChatOnly();
      return;
    }
    try {
      // [KHOD AI DEBUG]
      console.log("[KhodAI-Debug] Calling window.api.dashboardAiQuery ...");
      var response = await window.api.dashboardAiQuery({
        command: text,
        context: context,
        forceGemini: true,
        sessionId: getAiSessionId(),
        history: chatMessages.slice(-8).map(function (msg) {
          return { role: msg.sender === "user" ? "user" : "assistant", text: msg.text || "" };
        })
      });
      // [KHOD AI DEBUG]
      console.log("[KhodAI-Debug] Raw IPC response:", JSON.stringify(response).slice(0, 400));
      var normalized = window.KhodAiIntelligenceData ? window.KhodAiIntelligenceData.normalizeAiResponse(response) : { message: "" };
      chatMessages.pop();
      var meta = response && response.meta ? response.meta : {};
      var shouldUseLocal = localStrategic && (meta.blocked || meta.error || (meta.source === "fallback" && response.message === "AI service is not available. I am showing local dashboard guidance instead."));
      console.log("[KhodAI-Debug] Response source:", shouldUseLocal ? "LOCAL_STRATEGIC_FALLBACK" : "GEMINI_ENHANCED", "| meta:", meta);
      var answerText = shouldUseLocal ? localStrategic.message : (normalized.message || (localStrategic && localStrategic.message) || tr("ai.contextReady", null, "Analysis complete."));
      var answerActions = shouldUseLocal ? (localStrategic.actions || []) : ((normalized.actions && normalized.actions.length ? normalized.actions : (localStrategic && localStrategic.actions)) || []);
      chatMessages.push({ sender: "assistant", state: "complete", text: answerText, actions: answerActions });
      if (shouldUseLocal && localStrategic) {
        normalized = {
          message: localStrategic.message,
          insights: localStrategic.insights || [],
          recommendations: localStrategic.recommendations || [],
          forecasts: localStrategic.forecasts || [],
          alerts: localStrategic.alerts || []
        };
      }
      if (normalized.insights && normalized.insights.length) injectedAi.insights = normalized.insights.concat(injectedAi.insights).slice(0, 8);
      if (normalized.recommendations && normalized.recommendations.length) injectedAi.recommendations = normalized.recommendations.concat(injectedAi.recommendations).slice(0, 8);
      if (normalized.forecasts && normalized.forecasts.length) injectedAi.forecasts = normalized.forecasts.concat(injectedAi.forecasts).slice(0, 6);
      if (normalized.alerts && normalized.alerts.length) injectedAi.alerts = normalized.alerts.concat(injectedAi.alerts).slice(0, 6);
    } catch (err) {
      // [KHOD AI DEBUG]
      console.error("[KhodAI-Debug] ❌ dashboardAiQuery threw:", err && err.message ? err.message : String(err));
      chatMessages.pop();
      if (localStrategic) {
        chatMessages.push({ sender: "assistant", state: "complete", text: localStrategic.message, actions: localStrategic.actions || [] });
        if (localStrategic.insights && localStrategic.insights.length) injectedAi.insights = localStrategic.insights.concat(injectedAi.insights).slice(0, 8);
        if (localStrategic.recommendations && localStrategic.recommendations.length) injectedAi.recommendations = localStrategic.recommendations.concat(injectedAi.recommendations).slice(0, 8);
        if (localStrategic.alerts && localStrategic.alerts.length) injectedAi.alerts = localStrategic.alerts.concat(injectedAi.alerts).slice(0, 6);
      } else {
        chatMessages.push({ sender: "assistant", state: "error", text: tr("ai.requestFailed", null, "AI request failed.") + " " + (err && err.message ? err.message : "") });
      }
    }
    updateChatOnly();
  }

})();
