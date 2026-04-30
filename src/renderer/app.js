// ── APP ROUTER ──

let sessionDate = null;

function showPage(id) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ── Periodic license re-check every 5 minutes ──
let licenseCheckInterval = null;
function startPeriodicLicenseCheck() {
  if (licenseCheckInterval) clearInterval(licenseCheckInterval);
  licenseCheckInterval = setInterval(async () => {
    const result = await window.api.checkLicense();
    if (!result.valid) {
      clearInterval(licenseCheckInterval);
      renderLicense(() => afterLicense());
      showPage("page-license");
    }
  }, 5 * 60 * 1000); // every 5 minutes
}

async function init() {
  // Window controls
  document.getElementById("btn-minimize").addEventListener("click", () => window.api.minimize());
  document.getElementById("btn-maximize").addEventListener("click", () => window.api.maximize());
  document.getElementById("btn-close").addEventListener("click", () => window.api.close());

  // ── License gate — must pass before anything else ──
  const licenseResult = await window.api.checkLicense();
  if (!licenseResult.valid) {
    renderLicense(() => afterLicense());
    showPage("page-license");
    return;
  }

  // Listen for license expiry during session (e.g. auto-run at midnight)
  window.api.onLicenseExpired(() => {
    clearInterval(licenseCheckInterval);
    renderLicense(() => afterLicense());
    showPage("page-license");
  });

  startPeriodicLicenseCheck();
  afterLicense();
}

async function afterLicense() {
  window.api.onLicenseExpired(() => {
    clearInterval(licenseCheckInterval);
    renderLicense(() => afterLicense());
    showPage("page-license");
  });

  startPeriodicLicenseCheck();

  const creds = await window.api.getCredentials();
  if (!creds.hasCredentials) {
    renderSetup(() => goToWelcome());
    showPage("page-setup");
  } else {
    goToWelcome();
  }
}

function goToWelcome() {
  renderWelcome(
    ({ dateFrom, dateTo }) => {
      sessionDate = { dateFrom, dateTo };
      goToRun(dateFrom, dateTo);
    },
    () => {}
  );
  showPage("page-welcome");
}

function goToRun(dateFrom, dateTo) {
  renderRun(dateFrom, dateTo, (resultData) => {
    goToResults(resultData, dateFrom, dateTo);
  }, () => {
    goToWelcome();
  });
  showPage("page-run");
}

function goToResults(data, dateFrom, dateTo) {
  renderResults(
    data,
    dateFrom,
    dateTo,
    () => { goToRun(dateFrom, dateTo); },
    () => { sessionDate = null; goToWelcome(); }
  );
  showPage("page-results");
}

// Start
init();