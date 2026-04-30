// ── SETUP PAGE (credentials — email only, no phone) ──
window.renderSetup = function (onComplete) {
  const el = document.getElementById("page-setup");
  el.innerHTML = `
    <div class="center-layout">
      <div class="card" style="width:480px">
        <div class="page-title">Welcome to Khod Bot ⚡</div>
        <div class="page-subtitle">Enter your credentials once — they're stored securely on this device.</div>

        <div class="form-section-title">📦 Easy-Orders Account</div>
        <div class="form-group">
          <label>Store Name <span style="color:var(--text2);font-weight:400;text-transform:none">(leave empty if single store)</span></label>
          <input type="text" id="easy-store" placeholder="e.g. themnzl" />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="easy-email" placeholder="you@example.com" autocomplete="off" />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="easy-pass" placeholder="••••••••" autocomplete="new-password" />
        </div>

        <div class="form-section-title">🛒 Khod-Whaat Account</div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="khod-email" placeholder="affiliate@khod-whaat.com" autocomplete="off" />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="khod-pass" placeholder="••••••••" autocomplete="new-password" />
        </div>

        <div id="setup-error" class="notice-box danger mt-20" style="display:none">
          <span class="notice-icon">⚠️</span>
          <div class="notice-text" id="setup-error-text"><strong>Missing fields</strong> — All required fields must be filled.</div>
        </div>

        <div class="mt-20">
          <button class="btn btn-primary full-width btn-lg" id="btn-save-creds">Save & Continue →</button>
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
      errorText.innerHTML = "<strong>Missing fields</strong> — All required fields must be filled.";
      errorEl.style.display = "flex";
      return;
    }

    errorEl.style.display = "none";

    const saveResult = await window.api.saveCredentials({
      easyEmail,
      easyPassword,
      easyStore,
      khodEmail,
      khodPassword,
    });

    if (saveResult && saveResult.success === false && saveResult.reason === "account_locked") {
      errorText.innerHTML = "<strong>Account Locked</strong> — This license is already linked to different accounts. Contact support to change them.";
      errorEl.style.display = "flex";
      return;
    }

    onComplete();
  });

  // Enter key support
  el.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("btn-save-creds").click();
    });
  });
};
