create table if not exists public.license_credential_backups (
  license_key text primary key references public.licenses(license_key) on delete cascade,
  payload_version integer not null default 1,
  encrypted_payload jsonb not null,
  account_count integer not null default 0,
  account_hashes jsonb not null default '[]'::jsonb,
  updated_by_machine_uuid text,
  updated_by_device_id text,
  updated_at timestamptz not null default now()
);

create table if not exists public.license_credential_access_log (
  id bigserial primary key,
  license_key text not null references public.licenses(license_key) on delete cascade,
  machine_uuid text,
  device_id text,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists license_credential_access_log_lookup_idx
  on public.license_credential_access_log (license_key, action, created_at desc);

alter table public.license_credential_backups enable row level security;
alter table public.license_credential_access_log enable row level security;

drop policy if exists "No direct credential backup access" on public.license_credential_backups;
drop policy if exists "No direct credential access log access" on public.license_credential_access_log;

revoke all on table public.license_credential_backups from anon, authenticated;
revoke all on table public.license_credential_access_log from anon, authenticated;
revoke all on sequence public.license_credential_access_log_id_seq from anon, authenticated;

create or replace function public.khod_license_credential_device_allowed(
  p_license_key text,
  p_machine_uuid text,
  p_device_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.licenses%rowtype;
  normalized_key text := upper(trim(coalesce(p_license_key, '')));
  normalized_machine_uuid text := nullif(trim(coalesce(p_machine_uuid, '')), '');
  normalized_device_id text := nullif(trim(coalesce(p_device_id, '')), '');
begin
  select * into r
  from public.licenses
  where license_key = normalized_key
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'license_not_found');
  end if;
  if coalesce(r.revoked, false) then
    return jsonb_build_object('ok', false, 'reason', 'license_revoked');
  end if;
  if r.expires_at is not null and r.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'license_expired');
  end if;
  if normalized_machine_uuid is null and normalized_device_id is null then
    return jsonb_build_object('ok', false, 'reason', 'device_unknown');
  end if;
  if not exists (
    select 1
    from public.license_devices ld
    where ld.license_key = normalized_key
      and ld.revoked = false
      and (
        (normalized_machine_uuid is not null and ld.machine_uuid = normalized_machine_uuid)
        or (normalized_device_id is not null and ld.device_id = normalized_device_id)
      )
  ) then
    return jsonb_build_object('ok', false, 'reason', 'device_not_activated');
  end if;

  return jsonb_build_object(
    'ok', true,
    'license_key', normalized_key,
    'max_accounts', greatest(1, coalesce(r.max_accounts, 1))
  );
end;
$$;

create or replace function public.khod_record_license_credential_access(
  p_license_key text,
  p_machine_uuid text,
  p_device_id text,
  p_action text,
  p_limit integer default 12,
  p_window interval default interval '10 minutes'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_key text := upper(trim(coalesce(p_license_key, '')));
  normalized_action text := lower(trim(coalesce(p_action, '')));
  recent_count integer := 0;
begin
  delete from public.license_credential_access_log
  where created_at < now() - interval '7 days';

  select count(*) into recent_count
  from public.license_credential_access_log
  where license_key = normalized_key
    and action = normalized_action
    and created_at > now() - p_window;

  if recent_count >= greatest(1, p_limit) then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  insert into public.license_credential_access_log (license_key, machine_uuid, device_id, action)
  values (
    normalized_key,
    nullif(trim(coalesce(p_machine_uuid, '')), ''),
    nullif(trim(coalesce(p_device_id, '')), ''),
    normalized_action
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.khod_get_license_credential_backup_status(
  p_license_key text,
  p_machine_uuid text,
  p_device_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed jsonb;
  backup record;
begin
  allowed := public.khod_license_credential_device_allowed(p_license_key, p_machine_uuid, p_device_id);
  if coalesce((allowed->>'ok')::boolean, false) is not true then
    return allowed;
  end if;

  select payload_version, account_count, updated_at into backup
  from public.license_credential_backups
  where license_key = allowed->>'license_key'
  limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'available', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'available', true,
    'payload_version', backup.payload_version,
    'account_count', backup.account_count,
    'updated_at', backup.updated_at
  );
end;
$$;

create or replace function public.khod_get_license_credential_backup(
  p_license_key text,
  p_machine_uuid text,
  p_device_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed jsonb;
  access_check jsonb;
  backup record;
begin
  allowed := public.khod_license_credential_device_allowed(p_license_key, p_machine_uuid, p_device_id);
  if coalesce((allowed->>'ok')::boolean, false) is not true then
    return allowed;
  end if;

  access_check := public.khod_record_license_credential_access(
    allowed->>'license_key',
    p_machine_uuid,
    p_device_id,
    'restore',
    6,
    interval '10 minutes'
  );
  if coalesce((access_check->>'ok')::boolean, false) is not true then
    return access_check;
  end if;

  select payload_version, encrypted_payload, account_count, updated_at into backup
  from public.license_credential_backups
  where license_key = allowed->>'license_key'
  limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'available', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'available', true,
    'payload_version', backup.payload_version,
    'encrypted_payload', backup.encrypted_payload,
    'account_count', backup.account_count,
    'updated_at', backup.updated_at
  );
end;
$$;

create or replace function public.khod_upsert_license_credential_backup(
  p_license_key text,
  p_machine_uuid text,
  p_device_id text,
  p_payload_version integer,
  p_encrypted_payload jsonb,
  p_account_count integer,
  p_account_hashes jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed jsonb;
  access_check jsonb;
  max_accounts integer := 1;
begin
  allowed := public.khod_license_credential_device_allowed(p_license_key, p_machine_uuid, p_device_id);
  if coalesce((allowed->>'ok')::boolean, false) is not true then
    return allowed;
  end if;

  max_accounts := greatest(1, coalesce((allowed->>'max_accounts')::integer, 1));
  if coalesce(p_payload_version, 0) <> 1 then
    return jsonb_build_object('ok', false, 'reason', 'unsupported_payload_version');
  end if;
  if coalesce(p_account_count, 0) < 0 or coalesce(p_account_count, 0) > max_accounts then
    return jsonb_build_object('ok', false, 'reason', 'account_limit_exceeded');
  end if;
  if p_encrypted_payload is null or octet_length(p_encrypted_payload::text) > 200000 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  access_check := public.khod_record_license_credential_access(
    allowed->>'license_key',
    p_machine_uuid,
    p_device_id,
    'backup',
    30,
    interval '10 minutes'
  );
  if coalesce((access_check->>'ok')::boolean, false) is not true then
    return access_check;
  end if;

  insert into public.license_credential_backups (
    license_key,
    payload_version,
    encrypted_payload,
    account_count,
    account_hashes,
    updated_by_machine_uuid,
    updated_by_device_id,
    updated_at
  ) values (
    allowed->>'license_key',
    p_payload_version,
    p_encrypted_payload,
    coalesce(p_account_count, 0),
    coalesce(p_account_hashes, '[]'::jsonb),
    nullif(trim(coalesce(p_machine_uuid, '')), ''),
    nullif(trim(coalesce(p_device_id, '')), ''),
    now()
  )
  on conflict (license_key) do update
    set payload_version = excluded.payload_version,
        encrypted_payload = excluded.encrypted_payload,
        account_count = excluded.account_count,
        account_hashes = excluded.account_hashes,
        updated_by_machine_uuid = excluded.updated_by_machine_uuid,
        updated_by_device_id = excluded.updated_by_device_id,
        updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.khod_license_credential_device_allowed(text, text, text) to anon, authenticated;
grant execute on function public.khod_record_license_credential_access(text, text, text, text, integer, interval) to anon, authenticated;
grant execute on function public.khod_get_license_credential_backup_status(text, text, text) to anon, authenticated;
grant execute on function public.khod_get_license_credential_backup(text, text, text) to anon, authenticated;
grant execute on function public.khod_upsert_license_credential_backup(text, text, text, integer, jsonb, integer, jsonb) to anon, authenticated;
