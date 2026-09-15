create table if not exists public.marketing_connections (
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

alter table public.marketing_connections enable row level security;

comment on table public.marketing_connections is
  'Server-managed mapping between a licensed dashboard account and its Windsor marketing connection.';

comment on column public.marketing_connections.windsor_access_token is
  'Opaque Windsor co-user link identifier; never returned to the Electron renderer.';

