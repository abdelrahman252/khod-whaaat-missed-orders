create extension if not exists pgcrypto;

create table if not exists public.marketing_provider_keys (
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

create table if not exists public.marketing_provider_assignments (
  license_key_hash text not null,
  dashboard_account_id text not null,
  provider_key_id uuid not null references public.marketing_provider_keys(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (license_key_hash, dashboard_account_id)
);

alter table public.marketing_connections
  add column if not exists provider_key_id uuid references public.marketing_provider_keys(id) on delete set null;

alter table public.marketing_account_mappings
  add column if not exists provider_key_id uuid references public.marketing_provider_keys(id) on delete set null;

create index if not exists marketing_provider_keys_status_lookup
  on public.marketing_provider_keys (provider, status, created_at);

create index if not exists marketing_provider_assignments_key_lookup
  on public.marketing_provider_assignments (provider_key_id);

create index if not exists marketing_connections_provider_key_lookup
  on public.marketing_connections (provider_key_id);

create index if not exists marketing_account_mappings_provider_key_lookup
  on public.marketing_account_mappings (provider_key_id);

alter table public.marketing_provider_keys enable row level security;
alter table public.marketing_provider_assignments enable row level security;

revoke all on table public.marketing_provider_keys from anon, authenticated;
revoke all on table public.marketing_provider_assignments from anon, authenticated;

comment on table public.marketing_provider_keys is
  'Service-role managed pool of backend marketing provider API keys. API keys are never exposed to the desktop app.';

comment on table public.marketing_provider_assignments is
  'Stable assignment from a KHOD dashboard account to the provider key that owns its marketing connection.';

comment on column public.marketing_connections.provider_key_id is
  'Provider key used for this Windsor connection; null rows fall back to the legacy WINDSOR_API_KEY during migration.';

comment on column public.marketing_account_mappings.provider_key_id is
  'Provider key that owns the mapped source account when known.';
