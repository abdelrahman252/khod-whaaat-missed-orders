# Khod Bot — Commands for Windows (Your PC)

## Step 1 — Install tools (once)

1. **Install Node.js** → https://nodejs.org → download LTS → install it
2. **Install Git** → https://git-scm.com/download/win → install it
3. Open **Git Bash** (comes with Git — search it in Start Menu)

> Use Git Bash for ALL commands below, not PowerShell or CMD

---

## Step 2 — Create GitHub repo (once)

1. Go to https://github.com/new
2. Name it: `khod-order-bot`
3. Set it to **Private**
4. Do NOT tick any checkboxes (no README, no .gitignore)
5. Click **Create repository**

---

## Step 3 — Push your app to GitHub (once)

Open Git Bash, then run:

```bash
cd /c/path/to/your/app_final
# Example: cd /c/Users/Ahmed/Desktop/app_final

git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/khod-order-bot.git
git push -u origin main
```

Replace YOUR_USERNAME with your actual GitHub username.

---

## Step 4 — Release a new build (every time you want to publish)

```bash
cd /c/path/to/your/app_final

# Commit any changes first
git add .
git commit -m "update something"

# Tag the version — change the number each release
git tag v1.0.0

# Push code + tag — this starts the build automatically
git push && git push --tags
```

GitHub Actions will now:
- Build the Mac DMG on a Mac cloud machine (~8 min)
- Build the Windows EXE on a Windows cloud machine (~10 min)
- Create a Release with all files ready to download

Go to: https://github.com/YOUR_USERNAME/khod-order-bot/releases
Download and share with customers from there.

---

## How to generate a license key for a customer

No terminal needed! Just open the file:

  keygen-tool/KEYGEN.html  ← double-click this in Windows Explorer

Then:
1. Type the customer's name
2. Paste their Device ID (they see it in the app)
3. Select the month
4. Click Generate → Copy → send to customer

That's it. History is saved automatically in the file.

---

## Push changes without releasing

```bash
git add .
git commit -m "fix something"
git push
# No tag = no build. Safe to push work-in-progress.
```

---

## Next version numbers

v1.0.0 → v1.0.1 (small fix)
v1.0.0 → v1.1.0 (new feature)
v1.0.0 → v2.0.0 (big change)

---

## What customers do on Mac (first launch)

Since the app is not signed with an Apple certificate, Mac users
will see a security warning the FIRST time only. Tell them:

  Right-click the app → click Open → click Open again

After that it works normally, no more warnings.
