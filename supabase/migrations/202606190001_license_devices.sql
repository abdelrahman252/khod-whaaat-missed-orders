alter table public.licenses
  add column if not exists max_devices integer not null default 1;

create table if not exists public.license_devices (
  id bigserial primary key,
  license_key text not null references public.licenses(license_key) on delete cascade,
  machine_uuid text,
  device_id text,
  activated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked boolean not null default false,
  revoked_at timestamptz
);

create unique index if not exists license_devices_active_machine_uuid_idx
  on public.license_devices (license_key, machine_uuid)
  where machine_uuid is not null and revoked = false;

create index if not exists license_devices_active_device_id_idx
  on public.license_devices (license_key, device_id)
  where device_id is not null and revoked = false;

create index if not exists license_devices_license_key_idx
  on public.license_devices (license_key);

alter table public.license_devices enable row level security;

drop policy if exists "Allow read license_devices" on public.license_devices;
drop policy if exists "Allow insert license_devices" on public.license_devices;
drop policy if exists "Allow update license_devices" on public.license_devices;
drop policy if exists "Allow delete license_devices" on public.license_devices;

revoke all on table public.license_devices from anon, authenticated;

create or replace function public.khod_check_license_with_identity(
  p_license_key text,
  p_machine_uuid text,
  p_device_id text,
  p_account_idents jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.licenses%rowtype;
  device_row record;
  normalized_machine_uuid text := nullif(trim(coalesce(p_machine_uuid, '')), '');
  normalized_device_id text := nullif(trim(coalesce(p_device_id, '')), '');
  active_device_count int := 0;
  max_device_count int := 1;
  matched_layer int := 0;
  identity_matched boolean := false;
  do_flush boolean := false;
  do_reset_cache boolean := false;
begin
  select * into r
  from public.licenses
  where license_key = upper(trim(p_license_key))
  limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'License not found on server.');
  end if;
  if r.revoked then
    return jsonb_build_object('valid', false, 'reason', 'Your license has been revoked. Contact support.');
  end if;
  if r.expires_at is not null and r.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'License expired. Please renew.');
  end if;
  if normalized_machine_uuid is null and normalized_device_id is null then
    return jsonb_build_object('valid', false, 'reason', 'Cannot identify this device. Restart the app and try again.');
  end if;

  perform pg_advisory_xact_lock(hashtext(r.license_key));
  max_device_count := greatest(1, coalesce(r.max_devices, 1));

  if (r.machine_uuid is not null or r.device_id is not null)
     and not exists (
       select 1 from public.license_devices
       where license_key = r.license_key and revoked = false
     )
  then
    insert into public.license_devices (license_key, machine_uuid, device_id, activated_at, last_seen_at)
    values (r.license_key, nullif(trim(coalesce(r.machine_uuid, '')), ''), nullif(trim(coalesce(r.device_id, '')), ''), coalesce(r.activated_at, now()), now());
  end if;

  if coalesce(r.allow_reset, false) = true then
    update public.license_devices
    set revoked = true, revoked_at = now()
    where license_key = r.license_key and revoked = false;

    insert into public.license_devices (license_key, machine_uuid, device_id)
    values (r.license_key, normalized_machine_uuid, normalized_device_id);

    update public.licenses
    set machine_uuid = normalized_machine_uuid,
        device_id = normalized_device_id,
        activated_at = now(),
        allow_reset = false
    where license_key = r.license_key;
    r.machine_uuid := normalized_machine_uuid;
    r.device_id := normalized_device_id;
    r.allow_reset := false;
    matched_layer := 0;
  else
    select id, machine_uuid, device_id into device_row
    from public.license_devices ld
    where ld.license_key = r.license_key
      and ld.revoked = false
      and (
        (normalized_machine_uuid is not null and ld.machine_uuid = normalized_machine_uuid)
        or (
          normalized_device_id is not null
          and ld.device_id = normalized_device_id
          and (max_device_count = 1 or ld.machine_uuid is null)
        )
      )
    order by case when normalized_machine_uuid is not null and ld.machine_uuid = normalized_machine_uuid then 0 else 1 end
    limit 1;

    if found then
      select count(*) into active_device_count
      from public.license_devices
      where license_key = r.license_key and revoked = false;

      if active_device_count > max_device_count and not exists (
        select 1
        from (
          select id
          from public.license_devices
          where license_key = r.license_key and revoked = false
          order by activated_at asc, id asc
          limit max_device_count
        ) kept
        where kept.id = device_row.id
      ) then
        return jsonb_build_object(
          'valid', false,
          'reason', 'License device limit reached. Deactivate another device or contact support.',
          'device_limit_reached', true,
          'max_devices', max_device_count,
          'active_devices', active_device_count
        );
      end if;

      update public.license_devices
      set machine_uuid = coalesce(normalized_machine_uuid, machine_uuid),
          device_id = coalesce(normalized_device_id, device_id),
          last_seen_at = now()
      where id = device_row.id;
      matched_layer := case when device_row.machine_uuid = normalized_machine_uuid then 1 else 2 end;
    else
      select count(*) into active_device_count
      from public.license_devices
      where license_key = r.license_key and revoked = false;

      if active_device_count < max_device_count then
        insert into public.license_devices (license_key, machine_uuid, device_id)
        values (r.license_key, normalized_machine_uuid, normalized_device_id);

        if active_device_count = 0 then
          update public.licenses
          set machine_uuid = normalized_machine_uuid,
              device_id = normalized_device_id,
              activated_at = now()
          where license_key = r.license_key;
          r.machine_uuid := normalized_machine_uuid;
          r.device_id := normalized_device_id;
        end if;
        matched_layer := 4;
      else
        if jsonb_array_length(coalesce(p_account_idents, '[]'::jsonb)) > 0 and exists (
          select 1 from public.license_accounts la
          where la.license_key = r.license_key
            and (
              (la.easy_email is not null and la.easy_email <> '' and
               exists (select 1 from jsonb_array_elements(p_account_idents) as ai
                       where lower(ai->>'easy_email') = lower(la.easy_email)))
              or
              (la.khod_email is not null and la.khod_email <> '' and
               exists (select 1 from jsonb_array_elements(p_account_idents) as ai
                       where lower(ai->>'khod_email') = lower(la.khod_email)))
            )
        ) then
          identity_matched := true;
        end if;

        if identity_matched and max_device_count = 1 then
          update public.license_devices
          set revoked = true, revoked_at = now()
          where license_key = r.license_key and revoked = false;

          insert into public.license_devices (license_key, machine_uuid, device_id)
          values (r.license_key, normalized_machine_uuid, normalized_device_id);

          update public.licenses
          set machine_uuid = normalized_machine_uuid,
              device_id = normalized_device_id,
              activated_at = now()
          where license_key = r.license_key;
          r.machine_uuid := normalized_machine_uuid;
          r.device_id := normalized_device_id;
          matched_layer := 3;
        else
          return jsonb_build_object(
            'valid', false,
            'reason', 'License device limit reached. Deactivate another device or contact support.',
            'device_limit_reached', true,
            'max_devices', max_device_count,
            'active_devices', active_device_count
          );
        end if;
      end if;
    end if;
  end if;

  if coalesce(r.force_flush, false) = true then
    do_flush := true;
    update public.licenses set force_flush = false where license_key = r.license_key;
  end if;

  if coalesce(r.reset_cache, false) = true then
    do_reset_cache := true;
    update public.licenses set reset_cache = false where license_key = r.license_key;
  end if;

  select count(*) into active_device_count
  from public.license_devices
  where license_key = r.license_key and revoked = false;

  return jsonb_build_object(
    'valid', true,
    'license_key', r.license_key,
    'expires_at', r.expires_at,
    'customer_name', r.customer_name,
    'allow_reset', coalesce(r.allow_reset, false),
    'max_accounts', coalesce(r.max_accounts, 1),
    'max_devices', max_device_count,
    'active_devices', active_device_count,
    'analytics_enabled', coalesce(r.analytics_enabled, true),
    'operations_enabled', coalesce(r.operations_enabled, true),
    'dashboard_enabled', coalesce(r.dashboard_enabled, false),
    'team_leader_enabled', coalesce(r.team_leader_enabled, false),
    'force_flush', do_flush,
    'reset_cache', do_reset_cache,
    'matched_layer', matched_layer
  );
end;
$$;

grant execute on function public.khod_check_license_with_identity(text, text, text, jsonb) to anon, authenticated;
