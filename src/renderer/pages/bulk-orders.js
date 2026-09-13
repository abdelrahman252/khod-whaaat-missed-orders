(function () {
  "use strict";

  const state = {
    open: false,
    accounts: [],
    accountId: "",
    sourceMode: "canceled",
    files: [],
    columns: {},
    inspection: null,
    products: [],
    selectedProductKeys: [],
    productQuery: "",
    customerPage: 1,
    orderPage: 1,
    tablePageSize: 25,
    scroll: {},
    orderCount: 10,
    dateFrom: "",
    dateTo: "",
    preview: null,
    seed: 0,
    running: false,
    fetching: false,
    inspecting: false,
    result: null,
    logs: [],
    progress: null,
    authenticated: false,
    authEmail: "",
    authPassword: "",
    authError: "",
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }


  function spinnerHtml(label) {
    return `<span class="bo-btn-busy"><span class="bo-spinner" aria-hidden="true"></span><span>${esc(label)}</span></span>`;
  }

  function isBusy() {
    return !!(state.running || state.fetching || state.productLoading || state.previewing || state.inspecting || state.authenticating);
  }
  function ensureStyles() {
    if (document.getElementById("bulk-orders-style")) return;
    const style = document.createElement("style");
    style.id = "bulk-orders-style";
    style.textContent = `
      .bo-overlay{position:fixed;inset:0;z-index:90000;background:rgba(7,10,18,.78);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:24px;color:var(--text)}
      .bo-panel{width:min(1280px,calc(100vw - 36px));height:min(850px,calc(100vh - 36px));background:var(--bg);border:1px solid var(--border);border-radius:8px;box-shadow:0 28px 80px rgba(0,0,0,.52);display:grid;grid-template-rows:auto 1fr;overflow:hidden}
      .bo-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid var(--border);background:var(--bg2)}
      .bo-title{font-size:18px;font-weight:800}.bo-sub{font-size:12px;color:var(--text2);margin-top:3px}
      .bo-workflow{display:grid;grid-template-columns:minmax(360px,430px) 1fr;min-height:0}.bo-steps{border-inline-end:1px solid var(--border);padding:14px;display:flex;flex-direction:column;gap:10px;overflow:auto}.bo-review{padding:14px;display:flex;flex-direction:column;gap:10px;overflow:auto;min-width:0}
      .bo-step{border:1px solid var(--border);border-radius:8px;background:var(--bg2);padding:12px;display:flex;flex-direction:column;gap:10px;min-width:0}.bo-step-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.bo-step-title{display:flex;align-items:center;gap:8px;min-width:0;font-size:13px;font-weight:800;color:var(--text)}.bo-step-num{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:999px;background:rgba(45,212,191,.12);border:1px solid rgba(45,212,191,.34);color:var(--text);font-size:12px;font-weight:900}.bo-step-meta{font-size:11px;color:var(--text2);white-space:nowrap}
      .bo-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.bo-field{display:flex;flex-direction:column;gap:7px;min-width:0}.bo-label{font-size:11px;font-weight:800;color:var(--text2);text-transform:uppercase;letter-spacing:.05em}.bo-file-name{font-size:12px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .bo-select,.bo-file,.bo-input{width:100%;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);padding:10px;font:inherit;font-size:13px;outline:none}.bo-input:focus,.bo-select:focus,.bo-file:focus{border-color:rgba(45,212,191,.55)}
      .bo-spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.22);border-top-color:#2dd4bf;border-radius:999px;animation:bo-spin .75s linear infinite;vertical-align:-2px}.bo-btn-busy,.bo-inline-busy{display:inline-flex;align-items:center;justify-content:center;gap:8px}.bo-loading-line{display:flex;align-items:center;gap:9px;padding:14px;color:var(--text2);font-size:12px}.bo-loading-box{border:1px solid var(--border);border-radius:8px;background:var(--bg);padding:12px;color:var(--text2);font-size:12px}.bo-loading-box strong{display:flex;align-items:center;gap:8px;color:var(--text);font-size:13px;margin-bottom:4px}@keyframes bo-spin{to{transform:rotate(360deg)}}
      .bo-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.bo-status{border:1px solid var(--border);border-radius:8px;background:var(--bg);padding:11px;font-size:12px;color:var(--text2);line-height:1.5}.bo-status strong{display:block;color:var(--text);font-size:13px;margin-bottom:3px}.bo-status.is-error{border-color:rgba(255,77,109,.45);background:rgba(255,77,109,.08)}.bo-status.is-ok{border-color:rgba(34,197,94,.36);background:rgba(34,197,94,.08)}.bo-status.is-warn{border-color:rgba(245,158,11,.42);background:rgba(245,158,11,.08)}
      .bo-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.bo-stat{border:1px solid var(--border);border-radius:8px;background:var(--bg2);padding:10px;min-width:0}.bo-stat strong{display:block;font-size:18px;color:var(--text);line-height:1.1}.bo-stat span{display:block;font-size:11px;color:var(--text2);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .bo-product-picker{border:1px solid var(--border);border-radius:8px;background:var(--bg);overflow:hidden}.bo-product-top{display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px;border-bottom:1px solid var(--border);align-items:center}.bo-product-count{border:1px solid var(--border);border-radius:999px;padding:8px 10px;font-size:12px;font-weight:800;color:var(--text);white-space:nowrap;background:var(--bg2)}.bo-product-tools{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 10px 10px;border-bottom:1px solid var(--border)}
      .bo-selected-products{display:flex;flex-wrap:wrap;gap:6px;padding:9px 10px;border-bottom:1px solid var(--border);min-height:44px}.bo-chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;border:1px solid var(--border);border-radius:999px;background:var(--bg2);padding:6px 8px;font-size:11px;color:var(--text)}.bo-chip span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:235px}.bo-chip button{border:0;background:transparent;color:var(--text2);font:inherit;font-weight:900;cursor:pointer;padding:0 2px}.bo-chip-empty{font-size:12px;color:var(--text2);align-self:center}
      .bo-product-list{max-height:260px;overflow:auto}.bo-product{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px;border-bottom:1px solid var(--border);font-size:12px;cursor:pointer}.bo-product:last-child{border-bottom:none}.bo-product:hover{background:rgba(255,255,255,.035)}.bo-product input{width:16px;height:16px}.bo-product-name{display:block;min-width:0;color:var(--text);font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bo-product-sku{display:block;font-size:11px;color:var(--text2);direction:ltr;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bo-product-price{font-size:12px;color:var(--text);font-weight:800;direction:ltr;white-space:nowrap}.bo-empty{padding:16px;color:var(--text2);font-size:12px}
      .bo-table-wrap{border:1px solid var(--border);border-radius:8px;overflow:auto;background:var(--bg2);min-height:145px}.bo-table{width:100%;border-collapse:collapse;font-size:12px;min-width:960px}.bo-table th,.bo-table td{padding:9px 10px;border-bottom:1px solid var(--border);text-align:start;white-space:nowrap}.bo-table th{font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.05em;background:rgba(255,255,255,.03);position:sticky;top:0}.bo-pager{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 2px 0;font-size:12px;color:var(--text2)}.bo-pager-actions{display:flex;gap:6px}.bo-pager button{min-width:70px}
      .bo-log{font-family:var(--font-mono,monospace);font-size:11px;direction:ltr;text-align:left;unicode-bidi:plaintext;white-space:pre-wrap;max-height:150px;overflow:auto}.bo-progress{height:8px;border-radius:999px;background:var(--border);overflow:hidden}.bo-progress span{display:block;height:100%;background:linear-gradient(90deg,#00d4aa,#4fa8e8);width:0%;transition:width .25s}
      .bo-auth-panel{width:min(360px,calc(100vw - 42px));background:var(--bg);border:1px solid var(--border);border-radius:8px;box-shadow:0 28px 80px rgba(0,0,0,.52);padding:18px;display:flex;flex-direction:column;gap:10px}.bo-auth-input{width:100%;border:1px solid var(--border);border-radius:8px;background:var(--bg2);color:var(--text);padding:12px 13px;font:inherit;font-size:14px;outline:none}.bo-auth-input:focus{border-color:rgba(45,212,191,.65)}.bo-auth-error{min-height:18px;color:var(--danger,#ff4d6d);font-size:12px}
      @media (max-width:980px){.bo-workflow{grid-template-columns:1fr}.bo-steps{border-inline-end:none;border-bottom:1px solid var(--border)}.bo-panel{height:calc(100vh - 24px);width:calc(100vw - 24px)}.bo-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function dateKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  function currentMonthRange() {
    const today = new Date();
    const cleanToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const from = new Date(cleanToday.getFullYear(), cleanToday.getMonth(), 1);
    return { dateFrom: dateKey(from), dateTo: dateKey(cleanToday) };
  }

  function ensureDateRange() {
    if (state.dateFrom && state.dateTo) return;
    const range = currentMonthRange();
    state.dateFrom = state.dateFrom || range.dateFrom;
    state.dateTo = state.dateTo || range.dateTo;
  }

  function getSelectedAccountId() {
    const select = document.getElementById("bo-account");
    return select ? select.value : state.accountId;
  }

  function productKey(product) {
    return String(product && (product.key || product.sku) || "").trim();
  }

  function productName(product) {
    return String(product && (product.name || product.productName || product.sku) || "").trim();
  }

  function selectedProducts() {
    const keys = new Set(state.selectedProductKeys);
    return state.products.filter((product) => keys.has(productKey(product)));
  }

  function filteredProducts(limit = 140) {
    const query = state.productQuery.trim().toLowerCase();
    return state.products.filter((product) => {
      if (!query) return true;
      return String(productName(product) + " " + (product.sku || "")).toLowerCase().includes(query);
    }).slice(0, limit);
  }

  function setProductSelected(key, selected) {
    const cleanKey = String(key || "").trim();
    if (!cleanKey) return;
    const keys = new Set(state.selectedProductKeys);
    if (selected) keys.add(cleanKey);
    else keys.delete(cleanKey);
    state.selectedProductKeys = Array.from(keys);
    resetPlan();
  }
  function clampPage(page, totalRows) {
    const pages = Math.max(1, Math.ceil(Number(totalRows || 0) / state.tablePageSize));
    return Math.min(Math.max(1, Math.round(Number(page) || 1)), pages);
  }

  function pagedRows(rows, page) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const currentPage = clampPage(page, safeRows.length);
    const start = (currentPage - 1) * state.tablePageSize;
    return {
      rows: safeRows.slice(start, start + state.tablePageSize),
      page: currentPage,
      pages: Math.max(1, Math.ceil(safeRows.length / state.tablePageSize)),
      start,
      total: safeRows.length,
    };
  }

  function pagerHtml(kind, pageInfo) {
    if (!pageInfo || pageInfo.total <= state.tablePageSize) return "";
    const from = pageInfo.total ? pageInfo.start + 1 : 0;
    const to = Math.min(pageInfo.start + state.tablePageSize, pageInfo.total);
    return `<div class="bo-pager"><span>${esc(from)}-${esc(to)} of ${esc(pageInfo.total)}</span><div class="bo-pager-actions"><button class="btn btn-ghost" type="button" data-bo-page="${esc(kind)}" data-bo-page-dir="-1" ${pageInfo.page <= 1 ? "disabled" : ""}>Prev</button><button class="btn btn-ghost" type="button" data-bo-page="${esc(kind)}" data-bo-page-dir="1" ${pageInfo.page >= pageInfo.pages ? "disabled" : ""}>Next</button></div></div>`;
  }
  function canBuild() {
    const validation = state.inspection && state.inspection.khodValidation;
    return !!(!isBusy() && state.inspection && state.inspection.success && !(validation && validation.needsFetch) && selectedProducts().length && Number(state.orderCount) > 0);
  }

  function resetPlan() {
    state.preview = null;
    state.result = null;
    state.progress = null;
    state.seed = 0;
  }

  function statusHtml() {
    if (state.running) {
      const p = state.progress;
      const pct = p && p.total ? Math.round((p.current / p.total) * 100) : 0;
      return `<div class="bo-status"><strong>Running recovery upload</strong>${p ? `${p.current} / ${p.total} orders, success ${p.success || 0}, failed ${p.failed || 0}` : "Starting EasyOrders..."}<div class="bo-progress" style="margin-top:10px"><span style="width:${pct}%"></span></div></div>`;
    }
    if (state.result) {
      const data = state.result.data || {};
      const failed = data.failedOrders && data.failedOrders.count ? data.failedOrders.count : 0;
      return `<div class="bo-status ${state.result.success ? "is-ok" : "is-error"}"><strong>${state.result.success ? "Finished" : "Failed"}</strong>${state.result.success ? `${data.orders || 0} uploaded, ${failed} failed.` : esc(state.result.error || "Run failed.")}</div>`;
    }
    if (state.fetching) return `<div class="bo-status"><strong>Fetching KHOD validation</strong>Exporting KHOD orders for ${esc(state.dateFrom)} to ${esc(state.dateTo)}.</div>`;
    if (state.inspecting) return `<div class="bo-status"><strong>Reading sheets</strong>Finding canceled-by-you rows and normalizing Saudi phones.</div>`;
    if (state.inspection && !state.inspection.success) {
      const first = state.inspection.errors && state.inspection.errors[0];
      return `<div class="bo-status is-error"><strong>Sheet needs mapping</strong>${esc(first ? first.message : "Could not parse uploaded sheets.")}</div>`;
    }
    if (state.inspection) {
      const validation = state.inspection.khodValidation || {};
      const noun = state.sourceMode === "phone-list" ? "matched row(s)" : "canceled row(s)";
      const khodSkipped = Number(state.inspection.khodPhonesSkipped || 0);
      const skippedText = [
        khodSkipped > 0 ? `${khodSkipped} phone(s) already in KHOD skipped` : "",
      ].filter(Boolean).join(". ");
      if (validation.needsFetch) {
        const last = validation.lastFetchRange && validation.lastFetchRange.dateFrom ? ` Last fetched ${validation.lastFetchRange.dateFrom} to ${validation.lastFetchRange.dateTo}.` : "";
        return `<div class="bo-status is-warn"><strong>KHOD validation needed</strong>Fetch KHOD range ${esc(validation.dateFrom || state.dateFrom)} to ${esc(validation.dateTo || state.dateTo)} before preview/run.${esc(last)}</div>`;
      }
      const validationText = ` KHOD checked ${Number(validation.phones || 0)} phone(s) from ${Number(validation.rows || 0)} row(s).`;
      return `<div class="bo-status is-ok"><strong>Customers ready</strong>${esc(state.inspection.uniqueCustomers || 0)} available customers from ${esc(state.inspection.totalMatchedRows || state.inspection.totalCanceledRows || 0)} ${noun}.${esc(skippedText ? " " + skippedText + "." : "")}${esc(validationText)}</div>`;
    }
    return `<div class="bo-status"><strong>Canceled order recovery</strong>Use canceled-status sheets or any phone/name sheet, then choose KHOD products and run.</div>`;
  }

  function statsHtml() {
    const i = state.inspection || {};
    return `<div class="bo-stats">
      <div class="bo-stat"><strong>${esc(i.totalMatchedRows || i.totalCanceledRows || 0)}</strong><span>${state.sourceMode === "phone-list" ? "Matched rows" : "Canceled rows"}</span></div>
      <div class="bo-stat"><strong>${esc(i.uniqueCustomers || 0)}</strong><span>Unique phones</span></div>
      <div class="bo-stat"><strong>${esc(i.duplicatePhones || 0)}</strong><span>Duplicate phones</span></div>
      <div class="bo-stat"><strong>${esc(i.khodPhonesSkipped || 0)}</strong><span>Already in KHOD</span></div>
      <div class="bo-stat"><strong>${esc(selectedProducts().length)}</strong><span>Selected products</span></div>
    </div>`;
  }

  function productListHtml() {
    const selected = new Set(state.selectedProductKeys);
    const list = filteredProducts(160);
    const selectedRows = selectedProducts();
    if (!state.products.length) {
      return `<div class="bo-product-picker"><div class="bo-empty">No KHOD products loaded for this range.</div></div>`;
    }
    return `<div class="bo-product-picker">
      <div class="bo-product-top"><input class="bo-input" id="bo-product-search" value="${esc(state.productQuery)}" placeholder="Search SKU or product name" /><span class="bo-product-count">${esc(selected.size)} selected</span></div>
      <div class="bo-product-tools"><button class="btn btn-ghost" id="bo-select-visible" type="button" ${!list.length ? "disabled" : ""}>Select shown</button><button class="btn btn-ghost" id="bo-clear-products" type="button" ${!selected.size ? "disabled" : ""}>Clear</button></div>
      <div class="bo-selected-products">${selectedRows.length ? selectedRows.slice(0, 10).map((product) => {
        const key = productKey(product);
        const title = `${product.sku || key} - ${productName(product)}`;
        return `<span class="bo-chip" title="${esc(title)}"><span title="${esc(title)}">${esc(product.sku || key)} - ${esc(productName(product))}</span><button type="button" data-bo-remove-product="${esc(key)}" title="Remove ${esc(title)}">x</button></span>`;
      }).join("") + (selectedRows.length > 10 ? `<span class="bo-chip" title="${esc(selectedRows.slice(10).map((product) => `${product.sku || productKey(product)} - ${productName(product)}`).join("\n"))}"><span>+${esc(selectedRows.length - 10)} more</span></span>` : "") : `<span class="bo-chip-empty">No products selected</span>`}</div>
      <div class="bo-product-list">${list.length ? list.map((product) => {
        const key = productKey(product);
        const title = `${product.sku || key} - ${productName(product)} | qty ${product.qty || 1} | refs ${product.sampleCount || 0} | ${product.subtotal || 0} SAR`;
        return `<label class="bo-product" title="${esc(title)}">
          <input type="checkbox" data-bo-product="${esc(key)}" ${selected.has(key) ? "checked" : ""} />
          <span style="min-width:0"><span class="bo-product-name" title="${esc(title)}">${esc(product.sku || key)} - ${esc(productName(product))}</span><span class="bo-product-sku" title="${esc(title)}">qty ${esc(product.qty || 1)} | refs ${esc(product.sampleCount || 0)}</span></span>
          <span class="bo-product-price" title="${esc(title)}">${esc(product.subtotal || 0)} SAR</span>
        </label>`;
      }).join("") : `<div class="bo-empty">No matching products.</div>`}</div>
    </div>`;
  }
  function mappingHtml() {
    const summary = state.inspection && state.inspection.fileSummaries && state.inspection.fileSummaries[0];
    const headers = summary && Array.isArray(summary.headers) ? summary.headers : [];
    if (!headers.length) return "";
    const fields = [
      ...(state.sourceMode === "phone-list" ? [] : [["status", "Status"]]),
      ["phone", "Phone"],
      ["name", "Name"],
      ["city", "City"],
      ["address", "Address"],
    ];
    const options = (selected) => `<option value="">Auto</option>${headers.map((header, index) => `<option value="${index}" ${String(selected) === String(index) ? "selected" : ""}>${esc(header || ("Column " + (index + 1)))}</option>`).join("")}`;
    return `<div class="bo-status"><strong>Column mapping</strong><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${fields.map(([field, label]) => `<label class="bo-field"><span class="bo-label">${esc(label)}</span><select class="bo-select" data-bo-column="${esc(field)}">${options(state.columns[field])}</select></label>`).join("")}</div></div>`;
  }

  function customersTable() {
    const allRows = state.inspection && Array.isArray(state.inspection.customers) ? state.inspection.customers : [];
    const pageInfo = pagedRows(allRows, state.customerPage);
    state.customerPage = pageInfo.page;
    const rows = pageInfo.rows;
    if (!rows.length) return `<div class="bo-table-wrap"><div style="padding:18px;color:var(--text2);font-size:13px">No customers extracted yet.</div></div>`;
    return `<div><div class="bo-table-wrap"><table class="bo-table"><thead><tr><th>File</th><th>Row</th><th>Customer</th><th>Phone</th><th>City</th><th>Address</th><th>Status</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.fileName || "")}</td><td>${esc(row.row || "")}</td><td>${esc(row.name || "")}</td><td>${esc(row.phone || "")}</td><td>${esc(row.city || "")}</td><td>${esc(row.address || "")}</td><td>${esc(row.status || "")}</td></tr>`).join("")}</tbody></table></div>${pagerHtml("customers", pageInfo)}</div>`;
  }
  function ordersTable() {
    const allRows = state.preview && Array.isArray(state.preview.previewRows) ? state.preview.previewRows : [];
    const pageInfo = pagedRows(allRows, state.orderPage);
    state.orderPage = pageInfo.page;
    const rows = pageInfo.rows;
    if (!rows.length) return `<div class="bo-table-wrap"><div style="padding:18px;color:var(--text2);font-size:13px">Preview will appear here.</div></div>`;
    return `<div><div class="bo-table-wrap"><table class="bo-table"><thead><tr><th>Customer</th><th>Phone</th><th>Product</th><th>SKU</th><th>Qty</th><th>Total</th><th>City</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.name || "")}</td><td>${esc(row.phone || "")}</td><td>${esc(row.productName || "")}</td><td>${esc(row.sku || "")}</td><td>${esc(row.qty || "")}</td><td>${esc(row.subtotal || "")}</td><td>${esc(row.city || "")}</td></tr>`).join("")}</tbody></table></div>${pagerHtml("orders", pageInfo)}</div>`;
  }
  function issuesHtml() {
    const inspection = state.inspection;
    if (!inspection) return "";
    const items = [...(inspection.errors || []), ...(inspection.warnings || [])].slice(0, 24);
    if (!items.length) return "";
    return `<div class="bo-status ${inspection.errors && inspection.errors.length ? "is-error" : "is-warn"}"><strong>Review notes</strong>${items.map(item => `${esc(item.fileName || "")} Row ${esc(item.row)}: ${esc(item.message)}`).join("<br>")}</div>`;
  }

  function captureScrollState() {
    const overlay = document.getElementById("bulk-orders-overlay");
    if (!overlay) return;
    const steps = overlay.querySelector(".bo-steps");
    const review = overlay.querySelector(".bo-review");
    const products = overlay.querySelector(".bo-product-list");
    state.scroll = {
      stepsTop: steps ? steps.scrollTop : state.scroll.stepsTop || 0,
      stepsLeft: steps ? steps.scrollLeft : state.scroll.stepsLeft || 0,
      reviewTop: review ? review.scrollTop : state.scroll.reviewTop || 0,
      reviewLeft: review ? review.scrollLeft : state.scroll.reviewLeft || 0,
      productsTop: products ? products.scrollTop : state.scroll.productsTop || 0,
      productsLeft: products ? products.scrollLeft : state.scroll.productsLeft || 0,
    };
  }

  function restoreScrollState() {
    const saved = state.scroll || {};
    requestAnimationFrame(() => {
      const overlay = document.getElementById("bulk-orders-overlay");
      if (!overlay || !state.open || !state.authenticated) return;
      const steps = overlay.querySelector(".bo-steps");
      const review = overlay.querySelector(".bo-review");
      const products = overlay.querySelector(".bo-product-list");
      if (steps) {
        steps.scrollTop = saved.stepsTop || 0;
        steps.scrollLeft = saved.stepsLeft || 0;
      }
      if (review) {
        review.scrollTop = saved.reviewTop || 0;
        review.scrollLeft = saved.reviewLeft || 0;
      }
      if (products) {
        products.scrollTop = saved.productsTop || 0;
        products.scrollLeft = saved.productsLeft || 0;
      }
    });
  }
  function render() {
    ensureStyles();
    let overlay = document.getElementById("bulk-orders-overlay");
    const shouldRestoreScroll = !!(overlay && state.authenticated);
    if (shouldRestoreScroll) captureScrollState();
    if (!state.open) {
      if (overlay) overlay.remove();
      return;
    }
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "bulk-orders-overlay";
      overlay.className = "bo-overlay";
      document.body.appendChild(overlay);
    }
    if (!state.authenticated) {
      overlay.innerHTML = `<form class="bo-auth-panel" id="bo-auth-form" autocomplete="off"><input class="bo-auth-input" id="bo-auth-email" type="email" placeholder="Email" value="${esc(state.authEmail)}" autocomplete="off" /><input class="bo-auth-input" id="bo-auth-password" type="password" placeholder="Password" autocomplete="off" /><button class="btn btn-primary" id="bo-auth-submit" type="submit" ${state.authenticating ? "disabled" : ""}>${state.authenticating ? spinnerHtml("Opening") : "Open"}</button><div class="bo-auth-error">${esc(state.authError)}</div></form>`;
      document.getElementById("bo-auth-form")?.addEventListener("submit", submitAuth);
      document.getElementById("bo-auth-email")?.focus();
      return;
    }
    overlay.innerHTML = `<div class="bo-panel" role="dialog" aria-modal="true" aria-label="Canceled Order Recovery">
      <div class="bo-head"><div><div class="bo-title">Canceled Order Recovery</div><div class="bo-sub">KHOD validation, uploaded customers, selected products</div></div><button class="btn btn-ghost" id="bo-close" type="button">Close</button></div>
      <div class="bo-workflow">
        <div class="bo-steps">
          <section class="bo-step"><div class="bo-step-head"><div class="bo-step-title"><span class="bo-step-num">1</span><span>KHOD validation</span></div><span class="bo-step-meta">${esc(state.dateFrom)} - ${esc(state.dateTo)}</span></div>
            <div class="bo-field"><div class="bo-label">Account</div><select class="bo-select" id="bo-account">${state.accounts.map(acc => `<option value="${esc(acc.id)}" ${acc.id === state.accountId ? "selected" : ""}>${esc(acc.label || acc.easyEmail || acc.id)}</option>`).join("")}</select></div>
            <div class="bo-grid-2"><label class="bo-field"><span class="bo-label">KHOD from</span><input class="bo-input" id="bo-date-from" type="date" value="${esc(state.dateFrom)}" /></label><label class="bo-field"><span class="bo-label">KHOD to</span><input class="bo-input" id="bo-date-to" type="date" value="${esc(state.dateTo)}" /></label></div>
            <div class="bo-actions"><button class="btn btn-ghost" id="bo-load-products" type="button" ${isBusy() ? "disabled" : ""}>${state.productLoading ? spinnerHtml("Loading") : "Load Saved"}</button><button class="btn btn-primary" id="bo-fetch-products" type="button" ${isBusy() ? "disabled" : ""}>${state.fetching ? spinnerHtml("Fetching") : "Fetch KHOD Range"}</button></div>
            ${statusHtml()}
          </section>
          <section class="bo-step"><div class="bo-step-head"><div class="bo-step-title"><span class="bo-step-num">2</span><span>Customer sheet</span></div><span class="bo-step-meta">${esc(state.files.length || 0)} file(s)</span></div>
            <div class="bo-grid-2"><div class="bo-field"><div class="bo-label">Sheet mode</div><select class="bo-select" id="bo-source-mode"><option value="canceled" ${state.sourceMode === "canceled" ? "selected" : ""}>Canceled status</option><option value="phone-list" ${state.sourceMode === "phone-list" ? "selected" : ""}>Phone list</option></select></div><div class="bo-field"><div class="bo-label">Orders to create</div><input class="bo-input" id="bo-count" type="number" min="1" max="${esc(state.inspection?.uniqueCustomers || 9999)}" value="${esc(state.orderCount || 10)}" /></div></div>
            <div class="bo-field"><div class="bo-label">Sheets</div><input class="bo-file" id="bo-files" type="file" accept=".xlsx,.xls,.csv" multiple ${isBusy() ? "disabled" : ""} /><div class="bo-file-name">${esc(state.files.length ? state.files.map(f => f.name).join(", ") : "No sheets selected")}</div></div>
            ${mappingHtml()}
          </section>
          <section class="bo-step"><div class="bo-step-head"><div class="bo-step-title"><span class="bo-step-num">3</span><span>Products</span></div><span class="bo-step-meta">${esc(selectedProducts().length)} selected</span></div>${productListHtml()}</section>
          <section class="bo-step"><div class="bo-step-head"><div class="bo-step-title"><span class="bo-step-num">4</span><span>Preview and run</span></div><span class="bo-step-meta">${esc(state.orderCount || 0)} order(s)</span></div><div class="bo-actions"><button class="btn btn-ghost" id="bo-preview" type="button" ${!canBuild() || state.previewing || state.running ? "disabled" : ""}>${state.previewing ? spinnerHtml("Previewing") : "Preview"}</button><button class="btn btn-primary" id="bo-run" type="button" ${!canBuild() || state.previewing || state.running ? "disabled" : ""}>${state.running ? spinnerHtml("Running") : "Run"}</button></div></section>
        </div>
        <div class="bo-review">${statsHtml()}<div class="bo-status"><strong>Extracted customers</strong>${customersTable()}</div><div class="bo-status"><strong>Randomized order preview</strong>${ordersTable()}</div>${issuesHtml()}<div class="bo-status"><strong>Live log</strong><div class="bo-log" id="bo-log">${esc(state.logs.slice(-90).join("\n"))}</div></div></div>
      </div>
    </div>`;
    wireControls();
    if (shouldRestoreScroll) restoreScrollState();
  }

  function wireControls() {
    document.getElementById("bo-close")?.addEventListener("click", closeBulkOrders);
    document.getElementById("bo-files")?.addEventListener("change", onFilesSelected);
    document.getElementById("bo-load-products")?.addEventListener("click", loadProducts);
    document.getElementById("bo-fetch-products")?.addEventListener("click", fetchProducts);
    document.getElementById("bo-preview")?.addEventListener("click", buildPreview);
    document.getElementById("bo-run")?.addEventListener("click", runRecoveryOrders);
    const dateFrom = document.getElementById("bo-date-from");
    const dateTo = document.getElementById("bo-date-to");
    const onDateChange = async () => {
      state.dateFrom = dateFrom && dateFrom.value || state.dateFrom;
      state.dateTo = dateTo && dateTo.value || state.dateTo;
      resetPlan();
      if (state.files.length) await inspectSelectedSheets();
      else render();
    };
    dateFrom?.addEventListener("change", onDateChange);
    dateTo?.addEventListener("change", onDateChange);
    const select = document.getElementById("bo-account");
    if (select) {
      select.value = state.accountId;
      select.addEventListener("change", async () => {
        state.accountId = select.value;
        state.products = [];
        state.selectedProductKeys = [];
        resetPlan();
        if (state.files.length) await inspectSelectedSheets();
        else render();
      });
    }
    const sourceMode = document.getElementById("bo-source-mode");
    if (sourceMode) {
      sourceMode.addEventListener("change", async () => {
        state.sourceMode = sourceMode.value === "phone-list" ? "phone-list" : "canceled";
        delete state.columns.status;
        resetPlan();
        if (state.files.length) await inspectSelectedSheets();
        else render();
      });
    }
    const search = document.getElementById("bo-product-search");
    if (search) search.addEventListener("input", () => {
      const cursor = search.selectionStart;
      state.productQuery = search.value;
      render();
      requestAnimationFrame(() => {
        const next = document.getElementById("bo-product-search");
        if (!next) return;
        next.focus();
        try { next.setSelectionRange(cursor, cursor); } catch (_) {}
      });
    });
    document.getElementById("bo-select-visible")?.addEventListener("click", () => {
      const keys = new Set(state.selectedProductKeys);
      filteredProducts(160).forEach((product) => keys.add(productKey(product)));
      state.selectedProductKeys = Array.from(keys).filter(Boolean);
      resetPlan();
      render();
    });
    document.getElementById("bo-clear-products")?.addEventListener("click", () => {
      state.selectedProductKeys = [];
      resetPlan();
      render();
    });
    document.querySelectorAll("[data-bo-remove-product]").forEach((button) => {
      button.addEventListener("click", () => {
        setProductSelected(button.getAttribute("data-bo-remove-product"), false);
        render();
      });
    });
    const count = document.getElementById("bo-count");
    if (count) count.addEventListener("input", () => { state.orderCount = Math.max(1, Math.round(Number(count.value) || 1)); resetPlan(); render(); });
    document.querySelectorAll("[data-bo-product]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        setProductSelected(checkbox.getAttribute("data-bo-product"), checkbox.checked);
        render();
      });
    });
    document.querySelectorAll("[data-bo-page]").forEach((button) => {
      button.addEventListener("click", () => {
        const kind = button.getAttribute("data-bo-page");
        const dir = Number(button.getAttribute("data-bo-page-dir") || 0);
        if (kind === "customers") state.customerPage = clampPage(state.customerPage + dir, state.inspection && state.inspection.customers && state.inspection.customers.length);
        if (kind === "orders") state.orderPage = clampPage(state.orderPage + dir, state.preview && state.preview.previewRows && state.preview.previewRows.length);
        render();
      });
    });
    document.querySelectorAll("[data-bo-column]").forEach((select) => {
      select.addEventListener("change", async () => {
        const field = select.getAttribute("data-bo-column");
        if (select.value === "") delete state.columns[field];
        else state.columns[field] = Number(select.value);
        resetPlan();
        await inspectSelectedSheets();
      });
    });
    const logEl = document.getElementById("bo-log");
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
  }

  async function loadAccounts() {
    const creds = await window.api.getCredentials();
    const accounts = Array.isArray(creds.accounts) && creds.accounts.length ? creds.accounts.filter(acc => acc && acc.accountType !== "static") : [];
    if (!accounts.length && creds.easyEmail) accounts.push({ id: "legacy", label: "Account 1", easyEmail: creds.easyEmail, khodCountry: creds.khodCountry || "sa" });
    state.accounts = accounts.map(acc => ({ id: acc.id || "legacy", label: acc.memberName || acc.label || acc.easyEmail || acc.easyStore || acc.id || "Account", khodCountry: acc.khodCountry || "sa" }));
    if (!state.accountId || !state.accounts.some(acc => acc.id === state.accountId)) state.accountId = state.accounts[0] ? state.accounts[0].id : "";
  }

  async function openBulkOrders() {
    if (window._botIsRunning || state.running) return;
    const configured = await window.api.isBulkOrderAccessConfigured().catch(() => null);
    if (!configured || configured.configured !== true) return;
    state.open = true;
    state.authenticated = false;
    state.authPassword = "";
    state.authError = "";
    state.result = null;
    state.logs = [];
    ensureDateRange();
    render();
  }

  async function submitAuth(event) {
    event.preventDefault();
    state.authEmail = document.getElementById("bo-auth-email")?.value || "";
    state.authPassword = document.getElementById("bo-auth-password")?.value || "";
    state.authError = "";
    render();
    try {
      const result = await window.api.verifyBulkOrderAccess({ email: state.authEmail, password: state.authPassword });
      if (!result || result.success !== true) {
        state.authError = result && result.error === "BULK_ORDERS_LOCK_NOT_CONFIGURED" ? "Not configured" : "Invalid";
        state.authPassword = "";
        render();
        return;
      }
      state.authenticated = true;
      state.authPassword = "";
      await loadAccounts().catch((err) => state.logs.push("Could not load accounts: " + (err && err.message ? err.message : err)));
      state.products = [];
      state.selectedProductKeys = [];
      state.logs.push("Choose Load Saved or Fetch KHOD Range to load products.");
      render();
    } catch (err) {
      state.authError = "Invalid";
      state.authPassword = "";
      render();
    }
  }

  function closeBulkOrders() {
    if (state.running || state.fetching) return;
    state.open = false;
    render();
  }

  function readFileAsBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, buffer: Array.from(new Uint8Array(reader.result)) });
      reader.onerror = () => reject(new Error("Could not read " + file.name));
      reader.readAsArrayBuffer(file);
    });
  }

  async function onFilesSelected(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    state.inspecting = true;
    state.files = [];
    state.columns = {};
    state.inspection = null;
    resetPlan();
    render();
    try {
      state.files = await Promise.all(files.map(readFileAsBuffer));
      await inspectSelectedSheets();
    } catch (err) {
      state.inspection = { success: false, errors: [{ row: 0, message: err.message }], warnings: [] };
    } finally {
      state.inspecting = false;
      render();
    }
  }

  async function inspectSelectedSheets() {
    if (!state.files.length) return;
    state.inspecting = true;
    render();
    try {
      const result = await window.api.inspectRecoverySheets({ accountId: getSelectedAccountId(), files: state.files, columns: state.columns, mode: state.sourceMode, dateFrom: state.dateFrom, dateTo: state.dateTo });
      state.inspection = result;
      if (result && result.uniqueCustomers && (!state.orderCount || state.orderCount > result.uniqueCustomers)) state.orderCount = Math.min(10, result.uniqueCustomers);
      resetPlan();
    } catch (err) {
      state.inspection = { success: false, errors: [{ row: 0, message: err.message }], warnings: [] };
    } finally {
      state.inspecting = false;
      render();
    }
  }

  async function loadProducts() {
    ensureDateRange();
    const result = await window.api.getRecoveryProducts({ accountId: getSelectedAccountId(), dateFrom: state.dateFrom, dateTo: state.dateTo });
    if (!result || result.success === false) {
      state.products = [];
      state.logs.push("Could not load products: " + (result && result.error ? result.error : "unknown"));
    } else {
      state.products = result.products || [];
      const available = new Set(state.products.map(product => product.key || product.sku));
      state.selectedProductKeys = state.selectedProductKeys.filter(key => available.has(key));
      if (!state.selectedProductKeys.length && state.products[0]) state.selectedProductKeys = [state.products[0].key || state.products[0].sku];
      state.logs.push(`Loaded ${state.products.length} SKU products from saved KHOD data for ${state.dateFrom} to ${state.dateTo}.`);
    }
    resetPlan();
    render();
  }

  async function fetchProducts() {
    if (state.fetching) return;
    state.fetching = true;
    resetPlan();
    ensureDateRange();
    const range = { dateFrom: state.dateFrom, dateTo: state.dateTo };
    state.logs.push(`Fetching KHOD validation/products ${range.dateFrom} to ${range.dateTo}...`);
    render();
    try {
      const fetchRes = await window.api.runDashboardFetch({ accountId: getSelectedAccountId(), dateFrom: range.dateFrom, dateTo: range.dateTo });
      if (!fetchRes || !fetchRes.success) state.logs.push("KHOD product fetch failed: " + (fetchRes && fetchRes.error ? fetchRes.error : "unknown"));
      else {
        state.logs.push(`KHOD validation fetch saved ${fetchRes.rows || 0} rows.`);
        await loadProducts();
        if (state.files.length) await inspectSelectedSheets();
      }
    } catch (err) {
      state.logs.push("KHOD product fetch failed: " + (err && err.message ? err.message : err));
    } finally {
      state.fetching = false;
      render();
    }
  }

  function recoveryPayload() {
    return { accountId: getSelectedAccountId(), files: state.files, products: selectedProducts(), count: Math.max(1, Math.round(Number(state.orderCount) || 1)), seed: state.seed || Date.now(), mode: state.sourceMode, columns: state.columns, dateFrom: state.dateFrom, dateTo: state.dateTo };
  }

  async function buildPreview() {
    if (!canBuild()) return;
    state.seed = Date.now();
    state.preview = null;
    state.result = null;
    render();
    try {
      const result = await window.api.previewRecoveryOrders(recoveryPayload());
      state.preview = result;
      if (!result || !result.success) state.logs.push("Preview failed: " + (result && result.error ? result.error : "unknown"));
    } catch (err) {
      state.logs.push("Preview failed: " + (err && err.message ? err.message : err));
    }
    render();
  }

  async function runRecoveryOrders() {
    if (!canBuild() || state.running) return;
    if (!state.seed) state.seed = Date.now();
    state.running = true;
    state.result = null;
    state.progress = null;
    state.logs.push("Starting canceled-order recovery upload...");
    render();
    try {
      state.result = await window.api.runRecoveryOrders(recoveryPayload());
    } catch (err) {
      state.result = { success: false, error: err && err.message ? err.message : String(err || "Unknown error") };
    } finally {
      state.running = false;
      render();
    }
  }

  function installListeners() {
    if (window.__bulkOrdersListenersInstalled) return;
    window.__bulkOrdersListenersInstalled = true;
    window.api.onBotLog((msg) => {
      if (!state.open) return;
      state.logs.push(String(msg || ""));
      render();
    });
    window.api.onOrderProgress((data) => {
      if (!state.open) return;
      state.progress = data || null;
      render();
    });
  }

  function installHiddenTriggers() {
    installListeners();
    document.addEventListener("click", (event) => {
      const btn = event.target && event.target.closest ? event.target.closest(".sv3-report-btn") : null;
      if (!btn || !event.altKey || !event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openBulkOrders();
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.open && !state.running && !state.fetching) {
        event.preventDefault();
        closeBulkOrders();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && String(event.key || "").toLowerCase() === "b") {
        event.preventDefault();
        openBulkOrders();
      }
    });
  }

  window.openBulkOrders = openBulkOrders;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installHiddenTriggers);
  else installHiddenTriggers();
})();

/* Legacy one-sheet bulk uploader retained below, disabled by the recovery builder above.
(function () {
  "use strict";

  const state = {
    open: false,
    accounts: [],
    fileName: "",
    fileBuffer: null,
    inspection: null,
    sampleRows: [],
    accountId: "",
    running: false,
    result: null,
    logs: [],
    progress: null,
    authenticated: false,
    authEmail: "",
    authPassword: "",
    authError: "",
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }


  function spinnerHtml(label) {
    return `<span class="bo-btn-busy"><span class="bo-spinner" aria-hidden="true"></span><span>${esc(label)}</span></span>`;
  }

  function isBusy() {
    return !!(state.running || state.fetching || state.productLoading || state.previewing || state.inspecting || state.authenticating);
  }
  function ensureStyles() {
    if (document.getElementById("bulk-orders-style")) return;
    const style = document.createElement("style");
    style.id = "bulk-orders-style";
    style.textContent = `
      .bo-overlay{position:fixed;inset:0;z-index:90000;background:rgba(7,10,18,.78);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:28px;color:var(--text)}
      .bo-panel{width:min(1040px,calc(100vw - 42px));height:min(740px,calc(100vh - 42px));background:var(--bg);border:1px solid var(--border);border-radius:8px;box-shadow:0 28px 80px rgba(0,0,0,.52);display:grid;grid-template-rows:auto 1fr;overflow:hidden}
      .bo-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid var(--border);background:var(--bg2)}
      .bo-title{font-size:18px;font-weight:800}
      .bo-sub{font-size:12px;color:var(--text2);margin-top:3px}
      .bo-body{display:grid;grid-template-columns:310px 1fr;min-height:0}
      .bo-side{border-inline-end:1px solid var(--border);padding:16px;display:flex;flex-direction:column;gap:14px;overflow:auto}
      .bo-main{padding:16px;display:flex;flex-direction:column;gap:12px;overflow:auto;min-width:0}
      .bo-field{display:flex;flex-direction:column;gap:7px}
      .bo-label{font-size:11px;font-weight:800;color:var(--text2);text-transform:uppercase;letter-spacing:.05em}
      .bo-select,.bo-file{width:100%;border:1px solid var(--border);border-radius:8px;background:var(--bg2);color:var(--text);padding:10px;font:inherit;font-size:13px}
      .bo-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .bo-status{border:1px solid var(--border);border-radius:8px;background:var(--bg2);padding:12px;font-size:12px;color:var(--text2);line-height:1.5}
      .bo-status strong{display:block;color:var(--text);font-size:13px;margin-bottom:3px}
      .bo-status.is-error{border-color:rgba(255,77,109,.45);background:rgba(255,77,109,.08)}
      .bo-status.is-ok{border-color:rgba(34,197,94,.36);background:rgba(34,197,94,.08)}
      .bo-table-wrap{border:1px solid var(--border);border-radius:8px;overflow:auto;background:var(--bg2);min-height:160px}
      .bo-table{width:100%;border-collapse:collapse;font-size:12px;min-width:720px}
      .bo-table th,.bo-table td{padding:9px 10px;border-bottom:1px solid var(--border);text-align:start;white-space:nowrap}
      .bo-table th{font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.05em;background:rgba(255,255,255,.03);position:sticky;top:0}
      .bo-log{font-family:var(--font-mono,monospace);font-size:11px;direction:ltr;text-align:left;unicode-bidi:plaintext;white-space:pre-wrap;max-height:160px;overflow:auto}
      .bo-progress{height:8px;border-radius:999px;background:var(--border);overflow:hidden}
      .bo-progress span{display:block;height:100%;background:linear-gradient(90deg,#00d4aa,#4fa8e8);width:0%;transition:width .25s}
      .bo-auth-panel{width:min(360px,calc(100vw - 42px));background:var(--bg);border:1px solid var(--border);border-radius:8px;box-shadow:0 28px 80px rgba(0,0,0,.52);padding:18px;display:flex;flex-direction:column;gap:10px}
      .bo-auth-input{width:100%;border:1px solid var(--border);border-radius:8px;background:var(--bg2);color:var(--text);padding:12px 13px;font:inherit;font-size:14px;outline:none}
      .bo-auth-input:focus{border-color:rgba(124,106,247,.65)}
      .bo-auth-error{min-height:18px;color:var(--danger,#ff4d6d);font-size:12px}
      @media (max-width:820px){.bo-body{grid-template-columns:1fr}.bo-side{border-inline-end:none;border-bottom:1px solid var(--border)}.bo-panel{height:calc(100vh - 24px);width:calc(100vw - 24px)}}
    `;
    document.head.appendChild(style);
  }

  function getSelectedAccountId() {
    const select = document.getElementById("bo-account");
    return select ? select.value : state.accountId;
  }

  function statusHtml() {
    if (state.running) {
      const p = state.progress;
      const pct = p && p.total ? Math.round((p.current / p.total) * 100) : 0;
      return `
        <div class="bo-status">
          <strong>Running upload</strong>
          ${p ? `${p.current} / ${p.total} orders, success ${p.success || 0}, failed ${p.failed || 0}` : "Starting EasyOrders..."}
          <div class="bo-progress" style="margin-top:10px"><span style="width:${pct}%"></span></div>
        </div>`;
    }
    if (state.result) {
      const data = state.result.data || {};
      const failed = data.failedOrders && data.failedOrders.count ? data.failedOrders.count : 0;
      return `<div class="bo-status ${state.result.success ? "is-ok" : "is-error"}"><strong>${state.result.success ? "Finished" : "Failed"}</strong>${state.result.success ? `${data.orders || 0} uploaded, ${failed} failed.` : esc(state.result.error || "Run failed.")}</div>`;
    }
    if (state.inspection) {
      if (!state.inspection.success) {
        return `<div class="bo-status is-error"><strong>Sheet needs fixes</strong>${state.inspection.errors.length} error(s). Fix the rows below before running.</div>`;
      }
      return `<div class="bo-status is-ok"><strong>Sheet ready</strong>${state.inspection.total} order(s) parsed. Warnings: ${state.inspection.warnings.length}.</div>`;
    }
    return `<div class="bo-status"><strong>Hidden bulk order uploader</strong>Upload the template sheet, select one EasyOrders account, review rows, then run.</div>`;
  }

  function rowsTable(rows) {
    if (!rows || !rows.length) {
      return `<div class="bo-table-wrap"><div style="padding:18px;color:var(--text2);font-size:13px">No rows to preview yet.</div></div>`;
    }
    return `
      <div class="bo-table-wrap">
        <table class="bo-table">
          <thead><tr><th>Row</th><th>Product</th><th>SKU</th><th>Qty</th><th>Total</th><th>Customer</th><th>Phone</th><th>City</th></tr></thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td>${esc(row.row || "")}</td>
                <td>${esc(row.productName || "")}</td>
                <td>${esc(row.sku || "")}</td>
                <td>${esc(row.qty || "")}</td>
                <td>${esc(row.subtotal || "")}</td>
                <td>${esc(row.name || "")}</td>
                <td>${esc(row.phone || "")}</td>
                <td>${esc(row.city || "")}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function issuesHtml() {
    const inspection = state.inspection;
    if (!inspection) return "";
    const items = [...(inspection.errors || []), ...(inspection.warnings || [])].slice(0, 30);
    if (!items.length) return "";
    return `
      <div class="bo-status ${inspection.errors.length ? "is-error" : ""}">
        <strong>Review notes</strong>
        ${items.map(item => `Row ${esc(item.row)}: ${esc(item.message)}`).join("<br>")}
      </div>`;
  }

  function captureScrollState() {
    const overlay = document.getElementById("bulk-orders-overlay");
    if (!overlay) return;
    const steps = overlay.querySelector(".bo-steps");
    const review = overlay.querySelector(".bo-review");
    const products = overlay.querySelector(".bo-product-list");
    state.scroll = {
      stepsTop: steps ? steps.scrollTop : state.scroll.stepsTop || 0,
      stepsLeft: steps ? steps.scrollLeft : state.scroll.stepsLeft || 0,
      reviewTop: review ? review.scrollTop : state.scroll.reviewTop || 0,
      reviewLeft: review ? review.scrollLeft : state.scroll.reviewLeft || 0,
      productsTop: products ? products.scrollTop : state.scroll.productsTop || 0,
      productsLeft: products ? products.scrollLeft : state.scroll.productsLeft || 0,
    };
  }

  function restoreScrollState() {
    const saved = state.scroll || {};
    requestAnimationFrame(() => {
      const overlay = document.getElementById("bulk-orders-overlay");
      if (!overlay || !state.open || !state.authenticated) return;
      const steps = overlay.querySelector(".bo-steps");
      const review = overlay.querySelector(".bo-review");
      const products = overlay.querySelector(".bo-product-list");
      if (steps) {
        steps.scrollTop = saved.stepsTop || 0;
        steps.scrollLeft = saved.stepsLeft || 0;
      }
      if (review) {
        review.scrollTop = saved.reviewTop || 0;
        review.scrollLeft = saved.reviewLeft || 0;
      }
      if (products) {
        products.scrollTop = saved.productsTop || 0;
        products.scrollLeft = saved.productsLeft || 0;
      }
    });
  }
  function render() {
    ensureStyles();
    let overlay = document.getElementById("bulk-orders-overlay");
    const shouldRestoreScroll = !!(overlay && state.authenticated);
    if (shouldRestoreScroll) captureScrollState();
    if (!state.open) {
      if (overlay) overlay.remove();
      return;
    }
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "bulk-orders-overlay";
      overlay.className = "bo-overlay";
      document.body.appendChild(overlay);
    }

    if (!state.authenticated) {
      overlay.innerHTML = `
        <form class="bo-auth-panel" id="bo-auth-form" autocomplete="off">
          <input class="bo-auth-input" id="bo-auth-email" type="email" placeholder="Email" value="${esc(state.authEmail)}" autocomplete="off" />
          <input class="bo-auth-input" id="bo-auth-password" type="password" placeholder="Password" autocomplete="off" />
          <button class="btn btn-primary" id="bo-auth-submit" type="submit" ${state.authenticating ? "disabled" : ""}>${state.authenticating ? spinnerHtml("Opening") : "Open"}</button>
          <div class="bo-auth-error">${esc(state.authError)}</div>
        </form>`;
      document.getElementById("bo-auth-form")?.addEventListener("submit", submitAuth);
      document.getElementById("bo-auth-email")?.focus();
      return;
    }

    const previewRows = state.inspection ? state.inspection.previewRows : state.sampleRows;
    overlay.innerHTML = `
      <div class="bo-panel" role="dialog" aria-modal="true" aria-label="Bulk Orders">
        <div class="bo-head">
          <div>
            <div class="bo-title">Bulk Orders</div>
            <div class="bo-sub">Internal direct EasyOrders uploader</div>
          </div>
          <button class="btn btn-ghost" id="bo-close" type="button">Close</button>
        </div>
        <div class="bo-body">
          <div class="bo-side">
            <div class="bo-field">
              <div class="bo-label">Account</div>
              <select class="bo-select" id="bo-account">
                ${state.accounts.map(acc => `<option value="${esc(acc.id)}" ${acc.id === state.accountId ? "selected" : ""}>${esc(acc.label || acc.easyEmail || acc.id)}</option>`).join("")}
              </select>
            </div>
            <div class="bo-field">
              <div class="bo-label">Sheet</div>
              <input class="bo-file" id="bo-file" type="file" accept=".xlsx,.xls,.csv" />
              <div style="font-size:12px;color:var(--text2)">${esc(state.fileName || "No sheet selected")}</div>
            </div>
            <div class="bo-actions">
              <button class="btn btn-ghost" id="bo-review-sample" type="button">Review Sample</button>
              <button class="btn btn-ghost" id="bo-download-sample" type="button">Download</button>
            </div>
            <button class="btn btn-primary" id="bo-run" type="button" ${state.running || !state.accountId || !state.fileBuffer || !state.inspection || !state.inspection.success ? "disabled" : ""}>Run</button>
            ${statusHtml()}
          </div>
          <div class="bo-main">
            ${rowsTable(previewRows)}
            ${issuesHtml()}
            <div class="bo-status">
              <strong>Live log</strong>
              <div class="bo-log" id="bo-log">${esc(state.logs.slice(-80).join("\n"))}</div>
            </div>
          </div>
        </div>
      </div>`;

    const select = document.getElementById("bo-account");
    if (select && state.accounts[0]) {
      if (!state.accountId) state.accountId = state.accounts[0].id;
      select.value = state.accountId;
      select.addEventListener("change", async () => {
        state.accountId = select.value;
        if (state.fileBuffer) await inspectSelectedSheet();
      });
    }
    document.getElementById("bo-close")?.addEventListener("click", closeBulkOrders);
    document.getElementById("bo-review-sample")?.addEventListener("click", reviewSample);
    document.getElementById("bo-download-sample")?.addEventListener("click", downloadSample);
    document.getElementById("bo-file")?.addEventListener("change", onFileSelected);
    document.getElementById("bo-run")?.addEventListener("click", runBulkOrders);
    const logEl = document.getElementById("bo-log");
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
  }

  async function loadAccounts() {
    const creds = await window.api.getCredentials();
    const accounts = Array.isArray(creds.accounts) && creds.accounts.length
      ? creds.accounts.filter(acc => acc && acc.accountType !== "static")
      : [];
    if (!accounts.length && creds.easyEmail) {
      accounts.push({ id: "legacy", label: "Account 1", easyEmail: creds.easyEmail, khodCountry: creds.khodCountry || "sa" });
    }
    state.accounts = accounts.map(acc => ({
      id: acc.id || "legacy",
      label: acc.memberName || acc.label || acc.easyEmail || acc.easyStore || acc.id || "Account",
      khodCountry: acc.khodCountry || "sa",
    }));
    if (!state.accountId || !state.accounts.some(acc => acc.id === state.accountId)) {
      state.accountId = state.accounts[0] ? state.accounts[0].id : "";
    }
  }

  async function openBulkOrders() {
    if (window._botIsRunning || state.running) return;
    state.open = true;
    state.authenticated = false;
    state.authPassword = "";
    state.authError = "";
    state.result = null;
    state.logs = [];
    render();
  }

  async function submitAuth(event) {
    event.preventDefault();
    const emailInput = document.getElementById("bo-auth-email");
    const passwordInput = document.getElementById("bo-auth-password");
    state.authEmail = emailInput ? emailInput.value : "";
    state.authPassword = passwordInput ? passwordInput.value : "";
    state.authError = "";
    render();
    try {
      const result = await window.api.verifyBulkOrderAccess({
        email: state.authEmail,
        password: state.authPassword,
      });
      if (!result || result.success !== true) {
        state.authError = result && result.error === "BULK_ORDERS_LOCK_NOT_CONFIGURED"
          ? "Not configured"
          : "Invalid";
        state.authPassword = "";
        render();
        return;
      }
      state.authenticated = true;
      state.authPassword = "";
      await loadAccounts().catch((err) => {
        state.logs.push("Could not load accounts: " + (err && err.message ? err.message : err));
      });
      render();
    } catch (err) {
      state.authError = "Invalid";
      state.authPassword = "";
      render();
    }
  }

  function closeBulkOrders() {
    if (state.running) return;
    state.open = false;
    render();
  }

  async function reviewSample() {
    const sample = await window.api.getBulkOrderSample();
    state.sampleRows = sample.previewRows || [];
    state.inspection = null;
    state.result = null;
    render();
  }

  async function downloadSample() {
    const sample = await window.api.getBulkOrderSample();
    await window.api.saveOutputFile({ buffer: sample.buffer, filename: sample.filename || "bulk-orders-sample.xlsx" });
  }

  function onFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      state.fileName = file.name;
      state.fileBuffer = Array.from(new Uint8Array(reader.result));
      state.result = null;
      state.logs = [];
      await inspectSelectedSheet();
    };
    reader.onerror = () => {
      state.logs.push("Could not read selected sheet.");
      render();
    };
    reader.readAsArrayBuffer(file);
  }

  async function inspectSelectedSheet() {
    if (!state.fileBuffer) return;
    state.inspection = await window.api.inspectBulkOrderSheet({
      accountId: getSelectedAccountId(),
      buffer: state.fileBuffer,
    });
    render();
  }

  async function runBulkOrders() {
    if (!state.fileBuffer || state.running) return;
    state.running = true;
    state.result = null;
    state.progress = null;
    state.logs.push("Starting bulk order upload...");
    render();
    try {
      state.result = await window.api.runBulkOrderSheet({
        accountId: getSelectedAccountId(),
        buffer: state.fileBuffer,
      });
    } catch (err) {
      state.result = { success: false, error: err && err.message ? err.message : String(err || "Unknown error") };
    } finally {
      state.running = false;
      render();
    }
  }

  function installListeners() {
    if (window.__bulkOrdersListenersInstalled) return;
    window.__bulkOrdersListenersInstalled = true;
    window.api.onBotLog((msg) => {
      if (!state.open) return;
      state.logs.push(String(msg || ""));
      render();
    });
    window.api.onOrderProgress((data) => {
      if (!state.open) return;
      state.progress = data || null;
      render();
    });
  }

  function installHiddenTriggers() {
    installListeners();
    document.addEventListener("click", (event) => {
      const btn = event.target && event.target.closest ? event.target.closest(".sv3-report-btn") : null;
      if (!btn || !event.altKey || !event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openBulkOrders();
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.open && !state.running) {
        event.preventDefault();
        closeBulkOrders();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && String(event.key || "").toLowerCase() === "b") {
        event.preventDefault();
        openBulkOrders();
      }
    });
  }

  window.openBulkOrders = openBulkOrders;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installHiddenTriggers);
  } else {
    installHiddenTriggers();
  }
})();
*/
