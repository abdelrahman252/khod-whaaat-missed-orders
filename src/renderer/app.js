// ── APP ROUTER ──

let sessionDate = null;

// ── Global state ──
window._kbotLang  = "ar";
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
    "run.restart_wait":   "Please wait — retrying in",
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
    // setup page — accounts step
    "setup.nav_accounts":       "Accounts",
    "setup.nav_run":            "Run",
    "setup.sub_title":          "Setup",
    "setup.reset_creds_btn":    "🔄 Reset Credentials",
    "setup.manage_title":       "Manage Accounts",
    "setup.manage_sub":         "Add, edit, or remove your accounts. Selection happens on the next step.",
    "setup.your_accounts":      "Your Accounts",
    "setup.your_accounts_desc": "Manage the accounts available for running tasks.",
    "setup.add_account":        "Add Account",
    "setup.next_btn":           "Next: Run Setup →",
    "setup.run_title":          "Run Execution",
    "setup.run_sub":            "Select users, pick a date, then launch.",
    "setup.select_users":       "Select Users",
    "setup.select_users_desc":  "Choose one or more users to run the task.",
    "setup.all_users":          "All Users",
    "setup.select_all":         "Select All",
    "setup.select_date":        "Select Date",
    "setup.select_date_desc":   "Choose when you want to run the task.",
    "setup.today_mode":         "📅 Today",
    "setup.single_mode":        "🗓️ Single",
    "setup.range_mode":         "📆 Range",
    "setup.summary":            "Summary",
    "setup.summary_desc":       "Review your selections before running.",
    "setup.users_selected":     "Users Selected",
    "setup.date_range":         "Date Range",
    "setup.total_days":         "Total Days",
    "setup.back_btn":           "← Back",
    "setup.run_btn":            "🚀 Run Execution",
    "setup.run_security":       "🔒 This action will be executed for the selected users and date range.",
    "setup.date_label":         "Date",
    "setup.start_date":         "Start Date",
    "setup.end_date":           "End Date",
    "setup.today_running":      (d) => `✅ Running for today — ${d}`,
    "setup.locked":             "Locked",
    "setup.active":             "Active",
    "setup.edit_btn":           "✏️ Edit",
    "setup.edit_account":       "Edit Account",
    "setup.new_account":        "New Account",
    "setup.form_subtitle":      "Fill in credentials for this account.",
    "setup.keep_pass":          "Leave blank to keep existing",
    "setup.cancel_btn":         "Cancel",
    "setup.save_btn2":          "💾 Save",
    "setup.add_btn":            "➕ Add Account",
    "setup.saving":             "Saving...",
    "setup.limit_reached":      "License limit reached — cannot add more accounts.",
    "setup.save_failed":        "Failed to save.",
    "setup.remove_confirm":     "Remove this account?",
    "setup.reset_confirm_title":"Reset All Data?",
    "setup.reset_confirm_msg":  "This will delete all saved credentials, browser sessions, and cookies. You'll need to enter your login details again.",
    "setup.reset_confirm_ok":   "Reset Everything",
    "setup.reset_confirm_cancel":"Cancel",
    "setup.locked_title":       "Locked by admin — contact support to reset",
    "setup.license_one":        "License: 1 account only",
    "setup.license_max":        (n) => `Max ${n} accounts`,
    "setup.users_count":        (n) => `${n} user${n !== 1 ? "s" : ""}`,
    "setup.accounts_count":     (n) => `${n} account${n !== 1 ? "s" : ""}`,
    "setup.days_count":         (n) => `${n} day${n !== 1 ? "s" : ""}`,
    // run page extra
    "run.phase_complete":  "Complete ✓",
    "run.phase_running":   "Running...",
    "run.stop_title":      "Stop the bot?",
    "run.stop_msg":        "The current run will be terminated immediately. Any orders not yet uploaded will be lost.",
    // previously hardcoded strings — now translated
    "setup.khod_pass_hint":       "Leave blank to keep existing password",
    "results.run_failed":         "Bot run failed",
    "results.error_occurred":     "An error occurred. Check the log for details.",
    "results.multi_all_ok":       "All accounts completed successfully.",
    "results.multi_some_errors":  "Some accounts had errors. Select an account from the dropdown to see details and download.",
    "run.all_accounts":           "🌐 All Accounts",
    "results.all_accounts":       "🌐 All Accounts — Overview",
    "results.per_account_summary":"📊 Per-Account Summary",
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
    "run.restart_wait":   "انتظر — إعادة المحاولة خلال",
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
    // setup page — accounts step
    "setup.nav_accounts":       "الحسابات",
    "setup.nav_run":            "التشغيل",
    "setup.sub_title":          "الإعداد",
    "setup.reset_creds_btn":    "🔄 إعادة تعيين بيانات الدخول",
    "setup.manage_title":       "إدارة الحسابات",
    "setup.manage_sub":         "أضف، عدّل، أو احذف حساباتك. يتم اختيار الحسابات في الخطوة التالية.",
    "setup.your_accounts":      "حساباتك",
    "setup.your_accounts_desc": "إدارة الحسابات المتاحة لتشغيل المهام.",
    "setup.add_account":        "إضافة حساب",
    "setup.next_btn":           "التالي: إعداد التشغيل ←",
    "setup.run_title":          "تنفيذ التشغيل",
    "setup.run_sub":            "اختر المستخدمين وحدد التاريخ ثم ابدأ.",
    "setup.select_users":       "اختر المستخدمين",
    "setup.select_users_desc":  "اختر مستخدماً واحداً أو أكثر لتشغيل المهمة.",
    "setup.all_users":          "جميع المستخدمين",
    "setup.select_all":         "تحديد الكل",
    "setup.select_date":        "اختر التاريخ",
    "setup.select_date_desc":   "حدد موعد تشغيل المهمة.",
    "setup.today_mode":         "📅 اليوم",
    "setup.single_mode":        "🗓️ يوم واحد",
    "setup.range_mode":         "📆 نطاق",
    "setup.summary":            "الملخص",
    "setup.summary_desc":       "راجع اختياراتك قبل التشغيل.",
    "setup.users_selected":     "المستخدمون المحددون",
    "setup.date_range":         "نطاق التاريخ",
    "setup.total_days":         "إجمالي الأيام",
    "setup.back_btn":           "→ رجوع",
    "setup.run_btn":            "🚀 تنفيذ التشغيل",
    "setup.run_security":       "🔒 سيتم تنفيذ هذا الإجراء للمستخدمين المحددين ونطاق التاريخ.",
    "setup.date_label":         "التاريخ",
    "setup.start_date":         "تاريخ البداية",
    "setup.end_date":           "تاريخ النهاية",
    "setup.today_running":      (d) => `✅ التشغيل لليوم — ${d}`,
    "setup.locked":             "مقفل",
    "setup.active":             "نشط",
    "setup.edit_btn":           "✏️ تعديل",
    "setup.edit_account":       "تعديل الحساب",
    "setup.new_account":        "حساب جديد",
    "setup.form_subtitle":      "أدخل بيانات الاعتماد لهذا الحساب.",
    "setup.keep_pass":          "اتركه فارغاً للإبقاء على كلمة المرور الحالية",
    "setup.cancel_btn":         "إلغاء",
    "setup.save_btn2":          "💾 حفظ",
    "setup.add_btn":            "➕ إضافة حساب",
    "setup.saving":             "جارٍ الحفظ...",
    "setup.limit_reached":      "تم الوصول لحد الترخيص — لا يمكن إضافة المزيد من الحسابات.",
    "setup.save_failed":        "فشل الحفظ.",
    "setup.remove_confirm":     "حذف هذا الحساب؟",
    "setup.reset_confirm_title":"إعادة ضبط جميع البيانات؟",
    "setup.reset_confirm_msg":  "سيتم حذف جميع بيانات الدخول المحفوظة والجلسات والكوكيز. ستحتاج إلى إعادة إدخال بيانات الدخول.",
    "setup.reset_confirm_ok":   "إعادة ضبط الكل",
    "setup.reset_confirm_cancel":"إلغاء",
    "setup.locked_title":       "مقفل من المشرف — تواصل مع الدعم لإعادة الضبط",
    "setup.license_one":        "الترخيص: حساب واحد فقط",
    "setup.license_max":        (n) => `الحد الأقصى ${n} حسابات`,
    "setup.users_count":        (n) => `${n} ${n === 1 ? "مستخدم" : "مستخدمين"}`,
    "setup.accounts_count":     (n) => `${n} ${n === 1 ? "حساب" : "حسابات"}`,
    "setup.days_count":         (n) => `${n} ${n === 1 ? "يوم" : "أيام"}`,
    // run page extra
    "run.phase_complete":  "اكتمل ✓",
    "run.phase_running":   "جارٍ...",
    "run.stop_title":      "إيقاف البوت؟",
    "run.stop_msg":        "سيتم إنهاء التشغيل الحالي فوراً. أي طلبات لم يتم رفعها بعد ستُفقد.",
    // previously hardcoded strings — now translated
    "setup.khod_pass_hint":       "اتركه فارغاً للإبقاء على كلمة المرور الحالية",
    "results.run_failed":         "فشل تشغيل البوت",
    "results.error_occurred":     "حدث خطأ. راجع السجل للتفاصيل.",
    "results.multi_all_ok":       "اكتملت جميع الحسابات بنجاح.",
    "results.multi_some_errors":  "بعض الحسابات واجهت أخطاء. اختر حساباً من القائمة لرؤية التفاصيل والتنزيل.",
    "run.all_accounts":           "🌐 جميع الحسابات",
    "results.all_accounts":       "🌐 جميع الحسابات — نظرة عامة",
    "results.per_account_summary":"📊 ملخص لكل حساب",
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
let _topBarName = null, _topBarDays = null, _topBarAvatar = null, _topBarAccounts = null;
function updateTopBarText() {
  if (!_topBarName)     _topBarName     = document.getElementById("top-bar-name");
  if (!_topBarDays)     _topBarDays     = document.getElementById("top-bar-days");
  if (!_topBarAvatar)   _topBarAvatar   = document.getElementById("top-bar-avatar");
  if (!_topBarAccounts) _topBarAccounts = document.getElementById("top-bar-accounts");
  if (!_topBarName) return;

  const { customerName, daysLeft } = window._kbotUser;
  const welcomeFn = window._t("topbar.welcome");
  _topBarName.textContent = typeof welcomeFn === "function" ? welcomeFn(customerName) : welcomeFn;
  const daysFn = window._t("topbar.days");
  _topBarDays.textContent = typeof daysFn === "function" ? daysFn(daysLeft) : "";
  _topBarDays.classList.toggle("warn", daysLeft !== null && daysLeft <= 7);

  // Show accounts badge if license allows more than 1
  const maxAcc = window._maxAccounts || 1;
  if (_topBarAccounts) {
    if (maxAcc > 1) {
      const licFn = window._t("setup.license_max");
      _topBarAccounts.textContent = typeof licFn === "function" ? licFn(maxAcc) : (maxAcc + " accounts");
      _topBarAccounts.style.display = "block";
    } else {
      _topBarAccounts.style.display = "none";
    }
  }

  if (_topBarAvatar && customerName) {
    const parts = customerName.trim().split(" ");
    _topBarAvatar.textContent = parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : customerName.slice(0, 2).toUpperCase();
  }
}

// ── Top bar visibility ──
const PAGES_WITH_TOPBAR = new Set(["page-setup", "page-run"]);

// Dismiss the preloader exactly once — on the first showPage() call.
// At this point a real page has been rendered into the DOM, so there
// is no black-screen gap between loader exit and content appearing.
let _preloaderDismissed = false;
function dismissPreloader() {
  if (_preloaderDismissed) return;
  _preloaderDismissed = true;
  const preloader = document.getElementById("preloader");
  if (!preloader) return;
  preloader.style.transition = "opacity 0.25s ease";
  preloader.style.opacity = "0";
  setTimeout(() => { if (preloader.parentNode) preloader.remove(); }, 260);
}

function showPage(id) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  const centerEl = document.getElementById("top-bar-center");
  if (centerEl) centerEl.classList.toggle("visible", PAGES_WITH_TOPBAR.has(id));
  // Dismiss preloader now — content is in the DOM
  dismissPreloader();
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
    applyLang(settings.lang  || "ar");
  } catch(e) {
    applyTheme("dark");
    applyLang("ar");
  }

  document.getElementById("toggle-theme").addEventListener("change", (e) => {
    const next = e.target.checked ? "light" : "dark";
    applyTheme(next);
    window.api.saveSettings({ theme: next }).catch(() => {});
  });
  document.getElementById("toggle-lang").addEventListener("change", (e) => {
    const next = e.target.checked ? "ar" : "en";
    applyLang(next);
    reRenderCurrentPage();
    // Persist in background — don't await so UI is never blocked
    window.api.saveSettings({ lang: next }).catch(() => {});
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

  window.api.removeAllListeners("license-expired");
  window.api.onLicenseExpired(() => {
    clearInterval(licenseCheckInterval);
    renderLicense(() => afterLicense());
    showPage("page-license");
  });

  startPeriodicLicenseCheck();

  // creds already fetched above via Promise.all — reuse it
  window._maxAccounts = creds.maxAccounts || 1;
  window._kbotAccounts = creds.accounts || [];
  updateTopBarText();
  // Route based on credential state:
  // - Accounts exist → skip the accounts management step, go straight to run step
  // - No accounts    → land on accounts step so user can add their first account
  const hasAccounts = (creds.accounts && creds.accounts.length > 0) || !!creds.easyEmail;
  goToSetup(hasAccounts ? "run" : "accounts");
}

async function afterLicense() {
  window.api.removeAllListeners("license-expired");
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
  window._maxAccounts = creds.maxAccounts || 1;
  window._kbotAccounts = creds.accounts || [];
  const hasAccounts = (creds.accounts && creds.accounts.length > 0) || !!creds.easyEmail;
  goToSetup(hasAccounts ? "run" : "accounts");
}

function goToSetup(initialStep) {
  renderSetup((params) => {
    if (params && params.dateFrom) {
      sessionDate = { dateFrom: params.dateFrom, dateTo: params.dateTo };
      goToRun(params.dateFrom, params.dateTo, params.selectedAccountIds);
    } else {
      goToSetup("accounts");
    }
  }, initialStep || "accounts");
  showPage("page-setup");
}

function goToRun(dateFrom, dateTo, selectedAccountIds) {
  renderRun(dateFrom, dateTo, selectedAccountIds || [], (resultData) => {
    goToResults(resultData, dateFrom, dateTo);
  }, () => {
    goToSetup("run");
  });
  showPage("page-run");
}

function goToResults(data, dateFrom, dateTo) {
  renderResults(
    data, dateFrom, dateTo,
    () => { goToRun(dateFrom, dateTo); },
    () => { sessionDate = null; goToSetup("run"); }
  );
  showPage("page-results");
}

// ── Re-render current page when language switches ──
function reRenderCurrentPage() {
  const active = document.querySelector(".page.active");
  if (!active) return;
  const id = active.id;
  if (id === "page-setup") {
    // Use in-place re-render if the setup page registered one (preserves step/state).
    // Fall back to full goToSetup() only when no in-place renderer is registered.
    if (typeof window._renderSetupInPlace === "function") {
      window._renderSetupInPlace();
    } else {
      goToSetup();
    }
  } else if (id === "page-run") {
    // Do NOT re-render the run page while the bot is active —
    // tearing down the DOM mid-run destroys all IPC listeners and crashes the UI.
    // Instead, just update the translatable text elements in place.
    updateRunPageTranslations();
  }
  // page-results: no re-render needed; results are static data
}

// ── Lightweight translation update for the run page (no DOM teardown) ──
function updateRunPageTranslations() {
  const t = window._t;

  // 1. Flip document direction & lang
  document.documentElement.setAttribute("dir",  window._kbotLang === "ar" ? "rtl" : "ltr");
  document.documentElement.setAttribute("lang", window._kbotLang);

  // 2. All elements with data-i18n — plain string keys only
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const val = t(key);
    if (typeof val === "string") el.textContent = val;
  });

  // 3. Phase labels that are still in "waiting" state — update their text
  //    (active/done phases get their text set dynamically by setPhaseActive/updatePhases,
  //     so we only touch ones still showing the generic waiting string)
  for (let i = 0; i < 5; i++) {
    const lbl = document.getElementById(`phase-label-${i}`);
    if (!lbl) continue;
    // Only update if this phase hasn't started yet (dot has no active/done class)
    const dot = document.getElementById(`dot-${i}`);
    if (dot && !dot.classList.contains("active") && !dot.classList.contains("done")) {
      lbl.textContent = t("run.waiting");
    }
  }

  // 4. Refresh top bar text
  updateTopBarText();
}

// Start
init();
