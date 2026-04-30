# Khod Order Bot ⚡

Automates daily order processing: exports from Easy-Orders, compares against Taager, and outputs a ready-to-upload العربة Excel file.

---

## Download (Users)

Go to the [**Releases page**](../../releases/latest) and download:

| Platform | File |
|----------|------|
| 🪟 Windows | `Khod-Order-Bot-Setup.exe` (installer) or `Khod-Order-Bot-Portable.exe` |
| 🍎 macOS Intel | `Khod-Order-Bot-x64.dmg` |
| 🍎 macOS Apple Silicon (M1/M2/M3/M4) | `Khod-Order-Bot-arm64.dmg` |

> **macOS note:** Right-click the app → **Open** on first launch to bypass Gatekeeper (app is unsigned).

---

## First Run

1. Open the app — it will ask for your credentials:
   - **Taager** email + password (or phone + password)
   - **Easy-Orders** email + password + store name
2. Credentials are stored **encrypted on your device** — never sent anywhere else.

---

## Daily Use

1. Open the app
2. Click **Continue — Today** to process today's orders
3. If Easy-Orders requires 2FA, complete it in the browser window that opens
4. Wait ~3–5 minutes for the bot to finish
5. Review the results on the dashboard
6. If Auto-Confirm is OFF (default): go to Taager in the opened browser and click confirm manually

---

## What the Bot Does

| Phase | Action |
|-------|--------|
| 1 | Logs into Easy-Orders |
| 2 | Exports Real Orders for the selected date |
| 3 | Exports Missed Orders for the selected date |
| 4 | Logs into Taager, exports last 10 days of existing orders |
| 5 | Deduplicates by phone number (skips already-submitted orders) |
| 6 | Builds العربة bulk upload Excel + uploads to Taager cart |

---

## Development Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/khod-order-bot.git
cd khod-order-bot

# Install dependencies
npm install

# Install Playwright browser
npx playwright install chromium

# Run in dev mode
npm run dev
```

---

## Building Locally

```bash
# macOS
npm run dist:mac

# Windows
npm run dist:win

# Both platforms (requires macOS for cross-compile)
npm run dist:all
```

> Built files appear in the `dist/` folder.

---

## GitHub Actions (Automated Builds)

Push a version tag to trigger a full build + release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will:
1. Build macOS DMG + ZIP (Intel + Apple Silicon)
2. Build Windows NSIS installer + Portable EXE
3. Create a GitHub Release with all files attached

---

## Output Excel Format

Matches the Taager العربة bulk upload template exactly:

| Column | Field |
|--------|-------|
| `كود_المنتج` | Product SKU |
| `اسم_المنتج` | Product Name |
| `سعر_المنتج` | Price per piece (SAR) |
| `الكمية` | Quantity |
| `اسم_العميل` | Customer Name |
| `المحافظة` | Province |
| `العنوان` | Address |
| `العنوان الوطني` | National Address (blank) |
| `رقم_الهاتف` | Phone in `966XXXXXXXXX` format |

---

## Reset Credentials

Click **Reset All Data & Credentials** on the welcome screen to wipe everything and start fresh.
