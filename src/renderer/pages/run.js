// ── RUN PAGE ──

// ════════════════════════════════════════
// SOUND ENGINE
// ════════════════════════════════════════
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const sounds = {
      confirm: [
        { freq: 880, dur: 0.12, start: 0,    vol: 0.4 },
        { freq: 880, dur: 0.12, start: 0.18, vol: 0.4 },
      ],
      error: [
        { freq: 280, dur: 0.18, start: 0,    vol: 0.5 },
        { freq: 240, dur: 0.18, start: 0.22, vol: 0.5 },
        { freq: 200, dur: 0.25, start: 0.44, vol: 0.6 },
      ],
      success: [
        { freq: 523, dur: 0.1,  start: 0,    vol: 0.3 },
        { freq: 659, dur: 0.1,  start: 0.12, vol: 0.3 },
        { freq: 784, dur: 0.2,  start: 0.24, vol: 0.35 },
      ],
    };
    const tones = sounds[type] || sounds.confirm;
    tones.forEach(({ freq, dur, start, vol }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
      gain.gain.linearRampToValueAtTime(0,   ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });
  } catch {}
}

// ════════════════════════════════════════
// GLOBAL COOLDOWN — 6 min after each run
// Stored on window so it survives page re-renders
// ════════════════════════════════════════
if (!window._cooldownUntil) window._cooldownUntil = 0;

function startGlobalCooldown() {
  window._cooldownUntil = Date.now() + 6 * 60 * 1000;
}

function getCooldownRemaining() {
  return Math.max(0, window._cooldownUntil - Date.now());
}

function formatCountdown(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ════════════════════════════════════════
// RUN PAGE
// ════════════════════════════════════════
window.renderRun = function (dateFrom, dateTo, onComplete, onHome) {
  const el = document.getElementById("page-run");

  const dateDisplay = dateFrom === dateTo
    ? dateFrom
    : `${dateFrom} → ${dateTo}`;

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;padding:24px;gap:16px">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <div class="page-title" style="font-size:20px">Running Bot</div>
          <div class="text-muted text-sm">📅 ${dateDisplay}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="badge badge-accent" id="run-status-badge">● Starting...</div>
          <button class="btn btn-danger" id="btn-stop" style="font-size:12px;padding:6px 14px">⏹ Stop</button>
          <button class="btn btn-ghost" id="btn-home-run" style="font-size:12px;padding:6px 14px">🏠 Home</button>
        </div>
      </div>

      <!-- Cooldown bar (hidden until triggered) -->
      <div id="global-cooldown-bar" style="display:none;background:rgba(124,106,247,0.1);border:1px solid #7c6af7;border-radius:var(--radius);padding:10px 16px;display:none;align-items:center;gap:12px">
        <span style="font-size:16px">⏳</span>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700;color:#a89cf7">Cooldown — Easy-Orders Rate Limit</div>
          <div style="font-size:11px;color:var(--text2)">Next run available in <strong id="cooldown-timer" style="color:#a89cf7">6:00</strong></div>
        </div>
        <div style="width:120px;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
          <div id="cooldown-bar-fill" style="height:100%;background:#7c6af7;width:100%;transition:width 1s linear"></div>
        </div>
      </div>

      <!-- Phase status -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" id="phases-grid">
        ${["Easy-Orders Login", "Real Orders Export", "Missed Orders Export", "Khod Login & Export", "Create Orders in Easy-Orders"].map((name, i) => `
          <div class="status-row" id="phase-${i}" style="${i === 4 ? 'grid-column:1/-1' : ''}">
            <div class="status-dot" id="dot-${i}"></div>
            <div>
              <div style="font-size:13px;font-weight:600">${name}</div>
              <div class="text-sm text-muted" id="phase-label-${i}">Waiting...</div>
            </div>
          </div>
        `).join("")}
      </div>

      <!-- 2FA Notice -->
      <div class="notice-box warn" id="notice-2fa" style="display:none">
        <span class="notice-icon">🔐</span>
        <div class="notice-text">
          <strong>2FA Required</strong>
          Complete two-step verification in the browser window, then return here.
        </div>
      </div>

      <!-- Manual Confirm Notice -->
      <div class="notice-box warn" id="notice-confirm" style="display:none;border-color:var(--warning);background:rgba(255,201,77,0.12)">
        <span class="notice-icon">👀</span>
        <div class="notice-text">
          <strong>Action Required — Review & Confirm Orders</strong>
          Review in the browser window, then click <strong>تأكيد كل الطلبات</strong>. Bot is waiting (up to 10 min).
        </div>
      </div>

      <!-- Khod Restart Notice (shown when export fails and is retrying) -->
      <div class="notice-box warn" id="notice-khod-restart" style="display:none;border-color:#ff6b35;background:rgba(255,107,53,0.1)">
        <span class="notice-icon">🔄</span>
        <div class="notice-text" style="flex:1">
          <strong>Khod Export Failed — Restarting Automatically</strong>
          <div id="khod-restart-reason" style="font-size:11px;color:var(--text2);margin-top:3px"></div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
            <div style="font-size:13px;color:#ff6b35;font-weight:700">
              Please wait — retrying in <span id="khod-restart-timer" style="font-family:monospace">6:00</span>
            </div>
            <div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden">
              <div id="khod-restart-bar" style="height:100%;background:#ff6b35;width:100%;transition:width 1s linear;border-radius:2px"></div>
            </div>
            <div id="khod-restart-attempt" style="font-size:10px;color:var(--text2)"></div>
          </div>
        </div>
      </div>

      <!-- Rate Limit Cooldown Notice -->
      <div class="notice-box warn" id="notice-cooldown" style="display:none;border-color:#7c6af7;background:rgba(124,106,247,0.1)">
        <span class="notice-icon">⏸️</span>
        <div class="notice-text">
          <strong>Rate Limit — Cooldown in Progress</strong>
          <span id="cooldown-msg">Easy-Orders allows 1 export per 5 minutes. Waiting...</span>
        </div>
      </div>

      <!-- Upload progress panel (shown during Phase 5) -->
      <div id="upload-progress-panel" style="display:none;background:var(--bg2);border:1px solid var(--accent);border-radius:var(--radius);padding:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.06em">
            📤 Creating Orders in Easy-Orders
          </div>
          <div id="upload-counter" style="font-size:12px;color:var(--text2)">0 / 0</div>
        </div>
        <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:8px">
          <div id="upload-progress-bar" style="height:100%;background:var(--accent);width:0%;transition:width 0.4s ease;border-radius:4px"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px">
          <div id="upload-last-order" style="color:var(--text2)">Starting...</div>
          <div style="display:flex;gap:12px">
            <span style="color:var(--success)">✅ <span id="upload-success-count">0</span></span>
            <span style="color:var(--danger)">❌ <span id="upload-fail-count">0</span></span>
          </div>
        </div>
      </div>

      <!-- Preview panel -->
      <div id="preview-panel" style="display:none;background:var(--bg2);border:1px solid var(--accent);border-radius:var(--radius);padding:14px;max-height:260px;overflow-y:auto"></div>

      <!-- Log terminal -->
      <div style="flex:1;display:flex;flex-direction:column;min-height:0">
        <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Live Log</div>
        <div class="log-terminal" id="log-output" style="flex:1;height:auto"></div>
      </div>

    </div>
  `;

  const logEl  = document.getElementById("log-output");
  const badge  = document.getElementById("run-status-badge");
  let botDone  = false;

  // ── Home button — always works ──
  document.getElementById("btn-home-run").addEventListener("click", () => {
    cleanup();
    onHome();
  });

  // ── Stop button ──
  document.getElementById("btn-stop").addEventListener("click", async () => {
    if (botDone) return;
    const confirmed = await showRunConfirm("Stop the bot?", "The current run will be terminated immediately. Any orders not yet uploaded will be lost.");
    if (!confirmed) return;
    window.api.killBot();
    window.api.botFinished();
    appendLog("\n⏹ Bot stopped by user.");
    badge.textContent = "⏹ Stopped";
    badge.style.background = "rgba(255,77,109,0.15)";
    badge.style.color = "var(--danger)";
    botDone = true;
    document.getElementById("btn-stop").style.display = "none";
    startGlobalCooldown();
    showCooldownBar();
  });

  // ── Log helpers ──
  function appendLog(msg) {
    const line = document.createElement("div");
    if (msg.startsWith("✅") || msg.startsWith("📦") || msg.startsWith("📋")) {
      line.className = "log-ok";
    } else if (msg.startsWith("❌") || msg.startsWith("FATAL") || msg.startsWith("ERR:")) {
      line.className = "log-err";
    } else if (msg.startsWith("⚠️") || msg.startsWith("⏳") || msg.startsWith("⏸️")) {
      line.className = "log-warn";
    } else if (msg.startsWith("═") || msg.startsWith("PHASE") || msg.startsWith("📅") || msg.startsWith("🤖")) {
      line.className = "log-info";
    }
    line.textContent = msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
    updatePhases(msg);
  }

  function updatePhases(msg) {
    const phaseMap = [
      { keywords: ["Easy-Orders Login", "PHASE 1", "easy-orders login"], idx: 0 },
      { keywords: ["Real Orders Export", "PHASE 2", "Real orders"],       idx: 1 },
      { keywords: ["Missed Orders Export", "PHASE 3", "Missed orders"],   idx: 2 },
      { keywords: ["Khod whaat Login", "PHASE 4", "Khod whaat orders"],           idx: 3 },
      { keywords: ["Upload to Khod whaat Cart", "PHASE 5", "Cart page"],      idx: 4 },
    ];
    for (const p of phaseMap) {
      if (p.keywords.some((k) => msg.includes(k))) setPhaseActive(p.idx);
    }
    if (msg.includes("✅") && (msg.includes("downloaded") || msg.includes("confirmed") || msg.includes("complete"))) {
      for (let i = 0; i < 5; i++) {
        const dot = document.getElementById(`dot-${i}`);
        if (dot && dot.classList.contains("active")) {
          dot.classList.remove("active");
          dot.classList.add("done");
          document.getElementById(`phase-label-${i}`).textContent = "Complete ✓";
          break;
        }
      }
    }
  }

  function setPhaseActive(idx) {
    const dot = document.getElementById(`dot-${idx}`);
    if (dot && !dot.classList.contains("done")) {
      dot.classList.add("active");
      document.getElementById(`phase-label-${idx}`).textContent = "Running...";
    }
  }

  // ── Cooldown bar ──
  let cooldownInterval = null;

  function showCooldownBar() {
    const bar = document.getElementById("global-cooldown-bar");
    if (!bar) return;
    bar.style.display = "flex";

    const TOTAL = 6 * 60 * 1000;
    cooldownInterval = setInterval(() => {
      const remaining = getCooldownRemaining();
      const timerEl = document.getElementById("cooldown-timer");
      const fillEl  = document.getElementById("cooldown-bar-fill");
      if (timerEl) timerEl.textContent = formatCountdown(remaining);
      if (fillEl)  fillEl.style.width  = (remaining / TOTAL * 100) + "%";
      if (remaining <= 0) {
        clearInterval(cooldownInterval);
        bar.style.display = "none";
      }
    }, 1000);
  }

  // Show cooldown bar if it was already running (e.g. navigated home and back)
  if (getCooldownRemaining() > 0) showCooldownBar();

  // ── Event subscriptions ──
  function cleanup() {
    clearInterval(cooldownInterval);
    if (window._khodRestartInterval) { clearInterval(window._khodRestartInterval); window._khodRestartInterval = null; }
    window.api.removeAllListeners("bot-log");
    window.api.removeAllListeners("bot-2fa-needed");
    window.api.removeAllListeners("bot-needs-confirm");
    window.api.removeAllListeners("bot-cooldown");
    window.api.removeAllListeners("bot-preview");
    window.api.removeAllListeners("bot-order-progress");
    window.api.removeAllListeners("bot-khod-restart");
  }

  cleanup(); // clear any stale listeners first

  window.api.onBotLog((msg) => appendLog(msg));

  window.api.onPreview((data) => {
    const previewEl = document.getElementById("preview-panel");
    if (!previewEl) return;
    previewEl.style.display = "block";
    window._previewBuffer = data.buffer;

    const cols = ["#", "SKU", "Product", "Price", "Qty", "City", "Phone"];
    const rows = data.rows.slice(0, 10);
    const more = data.total > 10 ? `<div style="font-size:11px;color:var(--text2);padding:6px 0 0">+ ${data.total - 10} more rows…</div>` : "";

    previewEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.06em">
          📋 Preview — ${data.total} orders ready to upload
        </div>
        <button id="btn-preview-download" class="btn btn-primary" style="font-size:11px;padding:5px 12px">⬇️ Download Now</button>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>
            <tr>${cols.map(c => `<th style="text-align:left;padding:5px 8px;border-bottom:1px solid var(--border);color:var(--text2);font-weight:600">${c}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
                <td style="padding:5px 8px;color:var(--text2)">${i + 1}</td>
                <td style="padding:5px 8px;font-family:monospace;color:var(--accent)">${r.sku || "—"}</td>
                <td style="padding:5px 8px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.productName}">${r.productName || "—"}</td>
                <td style="padding:5px 8px;color:var(--success)">${r.unitPrice}</td>
                <td style="padding:5px 8px">${r.qty}</td>
                <td style="padding:5px 8px;direction:rtl">${r.city || "—"}</td>
                <td style="padding:5px 8px;font-family:monospace">${r.phone}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        ${more}
      </div>
    `;
    document.getElementById("btn-preview-download")?.addEventListener("click", async () => {
      if (!window._previewBuffer) return;
      const result = await window.api.saveOutputFile({ buffer: window._previewBuffer, filename: "Khod-preview.xlsx" });
      if (result.saved) appendLog(`✅ Preview saved to ${result.path}`);
    });
  });

  window.api.on2faNeeded(() => {
    document.getElementById("notice-2fa").style.display = "flex";
    playSound("confirm");
  });

  window.api.onNeedsConfirm(() => {
    document.getElementById("notice-confirm").style.display = "flex";
    badge.textContent = "👀 Awaiting Confirmation";
    badge.style.background = "rgba(255,201,77,0.15)";
    badge.style.color = "var(--warning)";
    playSound("confirm");
    setTimeout(() => playSound("confirm"), 1000);
    setTimeout(() => playSound("confirm"), 2000);
    if (Notification.permission === "granted") {
      new Notification("Khod whaat Bot — Action Required", {
        body: "Please review and confirm orders in the browser window.",
      });
    }
  });

  window.api.on("bot-cooldown", (msg) => {
    const box = document.getElementById("notice-cooldown");
    const txt = document.getElementById("cooldown-msg");
    if (box) box.style.display = "flex";
    if (txt) txt.textContent = `Attempt ${msg.attempt}/${msg.maxAttempts} — waiting ${msg.seconds}s before re-triggering export.`;
    badge.textContent = "⏸️ Cooldown";
    badge.style.background = "rgba(124,106,247,0.15)";
    badge.style.color = "#a89cf7";
  });

  window.api.on("bot-khod-restart", (msg) => {
    const box    = document.getElementById("notice-khod-restart");
    const reason = document.getElementById("khod-restart-reason");
    const timer  = document.getElementById("khod-restart-timer");
    const bar    = document.getElementById("khod-restart-bar");
    const att    = document.getElementById("khod-restart-attempt");
    if (!box) return;

    box.style.display = "flex";
    if (reason) reason.textContent = `Reason: ${msg.reason}`;
    if (att)    att.textContent    = `Attempt ${msg.attempt}/${msg.maxAttempts}`;

    badge.textContent = "🔄 Restarting...";
    badge.style.background = "rgba(255,107,53,0.15)";
    badge.style.color = "#ff6b35";

    // Countdown
    if (window._khodRestartInterval) clearInterval(window._khodRestartInterval);
    const TOTAL = msg.waitSeconds;
    let remaining = msg.waitSeconds;

    const tick = () => {
      if (!timer || !bar) return;
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      timer.textContent = `${m}:${String(s).padStart(2,"0")}`;
      bar.style.width = (remaining / TOTAL * 100) + "%";
      if (remaining <= 0) {
        clearInterval(window._khodRestartInterval);
        window._khodRestartInterval = null;
        box.style.display = "none";
        badge.textContent = "● Running";
        badge.style.background = "rgba(79,142,247,0.15)";
        badge.style.color = "var(--accent)";
      }
      remaining--;
    };
    tick();
    window._khodRestartInterval = setInterval(tick, 1000);
  });

  window.api.on("bot-order-progress", (msg) => {
    const panel = document.getElementById("upload-progress-panel");
    if (panel) panel.style.display = "block";

    const pct = msg.total > 0 ? (msg.current / msg.total * 100) : 0;
    const bar = document.getElementById("upload-progress-bar");
    const counter = document.getElementById("upload-counter");
    const lastOrder = document.getElementById("upload-last-order");
    const successCount = document.getElementById("upload-success-count");
    const failCount = document.getElementById("upload-fail-count");

    if (bar)          bar.style.width = pct + "%";
    if (counter)      counter.textContent = `${msg.current} / ${msg.total}`;
    if (successCount) successCount.textContent = msg.success;
    if (failCount)    failCount.textContent = msg.failed;
    if (lastOrder) {
      if (msg.lastOrder?.error) {
        lastOrder.style.color = "var(--danger)";
        lastOrder.textContent = `❌ ${msg.lastOrder.product} — ${msg.lastOrder.error}`;
      } else {
        lastOrder.style.color = "var(--text2)";
        lastOrder.textContent = `↳ ${msg.lastOrder?.product || ""}`;
      }
    }

    badge.textContent = `📤 Uploading ${msg.current}/${msg.total}`;
    badge.style.background = "rgba(0,214,143,0.12)";
    badge.style.color = "var(--success)";
  });

  // ── Start ──
  window.api.botStarted();
  appendLog("🚀 Starting bot...");
  appendLog(`📅 Date range: ${dateFrom} → ${dateTo}`);

  badge.textContent = "● Running";
  badge.style.background = "rgba(79,142,247,0.15)";
  badge.style.color = "var(--accent)";

  if (Notification.permission === "default") Notification.requestPermission();

  window.api.runBot({ dateFrom, dateTo }).then((result) => {
    botDone = true;
    window.api.botFinished();
    cleanup();

    // Start 6-min cooldown after every run
    startGlobalCooldown();
    showCooldownBar();

    // Hide stop button, keep home visible
    document.getElementById("btn-stop").style.display = "none";

    // Mark active phases done
    for (let i = 0; i < 5; i++) {
      const dot = document.getElementById(`dot-${i}`);
      if (dot && dot.classList.contains("active")) {
        dot.classList.remove("active");
        dot.classList.add("done");
      }
    }

    if (result.success) {
      badge.textContent = "✅ Done";
      badge.style.background = "rgba(0,214,143,0.15)";
      badge.style.color = "var(--success)";
      appendLog("\n✅ Bot completed successfully!");
      appendLog(`📊 New orders: ${result.data.orders}`);
      playSound("success");
      setTimeout(() => onComplete(result.data), 1200);
    } else if (result.error === "LICENSE_INVALID") {
      // License expired mid-session — redirect to license page
      badge.textContent = "🔒 License Expired";
      badge.style.background = "rgba(255,77,109,0.15)";
      badge.style.color = "var(--danger)";
      appendLog("\n🔒 License key has expired. Please enter your license for this month.");
      playSound("error");
      setTimeout(() => onHome(), 2500);
    } else {
      badge.textContent = "❌ Failed";
      badge.style.background = "rgba(255,77,109,0.15)";
      badge.style.color = "var(--danger)";
      appendLog(`\n❌ Bot failed: ${result.error}`);
      playSound("error");
      setTimeout(() => playSound("error"), 800);
      if (Notification.permission === "granted") {
        new Notification("Khod whaat Bot — Error", { body: result.error || "Bot failed. Check the log." });
      }
    }
  });
};

// ── Simple confirm dialog ──
function showRunConfirm(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:9999;";
    overlay.innerHTML = `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:28px;width:360px;text-align:center">
        <div style="font-size:18px;font-weight:700;margin-bottom:8px">${title}</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:24px;line-height:1.5">${message}</div>
        <div style="display:flex;gap:10px;justify-content:center">
          <button id="rc-cancel" class="btn btn-ghost">Cancel</button>
          <button id="rc-confirm" class="btn btn-danger">Stop Bot</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById("rc-confirm").addEventListener("click", () => { overlay.remove(); resolve(true); });
    document.getElementById("rc-cancel").addEventListener("click",  () => { overlay.remove(); resolve(false); });
  });
}
