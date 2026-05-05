-- ══════════════════════════════════════════════════════════════
-- KHOD ORDER BOT — Supabase Setup (v3 — multi-account)
-- Run this entire file in: Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ── 1. Licenses table ──
CREATE TABLE IF NOT EXISTS licenses (
  id              BIGSERIAL    PRIMARY KEY,
  license_key     TEXT         NOT NULL UNIQUE,
  customer_name   TEXT,
  notes           TEXT,
  expires_at      DATE         NOT NULL,

  -- Device lock (auto-set on first activation)
  device_id       TEXT,
  activated_at    TIMESTAMPTZ,

  -- Legacy single-account lock columns (kept for backward compat)
  account_hash    TEXT,
  account_locked  BOOLEAN      NOT NULL DEFAULT FALSE,

  -- Multi-account: how many credential slots this license allows
  -- Set this when generating a key from the admin panel
  max_accounts    INT          NOT NULL DEFAULT 1,

  -- Admin controls
  revoked         BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Migrations for existing tables (safe to run multiple times):
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS max_accounts INT NOT NULL DEFAULT 1;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS device_id    TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- ── 2. License Accounts table ──
-- One row per locked account slot per license.
-- Each row = one unique account hash registered against a license.
-- admin can set unlocked=true to allow the user to edit that slot.
-- App auto-sets unlocked=false after user re-saves credentials.
CREATE TABLE IF NOT EXISTS license_accounts (
  id           BIGSERIAL    PRIMARY KEY,
  license_key  TEXT         NOT NULL REFERENCES licenses(license_key) ON DELETE CASCADE,
  account_hash TEXT         NOT NULL,
  unlocked     BOOLEAN      NOT NULL DEFAULT FALSE,
  added_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(license_key, account_hash)
);

-- Migration if table already exists without unlocked column:
ALTER TABLE license_accounts ADD COLUMN IF NOT EXISTS unlocked BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 3. Indexes ──
CREATE INDEX IF NOT EXISTS idx_licenses_key     ON licenses (license_key);
CREATE INDEX IF NOT EXISTS idx_lic_accounts_key ON license_accounts (license_key);

-- ── 4. Row Level Security ──
ALTER TABLE licenses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_accounts ENABLE ROW LEVEL SECURITY;

-- Licenses: app reads and patches (device lock + account hash)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='licenses' AND policyname='Allow read with publishable key') THEN
    CREATE POLICY "Allow read with publishable key"   ON licenses FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='licenses' AND policyname='Allow update with publishable key') THEN
    CREATE POLICY "Allow update with publishable key" ON licenses FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='licenses' AND policyname='Allow insert with publishable key') THEN
    CREATE POLICY "Allow insert with publishable key" ON licenses FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='licenses' AND policyname='Allow delete with publishable key') THEN
    CREATE POLICY "Allow delete with publishable key" ON licenses FOR DELETE USING (true);
  END IF;
END $$;

-- License accounts: app reads, inserts, updates (lock/unlock), admin can delete
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='license_accounts' AND policyname='Allow read license_accounts') THEN
    CREATE POLICY "Allow read license_accounts"   ON license_accounts FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='license_accounts' AND policyname='Allow insert license_accounts') THEN
    CREATE POLICY "Allow insert license_accounts" ON license_accounts FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='license_accounts' AND policyname='Allow update license_accounts') THEN
    CREATE POLICY "Allow update license_accounts" ON license_accounts FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='license_accounts' AND policyname='Allow delete license_accounts') THEN
    CREATE POLICY "Allow delete license_accounts" ON license_accounts FOR DELETE USING (true);
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- HOW IT WORKS:
--
-- 1. Admin generates key in admin panel, sets max_accounts (1-10+)
-- 2. User activates key → device_id auto-locked on first use
-- 3. User adds accounts in app → each account hash saved to license_accounts
-- 4. Once saved, account is locked (unlocked=false) — Edit/Remove disabled
-- 5. User asks admin to unlock → admin clicks "Unlock" in admin panel
--    → sets unlocked=true for that specific hash
-- 6. App polls on startup → re-enables Edit button for that slot only
-- 7. User edits and saves → app sets unlocked=false again (re-locks)
-- 8. Add Account button is disabled in app if accounts.length >= max_accounts
-- 9. Topbar shows "X accounts" badge when max_accounts > 1
-- ══════════════════════════════════════════════════════════════
