// ── WELCOME PAGE ──
window.renderWelcome = function (onContinue, onNewDate) {
  const el = document.getElementById("page-welcome");

  // Today's date formatted
  const today = new Date();
  const todayStr = formatDate(today);
  const todayDisplay = today.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  el.innerHTML = `
    <div class="center-layout">
      <div style="width:520px">

        <!-- Header -->
        <div style="text-align:center; margin-bottom:32px">
          <div style="font-size:48px;margin-bottom:12px">⚡</div>
          <div class="page-title" style="font-size:28px;text-align:center">Khod whaat Order Bot</div>
          <div class="page-subtitle" style="text-align:center">Automate your daily order processing</div>
        </div>

        <!-- Main actions -->
        <div class="card" style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;margin-bottom:16px">Quick Start</div>

          <button class="btn btn-success full-width btn-lg" id="btn-today" style="margin-bottom:10px">
            <span>📅</span> Continue — Today (${todayDisplay})
          </button>

          <button class="btn btn-ghost full-width btn-lg" id="btn-pick-date">
            <span>🗓️</span> New Date / Range
          </button>
        </div>

        <!-- Launch minimized toggle -->
        <div class="card" style="margin-bottom:16px" id="launchmin-card">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-size:13px;font-weight:700;margin-bottom:3px">🔕 Launch Minimized</div>
              <div class="text-sm text-muted">When ON, app starts hidden in the tray — won't pop up on Windows startup.</div>
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
              <span id="launchmin-label" class="text-sm text-muted" style="margin-left:8px">OFF</span>
            </div>
          </div>
        </div>

        <!-- Auto-run toggle -->
        <div class="card" style="margin-bottom:16px" id="autorun-card">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-size:13px;font-weight:700;margin-bottom:3px">⏱️ Auto-Run</div>
              <div class="text-sm text-muted">Automatically run for today's orders on a schedule.</div>
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
              <span id="autorun-label" class="text-sm text-muted">OFF</span>
            </div>
          </div>
          <!-- Interval picker — shown when ON -->
          <div id="autorun-interval-row" style="margin-top:14px;display:none">
            <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Run Every</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap" id="interval-options">
              ${[{label:"30 min",mins:30},{label:"1 hour",mins:60},{label:"2 hours",mins:120},{label:"4 hours",mins:240},{label:"6 hours",mins:360}].map(o =>
                `<button class="btn btn-ghost interval-opt" data-mins="${o.mins}" style="font-size:12px;padding:6px 14px">${o.label}</button>`
              ).join("")}
            </div>
          </div>
          <div id="autorun-next" class="text-sm text-muted" style="margin-top:8px;display:none"></div>
        </div>

        <!-- Date picker card (hidden by default) -->
        <div class="card" id="date-picker-card" style="display:none; margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;margin-bottom:16px">Select Date</div>

          <div class="date-options">
            <div class="date-option selected" data-mode="today">
              <div class="opt-icon">📅</div>
              <div class="opt-label">Today</div>
              <div class="opt-desc">${todayDisplay}</div>
            </div>
            <div class="date-option" data-mode="single">
              <div class="opt-icon">🗓️</div>
              <div class="opt-label">Single Day</div>
              <div class="opt-desc">Pick one date</div>
            </div>
            <div class="date-option" data-mode="range">
              <div class="opt-icon">📆</div>
              <div class="opt-label">Date Range</div>
              <div class="opt-desc">From → To</div>
            </div>
          </div>

          <div id="date-inputs-container" style="display:none"></div>

          <button class="btn btn-primary full-width mt-12" id="btn-launch" disabled>
            🚀 Launch Bot
          </button>
        </div>

        <!-- Danger zone -->
        <div class="card">
          <div style="font-size:12px;font-weight:700;color:var(--danger);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">⚠️ Reset</div>
          <div class="notice-box warn" style="margin-bottom:14px">
            <span class="notice-icon">🔐</span>
            <div class="notice-text"><strong>New Login Credentials?</strong>Clears all saved credentials, sessions, and cookies. You'll be asked to log in again.</div>
          </div>
          <button class="btn btn-danger full-width" id="btn-reset">Reset All Data & Credentials</button>
        </div>

      </div>
    </div>
  `;

  let selectedMode = "today";
  let dateFrom = todayStr;
  let dateTo = todayStr;

  // ── Today button ──
  document.getElementById("btn-today").addEventListener("click", () => {
    onContinue({ dateFrom: todayStr, dateTo: todayStr });
  });

  // ── New date toggle ──
  document.getElementById("btn-pick-date").addEventListener("click", () => {
    const card = document.getElementById("date-picker-card");
    card.style.display = card.style.display === "none" ? "block" : "none";
  });

  // ── Date mode selection ──
  el.querySelectorAll(".date-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      el.querySelectorAll(".date-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      selectedMode = opt.dataset.mode;
      renderDateInputs(selectedMode);
    });
  });

  function renderDateInputs(mode) {
    const container = document.getElementById("date-inputs-container");
    const launchBtn = document.getElementById("btn-launch");

    if (mode === "today") {
      dateFrom = todayStr;
      dateTo = todayStr;
      container.style.display = "none";
      launchBtn.disabled = false;
      return;
    }

    container.style.display = "block";

    if (mode === "single") {
      container.innerHTML = `
        <div class="date-inputs single">
          <div class="form-group" style="margin:0">
            <label>Date</label>
            <input type="date" id="input-single" value="${todayStr}" max="${todayStr}" />
          </div>
        </div>
      `;
      document.getElementById("input-single").addEventListener("change", (e) => {
        dateFrom = e.target.value;
        dateTo = e.target.value;
        launchBtn.disabled = !dateFrom;
      });
      dateFrom = todayStr;
      dateTo = todayStr;
      launchBtn.disabled = false;
    } else {
      container.innerHTML = `
        <div class="date-inputs">
          <div class="form-group" style="margin:0">
            <label>From</label>
            <input type="date" id="input-from" value="${todayStr}" max="${todayStr}" />
          </div>
          <div class="form-group" style="margin:0">
            <label>To</label>
            <input type="date" id="input-to" value="${todayStr}" max="${todayStr}" />
          </div>
        </div>
      `;
      const updateRange = () => {
        dateFrom = document.getElementById("input-from").value;
        dateTo = document.getElementById("input-to").value;
        launchBtn.disabled = !dateFrom || !dateTo;
      };
      document.getElementById("input-from").addEventListener("change", updateRange);
      document.getElementById("input-to").addEventListener("change", updateRange);
      dateFrom = todayStr;
      dateTo = todayStr;
      launchBtn.disabled = false;
    }
  }

  // ── Launch ──
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
      label.textContent = "ON"; label.style.color = "var(--accent)";
    } else {
      btn.style.background = "var(--border)";
      knob.style.transform = "translateX(0)";
      label.textContent = "OFF"; label.style.color = "var(--text2)";
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
  let countdownSecs = 30 * 60;
  let countdownInterval = null;

  function updateAutoRunUI() {
    const btn      = document.getElementById("btn-toggle-autorun");
    const knob     = document.getElementById("autorun-knob");
    const label    = document.getElementById("autorun-label");
    const next     = document.getElementById("autorun-next");
    const intRow   = document.getElementById("autorun-interval-row");
    if (!btn) return;
    if (autoRunEnabled) {
      btn.style.background = "var(--warning)";
      knob.style.transform = "translateX(22px)";
      label.textContent = "ON"; label.style.color = "var(--warning)";
      next.style.display = "block";
      intRow.style.display = "block";
      startCountdown();
    } else {
      btn.style.background = "var(--border)";
      knob.style.transform = "translateX(0)";
      label.textContent = "OFF"; label.style.color = "var(--text2)";
      next.style.display = "none";
      intRow.style.display = "none";
      stopCountdown();
    }
    // Highlight active interval button
    document.querySelectorAll(".interval-opt").forEach(b => {
      const active = parseInt(b.dataset.mins) === autoRunIntervalMins;
      b.className = active ? "btn btn-primary interval-opt" : "btn btn-ghost interval-opt";
      b.style.cssText = "font-size:12px;padding:6px 14px";
    });
  }

  function startCountdown() {
    stopCountdown();
    countdownSecs = autoRunIntervalMins * 60;
    const next = document.getElementById("autorun-next");
    const tick = () => {
      if (!next) return;
      const m = Math.floor(countdownSecs / 60);
      const s = countdownSecs % 60;
      next.textContent = `⏳ Next auto-run in ${m}:${String(s).padStart(2,"0")}`;
      if (countdownSecs > 0) countdownSecs--;
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
    updateAutoRunUI();
  });

  // Interval option buttons
  document.querySelectorAll(".interval-opt").forEach(btn => {
    btn.addEventListener("click", async () => {
      autoRunIntervalMins = parseInt(btn.dataset.mins);
      await window.api.setAutoRunInterval(autoRunIntervalMins);
      countdownSecs = autoRunIntervalMins * 60; // reset countdown
      updateAutoRunUI();
    });
  });

  // ── Listen for auto-run ticks from main process ──
  window.api.removeAllListeners("auto-run-tick");
  window.api.onAutoRunTick(({ dateFrom, dateTo }) => {
    countdownSecs = autoRunIntervalMins * 60; // reset countdown
    onContinue({ dateFrom, dateTo });
  });

  // Load saved values for both new toggles
  window.api.getCredentials().then((creds) => {
    launchMinEnabled = creds.launchMinimized || false;
    updateLaunchMinUI();
    autoRunEnabled = creds.autoRun || false;
    autoRunIntervalMins = creds.autoRunInterval || 30;
    updateAutoRunUI();
  });

  // ── Reset ──
  document.getElementById("btn-reset").addEventListener("click", async () => {
    const confirmed = await showConfirm(
      "Reset All Data?",
      "This will delete all saved credentials, browser sessions, and cookies. You'll need to enter your login details again.",
      "Reset Everything",
      "Cancel"
    );
    if (confirmed) {
      await window.api.clearAllData();
      location.reload();
    }
  });
};

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
    document.getElementById("dlg-cancel").addEventListener("click", () => { overlay.remove(); resolve(false); });
  });
}
