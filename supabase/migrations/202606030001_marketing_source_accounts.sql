create table if not exists public.marketing_source_accounts (
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

alter table public.marketing_source_accounts enable row level security;

alter table public.marketing_connections
  add column if not exists connect_snapshot jsonb,
  add column if not exists connect_started_at timestamptz;

create index if not exists marketing_source_accounts_lookup
  on public.marketing_source_accounts (license_key_hash, platform, status);

create index if not exists marketing_source_accounts_source_lookup
  on public.marketing_source_accounts (license_key_hash, platform, source_account_id);

comment on table public.marketing_source_accounts is
  'Server-managed app-local pool of Windsor source accounts known to this Khod/KHOD license.';

comment on column public.marketing_connections.connect_snapshot is
  'Windsor source account ids captured before an OAuth connect flow, used to discover newly added accounts.';
