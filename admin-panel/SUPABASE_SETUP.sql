-- KHOD Bot - Supabase setup
-- Run this entire file in Supabase Dashboard > SQL Editor.
--
-- Security model:
-- - Direct anon/authenticated table access is denied by RLS.
-- - The desktop app uses narrow SECURITY DEFINER RPC functions.
-- - The admin panel must use the service-role key and is for private admin use only.

CREATE TABLE IF NOT EXISTS public.licenses (
  id             BIGSERIAL PRIMARY KEY,
  license_key    TEXT NOT NULL UNIQUE,
  customer_name  TEXT,
  notes          TEXT,
  expires_at     TIMESTAMPTZ,
  machine_uuid   TEXT,
  device_id      TEXT,
  activated_at   TIMESTAMPTZ,
  account_hash   TEXT,
  account_locked BOOLEAN NOT NULL DEFAULT FALSE,
  max_accounts   INT NOT NULL DEFAULT 1,
  max_devices    INT NOT NULL DEFAULT 1,
  revoked        BOOLEAN NOT NULL DEFAULT FALSE,
  allow_reset    BOOLEAN NOT NULL DEFAULT FALSE,
  force_flush    BOOLEAN NOT NULL DEFAULT FALSE,
  reset_cache    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS customer_name  TEXT;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS notes          TEXT;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS expires_at     TIMESTAMPTZ;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS machine_uuid   TEXT;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS device_id      TEXT;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS activated_at   TIMESTAMPTZ;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS account_hash   TEXT;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS account_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS max_accounts   INT NOT NULL DEFAULT 1;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS max_devices    INT NOT NULL DEFAULT 1;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS revoked        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS allow_reset          BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS force_flush          BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS reset_cache          BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS analytics_enabled    BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS operations_enabled   BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS dashboard_enabled    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS team_leader_enabled  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS bulk_orders_email    TEXT;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS bulk_orders_password TEXT;

CREATE TABLE IF NOT EXISTS public.license_accounts (
  id           BIGSERIAL PRIMARY KEY,
  license_key  TEXT NOT NULL REFERENCES public.licenses(license_key) ON DELETE CASCADE,
  account_hash TEXT NOT NULL,
  easy_email   TEXT,
  easy_store   TEXT,
  khod_email TEXT,
  unlocked     BOOLEAN NOT NULL DEFAULT FALSE,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(license_key, account_hash)
);

ALTER TABLE public.license_accounts ADD COLUMN IF NOT EXISTS easy_email TEXT;
ALTER TABLE public.license_accounts ADD COLUMN IF NOT EXISTS easy_store TEXT;
ALTER TABLE public.license_accounts ADD COLUMN IF NOT EXISTS khod_email TEXT;
ALTER TABLE public.license_accounts ADD COLUMN IF NOT EXISTS unlocked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.license_devices (
  id            BIGSERIAL PRIMARY KEY,
  license_key   TEXT NOT NULL REFERENCES public.licenses(license_key) ON DELETE CASCADE,
  machine_uuid  TEXT,
  device_id     TEXT,
  activated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked       BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_licenses_key     ON public.licenses (license_key);
CREATE INDEX IF NOT EXISTS idx_lic_accounts_key ON public.license_accounts (license_key);
CREATE INDEX IF NOT EXISTS license_devices_license_key_idx ON public.license_devices (license_key);
CREATE UNIQUE INDEX IF NOT EXISTS license_devices_active_machine_uuid_idx
  ON public.license_devices (license_key, machine_uuid)
  WHERE machine_uuid IS NOT NULL AND revoked = FALSE;
CREATE INDEX IF NOT EXISTS license_devices_active_device_id_idx
  ON public.license_devices (license_key, device_id)
  WHERE device_id IS NOT NULL AND revoked = FALSE;

ALTER TABLE public.licenses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_devices  ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'info' CHECK (kind IN ('info', 'warn', 'success')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_notifications_one_active_idx
  ON public.admin_notifications ((active)) WHERE active = TRUE;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.admin_error_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key_mask TEXT,
  customer_name TEXT,
  process TEXT NOT NULL DEFAULT 'main',
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('warning', 'error', 'fatal')),
  operation TEXT,
  route TEXT,
  error_name TEXT,
  message TEXT NOT NULL,
  stack_top TEXT,
  app_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
ALTER TABLE public.admin_error_alerts ADD COLUMN IF NOT EXISTS license_key_mask TEXT;
ALTER TABLE public.admin_error_alerts ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.admin_error_alerts ADD COLUMN IF NOT EXISTS process TEXT NOT NULL DEFAULT 'main';
ALTER TABLE public.admin_error_alerts ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'error';
ALTER TABLE public.admin_error_alerts ADD COLUMN IF NOT EXISTS operation TEXT;
ALTER TABLE public.admin_error_alerts ADD COLUMN IF NOT EXISTS route TEXT;
ALTER TABLE public.admin_error_alerts ADD COLUMN IF NOT EXISTS error_name TEXT;
ALTER TABLE public.admin_error_alerts ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.admin_error_alerts ADD COLUMN IF NOT EXISTS stack_top TEXT;
ALTER TABLE public.admin_error_alerts ADD COLUMN IF NOT EXISTS app_version TEXT;
ALTER TABLE public.admin_error_alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.admin_error_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS admin_error_alerts_created_idx ON public.admin_error_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_error_alerts_unresolved_idx ON public.admin_error_alerts (resolved_at, created_at DESC);
ALTER TABLE public.admin_error_alerts ENABLE ROW LEVEL SECURITY;

-- Drop all direct table policies. The customer app must never access these
-- tables directly with the publishable/anon key. It can only use the narrow
-- SECURITY DEFINER RPC functions below. The local admin panel uses the
-- service-role key, which bypasses RLS for private admin operations.
DROP POLICY IF EXISTS "Allow read with publishable key"   ON public.licenses;
DROP POLICY IF EXISTS "Allow update with publishable key" ON public.licenses;
DROP POLICY IF EXISTS "Allow insert with publishable key" ON public.licenses;
DROP POLICY IF EXISTS "Allow delete with publishable key" ON public.licenses;
DROP POLICY IF EXISTS "Allow read license_accounts"       ON public.license_accounts;
DROP POLICY IF EXISTS "Allow insert license_accounts"     ON public.license_accounts;
DROP POLICY IF EXISTS "Allow update license_accounts"     ON public.license_accounts;
DROP POLICY IF EXISTS "Allow delete license_accounts"     ON public.license_accounts;
DROP POLICY IF EXISTS "Allow read license_devices"         ON public.license_devices;
DROP POLICY IF EXISTS "Allow insert license_devices"       ON public.license_devices;
DROP POLICY IF EXISTS "Allow update license_devices"       ON public.license_devices;
DROP POLICY IF EXISTS "Allow delete license_devices"       ON public.license_devices;

-- The desktop app never touches these tables directly — it only calls SECURITY DEFINER RPCs.
REVOKE ALL ON TABLE public.licenses FROM anon, authenticated;
REVOKE ALL ON TABLE public.license_accounts FROM anon, authenticated;
REVOKE ALL ON TABLE public.license_devices FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_notifications FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_error_alerts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.khod_get_active_admin_notification(
  p_license_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_row public.admin_notifications%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.licenses
    WHERE license_key = UPPER(TRIM(p_license_key))
      AND revoked = FALSE
      AND (expires_at IS NULL OR expires_at >= NOW())
  ) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO notification_row
  FROM public.admin_notifications
  WHERE active = TRUE
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', notification_row.id,
    'title', notification_row.title,
    'message', notification_row.message,
    'kind', notification_row.kind,
    'created_at', notification_row.created_at
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- NEW PRIMARY CHECK: 3-layer device matching + force_flush + feature flags
-- Layer 1: machine_uuid match (stable random UUID, fastest path)
-- Layer 2: device_id (hardware fingerprint) match — backward compat
-- Layer 3: account identity match — self-healing after hardware change
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.khod_check_license_with_identity(
  p_license_key    TEXT,
  p_machine_uuid   TEXT,
  p_device_id      TEXT,
  p_account_idents JSONB DEFAULT '[]'::JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.licenses%ROWTYPE;
  device_row RECORD;
  normalized_machine_uuid TEXT := NULLIF(TRIM(COALESCE(p_machine_uuid, '')), '');
  normalized_device_id TEXT := NULLIF(TRIM(COALESCE(p_device_id, '')), '');
  active_device_count INT := 0;
  max_device_count INT := 1;
  matched_layer INT := 0;
  identity_matched BOOLEAN := FALSE;
  do_flush BOOLEAN := FALSE;
  do_reset_cache BOOLEAN := FALSE;
BEGIN
  SELECT * INTO r
  FROM public.licenses
  WHERE license_key = UPPER(TRIM(p_license_key))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'License not found on server.');
  END IF;
  IF r.revoked THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Your license has been revoked. Contact support.');
  END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'License expired. Please renew.');
  END IF;
  IF normalized_machine_uuid IS NULL AND normalized_device_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Cannot identify this device. Restart the app and try again.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(r.license_key));
  max_device_count := GREATEST(1, COALESCE(r.max_devices, 1));

  IF (r.machine_uuid IS NOT NULL OR r.device_id IS NOT NULL)
     AND NOT EXISTS (
       SELECT 1 FROM public.license_devices
       WHERE license_key = r.license_key AND revoked = FALSE
     )
  THEN
    INSERT INTO public.license_devices (license_key, machine_uuid, device_id, activated_at, last_seen_at)
    VALUES (r.license_key, NULLIF(TRIM(COALESCE(r.machine_uuid, '')), ''), NULLIF(TRIM(COALESCE(r.device_id, '')), ''), COALESCE(r.activated_at, NOW()), NOW());
  END IF;

  IF COALESCE(r.allow_reset, false) = TRUE THEN
    UPDATE public.license_devices
    SET revoked = TRUE, revoked_at = NOW()
    WHERE license_key = r.license_key AND revoked = FALSE;

    INSERT INTO public.license_devices (license_key, machine_uuid, device_id)
    VALUES (r.license_key, normalized_machine_uuid, normalized_device_id);

    UPDATE public.licenses
    SET machine_uuid = normalized_machine_uuid,
        device_id = normalized_device_id,
        activated_at = NOW(),
        allow_reset = FALSE
    WHERE license_key = r.license_key;
    r.machine_uuid := normalized_machine_uuid;
    r.device_id := normalized_device_id;
    r.allow_reset := FALSE;
    matched_layer := 0;
  ELSE
    SELECT id, machine_uuid, device_id INTO device_row
    FROM public.license_devices ld
    WHERE ld.license_key = r.license_key
      AND ld.revoked = FALSE
      AND (
        (normalized_machine_uuid IS NOT NULL AND ld.machine_uuid = normalized_machine_uuid)
        OR (
          normalized_device_id IS NOT NULL
          AND ld.device_id = normalized_device_id
          AND (max_device_count = 1 OR ld.machine_uuid IS NULL)
        )
      )
    ORDER BY CASE WHEN normalized_machine_uuid IS NOT NULL AND ld.machine_uuid = normalized_machine_uuid THEN 0 ELSE 1 END
    LIMIT 1;

    IF FOUND THEN
      SELECT COUNT(*) INTO active_device_count
      FROM public.license_devices
      WHERE license_key = r.license_key AND revoked = FALSE;

      IF active_device_count > max_device_count AND NOT EXISTS (
        SELECT 1
        FROM (
          SELECT id
          FROM public.license_devices
          WHERE license_key = r.license_key AND revoked = FALSE
          ORDER BY activated_at ASC, id ASC
          LIMIT max_device_count
        ) kept
        WHERE kept.id = device_row.id
      ) THEN
        RETURN jsonb_build_object(
          'valid', false,
          'reason', 'License device limit reached. Deactivate another device or contact support.',
          'device_limit_reached', TRUE,
          'max_devices', max_device_count,
          'active_devices', active_device_count
        );
      END IF;

      UPDATE public.license_devices
      SET machine_uuid = COALESCE(normalized_machine_uuid, machine_uuid),
          device_id = COALESCE(normalized_device_id, device_id),
          last_seen_at = NOW()
      WHERE id = device_row.id;
      matched_layer := CASE WHEN device_row.machine_uuid = normalized_machine_uuid THEN 1 ELSE 2 END;
    ELSE
      SELECT COUNT(*) INTO active_device_count
      FROM public.license_devices
      WHERE license_key = r.license_key AND revoked = FALSE;

      IF active_device_count < max_device_count THEN
        INSERT INTO public.license_devices (license_key, machine_uuid, device_id)
        VALUES (r.license_key, normalized_machine_uuid, normalized_device_id);

        IF active_device_count = 0 THEN
          UPDATE public.licenses
          SET machine_uuid = normalized_machine_uuid,
              device_id = normalized_device_id,
              activated_at = NOW()
          WHERE license_key = r.license_key;
          r.machine_uuid := normalized_machine_uuid;
          r.device_id := normalized_device_id;
        END IF;
        matched_layer := 4;
      ELSE
        IF jsonb_array_length(COALESCE(p_account_idents, '[]'::JSONB)) > 0 AND EXISTS (
          SELECT 1 FROM public.license_accounts la
          WHERE la.license_key = r.license_key
            AND (
              (la.easy_email IS NOT NULL AND la.easy_email <> '' AND
               EXISTS (SELECT 1 FROM jsonb_array_elements(p_account_idents) AS ai
                       WHERE LOWER(COALESCE(ai->>'easy_email', '')) = LOWER(la.easy_email)))
              OR
              (la.khod_email IS NOT NULL AND la.khod_email <> '' AND
               EXISTS (SELECT 1 FROM jsonb_array_elements(p_account_idents) AS ai
                       WHERE LOWER(COALESCE(ai->>'khod_email', '')) = LOWER(la.khod_email)))
            )
        ) THEN
          identity_matched := TRUE;
        END IF;

        IF identity_matched AND max_device_count = 1 THEN
          UPDATE public.license_devices
          SET revoked = TRUE, revoked_at = NOW()
          WHERE license_key = r.license_key AND revoked = FALSE;

          INSERT INTO public.license_devices (license_key, machine_uuid, device_id)
          VALUES (r.license_key, normalized_machine_uuid, normalized_device_id);

          UPDATE public.licenses
          SET machine_uuid = normalized_machine_uuid,
              device_id = normalized_device_id,
              activated_at = NOW()
          WHERE license_key = r.license_key;
          r.machine_uuid := normalized_machine_uuid;
          r.device_id := normalized_device_id;
          matched_layer := 3;
        ELSE
          RETURN jsonb_build_object(
            'valid', false,
            'reason', 'License device limit reached. Deactivate another device or contact support.',
            'device_limit_reached', TRUE,
            'max_devices', max_device_count,
            'active_devices', active_device_count
          );
        END IF;
      END IF;
    END IF;
  END IF;

  IF COALESCE(r.force_flush, false) = TRUE THEN
    do_flush := TRUE;
    UPDATE public.licenses SET force_flush = FALSE WHERE license_key = r.license_key;
  END IF;

  IF COALESCE(r.reset_cache, false) = TRUE THEN
    do_reset_cache := TRUE;
    UPDATE public.licenses SET reset_cache = FALSE WHERE license_key = r.license_key;
  END IF;

  SELECT COUNT(*) INTO active_device_count
  FROM public.license_devices
  WHERE license_key = r.license_key AND revoked = FALSE;

  RETURN jsonb_build_object(
    'valid', TRUE,
    'license_key', r.license_key,
    'expires_at', r.expires_at,
    'customer_name', r.customer_name,
    'allow_reset', COALESCE(r.allow_reset, FALSE),
    'max_accounts', COALESCE(r.max_accounts, 1),
    'max_devices', max_device_count,
    'active_devices', active_device_count,
    'analytics_enabled', COALESCE(r.analytics_enabled, TRUE),
    'operations_enabled', COALESCE(r.operations_enabled, TRUE),
    'dashboard_enabled', COALESCE(r.dashboard_enabled, FALSE),
    'team_leader_enabled', COALESCE(r.team_leader_enabled, FALSE),
    'bulk_orders_email', COALESCE(r.bulk_orders_email, ''),
    'bulk_orders_password', COALESCE(r.bulk_orders_password, ''),
    'force_flush', do_flush,
    'reset_cache', do_reset_cache,
    'matched_layer', matched_layer
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.khod_check_license(
  p_license_key TEXT,
  p_device_id   TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.licenses%ROWTYPE;
BEGIN
  SELECT * INTO r
  FROM public.licenses
  WHERE license_key = UPPER(TRIM(p_license_key))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'License not found on server.');
  END IF;
  IF r.revoked THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Your license has been revoked. Contact support.');
  END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'License expired. Please renew.');
  END IF;
  IF r.device_id IS NOT NULL AND p_device_id IS NOT NULL AND r.device_id <> p_device_id AND COALESCE(r.allow_reset, false) = false THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'License is linked to a different device. Contact support to reset the device lock.');
  END IF;

  IF COALESCE(r.allow_reset, false) = true AND p_device_id IS NOT NULL THEN
    UPDATE public.licenses
    SET device_id = p_device_id,
        activated_at = NOW(),
        allow_reset = false
    WHERE license_key = r.license_key;
    r.device_id := p_device_id;
    r.allow_reset := false;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'license_key', r.license_key,
    'expires_at', r.expires_at,
    'customer_name', r.customer_name,
    'allow_reset', COALESCE(r.allow_reset, false),
    'max_accounts', COALESCE(r.max_accounts, 1),
    'analytics_enabled',  COALESCE(r.analytics_enabled,  true),
    'operations_enabled', COALESCE(r.operations_enabled, true),
    'dashboard_enabled',  COALESCE(r.dashboard_enabled,  false),
    'team_leader_enabled', COALESCE(r.team_leader_enabled, false),
    'bulk_orders_email', COALESCE(r.bulk_orders_email, ''),
    'bulk_orders_password', COALESCE(r.bulk_orders_password, '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.khod_get_max_accounts(
  p_license_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INT;
BEGIN
  SELECT COALESCE(max_accounts, 1) INTO n
  FROM public.licenses
  WHERE license_key = UPPER(TRIM(p_license_key))
    AND revoked = false
    AND (expires_at IS NULL OR expires_at >= NOW())
  LIMIT 1;

  RETURN jsonb_build_object('max_accounts', COALESCE(n, 1));
END;
$$;

DROP FUNCTION IF EXISTS public.khod_get_license_accounts(TEXT);

CREATE OR REPLACE FUNCTION public.khod_get_license_accounts(
  p_license_key TEXT
) RETURNS TABLE(account_hash TEXT, easy_email TEXT, easy_store TEXT, khod_email TEXT, unlocked BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT la.account_hash, la.easy_email, la.easy_store, la.khod_email, la.unlocked
  FROM public.license_accounts la
  JOIN public.licenses l ON l.license_key = la.license_key
  WHERE la.license_key = UPPER(TRIM(p_license_key))
    AND l.revoked = false
    AND (l.expires_at IS NULL OR l.expires_at >= NOW())
  ORDER BY la.added_at ASC;
$$;

DROP FUNCTION IF EXISTS public.khod_insert_license_account(TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.khod_insert_license_account(TEXT, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.khod_insert_license_account(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.khod_insert_license_account(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.khod_insert_license_account(
  p_license_key  TEXT,
  p_account_hash TEXT,
  p_easy_email   TEXT DEFAULT NULL,
  p_easy_store   TEXT DEFAULT NULL,
  p_khod_email   TEXT DEFAULT NULL,
  p_unlocked     BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_n INT;
  current_n INT;
  normalized_license TEXT;
  normalized_easy_email TEXT;
  normalized_easy_store TEXT;
  normalized_khod_email TEXT;
BEGIN
  normalized_license := UPPER(TRIM(p_license_key));
  normalized_easy_email := LOWER(TRIM(COALESCE(p_easy_email, '')));
  normalized_easy_store := LOWER(regexp_replace(TRIM(COALESCE(p_easy_store, '')), '\s+', ' ', 'g'));
  normalized_khod_email := LOWER(TRIM(COALESCE(p_khod_email, '')));

  PERFORM pg_advisory_xact_lock(hashtext(normalized_license));

  SELECT COALESCE(max_accounts, 1) INTO max_n
  FROM public.licenses
  WHERE license_key = normalized_license
    AND revoked = false
    AND (expires_at IS NULL OR expires_at >= NOW())
  LIMIT 1;

  IF max_n IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'license_invalid');
  END IF;

  IF normalized_khod_email <> '' AND EXISTS (
    SELECT 1
    FROM public.license_accounts la
    WHERE la.license_key = normalized_license
      AND la.account_hash <> p_account_hash
      AND LOWER(TRIM(COALESCE(la.khod_email, ''))) = normalized_khod_email
      AND (
        normalized_easy_email = ''
        OR normalized_easy_store = ''
        OR TRIM(COALESCE(la.easy_email, '')) = ''
        OR (
          TRIM(COALESCE(la.easy_store, '')) <> ''
          AND LOWER(TRIM(la.easy_email)) = normalized_easy_email
          AND LOWER(regexp_replace(TRIM(la.easy_store), '\s+', ' ', 'g')) = normalized_easy_store
        )
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate_account');
  END IF;

  SELECT COUNT(*) INTO current_n
  FROM public.license_accounts
  WHERE license_key = normalized_license;

  IF current_n >= max_n AND NOT EXISTS (
    SELECT 1 FROM public.license_accounts
    WHERE license_key = normalized_license
      AND account_hash = p_account_hash
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'limit_reached');
  END IF;

  INSERT INTO public.license_accounts (license_key, account_hash, easy_email, easy_store, khod_email, unlocked)
  VALUES (normalized_license, p_account_hash, normalized_easy_email, normalized_easy_store, normalized_khod_email, COALESCE(p_unlocked, false))
  ON CONFLICT (license_key, account_hash)
  DO UPDATE SET
    easy_email = EXCLUDED.easy_email,
    easy_store = EXCLUDED.easy_store,
    khod_email = EXCLUDED.khod_email;

  RETURN jsonb_build_object('success', true);
END;
$$;

DROP FUNCTION IF EXISTS public.khod_replace_license_account(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.khod_replace_license_account(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.khod_replace_license_account(
  p_license_key TEXT,
  p_old_account_hash TEXT,
  p_new_account_hash TEXT,
  p_easy_email TEXT DEFAULT NULL,
  p_easy_store TEXT DEFAULT NULL,
  p_khod_email TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_license TEXT := UPPER(TRIM(p_license_key));
  normalized_easy_email TEXT := LOWER(TRIM(COALESCE(p_easy_email, '')));
  normalized_easy_store TEXT := LOWER(regexp_replace(TRIM(COALESCE(p_easy_store, '')), '\s+', ' ', 'g'));
  normalized_khod_email TEXT := LOWER(TRIM(COALESCE(p_khod_email, '')));
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(normalized_license));

  IF NOT EXISTS (
    SELECT 1 FROM public.license_accounts
    WHERE license_key = normalized_license
      AND account_hash = p_old_account_hash
      AND unlocked = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'account_locked');
  END IF;

  IF normalized_khod_email <> '' AND EXISTS (
    SELECT 1
    FROM public.license_accounts la
    WHERE la.license_key = normalized_license
      AND la.account_hash <> p_old_account_hash
      AND LOWER(TRIM(COALESCE(la.khod_email, ''))) = normalized_khod_email
      AND (
        normalized_easy_email = ''
        OR normalized_easy_store = ''
        OR TRIM(COALESCE(la.easy_email, '')) = ''
        OR (
          TRIM(COALESCE(la.easy_store, '')) <> ''
          AND LOWER(TRIM(la.easy_email)) = normalized_easy_email
          AND LOWER(regexp_replace(TRIM(la.easy_store), '\s+', ' ', 'g')) = normalized_easy_store
        )
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate_account');
  END IF;

  UPDATE public.license_accounts
  SET account_hash = p_new_account_hash,
      easy_email = normalized_easy_email,
      easy_store = normalized_easy_store,
      khod_email = normalized_khod_email
  WHERE license_key = normalized_license
    AND account_hash = p_old_account_hash
    AND unlocked = true;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.khod_delete_license_account(
  p_license_key  TEXT,
  p_account_hash TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.license_accounts
  WHERE license_key = UPPER(TRIM(p_license_key))
    AND account_hash = p_account_hash
    AND unlocked = true;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.khod_set_license_account_unlocked(
  p_license_key  TEXT,
  p_account_hash TEXT,
  p_unlocked     BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(p_unlocked, false) = true THEN
    RETURN jsonb_build_object('success', false, 'reason', 'admin_only');
  END IF;

  UPDATE public.license_accounts
  SET unlocked = COALESCE(p_unlocked, false)
  WHERE license_key = UPPER(TRIM(p_license_key))
    AND account_hash = p_account_hash;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.khod_clear_reset_flag(
  p_license_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.licenses
  SET allow_reset = false
  WHERE license_key = UPPER(TRIM(p_license_key));
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.khod_record_license_presence(
  p_license_key TEXT,
  p_machine_uuid TEXT,
  p_device_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_key TEXT := UPPER(TRIM(COALESCE(p_license_key, '')));
  normalized_machine_uuid TEXT := NULLIF(TRIM(COALESCE(p_machine_uuid, '')), '');
  normalized_device_id TEXT := NULLIF(TRIM(COALESCE(p_device_id, '')), '');
  matched_device_id BIGINT;
BEGIN
  IF normalized_key = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_license');
  END IF;
  IF normalized_machine_uuid IS NULL AND normalized_device_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_device');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.licenses
    WHERE license_key = normalized_key
      AND revoked = FALSE
      AND (expires_at IS NULL OR expires_at >= NOW())
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'license_inactive');
  END IF;

  WITH matched AS (
    SELECT id
    FROM public.license_devices
    WHERE license_key = normalized_key
      AND revoked = FALSE
      AND (
        (normalized_machine_uuid IS NOT NULL AND machine_uuid = normalized_machine_uuid)
        OR (normalized_device_id IS NOT NULL AND device_id = normalized_device_id)
      )
    ORDER BY CASE WHEN normalized_machine_uuid IS NOT NULL AND machine_uuid = normalized_machine_uuid THEN 0 ELSE 1 END,
             last_seen_at DESC,
             id ASC
    LIMIT 1
  )
  UPDATE public.license_devices ld
  SET machine_uuid = COALESCE(normalized_machine_uuid, ld.machine_uuid),
      device_id = COALESCE(normalized_device_id, ld.device_id),
      last_seen_at = NOW()
  WHERE ld.id = (SELECT id FROM matched)
  RETURNING id INTO matched_device_id;

  IF matched_device_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'device_not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'recorded_at', NOW());
END;
$$;

CREATE OR REPLACE FUNCTION public.khod_admin_online_customers(
  p_online_window_minutes INTEGER DEFAULT 5
) RETURNS TABLE (
  license_key TEXT,
  customer_name TEXT,
  expires_at TIMESTAMPTZ,
  max_devices INTEGER,
  active_devices BIGINT,
  machine_uuid TEXT,
  device_id TEXT,
  last_seen_at TIMESTAMPTZ,
  minutes_since_seen NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT GREATEST(1, LEAST(1440, COALESCE(p_online_window_minutes, 5))) AS window_minutes
  ),
  online_devices AS (
    SELECT ld.*
    FROM public.license_devices ld, bounds b
    WHERE ld.revoked = FALSE
      AND ld.last_seen_at >= NOW() - (b.window_minutes * INTERVAL '1 minute')
  ),
  active_device_counts AS (
    SELECT license_key, COUNT(*)::BIGINT AS active_devices
    FROM public.license_devices
    WHERE revoked = FALSE
    GROUP BY license_key
  )
  SELECT
    l.license_key,
    l.customer_name,
    l.expires_at,
    GREATEST(1, COALESCE(l.max_devices, 1)) AS max_devices,
    COALESCE(adc.active_devices, 0) AS active_devices,
    od.machine_uuid,
    od.device_id,
    od.last_seen_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - od.last_seen_at)) / 60.0, 2) AS minutes_since_seen
  FROM online_devices od
  JOIN public.licenses l ON l.license_key = od.license_key
  LEFT JOIN active_device_counts adc ON adc.license_key = l.license_key
  WHERE l.revoked = FALSE
    AND (l.expires_at IS NULL OR l.expires_at >= NOW())
  ORDER BY od.last_seen_at DESC, l.license_key ASC;
$$;

CREATE OR REPLACE FUNCTION public.khod_record_admin_error_alert(
  p_license_key TEXT,
  p_event JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_key TEXT := UPPER(TRIM(COALESCE(p_license_key, '')));
  license_row public.licenses%ROWTYPE;
  event_payload JSONB := COALESCE(p_event, '{}'::JSONB);
  event_process TEXT := LEFT(COALESCE(NULLIF(event_payload->>'process', ''), 'main'), 40);
  event_severity TEXT := COALESCE(NULLIF(event_payload->>'severity', ''), 'error');
  event_message TEXT := LEFT(COALESCE(NULLIF(event_payload->>'message', ''), 'Unknown error'), 500);
  inserted_id UUID;
BEGIN
  IF normalized_key = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_license');
  END IF;

  SELECT * INTO license_row
  FROM public.licenses
  WHERE license_key = normalized_key
    AND revoked = FALSE
    AND (expires_at IS NULL OR expires_at >= NOW())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'license_inactive');
  END IF;

  IF event_process NOT IN ('main', 'renderer', 'preload') THEN
    event_process := 'main';
  END IF;
  IF event_severity NOT IN ('warning', 'error', 'fatal') THEN
    event_severity := 'error';
  END IF;

  INSERT INTO public.admin_error_alerts (
    license_key_mask,
    customer_name,
    process,
    severity,
    operation,
    route,
    error_name,
    message,
    stack_top,
    app_version
  ) VALUES (
    LEFT(normalized_key, 9) || '...' || RIGHT(normalized_key, 4),
    license_row.customer_name,
    event_process,
    event_severity,
    LEFT(COALESCE(event_payload->>'operation', 'unknown'), 140),
    LEFT(COALESCE(event_payload->>'route', ''), 120),
    LEFT(COALESCE(event_payload->>'errorName', 'Error'), 80),
    event_message,
    LEFT(COALESCE(event_payload->>'stackTop', ''), 900),
    LEFT(COALESCE(event_payload->>'appVersion', ''), 40)
  )
  RETURNING id INTO inserted_id;

  RETURN jsonb_build_object('ok', true, 'id', inserted_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.khod_check_license_with_identity(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khod_check_license(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khod_get_max_accounts(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khod_get_license_accounts(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khod_insert_license_account(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khod_replace_license_account(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khod_delete_license_account(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khod_set_license_account_unlocked(TEXT, TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khod_clear_reset_flag(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khod_get_active_admin_notification(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khod_record_license_presence(TEXT, TEXT, TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.khod_admin_online_customers(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.khod_admin_online_customers(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.khod_record_admin_error_alert(TEXT, JSONB) TO anon, authenticated;


-- Marketing/Windsor setup ported from main repo.
CREATE TABLE IF NOT EXISTS public.marketing_connections (
  license_key_hash text not null,
  dashboard_account_id text not null,
  platform text not null,
  status text not null default 'disconnected',
  windsor_access_token text,
  source_account_id text,
  source_account_name text,
  last_sync_at timestamptz,
  last_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (license_key_hash, dashboard_account_id, platform)
);

CREATE TABLE IF NOT EXISTS public.marketing_account_mappings (
  license_key_hash text not null,
  dashboard_account_id text not null,
  platform text not null,
  source_account_id text not null,
  source_account_name text,
  source_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (license_key_hash, dashboard_account_id, platform, source_account_id)
);

CREATE TABLE IF NOT EXISTS public.marketing_account_limits (
  license_key_hash text not null,
  dashboard_account_id text not null,
  platform text not null,
  max_source_accounts integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (license_key_hash, dashboard_account_id, platform),
  constraint marketing_account_limits_platform_check check (platform in ('tiktok', 'snapchat', 'facebook')),
  constraint marketing_account_limits_max_check check (max_source_accounts > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS marketing_account_mappings_one_owner_per_source
  ON public.marketing_account_mappings (license_key_hash, platform, source_account_id);

CREATE INDEX IF NOT EXISTS marketing_account_mappings_account_lookup
  ON public.marketing_account_mappings (platform, dashboard_account_id);
CREATE INDEX IF NOT EXISTS marketing_account_limits_account_lookup
  ON public.marketing_account_limits (platform, dashboard_account_id);

ALTER TABLE public.marketing_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_account_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_account_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.marketing_connections FROM anon, authenticated;
REVOKE ALL ON TABLE public.marketing_account_mappings FROM anon, authenticated;
REVOKE ALL ON TABLE public.marketing_account_limits FROM anon, authenticated;

-- Marketing provider key pool. Service-role/admin only.
CREATE TABLE IF NOT EXISTS public.marketing_provider_keys (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'windsor',
  label text not null,
  api_key text not null,
  max_accounts integer not null default 75,
  soft_limit integer not null default 70,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_provider_keys_provider_check check (provider in ('windsor')),
  constraint marketing_provider_keys_status_check check (status in ('active', 'paused', 'full')),
  constraint marketing_provider_keys_limits_check check (max_accounts > 0 and soft_limit > 0 and soft_limit <= max_accounts)
);

CREATE TABLE IF NOT EXISTS public.marketing_provider_assignments (
  license_key_hash text not null,
  dashboard_account_id text not null,
  provider_key_id uuid not null references public.marketing_provider_keys(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (license_key_hash, dashboard_account_id)
);

ALTER TABLE public.marketing_connections
  ADD COLUMN IF NOT EXISTS provider_key_id uuid references public.marketing_provider_keys(id) on delete set null;

ALTER TABLE public.marketing_account_mappings
  ADD COLUMN IF NOT EXISTS provider_key_id uuid references public.marketing_provider_keys(id) on delete set null;

CREATE INDEX IF NOT EXISTS marketing_provider_keys_status_lookup
  ON public.marketing_provider_keys (provider, status, created_at);
CREATE INDEX IF NOT EXISTS marketing_provider_assignments_key_lookup
  ON public.marketing_provider_assignments (provider_key_id);
CREATE INDEX IF NOT EXISTS marketing_connections_provider_key_lookup
  ON public.marketing_connections (provider_key_id);
CREATE INDEX IF NOT EXISTS marketing_account_mappings_provider_key_lookup
  ON public.marketing_account_mappings (provider_key_id);

ALTER TABLE public.marketing_provider_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_provider_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.marketing_provider_keys FROM anon, authenticated;
REVOKE ALL ON TABLE public.marketing_provider_assignments FROM anon, authenticated;


-- Marketing source-account discovery state.
-- From supabase/migrations/202606030001_marketing_source_accounts.sql.
CREATE TABLE IF NOT EXISTS public.marketing_source_accounts (
  license_key_hash text not null,
  platform text not null,
  source_account_id text not null,
  provider_key_id text not null default 'legacy',
  source_account_name text,
  source_currency text,
  status text not null default 'known',
  discovered_by text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (license_key_hash, platform, provider_key_id, source_account_id),
  constraint marketing_source_accounts_status_check check (status in ('known', 'hidden', 'archived'))
);

ALTER TABLE public.marketing_source_accounts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.marketing_connections
  ADD COLUMN IF NOT EXISTS connect_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS connect_started_at timestamptz;

CREATE INDEX IF NOT EXISTS marketing_source_accounts_lookup
  ON public.marketing_source_accounts (license_key_hash, platform, status);

CREATE INDEX IF NOT EXISTS marketing_source_accounts_source_lookup
  ON public.marketing_source_accounts (license_key_hash, platform, source_account_id);

COMMENT ON TABLE public.marketing_source_accounts IS
  'Server-managed app-local pool of Windsor source accounts known to this Khod/KHOD license.';

COMMENT ON COLUMN public.marketing_connections.connect_snapshot IS
  'Windsor source account ids captured before an OAuth connect flow, used to discover newly added accounts.';


-- Marketing incremental daily metrics cache.
-- From supabase/migrations/202606060001_marketing_incremental_cache.sql.
ALTER TABLE public.marketing_connections
  ADD COLUMN IF NOT EXISTS status_checked_at timestamptz;

CREATE TABLE IF NOT EXISTS public.marketing_daily_metrics (
  license_key_hash text not null,
  provider_key_ref text not null default 'legacy',
  platform text not null,
  source_account_id text not null,
  report_date date not null,
  source_account_name text,
  source_currency text not null,
  raw_spend numeric not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  row_count integer not null default 0,
  campaign_breakdown jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (
    license_key_hash,
    provider_key_ref,
    platform,
    source_account_id,
    report_date
  )
);

CREATE INDEX IF NOT EXISTS marketing_daily_metrics_range_lookup
  ON public.marketing_daily_metrics (
    license_key_hash,
    provider_key_ref,
    platform,
    report_date
  );

ALTER TABLE public.marketing_daily_metrics ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.marketing_daily_metrics FROM anon, authenticated;

COMMENT ON COLUMN public.marketing_connections.status_checked_at IS
  'Last time the backend validated this connection against the marketing provider.';

COMMENT ON TABLE public.marketing_daily_metrics IS
  'Server-managed target-currency-independent daily marketing metrics used for incremental synchronization.';


-- License credential backup and restore RPCs.
-- From supabase/migrations/202606220001_license_credential_backup.sql.
CREATE TABLE IF NOT EXISTS public.license_credential_backups (
  license_key text primary key references public.licenses(license_key) on delete cascade,
  payload_version integer not null default 1,
  encrypted_payload jsonb not null,
  account_count integer not null default 0,
  account_hashes jsonb not null default '[]'::jsonb,
  updated_by_machine_uuid text,
  updated_by_device_id text,
  updated_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.license_credential_access_log (
  id bigserial primary key,
  license_key text not null references public.licenses(license_key) on delete cascade,
  machine_uuid text,
  device_id text,
  action text not null,
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS license_credential_access_log_lookup_idx
  ON public.license_credential_access_log (license_key, action, created_at desc);

ALTER TABLE public.license_credential_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_credential_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct credential backup access" ON public.license_credential_backups;
DROP POLICY IF EXISTS "No direct credential access log access" ON public.license_credential_access_log;

REVOKE ALL ON TABLE public.license_credential_backups FROM anon, authenticated;
REVOKE ALL ON TABLE public.license_credential_access_log FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.license_credential_access_log_id_seq FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.khod_license_credential_device_allowed(
  p_license_key text,
  p_machine_uuid text,
  p_device_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.licenses%rowtype;
  normalized_key text := upper(trim(coalesce(p_license_key, '')));
  normalized_machine_uuid text := nullif(trim(coalesce(p_machine_uuid, '')), '');
  normalized_device_id text := nullif(trim(coalesce(p_device_id, '')), '');
BEGIN
  SELECT * INTO r
  FROM public.licenses
  WHERE license_key = normalized_key
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'license_not_found');
  END IF;
  IF coalesce(r.revoked, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'license_revoked');
  END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'license_expired');
  END IF;
  IF normalized_machine_uuid IS NULL AND normalized_device_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'device_unknown');
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.license_devices ld
    WHERE ld.license_key = normalized_key
      AND ld.revoked = false
      AND (
        (normalized_machine_uuid IS NOT NULL AND ld.machine_uuid = normalized_machine_uuid)
        OR (normalized_device_id IS NOT NULL AND ld.device_id = normalized_device_id)
      )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'device_not_activated');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'license_key', normalized_key,
    'max_accounts', greatest(1, coalesce(r.max_accounts, 1))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.khod_record_license_credential_access(
  p_license_key text,
  p_machine_uuid text,
  p_device_id text,
  p_action text,
  p_limit integer default 12,
  p_window interval default interval '10 minutes'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_key text := upper(trim(coalesce(p_license_key, '')));
  normalized_action text := lower(trim(coalesce(p_action, '')));
  recent_count integer := 0;
BEGIN
  DELETE FROM public.license_credential_access_log
  WHERE created_at < now() - interval '7 days';

  SELECT count(*) INTO recent_count
  FROM public.license_credential_access_log
  WHERE license_key = normalized_key
    AND action = normalized_action
    AND created_at > now() - p_window;

  IF recent_count >= greatest(1, p_limit) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;

  INSERT INTO public.license_credential_access_log (license_key, machine_uuid, device_id, action)
  VALUES (
    normalized_key,
    nullif(trim(coalesce(p_machine_uuid, '')), ''),
    nullif(trim(coalesce(p_device_id, '')), ''),
    normalized_action
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.khod_get_license_credential_backup_status(
  p_license_key text,
  p_machine_uuid text,
  p_device_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed jsonb;
  backup record;
BEGIN
  allowed := public.khod_license_credential_device_allowed(p_license_key, p_machine_uuid, p_device_id);
  IF coalesce((allowed->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN allowed;
  END IF;

  SELECT payload_version, account_count, updated_at INTO backup
  FROM public.license_credential_backups
  WHERE license_key = allowed->>'license_key'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'available', false);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'available', true,
    'payload_version', backup.payload_version,
    'account_count', backup.account_count,
    'updated_at', backup.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.khod_get_license_credential_backup(
  p_license_key text,
  p_machine_uuid text,
  p_device_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed jsonb;
  access_check jsonb;
  backup record;
BEGIN
  allowed := public.khod_license_credential_device_allowed(p_license_key, p_machine_uuid, p_device_id);
  IF coalesce((allowed->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN allowed;
  END IF;

  access_check := public.khod_record_license_credential_access(
    allowed->>'license_key',
    p_machine_uuid,
    p_device_id,
    'restore',
    6,
    interval '10 minutes'
  );
  IF coalesce((access_check->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN access_check;
  END IF;

  SELECT payload_version, encrypted_payload, account_count, updated_at INTO backup
  FROM public.license_credential_backups
  WHERE license_key = allowed->>'license_key'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'available', false);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'available', true,
    'payload_version', backup.payload_version,
    'encrypted_payload', backup.encrypted_payload,
    'account_count', backup.account_count,
    'updated_at', backup.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.khod_upsert_license_credential_backup(
  p_license_key text,
  p_machine_uuid text,
  p_device_id text,
  p_payload_version integer,
  p_encrypted_payload jsonb,
  p_account_count integer,
  p_account_hashes jsonb default '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed jsonb;
  access_check jsonb;
  max_accounts integer := 1;
BEGIN
  allowed := public.khod_license_credential_device_allowed(p_license_key, p_machine_uuid, p_device_id);
  IF coalesce((allowed->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN allowed;
  END IF;

  max_accounts := greatest(1, coalesce((allowed->>'max_accounts')::integer, 1));
  IF coalesce(p_payload_version, 0) <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unsupported_payload_version');
  END IF;
  IF coalesce(p_account_count, 0) < 0 OR coalesce(p_account_count, 0) > max_accounts THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'account_limit_exceeded');
  END IF;
  IF p_encrypted_payload IS NULL OR octet_length(p_encrypted_payload::text) > 200000 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  END IF;

  access_check := public.khod_record_license_credential_access(
    allowed->>'license_key',
    p_machine_uuid,
    p_device_id,
    'backup',
    30,
    interval '10 minutes'
  );
  IF coalesce((access_check->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN access_check;
  END IF;

  INSERT INTO public.license_credential_backups (
    license_key,
    payload_version,
    encrypted_payload,
    account_count,
    account_hashes,
    updated_by_machine_uuid,
    updated_by_device_id,
    updated_at
  ) VALUES (
    allowed->>'license_key',
    p_payload_version,
    p_encrypted_payload,
    coalesce(p_account_count, 0),
    coalesce(p_account_hashes, '[]'::jsonb),
    nullif(trim(coalesce(p_machine_uuid, '')), ''),
    nullif(trim(coalesce(p_device_id, '')), ''),
    now()
  )
  ON CONFLICT (license_key) DO UPDATE
    SET payload_version = excluded.payload_version,
        encrypted_payload = excluded.encrypted_payload,
        account_count = excluded.account_count,
        account_hashes = excluded.account_hashes,
        updated_by_machine_uuid = excluded.updated_by_machine_uuid,
        updated_by_device_id = excluded.updated_by_device_id,
        updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.khod_license_credential_device_allowed(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khod_record_license_credential_access(text, text, text, text, integer, interval) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khod_get_license_credential_backup_status(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khod_get_license_credential_backup(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khod_upsert_license_credential_backup(text, text, text, integer, jsonb, integer, jsonb) TO anon, authenticated;
