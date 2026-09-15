alter table public.marketing_connections
  add column if not exists status_checked_at timestamptz;

create table if not exists public.marketing_daily_metrics (
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

create index if not exists marketing_daily_metrics_range_lookup
  on public.marketing_daily_metrics (
    license_key_hash,
    provider_key_ref,
    platform,
    report_date
  );

alter table public.marketing_daily_metrics enable row level security;

revoke all on table public.marketing_daily_metrics from anon, authenticated;

comment on column public.marketing_connections.status_checked_at is
  'Last time the backend validated this connection against the marketing provider.';

comment on table public.marketing_daily_metrics is
  'Server-managed target-currency-independent daily marketing metrics used for incremental synchronization.';
