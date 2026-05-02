// ── WELCOME PAGE ──
window.renderWelcome = function (onContinue, onNewDate) {
  const el  = document.getElementById("page-welcome");
  const t   = window._t;

  const today        = new Date();
  const todayStr     = formatDate(today);
  const todayDisplay = today.toLocaleDateString(
    window._kbotLang === "ar" ? "ar-EG" : "en-GB",
    { day: "numeric", month: "long", year: "numeric", calendar: "gregory" }
  );

  const todayBtnFn = t("welcome.today_btn");
  const todayBtnLabel = typeof todayBtnFn === "function" ? todayBtnFn(todayDisplay) : todayBtnFn;

  el.innerHTML = `
    <div style="min-height:100%;display:flex;justify-content:center;padding:32px 24px 40px;overflow-y:auto;width:100%">
      <div style="width:520px;max-width:100%">

        <!-- Header -->
        <div style="text-align:center; margin-bottom:32px">
          <div style="font-size:48px;margin-bottom:12px">⚡</div>
          <div class="page-title" style="font-size:28px;text-align:center">${t("welcome.app_title")}</div>
          <div class="page-subtitle" style="text-align:center">${t("welcome.app_subtitle")}</div>
        </div>

        <!-- Main actions -->
        <div class="card" style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;margin-bottom:16px">${t("welcome.quick_start")}</div>

          <button class="btn btn-success full-width btn-lg" id="btn-today" style="margin-bottom:10px">
            ${todayBtnLabel}
          </button>

          <button class="btn btn-ghost full-width btn-lg" id="btn-pick-date">
            ${t("welcome.new_date_btn")}
          </button>
        </div>

        <!-- Launch minimized toggle -->
        <div class="card" style="margin-bottom:16px" id="launchmin-card">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-size:13px;font-weight:700;margin-bottom:3px">${t("welcome.launch_min")}</div>
              <div class="text-sm text-muted">${t("welcome.launch_min_desc")}</div>
            </div>
            <div style="margin-left:16px;flex-shrink:0">
              <button id="btn-toggle-launchmin" style="
                width:48px;height:26px;border-radius:13px;border:none;cursor:pointer;
                position:relative;transition:background 0.25s;background:var(--border);
              ">
                <span id="launchmin-knob" style="
                  position:absolute;top:3px;left:3px;
                  width:20px;height:20px;border-radius:50%;
                  background:#fff;transition:transform 0.25s;
                "></span>
              </button>
              <span id="launchmin-label" class="text-sm text-muted" style="margin-left:8px">${t("welcome.off")}</span>
            </div>
          </div>
        </div>

        <!-- Auto-run toggle -->
        <div class="card" style="margin-bottom:16px" id="autorun-card">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-size:13px;font-weight:700;margin-bottom:3px">${t("welcome.autorun")}</div>
              <div class="text-sm text-muted">${t("welcome.autorun_desc")}</div>
            </div>
            <div style="margin-left:16px;flex-shrink:0;display:flex;align-items:center;gap:8px">
              <button id="btn-toggle-autorun" style="
                width:48px;height:26px;border-radius:13px;border:none;cursor:pointer;
                position:relative;transition:background 0.25s;background:var(--border);
              ">
                <span id="autorun-knob" style="
                  position:absolute;top:3px;left:3px;
                  width:20px;height:20px;border-radius:50%;
                  background:#fff;transition:transform 0.25s;
                "></span>
              </button>
              <span id="autorun-label" class="text-sm text-muted">${t("welcome.off")}</span>
            </div>
          </div>
          <div id="autorun-interval-row" style="margin-top:14px;display:none">
            <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">${t("welcome.run_every")}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap" id="interval-options">
              ${[{label:"30 min",mins:30},{label:"1 hour",mins:60},{label:"2 hours",mins:120},{label:"4 hours",mins:240},{label:"6 hours",mins:360}].map(o =>
                `<button class="btn btn-ghost interval-opt" data-mins="${o.mins}" style="font-size:12px;padding:6px 14px">${o.label}</button>`
              ).join("")}
            </div>
          </div>
          <div id="autorun-next" class="text-sm text-muted" style="margin-top:8px;display:none"></div>
        </div>

        <!-- Date picker card -->
        <div class="card" id="date-picker-card" style="display:none; margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;margin-bottom:16px">${t("welcome.select_date")}</div>

          <div class="date-options">
            <div class="date-option selected" data-mode="today">
              <div class="opt-icon">📅</div>
              <div class="opt-label">${t("welcome.today")}</div>
              <div class="opt-desc">${todayDisplay}</div>
            </div>
            <div class="date-option" data-mode="single">
              <div class="opt-icon">🗓️</div>
              <div class="opt-label">${t("welcome.single_day")}</div>
              <div class="opt-desc">${t("welcome.pick_one")}</div>
            </div>
            <div class="date-option" data-mode="range">
              <div class="opt-icon">📆</div>
              <div class="opt-label">${t("welcome.date_range")}</div>
              <div class="opt-desc">${t("welcome.from_to")}</div>
            </div>
          </div>

          <div id="date-inputs-container" style="display:none"></div>

          <button class="btn btn-primary full-width mt-12" id="btn-launch" disabled>
            ${t("welcome.launch_btn")}
          </button>
        </div>

        <!-- Danger zone -->
        <div class="card">
          <div style="font-size:12px;font-weight:700;color:var(--danger);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">${t("welcome.reset_section")}</div>
          <div class="notice-box warn" style="margin-bottom:14px">
            <span class="notice-icon">🔐</span>
            <div class="notice-text">${t("welcome.reset_notice")}</div>
          </div>
          <button class="btn btn-danger full-width" id="btn-reset">${t("welcome.reset_btn")}</button>
        </div>

      </div>
    </div>
  `;

  // Inject fast calendar styles once
  injectCalendarStyles();

  let selectedMode = "today";
  let dateFrom = todayStr;
  let dateTo   = todayStr;

  document.getElementById("btn-today").addEventListener("click", () => {
    onContinue({ dateFrom: todayStr, dateTo: todayStr });
  });

  document.getElementById("btn-pick-date").addEventListener("click", () => {
    const card = document.getElementById("date-picker-card");
    card.style.display = card.style.display === "none" ? "block" : "none";
  });

  el.querySelectorAll(".date-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      el.querySelectorAll(".date-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      selectedMode = opt.dataset.mode;
      renderDateInputs(selectedMode);
    });
  });

  // ── Fast custom date picker renderer ──
  function renderDateInputs(mode) {
    const container = document.getElementById("date-inputs-container");
    const launchBtn = document.getElementById("btn-launch");

    if (mode === "today") {
      dateFrom = todayStr; dateTo = todayStr;
      container.style.display = "none";
      launchBtn.disabled = false;
      return;
    }

    container.style.display = "block";

    if (mode === "single") {
      container.innerHTML = `
        <div style="display:flex;justify-content:center">
          <div class="form-group" style="margin:0;width:220px">
            <label style="text-align:center;display:block">${t("welcome.today")}</label>
            <div id="cal-single" class="fast-cal"></div>
          </div>
        </div>
      `;
      dateFrom = todayStr; dateTo = todayStr;
      launchBtn.disabled = false;

      buildCalendar(
        document.getElementById("cal-single"),
        todayStr,
        todayStr,
        (val) => { dateFrom = val; dateTo = val; launchBtn.disabled = !dateFrom; }
      );
    } else {
      container.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group" style="margin:0">
            <label>${t("welcome.from")}</label>
            <div id="cal-from" class="fast-cal"></div>
          </div>
          <div class="form-group" style="margin:0">
            <label>${t("welcome.to")}</label>
            <div id="cal-to" class="fast-cal"></div>
          </div>
        </div>
      `;
      dateFrom = todayStr; dateTo = todayStr;
      launchBtn.disabled = false;

      buildCalendar(
        document.getElementById("cal-from"),
        todayStr,
        todayStr,
        (val) => { dateFrom = val; launchBtn.disabled = !dateFrom || !dateTo; }
      );
      buildCalendar(
        document.getElementById("cal-to"),
        todayStr,
        todayStr,
        (val) => { dateTo = val; launchBtn.disabled = !dateFrom || !dateTo; }
      );
    }
  }

  document.getElementById("btn-launch").addEventListener("click", () => {
    onContinue({ dateFrom, dateTo });
  });

  // ── Launch minimized toggle ──
  let launchMinEnabled = false;
  function updateLaunchMinUI() {
    const btn   = document.getElementById("btn-toggle-launchmin");
    const knob  = document.getElementById("launchmin-knob");
    const label = document.getElementById("launchmin-label");
    if (!btn) return;
    if (launchMinEnabled) {
      btn.style.background = "var(--accent)";
      knob.style.transform = "translateX(22px)";
      label.textContent = t("welcome.on"); label.style.color = "var(--accent)";
    } else {
      btn.style.background = "var(--border)";
      knob.style.transform = "translateX(0)";
      label.textContent = t("welcome.off"); label.style.color = "var(--text2)";
    }
  }
  document.getElementById("btn-toggle-launchmin").addEventListener("click", async () => {
    launchMinEnabled = !launchMinEnabled;
    await window.api.setLaunchMinimized(launchMinEnabled);
    updateLaunchMinUI();
  });

  // ── Auto-run toggle ──
  let autoRunEnabled = false;
  let autoRunIntervalMins = 30;
  let countdownInterval = null;

  function updateAutoRunUI(remainingMs) {
    const btn    = document.getElementById("btn-toggle-autorun");
    const knob   = document.getElementById("autorun-knob");
    const label  = document.getElementById("autorun-label");
    const next   = document.getElementById("autorun-next");
    const intRow = document.getElementById("autorun-interval-row");
    if (!btn) return;
    if (autoRunEnabled) {
      btn.style.background = "var(--warning)";
      knob.style.transform = "translateX(22px)";
      label.textContent = t("welcome.on"); label.style.color = "var(--warning)";
      next.style.display = "block";
      intRow.style.display = "block";
      startCountdown(remainingMs);
    } else {
      btn.style.background = "var(--border)";
      knob.style.transform = "translateX(0)";
      label.textContent = t("welcome.off"); label.style.color = "var(--text2)";
      next.style.display = "none";
      intRow.style.display = "none";
      stopCountdown();
    }
    document.querySelectorAll(".interval-opt").forEach(b => {
      const active = parseInt(b.dataset.mins) === autoRunIntervalMins;
      b.className = active ? "btn btn-primary interval-opt" : "btn btn-ghost interval-opt";
      b.style.cssText = "font-size:12px;padding:6px 14px";
    });
  }

  // Wall-clock time (ms) at which the countdown display was last synced from main
  let _countdownSyncedAt  = 0;
  let _countdownSyncedMs  = 0; // remainingMs at that sync point

  function startCountdown(remainingMs) {
    stopCountdown();
    _countdownSyncedAt = Date.now();
    _countdownSyncedMs = (remainingMs !== undefined)
      ? Math.max(0, remainingMs)
      : autoRunIntervalMins * 60 * 1000;

    const next = document.getElementById("autorun-next");

    // Re-sync from main process every 5 s to correct any drift
    let syncTick = 0;
    const tick = async () => {
      if (!next) return;
      syncTick++;
      if (syncTick % 5 === 0) {
        // Refresh from main process
        try {
          const prog = await window.api.getAutoRunProgress();
          if (prog) {
            _countdownSyncedAt = Date.now();
            _countdownSyncedMs = prog.remainingMs;
          }
        } catch {}
      }
      // Compute display value from synced anchor + elapsed wall clock
      const displayMs = Math.max(0, _countdownSyncedMs - (Date.now() - _countdownSyncedAt));
      const totalSecs = Math.ceil(displayMs / 1000);
      const m = Math.floor(totalSecs / 60);
      const s = totalSecs % 60;
      const fn = t("welcome.next_run");
      next.textContent = typeof fn === "function"
        ? fn(m, String(s).padStart(2, "0"))
        : `⏳ Next auto-run in ${m}:${String(s).padStart(2, "0")}`;
    };
    tick();
    countdownInterval = setInterval(tick, 1000);
  }
  function stopCountdown() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  }

  document.getElementById("btn-toggle-autorun").addEventListener("click", async () => {
    autoRunEnabled = !autoRunEnabled;
    await window.api.setAutoRun(autoRunEnabled);
    // When toggled ON, immediately sync from main process
    if (autoRunEnabled) {
      const prog = await window.api.getAutoRunProgress();
      updateAutoRunUI(prog ? prog.remainingMs : undefined);
    } else {
      updateAutoRunUI();
    }
  });

  document.querySelectorAll(".interval-opt").forEach(btn => {
    btn.addEventListener("click", async () => {
      autoRunIntervalMins = parseInt(btn.dataset.mins);
      await window.api.setAutoRunInterval(autoRunIntervalMins);
      // Interval changed → new full countdown starts in main process
      updateAutoRunUI(autoRunIntervalMins * 60 * 1000);
    });
  });

  window.api.removeAllListeners("auto-run-tick");
  window.api.onAutoRunTick(({ dateFrom, dateTo }) => {
    onContinue({ dateFrom, dateTo });
  });

  window.api.getCredentials().then(async (creds) => {
    launchMinEnabled = creds.launchMinimized || false;
    updateLaunchMinUI();
    autoRunEnabled = creds.autoRun || false;
    autoRunIntervalMins = creds.autoRunInterval || 30;
    // Sync countdown with real remaining time from main process
    const prog = autoRunEnabled ? await window.api.getAutoRunProgress() : null;
    updateAutoRunUI(prog ? prog.remainingMs : undefined);
  });

  document.getElementById("btn-reset").addEventListener("click", async () => {
    const confirmed = await showConfirm(
      t("welcome.reset_confirm_title"),
      t("welcome.reset_confirm_msg"),
      t("welcome.reset_confirm_ok"),
      t("welcome.reset_confirm_cancel")
    );
    if (confirmed) {
      await window.api.clearAllData();
      location.reload();
    }
  });
};

// ══════════════════════════════════════════════════════
// ── Fast Custom Calendar — no native picker, zero lag ──
// ══════════════════════════════════════════════════════

/**
 * buildCalendar(container, initialValue, maxDate, onChange)
 *
 * Renders a compact inline calendar entirely with divs.
 * Avoids all native <input type="date"> Electron lag.
 * onChange(dateString) called when a day is selected.
 */
function buildCalendar(container, initial, maxDate, onChange) {
  // Parse as local date (not UTC)
  const parseLocal = (str) => {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const maxD   = parseLocal(maxDate);
  let selected = parseLocal(initial);
  let viewYear  = selected.getFullYear();
  let viewMonth = selected.getMonth();

  const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];

  function render() {
    const selStr    = formatDate(selected);
    const maxStr    = formatDate(maxD);
    const todayStr2 = formatDate(new Date());

    const firstDay  = new Date(viewYear, viewMonth, 1);
    const lastDay   = new Date(viewYear, viewMonth + 1, 0);
    const startDow  = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const maxYear  = maxD.getFullYear();
    const maxMonth = maxD.getMonth();
    const canNext  = viewYear < maxYear || (viewYear === maxYear && viewMonth < maxMonth);
    const minYear  = new Date().getFullYear() - 5;
    const canPrev  = viewYear > minYear || (viewYear === minYear && viewMonth > 0);

    // Build cells via string concat — fastest approach
    let cells = "";
    for (let i = 0; i < startDow; i++) {
      cells += `<div class="fc-cell fc-empty"></div>`;
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const isSel  = dateStr === selStr;
      const isTdy  = dateStr === todayStr2;
      const isDis  = dateStr > maxStr;
      let cls = "fc-cell fc-day";
      if (isSel)      cls += " fc-selected";
      else if (isTdy) cls += " fc-today";
      if (isDis)      cls += " fc-disabled";
      cells += `<div class="${cls}" data-date="${dateStr}">${d}</div>`;
    }

    container.innerHTML = `
      <div class="fc-wrap">
        <div class="fc-header">
          <button class="fc-nav" data-dir="-1"${canPrev ? "" : " disabled"}>&#8249;</button>
          <span class="fc-month-label">${MONTHS[viewMonth]} ${viewYear}</span>
          <button class="fc-nav" data-dir="1"${canNext ? "" : " disabled"}>&#8250;</button>
        </div>
        <div class="fc-grid">
          ${DAYS.map(d => `<div class="fc-cell fc-weekday">${d}</div>`).join("")}
          ${cells}
        </div>
        <div class="fc-selected-display">${selStr}</div>
      </div>
    `;

    // Single delegated click on the grid — more efficient than per-cell listeners
    container.querySelector(".fc-grid").addEventListener("click", (e) => {
      const cell = e.target.closest(".fc-day");
      if (!cell || cell.classList.contains("fc-disabled")) return;
      selected = parseLocal(cell.dataset.date);
      render();
      onChange(cell.dataset.date);
    });

    container.querySelectorAll(".fc-nav").forEach(btn => {
      btn.addEventListener("click", () => {
        viewMonth += parseInt(btn.dataset.dir);
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        if (viewMonth < 0)  { viewMonth = 11; viewYear--; }
        render();
      });
    });
  }

  render();
}

// Inject calendar CSS exactly once
function injectCalendarStyles() {
  if (document.getElementById("fast-cal-styles")) return;
  const s = document.createElement("style");
  s.id = "fast-cal-styles";
  s.textContent = `
    .fast-cal { width:100%; }
    .fc-wrap {
      background:var(--bg3);
      border:1px solid var(--border);
      border-radius:var(--radius-sm);
      padding:10px;
      user-select:none;
    }
    .fc-header {
      display:flex;
      align-items:center;
      justify-content:space-between;
      margin-bottom:8px;
    }
    .fc-month-label { font-size:13px;font-weight:700;color:var(--text); }
    .fc-nav {
      background:none;
      border:1px solid var(--border);
      border-radius:6px;
      color:var(--text2);
      cursor:pointer;
      font-size:18px;
      line-height:1;
      padding:2px 8px;
      transition:background 0.1s,color 0.1s;
    }
    .fc-nav:hover:not(:disabled) { background:var(--accent);color:#fff;border-color:var(--accent); }
    .fc-nav:disabled { opacity:0.3;cursor:default; }
    .fc-grid { display:grid;grid-template-columns:repeat(7,1fr);gap:2px; }
    .fc-cell {
      aspect-ratio:1;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:11px;
      border-radius:4px;
      min-width:0;
    }
    .fc-weekday { font-size:9px;font-weight:700;color:var(--text2);text-transform:uppercase; }
    .fc-day { cursor:pointer;color:var(--text);transition:background 0.07s; }
    .fc-day:hover:not(.fc-disabled) { background:rgba(79,142,247,0.18);color:var(--accent); }
    .fc-today { background:rgba(79,142,247,0.1);color:var(--accent);font-weight:700; }
    .fc-selected { background:var(--accent)!important;color:#fff!important;font-weight:700; }
    .fc-disabled { opacity:0.25;cursor:default; }
    .fc-empty { visibility:hidden; }
    .fc-selected-display {
      margin-top:8px;
      text-align:center;
      font-size:11px;
      color:var(--text2);
      font-variant-numeric:tabular-nums;
      letter-spacing:0.04em;
    }
  `;
  document.head.appendChild(s);
}

// ── Helpers ──
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function showConfirm(title, message, confirmText, cancelText) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.7);
      display:flex;align-items:center;justify-content:center;z-index:9999;
    `;
    overlay.innerHTML = `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:28px;width:380px;text-align:center">
        <div style="font-size:20px;font-weight:700;margin-bottom:8px">${title}</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:24px;line-height:1.5">${message}</div>
        <div style="display:flex;gap:10px;justify-content:center">
          <button id="dlg-cancel" class="btn btn-ghost">${cancelText}</button>
          <button id="dlg-confirm" class="btn btn-danger">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById("dlg-confirm").addEventListener("click", () => { overlay.remove(); resolve(true); });
    document.getElementById("dlg-cancel").addEventListener("click",  () => { overlay.remove(); resolve(false); });
  });
}
