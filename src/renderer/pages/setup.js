// ── SETUP PAGE — Redesigned v3 (Execution Setup style) ──
// Tasks:
// [✅] 1. Auto-label accounts as {customerName} 1, 2, 3 — no label input
// [✅] 2. UI exactly like Image 2: card grid with checkmarks, summary, run button
// [✅] 3. Reset button always visible, disabled when account is locked
// [✅] 4. Add Account card inside the grid (dashed tile)
// [✅] 5. Sidebar navigation (Accounts → Date → Run)

window.renderSetup = function (onComplete, initialStep) {
  const t = window._t;
  const el = document.getElementById("page-setup");

  let accounts    = [];
  let maxAccounts = 1;
  let editingId   = null;

  // Step state: "accounts" | "run"
  // initialStep lets the caller decide the landing step (e.g. skip to "run" if accounts exist)
  let step = (initialStep === "run" || initialStep === "accounts") ? initialStep : "accounts";

  // Date state
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  })();
  let dateMode   = "today";   // "today" | "single" | "range"
  let dateFrom   = todayStr;
  let dateTo     = todayStr;

  // Selected account IDs (for multi-account support)
  let selectedIds = [];

  async function loadAccounts() {
    const creds = await window.api.getCredentials();
    accounts    = creds.accounts || [];
    maxAccounts = creds.maxAccounts || 1;

    if (!accounts.length && creds.easyEmail) {
      accounts = [{
        id: "account_1",
        label: buildLabel(1),
        easyEmail: creds.easyEmail,
        easyStore: creds.easyStore || "",
        khodEmail: creds.khodEmail || "",
        locked: true,
      }];
    }

    // Default: nothing selected — user picks on the Run step
    selectedIds = [];
    renderShell();
  }

  // ── Label builder: "{CustomerName} 1", "{CustomerName} 2", etc. ──
  function buildLabel(n) {
    const name = (window._kbotUser && window._kbotUser.customerName) || "Account";
    return `${name} ${n}`;
  }

  function getNextLabel() {
    const n = accounts.length + 1;
    return buildLabel(n);
  }

  // ── Total days calculation ──
  function daysBetween(from, to) {
    const a = new Date(from), b = new Date(to);
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }

  // ─────────────────────────────────────────────────────────────────
  // SHELL — sidebar + content area, rendered once
  // ─────────────────────────────────────────────────────────────────
  function renderShell() {
    el.innerHTML = `
      <style>
        /* ── Layout ── */
        .sv3-shell {
          display: flex;
          flex: 1;
          height: 100%;
          overflow: hidden;
        }

        /* ── Sidebar ── */
        .sv3-sidebar {
          width: 200px;
          min-width: 200px;
          background: var(--bg2);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 28px 0 20px;
          gap: 4px;
        }
        .sv3-sb-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 20px 24px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 12px;
        }
        .sv3-sb-logo-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg,#7c6af7,#4f8ef7);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }
        .sv3-sb-logo-text {
          font-size: 12px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -.2px;
          line-height: 1.2;
        }
        .sv3-sb-logo-sub {
          font-size: 10px;
          color: var(--text2);
        }

        .sv3-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 20px;
          cursor: pointer;
          transition: background .15s, color .15s;
          border-left: 2px solid transparent;
          font-size: 13px;
          color: var(--text2);
          font-weight: 500;
          position: relative;
        }
        .sv3-nav-item:hover { background: var(--bg3); color: var(--text); }
        .sv3-nav-item.active {
          background: rgba(124,106,247,.1);
          color: #b3a9f9;
          border-left-color: #7c6af7;
          font-weight: 700;
        }
        .sv3-nav-item.done { color: #00d68f; }
        .sv3-nav-item.done .sv3-step-num { background: #00d68f; color: #021c12; }

        .sv3-step-num {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--bg3);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
          flex-shrink: 0;
          transition: background .2s;
        }
        .sv3-nav-item.active .sv3-step-num {
          background: #7c6af7;
          border-color: #7c6af7;
          color: #fff;
        }

        .sv3-sidebar-footer {
          margin-top: auto;
          padding: 16px 20px 0;
          border-top: 1px solid var(--border);
        }

        /* ── Main content ── */
        .sv3-main {
          flex: 1;
          overflow-y: auto;
          padding: 28px 32px;
          display: flex;
          flex-direction: column;
        }
        /* Inner content uses max-width centering like INSTALL */
        .sv3-main > * {
          max-width: 860px;
        }

        /* ── Phase badge ── */
        .sv3-phase-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(124,106,247,.12);
          border: 1px solid rgba(124,106,247,.3);
          color: #b3a9f9;
          border-radius: 99px;
          padding: 3px 12px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .sv3-page-title { font-size: 24px; font-weight: 800; color: var(--text); letter-spacing: -.4px; margin-bottom: 4px; }
        .sv3-page-sub   { font-size: 13px; color: var(--text2); margin-bottom: 28px; }

        /* ── Section card ── */
        .sv3-section {
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 22px 24px;
          margin-bottom: 18px;
        }
        .sv3-section-hd {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 4px;
        }
        .sv3-section-hd-icon { font-size: 18px; }
        .sv3-section-hd-title { font-size: 15px; font-weight: 700; color: var(--text); }
        .sv3-section-desc { font-size: 12px; color: var(--text2); margin-bottom: 20px; padding-left: 28px; }

        /* ── Account cards grid ── */
        .sv3-grid {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        /* Account card */
        .sv3-acc-card {
          width: 140px;
          min-height: 152px;
          background: var(--bg3, #1e2535);
          border: 1.5px solid var(--border);
          border-radius: 12px;
          padding: 14px 12px 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: border-color .15s, box-shadow .15s, transform .12s;
          position: relative;
          text-align: center;
          user-select: none;
        }
        .sv3-acc-card.selected {
          border-color: #7c6af7;
          box-shadow: 0 0 0 2px rgba(124,106,247,.2);
        }
        .sv3-acc-card:hover:not(.sv3-acc-locked) {
          border-color: rgba(124,106,247,.5);
          transform: translateY(-2px);
        }
        .sv3-acc-locked {
          opacity: .72;
          cursor: default;
        }

        /* Checkmark corner */
        .sv3-check {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 1.5px solid var(--border);
          background: var(--bg2);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background .15s, border-color .15s;
        }
        .sv3-acc-card.selected .sv3-check {
          background: #7c6af7;
          border-color: #7c6af7;
        }
        .sv3-check svg { display: none; }
        .sv3-acc-card.selected .sv3-check svg { display: block; }

        /* Avatar */
        .sv3-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7c6af7 0%, #4f8ef7 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          flex-shrink: 0;
          margin-top: 8px;
        }
        .sv3-avatar.lk {
          background: var(--bg2);
          border: 1.5px solid var(--border);
          color: var(--text2);
          font-size: 16px;
        }

        .sv3-acc-name {
          font-size: 12px;
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 116px;
        }
        .sv3-acc-email {
          font-size: 10px;
          color: var(--text2);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 116px;
        }

        .sv3-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border-radius: 99px;
          padding: 2px 8px;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .05em;
          margin-top: 2px;
        }
        .sv3-status-pill.ok  { background: rgba(0,214,143,.12); border: 1px solid rgba(0,214,143,.3); color: #00d68f; }
        .sv3-status-pill.lk  { background: rgba(255,201,77,.1);  border: 1px solid rgba(255,201,77,.3);  color: #ffc94d; }
        .sv3-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

        /* Hover action row */
        .sv3-hover-acts {
          position: absolute;
          bottom: 8px;
          left: 0; right: 0;
          display: flex;
          justify-content: center;
          gap: 5px;
          opacity: 0;
          transition: opacity .15s;
          pointer-events: none;
        }
        .sv3-acc-card:hover:not(.sv3-acc-locked) .sv3-hover-acts {
          opacity: 1;
          pointer-events: all;
        }
        .sv3-act-btn {
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 5px;
          padding: 2px 8px;
          font-size: 9px;
          font-weight: 700;
          cursor: pointer;
          color: var(--text2);
          transition: all .1s;
          line-height: 1.5;
        }
        .sv3-act-btn:hover { border-color: #7c6af7; color: #b3a9f9; }
        .sv3-act-btn.d:hover { border-color: var(--danger); color: var(--danger); }

        /* Add Account dashed card */
        .sv3-add-card {
          width: 140px;
          min-height: 152px;
          background: transparent;
          border: 1.5px dashed var(--border);
          border-radius: 12px;
          padding: 14px 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: border-color .15s, background .15s, transform .12s;
          text-align: center;
          color: var(--text2);
        }
        .sv3-add-card:hover:not(.sv3-add-disabled) {
          border-color: rgba(124,106,247,.55);
          background: rgba(124,106,247,.06);
          color: #b3a9f9;
          transform: translateY(-2px);
        }
        .sv3-add-disabled { opacity: .35; cursor: not-allowed; }
        .sv3-add-circle {
          width: 40px; height: 40px;
          border-radius: 50%;
          background: rgba(124,106,247,.1);
          border: 1.5px dashed rgba(124,106,247,.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: #b3a9f9;
        }
        .sv3-add-label { font-size: 11px; font-weight: 700; line-height: 1.3; }
        .sv3-add-warn  { font-size: 9px; color: #ffc94d; line-height: 1.3; margin-top: 2px; }

        /* Selected count bar */
        .sv3-sel-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text2);
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid var(--border);
        }
        .sv3-sel-bar svg { color: #7c6af7; }
        .sv3-sel-bar strong { color: var(--text); }

        /* ── Two-column lower section (date + summary) ── */
        .sv3-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-bottom: 18px;
        }
        /* Users + Settings column: users side gets more space */
        .sv3-users-settings-col {
          grid-template-columns: 3fr 2fr;
          align-items: start;
        }

        /* Date mode buttons */
        .sv3-date-modes {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .sv3-date-mode-btn {
          flex: 1;
          padding: 9px 8px;
          background: var(--bg3);
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text2);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          transition: all .15s;
        }
        .sv3-date-mode-btn.active {
          background: rgba(124,106,247,.15);
          border-color: #7c6af7;
          color: #b3a9f9;
        }
        .sv3-date-mode-btn:hover:not(.active) { border-color: rgba(124,106,247,.4); color: var(--text); }

        /* Date input row */
        .sv3-date-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
        }
        .sv3-date-field {
          flex: 1;
          background: var(--bg3);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 12px;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .sv3-date-input {
          background: transparent;
          border: none;
          outline: none;
          font-size: 12px;
          color: var(--text);
          width: 100%;
          font-family: inherit;
          cursor: pointer;
        }
        .sv3-date-input::-webkit-calendar-picker-indicator { filter: invert(.6); cursor: pointer; }
        .sv3-date-arrow { color: var(--text2); font-size: 14px; flex-shrink: 0; }

        /* Summary card */
        .sv3-summary-rows { display: flex; flex-direction: column; gap: 14px; }
        .sv3-summary-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--border);
        }
        .sv3-summary-row:last-child { border-bottom: none; padding-bottom: 0; }
        .sv3-summary-row-left { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text2); }
        .sv3-summary-row-left span { font-size: 16px; }
        .sv3-summary-row-right { font-size: 13px; font-weight: 700; color: var(--text); text-align: right; }
        .sv3-mini-avatars { display: flex; margin-top: 6px; }
        .sv3-mini-av {
          width: 26px; height: 26px;
          border-radius: 50%;
          background: linear-gradient(135deg,#7c6af7,#4f8ef7);
          border: 2px solid var(--bg2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 800;
          color: #fff;
          margin-right: -6px;
        }
        .sv3-mini-av.more {
          background: var(--bg3);
          color: var(--text2);
          font-size: 8px;
        }

        /* ── Run button ── */
        .sv3-run-btn {
          width: 100%;
          padding: 15px;
          background: linear-gradient(90deg, #7c6af7 0%, #4f8ef7 100%);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: opacity .18s, transform .15s;
          box-shadow: 0 4px 20px rgba(124,106,247,.3);
          letter-spacing: .01em;
        }
        .sv3-run-btn:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); }
        .sv3-run-btn:active:not(:disabled) { transform: none; }
        .sv3-run-btn:disabled { opacity: .35; cursor: not-allowed; transform: none; }
        .text-sm text-muted mt-12 { text-align: center; font-size: 11px; color: var(--text2); margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 5px; }

        /* ── Form overlay ── */
        .sv3-form-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.72);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: sv3-fade-in .15s ease;
        }
        @keyframes sv3-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .sv3-form-card {
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 28px;
          width: 460px;
          max-width: 95vw;
          max-height: 90vh;
          overflow-y: auto;
          animation: sv3-slide-up .18s ease;
        }
        @keyframes sv3-slide-up { from { transform: translateY(12px); opacity: 0; } to { transform: none; opacity: 1; } }

        /* ── Reset button ── */
        .sv3-reset-btn {
          width: 100%;
          padding: 9px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--danger);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background .15s, border-color .15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .sv3-reset-btn:hover:not(:disabled) { background: rgba(255,77,109,.1); border-color: var(--danger); }
        .sv3-reset-btn:disabled { opacity: .35; cursor: not-allowed; }
      </style>

      <div class="sv3-shell">
        <!-- Sidebar -->
        <div class="sv3-sidebar">
          <div class="sv3-sb-logo">
            <div class="sv3-sb-logo-icon">⚡</div>
            <div>
              <div class="sv3-sb-logo-text">Khod Bot</div>
              <div class="sv3-sb-logo-sub">${t("setup.sub_title")}</div>
            </div>
          </div>

          <div class="sv3-nav-item active" id="nav-accounts" data-step="accounts">
            <div class="sv3-step-num">1</div>
            ${t("setup.nav_accounts")}
          </div>
          <div class="sv3-nav-item" id="nav-run" data-step="run">
            <div class="sv3-step-num">2</div>
            ${t("setup.nav_run")}
          </div>

          <div class="sv3-sidebar-footer">
            <button class="sv3-reset-btn" id="sv3-reset-btn">
              ${t("setup.reset_creds_btn")}
            </button>
          </div>
        </div>

        <!-- Main content area -->
        <div class="sv3-main" id="sv3-main-content">
          <!-- content injected per step -->
        </div>
      </div>
    `;

    // Sidebar nav
    el.querySelectorAll(".sv3-nav-item").forEach(item => {
      item.addEventListener("click", () => {
        const targetStep = item.dataset.step;
        // Only allow going to date/review if accounts exist
        if (targetStep !== "accounts" && accounts.length === 0) return;
        step = targetStep;
        renderStep();
        updateNav();
      });
    });

    // Reset button
    const resetBtn = document.getElementById("sv3-reset-btn");
    updateResetBtn();
    resetBtn.addEventListener("click", async () => {
      if (resetBtn.disabled) return;
      const confirmed = await showConfirm(
        t("setup.reset_confirm_title"),
        t("setup.reset_confirm_msg"),
        t("setup.reset_confirm_ok"),
        t("setup.reset_confirm_cancel")
      );
      if (confirmed) {
        await window.api.clearAllData();
        location.reload();
      }
    });

    renderStep();
    updateNav();
  }

  function updateResetBtn() {
    const btn = document.getElementById("sv3-reset-btn");
    if (!btn) return;
    btn.disabled = false;
    btn.title = "";
  }

  function updateNav() {
    const steps = ["accounts", "run"];
    steps.forEach((s, i) => {
      const item = document.getElementById(`nav-${s}`);
      if (!item) return;
      item.classList.remove("active", "done");
      const currentIdx = steps.indexOf(step);
      if (s === step) item.classList.add("active");
      else if (i < currentIdx) item.classList.add("done");
    });
    // Mark done steps with checkmark
    el.querySelectorAll(".sv3-nav-item.done .sv3-step-num").forEach(n => {
      n.textContent = "✓";
    });
    // Restore numbers for non-done steps
    [["accounts","1"],["run","2"]].forEach(([s, n]) => {
      const item = document.getElementById(`nav-${s}`);
      if (item && !item.classList.contains("done")) {
        item.querySelector(".sv3-step-num").textContent = n;
      }
    });
  }

  function renderStep() {
    const content = document.getElementById("sv3-main-content");
    if (!content) return;
    if (step === "accounts") renderAccountsStep(content);
    else if (step === "run") renderRunStep(content);
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 1 — ACCOUNTS (management only: add, edit, delete — no selection)
  // ─────────────────────────────────────────────────────────────────
  function renderAccountsStep(content) {
    const canAdd = accounts.length < maxAccounts;
    const disabledReason = !canAdd
      ? (maxAccounts <= 1 ? t("setup.license_one") : t("setup.license_max")(maxAccounts))
      : null;

    content.innerHTML = `
      <div class="sv3-page-title">${t("setup.manage_title")}</div>
      <div class="sv3-page-sub">${t("setup.manage_sub")}</div>

      <div class="sv3-section">
        <div class="sv3-section-hd">
          <span class="sv3-section-hd-icon">👥</span>
          <span class="sv3-section-hd-title">${t("setup.your_accounts")}</span>
        </div>
        <div class="sv3-section-desc">${t("setup.your_accounts_desc")}</div>

        <div class="sv3-grid" id="sv3-acc-grid">
          ${accounts.map(acc => accountManageCard(acc)).join("")}

          <!-- Add Account tile -->
          <div class="sv3-add-card ${!canAdd ? "sv3-add-disabled" : ""}" id="sv3-btn-add"
               title="${!canAdd ? esc(disabledReason) : "Add new account"}">
            <div class="sv3-add-circle">+</div>
            <div class="sv3-add-label">${t("setup.add_account")}</div>
            ${!canAdd ? `<div class="sv3-add-warn">⚠️ ${esc(disabledReason)}</div>` : ""}
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end">
        <button class="sv3-run-btn" id="sv3-next-btn" style="width:auto;padding:12px 32px"
          ${accounts.length === 0 ? "disabled" : ""}>
          ${t("setup.next_btn")}
        </button>
      </div>
    `;

    content.querySelectorAll(".sv3-edit-btn").forEach(b => {
      b.addEventListener("click", e => { e.stopPropagation(); openForm(b.dataset.id); });
    });
    content.querySelectorAll(".sv3-del-btn").forEach(b => {
      b.addEventListener("click", async e => {
        e.stopPropagation();
        if (!confirm(t("setup.remove_confirm"))) return;
        accounts = accounts.filter(a => a.id !== b.dataset.id);
        selectedIds = selectedIds.filter(x => x !== b.dataset.id);
        await window.api.saveAllAccounts(accounts);
        renderStep();
        updateResetBtn();
      });
    });

    document.getElementById("sv3-btn-add")?.addEventListener("click", () => {
      if (canAdd) openForm(null);
    });

    document.getElementById("sv3-next-btn")?.addEventListener("click", () => {
      if (accounts.length) {
        step = "run"; renderStep(); updateNav();
      }
    });
  }

  // Management card (no selection, shows edit/delete hover)
  function accountManageCard(acc) {
    const initial  = (acc.label || "A").charAt(0).toUpperCase();
    const isLocked = !!acc.locked;
    return `
      <div class="sv3-acc-card ${isLocked ? "sv3-acc-locked" : ""}" data-id="${acc.id}">
        ${isLocked ? `<div style="position:absolute;top:7px;left:8px;background:rgba(255,201,77,.15);border:1px solid rgba(255,201,77,.4);border-radius:99px;padding:2px 7px;font-size:9px;font-weight:700;color:#ffc94d;letter-spacing:.04em">🔒 LOCKED</div>` : ""}
        <div class="sv3-avatar ${isLocked ? "lk" : ""}" style="margin-top:${isLocked ? "18px" : "8px"}">${isLocked ? "🔒" : initial}</div>
        <div class="sv3-acc-name">${esc(acc.label || "Account")}</div>
        <div class="sv3-acc-email">${esc(acc.easyEmail || "—")}</div>
        <div class="sv3-status-pill ${isLocked ? "lk" : "ok"}">
          <span class="sv3-dot"></span>${isLocked ? t("setup.locked") : t("setup.active")}
        </div>
        ${!isLocked ? `
          <div class="sv3-hover-acts">
            <button class="sv3-act-btn sv3-edit-btn" data-id="${acc.id}">${t("setup.edit_btn")}</button>
            <button class="sv3-act-btn d sv3-del-btn" data-id="${acc.id}">🗑</button>
          </div>
        ` : ""}
      </div>`;
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 2 — RUN (combined: account selection + date + summary + run)
  // ─────────────────────────────────────────────────────────────────
  function renderRunStep(content) {
    injectCalendarStyles();
    const totalDays   = daysBetween(dateFrom, dateTo);
    const selAccounts = accounts.filter(a => selectedIds.includes(a.id));

    content.innerHTML = `
      <div class="sv3-page-title">${t("setup.run_title")}</div>
      <div class="sv3-page-sub">${t("setup.run_sub")}</div>

      <!-- Users section: header row (title+desc LEFT, toggles RIGHT) + full-width grid below -->
      <div class="sv3-section">

        <!-- Header bar: left = icon/title/desc  |  right = Launch Min + Auto-Run toggles -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:20px">

          <!-- Left: section title + desc -->
          <div>
            <div class="sv3-section-hd" style="margin-bottom:4px">
              <span class="sv3-section-hd-icon">👥</span>
              <span class="sv3-section-hd-title">${t("setup.select_users")}</span>
            </div>
            <div class="sv3-section-desc" style="margin-bottom:0;padding-inline-start:28px">${t("setup.select_users_desc")}</div>
          </div>

          <!-- Right: two toggles stacked -->
          <div style="display:flex;flex-direction:column;gap:10px;flex-shrink:0;min-width:220px">

            <!-- Launch Minimized row -->
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;
                        background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 14px">
              <div>
                <div style="font-size:12px;font-weight:700;margin-bottom:2px">${t("welcome.launch_min")}</div>
                <div style="font-size:11px;color:var(--text2);line-height:1.4;max-width:160px">${t("welcome.launch_min_desc")}</div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                <button id="sv3-btn-launchmin" style="
                  width:44px;height:24px;border-radius:12px;border:none;cursor:pointer;
                  position:relative;transition:background 0.25s;background:var(--border);flex-shrink:0;
                ">
                  <span id="sv3-launchmin-knob" style="
                    position:absolute;top:3px;left:3px;
                    width:18px;height:18px;border-radius:50%;
                    background:#fff;transition:transform 0.25s;
                  "></span>
                </button>
                <span id="sv3-launchmin-label" style="font-size:11px;color:var(--text2);min-width:28px">${t("welcome.off")}</span>
              </div>
            </div>

            <!-- Auto-Run row -->
            <div style="display:flex;flex-direction:column;
                        background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 14px">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
                <div>
                  <div style="font-size:12px;font-weight:700;margin-bottom:2px">${t("welcome.autorun")}</div>
                  <div style="font-size:11px;color:var(--text2);line-height:1.4;max-width:160px">${t("welcome.autorun_desc")}</div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                  <button id="sv3-btn-autorun" style="
                    width:44px;height:24px;border-radius:12px;border:none;cursor:pointer;
                    position:relative;transition:background 0.25s;background:var(--border);flex-shrink:0;
                  ">
                    <span id="sv3-autorun-knob" style="
                      position:absolute;top:3px;left:3px;
                      width:18px;height:18px;border-radius:50%;
                      background:#fff;transition:transform 0.25s;
                    "></span>
                  </button>
                  <span id="sv3-autorun-label" style="font-size:11px;color:var(--text2);min-width:28px">${t("welcome.off")}</span>
                </div>
              </div>
              <!-- Interval selector (shown when auto-run is ON) -->
              <div id="sv3-autorun-interval-row" style="margin-top:10px;display:none">
                <div style="font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${t("welcome.run_every")}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap" id="sv3-interval-options">
                  ${[{label:"30 min",mins:30},{label:"1 hr",mins:60},{label:"2 hr",mins:120},{label:"4 hr",mins:240},{label:"6 hr",mins:360}].map(o =>
                    `<button class="btn btn-ghost sv3-interval-opt" data-mins="${o.mins}" style="font-size:11px;padding:4px 10px">${o.label}</button>`
                  ).join("")}
                </div>
              </div>
              <div id="sv3-autorun-next" style="margin-top:6px;font-size:11px;color:var(--text2);display:none"></div>
            </div>

          </div>
        </div>

        <!-- Full-width account grid -->
        <div class="sv3-grid" id="sv3-run-acc-grid">
          <!-- All Users card -->
          <div class="sv3-acc-card ${accounts.length > 0 && accounts.every(a => selectedIds.includes(a.id)) ? "selected" : ""}" id="sv3-all-card" style="border-style:dashed;cursor:pointer">
            <div class="sv3-check">
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
            </div>
            <div class="sv3-avatar" style="background:linear-gradient(135deg,#ff2d7a,#7c6af7);margin-top:8px">★</div>
            <div class="sv3-acc-name">${t("setup.all_users")}</div>
            <div class="sv3-acc-email">${t("setup.accounts_count")(accounts.length)}</div>
            <div class="sv3-status-pill ok"><span class="sv3-dot"></span>${t("setup.select_all")}</div>
          </div>
          ${accounts.map(acc => accountRunCard(acc)).join("")}
        </div>

      </div>

      <!-- Two-column: date + summary -->
      <div class="sv3-two-col">
        <!-- Date picker -->
        <div class="sv3-section">
          <div class="sv3-section-hd">
            <span class="sv3-section-hd-icon">📅</span>
            <span class="sv3-section-hd-title">${t("setup.select_date")}</span>
          </div>
          <div class="sv3-section-desc">${t("setup.select_date_desc")}</div>

          <div class="sv3-date-modes">
            <button class="sv3-date-mode-btn ${dateMode==="today"?"active":""}" data-mode="today">${t("setup.today_mode")}</button>
            <button class="sv3-date-mode-btn ${dateMode==="single"?"active":""}" data-mode="single">${t("setup.single_mode")}</button>
            <button class="sv3-date-mode-btn ${dateMode==="range"?"active":""}" data-mode="range">${t("setup.range_mode")}</button>
          </div>

          <div id="sv3-date-inputs"></div>
        </div>

        <!-- Summary -->
        <div class="sv3-section">
          <div class="sv3-section-hd">
            <span class="sv3-section-hd-icon">📋</span>
            <span class="sv3-section-hd-title">${t("setup.summary")}</span>
          </div>
          <div class="sv3-section-desc">${t("setup.summary_desc")}</div>
          <div class="sv3-summary-rows">
            <div class="sv3-summary-row">
              <div class="sv3-summary-row-left"><span>👥</span>${t("setup.users_selected")}</div>
              <div class="sv3-summary-row-right">
                <div id="sv3-sum-users">${t("setup.users_count")(selAccounts.length)}</div>
                <div class="sv3-mini-avatars" id="sv3-mini-avs">
                  ${selAccounts.slice(0,3).map(a => `<div class="sv3-mini-av">${(a.label||"A").charAt(0).toUpperCase()}</div>`).join("")}
                  ${selAccounts.length > 3 ? `<div class="sv3-mini-av more">+${selAccounts.length-3}</div>` : ""}
                </div>
              </div>
            </div>
            <div class="sv3-summary-row">
              <div class="sv3-summary-row-left"><span>📅</span>${t("setup.date_range")}</div>
              <div class="sv3-summary-row-right" id="sv3-sum-range">
                ${dateFrom === dateTo ? formatDisplayDate(dateFrom) : `${formatDisplayDate(dateFrom)} – ${formatDisplayDate(dateTo)}`}
              </div>
            </div>
            <div class="sv3-summary-row">
              <div class="sv3-summary-row-left"><span>🕐</span>${t("setup.total_days")}</div>
              <div class="sv3-summary-row-right" id="sv3-sum-days">${t("setup.days_count")(totalDays)}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Back + Run button -->
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">
        <button class="sv3-run-btn" id="sv3-back-btn" style="width:auto;padding:12px 28px;background:var(--bg3);color:var(--text2);box-shadow:none;border:1px solid var(--border)">
          ${t("setup.back_btn")}
        </button>
        <button class="sv3-run-btn" id="sv3-run-final" style="flex:1;background:linear-gradient(90deg,#ff2d7a,#00d4ff)"
          ${selAccounts.length === 0 ? "disabled" : ""}>
          ${t("setup.run_btn")}
        </button>
      </div>
      <div style="text-align:center;font-size:11px;color:var(--text2);display:flex;align-items:center;justify-content:center;gap:5px">
        ${t("setup.run_security")}
      </div>
    `;

    // Account card selection (All Users + individual)
    document.getElementById("sv3-all-card")?.addEventListener("click", () => {
      const allIds = accounts.map(a => a.id);
      const allSel = allIds.every(id => selectedIds.includes(id));
      if (allSel) {
        selectedIds = allIds.length > 0 ? [allIds[0]] : selectedIds;
      } else {
        selectedIds = [...allIds];
      }
      updateRunCards();
    });

    content.querySelectorAll(".sv3-run-acc-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.dataset.id;
        if (selectedIds.includes(id)) {
          if (selectedIds.length > 1) {
            selectedIds = selectedIds.filter(x => x !== id);
          }
        } else {
          selectedIds.push(id);
        }
        updateRunCards();
      });
    });

    // Date mode buttons
    content.querySelectorAll(".sv3-date-mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        dateMode = btn.dataset.mode;
        if (dateMode === "today") { dateFrom = todayStr; dateTo = todayStr; }
        content.querySelectorAll(".sv3-date-mode-btn").forEach(b => b.classList.toggle("active", b === btn));
        renderDateInputs();
        updateSummary();
      });
    });

    renderDateInputs();

    document.getElementById("sv3-back-btn")?.addEventListener("click", () => {
      step = "accounts"; renderStep(); updateNav();
    });

    document.getElementById("sv3-run-final")?.addEventListener("click", () => {
      const sel = accounts.filter(a => selectedIds.includes(a.id));
      if (sel.length) {
        onComplete({ dateFrom, dateTo, selectedAccountIds: selectedIds.length ? selectedIds : null });
      }
    });

    // ── Launch Minimized toggle (setup page) ──
    let sv3LaunchMinEnabled = false;
    function sv3UpdateLaunchMinUI() {
      const btn   = document.getElementById("sv3-btn-launchmin");
      const knob  = document.getElementById("sv3-launchmin-knob");
      const label = document.getElementById("sv3-launchmin-label");
      if (!btn) return;
      if (sv3LaunchMinEnabled) {
        btn.style.background = "var(--accent)";
        knob.style.transform = "translateX(22px)";
        label.textContent = t("welcome.on"); label.style.color = "var(--accent)";
      } else {
        btn.style.background = "var(--border)";
        knob.style.transform = "translateX(0)";
        label.textContent = t("welcome.off"); label.style.color = "var(--text2)";
      }
    }
    document.getElementById("sv3-btn-launchmin")?.addEventListener("click", async () => {
      sv3LaunchMinEnabled = !sv3LaunchMinEnabled;
      await window.api.setLaunchMinimized(sv3LaunchMinEnabled);
      sv3UpdateLaunchMinUI();
    });

    // ── Auto-Run toggle (setup page) ──
    let sv3AutoRunEnabled      = false;
    let sv3AutoRunIntervalMins = 30;
    let sv3CountdownInterval   = null;
    let sv3CountdownSyncedAt   = 0;
    let sv3CountdownSyncedMs   = 0;

    function sv3UpdateAutoRunUI(remainingMs) {
      const btn    = document.getElementById("sv3-btn-autorun");
      const knob   = document.getElementById("sv3-autorun-knob");
      const label  = document.getElementById("sv3-autorun-label");
      const next   = document.getElementById("sv3-autorun-next");
      const intRow = document.getElementById("sv3-autorun-interval-row");
      if (!btn) return;
      if (sv3AutoRunEnabled) {
        btn.style.background = "var(--warning)";
        knob.style.transform = "translateX(22px)";
        label.textContent = t("welcome.on"); label.style.color = "var(--warning)";
        next.style.display = "block";
        intRow.style.display = "block";
        sv3StartCountdown(remainingMs);
      } else {
        btn.style.background = "var(--border)";
        knob.style.transform = "translateX(0)";
        label.textContent = t("welcome.off"); label.style.color = "var(--text2)";
        next.style.display = "none";
        intRow.style.display = "none";
        sv3StopCountdown();
      }
      document.querySelectorAll(".sv3-interval-opt").forEach(b => {
        const active = parseInt(b.dataset.mins) === sv3AutoRunIntervalMins;
        b.className = active ? "btn btn-primary sv3-interval-opt" : "btn btn-ghost sv3-interval-opt";
        b.style.cssText = "font-size:12px;padding:6px 14px";
      });
    }

    function sv3StartCountdown(remainingMs) {
      sv3StopCountdown();
      sv3CountdownSyncedAt = Date.now();
      sv3CountdownSyncedMs = (remainingMs !== undefined)
        ? Math.max(0, remainingMs)
        : sv3AutoRunIntervalMins * 60 * 1000;

      const next = document.getElementById("sv3-autorun-next");
      let syncTick = 0;
      const tick = async () => {
        if (!document.getElementById("sv3-autorun-next")) { sv3StopCountdown(); return; }
        syncTick++;
        if (syncTick % 5 === 0) {
          try {
            const prog = await window.api.getAutoRunProgress();
            if (prog) { sv3CountdownSyncedAt = Date.now(); sv3CountdownSyncedMs = prog.remainingMs; }
          } catch {}
        }
        const displayMs  = Math.max(0, sv3CountdownSyncedMs - (Date.now() - sv3CountdownSyncedAt));
        const totalSecs  = Math.ceil(displayMs / 1000);
        const m = Math.floor(totalSecs / 60);
        const s = totalSecs % 60;
        const fn = t("welcome.next_run");
        if (next) next.textContent = typeof fn === "function"
          ? fn(m, String(s).padStart(2, "0"))
          : `⏳ Next auto-run in ${m}:${String(s).padStart(2, "0")}`;
      };
      tick();
      sv3CountdownInterval = setInterval(tick, 1000);
    }

    function sv3StopCountdown() {
      if (sv3CountdownInterval) { clearInterval(sv3CountdownInterval); sv3CountdownInterval = null; }
    }

    document.getElementById("sv3-btn-autorun")?.addEventListener("click", async () => {
      sv3AutoRunEnabled = !sv3AutoRunEnabled;
      await window.api.setAutoRun(sv3AutoRunEnabled);
      if (sv3AutoRunEnabled) {
        const prog = await window.api.getAutoRunProgress();
        sv3UpdateAutoRunUI(prog ? prog.remainingMs : undefined);
      } else {
        sv3UpdateAutoRunUI();
      }
    });

    document.querySelectorAll(".sv3-interval-opt").forEach(btn => {
      btn.addEventListener("click", async () => {
        sv3AutoRunIntervalMins = parseInt(btn.dataset.mins);
        await window.api.setAutoRunInterval(sv3AutoRunIntervalMins);
        sv3UpdateAutoRunUI(sv3AutoRunIntervalMins * 60 * 1000);
      });
    });

    // Load saved state from store
    window.api.getCredentials().then(async (creds) => {
      sv3LaunchMinEnabled    = creds.launchMinimized || false;
      sv3AutoRunEnabled      = creds.autoRun         || false;
      sv3AutoRunIntervalMins = creds.autoRunInterval  || 30;
      sv3UpdateLaunchMinUI();
      if (sv3AutoRunEnabled) {
        const prog = await window.api.getAutoRunProgress();
        sv3UpdateAutoRunUI(prog ? prog.remainingMs : undefined);
      } else {
        sv3UpdateAutoRunUI();
      }
    });
  }

  // Run step account card (selectable, no edit/delete)
  function accountRunCard(acc) {
    const initial  = (acc.label || "A").charAt(0).toUpperCase();
    const isLocked = !!acc.locked;
    const isSel    = selectedIds.includes(acc.id);
    return `
      <div class="sv3-acc-card sv3-run-acc-card ${isSel ? "selected" : ""}" data-id="${acc.id}" style="cursor:pointer">
        <div class="sv3-check">
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        </div>
        ${isLocked ? `<div style="position:absolute;top:7px;left:8px;background:rgba(255,201,77,.15);border:1px solid rgba(255,201,77,.4);border-radius:99px;padding:2px 7px;font-size:9px;font-weight:700;color:#ffc94d;letter-spacing:.04em">🔒 LOCKED</div>` : ""}
        <div class="sv3-avatar ${isLocked ? "lk" : ""}" style="margin-top:${isLocked ? "14px" : "8px"}">${isLocked ? "🔒" : initial}</div>
        <div class="sv3-acc-name">${esc(acc.label || "Account")}</div>
        <div class="sv3-acc-email">${esc(acc.easyEmail || "—")}</div>
      </div>`;
  }

  function updateRunCards() {
    const allIds = accounts.map(a => a.id);
    const allSel = allIds.length > 0 && allIds.every(id => selectedIds.includes(id));

    // Update All Users card
    const allCard = document.getElementById("sv3-all-card");
    if (allCard) allCard.classList.toggle("selected", allSel);

    // Update individual cards
    document.querySelectorAll(".sv3-run-acc-card").forEach(card => {
      const isSel = selectedIds.includes(card.dataset.id);
      card.classList.toggle("selected", isSel);
    });

    // Update summary
    const selAccounts = accounts.filter(a => selectedIds.includes(a.id));
    const usersEl = document.getElementById("sv3-sum-users");
    const avsEl   = document.getElementById("sv3-mini-avs");
    if (usersEl) usersEl.textContent = `${t("setup.users_count")(selAccounts.length)}`;
    if (avsEl) {
      avsEl.innerHTML = selAccounts.slice(0,3).map(a => `<div class="sv3-mini-av">${(a.label||"A").charAt(0).toUpperCase()}</div>`).join("")
        + (selAccounts.length > 3 ? `<div class="sv3-mini-av more">+${selAccounts.length-3}</div>` : "");
    }

    const runBtn = document.getElementById("sv3-run-final");
    if (runBtn) runBtn.disabled = selAccounts.length === 0;
  }

  function renderDateInputs() {
    const container = document.getElementById("sv3-date-inputs");
    if (!container) return;
    if (dateMode === "today") {
      container.innerHTML = `
        <div style="background:rgba(0,214,143,.08);border:1px solid rgba(0,214,143,.2);border-radius:8px;padding:12px;text-align:center;font-size:12px;color:#00d68f;font-weight:600">
          ${t("setup.today_running")(formatDisplayDate(todayStr))}
        </div>`;
      return;
    }
    if (dateMode === "single") {
      container.innerHTML = `
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${t("setup.date_label")}</div>
          <div id="sv3-cal-single" class="fast-cal" style="max-width:220px"></div>
        </div>`;
      buildCalendar(
        document.getElementById("sv3-cal-single"),
        dateFrom, todayStr,
        (val) => { dateFrom = val; dateTo = val; updateSummary(); }
      );
      return;
    }
    // range
    container.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${t("setup.start_date")}</div>
          <div id="sv3-cal-from" class="fast-cal"></div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${t("setup.end_date")}</div>
          <div id="sv3-cal-to" class="fast-cal"></div>
        </div>
      </div>`;
    buildCalendar(
      document.getElementById("sv3-cal-from"),
      dateFrom, todayStr,
      (val) => { dateFrom = val; updateSummary(); }
    );
    buildCalendar(
      document.getElementById("sv3-cal-to"),
      dateTo, todayStr,
      (val) => { dateTo = val; updateSummary(); }
    );
  }

  function updateSummary() {
    const rangeEl = document.getElementById("sv3-sum-range");
    const daysEl  = document.getElementById("sv3-sum-days");
    if (!rangeEl || !daysEl) return;
    const totalDays = daysBetween(dateFrom, dateTo);
    rangeEl.textContent = dateFrom === dateTo
      ? formatDisplayDate(dateFrom)
      : `${formatDisplayDate(dateFrom)} – ${formatDisplayDate(dateTo)}`;
    daysEl.textContent = `${t("setup.days_count")(totalDays)}`;
  }

  function formatDisplayDate(str) {
    if (!str) return "—";
    const [y, m, d] = str.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m)-1]} ${parseInt(d)}, ${y}`;
  }

  // ─────────────────────────────────────────────────────────────────
  // FORM OVERLAY — Add / Edit account
  // ─────────────────────────────────────────────────────────────────
  function openForm(editId) {
    const isEdit = editId !== null;
    const acc    = isEdit ? accounts.find(a => a.id === editId) : null;
    if (isEdit && acc && acc.locked) return;

    const overlay = document.createElement("div");
    overlay.className = "sv3-form-overlay";
    overlay.innerHTML = `
      <div class="sv3-form-card">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:22px">
          <button id="sv3-form-back" style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2);font-size:15px;flex-shrink:0;transition:all .15s">←</button>
          <div>
            <div style="font-size:16px;font-weight:800;color:var(--text)">${isEdit ? t("setup.edit_account") : t("setup.new_account")}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:2px">${t("setup.form_subtitle")}</div>
          </div>
        </div>

        <div class="form-section-title">${t("setup.easy_section")}</div>
        <div class="form-group">
          <label>${t("setup.store_label")} <span style="color:var(--text2);font-weight:400;text-transform:none">${t("setup.store_hint")}</span></label>
          <input type="text" id="sv3-easy-store" placeholder="${t("setup.store_ph")}" value="${esc(acc?.easyStore||"")}" />
        </div>
        <div class="form-group">
          <label>${t("setup.email_label")}</label>
          <input type="email" id="sv3-easy-email" placeholder="${t("setup.email_ph")}" value="${esc(acc?.easyEmail||"")}" autocomplete="off" />
        </div>
        <div class="form-group">
          <label>${t("setup.pass_label")}</label>
          <input type="password" id="sv3-easy-pass" placeholder="••••••••" autocomplete="new-password" />
          ${isEdit ? `<div style="font-size:11px;color:var(--text2);margin-top:4px">${t("setup.keep_pass")}</div>` : ""}
        </div>

        <div class="form-section-title">${t("setup.khod_section")}</div>
        <div class="form-group">
          <label>${t("setup.email_label")}</label>
          <input type="email" id="sv3-khod-email" placeholder="${t("setup.khod_email_ph")}" value="${esc(acc?.khodEmail||"")}" autocomplete="off" />
        </div>
        <div class="form-group">
          <label>${t("setup.pass_label")}</label>
          <input type="password" id="sv3-khod-pass" placeholder="••••••••" autocomplete="new-password" />
          ${isEdit ? `<div style="font-size:11px;color:var(--text2);margin-top:4px">${t("setup.khod_pass_hint")}</div>` : ""}
        </div>

        <div id="sv3-form-err" class="notice-box danger mt-20" style="display:none">
          <span class="notice-icon">⚠️</span>
          <div class="notice-text" id="sv3-form-err-text">${t("setup.err_missing")}</div>
        </div>

        <div class="mt-20" style="display:flex;gap:10px">
          <button class="btn full-width" id="sv3-form-cancel" style="border:1px solid var(--border);background:var(--bg2);color:var(--text2)">Cancel</button>
          <button class="btn btn-primary full-width btn-lg" id="sv3-form-save">${isEdit ? t("setup.save_btn2") : t("setup.add_btn")}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.getElementById("sv3-form-back")?.addEventListener("click", close);
    document.getElementById("sv3-form-cancel")?.addEventListener("click", close);

    document.getElementById("sv3-form-save")?.addEventListener("click", async () => {
      const easyEmail    = document.getElementById("sv3-easy-email").value.trim();
      const easyPassword = document.getElementById("sv3-easy-pass").value;
      const easyStore    = document.getElementById("sv3-easy-store").value.trim();
      const khodEmail    = document.getElementById("sv3-khod-email").value.trim();
      const khodPassword = document.getElementById("sv3-khod-pass").value;
      const errEl        = document.getElementById("sv3-form-err");
      const errText      = document.getElementById("sv3-form-err-text");
      const saveBtn      = document.getElementById("sv3-form-save");

      if (!easyEmail || !khodEmail || (!isEdit && (!easyPassword || !khodPassword))) {
        errText.innerHTML = t("setup.err_missing");
        errEl.style.display = "flex";
        return;
      }
      errEl.style.display = "none";
      saveBtn.textContent = t("setup.saving");
      saveBtn.disabled = true;

      if (isEdit) {
        const idx = accounts.findIndex(a => a.id === editId);
        if (idx !== -1) {
          accounts[idx] = {
            ...accounts[idx],
            easyEmail, easyStore, khodEmail,
            ...(easyPassword ? { easyPassword } : {}),
            ...(khodPassword ? { khodPassword } : {}),
          };
        }
        // NOTE: relockAccount is called AFTER saveAllAccounts so that main.js
        // reads the already-updated credentials from store when computing the hash.
      } else {
        const newId = "account_" + Date.now();
        const newLabel = getNextLabel();
        accounts.push({
          id: newId,
          label: newLabel,
          easyEmail, easyPassword, easyStore, khodEmail, khodPassword,
        });
        selectedIds.push(newId);
      }

      const result = await window.api.saveAllAccounts(accounts);

      if (result && result.success === false) {
        saveBtn.textContent = isEdit ? t("setup.save_btn2") : t("setup.add_btn");
        saveBtn.disabled = false;
        errText.innerHTML = result.reason === "account_locked"
          ? t("setup.err_locked")
          : result.reason === "limit_reached"
          ? t("setup.limit_reached")
          : (result.reason || t("setup.save_failed"));
        errEl.style.display = "flex";
        return;
      }

      // Re-lock AFTER save so main.js reads the updated credentials from store
      if (isEdit) {
        await window.api.relockAccount({ accountId: editId });
      }

      close();
      // Re-fetch credentials from server so lock status is always fresh.
      // Fixes: (1) partial admin unlock not showing Edit button for individual accounts,
      // (2) newly-added accounts incorrectly showing Edit/Delete instead of being locked.
      const fresh = await window.api.getCredentials();
      accounts    = fresh.accounts || [];
      maxAccounts = fresh.maxAccounts || maxAccounts;
      renderStep();
      updateResetBtn();
    });

    // Enter key support
    overlay.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("sv3-form-save")?.click(); });
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function showConfirm(title, message, confirmText, cancelText) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:9999;";
      overlay.innerHTML = `
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:28px;width:380px;text-align:center">
          <div style="font-size:18px;font-weight:800;margin-bottom:8px">${title}</div>
          <div style="font-size:13px;color:var(--text2);margin-bottom:24px;line-height:1.5">${message}</div>
          <div style="display:flex;gap:10px;justify-content:center">
            <button id="dlg-cancel" class="btn btn-ghost">${cancelText}</button>
            <button id="dlg-confirm" class="btn btn-danger">${confirmText}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      document.getElementById("dlg-confirm").addEventListener("click", () => { overlay.remove(); resolve(true); });
      document.getElementById("dlg-cancel").addEventListener("click",  () => { overlay.remove(); resolve(false); });
    });
  }

  // ── Register in-place re-renderer for language switches ──
  // Called by app.js reRenderCurrentPage() when lang changes on this page.
  // Re-renders only the current step content without resetting step state.
  window._renderSetupInPlace = function() {
    renderShell(); // rebuilds sidebar + content; renderStep() is called inside
  };

  loadAccounts();
};

// ══════════════════════════════════════════════════════
// ── Fast Custom Calendar — copied from welcome.js ──
// ══════════════════════════════════════════════════════

function buildCalendar(container, initial, maxDate, onChange) {
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
    const selStr    = _formatDateLocal(selected);
    const maxStr    = _formatDateLocal(maxD);
    const todayStr2 = _formatDateLocal(new Date());

    const firstDay  = new Date(viewYear, viewMonth, 1);
    const lastDay   = new Date(viewYear, viewMonth + 1, 0);
    const startDow  = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const maxYear  = maxD.getFullYear();
    const maxMonth = maxD.getMonth();
    const canNext  = viewYear < maxYear || (viewYear === maxYear && viewMonth < maxMonth);
    const minYear  = new Date().getFullYear() - 5;
    const canPrev  = viewYear > minYear || (viewYear === minYear && viewMonth > 0);

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

function _formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}