(function () {
  "use strict";

  var SUPPORT_PHONE_E164 = "201129965148";
  var SUPPORT_MESSAGE = "Hi, I need help with KHOD WHAAT Orders. My issue is:";

  function messageFrom(options) {
    if (typeof options === "string" && options.trim()) return options.trim();
    if (options && typeof options.message === "string" && options.message.trim()) {
      return options.message.trim();
    }
    return SUPPORT_MESSAGE;
  }

  function supportUrl(options) {
    return "https://wa.me/" + SUPPORT_PHONE_E164 + "?text=" + encodeURIComponent(messageFrom(options) + " ");
  }

  function openSupport(options) {
    if (window.api && typeof window.api.openExternalUrl === "function") {
      return window.api.openExternalUrl(supportUrl(options)).catch(function (error) {
        return { ok: false, error: error && error.message ? error.message : "OPEN_EXTERNAL_FAILED" };
      });
    }
    return Promise.resolve({ ok: false, error: "OPEN_EXTERNAL_UNAVAILABLE" });
  }

  window.KhodSupport = {
    phone: SUPPORT_PHONE_E164,
    message: SUPPORT_MESSAGE,
    url: supportUrl,
    open: openSupport
  };
})();
