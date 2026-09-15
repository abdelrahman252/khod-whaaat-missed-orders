create table if not exists public.license_accounts (
  license_key text not null,
  account_hash text not null,
  easy_email text,
  easy_store text,
  khod_email text,
  unlocked boolean not null default false,
  added_at timestamptz not null default now(),
  primary key (license_key, account_hash)
);

alter table public.license_accounts
  add column if not exists license_key text;

alter table public.license_accounts
  add column if not exists account_hash text;

alter table public.license_accounts
  add column if not exists easy_email text;

alter table public.license_accounts
  add column if not exists easy_store text;

alter table public.license_accounts
  add column if not exists khod_email text;

alter table public.license_accounts
  add column if not exists unlocked boolean not null default false;

alter table public.license_accounts
  add column if not exists added_at timestamptz not null default now();

alter table public.license_accounts
  alter column unlocked set default false;

update public.license_accounts
set unlocked = false
where unlocked is null;

alter table public.license_accounts
  alter column unlocked set not null;

drop function if exists public.khod_get_license_accounts(text);
create function public.khod_get_license_accounts(p_license_key text)
returns table(account_hash text, easy_email text, easy_store text, khod_email text, unlocked boolean)
language sql
security definer
set search_path = public
as $$
  select la.account_hash, la.easy_email, la.easy_store, la.khod_email, la.unlocked
  from public.license_accounts la
  join public.licenses l on l.license_key = la.license_key
  where la.license_key = upper(trim(p_license_key))
    and l.revoked = false
    and (l.expires_at is null or l.expires_at >= now())
  order by la.added_at asc;
$$;

drop function if exists public.khod_insert_license_account(text, text, boolean);
drop function if exists public.khod_insert_license_account(text, text, text, text, boolean);
drop function if exists public.khod_insert_license_account(text, text, text, text, text, boolean);
drop function if exists public.khod_insert_license_account(text, text, text, text, text, text, boolean);
create function public.khod_insert_license_account(
  p_license_key text,
  p_account_hash text,
  p_easy_email text default null,
  p_easy_store text default null,
  p_khod_email text default null,
  p_unlocked boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  max_n int;
  current_n int;
  normalized_license text;
  normalized_easy_email text;
  normalized_easy_store text;
  normalized_khod_email text;
begin
  normalized_license := upper(trim(p_license_key));
  normalized_easy_email := lower(trim(coalesce(p_easy_email, '')));
  normalized_easy_store := lower(regexp_replace(trim(coalesce(p_easy_store, '')), '\s+', ' ', 'g'));
  normalized_khod_email := lower(trim(coalesce(p_khod_email, '')));

  perform pg_advisory_xact_lock(hashtext(normalized_license));

  select coalesce(max_accounts, 1) into max_n
  from public.licenses
  where license_key = normalized_license
    and revoked = false
    and (expires_at is null or expires_at >= now())
  limit 1;

  if max_n is null then
    return jsonb_build_object('success', false, 'reason', 'license_invalid');
  end if;

  if normalized_khod_email <> '' and exists (
    select 1
    from public.license_accounts la
    where la.license_key = normalized_license
      and la.account_hash <> p_account_hash
      and lower(trim(coalesce(la.khod_email, ''))) = normalized_khod_email
      and (
        normalized_easy_email = ''
        or normalized_easy_store = ''
        or trim(coalesce(la.easy_email, '')) = ''
        or (
          trim(coalesce(la.easy_store, '')) <> ''
          and lower(trim(la.easy_email)) = normalized_easy_email
          and lower(regexp_replace(trim(la.easy_store), '\s+', ' ', 'g')) = normalized_easy_store
        )
      )
  ) then
    return jsonb_build_object('success', false, 'reason', 'duplicate_account');
  end if;

  select count(*) into current_n
  from public.license_accounts
  where license_key = normalized_license;

  if current_n >= max_n and not exists (
    select 1 from public.license_accounts
    where license_key = normalized_license and account_hash = p_account_hash
  ) then
    return jsonb_build_object('success', false, 'reason', 'limit_reached');
  end if;

  insert into public.license_accounts
    (license_key, account_hash, easy_email, easy_store, khod_email, unlocked)
  values
    (normalized_license, p_account_hash, normalized_easy_email, normalized_easy_store, normalized_khod_email, coalesce(p_unlocked, false))
  on conflict (license_key, account_hash)
  do update set
    easy_email = excluded.easy_email,
    easy_store = excluded.easy_store,
    khod_email = excluded.khod_email;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.khod_get_license_accounts(text) to anon, authenticated;
grant execute on function public.khod_insert_license_account(text, text, text, text, text, boolean) to anon, authenticated;

drop function if exists public.khod_replace_license_account(text, text, text, text, text, text, text);
drop function if exists public.khod_replace_license_account(text, text, text, text, text, text);
create function public.khod_replace_license_account(
  p_license_key text,
  p_old_account_hash text,
  p_new_account_hash text,
  p_easy_email text default null,
  p_easy_store text default null,
  p_khod_email text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_license text := upper(trim(p_license_key));
  normalized_easy_email text := lower(trim(coalesce(p_easy_email, '')));
  normalized_easy_store text := lower(regexp_replace(trim(coalesce(p_easy_store, '')), '\s+', ' ', 'g'));
  normalized_khod_email text := lower(trim(coalesce(p_khod_email, '')));
begin
  perform pg_advisory_xact_lock(hashtext(normalized_license));

  if not exists (
    select 1 from public.license_accounts
    where license_key = normalized_license and account_hash = p_old_account_hash and unlocked = true
  ) then
    return jsonb_build_object('success', false, 'reason', 'account_locked');
  end if;

  if normalized_khod_email <> '' and exists (
    select 1
    from public.license_accounts la
    where la.license_key = normalized_license
      and la.account_hash <> p_old_account_hash
      and lower(trim(coalesce(la.khod_email, ''))) = normalized_khod_email
      and (
        normalized_easy_email = ''
        or normalized_easy_store = ''
        or trim(coalesce(la.easy_email, '')) = ''
        or (
          trim(coalesce(la.easy_store, '')) <> ''
          and lower(trim(la.easy_email)) = normalized_easy_email
          and lower(regexp_replace(trim(la.easy_store), '\s+', ' ', 'g')) = normalized_easy_store
        )
      )
  ) then
    return jsonb_build_object('success', false, 'reason', 'duplicate_account');
  end if;

  update public.license_accounts
  set account_hash = p_new_account_hash,
      easy_email = normalized_easy_email,
      easy_store = normalized_easy_store,
      khod_email = normalized_khod_email
  where license_key = normalized_license and account_hash = p_old_account_hash and unlocked = true;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.khod_replace_license_account(text, text, text, text, text, text) to anon, authenticated;
