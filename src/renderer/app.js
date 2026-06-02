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
    "topbar.analytics":   "Analytics",
    "topbar.operations":  "Operations",
    "topbar.dashboard":   "Dashboard",
    "titlebar.sync":      "Sync",
    "titlebar.sync_tooltip": "Sync license and account permissions from the admin panel.",
    "titlebar.lang_tooltip": "Switch between English and Arabic.",
    "titlebar.theme_tooltip": "Switch between light and dark theme.",
    "titlebar.minimize": "Minimize window",
    "titlebar.maximize": "Maximize or restore window",
    "titlebar.close": "Close Khod Whaat Order Bot",
    "setup.nav_dashboard": "Dashboard",
    "setup.nav_ai": "Khod Whaat AI",
    "setup.update_dashboard_btn": "Update Dashboard",
    "setup.title":        "Welcome to Khod Whaat Bot ⚡",
    "setup.subtitle":     "Enter your credentials once — they're stored securely on this device.",
    "setup.easy_section": "📦 Easy-Orders Account",
    "setup.khod_section": "🛒 Khod Whaat Account",
    "setup.country_label": "Country",
    "setup.country_sa": "🇸🇦 Saudi Arabia (SA)",
    "setup.country_sa_only": "Khod Whaat currently supports Saudi Arabia only.",
    "setup.store_label":  "Store Name",
    "setup.store_hint":   "(required)",
    "setup.store_ph":     "e.g. themnzl",
    "setup.account_identity_section": "Account Display",
    "setup.account_name_label": "Account Name",
    "setup.account_name_ph": "e.g. Riyadh Team, Main Store",
    "setup.account_name_hint": "Shown first in account lists; email stays underneath for reference.",
    "setup.email_label":  "Email",
    "setup.email_ph":     "you@example.com",
    "setup.pass_label":   "Password",
    "setup.khod_email_ph":"affiliate@khod-whaat.com",
    "setup.save_btn":     "Save & Continue →",
    "setup.err_missing":  "<strong>Missing fields</strong> — All required fields must be filled.",
    "setup.err_locked":   "<strong>Account Locked</strong> — This license is already linked to different accounts. Contact support to change them.",
    "welcome.app_title":      "Khod Whaat Order Bot",
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
    "run.phase3":         "Khod Whaat Login & Export",
    "run.phase4":         "Create Orders in Easy-Orders",
    "run.waiting":        "Waiting...",
    "run.2fa_title":      "2FA Required",
    "run.2fa_msg":        "Complete two-step verification in the browser window, then return here.",
    "run.confirm_title":  "Action Required — Review & Confirm Orders",
    "run.confirm_msg":    "Review in the browser window, then click <strong>تأكيد كل الطلبات</strong>. Bot is waiting (up to 10 min).",
    "run.restart_title":  "Khod Whaat Export Failed — Restarting Automatically",
    "run.restart_wait":   "Please wait — retrying in",
    "run.ratelimit_title":"Rate Limit — Cooldown in Progress",
    "run.creating":       "📤 Creating Orders in Easy-Orders",
    "run.live_log":       "Live Log",
    "run.cooldown_label": "Cooldown — Easy-Orders Rate Limit",
    "run.cooldown_next":  "Next run available in",
    "run.preview_header": (n) => `📋 ${n} orders ready — uploading now`,
    "run.preview_cols":   ["Product", "Qty", "Price", "Date", "City", "Name", "Phone"],
    "run.search_orders_placeholder": "Search by name, phone or product...",
    "run.progress_start": "Starting...",
    "results.title":      (d) => `Results — ${d}`,
    "results.completed":  "Bot run completed",
    "results.home":       "🏠 Home",
    "results.run_again":  "🔄 Run Again",
    "results.download":   "⬇️ Download Excel",
    "results.download_failed": "⬇️ Download Failed Orders",
    "results.couldnt_process_btn": "Couldn’t Process",
    "results.couldnt_process_title": (n) => `Couldn’t Process — ${n} order${n !== 1 ? "s" : ""}`,
    "results.skipped_followup": "These orders were filtered before upload — follow up manually",
    "results.raw_phone_col": "Raw Phone",
    "results.reason_col": "Reason",
    "results.reason_phone_parse_failed": "Invalid phone number",
    "results.reason_phone_uncertain_zero_appended": "Phone missing digit — trailing 0 added (uncertain)",
    "results.reason_product_not_in_catalog": "Product not found in catalog",
    "results.search_orders_placeholder": "Search by name, phone or product...",
    "results.phone_rescued_verify": "Phone rescued with trailing 0 — verify before calling",
    "results.new_orders": "New Orders",
    "results.in_khod":    "Already in Khod Whaat",
    "results.dupes":      "Duplicates Removed",
    "results.failed":     "Failed on Khod Whaat",
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
    "results.fail_title": (n) => `${n} Order${n > 1 ? "s" : ""} Failed — Rejected by Khod Whaat`,
    "results.product_count": (n) => n === 1 ? "order" : "orders",
    "results.fail_saved": "Saved to your device. Check the folder for details.",
    "results.open_folder":"📁 Open Folder",
    "results.all_ok":     "<strong>All orders uploaded and confirmed</strong> No failed orders this run.",
    "results.row":        "Row",
    "results.sku":        "SKU",
    "results.phone":      "Phone",
    "results.error":      "Error",
    // setup page — accounts step
    "setup.nav_accounts":       "Accounts",
    "setup.nav_analytics":      "Analytics",
    "setup.nav_operations":     "Operations",
    "setup.nav_run":            "Run",
    "setup.sub_title":          "Setup",
    "setup.reset_creds_btn":    "Reset Credentials",
    "setup.check_updates_btn":  "Check for Updates",
    "setup.checking_updates":   "\u{23F3} Checking...",
    "update.btn_title_checking": "Checking for updates...",
    "update.btn_title_check":    "Check for updates",
    "update.downloading_action": "Downloading...",
    "update.dev_title":          "Dev Mode",
    "update.dev_sub":            "Auto-update only works in packaged app.",
    "update.ok":                 "OK",
    "update.check_failed_title": "Update Check Failed",
    "update.unknown_error":      "Unknown error",
    "update.dismiss":            "Dismiss",
    "update.available_title":    (v) => `Update v${v} Available`,
    "update.available_sub":      "A new version is ready to download.",
    "update.download_update":    "Download Update",
    "update.up_to_date_title":   "You're up to date",
    "update.up_to_date_sub":     "No new version found.",
    "update.downloading_title":  "Downloading Update...",
    "update.download_progress":  (p) => `${p}% complete`,
    "update.ready_title":        "Update Ready to Install",
    "update.ready_sub":          "Restart the app to apply the update.",
    "update.restart_install":    "\u{1F680} Restart & Install",
    "update.error_title":        "Update Error",
    "update.error_sub":          "An unknown error occurred during update.",
    "setup.manage_title":       "Manage Accounts",
    "setup.manage_sub":         "Add, edit, or remove your accounts. Selection happens on the next step.",
    "setup.your_accounts":      "Your Accounts",
    "setup.your_accounts_desc": "Manage the accounts available for running tasks.",
    "setup.add_account":        "Add Account",
    "setup.next_btn":           "Next: Run Setup →",
    "setup.continue_date":      "Continue to date",
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
    "setup.select_user_to_launch":"Select at least one user to launch.",
    "setup.date_label":         "Date",
    "setup.start_date":         "Start Date",
    "setup.end_date":           "End Date",
    "setup.today_running":      (d) => `✅ Selected: Today - ${d}`,
    "setup.locked":             "Locked",
    "setup.active":             "Active",
    "setup.edit_btn":           "✏️ Edit",
    "setup.rename_btn":         "Rename",
    "setup.edit_account":       "Edit Account",
    "setup.rename_account":     "Rename Account",
    "setup.add_member_name":     "+ Member Name",
    "setup.edit_member_name":    "Edit Member Name",
    "setup.member_name_title":   "Member Name",
    "setup.member_name_subtitle":"Name this account for your team. Credentials stay unchanged.",
    "setup.member_name_label":   "Member Name",
    "setup.member_name_ph":      "e.g. Ahmed - Riyadh team",
    "setup.member_name_hint":    "This name appears first across the app. If empty, we show the email instead.",
    "setup.clear_member_name":   "Clear",
    "setup.save_member_name":    "Save Name",
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
    "run.stop_cancel":     "Cancel",
    "run.stop_confirm":    "Stop Bot",
    // previously hardcoded strings — now translated
    "setup.khod_pass_hint":       "Leave blank to keep existing password",
    "results.run_failed":         "Bot run failed",
    "results.error_occurred":     "An error occurred. Check the log for details.",
    "results.multi_all_ok":       "All accounts completed successfully.",
    "results.multi_some_errors":  "Some accounts had errors. Select an account from the dropdown to see details and download.",
    "run.all_accounts":           "🌐 All Accounts",
    "results.all_accounts":       "🌐 All Accounts — Overview",
    "results.per_account_summary":"📊 Per-Account Summary",
    // welcome page account selector
    "welcome.select_accounts":    "Select Accounts",
    "welcome.acc_selected":       (n) => `${n} selected`,
    "welcome.parallel_hint":      "Selecting multiple accounts will run them in parallel, each in its own Chrome window.",
    // run page badge / log strings
    "run.badge_running":          "● Running",
    "run.badge_stopped":          "⏹ Stopped",
    "run.badge_done":             "✅ Done",
    "run.badge_all_done":         "✅ All Done",
    "run.badge_done_errors":      "⚠️ Done with errors",
    "run.badge_failed":           "❌ Failed",
    "run.badge_license_expired":  "🔒 License Expired",
    "run.badge_awaiting":         "👀 Awaiting Confirmation",
    "run.badge_cooldown":         "⏸️ Cooldown",
    "run.badge_restarting":       "🔄 Restarting...",
    "run.badge_uploading":        (c, tot) => `📤 Uploading ${c}/${tot}`,
    "run.badge_uploading_short":  "📤 Uploading",
    "run.badge_action_required":  "👀 Action Required",
    "run.orders_ready":           "Orders Ready",
    "run.log_starting":           "🚀 Starting bot...",
    "run.log_date_range":         (f, to) => `📅 Date range: ${f} → ${to}`,
    "run.log_completed":          "✅ Bot completed successfully!",
    "run.log_license_expired":    "🔒 License key has expired. Please enter your license for this month.",
    "run.log_license_expired_short": "🔒 License key has expired.",
    "run.notif_action_title":     "Khod Whaat Bot — Action Required",
    "run.notif_action_body":      "Please review and confirm orders in the browser window.",
    "run.notif_2fa_title":        (tag) => `2FA Required${tag}`,
    "run.notif_2fa_body":         "Check the browser window.",
    "run.notif_confirm_title":    (tag) => `Action Required${tag}`,
    "run.notif_confirm_body":     "Confirm orders in the browser.",
    "run.cooldown_attempt":       (a, m, s) => `Attempt ${a}/${m} — waiting ${s}s before re-triggering export.`,
    "run.restart_reason":         (r) => `Reason: ${r}`,
    "run.restart_attempt":        (a, m) => `Attempt ${a}/${m}`,
    "run.all_phases_done":        "All phases done",
    "run.all_accounts_label":     "All Accounts",
    "run.showing_label":          "Showing:",
    "run.phase_status_n":         (n) => `🔄 Phase ${n}`,
    "run.phase_status_active":    "🔄 Running",
    "run.click_to_copy":          "click any cell to copy",
    "run.click_cells_copy":       "click cells to copy",
    "run.download":               "Download",
    "run.upload_placeholder":     "Upload progress and order table will appear here",
    "run.no_new_orders_found":    "No New Orders Found",
    // results page strings
    "results.unknown":            "Unknown",
    "results.no_product_data":    "No product data",
    "results.no_error_info":      "No detailed error info available.",
    "results.product_col":        "Product",
    "results.customer_name_col":  "Customer Name",
    "results.phone_col":          "Phone",
    "results.qty_col":            "Qty",
    "results.price_col":          "Price",
    "results.city_col":           "City",
    "results.orders_col":         "Orders",
    "results.total_qty_col":      "Total Qty",
    "results.account_col":        "Account",
    "results.status_col":         "Status",
    "results.row_col":            "Row",
    "results.error_col":          "Error",
    "results.ok_status":          "OK",
    "results.error_status":       "Error",
    "results.all_orders_label":   "All Orders",
    "results.all_uploaded":       "All Uploaded Orders",
    "results.all_uploaded_all":   "All Uploaded Orders — All Accounts",
    "results.upload_success_rate":"Upload Success Rate",
    "results.overall_success_rate":"Overall Success Rate",
    "results.orders_by_product":  "Orders by Product",
    "results.order_sources":      "Order Sources",
    "results.uploaded_orders_title": "Uploaded Orders",
    "results.all_products_combined":"All Products — Combined",
    "results.failed_uploads_total":"Failed uploads total",
    "results.all_uploaded_ok":    "All uploaded OK",
    "results.already_in_system":  "Already in system",
    "results.duplicate_phone":    "Duplicate phone+product",
    "results.sent_to_easy":       "Orders sent to Easy-Orders",
    "results.failed_uploads":     "Failed uploads",
    "results.all_ok_short":       "All OK",
    "results.orders_failed_upload":"Orders that failed to upload",
    "results.all_orders_ok":      "All orders uploaded OK",
    "results.succeeded":          (n) => `✅ ${n} succeeded`,
    "results.total_attempted":    (n) => `${n} total attempted`,
    "results.already_in_khod_n":  (n) => `+${n} already in Khod Whaat`,
    "results.across_accounts":    "Across all accounts",
    "results.products_click":     (n) => `${n} products · click to copy`,
    "results.accounts_click":     (n) => `${n} accounts · click for details`,
    "results.orders_count":       (n) => `(${n} orders)`,
    "results.select_acc_sidebar": "select an account in the sidebar to see its details",
    "results.uploading_detail":   (c, tot, s, f) => `📤 Uploading: ${c}/${tot} · ✅${s} ❌${f}`,
    // setup page cancel button
    "setup.cancel_btn":           "Cancel",
    "run.tab_status":             "⚙️ Status & Progress",
    "run.tab_log":                "📋 Live Log",
    "run.phases_header":          "⚙️ Phases",
    "run.waiting_upload":         "Waiting for upload data…",
    "run.switch_live_log":        "Switch to Live Log tab to see real-time output",
    "run.click_account_card":     "Click any account card to see its details, or switch to Live Log tab to see real-time output",
    "run.acc_status_col":         "Status",
    // New keys for hardcoded strings
    "run.accounts_subtitle":      (n, d) => `📅 ${d} · ${n} accounts`,
    "run.n_running":              (n) => `${n} running`,
    "run.bot_stopped_user":       "⏹ Bot stopped by user.",
    "run.all_bots_stopped":       "⏹ All bots stopped by user.",
    "run.bot_failed":             (e) => `❌ Bot failed: ${e}`,
    "run.notif_error_title":      "Khod Whaat Bot — Error",
    "run.notif_error_body":       (e) => e || "Bot failed. Check the log.",
    "run.orders_all_in_khod":     "All orders in this date range are already in Khod Whaat or were skipped.",
    "run.acc_label_default":      (n) => `Account ${n}`,
    "run.acc_done_banner":        (label) => `✅ Completed — ${label}`,
    "run.acc_failed_banner":      (label) => `❌ Failed — ${label}`,
    "run.preview_saved":          (path) => `✅ Preview saved: ${path}`,
    "run.preview_ready_log":      (label, n) => `📋 [${label}] ${n} orders ready — uploading now`,
    "run.log_new_orders":         (n) => `📊 New orders: ${n}`,
    "run.stat_real_scanned":      "Real Orders Scanned",
    "run.stat_missed_scanned":    "Missed Orders Scanned",
    "run.stat_already_khod":      "Already in Khod Whaat",
    "run.stat_duplicate_phones":  "Duplicate Phones",
    "results.toast_saved":        (path) => `✅ Saved to ${path}`,
    "results.accounts_count_label": (n) => `${n} account${n !== 1 ? "s" : ""}`,
    "results.all_accounts_sidebar": "All Accounts",
    "results.accounts_label":     "Accounts",
    "results.n_accounts_ok":      (total, ok) => `${total} accounts · ${ok} OK`,
    "setup.date_range_err":       "End date must be after the start date. Please fix the range.",
    "setup.date_before_start":    "⚠️ End date before start",
    "setup.add_new_account_title":"Add new account",
    "setup.admin_reset_title":    "Admin has granted a one-time reset. Click to clear all accounts and sessions.",
    "setup.locked_reset_title":   "Locked — contact admin to enable a reset from the admin panel.",
    "setup.account_fallback":     "Account",
    "ui.ok":                      "OK",
    "ui.cancel":                  "Cancel",
    "ui.dismiss":                 "Dismiss",
    "ui.retry":                   "Retry",
    "ui.loading":                 "Loading...",
    "ui.confirm_title":           "Are you sure?",
    "ui.toast_success":           "Done",
    "ui.toast_error":             "Something went wrong",
    "ui.toast_info":              "Updated",
    "ui.help":                    "Help",
    "dashboard.fetching_title":    "Updating dashboard...",
    "dashboard.fetching_body":     "Fetching orders, refreshing product data, and matching ad spend across accounts. This can take a few minutes; keep the app open.",
    "dashboard.initial_sync_title": "Syncing dashboard data...",
    "dashboard.initial_sync_body":  "Preparing saved orders, account metrics, product calculators, marketing spend, and AI context. Large workspaces can take a little while.",
    "dashboard.fetching_account":  "Updating {current} of {total}: {account}. Pulling orders, checking product rows, and matching ad spend.",
    "dashboard.fetch_success":     "Dashboard updated",
    "dashboard.fetch_success_body":"Fetched {count} orders across {total} account(s).",
    "dashboard.fetch_partial":     "Dashboard partially updated",
    "dashboard.fetch_partial_body":"Fetched {count} orders from {success} of {total} account(s). Failed: {failed}.",
    "dashboard.fetch_error_title": "Dashboard update failed",
    "dashboard.fetch_error_body":  "Some accounts could not be updated. Try again, or open the dashboard to view the latest saved data.",
    "dashboard.fetch_retry":       "Try again",
    "dashboard.fetch_open":        "Open dashboard",
    "dashboard.fetch_empty_title": "No dashboard data fetched",
    "dashboard.fetch_empty_body":  "The selected accounts returned no orders. Check the account data or try another account.",
    // license page
    "license.title":              "License Required",
    "license.subtitle":           "Enter your license key to activate the app.",
    "license.key_label":          "License Key",
    "license.btn_activate":       "Activate License 🔐",
    "license.btn_verifying":      "Verifying...",
    "license.btn_activated":      "✅ Activated!",
    "license.btn_support":        "Contact Support",
    "license.err_empty":          "Please enter your license key.",
    "license.err_invalid":        "Invalid license key.",
    "license.days_remaining":     (d) => `${d} day(s) remaining`,
    "license.support_hint":       "Contact support if you need a license key.",
    "license.device_hint":        "If you see a \"different device\" error, contact support to reset the device lock.",
    "titlebar.copy_license":      "Copy License",
    "titlebar.copied":            "Copied!",
    // Expired overlay
    "expired.title":              "License Expired",
    "expired.subtitle":           (r) => r || "Your subscription has expired.",
    "expired.sub2":               "Please contact the administrator to renew your license, then press <strong>Renewed — Continue</strong> to resume.",
    "expired.badge_expired":      "● Expired",
    "expired.badge_checking":     "● Checking…",
    "expired.badge_active":       "● Active",
    "expired.btn_continue":       "Renewed — Continue",
    "expired.btn_checking":       "Checking license…",
    "expired.btn_verified":       "✅ Verified — Resuming…",
    "expired.meta_license_id":    "License ID",
    "expired.meta_last_valid":    "Last Validated",
    "expired.meta_remaining":     "Remaining Access",
    "expired.meta_expired":       "Expired",
    "expired.err_still":          (r) => r || "License is still expired. Please contact your administrator.",
    "expired.err_network":        "Could not reach the license server. Check your internet connection.",
    // Calendar widget
    "calendar.months": ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    "calendar.days":   ["Su","Mo","Tu","We","Th","Fr","Sa"],
  },
  ar: {
    "topbar.welcome": (n) => n ? `أهلاً، ${n}` : "أهلاً",
    "topbar.days":    (d) => d != null ? `متبقي ${d} ${d === 1 ? "يوم" : "أيام"}` : "",
    "topbar.expires": "الترخيص ينتهي قريباً",
    "topbar.analytics":  "التحليلات",
    "topbar.operations": "العمليات",
    "topbar.dashboard":  "لوحة التحكم",
    "titlebar.sync":     "مزامنة",
    "titlebar.sync_tooltip": "مزامنة الترخيص وصلاحيات الحسابات من لوحة المشرف.",
    "titlebar.lang_tooltip": "التبديل بين العربية والإنجليزية.",
    "titlebar.theme_tooltip": "التبديل بين الوضع الفاتح والداكن.",
    "titlebar.minimize": "تصغير النافذة",
    "titlebar.maximize": "تكبير أو استعادة النافذة",
    "titlebar.close": "إغلاق Khod Whaat Order Bot",
    "setup.nav_dashboard": "لوحة التحكم",
    "setup.update_dashboard_btn": "تحديث لوحة التحكم",
    "setup.title":        "أهلاً بك في Khod Whaat Bot ⚡",
    "setup.subtitle":     "أدخل بيانات الدخول مرة واحدة — يتم حفظها بشكل آمن على هذا الجهاز.",
    "setup.easy_section": "📦 حساب Easy-Orders",
    "setup.khod_section": "🛒 حساب Khod Whaat",
    "setup.country_label": "الدولة",
    "setup.country_sa": "🇸🇦 السعودية (SA)",
    "setup.country_sa_only": "يدعم Khod Whaat السعودية فقط حالياً.",
    "setup.store_label":  "اسم المتجر",
    "setup.store_hint":   "(مطلوب)",
    "setup.store_ph":     "مثال: themnzl",
    "setup.email_label":  "البريد الإلكتروني",
    "setup.email_ph":     "you@example.com",
    "setup.pass_label":   "كلمة المرور",
    "setup.khod_email_ph":"affiliate@khod-whaat.com",
    "setup.save_btn":     "حفظ والمتابعة ←",
    "setup.err_missing":  "<strong>حقول مفقودة</strong> — يجب ملء جميع الحقول المطلوبة.",
    "setup.err_locked":   "<strong>حساب مقفل</strong> — هذا الترخيص مرتبط بحسابات مختلفة. تواصل مع الدعم.",
    "welcome.app_title":      "بوت طلبات Khod Whaat",
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
    "run.phase3":         "تسجيل دخول Khod Whaat وتصديره",
    "run.phase4":         "إنشاء الطلبات في Easy-Orders",
    "run.waiting":        "في الانتظار...",
    "run.2fa_title":      "مطلوب التحقق الثنائي",
    "run.2fa_msg":        "أكمل التحقق في نافذة المتصفح ثم عد هنا.",
    "run.confirm_title":  "إجراء مطلوب — راجع الطلبات وأكدها",
    "run.confirm_msg":    "راجع في نافذة المتصفح ثم انقر <strong>تأكيد كل الطلبات</strong>. البوت ينتظر (حتى 10 دقائق).",
    "run.restart_title":  "فشل تصدير Khod Whaat — إعادة المحاولة تلقائياً",
    "run.restart_wait":   "انتظر — إعادة المحاولة خلال",
    "run.ratelimit_title":"حد المعدل — انتظار...",
    "run.creating":       "📤 إنشاء الطلبات في Easy-Orders",
    "run.live_log":       "السجل المباشر",
    "run.cooldown_label": "انتظار — حد معدل Easy-Orders",
    "run.cooldown_next":  "التشغيل التالي خلال",
    "run.preview_header": (n) => `📋 ${n} طلب جاهز — جارٍ الرفع`,
    "run.preview_cols":   ["المنتج", "الكمية", "السعر", "التاريخ", "المدينة", "الاسم", "الهاتف"],
    "run.search_orders_placeholder": "ابحث بالاسم أو الهاتف أو المنتج...",
    "run.progress_start": "جارٍ البدء...",
    "results.title":      (d) => `النتائج — ${d}`,
    "results.completed":  "اكتمل تشغيل البوت",
    "results.home":       "🏠 الرئيسية",
    "results.run_again":  "🔄 تشغيل مجدداً",
    "results.download":   "⬇️ تحميل Excel",
    "results.download_failed": "⬇️ تحميل الطلبات الفاشلة",
    "results.couldnt_process_btn": "تعذر معالجتها",
    "results.couldnt_process_title": (n) => `تعذر معالجة ${n} ${n === 1 ? "طلب" : "طلبات"}`,
    "results.skipped_followup": "تم استبعاد هذه الطلبات قبل الرفع — راجعها يدويًا",
    "results.raw_phone_col": "الهاتف الأصلي",
    "results.reason_col": "السبب",
    "results.reason_phone_parse_failed": "رقم الهاتف غير صالح",
    "results.reason_phone_uncertain_zero_appended": "رقم الهاتف ناقص — تمت إضافة 0 في النهاية مع الحاجة للمراجعة",
    "results.reason_product_not_in_catalog": "المنتج غير موجود في الكتالوج",
    "results.search_orders_placeholder": "ابحث بالاسم أو الهاتف أو المنتج...",
    "results.phone_rescued_verify": "تم تعديل الهاتف بإضافة 0 في النهاية — راجعه قبل الاتصال",
    "results.new_orders": "طلبات جديدة",
    "results.in_khod":    "موجودة في Khod Whaat",
    "results.dupes":      "مكررات محذوفة",
    "results.failed":     "فشلت في Khod Whaat",
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
    "results.fail_title": (n) => `${n} طلب فشل — رُفض من Khod Whaat`,
    "results.product_count": (n) => n === 1 ? "طلب" : "طلبات",
    "results.fail_saved": "تم الحفظ على جهازك. افتح المجلد للتفاصيل.",
    "results.open_folder":"📁 فتح المجلد",
    "results.all_ok":     "<strong>تم رفع وتأكيد جميع الطلبات</strong> لا طلبات فاشلة في هذه الجولة.",
    "results.row":        "الصف",
    "results.sku":        "الكود",
    "results.phone":      "الهاتف",
    "results.error":      "الخطأ",
    // setup page — accounts step
    "setup.nav_accounts":       "الحسابات",
    "setup.nav_analytics":      "التحليلات",
    "setup.nav_operations":     "العمليات",
    "setup.nav_run":            "التشغيل",
    "setup.sub_title":          "الإعداد",
    "setup.reset_creds_btn":    "إعادة تعيين بيانات الدخول",
    "setup.check_updates_btn":  "\u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u062a\u062d\u062f\u064a\u062b\u0627\u062a",
    "setup.checking_updates":   "\u{23F3} \u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u0642\u0642...",
    "update.btn_title_checking": "\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u062a\u062d\u062f\u064a\u062b\u0627\u062a...",
    "update.btn_title_check":    "\u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u062a\u062d\u062f\u064a\u062b\u0627\u062a",
    "update.downloading_action": "\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u0645\u064a\u0644...",
    "update.dev_title":          "\u0648\u0636\u0639 \u0627\u0644\u062a\u0637\u0648\u064a\u0631",
    "update.dev_sub":            "\u0627\u0644\u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062a\u0644\u0642\u0627\u0626\u064a \u064a\u0639\u0645\u0644 \u0641\u0642\u0637 \u0641\u064a \u0627\u0644\u0646\u0633\u062e\u0629 \u0627\u0644\u0645\u062b\u0628\u062a\u0629.",
    "update.ok":                 "\u062d\u0633\u0646\u0627\u064b",
    "update.check_failed_title": "\u0641\u0634\u0644 \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u062a\u062d\u062f\u064a\u062b",
    "update.unknown_error":      "\u062e\u0637\u0623 \u063a\u064a\u0631 \u0645\u0639\u0631\u0648\u0641",
    "update.dismiss":            "\u0625\u063a\u0644\u0627\u0642",
    "update.available_title":    (v) => `\u062a\u062d\u062f\u064a\u062b v${v} \u0645\u062a\u0627\u062d`,
    "update.available_sub":      "\u064a\u0648\u062c\u062f \u0625\u0635\u062f\u0627\u0631 \u062c\u062f\u064a\u062f \u062c\u0627\u0647\u0632 \u0644\u0644\u062a\u062d\u0645\u064a\u0644.",
    "update.download_update":    "\u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062a\u062d\u062f\u064a\u062b",
    "update.up_to_date_title":   "\u0623\u0646\u062a \u0639\u0644\u0649 \u0622\u062e\u0631 \u0625\u0635\u062f\u0627\u0631",
    "update.up_to_date_sub":     "\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0625\u0635\u062f\u0627\u0631 \u062c\u062f\u064a\u062f.",
    "update.downloading_title":  "\u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062a\u062d\u062f\u064a\u062b...",
    "update.download_progress":  (p) => `${p}% \u0645\u0643\u062a\u0645\u0644`,
    "update.ready_title":        "\u0627\u0644\u062a\u062d\u062f\u064a\u062b \u062c\u0627\u0647\u0632 \u0644\u0644\u062a\u062b\u0628\u064a\u062a",
    "update.ready_sub":          "\u0623\u0639\u062f \u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u062a\u0637\u0628\u064a\u0642 \u0644\u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u062a\u062d\u062f\u064a\u062b.",
    "update.restart_install":    "\u{1F680} \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0634\u063a\u064a\u0644 \u0648\u0627\u0644\u062a\u062b\u0628\u064a\u062a",
    "update.error_title":        "\u062e\u0637\u0623 \u0641\u064a \u0627\u0644\u062a\u062d\u062f\u064a\u062b",
    "update.error_sub":          "\u062d\u062f\u062b \u062e\u0637\u0623 \u063a\u064a\u0631 \u0645\u0639\u0631\u0648\u0641 \u0623\u062b\u0646\u0627\u0621 \u0627\u0644\u062a\u062d\u062f\u064a\u062b.",
    "setup.manage_title":       "إدارة الحسابات",
    "setup.manage_sub":         "أضف، عدّل، أو احذف حساباتك. يتم اختيار الحسابات في الخطوة التالية.",
    "setup.your_accounts":      "حساباتك",
    "setup.your_accounts_desc": "إدارة الحسابات المتاحة لتشغيل المهام.",
    "setup.add_account":        "إضافة حساب",
    "setup.next_btn":           "التالي: إعداد التشغيل ←",
    "setup.continue_date":      "\u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629 \u0644\u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u062a\u0627\u0631\u064a\u062e",
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
    "setup.select_user_to_launch":"اختر مستخدماً واحداً على الأقل للبدء.",
    "setup.date_label":         "التاريخ",
    "setup.start_date":         "تاريخ البداية",
    "setup.end_date":           "تاريخ النهاية",
    "setup.today_running":      (d) => `✅ المحدد: اليوم - ${d}`,
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
    "run.stop_cancel":     "إلغاء",
    "run.stop_confirm":    "إيقاف البوت",
    // previously hardcoded strings — now translated
    "setup.khod_pass_hint":       "اتركه فارغاً للإبقاء على كلمة المرور الحالية",
    "results.run_failed":         "فشل تشغيل البوت",
    "results.error_occurred":     "حدث خطأ. راجع السجل للتفاصيل.",
    "results.multi_all_ok":       "اكتملت جميع الحسابات بنجاح.",
    "results.multi_some_errors":  "بعض الحسابات واجهت أخطاء. اختر حساباً من القائمة لرؤية التفاصيل والتنزيل.",
    "run.all_accounts":           "🌐 جميع الحسابات",
    "results.all_accounts":       "🌐 جميع الحسابات — نظرة عامة",
    "results.per_account_summary":"📊 ملخص لكل حساب",
    // welcome page account selector
    "welcome.select_accounts":    "اختر الحسابات",
    "welcome.acc_selected":       (n) => `${n} محدد`,
    "welcome.parallel_hint":      "تحديد عدة حسابات سيشغّلها بالتوازي، كل حساب في نافذة Chrome منفصلة.",
    // run page badge / log strings
    "run.badge_running":          "● جارٍ التشغيل",
    "run.badge_stopped":          "⏹ متوقف",
    "run.badge_done":             "✅ اكتمل",
    "run.badge_all_done":         "✅ اكتمل الكل",
    "run.badge_done_errors":      "⚠️ اكتمل مع أخطاء",
    "run.badge_failed":           "❌ فشل",
    "run.badge_license_expired":  "🔒 انتهت صلاحية الترخيص",
    "run.badge_awaiting":         "👀 في انتظار التأكيد",
    "run.badge_cooldown":         "⏸️ انتظار",
    "run.badge_restarting":       "🔄 إعادة المحاولة...",
    "run.badge_uploading":        (c, tot) => `📤 رفع ${c}/${tot}`,
    "run.badge_uploading_short":  "📤 جارٍ الرفع",
    "run.badge_action_required":  "👀 إجراء مطلوب",
    "run.orders_ready":           "الطلبات جاهزة",
    "run.log_starting":           "🚀 جارٍ تشغيل البوت...",
    "run.log_date_range":         (f, to) => `📅 نطاق التاريخ: ${f} → ${to}`,
    "run.log_completed":          "✅ اكتمل تشغيل البوت بنجاح!",
    "run.log_license_expired":    "🔒 انتهت صلاحية الترخيص. يرجى إدخال ترخيص هذا الشهر.",
    "run.log_license_expired_short": "🔒 انتهت صلاحية الترخيص.",
    "run.notif_action_title":     "Khod Whaat Bot — إجراء مطلوب",
    "run.notif_action_body":      "يرجى مراجعة وتأكيد الطلبات في نافذة المتصفح.",
    "run.notif_2fa_title":        (tag) => `مطلوب التحقق الثنائي${tag}`,
    "run.notif_2fa_body":         "راجع نافذة المتصفح.",
    "run.notif_confirm_title":    (tag) => `إجراء مطلوب${tag}`,
    "run.notif_confirm_body":     "أكّد الطلبات في المتصفح.",
    "run.cooldown_attempt":       (a, m, s) => `المحاولة ${a}/${m} — انتظار ${s}ث قبل إعادة المحاولة.`,
    "run.restart_reason":         (r) => `السبب: ${r}`,
    "run.restart_attempt":        (a, m) => `المحاولة ${a}/${m}`,
    "run.all_phases_done":        "اكتملت جميع المراحل",
    "run.all_accounts_label":     "جميع الحسابات",
    "run.showing_label":          "يُعرض:",
    "run.phase_status_n":         (n) => `🔄 المرحلة ${n}`,
    "run.phase_status_active":    "🔄 جارٍ التشغيل",
    "run.click_to_copy":          "انقر على أي خلية للنسخ",
    "run.click_cells_copy":       "انقر للنسخ",
    "run.download":               "تحميل",
    "run.upload_placeholder":     "سيظهر تقدم الرفع وجدول الطلبات هنا",
    "run.no_new_orders_found":    "لا توجد طلبات جديدة",
    // results page strings
    "results.unknown":            "غير معروف",
    "results.no_product_data":    "لا بيانات منتجات",
    "results.no_error_info":      "لا تفاصيل أخطاء متاحة.",
    "results.product_col":        "المنتج",
    "results.customer_name_col":  "اسم العميل",
    "results.phone_col":          "الهاتف",
    "results.qty_col":            "الكمية",
    "results.price_col":          "السعر",
    "results.city_col":           "المدينة",
    "results.orders_col":         "الطلبات",
    "results.total_qty_col":      "إجمالي الكمية",
    "results.account_col":        "الحساب",
    "results.status_col":         "الحالة",
    "results.row_col":            "الصف",
    "results.error_col":          "الخطأ",
    "results.ok_status":          "ناجح",
    "results.error_status":       "خطأ",
    "results.all_orders_label":   "كل الطلبات",
    "results.all_uploaded":       "جميع الطلبات المرفوعة",
    "results.all_uploaded_all":   "جميع الطلبات المرفوعة — كل الحسابات",
    "results.upload_success_rate":"نسبة نجاح الرفع",
    "results.overall_success_rate":"النسبة الإجمالية للنجاح",
    "results.orders_by_product":  "الطلبات حسب المنتج",
    "results.order_sources":      "مصادر الطلبات",
    "results.uploaded_orders_title": "الطلبات المرفوعة",
    "results.all_products_combined":"جميع المنتجات — مجمّعة",
    "results.failed_uploads_total":"إجمالي فشل الرفع",
    "results.all_uploaded_ok":    "تم رفع الكل بنجاح",
    "results.already_in_system":  "موجودة في النظام",
    "results.duplicate_phone":    "رقم هاتف ومنتج مكرر",
    "results.sent_to_easy":       "طلبات أُرسلت إلى Easy-Orders",
    "results.failed_uploads":     "رفع فاشل",
    "results.all_ok_short":       "كل شيء صحيح",
    "results.orders_failed_upload":"طلبات فشل رفعها",
    "results.all_orders_ok":      "تم رفع جميع الطلبات بنجاح",
    "results.succeeded":          (n) => `✅ ${n} نجح`,
    "results.total_attempted":    (n) => `${n} محاولة`,
    "results.already_in_khod_n":  (n) => `+${n} موجودة في Khod Whaat`,
    "results.across_accounts":    "عبر جميع الحسابات",
    "results.products_click":     (n) => `${n} منتج · انقر للنسخ`,
    "results.accounts_click":     (n) => `${n} حسابات · انقر للتفاصيل`,
    "results.orders_count":       (n) => `(${n} طلب)`,
    "results.select_acc_sidebar": "اختر حساباً من الشريط الجانبي لعرض تفاصيله",
    "results.uploading_detail":   (c, tot, s, f) => `📤 رفع: ${c}/${tot} · ✅${s} ❌${f}`,
    // setup page cancel button
    "setup.cancel_btn":           "إلغاء",
    "run.tab_status":             "⚙️ الحالة والتقدم",
    "run.tab_log":                "📋 السجل المباشر",
    "run.phases_header":          "⚙️ المراحل",
    "run.waiting_upload":         "في انتظار بيانات الرفع…",
    "run.switch_live_log":        "انتقل إلى تبويب السجل المباشر لرؤية المخرجات",
    "run.click_account_card":     "انقر على أي بطاقة حساب لعرض تفاصيله، أو انتقل إلى تبويب السجل المباشر",
    "run.acc_status_col":         "الحالة",
    // New keys for hardcoded strings
    "run.accounts_subtitle":      (n, d) => `📅 ${d} · ${n} حسابات`,
    "run.n_running":              (n) => `${n} جارٍ`,
    "run.bot_stopped_user":       "⏹ تم إيقاف البوت من قِبل المستخدم.",
    "run.all_bots_stopped":       "⏹ تم إيقاف جميع البوتات من قِبل المستخدم.",
    "run.bot_failed":             (e) => `❌ فشل البوت: ${e}`,
    "run.notif_error_title":      "بوت Khod Whaat — خطأ",
    "run.notif_error_body":       (e) => e || "فشل البوت. راجع السجل.",
    "run.orders_all_in_khod":     "جميع الطلبات في هذا النطاق موجودة بالفعل في Khod Whaat أو تم تخطيها.",
    "run.acc_label_default":      (n) => `حساب ${n}`,
    "run.acc_done_banner":        (label) => `✅ اكتمل — ${label}`,
    "run.acc_failed_banner":      (label) => `❌ فشل — ${label}`,
    "run.preview_saved":          (path) => `✅ تم حفظ المعاينة: ${path}`,
    "run.preview_ready_log":      (label, n) => `📋 [${label}] ${n} طلب جاهز — جارٍ الرفع`,
    "run.log_new_orders":         (n) => `📊 طلبات جديدة: ${n}`,
    "run.stat_real_scanned":      "الطلبات الفعلية المُفحوصة",
    "run.stat_missed_scanned":    "الطلبات الفائتة المُفحوصة",
    "run.stat_already_khod":      "موجودة في Khod Whaat",
    "run.stat_duplicate_phones":  "أرقام هاتف مكررة",
    "results.toast_saved":        (path) => `✅ تم الحفظ في ${path}`,
    "results.accounts_count_label": (n) => `${n} ${n === 1 ? "حساب" : "حسابات"}`,
    "results.all_accounts_sidebar": "جميع الحسابات",
    "results.accounts_label":     "الحسابات",
    "results.n_accounts_ok":      (total, ok) => `${total} حسابات · ${ok} ناجح`,
    "setup.date_range_err":       "يجب أن يكون تاريخ الانتهاء بعد تاريخ البداية. يرجى تصحيح النطاق.",
    "setup.date_before_start":    "⚠️ تاريخ الانتهاء قبل البداية",
    "setup.add_new_account_title":"إضافة حساب جديد",
    "setup.admin_reset_title":    "منح المشرف إعادة ضبط لمرة واحدة. انقر لمسح جميع الحسابات والجلسات.",
    "setup.locked_reset_title":   "مقفل — تواصل مع المشرف لتفعيل إعادة الضبط.",
    "setup.account_fallback":     "حساب",
    "ui.ok":                      "حسنا",
    "ui.cancel":                  "إلغاء",
    "ui.dismiss":                 "إغلاق",
    "ui.retry":                   "إعادة المحاولة",
    "ui.loading":                 "جاري التحميل...",
    "ui.confirm_title":           "هل أنت متأكد؟",
    "ui.toast_success":           "تم",
    "ui.toast_error":             "حدث خطأ",
    "ui.toast_info":              "تم التحديث",
    "ui.help":                    "مساعدة",
    "dashboard.fetching_title":    "جاري تحديث لوحة التحكم...",
    "dashboard.fetching_body":     "يتم جلب بيانات Khod Whaat الحية. قد يستغرق ذلك بضع دقائق. اترك التطبيق مفتوحا.",
    "dashboard.initial_sync_title": "جاري مزامنة بيانات لوحة التحكم...",
    "dashboard.initial_sync_body":  "تحميل الطلبات وإنفاق تيك توك والحاسبات وإشارات الذكاء.",
    "dashboard.fetching_account":  "تحديث {current} من {total}: {account}",
    "dashboard.fetch_success":     "تم تحديث لوحة التحكم",
    "dashboard.fetch_success_body":"تم جلب {count} طلب عبر {total} حساب.",
    "dashboard.fetch_partial":     "تم تحديث لوحة التحكم جزئيا",
    "dashboard.fetch_partial_body":"تم جلب {count} طلب من {success} من أصل {total} حساب. فشل: {failed}.",
    "dashboard.fetch_error_title": "فشل تحديث لوحة التحكم",
    "dashboard.fetch_error_body":  "تعذر تحديث بعض الحسابات. حاول مرة أخرى، أو افتح لوحة التحكم لعرض آخر بيانات محفوظة.",
    "dashboard.fetch_retry":       "حاول مرة أخرى",
    "dashboard.fetch_open":        "افتح لوحة التحكم",
    "dashboard.fetch_empty_title": "لم يتم جلب بيانات للوحة التحكم",
    "dashboard.fetch_empty_body":  "الحسابات المحددة لم ترجع أي طلبات. تحقق من بيانات الحساب أو جرب حسابا آخر.",
    // license page
    "license.title":              "مطلوب الترخيص",
    "license.subtitle":           "أدخل مفتاح الترخيص لتفعيل التطبيق.",
    "license.key_label":          "مفتاح الترخيص",
    "license.btn_activate":       "تفعيل الترخيص 🔐",
    "license.btn_verifying":      "جارٍ التحقق...",
    "license.btn_activated":      "✅ تم التفعيل!",
    "license.err_empty":          "يرجى إدخال مفتاح الترخيص.",
    "license.err_invalid":        "مفتاح الترخيص غير صالح.",
    "license.days_remaining":     (d) => `متبقي ${d} يوم`,
    "license.support_hint":       "تواصل مع الدعم إذا كنت بحاجة إلى مفتاح ترخيص.",
    "license.device_hint":        "إذا ظهر خطأ \"جهاز مختلف\"، تواصل مع الدعم لإعادة ضبط قفل الجهاز.",
    "titlebar.copy_license":      "نسخ الترخيص",
    "titlebar.copied":            "تم النسخ!",
    // Expired overlay
    "expired.title":              "انتهى الترخيص",
    "expired.subtitle":           (r) => r || "انتهت صلاحية اشتراكك.",
    "expired.sub2":               "يرجى التواصل مع المشرف لتجديد الترخيص، ثم اضغط <strong>تم التجديد — متابعة</strong> للاستئناف.",
    "expired.badge_expired":      "● منتهي",
    "expired.badge_checking":     "● جارٍ التحقق…",
    "expired.badge_active":       "● نشط",
    "expired.btn_continue":       "تم التجديد — متابعة",
    "expired.btn_checking":       "جارٍ التحقق من الترخيص…",
    "expired.btn_verified":       "✅ تم التحقق — جارٍ الاستئناف…",
    "expired.meta_license_id":    "معرّف الترخيص",
    "expired.meta_last_valid":    "آخر تحقق",
    "expired.meta_remaining":     "المدة المتبقية",
    "expired.meta_expired":       "منتهي",
    "expired.err_still":          (r) => r || "الترخيص لا يزال منتهياً. يرجى التواصل مع المشرف.",
    "expired.err_network":        "تعذّر الوصول إلى خادم الترخيص. تحقق من الاتصال بالإنترنت.",
    // Calendar widget
    "calendar.months": ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"],
    "calendar.days":   ["أح","إث","ثل","أر","خم","جم","سب"],
  },
};

// _t: O(1) lookup — no object rebuild per call, no nested closure allocation.
window._t = function(key) {
  const lang = window._kbotLang;
  const map  = _STRINGS[lang] || _STRINGS["en"];
  return map[key] !== undefined ? map[key] : (_STRINGS["en"][key] || key);
};

window.KhodUI = (() => {
  function t(key, fallback) {
    const value = window._t ? window._t(key) : key;
    return typeof value === "string" && value !== key ? value : (fallback || value || key);
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(message, options = {}) {
    const kind = options.kind || "info";
    let host = document.getElementById("khod-toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "khod-toast-host";
      host.setAttribute("aria-live", "polite");
      host.setAttribute("aria-atomic", "false");
      document.body.appendChild(host);
    }
    const item = document.createElement("div");
    item.className = `khod-toast khod-toast-${kind}`;
    item.innerHTML = `
      <div class="khod-toast-dot" aria-hidden="true"></div>
      <div class="khod-toast-body">${esc(message || t(`ui.toast_${kind}`, t("ui.toast_info", "Updated")))}</div>
      <button class="khod-toast-close" type="button" aria-label="${esc(t("ui.dismiss", "Dismiss"))}">×</button>
    `;
    host.appendChild(item);
    const close = () => {
      item.classList.add("khod-toast-out");
      setTimeout(() => item.remove(), 160);
    };
    item.querySelector("button")?.addEventListener("click", close);
    setTimeout(close, options.timeout || 4200);
    return close;
  }

  function confirmDialog(options = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "khod-dialog-backdrop";
      overlay.setAttribute("role", "presentation");
      const title = options.title || t("ui.confirm_title", "Are you sure?");
      const message = options.message || "";
      const confirmText = options.confirmText || t("ui.ok", "OK");
      const cancelText = options.cancelText || t("ui.cancel", "Cancel");
      overlay.innerHTML = `
        <div class="khod-dialog" role="alertdialog" aria-modal="true" aria-labelledby="khod-dialog-title" aria-describedby="khod-dialog-body">
          ${options.kicker ? `<div class="khod-dialog-kicker">${esc(options.kicker)}</div>` : ""}
          <div class="khod-dialog-title" id="khod-dialog-title">${esc(title)}</div>
          <div class="khod-dialog-body" id="khod-dialog-body">${esc(message)}</div>
          <div class="khod-dialog-actions">
            <button class="btn btn-ghost" type="button" data-dialog-cancel>${esc(cancelText)}</button>
            <button class="btn ${options.danger ? "btn-danger" : "btn-primary"}" type="button" data-dialog-confirm>${esc(confirmText)}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      const previousFocus = document.activeElement;
      const cancelBtn = overlay.querySelector("[data-dialog-cancel]");
      const confirmBtn = overlay.querySelector("[data-dialog-confirm]");
      const done = (value) => {
        overlay.remove();
        if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
        resolve(value);
      };
      cancelBtn?.addEventListener("click", () => done(false));
      confirmBtn?.addEventListener("click", () => done(true));
      overlay.addEventListener("keydown", (event) => {
        if (event.key === "Escape") done(false);
      });
      confirmBtn?.focus();
    });
  }

  function loader(label) {
    return `
      <div class="khod-state khod-state-loading" role="status" aria-live="polite">
        <div class="khod-spinner" aria-hidden="true"></div>
        <div class="khod-state-title">${esc(label || t("ui.loading", "Loading..."))}</div>
      </div>
    `;
  }

  function stateBlock(options = {}) {
    const kind = options.kind || "empty";
    return `
      <div class="khod-state khod-state-${esc(kind)}">
        <div class="khod-state-icon" aria-hidden="true">${esc(options.icon || (kind === "error" ? "!" : "i"))}</div>
        <div class="khod-state-title">${esc(options.title || "")}</div>
        <div class="khod-state-body">${esc(options.body || "")}</div>
        ${options.actionText ? `<button class="btn btn-primary" type="button" data-khod-state-action>${esc(options.actionText)}</button>` : ""}
      </div>
    `;
  }

  function help(text, label) {
    const aria = label || t("ui.help", "Help");
    return `<span class="khod-help" tabindex="0" role="button" aria-label="${esc(aria)}" data-tooltip="${esc(text)}">?</span>`;
  }

  function enhance(root = document) {
    root.querySelectorAll("[data-tooltip]").forEach((el) => {
      if (el.dataset.khodTooltipReady) return;
      el.dataset.khodTooltipReady = "1";
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
      if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", el.getAttribute("data-tooltip") || t("ui.help", "Help"));
    });
    root.querySelectorAll("button:not([type])").forEach((btn) => btn.setAttribute("type", "button"));
  }

  return { t, esc, toast, confirm: confirmDialog, loader, stateBlock, help, enhance };
})();

// ── Theme & Lang helpers ──
function applyTheme(theme) {
  window._kbotTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  const cb = document.getElementById("toggle-theme");
  if (cb) cb.checked = (theme === "light");
  try { localStorage.setItem("kbot-theme", theme); } catch(e) {}
  if (window.KhodMonitoring) {
    window.KhodMonitoring.setUiContext({
      activeRoute: window.__khodActiveRoute || "",
      language: window._kbotLang || "",
      theme,
    });
  }
}

function applyLang(lang) {
  window._kbotLang = lang;
  document.documentElement.classList.add("lang-switching");
  document.documentElement.setAttribute("dir",  lang === "ar" ? "rtl" : "ltr");
  document.documentElement.setAttribute("lang", lang);
  const cb = document.getElementById("toggle-lang");
  if (cb) cb.checked = (lang === "ar");
  updateTopBarText();
  try { localStorage.setItem("kbot-lang", lang); } catch(e) {}
  window.dispatchEvent(new CustomEvent("khod-lang-change", { detail: { lang } }));
  if (window.KhodMonitoring) {
    window.KhodMonitoring.setUiContext({
      activeRoute: window.__khodActiveRoute || "",
      language: lang,
      theme: window._kbotTheme || "",
    });
  }
  window.setTimeout(() => document.documentElement.classList.remove("lang-switching"), 180);
}

// Cache DOM refs — avoids getElementById on every topbar update
let _topBarName = null, _topBarDays = null, _topBarAvatar = null, _topBarAccounts = null, _topBarCopyBtn = null;
function updateTopBarText() {
  if (!_topBarName)     _topBarName     = document.getElementById("top-bar-name");
  if (!_topBarDays)     _topBarDays     = document.getElementById("top-bar-days");
  if (!_topBarAvatar)   _topBarAvatar   = document.getElementById("top-bar-avatar");
  if (!_topBarAccounts) _topBarAccounts = document.getElementById("top-bar-accounts");
  if (!_topBarCopyBtn) {
    _topBarCopyBtn = document.getElementById("btn-copy-license");
    if (_topBarCopyBtn) {
      _topBarCopyBtn.addEventListener("click", () => {
        const licKey = (window._kbotUser || {}).licenseKey || '';
        if (licKey) {
          navigator.clipboard.writeText(licKey).then(() => {
            const originalTooltip = _topBarCopyBtn.getAttribute("data-tooltip");
            const copiedText = window._t("titlebar.copied") || "Copied!";
            
            _topBarCopyBtn.setAttribute("data-tooltip", copiedText);
            _topBarCopyBtn.setAttribute("aria-label", copiedText);
            if (_topBarCopyBtn.dataset) delete _topBarCopyBtn.dataset.khodTooltipReady;
            
            if (window.KhodTooltip) {
              window.KhodTooltip.hide();
              setTimeout(() => {
                if (document.activeElement === _topBarCopyBtn || _topBarCopyBtn.matches(":hover")) {
                  if (window.KhodTooltip.init) window.KhodTooltip.init();
                }
              }, 50);
            }
            
            if (window.KhodUI && window.KhodUI.toast) {
              window.KhodUI.toast(copiedText, { kind: "success", timeout: 2000 });
            }
            
            setTimeout(() => {
              _topBarCopyBtn.setAttribute("data-tooltip", originalTooltip);
              _topBarCopyBtn.setAttribute("aria-label", originalTooltip);
              if (_topBarCopyBtn.dataset) delete _topBarCopyBtn.dataset.khodTooltipReady;
            }, 2000);
          }).catch(err => {
            console.error("Failed to copy license key:", err);
          });
        }
      });
    }
  }

  if (!_topBarName) return;

  if (_topBarCopyBtn) {
    const licKey = (window._kbotUser || {}).licenseKey || '';
    if (licKey) {
      _topBarCopyBtn.style.display = "inline-flex";
      const label = window._t("titlebar.copy_license") || "Copy License";
      _topBarCopyBtn.setAttribute("data-tooltip", `${label}: ${licKey}`);
      _topBarCopyBtn.setAttribute("aria-label", `${label}: ${licKey}`);
      if (_topBarCopyBtn.dataset) delete _topBarCopyBtn.dataset.khodTooltipReady;
    } else {
      _topBarCopyBtn.style.display = "none";
    }
  }

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

  const syncLbl = document.querySelector('#btn-admin-refresh .refresh-label');
  if (syncLbl) syncLbl.textContent = window._t('titlebar.sync');

  const localizedTooltips = [
    ["btn-admin-refresh", "titlebar.sync_tooltip"],
    ["toggle-lang", "titlebar.lang_tooltip"],
    ["toggle-theme", "titlebar.theme_tooltip"],
    ["btn-minimize", "titlebar.minimize"],
    ["btn-maximize", "titlebar.maximize"],
    ["btn-close", "titlebar.close"],
  ];
  localizedTooltips.forEach(([id, key]) => {
    const node = document.getElementById(id);
    if (!node) return;
    const text = window._t(key);
    node.setAttribute("aria-label", text);
    node.setAttribute("data-tooltip", text);
    if (node.dataset) delete node.dataset.khodTooltipReady;
  });
  const themeLabel = document.querySelector(".tb-theme-switch");
  if (themeLabel) {
    themeLabel.setAttribute("data-tooltip", window._t("titlebar.theme_tooltip"));
    if (themeLabel.dataset) delete themeLabel.dataset.khodTooltipReady;
  }
  if (window.KhodUI) window.KhodUI.enhance(document.querySelector(".titlebar") || document);
}

// ── Top bar visibility ──
const PAGES_WITH_TOPBAR = new Set(["page-setup", "page-run", "page-results", "page-license", "page-analytics", "page-operations", "page-dashboard", "page-ai-intelligence"]);

const FEATURE_SCRIPT_GROUPS = {
  analytics: [
    "pages/analytics/chart.umd.min.js",
    "../../node_modules/xlsx/dist/xlsx.full.min.js",
    "locales/ar/analytics.js",
    "locales/en/analytics.js",
    "locales/ar/operations.js",
    "locales/en/operations.js",
    "page-i18n.js",
    "pages/guided-tour.js",
    "pages/premium-preview.js",
    "pages/analytics/analytics-charts.js",
    "pages/analytics/analytics-kpis.js",
    "pages/analytics/analytics-table.js",
    "pages/analytics/analytics-insights.js",
    "pages/analytics/analytics.js",
  ],
  operations: [
    "locales/ar/analytics.js",
    "locales/en/analytics.js",
    "locales/ar/operations.js",
    "locales/en/operations.js",
    "page-i18n.js",
    "pages/guided-tour.js",
    "pages/premium-preview.js",
    "pages/operations/operations-utils.js",
    "pages/operations/operations-monitor.js",
    "pages/operations/operations-history.js",
    "pages/operations/operations-presets.js",
    "pages/operations/operations-insights.js",
    "pages/operations/operations.js",
  ],
  ai: [
    "pages/ai-intelligence/ai-intelligence-data.js",
    "pages/ai-intelligence/engine/intent-detector.js",
    "pages/ai-intelligence/engine/analytics-engine.js",
    "pages/ai-intelligence/engine/context-compressor.js",
    "pages/ai-intelligence/engine/session-memory.js",
    "pages/ai-intelligence/engine/local-reasoning-engine.js",
    "pages/ai-intelligence/engine/scenario-database.js",
    "pages/ai-intelligence/engine/business-orchestrator.js",
    "pages/ai-intelligence/ai-intelligence.js",
  ],
  dashboard: [
    "pages/analytics/chart.umd.min.js",
    "pages/guided-tour.js",
    "pages/premium-preview.js",
    "pages/dashboard/locales/ar/dashboard-locale.js",
    "pages/dashboard/locales/en/dashboard-locale.js",
    "pages/dashboard/dashboard-i18n.js",
    "pages/dashboard/dashboard-aggregator.js",
    "pages/dashboard/dashboard-aggregator-score.js",
    "pages/dashboard/dashboard-aggregator-geo.js",
    "pages/dashboard/dashboard-insight-engine.js",
    "pages/dashboard/dashboard-filter-bus.js",
    "pages/dashboard/dashboard-shared.js",
    "pages/dashboard/dashboard-ai-context.js",
    "pages/dashboard/dashboard-ai-ui.js",
    "pages/ai-intelligence/ai-intelligence-data.js",
    "pages/ai-intelligence/engine/intent-detector.js",
    "pages/ai-intelligence/engine/analytics-engine.js",
    "pages/ai-intelligence/engine/context-compressor.js",
    "pages/ai-intelligence/engine/session-memory.js",
    "pages/ai-intelligence/engine/local-reasoning-engine.js",
    "pages/ai-intelligence/engine/scenario-database.js",
    "pages/ai-intelligence/engine/business-orchestrator.js",
    "pages/dashboard/sections/section-khod-ai.js",
    "pages/ai-intelligence/ai-intelligence.js",
    "pages/dashboard/sections/section1-overview.js",
    "pages/dashboard/sections/section2-pipeline.js",
    "pages/dashboard/sections/section3-orders.js",
    "pages/dashboard/sections/section4-cod.js",
    "pages/dashboard/sections/section5-products.js",
    "pages/dashboard/sections/section6-commission.js",
    "pages/dashboard/sections/section-marketing-connections.js",
    "pages/dashboard/sections/section7-calculator.js",
    "pages/dashboard/sections/section8-master.js",
    "pages/dashboard/sections/section-cities.js",
    "pages/dashboard/sections/section-city-drawer.js",
    "pages/dashboard/sections/section-product-matrix.js",
    "pages/dashboard/sections/section-prepaid.js",
    "pages/dashboard/sections/section-insight-strip.js",
    "pages/dashboard/sections/section9-product-forecast.js",
    "pages/dashboard/dashboard-shell.js",
    "pages/dashboard/dashboard.js",
  ],
};

const _loadedFeatureScripts = new Set();
const _featureLoadPromises = new Map();

function loadScriptOnce(src) {
  if (_loadedFeatureScripts.has(src)) return Promise.resolve();
  if (_featureLoadPromises.has(src)) return _featureLoadPromises.get(src);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => {
      _loadedFeatureScripts.add(src);
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load " + src));
    document.body.appendChild(script);
  });
  _featureLoadPromises.set(src, promise);
  return promise;
}

async function ensureFeatureScripts(feature) {
  const scripts = FEATURE_SCRIPT_GROUPS[feature] || [];
  for (const src of scripts) {
    await loadScriptOnce(src);
  }
}

window.ensureFeatureScripts = ensureFeatureScripts;

window.renderDashboard = async function lazyRenderDashboard() {
  await ensureFeatureScripts("dashboard");
  if (window.renderDashboard !== lazyRenderDashboard && typeof window.renderDashboard === "function") {
    return window.renderDashboard.apply(window, arguments);
  }
};

window.renderAnalytics = async function lazyRenderAnalytics() {
  await ensureFeatureScripts("analytics");
  if (window.renderAnalytics !== lazyRenderAnalytics && typeof window.renderAnalytics === "function") {
    return window.renderAnalytics.apply(window, arguments);
  }
};

window.renderOperations = async function lazyRenderOperations() {
  await ensureFeatureScripts("operations");
  if (window.renderOperations !== lazyRenderOperations && typeof window.renderOperations === "function") {
    return window.renderOperations.apply(window, arguments);
  }
};

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

function setPreloaderCopy(title, body) {
  const titleEl = document.getElementById("preloader-title");
  const bodyEl = document.getElementById("preloader-body");
  if (titleEl && title) titleEl.textContent = title;
  if (bodyEl && body) bodyEl.textContent = body;
}

function dismissPreloaderWhenReady(pageId) {
  if (_preloaderDismissed) return;
  const dashboardReady = pageId === "page-dashboard" && window._dashboardInitialReady;
  if (!dashboardReady || typeof dashboardReady.then !== "function") {
    dismissPreloader();
    return;
  }
  dashboardReady.then(() => dismissPreloader()).catch(() => dismissPreloader());
}

let _activePageId = null;
function showPage(id) {
  const activePreview = document.querySelector(".premium-preview-overlay");
  if (activePreview) activePreview.remove();

  document.querySelectorAll(".page.active").forEach((activePage) => {
    if (activePage.id !== id) activePage.classList.remove("active");
  });
  _activePageId = id;
  if (window.KhodMonitoring) window.KhodMonitoring.setRoute(id);
  const page = document.getElementById(id);
  page.classList.add("active");
  const centerEl = document.getElementById("top-bar-center");
  if (centerEl) centerEl.classList.toggle("visible", PAGES_WITH_TOPBAR.has(id));
  if (window.KhodUI) window.KhodUI.enhance(page);
  if (id === "page-dashboard" && window._dashboardInitialReady) {
    setPreloaderCopy(
      window._t ? window._t("dashboard.initial_sync_title") : "Syncing dashboard data...",
      window._t ? window._t("dashboard.initial_sync_body") : "Preparing saved orders, account metrics, product calculators, marketing spend, and AI context. Large workspaces can take a little while."
    );
  }
  // Dismiss preloader once the first page is ready.
  dismissPreloaderWhenReady(id);
}

// ── Periodic license & credentials sync every 60 seconds ──
let licenseCheckInterval = null;
function startPeriodicLicenseCheck() {
  if (licenseCheckInterval) clearInterval(licenseCheckInterval);
  licenseCheckInterval = setInterval(async () => {
    if (window.isExpiredOverlayVisible && window.isExpiredOverlayVisible()) return;
    // Skip sync if the bot is currently running to prevent UI updates mid-run
    if (window._botIsRunning) return;

    try {
      // Use checkLicenseNocache to bypass cache and query fresh database state
      const lr = await window.api.checkLicenseNocache();
      if (!lr || !lr.valid) {
        clearInterval(licenseCheckInterval);
        if (shouldReturnToLicensePage(lr)) {
          returnToLicensePage();
          return;
        }
        _triggerExpiredOverlay(lr?.reason || "");
        return;
      }

      if (lr.forceFlush) {
        // Handled by force-flush event listener
        return;
      }

      // Sync user metadata
      window._kbotUser = {
        ...(window._kbotUser || {}),
        customerName: lr.customerName || (window._kbotUser || {}).customerName || null,
        daysLeft:     lr.daysLeft,
        licenseKey:   lr.key || (window._kbotUser || {}).licenseKey || "",
      };

      // Fetch fresh accounts & features state
      const creds = await window.api.getCredentials();
      
      const maxAccountsChanged = window._maxAccounts !== (creds.maxAccounts || 1);
      const accountsCountChanged = (window._kbotAccounts || []).length !== (creds.accounts || []).length;
      
      let locksChanged = false;
      if (!accountsCountChanged) {
        const oldLocks = (window._kbotAccounts || []).map(a => !!a.locked);
        const newLocks = (creds.accounts || []).map(a => !!a.locked);
        locksChanged = oldLocks.some((l, idx) => l !== newLocks[idx]);
      }

      const featureFlagsChanged = 
        window._analyticsEnabled !== (creds.analyticsEnabled !== false) ||
        window._operationsEnabled !== (creds.operationsEnabled !== false) ||
        window._dashboardEnabled !== (creds.dashboardEnabled === true);

      if (maxAccountsChanged || accountsCountChanged || locksChanged || featureFlagsChanged) {
        window._maxAccounts = creds.maxAccounts || 1;
        window._kbotAccounts = creds.accounts || [];

        const prevAnalyticsEnabled = window._analyticsEnabled;
        const prevOperationsEnabled = window._operationsEnabled;
        const prevDashboardEnabled = window._dashboardEnabled;

        window._analyticsEnabled  = creds.analyticsEnabled  !== false;
        window._operationsEnabled = creds.operationsEnabled !== false;
        window._dashboardEnabled  = creds.dashboardEnabled  === true;

        if (
          prevAnalyticsEnabled !== window._analyticsEnabled ||
          prevOperationsEnabled !== window._operationsEnabled ||
          prevDashboardEnabled !== window._dashboardEnabled
        ) {
          if (window.invalidateDashboardCache) window.invalidateDashboardCache();
        }

        updateTopBarText();
        reRenderCurrentPage();
      }
    } catch (err) {
      console.warn("[PeriodicSync] Background sync failed:", err?.message || err);
    }
  }, 60 * 1000); // 60 seconds (1 minute)
}

function _triggerExpiredOverlay(reason) {
  try { window.api.killBot(); } catch (_) {}
  const licKey = (window._kbotUser || {}).licenseKey || '';
  window.showExpiredOverlay({
    licenseKey: licKey,
    reason:     reason || '',
    onResume: (freshResult) => {
      if (freshResult && freshResult.daysLeft != null) {
        window._kbotUser = {
          ...(window._kbotUser || {}),
          daysLeft:     freshResult.daysLeft,
          customerName: freshResult.customerName || (window._kbotUser || {}).customerName,
          licenseKey:   freshResult.key || (window._kbotUser || {}).licenseKey || '',
        };
        updateTopBarText();
      }
      startPeriodicLicenseCheck();
    },
  });
}

function shouldReturnToLicensePage(result) {
  const reason = String((result && result.reason) || "").toLowerCase();
  return !result || (!result.valid && (
    !((window._kbotUser || {}).licenseKey) ||
    reason.includes("not found") ||
    reason.includes("no license key")
  ));
}

function returnToLicensePage() {
  clearInterval(licenseCheckInterval);
  try { window.api.killBot(); } catch (_) {}
  if (window.hideExpiredOverlay) window.hideExpiredOverlay();
  window._kbotUser = {
    ...(window._kbotUser || {}),
    daysLeft: null,
    licenseKey: "",
  };
  updateTopBarText();
  const btn = document.getElementById("btn-admin-refresh");
  if (btn) btn.style.display = "none";
  renderLicense(() => afterLicense());
  showPage("page-license");
}
window.returnToLicensePage = returnToLicensePage;

function resolveAutoRunAccountIds(creds) {
  const accounts = (creds && creds.accounts) || [];
  return accounts.map(a => a.id).filter(Boolean);
}

async function runAutoRunTick(dateFrom, dateTo) {
  const active = document.querySelector(".page.active");
  if (active && active.id === "page-run") return;

  let freshCreds = null;
  try {
    freshCreds = await window.api.getCredentials();
    window._kbotAccounts = freshCreds.accounts || [];
  } catch (_) {}

  const accountIds = resolveAutoRunAccountIds(freshCreds || { accounts: window._kbotAccounts || [] });
  if (!accountIds.length) {
    console.warn("[auto-run] No accounts found, skipping tick.");
    return;
  }
  goToRun(dateFrom, dateTo, accountIds);
}
// ── Admin Sync: re-fetch license + account state from Supabase without restarting ──
// Called by the ↻ Sync button in the topbar.
// What it refreshes:
//   1. License validity, expiry, max_accounts (busts the 60-second cache)
//   2. Per-account unlock status from license_accounts table (busts 15-second cred cache)
//   3. Re-renders the current page so changes are visible immediately
async function adminRefresh() {
  const btn = document.getElementById("btn-admin-refresh");
  if (!btn || btn.classList.contains("refreshing")) return;

  btn.classList.add("refreshing");

  try {
    // 1. Re-check license (nocache = busts the 60-second in-memory cache)
    const lr = await window.api.checkLicenseNocache();

    if (!lr || !lr.valid) {
      if (shouldReturnToLicensePage(lr)) {
        returnToLicensePage();
        return;
      }
      // License is now invalid (revoked/expired) — show expired overlay
      btn.classList.remove("refreshing");
      _triggerExpiredOverlay(lr?.reason || "");
      return;
    }

    if (lr.forceFlush) {
      btn.classList.remove("refreshing");
      return;
    }

    // 2. Update global user state with fresh values from server
    window._kbotUser = {
      ...(window._kbotUser || {}),
      customerName: lr.customerName || (window._kbotUser || {}).customerName || null,
      daysLeft:     lr.daysLeft,
      licenseKey:   lr.key || (window._kbotUser || {}).licenseKey || "",
    };

    // 3. Re-fetch credentials — checkLicenseNocache also busts the main-process
    //    credential cache, so account unlocks and slot changes are fresh here.
    const prevAnalyticsEnabled = window._analyticsEnabled;
    const prevOperationsEnabled = window._operationsEnabled;
    const prevDashboardEnabled = window._dashboardEnabled;
    const creds = await window.api.getCredentials();
    window._maxAccounts       = creds.maxAccounts || 1;
    window._kbotAccounts      = creds.accounts || [];
    window._analyticsEnabled  = creds.analyticsEnabled  !== false;
    window._operationsEnabled = creds.operationsEnabled !== false;
    window._dashboardEnabled  = creds.dashboardEnabled  === true;
    if (
      prevAnalyticsEnabled !== window._analyticsEnabled ||
      prevOperationsEnabled !== window._operationsEnabled ||
      prevDashboardEnabled !== window._dashboardEnabled
    ) {
      if (window.invalidateDashboardCache) window.invalidateDashboardCache();
    }

    // 4. Refresh topbar text (expiry days, accounts badge)
    updateTopBarText();

    // 5. Re-render the current page so the user sees the changes immediately
    //    — setup page picks up new unlock state, new account slots, etc.
    const activePage = document.querySelector(".page.active");
    if (activePage) {
      const pid = activePage.id;
      if (pid === "page-setup") {
        // Re-render setup at whichever step is currently visible
        const currentStep = window._setupCurrentStep || "accounts";
        renderSetup((params) => {
          if (params && params.dateFrom) {
            sessionDate = { dateFrom: params.dateFrom, dateTo: params.dateTo };
            goToRun(params.dateFrom, params.dateTo, params.selectedAccountIds);
          } else {
            goToSetup("accounts");
          }
        }, currentStep);
      } else {
        reRenderCurrentPage();
      }
    }
  } catch (err) {
    console.warn("[AdminRefresh] Sync failed:", err?.message || err);
    if (window.KhodMonitoring) window.KhodMonitoring.captureException(err, { operation: "adminRefresh" });
  } finally {
    // Let the spin animation finish before re-enabling
    setTimeout(() => btn.classList.remove("refreshing"), 700);
  }
}

async function init() {
  document.getElementById("btn-minimize").addEventListener("click", () => window.api.minimize());
  document.getElementById("btn-maximize").addEventListener("click", () => window.api.maximize());
  document.getElementById("btn-close").addEventListener("click",    () => window.api.close());

  // Wire up admin sync button (shown only after license is validated below)
  const _refreshBtn = document.getElementById("btn-admin-refresh");
  if (_refreshBtn) _refreshBtn.addEventListener("click", adminRefresh);

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
    licenseKey:   licenseResult.key || '',
  };
  if (window.monitoring) {
    window.monitoring.setUserContext({ customerName: window._kbotUser.customerName });
  }
  window._kbotAllowReset = licenseResult.allowReset === true;
  updateTopBarText();

  // Show admin sync button now that license is confirmed valid
  const _rb = document.getElementById("btn-admin-refresh");
  if (_rb) _rb.style.display = "inline-flex";

  window.api.removeAllListeners("license-expired");
  window.api.onLicenseExpired(() => {
    clearInterval(licenseCheckInterval);
    _triggerExpiredOverlay();
  });
  window.api.removeAllListeners("force-flush");
  window.api.on("force-flush", () => {
    clearInterval(licenseCheckInterval);
    try { window.api.killBot(); } catch (_) {}
    if (window.hideExpiredOverlay) window.hideExpiredOverlay();
    afterLicense(true);
  });
  window.api.removeAllListeners("auto-run-tick");
  window.api.onAutoRunTick(async ({ dateFrom, dateTo }) => {
    await runAutoRunTick(dateFrom, dateTo);
  });

  startPeriodicLicenseCheck();

  // creds already fetched above via Promise.all — reuse it
  window._maxAccounts       = creds.maxAccounts || 1;
  window._kbotAccounts      = creds.accounts || [];
  window._analyticsEnabled  = creds.analyticsEnabled  !== false;
  window._operationsEnabled = creds.operationsEnabled !== false;
  window._dashboardEnabled  = creds.dashboardEnabled  === true;
  updateTopBarText();
  // Route based on credential state:
  // - Accounts exist → skip the accounts management step, go straight to run step
  // - No accounts    → land on accounts step so user can add their first account
  const hasAccounts = (creds.accounts && creds.accounts.length > 0) || !!creds.easyEmail;
  goToSetup(hasAccounts ? "run" : "accounts");
}

async function afterLicense(isFlush = false) {
  window.api.removeAllListeners("license-expired");
  window.api.onLicenseExpired(() => {
    clearInterval(licenseCheckInterval);
    _triggerExpiredOverlay();
  });
  window.api.removeAllListeners("force-flush");
  window.api.on("force-flush", () => {
    clearInterval(licenseCheckInterval);
    try { window.api.killBot(); } catch (_) {}
    if (window.hideExpiredOverlay) window.hideExpiredOverlay();
    afterLicense(true);
  });
  window.api.removeAllListeners("auto-run-tick");
  window.api.onAutoRunTick(async ({ dateFrom, dateTo }) => {
    await runAutoRunTick(dateFrom, dateTo);
  });

  startPeriodicLicenseCheck();

  if (!isFlush) {
    try {
      const lr = await window.api.checkLicense();
      if (lr.valid) {
        window._kbotUser = { customerName: lr.customerName || null, daysLeft: lr.daysLeft, licenseKey: lr.key || '' };
        window._kbotAllowReset = lr.allowReset === true;
        updateTopBarText();
        // Show admin sync button now that license is confirmed valid
        const _rb = document.getElementById("btn-admin-refresh");
        if (_rb) _rb.style.display = "inline-flex";
      }
    } catch(e) {}
  }

  const creds = await window.api.getCredentials();
  window._maxAccounts       = creds.maxAccounts || 1;
  window._kbotAccounts      = creds.accounts || [];
  window._analyticsEnabled  = creds.analyticsEnabled  !== false;
  window._operationsEnabled = creds.operationsEnabled !== false;
  window._dashboardEnabled  = creds.dashboardEnabled  === true;
  const hasAccounts = (creds.accounts && creds.accounts.length > 0) || !!creds.easyEmail;
  goToSetup(hasAccounts ? "run" : "accounts");
}

function goToSetup(initialStep) {
  if (window._botIsRunning) {
    showPage("page-run");
    return;
  }
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
    goToResults(resultData, dateFrom, dateTo, selectedAccountIds);
  }, () => {
    goToSetup("run");
  });
  showPage("page-run");
}

// ── Analytics: save hook ─────────────────────────────────────────────────────
async function _saveAnalyticsFromResult(data, selectedAccountIds) {
  const now     = Date.now();
  const runDate = new Date(now).toISOString().slice(0, 10);
  const accounts = Array.isArray(window._kbotAccounts) ? window._kbotAccounts : [];

  function resolveAccountIdentity(result, fallbackId) {
    const accountId = result?.accountId || fallbackId || "__single__";
    const account = accounts.find(a => a.id === accountId) || null;
    const label = result?.accountLabel || result?._accountLabel || result?.accountEmail || "";
    const email = account?.easyEmail || result?.accountEmail || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(label) ? label : "");
    const friendlyLabel = account?.label || account?.easyStore || account?.storeName || account?.name || label || email || "";
    return {
      accountId,
      accountEmail: email || label || "",
      accountLabel: friendlyLabel || "Account",
    };
  }

  // Multi-account path
  if (data._multiAccount && Array.isArray(data._accountResults)) {
    for (const r of data._accountResults) {
      const identity = resolveAccountIdentity(r);
      const saveRes = await window.api.saveRunAnalytics({
        runId:           `${r.accountId || "acc"}-${now}`,
        runDate,
        runTimestamp:    now,
        accountId:       identity.accountId,
        accountEmail:    identity.accountEmail,
        accountLabel:    identity.accountLabel,
        ordersSubmitted: r.data?.orders    || 0,
        ordersFailed:    r.data?.failedOrders?.count || 0,
        runtimeMs:       r.runtimeMs || r.data?.runtimeMs || 0,
        runStartedAt:    r.runStartedAt || r.data?.runStartedAt || null,
        runEndedAt:      r.runEndedAt || r.data?.runEndedAt || null,
        orders:          r.data?.orderRows || [],
        buffer:          r.data?.buffer || null,
        khodSnapshot:    r.data?.khodSnapshot || null,
        khodDashboardSnapshot: r.data?.khodDashboardSnapshot || null,
      });
      if (saveRes && saveRes.dashboardRowsSaved > 0 && window.invalidateDashboardCache) window.invalidateDashboardCache();
    }
    window.dispatchEvent(new CustomEvent("khod-analytics-runs-updated"));
    return;
  }

  // Single-account path
  const identity = resolveAccountIdentity(data, selectedAccountIds?.[0]);
  const saveRes = await window.api.saveRunAnalytics({
    runId:           `single-${now}`,
    runDate,
    runTimestamp:    now,
    accountId:       identity.accountId,
    accountEmail:    identity.accountEmail,
    accountLabel:    identity.accountLabel,
    ordersSubmitted: data.orders || 0,
    ordersFailed:    data.failedOrders?.count || 0,
    runtimeMs:       data.runtimeMs || 0,
    runStartedAt:    data.runStartedAt || null,
    runEndedAt:      data.runEndedAt || null,
    orders:          data.orderRows || [],
    buffer:          data.buffer || null,
    khodSnapshot:    data.khodSnapshot || null,
    khodDashboardSnapshot: data.khodDashboardSnapshot || null,
  });
  if (saveRes && saveRes.dashboardRowsSaved > 0 && window.invalidateDashboardCache) window.invalidateDashboardCache();
  window.dispatchEvent(new CustomEvent("khod-analytics-runs-updated"));
}

function goToResults(data, dateFrom, dateTo, selectedAccountIds) {
  // Fire-and-forget: save run data for Analytics/Operations pages
  _saveAnalyticsFromResult(data, selectedAccountIds).catch(e => {
    console.warn("[Analytics] save failed silently:", e);
    if (window.KhodMonitoring) window.KhodMonitoring.captureException(e, { operation: "analytics.saveFromResult" });
  });
  const onRunAgain = () => { goToRun(dateFrom, dateTo, selectedAccountIds); };
  const onHome     = () => { sessionDate = null; goToSetup("run"); };
  // Cache so language switch can re-render results without losing data
  window._lastResultArgs = { data, dateFrom, dateTo, onRunAgain, onHome };
  try {
    renderResults(data, dateFrom, dateTo, onRunAgain, onHome);
  } catch (err) {
    console.error("Results render failed", err);
    if (window.KhodMonitoring) window.KhodMonitoring.captureException(err, { operation: "results.render" });
    const el = document.getElementById("page-results");
    if (el) {
      el.innerHTML = `
        <div class="page-wrap"><div class="page-inner" style="display:flex;flex-direction:column;gap:14px">
          <div class="notice-box warn" style="border-color:var(--danger);background:rgba(255,77,109,0.1)">
            <span class="notice-icon">❌</span>
            <div class="notice-text">
              <strong>${window._t("results.run_failed")}</strong>
              <span>${err.message || err}</span>
            </div>
          </div>
          <button class="btn btn-primary" id="btn-results-back">${window._t("results.home")}</button>
        </div></div>`;
      document.getElementById("btn-results-back")?.addEventListener("click", () => {
        sessionDate = null;
        goToSetup("run");
      });
    }
  }
  showPage("page-results");
}

// ── Feature-locked page helper ─────────────────────────────────────────────
function _renderLockedPage(pageId, featureNameEn, featureNameAr) {
  const el = document.getElementById(pageId);
  if (!el) return;
  const isAr = (window._kbotLang || "en") === "ar";
  const name = isAr ? featureNameAr : featureNameEn;
  const title = isAr ? "هذه الميزة غير مفعّلة" : "Feature Not Enabled";
  const sub   = isAr
    ? `ميزة "${name}" غير مضمّنة في ترخيصك الحالي. تواصل مع الدعم للترقية.`
    : `"${name}" is not included in your current license. Contact support to upgrade.`;
  el.innerHTML = `
    <div style="
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      height:100%; min-height:400px; gap:16px; padding:40px;
      color:var(--text2); text-align:center;
    ">
      <div style="font-size:48px; opacity:.4">🔒</div>
      <div style="font-size:18px; font-weight:700; color:var(--text)">${title}</div>
      <div style="font-size:14px; max-width:360px; line-height:1.6">${sub}</div>
    </div>`;
}

async function goToAnalytics() {
  await ensureFeatureScripts("analytics");
  if (typeof renderAnalytics === "function") {
    try {
      await renderAnalytics(() => goToSetup("run"));
    } catch (err) {
      if (window.KhodMonitoring) window.KhodMonitoring.captureException(err, { operation: "analytics.render" });
      throw err;
    }
  }
  showPage("page-analytics");
}

async function goToOperations() {
  await ensureFeatureScripts("operations");
  if (typeof renderOperations === "function") {
    try {
      await renderOperations(() => goToSetup("run"));
    } catch (err) {
      if (window.KhodMonitoring) window.KhodMonitoring.captureException(err, { operation: "operations.render" });
      throw err;
    }
  }
  showPage("page-operations");
}

async function goToDashboard() {
  await ensureFeatureScripts("dashboard");
  if (typeof renderDashboard === "function") {
    try {
      await renderDashboard(() => goToSetup("run"));
    } catch (err) {
      if (window.KhodMonitoring) window.KhodMonitoring.captureException(err, { operation: "dashboard.render" });
      throw err;
    }
  }
  showPage("page-dashboard");
}

async function goToAiIntelligence() {
  if (!window._dashboardEnabled) {
    _renderLockedPage("page-ai-intelligence", "KHOD AI", "KHOD AI");
    showPage("page-ai-intelligence");
    return;
  }
  await ensureFeatureScripts("ai");
  if (typeof renderAiIntelligence === "function") {
    try {
      renderAiIntelligence(() => goToSetup("run"));
    } catch (err) {
      if (window.KhodMonitoring) window.KhodMonitoring.captureException(err, { operation: "aiIntelligence.render" });
      throw err;
    }
  }
  showPage("page-ai-intelligence");
}

async function renderAiIntelligence() {
  if (!window._dashboardEnabled) {
    _renderLockedPage("page-ai-intelligence", "KHOD AI", "KHOD AI");
    showPage("page-ai-intelligence");
    return;
  }
  await ensureFeatureScripts("ai");
  if (typeof window.renderAiIntelligencePage === "function") {
    try {
      window.renderAiIntelligencePage(() => goToSetup("run"));
    } catch (err) {
      if (window.KhodMonitoring) window.KhodMonitoring.captureException(err, { operation: "aiIntelligence.renderPage" });
      throw err;
    }
  }
  showPage("page-ai-intelligence");
}


// Dashboard fetch UI helpers
function _fmtUi(key, values, fallback) {
  let text = window._t ? window._t(key) : key;
  if (!text || text === key) text = fallback || key;
  Object.entries(values || {}).forEach(([name, value]) => {
    text = text.replace(new RegExp("\\{" + name + "\\}", "g"), String(value ?? ""));
  });
  return text;
}

function _setDashboardFetchUi(state) {
  window._dashboardFetchState = state || {};
  if (typeof window.setDashboardUpdateOverlay === "function") {
    window.setDashboardUpdateOverlay(window._dashboardFetchState);
  }
  const status = document.getElementById("sv3-dashboard-fetch-status");
  const btn = document.getElementById("dashboard-update-btn");
  const runBtn = document.getElementById("sv3-run-final");
  if (btn) {
    if (!btn.dataset.defaultLabel) btn.dataset.defaultLabel = btn.innerHTML;
    btn.disabled = !!state.active;
    btn.setAttribute("aria-busy", state.active ? "true" : "false");
    btn.innerHTML = state.active
      ? `<span class="khod-spinner" aria-hidden="true"></span> ${KhodUI.esc(KhodUI.t("dashboard.fetching_title", "Updating dashboard..."))}`
      : btn.dataset.defaultLabel;
  }
  if (runBtn) runBtn.disabled = !!state.active;
  if (!status) return;

  status.hidden = false;
  status.classList.toggle("is-error", state.kind === "error");
  status.classList.toggle("is-success", state.kind === "success");

  if (state.kind === "hidden") {
    status.hidden = true;
    return;
  }

  if (state.active) {
    status.innerHTML = `
      <div class="khod-spinner" aria-hidden="true"></div>
      <div>
        <strong>${KhodUI.esc(state.title || KhodUI.t("dashboard.fetching_title", "Updating dashboard..."))}</strong>
        <span>${KhodUI.esc(state.body || KhodUI.t("dashboard.fetching_body", "Fetching orders, refreshing product data, and matching ad spend across accounts. This can take a few minutes; keep the app open."))}</span>
      </div>
    `;
    return;
  }

  const icon = state.kind === "error" ? "!" : "i";
  status.innerHTML = `
    <div class="khod-state-icon" aria-hidden="true">${icon}</div>
    <div>
      <strong>${KhodUI.esc(state.title || "")}</strong>
      <span>${KhodUI.esc(state.body || "")}</span>
    </div>
    ${state.retryIds ? `
      <div class="sv3-dashboard-fetch-actions">
        <button class="btn btn-primary" type="button" id="sv3-dashboard-retry-btn">${KhodUI.esc(KhodUI.t("dashboard.fetch_retry", "Try again"))}</button>
        <button class="btn btn-ghost" type="button" id="sv3-dashboard-open-btn">${KhodUI.esc(KhodUI.t("dashboard.fetch_open", "Open dashboard"))}</button>
      </div>
    ` : ""}
  `;
  document.getElementById("sv3-dashboard-retry-btn")?.addEventListener("click", () => _onRunForDashboard(state.retryIds));
  document.getElementById("sv3-dashboard-open-btn")?.addEventListener("click", () => goToDashboard());
}

// ── Manual "Update Dashboard" button handler ──────────────────────────────
// Fetches all selected accounts, then navigates to Dashboard.
// Bot runs update dashboard snapshots automatically when Dashboard is licensed; this remains as a manual refresh path.
async function _onRunForDashboard(selectedAccountIds, period, options) {
  options = options || {};
  if (!window._dashboardEnabled) {
    goToDashboard(); // opens Dashboard preview mode
    return;
  }
  let ids = Array.isArray(selectedAccountIds) ? selectedAccountIds.filter(Boolean) : [];

  let totalRows = 0;
  const failures = [];
  let successCount = 0;
  const range = period || (window.DashboardPeriodState ? window.DashboardPeriodState.get() : null);
  try {
    if (window.api && typeof window.api.getCredentials === "function") {
      const freshCreds = await window.api.getCredentials();
      if (freshCreds && Array.isArray(freshCreds.accounts)) {
        window._kbotAccounts = freshCreds.accounts;
        if (!ids.length) ids = freshCreds.accounts.map((acc) => acc && acc.id).filter(Boolean);
      }
    }
  } catch (e) {
    console.warn("[Dashboard] Could not refresh account credentials before manual fetch:", e.message);
  }
  if (!ids.length) {
    KhodUI.toast(KhodUI.t("dashboard.fetch_error_body", "Select at least one account before updating the dashboard."), { kind: "error" });
    return;
  }
  const accountLabels = new Map((window._kbotAccounts || window.dashboardAccountsList || []).map((acc) => [
    acc.id || acc.value,
    acc.memberName || acc.easyEmail || acc.email || acc.khodEmail || acc.easyStore || acc.storeName || acc.label || acc.name || acc.id || acc.value
  ]));
  _setDashboardFetchUi({
    active: true,
    title: KhodUI.t("dashboard.fetching_title", "Updating dashboard..."),
    body: KhodUI.t("dashboard.fetching_body", "Fetching live Khod data. This may take a few minutes. Keep the app open.")
  });

  for (let i = 0; i < ids.length; i++) {
    const accountId = ids[i];
    try {
      _setDashboardFetchUi({
        active: true,
        title: KhodUI.t("dashboard.fetching_title", "Updating dashboard..."),
        body: _fmtUi("dashboard.fetching_account", { current: i + 1, total: ids.length, account: accountLabels.get(accountId) || accountId }, `Updating ${i + 1} of ${ids.length}: ${accountLabels.get(accountId) || accountId}`)
      });
      const fetchRes = await window.api.runDashboardFetch({
        accountId,
        dateFrom: range?.dateFrom,
        dateTo: range?.dateTo
      });
      if (fetchRes?.success) {
        totalRows += Number(fetchRes.rows || 0);
        successCount += 1;
      } else {
        failures.push({ accountId, label: accountLabels.get(accountId) || accountId, error: fetchRes?.error || "UNKNOWN_ERROR" });
        console.warn(`[Dashboard] Manual fetch failed for ${accountId}:`, fetchRes?.error);
      }
    } catch (e) {
      failures.push({ accountId, label: accountLabels.get(accountId) || accountId, error: e.message || "UNKNOWN_ERROR" });
      console.warn(`[Dashboard] Manual fetch error for ${accountId}:`, e.message);
      if (window.KhodMonitoring) window.KhodMonitoring.captureException(e, {
        operation: "dashboard.manualFetch.account",
        accountId,
      });
    }
  }

  if (failures.length === ids.length) {
    _setDashboardFetchUi({
      kind: "error",
      title: KhodUI.t("dashboard.fetch_error_title", "Dashboard update failed"),
      body: KhodUI.t("dashboard.fetch_error_body", "Some accounts could not be updated. Try again, or open the dashboard to view the latest saved data."),
      retryIds: ids
    });
    KhodUI.toast(KhodUI.t("dashboard.fetch_error_title", "Dashboard update failed"), { kind: "error" });
    return;
  }

  if (failures.length) {
    const failedLabels = failures.map(f => f.label || f.accountId).join(", ");
    const failedIds = failures.map(f => f.accountId);
    const partialBody = _fmtUi(
      "dashboard.fetch_partial_body",
      { count: totalRows, success: successCount, total: ids.length, failed: failedLabels },
      `Fetched ${totalRows} orders from ${successCount} of ${ids.length} account(s). Failed: ${failedLabels}.`
    );
    _setDashboardFetchUi({
      kind: "error",
      title: KhodUI.t("dashboard.fetch_partial", "Dashboard partially updated"),
      body: partialBody,
      retryIds: failedIds
    });
    KhodUI.toast(partialBody, { kind: "error", timeout: 9000 });
  } else {
    _setDashboardFetchUi({
      kind: "success",
      title: KhodUI.t("dashboard.fetch_success", "Dashboard updated"),
      body: _fmtUi("dashboard.fetch_success_body", { count: totalRows, total: ids.length }, `Fetched ${totalRows} orders across ${ids.length} account(s).`)
    });
    KhodUI.toast(KhodUI.t("dashboard.fetch_success", "Dashboard updated"), { kind: "success" });
  }

  if (window.invalidateDashboardCache) window.invalidateDashboardCache();
  if (options.stayOnDashboard && typeof renderDashboard === "function") {
    renderDashboard(() => goToSetup("run"));
  } else {
    goToDashboard();
  }
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
  } else if (id === "page-results" && typeof window._lastResultArgs === "object" && window._lastResultArgs) {
    const { data, dateFrom, dateTo, onRunAgain, onHome } = window._lastResultArgs;
    try { renderResults(data, dateFrom, dateTo, onRunAgain, onHome); } catch(e) {}
  } else if (id === "page-license") {
    // Re-render license page in place so labels switch language
    if (typeof window._renderLicenseInPlace === "function") window._renderLicenseInPlace();
  } else if (id === "page-dashboard") {
    if (typeof renderDashboard === "function") renderDashboard();
  } else if (id === "page-ai-intelligence") {
    if (typeof renderAiIntelligence === "function") renderAiIntelligence();
  } else if (id === "page-analytics") {
    if (typeof renderAnalytics === "function") renderAnalytics(() => goToSetup("run"));
  } else if (id === "page-operations") {
    if (typeof renderOperations === "function") renderOperations(() => goToSetup("run"));
  }
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
