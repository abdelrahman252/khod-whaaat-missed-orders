// ── APP ROUTER ──

let sessionDate = null;

// ── Global state ──
window._kbotLang  = "en";
window._kbotTheme = "dark";
window._kbotUser  = { customerName: null, daysLeft: null };

// ── i18n strings ──
// Defined once at module level — never re-created per call.
const _STRINGS = {
  en: {
    "topbar.welcome": (n) => n ? `Welcome, ${n}` : "Welcome",
    "topbar.days":    (d) => d != null ? `${d} day${d !== 1 ? "s" : ""} remaining` : "",
    "topbar.expires": "License expires soon",
    "setup.title":        "Welcome to Khod Bot ⚡",
    "setup.subtitle":     "Enter your credentials once — they're stored securely on this device.",
    "setup.easy_section": "📦 Easy-Orders Account",
    "setup.khod_section": "🛒 Khod-Whaat Account",
    "setup.store_label":  "Store Name",
    "setup.store_hint":   "(leave empty if single store)",
    "setup.store_ph":     "e.g. themnzl",
    "setup.email_label":  "Email",
    "setup.email_ph":     "you@example.com",
    "setup.pass_label":   "Password",
    "setup.khod_email_ph":"affiliate@khod-whaat.com",
    "setup.save_btn":     "Save & Continue →",
    "setup.err_missing":  "<strong>Missing fields</strong> — All required fields must be filled.",
    "setup.err_locked":   "<strong>Account Locked</strong> — This license is already linked to different accounts. Contact support to change them.",
    "welcome.app_title":      "Khod whaat Order Bot",
    "welcome.app_subtitle":   "Automate your daily order processing",
    "welcome.quick_start":    "Quick Start",
    "welcome.today_btn":      (d) => `📅 Continue — Today (${d})`,
    "welcome.new_date_btn":   "🗓️ New Date / Range",
    "welcome.launch_min":     "🔕 Launch Minimized",
    "welcome.launch_min_desc":"When ON, app starts hidden in the tray — won't pop up on Windows startup.",
    "welcome.autorun":        "⏱️ Auto-Run",
    "welcome.autorun_desc":   "Automatically run for today's orders on a schedule.",
    "welcome.run_every":      "Run Every",
    "welcome.select_date":    "Select Date",
    "welcome.today":          "Today",
    "welcome.single_day":     "Single Day",
    "welcome.pick_one":       "Pick one date",
    "welcome.date_range":     "Date Range",
    "welcome.from_to":        "From → To",
    "welcome.from":           "From",
    "welcome.to":             "To",
    "welcome.launch_btn":     "🚀 Launch Bot",
    "welcome.reset_section":  "⚠️ Reset",
    "welcome.reset_notice":   "<strong>New Login Credentials?</strong>Clears all saved credentials, sessions, and cookies. You'll be asked to log in again.",
    "welcome.reset_btn":      "Reset All Data & Credentials",
    "welcome.reset_confirm_title": "Reset All Data?",
    "welcome.reset_confirm_msg":   "This will delete all saved credentials, browser sessions, and cookies. You'll need to enter your login details again.",
    "welcome.reset_confirm_ok":    "Reset Everything",
    "welcome.reset_confirm_cancel":"Cancel",
    "welcome.off":            "OFF",
    "welcome.on":             "ON",
    "welcome.next_run":       (m, s) => `⏳ Next auto-run in ${m}:${s}`,
    "run.title":          "Running Bot",
    "run.starting":       "● Starting...",
    "run.stop":           "⏹ Stop",
    "run.home":           "🏠 Home",
    "run.phase0":         "Easy-Orders Login",
    "run.phase1":         "Real Orders Export",
    "run.phase2":         "Missed Orders Export",
    "run.phase3":         "Khod Login & Export",
    "run.phase4":         "Create Orders in Easy-Orders",
    "run.waiting":        "Waiting...",
    "run.2fa_title":      "2FA Required",
    "run.2fa_msg":        "Complete two-step verification in the browser window, then return here.",
    "run.confirm_title":  "Action Required — Review & Confirm Orders",
    "run.confirm_msg":    "Review in the browser window, then click <strong>تأكيد كل الطلبات</strong>. Bot is waiting (up to 10 min).",
    "run.restart_title":  "Khod Export Failed — Restarting Automatically",
    "run.ratelimit_title":"Rate Limit — Cooldown in Progress",
    "run.creating":       "📤 Creating Orders in Easy-Orders",
    "run.live_log":       "Live Log",
    "run.cooldown_label": "Cooldown — Easy-Orders Rate Limit",
    "run.cooldown_next":  "Next run available in",
    "run.preview_header": (n) => `📋 ${n} orders ready — uploading now`,
    "run.preview_cols":   ["Product", "Qty", "Price", "Date", "City", "Name", "Phone"],
    "run.progress_start": "Starting...",
    "results.title":      (d) => `Results — ${d}`,
    "results.completed":  "Bot run completed",
    "results.home":       "🏠 Home",
    "results.run_again":  "🔄 Run Again",
    "results.download":   "⬇️ Download Excel",
    "results.download_failed": "⬇️ Download Failed Orders",
    "results.new_orders": "New Orders",
    "results.in_khod":    "Already in Khod",
    "results.dupes":      "Duplicates Removed",
    "results.failed":     "Failed on Khod",
    "results.all_caught": "All caught up!",
    "results.no_orders":  "No new orders to process for this date range.",
    "results.from_real":  "From Real Orders",
    "results.from_missed":"From Missed Orders",
    "results.new_unique": "new unique orders",
    "results.by_product": "📦 Orders by Product",
    "results.no_product": "No product data available.",
    "results.product":    "Product Name",
    "results.orders":     "Orders",
    "results.total_qty":  "Total Qty",
    "results.total":      "Total",
    "results.fail_title": (n) => `${n} Order${n > 1 ? "s" : ""} Failed — Rejected by Khod`,
    "results.fail_saved": "Saved to your device. Check the folder for details.",
    "results.open_folder":"📁 Open Folder",
    "results.all_ok":     "<strong>All orders uploaded and confirmed</strong> No failed orders this run.",
    "results.row":        "Row",
    "results.sku":        "SKU",
    "results.phone":      "Phone",
    "results.error":      "Error",
  },
  ar: {
    "topbar.welcome": (n) => n ? `أهلاً، ${n}` : "أهلاً",
    "topbar.days":    (d) => d != null ? `متبقي ${d} ${d === 1 ? "يوم" : "أيام"}` : "",
    "topbar.expires": "الترخيص ينتهي قريباً",
    "setup.title":        "أهلاً بك في Khod Bot ⚡",
    "setup.subtitle":     "أدخل بيانات الدخول مرة واحدة — يتم حفظها بشكل آمن على هذا الجهاز.",
    "setup.easy_section": "📦 حساب Easy-Orders",
    "setup.khod_section": "🛒 حساب Khod-Whaat",
    "setup.store_label":  "اسم المتجر",
    "setup.store_hint":   "(اتركه فارغاً إذا كان لديك متجر واحد)",
    "setup.store_ph":     "مثال: themnzl",
    "setup.email_label":  "البريد الإلكتروني",
    "setup.email_ph":     "you@example.com",
    "setup.pass_label":   "كلمة المرور",
    "setup.khod_email_ph":"affiliate@khod-whaat.com",
    "setup.save_btn":     "حفظ والمتابعة ←",
    "setup.err_missing":  "<strong>حقول مفقودة</strong> — يجب ملء جميع الحقول المطلوبة.",
    "setup.err_locked":   "<strong>حساب مقفل</strong> — هذا الترخيص مرتبط بحسابات مختلفة. تواصل مع الدعم.",
    "welcome.app_title":      "بوت طلبات خذ ووت",
    "welcome.app_subtitle":   "أتمتة معالجة طلباتك اليومية",
    "welcome.quick_start":    "ابدأ الآن",
    "welcome.today_btn":      (d) => `📅 متابعة — اليوم (${d})`,
    "welcome.new_date_btn":   "🗓️ تاريخ / نطاق جديد",
    "welcome.launch_min":     "🔕 تشغيل مصغّر",
    "welcome.launch_min_desc":"عند التفعيل، يبدأ التطبيق مخفياً في شريط المهام.",
    "welcome.autorun":        "⏱️ التشغيل التلقائي",
    "welcome.autorun_desc":   "تشغيل تلقائي لطلبات اليوم وفق جدول زمني.",
    "welcome.run_every":      "كل",
    "welcome.select_date":    "اختر التاريخ",
    "welcome.today":          "اليوم",
    "welcome.single_day":     "يوم واحد",
    "welcome.pick_one":       "اختر تاريخاً",
    "welcome.date_range":     "نطاق تواريخ",
    "welcome.from_to":        "من → إلى",
    "welcome.from":           "من",
    "welcome.to":             "إلى",
    "welcome.launch_btn":     "🚀 تشغيل البوت",
    "welcome.reset_section":  "⚠️ إعادة ضبط",
    "welcome.reset_notice":   "<strong>بيانات دخول جديدة؟</strong>سيتم حذف جميع البيانات والجلسات. ستحتاج إلى إدخال بيانات الدخول مجدداً.",
    "welcome.reset_btn":      "إعادة ضبط البيانات وبيانات الدخول",
    "welcome.reset_confirm_title":"إعادة ضبط البيانات؟",
    "welcome.reset_confirm_msg":  "سيتم حذف جميع بيانات الدخول المحفوظة والجلسات والكوكيز.",
    "welcome.reset_confirm_ok":   "إعادة الضبط",
    "welcome.reset_confirm_cancel":"إلغاء",
    "welcome.off":            "إيقاف",
    "welcome.on":             "تشغيل",
    "welcome.next_run":       (m, s) => `⏳ التشغيل التالي خلال ${m}:${s}`,
    "run.title":          "البوت يعمل",
    "run.starting":       "● جارٍ البدء...",
    "run.stop":           "⏹ إيقاف",
    "run.home":           "🏠 الرئيسية",
    "run.phase0":         "تسجيل دخول Easy-Orders",
    "run.phase1":         "تصدير الطلبات الفعلية",
    "run.phase2":         "تصدير الطلبات الفائتة",
    "run.phase3":         "تسجيل دخول Khod وتصديره",
    "run.phase4":         "إنشاء الطلبات في Easy-Orders",
    "run.waiting":        "في الانتظار...",
    "run.2fa_title":      "مطلوب التحقق الثنائي",
    "run.2fa_msg":        "أكمل التحقق في نافذة المتصفح ثم عد هنا.",
    "run.confirm_title":  "إجراء مطلوب — راجع الطلبات وأكدها",
    "run.confirm_msg":    "راجع في نافذة المتصفح ثم انقر <strong>تأكيد كل الطلبات</strong>. البوت ينتظر (حتى 10 دقائق).",
    "run.restart_title":  "فشل تصدير Khod — إعادة المحاولة تلقائياً",
    "run.ratelimit_title":"حد المعدل — انتظار...",
    "run.creating":       "📤 إنشاء الطلبات في Easy-Orders",
    "run.live_log":       "السجل المباشر",
    "run.cooldown_label": "انتظار — حد معدل Easy-Orders",
    "run.cooldown_next":  "التشغيل التالي خلال",
    "run.preview_header": (n) => `📋 ${n} طلب جاهز — جارٍ الرفع`,
    "run.preview_cols":   ["المنتج", "الكمية", "السعر", "التاريخ", "المدينة", "الاسم", "الهاتف"],
    "run.progress_start": "جارٍ البدء...",
    "results.title":      (d) => `النتائج — ${d}`,
    "results.completed":  "اكتمل تشغيل البوت",
    "results.home":       "🏠 الرئيسية",
    "results.run_again":  "🔄 تشغيل مجدداً",
    "results.download":   "⬇️ تحميل Excel",
    "results.download_failed": "⬇️ تحميل الطلبات الفاشلة",
    "results.new_orders": "طلبات جديدة",
    "results.in_khod":    "موجودة في Khod",
    "results.dupes":      "مكررات محذوفة",
    "results.failed":     "فشلت في Khod",
    "results.all_caught": "!أنجزت كل شيء",
    "results.no_orders":  "لا طلبات جديدة في هذا النطاق الزمني.",
    "results.from_real":  "من الطلبات الفعلية",
    "results.from_missed":"من الطلبات الفائتة",
    "results.new_unique": "طلبات جديدة فريدة",
    "results.by_product": "📦 الطلبات حسب المنتج",
    "results.no_product": "لا بيانات منتجات متاحة.",
    "results.product":    "اسم المنتج",
    "results.orders":     "الطلبات",
    "results.total_qty":  "الكمية الكلية",
    "results.total":      "المجموع",
    "results.fail_title": (n) => `${n} طلب فشل — رُفض من Khod`,
    "results.fail_saved": "تم الحفظ على جهازك. افتح المجلد للتفاصيل.",
    "results.open_folder":"📁 فتح المجلد",
    "results.all_ok":     "<strong>تم رفع وتأكيد جميع الطلبات</strong> لا طلبات فاشلة في هذه الجولة.",
    "results.row":        "الصف",
    "results.sku":        "الكود",
    "results.phone":      "الهاتف",
    "results.error":      "الخطأ",
  },
};

// _t: O(1) lookup — no object rebuild per call, no nested closure allocation.
window._t = function(key) {
  const lang = window._kbotLang;
  const map  = _STRINGS[lang] || _STRINGS["en"];
  return map[key] !== undefined ? map[key] : (_STRINGS["en"][key] || key);
};

// ── Theme & Lang helpers ──
function applyTheme(theme) {
  window._kbotTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  const cb = document.getElementById("toggle-theme");
  if (cb) cb.checked = (theme === "light");
  try { localStorage.setItem("kbot-theme", theme); } catch(e) {}
}

function applyLang(lang) {
  window._kbotLang = lang;
  document.documentElement.setAttribute("dir",  lang === "ar" ? "rtl" : "ltr");
  document.documentElement.setAttribute("lang", lang);
  const cb = document.getElementById("toggle-lang");
  if (cb) cb.checked = (lang === "ar");
  updateTopBarText();
  try { localStorage.setItem("kbot-lang", lang); } catch(e) {}
}

// Cache DOM refs — avoids getElementById on every topbar update
let _topBarName = null, _topBarDays = null, _topBarAvatar = null;
function updateTopBarText() {
  if (!_topBarName)   _topBarName   = document.getElementById("top-bar-name");
  if (!_topBarDays)   _topBarDays   = document.getElementById("top-bar-days");
  if (!_topBarAvatar) _topBarAvatar = document.getElementById("top-bar-avatar");
  if (!_topBarName) return;

  const { customerName, daysLeft } = window._kbotUser;
  const welcomeFn = window._t("topbar.welcome");
  _topBarName.textContent = typeof welcomeFn === "function" ? welcomeFn(customerName) : welcomeFn;
  const daysFn = window._t("topbar.days");
  _topBarDays.textContent = typeof daysFn === "function" ? daysFn(daysLeft) : "";
  _topBarDays.classList.toggle("warn", daysLeft !== null && daysLeft <= 7);

  if (_topBarAvatar && customerName) {
    const parts = customerName.trim().split(" ");
    _topBarAvatar.textContent = parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : customerName.slice(0, 2).toUpperCase();
  }
}

// ── Top bar visibility ──
const PAGES_WITH_TOPBAR = new Set(["page-setup", "page-welcome", "page-run"]);

function showPage(id) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  const centerEl = document.getElementById("top-bar-center");
  if (centerEl) centerEl.classList.toggle("visible", PAGES_WITH_TOPBAR.has(id));
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
  }, 5 * 60 * 1000);
}

async function init() {
  document.getElementById("btn-minimize").addEventListener("click", () => window.api.minimize());
  document.getElementById("btn-maximize").addEventListener("click", () => window.api.maximize());
  document.getElementById("btn-close").addEventListener("click",    () => window.api.close());

  // Load saved settings then apply — do both in parallel where possible
  try {
    const settings = await window.api.getSettings();
    applyTheme(settings.theme || "dark");
    applyLang(settings.lang  || "en");
  } catch(e) {
    applyTheme("dark");
    applyLang("en");
  }

  document.getElementById("toggle-theme").addEventListener("change", async (e) => {
    const next = e.target.checked ? "light" : "dark";
    applyTheme(next);
    await window.api.saveSettings({ theme: next });
  });
  document.getElementById("toggle-lang").addEventListener("change", async (e) => {
    const next = e.target.checked ? "ar" : "en";
    applyLang(next);
    await window.api.saveSettings({ lang: next });
    reRenderCurrentPage();
  });

  // License check + credential check in parallel
  const [licenseResult, creds] = await Promise.all([
    window.api.checkLicense(),
    window.api.getCredentials(),
  ]);

  if (!licenseResult.valid) {
    renderLicense(() => afterLicense());
    showPage("page-license");
    return;
  }

  window._kbotUser = {
    customerName: licenseResult.customerName || null,
    daysLeft:     licenseResult.daysLeft,
  };
  updateTopBarText();

  window.api.onLicenseExpired(() => {
    clearInterval(licenseCheckInterval);
    renderLicense(() => afterLicense());
    showPage("page-license");
  });

  startPeriodicLicenseCheck();

  // Use already-fetched creds — no second round-trip
  if (!creds.hasCredentials) {
    renderSetup(() => goToWelcome());
    showPage("page-setup");
  } else {
    goToWelcome();
  }
}

async function afterLicense() {
  window.api.onLicenseExpired(() => {
    clearInterval(licenseCheckInterval);
    renderLicense(() => afterLicense());
    showPage("page-license");
  });

  startPeriodicLicenseCheck();

  try {
    const lr = await window.api.checkLicense();
    if (lr.valid) {
      window._kbotUser = { customerName: lr.customerName || null, daysLeft: lr.daysLeft };
      updateTopBarText();
    }
  } catch(e) {}

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
    data, dateFrom, dateTo,
    () => { goToRun(dateFrom, dateTo); },
    () => { sessionDate = null; goToWelcome(); }
  );
  showPage("page-results");
}

// ── Re-render current page when language switches ──
function reRenderCurrentPage() {
  const active = document.querySelector(".page.active");
  if (!active) return;
  const id = active.id;
  if (id === "page-welcome") {
    goToWelcome();
  } else if (id === "page-setup") {
    renderSetup(() => goToWelcome());
  } else if (id === "page-run" && sessionDate) {
    renderRun(sessionDate.dateFrom, sessionDate.dateTo, (resultData) => {
      goToResults(resultData, sessionDate.dateFrom, sessionDate.dateTo);
    }, () => { goToWelcome(); });
  }
}

// Start
init();
