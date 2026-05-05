// ── RESULTS PAGE ──
window.renderResults = function (data, dateFrom, dateTo, onRunAgain, onHome) {
  // Build a time tag like "1423" for 2:23 PM — makes every run's filename unique
  const _now = new Date();
  const _runTimeTag = String(_now.getHours()).padStart(2,"0") + String(_now.getMinutes()).padStart(2,"0");
  const el = document.getElementById("page-results");
  const t  = window._t;
  const dateDisplay = dateFrom === dateTo ? dateFrom : `${dateFrom} → ${dateTo}`;

  // ─────────────────────────────────────
  // MULTI-ACCOUNT path
  // ─────────────────────────────────────
  if (data && data._multiAccount && Array.isArray(data._accountResults)) {
    const accountResults = data._accountResults;
    let selectedPane = "__all__"; // "__all__" or accountId

    // ── Status icon ──
    function statusIcon(r) { return r.success ? "✅" : "❌"; }

    // ── Dropdown HTML ──
    function buildDropdownOptions() {
      let html = `<div class="res-dd-item ${selectedPane === "__all__" ? "res-dd-active" : ""}" data-pane="__all__">${t("results.all_accounts")}</div>`;
      for (const r of accountResults) {
        html += `<div class="res-dd-item ${selectedPane === r.accountId ? "res-dd-active" : ""}" data-pane="${r.accountId}">${statusIcon(r)} ${r.accountLabel || r.accountId}</div>`;
      }
      return html;
    }

    function buildTriggerLabel() {
      if (selectedPane === "__all__") return t("results.all_accounts");
      const r = accountResults.find(x => x.accountId === selectedPane);
      return r ? `${statusIcon(r)} ${r.accountLabel || r.accountId}` : t("results.all_accounts");
    }

    // ── Overview pane (summed stats, no product table) ──
    function buildOverviewPane() {
      const totalOrders  = accountResults.reduce((s, r) => s + (r.data?.orders || 0), 0);
      const totalInKhod  = accountResults.reduce((s, r) => s + ((r.data?.stats?.realInTaager || 0) + (r.data?.stats?.missedInTaager || 0)), 0);
      const totalDupes   = accountResults.reduce((s, r) => s + ((r.data?.stats?.realDupe || 0) + (r.data?.stats?.missedDupe || 0)), 0);
      const totalFailed  = accountResults.reduce((s, r) => s + (r.data?.failedOrders?.count || 0), 0);
      const allOk        = accountResults.every(r => r.success);
      const hasFailed    = totalFailed > 0;

      const rows = accountResults.map(r => {
        const orders = r.data?.orders || 0;
        const failed = r.data?.failedOrders?.count || 0;
        const icon   = r.success ? "✅" : "❌";
        return `<tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
          <td style="padding:8px 10px;font-weight:600">${icon} ${r.accountLabel || r.accountId}</td>
          <td style="padding:8px 10px;text-align:right;color:var(--success);font-weight:700">${orders}</td>
          <td style="padding:8px 10px;text-align:right;color:${failed > 0 ? "var(--danger)" : "var(--text2)"};font-weight:${failed > 0 ? "700" : "400"}">${failed}</td>
          <td style="padding:8px 10px;text-align:right"><span style="background:${r.success ? "rgba(0,214,143,0.12)" : "rgba(255,77,109,0.12)"};color:${r.success ? "var(--success)" : "var(--danger)"};border-radius:99px;padding:3px 10px;font-size:11px;font-weight:700">${r.success ? "OK" : "Error"}</span></td>
        </tr>`;
      }).join("");

      return `
        <div style="display:grid;grid-template-columns:repeat(${hasFailed ? 4 : 3},1fr);gap:12px">
          <div class="stat-card stat-success"><div class="stat-value">${totalOrders}</div><div class="stat-label">${t("results.new_orders")}</div></div>
          <div class="stat-card stat-warning"><div class="stat-value">${totalInKhod}</div><div class="stat-label">${t("results.in_khod")}</div></div>
          <div class="stat-card"><div class="stat-value" style="color:var(--text2)">${totalDupes}</div><div class="stat-label">${t("results.dupes")}</div></div>
          ${hasFailed ? `<div class="stat-card" style="background:rgba(255,77,109,0.08);border-color:var(--danger)"><div class="stat-value" style="color:var(--danger)">${totalFailed}</div><div class="stat-label" style="color:var(--danger)">${t("results.failed")}</div></div>` : ""}
        </div>

        <div class="card">
          <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">${t("results.per_account_summary")}</div>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="border-bottom:1px solid var(--border)">
                <th style="text-align:left;padding:8px 10px;color:var(--text2);font-weight:600">Account</th>
                <th style="text-align:right;padding:8px 10px;color:var(--text2);font-weight:600">New Orders</th>
                <th style="text-align:right;padding:8px 10px;color:var(--text2);font-weight:600">Failed</th>
                <th style="text-align:right;padding:8px 10px;color:var(--text2);font-weight:600">Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr>
                <td style="padding:10px;font-weight:700;border-top:1px solid var(--border)">Total</td>
                <td style="text-align:right;padding:10px;font-weight:700;border-top:1px solid var(--border);color:var(--success)">${totalOrders}</td>
                <td style="text-align:right;padding:10px;font-weight:700;border-top:1px solid var(--border);color:${totalFailed > 0 ? "var(--danger)" : "var(--text2)"}">${totalFailed}</td>
                <td style="border-top:1px solid var(--border)"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="notice-box ${allOk ? "info" : "warn"}">
          <span class="notice-icon">${allOk ? "✅" : "⚠️"}</span>
          <div class="notice-text">${allOk ? `<strong>${t("results.multi_all_ok")}</strong>` : `<strong>${t("results.multi_some_errors")}</strong>`}</div>
        </div>`;
    }

    // ── Single account pane (reuses the existing results layout) ──
    function buildAccountPane(r) {
      const accData      = r.data || {};
      const stats        = accData.stats        || {};
      const totalNew     = accData.orders       || 0;
      const products     = accData.productSummary || [];
      const buffer       = accData.buffer;
      const failedOrders = accData.failedOrders || { count: 0, summary: [], failedDir: "", failedPath: "" };
      const runFailed    = !r.success;
      const failReason   = r.error || "";
      const hasFailed    = failedOrders.count > 0;
      const totalInKhod  = (stats.realInTaager || 0) + (stats.missedInTaager || 0);
      const totalDupes   = (stats.realDupe || 0) + (stats.missedDupe || 0);

      const failTitleFn = t("results.fail_title");
      const failTitle   = typeof failTitleFn === "function" ? failTitleFn(failedOrders.count) : failTitleFn;

      const runFailedBanner = runFailed ? `
        <div class="notice-box warn" style="border-color:var(--danger);background:rgba(255,77,109,0.1)">
          <span class="notice-icon">❌</span>
          <div class="notice-text">
            <strong>${t("results.run_failed")}</strong>
            <div style="font-size:12px;color:var(--text2);margin-top:3px">${failReason || t("results.error_occurred")}</div>
          </div>
        </div>` : "";

      const downloadBtn = buffer
        ? `<button class="btn btn-primary" id="acc-btn-download-${r.accountId}">⬇️ ${t("results.download")}</button>`
        : "";
      const downloadFailedBtn = (hasFailed && failedOrders.buffer)
        ? `<button class="btn btn-danger" id="acc-btn-dl-failed-${r.accountId}" style="background:rgba(255,77,109,0.15);border-color:var(--danger);color:var(--danger)">⬇️ ${t("results.download_failed")}</button>`
        : "";

      const productTable = products.length === 0
        ? `<div class="text-muted text-sm">${t("results.no_product")}</div>`
        : `<table class="product-table">
            <thead><tr>
              <th>${t("results.product")}</th>
              <th style="text-align:right">${t("results.orders")}</th>
              <th style="text-align:right">${t("results.total_qty")}</th>
            </tr></thead>
            <tbody>
              ${products.map(p => `<tr>
                <td><div style="font-weight:600">${p.productName || "—"}</div></td>
                <td style="text-align:right"><span class="badge badge-success">${p.count}</span></td>
                <td style="text-align:right;font-weight:700;color:var(--accent)">${p.totalQty}</td>
              </tr>`).join("")}
            </tbody>
            <tfoot><tr>
              <td style="font-weight:700;padding-top:14px;border-top:1px solid var(--border)">${t("results.total")}</td>
              <td style="text-align:right;font-weight:700;padding-top:14px;border-top:1px solid var(--border);color:var(--success)">${totalNew}</td>
              <td style="text-align:right;font-weight:700;padding-top:14px;border-top:1px solid var(--border);color:var(--accent)">${products.reduce((s,p) => s + p.totalQty, 0)}</td>
            </tr></tfoot>
          </table>`;

      return `
        ${runFailedBanner}

        <!-- Download buttons for this account -->
        ${(downloadBtn || downloadFailedBtn) ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${downloadBtn}${downloadFailedBtn}</div>` : ""}

        <!-- Stats -->
        <div class="stats-grid" style="grid-template-columns:repeat(${hasFailed ? 4 : 3},1fr)">
          <div class="stat-card stat-success"><div class="stat-value">${totalNew}</div><div class="stat-label">${t("results.new_orders")}</div></div>
          <div class="stat-card stat-warning"><div class="stat-value">${totalInKhod}</div><div class="stat-label">${t("results.in_khod")}</div></div>
          <div class="stat-card"><div class="stat-value" style="color:var(--text2)">${totalDupes}</div><div class="stat-label">${t("results.dupes")}</div></div>
          ${hasFailed ? `<div class="stat-card" style="background:rgba(255,77,109,0.08);border-color:var(--danger)"><div class="stat-value" style="color:var(--danger)">${failedOrders.count}</div><div class="stat-label" style="color:var(--danger)">${t("results.failed")}</div></div>` : ""}
        </div>

        ${totalNew === 0 ? `
          <div class="card" style="text-align:center;padding:40px">
            <div style="font-size:40px;margin-bottom:12px">🎉</div>
            <div style="font-size:16px;font-weight:700;margin-bottom:6px">${t("results.all_caught")}</div>
            <div class="text-muted">${t("results.no_orders")}</div>
          </div>
        ` : `

          ${hasFailed ? `
          <div style="background:rgba(255,77,109,0.07);border:1px solid var(--danger);border-radius:var(--radius);padding:20px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:36px;height:36px;border-radius:8px;background:rgba(255,77,109,0.15);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">❌</div>
                <div>
                  <div style="font-weight:700;font-size:14px;color:var(--danger)">${failTitle}</div>
                  <div style="font-size:12px;color:var(--text2);margin-top:2px">${t("results.fail_saved")}</div>
                </div>
              </div>
              ${failedOrders.failedDir ? `<button id="acc-btn-open-failed-${r.accountId}" class="btn btn-danger" style="font-size:12px;padding:8px 14px;white-space:nowrap">${t("results.open_folder")}</button>` : ""}
            </div>
            ${failedOrders.errorRows && failedOrders.errorRows.length > 0 ? `
            <div style="overflow-x:auto;margin-top:4px">
              <table style="width:100%;border-collapse:collapse;font-size:11px">
                <thead><tr>${[t("results.row"),t("results.sku"),t("results.phone"),t("results.error")].map(h=>`<th style="text-align:left;padding:5px 8px;border-bottom:1px solid rgba(255,77,109,0.3);color:var(--text2);font-weight:600">${h}</th>`).join("")}</tr></thead>
                <tbody>${failedOrders.errorRows.map(row=>`<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
                  <td style="padding:5px 8px;color:var(--text2)">${row.row||"—"}</td>
                  <td style="padding:5px 8px;font-family:monospace;color:var(--accent)">${row.sku||"—"}</td>
                  <td style="padding:5px 8px;font-family:monospace">${row.phone||"—"}</td>
                  <td style="padding:5px 8px;color:var(--danger);font-weight:600">${row.error||"—"}</td>
                </tr>`).join("")}</tbody>
              </table>
            </div>` : (failedOrders.summary && failedOrders.summary.length > 0 ? `
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${failedOrders.summary.map(f=>`<div style="background:rgba(255,77,109,0.12);border:1px solid rgba(255,77,109,0.3);border-radius:6px;padding:6px 12px;font-size:12px">
                <span style="color:var(--text2)">Product:</span>
                <span style="color:var(--text);font-weight:600;margin-left:4px">${f.productName||"Unknown"}</span>
                <span style="color:var(--danger);font-weight:700;margin-left:8px">${f.count} order${f.count>1?"s":""}</span>
              </div>`).join("")}
            </div>` : "")}
          </div>` : `
          <div class="notice-box info">
            <span class="notice-icon">✅</span>
            <div class="notice-text">${t("results.all_ok")}</div>
          </div>`}

          <!-- Source breakdown -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="card">
              <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">${t("results.from_real")}</div>
              <div style="font-size:28px;font-weight:800;color:var(--text);margin-bottom:2px">${stats.realNew||0}</div>
              <div class="text-sm text-muted">${t("results.new_unique")}</div>
            </div>
            <div class="card">
              <div style="font-size:11px;font-weight:700;color:var(--accent2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">${t("results.from_missed")}</div>
              <div style="font-size:28px;font-weight:800;color:var(--text);margin-bottom:2px">${stats.missedNew||0}</div>
              <div class="text-sm text-muted">${t("results.new_unique")}</div>
            </div>
          </div>

          <!-- Product table -->
          <div class="card" style="flex:1">
            <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">${t("results.by_product")}</div>
            ${productTable}
          </div>
        `}`;
    }

    // ── Render active pane into #res-pane-content ──
    function renderPane() {
      const wrap = document.getElementById("res-pane-content");
      if (!wrap) return;
      if (selectedPane === "__all__") {
        wrap.innerHTML = buildOverviewPane();
      } else {
        const r = accountResults.find(x => x.accountId === selectedPane);
        if (r) {
          wrap.innerHTML = buildAccountPane(r);
          // Wire download buttons
          const accId = r.accountId;
          document.getElementById(`acc-btn-download-${accId}`)?.addEventListener("click", async () => {
            const dateTag  = dateFrom.replace(/-/g,"");
            const filename = `khod-orders-${r.accountLabel || accId}-${dateTag}.xlsx`;
            const result   = await window.api.saveOutputFile({ buffer: r.data?.buffer, filename });
            if (result.saved) showToast(`✅ Saved to ${result.path}`);
          });
          document.getElementById(`acc-btn-dl-failed-${accId}`)?.addEventListener("click", async () => {
            const dateTag  = dateFrom.replace(/-/g,"");
            const filename = `failed-orders-${r.accountLabel || accId}-${dateTag}-${_runTimeTag}.xlsx`;
            const result   = await window.api.saveOutputFile({ buffer: r.data?.failedOrders?.buffer, filename });
            if (result.saved) showToast(`✅ Saved to ${result.path}`);
          });
          document.getElementById(`acc-btn-open-failed-${accId}`)?.addEventListener("click", () => {
            if (r.data?.failedOrders?.failedDir) window.api.openFolder(r.data.failedOrders.failedDir);
          });
        }
      }
    }

    // ── Refresh dropdown ──
    function refreshDropdown() {
      const lbl  = document.getElementById("res-dd-trigger-label");
      const opts = document.getElementById("res-dd-options");
      if (lbl)  lbl.textContent = buildTriggerLabel();
      if (opts) {
        opts.innerHTML = buildDropdownOptions();
        opts.querySelectorAll(".res-dd-item").forEach(item => {
          item.addEventListener("click", () => {
            selectedPane = item.dataset.pane;
            opts.style.display = "none";
            refreshDropdown();
            renderPane();
          });
        });
      }
    }

    const allOk = accountResults.every(r => r.success);
    const overallIcon = allOk ? "✅" : "⚠️";

    el.innerHTML = `
      <div class="page-wrap"><div class="page-inner" style="display:flex;flex-direction:column;gap:16px">

        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <div class="page-title" style="font-size:20px">${overallIcon} Results — ${dateDisplay}</div>
            <div class="text-muted text-sm">${t("results.completed")} · ${accountResults.length} accounts</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-ghost" id="btn-home">${t("results.home")}</button>
            <button class="btn btn-ghost" id="btn-run-again">${t("results.run_again")}</button>
          </div>
        </div>

        <!-- Dropdown -->
        <style>
          .res-dd-item { display:flex;align-items:center;gap:8px;padding:10px 16px;font-size:13px;font-weight:500;color:var(--text1);cursor:pointer;transition:background 0.15s; }
          .res-dd-item:hover { background:rgba(124,106,247,0.1); }
          .res-dd-active { background:rgba(124,106,247,0.15) !important;color:var(--accent);font-weight:700; }
        </style>
        <div style="position:relative;z-index:100" id="res-dd-wrap">
          <button id="res-dd-trigger" style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:10px 16px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text1);font-size:13px;font-weight:600;cursor:pointer;transition:border-color 0.2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            <span id="res-dd-trigger-label">${t("results.all_accounts")}</span>
            <span style="color:var(--text2);font-size:11px;margin-left:8px">▾</span>
          </button>
          <div id="res-dd-options" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
            ${buildDropdownOptions()}
          </div>
        </div>

        <!-- Pane content -->
        <div id="res-pane-content" style="display:flex;flex-direction:column;gap:12px"></div>

      </div></div>
    `;

    // Initial pane render
    renderPane();
    refreshDropdown();

    // Wire dropdown toggle
    document.getElementById("res-dd-trigger").addEventListener("click", () => {
      const opts = document.getElementById("res-dd-options");
      if (opts) opts.style.display = opts.style.display === "none" ? "block" : "none";
    });
    document.addEventListener("click", function _resDDClose(e) {
      if (!document.getElementById("res-dd-wrap")?.contains(e.target)) {
        const opts = document.getElementById("res-dd-options");
        if (opts) opts.style.display = "none";
      }
    });

    document.getElementById("btn-home")?.addEventListener("click", onHome);
    document.getElementById("btn-run-again")?.addEventListener("click", onRunAgain);
    return; // multi-account path ends here
  }

  // ─────────────────────────────────────
  // SINGLE ACCOUNT — original layout (untouched)
  // ─────────────────────────────────────
  const stats        = data.stats        || {};
  const totalNew     = data.orders       || 0;
  const products     = data.productSummary || [];
  const buffer       = data.buffer;
  const failedOrders = data.failedOrders || { count: 0, summary: [], failedDir: "", failedPath: "" };
  const runFailed    = data._runFailed   || false;
  const failReason   = data._failReason  || "";

  const totalInKhod = (stats.realInTaager || 0) + (stats.missedInTaager || 0);
  const totalDupes  = (stats.realDupe     || 0) + (stats.missedDupe     || 0);
  const hasFailed   = failedOrders.count > 0;

  const titleFn = t("results.title");
  const title   = typeof titleFn === "function" ? titleFn(dateDisplay) : titleFn;
  const failTitleFn = t("results.fail_title");
  const failTitle   = typeof failTitleFn === "function" ? failTitleFn(failedOrders.count) : failTitleFn;

  const runFailedBanner = runFailed ? `
    <div class="notice-box warn" style="border-color:var(--danger);background:rgba(255,77,109,0.1);margin-bottom:0">
      <span class="notice-icon">❌</span>
      <div class="notice-text">
        <strong>${t("results.run_failed")}</strong>
        <div style="font-size:12px;color:var(--text2);margin-top:3px">${failReason || t("results.error_occurred")}</div>
      </div>
    </div>` : "";

  el.innerHTML = `
    <div class="page-wrap"><div class="page-inner" style="display:flex;flex-direction:column;gap:16px">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="page-title" style="font-size:20px">${runFailed ? "❌" : hasFailed ? "⚠️" : "✅"} ${title}</div>
          <div class="text-muted text-sm">${t("results.completed")}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost" id="btn-home">${t("results.home")}</button>
          <button class="btn btn-ghost" id="btn-run-again">${t("results.run_again")}</button>
          ${hasFailed && failedOrders.buffer ? `<button class="btn btn-danger" id="btn-download-failed" style="background:rgba(255,77,109,0.15);border-color:var(--danger);color:var(--danger)">${t("results.download_failed")}</button>` : ""}
          ${buffer ? `<button class="btn btn-primary" id="btn-download">${t("results.download")}</button>` : ""}
        </div>
      </div>

      ${runFailedBanner}

      <!-- Stats grid -->
      <div class="stats-grid" style="grid-template-columns:repeat(${hasFailed ? 4 : 3},1fr)">
        <div class="stat-card stat-success">
          <div class="stat-value">${totalNew}</div>
          <div class="stat-label">${t("results.new_orders")}</div>
        </div>
        <div class="stat-card stat-warning">
          <div class="stat-value">${totalInKhod}</div>
          <div class="stat-label">${t("results.in_khod")}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--text2)">${totalDupes}</div>
          <div class="stat-label">${t("results.dupes")}</div>
        </div>
        ${hasFailed ? `
        <div class="stat-card" style="background:rgba(255,77,109,0.08);border-color:var(--danger)">
          <div class="stat-value" style="color:var(--danger)">${failedOrders.count}</div>
          <div class="stat-label" style="color:var(--danger)">${t("results.failed")}</div>
        </div>` : ""}
      </div>

      ${totalNew === 0 ? `
        <div class="card" style="text-align:center;padding:40px">
          <div style="font-size:40px;margin-bottom:12px">🎉</div>
          <div style="font-size:16px;font-weight:700;margin-bottom:6px">${t("results.all_caught")}</div>
          <div class="text-muted">${t("results.no_orders")}</div>
        </div>
      ` : `

        ${hasFailed ? `
        <div style="background:rgba(255,77,109,0.07);border:1px solid var(--danger);border-radius:var(--radius);padding:20px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:36px;height:36px;border-radius:8px;background:rgba(255,77,109,0.15);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">❌</div>
              <div>
                <div style="font-weight:700;font-size:14px;color:var(--danger)">${failTitle}</div>
                <div style="font-size:12px;color:var(--text2);margin-top:2px">${t("results.fail_saved")}</div>
              </div>
            </div>
            ${failedOrders.failedDir ? `
            <button id="btn-open-failed-folder" class="btn btn-danger" style="font-size:12px;padding:8px 14px;white-space:nowrap">
              ${t("results.open_folder")}
            </button>` : ""}
          </div>
          ${failedOrders.errorRows && failedOrders.errorRows.length > 0 ? `
          <div style="overflow-x:auto;margin-top:4px">
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <thead>
                <tr>
                  ${[t("results.row"), t("results.sku"), t("results.phone"), t("results.error")].map(h => `<th style="text-align:left;padding:5px 8px;border-bottom:1px solid rgba(255,77,109,0.3);color:var(--text2);font-weight:600">${h}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${failedOrders.errorRows.map(r => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
                    <td style="padding:5px 8px;color:var(--text2)">${r.row || "—"}</td>
                    <td style="padding:5px 8px;font-family:monospace;color:var(--accent)">${r.sku || "—"}</td>
                    <td style="padding:5px 8px;font-family:monospace">${r.phone || "—"}</td>
                    <td style="padding:5px 8px;color:var(--danger);font-weight:600">${r.error || "—"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>` : (failedOrders.summary && failedOrders.summary.length > 0 ? `
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${failedOrders.summary.map(f => `
              <div style="background:rgba(255,77,109,0.12);border:1px solid rgba(255,77,109,0.3);border-radius:6px;padding:6px 12px;font-size:12px">
                <span style="color:var(--text2)">Product:</span>
                <span style="color:var(--text);font-weight:600;margin-left:4px">${f.productName || "Unknown"}</span>
                <span style="color:var(--danger);font-weight:700;margin-left:8px">${f.count} order${f.count > 1 ? "s" : ""}</span>
              </div>
            `).join("")}
          </div>` : "")}
        </div>
        ` : `
        <div class="notice-box info">
          <span class="notice-icon">✅</span>
          <div class="notice-text">${t("results.all_ok")}</div>
        </div>
        `}

        <!-- Source breakdown -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="card">
            <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">${t("results.from_real")}</div>
            <div style="font-size:28px;font-weight:800;color:var(--text);margin-bottom:2px">${stats.realNew || 0}</div>
            <div class="text-sm text-muted">${t("results.new_unique")}</div>
          </div>
          <div class="card">
            <div style="font-size:11px;font-weight:700;color:var(--accent2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">${t("results.from_missed")}</div>
            <div style="font-size:28px;font-weight:800;color:var(--text);margin-bottom:2px">${stats.missedNew || 0}</div>
            <div class="text-sm text-muted">${t("results.new_unique")}</div>
          </div>
        </div>

        <!-- Product breakdown table -->
        <div class="card" style="flex:1">
          <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">
            ${t("results.by_product")}
          </div>
          ${products.length === 0 ? `<div class="text-muted text-sm">${t("results.no_product")}</div>` : `
            <table class="product-table">
              <thead>
                <tr>
                  <th>${t("results.product")}</th>
                  <th style="text-align:right">${t("results.orders")}</th>
                  <th style="text-align:right">${t("results.total_qty")}</th>
                </tr>
              </thead>
              <tbody>
                ${products.map((p) => `
                  <tr>
                    <td><div style="font-weight:600">${p.productName || "—"}</div></td>
                    <td style="text-align:right"><span class="badge badge-success">${p.count}</span></td>
                    <td style="text-align:right;font-weight:700;color:var(--accent)">${p.totalQty}</td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td style="font-weight:700;padding-top:14px;border-top:1px solid var(--border)">${t("results.total")}</td>
                  <td style="text-align:right;font-weight:700;padding-top:14px;border-top:1px solid var(--border);color:var(--success)">${totalNew}</td>
                  <td style="text-align:right;font-weight:700;padding-top:14px;border-top:1px solid var(--border);color:var(--accent)">
                    ${products.reduce((s, p) => s + p.totalQty, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          `}
        </div>
      `}

    </div></div>
  `;

  document.getElementById("btn-home")?.addEventListener("click", onHome);
  document.getElementById("btn-run-again")?.addEventListener("click", onRunAgain);

  document.getElementById("btn-download-failed")?.addEventListener("click", async () => {
    const dateTag  = dateFrom.replace(/-/g, "");
    const accTag   = (data._accountLabel || "").replace(/[^a-zA-Z0-9@._-]/g, "_") || "account";
    const filename = `failed-orders-${accTag}-${dateTag}-${_runTimeTag}.xlsx`;
    const result   = await window.api.saveOutputFile({ buffer: failedOrders.buffer, filename });
    if (result.saved) showToast(`✅ Saved to ${result.path}`);
  });

  document.getElementById("btn-open-failed-folder")?.addEventListener("click", () => {
    if (failedOrders.failedDir) window.api.openFolder(failedOrders.failedDir);
  });

  if (buffer) {
    document.getElementById("btn-download")?.addEventListener("click", async () => {
      const dateTag  = dateFrom.replace(/-/g, "");
      const filename = `khod-orders-${dateTag}.xlsx`;
      const result   = await window.api.saveOutputFile({ buffer, filename });
      if (result.saved) showToast(`✅ Saved to ${result.path}`);
    });
  }
};

// ── Toast ──
function showToast(msg) {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;
    background:var(--bg2);border:1px solid var(--border);
    border-radius:var(--radius-sm);padding:12px 18px;
    font-size:13px;color:var(--text);
    box-shadow:0 4px 20px rgba(0,0,0,.4);
    z-index:9999;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
