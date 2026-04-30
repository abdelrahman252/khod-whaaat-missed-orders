# Khod Bot — Terminal Commands (Mac)

## First time setup (run once)

```bash
# 1. Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Install Node.js (if not installed)
brew install node

# 3. Install Git (if not installed)
brew install git

# 4. Configure Git with your name & email
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

---

## Create GitHub repo & push (run once)

```bash
# Go to: https://github.com/new
# Create a NEW PRIVATE repo named:  khod-order-bot
# Do NOT add README or .gitignore (keep it empty)
# Then come back here and run these:

cd /path/to/your/app_final     # ← replace with your actual folder path

git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/khod-order-bot.git
git push -u origin main
```

---

## Install dependencies locally (run once after cloning)

```bash
cd /path/to/your/app_final
npm install
npx playwright install chromium
```

---

## Release a new build (run every time you want a new version)

```bash
cd /path/to/your/app_final

# 1. Commit any changes
git add .
git commit -m "describe what changed"

# 2. Tag the version  (change v1.0.0 to v1.0.1, v1.1.0, etc.)
git tag v1.0.0

# 3. Push code + tag — this triggers GitHub Actions to build automatically
git push && git push --tags
```

GitHub Actions will now:
- Build Mac DMG (Intel + Apple Silicon)  ~6-8 min
- Build Windows EXE installer + portable  ~8-10 min
- Create a GitHub Release with all files attached

Go to:  https://github.com/YOUR_USERNAME/khod-order-bot/releases
Download from there and share with customers.

---

## Test locally on your Mac (no build needed)

```bash
cd /path/to/your/app_final
npm start
```

---

## Generate a license key for a customer

```bash
cd /path/to/your/app_final/keygen-tool

# Single customer (paste their Device ID)
node generate-license.js A1B2C3D4E5F6

# For a future month
node generate-license.js A1B2C3D4E5F6 2025-08

# All customers at once (edit customers.json first)
node generate-batch.js
```

---

## Push code changes (without releasing)

```bash
git add .
git commit -m "fix something"
git push
# No tag = no build triggered. Safe for work-in-progress.
```

---

## Notes
- GitHub Actions free tier gives 2,000 min/month (Linux), 2,000 Mac min, 1,000 Win min
- Each full build (Mac + Win) takes ~15-18 min total = you get ~55 free releases/month
- Mac runners use 10x multiplier on free plan — but you have plenty for your use
- If you run out, use only macos in the YAML and build Windows locally
