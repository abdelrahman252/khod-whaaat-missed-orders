# Khod Order Bot — Full Workflow Documentation

---

## Overview

The bot does one job: find orders from Easy-Orders that are NOT yet in Khod, and create them one by one in Easy-Orders automatically. Every step is documented below including exactly how prices are calculated, where bugs could hide, and what to verify manually.

---

## App Flow (UI)

```
Open App
  │
  ├─ First time? → License page → Setup page (enter credentials)
  │
  └─ Returning? → Welcome page
        │
        ├─ Continue — Today  → locks today's date, starts bot immediately
        │
        └─ New Date / Range  → pick single day or from→to range, then Launch Bot
              │
              └─ Bot runs 5 phases → Results dashboard
                    │
                    ├─ ⬇️ Download Excel       (all new orders)
                    ├─ ⬇️ Download Failed Orders  (only if failures exist)
                    ├─ 🔄 Run Again            (re-runs same date range)
                    └─ 🏠 Home
```

---

## Phase 1 — Easy-Orders Login

**File:** `src/bot/runner.js` → `phase1_easyOrdersLogin()`

1. Navigate to `https://app.easy-orders.net/` (root, not login page)
2. Check if URL contains "login" — if NOT, already logged in → skip to step 7
3. If on login page → navigate to `/#/login`
4. Fill `#username` with `easyEmail` from saved credentials (up to 3 attempts with reload on failure)
5. Fill `#password` with `easyPassword`
6. Click `button[type="submit"]`
7. Wait up to 5 minutes for URL to leave the login page (handles 2FA — user completes manually in browser)
8. If URL includes `#/store-selection` → find the card whose `h6` text matches `easyStore` from credentials → click it
9. Switch UI to English via `[aria-label="language-switcher"]`

**Session:** Saved in `{userData}/bot-profile` — no re-login needed on next run unless site expires the session.

**Session guard (mid-run):** If Easy-Orders expires the session during any phase (redirects to login mid-run), the bot automatically detects the login redirect, re-runs `phase1_easyOrdersLogin()`, and retries the failed action once — no crash, no lost orders.

---

## Phase 2 — Real Orders Export from Easy-Orders

**File:** `src/bot/runner.js` → `phase2_realOrders()`

Wrapped with session guard — if the session expires mid-export, re-logins and retries automatically.

1. Navigate to `https://app.easy-orders.net/#/orders`
2. Click `button:has-text("Export")`
3. Set start date to **dateFrom - 1 day** (exportFromDate) using the react-datepicker calendar
4. Click confirm in the export dialog
5. Poll `/#/notifications` page every 5 seconds for up to 24 attempts (~2 min) looking for:
   - An `<a>` tag with `href` containing `"orders"` and `".xlsx"`
   - With a green `MuiChip-colorSuccess` chip in its parent tree
   - With a timestamp in the filename ≥ when we triggered the export
6. If not found after 24 attempts → wait 6 minutes (rate limit cooldown) → retry up to 3 times total
7. Download the file directly via `page.context().request.get(url)` → buffer in memory (no disk write)

**What gets parsed** (`src/bot/parser.js` → `parseRealOrders()`):
- Filter rows by `CreatedAt` column matching **dateFrom → dateTo** range
- Skip rows where `Status` = "cancelled" or "canceled"
- Skip rows with invalid/missing phone numbers
- For each valid row extract:
  - `SKU` — first line only (some rows have bundled products separated by `\n`)
  - `Product Name`
  - `Quantity` — first line only
  - `Item Price` — price **per piece** (e.g. 160 SAR)
  - `Total Cost` and `Shipping Cost` — fallback if Item Price is 0
  - `subtotal` = `Item Price × Quantity` (or `Total Cost - Shipping Cost`)
  - `unitPrice` = `Item Price` (or `Math.round(subtotal / qty)`)
  - `source` = `"real"` — carried through to failed orders Excel if this order fails in Phase 5

---

## Phase 3 — Missed Orders Export from Easy-Orders

**File:** `src/bot/runner.js` → `phase3_missedOrders()`

Same export + polling logic as Phase 2 but for `/#/missed-orders` with keyword `"missed-orders"`. Also wrapped with session guard.

**What gets parsed** (`src/bot/parser.js` → `parseMissedOrders()`):
- Skip rows where `Is Completed` = TRUE
- Filter by `Created At` column matching date range
- Skip invalid phones
- Extract `Products` column → strip brackets → `[لعبة الكرة]` → `لعبة الكرة`
- `source` = `"missed"` — carried through to failed orders Excel if this order fails in Phase 5
- **No SKU, no price, no qty** — resolved in the next step from the product catalog

---

## Product Catalog (Auto-Detection)

**File:** `src/bot/parser.js` → `buildProductCatalog()` + `resolveMissedOrders()`

Built from real orders — no manual config needed:

1. Group real orders by `Product Name`
2. For each product, collect all (qty → prices) seen across all orders
3. Find the most common price for each qty tier (statistical mode)
4. Store: `{ sku, productName, minQty, prices: { 1: 160, 2: 320, 3: 450 } }`

**Resolving missed orders:**
1. For each missed order, find matching product by name (exact → case-insensitive → substring)
2. If no match found → order is **skipped** (logged as warning)
3. If match found → assign `minQty` and the corresponding price from catalog
4. `unitPrice` = `Math.round(catalogPrice / minQty)`

---

## Phase 4 — Khod Login + Export

**File:** `src/bot/runner.js` → `phase4_khod()`

**Login:**
1. Navigate to `https://khod-whaat.com/affiliate/auth/login`
2. If URL doesn't contain `/login` or `/auth` → already logged in → skip
3. Fill credentials (email or phone method based on `khodLoginMethod` setting)
4. Submit → wait up to 5 minutes (handles 2FA)
5. Switch language to Arabic via `/lang/sa` if needed

**Session guard (mid-attempt):** After navigating to the orders page, the bot checks if the URL became a login page. If so, it re-runs `khodLogin()` and reloads the orders page before proceeding.

**Export:**
1. Navigate to `https://khod-whaat.com/affiliate/orders/list/all`
2. Pick date range using flatpickr calendar (`#from_date + input`)
   - `dateFrom - 1 day` → today (always today as end date — catches orders from previous bot runs)
3. Click فلترة (filter button) — tries multiple selectors with fallback
4. Click استخراج اكسل (export button) — tries multiple selectors with fallback
5. Wait for download event (up to 15 minutes)
6. Read into buffer (no disk write)
7. Up to 5 retry attempts with 6-minute cooldown between each

**What gets parsed** (`src/bot/parser.js` → `parseKhodPhones()`):
- Find the phone column (header contains "هاتف" but NOT "هاتف 2")
- Extract ALL phones from all rows (no date filter)
- Normalize each phone to 9-digit Saudi core
- Return as a **phone-only** `Set<string>` for deduplication

**⚠️ Why phone-only (not phone+product) for Khod:**
Khod stores product names in a different format (`"1x اسم المنتج-"`) that cannot be reliably matched against Easy-Orders product names. Using phone+product would cause the check to always fail, letting already-submitted orders slip through. The safe rule: if a phone exists in Khod at all (any product), it was already processed — skip it.

---

## Phone Normalization

**File:** `src/bot/phone.js`

Handles all Saudi phone formats:
| Input | Steps | Output |
|---|---|---|
| `0512345678` | strip `0` | `512345678` |
| `+966512345678` | strip non-digits → strip `966` | `512345678` |
| `00966512345678` | strip `00` → strip `966` | `512345678` |
| `5123456780` (10 digits ending 0) | strip trailing `0` | `512345678` |
| Arabic digits `٥١٢٣٤٥٦٧٨` | convert to latin first | `512345678` |
| `966/559154802` | strip non-digits → strip `966` | `559154802` |

**Validation:** Must start with `5` and be exactly 9 digits. Otherwise → `null` → order skipped.

**Output format:** `966` + 9-digit core = `966512345678`

---

## Data Processing — Deduplication

**File:** `src/bot/parser.js` → `mergeAndDeduplicate()`

Priority order: real orders first, missed orders second.

Two separate dedup keys are used:

**`khodKey` = `normPhone` only**
→ Checks against the Khod export. If this phone exists in Khod at all → skip (already processed in a previous bot run).

**`batchKey` = `normPhone + "|" + productName`**
→ Checks within this run's batch only.
- Same phone + **same product** → duplicate → skip one, keep one
- Same phone + **different product** → two separate orders → **keep both**

```
Stats logged:
  realNew          → new real orders going to Phase 5
  realInKhod       → real orders already in Khod (phone match) → skipped
  realDupe         → same phone+product duplicate within batch → skipped
  missedNew        → new missed orders going to Phase 5
  missedInKhod     → missed orders already in Khod → skipped
  missedDupe       → same phone+product already seen in real orders → skipped
```

---

## Phase 5 — Create Orders in Easy-Orders

**File:** `src/bot/runner.js` → `phase5_createOrders()` → `createSingleOrder()` → `createSingleOrderAttempt()`

Processes orders one by one. Each order gets **up to 3 attempts** before being marked as failed.

**Retry logic:**
- Attempt fails for any reason (timeout, network blip, element not found) → navigate to orders list (resets React state) → check for session expiry → retry
- After 3 failed attempts → record as failed → move to next order (bot does not stop)

**Per order steps (`createSingleOrderAttempt`):**
1. Navigate to `/#/orders/create`
2. Session guard: if redirected to login → re-login → retry navigate
3. Wait for `button:has-text("Choose Products")`
4. Click "Choose Products" → modal opens
5. **Multi-strategy product search** (see below)
6. Click "Add Products" → wait for qty input to appear
7. Set quantity
8. Verify and fix price if needed (click pencil icon to unlock → fill unit price)
9. Fill customer name, phone, city (dropdown by visible text), address
10. Verify final total matches expected
11. Click "Submit Order"
12. Wait up to 20 seconds for redirect back to `/#/orders`

**City selection:** Uses visible text matching (immune to UUID changes on deploy). Tries exact match first, then partial. Falls back to `منطقة الرياض` if city not found.

---

## Multi-Strategy Product Search

**File:** `src/bot/runner.js` → `buildSearchStrategies()` + `selectProductInModal()`

Problem: Easy-Orders search is sensitive to mixed Arabic/English product names. A full name like `"splash بخاخ تقشير القدمين بزيت البرتقال والشاي الأخضر 500 مل"` may return zero results because the English word at the start confuses the search index.

Solution — tries 4 strategies in order, stops at first one that returns results:

| # | Strategy | Example |
|---|---|---|
| 1 | Full product name | `splash بخاخ تقشير القدمين بزيت البرتقال...` |
| 2 | Arabic words only | `بخاخ تقشير القدمين بزيت البرتقال والشاي الأخضر مل` |
| 3 | First 3 Arabic words | `بخاخ تقشير القدمين` |
| 4 | English brand word only | `splash` |

**Row matching within results:** For each strategy's results, checks each row's product name cell against the target using:
- Exact match
- Cell text contains target (or vice versa)
- Word overlap ≥ 50% (lowered from 60% for more forgiving matching)

If results exist but no name match → uses first result as fallback on the last strategy.
If all strategies return zero results → order is recorded as failed.

---

## Output Excel

**File:** `src/bot/output.js` → `buildOutputExcel()`

| Column | Source |
|---|---|
| `عدد القطع` | `order.qty` |
| `المنتجات` | `order.productName` |
| `السعر الكلي بدون الشحن` | `order.subtotal` |
| `تاريخ الإنشاء` | `order.date` |
| `المدينة` | `order.city` |
| `المنطقة` | `order.region` |
| `العنوان` | `order.address` |
| `اسم المستلم` | `order.name` |
| `الهاتف  1` | `966` + normPhone |

**Sheet 2 (Summary):** Groups by product name — order count and total qty per product, plus a TOTAL row.

---

## Failed Orders Excel

**File:** `src/bot/output.js` → `buildFailedExcel()`

Generated automatically after Phase 5 if any orders failed. Available via the **⬇️ Download Failed Orders** button (appears in results header only when failures exist, styled in red).

| Column | Content |
|---|---|
| `المصدر` | `طلبات فعلية` (real) or `طلبات فائتة` (missed) |
| `اسم المستلم` | Customer name |
| `الهاتف` | Phone in 966... format |
| `المنتجات` | Product name |
| `عدد القطع` | Qty |
| `السعر الكلي بدون الشحن` | Subtotal |
| `المدينة` | City |
| `العنوان` | Address |
| `سبب الفشل` | Full error message from the bot |

---

## Session Handling Summary

| Where | What happens on session expiry |
|---|---|
| Phase 1 | Detects login page → fills credentials → waits for 2FA if needed |
| Phase 2 & 3 (export) | `withSessionGuard` detects login redirect → re-runs phase1 → retries export |
| Phase 4 Khod (mid-attempt) | Checks URL after page load → re-runs `khodLogin()` → reloads orders page |
| Phase 4 Khod (between retries) | Checks URL before each retry attempt → re-runs `khodLogin()` if needed |
| Phase 5 (per order) | Checks URL after `goto /orders/create` → re-runs phase1 → retries navigate |
| Phase 5 (retry loop) | After failed attempt, checks URL before retrying → re-logins if needed |

---

## Known Edge Cases & What the Bot Does

| Situation | Bot Behavior |
|---|---|
| Phone `00966...` | Strips `00` then `966` → correct 9-digit core |
| Phone `0966...` (single zero) | Strips `0` → gets `966...` → strips `966` → correct |
| Arabic digits in phone | Converted to latin digits before processing |
| Multi-product order row (SKU1\nSKU2) | Takes first SKU only |
| Missed order product not in real orders | Skipped — cannot determine price/SKU |
| Order already in Khod (phone match) | Skipped — phone found in Khod export |
| Same phone, same product in one batch | Second occurrence skipped |
| Same phone, **different** product in one batch | **Both kept** — treated as separate orders |
| Is Completed = TRUE in missed orders | Skipped |
| Status = cancelled in real orders | Skipped |
| Easy-Orders export rate-limited | Waits 6 min, retries up to 3 times |
| Store selection page after login | Clicks card matching `easyStore` credential |
| Session already active | Skips login entirely |
| Session expires mid-run | Auto re-login + retry, no crash |
| Product name has English mixed with Arabic | Multi-strategy search: tries Arabic-only, first 3 words, English brand |
| Product not found after all search strategies | Recorded as failed, bot continues to next order |
| Network timeout / element not found | Up to 3 retry attempts per order with page reload between each |
| Khod orders page not loading | Up to 3 page reloads before failing the attempt |

---

## File Structure

```
khod-order-bot/
├── src/
│   ├── main/
│   │   ├── main.js          Electron main — IPC handlers, credential store, license check, bot spawner
│   │   └── preload.js       Bridge between renderer and main (exposes window.api)
│   ├── renderer/
│   │   ├── index.html       Single HTML shell
│   │   ├── app.js           Page router + translations (EN/AR)
│   │   ├── styles/main.css  Dark theme CSS
│   │   └── pages/
│   │       ├── license.js   License key entry + validation
│   │       ├── setup.js     Credential entry (Easy-Orders + Khod)
│   │       ├── welcome.js   Home screen — date picker + settings
│   │       ├── run.js       Live bot progress — phases, logs, cooldown timers
│   │       └── results.js   Dashboard — stats, product breakdown, failed orders, download buttons
│   └── bot/
│       ├── runner.js        All Playwright automation — 5 phases + session guards + retry logic
│       ├── parser.js        Excel parsing, catalog building, deduplication logic
│       ├── output.js        Builds main output Excel + failed orders Excel
│       └── phone.js         Phone normalization (Saudi numbers, all formats)
├── admin-panel/
│   ├── index.html           License management dashboard (web-based)
│   ├── SETUP_GUIDE.md       Admin panel setup instructions
│   └── SUPABASE_SETUP.sql   Database schema for license system
├── assets/
│   ├── icon.icns            macOS app icon
│   ├── icon.ico             Windows app icon
│   └── icon.png             Linux / fallback icon
├── .github/workflows/
│   └── build.yml            GitHub Actions — auto build + release on version tag
├── package.json
├── README.md
└── WORKFLOW.md              ← This file
```

---

## Data Storage Locations

**Windows:**
| Data | Location |
|---|---|
| Credentials (encrypted) | `%APPDATA%\khod-order-bot\credentials.json` |
| License key (encrypted) | `%APPDATA%\khod-order-bot\license.json` |
| Browser session/cookies | `%APPDATA%\khod-order-bot\bot-profile\` |

**macOS:**
| Data | Location |
|---|---|
| Credentials (encrypted) | `~/Library/Application Support/khod-order-bot/credentials.json` |
| License key (encrypted) | `~/Library/Application Support/khod-order-bot/license.json` |
| Browser session/cookies | `~/Library/Application Support/khod-order-bot/bot-profile/` |

---

## GitHub Actions — Automated Builds

Push a version tag to trigger a full build + GitHub Release:

```bash
git tag v1.0.4
git push origin v1.0.4
```

Builds produced:
- macOS: `Khod-Order-Bot-x64.dmg` + `Khod-Order-Bot-arm64.dmg` + ZIP variants
- Windows: `Khod-Order-Bot-Setup.exe` (NSIS installer) + `Khod-Order-Bot-Portable.exe`

Requires `GH_TOKEN` secret set in GitHub repo settings.

---

*Last updated: May 2026*
