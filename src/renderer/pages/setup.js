// ── SETUP PAGE (credentials — email only, no phone) ──
window.renderSetup = function (onComplete) {
  const el = document.getElementById("page-setup");
  const t  = window._t;

  el.innerHTML = `
    <div class="center-layout">
      <div class="card" style="width:480px">
        <div class="page-title">${t("setup.title")}</div>
        <div class="page-subtitle">${t("setup.subtitle")}</div>

        <div class="form-section-title">${t("setup.easy_section")}</div>
        <div class="form-group">
          <label>${t("setup.store_label")} <span style="color:var(--text2);font-weight:400;text-transform:none">${t("setup.store_hint")}</span></label>
          <input type="text" id="easy-store" placeholder="${t("setup.store_ph")}" />
        </div>
        <div class="form-group">
          <label>${t("setup.email_label")}</label>
          <input type="email" id="easy-email" placeholder="${t("setup.email_ph")}" autocomplete="off" />
        </div>
        <div class="form-group">
          <label>${t("setup.pass_label")}</label>
          <input type="password" id="easy-pass" placeholder="••••••••" autocomplete="new-password" />
        </div>

        <div class="form-section-title">${t("setup.khod_section")}</div>
        <div class="form-group">
          <label>${t("setup.email_label")}</label>
          <input type="email" id="khod-email" placeholder="${t("setup.khod_email_ph")}" autocomplete="off" />
        </div>
        <div class="form-group">
          <label>${t("setup.pass_label")}</label>
          <input type="password" id="khod-pass" placeholder="••••••••" autocomplete="new-password" />
        </div>

        <div id="setup-error" class="notice-box danger mt-20" style="display:none">
          <span class="notice-icon">⚠️</span>
          <div class="notice-text" id="setup-error-text">${t("setup.err_missing")}</div>
        </div>

        <div class="mt-20">
          <button class="btn btn-primary full-width btn-lg" id="btn-save-creds">${t("setup.save_btn")}</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btn-save-creds").addEventListener("click", async () => {
    const easyEmail    = document.getElementById("easy-email").value.trim();
    const easyPassword = document.getElementById("easy-pass").value;
    const easyStore    = document.getElementById("easy-store").value.trim();
    const khodEmail    = document.getElementById("khod-email").value.trim();
    const khodPassword = document.getElementById("khod-pass").value;

    const errorEl   = document.getElementById("setup-error");
    const errorText = document.getElementById("setup-error-text");

    if (!easyEmail || !easyPassword || !khodEmail || !khodPassword) {
      errorText.innerHTML = window._t("setup.err_missing");
      errorEl.style.display = "flex";
      return;
    }

    errorEl.style.display = "none";

    const saveResult = await window.api.saveCredentials({
      easyEmail, easyPassword, easyStore, khodEmail, khodPassword,
    });

    if (saveResult && saveResult.success === false && saveResult.reason === "account_locked") {
      errorText.innerHTML = window._t("setup.err_locked");
      errorEl.style.display = "flex";
      return;
    }

    onComplete();
  });

  el.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("btn-save-creds").click();
    });
  });
};
