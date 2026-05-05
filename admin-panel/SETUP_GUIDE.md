# Khod Bot — License System Setup Guide

## What Was Changed
- `src/main/main.js` — Added Supabase verification + account lock logic
- `src/renderer/pages/setup.js` — Shows error if user tries wrong account
- `admin-panel/index.html` — Your admin dashboard (open in any browser)
- `admin-panel/SUPABASE_SETUP.sql` — Run this once in Supabase

---

## STEP 1 — Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click **"New Project"**
3. Fill in:
   - **Project name**: khod-bot (or anything)
   - **Database password**: strong password (save it)
   - **Region**: pick closest to you (Europe is fine)
4. Click **"Create new project"** — wait ~1 minute

---

## STEP 2 — Create the Database Table

1. In your Supabase project, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `admin-panel/SUPABASE_SETUP.sql`
4. Copy ALL its content and paste it into the SQL editor
5. Click **"Run"** (green button)
6. You should see: `Success. No rows returned`

---

## STEP 3 — Get Your Keys

1. In Supabase, click **"Project Settings"** (gear icon, bottom left)
2. Click **"Data API"** (or "API" depending on version)
3. Copy:
   - **Project URL** → looks like `https://xxxx.supabase.co`
   - **Publishable key** (or "anon key") → long text starting with `eyJ`

---

## STEP 4 — Add Keys to the App

Open `src/main/main.js` and find these 2 lines near the top:

```javascript
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";
```

Replace them with your actual values:

```javascript
const SUPABASE_URL = "https://xxxx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

Save the file.

---

## STEP 5 — Build and Distribute

Build as normal using GitHub Actions:
- Push to GitHub → the workflow builds Mac + Windows installers
- Send the installer to your customer (same as before)

---

## STEP 6 — Use the Admin Panel

Open `admin-panel/index.html` in any browser (Chrome, Firefox, etc.)
- Enter your Supabase URL and Publishable Key → click Connect
- The panel saves your keys locally so you don't have to enter again

### Generate a Key for a New Customer:
1. Customer installs the app → they see their **Device ID** on the license screen
2. Customer sends you their Device ID (12 characters)
3. In admin panel → **Generate Key** tab
4. Enter their Device ID + today's date + customer name
5. Click Generate → key appears and is saved to Supabase automatically
6. Copy the key and send it to the customer

### Customer Changed Password?
1. Customer tells you: "I need to change my credentials"
2. In admin panel → **Unlock Account** tab
3. Enter their license key → click Unlock
4. Tell customer: "Go to the app, click Reset, enter new credentials"
5. Done — the app will lock to the new credentials

### Customer Stopped Paying?
1. In admin panel → **Revoke License** tab (or use the Revoke button in the Licenses table)
2. Enter their license key → click Revoke
3. Next time they try to activate (or when their key expires), they'll be blocked

---

## How the Account Lock Works

| Situation | What Happens |
|-----------|-------------|
| Customer enters credentials first time | App locks to those credentials in Supabase |
| Customer clicks Reset + enters SAME credentials | ✅ Works fine |
| Customer clicks Reset + enters DIFFERENT credentials | ❌ Blocked — "Account Locked" error |
| Customer uninstalls + reinstalls + enters SAME credentials | ✅ Works fine (Supabase still has the lock) |
| Customer uninstalls + reinstalls + enters DIFFERENT credentials | ❌ Blocked |
| You unlock from admin panel | ✅ Customer can enter new credentials once |
| License expires (30 days) | ❌ App shows License Expired |
| You revoke the license | ❌ App cannot activate |

---

## Security Notes

- The Publishable Key is safe to include in the app — it can only read/update the `licenses` table (nothing else)
- The HMAC secret (`LICENSE_SECRET`) in `main.js` is what makes keys impossible to fake — keep it private
- Never share `main.js` source code with anyone
