create table if not exists public.marketing_account_mappings (
  license_key_hash text not null,
  dashboard_account_id text not null,
  platform text not null,
  source_account_id text not null,
  source_account_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (license_key_hash, dashboard_account_id, platform, source_account_id)
);

alter table public.marketing_account_mappings enable row level security;

comment on table public.marketing_account_mappings is
  'Server-managed many-to-many assignments from KHOD dashboard accounts to marketing ad accounts.';
