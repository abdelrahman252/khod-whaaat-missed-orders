create table if not exists public.marketing_account_limits (
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

create index if not exists marketing_account_limits_account_lookup
  on public.marketing_account_limits (platform, dashboard_account_id);

alter table public.marketing_account_limits enable row level security;

revoke all on table public.marketing_account_limits from anon, authenticated;

comment on table public.marketing_account_limits is
  'Service-role managed per-license dashboard account limits for mapped marketing ad accounts.';
