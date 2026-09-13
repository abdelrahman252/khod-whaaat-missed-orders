// KHOD WHAAT dashboard product-name overrides.
// KHOD WHAAT exports SKU data; merchant edits here are read through window.KhodStatus.productName(row).
(function () {
  "use strict";
  var KEY = "khod_product_name_map_v1";
  var LEGACY_KEY = "taager_product_name_map_v1";
  function read() {
    try {
      var raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || "{}";
      return JSON.parse(raw) || {};
    } catch (_) { return {}; }
  }
  function write(map) {
    try { localStorage.setItem(KEY, JSON.stringify(map || {})); } catch (_) {}
  }
  var cache = read();
  window.KhodProductNames = {
    get: function (sku) {
      var key = String(sku || "").trim();
      return key ? String(cache[key] || "").trim() : "";
    },
    set: function (sku, name) {
      var key = String(sku || "").trim();
      if (!key) return;
      var value = String(name || "").trim();
      if (value) cache[key] = value; else delete cache[key];
      write(cache);
      window.dispatchEvent(new CustomEvent("khod-product-names-change", { detail: { sku: key, name: value } }));
    },
    all: function () { return Object.assign({}, cache); }
  };
  window.addEventListener("storage", function (event) {
    if (event && (event.key === KEY || event.key === LEGACY_KEY)) cache = read();
  });
})();
