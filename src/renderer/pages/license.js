// ── LICENSE PAGE ──
window.renderLicense = function (onUnlocked) {
  const el = document.getElementById("page-license");

  el.innerHTML = `
    <div style="
      display:flex;align-items:center;justify-content:center;
      height:100%;background:var(--bg);
      background-image:radial-gradient(ellipse at 50% 0%, rgba(124,106,247,0.12) 0%, transparent 60%);
    ">
      <div style="width:460px;text-align:center;padding:0 20px">

        <div style="margin-bottom:28px;position:relative;display:inline-block">
          <div style="
            width:88px;height:88px;border-radius:50%;
            background:linear-gradient(135deg,#7c6af7 0%,#4f8ef7 100%);
            display:flex;align-items:center;justify-content:center;
            font-size:38px;margin:0 auto;
            box-shadow:0 0 40px rgba(124,106,247,0.45);
            animation:lic-pulse 2.5s ease-in-out infinite;
          ">🔐</div>
        </div>

        <div style="font-size:26px;font-weight:800;color:var(--text1);margin-bottom:8px;letter-spacing:-0.5px">
          License Required
        </div>
        <div style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:6px">
          Enter your license key to activate the app.
        </div>
        <div id="lic-days-badge" style="
          display:inline-block;background:rgba(124,106,247,0.15);
          border:1px solid rgba(124,106,247,0.4);color:#a89cf7;
          font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
          padding:4px 14px;border-radius:99px;margin-bottom:28px;
        "> </div>

        <!-- Input area -->
        <div style="
          background:var(--bg2);border:1px solid var(--border);
          border-radius:var(--radius);padding:24px;margin-bottom:16px;
          text-align:left;
        ">
          <label style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.07em;display:block;margin-bottom:10px">
            License Key
          </label>
          <input
            id="lic-input"
            type="text"
            placeholder="KHOD-XXXX-XXXX-XXXX-XXXX"
            autocomplete="off"
            spellcheck="false"
            style="
              width:100%;box-sizing:border-box;
              background:var(--bg);border:1px solid var(--border);
              border-radius:8px;padding:12px 14px;
              font-size:14px;font-family:monospace;color:var(--text1);
              letter-spacing:.06em;outline:none;
              transition:border-color 0.2s;
            "
          />
          <div id="lic-error" style="
            display:none;margin-top:10px;
            color:var(--danger);font-size:12px;font-weight:600;
            padding:8px 12px;background:rgba(255,77,109,0.1);
            border-radius:6px;border:1px solid rgba(255,77,109,0.25);
          "></div>
        </div>

        <button id="lic-btn" style="
          width:100%;padding:14px;border:none;border-radius:10px;cursor:pointer;
          background:linear-gradient(135deg,#7c6af7,#4f8ef7);
          color:#fff;font-size:15px;font-weight:700;
          box-shadow:0 4px 20px rgba(124,106,247,0.4);
          transition:opacity 0.2s,transform 0.15s;
          margin-bottom:20px;
        " onmouseover="this.style.opacity='.88'" onmouseout="this.style.opacity='1'">
          Activate License →
        </button>

        <div style="font-size:11px;color:var(--text2);line-height:1.7">
          Contact support if you need a license key.<br>
          If you see a "different device" error, contact support to reset the device lock.
        </div>

      </div>
    </div>

    <style>
      @keyframes lic-pulse {
        0%,100% { box-shadow:0 0 30px rgba(124,106,247,0.35); transform:scale(1); }
        50%      { box-shadow:0 0 55px rgba(124,106,247,0.65); transform:scale(1.05); }
      }
      #lic-input:focus { border-color:#7c6af7 !important; box-shadow:0 0 0 3px rgba(124,106,247,0.2); }
      @keyframes lic-shake {
        0%,100% { transform:translateX(0); }
        20%      { transform:translateX(-6px); }
        40%      { transform:translateX(6px); }
        60%      { transform:translateX(-4px); }
        80%      { transform:translateX(4px); }
      }
    </style>
  `;

  const input = document.getElementById("lic-input");
  const btn   = document.getElementById("lic-btn");
  const errEl = document.getElementById("lic-error");

  function showError(msg) {
    errEl.textContent = msg;
    errEl.style.display = "block";
    input.style.borderColor = "var(--danger)";
    input.style.animation = "none";
    setTimeout(() => { input.style.animation = "lic-shake 0.35s ease"; }, 10);
  }
  function clearError() { errEl.style.display = "none"; input.style.borderColor = "var(--border)"; }

  input.addEventListener("input", clearError);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") btn.click(); });

  btn.addEventListener("click", async () => {
    const key = input.value.trim();
    if (!key) { showError("Please enter your license key."); return; }
    btn.textContent = "Verifying...";
    btn.disabled = true;

    const result = await window.api.submitLicense(key);

    if (result.success) {
      btn.textContent = "✅ Activated!";
      btn.style.background = "linear-gradient(135deg,#00d68f,#00b370)";
      btn.style.boxShadow = "0 4px 20px rgba(0,214,143,0.4)";
      if (result.daysLeft != null) {
        const badge = document.getElementById("lic-days-badge");
        if (badge) { badge.textContent = `${result.daysLeft} day(s) remaining`; }
      }
      setTimeout(() => onUnlocked(), 900);
    } else {
      btn.textContent = "Activate License →";
      btn.disabled = false;
      showError(result.reason || "Invalid license key.");
    }
  });
};
