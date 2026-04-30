# Taager Order Bot — Full Workflow Documentation

---

## Overview

The bot does one job: find orders from Easy-Orders that are NOT yet in Taager, and upload them to Taager's cart bulk upload. Every step is documented below including exactly how prices are calculated, where bugs could hide, and what to verify manually.

---

## App Flow (UI)

```
Open App
  │
  ├─ First time? → Setup page (enter credentials)
  │
  └─ Returning? → Welcome page
        │
        ├─ Auto-Confirm toggle (OFF by default — keep OFF until fully trusted)
        │
        ├─ Continue — Today  → locks today's date, starts bot immediately
        │
        └─ New Date / Range  → pick single day or from→to range, then Launch Bot
```

---

## Phase 1 — Easy-Orders Login

**File:** `src/bot/runner.js` → `phase1_easyOrdersLogin()`

1. Navigate to `https://app.easy-orders.net/` (root, not login page)
2. Check if URL contains "login" — if NOT, already logged in → skip to step 7
3. If on login page → navigate to `/#/login`
4. Fill `#username` with `easyEmail` from saved credentials
5. Fill `#password` with `easyPassword`
6. Click `button[type="submit"]`
7. Wait up to 5 minutes for URL to leave the login page (handles 2FA — user completes manually in browser)
8. If URL includes `#/store-selection` → find the card whose `h6` text matches `easyStore` from credentials → click it
9. Switch UI to English via `[aria-label="language-switcher"]`

**Session:** Saved in `{userData}/bot-profile` — no re-login needed on next run unless site expires the session.

---

## Phase 2 — Real Orders Export from Easy-Orders

**File:** `src/bot/runner.js` → `phase2_realOrders()`

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

**⚠️ Price critical note:**
- `unitPrice` = price per piece (e.g. 160 SAR for 1 piece)
- `subtotal` = total for the order (e.g. 320 SAR for 2 pieces)
- The output sheet uses `unitPrice` NOT `subtotal` — Taager multiplies by qty itself
- If `Item Price` column is 0, unitPrice = `Math.round((TotalCost - Shipping) / qty)`

---

## Phase 3 — Missed Orders Export from Easy-Orders

**File:** `src/bot/runner.js` → `phase3_missedOrders()`

Same export + polling logic as Phase 2 but for `/#/missed-orders` with keyword `"missed-orders"`.

**What gets parsed** (`src/bot/parser.js` → `parseMissedOrders()`):
- Skip rows where `Is Completed` = TRUE
- Filter by `Created At` column matching date range
- Skip invalid phones
- Extract `Products` column → strip brackets → `[لعبة الكرة]` → `لعبة الكرة`
- **No SKU, no price, no qty** — these are resolved in the next step

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

**⚠️ Price critical note for missed orders:**
- The catalog stores `subtotal` (total for that qty tier, e.g. 320 SAR for qty=2)
- `unitPrice` = `Math.round(320 / 2)` = 160 SAR ✅
- The output uses `unitPrice` → 160 SAR per piece → Taager × 2 = 320 SAR total ✅

---

## Phase 4 — Taager Login + Export

**File:** `src/bot/runner.js` → `phase4_taager()`

**Login (email method):**
1. Navigate to `https://taager.com/sa/auth/login`
2. If URL doesn't contain `/login` or `/auth` → already logged in → skip
3. Click `#register` button ("تسجيل الدخول بالبريد الإلكتروني")
4. Fill `#email` and `#password`
5. Click `#loginByPhoneNumber` (Taager's confusingly-named submit button for email form)
6. Wait for redirect to `/sa/home` or `/sa/orders`

**Login (phone method):**
1. Fill `input[name="phoneNumber"]`
2. Fill `#password`
3. Click `#phone-login-submit-btn`

**Export:**
1. Navigate to `https://taager.com/sa/orders`
2. Set start date to **dateFrom - 10 days** using Taager's calendar
   - Why 10 days: catches orders that were submitted on previous days (e.g. if you didn't run the bot for 3 days, phones from those days are still in Taager and should be excluded)
3. Click `#orders-search-button` → wait for results
4. Click `#export-to-excel-button` → wait for download event
5. Read into buffer (no disk write)

**What gets parsed** (`src/bot/parser.js` → `parseTaagerPhones()`):
- Find the column whose header contains "هاتف" (phone)
- Extract ALL phones from all rows (no date filter — we want the full 10-day window)
- Normalize each phone to 9-digit Saudi core using `normalizePhone()`
- Return as a `Set<string>` for O(1) deduplication lookups

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

For each order:
1. Normalize phone → 9-digit core
2. Check against `taagerPhones` Set (from Phase 4 export) → if found → **skip** (already in Taager)
3. Check against `seen` Set (within this batch) → if found → **skip** (duplicate in same run)
4. If passes both → add to result

```
Stats logged:
  realNew        → new real orders going to output
  realInTaager   → real orders already submitted to Taager
  realDupe       → duplicate phones within real orders batch
  missedNew      → new missed orders going to output
  missedInTaager → missed orders already submitted to Taager
  missedDupe     → missed order phone already seen in real orders
```

---

## Output Excel — العربة Template

**File:** `src/bot/output.js` → `buildOutputExcel()`

Column mapping to Taager's bulk upload format:

| Column | Source | Notes |
|---|---|---|
| `كود_المنتج` | `order.sku` | From EasyOrders SKU column |
| `اسم_المنتج` | `order.productName` | Truncated to 50 chars |
| `سعر_المنتج` | `order.unitPrice` | **Price PER PIECE** — Taager multiplies by qty |
| `الكمية` | `order.qty` | Minimum qty from catalog |
| `اسم_العميل` | `order.name` | Truncated to 50 chars |
| `المحافظة` | `order.city` | Default: المنطقة الشرقية |
| `العنوان` | `order.address` | Default: المنطقة الشرقية |
| `العنوان الوطني` | `""` | Always empty (optional field) |
| `رقم_الهاتف` | `formatPhone966(normPhone)` | Always `966XXXXXXXXX` format |

**Sheet 2 (Summary):** Groups by product name — shows order count and total qty per product.

---

## Phase 5 — Upload to Taager Cart

**File:** `src/bot/runner.js` → `phase5_uploadToCart()`

1. Write output buffer to temp file: `{os.tmpdir()}/taager-upload-{timestamp}.xlsx`
2. Navigate to `https://taager.com/sa/cart`
3. Click `#multipleCustomers-tab-btn` ("إرسال إلى عدة عملاء")
4. Find `#upload-file-input` (hidden `<input type="file" accept=".xlsx">`)
5. Call `setInputFiles(tempPath)` — injects file directly, no OS dialog opens
6. Wait up to 60 seconds for `#confirm-bulk-orders` button to appear

**If Auto-Confirm is OFF (default):**
- Show alert in UI: "Action Required — Review & Confirm Orders"
- Play double beep sound + fire system notification
- Bot waits up to 10 minutes watching for the confirm button to disappear
- User reviews orders in browser → clicks تأكيد كل الطلبات manually
- Bot detects button disappeared → continues

**If Auto-Confirm is ON:**
- Bot clicks `#confirm-bulk-orders` automatically
- No user action needed

**After confirm (either mode):**
1. Wait 5 seconds for Taager to process orders
2. Check if `#download-failed-orders` button is visible (within 25s)
3. If visible → click it → download failed orders xlsx → parse it
4. Append failed orders to `{userData}/failed-orders/failed-orders.xlsx` with run date/time
5. Delete temp upload file
6. Return `{ count, rows, failedDir, failedFilePath }` to dashboard

---

## Failed Orders

**Saved to:** `C:\Users\{user}\AppData\Roaming\taager-order-bot\failed-orders\failed-orders.xlsx`

Each row from Taager's failed orders file is saved with two extra columns:
- `Run Date` — YYYY-MM-DD of when the bot ran
- `Run Time` — HH:MM:SS

Runs **accumulate** — each run's failures are appended to the same file. Use the "📁 Open Folder" button on the results dashboard to open it directly.

Common failure reasons (from Taager):
- `Product SA010EF40099 is not available` → SKU not active in your Taager account
- Phone number invalid for the region
- Address too vague

---

## Known Edge Cases & What the Bot Does

| Situation | Bot Behavior |
|---|---|
| Phone `00966...` | Correctly strips `00` then `966` (duk.js fix) |
| Phone `0966...` (single zero) | Strips `0` → gets `966...` → strips `966` → correct |
| Arabic digits in phone | Converted to latin digits before processing |
| Multi-product order row (SKU1\nSKU2) | Takes first SKU only |
| Missed order product not in real orders | Skipped — cannot determine price/SKU |
| Order already in Taager (last 10 days) | Skipped — phone found in Taager export |
| Duplicate phone in same batch | Second occurrence skipped |
| Is Completed = TRUE in missed orders | Skipped |
| Status = cancelled in real orders | Skipped |
| Easy-Orders export rate-limited | Waits 6 min, retries up to 3 times |
| Store selection page after login | Clicks card matching `easyStore` credential |
| Session already active | Skips login entirely |

---

## Price Verification Checklist

Before trusting auto-confirm, manually verify on a test run:

- [ ] Open the downloaded Excel (or check Taager cart before confirming)
- [ ] For a product with qty=1: `سعر_المنتج` should equal the per-piece price (e.g. 165 SAR)
- [ ] For a product with qty=2: `سعر_المنتج` should be the per-piece price (e.g. 160 SAR), NOT the total (320 SAR)
- [ ] Taager's shown total = `سعر_المنتج × الكمية` — verify this matches expected
- [ ] Phone numbers should all start with `966` followed by 9 digits starting with `5`
- [ ] Product names should match what's in your Taager catalog
- [ ] SKU codes should be valid (failed orders appear if SKU not found)

---

## File Structure

```
taager-order-bot/
├── src/
│   ├── main/
│   │   ├── main.js          Electron main — IPC handlers, credential store, bot spawner
│   │   └── preload.js       Bridge between renderer and main (exposes window.api)
│   ├── renderer/
│   │   ├── index.html       Single HTML shell
│   │   ├── app.js           Page router (setup → welcome → run → results)
│   │   ├── styles/main.css  Dark theme CSS
│   │   └── pages/
│   │       ├── setup.js     First-run credential entry (email/phone toggle for Taager)
│   │       ├── welcome.js   Home screen — date picker + auto-confirm toggle + reset
│   │       ├── run.js       Live bot progress — phases, logs, sound alerts, 2FA notice
│   │       └── results.js   Dashboard — stats, product breakdown, failed orders card
│   └── bot/
│       ├── runner.js        All Playwright automation — 5 phases
│       ├── parser.js        Excel parsing, catalog building, deduplication
│       ├── output.js        Builds العربة output Excel
│       └── phone.js         Phone normalization (Saudi numbers)
├── package.json
├── README.md
└── WORKFLOW.md              ← This file
```

---

## Data Storage Locations (Windows)

| Data | Location |
|---|---|
| Credentials (encrypted) | `%APPDATA%\taager-order-bot\credentials.json` |
| Browser session/cookies | `%APPDATA%\taager-order-bot\bot-profile\` |
| Failed orders history | `%APPDATA%\taager-order-bot\failed-orders\failed-orders.xlsx` |

---

*Last updated: April 2026*
