// ── RESULTS PAGE ──
window.renderResults = function (data, dateFrom, dateTo, onRunAgain, onHome) {
  const el = document.getElementById("page-results");
  const t  = window._t;
  const dateDisplay = dateFrom === dateTo ? dateFrom : `${dateFrom} → ${dateTo}`;

  const stats        = data.stats        || {};
  const totalNew     = data.orders       || 0;
  const products     = data.productSummary || [];
  const buffer       = data.buffer;
  const failedOrders = data.failedOrders || { count: 0, summary: [], failedDir: "", failedPath: "" };

  const totalInKhod = (stats.realInTaager || 0) + (stats.missedInTaager || 0);
  const totalDupes  = (stats.realDupe     || 0) + (stats.missedDupe     || 0);
  const hasFailed   = failedOrders.count > 0;

  const titleFn = t("results.title");
  const title   = typeof titleFn === "function" ? titleFn(dateDisplay) : titleFn;
  const failTitleFn = t("results.fail_title");
  const failTitle   = typeof failTitleFn === "function" ? failTitleFn(failedOrders.count) : failTitleFn;

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;padding:24px;gap:16px;overflow-y:auto">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="page-title" style="font-size:20px">${hasFailed ? "⚠️" : "✅"} ${title}</div>
          <div class="text-muted text-sm">${t("results.completed")}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost" id="btn-home">${t("results.home")}</button>
          <button class="btn btn-ghost" id="btn-run-again">${t("results.run_again")}</button>
          ${hasFailed && failedOrders.buffer ? `<button class="btn btn-danger" id="btn-download-failed" style="background:rgba(255,77,109,0.15);border-color:var(--danger);color:var(--danger)">${t("results.download_failed")}</button>` : ""}
          ${buffer ? `<button class="btn btn-primary" id="btn-download">${t("results.download")}</button>` : ""}
        </div>
      </div>

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

    </div>
  `;

  document.getElementById("btn-home")?.addEventListener("click", onHome);
  document.getElementById("btn-run-again")?.addEventListener("click", onRunAgain);

  document.getElementById("btn-download-failed")?.addEventListener("click", async () => {
    const dateTag  = dateFrom.replace(/-/g, "");
    const filename = `failed-orders-${dateTag}.xlsx`;
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
